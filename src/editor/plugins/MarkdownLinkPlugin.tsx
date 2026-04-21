import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
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
  TextNode,
} from "lexical";
import { useEffect } from "react";
import {
  $createMarkdownLinkLabelNode,
  $createMarkdownLinkNode,
  $createMarkdownLinkUrlNode,
  $isMarkdownLinkLabelNode,
  $isMarkdownLinkNode,
  $isMarkdownLinkUrlNode,
  MARKDOWN_LINK_CSS_CLASSES,
  MarkdownLinkLabelNode,
  MarkdownLinkNode,
  MarkdownLinkUrlNode,
} from "../MarkdownLinkNode";

const FULL_MATCH_REGEX = /^\[([^\]]*)\]\(([^)]*)\)$/;
const MATCH_REGEX = /\[([^\]]*)\]\(([^)]+)\)/;

function $unwrapMarkdownLinkNode(node: MarkdownLinkNode) {
  const children = node.getChildren();
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
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
  const [, newLabel, newUrl] = urlMatch;
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

function $findNearestMarkdownLinkNode(node: LexicalNode | null): MarkdownLinkNode | null {
  if ($isMarkdownLinkNode(node)) return node;
  if ($isTextNode(node)) {
    const parent = node.getParent();
    if ($isMarkdownLinkNode(parent)) return parent;
  }
  return null;
}

function isLinkFocused(linkEl: HTMLElement): boolean {
  return linkEl.classList.contains(MARKDOWN_LINK_CSS_CLASSES.FOCUSED);
}

function isUrlClickTarget(target: HTMLElement): boolean {
  return !!target.closest(`.${MARKDOWN_LINK_CSS_CLASSES.URL}`);
}

function handleFocusedLinkClick(linkEl: HTMLElement, e: MouseEvent): void {
  if (!isUrlClickTarget(e.target as HTMLElement)) return;
  const url = linkEl.getAttribute("data-url");
  if (url) {
    e.preventDefault();
    invoke("plugin:opener|open_url", { url });
  }
}

function handleUnfocusedLinkClick(linkEl: HTMLElement, editor: LexicalEditor, e: MouseEvent): void {
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

        const [fullMatch, label, url] = match;
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;

        let linkTextNode: typeof node;
        if (startIndex === 0) {
          [linkTextNode] = node.splitText(endIndex);
        } else {
          [, linkTextNode] = node.splitText(startIndex, endIndex);
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

function useSelectionFocusTracking(editor: LexicalEditor): void {
  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const doms = document.querySelectorAll(`.${MARKDOWN_LINK_CSS_CLASSES.LINK}`);
        doms.forEach((dom) => {
          dom.classList.remove(MARKDOWN_LINK_CSS_CLASSES.FOCUSED);
        });

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const focusedKeys = new Set<string>();
        for (const n of selection.getNodes()) {
          if ($isMarkdownLinkNode(n)) {
            focusedKeys.add(n.getKey());
          } else if ($isTextNode(n)) {
            const parent = n.getParent();
            if ($isMarkdownLinkNode(parent)) {
              focusedKeys.add(parent.getKey());
            }
          }
        }
        focusedKeys.forEach((key) => {
          editor.getElementByKey(key)?.classList.add(MARKDOWN_LINK_CSS_CLASSES.FOCUSED);
        });
      });
    });

    return () => {
      removeUpdateListener();
    };
  }, [editor]);
}

function useTextInsertionBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const removeCommandListener = editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        const text = typeof payload === "string" ? payload : (payload as InputEvent).data;
        if (!text) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

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
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();
        const linkNode = $findNearestMarkdownLinkNode(anchorNode);
        if (!linkNode) return false;

        event?.preventDefault();
        event?.stopPropagation();

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

function useClickHandling(editor: LexicalEditor): void {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest(`.${MARKDOWN_LINK_CSS_CLASSES.LINK}`) as HTMLElement | null;
      if (!linkEl) return;

      if (isLinkFocused(linkEl)) {
        handleFocusedLinkClick(linkEl, e);
        return;
      }

      handleUnfocusedLinkClick(linkEl, editor, e);
    };

    const removeRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener("click", handleClick);
      rootElement?.addEventListener("click", handleClick);
    });

    return () => {
      removeRootListener();
    };
  }, [editor]);
}

export default function MarkdownLinkPlugin() {
  const [editor] = useLexicalComposerContext();
  useNodeTransforms(editor);
  useSelectionFocusTracking(editor);
  useTextInsertionBehavior(editor);
  useEscapeKeyBehavior(editor);
  useClickHandling(editor);
  return null;
}
