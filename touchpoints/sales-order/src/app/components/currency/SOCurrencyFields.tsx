import * as React from "react";
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, Info, Lock, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { SOCurrencyChoice } from "@/app/components/so/soCurrency";
import type { SalesOrder } from "@/app/components/so/types";
import { BASE_CURRENCY, CURRENCIES, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, formatRateDate } from "@/app/currency/money";
import { crossRate, customerCurrency, roundTo, soFx } from "@/app/currency/soFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyChip";

/* ── Order Summary: Currency and Exchange Rate (spec 4.3) ─────────────
 * Same pattern as Purchase Orders. The SO's currency, from the quote or
 * the customer's default, is changed here, near the totals. Choosing
 * another currency opens a confirmation with the rate and the new totals;
 * confirming converts every line. The rate is taken on the order date:
 * mid-market is read-only, corporate can be changed on the SO. Both are
 * fixed once the order leaves Draft. Same row recipe as the rest of Order
 * Summary: a 10/500 slate-400 label, 12/500 slate-700 values. */

const FONT = "Inter, system-ui, sans-serif";

const LABEL: React.CSSProperties = { fontSize: 10, fontWeight: 500 };
const FIELD = "mt-1 h-8 w-full rounded-md px-2.5 flex items-center gap-1.5 text-[12px]";
const LOCKED = `${FIELD} border border-slate-200 bg-slate-50 cursor-not-allowed`;

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-slate-300 cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top">{children}</TooltipContent>
    </Tooltip>
  );
}

