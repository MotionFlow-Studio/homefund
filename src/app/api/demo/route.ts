import { createDemoAccount, removeExpiredDemoAccounts } from "@/server/demo";
import { errorResponse, isSameOrigin, json } from "@/server/http";
import { createRateLimiter } from "@/server/rate-limit";
import { createSupabase } from "@/server/supabase";

const HOUR = 60 * 60 * 1000;
const perAddress = createRateLimiter({ limit: 6, windowMs: HOUR });
const overall = createRateLimiter({ limit: 120, windowMs: HOUR });

/** Creates a fresh demo family and signs the visitor in to it. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (perAddress.retryAfter(address) > 0 || overall.retryAfter("all") > 0) {
    return errorResponse(429, "too_many_requests");
  }
  perAddress.hit(address);
  overall.hit("all");

  await removeExpiredDemoAccounts().catch(() => undefined);
  const login = await createDemoAccount();

  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(login);
  if (error || !data.user) return errorResponse(500, "unknown");

  return json({ user: { id: data.user.id, email: login.email, name: "Emma Walker" } });
}
