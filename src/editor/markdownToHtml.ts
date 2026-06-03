import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { $generateHtmlFromNodes } from "@lexical/html";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { createEditor } from "lexical";

// Standard Lexical nodes whose `exportDOM` emits clean semantic HTML. The live
// editor's custom nodes render Markdown source-visibly (links as `[label](url)`,
// fences as text), which is wrong for a rich-text clipboard payload — so HTML is
// generated from the markdown string through these nodes instead.
const HTML_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
];

/**
 * Converts a Markdown string to HTML for the "Copy as rich text" clipboard
 * payload, using a throwaway editor seeded with the standard Lexical nodes and
 * transformers. Runs detached from the DOM tree; `$generateHtmlFromNodes`
 * builds the elements in memory.
 */
export function markdownToHtml(markdown: string): string {
  const editor = createEditor({
    nodes: HTML_NODES,
    onError: (error) => console.error(error),
  });
  editor.update(
    () => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    },
    { discrete: true },
  );
  let html = "";
  editor.read(() => {
    html = $generateHtmlFromNodes(editor);
  });
  return html;
}
