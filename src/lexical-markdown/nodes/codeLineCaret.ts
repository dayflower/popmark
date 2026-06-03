import {
  $isLineBreakNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";

// Shared primitives for capturing and restoring a caret inside a sequence of
// text/linebreak children (code blocks and the paragraphs they dissolve into).
// The three call sites — CodeHighlightingPlugin (flat offset), codeBlockOps
// (line/offset), useReassembleCodeBlock (line/offset) — keep their own
// coordinate models and restore targets but delegate these repeated idioms.
// See notes/REFACTOR.ja.md #1.

// Sum of the rendered text length of `nodes`. Line breaks contribute their own
// `getTextContentSize()` (1), matching how the call sites measure offsets.
export function $sumTextContentSize(nodes: LexicalNode[]): number {
  let total = 0;
  for (const node of nodes) total += node.getTextContentSize();
  return total;
}

// Flattens a text anchor to a single offset within `container`: walks up to the
// direct child of `container` that holds `anchorNode`, then adds the text size
// of every preceding direct child to `offset`. Returns null when `anchorNode`
// is not inside `container`.
export function $flatTextAnchorOffset(
  container: ElementNode,
  anchorNode: LexicalNode,
  offset: number,
): number | null {
  let cur: LexicalNode | null = anchorNode;
  while (cur && !cur.getParent()?.is(container)) {
    cur = cur.getParent();
  }
  if (!cur) return null;
  return offset + $sumTextContentSize(cur.getPreviousSiblings());
}

// Groups `children[from, to)` into lines split by line break nodes. Each line is
// the list of its non-linebreak nodes (empty for a blank line). `from` is the
// index of the first child that belongs to line 0, letting callers control the
// line origin (e.g. include or skip the fence/structural line break).
export function $splitChildrenIntoLines(
  children: LexicalNode[],
  from: number,
  to: number,
): LexicalNode[][] {
  const lines: LexicalNode[][] = [[]];
  for (let i = from; i < to && i < children.length; i++) {
    const child = children[i];
    if ($isLineBreakNode(child)) {
      lines.push([]);
    } else {
      lines[lines.length - 1].push(child);
    }
  }
  return lines;
}

// Places a collapsed caret at `offset` within `node`, clamped to its text size.
export function $selectCollapsedClamped(node: TextNode, offset: number): void {
  const safe = Math.min(offset, node.getTextContentSize());
  node.select(safe, safe);
}
