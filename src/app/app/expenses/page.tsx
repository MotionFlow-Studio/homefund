import type { Metadata } from "next";
import { ExpensesScreen } from "./expenses-screen";

export const metadata: Metadata = {
  title: "Transactions",
  robots: { index: false, follow: false },
};

export default function ExpensesPage() {
  return <ExpensesScreen />;
}
