/* ═══════════════════════════════════════════════════════════════
   usePOAdjustments — PO-backed equivalent of Sales-Order-V5's
   `useAdjustments` hook. Exposes the same `AdjustmentsAPI` surface the
   ported `ManageAdjustmentsModal` consumes, but reads/writes the PO
   store (`po.adjustments`) so changes persist and flow into `po.total`.
   ═══════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { setPOAdjustments, getPO, type PurchaseOrderData } from "./poStore";
import {
  computeAdjustmentBreakdowns,
  lineBaseValue,
  newAdjustmentId,
  type POAdjustment,
  type AdjustmentTotals,
  type LineAdjustmentBreakdown,
  type AdjustmentUnappliedReason,
} from "./poOrderPricing";

export type Adjustment = POAdjustment;

export interface AdjustmentsAPI {
  adjustments: POAdjustment[];
  lineBreakdowns: Map<string, LineAdjustmentBreakdown>;
  itemTotals: AdjustmentTotals;
  quoteTotals: AdjustmentTotals;
  grandTotal: AdjustmentTotals;
  addAdjustment: (input: Omit<POAdjustment, "id" | "isApplied" | "unappliedReason"> & { id?: string }) => POAdjustment;
  updateAdjustment: (id: string, patch: Partial<Omit<POAdjustment, "id">>) => void;
  removeAdjustment: (id: string) => void;
  unapplyAdjustment: (id: string, reason?: AdjustmentUnappliedReason) => void;
  reapplyAdjustment: (id: string) => void;
}

export function usePOAdjustments(po: PurchaseOrderData | null | undefined): AdjustmentsAPI {
  const adjustments = po?.adjustments ?? [];
  const breakdown = useMemo(
    () =>
      computeAdjustmentBreakdowns(
        (po?.lineItems ?? []).filter((li) => !li.cancelled).map((li) => ({ id: li.id, base: lineBaseValue(li) })),
        adjustments,
      ),
    [po, adjustments],
  );

  return useMemo<AdjustmentsAPI>(() => {
    /* Every action reads the LATEST store value — SO's add flow calls
       add → unapply back-to-back, so a render-time snapshot would drop
       the just-added row. */
    const latest = (): POAdjustment[] => (po ? getPO(po.id)?.adjustments ?? [] : []);
    const write = (fn: (list: POAdjustment[]) => POAdjustment[]) => {
      if (po) setPOAdjustments(po.id, fn(latest()));
    };
    return {
      adjustments,
      ...breakdown,
      addAdjustment: (input) => {
        const created: POAdjustment = { ...input, id: input.id ?? newAdjustmentId(), isApplied: true };
        write((list) => [...list, created]);
        return created;
      },
      updateAdjustment: (id, patch) => write((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a))),
      removeAdjustment: (id) => write((list) => list.filter((a) => a.id !== id)),
      unapplyAdjustment: (id, reason = "USER_UNAPPLIED") =>
        write((list) => list.map((a) => (a.id === id ? { ...a, isApplied: false, unappliedReason: reason } : a))),
      reapplyAdjustment: (id) =>
        write((list) => list.map((a) => (a.id === id ? { ...a, isApplied: true, unappliedReason: undefined } : a))),
    };
  }, [po, adjustments, breakdown]);
}
