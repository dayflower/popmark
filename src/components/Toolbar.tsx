import { FilePlus, PanelLeft, SquareMenu, SquarePilcrow } from "lucide-react";

interface ToolbarProps {
  isHistoryOpen: boolean;
  onNew: () => void;
  onToggleHistory: () => void;
  editorMode: "rich" | "plain";
  onModeToggle: () => void;
}

export function Toolbar({
  isHistoryOpen,
  onNew,
  onToggleHistory,
  editorMode,
  onModeToggle,
}: ToolbarProps) {
  return (
    <div
      data-tauri-drag-region
      className="popmark-toolbar flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none bg-white dark:bg-gray-900"
    >
      <button
        type="button"
        onClick={onToggleHistory}
        className={[
          "p-1.5 rounded cursor-default text-gray-600 dark:text-gray-400",
          isHistoryOpen
            ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
        ].join(" ")}
        title="Toggle history panel"
      >
        <PanelLeft size={16} />
      </button>
      <button
        type="button"
        onClick={onNew}
        className="p-1.5 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-default"
        title="New document (⌘N)"
      >
        <FilePlus size={16} />
      </button>
      <div
        data-tauri-drag-region
        className="flex ml-auto rounded overflow-hidden border border-gray-300 dark:border-gray-600"
      >
        {(
          [
            { mode: "rich", Icon: SquarePilcrow, title: "Rich text mode (⌘⇧R)" },
            { mode: "plain", Icon: SquareMenu, title: "Plain text mode (⌘⇧P)" },
          ] as const
        ).map(({ mode, Icon, title }) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              if (editorMode !== mode) onModeToggle();
            }}
            className={[
              "p-1.5 cursor-default",
              editorMode === mode
                ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
            ].join(" ")}
            title={title}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
