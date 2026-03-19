import { useEffect } from "react";
import { useHistory } from "../hooks/useHistory";
import type { HistoryEntry } from "../types/history";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadEntry: (id: string) => void;
}

function formatTimestamp(iso: string): string {
  // iso: "2024-03-14T09:41:00" → "2024-03-14 09:41"
  return iso.replace("T", " ").slice(0, 16);
}

function EntryItem({ entry, onLoad }: { entry: HistoryEntry; onLoad: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onLoad(entry.id)}
      className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
    >
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
        {formatTimestamp(entry.timestamp)}
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{entry.title_preview}</div>
    </button>
  );
}

export function HistoryPanel({ isOpen, onClose, onLoadEntry }: HistoryPanelProps) {
  const { entries, loading, loadHistory } = useHistory();

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

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

  return (
    <div
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
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-default leading-none"
          title="Close history panel"
        >
          ✕
        </button>
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
          entries.map((entry) => <EntryItem key={entry.id} entry={entry} onLoad={onLoadEntry} />)}
      </div>
    </div>
  );
}
