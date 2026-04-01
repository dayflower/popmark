import { $generateHtmlFromNodes } from "@lexical/html";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardCopy, FilePlus, PanelLeft } from "lucide-react";

interface ToolbarProps {
  isHistoryOpen: boolean;
  onNew: () => void;
  onToggleHistory: () => void;
  editorMode: "rich" | "plain";
  onModeToggle: () => void;
  onSendToClipboard?: () => void;
  copyAsRichText?: boolean;
}

export function Toolbar({
  isHistoryOpen,
  onNew,
  onToggleHistory,
  editorMode,
  onModeToggle,
  onSendToClipboard,
  copyAsRichText,
}: ToolbarProps) {
  const [editor] = useLexicalComposerContext();

  function handleSendToClipboard() {
    if (onSendToClipboard) {
      onSendToClipboard();
      return;
    }
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      const htmlContent = copyAsRichText ? $generateHtmlFromNodes(editor) : undefined;
      invoke("copy_to_clipboard", { content, htmlContent });
    });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none bg-white dark:bg-gray-900">
      <button
        type="button"
        onClick={onToggleHistory}
        className={[
          "p-1.5 rounded cursor-default text-gray-600 dark:text-gray-400",
          isHistoryOpen
            ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
        ].join(" ")}
        title="Toggle history panel"
      >
        <PanelLeft size={16} />
      </button>
      <button
        type="button"
        onClick={onNew}
        className="p-1.5 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
        title="New document (⌘N)"
      >
        <FilePlus size={16} />
      </button>
      <button
        type="button"
        onClick={handleSendToClipboard}
        className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 cursor-default"
        title="Send to Clipboard (⌘Return)"
      >
        <ClipboardCopy size={16} />
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
