import {
  $createTextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";
import type { MarkdownTheme } from "../config/editorConfig";
import { DATA_ATTR, NODE_TYPES } from "../constants";
import {
  escapeLinkLabel,
  escapeLinkUrl,
  unescapeMarkdown,
} from "../markdownLinkEscape";
import { $restoreTextNodeProps } from "./textNodeSerialization";

export type SerializedMarkdownLinkNode = Spread<
  { url: string; label: string },
  SerializedElementNode
>;

export class MarkdownLinkNode extends ElementNode {
  __url: string;
  __label: string;

  static getType(): string {
    return NODE_TYPES.LINK;
  }

  static clone(node: MarkdownLinkNode): MarkdownLinkNode {
    return new MarkdownLinkNode(node.__label, node.__url, node.__key);
  }

  constructor(label: string, url: string, key?: NodeKey) {
    super(key);
    this.__label = label;
    this.__url = url;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("span");
    dom.setAttribute(DATA_ATTR.LINK, "");
    dom.setAttribute("data-url", unescapeMarkdown(this.__url));
    dom.setAttribute("data-label", this.__label);
    const className = (config.theme as MarkdownTheme).link;
    if (className) dom.className = className;
    return dom;
  }

  updateDOM(prevNode: MarkdownLinkNode, dom: HTMLElement): boolean {
    if (prevNode.__url !== this.__url) {
      dom.setAttribute("data-url", unescapeMarkdown(this.__url));
    }
    if (prevNode.__label !== this.__label) {
      dom.setAttribute("data-label", this.__label);
    }
    return false;
  }

  // Emit a semantic anchor for HTML export (`$generateHtmlFromNodes`). The
  // editing children are the literal Markdown syntax (`[`, label, `](`, url,
  // `)`), so skip them via `$getChildNodes` and build `<a>` from the stored
  // url/label instead.
  exportDOM(): DOMExportOutput {
    const element = document.createElement("a");
    element.setAttribute("href", unescapeMarkdown(this.__url));
    element.textContent = unescapeMarkdown(this.__label);
    return { element, $getChildNodes: () => [] };
  }

  // Counterpart to exportDOM so imported HTML round-trips. An `<a>` is converted
  // back to the literal `[label](url)` text; the link node transform in
  // MarkdownLinkPlugin then rebuilds the rich MarkdownLinkNode from it.
  static importDOM(): DOMConversionMap | null {
    return {
      a: () => ({
        conversion: $convertAnchorElement,
        priority: 1,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedMarkdownLinkNode,
  ): MarkdownLinkNode {
    return new MarkdownLinkNode(serializedNode.label, serializedNode.url);
  }

  exportJSON(): SerializedMarkdownLinkNode {
    return {
      ...super.exportJSON(),
      type: NODE_TYPES.LINK,
      url: this.__url,
      label: this.__label,
      version: 1,
    };
  }

  getUrl(): string {
    return this.getLatest().__url;
  }

  getLabel(): string {
    return this.getLatest().__label;
  }

  canBeEmpty(): false {
    return false;
  }

  isInline(): true {
    return true;
  }
}

export function $createMarkdownLinkNode(
  label: string,
  url: string,
): MarkdownLinkNode {
  return new MarkdownLinkNode(label, url);
}

export function $isMarkdownLinkNode(
  node: LexicalNode | null | undefined,
): node is MarkdownLinkNode {
  return node instanceof MarkdownLinkNode;
}

function $convertAnchorElement(domNode: HTMLElement): DOMConversionOutput {
  const href = domNode.getAttribute("href") ?? "";
  const labelText = domNode.textContent ?? "";
  const label = labelText.length > 0 ? labelText : href;
  // Escape the Markdown side so `[`/`]` in the label or `(`/`)` in the URL do
  // not break the generated `[label](url)` syntax.
  const markdown = href
    ? `[${escapeLinkLabel(label)}](${escapeLinkUrl(href)})`
    : labelText;
  // Children are folded into `markdown`, so drop them to avoid duplication.
  return { node: $createTextNode(markdown), forChild: () => null };
}

function createMarkdownLinkTextNodeClass(
  typeString: string,
  dataAttr: string,
  themeKey: "linkUrl" | "linkLabel",
) {
  class MarkdownLinkTextNode extends TextNode {
    static getType(): string {
      return typeString;
    }

    static clone(node: MarkdownLinkTextNode): MarkdownLinkTextNode {
      return new MarkdownLinkTextNode(node.__text, node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
      const dom = super.createDOM(config);
      dom.setAttribute(dataAttr, "");
      // Expose the decoded text so the unfocused (link) rendering can show it
      // without backslash escapes via CSS, while the editable text stays raw.
      dom.setAttribute("data-display", unescapeMarkdown(this.__text));
      const className = (config.theme as MarkdownTheme)[themeKey];
      if (className) dom.classList.add(className);
      return dom;
    }

    updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
      const updated = super.updateDOM(prevNode, dom, config);
      if (prevNode.__text !== this.__text) {
        dom.setAttribute("data-display", unescapeMarkdown(this.__text));
      }
      return updated;
    }

    static importJSON(
      serializedNode: SerializedTextNode,
    ): MarkdownLinkTextNode {
      return $restoreTextNodeProps(
        new MarkdownLinkTextNode(serializedNode.text),
        serializedNode,
      );
    }

    exportJSON(): SerializedTextNode {
      return {
        ...super.exportJSON(),
        type: typeString,
        version: 1,
      };
    }
  }
  return MarkdownLinkTextNode;
}

export const MarkdownLinkUrlNode = createMarkdownLinkTextNodeClass(
  NODE_TYPES.LINK_URL,
  DATA_ATTR.LINK_URL,
  "linkUrl",
);
export type MarkdownLinkUrlNode = InstanceType<typeof MarkdownLinkUrlNode>;

export function $createMarkdownLinkUrlNode(text: string): MarkdownLinkUrlNode {
  return new MarkdownLinkUrlNode(text);
}

export function $isMarkdownLinkUrlNode(
  node: LexicalNode | null | undefined,
): node is MarkdownLinkUrlNode {
  return node instanceof MarkdownLinkUrlNode;
}

export const MarkdownLinkLabelNode = createMarkdownLinkTextNodeClass(
  NODE_TYPES.LINK_LABEL,
  DATA_ATTR.LINK_LABEL,
  "linkLabel",
);
export type MarkdownLinkLabelNode = InstanceType<typeof MarkdownLinkLabelNode>;

export function $createMarkdownLinkLabelNode(
  text: string,
): MarkdownLinkLabelNode {
  return new MarkdownLinkLabelNode(text);
}

export function $isMarkdownLinkLabelNode(
  node: LexicalNode | null | undefined,
): node is MarkdownLinkLabelNode {
  return node instanceof MarkdownLinkLabelNode;
}
