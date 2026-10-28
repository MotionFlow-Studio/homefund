import type { Metadata } from "next";
import { ScanScreen } from "./scan-screen";

export const metadata: Metadata = {
  title: "Scan a receipt",
  robots: { index: false, follow: false },
};

export default function ScanPage() {
  return <ScanScreen />;
}
