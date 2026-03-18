import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  TRANSFORMERS,
} from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { EditorState } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryPanel } from "../components/HistoryPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { Toolbar } from "../components/Toolbar";
import { useHistory } from "../hooks/useHistory";

const CUSTOM_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS];

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
      $convertFromMarkdownString(content ?? "", CUSTOM_TRANSFORMERS);
    });
  });
}

interface EditorPluginsProps {
  setIsHistoryOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  pendingContent: string | null;
  onPendingConsumed: () => void;
}

// Handles draft load/save, keyboard shortcuts, and panel event listening
function EditorPlugins({
  setIsHistoryOpen,
  setIsSettingsOpen,
  pendingContent,
  onPendingConsumed,
}: EditorPluginsProps) {
  const [editor] = useLexicalComposerContext();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDraft(editor);
  }, [editor]);

  // Auto-focus editor when the window is shown via global shortcut or tray
  useEffect(() => {
    const unlisten = listen("window-shown", () => {
      editor.focus();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          invoke("copy_and_close", { content });
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  // Listen for "open-history-panel" event emitted by the tray menu
  useEffect(() => {
    const unlisten = listen("open-history-panel", () => {
      setIsHistoryOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsHistoryOpen]);

  // Listen for "open-settings-panel" event emitted by the tray menu
  useEffect(() => {
    const unlisten = listen("open-settings-panel", () => {
      setIsSettingsOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsSettingsOpen]);

  // Load a pending history entry into the editor
  useEffect(() => {
    if (pendingContent === null) return;

    let hasContent = false;
    editor.getEditorState().read(() => {
      const text = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
      hasContent = text.trim().length > 0;
    });

    if (hasContent && !window.confirm("Replace current draft with this history entry?")) {
      onPendingConsumed();
      return;
    }

    editor.update(() => {
      $convertFromMarkdownString(pendingContent, CUSTOM_TRANSFORMERS);
    });
    onPendingConsumed();
  }, [editor, pendingContent, onPendingConsumed]);

  function handleChange(editorState: EditorState) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      editorState.read(() => {
        const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        invoke("save_draft", { content });
      });
    }, 500);
  }

  return <OnChangePlugin onChange={handleChange} />;
}

export function MarkdownEditor() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const { getEntry } = useHistory();

  const handleLoadEntry = useCallback(
    async (id: string) => {
      const content = await getEntry(id);
      setPendingContent(content);
      setIsHistoryOpen(false);
    },
    [getEntry],
  );

  const handlePendingConsumed = useCallback(() => {
    setPendingContent(null);
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Toolbar
        isHistoryOpen={isHistoryOpen}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <div className="relative flex-1 overflow-hidden bg-white dark:bg-gray-900">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="h-full p-4 outline-none prose prose-sm dark:prose-invert max-w-none" />
          }
          placeholder={
            <div className="absolute top-4 left-4 text-gray-400 dark:text-gray-600 pointer-events-none">
              Start writing…
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={CUSTOM_TRANSFORMERS} />
        <HorizontalRulePlugin />
        <ListPlugin />
        <CheckListPlugin />
        <EditorPlugins
          setIsHistoryOpen={setIsHistoryOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          pendingContent={pendingContent}
          onPendingConsumed={handlePendingConsumed}
        />
        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onLoadEntry={handleLoadEntry}
        />
        <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </LexicalComposer>
  );
}
