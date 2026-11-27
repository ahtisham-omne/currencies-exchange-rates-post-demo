import * as React from 'react';
import { AlertCircle, AlertTriangle, Check, Info, Lock, RotateCcw } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { dayRateOn, isThirdCurrency, pairRateText, rateGapPct, realizedFxOf, type CreditUsed, type SettledLine } from '@/app/currency/paymentRules';
import { RATE_TYPE_LABEL, toBase } from '@/app/currency/rates';
import { signedVariance, varianceHex } from './CurrencyBlock';

/* ── The bank's rate (27 Nov 2026, Mahreen 7a–7c) ─────────────────────
 * One shared field and breakdown for Record Payment's Payment Details, Mark
 * as paid and the payment's Currency configuration (lifted out of
 * MarkPaidDialog's "Rate the bank used"). The payment's rate fills in from
 * the payment date ("Our rate", the daily market rate); the user enters the
 * one rate the bank gave, and everything else works out from it (Eli's
 * ruling, 26 Nov 2026: a payment takes the payment date's rate, the bank's
 * spread goes to FX gain or loss):
 *
 *   Our rate        1 AED = ₨76.1000 PKR
 *                   Daily market rate · Dec 05, 2026 · ₨754,912.00
 *   Bank's rate *   1 AED = [76.2500] PKR
 *                   Enter the exchange rate the bank gave you.
 *   Invoice booked at ₨75.8400        ₨752,332.80
 *   Bank took at ₨76.2500             ₨756,400.00
 *   Rate change since invoice          −₨2,579.20   amount × (invoice rate − our rate)
 *   Bank's rate vs ours                −₨1,488.00   amount × (our rate − bank's rate)
 *   FX variance                        −₨4,067.20   their sum: + gain green, − loss red
 *
 * The rate is in the pay-from account's currency per one unit of the
 * invoice's: base per unit from a base account; the direct pair from a third
 * currency (1 USD = 1.3935 CAD), which shows no PKR rate: only what the bank
 * took, in the account's currency, and the FX variance it makes in base.
 * From an account in the invoice's currency nothing converts:
 * SameCurrencyNote stands in for all of it. */

/** How the bank's rate stands against the module's allowed difference. */
export type BankRateCheck = 'ok' | 'review' | 'blocked';

/** The text a rate input starts with: "76.2500", no thousands separators. */
export const rateInputText = (rate: number) => formatRate(rate).replace(/,/g, '');

