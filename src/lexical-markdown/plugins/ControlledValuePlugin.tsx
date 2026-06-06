import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
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
        // Advance the guard ref with the editor's actual serialized content,
        // not the raw `value`. $convertFromMarkdownString may normalize the
        // markdown, so the editor content can differ from `value`; using the
        // real serialization keeps the guard tracking exactly what was last
        // pushed into / pulled out of the editor and avoids stale matches
        // (e.g. a later `value=""` being wrongly skipped) and spurious
        // re-imports on the next edit.
        lastEmittedRef.current = $convertToMarkdownString(transformers);
      },
      { tag: UPDATE_TAGS.CONTROLLED },
    );
  }, [editor, value, transformers, lastEmittedRef]);

  return null;
}
