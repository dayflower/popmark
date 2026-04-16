import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { $createParagraphNode, $getRoot, HISTORY_PUSH_TAG, type LexicalEditor } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryPanel } from "../components/HistoryPanel";
import { SendToClipboardButton } from "../components/SendToClipboardButton";
import { Toolbar } from "../components/Toolbar";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { useEditorDraftSync } from "../hooks/useEditorDraftSync";
import { useHistory } from "../hooks/useHistory";
import { useMenuEventListeners } from "../hooks/useMenuEventListeners";
import type { EditorMode } from "../types/settings";
import { matchesSendShortcut } from "../utils/hotkey";
import { EDITOR_NODES } from "./nodes";
import { CodeEnterPlugin } from "./plugins/CodeEnterPlugin";
import { CodeExitPlugin } from "./plugins/CodeExitPlugin";
import { InlineCodeEscapePlugin } from "./plugins/InlineCodeEscapePlugin";
import { InlineCodeFormatResetPlugin } from "./plugins/InlineCodeFormatResetPlugin";
import { LinkPopoverPlugin } from "./plugins/LinkPopoverPlugin";
import { ListShiftTabExitPlugin } from "./plugins/ListShiftTabExitPlugin";
import { CUSTOM_TRANSFORMERS } from "./transformers";

const initialConfig = {
  namespace: "popmark",
  theme: {
    text: {
      strikethrough: "editor-strikethrough",
      italic: "editor-italic",
    },
  },
  nodes: EDITOR_NODES,
  onError: (error: Error) => {
    console.error(error);
  },
};

function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

interface EditorPluginsProps {
  setIsHistoryOpen: (open: boolean) => void;
  onToggleHistory: () => void;
  onClearHistory: () => void;
  pendingContent: string | null;
  onPendingConsumed: () => void;
  newDocTrigger: number;
  onNew: () => void;
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  plainContent: string;
  setPlainContent: (c: string) => void;
  modeToggleFnRef: React.MutableRefObject<(() => void) | null>;
  onFocusPlain: () => void;
  copyAsRichText: boolean;
  setCopyAsRichText: (v: boolean) => void;
  sendShortcut: string;
  setSendShortcut: (v: string) => void;
  onPastePlainText: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

// Handles draft load/save, keyboard shortcuts, and panel event listening
function EditorPlugins({
  setIsHistoryOpen,
  onToggleHistory,
  onClearHistory,
  pendingContent,
  onPendingConsumed,
  newDocTrigger,
  onNew,
  editorMode,
  onModeChange,
  plainContent,
  setPlainContent,
  modeToggleFnRef,
  onFocusPlain,
  copyAsRichText,
  setCopyAsRichText,
  sendShortcut,
  setSendShortcut,
  onPastePlainText,
  textareaRef,
}: EditorPluginsProps) {
  const [editor] = useLexicalComposerContext();
  const { copyToClipboard } = useCopyToClipboard({
    editorMode,
    plainContent,
    copyAsRichText,
    editor,
  });
  const { handleChange } = useEditorDraftSync({
    editorMode,
    plainContent,
    setPlainContent,
    newDocTrigger,
    onFocusPlain,
  });

  const handleModeToggle = useCallback(() => {
    if (editorMode === "rich") {
      editor.getEditorState().read(() => {
        const md = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        setPlainContent(md);
        onModeChange("plain");
      });
    } else {
      onModeChange("rich");
    }
  }, [editor, editorMode, onModeChange, setPlainContent]);

  const handleClearAll = useCallback(() => {
    if (editorMode === "plain") {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        // Use select() + execCommand("insertText") so the clear is undoable.
        // The trade-off: undoing restores the text with the full selection still active,
        // because the browser records the pre-operation selection state as part of the
        // undo entry. No known workaround for this with the textarea + execCommand approach.
        textarea.select();
        document.execCommand("insertText", false, "");
      }
    } else {
      editor.update(
        () => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        },
        { tag: HISTORY_PUSH_TAG },
      );
      editor.focus();
    }
  }, [editor, editorMode, textareaRef]);

  useMenuEventListeners({
    editorMode,
    plainContent,
    copyAsRichText,
    setCopyAsRichText,
    setSendShortcut,
    setIsHistoryOpen,
    onToggleHistory,
    onClearHistory,
    onNew,
    onPastePlainText,
    handleModeToggle,
    handleClearAll,
  });

  // Keep the ref in sync so Toolbar and textarea keydown can call it
  useEffect(() => {
    modeToggleFnRef.current = handleModeToggle;
  }, [handleModeToggle, modeToggleFnRef]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesSendShortcut(e, sendShortcut)) {
        // Plain mode handles the shortcut in the textarea's onKeyDown
        if (editorMode === "plain") return;
        e.preventDefault();
        copyToClipboard();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Backspace") {
        e.preventDefault();
        handleClearAll();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        getCurrentWindow().hide();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copyToClipboard, editorMode, sendShortcut, handleClearAll]);

  // Load a pending history entry into the editor or textarea
  useEffect(() => {
    if (pendingContent === null) return;

    (async () => {
      if (editorMode === "plain") {
        if (plainContent.trim().length > 0) {
          const ok = await confirm("Replace current draft with this history entry?", {
            title: "Popmark",
            okLabel: "Replace",
            cancelLabel: "Cancel",
          });
          if (ok) {
            await invoke("save_draft", { content: plainContent });
            await invoke("new_document");
            setPlainContent(pendingContent);
            invoke("save_draft", { content: pendingContent });
            setTimeout(() => textareaRef.current?.setSelectionRange(0, 0), 0);
          }
          onPendingConsumed();
          return;
        }
        setPlainContent(pendingContent);
        invoke("save_draft", { content: pendingContent });
        setTimeout(() => textareaRef.current?.setSelectionRange(0, 0), 0);
        onPendingConsumed();
        return;
      }

      let hasContent = false;
      editor.getEditorState().read(() => {
        const text = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        hasContent = text.trim().length > 0;
      });

      if (hasContent) {
        const ok = await confirm("Replace current draft with this history entry?", {
          title: "Popmark",
          okLabel: "Replace",
          cancelLabel: "Cancel",
        });
        if (ok) {
          await invoke("new_document");
          editor.update(() => {
            $convertFromMarkdownString(pendingContent, CUSTOM_TRANSFORMERS);
            $getRoot().selectStart();
          });
        }
        onPendingConsumed();
        return;
      }

      editor.update(() => {
        $convertFromMarkdownString(pendingContent, CUSTOM_TRANSFORMERS);
        $getRoot().selectStart();
      });
      onPendingConsumed();
    })();
  }, [
    editor,
    pendingContent,
    onPendingConsumed,
    editorMode,
    plainContent,
    setPlainContent,
    textareaRef,
  ]);

  return <OnChangePlugin onChange={handleChange} />;
}

