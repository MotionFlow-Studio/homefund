import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/server/env";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

/** One shared connection pool. prepare: false is required by the Supabase pooler. */
const sql = (globalForDb.sql ??= postgres(env.databaseUrl, {
  max: 5,
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 15,
}));

export const db = drizzle(sql, { schema });
export type Db = typeof db;
