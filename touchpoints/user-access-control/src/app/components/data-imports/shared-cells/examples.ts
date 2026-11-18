/* Issue tooltips show a few correct values, never the whole vocabulary: a
 * list of sixty units reads as noise. At most MAX_EXAMPLES, the column's own
 * example first, then the first valid options after it. */

export const MAX_EXAMPLES = 5;

export function pickExamples(example: string | undefined, options: readonly string[] | undefined, max = MAX_EXAMPLES): string[] {
  const out: string[] = [];
  const add = (v: string | undefined) => {
    const t = (v ?? "").trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase()) && out.length < max) out.push(t);
  };
  add(example);
  for (const o of options ?? []) add(o);
  return out;
}

/** "A, B, C, D or E" from at most MAX_EXAMPLES values, for messages. */
export function exampleList(options: readonly string[], max = MAX_EXAMPLES): string {
  const shown = options.slice(0, max);
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} or ${shown[shown.length - 1]}`;
}

/** Shortens a "Use A, B, C, ... or Z." run inside a validator message to its
 *  first MAX_EXAMPLES values. The module validators are vendored byte for
 *  byte from their home repos, so the cap is applied to their output here
 *  rather than by editing their copy. Messages without such a run pass
 *  through unchanged. */
export function capListedValues(message: string, max = MAX_EXAMPLES): string {
  return message.replace(/\b(Use (?:one of: )?)([^.]+)\./g, (whole, prefix: string, list: string) => {
    const parts = list.split(/,\s*(?:or\s+)?|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length <= max || parts.some((p) => p.length > 40)) return whole;
    return `${prefix}${parts.slice(0, max).join(", ")}, or another value from the Valid Values sheet.`;
  });
}
