import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import {
  ContentEditable,
  type ContentEditableProps,
} from "@lexical/react/LexicalContentEditable";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import type { EditorThemeClasses, LexicalEditor } from "lexical";
import {
  type ReactNode,
  type RefCallback,
  type RefObject,
  useMemo,
  useRef,
} from "react";
import {
  createInitialConfig,
  type MarkdownClassNames,
} from "./config/editorConfig";
import {
  type MarkdownFeatureFlags,
  resolveMarkdownFeatures,
} from "./config/features";
import {
  createMarkdownShortcutTransformers,
  createMarkdownTransformers,
} from "./config/transformers";
import BlockquoteBehaviorPlugin from "./plugins/BlockquoteBehaviorPlugin";
import CheckListShortcutPlugin from "./plugins/CheckListShortcutPlugin";
import CodeHighlightingPlugin, {
  type LanguageAliases,
  type PrismLanguages,
} from "./plugins/CodeHighlightingPlugin";
import ControlledValuePlugin from "./plugins/ControlledValuePlugin";
import HorizontalRulePlugin from "./plugins/HorizontalRulePlugin";
import InitialValuePlugin from "./plugins/InitialValuePlugin";
import ListBehaviorPlugin from "./plugins/ListBehaviorPlugin";
import MarkdownCodeBlockPlugin from "./plugins/MarkdownCodeBlockPlugin";
import MarkdownLinkPlugin from "./plugins/MarkdownLinkPlugin";
import OnChangePlugin from "./plugins/OnChangePlugin";

export interface LexicalMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  namespace?: string;
  ariaPlaceholder?: string;
  placeholder?: ReactNode;
  className?: string;
  rootClassName?: string;
  /**
   * Curated class names for the Markdown nodes the editor renders, merged into
   * the Lexical theme. Slots left undefined render as bare semantic tags
   * (`h1`, `blockquote`, `strong`, …) so host CSS can target them by tag;
   * supply a class only where a tag cannot disambiguate the element (list-item
   * state, `strikethrough`). For best results memoize the object so the
   * editor's initial config stays stable across renders.
   */
  classNames?: MarkdownClassNames;
  /**
   * Raw Lexical theme override. Deep-merged on top of `classNames` (and the
   * built-in Prism `codeHighlight` tokens) for full control. Prefer
   * `classNames` for the common case.
   */
  theme?: EditorThemeClasses;
  contentEditableProps?: Partial<
    Omit<ContentEditableProps, "placeholder" | "aria-placeholder">
  >;
  /**
   * Debounce window in ms for onChange emission. Default 100.
   */
  onChangeDebounceMs?: number;
  /**
   * Prism grammars to use for code highlighting. When omitted, the plugin
   * falls back to whatever the host application has registered globally via
   * side-effect imports (e.g. `import "prismjs/components/prism-typescript"`).
   */
  prismLanguages?: PrismLanguages;
  /**
   * Custom aliases mapping fence language identifier to grammar key. Merged
   * with the plugin's built-in defaults (`js -> javascript`, etc.).
   */
  languageAliases?: LanguageAliases;
  /**
   * Toggle individual Markdown syntax features. Omitted keys fall back to
   * defaults (everything except `horizontalRule` is enabled).
   */
  features?: Partial<MarkdownFeatureFlags>;
  /**
   * Controls how Enter behaves inside a blockquote. With this flag (default
   * `true`), pressing Enter on an already-empty quoted paragraph exits the
   * blockquote and starts a plain paragraph after it (trailing quoted blocks
   * are preserved in a new quote). Set to `false` to keep Enter inside the
   * blockquote. Backspace always handles quote boundaries (unwrapping the
   * first line, merging adjacent quotes) regardless of this flag.
   */
  blockquoteExitOnEmptyEnter?: boolean;
  /**
   * Receives the underlying Lexical editor instance. Use it to call standard
   * Lexical APIs such as `$generateHtmlFromNodes` from `@lexical/html`:
   * `editorRef.current?.read(() => $generateHtmlFromNodes(editorRef.current!))`.
   */
  editorRef?:
    | RefCallback<LexicalEditor>
    | RefObject<LexicalEditor | null | undefined>;
}

