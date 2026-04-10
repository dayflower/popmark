export const RICH_FALLBACK_STACK = "Inter, Avenir, Helvetica, Arial, sans-serif";
export const PLAIN_FALLBACK_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export function composeFontFamily(
  userFont: string | null | undefined,
  appendFallback: boolean | undefined,
  fallbackStack: string,
): string | null {
  const trimmed = userFont?.trim() ?? "";
  if (!appendFallback) return trimmed || null;
  if (trimmed) return `"${trimmed}", ${fallbackStack}`;
  return fallbackStack;
}
