import * as React from "react";
import { Check, ChevronDown, Lock, RotateCcw, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { QuoteCurrencyChoice } from "@/app/components/quote-details/quoteCurrency";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { eligibleAccounts, resolveAccount, type CompanyAccount } from "@/app/currency/companyAccounts";
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from "@/app/currency/money";
import { crossRate, customerCurrency, type QuoteFx } from "@/app/currency/qFx";
import { LAST_SYNC, RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyChip";
import { linkProvider } from "./ProviderLink";
import {
  CurrencyPicker,
  QuoteCurrencyConfirmDialog,
  RateTypeToggle,
  type QuoteCurrencyChange,
  type QuoteCurrencyTotals,
} from "./QuoteCurrencyFields";

/* ── The quote's currency: Quote Summary card and Currency configuration ──
 * As the Currency Touchpoints Map draws it for quotes (24 Nov 2026), on the
 * module's earlier configuration (ported from the first Quotes touchpoint,
 * the way Purchase Orders has it):
 *  - "Customer pays": the quote's total and its currency, the customer's by
 *    default (spec 4.2). Changing it converts every line at the quote
 *    date's rates, after the redesign's confirmation (QuoteCurrencyConfirmDialog).
 *  - "You receive in": the bank or cash account the customer pays into, in
 *    the base currency or the quote's (currency/companyAccounts.ts).
 *  - "Base equivalent": the total in the base currency at the quote's rate.
 *  - "Exchange rate": the quote date's, mid-market (read-only) or corporate
 *    (finance's, which can be changed on the quote).
 * Laid out as Purchase Orders has it (POCurrencyConfigDialog, 25 Nov 2026).
 * All of it changes only while the quote is a Draft; once the quote is sent
 * the configuration is read-only. The exchange rate shows no lock of its
 * own anywhere (25 Nov 2026). Every change goes through the page's
 * versioning (QuoteDetails handleCurrencyChange). */

const FONT = "Inter, system-ui, sans-serif";
const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };
const RATE_TINT: Record<RateType, string> = { mid: "rgba(124,58,237,0.08)", corporate: "rgba(180,83,9,0.10)" };

/** "₨645.20 PKR": an amount with its code, as the card writes it. */
const withCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

/** "Pakistani Rupee (PKR)": a currency by name, as the card writes it. */
const currencyNameWithCode = (code: string) => {
  const upper = code.toUpperCase();
  return `${getCurrency(upper)?.name ?? upper} (${upper})`;
};

/** "the quote date"; the day today's rate was applied on a version; or,
 *  on a duplicate that kept it, the original quote's rate date. */
const rateDayNote = (fx: QuoteFx, quoteDay?: string) =>
  !quoteDay || fx.rateDate === quoteDay
    ? "the quote date"
    : fx.rateDate > quoteDay
      ? "applied on a new version"
      : "kept from the original quote";

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

/* ── Quote Summary: CURRENCY ───────────────────────────────────────── */

export function QuoteCurrencySummary({
  fx,
  total,
  payToAccount,
  settlementCurrency,
  rateEdited,
  quoteDay,
  onViewConfig,
}: {
  fx: QuoteFx;
  /** The quote's total, in its currency. */
  total: number;
  /** The account the customer pays into (currency/companyAccounts.ts). */
  payToAccount?: string;
  settlementCurrency?: string;
  /** The quote has left Draft. Not shown: the exchange rate shows no lock
   *  of its own (25 Nov 2026). */
  locked: boolean;
  rateEdited?: boolean;
  /** The quote date (ISO), to tell a rate applied on a later version apart. */
  quoteDay?: string;
  onViewConfig: () => void;
}) {
  const account = resolveAccount(fx.currency, payToAccount, settlementCurrency);
  const receive = account.currency;
  const baseTotal = toBase(total, fx.rate);

  /* Currency information (25 Nov 2026, as Purchase Orders has it): what the
     customer pays, the currency you receive in (the pay-to account's, by
     name), the base equivalent (always), then the exchange rate with its
     type. The amounts agree with Quote Summary's Grand Total: base = total
     × the quote's rate. */
  const rows: { label: string; code: string; amount?: number; title?: string }[] = [
    { label: "Customer pays", code: fx.currency, amount: total },
    { label: "You receive in", code: receive, title: `Paid into ${account.label}` },
    { label: "Base equivalent", code: BASE_CURRENCY, amount: baseTotal },
  ];
  const rateTypeTip =
    fx.rateType === "mid"
      ? `The mid-market rate on ${formatRateDate(fx.rateDate)}, ${rateDayNote(fx, quoteDay)} · ${RATE_PROVIDER}`
      : rateEdited
        ? `A corporate rate entered on this quote (${formatRateDate(fx.rateDate)})`
        : `Finance's corporate rate in effect on ${formatRateDate(fx.rateDate)}, ${rateDayNote(fx, quoteDay)}`;

  return (
    <div className="border-t border-muted pt-3 mt-3 space-y-2" style={{ fontFamily: FONT }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
          Currency information
        </span>
        {/* No lock on the rate (25 Nov 2026): the configuration locks with the
            quote, the exchange rate shows no lock of its own. */}
      </div>

      {fx.isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2" title={r.title}>
              <p className="text-slate-400 shrink-0" style={{ fontSize: 10, fontWeight: 500 }}>{r.label}</p>
              <p className="flex items-center gap-1.5 text-slate-700 tabular-nums text-right min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
                {/* A flag on the quote's amount and the account's currency; the base equivalent reads plainly. */}
                {(r.amount === undefined || r.code.toUpperCase() !== BASE_CURRENCY) && <CurrencyFlag code={r.code} size={11} />}
                <span className="truncate">{r.amount === undefined ? currencyNameWithCode(r.code) : withCode(r.amount, r.code)}</span>
              </p>
            </div>
          ))}
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>Exchange rate</p>
            <div className="flex flex-col items-end min-w-0">
              <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-slate-700 tabular-nums text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                <span className="whitespace-nowrap">
                  1 {fx.currency} = {moneyPrefix(BASE_CURRENCY)}{formatRate(fx.rate)} {BASE_CURRENCY}
                </span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help shrink-0">
                      <RateTypeChip type={fx.rateType} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                    {rateTypeTip}
                  </TooltipContent>
                </Tooltip>
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onViewConfig}
          className="mt-1 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-white text-[12px] text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Settings2 className="w-3.5 h-3.5" />
          View currency configuration
        </button>
      </div>
    </div>
  );
}

