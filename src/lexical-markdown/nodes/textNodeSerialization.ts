import type { SerializedTextNode, TextNode } from "lexical";

// Restores the format/detail/mode/style fields shared by every serialized
// TextNode onto a freshly constructed node, returning it for chaining. Custom
// TextNode subclasses use this in their importJSON so the boilerplate lives in
// one place.
export function $restoreTextNodeProps<T extends TextNode>(
  node: T,
  serialized: SerializedTextNode,
): T {
  node.setFormat(serialized.format);
  node.setDetail(serialized.detail);
  node.setMode(serialized.mode);
  node.setStyle(serialized.style);
  return node;
}
