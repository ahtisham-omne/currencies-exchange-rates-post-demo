/* Payment hold types (user 10/9/26): the ONE list the hold reason dialog
 * offers and the hold indicator reads back. A placed hold stores its
 * reason as "Type: note" (or just "Type"), so splitHoldReason recovers
 * both halves for display. */
export const HOLD_REASON_TYPES = [
  'Vendor dispute in progress',
  'Credit memo expected',
  'Vendor payment details not verified',
] as const;

export function splitHoldReason(reason?: string): { type: string; note: string } {
  const text = (reason ?? '').trim();
  if (!text) return { type: 'Other', note: '' };
  const known = HOLD_REASON_TYPES.find((t) => text === t || text.startsWith(`${t}:`));
  if (known) return { type: known, note: text.slice(known.length).replace(/^:\s*/, '') };
  // Free-text holds (creation form, "Other") have no type prefix.
  return { type: 'Other', note: text };
}
