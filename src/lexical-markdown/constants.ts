// Lexical node `type` strings. These are persisted in serialized editor state,
// so the string values must stay stable for backward compatibility even though
// they happen to look like the legacy CSS class names.
export const NODE_TYPES = {
  LINK: "markdown-link",
  LINK_URL: "markdown-link-url",
  LINK_LABEL: "markdown-link-label",
  AUTO_LINK: "markdown-auto-link",
  CODE_BLOCK: "markdown-code-block",
  CODE_FENCE: "markdown-code-fence",
} as const;

// Update tags attached via `editor.update()`. OnChangePlugin inspects these to
// decide whether to re-export markdown, so the string values must stay stable.
export const UPDATE_TAGS = {
  CONTROLLED: "lexical-markdown:controlled",
  INITIAL: "lexical-markdown:initial",
} as const;

// Stable `data-*` attribute hooks the editor always emits. Behavioral code
// (focus tracking, click delegation) and host CSS target these instead of class
// names, so visual styling can be left entirely to the `classNames` prop.
// `FOCUSED` is a state marker toggled at runtime; the rest are structural
// markers set in each node's `createDOM`.
export const DATA_ATTR = {
  LINK: "data-markdown-link",
  LINK_URL: "data-markdown-link-url",
  LINK_LABEL: "data-markdown-link-label",
  AUTO_LINK: "data-markdown-auto-link",
  CODE_BLOCK: "data-markdown-code-block",
  CODE_FENCE: "data-markdown-code-fence",
  FOCUSED: "data-focused",
} as const;
