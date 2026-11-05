import React, { createContext, useCallback, useContext, useState } from "react";
import {
  POS_BY_ITEM,
  QVS_BY_ITEM,
} from "./purchasing/mockData";
import type {
  POStatus,
  PurchaseOrder,
  QualifiedVendor,
} from "./purchasing/types";

/* ── Priority helpers ────────────────────────────────────────────────
   Vendor priority is a RANK that ALLOWS TIES — several vendors can share
   one level (e.g. three at priority 1). Exactly one vendor is the default
   (isPrimary) — the single anchor auto-PO selects — and it may sit at ANY
   rank: the user assigns priority and default freely. These run on every QV
   mutation to keep ranks dense (no gaps) and the default unique. */

/** Maximum number of priority tiers. Ranks are capped here — anything beyond
 *  tier 5 ties into tier 5 (the lowest tier). */
export const MAX_PRIORITY = 5;

/** Re-rank to contiguous levels (1..MAX_PRIORITY) preserving ties, ordered by
 *  the incoming priority then array order. Ranks are NOT forced unique and are
 *  capped at MAX_PRIORITY. */
function densifyRanks(qvs: QualifiedVendor[]): QualifiedVendor[] {
  const ordered = qvs
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v.priority - b.v.priority || a.i - b.i)
    .map((x) => x.v);
  let prevOriginal = Number.NaN;
  let rank = 0;
  return ordered.map((v) => {
    if (v.priority !== prevOriginal) {
      rank += 1;
      prevOriginal = v.priority;
    }
    return { ...v, priority: Math.min(rank, MAX_PRIORITY) };
  });
}

/** At most one default, set INTENTIONALLY and Priority 1 only. Keep a vendor
 *  flagged at the top rank if there is one; otherwise leave NO default. We do
 *  NOT fabricate one — the default is chosen by the user clicking the star, so a
 *  roster can legitimately have none until they pick. A stale flag below the top
 *  rank is cleared (a default can't sit off Priority 1). */
function ensureOneDefault(qvs: QualifiedVendor[]): QualifiedVendor[] {
  if (qvs.length === 0) return qvs;
  const topRank = Math.min(...qvs.map((v) => v.priority));
  const flagged = qvs.find((v) => v.isPrimary && v.priority === topRank);
  const keepId = flagged ? flagged.id : null;
  return qvs.map((v) => ({ ...v, isPrimary: v.id === keepId }));
}

/** Dense tie-preserving ranks + exactly one top-rank default. */
function normalizeQVs(qvs: QualifiedVendor[]): QualifiedVendor[] {
  return ensureOneDefault(densifyRanks(qvs));
}

/* ================================================================
   Context shape — mutators are stubs in slice 1A; fleshed out in
   slices 1B+ as the matching UI lands.
   ================================================================ */
interface PurchasingContextValue {
  qvsByItem: Record<string, QualifiedVendor[]>;
  posByItem: Record<string, PurchaseOrder[]>;
  /** Append a QV to an item at a new lowest rank. */
  addQV: (itemId: string, qv: QualifiedVendor) => void;
  /** Replace an item's QV list. Each QV's `priority` rank is honored and MAY
   *  tie; ranks are densified and exactly one top-rank default is guaranteed. */
  reorderQVs: (itemId: string, qvs: QualifiedVendor[]) => void;
  updateQV: (itemId: string, qvId: string, updates: Partial<QualifiedVendor>) => void;
  deleteQV: (itemId: string, qvId: string) => void;
  /** Mark one vendor as the default (isPrimary). Allowed at any rank. */
  setDefaultVendor: (itemId: string, qvId: string) => void;
  createPO: (itemId: string, po: PurchaseOrder) => void;
  updatePO: (itemId: string, poId: string, updates: Partial<PurchaseOrder>) => void;
  transitionPO: (itemId: string, poId: string, next: POStatus) => void;
}

const PurchasingContext = createContext<PurchasingContextValue | undefined>(undefined);

