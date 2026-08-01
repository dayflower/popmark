import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { ColorScope, Settings, ThemeMode } from "../types/settings";
import { applyTheme } from "../utils/theme";
import { useMenuEvent } from "./useMenuEvent";

/**
 * Loads the persisted theme, keeps it in sync with settings changes and OS
 * appearance changes, and applies it to the document root. Call once per
 * window root (App.tsx, SettingsApp.tsx) — calling it again elsewhere would
 * duplicate the matchMedia/event subscriptions. Pure side effect; the actual
 * styling is driven by CSS reacting to the `data-theme-mode`/`data-color-scope`
 * attributes and `--popmark-*` custom properties this hook writes to
 * `document.documentElement` (see index.css and utils/theme.ts).
 */
export function useTheme(): void {
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [colorPreset, setColorPreset] = useState<string | null>(null);
  const [colorScope, setColorScope] = useState<ColorScope>("chrome");
  const [osDark, setOsDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const applyFromSettings = (s: Settings) => {
    setTheme((s.theme as ThemeMode) ?? "auto");
    setColorPreset(s.color_preset ?? null);
    setColorScope((s.color_scope as ColorScope) ?? "chrome");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: applyFromSettings is intentionally omitted — only run on mount
  useEffect(() => {
    invoke<Settings>("get_settings").then(applyFromSettings);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useMenuEvent<Settings>("settings-changed", (event) => applyFromSettings(event.payload));
  useMenuEvent("settings-window-shown", () => {
    invoke<Settings>("get_settings").then(applyFromSettings);
  });

  useEffect(() => {
    applyTheme(theme, colorPreset, colorScope, osDark);
  }, [theme, colorPreset, colorScope, osDark]);
}
