/* ═══════════════════════════════════════════════════════════════════════════
 *  usePricingRules
 *  ───────────────
 *  Owns the SO's runtime pricing-rule state: which customer rules are
 *  attached to this SO snapshot, which of those rules are active overall,
 *  and which line items each rule is activated on.
 *
 *  Both the summary modal and the line-item configurator subscribe to the
 *  same instance (lifted at the SODetail level) so an activate/deactivate
 *  from either surface shows up in the other immediately, and totals
 *  recompute on every change.
 *
 *  This hook does NOT mutate so.lines — it only carries the per-rule
 *  state plus the line breakdowns derived from the rules + lines.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import type { SOLine } from './types';
import {
  CUSTOMER_PRICING_RULES,
  computeLineBreakdowns,
  computeSOSubtotal,
  getCustomerRules,
  lineIdsForRule,
  type CustomerPricingRule,
  type LinePricingBreakdown,
} from './pricingRulesData';

/* ═══════════════════════════════════════════════════════════════════════════
 *  Per-SO state shape
 * ═══════════════════════════════════════════════════════════════════════════ */
export interface PricingRuleState {
  /** Rules attached to this SO. Initially populated from
   *  `getCustomerRules(customer)`; library Apply post-draft can grow this
   *  list (when the library is allowed to mutate current state — see the
   *  staging behavior in Phase 3). */
  attached: CustomerPricingRule[];
  /** Rules manually deactivated wholesale. A deactivated rule still
   *  appears in the summary list (grayed out) but contributes 0 to
   *  totals. */
  deactivatedRuleIds: Set<string>;
  /** Per-rule set of line ids the rule is activated on. The user can
   *  deactivate a rule on specific lines from the items sub-modal — those
   *  lines are removed from this set. */
  activatedLineIdsByRule: Map<string, Set<string>>;
}

export interface PricingRulesAPI {
  state: PricingRuleState;
  /** Per-line price breakdown reflecting current activation. */
  breakdowns: LinePricingBreakdown[];
  /** Sum of per-line totals — the SO subtotal after rule effects. */
  soSubtotal: number;
  /** Total saved by all currently-active discount rules. */
  totalDiscount: number;
  /** Total added by all currently-active premium rules. */
  totalPremium: number;
  /** Number of rules currently active (attached and not in deactivatedRuleIds). */
  activeRuleCount: number;

  /* Mutations */
  deactivateRule: (ruleId: string) => void;
  reactivateRule: (ruleId: string) => void;
  /** Apply (or remove) the rule on a specific set of lines. */
  setRuleActiveOnLines: (ruleId: string, lineIds: string[], active: boolean) => void;
  /** Library Apply (pre-draft): attach a rule from the customer rule book
   *  to the SO. Initial activation = every matching line. No-op if the
   *  rule is already attached. */
  attachRuleFromLibrary: (ruleId: string) => void;
  /** Library Remove (pre-draft): drop the rule from the SO entirely. */
  detachRule: (ruleId: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Hook
 * ═══════════════════════════════════════════════════════════════════════════ */
export function usePricingRules(
  customerName: string,
  lines: SOLine[],
  /** USD "$" tier amounts → the SO's currency (ruleAmountFactor). */
  flatFactor = 1,
): PricingRulesAPI {
  /* Seed: attach every customer rule and activate it on every matching line.
     The user can later deactivate per-rule or per-line. We compute the seed
     once via lazy initializer so re-renders don't reset the state.
     Note: line count/composition changes are NOT re-seeded into this state
     here — adding a new line after init won't auto-activate existing rules
     on it. That's intentional for the demo; a real impl would diff lines on
     change and decide per-product policy. */
  const [state, setState] = useState<PricingRuleState>(() => {
    const attached = getCustomerRules(customerName);
    const activated = new Map<string, Set<string>>();
    for (const r of attached) {
      activated.set(r.id, new Set(lineIdsForRule(r, lines)));
    }
    return {
      attached,
      deactivatedRuleIds: new Set<string>(),
      activatedLineIdsByRule: activated,
    };
  });

  /* Derived: per-rule activation considering both wholesale-deactivated
     rules and any line-scope toggling. */
  const effectiveActivationByRule = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of state.attached) {
      if (state.deactivatedRuleIds.has(r.id)) {
        m.set(r.id, new Set());
        continue;
      }
      m.set(r.id, state.activatedLineIdsByRule.get(r.id) ?? new Set());
    }
    return m;
  }, [state]);

  const breakdowns = useMemo(
    () => computeLineBreakdowns(lines, state.attached, effectiveActivationByRule, flatFactor),
    [lines, state.attached, effectiveActivationByRule, flatFactor],
  );
  const soSubtotal = useMemo(() => computeSOSubtotal(breakdowns), [breakdowns]);
  const totalDiscount = useMemo(() => breakdowns.reduce((s, b) => s + b.discountAmount, 0), [breakdowns]);
  const totalPremium = useMemo(() => breakdowns.reduce((s, b) => s + b.premiumAmount, 0), [breakdowns]);
  const activeRuleCount = useMemo(
    () => state.attached.filter((r) => !state.deactivatedRuleIds.has(r.id)).length,
    [state.attached, state.deactivatedRuleIds],
  );

  /* Mutations — every setter is pure (returns a new state object) so React
     batches and downstream useMemos invalidate correctly. */
  const deactivateRule = (ruleId: string) =>
    setState((prev) => {
      const next = new Set(prev.deactivatedRuleIds);
      next.add(ruleId);
      return { ...prev, deactivatedRuleIds: next };
    });

  const reactivateRule = (ruleId: string) =>
    setState((prev) => {
      const next = new Set(prev.deactivatedRuleIds);
      next.delete(ruleId);
      return { ...prev, deactivatedRuleIds: next };
    });

  const setRuleActiveOnLines = (ruleId: string, lineIds: string[], active: boolean) =>
    setState((prev) => {
      const next = new Map(prev.activatedLineIdsByRule);
      const current = new Set(next.get(ruleId) ?? []);
      lineIds.forEach((id) => (active ? current.add(id) : current.delete(id)));
      next.set(ruleId, current);
      return { ...prev, activatedLineIdsByRule: next };
    });

  const attachRuleFromLibrary = (ruleId: string) =>
    setState((prev) => {
      if (prev.attached.some((r) => r.id === ruleId)) return prev;
      const rule = CUSTOMER_PRICING_RULES.find((r) => r.id === ruleId);
      if (!rule) return prev;
      const newAttached = [...prev.attached, rule];
      const newActivated = new Map(prev.activatedLineIdsByRule);
      newActivated.set(rule.id, new Set(lineIdsForRule(rule, lines)));
      return { ...prev, attached: newAttached, activatedLineIdsByRule: newActivated };
    });

  const detachRule = (ruleId: string) =>
    setState((prev) => {
      const newAttached = prev.attached.filter((r) => r.id !== ruleId);
      const newActivated = new Map(prev.activatedLineIdsByRule);
      newActivated.delete(ruleId);
      const newDeactivated = new Set(prev.deactivatedRuleIds);
      newDeactivated.delete(ruleId);
      return {
        ...prev,
        attached: newAttached,
        activatedLineIdsByRule: newActivated,
        deactivatedRuleIds: newDeactivated,
      };
    });

  return {
    state,
    breakdowns,
    soSubtotal,
    totalDiscount,
    totalPremium,
    activeRuleCount,
    deactivateRule,
    reactivateRule,
    setRuleActiveOnLines,
    attachRuleFromLibrary,
    detachRule,
  };
}
