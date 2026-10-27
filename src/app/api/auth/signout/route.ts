import { errorResponse, isSameOrigin, json } from "@/server/http";
import { createSupabase } from "@/server/supabase";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const supabase = await createSupabase();
  await supabase.auth.signOut({ scope: "local" });
  return json({ status: "signed_out" });
}
