import { signUpSchema } from "@/lib/auth-schema";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { createSupabase } from "@/server/supabase";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const input = await readJson(request, signUpSchema);
  if (!input) return errorResponse(400, "invalid_input");

  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name },
      emailRedirectTo: `${new URL(request.url).origin}/signin`,
    },
  });

  if (error) {
    if (error.code === "weak_password") return errorResponse(400, "weak_password");
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return errorResponse(429, "too_many_requests");
    }
    // Same answer whether or not the email is already registered.
    return json({ status: "check_email" });
  }

  if (data.session && data.user) {
    return json({
      status: "signed_in",
      user: { id: data.user.id, email: data.user.email, name: input.name },
    });
  }
  return json({ status: "check_email" });
}
