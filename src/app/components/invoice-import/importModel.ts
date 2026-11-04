/* ── Vendor invoice import: data model (single-file contract, 9/17/26) ─
 * ONE invoice file is the whole import. It accepts the two shapes real
 * exports actually come in: one row per invoice (the listing-export
 * shape) or one row per line item with the invoice fields repeated,
 * grouped automatically on vendor + invoice number (or Source
 * reference). The QuickBooks problem the old two-file contract guarded
 * against — a typo in row 40 silently minting a second invoice — is
 * caught head-on instead: repeated invoice fields that disagree inside
 * a group are a named blocker, not a silent split.
 *
 * Payments and credit memos stay optional, as separate files OR as
 * extra sheets inside the same Excel workbook, and still validate
 * against each header's declared payment status before anything
 * commits (spec §7, the differentiator).
 */

export type ImportMode = 'migration' | 'ongoing';

export type ImportObjectKey = 'invoices' | 'payments' | 'creditMemos';

export interface ImportFieldSpec {
  key: string;
  label: string;
  required: boolean;
  /** Short rule shown in the mapper and the template sheet. */
  hint?: string;
}

export interface ImportObjectSpec {
  key: ImportObjectKey;
  title: string;
  /** File noun used in copy ("invoice file"). */
  noun: string;
  required: boolean;
  description: string;
  fields: ImportFieldSpec[];
}

/** Line-item columns inside the invoice file. Everything else is invoice-level. */
export const LINE_FIELD_KEYS = ['line_description', 'quantity', 'unit_price', 'line_amount', 'line_type', 'gl_account'] as const;

