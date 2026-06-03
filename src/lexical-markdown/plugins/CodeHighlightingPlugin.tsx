import {
  $createCodeHighlightNode,
  $isCodeHighlightNode,
} from "@lexical/code-core";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createLineBreakNode,
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
} from "lexical";
import Prism from "prismjs";
import { useEffect } from "react";
import {
  $flatTextAnchorOffset,
  $selectCollapsedClamped,
  $sumTextContentSize,
} from "../nodes/codeLineCaret";
import {
  $isContentTextNode,
  MarkdownCodeBlockNode,
} from "../nodes/MarkdownCodeBlockNode";

export type PrismLanguages = Record<string, Prism.Grammar>;
export type LanguageAliases = Record<string, string>;

const DEFAULT_LANGUAGE_ALIASES: LanguageAliases = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  html: "markup",
  xml: "markup",
};

type FlatToken = { type: string | null; content: string };

type ExpectedChild =
  | { kind: "linebreak" }
  | { kind: "highlight"; text: string; highlightType: string | null };

function resolveGrammar(
  language: string,
  languages: PrismLanguages | null,
  aliases: LanguageAliases,
): Prism.Grammar | null {
  if (!language) return null;
  const key = aliases[language] ?? language;
  if (languages?.[key]) return languages[key];
  return Prism.languages[key] ?? null;
}

function tokenize(code: string, grammar: Prism.Grammar): FlatToken[] {
  const flat: FlatToken[] = [];
  const walk = (token: Prism.Token | string, parentType: string | null) => {
    if (typeof token === "string") {
      if (token.length > 0) flat.push({ type: parentType, content: token });
      return;
    }
    const type = token.type ?? parentType;
    if (Array.isArray(token.content)) {
      for (const t of token.content) walk(t, type);
    } else if (typeof token.content === "string") {
      if (token.content.length > 0) flat.push({ type, content: token.content });
    } else {
      walk(token.content, type);
    }
  };
  for (const t of Prism.tokenize(code, grammar)) walk(t, null);
  return flat;
}

function expectedChildrenFromCodeText(
  codeText: string,
  grammar: Prism.Grammar | null,
  trailingLineBreak: boolean,
): ExpectedChild[] {
  const result: ExpectedChild[] = [{ kind: "linebreak" }];

  const flat: FlatToken[] =
    codeText.length === 0
      ? []
      : grammar
        ? tokenize(codeText, grammar)
        : [{ type: null, content: codeText }];

  const lineTokens: FlatToken[][] = [[]];
  for (const token of flat) {
    const parts = token.content.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lineTokens.push([]);
      if (part.length > 0) {
        lineTokens[lineTokens.length - 1].push({
          type: token.type,
          content: part,
        });
      }
    });
  }

  for (const line of lineTokens) {
    for (const t of line) {
      result.push({
        kind: "highlight",
        text: t.content,
        highlightType: t.type,
      });
    }
    result.push({ kind: "linebreak" });
  }
  if (!trailingLineBreak && result.length > 0) {
    result.pop();
  }
  return result;
}

function middleChildrenMatch(
  actual: LexicalNode[],
  expected: ExpectedChild[],
): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (e.kind === "linebreak") {
      if (!$isLineBreakNode(a)) return false;
    } else {
      if (!$isCodeHighlightNode(a)) return false;
      if (a.getTextContent() !== e.text) return false;
      const aType = a.getHighlightType() ?? null;
      if (aType !== e.highlightType) return false;
    }
  }
  return true;
}

type CursorBoundary = {
  before: LexicalNode | null;
  after: LexicalNode | null;
  blockChildIndex: number;
};

