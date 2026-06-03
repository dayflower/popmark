import {
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
  type LexicalNode,
  ParagraphNode,
  TextNode,
} from "lexical";
import { useEffect } from "react";
import {
  $replaceWithParagraphsPerLine,
  isCloseFence,
  parseOpenFence,
} from "../nodes/codeBlockOps";
import {
  $flatTextAnchorOffset,
  $selectCollapsedClamped,
  $splitChildrenIntoLines,
  $sumTextContentSize,
} from "../nodes/codeLineCaret";
import {
  $appendCodeBlockChildren,
  $createMarkdownCodeBlockNode,
  type MarkdownCodeBlockNode,
} from "../nodes/MarkdownCodeBlockNode";
import { $findAncestor } from "../nodes/nodeTraversal";

type ReassembleCaretSource =
  | { kind: "open"; offset: number }
  | { kind: "middle"; lineIndex: number; offset: number }
  | { kind: "close"; offset: number };

function $captureCaretForReassembly(
  openParagraph: ParagraphNode,
  middleParagraphs: ParagraphNode[],
  closeParagraph: ParagraphNode,
): ReassembleCaretSource | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor;
  const paragraph = $findAncestor(anchor.getNode(), $isParagraphNode);
  if (!paragraph) return null;
  const offset = $flatOffsetInParagraph(
    paragraph,
    anchor.getNode(),
    anchor.offset,
    anchor.type,
  );
  if (paragraph.is(openParagraph)) return { kind: "open", offset };
  if (paragraph.is(closeParagraph)) return { kind: "close", offset };
  for (let i = 0; i < middleParagraphs.length; i++) {
    if (paragraph.is(middleParagraphs[i])) {
      return { kind: "middle", lineIndex: i, offset };
    }
  }
  return null;
}

function $flatOffsetInParagraph(
  paragraph: ParagraphNode,
  anchorNode: LexicalNode,
  anchorOffset: number,
  anchorType: "text" | "element",
): number {
  if (anchorType === "element" && anchorNode === paragraph) {
    return $sumTextContentSize(paragraph.getChildren().slice(0, anchorOffset));
  }
  if (anchorType === "text" && $isTextNode(anchorNode)) {
    return $flatTextAnchorOffset(paragraph, anchorNode, anchorOffset) ?? 0;
  }
  return 0;
}

function $restoreCaretAfterReassembly(
  codeBlock: MarkdownCodeBlockNode,
  source: ReassembleCaretSource | null,
): boolean {
  if (!source) return false;
  if (source.kind === "open") {
    const fence = codeBlock.getOpenFence();
    if (!fence) return false;
    $selectCollapsedClamped(fence, source.offset);
    return true;
  }
  if (source.kind === "close") {
    const fence = codeBlock.getCloseFence();
    if (!fence) return false;
    $selectCollapsedClamped(fence, source.offset);
    return true;
  }
  // Content lines start at child index 2 (after the open fence and the
  // structural line break), so line 0 is the first code line.
  const children = codeBlock.getChildren();
  const lines = $splitChildrenIntoLines(children, 2, children.length - 1);
  const textNode = lines[source.lineIndex]?.find($isTextNode);
  if (textNode) {
    $selectCollapsedClamped(textNode, source.offset);
    return true;
  }
  return false;
}

function $buildCodeBlockFromParagraphs(
  openParagraph: ParagraphNode,
  middleParagraphs: ParagraphNode[],
  closeParagraph: ParagraphNode,
  language: string,
): void {
  const caretSource = $captureCaretForReassembly(
    openParagraph,
    middleParagraphs,
    closeParagraph,
  );

  const codeBlock = $createMarkdownCodeBlockNode(language);
  const closeFenceText = closeParagraph.getTextContent();
  $appendCodeBlockChildren(
    codeBlock,
    openParagraph.getTextContent(),
    middleParagraphs.map((p) => p.getTextContent()),
    closeFenceText,
  );

  openParagraph.replace(codeBlock);
  for (const mid of middleParagraphs) mid.remove();
  closeParagraph.remove();

  if ($restoreCaretAfterReassembly(codeBlock, caretSource)) return;

  const closeFenceNode = codeBlock.getCloseFence();
  if (closeFenceNode) {
    closeFenceNode.select(closeFenceText.length, closeFenceText.length);
  }
}

function $tryReassembleAsCloseFence(paragraph: ParagraphNode): boolean {
  if (!isCloseFence(paragraph.getTextContent())) return false;

  const middles: ParagraphNode[] = [];
  let cursor: LexicalNode | null = paragraph.getPreviousSibling();
  while (cursor) {
    if (!$isParagraphNode(cursor)) return false;
    const parsed = parseOpenFence(cursor.getTextContent());
    if (parsed) {
      middles.reverse();
      $buildCodeBlockFromParagraphs(
        cursor,
        middles,
        paragraph,
        parsed.language,
      );
      return true;
    }
    middles.push(cursor);
    cursor = cursor.getPreviousSibling();
  }
  return false;
}

function $tryReassembleAsOpenFence(paragraph: ParagraphNode): boolean {
  const parsed = parseOpenFence(paragraph.getTextContent());
  if (!parsed) return false;
  const language = parsed.language;

  const middles: ParagraphNode[] = [];
  let cursor: LexicalNode | null = paragraph.getNextSibling();
  while (cursor) {
    if (!$isParagraphNode(cursor)) return false;
    if (isCloseFence(cursor.getTextContent())) {
      $buildCodeBlockFromParagraphs(paragraph, middles, cursor, language);
      return true;
    }
    middles.push(cursor);
    cursor = cursor.getNextSibling();
  }
  return false;
}

function $splitParagraphAtLineBreaks(
  paragraph: ParagraphNode,
): ParagraphNode[] {
  const text = paragraph.getTextContent();
  if (text.indexOf("\n") < 0) return [paragraph];
  return $replaceWithParagraphsPerLine(paragraph, text);
}

function $hasInternalLineBreak(paragraph: ParagraphNode): boolean {
  for (const child of paragraph.getChildren()) {
    if ($isLineBreakNode(child)) return true;
  }
  return false;
}

function $tryRecoverFromDissolvedBlock(paragraph: ParagraphNode): boolean {
  if (!$hasInternalLineBreak(paragraph)) return false;
  const firstLine = paragraph.getTextContent().split("\n", 1)[0];
  if (parseOpenFence(firstLine) === null) return false;

  const split = $splitParagraphAtLineBreaks(paragraph);
  const first = split[0];
  if (first) {
    $tryReassembleAsOpenFence(first);
  }
  return true;
}

export function useReassembleCodeBlock(editor: LexicalEditor): void {
  useEffect(() => {
    const $reassembleAtParagraph = (paragraph: ParagraphNode) => {
      if ($tryRecoverFromDissolvedBlock(paragraph)) return;
      if ($tryReassembleAsCloseFence(paragraph)) return;
      $tryReassembleAsOpenFence(paragraph);
    };

    const removeParagraph = editor.registerNodeTransform(
      ParagraphNode,
      $reassembleAtParagraph,
    );

    const removeText = editor.registerNodeTransform(TextNode, (textNode) => {
      const parent = textNode.getParent();
      if (!$isParagraphNode(parent)) return;
      $reassembleAtParagraph(parent);
    });

    return () => {
      removeParagraph();
      removeText();
    };
  }, [editor]);
}
