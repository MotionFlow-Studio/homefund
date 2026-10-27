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
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