/* ── Currency configuration ────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>
      {children}
    </section>
  );
}

/** A read-only amount, as the dialog shows it. */
function AmountBox({ text }: { text: string }) {
  return (
    <div
      className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
      style={{ fontWeight: 500 }}
      aria-readonly="true"
    >
      <span className="truncate">{text}</span>
    </div>
  );
}

/** The amount (read-only) beside the currency it's in. */
function AmountRow({ text, picker }: { text: string; picker: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <AmountBox text={text} />
      <div className="w-[248px] shrink-0">{picker}</div>
    </div>
  );
}

/** The time of day the provider's rates sync, e.g. "7:30 PM". */
const SYNC_TIME = new Date(LAST_SYNC).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Under the rate (25 Nov 2026): when a mid-market rate was last updated,
 *  or from when a corporate rate is in effect. Not the quote date. */
export function rateAsOfLine(type: RateType, date: string, effectiveDate?: string | null, entered?: boolean): string {
  if (type === "mid") return `Rate updated as of ${formatRateDate(date)}, ${SYNC_TIME}`;
  if (entered) return `Entered on this quote · effective from ${formatRateDate(date)}`;
  return `Effective from ${formatRateDate(effectiveDate ?? date)}`;
}

/** "● Mid-market · Open Exchange Rates", the rate both ways, and when it is
 *  as of (rateAsOfLine). */
function RateCard({ from, rate, type, source, day }: { from: string; rate: number; type: RateType; source: string; day: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
        <span style={{ color: RATE_HEX[type], fontWeight: 600 }}>{RATE_TYPE_LABEL[type]}</span>
        <span className="text-slate-500">· {linkProvider(source)}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
        <div>1 {from} = {formatRate(rate)} {BASE_CURRENCY}</div>
        <div className="text-slate-500" style={{ fontWeight: 400 }}>1 {BASE_CURRENCY} = {formatRate(1 / rate)} {from}</div>
      </div>
      {/* The rate itself never locks (25 Nov 2026); only the configuration
          does, once the quote is sent. */}
      <div className="mt-1.5 text-[10.5px] text-slate-400 tabular-nums">{day}</div>
    </div>
  );
}

const FIELD = "h-10 w-full rounded-lg px-2.5 flex items-center gap-1.5 text-[12px]";

/** The pay-to account: any bank or cash account (25 Nov 2026), base
 *  currency first, then the quote's, then the rest. */
