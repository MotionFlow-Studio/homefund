import type { Metadata } from "next";
import { HouseholdScreen } from "./household-screen";

export const metadata: Metadata = {
  title: "Family",
  robots: { index: false, follow: false },
};

export default function HouseholdPage() {
  return <HouseholdScreen />;
}
