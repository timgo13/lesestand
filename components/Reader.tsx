"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, readError } from "@/lib/client-api";
import { getDeviceId } from "@/lib/device";
import { captureAnchor, indexText, readingTop, scrollToOffset, selectFromOffset, type TextIndex } from "@/lib/dom-position";
import { resolveOffset } from "@/lib/position";
import { READER_GUARD_CSS } from "@/lib/reader-guard";
import type { Progress } from "@/lib/types";

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
  const appliedProgressRef = useRef<Progress | null>(null);
  const deviceIdRef = useRef("");

  const [content, setContent] = useState<{ styles: string; body: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncLabel, setSyncLabel] = useState("Wird geladen…");
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `${title} · Lesestand`;
  }, [title]);

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
  }, [hint, syncLabel, loadError, content]);

  function applyProgress(progress: Progress) {
    const index = indexRef.current;
    if (!index) return;
    const offset = resolveOffset(index.text, progress.charOffset, progress.snippet);
    scrollToOffset(index, offset, readingTop());
    appliedProgressRef.current = progress;
  }

  useEffect(() => {
    let cancelled = false;
    deviceIdRef.current = getDeviceId();
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
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Buch konnte nicht geladen werden");
          setSyncLabel("Nicht geladen");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    const root = articleRef.current;
    if (!content || !root) return;
    const index = indexText(root);
    indexRef.current = index;
    let cancelled = false;

    (async () => {
      try {
        const response = await apiFetch(`/api/progress/${bookId}`);
        const data = (await response.json().catch(() => ({}))) as { progress?: Progress | null; error?: string };
        if (!response.ok) throw new Error(readError(data, "Lesestand konnte nicht geladen werden"));
        if (cancelled) return;
        if (data.progress) {
          applyProgress(data.progress);
          setSyncLabel("Stand geladen");
        } else {
          setSyncLabel("Bereit");
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Lesestand konnte nicht geladen werden");
        setSyncLabel("Lesestand fehlt");
      }
    })();

    const images = [...root.querySelectorAll("img")];
    const onImageLoad = () => {
      if (cancelled) return;
      const progress = appliedProgressRef.current;
      if (progress) applyProgress(progress);
    };
    for (const image of images) {
      if (!image.complete) image.addEventListener("load", onImageLoad);
    }

    return () => {
      cancelled = true;
      for (const image of images) image.removeEventListener("load", onImageLoad);
    };
    // applyProgress only reads refs and scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, content]);

  function goHome(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = "/";
  }

  async function markFromHere() {
    const root = articleRef.current;
    const index = indexRef.current;
    if (!root || !index || index.text.length === 0) {
      setHint("Diese Datei enthält keinen Text.");
      return;
    }
    const anchor = captureAnchor(root, index, readingTop());
    if (!anchor) {
      setHint("Die Textstelle konnte nicht erkannt werden.");
      return;
    }
    const selected = selectFromOffset(index, anchor.charOffset);
    setHint(
      selected
        ? "Markiert. In Edge: Rechtsklick auf die Markierung, dann Auswahl vorlesen. Auf dem Handy: lange drücken, dann Auswahl vorlesen."
        : "An dieser Stelle gibt es keinen weiteren Text.",
    );

    const progress: Progress = {
      charOffset: anchor.charOffset,
      snippet: anchor.snippet,
      updatedAt: Date.now(),
      deviceId: deviceIdRef.current || getDeviceId(),
    };
    appliedProgressRef.current = progress;
    setSaving(true);
    setSyncLabel("Speichert…");
    try {
      const response = await fetch(`/api/progress/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progress),
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/read/${bookId}`)}`;
        return;
      }
      const data = (await response.json().catch(() => null)) as { saved?: boolean; error?: string } | null;
      if (!response.ok || !data?.saved) {
        setSyncLabel("Speichern fehlgeschlagen");
        return;
      }
      setSyncLabel("Gespeichert");
    } catch {
      setSyncLabel("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <nav className="topbar" ref={barRef}>
        <a href="/" onClick={(event) => goHome(event)}>
          Bibliothek
        </a>
        <span className="reader-title">{title}</span>
        <button type="button" onClick={() => void markFromHere()} disabled={!content || saving}>
          Ab hier markieren
        </button>
        <span className="sync-label" aria-live="polite">
          {syncLabel}
        </span>
        {hint ? <span className="hint">{hint}</span> : null}
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
