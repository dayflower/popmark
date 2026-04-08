// Map a keyboard Code (e.g. "KeyM", "Space") to the hotkey segment (e.g. "m", "space")
export function codeToHotkeySegment(code: string): string {
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  return code.toLowerCase();
}

// Format a stored hotkey string (e.g. "super+enter") as symbols (e.g. "⌘↵")
export function formatHotkey(hotkey: string): string {
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
        case "enter":
        case "return":
          return "↵";
        case "space":
          return "Space";
        default:
          return part.toUpperCase();
      }
    })
    .join("");
}
