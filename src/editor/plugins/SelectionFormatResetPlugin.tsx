import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  IS_CODE,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Prevents stale RangeSelection.format bits in two scenarios:
// 1. Editor becomes empty: Lexical skips format-reset when root text is empty, so new
//    input would carry the previous format (bold, italic, strikethrough, etc.). Clear all
//    format bits on every SELECTION_CHANGE while the editor is empty.
// 2. Cursor at right boundary of an IS_CODE TextNode: after MarkdownShortcutPlugin
//    fires and the user navigates away then back, IS_CODE re-derives from the anchor
//    node. Clear it when the cursor is at offset === textContentSize and the next
//    sibling is not also IS_CODE, so the next keypress inserts plain text outside.
export function SelectionFormatResetPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        // Case 1: editor is empty — clear all pending format bits
        if ($getRoot().getTextContent() === "") {
          if (selection.format !== 0) {
            selection.format = 0;
            selection.dirty = true;
          }
          return false;
        }

        // Case 2: cursor at right boundary of an IS_CODE TextNode
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if (
          $isTextNode(anchorNode) &&
          anchorNode.getFormat() & IS_CODE &&
          anchor.offset === anchorNode.getTextContentSize()
        ) {
          const next = anchorNode.getNextSibling();
          if (next === null || !($isTextNode(next) && next.getFormat() & IS_CODE)) {
            selection.format &= ~IS_CODE;
            selection.dirty = true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}
