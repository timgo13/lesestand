import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { safeNextPath } from "@/lib/paths";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = await verifySessionToken(token);

  if (pathname === "/login") {
    if (!signedIn) return NextResponse.next();
    const destination = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (pathname === "/api/login") return NextResponse.next();

  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
