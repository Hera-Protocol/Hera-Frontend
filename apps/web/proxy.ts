import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge check: no session cookie means no dashboard. The API still
 * validates the session on every request; this only saves a round trip.
 */
const SESSION_COOKIE = process.env.HERA_SESSION_COOKIE ?? "hera_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/app") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/login", "/signup"] };
