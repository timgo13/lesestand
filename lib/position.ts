export const SNIPPET_LEN = 80;

export function snippetAt(text: string, offset: number): string {
  const start = Math.max(0, Math.min(offset, text.length));
  return text.slice(start, start + SNIPPET_LEN);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveOffset(text: string, charOffset: number, snippet: string): number {
  const clamped = Math.max(0, Math.min(Number.isFinite(charOffset) ? charOffset : 0, text.length));
  if (!snippet) return clamped;

  const windowStart = Math.max(0, clamped - 40);
  const windowHit = text.slice(windowStart, Math.min(text.length, clamped + snippet.length + 40)).indexOf(snippet);
  if (windowHit >= 0) return windowStart + windowHit;

  const anywhere = text.indexOf(snippet);
  if (anywhere >= 0) return anywhere;

  const folded = snippet.replace(/\s+/g, " ").trim().slice(0, 48);
  const parts = folded.split(" ").filter((part) => part.length > 0).map(escapeRegExp);
  if (parts.length >= 3) {
    const match = new RegExp(parts.join("\\s+")).exec(text);
    if (match && match.index >= 0) return match.index;
  }

  return clamped;
}
