import type { Metadata } from "next";
import { DemoStart } from "./demo-start";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "Try HomeFund with a ready-made family. No sign-up needed.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return <DemoStart />;
}
