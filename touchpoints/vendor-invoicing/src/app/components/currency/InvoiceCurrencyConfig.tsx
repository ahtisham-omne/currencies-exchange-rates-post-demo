import * as React from 'react';
import { AlertCircle, Lock, Pencil, RotateCcw, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, rateOn, toBase, type RateQuote, type RateType } from '@/app/currency/rates';
import { fxVarianceOf, gainLossOf, type FxVariance, type LockedPrepayment, type ReceiptValue } from '@/app/currency/fxVariance';
import { rateChangePct } from '@/app/hooks/useApSettings';
import type { InvoiceRateBasis } from '@/app/data/mockInvoices';
import { CurrencyFlag } from './CurrencyChip';
import { linkProvider } from './ProviderLink';
import { CurrencyPicker, PoRateCompare, RateTypeToggle, type CurrencySource } from './InvoiceCurrencyFields';

/* ── An invoice's currency: summary card and Currency Configuration ────
 * Modelled on Purchase Orders' Order Summary card and Currency Configuration
 * dialog (POCurrencyConfig), on this module's invoice model, in the layout
 * Mahreen set on 2026-11-20 (the create screen keeps only the Currency button):
 *  - "Vendor invoices": the invoice's currency, the PO's by default (else the
 *    vendor's), and not locked: changing it converts every line at the rate
 *    day's mid-market cross rate when saved (CreateInvoiceScreen).
 *  - "Exchange rate": mid-market (read-only) or corporate (typed if the role
 *    may change an invoice's rate, within its ± limit; Settings, Permissions),
 *    with who set a corporate rate and since when, the day it's taken on (the
 *    Rate as of date from Settings, Module defaults) and the PO comparison.
 *  - "Prepayment": each one deducted at the rate it was paid at.
 *  - "You pay": what A/P is booked at in the base currency. The account it's
 *    paid from is picked on the payment.
 *  - "FX difference at invoice": the unpaid goods at the receiving date's rate
 *    against the invoice rate (currency/fxVariance.ts).
 * On the create screen the dialog edits the form's currency and rate (Save
 * configuration writes them back). On a saved invoice it is read-only: the
 * rate locked when the invoice posted, and Edit Invoice is the way to change
 * it while the invoice still allows edits. */

const RATE_HEX: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };
const RATE_TINT: Record<RateType, string> = { mid: 'rgba(124,58,237,0.08)', corporate: 'rgba(180,83,9,0.10)' };

/** "₨355.4200" */
export const baseRate = (rate: number) => `${moneyPrefix(BASE_CURRENCY).trim()}${formatRate(rate)}`;

/** "£10,000.00 GBP": an amount with its code, as the cards write it. */
const withCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

export function RateTypeChip({ type }: { type: RateType }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
      style={{ color: RATE_HEX[type], backgroundColor: RATE_TINT[type], fontWeight: 600 }}
    >
      <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );
}

/** [Gain] / [Loss] beside an FX Variance (or a payment's FX Gain/Loss). */
export function GainLossTag({ amount }: { amount: number }) {
  const k = gainLossOf(amount);
  if (k === 'none') return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-px rounded border text-[10px] shrink-0"
      style={{
        fontWeight: 600,
        backgroundColor: k === 'gain' ? '#ECFDF5' : '#FEF2F2',
        color: k === 'gain' ? '#047857' : '#B91C1C',
        borderColor: k === 'gain' ? '#A7F3D0' : '#FECACA',
      }}
    >
      {k === 'gain' ? 'Gain' : 'Loss'}
    </span>
  );
}

/** "+₨34,646.00" / "−₨2,180.00" */
export const signedBase = (amount: number) => {
  const k = gainLossOf(amount);
  return `${k === 'gain' ? '+' : k === 'loss' ? '−' : ''}${formatMoney(Math.abs(amount), BASE_CURRENCY)}`;
};

