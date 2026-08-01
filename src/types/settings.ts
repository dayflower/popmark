export type EditorMode = "rich" | "plain";

export type ThemeMode = "auto" | "light" | "dark" | "color";
export type ColorScope = "chrome" | "window";

export interface Settings {
  hotkey: string;
  launch_at_login: boolean;
  editor_mode: string;
  copy_as_rich_text: boolean;
  max_history_entries?: number | null;
  rich_font_family?: string | null;
  rich_font_size?: number | null;
  plain_font_family?: string | null;
  plain_font_size?: number | null;
  rich_font_fallback?: boolean;
  plain_font_fallback?: boolean;
  send_shortcut?: string;
  notify_on_copy?: boolean;
  rich_show_syntax_markers?: boolean;
  rich_syntax_highlight?: boolean;
  show_dock_icon?: boolean;
  theme?: string;
  color_preset?: string | null;
  color_scope?: string;
}
