import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LexicalEditor } from "lexical";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { EditorMode } from "../types/settings";

interface UseEditorDraftSyncOptions {
  editorMode: EditorMode;
  content: string;
  setContent: (c: string) => void;
  newDocTrigger: number;
  editorRef: RefObject<LexicalEditor | null>;
  focusPlain: () => void;
}

/**
 * Keeps the single `content` markdown string in sync with the backend draft:
 * loads it on mount / after new-document / when the window is shown, and
 * debounce-saves changes. `lastSyncedRef` records the value last loaded from or
 * saved to the backend so neither the initial empty render nor a freshly loaded
 * value is written straight back.
 */
export function useEditorDraftSync({
  editorMode,
  content,
  setContent,
  newDocTrigger,
  editorRef,
  focusPlain,
}: UseEditorDraftSyncOptions) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string>("");

  const loadDraft = useCallback(() => {
    invoke<string>("get_draft").then((draft) => {
      const value = draft ?? "";
      lastSyncedRef.current = value;
      setContent(value);
    });
  }, [setContent]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Reload after the new_document IPC clears the draft
  useEffect(() => {
    if (newDocTrigger === 0) return;
    loadDraft();
  }, [newDocTrigger, loadDraft]);

  // Reload and re-focus when the window is shown via global shortcut or tray
  useEffect(() => {
    const unlisten = listen("window-shown", () => {
      loadDraft();
      if (editorMode === "rich") {
        editorRef.current?.focus();
      } else {
        focusPlain();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [editorMode, loadDraft, editorRef, focusPlain]);

  // Debounced save whenever content diverges from the last synced value
  useEffect(() => {
    if (content === lastSyncedRef.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      lastSyncedRef.current = content;
      invoke("save_draft", { content });
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [content]);
}
