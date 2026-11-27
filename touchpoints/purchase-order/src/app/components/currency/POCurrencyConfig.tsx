import * as React from "react";
import { Banknote, Check, ChevronDown, Landmark, Lock, LockOpen, RotateCcw, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FONT } from "../designTokens";
import { computePOPricing } from "../poOrderPricing";
import { isPORateLocked, withPOCurrency, type POCurrencyChoice, type PurchaseOrderData } from "../poStore";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import {
  accountLine,
  getCompanyAccount,
  payFromAccountsFor,
  resolvePayFrom,
  vendorPayFrom,
  type CompanyAccount,
} from "@/app/currency/companyAccounts";
import { formatMoney, formatRate, formatRateDate, rateSentence } from "@/app/currency/money";
import { localTodayIso, payFromCross, poFx, vendorCurrency, type PayFromCross, type PoFx } from "@/app/currency/poFx";
import { RATES_READ_ON, RATE_PROVIDER, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from "@/app/currency/rates";
import { CurrencyPill } from "./CurrencyChip";
import { CurrencyBlock, LockChip, RateTypeChip, blockRateText, withCode, type CurrencyBlockRow } from "./CurrencyBlock";
import { RateTypeInfo } from "./RateTypeInfo";
import { linkProvider } from "./ProviderLink";
import { CurrencyPicker, POCurrencyConfirmDialog, RateTypeToggle, type POCurrencyChange } from "./POCurrencyFields";

export { RateTypeChip } from "./CurrencyBlock";

/** Under an amount paid from an account in a third currency (Mahreen's copy, 25 Nov 2026). */
export const PAY_FROM_ESTIMATE_NOTE = "Estimate at today's rate. Your bank uses its own rate when you pay.";

/* ── The PO's currency: Order Summary block and Currency Configuration ──
 * Ported from the earlier Purchase Orders touchpoint (POSummaryRateBadge,
 * POCurrencyConfigModal) onto the redesign's currency model, then laid out
 * as the Currency Touchpoints Map draws it (Purchase Orders 3–4, 24 Nov):
 *  - "Vendor receives": the PO's currency, the vendor's by default (spec 4.2).
 *    Changing it converts every line at the PO date's rates, after the same
 *    confirmation the redesign shows (POCurrencyConfirmDialog).
 *  - "You pay in": the company bank or cash account the PO is paid from, in
 *    any currency (companyAccounts): the vendor's default unless chosen on
 *    the PO, else 1010 (27 Nov 2026). Paying from a base account, the amount
 *    is the base total at the PO's rate.
 *  - The rate: the PO date's, the daily market rate (read-only) or
 *    corporate (finance's, which can be changed on the PO). Unlocked while
 *    the PO is a Draft or Sent; it locks when the PO is confirmed
 *    (isPORateLocked), and then the configuration is read-only.
 * Every change goes through the page's edit guard and version history. */

const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };

/** What the PO's lock chip says on hover. */
export function poLockTitle(po: Pick<PurchaseOrderData, "confirmationDate">, locked: boolean): string {
  if (!locked) return "Locks when the PO is confirmed";
  return po.confirmationDate
    ? `Locked when the PO was confirmed on ${formatRateDate(po.confirmationDate)}`
    : "Locked when the PO was confirmed";
}

/* ── Order Summary: CURRENCY ───────────────────────────────────────── */

/** Under an estimate in base: today's rate, or the day of the PO's rate when
 *  it was taken on another day (the PO's base equivalent is at the PO's rate). */
const baseEstimateNote = (rateDate: string) =>
  rateDate.slice(0, 10) === localTodayIso() ? "Estimate at today's rate" : `Estimate at the rate of ${formatRateDate(rateDate)}`;

/* Paid from an account in a third currency (Mahreen, 27 Nov 2026, PO-4): what
 * the vendor receives with its currency chip, the account, the estimate in
 * the account's currency, the one rate that changes hands (USD to CAD, today's)
 * with its type under it, then the base equivalent as one estimate line. No
 * rates through the base currency (removed 25 Nov). */
