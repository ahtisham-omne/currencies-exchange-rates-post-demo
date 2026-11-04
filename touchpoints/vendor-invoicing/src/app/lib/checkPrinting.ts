/* ── Check printing domain core (BA spec, check-printing-spec.md 9/22) ──
 *
 * Preprinted check stock only: Omne prints variable data; MICR, routing,
 * bank and payer blocks are already on the paper. Two styles — Voucher
 * (one check per sheet, two stubs below) and Standard (three checks per
 * sheet, no stubs) — are the SAME object with different band roles,
 * never two code paths (spec §1).
 *
 * Everything is computed from a band's contentHeight, not its height:
 * band 3 is 4.0" tall but its check is still 3.5" — the extra 0.5" is a
 * tear-off strip (spec §2).
 */

import type { Payment } from '@/app/data/mockPayments';

// ── Geometry ─────────────────────────────────────────────────────────

export type CheckStyle = 'voucher' | 'standard' | 'middle';
export type BandRole = 'check' | 'stub';

export interface StockBand {
  seq: number;
  role: BandRole;
  offsetY: number;
  height: number;
  contentHeight: number;
  /** Stub copies label themselves (spec §5). */
  copy?: 'Vendor Copy' | 'Payer Copy';
}

export interface StockProfile {
  id: CheckStyle;
  displayName: string;
  description: string;
  sheet: { width: number; height: number; unit: 'in' };
  bands: StockBand[];
  perforations: number[];
  preprinted: boolean;
  numberingDirection: 'consecutive' | 'reverse';
}

export const STOCK_PROFILES: Record<CheckStyle, StockProfile> = {
  voucher: {
    id: 'voucher',
    displayName: 'Voucher Check',
    description: 'One check per sheet, two stubs below',
    sheet: { width: 8.5, height: 11.0, unit: 'in' },
    bands: [
      { seq: 1, role: 'check', offsetY: 0.0, height: 3.5, contentHeight: 3.5 },
      { seq: 2, role: 'stub', offsetY: 3.5, height: 3.5, contentHeight: 3.5, copy: 'Vendor Copy' },
      { seq: 3, role: 'stub', offsetY: 7.0, height: 4.0, contentHeight: 3.5, copy: 'Payer Copy' },
    ],
    perforations: [3.5, 7.0],
    preprinted: true,
    numberingDirection: 'consecutive',
  },
  standard: {
    id: 'standard',
    displayName: 'Standard Check',
    description: 'Three checks per sheet, no stubs',
    sheet: { width: 8.5, height: 11.0, unit: 'in' },
    bands: [
      { seq: 1, role: 'check', offsetY: 0.0, height: 3.5, contentHeight: 3.5 },
      { seq: 2, role: 'check', offsetY: 3.5, height: 3.5, contentHeight: 3.5 },
      { seq: 3, role: 'check', offsetY: 7.0, height: 4.0, contentHeight: 3.5 },
    ],
    perforations: [3.5, 7.0],
    preprinted: true,
    numberingDirection: 'consecutive',
  },
  // Check in the MIDDLE: a stub above and below the live check (one per
  // sheet) — the third layout the print flow offers.
  middle: {
    id: 'middle',
    displayName: 'Check in Middle',
    description: 'One check in the middle, a stub above and below',
    sheet: { width: 8.5, height: 11.0, unit: 'in' },
    bands: [
      { seq: 1, role: 'stub', offsetY: 0.0, height: 3.5, contentHeight: 3.5, copy: 'Vendor Copy' },
      { seq: 2, role: 'check', offsetY: 3.5, height: 3.5, contentHeight: 3.5 },
      { seq: 3, role: 'stub', offsetY: 7.0, height: 4.0, contentHeight: 3.5, copy: 'Payer Copy' },
    ],
    perforations: [3.5, 7.0],
    preprinted: true,
    numberingDirection: 'consecutive',
  },
};

/** The bottom 0.625" of every CHECK is the preprinted MICR line
 *  (ANSI X9.100-160-1) — measured from the check's bottom edge, i.e.
 *  contentHeight, not the band's height (spec §4). Nothing renders in
 *  it; violations FAIL the run rather than print through. */
export const CLEAR_BAND_IN = 0.625;

