import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/** JSON response that is never cached. */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(status: number, error: string) {
  return json({ error }, status);
}

/**
 * Blocks cross-site requests: state-changing calls must come from our own
 * origin. Together with SameSite cookies this stops CSRF.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Reads and validates a JSON body. Returns null when it is invalid. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
  maxBytes = 16_384,
): Promise<z.infer<T> | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
