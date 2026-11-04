import { FileText, Send, X } from 'lucide-react';
import { formatUsDate } from '@/app/lib/dueBucket';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { Customer } from '@/app/data/ar/mockCustomers';
import type { SendPayload } from '@/app/hooks/useCustomerInvoicing';
import { useArSettings } from '@/app/hooks/useArSettings';

// Send to customer (PRD §10.3, simplified 10/29): an invoice summary and
// one confirm. Sending goes to the billing contact on file and flips the
// invoice to Sent with the date; Resend stays available.

export interface SendToCustomerModalProps {
  invoice: CustomerInvoice;
  /** The invoice's customer, for the billing contact (Partners). */
  customer?: Customer;
  onClose: () => void;
  onSend: (payload: SendPayload, outcome: 'sent' | 'failed') => void;
}

const THEME = { bg: '#EBF3FF', solid: 'hsl(var(--primary))' };

const fmt = (n: number, currency: string) =>
  `${currency === 'USD' ? '$' : `${currency} `}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function docTitle(inv: CustomerInvoice): string {
  if (inv.docKind === 'Credit Memo') return 'Credit Memo';
  if (inv.docKind === 'Advance Invoice') return 'Advance Invoice';
  return 'Invoice';
}

function messageTemplate(inv: CustomerInvoice, contactName: string | undefined, company: string): string {
  const hello = contactName ? `Hello ${contactName.split(' ')[0]},` : 'Hello,';
  const amount = fmt(inv.amount, inv.currency);
  if (inv.docKind === 'Credit Memo') {
    return `${hello}\n\nPlease find credit memo ${inv.invoiceNumber} for ${amount} attached${inv.relatedInvoiceNumber ? `, issued against invoice ${inv.relatedInvoiceNumber}` : ''}.\n\nThank you,\n${company}`;
  }
  if (inv.docKind === 'Advance Invoice') {
    return `${hello}\n\nPlease find advance invoice ${inv.invoiceNumber} for ${amount} attached${inv.dueDate ? `, due ${formatUsDate(inv.dueDate)}` : ''}. It bills part of your order ahead of shipment; the balance follows on the shipment invoice.\n\nThank you for your business,\n${company}`;
  }
  return `${hello}\n\nPlease find invoice ${inv.invoiceNumber} for ${amount} attached${inv.dueDate ? `, due ${formatUsDate(inv.dueDate)}` : ''}.\n\nThank you for your business,\n${company}`;
}

export function SendToCustomerModal({ invoice, customer, onClose, onSend }: SendToCustomerModalProps) {
  const { companyName } = useArSettings();
  const title = docTitle(invoice);
  const isResend = !!invoice.sentAt;
  const contact = customer?.billingContact;

  // Summary only (10/29): no email composer. Confirming sends to the
  // billing contact on file and flips the invoice to Sent.
  const handleSend = () => {
    const payload: SendPayload = {
      to: contact?.email ? [contact.email] : [],
      cc: [],
      subject: `${title} ${invoice.invoiceNumber} from ${companyName}`,
      message: messageTemplate(invoice, contact?.name, companyName),
    };
    onSend(payload, 'sent');
    onClose();
  };

  const rows: { label: string; value: string }[] = [
    { label: 'Invoice ID', value: invoice.invoiceNumber },
    { label: 'Customer', value: invoice.customer },
    { label: 'Invoice Type', value: title },
    ...(invoice.customerPONumber ? [{ label: 'Customer PO Number', value: invoice.customerPONumber }] : []),
    { label: 'Invoice Date', value: invoice.invoiceDate ? formatUsDate(invoice.invoiceDate) : '–' },
    { label: 'Due Date', value: invoice.dueDate ? formatUsDate(invoice.dueDate) : '–' },
    ...(invoice.paymentTerms ? [{ label: 'Payment Terms', value: invoice.paymentTerms }] : []),
    ...(contact ? [{ label: 'Billing Contact', value: contact.email ? `${contact.name}, ${contact.email}` : contact.name }] : []),
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[520px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
              <Send className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                {isResend ? `Resend ${title}` : `Send ${title} to Customer`}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {isResend && invoice.sentAt
                  ? `Last sent ${formatUsDate(invoice.sentAt)}. Review the summary, then send it again.`
                  : 'Review the summary. Once sent, the invoice shows Sent with the date.'}
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

        <div className="px-4 sm:px-5 pt-4 pb-5 text-left flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Amount hero */}
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-500">Invoice Amount</p>
                <p className="text-[18px] text-foreground leading-tight" style={{ fontWeight: 600 }}>{fmt(invoice.amount, invoice.currency)}</p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 px-3.5 py-2">
                  <dt className="text-[11px] text-slate-500 shrink-0">{r.label}</dt>
                  <dd className="text-[12px] text-foreground text-right truncate min-w-0" style={{ fontWeight: 500 }}>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90 inline-flex items-center gap-1.5"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            <Send className="w-3.5 h-3.5" />
            {isResend ? 'Resend' : 'Send to Customer'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