// ── Check face template (spec §3) ────────────────────────────────────
// Coordinates from the band's top-left, in inches. `suppress` fields are
// preprinted on the stock and omit when preprinted: true (always, v1) —
// the rows stay so blank stock can be added later without a rewrite.

export interface CheckFaceField {
  field: string;
  x: number;
  y: number;
  w: number;
  align: 'left' | 'right' | 'center';
  size: number;
  suppressIfPreprinted: boolean;
}

export const CHECK_FACE_TEMPLATE: CheckFaceField[] = [
  { field: 'payerBlock', x: 0.3, y: 0.2, w: 3.2, align: 'left', size: 9, suppressIfPreprinted: true },
  { field: 'bankBlock', x: 0.3, y: 1.0, w: 2.8, align: 'left', size: 8, suppressIfPreprinted: true },
  { field: 'checkNumber', x: 6.9, y: 0.2, w: 1.3, align: 'right', size: 12, suppressIfPreprinted: true },
  { field: 'date', x: 5.9, y: 0.95, w: 2.3, align: 'left', size: 10, suppressIfPreprinted: false },
  { field: 'payToLabel', x: 0.35, y: 1.45, w: 1.6, align: 'left', size: 6, suppressIfPreprinted: true },
  { field: 'payeeName', x: 0.35, y: 1.6, w: 5.6, align: 'left', size: 10, suppressIfPreprinted: false },
  { field: 'payeeAddress', x: 0.35, y: 1.82, w: 3.5, align: 'left', size: 9, suppressIfPreprinted: false },
  { field: 'amountNumeric', x: 6.55, y: 1.5, w: 1.65, align: 'right', size: 11, suppressIfPreprinted: false },
  { field: 'amountWords', x: 0.35, y: 2.1, w: 6.8, align: 'left', size: 10, suppressIfPreprinted: false },
  { field: 'dollarsLabel', x: 7.3, y: 2.1, w: 0.9, align: 'left', size: 8, suppressIfPreprinted: true },
  { field: 'memo', x: 0.35, y: 2.7, w: 3.0, align: 'left', size: 9, suppressIfPreprinted: false },
  { field: 'signatureLabel', x: 5.0, y: 2.9, w: 3.2, align: 'right', size: 6, suppressIfPreprinted: true },
];

