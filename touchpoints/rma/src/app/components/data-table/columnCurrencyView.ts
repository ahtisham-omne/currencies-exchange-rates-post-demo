import { useCallback, useSyncExternalStore } from 'react';

/* ── "Show values as" on a listing's money columns (25 Nov 2026) ──────
 * Each money column of a listing table can show its amounts in the base
 * currency (PKR, converted at each record's rate, the default) or in the
 * record's own currency, the vendor's, from the column's header menu, as the
 * Partners listing does. It replaces any table-toolbar Base | Vendor switch.
 *
 * The choice is per column and kept for the session, apart from the records:
 * leaving the list for a return and coming back keeps it. Sorting, filtering
 * and totals over mixed currencies stay on the base figures whichever is
 * shown. */

export type ColumnCurrencyView = 'base' | 'party';

/** Table key → column key → view. A column not in it reads 'base'. */
const views = new Map<string, Record<string, ColumnCurrencyView>>();
const listeners = new Set<() => void>();
const EMPTY: Record<string, ColumnCurrencyView> = {};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setColumnCurrencyView(table: string, column: string, view: ColumnCurrencyView) {
  const current = views.get(table) ?? EMPTY;
  if ((current[column] ?? 'base') === view) return;
  views.set(table, { ...current, [column]: view });
  listeners.forEach((l) => l());
}

/** A table's money-column views for the session, and the setter for one column. */
export function useColumnCurrencyViews(
  table: string | null | undefined,
): [Record<string, ColumnCurrencyView>, (column: string, view: ColumnCurrencyView) => void] {
  const current = useSyncExternalStore(
    subscribe,
    () => (table ? views.get(table) ?? EMPTY : EMPTY),
    () => EMPTY,
  );
  const set = useCallback(
    (column: string, view: ColumnCurrencyView) => {
      if (table) setColumnCurrencyView(table, column, view);
    },
    [table],
  );
  return [current, set];
}
