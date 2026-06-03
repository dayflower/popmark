import type { LexicalEditor, NodeKey } from "lexical";
import { DATA_ATTR } from "../constants";

// Toggles the shared `data-focused` attribute on the DOM elements matching
// `selector` based on the node keys returned by `$collectKeys` (evaluated
// against the current selection). Used by both the link and code-block plugins
// to highlight the block the caret currently sits in. `selector` is a complete
// CSS selector (e.g. `[data-markdown-code-block]`).
export function registerFocusClassListener(
  editor: LexicalEditor,
  selector: string,
  $collectKeys: () => Set<NodeKey>,
): () => void {
  return editor.registerUpdateListener(({ editorState }) => {
    let focusedKeys = new Set<NodeKey>();
    editorState.read(() => {
      focusedKeys = $collectKeys();
    });

    const root = editor.getRootElement();
    if (!root) return;
    root.querySelectorAll(selector).forEach((dom) => {
      dom.removeAttribute(DATA_ATTR.FOCUSED);
    });
    focusedKeys.forEach((key) => {
      editor.getElementByKey(key)?.setAttribute(DATA_ATTR.FOCUSED, "");
    });
  });
}
