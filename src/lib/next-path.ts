/** Where to go after signing in: a path on this site from `?next=`, otherwise the app. */
export function nextPath(): string {
  if (typeof window === "undefined") return "/app";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/app";
}
