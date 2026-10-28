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
/** `more` is set when the server had more changes than it sends at once. */
export type SyncResponse = { cursor: string; more?: boolean; changes: ChangeSet };

export type SyncTransport = (request: SyncRequest) => Promise<SyncResponse>;

export const CURSOR_KEY = "syncCursor";
/** Where the signed-in user is kept on the device (see auth-client). */
const USER_KEY = "currentUser";

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

  // Whose data this round is for. If they sign out or delete their account
  // while it runs, nothing that arrives afterwards may be written back.
  const user = (await db.meta.get(USER_KEY))?.value ?? null;

  let cursor = (await db.meta.get(CURSOR_KEY))?.value ?? null;
  let response = await transport({ cursor, changes });
  let pulled = await merge(response, outbox, user);

  // A device far behind (or new) gets the rest page by page.
  for (let page = 0; response.more && page < MAX_PAGES; page++) {
    cursor = response.cursor;
    response = await transport({ cursor, changes: {} });
    pulled += await merge(response, [], user);
  }

  return { pushed: outbox.length, pulled };
}

/** Most extra pages fetched in one round; the next round continues from there. */
const MAX_PAGES = 100;

/**
 * Applies one server answer: clears what was sent (unless it changed again
 * meanwhile), merges incoming records with last write wins, and moves the
 * cursor.
 */
async function merge(response: SyncResponse, sent: OutboxEntry[], user: string | null): Promise<number> {
  const db = localDb();
  let pulled = 0;
  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    if (((await db.meta.get(USER_KEY))?.value ?? null) !== user) return;
    for (const entry of sent) {
      const current: OutboxEntry | undefined = await db.outbox.get(entry.key);
      if (current && current.queuedAt === entry.queuedAt) {
        await db.outbox.delete(entry.key);
      }
    }

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
  return pulled;
}
