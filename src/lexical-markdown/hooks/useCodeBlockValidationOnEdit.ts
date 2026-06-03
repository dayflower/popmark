import { $isLineBreakNode, type LexicalEditor } from "lexical";
import { useEffect } from "react";
import {
  $extractValidCodeBlockInfo,
  $findNearestMarkdownCodeBlockNode,
  $unwrapMarkdownCodeBlockNode,
} from "../nodes/codeBlockOps";
import {
  MarkdownCodeBlockNode,
  MarkdownCodeFenceNode,
} from "../nodes/MarkdownCodeBlockNode";

export function useCodeBlockValidationOnEdit(editor: LexicalEditor): void {
  useEffect(() => {
    const $validate = (codeBlock: MarkdownCodeBlockNode) => {
      if (!$extractValidCodeBlockInfo(codeBlock)) {
        $unwrapMarkdownCodeBlockNode(codeBlock);
        return;
      }
      const closeFence = codeBlock.getCloseFence();
      const beforeClose = closeFence?.getPreviousSibling();
      if (beforeClose && !$isLineBreakNode(beforeClose)) {
        $unwrapMarkdownCodeBlockNode(codeBlock);
      }
    };

    const removeBlockTransform = editor.registerNodeTransform(
      MarkdownCodeBlockNode,
      $validate,
    );
    const removeFenceTransform = editor.registerNodeTransform(
      MarkdownCodeFenceNode,
      (fence) => {
        const codeBlock = $findNearestMarkdownCodeBlockNode(fence);
        if (codeBlock) $validate(codeBlock);
      },
    );

    return () => {
      removeBlockTransform();
      removeFenceTransform();
    };
  }, [editor]);
}
