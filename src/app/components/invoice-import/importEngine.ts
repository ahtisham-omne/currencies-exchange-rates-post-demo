/* ── Vendor invoice import: engine ─────────────────────────────────────
 * Everything that isn't pixels: the CSV parser, the multi-sheet workbook
 * reader, the header auto-matcher, the grouping pass that turns ONE flat
 * invoice file (one row per invoice or per line item) into invoices, the
 * normalization rules (spec §9.1), the three-severity validation model
 * (§6) with the payment status contract (§7), the simulate math (§S6),
 * and the builders that turn a validated run into real Invoice and
 * Payment records at commit.
 */

import { nextSystemInvoiceNumber, type Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { BANK_ACCOUNTS } from '@/app/data/mockPayments';
import { GL_ACCOUNTS } from '@/app/data/glAccounts';
import { splitAccount } from '@/app/lib/glPosting';
import { findPresetByLabel, daysForPreset, PAYMENT_TERM_PRESETS } from '@/app/data/paymentTermPresets';
import {
  IMPORT_OBJECTS,
  LINE_FIELD_KEYS,
  SUGGESTED_CLEARING_ACCOUNT,
  objectSpec,
  type ImportMode,
  type ImportObjectKey,
  type ImportRunConfig,
} from './importModel';

/* ── CSV parsing ── */

export interface ParsedFile {
  fileName: string;
  /** Workbook uploads carry the sheet this came from. */
  sheetName?: string;
  headers: string[];
  rows: string[][];
}

/** Small, quote-aware CSV parser. Handles quoted commas, escaped quotes and CRLF. */
export function parseCsv(text: string, fileName: string): ParsedFile {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => {
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') pushCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushCell();
      pushRow();
    } else cell += ch;
  }
  pushCell();
  pushRow();
  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { fileName, headers, rows };
}

/* Excel (.xlsx) parsing — reads EVERY data sheet in the workbook (so an
 * export carrying Invoices, Payments and Credit memos as sheets imports
 * as one file), headers on row 1, skipping instruction sheets. Dates
 * come back from Excel as Date objects; they normalize to yyyy-mm-dd so
 * the validators see the same strings a CSV would carry. */
export async function parseXlsxSheets(buffer: ArrayBuffer, fileName: string): Promise<ParsedFile[]> {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const cellText = (v: unknown): string => {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'object') {
      const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string };
      if (o.richText) return o.richText.map((r) => r.text).join('');
      if (o.result !== undefined) return cellText(o.result);
      if (o.text !== undefined) return String(o.text);
      if (o.hyperlink) return String(o.hyperlink);
      return '';
    }
    return String(v).trim();
  };

  const files: ParsedFile[] = [];
  for (const sheet of workbook.worksheets) {
    if (/read\s?me|instructions|rules/i.test(sheet.name)) continue;
    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    for (let c = 1; c <= sheet.columnCount; c++) headers.push(cellText(headerRow.getCell(c).value));
    while (headers.length > 0 && headers[headers.length - 1] === '') headers.pop();
    if (headers.length === 0) continue;

    const rows: string[][] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const values = headers.map((_, i) => cellText(row.getCell(i + 1).value));
      if (values.some((v) => v !== '')) rows.push(values);
    }
    if (rows.length === 0) continue;
    files.push({ fileName, sheetName: sheet.name, headers, rows });
  }
  // Annotate the display name only when the workbook carries several data sheets.
  if (files.length > 1) files.forEach((f) => { f.fileName = `${fileName} · ${f.sheetName}`; });
  return files;
}

/** Which slot a parsed sheet belongs in: name first, column signature second. */
export function classifySheet(parsed: ParsedFile): ImportObjectKey {
  const name = parsed.sheetName ?? '';
  if (/credit/i.test(name)) return 'creditMemos';
  if (/payment/i.test(name)) return 'payments';
  const cm = autoMapColumns('creditMemos', parsed.headers);
  if (cm.credit_memo_number >= 0 && cm.amount_allocated >= 0) return 'creditMemos';
  const pm = autoMapColumns('payments', parsed.headers);
  if (pm.payment_reference >= 0 && pm.amount_allocated >= 0) return 'payments';
  return 'invoices';
}

/* ── Header auto-matching (S4) ── */

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Synonyms seen in real legacy exports, keyed by our field. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  source_reference: ['externalid', 'legacyid', 'sourceid', 'refid', 'reference', 'ref'],
  vendor_name: ['vendor', 'supplier', 'suppliername', 'payee'],
  vendor_invoice_number: ['invoicenumber', 'invoiceno', 'billnumber', 'billno', 'invnumber', 'docnumber', 'documentnumber'],
  invoice_type: ['type', 'billtype'],
  invoice_status: ['status', 'approvalstatus'],
  payment_status: ['paystatus', 'paidstatus'],
  vendor_invoice_date: ['invoicedate', 'billdate', 'date'],
  posting_date: ['gldate', 'postdate', 'postingperiod'],
  payment_terms: ['terms', 'term', 'paymentterm'],
  trigger_date: ['termstart', 'clockstart'],
  due_date: ['due', 'duedate', 'paymentdue'],
  currency: ['curr', 'currencycode'],
  exchange_rate: ['fxrate', 'rate'],
  subtotal: ['netamount', 'net'],
  additional_charges: ['charges', 'othercharges'],
  total: ['totalamount', 'grossamount', 'gross', 'amountdue', 'vendorstatedtotal', 'statedtotal', 'vendortotal', 'vendorinvoicetotal'],
  memo: ['notes', 'note', 'comment'],
  line_description: ['description', 'itemdescription', 'item', 'product', 'productservice', 'lineitem', 'details'],
  line_type: ['linetype', 'chargetype'],
  quantity: ['qty', 'units'],
  unit_price: ['price', 'unitcost'],
  line_amount: ['amount', 'lineamount', 'extendedamount', 'linetotal', 'value'],
  gl_account: ['account', 'glcode', 'expenseaccount'],
  payment_reference: ['paymentref', 'checknumber', 'paymentid'],
  payment_date: ['paiddate', 'datepaid'],
  amount_allocated: ['allocated', 'applied', 'appliedamount', 'paymentamount', 'amount', 'amountpaid'],
  method: ['paymentmethod', 'paytype'],
  credit_memo_number: ['creditmemono', 'cmnumber', 'memonumber'],
  credit_date: ['creditmemodate', 'cmdate'],
  reason: ['creditreason'],
};

