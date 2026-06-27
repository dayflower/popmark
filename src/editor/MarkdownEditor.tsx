import { $convertToMarkdownString } from "@lexical/markdown";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { LexicalEditor } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryPanel } from "../components/HistoryPanel";
import { SendToClipboardButton } from "../components/SendToClipboardButton";
import { Toolbar } from "../components/Toolbar";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { useEditorDraftSync } from "../hooks/useEditorDraftSync";
import { useHistory } from "../hooks/useHistory";
import { useMenuEventListeners } from "../hooks/useMenuEventListeners";
import { LexicalMarkdownEditor } from "../lexical-markdown";
import type { EditorMode } from "../types/settings";
import { matchesSendShortcut } from "../utils/hotkey";
import {
  MARKUP_MODE_ATTR,
  POPMARK_CLASS_NAMES,
  POPMARK_FEATURES,
  POPMARK_TRANSFORMERS,
  PRISM_LANGUAGES,
} from "./markdownTheme";

interface MarkdownEditorProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  richFontFamily?: string | null;
  richFontSize?: number | null;
  plainFontFamily?: string | null;
  plainFontSize?: number | null;
  richShowSyntaxMarkers?: boolean;
  richSyntaxHighlight?: boolean;
}

export function MarkdownEditor({
  editorMode,
  onModeChange,
  richFontFamily,
  richFontSize,
  plainFontFamily,
  plainFontSize,
  richShowSyntaxMarkers = true,
  richSyntaxHighlight = true,
}: MarkdownEditorProps) {
  // Single source of truth: the markdown string shared by both editor modes.
  const [content, setContent] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [newDocTrigger, setNewDocTrigger] = useState(0);
  const [copyAsRichText, setCopyAsRichText] = useState(false);
  const [sendShortcut, setSendShortcut] = useState("super+enter");
  const { entries, loading, loadHistory, getEntry, clearHistory, deleteEntry } = useHistory();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);

  const focusPlain = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const { copyToClipboard } = useCopyToClipboard({
    editorMode,
    content,
    copyAsRichText,
    editorRef,
  });

  useEditorDraftSync({
    editorMode,
    content,
    setContent,
    newDocTrigger,
    editorRef,
    focusPlain,
  });

  // Load settings on mount
  useEffect(() => {
    invoke<{ copy_as_rich_text: boolean; send_shortcut?: string }>("get_settings").then((s) => {
      setCopyAsRichText(s.copy_as_rich_text ?? false);
      setSendShortcut(s.send_shortcut ?? "super+enter");
    });
  }, []);

  const handleModeToggle = useCallback(() => {
    onModeChange(editorMode === "rich" ? "plain" : "rich");
  }, [editorMode, onModeChange]);

  // Persist the rich/markdown copy format and reflect it in local state.
  const applyCopyFormat = useCallback((rich: boolean) => {
    setCopyAsRichText(rich);
    invoke("save_copy_as_rich_text", { value: rich });
  }, []);

  const handleClearAll = useCallback(() => {
    if (editorMode === "plain") {
      const textarea = textareaRef.current;
      if (textarea) {
        // Use select() + execCommand("insertText") so the clear stays undoable
        // in the textarea; the onChange handler keeps `content` in sync.
        textarea.focus();
        textarea.select();
        document.execCommand("insertText", false, "");
      }
    } else {
      setContent("");
      editorRef.current?.focus();
    }
  }, [editorMode]);

  const handleExport = useCallback(() => {
    if (editorMode === "plain" || !editorRef.current) {
      invoke("export_file", { content, defaultName: "note.md" });
      return;
    }
    editorRef.current.getEditorState().read(() => {
      const markdown = $convertToMarkdownString(POPMARK_TRANSFORMERS);
      invoke("export_file", { content: markdown, defaultName: "note.md" });
    });
  }, [editorMode, content]);

  const handleNew = useCallback(() => {
    // Persist the current draft (new_document archives it to history), then
    // clear; the draft-sync hook reloads the now-empty draft on the trigger.
    invoke("save_draft", { content })
      .then(() => invoke("new_document"))
      .then(() => setNewDocTrigger((n) => n + 1));
  }, [content]);

  const handleLoadEntry = useCallback(
    async (id: string) => {
      const entry = await getEntry(id);
      setPendingContent(entry);
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

  const handlePastePlainText = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      setContent(content.slice(0, start) + text + content.slice(end));
      requestAnimationFrame(() => {
        ta.selectionStart = start + text.length;
        ta.selectionEnd = start + text.length;
      });
    },
    [content],
  );

  useMenuEventListeners({
    editorMode,
    editorRef,
    copyToClipboard,
    setCopyAsRichText,
    setSendShortcut,
    applyCopyFormat,
    setIsHistoryOpen,
    onToggleHistory: () => setIsHistoryOpen((v) => !v),
    onClearHistory: handleClearHistory,
    onNew: handleNew,
    onExport: handleExport,
    onPastePlainText: handlePastePlainText,
    handleModeToggle,
    handleClearAll,
  });

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
      const recalled = await invoke<string>("recall_last_history").catch(() => null);
      if (recalled !== null) {
        setPendingContent(recalled);
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

  // Sync copy format to the Copy Format submenu (app menu + tray). Plain mode
  // forces Markdown, so the submenu is disabled there.
  useEffect(() => {
    invoke("set_copy_format_menu", { rich: copyAsRichText, enabled: editorMode === "rich" });
  }, [copyAsRichText, editorMode]);

  // Load history entries when the panel opens
  useEffect(() => {
    if (isHistoryOpen) {
      loadHistory();
    }
  }, [isHistoryOpen, loadHistory]);

  // Window-level keyboard shortcuts
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
      // ⌘⇧M toggles the copy format (rich ⇄ markdown); markdown is forced in
      // plain mode, so the toggle only applies in rich mode.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (editorMode === "rich") applyCopyFormat(!copyAsRichText);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        getCurrentWindow().hide();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copyToClipboard, editorMode, sendShortcut, handleClearAll, applyCopyFormat, copyAsRichText]);

  // Load a pending history entry into the editor (with confirmation if there
  // is existing content). new_document archives the current draft to history.
  useEffect(() => {
    if (pendingContent === null) return;
    (async () => {
      if (content.trim().length > 0) {
        const ok = await confirm("Replace current draft with this history entry?", {
          title: "Popmark",
          okLabel: "Replace",
          cancelLabel: "Cancel",
        });
        if (ok) {
          await invoke("save_draft", { content });
          await invoke("new_document");
          setContent(pendingContent);
          if (editorMode === "rich") {
            editorRef.current?.focus();
          } else {
            requestAnimationFrame(() => textareaRef.current?.setSelectionRange(0, 0));
          }
        }
        handlePendingConsumed();
        return;
      }
      setContent(pendingContent);
      handlePendingConsumed();
    })();
  }, [pendingContent, content, editorMode, handlePendingConsumed]);

  function handlePlainKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (matchesSendShortcut(e, sendShortcut)) {
      e.preventDefault();
      copyToClipboard();
    }
    // Escape and Ctrl+Shift+Backspace are handled by the window-level listener
  }

  return (
    <>
      <Toolbar
        isHistoryOpen={isHistoryOpen}
        onNew={handleNew}
        onExport={handleExport}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
        editorMode={editorMode}
        onModeToggle={handleModeToggle}
      />
      <div className="relative flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex-1 overflow-hidden relative">
          {editorMode === "plain" ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
            <div className="h-full" {...(richShowSyntaxMarkers ? { [MARKUP_MODE_ATTR]: "" } : {})}>
              <LexicalMarkdownEditor
                value={content}
                onChange={setContent}
                editorRef={editorRef}
                features={POPMARK_FEATURES}
                classNames={POPMARK_CLASS_NAMES}
                prismLanguages={richSyntaxHighlight ? PRISM_LANGUAGES : undefined}
                rootClassName="h-full"
                className="lexical-md__content w-full h-full overflow-y-auto p-4 outline-none text-sm text-gray-900 dark:text-gray-100"
                contentEditableProps={{
                  style: {
                    fontFamily: richFontFamily ?? undefined,
                    fontSize: richFontSize ? `${richFontSize}px` : undefined,
                  },
                }}
                placeholder={
                  <span className="absolute top-4 left-4 text-gray-400 dark:text-gray-600 pointer-events-none">
                    Start writing…
                  </span>
                }
                ariaPlaceholder="Start writing…"
              />
            </div>
          )}
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
        <div className="popmark-footer flex justify-end items-center px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none">
          <SendToClipboardButton
            onSend={copyToClipboard}
            sendShortcut={sendShortcut}
            copyAsRichText={copyAsRichText}
            editorMode={editorMode}
            onSetCopyFormat={applyCopyFormat}
          />
        </div>
      </div>
    </>
  );
}
