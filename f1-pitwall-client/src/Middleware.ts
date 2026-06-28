import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/oauth2"];
const STATIC_PREFIXES = ["/_next/", "/favicon.ico", "/public/"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false; // home is protected
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static assets + public paths through without auth
  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Lightweight auth gate: check for pitwall_session cookie
  const hasSession = request.cookies.get("pitwall_session")?.value === "1";

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
