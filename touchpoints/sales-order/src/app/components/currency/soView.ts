import { useSyncExternalStore } from "react";
import type { DocView } from "./docCurrencyContext";

/* ── Which currency each SO is shown in ───────────────────────────────
 * Base by default; the header's Base Currency | Customer Currency toggle
 * flips it for that order. Kept for the session, apart from the order
 * itself, so a view change is never an edit or a version change. */

const views = new Map<string, DocView>();
const listeners = new Set<() => void>();

export function setSOView(soId: string, view: DocView) {
  if ((views.get(soId) ?? "base") === view) return;
  views.set(soId, view);
  listeners.forEach((l) => l());
}

export function useSOView(soId: string | undefined): DocView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (soId ? views.get(soId) ?? "base" : "base"),
  );
}
