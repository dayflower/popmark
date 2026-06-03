import { $convertToMarkdownString } from "@lexical/markdown";
import { invoke } from "@tauri-apps/api/core";
import type { LexicalEditor } from "lexical";
import { type RefObject, useCallback } from "react";
import { POPMARK_TRANSFORMERS } from "../editor/markdownTheme";
import { markdownToHtml } from "../editor/markdownToHtml";
import type { EditorMode } from "../types/settings";

interface UseCopyToClipboardOptions {
  editorMode: EditorMode;
  content: string;
  copyAsRichText: boolean;
  editorRef: RefObject<LexicalEditor | null>;
}

export function useCopyToClipboard({
  editorMode,
  content,
  copyAsRichText,
  editorRef,
}: UseCopyToClipboardOptions) {
  const copyToClipboard = useCallback(() => {
    const editor = editorRef.current;
    // Plain mode (or no live editor): the markdown string is authoritative.
    // Rich mode: read the latest markdown from the live editor so a copy issued
    // mid-keystroke reflects the current state.
    const markdown =
      editorMode === "plain" || !editor
        ? content
        : editor.getEditorState().read(() => $convertToMarkdownString(POPMARK_TRANSFORMERS));

    // HTML for rich paste is generated from the markdown through standard
    // Lexical nodes (clean semantic HTML), not the source-visible live editor.
    const htmlContent =
      copyAsRichText && editorMode === "rich" ? markdownToHtml(markdown) : undefined;
    invoke("copy_to_clipboard", { content: markdown, htmlContent });
  }, [editorMode, content, copyAsRichText, editorRef]);

  return { copyToClipboard };
}
