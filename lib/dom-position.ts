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

export function measureViewportOffset(root: HTMLElement, index: TextIndex, topPx: number): number | null {
  const x = Math.max(8, Math.min(window.innerWidth / 2, window.innerWidth - 8));
  const yPositions = [topPx, topPx + 24, topPx + 64, topPx + 120];
  for (const y of yPositions) {
    const range = caretRangeAt(x, y);
    if (!range || !root.contains(range.startContainer)) continue;
    const direct = offsetFromPoint(index, range.startContainer, range.startOffset);
    if (direct != null) return direct;
    if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
      const element = range.startContainer as Element;
      const child = element.childNodes[range.startOffset] ?? element;
      const text = firstText(child) ?? firstText(element);
      if (!text || !root.contains(text)) continue;
      const found = offsetFromPoint(index, text, 0);
      if (found != null) return found;
    }
  }
  return null;
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
