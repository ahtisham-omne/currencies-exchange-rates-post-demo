import * as React from "react";
import { Lock, LockOpen, RotateCcw, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { SO_LOCK_EVENT, soLockTitle, soRateLocked, soReceiveAccount, type SOCurrencyChoice } from "@/app/components/so/soCurrency";
import type { SalesOrder } from "@/app/components/so/types";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from "@/app/currency/money";
import { crossRate, customerCurrency, roundTo, soFx } from "@/app/currency/soFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from "@/app/currency/rates";
import { DEFAULT_ACCOUNT_ID, getCompanyAccount, isEligibleAccount } from "@/app/currency/companyAccounts";
import { CurrencyFlag } from "./CurrencyChip";
import { linkProvider } from "./ProviderLink";
import {
  AccountPicker,
  CurrencyPicker,
  RateTypeToggle,
  SOCurrencyConfirmDialog,
  type SOCurrencyChange,
  type SOCurrencyTotals,
} from "./SOCurrencyFields";

/* ── The order's currency: Order Summary block and Currency Configuration ──
 * Ported from the earlier Sales Orders touchpoint (OrderSummaryCurrencyBlock,
 * OrderCurrencyConfigModal) onto the redesign's currency model, in the shape
 * Purchase Orders uses, and reworked to the Currency Touchpoints Map
 * (24 Nov 2026, "Sales order after conversion"):
 *  - "Customer pays": the amount and the order's currency, the quote's or
 *    the customer's by default (spec 4.3). Changing it converts every line
 *    at the order date's rates, after the same confirmation the redesign
 *    shows (SOCurrencyConfirmDialog). An order made from a quote keeps the
 *    quote's currency: it can't change here.
 *  - "You receive": an account, not a bare currency. The bank or cash
 *    account the customer's payment goes to, in the base currency or the
 *    order's (companyAccounts.ts), with the amount it receives: "≈ ₨…" in
 *    base, the order's amount in the order's currency. "Base equivalent"
 *    shows only when it isn't the base currency.
 *  - The rate: the order date's (or the quote's), mid-market (read-only)
 *    or corporate (finance's, which can be changed on the order), with its
 *    date and an Unlocked / Locked chip: it locks when the order is
 *    confirmed, i.e. leaves Draft. A new version can take today's rate.
 * An order from a quote starts with the quote's configuration (currency,
 * rate, rate type, account); as a Draft its rate and account can still
 * change. (Until 24 Nov it was locked from the start, Mahreen 2026-11-20.) */

const FONT = "Inter, system-ui, sans-serif";

const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };
const RATE_TINT: Record<RateType, string> = { mid: "rgba(124,58,237,0.08)", corporate: "rgba(180,83,9,0.10)" };

/** "₨645.20 PKR": an amount with its code, as the block writes it. */
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

/** Locked (green) or Unlocked (amber): whether the order's rate can still change. */
export function LockChip({ locked, title }: { locked: boolean; title?: string }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
      style={locked ? { color: "#047857", backgroundColor: "#ECFDF5", fontWeight: 600 } : { color: "#92400E", backgroundColor: "#FFFBEB", fontWeight: 600 }}
      title={title}
    >
      <Icon className="w-2.5 h-2.5" />
      {locked ? "Locked" : "Unlocked"}
    </span>
  );
}

/* ── Order Summary: CURRENCY ───────────────────────────────────────── */

