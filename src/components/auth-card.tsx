import { ArrowRight, Camera, Mic, Sparkles, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/*
 * The frame of the sign-in, sign-up, invite and demo screens: a colorful
 * showcase of the app beside the form on wide screens, and the form in a
 * glass card under the brand on phones.
 */

const HIGHLIGHTS = [
  { icon: Camera, text: "Scan a receipt, every line sorted" },
  { icon: Mic, text: "Say what you spent, it is booked" },
  { icon: Sparkles, text: "A money coach that knows your numbers" },
  { icon: Users, text: "One budget for the whole family" },
];

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  demo = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** Offers the demo family under the form. */
  demo?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-1">
      <Showcase />
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-10 lg:px-10">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-300/40 via-cyan-300/30 to-indigo-400/30 blur-3xl lg:hidden" />
        <div className="relative w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 text-xl font-semibold tracking-tight lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={36} height={36} className="rounded-[10px] shadow-lg shadow-teal-600/30" />
            HomeFund
          </Link>
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
            {subtitle ? <p className="mt-2 leading-relaxed opacity-70">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <p className="mt-6 text-center text-sm opacity-80">{footer}</p> : null}
          {demo ? (
            <Link
              href="/demo"
              className="group mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 p-4 ring-1 ring-indigo-500/20 transition hover:ring-indigo-500/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
                <Sparkles size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Just looking around?</span>
                <span className="block text-sm opacity-70">Open a ready-made demo family. No sign-up.</span>
              </span>
              <ArrowRight size={18} aria-hidden className="shrink-0 text-indigo-600 transition group-hover:translate-x-0.5 dark:text-indigo-300" />
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Showcase() {
  return (
    <aside className="landing relative hidden w-[46%] max-w-[44rem] shrink-0 flex-col overflow-hidden bg-[#06201e] px-12 py-10 text-white lg:flex">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(900px_600px_at_0%_0%,rgba(45,212,191,0.45),transparent_60%),radial-gradient(700px_600px_at_100%_30%,rgba(99,102,241,0.45),transparent_60%),radial-gradient(700px_500px_at_40%_110%,rgba(217,70,239,0.35),transparent_60%)]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

      <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={34} height={34} className="rounded-[10px]" />
        HomeFund
      </Link>

      <div className="relative mt-14">
        <h2 className="text-4xl leading-[1.05] font-bold tracking-tight xl:text-5xl">
          Know what&apos;s left.
          <br />
          <span className="bg-gradient-to-r from-teal-200 via-cyan-200 to-fuchsia-200 bg-clip-text text-transparent">Every single day.</span>
        </h2>
        <ul className="mt-8 grid gap-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/80">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon size={16} aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-auto flex justify-center pt-10">
        <div className="float relative w-[250px] rotate-[-4deg] overflow-hidden rounded-[2.4rem] border-[7px] border-neutral-900 bg-neutral-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] xl:w-[280px]">
          <Image src="/landing/home.webp" alt="" width={780} height={1688} className="block h-auto w-full" priority />
        </div>
        <div className="float-slow absolute top-28 left-2 rounded-2xl bg-white/95 px-4 py-3 text-neutral-900 shadow-2xl xl:left-8">
          <p className="text-xs font-medium opacity-60">Left until payday</p>
          <p className="text-xl font-bold tabular-nums">$2,748.04</p>
        </div>
        <div className="float absolute top-64 right-2 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold shadow-2xl [animation-delay:-3s] xl:right-8">
          <Sparkles size={16} aria-hidden /> On track for payday
        </div>
      </div>
    </aside>
  );
}
