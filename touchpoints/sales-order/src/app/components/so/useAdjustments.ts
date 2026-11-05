/* ═══════════════════════════════════════════════════════════════════════════
 *  useAdjustments — SO module
 *  ──────────────────────────
 *  Single source of truth for one-time premiums/discounts on this SO.
 *  Unlike pricing rules, adjustments have no customer-level rule book —
 *  they're authored manually per SO at either quote scope (apply to the
 *  whole order subtotal) or item scope (apply to specific line ids).
 *  Quote-scope and item-scope entries are independent.
 *
 *  Both the SOSidebar's ManageAdjustmentsModal and the LineItemConfigModal
 *  subscribe to the same instance so add/edit/delete from either surface
 *  propagates, and the modal totals + line subtotals reflect every
 *  applied entry in real time.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import type { AdjustmentAttachment } from '../shared/AdjustmentFormModal';
import type { SOLine } from './types';

export interface Adjustment {
  id: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  /** quote-scope = applies once to the SO subtotal.
   *  item-scope  = applies per line in `appliedTo`, on each line's
   *                pre-adjustment subtotal. */
  scope: 'quote' | 'item';
  appliedTo?: string[];
  isApplied: boolean;
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
  internalNotes?: string;
  attachments?: AdjustmentAttachment[];
}

/** $ impact a single adjustment contributes against a given base subtotal.
 *  For `$` adjustments the amount field is the literal dollar value; for
 *  `%` adjustments it's a percentage of the base. */
function dollarImpact(adj: Adjustment, base: number): number {
  return adj.amountType === '%' ? (base * adj.amount) / 100 : adj.amount;
}

export interface AdjustmentsLineBreakdown {
  lineId: string;
  /** Per-line item-scope discount and premium totals from currently
   *  applied adjustments. Premiums add, discounts subtract. */
  premiumAmount: number;
  discountAmount: number;
  /** Net impact on this line: premium − discount. */
  net: number;
}

export interface AdjustmentsAPI {
  adjustments: Adjustment[];
  /** Per-line breakdown of item-scope adjustment impact. */
  lineBreakdowns: Map<string, AdjustmentsLineBreakdown>;
  /** Aggregate item-scope totals across all lines. */
  itemTotals: { premium: number; discount: number; net: number };
  /** Aggregate quote-scope totals. */
  quoteTotals: { premium: number; discount: number; net: number };
  /** Combined net impact (item + quote scope). */
  grandTotal: { premium: number; discount: number; net: number };

