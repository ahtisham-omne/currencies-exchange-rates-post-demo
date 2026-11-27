/* ── One-time adjustments on imported orders ──
   An order brought in from a legacy file can arrive with discounts and
   premiums already on it, at order level and at line level. They are not
   part of the `SalesOrder` record (the module keeps adjustments in its own
   `useAdjustments` layer), so they wait here until the detail page opens
   and seeds that layer from them. Its own module since 25 Nov 2026 so the
   listing's order summary (summarizeSO) can read them too; store.tsx
   re-exports both functions. */
const importedAdjustments: Map<string, unknown[]> = new Map();

export function setImportedAdjustments(soId: string, adjustments: unknown[]): void {
  if (adjustments.length > 0) importedAdjustments.set(soId, adjustments);
}

export function getImportedAdjustments(soId: string): unknown[] | undefined {
  return importedAdjustments.get(soId);
}
