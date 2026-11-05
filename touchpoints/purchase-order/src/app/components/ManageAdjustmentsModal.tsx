import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Pencil, DollarSign, Package, TrendingUp, TrendingDown, CircleSlash, CirclePlus, Info, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdjustmentFormModal } from './AdjustmentFormModal';
import type { AdjustmentFormData, LineItemForSelection } from './AdjustmentFormModal';
import { ConfirmationModal } from './ConfirmationModal';
import { EmptyPlaceholder } from './EmptyPlaceholder';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { POLineItem } from './poStore';
import type { AdjustmentsAPI } from './usePOAdjustments';
import { lineBaseValue, adjustmentDisplayLabel } from './poOrderPricing';
import { useDocCurrency, useDocMoney } from './currency/docCurrencyContext';
import { roundTo } from '@/app/currency/poFx';

/* Ported verbatim from Sales-Order-V5 `so/ManageAdjustmentsModal.tsx`.
   PO adaptations: reads PO lines (`POLineItem`) instead of `SOLine`,
   uses the PO-backed `usePOAdjustments` API, "SO" → "PO" in copy,
   item cards show the part number instead of the internal line id,
   item-level `$` impact comes from the API's pro-rata split, and
   empty labels fall back to "One-time discount/premium". */

/* Stable thumb tint per itemCode so the same item gets the same color
   across the SO every time. */
const THUMB_PALETTE = ['#DBEAFE', '#D1FAE5', '#FEE2E2', '#E0E7FF', '#FEF3C7', '#FCE7F3', '#F3E8FF', '#FED7AA', '#CCFBF1'];
function thumbColorForCode(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return THUMB_PALETTE[h % THUMB_PALETTE.length];
}

/* Serialization mirrors the rest of the PO app (id-hash rule). */
function isSerializedLine(l: POLineItem): boolean {
  return l.itemNumber.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 3 === 0;
}

export function buildLineItemsForSelection(lines: POLineItem[]): LineItemForSelection[] {
  return lines
    .filter((l) => !l.cancelled)
    .map((l) => ({
      id: l.id,
      code: l.itemNumber,
      description: l.descriptiveName,
      subtotal: lineBaseValue(l),
      qty: l.quantity,
      type: isSerializedLine(l) ? 'Serialized' : 'Non-Serialized',
      thumbColor: thumbColorForCode(l.itemNumber),
      imageUrl: l.image,
    }));
}

type Adjustment = AdjustmentsAPI['adjustments'][number];

/* Every amount here — fixed adjustments, their impact, the totals — is in
   the PO's currency (useDocMoney). */

// The AdjustmentFormModal is now shared from /src/app/components/shared/AdjustmentFormModal.tsx

// ═══════════════════════════════════════════════════════════════════════════════
// Main ManageAdjustmentsModal
// ═══════════════════════════════════════════════════════════════════════════════
interface ManageAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: 'quote' | 'item';
  /* Fires for any add / edit / unapply / reapply adjustment action — the
     parent decides whether to prompt for a new version based on SO stage. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** IDs of shipped (or partially shipped) line items. Item-scope
   *  adjustments touching these lines lock individually; order-level
   *  adjustments remain editable until full Shipped (handled by global
   *  readOnly). */
  shippedLineIds?: string[];
  /** PO lines — drive the item-scope picker, the per-line adjustment
   *  list, and totals. */
  lines: POLineItem[];
  /** Shared adjustments API from SODetail. When provided, the modal is
   *  fully controlled: it reads adjustments from this API and routes
   *  every mutation through it, so changes here show up in the line
   *  item configurator and any other consumer of the same instance. */
  adjustmentsAPI: AdjustmentsAPI;
}

