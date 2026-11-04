import * as React from 'react';
import { AlertCircle, Check, ChevronDown, Info, Lock, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BASE_CURRENCY, CURRENCIES, getCurrency } from '@/app/currency/currencies';
import { formatRate, formatRateDate } from '@/app/currency/money';
import { RATE_PROVIDER, RATE_TYPE_LABEL, type RateQuote, type RateType } from '@/app/currency/rates';
import { CurrencyFlag } from './CurrencyChip';

/* ── Invoice Details: Currency and Exchange Rate (spec 4.4, 3.5) ──────
 * The row the Currency & Exchange Rates audit adds under Posting Date and
 * Trigger Date. Same field recipe as the rest of the card: 13px label with
 * an ⓘ, a 40px rounded field, one 11px helper line. */

const LABEL = 'text-xs sm:text-[13px] text-foreground flex items-center gap-1.5';
const FIELD = 'mt-1 h-10 w-full rounded-lg text-sm px-3 flex items-center gap-2';
const LOCKED = `${FIELD} border border-slate-200 bg-slate-50 cursor-not-allowed`;

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-slate-300 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
        <p className="text-[11px] text-slate-500 leading-snug">{children}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Every active currency, searchable by code, name or country (spec 2.3). */
function CurrencyPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const cur = getCurrency(value);
  const q = query.trim().toLowerCase();
  const list = q
    ? CURRENCIES.filter(
        (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
      )
    : CURRENCIES;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${FIELD} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CurrencyFlag code={value} size={18} />
            <span style={{ fontWeight: 500 }}>{value}</span>
            <span className="text-slate-500 truncate">{cur?.name}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 rounded-lg">
        <div className="p-2 border-b border-slate-100">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search currency, code or country"
            className="w-full h-8 px-2.5 rounded-md border border-border text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1" role="listbox">
          {list.length === 0 && <p className="px-3 py-3 text-[12px] text-slate-400">No currency matches "{query}".</p>}
          {list.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={c.code === value}
              onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] cursor-pointer transition-colors ${
                c.code === value ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'
              }`}
            >
              <CurrencyFlag code={c.code} size={18} />
              <span className="w-9 shrink-0" style={{ fontWeight: 600 }}>{c.code}</span>
              <span className="truncate text-slate-600">{c.name}</span>
              {c.code === BASE_CURRENCY && (
                <span className="ml-auto shrink-0 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Base</span>
              )}
              {c.code === value && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Where the currency came from, for the helper line and a provenance tag. */
export interface CurrencySource {
  /** "PO" when the PO sets it (locked), "vendor" when it is the vendor's default. */
  kind: 'po' | 'vendor';
  /** The PO number, or the vendor's default currency. */
  ref: string;
}

export function InvoiceCurrencyField({
  value,
  onChange,
  source,
}: {
  value: string;
  onChange: (code: string) => void;
  source: CurrencySource;
}) {
  const cur = getCurrency(value);
  const isBase = value === BASE_CURRENCY;
  return (
    <div>
      <Label className={LABEL} style={{ fontWeight: 500 }}>
        Currency<span className="text-red-500">*</span>
        <InfoTip>The currency the vendor bills in. It defaults from the PO, else from the vendor's partner record.</InfoTip>
      </Label>
      {source.kind === 'po' ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={LOCKED}>
              <CurrencyFlag code={value} size={18} />
              <span style={{ fontWeight: 500 }}>{value}</span>
              <span className="text-slate-500 truncate">{cur?.name}</span>
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">
              Set by {source.ref}. An invoice is billed in its purchase order's currency.
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <CurrencyPicker value={value} onChange={onChange} />
      )}
      <p className="text-[11px] text-slate-400 mt-1 truncate">
        {source.kind === 'po'
          ? `From ${source.ref}${isBase ? ', the base currency.' : '.'}`
          : value === source.ref
            ? `The vendor's default currency${isBase ? ', and the base currency.' : '.'}`
            : `Changed from ${source.ref}, the vendor's default.`}
      </p>
    </div>
  );
}

