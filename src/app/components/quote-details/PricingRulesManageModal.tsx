import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, BadgePercent, Check, TrendingDown, TrendingUp, Tag, ChevronDown, ChevronUp, Package, CheckCircle2, AlertTriangle, CircleSlash, CirclePlus, MoreVertical, ChevronLeft, ChevronRight, Trash2, Search, SlidersHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { PricingRulePresetModal, type PricingRule as LibraryPricingRule } from '../shared/PricingRulePresetModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { EmptyPlaceholder } from '../shared/EmptyPlaceholder';
import { getLineItemImage } from '../../data/lineItemImage';
import { ItemTypeBadge } from '../shared/ItemTypeBadge';
import {
  CUSTOMER_PRICING_RULES_BY_ID,
  evaluateRuleForLine,
  lineIdsForRule,
} from './pricingRulesData';
import type { PricingRulesAPI } from './usePricingRules';
import { InactiveItemPill } from '../shared/InactiveItemPill';

/* Display-shaped line item, built from real Quote LineItem data passed in
   via the `lines` prop. Replaces the old mock LINE_ITEMS constant. */
interface ModalLineItem {
  id: string;
  productId: string;
  description: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  thumbColor: string;
  type: 'Serialized' | 'Non-Serialized' | 'Lot Non-Serialized';
}

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

