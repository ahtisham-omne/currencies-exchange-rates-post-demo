import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import type { DocView } from './docCurrencyContext';

/* ── A document header's currency controls ─────────────────────────────
 * Ported from Purchase Orders (POCurrencyHeaderControls): the Base Currency |
 * Invoice Currency toggle (named so on 2026-11-20), which switches every amount on the document between
 * the base currency and the vendor's, and the Currency button, which opens the
 * document's currency configuration. The toggle only shows on a document in a
 * foreign currency: on a base-currency one there's nothing to switch. The
 * view is the session's (docView.ts), never an edit. */

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
  onOpenConfig,
  what = 'invoice',
  compact = false,
  toggle = true,
  showCode = false,
  alert = false,
}: {
  /** The document's currency (the vendor's, unless changed on it). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  onOpenConfig: () => void;
  /** What the document is, for the tooltips: "invoice", "payment". */
  what?: string;
  /** The scrolled (morphed) header: one step smaller. */
  compact?: boolean;
  /** The Base Currency | Invoice Currency toggle. Off where the screen stays
   *  in one currency (the invoice and payment pages). */
  toggle?: boolean;
  /** The button names the currency: "Currency · AED". */
  showCode?: boolean;
  /** Something in the configuration needs attention (a missing rate). */
  alert?: boolean;
}) {
  const foreign = currency.toUpperCase() !== BASE_CURRENCY;
  const h = compact ? 'h-8' : 'h-9';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {foreign && toggle && (
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
            label="Invoice Currency"
            tip={what === 'invoice' ? "Show amounts in the currency set for this invoice." : "Show amounts in the currency set for these invoices."}
          />
        </div>
      )}
      {/* No Currency button here (25 Nov 2026): the configuration opens from
          the currency card's View configuration. */}
    </div>
  );
}
