import * as React from 'react';
import { Check, ChevronDown, Lock, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { authorizedQty, type RMA } from '@/app/data/mockRMAs';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, rateSentence } from '@/app/currency/money';
import { RATES_READ_ON, RATE_PROVIDER, RATE_TYPE_LABEL, fxToday, rateOn, todayIso, toBase, type RateType } from '@/app/currency/rates';
import { accountCurrency, receiveInAccountsFor, returnSettlementFx, type ReturnSettlementFx } from '@/app/currency/returnSettlement';
import { CurrencyFlag } from './CurrencyChip';
import { linkProvider } from './ProviderLink';

/* ── A return's currency: the summary block and its configuration ─────
 * Currency Touchpoints Map (2026-11-24), on the PO's pattern
 * (POCurrencySummary, POCurrencyConfigDialog):
 *  - The return's currency is its PO's and can't change.
 *  - Its goods reverse at the receiving rate. What the vendor settles is worth
 *    today's rate, of the PO's type (mid-market or corporate, changeable
 *    here), until the vendor settles; then it is that day's rate. No lock on
 *    the rate (25 Nov 2026): the configuration is read-only once settled.
 *  - "Deposited to" is any bank or cash account, base-currency ones first.
 *  - The gap between the two rates on what is settled is the FX variance:
 *    + to FX Gain, − to FX Loss.
 * This replaces Mahreen's read-only configuration of 2026-11-20, which held
 * the receiving-day rate only and said a different refund rate would "go to
 * FX Gain or FX Loss" without showing it. */

/** A return's value: authorized quantity × unit price, rounded line by line
 *  as the ledger rounds it (the Return Summary's figure). */
export function returnValueOf(rma: RMA): number {
  return Math.round(rma.items.reduce((s, li) => s + Math.round(authorizedQty(li) * li.unitPrice * 100) / 100, 0) * 100) / 100;
}

const RATE_HEX: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };
const RATE_TINT: Record<RateType, string> = { mid: 'rgba(124,58,237,0.08)', corporate: 'rgba(180,83,9,0.10)' };
const GAIN = '#047857';
const LOSS = '#B91C1C';

/** "₨645.20 PKR": an amount with its code, as the block writes it. */
export const withCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

/** "+₨671.30" · "−₨1,212.41" · "₨0.00", a real minus. */
export function signedBase(n: number): string {
  const flat = Math.abs(n) < 0.005;
  return `${flat ? '' : n > 0 ? '+' : '−'}${formatMoney(Math.abs(n), BASE_CURRENCY)}`;
}

export const fxVarianceColor = (n: number) => (Math.abs(n) < 0.005 ? '#64748B' : n > 0 ? GAIN : LOSS);

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

/** "1 EUR = ₨304.8150 PKR · today" or "· Nov 23, 2026" once settled. */
export function settleRateLine(s: ReturnSettlementFx): string {
  return `${rateSentence(s.currency, s.settleRate)} · ${s.locked ? formatRateDate(s.rateDate) : 'today'}`;
}

/** What the FX variance compares, for its tooltip. */
export function fxVarianceTitle(s: ReturnSettlementFx): string {
  return `${formatMoney(s.parts.settles, s.currency)} settled at ${formatRate(s.settleRate)} against the receiving rate, ${formatRate(
    s.receivingRate,
  )}. A gain posts to FX Gain, a loss to FX Loss.`;
}

/* ── Return Summary: CURRENCY INFORMATION ─────────────────────────────
 * Built on Purchase Orders' Currency information card (POCurrencySummary,
 * 25 Nov 2026): what the vendor settles, the currency you receive in (the
 * deposit account's, the account on hover), the base equivalent (always
 * shown, no flag), the FX variance, then the exchange rate with its rate
 * type and, under it, today or the settlement day. */

/** "Pakistani Rupee (PKR)": a currency by name, as the block writes it. */
export const currencyNameWithCode = (code: string) => {
  const upper = code.toUpperCase();
  return `${getCurrency(upper)?.name ?? upper} (${upper})`;
};

