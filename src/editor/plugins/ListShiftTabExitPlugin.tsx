import { $createListNode, $isListItemNode, ListItemNode, ListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_TAB_COMMAND,
} from "lexical";
import { useEffect } from "react";

// Allows exiting list mode by pressing Shift+Tab on a level-1 list item
export function ListShiftTabExitPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (e) => {
        if (!e?.shiftKey) return false;
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const anchorNode = selection.anchor.getNode();
        const listItem = $getNearestNodeOfType(anchorNode, ListItemNode);
        if (!listItem) return false;
        const list = listItem.getParent();
        if (!(list instanceof ListNode)) return false;
        // If parent of the list is a ListItemNode, we're nested — let default Shift+Tab handle it
        if ($isListItemNode(list.getParent())) return false;

        e.preventDefault();
        editor.update(() => {
          const para = $createParagraphNode();
          for (const child of listItem.getChildren()) {
            para.append(child);
          }
          const listChildren = list.getChildren();
          const itemIndex = listItem.getIndexWithinParent();
          const afterItems = listChildren.slice(itemIndex + 1);

          if (listChildren.length === 1) {
            list.replace(para);
          } else if (itemIndex === 0) {
            list.insertBefore(para);
            listItem.remove();
          } else if (afterItems.length === 0) {
            list.insertAfter(para);
            listItem.remove();
          } else {
            // Middle: split list — items after go to a new list
            const newList = $createListNode(list.getListType());
            for (const item of afterItems) {
              item.remove();
              newList.append(item);
            }
            list.insertAfter(newList);
            list.insertAfter(para);
            listItem.remove();
          }
          para.select();
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);
  return null;
}
