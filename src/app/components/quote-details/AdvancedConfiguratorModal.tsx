// @ts-nocheck
import { useState } from 'react';
import {
  X, Plus, Pencil, Percent, DollarSign, Settings2, ArrowUpDown,
  Calendar, Layers, TrendingDown, TrendingUp, CheckCircle2, AlertCircle,
  Infinity as InfinityIcon, User, MinusCircle, RotateCcw, ShoppingCart, Tag, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdjustmentFormModal } from '../shared/AdjustmentFormModal';
import type { AdjustmentFormData, AdjustmentAttachment } from '../shared/AdjustmentFormModal';
import { EmptyPlaceholder } from '../shared/EmptyPlaceholder';
import { PricingRulePresetModal } from '../shared/PricingRulePresetModal';
import { getDefaultRuleValidity, type PricingRulePreset } from '../shared/pricingRulePresets';
import { ConfirmationModal } from '../ConfirmationModal';
import { TitledSection } from '../shared/TitledSection';

interface PricingRule {
  id: string;
  /** Source preset id when materialised from a template — empty for custom one-off rules. */
  presetId?: string;
  name: string;
  type: 'discount' | 'premium';
  value: number;
  amountType: '%' | '$';
  /** Validity window — inherited from the preset; editable inline. */
  validFrom?: string;
  validTo?: string;
  /** Whether this rule originated from a system preset (read-only metadata). */
  isPreset?: boolean;
  /** Value-based vs volume-based — preserved from the source preset. */
  basis?: 'value' | 'volume';
  /** Single-tier vs multi-tier — preserved from the source preset. */
  tierType?: 'single' | 'multiple';
  /** Number of tiers in the source preset (display only). */
  totalTiers?: number;
  /** Currently active tier index (0-based). Used for the "T{n} of {total}" pill. */
  appliedTier?: number;
  /** Whether the rule's condition is currently satisfied for this line. When
   *  false, the row renders in the Partner "Not Applied" red theme and shows
   *  `conditionReason` below the rule name. Default true. */
  conditionMet?: boolean;
  /** Short reason surfaced when the rule isn't currently applied — e.g.,
   *  "Requires min. 3 units", "Min. order value $50,000 met", etc. */
  conditionReason?: string;
  /** Scope chip text — defaults to "Customer default". Mirrors Partner's
   *  scope pill (Customer / Vendor / Customer default). */
  scope?: string;
  /** Original preset description for context. */
  description?: string;
  /** Whether this rule contributes to the line's pricing. When false, the
   *  rule stays in the list (greyed-out) but is skipped by all calculations.
   *  Defaults to true. */
  isApplied?: boolean;
  /** Why a rule isn't applied — drives the inline reason text on greyed
   *  rows. `USER_UNAPPLIED` = the user manually unapplied via the confirm
   *  modal. `EXCEEDS_100_PERCENT` = the rule was auto-unapplied because
   *  applying it would push total discounts past 100% of the item subtotal. */
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
}

/* Accent palette per rule state. State precedence:
   1. isApplied === false → muted/greyed treatment (kept in list, doesn't
      contribute to math). Sub-strokes (border, dividers, secondary text)
      all read as disabled.
   2. conditionMet === false → red Partner "Not Applied" theme (rule is
      applied in spirit but its condition isn't satisfied yet).
   3. type === "discount" → green theme.
   4. type === "premium" → violet/purple theme.
   The same shape is reused for one-time adjustments via `adjustmentAccent`. */
function ruleAccent(rule: { type: 'discount' | 'premium'; conditionMet?: boolean; isApplied?: boolean }) {
  if (rule.isApplied === false) {
    /* Greyed-out state — uses the existing muted/disabled tokens so manual
       and auto-unapplied rows look the same. Borders, dividers, icon, name,
       and impact all flatten to slate-400 / slate-100. */
    return {
      bar: '#CBD5E1',
      iconBg: '#F1F5F9',
      iconFg: '#94A3B8',
      name: '#94A3B8',
      impact: '#94A3B8',
      pillBg: '#F8FAFC',
      pillBorder: '#E2E8F0',
      pillFg: '#94A3B8',
      muted: true as const,
    };
  }
  if (rule.conditionMet === false) {
    return {
      bar: '#EF4444',
      iconBg: '#FEE2E2',
      iconFg: '#DC2626',
      name: '#991B1B',
      impact: '#DC2626',
      pillBg: '#FEF2F2',
      pillBorder: '#FECACA',
      pillFg: '#991B1B',
      muted: false as const,
    };
  }
  if (rule.type === 'discount') {
    return {
      bar: '#10B981',
      iconBg: '#ECFDF5',
      iconFg: '#047857',
      name: '#0F172A',
      impact: '#047857',
      pillBg: '#F8FAFC',
      pillBorder: 'var(--border)',
      pillFg: '#475569',
      muted: false as const,
    };
  }
  return {
    bar: '#8B5CF6',
    iconBg: '#F5F3FF',
    iconFg: '#6D28D9',
    name: '#0F172A',
    impact: '#6D28D9',
    pillBg: '#F8FAFC',
    pillBorder: 'var(--border)',
    pillFg: '#475569',
    muted: false as const,
  };
}

