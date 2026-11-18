import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { differenceKind } from '@/app/currency/paymentFx';

/* ── Exchange difference (Currency & Exchange Rates) ──────────────────
 * Settling invoices booked at their own rates at a payment's rate leaves a
 * difference in the base currency, the realized FX Gain/Loss: a gain when
 * paying costs less than A/P carried, a loss when it costs more. Shown as
 * one labelled line with the sum, in the payment summary and on the
 * payment's page (currency/paymentRules.ts works it out). */

export const EXCHANGE_DIFFERENCE_TIP =
  'What A/P carried for these invoices in the base currency, at their own rates, against what paying them cost: the bank’s figure from a base account, the day’s rate from one in the invoices’ currency. Costing less is a gain, more is a loss. It posts to Realized FX Gain/Loss.';

/** "+₨17.54" / "−₨17.54" / "₨0.00". */
export function signedBase(d: number): string {
  const k = differenceKind(d);
  return `${k === 'gain' ? '+' : k === 'loss' ? '−' : ''}${formatMoney(Math.abs(d), BASE_CURRENCY)}`;
}

export function DifferenceTag({ difference }: { difference: number }) {
  const k = differenceKind(difference);
  if (k === 'none') return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-px rounded border text-[10px] shrink-0"
      style={{
        fontWeight: 600,
        backgroundColor: k === 'gain' ? '#ECFDF5' : '#FEF2F2',
        color: k === 'gain' ? '#047857' : '#B91C1C',
        borderColor: k === 'gain' ? '#A7F3D0' : '#FECACA',
      }}
    >
      {k === 'gain' ? 'Gain' : 'Loss'}
    </span>
  );
}

/** "Exchange Difference ⓘ ……… [Gain] +₨17.54" */
export function ExchangeDifferenceLine({
  difference,
  label = 'Exchange Difference',
  className = '',
}: {
  difference: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center gap-2 ${className}`}>
      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-slate-300 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">{EXCHANGE_DIFFERENCE_TIP}</p>
          </TooltipContent>
        </Tooltip>
      </span>
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <DifferenceTag difference={difference} />
        <span className="text-[12px] text-foreground tabular-nums truncate" style={{ fontWeight: 600 }}>
          {signedBase(difference)}
        </span>
      </span>
    </div>
  );
}
