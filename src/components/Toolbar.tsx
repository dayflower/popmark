import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";

export function Toolbar() {
  const [editor] = useLexicalComposerContext();

  function handleCopyAndClose() {
    editor.getEditorState().read(() => {
      const content = $convertToMarkdownString(TRANSFORMERS);
      invoke("copy_and_close", { content });
    });
  }

  return (
    // data-tauri-drag-region makes the toolbar area draggable (no native title bar)
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-gray-200 select-none"
      data-tauri-drag-region
    >
      <span className="text-sm font-medium text-gray-600" data-tauri-drag-region>
        popmark
      </span>
      <button
        type="button"
        onClick={handleCopyAndClose}
        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 cursor-default"
        title="Copy & Close (⌘Return)"
      >
        Copy &amp; Close
      </button>
    </div>
  );
}
