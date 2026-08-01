import { invoke } from "@tauri-apps/api/core";
import { $generateNodesFromDOM } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  PASTE_COMMAND,
  TextNode,
} from "lexical";
import { useEffect } from "react";
import { DATA_ATTR } from "../constants";
import { registerFocusClassListener } from "../hooks/registerFocusClassListener";
import { useModifierCursorState } from "../hooks/useModifierCursorState";
import { escapeLinkLabel, escapeLinkUrl } from "../markdownLinkEscape";
import {
  $createMarkdownLinkLabelNode,
  $createMarkdownLinkNode,
  $createMarkdownLinkUrlNode,
  $isMarkdownLinkLabelNode,
  $isMarkdownLinkNode,
  $isMarkdownLinkUrlNode,
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "../nodes/MarkdownLinkNode";
import {
  isIntentionalOpenClick,
  type LinkClickBehavior,
  opensViaModifier,
  type PointerDownAnchor,
  shouldOpenOnClick,
} from "./linkClickBehavior";

const FULL_MATCH_REGEX = /^\[((?:\\.|[^\]\\])*)\]\(((?:\\.|[^)\\])*)\)$/;
const MATCH_REGEX = /\[((?:\\.|[^\]\\])*)\]\(((?:\\.|[^)\\])+)\)/;

function $unwrapMarkdownLinkNode(node: MarkdownLinkNode) {
  const children = node.getChildren();
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (!child) continue;
    if ($isMarkdownLinkUrlNode(child) || $isMarkdownLinkLabelNode(child)) {
      node.insertAfter($createTextNode(child.getTextContent()));
    } else {
      node.insertAfter(child);
    }
  }
  node.remove();
}

function $validateMarkdownLinkParent(parent: MarkdownLinkNode) {
  const textContent = parent.getTextContent();
  const urlMatch = FULL_MATCH_REGEX.exec(textContent);
  if (!urlMatch) {
    $unwrapMarkdownLinkNode(parent);
    return;
  }
  const [, newLabel = "", newUrl = ""] = urlMatch;
  if (parent.__url !== newUrl || parent.__label !== newLabel) {
    const writable = parent.getWritable();
    writable.__url = newUrl;
    writable.__label = newLabel;
  }
}

function createChildNodeValidator<T extends TextNode>(): (node: T) => void {
  return (node: T) => {
    const parent = node.getParent();
    if (!$isMarkdownLinkNode(parent)) {
      node.replace($createTextNode(node.getTextContent()));
      return;
    }
    $validateMarkdownLinkParent(parent);
  };
}

function $findNearestMarkdownLinkNode(
  node: LexicalNode | null,
): MarkdownLinkNode | null {
  if ($isMarkdownLinkNode(node)) return node;
  if ($isTextNode(node)) {
    const parent = node.getParent();
    if ($isMarkdownLinkNode(parent)) return parent;
  }
  return null;
}

function isLinkFocused(linkEl: HTMLElement): boolean {
  return linkEl.hasAttribute(DATA_ATTR.FOCUSED);
}

function openLinkUrl(linkEl: HTMLElement, e: MouseEvent): void {
  const url = linkEl.getAttribute("data-url");
  if (url) {
    e.preventDefault();
    // popmark patch: open in the OS browser via the Tauri opener plugin
    // instead of window.open (which is unavailable in the Tauri webview).
    invoke("plugin:opener|open_url", { url });
  }
}

function handleUnfocusedLinkClick(
  linkEl: HTMLElement,
  editor: LexicalEditor,
  e: MouseEvent,
): void {
  e.preventDefault();
  editor.update(() => {
    const node = $getNearestNodeFromDOMNode(linkEl);
    if ($isMarkdownLinkNode(node)) {
      const firstChild = node.getFirstChild();
      if ($isTextNode(firstChild)) {
        firstChild.select(0, 0);
      }
    }
  });
}

