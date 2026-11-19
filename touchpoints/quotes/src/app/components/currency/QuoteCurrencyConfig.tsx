import * as React from "react";
import { Lock, RotateCcw, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { QuoteCurrencyChoice } from "@/app/components/quote-details/quoteCurrency";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from "@/app/currency/money";
import { crossRate, customerCurrency, type QuoteFx } from "@/app/currency/qFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyChip";
import { linkProvider } from "./ProviderLink";
import {
  CurrencyPicker,
  QuoteCurrencyConfirmDialog,
  RateTypeToggle,
  type QuoteCurrencyChange,
  type QuoteCurrencyTotals,
} from "./QuoteCurrencyFields";

/* ── The quote's currency: Quote Summary card and Currency Configuration ──
 * Ported from the earlier Quotes touchpoint (QuoteCurrencyConfigModal,
 * "Customer Pays" / "You Receive") onto the redesign's currency model, the
 * same way Purchase Orders has it:
 *  - "Customer pays": the quote's currency, the customer's by default
 *    (spec 4.2). Changing it converts every line at the quote date's rates,
 *    after the same confirmation the redesign shows (QuoteCurrencyConfirmDialog).
 *  - "You receive": the currency the quote is settled in, the base currency
 *    unless set here.
 *  - The rate: the quote date's, mid-market (read-only) or corporate
 *    (finance's, which can be changed on the quote).
 * All of it changes only while the quote is a Draft; every change goes
 * through the page's versioning (QuoteDetails handleCurrencyChange). */

const FONT = "Inter, system-ui, sans-serif";
const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };
const RATE_TINT: Record<RateType, string> = { mid: "rgba(124,58,237,0.08)", corporate: "rgba(180,83,9,0.10)" };

/** "₨645.20 PKR": an amount with its code, as the card writes it. */
const withCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

/** One unit of `code` in base on the quote's rate date, or the quote's own rate for its currency. */
function rateToBase(code: string, fx: QuoteFx): number {
  if (isBaseCurrency(code)) return 1;
  if (code === fx.currency) return fx.rate;
  return rateOn(code, fx.rateDate, "mid").rate ?? 1;
}

/** "the quote date", or the day today's rate was applied on a version. */
const rateDayNote = (fx: QuoteFx, quoteDay?: string) =>
  !quoteDay || fx.rateDate === quoteDay ? "the quote date" : "applied on a new version";

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

function LockedChip({ title }: { title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
      style={{ color: "#047857", backgroundColor: "#ECFDF5", fontWeight: 600 }}
      title={title}
    >
      <Lock className="w-2.5 h-2.5" />
      Locked
    </span>
  );
}

/* ── Quote Summary: CURRENCY ───────────────────────────────────────── */

