import { resolveOffset, snippetAt } from "@/lib/position";

// Abstand zwischen Leiste und der Zeile, die als "aktuelle Stelle" gilt.
const TOP_NUDGE = 8;
const MAX_LINE_HEIGHT = 120;

export type TextIndex = {
  nodes: { node: Text; start: number }[];
  text: string;
};

export function readingTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--bar-h");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed + TOP_NUDGE : 84;
}

export function indexText(root: HTMLElement): TextIndex {
  const nodes: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const node = current as Text;
    if (node.data.length === 0) continue;
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  return { nodes, text };
}

function usableLine(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.height <= MAX_LINE_HEIGHT;
}

function charRect(node: Text, offset: number): DOMRect | null {
  if (node.data.length === 0) return null;
  const start = Math.max(0, Math.min(offset, node.data.length - 1));
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  const rect = range.getClientRects()[0];
  return rect && usableLine(rect) ? rect : null;
}

function isPinned(node: Text, root: HTMLElement): boolean {
  for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
    const position = getComputedStyle(element).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

// Erstes Zeichen der Zeile `line` innerhalb des Textknotens (binäre Suche über die Zeichenpositionen).
function firstCharOnLine(node: Text, nodeStart: number, line: DOMRect): number {
  let low = 0;
  let high = node.data.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const rect = charRect(node, mid);
    if (!rect) {
      low = mid + 1;
    } else if (rect.top > line.top + 3) {
      high = mid - 1;
    } else if (rect.bottom < line.top - 1) {
      low = mid + 1;
    } else {
      found = mid;
      high = mid - 1;
    }
  }
  return nodeStart + found;
}

// Zeichenposition der Zeile, die gerade am oberen Lesebereich (`topPx`) steht.
function measureViewportOffset(root: HTMLElement, index: TextIndex, topPx: number): number | null {
  const range = document.createRange();
  let best: { node: Text; start: number; rect: DOMRect } | null = null;

  for (const entry of index.nodes) {
    if (entry.node.data.trim().length === 0) continue;
    range.selectNodeContents(entry.node);
    const rects = range.getClientRects();
    let pinned: boolean | null = null;
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (!usableLine(rect) || rect.bottom < topPx - 2) continue;
      pinned ??= isPinned(entry.node, root);
      if (pinned) break;
      if (!best || rect.bottom < best.rect.bottom) best = { node: entry.node, start: entry.start, rect };
    }
    // Zeile gefunden, die den oberen Rand schneidet, oder alles Weitere liegt tiefer: Suche beenden.
    if (best && (best.rect.top <= topPx + 4 || (rects[0] && rects[0].top > best.rect.bottom))) break;
  }

  return best ? firstCharOnLine(best.node, best.start, best.rect) : null;
}

export function scrollToOffset(index: TextIndex, offset: number, topPx: number) {
  if (index.text.length === 0) return;
  const target = Math.max(0, Math.min(offset, index.text.length - 1));
  let entry = index.nodes[0];
  for (let i = index.nodes.length - 1; i >= 0; i--) {
    if (target >= index.nodes[i].start) {
      entry = index.nodes[i];
      break;
    }
  }
  const local = target - entry.start;
  for (let step = 0; step <= 12; step++) {
    const rect = charRect(entry.node, local + step) ?? (step > 0 ? charRect(entry.node, local - step) : null);
    if (rect) {
      window.scrollBy({ top: rect.top - topPx, left: 0 });
      return;
    }
  }
}

export function captureAnchor(root: HTMLElement, index: TextIndex, topPx: number) {
  const measured = measureViewportOffset(root, index, topPx);
  if (measured == null) return null;
  const charOffset = resolveOffset(index.text, measured, "");
  return { charOffset, snippet: snippetAt(index.text, charOffset) };
}
