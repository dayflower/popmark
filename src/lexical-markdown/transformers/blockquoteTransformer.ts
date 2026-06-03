import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  type ListNode,
} from "@lexical/list";
import type { ElementTransformer } from "@lexical/markdown";
import { CHECK_LIST, ORDERED_LIST, UNORDERED_LIST } from "@lexical/markdown";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
} from "../config/features";
import { isCloseFence, parseOpenFence } from "../nodes/codeBlockOps";
import {
  $appendCodeBlockCloseFence,
  $appendCodeBlockContentLine,
  $createOpenMarkdownCodeBlockNode,
  $isMarkdownCodeBlockNode,
  $isOpenMarkdownCodeBlock,
  type MarkdownCodeBlockNode,
} from "../nodes/MarkdownCodeBlockNode";

const HEADING_MARKER = /^(#{1,6})\s/;
const ORDERED_LIST_MARKER = /^(\d{1,})\.\s/;
const QUOTE_MARKER = /^>\s/;
// Import-only marker. Unlike QUOTE_MARKER it also matches a bare `>` (a blank
// quoted line, which `exportQuoteNode` emits without a trailing space). Letting
// the transformer claim those lines turns them into empty paragraph blocks
// inside the quote, instead of having Lexical core append them to the previous
// quote as a trailing `<br>` (which would defeat the line-start checks in the
// typing transforms). Typing is unaffected: MarkdownShortcutPlugin only fires
// when the caret is preceded by a space, so a lone `>` never triggers it.
const QUOTE_BLOCK_REGEXP = /^>\s?/;
// Must be tested before UNORDERED_LIST_MARKER: a check item (`- [ ] `) also
// satisfies the bare bullet marker, so the more specific pattern wins.
const CHECK_LIST_MARKER = /^[-*+]\s\[([ xX])\]\s/;
const UNORDERED_LIST_MARKER = /^[-*+]\s/;

// Which nested block markers the blockquote recognizes on import / when typed
// inside a quote. Gated by the editor's feature flags so we never create nodes
// (HeadingNode, ListNode, ...) that were not registered with the editor.
function resolveBlockMarkers(features: MarkdownFeatureFlags) {
  return {
    heading: features.heading,
    list: features.list,
    taskList: features.taskList && features.list,
    quote: features.blockquote,
  };
}

export function createBlockquoteTransformer(
  features: MarkdownFeatureFlags = DEFAULT_MARKDOWN_FEATURES,
): ElementTransformer {
  return {
    dependencies: [QuoteNode],
    export: (node, exportChildren) => {
      if (!$isQuoteNode(node)) {
        return null;
      }

      return exportQuoteNode(node, exportChildren);
    },
    regExp: QUOTE_BLOCK_REGEXP,
    replace: (parentNode, children, _match, isImport) => {
      // Code blocks span multiple quoted lines and must suppress block-marker
      // parsing between their fences, so they are handled here (before the
      // per-line marker logic) using the previous quote node as carried state.
      if (isImport && features.codeBlock) {
        const previousNode = parentNode.getPreviousSibling();
        const previousQuote = $isQuoteNode(previousNode) ? previousNode : null;
        const rawText = getChildrenText(children);
        const openBlock = previousQuote
          ? $openCodeBlockAtEnd(previousQuote)
          : null;

        if (openBlock) {
          if (isCloseFence(rawText)) {
            $appendCodeBlockCloseFence(openBlock);
          } else {
            $appendCodeBlockContentLine(openBlock, rawText);
          }
          parentNode.remove();
          return;
        }

        const opened = parseOpenFence(rawText);

        if (opened) {
          const block = $createOpenMarkdownCodeBlockNode(opened.language);

          if (previousQuote) {
            previousQuote.append(block);
            parentNode.remove();
          } else {
            const quoteNode = $createQuoteNode();
            quoteNode.append(block);
            parentNode.replace(quoteNode);
          }

          return;
        }
      }

      const quoteNode = $createQuoteNode();
      quoteNode.append(...createBlocksFromMarkdownChildren(children, features));

      if (isImport) {
        const previousNode = parentNode.getPreviousSibling();

        if ($isQuoteNode(previousNode)) {
          appendBlocksToQuote(previousNode, quoteNode.getChildren());
          parentNode.remove();
          return;
        }
      }

      parentNode.replace(quoteNode);

      if (!isImport) {
        quoteNode.selectStart();
      }
    },
    type: "element",
  };
}

export function transformBlockquoteChildMarkdown(
  parentNode: ElementNode,
  anchorNode: TextNode,
  anchorOffset: number,
  features: MarkdownFeatureFlags = DEFAULT_MARKDOWN_FEATURES,
): boolean {
  if (parentNode.getFirstChild() !== anchorNode) {
    return false;
  }

  const quoteNode = parentNode.getParent();

  if (
    !$isQuoteNode(quoteNode) ||
    anchorNode.getTextContent()[anchorOffset - 1] !== " "
  ) {
    return false;
  }

  const textContent = anchorNode.getTextContent();
  const match = getBlockMarkerMatch(textContent, features);

  if (match === null || match[0].length !== anchorOffset) {
    return false;
  }

  const nextSiblings = anchorNode.getNextSiblings();
  const [markerNode, remainderNode] = anchorNode.splitText(anchorOffset);
  const content = remainderNode
    ? [remainderNode, ...nextSiblings]
    : nextSiblings;
  const replacementBlocks = createBlocksFromMarkdownChildren(
    [$createTextNode(match[0]), ...content],
    features,
  );

  markerNode.remove();
  parentNode.replace(replacementBlocks[0]);
  let previousBlock = replacementBlocks[0];

  for (const block of replacementBlocks.slice(1)) {
    previousBlock.insertAfter(block);
    previousBlock = block;
  }

  replacementBlocks[0].selectStart();
  return true;
}

function exportQuoteNode(
  quoteNode: QuoteNode,
  exportChildren: (node: ElementNode) => string,
): string {
  const childMarkdown = quoteNode
    .getChildren()
    .map((child) => exportBlockNode(child, exportChildren))
    .filter((value) => value !== null)
    .join("\n");

  return childMarkdown
    .split("\n")
    .map((line) => (line.length === 0 ? ">" : `> ${line}`))
    .join("\n");
}

function exportBlockNode(
  node: LexicalNode,
  exportChildren: (node: ElementNode) => string,
): string | null {
  if ($isQuoteNode(node)) {
    return exportQuoteNode(node, exportChildren);
  }

  if ($isHeadingNode(node)) {
    const level = Number(node.getTag().slice(1));
    return `${"#".repeat(level)} ${exportChildren(node)}`;
  }

  if ($isMarkdownCodeBlockNode(node)) {
    const codeText = node.getCodeText() ?? "";
    return `\`\`\`${node.getLanguage()}\n${codeText}\n\`\`\``;
  }

  if ($isListNode(node)) {
    const listType = node.getListType();
    const transformer =
      listType === "number"
        ? ORDERED_LIST
        : listType === "check"
          ? CHECK_LIST
          : UNORDERED_LIST;
    return transformer.export(node, exportChildren);
  }

  if ($isParagraphNode(node) || $isElementNode(node)) {
    return exportChildren(node);
  }

  return node.getTextContent();
}

function createBlocksFromMarkdownChildren(
  children: LexicalNode[],
  features: MarkdownFeatureFlags,
): ElementNode[] {
  const markers = resolveBlockMarkers(features);
  const markerText = getChildrenText(children);

  if (markers.heading && HEADING_MARKER.test(markerText)) {
    const match = markerText.match(HEADING_MARKER);
    const heading = $createHeadingNode(
      `h${match?.[1].length ?? 1}` as HeadingTagType,
    );
    heading.append(...removeTextPrefix(children, match?.[0].length ?? 0));
    return [heading];
  }

  if (markers.taskList && CHECK_LIST_MARKER.test(markerText)) {
    const match = markerText.match(CHECK_LIST_MARKER);
    const checked = match?.[1] === "x" || match?.[1] === "X";
    return [
      createListBlock(
        "check",
        removeTextPrefix(children, match?.[0].length ?? 0),
        1,
        checked,
      ),
    ];
  }

  if (markers.list && UNORDERED_LIST_MARKER.test(markerText)) {
    return [
      createListBlock(
        "bullet",
        removeTextPrefix(
          children,
          markerText.match(UNORDERED_LIST_MARKER)?.[0].length ?? 0,
        ),
      ),
    ];
  }

  if (markers.list && ORDERED_LIST_MARKER.test(markerText)) {
    const match = markerText.match(ORDERED_LIST_MARKER);
    return [
      createListBlock(
        "number",
        removeTextPrefix(children, match?.[0].length ?? 0),
        Number(match?.[1] ?? 1),
      ),
    ];
  }

  if (markers.quote && QUOTE_MARKER.test(markerText)) {
    const quote = $createQuoteNode();
    quote.append(
      ...createBlocksFromMarkdownChildren(
        removeTextPrefix(
          children,
          markerText.match(QUOTE_MARKER)?.[0].length ?? 0,
        ),
        features,
      ),
    );
    return [quote];
  }

  const paragraph = $createParagraphNode();
  paragraph.append(...children);
  return [paragraph];
}

function createListBlock(
  listType: "bullet" | "number" | "check",
  children: LexicalNode[],
  start = 1,
  checked = false,
): ListNode {
  const list = $createListNode(listType, start);
  const listItem = $createListItemNode(
    listType === "check" ? checked : undefined,
  );
  listItem.append(...children);
  list.append(listItem);
  return list;
}

function $openCodeBlockAtEnd(quote: QuoteNode): MarkdownCodeBlockNode | null {
  const last = quote.getLastChild();
  return $isMarkdownCodeBlockNode(last) && $isOpenMarkdownCodeBlock(last)
    ? last
    : null;
}

function appendBlocksToQuote(quoteNode: QuoteNode, blocks: LexicalNode[]) {
  const previousBlock = quoteNode.getLastChild();
  const nextBlock = blocks[0];

  if (
    $isListNode(previousBlock) &&
    $isListNode(nextBlock) &&
    previousBlock.getListType() === nextBlock.getListType()
  ) {
    previousBlock.append(...nextBlock.getChildren());
    blocks.shift();
  }

  quoteNode.append(...blocks);
}

function getBlockMarkerMatch(
  textContent: string,
  features: MarkdownFeatureFlags,
): RegExpMatchArray | null {
  const markers = resolveBlockMarkers(features);

  return (
    (markers.heading ? textContent.match(HEADING_MARKER) : null) ??
    (markers.taskList ? textContent.match(CHECK_LIST_MARKER) : null) ??
    (markers.list ? textContent.match(UNORDERED_LIST_MARKER) : null) ??
    (markers.list ? textContent.match(ORDERED_LIST_MARKER) : null) ??
    (markers.quote ? textContent.match(QUOTE_MARKER) : null)
  );
}

function getChildrenText(children: LexicalNode[]): string {
  return children.map((child) => child.getTextContent()).join("");
}

function removeTextPrefix(
  children: LexicalNode[],
  prefixLength: number,
): LexicalNode[] {
  let remainingLength = prefixLength;
  const strippedChildren: LexicalNode[] = [];

  for (const child of children) {
    if (remainingLength === 0) {
      strippedChildren.push(child);
      continue;
    }

    if ($isTextNode(child)) {
      const text = child.getTextContent();

      if (text.length <= remainingLength) {
        removeIfAttached(child);
        remainingLength -= text.length;
        continue;
      }

      child.setTextContent(text.slice(remainingLength));
      remainingLength = 0;
      strippedChildren.push(child);
      continue;
    }

    if ($isLineBreakNode(child)) {
      remainingLength -= 1;
      removeIfAttached(child);
      continue;
    }

    strippedChildren.push(child);
  }

  return strippedChildren;
}

function removeIfAttached(node: LexicalNode) {
  if (node.isAttached()) {
    node.remove();
  }
}
