import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { invoke } from "@tauri-apps/api/core";
import type { EditorState } from "lexical";
import { useEffect, useRef } from "react";
import { Toolbar } from "../components/Toolbar";

const initialConfig = {
  namespace: "popmark",
  nodes: [
    HeadingNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
    HorizontalRuleNode,
  ],
  onError: (error: Error) => {
    console.error(error);
  },
};

function loadDraft(editor: ReturnType<typeof useLexicalComposerContext>[0]) {
  invoke<string>("get_draft").then((content) => {
    editor.update(() => {
      $convertFromMarkdownString(content ?? "", TRANSFORMERS);
    });
  });
}

// Loads draft from backend on mount/focus and sets up ⌘Return keybind
function EditorPlugins() {
  const [editor] = useLexicalComposerContext();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDraft(editor);
  }, [editor]);

  useEffect(() => {
    function handleFocus() {
      loadDraft(editor);
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [editor]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(TRANSFORMERS);
          invoke("copy_and_close", { content });
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  function handleChange(editorState: EditorState) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      editorState.read(() => {
        const content = $convertToMarkdownString(TRANSFORMERS);
        invoke("save_draft", { content });
      });
    }, 500);
  }

  return <OnChangePlugin onChange={handleChange} />;
}

export function MarkdownEditor() {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Toolbar />
      <div className="relative h-full">
        <RichTextPlugin
          contentEditable={<ContentEditable className="h-full p-4 outline-none" />}
          placeholder={
            <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
              Start writing...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <HorizontalRulePlugin />
        <EditorPlugins />
      </div>
    </LexicalComposer>
  );
}
