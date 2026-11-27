import * as React from 'react';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, rateSentence } from '@/app/currency/money';
import { OTHER_CURRENCY_NOTE, convertsAtBank, derivedRate, rateGapPct } from '@/app/currency/paymentRules';
import { CurrencyFlag } from './CurrencyChip';

/* ── Record a vendor payment: Vendor Receives ────────────────────────
 * Currency & Exchange Rates (currency/paymentRules.ts). The vendor always
 * receives the invoices' currency, so "Vendor Receives" is fixed. Which
 * account pays is the only choice; when the bank converts, the one rate
 * entered is the bank's (27 Nov 2026: BankRateField, which replaced this
 * file's "You Pay (PKR)" Bank Took field). Same field recipe as the invoice
 * form: 13px label with an ⓘ, a 40px field, one 11px helper line. */

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
export type { BankRateCheck } from './BankRateField';

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
  const converts = convertsAtBank(accountCurrency, currency);
  const helper = isBaseCurrency(currency)
    ? `${BASE_CURRENCY} is the base currency, so nothing converts.`
    : converts
      ? `Paid from a ${accountCurrency} account: the bank converts.`
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
          title={dayRate ? `Daily market rate on ${formatRateDate(paymentDate)}: ${rateSentence(currency, dayRate)}` : undefined}
        >
          {gap > 0 ? '+' : '−'}
          {Math.abs(gap).toFixed(2)}% vs the daily market rate
        </span>
      )}
    </div>
  );
}
