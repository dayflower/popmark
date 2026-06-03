import { formatHotkey } from "../utils/hotkey";

export interface SendToClipboardButtonProps {
  onSend: () => void;
  sendShortcut: string;
}

export function SendToClipboardButton({ onSend, sendShortcut }: SendToClipboardButtonProps) {
  return (
    <button
      type="button"
      onClick={onSend}
      className="bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 px-3 py-1.5 text-sm cursor-default"
    >
      Send to clipboard ({formatHotkey(sendShortcut)})
    </button>
  );
}
