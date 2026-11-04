import { useMemo } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { ReversePaymentModal } from '@/app/components/invoice-details/ReversePaymentModal';
import { buildReversiblePayments } from '@/app/lib/reversiblePayments';
import { SYSTEM_USERS, SYSTEM_ROLES } from '@/app/data/systemUsers';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';

// Listing row-menu modals (10/9/26): the row actions open the SAME
// confirms the detail page opens, not listing-only variants. Approve is
// the detail's status-change confirm (72px tile, emerald), a held
// invoice gets the approve-on-hold gate, and Reverse Payment is the
// detail's ReversePaymentModal fed by the shared reversible-payments
// derivation.

// Approved tones from the detail page's STATUS_PALETTE / STEP_COLORS.
const APPROVED_BG = '#ECFDF5';
const APPROVED_TEXT = '#047857';
const APPROVED_SOLID = '#047857';

interface InvoiceRowActionModalsProps {
  singleApprove: Invoice | null;
  onCloseSingleApprove: () => void;
  approveHoldInvoice: Invoice | null;
  onCloseApproveHold: () => void;
  onApprove: (invoice: Invoice, toastDescription?: string) => void;
  onReleaseHold: (invoice: Invoice) => void;
  reverseInvoice: Invoice | null;
  onCloseReverse: () => void;
  invoices: Invoice[];
  payments: Payment[];
  onReversePayment?: (args: { invoiceId?: string; paymentReference: string; amount?: number; reason?: string }) => void;
}

const namesFromIds = (ids: string[]): string[] =>
  ids
    .map((id) => SYSTEM_ROLES.find((r) => r.id === id)?.name ?? SYSTEM_USERS.find((u) => u.id === id)?.name)
    .filter((n): n is string => !!n);

export function InvoiceRowActionModals({
  singleApprove,
  onCloseSingleApprove,
  approveHoldInvoice,
  onCloseApproveHold,
  onApprove,
  onReleaseHold,
  reverseInvoice,
  onCloseReverse,
  invoices,
  payments,
  onReversePayment,
}: InvoiceRowActionModalsProps) {
  const lightTint = `color-mix(in srgb, ${APPROVED_BG} 50%, white)`;
  const reversible = useMemo(
    () => (reverseInvoice ? buildReversiblePayments(reverseInvoice, invoices, payments) : []),
    [reverseInvoice, invoices, payments],
  );

  return (
    <>
      {/* Approve: the detail page's status-change confirm, verbatim. */}
      <AlertDialog open={!!singleApprove} onOpenChange={(open) => { if (!open) onCloseSingleApprove(); }}>
        <AlertDialogContent
          className="max-w-[calc(100%-2rem)] sm:max-w-[420px] p-0 overflow-hidden gap-0 rounded-2xl border-0"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        >
          {singleApprove && (
            <>
              <div
                className="relative flex flex-col items-center pt-11 pb-7"
                style={{ background: `linear-gradient(180deg, ${lightTint} 0%, color-mix(in srgb, ${lightTint} 30%, transparent) 70%, transparent 100%)` }}
              >
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
                  style={{ backgroundColor: APPROVED_SOLID, filter: 'blur(50px)' }}
                />
                <div className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: APPROVED_BG }}>
                  <CheckCircle2 className="w-9 h-9" style={{ color: APPROVED_SOLID, strokeWidth: 2 }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: lightTint, color: APPROVED_TEXT }}>
                  Approve
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-9 pb-9">
                <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                  Approve this invoice?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px] mt-3 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                  {singleApprove.type === 'Pre-Invoice' ? (
                    <>
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{singleApprove.invoiceNumber}</span> moves to{' '}
                      <span className="text-foreground" style={{ fontWeight: 600 }}>Approved</span>. Nothing posts to the general ledger until a payment is made.
                    </>
                  ) : (
                    <>
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{singleApprove.invoiceNumber}</span> will post to the
                      general ledger and move to <span className="text-foreground" style={{ fontWeight: 600 }}>Approved</span>.
                    </>
                  )}
                </AlertDialogDescription>
                <div className="w-full mt-8 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={() => {
                      onApprove(singleApprove);
                      onCloseSingleApprove();
                    }}
                    className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: APPROVED_SOLID, color: '#fff' }}
                  >
                    Approve Invoice
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-12 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  >
                    Keep as Pending Approval
                  </AlertDialogCancel>
                </div>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve-on-hold gate (Nophil 9/22), same as the detail page. */}
      <AlertDialog open={!!approveHoldInvoice} onOpenChange={(open) => { if (!open) onCloseApproveHold(); }}>
        <AlertDialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[440px]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        >
          <div
            className="relative flex flex-col items-center pt-7 pb-4 shrink-0"
            style={{ background: 'linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#A16207', filter: 'blur(50px)' }} />
            <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF9C3' }}>
              <Lock className="w-7 h-7" style={{ color: '#A16207', strokeWidth: 2 }} />
            </div>
            <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEFCE8', color: '#A16207' }}>
              Payment Hold
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-6">
            <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
              Approve this invoice?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '360px' }}>
              You're approving an invoice which was placed on a "Payment Hold". Approving this invoice will not release it for vendor payments. You can release the payment hold now or later.
            </AlertDialogDescription>
          </div>
          <div className="px-6 pt-4 pb-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (!approveHoldInvoice) return;
                onApprove(approveHoldInvoice, 'The payment hold stays on until you release it.');
                onCloseApproveHold();
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
              style={{ fontWeight: 600, backgroundColor: '#047857' }}
            >
              Approve Invoice
            </button>
            <button
              type="button"
              onClick={() => {
                if (!approveHoldInvoice) return;
                onApprove(approveHoldInvoice);
                onReleaseHold(approveHoldInvoice);
                onCloseApproveHold();
              }}
              className="w-full h-11 text-[14px] rounded-xl bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 cursor-pointer transition-colors shadow-sm"
              style={{ fontWeight: 600 }}
            >
              Approve and Release Hold
            </button>
            <button
              type="button"
              onClick={onCloseApproveHold}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Go Back
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Payment: the detail page's modal and App handler. */}
      {reverseInvoice && (
        <ReversePaymentModal
          open
          onOpenChange={(open) => { if (!open) onCloseReverse(); }}
          invoiceNumber={reverseInvoice.invoiceNumber}
          vendorName={reverseInvoice.vendor}
          outstandingBalance={reverseInvoice.status === 'Cancelled' ? 0 : Math.max(0, reverseInvoice.outstandingBalance)}
          totalAmount={reverseInvoice.amount}
          currency={reverseInvoice.currency}
          payments={reversible}
          entity={reverseInvoice.type === 'Pre-Invoice' ? 'prepayment' : 'payment'}
          onSubmit={(payload) => {
            const isPre = reverseInvoice.type === 'Pre-Invoice';
            onReversePayment?.({ invoiceId: reverseInvoice.id, paymentReference: payload.paymentReference, amount: payload.reversalAmount, reason: payload.reason });
            const names = payload.notify ? namesFromIds(payload.notifiedRecipientIds) : [];
            const notifyLine = names.length > 0
              ? `Notification sent to ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}.`
              : undefined;
            toast.success(`${isPre ? 'Prepayment' : 'Payment'} ${payload.paymentReference} reversed`, {
              description: [`${payload.reason} · ${reverseInvoice.currency === 'USD' ? '$' : reverseInvoice.currency + ' '}${payload.reversalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, notifyLine].filter(Boolean).join(' · '),
            });
            onCloseReverse();
          }}
        />
      )}
    </>
  );
}
