/* ═══════════════════════════════════════════════════════════════════════════
 *  usePricingRules — Quote module
 *  Owns the Quote's runtime pricing-rule state. Mirrors the SO equivalent.
 *  See Sales-Order-V5/src/app/components/so/usePricingRules.ts for design
 *  notes; the duplication is intentional because the two modules live in
 *  separate src trees and can't share a file across them.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import {
  CUSTOMER_PRICING_RULES,
  computeLineBreakdowns,
  computeQuoteSubtotal,
  getCustomerRules,
  lineIdsForRule,
  type CustomerPricingRule,
  type LinePricingBreakdown,
} from './pricingRulesData';

interface QuoteLineRef {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PricingRuleState {
  attached: CustomerPricingRule[];
  deactivatedRuleIds: Set<string>;
  activatedLineIdsByRule: Map<string, Set<string>>;
}

export interface PricingRulesAPI {
  state: PricingRuleState;
  breakdowns: LinePricingBreakdown[];
  quoteSubtotal: number;
  totalDiscount: number;
  totalPremium: number;
  activeRuleCount: number;
  deactivateRule: (ruleId: string) => void;
  reactivateRule: (ruleId: string) => void;
  setRuleActiveOnLines: (ruleId: string, lineIds: string[], active: boolean) => void;
  attachRuleFromLibrary: (ruleId: string) => void;
  detachRule: (ruleId: string) => void;
}

export function usePricingRules(customerName: string, lines: QuoteLineRef[]): PricingRulesAPI {
  const [state, setState] = useState<PricingRuleState>(() => {
    const attached = getCustomerRules(customerName);
    const activated = new Map<string, Set<string>>();
    for (const r of attached) activated.set(r.id, new Set(lineIdsForRule(r, lines)));
    return {
      attached,
      deactivatedRuleIds: new Set<string>(),
      activatedLineIdsByRule: activated,
    };
  });

  const effectiveActivationByRule = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of state.attached) {
      if (state.deactivatedRuleIds.has(r.id)) m.set(r.id, new Set());
      else m.set(r.id, state.activatedLineIdsByRule.get(r.id) ?? new Set());
    }
    return m;
  }, [state]);

  const breakdowns = useMemo(
    () => computeLineBreakdowns(lines, state.attached, effectiveActivationByRule),
    [lines, state.attached, effectiveActivationByRule],
  );
  const quoteSubtotal = useMemo(() => computeQuoteSubtotal(breakdowns), [breakdowns]);
  const totalDiscount = useMemo(() => breakdowns.reduce((s, b) => s + b.discountAmount, 0), [breakdowns]);
  const totalPremium = useMemo(() => breakdowns.reduce((s, b) => s + b.premiumAmount, 0), [breakdowns]);
  const activeRuleCount = useMemo(
    () => state.attached.filter((r) => !state.deactivatedRuleIds.has(r.id)).length,
    [state.attached, state.deactivatedRuleIds],
  );

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
      return { ...prev, attached: newAttached, activatedLineIdsByRule: newActivated, deactivatedRuleIds: newDeactivated };
    });

  return {
    state,
    breakdowns,
    quoteSubtotal,
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
