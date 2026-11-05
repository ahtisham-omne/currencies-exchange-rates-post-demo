import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, BadgePercent, Check, TrendingDown, TrendingUp, Tag, ChevronDown, ChevronUp, Package, CheckCircle2, AlertTriangle, CircleSlash, CirclePlus, MoreVertical, ChevronLeft, ChevronRight, Trash2, Search, SlidersHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { PricingRulesLibrary, type PricingRule as LibraryPricingRule } from './PricingRulesLibrary';
import { ConfirmationModal } from '../ConfirmationModal';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { EmptyPlaceholder } from '../shared/EmptyPlaceholder';
import { getLineItemImage } from './lineItemImage';
import { ItemTypeBadge } from './StatusBadge';
import type { SOLine } from './types';
import {
  getCustomerRules,
  evaluateRuleForLine,
  lineIdsForRule,
  pickTier,
  CUSTOMER_PRICING_RULES_BY_ID,
  type CustomerPricingRule,
} from './pricingRulesData';
import type { PricingRulesAPI } from './usePricingRules';
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { useDocWhole } from "@/app/components/currency/docCurrencyContext";
import { useRuleMoney } from "@/app/components/currency/useRuleMoney";

/* The shape this modal uses for its line-item table. Built from real
   SOLine data via `buildItemsFromLines`. Replaces the old hard-coded
   `LINE_ITEMS` constant so the summary reflects the actual SO. */
interface ModalLineItem {
  id: string;
  itemCode: string;
  description: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  thumbColor: string;
  type: 'Serialized' | 'Non-Serialized' | 'Lot Non-Serialized';
}

/* Deterministic thumb tint from the itemCode so the same item always
   renders with the same color across SOs. */
const THUMB_PALETTE = ['#DBEAFE', '#D1FAE5', '#FEE2E2', '#E0E7FF', '#FEF3C7', '#FCE7F3', '#F3E8FF', '#FED7AA', '#CCFBF1'];
function thumbColorForCode(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return THUMB_PALETTE[h % THUMB_PALETTE.length];
}

