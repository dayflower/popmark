import {
  $createQuoteNode,
  $isQuoteNode,
  type QuoteNode,
} from "@lexical/rich-text";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { $findAncestor } from "../nodes/nodeTraversal";

type QuoteSelectionContext = {
  anchorNode: LexicalNode;
  quoteNode: QuoteNode;
  selection: RangeSelection;
};

function getCollapsedQuoteSelection(): QuoteSelectionContext | null {
  const selection = $getSelection();

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  const quoteNode = $findAncestor(anchorNode, $isQuoteNode);

  if (quoteNode === null) {
    return null;
  }

  return {
    anchorNode,
    quoteNode,
    selection,
  };
}

function getQuoteSelectionAtStart(): QuoteSelectionContext | null {
  const context = getCollapsedQuoteSelection();

  if (
    context === null ||
    !isSelectionAtQuoteStart(
      context.selection.anchor.offset,
      context.anchorNode,
      context.quoteNode,
    )
  ) {
    return null;
  }

  return context;
}

function isSelectionAtQuoteStart(
  anchorOffset: number,
  anchorNode: LexicalNode,
  quoteNode: QuoteNode,
): boolean {
  if (anchorNode.is(quoteNode)) {
    return anchorOffset === 0;
  }

  if (anchorOffset !== 0) {
    return false;
  }

  return anchorNode.is(quoteNode.getFirstDescendant());
}

function replaceQuoteWithParagraph(quoteNode: QuoteNode): ElementNode {
  const paragraph = $createParagraphNode();
  paragraph.setDirection(quoteNode.getDirection());
  quoteNode.replace(paragraph, true);
  paragraph.selectStart();
  return paragraph;
}

export function handleQuoteEnter(
  event: KeyboardEvent | null,
  exitOnEmptyLine: boolean,
): boolean {
  if (event?.shiftKey) {
    return false;
  }

  const context = getCollapsedQuoteSelection();

  if (context === null) {
    return false;
  }

  if (exitOnEmptyLine && exitQuoteAtBlankLine()) {
    event?.preventDefault();
    return true;
  }

  return false;
}

export function handleQuoteBackspace(): boolean {
  if (exitQuoteAtBlankLine()) {
    return true;
  }

  const context = getQuoteSelectionAtStart();

  if (context === null) {
    return false;
  }

  const { quoteNode } = context;
  const previousSibling = quoteNode.getPreviousSibling();

  if (!$isQuoteNode(previousSibling)) {
    unwrapQuote(quoteNode);
    return true;
  }

  if (quoteNode.isEmpty()) {
    replaceQuoteWithParagraph(quoteNode);
    return true;
  }

  previousSibling.selectEnd();
  previousSibling.append(...quoteNode.getChildren());
  quoteNode.remove();
  return true;
}

function exitQuoteAtBlankLine(): boolean {
  const selection = $getSelection();

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const anchorNode = selection.anchor.getNode();
  const quoteNode = $findAncestor(anchorNode, $isQuoteNode);
  const blockNode = getQuoteChildBlock(anchorNode, quoteNode);

  if (
    quoteNode === null ||
    blockNode === null ||
    !$isParagraphNode(blockNode) ||
    !blockNode.isEmpty()
  ) {
    return false;
  }

  const paragraph = $createParagraphNode();
  paragraph.setDirection(quoteNode.getDirection());

  const trailingBlocks = blockNode.getNextSiblings();
  blockNode.remove();

  if (quoteNode.isEmpty()) {
    quoteNode.replace(paragraph);
  } else {
    quoteNode.insertAfter(paragraph);
  }

  moveTrailingQuoteContentAfterParagraph(quoteNode, paragraph, trailingBlocks);

  paragraph.selectStart();
  return true;
}

function moveTrailingQuoteContentAfterParagraph(
  sourceQuoteNode: QuoteNode,
  paragraph: ElementNode,
  trailingChildren: LexicalNode[],
) {
  const trailingQuoteNode = $createQuoteNode();
  trailingQuoteNode.setDirection(sourceQuoteNode.getDirection());

  if (trailingChildren.length === 0) {
    return;
  }

  trailingQuoteNode.append(...trailingChildren);
  paragraph.insertAfter(trailingQuoteNode);
}

function getQuoteChildBlock(
  node: LexicalNode,
  quoteNode: QuoteNode | null,
): ElementNode | null {
  if (quoteNode === null) {
    return null;
  }

  let currentNode: LexicalNode | null = node;

  while (currentNode !== null && !currentNode.getParent()?.is(quoteNode)) {
    currentNode = currentNode.getParent();
  }

  return $isElementNode(currentNode) ? currentNode : null;
}

function unwrapQuote(quoteNode: QuoteNode) {
  const children = quoteNode.getChildren();

  if (children.length === 0) {
    replaceQuoteWithParagraph(quoteNode);
    return;
  }

  const firstChild = children[0];
  quoteNode.replace(firstChild);

  let previousChild = firstChild;

  for (const child of children.slice(1)) {
    previousChild.insertAfter(child);
    previousChild = child;
  }

  if ($isElementNode(firstChild)) {
    firstChild.selectStart();
  }
}
