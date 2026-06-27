import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { Settings } from "../types/settings";
import { CheckboxSetting } from "./CheckboxSetting";
import { FontSettings } from "./FontSettings";
import { HotkeyCapture } from "./HotkeyCapture";

// --- Font state ---

interface FontState {
  richFontFamily: string;
  richFontSize: string;
  richFontFallback: boolean;
  plainFontFamily: string;
  plainFontSize: string;
  plainFontFallback: boolean;
}

type FontMode = "rich" | "plain";

type FontAction =
  | { type: "setFamily"; mode: FontMode; value: string }
  | { type: "setSize"; mode: FontMode; value: string }
  | { type: "setFallback"; mode: FontMode; value: boolean }
  | { type: "reset"; state: FontState };

function fontReducer(state: FontState, action: FontAction): FontState {
  switch (action.type) {
    case "setFamily":
      return action.mode === "rich"
        ? { ...state, richFontFamily: action.value }
        : { ...state, plainFontFamily: action.value };
    case "setSize":
      return action.mode === "rich"
        ? { ...state, richFontSize: action.value }
        : { ...state, plainFontSize: action.value };
    case "setFallback":
      return action.mode === "rich"
        ? { ...state, richFontFallback: action.value }
        : { ...state, plainFontFallback: action.value };
    case "reset":
      return action.state;
  }
}

const initialFontState: FontState = {
  richFontFamily: "",
  richFontSize: "",
  richFontFallback: true,
  plainFontFamily: "",
  plainFontSize: "",
  plainFontFallback: true,
};

// --- Component ---

