import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen } from "./join-screen";
import { LoadingScreen } from "@/components/loading";

export const metadata: Metadata = {
  title: "Join a household",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <JoinScreen />
    </Suspense>
  );
}
