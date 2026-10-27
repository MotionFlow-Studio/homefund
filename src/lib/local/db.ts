import Dexie, { type EntityTable } from "dexie";
import type {
  Expense,
  FixedCost,
  Household,
  Member,
  PaySettings,
  ReceiptItem,
} from "@/lib/model";

/** Tables that are synced with the server. */
export const SYNCED_TABLES = [
  "households",
  "members",
  "paySettings",
  "fixedCosts",
  "expenses",
  "receiptItems",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type SyncedRecord = {
  households: Household;
  members: Member;
  paySettings: PaySettings;
  fixedCosts: FixedCost;
  expenses: Expense;
  receiptItems: ReceiptItem;
};

/** A local change waiting to be sent to the server. One entry per record. */
export type OutboxEntry = {
  key: string;
  table: SyncedTable;
  recordId: string;
  queuedAt: string;
};

export type MetaEntry = { key: string; value: string };

export class HomeFundDb extends Dexie {
  households!: EntityTable<Household, "id">;
  members!: EntityTable<Member, "id">;
  paySettings!: EntityTable<PaySettings, "memberId">;
  fixedCosts!: EntityTable<FixedCost, "id">;
  expenses!: EntityTable<Expense, "id">;
  receiptItems!: EntityTable<ReceiptItem, "id">;
  outbox!: EntityTable<OutboxEntry, "key">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name = "homefund") {
    super(name);
    this.version(1).stores({
      households: "id, updatedAt",
      members: "id, householdId, userId, updatedAt",
      paySettings: "memberId, updatedAt",
      fixedCosts: "id, memberId, updatedAt",
      expenses: "id, householdId, memberId, spentOn, [householdId+spentOn], updatedAt",
      receiptItems: "id, expenseId, updatedAt",
      outbox: "key, table, queuedAt",
      meta: "key",
    });
  }
}

let instance: HomeFundDb | null = null;

/** The device database. Only available in the browser. */
export function localDb(): HomeFundDb {
  if (typeof indexedDB === "undefined") {
    throw new Error("Local storage is only available in the browser");
  }
  instance ??= new HomeFundDb();
  return instance;
}

/** Replaces the database instance; used by tests. */
export function setLocalDb(db: HomeFundDb | null) {
  instance = db;
}

/** Primary key of a record in its table. */
export function recordKey<T extends SyncedTable>(table: T, record: SyncedRecord[T]): string {
  return table === "paySettings"
    ? (record as PaySettings).memberId
    : (record as { id: string }).id;
}
