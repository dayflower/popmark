import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useInlineFormatBoundaryBehavior } from "../hooks/useInlineFormatBoundaryBehavior";

export default function InlineFormatBehaviorPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useInlineFormatBoundaryBehavior(editor);
  return null;
}
