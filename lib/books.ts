import "server-only";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { decodeHtmlBytes } from "@/lib/decode-html";
import { getRedis } from "@/lib/redis";
import { cleanFilename, prepareNovel } from "@/lib/sanitize";
import type { Book, NovelContent, Progress, ProgressInput, PublicBook } from "@/lib/types";

const BOOKS_KEY = "books";
const MAX_HTML_BYTES = 40 * 1024 * 1024;
const READ_URL_MS = 10 * 60 * 1000;

function isBook(value: unknown): value is Book {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<Book>;
  return (
    typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.filename === "string" &&
    typeof book.size === "number" &&
    typeof book.createdAt === "number" &&
    typeof book.pathname === "string" &&
    typeof book.url === "string"
  );
}

export function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Partial<Progress>;
  return (
    typeof progress.charOffset === "number" &&
    typeof progress.snippet === "string" &&
    typeof progress.updatedAt === "number"
  );
}

function toPublic(book: Book, progress: Progress | null): PublicBook {
  return {
    id: book.id,
    title: book.title,
    filename: book.filename,
    size: book.size,
    createdAt: book.createdAt,
    progress,
  };
}

function assertBlobConfigured() {
  if (!process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN fehlt");
  }
}

function assertSourceUrl(url: string, pathname: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Ungültige Dateiadresse");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".private.blob.vercel-storage.com")) {
    throw new Error("Ungültige Dateiadresse");
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  if (path !== pathname) throw new Error("Dateiadresse passt nicht zum Speicherpfad");
}

async function readBooks(): Promise<Book[]> {
  const value = await getRedis().get<unknown>(BOOKS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(isBook);
}

async function writeBooks(books: Book[]): Promise<void> {
  await getRedis().set(BOOKS_KEY, books);
}

async function readBlobBytes(url: string): Promise<Uint8Array> {
  const result = await get(url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Hochgeladene Datei wurde nicht gefunden");
  }
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  if (bytes.byteLength > MAX_HTML_BYTES) throw new Error("Datei ist zu groß");
  return bytes;
}

export async function listBooksWithProgress(): Promise<PublicBook[]> {
  const books = await readBooks();
  if (books.length === 0) return [];
  const pipeline = getRedis().pipeline();
  for (const book of books) pipeline.get(`progress:${book.id}`);
  const stored = await pipeline.exec();
  const items = books.map((book, index) => ({
    book,
    progress: isProgress(stored[index]) ? stored[index] : null,
  }));
  items.sort(
    (a, b) => (b.progress?.updatedAt ?? b.book.createdAt) - (a.progress?.updatedAt ?? a.book.createdAt),
  );
  return items.map(({ book, progress }) => toPublic(book, progress));
}

export async function getBook(id: string): Promise<Book | null> {
  const books = await readBooks();
  return books.find((book) => book.id === id) ?? null;
}

export async function createReadUrl(pathname: string): Promise<string> {
  assertBlobConfigured();
  const validUntil = Date.now() + READ_URL_MS;
  const issued = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const signed = await presignUrl(
    {
      clientSigningToken: issued.clientSigningToken,
      delegationToken: issued.delegationToken,
    },
    {
      operation: "get",
      pathname,
      access: "private",
      validUntil,
      useCache: false,
    },
  );
  return signed.presignedUrl;
}

export async function ingestUpload(sourceUrl: string, sourcePathname: string, filename: string): Promise<PublicBook> {
  assertBlobConfigured();
  assertSourceUrl(sourceUrl, sourcePathname);
  const bytes = await readBlobBytes(sourceUrl);
  const novel = prepareNovel(decodeHtmlBytes(bytes), filename);
  const id = crypto.randomUUID();
  const pathname = `books/${id}.json`;
  const created = await put(pathname, JSON.stringify({ styles: novel.styles, body: novel.body } satisfies NovelContent), {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: false,
  });

  const book: Book = {
    id,
    title: novel.title,
    filename: cleanFilename(filename),
    size: bytes.byteLength,
    createdAt: Date.now(),
    pathname: created.pathname || pathname,
    url: created.url,
  };

  try {
    const books = await readBooks();
    books.unshift(book);
    await writeBooks(books);
  } catch (error) {
    await del(created.url).catch((deleteError) => {
      console.error("Buchdatei konnte nicht zurückgerollt werden", deleteError);
    });
    throw error;
  }

  await del(sourceUrl).catch((error) => {
    console.error("Temporäre Datei konnte nicht gelöscht werden", error);
  });

  return toPublic(book, null);
}

export async function deleteBook(id: string): Promise<boolean> {
  const books = await readBooks();
  const book = books.find((item) => item.id === id);
  if (!book) return false;
  assertBlobConfigured();
  await del(book.url).catch((error) => {
    console.error("Buchdatei konnte nicht gelöscht werden", error);
  });
  await writeBooks(books.filter((item) => item.id !== id));
  await getRedis().del(`progress:${id}`);
  return true;
}

export async function getProgress(id: string): Promise<Progress | null> {
  const value = await getRedis().get<unknown>(`progress:${id}`);
  return isProgress(value) ? value : null;
}

export async function saveProgress(id: string, input: ProgressInput): Promise<Progress> {
  const progress: Progress = { ...input, updatedAt: Date.now() };
  await getRedis().set(`progress:${id}`, progress);
  return progress;
}
