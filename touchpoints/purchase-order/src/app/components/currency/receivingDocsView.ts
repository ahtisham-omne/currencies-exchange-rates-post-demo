import { useSyncExternalStore } from "react";
import type { ColumnCurrencyView } from "../pocColumnHeaderMenu";

/* ── Which currency each PO's Receiving Docs Value column shows ─────────
 * The column's own "Show values as" choice (25 Nov 2026), apart from the
 * PO page's Base Currency | Vendor Currency switch (poView.ts): changing one
 * never flips the other. Base by default; kept per PO for the session, so
 * leaving the tab or the PO and coming back keeps it. */

const views = new Map<string, ColumnCurrencyView>();
const listeners = new Set<() => void>();

export function setReceivingValueView(poId: string, view: ColumnCurrencyView) {
  if ((views.get(poId) ?? "base") === view) return;
  views.set(poId, view);
  listeners.forEach((l) => l());
}

export function useReceivingValueView(poId: string | undefined): ColumnCurrencyView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (poId ? views.get(poId) ?? "base" : "base"),
  );
}