export const IMPORT_OBJECTS: ImportObjectSpec[] = [
  {
    key: 'invoices',
    title: 'Invoices',
    noun: 'invoice file',
    required: true,
    description: 'One row per invoice, or one row per line item. Rows sharing a vendor and invoice number group into one invoice.',
    fields: [
      { key: 'vendor_name', label: 'Vendor Name', required: true, hint: 'Resolved by normalized match against your partners.' },
      { key: 'vendor_invoice_number', label: 'Vendor Invoice Number', required: true, hint: 'Unique per vendor. On line-item files, rows sharing a vendor and number group into one invoice.' },
      { key: 'vendor_invoice_date', label: 'Vendor Invoice Date', required: true, hint: 'The date printed on the vendor’s invoice.' },
      { key: 'subtotal', label: 'Subtotal', required: false, hint: 'Required unless line amounts are mapped. Blank computes from the item lines.' },
      { key: 'payment_terms', label: 'Payment Terms', required: false, hint: 'Must match an existing term. Blank imports as N/A. Terms are never created by an import.' },
      { key: 'invoice_status', label: 'Invoice Status', required: false, hint: 'Pending Approval, Approved, On Hold or Cancelled. Blank defaults to Approved on a migration, Pending Approval on an ongoing batch.' },
      { key: 'payment_status', label: 'Payment Status', required: false, hint: 'Unpaid, Partial, Paid in Full, Scheduled, Settled or Void. Blank imports as Unpaid.' },
      { key: 'invoice_type', label: 'Invoice Type', required: false, hint: 'v1 accepts Standalone only. Blank defaults to Standalone.' },
      { key: 'source_reference', label: 'Source Reference', required: false, hint: 'Recommended: the row’s ID in your legacy system, preserved and searchable after import. Blank rows use vendor plus invoice number as identity.' },
      { key: 'source_status', label: 'Source Status', required: false, hint: 'The legacy state, preserved read-only for the audit trail.' },
      { key: 'posting_date', label: 'Posting Date', required: false, hint: 'Blank defaults to the invoice date. Migration mode overrides it with the go-live period.' },
      { key: 'trigger_date', label: 'Trigger Date', required: false, hint: 'Blank defaults to the invoice date.' },
      { key: 'due_date', label: 'Due Date', required: false, hint: 'Blank derives from trigger date plus term days. Supplied values are checked against that math.' },
      { key: 'currency', label: 'Currency', required: false, hint: 'ISO code. Blank imports as USD.' },
      { key: 'exchange_rate', label: 'Exchange Rate', required: false, hint: 'Required when the currency is not USD.' },
      { key: 'additional_charges', label: 'Additional Charges', required: false, hint: 'Sum of freight and misc charges. Blank computes from non-item lines.' },
      { key: 'total', label: 'Total', required: false, hint: 'Derived by Omne. If supplied and it disagrees, that is a blocker.' },
      { key: 'memo', label: 'Memo', required: false },
      { key: 'line_description', label: 'Line Description', required: false, hint: 'Line-item files only. Ignored on one-row-per-invoice files.' },
      { key: 'quantity', label: 'Quantity', required: false, hint: 'Line-item files only.' },
      { key: 'unit_price', label: 'Unit Price', required: false, hint: 'Line-item files only.' },
      { key: 'line_amount', label: 'Line Amount', required: false, hint: 'Line-item files only. Blank falls back to quantity times unit price.' },
      { key: 'line_type', label: 'Line Type', required: false, hint: 'item, freight or misc. Blank defaults to item. Tax is reserved for a later phase.' },
      { key: 'gl_account', label: 'GL Account', required: false, hint: 'Ongoing mode only. Migration offsets to the clearing account.' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments',
    noun: 'payment file',
    required: false,
    description: 'Optional. Allocations checked against each invoice’s declared payment status. Also accepted as a Payments sheet inside the invoice workbook.',
    fields: [
      { key: 'payment_reference', label: 'Payment Reference', required: true, hint: 'Unique within the file.' },
      { key: 'vendor_invoice_number', label: 'Vendor Invoice Number', required: false, hint: 'The invoice this allocates to. Map this or Source Reference.' },
      { key: 'source_reference', label: 'Source Reference', required: false, hint: 'Alternative join: the invoice’s legacy ID.' },
      { key: 'vendor_name', label: 'Vendor Name', required: false, hint: 'Disambiguates when two vendors share an invoice number.' },
      { key: 'payment_date', label: 'Payment Date', required: true },
      { key: 'amount_allocated', label: 'Amount Allocated', required: true },
      { key: 'payment_status', label: 'Payment Status', required: false, hint: 'Completed, Scheduled or Reversed. Blank imports as Completed.' },
      { key: 'method', label: 'Method', required: false },
    ],
  },
  {
    key: 'creditMemos',
    title: 'Credit Memos',
    noun: 'credit memo file',
    required: false,
    description: 'Optional, except when an invoice declares Settled. Also accepted as a Credit Memos sheet inside the invoice workbook.',
    fields: [
      { key: 'credit_memo_number', label: 'Credit Memo Number', required: true },
      { key: 'vendor_invoice_number', label: 'Vendor Invoice Number', required: false, hint: 'The invoice this credit applies to. Map this or Source Reference.' },
      { key: 'source_reference', label: 'Source Reference', required: false, hint: 'Alternative join: the invoice’s legacy ID.' },
      { key: 'vendor_name', label: 'Vendor Name', required: false, hint: 'Disambiguates when two vendors share an invoice number.' },
      { key: 'credit_date', label: 'Credit Date', required: true },
      { key: 'amount_allocated', label: 'Amount Allocated', required: true },
      { key: 'reason', label: 'Reason', required: false },
    ],
  },
];

export const objectSpec = (key: ImportObjectKey): ImportObjectSpec =>
  IMPORT_OBJECTS.find((o) => o.key === key)!;

/* Published exclusions (spec §1): they ride the template download and
 * the setup screen, never a tooltip. A user who reads them here is not
 * a support ticket at row 400. */
export const OUT_OF_SCOPE_V1 = [
  'Inventory invoices matched to a PO or receipt',
  'Pre-invoices and prepayments',
  'Tax codes and withholding',
  'Attachments',
  'Customer invoices',
];

export const HEADER_INVOICE_STATUSES = ['Pending Approval', 'Approved', 'On Hold', 'Cancelled'] as const;
export const HEADER_PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid in Full', 'Scheduled', 'Settled', 'Void'] as const;
export const LINE_TYPES = ['item', 'freight', 'misc'] as const;
export const PAYMENT_FILE_STATUSES = ['Completed', 'Scheduled', 'Reversed'] as const;

/* ── Run configuration (step 1) ── */
export interface ImportRunConfig {
  runName: string;
  mode: ImportMode;
  clearingAccount: string;
  /** e.g. "2026-09": every migrated invoice posts into this period. */
  postingPeriod: string;
  /** Rounding tolerance in minor units (cents). Raw string, never clamped. */
  toleranceText: string;
  /** Opt-in vendor auto-create (spec open question 3, QuickBooks style). */
  createMissingVendors: boolean;
  objects: { payments: boolean; creditMemos: boolean };
}

export const SUGGESTED_CLEARING_ACCOUNT = '2105 Migration Clearing';

export function defaultRunConfig(today: Date): ImportRunConfig {
  const label = today.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return {
    runName: `Vendor Invoice Import · ${label}`,
    mode: 'migration',
    clearingAccount: SUGGESTED_CLEARING_ACCOUNT,
    postingPeriod: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    toleranceText: '2',
    createMissingVendors: true,
    objects: { payments: true, creditMemos: true },
  };
}

/* ── Templates ── */

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

/* The invoice template teaches BOTH accepted shapes: a one-row invoice,
 * then a two-row invoice whose rows share the vendor and number and
 * carry one line each. */
const TEMPLATE_EXAMPLES: Record<ImportObjectKey, string[][]> = {
  invoices: [
    ['Acme Corp', 'INV-88112', '2026-08-04', '4820.00', 'Net 30', 'Approved', 'Unpaid', 'Standalone', 'LEG-0001', 'Open', '2026-08-04', '2026-08-04', '2026-09-03', 'USD', '', '150.00', '4970.00', 'August service retainer', '', '', '', '', '', ''],
    ['Tech Components Inc.', 'TCI-77031', '2026-08-18', '', 'Net 30', 'Approved', 'Unpaid', 'Standalone', 'LEG-0002', 'Open', '2026-08-18', '2026-08-18', '2026-09-17', 'USD', '', '', '', '24V relay boards, order 0871', '400 units 24V relay boards', '400', '35.50', '14200.00', 'item', '5010 Raw Material Purchases'],
    ['Tech Components Inc.', 'TCI-77031', '2026-08-18', '', 'Net 30', 'Approved', 'Unpaid', 'Standalone', 'LEG-0002', 'Open', '2026-08-18', '2026-08-18', '2026-09-17', 'USD', '', '', '', '24V relay boards, order 0871', 'Inbound freight', '', '', '420.00', 'freight', '5020 Freight Inbound'],
  ],
  payments: [
    ['PAY-3301', 'INV-88112', 'LEG-0001', 'Acme Corp', '2026-08-20', '2400.00', 'Completed', 'ACH'],
  ],
  creditMemos: [
    ['CM-104', 'INV-88112', 'LEG-0001', 'Acme Corp', '2026-08-22', '180.00', 'Damaged units credited'],
  ],
};

/** Template CSV per object: exact contract columns plus the example rows. */
export function templateCsv(key: ImportObjectKey): string {
  const spec = objectSpec(key);
  return toCsv([spec.fields.map((f) => f.key), ...TEMPLATE_EXAMPLES[key]]);
}

/** The template's example rows, for the preview sheet. */
export function templateExampleRows(key: ImportObjectKey): string[][] {
  return TEMPLATE_EXAMPLES[key];
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(name: string, content: string) {
  // UTF-8 BOM so Excel-on-Windows decodes non-ASCII cleanly.
  downloadBlob(name, new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), content], { type: 'text/csv;charset=utf-8' }));
}

