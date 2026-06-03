import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
  type ListNode,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $copyNode,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  KEY_BACKSPACE_COMMAND,
  type LexicalNode,
  mergeRegister,
  type ParagraphNode,
} from "lexical";
import { useEffect } from "react";

// Trailing space is the trigger. Character class limited to space/x/X so that
// generic `[abc]` link syntax cannot match.
//
// The ListItem variant fires for any bullet/number item whose text begins with
// `[ ] ` — both the canonical single-item `- [ ] ` flow and an item typed
// inside an existing multi-item list. In the latter case the list is split so
// that only the matched item becomes a check item.
const LIST_ITEM_PATTERN = /^\[([ xX])?\]\s/;
const PARAGRAPH_PATTERN = /^-\s?\[([ xX])?\]\s/;

// Replaces `item` with `replacement` while preserving sibling items. If `item`
// is the only child, the whole list is replaced; if it sits at an edge,
// `replacement` is placed beside the list; otherwise the list is split and the
// trailing siblings move into a fresh list produced by `makeTailList`.
function $splitListItemOut(
  item: ListItemNode,
  replacement: LexicalNode,
  makeTailList: () => ListNode,
): void {
  const list = item.getParent();
  if (!$isListNode(list)) return;

  const prev = item.getPreviousSibling();
  const next = item.getNextSibling();

  if (!prev && !next) {
    list.replace(replacement);
  } else if (!prev) {
    list.insertBefore(replacement);
    item.remove();
  } else if (!next) {
    list.insertAfter(replacement);
    item.remove();
  } else {
    const tail = makeTailList();
    let n: ListItemNode | null = next as ListItemNode;
    while (n) {
      const nn = n.getNextSibling() as ListItemNode | null;
      tail.append(n);
      n = nn;
    }
    list.insertAfter(replacement);
    replacement.insertAfter(tail);
    item.remove();
  }
}

// Strips a `prefixLen`-char prefix from `source`'s first text child and moves
// its remaining children into a fresh single-item check list. Returns the new
// list and item, or null when there is no leading text node to strip.
function $buildCheckListFromPrefixed(
  source: ListItemNode | ParagraphNode,
  prefixLen: number,
  checked: boolean,
): { checkList: ListNode; item: ListItemNode } | null {
  const first = source.getFirstChild();
  if (!$isTextNode(first)) return null;
  const rest = first.getTextContent().slice(prefixLen);
  if (rest) {
    first.setTextContent(rest);
  } else {
    first.remove();
  }

  const item = $createListItemNode(checked);
  for (const c of source.getChildren()) item.append(c);
  const checkList = $createListNode("check");
  checkList.append(item);
  return { checkList, item };
}

// Strips the `- [ ] ` prefix from a paragraph and swaps it for a single-item
// check list.
function $convertToCheckList(
  paragraph: ParagraphNode,
  prefixLen: number,
  checked: boolean,
): void {
  const built = $buildCheckListFromPrefixed(paragraph, prefixLen, checked);
  if (!built) return;
  paragraph.replace(built.checkList);
  built.item.selectStart();
}

// Converts a single bullet/number list item into its own check list, splitting
// the surrounding list so sibling items keep their original type. Handles the
// canonical single-item case (whole list replaced) and multi-item lists (items
// before stay put, items after move into a copy of the original list).
function $convertListItemToCheckList(
  item: ListItemNode,
  prefixLen: number,
  checked: boolean,
): void {
  const list = item.getParent();
  if (!$isListNode(list)) return;

  const built = $buildCheckListFromPrefixed(item, prefixLen, checked);
  if (!built) return;

  $splitListItemOut(item, built.checkList, () => $copyNode(list));
  built.item.selectStart();
}

// Inverse of $convertListItem / $convertParagraph: turn a check list item back
// into a paragraph whose text begins with `- [ ]` / `- [x]`.
function $unwrapCheckItem(item: ListItemNode): void {
  const parent = item.getParent();
  if (!$isListNode(parent) || parent.getListType() !== "check") return;

  const checked = item.getChecked() ?? false;
  // Always a compact `- [ ]` / `- [x]` (no trailing space). Conceptually the
  // Backspace consumes one character from the canonical markdown source form
  // `- [ ] content` — when empty, that strips the trailing space; when content
  // follows, that strips the separating space.
  const prefixText = checked ? "- [x]" : "- [ ]";
  const cursorOffset = prefixText.length;

  const newPara = $createParagraphNode();
  const prefixNode = $createTextNode(prefixText);
  newPara.append(prefixNode);
  for (const c of item.getChildren()) newPara.append(c);

  $splitListItemOut(item, newPara, () => $createListNode("check"));

  prefixNode.select(cursorOffset, cursorOffset);
}

function $tryUnwrapAtSelection(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const anchor = selection.anchor;
  let item: ListItemNode | null = null;

  if (anchor.type === "text") {
    if (anchor.offset !== 0) return false;
    const node = anchor.getNode();
    const parent = node.getParent();
    if (!$isListItemNode(parent)) return false;
    if (parent.getFirstChild() !== node) return false;
    item = parent;
  } else if (anchor.type === "element") {
    if (anchor.offset !== 0) return false;
    const node = anchor.getNode();
    if (!$isListItemNode(node)) return false;
    item = node;
  } else {
    return false;
  }

  const parent = item.getParent();
  if (!$isListNode(parent) || parent.getListType() !== "check") return false;

  $unwrapCheckItem(item);
  return true;
}

export default function CheckListShortcutPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(
        ({ tags, dirtyLeaves, editorState, prevEditorState }) => {
          if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) return;
          if (editor.isComposing()) return;

          let prevAnchorOffset = -1;
          prevEditorState.read(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              prevAnchorOffset = sel.anchor.offset;
            }
          });

          let triggerKey: string | null = null;
          let triggerOffset = 0;

          editorState.read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed())
              return;

            const anchorKey = selection.anchor.key;
            const anchorOffset = selection.anchor.offset;
            if (!dirtyLeaves.has(anchorKey)) return;
            // Single-character insertion only (matches registerMarkdownShortcuts).
            if (anchorOffset !== 1 && anchorOffset > prevAnchorOffset + 1)
              return;

            const anchorNode = $getNodeByKey(anchorKey);
            if (!$isTextNode(anchorNode)) return;
            if (anchorNode.getTextContent()[anchorOffset - 1] !== " ") return;

            triggerKey = anchorKey;
            triggerOffset = anchorOffset;
          });

          if (triggerKey === null) return;

          editor.update(() => {
            const node = $getNodeByKey(triggerKey as string);
            if (!$isTextNode(node)) return;
            const parent = node.getParent();
            if (!parent || parent.getFirstChild() !== node) return;

            const text = node.getTextContent();

            if ($isListItemNode(parent)) {
              const list = parent.getParent();
              if (!$isListNode(list) || list.getListType() === "check") return;
              const m = text.match(LIST_ITEM_PATTERN);
              if (!m || m[0].length !== triggerOffset) return;
              const checked = m[1] === "x" || m[1] === "X";
              $convertListItemToCheckList(parent, m[0].length, checked);
            } else if ($isParagraphNode(parent)) {
              const m = text.match(PARAGRAPH_PATTERN);
              if (!m || m[0].length !== triggerOffset) return;
              const checked = m[1] === "x" || m[1] === "X";
              $convertToCheckList(parent, m[0].length, checked);
            }
          });
        },
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!$tryUnwrapAtSelection()) return false;
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);
  return null;
}