export function PurchasingProvider({ children }: { children: React.ReactNode }) {
  const [qvsByItem, setQvsByItem] = useState<Record<string, QualifiedVendor[]>>(() => {
    const cloned = structuredClone(QVS_BY_ITEM);
    const out: Record<string, QualifiedVendor[]> = {};
    for (const [itemId, list] of Object.entries(cloned)) out[itemId] = normalizeQVs(list);
    return out;
  });
  const [posByItem, setPosByItem] = useState<Record<string, PurchaseOrder[]>>(
    () => structuredClone(POS_BY_ITEM),
  );

  const addQV = useCallback((itemId: string, qv: QualifiedVendor) => {
    setQvsByItem((prev) => {
      const list = prev[itemId] ?? [];
      // Append at a fresh lowest rank unless the QV already carries one.
      const maxRank = list.reduce((m, v) => Math.max(m, v.priority), 0);
      const appended = { ...qv, priority: qv.priority > 0 ? qv.priority : maxRank + 1 };
      return { ...prev, [itemId]: normalizeQVs([...list, appended]) };
    });
  }, []);

  const reorderQVs = useCallback((itemId: string, qvs: QualifiedVendor[]) => {
    // Honor each QV's rank (ties allowed); densify + keep one top-rank default.
    setQvsByItem((prev) => ({ ...prev, [itemId]: normalizeQVs(qvs) }));
  }, []);

  const updateQV = useCallback(
    (itemId: string, qvId: string, updates: Partial<QualifiedVendor>) => {
      setQvsByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] ?? []).map((v) =>
          v.id === qvId ? { ...v, ...updates } : v,
        ),
      }));
    },
    [],
  );

  const deleteQV = useCallback((itemId: string, qvId: string) => {
    // Re-rank + re-pick a default if the removed vendor was it.
    setQvsByItem((prev) => ({
      ...prev,
      [itemId]: normalizeQVs((prev[itemId] ?? []).filter((v) => v.id !== qvId)),
    }));
  }, []);

  const setDefaultVendor = useCallback((itemId: string, qvId: string) => {
    setQvsByItem((prev) => {
      const list = prev[itemId] ?? [];
      if (!list.some((v) => v.id === qvId)) return prev;
      // Flag the chosen vendor; ensureOneDefault keeps it at whatever rank it
      // sits (default is a free choice, not restricted to the top rank).
      const flagged = list.map((v) => ({ ...v, isPrimary: v.id === qvId }));
      return { ...prev, [itemId]: ensureOneDefault(flagged) };
    });
  }, []);

  const createPO = useCallback((itemId: string, po: PurchaseOrder) => {
    setPosByItem((prev) => ({
      ...prev,
      [itemId]: [po, ...(prev[itemId] ?? [])],
    }));
    // eslint-disable-next-line no-console
    console.log("[PurchasingContext] createPO stub", { itemId, po });
  }, []);

  const updatePO = useCallback(
    (itemId: string, poId: string, updates: Partial<PurchaseOrder>) => {
      setPosByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] ?? []).map((p) =>
          p.id === poId ? { ...p, ...updates } : p,
        ),
      }));
      // eslint-disable-next-line no-console
      console.log("[PurchasingContext] updatePO stub", { itemId, poId, updates });
    },
    [],
  );

  const transitionPO = useCallback(
    (itemId: string, poId: string, next: POStatus) => {
      setPosByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] ?? []).map((p) =>
          p.id === poId ? { ...p, status: next } : p,
        ),
      }));
      // eslint-disable-next-line no-console
      console.log("[PurchasingContext] transitionPO stub", { itemId, poId, next });
    },
    [],
  );

  return (
    <PurchasingContext.Provider
      value={{
        qvsByItem,
        posByItem,
        addQV,
        reorderQVs,
        updateQV,
        deleteQV,
        setDefaultVendor,
        createPO,
        updatePO,
        transitionPO,
      }}
    >
      {children}
    </PurchasingContext.Provider>
  );
}

export function usePurchasing(): PurchasingContextValue {
  const ctx = useContext(PurchasingContext);
  if (!ctx) {
    throw new Error("usePurchasing must be used within a PurchasingProvider");
  }
  return ctx;
}