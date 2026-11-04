import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { localTodayIso } from '@/app/lib/dueBucket';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import { BadgePercent, Banknote, X } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { DatePicker } from '@/app/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import { netDue } from '@/app/data/ar/customerInvoiceStatus';

// Record-receipt — flat-chrome form modal (spec §7.2). Auto-selects
// mode from docKind: an Advance Invoice records a customer DEPOSIT (advance,
// held as a liability); everything else records a CASH APPLICATION
// against the invoice, with a live running-balance readout.

export interface RecordReceiptModalProps {
  /** docKind 'Advance Invoice' → DEPOSIT mode; else CASH APPLICATION mode. */
  invoice: CustomerInvoice;
  onClose: () => void;
  /** Cash-application mode. */
  onRecordReceipt: (payload: {
    date: string;
    method: string;
    reference: string;
    amount: number;
    markDisputed?: boolean;
    overpaymentToDeposit?: number;
  }) => void;
  /** Advance invoice deposit mode. */
  onRecordDeposit: (payload: {
    date: string;
    method: string;
    reference: string;
    amount: number;
  }) => void;
}

const THEME = {
  bg: '#EBF3FF',
  solid: 'hsl(var(--primary))',
};

const METHODS = ['ACH', 'Wire', 'Check', 'Card', 'Cash'];

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Pricing rules (premiums and discounts) already inside the invoice's SO
 *  prices, summed per rule across its lines. Shown at the payment like
 *  vendor payments show discounts (user 11/3), not on the invoice lines. */
function pricingRulesOf(invoice: CustomerInvoice) {
  const byRule = new Map<string, { rule: string; kind: 'Premium' | 'Discount'; percent?: number; amount: number }>();
  for (const l of invoice.lines ?? []) {
    for (const r of l.pricingAdjustments ?? []) {
      const row = byRule.get(r.rule) ?? { rule: r.rule, kind: r.kind, percent: r.percent, amount: 0 };
      row.amount = Math.round((row.amount + r.perUnit * l.invoiceQty) * 100) / 100;
      byRule.set(r.rule, row);
    }
  }
  return [...byRule.values()].filter((r) => Math.abs(r.amount) > 0.004);
}

