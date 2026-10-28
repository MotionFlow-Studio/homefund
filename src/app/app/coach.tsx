"use client";

import { AlertTriangle, ArrowUp, Lightbulb, RefreshCw, Sparkles, ThumbsUp, TrendingUp } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AskAnswer, FinanceContext, Insight } from "@/lib/assistant";
import { askCoach, cachedInsights, COACH_ERROR_TEXT, fetchInsights, storeInsights } from "@/lib/assistant-client";

/*
 * The money coach on the home screen, powered by Muse Spark 1.3: three
 * insights about the pay period and a box to ask about your own money.
 */

const TONE = {
  good: { icon: TrendingUp, ring: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  watch: { icon: AlertTriangle, ring: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  tip: { icon: Lightbulb, ring: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
} as const;

function signatureOf(c: FinanceContext) {
  return [c.today, c.spentMinor, c.availableMinor, c.categories.length].join("|");
}

function ModelBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
      <Sparkles size={12} aria-hidden /> Muse Spark 1.3
    </span>
  );
}

export function InsightsCard({ context, className = "" }: { context: FinanceContext; className?: string }) {
  const signature = signatureOf(context);
  const [state, setState] = useState<{ signature: string; insights: Insight[] | null; error: string | null; loading: boolean }>(() => ({
    signature,
    insights: cachedInsights(signature),
    error: null,
    loading: false,
  }));
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const cached = refresh === 0 ? cachedInsights(signature) : null;
    if (cached) {
      queueMicrotask(() => active && setState({ signature, insights: cached, error: null, loading: false }));
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => active && setState((s) => ({ ...s, signature, loading: true, error: null })));
    fetchInsights(context).then((result) => {
      if (!active) return;
      if (result.ok) {
        storeInsights(signature, result.value.insights);
        setState({ signature, insights: result.value.insights, error: null, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false, error: COACH_ERROR_TEXT[result.error] }));
      }
    });
    return () => {
      active = false;
    };
    // The context changes identity on every render; its signature says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, refresh]);

  const insights = state.signature === signature ? state.insights : null;

  return (
    <section aria-labelledby="insights-title" className={`card relative overflow-hidden p-6 ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <h2 id="insights-title" className="flex items-center gap-2 font-semibold">
          <Sparkles size={18} className="text-fuchsia-500" aria-hidden /> Insights for you
        </h2>
        <div className="flex items-center gap-2">
          <ModelBadge />
          <button
            type="button"
            onClick={() => setRefresh((n) => n + 1)}
            disabled={state.loading}
            aria-label="Refresh insights"
            className="flex size-8 items-center justify-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100 disabled:animate-spin dark:hover:bg-white/10"
          >
            <RefreshCw size={15} aria-hidden />
          </button>
        </div>
      </div>

      {insights && !state.loading ? (
        <ul className="relative mt-5 grid gap-3 lg:grid-cols-3">
          {insights.map((insight, index) => {
            const tone = TONE[insight.tone] ?? TONE.tip;
            const Icon = tone.icon;
            return (
              <li key={index} className="coach-in rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]" style={{ animationDelay: `${index * 90}ms` }}>
                <span className={`flex size-9 items-center justify-center rounded-xl ${tone.ring}`} aria-hidden>
                  <Icon size={18} />
                </span>
                <p className="mt-3 font-semibold leading-snug">{insight.title}</p>
                <p className="mt-1 text-sm leading-relaxed opacity-70">{insight.body}</p>
              </li>
            );
          })}
        </ul>
      ) : state.error && !state.loading ? (
        <p className="relative mt-4 text-sm opacity-70">{state.error}</p>
      ) : (
        <div className="relative mt-5 grid gap-3 lg:grid-cols-3" role="status" aria-label="Reading your numbers">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
              <span className="block size-9 animate-pulse rounded-xl bg-black/[0.07] dark:bg-white/10" />
              <span className="mt-3 block h-4 w-3/4 animate-pulse rounded bg-black/[0.07] dark:bg-white/10" />
              <span className="mt-2 block h-3 w-full animate-pulse rounded bg-black/[0.05] dark:bg-white/[0.07]" />
              <span className="mt-1.5 block h-3 w-2/3 animate-pulse rounded bg-black/[0.05] dark:bg-white/[0.07]" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const VERDICT = {
  yes: { label: "Fits your budget", icon: ThumbsUp, style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  careful: { label: "Fits, but it's tight", icon: AlertTriangle, style: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  no: { label: "Doesn't fit right now", icon: AlertTriangle, style: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  info: { label: "Here's the picture", icon: Lightbulb, style: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
} as const;

export function AskCard({ context, money, className = "" }: { context: FinanceContext; money: (minor: number) => string; className?: string }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    `Can I spend ${money(Math.max(1000, Math.round((context.perDayMinor * 0.5) / 1000) * 1000))} on dinner this weekend?`,
    "Where could I save this month?",
    "Am I on track for payday?",
  ];

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 2 || loading) return;
    setAsked(q);
    setQuestion("");
    setAnswer(null);
    setError(null);
    setLoading(true);
    const result = await askCoach(context, q);
    setLoading(false);
    if (result.ok) setAnswer(result.value);
    else setError(COACH_ERROR_TEXT[result.error]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const verdict = answer ? VERDICT[answer.verdict] ?? VERDICT.info : null;

  return (
    <section aria-labelledby="ask-title" className={`card relative overflow-hidden p-6 ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-60 rounded-full bg-indigo-400/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <h2 id="ask-title" className="flex items-center gap-2 font-semibold">
          <Sparkles size={18} className="text-indigo-500" aria-hidden /> Ask HomeFund
        </h2>
        <ModelBadge />
      </div>
      <p className="relative mt-1 text-sm opacity-60">Ask anything about your own money. It answers with your numbers.</p>

      {asked ? (
        <div className="relative mt-4 flex flex-col gap-3">
          <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-gradient-to-r from-teal-500 to-indigo-500 px-4 py-2.5 text-sm text-white">{asked}</p>
          {loading ? (
            <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-black/[0.04] px-4 py-3 dark:bg-white/[0.06]" role="status" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 animate-bounce rounded-full bg-current opacity-50" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          ) : answer && verdict ? (
            <div className="coach-in max-w-[92%] rounded-2xl rounded-bl-md bg-black/[0.04] px-4 py-3 dark:bg-white/[0.06]">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${verdict.style}`}>
                <verdict.icon size={13} aria-hidden /> {verdict.label}
              </span>
              <p className="mt-2 text-sm leading-relaxed">{answer.answer}</p>
            </div>
          ) : error ? (
            <p className="text-sm opacity-70">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-left text-sm transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-indigo-500/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="relative mt-4 flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="Can I afford a $120 dinner on Friday?"
          aria-label="Your question"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/15 dark:border-white/10 dark:bg-white/5"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 2}
          aria-label="Ask"
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-40"
        >
          <ArrowUp size={20} aria-hidden />
        </button>
      </form>
    </section>
  );
}
