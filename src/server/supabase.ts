import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/server/env";

/**
 * Supabase client bound to the current request. The session lives in
 * HttpOnly, Secure, SameSite cookies that page scripts cannot read, and it is
 * refreshed automatically when the access token expires.
 */
export async function createSupabase() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: {
      name: env.isProduction ? "__Host-hf-auth" : "hf-auth",
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, {
            ...options,
            httpOnly: true,
            secure: env.isProduction,
            sameSite: "lax",
            path: "/",
          });
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string; name: string };

/** The signed-in user, verified with Supabase Auth, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return null;
  }
  const name = data.user.user_metadata?.name;
  return {
    id: data.user.id,
    email: data.user.email,
    name: typeof name === "string" ? name : "",
  };
}
