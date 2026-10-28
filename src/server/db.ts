import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/server/env";

function connect() {
  /** One shared connection pool. prepare: false is required by the Supabase pooler. */
  const sql = postgres(env.databaseUrl, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof connect>;

const globalForDb = globalThis as unknown as { db?: Db };

/**
 * The database, connected on first use rather than when the module loads,
 * so the app builds without any secrets and reads them only at run time.
 */
export const db = new Proxy({} as Db, {
  get(_, property) {
    const instance = (globalForDb.db ??= connect());
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
