import type { Metadata } from "next";
import { OverviewScreen } from "./overview-screen";

export const metadata: Metadata = {
  title: "Family overview",
  robots: { index: false, follow: false },
};

export default function OverviewPage() {
  return <OverviewScreen />;
}
