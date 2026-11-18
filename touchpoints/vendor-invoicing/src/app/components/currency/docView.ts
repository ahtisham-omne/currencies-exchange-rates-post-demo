import { useSyncExternalStore } from 'react';
import type { DocView } from './docCurrencyContext';

/* ── Which currency each document is shown in ─────────────────────────
 * Base by default; the header's Base Currency | Vendor Currency toggle flips
 * it for that document. Kept for the session, apart from the record, so a
 * view change is never an edit. Keyed by document: "invoice:<id>" for an
 * invoice page, "invoice-form:<id or new>" for the create screen,
 * "payment:<id>" for a payment page and "payment-form:new" for Record
 * Payment. A screen whose default isn't base (Record Payment opens in the
 * invoices' currency, since what is owed stays in it) passes its own. */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setDocView(key: string, view: DocView, fallback: DocView = 'base') {
  if ((views.get(key) ?? fallback) === view) return;
  views.set(key, view);
  listeners.forEach((l) => l());
}

export function useDocViewOf(key: string | undefined, fallback: DocView = 'base'): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (key ? views.get(key) ?? fallback : fallback),
  );
}
