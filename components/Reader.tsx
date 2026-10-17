"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, readError } from "@/lib/client-api";
import { getDeviceId } from "@/lib/device";
import {
  captureAnchor,
  indexText,
  readingTop,
  scrollToOffset,
  selectFromOffset,
  type TextIndex,
} from "@/lib/dom-position";
import { resolveOffset } from "@/lib/position";
import { READER_GUARD_CSS } from "@/lib/reader-guard";
import type { Progress } from "@/lib/types";

const ACTIVE_MS = 8000;

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
  const readyRef = useRef(false);
  const applyingRef = useRef(false);
  const userMovedRef = useRef(false);
  const lastScrollAtRef = useRef(0);
  const ignoreScrollUntilRef = useRef(0);
  const lastSavedOffsetRef = useRef(-1);
  const lastSentUpdatedAtRef = useRef(0);
  const appliedUpdatedAtRef = useRef(0);
  const appliedOffsetRef = useRef<number | null>(null);
  const appliedProgressRef = useRef<Progress | null>(null);
  const pendingRef = useRef<Progress | null>(null);
  const deviceIdRef = useRef("");
  const saveRef = useRef<(options?: { keepalive?: boolean }) => Promise<void>>(async () => {});
  const considerRemoteRef = useRef<(progress: Progress) => boolean>(() => false);

  const [content, setContent] = useState<{ styles: string; body: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState<Progress | null>(null);
  const [syncLabel, setSyncLabel] = useState("Wird geladen…");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${title} · Lesestand`;
  }, [title]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  function applyProgress(progress: Progress) {
    const index = indexRef.current;
    if (!index) return;
    const offset = resolveOffset(index.text, progress.charOffset, progress.snippet);
    applyingRef.current = true;
    ignoreScrollUntilRef.current = Date.now() + 800;
    scrollToOffset(index, offset, readingTop());
    appliedOffsetRef.current = offset;
    lastSavedOffsetRef.current = offset;
    appliedUpdatedAtRef.current = Math.max(appliedUpdatedAtRef.current, progress.updatedAt);
    appliedProgressRef.current = progress;
    pendingRef.current = null;
    setPending(null);
    window.setTimeout(() => {
      applyingRef.current = false;
    }, 450);
  }

  considerRemoteRef.current = (progress: Progress) => {
    if (progress.deviceId === deviceIdRef.current && progress.updatedAt <= lastSentUpdatedAtRef.current) return false;
    if (progress.updatedAt <= appliedUpdatedAtRef.current) return false;
    const active = userMovedRef.current && Date.now() - lastScrollAtRef.current < ACTIVE_MS;
    if (active) {
      pendingRef.current = progress;
      setPending(progress);
      return true;
    }
    applyProgress(progress);
    setSyncLabel("Stand übernommen");
    return true;
  };

  saveRef.current = async (options) => {
    if (!readyRef.current || applyingRef.current || pendingRef.current) return;
    const root = articleRef.current;
    const index = indexRef.current;
    if (!root || !index || !deviceIdRef.current) return;
    const anchor = captureAnchor(root, index, readingTop());
    if (!anchor) return;
    if (!options?.keepalive && anchor.charOffset === lastSavedOffsetRef.current) return;

    const progress: Progress = {
      charOffset: anchor.charOffset,
      snippet: anchor.snippet,
      updatedAt: Date.now(),
      deviceId: deviceIdRef.current,
    };
    if (!options?.keepalive) setSyncLabel("Speichert…");

    try {
      const response = await fetch(`/api/progress/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progress),
        keepalive: Boolean(options?.keepalive),
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/read/${bookId}`)}`;
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        saved?: boolean;
        progress?: Progress;
        error?: string;
      } | null;
      if (!response.ok || !data) {
        if (!options?.keepalive) setSyncLabel("Speichern fehlgeschlagen");
        return;
      }
      if (data.saved) {
        if (progress.updatedAt >= lastSentUpdatedAtRef.current) {
          lastSentUpdatedAtRef.current = progress.updatedAt;
          lastSavedOffsetRef.current = progress.charOffset;
          appliedUpdatedAtRef.current = Math.max(appliedUpdatedAtRef.current, progress.updatedAt);
          if (!options?.keepalive) setSyncLabel("Gespeichert");
        }
        return;
      }
      const adopted = data.progress ? considerRemoteRef.current(data.progress) : false;
      if (adopted && pendingRef.current && !options?.keepalive) setSyncLabel("Stand vom anderen Gerät");
    } catch {
      if (!options?.keepalive) setSyncLabel("Speichern fehlgeschlagen");
    }
  };

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
    readyRef.current = false;
    userMovedRef.current = false;

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
        readyRef.current = true;
        setArmed(true);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Lesestand konnte nicht geladen werden");
        setSyncLabel("Lesestand fehlt");
      }
    })();

    const images = [...root.querySelectorAll("img")];
    const onImageLoad = () => {
      if (cancelled || userMovedRef.current) return;
      const progress = appliedProgressRef.current;
      if (progress) applyProgress(progress);
    };
    for (const image of images) {
      if (!image.complete) image.addEventListener("load", onImageLoad);
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      setArmed(false);
      for (const image of images) image.removeEventListener("load", onImageLoad);
    };
    // applyProgress is recreated each render and only reads refs plus setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, content]);

  useEffect(() => {
    if (!armed) return;
    let timer: number | null = null;
    let lastFire = 0;

    const scheduleSave = () => {
      const now = Date.now();
      const wait = 2000 - (now - lastFire);
      if (wait <= 0) {
        lastFire = now;
        void saveRef.current();
        return;
      }
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        lastFire = Date.now();
        void saveRef.current();
      }, wait);
    };

    const onScroll = () => {
      if (!readyRef.current || applyingRef.current) return;
      if (Date.now() < ignoreScrollUntilRef.current) return;
      const root = articleRef.current;
      const index = indexRef.current;
      if (!root || !index) return;
      const anchor = captureAnchor(root, index, readingTop());
      if (!anchor) return;
      if (anchor.charOffset === appliedOffsetRef.current && !userMovedRef.current) return;
      userMovedRef.current = true;
      lastScrollAtRef.current = Date.now();
      scheduleSave();
    };

    const pull = async () => {
      if (document.visibilityState === "hidden") return;
      const response = await apiFetch(`/api/progress/${bookId}`);
      if (!response.ok) return;
      const data = (await response.json().catch(() => ({}))) as { progress?: Progress | null };
      if (data.progress) considerRemoteRef.current(data.progress);
    };

    const flush = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      void saveRef.current({ keepalive: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else void pull();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    const poll = window.setInterval(() => void pull(), 5000);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [armed, bookId]);

  async function goHome(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    await Promise.race([
      saveRef.current({ keepalive: true }),
      new Promise((resolve) => window.setTimeout(resolve, 1500)),
    ]);
    window.location.href = "/";
  }

  function takeRemote() {
    const remote = pendingRef.current;
    if (!remote) return;
    userMovedRef.current = false;
    applyProgress(remote);
    setSyncLabel("Stand übernommen");
  }

  function keepLocal() {
    const remote = pendingRef.current;
    if (remote) {
      appliedUpdatedAtRef.current = Math.max(appliedUpdatedAtRef.current, remote.updatedAt);
    }
    pendingRef.current = null;
    setPending(null);
    userMovedRef.current = true;
    lastScrollAtRef.current = Date.now();
    void saveRef.current();
  }

  function markFromHere() {
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
  }

  return (
    <>
      <nav className="topbar" ref={barRef}>
        <a href="/" onClick={(event) => void goHome(event)}>
          Bibliothek
        </a>
        <span className="reader-title">{title}</span>
        <button type="button" onClick={markFromHere} disabled={!content}>
          Ab hier markieren
        </button>
        <span className="sync-label" aria-live="polite">
          {syncLabel}
        </span>
        {hint ? <span className="hint">{hint}</span> : null}
      </nav>

      {pending ? (
        <div className="banner" role="status">
          <p>Neuer Stand vom anderen Gerät</p>
          {pending.snippet.trim() ? <p className="banner-snippet">„{pending.snippet.trim()}“</p> : null}
          <div className="banner-actions">
            <button className="primary" type="button" onClick={takeRemote}>
              Übernehmen
            </button>
            <button type="button" onClick={keepLocal}>
              Hier weiterlesen
            </button>
          </div>
        </div>
      ) : null}

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
