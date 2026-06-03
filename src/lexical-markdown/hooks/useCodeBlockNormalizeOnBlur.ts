import { $getNodeByKey, type LexicalEditor } from "lexical";
import { useEffect, useRef } from "react";
import {
  $extractValidCodeBlockInfo,
  $normalizeCodeBlock,
} from "../nodes/codeBlockOps";
import { $isMarkdownCodeBlockNode } from "../nodes/MarkdownCodeBlockNode";
import { $collectFocusedCodeBlockKeys } from "./focusedCodeBlockKeys";

export function useCodeBlockNormalizeOnBlur(editor: LexicalEditor): void {
  const focusedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState }) => {
        let current = new Set<string>();
        editorState.read(() => {
          current = $collectFocusedCodeBlockKeys();
        });

        const prev = focusedKeysRef.current;
        const exited = [...prev].filter((k) => !current.has(k));
        focusedKeysRef.current = current;

        if (exited.length === 0) return;

        editor.update(() => {
          for (const key of exited) {
            const node = $getNodeByKey(key);
            if (!$isMarkdownCodeBlockNode(node)) continue;
            const info = $extractValidCodeBlockInfo(node);
            if (!info) continue;
            $normalizeCodeBlock(node, info.language);
          }
        });
      },
    );

    return () => {
      removeUpdateListener();
    };
  }, [editor]);
}
