import { useCallback, useState } from 'react';

/* ── OMNE currency kit: a listing's money columns ─────────────────────
 * Each money column in a listing picks how it shows its amounts from its
 * header menu ("Show values as", ShowValuesAs.tsx), as Partners does: in
 * the base currency, converted at each record's own rate (the default), or
 * in the record's own currency. The other one is on the hover.
 * Sorting, filtering and totals stay on base values, so mixed currencies
 * compare. The choice holds for the session, per table and column, so it
 * survives opening a record and coming back to the list.
 *
 * Shared file. Do not edit it in a module. */

export type ColumnCurrencyView = 'base' | 'party';

const chosen = new Map<string, ColumnCurrencyView>();

/** Per-column views for one table. `table` is a stable id: "purchase-orders". */
export function useColumnCurrencyViews(table: string) {
  const [views, setViews] = useState<Record<string, ColumnCurrencyView>>(() => {
    const out: Record<string, ColumnCurrencyView> = {};
    chosen.forEach((view, key) => {
      if (key.startsWith(`${table}:`)) out[key.slice(table.length + 1)] = view;
    });
    return out;
  });
  const viewOf = useCallback((column: string): ColumnCurrencyView => views[column] ?? 'base', [views]);
  const setView = useCallback(
    (column: string, view: ColumnCurrencyView) => {
      chosen.set(`${table}:${column}`, view);
      setViews((prev) => ({ ...prev, [column]: view }));
    },
    [table],
  );
  return { viewOf, setView };
}