export function SettingsPanel() {
  const [savedHotkey, setSavedHotkey] = useState("alt+m");
  const [capturedHotkey, setCapturedHotkey] = useState("alt+m");
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedSendShortcut, setSavedSendShortcut] = useState("super+enter");
  const [capturedSendShortcut, setCapturedSendShortcut] = useState("super+enter");
  const [isCapturingSend, setIsCapturingSend] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [showDockIcon, setShowDockIcon] = useState<boolean>(true);
  const [notifyOnCopy, setNotifyOnCopy] = useState<boolean>(true);
  const [richShowSyntaxMarkers, setRichShowSyntaxMarkers] = useState<boolean>(true);
  const [richSyntaxHighlight, setRichSyntaxHighlight] = useState<boolean>(true);
  const [maxHistoryEntries, setMaxHistoryEntries] = useState<string>("");
  const [fontState, dispatchFont] = useReducer(fontReducer, initialFontState);
  const [fontList, setFontList] = useState<string[]>([]);

  // Load settings on mount and whenever the settings window is shown
  useEffect(() => {
    function loadSettings() {
      invoke<Settings>("get_settings").then((s) => {
        setSavedHotkey(s.hotkey);
        setCapturedHotkey(s.hotkey);
        setLaunchAtLogin(s.launch_at_login);
        setShowDockIcon(s.show_dock_icon ?? true);
        setNotifyOnCopy(s.notify_on_copy ?? true);
        setRichShowSyntaxMarkers(s.rich_show_syntax_markers ?? true);
        setRichSyntaxHighlight(s.rich_syntax_highlight ?? true);
        const limit = s.max_history_entries;
        setMaxHistoryEntries(limit != null && limit > 0 ? String(limit) : "");
        const sendShortcut = s.send_shortcut ?? "super+enter";
        setSavedSendShortcut(sendShortcut);
        setCapturedSendShortcut(sendShortcut);
        dispatchFont({
          type: "reset",
          state: {
            richFontFamily: s.rich_font_family ?? "",
            richFontSize: s.rich_font_size != null ? String(s.rich_font_size) : "",
            richFontFallback: s.rich_font_fallback ?? false,
            plainFontFamily: s.plain_font_family ?? "",
            plainFontSize: s.plain_font_size != null ? String(s.plain_font_size) : "",
            plainFontFallback: s.plain_font_fallback ?? false,
          },
        });
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

  const handleCancel = useCallback(() => {
    setIsCapturing(false);
    setCapturedHotkey(savedHotkey);
    setIsCapturingSend(false);
    setCapturedSendShortcut(savedSendShortcut);
    invoke("hide_settings_window");
  }, [savedHotkey, savedSendShortcut]);

  // ESC to cancel (when not capturing)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCapturing && !isCapturingSend) {
        handleCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCapturing, isCapturingSend, handleCancel]);

  async function handleSave() {
    const parsedLimit = Number.parseInt(maxHistoryEntries, 10);
    const parsedRichSize = Number.parseFloat(fontState.richFontSize);
    const parsedPlainSize = Number.parseFloat(fontState.plainFontSize);
    await invoke("save_settings", {
      settings: {
        hotkey: capturedHotkey,
        launch_at_login: launchAtLogin,
        show_dock_icon: showDockIcon,
        max_history_entries:
          maxHistoryEntries.trim() !== "" && parsedLimit > 0 ? parsedLimit : null,
        rich_font_family: fontState.richFontFamily.trim() || null,
        rich_font_size:
          fontState.richFontSize.trim() !== "" && parsedRichSize > 0 ? parsedRichSize : null,
        rich_font_fallback: fontState.richFontFallback,
        plain_font_family: fontState.plainFontFamily.trim() || null,
        plain_font_size:
          fontState.plainFontSize.trim() !== "" && parsedPlainSize > 0 ? parsedPlainSize : null,
        plain_font_fallback: fontState.plainFontFallback,
        send_shortcut: capturedSendShortcut,
        notify_on_copy: notifyOnCopy,
        rich_show_syntax_markers: richShowSyntaxMarkers,
        rich_syntax_highlight: richSyntaxHighlight,
      },
    });
    setSavedHotkey(capturedHotkey);
    setSavedSendShortcut(capturedSendShortcut);
    invoke("hide_settings_window");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h2>

        {/* Global shortcut */}
        <div className="mb-3">
          <HotkeyCapture
            label="Global Shortcut"
            captured={capturedHotkey}
            isCapturing={isCapturing}
            useSystemCapture
            onStartCapture={() => setIsCapturing(true)}
            onCaptured={(hotkey) => {
              setCapturedHotkey(hotkey);
              setIsCapturing(false);
            }}
            onCancelCapture={() => {
              setIsCapturing(false);
              setCapturedHotkey(savedHotkey);
            }}
          />
        </div>

        {/* Send to Clipboard Shortcut */}
        <div className="mb-4">
          <HotkeyCapture
            label="Send to Clipboard Shortcut"
            captured={capturedSendShortcut}
            isCapturing={isCapturingSend}
            onStartCapture={() => setIsCapturingSend(true)}
            onCaptured={(hotkey) => {
              setCapturedSendShortcut(hotkey);
              setIsCapturingSend(false);
            }}
            onCancelCapture={() => {
              setIsCapturingSend(false);
              setCapturedSendShortcut(savedSendShortcut);
            }}
          />
        </div>

        {/* Launch at login */}
        <CheckboxSetting
          checked={launchAtLogin}
          onChange={setLaunchAtLogin}
          label="Launch at login"
          className="mb-3"
        />

        {/* Show Dock icon */}
        <CheckboxSetting
          checked={showDockIcon}
          onChange={setShowDockIcon}
          label="Show Dock icon"
          className="mb-3"
        />

        {/* Notify on copy */}
        <CheckboxSetting
          checked={notifyOnCopy}
          onChange={setNotifyOnCopy}
          label="Notify on copy"
          className="mb-4"
        />

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

        {/* Show syntax markers in Rich Editor */}
        <CheckboxSetting
          checked={richShowSyntaxMarkers}
          onChange={setRichShowSyntaxMarkers}
          label={
            <>
              Show syntax markers{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">(Rich mode only)</span>
            </>
          }
          className="mb-3"
        />

        {/* Syntax highlight in Rich Editor */}
        <CheckboxSetting
          checked={richSyntaxHighlight}
          onChange={setRichSyntaxHighlight}
          label={
            <>
              Syntax highlight{" "}
              <span className="text-xs text-gray-400 dark:text-gray-500">
                (Rich mode, code blocks)
              </span>
            </>
          }
          className="mb-4"
        />

        {/* Font settings: Rich | Plain in 2 columns */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <FontSettings
            mode="rich"
            fontFamily={fontState.richFontFamily}
            fontSize={fontState.richFontSize}
            fontFallback={fontState.richFontFallback}
            fontList={fontList}
            onFontFamilyChange={(v) => dispatchFont({ type: "setFamily", mode: "rich", value: v })}
            onFontSizeChange={(v) => dispatchFont({ type: "setSize", mode: "rich", value: v })}
            onFontFallbackChange={(v) =>
              dispatchFont({ type: "setFallback", mode: "rich", value: v })
            }
          />
          <FontSettings
            mode="plain"
            fontFamily={fontState.plainFontFamily}
            fontSize={fontState.plainFontSize}
            fontFallback={fontState.plainFontFallback}
            fontList={fontList}
            onFontFamilyChange={(v) => dispatchFont({ type: "setFamily", mode: "plain", value: v })}
            onFontSizeChange={(v) => dispatchFont({ type: "setSize", mode: "plain", value: v })}
            onFontFallbackChange={(v) =>
              dispatchFont({ type: "setFallback", mode: "plain", value: v })
            }
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 px-6 pt-3 pb-6">
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
