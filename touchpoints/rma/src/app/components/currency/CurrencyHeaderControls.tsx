import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { isBaseCurrency } from '@/app/currency/currencies';
import { CurrencyPill } from './CurrencyChip';
import type { ReturnView } from './returnView';

/* ── A return's header currency controls ──────────────────────────────
 * The return's currency tag beside its number, "RMA-01024 · Oakmoor Transport
 * [EUR]", and the Base Currency | Vendor Currency switch (detail-page
 * currency switch, 25 Nov 2026, same visual as Vendor Invoicing's). The
 * switch is not in the header: it sits in the Return Items toolbar beside
 * Full screen and Columns (rendered once, from InvoiceDetailScreen's
 * LineItemsTab `toolbarExtra`). It shows only on a return in a
 * foreign currency: on a PKR one there's nothing to switch. It changes how
 * the page reads, never the return (returnView.tsx keeps it per return for
 * the session). No Currency button: the configuration opens from the
 * summary's currency card (View configuration). */

/** The return's currency, beside its number: shown only when it isn't the
 *  base currency (a PKR return gets no tag). */
export function ReturnCurrencyTag({ currency, po }: { currency: string; po?: string | undefined }) {
  if (isBaseCurrency(currency)) return null;
  return <CurrencyPill code={currency} note={po ? `The return's currency, from ${po}. It can't change.` : "The return's currency, its PO's."} />;
}

function Segment({ active, onClick, label, tip }: { active: boolean; onClick: () => void; label: string; tip: string }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          onClick={onClick}
          className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
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

export function CurrencyHeaderControls({
  currency,
  view,
  onViewChange,
  what = 'return',
}: {
  /** The return's currency, its PO's. */
  currency: string;
  view: ReturnView;
  onViewChange: (view: ReturnView) => void;
  /** What the document is, for the tooltip: "this return". */
  what?: string;
}) {
  if (isBaseCurrency(currency)) return null;
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0" role="radiogroup" aria-label="Show amounts in">
      <Segment
        active={view === 'base'}
        onClick={() => onViewChange('base')}
        label="Base Currency"
        tip="Show amounts in your base currency."
      />
      <Segment
        active={view === 'document'}
        onClick={() => onViewChange('document')}
        label="Vendor Currency"
        tip={`Show amounts in the currency set for this ${what}.`}
      />
    </div>
  );
}
