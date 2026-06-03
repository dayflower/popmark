export interface MarkdownFeatureFlags {
  heading: boolean;
  list: boolean;
  taskList: boolean;
  link: boolean;
  codeBlock: boolean;
  inlineCode: boolean;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  horizontalRule: boolean;
  blockquote: boolean;
}

export const DEFAULT_MARKDOWN_FEATURES: MarkdownFeatureFlags = {
  heading: true,
  list: true,
  taskList: true,
  link: true,
  codeBlock: true,
  inlineCode: true,
  bold: true,
  italic: true,
  strikethrough: true,
  horizontalRule: false,
  blockquote: true,
};

export function resolveMarkdownFeatures(
  overrides?: Partial<MarkdownFeatureFlags>,
): MarkdownFeatureFlags {
  if (!overrides) return DEFAULT_MARKDOWN_FEATURES;
  return { ...DEFAULT_MARKDOWN_FEATURES, ...overrides };
}
