import { z } from "zod";
import { SYNCED_TABLES } from "@/lib/local/db";
import type { ChangeSet } from "@/lib/local/sync";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { getSessionUser } from "@/server/supabase";
import { syncForUser } from "@/server/sync";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RECORDS_PER_TABLE = 2_000;

const requestSchema = z.object({
  cursor: z.string().max(20).nullable(),
  changes: z.object(
    Object.fromEntries(
      SYNCED_TABLES.map((table) => [table, z.array(z.unknown()).max(MAX_RECORDS_PER_TABLE).optional()]),
    ),
  ),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");

  const body = await readJson(request, requestSchema, MAX_BODY_BYTES);
  if (!body) return errorResponse(400, "invalid_input");

  const result = await syncForUser(user.id, body.cursor, body.changes as ChangeSet);
  return json(result);
}
