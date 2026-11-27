import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each quote is shown in ────────────────────────────
 * The customer's (the quote's own) by default since 27 Nov 2026 (D1: line
 * items open in the document's currency, as Mahreen's mockups draw them);
 * the Line Items toolbar's Base Currency | Customer Currency switch flips it
 * for that quote.
 * Kept for the session, apart from the quote itself, so a view change is
 * never an edit or a version change, and leaving the quote and coming back
 * keeps it. Keyed by quote id. */

const DEFAULT_VIEW: DocView = "document";
const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setQuoteView(quoteId: string, view: DocView) {
  if ((views.get(quoteId) ?? DEFAULT_VIEW) === view) return;
  views.set(quoteId, view);
  listeners.forEach((l) => l());
}

export function useQuoteView(quoteId: string | undefined): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (quoteId ? views.get(quoteId) ?? DEFAULT_VIEW : DEFAULT_VIEW),
  );
}