function Row({ label, code, title, flag = true, children }: { label: string; code?: string | undefined; title?: string | undefined; flag?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2" title={title}>
      <p className={`text-slate-400 shrink-0 ${title ? 'cursor-help' : ''}`} style={{ fontSize: 10, fontWeight: 500 }}>{label}</p>
      <p className="flex items-center gap-1.5 text-slate-700 tabular-nums text-right min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
        {flag && code && <CurrencyFlag code={code} size={11} />}
        <span className="truncate">{children}</span>
      </p>
    </div>
  );
}

/** The return's currency block: what the vendor settles, the currency it
 *  comes back in, its base equivalent, the FX variance against the receiving
 *  rate, and the exchange rate. Open: today's rate. Settled: the settlement
 *  day's rate. No lock on the rate (25 Nov 2026). */
export function ReturnCurrencyBlock({ rma, onViewConfig }: { rma: RMA; onViewConfig: () => void }) {
  const s = returnSettlementFx(rma);
  const link = (
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
  );
  const accountTitle = s.account
    ? `${s.locked ? 'Deposited to' : 'Deposits to'} ${s.account.label} (${s.accountCurrency})`
    : undefined;
  return (
    <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
          Currency information
        </span>
      </div>

      {!s.foreign ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : rma.status === 'Cancelled' || s.parts.refused ? (
        // Nothing settles on a cancelled return, and nothing came back on a
        // refused one: its value is written off at the receiving rate.
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {rma.status === 'Cancelled'
            ? 'Cancelled, so nothing settles and there is no FX variance.'
            : `The vendor refused the return, so nothing came back. Its value was written off at the receiving rate, ${rateSentence(
                s.currency,
                s.receivingRate,
              )}.`}
        </p>
      ) : (
        <>
          <Row label={s.locked ? 'Vendor settled' : 'Vendor settles'} code={s.currency}>
            {withCode(s.parts.settles, s.currency)}
          </Row>
          <Row label={s.locked ? 'You received in' : 'You receive in'} code={s.accountCurrency} title={accountTitle}>
            {currencyNameWithCode(s.accountCurrency)}
          </Row>
          <Row
            label="Base equivalent"
            code={BASE_CURRENCY}
            flag={false}
            title={s.locked ? 'What came back, in the base currency' : "What comes back today, in the base currency, at today's rate"}
          >
            {withCode(s.settlesNow, BASE_CURRENCY)}
          </Row>
          <div className="flex items-center justify-between gap-2">
            <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>FX variance</p>
            <p
              className="tabular-nums cursor-help"
              style={{ fontSize: 12, fontWeight: 600, color: fxVarianceColor(s.fxVariance) }}
              title={fxVarianceTitle(s)}
            >
              {signedBase(s.fxVariance)}
            </p>
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>Exchange rate</p>
            <div className="flex flex-col items-end min-w-0">
              <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-slate-700 tabular-nums text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                <span className="whitespace-nowrap">{rateSentence(s.currency, s.settleRate)}</span>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help shrink-0">
                      <RateTypeChip type={s.rateType} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                    {s.rateType === 'mid' ? `The daily market rate · ${RATE_PROVIDER}` : `Finance's corporate rate · ${s.rateSource.replace(/^Set by/, 'set by')}`}
                    {s.chosenType === s.poRateType ? `, the PO's rate type (${s.po}).` : `, changed from the PO's ${RATE_TYPE_LABEL[s.poRateType].toLowerCase()}.`}
                  </TooltipContent>
                </Tooltip>
              </p>
              <p className="text-slate-400 text-right" style={{ fontSize: 10 }}>
                {s.locked ? formatRateDate(s.rateDate) : 'today'}
              </p>
            </div>
          </div>
        </>
      )}
      {link}
    </div>
  );
}

/* ── Currency configuration ────────────────────────────────────────── */

