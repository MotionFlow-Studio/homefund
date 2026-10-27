import { signInSchema } from "@/lib/auth-schema";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { createSupabase } from "@/server/supabase";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const input = await readJson(request, signInSchema);
  if (!input) return errorResponse(400, "invalid_input");

  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error || !data.user) {
    if (error?.status === 429) return errorResponse(429, "too_many_requests");
    if (error?.code === "email_not_confirmed") return errorResponse(403, "email_not_confirmed");
    return errorResponse(401, "invalid_credentials");
  }

  const name = data.user.user_metadata?.name;
  return json({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: typeof name === "string" ? name : "",
    },
  });
}
