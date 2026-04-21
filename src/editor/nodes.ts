import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { MarkdownLinkLabelNode, MarkdownLinkNode, MarkdownLinkUrlNode } from "./MarkdownLinkNode";

export const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  ListNode,
  ListItemNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
  MarkdownLinkLabelNode,
  HorizontalRuleNode,
];
