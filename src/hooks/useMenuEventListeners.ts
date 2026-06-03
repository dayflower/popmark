import { $convertFromMarkdownString } from "@lexical/markdown";
import { invoke } from "@tauri-apps/api/core";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $parseSerializedNode,
  createEditor,
  type LexicalEditor,
} from "lexical";
import type { RefObject } from "react";
import { POPMARK_NODES, POPMARK_TRANSFORMERS } from "../editor/markdownTheme";
import type { EditorMode, Settings } from "../types/settings";
import { useMenuEvent } from "./useMenuEvent";

interface UseMenuEventListenersOptions {
  editorMode: EditorMode;
  editorRef: RefObject<LexicalEditor | null>;
  copyToClipboard: () => void;
  setCopyAsRichText: (v: boolean) => void;
  setSendShortcut: (v: string) => void;
  applyCopyFormat: (rich: boolean) => void;
  setIsHistoryOpen: (open: boolean) => void;
  onToggleHistory: () => void;
  onClearHistory: () => void;
  onNew: () => void;
  onExport: () => void;
  onPastePlainText: (text: string) => void;
  handleModeToggle: () => void;
  handleClearAll: () => void;
}

export function useMenuEventListeners({
  editorMode,
  editorRef,
  copyToClipboard,
  setCopyAsRichText,
  setSendShortcut,
  applyCopyFormat,
  setIsHistoryOpen,
  onToggleHistory,
  onClearHistory,
  onNew,
  onExport,
  onPastePlainText,
  handleModeToggle,
  handleClearAll,
}: UseMenuEventListenersOptions) {
  useMenuEvent("menu-new-document", onNew, [onNew]);

  useMenuEvent("menu-clear-all", handleClearAll, [handleClearAll]);

  useMenuEvent("menu-export", onExport, [onExport]);

  useMenuEvent("menu-send-to-clipboard", copyToClipboard, [copyToClipboard]);

  useMenuEvent("menu-paste-and-match-style", async () => {
    const text = await invoke<string>("read_clipboard_text").catch(() => null);
    if (text == null) return;
    if (editorMode === "plain") {
      onPastePlainText(text);
    } else {
      editorRef.current?.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    }
  }, [editorRef, editorMode, onPastePlainText]);

  useMenuEvent("menu-paste-from-markdown", async () => {
    const text = await invoke<string>("read_clipboard_text").catch(() => null);
    if (!text) return;
    if (editorMode === "plain") {
      onPastePlainText(text);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    // Parse the markdown in a throwaway editor, then splice the resulting
    // nodes into the live editor at the cursor.
    const tempEditor = createEditor({ nodes: POPMARK_NODES });
    await new Promise<void>((resolve) => {
      tempEditor.update(
        () => {
          $convertFromMarkdownString(text, POPMARK_TRANSFORMERS);
        },
        { onUpdate: resolve },
      );
    });
    const { root } = tempEditor.getEditorState().toJSON();
    const serializedNodes = root.children;
    editor.update(() => {
      $insertNodes(serializedNodes.map((json) => $parseSerializedNode(json)));
    });
  }, [editorRef, editorMode, onPastePlainText]);

  useMenuEvent("open-history-panel", () => setIsHistoryOpen(true), [setIsHistoryOpen]);

  useMenuEvent("menu-toggle-history", onToggleHistory, [onToggleHistory]);

  useMenuEvent<string>(
    "menu-set-editor-mode",
    (event) => {
      const targetMode = event.payload as EditorMode;
      if (targetMode === editorMode) return;
      handleModeToggle();
    },
    [handleModeToggle, editorMode],
  );

  useMenuEvent<string>(
    "menu-set-copy-format",
    (event) => {
      // Plain mode forces Markdown; ignore format changes there.
      if (editorMode === "plain") return;
      applyCopyFormat(event.payload === "rich");
    },
    [applyCopyFormat, editorMode],
  );

  useMenuEvent("menu-clear-history", onClearHistory, [onClearHistory]);

  useMenuEvent<Settings>(
    "settings-changed",
    (event) => {
      setCopyAsRichText(event.payload.copy_as_rich_text ?? false);
      setSendShortcut(event.payload.send_shortcut ?? "super+enter");
      // editor_mode not handled here — managed via handleModeToggle / save_editor_mode
    },
    [setCopyAsRichText, setSendShortcut],
  );
}
