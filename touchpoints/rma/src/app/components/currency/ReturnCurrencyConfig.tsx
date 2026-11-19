import * as React from 'react';
import { Lock, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { authorizedQty, type RMA } from '@/app/data/mockRMAs';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { RATE_PROVIDER, fxToday, toBase } from '@/app/currency/rates';
import { returnReceipts, rmaCurrency, rmaCurrencyPO } from '@/app/currency/returnCurrency';
import { CurrencyFlag } from './CurrencyChip';
import { linkProvider } from './ProviderLink';

/* ── A return's Currency Configuration ─────────────────────────────────
 * Mahreen, 2026-11-20, set up like the PO's dialog. A return is always in its
 * PO's currency and reverses each receipt at the rate it was booked at, so
 * nothing here can change: it says what the return is worth in that currency
 * and in PKR, and at which receiving-day rate. */

/** A return's value: authorized quantity × unit price, rounded line by line
 *  as the ledger rounds it (the Return Summary's figure). */
export function returnValueOf(rma: RMA): number {
  return Math.round(rma.items.reduce((s, li) => s + Math.round(authorizedQty(li) * li.unitPrice * 100) / 100, 0) * 100) / 100;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>
      {children}
    </section>
  );
}

/** An amount beside its currency, locked. */
function LockedAmount({ amount, code }: { amount: number; code: string }) {
  const cur = getCurrency(code);
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-600 tabular-nums" style={{ fontWeight: 500 }}>
        <span className="truncate">{formatMoney(amount, code)}</span>
      </div>
      <div className="w-[200px] shrink-0 h-10 rounded-lg text-sm px-3 flex items-center gap-2 border border-slate-200 bg-slate-50">
        <CurrencyFlag code={code} size={18} />
        <span style={{ fontWeight: 500 }}>{code}</span>
        <span className="text-slate-500 truncate">{cur?.name}</span>
        <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
      </div>
    </div>
  );
}

export function ReturnCurrencyConfigDialog({ rma, open, onOpenChange }: { rma: RMA; open: boolean; onOpenChange: (open: boolean) => void }) {
  const code = rmaCurrency(rma);
  const base = isBaseCurrency(code);
  const value = returnValueOf(rma);
  const po = rmaCurrencyPO(rma);
  // The receipts this return unwinds, each at its own receiving-day rate. A
  // return with none yet (a draft) shows its PO's currency only.
  const receipts = returnReceipts(rma);
  const days = Array.from(new Map(receipts.map((r) => [`${r.date}|${r.rate}`, r])).values());
  const weight = receipts.reduce((s, r) => s + (r.value || 1), 0);
  const blended = receipts.length ? receipts.reduce((s, r) => s + (r.value || 1) * r.rate, 0) / weight : null;
  const inBase = blended != null ? toBase(value, blended) : null;
  const prefix = moneyPrefix(BASE_CURRENCY).trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5 pr-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: '#EFF6FF' }}>
              <Settings2 className="h-4 w-4" style={{ color: '#0A77FF' }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                Currency Configuration
              </DialogTitle>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Applies to {rma.rmaNumber} only. A return is always in its PO's currency ({code}).
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Return value">
            <LockedAmount amount={value} code={code} />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {po ? `From PO ${po}. ` : ''}To return goods from a PO in another currency, start a separate return.
            </p>
          </Section>

          {base ? (
            <p className="text-[11.5px] text-slate-500">{BASE_CURRENCY} is the base currency, so nothing converts.</p>
          ) : (
            <>
              <Section label="In your base currency">
                <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2 text-[15px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>
                  {inBase != null ? `${formatMoney(inBase, BASE_CURRENCY)} ${BASE_CURRENCY}` : '—'}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {inBase == null
                    ? 'Converted once the goods it returns have a receipt.'
                    : days.length > 1
                      ? 'Each receipt at its own receiving-day rate below.'
                      : 'At the receiving-day rate below.'}
                </p>
              </Section>

              {days.length > 0 && (
                <Section label="Exchange rate">
                  {days.map((r) => (
                    <div key={`${r.grnNumber}-${r.date}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[12.5px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
                        1 {code} = {prefix}{formatRate(r.rate)} {BASE_CURRENCY}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#7C3AED' }} />
                        <span style={{ color: '#7C3AED', fontWeight: 600 }}>Mid-market</span>
                        <span>· {linkProvider(RATE_PROVIDER)}</span>
                        <span>
                          · Rate on {formatRateDate(r.date)}, the receiving date{days.length > 1 ? ` (${r.grnNumber})` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed" style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                <Lock className="w-3 h-3 mt-[3px] shrink-0" />
                <span>
                  The return reverses each receipt at the rate it was booked at, so this rate can't change. If the refund or credit lands at a
                  different rate, the difference goes to FX Gain or FX Loss.
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Creating a return: its Currency Configuration before it exists ───
 * Create New RMA, step 5 (Mahreen, 2026-11-20): the return inherits its PO's
 * currency configuration, the way an order inherits its quote's. Step 5 reads
 * in PKR at today's rate, like the PO cart; this is where the amounts in the
 * PO's currency are. Once created, the return converts at its receiving-day
 * rate (ReturnCurrencyConfigDialog). */
export function CreateReturnCurrencyDialog({
  open,
  onOpenChange,
  currency,
  value,
  paid,
  charges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  /** What the goods going back are worth, billed or not. */
  value: number;
  paid: number;
  charges: number;
}) {
  const base = isBaseCurrency(currency);
  const today = fxToday(currency);
  const prefix = moneyPrefix(BASE_CURRENCY).trim();
  const rows: { label: string; amount: number; minus?: boolean }[] = [
    { label: 'Return value', amount: value },
    { label: 'Paid', amount: paid },
  ];
  if (charges > 0.004) rows.push({ label: 'Total Charges', amount: charges, minus: true });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5 pr-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: '#EFF6FF' }}>
              <Settings2 className="h-4 w-4" style={{ color: '#0A77FF' }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                Currency Configuration
              </DialogTitle>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Applies to this return only. A return is always in its PO's currency ({currency}).
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Return value">
            <LockedAmount amount={value} code={currency} />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              From the PO of the receipts picked. To return goods from a PO in another currency, start a separate return.
            </p>
          </Section>
          <Section label={`In ${currency}${base ? '' : ` and ${BASE_CURRENCY}`}`}>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px] tabular-nums">
                  <span className="text-slate-600" style={{ fontWeight: 500 }}>{r.label}</span>
                  <span className="text-right">
                    <span className="text-slate-800" style={{ fontWeight: 600 }}>
                      {r.minus ? '−' : ''}
                      {formatMoney(r.amount, currency)}
                    </span>
                    {!base && (
                      <span className="block text-[10.5px] text-slate-400">
                        {r.minus ? '−' : ''}
                        {formatMoney(toBase(r.amount, today.rate), BASE_CURRENCY)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Section>
          {!base && (
            <Section label="Exchange rate">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[12.5px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
                  1 {currency} = {prefix}{formatRate(today.rate)} {BASE_CURRENCY}
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#7C3AED' }} />
                  <span style={{ color: '#7C3AED', fontWeight: 600 }}>Mid-market</span>
                  <span>· {linkProvider(RATE_PROVIDER)}</span>
                  <span>· Today, {formatRateDate(today.rateDate)}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Today's rate until the return is created. It then reverses each receipt at the rate it was booked at, its receiving-day
                rate.
              </p>
            </Section>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
