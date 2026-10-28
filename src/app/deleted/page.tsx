import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your data is deleted",
  robots: { index: false },
};

export default function DeletedPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={40} height={40} className="mx-auto mb-6" />
        <h1 className="text-2xl font-semibold">Your data is deleted</h1>
        <p className="mt-3 opacity-75">
          Your account and everything in it are gone from our server and from this device. Thank you for using HomeFund.
        </p>
        <Link href="/" className="mt-8 inline-block font-semibold text-brand">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
