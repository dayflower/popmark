import { CHECK_LIST, TRANSFORMERS } from "@lexical/markdown";

// Support both "- [ ] " and "-[ ] " (with or without space between dash and bracket)
export const CUSTOM_CHECK_LIST = {
  ...CHECK_LIST,
  regExp: /^(\s*)[-*+]\s?(\[(\s|x)?\])\s/i,
};
export const CUSTOM_TRANSFORMERS = [CUSTOM_CHECK_LIST, ...TRANSFORMERS];
