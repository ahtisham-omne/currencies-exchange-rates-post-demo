import { getSystemSettings, formatDocumentNumber } from '@/app/hooks/useSystemSettings';

// Internal IDs (10/29): prefix + six-digit sequence, no year, one format
// everywhere: INV-000001, PMT-000001, RUN-000001, CRN-, PRE-, DEP-.
const six = (n: number) => String(n).padStart(6, '0');
export function formatInvoiceId(n: number, prefix: 'INV' | 'CRN' | 'PRE' = 'INV'): string {
  return `${prefix}-${six(n)}`;
}
export function formatRunId(n: number): string {
  return `RUN-${six(n)}`;
}

// Payment IDs (10/29): PMT-000001, PMT-000002, ... one sequence for every vendor
// payment record (payments and advances), seeds included. New records
// claim the next number; the record-payment form previews it first.
export function formatPaymentId(n: number): string {
  return `PMT-${six(n)}`;
}
let paymentSeq = 301;
/** The number the next recorded payment will get, without using it. */
export function peekPaymentNumber(): string {
  return formatPaymentId(paymentSeq);
}
/** Uses the next payment number. */
export function claimPaymentNumber(): string {
  return formatPaymentId(paymentSeq++);
}

/** Customer deposits: DEP-000001, ... (next after the highest). */
export function nextDepositNumber(existing: string[]): string {
  const max = existing.reduce((m, s) => Math.max(m, parseInt(s.replace(/^DEP-/, ''), 10) || 0), 0);
  return `DEP-${six(max + 1)}`;
}

/** Runs: RUN-000001, ... (next after the highest). */
export function nextRunNumber(existing: string[]): string {
  const max = existing.reduce((m, s) => Math.max(m, parseInt(s.replace(/^RUN-/, ''), 10) || 0), 0);
  return formatRunId(max + 1);
}

/** Customer invoice number shown to the customer (BA 10/29, FAD 11/2):
 *  prefix, digits and start number come from Company Setup → document
 *  numbering. Next after the highest number already using the prefix,
 *  never below the start number. */
export function nextSalesInvoiceNumber(existing: (string | undefined)[]): string {
  const n = getSystemSettings().customerInvoiceNumbering;
  const max = existing.reduce<number>(
    (m, s) => Math.max(m, s && s.startsWith(n.prefix) ? parseInt(s.slice(n.prefix.length), 10) || 0 : 0),
    0,
  );
  return formatDocumentNumber(n, Math.max(max + 1, n.start));
}
