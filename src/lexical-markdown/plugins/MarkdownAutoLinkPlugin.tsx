import { invoke } from "@tauri-apps/api/core";
import { $isCodeHighlightNode } from "@lexical/code-core";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  TextNode,
} from "lexical";
import { useEffect } from "react";
import { DATA_ATTR } from "../constants";
import { useModifierCursorState } from "../hooks/useModifierCursorState";
import {
  $createMarkdownAutoLinkNode,
  $isMarkdownAutoLinkNode,
  MarkdownAutoLinkNode,
} from "../nodes/MarkdownAutoLinkNode";
import { $isMarkdownCodeBlockNode } from "../nodes/MarkdownCodeBlockNode";
import {
  $isMarkdownLinkLabelNode,
  $isMarkdownLinkNode,
  $isMarkdownLinkUrlNode,
} from "../nodes/MarkdownLinkNode";
import {
  isIntentionalOpenClick,
  type LinkClickBehavior,
  opensViaModifier,
  type PointerDownAnchor,
  shouldOpenOnClick,
} from "./linkClickBehavior";

// Detect a single bare URL in a text run. The `(?<!\S)` boundary keeps
// `foohttps://x` from matching mid-word; trailing punctuation stays in the URL
// (`\S+`) and is left to the host to live with, mirroring the design.
const AUTO_LINK_MATCH_REGEX = /(?<!\S)([A-Za-z][A-Za-z0-9+.-]*:\/\/\S+)/;
// Re-validate that a node's whole text is still a single URL. Anchored, so no
// leading boundary is needed.
const AUTO_LINK_FULL_MATCH_REGEX = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+$/;

function $unwrapMarkdownAutoLinkNode(node: MarkdownAutoLinkNode): void {
  const textNode = $createTextNode(node.getTextContent());
  // Carry the caret over to the replacement so an edit that breaks the URL (and
  // thus unwraps it) does not lose the selection or make the caret jump.
  const selection = $getSelection();
  let caretOffset: number | null = null;
  if ($isRangeSelection(selection) && selection.isCollapsed()) {
    const child = node.getFirstChild();
    if (child && selection.anchor.key === child.getKey()) {
      caretOffset = selection.anchor.offset;
    }
  }
  node.replace(textNode);
  if (caretOffset !== null) textNode.select(caretOffset, caretOffset);
}

function $validateAutoLink(parent: MarkdownAutoLinkNode): void {
  if (!AUTO_LINK_FULL_MATCH_REGEX.test(parent.getTextContent())) {
    $unwrapMarkdownAutoLinkNode(parent);
  }
}

function shouldSkip(node: TextNode, parent: LexicalNode | null): boolean {
  // These TextNode subclasses already belong to a richer structure.
  if (
    $isMarkdownLinkUrlNode(node) ||
    $isMarkdownLinkLabelNode(node) ||
    $isCodeHighlightNode(node)
  ) {
    return true;
  }
  if (
    $isMarkdownLinkNode(parent) ||
    $isMarkdownAutoLinkNode(parent) ||
    $isMarkdownCodeBlockNode(parent)
  ) {
    return true;
  }
  // Inline code spans should stay literal.
  if (node.hasFormat("code")) return true;
  return false;
}

function useNodeTransforms(editor: LexicalEditor): void {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Detection + re-validation on plain text.
    cleanups.push(
      editor.registerNodeTransform(TextNode, (node) => {
        const parent = node.getParent();
        if ($isMarkdownAutoLinkNode(parent)) {
          $validateAutoLink(parent);
          return;
        }
        if (shouldSkip(node, parent)) return;

        const text = node.getTextContent();
        const match = AUTO_LINK_MATCH_REGEX.exec(text);
        if (!match) return;

        const startIndex = match.index;
        // Defensive: a URL right after `](` is the URL half of an explicit
        // `[label](url)` still in plain-text form; let MarkdownLinkPlugin claim
        // it instead of decorating it as a bare URL.
        if (text.slice(0, startIndex).endsWith("](")) return;

        const url = match[1];
        const endIndex = startIndex + url.length;

        // Decorate only when a boundary (whitespace/newline) borders the URL,
        // not while it is being typed. Defer while the caret sits past the URL's
        // start (typing its tail or editing inside it); a separator that moves
        // the caret off the URL, an Enter (see useEnterDecoration), or a space
        // inserted before the URL (caret exactly at its start) lets it through.
        const selection = $getSelection();
        const caretOffset =
          $isRangeSelection(selection) &&
          selection.isCollapsed() &&
          selection.anchor.key === node.getKey()
            ? selection.anchor.offset
            : null;
        if (
          caretOffset !== null &&
          caretOffset > startIndex &&
          caretOffset <= endIndex
        ) {
          return;
        }

        let urlTextNode: typeof node;
        if (startIndex === 0) {
          [urlTextNode] = node.splitText(endIndex);
        } else {
          [, urlTextNode] = node.splitText(startIndex, endIndex);
        }

        const autoLinkNode = $createMarkdownAutoLinkNode();
        const child = $createTextNode(url);
        autoLinkNode.append(child);
        urlTextNode.replace(autoLinkNode);
        // A caret exactly at the URL's start (a separator was just inserted
        // before it) would be lost when the node is replaced; keep it just
        // before the URL by moving it to the front of the decoration's child.
        if (caretOffset === startIndex) {
          child.select(0, 0);
        }
      }),
    );

    // Structural re-validation: catches child merges/splits the TextNode
    // transform above might miss.
    cleanups.push(
      editor.registerNodeTransform(MarkdownAutoLinkNode, (node) => {
        $validateAutoLink(node);
      }),
    );

    return () =>
      cleanups.forEach((fn) => {
        fn();
      });
  }, [editor]);
}

