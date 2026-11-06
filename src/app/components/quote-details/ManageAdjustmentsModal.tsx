import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, Pencil, DollarSign, Package, TrendingUp, TrendingDown, Info, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdjustmentFormModal } from '../shared/AdjustmentFormModal';
import type { AdjustmentFormData, LineItemForSelection } from '../shared/AdjustmentFormModal';
import { EmptyPlaceholder } from '../shared/EmptyPlaceholder';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface QuoteLineInput {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isSerialized?: boolean;
  isLotControlled?: boolean;
}

const THUMB_PALETTE = ['#DBEAFE', '#D1FAE5', '#FEE2E2', '#E0E7FF', '#FEF3C7', '#FCE7F3', '#F3E8FF', '#FED7AA', '#CCFBF1'];
function thumbColorForCode(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return THUMB_PALETTE[h % THUMB_PALETTE.length];
}

function buildLineItemsForSelection(lines: QuoteLineInput[]): LineItemForSelection[] {
  return lines.map((l) => ({
    id: l.id,
    code: l.productId,
    description: l.productName,
    subtotal: l.quantity * l.unitPrice,
    qty: l.quantity,
    /* Cover all four type combinations — the prior branch collapsed
       Lot Serialized into Lot Non-Serialized, so any line with both
       flags set rendered the wrong tag in the adjustment picker. */
    type: l.isLotControlled
      ? (l.isSerialized ? 'Lot Serialized' : 'Lot Non-Serialized')
      : l.isSerialized ? 'Serialized' : 'Non-Serialized',
    thumbColor: thumbColorForCode(l.productId),
  }));
}

interface Adjustment {
  id: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  scope: 'item' | 'quote';
  appliedTo?: string[];
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// The AdjustmentFormModal is now shared from /src/app/components/shared/AdjustmentFormModal.tsx

// ═══════════════════════════════════════════════════════════════════════════════
// Main ManageAdjustmentsModal
// ═══════════════════════════════════════════════════════════════════════════════
interface ManageAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: 'quote' | 'item';
  /* Fires for any add / edit / delete adjustment action — the parent
     decides whether to prompt for a new version based on quote stage.
     The optional `onRevert` callback lets the parent undo the
     mutation when the user discards the version prompt — the
     adjustment has already landed in the shared API at this point,
     so the only way to honour a rejection is to roll it back. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Real quote lines — drives the item picker and per-line listing. */
  lines: QuoteLineInput[];
  /** Shared adjustments API from QuoteDetails. The modal is fully
   *  controlled — adjustments + totals come from this API, mutations
   *  route through it so the configurator stays in lockstep. */
  adjustmentsAPI: import('./useAdjustments').AdjustmentsAPI;
  /** Parent record id — enables the link-picker affordance on the
   *  internal-notes field inside AdjustmentFormModal. Optional so
   *  older call sites stay unbroken. */
  docId?: string;
  /** Current user, used to attribute inline-added links. */
  currentUser?: string;
}

