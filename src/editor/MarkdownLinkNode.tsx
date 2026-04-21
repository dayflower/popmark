import {
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

const CSS_CLASSES = {
  LINK: "markdown-link",
  URL: "markdown-link-url",
  LABEL: "markdown-link-label",
  FOCUSED: "is-focused",
} as const;

export { CSS_CLASSES as MARKDOWN_LINK_CSS_CLASSES };

export type SerializedMarkdownLinkNode = Spread<
  { url: string; label: string },
  SerializedElementNode
>;

export class MarkdownLinkNode extends ElementNode {
  __url: string;
  __label: string;

  static getType(): string {
    return CSS_CLASSES.LINK;
  }

  static clone(node: MarkdownLinkNode): MarkdownLinkNode {
    return new MarkdownLinkNode(node.__label, node.__url, node.__key);
  }

  constructor(label: string, url: string, key?: NodeKey) {
    super(key);
    this.__label = label;
    this.__url = url;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const dom = document.createElement("span");
    dom.className = CSS_CLASSES.LINK;
    dom.setAttribute("data-url", this.__url);
    dom.setAttribute("data-label", this.__label);
    return dom;
  }

  updateDOM(prevNode: MarkdownLinkNode, dom: HTMLElement): boolean {
    if (prevNode.__url !== this.__url) {
      dom.setAttribute("data-url", this.__url);
    }
    if (prevNode.__label !== this.__label) {
      dom.setAttribute("data-label", this.__label);
    }
    return false;
  }

  static importJSON(serializedNode: SerializedMarkdownLinkNode): MarkdownLinkNode {
    return new MarkdownLinkNode(serializedNode.label, serializedNode.url);
  }

  exportJSON(): SerializedMarkdownLinkNode {
    return {
      ...super.exportJSON(),
      type: CSS_CLASSES.LINK,
      url: this.__url,
      label: this.__label,
      version: 1,
    };
  }

  canBeEmpty(): false {
    return false;
  }

  isInline(): true {
    return true;
  }
}

export function $createMarkdownLinkNode(label: string, url: string): MarkdownLinkNode {
  return new MarkdownLinkNode(label, url);
}

export function $isMarkdownLinkNode(
  node: LexicalNode | null | undefined,
): node is MarkdownLinkNode {
  return node instanceof MarkdownLinkNode;
}

function createMarkdownLinkTextNodeClass(typeString: string, cssClass: string) {
  class MarkdownLinkTextNode extends TextNode {
    static getType(): string {
      return typeString;
    }

    static clone(node: MarkdownLinkTextNode): MarkdownLinkTextNode {
      return new MarkdownLinkTextNode(node.__text, node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
      const dom = super.createDOM(config);
      dom.classList.add(cssClass);
      return dom;
    }

    static importJSON(serializedNode: SerializedTextNode): MarkdownLinkTextNode {
      const node = new MarkdownLinkTextNode(serializedNode.text);
      node.setFormat(serializedNode.format);
      node.setDetail(serializedNode.detail);
      node.setMode(serializedNode.mode);
      node.setStyle(serializedNode.style);
      return node;
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
  CSS_CLASSES.URL,
  CSS_CLASSES.URL,
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
  CSS_CLASSES.LABEL,
  CSS_CLASSES.LABEL,
);
export type MarkdownLinkLabelNode = InstanceType<typeof MarkdownLinkLabelNode>;

export function $createMarkdownLinkLabelNode(text: string): MarkdownLinkLabelNode {
  return new MarkdownLinkLabelNode(text);
}

export function $isMarkdownLinkLabelNode(
  node: LexicalNode | null | undefined,
): node is MarkdownLinkLabelNode {
  return node instanceof MarkdownLinkLabelNode;
}
