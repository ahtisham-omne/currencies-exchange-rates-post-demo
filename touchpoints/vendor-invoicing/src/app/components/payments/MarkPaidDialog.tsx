import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { DifferenceTag, signedBase } from '@/app/components/currency/ExchangeDifference';
import type { Payment } from '@/app/data/mockPayments';
import { PAY_FROM_ACCOUNTS } from '@/app/data/mockPayments';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney, formatRate, moneyPrefix } from '@/app/currency/money';
import { differenceKind, settledCurrencyOf } from '@/app/currency/paymentFx';
import { estimatedCostOf, needsBankRate } from '@/app/currency/paymentLedger';
import { toBase } from '@/app/currency/rates';

/* ── Mark as paid, with the rate the bank used (25 Nov 2026, Nophil item 9)
 * Opens only when a scheduled payment goes out from an account in another
 * currency (a PKR account paying USD): the rate was an estimate when it was
 * scheduled, so the confirm asks for the rate on the bank statement,
 * pre-filled with that estimate. Live below it: what the account paid at
 * that rate, and the difference from the estimate, which posts to FX Gain
 * or FX Loss. Several payments marked together get one rate per currency
 * pair (USD to PKR, EUR to PKR…). Same-currency payments never open this:
 * they're marked paid straight away, as before. The confirm-modal family
 * (ReleaseHoldDialog): emerald hero, title, one line, full-width CTAs. */

const round2 = (n: number) => Math.round(n * 100) / 100;
const rateText = (rate: number) => formatRate(rate).replace(/,/g, '');

interface PairGroup {
  currency: string;
  payments: Payment[];
  /** What the vendors receive, in `currency`. */
  amount: number;
  /** The estimate, in base. */
  estimate: number;
  /** The estimated rate (amount-weighted when several payments share the pair). */
  estimateRate: number;
  /** The one account they go out from, when it's one. */
  accountLabel?: string;
}

