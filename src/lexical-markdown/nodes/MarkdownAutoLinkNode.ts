import {
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type SerializedElementNode,
} from "lexical";
import type { MarkdownTheme } from "../config/editorConfig";
import { DATA_ATTR, NODE_TYPES } from "../constants";

// Inline ElementNode that decorates a bare URL. Unlike MarkdownLinkNode it
// keeps no state: its single child is a plain TextNode holding the raw URL, so
// `getTextContent()` is the URL. No literal Markdown delimiters means
// `@lexical/markdown` export recurses into the child and re-emits the raw URL,
// so the round-trip needs no dedicated export transformer.
export class MarkdownAutoLinkNode extends ElementNode {
  static override getType(): string {
    return NODE_TYPES.AUTO_LINK;
  }

  static override clone(node: MarkdownAutoLinkNode): MarkdownAutoLinkNode {
    return new MarkdownAutoLinkNode(node.__key);
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute(DATA_ATTR.AUTO_LINK, "");
    const className = (config.theme as MarkdownTheme).autoLink;
    if (className) dom.className = className;
    return dom;
  }

  override updateDOM(): boolean {
    return false;
  }

  // Emit a semantic anchor for HTML export (`$generateHtmlFromNodes`). The
  // child text is the URL, so build `<a href>` from it and skip the children
  // via `$getChildNodes` to avoid duplicating the text.
  override exportDOM(): DOMExportOutput {
    const url = this.getTextContent();
    const element = document.createElement("a");
    element.setAttribute("href", url);
    element.textContent = url;
    return { element, $getChildNodes: () => [] };
  }

  // Declared but returns null so it registers no `<a>` conversion: `<a>` import
  // stays the responsibility of MarkdownLinkNode.importDOM (folds into explicit
  // `[label](url)` text). Defining it also silences Lexical's "implement
  // importDOM when you have a custom exportDOM" warning.
  static override importDOM(): DOMConversionMap | null {
    return null;
  }

  static override importJSON(): MarkdownAutoLinkNode {
    return new MarkdownAutoLinkNode();
  }

  override exportJSON(): SerializedElementNode {
    return {
      ...super.exportJSON(),
      type: NODE_TYPES.AUTO_LINK,
      version: 1,
    };
  }

  override canBeEmpty(): false {
    return false;
  }

  override isInline(): true {
    return true;
  }
}

export function $createMarkdownAutoLinkNode(): MarkdownAutoLinkNode {
  return new MarkdownAutoLinkNode();
}

export function $isMarkdownAutoLinkNode(
  node: LexicalNode | null | undefined,
): node is MarkdownAutoLinkNode {
  return node instanceof MarkdownAutoLinkNode;
}
