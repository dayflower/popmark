// Styling configuration for the vendored LexicalMarkdownEditor.
//
// Typography and layout that a tag/utility can express are supplied here as
// Tailwind utility classes (with dark-mode variants). Stateful / decorative
// concerns that read better as CSS — the markdown link, the code block, the
// task-list checkbox, the horizontal rule, and markup mode — are styled in
// index.css through the stable `md-*` hook classes injected below and the
// library's `data-markdown-*` attributes.

import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import {
  createMarkdownNodes,
  createMarkdownTransformers,
  type MarkdownClassNames,
  type MarkdownFeatureFlags,
  type PrismLanguages,
  resolveMarkdownFeatures,
} from "../lexical-markdown";

// The Markdown feature set popmark enables. Mirrors the previous editor's
// capabilities; horizontalRule is enabled (etude disables it by default).
export const POPMARK_FEATURES: MarkdownFeatureFlags = resolveMarkdownFeatures({
  horizontalRule: true,
});

// Transformers and node set derived from the feature flags. Reused for reading
// markdown back out of the live editor (copy / export) and for the temporary
// editor that converts pasted Markdown into nodes — both must match what the
// editor emits, so they are built from the same features.
export const POPMARK_TRANSFORMERS = createMarkdownTransformers(POPMARK_FEATURES);
export const POPMARK_NODES = createMarkdownNodes(POPMARK_FEATURES);

export const PRISM_LANGUAGES: PrismLanguages = {
  javascript: Prism.languages.javascript,
  typescript: Prism.languages.typescript,
  jsx: Prism.languages.jsx,
  tsx: Prism.languages.tsx,
  css: Prism.languages.css,
  json: Prism.languages.json,
  bash: Prism.languages.bash,
  python: Prism.languages.python,
  markup: Prism.languages.markup,
};

// Attribute the host sets on the editor wrapper to reveal markdown syntax
// markers (the etude "markup mode"). index.css keys its `::before`/`::after`
// decorations off it. Replaces popmark's former `show-syntax-markers` class.
export const MARKUP_MODE_ATTR = "data-markdown-markup-mode";

export const POPMARK_CLASS_NAMES: MarkdownClassNames = {
  paragraph: "my-[0.1em] leading-[1.45]",
  quote:
    "border-l-[3px] border-gray-300 dark:border-gray-600 pl-3 my-[0.5em] text-gray-600 dark:text-gray-400",
  heading: {
    h1: "text-2xl font-bold mt-[0.3em] mb-[0.2em]",
    h2: "text-xl font-bold mt-[0.3em] mb-[0.2em]",
    h3: "text-lg font-semibold mt-[0.3em] mb-[0.2em]",
    h4: "text-base font-semibold mt-[0.3em] mb-[0.2em]",
    h5: "text-sm font-semibold mt-[0.3em] mb-[0.2em]",
    h6: "text-sm font-semibold mt-[0.3em] mb-[0.2em]",
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    // `md-strike` is the markup-mode hook for the ~~…~~ markers (index.css).
    strikethrough: "line-through md-strike",
    code: "md-code",
  },
  list: {
    ul: "list-disc pl-[1.25em] my-[0.25em]",
    ol: "list-decimal pl-[1.25em] my-[0.25em]",
    listitem: "my-[0.1em] leading-[1.4]",
    listitemUnchecked: "md-task",
    listitemChecked: "md-task md-task-checked",
    nested: { listitem: "list-none md-nested" },
  },
  link: "md-link",
  linkUrl: "md-link-url",
  linkLabel: "md-link-label",
  codeBlock: "md-code-block",
  codeFence: "md-code-fence",
};
