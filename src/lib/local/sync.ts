import {
  localDb,
  recordKey,
  SYNCED_TABLES,
  type OutboxEntry,
  type SyncedRecord,
  type SyncedTable,
} from "@/lib/local/db";

/*
 * Two-way sync between the device and the server.
 *
 * 1. Push: every record in the outbox is sent to the server.
 * 2. Pull: the server returns every record changed since our last cursor.
 * 3. Merge: last write wins, decided by updatedAt. A record with a local
 *    change still waiting in the outbox is never overwritten by an older one.
 */

export type ChangeSet = { [T in SyncedTable]?: SyncedRecord[T][] };

export type SyncRequest = { cursor: string | null; changes: ChangeSet };
export type SyncResponse = { cursor: string; changes: ChangeSet };

export type SyncTransport = (request: SyncRequest) => Promise<SyncResponse>;

export const CURSOR_KEY = "syncCursor";

export class OfflineError extends Error {
  constructor() {
    super("No connection");
  }
}

/** Sends a sync request to the HomeFund server. */
export const httpTransport: SyncTransport = async (request) => {
  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(request),
    });
  } catch {
    throw new OfflineError();
  }
  if (!response.ok) {
    throw new Error(`Sync failed with status ${response.status}`);
  }
  return (await response.json()) as SyncResponse;
};

export type SyncResult = { pushed: number; pulled: number };

/** Runs one full sync round. Safe to call at any time. */
export async function syncOnce(transport: SyncTransport = httpTransport): Promise<SyncResult> {
  const db = localDb();

  // Collect pending local changes.
  const outbox = await db.outbox.toArray();
  const changes: ChangeSet = {};
  for (const entry of outbox) {
    const record = await db.table(entry.table).get(entry.recordId);
    if (!record) continue;
    (changes[entry.table] ??= [] as never[]).push(record as never);
  }

  const cursor = (await db.meta.get(CURSOR_KEY))?.value ?? null;
  const response = await transport({ cursor, changes });

  let pulled = 0;
  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    // Clear outbox entries that were sent and not changed again since.
    for (const sent of outbox) {
      const current: OutboxEntry | undefined = await db.outbox.get(sent.key);
      if (current && current.queuedAt === sent.queuedAt) {
        await db.outbox.delete(sent.key);
      }
    }

    // Merge server changes, last write wins.
    for (const table of SYNCED_TABLES) {
      for (const incoming of response.changes[table] ?? []) {
        const id = recordKey(table, incoming as SyncedRecord[typeof table]);
        const local = (await db.table(table).get(id)) as { updatedAt: string } | undefined;
        if (local && local.updatedAt > incoming.updatedAt) {
          continue;
        }
        await db.table(table).put(incoming);
        pulled++;
      }
    }

    await db.meta.put({ key: CURSOR_KEY, value: response.cursor });
  });

  return { pushed: outbox.length, pulled };
}
