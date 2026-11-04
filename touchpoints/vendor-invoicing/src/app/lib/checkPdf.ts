/* ── Check PDF renderer (BA spec §3-§6, §8.11-12) ─────────────────────
 * The preview IS the real PDF at 100%: US letter, inches, scaling locked
 * — the same document goes to paper. Variable data prints in black; the
 * optional stock underlay draws the preprinted elements (payer block,
 * bank block, check number, labels, perforations) in light grey so the
 * clerk can judge alignment on screen. The underlay never ships to the
 * printer: real stock already carries it.
 *
 * The 0.625" clear band (ANSI X9.100-160-1) is validated at render time:
 * any printed field entering it FAILS the run rather than printing a
 * check the bank's reader can't process (spec §4).
 */

import {
  CHECK_FACE_TEMPLATE,
  CLEAR_BAND_IN,
  amountInWords,
  type CheckAccountSettings,
  type CheckPrintRun,
  type RenderedBand,
  type StubLine,
} from './checkPrinting';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

/** Field height approximation for clear-band validation: pt → in. */
const sizeIn = (pt: number) => pt / 72;

export class ClearBandViolation extends Error {
  constructor(field: string, checkNumber: number) {
    super(
      `"${field}" on check ${checkNumber} enters the 0.625" MICR clear band. The run failed rather than print an unreadable check.`,
    );
  }
}

export interface CheckPdfOptions {
  /** Draw the preprinted stock in light grey for on-screen alignment. */
  underlay: boolean;
  payerName: string;
  payerAddress: string;
  bankLabel: string;
}

export async function buildCheckRunPdf(
  run: CheckPrintRun,
  settings: CheckAccountSettings,
  opts: CheckPdfOptions,
): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  run.sheets.forEach((sheet, si) => {
    if (si > 0) doc.addPage();
    if (opts.underlay) {
      // Perforations at 3.5 and 7.0 (spec §2).
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([0.06, 0.06], 0);
      run.profile.perforations.forEach((y) => doc.line(0, y, 8.5, y));
      doc.setLineDashPattern([], 0);
    }
    for (const band of sheet.bands) {
      if (band.skipped) {
        if (opts.underlay && run.style === 'standard') {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(203, 213, 225);
          doc.text('Already used on a previous run, left blank', 4.25, band.band.offsetY + 1.75, { align: 'center' });
        }
        continue;
      }
      if (band.role === 'check' && band.check) drawCheckFace(doc, band, settings, opts);
      if (band.role === 'stub' && band.stub) drawStub(doc, band, opts);
    }
  });

  return doc.output('bloburl') as unknown as string;
}

// ── Check face (spec §3) ─────────────────────────────────────────────

