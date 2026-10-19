import { NextResponse } from "next/server";
import { getBook, getProgress, saveProgress } from "@/lib/books";
import { publicError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { parseProgress } from "@/lib/progress";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const denied = await requireUser();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });

  try {
    const book = await getBook(id);
    if (!book) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });
    const progress = await getProgress(id);
    return NextResponse.json({ progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Lesestand konnte nicht geladen werden") }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Context) {
  const denied = await requireUser();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const progress = parseProgress(body);
  if (!progress) return NextResponse.json({ error: "Ungültiger Lesestand" }, { status: 400 });

  try {
    const book = await getBook(id);
    if (!book) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });
    const saved = await saveProgress(id, progress);
    return NextResponse.json({ progress: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Lesestand konnte nicht gespeichert werden") }, { status: 500 });
  }
}