/* Human-readable text for the unappliedReason — rendered inline on greyed
   rows so the user understands why a row isn't contributing. */
function unappliedReasonText(reason: PricingRule['unappliedReason'] | undefined, scope: 'item' | 'quote' = 'item'): string | null {
  if (reason === 'EXCEEDS_100_PERCENT') {
    return scope === 'quote'
      ? 'Auto-unapplied — would exceed 100% of quote subtotal'
      : 'Auto-unapplied — would exceed 100% of item price';
  }
  if (reason === 'USER_UNAPPLIED') {
    return 'Unapplied — kept in list, click to re-apply';
  }
  return null;
}

interface OneTimeAdjustment {
  id: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  label: string;
  internalNotes?: string;
  attachments?: AdjustmentAttachment[];
  /** Whether this adjustment contributes to the line's pricing — same
   *  semantics as PricingRule.isApplied. */
  isApplied?: boolean;
  /** Why an adjustment is unapplied — same semantics as
   *  PricingRule.unappliedReason. */
  unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
}

interface ConfiguratorItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  subtotal: number;
  pricingRules: PricingRule[];
  oneTimeAdjustments: OneTimeAdjustment[];
}

interface AdvancedConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConfiguratorItem;
  onSave: (updatedItem: ConfiguratorItem) => void;
  /** Customer name on the parent quote — forwarded to the pricing-rule preset
   *  modal so the subtitle can convey that rules apply to a customer–item
   *  pair, not the item alone. Optional; falls back to a generic subtitle. */
  customerName?: string;
  /** Parent quote id — forwarded to AdjustmentFormModal so the
   *  internal-notes textarea surfaces the link-picker affordance
   *  backed by the shared linksRepository. Optional so legacy call
   *  sites keep working. */
  docId?: string;
  /** Current user, used to attribute inline-added links. */
  currentUser?: string;
}

/** Convert the first tier's discount string ("10%" / "$25") into a value+amountType pair
 *  for the configurator's internal rule shape. Multi-tier rules collapse to the first
 *  tier's value here — the preserved metadata (tierType, totalTiers) signals that the
 *  full breakdown lives in the source preset. */
function presetToConfiguratorRule(preset: PricingRulePreset): PricingRule {
  const firstTier = preset.tiers[0];
  const raw = (firstTier?.discount ?? '0').trim();
  const isPercent = raw.endsWith('%');
  const numeric = parseFloat(raw.replace(/[^0-9.\-]/g, '')) || 0;
  const validity = getDefaultRuleValidity();
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    presetId: preset.id,
    name: preset.name,
    type: preset.category === 'discount' ? 'discount' : 'premium',
    value: numeric,
    amountType: isPercent ? '%' : '$',
    validFrom: validity.validFrom,
    validTo: validity.validTo,
    isPreset: preset.isPreset ?? false,
    basis: preset.basis,
    tierType: preset.tierType,
    totalTiers: preset.totalTiers,
    appliedTier: 0,
    /* New rules default to "Active" — host can flip conditionMet=false later
       once tier-vs-line evaluation is wired. */
    conditionMet: true,
    scope: 'Customer default',
    description: preset.description,
    isApplied: true,
  };
}

