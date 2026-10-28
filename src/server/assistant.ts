import "server-only";
import { describeContext, INSIGHT_TONES, type AskAnswer, type FinanceContext, type Insight } from "@/lib/assistant";
import { formatMoney } from "@/lib/money";
import { askAsJson } from "@/server/meta-api";

/*
 * The money coach: Muse Spark 1.3 reads the user's budget totals and writes
 * short insights or answers a question. Nothing here is stored or logged.
 */

const COACH = `You are the money coach inside HomeFund, a family budget app.
Use only the numbers you are given; never invent amounts, shops or dates.
Write plain, warm, direct English for a busy parent. No jargon, no lectures,
no investment or credit advice. Keep amounts in the given currency format.`;

const INSIGHTS_SCHEMA = {
  name: "insights",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["insights"],
    properties: {
      insights: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tone", "title", "body"],
          properties: {
            tone: { type: "string", enum: [...INSIGHT_TONES] },
            title: { type: "string", description: "At most 7 words." },
            body: { type: "string", description: "One or two short sentences with concrete amounts." },
          },
        },
      },
    },
  },
};

const ASK_SCHEMA = {
  name: "answer",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "answer"],
    properties: {
      verdict: {
        type: "string",
        enum: ["yes", "careful", "no", "info"],
        description: "yes: fits the budget; careful: fits but tight; no: does not fit; info: not a yes/no question.",
      },
      answer: { type: "string", description: "At most three short sentences, with the numbers that matter." },
    },
  },
};

const money = (c: FinanceContext) => (minor: number) => formatMoney(minor, c.currency);

export async function insightsFor(context: FinanceContext, signal: AbortSignal): Promise<Insight[]> {
  const text = await askAsJson(
    `${COACH}
Write exactly three insights:
1. How the pay period is going: the pace and what will be left on payday (tone "good" if on track, "watch" if not).
2. The most telling change or biggest category, comparing the last 7 days with the 7 before when useful.
3. One practical tip that would make a real difference this period (tone "tip"), with an amount.`,
    describeContext(context, money(context)),
    INSIGHTS_SCHEMA,
    "low",
    signal,
  );
  const parsed = JSON.parse(text) as { insights: Insight[] };
  return parsed.insights.slice(0, 3).map((i) => ({
    tone: INSIGHT_TONES.includes(i.tone) ? i.tone : "tip",
    title: String(i.title).slice(0, 80),
    body: String(i.body).slice(0, 320),
  }));
}

export async function answerFor(context: FinanceContext, question: string, signal: AbortSignal): Promise<AskAnswer> {
  const text = await askAsJson(
    `${COACH}
Answer the user's question about their own money using the budget below. If they ask whether they can afford
something, compare it with what is left and the days to payday, and say what it would leave per day. If the
question is not about their money, say kindly that you can only help with their budget.

${describeContext(context, money(context))}`,
    question,
    ASK_SCHEMA,
    "low",
    signal,
  );
  const parsed = JSON.parse(text) as AskAnswer;
  const verdict = ["yes", "careful", "no", "info"].includes(parsed.verdict) ? parsed.verdict : "info";
  return { verdict, answer: String(parsed.answer).slice(0, 700) };
}
