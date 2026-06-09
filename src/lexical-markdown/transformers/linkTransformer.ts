import type { TextMatchTransformer } from "@lexical/markdown";
import { $createTextNode, type TextNode } from "lexical";
import {
  $createMarkdownLinkLabelNode,
  $createMarkdownLinkNode,
  $createMarkdownLinkUrlNode,
  $isMarkdownLinkNode,
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "../nodes/MarkdownLinkNode";

// Accept backslash-escaped brackets/parens (`\[`, `\]`, `\(`, `\)`) so a label
// or URL carrying those characters parses as a link, matching the live-typing
// transform in MarkdownLinkPlugin. The escaped form is stored on the node, so
// `export` reproduces the same escaped Markdown.
const LINK_IMPORT_REGEX =
  /(?:\[((?:\\.|[^[\]\\])+)\])(?:\(((?:\\.|[^()\\])+)\))/;
const LINK_SHORTCUT_REGEX =
  /(?:\[((?:\\.|[^[\]\\])+)\])(?:\(((?:\\.|[^()\\])+)\))$/;

export const LINK_TRANSFORMER: TextMatchTransformer = {
  type: "text-match",
  dependencies: [MarkdownLinkNode, MarkdownLinkLabelNode, MarkdownLinkUrlNode],
  importRegExp: LINK_IMPORT_REGEX,
  regExp: LINK_SHORTCUT_REGEX,
  export: (node) => {
    if (!$isMarkdownLinkNode(node)) return null;
    return `[${node.getLabel()}](${node.getUrl()})`;
  },
  replace: (textNode: TextNode, match: RegExpMatchArray) => {
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
};
