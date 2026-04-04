import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { Settings } from "../types/settings";

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

export function SettingsPanel() {
  const [savedHotkey, setSavedHotkey] = useState("alt+m");
  const [capturedHotkey, setCapturedHotkey] = useState("alt+m");
  const [isCapturing, setIsCapturing] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [copyAsRichText, setCopyAsRichText] = useState(false);
  const [maxHistoryEntries, setMaxHistoryEntries] = useState<string>("");
  const [richFontFamily, setRichFontFamily] = useState<string>("");
  const [richFontSize, setRichFontSize] = useState<string>("");
  const [richFontFallback, setRichFontFallback] = useState<boolean>(true);
  const [plainFontFamily, setPlainFontFamily] = useState<string>("");
  const [plainFontSize, setPlainFontSize] = useState<string>("");
  const [plainFontFallback, setPlainFontFallback] = useState<boolean>(true);
  const [fontList, setFontList] = useState<string[]>([]);
  const captureBoxRef = useRef<HTMLButtonElement>(null);

  // Load settings on mount and whenever the settings window is shown
  useEffect(() => {
    function loadSettings() {
      invoke<Settings>("get_settings").then((s) => {
        setSavedHotkey(s.hotkey);
        setCapturedHotkey(s.hotkey);
        setLaunchAtLogin(s.launch_at_login);
        setCopyAsRichText(s.copy_as_rich_text);
        const limit = s.max_history_entries;
        setMaxHistoryEntries(limit != null && limit > 0 ? String(limit) : "");
        setRichFontFamily(s.rich_font_family ?? "");
        setRichFontSize(s.rich_font_size != null ? String(s.rich_font_size) : "");
        setRichFontFallback(s.rich_font_fallback ?? false);
        setPlainFontFamily(s.plain_font_family ?? "");
        setPlainFontSize(s.plain_font_size != null ? String(s.plain_font_size) : "");
        setPlainFontFallback(s.plain_font_fallback ?? false);
      });
    }

    loadSettings();

    // Fetch system font list once on mount (stable within an app session)
    invoke<string[]>("list_fonts").then((fonts) => setFontList(fonts));

    const unlisten = listen("settings-window-shown", () => loadSettings());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ESC to cancel (when not capturing)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCapturing) {
        handleCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function startCapture() {
    invoke("set_hotkey_capture_active", { active: true });
    setIsCapturing(true);
    captureBoxRef.current?.focus();
  }

  function handleCaptureKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      invoke("set_hotkey_capture_active", { active: false });
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
    invoke("set_hotkey_capture_active", { active: false });
    setIsCapturing(false);
  }

  async function handleSave() {
    const parsedLimit = Number.parseInt(maxHistoryEntries, 10);
    const parsedRichSize = Number.parseFloat(richFontSize);
    const parsedPlainSize = Number.parseFloat(plainFontSize);
    await invoke("save_settings", {
      settings: {
        hotkey: capturedHotkey,
        launch_at_login: launchAtLogin,
        copy_as_rich_text: copyAsRichText,
        max_history_entries:
          maxHistoryEntries.trim() !== "" && parsedLimit > 0 ? parsedLimit : null,
        rich_font_family: richFontFamily.trim() || null,
        rich_font_size: richFontSize.trim() !== "" && parsedRichSize > 0 ? parsedRichSize : null,
        rich_font_fallback: richFontFallback,
        plain_font_family: plainFontFamily.trim() || null,
        plain_font_size:
          plainFontSize.trim() !== "" && parsedPlainSize > 0 ? parsedPlainSize : null,
        plain_font_fallback: plainFontFallback,
      },
    });
    setSavedHotkey(capturedHotkey);
    invoke("hide_settings_window");
  }

  function handleCancel() {
    setIsCapturing(false);
    setCapturedHotkey(savedHotkey);
    invoke("hide_settings_window");
  }

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h2>

        {/* Global shortcut */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Global Shortcut
          </p>
          {/* Hotkey capture box: a <button> that turns into a capture target when clicked */}
          <button
            ref={captureBoxRef}
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
        <div className="mb-3">
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

        {/* Copy as Rich Text */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={copyAsRichText}
              onChange={(e) => setCopyAsRichText(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Copy as Rich Text{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">(Rich mode only)</span>
            </span>
          </label>
        </div>

        {/* Max history entries */}
        <div className="mb-4">
          <label className="flex items-center justify-between gap-3 select-none">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Max history entries{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">(0 = unlimited)</span>
            </span>
            <input
              type="number"
              min="0"
              value={maxHistoryEntries}
              onChange={(e) => setMaxHistoryEntries(e.target.value)}
              placeholder="∞"
              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
            />
          </label>
        </div>

        {/* Rich Mode Font */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Rich Mode Font
          </p>
          <datalist id="rich-font-family-list">
            {fontList.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Family</span>
            <input
              type="text"
              list="rich-font-family-list"
              value={richFontFamily}
              onChange={(e) => setRichFontFamily(e.target.value)}
              placeholder="Inter, serif, …"
              className="w-48 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Size{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">(px)</span>
            </span>
            <input
              type="number"
              min="1"
              value={richFontSize}
              onChange={(e) => setRichFontSize(e.target.value)}
              placeholder="14"
              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={richFontFallback}
                onChange={(e) => setRichFontFallback(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Append standard fallback fonts
              </span>
            </label>
          </div>
        </div>

        {/* Plain Mode Font */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Plain Mode Font
          </p>
          <datalist id="plain-font-family-list">
            {fontList.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Family</span>
            <input
              type="text"
              list="plain-font-family-list"
              value={plainFontFamily}
              onChange={(e) => setPlainFontFamily(e.target.value)}
              placeholder='"Courier New", monospace, …'
              className="w-48 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Size{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">(px)</span>
            </span>
            <input
              type="number"
              min="1"
              value={plainFontSize}
              onChange={(e) => setPlainFontSize(e.target.value)}
              placeholder="14"
              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={plainFontFallback}
                onChange={(e) => setPlainFontFallback(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Append standard fallback fonts
              </span>
            </label>
          </div>
        </div>
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
  );
}
