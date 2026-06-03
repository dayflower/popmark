import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { handleListEnter, handleListShiftTab } from "./listBehavior";

export default function ListBehaviorPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => handleListEnter(event),
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => handleListShiftTab(event),
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
