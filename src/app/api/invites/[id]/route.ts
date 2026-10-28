import { z } from "zod";
import { errorResponse, isSameOrigin, json } from "@/server/http";
import { InviteError, revokeInvite } from "@/server/invites";
import { getSessionUser } from "@/server/supabase";

/** Revokes a code so it can no longer be used. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/invites/[id]">) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return errorResponse(404, "not_found");
  try {
    return (await revokeInvite(user.id, id)) ? json({ revoked: true }) : errorResponse(404, "not_found");
  } catch (error) {
    if (error instanceof InviteError) return errorResponse(403, error.code);
    throw error;
  }
}
