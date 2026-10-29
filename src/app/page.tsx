import {
  ArrowDownLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  CloudOff,
  Code2,
  Coins,
  EyeOff,
  KeyRound,
  Lock,
  MapPinOff,
  Mic,
  ScanLine,
  Smartphone,
  Sparkles,
  TrendingUp,
  Trash2,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout, GhostButton, Phone, Pill, PrimaryButton, SectionHeading, Tile } from "@/components/landing";

export const metadata: Metadata = {
  title: { absolute: "HomeFund — Know what's left, every day" },
  description:
    "A family budget app that tells you what you can spend today. Payday countdown, receipts read line by line by Meta's SAM 3.1 and Muse Spark 1.3, one household for the whole family. Works offline, every currency.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "HomeFund — Know what's left, every day",
    description: "Payday countdown, receipt scanning and a shared family budget. On every phone, even offline.",
    url: "/",
    siteName: "HomeFund",
    type: "website",
    images: [{ url: "/screenshots/home.jpg", width: 1170, height: 2532, alt: "HomeFund home screen" }],
  },
};

const NAV = [
  ["Features", "#features"],
  ["How it works", "#how"],
  ["Family", "#family"],
  ["Privacy", "#privacy"],
] as const;

const FAQ = [
  [
    "What does HomeFund cost?",
    "Nothing. Create an account, set your payday and start. There is no app store and no subscription.",
  ],
  [
    "How does receipt scanning work?",
    "Take a photo in the app. Meta's SAM 3.1 finds the receipt and cuts it out of the background, then Muse Spark 1.3 reads the shop, the date and every line, and puts each line in a category. HomeFund checks that the lines add up to the printed total before you save.",
  ],
  [
    "What happens to my receipt photos?",
    "They are never stored. The photo is shrunk and stripped of its location and camera data on your phone, read in memory on our server and thrown away. Only the shop, date, amounts and categories are kept.",
  ],
  [
    "Can my partner see my income?",
    "No. Everyone in the household sees what is left and what was spent, not anyone's income or fixed costs.",
  ],
  [
    "Does it work without internet?",
    "Yes. Everything is saved on your phone first, so you can add expenses anywhere. It syncs with the family the moment you are back online.",
  ],
  [
    "Which currencies are supported?",
    "All of them: dollars, euros, pounds, forints, yen and every other ISO currency, written the way you write it.",
  ],
  [
    "Can I delete my data?",
    "Any time, in Settings. One button removes your account and everything in it, from our server and from your phone.",
  ],
] as const;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HomeFund",
  applicationCategory: "FinanceApplication",
  operatingSystem: "iOS, Android, Web",
  description: "A family budget app that tells you what you can spend today, with receipt scanning by Meta SAM 3.1 and Muse Spark 1.3.",
  url: "https://homefund.motionflowstudio.com",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: "MotionFlow Studio" },
};

