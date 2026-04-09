import { $generateHtmlFromNodes } from "@lexical/html";
import { $convertToMarkdownString } from "@lexical/markdown";
import { invoke } from "@tauri-apps/api/core";
import type { LexicalEditor } from "lexical";
import { useCallback } from "react";
import { CUSTOM_TRANSFORMERS } from "../editor/transformers";

interface UseCopyToClipboardOptions {
  editorMode: "rich" | "plain";
  plainContent: string;
  copyAsRichText: boolean;
  editor?: LexicalEditor | null;
}

export function useCopyToClipboard({
  editorMode,
  plainContent,
  copyAsRichText,
  editor,
}: UseCopyToClipboardOptions) {
  const copyToClipboard = useCallback(() => {
    if (editorMode === "plain") {
      invoke("copy_to_clipboard", { content: plainContent });
      return;
    }
    if (!editor) return;
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
      const htmlContent = copyAsRichText ? $generateHtmlFromNodes(editor) : undefined;
      invoke("copy_to_clipboard", { content, htmlContent });
    });
  }, [editorMode, plainContent, copyAsRichText, editor]);

  return { copyToClipboard };
}
