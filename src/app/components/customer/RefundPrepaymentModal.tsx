import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDown, ArrowUp, FileText, Package, Undo2, Wallet, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { MaxChip, MoneyInput } from '@/app/components/payments/MoneyInput';
import { formatUsDate, localTodayIso } from '@/app/lib/dueBucket';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { depositRemaining, treatmentOf } from '@/app/data/ar/customerInvoiceStatus';
import { COGS_ACCOUNT, CUSTOMER_DEPOSITS_ACCOUNT, DEFAULT_REVENUE_ACCOUNT, INVENTORY_ACCOUNT, splitGlAccount } from '@/app/data/ar/arGlAccounts';
import { lineCostOf } from '@/app/data/ar/mockCustomers';
import type { RefundPrepaymentPayload } from '@/app/hooks/useCustomerInvoicing';

/* ════════════════════════════════════════════════════════════════════
   Refund or reverse a prepayment (FAD 11/2). The AR copy of the vendor
   ReversePaymentModal: 680px creation chrome with the rose Undo2 chip,
   then a nested 440px gradient-hero GL confirm.
     Deposit pre-invoice → Refund Prepayment: Dr Customer Deposits, Cr Cash.
     Revenue pre-invoice → Reverse and Refund: reverses the revenue,
       releases the locked units, then refunds (two entries).
   ════════════════════════════════════════════════════════════════════ */

/** Bank the refund leaves from (prototype default). */
export const REFUND_CASH_ACCOUNT = '1010 Operating Bank';

const REASONS = ['Customer cancelled order', 'Order changed', 'Duplicate payment', 'Other'];

