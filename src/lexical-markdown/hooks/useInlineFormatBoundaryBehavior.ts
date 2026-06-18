import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
  type TextFormatType,
} from "lexical";
import { useEffect } from "react";

// Inline text formats this editor applies through Markdown shortcuts. A
// collapsed caret resting on the outer edge of such a run inherits the run's
// format from the anchor TextNode (Lexical core derives `selection.format` from
// the anchor node), which traps subsequent typing inside the run. For inline
// code this is unrecoverable because the headless editor exposes no toggle UI.
const INLINE_FORMATS: TextFormatType[] = [
  "code",
  "bold",
  "italic",
  "strikethrough",
];

/**
 * Treat a collapsed caret sitting on the outer edge of an inline-formatted run
 * as being *outside* that run, so the next input is unformatted. Mirrors the
 * one-shot clear that `@lexical/markdown` performs right after a shortcut
 * transform, but reapplies it whenever the caret returns to the boundary (e.g.
 * via ArrowLeft then ArrowRight), which is exactly the case core Lexical fails
 * to handle.
 */
export function useInlineFormatBoundaryBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor;
        if (anchor.type !== "text") return false;
        const node = anchor.getNode();
        if (!$isTextNode(node)) return false;

        const atEnd = anchor.offset === node.getTextContentSize();
        const atStart = anchor.offset === 0;
        if (!atEnd && !atStart) return false;

        // The node on the far side of the caret. When it shares a format with
        // the current run we are mid-text (e.g. adjacent code spans) and must
        // not clear it.
        const outward = atEnd
          ? node.getNextSibling()
          : node.getPreviousSibling();
        const outwardHasFormat = (format: TextFormatType): boolean =>
          $isTextNode(outward) && outward.hasFormat(format);

        for (const format of INLINE_FORMATS) {
          if (
            node.hasFormat(format) &&
            !outwardHasFormat(format) &&
            selection.hasFormat(format)
          ) {
            selection.toggleFormat(format);
          }
        }

        // Never block other SELECTION_CHANGE listeners.
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
}
