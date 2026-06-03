import {
  $convertFromMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";
import { UPDATE_TAGS } from "../constants";

interface Props {
  value: string;
  transformers: Array<Transformer>;
}

export default function InitialValuePlugin({
  value,
  transformers,
}: Props): null {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    editor.update(
      () => {
        $convertFromMarkdownString(value, transformers);
      },
      { tag: UPDATE_TAGS.INITIAL },
    );
  }, [editor, value, transformers]);

  return null;
}
