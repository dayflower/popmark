import type { LexicalNode } from "lexical";

// Walks up the parent chain (starting at `node` itself) and returns the first
// node satisfying `predicate`, or null when none is found.
export function $findAncestor<T extends LexicalNode>(
  node: LexicalNode | null,
  predicate: (n: LexicalNode) => n is T,
): T | null {
  let current: LexicalNode | null = node;
  while (current !== null) {
    if (predicate(current)) return current;
    current = current.getParent();
  }
  return null;
}
