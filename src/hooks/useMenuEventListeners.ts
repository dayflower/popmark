import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $parseSerializedNode,
  createEditor,
} from "lexical";
import { useEffect } from "react";
import { EDITOR_NODES } from "../editor/nodes";
import { CUSTOM_TRANSFORMERS } from "../editor/transformers";
import type { Settings } from "../types/settings";
import { useCopyToClipboard } from "./useCopyToClipboard";

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

  // Listen for menu bar "New Document" event
  useEffect(() => {
    const unlisten = listen("menu-new-document", () => {
      onNew();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onNew]);

  // Listen for Edit > Clear All menu event
  useEffect(() => {
    const unlisten = listen("menu-clear-all", () => {
      handleClearAll();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleClearAll]);

  // Listen for menu bar "Export…" event
  useEffect(() => {
    const unlisten = listen("menu-export", () => {
      if (editorMode === "plain") {
        invoke("export_file", { content: plainContent, defaultName: "note.md" });
      } else {
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          invoke("export_file", { content, defaultName: "note.md" });
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, plainContent]);

  // Listen for menu bar "Send to Clipboard" event
  useEffect(() => {
    const unlisten = listen("menu-send-to-clipboard", () => {
      copyToClipboard();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [copyToClipboard]);

  // Listen for "Paste and Match Style" menu event
  useEffect(() => {
    const unlisten = listen("menu-paste-and-match-style", async () => {
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
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, onPastePlainText]);

  // Listen for "Paste from Markdown" menu event
  useEffect(() => {
    const unlisten = listen("menu-paste-from-markdown", async () => {
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
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, onPastePlainText]);

  // Listen for "open-history-panel" event emitted by the tray menu (open-only)
  useEffect(() => {
    const unlisten = listen("open-history-panel", () => {
      setIsHistoryOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsHistoryOpen]);

  // Listen for menu bar View > History toggle event
  useEffect(() => {
    const unlisten = listen("menu-toggle-history", () => {
      onToggleHistory();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onToggleHistory]);

  // Listen for menu bar View > Editor Mode submenu events (⌘⇧M via native menu)
  useEffect(() => {
    const unlisten = listen<string>("menu-set-editor-mode", (event) => {
      const targetMode = event.payload as "rich" | "plain";
      if (targetMode === editorMode) return;
      handleModeToggle();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleModeToggle, editorMode]);

  // Listen for View > Clear History… menu event
  useEffect(() => {
    const unlisten = listen("menu-clear-history", () => {
      onClearHistory();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onClearHistory]);

  // Listen for settings-changed event emitted by the backend after save_settings
  useEffect(() => {
    const unlisten = listen<Settings>("settings-changed", (event) => {
      setCopyAsRichText(event.payload.copy_as_rich_text ?? false);
      setSendShortcut(event.payload.send_shortcut ?? "super+enter");
      // editor_mode not handled here — managed via handleModeToggle / save_editor_mode
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setCopyAsRichText, setSendShortcut]);
}
