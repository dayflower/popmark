// Selects which mouse gesture opens a link's URL vs. edits the link.
//
// - "edit" (default, historical): a plain click edits (places the caret /
//   reveals the markdown source) and cmd/ctrl+click opens the URL.
// - "open": a plain click opens the URL and cmd/ctrl+click edits.
export type LinkClickBehavior = "edit" | "open";

const hasModifier = (e: MouseEvent): boolean => e.metaKey || e.ctrlKey;

// Whether this click is meant to open the URL (vs. edit the link).
export function shouldOpenOnClick(
  e: MouseEvent,
  behavior: LinkClickBehavior,
): boolean {
  return behavior === "open" ? !hasModifier(e) : hasModifier(e);
}

// Whether the open gesture requires a modifier. The modifier-gated open path
// suppresses the caret-moving mousedown default so the link stays rendered; the
// plain-click open path must not (it would block a drag-selection that starts
// inside a link) and instead guards at click time. See drag-safety guard below.
export const opensViaModifier = (behavior: LinkClickBehavior): boolean =>
  behavior === "edit";

// Px the pointer may travel between mousedown and click before the gesture is
// treated as a drag (and therefore must not open the URL).
const DRAG_THRESHOLD_PX = 5;

// Tracks the pointer-down anchor for the plain-click open path so the click
// handler can tell an intentional click apart from a drag/selection.
export interface PointerDownAnchor {
  x: number;
  y: number;
  onLink: boolean;
}

// True when a click that landed on a link is an intentional open rather than a
// drag-selection or multi-click. Used only on the plain-click (no-modifier)
// open path; the modifier-gated open path keeps its caret-suppressing mousedown
// and needs no guard. The two checks are complementary: the movement threshold
// catches large drags that may end collapsed, and the collapsed-selection check
// catches small deliberate selections under the threshold.
export function isIntentionalOpenClick(
  e: MouseEvent,
  anchor: PointerDownAnchor | null,
): boolean {
  if (e.button !== 0) return false; // primary button only
  if (e.detail !== 1) return false; // skip double/triple click
  if (!anchor?.onLink) return false; // must have started on the link
  if (
    Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > DRAG_THRESHOLD_PX
  )
    return false; // dragged: leave the selection alone
  const selection =
    typeof window !== "undefined" ? window.getSelection() : null;
  if (selection && !selection.isCollapsed) return false; // text was selected
  return true;
}
