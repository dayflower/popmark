import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { Settings } from "../types/settings";
import { codeToHotkeySegment, formatHotkey } from "../utils/hotkey";

export function SettingsPanel() {
  const [savedHotkey, setSavedHotkey] = useState("alt+m");
  const [capturedHotkey, setCapturedHotkey] = useState("alt+m");
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedSendShortcut, setSavedSendShortcut] = useState("super+enter");
  const [capturedSendShortcut, setCapturedSendShortcut] = useState("super+enter");
  const [isCapturingSend, setIsCapturingSend] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [copyAsRichText, setCopyAsRichText] = useState(false);
  const [notifyOnCopy, setNotifyOnCopy] = useState<boolean>(true);
  const [maxHistoryEntries, setMaxHistoryEntries] = useState<string>("");
  const [richFontFamily, setRichFontFamily] = useState<string>("");
  const [richFontSize, setRichFontSize] = useState<string>("");
  const [richFontFallback, setRichFontFallback] = useState<boolean>(true);
  const [plainFontFamily, setPlainFontFamily] = useState<string>("");
  const [plainFontSize, setPlainFontSize] = useState<string>("");
  const [plainFontFallback, setPlainFontFallback] = useState<boolean>(true);
  const [fontList, setFontList] = useState<string[]>([]);
  const captureBoxRef = useRef<HTMLButtonElement>(null);
  const sendCaptureBoxRef = useRef<HTMLButtonElement>(null);

  // Load settings on mount and whenever the settings window is shown
  useEffect(() => {
    function loadSettings() {
      invoke<Settings>("get_settings").then((s) => {
        setSavedHotkey(s.hotkey);
        setCapturedHotkey(s.hotkey);
        setLaunchAtLogin(s.launch_at_login);
        setCopyAsRichText(s.copy_as_rich_text);
        setNotifyOnCopy(s.notify_on_copy ?? true);
        const limit = s.max_history_entries;
        setMaxHistoryEntries(limit != null && limit > 0 ? String(limit) : "");
        setRichFontFamily(s.rich_font_family ?? "");
        setRichFontSize(s.rich_font_size != null ? String(s.rich_font_size) : "");
        setRichFontFallback(s.rich_font_fallback ?? false);
        setPlainFontFamily(s.plain_font_family ?? "");
        setPlainFontSize(s.plain_font_size != null ? String(s.plain_font_size) : "");
        setPlainFontFallback(s.plain_font_fallback ?? false);
        const sendShortcut = s.send_shortcut ?? "super+enter";
        setSavedSendShortcut(sendShortcut);
        setCapturedSendShortcut(sendShortcut);
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
      if (e.key === "Escape" && !isCapturing && !isCapturingSend) {
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

  function startCaptureSend() {
    setIsCapturingSend(true);
    sendCaptureBoxRef.current?.focus();
  }

  function handleSendCaptureKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setIsCapturingSend(false);
      setCapturedSendShortcut(savedSendShortcut);
      return;
    }

    if (["Alt", "Control", "Shift", "Meta", "Super"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("super");
    parts.push(codeToHotkeySegment(e.code));

    setCapturedSendShortcut(parts.join("+"));
    setIsCapturingSend(false);
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
        send_shortcut: capturedSendShortcut,
        notify_on_copy: notifyOnCopy,
      },
    });
    setSavedHotkey(capturedHotkey);
    setSavedSendShortcut(capturedSendShortcut);
    invoke("hide_settings_window");
  }

  function handleCancel() {
    setIsCapturing(false);
    setCapturedHotkey(savedHotkey);
    setIsCapturingSend(false);
    setCapturedSendShortcut(savedSendShortcut);
    invoke("hide_settings_window");
  }

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h2>

        {/* Global shortcut */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            Global Shortcut
          </span>
          {/* Hotkey capture box: a <button> that turns into a capture target when clicked */}
          <button
            ref={captureBoxRef}
            type="button"
            data-capture-box
            className={[
              "w-44 px-3 py-1.5 border rounded text-center font-mono text-sm select-none cursor-pointer",
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

        {/* Send to Clipboard Shortcut */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            Send to Clipboard Shortcut
          </span>
          <button
            ref={sendCaptureBoxRef}
            type="button"
            data-capture-box
            className={[
              "w-44 px-3 py-1.5 border rounded text-center font-mono text-sm select-none cursor-pointer",
              isCapturingSend
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500",
            ].join(" ")}
            onClick={isCapturingSend ? undefined : startCaptureSend}
            onKeyDown={isCapturingSend ? handleSendCaptureKeyDown : undefined}
            aria-label={
              isCapturingSend
                ? "Press the desired key combination"
                : `Current shortcut: ${capturedSendShortcut}`
            }
          >
            {isCapturingSend ? "Press shortcut…" : formatHotkey(capturedSendShortcut)}
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
        <div className="mb-3">
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

        {/* Notify on copy */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notifyOnCopy}
              onChange={(e) => setNotifyOnCopy(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Notify on copy</span>
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

        {/* Font settings: Rich | Plain in 2 columns */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Rich Mode Font */}
          <div>
            <datalist id="rich-font-family-list">
              {fontList.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rich Mode Font
            </p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                list="rich-font-family-list"
                value={richFontFamily}
                onChange={(e) => setRichFontFamily(e.target.value)}
                placeholder="Family…"
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min="1"
                value={richFontSize}
                onChange={(e) => setRichFontSize(e.target.value)}
                placeholder="px"
                className="w-14 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={richFontFallback}
                onChange={(e) => setRichFontFallback(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Append fallback fonts
              </span>
            </label>
          </div>

          {/* Plain Mode Font */}
          <div>
            <datalist id="plain-font-family-list">
              {fontList.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plain Mode Font
            </p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                list="plain-font-family-list"
                value={plainFontFamily}
                onChange={(e) => setPlainFontFamily(e.target.value)}
                placeholder="Family…"
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min="1"
                value={plainFontSize}
                onChange={(e) => setPlainFontSize(e.target.value)}
                placeholder="px"
                className="w-14 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={plainFontFallback}
                onChange={(e) => setPlainFontFallback(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Append fallback fonts
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
