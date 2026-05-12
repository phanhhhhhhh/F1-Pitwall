import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }


    const sessionCookie = request.cookies.get("pitwall_session")?.value;

    if (!sessionCookie) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};