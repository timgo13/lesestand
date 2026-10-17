import { NextResponse } from "next/server";
import { ingestUpload } from "@/lib/books";
import { publicError } from "@/lib/errors";
import { isIncomingPath } from "@/lib/ids";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  let body: { url?: unknown; pathname?: unknown; filename?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; pathname?: unknown; filename?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  if (typeof body.url !== "string" || typeof body.pathname !== "string" || typeof body.filename !== "string") {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  if (!isIncomingPath(body.pathname) || body.filename.length > 240) {
    return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
  }

  try {
    const book = await ingestUpload(body.url, body.pathname, body.filename);
    return NextResponse.json({ book });
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Hochladen fehlgeschlagen") }, { status: 500 });
  }
}
