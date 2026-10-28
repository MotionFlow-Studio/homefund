import "server-only";
import { addDays } from "@/lib/budget";
import { CATEGORY_IDS, CATEGORY_LIST } from "@/lib/categories";
import { currencyDecimals, toMinor } from "@/lib/money";
import { INCOME_SOURCES } from "@/lib/model";
import type { VoiceEntry } from "@/lib/voice-entry";
import { askAsJson } from "@/server/meta-api";

/*
 * Turns a spoken sentence ("groceries at FreshMart, 42 dollars") into an
 * entry with Muse Spark 1.3. The user always confirms it in the form.
 */

const SCHEMA = {
  name: "entry",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "amount", "category", "incomeSource", "note", "day"],
    properties: {
      kind: { type: "string", enum: ["expense", "income"], description: "income only for money received" },
      amount: { type: ["string", "null"], description: "Decimal amount as said, digits and a dot only, e.g. 42.50" },
      category: { type: ["string", "null"], enum: [...CATEGORY_IDS, null] },
      incomeSource: { type: ["string", "null"], enum: [...INCOME_SOURCES, null] },
      note: { type: ["string", "null"], description: "A short title: the shop or what it was for, max 6 words" },
      day: { type: ["string", "null"], enum: ["today", "yesterday", "2_days_ago", "3_days_ago", null] },
    },
  },
};

export async function understandSpeech(transcript: string, currency: string, today: string, signal: AbortSignal): Promise<VoiceEntry> {
  const categories = CATEGORY_LIST.map((c) => `${c.id}: ${c.hint}`).join("\n");
  const text = await askAsJson(
    `You turn one spoken sentence into a budget entry for a family budget app. The currency is ${currency}.
An expense is money spent; income is money received (bonus, side job, refund, gift, sale, benefit).
Pick the expense category from this list:
${categories}
If something is not said, use null. Never invent an amount.`,
    transcript,
    SCHEMA,
    "minimal",
    signal,
  );
  const parsed = JSON.parse(text) as {
    kind: string;
    amount: string | null;
    category: string | null;
    incomeSource: string | null;
    note: string | null;
    day: string | null;
  };
  let amountMinor: number | null = null;
  if (parsed.amount) {
    try {
      const value = toMinor(Number(parsed.amount).toFixed(currencyDecimals(currency)), currency);
      amountMinor = value > 0 ? value : null;
    } catch {
      amountMinor = null;
    }
  }
  const back = { today: 0, yesterday: 1, "2_days_ago": 2, "3_days_ago": 3 }[parsed.day ?? "today"] ?? 0;
  return {
    transcript,
    kind: parsed.kind === "income" ? "income" : "expense",
    amountMinor,
    category: (CATEGORY_IDS as readonly string[]).includes(parsed.category ?? "") ? (parsed.category as VoiceEntry["category"]) : null,
    incomeSource: (INCOME_SOURCES as readonly string[]).includes(parsed.incomeSource ?? "")
      ? (parsed.incomeSource as VoiceEntry["incomeSource"])
      : null,
    note: parsed.note ? parsed.note.slice(0, 120) : null,
    date: addDays(today, -back),
  };
}
