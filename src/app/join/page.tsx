import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen } from "./join-screen";

export const metadata: Metadata = {
  title: "Join a household",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>}>
      <JoinScreen />
    </Suspense>
  );
}
