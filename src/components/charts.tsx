"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Small hand-drawn SVG charts. No chart library: they are a few paths each,
 * scale with their container and keep to the app's colors.
 */

/** Animates a number from 0 to its value once, unless reduced motion is preferred. */
export function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = instant ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

/**
 * Spending through the pay period: what was spent so far (solid), where the
 * current pace leads (dashed) and an even pace (faint line) up to the budget.
 */
export function PaceChart({
  cumulative,
  even,
  projectedEnd,
  budget,
  over,
}: {
  cumulative: number[];
  even: number[];
  projectedEnd: number;
  budget: number;
  over: boolean;
}) {
  const W = 320;
  const H = 140;
  const days = even.length;
  const top = Math.max(budget, projectedEnd, ...cumulative, 1) * 1.08;
  const x = (i: number) => (days <= 1 ? 0 : (i / (days - 1)) * W);
  const y = (v: number) => H - (v / top) * H;
  const last = cumulative.length - 1;
  const spentPath = cumulative.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${spentPath} L${x(last).toFixed(1)},${H} L0,${H} Z`;
  const evenPath = even.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const color = over ? "#f43f5e" : "#14b8a6";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible" role="img" aria-label="Spending through the pay period">
      <defs>
        <linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={y(budget)} y2={y(budget)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 4" />
      <path d={evenPath} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d={area} fill="url(#pace-fill)" />
      <path d={spentPath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {last < days - 1 ? (
        <path
          d={`M${x(last).toFixed(1)},${y(cumulative[last] ?? 0).toFixed(1)} L${W},${y(projectedEnd).toFixed(1)}`}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray="5 6"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={x(last)} cy={y(cumulative[last] ?? 0)} r="5" fill={color} stroke="white" strokeWidth="2.5" />
    </svg>
  );
}

/** Spending per day with the even daily amount as a line; days above it stand out. */
export function DailyBars({
  days,
  allowance,
  labels,
  money,
}: {
  days: { date: string; spentMinor: number }[];
  allowance: number;
  labels: (date: string) => string;
  money: (minor: number) => string;
}) {
  const W = 320;
  const H = 120;
  const top = Math.max(allowance * 1.4, ...days.map((d) => d.spentMinor), 1);
  const gap = 4;
  const bw = (W - gap * (days.length - 1)) / days.length;
  const y = (v: number) => H - (v / top) * H;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full overflow-visible" role="img" aria-label="Spending per day">
        <defs>
          <linearGradient id="bar-ok" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="bar-high" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fb7185" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {days.map((d, i) => {
          const h = Math.max(d.spentMinor > 0 ? 4 : 2, H - y(d.spentMinor));
          return (
            <rect
              key={d.date}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(6, bw / 2)}
              fill={d.spentMinor === 0 ? "currentColor" : d.spentMinor > allowance ? "url(#bar-high)" : "url(#bar-ok)"}
              fillOpacity={d.spentMinor === 0 ? 0.1 : 1}
            >
              <title>{`${labels(d.date)}: ${money(d.spentMinor)}`}</title>
            </rect>
          );
        })}
        {allowance > 0 ? (
          <line x1="0" x2={W} y1={y(allowance)} y2={y(allowance)} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="4 4" />
        ) : null}
      </svg>
      <div className="mt-2 flex justify-between text-[0.7rem] opacity-50">
        <span>{labels(days[0]?.date ?? "")}</span>
        <span>{labels(days.at(-1)?.date ?? "")}</span>
      </div>
    </div>
  );
}

/** A ring split by category, with the total in the middle. */
export function Donut({
  parts,
  center,
  caption,
}: {
  parts: { color: string; value: number; label: string }[];
  center: string;
  caption: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 140 140" className="size-40 -rotate-90" role="img" aria-label={`${caption}: ${center}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="16" />
        {total > 0
          ? parts.map((p) => {
              const len = (p.value / total) * C;
              const dash = `${Math.max(0, len - 3)} ${C}`;
              const el = (
                <circle
                  key={p.label}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg leading-tight font-bold tabular-nums">{center}</span>
        <span className="text-xs opacity-60">{caption}</span>
      </div>
    </div>
  );
}
