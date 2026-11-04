import { useMemo } from 'react';
import { Printer, Download, FileSpreadsheet, X, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Invoice } from '@/app/data/mockInvoices';
import { generateLines } from './LineItemsTab';
import { downloadInvoicePdf, downloadInvoiceCsv, printInvoicePdf, type InvoiceDocData } from '@/app/lib/invoicePdf';
import { toast } from 'sonner';

/* Print / Export invoice (9/5/26, BB-26 — Eli's release blocker, built
 * per the BA's ask): ONE document surface for both actions. The modal
 * previews the exact document the PDF renders; Print pushes that same
 * PDF at the browser's print dialog, Export offers PDF + CSV. The two
 * entry points share everything but their framing. */

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export function InvoiceDocumentModal({
  open,
  mode,
  onOpenChange,
  invoice,
  subtotal,
  paymentTerms,
  creditsTotal = 0,
}: {
  open: boolean;
  /** 'print' leads with the Print CTA; 'export' leads with the downloads. */
  mode: 'print' | 'export';
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  subtotal: number;
  paymentTerms?: string;
  /** Credit memos applied — split out of "paid" on the document (GPT
   *  QC19, 9/30: a full credit printed as Paid to date). */
  creditsTotal?: number;
}) {
  const isPre = invoice.type === 'Pre-Invoice';
  const lines = useMemo(() => generateLines(invoice, subtotal), [invoice, subtotal]);
  const data: InvoiceDocData = { invoice, lines, subtotal, paymentTerms, creditsTotal };
  const settledTotal = Math.max(0, invoice.amount - invoice.outstandingBalance);
  const credited = Math.min(settledTotal, Math.max(0, creditsTotal));
  const cashPaid = Math.max(0, Math.round((settledTotal - credited) * 100) / 100);
  const extras = Math.max(0, Math.round((invoice.amount - subtotal) * 100) / 100);

  const ctas = (
    <>
      <button
        type="button"
        onClick={() => { printInvoicePdf(data); toast.success('Print dialog opened in a new tab.'); }}
        className={`h-10 px-4 rounded-xl text-[13px] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
          mode === 'print'
            ? 'bg-primary text-white hover:bg-primary/90 border-0 flex-1'
            : 'bg-white text-foreground border border-border hover:bg-slate-50'
        }`}
        style={{ fontWeight: 600 }}
      >
        <Printer className="w-4 h-4" />
        Print
      </button>
      <button
        type="button"
        onClick={() => { downloadInvoicePdf(data); toast.success(`${invoice.invoiceNumber}.pdf downloaded.`); }}
        className={`h-10 px-4 rounded-xl text-[13px] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
          mode === 'export'
            ? 'bg-primary text-white hover:bg-primary/90 border-0 flex-1'
            : 'bg-white text-foreground border border-border hover:bg-slate-50'
        }`}
        style={{ fontWeight: 600 }}
      >
        <Download className="w-4 h-4" />
        Download PDF
      </button>
      <button
        type="button"
        onClick={() => { downloadInvoiceCsv(data); toast.success(`${invoice.invoiceNumber}-lines.csv downloaded.`); }}
        className="h-10 px-4 rounded-xl text-[13px] inline-flex items-center justify-center gap-2 bg-white text-foreground border border-border hover:bg-slate-50 cursor-pointer transition-colors"
        style={{ fontWeight: 600 }}
      >
        <FileSpreadsheet className="w-4 h-4" />
        Download CSV
      </button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Header — creation-modal chrome (tinted icon chip + title). */}
        <div className="px-5 pt-4 pb-4 bg-white border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                {mode === 'print' ? 'Print Invoice' : 'Export Invoice'} · {invoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {mode === 'print'
                  ? 'Preview below. Print opens the document in the browser print dialog.'
                  : 'Preview below. Download the document as PDF, or the line items as CSV.'}
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

        {/* Document preview — a faithful compact mirror of the PDF. */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-6 py-5 max-w-[600px] mx-auto">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <p className="text-[15px] tracking-wide text-foreground" style={{ fontWeight: 700 }}>
                  {isPre ? 'Pre-Invoice' : 'Vendor Invoice'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isPre ? 'Billed before receiving. Payments record as vendor advances.' : 'Accounts payable record of goods and services billed.'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] text-foreground " style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{invoice.status}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-200">
              <div>
                <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Billed To</p>
                <p className="text-[12px] text-foreground mt-1" style={{ fontWeight: 600 }}>Omnesoft, Inc.</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">1200 Market Street, Suite 400<br />San Francisco, CA 94103</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Vendor</p>
                <p className="text-[12px] text-foreground mt-1" style={{ fontWeight: 600 }}>{invoice.vendor}</p>
                <p className="text-[10px] text-slate-500">Vendor Invoice No. {invoice.vendorInvoiceNumber || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-3 border-b border-slate-200 text-[10px]">
              {([
                ['Invoice Date', fmtDate(invoice.invoiceDate)],
                ['Due Date', fmtDate(invoice.dueDate)],
                ['Posting Date', invoice.postingDate ? fmtDate(invoice.postingDate) : isPre ? 'Posts on first payment' : fmtDate(invoice.createdDate)],
                ['Payment Terms', paymentTerms || '—'],
                ['Linked POs', invoice.linkedPOs.length > 0 ? invoice.linkedPOs.join(', ') : '—'],
                [isPre ? 'Advances Account' : 'A/P Account', isPre ? '1205 Advance Payments' : invoice.apAccount || '—'],
              ] as Array<[string, string]>).map(([k, v]) => (
                <p key={k} className="flex justify-between gap-2">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-slate-700 text-right" style={{ fontWeight: 600 }}>{v}</span>
                </p>
              ))}
            </div>

            <table className="w-full mt-3 text-[10px]">
              <thead>
                <tr className="text-[9px] text-slate-400 border-b border-slate-200">
                  <th className="text-left pb-1.5" style={{ fontWeight: 600 }}>Item</th>
                  <th className="text-right pb-1.5" style={{ fontWeight: 600 }}>Qty</th>
                  <th className="text-right pb-1.5" style={{ fontWeight: 600 }}>Unit Price</th>
                  <th className="text-right pb-1.5" style={{ fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-1.5 pr-2">
                      {/* GL-expense lines have no item code (GPT QC20): the
                          account identifies the line, never an invented
                          ITM number. */}
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{l.sku || l.glAccount || '—'}</span>
                      <span className="block text-slate-400 truncate max-w-[220px]">{l.productName}</span>
                    </td>
                    <td className="py-1.5 text-right text-slate-600 whitespace-nowrap">{l.invoicedQty} {l.uom}</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(l.unitPrice)}</td>
                    <td className="py-1.5 text-right text-foreground" style={{ fontWeight: 600 }}>{fmt(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 pt-2 border-t border-slate-200 space-y-1 text-[10px]">
              <p className="flex justify-end gap-6"><span className="text-slate-400">Line Subtotal</span><span className="text-slate-700 w-20 text-right" style={{ fontWeight: 600 }}>{fmt(subtotal)}</span></p>
              {extras > 0.004 && (
                <p className="flex justify-end gap-6"><span className="text-slate-400">Tax, Freight &amp; Charges</span><span className="text-slate-700 w-20 text-right" style={{ fontWeight: 600 }}>{fmt(extras)}</span></p>
              )}
              <p className="flex justify-end gap-6 text-[11px]"><span className="text-slate-600" style={{ fontWeight: 600 }}>Invoice Total</span><span className="text-foreground w-20 text-right" style={{ fontWeight: 700 }}>{fmt(invoice.amount)}</span></p>
              {/* Cash and credits split (QC19): a credit memo is never
                  "paid". */}
              {cashPaid > 0.004 && (
                <p className="flex justify-end gap-6"><span className="text-slate-400">Cash Paid</span><span className="text-slate-700 w-20 text-right" style={{ fontWeight: 600 }}>−{fmt(cashPaid)}</span></p>
              )}
              {credited > 0.004 && (
                <p className="flex justify-end gap-6"><span className="text-slate-400">Credit Memos</span><span className="text-slate-700 w-20 text-right" style={{ fontWeight: 600 }}>−{fmt(credited)}</span></p>
              )}
              <p className="flex justify-end gap-6 text-[11px]"><span className="text-slate-600" style={{ fontWeight: 600 }}>Balance Due</span><span className="text-foreground w-20 text-right" style={{ fontWeight: 700 }}>{fmt(invoice.outstandingBalance)}</span></p>
            </div>
          </div>
        </div>

        {/* Footer CTAs — the invoked action leads. */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
          {ctas}
        </div>
      </DialogContent>
    </Dialog>
  );
}