/** field key → source header index (or -1). Exact key match wins, then synonyms. */
export function autoMapColumns(object: ImportObjectKey, sourceHeaders: string[]): Record<string, number> {
  const spec = objectSpec(object);
  const normalized = sourceHeaders.map(normKey);
  const map: Record<string, number> = {};
  const taken = new Set<number>();
  const claim = (field: string, idx: number) => {
    map[field] = idx;
    taken.add(idx);
  };
  for (const f of spec.fields) {
    const exact = normalized.findIndex((h, i) => !taken.has(i) && h === normKey(f.key));
    if (exact >= 0) { claim(f.key, exact); continue; }
    const label = normalized.findIndex((h, i) => !taken.has(i) && h === normKey(f.label));
    if (label >= 0) { claim(f.key, label); continue; }
    const syn = (FIELD_SYNONYMS[f.key] ?? []).map(normKey);
    const synIdx = normalized.findIndex((h, i) => !taken.has(i) && syn.includes(h));
    if (synIdx >= 0) { claim(f.key, synIdx); continue; }
    map[f.key] = -1;
  }
  return map;
}

/** Apply a column mapping: raw parsed rows → records keyed by our field names. */
export function applyMapping(parsed: ParsedFile, mapping: Record<string, number>): Record<string, string>[] {
  return parsed.rows.map((row) => {
    const rec: Record<string, string> = {};
    for (const [field, idx] of Object.entries(mapping)) {
      rec[field] = idx >= 0 ? (row[idx] ?? '').trim() : '';
    }
    return rec;
  });
}

/* ── Normalization (spec §9.1): applied before every comparison ── */