interface MarkdownEditorProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  richFontFamily?: string | null;
  richFontSize?: number | null;
  plainFontFamily?: string | null;
  plainFontSize?: number | null;
  richShowSyntaxMarkers?: boolean;
}

export function MarkdownEditor({
  editorMode,
  onModeChange,
  richFontFamily,
  richFontSize,
  plainFontFamily,
  plainFontSize,
  richShowSyntaxMarkers = true,
}: MarkdownEditorProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [newDocTrigger, setNewDocTrigger] = useState(0);
  const [plainContent, setPlainContent] = useState("");
  const [copyAsRichText, setCopyAsRichText] = useState(false);
  const [sendShortcut, setSendShortcut] = useState("super+enter");
  const { entries, loading, loadHistory, getEntry, deleteEntry, clearHistory } = useHistory();
  const modeToggleFnRef = useRef<(() => void) | null>(null);
  const plainDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const { copyToClipboard } = useCopyToClipboard({
    editorMode,
    plainContent,
    copyAsRichText,
    editor: editorRef.current,
  });

  // Load settings on mount
  useEffect(() => {
    invoke<{ copy_as_rich_text: boolean; send_shortcut?: string }>("get_settings").then((s) => {
      setCopyAsRichText(s.copy_as_rich_text ?? false);
      setSendShortcut(s.send_shortcut ?? "super+enter");
    });
  }, []);

  const handleNew = useCallback(() => {
    const doNew = () =>
      invoke("new_document").then(() => {
        setNewDocTrigger((n) => n + 1);
      });
    if (editorMode === "plain") {
      invoke("save_draft", { content: plainContent }).then(() => doNew());
    } else {
      doNew();
    }
  }, [editorMode, plainContent]);

  const handleLoadEntry = useCallback(
    async (id: string) => {
      const content = await getEntry(id);
      setPendingContent(content);
      setIsHistoryOpen(false);
    },
    [getEntry],
  );

  const handleClearHistory = useCallback(async () => {
    const ok = await confirm("Clear all history entries? This cannot be undone.", {
      title: "Clear History",
      okLabel: "Clear All",
      cancelLabel: "Cancel",
      kind: "warning",
    });
    if (ok) {
      clearHistory();
    }
  }, [clearHistory]);

  const handlePendingConsumed = useCallback(() => {
    setPendingContent(null);
  }, []);

  const handleFocusPlain = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const handlePastePlainText = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = plainContent.slice(0, start) + text + plainContent.slice(end);
      setPlainContent(newValue);
      invoke("save_draft", { content: newValue });
      // Restore cursor after inserted text
      requestAnimationFrame(() => {
        ta.selectionStart = start + text.length;
        ta.selectionEnd = start + text.length;
      });
    },
    [plainContent],
  );

  // Load history on mount so the initial Recall Last enabled state can be set
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Sync Recall Last menu item enabled state whenever history entries change
  useEffect(() => {
    invoke("set_recall_last_enabled", { enabled: entries.length > 0 });
  }, [entries]);

  // Listen for Edit > Recall Last menu event (⌘R)
  useEffect(() => {
    const unlisten = listen("menu-recall-last", async () => {
      const content = await invoke<string>("recall_last_history").catch(() => null);
      if (content !== null) {
        setPendingContent(content);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Sync history panel open state to the View > History menu item checkmark
  useEffect(() => {
    invoke("set_history_panel_open", { open: isHistoryOpen });
  }, [isHistoryOpen]);

  // Sync editor mode to the View > Editor Mode submenu checkmarks
  useEffect(() => {
    invoke("set_editor_mode_menu", { mode: editorMode });
  }, [editorMode]);

  // Load history entries when the panel opens
  useEffect(() => {
    if (isHistoryOpen) {
      loadHistory();
    }
  }, [isHistoryOpen, loadHistory]);

  function handlePlainChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setPlainContent(value);
    if (plainDebounceTimerRef.current) clearTimeout(plainDebounceTimerRef.current);
    plainDebounceTimerRef.current = setTimeout(() => {
      invoke("save_draft", { content: value });
    }, 500);
  }

  function handlePlainKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (matchesSendShortcut(e, sendShortcut)) {
      e.preventDefault();
      copyToClipboard();
      return;
    }
    // Escape and Ctrl+Shift+M are handled by window-level listener in EditorPlugins
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Toolbar
        isHistoryOpen={isHistoryOpen}
        onNew={handleNew}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
        editorMode={editorMode}
        onModeToggle={() => modeToggleFnRef.current?.()}
      />
      <div className="relative flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex-1 overflow-hidden relative">
          {editorMode === "plain" ? (
            <textarea
              ref={textareaRef}
              value={plainContent}
              onChange={handlePlainChange}
              onKeyDown={handlePlainKeyDown}
              className="w-full h-full p-4 outline-none resize-none font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900"
              style={{
                fontFamily: plainFontFamily ?? undefined,
                fontSize: plainFontSize ? `${plainFontSize}px` : undefined,
              }}
              placeholder="Start writing…"
              // biome-ignore lint/a11y/noAutofocus: intentional — mirrors rich mode focus behavior
              autoFocus
              spellCheck={false}
            />
          ) : (
            <>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className={`w-full h-full overflow-y-auto p-4 outline-none prose prose-sm dark:prose-invert${richShowSyntaxMarkers ? " show-syntax-markers" : ""}`}
                    style={{
                      fontFamily: richFontFamily ?? undefined,
                      fontSize: richFontSize ? `${richFontSize}px` : undefined,
                      maxWidth: "none",
                    }}
                  />
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
              <TabIndentationPlugin />
              <LinkPopoverPlugin />
              <CodeEnterPlugin />
              <CodeExitPlugin />
              <ListShiftTabExitPlugin />
              <InlineCodeFormatResetPlugin />
              <InlineCodeEscapePlugin />
            </>
          )}
          <EditorRefPlugin editorRef={editorRef} />
          <EditorPlugins
            setIsHistoryOpen={setIsHistoryOpen}
            onToggleHistory={() => setIsHistoryOpen((v) => !v)}
            onClearHistory={handleClearHistory}
            pendingContent={pendingContent}
            onPendingConsumed={handlePendingConsumed}
            newDocTrigger={newDocTrigger}
            onNew={handleNew}
            editorMode={editorMode}
            onModeChange={onModeChange}
            plainContent={plainContent}
            setPlainContent={setPlainContent}
            modeToggleFnRef={modeToggleFnRef}
            onFocusPlain={handleFocusPlain}
            copyAsRichText={copyAsRichText}
            setCopyAsRichText={setCopyAsRichText}
            sendShortcut={sendShortcut}
            setSendShortcut={setSendShortcut}
            onPastePlainText={handlePastePlainText}
            textareaRef={textareaRef}
          />
          <HistoryPanel
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            onLoadEntry={handleLoadEntry}
            entries={entries}
            loading={loading}
            onDeleteEntry={deleteEntry}
            onClearAll={clearHistory}
          />
        </div>
        <div className="flex justify-end items-center px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none">
          <SendToClipboardButton
            editorMode={editorMode}
            plainContent={plainContent}
            copyAsRichText={copyAsRichText}
            sendShortcut={sendShortcut}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}