function AccountPicker({
  value,
  docCurrency,
  onPick,
  disabled,
}: {
  value: CompanyAccount;
  docCurrency: string;
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const accounts = eligibleAccounts(docCurrency);
  const groups: { label: string; items: CompanyAccount[] }[] = [
    { label: `In ${BASE_CURRENCY} · base currency`, items: accounts.filter((a) => isBaseCurrency(a.currency)) },
    { label: `In ${docCurrency} · quote currency`, items: accounts.filter((a) => !isBaseCurrency(a.currency) && a.currency === docCurrency.toUpperCase()) },
    { label: "Other currencies", items: accounts.filter((a) => !isBaseCurrency(a.currency) && a.currency !== docCurrency.toUpperCase()) },
  ].filter((g) => g.items.length > 0);
  const face = (
    <span className="flex items-center gap-1.5 min-w-0">
      <CurrencyFlag code={value.currency} />
      <span className="text-slate-700 truncate" style={{ fontWeight: 500 }}>{value.label}</span>
      <span className="text-slate-500 shrink-0">· {value.currency}</span>
    </span>
  );
  if (disabled) {
    return (
      <div className={`${FIELD} border border-slate-200 bg-slate-50 cursor-not-allowed`} title={`${value.label} · ${value.currency}`}>
        {face}
        <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account the customer pays into"
          className={`${FIELD} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
        >
          {face}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0 rounded-lg z-[200]" style={{ fontFamily: FONT }}>
        <div className="max-h-[280px] overflow-y-auto py-1" role="listbox" aria-label="Pay-to accounts">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.05em" }}>
                {g.label}
              </p>
              {g.items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={a.id === value.id}
                  onClick={() => { setOpen(false); if (a.id !== value.id) onPick(a.id); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] cursor-pointer transition-colors ${
                    a.id === value.id ? "bg-primary/[0.06] text-primary" : "hover:bg-slate-50 text-foreground"
                  }`}
                >
                  <CurrencyFlag code={a.currency} />
                  <span className="truncate" style={{ fontWeight: 500 }}>{a.label}</span>
                  {a.type === "cash" && <span className="shrink-0 text-[10px] text-slate-400">Cash</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{a.currency}</span>
                  {a.id === value.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QuoteCurrencyConfigDialog({
  fx,
  customerName,
  quoteNumber,
  lineCount,
  payToAccount,
  settlementCurrency,
  rateEdited: savedRateEdited,
  quoteDay,
  open,
  onOpenChange,
  canEdit,
  locked,
  totals,
  totalsFor,
  onChange,
}: {
  fx: QuoteFx;
  customerName: string;
  quoteNumber: string;
  lineCount: number;
  payToAccount?: string;
  settlementCurrency?: string;
  rateEdited?: boolean;
  quoteDay?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A Draft that isn't read-only. */
  canEdit: boolean;
  /** The quote has left Draft: the configuration is read-only. */
  locked: boolean;
  totals: QuoteCurrencyTotals;
  /** The quote's totals at another currency or rate (the convert confirmation's). */
  totalsFor?: (next: QuoteCurrencyChoice) => QuoteCurrencyTotals;
  onChange: (change: QuoteCurrencyChange) => void;
}) {
  const customerDefault = customerCurrency(customerName);
  const savedAccount = resolveAccount(fx.currency, payToAccount, settlementCurrency).id;

  const [currency, setCurrency] = React.useState(fx.currency);
  const [accountId, setAccountId] = React.useState(savedAccount);
  const [type, setType] = React.useState<RateType>(fx.rateType);
  const [rateText, setRateText] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCurrency(fx.currency);
    setAccountId(savedAccount);
    setType(fx.rateType);
    setRateText(null);
    setConfirming(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const corpQuote = rateOn(currency, fx.rateDate, "corporate");
  const midQuote = rateOn(currency, fx.rateDate, "mid");
  const foreign = !isBaseCurrency(currency);
  const sameCurrency = currency === fx.currency;
  // The rate the draft would use: the quote's own while nothing about it changes.
  const quotedRate = !foreign
    ? 1
    : sameCurrency && type === fx.rateType
      ? fx.rate
      : type === "corporate"
        ? corpQuote.rate ?? midQuote.rate ?? 1
        : midQuote.rate ?? 1;
  const typedRate = rateText != null && Number(rateText) > 0 ? Number(rateText) : null;
  const rate = type === "corporate" && typedRate != null ? typedRate : quotedRate;
  const rateEdited =
    type === "corporate" &&
    (typedRate != null
      ? typedRate !== corpQuote.rate
      : corpQuote.rate == null || (sameCurrency && !!savedRateEdited && type === fx.rateType));
  const rateChanged = foreign && (type !== fx.rateType || Math.abs(rate - fx.rate) > 1e-9);

  /* Any account can take the draft currency (25 Nov 2026); a currency
     change keeps the one picked. */
  const account = resolveAccount(currency, accountId);

  /* Preview totals as the quote will have them: a fixed-amount pricing rule
     converts at the quote's rate, so a rate change can move the total too. */
  const customerTotal = React.useMemo(() => {
    if (sameCurrency && !rateChanged) return totals.total;
    if (totalsFor) return totalsFor({ currency, rateType: type, exchangeRate: rate }).total;
    return sameCurrency ? totals.total : totals.total * crossRate(fx.rate, rate);
  }, [sameCurrency, rateChanged, totals.total, totalsFor, currency, type, rate, fx.rate]);
  const baseTotal = toBase(customerTotal, rate);

  const dirty = currency !== fx.currency || account.id !== savedAccount || rateChanged;

  const finish = (next: QuoteCurrencyChoice, subject: string) => {
    onChange({ next, subject });
    onOpenChange(false);
  };

  const save = () => {
    if (!canEdit || !dirty) {
      onOpenChange(false);
      return;
    }
    if (currency !== fx.currency) {
      setConfirming(true);
      return;
    }
    finish(
      { currency, rateType: type, exchangeRate: rate, rateEdited, payToAccount: account.id },
      rateChanged ? "Exchange rate" : "You receive",
    );
  };

  const reset = () => {
    setCurrency(customerDefault);
    setAccountId(resolveAccount(customerDefault).id);
    setType("mid");
    setRateText(null);
  };

  const readOnly = !canEdit;
  const source =
    type === "mid"
      ? RATE_PROVIDER
      : corpQuote.rate == null
        ? `No corporate rate for ${currency}; enter one`
        : rateEdited
          ? "Entered on this quote"
          : corpQuote.source.replace(/^Set by/, "set by");

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[600px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
          style={{ fontFamily: FONT, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
            <div className="flex items-start gap-2.5 pr-6">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "#EFF6FF" }}>
                <Settings2 className="h-4 w-4" style={{ color: "#0A77FF" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                    Currency configuration
                  </DialogTitle>
                </div>
                <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  {locked
                    ? "This quote has been sent, so its currency configuration can't be changed."
                    : readOnly
                      ? "This quote can't be changed now, so its currency configuration is read-only."
                      : "For this quote only. The customer's currency stays the same."}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>
            <Section label="Customer pays">
              <AmountRow
                text={withCode(customerTotal, currency)}
                picker={
                  <CurrencyPicker
                    value={currency}
                    onPick={(c) => {
                      setCurrency(c);
                      setRateText(null);
                    }}
                    disabled={readOnly}
                    customerDefault={customerDefault}
                    ariaLabel="Customer pays currency"
                    className="!mt-0 !h-10"
                  />
                }
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {currency === customerDefault
                  ? "Defaults to the customer's currency."
                  : `Changed from ${customerDefault}, the customer's currency. Every line converts at the quote date's rate.`}
              </p>
            </Section>

            <Section label="You receive in">
              <AccountPicker value={account} docCurrency={currency} onPick={setAccountId} disabled={readOnly} />
            </Section>

            <Section label="Base equivalent">
              <AmountBox text={`${foreign ? "≈ " : ""}${formatMoney(baseTotal, BASE_CURRENCY)} ${BASE_CURRENCY}`} />
            </Section>

            {foreign && (
              <section className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>Exchange rate</p>
                  {readOnly ? (
                    <span className="ml-auto"><RateTypeChip type={type} /></span>
                  ) : (
                    <RateTypeToggle
                      value={type}
                      onChange={(t) => {
                        setType(t);
                        setRateText(null);
                      }}
                      corporateAvailable={corpQuote.rate != null}
                    />
                  )}
                </div>
                {type === "corporate" && !readOnly ? (
                  <div className="h-10 w-full rounded-lg px-3 flex items-center gap-1.5 text-[13px] bg-white border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                    <span className="text-slate-500 whitespace-nowrap shrink-0">1 {currency} =</span>
                    <input
                      inputMode="decimal"
                      aria-label={`Corporate rate, ${BASE_CURRENCY} per 1 ${currency}`}
                      value={rateText ?? formatRate(rate).replace(/,/g, "")}
                      onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, ""))}
                      className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-slate-700"
                      style={{ fontWeight: 500 }}
                    />
                    <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>
                    {rateEdited && corpQuote.rate != null && (
                      <button
                        type="button"
                        onClick={() => setRateText(String(corpQuote.rate))}
                        className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
                        title={`Back to finance's corporate rate, ${formatRate(corpQuote.rate)}`}
                        aria-label="Reset to the corporate rate"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : null}
                <RateCard from={currency} rate={rate} type={type} source={source} day={rateAsOfLine(type, fx.rateDate, corpQuote.effectiveDate, rateEdited)} />
              </section>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
            <button
              type="button"
              onClick={reset}
              disabled={readOnly}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty}
                  className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: "#0A77FF" }}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {open && confirming && (
        <QuoteCurrencyConfirmDialog
          fx={fx}
          quoteNumber={quoteNumber}
          lineCount={lineCount}
          totals={totals}
          totalsFor={totalsFor}
          to={currency}
          rateType={type}
          onCancel={() => setConfirming(false)}
          onConfirm={(next) => {
            setConfirming(false);
            finish({ ...next, payToAccount: resolveAccount(next.currency, account.id).id }, "Currency");
          }}
        />
      )}
    </>
  );
}