function drawCheckFace(
  doc: any,
  band: RenderedBand,
  settings: CheckAccountSettings,
  opts: CheckPdfOptions,
) {
  const check = band.check!;
  const oy = band.band.offsetY + settings.offsetY;
  const ox = settings.offsetX;
  const contentH = band.band.contentHeight;
  const clearTop = contentH - CLEAR_BAND_IN;

  const get = (f: string) => CHECK_FACE_TEMPLATE.find((t) => t.field === f)!;

  const put = (
    field: string,
    text: string,
    color: [number, number, number] = [15, 23, 42],
    bold = false,
  ) => {
    const t = get(field);
    // Clear-band rule (spec §4): validate what WE print, never print
    // through. Preprinted (suppressed) fields are the stock's own ink —
    // the signature label legitimately lives inside the band.
    if (!t.suppressIfPreprinted && t.y + sizeIn(t.size) > clearTop) {
      throw new ClearBandViolation(t.field, check.number);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(t.size);
    doc.setTextColor(...color);
    const x = ox + (t.align === 'right' ? t.x + t.w : t.align === 'center' ? t.x + t.w / 2 : t.x);
    doc.text(text, x, oy + t.y + sizeIn(t.size), { align: t.align === 'left' ? undefined : t.align });
  };

  // Preprinted underlay — grey, screen-only (spec: suppress on paper).
  if (opts.underlay) {
    const grey: [number, number, number] = [148, 163, 184];
    put('payerBlock', `${opts.payerName}  ·  ${opts.payerAddress}`, grey);
    put('bankBlock', opts.bankLabel, grey);
    put('checkNumber', `No. ${check.number}`, grey, true);
    put('payToLabel', 'Pay to the Order of', grey);
    put('dollarsLabel', 'Dollars', grey);
    put('signatureLabel', 'Authorized Signature', grey);
    // Signature rule + amount box outline.
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.008);
    doc.line(ox + 5.0, oy + 2.62, ox + 8.2, oy + 2.62);
    doc.rect(ox + 6.5, oy + 1.38, 1.75, 0.28);
    // MICR clear band marker.
    doc.setFillColor(248, 250, 252);
    doc.rect(0, band.band.offsetY + clearTop, 8.5, CLEAR_BAND_IN, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text('⑆012345678⑆  1234567890⑈  MICR clear band, preprinted', 0.6, band.band.offsetY + clearTop + 0.38);
  }

  // Variable data — what actually prints.
  put('date', fmtDate(check.date));
  put('payeeName', check.payee, [15, 23, 42], true);
  if (check.payeeAddress) put('payeeAddress', check.payeeAddress);
  put('amountNumeric', `**${check.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [15, 23, 42], true);

  // Amount in words, asterisk-padded to the field's full 6.8" width so
  // nothing can be inserted after it (spec §3).
  {
    const t = get('amountWords');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(t.size);
    doc.setTextColor(15, 23, 42);
    let words = amountInWords(check.amount);
    if (doc.getTextWidth(words) > t.w) {
      doc.setFontSize(8);
    }
    let padded = `${words} `;
    while (doc.getTextWidth(`${padded}*`) < t.w) padded += '*';
    doc.text(padded, ox + t.x, oy + t.y + sizeIn(t.size));
  }

  if (check.memo) put('memo', `Memo  ${check.memo}`, [71, 85, 105]);

  // VOID overlay — void-and-continue overflow sheets (spec §6).
  if (check.void) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(64);
    doc.setTextColor(203, 213, 225);
    doc.text('Void', 4.25, oy + 2.3, { align: 'center', angle: 12 });
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    // No check number on paper (user 10/5): the stock carries its own.
    doc.text(`Voided, ${check.voidReason === 'stub_overflow' ? 'stub overflow' : check.voidReason ?? ''} · the number stays consumed on the register`, 4.25, oy + 3.05, { align: 'center' });
  }
}

// ── Stub (spec §5, voucher only) ─────────────────────────────────────

const STUB_COLUMNS: { key: keyof StubLine | 'invoiceNumber'; label: string; x: number; w: number; align: 'left' | 'right' }[] = [
  { key: 'invoiceNumber', label: 'Invoice', x: 0.3, w: 1.4, align: 'left' },
  { key: 'invoiceDate', label: 'Date', x: 1.75, w: 0.9, align: 'left' },
  { key: 'description', label: 'Description / PO', x: 2.7, w: 2.0, align: 'left' },
  { key: 'gross', label: 'Gross', x: 4.8, w: 1.0, align: 'right' },
  { key: 'discount', label: 'Discount', x: 5.85, w: 0.85, align: 'right' },
  { key: 'adjustment', label: 'Adjustment', x: 6.75, w: 0.85, align: 'right' },
  { key: 'net', label: 'Net Paid', x: 7.65, w: 0.85, align: 'right' },
];

function drawStub(doc: any, band: RenderedBand, opts: CheckPdfOptions) {
  const stub = band.stub!;
  const oy = band.band.offsetY;
  const contentH = band.band.contentHeight;

  // Header, y 0.15-0.85 (user 10/5 spec step 4): the stubs print the
  // payee, the CHECK NUMBER REFERENCE, each invoice line and the total.
  // No company name or address — the stock carries those. (The check
  // FACE still prints no number; only the stubs reference it.)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`${stub.payee}${stub.continued ? '  ·  continued' : ''}`, 0.3, oy + 0.32);
  doc.text(`Check ${stub.checkNumber}${stub.isVoid ? ' · Void' : ''}`, 8.2, oy + 0.32, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${fmtDate(stub.date)}   ·   Check Total ${money(stub.total)}`, 8.2, oy + 0.5, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.008);
  doc.line(0.3, oy + 0.62, 8.2, oy + 0.62);

  // Copy label (both stubs identical content, labeled).
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(stub.copy, 8.2, oy + 0.18, { align: 'right' });

  // Detail table, y 0.90 → contentHeight − 0.45, max 10 lines.
  const headY = oy + 0.9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  for (const c of STUB_COLUMNS) {
    doc.text(c.label, c.align === 'right' ? c.x + c.w : c.x, headY, { align: c.align === 'right' ? 'right' : undefined });
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(0.3, headY + 0.05, 8.2, headY + 0.05);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const rowH = 0.185;
  stub.lines.forEach((line, i) => {
    const y = headY + 0.2 + i * rowH;
    const cells: Record<string, string> = {
      invoiceNumber: line.invoiceNumber,
      invoiceDate: line.invoiceDate ? fmtDate(line.invoiceDate) : '',
      description: line.description,
      gross: money(line.gross),
      discount: line.discount > 0 ? `−${money(line.discount)}` : '—',
      adjustment: line.adjustment !== 0 ? `−${money(Math.abs(line.adjustment))}` : '—',
      net: money(line.net),
    };
    for (const c of STUB_COLUMNS) {
      let text = cells[c.key as string] ?? '';
      while (text.length > 1 && doc.getTextWidth(text) > c.w - 0.05) text = `${text.slice(0, -2)}…`;
      doc.text(text, c.align === 'right' ? c.x + c.w : c.x, y, { align: c.align === 'right' ? 'right' : undefined });
    }
  });

  // Totals row per numeric column (spec §5 footer).
  const totY = oy + contentH - 0.32;
  doc.setDrawColor(148, 163, 184);
  doc.line(0.3, totY - 0.14, 8.2, totY - 0.14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const sum = (k: 'gross' | 'discount' | 'adjustment' | 'net') =>
    Math.round(stub.lines.reduce((s, l) => s + l[k], 0) * 100) / 100;
  doc.text(`${stub.lines.length} invoice${stub.lines.length === 1 ? '' : 's'}`, 0.3, totY);
  doc.text(money(sum('gross')), 5.8, totY, { align: 'right' });
  doc.text(sum('discount') > 0 ? `−${money(sum('discount'))}` : '—', 6.7, totY, { align: 'right' });
  doc.text(sum('adjustment') !== 0 ? `−${money(Math.abs(sum('adjustment')))}` : '—', 7.6, totY, { align: 'right' });
  doc.text(money(sum('net')), 8.5 - 0.3, totY, { align: 'right' });
}

// ── Alignment test grid (spec §8.6) ──────────────────────────────────
// A quarter-inch grid printed on blank paper, held over a real check to
// read the offsets off the ruler marks.

export async function buildAlignmentGridPdf(): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.004);
  for (let x = 0; x <= 8.5; x += 0.25) doc.line(x, 0, x, 11);
  for (let y = 0; y <= 11; y += 0.25) doc.line(0, y, 8.5, y);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.01);
  for (let x = 0; x <= 8.5; x += 1) doc.line(x, 0, x, 11);
  for (let y = 0; y <= 11; y += 1) doc.line(0, y, 8.5, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(59, 130, 246);
  for (let x = 1; x < 8.5; x += 1) doc.text(String(x), x + 0.03, 0.18);
  for (let y = 1; y < 11; y += 1) doc.text(String(y), 0.06, y + 0.14);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Alignment test grid. Print at 100%, hold over a real check, read the offsets and enter them in Check Printing Setup.', 0.3, 10.7);
  return doc.output('bloburl') as unknown as string;
}
