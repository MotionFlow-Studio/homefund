import {
  localDb,
  recordKey,
  type SyncedRecord,
  type SyncedTable,
} from "@/lib/local/db";
import type { Expense, Household, Member, ReceiptItem } from "@/lib/model";

/*
 * All writes go through here. Each write updates the record on the device
 * straight away (so the app works offline) and queues it for sync.
 */

export const CHANGED_EVENT = "homefund:changed";

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

type Draft<T> = Omit<T, "createdAt" | "updatedAt" | "deletedAt"> &
  Partial<Pick<T & { createdAt: string }, "createdAt">>;

/** Creates or updates a record and queues it for sync. */
export async function saveRecord<T extends SyncedTable>(
  table: T,
  draft: Draft<SyncedRecord[T]>,
): Promise<SyncedRecord[T]> {
  const db = localDb();
  const timestamp = now();

  const saved = await db.transaction("rw", [db.table(table), db.outbox], async () => {
    const id = recordKey(table, draft as SyncedRecord[T]);
    const existing = (await db.table(table).get(id)) as SyncedRecord[T] | undefined;
    const record = {
      ...draft,
      createdAt: existing?.createdAt ?? draft.createdAt ?? timestamp,
      updatedAt: timestamp,
      ...(table === "paySettings" ? {} : { deletedAt: null }),
    } as SyncedRecord[T];

    await db.table(table).put(record);
    await db.outbox.put({ key: `${table}:${id}`, table, recordId: id, queuedAt: timestamp });
    return record;
  });
  notifyChanged();
  return saved;
}

/** Marks a record as deleted so the deletion reaches every device. */
export async function deleteRecord(
  table: Exclude<SyncedTable, "paySettings">,
  id: string,
): Promise<void> {
  const db = localDb();
  const timestamp = now();

  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    const existing = await db.table(table).get(id);
    if (!existing) return;
    await db.table(table).put({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
    await db.outbox.put({ key: `${table}:${id}`, table, recordId: id, queuedAt: timestamp });
  });
  notifyChanged();
}

/* Convenience helpers for the main records. */

export function saveHousehold(draft: Draft<Household>) {
  return saveRecord("households", draft);
}

export function saveMember(draft: Draft<Member>) {
  return saveRecord("members", draft);
}

export function saveExpense(draft: Draft<Expense>) {
  return saveRecord("expenses", draft);
}

export function saveReceiptItem(draft: Draft<ReceiptItem>) {
  return saveRecord("receiptItems", draft);
}

export function deleteExpense(id: string) {
  return deleteRecord("expenses", id);
}

/** Live expenses of a household between two dates (inclusive), newest first. */
export async function listExpenses(
  householdId: string,
  from: string,
  to: string,
): Promise<Expense[]> {
  const rows = await localDb()
    .expenses.where("[householdId+spentOn]")
    .between([householdId, from], [householdId, to], true, true)
    .toArray();
  return rows
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
}

/** Number of local changes not yet sent to the server. */
export function pendingChanges(): Promise<number> {
  return localDb().outbox.count();
}