// ── Adjustment Row Card (read-only display with hover actions) ──
function AdjustmentRowCard({ adj, impact, formatCurrency, onEdit, onUnapply, onReapply }: {
  adj: OneTimeAdjustment;
  impact: number;
  formatCurrency: (n: number) => string;
  onEdit: () => void;
  onUnapply: () => void;
  onReapply: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDeduct = adj.type === 'discount';
  const hasNotes = adj.internalNotes && adj.internalNotes.trim().length > 0;
  const isApplied = adj.isApplied !== false;
  /* TrendingUp for premium adjustments, TrendingDown for discounts —
     mirrors the partner module's icon convention (only spec-allowed
     pattern-match from partner). */
  const DirectionIcon = isDeduct ? TrendingDown : TrendingUp;
  const reasonText = !isApplied ? unappliedReasonText(adj.unappliedReason) : null;
  /* Greyed token set when the adjustment is unapplied — matches the rule
     row's muted treatment so users see one consistent state across both
     surfaces. */
  const tone = !isApplied
    ? { name: '#94A3B8', value: '#94A3B8', chipBg: '#F1F5F9', chipFg: '#94A3B8', border: '#E2E8F0', bg: '#FAFBFC' }
    : isDeduct
      ? { name: 'var(--foreground)', value: '#047857', chipBg: '#ECFDF5', chipFg: '#047857', border: 'var(--border)', bg: hovered ? '#F8FAFC' : '#FFFFFF' }
      : { name: 'var(--foreground)', value: '#6D28D9', chipBg: '#F5F3FF', chipFg: '#6D28D9', border: 'var(--border)', bg: hovered ? '#F8FAFC' : '#FFFFFF' };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '6px',
        border: `1px solid ${tone.border}`,
        backgroundColor: tone.bg,
        transition: 'background-color 150ms',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
      }}>
        <span
          style={{
            width: '22px', height: '22px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: tone.chipBg, color: tone.chipFg,
            flexShrink: 0,
          }}
          title={isDeduct ? 'Discount' : 'Premium'}
        >
          <DirectionIcon style={{ width: '12px', height: '12px' }} />
        </span>
        <span style={{
          flex: 1,
          fontSize: '13px',
          color: tone.name,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {adj.label}
        </span>
        {!isApplied && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#991B1B',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: '1',
              letterSpacing: '0.02em',
              textTransform: 'uppercase' as const,
              flexShrink: 0,
            }}
          >
            Inactive
          </span>
        )}
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: tone.value,
          minWidth: '60px',
          textAlign: 'right',
          lineHeight: '1',
          flexShrink: 0,
        }}>
          {isDeduct ? '-' : '+'}{formatCurrency(impact)}
        </span>
        {/* Hover actions — Edit + Unapply (or Re-apply when not applied).
            The destructive remove-from-list affordance is gone: we keep the
            row in the list either way and let the user re-apply later. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 100ms',
        }}>
          <button
            onClick={onEdit}
            title="Edit adjustment"
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)',
              borderRadius: '4px', transition: 'color 100ms, background-color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Pencil style={{ width: '12px', height: '12px' }} />
          </button>
          <button
            onClick={isApplied ? onUnapply : onReapply}
            title={isApplied ? 'Deactivate adjustment' : 'Activate adjustment'}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
              color: isApplied ? 'var(--muted-foreground)' : 'var(--primary)',
              borderRadius: '4px', transition: 'color 100ms, background-color 100ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = isApplied ? '#DC2626' : '#0D5ED7';
              e.currentTarget.style.backgroundColor = isApplied ? '#FEF2F2' : 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isApplied ? 'var(--muted-foreground)' : 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isApplied
              ? <MinusCircle style={{ width: '13px', height: '13px' }} />
              : <RotateCcw style={{ width: '12px', height: '12px' }} />}
          </button>
        </div>
      </div>
      {/* Inline cap reason — only when unapplied */}
      {reasonText && (
        <div style={{
          padding: '0 12px 8px 42px',
          fontSize: '11px',
          color: adj.unappliedReason === 'EXCEEDS_100_PERCENT' ? '#B91C1C' : '#64748B',
          fontWeight: 500,
        }}>
          {reasonText}
        </div>
      )}
      {/* Internal notes shown inline below the main row */}
      {hasNotes && (
        <div style={{
          padding: '0 12px 7px 12px',
          marginTop: '-2px',
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
            fontStyle: 'italic',
            lineHeight: '1.4',
            paddingLeft: '34px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {adj.internalNotes}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdvancedConfiguratorModal({ isOpen, onClose, item, onSave, customerName, docId, currentUser }: AdvancedConfiguratorModalProps) {
  const [rules, setRules] = useState<PricingRule[]>(item.pricingRules);
  const [adjustments, setAdjustments] = useState<OneTimeAdjustment[]>(item.oneTimeAdjustments);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<OneTimeAdjustment | null>(null);

  /* Unapply-confirmation state — opens the existing ConfirmationModal when the
     user clicks the minus-circle on an applied row. The pending entity is
     resolved on confirm. We track entity kind ("rule" | "adjustment") so the
     same modal can drive both surfaces with one shared confirm flow. */
  const [unapplyTarget, setUnapplyTarget] = useState<
    | { kind: 'rule'; id: string; name: string }
    | { kind: 'adjustment'; id: string; name: string }
    | null
  >(null);

  /* Only *applied* rules count towards the preset library's "already applied"
     state — an unapplied row stays in the list but the user is free to apply
     the same preset again from the library if they choose. */
  const appliedPresetIds = new Set(
    rules.filter((r) => r.isApplied !== false).map((r) => r.presetId).filter(Boolean) as string[],
  );

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const calcRuleImpact = (rule: PricingRule): number => {
    if (rule.amountType === '%') {
      return (item.subtotal * rule.value) / 100;
    }
    return rule.value;
  };

  const calcAdjImpact = (adj: OneTimeAdjustment): number => {
    if (adj.amountType === '%') {
      return (item.subtotal * adj.amount) / 100;
    }
    return adj.amount;
  };

  /* All math skips entries where isApplied === false. Unapplied rows still
     render (greyed out) so the user can re-apply, but they don't contribute
     to discount, premium, or final-total calculations. */
  const totalDiscounts = rules
    .filter(r => r.type === 'discount' && r.isApplied !== false)
    .reduce((sum, r) => sum + calcRuleImpact(r), 0)
    + adjustments
      .filter(a => a.type === 'discount' && a.isApplied !== false)
      .reduce((sum, a) => sum + calcAdjImpact(a), 0);

  const totalPremiums = rules
    .filter(r => r.type === 'premium' && r.isApplied !== false)
    .reduce((sum, r) => sum + calcRuleImpact(r), 0)
    + adjustments
      .filter(a => a.type === 'premium' && a.isApplied !== false)
      .reduce((sum, a) => sum + calcAdjImpact(a), 0);

  const finalTotal = item.subtotal - totalDiscounts + totalPremiums;

  /* 100% discount cap — total *applied* discounts cannot exceed the item
     subtotal. `discountHeadroom` is what's left under the cap; when it hits
     zero, no further discount-type rules or one-time discounts may be added
     (premiums are unaffected). */
  const discountHeadroom = Math.max(0, item.subtotal - totalDiscounts);
  const atDiscountCap = discountHeadroom <= 0;
  /** Returns the impact of a hypothetical NEW discount entity, used by the
   *  cap check before adding from the library / saving an adjustment form. */
  const projectedImpactOfNewDiscount = (amount: number, amountType: '%' | '$') => {
    return amountType === '%' ? (item.subtotal * amount) / 100 : amount;
  };

  const handleApplyPreset = (preset: PricingRulePreset) => {
    if (appliedPresetIds.has(preset.id)) {
      toast.info(`"${preset.name}" is already applied`);
      return;
    }
    const newRule = presetToConfiguratorRule(preset);
    /* If the preset is a discount and applying it would push total discounts
       past 100% of the item subtotal, accept the rule into the list but mark
       it auto-unapplied. The row will render greyed out with the cap reason
       so the user can see *why* it didn't take effect. */
    if (newRule.type === 'discount') {
      const projected = projectedImpactOfNewDiscount(newRule.value, newRule.amountType);
      if (projected > discountHeadroom + 0.0001) {
        const flagged: PricingRule = { ...newRule, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' };
        setRules([...rules, flagged]);
        toast.warning(`"${preset.name}" added but auto-unapplied — would exceed 100% of item price`);
        setShowPresetModal(false);
        return;
      }
    }
    setRules([...rules, newRule]);
    toast.success(`"${preset.name}" applied`);
    setShowPresetModal(false);
  };

  /* Replace the destructive "remove" with an unapply flow:
       click minus-circle → confirm → set isApplied=false (kept in list).
     Calculations skip unapplied rows; the row renders greyed-out so the user
     can re-apply it later. */
  const requestUnapplyRule = (id: string) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return;
    setUnapplyTarget({ kind: 'rule', id, name: r.name });
  };
  const requestUnapplyAdjustment = (id: string) => {
    const a = adjustments.find((x) => x.id === id);
    if (!a) return;
    setUnapplyTarget({ kind: 'adjustment', id, name: a.label });
  };

  const confirmUnapply = () => {
    if (!unapplyTarget) return;
    if (unapplyTarget.kind === 'rule') {
      setRules((prev) =>
        prev.map((r) => (r.id === unapplyTarget.id ? { ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' } : r)),
      );
    } else {
      setAdjustments((prev) =>
        prev.map((a) => (a.id === unapplyTarget.id ? { ...a, isApplied: false, unappliedReason: 'USER_UNAPPLIED' } : a)),
      );
    }
    toast.info(`"${unapplyTarget.name}" unapplied — kept in list, re-apply anytime`);
    setUnapplyTarget(null);
  };

  /* Re-apply flips isApplied back on. We re-run the cap check at this point
     since the cap headroom may have shrunk since the row was last applied;
     if the re-apply would push us over 100%, we flag with EXCEEDS_100_PERCENT
     instead of falsely marking it active. */
  const reapplyRule = (id: string) => {
    const target = rules.find((r) => r.id === id);
    if (!target) return;
    if (target.type === 'discount') {
      const projected = calcRuleImpact(target);
      if (projected > discountHeadroom + 0.0001) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' } : r)),
        );
        toast.warning(`"${target.name}" still exceeds 100% of item price — kept unapplied`);
        return;
      }
    }
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isApplied: true, unappliedReason: undefined } : r)),
    );
    toast.success(`"${target.name}" re-applied`);
  };
  const reapplyAdjustment = (id: string) => {
    const target = adjustments.find((a) => a.id === id);
    if (!target) return;
    if (target.type === 'discount') {
      const projected = calcAdjImpact(target);
      if (projected > discountHeadroom + 0.0001) {
        setAdjustments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' } : a)),
        );
        toast.warning(`"${target.label}" still exceeds 100% of item price — kept unapplied`);
        return;
      }
    }
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isApplied: true, unappliedReason: undefined } : a)),
    );
    toast.success(`"${target.label}" re-applied`);
  };

  const updateRule = (id: string, field: keyof PricingRule, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addAdjustment = () => {
    setShowAdjustmentForm(true);
  };

  const updateAdjustment = (id: string, field: keyof OneTimeAdjustment, value: any) => {
    setAdjustments(adjustments.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSave = () => {
    onSave({
      ...item,
      pricingRules: rules,
      oneTimeAdjustments: adjustments,
      total: finalTotal,
    });
    onClose();
  };

  const handleAdjustmentFormSave = (formData: AdjustmentFormData) => {
    if (editingAdjustment) {
      // Edit mode — recheck cap if the user moved a row past 100% by editing
      // its amount. If so, auto-unapply the edited row.
      setAdjustments(adjustments.map(a => {
        if (a.id !== editingAdjustment.id) return a;
        const next: OneTimeAdjustment = {
          ...a,
          label: formData.label,
          type: formData.type,
          amountType: formData.amountType,
          amount: formData.amount,
          internalNotes: formData.internalNotes,
          attachments: formData.attachments,
        };
        if (next.type === 'discount' && next.isApplied !== false) {
          // Compare the edited row's projected impact against the headroom
          // available with this row excluded from the running total.
          const headroomExcludingThis = discountHeadroom + (a.isApplied !== false && a.type === 'discount' ? calcAdjImpact(a) : 0);
          const projected = projectedImpactOfNewDiscount(next.amount, next.amountType);
          if (projected > headroomExcludingThis + 0.0001) {
            next.isApplied = false;
            next.unappliedReason = 'EXCEEDS_100_PERCENT';
            toast.warning(`"${next.label}" auto-unapplied — would exceed 100% of item price`);
          }
        }
        return next;
      }));
      setEditingAdjustment(null);
      toast.success(`"${formData.label}" updated`);
    } else {
      // Add mode — block-by-auto-unapply on cap exceed for new discounts.
      const newAdj: OneTimeAdjustment = {
        id: `adj-${Date.now()}`,
        type: formData.type,
        amountType: formData.amountType,
        amount: formData.amount,
        label: formData.label,
        internalNotes: formData.internalNotes,
        attachments: formData.attachments,
        isApplied: true,
      };
      if (newAdj.type === 'discount') {
        const projected = projectedImpactOfNewDiscount(newAdj.amount, newAdj.amountType);
        if (projected > discountHeadroom + 0.0001) {
          newAdj.isApplied = false;
          newAdj.unappliedReason = 'EXCEEDS_100_PERCENT';
          setAdjustments([...adjustments, newAdj]);
          setShowAdjustmentForm(false);
          toast.warning(`"${formData.label}" added but auto-unapplied — would exceed 100% of item price`);
          return;
        }
      }
      setAdjustments([...adjustments, newAdj]);
      setShowAdjustmentForm(false);
      toast.success(`"${formData.label}" added`);
    }
  };

  const openEditAdjustment = (adj: OneTimeAdjustment) => {
    setEditingAdjustment(adj);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--background)',
          borderRadius: '12px',
          width: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.16)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pencil style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.2' }}>
                Advanced Configurator
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 400, lineHeight: '1', marginTop: '3px' }}>
                {item.productId} &middot; {item.productName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Base Info — Partner TitledSection chrome */}
          <TitledSection title="Base Info" icon={ShoppingCart}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                  QTY x PRICE
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                  SUBTOTAL
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                  {formatCurrency(item.subtotal)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                  NET TOTAL
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--foreground)', lineHeight: '1' }}>
                  {formatCurrency(finalTotal)}
                </div>
              </div>
            </div>
          </TitledSection>

          {/* Pricing Rules */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                  PRICING RULES
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'var(--muted)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    lineHeight: '1',
                  }}
                >
                  {rules.length}
                </span>
              </div>
              <button
                onClick={() => setShowPresetModal(true)}
                title={atDiscountCap ? 'Item is at the 100% discount cap — only premiums can be added until headroom returns' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  lineHeight: '1',
                }}
              >
                <Plus style={{ width: '12px', height: '12px' }} />
                Apply from Library
              </button>
            </div>

            {/* At-cap banner — surfaced when total *applied* discounts have hit
                100% of the item subtotal. Premiums are unaffected; further
                discount rules / one-time discounts will be auto-unapplied
                with the EXCEEDS_100_PERCENT reason. */}
            {atDiscountCap && (
              <div style={{
                marginBottom: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <AlertCircle style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400E', lineHeight: 1.3 }}>
                    100% discount cap reached
                  </div>
                  <div style={{ fontSize: '11px', color: '#92400E', marginTop: '2px', lineHeight: 1.4, opacity: 0.85 }}>
                    Total applied discounts already equal this item's subtotal. New discounts will be auto-unapplied until headroom returns. Premiums are still allowed.
                  </div>
                </div>
              </div>
            )}

            {rules.length === 0 ? (
              <EmptyPlaceholder
                icon={Tag}
                title="No pricing rules on this item"
                description="Apply a rule from the customer's library, or leave this item at standard pricing."
                actionLabel="Manage Pricing Rules"
                onAction={() => setShowPresetModal(true)}
                compact
                borderless
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules.map((rule) => {
                  const isDiscount = rule.type === 'discount';
                  const conditionMet = rule.conditionMet !== false;
                  const isApplied = rule.isApplied !== false;
                  const accent = ruleAccent(rule);
                  /* Direction icon — premiums show TrendingUp, discounts show
                     TrendingDown. This is the only place the spec asks us to
                     mirror the partner module's icon convention. */
                  const DirectionIcon = isDiscount ? TrendingDown : TrendingUp;
                  const expiryLabel = rule.validTo && rule.validTo.trim() ? `Until ${rule.validTo}` : 'No expiry';
                  const tierLabel = rule.totalTiers && rule.totalTiers > 0
                    ? `T${(rule.appliedTier ?? 0) + 1} of ${rule.totalTiers}`
                    : null;
                  const reasonText = !isApplied ? unappliedReasonText(rule.unappliedReason) : (!conditionMet ? rule.conditionReason : null);
                  return (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      borderRadius: '8px',
                      border: `1px solid ${accent.muted ? '#E2E8F0' : 'var(--border)'}`,
                      backgroundColor: accent.muted ? '#FAFBFC' : '#FFFFFF',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Left accent bar — green / purple / red / muted slate per state */}
                    <div style={{ width: '3px', backgroundColor: accent.bar, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Row 1: direction icon + name + Not Applied pill + value editor + impact + unapply/re-apply */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '22px', height: '22px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: accent.iconBg, color: accent.iconFg,
                            flexShrink: 0,
                          }}
                          title={isDiscount ? 'Discount' : 'Premium'}
                        >
                          <DirectionIcon style={{ width: '13px', height: '13px' }} />
                        </span>
                        <input
                          value={rule.name}
                          onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                          style={{
                            flex: 1,
                            fontSize: '13px',
                            color: accent.name,
                            fontWeight: 600,
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            minWidth: 0,
                          }}
                        />
                        {!conditionMet && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#991B1B',
                              backgroundColor: '#FEF2F2',
                              border: '1px solid #FECACA',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              lineHeight: '1',
                              letterSpacing: '0.02em',
                              textTransform: 'uppercase' as const,
                              flexShrink: 0,
                            }}
                          >
                            Not Applied
                          </span>
                        )}
                        {rule.isPreset && (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              color: '#475569',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              lineHeight: '1',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase' as const,
                              flexShrink: 0,
                            }}
                            title="System template — value and tiers come from the rule library"
                          >
                            Template
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
                          <input
                            type="number"
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, 'value', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '52px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--foreground-soft)',
                              outline: 'none',
                              fontFamily: 'Inter, system-ui, sans-serif',
                            }}
                          />
                          <button
                            onClick={() => updateRule(rule.id, 'amountType', rule.amountType === '%' ? '$' : '%')}
                            style={{
                              width: '36px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '1px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: 'var(--muted-foreground)',
                              fontWeight: 600,
                            }}
                            title={`Switch to ${rule.amountType === '%' ? 'dollar' : 'percentage'}`}
                          >
                            {rule.amountType === '%' ? <Percent style={{ width: '11px', height: '11px' }} /> : <DollarSign style={{ width: '11px', height: '11px' }} />}
                            <ArrowUpDown style={{ width: '8px', height: '8px', color: 'var(--muted-foreground)' }} />
                          </button>
                        </div>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: accent.impact,
                            minWidth: '64px',
                            textAlign: 'right',
                            lineHeight: '1',
                            flexShrink: 0,
                          }}
                        >
                          {isDiscount ? '-' : '+'}{formatCurrency(calcRuleImpact(rule))}
                        </span>
                        {/* Unapply / re-apply button.
                            Applied rows: minus-in-circle. Click → opens the
                              shared ConfirmationModal with copy explaining
                              the row will be kept in the list, just greyed.
                            Unapplied rows: rotate-ccw to flip the row back
                              to active. Re-apply is reversible so it skips
                              the confirm modal but still re-runs the cap
                              check. */}
                        <button
                          onClick={() => (isApplied ? requestUnapplyRule(rule.id) : reapplyRule(rule.id))}
                          title={isApplied ? 'Deactivate this rule' : 'Activate this rule'}
                          style={{
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: isApplied ? 'var(--muted-foreground)' : 'var(--primary)',
                            borderRadius: '4px',
                            flexShrink: 0,
                            transition: 'color 100ms, background-color 100ms',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = isApplied ? '#DC2626' : '#0D5ED7';
                            e.currentTarget.style.backgroundColor = isApplied ? '#FEF2F2' : 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = isApplied ? 'var(--muted-foreground)' : 'var(--primary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {isApplied
                            ? <MinusCircle style={{ width: '14px', height: '14px' }} />
                            : <RotateCcw style={{ width: '13px', height: '13px' }} />}
                        </button>
                      </div>

                      {/* Reason text — shows the unapplied cause (cap or
                          user) or the unmet-condition reason when applicable. */}
                      {reasonText && (
                        <div style={{
                          paddingLeft: '30px',
                          fontSize: '11.5px',
                          color: !isApplied ? (rule.unappliedReason === 'EXCEEDS_100_PERCENT' ? '#B91C1C' : '#64748B') : '#B91C1C',
                          fontWeight: 500,
                        }}>
                          {reasonText}
                        </div>
                      )}

                      {/* Row 2: assisting pills — Basis, Expiry, Tier, Scope */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap' as const,
                        paddingLeft: '30px',
                      }}>
                        {rule.basis && (
                          <Pill bg={accent.pillBg} border={accent.pillBorder} fg={accent.pillFg}>
                            {rule.basis === 'value' ? <DollarSign style={{ width: '10px', height: '10px', color: '#94A3B8' }} /> : <Layers style={{ width: '10px', height: '10px', color: '#94A3B8' }} />}
                            {rule.basis === 'value' ? 'Value' : 'Volume'}
                          </Pill>
                        )}
                        <Pill bg={accent.pillBg} border={accent.pillBorder} fg={accent.pillFg}>
                          {rule.validTo ? <Calendar style={{ width: '10px', height: '10px', color: '#94A3B8' }} /> : <InfinityIcon style={{ width: '11px', height: '11px', color: '#94A3B8' }} />}
                          {expiryLabel}
                        </Pill>
                        {tierLabel && (
                          <Pill bg={accent.pillBg} border={accent.pillBorder} fg={accent.pillFg}>
                            <Layers style={{ width: '10px', height: '10px', color: '#94A3B8' }} />
                            {tierLabel}
                          </Pill>
                        )}
                        <Pill bg={accent.pillBg} border={accent.pillBorder} fg={accent.pillFg}>
                          <User style={{ width: '10px', height: '10px', color: '#94A3B8' }} />
                          {rule.scope ?? 'Customer default'}
                        </Pill>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* One-Time Adjustments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                  ONE-TIME ADJUSTMENTS
                </span>
                {/* Scope pill so users can tell at-a-glance this one-time
                    affects only the current line, not the whole quote. The
                    quote-level counterpart sits in RightSidebar. */}
                <span
                  className="inline-flex items-center shrink-0 whitespace-nowrap"
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: '#475569',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    lineHeight: '1',
                  }}
                >
                  Item-Level
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'var(--muted)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    lineHeight: '1',
                  }}
                >
                  {adjustments.length}
                </span>
              </div>
              <button
                onClick={() => addAdjustment()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  lineHeight: '1',
                }}
              >
                <Plus style={{ width: '12px', height: '12px' }} />
                Add One-Time Discount/Premium
              </button>
            </div>

            {adjustments.length === 0 ? (
              <EmptyPlaceholder
                icon={Zap}
                title="No one-time discounts or premiums"
                description="Add a manual premium or discount that only applies to this item."
                actionLabel="Add One-Time Discount/Premium"
                onAction={() => addAdjustment()}
                compact
                borderless
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {adjustments.map((adj) => (
                  <AdjustmentRowCard
                    key={adj.id}
                    adj={adj}
                    impact={calcAdjImpact(adj)}
                    formatCurrency={formatCurrency}
                    onEdit={() => openEditAdjustment(adj)}
                    onUnapply={() => requestUnapplyAdjustment(adj.id)}
                    onReapply={() => reapplyAdjustment(adj.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Impact Summary */}
          <TitledSection title="Impact Summary" icon={TrendingUp}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 400, lineHeight: '1' }}>Subtotal</span>
                <span style={{ fontSize: '13px', color: 'var(--foreground-soft)', fontWeight: 500, lineHeight: '1' }}>{formatCurrency(item.subtotal)}</span>
              </div>
              {totalDiscounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 400, lineHeight: '1' }}>Discounts</span>
                  <span style={{ fontSize: '13px', color: 'var(--destructive)', fontWeight: 600, lineHeight: '1' }}>-{formatCurrency(totalDiscounts)}</span>
                </div>
              )}
              {totalPremiums > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 400, lineHeight: '1' }}>Premiums</span>
                  <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600, lineHeight: '1' }}>+{formatCurrency(totalPremiums)}</span>
                </div>
              )}
              <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 500, lineHeight: '1' }}>Net Total</span>
                <span style={{ fontSize: '16px', color: 'var(--foreground)', fontWeight: 700, lineHeight: '1' }}>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </TitledSection>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              lineHeight: '1',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              height: '32px',
              padding: '0 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              cursor: 'pointer',
              lineHeight: '1',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Adjustment Form Modal */}
      {showAdjustmentForm && (
        <AdjustmentFormModal
          mode="add"
          scope="item"
          onSave={(data) => {
            handleAdjustmentFormSave(data);
          }}
          onCancel={() => setShowAdjustmentForm(false)}
          docId={docId}
          currentUser={currentUser}
        />
      )}

      {editingAdjustment && (
        <AdjustmentFormModal
          mode="edit"
          scope="item"
          initial={{
            id: editingAdjustment.id,
            label: editingAdjustment.label,
            type: editingAdjustment.type,
            amountType: editingAdjustment.amountType,
            amount: editingAdjustment.amount,
            scope: 'item',
            internalNotes: editingAdjustment.internalNotes,
            attachments: editingAdjustment.attachments,
            internalNoteLinks: (editingAdjustment as any).internalNoteLinks,
          }}
          onSave={(data) => {
            handleAdjustmentFormSave(data);
          }}
          onCancel={() => setEditingAdjustment(null)}
          docId={docId}
          currentUser={currentUser}
        />
      )}

      {/* Pricing rule preset library — ported from Partner Management. The user
          toggles a preset card's Active pill to apply or remove it on the line.
          presetToConfiguratorRule carries validity, basis, and tier metadata
          when applying; remove drops the matching rule by presetId. */}
      <PricingRulePresetModal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        // New library returns a richer PricingRule; the configurator's
        // handler still works against the leaner PricingRulePreset shape,
        // so route through onApplyLegacy.
        onApplyLegacy={(preset) => handleApplyPreset(preset as unknown as PricingRulePreset)}
        onRemove={(preset) => {
          /* Unapply by preset id rather than splicing the rule out of the
             list — the row stays in the configurator (greyed out) so the
             user can re-apply it later. */
          setRules((prev) =>
            prev.map((r) =>
              r.presetId === preset.id
                ? { ...r, isApplied: false, unappliedReason: 'USER_UNAPPLIED' }
                : r,
            ),
          );
          toast.info(`"${preset.name}" unapplied — kept in list, re-apply anytime`);
        }}
        appliedIds={appliedPresetIds}
        /* "Remove from Customer Pricing" — drops the rule entry entirely
           from this line's configurator state. Match by rule name since
           library + host use different ids. */
        onRemoveRule={(libRule) => {
          const nm = libRule.name.toLowerCase();
          setRules((prev) => prev.filter((r) => (r.name?.toLowerCase() ?? "") !== nm));
        }}
        customerName={customerName}
        /* Only surface rules attached to this configurator's line. */
        restrictToNames={rules.map((r) => r.name).filter((n): n is string => typeof n === "string" && n.length > 0)}
        itemName={item.productName}
      />

      {/* Shared unapply confirmation — opens for both rules and one-time
          adjustments. Copy makes clear the entry stays in the list and can
          be re-applied later, distinguishing this from a destructive remove. */}
      <ConfirmationModal
        isOpen={unapplyTarget !== null}
        title={unapplyTarget ? `Deactivate "${unapplyTarget.name}"?` : ''}
        message="You can reactivate it any time."
        confirmText="Deactivate"
        cancelText="Keep active"
        variant="yellow"
        icon={<MinusCircle className="w-6 h-6 text-white" />}
        onConfirm={confirmUnapply}
        onCancel={() => setUnapplyTarget(null)}
      />
    </div>
  );
}

/* Short metadata pill atom — Partner v7 reference style.
   Lifted verbatim from Partner Management's PartnerGroupDetailModal
   (the "partners linked" pill):
     `inline-flex items-center gap-1 px-2 py-0.5 rounded-full
      text-[10.5px] bg-slate-50 text-slate-600 border border-border`
     `fontWeight: 500`
   We keep the per-call `bg / border / fg` overrides so the row can
   tint pills red when the rule isn't applied, but the default shape
   is `rounded-full` to match Partner's chrome. */
function Pill({ bg, border, fg, children }: { bg: string; border: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px]"
      style={{
        fontWeight: 500,
        color: fg,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}