import * as React from 'react';
import { AlertCircle, Check, ChevronDown, Info, Lock, RotateCcw } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatRate, formatRateDate } from '@/app/currency/money';
import { RATE_PROVIDER } from '@/app/currency/rates';
import { CurrencyFlag } from './CurrencyChip';

/* ── Record a vendor payment: Payment Currency and Exchange Rate ───────
 * Currency & Exchange Rates. After the vendor is chosen, the payment goes
 * out in the vendor's currency (the invoices') or in the base currency, and
 * the pay-from list follows it. The rate is the invoices' currency on the
 * payment date; a role allowed to (Settings, Permissions) can enter the rate
 * the bank used. Same field recipe as the invoice form: 13px label with an
 * ⓘ, a 40px field, one 11px helper line. */

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

/** The payment currency: the vendor's (the invoices') or the base currency. */
export function PaymentCurrencyField({
  value,
  vendorCurrency,
  onChange,
  locked,
  lockedReason,
}: {
  value: string;
  /** The currency the vendor bills in, the invoices' currency. */
  vendorCurrency: string;
  onChange: (code: string) => void;
  /** A prepayment keeps the vendor's currency. */
  locked?: boolean;
  lockedReason?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const cur = getCurrency(value);
  const options = isBaseCurrency(vendorCurrency) ? [vendorCurrency] : [vendorCurrency, BASE_CURRENCY];
  const onlyOne = options.length === 1 || locked;
  const tag = (code: string) => (isBaseCurrency(code) ? 'Base currency' : 'Vendor’s currency');
  const helper = isBaseCurrency(value)
    ? isBaseCurrency(vendorCurrency)
      ? 'The vendor’s currency, and the base currency.'
      : 'Paid in the base currency. The bank converts it.'
    : 'The vendor’s currency, the invoices’ currency.';
  const face = (
    <>
      <CurrencyFlag code={value} size={18} />
      <span style={{ fontWeight: 500 }}>{value}</span>
      <span className="text-slate-500 truncate">{cur?.name}</span>
    </>
  );
  return (
    <div>
      <Label className={LABEL} style={{ fontWeight: 500 }}>
        Payment Currency<span className="text-red-500">*</span>
        <InfoTip>
          The currency the money goes out in: the vendor’s, or the base currency. The pay-from list shows accounts in it or
          in the base currency.
        </InfoTip>
      </Label>
      {onlyOne ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={LOCKED}>
              {face}
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">
              {lockedReason ?? 'The vendor bills in the base currency, so the payment is in it too.'}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${FIELD} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
            >
              <span className="flex items-center gap-2 min-w-0">{face}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-1 rounded-lg">
            <div role="listbox" aria-label="Payment currency">
              {options.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={code === value}
                  onClick={() => { onChange(code); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] cursor-pointer transition-colors ${
                    code === value ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'
                  }`}
                >
                  <CurrencyFlag code={code} size={18} />
                  <span className="w-9 shrink-0" style={{ fontWeight: 600 }}>{code}</span>
                  <span className="truncate text-slate-600">{getCurrency(code)?.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{tag(code)}</span>
                  {code === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <p className="text-[11px] text-slate-400 mt-1 truncate">{helper}</p>
    </div>
  );
}

/** The payment's rate: the invoices' currency on the payment date. */
export function PaymentRateField({
  settledCurrency,
  quoteRate,
  paymentDate,
  typed,
  onTypedChange,
  canEdit,
}: {
  /** The invoices' currency, the one the rate converts. */
  settledCurrency: string;
  /** The rate table's mid-market rate on the payment date. */
  quoteRate: number | null;
  paymentDate: string;
  /** A rate entered on the payment (null keeps the table's). */
  typed: string | null;
  onTypedChange: (v: string | null) => void;
  /** Settings, Permissions: whether the acting role may change it. */
  canEdit: boolean;
}) {
  const isBase = isBaseCurrency(settledCurrency);
  const day = formatRateDate(paymentDate);
  const typedNum = typed != null && typed.trim() !== '' ? Number(typed) : null;
  const edited = typedNum != null && quoteRate != null && typedNum !== quoteRate;
  const invalid = typed != null && typed.trim() !== '' && !(typedNum != null && typedNum > 0);
  const label = (
    <Label className={LABEL} style={{ fontWeight: 500 }}>
      Exchange Rate
      <InfoTip>
        Base currency per 1 unit of the invoices’ currency, on the payment date. The difference from each invoice’s own rate
        is the exchange difference. Your role may enter the rate the bank used if Settings, Permissions allows it.
      </InfoTip>
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
        <p className="text-[11px] text-slate-400 mt-1 truncate">The invoices are in the base currency, so the rate is 1.</p>
      </div>
    );
  }
  const prefix = <span className="text-slate-500 whitespace-nowrap shrink-0">1 {settledCurrency} =</span>;
  const suffix = <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>;
  return (
    <div>
      {label}
      {canEdit ? (
        <div
          className={`${FIELD} bg-white border ${
            invalid ? 'border-red-400 ring-2 ring-red-100' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20'
          }`}
        >
          {prefix}
          <input
            inputMode="decimal"
            aria-label="Exchange rate, base currency per 1 unit of the invoices’ currency"
            value={typed ?? (quoteRate != null ? formatRate(quoteRate).replace(/,/g, '') : '')}
            placeholder="Enter rate"
            onChange={(e) => onTypedChange(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => {
              if (typedNum != null && quoteRate != null && typedNum === quoteRate) onTypedChange(null);
            }}
            className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-foreground"
            style={{ fontWeight: 500 }}
          />
          {suffix}
          {edited && quoteRate != null && (
            <button
              type="button"
              onClick={() => onTypedChange(null)}
              className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
              title={`Back to the rate on the payment date, ${formatRate(quoteRate)}`}
              aria-label="Reset to the rate on the payment date"
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
                {quoteRate != null ? formatRate(quoteRate) : '—'}
              </span>
              {suffix}
              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
            <p className="text-[11px] text-slate-500 leading-snug">
              Your role can’t change the exchange rate on a payment. Settings, Permissions sets who can.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
      <p className="text-[11px] mt-1 truncate flex items-center gap-1" style={{ color: invalid ? '#EF4444' : edited ? '#B45309' : 'rgb(148 163 184)' }}>
        {invalid ? (
          <>
            <AlertCircle className="w-3 h-3 shrink-0" />
            Enter a rate above zero.
          </>
        ) : edited && quoteRate != null ? (
          `Changed from ${formatRate(quoteRate)}, the rate on ${day}`
        ) : (
          `Mid-market rate on ${day} (payment date) · ${RATE_PROVIDER}`
        )}
      </p>
    </div>
  );
}