export default function Landing() {
  return (
    <div className="landing relative isolate flex-1 overflow-x-clip bg-[#04100f] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Background light */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px] overflow-hidden">
        <div className="glow absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-teal-500/25 blur-[140px]" />
        <div className="glow absolute top-64 -right-40 h-[420px] w-[520px] rounded-full bg-amber-400/10 blur-[120px] [animation-delay:-6s]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#04100f]/70 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={32} height={32} className="rounded-[9px]" />
            <span className="text-lg">HomeFund</span>
          </Link>
          <div className="hidden flex-1 items-center justify-center gap-8 text-sm text-white/65 md:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/signin" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/demo"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-teal-100"
            >
              Try the demo
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="hero-in">
            <Pill>
              <Sparkles size={15} className="text-amber-300" aria-hidden />
              Powered by Meta SAM 3.1, Muse Spark 1.3 and Muse Voice Transcribe
            </Pill>
            <h1 className="mt-7 text-5xl leading-[0.98] font-bold tracking-[-0.035em] text-balance sm:text-7xl">
              Know what&apos;s left.{" "}
              <span className="bg-gradient-to-r from-teal-200 via-teal-300 to-amber-200 bg-clip-text text-transparent">
                Every single day.
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-pretty text-white/65 sm:text-xl">
              HomeFund turns your payday, your bills and every receipt into one number: what you can spend today. For you and
              the whole family, on every phone, even offline.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/demo">
                Try the demo, no sign-up <ArrowRight size={18} aria-hidden />
              </PrimaryButton>
              <GhostButton href="/signup">Create a free account</GhostButton>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
              {["Installs like an app on iPhone and Android", "Works offline", "Every currency"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check size={16} className="text-teal-300" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto h-[600px] w-full max-w-[460px] sm:h-[680px]">
            <Phone
              src="/landing/review.webp"
              alt="A receipt read line by line, every item in a category"
              className="float-slow absolute top-14 right-0 hidden w-[230px] rotate-[7deg] opacity-80 sm:block"
            />
            <Phone
              src="/landing/home.webp"
              alt="HomeFund home screen: $2,965.19 left until payday, $228.09 a day"
              className="float absolute top-0 left-1/2 w-[280px] -translate-x-1/2 sm:left-6 sm:translate-x-0"
              priority
            />
            <Callout className="float-delay top-[330px] -left-2 sm:-left-10">
              <span className="block text-xs font-medium text-white/55">You can spend today</span>
              <span className="text-xl">$228.09</span>
            </Callout>
            <Callout className="float-slow right-2 bottom-24 hidden items-center gap-2 sm:-right-4 sm:flex">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400 text-neutral-950">
                <Check size={14} strokeWidth={3} aria-hidden />
              </span>
              Receipt total matches
            </Callout>
          </div>
        </section>

        {/* The problem */}
        <section aria-labelledby="problem-title" className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="reveal grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-amber-300 uppercase">The 28th of the month</p>
                <h2 id="problem-title" className="mt-3 text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
                  Your bank shows what&apos;s gone. HomeFund shows what&apos;s left.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-white/65">
                  Rent is paid, the kids need shoes, the receipts pile up, and payday is still two weeks away. HomeFund takes
                  your income, fixed costs and savings goal once, then answers the only question that matters at the till.
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  ["Left until payday", "$2,965", "after rent and savings"],
                  ["Per day", "$228", "updates with every expense"],
                  ["Payday in", "13 days", "Tuesday, Nov 10"],
                ].map(([label, value, note]) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                    <dt className="text-xs text-white/55 sm:text-sm">{label}</dt>
                    <dd className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{value}</dd>
                    <dd className="mt-1 text-xs text-white/45 sm:text-sm">{note}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
          <SectionHeading eyebrow="Features" title="Everything a family budget needs. Nothing it doesn't." center>
            Built for the moment you stand at the checkout and wonder if it&apos;s fine.
          </SectionHeading>
          <div className="mt-16 grid gap-4 md:grid-cols-6">
            <Tile
              icon={<CalendarClock size={22} />}
              title="Payday countdown"
              className="md:col-span-3 md:row-span-2"
              visual={
                <div className="mt-8 -mb-40 flex justify-center">
                  <Phone src="/landing/home.webp" alt="" className="w-[250px] transition duration-500 group-hover:-translate-y-2" />
                </div>
              }
            >
              What&apos;s left until payday, what you can spend per day and how many days to go. Add a coffee and today&apos;s
              number adjusts instantly. Warnings come before the money runs out, not after.
            </Tile>
            <Tile
              icon={<ScanLine size={22} />}
              title="Snap a receipt"
              className="md:col-span-3"
              visual={
                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    ["Groceries", "bg-green-500"],
                    ["Household", "bg-cyan-500"],
                    ["Kids", "bg-pink-500"],
                    ["Health", "bg-red-500"],
                  ].map(([label, color]) => (
                    <span key={label} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-sm text-white/75">
                      <span className={`size-2 rounded-full ${color}`} aria-hidden /> {label}
                    </span>
                  ))}
                </div>
              }
            >
              Every line read, sorted into categories and checked against the printed total. Discounts and bottle deposits
              land in the right place.
            </Tile>
            <Tile
              icon={<Sparkles size={22} />}
              title="A money coach that knows your numbers"
              className="md:col-span-3"
              visual={
                <div className="mt-5 rounded-2xl bg-white/[0.05] p-4 text-sm">
                  <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-gradient-to-r from-teal-500 to-indigo-500 px-3 py-2 text-white">Can I spend $300 on a weekend trip?</p>
                  <p className="mt-2 w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-white/85">
                    <span className="mr-1.5 rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">Fits</span>
                    You&apos;d have $5,107.50 left, about $392.88 a day until payday.
                  </p>
                </div>
              }
            >
              Muse Spark 1.3 reads your pay period and writes three insights a day. Ask it anything about your own money.
            </Tile>
            <Tile icon={<Mic size={22} />} title="Just say it" className="md:col-span-3">
              &ldquo;Groceries at FreshMart, 42 dollars.&rdquo; Muse Voice Transcribe writes it down and the expense is filled in
              for you to confirm.
            </Tile>
            <Tile icon={<TrendingUp size={22} />} title="Payday forecast" className="md:col-span-3">
              See where today&apos;s pace leads: what will be left on payday, or the day the money runs out, while there is
              still time to change it.
            </Tile>
            <Tile icon={<ArrowDownLeft size={22} />} title="Money in, too" className="md:col-span-3">
              Bonuses, side jobs, refunds and gifts add to what you can spend until payday, instantly.
            </Tile>
            <Tile icon={<Users size={22} />} title="One household" className="md:col-span-3">
              Invite your partner with a one-time code. Everyone keeps their own payday and daily number; the family overview
              shows the whole picture.
            </Tile>
            <Tile icon={<CloudOff size={22} />} title="Works offline" className="md:col-span-2">
              Add expenses with no signal. They sync with the family the moment you&apos;re back.
            </Tile>
            <Tile
              icon={<Coins size={22} />}
              title="Every currency"
              className="md:col-span-2"
              visual={
                <p className="mt-5 font-mono text-sm leading-7 text-teal-200/80">
                  $1,234.56 · 1 234,56 € · £1,234.56
                  <br />
                  12 345 Ft · ¥1,235 · 1 234,56 zł
                </p>
              }
            >
              Written the way you write it.
            </Tile>
            <Tile icon={<Smartphone size={22} />} title="On every phone and computer" className="md:col-span-2">
              Installs from the browser on iPhone and Android in seconds. No app store, no updates to wait for.
            </Tile>
          </div>
        </section>

        {/* How receipt scanning works */}
        <section id="how" className="relative scroll-mt-20 overflow-hidden border-y border-white/[0.06] bg-gradient-to-b from-teal-950/40 to-transparent">
          <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
            <SectionHeading eyebrow="How it works" title="From a crumpled receipt to clean categories in seconds.">
              Two Meta models do the reading. HomeFund does the checking, so you only confirm.
            </SectionHeading>
            <div className="mt-16 grid items-start gap-14 lg:grid-cols-[1fr_1.1fr]">
              <ol className="space-y-4">
                {[
                  [<Camera key="i" size={20} />, "Snap", "Take a photo right in the app. It's turned upright, shrunk and stripped of location data on your phone."],
                  [<ScanLine key="i" size={20} />, "SAM 3.1 finds the receipt", "Meta's segmentation model spots the receipt in the picture and cuts it out of the background, even when it's small or crooked."],
                  [<Sparkles key="i" size={20} />, "Muse Spark 1.3 reads every line", "Shop, date, items, quantities, discounts and the total, each line in one of ten categories. Blurry photos are flagged instead of guessed."],
                  [<Check key="i" size={20} />, "You check and save", "HomeFund checks that the lines add up to the printed total and reads again if they don't. Fix anything, pick who paid, save."],
                ].map(([icon, title, text], index) => (
                  <li key={String(title)} className="reveal flex gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-teal-300 to-teal-500 text-neutral-950" aria-hidden>
                      {icon}
                    </span>
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">Step {index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                      <p className="mt-1.5 leading-relaxed text-white/60">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="relative mx-auto flex w-full max-w-[520px] justify-center gap-5 lg:sticky lg:top-28">
                <Phone src="/landing/reading.webp" alt="The app reading a receipt" className="mt-16 w-[46%] -rotate-3" />
                <Phone src="/landing/review.webp" alt="The receipt read line by line, total checked" className="w-[50%] rotate-2" />
                <Callout className="-bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
                  <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-neutral-950">7 of 7 lines</span>
                  $34.52, matches the receipt
                </Callout>
              </div>
            </div>
          </div>
        </section>

        {/* Family */}
        <section id="family" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="relative order-2 mx-auto flex w-full max-w-[520px] justify-center gap-4 lg:order-1">
              <Phone src="/landing/overview.webp" alt="Family overview: what's left for everyone and who is on track" className="w-[48%]" />
              <Phone src="/landing/james.webp" alt="James's phone with his own payday and numbers" className="mt-20 w-[48%]" />
              <Callout className="top-6 -right-6 hidden sm:block">
                <span className="block text-xs font-medium text-white/55">Emma saved a receipt</span>
                On James&apos;s phone in seconds
              </Callout>
            </div>
            <div className="order-1 lg:order-2">
              <SectionHeading eyebrow="Family" title="One budget for the family. Everyone's own numbers.">
                Money is a family thing. HomeFund gives everyone their own payday and daily amount, and one shared view of
                where the money goes.
              </SectionHeading>
              <ul className="reveal mt-8 space-y-4">
                {[
                  ["Invite with a one-time code", "Codes work once, expire in 48 hours and can be revoked."],
                  ["Who paid is one tap", "Every expense and receipt belongs to someone, so each budget stays right."],
                  ["Incomes stay private", "The family sees what's left and what was spent, never anyone's salary."],
                ].map(([title, text]) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-300" aria-hidden>
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="text-white/60">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="scroll-mt-20 px-4 pb-28 sm:px-6">
          <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-neutral-900 to-[#06201d] p-8 sm:p-14">
            <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-teal-400/10 blur-3xl" />
            <SectionHeading eyebrow="Privacy" title="Your money is your business. We built it that way.">
              Privacy isn&apos;t a setting in HomeFund. It&apos;s how the app works.
            </SectionHeading>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [<EyeOff key="i" size={20} />, "Receipt photos are never stored", "Read in memory on our server and thrown away. Only the shop, date, amounts and categories are kept."],
                [<MapPinOff key="i" size={20} />, "No location in your photos", "Your phone strips GPS, camera and time data before anything is uploaded."],
                [<Lock key="i" size={20} />, "Only your household sees your data", "Every record is checked against household membership on the server. Nothing is public."],
                [<KeyRound key="i" size={20} />, "Keys stay on the server", "Your phone never holds an API key. Sessions live in secure, HttpOnly cookies."],
                [<CloudOff key="i" size={20} />, "Your phone comes first", "Data is stored on your device and synced, so it's yours even without a connection."],
                [<Trash2 key="i" size={20} />, "Delete everything, any time", "One button removes your account and data from our server and from your phone."],
              ].map(([icon, title, text]) => (
                <div key={String(title)} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200" aria-hidden>
                    {icon}
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Install */}
        <section aria-labelledby="install-title" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div className="reveal">
              <p className="text-sm font-semibold tracking-[0.18em] text-teal-300 uppercase">Install</p>
              <h2 id="install-title" className="mt-3 text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
                On your home screen in ten seconds.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/65">
                HomeFund installs straight from the browser, opens full screen like any app and keeps working offline.
              </p>
            </div>
            <div className="reveal grid gap-4 sm:grid-cols-2">
              {[
                ["iPhone", "Open HomeFund in Safari, tap Share, then Add to Home Screen."],
                ["Android", "Open HomeFund in Chrome, tap the menu, then Install app."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <Smartphone size={22} className="text-teal-300" aria-hidden />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
          <h2 id="faq-title" className="reveal text-center text-4xl font-bold tracking-tight sm:text-5xl">
            Questions, answered
          </h2>
          <div className="mt-12 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02]">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-semibold">
                  {question}
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-white/60">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-teal-400 via-teal-600 to-teal-900 px-8 py-16 text-center sm:py-24">
            <div aria-hidden className="absolute -top-40 left-1/2 h-80 w-[800px] -translate-x-1/2 rounded-full bg-white/25 blur-3xl" />
            <h2 className="relative mx-auto max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
              Start knowing what&apos;s left.
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/85">
              Set your payday once. HomeFund does the counting, every day.
            </p>
            <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-8 font-semibold text-neutral-950 shadow-xl transition hover:bg-teal-50 active:scale-[0.98]"
              >
                Create your free account <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/40 px-8 font-semibold transition hover:bg-white/10"
              >
                Try the demo family
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={24} height={24} className="rounded-[7px]" />
            <span>© 2026 MotionFlow Studio</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/signin" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/demo" className="hover:text-white">
              Demo
            </Link>
            <Link href="/signup" className="hover:text-white">
              Create account
            </Link>
            <a href="#privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="https://github.com/MotionFlow-Studio/homefund" className="inline-flex items-center gap-1.5 hover:text-white">
              <Code2 size={14} aria-hidden /> Source code
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
