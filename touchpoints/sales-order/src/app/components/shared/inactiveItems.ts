/**
 * Item-master lifecycle: which catalogue items have been marked inactive.
 *
 * Mirrors the Purchase Order module's `inactive` field (PO `poStore`
 * `POLineItemInactive`): the same `{ by, role, at }` record, and the same
 * rule. Inactive never removes an item from a record it is already on. It
 * only means the item can no longer be added to new ones, and moving a
 * Draft forward with one on it asks first (see `InactiveItemsWarningModal`).
 *
 * Keyed by item code, not by line, because inactivity belongs to the item
 * master. Every surface that shows an item (line table, item preview,
 * configurator, product pickers) looks the code up here, so marking one
 * item inactive updates all of them at once.
 *
 * The three seeded codes all sit on the demo quote and the demo sales
 * order, so the pill and the send guard can be seen without setup.
 * `000-100-195` (the lot-serialized AED) is deliberately NOT one of them:
 * the SO seed puts it on every order as the lot+serial allocation demo,
 * so marking it inactive would trip the guard on every single send.
 */

export interface ItemInactive {
  /** Who marked the item master inactive (display name). */
  by: string;
  /** Their role, e.g. "System Manager". */
  role: string;
  /** ISO date the item was marked inactive. */
  at: string;
}

export const INACTIVE_ITEMS: Record<string, ItemInactive> = {
  "000-100-041": { by: "Sarah Mitchell", role: "System Manager", at: "2026-09-24" },
  "000-100-049": { by: "David Kowalski", role: "Inventory Manager", at: "2026-09-18" },
  "000-100-079": { by: "Sarah Mitchell", role: "System Manager", at: "2026-09-10" },
};

/** The inactive record for an item code, or `undefined` when it is active. */
export function getItemInactive(code?: string | null): ItemInactive | undefined {
  if (!code) return undefined;
  return INACTIVE_ITEMS[code];
}

export function isItemInactive(code?: string | null): boolean {
  return !!getItemInactive(code);
}

/** "2026-09-24" -> "Sep 24, 2026". Falls back to the raw value if unparseable. */
export function formatInactiveDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
