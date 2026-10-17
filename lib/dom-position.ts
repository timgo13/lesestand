import { resolveOffset, snippetAt } from "@/lib/position";

const TOP_NUDGE = 8;

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
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    if (node.data.length > 0) {
      nodes.push({ node, start: text.length });
      text += node.data;
    }
    current = walker.nextNode();
  }
  return { nodes, text };
}

export function pointFromOffset(index: TextIndex, offset: number): { node: Text; offset: number } | null {
  if (index.nodes.length === 0) return null;
  const target = Math.max(0, Math.min(offset, index.text.length));
  for (let i = index.nodes.length - 1; i >= 0; i--) {
    const entry = index.nodes[i];
    if (target >= entry.start) {
      return {
        node: entry.node,
        offset: Math.min(Math.max(0, target - entry.start), entry.node.data.length),
      };
    }
  }
  return { node: index.nodes[0].node, offset: 0 };
}

function caretRangeAt(x: number, y: number): Range | null {
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return range;
  }
  const caret = document.caretPositionFromPoint?.(x, y);
  if (!caret?.offsetNode) return null;
  const range = document.createRange();
  try {
    range.setStart(caret.offsetNode, caret.offset);
    range.collapse(true);
    return range;
  } catch {
    return null;
  }
}

const MAX_LINE = 120;

function charBox(node: Text, offset: number): DOMRect | null {
  const length = node.data.length;
  if (length === 0) return null;
  const start = Math.max(0, Math.min(offset, length - 1));
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  const rect = range.getClientRects()[0];
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return rect;
}

function usableLine(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.height <= MAX_LINE;
}

function isPinned(node: Text, root: HTMLElement): boolean {
  let element = node.parentElement;
  while (element && element !== root) {
    const position = getComputedStyle(element).position;
    if (position === "fixed" || position === "sticky") return true;
    element = element.parentElement;
  }
  return false;
}

function offsetOnLine(node: Text, nodeStart: number, line: DOMRect): number {
  const y = line.top + Math.min(line.height / 2, 10);
  const x = line.left + Math.min(2, Math.max(0, line.width - 1));
  const range = caretRangeAt(x, y);
  if (range && range.startContainer === node && range.startOffset < node.data.length) {
    const rect = range.getClientRects()[0];
    if (rect && usableLine(rect) && Math.abs(rect.top - line.top) <= 4) {
      return nodeStart + range.startOffset;
    }
  }
  let low = 0;
  let high = node.data.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const rect = charBox(node, mid);
    if (!rect || !usableLine(rect)) {
      low = mid + 1;
      continue;
    }
    if (rect.top > line.top + 3) high = mid - 1;
    else if (rect.bottom < line.top - 1) low = mid + 1;
    else {
      found = mid;
      high = mid - 1;
    }
  }
  return nodeStart + (found >= 0 ? found : 0);
}

export function measureViewportOffset(root: HTMLElement, index: TextIndex, topPx: number): number | null {
  if (index.nodes.length === 0 || index.text.length === 0) return null;
  const range = document.createRange();
  let pinnedHit: { node: Text; start: number; rect: DOMRect } | null = null;
  let below: { node: Text; start: number; rect: DOMRect } | null = null;
  let above: { node: Text; start: number; rect: DOMRect } | null = null;
  for (const entry of index.nodes) {
    if (entry.node.data.trim().length === 0) continue;
    range.selectNodeContents(entry.node);
    const rects = range.getClientRects();
    const pinned = isPinned(entry.node, root);
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (!usableLine(rect)) continue;
      const onLine = rect.top <= topPx + 4 && rect.bottom >= topPx - 2;
      if (onLine) {
        if (pinned) {
          if (!pinnedHit) pinnedHit = { node: entry.node, start: entry.start, rect };
        } else {
          return offsetOnLine(entry.node, entry.start, rect);
        }
        continue;
      }
      if (pinned) continue;
      if (rect.top > topPx && (!below || rect.top < below.rect.top)) {
        below = { node: entry.node, start: entry.start, rect };
      } else if (rect.bottom < topPx && (!above || rect.bottom > above.rect.bottom)) {
        above = { node: entry.node, start: entry.start, rect };
      }
    }
  }
  const chosen = below ?? above ?? pinnedHit;
  if (!chosen) return null;
  return offsetOnLine(chosen.node, chosen.start, chosen.rect);
}

function glyphRect(index: TextIndex, offset: number): DOMRect | null {
  if (index.text.length === 0) return null;
  const clamped = Math.max(0, Math.min(offset, index.text.length - 1));
  const point = pointFromOffset(index, clamped);
  if (!point) return null;
  const local = Math.min(point.offset, Math.max(0, point.node.data.length - 1));
  const direct = charBox(point.node, local);
  if (direct && usableLine(direct)) return direct;
  for (let step = 1; step <= 12; step++) {
    const next = charBox(point.node, local + step);
    if (next && usableLine(next)) return next;
    const prev = charBox(point.node, local - step);
    if (prev && usableLine(prev)) return prev;
  }
  return null;
}

export function scrollToOffset(index: TextIndex, offset: number, topPx: number) {
  const rect = glyphRect(index, offset);
  if (!rect) return;
  window.scrollBy({ top: rect.top - topPx, left: 0 });
}

export function selectFromOffset(index: TextIndex, offset: number): boolean {
  if (index.text.length === 0) return false;
  const clamped = Math.max(0, Math.min(offset, index.text.length - 1));
  const start = pointFromOffset(index, clamped);
  const last = index.nodes[index.nodes.length - 1];
  if (!start || !last) return false;
  const range = document.createRange();
  range.setStart(start.node, Math.min(start.offset, start.node.data.length));
  range.setEnd(last.node, last.node.data.length);
  if (range.collapsed) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  try {
    selection.addRange(range);
  } catch {
    return false;
  }
  return selection.rangeCount > 0 && !selection.isCollapsed;
}

export function captureAnchor(root: HTMLElement, index: TextIndex, topPx: number) {
  const charOffset = measureViewportOffset(root, index, topPx);
  if (charOffset == null) return null;
  const resolved = resolveOffset(index.text, charOffset, "");
  return {
    charOffset: resolved,
    snippet: snippetAt(index.text, resolved),
  };
}