export function SOCurrencySummary({ so, total, onViewConfig }: { so: SalesOrder; total: number; onViewConfig: () => void }) {
  const fx = soFx(so);
  const account = soReceiveAccount(so);
  const receiveInBase = isBaseCurrency(account.currency);
  const fromQuote = so.sourceQuoteRef || null;
  const locked = soRateLocked(so);
  const baseTotal = toBase(total, fx.rate);

  /* Customer pays / You receive / Base equivalent (only when receiving into
     an account that isn't in base). A base-currency order has nothing to
     convert: what the customer pays, and the short note. */
  const rows: { label: string; code: string; amount: number; title?: string }[] = [{ label: "Customer pays", code: fx.currency, amount: total }];
  if (!fx.isBase) {
    rows.push({ label: "You receive", code: account.currency, amount: receiveInBase ? baseTotal : total, title: `Into ${account.label}` });
    if (!receiveInBase) rows.push({ label: "Base equivalent", code: BASE_CURRENCY, amount: baseTotal });
  }

  const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: FONT };
  const rateTip = fromQuote
    ? `The ${RATE_TYPE_LABEL[fx.rateType].toLowerCase()} rate from quote ${fromQuote} (${formatRateDate(fx.rateDate)}).`
    : fx.rateType === "mid"
      ? `The mid-market rate on ${formatRateDate(fx.rateDate)}, the order date · ${RATE_PROVIDER}`
      : so.rateEdited
        ? `A corporate rate entered on this order (${formatRateDate(fx.rateDate)})`
        : `Finance's corporate rate in effect on ${formatRateDate(fx.rateDate)}, the order date`;

  return (
    <div className="border-t border-muted pt-3 mt-3 space-y-2" style={{ fontFamily: FONT }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
          Currency
        </span>
        {!fx.isBase && (
          <div className="flex items-center gap-1.5">
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <RateTypeChip type={fx.rateType} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                {rateTip}
              </TooltipContent>
            </Tooltip>
            <LockChip locked={locked} title={soLockTitle(so)} />
          </div>
        )}
      </div>

      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2" title={r.title}>
          <p style={LABEL}>{r.label}</p>
          <p className="flex items-center gap-1.5 text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
            <CurrencyFlag code={r.code} size={11} />
            {withCode(r.amount, r.code)}
          </p>
        </div>
      ))}

      {!fx.isBase ? (
        <div className="border-t border-slate-100 pt-2">
          <div className="flex items-center justify-between gap-2" title={rateTip}>
            <p style={LABEL}>Rate</p>
            <p className="text-slate-500 tabular-nums" style={{ fontSize: 11 }}>
              1 {fx.currency} = {moneyPrefix(BASE_CURRENCY)}{formatRate(fx.rate)} {BASE_CURRENCY}
            </p>
          </div>
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

/** The amount (read-only) beside the currency or account it's in. */
function AmountRow({ text, picker, pickerWidth = 200 }: { text: string; picker: React.ReactNode; pickerWidth?: number }) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
        style={{ fontWeight: 500 }}
        aria-readonly="true"
      >
        <span className="truncate" title={text}>{text}</span>
      </div>
      <div className="shrink-0" style={{ width: pickerWidth }}>{picker}</div>
    </div>
  );
}

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
      {/* "Nov 23, 2026 · order date" */}
      <p className="mt-1 text-[10.5px] text-slate-400 tabular-nums">{day}</p>
    </div>
  );
}

