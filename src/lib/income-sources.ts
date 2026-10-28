import { Briefcase, Gift, HandCoins, Landmark, RotateCcw, Sparkles, Tag, type LucideIcon } from "lucide-react";
import type { IncomeSource } from "@/lib/model";

/** Labels, icons and colors for money received on top of the pay. */
export const INCOME_SOURCE_LIST: { id: IncomeSource; label: string; icon: LucideIcon; color: string }[] = [
  { id: "bonus", label: "Bonus", icon: Sparkles, color: "#16a34a" },
  { id: "side_job", label: "Side job", icon: Briefcase, color: "#0d9488" },
  { id: "refund", label: "Refund", icon: RotateCcw, color: "#0891b2" },
  { id: "gift", label: "Gift", icon: Gift, color: "#db2777" },
  { id: "sale", label: "Sold something", icon: Tag, color: "#ca8a04" },
  { id: "benefit", label: "Benefit", icon: Landmark, color: "#7c3aed" },
  { id: "other", label: "Other", icon: HandCoins, color: "#475569" },
];

export function getIncomeSource(id: IncomeSource) {
  return INCOME_SOURCE_LIST.find((s) => s.id === id) ?? INCOME_SOURCE_LIST.at(-1)!;
}
