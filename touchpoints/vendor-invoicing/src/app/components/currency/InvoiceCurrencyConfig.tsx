import * as React from 'react';
import { AlertCircle, Lock, Pencil, RotateCcw, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { LAST_SYNC, RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, rateOn, toBase, type RateQuote, type RateType } from '@/app/currency/rates';
import { fxVarianceOf, gainLossOf, type FxVariance, type LockedPrepayment, type ReceiptValue } from '@/app/currency/fxVariance';
import { eligiblePayFromId, payFromAccountById, payFromAccountsFor } from '@/app/currency/payFrom';
import { rateChangePct } from '@/app/hooks/useApSettings';
import type { InvoiceRateBasis } from '@/app/data/mockInvoices';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { CurrencyFlag } from './CurrencyChip';
import { linkProvider } from './ProviderLink';
import { CurrencyPicker, PoRateCompare, RateTypeToggle, type CurrencySource } from './InvoiceCurrencyFields';
import {
  CurrencyBlock,
  INVOICE_FX_VARIANCE_TITLE,
  RateTypeChip,
  signedVariance,
  varianceHex,
  type CurrencyBlockRow,
} from './CurrencyBlock';
import { PayFromAccountPicker } from './PayFromAccountPicker';

export { RateTypeChip } from './CurrencyBlock';

/* ── An invoice's currency: the currency block and Currency Configuration ──
 * Modelled on Purchase Orders' Order Summary card and Currency Configuration
 * dialog (POCurrencyConfig), in the shape the Currency Touchpoints Map gives
 * (24 Nov 2026), on this module's invoice model:
 *  - "Vendor invoiced": the invoice's amount and currency, the PO's by
 *    default (else the vendor's), and not locked: changing it converts every
 *    line at the rate day's mid-market cross rate when applied
 *    (CreateInvoiceScreen). The vendor's default currency doesn't change.
 *  - "Prepayment": each one deducted at the rate it was paid at.
 *  - "You pay in": the currency of the account it is paid from (the
 *    account on hover), any bank or cash account, base-currency ones first
 *    (currency/payFrom.ts). "Base equivalent" is always shown: an estimate at
 *    the invoice rate; the payment records what the bank took.
 *  - "Exchange rate": mid-market (read-only) or corporate (typed if the role may
 *    change an invoice's rate, within its ± limit; Settings, Permissions), on
 *    the posting date (the module default). No lock on the rate (25 Nov
 *    2026); the configuration is read-only once the invoice posts.
 *  - "FX variance": receiving booked the goods at the receiving-date rate,
 *    the invoice converts them at the posting-date rate; the gap posts to FX
 *    Gain (+) or FX Loss (−) (currency/fxVariance.ts).
 * On the create and edit screen the dialog edits the form's currency, rate
 * and account (Save writes them back). On a saved invoice it is read-only,
 * and Edit Invoice is the way to change it while the invoice allows edits. */

const RATE_HEX: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };

/** "₨355.4200" */
export const baseRate = (rate: number) => `${moneyPrefix(BASE_CURRENCY).trim()}${formatRate(rate)}`;

/** [Gain] / [Loss] beside an FX variance. */
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
export const signedBase = signedVariance;

/** "posting-date rate", "vendor invoice date rate": the invoice rate by its date. */
export const invoiceRateName = (dateLabel?: string) =>
  dateLabel === 'posting date' ? 'posting-date rate' : dateLabel === 'receiving date' ? 'receiving-date rate' : dateLabel === 'PO date' ? 'PO-date rate' : dateLabel ? `${dateLabel} rate` : 'invoice rate';

/** "Receiving rate 278.5200 → posting-date rate 279.5200" */
export function varianceRatesText(v: FxVariance, dateLabel?: string): string {
  const rates = Array.from(new Set(v.rest.map((r) => r.rate))).sort((a, b) => a - b);
  const from =
    rates.length === 0
      ? 'Prepaid rate'
      : rates.length === 1
        ? `Receiving rate ${formatRate(rates[0])}`
        : `Receiving rates ${formatRate(rates[0])} to ${formatRate(rates[rates.length - 1])}`;
  return `${from} → ${invoiceRateName(dateLabel)} ${formatRate(v.invoiceRate)}`;
}

/* ── The currency block (invoice) ──────────────────────────────────── */

