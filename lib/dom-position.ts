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

export function offsetFromPoint(index: TextIndex, node: Node, offset: number): number | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const entry = index.nodes.find((item) => item.node === node);
  if (!entry) return null;
  return entry.start + Math.min(Math.max(0, offset), (node as Text).data.length);
}

function firstText(node: Node | null): Text | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const next = walker.nextNode();
  return next ? (next as Text) : null;
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

function caretOffsetAt(root: HTMLElement, index: TextIndex, x: number, y: number): number | null {
  const range = caretRangeAt(x, y);
  if (!range || !root.contains(range.startContainer)) return null;
  const direct = offsetFromPoint(index, range.startContainer, range.startOffset);
  if (direct != null) return direct;
  if (range.startContainer.nodeType !== Node.ELEMENT_NODE) return null;
  const element = range.startContainer as Element;
  const child = element.childNodes[range.startOffset] ?? element;
  const text = firstText(child) ?? firstText(element);
  if (!text || !root.contains(text)) return null;
  return offsetFromPoint(index, text, 0);
}

function columnXPositions(root: HTMLElement): number[] {
  const box = root.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - 8, box.left + 12));
  const right = Math.max(left, Math.min(window.innerWidth - 8, box.right - 12));
  const mid = (left + right) / 2;
  return [left, (left + mid) / 2, mid, (mid + right) / 2, right];
}

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

function nearestCharBox(node: Text, offset: number): { offset: number; rect: DOMRect } | null {
  const length = node.data.length;
  const direct = charBox(node, offset);
  if (direct) return { offset: Math.max(0, Math.min(offset, length - 1)), rect: direct };
  for (let step = 1; step <= 8; step++) {
    const next = offset + step;
    if (next < length) {
      const rect = charBox(node, next);
      if (rect) return { offset: next, rect };
    }
    const prev = offset - step;
    if (prev >= 0) {
      const rect = charBox(node, prev);
      if (rect) return { offset: prev, rect };
    }
  }
  return null;
}

function firstOffsetOnOrBelow(node: Text, nodeStart: number, lineTop: number): number | null {
  const length = node.data.length;
  if (length === 0) return null;
  let low = 0;
  let high = length - 1;
  let best: number | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const sample = nearestCharBox(node, mid);
    if (!sample) {
      high = mid - 1;
      continue;
    }
    if (sample.rect.bottom < lineTop) low = Math.max(low + 1, sample.offset + 1);
    else {
      best = nodeStart + sample.offset;
      high = mid - 1;
    }
  }
  return best;
}

function hasBox(rects: DOMRectList, test: (rect: DOMRect) => boolean): boolean {
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (rect.width === 0 && rect.height === 0) continue;
    if (test(rect)) return true;
  }
  return false;
}

function lastVisibleLineStart(node: Text, nodeStart: number): number | null {
  const length = node.data.length;
  if (length === 0) return null;
  const viewBottom = window.innerHeight;
  let low = 0;
  let high = length - 1;
  let last = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const sample = nearestCharBox(node, mid);
    if (!sample) {
      high = mid - 1;
      continue;
    }
    if (sample.rect.bottom <= 0) low = Math.max(low + 1, sample.offset + 1);
    else if (sample.rect.top >= viewBottom) high = mid - 1;
    else {
      last = sample.offset;
      low = Math.max(low + 1, sample.offset + 1);
    }
  }
  if (last < 0) return nodeStart;
  const lineTop = charBox(node, last)?.top;
  if (lineTop == null) return nodeStart + last;
  let start = last;
  while (start > 0) {
    const rect = charBox(node, start - 1);
    if (!rect || Math.abs(rect.top - lineTop) > 3) break;
    start -= 1;
  }
  return nodeStart + start;
}

function offsetFromLayout(index: TextIndex, topPx: number): number | null {
  const viewBottom = window.innerHeight;
  let lastVisible: { node: Text; start: number } | null = null;
  const range = document.createRange();
  for (const entry of index.nodes) {
    if (entry.node.data.trim().length === 0) continue;
    range.selectNodeContents(entry.node);
    const rects = range.getClientRects();
    if (hasBox(rects, (rect) => rect.bottom > 0 && rect.top < viewBottom)) lastVisible = entry;
    const onReadingLine = hasBox(rects, (rect) => rect.bottom >= topPx && rect.top < viewBottom);
    if (!onReadingLine) continue;
    const found = firstOffsetOnOrBelow(entry.node, entry.start, topPx);
    if (found != null) return found;
    return entry.start;
  }
  if (lastVisible) return lastVisibleLineStart(lastVisible.node, lastVisible.start);
  return index.nodes[0]?.start ?? null;
}

export function measureViewportOffset(root: HTMLElement, index: TextIndex, topPx: number): number | null {
  if (index.nodes.length === 0 || index.text.length === 0) return null;
  const ys = [topPx, topPx + 18, topPx + 42, topPx + 84, topPx + 140];
  for (const y of ys) {
    if (y < 0 || y > window.innerHeight - 4) continue;
    for (const x of columnXPositions(root)) {
      const found = caretOffsetAt(root, index, x, y);
      if (found != null) return found;
    }
  }
  return offsetFromLayout(index, topPx);
}

export function scrollToOffset(index: TextIndex, offset: number, topPx: number) {
  const point = pointFromOffset(index, offset);
  if (!point) return;
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (rect && (rect.height > 0 || rect.width > 0)) {
    window.scrollBy({ top: rect.top - topPx, left: 0 });
    return;
  }
  const parent = point.node.parentElement;
  if (!parent) return;
  parent.scrollIntoView({ block: "start" });
  window.scrollBy(0, -topPx);
}

export function selectFromOffset(index: TextIndex, offset: number): boolean {
  const start = pointFromOffset(index, offset);
  if (!start) return false;
  const last = index.nodes[index.nodes.length - 1];
  if (!last) return false;
  if (start.node === last.node && start.offset >= last.node.data.length) return false;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(last.node, last.node.data.length);
  if (range.collapsed) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
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