export function normalizeVendor(name: string): string {
  return name.toLowerCase().replace(/[\s\-_.,']/g, '').replace(/(inc|llc|ltd|corp|co|group|company)$/g, '');
}

export function normalizeInvoiceNumber(num: string): string {
  let n = num.toLowerCase().replace(/[\s\-_.#]/g, '');
  n = n.replace(/^(invoice|inv|bill)/, '');
  // Strip leading zeros on the numeric tail, keep any alpha prefix.
  const m = /^([a-z]*)(\d+)$/.exec(n);
  if (m) n = m[1] + String(Number(m[2]));
  return n;
}

/* ── Run state (the working set every step shares) ── */

export type Severity = 'blocker' | 'exception' | 'warning';

export interface RowIssue {
  severity: Severity;
  /** Header field the issue anchors to; undefined = whole row. */
  field?: string;
  message: string;
  /** One-click suggestion for the inline fix popover. */
  suggestion?: string;
  /** Near duplicates carry the matched row for the side-by-side card. */
  nearDuplicateOf?: { ref: string; vendor: string; invoiceNumber: string; date: string; total: number; inOmne: boolean };
}

export interface ImportInvoiceRow {
  /** The row's identity: source_reference when supplied, else the invoice number. */
  ref: string;
  header: Record<string, string>;
  lines: Record<string, string>[];
  payments: Record<string, string>[];
  creditMemos: Record<string, string>[];
  excluded: boolean;
  /** "Import anyway" on a near-duplicate: the exception stops re-raising. */
  acceptedNearDuplicate?: boolean;
  /** Issues found while grouping file rows into this invoice (field disagreements). */
  structuralIssues?: RowIssue[];
  /** Fields the engine filled in (defaults and derivations): their checks are skipped. */
  derivedFields?: string[];
  issues: RowIssue[];
}

const num = (s: string | undefined): number => {
  if (!s || s.trim() === '') return NaN;
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

const dateOf = (s: string | undefined): Date | null => {
  if (!s) return null;
  const t = s.trim();
  // Date-only strings parse at LOCAL midnight (9/22/26 review response,
  // GPT IMP-02): `new Date('2026-09-01')` is UTC and turned an uploaded
  // Sep 1 into Aug 31 in the review grid and its derived due date.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00`) : new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Format a Date as a date-only ISO string in LOCAL time — toISOString
 *  re-introduces the UTC shift on the way out. */
const toLocalIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Resolve a file's GL value against the chart of accounts (GPT QC15,
 *  9/30: an unknown 9999 committed with zero blockers and the journal
 *  silently substituted 6000). Accepts the full "6100 Office Supplies"
 *  label or the bare code; returns the canonical label, or null when the
 *  account doesn't exist. */
export function resolveGlAccount(raw: string | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const exact = GL_ACCOUNTS.find((a) => a.toLowerCase() === lower);
  if (exact) return exact;
  const code = t.split(/[\s-]/)[0];
  if (/^\d{3,5}$/.test(code)) {
    const byCode = GL_ACCOUNTS.find((a) => a.startsWith(`${code} `));
    if (byCode) return byCode;
  }
  return null;
}

export function computedTotal(row: ImportInvoiceRow): number {
  const sub = num(row.header.subtotal);
  const addl = num(row.header.additional_charges);
  return (Number.isFinite(sub) ? sub : 0) + (Number.isFinite(addl) ? addl : 0);
}

export function paidAllocated(row: ImportInvoiceRow): number {
  return row.payments
    .filter((p) => p.payment_status === 'Completed')
    .reduce((s, p) => s + (num(p.amount_allocated) || 0), 0);
}

export function creditAllocated(row: ImportInvoiceRow): number {
  return row.creditMemos.reduce((s, c) => s + (num(c.amount_allocated) || 0), 0);
}

/* ── Grouping: ONE flat invoice file → invoices ───────────────────────
 * Rows group on source_reference when supplied, else on normalized
 * vendor + invoice number. A group of one with no line columns is a
 * one-row-per-invoice file; anything else is line-item shaped. Repeated
 * invoice-level fields that disagree inside a group are a named blocker:
 * the exact typo that silently mints a duplicate invoice in a flat
 * import gets caught by name instead.
 */

const INVOICE_LEVEL_KEYS = objectSpec('invoices')
  .fields.map((f) => f.key)
  .filter((k) => !(LINE_FIELD_KEYS as readonly string[]).includes(k));

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  IMPORT_OBJECTS.flatMap((o) => o.fields.map((f) => [f.key, f.label])),
);

const invoiceGroupKey = (rec: Record<string, string>, index: number): string => {
  const sr = (rec.source_reference ?? '').trim();
  if (sr) return `sr:${sr}`;
  const vn = normalizeVendor(rec.vendor_name ?? '');
  const nk = normalizeInvoiceNumber(rec.vendor_invoice_number ?? '');
  return vn || nk ? `vn:${vn}|${nk}` : `row:${index}`;
};

const hasLineContent = (rec: Record<string, string>): boolean =>
  ['line_description', 'quantity', 'unit_price', 'line_amount', 'line_type'].some((k) => (rec[k] ?? '').trim() !== '');

export interface AssembleResult {
  rows: ImportInvoiceRow[];
  /** Payment / credit rows that matched no invoice in the file. */
  unmatchedPayments: number;
  unmatchedCreditMemos: number;
}

/** Quick shape readout for the upload step, before anything validates. */
export function invoiceFileStats(parsed: ParsedFile, mapping: Record<string, number>): { rows: number; invoices: number; lineShaped: boolean } {
  const recs = applyMapping(parsed, mapping);
  const keys = new Set<string>();
  let lineShaped = false;
  recs.forEach((rec, i) => {
    const key = invoiceGroupKey(rec, i);
    if (keys.has(key)) lineShaped = true;
    keys.add(key);
    if (!lineShaped && hasLineContent(rec)) lineShaped = true;
  });
  return { rows: recs.length, invoices: keys.size, lineShaped };
}

/** Group the flat invoice file into invoices, apply defaults, join payments and credit memos. */
export function assembleRows(
  mapped: Partial<Record<ImportObjectKey, Record<string, string>[]>>,
  opts: { mode: ImportMode },
): AssembleResult {
  const recs = mapped.invoices ?? [];
  const groups = new Map<string, { rec: Record<string, string>; rowNum: number }[]>();
  recs.forEach((rec, i) => {
    const key = invoiceGroupKey(rec, i);
    groups.set(key, [...(groups.get(key) ?? []), { rec, rowNum: i + 2 }]);
  });

  const usedRefs = new Map<string, number>();
  const rows: ImportInvoiceRow[] = [];

  for (const members of groups.values()) {
    const structural: RowIssue[] = [];
    const derived: string[] = [];

    // Invoice-level fields: first non-empty value wins; disagreement is a blocker.
    const header: Record<string, string> = {};
    for (const key of INVOICE_LEVEL_KEYS) {
      const seen: { v: string; rowNum: number }[] = [];
      for (const { rec, rowNum } of members) {
        const v = (rec[key] ?? '').trim();
        if (v && !seen.some((s) => s.v === v)) seen.push({ v, rowNum });
      }
      header[key] = seen[0]?.v ?? '';
      if (seen.length > 1) {
        structural.push({
          severity: 'blocker',
          field: key,
          message: `Rows ${seen[0].rowNum} and ${seen[1].rowNum} of the file disagree on ${FIELD_LABELS[key] ?? key}: "${seen[0].v}" vs "${seen[1].v}". One invoice carries one value`,
          suggestion: seen[0].v,
        });
      }
    }

    // Lines: line-item shaped groups turn each file row into a line.
    const lineShaped = members.length > 1 || members.some(({ rec }) => hasLineContent(rec));
    // One-row-per-invoice files: the GL account rides the HEADER (GPT
    // QC15, 9/30 — gl_account is a line-level key, so single-row files
    // silently dropped it and every import posted to the 6000 default,
    // including an explicitly mapped 9999 that should have blocked).
    if (!lineShaped) {
      header.gl_account = (members[0]?.rec.gl_account ?? '').trim();
    }
    const lines: Record<string, string>[] = [];
    if (lineShaped) {
      members.forEach(({ rec }, li) => {
        const qty = num(rec.quantity);
        const price = num(rec.unit_price);
        let amount = (rec.line_amount ?? '').trim();
        if (!amount && Number.isFinite(qty) && Number.isFinite(price)) amount = (qty * price).toFixed(2);
        lines.push({
          line_number: String(li + 1),
          line_type: (rec.line_type ?? '').trim().toLowerCase() || 'item',
          description: (rec.line_description ?? '').trim(),
          quantity: (rec.quantity ?? '').trim(),
          unit_price: (rec.unit_price ?? '').trim(),
          amount,
          gl_account: (rec.gl_account ?? '').trim(),
        });
      });
    }

    // Derivations: blank subtotal / charges compute from the lines.
    const itemSum = lines.filter((l) => l.line_type === 'item').reduce((s, l) => s + (num(l.amount) || 0), 0);
    const nonItemSum = lines.filter((l) => l.line_type !== 'item').reduce((s, l) => s + (num(l.amount) || 0), 0);
    if (!header.subtotal && lines.length > 0) { header.subtotal = itemSum.toFixed(2); derived.push('subtotal'); }
    if (!header.additional_charges && nonItemSum > 0) { header.additional_charges = nonItemSum.toFixed(2); derived.push('additional_charges'); }

    // Defaults: everything derivable is filled, never demanded.
    if (!header.invoice_type) header.invoice_type = 'Standalone';
    if (!header.invoice_status) header.invoice_status = opts.mode === 'migration' ? 'Approved' : 'Pending Approval';
    if (!header.payment_status) header.payment_status = 'Unpaid';
    if (!header.currency) header.currency = 'USD';
    if (!header.posting_date && header.vendor_invoice_date) { header.posting_date = header.vendor_invoice_date; derived.push('posting_date'); }
    if (!header.trigger_date && header.vendor_invoice_date) { header.trigger_date = header.vendor_invoice_date; derived.push('trigger_date'); }
    if (!header.payment_terms) {
      header.payment_terms = 'N/A';
      derived.push('payment_terms');
      structural.push({ severity: 'warning', field: 'payment_terms', message: 'No payment terms supplied. Imported as N/A, so no due date math applies' });
    }
    if (!header.due_date) {
      const preset = header.payment_terms.toUpperCase() !== 'N/A' ? findPresetByLabel(header.payment_terms) : undefined;
      const trig = dateOf(header.trigger_date);
      if (trig) {
        const d = new Date(trig);
        d.setDate(trig.getDate() + (preset ? daysForPreset(preset) || 0 : 0));
        header.due_date = toLocalIso(d);
        derived.push('due_date');
      }
    }

    // Identity: the legacy ref when supplied, else the invoice number, deduped.
    let ref = (header.source_reference ?? '').trim() || (header.vendor_invoice_number ?? '').trim() || `Row ${members[0].rowNum}`;
    const collisions = usedRefs.get(ref) ?? 0;
    usedRefs.set(ref, collisions + 1);
    if (collisions > 0) ref = `${ref} · ${collisions + 1}`;

    rows.push({
      ref,
      header,
      lines,
      payments: [],
      creditMemos: [],
      excluded: false,
      structuralIssues: structural,
      derivedFields: derived,
      issues: [],
    });
  }

  // Payments and credit memos join on source_reference, or on the vendor
  // invoice number (plus vendor name when two vendors share a number).
  const byRef = new Map<string, ImportInvoiceRow>();
  const byVendorNum = new Map<string, ImportInvoiceRow>();
  const byNum = new Map<string, ImportInvoiceRow | null>();
  rows.forEach((r) => {
    const sr = (r.header.source_reference ?? '').trim();
    if (sr && !byRef.has(sr)) byRef.set(sr, r);
    const nk = normalizeInvoiceNumber(r.header.vendor_invoice_number ?? '');
    if (!nk) return;
    const vk = `${normalizeVendor(r.header.vendor_name ?? '')}|${nk}`;
    if (!byVendorNum.has(vk)) byVendorNum.set(vk, r);
    byNum.set(nk, byNum.has(nk) ? null : r);
  });
  const resolveTarget = (rec: Record<string, string>): ImportInvoiceRow | null => {
    const sr = (rec.source_reference ?? '').trim();
    if (sr && byRef.has(sr)) return byRef.get(sr)!;
    const nk = normalizeInvoiceNumber(rec.vendor_invoice_number ?? '');
    if (!nk) return null;
    const vn = normalizeVendor(rec.vendor_name ?? '');
    if (vn) return byVendorNum.get(`${vn}|${nk}`) ?? null;
    return byNum.get(nk) ?? null;
  };

  let unmatchedPayments = 0;
  let unmatchedCreditMemos = 0;
  (mapped.payments ?? []).forEach((p) => {
    const target = resolveTarget(p);
    if (target) target.payments.push({ ...p, payment_status: (p.payment_status ?? '').trim() || 'Completed' });
    else unmatchedPayments += 1;
  });
  (mapped.creditMemos ?? []).forEach((c) => {
    const target = resolveTarget(c);
    if (target) target.creditMemos.push({ ...c });
    else unmatchedCreditMemos += 1;
  });

  return { rows, unmatchedPayments, unmatchedCreditMemos };
}

/* ── Validation (spec §6 + §7) ── */

export interface ValidationContext {
  mode: ImportMode;
  /** Rounding tolerance in minor units (cents). */
  toleranceCents: number;
  createMissingVendors: boolean;
  /** Live Omne data the run resolves against. */
  existingInvoices: Invoice[];
  knownVendors: Set<string>;
  /** Go-live period, yyyy-mm. Migration posting dates override to this. */
  postingPeriod: string;
}

export function termSuggestion(label: string): string | undefined {
  const n = normKey(label);
  if (!n) return undefined;
  const hit = PAYMENT_TERM_PRESETS.find((p) => normKey(p.name) === n)
    ?? PAYMENT_TERM_PRESETS.find((p) => normKey(p.name).startsWith(n))
    ?? PAYMENT_TERM_PRESETS.find((p) => n.startsWith(normKey(p.name)));
  return hit?.name;
}

export function validateRows(rows: ImportInvoiceRow[], ctx: ValidationContext): void {
  // Half a cent of float headroom: a diff of exactly the tolerance is
  // WITHIN tolerance, and 6 × 1658.33 must not flag over binary dust.
  const tol = ctx.toleranceCents / 100 + 0.005;
  const normalizedVendors = new Map<string, string>();
  ctx.knownVendors.forEach((v) => normalizedVendors.set(normalizeVendor(v), v));

  // Existing Omne invoices indexed by vendor+number for the duplicate engine.
  const omneByKey = new Map<string, Invoice>();
  ctx.existingInvoices.forEach((inv) => {
    omneByKey.set(`${normalizeVendor(inv.vendor)}|${normalizeInvoiceNumber(inv.vendorInvoiceNumber)}`, inv);
  });

  const fileByKey = new Map<string, ImportInvoiceRow[]>();
  rows.forEach((r) => {
    const key = `${normalizeVendor(r.header.vendor_name || '')}|${normalizeInvoiceNumber(r.header.vendor_invoice_number || '')}`;
    fileByKey.set(key, [...(fileByKey.get(key) ?? []), r]);
  });

  for (const row of rows) {
    // Grouping issues (field disagreements, terms defaulted to N/A) come first.
    const issues: RowIssue[] = [...(row.structuralIssues ?? [])];
    const h = row.header;
    const derived = new Set(row.derivedFields ?? []);
    const blocker = (message: string, field?: string, suggestion?: string) => issues.push({ severity: 'blocker', field, message, suggestion });
    const exception = (message: string, field?: string, extra?: Partial<RowIssue>) => issues.push({ severity: 'exception', field, message, ...extra });
    const warning = (message: string, field?: string) => issues.push({ severity: 'warning', field, message });

    // Required fields. Everything else blank was defaulted at assembly.
    for (const f of objectSpec('invoices').fields) {
      if (f.required && !(h[f.key] ?? '').trim()) blocker(`${f.label} is required`, f.key);
    }

    // Unparseable dates BLOCK (GPT QC22, 9/30: a literal "not-a-date"
    // invoice date was marked Ready and committed to the register). ISO
    // strings must also round-trip exactly, so impossible dates like
    // 2026-02-30 can't roll over into March and slip through.
    for (const [key, label] of [
      ['vendor_invoice_date', 'Vendor Invoice Date'],
      ['due_date', 'Due Date'],
      ['trigger_date', 'Trigger Date'],
      ['posting_date', 'Posting Date'],
    ] as Array<[string, string]>) {
      const raw = (h[key] ?? '').trim();
      if (!raw) continue;
      const parsed = dateOf(raw);
      const isoShape = /^\d{4}-\d{2}-\d{2}$/.test(raw);
      if (!parsed || (isoShape && toLocalIso(parsed) !== raw)) {
        blocker(`${label} "${raw}" is not a valid calendar date`, key);
      }
    }

    // Scope: v1 accepts Standalone only.
    if (h.invoice_type && h.invoice_type !== 'Standalone') {
      blocker(`${h.invoice_type} invoices are out of scope for import v1. Only Standalone is accepted`, 'invoice_type', 'Standalone');
    }

    // Enums.
    if (h.invoice_status && !['Pending Approval', 'Approved', 'On Hold', 'Cancelled'].includes(h.invoice_status)) {
      blocker(`"${h.invoice_status}" is not an importable invoice status`, 'invoice_status');
    }
    if (ctx.mode === 'ongoing' && h.invoice_status && h.invoice_status !== 'Pending Approval') {
      blocker('Ongoing batches import at Pending Approval only. Historical statuses need a migration run', 'invoice_status', 'Pending Approval');
    }
    if (h.payment_status && !['Unpaid', 'Partial', 'Paid in Full', 'Scheduled', 'Settled', 'Void'].includes(h.payment_status)) {
      blocker(`"${h.payment_status}" is not a recognized payment status`, 'payment_status');
    }

    // Vendor resolution.
    const vendorRaw = h.vendor_name || '';
    const resolvedVendor = normalizedVendors.get(normalizeVendor(vendorRaw));
    if (vendorRaw && !resolvedVendor) {
      if (ctx.createMissingVendors) warning(`Vendor "${vendorRaw}" is not in Omne yet and will be created by this run`, 'vendor_name');
      else blocker(`Vendor "${vendorRaw}" cannot be resolved and vendor auto-create is off`, 'vendor_name');
    }

    // Payment terms: must already exist, or the literal N/A. Never created.
    const termLabel = (h.payment_terms || '').trim();
    const preset = termLabel && termLabel.toUpperCase() !== 'N/A' ? findPresetByLabel(termLabel) : undefined;
    if (termLabel && termLabel.toUpperCase() !== 'N/A' && !preset) {
      blocker(`Payment term "${termLabel}" does not exist in Omne. Terms are never created by an import`, 'payment_terms', termSuggestion(termLabel));
    }

    // Currency.
    if (h.currency && h.currency.toUpperCase() !== 'USD' && !(h.exchange_rate ?? '').trim()) {
      blocker(`Exchange rate is required when the currency is ${h.currency.toUpperCase()}`, 'exchange_rate');
    }

    // Amounts: an invoice needs a subtotal or line amounts; when it has
    // both they must agree, and a supplied total must match the math.
    const sub = num(h.subtotal);
    const itemSum = row.lines.filter((l) => l.line_type === 'item').reduce((s, l) => s + (num(l.amount) || 0), 0);
    if (row.lines.length === 0 && !Number.isFinite(sub)) {
      blocker('No amount found. Supply a subtotal, or map the line amount columns', 'subtotal');
    } else if (row.lines.length > 0 && Number.isFinite(sub) && !derived.has('subtotal') && Math.abs(itemSum - sub) > tol) {
      blocker(`Item lines sum to $${itemSum.toFixed(2)}, the invoice says $${sub.toFixed(2)}`, 'subtotal', itemSum.toFixed(2));
    }
    const suppliedTotal = num(h.total);
    const computed = computedTotal(row);
    if (Number.isFinite(suppliedTotal) && Math.abs(suppliedTotal - computed) > tol) {
      // Variance, not a wall (GPT QC12, 9/30): manual entry lets a
      // disagreeing vendor-stated total through as a flagged exception,
      // so the import path applies the same contract.
      exception(`Vendor-stated total $${suppliedTotal.toFixed(2)} differs from the calculated total $${computed.toFixed(2)} by $${Math.abs(suppliedTotal - computed).toFixed(2)}`, 'total', { suggestion: computed.toFixed(2) });
    }

    // Line-level rules.
    row.lines.forEach((l) => {
      if (l.line_type && !['item', 'freight', 'misc'].includes(l.line_type)) {
        if (l.line_type === 'tax') blocker(`Line ${l.line_number}: tax lines are reserved for a later phase and rejected in v1`, undefined);
        else blocker(`Line ${l.line_number}: "${l.line_type}" is not a line type (item, freight or misc)`, undefined);
      }
      const q = num(l.quantity);
      const p = num(l.unit_price);
      const a = num(l.amount);
      if (!Number.isFinite(a)) {
        blocker(`Line ${l.line_number} has no amount and no quantity times unit price to derive one`, undefined);
      } else if (l.line_type === 'item' && Number.isFinite(q) && Number.isFinite(p) && Math.abs(q * p - a) > tol) {
        exception(`Line ${l.line_number}: quantity times unit price is $${(q * p).toFixed(2)}, the line says $${a.toFixed(2)}`);
      }
      if (l.line_type === 'item' && !(l.description ?? '').trim()) warning(`Line ${l.line_number}: item line has no description`);
      // A PROVIDED GL account must exist in the chart (GPT QC15, 9/30:
      // unknown 9999 was Ready, committed and approved with a silently
      // substituted journal). Blank stays the documented default — the
      // default-account policy itself is D3, still open.
      if ((l.gl_account ?? '').trim() && !resolveGlAccount(l.gl_account)) {
        blocker(`Line ${l.line_number}: GL account "${l.gl_account}" is not in the chart of accounts`, undefined);
      }
    });
    if ((h.gl_account ?? '').trim() && !resolveGlAccount(h.gl_account)) {
      blocker(`GL account "${h.gl_account}" is not in the chart of accounts`, 'gl_account');
    }

    // Payment status contract (spec §7): Void severity depends on invoice status.
    if (h.payment_status === 'Void' && h.invoice_status !== 'Cancelled') {
      blocker('Payment status Void requires the invoice status to be Cancelled', 'payment_status');
    }

    // Duplicate engine (spec §9).
    const dupKey = `${normalizeVendor(vendorRaw)}|${normalizeInvoiceNumber(h.vendor_invoice_number || '')}`;
    const omneHit = omneByKey.get(dupKey);
    if (omneHit && vendorRaw && h.vendor_invoice_number) {
      blocker(`Already in Omne as ${omneHit.invoiceNumber} (${omneHit.vendor}, ${omneHit.vendorInvoiceNumber})`, 'vendor_invoice_number');
    }
    const fileHits = fileByKey.get(dupKey) ?? [];
    if (fileHits.length > 1 && vendorRaw && h.vendor_invoice_number) {
      blocker('Duplicate vendor and invoice number within this file', 'vendor_invoice_number');
    }

    // Near duplicate: same vendor, same total, dates within 7 days, different number.
    const myDate = dateOf(h.vendor_invoice_date);
    if (myDate && vendorRaw && !row.acceptedNearDuplicate) {
      const near = rows.find((o) => {
        if (o === row || o.excluded) return false;
        if (normalizeVendor(o.header.vendor_name || '') !== normalizeVendor(vendorRaw)) return false;
        if (normalizeInvoiceNumber(o.header.vendor_invoice_number || '') === normalizeInvoiceNumber(h.vendor_invoice_number || '')) return false;
        if (Math.abs(computedTotal(o) - computed) > tol) return false;
        const od = dateOf(o.header.vendor_invoice_date);
        return !!od && Math.abs(od.getTime() - myDate.getTime()) <= 7 * 24 * 3600 * 1000;
      });
      // Flag only the LATER row of the pair so one decision resolves it.
      if (near && (dateOf(near.header.vendor_invoice_date)?.getTime() ?? 0) <= myDate.getTime() && near.ref !== row.ref) {
        exception(
          `Possible duplicate of ${near.ref}: same vendor, same total, ${Math.round(Math.abs((dateOf(near.header.vendor_invoice_date)!.getTime() - myDate.getTime()) / 86400000))} days apart`,
          'vendor_invoice_number',
          {
            nearDuplicateOf: {
              ref: near.ref,
              vendor: near.header.vendor_name || '',
              invoiceNumber: near.header.vendor_invoice_number || '',
              date: near.header.vendor_invoice_date || '',
              total: computedTotal(near),
              inOmne: false,
            },
          },
        );
      }
    }

    // Due date must equal trigger date plus term days, within a day.
    // Skipped when the engine derived it: derived values ARE that math.
    const trig = dateOf(h.trigger_date);
    const due = dateOf(h.due_date);
    if (preset && trig && due && !derived.has('due_date')) {
      const days = daysForPreset(preset) || 0;
      const expected = new Date(trig);
      expected.setDate(trig.getDate() + days);
      const deltaDays = Math.round((due.getTime() - expected.getTime()) / 86400000);
      if (Math.abs(deltaDays) > 1) {
        exception(
          `Due date is ${Math.abs(deltaDays)} days ${deltaDays > 0 ? 'after' : 'before'} trigger date plus ${days} term days`,
          'due_date',
          { suggestion: toLocalIso(expected) },
        );
      }
    }

    // Invoice date sanity.
    const invDate = dateOf(h.vendor_invoice_date);
    const postDate = dateOf(h.posting_date);
    if (invDate && postDate && invDate.getTime() > postDate.getTime()) {
      exception('Invoice date is later than the posting date', 'vendor_invoice_date');
    }
    if (invDate) {
      const [py, pm] = ctx.postingPeriod.split('-').map(Number);
      const monthsOld = (py - invDate.getFullYear()) * 12 + (pm - (invDate.getMonth() + 1));
      if (monthsOld > 24) warning(`Invoice date is ${monthsOld} months before the posting period`, 'vendor_invoice_date');
    }

    // ── Payment status contract (§7): allocations vs the declared status ──
    const paid = paidAllocated(row);
    const credited = creditAllocated(row);
    const scheduledRows = row.payments.filter((p) => p.payment_status === 'Scheduled');
    const totalVal = computed;
    row.payments.forEach((p) => {
      if (p.payment_status && !['Completed', 'Scheduled', 'Reversed'].includes(p.payment_status)) {
        exception(`Payment ${p.payment_reference}: "${p.payment_status}" is not a payment file status`);
      }
    });
    if (paid - totalVal > tol) {
      exception(`Payment allocations total $${paid.toFixed(2)}, more than the invoice total $${totalVal.toFixed(2)}`, 'payment_status');
    }
    switch (h.payment_status) {
      case 'Unpaid':
        if (paid > tol || scheduledRows.length > 0) exception('Declared Unpaid, but the payment file allocates money to this invoice', 'payment_status');
        break;
      case 'Partial':
        // Over-allocation already raised its own exception above.
        if (paid <= totalVal + tol && !(paid > tol && paid < totalVal - tol)) {
          exception(`Declared Partial, but allocations total $${paid.toFixed(2)} of $${totalVal.toFixed(2)}`, 'payment_status');
        }
        break;
      case 'Paid in Full':
        if (paid <= totalVal + tol && Math.abs(paid - totalVal) > tol) {
          exception(`Declared Paid in Full, but allocations total $${paid.toFixed(2)} of $${totalVal.toFixed(2)}`, 'payment_status');
        }
        break;
      case 'Scheduled':
        if (scheduledRows.length === 0) exception('Declared Scheduled, but no scheduled payment row allocates to this invoice', 'payment_status');
        break;
      case 'Settled':
        if (totalVal - credited > tol) {
          exception(
            row.creditMemos.length === 0
              ? 'Declared Settled, but no credit memo covers this invoice'
              : `Declared Settled, but credit memos cover $${credited.toFixed(2)} of $${totalVal.toFixed(2)}`,
            'payment_status',
          );
        }
        break;
      case 'Void': {
        const live = row.payments.some((p) => p.payment_status !== 'Reversed');
        if (h.invoice_status === 'Cancelled' && live) exception('Declared Void, but a payment allocation is not Reversed', 'payment_status');
        break;
      }
    }

    // Unrecognized legacy status is fine, it is preserved read-only. Just say so.
    if ((h.source_status ?? '').trim() && !['Open', 'Closed', 'Draft', 'Approved', 'Pending'].includes(h.source_status)) {
      warning(`Legacy status "${h.source_status}" is preserved as the source status`, 'source_status');
    }

    row.issues = issues;
  }
}

export function rowSeverity(row: ImportInvoiceRow): Severity | 'ready' {
  if (row.issues.some((i) => i.severity === 'blocker')) return 'blocker';
  if (row.issues.some((i) => i.severity === 'exception')) return 'exception';
  if (row.issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'ready';
}

export interface SeverityCounts { ready: number; blocker: number; exception: number; warning: number; excluded: number }

export function severityCounts(rows: ImportInvoiceRow[]): SeverityCounts {
  const c: SeverityCounts = { ready: 0, blocker: 0, exception: 0, warning: 0, excluded: 0 };
  rows.forEach((r) => {
    if (r.excluded) { c.excluded += 1; return; }
    c[rowSeverity(r)] += 1;
  });
  return c;
}

/* ── Simulate (S6) ── */

export interface SimulateSummary {
  invoiceCount: number;
  lineCount: number;
  paymentCount: number;
  creditMemoCount: number;
  vendorsCreated: string[];
  byStatus: { label: string; count: number }[];
  /** Migration GL preview: per-invoice Dr Clearing / Cr AP, one reversing entry. */
  apCredit: number;
  clearingDebit: number;
  perVendor: { vendor: string; total: number; outstanding: number }[];
  /** Sum of what will still be owed after allocations, the AP balance to tie against. */
  outstandingTotal: number;
}

export function simulateRun(rows: ImportInvoiceRow[], ctx: ValidationContext): SimulateSummary {
  const included = rows.filter((r) => !r.excluded && rowSeverity(r) !== 'blocker');
  const vendorsCreated = new Set<string>();
  const perVendor = new Map<string, { total: number; outstanding: number }>();
  // New scope (Eli 10/9): the import is only the owed balances. The status
  // breakdown shows the composition — unpaid imports in full, partly paid
  // imports only its balance, fully paid is skipped entirely.
  let unpaidCount = 0;
  let partialCount = 0;
  let skippedPaidCount = 0;
  let owedCount = 0;
  let owedTotal = 0;

  const normalizedVendors = new Set([...ctx.knownVendors].map(normalizeVendor));

  for (const row of included) {
    const total = computedTotal(row);
    const settled = Math.max(0, paidAllocated(row) + creditAllocated(row));
    const owed = Math.round((total - settled) * 100) / 100;
    // Fully paid / settled invoices are NOT imported (Eli 10/9).
    if (owed <= 0.004) { skippedPaidCount += 1; continue; }
    if (settled > 0.004) partialCount += 1; else unpaidCount += 1;
    owedCount += 1;
    owedTotal += owed;
    const vendor = row.header.vendor_name || '';
    if (vendor && !normalizedVendors.has(normalizeVendor(vendor))) vendorsCreated.add(vendor);
    const pv = perVendor.get(vendor) ?? { total: 0, outstanding: 0 };
    pv.total += owed;
    pv.outstanding += owed;
    perVendor.set(vendor, pv);
  }

  const owedTotal2 = Math.round(owedTotal * 100) / 100;
  return {
    invoiceCount: owedCount,
    // One honest migration line per imported invoice.
    lineCount: owedCount,
    // No payments or credit-memo records are imported under this scope.
    paymentCount: 0,
    creditMemoCount: 0,
    vendorsCreated: [...vendorsCreated].sort(),
    byStatus: [
      { label: 'Unpaid, Imported in Full', count: unpaidCount },
      { label: 'Partly Paid, Balance Only', count: partialCount },
      { label: 'Fully Paid, Not Imported', count: skippedPaidCount },
    ].filter((s) => s.count > 0),
    apCredit: owedTotal2,
    clearingDebit: owedTotal2,
    perVendor: [...perVendor.entries()]
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort((a, b) => b.total - a.total),
    outstandingTotal: owedTotal2,
  };
}

/** The Omne status this row lands in, exceptions included. */
export function importedStatusLabel(row: ImportInvoiceRow): string {
  if (rowSeverity(row) === 'exception') return 'Exception';
  const h = row.header;
  if (h.invoice_status === 'Cancelled') return 'Cancelled';
  // On Hold imports as Approved with the hold flag (ERP-8796).
  if (h.invoice_status === 'On Hold') return 'Approved';
  if (h.invoice_status === 'Pending Approval') return 'Pending Approval';
  if (h.payment_status === 'Settled') return 'Settled';
  const total = computedTotal(row);
  const paid = paidAllocated(row);
  if (paid >= total - 0.02 && total > 0) return 'Paid in Full';
  if (paid > 0.02) return 'Partially Paid';
  return 'Approved';
}

/* ── Commit builders ── */

export interface CommitResult {
  invoices: Invoice[];
  payments: Payment[];
}

export function buildCommitRecords(
  rows: ImportInvoiceRow[],
  config: ImportRunConfig,
  runStamp: number,
): CommitResult {
  const included = rows.filter((r) => !r.excluded && rowSeverity(r) !== 'blocker');
  const today = new Date(runStamp).toISOString().split('T')[0];
  const by = 'Ahtisham Ahmad';
  // Migration mode forces every posting date into the go-live period.
  const periodPostingDate = `${config.postingPeriod}-01`;
  // The offset account every imported invoice debits (Eli 10/9), so the open
  // balances add straight into A/P without touching an expense account.
  const clearing = config.clearingAccount || SUGGESTED_CLEARING_ACCOUNT;
  const clearingParts = splitAccount(clearing);
  const apParts = splitAccount('2000 Accounts Payable');
  const fmtMoney = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Import ONLY what is still owed (Eli 10/9, first-pass scope):
  //  • Unpaid invoices import for their full amount.
  //  • Partly paid invoices import ONLY the remaining balance; the original
  //    total and the amount already paid go in the memo, NEVER as payment
  //    records.
  //  • Fully paid / settled invoices are not imported at all — their history
  //    stays in the customer's old system.
  // Every import is a plain STANDALONE vendor invoice: no PO/receiver links,
  // no three-way match, no payments, no credit-memo records.
  const invoices: Invoice[] = included
    .map((row) => {
      const total = Math.round(computedTotal(row) * 100) / 100;
      const settled = paidAllocated(row) + creditAllocated(row);
      const owed = Math.round((total - settled) * 100) / 100;
      return { row, total, settled: Math.max(0, Math.round(settled * 100) / 100), owed };
    })
    .filter((r) => r.owed > 0.004)
    .map(({ row, total, settled, owed }, i) => {
      const h = row.header;
      const partlyPaid = settled > 0.004;
      // Original total + already-paid live in the memo, not a payment record.
      const migrationNote = partlyPaid
        ? `Migrated open balance. Original total ${fmtMoney(total)}, ${fmtMoney(settled)} already paid in the prior system.`
        : `Migrated open balance from the prior system (${row.ref}).`;
      const userMemo = (h.memo ?? '').trim();
      const description = userMemo ? `${userMemo}. ${migrationNote}` : migrationNote;
      return {
        id: `inv-import-${runStamp}-${i + 1}`,
        // SYSTEM identity, same sequence manual creates draw from (GPT QC17);
        // the vendor number + source ref keep their own fields.
        invoiceNumber: nextSystemInvoiceNumber(),
        type: 'Standalone',
        vendor: h.vendor_name,
        vendorInvoiceNumber: h.vendor_invoice_number,
        reference: row.ref,
        date: h.vendor_invoice_date,
        invoiceDate: h.vendor_invoice_date,
        createdDate: today,
        dueDate: h.due_date,
        triggerDate: h.trigger_date || undefined,
        // The invoice is FOR the remaining balance only (Eli 10/9).
        amount: owed,
        outstandingBalance: owed,
        currency: (h.currency || 'USD').toUpperCase(),
        apAccount: '2000 Accounts Payable',
        description,
        postingDate: config.mode === 'migration' ? periodPostingDate : h.posting_date,
        linkedPOs: [],
        linkedGRNs: [],
        // A migrated open balance is a fresh, approved, payable obligation.
        status: 'Approved',
        createdBy: by,
        updatedBy: by,
        updatedDate: today,
        isUserCreated: true,
        paymentTerms: (h.payment_terms ?? '').trim() || undefined,
        // The vendor's original total stays on record for reference even
        // though only the balance is owed.
        ...(total > 0 ? { vendorStatedTotal: total } : {}),
        charges: { tax: 0, freight: 0, freightGlAccount: '5020 Freight Inbound', additional: [] },
        // One honest line for the migrated balance — no goods, no links.
        savedLineItems: [{
          sku: '',
          description: partlyPaid ? 'Migrated open balance (partially paid in prior system)' : 'Migrated open balance',
          quantity: 1,
          uom: 'EA',
          unitPrice: owed,
          lineTotal: owed,
          glAccount: clearing,
        }],
        // Migration posting (Eli 10/9): Dr migration clearing, Cr A/P — never
        // an expense account — so every open invoice adds into the A/P
        // opening balance and nothing double-counts the COA openings.
        glEntries: [
          { accountCode: clearingParts.code, accountName: clearingParts.name || 'Migration Clearing', description: 'Migrated open balance', debit: owed },
          { accountCode: apParts.code, accountName: apParts.name || 'Accounts Payable', description: 'Opening A/P balance', credit: owed },
        ],
      } as Invoice;
    });

  // No payments are imported (Eli 10/9): the amount already paid lives in the
  // memo, not as payment records.
  return { invoices, payments: [] };
}

/* ── Failed-rows download (S5): the flat file shape back out, same
 * columns plus an error column, one row per line for line-item
 * invoices — so a fix in Excel re-uploads without reshaping. ── */

export function failedRowsCsv(rows: ImportInvoiceRow[]): string {
  const headerKeys = INVOICE_LEVEL_KEYS;
  const lineKeys: [string, string][] = [
    ['line_description', 'description'],
    ['quantity', 'quantity'],
    ['unit_price', 'unit_price'],
    ['line_amount', 'amount'],
    ['line_type', 'line_type'],
    ['gl_account', 'gl_account'],
  ];
  const out: string[][] = [[...headerKeys, ...lineKeys.map(([k]) => k), 'errors']];
  rows
    .filter((r) => !r.excluded && rowSeverity(r) === 'blocker')
    .forEach((r) => {
      const errors = r.issues.filter((i) => i.severity === 'blocker').map((i) => i.message).join('; ');
      const lineRecords: (Record<string, string> | null)[] = r.lines.length > 0 ? r.lines : [null];
      lineRecords.forEach((l) => {
        out.push([
          ...headerKeys.map((f) => r.header[f] ?? ''),
          ...lineKeys.map(([, src]) => (l ? l[src] ?? '' : '')),
          errors,
        ]);
      });
    });
  return out
    .map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','))
    .join('\n');
}

export const IMPORT_OBJECT_KEYS: ImportObjectKey[] = IMPORT_OBJECTS.map((o) => o.key);
