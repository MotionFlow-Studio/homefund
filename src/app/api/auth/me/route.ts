import { errorResponse, json } from "@/server/http";
import { createSupabase } from "@/server/supabase";

/** Errors that mean the account or its session no longer exists, not just an expired login. */
const GONE = new Set(["user_not_found", "session_not_found", "refresh_token_not_found"]);

export async function GET() {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    // Tells other devices of a deleted account to remove its data.
    return errorResponse(401, error?.code && GONE.has(error.code) ? "account_gone" : "unauthorized");
  }
  const name = data.user.user_metadata?.name;
  return json({ user: { id: data.user.id, email: data.user.email, name: typeof name === "string" ? name : "" } });
}
