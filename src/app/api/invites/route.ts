import { errorResponse, isSameOrigin, json } from "@/server/http";
import { createInvite, InviteError, listInvites } from "@/server/invites";
import { createRateLimiter } from "@/server/rate-limit";
import { getSessionUser } from "@/server/supabase";

const creating = createRateLimiter({ limit: 20, windowMs: 24 * 60 * 60 * 1000 });

/** Open invite codes of the owner's household (without the codes themselves). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  try {
    return json({ invites: await listInvites(user.id) });
  } catch (error) {
    if (error instanceof InviteError) return errorResponse(403, error.code);
    throw error;
  }
}

/** Creates a new code. It is shown once; only its hash is stored. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  if (creating.retryAfter(user.id) > 0) return errorResponse(429, "rate_limited");
  try {
    const invite = await createInvite(user.id);
    creating.hit(user.id);
    return json(invite, 201);
  } catch (error) {
    if (error instanceof InviteError) return errorResponse(error.code === "too_many" ? 409 : 403, error.code);
    throw error;
  }
}
