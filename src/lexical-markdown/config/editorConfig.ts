import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorThemeClasses } from "lexical";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
} from "./features";
import { createMarkdownNodes } from "./nodes";

/**
 * Curated subset of Lexical's `EditorThemeClasses` for the Markdown nodes the
 * editor renders. The editor emits no class names of its own: every slot left
 * undefined renders as a bare semantic tag (`h1`, `blockquote`, `ul`,
 * `strong`, `em`, `code`, …) that host CSS can target directly. Pass a class
 * only where a tag cannot disambiguate the element:
 *
 * - list-item state (`listitemChecked` / `listitemUnchecked` / `nested`)
 * - `strikethrough`, the one inline format Lexical renders without a tag
 *
 * The shape mirrors `EditorThemeClasses` so the values are merged straight
 * into the theme. The custom Markdown nodes (`link`, `codeBlock`, …) are not
 * Lexical built-ins, so their `createDOM` reads these slots from the merged
 * theme directly; when undefined they emit only their stable `data-markdown-*`
 * attribute and no class. See {@link MarkdownTheme}.
 */
export interface MarkdownClassNames {
  paragraph?: string;
  quote?: string;
  text?: {
    bold?: string;
    italic?: string;
    strikethrough?: string;
    code?: string;
  };
  heading?: {
    h1?: string;
    h2?: string;
    h3?: string;
    h4?: string;
    h5?: string;
    h6?: string;
  };
  list?: {
    ul?: string;
    ol?: string;
    listitem?: string;
    listitemChecked?: string;
    listitemUnchecked?: string;
    nested?: {
      listitem?: string;
    };
  };
  link?: string;
  linkUrl?: string;
  linkLabel?: string;
  autoLink?: string;
  codeBlock?: string;
  codeFence?: string;
}

/**
 * The merged Lexical theme, widened with the custom Markdown node slots that
 * {@link MarkdownClassNames} adds. Custom nodes cast `config.theme` to this to
 * read their optional class names.
 */
export type MarkdownTheme = EditorThemeClasses &
  Pick<
    MarkdownClassNames,
    "link" | "linkUrl" | "linkLabel" | "autoLink" | "codeBlock" | "codeFence"
  >;

/**
 * Prism token classes used by the code-highlighting plugin. These are not
 * `lexical-md__*` markers but the standard `token *` hooks that Prism themes
 * rely on, so they are always present and only overridable via the raw `theme`
 * escape hatch.
 */
const CODE_HIGHLIGHT_THEME: EditorThemeClasses["codeHighlight"] = {
  atrule: "token atrule",
  attr: "token attr",
  "attr-name": "token attr-name",
  "attr-value": "token attr-value",
  boolean: "token boolean",
  builtin: "token builtin",
  cdata: "token cdata",
  char: "token char",
  "class-name": "token class-name",
  comment: "token comment",
  constant: "token constant",
  deleted: "token deleted",
  doctype: "token doctype",
  entity: "token entity",
  function: "token function",
  important: "token important",
  inserted: "token inserted",
  keyword: "token keyword",
  namespace: "token namespace",
  number: "token number",
  operator: "token operator",
  prolog: "token prolog",
  property: "token property",
  punctuation: "token punctuation",
  regex: "token regex",
  selector: "token selector",
  string: "token string",
  symbol: "token symbol",
  tag: "token tag",
  url: "token url",
  variable: "token variable",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns true for keys that must never be copied between objects: assigning to
 * them would mutate `Object.prototype` (prototype pollution) instead of the
 * target. Written as explicit `===` comparisons so static analysis (CodeQL)
 * recognizes it as a prototype-pollution barrier.
 */
function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

/**
 * Recursively merges `source` into `target`, descending into nested plain
 * objects (e.g. `text`, `heading`, `list`) and overwriting leaf strings. Used
 * to layer the curated `classNames` and the raw `theme` override on top of the
 * base theme.
 */
function deepMergeInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    if (isForbiddenKey(key)) continue;
    const sourceValue = source[key];
    if (sourceValue === undefined) continue;
    if (isPlainObject(sourceValue)) {
      const targetValue = target[key];
      const nested = isPlainObject(targetValue) ? targetValue : {};
      target[key] = deepMergeInto(nested, sourceValue);
    } else {
      target[key] = sourceValue;
    }
  }
  return target;
}

/**
 * Builds the Lexical theme from the curated `classNames` and an optional raw
 * `theme` override. The base only carries the Prism `codeHighlight` tokens;
 * every other slot is empty unless supplied, so undefined slots render as bare
 * semantic tags. Precedence: base < classNames < theme.
 */
export function createMarkdownTheme(
  classNames?: MarkdownClassNames,
  theme?: EditorThemeClasses,
): EditorThemeClasses {
  const result: EditorThemeClasses = {
    codeHighlight: { ...CODE_HIGHLIGHT_THEME },
  };
  if (classNames) {
    deepMergeInto(
      result as Record<string, unknown>,
      classNames as Record<string, unknown>,
    );
  }
  if (theme) {
    deepMergeInto(
      result as Record<string, unknown>,
      theme as Record<string, unknown>,
    );
  }
  return result;
}

interface CreateInitialConfigParams {
  namespace: string;
  onError?: (error: Error) => void;
  classNames?: MarkdownClassNames;
  theme?: EditorThemeClasses;
  features?: MarkdownFeatureFlags;
}

export function createInitialConfig({
  namespace,
  onError,
  classNames,
  theme,
  features = DEFAULT_MARKDOWN_FEATURES,
}: CreateInitialConfigParams): InitialConfigType {
  return {
    namespace,
    nodes: createMarkdownNodes(features),
    theme: createMarkdownTheme(classNames, theme),
    onError: onError ?? defaultOnError,
  };
}

function defaultOnError(error: Error): void {
  console.error(error);
}
