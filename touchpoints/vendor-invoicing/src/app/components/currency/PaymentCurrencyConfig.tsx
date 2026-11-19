import * as React from 'react';
import { Banknote, Check, Landmark, Lock, RotateCcw, Settings2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { MoneyInput } from '@/app/components/payments/MoneyInput';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { RATE_PROVIDER, toBase } from '@/app/currency/rates';
import { gainLossOf } from '@/app/currency/fxVariance';
import {
  OTHER_CURRENCY_NOTE,
  bankConversionText,
  bankRateNeedsReview,
  convertsAtBank,
  derivedRate,
  payFromBlockReason,
  rateGapPct,
  realizedFxOf,
  type CreditUsed,
  type SettledLine,
} from '@/app/currency/paymentRules';
import { CurrencyFlag } from './CurrencyChip';
import { AmountRow, GainLossTag, LockedCurrency, RateCard, Section, baseRate, signedBase } from './InvoiceCurrencyConfig';
import { BankConversionLine } from './PaymentCurrencyFields';

/* ── A payment's currency: summary card and Currency Configuration ────
 * The payment counterpart of the invoice's CURRENCY card and dialog
 * (InvoiceCurrencyConfig), on the payment rules (currency/paymentRules.ts):
 *  - "Vendor receives": the invoices' currency, fixed, with the reason.
 *  - "Pay from": the accounts that may pay, one in the invoices' currency or
 *    one in the base; any other is listed greyed with why. The PO's "You
 *    pay in" picked the default.
 *  - The amounts: one (the pounds paid) from an account in the invoices'
 *    currency; two (the pounds the vendor gets, the rupees the bank took)
 *    from a base account, with the rate worked out and the bank conversion
 *    line.
 *  - The payment date's mid-market rate, for comparison.
 *  - The realized FX Gain/Loss it posts: what A/P carried at the invoice
 *    rates against what paying cost.
 * In Record Payment the dialog edits the account and the bank's figure
 * (Save configuration writes them back). On a saved payment it is
 * read-only. A payment of base-currency invoices converts nothing. */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The FX Gain/Loss line: tag and signed amount, or "None". */
function GainLossFigure({ amount, size = 12 }: { amount: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <GainLossTag amount={amount} />
      <span className="tabular-nums text-slate-700" style={{ fontSize: size, fontWeight: 600 }}>
        {gainLossOf(amount) === 'none' ? 'None' : signedBase(amount)}
      </span>
    </span>
  );
}

const FX_GAIN_LOSS_TIP =
  'What A/P carried for the paid part, at each invoice’s rate, against what paying it cost in the base currency. Costing less is a gain and posts to FX Gain; costing more is a loss and posts to FX Loss.';

/* ── Summary card: CURRENCY ────────────────────────────────────────── */

export interface PaymentCurrencySummaryProps {
  currency: string;
  /** What the vendor receives (the cash), in the invoices' currency. */
  vendorReceives: number;
  account?: Pick<PayFromAccount, 'label' | 'currency'> | null;
  /** From a base account: what the bank took. */
  bankTook?: number | null;
  /** The payment's rate (derived, or the day's). */
  rate: number;
  paymentDate: string;
  /** Mid-market on the payment date. */
  dayRate: number;
  /** A/P carried for the paid part, in base. */
  carried?: number;
  /** The realized FX Gain/Loss (above zero a gain). */
  realized?: number | null;
  /** The payment is saved: what it posted. */
  locked?: boolean;
  onViewConfig: () => void;
  className?: string;
}

export function PaymentCurrencySummary({
  currency,
  vendorReceives,
  account,
  bankTook,
  rate,
  paymentDate,
  dayRate,
  carried,
  realized,
  locked,
  onViewConfig,
  className = '',
}: PaymentCurrencySummaryProps) {
  const base = isBaseCurrency(currency);
  const converts = !!account && convertsAtBank(account.currency, currency);
  const rows: { label: string; code: string; text: string }[] = [
    { label: 'Vendor receives', code: currency, text: `${formatMoney(vendorReceives, currency)}${formatMoney(vendorReceives, currency).includes(currency) ? '' : ` ${currency}`}` },
  ];
  if (account) rows.push({ label: 'Pay from', code: account.currency, text: account.label });
  if (converts && bankTook != null) rows.push({ label: 'Bank took', code: BASE_CURRENCY, text: `${formatMoney(bankTook, BASE_CURRENCY)} ${BASE_CURRENCY}` });
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
          Currency
        </span>
        {locked && !base && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{ color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 }}
            title="Fixed when the payment posted."
          >
            <Lock className="w-2.5 h-2.5" />
            Locked
          </span>
        )}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <p className="text-slate-400 shrink-0" style={{ fontSize: 10.5, fontWeight: 500 }}>{r.label}</p>
          <p className="flex items-center gap-1.5 tabular-nums min-w-0" style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
            <CurrencyFlag code={r.code} size={11} />
            <span className="truncate">{r.text}</span>
          </p>
        </div>
      ))}
      {base ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there’s no conversion.
        </p>
      ) : (
        <div className="border-t border-slate-100 pt-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>{converts ? 'Bank rate' : 'Rate'}</p>
            <div className="text-right">
              <p className="text-slate-600 tabular-nums" style={{ fontSize: 11, fontWeight: 500 }}>1 {currency} = {baseRate(rate)} {BASE_CURRENCY}</p>
              <p className="text-slate-400" style={{ fontSize: 10 }}>
                {formatRateDate(paymentDate)} · {converts ? 'from the bank’s figures' : 'mid-market, nothing converts'}
              </p>
            </div>
          </div>
          {converts && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>Mid-market</p>
              <div className="text-right">
                <p className="text-slate-600 tabular-nums" style={{ fontSize: 11, fontWeight: 500 }}>1 {currency} = {baseRate(dayRate)} {BASE_CURRENCY}</p>
                <p className="text-slate-400" style={{ fontSize: 10 }}>
                  {formatRateDate(paymentDate)} · {(() => {
                    const g = rateGapPct(rate, dayRate);
                    return Math.abs(g) < 0.005 ? 'the same' : `bank ${g > 0 ? '+' : '−'}${Math.abs(g).toFixed(2)}%`;
                  })()}
                </p>
              </div>
            </div>
          )}
          {carried != null && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>A/P carried</p>
              <p className="text-slate-600 tabular-nums" style={{ fontSize: 11, fontWeight: 500 }}>{formatMoney(carried, BASE_CURRENCY)}</p>
            </div>
          )}
          {realized != null && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-slate-400 cursor-help" style={{ fontSize: 10.5, fontWeight: 500 }} title={FX_GAIN_LOSS_TIP}>
                {gainLossOf(realized) === 'loss' ? 'FX Loss' : 'FX Gain'}
              </span>
              <GainLossFigure amount={realized} />
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onViewConfig}
          className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-primary cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Settings2 className="w-3 h-3" />
          View configuration
        </button>
      </div>
    </div>
  );
}

