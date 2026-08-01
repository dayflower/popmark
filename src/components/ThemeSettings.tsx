import { Check } from "lucide-react";
import type { ColorScope, ThemeMode } from "../types/settings";
import { THEME_PRESETS } from "../utils/theme";

interface ThemeSettingsProps {
  theme: ThemeMode;
  colorPreset: string | null;
  colorScope: ColorScope;
  onThemeChange: (theme: ThemeMode) => void;
  onPresetChange: (presetId: string) => void;
  onScopeChange: (scope: ColorScope) => void;
}

const THEME_MODES: { mode: ThemeMode; label: string }[] = [
  { mode: "auto", label: "Auto" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "color", label: "Color" },
];

const COLOR_SCOPES: { scope: ColorScope; label: string }[] = [
  { scope: "chrome", label: "Title bar" },
  { scope: "window", label: "Whole window" },
];

export function ThemeSettings({
  theme,
  colorPreset,
  colorScope,
  onThemeChange,
  onPresetChange,
  onScopeChange,
}: ThemeSettingsProps) {
  return (
    <div className="mb-4">
      <span className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Appearance</span>
      <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
        {THEME_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onThemeChange(mode)}
            className={[
              "px-3 py-1.5 text-sm cursor-default",
              theme === mode
                ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {theme === "color" && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetChange(preset.id)}
                title={preset.label}
                aria-label={preset.label}
                style={{ backgroundColor: preset.swatchColor }}
                className={[
                  "w-6 h-6 rounded-full flex items-center justify-center cursor-default ring-offset-2 ring-offset-white dark:ring-offset-gray-800",
                  colorPreset === preset.id ? "ring-2 ring-gray-500 dark:ring-gray-300" : "",
                ].join(" ")}
              >
                {colorPreset === preset.id && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
          <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
            {COLOR_SCOPES.map(({ scope, label }) => (
              <button
                key={scope}
                type="button"
                onClick={() => onScopeChange(scope)}
                className={[
                  "px-3 py-1.5 text-sm cursor-default",
                  colorScope === scope
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
