import { useEffect, useMemo, useState } from 'react';
import { Undo2, AlertTriangle, FileText, Lock, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
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

export interface PaymentRecord {
  id: string;
  reference: string;
  date: string;
  amount: number;
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
  onSubmit: (payload: ReversePaymentSubmitPayload) => void;
}

const REASONS = [
  'Bank rejection',
  'Duplicate payment',
  'Vendor refund received',
  'Posting error',
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
  return new Date().toISOString().split('T')[0];
}

function formatMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReversePaymentModal({
  open,
  onOpenChange,
  invoiceNumber,
  vendorName,
  outstandingBalance,
  totalAmount,
  currency,
  payments,
  entity = 'payment',
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

  const selectedPayment = useMemo(
    () => payments.find((p) => p.id === paymentId) || null,
    [paymentId, payments],
  );

  useEffect(() => {
    if (open) {
      const firstId = payments[0]?.id || '';
      setPaymentId(firstId);
      setReversalDate(todayIso());
      setReason(REASONS[0]);
      setMemo('');
      setNotify(true);
      setRecipients(new Set());
    }
  }, [open, payments]);

  // A reversal always restores the FULL original payment, there is no
  // partial reversal, so the amount is read-only (feedback 7/20/26).
  const reversalAmount = selectedPayment?.amount ?? 0;

  const totalPaidAfterReversal = Math.max(0, totalAmount - outstandingBalance - reversalAmount);
  const newOutstanding = Math.min(totalAmount, outstandingBalance + reversalAmount);
  // Status moves back based on what remains (lifecycle specs 7/15/26).
  const nextStatus = totalPaidAfterReversal <= 0.004
    ? 'Approved'
    : (isPrepay ? 'Partially Prepaid' : 'Partially Paid');

  // Reason "Other" makes the description mandatory (Eli 7/22/26): "you're
  // reversing a payment, you better put something in here." Every other reason
  // (bank rejection, duplicate, posting error, …) keeps it optional.
  const descriptionRequired = reason === 'Other';
  const canSubmit =
    reversalAmount > 0 && !!selectedPayment && (!descriptionRequired || memo.trim().length > 0);

  const handleSubmit = () => {
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
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[560px] max-sm:max-h-[94vh] max-sm:overflow-y-auto"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
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
              <DialogTitle
                className="text-[15px] sm:text-[16px] text-foreground"
                style={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                {isPrepay ? 'Reverse this prepayment?' : 'Reverse this payment?'}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                Restores the outstanding balance and posts a reversing GL entry.
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

        {/* Body — one stacked column: invoice context card, form fields,
            then the live reversal preview. */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left">
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Against invoice</p>
                <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>{invoiceNumber}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  {vendorName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Outstanding</p>
                <p className="text-[13px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700 }}>{formatMoney(outstandingBalance, currency)}</p>
              </div>
            </div>
          </div>

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
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                  {isPrepay ? 'Prepayment to reverse' : 'Payment to reverse'}
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
                <Select value={paymentId} onValueChange={setPaymentId}>
                  <SelectTrigger className="h-9 text-[12px] bg-white">
                    <SelectValue placeholder="Select a payment" />
                  </SelectTrigger>
                  <SelectContent className="z-[400]">
                    {payments.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-[12px]">
                        <span className="tabular-nums" style={{ fontWeight: 500 }}>{p.reference}</span>
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="tabular-nums">{p.date}</span>
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="tabular-nums text-foreground" style={{ fontWeight: 600 }}>{formatMoney(p.amount, currency)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rev-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    Reversal date
                  </Label>
                  <DatePicker
                    id="rev-date"
                    value={reversalDate}
                    onChange={setReversalDate}
                    className="!h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                    Reason
                    <span style={{ color: '#DC2626' }}>*</span>
                  </Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="h-9 text-[12px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[400]">
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Reversal amount
                </Label>
                {/* Read-only, always the full original payment. Partial
                    reversals don't exist: you reverse exactly what was
                    paid (feedback 7/20/26). */}
                <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50">
                  <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {selectedPayment ? formatMoney(selectedPayment.amount, currency) : formatMoney(0, currency)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                    <Lock className="w-3 h-3" />
                    Full {noun}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  A reversal always restores the full original {noun} amount.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rev-description" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Description{' '}
                  {descriptionRequired
                    ? <span className="text-red-500" style={{ fontWeight: 500 }}>(required)</span>
                    : <span className="text-slate-400" style={{ fontWeight: 400 }}>(optional)</span>}
                </Label>
                <Textarea
                  id="rev-description"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  placeholder={descriptionRequired ? 'Explain why this payment is being reversed.' : undefined}
                  className={`text-[12px] resize-none bg-white ${descriptionRequired && !memo.trim() ? 'border-red-300 focus-visible:ring-red-100' : ''}`}
                />
                {descriptionRequired && !memo.trim() && (
                  <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>A description is required when the reason is “Other”.</p>
                )}
              </div>

              {/* Notify recipients — same reply-all picker as payment hold /
                  release, so alert-style actions stay consistent (Eli 7/24/26). */}
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer">
                  <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify recipients</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Tell the people you choose that this {noun} was reversed. Optional.
                    </span>
                  </span>
                </label>
                {notify && (
                  <SearchableUserPicker
                    selectedIds={recipients}
                    onSelectionChange={setRecipients}
                    accentColor={THEME.solid}
                    accentBg={THEME.bg}
                    accentBorder="#FECDD3"
                    accentText={THEME.pillText}
                    label="Notify on reversal"
                  />
                )}
              </div>

            </>
          )}
          {/* Live reversal preview — restored balance plus the mirror entry
              the reversal posts (spec §8: the mirror of the original). */}
          {payments.length > 0 && (
            <div
              className="rounded-xl px-3.5 py-3"
              style={{ backgroundColor: LIGHT_TINT, border: `1px solid color-mix(in srgb, ${THEME.solid} 12%, transparent)` }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
                After reversal
              </p>
              <p className="text-[15px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700 }}>
                {formatMoney(newOutstanding, currency)}
                <span className="text-[10px] text-slate-500 ml-1.5" style={{ fontWeight: 500 }}>
                  · {nextStatus}
                </span>
              </p>
              {reversalAmount > 0 && (
                <div className="mt-2 pt-2 space-y-1" style={{ borderTop: `1px solid color-mix(in srgb, ${THEME.solid} 14%, transparent)` }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
                    GL impact
                  </p>
                  {[
                    { side: 'Debit', code: '1000', name: 'Cash and Bank' },
                    isPrepay
                      ? { side: 'Credit', code: '1300', name: 'Vendor Prepayments' }
                      : { side: 'Credit', code: '2000', name: 'Accounts Payable' },
                  ].map((row) => (
                    <div key={row.side} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="inline-flex items-center w-[46px] justify-start px-1 py-px rounded text-[9px] uppercase tracking-wide bg-white/70"
                          style={{ fontWeight: 700, color: THEME.pillText }}
                        >
                          {row.side}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums" style={{ fontWeight: 600 }}>{row.code}</span>
                        <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{row.name}</span>
                      </span>
                      <span className="text-[11px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                        {formatMoney(reversalAmount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — creation-modal chrome: border-t, outline escape +
            solid action, right-aligned. */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            {isPrepay ? 'Reverse prepayment' : 'Reverse payment'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
