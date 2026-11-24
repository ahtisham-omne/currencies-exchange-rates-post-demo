import * as React from 'react';
import { isBaseCurrency } from '@/app/currency/currencies';
import { CurrencyPill } from './CurrencyChip';

/* ── A return's header currency controls ──────────────────────────────
 * Currency Touchpoints Map (2026-11-24): a document's header carries its
 * currency tag and a Currency button, "RMA-01024 · Oakmoor Transport [EUR]
 * [Currency]". The page shows every amount in PKR, the base currency, with
 * the return's amount on hover, so the Base Currency | Vendor Currency toggle
 * Mahreen added on 2026-11-20 is gone. The button opens the return's
 * currency configuration. */

/** The return's currency, beside its number: shown only when it isn't the
 *  base currency (a PKR return gets no tag). */
export function ReturnCurrencyTag({ currency, po }: { currency: string; po?: string | undefined }) {
  if (isBaseCurrency(currency)) return null;
  return <CurrencyPill code={currency} note={po ? `The return's currency, from ${po}. It can't change.` : "The return's currency, its PO's."} />;
}

export function CurrencyHeaderControls({
  onOpenConfig,
  compact = false,
  alert = false,
}: {
  onOpenConfig: () => void;
  /** The scrolled (morphed) header: one step smaller. */
  compact?: boolean;
  /** Something in the configuration needs attention (a missing rate). */
  alert?: boolean;
}) {
  // No Currency button in the header (25 Nov 2026): the configuration opens
  // from the summary's currency card (View configuration).
  return null;
}
