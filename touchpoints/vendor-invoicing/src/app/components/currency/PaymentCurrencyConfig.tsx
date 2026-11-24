import * as React from 'react';
import { AlertCircle, AlertTriangle, RotateCcw, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { MoneyInput } from '@/app/components/payments/MoneyInput';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { RATE_PROVIDER, toBase } from '@/app/currency/rates';
import {
  OTHER_CURRENCY_NOTE,
  bankRateNeedsReview,
  convertsAtBank,
  derivedRate,
  payFromBlockReason,
  rateGapPct,
  realizedFxOf,
  type CreditUsed,
  type SettledLine,
} from '@/app/currency/paymentRules';
import { AmountBox, LockedCurrency, RateCard, Section, VarianceCard, baseRate, rateAsOfLine } from './InvoiceCurrencyConfig';
import { CurrencyBlock, PAYMENT_FX_VARIANCE_TITLE, RateTypeChip, type CurrencyBlockRow } from './CurrencyBlock';
import { PayFromAccountPicker } from './PayFromAccountPicker';

/* ── A payment's currency: the currency block and Currency Configuration ──
 * The payment counterpart of the invoice's (InvoiceCurrencyConfig), in the
 * Currency Touchpoints Map's shape (24 Nov 2026), on the payment rules
 * (currency/paymentRules.ts):
 *  - "Pay from": the account, in the invoices' currency or the base. Only
 *    those are offered; the PO's "You pay in" (or the invoice's own pay-from
 *    account) picked the default.
 *  - "Vendor receives": the invoices' currency, fixed.
 *  - "You pay in": the account's currency (the account on hover). "Base
 *    equivalent", always shown: from a base account, what the bank took
 *    (entered, else the payment date's mid-market estimate); from an account
 *    in the invoices' currency, the amount at the payment date's rate.
 *  - "Exchange rate": worked out from the two amounts, or the payment date's
 *    mid-market rate when nothing converts. No lock on the rate (25 Nov
 *    2026); the configuration is read-only once the payment posts.
 *  - "FX variance": what A/P carried at the invoice rates against what paying
 *    cost. + is a gain (FX Gain), − a loss (FX Loss).
 * In Record Payment the dialog edits the account and the bank's figure
 * (Save writes them back). The dialog reads Pay from, Vendor receives, Base
 * equivalent (from a base account, what the bank took), [Vendor credit],
 * FX variance, Exchange rate. On a saved payment it is read-only. A payment of
 * base-currency invoices converts nothing. */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "invoice rate 279.5200 → 280.2200" */
export function paymentRatesText(lines: Pick<SettledLine, 'rate'>[], paidRate: number): string {
  const rates = Array.from(new Set(lines.map((l) => l.rate))).sort((a, b) => a - b);
  const from =
    rates.length === 0
      ? 'invoice rate'
      : rates.length === 1
        ? `invoice rate ${formatRate(rates[0])}`
        : `invoice rates ${formatRate(rates[0])} to ${formatRate(rates[rates.length - 1])}`;
  return `${from} → ${formatRate(paidRate)}`;
}

/* ── The currency block (payment) ──────────────────────────────────── */

export interface PaymentCurrencyBlockProps {
  /** The invoices' currency: what the vendor receives. */
  currency: string;
  /** The cash the vendor receives, in it. */
  vendorReceives: number;
  /** The pay-from account. */
  account?: Pick<PayFromAccount, 'label' | 'currency'> | null;
  /** From a base account: what the bank took (the estimate until entered). */
  bankTook?: number | null;
  /** The payment's rate: worked out from the two amounts, or the day's. */
  rate: number;
  paymentDate: string;
  /** The invoices settled, for the variance's hover ("invoice rate X → Y"). */
  lines?: Pick<SettledLine, 'rate'>[];
  /** The FX variance (above zero a gain); null with nothing to compare. */
  realized?: number | null;
  /** The payment has posted. The block shows no lock (25 Nov 2026). */
  locked: boolean;
  /** A saved payment reads in the past tense: "Vendor received", "You paid". */
  past?: boolean;
  /** The Rate row's qualifier; by default "from the two amounts" or "payment date". */
  qualifier?: string;
  onViewConfig?: () => void;
  className?: string;
}

/** Vendor receives / You pay in / Base equivalent / [FX variance] / Exchange rate. */
export function PaymentCurrencyBlock({
  currency,
  vendorReceives,
  account,
  bankTook,
  rate,
  paymentDate,
  lines = [],
  realized,
  past = false,
  qualifier,
  onViewConfig,
  className = '',
}: PaymentCurrencyBlockProps) {
  const code = currency.toUpperCase();
  const accountCurrency = account?.currency ?? BASE_CURRENCY;
  const converts = convertsAtBank(accountCurrency, code);
  const cost = converts ? round2(bankTook ?? toBase(vendorReceives, rate)) : toBase(vendorReceives, rate);
  const rows: CurrencyBlockRow[] = [{ label: past ? 'Vendor received' : 'Vendor receives', code, amount: vendorReceives }];
  // Currency information (25 Nov 2026): the currency you pay in (the
  // account's, the account on hover), then the base equivalent, always
  // shown: from a base account, what the bank took.
  rows.push({
    label: past ? 'You paid in' : 'You pay in',
    code: accountCurrency,
    title: account ? `From ${account.label} (${account.currency})${converts ? '; the base equivalent is what the bank took' : ''}` : undefined,
  });
  rows.push({
    label: 'Base equivalent',
    code: BASE_CURRENCY,
    amount: cost,
    title: converts ? `What the bank took${account ? ` from ${account.label}` : ''}` : `At the ${formatRateDate(paymentDate)} rate`,
  });
  return (
    <CurrencyBlock
      className={className}
      currency={code}
      rateType="mid"
      rateTip={
        converts
          ? `Mid-market is the rate type. Paid from a ${BASE_CURRENCY} account, the rate comes from the two amounts: what the vendor receives and what the bank took.`
          : `The mid-market rate on ${formatRateDate(paymentDate)}, the payment date · ${RATE_PROVIDER}`
      }
      rows={rows}
      variance={realized != null ? { amount: realized, title: `${paymentRatesText(lines, rate)}. ${PAYMENT_FX_VARIANCE_TITLE}` } : null}
      rate={{ rate, qualifier: qualifier ?? (converts ? 'from the two amounts' : 'payment date') }}
      onViewConfig={onViewConfig}
    />
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
  /** "PMT-000121", or the next payment number in Record Payment. */
  documentLabel: string;
  /** "INV-000221", the invoices it pays, for the subtitle. */
  invoiceLabel?: string;
  vendorName: string;
  /** The invoices' currency, what the vendor receives. */
  currency: string;
  /** The cash, in the invoices' currency. */
  vendorReceives: number;
  /** The accounts to offer; only those that may pay are listed. */
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
  /** A saved payment that posted: its configuration is read-only. */
  posted?: boolean;
  onSave?: (next: PaymentCurrencyChoice) => void;
}

export function PaymentCurrencyConfigDialog(props: PaymentCurrencyConfigDialogProps) {
  const {
    open,
    onOpenChange,
    documentLabel,
    invoiceLabel,
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
    posted = false,
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
  // Only an account in the invoices' currency or in base is offered (rule 3).
  const eligible = accounts.filter((a) => !payFromBlockReason(a.currency, currency));
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const accountCurrency = account?.currency ?? BASE_CURRENCY;
  const converts = convertsAtBank(accountCurrency, currency);
  const estimate = toBase(vendorReceives, dayRate);
  const took = converts ? bankTook ?? estimate : null;
  const rate = base ? 1 : converts ? derivedRate(vendorReceives, took ?? 0) ?? dayRate : dayRate;
  const cost = base ? round2(vendorReceives) : converts ? round2(took ?? 0) : toBase(vendorReceives, dayRate);
  // A prepayment settles no invoice yet: it is booked at what it cost, so it has no FX variance.
  const fx = base || lines.length === 0 ? null : realizedFxOf(lines, credits, cost);
  const review = converts && bankTook != null && bankRateNeedsReview(rate, dayRate, allowedPct);
  const blocked = review && !canRecordPastAllowed && !readOnly;
  const dirty = !readOnly && (accountId !== value.accountId || (bankTook ?? null) !== (value.bankTook ?? null));
  const canSave = dirty && !blocked && !!account && !payFromBlockReason(accountCurrency, currency);
  const gap = rateGapPct(rate, dayRate);

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
    const def = eligible.find((a) => a.currency === youPayIn) ?? eligible.find((a) => isBaseCurrency(a.currency));
    if (def) setAccountId(def.id);
    setBankTook(null);
  };

  // The configuration is read-only once the payment posts; the rate itself
  // shows no lock (25 Nov 2026).
  const description = posted
    ? "This payment is posted, so its currency configuration can't be changed."
    : readOnly
      ? "This payment can't be changed now, so its currency configuration is read-only."
      : "For this payment only. The invoices' currency stays the same.";

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
              <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                Currency configuration
              </DialogTitle>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                {description}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          {/* The account only (the PO's "You pay in" picked the default). */}
          <Section label="Pay from">
            <PayFromAccountPicker
              value={accountId}
              accounts={eligible}
              onChange={setAccountId}
              readOnly={readOnly}
              documentCurrency={currency}
              ariaLabel="Pay from account"
            />
          </Section>

          <Section label="Vendor receives">
            <div className="flex items-stretch gap-2">
              <AmountBox text={formatMoney(vendorReceives, currency)} />
              <div className="w-[248px] shrink-0">
                <LockedCurrency code={currency} detail="· invoice currency" note={`Fixed: the invoices are in ${currency}. ${OTHER_CURRENCY_NOTE}`} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              What you owe stays in {currency}, so this payment reduces the {currency} balance.
            </p>
          </Section>

          <Section label="Base equivalent">
            {converts && !readOnly ? (
              <>
                {/* From a base account: what the bank took, entered here. */}
                <div
                  className={`h-10 w-full rounded-lg px-3 flex items-center gap-1.5 border bg-white ${
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
                  <span className="text-slate-500 text-[13px] shrink-0">{BASE_CURRENCY}</span>
                  {bankTook != null && (
                    <button type="button" onClick={() => setBankTook(null)} className="text-slate-400 hover:text-primary cursor-pointer" title="Back to the estimate" aria-label="Back to the estimate">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed flex items-start gap-1" style={{ color: blocked ? '#DC2626' : review ? '#B45309' : '#64748B' }}>
                  {blocked && <AlertCircle className="w-3 h-3 mt-[2px] shrink-0" />}
                  {review && !blocked && <AlertTriangle className="w-3 h-3 mt-[2px] shrink-0" />}
                  <span>
                    {blocked
                      ? `The bank's rate is ${Math.abs(gap).toFixed(2)}% from the day's, past the allowed ${allowedPct}%. Your role can't record that; Settings, Permissions sets who can.`
                      : review
                        ? `The bank's rate is ${Math.abs(gap).toFixed(2)}% from the day's, past the allowed ${allowedPct}%: it needs review.`
                        : bankTook == null
                          ? `What the bank took. Estimated at the ${formatRateDate(paymentDate)} mid-market rate until you enter it.`
                          : 'What the bank took.'}
                  </span>
                </p>
              </>
            ) : converts ? (
              <>
                <AmountBox text={`${formatMoney(took ?? 0, BASE_CURRENCY)} ${BASE_CURRENCY}`} />
                <p className="text-[11px] text-slate-500 leading-relaxed">What the bank took.</p>
              </>
            ) : (
              <AmountBox text={`${base ? '' : '≈ '}${formatMoney(cost, BASE_CURRENCY)} ${BASE_CURRENCY}`} />
            )}
          </Section>

          {/* The vendor credit applied, each at the rate it was paid at
              (Mahreen, 2026-11-20), as on the invoice. */}
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

          {!base && fx && (
            <Section label="FX variance">
              <VarianceCard amount={fx.amount} caption={paymentRatesText(lines, rate)}>
                <div className="mt-2 pt-2 border-t border-[#EEF2F6] space-y-0.5 text-[11px] text-slate-500 tabular-nums">
                  <div className="flex justify-between gap-3">
                    <span>A/P carried at the invoice rate{Array.from(new Set(lines.map((l) => l.rate))).length > 1 ? 's' : ''}</span>
                    <span className="text-slate-700">{formatMoney(fx.carried, BASE_CURRENCY)}</span>
                  </div>
                  {fx.credit > 0.004 && (
                    <div className="flex justify-between gap-3">
                      <span>Vendor credit, at the rates it was paid</span>
                      <span className="text-slate-700">−{formatMoney(fx.credit, BASE_CURRENCY)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span>{converts ? 'You pay: what the bank took' : `You pay: at the ${formatRateDate(paymentDate)} rate`}</span>
                    <span className="text-slate-700">−{formatMoney(fx.cost, BASE_CURRENCY)}</span>
                  </div>
                </div>
              </VarianceCard>
            </Section>
          )}

          {/* A payment's rate is mid-market: from the two amounts when the
              bank converts, else the payment date's. No lock on the rate
              (25 Nov 2026). */}
          {!base && (
            <Section label="Exchange rate" right={<RateTypeChip type="mid" />}>
              {converts ? (
                <>
                  <RateCard
                    from={currency}
                    rate={rate}
                    type="mid"
                    source="Worked out from what the bank took"
                    caption={`Rate from the two amounts · ${formatRateDate(paymentDate)}${
                      Math.abs(gap) >= 0.005 ? ` · ${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(2)}% vs the day's mid-market ${formatRate(dayRate)}` : ''
                    }`}
                  />
                  <RateCard
                    from={currency}
                    rate={dayRate}
                    type="mid"
                    source={RATE_PROVIDER}
                    caption={`${rateAsOfLine('mid', paymentDate)} · for comparison`}
                    amount={vendorReceives}
                  />
                </>
              ) : (
                <RateCard from={currency} rate={rate} type="mid" source={RATE_PROVIDER} caption={rateAsOfLine('mid', paymentDate)} />
              )}
            </Section>
          )}

          {base && (
            <p className="text-[11.5px] text-slate-500">{BASE_CURRENCY} is the base currency, so this payment converts nothing and posts no FX variance.</p>
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
              Reset
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
                disabled={dirty && !canSave}
                className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#0A77FF' }}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
