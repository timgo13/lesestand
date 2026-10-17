"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { apiFetch, readError } from "@/lib/client-api";
import { formatBytes, formatWhen } from "@/lib/format";
import type { PublicBook } from "@/lib/types";

function isHtmlFile(file: File): boolean {
  return /\.html?$/i.test(file.name) || file.type === "text/html" || file.type === "application/xhtml+xml";
}

export function Library() {
  const router = useRouter();
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/books");
    const data = (await response.json().catch(() => ({}))) as { books?: PublicBook[]; error?: string };
    if (!response.ok) throw new Error(readError(data, "Bibliothek konnte nicht geladen werden"));
    setBooks(data.books ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Bibliothek konnte nicht geladen werden");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function logout() {
    await apiFetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function uploadFiles(files: File[]) {
    const htmlFiles = files.filter(isHtmlFile);
    if (htmlFiles.length === 0) {
      setError("Nur HTML-Dateien.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const file of htmlFiles) {
        setStatus(`Wird hochgeladen: ${file.name}`);
        const pathname = `incoming/${crypto.randomUUID()}.html`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/books/upload",
          contentType: "text/html",
          multipart: file.size > 4 * 1024 * 1024,
        });
        setStatus(`Wird bereinigt: ${file.name}`);
        const response = await apiFetch("/api/books/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            filename: file.name,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(readError(data, "Hochladen fehlgeschlagen"));
      }
      setStatus(null);
      await load();
    } catch (uploadError) {
      setStatus(null);
      setError(uploadError instanceof Error ? uploadError.message : "Hochladen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function remove(book: PublicBook) {
    if (!window.confirm(`„${book.title}“ und den gespeicherten Lesestand löschen?`)) return;
    setError(null);
    const response = await apiFetch(`/api/books/${book.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(readError(data, "Löschen fehlgeschlagen"));
      return;
    }
    setBooks((current) => current.filter((item) => item.id !== book.id));
  }

  return (
    <>
      <header>
        <h1>Lesestand</h1>
        <p>HTML-Romane hochladen. Handy und PC bleiben an derselben Textstelle.</p>
      </header>
      <nav>
        <button type="button" onClick={() => void logout()}>
          Abmelden
        </button>
      </nav>

      <aside
        className={dragging ? "dropzone dragging" : "dropzone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          void uploadFiles([...event.dataTransfer.files]);
        }}
      >
        <label className="file-button">
          Datei wählen
          <input
            className="hidden-input"
            type="file"
            accept=".html,.htm,text/html"
            multiple
            disabled={busy}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length > 0) void uploadFiles(files);
            }}
          />
        </label>
        <p>oder HTML-Dateien hierher ziehen</p>
      </aside>

      {status ? <p>{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p>Bibliothek wird geladen…</p> : null}
      {!loading && books.length === 0 && !error ? (
        <p>Noch keine Romane. Lade eine HTML-Datei hoch.</p>
      ) : null}

      <ul className="book-list">
        {books.map((book) => (
          <li className="book" key={book.id}>
            <h2>
              <Link className="book-link" href={`/read/${book.id}`}>
                {book.title}
              </Link>
            </h2>
            <p>
              {book.filename}
              {book.size ? ` · ${formatBytes(book.size)}` : ""}
              {book.progress ? ` · ${formatWhen(book.progress.updatedAt)}` : ""}
            </p>
            <p>
              {book.progress?.snippet.trim()
                ? `Zuletzt: „${book.progress.snippet.trim()}“`
                : "Noch nicht begonnen"}
            </p>
            <button className="danger" type="button" onClick={() => void remove(book)}>
              Löschen
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
