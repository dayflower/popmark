import type { LexicalEditor } from "lexical";
import { useEffect } from "react";
import { MarkdownCodeBlockNode } from "../nodes/MarkdownCodeBlockNode";

export function useRemoveEmptyCodeBlock(editor: LexicalEditor): void {
  useEffect(() => {
    const remove = editor.registerNodeTransform(
      MarkdownCodeBlockNode,
      (codeBlock) => {
        if (codeBlock.isEmpty()) {
          codeBlock.remove();
        }
      },
    );
    return () => {
      remove();
    };
  }, [editor]);
}
