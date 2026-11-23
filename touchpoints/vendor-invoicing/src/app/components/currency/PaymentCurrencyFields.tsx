import * as React from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Info, Lock, RotateCcw } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { MoneyInput } from '@/app/components/payments/MoneyInput';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { OTHER_CURRENCY_NOTE, derivedRate, rateGapPct } from '@/app/currency/paymentRules';
import { CurrencyFlag } from './CurrencyChip';

/* ── Record a vendor payment: Vendor Receives and Bank Took ───────────
 * Currency & Exchange Rates (currency/paymentRules.ts). The vendor always
 * receives the invoices' currency, so "Vendor Receives" is fixed. Which
 * account pays is the only choice: one in that currency (one amount, the
 * pounds paid, nothing converts) or one in the base currency (two amounts:
 * the pounds the vendor gets and the rupees the bank took; the rate is
 * worked out from them). The old Payment Currency switch and typed Exchange
 * Rate are gone, since a third currency is never offered (OTHER_CURRENCY_NOTE).
 * Same field recipe as the invoice form: 13px label with an ⓘ, a 40px
 * field, one 11px helper line. */

const LABEL = 'text-xs sm:text-[13px] text-foreground flex items-center gap-1.5';
const FIELD = 'mt-1 h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2';
const LOCKED = `${FIELD} border border-slate-200 bg-slate-50 cursor-not-allowed`;

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-slate-300 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        <div className="text-[11px] text-slate-500 leading-snug">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}

/** How the bank's rate stands against the module's allowed difference. */
export type BankRateCheck = 'ok' | 'review' | 'blocked';

/** "Vendor Receives": the invoices' currency and the amount, locked. */
export function VendorReceivesField({
  currency,
  amount,
  accountCurrency,
}: {
  /** The invoices' currency. */
  currency: string;
  /** What the vendor gets, in it. */
  amount: number;
  /** The pay-from account's currency. */
  accountCurrency: string;
}) {
  const cur = getCurrency(currency);
  const converts = isBaseCurrency(accountCurrency) && !isBaseCurrency(currency);
  const helper = isBaseCurrency(currency)
    ? `${BASE_CURRENCY} is the base currency, so nothing converts.`
    : converts
      ? `Paid from a ${BASE_CURRENCY} account: the bank converts.`
      : `Paid from a ${currency} account: nothing converts.`;
  return (
    <div>
      <Label className={LABEL} style={{ fontWeight: 500 }}>
        Vendor Receives
        <InfoTip>
          <p>
            The vendor always receives the invoices’ currency, {currency}. What you owe stays in it, so this payment reduces the{' '}
            {currency} balance.
          </p>
          <p className="mt-1">{OTHER_CURRENCY_NOTE}</p>
        </InfoTip>
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={LOCKED}>
            <CurrencyFlag code={currency} size={18} />
            <span style={{ fontWeight: 500 }}>{currency}</span>
            <span className="text-slate-500 truncate">{cur?.name}</span>
            <span className="ml-auto tabular-nums text-foreground shrink-0" style={{ fontWeight: 600 }}>{formatMoney(amount, currency)}</span>
            <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
          <p className="text-[11px] text-slate-500 leading-snug">Fixed: the invoices are in {currency}. {OTHER_CURRENCY_NOTE}</p>
        </TooltipContent>
      </Tooltip>
      <p className="text-[11px] text-slate-400 mt-1 truncate">{helper}</p>
    </div>
  );
}

/** "Bank Took (PKR)": from a base account, the rupees the bank took for the
 *  pounds the vendor gets. Starts at the payment date's mid-market rate
 *  until the bank's figure is entered. */