function useNodeTransforms(editor: LexicalEditor): void {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      editor.registerNodeTransform(TextNode, (node) => {
        const parent = node.getParent();
        if ($isMarkdownLinkNode(parent)) {
          $validateMarkdownLinkParent(parent);
          return;
        }

        const text = node.getTextContent();
        const match = MATCH_REGEX.exec(text);
        if (!match) return;

        const [fullMatch, label = "", url = ""] = match;
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;

        let linkTextNode: typeof node;
        if (startIndex === 0) {
          const [split] = node.splitText(endIndex);
          if (!split) return;
          linkTextNode = split;
        } else {
          const [, split] = node.splitText(startIndex, endIndex);
          if (!split) return;
          linkTextNode = split;
        }

        const linkNode = $createMarkdownLinkNode(label, url);
        linkNode.append(
          $createTextNode("["),
          $createMarkdownLinkLabelNode(label),
          $createTextNode("]("),
          $createMarkdownLinkUrlNode(url),
          $createTextNode(")"),
        );
        linkTextNode.replace(linkNode);
      }),
    );

    cleanups.push(
      editor.registerNodeTransform(
        MarkdownLinkUrlNode,
        createChildNodeValidator<MarkdownLinkUrlNode>(),
      ),
    );

    cleanups.push(
      editor.registerNodeTransform(
        MarkdownLinkLabelNode,
        createChildNodeValidator<MarkdownLinkLabelNode>(),
      ),
    );

    cleanups.push(
      editor.registerNodeTransform(MarkdownLinkNode, (node) => {
        if (!FULL_MATCH_REGEX.test(node.getTextContent())) {
          $unwrapMarkdownLinkNode(node);
        }
      }),
    );

    return () =>
      cleanups.forEach((fn) => {
        fn();
      });
  }, [editor]);
}

function $collectFocusedLinkKeys(): Set<NodeKey> {
  const keys = new Set<NodeKey>();
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return keys;
  for (const n of selection.getNodes()) {
    if ($isMarkdownLinkNode(n)) {
      keys.add(n.getKey());
    } else if ($isTextNode(n)) {
      const parent = n.getParent();
      if ($isMarkdownLinkNode(parent)) {
        keys.add(parent.getKey());
      }
    }
  }
  return keys;
}

function useSelectionFocusTracking(editor: LexicalEditor): void {
  useEffect(() => {
    return registerFocusClassListener(
      editor,
      `[${DATA_ATTR.LINK}]`,
      $collectFocusedLinkKeys,
    );
  }, [editor]);
}

// Show the link's destination as a native tooltip while it is rendered, so a
// hover reveals where it points without breaking it to source. A focused link
// already shows its literal `[label](url)` markdown, so strip the tooltip there
// to avoid redundancy. Runs after useSelectionFocusTracking (registered first)
// so `data-focused` is current when read.
function useUrlTooltip(editor: LexicalEditor): void {
  useEffect(() => {
    return editor.registerUpdateListener(() => {
      const root = editor.getRootElement();
      if (!root) return;
      root.querySelectorAll(`[${DATA_ATTR.LINK}]`).forEach((dom) => {
        const el = dom as HTMLElement;
        if (el.hasAttribute(DATA_ATTR.FOCUSED)) {
          el.removeAttribute("title");
          return;
        }
        const url = el.getAttribute("data-url");
        if (url) el.setAttribute("title", url);
      });
    });
  }, [editor]);
}

function useTextInsertionBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const removeCommandListener = editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        const text =
          typeof payload === "string" ? payload : (payload as InputEvent).data;
        if (!text) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return false;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        if (!$isTextNode(anchorNode)) return false;

        const parent = anchorNode.getParent();
        if (!$isMarkdownLinkNode(parent)) return false;
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

function useEscapeKeyBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const removeEscapeListener = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return false;

        const anchorNode = selection.anchor.getNode();
        const linkNode = $findNearestMarkdownLinkNode(anchorNode);
        if (!linkNode) return false;

        event?.preventDefault();

        const nextSibling = linkNode.getNextSibling();
        if ($isTextNode(nextSibling)) {
          nextSibling.select(0, 0);
        } else {
          const parent = linkNode.getParentOrThrow();
          const index = linkNode.getIndexWithinParent();
          parent.select(index + 1, index + 1);
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removeEscapeListener();
    };
  }, [editor]);
}

