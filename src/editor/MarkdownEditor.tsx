import { $isCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { $createListNode, $isListItemNode, ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  TRANSFORMERS,
} from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
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
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getNearestNodeOfType } from "@lexical/utils";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  type EditorState,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryPanel } from "../components/HistoryPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { Toolbar } from "../components/Toolbar";
import { useHistory } from "../hooks/useHistory";

// Support both "- [ ] " and "-[ ] " (with or without space between dash and bracket)
const CUSTOM_CHECK_LIST = {
  ...CHECK_LIST,
  regExp: /^(\s*)[-*+]\s?(\[(\s|x)?\])\s/i,
};
const CUSTOM_TRANSFORMERS = [CUSTOM_CHECK_LIST, ...TRANSFORMERS];

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

// Handles Enter key inside code blocks:
// - Typing "```" then Enter exits the code block
// - Prevents double-Enter from exiting (built-in CodeNode behavior)
function CodeEnterPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (e) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();

        // Case 1: cursor is on CodeNode element itself (double-Enter exit would fire)
        if ($isCodeNode(anchorNode)) {
          e?.preventDefault();
          editor.update(() => {
            // Move cursor back inside the code block to prevent exit
            const lastDescendant = anchorNode.getLastDescendant();
            if (lastDescendant && $isTextNode(lastDescendant)) {
              lastDescendant.select(lastDescendant.getTextContentSize());
            } else {
              const lineBreak = $createLineBreakNode();
              anchorNode.append(lineBreak);
            }
          });
          return true;
        }

        // Case 2: cursor is inside a code block text node
        const parent = anchorNode.getParent();
        if (!$isCodeNode(parent)) return false;

        // "```" on the current line → exit the code block
        if (anchorNode.getTextContent() === "```") {
          e?.preventDefault();
          editor.update(() => {
            anchorNode.remove();
            const para = $createParagraphNode();
            parent.insertAfter(para);
            para.select();
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);
  return null;
}

// Allows exiting a code block by pressing ArrowDown at the last line
function CodeExitPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (e) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();
        const parent = anchorNode.getParent();
        if (!$isCodeNode(parent)) return false;
        if (anchorNode !== parent.getLastChild()) return false;
        if (selection.anchor.offset < anchorNode.getTextContentSize()) return false;
        e?.preventDefault();
        editor.update(() => {
          const para = $createParagraphNode();
          parent.insertAfter(para);
          para.select();
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}

// Allows exiting list mode by pressing Shift+Tab on a level-1 list item
function ListShiftTabExitPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (e) => {
        if (!e?.shiftKey) return false;
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();
        const listItem = $getNearestNodeOfType(anchorNode, ListItemNode);
        if (!listItem) return false;
        const list = listItem.getParent();
        if (!(list instanceof ListNode)) return false;
        // If parent of the list is a ListItemNode, we're nested — let default Shift+Tab handle it
        if ($isListItemNode(list.getParent())) return false;

        e.preventDefault();
        editor.update(() => {
          const para = $createParagraphNode();
          for (const child of listItem.getChildren()) {
            para.append(child);
          }
          const listChildren = list.getChildren();
          const itemIndex = listItem.getIndexWithinParent();
          const afterItems = listChildren.slice(itemIndex + 1);

          if (listChildren.length === 1) {
            list.replace(para);
          } else if (itemIndex === 0) {
            list.insertBefore(para);
            listItem.remove();
          } else if (afterItems.length === 0) {
            list.insertAfter(para);
            listItem.remove();
          } else {
            // Middle: split list — items after go to a new list
            const newList = $createListNode(list.getListType());
            for (const item of afterItems) {
              item.remove();
              newList.append(item);
            }
            list.insertAfter(newList);
            list.insertAfter(para);
            listItem.remove();
          }
          para.select();
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);
  return null;
}

interface EditorPluginsProps {
  setIsHistoryOpen: (open: boolean) => void;
  onToggleHistory: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  pendingContent: string | null;
  onPendingConsumed: () => void;
  newDocTrigger: number;
  onNew: () => void;
}

// Handles draft load/save, keyboard shortcuts, and panel event listening
function EditorPlugins({
  setIsHistoryOpen,
  onToggleHistory,
  setIsSettingsOpen,
  pendingContent,
  onPendingConsumed,
  newDocTrigger,
  onNew,
}: EditorPluginsProps) {
  const [editor] = useLexicalComposerContext();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDraft(editor);
  }, [editor]);

  // Reload editor after new_document IPC clears the draft
  useEffect(() => {
    if (newDocTrigger === 0) return;
    loadDraft(editor);
  }, [newDocTrigger, editor]);

  // Reload draft and auto-focus editor when the window is shown via global shortcut or tray
  useEffect(() => {
    const unlisten = listen("window-shown", () => {
      loadDraft(editor);
      editor.focus();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          invoke("copy_to_clipboard", { content });
        });
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        getCurrentWindow().hide();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  // Listen for menu bar "New Document" event
  useEffect(() => {
    const unlisten = listen("menu-new-document", () => {
      onNew();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onNew]);

  // Listen for menu bar "Export…" event
  useEffect(() => {
    const unlisten = listen("menu-export", () => {
      editor.getEditorState().read(() => {
        const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        invoke("export_file", { content });
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor]);

  // Listen for menu bar "Send to Clipboard" event
  useEffect(() => {
    const unlisten = listen("menu-send-to-clipboard", () => {
      editor.getEditorState().read(() => {
        const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        invoke("copy_to_clipboard", { content });
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor]);

  // Listen for "open-history-panel" event emitted by the tray menu (open-only)
  useEffect(() => {
    const unlisten = listen("open-history-panel", () => {
      setIsHistoryOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsHistoryOpen]);

  // Listen for menu bar View > History toggle event
  useEffect(() => {
    const unlisten = listen("menu-toggle-history", () => {
      onToggleHistory();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onToggleHistory]);

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
  const [newDocTrigger, setNewDocTrigger] = useState(0);
  const { getEntry } = useHistory();

  const handleNew = useCallback(() => {
    invoke("new_document").then(() => {
      setNewDocTrigger((n) => n + 1);
    });
  }, []);

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

  // Sync history panel open state to the View > History menu item checkmark
  useEffect(() => {
    invoke("set_history_panel_open", { open: isHistoryOpen });
  }, [isHistoryOpen]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Toolbar
        isHistoryOpen={isHistoryOpen}
        onNew={handleNew}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
      />
      <div className="relative flex-1 overflow-hidden bg-white dark:bg-gray-900">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="h-full overflow-y-auto p-4 outline-none prose prose-sm dark:prose-invert max-w-none" />
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
        <ClickableLinkPlugin newTab={false} />
        <CodeEnterPlugin />
        <CodeExitPlugin />
        <ListShiftTabExitPlugin />
        <EditorPlugins
          setIsHistoryOpen={setIsHistoryOpen}
          onToggleHistory={() => setIsHistoryOpen((v) => !v)}
          setIsSettingsOpen={setIsSettingsOpen}
          pendingContent={pendingContent}
          onPendingConsumed={handlePendingConsumed}
          newDocTrigger={newDocTrigger}
          onNew={handleNew}
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