  addAdjustment: (input: Omit<Adjustment, 'id' | 'isApplied'> & { id?: string }) => Adjustment;
  updateAdjustment: (id: string, patch: Partial<Adjustment>) => void;
  removeAdjustment: (id: string) => void;
  unapplyAdjustment: (id: string, reason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT') => void;
  reapplyAdjustment: (id: string) => void;
  /** Replace the `appliedTo` set of an item-scope adjustment. Used by the
   *  summary modal's "apply one item's adjustment to other items" flow. */
  setAdjustmentAppliedTo: (id: string, lineIds: string[]) => void;
}

/* Seed a couple of demo adjustments tied to real line ids so the summary
   modal starts with meaningful coverage rather than an empty state. */
function seedInitial(lines: SOLine[], restate: (usd: number) => number = (n) => n): Adjustment[] {
  const active = lines.filter((l) => !l.cancelled);
  const first = active[0]?.id;
  const third = active[2]?.id;
  const seed: Adjustment[] = [
    { id: 'A003', label: 'Expedited Build Schedule', type: 'premium', amountType: '$', amount: restate(4500), scope: 'quote', isApplied: true },
    { id: 'A004', label: 'Returning Customer Credit', type: 'discount', amountType: '$', amount: restate(2500), scope: 'quote', isApplied: true },
  ];
  if (first) seed.unshift({ id: 'A001', label: 'Chassis Delivery & Prep', type: 'premium', amountType: '$', amount: restate(2400), scope: 'item', appliedTo: [first], isApplied: true });
  if (third) seed.splice(1, 0, { id: 'A002', label: 'Radio Programming & Encryption', type: 'premium', amountType: '$', amount: restate(1350), scope: 'item', appliedTo: [third], isApplied: true });
  return seed;
}

export function useAdjustments(lines: SOLine[], options?: { skipSeed?: boolean; /** The demo seed is written in USD; this restates it in the SO's currency. */ restateSeed?: (usd: number) => number; /** Records that arrive with adjustments already on them (today: the legacy importer) open with these instead of the demo seed. */ seed?: Adjustment[] }): AdjustmentsAPI {
  /* Lazy initializer pulls from `lines` once on first render. Adding /
     removing lines after that doesn't re-seed (intentional — the user's
     manual adjustments shouldn't be silently rewritten by a line edit).
     Newly-created orders pass `skipSeed: true` so they open with zero
     adjustments — only mock demo SOs get the seed. */
  const [adjustments, setAdjustments] = useState<Adjustment[]>(() =>
    options?.seed ?? (options?.skipSeed ? [] : seedInitial(lines, options?.restateSeed)),
  );

  /* Derived: per-line breakdown for item-scope adjustments. Uses the
     pre-adjustment line subtotal as the base for % calculations. */
  const lineBreakdowns = useMemo(() => {
    const map = new Map<string, AdjustmentsLineBreakdown>();
    for (const line of lines) {
      if (line.cancelled) continue;
      const baseSubtotal = line.orderedQty * line.unitPrice;
      let premium = 0;
      let discount = 0;
      for (const adj of adjustments) {
        if (!adj.isApplied) continue;
        if (adj.scope !== 'item') continue;
        if (!adj.appliedTo?.includes(line.id)) continue;
        const $ = dollarImpact(adj, baseSubtotal);
        if (adj.type === 'premium') premium += $;
        else discount += $;
      }
      map.set(line.id, { lineId: line.id, premiumAmount: premium, discountAmount: discount, net: premium - discount });
    }
    return map;
  }, [adjustments, lines]);

  const itemTotals = useMemo(() => {
    let premium = 0;
    let discount = 0;
    for (const b of lineBreakdowns.values()) {
      premium += b.premiumAmount;
      discount += b.discountAmount;
    }
    return { premium, discount, net: premium - discount };
  }, [lineBreakdowns]);

  const quoteTotals = useMemo(() => {
    /* Quote-scope $-adjustments use their literal amount; %-adjustments
       are interpreted against the pre-adjustment SO subtotal (sum of raw
       line subtotals, ignoring rules + item-scope adjustments). Keeping
       the base simple so quote-level percentages stay predictable. */
    const baseSubtotal = lines
      .filter((l) => !l.cancelled)
      .reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
    let premium = 0;
    let discount = 0;
    for (const adj of adjustments) {
      if (!adj.isApplied) continue;
      if (adj.scope !== 'quote') continue;
      const $ = dollarImpact(adj, baseSubtotal);
      if (adj.type === 'premium') premium += $;
      else discount += $;
    }
    return { premium, discount, net: premium - discount };
  }, [adjustments, lines]);

  const grandTotal = useMemo(
    () => ({
      premium: itemTotals.premium + quoteTotals.premium,
      discount: itemTotals.discount + quoteTotals.discount,
      net: itemTotals.net + quoteTotals.net,
    }),
    [itemTotals, quoteTotals],
  );

  const addAdjustment: AdjustmentsAPI['addAdjustment'] = (input) => {
    const id = input.id ?? `A${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const next: Adjustment = { ...input, id, isApplied: true };
    setAdjustments((prev) => [...prev, next]);
    return next;
  };

  const updateAdjustment: AdjustmentsAPI['updateAdjustment'] = (id, patch) =>
    setAdjustments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const removeAdjustment: AdjustmentsAPI['removeAdjustment'] = (id) =>
    setAdjustments((prev) => prev.filter((a) => a.id !== id));

  const unapplyAdjustment: AdjustmentsAPI['unapplyAdjustment'] = (id, reason = 'USER_UNAPPLIED') =>
    setAdjustments((prev) => prev.map((a) => (a.id === id ? { ...a, isApplied: false, unappliedReason: reason } : a)));

  const reapplyAdjustment: AdjustmentsAPI['reapplyAdjustment'] = (id) =>
    setAdjustments((prev) => prev.map((a) => (a.id === id ? { ...a, isApplied: true, unappliedReason: undefined } : a)));

  const setAdjustmentAppliedTo: AdjustmentsAPI['setAdjustmentAppliedTo'] = (id, lineIds) =>
    setAdjustments((prev) => prev.map((a) => (a.id === id ? { ...a, appliedTo: [...lineIds] } : a)));

  return {
    adjustments,
    lineBreakdowns,
    itemTotals,
    quoteTotals,
    grandTotal,
    addAdjustment,
    updateAdjustment,
    removeAdjustment,
    unapplyAdjustment,
    reapplyAdjustment,
    setAdjustmentAppliedTo,
  };
}
