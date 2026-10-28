import { z } from "zod";
import { DELETE_CONFIRMATION } from "@/lib/account";
import { deleteAccount } from "@/server/account";
import { errorResponse, isSameOrigin, json, readJson } from "@/server/http";
import { createSupabase, getSessionUser } from "@/server/supabase";

const body = z.object({ confirm: z.literal(DELETE_CONFIRMATION) });

/** Permanently deletes the signed-in user's account and data. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden");
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  if (!(await readJson(request, body))) return errorResponse(400, "not_confirmed");

  const summary = await deleteAccount(user.id);
  // The account is gone; drop the session cookies on this device as well.
  const supabase = await createSupabase();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return json({ status: "deleted", ...summary });
}
