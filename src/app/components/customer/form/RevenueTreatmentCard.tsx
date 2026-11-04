import { Check, Lock, Scale, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { TREATMENT_HELPER, TREATMENT_LABEL } from '@/app/data/ar/customerInvoiceStatus';
import type { PreInvoiceTreatment } from '@/app/data/ar/mockCustomerInvoices';
import type { TreatmentState } from './formModel';

/* Revenue Treatment card (Mahreen 11/4 advance invoice flow): two options
 * with the default already picked. The company setting can lock the
 * choice ("Set by company setting"), a quote is always Revenue on
 * shipment, and (proposed) Revenue on invoice is disabled with the reason
 * when the units are not on hand. Locked for good once posted. */

const OPTIONS: PreInvoiceTreatment[] = ['Revenue', 'Deposit'];

function lockCaption(t: TreatmentState): string | undefined {
  if (t.lock === 'Never' || t.lock === 'Always') return 'Set by company setting';
  if (t.lock === 'posted') return 'Locked once posted';
  if (t.lock === 'quote') return 'Raised from a quote';
  return undefined;
}

export function RevenueTreatmentCard({
  id,
  treat,
  onPick,
}: {
  id: string;
  treat: TreatmentState;
  onPick: (v: PreInvoiceTreatment) => void;
}) {
  const caption = lockCaption(treat);
  const locked = !!caption;
  return (
    <section id={id} className="shrink-0">
      <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] rounded-t-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Revenue Treatment</span>
          </div>
          {caption && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
              <Lock className="w-3 h-3 text-slate-400" />
              {caption}
            </span>
          )}
        </div>
        <div className="p-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Revenue treatment">
          {OPTIONS.map((v) => {
            const selected = treat.picked === v;
            const blocked = v === 'Revenue' && !!treat.revenueBlocked;
            const disabled = !selected && (locked || blocked);
            const tile = (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled || undefined}
                onClick={() => !disabled && !locked && onPick(v)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                  selected
                    ? 'border-primary bg-blue-50/60'
                    : disabled
                      ? 'border-slate-200 bg-slate-50/70 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                } ${locked && selected ? 'cursor-default' : ''}`}
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selected ? 'border-primary bg-primary' : disabled ? 'border-slate-200 bg-slate-100' : 'border-slate-300 bg-white'
                  }`}
                >
                  {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12.5px] ${selected ? 'text-primary' : disabled ? 'text-slate-400' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                    {TREATMENT_LABEL[v]}
                  </span>
                  <span className={`block text-[11px] mt-0.5 leading-snug ${disabled ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontWeight: 400 }}>
                    {TREATMENT_HELPER[v]}
                  </span>
                  {blocked && (
                    <span className="flex items-start gap-1 text-[11px] mt-1 leading-snug text-amber-700" style={{ fontWeight: 400 }}>
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                      {treat.revenueBlocked}
                    </span>
                  )}
                </span>
              </button>
            );
            if (!disabled || blocked) return tile;
            return (
              <Tooltip key={v}>
                <TooltipTrigger asChild>{tile}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                  <p className="text-[11px] text-slate-500 leading-snug">{caption}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </section>
  );
}
