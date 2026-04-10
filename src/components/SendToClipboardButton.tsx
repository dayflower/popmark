import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { formatHotkey } from "../utils/hotkey";

export interface SendToClipboardButtonProps {
  editorMode: "rich" | "plain";
  plainContent: string;
  copyAsRichText: boolean;
  sendShortcut: string;
}

export function SendToClipboardButton({
  editorMode,
  plainContent,
  copyAsRichText,
  sendShortcut,
}: SendToClipboardButtonProps) {
  const [editor] = useLexicalComposerContext();
  const { copyToClipboard } = useCopyToClipboard({
    editorMode,
    plainContent,
    copyAsRichText,
    editor,
  });

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      className="bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 px-3 py-1.5 text-sm cursor-default"
    >
      Send to clipboard ({formatHotkey(sendShortcut)})
    </button>
  );
}
