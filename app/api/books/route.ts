import { NextResponse } from "next/server";
import { listBooksWithProgress } from "@/lib/books";
import { publicError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  try {
    const books = await listBooksWithProgress();
    return NextResponse.json({ books }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: publicError(error, "Bibliothek konnte nicht geladen werden") },
      { status: 500 },
    );
  }
}
