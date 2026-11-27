import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import {
  BankRateBreakdown,
  BankRateField,
  OurRateField,
  addBankRateFigures,
  bankRateFigures,
  parseRateInput,
  rateInputText,
} from '@/app/components/currency/BankRateField';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { PAY_FROM_ACCOUNTS } from '@/app/data/mockPayments';
import { formatMoney } from '@/app/currency/money';
import { settledCurrencyOf } from '@/app/currency/paymentFx';
import { bankRatePairOf, estimatedRateOf, needsBankRate, paymentAccountCurrencyOf, paymentLedger } from '@/app/currency/paymentLedger';
import { accountDayRateOn, dayRateOn } from '@/app/currency/paymentRules';

/* ── Mark as paid, with the rate the bank used (25 Nov 2026, Nophil item 9)
 * Opens only when a scheduled payment goes out from an account in another
 * currency (a PKR account paying USD, or a CAD one, D7): the rate was an
 * estimate when it was scheduled, so the confirm asks for the bank's rate,
 * pre-filled with that estimate (the payment date's daily market rate).
 * The same field, helper and breakdown as Record Payment (27 Nov 2026,
 * Mahreen 7a, BankRateField): our rate, the bank's rate, then what A/P
 * carried at the invoice's rate against what the bank took, split into the
 * rate change since the invoice and the bank's rate against ours; the sum
 * posts to FX Gain or FX Loss. Several payments marked together get one
 * rate per currency pair (USD to PKR, USD to CAD…). Same-currency payments
 * never open this: they're marked paid straight away, as before. The
 * confirm-modal family (ReleaseHoldDialog): emerald hero, title, one line,
 * full-width CTAs. */

const round2 = (n: number) => Math.round(n * 100) / 100;

interface PairGroup {
  /** "USD/PKR": where its rate is read (bankRatePairOf). */
  key: string;
  currency: string;
  accountCurrency: string;
  payments: Payment[];
  /** What the vendors receive, in `currency`. */
  amount: number;
  /** The estimated rate, in the account's currency per one unit
   *  (amount-weighted when several payments share the pair). */
  estimateRate: number;
  /** Our rate: the payment dates' daily market rate, weighted the same way. */
  ourRate: number;
  /** The first payment's date (one, for a single payment). */
  paymentDate: string;
  /** The one account they go out from, when it's one. */
  accountLabel?: string;
}

function pairGroupsOf(payments: Payment[]): PairGroup[] {
  const map = new Map<string, Payment[]>();
  payments.filter(needsBankRate).forEach((p) => {
    const k = bankRatePairOf(p);
    map.set(k, [...(map.get(k) ?? []), p]);
  });
  return Array.from(map.entries()).map(([key, list]) => {
    const currency = settledCurrencyOf(list[0]);
    const accountCurrency = paymentAccountCurrencyOf(list[0]);
    const amount = round2(list.reduce((s, p) => s + p.amount, 0));
    const weighted = (rateOf: (p: Payment) => number) =>
      amount > 0 ? list.reduce((s, p) => s + p.amount * rateOf(p), 0) / amount : rateOf(list[0]);
    const accounts = Array.from(new Set(list.map((p) => p.bankAccount)));
    return {
      key,
      currency,
      accountCurrency,
      payments: list,
      amount,
      estimateRate: +weighted(estimatedRateOf).toFixed(4),
      ourRate: +weighted((p) => accountDayRateOn(currency, accountCurrency, p.paymentDate)).toFixed(4),
      paymentDate: list[0].paymentDate,
      accountLabel: accounts.length === 1 ? PAY_FROM_ACCOUNTS.find((a) => a.id === accounts[0])?.label : undefined,
    };
  });
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  payments,
  invoices = [],
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The scheduled payments being marked paid. */
  payments: Payment[];
  /** The invoices they settle, for the rate each was booked at. */
  invoices?: Invoice[];
  /** The bank's rate per currency pair (bankRatePairOf), in the account's
   *  currency per one unit. A pair left at its estimate is absent: each
   *  payment keeps its own estimate, confirmed as the bank's rate. */
  onConfirm: (rates: Record<string, number>) => void;
}) {
  const groups = useMemo(() => pairGroupsOf(payments), [payments]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  // Fresh every time it opens: each field starts at its estimate.
  useEffect(() => {
    if (open) setTyped(Object.fromEntries(groups.map((g) => [g.key, rateInputText(g.estimateRate)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const textOf = (g: PairGroup) => typed[g.key] ?? rateInputText(g.estimateRate);
  const rateOf = (g: PairGroup) => parseRateInput(textOf(g));
  const editedOf = (g: PairGroup) => textOf(g) !== rateInputText(g.estimateRate);
  const allValid = groups.every((g) => rateOf(g) != null);
  const single = payments.length === 1 ? payments[0] : null;
  // A group's breakdown: every payment's invoices at their own rates, its
  // cash at our rate and at the bank's (left at the estimate, each payment
  // keeps its own).
  const figuresOf = (g: PairGroup) => {
    const rate = rateOf(g);
    const edited = editedOf(g);
    const sum = addBankRateFigures(
      g.payments.map((p) => {
        const ledger = paymentLedger(p, invoices);
        return bankRateFigures({
          currency: g.currency,
          accountCurrency: g.accountCurrency,
          lines: ledger.lines,
          credits: ledger.credits,
          cash: p.amount,
          dayRate: dayRateOn(g.currency, p.paymentDate),
          bankRate: edited ? rate : estimatedRateOf(p),
          paymentDate: p.paymentDate,
        });
      }),
    );
    return { ...sum, bankRate: rate };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[460px] bg-white max-h-[92vh] flex flex-col"
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

        <div className="px-5 sm:px-6 pt-4 space-y-4 text-left overflow-y-auto min-h-0">
          {groups.map((g) => {
            const pairName = groups.length > 1 ? `, ${g.currency} to ${g.accountCurrency}` : '';
            return (
              <div key={g.key} className="space-y-3">
                <OurRateField
                  variant="dialog"
                  label={`Our rate${pairName}`}
                  currency={g.currency}
                  accountCurrency={g.accountCurrency}
                  rate={g.ourRate}
                  paymentDate={g.paymentDate}
                  amount={g.amount}
                />
                <div className="space-y-2">
                  <BankRateField
                    variant="dialog"
                    label={`Bank's rate${pairName}`}
                    currency={g.currency}
                    accountCurrency={g.accountCurrency}
                    value={textOf(g)}
                    onChange={(text) => setTyped((prev) => ({ ...prev, [g.key]: text }))}
                    ourRate={g.ourRate}
                  />
                  <BankRateBreakdown currency={g.currency} accountCurrency={g.accountCurrency} figures={figuresOf(g)} />
                  {g.accountLabel && <p className="text-[10.5px] text-slate-400 truncate">From {g.accountLabel}</p>}
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
                if (r != null && editedOf(g)) rates[g.key] = r;
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
