import * as React from 'react';
import { Info, Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency } from '@/app/currency/currencies';
import type { ReturnView as DocView } from './returnView';

/* ── A return's header currency controls ──────────────────────────────
 * From Vendor Invoicing (itself ported from Purchase Orders'
 * POCurrencyHeaderControls), for a return (Mahreen, 2026-11-20): the Base
 * Currency | Vendor Currency toggle, which switches every amount on the document between
 * the base currency and the vendor's, and the Currency button, which opens the
 * document's currency configuration. The toggle only shows on a document in a
 * foreign currency: on a base-currency one there's nothing to switch. The
 * view is the session's (docView.ts), never an edit. */

function Segment({ active, onClick, label, tip }: { active: boolean; onClick: () => void; label: string; tip: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] whitespace-nowrap cursor-pointer transition-colors ${
        active ? 'bg-primary/[0.08] text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
      style={{ fontWeight: active ? 600 : 500 }}
    >
      {label}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span role="img" aria-label={tip} onClick={(e) => e.stopPropagation()} className="inline-flex">
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-[11.5px] leading-[1.5] z-[300]">
          {tip}
        </TooltipContent>
      </Tooltip>
    </button>
  );
}

export function CurrencyHeaderControls({
  currency,
  view,
  onViewChange,
  onOpenConfig,
  what = 'return',
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
  /** The Base Currency | Vendor Currency toggle. Off where the screen stays in
   *  the base currency (creating a vendor invoice). */
  toggle?: boolean;
  /** The button names the currency: "Currency · AED". */
  showCode?: boolean;
  /** Something in the configuration needs attention (a missing rate). */
  alert?: boolean;
}) {
  const foreign = currency.toUpperCase() !== BASE_CURRENCY;
  const baseName = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  const h = compact ? 'h-8' : 'h-9';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {foreign && toggle && (
        <div className={`inline-flex items-center gap-0.5 ${h} rounded-lg border border-border p-0.5 bg-white shadow-sm`} role="group" aria-label="Show amounts in">
          <Segment
            active={view === 'base'}
            onClick={() => onViewChange('base')}
            label="Base Currency"
            tip={`Show every amount in the company's base currency, ${baseName} (${BASE_CURRENCY}), so ${what}s compare whatever currency they're in. The vendor's amount is on hover.`}
          />
          <Segment
            active={view === 'document'}
            onClick={() => onViewChange('document')}
            label="Vendor Currency"
            tip={`Show every amount in this ${what}'s currency, its PO's (${currency.toUpperCase()}). The ${BASE_CURRENCY} amount is on hover.`}
          />
        </div>
      )}
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
        {showCode && <span className="text-slate-400">·</span>}
        {showCode && <span className={alert ? '' : 'text-slate-700'} style={{ fontWeight: 600 }}>{currency.toUpperCase()}</span>}
      </button>
    </div>
  );
}
