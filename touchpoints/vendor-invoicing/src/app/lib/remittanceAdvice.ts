import { jsPDF } from 'jspdf';
import type { Payment } from '@/app/data/mockPayments';
import { formatMoneyPdf } from '@/app/currency/money';
import { settledCurrencyOf } from '@/app/currency/paymentFx';

// Remittance advice — a digital check stub the payer sends the vendor listing
// the invoices settled by a payment. Generation is channel-agnostic: this
// builder produces the PDF artifact; a future "Email to vendor" button can call
// the same function and attach the result.

export interface RemittanceLine {
  invoiceNumber: string;
  /** Amount applied to this invoice by the payment. */
  paid: number;
  /** Open balance still owed after this payment, when known (partial pays). */
  balanceDue?: number;
}

export interface RemittanceOptions {
  /** Line detail with remaining balances (from the record flow). Falls back to
   *  the payment's appliedInvoices (amounts only) for later re-downloads. */
  lines?: RemittanceLine[];
  /** Vendor email the advice would be sent to (placeholder for now). */
  vendorEmail?: string;
}

// ── Placeholders to swap for real data ──
// TODO: payer company details — pull from org/company settings.
const PAYER = {
  name: 'Omnesoft, Inc.',
  lines: [
    '1200 Market Street, Suite 400',
    'San Francisco, CA 94103',
    'accounts-payable@omnesoft.com',
  ],
};


// TODO: real vendor email — derived placeholder until vendor records carry one.
function placeholderVendorEmail(vendor: string): string {
  const slug = vendor.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'vendor';
  return `ap@${slug}.example`;
}

export function downloadRemittanceAdvice(payment: Payment, opts: RemittanceOptions = {}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  renderAdvicePage(doc, payment, opts);
  doc.save(`remittance-${payment.paymentNumber}.pdf`);
}

/** One combined PDF for a payment run: one advice page per posted
 *  payment, saved as a single file (the run detail's primary CTA,
 *  BA 8/11/26). */
export function downloadRunRemittanceAdvice(runId: string, payments: Payment[]): void {
  if (payments.length === 0) return;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  payments.forEach((payment, i) => {
    if (i > 0) doc.addPage();
    renderAdvicePage(doc, payment, {});
  });
  doc.save(`remittance-${runId}.pdf`);
}

function renderAdvicePage(doc: jsPDF, payment: Payment, opts: RemittanceOptions): void {
  // Currency & Exchange Rates: the advice lists what each invoice was
  // settled for, so its amounts are in the invoices' currency.
  const currency = settledCurrencyOf(payment);
  const fmt = (n: number) => formatMoneyPdf(n, currency);
  const lines: RemittanceLine[] =
    opts.lines ??
    payment.appliedInvoices.map((a) => ({ invoiceNumber: a.invoiceNumber, paid: a.amount }));
  const vendorEmail = opts.vendorEmail ?? placeholderVendorEmail(payment.vendor);

  const pageW = doc.internal.pageSize.getWidth();
  const M = 48; // margin
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
  doc.text('Remittance Advice', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Payment confirmation, not a negotiable instrument', M, y + 14);
  y += 34;
  rule(y);
  y += 22;

  // ── Payer (left) + Paid-to (right) ──
  const colR = M + (right - M) / 2 + 12;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('From', M, y);
  doc.text('Paid To', colR, y);
  y += 14;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.text(PAYER.name, M, y);
  doc.text(payment.vendor, colR, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  let ly = y + 14;
  PAYER.lines.forEach((l) => {
    doc.text(l, M, ly);
    ly += 12;
  });
  doc.text(vendorEmail, colR, y + 14);
  y = Math.max(ly, y + 28) + 8;
  rule(y);
  y += 22;

  // ── Payment meta ──
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Payment Details', M, y);
  y += 16;
  const meta: Array<[string, string]> = [
    ['Payment ID', payment.paymentNumber],
    ['Payment Date', payment.paymentDate],
    ['Method', payment.paymentMethod],
    ['Reference No.', payment.reference || ', '],
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

  // ── Invoice table ──
  const hasBalance = lines.some((l) => typeof l.balanceDue === 'number');
  const cInvoice = M;
  const cPaid = hasBalance ? right - 200 : right - 120;
  const cBalance = right;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Invoice', cInvoice, y);
  doc.text('Amount Paid', cPaid, y, { align: 'right' });
  if (hasBalance) doc.text('Balance Due', cBalance, y, { align: 'right' });
  y += 8;
  rule(y);
  y += 16;

  doc.setFontSize(10);
  let total = 0;
  lines.forEach((l) => {
    total += l.paid;
    doc.setTextColor(30);
    doc.text(l.invoiceNumber, cInvoice, y);
    doc.text(fmt(l.paid), cPaid, y, { align: 'right' });
    if (hasBalance) {
      doc.setTextColor(typeof l.balanceDue === 'number' && l.balanceDue > 0 ? 180 : 150);
      doc.text(
        typeof l.balanceDue === 'number' ? (l.balanceDue > 0 ? fmt(l.balanceDue) : ', ') : ', ',
        cBalance,
        y,
        { align: 'right' }
      );
    }
    y += 18;
  });

  y += 4;
  rule(y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text('Total Paid', cInvoice, y);
  doc.text(fmt(total), cPaid, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  // ── Footer ──
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated for ${payment.vendor} · ${payment.paymentNumber}`,
    M,
    doc.internal.pageSize.getHeight() - M
  );
}
