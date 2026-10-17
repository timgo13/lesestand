import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { publicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 200) {
    return NextResponse.json({ error: "Zugangscode fehlt" }, { status: 400 });
  }

  try {
    const matches = await passwordMatches(body.password);
    if (!matches) {
      return NextResponse.json({ error: "Zugangscode ist falsch" }, { status: 401 });
    }
    const token = await createSessionToken();
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Anmeldung fehlgeschlagen") }, { status: 500 });
  }
}
