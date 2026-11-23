import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase, type RateType } from '@/app/currency/rates';

/* ── Posting date changed: keep the rate or take the new date's ─────────
 * Currency Touchpoints Map (24 Nov 2026), Vendor invoices 4: an edited
 * invoice keeps its current rate; when the date its rate is taken on (the
 * posting date, the module default) changes, this asks
 *
 *   Posting date changed   Nov 23 → Nov 25, 2026
 *   ( ) Keep the current rate      1 USD = 279.5200 PKR
 *   ( ) Use Nov 25's rate          1 USD = 280.1000 PKR
 *                                         Cancel   Apply
 *
 * Cancel puts the date back. The FX variance follows whichever rate is
 * applied. Same card recipe as the version rate choice in Purchase Orders. */

export interface RateDayPrompt {
  /** Which date field moved: the one the rate is taken on. */
  field: 'postingDate' | 'invoiceDate';
  from: string;
  to: string;
  currency: string;
  /** The rate the invoice carries now. */
  keepRate: number;
  keepType: RateType;
  keepDate: string;
  /** The new date's rate, of the same type (mid-market where there's none). */
  newRate: number;
  newType: RateType;
  /** What the invoice still owes, in its currency, for the base totals. */
  amount?: number;
}

/** "Nov 23 → Nov 25, 2026", the year once when both share it. */
function dateChangeText(from: string, to: string): string {
  const a = formatRateDate(from);
  const b = formatRateDate(to);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${a.replace(/, \d{4}$/, '')} → ${b}`;
  return `${a} → ${b}`;
}

/** "Nov 25" */
const shortDay = (iso: string) => formatRateDate(iso).replace(/, \d{4}$/, '');

export function PostingDateRatePrompt({
  prompt,
  onCancel,
  onApply,
}: {
  prompt: RateDayPrompt | null;
  onCancel: () => void;
  onApply: (choice: 'keep' | 'new') => void;
}) {
  const [choice, setChoice] = React.useState<'keep' | 'new'>('keep');
  React.useEffect(() => {
    if (prompt) setChoice('keep');
  }, [prompt]);
  if (!prompt) return null;
  const what = prompt.field === 'postingDate' ? 'Posting date' : 'Vendor invoice date';
  const total = (rate: number) => (prompt.amount != null ? ` · total ${formatMoney(toBase(prompt.amount, rate), BASE_CURRENCY)}` : '');
  const cards: { key: 'keep' | 'new'; title: string; rate: string; meta: string }[] = [
    {
      key: 'keep',
      title: 'Keep the current rate',
      rate: `1 ${prompt.currency} = ${formatRate(prompt.keepRate)} ${BASE_CURRENCY}`,
      meta: `${RATE_TYPE_LABEL[prompt.keepType]} · ${formatRateDate(prompt.keepDate)}${total(prompt.keepRate)}`,
    },
    {
      key: 'new',
      title: `Use ${shortDay(prompt.to)}'s rate`,
      rate: `1 ${prompt.currency} = ${formatRate(prompt.newRate)} ${BASE_CURRENCY}`,
      meta: `${RATE_TYPE_LABEL[prompt.newType]} · ${formatRateDate(prompt.to)}${total(prompt.newRate)}`,
    },
  ];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="sm:max-w-[460px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5 pr-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: '#EFF6FF' }}>
              <CalendarClock className="h-4 w-4" style={{ color: '#0A77FF' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                  {what} changed
                </DialogTitle>
                <span className="text-[12px] text-slate-500 tabular-nums">{dateChangeText(prompt.from, prompt.to)}</span>
              </div>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                The invoice keeps its rate unless you take the new date's. The rate stays unlocked until the invoice posts.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2" style={{ backgroundColor: '#FAFBFC' }} role="radiogroup" aria-label="Which rate the invoice uses">
          {cards.map((c) => {
            const active = choice === c.key;
            return (
              <div
                key={c.key}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => setChoice(c.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setChoice(c.key);
                  }
                }}
                className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/25"
                style={{ borderColor: active ? '#0A77FF' : '#E2E8F0', backgroundColor: active ? '#EDF4FF' : '#FFFFFF' }}
              >
                <span
                  className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full shrink-0 border"
                  style={{ borderColor: active ? '#0A77FF' : '#CBD5E1', backgroundColor: active ? '#0A77FF' : '#FFFFFF' }}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>{c.title}</span>
                    <span className="text-[12px] text-slate-800 tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>{c.rate}</span>
                  </div>
                  <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">{c.meta}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-500 leading-relaxed mt-1">The FX variance against the receiving rate updates with the rate you apply.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(choice)}
            className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors cursor-pointer"
            style={{ backgroundColor: '#0A77FF' }}
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