/* ── Currency Configuration ────────────────────────────────────────── */

export interface PaymentCurrencyChoice {
  accountId: string;
  /** From a base account: the bank's figure; null keeps the estimate. */
  bankTook: number | null;
}

export interface PaymentCurrencyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "PMT-000121", or "this payment" in Record Payment. */
  documentLabel: string;
  vendorName: string;
  /** The invoices' currency, what the vendor receives. */
  currency: string;
  /** The cash, in the invoices' currency. */
  vendorReceives: number;
  /** The accounts the method can draw from, every currency (others greyed). */
  accounts: PayFromAccount[];
  value: PaymentCurrencyChoice;
  /** The account currency the PO's You pay in asks for. */
  youPayIn: string;
  paymentDate: string;
  /** Mid-market on the payment date. */
  dayRate: number;
  /** The invoices settled, each at its rate, for what A/P carried. */
  lines: SettledLine[];
  credits?: CreditUsed[];
  /** Settings: the allowed difference, and whether the role may record past it. */
  allowedPct: number;
  canRecordPastAllowed: boolean;
  /** A saved payment: nothing changes here. */
  readOnly?: boolean;
  onSave?: (next: PaymentCurrencyChoice) => void;
}

export function PaymentCurrencyConfigDialog(props: PaymentCurrencyConfigDialogProps) {
  const {
    open,
    onOpenChange,
    documentLabel,
    vendorName,
    currency,
    vendorReceives,
    accounts,
    value,
    youPayIn,
    paymentDate,
    dayRate,
    lines,
    credits = [],
    allowedPct,
    canRecordPastAllowed,
    readOnly = false,
    onSave,
  } = props;

  const [accountId, setAccountId] = React.useState(value.accountId);
  const [bankTook, setBankTook] = React.useState<number | null>(value.bankTook);
  React.useEffect(() => {
    if (!open) return;
    setAccountId(value.accountId);
    setBankTook(value.bankTook);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = isBaseCurrency(currency);
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const accountCurrency = account?.currency ?? BASE_CURRENCY;
  const converts = convertsAtBank(accountCurrency, currency);
  const estimate = toBase(vendorReceives, dayRate);
  const took = converts ? bankTook ?? estimate : null;
  const rate = base ? 1 : converts ? derivedRate(vendorReceives, took ?? 0) ?? dayRate : dayRate;
  const cost = base ? round2(vendorReceives) : converts ? round2(took ?? 0) : toBase(vendorReceives, dayRate);
  // A prepayment settles no invoice yet: it is booked at what it cost, so it has no FX Gain/Loss.
  const fx = base || lines.length === 0 ? null : realizedFxOf(lines, credits, cost);
  const review = converts && bankRateNeedsReview(rate, dayRate, allowedPct);
  const blocked = review && !canRecordPastAllowed && !readOnly;
  const dirty = !readOnly && (accountId !== value.accountId || (bankTook ?? null) !== (value.bankTook ?? null));
  const canSave = dirty && !blocked && !!account && !payFromBlockReason(accountCurrency, currency);
  const invoiceRates = Array.from(new Map(lines.map((l) => [`${l.rate}|${l.rateDate ?? ''}`, l])).values());

  const save = () => {
    if (readOnly || !dirty) {
      onOpenChange(false);
      return;
    }
    if (!canSave) return;
    onSave?.({ accountId, bankTook: converts ? bankTook : null });
    onOpenChange(false);
  };
  const reset = () => {
    const def = accounts.find((a) => a.currency === youPayIn && !payFromBlockReason(a.currency, currency))
      ?? accounts.find((a) => isBaseCurrency(a.currency));
    if (def) setAccountId(def.id);
    setBankTook(null);
  };

  // Allowed first (the invoices' currency, then base), the rest greyed after.
  const ordered = [...accounts].sort((a, b) => {
    const rank = (x: PayFromAccount) => (payFromBlockReason(x.currency, currency) ? 2 : x.currency === currency.toUpperCase() && !base ? 0 : 1);
    return rank(a) - rank(b);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5 pr-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: '#EFF6FF' }}>
              <Settings2 className="h-4 w-4" style={{ color: '#0A77FF' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                  Currency Configuration
                </DialogTitle>
                {readOnly && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}
              </div>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Applies to {documentLabel} only. The vendor is paid in the invoice's currency ({currency}).
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Vendor receives">
            {converts ? (
              // Bank took (PKR) beside it (Mahreen, 2026-11-20): the two
              // amounts the bank's rate is worked out from.
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10.5px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Vendor receives ({currency})</p>
                    <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2 text-[14px] text-slate-600 tabular-nums" style={{ fontWeight: 500 }}>
                      <span className="truncate">{formatMoney(vendorReceives, currency)}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10.5px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Bank took ({BASE_CURRENCY})</p>
                    {readOnly ? (
                      <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[14px] text-slate-600 tabular-nums" style={{ fontWeight: 500 }}>
                        {formatMoney(took ?? 0, BASE_CURRENCY)}
                      </div>
                    ) : (
                      <div
                        className={`h-10 px-3 rounded-lg border bg-white flex items-center gap-1.5 ${
                          blocked ? 'border-red-400 ring-2 ring-red-100' : review ? 'border-amber-300' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
                        }`}
                      >
                        <span className="text-slate-400 text-sm">{moneyPrefix(BASE_CURRENCY).trim()}</span>
                        <MoneyInput
                          value={took ?? 0}
                          fluid
                          onValueChange={(n) => setBankTook(n)}
                          className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-foreground text-[14px] font-medium"
                        />
                        {bankTook != null && (
                          <button type="button" onClick={() => setBankTook(null)} className="text-slate-400 hover:text-primary cursor-pointer" title="Back to the estimate" aria-label="Back to the estimate">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: blocked ? '#DC2626' : review ? '#B45309' : '#64748B' }}>
                  {bankTook == null && !readOnly
                    ? `Estimated at the ${formatRateDate(paymentDate)} mid-market rate until you enter what the bank took.`
                    : blocked
                      ? `The bank’s rate is ${Math.abs(rateGapPct(rate, dayRate)).toFixed(2)}% from the day’s, past the allowed ${allowedPct}%. Your role can’t record that; Settings, Permissions sets who can.`
                      : review
                        ? `The bank’s rate is ${Math.abs(rateGapPct(rate, dayRate)).toFixed(2)}% from the day’s, past the allowed ${allowedPct}%: it needs review.`
                        : 'The rate is worked out from the two amounts.'}
                </p>
              </>
            ) : (
              <AmountRow
                amount={vendorReceives}
                code={currency}
                side={
                  <LockedCurrency
                    code={currency}
                    note={
                      base
                        ? `${BASE_CURRENCY} is the base currency: nothing converts.`
                        : `Paid from a ${currency} account, so the vendor gets exactly what you pay.`
                    }
                  />
                }
              />
            )}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {!base && !converts ? `Paid from a ${currency} account, so the vendor gets exactly what you pay. ` : ''}
              What you owe stays in {currency}, so this payment reduces the {currency} balance. {OTHER_CURRENCY_NOTE}
            </p>
          </Section>

          {/* The vendor credit or prepayment applied, each at the rate it was
              paid at (Mahreen, 2026-11-20), as on the invoice. */}
          {!base && credits.some((c) => c.amount > 0.004) && (
            <Section label="Vendor credit">
              {credits
                .filter((c) => c.amount > 0.004)
                .map((c, i) => (
                  <div key={`${c.account}-${i}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>Vendor credit</span>
                      <span className="text-[12px] tabular-nums text-violet-700" style={{ fontWeight: 600 }}>
                        −{formatMoney(c.amount, currency)} <span className="text-slate-400" style={{ fontWeight: 400 }}>=</span> −{formatMoney(toBase(c.amount, c.rate), BASE_CURRENCY)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      Paid at 1 {currency} = {baseRate(c.rate)} {BASE_CURRENCY}. It's applied at that rate.
                    </p>
                  </div>
                ))}
            </Section>
          )}

          <Section label="Pay from">
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {ordered.map((a) => {
                const reason = payFromBlockReason(a.currency, currency);
                const selected = a.id === accountId;
                const Icon = a.type === 'cash' ? Banknote : a.type === 'card' ? Wallet : Landmark;
                const row = (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!!reason || readOnly}
                    onClick={() => setAccountId(a.id)}
                    aria-pressed={selected}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      reason ? 'opacity-50 cursor-not-allowed bg-slate-50/60' : selected ? 'bg-blue-50' : readOnly ? 'cursor-default' : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-[12px] truncate ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>{a.label}</span>
                        <CurrencyFlag code={a.currency} size={12} />
                        <span className="text-[10.5px] text-slate-500" style={{ fontWeight: 600 }}>{a.currency}</span>
                        {!reason && a.currency === youPayIn && (
                          <span className="text-[9.5px] px-1.5 py-px rounded-full bg-slate-100 text-slate-500" style={{ fontWeight: 600 }}>You pay in</span>
                        )}
                      </span>
                      <span className="block text-[10.5px] text-slate-400 truncate">
                        {reason ?? (convertsAtBank(a.currency, currency) ? 'The bank converts: two amounts' : base ? 'No conversion' : 'Nothing converts: one amount')}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{formatMoney(a.balance, a.currency)}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
                return reason ? (
                  <Tooltip key={a.id}>
                    <TooltipTrigger asChild>
                      <div>{row}</div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                      <p className="text-[11px] text-slate-500 leading-snug">{reason}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  row
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {base
                ? `Only ${BASE_CURRENCY} accounts can pay a ${BASE_CURRENCY} invoice.`
                : `Only a ${currency} account or a ${BASE_CURRENCY} account can pay. ${youPayIn} is the default, from the PO.`}
            </p>
          </Section>


          {!base && (
            <Section label="Rate">
              {converts ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-600" />
                      <span className="text-sky-700" style={{ fontWeight: 600 }}>Bank's rate</span>
                      <span className="text-slate-500 truncate">· worked out from the two amounts</span>
                    </div>
                    <BankConversionLine
                      className="mt-1.5"
                      currency={currency}
                      vendorReceives={vendorReceives}
                      accountCurrency={accountCurrency}
                      bankTook={took}
                      dayRate={dayRate}
                      paymentDate={paymentDate}
                    />
                  </div>
                  <RateCard
                    from={currency}
                    rate={dayRate}
                    type="mid"
                    source={RATE_PROVIDER}
                    caption={`The mid-market rate on ${formatRateDate(paymentDate)}, the payment date, for comparison.`}
                    amount={vendorReceives}
                  />
                </>
              ) : (
                <RateCard
                  from={currency}
                  rate={dayRate}
                  type="mid"
                  source={RATE_PROVIDER}
                  caption={`Nothing converts. The ${currency} paid are valued at the ${formatRateDate(paymentDate)} mid-market rate in the base-currency ledger.`}
                  amount={vendorReceives}
                />
              )}
            </Section>
          )}

          {!base && fx && (
            <Section label="FX difference at payment">
              <div className="rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'rgba(241,245,249,0.5)', borderColor: '#EEF2F6' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-slate-600" style={{ fontWeight: 600 }} title={FX_GAIN_LOSS_TIP}>
                    {gainLossOf(fx.amount) === 'gain' ? 'FX Gain' : gainLossOf(fx.amount) === 'loss' ? 'FX Loss' : 'No difference'}
                  </span>
                  <GainLossFigure amount={fx.amount} size={12.5} />
                </div>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 tabular-nums">
                  <div className="flex justify-between gap-3">
                    <span>
                      A/P carried at {invoiceRates.length === 1 ? `the invoice rate, ${baseRate(invoiceRates[0].rate)}${invoiceRates[0].rateDate ? ` (${formatRateDate(invoiceRates[0].rateDate)})` : ''}` : `${invoiceRates.length} invoice rates`}
                    </span>
                    <span className="text-slate-700">{formatMoney(fx.carried, BASE_CURRENCY)}</span>
                  </div>
                  {fx.credit > 0.004 && (
                    <div className="flex justify-between gap-3">
                      <span>Vendor credit, at the rates it was paid</span>
                      <span className="text-slate-700">−{formatMoney(fx.credit, BASE_CURRENCY)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span>{converts ? 'Paid: what the bank took' : `Paid: at the ${formatRateDate(paymentDate)} rate`}</span>
                    <span className="text-slate-700">−{formatMoney(fx.cost, BASE_CURRENCY)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5">
                  {gainLossOf(fx.amount) === 'gain'
                    ? 'Paying cost less in the base currency than A/P carried: a gain.'
                    : gainLossOf(fx.amount) === 'loss'
                      ? 'Paying cost more in the base currency than A/P carried: a loss.'
                      : 'Paying cost what A/P carried: nothing to post.'}
                  {gainLossOf(fx.amount) === 'gain' ? ' Posts to FX Gain.' : gainLossOf(fx.amount) === 'loss' ? ' Posts to FX Loss.' : ''}
                </p>
              </div>
            </Section>
          )}

          {base ? (
            <p className="text-[11.5px] text-slate-500">{BASE_CURRENCY} is the base currency, so this payment converts nothing and posts no FX Gain or FX Loss.</p>
          ) : (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed" style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
              <Lock className="w-3 h-3 mt-[3px] shrink-0" />
              <span>
                {readOnly
                  ? `This payment posted: ${converts && took != null ? bankConversionText(took, vendorReceives, currency) : `${formatMoney(vendorReceives, currency)} from the ${currency} account at ${rateSentence(currency, dayRate)}`}.`
                  : "The vendor always receives the invoice's currency, whichever account pays. The rate and the FX Gain or FX Loss lock when the payment posts."}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          {readOnly ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-800 cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset to default
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#0A77FF' }}
              >
                Save configuration
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
