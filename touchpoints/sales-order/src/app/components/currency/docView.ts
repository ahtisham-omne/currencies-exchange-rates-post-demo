import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each order is shown in ────────────────────────────
 * The customer's (the order's own currency) by default since 27 Nov 2026
 * (D1: order line items open in the document's currency; base before);
 * the Line Items toolbar's Base Currency | Customer Currency switch flips
 * it for that order. Kept for the session, apart from the record, so
 * a view change is never an edit, and leaving the order and coming back
 * keeps it. Keyed by document: "so:<id>". Same store as Vendor Invoicing's
 * (components/currency/docView.ts there). */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setDocView(key: string, view: DocView, fallback: DocView = "document") {
  if ((views.get(key) ?? fallback) === view) return;
  views.set(key, view);
  listeners.forEach((l) => l());
}

export function useDocViewOf(key: string | undefined, fallback: DocView = "document"): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => (key ? views.get(key) ?? fallback : fallback),
  );
}
