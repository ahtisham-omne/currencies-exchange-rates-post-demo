import { AlertCircle, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent as _AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { CUSTOMER_DEPOSITS_ACCOUNT, splitGlAccount } from '@/app/data/ar/arGlAccounts';
import { money, type GlRow } from './formModel';

const AlertDialogContent = _AlertDialogContent as unknown as React.FC<any>;

// Fork of the vendor submit confirmation (CreateInvoiceScreen,
// showSubmitWarning): gradient hero with the chip, centered title + how
// it works, "What are the implications" card, the price-change card,
// the GL impact table with the balanced footer, sticky CTAs. Variants
// are the AR ones: submit (blue), approve (emerald), resubmit after a
// rejection (emerald), advance (nothing posts, preview at payment).

export interface PriceChange {
  sku: string;
  from: number;
  to: number;
}

type Variant = {
  chipLabel: string;
  chipBg: string;
  chipText: string;
  glowColor: string;
  tileBg: string;
  tileIconColor: string;
  title: string;
  howItWorks: string;
  implications: string;
  primaryLabel: string;
  primaryBg: string;
};

export function ArSubmitConfirm({
  open,
  onOpenChange,
  mode,
  isAdvance,
  isResubmit,
  isPendingEdit,
  termName,
  currency,
  total,
  glRows,
  dr,
  cr,
  balanced,
  priceChanges,
  releaseNote,
  depositAccount,
  advanceRevenue,
  treatmentNote,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'submit' | 'approve';
  isAdvance: boolean;
  isResubmit: boolean;
  isPendingEdit: boolean;
  termName: string;
  currency: string;
  total: number;
  glRows: GlRow[];
  dr: number;
  cr: number;
  balanced: boolean;
  priceChanges: PriceChange[];
  releaseNote?: string;
  depositAccount: string;
  /** FAD 11/2: an advance booked as Revenue posts at approval like an invoice. */
  advanceRevenue?: boolean;
  /** FAD 11/2: why a Revenue pick posts as a Deposit (revenue gate). */
  treatmentNote?: string;
  onConfirm: () => void;
}) {
  const approve = mode === 'approve';
  const variant: Variant = (() => {
    if (isAdvance) {
      return {
        chipLabel: approve ? 'Confirm Approval' : 'Confirm Submission',
        chipBg: approve ? '#ECFDF5' : '#EBF3FF',
        chipText: approve ? '#047857' : '#0654BC',
        glowColor: approve ? '#047857' : '#0A77FF',
        tileBg: approve ? '#D1FAE5' : '#D6E8FF',
        tileIconColor: approve ? '#047857' : '#0654BC',
        title: approve ? 'Approve this advance invoice?' : 'Submit this advance invoice for approval?',
        howItWorks: approve
          ? 'The advance invoice is approved and can be sent to the customer.'
          : 'This advance invoice will be sent to the approvers. Once approved, it can be sent to the customer.',
        implications:
          'Revenue on shipment. The invoice posts as a pre-invoice and nothing reaches revenue. When the customer pays, the payment goes to customer prepayment; when the goods ship, revenue posts for what shipped and the prepayment is applied.',
        primaryLabel: approve ? 'Approve Advance Invoice' : 'Submit Advance Invoice for Approval',
        primaryBg: approve ? '#047857' : 'hsl(var(--primary))',
      };
    }
    if (advanceRevenue) {
      return {
        chipLabel: approve ? 'Confirm Approval' : 'Confirm Submission',
        chipBg: approve ? '#ECFDF5' : '#EBF3FF',
        chipText: approve ? '#047857' : '#0654BC',
        glowColor: approve ? '#047857' : '#0A77FF',
        tileBg: approve ? '#D1FAE5' : '#D6E8FF',
        tileIconColor: approve ? '#047857' : '#0654BC',
        title: approve ? 'Approve this advance invoice?' : 'Submit this advance invoice for approval?',
        howItWorks: approve
          ? 'Revenue and cost post to the General Ledger now, and it can be sent to the customer.'
          : 'It goes to your approvers. Once approved, revenue and cost post to the General Ledger.',
        implications:
          'Revenue on invoice. Revenue and cost post together, and the locked units move out of available stock as a hard allocation. When the customer pays, the payment settles this invoice; when the goods ship, the shipment uses the locked units and no new revenue posts.',
        primaryLabel: approve ? 'Approve Advance Invoice' : 'Submit Advance Invoice for Approval',
        primaryBg: approve ? '#047857' : 'hsl(var(--primary))',
      };
    }
    if (approve) {
      return {
        chipLabel: 'Confirm Approval',
        chipBg: '#ECFDF5',
        chipText: '#047857',
        glowColor: '#047857',
        tileBg: '#D1FAE5',
        tileIconColor: '#047857',
        title: isResubmit ? 'Approve the fixed invoice?' : 'Approve this invoice?',
        howItWorks: 'It posts to the General Ledger now and can be sent to the customer.',
        implications: `The invoice becomes receivable under its ${termName} terms. Review the GL impact below before you approve.`,
        primaryLabel: 'Approve',
        primaryBg: '#047857',
      };
    }
    if (isResubmit) {
      return {
        chipLabel: 'Confirm Resubmission',
        chipBg: '#ECFDF5',
        chipText: '#047857',
        glowColor: '#047857',
        tileBg: '#D1FAE5',
        tileIconColor: '#047857',
        title: 'Resubmit this invoice?',
        howItWorks: 'It goes back to your approvers. Once approved, it posts to the General Ledger.',
        implications: `The invoice becomes receivable under its ${termName} terms. Review the GL impact below before you resubmit.`,
        primaryLabel: 'Resubmit',
        primaryBg: '#047857',
      };
    }
    if (isPendingEdit) {
      return {
        chipLabel: 'Confirm Changes',
        chipBg: '#EBF3FF',
        chipText: '#0654BC',
        glowColor: '#0A77FF',
        tileBg: '#D6E8FF',
        tileIconColor: '#0654BC',
        title: 'Save changes to this invoice?',
        howItWorks: 'The invoice stays in Pending Approval and your approvers review the edited version. Nothing has posted yet, so editing is free.',
        implications: 'Once approved, the invoice posts to the General Ledger with the updated details shown below.',
        primaryLabel: 'Save Changes',
        primaryBg: 'hsl(var(--primary))',
      };
    }
    return {
      chipLabel: 'Confirm Submission',
      chipBg: '#EBF3FF',
      chipText: '#0654BC',
      glowColor: '#0A77FF',
      tileBg: '#D6E8FF',
      tileIconColor: '#0654BC',
      title: 'Submit this invoice for approval?',
      howItWorks: 'It goes to your approvers. Once approved, it posts to the General Ledger.',
      implications: `The invoice becomes receivable under its ${termName} terms. Review the GL impact below before you submit.`,
      primaryLabel: 'Submit for Approval',
      primaryBg: 'hsl(var(--primary))',
    };
  })();

  const fmtGl = (n: number) => money(n, currency);
  const dep = splitGlAccount(depositAccount || CUSTOMER_DEPOSITS_ACCOUNT);
  const lines: { key: string; code: string; name: string; debit?: number; credit?: number }[] = isAdvance
    ? [
        { key: 'cash', code: '1000', name: 'Cash / Bank', debit: total },
        { key: 'dep', code: dep.code, name: dep.name, credit: total },
      ]
    : glRows.map((r, i) => ({ key: `${r.code}-${i}`, code: r.code, name: r.name + (r.note ? ` (${r.note})` : ''), debit: r.debit, credit: r.credit }));
  const drTotal = isAdvance ? total : dr;
  const crTotal = isAdvance ? total : cr;
  const isBalanced = isAdvance ? true : balanced;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[560px] p-0 gap-0 rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto"
        style={{ zIndex: 220 }}
        onInteractOutside={() => onOpenChange(false)}
      >
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${variant.chipBg} 0%, ${variant.chipBg}4D 70%, transparent 100%)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: variant.glowColor }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: variant.tileBg }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: variant.tileIconColor }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: variant.chipBg, color: variant.chipText }}>
            {variant.chipLabel}
          </span>
        </div>
        <div className="flex flex-col items-center px-7 pb-7">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center items-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {variant.title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-[13px] mt-2 max-w-[560px] text-center" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65 }}>
            {variant.howItWorks}
          </p>

          <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
            <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                  {isAdvance ? 'What This Means' : 'What Are the Implications'}
                </p>
              </div>
              <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.6 }}>
                {variant.implications}
                {releaseNote ? ` ${releaseNote}` : ''}
              </p>
            </div>

            {isAdvance && treatmentNote && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Revenue on Shipment, Units Not on Hand</p>
                </div>
                <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.6 }}>
                  {treatmentNote}
                </p>
              </div>
            )}

            {priceChanges.length > 0 && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Changes on This Invoice</p>
                </div>
                <div className="space-y-1.5">
                  {priceChanges.map((c, i) => (
                    <div key={`${c.sku}-${i}`} className="text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{c.sku}</span>
                      <span className="block">
                        Price per Unit changed from {money(c.from, currency)} to {money(c.to, currency)}.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                  {isAdvance ? 'GL Impact at Payment' : 'GL Impact'}
                </p>
              </div>
              {isAdvance ? (
                <p className="text-[12px] text-slate-500 mb-2" style={{ fontWeight: 600 }}>
                  Preview only. The GL is updated when the customer pays.
                </p>
              ) : (
                <p className="text-[12px] text-slate-600 mb-2" style={{ lineHeight: 1.6 }}>
                  {advanceRevenue
                    ? 'This advance invoice books a receivable and the billed amount as revenue on each line, with the cost of the locked units moving from inventory to cost of goods sold.'
                    : 'This invoice books a receivable from the customer and recognizes the full amount as revenue, including freight and other charges billed on. Sales tax posts to Sales Tax Payable.'}
                </p>
              )}
              <div className="mt-1.5 rounded-lg border border-slate-200 bg-white overflow-hidden text-left">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50/70 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                      <th className="text-center px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                      <th className="text-center px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.key} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-1.5">
                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{line.code}</span>
                          <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{line.name}</span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {line.debit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.debit)}</span> : null}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {line.credit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.credit)}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/70">
                      <td className="px-3 py-1.5">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border"
                          style={
                            isBalanced
                              ? { fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                              : { fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' }
                          }
                        >
                          {isBalanced ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                          {isBalanced ? 'Debit = Credit (Balanced)' : 'Out of Balance'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center text-foreground" style={{ fontWeight: 700 }}>{fmtGl(drTotal)}</td>
                      <td className="px-3 py-1.5 text-center text-foreground" style={{ fontWeight: 700 }}>{fmtGl(crTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="w-full mt-6 flex flex-col gap-2.5 sticky bottom-0 bg-white pt-2 pb-1 -mb-2">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: variant.primaryBg, color: '#fff' }}
            >
              {variant.primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
            >
              Continue Editing
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
