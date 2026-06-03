import type { LexicalEditor } from "lexical";
import { useEffect } from "react";
import { DATA_ATTR } from "../constants";
import { $collectFocusedCodeBlockKeys } from "./focusedCodeBlockKeys";
import { registerFocusClassListener } from "./registerFocusClassListener";

export function useCodeBlockFocusClass(editor: LexicalEditor): void {
  useEffect(() => {
    return registerFocusClassListener(
      editor,
      `[${DATA_ATTR.CODE_BLOCK}]`,
      $collectFocusedCodeBlockKeys,
    );
  }, [editor]);
}
