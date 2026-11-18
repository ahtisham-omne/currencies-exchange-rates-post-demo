/**
 * What the vendor said about paying, asked at the moment they agree.
 *
 * Approving a return used to be a status move with a toast. But a vendor who
 * agrees to take goods back has just told somebody two other things on the
 * same call -- roughly when the money comes back, and roughly how -- and that
 * call is the only cheap moment to write them down. Asked a week later it is
 * a second phone call; never asked, the buyer has an open return and no date
 * to chase it against.
 *
 * Three questions, because a vendor's answer has three parts and collapsing
 * them loses the one that matters. "Thirty days" is not a date until you know
 * what it counts from, and the three starting points are weeks apart.
 *
 * Chrome ported from `InvoiceReasonDialog`: the glow hero with its icon tile
 * and uppercase pill, centered title and copy, a stacked body, and full-width
 * buttons with the confirm on top. The option cards are the settlement cards
 * from the detail rail, which is where this module already asks somebody to
 * pick one of a few things and says what each one means.
 */

import { useEffect, useState } from 'react';
import { Banknote, CalendarClock, CalendarDays, CheckCheck, HelpCircle, Mail, PackageCheck, Ship, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Label } from '@/app/components/ui/label';
import { DatePicker } from '@/app/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/app/components/ui/select';
import type { RefundCountsFrom, RefundMethod } from '@/app/data/mockRMAs';
import { localISODate } from '@/app/data/mockRMAs';

const ACCENT = { solid: '#047857', bg: '#D1FAE5', tint: '#ECFDF5' };

/** Days a vendor actually says. Typed entry stays open for the rest. */
const PRESET_DAYS = [14, 30, 45, 60];

const FROM_OPTIONS: { value: RefundCountsFrom; label: string; blurb: string; Icon: LucideIcon }[] = [
  {
    value: 'today',
    label: 'Today',
    blurb: 'The clock starts on this approval.',
    Icon: Sun,
  },
  {
    value: 'shipped',
    label: 'The day it ships',
    blurb: 'Starts when the goods leave your dock.',
    Icon: Ship,
  },
  {
    value: 'received',
    label: 'The day the vendor receives it',
    blurb: 'Starts when the goods land with them.',
    Icon: PackageCheck,
  },
];

