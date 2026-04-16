import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import {
  $findMatchingParent,
  $getNearestNodeFromDOMNode,
} from "lexical";
import { $getNodeByKey, $getSelection, $isRangeSelection } from "lexical";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PopoverState {
  nodeKey: string;
  url: string;
}

interface LinkPopoverProps {
  state: PopoverState;
  position: { top: number; left: number };
  onSave: (nodeKey: string, url: string) => void;
  onClose: () => void;
}

function LinkPopover({ state, position, onSave, onClose }: LinkPopoverProps) {
  const [editingUrl, setEditingUrl] = useState(state.url);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Use a native keydown listener so stopImmediatePropagation reaches the
  // window-level handler in EditorPlugins (React synthetic events can't do this).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onSave(state.nodeKey, editingUrl);
      }
    };
    input.addEventListener("keydown", handleKeyDown);
    return () => input.removeEventListener("keydown", handleKeyDown);
  }, [state.nodeKey, editingUrl, onSave, onClose]);

  const handleOpenInBrowser = useCallback(async () => {
    if (editingUrl) {
      await invoke("plugin:opener|open_url", { url: editingUrl });
    }
  }, [editingUrl]);

  // Clamp to viewport so the popover doesn't clip at screen edges
  const top = Math.min(position.top + 4, window.innerHeight - 48);
  const left = Math.min(position.left, window.innerWidth - 320);

  return createPortal(
    <div
      style={{ position: "fixed", top, left, zIndex: 9999 }}
      className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1"
      // Prevent native mousedown from reaching the window close-on-outside handler
      onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={editingUrl}
        onChange={(e) => setEditingUrl(e.target.value)}
        className="text-sm px-2 py-1 outline-none bg-transparent w-52 text-gray-900 dark:text-gray-100"
        placeholder="Enter URL…"
      />
      <button
        type="button"
        onClick={handleOpenInBrowser}
        className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded"
        title="Open in browser"
      >
        <ExternalLink size={14} />
      </button>
    </div>,
    document.body,
  );
}

export function LinkPopoverPlugin() {
  const [editor] = useLexicalComposerContext();
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  const closePopover = useCallback(() => {
    setPopoverState(null);
    editor.focus();
  }, [editor]);

  const saveUrl = useCallback(
    (nodeKey: string, url: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isLinkNode(node)) {
          node.setURL(url);
        }
      });
      setPopoverState(null);
      editor.focus();
    },
    [editor],
  );

  const openPopoverForElement = useCallback(
    (nodeKey: string, url: string, anchorElement: Element) => {
      const rect = anchorElement.getBoundingClientRect();
      setPopoverPosition({ top: rect.bottom, left: rect.left });
      setPopoverState({ nodeKey, url });
    },
    [],
  );

  // Cmd+E: open popover when cursor is inside a link
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === "e" && !e.shiftKey)) return;

      let foundKey: string | null = null;
      let foundUrl = "";

      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const node = selection.anchor.getNode();
        const linkNode = $findMatchingParent(node, $isLinkNode);
        if ($isLinkNode(linkNode)) {
          foundKey = linkNode.getKey();
          foundUrl = linkNode.getURL();
        }
      });

      if (!foundKey) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const linkElement = editor.getElementByKey(foundKey);
      if (linkElement) {
        openPopoverForElement(foundKey, foundUrl, linkElement);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editor, openPopoverForElement]);

  // Link click: prevent in-app navigation and open popover
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchorElement = target.closest("a[href]");
      if (!anchorElement) return;
      e.preventDefault();
      e.stopPropagation();

      let foundKey: string | null = null;
      let foundUrl = "";

      editor.getEditorState().read(() => {
        // Walk up from the clicked DOM node to find the Lexical LinkNode
        const lexicalNode = $getNearestNodeFromDOMNode(target);
        if (!lexicalNode) return;
        const linkNode = $isLinkNode(lexicalNode)
          ? lexicalNode
          : $findMatchingParent(lexicalNode, $isLinkNode);
        if ($isLinkNode(linkNode)) {
          foundKey = linkNode.getKey();
          foundUrl = linkNode.getURL();
        }
      });

      if (!foundKey) {
        // Fallback: read URL from DOM when Lexical lookup fails
        foundUrl = (anchorElement as HTMLAnchorElement).getAttribute("href") ?? "";
      }

      openPopoverForElement(
        foundKey ?? "",
        foundUrl,
        anchorElement,
      );
    };

    const root = editor.getRootElement();
    if (!root) return;
    root.addEventListener("click", handleClick, { capture: true });
    return () => root.removeEventListener("click", handleClick, { capture: true });
  }, [editor, openPopoverForElement]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverState) return;
    const handleOutsideMouseDown = () => {
      setPopoverState(null);
    };
    window.addEventListener("mousedown", handleOutsideMouseDown);
    return () => window.removeEventListener("mousedown", handleOutsideMouseDown);
  }, [popoverState]);

  if (!popoverState) return null;

  return (
    <LinkPopover
      state={popoverState}
      position={popoverPosition}
      onSave={saveUrl}
      onClose={closePopover}
    />
  );
}
