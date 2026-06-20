import type { LexicalEditor } from "lexical";
import { useEffect } from "react";
import { DATA_ATTR } from "../constants";
import type { LinkClickBehavior } from "../plugins/linkClickBehavior";

// A click opens a link's URL, but a plain hover shows the text caret, so nothing
// hints the URL is clickable. Mark the root with `data-mod-pressed` whenever the
// open-click gesture is currently armed for a hovered link, so host CSS can swap
// a hovered link to a pointer cursor. The attribute's meaning tracks the open
// gesture, which depends on `behavior`:
// - "edit" (default): the open gesture is cmd/ctrl+click, so it is armed while
//   the modifier is held (the historical behavior).
// - "open": a plain click opens, so the gesture is armed by default (pointer
//   cursor at all times) and disarmed while the modifier — which now edits — is
//   held (text cursor).
// The state lives on the root (not per-node) so a single attribute toggle drives
// every link's cursor, and is shared by both link plugins.
export function useModifierCursorState(
  editor: LexicalEditor,
  behavior: LinkClickBehavior = "edit",
): void {
  useEffect(() => {
    const setPressed = (pressed: boolean) => {
      editor.getRootElement()?.toggleAttribute(DATA_ATTR.MOD_PRESSED, pressed);
    };

    // In "open" mode the open gesture is armed without a modifier, so the
    // pointer cursor should show by default and revert while the modifier
    // (edit) is held — the inverse of "edit" mode.
    const isArmed = (e: { metaKey: boolean; ctrlKey: boolean }) => {
      const modifier = e.metaKey || e.ctrlKey;
      return behavior === "open" ? !modifier : modifier;
    };

    // keydown/keyup both carry the post-event modifier state, so a single
    // handler covers pressing and releasing the modifier (and any other key
    // pressed while it is held).
    const handleKey = (e: KeyboardEvent) => {
      setPressed(isArmed(e));
    };
    // The resting state with no modifier held: armed in "open" mode (pointer by
    // default), disarmed in "edit" mode.
    const defaultArmed = behavior === "open";

    // A keyup can be missed when focus leaves the window mid-hold (e.g.
    // cmd+tab), which would strand the attribute; reset it to the resting state
    // on blur.
    const handleReset = () => {
      setPressed(defaultArmed);
    };

    // Reflect the resting state immediately so "open" mode hints a pointer
    // before any key event arrives.
    setPressed(defaultArmed);

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleReset);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleReset);
      setPressed(false);
    };
  }, [editor, behavior]);
}
