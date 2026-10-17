import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function requireUser(): Promise<NextResponse | null> {
  const jar = await cookies();
  const signedIn = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (signedIn) return null;
  return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}
