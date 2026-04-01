import { $isCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code";
import { $generateHtmlFromNodes } from "@lexical/html";
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
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  $parseSerializedNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createEditor,
  type EditorState,
  IS_CODE,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
  SELECTION_CHANGE_COMMAND,
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
  theme: {
    text: {
      strikethrough: "editor-strikethrough",
      italic: "editor-italic",
    },
  },
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

// Prevents IS_CODE from sticking in two scenarios:
// 1. Editor becomes empty: Lexical skips format-reset when root text is empty, so new
//    input would appear inside a code span with no escape. Clear IS_CODE on every
//    SELECTION_CHANGE while the editor is empty.
// 2. Cursor at right boundary of an IS_CODE TextNode: after MarkdownShortcutPlugin
//    fires and the user navigates away then back, IS_CODE re-derives from the anchor
//    node. Clear it when the cursor is at offset === textContentSize and the next
//    sibling is not also IS_CODE, so the next keypress inserts plain text outside.
function InlineCodeFormatResetPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        // Case 1: editor is empty
        if ($getRoot().getTextContent() === "") {
          if (selection.format & IS_CODE) {
            selection.format &= ~IS_CODE;
            selection.dirty = true;
          }
          return false;
        }

        // Case 2: cursor at right boundary of an IS_CODE TextNode
        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if (
          $isTextNode(anchorNode) &&
          anchorNode.getFormat() & IS_CODE &&
          anchor.offset === anchorNode.getTextContentSize()
        ) {
          const next = anchorNode.getNextSibling();
          if (next === null || !($isTextNode(next) && next.getFormat() & IS_CODE)) {
            selection.format &= ~IS_CODE;
            selection.dirty = true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}

// Returns the IS_CODE TextNode if the cursor is at its right boundary AND it is the very
// last node in the editor (i.e. no text follows the code span). Must be called inside a
// Lexical read or update context.
function $getTrailingCodeEndNode() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  if (!$isTextNode(anchorNode)) return null;
  if (!(anchorNode.getFormat() & IS_CODE)) return null;
  if (anchor.offset !== anchorNode.getTextContentSize()) return null;
  if ($getRoot().getLastDescendant() !== anchorNode) return null;
  return anchorNode;
}

// When the cursor is at the right end of an inline code span that is also the last node
// in the editor, pressing → or ` inserts a plain-text space and moves the cursor there.
// This gives visible feedback that the cursor has escaped the code span.
function InlineCodeEscapePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const insertEscapeSpace = () => {
      editor.update(() => {
        const node = $getTrailingCodeEndNode();
        if (!node) return;
        const spaceNode = $createTextNode(" ");
        node.insertAfter(spaceNode);
        spaceNode.select(1, 1);
      });
    };

    const unregisterArrowRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (e) => {
        if (!$getTrailingCodeEndNode()) return false;
        e?.preventDefault();
        insertEscapeSpace();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // Backtick is not a named Lexical command; intercept at the DOM level
    const root = editor.getRootElement();
    const handleBacktick = (e: KeyboardEvent) => {
      if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey) return;
      let shouldHandle = false;
      editor.getEditorState().read(() => {
        shouldHandle = $getTrailingCodeEndNode() !== null;
      });
      if (!shouldHandle) return;
      e.preventDefault();
      insertEscapeSpace();
    };
    root?.addEventListener("keydown", handleBacktick);

    return () => {
      unregisterArrowRight();
      root?.removeEventListener("keydown", handleBacktick);
    };
  }, [editor]);
  return null;
}

interface SendToClipboardButtonProps {
  editorMode: "rich" | "plain";
  plainContent: string;
  copyAsRichText: boolean;
}