export default function LexicalMarkdownEditor({
  value,
  onChange,
  namespace = "LexicalMarkdownEditor",
  ariaPlaceholder,
  placeholder,
  className,
  rootClassName,
  classNames,
  theme,
  contentEditableProps,
  onChangeDebounceMs,
  prismLanguages,
  languageAliases,
  features,
  blockquoteExitOnEmptyEnter = true,
  editorRef,
}: LexicalMarkdownEditorProps) {
  const resolvedFeatures = useMemo(
    () => resolveMarkdownFeatures(features),
    [features],
  );

  const initialConfig = useMemo(
    () =>
      createInitialConfig({
        namespace,
        features: resolvedFeatures,
        classNames,
        theme,
      }),
    [namespace, resolvedFeatures, classNames, theme],
  );

  const transformers = useMemo(
    () => createMarkdownTransformers(resolvedFeatures),
    [resolvedFeatures],
  );

  const shortcutTransformers = useMemo(
    () => createMarkdownShortcutTransformers(resolvedFeatures),
    [resolvedFeatures],
  );

  // Force re-mount of the LexicalComposer when the set of enabled features
  // (and therefore the registered nodes/plugins) changes; Lexical does not
  // support adding/removing nodes after initialization.
  const composerKey = useMemo(
    () => `${namespace}|${JSON.stringify(resolvedFeatures)}`,
    [namespace, resolvedFeatures],
  );

  const lastEmittedRef = useRef<string | null>(null);

  const rootClass = ["lexical-md", rootClassName].filter(Boolean).join(" ");

  const contentEditable =
    placeholder !== undefined ? (
      <ContentEditable
        {...contentEditableProps}
        className={className}
        aria-placeholder={ariaPlaceholder ?? ""}
        placeholder={<span>{placeholder}</span>}
      />
    ) : (
      <ContentEditable {...contentEditableProps} className={className} />
    );

  return (
    <LexicalComposer key={composerKey} initialConfig={initialConfig}>
      <div className={rootClass}>
        <RichTextPlugin
          contentEditable={contentEditable}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {resolvedFeatures.list && <ListPlugin />}
        {resolvedFeatures.blockquote && resolvedFeatures.list && (
          <ListBehaviorPlugin />
        )}
        <TabIndentationPlugin />
        {resolvedFeatures.list && resolvedFeatures.taskList && (
          <CheckListPlugin />
        )}
        {resolvedFeatures.list && resolvedFeatures.taskList && (
          <CheckListShortcutPlugin />
        )}
        {resolvedFeatures.link && <MarkdownLinkPlugin />}
        {resolvedFeatures.codeBlock && <MarkdownCodeBlockPlugin />}
        {resolvedFeatures.codeBlock && (
          <CodeHighlightingPlugin
            languages={prismLanguages}
            languageAliases={languageAliases}
          />
        )}
        {resolvedFeatures.horizontalRule && <HorizontalRulePlugin />}
        {resolvedFeatures.blockquote && (
          <BlockquoteBehaviorPlugin
            exitOnEmptyLine={blockquoteExitOnEmptyEnter}
            features={resolvedFeatures}
          />
        )}
        <MarkdownShortcutPlugin transformers={shortcutTransformers} />
        <InitialValuePlugin value={value} transformers={transformers} />
        <ControlledValuePlugin
          value={value}
          transformers={transformers}
          lastEmittedRef={lastEmittedRef}
        />
        <OnChangePlugin
          onChange={onChange}
          transformers={transformers}
          lastEmittedRef={lastEmittedRef}
          debounceMs={onChangeDebounceMs}
        />
        {editorRef && <EditorRefPlugin editorRef={editorRef} />}
      </div>
    </LexicalComposer>
  );
}