function PricingRulesRow({ invoice }: { invoice: CustomerInvoice }) {
  const rules = pricingRulesOf(invoice);
  if (rules.length === 0) return null;
  const premium = rules.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const discount = rules.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  return (
    <div className="rounded-xl border border-border bg-white px-3.5 py-2.5 flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Pricing Rules</span>
      <HoverCard openDelay={250} closeDelay={120}>
        <HoverCardTrigger asChild>
          <span className="inline-flex items-center gap-1.5 cursor-help">
            {premium > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[10.5px] bg-amber-50 border-amber-200 text-amber-700" style={{ fontWeight: 500 }}>
                <BadgePercent className="w-3 h-3" />
                Premium +{fmt(premium)}
              </span>
            )}
            {discount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[10.5px] bg-emerald-50 border-emerald-200 text-emerald-700" style={{ fontWeight: 500 }}>
                <BadgePercent className="w-3 h-3" />
                Discount −{fmt(discount)}
              </span>
            )}
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="top" align="end" className="w-[280px] p-3 bg-white border border-border rounded-lg shadow-md z-[400]">
          <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Pricing Rules on {invoice.invoiceNumber}</p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Already inside the invoice amount, so the balance due does not change.</p>
          <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-[11px]">
            {rules.map((r, i) => (
              <div key={r.rule} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                <span className="text-foreground truncate" style={{ fontWeight: 500 }}>
                  {r.rule}
                  {r.percent !== undefined ? <span className="text-slate-400" style={{ fontWeight: 400 }}> · {Math.abs(r.percent)}%</span> : null}
                </span>
                <span className={r.amount < 0 ? 'text-emerald-700' : 'text-amber-700'} style={{ fontWeight: 500 }}>
                  {r.amount < 0 ? '−' : '+'}
                  {fmt(Math.abs(r.amount))}
                </span>
              </div>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

function todayIso() {
  return localTodayIso();
}

export function RecordReceiptModal({
  invoice,
  onClose,
  onRecordReceipt,
  onRecordDeposit,
}: RecordReceiptModalProps) {
  const isDeposit = invoice.docKind === 'Advance Invoice';
  const balanceDue = isDeposit ? invoice.amount : netDue(invoice);

  const [date, setDate] = useState(todayIso);
  const [method, setMethod] = useState('ACH');
  const [reference, setReference] = useState('');
  const [amountInput, setAmountInput] = useState(() => balanceDue.toFixed(2));
  const [markDisputed, setMarkDisputed] = useState(false);
  // Never-disabled CTA (9/23 rule, ported in the 9/25 AR parity pass):
  // clicking while invalid highlights the gap in red and toasts the fix.
  const [showErrors, setShowErrors] = useState(false);

  const amount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const canSubmit = amount > 0 && !!date;

  // Cash-mode running-balance state.
  const short = amount > 0 && amount < balanceDue - 0.004;
  const exact = amount > 0 && Math.abs(amount - balanceDue) <= 0.004;
  const over = amount > balanceDue + 0.004;
  const remaining = Math.max(0, balanceDue - amount);
  const overpayment = Math.max(0, amount - balanceDue);

  const handleSubmit = () => {
    if (!canSubmit) {
      setShowErrors(true);
      if (!date) {
        toast.error(isDeposit ? 'Deposit date required' : 'Payment date required', {
          description: 'Pick the date the money was received before recording.',
        });
        const el = document.getElementById('rr-date');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
        return;
      }
      toast.error('Amount required', { description: 'Enter the amount received before recording.' });
      const el = document.getElementById('rr-amount');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      return;
    }
    if (isDeposit) {
      onRecordDeposit({ date, method, reference, amount });
    } else {
      onRecordReceipt({
        date,
        method,
        reference,
        amount,
        markDisputed: short ? markDisputed : undefined,
        overpaymentToDeposit: over ? overpayment : undefined,
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        // The vendor form-modal chrome: flat header, body scrolls, pinned footer.
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Header — flat chrome: tinted icon chip, title + subtitle, close X. */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: THEME.bg }}
            >
              <Banknote className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                {isDeposit ? 'Record Customer Deposit' : 'Record Payment'}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {isDeposit
                  ? `Record the advance received against ${invoice.invoiceNumber}.`
                  : `Apply a receipt against ${invoice.invoiceNumber}.`}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — one stacked column. */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left flex-1 min-h-0 overflow-y-auto">
          {/* Balance-due readout */}
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] px-3.5 py-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>
              {isDeposit ? 'Advance Requested' : 'Balance Due'}
            </span>
            <span className="text-[15px] text-foreground " style={{ fontWeight: 700 }}>
              {fmt(balanceDue)}
            </span>
          </div>

          {!isDeposit && <PricingRulesRow invoice={invoice} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rr-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                {isDeposit ? 'Deposit Date' : 'Payment Date'}
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <DatePicker
                id="rr-date"
                value={date}
                onChange={(v) => { setDate(v); setShowErrors(false); }}
                className="!h-9"
                error={showErrors && !date}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Method
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rr-reference" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Reference
              </Label>
              <Input
                id="rr-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-9 text-[12px] bg-white placeholder:text-slate-400"
                placeholder="e.g. ACH trace"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-amount" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Amount
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                <Input
                  id="rr-amount"
                  type="text"
                  inputMode="decimal"
                  value={formatMoneyText(amountInput)}
                  onChange={(e) => { setAmountInput(e.target.value.replace(/[^\d.]/g, '')); setShowErrors(false); }}
                  className={`h-9 text-[12px] pl-7 bg-white ${
                    showErrors && amount <= 0 ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100' : ''
                  }`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {isDeposit ? (
            /* Deposit mode — muted liability note. */
            <div className="rounded-xl px-3.5 py-3 bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500 leading-snug">
                Held as a customer deposit (liability) until the shipment invoice is raised.
              </p>
            </div>
          ) : (
            /* Cash mode — live resulting-state note. */
            <>
              {short && (
                <div className="rounded-xl px-3.5 py-3 bg-amber-50 border border-amber-200 space-y-2.5">
                  <p className="text-[12px] text-amber-700 leading-snug" style={{ fontWeight: 500 }}>
                    Short payment · {fmt(remaining)} will remain open
                  </p>
                  <label htmlFor="rr-disputed" className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id="rr-disputed"
                      checked={markDisputed}
                      onCheckedChange={(v) => setMarkDisputed(v === true)}
                    />
                    <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                      Mark This Invoice as Disputed
                    </span>
                  </label>
                </div>
              )}
              {exact && (
                <div className="rounded-xl px-3.5 py-3 bg-emerald-50 border border-emerald-200">
                  <p className="text-[12px] text-emerald-700 leading-snug" style={{ fontWeight: 500 }}>
                    Settles the invoice in full.
                  </p>
                </div>
              )}
              {over && (
                <div className="rounded-xl px-3.5 py-3 bg-blue-50 border border-blue-200">
                  <p className="text-[12px] text-blue-700 leading-snug" style={{ fontWeight: 500 }}>
                    Overpayment · {fmt(overpayment)} will be held as a customer deposit.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — outline escape + solid action, right aligned. */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {/* Never disabled (9/23 rule): clicking while invalid highlights
              the missing field and toasts the exact fix. */}
          <Button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-4 text-[13px] shadow-sm rounded-lg border-0 hover:opacity-90"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            {isDeposit ? 'Record Deposit' : 'Record Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
