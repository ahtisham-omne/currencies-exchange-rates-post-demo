import * as React from "react";
import { Lock } from "lucide-react";
import { InfoTooltip } from "@/app/components/ui/info-tooltip";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, moneyPrefix } from "@/app/currency/money";
import { formatMoneyWithCode } from "@/app/currency/partnerAmounts";
import { RATE_TYPE_LABEL } from "@/app/currency/rates";
import {
  RULE_CURRENCY,
  RULE_CURRENCY_NOTE,
  RULE_CURRENCY_TOOLTIP,
  baseRateSentence,
  formatRuleAmount,
  ruleDocumentExample,
  ruleExampleCurrency,
  ruleTiersFromForm,
  type RuleFormTier,
  type RuleTierLike,
} from "@/app/currency/pricingRuleCurrency";
import type { RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyFlag";

/* ── A pricing rule's currency ────────────────────────────────────────
 * Rules are created in the base currency, with no currency pick (Currency
 * Touchpoints Map, Partners §6). Where a rule is created, edited or viewed
 * the currency shows read-only: "Currency  PKR · base currency  [Locked]". */

export function RuleCurrencyField({ height = "h-9", showInfo = true }: { height?: string; showInfo?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Currency</label>
        {showInfo && (
          <InfoTooltip>
            {RULE_CURRENCY_TOOLTIP}
          </InfoTooltip>
        )}
      </div>
      <div
        className={`${height} px-3 rounded-lg border border-border bg-muted/40 flex items-center gap-2 text-[13px] text-foreground cursor-default`}
        aria-readonly="true"
        title={`${RULE_CURRENCY}, the base currency. Rules are always created in it.`}
      >
        <CurrencyFlag code={RULE_CURRENCY} />
        <span style={{ fontWeight: 600 }}>{RULE_CURRENCY}</span>
        <span className="text-slate-500 truncate">· base currency</span>
        <span
          className="ml-auto inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border border-slate-200 bg-white text-slate-500 shrink-0"
          style={{ fontWeight: 600 }}
        >
          <Lock className="w-2.5 h-2.5" /> Locked
        </span>
      </div>
    </div>
  );
}

/** The line beside the Currency field. */
export function RuleCurrencyNote() {
  return <p className="self-end pb-2 text-[11px] text-slate-400 leading-snug">{RULE_CURRENCY_NOTE}</p>;
}

/** "$3,000" for a whole amount, "$2,512.50" otherwise. */
function exampleTotalText(value: number, code: string): string {
  if (Math.abs(value - Math.round(value)) < 1e-9) return `${moneyPrefix(code)}${Math.round(value).toLocaleString("en-US")}`;
  return formatMoney(value, code);
}

function ExampleHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>{children}</span>
      <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-px" style={{ fontWeight: 600 }}>Example</span>
    </div>
  );
}

/**
 * How a value-based rule meets a document in a partner's currency, as the
 * spec's worked example lays it out: "On a USD PO for $3,000", the same in
 * base at the document's rate, the threshold check, then the adjustment back
 * in the document's currency. Figures are an example at today's rate of the
 * partner's default exchange rate.
 */
export function RuleDocumentExampleCard({
  tiers,
  currency,
  rateType,
  category,
  documentLabel = "PO",
}: {
  tiers: RuleTierLike[];
  currency: string;
  rateType: RateType;
  category: "discount" | "premium";
  /** What the document is called in the heading: "On a USD PO for $3,000". */
  documentLabel?: string;
}) {
  const ex = ruleDocumentExample(tiers, currency, rateType);
  if (!ex) return null;
  const code = currency.toUpperCase();
  const applies = ex.tierIndex >= 0;
  const label = (text: string) => <span className="text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>{text}</span>;
  const value = (children: React.ReactNode, color?: string) => (
    <span className="text-[12px] text-slate-700 tabular-nums inline-flex items-center gap-1.5 justify-end text-right" style={{ fontWeight: 500, color }}>{children}</span>
  );
  const tierNote = ex.tierIndex > 0 ? ` (tier ${ex.tierIndex + 1})` : "";
  const appliesText = ex.adjustmentText ? `Yes · ${ex.adjustmentText} applies${tierNote}` : `Yes · tier ${ex.tierIndex + 1} applies`;
  return (
    <div className="rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] p-4">
      <ExampleHeading>
        On a {code} {documentLabel} for <span className="tabular-nums">{exampleTotalText(ex.documentTotal, code)}</span>
      </ExampleHeading>
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 items-center">
        {label("In base currency")}
        {value(<><CurrencyFlag code={BASE_CURRENCY} />{formatMoneyWithCode(ex.baseTotal, BASE_CURRENCY)}</>)}
        {label(`${ex.thresholdKind === "over" ? "Over" : "Under"} ${formatRuleAmount(ex.threshold)}?`)}
        {value(applies ? appliesText : "No · no tier applies", applies ? "#047857" : "#B91C1C")}
        {applies && ex.adjustment != null && (
          <>
            {label(category === "discount" ? "Discount" : "Premium")}
            {value(<><CurrencyFlag code={code} />{formatMoneyWithCode(ex.adjustment, code)}</>)}
          </>
        )}
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#E8ECF1] text-[10.5px] text-slate-400 leading-relaxed">
        Rate {baseRateSentence(code, ex.rate)} · today's {RATE_TYPE_LABEL[ex.rateType].toLowerCase()}. The threshold is checked in {BASE_CURRENCY} at the document's rate; a fixed amount is converted to {code} at that rate.
      </div>
    </div>
  );
}

/**
 * The worked example while a rule is being created or edited (Partners §5):
 * shown for a value-based rule with at least one tier, on a document in the
 * partner's currency (US dollars for a partner in the base currency). Until a
 * tier has an order value limit there is no threshold to check, so it says so.
 */
export function RuleCreateExampleCard({
  basis,
  tiers,
  partnerCurrency,
  rateType,
  category,
  className,
}: {
  basis: "volume" | "value";
  tiers: RuleFormTier[];
  /** The partner's (or group's) currency code or id; base or none shows a USD example. */
  partnerCurrency?: string | null;
  rateType: RateType;
  category: "discount" | "premium";
  className?: string;
}) {
  if (basis !== "value" || tiers.length === 0) return null;
  const code = ruleExampleCurrency(partnerCurrency);
  const ruleTiers = ruleTiersFromForm(tiers);
  const hasExample = !!ruleDocumentExample(ruleTiers, code, rateType);
  return (
    <div className={className}>
      {hasExample ? (
        <RuleDocumentExampleCard tiers={ruleTiers} currency={code} rateType={rateType} category={category} />
      ) : (
        <div className="rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] p-4">
          <ExampleHeading>On a {code} PO</ExampleHeading>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Tick Order Value Limits on a tier and enter an amount in {BASE_CURRENCY} to see how a {code} document is checked: its total in {BASE_CURRENCY} at the document's rate, then the {category} in {code}.
          </p>
        </div>
      )}
    </div>
  );
}
