import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberScreen } from "./member-screen";
import { LoadingScreen } from "@/components/loading";

export const metadata: Metadata = {
  title: "Family member",
  robots: { index: false, follow: false },
};

export default function MemberPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MemberScreen />
    </Suspense>
  );
}
