import { errorResponse, json } from "@/server/http";
import { getSessionUser } from "@/server/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "unauthorized");
  return json({ user });
}
