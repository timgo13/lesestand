export const SNIPPET_LEN = 80;

export function snippetAt(text: string, offset: number): string {
  const start = Math.max(0, Math.min(offset, text.length));
  return text.slice(start, start + SNIPPET_LEN);
}

// Findet die gespeicherte Stelle im Text wieder. Der Textausschnitt hat Vorrang,
// weil sich die Zeichenposition ändern kann, wenn die Datei neu bereinigt wurde.
export function resolveOffset(text: string, charOffset: number, snippet: string): number {
  const clamped = Math.max(0, Math.min(Number.isFinite(charOffset) ? charOffset : 0, text.length));
  if (!snippet) return clamped;

  const windowStart = Math.max(0, clamped - 40);
  const windowEnd = Math.min(text.length, clamped + snippet.length + 40);
  const nearby = text.slice(windowStart, windowEnd).indexOf(snippet);
  if (nearby >= 0) return windowStart + nearby;

  const anywhere = text.indexOf(snippet);
  return anywhere >= 0 ? anywhere : clamped;
}