export function QuoteCurrencySummary({
  fx,
  total,
  settlementCurrency,
  locked,
  rateEdited,
  quoteDay,
  onViewConfig,
}: {
  fx: QuoteFx;
  /** The quote's total, in its currency. */
  total: number;
  settlementCurrency?: string;
  /** The quote has left Draft: the rate is fixed. */
  locked: boolean;
  rateEdited?: boolean;
  /** The quote date (ISO), to tell a rate applied on a later version apart. */
  quoteDay?: string;
  onViewConfig: () => void;
}) {
  const receive = (settlementCurrency ?? BASE_CURRENCY).toUpperCase();
  const receiveRate = rateToBase(receive, fx);
  const receiveTotal = receive === fx.currency ? total : total * crossRate(fx.rate, receiveRate);

  const rows: { label: string; code: string; amount: number }[] = [{ label: "Customer pays", code: fx.currency, amount: total }];
  if (receive !== fx.currency) rows.push({ label: "You receive", code: receive, amount: receiveTotal });
  if (!fx.isBase && !isBaseCurrency(receive)) rows.push({ label: "Base equivalent", code: BASE_CURRENCY, amount: toBase(total, fx.rate) });

  const rates: { from: string; rate: number }[] = [];
  if (!fx.isBase) rates.push({ from: fx.currency, rate: fx.rate });
  if (!isBaseCurrency(receive) && receive !== fx.currency) rates.push({ from: receive, rate: receiveRate });

  return (
    <div className="border-t border-muted pt-3 mt-3 space-y-2" style={{ fontFamily: FONT }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
          Currency
        </span>
        <div className="flex items-center gap-1.5">
          {!fx.isBase && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <RateTypeChip type={fx.rateType} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                {fx.rateType === "mid"
                  ? `The mid-market rate on ${formatRateDate(fx.rateDate)}, ${rateDayNote(fx, quoteDay)} · ${RATE_PROVIDER}`
                  : rateEdited
                    ? `A corporate rate entered on this quote (${formatRateDate(fx.rateDate)})`
                    : `Finance's corporate rate in effect on ${formatRateDate(fx.rateDate)}, ${rateDayNote(fx, quoteDay)}`}
              </TooltipContent>
            </Tooltip>
          )}
          {locked && !fx.isBase && (
            <LockedChip title="Locked once the quote was sent to the customer. New versions keep this rate unless today's is applied." />
          )}
        </div>
      </div>

      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>{r.label}</p>
          <p className="flex items-center gap-1.5 text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
            <CurrencyFlag code={r.code} size={11} />
            {withCode(r.amount, r.code)}
          </p>
        </div>
      ))}

      {rates.length > 0 ? (
        <div className="border-t border-slate-100 pt-2 space-y-0.5">
          {rates.map((r, i) => (
            <div key={r.from} className="flex items-center justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>{i === 0 ? "Rate" : ""}</p>
              <p className="text-slate-500 tabular-nums" style={{ fontSize: 11 }}>
                1 {r.from} = {moneyPrefix(BASE_CURRENCY)}{formatRate(r.rate)} {BASE_CURRENCY}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>
      {children}
    </section>
  );
}

/** The amount (read-only) beside the currency it's in. */
function AmountRow({ amount, code, picker }: { amount: number; code: string; picker: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
        style={{ fontWeight: 500 }}
        aria-readonly="true"
      >
        <span className="truncate">{formatMoney(amount, code)}</span>
      </div>
      <div className="w-[200px] shrink-0">{picker}</div>
    </div>
  );
}

function RateCard({ from, rate, type, date, dayNote, source }: { from: string; rate: number; type: RateType; date: string; dayNote: string; source: string }) {
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
      <p className="mt-1 text-[10.5px] text-slate-400">Rate on {formatRateDate(date)}, {dayNote}</p>
    </div>
  );
}

export function QuoteCurrencyConfigDialog({
  fx,
  customerName,
  quoteNumber,
  lineCount,
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
  settlementCurrency?: string;
  rateEdited?: boolean;
  quoteDay?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A Draft that isn't read-only. */
  canEdit: boolean;
  /** The quote has left Draft: the rate is locked. */
  locked: boolean;
  totals: QuoteCurrencyTotals;
  /** The quote's totals in another currency (the convert confirmation's). */
  totalsFor?: (next: QuoteCurrencyChoice) => QuoteCurrencyTotals;
  onChange: (change: QuoteCurrencyChange) => void;
}) {
  const customerDefault = customerCurrency(customerName);
  const savedReceive = (settlementCurrency ?? BASE_CURRENCY).toUpperCase();

  const [currency, setCurrency] = React.useState(fx.currency);
  const [receive, setReceive] = React.useState(savedReceive);
  const [type, setType] = React.useState<RateType>(fx.rateType);
  const [rateText, setRateText] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCurrency(fx.currency);
    setReceive(savedReceive);
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

  // Preview totals in the draft currency, worked out as the conversion will be.
  const customerTotal = React.useMemo(() => {
    if (sameCurrency) return totals.total;
    if (totalsFor) return totalsFor({ currency, rateType: type, exchangeRate: rate }).total;
    return totals.total * crossRate(fx.rate, rate);
  }, [sameCurrency, totals.total, totalsFor, currency, type, rate, fx.rate]);
  const receiveRate = isBaseCurrency(receive) ? 1 : receive === currency ? rate : rateOn(receive, fx.rateDate, "mid").rate ?? 1;
  const receiveTotal = receive === currency ? customerTotal : customerTotal * crossRate(rate, receiveRate);

  const rateChanged = foreign && (type !== fx.rateType || Math.abs(rate - fx.rate) > 1e-9);
  const dirty = currency !== fx.currency || receive !== savedReceive || rateChanged;

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
      { currency, rateType: type, exchangeRate: rate, rateEdited, settlementCurrency: receive },
      rateChanged ? "Exchange rate" : "You receive",
    );
  };

  const reset = () => {
    setCurrency(customerDefault);
    setReceive(BASE_CURRENCY);
    setType("mid");
    setRateText(null);
  };

  const readOnly = !canEdit;
  const dayNote = rateDayNote(fx, quoteDay);

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[560px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
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
                    Currency Configuration
                  </DialogTitle>
                  {readOnly && <LockedChip title={locked ? "Locked once the quote was sent to the customer" : "This quote can't be edited"} />}
                </div>
                <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Applies to quote {quoteNumber} only. The customer's default currency ({customerDefault}) doesn't change.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>
            <Section label="Customer pays">
              <AmountRow
                amount={customerTotal}
                code={currency}
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
                  ? "Defaults to the customer's currency. "
                  : `Changed from ${customerDefault}, the customer's default. `}
                Changing it converts every line at the quote date's rate.
              </p>
            </Section>

            <Section label="You receive">
              <AmountRow
                amount={receiveTotal}
                code={receive}
                picker={
                  <CurrencyPicker
                    value={receive}
                    onPick={setReceive}
                    disabled={readOnly}
                    customerDefault={currency}
                    ariaLabel="You receive currency"
                    className="!mt-0 !h-10"
                  />
                }
              />
              {!isBaseCurrency(receive) && (
                <p className="text-[11px] text-slate-600 tabular-nums">
                  ≈ {formatMoney(toBase(receiveTotal, receiveRate), BASE_CURRENCY)} {BASE_CURRENCY}
                  <span className="text-slate-400"> in the base currency</span>
                </p>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The currency you receive payment in. Defaults to your base currency.
              </p>
            </Section>

            {foreign && (
              <Section label="Exchange rate">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Rate type</span>
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
                <RateCard
                  from={currency}
                  rate={rate}
                  type={type}
                  date={fx.rateDate}
                  dayNote={dayNote}
                  source={
                    type === "mid"
                      ? RATE_PROVIDER
                      : rateEdited
                        ? corpQuote.rate != null ? "Entered on this quote" : `No corporate rate for ${currency}; enter one`
                        : corpQuote.source.replace(/^Set by/, "set by")
                  }
                />
                {!isBaseCurrency(receive) && receive !== currency && (
                  <RateCard from={receive} rate={receiveRate} type="mid" date={fx.rateDate} dayNote={dayNote} source={RATE_PROVIDER} />
                )}
              </Section>
            )}

            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed" style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
              <Lock className="w-3 h-3 mt-[3px] shrink-0" />
              <span>
                {locked
                  ? "The rate locked when you sent the quote, so the total doesn't move with the market. New versions keep it unless you switch to today's rate."
                  : "The rate is set on the quote date and locks once you send the quote, so the total doesn't move with the market. New versions keep it unless you switch to today's rate."}
              </span>
            </div>
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
              Reset to default
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
                  Save configuration
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
            finish({ ...next, settlementCurrency: receive }, "Currency");
          }}
        />
      )}
    </>
  );
}