const METHOD_OPTIONS: { value: RefundMethod; label: string; blurb: string; Icon: LucideIcon }[] = [
  { value: 'Wire', label: 'Wire', blurb: 'Sent to your bank account.', Icon: Banknote },
  { value: 'Check', label: 'Check', blurb: 'Posted, so allow for the mail.', Icon: Mail },
  {
    value: 'Unknown',
    label: "Don't know yet",
    blurb: 'Not confirmed by the vendor. You can add it later once confirmed.',
    Icon: HelpCircle,
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A stored date, said the way the rest of this dialog says dates. */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Where the date picker opens when somebody reaches for it: a month out,
 *  which is the commonest promise, rather than today. */
function defaultCustomDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return localISODate(d);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** One question, answered from a menu.
 *
 *  The options carry a line of explanation each, which is why they were cards
 *  to begin with. Stacked open, two questions' worth of them ran the dialog
 *  past the fold before it reached the fee or the sentence that sums it all
 *  up. The explanations ride in the menu instead: visible while choosing,
 *  which is the only moment they are read, and gone once the answer is in.
 */
function ChoicePicker<T extends string>({
  value,
  options,
  onPick,
  ariaLabel,
  badgeFor,
}: {
  value: T;
  options: { value: T; label: string; blurb: string; Icon: LucideIcon }[];
  onPick: (next: T) => void;
  ariaLabel: string;
  badgeFor?: (v: T) => string | undefined;
}) {
  const picked = options.find((o) => o.value === value) ?? options[0];
  if (!picked) return null;
  const Badge = ({ text }: { text: string }) => (
    <span
      className="shrink-0 rounded-full px-1.5 py-px text-[10px] uppercase tracking-[0.04em]"
      style={{ fontWeight: 700, backgroundColor: ACCENT.tint, color: ACCENT.solid }}
    >
      {text}
    </span>
  );
  const pickedBadge = badgeFor?.(picked.value);
  return (
    <Select value={value} onValueChange={(v) => onPick(v as T)}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-9 w-full border-[#E8ECF1] bg-white text-[12px]"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <picked.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT.solid }} />
          <span className="truncate text-foreground" style={{ fontWeight: 600 }}>
            {picked.label}
          </span>
          {pickedBadge && <Badge text={pickedBadge} />}
        </span>
      </SelectTrigger>
      <SelectContent className="z-[400] max-w-[var(--radix-select-trigger-width)]">
        {options.map((o) => {
          const badge = badgeFor?.(o.value);
          return (
            <SelectItem key={o.value} value={o.value} className="items-start py-2">
              <span className="flex items-start gap-2">
                <o.Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: ACCENT.solid }} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                      {o.label}
                    </span>
                    {badge && <Badge text={badge} />}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {o.blurb}
                  </span>
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export interface RMAApprovalAnswer {
  days: number;
  from: RefundCountsFrom;
  method: RefundMethod;
  /** What the vendor keeps back, as a percentage of the goods' value. Zero
   *  when they are not charging one, which is the default: a fee is something
   *  a vendor has to say, not something to assume. */
  restockingPct: number;
  /** Whether the fee was changed from what the modal opened with. An
   *  untouched fee keeps whatever charge the return already carries. */
  feeChanged: boolean;
  /** Set when the vendor named a date rather than a number of days. `days`
   *  and `from` carry their defaults then and mean nothing. */
  onDate?: string;
}

/** One line of the breakdown: a label and a figure. */
function Row({
  label,
  value,
  strong = false,
  dim = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  dim?: boolean;
  tone?: 'charge';
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className={dim ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-600'}
        style={{ fontWeight: dim ? 400 : 500 }}
      >
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${dim ? 'text-[10px] text-slate-500' : 'text-[11px]'} ${
          tone === 'charge' ? 'text-rose-600' : strong ? 'text-foreground' : ''
        }`}
        style={{ fontWeight: dim ? 400 : 600 }}
      >
        {value}
      </span>
    </div>
  );
}

export function RMAApproveModal({
  open,
  onOpenChange,
  vendorName,
  /** What this vendor normally pays by, so the common answer is pre-picked. */
  vendorPrimaryMethod,
  /** Their restocking fee where one is already on file. Undefined means
   *  nobody has ever asked, which is what makes the answer worth keeping. */
  vendorRestockingPct,
  /** The fee this return already carries, as a percentage of its value,
   *  where one was agreed at creation. It wins over the vendor's standard:
   *  the modal opened at 0% on a return saved with a $10.00 fee, and
   *  approving without touching it removed the fee. */
  currentFeePct,
  /** The value of the goods going back. Shown, not charged against. */
  returnValue,
  /** What a restocking fee is a percentage of: the full return value,
   *  invoiced or not. */
  feeBase,
  /** That base split into the parts a reader can recognise, so the dialog
   *  can show where the figure comes from rather than asserting it. */
  paidBack,
  creditBack,
  notInvoiced = 0,
  /** Charges already agreed on the return other than the restocking fee,
   *  return freight say. They come off what is expected the same way. */
  otherCharges = [],
  currency = 'USD',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  vendorPrimaryMethod?: string | undefined;
  vendorRestockingPct?: number | undefined;
  currentFeePct?: number | undefined;
  returnValue: number;
  feeBase: number;
  paidBack: number;
  creditBack: number;
  notInvoiced?: number;
  otherCharges?: { type: string; amount: number }[];
  currency?: string;
  onConfirm: (answer: RMAApprovalAnswer) => void;
}) {
  // The vendor's usual method, where it is one of the three this asks about.
  // A vendor who pays by ACH has no pre-pick here, and guessing Wire for them
  // would be putting words in their mouth.
  const vendorDefault = ((): RefundMethod | null => {
    const m = (vendorPrimaryMethod ?? '').toLowerCase();
    if (m.includes('wire')) return 'Wire';
    if (m.includes('check') || m.includes('cheque')) return 'Check';
    return null;
  })();

  const [days, setDays] = useState('30');
  // A vendor says one of two things: a number of days, or a date. The second
  // used to be typed in as days and the arithmetic done in somebody's head.
  const [onDate, setOnDate] = useState('');
  const [from, setFrom] = useState<RefundCountsFrom>('today');
  const [method, setMethod] = useState<RefundMethod>(vendorDefault ?? 'Unknown');
  // Zero unless the vendor already has a fee on file. A prompt that starts at
  // a number nobody quoted is a prompt that invents a deduction.
  const [restocking, setRestocking] = useState(
    String(currentFeePct ?? vendorRestockingPct ?? 0),
  );

  // Reopening asks the question fresh rather than showing the last answer,
  // which would read as something the vendor had already said.
  useEffect(() => {
    if (!open) return;
    setDays('30');
    setOnDate('');
    setFrom('today');
    setMethod(vendorDefault ?? 'Unknown');
    setRestocking(String(currentFeePct ?? vendorRestockingPct ?? 0));
  }, [open, vendorDefault, vendorRestockingPct, currentFeePct]);

  const byDate = onDate !== '';
  const typed = Number.parseInt(days, 10);
  // A date in the past is a promise already broken, which is not something to
  // record as a forecast.
  const dateIsFuture = (() => {
    if (!byDate) return false;
    const d = new Date(`${onDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !Number.isNaN(d.getTime()) && d.getTime() >= today.getTime();
  })();
  const validDays = byDate ? dateIsFuture : Number.isFinite(typed) && typed > 0 && typed <= 365;
  const pct = Number.parseFloat(restocking);
  const validPct = restocking.trim() === '' || (Number.isFinite(pct) && pct >= 0 && pct <= 100);
  const feePct = validPct && Number.isFinite(pct) ? pct : 0;
  // Against the full return value, invoiced or not, which is what the vendor
  // quotes the percentage on. Only the billed part used to count, which put a
  // 10% fee at $283.19 on RMA-01013 instead of $578.14.
  const feeAmount = Math.round(feeBase * (feePct / 100) * 100) / 100;
  // Charges come off the refund first, and only what the refund cannot cover
  // comes off the credit note -- the same split Log settlement waits on, so
  // the figure promised here is the figure asked for there.
  const totalCharges =
    Math.round((feeAmount + otherCharges.reduce((n, c) => n + (c.amount || 0), 0)) * 100) / 100;
  const chargesOnPaid = Math.min(paidBack, totalCharges);
  const netBack = Math.round((paidBack - chargesOnPaid) * 100) / 100;
  const creditNote = Math.max(
    0,
    Math.round((creditBack - (totalCharges - chargesOnPaid)) * 100) / 100,
  );
  const totalBack = Math.round((netBack + creditNote) * 100) / 100;
  const money = (n: number) =>
    `${currency === 'USD' ? '$' : `${currency} `}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  /** The three answers said back as the one fact they add up to. Two of the
   *  three starting points have not happened yet, so this is a date only when
   *  the clock starts today; otherwise it says what it is waiting for. A made
   *  up date would be chased. */
  const outcome = !validDays
    ? null
    : byDate
      ? `Expected by ${formatDate(onDate)}`
      : from === 'today'
        ? `Expected by ${addDays(typed)}`
        : from === 'shipped'
          ? `Expected ${typed} days after the goods ship`
          : `Expected ${typed} days after ${vendorName} receives them`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden rounded-2xl border-0 sm:max-w-[460px] max-h-[calc(100dvh-2rem)] overflow-y-auto"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Glow hero, the module's own confirm recipe. */}
        <div
          className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
          style={{
            background: `linear-gradient(180deg, ${ACCENT.tint} 0%, color-mix(in srgb, ${ACCENT.tint} 30%, transparent) 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: ACCENT.solid, filter: 'blur(50px)' }}
          />
          <div
            className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: ACCENT.bg }}
          >
            <CheckCheck className="w-7 h-7" style={{ color: ACCENT.solid, strokeWidth: 2 }} />
          </div>
          <span
            className="mt-2.5 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: ACCENT.tint,
              color: ACCENT.solid,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Approve
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <AlertDialogTitle
            className="text-[20px] tracking-[-0.02em] text-foreground"
            style={{ fontWeight: 600, lineHeight: 1.3 }}
          >
            {vendorName} authorized the return
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-[13px] mt-1.5 mx-auto text-muted-foreground"
            style={{ lineHeight: 1.6, maxWidth: '400px' }}
          >
            Note what the vendor said about the refund. You&apos;ll follow up
            against it.
          </AlertDialogDescription>
        </div>

        <div className="px-5 sm:px-6 pt-4 space-y-4 text-left">
          {/* 1 — how long */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              How long until the refund?
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_DAYS.map((d) => {
                const on = !byDate && typed === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setOnDate('');
                      setDays(String(d));
                    }}
                    className={`h-8 rounded-lg border px-2.5 text-[12px] tabular-nums transition-colors ${
                      on
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-[#E8ECF1] bg-white text-slate-600 hover:border-emerald-600/40'
                    }`}
                    style={{ fontWeight: on ? 700 : 500 }}
                  >
                    {d} days
                  </button>
                );
              })}
              {/* The fifth answer. A vendor who says "by the tenth" was
                  having their date turned back into a number of days in
                  somebody's head, and the arithmetic went into the record
                  instead of what they said. */}
              <button
                type="button"
                aria-pressed={byDate}
                onClick={() => setOnDate(byDate ? '' : defaultCustomDate())}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors ${
                  byDate
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-[#E8ECF1] bg-white text-slate-600 hover:border-emerald-600/40'
                }`}
                style={{ fontWeight: byDate ? 700 : 500 }}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                On a date
              </button>
            </div>
            {byDate && (
              <DatePicker
                id="rma-refund-by"
                value={onDate}
                onChange={setOnDate}
                placeholder="Pick the date they promised"
                className="!h-9 mt-0.5"
                {...(dateIsFuture ? {} : { error: true })}
              />
            )}
            {!validDays && (
              <p className="text-[10px] text-amber-700" style={{ fontWeight: 500 }}>
                {byDate
                  ? 'Pick a date that has not already passed.'
                  : 'Enter a number of days between 1 and 365.'}
              </p>
            )}
          </div>

          {/* 2 — counted from what. A named date has no starting point to
              ask about: it is the answer already. */}
          <div className="space-y-1.5" hidden={byDate}>
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Counted from
            </Label>
            <ChoicePicker
              value={from}
              options={FROM_OPTIONS}
              onPick={setFrom}
              ariaLabel="What the refund clock counts from"
            />
          </div>

          {/* 3 — how the money comes back */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              How the money comes back
            </Label>
            <ChoicePicker
              value={method}
              options={METHOD_OPTIONS}
              onPick={setMethod}
              ariaLabel="How the money comes back"
              badgeFor={(v) => (vendorDefault === v ? 'Their usual' : undefined)}
            />
            {/* A vendor whose usual method is neither of the two offered is
                worth naming, rather than leaving the reader to wonder why
                nothing was pre-picked for them. */}
            {!vendorDefault && vendorPrimaryMethod && (
              <p className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                {vendorName} normally pays by {vendorPrimaryMethod}.
              </p>
            )}
          </div>

          {/* 4 — what they keep back */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Restocking fee
            </Label>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-[#E8ECF1] bg-white">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Restocking fee percentage"
                  value={restocking}
                  onChange={(e) => {
                    if (/^\d{0,3}(\.\d{0,2})?$/.test(e.target.value)) setRestocking(e.target.value);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-14 min-w-0 bg-transparent px-2 text-right text-[12px] tabular-nums outline-none"
                  style={{ fontWeight: 600 }}
                />
                <span className="flex items-center border-l border-[#E8ECF1] bg-[#FAFBFC] px-2 text-[11px] text-slate-500">
                  %
                </span>
              </span>
              {/* A percentage is abstract until it is money, and the money
                  is meaningless until the reader knows what it is a
                  percentage OF. "$102.58 off this return" said neither. */}
              <span className="text-[11px] text-slate-500 tabular-nums">
                {feePct > 0
                  ? `${money(feeAmount)} of ${money(feeBase)}`
                  : 'They are not charging one'}
              </span>
              {(currentFeePct != null || vendorRestockingPct != null) && (
                <span
                  className="ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] uppercase tracking-[0.04em]"
                  style={{ fontWeight: 700, backgroundColor: ACCENT.tint, color: ACCENT.solid }}
                >
                  {currentFeePct != null ? 'On this RMA' : 'Their standard'}
                </span>
              )}
            </div>
            {!validPct && (
              <p className="text-[10px] text-amber-700" style={{ fontWeight: 500 }}>
                Enter a percentage between 0 and 100.
              </p>
            )}
            {/* The rule, Oct 30: a restocking fee or any vendor charge is
                taken on the whole return, invoiced or not, but what comes
                back counts only the goods that were billed: the refund on
                paid goods and the credit on an open invoice. Goods never
                invoiced come back as nothing -- the accrual just unwinds --
                so they are shown apart and do not add to it. */}
            {validPct && feeBase > 0.004 && (
              <div className="mt-1 rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-3 py-2 space-y-1">
                <Row label="Return value" value={money(feeBase)} strong />
                {feePct > 0 && (
                  <Row
                    label={`Restocking fee, ${feePct}% of return value`}
                    value={`\u2212${money(feeAmount)}`}
                    tone="charge"
                  />
                )}
                {otherCharges
                  .filter((c) => c.amount > 0.004)
                  .map((c, i) => (
                    <Row
                      key={`${c.type}-${i}`}
                      label={c.type}
                      value={`\u2212${money(c.amount)}`}
                      tone="charge"
                    />
                  ))}
                <div className="pt-1 space-y-1" style={{ borderTop: '1px solid #E8ECF1' }}>
                  <Row label="Refund, already paid" value={money(paidBack)} dim />
                  {creditBack > 0.004 && (
                    <Row label="Credit, against the open invoice" value={money(creditBack)} dim />
                  )}
                  {totalCharges > 0.004 && (
                    <Row
                      label="Less the charges"
                      value={`\u2212${money(Math.min(totalCharges, paidBack + creditBack))}`}
                      dim
                    />
                  )}
                  {/* ERP-8655 AC6.3: the refund and the credit less the
                      charges. Said in the story's own words, and split by
                      how it arrives: the refund is what Log settlement waits
                      on, the credit note comes off the payable. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>
                      Total coming back
                    </span>
                    <span
                      className="shrink-0 text-[12px] tabular-nums"
                      style={{ fontWeight: 700, color: ACCENT.solid }}
                    >
                      {money(totalBack)}
                    </span>
                  </div>
                  {netBack > 0.004 && creditNote > 0.004 && (
                    <>
                      <Row label="As a refund" value={money(netBack)} dim />
                      <Row label="As a credit note" value={money(creditNote)} dim />
                    </>
                  )}
                </div>
                {notInvoiced > 0.004 && (
                  <div className="pt-1 space-y-1" style={{ borderTop: '1px dashed #E8ECF1' }}>
                    <Row
                      label="Not yet invoiced, reversed, nothing comes back"
                      value={money(notInvoiced)}
                      dim
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* The three answers said back as the one fact they make. */}
          {outcome && (
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
              style={{ borderColor: '#A7F3D0', backgroundColor: ACCENT.tint }}
            >
              <CalendarClock className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT.solid }} />
              <span className="text-[12px]" style={{ fontWeight: 600, color: '#065F46' }}>
                {outcome}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-5 sm:p-6 pt-4">
          <AlertDialogAction
            disabled={!validDays || !validPct}
            onClick={(e) => {
              if (!validDays || !validPct) {
                e.preventDefault();
                return;
              }
              onConfirm({
                days: byDate ? 0 : typed,
                from,
                method,
                restockingPct: feePct,
                feeChanged: feePct !== (currentFeePct ?? vendorRestockingPct ?? 0),
                ...(byDate ? { onDate } : {}),
              });
            }}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 600, backgroundColor: ACCENT.solid, color: '#fff' }}
          >
            Mark as approved
          </AlertDialogAction>
          <AlertDialogCancel
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
          >
            Go back
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
