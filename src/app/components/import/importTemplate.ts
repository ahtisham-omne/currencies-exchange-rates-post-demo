/**
 * Template download and the built-in dry-run fixture.
 *
 * `downloadTemplate` writes the same 38 columns, in the same order and
 * with the same required/conditional marks, as the workbook shipped to
 * customers, plus two clean sample records so the grouping rule is
 * visible: record columns on a group's first row, `Line /` columns on
 * every row.
 *
 * The template carries its own worked examples, two records over three rows,
 * because a second download for the same purpose only invites someone to
 * import the wrong file. Everything below that used to feed a separate sample
 * fixture has gone with it.
 *
 * (Removed) a separate dry-run fixture used to carry one
 * clean record and several deliberately broken ones so a dry run exercises
 * every branch of the review sheet: a misspelled customer that appears
 * twice (the case for fixing twins in one action), an item that does not
 * exist, a unit the item cannot be sold in, a missing required cell, an
 * off-list price, and a status that needs a date it has not got.
 */

import { COLUMNS, KEY_COLUMN, RECORD_LABEL } from "./importSpec";

function markedLabel(c: { label: string; requirement: string }): string {
  if (c.requirement === "required") return `${c.label} *`;
  if (c.requirement === "conditional") return `${c.label} †`;
  return c.label;
}

export const HEADER_ROW = COLUMNS.map(markedLabel);

/* KEY_COLUMN is a literal per repo, so widen before comparing. */
const isQuotes = (KEY_COLUMN as string) === "quoteNo";
const K = (q: string, s: string) => (isQuotes ? q : s);

/** Column key → value, for readability; expanded to a full row below. */
type Cells = Record<string, string>;

function row(cells: Cells): string[] {
  return COLUMNS.map((c) => cells[c.key] ?? "");
}

/* ── Clean sample, two records ─────────────────────────────────────── */