/** Every active currency, searchable by code, name or country (spec 2.3). */
function CurrencyPicker({
  value,
  onPick,
  disabled,
  customerDefault,
}: {
  value: string;
  onPick: (code: string) => void;
  disabled: boolean;
  customerDefault: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const cur = getCurrency(value);
  const q = query.trim().toLowerCase();
  const list = q
    ? CURRENCIES.filter(
        (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
      )
    : CURRENCIES;
  if (disabled) {
    return (
      <div className={LOCKED}>
        <CurrencyFlag code={value} />
        <span className="text-slate-700" style={{ fontWeight: 500 }}>{value}</span>
        <span className="text-slate-500 truncate">{cur?.name}</span>
        <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Order currency"
          className={`${FIELD} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <CurrencyFlag code={value} />
            <span className="text-slate-700" style={{ fontWeight: 500 }}>{value}</span>
            <span className="text-slate-500 truncate">{cur?.name}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0 rounded-lg z-[200]" style={{ fontFamily: FONT }}>
        <div className="p-2 border-b border-slate-100">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search currency, code or country"
            className="w-full h-8 px-2.5 rounded-md border border-border text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1" role="listbox">
          {list.length === 0 && <p className="px-3 py-3 text-[12px] text-slate-400">No currency matches "{query}".</p>}
          {list.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={c.code === value}
              onClick={() => { setOpen(false); setQuery(""); if (c.code !== value) onPick(c.code); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] cursor-pointer transition-colors ${
                c.code === value ? "bg-primary/[0.06] text-primary" : "hover:bg-slate-50 text-foreground"
              }`}
            >
              <CurrencyFlag code={c.code} />
              <span className="w-9 shrink-0" style={{ fontWeight: 600 }}>{c.code}</span>
              <span className="truncate text-slate-600">{c.name}</span>
              {(c.code === customerDefault || c.code === BASE_CURRENCY) && c.code !== value && (
                <span className="ml-auto shrink-0 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                  {c.code === customerDefault ? "Customer" : "Base"}
                </span>
              )}
              {c.code === value && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Mid-market | Corporate, as the Exchange Rates module names them. */
function RateTypeToggle({ value, onChange, corporateAvailable }: { value: RateType; onChange: (t: RateType) => void; corporateAvailable: boolean }) {
  return (
    <span className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-px" role="radiogroup" aria-label="Rate type">
      {(["mid", "corporate"] as RateType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => value !== t && onChange(t)}
          title={t === "corporate" && !corporateAvailable ? "No corporate rate is set for this currency; enter one" : undefined}
          className={`px-1.5 py-px rounded text-[10px] cursor-pointer transition-colors ${
            value === t ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-slate-500 hover:text-foreground"
          }`}
          style={{ fontWeight: value === t ? 600 : 500 }}
        >
          {RATE_TYPE_LABEL[t]}
        </button>
      ))}
    </span>
  );
}

/** The order's totals in its currency, for the confirmation. */
export interface SOCurrencyTotals {
  subtotal: number;
  /** Rules and one-time adjustments, signed (+ premium, − discount). */
  adjustments: number;
  freight: number;
  total: number;
}

export interface SOCurrencyChange {
  next: SOCurrencyChoice;
  /** For the version history: "Currency", "Exchange rate". */
  subject: string;
}

export function SOCurrencyFields({
  so,
  canEdit,
  lockReason,
  totals,
  totalsFor,
  onChange,
}: {
  so: SalesOrder;
  canEdit: boolean;
  /** Why the fields are read-only, for the info tooltip. */
  lockReason?: string;
  totals: SOCurrencyTotals;
  /** The totals the order would have in another currency; without it they
   *  are worked out at the cross rate. */
  totalsFor?: (next: SOCurrencyChoice) => SOCurrencyTotals;
  onChange: (change: SOCurrencyChange) => void;
}) {
  const fx = soFx(so);
  const customerDefault = customerCurrency(so.customer);
  const isBase = fx.isBase;
  const corporate = fx.rateType === "corporate";
  const day = formatRateDate(fx.rateDate);
  const corpQuote = rateOn(fx.currency, fx.rateDate, "corporate");
  const midQuote = rateOn(fx.currency, fx.rateDate, "mid");
  const [pending, setPending] = React.useState<string | null>(null);
  const [typed, setTyped] = React.useState<string | null>(null);
  React.useEffect(() => setTyped(null), [fx.currency, fx.rate, fx.rateType]);

  const commitRate = (raw: string | null) => {
    setTyped(null);
    if (raw == null) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n === fx.rate) return;
    onChange({
      next: { currency: fx.currency, rateType: "corporate", exchangeRate: n, rateEdited: n !== corpQuote.rate },
      subject: "Exchange rate",
    });
  };

  const switchType = (t: RateType) => {
    // No corporate rate set for the currency: start from the mid-market one, to be changed.
    const quote = t === "corporate" ? (corpQuote.rate != null ? corpQuote : midQuote) : midQuote;
    onChange({
      next: { currency: fx.currency, rateType: t, exchangeRate: quote.rate ?? fx.rate, rateEdited: t === "corporate" && corpQuote.rate == null },
      subject: "Exchange rate",
    });
  };

  return (
    <div className="border-t border-muted pt-3 mb-3 space-y-2.5">
      {/* Currency */}
      <div>
        <p className="text-slate-400 flex items-center gap-1" style={LABEL}>
          Currency
          <InfoTip>
            Every price, total, discount and invoice on this order is in this currency. It comes from the quote, or
            the customer's default when the order was created directly; changing it converts all lines at the order
            date's rates.{lockReason ? ` ${lockReason}` : ""}
          </InfoTip>
        </p>
        <CurrencyPicker value={fx.currency} onPick={setPending} disabled={!canEdit} customerDefault={customerDefault} />
        <p className="text-slate-400 mt-1 truncate" style={{ fontSize: 10, fontWeight: 400 }}>
          {fx.currency !== customerDefault
            ? `Changed from ${customerDefault}, the customer's default`
            : so.sourceQuoteRef
              ? `From quote ${so.sourceQuoteRef}, in the customer's default currency`
              : `${so.customer || "The customer"}'s default currency${isBase ? ", and the base currency" : ""}`}
        </p>
      </div>

      {/* Exchange rate */}
      <div>
        <div className="flex items-center gap-1">
          <p className="text-slate-400 flex items-center gap-1" style={LABEL}>
            Exchange rate
            <InfoTip>
              {BASE_CURRENCY} per 1 {fx.currency}, taken on the order date. A mid-market rate comes from {RATE_PROVIDER}
              and is read-only; a corporate rate is set by finance and can be changed on the SO while it is a Draft.
            </InfoTip>
          </p>
          {!isBase && canEdit && <RateTypeToggle value={fx.rateType} onChange={switchType} corporateAvailable={corpQuote.rate != null} />}
        </div>
        {isBase ? (
          <div className={LOCKED}>
            <span className="text-slate-500">No conversion</span>
            <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
          </div>
        ) : corporate && canEdit ? (
          <div className={`${FIELD} bg-white border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20`}>
            <span className="text-slate-500 whitespace-nowrap shrink-0">1 {fx.currency} =</span>
            <input
              inputMode="decimal"
              aria-label={`Corporate rate, ${BASE_CURRENCY} per 1 ${fx.currency}`}
              value={typed ?? formatRate(fx.rate).replace(/,/g, "")}
              onChange={(e) => setTyped(e.target.value.replace(/[^\d.]/g, ""))}
              onBlur={() => commitRate(typed)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setTyped(null);
              }}
              className="flex-1 min-w-0 bg-transparent outline-none tabular-nums text-slate-700"
              style={{ fontWeight: 500 }}
            />
            <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>
            {so.rateEdited && corpQuote.rate != null && (
              <button
                type="button"
                onClick={() => onChange({ next: { currency: fx.currency, rateType: "corporate", exchangeRate: corpQuote.rate!, rateEdited: false }, subject: "Exchange rate" })}
                className="shrink-0 text-slate-400 hover:text-primary cursor-pointer"
                title={`Back to the corporate rate, ${formatRate(corpQuote.rate)}`}
                aria-label="Reset to the corporate rate"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className={LOCKED}>
            <span className="text-slate-500 whitespace-nowrap shrink-0">1 {fx.currency} =</span>
            <span className="tabular-nums text-slate-700" style={{ fontWeight: 500 }}>{formatRate(fx.rate)}</span>
            <span className="text-slate-500 shrink-0">{BASE_CURRENCY}</span>
            <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
          </div>
        )}
        <p className="mt-1 truncate" style={{ fontSize: 10, fontWeight: 400, color: so.rateEdited ? "#B45309" : "#94A3B8" }}>
          {isBase
            ? `${BASE_CURRENCY} is the base currency, so the rate is 1`
            : !corporate
              ? `${RATE_TYPE_LABEL.mid} rate on ${day} (order date) · ${RATE_PROVIDER}`
              : so.rateEdited
                ? corpQuote.rate != null
                  ? `Changed on the SO from ${formatRate(corpQuote.rate)}, the corporate rate on ${day}`
                  : `Entered on the SO; no corporate rate set for ${fx.currency} on ${day}`
                : `Corporate rate in effect on ${day} · ${corpQuote.source.replace(/^Set by/, "set by")}`}
        </p>
      </div>

      {pending && (
        <SOCurrencyConfirmDialog
          so={so}
          totals={totals}
          totalsFor={totalsFor}
          to={pending}
          onCancel={() => setPending(null)}
          onConfirm={(next) => {
            setPending(null);
            onChange({ next, subject: "Currency" });
          }}
        />
      )}
    </div>
  );
}

/** The confirmation a currency change asks for: the rate, and the totals before and after. */
function SOCurrencyConfirmDialog({
  so,
  totals,
  totalsFor,
  to,
  onCancel,
  onConfirm,
}: {
  so: SalesOrder;
  totals: SOCurrencyTotals;
  totalsFor?: (next: SOCurrencyChoice) => SOCurrencyTotals;
  to: string;
  onCancel: () => void;
  onConfirm: (next: SOCurrencyChoice) => void;
}) {
  const from = soFx(so);
  // Keep the rate type; finance may have no corporate rate for the new currency.
  const corp = rateOn(to, from.rateDate, "corporate");
  const type: RateType = from.rateType === "corporate" && corp.rate != null ? "corporate" : "mid";
  const quote = type === "corporate" ? corp : rateOn(to, from.rateDate, "mid");
  const next: SOCurrencyChoice = { currency: to, rateType: type, exchangeRate: isBaseCurrency(to) ? 1 : quote.rate ?? 1 };
  // Every amount converts at the cross rate between the two rates (withSOCurrency in store.tsx).
  const factor = crossRate(from.rate, next.exchangeRate);
  const conv = (n: number) => roundTo(to, n * factor);
  const before = totals;
  const now = totalsFor
    ? totalsFor(next)
    : { subtotal: conv(totals.subtotal), adjustments: conv(totals.adjustments), freight: conv(totals.freight), total: conv(totals.total) };
  const lines = so.lines.filter((l) => !l.cancelled).length;
  const toName = getCurrency(to)?.name ?? to;
  const rows: [string, number, number][] = [
    ["Subtotal", before.subtotal, now.subtotal],
    ["Discounts & premiums", before.adjustments, now.adjustments],
    ...(before.freight ? ([["Freight", before.freight, now.freight]] as [string, number, number][]) : []),
    ["Total", before.total, now.total],
  ];
  const signed = (n: number, code: string) => (n > 0 ? `+${formatMoney(n, code)}` : formatMoney(n, code));

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{ fontFamily: FONT, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <div className="rounded-t-2xl border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "#EFF6FF" }}>
              <ArrowLeftRight className="h-4 w-4" style={{ color: "#0A77FF" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-slate-900" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                Change this order to {toName} ({to})?
              </DialogTitle>
              <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                All {lines} line price{lines === 1 ? "" : "s"} on {so.soNumber} are converted from {from.currency} to {to} at the
                rates on the order date, {formatRateDate(from.rateDate)}.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3" style={{ backgroundColor: "#FAFBFC" }}>
          {/* The rate */}
          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Exchange rate</span>
              <span className="text-[10px]" style={{ fontWeight: 600, color: type === "mid" ? "#6D28D9" : "#B45309" }}>
                {RATE_TYPE_LABEL[type]}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
              <CurrencyFlag code={to} />
              {isBaseCurrency(to) ? `${to} is the base currency, so the rate is 1` : `1 ${to} = ${formatRate(next.exchangeRate)} ${BASE_CURRENCY}`}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
              1 {from.currency} = {formatRate(crossRate(from.rate, next.exchangeRate))} {to}
              <span className="text-slate-400">
                {" · "}
                {type === "mid" ? RATE_PROVIDER : quote.source.replace(/^Set by/, "set by")}, {formatRateDate(from.rateDate)}
              </span>
            </p>
            {from.rateType === "corporate" && type === "mid" && (
              <p className="mt-1 text-[11px] text-amber-700">No corporate rate is set for {to}, so the mid-market rate is used.</p>
            )}
          </div>

          {/* The totals */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_16px_auto] items-center gap-x-2 px-3.5 py-2 border-b border-slate-100 text-[10px] text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              <span />
              <span className="flex items-center gap-1 justify-end"><CurrencyFlag code={from.currency} size={10} />{from.currency} now</span>
              <span />
              <span className="flex items-center gap-1 justify-end"><CurrencyFlag code={to} size={10} />{to} after</span>
            </div>
            {rows.map(([label, a, b]) => {
              const total = label === "Total";
              return (
                <div
                  key={label}
                  className={`grid grid-cols-[1fr_auto_16px_auto] items-center gap-x-2 px-3.5 py-1.5 tabular-nums ${total ? "border-t border-slate-100 bg-slate-50/60" : ""}`}
                  style={{ fontSize: total ? 13 : 12, fontWeight: total ? 700 : 500 }}
                >
                  <span className="text-slate-500" style={{ fontWeight: total ? 600 : 500 }}>{label}</span>
                  <span className="text-right text-slate-500">{label === "Discounts & premiums" ? signed(a, from.currency) : formatMoney(a, from.currency)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-300 justify-self-center" />
                  <span className="text-right text-slate-800">{label === "Discounts & premiums" ? signed(b, to) : formatMoney(b, to)}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums">
              <span>In {BASE_CURRENCY}, the base currency</span>
              <span>
                {formatMoney(toBase(before.total, from.rate), BASE_CURRENCY)} → {formatMoney(toBase(now.total, next.exchangeRate), BASE_CURRENCY)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Prices are rounded to {to}'s minor unit. Quantities, % discounts and pricing rules stay applied; flat rule
            amounts, fixed one-time discounts/premiums and freight are converted too. Documents already linked keep
            their currency.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(next)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors"
            style={{ backgroundColor: "#0A77FF" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0866DE"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#0A77FF"; }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Convert to {to}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
