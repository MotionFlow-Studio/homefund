import { isCurrency } from "@/lib/money";
import { env } from "@/server/env";
import { errorResponse, isSameOrigin, json } from "@/server/http";
import { MetaApiError, transcribe } from "@/server/meta-api";
import { createRateLimiter } from "@/server/rate-limit";
import { getSessionUser } from "@/server/supabase";
import { understandSpeech } from "@/server/voice-entry";

/** 20 seconds of 16-bit mono audio at 24 kHz, plus the WAV header. */
const MAX_BYTES = 20 * 24_000 * 2 + 1024;
const perMinute = createRateLimiter({ limit: 10, windowMs: 60_000 });
const perDay = createRateLimiter({ limit: 150, windowMs: 86_400_000 });

/**
 * A spoken expense or income: Muse Voice Transcribe writes it down and Muse
 * Spark 1.3 fills in the entry. The recording lives only for this request.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  if (!env.metaApiKey) return errorResponse(503, "busy");
  const retry = Math.max(perMinute.retryAfter(user.id), perDay.retryAfter(user.id));
  if (retry > 0) return errorResponse(429, "rate_limited");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 4096) return errorResponse(413, "too_long");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "failed");
  }
  const audio = form.get("audio");
  const currency = form.get("currency");
  const today = String(form.get("today") ?? "");
  if (!(audio instanceof File) || !isCurrency(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return errorResponse(400, "failed");
  if (audio.size > MAX_BYTES) return errorResponse(413, "too_long");
  perMinute.hit(user.id);
  perDay.hit(user.id);

  const signal = AbortSignal.any([AbortSignal.timeout(25_000), request.signal]);
  let bytes: Uint8Array | null = null;
  try {
    bytes = new Uint8Array(await audio.arrayBuffer());
    const transcript = (await transcribe(bytes, signal)).trim();
    if (transcript.length < 2) return errorResponse(422, "no_speech");
    return json(await understandSpeech(transcript, currency, today, signal));
  } catch (error) {
    if (error instanceof MetaApiError && error.status === 429) return errorResponse(503, "busy");
    // Never log the recording or what was said.
    console.error("Voice entry failed:", error instanceof MetaApiError ? error.status : (error as Error)?.name);
    return errorResponse(502, "failed");
  } finally {
    bytes?.fill(0);
  }
}
