import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { EditorState } from "lexical";
import { useCallback, useEffect, useRef } from "react";
import { CUSTOM_TRANSFORMERS } from "../editor/transformers";

interface UseEditorDraftSyncOptions {
  editorMode: "rich" | "plain";
  plainContent: string;
  setPlainContent: (c: string) => void;
  newDocTrigger: number;
  onFocusPlain: () => void;
}

export function useEditorDraftSync({
  editorMode,
  plainContent,
  setPlainContent,
  newDocTrigger,
  onFocusPlain,
}: UseEditorDraftSyncOptions) {
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

  return { loadDraftForMode, handleChange };
}