export interface InvoiceCurrencyBlockProps {
  currency: string;
  /** What the vendor invoiced, in its currency. */
  total: number;
  /** Prepayments applied, in its currency. */
  prepaid?: number;
  /** The invoice's rate (today's while pending), base per one unit. */
  rate: number;
  rateType: RateType;
  rateDate?: string;
  /** "posting date", "vendor invoice date"… */
  dateLabel?: string;
  /** The Rate row's qualifier; defaults to the date label. */
  qualifier?: string;
  /** No rate yet: a pre-invoice takes its rate when paid. */
  pending?: boolean;
  /** A foreign invoice with no usable rate (no corporate rate on the day). */
  rateMissing?: boolean;
  /** The rate changed on the invoice from the rate table. */
  rateEdited?: boolean;
  /** The rate difference on received goods, at this rate. */
  variance?: FxVariance | null;
  /** The invoice has posted. The block shows no lock (25 Nov 2026). */
  locked: boolean;
  /** The account it is paid from. */
  payFrom: Pick<PayFromAccount, 'label' | 'currency'>;
  onViewConfig?: () => void;
  className?: string;
}

/** Vendor invoiced / [Prepaid] / You pay in / Base equivalent / [FX variance] / Exchange rate. */
export function InvoiceCurrencyBlock({
  currency,
  total,
  prepaid = 0,
  rate,
  rateType,
  rateDate,
  dateLabel,
  qualifier,
  pending,
  rateMissing,
  rateEdited,
  variance,
  payFrom,
  onViewConfig,
  className = '',
}: InvoiceCurrencyBlockProps) {
  const code = currency.toUpperCase();
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rest = Math.max(0, r2(total - Math.min(prepaid, total)));
  const restBase = toBase(rest, rate);
  const payInBase = isBaseCurrency(payFrom.currency);
  // Currency information (25 Nov 2026): what the vendor invoiced, the
  // currency you pay in (the pay-from account's, the account on hover), and
  // the base equivalent, always shown.
  const rows: CurrencyBlockRow[] = [{ label: 'Vendor invoiced', code, amount: total }];
  if (prepaid > 0.004) rows.push({ label: 'Prepaid', code, amount: Math.min(prepaid, total), sign: '−', title: 'Deducted at the rate it was paid at.' });
  rows.push({
    label: 'You pay in',
    code: payInBase ? BASE_CURRENCY : payFrom.currency.toUpperCase(),
    title: `From ${payFrom.label} (${payFrom.currency})${pending ? ", at today's rate until it's paid" : ''}`,
  });
  rows.push({ label: 'Base equivalent', code: BASE_CURRENCY, amount: restBase });
  const corporate = rateType === 'corporate' && rateDate ? corporateRateOn(code, rateDate) : undefined;
  const rateTip =
    rateType === 'mid'
      ? `The mid-market rate on ${formatRateDate(rateDate)}, the ${dateLabel ?? 'posting date'} · ${RATE_PROVIDER}`
      : rateEdited
        ? `A corporate rate entered on this invoice (${formatRateDate(rateDate)})`
        : corporate
          ? `Corporate · Set by ${corporate.setBy} · In effect since ${formatRateDate(corporate.effectiveDate)}`
          : `Corporate rate on ${formatRateDate(rateDate)}, the ${dateLabel ?? 'posting date'}`;
  return (
    <CurrencyBlock
      className={className}
      currency={code}
      rateType={pending ? null : rateType}
      rateTip={rateTip}
      rows={rows}
      variance={variance ? { amount: variance.amount, title: `${varianceRatesText(variance, dateLabel)}. ${INVOICE_FX_VARIANCE_TITLE}` } : null}
      rate={
        pending
          ? { rate: null, pendingText: 'Set when paid' }
          : rateMissing
            ? { rate: null, pendingText: 'Enter a rate in the configuration' }
            : { rate, qualifier: qualifier ?? dateLabel }
      }
      onViewConfig={onViewConfig}
    />
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

/** An amount (read-only) as text, in the field recipe. */
export function AmountBox({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div
      className={`flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none ${className}`}
      style={{ fontWeight: 500 }}
      aria-readonly="true"
    >
      <span className="truncate">{text}</span>
    </div>
  );
}

/** The amount (read-only) beside the currency or account it's in. */
export function AmountRow({ amount, code, side, prefix = '', sideWidth = 200 }: { amount: number; code: string; side: React.ReactNode; prefix?: string; sideWidth?: number }) {
  return (
    <div className="flex items-stretch gap-2">
      <AmountBox text={`${prefix}${formatMoney(amount, code)}`} />
      <div className="shrink-0" style={{ width: sideWidth }}>{side}</div>
    </div>
  );
}

/** A currency shown where a picker would be, fixed (from the PO, or the
 *  base). `detail` replaces the currency's name ("· invoice currency"). */
export function LockedCurrency({ code, note, detail }: { code: string; note: string; detail?: string }) {
  const cur = getCurrency(code);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2 border border-slate-200 bg-slate-50 cursor-not-allowed">
          <CurrencyFlag code={code} size={18} />
          <span style={{ fontWeight: 500 }}>{code}</span>
          <span className="text-slate-500 truncate">{detail ?? cur?.name}</span>
          <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        <p className="text-[11px] text-slate-500 leading-snug">{note}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The time of day the provider's rates sync, e.g. "7:30 PM". */
const SYNC_TIME = new Date(LAST_SYNC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Under the rate (25 Nov 2026, as POCurrencyConfig's): when a mid-market
 *  rate was last updated, or from when a corporate rate is in effect. Not
 *  the posting or payment date. */
export function rateAsOfLine(type: RateType, date: string, effectiveDate?: string | null, entered?: boolean): string {
  if (type === 'mid') return `Rate updated as of ${formatRateDate(date)}, ${SYNC_TIME}`;
  if (entered) return `Entered on this invoice · effective from ${formatRateDate(date)}`;
  return `Effective from ${formatRateDate(effectiveDate ?? date)}`;
}

/** One rate, as the Exchange Rates module writes it (POCurrencyConfig's
 *  RateCard): the type and source, the rate, its inverse, then the line
 *  under it (rateAsOfLine). No lock on the rate (25 Nov 2026). */
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
  /** The line under the rate (rateAsOfLine). */
  caption: React.ReactNode;
  /** What this rate converts, in `from` and base. */
  amount?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] min-w-0">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RATE_HEX[type] }} />
        <span className="shrink-0" style={{ color: RATE_HEX[type], fontWeight: 600 }}>{RATE_TYPE_LABEL[type]}</span>
        <span className="text-slate-500 truncate">· {linkProvider(source)}</span>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
          <div>1 {from} = {formatRate(rate)} {BASE_CURRENCY}</div>
          <div className="text-slate-500" style={{ fontWeight: 400 }}>1 {BASE_CURRENCY} = {formatRate(1 / rate)} {from}</div>
        </div>
        {amount != null && amount > 0 && (
          <div className="text-right text-[11px] tabular-nums leading-5">
            <div className="text-slate-500">{formatMoney(amount, from)}</div>
            <div className="text-slate-700" style={{ fontWeight: 600 }}>{formatMoney(toBase(amount, rate), BASE_CURRENCY)}</div>
          </div>
        )}
      </div>
      <div className="mt-1.5 text-[10.5px] text-slate-400 tabular-nums">{caption}</div>
    </div>
  );
}

/** The FX variance at a glance, then what it compares, for the dialogs. */
export function VarianceCard({
  amount,
  caption,
  children,
}: {
  amount: number;
  /** "Receiving rate 278.5200 → posting-date rate 279.5200" */
  caption: string;
  children?: React.ReactNode;
}) {
  const k = gainLossOf(amount);
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ backgroundColor: 'rgba(241,245,249,0.5)', borderColor: '#EEF2F6' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] tabular-nums" style={{ fontWeight: 700, color: varianceHex(amount) }}>
          {signedVariance(amount)}
        </span>
        <span className="text-[11px] text-slate-500 tabular-nums text-right">{caption}</span>
      </div>
      {children}
      <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5">
        {k === 'gain' ? 'You pay less in the base currency: a gain. Posts to FX Gain.' : k === 'loss' ? 'You pay more in the base currency: a loss. Posts to FX Loss.' : 'No difference, so nothing posts.'}
      </p>
    </div>
  );
}

