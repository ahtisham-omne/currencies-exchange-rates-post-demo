import { jsPDF } from 'jspdf';
import type { Payment } from '@/app/data/mockPayments';
import { mockInvoices } from '@/app/data/mockInvoices';

// Simulated check print (feedback 7/21/26): renders a business check and
// opens it in a new tab so the user previews exactly what goes to the
// printer. Same jsPDF channel as remittanceAdvice.ts.
//
// Check-stock layouts (Eli 7/24/26): the customer configures what their
// physical check stock looks like. The standard US business check is a
// three-part perforated form — check on top, two duplicate stubs below
// listing each invoice being paid (one copy mailed with the check, one
// kept in the records). Variants: check in the middle with print area
// above and below, or plain stacked checks with no stub area at all.
// The check-run work hooks in here next (batch printing, 7/24/26).

export type CheckStockLayout = 'top' | 'middle' | 'none';

const LAYOUT_KEY = 'omnesoft:check-stock-layout';

export const CHECK_STOCK_OPTIONS: { key: CheckStockLayout; label: string; desc: string }[] = [
  { key: 'top', label: 'Check on Top', desc: 'Standard 3 part form, two stubs below' },
  { key: 'middle', label: 'Check in the Middle', desc: 'Stub above and below the check' },
  { key: 'none', label: 'Plain Stacked Checks', desc: 'No stub area, check only' },
];

export function getCheckStockLayout(): CheckStockLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw === 'top' || raw === 'middle' || raw === 'none') return raw;
  } catch { /* storage blocked — fall through to default */ }
  return 'top';
}

export function setCheckStockLayout(layout: CheckStockLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch { /* storage blocked — setting just doesn't persist */ }
}

// TODO: payer company details — pull from org/company settings.
const PAYER = {
  name: 'Omnesoft, Inc.',
  lines: ['1200 Market Street, Suite 400', 'San Francisco, CA 94103'],
};

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** "49,316.00" → "forty-nine thousand three hundred sixteen and 00/100". */
export function amountInWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const groups: Array<[number, string]> = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];
  let rest = dollars;
  const parts: string[] = [];
  groups.forEach(([size, label]) => {
    if (rest >= size) {
      parts.push(`${belowThousand(Math.floor(rest / size))} ${label}`);
      rest %= size;
    }
  });
  if (rest > 0 || parts.length === 0) parts.push(belowThousand(rest) || 'zero');
  return `${parts.join(' ')} and ${String(cents).padStart(2, '0')}/100`;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// US business-check proportions: 8.5in wide; the check band is 3.5in tall.
const W = 612;
const CHECK_H = 252;
const PAGE_H = 792;
const M = 28;

/** The check band itself, drawn with its top edge at `top`.
 *
 *  Ghosted stock (Eli 9/25): the preview must show what ACTUALLY prints.
 *  Everything pre-printed on the physical check stock — the payer block,
 *  bank name, check number, field labels, rules, the amount box, the
 *  signature line, and the MICR strip — renders in light grey; only the
 *  variable data the printer lays down (date, payee, amount numerals,
 *  amount in words, memo text) prints in full ink. The check number is
 *  never printed: it comes pre-printed on the stock. */
