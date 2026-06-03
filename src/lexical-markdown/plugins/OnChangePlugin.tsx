import { $convertToMarkdownString, type Transformer } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { UPDATE_TAGS } from "../constants";

interface Props {
  onChange: (markdown: string) => void;
  transformers: Array<Transformer>;
  /**
   * Ref shared with ControlledValuePlugin so that the controlled sync can
   * skip re-importing markdown that originated from this editor.
   */
  lastEmittedRef: React.RefObject<string | null>;
  /**
   * Debounce window in ms. Set to 0 to emit synchronously per update.
   */
  debounceMs?: number;
}

export default function OnChangePlugin({
  onChange,
  transformers,
  lastEmittedRef,
  debounceMs = 100,
}: Props): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const emit = () => {
      timer = null;
      editor.read(() => {
        const markdown = $convertToMarkdownString(transformers);
        if (markdown === lastEmittedRef.current) return;
        lastEmittedRef.current = markdown;
        onChange(markdown);
      });
    };

    const unregister = editor.registerUpdateListener(({ tags }) => {
      if (tags.has(UPDATE_TAGS.CONTROLLED)) return;

      if (debounceMs <= 0) {
        emit();
        return;
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(emit, debounceMs);
    });

    return () => {
      if (timer !== null) clearTimeout(timer);
      unregister();
    };
  }, [editor, onChange, transformers, lastEmittedRef, debounceMs]);

  return null;
}
