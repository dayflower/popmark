import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { MarkdownEditor } from "./editor/MarkdownEditor";

type EditorMode = "rich" | "plain";

function App() {
  const [editorMode, setEditorMode] = useState<EditorMode>("rich");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    invoke<{ hotkey: string; launch_at_login: boolean; editor_mode: string }>("get_settings").then(
      (s) => {
        setEditorMode(s.editor_mode === "plain" ? "plain" : "rich");
        setSettingsLoaded(true);
      },
    );
  }, []);

  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
    invoke("save_editor_mode", { mode });
  }, []);

  if (!settingsLoaded) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900">
      <MarkdownEditor editorMode={editorMode} onModeChange={handleModeChange} />
    </div>
  );
}

export default App;
