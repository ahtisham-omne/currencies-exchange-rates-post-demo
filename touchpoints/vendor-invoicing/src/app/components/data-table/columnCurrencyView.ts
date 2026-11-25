import { useCallback, useState } from 'react';
import type { CurrencyView } from './types';

/* ── Per-column "Show values as" choice ──────────────────────────────
 * Each money column remembers its own view (base or the record's own
 * currency) for the session, like the Partners listing. Kept in a small
 * module store keyed by table scope + column, so a table that remounts
 * (switching Vendor Payments tabs, resetting columns) keeps the choice. */

const views = new Map<string, CurrencyView>();

export function useColumnCurrencyViews(scope: string) {
  const [state, setState] = useState<Record<string, CurrencyView>>(() => {
    const prefix = `${scope}:`;
    const out: Record<string, CurrencyView> = {};
    views.forEach((v, k) => {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    });
    return out;
  });
  const setView = useCallback(
    (columnKey: string, view: CurrencyView) => {
      views.set(`${scope}:${columnKey}`, view);
      setState((prev) => ({ ...prev, [columnKey]: view }));
    },
    [scope],
  );
  return [state, setView] as const;
}
