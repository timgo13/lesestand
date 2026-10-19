"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, readError } from "@/lib/client-api";
import { captureAnchor, indexText, readingTop, scrollToOffset, type TextIndex } from "@/lib/dom-position";
import { resolveOffset } from "@/lib/position";
import { READER_GUARD_CSS } from "@/lib/reader-guard";
import type { Progress } from "@/lib/types";

type Status = { kind: "idle" | "ok" | "error"; text: string };

function isPrivateBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function Reader({ bookId, title }: { bookId: string; title: string }) {
  const articleRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const indexRef = useRef<TextIndex | null>(null);

  const [content, setContent] = useState<{ styles: string; body: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `${title} · Lesestand`;
  }, [title]);

  // Die Höhe der Leiste bestimmt, wo der Text beginnt und welche Zeile als "aktuelle Stelle" gilt.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const applyHeight = () => {
      document.documentElement.style.setProperty("--bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Buch laden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/api/books/${bookId}`);
        const data = (await response.json().catch(() => ({}))) as { readUrl?: string; error?: string };
        if (!response.ok || !data.readUrl || !isPrivateBlobUrl(data.readUrl)) {
          throw new Error(readError(data, "Buch konnte nicht geladen werden"));
        }
        const fileResponse = await fetch(data.readUrl, { cache: "no-store" });
        if (!fileResponse.ok) throw new Error("Buchdatei konnte nicht geladen werden");
        const novel = (await fileResponse.json()) as { styles?: unknown; body?: unknown };
        if (cancelled) return;
        if (typeof novel.body !== "string" || typeof novel.styles !== "string") {
          throw new Error("Buchdatei ist beschädigt");
        }
        setContent({ styles: novel.styles, body: novel.body });
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Buch konnte nicht geladen werden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Gespeicherte Stelle laden und dorthin scrollen.
  useEffect(() => {
    const root = articleRef.current;
    if (!content || !root) return;
    const index = indexText(root);
    indexRef.current = index;
    let cancelled = false;
    let restoring = true;
    let target: Progress | null = null;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    const jump = () => {
      if (cancelled || !restoring || !target) return;
      scrollToOffset(index, resolveOffset(index.text, target.charOffset, target.snippet), readingTop());
    };
    // Bilder und Schriften verschieben den Text nachträglich. Nachkorrigieren, bis der Nutzer selbst scrollt.
    const stopRestoring = () => {
      restoring = false;
    };
    const interactions = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const name of interactions) window.addEventListener(name, stopRestoring, { passive: true, once: true });
    const images = [...root.querySelectorAll("img")].filter((image) => !image.complete);
    for (const image of images) image.addEventListener("load", jump);
    void document.fonts?.ready.then(jump);

    (async () => {
      try {
        const response = await apiFetch(`/api/progress/${bookId}`);
        const data = (await response.json().catch(() => ({}))) as { progress?: Progress | null; error?: string };
        if (!response.ok) throw new Error(readError(data, "Lesestand konnte nicht geladen werden"));
        if (cancelled || !data.progress) return;
        target = data.progress;
        jump();
        window.requestAnimationFrame(jump);
      } catch (error) {
        if (cancelled) return;
        setStatus({ kind: "error", text: error instanceof Error ? error.message : "Lesestand konnte nicht geladen werden" });
      }
    })();

    return () => {
      cancelled = true;
      for (const name of interactions) window.removeEventListener(name, stopRestoring);
      for (const image of images) image.removeEventListener("load", jump);
    };
  }, [bookId, content]);

  async function savePosition() {
    const root = articleRef.current;
    const index = indexRef.current;
    if (!root || !index || index.text.length === 0) {
      setStatus({ kind: "error", text: "Diese Datei enthält keinen Text." });
      return;
    }
    const anchor = captureAnchor(root, index, readingTop());
    if (!anchor) {
      setStatus({ kind: "error", text: "Die Textstelle konnte nicht erkannt werden." });
      return;
    }

    setSaving(true);
    setStatus({ kind: "idle", text: "Speichert…" });
    try {
      const response = await apiFetch(`/api/progress/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anchor),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(readError(data, "Speichern fehlgeschlagen"));
      setStatus({ kind: "ok", text: "Gespeichert" });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Speichern fehlgeschlagen" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <nav className="topbar" ref={barRef}>
        {/* Bewusst ein normaler Link: der Seitenwechsel entfernt die fremden Styles des Buches vollständig. */}
        <a href="/" className="topbar-back" aria-label="Zur Bibliothek">
          ← <span>Bibliothek</span>
        </a>
        <span className="topbar-title">{title}</span>
        <button type="button" className="primary" onClick={() => void savePosition()} disabled={!content || saving}>
          Stelle speichern
        </button>
        {status.text ? (
          <span className={`topbar-status ${status.kind}`} role="status">
            {status.text}
          </span>
        ) : null}
      </nav>

      {content ? <style>{content.styles}</style> : null}
      <style>{READER_GUARD_CSS}</style>
      {content ? (
        <article ref={articleRef} className="novel" dangerouslySetInnerHTML={{ __html: content.body }} />
      ) : (
        <p className="novel novel-loading">{loadError ?? "Wird geladen…"}</p>
      )}
    </>
  );
}
