import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberScreen } from "./member-screen";

export const metadata: Metadata = {
  title: "Family member",
  robots: { index: false, follow: false },
};

export default function MemberPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center opacity-60">Loading…</main>}>
      <MemberScreen />
    </Suspense>
  );
}
