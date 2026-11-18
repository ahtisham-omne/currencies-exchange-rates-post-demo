import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each PO is shown in ───────────────────────────────
 * Base by default; the header's Base Currency | Vendor Currency toggle flips
 * it for that PO. Kept for the session, apart from the PO itself, so a view
 * change is never an edit or a version change. */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setPOView(poId: string, view: DocView) {
  if ((views.get(poId) ?? "base") === view) return;
  views.set(poId, view);
  listeners.forEach((l) => l());
}

export function usePOView(poId: string | undefined): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (poId ? views.get(poId) ?? "base" : "base"),
  );
}
