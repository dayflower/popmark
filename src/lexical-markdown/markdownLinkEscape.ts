// Escape characters that are structural in the Markdown link syntax so they can
// live inside a link label or URL without breaking parsing.
export function escapeLinkLabel(text: string): string {
  return text.replace(/[\\[\]]/g, "\\$&");
}

export function escapeLinkUrl(text: string): string {
  return text.replace(/[\\()]/g, "\\$&");
}

// Decode backslash escapes back into their literal characters.
export function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\s\S])/g, "$1");
}