export function BankTookField({
  currency,
  vendorReceives,
  value,
  entered,
  onChange,
  dayRate,
  paymentDate,
  check,
  allowedPct,
  label = 'Bank Took',
}: {
  currency: string;
  vendorReceives: number;
  /** The field's name: "You Pay" in Record Payment (Currency Touchpoints
   *  Map, 24 Nov 2026: "You pay" is what the bank took), "Bank Took" elsewhere. */
  label?: string;
  /** In base: the entered figure, or the estimate. */
  value: number;
  /** The bank's figure was entered (not the estimate). */
  entered: boolean;
  /** A number sets the bank's figure; null goes back to the estimate. */
  onChange: (n: number | null) => void;
  /** Mid-market on the payment date. */
  dayRate: number;
  paymentDate: string;
  check: BankRateCheck;
  allowedPct: number;
}) {
  const rate = derivedRate(vendorReceives, value);
  const gap = rate != null ? rateGapPct(rate, dayRate) : 0;
  const day = formatRateDate(paymentDate);
  const symbol = moneyPrefix(BASE_CURRENCY).trim();
  const tone = check === 'blocked' ? '#EF4444' : check === 'review' ? '#B45309' : 'rgb(148 163 184)';
  return (
    <div>
      <Label className={LABEL} style={{ fontWeight: 500 }}>
        {label} ({BASE_CURRENCY})<span className="text-red-500">*</span>
        <InfoTip>
          What the bank took from the {BASE_CURRENCY} account for the {currency} the vendor gets, from the bank’s advice or statement.
          The rate is worked out from the two figures, and the difference from each invoice’s rate posts to FX Gain or FX Loss.
        </InfoTip>
      </Label>
      <div
        className={`${FIELD} bg-white border ${
          check === 'blocked'
            ? 'border-red-400 ring-2 ring-red-100'
            : check === 'review'
              ? 'border-amber-300 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-100'
              : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
        }`}
      >
        <span className="text-slate-400 shrink-0">{symbol}</span>
        <MoneyInput
          value={value}
          fluid
          onValueChange={(n) => onChange(n)}
          className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-foreground text-sm font-medium"
        />
        {entered && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
            title="Back to the estimate at the payment date’s mid-market rate"
            aria-label="Back to the estimate"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="text-[11px] mt-1 truncate flex items-center gap-1" style={{ color: tone }}>
        {check === 'blocked' ? (
          <>
            <AlertCircle className="w-3 h-3 shrink-0" />
            {Math.abs(gap).toFixed(2)}% from the {day} rate. Your role can’t record past {allowedPct}%.
          </>
        ) : check === 'review' ? (
          <>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {Math.abs(gap).toFixed(2)}% from the {day} mid-market rate, past {allowedPct}%: needs review.
          </>
        ) : entered ? (
          rate != null ? `${rateSentence(currency, rate)}, from the bank’s figures` : 'Enter what the bank took.'
        ) : (
          `At the ${day} mid-market rate. Enter what the bank took.`
        )}
      </p>
    </div>
  );
}

/** "Bank converts ₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR", with
 *  how far the bank's rate is from the day's. From an account in the
 *  invoices' currency: "Paid £6,000.00 from a GBP account. Nothing converts." */
export function BankConversionLine({
  currency,
  vendorReceives,
  accountCurrency,
  bankTook,
  dayRate,
  paymentDate,
  accountLabel,
  className = '',
}: {
  currency: string;
  vendorReceives: number;
  accountCurrency: string;
  /** From a base account: what the bank took. */
  bankTook?: number | null;
  dayRate?: number;
  paymentDate?: string;
  accountLabel?: string;
  className?: string;
}) {
  if (isBaseCurrency(currency)) return null;
  const converts = isBaseCurrency(accountCurrency);
  if (!converts) {
    return (
      <div className={`flex items-center gap-1.5 text-[11.5px] text-slate-600 ${className}`}>
        <CurrencyFlag code={currency} size={13} />
        <span>
          Paid <span className="tabular-nums text-foreground" style={{ fontWeight: 600 }}>{formatMoney(vendorReceives, currency)}</span>
          {accountLabel ? ` from ${accountLabel}` : ` from a ${currency} account`}. Nothing converts.
        </span>
      </div>
    );
  }
  const took = bankTook ?? 0;
  const rate = derivedRate(vendorReceives, took);
  const gap = rate != null && dayRate ? rateGapPct(rate, dayRate) : null;
  return (
    <div className={`flex items-center gap-1.5 flex-wrap text-[11.5px] text-slate-600 ${className}`}>
      <span className="text-slate-500" style={{ fontWeight: 500 }}>Bank converts</span>
      <span className="inline-flex items-center gap-1 tabular-nums text-foreground" style={{ fontWeight: 600 }}>
        {formatMoney(took, BASE_CURRENCY)}
        <ArrowRight className="w-3 h-3 text-slate-400" />
        {formatMoney(vendorReceives, currency)}
      </span>
      {rate != null && <span className="tabular-nums">· {rateSentence(currency, rate)}</span>}
      {gap != null && Math.abs(gap) >= 0.005 && (
        <span
          className="inline-flex items-center px-1.5 py-px rounded border text-[10px] tabular-nums"
          style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
          title={dayRate ? `Mid-market on ${formatRateDate(paymentDate)}: ${rateSentence(currency, dayRate)}` : undefined}
        >
          {gap > 0 ? '+' : '−'}
          {Math.abs(gap).toFixed(2)}% vs mid-market
        </span>
      )}
    </div>
  );
}
