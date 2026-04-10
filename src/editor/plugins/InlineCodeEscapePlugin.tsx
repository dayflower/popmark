import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  IS_CODE,
  KEY_ARROW_RIGHT_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Returns the IS_CODE TextNode if the cursor is at its right boundary AND it is the very
// last node in the editor (i.e. no text follows the code span). Must be called inside a
// Lexical read or update context.
function $getTrailingCodeEndNode() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  if (!$isTextNode(anchorNode)) return null;
  if (!(anchorNode.getFormat() & IS_CODE)) return null;
  if (anchor.offset !== anchorNode.getTextContentSize()) return null;
  if ($getRoot().getLastDescendant() !== anchorNode) return null;
  return anchorNode;
}

// When the cursor is at the right end of an inline code span that is also the last node
// in the editor, pressing → or ` inserts a plain-text space and moves the cursor there.
// This gives visible feedback that the cursor has escaped the code span.
export function InlineCodeEscapePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const insertEscapeSpace = () => {
      editor.update(() => {
        const node = $getTrailingCodeEndNode();
        if (!node) return;
        const spaceNode = $createTextNode(" ");
        node.insertAfter(spaceNode);
        spaceNode.select(1, 1);
      });
    };

    const unregisterArrowRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (e) => {
        if (!$getTrailingCodeEndNode()) return false;
        e?.preventDefault();
        insertEscapeSpace();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // Backtick is not a named Lexical command; intercept at the DOM level
    const root = editor.getRootElement();
    const handleBacktick = (e: KeyboardEvent) => {
      if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey) return;
      let shouldHandle = false;
      editor.getEditorState().read(() => {
        shouldHandle = $getTrailingCodeEndNode() !== null;
      });
      if (!shouldHandle) return;
      e.preventDefault();
      insertEscapeSpace();
    };
    root?.addEventListener("keydown", handleBacktick);

    return () => {
      unregisterArrowRight();
      root?.removeEventListener("keydown", handleBacktick);
    };
  }, [editor]);
  return null;
}