function $resolveCursorAt(
  block: MarkdownCodeBlockNode,
  boundary: CursorBoundary,
): boolean {
  const { before, after, blockChildIndex } = boundary;
  if ($isContentTextNode(before)) {
    const size = before.getTextContentSize();
    before.select(size, size);
    return true;
  }
  if ($isContentTextNode(after)) {
    after.select(0, 0);
    return true;
  }
  if ($isTextNode(before)) {
    const size = before.getTextContentSize();
    before.select(size, size);
    return true;
  }
  if ($isTextNode(after)) {
    after.select(0, 0);
    return true;
  }
  if (before === null && after === null) return false;
  block.select(blockChildIndex, blockChildIndex);
  return true;
}

function setOffsetInBlock(
  block: MarkdownCodeBlockNode,
  targetOffset: number,
): boolean {
  const children = block.getChildren();
  let runningOffset = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (runningOffset === targetOffset) {
      return $resolveCursorAt(block, {
        before: i > 0 ? children[i - 1] : null,
        after: child,
        blockChildIndex: i,
      });
    }

    const size = child.getTextContentSize();

    if (
      targetOffset > runningOffset &&
      targetOffset < runningOffset + size &&
      $isTextNode(child)
    ) {
      const inChild = targetOffset - runningOffset;
      $selectCollapsedClamped(child, inChild);
      return true;
    }

    runningOffset += size;
  }

  if (runningOffset === targetOffset) {
    return $resolveCursorAt(block, {
      before: children[children.length - 1] ?? null,
      after: null,
      blockChildIndex: children.length,
    });
  }

  const last = children[children.length - 1];
  if ($isContentTextNode(last)) {
    $selectCollapsedClamped(last, last.getTextContentSize());
    return true;
  }
  return false;
}

interface Props {
  /**
   * Prism grammars to use for code highlighting. When omitted, the plugin
   * falls back to `Prism.languages` (i.e. whatever the host application has
   * registered via side-effect imports such as
   * `import "prismjs/components/prism-typescript"`).
   */
  languages?: PrismLanguages;
  /**
   * Custom aliases mapping fence language identifier to grammar key (e.g.
   * `{ js: "javascript" }`). Merged with the built-in default aliases.
   */
  languageAliases?: LanguageAliases;
}

export default function CodeHighlightingPlugin({
  languages,
  languageAliases,
}: Props = {}): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const aliases = { ...DEFAULT_LANGUAGE_ALIASES, ...(languageAliases ?? {}) };
    const grammars = languages ?? null;

    const $highlightCodeBlock = (codeBlock: MarkdownCodeBlockNode): void => {
      const language = codeBlock.getLanguage();
      const grammar = resolveGrammar(language, grammars, aliases);

      const codeText = codeBlock.getCodeText();
      if (codeText === null) return;

      const closeFence = codeBlock.getLastChild();
      const trailingLineBreak = codeBlock.hasTrailingLineBreak();
      const expected = expectedChildrenFromCodeText(
        codeText,
        grammar,
        trailingLineBreak,
      );

      const allChildren = codeBlock.getChildren();
      const middleChildren = allChildren.slice(1, -1);
      if (middleChildrenMatch(middleChildren, expected)) return;

      let savedOffset: number | null = null;
      const selection = $getSelection();
      if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        savedOffset = anchorNode.is(codeBlock)
          ? $sumTextContentSize(codeBlock.getChildren().slice(0, anchor.offset))
          : $flatTextAnchorOffset(codeBlock, anchorNode, anchor.offset);
      }

      for (const child of middleChildren) child.remove();
      if (!closeFence) return;
      for (const item of expected) {
        const node =
          item.kind === "linebreak"
            ? $createLineBreakNode()
            : $createCodeHighlightNode(
                item.text,
                item.highlightType ?? undefined,
              );
        closeFence.insertBefore(node);
      }

      if (savedOffset !== null) {
        setOffsetInBlock(codeBlock, savedOffset);
      }
    };

    return editor.registerNodeTransform(MarkdownCodeBlockNode, (codeBlock) => {
      $highlightCodeBlock(codeBlock);
    });
  }, [editor, languages, languageAliases]);

  return null;
}
