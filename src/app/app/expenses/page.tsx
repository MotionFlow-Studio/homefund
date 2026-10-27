import type { Metadata } from "next";
import { ExpensesScreen } from "./expenses-screen";

export const metadata: Metadata = {
  title: "Expenses",
  robots: { index: false, follow: false },
};

export default function ExpensesPage() {
  return <ExpensesScreen />;
}
