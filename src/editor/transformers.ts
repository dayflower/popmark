import { CHECK_LIST, LINK, type TextMatchTransformer, TRANSFORMERS } from "@lexical/markdown";
import { $createTextNode } from "lexical";
import {
  $createMarkdownLinkLabelNode,
  $createMarkdownLinkNode,
  $createMarkdownLinkUrlNode,
  $isMarkdownLinkNode,
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "./MarkdownLinkNode";

// Support both "- [ ] " and "-[ ] " (with or without space between dash and bracket)
export const CUSTOM_CHECK_LIST = {
  ...CHECK_LIST,
  regExp: /^(\s*)[-*+]\s?(\[(\s|x)?\])\s/i,
};

export const MARKDOWN_LINK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [MarkdownLinkNode, MarkdownLinkUrlNode, MarkdownLinkLabelNode],
  export: (node) => {
    if (!$isMarkdownLinkNode(node)) return null;
    return `[${node.__label}](${node.__url})`;
  },
  importRegExp: /(?:\[([^\]]*)\])(?:\(([^)]*)\))/,
  regExp: /(?:\[([^\]]*)\])(?:\(([^)]*)\))$/,
  replace: (textNode, match) => {
    const [, label, url] = match;
    const linkNode = $createMarkdownLinkNode(label, url);
    linkNode.append(
      $createTextNode("["),
      $createMarkdownLinkLabelNode(label),
      $createTextNode("]("),
      $createMarkdownLinkUrlNode(url),
      $createTextNode(")"),
    );
    textNode.replace(linkNode);
  },
  trigger: ")",
  type: "text-match",
};

export const CUSTOM_TRANSFORMERS = [
  CUSTOM_CHECK_LIST,
  ...TRANSFORMERS.filter((t) => t !== LINK),
  MARKDOWN_LINK_TRANSFORMER,
];
