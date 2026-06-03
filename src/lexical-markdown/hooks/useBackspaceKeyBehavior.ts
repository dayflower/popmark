import {
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
} from "lexical";
import { useEffect } from "react";
import {
  $getCollapsedCaretInCodeBlock,
  $replaceWithParagraphsPerLine,
  parseOpenFence,
} from "../nodes/codeBlockOps";
import {
  $isCursorAtCloseFenceLineStart,
  $isCursorAtCodeBlockStart,
  $isCursorAtFirstContentLineStart,
} from "../nodes/cursorPredicates";
import {
  $isContentTextNode,
  type MarkdownCodeBlockNode,
  OPEN_FENCE_PREFIX_LENGTH,
} from "../nodes/MarkdownCodeBlockNode";

function $mergeFirstContentLineIntoOpenFence(
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const openFence = codeBlock.getOpenFence();
  if (!openFence) return false;

  const separator = openFence.getNextSibling();
  if (!$isLineBreakNode(separator)) return false;

  let mergedText = "";
  const toRemove: LexicalNode[] = [];
  let cursor: LexicalNode | null = separator.getNextSibling();
  while ($isContentTextNode(cursor)) {
    mergedText += cursor.getTextContent();
    toRemove.push(cursor);
    cursor = cursor.getNextSibling();
  }

  if (mergedText.length > 0) {
    const newFenceText = openFence.getTextContent() + mergedText;
    openFence.setTextContent(newFenceText);
    const parsed = parseOpenFence(newFenceText);
    if (parsed) {
      codeBlock.setLanguage(parsed.language);
    }
  }
  for (const node of toRemove) {
    node.remove();
  }
  separator.remove();

  openFence.select(OPEN_FENCE_PREFIX_LENGTH, OPEN_FENCE_PREFIX_LENGTH);
  return true;
}

function $dissolveCodeBlockMergingIntoPrev(
  codeBlock: MarkdownCodeBlockNode,
  prev: ParagraphNode,
): void {
  const paragraphs = $replaceWithParagraphsPerLine(codeBlock);
  const first = paragraphs[0];
  if (!first) return;

  const movedChildren = [...first.getChildren()];
  for (const child of movedChildren) {
    prev.append(child);
  }
  first.remove();

  const firstMoved = movedChildren[0];
  if (firstMoved !== undefined && $isTextNode(firstMoved)) {
    firstMoved.select(0, 0);
    return;
  }
  prev.select(prev.getChildrenSize(), prev.getChildrenSize());
}

function $handleCloseFenceLineStartBackspace(
  codeBlock: MarkdownCodeBlockNode,
): boolean {
  const closeFence = codeBlock.getCloseFence();
  if (!closeFence) return false;

  const lastLB = closeFence.getPreviousSibling();
  if (!$isLineBreakNode(lastLB)) return false;

  const before = lastLB.getPreviousSibling();
  if (!before) return false;

  if ($isContentTextNode(before)) {
    let lastLineLength = 0;
    let cur: LexicalNode | null = before;
    while ($isContentTextNode(cur)) {
      lastLineLength += cur.getTextContentSize();
      cur = cur.getPreviousSibling();
    }
    lastLB.remove();
    const paragraphs = $replaceWithParagraphsPerLine(codeBlock);
    const lastParagraph = paragraphs[paragraphs.length - 1];
    const firstChild = lastParagraph?.getFirstChild();
    if ($isTextNode(firstChild)) {
      firstChild.select(lastLineLength, lastLineLength);
    }
    return true;
  }

  if ($isLineBreakNode(before)) {
    lastLB.remove();
    closeFence.select(0, 0);
    return true;
  }

  const index = lastLB.getIndexWithinParent();
  codeBlock.select(index, index);
  return true;
}

export function useBackspaceKeyBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const remove = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent | null) => {
        const ctx = $getCollapsedCaretInCodeBlock();
        if (!ctx) return false;
        const { anchor, codeBlock } = ctx;

        if ($isCursorAtCodeBlockStart(anchor, codeBlock)) {
          const prev = codeBlock.getPreviousSibling();
          if ($isParagraphNode(prev) && prev.getTextContentSize() === 0) {
            prev.remove();
            event?.preventDefault();
            return true;
          }
          if ($isParagraphNode(prev)) {
            $dissolveCodeBlockMergingIntoPrev(codeBlock, prev);
            event?.preventDefault();
            return true;
          }
          return false;
        }

        if ($isCursorAtFirstContentLineStart(anchor, codeBlock)) {
          if ($mergeFirstContentLineIntoOpenFence(codeBlock)) {
            event?.preventDefault();
            return true;
          }
          return false;
        }

        if ($isCursorAtCloseFenceLineStart(anchor, codeBlock)) {
          if ($handleCloseFenceLineStartBackspace(codeBlock)) {
            event?.preventDefault();
            return true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      remove();
    };
  }, [editor]);
}