export function ManageAdjustmentsModal({
  isOpen,
  onClose,
  readOnly = false,
  initialTab = 'quote',
  onMaterialEvent,
  lines,
  adjustmentsAPI,
  docId,
  currentUser,
}: ManageAdjustmentsModalProps) {
  const lineItems = useMemo(() => buildLineItemsForSelection(lines), [lines]);

  /* Controlled mode: read adjustments straight from the shared API on
     every render. Both the summary and configurator subscribe to it. */
  const adjustments = adjustmentsAPI.adjustments as Adjustment[];
  const [activeSection, setActiveSection] = useState<'quote' | 'item'>(initialTab);
  /* Full-view toggle — mirrors RecipientsSelectionModal so every large
     modal in the suite carries the same expansion control. */
  const [fullView, setFullView] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'quote' | 'item' | null>(null);
  const [editingAdj, setEditingAdj] = useState<Adjustment | null>(null);

  if (!isOpen) return null;

  const quoteLevelAdj = adjustments.filter(a => a.scope === 'quote');
  const itemLevelAdj = adjustments.filter(a => a.scope === 'item');

  /* Totals come from the API — handles `%` vs `$` and respects isApplied. */
  const totalQuoteAdj = adjustmentsAPI.quoteTotals.net;
  const totalItemAdj = adjustmentsAPI.itemTotals.net;
  const totalAll = adjustmentsAPI.grandTotal.net;

  // Base subtotals used to resolve a `%` adjustment into a dollar value
  // for display purposes. Quote-scope uses the whole-quote subtotal;
  // item-scope uses the per-line subtotal so the row beneath each line
  // shows its real contribution rather than a misleading raw number.
  const quoteBaseSubtotal = lineItems.reduce((s, l) => s + l.subtotal, 0);
  const dollarFor = (adj: Adjustment, lineId?: string): number => {
    if (adj.amountType !== '%') return adj.amount;
    const base = adj.scope === 'quote'
      ? quoteBaseSubtotal
      : (lineId ? (lineItems.find(l => l.id === lineId)?.subtotal ?? 0) : quoteBaseSubtotal);
    return (base * adj.amount) / 100;
  };

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

  const handleDelete = (id: string) => {
    const adj = adjustments.find(a => a.id === id);
    if (!adj) return;
    adjustmentsAPI.removeAdjustment(id);
    toast.success(`"${adj.label}" removed`);
    /* Revert path for a discarded version prompt — re-insert the
       removed adjustment. The shared API keys off `id`, so adding
       with the same id restores it. */
    onMaterialEvent?.(
      `Removed ${adj.type === 'premium' ? 'premium' : 'discount'} "${adj.label}"`,
      () => {
        adjustmentsAPI.addAdjustment({
          id: adj.id,
          label: adj.label,
          type: adj.type,
          amountType: adj.amountType,
          amount: adj.amount,
          scope: adj.scope,
          appliedTo: adj.appliedTo,
          internalNotes: (adj as any).internalNotes,
          attachments: (adj as any).attachments,
        });
      },
    );
  };

  const handleAddSave = (data: AdjustmentFormData) => {
    const created = adjustmentsAPI.addAdjustment({
      label: data.label,
      type: data.type,
      amountType: data.amountType,
      amount: data.amount,
      scope: data.scope ?? 'item',
      appliedTo: data.appliedTo,
      internalNotes: (data as any).internalNotes,
      attachments: (data as any).attachments,
    });
    setShowAddModal(null);
    toast.success(`"${created.label}" added`);
    /* Revert path — remove the just-added adjustment if the user
       discards the version prompt. Without this, rejecting a
       version on a Confirmed-by-Customer quote left the new
       discount sitting in the list anyway. */
    onMaterialEvent?.(
      `Added ${created.type === 'premium' ? 'premium' : 'discount'} "${created.label}"`,
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
      attachments: (data as any).attachments,
    });
    setEditingAdj(null);
    toast.success(`"${data.label}" updated`);
    /* Revert path — restore the pre-edit snapshot if the user
       discards the version prompt. */
    onMaterialEvent?.(
      `Updated ${data.type === 'premium' ? 'premium' : 'discount'} "${data.label}"`,
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
              attachments: (before as any).attachments,
            });
          }
        : undefined,
    );
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
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
          /* Smoothly animate the Full view transition so the modal
             expands/contracts as one motion. */
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
                {quoteLevelAdj.length} quote-level · {itemLevelAdj.length} item-level
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

        {/* ── Tabs (Partner-faithful: px-4 py-3 border-b-2) ───────────── */}
        <div className="flex items-center border-b border-border shrink-0 px-1 bg-white">
          {([
            { key: 'quote' as const, label: 'Quote-Level', count: quoteLevelAdj.length },
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

        {/* Content — slate-50 wrapper for Partner-faithful body */}
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
                  Quote-level
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px]"
                  style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                >
                  {quoteLevelAdj.length}
                </span>
                {/* (i) tooltip — explains the concept of a quote-level
                    one-time. The inline callout below still shows the
                    short copy; this surfaces the fuller, polished
                    explanation on hover for users learning the model. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About quote-level one-time discounts and premiums"
                      className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                    One-time quote-level discounts and premiums apply to the entire quote total. Use them for adjustments that span the whole proposal, like a customer loyalty credit, an expedited handling fee, or a flat negotiated rebate, rather than anything tied to a single line item.
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Descriptor — Partner info-callout: subtle blue tint with
                  Info icon, much more readable than a bland gray stroke. */}
              <div className="flex items-start gap-2 mb-3 rounded-lg border border-[#DBEAFE] bg-[#F0F7FF] px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-[1px]" />
                <p className="text-[12px] leading-relaxed text-slate-600" style={{ margin: 0 }}>
                  Applied to the entire quote total. Use for overall discounts or fees.
                </p>
              </div>
              
              {quoteLevelAdj.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-8 mb-2">
                  <EmptyPlaceholder
                    icon={DollarSign}
                    title="No quote-level adjustments yet"
                    description="Add a one-time discount or premium that applies to this entire quote."
                    actionLabel={!readOnly ? 'Add Quote-Level Adjustment' : undefined}
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
                      onDelete={() => handleDelete(adj.id)}
                      readOnly={readOnly}
                      dollarImpact={dollarFor(adj)}
                    />
                  ))}
                </div>
              )}

              {/* Dashed add button — suppressed in the empty state
                  because the EmptyPlaceholder already exposes a
                  primary "Add Quote-Level Adjustment" action and a
                  second button just doubles up the affordance. */}
              {!readOnly && quoteLevelAdj.length > 0 && (
                <button
                  onClick={() => setShowAddModal('quote')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px 0', marginTop: '8px',
                    borderRadius: '6px', cursor: 'pointer',
                    borderWidth: '1.5px', borderStyle: 'dashed', borderColor: 'var(--accent)',
                    backgroundColor: 'var(--background)',
                    fontSize: '12px', fontWeight: 500, color: 'var(--primary)',
                    lineHeight: '1', transition: 'all 150ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                >
                  <Plus style={{ width: '13px', height: '13px' }} />
                  Add Quote-Level Adjustment
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
                      {/* Item header — Partner thumbnail + code + description */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-slate-50">
                        <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center" style={{ backgroundColor: item.thumbColor || '#F1F5F9' }}>
                          <Package className="w-3 h-3 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] text-slate-500 tabular-nums leading-tight" style={{ fontWeight: 600 }}>#{item.id}</div>
                          <div className="text-[12px] text-foreground truncate leading-snug">{item.description}</div>
                        </div>
                      </div>
                      {/* Adjustments for this item */}
                      <div className="flex flex-col gap-2 p-2">
                        {itemAdjs.map((adj) => (
                          <AdjustmentRow
                            key={`${item.id}-${adj.id}`}
                            adjustment={adj}
                            onEdit={() => setEditingAdj(adj)}
                            onDelete={() => handleDelete(adj.id)}
                            readOnly={readOnly}
                            compact
                            dollarImpact={dollarFor(adj, item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dashed add button — suppressed in the empty state
                  to match the quote-level treatment; EmptyPlaceholder
                  already offers the primary action. */}
              {!readOnly && adjByItem.length > 0 && (
                <button
                  onClick={() => setShowAddModal('item')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px 0', marginTop: '4px',
                    borderRadius: '6px', cursor: 'pointer',
                    borderWidth: '1.5px', borderStyle: 'dashed', borderColor: 'var(--accent)',
                    backgroundColor: 'var(--background)',
                    fontSize: '12px', fontWeight: 500, color: 'var(--primary)',
                    lineHeight: '1', transition: 'all 150ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                >
                  <Plus style={{ width: '13px', height: '13px' }} />
                  Add Item-Level Adjustment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — bg-white border-t, Partner footer grammar */}
        <div className="px-5 py-3 border-t border-border bg-white shrink-0">
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="text-[11px] text-slate-500">Quote-level</span>
            <span className="text-[12px] tabular-nums" style={{ fontWeight: 500, color: totalQuoteAdj > 0 ? '#6D28D9' : totalQuoteAdj < 0 ? '#047857' : '#64748B' }}>
              {totalQuoteAdj >= 0 ? '+' : ''}{fmtCurrency(totalQuoteAdj)}
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="text-[11px] text-slate-500">Item-level</span>
            <span className="text-[12px] tabular-nums" style={{ fontWeight: 500, color: totalItemAdj > 0 ? '#6D28D9' : totalItemAdj < 0 ? '#047857' : '#64748B' }}>
              {totalItemAdj >= 0 ? '+' : ''}{fmtCurrency(totalItemAdj)}
            </span>
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 8 }} />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Net Adjustment</span>
            <span className="text-[15px] tabular-nums" style={{ fontWeight: 700, color: totalAll > 0 ? '#6D28D9' : totalAll < 0 ? '#047857' : '#0F172A' }}>
              {totalAll >= 0 ? '+' : ''}{fmtCurrency(totalAll)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Add sub-modal ── */}
      {showAddModal && (
        <AdjustmentFormModal
          mode="add"
          scope={showAddModal}
          lineItems={showAddModal === 'item' ? lineItems : undefined}
          onSave={handleAddSave}
          onCancel={() => setShowAddModal(null)}
          docId={docId}
          currentUser={currentUser}
        />
      )}

      {/* ── Edit sub-modal ── */}
      {editingAdj && (
        <AdjustmentFormModal
          mode="edit"
          scope={editingAdj.scope}
          initial={editingAdj}
          lineItems={editingAdj.scope === 'item' ? lineItems : undefined}
          onSave={handleEditSave}
          onCancel={() => setEditingAdj(null)}
          docId={docId}
          currentUser={currentUser}
        />
      )}
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Adjustment Row (display-only, with hover actions)
// ═══════════════════════════════════════════════════════════════════════════════
function AdjustmentRow({
  adjustment, onEdit, onDelete, readOnly, compact, dollarImpact,
}: {
  adjustment: Adjustment;
  onEdit: () => void;
  onDelete: () => void;
  readOnly: boolean;
  compact?: boolean;
  /** Dollar value the adjustment actually contributes, computed against
   *  the relevant base (whole-quote subtotal for quote-scope, line
   *  subtotal for item-scope). Required so `%` adjustments can render
   *  their real impact instead of confusing the user with the raw 5. */
  dollarImpact?: number;
}) {
  const isAdd = adjustment.type === 'premium';
  const isPct = adjustment.amountType === '%';
  const sign = isAdd ? '+' : '-';
  const fmtPct = (n: number) => `${Math.round(n * 100) / 100}%`;
  const computedDollars = typeof dollarImpact === 'number' ? dollarImpact : adjustment.amount;
  /* Partner pricing-rule semantic colors: emerald for Discount,
     violet/purple for Premium. The action BUTTONS still use system
     blue elsewhere — purple here is only a category indicator pill. */
  const pill = isAdd
    ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE', icon: TrendingUp }
    : { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5', icon: TrendingDown };
  const PillIcon = pill.icon;

  return (
    <div
      className={`group flex items-center justify-between gap-3 bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] hover:bg-slate-50 transition-colors ${compact ? 'px-3 py-2.5' : 'px-3 py-2.5'}`}
      style={{ borderRadius: 10 }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span
          className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10.5px] border shrink-0"
          style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}
        >
          <PillIcon className="w-3 h-3" />
          {isAdd ? 'Premium' : 'Discount'}
        </span>
        <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>
          {adjustment.label}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex flex-col items-end tabular-nums" style={{ lineHeight: 1.15 }}>
          <span className="text-[13px]" style={{ fontWeight: 600, color: isAdd ? '#6D28D9' : '#047857' }}>
            {isPct ? `${sign}${fmtPct(adjustment.amount)}` : `${sign}${fmtCurrency(adjustment.amount)}`}
          </span>
          {isPct && (
            <span className="text-[11px]" style={{ fontWeight: 500, color: '#6B7280' }}>
              {sign}{fmtCurrency(computedDollars)}
            </span>
          )}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              aria-label="Edit adjustment"
              title="Edit"
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete adjustment"
              title="Delete"
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Add Quote-Level Adjustment Modal
// (opened directly from sidebar "+ Add quote-level adjustment" shortcut)
// ═══════════════════════════════════════════════════════════════════════════════
export function AddQuoteLevelAdjustmentModal({
  isOpen,
  onClose,
  adjustmentsAPI,
  onMaterialEvent,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Shared adjustments API so the new adjustment lands in the same
   *  store the sidebar count + Manage modal read from. Without this
   *  the shortcut used to fire a success toast and discard the
   *  payload — the sidebar stayed on "+ Add quote-level..." forever. */
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
}) {
  if (!isOpen) return null;

  return (
    <AdjustmentFormModal
      mode="add"
      scope="quote"
      onSave={(data) => {
        if (adjustmentsAPI) {
          const created = adjustmentsAPI.addAdjustment({
            label: data.label,
            type: data.type,
            amountType: data.amountType,
            amount: data.amount,
            scope: 'quote',
            internalNotes: (data as any).internalNotes,
            attachments: (data as any).attachments,
          });
          toast.success(`"${created.label}" added as quote-level adjustment`);
          /* Revert path — if the user discards the version prompt,
             remove the adjustment we just inserted so the sidebar
             count and the manage modal don't show a phantom entry. */
          onMaterialEvent?.(
            `Added ${created.type === 'premium' ? 'premium' : 'discount'} "${created.label}"`,
            () => adjustmentsAPI.removeAdjustment(created.id),
          );
        } else {
          /* Fallback — the sidebar should always be passing the API,
             but if a caller forgets we still close the modal so the
             user doesn't get stuck. */
          toast.success(`"${data.label}" added as quote-level adjustment`);
        }
        onClose();
      }}
      onCancel={onClose}
    />
  );
}