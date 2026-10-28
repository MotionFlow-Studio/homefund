import type { CategoryId } from "@/lib/categories";
import type { IncomeSource } from "@/lib/model";

/** What was understood from a spoken expense or income, ready to confirm in the form. */
export type VoiceEntry = {
  transcript: string;
  kind: "expense" | "income";
  amountMinor: number | null;
  category: CategoryId | null;
  incomeSource: IncomeSource | null;
  note: string | null;
  date: string | null;
};

export type VoiceError = "offline" | "no_speech" | "too_long" | "rate_limited" | "busy" | "failed";

export const VOICE_ERROR_TEXT: Record<VoiceError, string> = {
  offline: "You are offline. Voice entry needs a connection.",
  no_speech: "I didn't catch that. Try again, a little closer to the phone.",
  too_long: "That was a bit long. Say one expense at a time, in a few words.",
  rate_limited: "That's a lot in a row. Try again in a minute.",
  busy: "Voice is busy right now. Try again in a moment.",
  failed: "Something went wrong. Try again or type it in.",
};

/** Longest recording accepted, in seconds. */
export const VOICE_MAX_SECONDS = 20;