export function ManageAdjustmentsModal({
  isOpen,
  onClose,
  readOnly = false,
  initialTab = 'quote',
  onMaterialEvent,
  shippedLineIds,
  lines,
  adjustmentsAPI,
}: ManageAdjustmentsModalProps) {
  /* Display-shaped lines drive the item picker, per-line listing, and
     totals. Single source of truth replacing the old mock LINE_ITEMS. */
  const lineItems = useMemo(() => buildLineItemsForSelection(lines), [lines]);

  /* Controlled mode: derive `adjustments` from the shared API on every
     render so summary↔configurator stay in lockstep. */
  const adjustments = adjustmentsAPI.adjustments as Adjustment[];
  const [activeSection, setActiveSection] = useState<'quote' | 'item'>(initialTab);
  /* Full-view toggle — mirrors RecipientsSelectionModal so every large
     modal in the suite carries the same expansion control. */
  const [fullView, setFullView] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'quote' | 'item' | null>(null);
  const [editingAdj, setEditingAdj] = useState<Adjustment | null>(null);
  // Per-row unapply confirmation. Reuses the shared ConfirmationModal.
  const [unapplyConfirm, setUnapplyConfirm] = useState<{ id: string; label: string } | null>(null);
  const { currency } = useDocCurrency();
  const money = useDocMoney();

  if (!isOpen) return null;

  const quoteLevelAdj = adjustments.filter(a => a.scope === 'quote');
  const itemLevelAdj = adjustments.filter(a => a.scope === 'item');

  // PO subtotal — sum across all line items. Used as the 100% cap base.
  const soSubtotal = lineItems.reduce((s, i) => s + i.subtotal, 0);

  // Helper: amount of an adjustment relative to the PO subtotal, to the
  // currency's minor units.
  const adjustmentDollarAmount = (a: Adjustment): number =>
    a.amountType === '%' ? roundTo(currency, soSubtotal * a.amount / 100) : a.amount;

  /* Totals come straight from the shared API, which evaluates each
     adjustment's $ impact (handles `%` against the right base) and only
     counts isApplied entries. The modal just renders the precomputed
     numbers — no double-counting risk. */
  const totalQuoteAdj = adjustmentsAPI.quoteTotals.net;
  const totalItemAdj = adjustmentsAPI.itemTotals.net;
  const totalAll = adjustmentsAPI.grandTotal.net;

  // Discount cap: one-time discounts can't exceed 100% of the PO subtotal.
  const totalActiveDiscountAmount = adjustments
    .filter(a => a.isApplied && a.type === 'discount')
    .reduce((s, a) => s + adjustmentDollarAmount(a), 0);
  const discountCapHit = soSubtotal > 0 && totalActiveDiscountAmount >= soSubtotal;
  const wouldExceedSoCap = (incrementalDiscount: number) =>
    soSubtotal > 0 && (totalActiveDiscountAmount + incrementalDiscount) > soSubtotal;

  // Group item-level by item
  const adjByItem = (() => {
    const map = new Map<string, { item: LineItemForSelection; adjustments: Adjustment[] }>();
    for (const adj of itemLevelAdj) {
      if (!adj.appliedTo) continue;
      for (const itemId of adj.appliedTo) {
        const item = lineItems.find(i => i.id === itemId);
        if (!item) continue;
        if (!map.has(itemId)) map.set(itemId, { item, adjustments: [] });
        map.get(itemId)!.adjustments.push(adj);
      }
    }
    return Array.from(map.values());
  })();

  // Unapply (don't delete) — keeps entry in list, grayed out.
  const handleUnapply = (id: string) => {
    const adj = adjustments.find(a => a.id === id);
    if (!adj) return;
    adjustmentsAPI.unapplyAdjustment(id, 'USER_UNAPPLIED');
    onMaterialEvent?.(
      `Unapplied ${adj.type === 'premium' ? 'premium' : 'discount'} "${adjustmentDisplayLabel(adj)}"`,
      () => adjustmentsAPI.reapplyAdjustment(id),
    );
  };

  // Re-apply — clears reason and flips isApplied=true, subject to SO discount cap.
  const handleReapply = (id: string) => {
    const target = adjustments.find(a => a.id === id);
    if (!target) return;
    const incremental = target.type === 'discount' ? adjustmentDollarAmount(target) : 0;
    if (wouldExceedSoCap(incremental)) {
      toast.warning('Cannot re-apply — would exceed 100% of PO subtotal.');
      adjustmentsAPI.unapplyAdjustment(id, 'EXCEEDS_100_PERCENT');
      return;
    }
    adjustmentsAPI.reapplyAdjustment(id);
    onMaterialEvent?.(
      `Reapplied ${target.type === 'premium' ? 'premium' : 'discount'} "${adjustmentDisplayLabel(target)}"`,
      () => adjustmentsAPI.unapplyAdjustment(id, 'USER_UNAPPLIED'),
    );
  };

  const handleAddSave = (data: AdjustmentFormData) => {
    /* Cap check on add: a new discount that would push the SO past 100%
       of subtotal gets the EXCEEDS_100_PERCENT reason and lands unapplied. */
    const incremental = data.type === 'discount'
      ? (data.amountType === '%' ? roundTo(currency, soSubtotal * data.amount / 100) : data.amount)
      : 0;
    const exceeds = wouldExceedSoCap(incremental);
    if (exceeds) toast.warning('Adjustment kept but unapplied — would exceed 100% of PO subtotal.');
    const created = adjustmentsAPI.addAdjustment({
      label: data.label,
      type: data.type,
      amountType: data.amountType,
      amount: data.amount,
      scope: data.scope ?? 'item',
      appliedTo: data.appliedTo,
      internalNotes: (data as any).internalNotes,
    });
    if (exceeds) adjustmentsAPI.unapplyAdjustment(created.id, 'EXCEEDS_100_PERCENT');
    setShowAddModal(null);
    toast.success(`"${adjustmentDisplayLabel(created)}" added`);
    /* Revert path — if the user discards the version prompt for a
       post-draft SO, remove the just-added adjustment so the
       sidebar count and the manage modal don't carry a phantom
       entry. */
    onMaterialEvent?.(
      `Added ${created.type === 'premium' ? 'premium' : 'discount'} "${adjustmentDisplayLabel(created)}"`,
      () => adjustmentsAPI.removeAdjustment(created.id),
    );
  };

  const handleEditSave = (data: AdjustmentFormData) => {
    if (!data.id) return;
    const before = adjustments.find(a => a.id === data.id);
    adjustmentsAPI.updateAdjustment(data.id, {
      label: data.label,
      type: data.type,
      amountType: data.amountType,
      amount: data.amount,
      scope: data.scope ?? 'item',
      appliedTo: data.appliedTo,
      internalNotes: (data as any).internalNotes,
    });
    setEditingAdj(null);
    toast.success(`"${adjustmentDisplayLabel(data)}" updated`);
    onMaterialEvent?.(
      `Updated ${data.type === 'premium' ? 'premium' : 'discount'} "${adjustmentDisplayLabel(data)}"`,
      before
        ? () => {
            adjustmentsAPI.updateAdjustment(before.id, {
              label: before.label,
              type: before.type,
              amountType: before.amountType,
              amount: before.amount,
              scope: before.scope,
              appliedTo: before.appliedTo,
              internalNotes: (before as any).internalNotes,
            });
          }
        : undefined,
    );
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="One-Time Discounts and Premiums"
        className={`relative bg-white flex flex-col overflow-hidden border border-border ${fullView ? 'w-screen h-screen max-h-screen' : 'w-[calc(100%-2rem)] sm:w-[640px] max-h-[88vh]'}`}
        style={{
          borderRadius: fullView ? 0 : 16,
          boxShadow: fullView ? 'none' : '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          fontFamily: 'Inter, system-ui, sans-serif',
          /* Smoothly animate the Full view transition. */
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), height 220ms cubic-bezier(0.4, 0, 0.2, 1), max-height 220ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 220ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (Partner-faithful) ───────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 border-b border-border shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
            >
              <DollarSign className="w-4 h-4" style={{ color: '#1B6EF3' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[14px] text-foreground truncate" style={{ fontWeight: 600 }}>
                  One-Time Discounts/Premiums
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                  style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                >
                  {adjustments.length}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {quoteLevelAdj.length} order-level · {itemLevelAdj.length} item-level
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Full view toggle — mirrors RecipientsSelectionModal so
                every large modal exposes the same expansion control. */}
            <button
              onClick={() => setFullView((v) => !v)}
              aria-label={fullView ? 'Exit full view' : 'Enter full view'}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullView ? 'Exit full' : 'Full view'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs (Partner-faithful) ─────────────────────────────────── */}
        <div className="flex items-center border-b border-border shrink-0 px-1 bg-white">
          {([
            { key: 'quote' as const, label: 'Order-Level', count: quoteLevelAdj.length },
            { key: 'item' as const, label: 'Item-Level', count: itemLevelAdj.length },
          ]).map(tab => {
            const isActive = activeSection === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                style={{ fontWeight: isActive ? 600 : 500 }}
              >
                {tab.label}
                <span
                  className="inline-flex items-center justify-center text-[10px] px-1.5 rounded-full"
                  style={{
                    minWidth: 18, height: 16, fontWeight: 600,
                    backgroundColor: isActive ? '#EFF6FF' : '#F1F5F9',
                    color: isActive ? '#1B6EF3' : '#64748B',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content — slate-50 wrapper */}
        <div className="flex-1 overflow-y-auto bg-slate-50" style={{ padding: '16px 20px', scrollbarWidth: 'thin' }}>

          {/* ── Quote-Level ── */}
          {activeSection === 'quote' && (
            <div>
              {/* Section heading — Partner step pattern. */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  Order-level
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px]"
                  style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                >
                  {quoteLevelAdj.length}
                </span>
                {/* (i) tooltip — explains the concept of an order-level
                    one-time. The inline callout below still shows the
                    short copy; this surfaces the fuller, polished
                    explanation on hover for users learning the model. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About order-level one-time discounts and premiums"
                      className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                    One-time order-level discounts and premiums apply to the entire purchase order total. Use them for adjustments that span the whole order, like a customer loyalty credit, an expedited handling fee, or a flat negotiated rebate, rather than anything tied to a single line item.
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Descriptor — Partner info-callout. */}
              <div className="flex items-start gap-2 mb-3 rounded-lg border border-[#DBEAFE] bg-[#F0F7FF] px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-[1px]" />
                <p className="text-[12px] leading-relaxed text-slate-600" style={{ margin: 0 }}>
                  Applied to the entire order total. Use for overall discounts or fees.
                </p>
              </div>
              
              {quoteLevelAdj.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-8 mb-2">
                  <EmptyPlaceholder
                    icon={DollarSign}
                    title="No order-level adjustments yet"
                    description="Add a one-time discount or premium that applies to this entire order."
                    actionLabel={!readOnly ? 'Add Order-Level Adjustment' : undefined}
                    onAction={!readOnly ? () => setShowAddModal('quote') : undefined}
                    compact
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {quoteLevelAdj.map((adj) => (
                    <AdjustmentRow
                      key={adj.id}
                      adjustment={adj}
                      onEdit={() => setEditingAdj(adj)}
                      onUnapply={() => setUnapplyConfirm({ id: adj.id, label: adjustmentDisplayLabel(adj) })}
                      onReapply={() => handleReapply(adj.id)}
                      readOnly={readOnly}
                      dollarImpact={adjustmentDollarAmount(adj)}
                    />
                  ))}
                </div>
              )}

              {/* Dashed add button — suppressed in the empty state
                  because the EmptyPlaceholder already exposes the
                  primary action; a second add button just doubles up
                  the affordance. */}
              {!readOnly && quoteLevelAdj.length > 0 && (
                <button
                  onClick={() => setShowAddModal('quote')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px 0', marginTop: '8px',
                    borderRadius: '6px', cursor: 'pointer',
                    borderWidth: '1.5px', borderStyle: 'dashed', borderColor: '#BFDBFE',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px', fontWeight: 500, color: '#1B6EF3',
                    lineHeight: '1', transition: 'all 150ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                  title={discountCapHit ? 'Discount cap reached — only premium adjustments will apply.' : undefined}
                >
                  <Plus style={{ width: '13px', height: '13px' }} />
                  Add Order-Level Adjustment
                  {discountCapHit && <span style={{ fontSize: '10px', color: '#B45309', marginLeft: '4px' }}>(discount cap reached)</span>}
                </button>
              )}
            </div>
          )}

          {/* ── Item-Level ── */}
          {activeSection === 'item' && (
            <div>
              {/* Section heading — Partner step pattern. */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Package className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  Item-level
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px]"
                  style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                >
                  {itemLevelAdj.length}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About item-level one-time discounts and premiums"
                      className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                    One-time item-level discounts and premiums apply to this line item only. Use them for per-line adjustments.
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Descriptor — Partner info-callout. */}
              <div className="flex items-start gap-2 mb-3 rounded-lg border border-[#DBEAFE] bg-[#F0F7FF] px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-[1px]" />
                <p className="text-[12px] leading-relaxed text-slate-600" style={{ margin: 0 }}>
                  Applied to specific line items. Use for delivery fees, setup charges, or item-specific discounts.
                </p>
              </div>
              
              {adjByItem.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-8 mb-2">
                  <EmptyPlaceholder
                    icon={Package}
                    title="No item-level adjustments yet"
                    description="Add a one-time discount or premium that applies to a specific line item."
                    actionLabel={!readOnly ? 'Add Item-Level Adjustment' : undefined}
                    onAction={!readOnly ? () => setShowAddModal('item') : undefined}
                    compact
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {adjByItem.map(({ item, adjustments: itemAdjs }) => (
                    <div key={item.id} className="overflow-hidden bg-white border border-border" style={{ borderRadius: 10 }}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-slate-50">
                        <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center" style={{ backgroundColor: item.thumbColor || '#F1F5F9' }}>
                          <Package className="w-3 h-3 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] text-slate-500 tabular-nums leading-tight" style={{ fontWeight: 600 }}>{item.code ?? item.id}</div>
                          <div className="text-[12px] text-foreground truncate leading-snug">{item.description}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 p-2">
                        {itemAdjs.map((adj) => {
                          /* Item-scope adjustments lock individually when
                             their line ships — Partially Shipped freezes
                             pricing for that line. Order-level adjustments
                             follow the global readOnly (Shipped). */
                          const lineShipped = (shippedLineIds ?? []).includes(item.id);
                          return (
                          <AdjustmentRow
                            key={`${item.id}-${adj.id}`}
                            adjustment={adj}
                            onEdit={() => setEditingAdj(adj)}
                            onUnapply={() => setUnapplyConfirm({ id: adj.id, label: adjustmentDisplayLabel(adj) })}
                            onReapply={() => handleReapply(adj.id)}
                            readOnly={readOnly || lineShipped}
                            shipmentLocked={lineShipped}
                            compact
                            dollarImpact={
                              adjustmentsAPI.lineBreakdowns.get(item.id)?.impacts.find((x) => x.adjustmentId === adj.id)?.dollars
                              ?? (adj.amountType === '%' ? ((item.subtotal ?? 0) * adj.amount) / 100 : adj.amount)
                            }
                          />);
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dashed add button — suppressed in the empty state
                  to match the order-level treatment. */}
              {!readOnly && adjByItem.length > 0 && (
                <button
                  onClick={() => setShowAddModal('item')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px 0', marginTop: '4px',
                    borderRadius: '6px', cursor: 'pointer',
                    borderWidth: '1.5px', borderStyle: 'dashed', borderColor: '#BFDBFE',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px', fontWeight: 500, color: '#1B6EF3',
                    lineHeight: '1', transition: 'all 150ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                  title={discountCapHit ? 'Discount cap reached — only premium adjustments will apply.' : undefined}
                >
                  <Plus style={{ width: '13px', height: '13px' }} />
                  Add Item-Level Adjustment
                  {discountCapHit && <span style={{ fontSize: '10px', color: '#B45309', marginLeft: '4px' }}>(discount cap reached)</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — bg-white border-t, Partner footer grammar */}
        <div className="px-5 py-3 border-t border-border bg-white shrink-0">
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="text-[11px] text-slate-500">Order-level</span>
            <span className="text-[12px] tabular-nums" style={{ fontWeight: 500, color: totalQuoteAdj > 0 ? '#6D28D9' : totalQuoteAdj < 0 ? '#047857' : '#64748B' }}>
              {totalQuoteAdj >= 0 ? '+' : ''}{money(totalQuoteAdj)}
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="text-[11px] text-slate-500">Item-level</span>
            <span className="text-[12px] tabular-nums" style={{ fontWeight: 500, color: totalItemAdj > 0 ? '#6D28D9' : totalItemAdj < 0 ? '#047857' : '#64748B' }}>
              {totalItemAdj >= 0 ? '+' : ''}{money(totalItemAdj)}
            </span>
          </div>
          <div style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Net Adjustment</span>
            <span className="text-[15px] tabular-nums" style={{ fontWeight: 700, color: totalAll > 0 ? '#6D28D9' : totalAll < 0 ? '#047857' : '#0F172A' }}>
              {totalAll >= 0 ? '+' : ''}{money(totalAll)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Add sub-modal ── */}
      {showAddModal && (
        <AdjustmentFormModal
          mode="add"
          scope={showAddModal}
          recordLabel="order"
          lineItems={showAddModal === 'item' ? lineItems : undefined}
          onSave={handleAddSave}
          onCancel={() => setShowAddModal(null)}
        />
      )}

      {/* ── Edit sub-modal ── */}
      {editingAdj && (
        <AdjustmentFormModal
          mode="edit"
          scope={editingAdj.scope}
          recordLabel="order"
          initial={editingAdj}
          lineItems={editingAdj.scope === 'item' ? lineItems : undefined}
          onSave={handleEditSave}
          onCancel={() => setEditingAdj(null)}
        />
      )}

      {/* ── Per-row Unapply Confirmation ── */}
      <ConfirmationModal
        isOpen={!!unapplyConfirm}
        title="Unapply this adjustment?"
        message={
          unapplyConfirm
            ? `"${unapplyConfirm.label}" will be unapplied — it stays in the list (grayed out) so you can re-apply it later. It won't affect the PO subtotal while unapplied.`
            : ''
        }
        confirmText="Unapply"
        cancelText="Keep Applied"
        variant="yellow"
        icon={<CircleSlash className="w-6 h-6 text-white" />}
        onConfirm={() => {
          if (unapplyConfirm) handleUnapply(unapplyConfirm.id);
          setUnapplyConfirm(null);
        }}
        onCancel={() => setUnapplyConfirm(null)}
      />
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Adjustment Row (display-only, with hover actions)
// ═══════════════════════════════════════════════════════════════════════════════
function AdjustmentRow({
  adjustment, onEdit, onUnapply, onReapply, readOnly, compact, shipmentLocked = false, dollarImpact,
}: {
  adjustment: Adjustment;
  onEdit: () => void;
  onUnapply: () => void;
  onReapply: () => void;
  readOnly: boolean;
  compact?: boolean;
  /** True when the row is locked specifically because its line has
   *  shipped. Distinct from the global readOnly so the row can show a
   *  "Shipped — Locked" pill instead of just hiding action icons. */
  shipmentLocked?: boolean;
  /** Dollar value the adjustment actually contributes, computed against
   *  the relevant base (SO subtotal for quote-scope, line subtotal for
   *  item-scope). Required so `%` adjustments render their real impact
   *  instead of misleading the user with the raw percent number. */
  dollarImpact?: number;
}) {
  const money = useDocMoney();
  const isPremium = adjustment.type === 'premium';
  const isUnapplied = !adjustment.isApplied;
  const isPct = adjustment.amountType === '%';
  const sign = isPremium ? '+' : '−';
  const fmtPct = (n: number) => `${Math.round(n * 100) / 100}%`;
  const computedDollars = typeof dollarImpact === 'number' ? dollarImpact : adjustment.amount;
  /* Partner pricing-rule semantic colors: emerald for Discount,
     violet/purple for Premium. Used in category pills only — action
     buttons use system blue. */
  const pill = isPremium
    ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE', icon: TrendingUp }
    : { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5', icon: TrendingDown };
  const PillIcon = pill.icon;
  const valueColor = isUnapplied ? '#9CA3AF' : (isPremium ? '#6D28D9' : '#047857');

  return (
    <div
      className={`group flex items-center justify-between gap-3 bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] hover:bg-slate-50 transition-colors ${compact ? 'px-3 py-2.5' : 'px-3 py-2.5'}`}
      style={{ borderRadius: 10, opacity: isUnapplied ? 0.65 : 1 }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span
          className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10.5px] border shrink-0"
          style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}
        >
          <PillIcon className="w-3 h-3" />
          {isPremium ? 'Premium' : 'Discount'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>
              {adjustmentDisplayLabel(adjustment)}
            </span>
            {isUnapplied && (
              <span
                className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px] shrink-0"
                style={{ fontWeight: 600, color: '#92400E', backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
              >
                Unapplied
              </span>
            )}
          </div>
          {isUnapplied && adjustment.unappliedReason === 'EXCEEDS_100_PERCENT' && (
            <div className="text-[10.5px] text-amber-700 mt-0.5" style={{ fontWeight: 500 }}>
              Exceeds 100% of PO subtotal — unapplied automatically
            </div>
          )}
          {isUnapplied && adjustment.unappliedReason === 'USER_UNAPPLIED' && (
            <div className="text-[10.5px] text-slate-500 mt-0.5">
              Manually unapplied — click the re-apply icon to restore
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {shipmentLocked && (
          <span
            className="inline-flex items-center px-2 py-[2px] rounded-full text-[10.5px] border"
            style={{ fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }}
            title="This line has already shipped — adjustments on it are locked."
          >
            Shipped — Locked
          </span>
        )}
        <span className="flex flex-col items-end tabular-nums" style={{ lineHeight: 1.15, textDecoration: isUnapplied ? 'line-through' : undefined }}>
          <span className="text-[13px]" style={{ fontWeight: 600, color: valueColor }}>
            {isPct ? `${sign}${fmtPct(adjustment.amount)}` : `${sign}${money(adjustment.amount)}`}
          </span>
          {isPct && (
            <span className="text-[11px]" style={{ fontWeight: 500, color: isUnapplied ? '#9CA3AF' : '#6B7280' }}>
              {sign}{money(computedDollars)}
            </span>
          )}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            {!isUnapplied && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label="Edit adjustment"
                title="Edit"
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {isUnapplied ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReapply(); }}
                aria-label="Re-apply adjustment"
                title="Re-apply"
                className="w-7 h-7 rounded-md flex items-center justify-center text-primary hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <CirclePlus className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUnapply(); }}
                aria-label="Unapply adjustment"
                title="Unapply"
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
              >
                <CircleSlash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Add Order-Level Adjustment Modal
// (opened directly from sidebar "+ Add order-level discount/premium" shortcut)
// ═══════════════════════════════════════════════════════════════════════════════
export function AddOrderLevelAdjustmentModal({
  isOpen,
  onClose,
  adjustmentsAPI,
  onMaterialEvent,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Shared adjustments API so the new adjustment lands in the same
   *  store the sidebar count + Manage modal read from. Without this
   *  the shortcut fires a success toast and discards the payload —
   *  the sidebar stays on "+ Add order-level..." forever. */
  adjustmentsAPI?: AdjustmentsAPI;
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
}) {
  if (!isOpen) return null;

  return (
    <AdjustmentFormModal
      mode="add"
      scope="quote"
      recordLabel="order"
      onSave={(data) => {
        if (adjustmentsAPI) {
          const created = adjustmentsAPI.addAdjustment({
            label: data.label,
            type: data.type,
            amountType: data.amountType,
            amount: data.amount,
            scope: 'quote',
            internalNotes: (data as any).internalNotes,
          });
          toast.success(`"${adjustmentDisplayLabel(created)}" added as order-level adjustment`);
          /* Revert path — if the user discards the version prompt,
             remove the adjustment we just inserted. */
          onMaterialEvent?.(
            `Added ${created.type === 'premium' ? 'premium' : 'discount'} "${adjustmentDisplayLabel(created)}"`,
            () => adjustmentsAPI.removeAdjustment(created.id),
          );
        } else {
          toast.success(`"${data.label}" added as order-level adjustment`);
        }
        onClose();
      }}
      onCancel={onClose}
    />
  );
}