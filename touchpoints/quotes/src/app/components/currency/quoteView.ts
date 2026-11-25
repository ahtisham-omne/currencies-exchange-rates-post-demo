import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each quote is shown in ────────────────────────────
 * Base by default; the header's Base Currency | Customer Currency switch
 * flips it for that quote. Kept for the session, apart from the quote
 * itself, so a view change is never an edit or a version change, and
 * leaving the quote and coming back keeps it. Keyed by quote id. */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setQuoteView(quoteId: string, view: DocView) {
  if ((views.get(quoteId) ?? "base") === view) return;
  views.set(quoteId, view);
  listeners.forEach((l) => l());
}

export function useQuoteView(quoteId: string | undefined): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (quoteId ? views.get(quoteId) ?? "base" : "base"),
  );
}
