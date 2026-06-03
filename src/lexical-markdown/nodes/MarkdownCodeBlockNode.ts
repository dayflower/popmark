import { $createCodeHighlightNode } from "@lexical/code-core";
import {
  $createLineBreakNode,
  $isLineBreakNode,
  $isTextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
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
import { $restoreTextNodeProps } from "./textNodeSerialization";

export type SerializedMarkdownCodeBlockNode = Spread<
  { language: string },
  SerializedElementNode
>;

export class MarkdownCodeBlockNode extends ElementNode {
  __language: string;

  static getType(): string {
    return NODE_TYPES.CODE_BLOCK;
  }

  static clone(node: MarkdownCodeBlockNode): MarkdownCodeBlockNode {
    return new MarkdownCodeBlockNode(node.__language, node.__key);
  }

  constructor(language: string, key?: NodeKey) {
    super(key);
    this.__language = language;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("pre");
    dom.setAttribute(DATA_ATTR.CODE_BLOCK, "");
    dom.setAttribute("data-language", this.__language);
    const className = (config.theme as MarkdownTheme).codeBlock;
    if (className) dom.className = className;
    return dom;
  }

  updateDOM(prevNode: MarkdownCodeBlockNode, dom: HTMLElement): boolean {
    if (prevNode.__language !== this.__language) {
      dom.setAttribute("data-language", this.__language);
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      pre: () => ({
        conversion: $convertPreElement,
        priority: 1,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedMarkdownCodeBlockNode,
  ): MarkdownCodeBlockNode {
    return new MarkdownCodeBlockNode(serializedNode.language);
  }

  exportJSON(): SerializedMarkdownCodeBlockNode {
    return {
      ...super.exportJSON(),
      type: NODE_TYPES.CODE_BLOCK,
      language: this.__language,
      version: 1,
    };
  }

  setLanguage(language: string): void {
    const writable = this.getWritable();
    writable.__language = language;
  }

  getLanguage(): string {
    return this.getLatest().__language;
  }

  getOpenFence(): MarkdownCodeFenceNode | null {
    const first = this.getFirstChild();
    return $isMarkdownCodeFenceNode(first) ? first : null;
  }

  getCloseFence(): MarkdownCodeFenceNode | null {
    const last = this.getLastChild();
    return $isMarkdownCodeFenceNode(last) ? last : null;
  }

  // Returns the middle content (between the fences) joined with "\n". The
  // first linebreak after the open fence is the structural separator and is
  // excluded. Returns null when the surrounding fences are missing.
  getCodeText(): string | null {
    const children = this.getChildren();
    if (children.length < 2) return null;
    const first = children[0];
    const last = children[children.length - 1];
    if (!$isMarkdownCodeFenceNode(first) || !$isMarkdownCodeFenceNode(last)) {
      return null;
    }
    const lines: string[] = [];
    let currentLine = "";
    let firstLineBreakSeen = false;
    for (let i = 1; i < children.length - 1; i++) {
      const child = children[i];
      if ($isLineBreakNode(child)) {
        if (!firstLineBreakSeen) {
          firstLineBreakSeen = true;
          continue;
        }
        lines.push(currentLine);
        currentLine = "";
        continue;
      }
      if ($isTextNode(child)) {
        currentLine += child.getTextContent();
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    return lines.join("\n");
  }

  hasTrailingLineBreak(): boolean {
    const closeFence = this.getCloseFence();
    if (!closeFence) return true;
    const prevOfLast = closeFence.getPreviousSibling();
    if (!$isLineBreakNode(prevOfLast)) return false;
    const prevOfLastIsOpenFence = prevOfLast
      .getPreviousSibling()
      ?.is(this.getOpenFence());
    return !prevOfLastIsOpenFence;
  }
}

export function $createMarkdownCodeBlockNode(
  language: string,
): MarkdownCodeBlockNode {
  return new MarkdownCodeBlockNode(language);
}

export function $createEmptyMarkdownCodeBlockNode(
  language: string,
): MarkdownCodeBlockNode {
  const block = $createMarkdownCodeBlockNode(language);
  $appendCodeBlockChildren(block, `\`\`\`${language}`, [""], "```");
  return block;
}

export function $isMarkdownCodeBlockNode(
  node: LexicalNode | null | undefined,
): node is MarkdownCodeBlockNode {
  return node instanceof MarkdownCodeBlockNode;
}

// Incremental builders used by the blockquote importer, which discovers a code
// block one quoted line at a time. A block is "open" until its closing fence is
// appended; while open, subsequent quoted lines are treated as literal code.
export function $createOpenMarkdownCodeBlockNode(
  language: string,
): MarkdownCodeBlockNode {
  const block = $createMarkdownCodeBlockNode(language);
  block.append($createMarkdownCodeFenceNode(`\`\`\`${language}`));
  return block;
}

export function $appendCodeBlockContentLine(
  block: MarkdownCodeBlockNode,
  line: string,
): void {
  block.append($createLineBreakNode());
  if (line.length > 0) {
    block.append($createCodeHighlightNode(line));
  }
}

export function $appendCodeBlockCloseFence(
  block: MarkdownCodeBlockNode,
  closeFenceText = "```",
): void {
  block.append($createLineBreakNode());
  block.append($createMarkdownCodeFenceNode(closeFenceText));
}

// True while the block has an opening fence but no distinct closing fence. A
// freshly opened block has a single fence child, so the open/close getters
// return the same node.
export function $isOpenMarkdownCodeBlock(
  block: MarkdownCodeBlockNode,
): boolean {
  const open = block.getOpenFence();
  const close = block.getCloseFence();
  return open !== null && (close === null || open.is(close));
}

export const OPEN_FENCE_PREFIX_LENGTH = 3;

export const FIRST_CONTENT_LINE_CHILD_INDEX = 2;

export function $isContentTextNode(
  node: LexicalNode | null | undefined,
): node is TextNode {
  return $isTextNode(node) && !$isMarkdownCodeFenceNode(node);
}

export function $selectFirstContentLineStart(
  codeBlock: MarkdownCodeBlockNode,
): void {
  codeBlock.select(
    FIRST_CONTENT_LINE_CHILD_INDEX,
    FIRST_CONTENT_LINE_CHILD_INDEX,
  );
}

const LANGUAGE_CLASS_REGEX = /^language-(.+)$/;

function detectLanguage(pre: HTMLElement): string {
  const dataLang = pre.getAttribute("data-language");
  if (dataLang) return dataLang;

  const code = pre.querySelector("code");
  if (code) {
    for (const cls of code.classList) {
      const m = LANGUAGE_CLASS_REGEX.exec(cls);
      if (m) return m[1];
    }
  }

  for (const cls of pre.classList) {
    const m = LANGUAGE_CLASS_REGEX.exec(cls);
    if (m) return m[1];
  }

  return "";
}

function $convertPreElement(domNode: HTMLElement): DOMConversionOutput {
  const language = detectLanguage(domNode);
  const raw = domNode.textContent ?? "";
  const text = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  const lines = text.split("\n");

  const codeBlock = $createMarkdownCodeBlockNode(language);
  $appendCodeBlockChildren(codeBlock, `\`\`\`${language}`, lines, "```");

  return {
    node: codeBlock,
    forChild: () => null,
  };
}

// Builds the canonical code block child layout:
//   [ openFence, lb, (highlight)?, lb, (highlight)?, ..., lb, closeFence ]
export function $appendCodeBlockChildren(
  codeBlock: MarkdownCodeBlockNode,
  openFenceText: string,
  codeLines: string[],
  closeFenceText: string,
): void {
  codeBlock.append($createMarkdownCodeFenceNode(openFenceText));
  for (const line of codeLines) {
    codeBlock.append($createLineBreakNode());
    if (line.length > 0) {
      codeBlock.append($createCodeHighlightNode(line));
    }
  }
  codeBlock.append($createLineBreakNode());
  codeBlock.append($createMarkdownCodeFenceNode(closeFenceText));
}

export class MarkdownCodeFenceNode extends TextNode {
  static getType(): string {
    return NODE_TYPES.CODE_FENCE;
  }

  static clone(node: MarkdownCodeFenceNode): MarkdownCodeFenceNode {
    return new MarkdownCodeFenceNode(node.__text, node.__key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.setAttribute(DATA_ATTR.CODE_FENCE, "");
    const className = (config.theme as MarkdownTheme).codeFence;
    if (className) dom.classList.add(className);
    return dom;
  }

  static importJSON(serializedNode: SerializedTextNode): MarkdownCodeFenceNode {
    return $restoreTextNodeProps(
      new MarkdownCodeFenceNode(serializedNode.text),
      serializedNode,
    );
  }

  exportJSON(): SerializedTextNode {
    return {
      ...super.exportJSON(),
      type: NODE_TYPES.CODE_FENCE,
      version: 1,
    };
  }
}

export function $createMarkdownCodeFenceNode(
  text: string,
): MarkdownCodeFenceNode {
  return new MarkdownCodeFenceNode(text);
}

export function $isMarkdownCodeFenceNode(
  node: LexicalNode | null | undefined,
): node is MarkdownCodeFenceNode {
  return node instanceof MarkdownCodeFenceNode;
}
