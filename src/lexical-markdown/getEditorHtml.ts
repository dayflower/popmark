import { $generateHtmlFromNodes } from "@lexical/html";
import type { BaseSelection, LexicalEditor } from "lexical";

// `$generateHtmlFromNodes` and the nodes' `exportDOM` call `document.*`, so a
// DOM must exist. Throw a clear, actionable error instead of a cryptic
// `ReferenceError: document is not defined`.
export function assertDomAvailable(fnName: string): void {
  if (typeof document === "undefined") {
    throw new Error(
      `${fnName} requires a DOM: it serializes nodes via document.createElement. ` +
        "In the browser this works out of the box; in Node, set up a DOM shim " +
        "(e.g. jsdom or happy-dom) and assign it to globalThis.document before calling.",
    );
  }
}

/**
 * Serializes a live editor's current content to semantic HTML.
 *
 * A thin wrapper around the standard `$generateHtmlFromNodes` that handles the
 * required `editor.read()` so callers don't have to import `@lexical/html` or
 * remember the read wrapper. Pair it with `LexicalMarkdownEditor`'s `editorRef`
 * prop:
 *
 * ```ts
 * const html = getEditorHtml(editorRef.current);
 * ```
 *
 * Pass a `selection` to export only the selected nodes. Requires a DOM
 * (`document`); see `markdownToHtml` for the Node caveat.
 */
export function getEditorHtml(
  editor: LexicalEditor,
  selection?: BaseSelection | null,
): string {
  assertDomAvailable("getEditorHtml");
  return editor.read(() => $generateHtmlFromNodes(editor, selection));
}
