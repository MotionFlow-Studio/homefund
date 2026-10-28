import type { AskAnswer, FinanceContext, Insight } from "@/lib/assistant";

export type CoachError = "offline" | "rate_limited" | "busy" | "failed";

async function call<T>(payload: object): Promise<{ ok: true; value: T } | { ok: false; error: CoachError }> {
  let response: Response;
  try {
    response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  if (response.status === 429) return { ok: false, error: "rate_limited" };
  if (response.status === 503) return { ok: false, error: "busy" };
  if (!response.ok) return { ok: false, error: "failed" };
  return { ok: true, value: (await response.json()) as T };
}

export function fetchInsights(context: FinanceContext) {
  return call<{ insights: Insight[] }>({ kind: "insights", context });
}

export function askCoach(context: FinanceContext, question: string) {
  return call<AskAnswer>({ kind: "ask", question, context });
}

export const COACH_ERROR_TEXT: Record<CoachError, string> = {
  offline: "You are offline. Insights come back when you are connected.",
  rate_limited: "That's a lot of questions. Try again in a minute.",
  busy: "The coach is busy right now. Try again in a moment.",
  failed: "Something went wrong. Try again.",
};

const CACHE_KEY = "hf-insights";

/** Insights are kept for the day, as long as the numbers have not changed. */
export function cachedInsights(signature: string): Insight[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { signature: string; insights: Insight[] } | null;
    return saved && saved.signature === signature ? saved.insights : null;
  } catch {
    return null;
  }
}

export function storeInsights(signature: string, insights: Insight[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ signature, insights }));
  } catch {
    // Private mode: fine, they are fetched again next time.
  }
}
