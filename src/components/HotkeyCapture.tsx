import { invoke } from "@tauri-apps/api/core";
import { useRef } from "react";
import { codeToHotkeySegment, formatHotkey } from "../utils/hotkey";

interface HotkeyCaptureProps {
  label: string;
  captured: string;
  isCapturing: boolean;
  onCaptured: (hotkey: string) => void;
  onCancelCapture: () => void;
  onStartCapture: () => void;
  /** Call invoke("set_hotkey_capture_active") when starting/canceling capture */
  useSystemCapture?: boolean;
}

export function HotkeyCapture({
  label,
  captured,
  isCapturing,
  onCaptured,
  onCancelCapture,
  onStartCapture,
  useSystemCapture = false,
}: HotkeyCaptureProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleStart() {
    if (useSystemCapture) {
      invoke("set_hotkey_capture_active", { active: true });
    }
    onStartCapture();
    buttonRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      if (useSystemCapture) {
        invoke("set_hotkey_capture_active", { active: false });
      }
      onCancelCapture();
      return;
    }

    if (["Alt", "Control", "Shift", "Meta", "Super"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("super");
    parts.push(codeToHotkeySegment(e.code));

    if (useSystemCapture) {
      invoke("set_hotkey_capture_active", { active: false });
    }
    onCaptured(parts.join("+"));
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        data-capture-box
        className={[
          "w-44 px-3 py-1.5 border rounded text-center font-mono text-sm select-none cursor-pointer",
          isCapturing
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500",
        ].join(" ")}
        onClick={isCapturing ? undefined : handleStart}
        onKeyDown={isCapturing ? handleKeyDown : undefined}
        aria-label={
          isCapturing ? "Press the desired key combination" : `Current shortcut: ${captured}`
        }
      >
        {isCapturing ? "Press shortcut…" : formatHotkey(captured)}
      </button>
    </div>
  );
}
