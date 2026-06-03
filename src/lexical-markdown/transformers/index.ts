import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  ORDERED_LIST,
  STRIKETHROUGH,
  type Transformer,
  UNORDERED_LIST,
} from "@lexical/markdown";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
} from "../config/features";
import { createBlockquoteTransformer } from "./blockquoteTransformer";
import { CODE_BLOCK_TRANSFORMER } from "./codeBlockTransformer";
import { HORIZONTAL_RULE_TRANSFORMER } from "./horizontalRuleTransformer";
import { LINK_TRANSFORMER } from "./linkTransformer";

export {
  createBlockquoteTransformer,
  transformBlockquoteChildMarkdown,
} from "./blockquoteTransformer";
export { CODE_BLOCK_TRANSFORMER } from "./codeBlockTransformer";
export { HORIZONTAL_RULE_TRANSFORMER } from "./horizontalRuleTransformer";
export { LINK_TRANSFORMER } from "./linkTransformer";

// Order matters: the multiline element transformer (code block) needs to be
// evaluated against block-level lines first; element transformers (heading,
// lists, horizontal rule) match line-based regexps; text-format and text-match
// transformers (bold, italic, link) operate inside inline text.
export function createMarkdownTransformers(
  features: MarkdownFeatureFlags = DEFAULT_MARKDOWN_FEATURES,
): Array<Transformer> {
  const transformers: Array<Transformer> = [];

  if (features.codeBlock) transformers.push(CODE_BLOCK_TRANSFORMER);
  if (features.heading) transformers.push(HEADING);
  if (features.blockquote) {
    transformers.push(createBlockquoteTransformer(features));
  }
  if (features.taskList && features.list) transformers.push(CHECK_LIST);
  if (features.list) {
    transformers.push(UNORDERED_LIST, ORDERED_LIST);
  }
  if (features.horizontalRule) transformers.push(HORIZONTAL_RULE_TRANSFORMER);
  if (features.bold && features.italic) {
    transformers.push(BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE);
  }
  if (features.bold) transformers.push(BOLD_STAR, BOLD_UNDERSCORE);
  if (features.italic) transformers.push(ITALIC_STAR, ITALIC_UNDERSCORE);
  if (features.strikethrough) transformers.push(STRIKETHROUGH);
  if (features.inlineCode) transformers.push(INLINE_CODE);
  if (features.link) transformers.push(LINK_TRANSFORMER);

  return transformers;
}

export const MARKDOWN_TRANSFORMERS: Array<Transformer> =
  createMarkdownTransformers();

// Subset of MARKDOWN_TRANSFORMERS intended for MarkdownShortcutPlugin. The
// following are excluded because they are handled by dedicated plugins:
// - LINK_TRANSFORMER: MarkdownLinkPlugin (node transforms)
// - CODE_BLOCK_TRANSFORMER: MarkdownCodeBlockPlugin (key handlers)
// - CHECK_LIST: CheckListShortcutPlugin (only matches `- [ ] ` style typing —
//   the built-in CHECK_LIST would also fire on bare `[ ] ` without leading `-`)
// - HORIZONTAL_RULE_TRANSFORMER: HorizontalRulePlugin (the built-in element
//   transformer fires on a trailing space; the plugin instead converts on
//   Enter / caret leaving the line and supports unwrapping back to text)
export function createMarkdownShortcutTransformers(
  features: MarkdownFeatureFlags = DEFAULT_MARKDOWN_FEATURES,
): Array<Transformer> {
  return createMarkdownTransformers(features).filter(
    (t) =>
      t !== CODE_BLOCK_TRANSFORMER &&
      t !== LINK_TRANSFORMER &&
      t !== CHECK_LIST &&
      t !== HORIZONTAL_RULE_TRANSFORMER,
  );
}

export const MARKDOWN_SHORTCUT_TRANSFORMERS: Array<Transformer> =
  createMarkdownShortcutTransformers();