/** A typed rate, or null when it isn't a number above zero. */
export function parseRateInput(text: string | null | undefined): number | null {
  if (text == null || text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "₨76.1000", or "1.3935" between two foreign currencies. */
const rateFigure = (rate: number, accountCurrency: string) =>
  isBaseCurrency(accountCurrency) ? `${moneyPrefix(BASE_CURRENCY).trim()}${formatRate(rate)}` : formatRate(rate);

/** 'form': Record Payment's field labels; 'dialog': Mark as paid's; 'section':
 *  a Currency configuration dialog's section labels. */
type FieldVariant = 'form' | 'dialog' | 'section';
const LABEL_CLASS: Record<FieldVariant, string> = {
  form: 'text-xs sm:text-[13px] text-foreground flex items-center gap-1.5',
  dialog: 'text-[11px] text-slate-500 flex items-center gap-1.5',
  section: 'text-[12px] text-slate-700 flex items-center gap-1.5',
};
const LABEL_WEIGHT: Record<FieldVariant, number> = { form: 500, dialog: 500, section: 600 };
const LOCKED = 'h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2 border border-slate-200 bg-slate-50 cursor-not-allowed';

/** "Our rate": the payment date's daily market rate, read-only, with its
 *  base amount under it (a third currency shows the direct pair only). */
export function OurRateField({
  label = 'Our rate',
  variant = 'form',
  currency,
  accountCurrency,
  rate,
  paymentDate,
  amount,
}: {
  label?: string;
  variant?: FieldVariant;
  /** The invoice's currency. */
  currency: string;
  /** The pay-from account's currency. */
  accountCurrency: string;
  /** In the account's currency per one unit of the invoice's. */
  rate: number;
  paymentDate: string;
  /** What the vendor receives, for the base amount at this rate. */
  amount?: number;
}) {
  const toBaseAccount = isBaseCurrency(accountCurrency);
  const meta = [
    RATE_TYPE_LABEL.mid,
    formatRateDate(paymentDate),
    ...(toBaseAccount && amount != null && amount > 0 ? [formatMoney(Math.round(amount * rate * 100) / 100, BASE_CURRENCY)] : []),
  ].join(' · ');
  return (
    <div>
      <Label className={LABEL_CLASS[variant]} style={{ fontWeight: LABEL_WEIGHT[variant] }}>
        {label}
      </Label>
      <div className={`${LOCKED} ${variant === 'form' ? 'mt-1' : 'mt-1.5'}`} aria-readonly="true">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#7C3AED' }} />
        <span className="tabular-nums text-foreground truncate" style={{ fontWeight: 500 }}>
          {pairRateText(currency, accountCurrency, rate)}
        </span>
        <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
      </div>
      <p className="text-[11px] text-slate-400 mt-1 truncate tabular-nums">{meta}</p>
    </div>
  );
}

/** "Bank's rate *": the one rate the user enters, pre-filled with ours. */
export function BankRateField({
  label = "Bank's rate",
  variant = 'form',
  currency,
  accountCurrency,
  value,
  onChange,
  ourRate,
  check = 'ok',
  allowedPct,
  readOnly = false,
  className = '',
}: {
  label?: string;
  variant?: FieldVariant;
  /** The invoice's currency. */
  currency: string;
  /** The pay-from account's currency: what the rate is in. */
  accountCurrency: string;
  /** The rate as typed. */
  value: string;
  onChange?: (text: string) => void;
  /** Our rate (the payment date's daily market rate): the reset. */
  ourRate: number;
  check?: BankRateCheck;
  allowedPct?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const rate = parseRateInput(value);
  const edited = rate == null || Math.abs(rate - ourRate) > 1e-9;
  const gap = rate != null ? rateGapPct(rate, ourRate) : 0;
  const invalid = !readOnly && rate == null;
  const tone = invalid || check === 'blocked' ? '#DC2626' : check === 'review' ? '#B45309' : 'rgb(148 163 184)';
  const cur = currency.toUpperCase();
  const acc = accountCurrency.toUpperCase();
  return (
    <div className={className}>
      <Label className={LABEL_CLASS[variant]} style={{ fontWeight: LABEL_WEIGHT[variant] }}>
        {label}
        {!readOnly && <span className="text-red-500">*</span>}
        {variant === 'form' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-slate-300 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
              <p className="text-[11px] text-slate-500 leading-snug">
                The rate on the bank's advice or statement, in {acc} for 1 {cur}. It starts at our rate, the payment date's daily
                market rate. The difference from the invoice's rate posts to FX Gain or FX Loss.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </Label>
      {readOnly ? (
        <div className={`${LOCKED} ${variant === 'form' ? 'mt-1' : 'mt-1.5'}`} aria-readonly="true">
          <span className="text-slate-500 whitespace-nowrap shrink-0">1 {cur} =</span>
          <span className="tabular-nums text-foreground" style={{ fontWeight: 500 }}>{rate != null ? formatRate(rate) : '—'}</span>
          <span className="text-slate-500 shrink-0">{acc}</span>
          <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
        </div>
      ) : (
        /* The app's rate input (the corporate rate field on the invoice's
           currency configuration). */
        <div
          className={`${variant === 'form' ? 'mt-1' : 'mt-1.5'} h-10 w-full rounded-lg px-3 flex items-center gap-1.5 text-[13px] bg-white border ${
            invalid || check === 'blocked'
              ? 'border-red-400 ring-2 ring-red-100'
              : check === 'review'
                ? 'border-amber-300 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-100'
                : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
          }`}
        >
          <span className="text-slate-500 whitespace-nowrap shrink-0">1 {cur} =</span>
          <input
            inputMode="decimal"
            aria-label={`Bank's rate, ${acc} per 1 ${cur}`}
            value={value}
            placeholder="Enter rate"
            onChange={(e) => onChange?.(e.target.value.replace(/[^\d.]/g, ''))}
            className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-slate-700"
            style={{ fontWeight: 500 }}
          />
          <span className="text-slate-500 shrink-0">{acc}</span>
          {edited && (
            <button
              type="button"
              onClick={() => onChange?.(rateInputText(ourRate))}
              className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
              title={`Back to our rate, ${formatRate(ourRate)}`}
              aria-label="Back to our rate"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      <p className="text-[11px] mt-1 flex items-start gap-1 leading-snug" style={{ color: tone }}>
        {(invalid || check === 'blocked') && <AlertCircle className="w-3 h-3 mt-px shrink-0" />}
        {!invalid && check === 'review' && <AlertTriangle className="w-3 h-3 mt-px shrink-0" />}
        <span>
          {invalid
            ? "Enter the bank's rate, above zero."
            : check === 'blocked'
              ? `${Math.abs(gap).toFixed(2)}% from our rate. Your role can't record past ${allowedPct ?? 0}%.`
              : check === 'review'
                ? `${Math.abs(gap).toFixed(2)}% from our rate, past ${allowedPct ?? 0}%: needs review.`
                : readOnly
                  ? 'The exchange rate the bank gave.'
                  : 'Enter the exchange rate the bank gave you.'}
        </span>
      </p>
    </div>
  );
}

/** What the breakdown reads, all in base except `accountTook`. */
export interface BankRateFigures {
  /** The settled invoices at their own rates (what A/P carried). */
  carried: number;
  /** Vendor credit drawn, at the rates it was paid. */
  credit: number;
  /** The cash at our rate (the payment date's daily market rate). */
  atOurRate: number;
  /** What the bank took, in base. */
  cost: number;
  /** What the bank took, in the account's currency (a third currency). */
  accountTook?: number;
  /** "₨75.8400", or null when the invoices carry different rates. */
  invoiceRate: number | null;
  /** The bank's rate, in the account's currency per one unit. */
  bankRate: number | null;
  /** No invoice is settled (a prepayment): only what the bank took. */
  noInvoices?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The breakdown's figures for one payment: the settled invoices at their
 *  own rates, the cash at our rate (`dayRate`, base per one unit) and at
 *  the bank's (in the account's currency per one unit; from a third
 *  currency, its amount at the payment date's rate of that currency). */
export function bankRateFigures({
  currency,
  accountCurrency,
  lines,
  credits = [],
  cash,
  dayRate,
  bankRate,
  paymentDate,
}: {
  currency: string;
  accountCurrency: string;
  lines: SettledLine[];
  credits?: CreditUsed[];
  cash: number;
  dayRate: number;
  bankRate: number | null;
  paymentDate: string;
}): BankRateFigures {
  const atOurRate = toBase(cash, dayRate);
  const third = isThirdCurrency(accountCurrency, currency);
  const accountTook = third && bankRate != null ? r2(cash * bankRate) : undefined;
  const cost =
    bankRate == null ? atOurRate : accountTook != null ? toBase(accountTook, dayRateOn(accountCurrency, paymentDate)) : toBase(cash, bankRate);
  const fx = realizedFxOf(lines, credits, cost);
  const rates = Array.from(new Set(lines.map((l) => l.rate)));
  return {
    carried: fx.carried,
    credit: fx.credit,
    atOurRate,
    cost,
    accountTook,
    invoiceRate: rates.length === 1 ? rates[0] : null,
    bankRate,
    noInvoices: lines.length === 0,
  };
}

/** Several payments' figures added up (Mark as paid, one rate per pair). */
export function addBankRateFigures(list: BankRateFigures[]): BankRateFigures {
  const sum = (pick: (f: BankRateFigures) => number) => r2(list.reduce((s, f) => s + pick(f), 0));
  const rates = Array.from(new Set(list.map((f) => f.invoiceRate)));
  const took = list.every((f) => f.accountTook != null) ? sum((f) => f.accountTook ?? 0) : undefined;
  return {
    carried: sum((f) => f.carried),
    credit: sum((f) => f.credit),
    atOurRate: sum((f) => f.atOurRate),
    cost: sum((f) => f.cost),
    accountTook: took,
    invoiceRate: rates.length === 1 ? rates[0] : null,
    bankRate: list[0]?.bankRate ?? null,
    noInvoices: list.every((f) => f.noInvoices),
  };
}

/** The breakdown under the bank's rate: what A/P carried, what the bank
 *  took, and the FX variance between them, split into the rate change since
 *  the invoice and the bank's rate against ours. */
export function BankRateBreakdown({
  currency,
  accountCurrency,
  figures,
  className = '',
}: {
  currency: string;
  accountCurrency: string;
  figures: BankRateFigures;
  className?: string;
}) {
  const { carried, credit, atOurRate, cost, accountTook, invoiceRate, bankRate, noInvoices } = figures;
  const third = !isBaseCurrency(accountCurrency) && accountCurrency.toUpperCase() !== currency.toUpperCase();
  const fx = r2(carried - credit - cost);
  const rateChange = r2(carried - credit - atOurRate);
  const spread = r2(atOurRate - cost);
  const Row = ({ label, value, color, strong, tip }: { label: React.ReactNode; value: string; color?: string; strong?: boolean; tip?: string }) => (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'pt-2 border-t border-slate-200' : ''}`}>
      <span className={`text-[12px] min-w-0 inline-flex items-center gap-1 ${strong ? 'text-slate-800' : 'text-slate-500'}`} style={{ fontWeight: strong ? 600 : 400 }}>
        {label}
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-slate-300 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
              <p className="text-[11px] text-slate-500 leading-snug">{tip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ fontWeight: strong ? 700 : 600, color: color ?? '#334155' }}>
        {value}
      </span>
    </div>
  );
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 space-y-2 ${className}`}>
      {third ? (
        <>
          {/* A third currency (D7): only the pair that changes hands, no PKR rates. */}
          <Row label="Bank took" value={accountTook != null ? formatMoney(accountTook, accountCurrency) : '—'} />
          {!noInvoices && bankRate != null && (
            <Row
              strong
              label="FX variance"
              value={signedVariance(fx)}
              color={varianceHex(fx)}
              tip={`In ${BASE_CURRENCY}: the invoice at its own rate, against the ${accountCurrency.toUpperCase()} the bank took at the payment date's ${accountCurrency.toUpperCase()} rate. A negative amount is a loss.`}
            />
          )}
        </>
      ) : (
        <>
          {!noInvoices && (
            <Row
              label={invoiceRate != null ? `Invoice booked at ${rateFigure(invoiceRate, BASE_CURRENCY)}` : 'Invoices booked at their own rates'}
              value={formatMoney(carried, BASE_CURRENCY)}
            />
          )}
          {!noInvoices && credit > 0.004 && <Row label="Vendor credit, at the rates it was paid" value={`−${formatMoney(credit, BASE_CURRENCY)}`} />}
          <Row label={bankRate != null ? `Bank took at ${rateFigure(bankRate, BASE_CURRENCY)}` : 'Bank took'} value={bankRate != null ? formatMoney(cost, BASE_CURRENCY) : '—'} />
          {!noInvoices && bankRate != null && (
            <>
              <Row label="Rate change since invoice" value={signedVariance(rateChange)} color={varianceHex(rateChange)} />
              <Row label="Bank's rate vs ours" value={signedVariance(spread)} color={varianceHex(spread)} />
              <Row strong label="FX variance" value={signedVariance(fx)} color={varianceHex(fx)} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Same currency (Mahreen 7b): an account in the invoice's currency pays
 *  it, so there is no rate to enter. */
export function SameCurrencyNote({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center gap-2 text-[12px] text-slate-600 ${className}`}>
      <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>Same currency. No exchange rate needed.</span>
    </div>
  );
}