function buildItemsFromLines(lines: QuoteLineInput[]): ModalLineItem[] {
  return lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    description: l.productName,
    qty: l.quantity,
    unitPrice: l.unitPrice,
    subtotal: l.quantity * l.unitPrice,
    thumbColor: thumbColorForCode(l.productId),
    type: l.isLotControlled ? 'Lot Non-Serialized' : l.isSerialized ? 'Serialized' : 'Non-Serialized',
  }));
}

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  value: number;
  amountType: '%' | '$';
  appliedTo: string[];
  amount: number;
  /** Whether the rule contributes to the quote subtotal. Unapplied rules
   * stay in the list (grayed out) and are skipped from totals. */
  isApplied: boolean;
  /** Why a rule is unapplied (only set when isApplied === false). */
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
  /** Applicability condition info */
  condition?: {
    type: 'volume' | 'value' | 'contract' | 'custom';
    status: 'fully_applied' | 'partial' | 'threshold_met';
    label: string;
    threshold?: string;
  };
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// ── Compact Item Row ── thumbnail + ID + description
function CompactItemRow({ item, checked, onToggle, showCheckbox = false, trailing }: {
  item: ModalLineItem;
  checked?: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 10px',
        cursor: onToggle ? 'pointer' : 'default',
        backgroundColor: checked ? '#F8FBFF' : '#FFFFFF',
        transition: 'background-color 100ms',
      }}
    >
      {showCheckbox && (
        <div style={{
          width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
          borderWidth: checked ? '0' : '1.5px', borderStyle: 'solid', borderColor: '#D1D5DB',
          backgroundColor: checked ? '#1B6EF3' : '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {checked && <Check style={{ width: '9px', height: '9px', color: '#FFFFFF' }} strokeWidth={3} />}
        </div>
      )}
      <div style={{
        width: '28px', height: '28px', borderRadius: '4px', flexShrink: 0,
        backgroundColor: item.thumbColor || '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Package style={{ width: '13px', height: '13px', color: '#6B7280', opacity: 0.6 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '3px', letterSpacing: '0.01em' }}>
          {item.id}
        </div>
        <div style={{
          fontSize: '11px', color: '#374151', lineHeight: '1.3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      </div>
      {trailing}
    </div>
  );
}

interface PricingRulesManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  onRulesChange?: (totalAmount: number, ruleCount: number) => void;
  /* Fired whenever a pricing-rule action occurs that constitutes a material
     change to the quote (activate, deactivate, remove, item-scope toggles,
     library apply/remove). Parent decides whether to prompt for a new
     version based on the quote's current stage. The optional `onRevert`
     callback is invoked when the user cancels the version prompt so the
     rule mutation is undone — without it, a discarded confirmation left
     the modified rule state in place. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Post-draft: library Apply/Remove/Activate/Deactivate edit the
   *  customer's rule book only — they do NOT touch this quote's rules
   *  and do NOT fire onMaterialEvent. Library is customer-scoped; the
   *  quote inherits rules at draft creation. Per-rule kebab and per-item
   *  toggles still fire onMaterialEvent (version prompt) since they
   *  explicitly modify the rule on this quote. */
  stageLibraryChanges?: boolean;
  customerName?: string;
  startEmpty?: boolean;
  /** Real quote lines from QuoteDetails. Drives items sub-modal, rule
   *  applicability, and totals. */
  lines: QuoteLineInput[];
  /** Shared pricing-rules API from QuoteDetails. When provided, the
   *  modal is fully controlled and stays in lockstep with the line-item
   *  configurator. */
  pricingAPI: PricingRulesAPI;
}

export function PricingRulesManageModal({ isOpen, onClose, readOnly = false, onRulesChange, onMaterialEvent, stageLibraryChanges = false, customerName, startEmpty, lines, pricingAPI }: PricingRulesManageModalProps) {
  /* Real items derived from quote lines (same projection the SO summary
     modal uses), with the same single-source-of-truth principle. */
  const items = useMemo(() => buildItemsFromLines(lines), [lines]);

  /* Lines in the shape the API helpers expect (id, productId, quantity,
     unitPrice). The breakdown helpers ignore extra fields. */
  const apiLines = useMemo(
    () => lines.map((l) => ({ id: l.id, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
    [lines],
  );

  /* Derive `rules` from the API on every render — same pattern as SO. */
  const rules: PricingRule[] = useMemo(() => {
    if (startEmpty) return [];
    return pricingAPI.state.attached.map((cr): PricingRule => {
      const isDeactivated = pricingAPI.state.deactivatedRuleIds.has(cr.id);
      const activatedSet = pricingAPI.state.activatedLineIdsByRule.get(cr.id) ?? new Set<string>();
      const appliedTo = isDeactivated ? lineIdsForRule(cr, apiLines) : Array.from(activatedSet);
      const amount = appliedTo.reduce((s, lineId) => {
        const ln = apiLines.find((l) => l.id === lineId);
        if (!ln) return s;
        const ev = evaluateRuleForLine(cr, ln);
        return s + (ev.applies ? ev.amount : 0);
      }, 0);
      const firstTier = cr.tiers[0];
      const tierLabel = cr.tiers.length === 1
        ? (firstTier.minQty > 1 ? `${firstTier.minQty}+ units` : 'Any qty')
        : `${cr.tiers.length} tiers from ${firstTier.minQty}+ units`;
      return {
        id: cr.id,
        name: cr.name,
        type: cr.type,
        value: firstTier.rate,
        amountType: firstTier.unit,
        appliedTo,
        amount: Math.round(amount),
        isApplied: !isDeactivated,
        unappliedReason: isDeactivated ? 'USER_UNAPPLIED' : undefined,
        condition: {
          type: 'volume',
          status: appliedTo.length > 0 ? 'fully_applied' : 'partial',
          label: cr.description,
          threshold: tierLabel,
        },
      };
    });
  }, [pricingAPI.state, apiLines, startEmpty]);

  /* Backward-compat shim — diff produced rules into API mutations so the
     existing setRules-based call sites keep working. Identical to SO. */
  const setRules = (updater: (prev: PricingRule[]) => PricingRule[]) => {
    const next = updater(rules);
    for (const nextRule of next) {
      const prevRule = rules.find((r) => r.id === nextRule.id);
      if (!prevRule) continue;
      if (prevRule.isApplied && !nextRule.isApplied) pricingAPI.deactivateRule(nextRule.id);
      else if (!prevRule.isApplied && nextRule.isApplied) pricingAPI.reactivateRule(nextRule.id);
      if (nextRule.isApplied) {
        const prevSet = new Set(prevRule.appliedTo);
        const nextSet = new Set(nextRule.appliedTo);
        const added = nextRule.appliedTo.filter((id) => !prevSet.has(id));
        const removed = prevRule.appliedTo.filter((id) => !nextSet.has(id));
        if (added.length) pricingAPI.setRuleActiveOnLines(nextRule.id, added, true);
        if (removed.length) pricingAPI.setRuleActiveOnLines(nextRule.id, removed, false);
      }
    }
    for (const prevRule of rules) {
      if (!next.some((r) => r.id === prevRule.id)) pricingAPI.detachRule(prevRule.id);
    }
  };

  const recomputeRuleAmount = (ruleId: string, newAppliedTo: string[]): number => {
    const customerRule = CUSTOMER_PRICING_RULES_BY_ID.get(ruleId);
    if (!customerRule) return 0;
    let sum = 0;
    for (const lineId of newAppliedTo) {
      const ln = apiLines.find((l) => l.id === lineId);
      if (!ln) continue;
      const ev = evaluateRuleForLine(customerRule, ln);
      if (ev.applies) sum += ev.amount;
    }
    return Math.round(sum);
  };
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /* Full-view toggle — mirrors the RecipientsSelectionModal pattern so
     every large modal in the suite exposes the same expansion control
     in the same place. */
  const [fullView, setFullView] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null);
  const [unapplyConfirm, setUnapplyConfirm] = useState<{ ruleId: string; name: string } | null>(null);
  const [reapplyConfirm, setReapplyConfirm] = useState<{ ruleId: string; name: string } | null>(null);
  const [itemToggleConfirm, setItemToggleConfirm] = useState<{
    ruleId: string;
    ruleName: string;
    itemIds: string[];
    willApply: boolean;
  } | null>(null);
  /* Multi-line-impact gate. Sits in front of the existing
     itemToggleConfirm so a bulk activate / deactivate that affects more
     than one line item surfaces a warning before the existing per-rule
     confirm. Single-line toggles bypass this layer entirely so the
     no-multi-line path is unchanged. */
  const [multiLineConfirm, setMultiLineConfirm] = useState<{
    ruleId: string;
    ruleName: string;
    itemIds: string[];
    willApply: boolean;
  } | null>(null);
  const pendingToggleRef = useRef<{
    ruleId: string;
    ruleName: string;
    itemIds: string[];
    willApply: boolean;
  } | null>(null);
  const [itemsModalRule, setItemsModalRule] = useState<PricingRule | null>(null);

  const [ruleDisplayItems, setRuleDisplayItems] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    rules.forEach(rule => {
      initial[rule.id] = [...rule.appliedTo];
    });
    return initial;
  });

  const quoteSubtotal = items.reduce((s, i) => s + i.subtotal, 0);

  const totalActiveDiscountAmount = rules
    .filter(r => r.isApplied && r.type === 'discount')
    .reduce((s, r) => s + r.amount, 0);
  const discountCapHit = quoteSubtotal > 0 && totalActiveDiscountAmount >= quoteSubtotal;

  const wouldExceedQuoteCap = (incrementalDiscountAmount: number) =>
    quoteSubtotal > 0 && (totalActiveDiscountAmount + incrementalDiscountAmount) > quoteSubtotal;

  useEffect(() => {
    if (!onRulesChange) return;
    const totalDiscount = rules
      .filter(r => r.isApplied)
      .reduce((s, r) => s + (r.type === 'discount' ? r.amount : -r.amount), 0);
    const appliedCount = rules.filter(r => r.isApplied).length;
    onRulesChange(totalDiscount, appliedCount);
  }, [rules, onRulesChange]);

  if (!isOpen) return null;

  const totalImpact = rules
    .filter(r => r.isApplied)
    .reduce((s, r) => s + (r.type === 'discount' ? -r.amount : r.amount), 0);
  const appliedRulesCount = rules.filter(r => r.isApplied).length;
  const uniqueItemCount = new Set(rules.filter(r => r.isApplied).flatMap(r => r.appliedTo)).size;

  const unapplyRule = (id: string, reason: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' = 'USER_UNAPPLIED') => {
    const target = rules.find(r => r.id === id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, isApplied: false, unappliedReason: reason } : r));
    if (expandedRuleId === id) setExpandedRuleId(null);
    if (reason === 'USER_UNAPPLIED' && target?.isApplied) {
      /* Revert path — if the user discards the version prompt, undo
         the deactivation so the rule snaps back into the applied list. */
      onMaterialEvent?.(
        `Deactivated pricing rule "${target.name}"`,
        () => pricingAPI.reactivateRule(id),
      );
    }
  };

  const reapplyRule = (id: string) => {
    const target = rules.find(r => r.id === id);
    setRules(prev => {
      const rule = prev.find(r => r.id === id);
      if (!rule) return prev;
      const incremental = rule.type === 'discount' ? rule.amount : 0;
      const exceeds = wouldExceedQuoteCap(incremental);
      if (exceeds) {
        toast.warning('Cannot activate — would exceed 100% of quote subtotal.');
        return prev.map(r => r.id === id ? { ...r, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' as const } : r);
      }
      return prev.map(r => r.id === id ? { ...r, isApplied: true, unappliedReason: undefined } : r);
    });
    if (target && !target.isApplied) {
      /* Revert path — re-deactivate if the user backs out of the
         version prompt. */
      onMaterialEvent?.(
        `Activated pricing rule "${target.name}"`,
        () => pricingAPI.deactivateRule(id),
      );
    }
  };

  const handleDeleteRule = (id: string) => {
    const rule = rules.find(r => r.id === id);
    unapplyRule(id, 'USER_UNAPPLIED');
    toast.info(`"${rule?.name}" deactivated`);
  };

  /* Shared commit path for both the single-line per-rule confirm and the
     multi-line bulk confirm. Keeping it as one function means the two
     entry points stay in sync and the user never sees back-to-back
     confirmation modals for the same toggle. */
  const commitItemToggle = (payload: { ruleId: string; ruleName: string; itemIds: string[]; willApply: boolean }) => {
    const { ruleId, ruleName, itemIds, willApply } = payload;
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const idSet = new Set(r.appliedTo);
      itemIds.forEach(id => willApply ? idSet.add(id) : idSet.delete(id));
      const nextAppliedTo = Array.from(idSet);
      const applicableSubtotal = items
        .filter(i => nextAppliedTo.includes(i.id))
        .reduce((s, i) => s + i.subtotal, 0);
      const newAmount = r.amountType === '%'
        ? Math.round(applicableSubtotal * (r.value / 100))
        : r.value;
      return { ...r, appliedTo: nextAppliedTo, amount: newAmount };
    }));
    setRuleDisplayItems(prev => {
      const existing = new Set(prev[ruleId] ?? []);
      itemIds.forEach(id => existing.add(id));
      return { ...prev, [ruleId]: Array.from(existing) };
    });
    toast.success(willApply
      ? `Activated on ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}.`
      : `Deactivated on ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}.`,
    );
    onMaterialEvent?.(
      `${willApply ? 'Activated' : 'Deactivated'} rule "${ruleName}" on ${itemIds.length} line item${itemIds.length !== 1 ? 's' : ''}`,
      () => pricingAPI.setRuleActiveOnLines(ruleId, itemIds, !willApply),
    );
  };

  const handleToggleItem = (ruleId: string, itemId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const newAppliedTo = r.appliedTo.includes(itemId)
        ? r.appliedTo.filter(i => i !== itemId)
        : [...r.appliedTo, itemId];
      if (newAppliedTo.length === 0) {
        toast.error('At least one item must remain selected');
        return r;
      }
      const applicableSubtotal = items.filter(i => newAppliedTo.includes(i.id)).reduce((s, i) => s + i.subtotal, 0);
      const newAmount = r.amountType === '%' ? Math.round(applicableSubtotal * (r.value / 100)) : r.value;
      return { ...r, appliedTo: newAppliedTo, amount: newAmount };
    }));
  };

  const conditionForBasis = (basis: 'value' | 'volume'): PricingRule['condition'] => {
    if (basis === 'volume') return { type: 'volume', status: 'partial', label: 'Applied at current quantity — check tier thresholds', threshold: 'Volume-based' };
    return { type: 'value', status: 'threshold_met', label: 'Applied — all items selected', threshold: 'Value-based' };
  };

  const libraryToLocal = (lib: LibraryPricingRule): PricingRule => {
    const t0 = lib.tiers[0];
    const isFixed = t0?.isFixRate || (t0?.discount?.includes('$') ?? false);
    const numericValue = t0 ? parseFloat(t0.discount.replace(/[^\d.]/g, '')) || 0 : 0;
    const appliedTo = items.map((i) => i.id);
    const applicableSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const amount = isFixed ? numericValue : Math.round(applicableSubtotal * (numericValue / 100));
    return {
      id: lib.id,
      name: lib.name,
      type: lib.category,
      value: numericValue,
      amountType: isFixed ? '$' : '%',
      appliedTo,
      amount,
      isApplied: true,
      condition: conditionForBasis(lib.basis),
    };
  };

  const handleApplyFromLibrary = (libRules: LibraryPricingRule[]) => {
    const selectedIds = new Set(libRules.map((r) => r.id));
    setRules((prev) => {
      const kept = prev
        .filter((r) => selectedIds.has(r.id))
        .map((r) => (r.isApplied ? r : { ...r, isApplied: true, unappliedReason: undefined as undefined }));

      let runningDiscount = kept
        .filter(r => r.isApplied && r.type === 'discount')
        .reduce((s, r) => s + r.amount, 0);
      const newOnes = libRules
        .filter((lr) => !prev.some((r) => r.id === lr.id))
        .map(libraryToLocal)
        .map((nr) => {
          const incremental = nr.type === 'discount' ? nr.amount : 0;
          const exceeds = quoteSubtotal > 0 && (runningDiscount + incremental) > quoteSubtotal;
          if (!exceeds) runningDiscount += incremental;
          return exceeds
            ? { ...nr, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' as const }
            : nr;
        });

      const unapplied = prev
        .filter((r) => !selectedIds.has(r.id))
        .map((r) => ({ ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const }));

      const next = [...kept, ...newOnes, ...unapplied];

      setRuleDisplayItems((rd) => {
        const updated = { ...rd };
        newOnes.forEach((nr) => {
          if (!updated[nr.id]) updated[nr.id] = [...nr.appliedTo];
        });
        return updated;
      });

      const exceededCount = newOnes.filter(n => !n.isApplied).length;
      const added = newOnes.length - exceededCount;
      const unappliedCount = unapplied.length - prev.filter(r => !selectedIds.has(r.id) && !r.isApplied).length;
      if (added) toast.success(`${added} rule${added !== 1 ? 's' : ''} added${exceededCount ? ` (${exceededCount} auto-deactivated — exceeds 100%)` : ''}`);
      if (!added && unappliedCount > 0) toast.success(`${unappliedCount} rule${unappliedCount !== 1 ? 's' : ''} deactivated`);
      return next;
    });
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 12000, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pricing Rules — ${customerName || 'Customer'}`}
        className={`relative bg-white flex flex-col overflow-hidden border border-border ${fullView ? 'w-screen' : 'w-[calc(100%-2rem)] sm:w-[1080px]'}`}
        style={{
          height: fullView ? '100vh' : 'min(88vh, 880px)',
          minHeight: fullView ? '100vh' : 560,
          borderRadius: fullView ? 0 : 16,
          boxShadow: fullView ? 'none' : '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          fontFamily: 'Inter, system-ui, sans-serif',
          /* Smoothly animate the Full view transition so the modal
             expands/contracts as one motion. */
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), height 220ms cubic-bezier(0.4, 0, 0.2, 1), min-height 220ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 220ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — quote-scoped */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 border-b border-border shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
            >
              <BadgePercent className="w-4 h-4" style={{ color: '#1B6EF3' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[14px] text-foreground truncate" style={{ fontWeight: 600 }}>
                  Pricing Rules on this Quote
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                  style={{ fontWeight: 600, color: '#065F46', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}
                >
                  Active
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {customerName ? `These pricing rules are applied to this quote for ${customerName}.` : 'These pricing rules are applied to this quote.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              <span className="text-foreground">{rules.length}</span>
              <span className="text-muted-foreground/70"> rule{rules.length !== 1 ? 's' : ''}</span>
            </span>
            {!readOnly && (
              <>
                <div className="w-px h-5 bg-border/60 hidden sm:block" />
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-foreground hover:bg-slate-50 hover:border-slate-300 text-[13px] transition-colors cursor-pointer whitespace-nowrap"
                  style={{ fontWeight: 500 }}
                >
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Manage Customer Pricing Rules</span>
                </button>
              </>
            )}
            <div className="w-px h-5 bg-border/60 hidden sm:block ml-1" />
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

        {/* Content — slate-50 wrapper */}
        <div className="flex-1 overflow-y-auto bg-slate-50" style={{ padding: '16px 20px', scrollbarWidth: 'thin' }}>
          {(() => {
            const visibleRules = rules.filter(
              (r) => r.isApplied || r.unappliedReason === 'USER_UNAPPLIED',
            );
            if (visibleRules.length === 0) {
              return (
                <div className="h-full flex items-center justify-center px-6 py-12">
                  <EmptyPlaceholder
                    icon={Tag}
                    title="No pricing rules on this quote yet"
                    description="Open the customer pricing library to apply rules — or leave it empty for a custom quote."
                    actionLabel={!readOnly ? 'Manage Customer Pricing Rules' : undefined}
                    onAction={!readOnly ? () => setLibraryOpen(true) : undefined}
                  />
                </div>
              );
            }
            return (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}
              >
                {visibleRules.map((rule) => (
                  <SummaryRuleCard
                    key={rule.id}
                    rule={rule}
                    onOpenItemsModal={() => setItemsModalRule(rule)}
                    onDeactivate={() => setUnapplyConfirm({ ruleId: rule.id, name: rule.name })}
                    onReactivate={() => setReapplyConfirm({ ruleId: rule.id, name: rule.name })}
                    readOnly={readOnly}
                    totalLineCount={items.length}
                  />
                ))}
              </div>
            );
          })()}

          {!readOnly && discountCapHit && (
            <div
              className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg border"
              style={{ borderColor: '#FCD34D', backgroundColor: '#FFFBEB', color: '#92400E', fontSize: 12, fontWeight: 500 }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Discount cap reached — new discount rules will be auto-unapplied until headroom returns.
            </div>
          )}
        </div>

        {/* Footer — rule count reads *applied* rules (toggling a rule
            off reduces it); the modal title already carries the total
            on this quote, so surfacing that same number here again
            would be redundant. */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-white shrink-0">
          <span className="text-[12px] text-slate-500">
            {appliedRulesCount} of {rules.length} rule{rules.length !== 1 ? 's' : ''} applied · {uniqueItemCount} item{uniqueItemCount !== 1 ? 's' : ''} affected
          </span>
          <span className="text-[14px] tabular-nums" style={{ fontWeight: 600, color: totalImpact < 0 ? '#047857' : totalImpact > 0 ? '#B91C1C' : '#475569' }}>
            {totalImpact < 0 ? '-' : '+'}{fmtCurrency(Math.abs(totalImpact))}
          </span>
        </div>
      </div>

      {/* Update Confirmation Modal */}
      {showUpdateModal && (() => {
        const rule = rules.find(r => r.id === showUpdateModal);
        if (!rule) return null;

        return createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 10002,
              backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowUpdateModal(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: '12px', width: '440px', maxWidth: '90vw',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.2)', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  Update Pricing Rule
                </h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '6px 0 0 0', lineHeight: '1.5' }}>
                  Apply changes to this quote only or update customer record for future quotes?
                </p>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '16px' }}>
                  <strong>{rule.name}</strong> will be updated based on your item selections.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => {
                      toast.success('Pricing rule updated for this quote');
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                      fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>This Quote Only</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Keep customer defaults unchanged</div>
                  </button>

                  <button
                    onClick={() => {
                      toast.success('Pricing rule updated in customer record for future quotes');
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF',
                      fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Update Customer Record</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Apply to all future quotes for this customer</div>
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '8px 0' }} />

                  <button
                    onClick={() => {
                      handleDeleteRule(showUpdateModal);
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #FEE2E2', backgroundColor: '#FEF2F2',
                      fontSize: '13px', fontWeight: 500, color: '#DC2626',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Remove Rule Completely</div>
                    <div style={{ fontSize: '12px', color: '#DC2626', opacity: 0.8 }}>Remove from this quote and customer record</div>
                  </button>
                </div>
              </div>

              <div style={{ padding: '12px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowUpdateModal(null)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px',
                    border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                    fontSize: '13px', fontWeight: 500, color: '#6B7280',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Full Pricing Rule Presets library — mounted only when open so
          the heavy customRules prop computation doesn't run (and can't
          crash) on every parent render. This was the root cause of the
          Quote-side modal rendering blank: the unconditional mount + a
          throwing computation in PricingRulePresetModal prop-prep
          tore down the whole tree. */}
      {libraryOpen && (
        <PricingRulePresetModal
          isOpen
          onClose={() => setLibraryOpen(false)}
          readOnly={readOnly}
          appliedRuleIds={rules.filter(r => r.isApplied).map(r => r.id)}
          onApply={(libRule) => {
            if (stageLibraryChanges) {
              /* Post-draft: library edits the customer's rule book.
                 Current quote rules + totals stay intact. The next draft
                 will inherit the updated customer rules. */
              toast.info(`"${libRule.name}" applied to the customer rule book. Current quote is unaffected — the next draft will inherit it.`);
              return;
            }
            const existing = rules.find(r => r.name.toLowerCase() === libRule.name.toLowerCase());
            if (existing) {
              setRules(prev => prev.map(r => r.id === existing.id
                ? { ...r, isApplied: true, unappliedReason: undefined }
                : r,
              ));
              toast.success(`"${libRule.name}" reactivated.`);
              return;
            }
            handleApplyFromLibrary([libRule]);
            toast.info(`"${libRule.name}" applied at the quote level. It isn't attached to any line item yet — open a line to assign.`);
          }}
          onDeactivateRule={(libRule) => {
            if (stageLibraryChanges) {
              toast.info(`"${libRule.name}" deactivated in the customer rule book. Current quote is unaffected.`);
              return;
            }
            const nm = libRule.name.toLowerCase();
            setRules(prev => prev.map(r => r.name.toLowerCase() === nm ? { ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const } : r));
          }}
          onActivateRule={(libRule) => {
            if (stageLibraryChanges) {
              toast.info(`"${libRule.name}" activated in the customer rule book. Current quote is unaffected.`);
              return;
            }
            const nm = libRule.name.toLowerCase();
            setRules(prev => prev.map(r => r.name.toLowerCase() === nm ? { ...r, isApplied: true, unappliedReason: undefined } : r));
          }}
          onRemoveRule={(libRule) => {
            if (stageLibraryChanges) {
              toast.info(`"${libRule.name}" removed from the customer rule book. Current quote is unaffected.`);
              return;
            }
            const nm = libRule.name.toLowerCase();
            setRules(prev => prev.filter(r => r.name.toLowerCase() !== nm));
          }}
          customerName={customerName || "Customer"}
          restrictToNames={rules.map(r => r.name)}
          customRules={rules.map((r): LibraryPricingRule => ({
            id: r.id,
            ruleNo: r.id,
            name: r.name,
            category: r.type,
            basis: r.condition?.type === 'volume' ? 'volume' : 'value',
            tierType: 'single',
            totalTiers: 1,
            description: r.condition?.label ?? `${r.value}${r.amountType} ${r.type === 'discount' ? 'off' : 'markup'}`,
            aboutText: '',
            status: r.isApplied ? 'Active' : 'Inactive',
            scope: 'customer',
            validFrom: '',
            validTo: '',
            hasDateLimit: false,
            durationDays: 365,
            itemCount: r.appliedTo.length,
            categoryCount: 0,
            partnerCount: 1,
            tiers: [{ minQty: '—', maxQty: '—', discount: `${r.value}${r.amountType}` }],
            createdBy: 'You',
            createdDate: '',
            isPreset: false,
            items: [],
            categories: [],
            partners: [],
          }))}
        />
      )}

      {/* Per-rule Deactivate Confirmation */}
      <ConfirmationModal
        isOpen={!!unapplyConfirm}
        title="Deactivate this pricing rule?"
        message={
          unapplyConfirm
            ? `"${unapplyConfirm.name}" will be deactivated. You can reactivate it any time.`
            : ''
        }
        confirmText="Deactivate"
        cancelText="Keep active"
        variant="yellow"
        icon={<CircleSlash className="w-6 h-6 text-white" />}
        onConfirm={() => {
          if (unapplyConfirm) unapplyRule(unapplyConfirm.ruleId, 'USER_UNAPPLIED');
          setUnapplyConfirm(null);
        }}
        onCancel={() => setUnapplyConfirm(null)}
      />

      {/* Per-rule Reactivate Confirmation */}
      <ConfirmationModal
        isOpen={!!reapplyConfirm}
        title={reapplyConfirm ? `Reactivate "${reapplyConfirm.name}"?` : ''}
        message={(() => {
          if (!reapplyConfirm) return '';
          const r = rules.find((x) => x.id === reapplyConfirm.ruleId);
          const n = r?.appliedTo.length ?? 0;
          return `It will be reactivated and applied to ${n} line item${n !== 1 ? 's' : ''} on this quote.`;
        })()}
        confirmText="Reactivate"
        cancelText="Keep deactivated"
        variant="blue"
        icon={<Plus className="w-6 h-6 text-white" />}
        onConfirm={() => {
          if (reapplyConfirm) reapplyRule(reapplyConfirm.ruleId);
          setReapplyConfirm(null);
        }}
        onCancel={() => setReapplyConfirm(null)}
      />

      {/* Per-item activate/deactivate confirmation */}
      <ConfirmationModal
        zIndex={12300}
        isOpen={!!itemToggleConfirm}
        title={(() => {
          if (!itemToggleConfirm) return '';
          const n = itemToggleConfirm.itemIds.length;
          const noun = `${n} line item${n !== 1 ? 's' : ''}`;
          return itemToggleConfirm.willApply
            ? `Activate "${itemToggleConfirm.ruleName}" on ${noun}?`
            : `Deactivate "${itemToggleConfirm.ruleName}" on ${noun}?`;
        })()}
        message={(() => {
          if (!itemToggleConfirm) return '';
          return itemToggleConfirm.willApply
            ? `The rule will start firing on the selected line item${itemToggleConfirm.itemIds.length !== 1 ? 's' : ''} and contribute to this quote's totals.`
            : `The rule will stop firing on the selected line item${itemToggleConfirm.itemIds.length !== 1 ? 's' : ''}. The rule itself stays on this customer — you can reactivate it on these items any time.`;
        })()}
        confirmText={itemToggleConfirm?.willApply ? 'Activate' : 'Deactivate'}
        cancelText="Cancel"
        variant={itemToggleConfirm?.willApply ? 'blue' : 'yellow'}
        icon={itemToggleConfirm?.willApply
          ? <CirclePlus className="w-6 h-6 text-white" />
          : <CircleSlash className="w-6 h-6 text-white" />
        }
        onConfirm={() => {
          if (!itemToggleConfirm) return;
          commitItemToggle(itemToggleConfirm);
          setItemToggleConfirm(null);
        }}
        onCancel={() => setItemToggleConfirm(null)}
      />

      {/* Per-rule items sub-modal — read the LIVE rule from rules on
          every render so toggle confirmations update the table + card
          immediately. */}
      {itemsModalRule && (() => {
        const liveRule = rules.find((r) => r.id === itemsModalRule.id) ?? itemsModalRule;
        return (
          <RuleItemsSubModal
            rule={liveRule}
            allItems={items}
            onClose={() => setItemsModalRule(null)}
            onRequestToggle={(itemIds, willActivate) => {
              /* Stash the prepared toggle in a ref so the multi-line
                 confirm can fire it after the user clicks through. For
                 single-line toggles skip the warning and proceed to the
                 existing per-rule confirm. */
              const payload = {
                ruleId: liveRule.id,
                ruleName: liveRule.name,
                itemIds,
                willApply: willActivate,
              };
              if (itemIds.length > 1) {
                pendingToggleRef.current = payload;
                setMultiLineConfirm(payload);
                return;
              }
              setItemToggleConfirm(payload);
            }}
            readOnly={readOnly}
          />
        );
      })()}

      {/* Multi-line-impact confirm. Fires only when the user commits a
          bulk activate / deactivate that touches more than one line
          item. On confirm we fall through to the existing per-rule
          confirm so the original UX remains intact. */}
      <ConfirmDiscardModal
        open={!!multiLineConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setMultiLineConfirm(null);
            pendingToggleRef.current = null;
          }
        }}
        variant="warning"
        badge="Multi-line change"
        title={`Apply rule changes to ${multiLineConfirm?.itemIds.length ?? 0} line items?`}
        description={`These activation changes will recalculate ${multiLineConfirm?.itemIds.length ?? 0} line items and the order total. Confirm only if this change was intended.`}
        confirmLabel="Apply changes"
        cancelLabel="Review changes"
        onConfirm={() => {
          const payload = pendingToggleRef.current;
          pendingToggleRef.current = null;
          setMultiLineConfirm(null);
          if (payload) commitItemToggle(payload);
        }}
      />
    </div>,
    document.body
  );
}