export interface InvoiceCurrencyChoice {
  currency: string;
  rateType: RateType;
  /** A corporate rate typed on the invoice; null keeps the rate table's. */
  typedRate: string | null;
  /** The account it's paid from (a PAY_FROM_ACCOUNTS id). */
  payFromAccount: string;
}

export interface InvoiceCurrencyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "INV-000218". */
  documentLabel: string;
  vendorName: string;
  /** The vendor's default currency, from the partner record. */
  vendorDefault: string;
  /** The invoice total, in its currency. */
  total: number;
  /** Where the currency comes from: the PO or the vendor. */
  source: CurrencySource;
  /** The invoice's currency, rate and account as they stand. */
  value: InvoiceCurrencyChoice;
  /** The Rate as of date and its basis (the rate line states them). */
  rateAsOf?: { date: string | undefined; basis: InvoiceRateBasis; wanted?: InvoiceRateBasis };
  /** The day the rate is taken on (the Rate as of date, or today while pending). */
  rateDay: string;
  /** What the rate date is, for captions ("posting date"). */
  dateLabel: string;
  /** An edited invoice keeps its rate: the rate it carries now, used while
   *  the currency and rate choice are unchanged. */
  heldRate?: { rate: number; rateType: RateType; rateDate: string; edited?: boolean } | null;
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
  /** A saved invoice: nothing changes here. */
  readOnly?: boolean;
  /** The saved invoice's rate (read-only mode). */
  savedRate?: { rate: number; rateType: RateType; rateDate: string; edited?: boolean; source?: string };
  /** A saved invoice that has posted: its configuration is read-only. */
  posted?: boolean;
  /** Read-only: open the invoice's edit screen, where currency and rate change. */
  onEdit?: () => void;
  /** Editable: write the choice back to the form. `rateChanged` is false
   *  when only the account changed (an edited invoice then keeps its rate). */
  onSave?: (next: InvoiceCurrencyChoice & { rateChanged: boolean }) => void;
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
    heldRate = null,
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
  const [accountId, setAccountId] = React.useState(value.payFromAccount);
  // An edited invoice keeps its rate until the user takes the day's instead.
  const [releaseHeld, setReleaseHeld] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCurrency(value.currency);
    setRateType(value.rateType);
    setTyped(value.typedRate);
    setAccountId(value.payFromAccount);
    setReleaseHeld(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const foreign = !isBaseCurrency(currency);
  const currencyChanged = currency !== value.currency;
  const sameRateChoice = !currencyChanged && rateType === value.rateType && (typed ?? null) === (value.typedRate ?? null);
  const useHeld = !readOnly && !!heldRate && sameRateChoice && !releaseHeld;
  // The rate the draft would carry, exactly as the form works it out.
  const quote: RateQuote = rateOn(currency, rateDay, rateType);
  const typedNum = typed != null && typed.trim() !== '' ? Number(typed) : null;
  const draftRate: number | null = readOnly && savedRate
    ? savedRate.rate
    : !foreign
      ? 1
      : useHeld && heldRate
        ? heldRate.rate
        : rateType === 'corporate' && typed != null
          ? typedNum != null && typedNum > 0 ? typedNum : null
          : quote.rate;
  const draftType: RateType = readOnly && savedRate ? savedRate.rateType : useHeld && heldRate ? heldRate.rateType : rateType;
  const draftDate = readOnly && savedRate ? savedRate.rateDate : useHeld && heldRate ? heldRate.rateDate : rateDay;
  const edited = readOnly
    ? !!savedRate?.edited
    : useHeld
      ? !!heldRate?.edited
      : rateType === 'corporate' && typedNum != null && typedNum !== quote.rate;
  const overLimit =
    !readOnly && !useHeld && foreign && edited && canEditRate && limitPct != null && quote.rate != null && typedNum != null &&
    Math.abs(rateChangePct(typedNum, quote.rate)) > limitPct + 1e-9;
  const missing = !readOnly && foreign && !pending && draftRate == null;
  // No corporate rate on the day, and this role can't type one.
  const blockedNoRate = !readOnly && !useHeld && foreign && !pending && rateType === 'corporate' && !canEditRate && quote.rate == null;

  // A changed currency converts the invoice at the rate day's mid-market cross
  // rate when applied (as a PO converts its lines); shown converted here.
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
  const rest = Math.max(0, r2(shownTotal - prepaid));

  // You pay: any bank or cash account, base-currency ones first (payFrom.ts).
  const accounts = payFromAccountsFor(currency);
  const effectiveAccountId = eligiblePayFromId(accountId, currency);
  const account = payFromAccountById(effectiveAccountId);
  const payInBase = !account || isBaseCurrency(account.currency);
  const amountRate = draftRate ?? rateOn(currency, rateDay, 'mid').rate ?? 1;
  const restBase = toBase(rest, amountRate);

  const accountChanged = effectiveAccountId !== value.payFromAccount;
  const rateChanged = !sameRateChoice || (releaseHeld && !!heldRate);
  const dirty = !readOnly && (rateChanged || accountChanged);
  const canSave = dirty && !missing && !overLimit && !blockedNoRate;

  const save = () => {
    if (readOnly || !dirty) {
      onOpenChange(false);
      return;
    }
    if (!canSave) return;
    onSave?.({
      currency,
      rateType,
      typedRate: rateType === 'corporate' ? typed : null,
      payFromAccount: effectiveAccountId,
      rateChanged,
    });
    onOpenChange(false);
  };

  const reset = () => {
    const def = source.kind === 'po' ? source.currency ?? value.currency : vendorDefault;
    setCurrency(def);
    setRateType('mid');
    setTyped(null);
    setAccountId(eligiblePayFromId(null, def));
    setReleaseHeld(true);
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
  // The rate kept on an edit, from before the date changed.
  const keptFromEarlier = useHeld && heldRate != null && heldRate.rateDate !== rateDay;
  const outcome = variance ? gainLossOf(variance.amount) : 'none';
  // The configuration is read-only once the invoice posts; the rate itself
  // shows no lock (25 Nov 2026).
  const description = posted
    ? "This invoice is posted, so its currency configuration can't be changed."
    : readOnly
      ? onEdit
        ? 'Edit the invoice to change its currency configuration.'
        : "This invoice can't be changed now, so its currency configuration is read-only."
      : "For this invoice only. The vendor's currency stays the same.";
  // Where the currency comes from: the PO's, else the vendor's.
  const defaultCurrency = source.kind === 'po' ? source.currency ?? value.currency : vendorDefault;
  const currencyHelper = currencyChanged
    ? `Changed from ${value.currency}. Saving converts every line at the ${formatRateDate(rateDay)} mid-market rate.`
    : currency === defaultCurrency
      ? source.kind === 'po'
        ? `From the PO, ${source.ref}.`
        : "Defaults to the vendor's currency."
      : source.kind === 'po'
        ? `Changed from ${defaultCurrency}, the PO's currency.`
        : `Changed from ${vendorDefault}, the vendor's currency.`;
  // "Rate updated as of Apr 10, 2026, 7:30 PM" / "Effective from Apr 1, 2026"
  // (25 Nov 2026: not "Rate on posting date: …").
  const rateDateLine = rateAsOfLine(draftType, draftDate, rateOn(currency, draftDate, 'corporate').effectiveDate, edited);

  // Receiving's side of the variance, one line per receiving rate.
  const receivedLines = variance
    ? Array.from(
        variance.rest
          .reduce((m, r) => {
            const key = `${r.rate}`;
            const cur = m.get(key) ?? { dates: [] as string[], rate: r.rate, base: 0 };
            cur.dates.push(r.date);
            cur.base = r2(cur.base + r.base);
            m.set(key, cur);
            return m;
          }, new Map<string, { dates: string[]; rate: number; base: number }>())
          .values(),
      )
    : [];

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
          <Section label="Vendor invoiced">
            <AmountRow
              amount={shownTotal}
              code={currency}
              sideWidth={248}
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
                    ariaLabel="Vendor invoiced currency"
                    className="!mt-0 !h-10"
                  />
                )
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">{currencyHelper}</p>
          </Section>

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

          <Section label="You pay in">
            <PayFromAccountPicker
              value={effectiveAccountId}
              accounts={accounts}
              onChange={setAccountId}
              readOnly={readOnly}
              documentCurrency={currency}
              ariaLabel="You pay in account"
            />
          </Section>

          <Section label="Base equivalent">
            <AmountBox text={`${foreign ? '≈ ' : ''}${formatMoney(restBase, BASE_CURRENCY)} ${BASE_CURRENCY}`} />
            {foreign && pending && <p className="text-[11px] text-slate-500 leading-relaxed">At today's rate, until the pre-invoice is paid.</p>}
          </Section>

          {/* Receiving to invoice: what receiving booked, what the invoice
              posts, and the gap (Currency Touchpoints Map, Receiving 4). */}
          {variance && (
            <Section label="FX variance">
              <VarianceCard amount={variance.amount} caption={varianceRatesText(variance, dateLabel)}>
                {variance.restForeign > 0.004 ? (
                  <div className="mt-2 pt-2 border-t border-[#EEF2F6] space-y-1 text-[11px] tabular-nums">
                    {receivedLines.map((l) => (
                      <div key={l.rate} className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 min-w-0 truncate">
                          Received {Array.from(new Set(l.dates)).sort().map((d) => formatRateDate(d)).join(', ')} · 1 {currency} = {formatRate(l.rate)} {BASE_CURRENCY}
                        </span>
                        <span className="text-slate-700 shrink-0" style={{ fontWeight: 500 }}>{formatMoney(l.base, BASE_CURRENCY)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 min-w-0 truncate">
                        Invoice {posted ? 'posted' : 'posts'} {formatRateDate(draftDate)} · 1 {currency} = {formatRate(variance.invoiceRate)} {BASE_CURRENCY}
                      </span>
                      <span className="text-slate-700 shrink-0" style={{ fontWeight: 500 }}>{formatMoney(variance.restAtInvoice, BASE_CURRENCY)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600" style={{ fontWeight: 600 }}>
                        FX variance · posts to {outcome === 'gain' ? 'FX Gain' : outcome === 'loss' ? 'FX Loss' : 'nothing'}
                      </span>
                      <span className="shrink-0" style={{ fontWeight: 700, color: varianceHex(variance.amount) }}>{signedVariance(variance.amount)}</span>
                    </div>
                    {variance.prepaidGoods.length > 0 && (
                      <p className="text-slate-400 leading-relaxed pt-0.5">
                        The prepaid part keeps the rate it was paid at, so only the unpaid {formatMoney(variance.restForeign, currency)} is compared.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    The prepayment covers all the goods at the rate it was paid at, so there's no FX variance.
                  </p>
                )}
              </VarianceCard>
            </Section>
          )}

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
                  {!readOnly && rateType === 'corporate' && canEditRate && (!useHeld || !!heldRate?.edited) && (
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
                  {/* The rate card (POCurrencyConfig's): type and source, the
                      rate and its inverse, then the date line. No lock on the
                      rate (25 Nov 2026). */}
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RATE_HEX[draftType] }} />
                      <span className="shrink-0" style={{ color: RATE_HEX[draftType], fontWeight: 600 }}>{RATE_TYPE_LABEL[draftType]}</span>
                      <span className="text-slate-500 min-w-0">· {linkProvider(rateSource)}</span>
                    </div>
                    <div className="mt-1.5 text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
                      {draftRate != null ? (
                        <>
                          <div>1 {currency} = {formatRate(draftRate)} {BASE_CURRENCY}</div>
                          <div className="text-slate-500" style={{ fontWeight: 400 }}>1 {BASE_CURRENCY} = {formatRate(1 / draftRate)} {currency}</div>
                        </>
                      ) : (
                        <div className="text-slate-400" style={{ fontWeight: 400 }}>No rate yet</div>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[10.5px] text-slate-400 tabular-nums">
                      <span>{rateDateLine}</span>
                      {poCompare && draftRate != null && (
                        <>
                          <span>·</span>
                          <PoRateCompare currency={currency} invoiceRate={draftRate} invoiceDate={draftDate} po={poCompare} />
                        </>
                      )}
                    </div>
                  </div>
                  {keptFromEarlier && heldRate && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      The invoice keeps its rate from {formatRateDate(heldRate.rateDate)}.{' '}
                      <button
                        type="button"
                        onClick={() => setReleaseHeld(true)}
                        className="text-primary hover:underline cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        Use {formatRateDate(rateDay)}'s rate
                      </button>
                    </p>
                  )}
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
            {/* A saved invoice that still allows edits opens Edit Invoice,
                where its currency configuration changes. */}
            {readOnly && onEdit && !posted && (
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