export function templateFileStem(key: ImportObjectKey): string {
  if (key === 'invoices') return 'invoice-import-template';
  return key === 'creditMemos' ? 'credit-memos-template' : `${key}-template`;
}

const SHEET_NAMES: Record<ImportObjectKey, string> = {
  invoices: 'Invoices',
  payments: 'Payments',
  creditMemos: 'Credit Memos',
};

/** Template download in the user's format. The invoice .xlsx is ONE
 *  workbook carrying everything: the Invoices sheet, optional Payments
 *  and Credit memos sheets, and a Read me sheet with every field rule
 *  and the v1 exclusions — so the whole import round-trips as a single
 *  file (spec §1). CSV templates stay one file per object. */
export async function downloadTemplate(key: ImportObjectKey, format: 'csv' | 'xlsx'): Promise<void> {
  if (format === 'csv') {
    downloadTextFile(`${templateFileStem(key)}.csv`, templateCsv(key));
    return;
  }
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();

  const dataKeys: ImportObjectKey[] = key === 'invoices' ? ['invoices', 'payments', 'creditMemos'] : [key];
  for (const k of dataKeys) {
    const spec = objectSpec(k);
    const sheet = workbook.addWorksheet(SHEET_NAMES[k], { views: [{ state: 'frozen', ySplit: 1 }] });
    const headerRow = sheet.addRow(spec.fields.map((f) => f.key));
    headerRow.font = { bold: true, color: { argb: 'FF1E40AF' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
    });
    headerRow.height = 22;
    TEMPLATE_EXAMPLES[k].forEach((row) => sheet.addRow(row));
    spec.fields.forEach((f, idx) => {
      const example = String(TEMPLATE_EXAMPLES[k][0]?.[idx] ?? '');
      sheet.getColumn(idx + 1).width = Math.min(Math.max(f.key.length, example.length) + 4, 44);
    });
  }

  const readme = workbook.addWorksheet('Read Me');
  readme.getColumn(1).width = 28;
  readme.getColumn(2).width = 10;
  readme.getColumn(3).width = 90;
  const title = readme.addRow([key === 'invoices' ? 'Vendor Invoice Import · Template' : `${objectSpec(key).title} · Import Template`]);
  title.font = { bold: true, size: 13, color: { argb: 'FF1E40AF' } };
  if (key === 'invoices') {
    readme.addRow([]);
    readme.addRow(['One file is enough. One row per invoice, or one row per line item with the invoice columns repeated: rows sharing a vendor and invoice number become one invoice. Payments and credit memos can travel on their own sheets in this workbook.']);
  }
  for (const k of dataKeys) {
    const spec = objectSpec(k);
    readme.addRow([]);
    const head = readme.addRow([`${SHEET_NAMES[k]} · columns`, 'Required', 'Rule']);
    head.font = { bold: true };
    spec.fields.forEach((f) => {
      readme.addRow([f.key, f.required ? 'Yes' : 'No', f.hint ?? '']);
    });
  }
  readme.addRow([]);
  const scope = readme.addRow(['Not Supported in v1']);
  scope.font = { bold: true };
  OUT_OF_SCOPE_V1.forEach((s) => readme.addRow(['', '', s]));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    `${templateFileStem(key)}.xlsx`,
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
}

