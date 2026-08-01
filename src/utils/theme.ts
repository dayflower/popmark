import type { ColorScope, ThemeMode } from "../types/settings";

export interface ColorPreset {
  id: string;
  label: string;
  /** Vivid color for the preset swatch picker, and the app's primary UI
   * accent (buttons, checkboxes) when this preset is active. */
  swatchColor: string;
  /** Toolbar / settings-header background — a soft, low-saturation tint. */
  accent: string;
  /** Toolbar / settings-header border — one step deeper than accent. */
  accentBorder: string;
  /** Very light wash used for the editing surface (and footer) in "window"
   * scope, so the main area reads as a soft tint rather than a solid block. */
  surfaceTint: string;
}

export const THEME_PRESETS: ColorPreset[] = [
  {
    id: "red",
    label: "Red",
    swatchColor: "#ef4444",
    accent: "#fecaca",
    accentBorder: "#fca5a5",
    surfaceTint: "#fef2f2",
  },
  {
    id: "orange",
    label: "Orange",
    swatchColor: "#f97316",
    accent: "#fed7aa",
    accentBorder: "#fdba74",
    surfaceTint: "#fff7ed",
  },
  {
    id: "yellow",
    label: "Yellow",
    swatchColor: "#eab308",
    accent: "#fef08a",
    accentBorder: "#fde047",
    surfaceTint: "#fefce8",
  },
  {
    id: "green",
    label: "Green",
    swatchColor: "#22c55e",
    accent: "#bbf7d0",
    accentBorder: "#86efac",
    surfaceTint: "#f0fdf4",
  },
  {
    id: "blue",
    label: "Blue",
    swatchColor: "#3b82f6",
    accent: "#bfdbfe",
    accentBorder: "#93c5fd",
    surfaceTint: "#eff6ff",
  },
  {
    id: "purple",
    label: "Purple",
    swatchColor: "#8b5cf6",
    accent: "#ddd6fe",
    accentBorder: "#c4b5fd",
    surfaceTint: "#f5f3ff",
  },
  {
    id: "slate",
    label: "Slate",
    swatchColor: "#64748b",
    accent: "#e2e8f0",
    accentBorder: "#cbd5e1",
    surfaceTint: "#f8fafc",
  },
];

export function resolvePreset(id: string | null | undefined): ColorPreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

/**
 * Applies the resolved theme to the document root as CSS custom properties,
 * a `dark` class, and `data-theme-mode`/`data-color-scope` attributes. Pure
 * DOM side effect — no IPC, no React — so it can be called both from the
 * persisted-settings-driven useTheme hook and from live-preview UI code.
 */
export function applyTheme(
  theme: ThemeMode,
  colorPreset: string | null | undefined,
  colorScope: ColorScope,
  osDark: boolean,
): void {
  const root = document.documentElement;
  const effectiveDark = theme === "dark" || (theme === "auto" && osDark);

  root.classList.toggle("dark", effectiveDark);
  root.dataset.themeMode = theme;

  if (theme === "color") {
    const preset = resolvePreset(colorPreset);
    root.style.setProperty("--popmark-accent", preset.accent);
    root.style.setProperty("--popmark-accent-border", preset.accentBorder);
    root.style.setProperty("--popmark-surface-tint", preset.surfaceTint);
    root.style.setProperty("--popmark-primary", preset.swatchColor);
    root.dataset.colorScope = colorScope;
  } else {
    root.style.removeProperty("--popmark-accent");
    root.style.removeProperty("--popmark-accent-border");
    root.style.removeProperty("--popmark-surface-tint");
    root.style.removeProperty("--popmark-primary");
    delete root.dataset.colorScope;
  }
}