/* ────────────────────────────────────────────────────────────────────
 * SummaryRuleCard — Partner-faithful pricing rule card.
 * ──────────────────────────────────────────────────────────────────── */
function SummaryRuleCard({ rule, onOpenItemsModal, onDeactivate, onReactivate, readOnly, totalLineCount }: {
  rule: PricingRule;
  onOpenItemsModal: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  readOnly: boolean;
  totalLineCount: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  /* Menu is portalled to document.body to escape the card's
     `overflow: hidden`. The trigger button's bounding rect is
     captured on open so the menu can anchor to it with fixed
     positioning regardless of where the card sits on screen. */
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const isDis = rule.type === 'discount';
  const isDeactivated = !rule.isApplied;
  const totalItems = totalLineCount;
  const activeItems = rule.appliedTo.length;
  const pill = isDis
    ? { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5' }
    : { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' };
  const basis = rule.condition?.type === 'volume' ? 'Volume' : 'Value';

  useEffect(() => {
    if (!menuOpen) { setMenuAnchor(null); return; }
    const el = menuTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuAnchor({ top: r.top, right: window.innerWidth - r.right });
  }, [menuOpen]);
  const heroValue = `${rule.value}${rule.amountType}`;
  const dimStyle: React.CSSProperties = isDeactivated
    ? { opacity: 0.55, transition: 'opacity 150ms' }
    : { opacity: 1, transition: 'opacity 150ms' };
  /* Two states — Active / Deactivated. The footer "Applied on X/Y items"
     pill already communicates per-item partial coverage. */
  const statusPill = isDeactivated
    ? { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', label: 'Deactivated' }
    : { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', label: 'Active' };
  /* Unified frame — same flat color on the outer border and the
     tinted strip carrying the "Applied to N of M" label, so the
     card reads as one rounded shape with a white window inside. */
  const framePalette = isDeactivated
    ? { bg: '#F8FAFC', outline: '#E2E8F0', outlineHover: '#CBD5E1', text: '#64748B' }
    : isDis
    ? { bg: '#ECFDF5', outline: '#A7F3D0', outlineHover: '#6EE7B7', text: '#065F46' }
    : { bg: '#F5F3FF', outline: '#DDD6FE', outlineHover: '#C4B5FD', text: '#5B21B6' };

  return (
    <div
      onClick={() => { if (!isDeactivated) onOpenItemsModal(); }}
      role="button"
      tabIndex={isDeactivated ? -1 : 0}
      title={isDeactivated ? undefined : 'Click to view and toggle items'}
      className="cursor-pointer group transition-all duration-200 flex flex-col relative h-[260px] outline-none focus:outline-none overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: `1px solid ${framePalette.outline}`,
        borderRadius: 14,
      }}
      onMouseEnter={(e) => {
        if (isDeactivated) return;
        e.currentTarget.style.borderColor = framePalette.outlineHover;
        e.currentTarget.style.boxShadow = '0 4px 16px -6px rgba(15,23,42,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = framePalette.outline;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="bg-white flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0" style={dimStyle}>
          <span
            className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0"
            style={{ borderColor: pill.border }}
          >
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
            >
              {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {isDis ? 'Discount' : 'Premium'}
            </span>
            <span
              className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l"
              style={{ fontWeight: 500, borderColor: pill.border }}
            >
              {basis}
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] border whitespace-nowrap"
              style={{ fontWeight: 600, color: statusPill.color, backgroundColor: statusPill.bg, borderColor: statusPill.border }}
            >
              {statusPill.label}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground"
              style={{ fontWeight: 600 }}
            >
              CUSTOM
            </span>
          </div>
        </div>

        <div className="shrink-0 mb-1" style={dimStyle}>
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
            {rule.name}
          </p>
        </div>

        {/* Description — gets the full 2-line slot back so it
            isn't cropped by an overlapping pill. The Applied count
            moved into the footer strip below. */}
        <div className="h-[32px] shrink-0 mb-2" style={dimStyle}>
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2" style={{ fontWeight: 400 }}>
            {rule.condition?.label ?? ''}
          </p>
        </div>

        <div className="flex items-baseline justify-between gap-2 shrink-0" style={dimStyle}>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {heroValue}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {isDis ? 'off' : 'markup'}
            </span>
          </div>
          <div className="flex flex-col items-end shrink-0 leading-tight">
            <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Always active</span>
          </div>
        </div>

        <div className="mt-auto pt-2 shrink-0" style={dimStyle}>
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <span className="text-slate-500 truncate" style={{ fontWeight: 400 }}>
              {rule.condition?.threshold ?? '—'}
            </span>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>
              {heroValue}
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* Applied band — flat tinted strip at the bottom of the card.
          The outer container is white; only this row carries the tint
          so the colored area lives below the stroke band, not around it. */}
      <div
        className="flex items-center justify-between gap-3 shrink-0"
        style={{ padding: '6px 9px 6px 11px', background: framePalette.bg, ...dimStyle }}
      >
        <span
          className="inline-flex items-center text-[11px] tabular-nums"
          style={{ fontWeight: 600, color: framePalette.text }}
        >
          Applied to {activeItems} of {totalItems} items
        </span>
        {!readOnly && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              aria-label="Rule actions"
              title="Rule actions"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-white/60 transition-all cursor-pointer"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && menuAnchor && createPortal(
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 12290 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  /* Anchors the menu's bottom-right to the trigger's
                     top-right with a 6px gap so it opens upward and
                     does not cover the trigger. Fixed positioning +
                     portal avoids any ancestor `overflow: hidden`. */
                  style={{
                    position: 'fixed',
                    bottom: window.innerHeight - menuAnchor.top + 6,
                    right: menuAnchor.right,
                    zIndex: 12295,
                    minWidth: 180, backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)', padding: 4,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isDeactivated && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onOpenItemsModal(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-foreground hover:bg-muted text-left cursor-pointer"
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <Package style={{ width: 14, height: 14, color: '#64748B' }} />
                      View items
                    </button>
                  )}
                  {isDeactivated ? (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onReactivate(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-primary hover:bg-muted text-left cursor-pointer"
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <CirclePlus style={{ width: 14, height: 14 }} />
                      Reactivate rule
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onDeactivate(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-foreground hover:bg-muted text-left cursor-pointer"
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <CircleSlash style={{ width: 14, height: 14, color: '#64748B' }} />
                      Deactivate rule
                    </button>
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * RuleItemsSubModal — sub-modal opened from a SummaryRuleCard click.
 * ──────────────────────────────────────────────────────────────────── */
function RuleItemsSubModal({ rule, allItems, onClose, onRequestToggle, readOnly }: {
  rule: PricingRule;
  allItems: ModalLineItem[];
  onClose: () => void;
  onRequestToggle: (itemIds: string[], willActivate: boolean) => void;
  readOnly: boolean;
}) {
  const [scopedItemIds] = useState<Set<string>>(() => new Set(rule.appliedTo));
  const scopedItems = useMemo(
    () => allItems.filter((i) => scopedItemIds.has(i.id)),
    [allItems, scopedItemIds],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isDis = rule.type === 'discount';
  const pill = isDis
    ? { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5' }
    : { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' };
  const activeIdSet = useMemo(() => new Set(rule.appliedTo), [rule.appliedTo]);
  const allSelected = scopedItems.length > 0 && scopedItems.every((i) => selectedIds.has(i.id));
  const someSelected = !allSelected && scopedItems.some((i) => selectedIds.has(i.id));

  const impactFor = (subtotal: number) =>
    rule.amountType === '%' ? Math.round(subtotal * (rule.value / 100)) : rule.value;

  const selectedActiveIds = useMemo(
    () => Array.from(selectedIds).filter((id) => activeIdSet.has(id)),
    [selectedIds, activeIdSet],
  );
  const selectedInactiveIds = useMemo(
    () => Array.from(selectedIds).filter((id) => !activeIdSet.has(id)),
    [selectedIds, activeIdSet],
  );

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === scopedItems.length ? new Set() : new Set(scopedItems.map((i) => i.id))));
  };
  const runBulkActivate = () => {
    if (selectedInactiveIds.length === 0) return;
    onRequestToggle(selectedInactiveIds, true);
    setSelectedIds(new Set());
  };
  const runBulkDeactivate = () => {
    if (selectedActiveIds.length === 0) return;
    onRequestToggle(selectedActiveIds, false);
    setSelectedIds(new Set());
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 12250, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Activate / deactivate items for ${rule.name}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col overflow-hidden bg-white border border-border"
        style={{
          width: 'min(1080px, calc(100vw - 2rem))',
          height: 'min(88vh, 800px)',
          maxHeight: 'calc(100vh - 2rem)',
          borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <div className="shrink-0 bg-white border-b border-border">
          <div className="px-5 pt-3 pb-3 flex items-start gap-3">
            <div
              className="w-[44px] h-[44px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5 mt-0.5"
              style={{ backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
            >
              {isDis
                ? <TrendingDown className="w-3.5 h-3.5" style={{ color: pill.text }} />
                : <TrendingUp className="w-3.5 h-3.5" style={{ color: pill.text }} />}
              <span className="text-[10px] tabular-nums leading-none" style={{ color: pill.text, fontWeight: 700 }}>
                {rule.value}{rule.amountType}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-[15px] text-foreground truncate" style={{ fontWeight: 700 }}>{rule.name}</h1>
                <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px]" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}>
                    {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {isDis ? 'Discount' : 'Premium'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                    {rule.condition?.type === 'volume' ? 'Volume' : 'Value'}-Based
                  </span>
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed line-clamp-1">
                Activate or deactivate this rule per line item on this quote.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
            <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Package className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              Line items
            </span>
            <span
              className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px]"
              style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
            >
              {rule.appliedTo.length}/{scopedItems.length} ACTIVE
            </span>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <div className="flex items-center" style={{ height: 30, gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  {selectedIds.size} selected
                </span>
                <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
                {/* Deactivate first — destructive sits left of primary. */}
                {selectedActiveIds.length > 0 && (
                  <button
                    type="button"
                    onClick={runBulkDeactivate}
                    className="inline-flex items-center gap-1.5 border transition-all duration-150 hover:bg-red-50 hover:border-[#FCA5A5]"
                    style={{ height: 30, padding: '0 10px', borderRadius: 8, background: '#FFFFFF', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#B91C1C', borderColor: '#FECACA' }}
                  >
                    <CircleSlash size={14} />
                    <span>Deactivate</span>
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full tabular-nums"
                      style={{ height: 16, minWidth: 18, fontSize: 10, fontWeight: 700, backgroundColor: '#FEE2E2', color: '#B91C1C' }}
                    >
                      {selectedActiveIds.length}
                    </span>
                  </button>
                )}
                {/* Activate — primary blue (Partner pattern). */}
                {selectedInactiveIds.length > 0 && (
                  <button
                    type="button"
                    onClick={runBulkActivate}
                    className="inline-flex items-center gap-1.5 border transition-all duration-150 hover:bg-[#0862D0] hover:border-[#0862D0]"
                    style={{ height: 30, padding: '0 10px', borderRadius: 8, background: '#1B6EF3', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#FFFFFF', borderColor: '#1B6EF3' }}
                  >
                    <CirclePlus size={14} />
                    <span>Activate</span>
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full tabular-nums"
                      style={{ height: 16, minWidth: 18, fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }}
                    >
                      {selectedInactiveIds.length}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mx-4 mb-3 flex-1 min-h-0 overflow-hidden bg-white rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-full overflow-y-auto">
              <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 44 }} />
                  <col style={{ width: 56 }} />
                  <col style={{ width: 140 }} />
                  {/* Description absorbs remaining space. Type widened
                      to 168px so the shared `ItemTypeBadge` (icon +
                      label + border + padding) fits without clipping,
                      matching the AdjustmentFormModal's Type column. */}
                  <col />
                  <col style={{ width: 168 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 116 }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: '#FAFBFC' }}>
                    <th className="text-left pl-4 pr-2 h-9" style={{ backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={toggleAll}
                          aria-label={allSelected ? 'Deselect all' : 'Select all'}
                          className="w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors cursor-pointer"
                          style={{
                            borderColor: allSelected ? '#1B6EF3' : '#D1D5DB',
                            backgroundColor: allSelected ? '#1B6EF3' : someSelected ? '#1B6EF3' : '#FFFFFF',
                            borderWidth: allSelected || someSelected ? 0 : 1.5,
                          }}
                        >
                          {allSelected && <Check style={{ width: 10, height: 10, color: '#FFFFFF' }} strokeWidth={3} />}
                          {someSelected && <div style={{ width: 8, height: 2, backgroundColor: '#FFFFFF' }} />}
                        </button>
                      )}
                    </th>
                    <th className="text-left px-2 h-9 text-[11px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>#</th>
                    <th className="text-left px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Part Number</th>
                    <th className="text-left px-3 h-9 text-[11px] text-slate-600" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Description</th>
                    <th className="text-left pl-3 pr-5 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6', minWidth: 160 }}>Type</th>
                    <th className="text-left px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6', minWidth: 160 }}>Item Status</th>
                    <th className="text-right px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Qty</th>
                    <th className="text-right px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Total</th>
                    <th className="text-right px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Impact</th>
                    <th className="text-left pr-4 pl-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-[12px] text-slate-400">
                        This rule is not applied to any line items on this quote.
                      </td>
                    </tr>
                  ) : (
                    scopedItems.map((item) => {
                      const isActive = activeIdSet.has(item.id);
                      const isSelected = selectedIds.has(item.id);
                      const cellBorder = '1px solid #EEF2F6';
                      /* Index reflects the row's position in the source
                         quote line list (allItems), not the scoped subset.
                         Zero-padded to 3 digits. */
                      const indexInSource = allItems.findIndex((i) => i.id === item.id) + 1;
                      const indexLabel = String(indexInSource).padStart(3, '0');
                      return (
                        <tr
                          key={item.id}
                          className="group hover:bg-[#F8FAFC]"
                          style={{
                            backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                            transition: 'background-color 120ms',
                          }}
                        >
                          <td className="pl-4 pr-2 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => toggleRow(item.id)}
                                aria-label={isSelected ? 'Deselect row' : 'Select row'}
                                className="w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors cursor-pointer"
                                style={{
                                  borderColor: isSelected ? '#1B6EF3' : '#D1D5DB',
                                  backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                                  borderWidth: isSelected ? 0 : 1.5,
                                }}
                              >
                                {isSelected && <Check style={{ width: 10, height: 10, color: '#FFFFFF' }} strokeWidth={3} />}
                              </button>
                            )}
                          </td>
                          <td className="px-2 py-3 align-middle text-left text-[11px] text-slate-400 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder, borderRight: cellBorder }}>
                            {indexLabel}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder, maxWidth: 0 }}>
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Real product thumbnail via the shared
                                  `getLineItemImage` helper, matching the
                                  main Quote line-items grid. Falls back
                                  to the deterministic tint if the image
                                  errors so the row never renders a
                                  blank square. */}
                              <img
                                src={getLineItemImage(item.productId)}
                                alt=""
                                className="w-6 h-6 rounded-md shrink-0 object-cover"
                                style={{ backgroundColor: item.thumbColor }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                                }}
                              />
                              <span className="text-[12px] text-slate-700 tabular-nums truncate" style={{ fontWeight: 500 }} title={item.productId}>
                                {item.productId}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                            <p className="text-[12px] text-slate-600 truncate" title={item.description}>
                              {item.description}
                            </p>
                          </td>
                          <td className="pl-3 pr-5 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder, borderRight: cellBorder, minWidth: 160 }}>
                            {/* Shared serialization pill (Physical
                                Inventory `ControlTypeBadge` chrome).
                                Same glyph + colour tokens as the main
                                Quote line-items grid so both surfaces
                                read as one system. */}
                            <ItemTypeBadge type={item.type} />
                          </td>
                          {/* Item-master status, its own column so it can't be
                              read as the rule's Activated / Deactivated state in
                              the Status column: different header, and the item
                              badge carries an icon where the rule pill doesn't. */}
                          <td className="px-3 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                            <InactiveItemPill code={item.productId} variant="badge" showActive noun="quote" />
                          </td>
                          <td className="px-3 py-3 align-middle text-right text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder, borderRight: cellBorder }}>
                            {item.qty}
                          </td>
                          <td className="px-3 py-3 align-middle text-right text-[12px] tabular-nums whitespace-nowrap" style={{ fontWeight: 500, color: '#475569', borderBottom: cellBorder, borderRight: cellBorder }}>
                            {fmtCurrency(item.subtotal)}
                          </td>
                          <td className="px-3 py-3 align-middle text-right text-[12px] tabular-nums whitespace-nowrap" style={{ fontWeight: 600, color: isActive ? (isDis ? '#047857' : '#B91C1C') : '#9CA3AF', borderBottom: cellBorder, borderRight: cellBorder }}>
                            {isActive ? `${isDis ? '-' : '+'}${fmtCurrency(impactFor(item.subtotal))}` : '—'}
                          </td>
                          <td className="pr-4 pl-3 py-3 align-middle text-right whitespace-nowrap" style={{ borderBottom: cellBorder }}>
                            {!readOnly ? (
                              <button
                                type="button"
                                onClick={() => onRequestToggle([item.id], !isActive)}
                                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10.5px] border transition-colors cursor-pointer whitespace-nowrap"
                                style={{
                                  fontWeight: 500,
                                  color: isActive ? '#065F46' : '#92400E',
                                  backgroundColor: isActive ? '#ECFDF5' : '#FFFBEB',
                                  borderColor: isActive ? '#A7F3D0' : '#FDE68A',
                                }}
                                title={isActive ? 'Click to deactivate this rule on this item' : 'Click to activate this rule on this item'}
                              >
                                {isActive ? 'Activated' : 'Deactivated'}
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center px-2 py-[2px] rounded-full text-[10.5px] border"
                                style={{
                                  fontWeight: 500,
                                  color: isActive ? '#065F46' : '#92400E',
                                  backgroundColor: isActive ? '#ECFDF5' : '#FFFBEB',
                                  borderColor: isActive ? '#A7F3D0' : '#FDE68A',
                                }}
                              >
                                {isActive ? 'Activated' : 'Deactivated'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer — total impact summary aligned right; Close button
            removed (header X / Esc already close the modal). */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border bg-white shrink-0">
          {(() => {
            const activeCount = scopedItems.filter((i) => activeIdSet.has(i.id)).length;
            const totalImpactValue = scopedItems
              .filter((i) => activeIdSet.has(i.id))
              .reduce((s, i) => s + impactFor(i.subtotal), 0);
            return (
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-slate-400">
                  {activeCount}/{scopedItems.length} active
                </span>
                <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
                <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>Total impact</span>
                <span className="text-[14px] tabular-nums" style={{ fontWeight: 700, color: isDis ? '#047857' : '#6D28D9' }}>
                  {totalImpactValue === 0 ? '—' : `${isDis ? '-' : '+'}${fmtCurrency(totalImpactValue)}`}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
