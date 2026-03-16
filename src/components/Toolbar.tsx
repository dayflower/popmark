import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";

interface ToolbarProps {
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onOpenSettings: () => void;
}

export function Toolbar({ isHistoryOpen, onToggleHistory, onOpenSettings }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();

  function handleCopyAndClose() {
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      invoke("copy_and_close", { content });
    });
  }

  function handleExport() {
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      invoke("export_file", { content, defaultName: "note.md" });
    });
  }

  return (
    // data-tauri-drag-region makes the toolbar area draggable (no native title bar)
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none bg-white dark:bg-gray-900"
      data-tauri-drag-region
    >
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400" data-tauri-drag-region>
        popmark
      </span>
      <div className="flex items-center gap-2">
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
          onClick={onOpenSettings}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
          title="Settings"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={handleCopyAndClose}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 cursor-default"
          title="Copy & Close (⌘Return)"
        >
          Copy &amp; Close
        </button>
      </div>
    </div>
  );
}
