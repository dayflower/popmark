import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $addUpdateTag,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
} from "lexical";
import { useEffect } from "react";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatureFlags,
} from "../config/features";
import { transformBlockquoteChildMarkdown } from "../transformers/blockquoteTransformer";
import { handleQuoteBackspace, handleQuoteEnter } from "./blockquoteBehavior";

type BlockquoteBehaviorPluginProps = {
  exitOnEmptyLine?: boolean;
  features?: MarkdownFeatureFlags;
};

export default function BlockquoteBehaviorPlugin({
  exitOnEmptyLine = false,
  features = DEFAULT_MARKDOWN_FEATURES,
}: BlockquoteBehaviorPluginProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => handleQuoteEnter(event, exitOnEmptyLine),
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, exitOnEmptyLine]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const handled = handleQuoteBackspace();

        if (handled) {
          event.preventDefault();
        }

        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      if (
        tags.has(COLLABORATION_TAG) ||
        tags.has(HISTORIC_TAG) ||
        editor.isComposing()
      ) {
        return;
      }

      let shouldTransform = false;

      editorState.read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const anchorNode = selection.anchor.getNode();

        if (!$isTextNode(anchorNode)) {
          return;
        }

        const anchorOffset = selection.anchor.offset;

        shouldTransform =
          anchorOffset > 1 &&
          anchorOffset <= 8 &&
          anchorNode.getTextContent()[anchorOffset - 1] === " ";
      });

      if (!shouldTransform) {
        return;
      }

      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const anchorNode = selection.anchor.getNode();
        const parentNode = anchorNode.getParent();

        if (
          !$isTextNode(anchorNode) ||
          parentNode === null ||
          !transformBlockquoteChildMarkdown(
            parentNode,
            anchorNode,
            selection.anchor.offset,
            features,
          )
        ) {
          return;
        }

        $addUpdateTag(HISTORY_PUSH_TAG);
      });
    });
  }, [editor, features]);

  return null;
}
