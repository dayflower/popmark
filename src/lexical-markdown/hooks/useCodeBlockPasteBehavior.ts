import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  type LexicalEditor,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { $findNearestMarkdownCodeBlockNode } from "../nodes/codeBlockOps";

// Inside a code block, paste must behave like a plain-text insertion. The
// default rich-text handler turns external `text/html` into block-level nodes
// (paragraphs) and inserts them into the code block, which breaks its structure
// (and then gets unwrapped by the validation transform), so external pastes
// appear to do nothing. Internal pastes work only because they carry
// `application/x-lexical-editor` inline nodes. Forcing plain text here mirrors
// the official Lexical `CodeNode` paste behavior.
//
// Registered at CRITICAL so it short-circuits before MarkdownLinkPlugin's
// HIGH-priority handler; link-to-Markdown conversion must not run inside code.
export function useCodeBlockPasteBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const remove = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const codeBlock = $findNearestMarkdownCodeBlockNode(
          selection.anchor.getNode(),
        );
        if (!codeBlock) return false;

        const text = clipboardData.getData("text/plain");
        if (!text) return false;

        event.preventDefault();
        editor.update(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return;
          sel.insertRawText(text);
        });
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    return () => {
      remove();
    };
  }, [editor]);
}
