import type { Metadata } from "next";
import { AppHome } from "./app-home";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <AppHome />;
}
