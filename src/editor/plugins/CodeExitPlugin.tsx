import { $isCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Allows exiting a code block by pressing ArrowDown at the last line
export function CodeExitPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();
        const parent = anchorNode.getParent();
        if (!$isCodeNode(parent)) return false;
        if (anchorNode !== parent.getLastChild()) return false;
        if (selection.anchor.offset < anchorNode.getTextContentSize()) return false;
        e?.preventDefault();
        editor.update(() => {
          const para = $createParagraphNode();
          parent.insertAfter(para);
          para.select();
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}
