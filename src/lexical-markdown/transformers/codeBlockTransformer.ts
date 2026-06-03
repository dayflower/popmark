import type { MultilineElementTransformer } from "@lexical/markdown";
import {
  $appendCodeBlockChildren,
  $createMarkdownCodeBlockNode,
  $isMarkdownCodeBlockNode,
  MarkdownCodeBlockNode,
  MarkdownCodeFenceNode,
} from "../nodes/MarkdownCodeBlockNode";

const CODE_BLOCK_START = /^[ \t]*```([a-zA-Z0-9_+-]*)\s*$/;
const CODE_BLOCK_END = /^[ \t]*```\s*$/;

export const CODE_BLOCK_TRANSFORMER: MultilineElementTransformer = {
  type: "multiline-element",
  dependencies: [MarkdownCodeBlockNode, MarkdownCodeFenceNode],
  regExpStart: CODE_BLOCK_START,
  regExpEnd: CODE_BLOCK_END,
  replace: (
    rootNode,
    _children,
    startMatch,
    _endMatch,
    linesInBetween,
    isImport,
  ) => {
    if (!isImport) return false;
    const language = startMatch[1] ?? "";
    // @lexical/markdown frames `linesInBetween` with a structural empty string
    // at both ends (the text trailing the opening fence and preceding the
    // closing fence). Strip exactly those two so the code body matches the
    // source; without this every imported block gains a leading and trailing
    // blank line. Fall back to a single empty line for an empty body.
    const inner = (linesInBetween ?? []).slice(1, -1);
    const lines = inner.length > 0 ? inner : [""];
    const block = $createMarkdownCodeBlockNode(language);
    $appendCodeBlockChildren(block, `\`\`\`${language}`, lines, "```");
    rootNode.append(block);
    return true;
  },
  export: (node) => {
    if (!$isMarkdownCodeBlockNode(node)) return null;
    const codeText = node.getCodeText() ?? "";
    const language = node.getLanguage();
    return `\`\`\`${language}\n${codeText}\n\`\`\``;
  },
};