const THEME = { bg: '#FFF1F2', solid: '#E11D48', pillText: '#BE123C', border: '#FECDD3' };

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number, currency: string) =>
  `${currency === 'USD' ? '$' : `${currency} `}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface GlRow { account: string; debit: number; credit: number }

/** The entries a refund posts, by treatment. Exported for the GL Impact tab. */
export function refundGlEntries(invoice: CustomerInvoice, amount: number): Array<{ title: string; rows: GlRow[] }> {
  const revenueAccount = invoice.lines.find((l) => l.glAccount)?.glAccount || DEFAULT_REVENUE_ACCOUNT;
  if (treatmentOf(invoice) === 'Revenue') {
    return [
      { title: 'Reverse Revenue', rows: [{ account: revenueAccount, debit: amount, credit: 0 }, { account: invoice.arAccount, debit: 0, credit: amount }] },
      // Mahreen 11/4: the cost posted with the revenue comes back with the units.
      ...(() => {
        const cost = invoice.lines.reduce((a, l) => a + lineCostOf(l), 0);
        const share = invoice.amount > 0 ? Math.min(1, amount / invoice.amount) : 0;
        const back = Math.round(cost * share * 100) / 100;
        return back > 0.004
          ? [{ title: 'Reverse Cost', rows: [{ account: INVENTORY_ACCOUNT, debit: back, credit: 0 }, { account: COGS_ACCOUNT, debit: 0, credit: back }] }]
          : [];
      })(),
      { title: 'Refund', rows: [{ account: invoice.arAccount, debit: amount, credit: 0 }, { account: REFUND_CASH_ACCOUNT, debit: 0, credit: amount }] },
    ];
  }
  return [
    {
      title: 'Refund',
      rows: [
        { account: invoice.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT, debit: amount, credit: 0 },
        { account: REFUND_CASH_ACCOUNT, debit: 0, credit: amount },
      ],
    },
  ];
}

function GlMiniTable({ rows, currency }: { rows: GlRow[]; currency: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="px-3 py-1.5 text-left text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Account</th>
            <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Debit</th>
            <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { code, name } = splitGlAccount(row.account);
            const isDebit = row.debit > 0;
            const debitNormal = code.startsWith('1') || code.startsWith('5') || code.startsWith('6');
            const up = debitNormal ? isDebit : !isDebit;
            return (
              <tr key={`${row.account}-${isDebit ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-1.5">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{code}</span>
                  <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{name}</span>
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
                <td className="px-3 py-1.5 text-right">{row.debit > 0 ? <span style={{ fontWeight: 500 }}>{money(row.debit, currency)}</span> : null}</td>
                <td className="px-3 py-1.5 text-right">{row.credit > 0 ? <span style={{ fontWeight: 500 }}>{money(row.credit, currency)}</span> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RefundPrepaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CustomerInvoice;
  /** Deposits received against this pre-invoice. */
  deposits: CustomerDeposit[];
  onSubmit: (payload: RefundPrepaymentPayload) => void;
}

export function RefundPrepaymentModal({ open, onOpenChange, invoice, deposits, onSubmit }: RefundPrepaymentModalProps) {
  const revenue = treatmentOf(invoice) === 'Revenue';
  const actionLabel = revenue ? 'Reverse and Refund' : 'Refund Prepayment';
  const currency = invoice.currency;
  const refundable = useMemo(() => deposits.filter((d) => depositRemaining(d) > 0.004), [deposits]);

  const [depositId, setDepositId] = useState('');
  const [date, setDate] = useState(localTodayIso());
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [memo, setMemo] = useState('');
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const first = refundable[0];
    setDepositId(first?.id ?? '');
    setDate(localTodayIso());
    setAmount(first ? depositRemaining(first) : 0);
    setReason(REASONS[0]);
    setMemo('');
    setNotify(true);
    setRecipients(new Set());
    setConfirmOpen(false);
    setDiscardOpen(false);
    setAttempted(false);
    closingRef.current = false;
  }, [open, refundable]);

  const selected = refundable.find((d) => d.id === depositId) ?? null;
  const remaining = selected ? depositRemaining(selected) : 0;
  const over = amount > remaining + 0.004;
  const memoRequired = reason === 'Other';
  const remainingAfter = Math.max(0, r2(remaining - amount));
  const entries = refundGlEntries(invoice, r2(amount));

  const dirty = memo.trim().length > 0 || recipients.size > 0 || reason !== REASONS[0] || date !== localTodayIso() || (!!selected && Math.abs(amount - remaining) > 0.004);

  // Never-disabled CTA (9/23): the click names the missing piece.
  const handleSubmit = () => {
    setAttempted(true);
    if (!selected) {
      toast.error('Pick the prepayment to refund');
      return;
    }
    if (!date) {
      toast.error('Refund date required', { description: 'Pick the date the refund posts.' });
      return;
    }
    if (!(amount > 0.004)) {
      toast.error('Enter the amount to refund');
      return;
    }
    if (over) {
      toast.error(`Cannot refund more than ${money(remaining, currency)}`, { description: 'Use Max to refund everything still held.' });
      return;
    }
    if (memoRequired && !memo.trim()) {
      toast.error('Memo required', { description: '"Other" needs a memo before this can go through.' });
      return;
    }
    setConfirmOpen(true);
  };

  const performSubmit = () => {
    if (!selected) return;
    closingRef.current = true;
    onSubmit({
      depositId: selected.id,
      amount: r2(amount),
      date,
      reason,
      memo: memo.trim(),
      notifiedRecipientIds: notify ? Array.from(recipients) : undefined,
    });
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const guardClose = (e: Event) => {
    if (closingRef.current || confirmOpen || discardOpen) {
      e.preventDefault();
      return;
    }
    if (dirty) {
      e.preventDefault();
      setDiscardOpen(true);
    }
  };

  const fieldLabel = 'text-[11px] text-slate-500 flex items-center gap-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[680px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onInteractOutside={guardClose}
        onEscapeKeyDown={guardClose}
      >
        {/* Header: creation-modal chrome, rose Undo2 chip. */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
              <Undo2 className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 500, lineHeight: 1.3 }}>
                {actionLabel} · {invoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500 truncate" style={{ lineHeight: 1.5 }}>
                {revenue
                  ? 'Reverses revenue, releases the units, then refunds.'
                  : `Returns money held in Customer Deposits to ${invoice.customer.replace(/\.$/, "")}.`}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (dirty ? setDiscardOpen(true) : onOpenChange(false))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left flex-1 min-h-0 overflow-y-auto">
          {refundable.length === 0 ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-amber-900" style={{ fontWeight: 500 }}>Nothing left to refund.</p>
                <p className="text-[11px] text-amber-800/80 mt-0.5">Every prepayment on this advance invoice was applied or refunded already.</p>
              </div>
            </div>
          ) : (
            <>
              {/* 1 · Prepayment */}
              <div className="space-y-1.5">
                <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                  Prepayment
                  <span style={{ color: '#DC2626' }}>*</span>
                </Label>
                <Select
                  value={depositId}
                  onValueChange={(v) => {
                    setDepositId(v);
                    const d = refundable.find((x) => x.id === v);
                    setAmount(d ? depositRemaining(d) : 0);
                  }}
                >
                  <SelectTrigger className="h-9 text-[12px] bg-white [&>span]:min-w-0">
                    <SelectValue placeholder="Select a prepayment" />
                  </SelectTrigger>
                  <SelectContent className="z-[400]">
                    {refundable.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-[12px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{d.depositNumber}</span>
                          <span className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-white text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{formatUsDate(d.receivedDate)}</span>
                          <span className="text-foreground" style={{ fontWeight: 500 }}>{money(depositRemaining(d), currency)} remaining</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2 · Impact */}
              <div className="grid sm:grid-cols-2 gap-3 items-stretch">
                <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                      <Wallet className="w-4 h-4" style={{ color: THEME.solid }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Received Against</p>
                      <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>{invoice.invoiceNumber} · {invoice.customer}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Received</span>
                      <span className="text-foreground" style={{ fontWeight: 500 }}>{money(selected?.amount ?? 0, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Still Held</span>
                      <span className="text-foreground" style={{ fontWeight: 500 }}>{money(remaining, currency)}</span>
                    </div>
                  </div>
                  {revenue && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-500">
                      <Package className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      Units locked to this invoice are released back to stock.
                    </div>
                  )}
                </div>
                <div className="rounded-xl px-3.5 py-3 min-w-0 bg-white" style={{ border: `1px solid ${THEME.border}` }}>
                  <p className="text-[10px] tracking-wider" style={{ fontWeight: 500, color: THEME.pillText }}>After {revenue ? 'Reversal' : 'Refund'}</p>
                  <p className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>
                    {money(remainingAfter, currency)}
                    <span className="text-[10px] ml-1.5 text-slate-500" style={{ fontWeight: 500 }}>· still held</span>
                  </p>
                  <div className="mt-2 pt-2 space-y-2 border-t border-slate-100">
                    {entries.map((e) => (
                      <div key={e.title} className="space-y-1">
                        <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{entries.length > 1 ? `GL Impact · ${e.title}` : 'GL Impact'}</p>
                        {e.rows.map((row) => {
                          const { code, name } = splitGlAccount(row.account);
                          const side = row.debit > 0 ? 'Debit' : 'Credit';
                          return (
                            <div key={`${side}-${code}`} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span className="inline-flex items-center w-[46px] justify-center px-1 py-px rounded text-[9px] bg-slate-100 text-slate-600" style={{ fontWeight: 500 }}>{side}</span>
                                <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{code}</span>
                                <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{name}</span>
                              </span>
                              <span className="text-[11px] text-foreground shrink-0" style={{ fontWeight: 500 }}>{money(row.debit || row.credit, currency)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3 · Date ∥ Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="refund-date" className={fieldLabel} style={{ fontWeight: 500 }}>
                    Refund Date
                    <span style={{ color: '#DC2626' }}>*</span>
                  </Label>
                  <DatePicker id="refund-date" value={date} onChange={setDate} className="!h-9" error={attempted && !date} />
                  {attempted && !date && <p className="text-[10px] text-red-600">Refund date is missing.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                    Refund Amount
                    <span style={{ color: '#DC2626' }}>*</span>
                  </Label>
                  {/* Over the cap never silently caps: rose ring + tooltip, Max fixes it. */}
                  <Tooltip open={over ? undefined : false} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div
                        className={`relative flex items-center h-9 rounded-md border bg-white pl-3 pr-11 ${
                          over || (attempted && !(amount > 0.004)) ? 'border-rose-400 ring-2 ring-rose-100' : 'border-input focus-within:border-primary'
                        }`}
                      >
                        <span className="text-[12px] text-slate-400 mr-1">{currency === 'USD' ? '$' : currency}</span>
                        <MoneyInput value={amount} onValueChange={setAmount} fluid className="flex-1 h-full bg-transparent outline-none text-[12px]" />
                        <MaxChip
                          onClick={() => setAmount(remaining)}
                          atMax={Math.abs(amount - remaining) < 0.005}
                          over={over}
                          title={`Refund the full ${money(remaining, currency)}`}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[400] max-w-[240px] text-[11px]">
                      Only {money(remaining, currency)} is still held. Use Max to refund all of it.
                    </TooltipContent>
                  </Tooltip>
                  {over && <p className="text-[10px] text-rose-600">Cannot exceed {money(remaining, currency)} still held.</p>}
                </div>
              </div>

              {/* 4 · Reason */}
              <div className="space-y-1.5">
                <Label className={fieldLabel} style={{ fontWeight: 500 }}>
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

              {/* 5 · Memo */}
              <div className="space-y-1.5">
                <Label htmlFor="refund-memo" className={fieldLabel} style={{ fontWeight: 500 }}>
                  Memo
                  {memoRequired && <span style={{ color: '#DC2626' }}>*</span>}
                </Label>
                <Textarea
                  id="refund-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  placeholder={memoRequired ? 'Explain why this prepayment is being refunded.' : undefined}
                  className={`text-[12px] resize-none bg-white ${memoRequired && attempted && !memo.trim() ? 'border-red-300 focus-visible:ring-red-100' : ''}`}
                />
                {memoRequired && attempted && !memo.trim() && (
                  <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>A memo is required when the reason is Other.</p>
                )}
              </div>

              {/* 6 · Notify people */}
              <NotifyToggleCard
                title="Notify People"
                helper={`Tell the people you choose that this prepayment was ${revenue ? 'reversed and refunded' : 'refunded'}.`}
                checked={notify}
                onCheckedChange={setNotify}
                selectedIds={recipients}
                onSelectionChange={setRecipients}
                accentColor={THEME.solid}
                accentBg={THEME.bg}
                accentBorder={THEME.border}
                accentText={THEME.pillText}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={() => (dirty ? setDiscardOpen(true) : onOpenChange(false))}
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
            {actionLabel}
          </button>
        </div>
      </DialogContent>

      {/* GL confirm: 440px gradient hero, the reversal's rose. */}
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
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: THEME.border }}>
              <Undo2 className="w-7 h-7" style={{ color: THEME.pillText }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 500, backgroundColor: THEME.bg, color: THEME.pillText }}>
              {revenue ? 'Confirm Reversal' : 'Confirm Refund'}
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 500, lineHeight: 1.3 }}>
                {revenue ? 'Reverse and refund' : 'Refund'} {money(r2(amount), currency)}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-[12px] text-slate-500 mt-1.5">
              {revenue
                ? `Revenue on ${invoice.invoiceNumber} is reversed, the units go back to stock, and the money returns to ${invoice.customer}. Dated ${formatUsDate(date)}.`
                : `The money leaves Customer Deposits and returns to ${invoice.customer}. Dated ${formatUsDate(date)}.`}
            </p>
            <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5 space-y-2">
              {entries.map((e, i) => (
                <div key={e.title}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                    <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                      {entries.length > 1 ? `GL Impact · ${i + 1}. ${e.title}` : 'GL Impact'}
                    </p>
                  </div>
                  <GlMiniTable rows={e.rows} currency={currency} />
                </div>
              ))}
            </div>
            <div className="w-full mt-5 flex flex-col gap-2.5">
              <button
                onClick={performSubmit}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
              >
                {actionLabel}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100 text-slate-700"
                style={{ fontWeight: 500 }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardConfirm
        open={discardOpen}
        what="this refund"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