const GHOST = 200; // pre-printed stock ink
const GHOST_LINE = 210;
function drawCheck(doc: jsPDF, payment: Payment, top: number): void {
  // ── Pre-printed stock, ghosted ──
  // Border
  doc.setDrawColor(GHOST_LINE);
  doc.setLineWidth(1);
  doc.rect(8, top + 8, W - 16, CHECK_H - 16);

  // Payer block (top left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(GHOST);
  doc.text(PAYER.name, M, top + 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  PAYER.lines.forEach((l, i) => doc.text(l, M, top + 46 + i * 10));

  // Bank + check number (top right) — both pre-printed on the stock.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(payment.bankAccount, W - M, top + 34, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(payment.reference || 'Check', W - M, top + 48, { align: 'right' });

  // Field labels + rules
  doc.setFontSize(9);
  doc.text('Date', W - 170, top + 74);
  doc.setDrawColor(GHOST_LINE);
  doc.setLineWidth(0.75);
  doc.line(W - 145, top + 77, W - M, top + 77);
  doc.setFontSize(8);
  doc.text('Pay to the', M, top + 100);
  doc.text('Order of', M, top + 110);
  doc.line(M + 54, top + 111, W - 150, top + 111);
  // Amount box
  doc.rect(W - 140, top + 92, 112, 24);
  // Amount-in-words rule
  doc.line(M, top + 142, W - M, top + 142);
  // Memo label + signature rule
  doc.setFontSize(8);
  doc.text('Memo', M, top + 194);
  doc.line(W - 220, top + 203, W - M, top + 203);
  doc.setFontSize(7);
  doc.text('Authorized Signature', W - 122, top + 212, { align: 'center' });

  // MICR strip — pre-printed magnetic ink, never ours to print.
  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  const checkNo = (payment.reference || '').replace(/\D/g, '') || '000000';
  doc.text(`C${checkNo}C  A123456789A  9876543210C`, M, top + CHECK_H - 22);

  // ── Variable data — the only ink the printer lays down ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20);
  doc.text(payment.paymentDate, W - 140, top + 74);

  doc.setFontSize(12);
  doc.text(payment.vendor, M + 58, top + 107);

  doc.setFontSize(13);
  doc.text(fmt(payment.amount), W - 84, top + 108, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const words = `${amountInWords(payment.amount)} dollars`;
  doc.text(words.charAt(0).toUpperCase() + words.slice(1), M, top + 138);

  // Memo text — wraps to a second printed line when it overflows (Eli
  // confirmed memo wrap is fine, 7/24/26).
  doc.setTextColor(60);
  doc.setFontSize(9);
  const memoText =
    payment.printMemo
    || payment.memo
    || `${payment.paymentNumber} · ${payment.appliedInvoices.map((a) => a.invoiceNumber).join(', ')}`;
  const memoLines = (doc.splitTextToSize(memoText, 230) as string[]).slice(0, 2);
  memoLines.forEach((l, i) => doc.text(l, M + 32, top + 194 + i * 11));
  doc.setDrawColor(160);
  doc.line(M + 28, top + 197 + (memoLines.length - 1) * 11, M + 260, top + 197 + (memoLines.length - 1) * 11);

  // Reset to the default font for whatever draws next.
  doc.setFont('helvetica', 'normal');
}

/** Preview-only legend line explaining the ghosting (Eli 9/25). */
function drawLegend(doc: jsPDF, y: number): void {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text('Preview note: solid ink is what prints. Ghosted elements, including the check number, are pre-printed on the check stock.', M, y);
  doc.setFont('helvetica', 'normal');
}

/** Dashed perforation rule at `y` — where the stock tears apart. */
function drawPerforation(doc: jsPDF, y: number): void {
  doc.setDrawColor(170);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(8, y, W - 8, y);
  doc.setLineDashPattern([], 0);
}

/** One stub band: header + the invoice detail table, duplicated per copy.
 *  Lists each invoice's number, description and amount — "what am I paying
 *  with this check" (Eli 7/24/26). */
function drawStub(doc: jsPDF, payment: Payment, top: number, height: number, caption: string): void {
  const innerTop = top + 24;

  // Header row: payer + payment identity left, copy caption right.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20);
  doc.text(`${PAYER.name} · ${payment.vendor}`, M, innerTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    `${payment.paymentNumber} · ${payment.paymentDate}${payment.reference ? ` · Check ${payment.reference}` : ''}`,
    M,
    innerTop + 12,
  );
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(caption, W - M, innerTop, { align: 'right' });

  // Table head
  const tableTop = innerTop + 28;
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice', M, tableTop);
  doc.text('Description', M + 92, tableTop);
  doc.text('Amount', W - M, tableTop, { align: 'right' });
  doc.setDrawColor(190);
  doc.setLineWidth(0.5);
  doc.line(M, tableTop + 4, W - M, tableTop + 4);

  // Rows — one per applied invoice; a prepayment (no applied docs) notes
  // the advance instead. Rows that don't fit collapse into a "+N more" line.
  const rows = payment.appliedInvoices.length > 0
    ? payment.appliedInvoices.map((a) => ({
        number: a.invoiceNumber,
        description: mockInvoices.find((i) => i.invoiceNumber === a.invoiceNumber)?.description ?? '',
        amount: a.amount,
      }))
    : [{ number: payment.paymentNumber, description: 'Vendor prepayment, held on account', amount: payment.amount }];

  const rowH = 13;
  const maxRows = Math.max(1, Math.floor((height - (tableTop - top) - 34) / rowH));
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows;
  let y = tableTop + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  shown.forEach((r) => {
    doc.setTextColor(40);
    doc.text(r.number, M, y);
    doc.setTextColor(90);
    const desc = r.description.length > 68 ? `${r.description.slice(0, 67)}…` : r.description;
    doc.text(desc, M + 92, y);
    doc.setTextColor(40);
    doc.text(fmt(r.amount), W - M, y, { align: 'right' });
    y += rowH;
  });
  if (rows.length > shown.length) {
    doc.setTextColor(120);
    doc.text(`+${rows.length - shown.length} more invoice${rows.length - shown.length === 1 ? '' : 's'}`, M, y);
    y += rowH;
  }

  // Total rule
  doc.setDrawColor(190);
  doc.line(W - 170, y - 8, W - M, y - 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20);
  doc.text(`Total  ${fmt(payment.amount)}`, W - M, y + 2, { align: 'right' });
}

export function printCheck(payment: Payment): void {
  const layout = getCheckStockLayout();

  // Plain stacked stock: the check only, on its own slip — plus a short
  // preview strip below the band carrying the ghosting legend (the strip
  // exists only in this on-screen preview, never on the stock).
  if (layout === 'none') {
    const doc = new jsPDF({ unit: 'pt', format: [W, CHECK_H + 26], orientation: 'landscape' });
    drawCheck(doc, payment, 0);
    drawLegend(doc, CHECK_H + 14);
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  // Stub stock: a full 8.5in × 11in page. Two duplicate stubs — one mailed
  // with the check, one detached and kept in the records.
  const doc = new jsPDF({ unit: 'pt', format: [W, PAGE_H], orientation: 'portrait' });
  const stubH = (PAGE_H - CHECK_H) / 2;
  if (layout === 'top') {
    drawCheck(doc, payment, 0);
    drawPerforation(doc, CHECK_H);
    drawStub(doc, payment, CHECK_H, stubH, 'Remittance Copy · Mail with Check');
    drawPerforation(doc, CHECK_H + stubH);
    drawStub(doc, payment, CHECK_H + stubH, stubH, 'File Copy · Keep for Records');
  } else {
    drawStub(doc, payment, 0, stubH, 'File Copy · Keep for Records');
    drawPerforation(doc, stubH);
    drawCheck(doc, payment, stubH);
    drawPerforation(doc, stubH + CHECK_H);
    drawStub(doc, payment, stubH + CHECK_H, stubH, 'Remittance Copy · Mail with Check');
  }
  drawLegend(doc, PAGE_H - 8);
  window.open(doc.output('bloburl'), '_blank');
}