/* ── Bundled sample files ─────────────────────────────────────────────
 * A realistic slice of a messy legacy export in the FLAT shape real
 * systems produce (invoice fields repeated per line row), seeded so
 * every severity and every fix affordance has something to demonstrate:
 *  - LEG-1007: payment term "NET-45" does not exist        → blocker, map-once fix
 *  - LEG-1009: duplicate of ACM-8842, already in Omne      → blocker
 *  - LEG-1010: line sum disagrees with subtotal            → blocker, inline fix
 *  - LEG-1019: repeated rows disagree on the subtotal      → blocker (the caught typo)
 *  - LEG-1011: declared Paid in Full, allocations short    → exception (contract)
 *  - LEG-1012 / LEG-1013: near duplicates, 3 days apart    → exception, side by side
 *  - LEG-1014: due date does not equal trigger plus terms  → exception
 *  - LEG-1005: allocation exceeds the invoice balance      → exception
 *  - LEG-1003: vendor not in Omne (Northwind Traders)      → warning when auto-create is on
 *  - LEG-1008: item line with no description               → warning
 *  - LEG-1006: invoice date over 24 months old             → warning
 */

interface SampleInvoice {
  /** [ref, vendor, number, invStatus, payStatus, sourceStatus, invDate, postDate, terms, trigger, due, currency, subtotal, addlCharges, total, memo] */
  h: string[];
  /** [description, qty, unitPrice, amount, type, gl][] */
  lines: string[][];
}

