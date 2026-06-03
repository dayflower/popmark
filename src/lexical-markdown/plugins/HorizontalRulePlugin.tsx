import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_LOW,
  HISTORIC_TAG,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  type LexicalNode,
  mergeRegister,
  type ParagraphNode,
  type RangeSelection,
} from "lexical";
import { useEffect } from "react";

// Three or more of a single marker char and nothing else: `---`, `----`,
// `***`, `___`, ... all qualify. A trailing space (e.g. `--- `) or a mixed run
// must NOT match and stays plain text.
const HR_TEXT_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
// Canonical form used when unwrapping an HR back to editable text; any matching
// run collapses to this on round-trip, so the markdown source is always `---`.
const HR_TEXT = "---";

function $isHrParagraph(node: LexicalNode | null): node is ParagraphNode {
  return $isParagraphNode(node) && HR_TEXT_RE.test(node.getTextContent());
}

// Enter on a `---` paragraph: replace it with an HR and drop a fresh empty
// paragraph after it so the caret lands on a new line below the rule.
function $convertParagraphToHrOnEnter(paragraph: ParagraphNode): void {
  const hr = $createHorizontalRuleNode();
  paragraph.replace(hr);
  const after = $createParagraphNode();
  hr.insertAfter(after);
  after.selectStart();
}

// Caret left a `---` paragraph (arrow keys / click): replace it with an HR but
// leave the caret where the user moved it. A trailing paragraph is appended
// only when the HR would otherwise be the last node, so the document never
// ends on a bare decorator the user cannot move past.
function $convertParagraphToHrOnLeave(paragraph: ParagraphNode): void {
  const hr = $createHorizontalRuleNode();
  const hadNext = paragraph.getNextSibling() !== null;
  paragraph.replace(hr);
  if (!hadNext) {
    hr.insertAfter($createParagraphNode());
  }
}

// HR became selected (click / arrow navigation): turn it back into an editable
// `---` paragraph. The caret lands at the edge matching the direction of entry
// ("start" when arriving from the block above, "end" when arriving from below)
// so navigation feels continuous.
function $unwrapHrToParagraph(
  hr: LexicalNode,
  caret: "start" | "end" = "end",
): void {
  const para = $createParagraphNode();
  const text = $createTextNode(HR_TEXT);
  para.append(text);
  hr.replace(para);
  const offset = caret === "start" ? 0 : text.getTextContentSize();
  text.select(offset, offset);
}

// True when the collapsed caret sits at the very start of its top-level block
// (offset 0 and first descendant at every level up to the block).
function $isCaretAtBlockStart(selection: RangeSelection): boolean {
  if (!selection.isCollapsed() || selection.anchor.offset !== 0) return false;
  let node: LexicalNode = selection.anchor.getNode();
  const block = node.getTopLevelElement();
  if (block === null) return false;
  while (node.getKey() !== block.getKey()) {
    if (node.getPreviousSibling() !== null) return false;
    const parent = node.getParent();
    if (parent === null) return false;
    node = parent;
  }
  return true;
}

// True when the collapsed caret sits at the very end of its top-level block
// (last offset and last descendant at every level up to the block).
function $isCaretAtBlockEnd(selection: RangeSelection): boolean {
  if (!selection.isCollapsed()) return false;
  const anchor = selection.anchor;
  let node: LexicalNode = anchor.getNode();
  if ($isTextNode(node)) {
    if (anchor.offset !== node.getTextContentSize()) return false;
  } else if ($isElementNode(node)) {
    if (anchor.offset !== node.getChildrenSize()) return false;
  } else {
    return false;
  }
  const block = node.getTopLevelElement();
  if (block === null) return false;
  while (node.getKey() !== block.getKey()) {
    if (node.getNextSibling() !== null) return false;
    const parent = node.getParent();
    if (parent === null) return false;
    node = parent;
  }
  return true;
}

// Up/Left from the start of the block immediately after an HR: unwrap that HR
// back to a `---` paragraph and drop the caret at its end so the user can edit
// it. Returns false (caret not at a block start adjacent to an HR) to let the
// default navigation run.
function $tryUnwrapHrBeforeCaret(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  if (!$isCaretAtBlockStart(selection)) return false;
  const block = selection.anchor.getNode().getTopLevelElement();
  if (block === null) return false;
  const prev = block.getPreviousSibling();
  if (!$isHorizontalRuleNode(prev)) return false;
  $unwrapHrToParagraph(prev);
  return true;
}

// Down from the end of the block immediately before an HR: unwrap that HR back
// to a `---` paragraph with the caret at its start, mirroring the right-arrow
// path so vertical and horizontal navigation behave the same. Returns false
// (caret not at a block end adjacent to an HR) to let the default run.
function $tryUnwrapHrAfterCaret(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  if (!$isCaretAtBlockEnd(selection)) return false;
  const block = selection.anchor.getNode().getTopLevelElement();
  if (block === null) return false;
  const next = block.getNextSibling();
  if (!$isHorizontalRuleNode(next)) return false;
  $unwrapHrToParagraph(next, "start");
  return true;
}

export default function HorizontalRulePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const block = selection.anchor.getNode().getTopLevelElement();
          if (!$isHrParagraph(block)) return false;
          $convertParagraphToHrOnEnter(block);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        (event) => {
          if (!$tryUnwrapHrBeforeCaret()) return false;
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!$tryUnwrapHrBeforeCaret()) return false;
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!$tryUnwrapHrAfterCaret()) return false;
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerUpdateListener(
        ({ tags, editorState, prevEditorState }) => {
          if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) return;

          let prevBlockKey: string | null = null;
          prevEditorState.read(() => {
            const sel = $getSelection();
            if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;
            const block = sel.anchor.getNode().getTopLevelElement();
            if (block !== null) prevBlockKey = block.getKey();
          });

          let currBlockKey: string | null = null;
          let selectedHrKey: string | null = null;
          editorState.read(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              const block = sel.anchor.getNode().getTopLevelElement();
              if (block !== null) currBlockKey = block.getKey();
            } else if ($isNodeSelection(sel)) {
              for (const node of sel.getNodes()) {
                if ($isHorizontalRuleNode(node)) {
                  selectedHrKey = node.getKey();
                  break;
                }
              }
            }
          });

          const caretLeftBlock =
            prevBlockKey !== null && prevBlockKey !== currBlockKey;
          if (!caretLeftBlock && selectedHrKey === null) return;

          editor.update(() => {
            if (caretLeftBlock) {
              const prevBlock = $getNodeByKey(prevBlockKey as string);
              if ($isHrParagraph(prevBlock)) {
                $convertParagraphToHrOnLeave(prevBlock);
              }
            }
            // Run after the leave-conversion so the caret ends up inside the
            // unwrapped text node rather than on the freshly created paragraph.
            if (selectedHrKey !== null) {
              const hr = $getNodeByKey(selectedHrKey);
              if ($isHorizontalRuleNode(hr)) {
                // Entered from the block directly above the HR (arrow
                // right/down): drop the caret at the start; otherwise (entered
                // from below via up/left) keep it at the end.
                const prevSibling = hr.getPreviousSibling();
                const enteredFromAbove =
                  prevBlockKey !== null &&
                  prevSibling !== null &&
                  prevSibling.getKey() === prevBlockKey;
                $unwrapHrToParagraph(hr, enteredFromAbove ? "start" : "end");
              }
            }
          });
        },
      ),
    );
  }, [editor]);

  return null;
}
