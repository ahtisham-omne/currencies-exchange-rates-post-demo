import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { Undo2, AlertTriangle, FileText, Lock, X, Upload, Paperclip, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { formatMoney as formatInCurrency } from '@/app/currency/money';

/** Resolve a payment's funding account (a PAY_FROM id like
 *  "1210-Citibank" or a GL string) into a code + name for the reversal
 *  entry — the money returns to the account it actually left (9/22/26
 *  review response). No account on the record → the generic fallback. */
function bankGl(bankAccount?: string): { code: string; name: string } {
  if (!bankAccount) return { code: '1000', name: 'Cash and Bank' };
  const str = bankAccount.trim();
  const space = str.indexOf(' ');
  if (/^\d/.test(str) && space > 0) return { code: str.slice(0, space), name: str.slice(space + 1) };
  const m = str.match(/^(\d+)-(.+)$/);
  if (m) return { code: m[1], name: m[2] };
  return { code: '1000', name: str };
}

export interface PaymentRecord {
  id: string;
  reference: string;
  /** The payment's OMNE record number — makes the picked payment
   *  clickable (Nophil 9/22), opening /payments-v2/:paymentNumber. */
  paymentNumber?: string;
  date: string;
  /** The payment's FULL amount (9/22/26 review response): the dialog
   *  reverses the whole payment, so it names the whole payment — never
   *  just this invoice's slice. */
  amount: number;
  /** Every invoice this payment applied to (BA 9/6): the "Against
   *  invoice" card lists them ALL — a payment can span invoices, so
   *  showing one was lying by omission. */
  appliedTo?: { invoiceNumber: string; applied: number; outstanding: number }[];
  /** The funding account the money actually left (9/22/26): the entry
   *  debits it back, never a generic "1000 Cash and Bank". */
  bankAccount?: string;
  /** Vendor credit the payment consumed — restored by the reversal and
   *  shown as its own journal line. */
  appliedCreditTotal?: number;
  /** The AP or advance-asset account the payment actually posted to
   *  (Eli 9/24 R04): the reversal must invert the CHOSEN account, never
   *  a default. e.g. "1205 Advances to Vendors". */
  apAccount?: string;
  /** The payment's saved journal (Eli 9/24 R04): when present, the
   *  reversal preview is exactly these legs inverted. */
  glEntries?: { accountCode: string; accountName: string; debit?: number; credit?: number }[];
}

export interface ReversePaymentSubmitPayload {
  paymentId: string;
  paymentReference: string;
  reversalDate: string;
  reason: string;
  reversalAmount: number;
  memo: string;
  notify: boolean;
  notifiedRecipientIds: string[];
  /** Supporting documents attached to the reversal (user 9/9). */
  attachments?: string[];
}

interface ReversePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  vendorName: string;
  outstandingBalance: number;
  totalAmount: number;
  currency: string;
  payments: PaymentRecord[];
  /** Pre-invoices reverse PREPAYMENTS (mirror: Dr Cash / Cr Vendor
   *  Prepayments); regular invoices reverse payments (Dr Cash / Cr AP). */
  entity?: 'payment' | 'prepayment';
  /** Pre-select the payment the user invoked the reversal from (9/4/26
   *  Eli, BB-29) — a payment can span invoices, so the modal frames the
   *  reversal against the VENDOR and pre-picks this record. */
  initialPaymentId?: string;
  /** Per-payment invoice context for callers that offer several of the
   *  vendor's payments — keeps the balance/status preview honest when
   *  the user switches records in the picker. Falls back to the
   *  top-level invoiceNumber/outstandingBalance/totalAmount props. */
  contexts?: Record<string, { invoiceNumber: string; outstandingBalance: number; totalAmount: number }>;
  onSubmit: (payload: ReversePaymentSubmitPayload) => void;
}

const REASONS = [
  'Bank Rejection',
  'Duplicate Payment',
  'Vendor Refund Received',
  'Posting Error',
  'Other',
];

// Rose, matching the Reverse Payment header CTA (bg-rose-600) — the
// modal follows its action's color, not primary blue (7/15/26).
const THEME = {
  bg: '#FFF1F2',
  solid: '#E11D48',
  pillText: '#BE123C',
};
const LIGHT_TINT = `color-mix(in srgb, ${THEME.bg} 50%, white)`;

function todayIso() {
  return localTodayIso();
}

