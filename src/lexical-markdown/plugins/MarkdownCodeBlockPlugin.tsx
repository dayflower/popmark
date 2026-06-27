import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useArrowKeyExitBehavior } from "../hooks/useArrowKeyExitBehavior";
import { useBackspaceKeyBehavior } from "../hooks/useBackspaceKeyBehavior";
import { useCodeBlockFocusClass } from "../hooks/useCodeBlockFocusClass";
import { useCodeBlockNormalizeOnBlur } from "../hooks/useCodeBlockNormalizeOnBlur";
import { useCodeBlockPasteBehavior } from "../hooks/useCodeBlockPasteBehavior";
import { useCodeBlockValidationOnEdit } from "../hooks/useCodeBlockValidationOnEdit";
import { useEscapeKeyBehavior } from "../hooks/useEscapeKeyBehavior";
import { useInsertParagraphBehavior } from "../hooks/useInsertParagraphBehavior";
import { useReassembleCodeBlock } from "../hooks/useReassembleCodeBlock";
import { useRemoveEmptyCodeBlock } from "../hooks/useRemoveEmptyCodeBlock";

export default function MarkdownCodeBlockPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useInsertParagraphBehavior(editor);
  useEscapeKeyBehavior(editor);
  useArrowKeyExitBehavior(editor);
  useBackspaceKeyBehavior(editor);
  useCodeBlockPasteBehavior(editor);
  useCodeBlockFocusClass(editor);
  useCodeBlockNormalizeOnBlur(editor);
  useCodeBlockValidationOnEdit(editor);
  useReassembleCodeBlock(editor);
  useRemoveEmptyCodeBlock(editor);
  return null;
}
