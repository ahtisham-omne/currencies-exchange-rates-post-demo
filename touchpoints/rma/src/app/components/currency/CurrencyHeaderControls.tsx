import * as React from 'react';
import { Settings2 } from 'lucide-react';
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
  const h = compact ? 'h-8' : 'h-9';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={onOpenConfig}
        aria-label={alert ? 'Open currency configuration: the exchange rate needs attention' : 'Open currency configuration'}
        className={`inline-flex items-center gap-1.5 ${h} px-2.5 rounded-lg border bg-white shadow-sm hover:bg-slate-50 transition-colors cursor-pointer text-[11.5px] ${
          alert ? 'border-red-300 text-red-600 hover:text-red-700' : 'border-border text-slate-500 hover:text-slate-800'
        }`}
        style={{ fontWeight: 500 }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Currency
      </button>
    </div>
  );
}