export function SOCurrencyConfigDialog({
  so,
  open,
  onOpenChange,
  canEdit,
  totals,
  totalsFor,
  onChange,
}: {
  so: SalesOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** False once the order is confirmed (has left Draft): the dialog is read-only. */
  canEdit: boolean;
  /** The order's totals in its currency, for the convert confirmation. */
  totals: SOCurrencyTotals;
  /** The totals the order would have in another currency or at another rate. */
  totalsFor?: (next: SOCurrencyChoice) => SOCurrencyTotals;
  onChange: (change: SOCurrencyChange) => void;
}) {
  const fx = soFx(so);
  const customerDefault = customerCurrency(so.customer);
  const savedAccount = soReceiveAccount(so).id;
  /* Made from a quote: the quote's currency, which can't change here. Its
     rate and account can, while the order is a Draft. */
  const fromQuote = so.sourceQuoteRef || null;
  const readOnly = !canEdit;
  const currencyFixed = readOnly || !!fromQuote;

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
  // The rate the draft would use: the order's own while nothing about it changes.
  const quotedRate = !foreign
    ? 1
    : sameCurrency && type === fx.rateType
      ? fx.rate
      : type === "corporate"
        ? corpQuote.rate ?? midQuote.rate ?? 1
        : midQuote.rate ?? 1;
  const typedRate = rateText != null && Number(rateText) > 0 ? Number(rateText) : null;
  const rate = type === "corporate" && typedRate != null ? typedRate : quotedRate;
  const rateEdited = type === "corporate" && (typedRate != null ? typedRate !== corpQuote.rate : sameCurrency && !!so.rateEdited && type === fx.rateType);
  const rateChanged = foreign && (type !== fx.rateType || Math.abs(rate - fx.rate) > 1e-9);

  /* What the customer pays in the draft currency. Fixed pricing-rule
     amounts are written in base and follow the rate, so a new rate can move
     it too (totalsFor works it out the way the order will). */
  const customerTotal =
    sameCurrency && !rateChanged
      ? totals.total
      : totalsFor
        ? totalsFor({ currency, rateType: type, exchangeRate: rate }).total
        : sameCurrency
          ? totals.total
          : roundTo(currency, totals.total * crossRate(fx.rate, rate));
  const account = getCompanyAccount(accountId) ?? getCompanyAccount(DEFAULT_ACCOUNT_ID)!;
  const receiveInBase = isBaseCurrency(account.currency);
  const baseTotal = toBase(customerTotal, rate);
  const receiveText = receiveInBase
    ? `${foreign ? "≈ " : ""}${formatMoney(baseTotal, BASE_CURRENCY)}`
    : formatMoney(customerTotal, account.currency);

  const dirty = currency !== fx.currency || accountId !== savedAccount || rateChanged;

  const finish = (next: SOCurrencyChoice, subject: string) => {
    onChange({ next, subject });
    onOpenChange(false);
  };

  const save = () => {
    if (readOnly || !dirty) {
      onOpenChange(false);
      return;
    }
    if (currency !== fx.currency) {
      setConfirming(true);
      return;
    }
    finish(
      { currency, rateType: type, exchangeRate: rate, rateEdited, payToAccount: accountId },
      rateChanged ? "Exchange rate" : "You receive",
    );
  };

  /* Another currency: an account in the old one can't take it any more. */
  const pickCurrency = (c: string) => {
    setCurrency(c);
    setRateText(null);
    if (!isEligibleAccount(account, c)) setAccountId(DEFAULT_ACCOUNT_ID);
  };

  const reset = () => {
    // An order from a quote keeps the quote's currency.
    setCurrency(fromQuote ? fx.currency : customerDefault);
    setAccountId(DEFAULT_ACCOUNT_ID);
    setType("mid");
    setRateText(null);
  };

  const lockTitle = soLockTitle(so);
  /* The day the rate is for: the order date, or for an order from a quote
     the quote's rate date (its rate as it came over, or another type's on
     that day). */
  const rateDay = `${formatRateDate(fx.rateDate)} · ${fromQuote ? (rateChanged ? "quote date" : `from quote ${fromQuote}`) : "order date"}`;

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[580px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
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
                  <span className="text-[12px] text-slate-400 tabular-nums" style={{ fontWeight: 500 }}>{so.soNumber}</span>
                  {readOnly && <LockChip locked title={lockTitle} />}
                </div>
                <DialogDescription className="text-slate-500" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Applies to order {so.soNumber} only. The customer's default currency ({customerDefault}) doesn't change.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>
            <Section label="Customer pays">
              <AmountRow
                text={formatMoney(customerTotal, currency)}
                picker={
                  <CurrencyPicker
                    value={currency}
                    onPick={pickCurrency}
                    disabled={currencyFixed}
                    customerDefault={customerDefault}
                    ariaLabel="Customer pays currency"
                    className="!mt-0 !h-10"
                  />
                }
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {fromQuote ? (
                  `From quote ${fromQuote}. The currency carries over from the quote and doesn't change.`
                ) : (
                  <>
                    {currency !== customerDefault ? `Changed from ${customerDefault}, the customer's default. ` : "Defaults to the customer's currency. "}
                    Changing it converts every line at the order date's rate.
                  </>
                )}
              </p>
            </Section>

            <Section label="You receive">
              <AmountRow
                text={receiveText}
                pickerWidth={270}
                picker={
                  <AccountPicker
                    value={accountId}
                    docCurrency={currency}
                    onPick={setAccountId}
                    disabled={readOnly}
                    ariaLabel="You receive into"
                    className="!mt-0 !h-10"
                  />
                }
              />
              {!receiveInBase && (
                <p className="text-[11px] text-slate-600 tabular-nums">
                  Base equivalent ≈ {formatMoney(baseTotal, BASE_CURRENCY)} {BASE_CURRENCY}
                </p>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {foreign
                  ? `The bank or cash account the customer pays into, in ${BASE_CURRENCY} (the base currency) or ${currency}. Defaults to ${BASE_CURRENCY}.`
                  : `The bank or cash account the customer pays into, in ${BASE_CURRENCY}, the base currency.`}
              </p>
            </Section>

            {foreign && (
              <Section label="Rate">
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
                {/* The rate, its day, and whether it can still change
                    (spec: "1 USD = 278.5200 PKR · Nov 23, 2026 · order
                    date · [Unlocked] locks when the order is confirmed"). */}
                <RateCard
                  from={currency}
                  rate={rate}
                  type={type}
                  day={rateDay}
                  source={
                    type === "mid"
                      ? RATE_PROVIDER
                      : rateEdited
                        ? "Entered on this order"
                        : corpQuote.rate != null
                          ? corpQuote.source.replace(/^Set by/, "set by")
                          : `No corporate rate for ${currency}; enter one`
                  }
                />
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500" title={lockTitle}>
                  <LockChip locked={readOnly} title={lockTitle} />
                  <span>{readOnly ? `since the order was confirmed (${so.status})` : SO_LOCK_EVENT}</span>
                </div>
              </Section>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
            <button
              type="button"
              onClick={reset}
              disabled={readOnly}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ fontWeight: 500 }}
              title={fromQuote ? `The quote's currency, ${BASE_CURRENCY} account 1010 and the mid-market rate` : `The customer's currency, ${BASE_CURRENCY} account 1010 and the mid-market rate`}
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
        <SOCurrencyConfirmDialog
          so={so}
          totals={totals}
          totalsFor={totalsFor}
          to={currency}
          rateType={type}
          onCancel={() => setConfirming(false)}
          onConfirm={(next) => {
            setConfirming(false);
            finish({ ...next, payToAccount: accountId }, "Currency");
          }}
        />
      )}
    </>
  );
}
