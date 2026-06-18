import type { LexicalEditor } from "lexical";
import { useEffect } from "react";
import { DATA_ATTR } from "../constants";

// A cmd/ctrl+click opens a link's URL, but a plain hover shows the text caret,
// so nothing hints the URL is clickable. Mark the root while the modifier is
// held so host CSS can swap a hovered link to a pointer cursor — the same
// `metaKey || ctrlKey` gate the click handlers use. The state lives on the root
// (not per-node) so a single attribute toggle drives every link's cursor, and
// is shared by both the explicit-link and auto-link plugins.
export function useModifierCursorState(editor: LexicalEditor): void {
  useEffect(() => {
    const setPressed = (pressed: boolean) => {
      editor.getRootElement()?.toggleAttribute(DATA_ATTR.MOD_PRESSED, pressed);
    };

    // keydown/keyup both carry the post-event modifier state, so a single
    // handler covers pressing and releasing the modifier (and any other key
    // pressed while it is held).
    const handleKey = (e: KeyboardEvent) => {
      setPressed(e.metaKey || e.ctrlKey);
    };
    // A keyup can be missed when focus leaves the window mid-hold (e.g.
    // cmd+tab), which would strand the attribute; clear it on blur.
    const handleReset = () => {
      setPressed(false);
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleReset);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleReset);
      setPressed(false);
    };
  }, [editor]);
}
