import { $convertFromMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $parseSerializedNode,
  createEditor,
} from "lexical";
import { EDITOR_NODES } from "../editor/nodes";
import { CUSTOM_TRANSFORMERS } from "../editor/transformers";
import type { Settings } from "../types/settings";
import { useCopyToClipboard } from "./useCopyToClipboard";
import { useMenuEvent } from "./useMenuEvent";

interface UseMenuEventListenersOptions {
  editorMode: "rich" | "plain";
  plainContent: string;
  copyAsRichText: boolean;
  setCopyAsRichText: (v: boolean) => void;
  setSendShortcut: (v: string) => void;
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
  plainContent,
  copyAsRichText,
  setCopyAsRichText,
  setSendShortcut,
  setIsHistoryOpen,
  onToggleHistory,
  onClearHistory,
  onNew,
  onExport,
  onPastePlainText,
  handleModeToggle,
  handleClearAll,
}: UseMenuEventListenersOptions) {
  const [editor] = useLexicalComposerContext();
  const { copyToClipboard } = useCopyToClipboard({
    editorMode,
    plainContent,
    copyAsRichText,
    editor,
  });

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
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    }
  }, [editor, editorMode, onPastePlainText]);

  useMenuEvent("menu-paste-from-markdown", async () => {
    const text = await invoke<string>("read_clipboard_text").catch(() => null);
    if (!text) return;
    if (editorMode === "plain") {
      onPastePlainText(text);
    } else {
      const tempEditor = createEditor({ nodes: EDITOR_NODES });
      await new Promise<void>((resolve) => {
        tempEditor.update(
          () => {
            $convertFromMarkdownString(text, CUSTOM_TRANSFORMERS);
          },
          { onUpdate: resolve },
        );
      });
      const { root } = tempEditor.getEditorState().toJSON();
      const serializedNodes = root.children;
      editor.update(() => {
        $insertNodes(serializedNodes.map((json) => $parseSerializedNode(json)));
      });
    }
  }, [editor, editorMode, onPastePlainText]);

  useMenuEvent("open-history-panel", () => setIsHistoryOpen(true), [setIsHistoryOpen]);

  useMenuEvent("menu-toggle-history", onToggleHistory, [onToggleHistory]);

  useMenuEvent<string>(
    "menu-set-editor-mode",
    (event) => {
      const targetMode = event.payload as "rich" | "plain";
      if (targetMode === editorMode) return;
      handleModeToggle();
    },
    [handleModeToggle, editorMode],
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
