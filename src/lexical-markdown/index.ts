// Public API entry for etude-lexical-markdown.

export {
  createInitialConfig,
  createMarkdownTheme,
  type MarkdownClassNames,
  type MarkdownTheme,
} from "./config/editorConfig";
export {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
  resolveMarkdownFeatures,
} from "./config/features";
export { createMarkdownNodes } from "./config/nodes";
export {
  CODE_BLOCK_TRANSFORMER,
  createBlockquoteTransformer,
  createMarkdownShortcutTransformers,
  createMarkdownTransformers,
  HORIZONTAL_RULE_TRANSFORMER,
  LINK_TRANSFORMER,
  MARKDOWN_SHORTCUT_TRANSFORMERS,
  MARKDOWN_TRANSFORMERS,
  transformBlockquoteChildMarkdown,
} from "./config/transformers";
export { DATA_ATTR, NODE_TYPES } from "./constants";
export { getEditorHtml } from "./getEditorHtml";
export type { LexicalMarkdownEditorProps } from "./LexicalMarkdownEditor";
export { default as LexicalMarkdownEditor } from "./LexicalMarkdownEditor";
export {
  type MarkdownToHtmlOptions,
  markdownToHtml,
} from "./markdownToHtml";

export {
  $appendCodeBlockChildren,
  $createEmptyMarkdownCodeBlockNode,
  $createMarkdownCodeBlockNode,
  $createMarkdownCodeFenceNode,
  $isMarkdownCodeBlockNode,
  $isMarkdownCodeFenceNode,
  MarkdownCodeBlockNode,
  MarkdownCodeFenceNode,
} from "./nodes/MarkdownCodeBlockNode";

export {
  $createMarkdownLinkLabelNode,
  $createMarkdownLinkNode,
  $createMarkdownLinkUrlNode,
  $isMarkdownLinkLabelNode,
  $isMarkdownLinkNode,
  $isMarkdownLinkUrlNode,
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "./nodes/MarkdownLinkNode";

export { default as BlockquoteBehaviorPlugin } from "./plugins/BlockquoteBehaviorPlugin";
export { default as CheckListShortcutPlugin } from "./plugins/CheckListShortcutPlugin";
export type {
  LanguageAliases,
  PrismLanguages,
} from "./plugins/CodeHighlightingPlugin";
export { default as CodeHighlightingPlugin } from "./plugins/CodeHighlightingPlugin";
export { default as ControlledValuePlugin } from "./plugins/ControlledValuePlugin";
export { default as InitialValuePlugin } from "./plugins/InitialValuePlugin";
export { default as ListBehaviorPlugin } from "./plugins/ListBehaviorPlugin";
export { default as MarkdownCodeBlockPlugin } from "./plugins/MarkdownCodeBlockPlugin";
export { default as MarkdownLinkPlugin } from "./plugins/MarkdownLinkPlugin";
export { default as OnChangePlugin } from "./plugins/OnChangePlugin";
