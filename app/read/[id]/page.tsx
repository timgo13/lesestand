import { notFound } from "next/navigation";
import { Reader } from "@/components/Reader";
import { getBook } from "@/lib/books";
import { publicError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let book: Awaited<ReturnType<typeof getBook>>;
  try {
    book = await getBook(id);
  } catch (error) {
    const message = publicError(error, "Das Buch konnte nicht geladen werden");
    return (
      <main>
        <header>
          <h1>Lesestand</h1>
        </header>
        <p>{message}</p>
      </main>
    );
  }

  if (!book) notFound();
  return <Reader bookId={book.id} title={book.title} />;
}
