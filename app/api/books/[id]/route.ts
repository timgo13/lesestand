import { NextResponse } from "next/server";
import { createReadUrl, deleteBook, getBook } from "@/lib/books";
import { publicError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
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
    const readUrl = await createReadUrl(book.pathname);
    return NextResponse.json(
      { readUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Buch konnte nicht geladen werden") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await requireUser();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });

  try {
    const removed = await deleteBook(id);
    if (!removed) return NextResponse.json({ error: "Buch nicht gefunden" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Löschen fehlgeschlagen") }, { status: 500 });
  }
}
