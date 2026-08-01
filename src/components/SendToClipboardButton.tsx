import { useEffect, useRef, useState } from "react";
import type { EditorMode } from "../types/settings";
import { formatHotkey } from "../utils/hotkey";

export interface SendToClipboardButtonProps {
  onSend: () => void;
  sendShortcut: string;
  copyAsRichText: boolean;
  editorMode: EditorMode;
  onSetCopyFormat: (rich: boolean) => void;
}

export function SendToClipboardButton({
  onSend,
  sendShortcut,
  copyAsRichText,
  editorMode,
  onSetCopyFormat,
}: SendToClipboardButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Plain mode forces Markdown; the rich preference only applies in rich mode.
  const isRich = copyAsRichText && editorMode === "rich";
  const dropdownDisabled = editorMode === "plain";
  const label = isRich ? "Send Rich Text to Clipboard" : "Send Markdown to Clipboard";

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function choose(rich: boolean) {
    onSetCopyFormat(rich);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={onSend}
        className="bg-(--popmark-primary) text-white rounded-l hover:bg-(--popmark-primary-hover) active:bg-(--popmark-primary-active) px-3 py-1.5 text-sm cursor-default"
      >
        {label} ({formatHotkey(sendShortcut)})
      </button>
      <button
        type="button"
        aria-label="Choose copy format"
        disabled={dropdownDisabled}
        onClick={() => setOpen((v) => !v)}
        className="bg-(--popmark-primary) text-white rounded-r border-l border-(--popmark-primary-divider) hover:bg-(--popmark-primary-hover) active:bg-(--popmark-primary-active) px-2 py-1.5 text-sm cursor-default disabled:opacity-50"
      >
        <span aria-hidden="true">▾</span>
      </button>
      {open && !dropdownDisabled && (
        <div className="absolute bottom-full right-0 mb-1 min-w-44 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 text-sm text-gray-900 dark:text-gray-100 z-10">
          <CopyFormatItem label="Rich text" checked={isRich} onClick={() => choose(true)} />
          <CopyFormatItem label="Markdown" checked={!isRich} onClick={() => choose(false)} />
        </div>
      )}
    </div>
  );
}

interface CopyFormatItemProps {
  label: string;
  checked: boolean;
  onClick: () => void;
}

function CopyFormatItem({ label, checked, onClick }: CopyFormatItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-default hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <span className="w-4 shrink-0 text-(--popmark-primary)">{checked ? "✓" : ""}</span>
      {label}
    </button>
  );
}
