import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";

interface ToolbarProps {
  isHistoryOpen: boolean;
  onNew: () => void;
  onToggleHistory: () => void;
  editorMode: "rich" | "plain";
  onModeToggle: () => void;
  onSendToClipboard?: () => void;
  onExport?: () => void;
}

export function Toolbar({
  isHistoryOpen,
  onNew,
  onToggleHistory,
  editorMode,
  onModeToggle,
  onSendToClipboard,
  onExport,
}: ToolbarProps) {
  const [editor] = useLexicalComposerContext();

  function handleSendToClipboard() {
    if (onSendToClipboard) {
      onSendToClipboard();
      return;
    }
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      invoke("copy_to_clipboard", { content });
    });
  }

  function handleExport() {
    if (onExport) {
      onExport();
      return;
    }
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      invoke("export_file", { content, defaultName: "note.md" });
    });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none bg-white dark:bg-gray-900">
      <button
        type="button"
        onClick={onNew}
        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
        title="New document (⌘N)"
      >
        New
      </button>
      <button
        type="button"
        onClick={handleSendToClipboard}
        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 cursor-default"
        title="Send to Clipboard (⌘Return)"
      >
        Send to Clipboard
      </button>
      <button
        type="button"
        onClick={onToggleHistory}
        className={[
          "px-3 py-1 text-sm rounded cursor-default",
          isHistoryOpen
            ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
        ].join(" ")}
        title="Toggle history panel"
      >
        History
      </button>
      <button
        type="button"
        onClick={handleExport}
        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
        title="Export as Markdown file"
      >
        Export…
      </button>
      <button
        type="button"
        onClick={onModeToggle}
        className={[
          "px-3 py-1 text-sm rounded cursor-default ml-auto",
          editorMode === "plain"
            ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
        ].join(" ")}
        title="Toggle plain text mode (⌘⇧M)"
      >
        {editorMode === "plain" ? "Rich" : "Plain"}
      </button>
    </div>
  );
}
