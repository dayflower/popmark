import { confirm } from "@tauri-apps/plugin-dialog";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../types/history";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadEntry: (id: string) => void;
  entries: HistoryEntry[];
  loading: boolean;
  onDeleteEntry: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

function formatTimestamp(iso: string): string {
  // iso: "2024-03-14T09:41:00" → "2024-03-14 09:41"
  return iso.replace("T", " ").slice(0, 16);
}

interface EntryItemProps {
  entry: HistoryEntry;
  onLoad: (id: string) => void;
  isPendingDelete: boolean;
  isDeleting: boolean;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
}

function EntryItem({
  entry,
  onLoad,
  isPendingDelete,
  isDeleting,
  onDeleteRequest,
  onDeleteConfirm,
}: EntryItemProps) {
  return (
    <div
      style={
        isDeleting
          ? { maxHeight: 0, opacity: 0, overflow: "hidden", transform: "translateX(-100%)" }
          : { maxHeight: "80px", opacity: 1, transform: "translateX(0)" }
      }
      className="transition-all duration-200 ease-in"
    >
      <div className="group relative flex items-stretch">
        <button
          type="button"
          onClick={() => onLoad(entry.id)}
          className="flex-1 text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default pr-8"
        >
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            {formatTimestamp(entry.timestamp)}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {entry.title_preview}
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isPendingDelete) {
              onDeleteConfirm(entry.id);
            } else {
              onDeleteRequest(entry.id);
            }
          }}
          className={[
            "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "transition-opacity cursor-default",
            isPendingDelete
              ? "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
          ].join(" ")}
          title={isPendingDelete ? "Click again to confirm deletion" : "Delete entry"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function HistoryPanel({
  isOpen,
  onClose,
  onLoadEntry,
  entries,
  loading,
  onDeleteEntry,
  onClearAll,
}: HistoryPanelProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset pending delete when clicking outside the panel
  useEffect(() => {
    if (!pendingDeleteId) return;
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPendingDeleteId(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pendingDeleteId]);

  return (
    <div
      ref={panelRef}
      className={[
        "absolute inset-y-0 left-0 z-10 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col",
        "transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none"
        data-tauri-drag-region
      >
        <span
          className="text-sm font-medium text-gray-600 dark:text-gray-400"
          data-tauri-drag-region
        >
          History
        </span>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm("Clear all history? This cannot be undone.", {
                  title: "Clear All History",
                  kind: "warning",
                });
                if (ok) await onClearAll();
              }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 border border-gray-300 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 rounded-full px-2 py-0.5 cursor-default transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-default leading-none"
            title="Close history panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {loading && (
          <div className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            Loading…
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="px-3 py-8 text-sm text-gray-400 dark:text-gray-500 text-center">
            <div className="mb-1">No history yet</div>
            <div className="text-xs">Use Send to Clipboard to save entries here</div>
          </div>
        )}
        {!loading &&
          entries.map((entry) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              onLoad={(id) => {
                setPendingDeleteId(null);
                onLoadEntry(id);
              }}
              isPendingDelete={pendingDeleteId === entry.id}
              isDeleting={deletingId === entry.id}
              onDeleteRequest={(id) => setPendingDeleteId(id)}
              onDeleteConfirm={(id) => {
                setPendingDeleteId(null);
                setDeletingId(id);
                setTimeout(() => {
                  onDeleteEntry(id);
                  setDeletingId(null);
                }, 200);
              }}
            />
          ))}
      </div>
    </div>
  );
}