function Section({ label, children, aside }: { label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

const FIELD = 'h-10 w-full rounded-lg px-3 flex items-center gap-2 text-[13px]';
const LOCKED_FIELD = `${FIELD} border border-slate-200 bg-slate-50 cursor-not-allowed`;

/** An amount (read-only) beside what it is in. */
function AmountRow({ amount, code, prefix, side }: { amount: number; code: string; prefix?: string; side: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-600 tabular-nums cursor-default select-none"
        style={{ fontWeight: 500 }}
        aria-readonly="true"
      >
        <span className="truncate">
          {prefix}
          {formatMoney(amount, code)}
        </span>
      </div>
      <div className="w-[240px] shrink-0">{side}</div>
    </div>
  );
}

/** Flag, label and currency code: "🇵🇰 1010 · JPMorgan Operating · PKR". */
function AccountLabel({ account }: { account: PayFromAccount }) {
  const code = accountCurrency(account);
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <CurrencyFlag code={code} />
      <span className="truncate text-slate-700" style={{ fontWeight: 500 }}>{account.label}</span>
      <span className="text-slate-400 shrink-0">· {code}</span>
    </span>
  );
}

/** The bank or cash account the money comes back to: any, in any currency,
 *  base-currency ones first, then the return's own, then the rest. */
export function DepositAccountPicker({
  currency,
  value,
  onPick,
  disabled,
}: {
  currency: string;
  value: PayFromAccount | null;
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const accounts = receiveInAccountsFor(currency);
  if (disabled || !value) {
    return (
      <div className={LOCKED_FIELD}>
        {value ? <AccountLabel account={value} /> : <span className="text-slate-400">No account</span>}
        <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Deposited to"
          className={`${FIELD} bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none justify-between cursor-pointer transition-colors`}
        >
          <AccountLabel account={value} />
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0 rounded-lg z-[300]">
        <div className="max-h-[260px] overflow-y-auto py-1" role="listbox">
          {accounts.map((a) => {
            const on = a.id === value.id;
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  setOpen(false);
                  if (!on) onPick(a.id);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] cursor-pointer transition-colors ${
                  on ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'
                }`}
              >
                <AccountLabel account={a} />
                {a.bankName && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{a.bankName}</span>}
                {on && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Daily market rate | Corporate rate, as the Exchange Rates module names them. */
export function RateTypeToggle({ value, onChange, corporateAvailable }: { value: RateType; onChange: (t: RateType) => void; corporateAvailable: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5" role="radiogroup" aria-label="Rate type">
      {(['mid', 'corporate'] as RateType[]).map((t) => {
        const off = t === 'corporate' && !corporateAvailable;
        const on = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={off}
            onClick={() => value !== t && onChange(t)}
            title={off ? "Finance hasn't set a corporate rate for today" : undefined}
            className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
              off
                ? `${on ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground'} opacity-50 cursor-not-allowed`
                : on
                  ? 'bg-[#EDF4FF] text-[#0A77FF] cursor-pointer'
                  : 'text-muted-foreground hover:bg-muted cursor-pointer'
            }`}
            style={{ fontWeight: on ? 500 : 400 }}
          >
            {RATE_TYPE_LABEL[t]}
          </button>
        );
      })}
    </span>
  );
}

/** Under the rate (25 Nov 2026, as POCurrencyConfig's): the day a daily
 *  market rate was read, or from when a corporate rate is in effect. A rate
 *  is read once a day and fixed for that date, so no time of day (Eli's
 *  ruling, 26 Nov 2026). A day still to come has today's read until its own. */
export function rateAsOfLine(type: RateType, date: string, effectiveDate?: string | null, entered?: boolean): string {
  if (type === 'mid') return `Read on ${formatRateDate(date.slice(0, 10) > RATES_READ_ON ? RATES_READ_ON : date)}`;
  if (entered) return `Entered on this return · effective from ${formatRateDate(date)}`;
  return `Effective from ${formatRateDate(effectiveDate ?? date)}`;
}

export interface ReturnCurrencyChange {
  payToAccountId: string;
  settlementRateType: RateType;
}

export function ReturnCurrencyConfigDialog({
  rma,
  open,
  onOpenChange,
  canEdit,
  onApply,
}: {
  rma: RMA;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open and not settled, and the page isn't showing an older version. */
  canEdit: boolean;
  onApply: (change: ReturnCurrencyChange) => void;
}) {
  const saved = returnSettlementFx(rma);
  const [type, setType] = React.useState<RateType>(saved.chosenType);
  const [accountId, setAccountId] = React.useState<string | null>(saved.account?.id ?? null);

  React.useEffect(() => {
    if (!open) return;
    setType(saved.chosenType);
    setAccountId(saved.account?.id ?? null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = returnSettlementFx(rma, { rateType: type, accountId });
  // The configuration is read-only once the vendor settles; the rate itself
  // shows no lock (25 Nov 2026).
  const readOnly = !canEdit || s.locked;
  const code = s.currency;
  const corporateAvailable = !s.foreign || !rateOn(code, todayIso(), 'corporate').fellBack;
  const dirty = type !== saved.chosenType || (s.account?.id ?? null) !== (saved.account?.id ?? null);
  const receipts = s.receiving?.breakdown?.length ?? 0;

  const description = s.locked
    ? "The vendor has settled this return, so its currency configuration can't be changed."
    : readOnly
      ? "This return can't be changed now, so its currency configuration is read-only."
      : "For this return only. Its currency is its PO's.";
  // "Rate updated as of Nov 25, 2026, 7:30 PM" / "Effective from Apr 01, 2026"
  // (25 Nov 2026: not "Rate on settlement date: …").
  const rateDateLine = rateAsOfLine(s.rateType, s.rateDate, rateOn(code, s.rateDate, 'corporate').effectiveDate);

  const apply = () => {
    if (readOnly || !dirty || !s.account) {
      onOpenChange(false);
      return;
    }
    onApply({ payToAccountId: s.account.id, settlementRateType: type });
    onOpenChange(false);
  };

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
          <Section label={s.locked ? 'Vendor settled' : 'Vendor settles'}>
            <AmountRow
              amount={s.parts.settles}
              code={code}
              side={
                <div className={LOCKED_FIELD}>
                  <CurrencyFlag code={code} size={18} />
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>{code}</span>
                  <span className="text-slate-400">· from the PO</span>
                  <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
                </div>
              }
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              From the PO, {s.po}. Goods from a PO in another currency go on a separate return.
            </p>
          </Section>

          <Section label={s.locked ? 'You received in' : 'You receive in'}>
            <DepositAccountPicker currency={code} value={s.account} onPick={setAccountId} disabled={readOnly} />
          </Section>

          <Section label="Base equivalent">
            <div
              className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[15px] text-slate-500 tabular-nums cursor-default select-none"
              style={{ fontWeight: 500 }}
              aria-readonly="true"
            >
              <span className="truncate">
                {s.foreign && !s.locked ? '≈ ' : ''}
                {withCode(s.settlesNow, BASE_CURRENCY)}
              </span>
            </div>
          </Section>

          {s.foreign ? (
            <>
              <Section label="FX variance">
                <div className="flex items-baseline justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <span className="text-[15px] tabular-nums" style={{ fontWeight: 700, color: fxVarianceColor(s.fxVariance) }}>
                    {signedBase(s.fxVariance)}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums text-right">
                    receiving rate {formatRate(s.receivingRate)} → {formatRate(s.settleRate)}
                    {receipts > 1 ? ` · ${receipts} receipts` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {formatMoney(s.parts.settles, code)} settled × (settle rate − receiving rate). A gain posts to FX Gain, a loss to FX Loss.
                  {s.parts.reverses > 0.004 ? ` The ${formatMoney(s.parts.reverses, code)} not invoiced reverses at the receiving rate, with no FX.` : ''}
                </p>
              </Section>

              <Section
                label="Exchange rate"
                aside={readOnly ? <RateTypeChip type={s.rateType} /> : <RateTypeToggle value={type} onChange={setType} corporateAvailable={corporateAvailable} />}
              >
                {/* The rate card (POCurrencyConfig's): type and source, the
                    rate and its inverse, then the date line. No lock on the
                    rate (25 Nov 2026). */}
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX[s.rateType] }} />
                    <span style={{ color: RATE_HEX[s.rateType], fontWeight: 600 }}>{RATE_TYPE_LABEL[s.rateType]}</span>
                    <span className="text-slate-500">· {s.rateType === 'mid' ? linkProvider(RATE_PROVIDER) : s.rateSource.replace(/^Set by/, 'set by')}</span>
                    {s.rateFellBack && <span className="text-amber-700">· no corporate rate is set, so the daily market rate stands</span>}
                  </div>
                  <div className="mt-1.5 text-[12px] text-slate-700 tabular-nums leading-5" style={{ fontWeight: 500 }}>
                    <div>
                      1 {code} = {formatRate(s.settleRate)} {BASE_CURRENCY}
                    </div>
                    <div className="text-slate-500" style={{ fontWeight: 400 }}>
                      1 {BASE_CURRENCY} = {formatRate(1 / s.settleRate)} {code}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10.5px] text-slate-400 tabular-nums">{rateDateLine}</div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Defaults to the PO's rate type ({RATE_TYPE_LABEL[s.poRateType]}). Taken on the day the vendor settles.
                </p>
              </Section>
            </>
          ) : (
            <p className="text-[11.5px] text-slate-500">{BASE_CURRENCY} is the base currency, so there's no conversion.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={apply}
              disabled={!dirty}
              className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: '#0A77FF' }}
            >
              Save
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Creating a return: its currency before it exists ─────────────────
 * Create New RMA, step 5. The return's currency is fixed to its PO's
 * ("Return currency USD · from PO-11233") and can't change here; the step
 * reads in PKR at today's rate, like the PO cart, and this is where the
 * amounts in the PO's currency are. Once created, the goods reverse at their
 * receiving-day rate and what the vendor settles takes the rate on the day
 * they settle (ReturnCurrencyConfigDialog). */
export function CreateReturnCurrencyDialog({
  open,
  onOpenChange,
  currency,
  po,
  value,
  paid,
  charges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  /** "PO-11233": where the currency comes from. */
  po?: string | null | undefined;
  /** What the goods going back are worth, billed or not. */
  value: number;
  paid: number;
  charges: number;
}) {
  const base = isBaseCurrency(currency);
  const today = fxToday(currency);
  const cur = getCurrency(currency);
  const rows: { label: string; amount: number; minus?: boolean }[] = [
    { label: 'Return value', amount: value },
    { label: 'Paid', amount: paid },
  ];
  if (charges > 0.004) rows.push({ label: 'Total charges', amount: charges, minus: true });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
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
                Applies to this return only. A return is always in its PO's currency.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
          <Section label="Return currency">
            <div className={LOCKED_FIELD}>
              <CurrencyFlag code={currency} size={18} />
              <span className="text-slate-700" style={{ fontWeight: 600 }}>{currency}</span>
              <span className="text-slate-500 truncate">{po ? `· from ${po}` : `· ${cur?.name ?? currency}`}</span>
              <Lock className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Fixed to the PO's currency, so it can't change. To return goods from a PO in another currency, start a separate return.
            </p>
          </Section>
          <Section label={`In ${currency}${base ? '' : ` and ${BASE_CURRENCY}`}`}>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px] tabular-nums">
                  <span className="text-slate-600" style={{ fontWeight: 500 }}>{r.label}</span>
                  <span className="text-right">
                    <span className="text-slate-800" style={{ fontWeight: 600 }}>
                      {r.minus ? '−' : ''}
                      {formatMoney(r.amount, currency)}
                    </span>
                    {!base && (
                      <span className="block text-[10.5px] text-slate-400">
                        {r.minus ? '−' : ''}
                        {formatMoney(toBase(r.amount, today.rate), BASE_CURRENCY)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Section>
          {!base && (
            <Section label="Rate">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[12.5px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
                  {rateSentence(currency, today.rate)}
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX.mid }} />
                  <span style={{ color: RATE_HEX.mid, fontWeight: 600 }}>{RATE_TYPE_LABEL.mid}</span>
                  <span>· {linkProvider(RATE_PROVIDER)}</span>
                  <span>· Today, {formatRateDate(today.rateDate)}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Today's rate, for now. Once the return is created its goods reverse at their receiving-day rate, and what the vendor
                settles takes the rate on the day they settle.
              </p>
            </Section>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
