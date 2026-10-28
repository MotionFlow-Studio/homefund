import { z } from "zod";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { InviteError, joinWithCode } from "@/server/invites";
import { createRateLimiter } from "@/server/rate-limit";
import { getSessionUser } from "@/server/supabase";

const HOUR = 60 * 60 * 1000;
/** Guessing codes is hopeless anyway; these limits make it pointless too. */
const perUser = createRateLimiter({ limit: 10, windowMs: HOUR });
const perAddress = createRateLimiter({ limit: 30, windowMs: HOUR });

const bodySchema = z.object({
  code: z.string().max(20),
  name: z.string().trim().min(1).max(60),
});

/** Joins the household of an invite code as an adult member. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (perUser.retryAfter(user.id) > 0 || perAddress.retryAfter(address) > 0) {
    return errorResponse(429, "rate_limited");
  }

  const body = await readJson(request, bodySchema);
  if (!body) return errorResponse(400, "invalid_input");

  perUser.hit(user.id);
  perAddress.hit(address);
  try {
    return json(await joinWithCode(user.id, body.code, body.name));
  } catch (error) {
    if (error instanceof InviteError) {
      return errorResponse(error.code === "already_in_household" ? 409 : 400, error.code);
    }
    throw error;
  }
}