// ── Amount in words ──────────────────────────────────────────────────

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} HUNDRED`);
    n %= 100;
  }
  if (n >= 20) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    parts.push(o ? `${t}-${ONES[o]}` : t);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** US check convention: "ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 56/100".
 *  The renderer pads with asterisks to the field's full width to prevent
 *  insertion fraud (spec §3). */
export function amountInWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const groups: string[] = [];
  const scales = [
    { div: 1_000_000_000, label: 'BILLION' },
    { div: 1_000_000, label: 'MILLION' },
    { div: 1_000, label: 'THOUSAND' },
  ];
  let rest = dollars;
  for (const s of scales) {
    if (rest >= s.div) {
      groups.push(`${belowThousand(Math.floor(rest / s.div))} ${s.label}`);
      rest %= s.div;
    }
  }
  if (rest > 0 || dollars === 0) groups.push(belowThousand(rest) || 'ZERO');
  return `${groups.join(' ')} AND ${String(cents).padStart(2, '0')}/100`;
}

// ── Per-bank-account check settings (spec §7, §8 setup) ──────────────
// Bound to the BANK ACCOUNT: one record — account, stock profile, next
// check number. In-memory module store; reload reset is by design.

export interface CheckAccountSettings {
  accountId: string;
  enabled: boolean;
  style: CheckStyle;
  nextCheckNumber: number;
  overflowPolicy: 'void_and_continue' | 'cap_and_split';
  maxInvoiceLines: number;
  /** Alignment offsets from the test-grid step (spec §8.6), inches. */
  offsetX: number;
  offsetY: number;
  /** Amount at/above which the dual-signature warning raises (spec §8.9). */
  dualSignatureThreshold: number;
}

const accountSettings = new Map<string, CheckAccountSettings>();

// Seeded starting numbers keep the spec's own example alive on the
// demo's main disbursement accounts.
const SEED_NEXT: Record<string, number> = {
  '1020-Payroll': 46350,
  '1030-AP Disbursements': 20114,
  '1010-Operating': 88201,
};

export function checkSettingsFor(accountId: string): CheckAccountSettings {
  let s = accountSettings.get(accountId);
  if (!s) {
    s = {
      accountId,
      enabled: true,
      style: 'voucher',
      nextCheckNumber: SEED_NEXT[accountId] ?? 10001,
      overflowPolicy: 'void_and_continue',
      maxInvoiceLines: 10,
      offsetX: 0,
      offsetY: 0,
      dualSignatureThreshold: 25000,
    };
    accountSettings.set(accountId, s);
  }
  return s;
}

export function updateCheckSettings(accountId: string, patch: Partial<CheckAccountSettings>): CheckAccountSettings {
  const next = { ...checkSettingsFor(accountId), ...patch, accountId };
  accountSettings.set(accountId, next);
  return next;
}

// ── Check register (spec §8.16) ──────────────────────────────────────
// Every number, its status and payee, per bank account. Void is a first
// class record, never a delete — the number stays consumed and gaps must
// be explainable.

export type CheckStatus = 'Issued' | 'Void' | 'Cleared';

export interface CheckRegisterEntry {
  number: number;
  bankAccountId: string;
  status: CheckStatus;
  payee: string;
  amount: number;
  date: string;
  /** Reason code on voids: stub_overflow · print_failure · reprint · manual_void. */
  reason?: string;
  paymentRef?: string;
  /** Who confirmed the print and when (user 10/5): the register is the
   *  audit trail, so the confirmation stamps onto every issued number. */
  printedBy?: string;
  printedAt?: string;
}

const register: CheckRegisterEntry[] = [
  // A short seeded history on the corporate checking account so the
  // register reads alive on first open (Cleared → Issued → one explained
  // void). Numbers sit BELOW the seeded next number 46350.
  { number: 46346, bankAccountId: '1020-Payroll', status: 'Cleared', payee: 'Global Materials Corp', amount: 18240.5, date: '2026-09-08', paymentRef: 'PMT-000341' },
  { number: 46347, bankAccountId: '1020-Payroll', status: 'Cleared', payee: 'Premier Automotive', amount: 7315.0, date: '2026-09-08', paymentRef: 'PMT-000342' },
  { number: 46348, bankAccountId: '1020-Payroll', status: 'Void', payee: 'Mountain Equipment Co.', amount: 12580.25, date: '2026-09-15', reason: 'print_failure', paymentRef: 'PMT-000355' },
  { number: 46349, bankAccountId: '1020-Payroll', status: 'Issued', payee: 'Mountain Equipment Co.', amount: 12580.25, date: '2026-09-15', reason: 'reprint of 46348', paymentRef: 'PMT-000355' },
];

export function checkRegisterFor(accountId: string): CheckRegisterEntry[] {
  return register
    .filter((e) => e.bankAccountId === accountId)
    .sort((a, b) => b.number - a.number);
}

export function recordChecks(entries: CheckRegisterEntry[]): void {
  register.push(...entries);
}

export function voidCheck(accountId: string, number: number, reason: string): void {
  const e = register.find((r) => r.bankAccountId === accountId && r.number === number);
  if (e) {
    e.status = 'Void';
    e.reason = reason;
  }
}

// ── Print run assembly (spec §6, §7) ─────────────────────────────────

export interface StubLine {
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  gross: number;
  discount: number;
  adjustment: number;
  net: number;
}

export interface CheckPaymentInput {
  paymentRef: string;
  payee: string;
  payeeAddress?: string;
  date: string;
  memo: string;
  total: number;
  lines: StubLine[];
  remittanceEmail?: string;
}

/** The check for a RECORDED payment (10/15): built from the saved record,
 *  never from a form — after recording, the form's invoices already read
 *  paid, so rebuilding from them printed the wrong stub. One builder for
 *  the post-record prompt and the payment detail's Print check. */
export function checkInputForPayment(payment: Payment): CheckPaymentInput {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const splits = new Map((payment.perInvoiceSplit ?? []).map((s) => [s.invoiceNumber, s]));
  const anchoredPrepay = payment.type === 'Prepayment';
  const lines: StubLine[] = payment.appliedInvoices.length > 0
    ? payment.appliedInvoices.map((inv) => {
        const split = splits.get(inv.invoiceNumber);
        const credit = split ? round2(split.credit) : 0;
        const net = split ? round2(split.cash) : round2(inv.amount);
        return {
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: payment.paymentDate,
          description: anchoredPrepay ? `Prepayment on ${inv.invoiceNumber}` : 'Invoice payment',
          gross: round2(net + credit),
          discount: 0,
          adjustment: credit,
          net,
        };
      })
    : [{
        invoiceNumber: payment.linkedPO ? `Advance on PO ${payment.linkedPO}` : 'Advance',
        invoiceDate: payment.paymentDate,
        description: 'Vendor credit (advance)',
        gross: payment.amount,
        discount: 0,
        adjustment: 0,
        net: payment.amount,
      }];
  return {
    paymentRef: payment.paymentNumber,
    payee: payment.vendor,
    date: payment.paymentDate,
    memo: payment.printMemo || payment.memo || `Payment to ${payment.vendor}`,
    total: payment.amount,
    lines,
    remittanceEmail: `ap@${payment.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
  };
}

