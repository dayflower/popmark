import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { MarkdownEditor } from "./editor/MarkdownEditor";
import type { EditorMode, Settings } from "./types/settings";
import { composeFontFamily, PLAIN_FALLBACK_STACK, RICH_FALLBACK_STACK } from "./utils/font";

function App() {
  const [editorMode, setEditorMode] = useState<EditorMode>("rich");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [richFontFamily, setRichFontFamily] = useState<string | null>(null);
  const [richFontSize, setRichFontSize] = useState<number | null>(null);
  const [plainFontFamily, setPlainFontFamily] = useState<string | null>(null);
  const [plainFontSize, setPlainFontSize] = useState<number | null>(null);

  useEffect(() => {
    invoke<Settings>("get_settings").then((s) => {
      setEditorMode(s.editor_mode === "plain" ? "plain" : "rich");
      setRichFontFamily(
        composeFontFamily(s.rich_font_family, s.rich_font_fallback, RICH_FALLBACK_STACK),
      );
      setRichFontSize(s.rich_font_size ?? null);
      setPlainFontFamily(
        composeFontFamily(s.plain_font_family, s.plain_font_fallback, PLAIN_FALLBACK_STACK),
      );
      setPlainFontSize(s.plain_font_size ?? null);
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    const unlisten = listen<Settings>("settings-changed", (event) => {
      const s = event.payload;
      setRichFontFamily(
        composeFontFamily(s.rich_font_family, s.rich_font_fallback, RICH_FALLBACK_STACK),
      );
      setRichFontSize(s.rich_font_size ?? null);
      setPlainFontFamily(
        composeFontFamily(s.plain_font_family, s.plain_font_fallback, PLAIN_FALLBACK_STACK),
      );
      setPlainFontSize(s.plain_font_size ?? null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
    invoke("save_editor_mode", { mode });
  }, []);

  if (!settingsLoaded) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900">
      <MarkdownEditor
        editorMode={editorMode}
        onModeChange={handleModeChange}
        richFontFamily={richFontFamily}
        richFontSize={richFontSize}
        plainFontFamily={plainFontFamily}
        plainFontSize={plainFontSize}
      />
    </div>
  );
}

export default App;
