/**
 * In-order letter matching for the Columns panel search (ERP-5144 AC9, Spec
 * Section 10 rule 2; the Roles listing follows the same rule, ERP-6899 AC12).
 *
 * The query's letters must appear in the text in the same order, case
 * insensitive, but need not sit next to each other: "iao" finds "Invite
 * Accepted On", and "inv" finds both "Invited By" and "Invite Accepted On".
 *
 * Returns the index in `text` of each matched letter, or null when the text
 * does not match. Matching is greedy left to right, so each query letter takes
 * the earliest position it can. Whitespace in the query is ignored, so
 * "invite acc" and "inviteacc" match the same columns.
 */
export function subsequenceMatchIndices(text: string, query: string): number[] | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  const t = text.toLowerCase();
  const indices: number[] = [];
  let from = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, from);
    if (at === -1) return null;
    indices.push(at);
    from = at + 1;
  }
  return indices;
}

/** True when every letter of `query` appears in `text`, in order. */
export function matchesSubsequence(text: string, query: string): boolean {
  return subsequenceMatchIndices(text, query) !== null;
}