const FX_VARIANCE_TIP =
  'The goods in the base currency at the receiving rate, against the same goods at the invoice rate. Owing less than receiving booked is a gain, more is a loss. It posts to FX Variance; stock keeps its receiving value. A prepaid part keeps its locked rate and makes no variance.';

/* ── Summary card: CURRENCY ────────────────────────────────────────── */

export interface InvoiceCurrencySummaryProps {
  currency: string;
  /** The invoice total, in its currency. */
  total: number;
  /** Prepayments applied, in its currency. */
  prepaid?: number;
  /** The invoice's rate (null while it has none) and where it is from. */
  rate: number | null;
  rateType: RateType;
  rateDate?: string;
  /** "vendor invoice date", "receiving date"… */
  dateLabel?: string;
  /** No rate yet: a pre-invoice takes its rate when paid. */
  pending?: boolean;
  /** The rate changed on the invoice from the rate table. */
  rateEdited?: boolean;
  /** The rate difference on received goods, at this rate. */
  variance?: FxVariance | null;
  /** The invoice has posted: its rate is fixed. */
  locked?: boolean;
  onViewConfig: () => void;
  className?: string;
}

export function InvoiceCurrencySummary({
  currency,
  total,
  prepaid = 0,
  rate,
  rateType,
  rateDate,
  dateLabel,
  pending,
  rateEdited,
  variance,
  locked,
  onViewConfig,
  className = '',
}: InvoiceCurrencySummaryProps) {
  const isBase = isBaseCurrency(currency);
  const rest = Math.max(0, Math.round((total - prepaid) * 100) / 100);
  const rows: { label: string; code: string; text: string; tone?: string }[] = [{ label: 'Vendor bills', code: currency, text: withCode(total, currency) }];
  if (prepaid > 0.004) rows.push({ label: 'Prepaid', code: currency, text: `−${withCode(prepaid, currency)}`, tone: '#6D28D9' });
  if (!isBase && rate != null && !pending) rows.push({ label: prepaid > 0.004 ? 'Rest to A/P' : 'Posts to A/P', code: BASE_CURRENCY, text: withCode(toBase(rest, rate), BASE_CURRENCY) });
  const receivedRates = variance ? Array.from(new Set(variance.rest.map((r) => r.rate))) : [];
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
          Currency
        </span>
        <div className="flex items-center gap-1.5">
          {!isBase && !pending && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <RateTypeChip type={rateType} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                {rateType === 'mid'
                  ? `The mid-market rate on ${formatRateDate(rateDate)}, the ${dateLabel ?? 'Rate as of date'} · ${RATE_PROVIDER}`
                  : rateEdited
                    ? `A corporate rate entered on this invoice (${formatRateDate(rateDate)})`
                    : (() => {
                        const c = corporateRateOn(currency, rateDate);
                        return c
                          ? `Corporate · Set by ${c.setBy} · In effect since ${formatRateDate(c.effectiveDate)}`
                          : `Corporate rate on ${formatRateDate(rateDate)}, the ${dateLabel ?? 'Rate as of date'}`;
                      })()}
              </TooltipContent>
            </Tooltip>
          )}
          {locked && !isBase && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
              style={{ color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 }}
              title="Fixed when the invoice posted. A/P is in the base currency at this rate, and payments are compared against it."
            >
              <Lock className="w-2.5 h-2.5" />
              Locked
            </span>
          )}
        </div>
      </div>

      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>{r.label}</p>
          <p className="flex items-center gap-1.5 tabular-nums" style={{ fontSize: 12, fontWeight: 500, color: r.tone ?? '#334155' }}>
            <CurrencyFlag code={r.code} size={11} />
            {r.text}
          </p>
        </div>
      ))}

      {isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <div className="border-t border-slate-100 pt-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>Rate</p>
            <div className="text-right">
              {pending || rate == null ? (
                <p className="text-slate-400 italic" style={{ fontSize: 11 }}>{pending ? 'Set when paid' : 'Enter a rate'}</p>
              ) : (
                <p className="text-slate-600 tabular-nums" style={{ fontSize: 11, fontWeight: 500 }}>1 {currency} = {baseRate(rate)} {BASE_CURRENCY}</p>
              )}
              {!pending && rateDate && (
                <p className="text-slate-400" style={{ fontSize: 10 }}>{formatRateDate(rateDate)}{dateLabel ? ` · ${dateLabel}` : ''}</p>
              )}
            </div>
          </div>
          {variance && receivedRates.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10.5, fontWeight: 500 }}>Received at</p>
              <div className="text-right">
                {receivedRates.length === 1 ? (
                  <p className="text-slate-600 tabular-nums" style={{ fontSize: 11, fontWeight: 500 }}>1 {currency} = {baseRate(receivedRates[0])} {BASE_CURRENCY}</p>
                ) : (
                  <p className="text-slate-600" style={{ fontSize: 11, fontWeight: 500 }}>{receivedRates.length} receiving rates</p>
                )}
                <p className="text-slate-400" style={{ fontSize: 10 }}>
                  {Array.from(new Set(variance.rest.map((r) => r.date))).sort().map((d) => formatRateDate(d)).join(', ')} · receiving
                </p>
              </div>
            </div>
          )}
          {variance && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-slate-400 inline-flex items-center gap-1 cursor-help" style={{ fontSize: 10.5, fontWeight: 500 }} title={FX_VARIANCE_TIP}>
                FX Variance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GainLossTag amount={variance.amount} />
                <span className="tabular-nums text-slate-700" style={{ fontSize: 12, fontWeight: 600 }}>
                  {gainLossOf(variance.amount) === 'none' ? 'None' : signedBase(variance.amount)}
                </span>
              </span>
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

export function Section({ label, right, children }: { label?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      {(label || right) && (
        <div className="flex items-center gap-2">
          {label && <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>}
          {right && <span className="ml-auto inline-flex">{right}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The amount (read-only) beside the currency it's in. */
export function AmountRow({ amount, code, side }: { amount: number; code: string; side: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
        style={{ fontWeight: 500 }}
        aria-readonly="true"
      >
        <span className="truncate">{formatMoney(amount, code)}</span>
      </div>
      <div className="w-[200px] shrink-0">{side}</div>
    </div>
  );
}

/** A currency shown where a picker would be, locked (from the PO, or the base). */
export function LockedCurrency({ code, note }: { code: string; note: string }) {
  const cur = getCurrency(code);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2 border border-slate-200 bg-slate-50 cursor-not-allowed">
          <CurrencyFlag code={code} size={18} />
          <span style={{ fontWeight: 500 }}>{code}</span>
          <span className="text-slate-500 truncate">{cur?.name}</span>
          <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        <p className="text-[11px] text-slate-500 leading-snug">{note}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** One rate, as the Exchange Rates module writes it, with what it is for. */
export function RateCard({
  from,
  rate,
  type,
  source,
  caption,
  amount,
}: {
  from: string;
  rate: number;
  type: RateType;
  source: string;
  /** "Rate on Oct 16, 2025, the vendor invoice date" */
  caption: string;
  /** What this rate converts, in `from` and base. */
  amount?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
        <span style={{ color: RATE_HEX[type], fontWeight: 600 }}>{RATE_TYPE_LABEL[type]}</span>
        <span className="text-slate-500 truncate">· {linkProvider(source)}</span>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
          <div>1 {from} = {baseRate(rate)} {BASE_CURRENCY}</div>
          <div className="text-slate-500" style={{ fontWeight: 400 }}>1 {BASE_CURRENCY} = {formatRate(1 / rate)} {from}</div>
        </div>
        {amount != null && amount > 0 && (
          <div className="text-right text-[11px] tabular-nums leading-5">
            <div className="text-slate-500">{formatMoney(amount, from)}</div>
            <div className="text-slate-700" style={{ fontWeight: 600 }}>{formatMoney(toBase(amount, rate), BASE_CURRENCY)}</div>
          </div>
        )}
      </div>
      <p className="mt-1 text-[10.5px] text-slate-400">{caption}</p>
    </div>
  );
}

export interface InvoiceCurrencyChoice {
  currency: string;
  rateType: RateType;
  /** A corporate rate typed on the invoice; null keeps the rate table's. */
  typedRate: string | null;
}

export interface InvoiceCurrencyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "INV-000218", or "this invoice" on the create screen. */
  documentLabel: string;
  vendorName: string;
  /** The vendor's default currency, from the partner record. */
  vendorDefault: string;
  /** The invoice total, in its currency. */
  total: number;
  /** Where the currency comes from: the PO (locked) or the vendor. */
  source: CurrencySource;
  /** The invoice's currency and rate as they stand. */
  value: InvoiceCurrencyChoice;
  /** The Rate as of date and its basis (the rate line states them). */
  rateAsOf?: { date: string | undefined; basis: InvoiceRateBasis; wanted?: InvoiceRateBasis };
  /** The day the rate is taken on (the Rate as of date, or today while pending). */
  rateDay: string;
  /** What the rate date is, for captions ("vendor invoice date"). */
  dateLabel: string;
  /** A pre-invoice: its rate is taken when it is paid. */
  pending?: boolean;
  /** The PO's own rate, for the "vs PO" chip. */
  po?: { poNumber: string; rate: number; date: string } | null;
  /** What receiving booked for the goods (each receiving's date and rate). */
  receipts?: ReceiptValue[];
  /** Prepayments applied, each at its locked rate. */
  prepayments?: LockedPrepayment[];
  /** Settings › Permissions: whether the acting role may change the rate, and how far. */
  canEditRate: boolean;
  limitPct: number | null;
  /** A saved invoice: nothing changes here. The saved rate (and whether it was
   *  changed on the invoice) is in `value`/`savedRate`. */
  readOnly?: boolean;
  /** The saved invoice's rate (read-only mode). */
  savedRate?: { rate: number; rateType: RateType; rateDate: string; edited?: boolean; source?: string };
  /** A saved invoice that has posted (its rate is locked), as against one
   *  still pending approval. */
  posted?: boolean;
  /** Read-only: open the invoice's edit screen, where currency and rate change. */
  onEdit?: () => void;
  /** Editable: write the choice back to the form. */
  onSave?: (next: InvoiceCurrencyChoice) => void;
}

export function InvoiceCurrencyConfigDialog(props: InvoiceCurrencyConfigDialogProps) {
  const {
    open,
    onOpenChange,
    documentLabel,
    vendorDefault,
    total,
    source,
    value,
    rateDay,
    dateLabel,
    pending = false,
    po,
    receipts = [],
    prepayments = [],
    canEditRate,
    limitPct,
    readOnly = false,
    savedRate,
    posted = false,
    onEdit,
    onSave,
  } = props;

  const [currency, setCurrency] = React.useState(value.currency);
  const [rateType, setRateType] = React.useState<RateType>(value.rateType);
  const [typed, setTyped] = React.useState<string | null>(value.typedRate);

  React.useEffect(() => {
    if (!open) return;
    setCurrency(value.currency);
    setRateType(value.rateType);
    setTyped(value.typedRate);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const foreign = !isBaseCurrency(currency);
  const currencyChanged = currency !== value.currency;
  // The rate the draft would carry, exactly as the form works it out.
  const quote: RateQuote = rateOn(currency, rateDay, rateType);
  const typedNum = typed != null && typed.trim() !== '' ? Number(typed) : null;
  const draftRate: number | null = readOnly && savedRate
    ? savedRate.rate
    : !foreign
      ? 1
      : rateType === 'corporate' && typed != null
        ? typedNum != null && typedNum > 0 ? typedNum : null
        : quote.rate;
  const draftType: RateType = readOnly && savedRate ? savedRate.rateType : rateType;
  const draftDate = readOnly && savedRate ? savedRate.rateDate : rateDay;
  const edited = readOnly ? !!savedRate?.edited : rateType === 'corporate' && typedNum != null && typedNum !== quote.rate;
  const overLimit =
    !readOnly && foreign && edited && canEditRate && limitPct != null && quote.rate != null && typedNum != null &&
    Math.abs(rateChangePct(typedNum, quote.rate)) > limitPct + 1e-9;
  const missing = !readOnly && foreign && !pending && draftRate == null;
  // No corporate rate on the day, and this role can't type one.
  const blockedNoRate = !readOnly && foreign && !pending && rateType === 'corporate' && !canEditRate && quote.rate == null;

  // A changed currency converts the invoice at the rate day's mid-market cross
  // rate when saved (as a PO converts its lines); shown converted here.
  const midOf = (code: string) => (isBaseCurrency(code) ? 1 : rateOn(code, rateDay, 'mid').rate ?? 1);
  const k = currencyChanged ? midOf(value.currency) / midOf(currency) : 1;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const shownTotal = r2(total * k);
  // Receivings and prepayments, read in the draft currency at the base
  // values they were booked at; a prepayment remembers what it was paid in.
  const draftReceipts = k === 1 ? receipts : receipts.map((r) => ({ ...r, amount: r2(r.amount * k), rate: r.rate / k }));
  const draftPrepayments: LockedPrepayment[] =
    k === 1
      ? prepayments
      : prepayments.map((p) => ({ ...p, amount: p.amount * k, rate: p.rate / k, paid: p.paid ?? { currency: value.currency, rate: p.rate } }));
  const variance = foreign && draftRate != null && !pending
    ? fxVarianceOf({ currency, invoiceRate: draftRate, invoiceDate: draftDate, receipts: draftReceipts, prepayments: draftPrepayments })
    : null;
  const prepaid = Math.min(shownTotal, r2(draftPrepayments.reduce((s, p) => s + p.amount, 0)));
  const prepaidBase = r2(draftPrepayments.reduce((s, p) => s + toBase(p.amount, p.rate), 0));
  const rest = Math.max(0, Math.round((shownTotal - prepaid) * 100) / 100);

  const dirty = !readOnly && (currencyChanged || rateType !== value.rateType || (typed ?? null) !== (value.typedRate ?? null));
  const canSave = dirty && !missing && !overLimit;

  const save = () => {
    if (readOnly || !dirty) {
      onOpenChange(false);
      return;
    }
    if (!canSave) return;
    onSave?.({ currency, rateType, typedRate: rateType === 'corporate' ? typed : null });
    onOpenChange(false);
  };

  const reset = () => {
    setCurrency(source.kind === 'po' ? source.currency ?? value.currency : vendorDefault);
    setRateType('mid');
    setTyped(null);
  };

  // "Mid-market · Open Exchange Rates", "Corporate · Set by Ahtisham Ahmad ·
  // In effect since Apr 01, 2026" (Mahreen, 2026-11-20: the person, not
  // "Finance's corporate rate").
  const corporate = draftType === 'corporate' ? corporateRateOn(currency, draftDate) : undefined;
  const rateSource =
    draftType === 'mid'
      ? RATE_PROVIDER
      : edited
        ? 'Entered on this invoice'
        : corporate
          ? `Set by ${corporate.setBy} · In effect since ${formatRateDate(corporate.effectiveDate)}`
          : readOnly
            ? savedRate?.source ?? 'Corporate rate'
            : `No corporate rate for ${currency} on ${formatRateDate(draftDate)}`;
  const poCompare = po && !currencyChanged && draftRate != null && !pending ? po : null;
  const outcome = variance ? gainLossOf(variance.amount) : 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[580px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
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
                {/* Only once the invoice has posted: that's when the rate locks. */}
                {posted && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}
              </div>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Applies to {documentLabel} only. The vendor's default currency ({vendorDefault}) doesn't change.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Vendor invoices">
            <AmountRow
              amount={shownTotal}
              code={currency}
              side={
                readOnly ? (
                  <LockedCurrency code={currency} note="The currency this invoice was entered in. Edit the invoice to change it." />
                ) : (
                  <CurrencyPicker
                    value={currency}
                    onChange={(c) => {
                      setCurrency(c);
                      setTyped(null);
                    }}
                    ariaLabel="Vendor invoices currency"
                    className="!mt-0 !h-10"
                  />
                )
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {source.kind === 'po' ? `Defaults to the currency on ${source.ref}.` : "Defaults to the vendor's currency."}
              {readOnly ? '' : ' Change it if the vendor invoiced in another currency.'}
              {currencyChanged
                ? ` Saving converts every line from ${value.currency} at the ${formatRateDate(rateDay)} mid-market rate.`
                : ''}
            </p>
          </Section>

          {foreign && (
            <Section
              label="Exchange rate"
              right={
                readOnly || pending ? (
                  !pending && <RateTypeChip type={draftType} />
                ) : (
                  <RateTypeToggle
                    value={rateType}
                    onChange={(t) => {
                      setRateType(t);
                      setTyped(null);
                    }}
                  />
                )
              }
            >
              {pending ? (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  A pre-invoice takes its rate when it's paid.
                  {quote.rate != null && rateType === 'mid' ? ` Today's mid-market rate is ${rateSentence(currency, quote.rate)}.` : ''}
                </p>
              ) : (
                <>
                  {/* A corporate rate can be typed where the role may change it. */}
                  {!readOnly && rateType === 'corporate' && canEditRate && (
                    <div
                      className={`h-10 w-full rounded-lg px-3 flex items-center gap-1.5 text-[13px] bg-white border ${
                        missing || overLimit ? 'border-red-400 ring-2 ring-red-100' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
                      }`}
                    >
                      <span className="text-slate-500 whitespace-nowrap shrink-0">1 {currency} = {moneyPrefix(BASE_CURRENCY).trim()}</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Corporate rate, ${BASE_CURRENCY} per 1 ${currency}`}
                        value={typed ?? (quote.rate != null ? formatRate(quote.rate).replace(/,/g, '') : '')}
                        placeholder="Enter rate"
                        onChange={(e) => setTyped(e.target.value.replace(/[^\d.]/g, ''))}
                        onBlur={() => {
                          if (typed != null && quote.rate != null && typed.trim() !== '' && Number(typed) === quote.rate) setTyped(null);
                        }}
                        className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-slate-700"
                        style={{ fontWeight: 500 }}
                      />
                      <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>
                      {edited && quote.rate != null && (
                        <button
                          type="button"
                          onClick={() => setTyped(null)}
                          className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
                          title={`Back to the corporate rate, ${formatRate(quote.rate)}`}
                          aria-label="Reset to the corporate rate"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RATE_HEX[draftType] }} />
                      <span className="shrink-0" style={{ color: RATE_HEX[draftType], fontWeight: 600 }}>{RATE_TYPE_LABEL[draftType]}</span>
                      <span className="text-slate-500 min-w-0">· {linkProvider(rateSource)}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
                      {draftRate != null ? (
                        <>
                          1 {currency} = {formatRate(draftRate)} {BASE_CURRENCY}
                          <span className="text-slate-500" style={{ fontWeight: 400 }}>
                            {' '}· 1 {BASE_CURRENCY} = {(1 / draftRate).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {currency}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400" style={{ fontWeight: 400 }}>No rate yet</span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10.5px] text-slate-400">
                      <span>Rate on {formatRateDate(draftDate)}, the {dateLabel}</span>
                      {poCompare && draftRate != null && (
                        <>
                          <span>·</span>
                          <PoRateCompare currency={currency} invoiceRate={draftRate} invoiceDate={draftDate} po={poCompare} />
                        </>
                      )}
                    </div>
                  </div>
                  {(overLimit || blockedNoRate || missing) && (
                    <p className="flex items-center gap-1 text-[11px] text-red-500" style={{ fontWeight: 500 }}>
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {overLimit && limitPct != null
                        ? `More than ±${limitPct}% from the corporate rate, your limit.`
                        : blockedNoRate
                          ? `No corporate rate for ${currency} on ${formatRateDate(draftDate)}, and your role can't enter one.`
                          : rateType === 'corporate' && quote.rate == null
                            ? `No corporate rate for ${currency} on ${formatRateDate(draftDate)}. Enter the rate to use.`
                            : 'Enter a rate above zero.'}
                    </p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Each prepayment at the rate it was paid at (Mahreen, 2026-11-20). */}
          {foreign && !pending && draftPrepayments.length > 0 && (
            <Section label="Prepayment">
              {draftPrepayments.map((p, i) => (
                <div key={`${p.invoiceNumber}-${i}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{p.invoiceNumber}</span>
                    <span className="text-[12px] tabular-nums text-violet-700" style={{ fontWeight: 600 }}>
                      −{formatMoney(p.amount, currency)} <span className="text-slate-400" style={{ fontWeight: 400 }}>=</span> −{formatMoney(toBase(p.amount, p.rate), BASE_CURRENCY)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Paid{p.rateDate ? ` ${formatRateDate(p.rateDate)}` : ''} at 1 {p.paid?.currency ?? currency} = {baseRate(p.paid?.rate ?? p.rate)} {BASE_CURRENCY}. It's deducted at the rate it was paid at, not the invoice rate.
                  </p>
                </div>
              ))}
            </Section>
          )}

          <Section label="You pay">
            <AmountRow
              amount={foreign && draftRate != null && !pending ? toBase(rest, draftRate) : rest}
              code={foreign && draftRate != null && !pending ? BASE_CURRENCY : currency}
              side={
                <LockedCurrency
                  code={foreign && draftRate != null && !pending ? BASE_CURRENCY : currency}
                  note="A/P is kept in the base currency. You pick the account to pay from when you record the payment."
                />
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {pending
                ? "A pre-invoice posts when it's paid, at that day's rate. You pick the account to pay from when you record the payment."
                : !foreign
                  ? `${BASE_CURRENCY} is the base currency, so nothing converts. You pick the account to pay from when you record the payment.`
                  : prepaidBase > 0.004
                    ? `The rest, ${formatMoney(rest, currency)}, at the invoice rate. You pick the account to pay from when you record the payment.`
                    : `${formatMoney(rest, currency)} at the invoice rate. You pick the account to pay from when you record the payment.`}
            </p>
          </Section>

          {variance && (
            <Section label="FX difference at invoice">
              <div className="rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'rgba(241,245,249,0.5)', borderColor: '#EEF2F6' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-slate-600" style={{ fontWeight: 600 }}>
                    {outcome === 'gain' ? 'FX Gain' : outcome === 'loss' ? 'FX Loss' : 'No difference'}
                  </span>
                  <span
                    className="text-[12.5px] tabular-nums"
                    style={{ fontWeight: 700, color: outcome === 'gain' ? '#047857' : outcome === 'loss' ? '#B91C1C' : '#1E293B' }}
                  >
                    {outcome === 'none' ? 'None' : signedBase(variance.amount)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  {variance.restForeign > 0.004
                    ? "The unpaid goods were booked at the receiving date's rate. The difference goes to FX Gain or FX Loss."
                    : "The prepayment covers all the goods at the rate it was paid at, so there's no difference."}
                </p>
              </div>
            </Section>
          )}

          {foreign && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed" style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
              <Lock className="w-3 h-3 mt-[3px] shrink-0" />
              <span>
                {posted
                  ? `The rate locked when the invoice posted, at the ${formatRateDate(draftDate)} rate. When it's paid, any difference from that day's rate goes to FX Gain or FX Loss.`
                  : `The rate locks when the invoice posts. When it's paid, any difference from that day's rate also goes to FX Gain or FX Loss.${readOnly && onEdit ? ' Edit the invoice to change the currency or the rate.' : ''}`}
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
            {readOnly && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors cursor-pointer"
                style={{ backgroundColor: '#0A77FF' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Invoice
              </button>
            )}
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