function useClickHandling(
  editor: LexicalEditor,
  behavior: LinkClickBehavior,
): void {
  useEffect(() => {
    // The open gesture must not move the caret into the link — otherwise focus
    // tracking would mark it focused and break it to its markdown source. The
    // caret moves on mousedown, before the click fires, so suppress the default
    // selection change there for whichever press opens:
    // - edit mode: cmd/ctrl+click opens, so suppress a modifier press on a link.
    // - open mode: a plain click opens, so suppress a no-modifier press on a
    //   link (a modifier press now edits and is left alone). This costs the
    //   ability to start a drag-selection from inside a link in open mode; a
    //   selection that starts outside the link is unaffected, and editing the
    //   link's text is still reachable via cmd/ctrl+click.
    // The pointer-down anchor is still recorded so the click handler can tell an
    // intentional click apart from a press that traveled (a drag onto/off the
    // link) before opening.
    let anchor: PointerDownAnchor | null = null;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const onLink = !!target.closest(`[${DATA_ATTR.LINK}]`);
      const modifier = e.metaKey || e.ctrlKey;
      anchor = { x: e.clientX, y: e.clientY, onLink };
      const opensThisPress = opensViaModifier(behavior) ? modifier : !modifier;
      if (opensThisPress && onLink) e.preventDefault();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest(
        `[${DATA_ATTR.LINK}]`,
      ) as HTMLElement | null;
      if (!linkEl) return;

      if (shouldOpenOnClick(e, behavior)) {
        // The modifier-gated open opens directly. The plain-click open still
        // rules out a drag (a press that traveled onto/off the link) or an
        // existing text selection before opening — the user's drag-select
        // concern — but since mousedown suppressed the caret, opening never
        // breaks the link to source.
        if (opensViaModifier(behavior)) {
          openLinkUrl(linkEl, e);
          return;
        }
        if (!isIntentionalOpenClick(e, anchor)) return;
        openLinkUrl(linkEl, e);
        return;
      }

      // A focused link already shows its markdown source, so leave a plain click
      // to place the caret for editing. An edit click on the rendered
      // (unfocused) link breaks it back to source.
      if (isLinkFocused(linkEl)) return;

      handleUnfocusedLinkClick(linkEl, editor, e);
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

function $convertAnchorsToMarkdownText(doc: Document): boolean {
  const anchors = doc.querySelectorAll("a[href]");
  if (anchors.length === 0) return false;
  anchors.forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const labelText = a.textContent ?? "";
    const label = labelText.length > 0 ? labelText : href;
    // Escape the Markdown side so `[`/`]` in the label or `(`/`)` in the URL do
    // not break the generated `[label](url)` syntax (e.g. Wikipedia URLs).
    const replacement = href
      ? `[${escapeLinkLabel(label)}](${escapeLinkUrl(href)})`
      : labelText;
    a.replaceWith(doc.createTextNode(replacement));
  });
  return true;
}

function usePastedLinkConversion(editor: LexicalEditor): void {
  useEffect(() => {
    const removePasteListener = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const html = clipboardData.getData("text/html");
        if (!html) return false;

        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!$convertAnchorsToMarkdownText(doc)) return false;

        event.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const nodes = $generateNodesFromDOM(editor, doc);
          selection.insertNodes(nodes);
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removePasteListener();
    };
  }, [editor]);
}

export default function MarkdownLinkPlugin({
  clickBehavior = "edit",
}: {
  clickBehavior?: LinkClickBehavior;
} = {}): null {
  const [editor] = useLexicalComposerContext();
  useNodeTransforms(editor);
  useSelectionFocusTracking(editor);
  useUrlTooltip(editor);
  useTextInsertionBehavior(editor);
  useEscapeKeyBehavior(editor);
  useClickHandling(editor, clickBehavior);
  useModifierCursorState(editor, clickBehavior);
  usePastedLinkConversion(editor);
  return null;
}
