import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold">HomeFund</h1>
      <p className="max-w-md text-lg opacity-80">
        See what is left until payday and how much you can spend per day.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">
          Get started
        </Link>
        <Link href="/signin" className="inline-flex h-12 items-center rounded-xl border border-black/15 px-5 font-semibold dark:border-white/15">
          Sign in
        </Link>
      </div>
    </main>
  );
}