/** Mid-market | Corporate, as the Exchange Rates module names them. */
function RateTypeToggle({ value, onChange }: { value: RateType; onChange: (t: RateType) => void }) {
  return (
    <span className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-px" role="radiogroup" aria-label="Rate type">
      {(['mid', 'corporate'] as RateType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`px-1.5 py-px rounded text-[10px] cursor-pointer transition-colors ${
            value === t ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-foreground'
          }`}
          style={{ fontWeight: value === t ? 600 : 500 }}
        >
          {RATE_TYPE_LABEL[t]}
        </button>
      ))}
    </span>
  );
}

/** The PO's rate beside the invoice's, as the earlier touchpoint's rate preview showed it. */
function PoRateCompare({
  currency,
  invoiceRate,
  invoiceDate,
  po,
}: {
  currency: string;
  invoiceRate: number;
  invoiceDate: string;
  po: { poNumber: string; rate: number; date: string };
}) {
  const variance = ((invoiceRate - po.rate) / po.rate) * 100;
  const flat = Math.abs(variance) < 0.05;
  const up = variance > 0;
  const pct = `${up ? '+' : variance < 0 ? '−' : ''}${Math.abs(variance).toFixed(2)}%`;
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] whitespace-nowrap cursor-help ${
            flat ? 'bg-slate-100 text-slate-500' : up ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}
          style={{ fontWeight: 600 }}
        >
          {!flat && (up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
          {flat ? 'Same as PO' : `${pct} vs PO`}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-[300px] p-3 rounded-xl border border-border shadow-lg bg-white">
        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Invoice rate vs the PO's rate</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 mt-2 text-[11px]">
          <dt className="text-slate-500">{po.poNumber} · {formatRateDate(po.date)}</dt>
          <dd className="tabular-nums text-slate-700">{formatRate(po.rate)} {BASE_CURRENCY}</dd>
          <dt className="text-slate-500">This invoice · {formatRateDate(invoiceDate)}</dt>
          <dd className="tabular-nums text-slate-700" style={{ fontWeight: 600 }}>{formatRate(invoiceRate)} {BASE_CURRENCY}</dd>
        </dl>
        <p className="text-[11px] mt-2 leading-snug" style={{ color: flat ? '#64748B' : up ? '#B45309' : '#047857' }}>
          {flat
            ? `The rate per 1 ${currency} is the same as when the PO was raised.`
            : up
              ? `${currency} has strengthened since the PO, so this invoice costs more ${BASE_CURRENCY} than the PO budgeted.`
              : `${currency} has weakened since the PO, so this invoice costs less ${BASE_CURRENCY} than the PO budgeted.`}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function InvoiceExchangeRateField({
  currency,
  rateType,
  onRateTypeChange,
  quote,
  midQuote,
  typed,
  onTypedChange,
  rate,
  pending,
  error,
  po,
}: {
  currency: string;
  rateType: RateType;
  onRateTypeChange: (t: RateType) => void;
  /** The rate table's rate of the chosen type on the rate day. */
  quote: RateQuote;
  midQuote: RateQuote;
  /** A corporate rate typed on the invoice (null: the table's). */
  typed: string | null;
  onTypedChange: (v: string | null) => void;
  /** The rate the invoice will carry. */
  rate: number | null;
  /** A pre-invoice: no posting date yet, the rate is taken when it's paid. */
  pending: boolean;
  error: boolean;
  /** The PO's own rate, for the comparison chip. */
  po?: { poNumber: string; rate: number; date: string } | null;
}) {
  const isBase = currency === BASE_CURRENCY;
  const corporate = rateType === 'corporate';
  const day = formatRateDate(quote.date);
  const edited = corporate && typed != null && typed.trim() !== '' && Number(typed) !== quote.rate;

  const label = (
    <Label className={LABEL} style={{ fontWeight: 500 }}>
      Exchange Rate{!isBase && !pending && <span className="text-red-500">*</span>}
      <InfoTip>
        {BASE_CURRENCY} per 1 {currency}, taken on the posting date. A mid-market rate comes from {RATE_PROVIDER} and
        is read-only; a corporate rate can be changed on the invoice.
      </InfoTip>
      {!isBase && !pending && <RateTypeToggle value={rateType} onChange={onRateTypeChange} />}
    </Label>
  );

  if (isBase) {
    return (
      <div>
        {label}
        <div className={LOCKED}>
          <span className="text-slate-500">No conversion</span>
          <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{BASE_CURRENCY} is the base currency, so the rate is 1.</p>
      </div>
    );
  }

  if (pending) {
    return (
      <div>
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={LOCKED}>
              <span className="text-sm text-slate-400 italic">Set when paid</span>
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">
              A pre-invoice posts when payment is made, so its rate is taken on that date.
            </p>
          </TooltipContent>
        </Tooltip>
        <p className="text-[11px] text-slate-400 mt-1 truncate">
          {midQuote.rate != null ? `Today's mid-market rate is 1 ${currency} = ${formatRate(midQuote.rate)} ${BASE_CURRENCY}.` : ''}
        </p>
      </div>
    );
  }

  const prefix = <span className="text-slate-500 whitespace-nowrap shrink-0">1 {currency} =</span>;
  const suffix = <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>;

  return (
    <div>
      {label}
      {corporate ? (
        <div
          className={`${FIELD} bg-white border ${
            error ? 'border-red-400 ring-2 ring-red-100' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
          }`}
        >
          {prefix}
          <input
            inputMode="decimal"
            aria-label={`Corporate rate, ${BASE_CURRENCY} per 1 ${currency}`}
            value={typed ?? (quote.rate != null ? formatRate(quote.rate).replace(/,/g, '') : '')}
            placeholder="Enter rate"
            // Keep exactly what's typed (a partial "305.5" must not snap to
            // the table's "305.50" mid-entry); back to the table's rate
            // only on leaving the field with the same number.
            onChange={(e) => onTypedChange(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => {
              if (typed != null && quote.rate != null && typed.trim() !== '' && Number(typed) === quote.rate) onTypedChange(null);
            }}
            className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-foreground"
            style={{ fontWeight: 500 }}
          />
          {suffix}
          {edited && quote.rate != null && (
            <button
              type="button"
              onClick={() => onTypedChange(null)}
              className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
              title={`Back to the corporate rate, ${formatRate(quote.rate)}`}
              aria-label="Reset to the corporate rate"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={LOCKED}>
              {prefix}
              <span className="tabular-nums text-foreground" style={{ fontWeight: 500 }}>
                {rate != null ? formatRate(rate) : '—'}
              </span>
              {suffix}
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">
              Mid-market rates are read-only. Switch to Corporate to use, or change, a corporate rate.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
      <div className="text-[11px] mt-1 flex items-center gap-1.5 min-w-0">
        {error ? (
          <span className="flex items-center gap-1 text-red-500" style={{ fontWeight: 500 }}>
            <AlertCircle className="w-3 h-3 shrink-0" />
            {corporate && quote.rate == null
              ? `No corporate rate for ${currency} on ${day}. Enter the rate to use.`
              : 'Enter a rate above zero.'}
          </span>
        ) : (
          <span className="truncate" style={{ color: edited ? '#B45309' : 'rgb(148 163 184)' }}>
            {!corporate
              ? // The provider steps aside for the PO chip (it's in the ⓘ too).
                `Mid-market rate on ${day}${po ? '' : ` · ${RATE_PROVIDER}`}`
              : quote.rate == null
                ? `No corporate rate for ${currency} on ${day}. Enter the rate to use.`
                : edited
                  ? `Changed from ${formatRate(quote.rate)}, the corporate rate on ${day}`
                  : `Corporate rate in effect on ${day} · ${quote.source.replace(/^Set by/, 'set by')}`}
          </span>
        )}
        {po && rate != null && !error && <PoRateCompare currency={currency} invoiceRate={rate} invoiceDate={quote.date} po={po} />}
      </div>
    </div>
  );
}