function buildItemsFromLines(lines: SOLine[]): ModalLineItem[] {
  return lines
    .filter((l) => !l.cancelled)
    .map((l) => ({
      id: l.id,
      itemCode: l.itemCode,
      description: l.itemName,
      qty: l.orderedQty,
      unitPrice: l.unitPrice,
      subtotal: l.orderedQty * l.unitPrice,
      thumbColor: thumbColorForCode(l.itemCode),
      type: (l.itemType as ModalLineItem['type']) ?? 'Non-Serialized',
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
  /** Whether the rule contributes to the SO subtotal. Unapplied rules stay
   * in the list (grayed out) and are skipped from totals. */
  isApplied: boolean;
  /** Why a rule is unapplied (only set when isApplied === false). */
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
  /** Applicability condition info */
  condition?: {
    type: 'volume' | 'value' | 'contract' | 'custom';
    status: 'fully_applied' | 'partial' | 'threshold_met';
    label: string;       // e.g. "Fully applied" or "3 of 5 units — needs 2 more for 7% tier"
    threshold?: string;  // e.g. "5+ units" or "$50,000 min"
  };
}

// Library rules catalog
interface LibraryRule {
  id: string;
  name: string;
  description: string;
  type: 'discount' | 'premium';
  category: string;
  adjustmentType: 'percentage' | 'fixed';
  adjustmentValue: number;
}

const LIBRARY_RULES: LibraryRule[] = [
  { id: 'fleet-volume', name: 'Fleet Volume Discount', description: 'Discount for multi-unit fleet orders', type: 'discount', category: 'volume', adjustmentType: 'percentage', adjustmentValue: 7 },
  { id: 'gov-contract', name: 'Government Contract Pricing', description: 'Municipal/state/federal contract discount', type: 'discount', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 3 },
  { id: 'state-bid', name: 'State Cooperative Bid', description: 'Cooperative purchasing agreement discount', type: 'discount', category: 'value', adjustmentType: 'percentage', adjustmentValue: 12 },
  { id: 'oem-rebate', name: 'OEM Manufacturer Rebate', description: 'Pass-through rebate from equipment OEM', type: 'discount', category: 'value', adjustmentType: 'percentage', adjustmentValue: 3 },
  { id: 'rush-build', name: 'Expedited Build Premium', description: 'Surcharge for rush build schedule under 90 days', type: 'premium', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 15 },
  { id: 'custom-config', name: 'Custom Configuration Premium', description: 'Premium for non-standard build specs', type: 'premium', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 8 },
  { id: 'small-order', name: 'Single-Unit Surcharge', description: 'Premium for single-unit conversion orders', type: 'premium', category: 'volume', adjustmentType: 'percentage', adjustmentValue: 10 },
  { id: 'early-pay', name: 'Early Payment Incentive', description: '2% discount for payment within 10 days', type: 'discount', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 2 },
];

/* Amounts are in the SO's currency (useDocWhole, inside each component).
   A "$" rule's own amount is written in USD (useRuleMoney): "$200.00 (≈ €182.73)". */
type RuleAmount = { value: number; amountType: '%' | '$' };
const ruleValueText = (money: ReturnType<typeof useRuleMoney>, r: RuleAmount) =>
  money.tierText({ rate: r.value, unit: r.amountType });

// ── Compact Item Row ── thumbnail + ID + description (shared mini-table style)
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
      {/* Thumbnail */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '4px', flexShrink: 0,
        backgroundColor: item.thumbColor || '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Package style={{ width: '13px', height: '13px', color: '#6B7280', opacity: 0.6 }} />
      </div>
      {/* ID + description */}
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
      {/* Trailing content (price, etc.) */}
      {trailing}
    </div>
  );
}

interface PricingRulesManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  /** Real SO lines. Drives the items sub-modal, applicable-rule
   *  evaluation, per-line + SO subtotal math, and the totals strip. */
  lines: SOLine[];
  /** Shared pricing-rules API from the SODetail-level usePricingRules.
   *  When provided, the modal is fully controlled: it reads rule state
   *  from this API and routes every mutation through it, so changes here
   *  show up in the line-item configurator and any other consumer of
   *  the same API instance. */
  pricingAPI: PricingRulesAPI;
  /** Called when rules change — provides new total discount amount and rule count */
  onRulesChange?: (totalAmount: number, ruleCount: number) => void;
  /** Fires whenever a pricing-rule action constitutes a material change
     to the order (activate, deactivate, remove, item-scope toggle,
     library apply/remove). Parent decides whether to prompt for a new
     version based on the SO's current stage. The optional `onRevert`
     callback runs when the user discards the version prompt so the
     rule mutation is undone — without it, cancelling left the modified
     rule state in place. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** IDs of line items that are shipped (fully or partially). Rules whose
   *  appliedTo intersects this list become read-only — the deal for those
   *  items is closed. Per the SO lifecycle, Partially Shipped locks any
   *  rule touching a shipped line; Shipped locks everything (handled by
   *  the global readOnly flag). */
  shippedLineIds?: string[];
  /** When true (post-draft), library Apply / Activate / Deactivate /
   *  Remove edit the customer's rule book only — they do NOT touch the
   *  current SO's rules and do NOT fire onMaterialEvent. Library is a
   *  customer-scoped store; current SO/quote inherits rules at draft
   *  creation. Per-rule kebab and per-item toggles inside the summary
   *  still fire onMaterialEvent and trigger the version prompt because
   *  they explicitly modify the rule on the current SO. */
  stageLibraryChanges?: boolean;
  /** Display name of the customer this SO is for — rendered in the
   *  library modal's header subtitle and the Remove confirmation copy.
   *  Falls back to "Customer" when not supplied. */
  customerName?: string;
  /** When true the modal starts with NO pricing rules so users can see
   *  the empty-state UI. Useful for demos and for SOs whose customer
   *  doesn't have any rules attached yet. */
  startEmpty?: boolean;
}

export function PricingRulesManageModal({ isOpen, onClose, readOnly = false, lines, pricingAPI, onRulesChange, onMaterialEvent, shippedLineIds, stageLibraryChanges = false, customerName, startEmpty }: PricingRulesManageModalProps) {
  const fmtCurrency = useDocWhole();
  const ruleMoney = useRuleMoney();
  /* Derive the modal's display-shaped items from real SO lines. Single
     source of truth replacing the old hard-coded LINE_ITEMS. */
  const items = useMemo(() => buildItemsFromLines(lines), [lines]);

  /* Derive the modal's `rules` array from the shared API. Each render
     re-projects the customer-rule-book entries through the current API
     state (deactivated flag + per-line activation set) into the legacy
     PricingRule shape the rest of the modal expects.

     A deactivated rule stays in the list (grayed out) — that's the
     existing UX. We mark its `appliedTo` as the original lineIdsForRule
     so the items sub-modal still has rows to render. */
  const rules: PricingRule[] = useMemo(() => {
    if (startEmpty) return [];
    return pricingAPI.state.attached.map((cr): PricingRule => {
      const isDeactivated = pricingAPI.state.deactivatedRuleIds.has(cr.id);
      const activatedSet = pricingAPI.state.activatedLineIdsByRule.get(cr.id) ?? new Set<string>();
      const appliedTo = isDeactivated
        ? lineIdsForRule(cr, lines)
        : Array.from(activatedSet);
      const amount = appliedTo.reduce((s, lineId) => {
        const ln = lines.find((l) => l.id === lineId);
        if (!ln) return s;
        const ev = evaluateRuleForLine(cr, ln, ruleMoney.factor);
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
  }, [pricingAPI.state, lines, startEmpty, ruleMoney.factor]);

  /* Backward-compat shim: the existing modal code uses `setRules(prev =>
     ...)` in many places. Route those calls through the API so we don't
     have to rewrite each one. Diffs the produced result against the
     current rules to figure out which API mutations to call. This is
     intentionally narrow — only supports the shapes the existing code
     produces (deactivate, reactivate, change appliedTo). */
  const setRules = (updater: (prev: PricingRule[]) => PricingRule[]) => {
    const next = updater(rules);
    for (const nextRule of next) {
      const prevRule = rules.find((r) => r.id === nextRule.id);
      if (!prevRule) continue;
      // isApplied toggled
      if (prevRule.isApplied && !nextRule.isApplied) pricingAPI.deactivateRule(nextRule.id);
      else if (!prevRule.isApplied && nextRule.isApplied) pricingAPI.reactivateRule(nextRule.id);
      // appliedTo changed (only meaningful when rule is active)
      if (nextRule.isApplied) {
        const prevSet = new Set(prevRule.appliedTo);
        const nextSet = new Set(nextRule.appliedTo);
        const added = nextRule.appliedTo.filter((id) => !prevSet.has(id));
        const removed = prevRule.appliedTo.filter((id) => !nextSet.has(id));
        if (added.length) pricingAPI.setRuleActiveOnLines(nextRule.id, added, true);
        if (removed.length) pricingAPI.setRuleActiveOnLines(nextRule.id, removed, false);
      }
    }
    // Detached (library Remove): rules present in prev but not in next.
    for (const prevRule of rules) {
      if (!next.some((r) => r.id === prevRule.id)) pricingAPI.detachRule(prevRule.id);
    }
  };
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /* Full-view toggle — mirrors RecipientsSelectionModal so every large
     modal in the suite carries the same expansion control. */
  const [fullView, setFullView] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null); // ruleId to update/remove
  // Per-rule unapply confirmation. Reuses the same ConfirmationModal as the rest of the SO module.
  const [unapplyConfirm, setUnapplyConfirm] = useState<{ ruleId: string; name: string } | null>(null);
  // Per-rule reactivate confirmation — mirrors Quote's PricingRulesManageModal
  // so the deactivate → reactivate round-trip uses the same blue-variant modal.
  const [reapplyConfirm, setReapplyConfirm] = useState<{ ruleId: string; name: string } | null>(null);
  /* Confirms a per-item activate/deactivate inside a rule card's
     expanded "Applied to" section. `willApply: true` means the user is
     about to enable the rule on the listed items; `false` means disable.
     Both single-item and bulk selections route through this same modal. */
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
  // Rule whose items sub-modal is currently open (library-faithful card click).
  const [itemsModalRule, setItemsModalRule] = useState<PricingRule | null>(null);
  /* Toolbar state — name search + Discount/Premium filter pills above
     the cards grid. Both default to a no-op so the modal opens unfiltered. */
  // Track which items to display for each rule (includes unchecked items that were previously applied)
  const [ruleDisplayItems, setRuleDisplayItems] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    rules.forEach(rule => {
      initial[rule.id] = [...rule.appliedTo]; // Initially show only applied items
    });
    return initial;
  });

  // SO subtotal — sum of every line item we know about. Used as the 100% cap base.
  const soSubtotal = items.reduce((s, i) => s + i.subtotal, 0);

  // Total active discount $ (skips unapplied entries). Premiums excluded.
  const totalActiveDiscountAmount = rules
    .filter(r => r.isApplied && r.type === 'discount')
    .reduce((s, r) => s + r.amount, 0);
  const discountCapHit = soSubtotal > 0 && totalActiveDiscountAmount >= soSubtotal;

  const wouldExceedSoCap = (incrementalDiscountAmount: number) =>
    soSubtotal > 0 && (totalActiveDiscountAmount + incrementalDiscountAmount) > soSubtotal;

  // Notify parent when rules change. Skip unapplied entries from totals.
  useEffect(() => {
    if (!onRulesChange) return;
    const totalDiscount = rules
      .filter(r => r.isApplied)
      .reduce((s, r) => s + (r.type === 'discount' ? r.amount : -r.amount), 0);
    const appliedCount = rules.filter(r => r.isApplied).length;
    onRulesChange(totalDiscount, appliedCount);
  }, [rules, onRulesChange]);

  if (!isOpen) return null;

  /* Per-rule shipment lock — at Partially Shipped the SO has some lines
     marked shipped. Any rule whose appliedTo intersects those lines is
     locked individually (no kebab, no per-item toggle) because the deal
     for those line items is closed. The global `readOnly` (Shipped)
     supersedes this. */
  const shippedSet = new Set(shippedLineIds ?? []);
  const isRuleShipmentLocked = (rule: PricingRule): boolean => {
    if (shippedSet.size === 0) return false;
    return rule.appliedTo.some((id) => shippedSet.has(id));
  };

  const totalImpact = rules
    .filter(r => r.isApplied)
    .reduce((s, r) => s + (r.type === 'discount' ? -r.amount : r.amount), 0);
  const appliedRulesCount = rules.filter(r => r.isApplied).length;
  const uniqueItemCount = new Set(rules.filter(r => r.isApplied).flatMap(r => r.appliedTo)).size;

  // Unapply (don't delete) — keeps the row in the list, grayed out.
  const unapplyRule = (id: string, reason: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' = 'USER_UNAPPLIED') => {
    const target = rules.find(r => r.id === id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, isApplied: false, unappliedReason: reason } : r));
    if (expandedRuleId === id) setExpandedRuleId(null);
    if (reason === 'USER_UNAPPLIED' && target?.isApplied) {
      /* Revert path — re-activate the rule if the user backs out
         of the version prompt. */
      onMaterialEvent?.(
        `Deactivated pricing rule "${target.name}"`,
        () => pricingAPI.reactivateRule(id),
      );
    }
  };

  // Re-apply — clears reason and flips isApplied=true, subject to the SO cap.
  const reapplyRule = (id: string) => {
    const target = rules.find(r => r.id === id);
    setRules(prev => {
      const rule = prev.find(r => r.id === id);
      if (!rule) return prev;
      const incremental = rule.type === 'discount' ? rule.amount : 0;
      const exceeds = wouldExceedSoCap(incremental);
      if (exceeds) {
        toast.warning('Cannot activate — would exceed 100% of SO subtotal.');
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

  // Legacy delete-rule path (still wired into "Remove rule completely" inside
  // the Update modal). Re-route to unapply per spec — manually unapplied stays in list.
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
      return { ...r, appliedTo: nextAppliedTo, amount: recomputeRuleAmount(ruleId, nextAppliedTo) };
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

  /* Recompute a rule's $ impact given a new appliedTo set. Walks the
     selected lines through evaluateRuleForLine so tiered rules pick the
     right bracket per line (not just the first tier's flat rate). */
  const recomputeRuleAmount = (ruleId: string, newAppliedTo: string[]): number => {
    const customerRule = CUSTOMER_PRICING_RULES_BY_ID.get(ruleId);
    if (!customerRule) return 0;
    let sum = 0;
    for (const lineId of newAppliedTo) {
      const ln = lines.find((l) => l.id === lineId);
      if (!ln) continue;
      const ev = evaluateRuleForLine(customerRule, ln, ruleMoney.factor);
      if (ev.applies) sum += ev.amount;
    }
    return Math.round(sum);
  };

  // Direct toggle — no "Edit Items" step needed
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
      return { ...r, appliedTo: newAppliedTo, amount: recomputeRuleAmount(ruleId, newAppliedTo) };
    }));
  };

  // Reconcile selection from PricingRulesLibrary modal back to local rules state.
  // Library returns the full selected list — keep rules whose IDs are still selected
  // (preserving their per-item allocations) and add newly-selected ones with default
  // applied-to (all line items).
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
    const amount = isFixed ? Math.round(numericValue * ruleMoney.factor) : Math.round(applicableSubtotal * (numericValue / 100));
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
      // Existing rules still selected — keep their isApplied state, but if a previously
      // unapplied (USER_UNAPPLIED) rule is re-selected via library, treat as re-apply.
      const kept = prev
        .filter((r) => selectedIds.has(r.id))
        .map((r) => (r.isApplied ? r : { ...r, isApplied: true, unappliedReason: undefined as undefined }));

      // New rules — cap-aware application.
      let runningDiscount = kept
        .filter(r => r.isApplied && r.type === 'discount')
        .reduce((s, r) => s + r.amount, 0);
      const newOnes = libRules
        .filter((lr) => !prev.some((r) => r.id === lr.id))
        .map(libraryToLocal)
        .map((nr) => {
          const incremental = nr.type === 'discount' ? nr.amount : 0;
          const exceeds = soSubtotal > 0 && (runningDiscount + incremental) > soSubtotal;
          if (!exceeds) runningDiscount += incremental;
          return exceeds
            ? { ...nr, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' as const }
            : nr;
        });

      // Existing rules NOT in selection → user unapplied via library. Keep in list.
      const unapplied = prev
        .filter((r) => !selectedIds.has(r.id))
        .map((r) => ({ ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const }));

      const next = [...kept, ...newOnes, ...unapplied];

      // Sync ruleDisplayItems for new rules (default = appliedTo)
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
      // Inline styles only — guarantees full-viewport overlay + centered modal
      // regardless of any ancestor className/transform context. Backdrop /
      // shadow / radius mirror the Pricing Rules Library modal so summary
      // and library feel like one product.
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
          /* Smoothly animate the Full view transition. */
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), height 220ms cubic-bezier(0.4, 0, 0.2, 1), min-height 220ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 220ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — order-scoped, mirrors library chrome but reframed
            (this modal shows rules applied to THIS order; the library
            modal handles customer-level rules). ─ */}
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
                  Pricing Rules on this Order
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                  style={{ fontWeight: 600, color: '#065F46', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}
                >
                  Active
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {customerName ? `These pricing rules are applied to this order for ${customerName}.` : 'These pricing rules are applied to this order.'}
              </p>
            </div>
          </div>

          {/* Right: count + Manage Customer Pricing Rules + X close */}
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

        {/* Content — slate-50 wrapper so cards sit on the same gray as the library. */}
        <div className="flex-1 overflow-y-auto bg-slate-50" style={{ padding: '16px 20px', scrollbarWidth: 'thin' }}>
          {/* Pricing rule grid — Partner-style cards. Mirrors the Quote
              module's PricingRulesManageModal: deactivated rules stay in
              the list (rendered dimmed) so the user can reactivate them
              in place. Auto-deactivated rows (EXCEEDS_100_PERCENT) are
              hidden from the summary; the user controls those from the
              line-item configurator. */}
          {(() => {
            const visibleRules = rules.filter(
              (r) => r.isApplied || r.unappliedReason === 'USER_UNAPPLIED',
            );
            if (visibleRules.length === 0) {
              return (
                <div className="h-full flex items-center justify-center px-6 py-12">
                  <EmptyPlaceholder
                    icon={Tag}
                    title="No pricing rules on this order yet"
                    description="Open the customer pricing library to apply rules — or leave it empty for a custom order."
                    actionLabel={!readOnly ? 'Manage Customer Pricing Rules' : undefined}
                    onAction={!readOnly ? () => setLibraryOpen(true) : undefined}
                  />
                </div>
              );
            }
            return (
              /* Library-style 2-column grid (auto-fill from 280px wide) so
                 each rule shows as a fixed-height card matching the look
                 of the Pricing Rules Library. Cards expand inline to
                 reveal the per-item activate/deactivate panel. */
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}
              >
                {visibleRules.map((rule) => {
                  const shipmentLocked = isRuleShipmentLocked(rule);
                  return (
                    <SummaryRuleCard
                      key={rule.id}
                      rule={rule}
                      onOpenItemsModal={() => setItemsModalRule(rule)}
                      onDeactivate={() => setUnapplyConfirm({ ruleId: rule.id, name: rule.name })}
                      onReactivate={() => setReapplyConfirm({ ruleId: rule.id, name: rule.name })}
                      readOnly={readOnly || shipmentLocked}
                      shipmentLocked={shipmentLocked}
                      totalLineCount={items.length}
                    />
                  );
                })}
              </div>
            );
          })()}
          {/* Legacy grid — preserved for reference but unreachable. */}
          {false && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
          {rules.map((rule) => {
            const isExpanded = expandedRuleId === rule.id;
            const isDiscount = rule.type === 'discount';
            const isUnapplied = !rule.isApplied;

            // Grayed-out treatment for unapplied rows: muted icon backgrounds,
            // muted text, muted dividers. Keep icon glyph (TrendingUp/Down) so
            // type stays scannable.
            const iconBg = isUnapplied ? '#F3F4F6' : (isDiscount ? '#ECFDF5' : '#FEF2F2');
            const iconColor = isUnapplied ? '#9CA3AF' : (isDiscount ? '#059669' : '#DC2626');
            const nameColor = isUnapplied ? '#9CA3AF' : '#1F2937';
            const amountColor = isUnapplied ? '#9CA3AF' : (isDiscount ? '#059669' : '#DC2626');
            const cardBorder = isUnapplied ? '#E5E7EB' : (isExpanded ? '#DBEAFE' : '#E5E7EB');
            const cardBg = isUnapplied ? '#FAFAFA' : (isExpanded ? '#FBFDFF' : '#FFFFFF');

            return (
              <div
                key={rule.id}
                style={{
                  borderWidth: '1px', borderStyle: 'solid',
                  borderColor: cardBorder,
                  borderRadius: '10px',
                  // Expanded cards stretch across both grid columns; grid
                  // gap handles spacing so no marginBottom.
                  gridColumn: isExpanded ? '1 / -1' : 'auto',
                  marginBottom: 0,
                  backgroundColor: cardBg,
                  boxShadow: isExpanded ? '0 4px 14px -6px rgba(15, 23, 42, 0.10)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                  transition: 'all 150ms',
                }}
              >
                {/* Rule header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', cursor: 'pointer',
                  }}
                  onClick={() => !isUnapplied && setExpandedRuleId(isExpanded ? null : rule.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      backgroundColor: iconBg,
                    }}>
                      {isDiscount
                        ? <TrendingDown style={{ width: '14px', height: '14px', color: iconColor }} />
                        : <TrendingUp style={{ width: '14px', height: '14px', color: iconColor }} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: nameColor, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rule.name}
                        </div>
                        {isUnapplied && (
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                            Unapplied
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.2', marginTop: '2px' }}>
                        {rule.appliedTo.length} item{rule.appliedTo.length !== 1 ? 's' : ''} · {ruleValueText(ruleMoney, rule)}
                      </div>
                      {/* Applicability condition badge — hidden when unapplied; show reason instead */}
                      {!isUnapplied && rule.condition && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          marginTop: '3px', padding: '1px 6px',
                          borderRadius: '3px', fontSize: '10px', fontWeight: 500, lineHeight: '1.4',
                          backgroundColor: rule.condition.status === 'fully_applied' ? '#ECFDF5'
                            : rule.condition.status === 'threshold_met' ? '#EFF6FF'
                            : '#FFFBEB',
                          color: rule.condition.status === 'fully_applied' ? '#059669'
                            : rule.condition.status === 'threshold_met' ? '#1D4ED8'
                            : '#B45309',
                        }}>
                          {rule.condition.status === 'fully_applied'
                            ? <CheckCircle2 style={{ width: '9px', height: '9px' }} />
                            : rule.condition.status === 'threshold_met'
                              ? <CheckCircle2 style={{ width: '9px', height: '9px' }} />
                              : <AlertTriangle style={{ width: '9px', height: '9px' }} />
                          }
                          {rule.condition.label}
                        </div>
                      )}
                      {isUnapplied && rule.unappliedReason === 'EXCEEDS_100_PERCENT' && (
                        <div style={{ fontSize: '10px', fontWeight: 500, color: '#B45309', marginTop: '3px' }}>
                          Exceeds 100% of SO subtotal — unapplied automatically
                        </div>
                      )}
                      {isUnapplied && rule.unappliedReason === 'USER_UNAPPLIED' && (
                        <div style={{ fontSize: '10px', fontWeight: 400, color: '#6B7280', marginTop: '3px' }}>
                          Manually unapplied — click the re-apply icon to restore
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 600, color: amountColor,
                      textDecoration: isUnapplied ? 'line-through' : undefined,
                    }}>
                      {isDiscount ? '-' : '+'}{fmtCurrency(rule.amount)}
                    </span>
                    {!readOnly && (
                      isUnapplied ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); reapplyRule(rule.id); }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          title="Activate rule"
                        >
                          <CirclePlus style={{ width: '14px', height: '14px', color: '#1B6EF3' }} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setUnapplyConfirm({ ruleId: rule.id, name: rule.name }); }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF3C7'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          title="Deactivate rule"
                        >
                          <CircleSlash style={{ width: '14px', height: '14px', color: '#B45309' }} />
                        </button>
                      )
                    )}
                    {!isUnapplied && (
                      isExpanded
                        ? <ChevronUp style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                        : <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                    )}
                  </div>
                </div>

                {/* Expanded: item list — always toggleable, no "Edit Items" step */}
                {isExpanded && (
                  <div style={{
                    padding: '0 12px 10px',
                    borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#F3F4F6',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Applied to Items
                      </span>
                      {!readOnly && (
                        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                          click to toggle
                        </span>
                      )}
                    </div>

                    <div style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                      {/* Show items that have ever been applied to this rule (keeps unchecked items visible) */}
                      {(ruleDisplayItems[rule.id] || rule.appliedTo).map((itemId, idx) => {
                        const item = items.find(i => i.id === itemId);
                        if (!item) return null;
                        const itemAppliedToRule = rule.appliedTo.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            style={{
                              borderTopWidth: idx > 0 ? '1px' : '0', borderTopStyle: 'solid', borderTopColor: '#F3F4F6',
                            }}
                          >
                            <CompactItemRow
                              item={item}
                              checked={itemAppliedToRule}
                              onToggle={!readOnly ? () => handleToggleItem(rule.id, item.id) : undefined}
                              showCheckbox={!readOnly}
                              trailing={
                                <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
                                  {fmtCurrency(item.subtotal)}
                                </span>
                              }
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Update/Remove action */}
                    {!readOnly && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowUpdateModal(rule.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', fontWeight: 500, color: '#1B6EF3',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                            borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          Update
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
          )}

          {/* Cap-hit notice — surfaced inline (the Library CTA itself
              now lives in the header so this bottom dashed button is
              gone). */}
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

        {/* Footer — bg-white border-t, Partner footer grammar. Rule
            count reads *applied* rules (toggling a rule off reduces
            it); the modal title already carries the total on this
            quote, so surfacing that same number here again would be
            redundant. */}
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
                      // Apply to this quote only
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
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>This Quote Only</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Keep customer defaults unchanged</div>
                  </button>
                  
                  <button
                    onClick={() => {
                      // Apply to customer record
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
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DBEAFE'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
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
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.borderColor = '#FCA5A5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Full Pricing Rule Presets library — opened from "Add Pricing Rule from Library" */}
      <PricingRulesLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        readOnly={readOnly}
        // Only seed the picker with rules that are currently applied — unapplied
        // entries stay in the manage list (grayed out) but shouldn't appear
        // pre-selected in the library.
        appliedRuleIds={rules.filter(r => r.isApplied).map(r => r.id)}
        onApply={(libRule) => {
          if (stageLibraryChanges) {
            /* Post-draft: library edits the customer's rule book, not
               this SO. Current rules + totals stay intact. A new draft
               (when created) will inherit the updated customer rules. */
            toast.info(`"${libRule.name}" applied to the customer rule book. Current SO is unaffected — the next draft will inherit it.`);
            return;
          }
          // Already on the list (Custom card) — flip back to active.
          const existing = rules.find(r => r.name.toLowerCase() === libRule.name.toLowerCase());
          if (existing) {
            setRules(prev => prev.map(r => r.id === existing.id
              ? { ...r, isApplied: true, unappliedReason: undefined }
              : r,
            ));
            toast.success(`"${libRule.name}" reactivated.`);
            return;
          }
          // New rule — add it via the existing array-shaped helper.
          handleApplyFromLibrary([libRule]);
          /* Inform the user the new rule isn't auto-attached to any
             line item yet (we keep behaviour simple by not auto-matching). */
          toast.info(`"${libRule.name}" applied at the SO level. It isn't attached to any line item yet — open a line to assign.`);
        }}
        /* Library kebab actions — pre-draft these propagate to the summary
           carousel so a rule deactivated in the library is also greyed out
           / removed on the SO. Post-draft they edit the customer rule
           book only. Library ids don't match host `rules` ids, so we
           match by rule name. */
        onDeactivateRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" deactivated in the customer rule book. Current SO is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setRules(prev => prev.map(r => r.name.toLowerCase() === nm ? { ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const } : r));
        }}
        onActivateRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" activated in the customer rule book. Current SO is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setRules(prev => prev.map(r => r.name.toLowerCase() === nm ? { ...r, isApplied: true, unappliedReason: undefined } : r));
        }}
        onRemoveRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" removed from the customer rule book. Current SO is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setRules(prev => prev.filter(r => r.name.toLowerCase() !== nm));
        }}
        customerName={customerName || "Customer"}
        /* Only show rules that are actually part of this SO's pricing
           rules — avoids Partner-mock orphans. */
        restrictToNames={rules.map(r => r.name)}
        /* Convert the host's SO-shape rules into library shape so they
           appear as Custom cards in the library grid. The library merges
           these with Partner v5 templates so users can both manage their
           applied rules AND browse for new ones to Apply. */
        customRules={rules.map((r): LibraryPricingRule => ({
          id: r.id,
          ruleNo: r.id,
          name: r.name,
          category: r.type,
          basis: r.condition?.type === 'volume' ? 'volume' : 'value',
          tierType: 'single',
          totalTiers: 1,
          description: r.condition?.label ?? `${ruleValueText(ruleMoney, r)} ${r.type === 'discount' ? 'off' : 'markup'}`,
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
          tiers: [{ minQty: '—', maxQty: '—', discount: ruleMoney.tierRate({ rate: r.value, unit: r.amountType }) }],
          createdBy: 'You',
          createdDate: '',
          isPreset: false,
          items: [],
          categories: [],
          partners: [],
        }))}
      />

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

      {/* Per-rule Reactivate Confirmation — mirrors Quote's PricingRulesManageModal */}
      <ConfirmationModal
        isOpen={!!reapplyConfirm}
        title={reapplyConfirm ? `Reactivate "${reapplyConfirm.name}"?` : ''}
        message={(() => {
          if (!reapplyConfirm) return '';
          const r = rules.find((x) => x.id === reapplyConfirm.ruleId);
          const n = r?.appliedTo.length ?? 0;
          return `It will be reactivated and applied to ${n} line item${n !== 1 ? 's' : ''} on this order.`;
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

      {/* Per-item activate/deactivate confirmation — covers both single
          and bulk toggles from the rule card's expanded items panel.
          zIndex={12300} sits above the items sub-modal (12250). */}
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
            ? `The rule will start firing on the selected line item${itemToggleConfirm.itemIds.length !== 1 ? 's' : ''} and contribute to this SO's totals.`
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

      {/* Per-rule items sub-modal — opens from a card click. Shows every
          item the rule has ever touched and lets the user activate or
          deactivate the rule per-item (single or bulk). All mutations go
          through the itemToggleConfirm flow above. */}
      {itemsModalRule && (() => {
        /* The state holds the snapshot rule at open-time. Read the LIVE
           rule from the rules array on every render so the sub-modal's
           card / status / pill / count all update immediately after a
           confirmed toggle. */
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
            shippedLineIds={shippedLineIds}
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
 * SummaryRuleCard — library-style rule card for the Pricing Rules
 * Manage modal. Replaces the old horizontal carousel card.
 *
 * Chrome mirrors the Library card (Discount/Volume pill, CUSTOM marker,
 * 13px name, 11px description, 22px hero value, Active/Deactivated pill,
 * MoreVertical kebab with Deactivate/Reactivate rule actions). Clicking
 * the body toggles an inline accordion that lists every line item the
 * rule has ever covered. Each item has a checkbox to enable/disable the
 * rule for that line; a header strip exposes "Select all" / "Deselect
 * all" so users can bulk-toggle.
 *
 * Toggling (single OR bulk) opens a ConfirmationModal in the parent
 * before mutating `appliedTo` — keeps the destructive intent explicit
 * and matches the rest of the SO/Quote module's confirm-before-action
 * pattern.
 * ──────────────────────────────────────────────────────────────────── */
function SummaryRuleCard({ rule, onOpenItemsModal, onDeactivate, onReactivate, readOnly, shipmentLocked = false, totalLineCount }: {
  rule: PricingRule;
  /** Open the per-rule items sub-modal where the user can activate /
   *  deactivate the rule on individual line items. */
  onOpenItemsModal: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  readOnly: boolean;
  /** Set when the rule is locked specifically because at least one of its
   *  items has shipped — distinguishes the cause from the global readOnly
   *  flag so the UI can render a "Locked — Shipped" pill. */
  shipmentLocked?: boolean;
  /** Total number of real SO lines — used for the "X / Y items" footer
   *  count. Passed from the parent so the card doesn't reach into the
   *  old mock LINE_ITEMS constant. */
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
  const ruleMoney = useRuleMoney();
  const heroValue = ruleMoney.tierShort({ rate: rule.value, unit: rule.amountType });
  const dimStyle: React.CSSProperties = isDeactivated
    ? { opacity: 0.55, transition: 'opacity 150ms' }
    : { opacity: 1, transition: 'opacity 150ms' };
  /* Three states: Locked (shipment) > Deactivated > Active. */
  const statusPill = shipmentLocked
    ? { color: '#374151', bg: '#F3F4F6', border: '#D1D5DB', label: 'Locked — Shipped' }
    : isDeactivated
      ? { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', label: 'Deactivated' }
      : { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', label: 'Active' };
  /* Unified frame — same flat color on the outer border and the
     tinted strip carrying the "Applied to N of M" label, so the
     card reads as one rounded shape with a white window inside.
     Locked and Deactivated states fall back to a neutral palette. */
  const framePalette = (shipmentLocked || isDeactivated)
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
        if (isDeactivated || shipmentLocked) return;
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
        {/* Row 1: Discount/Value segmented pill (left) · Status + CUSTOM badge (right) */}
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

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1" style={dimStyle}>
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
            {rule.name}
          </p>
        </div>

        {/* Row 3: Description — full 2-line slot for the condition
            label. The Applied count moved into the footer strip. */}
        <div className="h-[32px] shrink-0 mb-2" style={dimStyle}>
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2" style={{ fontWeight: 400 }}>
            {rule.condition?.label ?? ''}
          </p>
        </div>

        {/* Row 4: Hero value (left) · VALID / Always active (right) */}
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

        {/* Row 5: Tier detail row — pinned at bottom, mirrors Partner */}
        <div className="mt-auto pt-2 shrink-0" style={dimStyle}>
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <span className="text-slate-500 truncate" style={{ fontWeight: 400 }}>
              {rule.condition?.threshold ?? '—'}
            </span>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>
              {heroValue}
              {/* A "$" tier is USD; its amount in the order's currency. */}
              {ruleMoney.tierConverted({ rate: rule.value, unit: rule.amountType }) && (
                <span className="text-slate-400" style={{ fontWeight: 500 }}> ({ruleMoney.tierConverted({ rate: rule.value, unit: rule.amountType })})</span>
              )}
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
 *
 * Partner-faithful chrome: white header with avatar + name + segmented
 * pill + close button (rounded-lg), slate-50 body wrapper, white table
 * card inside, slate-50 footer. Table columns mirror the Partner
 * pricing-rule items table at a lightweight density: Part Number,
 * Description (with thumb), Type (Serialized / Non-Serialized), Qty,
 * Total, and a right-aligned status pill that toggles per-item
 * activation through the parent ConfirmationModal.
 *
 * Bulk selection: leftmost checkbox column drives a transient
 * `selectedIds` set. When non-empty, the toolbar morphs into a
 * Cycle-Count-style bulk action bar ("N items selected" + divider +
 * Activate / Deactivate / Esc-to-clear) matching the Quotes / SO
 * listing pattern.
 * ──────────────────────────────────────────────────────────────────── */
function RuleItemsSubModal({ rule, allItems, onClose, onRequestToggle, readOnly, shippedLineIds }: {
  rule: PricingRule;
  allItems: ModalLineItem[];
  onClose: () => void;
  onRequestToggle: (itemIds: string[], willActivate: boolean) => void;
  readOnly: boolean;
  /** Items in this set can't be toggled — their qty already shipped, so
   *  the rule on those lines is locked in place. Visible in the table so
   *  the user can see why they're greyed out. */
  shippedLineIds?: string[];
}) {
  const fmtCurrency = useDocWhole();
  const ruleMoney = useRuleMoney();
  const shippedSet = useMemo(() => new Set(shippedLineIds ?? []), [shippedLineIds]);
  const isShipped = (id: string) => shippedSet.has(id);
  /* Scope the visible table to the items the rule touches at open time
     (snapshot of rule.appliedTo). Toggling within the modal can flip
     items between Activated/Deactivated, but the row stays in scope so
     the user can re-activate without closing. The card count outside
     stays in sync with rule.appliedTo.length naturally. Re-opening the
     modal refreshes the snapshot. */
  const [scopedItemIds] = useState<Set<string>>(() => new Set(rule.appliedTo));
  const scopedItems = useMemo(
    () => allItems.filter((i) => scopedItemIds.has(i.id)),
    [allItems, scopedItemIds],
  );
  // Transient row selection for bulk actions. Independent of `appliedTo`.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Lock body scroll + Esc to close or clear selection.
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
  /* Select-all and the header checkbox only operate on toggleable rows
     — shipped rows are excluded so a fully-shipped scope renders the
     master checkbox in a disabled-looking inactive state. */
  const toggleableItems = useMemo(() => scopedItems.filter((i) => !isShipped(i.id)), [scopedItems, shippedSet]);
  const allSelected = toggleableItems.length > 0 && toggleableItems.every((i) => selectedIds.has(i.id));
  const someSelected = !allSelected && toggleableItems.some((i) => selectedIds.has(i.id));

  // Per-item Impact $ — same formula as the rule's total (rate * subtotal).
  const impactFor = (subtotal: number) =>
    rule.amountType === '%' ? Math.round(subtotal * (rule.value / 100)) : Math.round(rule.value * ruleMoney.factor);

  /* Split selected ids by current rule state. Drives state-aware bulk
     buttons — Activate only fires on items currently deactivated;
     Deactivate only on items currently activated. */
  /* Shipped items can neither be activated nor deactivated — the rule on
     those line items is locked. Filter them out of the bulk-action sets
     so the action bar only counts toggleable rows. */
  const selectedActiveIds = useMemo(
    () => Array.from(selectedIds).filter((id) => activeIdSet.has(id) && !isShipped(id)),
    [selectedIds, activeIdSet, shippedSet],
  );
  const selectedInactiveIds = useMemo(
    () => Array.from(selectedIds).filter((id) => !activeIdSet.has(id) && !isShipped(id)),
    [selectedIds, activeIdSet, shippedSet],
  );

  const toggleRow = (id: string) => {
    if (isShipped(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    /* Select-all skips shipped rows — they can't take any bulk action. */
    const toggleable = scopedItems.filter((i) => !isShipped(i.id));
    setSelectedIds((prev) => (prev.size === toggleable.length ? new Set() : new Set(toggleable.map((i) => i.id))));
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
        {/* ── Header (Partner-faithful) ───────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-border">
          <div className="px-5 pt-3 pb-3 flex items-start gap-3">
            {/* Themed avatar */}
            <div
              className="w-[44px] h-[44px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5 mt-0.5"
              style={{ backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
            >
              {isDis
                ? <TrendingDown className="w-3.5 h-3.5" style={{ color: pill.text }} />
                : <TrendingUp className="w-3.5 h-3.5" style={{ color: pill.text }} />}
              <span className="text-[10px] tabular-nums leading-none" style={{ color: pill.text, fontWeight: 700 }}>
                {ruleValueText(ruleMoney, rule)}
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
                Activate or deactivate this rule per line item on this order.
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

        {/* ── Body (slate-50 wrapper around white table card) ──────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
          {/* Toolbar — morphs into bulk action bar when rows are selected */}
          {/* Toolbar — section heading stays anchored on the left. When
              rows are selected, the bulk action group (selection count +
              Activate/Deactivate buttons) appears on the right. Esc
              closes the modal directly; clearing the selection is done
              by deselecting checkboxes. */}
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
                {/* Deactivate — destructive white-outline (Partner pattern).
                    Rendered first so it sits to the left of the primary
                    Activate button, matching destructive-then-primary
                    button ordering used elsewhere in the app. */}
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

          {/* Table card */}
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
                        This rule is not applied to any line items on this order.
                      </td>
                    </tr>
                  ) : (
                    scopedItems.map((item) => {
                      const isActive = activeIdSet.has(item.id);
                      const isSelected = selectedIds.has(item.id);
                      const cellBorder = '1px solid #EEF2F6';
                      const rowShipped = isShipped(item.id);
                      /* Index reflects the row's position in the source SO
                         lines list (allItems), not the scoped subset, so
                         opening different rules shows the line's true
                         position on the order. Zero-padded to 3 digits. */
                      const indexInSource = allItems.findIndex((i) => i.id === item.id) + 1;
                      const indexLabel = String(indexInSource).padStart(3, '0');
                      return (
                        <tr
                          key={item.id}
                          className="group hover:bg-[#F8FAFC]"
                          style={{
                            backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                            transition: 'background-color 120ms',
                            opacity: rowShipped ? 0.6 : 1,
                          }}
                        >
                          <td className="pl-4 pr-2 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                            {!readOnly && !rowShipped && (
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
                                  main SO line-items grid. Falls back to
                                  the deterministic tint if the image
                                  errors so the row never renders a blank
                                  square. */}
                              <img
                                src={getLineItemImage(item.itemCode)}
                                alt=""
                                className="w-6 h-6 rounded-md shrink-0 object-cover"
                                style={{ backgroundColor: item.thumbColor }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                                }}
                              />
                              <span className="text-[12px] text-slate-700 tabular-nums truncate" style={{ fontWeight: 500 }} title={item.itemCode}>
                                {item.itemCode}
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
                                SO line-items grid so both surfaces
                                read as one system. */}
                            <ItemTypeBadge type={item.type} />
                          </td>
                          {/* Item-master status, its own column so it can't be
                              read as the rule's Activated / Deactivated state in
                              the Status column. */}
                          <td className="px-3 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                            <InactiveItemPill code={item.itemCode} variant="badge" showActive />
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
                            {rowShipped ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10.5px] border"
                                style={{
                                  fontWeight: 500,
                                  color: '#374151',
                                  backgroundColor: '#F3F4F6',
                                  borderColor: '#D1D5DB',
                                }}
                                title="This line has already shipped — the rule is locked here."
                              >
                                Shipped — Locked
                              </span>
                            ) : !readOnly ? (
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

        {/* ── Footer — total impact summary aligned right; Close button
            removed since the header X (and Esc) already close the modal. */}
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

/* Horizontal carousel wrapper for the active-rules grid. Adds:
     - a thin always-visible scrollbar so the surface looks scrollable
     - left/right chevron buttons (auto-show when there's overflow)
     - edge fade gradients on the sides when content extends past view */
function CarouselWithChevronsSO({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [children]);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // ── Drag-to-scroll (mouse) ──────────────────────────────────────
  const dragState = useRef<{ active: boolean; startX: number; startScroll: number; moved: boolean }>({
    active: false, startX: 0, startScroll: 0, moved: false,
  });
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragState.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 3) st.moved = true;
    el.scrollLeft = st.startScroll - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st.active) return;
    st.active = false;
    setIsDragging(false);
    try { scrollerRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragState.current.moved = false;
    }
  };

  return (
    // 36px gutters reserve space for the chevrons so they never sit on top
    // of a card. Drag-to-scroll is the primary interaction; chevrons + edge
    // fades are secondary affordances for desktop discoverability.
    <div style={{ position: 'relative', marginBottom: 8, padding: '0 36px' }}>
      <div
        ref={scrollerRef}
        className="scrollbar-hide"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 4,
          paddingTop: 2,
          scrollSnapType: isDragging ? 'none' : 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        {children}
      </div>

      {canScrollLeft && (
        <div
          aria-hidden
          style={{
            position: 'absolute', left: 36, top: 0, bottom: 4, width: 24,
            background: 'linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))',
            pointerEvents: 'none',
          }}
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden
          style={{
            position: 'absolute', right: 36, top: 0, bottom: 4, width: 24,
            background: 'linear-gradient(to left, #FFFFFF, rgba(255,255,255,0))',
            pointerEvents: 'none',
          }}
        />
      )}

      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-260)}
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            boxShadow: '0 2px 6px rgba(15,23,42,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 2,
          }}
        >
          <ChevronLeft style={{ width: 14, height: 14, color: '#475569' }} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(260)}
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            boxShadow: '0 2px 6px rgba(15,23,42,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 2,
          }}
        >
          <ChevronRight style={{ width: 14, height: 14, color: '#475569' }} />
        </button>
      )}
    </div>
  );
}

/* Partner-style pricing rule card — verbatim copy of Partner Management's
   Explore Presets card chrome. Same two-segment Type/Basis pill on the left,
   CUSTOM badge + kebab menu on the right, slate-700 name + scope, neutral
   slate-700 hero value with "off"/"markup" suffix, and a Partner impact row.
   When the rule is user-deactivated the *content* (pill, name, hero value,
   impact row) dims; the kebab + dropdown stay full opacity so Reactivate
   is always readable and clickable. */
function PartnerRuleCardSO({ rule, onDeactivate, onReactivate, readOnly }: {
  rule: PricingRule;
  onDeactivate: () => void;
  onReactivate?: () => void;
  readOnly: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDis = rule.type === 'discount';
  const isDeactivated = !rule.isApplied;
  const pill = isDis
    ? { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5' }
    : { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' };
  const basis = rule.condition?.type === 'volume' ? 'Volume' : 'Value';
  const fmtCurrency = useDocWhole();
  const ruleMoney = useRuleMoney();
  const heroValue = ruleMoney.tierShort({ rate: rule.value, unit: rule.amountType });

  const dimStyle: React.CSSProperties = isDeactivated
    ? { opacity: 0.45, transition: 'opacity 150ms' }
    : { opacity: 1, transition: 'opacity 150ms' };

  return (
    <div
      className="group"
      style={{
        position: 'relative',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'border-color 150ms, box-shadow 150ms',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 14,
      }}
      onMouseEnter={(e) => { if (!isDeactivated) { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
    >
      {/* Row 1: combined Type/Basis pill + kebab — CUSTOM badge removed for
          the Summary modal so the kebab sits flush to the card edge.
          The pill gets the dim treatment when the card is deactivated;
          the kebab stays at full opacity below. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'stretch', borderRadius: 999, overflow: 'hidden',
            border: `1px solid ${pill.border}`, flexShrink: 0,
            ...dimStyle,
          }}
        >
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', fontSize: 10, fontWeight: 600,
              color: pill.text, backgroundColor: pill.bg, lineHeight: 1,
            }}
          >
            {isDis ? <TrendingDown style={{ width: 11, height: 11 }} /> : <TrendingUp style={{ width: 11, height: 11 }} />}
            {isDis ? 'Discount' : 'Premium'}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', fontSize: 10, fontWeight: 500,
              backgroundColor: '#FFFFFF', color: '#64748B',
              borderLeft: `1px solid ${pill.border}`, lineHeight: 1,
            }}
          >
            {basis}
          </span>
        </span>
          {!readOnly && (
            <div style={{ position: 'relative', flexShrink: 0, marginRight: -4 }}>
              <button
                type="button"
                aria-label="Rule options"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#94A3B8', transition: 'background-color 100ms, color 100ms',
                  padding: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#1F2937'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
              >
                <MoreVertical style={{ width: 14, height: 14 }} />
              </button>
              {menuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 1 }}
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute', top: 28, right: 0, zIndex: 2,
                      minWidth: 180,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                      padding: 4,
                    }}
                  >
                    {isDeactivated ? (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onReactivate?.(); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 6,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 13, fontWeight: 500, color: '#0A77FF',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onDeactivate(); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 6,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 13, fontWeight: 500, color: '#1F2937',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <CircleSlash style={{ width: 14, height: 14, color: '#64748B' }} />
                        Deactivate
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', lineHeight: 1.3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...dimStyle }}>
        {rule.name}
      </p>
      <p style={{ fontSize: 11, fontWeight: 400, color: '#64748B', lineHeight: 1.5, margin: '4px 0 0 0', ...dimStyle }}>
        Applied to {rule.appliedTo.length} item{rule.appliedTo.length !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12, ...dimStyle }}>
        <span
          style={{
            fontSize: 22, fontWeight: 600, lineHeight: 1,
            color: '#334155', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {heroValue}
        </span>
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
          {isDis ? 'off' : 'markup'}
        </span>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 10, padding: '6px 10px',
          border: '1px solid #E8ECF1', backgroundColor: '#FAFBFC',
          borderRadius: 8, fontSize: 11, fontVariantNumeric: 'tabular-nums',
          ...dimStyle,
        }}
      >
        <span style={{ color: '#64748B', fontWeight: 400 }}>Impact</span>
        <span style={{ color: isDis ? '#047857' : '#6D28D9', fontWeight: 600 }}>
          {isDis ? '-' : '+'}{fmtCurrency(rule.amount)}
        </span>
      </div>
    </div>
  );
}