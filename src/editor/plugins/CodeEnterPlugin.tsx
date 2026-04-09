import { $isCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Handles Enter key inside code blocks:
// - Typing "```" then Enter exits the code block
// - Prevents double-Enter from exiting (built-in CodeNode behavior)
export function CodeEnterPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();

        // Case 1: cursor is on CodeNode element itself (double-Enter exit would fire)
        if ($isCodeNode(anchorNode)) {
          e?.preventDefault();
          editor.update(() => {
            // Move cursor back inside the code block to prevent exit
            const lastDescendant = anchorNode.getLastDescendant();
            if (lastDescendant && $isTextNode(lastDescendant)) {
              lastDescendant.select(lastDescendant.getTextContentSize());
            } else {
              const lineBreak = $createLineBreakNode();
              anchorNode.append(lineBreak);
            }
          });
          return true;
        }

        // Case 2: cursor is inside a code block text node
        const parent = anchorNode.getParent();
        if (!$isCodeNode(parent)) return false;

        // "```" on the current line → exit the code block
        if (anchorNode.getTextContent() === "```") {
          e?.preventDefault();
          editor.update(() => {
            anchorNode.remove();
            const para = $createParagraphNode();
            parent.insertAfter(para);
            para.select();
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);
  return null;
}
