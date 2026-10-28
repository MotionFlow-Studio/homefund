import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  /** The publishable (anon) key. Only used on the server; never sent to the browser. */
  get supabasePublishableKey() {
    return required("SUPABASE_PUBLISHABLE_KEY");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  /** Meta Model API key. Only read on the server; null when receipt reading is not set up. */
  get metaApiKey(): string | null {
    return process.env.META_API_KEY || null;
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