const SAMPLE: Cells[] = [
  {
    [KEY_COLUMN]: K("Q-000-000-901", "SO-000-000-901"),
    customerName: "Metro City Fire & Rescue",
    [K("quoteStatus", "orderStatus")]: K("Sent to Customer", "Released"),
    currencyCode: "USD",
    requestedOn: "2026-01-28",
    [K("expirationDate", "shipBy")]: K("2026-04-22", "2026-08-14"),
    deliveryLocation: "Metro City Fire & Rescue > Station 1 HQ",
    paymentTerms: "2/10 Net 30",
    paymentMethod: "ACH",
    salesRep: "yahya.naveed@omnesoft.com",
    primaryContact: "Jennifer Anderson",
    priority: "High",
    tags: "Ambulance Build|grant-funded",
    lineItem: "000-100-002", lineUnitOfMeasure: "EA",
    lineQuantity: "2", linePricePerUnit: "48200",
    linePricingRule: "Government Contract Pricing|Expedited Build Premium",
    lineDiscountPremium: "Chassis Delivery & Prep:+2400",
    /* Both adjustment levels are filled here on purpose: the template's
       own example is where someone learns the notation. */
    orderLevelDiscountPremium: "Multi-Unit Fleet Discount:-2%|Rush Handling:+1800",
  },
  { lineItem: "000-100-019", lineUnitOfMeasure: "Box", lineQuantity: "2",
    linePricePerUnit: "94200",
    lineDiscountPremium: "Body Mount Labor:+3200" },
  {
    [KEY_COLUMN]: K("Q-000-000-902", "SO-000-000-902"),
    customerName: "Tri-County EMS Authority",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-04",
    salesRep: "sarah.chen@omnesoft.com", priority: "Standard",
    lineItem: "000-100-041", lineUnitOfMeasure: "EA",
    lineQuantity: "11", linePricePerUnit: "685",
  },
  /* Third example: a single line, a pipe-separated list, and a one-time
     adjustment, so all three notations appear at least once. */
  {
    [KEY_COLUMN]: K("Q-000-000-903", "SO-000-000-903"),
    customerName: "Lakewood Community Hospital",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-18",
    paymentTerms: "Net 45", paymentMethod: "Wire Transfer",
    salesRep: "emily.rios@omnesoft.com", priority: "Low",
    tags: "legacy|second-site",
    secondaryContacts: "James Mitchell|Robert Chen",
    orderLevelDiscountPremium: "Goodwill Credit:-500",
    lineItem: "000-100-041", lineUnitOfMeasure: "EA",
    lineQuantity: "4", linePricePerUnit: "685",
  },

  /* ── Rows 5 onwards demonstrate what the review step does with a file that
     is not clean. Every one is labelled in Internal Notes, and the guide says
     to delete them before importing real data. They are here because the
     template is the only download: a reader has to be able to see a warning
     and an error without hand-editing a spreadsheet first. ── */

  /* WARNING · a legacy priority word this import understands. Imports as
     Standard, so the row is never held back. */
  {
    [KEY_COLUMN]: K("Q-000-000-904", "SO-000-000-904"),
    customerName: "Pinecrest Volunteer Fire Dept",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-20",
    salesRep: "marcus.taylor@omnesoft.com",
    priority: "Medium",
    internalNotes: "EXAMPLE, warning: Medium is not a priority in Omne and imports as Standard. Delete this row.",
    lineItem: "000-100-026", lineUnitOfMeasure: "EA",
    lineQuantity: "3", linePricePerUnit: "3250",
  },

  /* WARNING · no requested date, and a price that differs from the customer
     price list. Both import as they stand. */
  {
    [KEY_COLUMN]: K("Q-000-000-905", "SO-000-000-905"),
    customerName: "Summit Regional Medical Center",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD",
    salesRep: "david.kowalski@omnesoft.com", priority: "Standard",
    internalNotes: "EXAMPLE, warnings: no requested date, and a price that is off the price list. Delete this row.",
    lineItem: "000-100-049", lineUnitOfMeasure: "EA",
    lineQuantity: "2", linePricePerUnit: "7100",
  },

  /* ERROR · a SKU Omne does not hold, and a unit the item is not sold in.
     Both are fixed in the line items sheet. */
  {
    [KEY_COLUMN]: K("Q-000-000-906", "SO-000-000-906"),
    customerName: "Coastal Search & Rescue",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-24",
    salesRep: "emily.rios@omnesoft.com", priority: "Standard",
    internalNotes: "EXAMPLE, errors: an unknown SKU on line 1 and a unit line 2 is not sold in. Delete this row.",
    lineItem: "000-999-777", lineUnitOfMeasure: "EA",
    lineQuantity: "1", linePricePerUnit: "1200",
    lineDescription: "Legacy part number retired in 2019",
  },
  { lineItem: "000-100-049", lineUnitOfMeasure: "Pallet",
    lineQuantity: "2", linePricePerUnit: "7850" },

  /* ERROR · the same misspelled customer on two records, so one fix can be
     applied to both. */
  {
    [KEY_COLUMN]: K("Q-000-000-907", "SO-000-000-907"),
    customerName: "Tri-Countty EMS Authorty",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-26",
    salesRep: "sarah.chen@omnesoft.com", priority: "Standard",
    internalNotes: "EXAMPLE, error: customer name misspelled. Fixing it here offers to fix the next row too. Delete this row.",
    lineItem: "000-100-041", lineUnitOfMeasure: "EA",
    lineQuantity: "6", linePricePerUnit: "685",
  },
  {
    [KEY_COLUMN]: K("Q-000-000-908", "SO-000-000-908"),
    customerName: "Tri-Countty EMS Authorty",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-02-27",
    salesRep: "j.rivera@oldsystem.local", priority: "Standard",
    deliveryLocation: "Harbour Yard 4",
    internalNotes: "EXAMPLE, errors: same misspelled customer, plus a rep and a location Omne does not hold. Delete this row.",
    lineItem: "000-100-195", lineUnitOfMeasure: "EA",
    lineQuantity: "12", linePricePerUnit: "980",
  },

  /* ERROR · a number the listing already uses. One click renumbers it. */
  {
    [KEY_COLUMN]: K("Q-000-000-042", "SO-000-000-012"),
    customerName: "Lakewood Community Hospital",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-03-02",
    paymentTerms: "Net 30", paymentMethod: "ACH",
    salesRep: "marcus.taylor@omnesoft.com", priority: "Standard",
    internalNotes: "EXAMPLE, error: this number already exists in Omne. Renumber it or drop the row. Delete this row.",
    lineItem: "000-100-079", lineUnitOfMeasure: "EA",
    lineQuantity: "4", linePricePerUnit: "1250",
  },

  /* ERROR · a required cell left empty. */
  {
    [KEY_COLUMN]: K("Q-000-000-909", "SO-000-000-909"),
    customerName: "Great Plains Fire Protection",
    [K("quoteStatus", "orderStatus")]: "Draft",
    currencyCode: "USD", requestedOn: "2026-03-04",
    salesRep: "michael.rodriguez@omnesoft.com", priority: "Standard",
    internalNotes: "EXAMPLE, error: the line has no unit of measure, which is required. Delete this row.",
    lineItem: "000-100-081", lineUnitOfMeasure: "",
    lineQuantity: "5", linePricePerUnit: "2400",
  }
];




/* ── Writers ──────────────────────────────────────────────────────── */

async function writeWorkbook(rows: string[][], fileName: string, sheetName = "Data Entry") {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));

  /* Mark the header row the way the template does, so a round-trip out
     and back in still parses. */
  const header = ws.getRow(1);
  header.font = { bold: true, size: 10 };
  header.eachCell((cell, col) => {
    const spec = COLUMNS[col - 1];
    const fill = spec?.requirement === "required" ? "FFFEE2E2"
      : spec?.requirement === "conditional" ? "FFFEF3C7" : "FFF1F5F9";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(34, Math.max(14, c.label.length + 4)); });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV variant of the template. The bar offers both formats, as UAC's does. */
export async function downloadTemplateCsv() {
  const rows = [HEADER_ROW, ...SAMPLE.map(row)];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${RECORD_LABEL.replace(/\s+/g, "_")}s_Import_Template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadTemplate() {
  await writeWorkbook(
    [HEADER_ROW, ...SAMPLE.map(row)],
    `${RECORD_LABEL.replace(/\s+/g, "_")}s_Import_Template.xlsx`,
  );
}

/** Export arbitrary rows, used by Actions → Export. */
export async function downloadRows(rows: string[][], fileName: string) {
  await writeWorkbook(rows, fileName);
}