function pairGroupsOf(payments: Payment[]): PairGroup[] {
  const map = new Map<string, Payment[]>();
  payments.filter(needsBankRate).forEach((p) => {
    const c = settledCurrencyOf(p);
    map.set(c, [...(map.get(c) ?? []), p]);
  });
  return Array.from(map.entries()).map(([currency, list]) => {
    const amount = round2(list.reduce((s, p) => s + p.amount, 0));
    const estimate = round2(list.reduce((s, p) => s + estimatedCostOf(p), 0));
    const accounts = Array.from(new Set(list.map((p) => p.bankAccount)));
    return {
      currency,
      payments: list,
      amount,
      estimate,
      estimateRate: amount > 0 ? +(estimate / amount).toFixed(4) : 1,
      accountLabel: accounts.length === 1 ? PAY_FROM_ACCOUNTS.find((a) => a.id === accounts[0])?.label : undefined,
    };
  });
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  payments,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The scheduled payments being marked paid. */
  payments: Payment[];
  /** The rate the bank used, per currency (base per one unit). A currency
   *  left at its estimate is absent: each payment keeps its own estimate,
   *  confirmed as the bank's rate. */
  onConfirm: (rates: Record<string, number>) => void;
}) {
  const groups = useMemo(() => pairGroupsOf(payments), [payments]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  // Fresh every time it opens: each field starts at its estimate.
  useEffect(() => {
    if (open) setTyped(Object.fromEntries(groups.map((g) => [g.currency, rateText(g.estimateRate)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rateOf = (g: PairGroup) => {
    const n = Number(typed[g.currency] ?? rateText(g.estimateRate));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const allValid = groups.every((g) => rateOf(g) != null);
  const single = payments.length === 1 ? payments[0] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[460px] bg-white"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        showCloseButton={false}
      >
        <div
          className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#047857', filter: 'blur(50px)' }} />
          <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: '#047857', strokeWidth: 2 }} />
          </div>
          <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
            Mark as Paid
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <DialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {single ? 'Mark this payment as paid?' : `Mark ${payments.length} payments as paid?`}
          </DialogTitle>
          <DialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '380px' }}>
            {single
              ? `${single.paymentNumber} to ${single.vendor}, ${formatMoney(single.amount, single.currency)}. Its invoices settle now.`
              : 'Their invoices settle now.'}
          </DialogDescription>
        </div>

        <div className="px-5 sm:px-6 pt-4 space-y-4 text-left">
          {groups.map((g) => {
            const rate = rateOf(g);
            const est = g.estimateRate;
            const edited = (typed[g.currency] ?? '') !== rateText(est);
            // Left at the estimate, each payment keeps its own (a pair's
            // estimates can differ by payment date): no difference.
            const paid = !edited ? g.estimate : rate != null ? round2(g.payments.reduce((s, p) => s + toBase(p.amount, rate), 0)) : null;
            // Paying less than estimated is a gain; more, a loss.
            const difference = paid != null ? round2(g.estimate - paid) : 0;
            const kind = differenceKind(difference);
            return (
              <div key={g.currency} className="space-y-1.5">
                <span className="block text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Rate the bank used{groups.length > 1 ? `, ${g.currency} to ${BASE_CURRENCY}` : ''}
                </span>
                {/* The app's rate input (the corporate rate field on the
                    invoice and payment currency configuration). */}
                <div
                  className={`h-10 w-full rounded-lg px-3 flex items-center gap-1.5 text-[13px] bg-white border ${
                    rate == null ? 'border-red-400 ring-2 ring-red-100' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
                  }`}
                >
                  <span className="text-slate-500 whitespace-nowrap shrink-0">1 {g.currency} = {moneyPrefix(BASE_CURRENCY).trim()}</span>
                  <input
                    inputMode="decimal"
                    aria-label={`Rate the bank used, ${BASE_CURRENCY} per 1 ${g.currency}`}
                    value={typed[g.currency] ?? rateText(est)}
                    placeholder="Enter rate"
                    onChange={(e) => setTyped((prev) => ({ ...prev, [g.currency]: e.target.value.replace(/[^\d.]/g, '') }))}
                    className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-slate-700"
                    style={{ fontWeight: 500 }}
                  />
                  <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => setTyped((prev) => ({ ...prev, [g.currency]: rateText(est) }))}
                      className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
                      title={`Back to the estimate, ${formatRate(est)}`}
                      aria-label="Reset to the estimate"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pre-filled with the estimate. Enter the rate on your bank statement.
                </p>
                {/* Live: what the account paid at that rate, and how far it
                    is from the estimate (FX Gain or FX Loss, glFx naming). */}
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Amount paid</p>
                      {g.accountLabel && <p className="text-[10.5px] text-slate-400 truncate">From {g.accountLabel}</p>}
                    </div>
                    <span className="text-[12px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                      {paid != null ? `${formatMoney(paid, BASE_CURRENCY)} ${BASE_CURRENCY}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Difference from the estimate</p>
                      <p className="text-[10.5px] text-slate-400">
                        {paid == null
                          ? `Estimated at ${formatMoney(g.estimate, BASE_CURRENCY)} ${BASE_CURRENCY}.`
                          : kind === 'gain'
                            ? 'Posts to FX Gain.'
                            : kind === 'loss'
                              ? 'Posts to FX Loss.'
                              : 'Same as the estimate.'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 shrink-0">
                      {paid != null && <DifferenceTag difference={difference} />}
                      <span className="text-[12px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                        {paid != null ? signedBase(difference) : '—'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 sm:px-6 pt-4 pb-5 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            disabled={!allValid}
            onClick={() => {
              const rates: Record<string, number> = {};
              groups.forEach((g) => {
                const r = rateOf(g);
                if (r != null && (typed[g.currency] ?? '') !== rateText(g.estimateRate)) rates[g.currency] = r;
              });
              onConfirm(rates);
            }}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
          >
            Mark as Paid
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