// MMM D, YYYY (date format standard 9/3/26) — the picker previously
// showed the raw ISO date.
function fmtShortDate(iso: string) {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// Each currency with its own symbol and decimals (Currency & Exchange Rates).
const formatMoney = (amount: number, currency: string) => formatInCurrency(amount, currency);

export function ReversePaymentModal({
  open,
  onOpenChange,
  invoiceNumber,
  vendorName,
  outstandingBalance: outstandingBalanceProp,
  totalAmount: totalAmountProp,
  currency,
  payments,
  entity = 'payment',
  initialPaymentId,
  contexts,
  onSubmit,
}: ReversePaymentModalProps) {
  const isPrepay = entity === 'prepayment';
  const noun = isPrepay ? 'prepayment' : 'payment';
  const [paymentId, setPaymentId] = useState<string>('');
  const [reversalDate, setReversalDate] = useState(todayIso);
  const [reason, setReason] = useState(REASONS[0]);
  const [memo, setMemo] = useState('');
  // Notify recipients — same reply-all picker the payment-hold / release
  // confirms use, so every alert-style action offers a consistent "tell
  // these people" control (Eli 7/24/26).
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  // Supporting documents (user 9/9): a reversal usually has evidence — a
  // bank rejection notice, a vendor email — and the block was missing.
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  // The reversing GL entry shows on a CONFIRM step (user 9/9) — one more
  // deliberate check before money moves back.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Outside-click standard (user 9/22): pristine → close silently, dirty
  // → discard warning.
  const [discardOpen, setDiscardOpen] = useState(false);
  // Synchronous close latch: state updates batch, so the outside-click
  // guard can observe confirmOpen=false in the same tick the submit
  // closes everything — the ref wins the race (user 9/23 bug: the
  // discard warning floated after a completed reversal).
  const closingRef = useRef(false);
  const { showGlOnConfirmations } = useSystemSettings();

  const selectedPayment = useMemo(
    () => payments.find((p) => p.id === paymentId) || null,
    [paymentId, payments],
  );

  useEffect(() => {
    if (open) {
      // Pre-select the payment the user came from (9/4/26 Eli, BB-29);
      // the picker still offers the vendor's other reversible payments.
      const preferred = initialPaymentId && payments.some((p) => p.id === initialPaymentId) ? initialPaymentId : payments[0]?.id || '';
      setPaymentId(preferred);
      setReversalDate(todayIso());
      setReason(REASONS[0]);
      setMemo('');
      setNotify(true);
      setRecipients(new Set());
      setAttachments([]);
      setConfirmOpen(false);
      setDiscardOpen(false);
      setDateError(false);
      closingRef.current = false;
    }
  }, [open, payments, initialPaymentId]);

  // Balance context follows the SELECTED payment when the caller passed
  // per-payment contexts (payments listing path); the invoice detail
  // path keeps its single-invoice props.
  const ctx = (paymentId && contexts?.[paymentId]) || undefined;
  const outstandingBalance = ctx?.outstandingBalance ?? outstandingBalanceProp;
  const totalAmount = ctx?.totalAmount ?? totalAmountProp;

  // A reversal always restores the FULL original payment, there is no
  // partial reversal, so the amount is read-only (feedback 7/20/26).
  // The named amount is the WHOLE payment (9/22/26 review response) —
  // the slice restored to THIS invoice drives the after-reversal math.
  const reversalAmount = selectedPayment?.amount ?? 0;
  const appliedHere = selectedPayment?.appliedTo?.find((a) => a.invoiceNumber === invoiceNumber)?.applied
    ?? selectedPayment?.amount
    ?? 0;

  const totalPaidAfterReversal = Math.max(0, totalAmount - outstandingBalance - appliedHere);
  const newOutstanding = Math.min(totalAmount, outstandingBalance + appliedHere);
  // Status moves back based on what remains (lifecycle specs 7/15/26).
  const nextStatus = totalPaidAfterReversal <= 0.004
    ? 'Approved'
    : (isPrepay ? 'Partially Prepaid' : 'Partially Paid');

  // Reason "Other" makes the description mandatory (Eli 7/22/26): "you're
  // reversing a payment, you better put something in here." Every other reason
  // (bank rejection, duplicate, posting error, …) keeps it optional.
  const descriptionRequired = reason === 'Other';
  // The reversal date is required (user 9/24/26): it defaults to today but
  // must never post blank.
  const [dateError, setDateError] = useState(false);
  const canSubmit =
    reversalAmount > 0 && !!selectedPayment && !!reversalDate && (!descriptionRequired || memo.trim().length > 0);

  // The reversing entry inverts the ORIGINAL transaction (Eli 9/24
  // R04): the saved journal's legs swap sides when we have them; the
  // fallback derives from the record's own accounts, never defaults.
  const splitAcct = (v: string | undefined, defCode: string, defName: string) => {
    const t = (v || '').trim();
    const code = t.split(/[\s-]/)[0];
    if (!code || !/^\d{3,4}$/.test(code)) return { code: defCode, name: defName };
    const name = t.slice(code.length).replace(/^[\s·-]+/, '') || defName;
    return { code, name };
  };
  const reversalRows = (() => {
    const saved = selectedPayment?.glEntries;
    if (saved && saved.length > 0) {
      return saved.map((e) => ({
        code: e.accountCode,
        name: e.accountName,
        debit: Math.round(((e.credit ?? 0)) * 100) / 100,
        credit: Math.round(((e.debit ?? 0)) * 100) / 100,
      })).filter((r) => r.debit > 0.004 || r.credit > 0.004)
        .sort((x, y) => (y.debit > 0.004 ? 1 : 0) - (x.debit > 0.004 ? 1 : 0));
    }
    const bank = bankGl(selectedPayment?.bankAccount);
    const credit = selectedPayment?.appliedCreditTotal ?? 0;
    const advance = splitAcct(isPrepay ? selectedPayment?.apAccount : undefined, '1300', 'Vendor Prepayments');
    const ap = splitAcct(!isPrepay ? selectedPayment?.apAccount : undefined, '2000', 'Accounts Payable');
    return [
      { code: bank.code, name: bank.name, debit: reversalAmount, credit: 0 },
      ...(credit > 0.004 ? [{ code: '1300', name: 'Vendor Prepayments', debit: credit, credit: 0 }] : []),
      isPrepay
        ? { code: advance.code, name: advance.name, debit: 0, credit: reversalAmount }
        : { code: ap.code, name: ap.name, debit: 0, credit: Math.round((reversalAmount + credit) * 100) / 100 },
    ];
  })();

  // Anything the user changed away from the prefilled defaults makes the
  // form dirty — outside clicks then warn instead of closing (user 9/22).
  const preferredPaymentId =
    initialPaymentId && payments.some((p) => p.id === initialPaymentId)
      ? initialPaymentId
      : payments[0]?.id || '';
  const dirty =
    memo.trim().length > 0 ||
    attachments.length > 0 ||
    recipients.size > 0 ||
    reason !== REASONS[0] ||
    reversalDate !== todayIso() ||
    (paymentId !== '' && paymentId !== preferredPaymentId);

  // Reverse → the GL-impact confirm; its CTA performs the reversal.
  const handleSubmit = () => {
    if (!canSubmit || !selectedPayment) {
      if (!reversalDate) {
        setDateError(true);
        toast.error('Reversal date required', { description: 'Pick the date the reversal posts before continuing.' });
        const el = document.getElementById('rev-date');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
        return;
      }
      if (descriptionRequired && !memo.trim()) {
        toast.error('Description required', { description: '"Other" needs a description before the reversal can go through.' });
      }
      return;
    }
    setConfirmOpen(true);
  };
  const performSubmit = () => {
    closingRef.current = true;
    if (!canSubmit || !selectedPayment) return;
    onSubmit({
      paymentId: selectedPayment.id,
      paymentReference: selectedPayment.reference,
      reversalDate,
      reason,
      reversalAmount,
      memo: memo.trim(),
      notify,
      notifiedRecipientIds: notify ? Array.from(recipients) : [],
      attachments: attachments.length > 0 ? attachments.map((f) => f.name) : undefined,
    });
    setConfirmOpen(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Column layout with a pinned footer (Eli 9/8: "the CTA is
        // underneath, it's tucked in") — the BODY scrolls, the action row
        // never leaves the viewport, on any display.
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[680px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        // Outside-click standard (user 9/22): pristine closes, dirty warns.
        // The nested GL confirm and the discard warning are PORTALED
        // outside this content, so their clicks read as "outside" — while
        // either is open, swallow the event instead of raising the
        // discard warning (the bug that floated it after a reversal).
        onInteractOutside={(e) => {
          if (closingRef.current || confirmOpen || discardOpen) {
            e.preventDefault();
            return;
          }
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (closingRef.current || confirmOpen || discardOpen) {
            e.preventDefault();
            return;
          }
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
      >
        {/* Header — creation-modal chrome: tinted icon chip, title +
            subtitle, bordered status pill, close X. No gradient hero. */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: THEME.bg }}
            >
              <Undo2 className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              {/* Vendor-first framing (9/4/26 Eli, BB-29): a payment can
                  span several invoices, so the reversal is recorded
                  against the VENDOR — then you pick which payment. */}
              <DialogTitle
                className="text-[15px] sm:text-[16px] text-foreground"
                style={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                {isPrepay ? 'Reverse a Prepayment' : 'Reverse a Payment'} · {vendorName}
              </DialogTitle>
              {/* One line at the 680px width (user 9/9) — the GL detail
                  lives in the After-reversal card, not the header. */}
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500 whitespace-nowrap truncate" style={{ lineHeight: 1.5 }}>
                Pick the {noun} to reverse. Its full amount restores to the {isPrepay ? 'pre-invoice' : 'invoices'} it covered.
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

        {/* Body — Eli's 9/8 sequence: the payment to reverse FIRST
            (that's the selection), then what it hits (against invoices +
            after-reversal, next to each other), then date and amount side
            by side, then description. The body scrolls under a pinned
            footer. */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left flex-1 min-h-0 overflow-y-auto">
          {payments.length === 0 ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-amber-900" style={{ fontWeight: 600 }}>No prior {noun}s on file.</p>
                <p className="text-[11px] text-amber-800/80 mt-0.5">Reversal is only available once a {noun} has posted.</p>
              </div>
            </div>
          ) : (
            <>
              {/* 1 · The selection. */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                  {isPrepay ? 'Prepayment to Reverse' : 'Payment to Reverse'}
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
                <Select value={paymentId} onValueChange={setPaymentId}>
                  <SelectTrigger className="h-9 text-[12px] bg-white [&>span]:min-w-0">
                    {selectedPayment ? (
                      <span className="flex items-center gap-1.5 min-w-0">
                        {selectedPayment.paymentNumber ? (
                          <a
                            href={`/payments-v2/${encodeURIComponent(selectedPayment.paymentNumber)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700 hover:text-primary hover:border-primary/40 hover:underline transition-colors"
                            style={{ fontWeight: 600 }}
                            title={`Open ${selectedPayment.paymentNumber} in a new tab`}
                          >
                            {selectedPayment.reference}
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{selectedPayment.reference}</span>
                        )}
                        <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-white text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{fmtShortDate(selectedPayment.date)}</span>
                        <span className="text-foreground truncate" style={{ fontWeight: 600 }}>{formatMoney(selectedPayment.amount, currency)}</span>
                      </span>
                    ) : (
                      <SelectValue placeholder="Select a payment" />
                    )}
                  </SelectTrigger>
                  <SelectContent className="z-[400]">
                    {/* Pills, not a run-on line (Nophil 9/22): the
                        reference and the date each wear their own chip so
                        neither is mistaken for the other. */}
                    {payments.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-[12px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{p.reference}</span>
                          <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-white text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{fmtShortDate(p.date)}</span>
                          <span className="text-foreground" style={{ fontWeight: 600 }}>{formatMoney(p.amount, currency)}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2 · What the selection hits — against invoices and the
                  after-reversal preview, next to each other. */}
              <div className="grid sm:grid-cols-2 gap-3 items-stretch">
                {(() => {
                  const applied = selectedPayment?.appliedTo?.length
                    ? selectedPayment.appliedTo
                    : [{ invoiceNumber, applied: selectedPayment?.amount ?? 0, outstanding: outstandingBalance }];
                  return (
                    <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5 min-w-0 flex flex-col">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                          <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>
                            Against {applied.length === 1 ? 'Invoice' : `${applied.length} Invoices`}
                          </p>
                          <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>{vendorName}</p>
                        </div>
                      </div>
                      {/* Three-row CAP with in-card scroll (user 9/9 v2):
                          short lists keep the card short, long lists
                          scroll inside the same 3-row window — the modal
                          never balloons either way. */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex-1">
                        <div className="max-h-[72px] overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                          {applied.map((a) => (
                            <div key={a.invoiceNumber} className="flex items-center justify-between gap-2 text-[11px]">
                              {/* Invoice ID link rule (user 9/9): black at
                                  rest, blue underline on hover, new tab. */}
                              <a
                                href={`/invoices/${encodeURIComponent(a.invoiceNumber)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground truncate hover:text-primary hover:underline transition-colors"
                                style={{ fontWeight: 600 }}
                              >
                                {a.invoiceNumber}
                              </a>
                              <span className="text-slate-500 shrink-0" style={{ fontWeight: 500 }}>
                                {formatMoney(a.applied, currency)} applied
                              </span>
                            </div>
                          ))}
                          {applied.length > 3 && (
                            <p className="text-[10px] text-slate-400 pt-0.5">{applied.length} invoices in total</p>
                          )}
                        </div>
                      </div>
                      {/* The card states its own outcome (user 9/9: the
                          area read sparse) — every listed share restores
                          on reversal. */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400" style={{ fontWeight: 500 }}>Amount Restored to Invoices</span>
                        <span className="text-foreground " style={{ fontWeight: 600 }}>
                          {formatMoney(applied.reduce((s, a) => s + a.applied, 0), currency)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div
                  className="rounded-xl px-3.5 py-3 min-w-0 bg-white"
                  style={{ border: '1px solid #FECDD3' }}
                >
                  <p className="text-[10px] tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
                    After Reversal
                  </p>
                  <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>
                    {formatMoney(newOutstanding, currency)}
                    <span className="text-[10px] ml-1.5" style={{ fontWeight: 600, color: '#047857' }}>
                      · {nextStatus}
                    </span>
                  </p>
                  {/* Full picture inline (user 9/9 v2: "show everything
                      here like before") — the confirm step still repeats
                      the entry as the final check. */}
                  {reversalAmount > 0 && (
                    <div className="mt-2 pt-2 space-y-1 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>
                        GL Impact
                      </p>
                      {(() => {
                        // The entry mirrors the ORIGINAL payment (Eli 9/24
                        // R04): the saved journal's legs inverted, so
                        // chosen banks and advance accounts come back
                        // exactly where they were posted.
                        const rows = reversalRows.map((r) => ({
                          side: r.debit > 0.004 ? 'Debit' : 'Credit',
                          code: r.code,
                          name: r.name,
                          amount: r.debit > 0.004 ? r.debit : r.credit,
                        }));
                        return rows.map((row) => {
                          // Common GL direction language (7/24/26 rule):
                          // debits raise assets/expenses, credits raise
                          // liabilities — green up, red down.
                          const isAsset = row.code.startsWith('1');
                          const isExpense = row.code.startsWith('5') || row.code.startsWith('6');
                          const isDebit = row.side === 'Debit';
                          const up = isAsset || isExpense ? isDebit : !isDebit;
                          return (
                        <div key={`${row.side}-${row.code}`} className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {/* Grey chips (user 9/23 final call): the
                                direction color lives on the arrow alone. */}
                            <span
                              className="inline-flex items-center w-[46px] justify-center px-1 py-px rounded text-[9px] bg-slate-100 text-slate-600"
                              style={{ fontWeight: 700 }}
                            >
                              {row.side}
                            </span>
                            <span className="text-[10px] text-slate-500 " style={{ fontWeight: 600 }}>{row.code}</span>
                            <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{row.name}</span>
                            {/* The confirmation modal's arrow badge, same
                                size (user 9/23). */}
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full border shrink-0"
                              aria-label={up ? 'Increases' : 'Decreases'}
                              style={up
                                ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
                            >
                              {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                            </span>
                          </span>
                          <span className="text-[11px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                            {formatMoney(row.amount, currency)}
                          </span>
                        </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* 3 · Date and amount, side by side (Eli 9/8): the locked
                  full-payment amount earns its place next to the date. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rev-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    Reversal Date
                    <span style={{ color: '#DC2626' }}>*</span>
                  </Label>
                  <DatePicker
                    id="rev-date"
                    value={reversalDate}
                    onChange={(v) => { setReversalDate(v); setDateError(false); }}
                    className="!h-9"
                    error={dateError}
                  />
                  {dateError && <p className="text-[10px] text-red-600">Reversal date is missing.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    Reversal Amount
                  </Label>
                  {/* Read-only, always the full original payment. Partial
                      reversals don't exist: you reverse exactly what was
                      paid (feedback 7/20/26, reaffirmed 9/8). Locked
                      recipe with a REAL border + chip (user 9/9: the flat
                      slate fill was merging into the background), and a
                      hover tooltip saying WHY it's locked. */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-slate-300 bg-slate-50 cursor-not-allowed">
                        <span className="text-[12px] text-slate-600 " style={{ fontWeight: 600 }}>
                          {selectedPayment ? formatMoney(selectedPayment.amount, currency) : formatMoney(0, currency)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>
                          <Lock className="w-3 h-3 text-slate-400" />
                          Full {isPrepay ? 'Prepayment' : 'Payment'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Locked to the full {noun}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        A reversal always restores exactly what was paid; partial reversals aren't supported. To settle a different amount, reverse in full and record a new {noun}.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Reason — full width below the date/amount row (user 9/9
                  final layout). */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                  Reason
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-9 text-[12px] bg-white w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[400]">
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description ∥ Supporting documents (user 9/9 final
                  layout); the notify card closes the modal solo below. */}
              <div className="grid sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="rev-description" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    Description
                    {descriptionRequired && <span style={{ color: '#DC2626' }}>*</span>}
                  </Label>
                  <Textarea
                    id="rev-description"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={4}
                    placeholder={descriptionRequired ? 'Explain why this payment is being reversed.' : undefined}
                    className={`text-[12px] resize-none bg-white h-[104px] ${descriptionRequired && !memo.trim() ? 'border-red-300 focus-visible:ring-red-100' : ''}`}
                  />
                  {descriptionRequired && !memo.trim() && (
                    <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>A description is required when the reason is “Other”.</p>
                  )}
                </div>

              {/* Supporting documents — a reversal has evidence (bank
                  notice, vendor email); partner drop-zone recipe. */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Supporting Documents
                </Label>
                <input
                  type="file"
                  id="reversal-doc-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAttachments((prev) => [...prev, { name: file.name }]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('reversal-doc-upload')?.click()}
                  className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-500" />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                    <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                  </span>
                  <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                </button>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {attachments.map((file, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                        <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                        <span className="truncate max-w-[160px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              </div>

              {/* Notify closes the modal, full width (user 9/9 final
                  layout) — the system's one notify interaction. */}
              <NotifyToggleCard
                title="Notify Recipients"
                helper={`Tell the people you choose that this ${noun} was reversed.`}
                checked={notify}
                onCheckedChange={setNotify}
                selectedIds={recipients}
                onSelectionChange={setRecipients}
                accentColor={THEME.solid}
                accentBg={THEME.bg}
                accentBorder="#FECDD3"
                accentText={THEME.pillText}
              />

            </>
          )}
        </div>

        {/* Footer — creation-modal chrome: border-t, outline escape +
            solid action, right-aligned, PINNED (never scrolls away). */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            {isPrepay ? 'Reverse Prepayment' : 'Reverse Payment'}
          </button>
        </div>
      </DialogContent>

      {/* GL-impact confirm (user 9/9): the standard confirmation step the
          other money actions use, in the reversal's rose — one more
          deliberate check, and the reversing entry reviewed right where
          it commits. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          <div
            className="relative flex flex-col items-center pt-9 pb-5"
            style={{ background: `linear-gradient(180deg, ${THEME.bg} 0%, rgba(255,255,255,0.3) 70%, transparent 100%)` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: THEME.solid }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FECDD3' }}>
              <Undo2 className="w-7 h-7" style={{ color: THEME.pillText }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: THEME.bg, color: THEME.pillText,  }}>
              Confirm Reversal
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Reverse {formatMoney(reversalAmount, currency)}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-[12px] text-slate-500 mt-1.5">
              The full {noun} restores to the invoices it covered. The balance returns to {formatMoney(newOutstanding, currency)} · {nextStatus}.
            </p>
            {showGlOnConfirmations && (
              <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                  <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>GL Impact</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="px-3 py-1.5 text-left text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Account</th>
                        <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Debit</th>
                        <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reversalRows.map((row) => {
                        // Same direction language as everywhere in the
                        // system (user 9/23): green up = increases,
                        // red down = decreases.
                        const isAsset = row.code.startsWith('1');
                        const isExpense = row.code.startsWith('5') || row.code.startsWith('6');
                        const isDebit = row.debit > 0;
                        const up = isAsset || isExpense ? isDebit : !isDebit;
                        return (
                        <tr key={row.code} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-1.5">
                            <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{row.code}</span>
                            <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{row.name}</span>
                            <span
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle"
                              aria-label={up ? 'Increases' : 'Decreases'}
                              style={up
                                ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
                            >
                              {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right ">{row.debit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(row.debit, currency)}</span> : null}</td>
                          <td className="px-3 py-1.5 text-right ">{row.credit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(row.credit, currency)}</span> : null}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="w-full mt-5 flex flex-col gap-2.5">
              <button
                onClick={performSubmit}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: THEME.solid, color: '#fff' }}
              >
                {isPrepay ? 'Reverse Prepayment' : 'Reverse Payment'}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'var(--color-slate-50)', color: 'var(--color-slate-700)' }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardConfirm
        open={discardOpen}
        what="this reversal"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
