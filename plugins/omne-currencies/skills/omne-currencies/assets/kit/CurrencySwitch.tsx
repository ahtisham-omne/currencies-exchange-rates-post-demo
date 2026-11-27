import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { getBaseCurrency, isBaseCurrency } from './currencies';
import { useDocCurrency, type DocView } from './docCurrencyContext';
import { setDocView, useDocViewOf } from './docView';

/* ── OMNE currency kit: the Base Currency | <Party> Currency switches ──
 * One look for every currency view switch: frameless pills in a white
 * bordered frame; the chosen one light blue (#EDF4FF, #0A77FF, weight 500),
 * the other muted; what each option shows rides its tooltip. Three uses:
 *
 *  - DocViewSwitch: a detail page. It sits in the LINE ITEMS TOOLBAR (or the
 *    first card that lists the document's money, e.g. a payment's Applied
 *    To card), never in the page header (25 Nov 2026). Defaults to base,
 *    kept per document for the session.
 *  - OverviewCurrencySwitch: a partner's or account's overview KPIs and
 *    widgets. Opens in base; the partner's currency is an extra.
 *  - PrintCurrencySwitch: the print or download preview. Defaults to the
 *    document's currency (the partner's document); base prints converted.
 *
 * Listings never get a switch: each money column has "Show values as" in
 * its header menu instead (ShowValuesAs.tsx).
 * Every switch hides itself for a base-currency record: nothing to switch.
 *
 * Shared file. Do not edit it in a module. */

/** Whose currency the second option shows. */
export type SwitchParty = 'vendor' | 'customer' | 'partner' | 'invoice' | 'payment' | 'account';

export const PARTY_SWITCH_LABEL: Record<SwitchParty, string> = {
  vendor: 'Vendor Currency',
  customer: 'Customer Currency',
  partner: 'Partner Currency',
  invoice: 'Invoice Currency',
  payment: 'Payment Currency',
  account: 'Account Currency',
};

export function Segment({
  active,
  onClick,
  label,
  tip,
  size = 'sm',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tip: string;
  /** sm: page toolbars (11px). md: the print preview (12px). */
  size?: 'sm' | 'md';
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          onClick={onClick}
          className={`${size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]'} rounded-md whitespace-nowrap transition-colors cursor-pointer ${
            active ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground hover:bg-muted'
          }`}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-[11.5px] leading-[1.5] z-[300]">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/** The frame and two options. Use the three switches below rather than this. */
export function CurrencyViewFrame({
  view,
  onChange,
  partyLabel,
  baseTip,
  partyTip,
  ariaLabel,
  size = 'sm',
  className = '',
}: {
  view: DocView;
  onChange: (view: DocView) => void;
  partyLabel: string;
  baseTip: string;
  partyTip: string;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0 ${className}`} role="radiogroup" aria-label={ariaLabel}>
      <Segment active={view === 'base'} onClick={() => onChange('base')} label="Base Currency" tip={baseTip} size={size} />
      <Segment active={view === 'document'} onClick={() => onChange('document')} label={partyLabel} tip={partyTip} size={size} />
    </div>
  );
}

/**
 * Base Currency | <Party> Currency on a detail page. Put it in the line
 * items toolbar. Reads the document's currency from the page's
 * DocCurrencyProvider (or `currency`), and keeps the choice per document
 * (docView.ts): feed `useDocViewOf(viewKey)` into the provider's `view`.
 */
export function DocViewSwitch({
  viewKey,
  party,
  documentNoun,
  currency: currencyProp,
  className = '',
}: {
  /** The docView.ts key: "purchase-order:PO-1003". */
  viewKey: string;
  party: SwitchParty;
  /** For the tooltip: "purchase order", "invoice", "return". */
  documentNoun: string;
  /** The document's currency, where the switch sits outside the provider. */
  currency?: string;
  className?: string;
}) {
  const doc = useDocCurrency();
  const currency = currencyProp ?? doc.currency;
  const view = useDocViewOf(viewKey);
  if (!currency || isBaseCurrency(currency)) return null;
  return (
    <CurrencyViewFrame
      view={view}
      onChange={(v) => setDocView(viewKey, v)}
      partyLabel={PARTY_SWITCH_LABEL[party]}
      baseTip="Show amounts in your base currency."
      partyTip={`Show amounts in the currency set for this ${documentNoun}.`}
      ariaLabel="Show amounts in"
      className={className}
    />
  );
}

/**
 * Base Currency | Partner (Account) Currency over a record's overview KPIs
 * and widgets. KPIs open in base, so figures compare across records
 * (Nophil, 25 Nov 2026); the record's own currency is the extra. Controlled:
 * the page keeps `view`, default 'base'.
 */
export function OverviewCurrencySwitch({
  currency,
  view,
  onChange,
  party = 'partner',
  recordNoun = party,
  className = '',
}: {
  /** The record's currency. */
  currency: string;
  view: DocView;
  onChange: (view: DocView) => void;
  party?: Extract<SwitchParty, 'partner' | 'vendor' | 'customer' | 'account'>;
  /** For the tooltip: "partner", "account". */
  recordNoun?: string;
  className?: string;
}) {
  if (!currency || isBaseCurrency(currency)) return null;
  return (
    <CurrencyViewFrame
      view={view}
      onChange={onChange}
      partyLabel={PARTY_SWITCH_LABEL[party]}
      baseTip="Show amounts in your base currency."
      partyTip={`Show amounts in the currency set for this ${recordNoun}.`}
      ariaLabel="Show amounts in"
      className={className}
    />
  );
}

/**
 * Base Currency | <Party> Currency in a print or download preview. The
 * printed document defaults to the document's currency (view 'document').
 * In base, every amount prints in base at the document's rate, with an
 * Exchange rate line, a total that names the base ("Grand Total (PKR)") and
 * a footnote saying what it was converted from (currencyFootnote). Sending
 * to the partner always uses the document's currency: don't show the switch
 * in the send flow.
 */
export function PrintCurrencySwitch({
  currency,
  view,
  onViewChange,
  party,
  documentNoun,
}: {
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  party: Extract<SwitchParty, 'vendor' | 'customer' | 'invoice' | 'payment'>;
  /** For the tooltip: "purchase order", "sales order". */
  documentNoun: string;
}) {
  if (!currency || isBaseCurrency(currency)) return null;
  return (
    <CurrencyViewFrame
      view={view}
      onChange={onViewChange}
      partyLabel={PARTY_SWITCH_LABEL[party]}
      baseTip="Print amounts in your base currency."
      partyTip={`Print amounts in the currency set for this ${documentNoun}.`}
      ariaLabel="Print amounts in"
      size="md"
    />
  );
}

/** "In PKR": a small caption for a figure that is always in base (GL Impact). */
export const inBaseCaption = () => `In ${getBaseCurrency()}`;
