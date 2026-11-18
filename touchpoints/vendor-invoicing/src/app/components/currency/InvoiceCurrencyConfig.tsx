import * as React from 'react';
import { Lock, Pencil, RotateCcw, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateQuote, type RateType } from '@/app/currency/rates';
import { fxVarianceOf, gainLossOf, type FxVariance, type LockedPrepayment, type ReceiptValue } from '@/app/currency/fxVariance';
import { rateChangePct } from '@/app/hooks/useApSettings';
import type { InvoiceRateBasis } from '@/app/data/mockInvoices';
import { CurrencyFlag } from './CurrencyChip';
import { CurrencyPicker, InvoiceExchangeRateField, InvoiceRateAsOfField, type CurrencySource } from './InvoiceCurrencyFields';

/* ── An invoice's currency: summary card and Currency Configuration ────
 * Modelled on Purchase Orders' Order Summary card and Currency Configuration
 * dialog (POCurrencyConfig), on this module's invoice model:
 *  - "Vendor bills": the invoice's currency, the PO's (locked) else the
 *    vendor's default (spec 4.2, 4.4). Changing it re-reads the amounts in
 *    the new currency, as the form's Currency field does; nothing converts.
 *  - "Rate as of": the day whose rate the invoice takes, from Settings,
 *    Module defaults (read-only here, as on the form).
 *  - The rate: mid-market (read-only) or corporate (editable if the role may
 *    change an invoice's rate, within its ± limit; Settings, Permissions).
 *    The same field the form shows (InvoiceExchangeRateField).
 *  - What receiving booked and the prepayments' locked rates, with the FX
 *    Variance they leave at this rate (currency/fxVariance.ts).
 *  - "You pay": what A/P is booked at in the base currency. The vendor is
 *    always paid in the invoice's currency; the account it comes from (one
 *    in that currency or the base) is picked on the payment, so here it is
 *    shown, not chosen.
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
                    : `Finance's corporate rate in effect on ${formatRateDate(rateDate)}, the ${dateLabel ?? 'Rate as of date'}`}
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

export function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      {label && <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>}
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
        <span className="text-slate-500 truncate">· {source}</span>
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
  /** The Rate as of date and its basis, as the form shows them. */
  rateAsOf: { date: string | undefined; basis: InvoiceRateBasis; wanted?: InvoiceRateBasis };
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
    vendorName,
    vendorDefault,
    total,
    source,
    value,
    rateAsOf,
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
  const midQuote: RateQuote = rateOn(currency, rateDay, 'mid');
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

  // Receiving and prepayments are in the invoice's currency; a changed
  // currency leaves nothing to compare until it is saved and re-read.
  const variance = !currencyChanged && foreign && draftRate != null && !pending
    ? fxVarianceOf({ currency, invoiceRate: draftRate, invoiceDate: draftDate, receipts, prepayments })
    : null;
  const prepaid = Math.min(total, Math.round(prepayments.reduce((s, p) => s + p.amount, 0) * 100) / 100);
  const rest = Math.max(0, Math.round((total - (currencyChanged ? 0 : prepaid)) * 100) / 100);

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
    if (source.kind !== 'po') setCurrency(vendorDefault);
    setRateType('mid');
    setTyped(null);
  };

  const rateSource =
    draftType === 'mid'
      ? RATE_PROVIDER
      : edited
        ? 'Entered on this invoice'
        : readOnly
          ? savedRate?.source ?? 'Corporate rate'
          : quote.rate != null
            ? quote.source.replace(/^Set by/, 'set by')
            : `No corporate rate for ${currency}; enter one`;

  // Each prepayment at its locked rate (as allocated to the goods, when
  // there are receivings to measure against).
  const prepaidCards: LockedPrepayment[] = variance
    ? [...variance.prepaidGoods, ...variance.prepaidBeyond]
    : currencyChanged
      ? []
      : prepayments;
  const receivedDates = variance ? Array.from(new Set(variance.rest.map((r) => r.date))).sort() : [];

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
                {readOnly && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}
              </div>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Applies only to {documentLabel}. {vendorName}'s default currency ({vendorDefault}) stays the same.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Vendor bills">
            <AmountRow
              amount={total}
              code={currency}
              side={
                readOnly || source.kind === 'po' ? (
                  <LockedCurrency
                    code={currency}
                    note={
                      source.kind === 'po'
                        ? `Set by ${source.ref}. An invoice is billed in its purchase order's currency.`
                        : 'The currency this invoice was entered in. Edit the invoice to change it.'
                    }
                  />
                ) : (
                  <CurrencyPicker
                    value={currency}
                    onChange={(c) => {
                      setCurrency(c);
                      setTyped(null);
                    }}
                    ariaLabel="Vendor bills currency"
                    className="!mt-0 !h-10"
                  />
                )
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {source.kind === 'po'
                ? `From ${source.ref}, so it can't change here.`
                : currency === vendorDefault
                  ? `${vendorName}'s default currency, from the partner record.`
                  : `Changed from ${vendorDefault}, the vendor's default.`}
              {!readOnly && source.kind !== 'po' ? ' The amounts on the invoice are read in this currency; nothing is converted.' : ''}
            </p>
          </Section>

          <Section label="Rate as of">
            {readOnly ? (
              <div className="h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2 border border-slate-200 bg-slate-50">
                <span className="tabular-nums text-slate-700" style={{ fontWeight: 500 }}>{pending ? 'Set when paid' : formatRateDate(draftDate)}</span>
                <span className="text-slate-400 text-[12px]">· {dateLabel}</span>
                <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
              </div>
            ) : (
              <div className="[&_label]:hidden">
                <InvoiceRateAsOfField
                  date={rateAsOf.date}
                  basis={rateAsOf.basis}
                  wanted={rateAsOf.wanted}
                  pending={pending}
                  isBase={!foreign}
                />
              </div>
            )}
          </Section>

          {foreign && (
            // Editable, the rate field carries its own label, type switch and ⓘ.
            <Section label={readOnly ? 'Exchange rate' : undefined}>
              {readOnly ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Rate type</span>
                  <span className="ml-auto"><RateTypeChip type={draftType} /></span>
                </div>
              ) : (
                <InvoiceExchangeRateField
                  currency={currency}
                  rateType={rateType}
                  onRateTypeChange={(t) => {
                    setRateType(t);
                    setTyped(null);
                  }}
                  quote={quote}
                  midQuote={midQuote}
                  typed={typed}
                  onTypedChange={setTyped}
                  rate={draftRate}
                  pending={pending}
                  error={missing}
                  po={po && currency === value.currency ? po : null}
                  canEdit={canEditRate}
                  limitPct={limitPct}
                />
              )}
              {draftRate != null && !pending && (
                <RateCard
                  from={currency}
                  rate={draftRate}
                  type={draftType}
                  source={rateSource}
                  caption={`The invoice rate: ${formatRateDate(draftDate)}, the ${dateLabel}. A/P posts at it.`}
                  amount={rest}
                />
              )}
            </Section>
          )}

          {foreign && !pending && (variance || prepaidCards.length > 0) && (
            <Section label="Received and prepaid">
              {prepaidCards.map((p, i) => (
                <RateCard
                  key={`${p.invoiceNumber}-${i}`}
                  from={currency}
                  rate={p.rate}
                  type="mid"
                  source={`${p.invoiceNumber}, locked when paid`}
                  caption={`Paid${p.rateDate ? ` ${formatRateDate(p.rateDate)}` : ''}. The part it covers stays at this rate, so it makes no FX variance.`}
                  amount={p.amount}
                />
              ))}
              {variance &&
                variance.rest.map((r, i) => (
                  <RateCard
                    key={`${r.date}-${i}`}
                    from={currency}
                    rate={r.rate}
                    type="mid"
                    source={r.grnNumber ? `${r.grnNumber}, the receiving` : 'The receiving'}
                    caption={`Received ${formatRateDate(r.date)}. Stock was booked at this rate${variance.prepaidGoods.length ? ' for the unpaid part' : ''}.`}
                    amount={r.amount}
                  />
                ))}
              {variance && (
                <div className="rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'rgba(241,245,249,0.5)', borderColor: '#EEF2F6' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-slate-600" style={{ fontWeight: 600 }} title={FX_VARIANCE_TIP}>
                      FX Variance at invoice
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GainLossTag amount={variance.amount} />
                      <span className="text-[12.5px] text-slate-800 tabular-nums" style={{ fontWeight: 700 }}>
                        {gainLossOf(variance.amount) === 'none' ? 'None' : signedBase(variance.amount)}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    {variance.restForeign > 0.004
                      ? `${formatMoney(variance.restForeign, currency)} unpaid: ${formatMoney(variance.restAtReceiving, BASE_CURRENCY)} at receiving (${receivedDates.map(formatRateDate).join(', ')}) against ${formatMoney(variance.restAtInvoice, BASE_CURRENCY)} at the invoice rate. ${
                          gainLossOf(variance.amount) === 'gain'
                            ? 'You owe less than receiving booked: a gain.'
                            : gainLossOf(variance.amount) === 'loss'
                              ? 'You owe more than receiving booked: a loss.'
                              : 'The same at both rates.'
                        } Stock keeps its receiving value.`
                      : 'The prepayment covers all the goods at its locked rate, so there is no FX variance.'}
                  </p>
                </div>
              )}
            </Section>
          )}

          <Section label="You pay">
            <AmountRow
              amount={foreign && draftRate != null && !pending ? toBase(rest, draftRate) : rest}
              code={foreign && draftRate != null && !pending ? BASE_CURRENCY : currency}
              side={
                <LockedCurrency
                  code={foreign && draftRate != null && !pending ? BASE_CURRENCY : currency}
                  note="A/P is kept in the base currency. The vendor is paid in the invoice's currency; the account it comes from is picked on the payment."
                />
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {pending
                ? 'A pre-invoice posts when it is paid, at that day’s rate.'
                : foreign
                  ? `What A/P is booked at in ${BASE_CURRENCY}${prepaid > 0.004 && !currencyChanged ? ', the rest after the prepayment' : ''}. The vendor is paid in ${currency}, from a ${currency} or a ${BASE_CURRENCY} account (picked on the payment); a difference on the payment day posts to FX Gain/Loss.`
                  : `${BASE_CURRENCY} is the base currency, so A/P is booked as billed.`}
            </p>
          </Section>

          {foreign && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed" style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
              <Lock className="w-3 h-3 mt-[3px] shrink-0" />
              <span>
                {readOnly
                  ? posted
                    ? `The rate is locked: this invoice posted at the ${formatRateDate(draftDate)} rate, and payments are compared against it.`
                    : `The rate is taken on the Rate as of date and locks when the invoice posts.${onEdit ? ' Edit the invoice to change the currency or the rate.' : ''}`
                  : 'The rate is taken on the Rate as of date and locks when the invoice posts. A/P is kept in the base currency at it, and a payment is compared against it.'}
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
