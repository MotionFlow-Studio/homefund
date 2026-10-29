import { Check } from "lucide-react";
import type { ReactNode } from "react";

/*
 * The frame of the first-run screens: which step this is, a bold header and
 * the form in a card. A side panel (a live preview) sits beside the form on
 * wide screens and under it on phones.
 */

const STEPS = ["Household", "Payday"] as const;

export function SetupFrame({
  step,
  icon,
  title,
  subtitle,
  children,
  aside,
}: {
  /** 1-based first-run step; leave out when the screen is opened later from Settings. */
  step?: 1 | 2;
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 lg:px-10 lg:pt-12 ${
        aside ? "max-w-md lg:max-w-5xl" : "max-w-md lg:max-w-xl"
      }`}
    >
      {step ? (
        <ol aria-label="Setup steps" className="mb-7 flex items-center gap-2 text-sm font-semibold">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden className={`h-px w-6 ${done || current ? "bg-teal-500" : "bg-black/15 dark:bg-white/15"}`} /> : null}
                <span
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 ${
                    current
                      ? "bg-gradient-to-r from-teal-500 to-indigo-500 text-white shadow-md shadow-indigo-500/25"
                      : done
                        ? "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                        : "bg-black/[0.04] opacity-60 dark:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs ${current ? "bg-white/25" : done ? "bg-teal-500 text-white" : "bg-black/10 dark:bg-white/10"}`}
                  >
                    {done ? <Check size={13} strokeWidth={3} aria-hidden /> : n}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <header className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/30"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1.5 leading-relaxed opacity-70">{subtitle}</p>
        </div>
      </header>

      <div className={`mt-7 grid gap-5 ${aside ? "lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8" : ""}`}>
        <div className="card p-5 sm:p-7">{children}</div>
        {aside ? <div className="lg:sticky lg:top-8">{aside}</div> : null}
      </div>
    </main>
  );
}
