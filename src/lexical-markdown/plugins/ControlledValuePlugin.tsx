import {
  $convertFromMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { UPDATE_TAGS } from "../constants";

interface Props {
  value: string;
  transformers: Array<Transformer>;
  /**
   * Ref to the most recent markdown emitted by OnChangePlugin. When the
   * incoming `value` already equals that, no re-import is performed —
   * preventing the controlled <-> onChange loop and preserving selection.
   */
  lastEmittedRef: React.RefObject<string | null>;
}

export default function ControlledValuePlugin({
  value,
  transformers,
  lastEmittedRef,
}: Props): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (lastEmittedRef.current === value) return;

    editor.update(
      () => {
        $convertFromMarkdownString(value, transformers);
      },
      { tag: UPDATE_TAGS.CONTROLLED },
    );
  }, [editor, value, transformers, lastEmittedRef]);

  return null;
}
