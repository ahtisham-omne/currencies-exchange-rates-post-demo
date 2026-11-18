import { formatMoney as moneyIn } from '@/app/currency/money';
import { useEffect, useMemo, useState } from 'react';
import { localISODate } from '@/app/data/mockRMAs';
import { Receipt, Upload, X, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
  vendorName: string;
  outstandingBalance: number;
  currency: string;
  onSubmit: (payload: AddCreditMemoSubmitPayload) => void;
}

const REASONS = [
  'Price adjustment',
  'Return',
  'Damaged goods',
  'Billing error',
  'Overpayment',
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
  return localISODate(new Date());
}

function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

export function AddCreditMemoModal({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceType,
  vendorName,
  outstandingBalance,
  currency,
  onSubmit,
}: AddCreditMemoModalProps) {
  // The vendor supplies their own credit memo number — never prefilled
  // (feedback 7/15/26).
  const [creditMemoNumber, setCreditMemoNumber] = useState('');
  const [date, setDate] = useState(todayIso);
  const [reason, setReason] = useState(REASONS[0]);
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  // Notify recipients — same reply-all picker the payment-hold / release
  // confirms use, kept consistent across alert-style actions (Eli 7/24/26).
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setCreditMemoNumber('');
      setDate(todayIso());
      setReason(REASONS[0]);
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
  const offsetAccount =
    invoiceType === 'Standalone' ? { code: '6000', name: 'Operating Expenses' }
    : invoiceType === 'Pre-Invoice' ? { code: '1205', name: 'Vendor Prepayments' }
    : { code: '1200', name: 'Inventory Asset' };

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

  const newOutstanding = Math.max(0, outstandingBalance - (Number.isFinite(amount) ? amount : 0));
  const canSubmit = !amountError && !cmNumberError && amount > 0 && creditMemoNumber.trim().length > 0;

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
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
              <Receipt className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className="text-[15px] sm:text-[16px] text-foreground"
                style={{ fontWeight: 700, lineHeight: 1.3 }}
              >
                New credit memo
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                Reduces the amount owed on this invoice.
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
            then the live settlement preview. */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left">
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Invoice</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cm-number" className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                Vendor credit memo no.
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <Input
                id="cm-number"
                value={creditMemoNumber}
                onChange={(e) => setCreditMemoNumber(e.target.value)}
                className={`h-9 text-[12px] tabular-nums bg-white placeholder:text-slate-400 ${cmNumberError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
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
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cm-amount" className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                  Amount
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
                {/* Click-to-fill (feedback 7/21/26): one click credits the
                    full outstanding balance, no manual typing. */}
                <button
                  type="button"
                  onClick={() => { setAmountInput(outstandingBalance.toFixed(2)); setTouched(true); }}
                  className="text-[10px] hover:underline cursor-pointer"
                  style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}
                  title="Credit the full outstanding balance"
                >
                  Max {formatMoney(outstandingBalance, currency)}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 tabular-nums">$</span>
                <Input
                  id="cm-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => { setAmountInput(e.target.value); setTouched(true); }}
                  className={`h-9 text-[12px] tabular-nums pl-7 bg-white ${amountError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                  placeholder="0.00"
                />
              </div>
              {amountError && <p className="text-[10px] text-red-600 mt-1">{amountError}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-description" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Description <span className="text-slate-400" style={{ fontWeight: 400 }}>(optional)</span>
            </Label>
            <Textarea
              id="cm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-[12px] resize-none bg-white"
            />
          </div>

          {/* Notify recipients — same reply-all picker as payment hold /
              release, so alert-style actions stay consistent (Eli 7/24/26). */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5 cursor-pointer">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[12px] text-foreground" style={{ fontWeight: 600 }}>Notify recipients</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Tell the people you choose that this credit memo was issued. Optional.
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
                label="Notify on credit memo"
              />
            )}
          </div>

          {/* Supporting doc — always the last block, partner-style drop zone. */}
          <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Supporting doc <span className="text-slate-400" style={{ fontWeight: 400 }}>(optional)</span>
              </Label>
              {file ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{(file.size / 1024).toFixed(1)} KB</span>
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
                htmlFor="cm-file"
                className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-slate-500" />
                </span>
                <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
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
          {/* Live settlement preview — reduced balance plus the entry the
              credit memo posts, the exact opposite of the invoice's own. */}
          <div
            className="rounded-xl px-3.5 py-3"
            style={{ backgroundColor: LIGHT_TINT, border: `1px solid color-mix(in srgb, ${THEME.solid} 12%, transparent)` }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
              New outstanding
            </p>
            <p className="text-[15px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700 }}>
              {formatMoney(newOutstanding, currency)}
              {amount > 0 && (
                <span className="text-[10px] text-slate-500 ml-1.5" style={{ fontWeight: 500 }}>
                  (was {formatMoney(outstandingBalance, currency)})
                </span>
              )}
            </p>
            {amount > 0 && !amountError && invoiceType === 'Pre-Invoice' && (
              <div className="mt-2 pt-2" style={{ borderTop: `1px solid color-mix(in srgb, ${THEME.solid} 14%, transparent)` }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
                  GL impact
                </p>
                {/* A pre-invoice hasn't posted yet — the credit memo just
                    reduces its amount (lifecycle spec 7/15/26). */}
                <p className="text-[11px] text-slate-500 leading-snug mt-1">
                  Reduces the pre-invoice amount. No GL effect until the invoice posts at receiving.
                </p>
              </div>
            )}
            {amount > 0 && !amountError && invoiceType !== 'Pre-Invoice' && (
              <div className="mt-2 pt-2 space-y-1" style={{ borderTop: `1px solid color-mix(in srgb, ${THEME.solid} 14%, transparent)` }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: THEME.pillText }}>
                  GL impact
                </p>
                {[
                  { side: 'Debit', code: '2000', name: 'Accounts Payable' },
                  { side: 'Credit', code: offsetAccount.code, name: offsetAccount.name },
                ].map((row) => (
                  <div key={row.side} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-flex items-center w-[46px] justify-start px-1 py-px rounded text-[10px] uppercase tracking-wide bg-white/70"
                        style={{ fontWeight: 700, color: THEME.pillText }}
                      >
                        {row.side}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums" style={{ fontWeight: 600 }}>{row.code}</span>
                      <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{row.name}</span>
                    </span>
                    <span className="text-[11px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                      {formatMoney(amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            Create credit memo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
