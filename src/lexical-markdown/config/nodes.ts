import { CodeHighlightNode } from "@lexical/code-core";
import { ListItemNode, ListNode } from "@lexical/list";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { Klass, LexicalNode, LexicalNodeReplacement } from "lexical";
import { MarkdownAutoLinkNode } from "../nodes/MarkdownAutoLinkNode";
import {
  MarkdownCodeBlockNode,
  MarkdownCodeFenceNode,
} from "../nodes/MarkdownCodeBlockNode";
import {
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "../nodes/MarkdownLinkNode";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
} from "./features";

export function createMarkdownNodes(
  features: MarkdownFeatureFlags = DEFAULT_MARKDOWN_FEATURES,
): ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> {
  const nodes: Array<Klass<LexicalNode> | LexicalNodeReplacement> = [];

  if (features.heading) nodes.push(HeadingNode);
  if (features.blockquote) nodes.push(QuoteNode);
  if (features.list) nodes.push(ListNode, ListItemNode);
  if (features.link) {
    nodes.push(MarkdownLinkNode, MarkdownLinkUrlNode, MarkdownLinkLabelNode);
  }
  if (features.autoLink) nodes.push(MarkdownAutoLinkNode);
  if (features.codeBlock) {
    nodes.push(MarkdownCodeBlockNode, MarkdownCodeFenceNode, CodeHighlightNode);
  }
  if (features.horizontalRule) nodes.push(HorizontalRuleNode);

  return nodes;
}
