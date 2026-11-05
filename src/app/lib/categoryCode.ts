/**
 * Generate a deterministic "C-1001"-style code for a category name.
 * Same name always maps to the same code.
 */
export function toCategoryCode(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  // Map into 1001..1999 range
  const code = 1001 + (hash % 999);
  return `C-${code}`;
}