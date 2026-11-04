import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { formatMoneyText, MaxChip } from '@/app/components/payments/MoneyInput';
import { Receipt, Upload, X, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export interface AddCreditMemoSubmitPayload {
  creditMemoNumber: string;
  date: string;
  reason: string;
  amount: number;
  description: string;
  fileName?: string;
  notify: boolean;
  notifiedRecipientIds: string[];
}

interface AddCreditMemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoiceType: string;
  /** The account the invoice actually posted to (Eli 9/24 D2): a 6100
   *  standalone credits 6100 back, never a blanket 6000. */
  invoiceGlAccount?: string;
  /** The invoice's OWN A/P account (VI-05): the credit memo debits this
   *  (e.g. 2010), not a hardcoded 2000. */
  invoiceApAccount?: string;
  vendorName: string;
  outstandingBalance: number;
  currency: string;
  /** Open payment run holding this invoice (pre-invoice only, Mahreen
   *  10/10): the credit is allowed, with a warning to lower the run. */
  inRunId?: string;
  onSubmit: (payload: AddCreditMemoSubmitPayload) => void;
}

// Return-based credits left this module (Nophil 9/22): goods going back
// to the vendor settle through RMA, where the return document is the
// proof behind the credit. Only non-return adjustments live here — the
// vendor reduces what is owed without a physical return (Eli's cases).
const REASONS = [
  'Price Adjustment',
  'Billing Error',
  'Overpayment',
  'Other',
];
// A pre-invoice credit lowers the amount REQUESTED, nothing was posted
// or overpaid yet (Mahreen 10/10).
const PRE_INVOICE_REASONS = [
  'Lower Amount Requested',
  'Billing Error',
  'Other',
];

// Neutral money action in the Actions menu, so the modal wears the
// standard primary treatment like the creation flows (tone rev 7/15/26).
const THEME = {
  bg: '#EBF3FF',
  solid: 'hsl(var(--primary))',
  pillText: '#1D4ED8',
};
const LIGHT_TINT = `color-mix(in srgb, ${THEME.bg} 50%, white)`;

function todayIso() {
  return localTodayIso();
}

function formatMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AddCreditMemoModal({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceType,
  invoiceGlAccount,
  invoiceApAccount,
  vendorName,
  outstandingBalance,
  currency,
  inRunId,
  onSubmit,
}: AddCreditMemoModalProps) {
  const isPre = invoiceType === 'Pre-Invoice';
  const reasons = isPre ? PRE_INVOICE_REASONS : REASONS;
  // The vendor supplies their own credit memo number — never prefilled
  // (feedback 7/15/26).
  const [creditMemoNumber, setCreditMemoNumber] = useState('');
  const [date, setDate] = useState(todayIso);
  const [reason, setReason] = useState(reasons[0]);
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  // Notify recipients — same reply-all picker the payment-hold / release
  // confirms use, kept consistent across alert-style actions (Eli 7/24/26).
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  // GL impact moved to a CONFIRM step (user 9/9): the form stays light,
  // the entry shows where the commitment happens.
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

  useEffect(() => {
    if (open) {
      setConfirmOpen(false);
      setDiscardOpen(false);
      closingRef.current = false;
      setCreditMemoNumber('');
      setDate(todayIso());
      setReason(reasons[0]);
      setAmountInput('');
      setDescription('');
      setFile(null);
      setTouched(false);
      setNotify(true);
      setRecipients(new Set());
    }
  }, [open]);

  // GL posting is derived, not picked: the credit memo posts the exact
  // opposite of the invoice's own entry. Debit A/P (the liability goes
  // down), credit the account the invoice originally debited.
  // The invoice's own account wins (Eli 9/24 D2); the type default is
  // only the fallback for records that never carried one.
  const offsetAccount = (() => {
    const t = (invoiceGlAccount || '').trim();
    const code = t.split(/[\s-]/)[0];
    if (code && /^\d{3,4}$/.test(code)) {
      return { code, name: t.slice(code.length).replace(/^[\s·-]+/, '') || 'Invoice Account' };
    }
    return invoiceType === 'Standalone' ? { code: '6000', name: 'Operating Expenses' }
      : invoiceType === 'Pre-Invoice' ? { code: '1205', name: 'Advance Payments' }
      : { code: '1200', name: 'Inventory Asset' };
  })();

  // The debit hits the invoice's OWN A/P account (VI-05): a 2010-AP
  // invoice debits 2010, not a blanket 2000. Same parse as the offset.
  const apAccount = (() => {
    const t = (invoiceApAccount || '').trim();
    const code = t.split(/[\s-]/)[0];
    if (code && /^\d{3,4}$/.test(code)) {
      return { code, name: t.slice(code.length).replace(/^[\s·-]+/, '') || 'Accounts Payable' };
    }
    return { code: '2000', name: 'Accounts Payable' };
  })();

  const amount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const amountError = (() => {
    if (!touched && amountInput === '') return null;
    if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
    if (amount > outstandingBalance) return `Cannot exceed outstanding ${formatMoney(outstandingBalance, currency)}.`;
    return null;
  })();

  const cmNumberError = touched && !creditMemoNumber.trim() ? 'Vendor credit memo number is required.' : null;
  // "Other" must say what it is (global rule, 8/28/26 evening).
  const descriptionRequired = reason === 'Other';
  const descriptionError =
    touched && descriptionRequired && !description.trim() ? '"Other" needs a description.' : null;

  const newOutstanding = Math.max(0, outstandingBalance - (Number.isFinite(amount) ? amount : 0));
  const canSubmit = !amountError && !cmNumberError && amount > 0 && creditMemoNumber.trim().length > 0 && (!descriptionRequired || description.trim().length > 0);

  // Anything typed, picked, or attached beyond the defaults makes the
  // form dirty — outside clicks then warn instead of closing (user 9/22).
  const dirty =
    creditMemoNumber.trim().length > 0 ||
    amountInput !== '' ||
    description.trim().length > 0 ||
    file !== null ||
    reason !== reasons[0] ||
    date !== todayIso() ||
    recipients.size > 0;

  // Create → validate, then the GL-impact confirm (user 9/9); the
  // confirm's own CTA records.
  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) {
      // The toast names the ACTUAL failed condition (GPT QC23, 9/30: an
      // over-limit credit toasted '"Other" needs a description' while
      // Price adjustment was selected).
      if (!creditMemoNumber.trim()) {
        toast.error('Credit memo number required', { description: 'Add the vendor credit memo number first.' });
      } else if (!(amount > 0)) {
        toast.error('Amount required', { description: 'Enter the credit memo amount first.' });
      } else if (amount > outstandingBalance + 0.004) {
        toast.error('Credit cannot exceed the outstanding amount', {
          description: `${formatMoney(outstandingBalance, currency)} is still owed on this invoice. Lower the credit, or use Max to match it.`,
        });
      } else if (reason === 'Other' && !description.trim()) {
        toast.error('Description required', { description: '"Other" needs a description before this can go through.' });
      } else {
        toast.error('Cannot create the credit memo', { description: 'Fix the highlighted field first.' });
      }
      return;
    }
    setConfirmOpen(true);
  };
  const performSubmit = () => {
    closingRef.current = true;
    onSubmit({
      creditMemoNumber: creditMemoNumber.trim(),
      date,
      reason,
      amount,
      description: description.trim(),
      fileName: file?.name,
      notify,
      notifiedRecipientIds: notify ? Array.from(recipients) : [],
    });
    setConfirmOpen(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Pinned-footer column (user 9/9, matching the reversal modal):
        // the body scrolls, the CTAs and the live New-outstanding readout
        // never leave the viewport.
        // One flow-modal width (user 9/9): matches the payment reversal's
        // 680px so the capture modals read as one family.
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[680px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        // Outside-click standard (user 9/22): pristine closes, dirty warns.
        // Nested GL confirm + discard warning are portaled OUTSIDE this
        // content; while either is open their clicks must not raise the
        // discard warning (user 9/23 reversal bug, same anatomy here).
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
              <Receipt className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className="text-[15px] sm:text-[16px] text-foreground"
                style={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                New Credit Memo
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {isPre
                  ? 'Lowers the amount requested on this pre-invoice. Nothing posts to the general ledger.'
                  : 'Reduces the amount owed on this invoice.'}
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

        {/* Body — one stacked column: invoice context card, form fields.
            The settlement readout lives in the FOOTER (user 9/9). */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Invoice</p>
                <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>
                  <span className="" style={{ fontWeight: 600 }}>{invoiceNumber}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  {vendorName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Outstanding</p>
                <p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>{formatMoney(outstandingBalance, currency)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cm-number" className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                Vendor Credit Memo No.
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <Input
                id="cm-number"
                value={creditMemoNumber}
                onChange={(e) => setCreditMemoNumber(e.target.value)}
                className={`h-9 text-[12px] bg-white placeholder:text-slate-400 ${cmNumberError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                placeholder="e.g. CM-4501"
              />
              {cmNumberError && <p className="text-[10px] text-red-600 mt-1">{cmNumberError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Date
              </Label>
              <DatePicker
                id="cm-date"
                value={date}
                onChange={setDate}
                className="!h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-amount" className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                Amount
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              {/* Inset Max chip (user 9/9): the shared fill-to-cap control,
                  same as the credit picker and the run stepper. */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                <Input
                  id="cm-amount"
                  type="text"
                  inputMode="decimal"
                  value={formatMoneyText(amountInput)}
                  onChange={(e) => { setAmountInput(e.target.value.replace(/[^\d.]/g, '')); setTouched(true); }}
                  className={`h-9 text-[12px] pl-7 pr-11 bg-white ${amountError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                  placeholder="0.00"
                />
                <MaxChip
                  onClick={() => { setAmountInput(outstandingBalance.toFixed(2)); setTouched(true); }}
                  atMax={Math.abs(amount - outstandingBalance) < 0.005}
                  over={amount > outstandingBalance + 0.004}
                  title={`Credit the full ${formatMoney(outstandingBalance, currency)}`}
                />
              </div>
              {amountError && <p className="text-[10px] text-red-600 mt-1">{amountError}</p>}
            </div>
          </div>

          {/* Description ∥ Supporting doc (user 9/9, the reversal modal's
              final arrangement); the notify card closes the form solo. */}
          <div className="grid sm:grid-cols-2 gap-3 items-start">
          <div className="space-y-1.5">
            <Label htmlFor="cm-description" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Description
              {descriptionRequired && <span style={{ color: '#DC2626' }}>*</span>}
            </Label>
            <Textarea
              id="cm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={descriptionRequired ? 'Required for Other: what is this credit memo for?' : undefined}
              className={`text-[12px] resize-none bg-white h-[104px] ${descriptionError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
            />
            {descriptionError && <p className="text-[10px] text-red-600 mt-1">{descriptionError}</p>}
          </div>

          {/* Supporting doc — partner-style drop zone. */}
          <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Supporting Doc
              </Label>
              {file ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-white transition-colors shrink-0"
                  aria-label="Remove Attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="cm-file"
                className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-slate-500" />
                </span>
                <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                  <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                </span>
                <span className="text-[10px] text-slate-400">PDF or image up to 10MB</span>
                <input
                  id="cm-file"
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
          </div>

          {/* Notify closes the form, full width (user 9/9): the system's
              one notify interaction. */}
          <NotifyToggleCard
            title="Notify Recipients"
            helper="Tell the people you choose that this credit memo was issued."
            checked={notify}
            onCheckedChange={setNotify}
            selectedIds={recipients}
            onSelectionChange={setRecipients}
            accentColor={THEME.solid}
            accentBg={THEME.bg}
            accentBorder="#BFDBFE"
            accentText={THEME.pillText}
          />
          {/* GL impact lives in the CONFIRM step now (user 9/9): clicking
              Create opens the standard GL-impact confirmation, keeping
              this form's cognitive load down. */}
        </div>

        {/* Footer — pinned: the live New-outstanding readout on the left
            (user 9/9: moved out of the body to cut height), CTAs right. */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <div className="mr-auto min-w-0 text-left">
            <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>New Outstanding</p>
            <p className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 700 }}>
              {formatMoney(newOutstanding, currency)}
              {amount > 0 && (
                <span className="text-[10px] text-slate-400 ml-1.5" style={{ fontWeight: 500 }}>
                  was {formatMoney(outstandingBalance, currency)}
                </span>
              )}
            </p>
          </div>
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
            Create Credit Memo
          </button>
        </div>
      </DialogContent>

      {/* GL-impact confirm (user 9/9): the standard emerald confirmation
          the other money actions use — the form stays light, the entry
          shows where the commitment happens. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          <div
            className="relative flex flex-col items-center pt-9 pb-5"
            style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(255,255,255,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#047857' }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
              <Receipt className="w-7 h-7" style={{ color: '#047857' }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857',  }}>
              Confirm Credit Memo
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Create credit memo for {formatMoney(amount, currency)}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-[12px] text-slate-500 mt-1.5">
              {invoiceNumber} drops to {formatMoney(newOutstanding, currency)} outstanding.
            </p>
            {isPre && inRunId && (
              <div className="w-full mt-4 text-left rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                  This pre-invoice is in a payment run. Lower the run amount to {formatMoney(newOutstanding, currency)} before it is paid.
                </p>
              </div>
            )}
            {/* A pre-invoice credit always says it posts nothing (Mahreen
                10/10), whatever the GL-on-confirmations setting. */}
            {(showGlOnConfirmations || isPre) && (
              <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                  <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>GL Impact</p>
                </div>
                {isPre ? (
                  /* No GL lines for a pre-invoice credit (Mahreen 10/10):
                     nothing has posted, so nothing reverses. */
                  <div>
                    <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>No accounting entry</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">A pre-invoice posts nothing until it is paid.</p>
                  </div>
                ) : (
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
                        {[
                          { code: apAccount.code, name: apAccount.name, debit: amount, credit: 0 },
                          { code: offsetAccount.code, name: offsetAccount.name, debit: 0, credit: amount },
                        ].map((row) => (
                          <tr key={row.code} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-1.5">
                              <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{row.code}</span>
                              <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{row.name}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right ">{row.debit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(row.debit, currency)}</span> : null}</td>
                            <td className="px-3 py-1.5 text-right ">{row.credit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(row.credit, currency)}</span> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50/70">
                          <td className="px-3 py-1.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                              <CheckCircle2 className="w-2.5 h-2.5" /> Debit = Credit
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{formatMoney(amount, currency)}</td>
                          <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{formatMoney(amount, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
            <div className="w-full mt-5 flex flex-col gap-2.5">
              <button
                onClick={performSubmit}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
              >
                Create Credit Memo
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
        what="this credit memo"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
