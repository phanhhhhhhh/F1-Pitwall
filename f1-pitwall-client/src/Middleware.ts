import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/oauth2"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};