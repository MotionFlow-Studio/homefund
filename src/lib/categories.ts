import {
  Baby,
  Bus,
  CircleEllipsis,
  HeartPulse,
  House,
  PartyPopper,
  ReceiptText,
  Shirt,
  ShoppingCart,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * The single source of truth for expense categories.
 * The order here is the order shown in the app.
 */
export const CATEGORY_IDS = [
  "groceries",
  "household",
  "eating_out",
  "transport",
  "kids",
  "health",
  "clothing",
  "fun",
  "bills",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type Category = {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  /** Accent color, readable on both light and dark backgrounds. */
  color: string;
  /** Short hint used when sorting receipt line items into categories. */
  hint: string;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  groceries: {
    id: "groceries",
    label: "Groceries",
    icon: ShoppingCart,
    color: "#16a34a",
    hint: "Food and drinks bought in shops and supermarkets",
  },
  household: {
    id: "household",
    label: "Household",
    icon: House,
    color: "#0891b2",
    hint: "Cleaning supplies, toiletries, home goods, repairs",
  },
  eating_out: {
    id: "eating_out",
    label: "Eating out",
    icon: UtensilsCrossed,
    color: "#ea580c",
    hint: "Restaurants, cafes, takeaway, food delivery",
  },
  transport: {
    id: "transport",
    label: "Transport",
    icon: Bus,
    color: "#2563eb",
    hint: "Fuel, public transport, taxis, parking, tolls",
  },
  kids: {
    id: "kids",
    label: "Kids",
    icon: Baby,
    color: "#db2777",
    hint: "Toys, school supplies, children's activities and care",
  },
  health: {
    id: "health",
    label: "Health",
    icon: HeartPulse,
    color: "#dc2626",
    hint: "Pharmacy, medicine, doctor visits",
  },
  clothing: {
    id: "clothing",
    label: "Clothing",
    icon: Shirt,
    color: "#7c3aed",
    hint: "Clothes, shoes, accessories",
  },
  fun: {
    id: "fun",
    label: "Fun",
    icon: PartyPopper,
    color: "#ca8a04",
    hint: "Entertainment, hobbies, games, cinema, trips",
  },
  bills: {
    id: "bills",
    label: "Bills",
    icon: ReceiptText,
    color: "#475569",
    hint: "Utilities, phone, internet, subscriptions, insurance",
  },
  other: {
    id: "other",
    label: "Other",
    icon: CircleEllipsis,
    color: "#6b7280",
    hint: "Anything that does not fit another category",
  },
};

export const CATEGORY_LIST: Category[] = CATEGORY_IDS.map((id) => CATEGORIES[id]);

export function isCategoryId(value: unknown): value is CategoryId {
  return (
    typeof value === "string" &&
    (CATEGORY_IDS as readonly string[]).includes(value)
  );
}

/** Returns the category, falling back to "other" for unknown values. */
export function getCategory(value: unknown): Category {
  return isCategoryId(value) ? CATEGORIES[value] : CATEGORIES.other;
}
