import { useSyncExternalStore } from 'react';
import type { DocView } from './docCurrencyContext';

/* ── OMNE currency kit: which currency each document is shown in ───────
 * Base by default; the line items toolbar's Base Currency | <Party>
 * Currency switch flips it for that document. Kept for the session, apart
 * from the record, so a view change is never an edit, and navigating away
 * and back keeps it. Keyed by document: "<module>:<id>", e.g.
 * "purchase-order:PO-1003", "invoice:INV-000221". A print preview keeps its
 * own key ("<module>-print:<id>") because it defaults to the document's
 * currency, not base.
 *
 * Shared file. Do not edit it in a module. */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setDocView(key: string, view: DocView, fallback: DocView = 'base') {
  if ((views.get(key) ?? fallback) === view) return;
  views.set(key, view);
  listeners.forEach((l) => l());
}

export function getDocView(key: string | undefined, fallback: DocView = 'base'): DocView {
  return key ? views.get(key) ?? fallback : fallback;
}

export function useDocViewOf(key: string | undefined, fallback: DocView = 'base'): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => getDocView(key, fallback),
  );
}
