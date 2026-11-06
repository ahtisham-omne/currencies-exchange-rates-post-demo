/* ═══════════════════════════════════════════════════════════════════════════
 *  useAdjustments — Quote module
 *  Mirrors the SO equivalent at Sales-Order-V5/.../useAdjustments.ts.
 *  See that file for design notes. The duplication is intentional — the
 *  two modules live in separate src trees and can't share a file.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import type { AdjustmentAttachment } from '../shared/AdjustmentFormModal';

export interface Adjustment {
  id: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  scope: 'quote' | 'item';
  appliedTo?: string[];
  isApplied: boolean;
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
  internalNotes?: string;
  attachments?: AdjustmentAttachment[];
}

interface QuoteLineRef {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

function dollarImpact(adj: Adjustment, base: number): number {
  return adj.amountType === '%' ? (base * adj.amount) / 100 : adj.amount;
}

/** The net of `adjustments` on `lines`, worked out as `grandTotal.net` is:
 *  the currency confirmation's "after" column uses it on converted lines. */
export function adjustmentsNet(adjustments: Adjustment[], lines: QuoteLineRef[]): number {
  const quoteBase = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  let net = 0;
  for (const adj of adjustments) {
    if (!adj.isApplied) continue;
    const sign = adj.type === 'premium' ? 1 : -1;
    if (adj.scope === 'quote') net += sign * dollarImpact(adj, quoteBase);
    else if (adj.scope === 'item') {
      for (const line of lines) if (adj.appliedTo?.includes(line.id)) net += sign * dollarImpact(adj, line.quantity * line.unitPrice);
    }
  }
  return net;
}

export interface AdjustmentsLineBreakdown {
  lineId: string;
  premiumAmount: number;
  discountAmount: number;
  net: number;
}

export interface AdjustmentsAPI {
  adjustments: Adjustment[];
  lineBreakdowns: Map<string, AdjustmentsLineBreakdown>;
  itemTotals: { premium: number; discount: number; net: number };
  quoteTotals: { premium: number; discount: number; net: number };
  grandTotal: { premium: number; discount: number; net: number };

  addAdjustment: (input: Omit<Adjustment, 'id' | 'isApplied'> & { id?: string }) => Adjustment;
  updateAdjustment: (id: string, patch: Partial<Adjustment>) => void;
  removeAdjustment: (id: string) => void;
  unapplyAdjustment: (id: string, reason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT') => void;
  reapplyAdjustment: (id: string) => void;
  setAdjustmentAppliedTo: (id: string, lineIds: string[]) => void;
}

function seedInitial(lines: QuoteLineRef[], restate: (usd: number) => number = (n) => n): Adjustment[] {
  const first = lines[0]?.id;
  const third = lines[2]?.id;
  const seed: Adjustment[] = [
    { id: 'A003', label: 'Expedited Build Schedule', type: 'premium', amountType: '$', amount: restate(4500), scope: 'quote', isApplied: true },
    { id: 'A004', label: 'Returning Customer Credit', type: 'discount', amountType: '$', amount: restate(2500), scope: 'quote', isApplied: true },
  ];
  if (first) seed.unshift({ id: 'A001', label: 'Chassis Delivery & Prep', type: 'premium', amountType: '$', amount: restate(2400), scope: 'item', appliedTo: [first], isApplied: true });
  if (third) seed.splice(1, 0, { id: 'A002', label: 'Radio Programming & Encryption', type: 'premium', amountType: '$', amount: restate(1350), scope: 'item', appliedTo: [third], isApplied: true });
  return seed;
}

export function useAdjustments(lines: QuoteLineRef[], options?: { skipSeed?: boolean; /** The demo seed is written in USD; this restates it in the quote's currency. */ restateSeed?: (usd: number) => number; /** Records that arrive with adjustments already on them (today: the legacy importer) open with these instead of the demo seed. */ seed?: Adjustment[] }): AdjustmentsAPI {
  /* Mock seed shows what a populated quote looks like in the demo.
     Newly-created quotes pass `skipSeed: true` so they open with zero
     adjustments and the user has to add them via the empty state. */
  const [adjustments, setAdjustments] = useState<Adjustment[]>(() =>
    options?.seed ?? (options?.skipSeed ? [] : seedInitial(lines, options?.restateSeed)),
  );

  const lineBreakdowns = useMemo(() => {
    const map = new Map<string, AdjustmentsLineBreakdown>();
    for (const line of lines) {
      const baseSubtotal = line.quantity * line.unitPrice;
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
    const baseSubtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
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
