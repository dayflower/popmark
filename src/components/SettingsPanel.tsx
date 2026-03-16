import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

interface Settings {
  hotkey: string;
  launch_at_login: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Map a keyboard Code (e.g. "KeyM", "Space") to the hotkey segment (e.g. "m", "space")
function codeToHotkeySegment(code: string): string {
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  return code.toLowerCase();
}

// Format a stored hotkey string (e.g. "alt+m") as macOS symbols (e.g. "⌥M")
function formatHotkey(hotkey: string): string {
  return hotkey
    .split("+")
    .map((part) => {
      switch (part.toLowerCase()) {
        case "ctrl":
        case "control":
          return "⌃";
        case "alt":
          return "⌥";
        case "shift":
          return "⇧";
        case "meta":
        case "super":
        case "cmd":
        case "command":
          return "⌘";
        case "space":
          return "Space";
        default:
          return part.toUpperCase();
      }
    })
    .join("");
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [savedHotkey, setSavedHotkey] = useState("alt+m");
  const [capturedHotkey, setCapturedHotkey] = useState("alt+m");
  const [isCapturing, setIsCapturing] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load current settings when panel opens
  useEffect(() => {
    if (!isOpen) return;
    invoke<Settings>("get_settings").then((s) => {
      setSavedHotkey(s.hotkey);
      setCapturedHotkey(s.hotkey);
      setLaunchAtLogin(s.launch_at_login);
    });
    // Focus the dialog so ESC works immediately
    dialogRef.current?.focus();
  }, [isOpen]);

  // ESC to close (when not capturing)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCapturing) {
        handleCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function startCapture() {
    setIsCapturing(true);
    dialogRef.current?.querySelector<HTMLElement>("[data-capture-box]")?.focus();
  }

  function handleCaptureKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setIsCapturing(false);
      setCapturedHotkey(savedHotkey);
      return;
    }

    // Ignore modifier-only presses
    if (["Alt", "Control", "Shift", "Meta", "Super"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("super");
    parts.push(codeToHotkeySegment(e.code));

    setCapturedHotkey(parts.join("+"));
    setIsCapturing(false);
  }

  async function handleSave() {
    await invoke("save_settings", {
      settings: { hotkey: capturedHotkey, launch_at_login: launchAtLogin },
    });
    setSavedHotkey(capturedHotkey);
    onClose();
  }

  function handleCancel() {
    setIsCapturing(false);
    setCapturedHotkey(savedHotkey);
    onClose();
  }

  if (!isOpen) return null;

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center">
      {/* Dialog box */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 outline-none"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h2>

        {/* Global shortcut */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Global Shortcut
          </p>
          {/* Hotkey capture box: a <button> that turns into a capture target when clicked */}
          <button
            type="button"
            data-capture-box
            className={[
              "w-full px-3 py-2 border rounded text-center font-mono text-sm select-none cursor-pointer",
              isCapturing
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500",
            ].join(" ")}
            onClick={isCapturing ? undefined : startCapture}
            onKeyDown={isCapturing ? handleCaptureKeyDown : undefined}
            aria-label={
              isCapturing
                ? "Press the desired key combination"
                : `Current shortcut: ${capturedHotkey}`
            }
          >
            {isCapturing ? "Press shortcut…" : formatHotkey(capturedHotkey)}
          </button>
        </div>

        {/* Launch at login */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => setLaunchAtLogin(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Launch at login</span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 cursor-default"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 cursor-default"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
