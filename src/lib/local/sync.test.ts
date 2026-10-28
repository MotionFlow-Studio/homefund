import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeFundDb, setLocalDb, type SyncedRecord, type SyncedTable } from "@/lib/local/db";
import { deleteExpense, listExpenses, newId, pendingChanges, saveExpense } from "@/lib/local/store";
import { OfflineError, syncOnce, type ChangeSet, type SyncTransport } from "@/lib/local/sync";
import type { Expense } from "@/lib/model";

const householdId = "1b6f1f5e-3c1a-4d2e-9f7a-1a2b3c4d5e6f";
const memberId = "2b6f1f5e-3c1a-4d2e-9f7a-1a2b3c4d5e6f";

function expenseDraft(amountMinor: number, spentOn = "2026-10-27") {
  return {
    id: newId(),
    householdId,
    memberId,
    amountMinor,
    category: "groceries" as const,
    spentOn,
    merchant: null,
    note: null,
    source: "manual" as const,
    createdByUserId: null,
  };
}

/** A fake server that stores records with last-write-wins, like the real one. */
function fakeServer(pageSize = Infinity) {
  const store = new Map<string, { table: SyncedTable; record: { updatedAt: string }; seq: number }>();
  let seq = 0;
  const transport: SyncTransport = async ({ cursor, changes }) => {
    for (const [table, records] of Object.entries(changes) as [SyncedTable, SyncedRecord[SyncedTable][]][]) {
      for (const record of records) {
        const key = `${table}:${"id" in record ? record.id : record.memberId}`;
        const existing = store.get(key);
        if (!existing || existing.record.updatedAt <= record.updatedAt) {
          store.set(key, { table, record, seq: ++seq });
        }
      }
    }
    const since = Number(cursor ?? 0);
    const out: ChangeSet = {};
    const newer = [...store.values()].filter((entry) => entry.seq > since).sort((a, b) => a.seq - b.seq);
    const page = newer.slice(0, pageSize);
    for (const { table, record } of page) (out[table] ??= [] as never[]).push(record as never);
    const more = newer.length > page.length;
    return { cursor: String(more ? page[page.length - 1].seq : seq), more, changes: out };
  };
  return { transport, store };
}

const offline: SyncTransport = async () => {
  throw new OfflineError();
};

beforeEach(async () => {
  const db = new HomeFundDb(`test-${Math.random()}`);
  setLocalDb(db);
  await db.open();
});

describe("offline storage", () => {
  it("saves and lists expenses without any connection", async () => {
    await saveExpense(expenseDraft(4997));
    await saveExpense(expenseDraft(1250, "2026-10-26"));

    const list = await listExpenses(householdId, "2026-10-01", "2026-10-31");
    expect(list.map((e) => e.amountMinor)).toEqual([4997, 1250]);
    expect(list[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(list[0].updatedAt).toBeTruthy();
    expect(await pendingChanges()).toBe(2);
  });

  it("keeps changes queued while offline", async () => {
    await saveExpense(expenseDraft(4997));
    await expect(syncOnce(offline)).rejects.toBeInstanceOf(OfflineError);
    expect(await pendingChanges()).toBe(1);
  });

  it("hides deleted expenses but still syncs the deletion", async () => {
    const e = await saveExpense(expenseDraft(4997));
    await deleteExpense(e.id);
    expect(await listExpenses(householdId, "2026-10-01", "2026-10-31")).toEqual([]);
    expect(await pendingChanges()).toBe(1);
  });
});

describe("sync when back online", () => {
  it("pushes offline changes and clears the queue", async () => {
    const server = fakeServer();
    await saveExpense(expenseDraft(4997));
    await syncOnce(offline).catch(() => {});

    const result = await syncOnce(server.transport);
    expect(result.pushed).toBe(1);
    expect(server.store.size).toBe(1);
    expect(await pendingChanges()).toBe(0);
  });

  it("brings changes from another device to this one", async () => {
    const server = fakeServer();

    // Phone A adds an expense and syncs.
    const phoneA = new HomeFundDb(`a-${Math.random()}`);
    setLocalDb(phoneA);
    await saveExpense(expenseDraft(4997));
    await syncOnce(server.transport);

    // Phone B syncs and sees it.
    const phoneB = new HomeFundDb(`b-${Math.random()}`);
    setLocalDb(phoneB);
    await syncOnce(server.transport);
    const list = await listExpenses(householdId, "2026-10-01", "2026-10-31");
    expect(list.map((e) => e.amountMinor)).toEqual([4997]);
  });

  it("keeps the newest version when two devices edit the same expense", async () => {
    const server = fakeServer();
    const phoneA = new HomeFundDb(`a-${Math.random()}`);
    const phoneB = new HomeFundDb(`b-${Math.random()}`);

    setLocalDb(phoneA);
    const original = await saveExpense(expenseDraft(1000));
    await syncOnce(server.transport);

    setLocalDb(phoneB);
    await syncOnce(server.transport);

    // A edits first, B edits later while offline; B's later edit must win.
    setLocalDb(phoneA);
    await saveExpense({ ...original, amountMinor: 2000 });
    await new Promise((r) => setTimeout(r, 5));
    setLocalDb(phoneB);
    await saveExpense({ ...original, amountMinor: 3000 });

    setLocalDb(phoneA);
    await syncOnce(server.transport);
    setLocalDb(phoneB);
    await syncOnce(server.transport);
    setLocalDb(phoneA);
    await syncOnce(server.transport);

    for (const db of [phoneA, phoneB]) {
      const e = (await db.expenses.get(original.id)) as Expense;
      expect(e.amountMinor).toBe(3000);
    }
  });
});

describe("catching up", () => {
  it("fetches everything page by page when far behind", async () => {
    const server = fakeServer(4);
    // Another device saved 11 expenses.
    for (let i = 1; i <= 11; i++) {
      await saveExpense(expenseDraft(i * 100));
    }
    await syncOnce(server.transport);

    // A brand-new device catches up in one round, 4 records at a time.
    const fresh = new HomeFundDb(`test-${Math.random()}`);
    setLocalDb(fresh);
    await fresh.open();
    let calls = 0;
    const counting: SyncTransport = (request) => {
      calls++;
      return server.transport(request);
    };
    const result = await syncOnce(counting);
    expect(result.pulled).toBe(11);
    expect(calls).toBe(3);
    expect((await listExpenses(householdId, "2026-10-01", "2026-10-31")).length).toBe(11);
  });
});

describe("signing out during a sync", () => {
  it("does not write back what arrives after the device was cleared", async () => {
    const server = fakeServer();
    const other = new HomeFundDb(`other-${Math.random()}`);
    setLocalDb(other);
    await saveExpense(expenseDraft(4997));
    await syncOnce(server.transport);

    const phone = new HomeFundDb(`phone-${Math.random()}`);
    setLocalDb(phone);
    await phone.meta.put({ key: "currentUser", value: '{"id":"u1"}' });
    // The answer comes back after the user signed out and the phone was cleared.
    const slow: SyncTransport = async (request) => {
      const response = await server.transport(request);
      await phone.meta.clear();
      return response;
    };
    await syncOnce(slow);
    expect(await phone.expenses.count()).toBe(0);
    expect(await phone.meta.count()).toBe(0);
  });
});
