import type { Payment, PayFromAccount } from '@/app/data/mockPayments';

/* ── NACHA file builder (P4 · Print, payment-run-flow.md) ─────────────
 * One file per originating account: file/batch headers, one PPD entry
 * per payment, one addenda per entry (memo, 80 chars max), control
 * totals, padded to a block of ten 94-character records. Routing and
 * account numbers are synthesized deterministically from the mock data;
 * the file is structurally faithful so it reads like the artifact a
 * bank portal expects. */

const COMPANY_NAME = 'OMNESOFT INC';
const COMPANY_ID = '1234567890';
const IMMEDIATE_DEST = '021000021'; // receiving point (mock)

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

const pad = (s: string, len: number) => s.slice(0, len).padEnd(len, ' ');
const num = (n: number, len: number) => String(Math.round(n)).padStart(len, '0').slice(-len);

/** 8-digit routing + ABA check digit for a mock bank identity. */
function routingFor(seed: string): string {
  const base = String(10000000 + (hash(seed) % 89999999));
  const d = base.split('').map(Number);
  const check = (10 - ((3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5])) % 10)) % 10;
  return base + String(check);
}

export interface NachaEntry {
  payment: Payment;
  /** Addenda payment detail, truncated to 80 characters. */
  addenda: string;
}

export interface NachaFile {
  fileName: string;
  content: string;
  entryCount: number;
  total: number;
}

export function buildNachaFile(account: PayFromAccount, entries: NachaEntry[], effectiveDate: string): NachaFile {
  const now = new Date();
  const yymmdd = (iso: string) => iso.slice(2).replace(/-/g, '');
  const fileDate = yymmdd(now.toISOString().split('T')[0]);
  const fileTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const odfi = routingFor(account.bankName ?? account.id);
  const odfi8 = odfi.slice(0, 8);
  const total = entries.reduce((s, e) => s + e.payment.amount, 0);
  const lines: string[] = [];

  // 1 · File header. Both routing fields are 10 wide: a lead space + 9
  // digits for the destination, the 10-digit company id for the origin.
  lines.push(
    `101 ${IMMEDIATE_DEST}${COMPANY_ID}${fileDate}${fileTime}A094101${pad('BANK OF FIRST DEPOSIT', 23)}${pad(COMPANY_NAME, 23)}${pad('', 8)}`,
  );
  // 5 · Batch header (220 = credits only)
  lines.push(
    `5220${pad(COMPANY_NAME, 16)}${pad('', 20)}${COMPANY_ID}PPD${pad('PAYABLES', 10)}${yymmdd(effectiveDate)}${yymmdd(effectiveDate)}   1${odfi8}${num(1, 7)}`,
  );

  let entryHash = 0;
  entries.forEach((entry, i) => {
    const p = entry.payment;
    const rdfi = routingFor(p.vendor);
    entryHash += Number(rdfi.slice(0, 8));
    const trace = `${odfi8}${num(i + 1, 7)}`;
    const acctNum = String(10000000 + (hash(`${p.vendor}-acct`) % 89999999));
    // 6 · PPD entry detail (22 = credit to checking), addenda indicator 1
    lines.push(
      `622${rdfi}${pad(acctNum, 17)}${num(p.amount * 100, 10)}${pad(p.paymentNumber, 15)}${pad(p.vendor.toUpperCase(), 22)}  1${trace}`,
    );
    // 7 · Addenda: free-form payment detail, 80 chars
    lines.push(`705${pad(entry.addenda, 80)}${num(1, 4)}${num(i + 1, 7)}`);
  });

  // 8 · Batch control
  const hash10 = num(entryHash % 10_000_000_000, 10);
  lines.push(
    `8220${num(entries.length * 2, 6)}${hash10}${num(0, 12)}${num(total * 100, 12)}${COMPANY_ID}${pad('', 25)}${odfi8}${num(1, 7)}`,
  );
  // 9 · File control
  const blockCount = Math.ceil((lines.length + 1) / 10);
  lines.push(
    `9${num(1, 6)}${num(blockCount, 6)}${num(entries.length * 2, 8)}${hash10}${num(0, 12)}${num(total * 100, 12)}${pad('', 39)}`,
  );
  // Pad to a full block of 10 with all-nines rows
  while (lines.length % 10 !== 0) lines.push('9'.repeat(94));

  return {
    fileName: `ACH-${account.id}-${effectiveDate}.ach`,
    content: lines.join('\n'),
    entryCount: entries.length,
    total,
  };
}

/** Same Blob download recipe as the payments CSV export. */
export function downloadNachaFile(file: NachaFile): void {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
