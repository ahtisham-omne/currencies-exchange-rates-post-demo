import { useCallback, useState } from 'react';

/* ── A listing's money columns: base or customer currency ─────────────
 * Each money column in a listing picks how it shows its amounts from its
 * header menu ("Show values as"), as Partners does: in the base currency,
 * converted at the record's own rate (the default), or in the customer's
 * currency, the record's own amount. The other one is on the hover.
 * Sorting, filtering and totals stay in base, so mixed currencies compare.
 * The choice holds for the session, per table and column, so it survives
 * opening a record and coming back to the list. */

export type ColumnCurrencyView = 'base' | 'customer';

const chosen = new Map<string, ColumnCurrencyView>();

export function useColumnCurrencyViews(table: string) {
  const [views, setViews] = useState<Record<string, ColumnCurrencyView>>(() => {
    const out: Record<string, ColumnCurrencyView> = {};
    chosen.forEach((view, key) => {
      if (key.startsWith(`${table}:`)) out[key.slice(table.length + 1)] = view;
    });
    return out;
  });
  const viewOf = useCallback((column: string): ColumnCurrencyView => views[column] ?? 'base', [views]);
  const setView = useCallback((column: string, view: ColumnCurrencyView) => {
    chosen.set(`${table}:${column}`, view);
    setViews((prev) => ({ ...prev, [column]: view }));
  }, [table]);
  return { viewOf, setView };
}
