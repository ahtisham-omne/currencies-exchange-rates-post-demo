/**
 * The refund the vendor paid back, on a refund return. Its one option is
 * Record payment.
 *
 * Refund returns only. A credit return closes once everything has shipped,
 * and its credit is confirmed by accounting in partner credits (DQ-01), so
 * nothing about it is logged here. A refund return stays open the way an
 * invoice stays open, and somebody has to say the money arrived: that is
 * this, and it is the step that closes the return. Cash lands in the
 * account the return nominated, and the receivable clears.
 *
 * Ported from the invoice's own `AddCreditMemoModal` -- the same header
 * chrome, the same context card, the Max click-to-fill, the notify picker and
 * the derived GL preview.
 *
 * The amount is deliberately not capped at what was expected. A short refund
 * is either a part payment or a loss, and an over-payment is a conversation
 * with the vendor rather than something to refuse in a dialog.
 */

import { formatMoney as moneyIn, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { RATE_TYPE_LABEL, rateOn, toBase, type MoneyFx, type RateType } from '@/app/currency/rates';
import { depositAccountsFor } from '@/app/currency/returnSettlement';
import { localISODate } from '@/app/data/mockRMAs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, ChevronRight, FileText, Plus, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Checkbox } from '@/app/components/ui/checkbox';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { GL_ACCOUNTS } from '@/app/data/rmaGLEntries';
import { PAY_FROM_ACCOUNTS, PAY_TO_ACCOUNTS } from '@/app/data/mockPayments';
import {
  AdditionalChargesPanel,
  VENDOR_CHARGE_TYPES,
  type AdditionalCharge,
} from '@/app/components/vendors/AdditionalChargesPanel';

/** Only a payment: a refund is the one thing logged here. */
export type SettlementKind = 'payment';

export interface LogSettlementPayload {
  kind: SettlementKind;
  amount: number;
  date: string;
  /** Check number, ACH trace or wire confirmation. */
  reference: string;
  method?: string;
  /** Into a PKR account: what it came to in PKR, at `rate`. */
  bankReceived?: number;
  /** PKR per one unit the vendor settled at: the configured type's rate on
   *  the day the money landed (2026-11-24; it was worked out from what the
   *  bank credited). */
  rate?: number;
  /** Which rate that was: the PO's type unless changed in the currency
   *  configuration. */
  rateType?: RateType;
  /** The bank or cash account the refund landed in. Required when money came. */
  depositedToAccountId?: string;
  description?: string;
  fileName?: string;
  notify: boolean;
  notifiedRecipientIds: string[];
  /** Short settlements only: the user confirmed the gap is a loss. */
  lossAcknowledged?: boolean;
  /** Short settlements only: the gap written off to RMA Settlement Loss. */
  settlementLoss?: number;
  /** Short and not written off: a part payment. The return stays open for
   *  the rest. */
  keepOpen?: boolean;
  /** Charges the vendor kept back that nobody entered before (ERP-8664).
   *  Added to the return's Vendor charges, so they lower what is expected. */
  addedCharges?: AdditionalCharge[];
}

/** How the money came. The same three the approval dialog promised, minus
 *  "don't know yet": by the time it has landed, it is known. */
const METHODS = ['Wire', 'ACH', 'Check', 'Other'];

const THEME = {
  bg: '#EBF3FF',
  solid: 'hsl(var(--primary))',
  pillText: '#1D4ED8',
};

function todayIso() {
  return localISODate(new Date());
}

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

/** The bank the return nominated, said as a journal line. Mirrors
 *  `payFromAccount` in the return ledger so the preview and the GL tab name
 *  the same account. */
function bankAccount(payToAccountId: string | undefined) {
  const picked = PAY_FROM_ACCOUNTS.find((a) => a.id === payToAccountId);
  if (!picked) return GL_ACCOUNTS.payFrom;
  const [code, ...rest] = picked.creditGl.split(' ');
  if (!code || rest.length === 0) return { code: GL_ACCOUNTS.payFrom.code, name: picked.label };
  return { code, name: rest.join(' ') };
}

export function LogSettlementModal({
  open,
  onOpenChange,
  rmaNumber,
  vendorName,
  /** What is still to come back: what the vendor agreed to, after rate and
   *  restocking fee, less any part payments already logged. */
  expected,
  /** Part payments already logged against this return. */
  receivedSoFar = 0,
  currency,
  payToAccountId,
  existingCharges = [],
  fx,
  rateType = 'mid',
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rmaNumber: string;
  vendorName: string;
  expected: number;
  receivedSoFar?: number;
  currency: string;
  /** The currency configuration's "Deposited to": where it starts. */
  payToAccountId?: string | undefined;
  /** The charges already on the return. Carried forward and already taken
   *  off `expected`, so they are shown, not asked again. */
  existingCharges?: AdditionalCharge[];
  /** The return's receiving-day rate: a shortfall and the vendor's charges
   *  reverse at it, and the FX variance is taken against it. */
  fx?: MoneyFx | null | undefined;
  /** The rate type the vendor settles at, from the currency configuration
   *  (the PO's unless changed). The settlement is recorded at that type's
   *  rate on the day the money landed (Currency Touchpoints Map, 2026-11-24). */
  rateType?: RateType | undefined;
  onSubmit: (payload: LogSettlementPayload) => void;
}) {
  const foreign = !isBaseCurrency(currency);
  const receivingRate = foreign ? fx?.rate ?? 1 : 1;
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(todayIso);
  const [method, setMethod] = useState(METHODS[0] as string);
  const [depositTo, setDepositTo] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  // Off by default, unlike the invoice's own memo modal. There the checkbox
  // is on screen, so a default of on is a suggestion the user can see and
  // decline. Here it sits behind a collapsed row, and opting people into a
  // notification they were never shown the control for is a different thing.
  const [notify, setNotify] = useState(false);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** A short settlement is a part payment unless the user ticks this, in
   *  which case the gap is written off and the return closes. A loss has to
   *  be meant rather than the side effect of a typo, so it is never the
   *  default. */
  const [lossAck, setLossAck] = useState(false);
  /** A charge accounting finds on the remittance that nobody entered at
   *  creation or approval: the third place it can be added (ERP-8664). */
  const [chargesOpen, setChargesOpen] = useState(false);
  const [newCharges, setNewCharges] = useState<AdditionalCharge[]>([]);
  /** Whether the scrolling middle has content hidden behind the header or the
   *  footer. A fixed edge with a hairline border cut cards in half and said
   *  nothing about it, which reads as a broken layout rather than a list that
   *  carries on. */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [clipped, setClipped] = useState({ top: false, bottom: false });

  const readEdges = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const scrolls = el.scrollHeight - el.clientHeight > 1;
    setClipped({
      top: scrolls && el.scrollTop > 1,
      bottom: scrolls && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setAmountInput('');
    setDate(todayIso());
    setMethod(METHODS[0] as string);
    // The currency configuration's "Deposited to", where it can take this
    // return's currency; else the first account in PKR (1010), as the
    // configuration defaults.
    {
      const eligible = depositAccountsFor(currency);
      setDepositTo(
        eligible.find((a) => a.id === payToAccountId)?.id ??
          eligible.find((a) => isBaseCurrency(a.currency ?? BASE_CURRENCY))?.id ??
          '',
      );
    }
    setReference('');
    setDescription('');
    setFile(null);
    setTouched(false);
    setNotify(false);
    setRecipients(new Set());
    setDetailsOpen(false);
    setLossAck(false);
    setChargesOpen(false);
    setNewCharges([]);
  }, [open]);

  useEffect(() => {
    const id = requestAnimationFrame(readEdges);
    return () => cancelAnimationFrame(id);
  }, [open, detailsOpen, notify, recipients.size, file, amountInput, description, readEdges]);

  const addedCharges = newCharges.filter((c) => c.amount > 0.004);
  const addedTotal = Math.round(addedCharges.reduce((n, c) => n + c.amount, 0) * 100) / 100;
  /** What is still to come once the charges added here are kept back too. */
  const expectedNet = Math.max(0, Math.round((expected - addedTotal) * 100) / 100);

  const amount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const amountError = (() => {
    if (!touched && amountInput === '') return null;
    if (!Number.isFinite(amount) || amount < 0) return 'Amount cannot be negative.';
    // Nothing came back is a real answer, but only as a loss. A zero part
    // payment would record an event where nothing happened.
    if (touched && amount <= 0 && !lossAck)
      return 'Enter what they sent, or record the full balance as a loss.';
    return null;
  })();
  /** The vendor sent nothing and is not going to. */
  const nothingBack = amount <= 0;

  // A payment reference is a nicety: a wire that landed is still a wire that
  // landed when nobody has the confirmation to hand.
  const referenceError: string | null = null;

  // Short of what was agreed, or over it. The ledger books what the return is
  // worth either way; the gap is the only part that needs saying.
  const shortfall = Math.round((expectedNet - amount) * 100) / 100;
  const outstanding = Math.max(0, shortfall);
  const isShort = amount >= 0 && shortfall > 0.004;

  // The tick confirms one figure. Change the amount and it confirms nothing,
  // so it clears and has to be given again.
  useEffect(() => {
    setLossAck(false);
  }, [outstanding]);

  // Required whenever money came in. A loss with nothing sent back lands
  // nowhere, so it has no account to name.
  const depositError =
    touched && amount > 0 && !depositTo ? 'Choose the account the refund was deposited to.' : null;

  // Where it can land: an account in the return's currency or in PKR, like
  // Pay from on a payment.
  const depositAccounts = depositAccountsFor(currency);
  const depositCurrency = (PAY_TO_ACCOUNTS.find((a) => a.id === depositTo)?.currency ?? BASE_CURRENCY).toUpperCase();
  const converts = foreign && amount > 0 && !!depositTo && isBaseCurrency(depositCurrency);
  // The rate the vendor settles at: the configured type's (the PO's, unless
  // changed in the currency configuration) on the day the money landed
  // (Currency Touchpoints Map, 2026-11-24). It replaces the rate worked out
  // from what the bank said it received in PKR (Mahreen, 2026-11-20).
  const quote = rateOn(currency, date, rateType);
  const settleRate = foreign ? quote.rate : 1;
  /** In PKR at the settlement rate: what comes back. */
  const pk = (n: number) => moneyIn(toBase(n, settleRate), BASE_CURRENCY);
  const bankReceived = converts ? toBase(amount, settleRate) : null;

  const canSubmit =
    !amountError &&
    (amount <= 0 || !!depositTo) &&
    !referenceError &&
    (amount > 0 || (isShort && lossAck));
  const writesOffLoss = isShort && lossAck;

  const debitAccount = bankAccount(depositTo || undefined);

  // The posting, in PKR (2026-11-24). The cash lands at the settlement rate;
  // the receivable it clears, a shortfall written off and a charge kept back
  // are at the receiving rate the goods were booked at, and the gap on the
  // cash is the FX variance.
  const cashAtSettle = toBase(amount, settleRate);
  const cashAtReceiving = toBase(amount, receivingRate);
  const lossAtReceiving = writesOffLoss ? toBase(outstanding, receivingRate) : 0;
  const chargesAtReceiving = toBase(addedTotal, receivingRate);
  const fxOnCash = foreign && amount > 0 ? Math.round((cashAtSettle - cashAtReceiving) * 100) / 100 : 0;

  /** What is filled in behind the collapsed row, so closing it never hides
   *  something the user typed without saying so. */
  const addedCount =
    (description.trim() ? 1 : 0) + (file ? 1 : 0) + (notify && recipients.size > 0 ? 1 : 0);

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({
      kind: 'payment',
      amount,
      date,
      reference: reference.trim(),
      method,
      ...(amount > 0 && depositTo ? { depositedToAccountId: depositTo } : {}),
      ...(bankReceived != null ? { bankReceived } : {}),
      ...(amount > 0 && foreign ? { rate: settleRate, rateType: quote.type } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(file ? { fileName: file.name } : {}),
      notify,
      notifiedRecipientIds: notify ? Array.from(recipients) : [],
      ...(writesOffLoss ? { lossAcknowledged: true, settlementLoss: outstanding } : {}),
      ...(isShort && !lossAck ? { keepOpen: true } : {}),
      ...(addedCharges.length ? { addedCharges } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[92vh]"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Header -- the invoice modal's chrome: tinted icon chip, title and
            subtitle, close X, no gradient hero. */}
        <div
          className="relative z-10 shrink-0 px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3"
          style={{
            boxShadow: clipped.top ? '0 8px 14px -10px rgba(15,23,42,0.35)' : 'none',
            transition: 'box-shadow 120ms ease',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: THEME.bg }}
            >
              <Banknote className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className="text-[15px] sm:text-[16px] text-foreground"
                style={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                Log settlement
              </DialogTitle>
              <DialogDescription
                className="text-[11px] sm:text-xs mt-0.5 text-slate-500"
                style={{ lineHeight: 1.5 }}
              >
                Record the refund {vendorName} paid back.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={bodyRef}
          onScroll={readEdges}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pt-3.5 pb-4 space-y-3 text-left"
        >
          {/* What is owed, and on what. */}
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: THEME.bg }}
              >
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] uppercase tracking-wider text-slate-400"
                  style={{ fontWeight: 600 }}
                >
                  Return
                </p>
                <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>
                    {rmaNumber}
                  </span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  {vendorName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className="text-[10px] uppercase tracking-wider text-slate-400"
                  style={{ fontWeight: 600 }}
                >
                  {receivedSoFar > 0.004 ? 'Remaining' : 'Expected'}
                </p>
                <p className="text-[13px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700 }}>
                  {pk(expectedNet)}
                </p>
                {addedTotal > 0.004 && (
                  <p className="text-[10px] text-rose-600 tabular-nums mt-0.5">
                    {pk(addedTotal)} new charges
                  </p>
                )}
                {receivedSoFar > 0.004 && (
                  <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                    {pk(receivedSoFar)} received
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Amount and date. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="rma-settle-amount"
                  className="text-[11px] text-slate-500 flex items-center gap-1"
                  style={{ fontWeight: 500 }}
                >
                  Amount
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 tabular-nums">
                  {moneyPrefix(currency).trim()}
                </span>
                <Input
                  id="rma-settle-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setTouched(true);
                  }}
                  className={`h-9 text-[12px] tabular-nums pl-7 bg-white ${
                    amountError ? 'border-red-300 focus-visible:ring-red-200' : ''
                  }`}
                  placeholder="0.00"
                />
              </div>
              {amountError && <p className="text-[10px] text-red-600 mt-1">{amountError}</p>}
              {!amountError && foreign && amount > 0 && (
                <p className="text-[10px] text-slate-500 tabular-nums mt-1">
                  {pk(amount)} at {date === todayIso() ? "today's" : `the ${formatRateDate(date)}`}{' '}
                  {RATE_TYPE_LABEL[quote.type].toLowerCase()} rate, {rateSentence(currency, settleRate)}
                  {quote.fellBack ? ' (no corporate rate is set)' : ''}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rma-settle-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Date received
              </Label>
              <DatePicker id="rma-settle-date" value={date} onChange={setDate} className="!h-9" />
            </div>
          </div>

          {/* How it came. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="rma-settle-ref"
                className="text-[11px] text-slate-500 flex items-center gap-1"
                style={{ fontWeight: 500 }}
              >
                Reference
                <span className="text-slate-400" style={{ fontWeight: 400 }}>
                  (optional)
                </span>
              </Label>
              <Input
                id="rma-settle-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={`h-9 text-[12px] tabular-nums bg-white placeholder:text-slate-400 ${
                  referenceError ? 'border-red-300 focus-visible:ring-red-200' : ''
                }`}
                placeholder="Check no., ACH trace or wire confirmation"
              />
              {referenceError && <p className="text-[10px] text-red-600 mt-1">{referenceError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                How it came
              </Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9 text-[12px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[400]">
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="text-[12px]">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>

          {/* Where the money landed (ERP-8664 AC2.3). Required: the cash line
              of the posting below is this account. Starts on the refund
              account the return nominated, which is where it usually lands. */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rma-settle-deposit"
              className="text-[11px] text-slate-500 flex items-center gap-1"
              style={{ fontWeight: 500 }}
            >
              Deposited to
              <span style={{ color: '#DC2626' }}>*</span>
            </Label>
            <Select value={depositTo} onValueChange={setDepositTo}>
              <SelectTrigger
                id="rma-settle-deposit"
                className={`h-9 text-[12px] bg-white ${
                  depositError ? 'border-red-300 focus-visible:ring-red-200' : ''
                }`}
              >
                <SelectValue placeholder="Choose the account it landed in" />
              </SelectTrigger>
              <SelectContent className="z-[400]">
                {depositAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-[12px]">
                    {a.label}
                    <span className="text-slate-400"> · {(a.currency ?? BASE_CURRENCY).toUpperCase()}</span>
                    {a.bankName ? (
                      <span className="text-slate-400">
                        {' '}· {a.bankName}{a.accountMask ? ` ••••${a.accountMask}` : ''}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {depositError && <p className="text-[10px] text-red-600 mt-1">{depositError}</p>}
            {foreign && !depositError && (
              <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                Only a {currency} account or a {BASE_CURRENCY} account can take this refund.
                {amount > 0 && depositTo
                  ? converts
                    ? ` ${pk(amount)} lands in ${BASE_CURRENCY}, at the settlement rate.`
                    : ` ${moneyIn(amount, currency)} lands in ${currency}, worth ${pk(amount)} at the settlement rate.`
                  : ''}
              </p>
            )}
          </div>

          {/* No "Bank received (PKR)" any more (2026-11-24): the settlement is
              recorded at the configured rate, today's of the PO's type
              (mid-market or corporate, set in the currency configuration),
              not at a rate worked out from what the bank credited. */}

          {/* Vendor charges: what is already on the return, carried forward,
              and a way to add one the vendor kept back that nobody entered
              before. Same panel as the detail page's Vendor charges card. */}
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                Vendor charges
              </span>
              {!chargesOpen && (
                <button
                  type="button"
                  onClick={() => setChargesOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3 h-3" />
                  Add a charge
                </button>
              )}
            </div>
            {existingCharges.length > 0 && (
              <div className="px-3.5 pb-2.5 space-y-1">
                {existingCharges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600 truncate">{c.type}</span>
                    <span className="text-slate-500 tabular-nums shrink-0">
                      −{formatMoney(c.amount, currency)}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400">Already on the return and taken off the expected amount.</p>
              </div>
            )}
            {existingCharges.length === 0 && !chargesOpen && (
              <p className="px-3.5 pb-2.5 text-[10px] text-slate-400">None on the return.</p>
            )}
            {chargesOpen && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100">
                <AdditionalChargesPanel
                  currency={currency}
                  charges={newCharges}
                  onChange={setNewCharges}
                  types={VENDOR_CHARGE_TYPES}
                  totalLabel="New charges"
                  formatTotal={pk}
                  addLabel="Add charge"
                  emptyNote="Add what the vendor kept back that is not on the return yet."
                  glNote="Taken off what is expected, posted to 6830 RMA Vendor Charges, and added to the return's Vendor charges."
                />
              </div>
            )}
          </div>

          {/* The optional three, behind one line. A clerk logging a wire
              fills none of them, and stacked open they pushed the amount and
              the posting it makes below the fold. */}
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${
                    detailsOpen ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                  Description, notifications and attachment
                </span>
              </span>
              {!detailsOpen && addedCount > 0 && (
                <span
                  className="shrink-0 inline-flex items-center rounded-full px-1.5 py-px text-[10px] border"
                  style={{
                    fontWeight: 600,
                    backgroundColor: THEME.bg,
                    color: THEME.pillText,
                    borderColor: '#BFDBFE',
                  }}
                >
                  {addedCount} added
                </span>
              )}
            </button>
            {detailsOpen && (
              <div className="px-3.5 pb-3.5 pt-0.5 space-y-3.5 border-t border-slate-100">
            <div className="space-y-1.5">
              <Label htmlFor="rma-settle-desc" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Description{' '}
                <span className="text-slate-400" style={{ fontWeight: 400 }}>
                  (optional)
                </span>
              </Label>
              <Textarea
                id="rma-settle-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-[12px] resize-none bg-white"
              />
            </div>

            {/* Same reply-all picker the invoice's money actions use. */}
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer">
                <Checkbox
                  checked={notify}
                  onCheckedChange={(v) => setNotify(v === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                    Notify recipients
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Tell the people you choose that this return settled. Optional.
                  </span>
                </span>
              </label>
              {notify && (
                <SearchableUserPicker
                  selectedIds={recipients}
                  onSelectionChange={setRecipients}
                  accentColor={THEME.solid}
                  accentBg={THEME.bg}
                  accentBorder="#BFDBFE"
                  accentText={THEME.pillText}
                  label="Notify on settlement"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Remittance advice{' '}
                <span className="text-slate-400" style={{ fontWeight: 400 }}>
                  (optional)
                </span>
              </Label>
              {file ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-white transition-colors shrink-0"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="rma-settle-file"
                  className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-500" />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                    <span className="text-primary" style={{ fontWeight: 600 }}>
                      Click to upload
                    </span>{' '}
                    or drag and drop
                  </span>
                  <span className="text-[10px] text-slate-400">PDF or image up to 10MB</span>
                  <input
                    id="rma-settle-file"
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
              </div>
            )}
          </div>

          {/* What this leaves behind, and the entry it posts. Derived, never
              picked, the way the invoice's own memo derives its postings. */}
          <div
            className="rounded-xl px-3.5 py-3.5"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            {/* Label and figure on one line. Stacked, the least interesting
                number on the panel was also the biggest thing on it. */}
            <div className="flex items-baseline justify-between gap-3">
              <p
                className="text-[10px] uppercase tracking-wider text-slate-500"
                style={{ fontWeight: 600 }}
              >
                Still outstanding
              </p>
              <p className="text-[15px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 700 }}>
                {/* Written off is not outstanding: nothing more is coming. */}
                {pk(writesOffLoss ? 0 : outstanding)}
                {amount > 0 && (
                  <span className="text-[10px] text-slate-500 ml-1.5" style={{ fontWeight: 500 }}>
                    of {pk(expectedNet)}
                  </span>
                )}
              </p>
            </div>
            {amount > 0 && !amountError && shortfall < -0.004 && (
              <p
                className="text-[10px] leading-relaxed mt-2.5 rounded-lg px-2.5 py-1.5"
                style={{
                  color: '#047857',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  fontWeight: 500,
                }}
              >
                {`${formatMoney(Math.abs(shortfall), currency)} over what was agreed. The ledger books what the return is worth, so the excess is yours to take up with them.`}
              </p>
            )}
            {/* Short. Either the rest is still coming, and this is a part
                payment that leaves the return open, or it is not, and the
                gap is written off. Unticked is the safe reading. */}
            {isShort && (
              <label
                className="mt-2.5 flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  backgroundColor: '#FFFBEB',
                  border: `1px solid ${lossAck ? '#F59E0B' : '#FDE68A'}`,
                }}
              >
                <Checkbox
                  checked={lossAck}
                  onCheckedChange={(v) => setLossAck(v === true)}
                  className="mt-0.5 bg-white"
                  aria-describedby="rma-settle-loss-detail"
                />
                <span className="min-w-0">
                  <span className="block text-[12px]" style={{ fontWeight: 600, color: '#92400E' }}>
                    Record {nothingBack ? 'the full' : 'the remaining'} {moneyIn(outstanding, currency)} as a loss
                  </span>
                  <span
                    id="rma-settle-loss-detail"
                    className="block text-[11px] mt-0.5 leading-snug"
                    style={{ color: '#B45309' }}
                  >
                    {nothingBack
                      ? lossAck
                        ? `Nothing came back. The full amount posts to ${GL_ACCOUNTS.settlementLoss.code} ${GL_ACCOUNTS.settlementLoss.name} and the return closes as Closed with loss.`
                        : 'Tick this if the vendor is sending nothing. You can leave the amount empty.'
                      : lossAck
                      ? `The gap posts to ${GL_ACCOUNTS.settlementLoss.code} ${GL_ACCOUNTS.settlementLoss.name} and the return closes as Closed with loss.`
                      : `Leave this off to log a partial payment. The return stays open with ${formatMoney(outstanding, currency)} still to come.`}
                  </span>
                </span>
              </label>
            )}
            {(amount > 0 || writesOffLoss) && !amountError && (
              <div className="mt-3 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid #E2E8F0' }}>
                <p
                  className="text-[10px] uppercase tracking-wider text-slate-400"
                  style={{ fontWeight: 600 }}
                >
                  GL impact
                </p>
                {/* In PKR (2026-11-24): the cash at the settlement rate, the rest
                    at the receiving rate, and the gap on the cash as the FX
                    variance, to FX Gain or FX Loss. */}
                {[
                  ...(amount > 0 ? [{ key: 'dr', side: 'Debit', ...debitAccount, value: cashAtSettle }] : []),
                  ...(writesOffLoss
                    ? [{ key: 'loss', side: 'Debit', ...GL_ACCOUNTS.settlementLoss, value: lossAtReceiving }]
                    : []),
                  ...(addedTotal > 0.004
                    ? [{ key: 'charges', side: 'Debit', ...GL_ACCOUNTS.vendorCharges, value: chargesAtReceiving }]
                    : []),
                  ...(fxOnCash < -0.004 ? [{ key: 'fx-loss', side: 'Debit', ...GL_ACCOUNTS.fxLoss, value: -fxOnCash }] : []),
                  {
                    key: 'cr',
                    side: 'Credit',
                    ...GL_ACCOUNTS.vendorCredits,
                    value: Math.round((cashAtReceiving + lossAtReceiving + chargesAtReceiving) * 100) / 100,
                  },
                  ...(fxOnCash > 0.004 ? [{ key: 'fx-gain', side: 'Credit', ...GL_ACCOUNTS.fxGain, value: fxOnCash }] : []),
                ].map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-flex items-center w-[46px] justify-center px-1 py-px rounded text-[10px] uppercase tracking-wide bg-white border border-slate-200 text-slate-600"
                        style={{ fontWeight: 700 }}
                      >
                        {row.side}
                      </span>
                      <span
                        className="font-mono text-[10px] text-slate-600 tabular-nums"
                        style={{ fontWeight: 600 }}
                      >
                        {row.code}
                      </span>
                      <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>
                        {row.name}
                      </span>
                    </span>
                    <span
                      className="text-[11px] text-foreground tabular-nums shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      {moneyIn(row.value, BASE_CURRENCY)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="relative z-10 shrink-0 flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3.5 bg-white"
          style={{
            borderTop: `1px solid ${clipped.bottom ? '#E2E8F0' : '#F1F5F9'}`,
            boxShadow: clipped.bottom ? '0 -8px 14px -10px rgba(15,23,42,0.35)' : 'none',
            transition: 'box-shadow 120ms ease, border-color 120ms ease',
          }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            {writesOffLoss && nothingBack ? 'Record loss' : 'Record payment'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
