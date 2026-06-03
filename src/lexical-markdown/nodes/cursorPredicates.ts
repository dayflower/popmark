import { $isLineBreakNode, type LexicalNode, type PointType } from "lexical";
import {
  FIRST_CONTENT_LINE_CHILD_INDEX,
  type MarkdownCodeBlockNode,
} from "./MarkdownCodeBlockNode";

export function $isCursorAtCodeBlockStart(
  anchor: PointType,
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const openFence = codeBlock.getOpenFence();
  if (!openFence) return false;
  const anchorNode = anchor.getNode();
  if (anchorNode.is(openFence)) return anchor.offset === 0;
  if (anchorNode.is(codeBlock)) return anchor.offset === 0;
  return false;
}

export function $isCursorAtCodeBlockEnd(
  anchor: PointType,
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const closeFence = codeBlock.getCloseFence();
  if (!closeFence) return false;
  const anchorNode = anchor.getNode();
  if (anchorNode.is(closeFence)) {
    return anchor.offset === anchorNode.getTextContentSize();
  }
  if (anchorNode.is(codeBlock)) {
    return anchor.offset >= codeBlock.getChildrenSize();
  }
  return false;
}

export function $isCursorAtFirstContentLineStart(
  anchor: PointType,
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const firstContent = codeBlock.getChildAtIndex(
    FIRST_CONTENT_LINE_CHILD_INDEX,
  );
  if (!firstContent || firstContent.is(codeBlock.getCloseFence())) {
    return false;
  }

  const anchorNode = anchor.getNode();
  if (anchorNode.is(codeBlock)) {
    return anchor.offset === FIRST_CONTENT_LINE_CHILD_INDEX;
  }

  if (anchor.offset !== 0) return false;
  return anchorNode.is(firstContent);
}

export function $isCursorAtCloseFenceLineStart(
  anchor: PointType,
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const closeFence = codeBlock.getCloseFence();
  if (!closeFence) return false;
  const anchorNode = anchor.getNode();
  if (anchorNode.is(closeFence)) return anchor.offset === 0;
  if (anchorNode.is(codeBlock)) {
    return anchor.offset === codeBlock.getChildrenSize() - 1;
  }
  return false;
}

export function $isCursorOnCloseFenceLine(
  anchor: PointType,
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const closeFence = codeBlock.getCloseFence();
  if (!closeFence) return false;
  const anchorNode = anchor.getNode();
  if (anchorNode.is(closeFence)) return true;

  let scan: LexicalNode | null;
  if (anchorNode.is(codeBlock)) {
    if (anchor.offset >= codeBlock.getChildrenSize()) return true;
    scan = codeBlock.getChildAtIndex(anchor.offset);
  } else if (anchorNode.getParent()?.is(codeBlock)) {
    scan = anchorNode.getNextSibling();
  } else {
    return false;
  }

  while (scan && !scan.is(closeFence)) {
    if ($isLineBreakNode(scan)) return false;
    scan = scan.getNextSibling();
  }
  return scan?.is(closeFence) ?? false;
}