export interface RenderedCheck {
  number: number;
  void: boolean;
  voidReason?: string;
  payee: string;
  payeeAddress?: string;
  date: string;
  memo: string;
  amount: number;
  paymentRef: string;
}

export interface RenderedBand {
  role: BandRole;
  band: StockBand;
  /** role 'check': the face; a band left empty on a partial Standard
   *  sheet carries neither. */
  check?: RenderedCheck;
  /** role 'stub' (voucher only). */
  stub?: {
    copy: string;
    checkNumber: number;
    isVoid: boolean;
    payee: string;
    date: string;
    total: number;
    lines: StubLine[];
    continued: boolean;
  };
  /** Standard partial first sheet: band intentionally skipped. */
  skipped?: boolean;
}

export interface RenderedSheet {
  seq: number;
  bands: RenderedBand[];
}

export interface PaymentAssignment {
  paymentRef: string;
  payee: string;
  total: number;
  lineCount: number;
  liveNumbers: number[];
  voidNumbers: number[];
  warnings: string[];
}

export interface CheckPrintRun {
  style: CheckStyle;
  profile: StockProfile;
  sheets: RenderedSheet[];
  assignments: PaymentAssignment[];
  startingNumber: number;
  /** Last number CONSUMED (live or void). */
  endingNumber: number;
  checksOnFirstPage: number;
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildWarnings(p: CheckPaymentInput, settings: CheckAccountSettings): string[] {
  const w: string[] = [];
  if ((settings.style === 'voucher' || settings.style === 'middle') && p.lines.length > settings.maxInvoiceLines) {
    w.push(
      settings.overflowPolicy === 'void_and_continue'
        ? `${p.lines.length} invoice lines exceed the ${settings.maxInvoiceLines}-line stub. Earlier sheets print VOID and the final sheet carries the live check.`
        : `${p.lines.length} invoice lines exceed the ${settings.maxInvoiceLines}-line stub. The payment splits into ${Math.ceil(p.lines.length / settings.maxInvoiceLines)} checks.`,
    );
  }
  if (p.total >= settings.dualSignatureThreshold) {
    w.push(`${money(p.total)} meets the dual signature threshold of ${money(settings.dualSignatureThreshold)}.`);
  }
  if (settings.style === 'standard' && !p.remittanceEmail) {
    w.push('Standard stock prints no stub and this vendor has no remittance email on file.');
  }
  return w;
}

/** Assemble the full run: sheets, numbering, overflow handling. Pure —
 *  nothing is recorded until the blocking confirm (spec §8.13). */
export function buildCheckPrintRun(
  payments: CheckPaymentInput[],
  settings: CheckAccountSettings,
  startingNumber: number,
  checksOnFirstPage: 1 | 2 | 3 = 3,
): CheckPrintRun {
  const profile = STOCK_PROFILES[settings.style];
  const sheets: RenderedSheet[] = [];
  const assignments: PaymentAssignment[] = [];
  let nextNumber = startingNumber;

  // Voucher and middle are both ONE live check per sheet with stub(s); only
  // the check's position on the page differs (top vs centre), which the
  // profile's bands already encode. Standard packs three checks per sheet.
  if (settings.style === 'voucher' || settings.style === 'middle') {
    for (const p of payments) {
      const a: PaymentAssignment = {
        paymentRef: p.paymentRef,
        payee: p.payee,
        total: p.total,
        lineCount: p.lines.length,
        liveNumbers: [],
        voidNumbers: [],
        warnings: buildWarnings(p, settings),
      };
      const max = settings.maxInvoiceLines;

      if (p.lines.length > max && settings.overflowPolicy === 'cap_and_split') {
        // Alternative policy (spec §6): each check covers ≤ max lines.
        for (let i = 0; i < p.lines.length; i += max) {
          const slice = p.lines.slice(i, i + max);
          const sliceTotal = Math.round(slice.reduce((s, l) => s + l.net, 0) * 100) / 100;
          const number = nextNumber++;
          a.liveNumbers.push(number);
          sheets.push(
            voucherSheet(profile, sheets.length + 1, {
              number, void: false, payee: p.payee, payeeAddress: p.payeeAddress,
              date: p.date, memo: p.memo, amount: sliceTotal, paymentRef: p.paymentRef,
            }, slice, false),
          );
        }
      } else {
        // Default policy, void and continue (spec §6): stub lines flow
        // across sheets; every sheet but the last prints VOID across its
        // check face; the final sheet carries the live check + total.
        const chunks: StubLine[][] = [];
        for (let i = 0; i < Math.max(p.lines.length, 1); i += max) {
          chunks.push(p.lines.slice(i, i + max));
        }
        chunks.forEach((slice, idx) => {
          const last = idx === chunks.length - 1;
          const number = nextNumber++;
          if (last) a.liveNumbers.push(number);
          else a.voidNumbers.push(number);
          sheets.push(
            voucherSheet(profile, sheets.length + 1, {
              number, void: !last, voidReason: last ? undefined : 'stub_overflow',
              payee: p.payee, payeeAddress: p.payeeAddress, date: p.date,
              memo: p.memo, amount: p.total, paymentRef: p.paymentRef,
            }, slice, idx > 0),
          );
        });
      }
      assignments.push(a);
    }
  } else {
    // Standard: three checks per sheet, no stubs. checksOnFirstPage lets
    // a partial sheet already in the tray be used up (spec §8.10) — the
    // FIRST sheet's top bands are skipped so printing starts on the
    // remaining live checks.
    const faces: RenderedCheck[] = payments.map((p) => {
      const number = nextNumber++;
      assignments.push({
        paymentRef: p.paymentRef,
        payee: p.payee,
        total: p.total,
        lineCount: p.lines.length,
        liveNumbers: [number],
        voidNumbers: [],
        warnings: buildWarnings(p, settings),
      });
      return {
        number, void: false, payee: p.payee, payeeAddress: p.payeeAddress,
        date: p.date, memo: p.memo, amount: p.total, paymentRef: p.paymentRef,
      };
    });

    let i = 0;
    let firstSheetSkip = 3 - checksOnFirstPage;
    while (i < faces.length) {
      const bands: RenderedBand[] = [];
      for (const band of profile.bands) {
        if (firstSheetSkip > 0 && sheets.length === 0 && bands.filter((b) => b.skipped).length < firstSheetSkip) {
          bands.push({ role: 'check', band, skipped: true });
          continue;
        }
        if (i < faces.length) {
          bands.push({ role: 'check', band, check: faces[i++] });
        } else {
          bands.push({ role: 'check', band, skipped: true });
        }
      }
      sheets.push({ seq: sheets.length + 1, bands });
      firstSheetSkip = 0;
    }
  }

  return {
    style: settings.style,
    profile,
    sheets,
    assignments,
    startingNumber,
    endingNumber: nextNumber - 1,
    checksOnFirstPage,
  };
}

function voucherSheet(
  profile: StockProfile,
  seq: number,
  check: RenderedCheck,
  lines: StubLine[],
  continued: boolean,
): RenderedSheet {
  const bands: RenderedBand[] = profile.bands.map((band) =>
    band.role === 'check'
      ? { role: 'check' as const, band, check }
      : {
          role: 'stub' as const,
          band,
          stub: {
            copy: band.copy ?? '',
            checkNumber: check.number,
            isVoid: check.void,
            payee: check.payee,
            date: check.date,
            total: check.amount,
            lines,
            continued,
          },
        },
  );
  return { seq, bands };
}

/** All numbers a run consumes, in order — feeds the blocking confirm's
 *  "Did checks X to Y print correctly?" and the some-failed void path. */
export function consumedNumbers(run: CheckPrintRun): number[] {
  const nums: number[] = [];
  for (const a of run.assignments) nums.push(...a.liveNumbers, ...a.voidNumbers);
  return nums.sort((x, y) => x - y);
}
