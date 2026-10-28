import Link from "next/link";
import type { ReactNode } from "react";

/* Building blocks of the landing page. Server components only: the page ships no JavaScript of its own. */

/** An app screenshot in a phone frame. Screenshots are 390 x 844 points at 2x. */
export function Phone({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`h-fit self-start rounded-[2.9rem] bg-neutral-950 p-[0.6rem] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.75)] ring-1 ring-white/15 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={390}
        height={844}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="h-auto w-full rounded-[2.35rem]"
      />
    </div>
  );
}

/** A small rounded label on the glass background. */
export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-sm font-medium text-white/85 backdrop-blur ${className}`}
    >
      {children}
    </span>
  );
}

/** A floating glass note next to a screenshot. */
export function Callout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute z-10 rounded-2xl border border-white/15 bg-neutral-950/70 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`reveal max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="text-sm font-semibold tracking-[0.18em] text-teal-300 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-4xl leading-[1.05] font-bold tracking-tight text-balance text-white sm:text-5xl">{title}</h2>
      {children ? <p className="mt-5 text-lg leading-relaxed text-pretty text-white/65">{children}</p> : null}
    </div>
  );
}

/** A tile of the feature grid. */
export function Tile({
  icon,
  title,
  children,
  className = "",
  visual,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  visual?: ReactNode;
}) {
  return (
    <div
      className={`reveal group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 transition hover:border-white/20 ${className}`}
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 leading-relaxed text-white/60">{children}</p>
      {visual}
    </div>
  );
}

export function PrimaryButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-teal-300 to-teal-500 px-7 text-base font-semibold text-neutral-950 shadow-[0_10px_40px_-8px_rgba(45,212,191,0.6)] transition hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      {children}
    </Link>
  );
}

export function GhostButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-7 text-base font-semibold text-white backdrop-blur transition hover:bg-white/[0.09] active:scale-[0.98] ${className}`}
    >
      {children}
    </Link>
  );
}