function crossRows(fx: PoFx, total: number, base: number, account: CompanyAccount, cross: PayFromCross): CurrencyBlockRow[] {
  const today = formatRateDate(localTodayIso());
  const crossTip =
    fx.rateType === "mid"
      ? `Today's ${RATE_TYPE_LABEL.mid.toLowerCase()}, ${today} · ${RATE_PROVIDER}. Your bank uses its own rate when you pay.`
      : `From today's corporate rates, ${today}, or the ${RATE_TYPE_LABEL.mid.toLowerCase()} where none is set. Your bank uses its own rate when you pay.`;
  return [
    {
      label: "Vendor receives",
      code: fx.currency,
      value: (
        <>
          <span className="truncate">{formatMoney(total, fx.currency)}</span>
          <CurrencyPill code={fx.currency} />
        </>
      ),
    },
    { label: "You pay in", code: account.currency, value: <span className="truncate">{accountLine(account)}</span> },
    { label: "You pay", code: cross.account, amount: cross.amount, approx: true, noFlag: true },
    {
      label: "Exchange rate",
      code: cross.to,
      value: <span className="whitespace-nowrap">{rateSentence(cross.from, cross.shown, cross.to)}</span>,
      // The rate type of a base-currency PO's cross rate isn't the PO's to show.
      sub: fx.isBase ? (
        PAY_FROM_ESTIMATE_NOTE
      ) : (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="cursor-help inline-flex">
              <RateTypeChip type={fx.rateType} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-[11px]">
            {crossTip}
          </TooltipContent>
        </Tooltip>
      ),
    },
    ...(fx.isBase
      ? []
      : [{ label: "Base equivalent", code: BASE_CURRENCY, amount: base, approx: true, sub: baseEstimateNote(fx.rateDate) }]),
  ];
}

