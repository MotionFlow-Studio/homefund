import { z } from "zod";
import { financeContextSchema } from "@/lib/assistant";
import { answerFor, insightsFor } from "@/server/assistant";
import { env } from "@/server/env";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { MetaApiError } from "@/server/meta-api";
import { createRateLimiter } from "@/server/rate-limit";
import { getSessionUser } from "@/server/supabase";

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("insights"), context: financeContextSchema }),
  z.object({ kind: z.literal("ask"), question: z.string().trim().min(2).max(300), context: financeContextSchema }),
]);

const perMinute = createRateLimiter({ limit: 8, windowMs: 60_000 });
const perDay = createRateLimiter({ limit: 80, windowMs: 86_400_000 });
const TIMEOUT_MS = 25_000;

/** Insights about the user's budget, or an answer to their question, from Muse Spark 1.3. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  if (!env.metaApiKey) return errorResponse(503, "not_configured");
  const retry = Math.max(perMinute.retryAfter(user.id), perDay.retryAfter(user.id));
  if (retry > 0) {
    const response = errorResponse(429, "rate_limited");
    response.headers.set("Retry-After", String(retry));
    return response;
  }
  const input = await readJson(request, body, 32_768);
  if (!input) return errorResponse(400, "invalid_input");
  perMinute.hit(user.id);
  perDay.hit(user.id);

  const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), request.signal]);
  try {
    if (input.kind === "insights") return json({ insights: await insightsFor(input.context, signal) });
    return json(await answerFor(input.context, input.question, signal));
  } catch (error) {
    if (signal.aborted) return errorResponse(504, "timeout");
    if (error instanceof MetaApiError && error.status === 429) return errorResponse(503, "busy");
    // Never log the question or the numbers.
    console.error("Assistant failed:", error instanceof MetaApiError ? error.status : (error as Error)?.name);
    return errorResponse(502, "failed");
  }
}
