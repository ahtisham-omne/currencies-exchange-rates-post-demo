import { jsPDF } from 'jspdf';
import type { Invoice } from '@/app/data/mockInvoices';
import type { LineItem } from '@/app/components/invoice-details/LineItemsTab';

/* Invoice document builder (9/5/26, BB-26 — the release-blocker print/
 * export flows). Same recipe as remittanceAdvice.ts: jsPDF renders a
 * clean letter-format document; Print routes the SAME artifact through
 * the browser's print dialog (autoPrint + blob URL) so print and PDF
 * are one layout, never two. CSV export ships the line rows for
 * spreadsheet work. */

// TODO: payer company details — pull from org/company settings.
const COMPANY = {
  name: 'OMNE Demo Company',
  lines: [
    '1200 Market Street, Suite 400',
    'San Francisco, CA 94103',
    'accounts-payable@omnesoft.com',
  ],
};

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Show the price at the precision that explains the line amount (9/22/26
// review response, GPT EXP-02): 2 decimals when exact, up to 4 otherwise.
const fmtPrice = (n: number) => {
  const two = Math.round(n * 100) / 100;
  const four = Math.round(n * 10000) / 10000;
  return two === four ? fmt(two) : `$${four.toFixed(4)}`;
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export interface InvoiceDocData {
  invoice: Invoice;
  lines: LineItem[];
  /** Line subtotal (the detail page's numbers.subtotal). */
  subtotal: number;
  /** Payment terms label — the INVOICE'S saved term first (GPT QC20,
   *  9/30: the vendor default printed on a differently-termed invoice). */
  paymentTerms?: string;
  /** Credit memos applied — printed as their own reduction line, never
   *  folded into "paid" (GPT QC19). */
  creditsTotal?: number;
}

function buildInvoicePdf({ invoice, lines, subtotal, paymentTerms, creditsTotal = 0 }: InvoiceDocData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const isPre = invoice.type === 'Pre-Invoice';
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const right = pageW - M;
  let y = M;

  const rule = (yy: number) => {
    doc.setDrawColor(210);
    doc.setLineWidth(0.75);
    doc.line(M, yy, right, yy);
  };

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(isPre ? 'Pre-Invoice' : 'Vendor Invoice', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    isPre
      ? 'Billed before receiving. Payments record as vendor advances.'
      : 'Accounts payable record of goods and services billed.',
    M,
    y + 14,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(invoice.invoiceNumber, right, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(invoice.status, right, y + 14, { align: 'right' });
  y += 34;
  rule(y);
  y += 22;

  // ── Billed to (us) + Billed by (vendor) ──
  const colR = M + (right - M) / 2 + 12;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Billed To', M, y);
  doc.text('Vendor', colR, y);
  y += 14;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, M, y);
  doc.text(invoice.vendor, colR, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  let ly = y + 14;
  COMPANY.lines.forEach((l) => {
    doc.text(l, M, ly);
    ly += 12;
  });
  doc.text(`Vendor Invoice No. ${invoice.vendorInvoiceNumber || '—'}`, colR, y + 14);
  y = Math.max(ly, y + 28) + 8;
  rule(y);
  y += 22;

  // ── Invoice meta grid ──
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Invoice Details', M, y);
  y += 16;
  const meta: Array<[string, string]> = [
    ['Invoice Date', fmtDate(invoice.invoiceDate)],
    ['Due Date', fmtDate(invoice.dueDate)],
    // The posting date comes from the invoice on every type (Mahreen
    // 9/29); legacy pre-invoices without one fall back to the old copy.
    ['Posting Date', invoice.postingDate ? fmtDate(invoice.postingDate) : isPre ? 'Posts on first payment' : fmtDate(invoice.createdDate)],
    ['Payment Terms', paymentTerms || '—'],
    ['Linked POs', invoice.linkedPOs.length > 0 ? invoice.linkedPOs.join(', ') : '—'],
    [isPre ? 'Advances Account' : 'A/P Account', isPre ? '1205 Advance Payments' : invoice.apAccount || '—'],
  ];
  doc.setFontSize(9);
  meta.forEach(([k, v], i) => {
    const mx = M + (i % 2) * ((right - M) / 2);
    const my = y + Math.floor(i / 2) * 18;
    doc.setTextColor(140);
    doc.text(k, mx, my);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.text(v, mx + 92, my);
    doc.setFont('helvetica', 'normal');
  });
  y += Math.ceil(meta.length / 2) * 18 + 14;
  rule(y);
  y += 22;

  // ── Line items ──
  const cItem = M;
  const cQty = right - 220;
  const cPrice = right - 120;
  const cAmount = right;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Item', cItem, y);
  doc.text('Qty', cQty, y, { align: 'right' });
  doc.text('Unit Price', cPrice, y, { align: 'right' });
  doc.text('Amount', cAmount, y, { align: 'right' });
  y += 8;
  rule(y);
  y += 16;

  doc.setFontSize(9);
  lines.forEach((l) => {
    if (y > pageH - 140) {
      doc.addPage();
      y = M;
    }
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    // GL-expense lines carry no item code (GPT QC20): print the GL
    // account as the line identity, never an invented ITM number.
    doc.text(l.sku || l.glAccount || '—', cItem, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    const name = l.productName.length > 46 ? `${l.productName.slice(0, 45)}…` : l.productName;
    doc.text(name, cItem, y + 11);
    doc.setTextColor(30);
    doc.text(`${l.invoicedQty} ${l.uom}`, cQty, y, { align: 'right' });
    // Show the price at the precision that explains the line amount
    // (9/22/26, GPT EXP-02): 2 decimals when exact, up to 4 otherwise.
    doc.text(fmtPrice(l.unitPrice), cPrice, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(l.amount), cAmount, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 28;
  });

  y += 2;
  rule(y);
  y += 18;

  // ── Totals ──
  // Cash and credits split (GPT QC19, 9/30): a credit memo reduces the
  // balance without moving money — the document never calls it "paid".
  const settledTotal = Math.max(0, invoice.amount - invoice.outstandingBalance);
  const credited = Math.min(settledTotal, Math.max(0, creditsTotal));
  const cashPaid = Math.max(0, Math.round((settledTotal - credited) * 100) / 100);
  const extras = Math.max(0, Math.round((invoice.amount - subtotal) * 100) / 100);
  const totals: Array<[string, string, boolean]> = [
    ['Line Subtotal', fmt(subtotal), false],
    ...(extras > 0.004 ? [['Tax, Freight & Charges', fmt(extras), false] as [string, string, boolean]] : []),
    ['Invoice Total', fmt(invoice.amount), true],
    ...(cashPaid > 0.004 ? [['Cash Paid', `-${fmt(cashPaid)}`, false] as [string, string, boolean]] : []),
    ...(credited > 0.004 ? [['Credit Memos', `-${fmt(credited)}`, false] as [string, string, boolean]] : []),
    ['Balance Due', fmt(invoice.outstandingBalance), true],
  ];
  totals.forEach(([k, v, strong]) => {
    doc.setFontSize(strong ? 11 : 9);
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setTextColor(strong ? 20 : 110);
    doc.text(k, cPrice - 60, y, { align: 'right' });
    doc.setTextColor(20);
    doc.text(v, cAmount, y, { align: 'right' });
    y += strong ? 20 : 16;
  });
  doc.setFont('helvetica', 'normal');

  // ── Description + footer ──
  if (invoice.description) {
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('Description', M, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(90);
    const wrapped = doc.splitTextToSize(invoice.description, right - M);
    doc.text(wrapped, M, y);
  }
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated from Omne ERP · ${invoice.invoiceNumber} · ${invoice.vendor}`, M, pageH - M);

  return doc;
}

export function downloadInvoicePdf(data: InvoiceDocData): void {
  buildInvoicePdf(data).save(`${data.invoice.invoiceNumber}.pdf`);
}

/** Print = the same PDF pushed straight at the browser's print dialog
 *  (autoPrint + blob URL in a new tab), so print and download can never
 *  drift apart. */
export function printInvoicePdf(data: InvoiceDocData): void {
  const doc = buildInvoicePdf(data);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank', 'noopener');
}

export function downloadInvoiceCsv({ invoice, lines }: InvoiceDocData): void {
  const esc = (s: string | number) => {
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const rows = [
    ['Invoice', 'Vendor', 'Item', 'Description', 'Qty', 'UOM', 'Unit Price', 'Amount', 'GL Account', 'POs'],
    ...lines.map((l) => [
      invoice.invoiceNumber,
      invoice.vendor,
      l.sku,
      l.productName,
      l.invoicedQty,
      l.uom,
      String(Math.round(l.unitPrice * 10000) / 10000),
      l.amount.toFixed(2),
      l.glAccount,
      l.poRefs.join(' '),
    ]),
  ];
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoiceNumber}-lines.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
