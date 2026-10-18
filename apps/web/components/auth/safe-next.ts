/**
 * Where to send someone after login. Only in-app paths are allowed, so a
 * crafted `?next=https://evil.example` or `?next=//evil.example` can't turn
 * the login page into an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/app";
  if (/[\\\s]/.test(next) || next.includes("//")) return "/app";
  if (next === "/app" || next.startsWith("/app/") || next.startsWith("/app?") || next.startsWith("/app#")) return next;
  return "/app";
}
