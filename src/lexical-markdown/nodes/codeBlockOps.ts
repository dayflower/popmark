import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
  type ParagraphNode,
  type PointType,
  type TextNode,
} from "lexical";
import {
  $selectCollapsedClamped,
  $splitChildrenIntoLines,
  $sumTextContentSize,
} from "./codeLineCaret";
import {
  $appendCodeBlockChildren,
  $isMarkdownCodeBlockNode,
  type MarkdownCodeBlockNode,
} from "./MarkdownCodeBlockNode";
import { $findAncestor } from "./nodeTraversal";

const OPEN_FENCE_REGEX = /^```([a-zA-Z0-9_+-]*)\s*$/;
const CLOSE_FENCE_REGEX = /^```\s*$/;

export function parseOpenFence(text: string): { language: string } | null {
  const match = OPEN_FENCE_REGEX.exec(text);
  if (!match) return null;
  return { language: match[1] ?? "" };
}

export function isCloseFence(text: string): boolean {
  return CLOSE_FENCE_REGEX.test(text);
}

export function $findNearestMarkdownCodeBlockNode(
  node: LexicalNode | null,
): MarkdownCodeBlockNode | null {
  return $findAncestor(node, $isMarkdownCodeBlockNode);
}

export function $getCollapsedCaretInCodeBlock(): {
  anchor: PointType;
  codeBlock: MarkdownCodeBlockNode;
} | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const anchor = selection.anchor;
  const codeBlock = $findNearestMarkdownCodeBlockNode(anchor.getNode());
  if (!codeBlock) return null;
  return { anchor, codeBlock };
}

export function $extractValidCodeBlockInfo(
  codeBlock: MarkdownCodeBlockNode,
): { language: string } | null {
  const open = codeBlock.getOpenFence();
  const close = codeBlock.getCloseFence();
  if (!open || !close) return null;
  const parsedOpen = parseOpenFence(open.getTextContent());
  if (!parsedOpen) return null;
  if (!isCloseFence(close.getTextContent())) return null;
  return { language: parsedOpen.language };
}

export function $normalizeCodeBlock(
  codeBlock: MarkdownCodeBlockNode,
  language: string,
): void {
  const codeText = codeBlock.getCodeText() ?? "";
  const codeLines = codeText.split("\n");
  const openFenceText =
    codeBlock.getFirstChild()?.getTextContent() ?? `\`\`\`${language}`;
  const closeFenceText = codeBlock.getLastChild()?.getTextContent() ?? "```";
  for (const child of codeBlock.getChildren()) {
    child.remove();
  }
  $appendCodeBlockChildren(codeBlock, openFenceText, codeLines, closeFenceText);
  if (codeBlock.getLanguage() !== language) {
    codeBlock.setLanguage(language);
  }
}

export function $replaceWithParagraphsPerLine(
  node: LexicalNode,
  text?: string,
): ParagraphNode[] {
  const lines = (text ?? node.getTextContent()).split("\n");
  const created: ParagraphNode[] = [];
  let prev: LexicalNode = node;
  for (const line of lines) {
    const paragraph = $createParagraphNode();
    if (line.length > 0) {
      paragraph.append($createTextNode(line));
    }
    prev.insertAfter(paragraph);
    prev = paragraph;
    created.push(paragraph);
  }
  node.remove();
  return created;
}

type CodeBlockCaretPosition = {
  lineIndex: number;
  lineOffset: number;
};

function $captureCaretPositionInCodeBlock(
  codeBlock: MarkdownCodeBlockNode,
): CodeBlockCaretPosition | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  if ($findNearestMarkdownCodeBlockNode(anchorNode) !== codeBlock) return null;

  if (anchor.type === "element") {
    if (anchorNode !== codeBlock) return null;
    return $caretFromChildIndex(codeBlock, anchor.offset);
  }
  if (!$isTextNode(anchorNode)) return null;
  return $caretFromTextNode(anchorNode, anchor.offset);
}

function $caretFromTextNode(
  textNode: TextNode,
  offset: number,
): CodeBlockCaretPosition {
  const siblings = textNode.getParent()?.getChildren() ?? [];
  const lines = $splitChildrenIntoLines(siblings, 0, siblings.length);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const idx = line.findIndex((n) => n.is(textNode));
    if (idx >= 0) {
      return {
        lineIndex,
        lineOffset: offset + $sumTextContentSize(line.slice(0, idx)),
      };
    }
  }
  return { lineIndex: 0, lineOffset: offset };
}

function $caretFromChildIndex(
  codeBlock: MarkdownCodeBlockNode,
  childIndex: number,
): CodeBlockCaretPosition {
  // Children before the element anchor, grouped into lines: the line count
  // (minus the leading line) is the line index, and the text in the current
  // (last) line is the offset within it.
  const lines = $splitChildrenIntoLines(codeBlock.getChildren(), 0, childIndex);
  return {
    lineIndex: lines.length - 1,
    lineOffset: $sumTextContentSize(lines[lines.length - 1]),
  };
}

function $restoreCaretInParagraphs(
  paragraphs: ParagraphNode[],
  pos: CodeBlockCaretPosition,
): void {
  if (paragraphs.length === 0) return;
  const idx = Math.min(pos.lineIndex, paragraphs.length - 1);
  const paragraph = paragraphs[idx];
  const child = paragraph.getFirstChild();
  if ($isTextNode(child)) {
    $selectCollapsedClamped(child, pos.lineOffset);
    return;
  }
  paragraph.selectStart();
}

export function $unwrapMarkdownCodeBlockNode(
  codeBlock: MarkdownCodeBlockNode,
): void {
  const pos = $captureCaretPositionInCodeBlock(codeBlock);
  const paragraphs = $replaceWithParagraphsPerLine(codeBlock);
  if (pos !== null) {
    $restoreCaretInParagraphs(paragraphs, pos);
  }
}

export function $exitCodeBlockBefore(codeBlock: MarkdownCodeBlockNode): void {
  const paragraph = $createParagraphNode();
  codeBlock.insertBefore(paragraph);
  paragraph.select();
}

export function $exitCodeBlockAfter(codeBlock: MarkdownCodeBlockNode): void {
  const paragraph = $createParagraphNode();
  codeBlock.insertAfter(paragraph);
  paragraph.select();
}

export function $jumpAfterCodeBlock(codeBlock: MarkdownCodeBlockNode): void {
  const next = codeBlock.getNextSibling();
  if ($isElementNode(next)) {
    next.selectStart();
    return;
  }
  $exitCodeBlockAfter(codeBlock);
}