// A bare URL has no closing delimiter, so typed characters at the end of a
// decoration naturally extend the URL — which is what we want while the user is
// still typing the address. The one exception is a separator (whitespace):
// letting it flow into the decoration would force an unwrap/re-wrap churn and
// misplace the caret. Eject leading-whitespace insertions to a sibling after
// the decoration so the URL ends cleanly and the caret lands outside it.
function useSeparatorEjection(editor: LexicalEditor): void {
  useEffect(() => {
    const removeCommandListener = editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        const text =
          typeof payload === "string" ? payload : (payload as InputEvent).data;
        if (!text || !/^\s/.test(text)) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return false;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if (!$isTextNode(anchorNode)) return false;

        const parent = anchorNode.getParent();
        if (!$isMarkdownAutoLinkNode(parent)) return false;
        if (anchor.offset !== anchorNode.getTextContentSize()) return false;

        const nextSibling = parent.getNextSibling();
        if ($isTextNode(nextSibling)) {
          const current = nextSibling.getTextContent();
          nextSibling.setTextContent(text + current);
          nextSibling.select(text.length, text.length);
        } else {
          const newNode = $createTextNode(text);
          parent.insertAfter(newNode);
          newNode.select(text.length, text.length);
        }
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeCommandListener();
    };
  }, [editor]);
}

// Decoration is deferred while the caret sits on the URL (see the TextNode
// transform). A trailing separator re-runs the transform because it edits the
// node, but pressing Enter only splits the block and leaves the URL node
// untouched — so it would never decorate. Mark that node dirty on Enter (then
// let the default line break proceed) so the transform fires; by then the caret
// has moved to the new block, so the deferral no longer applies.
function useEnterDecoration(editor: LexicalEditor): void {
  useEffect(() => {
    const pending = new Set<ReturnType<typeof setTimeout>>();

    const removeCommandListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return false;

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!$isTextNode(node)) return false;
        if (anchor.offset !== node.getTextContentSize()) return false;

        const parent = node.getParent();
        if (shouldSkip(node, parent)) return false;
        if (!AUTO_LINK_MATCH_REGEX.test(node.getTextContent())) return false;

        const key = node.getKey();
        node.markDirty();
        // Chromium splits the block synchronously in this same update, so the
        // transform re-fires with the caret already in the new block and
        // decorates. WebKit defers the split to a later input event, so at this
        // point the caret is still on the URL and the transform defers again.
        // Re-mark the node dirty on the next macrotask — by then the split has
        // run and the caret has left the URL — so the transform decorates. This
        // is a harmless no-op where the synchronous path already decorated.
        const timer = setTimeout(() => {
          pending.delete(timer);
          editor.update(() => {
            $getNodeByKey(key)?.markDirty();
          });
        }, 0);
        pending.add(timer);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeCommandListener();
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, [editor]);
}

function openAutoLinkUrl(linkEl: HTMLElement, e: MouseEvent): void {
  const url = linkEl.textContent;
  if (url) {
    e.preventDefault();
    // popmark patch: open in the OS browser via the Tauri opener plugin
    // instead of window.open (which is unavailable in the Tauri webview).
    invoke("plugin:opener|open_url", { url });
  }
}

function useClickHandling(
  editor: LexicalEditor,
  behavior: LinkClickBehavior,
): void {
  useEffect(() => {
    // The open gesture must not move the caret into the URL, so opening never
    // drops the user into editing it. In edit mode cmd/ctrl+click opens (and
    // suppresses the caret on a modifier press); in open mode a plain click
    // opens, so suppress a no-modifier press on the URL (a modifier press now
    // edits and is left alone). The anchor is recorded so the click handler can
    // tell an intentional click apart from a press that traveled.
    let anchor: PointerDownAnchor | null = null;
    const handleMouseDown = (e: MouseEvent) => {
      if (opensViaModifier(behavior)) return;
      const target = e.target as HTMLElement;
      const onLink = !!target.closest(`[${DATA_ATTR.AUTO_LINK}]`);
      anchor = { x: e.clientX, y: e.clientY, onLink };
      if (onLink && !(e.metaKey || e.ctrlKey)) e.preventDefault();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest(
        `[${DATA_ATTR.AUTO_LINK}]`,
      ) as HTMLElement | null;
      if (!linkEl) return;

      if (!shouldOpenOnClick(e, behavior)) return; // edit: default caret placement

      if (opensViaModifier(behavior)) {
        openAutoLinkUrl(linkEl, e);
        return;
      }
      if (!isIntentionalOpenClick(e, anchor)) return;
      openAutoLinkUrl(linkEl, e);
    };

    const removeRootListener = editor.registerRootListener(
      (rootElement, prevRootElement) => {
        prevRootElement?.removeEventListener("mousedown", handleMouseDown);
        prevRootElement?.removeEventListener("click", handleClick);
        rootElement?.addEventListener("mousedown", handleMouseDown);
        rootElement?.addEventListener("click", handleClick);
      },
    );

    return () => {
      removeRootListener();
    };
  }, [editor, behavior]);
}

export default function MarkdownAutoLinkPlugin({
  clickBehavior = "edit",
}: {
  clickBehavior?: LinkClickBehavior;
} = {}): null {
  const [editor] = useLexicalComposerContext();
  useNodeTransforms(editor);
  useSeparatorEjection(editor);
  useEnterDecoration(editor);
  useClickHandling(editor, clickBehavior);
  useModifierCursorState(editor, clickBehavior);
  return null;
}