function SendToClipboardButton({
  editorMode,
  plainContent,
  copyAsRichText,
}: SendToClipboardButtonProps) {
  const [editor] = useLexicalComposerContext();

  function handleClick() {
    if (editorMode === "plain") {
      invoke("copy_to_clipboard", { content: plainContent });
    } else {
      editor.getEditorState().read(() => {
        const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        const htmlContent = copyAsRichText ? $generateHtmlFromNodes(editor) : undefined;
        invoke("copy_to_clipboard", { content, htmlContent });
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 px-3 py-1.5 text-sm cursor-default"
    >
      Send to clipboard (⌘↵)
    </button>
  );
}

interface EditorPluginsProps {
  setIsHistoryOpen: (open: boolean) => void;
  onToggleHistory: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  onClearHistory: () => void;
  pendingContent: string | null;
  onPendingConsumed: () => void;
  newDocTrigger: number;
  onNew: () => void;
  editorMode: "rich" | "plain";
  onModeChange: (mode: "rich" | "plain") => void;
  plainContent: string;
  setPlainContent: (c: string) => void;
  modeToggleFnRef: React.MutableRefObject<(() => void) | null>;
  onFocusPlain: () => void;
  copyAsRichText: boolean;
  onPastePlainText: (text: string) => void;
}

// Handles draft load/save, keyboard shortcuts, and panel event listening
function EditorPlugins({
  setIsHistoryOpen,
  onToggleHistory,
  setIsSettingsOpen,
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
  onPastePlainText,
}: EditorPluginsProps) {
  const [editor] = useLexicalComposerContext();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEditorModeRef = useRef(editorMode);

  const loadDraftForMode = useCallback(
    (mode: "rich" | "plain") => {
      invoke<string>("get_draft").then((content) => {
        if (mode === "plain") {
          setPlainContent(content ?? "");
        } else {
          editor.update(() => {
            $convertFromMarkdownString(content ?? "", CUSTOM_TRANSFORMERS);
          });
        }
      });
    },
    [editor, setPlainContent],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
  useEffect(() => {
    loadDraftForMode(editorMode);
  }, []);

  // Reload editor after new_document IPC clears the draft
  useEffect(() => {
    if (newDocTrigger === 0) return;
    loadDraftForMode(editorMode);
  }, [newDocTrigger, loadDraftForMode, editorMode]);

  // Reload draft and auto-focus editor when the window is shown via global shortcut or tray
  useEffect(() => {
    const unlisten = listen("window-shown", () => {
      loadDraftForMode(editorMode);
      if (editorMode === "rich") {
        editor.focus();
      } else {
        onFocusPlain();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, loadDraftForMode, onFocusPlain]);

  // Load plainContent into editor when switching plain → rich
  useEffect(() => {
    if (prevEditorModeRef.current === "plain" && editorMode === "rich") {
      editor.update(() => {
        $convertFromMarkdownString(plainContent, CUSTOM_TRANSFORMERS);
      });
    }
    prevEditorModeRef.current = editorMode;
  }, [editorMode, editor, plainContent]);

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

  // Keep the ref in sync so Toolbar and textarea keydown can call it
  useEffect(() => {
    modeToggleFnRef.current = handleModeToggle;
  }, [handleModeToggle, modeToggleFnRef]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        // Plain mode handles Cmd+Enter in the textarea's onKeyDown
        if (editorMode === "plain") return;
        e.preventDefault();
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          const htmlContent = copyAsRichText ? $generateHtmlFromNodes(editor) : undefined;
          invoke("copy_to_clipboard", { content, htmlContent });
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
  }, [editor, editorMode, copyAsRichText]);

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
      if (editorMode === "plain") {
        invoke("export_file", { content: plainContent, defaultName: "note.md" });
      } else {
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          invoke("export_file", { content, defaultName: "note.md" });
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, plainContent]);

  // Listen for menu bar "Send to Clipboard" event
  useEffect(() => {
    const unlisten = listen("menu-send-to-clipboard", () => {
      if (editorMode === "plain") {
        invoke("copy_to_clipboard", { content: plainContent });
      } else {
        editor.getEditorState().read(() => {
          const content = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
          const htmlContent = copyAsRichText ? $generateHtmlFromNodes(editor) : undefined;
          invoke("copy_to_clipboard", { content, htmlContent });
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, plainContent, copyAsRichText]);

  // Listen for "Paste and Match Style" menu event
  useEffect(() => {
    const unlisten = listen("menu-paste-and-match-style", async () => {
      const text = await invoke<string>("read_clipboard_text").catch(() => null);
      if (text == null) return;
      if (editorMode === "plain") {
        onPastePlainText(text);
      } else {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertText(text);
          }
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, onPastePlainText]);

  // Listen for "Paste from Markdown" menu event
  useEffect(() => {
    const unlisten = listen("menu-paste-from-markdown", async () => {
      const text = await invoke<string>("read_clipboard_text").catch(() => null);
      if (!text) return;
      if (editorMode === "plain") {
        onPastePlainText(text);
      } else {
        const tempEditor = createEditor({
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
        });
        await new Promise<void>((resolve) => {
          tempEditor.update(
            () => {
              $convertFromMarkdownString(text, CUSTOM_TRANSFORMERS);
            },
            { onUpdate: resolve },
          );
        });
        const { root } = tempEditor.getEditorState().toJSON();
        const serializedNodes = root.children;
        editor.update(() => {
          $insertNodes(serializedNodes.map((json) => $parseSerializedNode(json)));
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editor, editorMode, onPastePlainText]);

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

  // Listen for menu bar View > Toggle Editor Mode event (⌘⇧M via native menu)
  useEffect(() => {
    const unlisten = listen("menu-toggle-editor-mode", () => {
      handleModeToggle();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleModeToggle]);

  // Listen for View > Clear History… menu event
  useEffect(() => {
    const unlisten = listen("menu-clear-history", () => {
      onClearHistory();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onClearHistory]);

  // Listen for "open-settings-panel" event emitted by the tray menu
  useEffect(() => {
    const unlisten = listen("open-settings-panel", () => {
      setIsSettingsOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsSettingsOpen]);

  // Load a pending history entry into the editor or textarea
  useEffect(() => {
    if (pendingContent === null) return;

    if (editorMode === "plain") {
      if (
        plainContent.trim().length > 0 &&
        !window.confirm("Replace current draft with this history entry?")
      ) {
        onPendingConsumed();
        return;
      }
      setPlainContent(pendingContent);
      invoke("save_draft", { content: pendingContent });
      onPendingConsumed();
      return;
    }

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
  }, [editor, pendingContent, onPendingConsumed, editorMode, plainContent, setPlainContent]);

  function handleChange(editorState: EditorState) {
    if (editorMode === "plain") return;
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

interface MarkdownEditorProps {
  editorMode: "rich" | "plain";
  onModeChange: (mode: "rich" | "plain") => void;
}

export function MarkdownEditor({ editorMode, onModeChange }: MarkdownEditorProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [newDocTrigger, setNewDocTrigger] = useState(0);
  const [plainContent, setPlainContent] = useState("");
  const [copyAsRichText, setCopyAsRichText] = useState(false);
  const { entries, loading, loadHistory, getEntry, deleteEntry, clearHistory } = useHistory();
  const modeToggleFnRef = useRef<(() => void) | null>(null);
  const plainDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load copyAsRichText from settings; re-run after settings panel closes
  const loadCopyAsRichText = useCallback(() => {
    invoke<{ copy_as_rich_text: boolean }>("get_settings").then((s) => {
      setCopyAsRichText(s.copy_as_rich_text ?? false);
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
  useEffect(() => {
    loadCopyAsRichText();
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

  const handleClearHistory = useCallback(() => {
    setShowClearHistoryConfirm(true);
  }, []);

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

  // Sync history panel open state to the View > History menu item checkmark
  useEffect(() => {
    invoke("set_history_panel_open", { open: isHistoryOpen });
  }, [isHistoryOpen]);

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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      invoke("copy_to_clipboard", { content: plainContent });
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
              placeholder="Start writing…"
              // biome-ignore lint/a11y/noAutofocus: intentional — mirrors rich mode focus behavior
              autoFocus
              spellCheck={false}
            />
          ) : (
            <>
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
              <InlineCodeFormatResetPlugin />
              <InlineCodeEscapePlugin />
            </>
          )}
          <EditorPlugins
            setIsHistoryOpen={setIsHistoryOpen}
            onToggleHistory={() => setIsHistoryOpen((v) => !v)}
            setIsSettingsOpen={setIsSettingsOpen}
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
            onPastePlainText={handlePastePlainText}
          />
        </div>
        <div className="flex justify-end items-center px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none">
          <SendToClipboardButton
            editorMode={editorMode}
            plainContent={plainContent}
            copyAsRichText={copyAsRichText}
          />
        </div>
        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onLoadEntry={handleLoadEntry}
          entries={entries}
          loading={loading}
          onDeleteEntry={deleteEntry}
        />
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            loadCopyAsRichText();
          }}
        />
        {showClearHistoryConfirm && (
          <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Clear History"
              tabIndex={-1}
              className="w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowClearHistoryConfirm(false);
              }}
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Clear all history entries? This cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  ref={(el) => {
                    el?.focus();
                  }}
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 cursor-default"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setShowClearHistoryConfirm(false);
                  }}
                  className="px-4 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 cursor-default"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LexicalComposer>
  );
}
