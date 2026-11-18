import type { ComponentType } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import {
  lineInvoiceState,
  LINE_INVOICE_LABELS,
  type LineInvoiceSplit,
  type LineInvoiceState,
} from '@/app/data/receiptInvoiceStatus';

/** Palette and icon lifted from vendor invoicing's payment axis, so a line
 *  reads the same here as it does in the invoice listing: slate while no
 *  money has moved, orange once part of it has, and deep emerald with a
 *  check only at the terminal state. */
const INVOICE_STATE_CHIP: Record<
  Exclude<LineInvoiceState, 'none'>,
  { className: string; icon?: ComponentType<{ className?: string }> }
> = {
  'not-invoiced': { className: 'bg-slate-50 border-slate-200 text-slate-500' },
  'partly-invoiced': { className: 'bg-slate-100 border-slate-300 text-slate-600' },
  invoiced: { className: 'bg-slate-100 border-slate-300 text-slate-600' },
  'partly-paid': { className: 'bg-orange-50 border-orange-200 text-orange-700' },
  paid: { className: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: CheckCircle2 },
};

export function InvoiceStatusChip({ split, uom }: { split: LineInvoiceSplit | undefined; uom: string }) {
  if (!split) return null;
  const state = lineInvoiceState(split);
  if (state === 'none') return null;
  const chip = INVOICE_STATE_CHIP[state];
  const Icon = chip.icon;
  const rows: [string, number][] = [
    ['Not invoiced', split.notInvoiced],
    ['Invoiced, not paid', split.invoicedUnpaid],
    ['Paid', split.paid],
  ];
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] border cursor-help ${chip.className}`}
          style={{ fontWeight: 600 }}
        >
          {Icon && <Icon className="w-2.5 h-2.5" />}
          {LINE_INVOICE_LABELS[state]}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>
          {split.received} {uom} received
        </p>
        <div className="mt-1 space-y-0.5">
          {rows
            .filter(([, qty]) => qty > 0)
            .map(([label, qty]) => (
              <p key={label} className="text-[11px] text-slate-500 tabular-nums">
                {qty} {uom} · {label}
              </p>
            ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