const SAMPLE_INVOICES: SampleInvoice[] = [
  { h: ['LEG-1001', 'Global Logistics Partners', 'GLP-2214', 'Approved', 'Unpaid', 'Open', '2026-08-02', '2026-08-02', 'Net 30', '2026-08-02', '2026-09-01', 'USD', '12400.00', '380.00', '12780.00', 'Contract trucking, week 31'],
    lines: [
      ['Contract trucking, weekly store deliveries', '4', '3100.00', '12400.00', 'item', '6000 General & Admin'],
      ['Fuel surcharge', '', '', '380.00', 'freight', '5020 Freight Inbound'],
    ] },
  { h: ['LEG-1002', 'Atlantic Electronics', 'AE-99120', 'Approved', 'Partial', 'Open', '2026-08-06', '2026-08-06', 'Net 15', '2026-08-06', '2026-08-21', 'USD', '8150.00', '0.00', '8150.00', 'Patch cables and managed switches'],
    lines: [
      ['Managed switches, 2 units', '2', '1975.00', '3950.00', 'item', '6100 Office Supplies'],
      ['48 patch cables', '48', '87.50', '4200.00', 'item', '6100 Office Supplies'],
    ] },
  { h: ['LEG-1003', 'Northwind Traders', 'NWT-0071', 'Approved', 'Unpaid', 'Open', '2026-08-10', '2026-08-10', 'Net 30', '2026-08-10', '2026-09-09', 'USD', '5600.00', '140.00', '5740.00', 'Janitorial supplies, monthly replenishment'],
    lines: [
      ['Janitorial and HVAC filter supplies', '1', '5600.00', '5600.00', 'item', '6100 Office Supplies'],
      ['Delivery scheduling fee', '', '', '140.00', 'misc', '6000 General & Admin'],
    ] },
  { h: ['LEG-1004', 'Premium Materials Corp', 'PMC-4407', 'Pending Approval', 'Unpaid', 'Awaiting review', '2026-08-14', '2026-08-14', 'Net 30', '2026-08-14', '2026-09-13', 'USD', '21800.00', '650.00', '22450.00', 'Cold rolled steel coil, 12 tons'],
    lines: [
      ['Cold rolled steel coil, 12 tons', '1', '21800.00', '21800.00', 'item', '5010 Raw Material Purchases'],
      ['Flatbed haulage', '', '', '650.00', 'freight', '5020 Freight Inbound'],
    ] },
  { h: ['LEG-1005', 'Swift Distribution Ltd', 'SD-1180', 'Approved', 'Partial', 'Open', '2026-08-16', '2026-08-16', 'Net 30', '2026-08-16', '2026-09-15', 'USD', '9400.00', '0.00', '9400.00', 'Store delivery contract, August'],
    lines: [['Weekly store deliveries, August', '4', '2350.00', '9400.00', 'item', '6000 General & Admin']] },
  { h: ['LEG-1006', 'Metro Wholesale Group', 'MWG-0389', 'Approved', 'Paid in Full', 'Closed', '2024-06-30', '2024-06-30', 'Net 30', '2024-06-30', '2024-07-30', 'USD', '3350.00', '0.00', '3350.00', 'Warehouse restock, shrink wrap and labels'],
    lines: [['Shrink wrap, strapping, 500 pallet labels', '1', '3350.00', '3350.00', 'item', '6100 Office Supplies']] },
  { h: ['LEG-1007', 'Tech Components Inc.', 'TCI-77031', 'Approved', 'Unpaid', 'Open', '2026-08-18', '2026-08-18', 'NET-45', '2026-08-18', '2026-10-02', 'USD', '14200.00', '420.00', '14620.00', '24V relay boards, order 0871'],
    lines: [
      ['400 units 24V relay boards', '400', '35.50', '14200.00', 'item', '5010 Raw Material Purchases'],
      ['Inbound freight', '', '', '420.00', 'freight', '5020 Freight Inbound'],
    ] },
  { h: ['LEG-1008', 'Pacific Trading Co', 'PTC-5501', 'Approved', 'Unpaid', 'Open', '2026-08-20', '2026-08-20', 'Net 30', '2026-08-20', '2026-09-19', 'USD', '7800.00', '0.00', '7800.00', 'Resale merchandise, spring catalog'],
    lines: [['', '1200', '6.50', '7800.00', 'item', '5000 Cost of Goods Sold']] },
  { h: ['LEG-1009', 'Acme Corp', 'ACM-8842', 'Approved', 'Unpaid', 'Open', '2026-08-22', '2026-08-22', 'Net 30', '2026-08-22', '2026-09-21', 'USD', '64575.00', '0.00', '64575.00', 'Receiving invoice for PO 1004'],
    lines: [['Received goods, PO 1004', '1', '64575.00', '64575.00', 'item', '1200 Inventory']] },
  { h: ['LEG-1010', 'Quality Components Inc', 'QCI-3308', 'Approved', 'Unpaid', 'Open', '2026-08-24', '2026-08-24', 'Net 30', '2026-08-24', '2026-09-23', 'USD', '6900.00', '200.00', '', 'Bearing kits and drive belts'],
    lines: [
      ['Bearing kits', '30', '180.00', '5400.00', 'item', '6400 Repair & Maintenance'],
      ['Drive belts', '25', '52.00', '1300.00', 'item', '6400 Repair & Maintenance'],
      ['Rush handling', '', '', '200.00', 'misc', '6000 General & Admin'],
    ] },
  { h: ['LEG-1011', 'Elite Suppliers Network', 'ESN-2140', 'Approved', 'Paid in Full', 'Closed', '2026-08-25', '2026-08-25', 'Net 15', '2026-08-25', '2026-09-09', 'USD', '11600.00', '0.00', '11600.00', '15 laptops with docking stations'],
    lines: [['Laptops with docking stations, onboarding batch', '1', '11600.00', '11600.00', 'item', '6100 Office Supplies']] },
  { h: ['LEG-1012', 'Pacific Trading Co', 'PTC-5540', 'Approved', 'Unpaid', 'Open', '2026-08-26', '2026-08-26', 'Net 30', '2026-08-26', '2026-09-25', 'USD', '4450.00', '0.00', '4450.00', 'Printed shipping cartons, 3 sizes'],
    lines: [['Printed shipping cartons, 3 sizes', '10000', '0.445', '4450.00', 'item', '6150 Printing & Postage']] },
  { h: ['LEG-1013', 'Pacific Trading Co', 'PTC-5561', 'Approved', 'Unpaid', 'Open', '2026-08-29', '2026-08-29', 'Net 30', '2026-08-29', '2026-09-28', 'USD', '4450.00', '0.00', '4450.00', 'Printed shipping cartons, resend'],
    lines: [['Printed shipping cartons, 3 sizes', '10000', '0.445', '4450.00', 'item', '6150 Printing & Postage']] },
  { h: ['LEG-1014', 'Summit Distribution', 'SUM-6672', 'Approved', 'Unpaid', 'Open', '2026-08-30', '2026-08-30', 'Net 30', '2026-08-30', '2026-10-14', 'USD', '5250.00', '0.00', '5250.00', 'Quarterly calibration service'],
    lines: [['Calibration and safety inspection', '1', '5250.00', '5250.00', 'item', '6700 Professional Fees']] },
  { h: ['LEG-1015', 'Coastal Logistics LLC', 'CL-8830', 'On Hold', 'Unpaid', 'Disputed', '2026-09-01', '2026-09-01', 'Net 30', '2026-09-01', '2026-10-01', 'USD', '9950.00', '310.00', '10260.00', 'Overnight freight, 6 pallets, disputed rate'],
    lines: [
      ['Overnight freight, Dallas to Columbus', '6', '1658.33', '9950.00', 'item', '5020 Freight Inbound'],
      ['Liftgate service', '', '', '310.00', 'misc', '5020 Freight Inbound'],
    ] },
  { h: ['LEG-1016', 'Valley Wholesale', 'VW-1204', 'Cancelled', 'Void', 'Voided', '2026-09-02', '2026-09-02', 'Net 30', '2026-09-02', '2026-10-02', 'USD', '2850.00', '0.00', '2850.00', 'Order returned in full'],
    lines: [['Desk supplies, June restock', '1', '2850.00', '2850.00', 'item', '6100 Office Supplies']] },
  { h: ['LEG-1017', 'Mountain Equipment Co.', 'MEC-4419', 'Approved', 'Settled', 'Credited', '2026-09-03', '2026-09-03', 'Net 30', '2026-09-03', '2026-10-03', 'USD', '1980.00', '0.00', '1980.00', 'Damaged goods, fully credited'],
    lines: [['Water damaged cartons, credited', '8', '247.50', '1980.00', 'item', '5000 Cost of Goods Sold']] },
  { h: ['LEG-1018', 'Northern Trading Group', 'NTG-7015', 'Approved', 'Scheduled', 'Open', '2026-09-05', '2026-09-05', 'Net 15', '2026-09-05', '2026-09-20', 'USD', '6420.00', '0.00', '6420.00', 'Preventive stock, stamping press'],
    lines: [['Bearing kits and drive belts, preventive stock', '1', '6420.00', '6420.00', 'item', '6400 Repair & Maintenance']] },
  { h: ['LEG-1019', 'Riverside Packaging', 'RP-3302', 'Approved', 'Unpaid', 'Open', '2026-09-06', '2026-09-06', 'Net 30', '2026-09-06', '2026-10-06', 'USD', '4310.00', '0.00', '4310.00', 'Stretch film and corner boards'],
    lines: [
      ['Stretch film, 80 gauge', '60', '52.50', '3150.00', 'item', '6100 Office Supplies'],
      ['Corner boards, 4 ft', '400', '2.90', '1160.00', 'item', '6100 Office Supplies'],
    ] },
];