export function POCurrencySummary({ po, total, onViewConfig }: { po: PurchaseOrderData; total: number; onViewConfig: () => void }) {
  const fx = poFx(po);
  const account = resolvePayFrom(fx.currency, po.payFromAccount, po.settlementCurrency, po.vendor.name);
  const locked = isPORateLocked(po);
  const base = toBase(total, fx.rate);
  // Paid from an account in a third currency (25 Nov 2026): the estimate in
  // that currency and the direct rate; the base currency only as the base
  // equivalent.
  const cross = payFromCross(fx, account.currency, total);

  // The PO's own rate (same-currency and base-currency accounts): the PO date's.
  const poRateTip =
    fx.rateType === "mid"
      ? `The ${RATE_TYPE_LABEL.mid.toLowerCase()} on ${formatRateDate(fx.rateDate)}, the PO date · ${RATE_PROVIDER}`
      : po.rateEdited
        ? `A corporate rate entered on this PO (${formatRateDate(fx.rateDate)})`
        : `Finance's corporate rate in effect on ${formatRateDate(fx.rateDate)}, the PO date`;

  // Currency information (25 Nov 2026): what the vendor receives, the
  // currency you pay in (the pay-from account's), the base equivalent and the
  // exchange rate with its type.
  const rows: CurrencyBlockRow[] = cross
    ? crossRows(fx, total, base, account, cross)
    : [
        { label: "Vendor receives", code: fx.currency, amount: total },
        { label: "You pay in", code: account.currency, title: `From ${account.label}` },
        { label: "Base equivalent", code: BASE_CURRENCY, amount: base },
      ];

  return (
    <div className="border-t border-muted pt-3 mt-3">
      <CurrencyBlock
        isBase={fx.isBase && !cross}
        rateType={cross ? undefined : fx.rateType}
        rate={cross ? null : { code: fx.currency, rate: fx.rate }}
        rateTypeTip={poRateTip}
        lock={{ locked, title: poLockTitle(po, locked) }}
        rows={rows}
        footer={
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
        }
      />
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

/** The amount (read-only) beside what it's in: a currency, or an account. */
function AmountRow({ amount, code, approx, picker }: { amount: number; code: string; approx?: boolean; picker: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
        style={{ fontWeight: 500 }}
        aria-readonly="true"
      >
        <span className="truncate">
          {approx ? "≈ " : ""}
          {formatMoney(amount, code)}
        </span>
      </div>
      <div className="w-[248px] shrink-0">{picker}</div>
    </div>
  );
}

const PICKER = "h-10 w-full rounded-md px-2.5 flex items-center gap-1.5 text-[12px]";

/** "🏛 1010 · JPMorgan Operating [PKR] ▾" (Mahreen, 27 Nov 2026, PO-2): one
 *  dropdown of the company's bank and cash accounts, each with its currency
 *  chip, the vendor's default first and tagged "From vendor". The account
 *  sets the currency you pay in; there is no separate currency choice. No
 *  balances (5e, waiting on Nophil). */
function PayFromPicker({
  value,
  currency,
  vendorName,
  onPick,
  disabled,
}: {
  value: string;
  /** The PO's currency (as drafted in the dialog). */
  currency: string;
  /** The PO's vendor, whose default account leads the list. */
  vendorName: string;
  onPick: (accountId: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const accounts = payFromAccountsFor(currency, vendorName);
  const vendorDefault = vendorPayFrom(vendorName).id;
  const current = getCompanyAccount(value) ?? accounts[0];
  const AccountIcon = current.type === "cash" ? Banknote : Landmark;
  const body = (
    <span className="flex items-center gap-1.5 min-w-0">
      <AccountIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="truncate text-slate-700" style={{ fontWeight: 500 }}>{current.label}</span>
      <CurrencyPill code={current.currency} party="Account" />
    </span>
  );
  if (disabled) {
    return (
      <div className={`${PICKER} border border-slate-200 bg-slate-50 cursor-not-allowed`} aria-label="Pay from account">
        {body}
        <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
      </div>
    );
  }
  return (
    // Modal: inside the dialog, the list wouldn't scroll by wheel otherwise.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pay from account"
          className={`${PICKER} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
        >
          {body}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 rounded-lg z-[200]"
        style={{ fontFamily: FONT }}
      >
        <div className="max-h-[280px] overflow-y-auto py-1" role="listbox" aria-label="Pay from account">
          {accounts.map((a) => {
            const selected = a.id === current.id;
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onPick(a.id);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] cursor-pointer transition-colors ${
                  selected ? "bg-primary/[0.06] text-primary" : "hover:bg-slate-50 text-foreground"
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate" style={{ fontWeight: 600 }}>{a.label}</span>
                    <CurrencyPill code={a.currency} party="Account" />
                  </span>
                  <span className="block truncate text-[10.5px] text-slate-400" style={{ fontWeight: 400 }}>
                    {a.type === "cash" ? "Cash on hand" : `${a.bankName} ••${a.accountMask}`}
                  </span>
                </span>
                {a.id === vendorDefault && (
                  <span className="shrink-0 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                    From vendor
                  </span>
                )}
                {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Under the rate (25 Nov 2026): the day a daily market rate was read, or
 *  from when a corporate rate is in effect. A rate is read once a day and
 *  fixed for that date, so no time of day (Eli's ruling, 26 Nov 2026). */
export function rateAsOfLine(type: RateType, date: string, effectiveDate?: string | null, entered?: boolean): string {
  // A day still to come has today's read until its own.
  if (type === "mid") return `Read on ${formatRateDate(date.slice(0, 10) > RATES_READ_ON ? RATES_READ_ON : date)}`;
  if (entered) return `Entered on this PO · effective from ${formatRateDate(date)}`;
  return `Effective from ${formatRateDate(effectiveDate ?? date)}`;
}

function RateCard({
  from,
  rate,
  type,
  asOf,
  source,
}: {
  from: string;
  rate: number;
  type: RateType;
  /** The line under the rate (rateAsOfLine). */
  asOf: string;
  source: string;
}) {
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
          does, once the PO is confirmed. */}
      <div className="mt-1.5 text-[10.5px] text-slate-400 tabular-nums">{asOf}</div>
    </div>
  );
}

export function POCurrencyConfigDialog({
  po,
  open,
  onOpenChange,
  canEdit,
  onChange,
}: {
  po: PurchaseOrderData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onChange: (change: POCurrencyChange) => void;
}) {
  const fx = poFx(po);
  const vendorDefault = vendorCurrency(po.vendor.name);
  const savedAccount = resolvePayFrom(fx.currency, po.payFromAccount, po.settlementCurrency, po.vendor.name).id;
  // The configuration locks once the PO is confirmed; the exchange rate
  // shows no lock of its own anywhere (25 Nov 2026).
  const locked = isPORateLocked(po);

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
  // The rate the draft would use: the PO's own while nothing about it changes.
  const quotedRate = !foreign
    ? 1
    : sameCurrency && type === fx.rateType
      ? fx.rate
      : type === "corporate"
        ? corpQuote.rate ?? midQuote.rate ?? 1
        : midQuote.rate ?? 1;
  const typedRate = rateText != null && Number(rateText) > 0 ? Number(rateText) : null;
  const rate = type === "corporate" && typedRate != null ? typedRate : quotedRate;
  const rateEdited = type === "corporate" && (typedRate != null ? typedRate !== corpQuote.rate : sameCurrency && !!po.rateEdited && type === fx.rateType);

  // Preview totals in the draft currency.
  const previewPo = sameCurrency ? po : withPOCurrency(po, { currency, rateType: type, exchangeRate: rate });
  const vendorTotal = computePOPricing(previewPo).total;
  const baseTotal = foreign ? toBase(vendorTotal, rate) : vendorTotal;
  // The pay-from account (else the vendor's default, else 1010).
  const account = resolvePayFrom(currency, accountId, null, po.vendor.name);
  // An account in neither the base nor the drafted currency: the direct rate
  // and the estimate in the account's currency (25 Nov 2026).
  const cross = payFromCross({ currency, rate, rateType: type, rateDate: fx.rateDate }, account.currency, vendorTotal);

  const dirty =
    currency !== fx.currency || account.id !== savedAccount || (foreign && (type !== fx.rateType || Math.abs(rate - fx.rate) > 1e-9));

  const finish = (next: POCurrencyChoice, subject: string) => {
    onChange({ next, subject });
    onOpenChange(false);
  };

  const readOnly = !canEdit || locked;

  const save = () => {
    if (readOnly || !dirty) {
      onOpenChange(false);
      return;
    }
    if (currency !== fx.currency) {
      setConfirming(true);
      return;
    }
    const rateChanged = foreign && (type !== fx.rateType || Math.abs(rate - fx.rate) > 1e-9);
    finish(
      { currency, rateType: type, exchangeRate: rate, rateEdited, payFromAccount: account.id },
      rateChanged ? "Exchange rate" : "You pay",
    );
  };

  const reset = () => {
    setCurrency(vendorDefault);
    // The vendor's default account (27 Nov 2026), else 1010.
    setAccountId(vendorPayFrom(po.vendor.name).id);
    setType("mid");
    setRateText(null);
  };

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
                    ? "This PO is confirmed, so its currency configuration can't be changed."
                    : readOnly
                      ? "This PO can't be changed now, so its currency configuration is read-only."
                      : "For this PO only. The vendor's currency stays the same."}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>
            <Section label="Vendor receives">
              <AmountRow
                amount={vendorTotal}
                code={currency}
                picker={
                  <CurrencyPicker
                    value={currency}
                    onPick={(c) => {
                      setCurrency(c);
                      setRateText(null);
                    }}
                    disabled={readOnly}
                    vendorDefault={vendorDefault}
                    ariaLabel="Vendor receives currency"
                    className="!mt-0 !h-10"
                  />
                }
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {currency === vendorDefault
                  ? "Defaults to the vendor's currency."
                  : `Changed from ${vendorDefault}, the vendor's currency. Every line converts at the PO date's rate.`}
              </p>
            </Section>

            <Section label="You pay in">
              <PayFromPicker value={account.id} currency={currency} vendorName={po.vendor.name} onPick={setAccountId} disabled={readOnly} />
              {cross && (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
                    ≈ {withCode(cross.amount, cross.account)}
                    <span className="text-slate-500" style={{ fontWeight: 400 }}> from {account.label}</span>
                  </p>
                  <p className="text-[12px] text-slate-500 tabular-nums leading-5">{blockRateText(cross.from, cross.shown, cross.to)}</p>
                  <p className="mt-1 text-[10.5px] text-slate-400">{PAY_FROM_ESTIMATE_NOTE}</p>
                </div>
              )}
            </Section>

            <Section label="Base equivalent">
              <div
                className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
                style={{ fontWeight: 500 }}
                aria-readonly="true"
              >
                <span className="truncate">
                  {foreign ? "≈ " : ""}
                  {formatMoney(baseTotal, BASE_CURRENCY)} {BASE_CURRENCY}
                </span>
              </div>
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
                  <RateTypeInfo currency={currency} date={fx.rateDate} />
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
                  asOf={rateAsOfLine(type, fx.rateDate, corpQuote.effectiveDate, rateEdited)}
                  source={
                    type === "mid"
                      ? RATE_PROVIDER
                      : rateEdited
                        ? "Entered on this PO"
                        : corpQuote.rate != null
                          ? corpQuote.source.replace(/^Set by/, "set by")
                          : `No corporate rate for ${currency}; enter one`
                  }
                />
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
        <POCurrencyConfirmDialog
          po={po}
          to={currency}
          rateType={type}
          onCancel={() => setConfirming(false)}
          onConfirm={(next) => {
            setConfirming(false);
            finish({ ...next, payFromAccount: account.id }, "Currency");
          }}
        />
      )}
    </>
  );
}
