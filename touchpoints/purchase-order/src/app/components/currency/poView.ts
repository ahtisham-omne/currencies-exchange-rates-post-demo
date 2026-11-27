import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each PO is shown in ───────────────────────────────
 * The PO's own currency (the vendor's) by default: order line items open
 * in the document's currency (D1, 27 Nov 2026). The Line Items' Base
 * Currency | Vendor Currency switch flips it for that PO. Kept for the
 * session, apart from the PO itself, so a view change is never an edit or a
 * version change, and leaving the PO and coming back keeps the choice.
 * Restored 25 Nov 2026 (detail-page currency switch). */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setPOView(poId: string, view: DocView) {
  if ((views.get(poId) ?? "document") === view) return;
  views.set(poId, view);
  listeners.forEach((l) => l());
}

export function usePOView(poId: string | undefined): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (poId ? views.get(poId) ?? "document" : "document"),
  );
}