const SAMPLE_INVOICE_COLUMNS = [
  'source_reference', 'vendor_name', 'vendor_invoice_number', 'invoice_status', 'payment_status', 'source_status',
  'vendor_invoice_date', 'posting_date', 'payment_terms', 'trigger_date', 'due_date', 'currency',
  'subtotal', 'additional_charges', 'total', 'memo',
  'line_description', 'quantity', 'unit_price', 'line_amount', 'line_type', 'gl_account',
];

function flattenSampleInvoices(): string[][] {
  const out: string[][] = [SAMPLE_INVOICE_COLUMNS];
  for (const inv of SAMPLE_INVOICES) {
    for (const line of inv.lines) out.push([...inv.h, ...line]);
  }
  // LEG-1019's second row carries a typo'd subtotal: the two rows of one
  // invoice disagree, the exact mistake the grouping engine must catch
  // instead of silently minting a second invoice.
  const leg1019Rows = out.filter((r) => r[0] === 'LEG-1019');
  if (leg1019Rows.length > 1) leg1019Rows[1][12] = '4130.00';
  return out;
}

const SAMPLE_PAYMENTS: string[][] = [
  ['payment_reference', 'vendor_invoice_number', 'source_reference', 'vendor_name', 'payment_date', 'amount_allocated', 'payment_status', 'method'],
  ['PAY-8101', 'AE-99120', 'LEG-1002', 'Atlantic Electronics', '2026-08-15', '4000.00', 'Completed', 'ACH'],
  ['PAY-8102', 'SD-1180', 'LEG-1005', 'Swift Distribution Ltd', '2026-08-25', '11200.00', 'Completed', 'Check'],
  ['PAY-8103', 'MWG-0389', 'LEG-1006', 'Metro Wholesale Group', '2024-07-28', '3350.00', 'Completed', 'ACH'],
  ['PAY-8104', 'ESN-2140', 'LEG-1011', 'Elite Suppliers Network', '2026-09-01', '9800.00', 'Completed', 'Wire'],
  ['PAY-8105', 'VW-1204', 'LEG-1016', 'Valley Wholesale', '2026-09-04', '2850.00', 'Reversed', 'Check'],
  ['PAY-8106', 'NTG-7015', 'LEG-1018', 'Northern Trading Group', '2026-09-19', '6420.00', 'Scheduled', 'ACH'],
];

const SAMPLE_CREDIT_MEMOS: string[][] = [
  ['credit_memo_number', 'vendor_invoice_number', 'source_reference', 'vendor_name', 'credit_date', 'amount_allocated', 'reason'],
  ['CM-2201', 'MEC-4419', 'LEG-1017', 'Mountain Equipment Co.', '2026-09-06', '1980.00', 'Water damage on arrival, full credit'],
];

export const SAMPLE_FILES: Record<ImportObjectKey, { name: string; csv: string }> = {
  invoices: { name: 'legacy-invoice-export.csv', csv: toCsv(flattenSampleInvoices()) },
  payments: { name: 'legacy-payments.csv', csv: toCsv(SAMPLE_PAYMENTS) },
  creditMemos: { name: 'legacy-credit-memos.csv', csv: toCsv(SAMPLE_CREDIT_MEMOS) },
};
