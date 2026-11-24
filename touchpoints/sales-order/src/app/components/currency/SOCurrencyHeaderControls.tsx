import * as React from "react";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { customerCurrency } from "@/app/currency/soFx";
import { CurrencyPill } from "./CurrencyChip";

/* ── The SO header's currency ──────────────────────────────────────────
 * Currency Touchpoints Map (24 Nov 2026): "SO-000-112 from Q-000-750 ·
 * Harbor Point Rescue [USD] [Currency]". The header carries the order's
 * currency tag, after the customer's name, and the Currency button, which
 * opens the order's currency configuration. There is no Base Currency |
 * Customer Currency toggle any more: every amount on the order is in the
 * base currency, the customer's on hover. A base-currency order gets no
 * tag. */

const FONT = "Inter, system-ui, sans-serif";

/** "from Q-000-105-001 · Harbor Point Rescue [USD]", after the state pills.
 *  The tag shows only on an order in a foreign currency. */
export function SOHeaderCustomer({
  customer,
  currency,
  sourceQuoteRef,
  compact = false,
}: {
  customer: string;
  /** The order's currency. */
  currency: string;
  /** The quote the order was made from, if any. */
  sourceQuoteRef?: string;
  /** The scrolled (compact) header. */
  compact?: boolean;
}) {
  const code = currency.toUpperCase();
  const foreign = !isBaseCurrency(code);
  if (!customer && !foreign) return null;
  const name = getCurrency(code)?.name ?? code;
  const note = sourceQuoteRef
    ? `The order's currency, from quote ${sourceQuoteRef}. Amounts show in ${BASE_CURRENCY}; hover one for ${code}.`
    : `The order's currency${customerCurrency(customer) === code ? `, ${customer || "the customer"}'s default` : ""}. Amounts show in ${BASE_CURRENCY}; hover one for ${code}.`;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" style={{ fontFamily: FONT }}>
      {customer && (
        <span
          className="truncate text-slate-600"
          style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 500, lineHeight: compact ? "18px" : "22px", maxWidth: 320 }}
          title={sourceQuoteRef ? `From quote ${sourceQuoteRef} · ${customer}` : customer}
        >
          {sourceQuoteRef && <span className="text-slate-400" style={{ fontWeight: 400 }}>from {sourceQuoteRef} · </span>}
          {customer}
        </span>
      )}
      {foreign && (
        <span className="shrink-0 inline-flex" aria-label={`Order currency: ${name} (${code})`}>
          <CurrencyPill code={code} note={note} />
        </span>
      )}
    </span>
  );
}

/** The Currency button: opens the order's currency configuration. */
export function SOCurrencyHeaderControls({
  onOpenConfig,
  compact = false,
}: {
  onOpenConfig: () => void;
  /** The scrolled (compact) header. */
  compact?: boolean;
}) {
  // No Currency button in the header (25 Nov 2026): the configuration opens
  // from the summary's currency card (View configuration).
  return null;
}
