/* Writes the Quotes and Sales Orders import templates (xlsx + csv) into
   public/templates, mirroring the column contract in the specs. Each template
   carries three clean example rows plus one warning row and one error row, each
   labelled in Internal Notes so the user knows to delete them. */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { writeFileSync } from 'node:fs';
import {
  TPL_FONT,
  applyDataEntryGrid,
  styleDataEntryExampleRow,
  styleDataEntryHeader,
} from './src/app/components/data-imports/importTemplateStyle.ts';

/* ExcelJS stamps the workbook and every zip entry with the current time, so
   pin both to keep regenerated files byte-identical. */
const PINNED = new Date(Date.UTC(2026, 0, 1));

const QUOTE_COLS = [
  ['Quote No','*'],['Customer Name','*'],['Quote Status','*'],['Currency Code','†'],['Requested On',''],['Respond By',''],
  ['Expiration Date','†'],['Delivery Location',''],['Payment Terms',''],['Payment Method',''],['Sales Rep',''],
  ['Secondary Sales Reps',''],['Primary Contact',''],['Secondary Contacts',''],['Priority',''],['Tags',''],['Lead Source',''],
  ['RFQ/RFP ID',''],['Win Probability',''],['Expected Close Date',''],['Competitive Situation',''],
  ['Quote-Level Discount/Premium',''],['External Notes',''],['Internal Notes',''],['External Links',''],
  ['Line / Type','*'],['Line / Item','*'],['Line / Unit of Measure','*'],['Line / Quantity','*'],['Line / Price Per Unit','†'],
  ['Line / Pricing Rule',''],['Line / Discount/Premium',''],['Line / Expected Ship By',''],['Line / Expected Delivery Date',''],
  ['Line / Freight Carrier/Method',''],['Line / Description',''],['Line / Notes',''],
];

const SO_COLS = [
  ['SO Number','*'],['Source Quote No',''],['Customer Name','*'],['Order Status','*'],['Currency Code','†'],['Requested On',''],
  ['Confirmation Date',''],['Ship By','†'],['Delivery Date',''],['Delivery Location',''],['Payment Terms',''],['Payment Method',''],
  ['Sales Rep',''],['Secondary Sales Reps',''],['Primary Contact',''],['Secondary Contacts',''],['Priority',''],['Tags',''],
  ['Lead Source',''],['RFQ/RFP ID',''],['Competitive Situation',''],['Order-Level Discount/Premium',''],
  ['External Notes',''],['Internal Notes',''],['External Links',''],
  ['Line / Type','*'],['Line / Item','*'],['Line / Unit of Measure','*'],['Line / Quantity','*'],['Line / Price Per Unit','†'],
  ['Line / Pricing Rule',''],['Line / Discount/Premium',''],['Line / Expected Ship By',''],['Line / Expected Delivery Date',''],
  ['Line / Freight Carrier/Method',''],['Line / Description',''],['Line / Notes',''],
];

const header = (cols) => cols.map(([label, mark]) => (mark ? `${label} ${mark}` : label));

function row(cols, values) {
  return cols.map(([label]) => values[label] ?? '');
}

const QUOTE_ROWS = [
  { 'Quote No':'Q-000-300-001','Customer Name':'Metro City Fire & Rescue','Quote Status':'Sent to Customer','Currency Code':'USD','Requested On':'03/16/2026','Expiration Date':'04/15/2026','Delivery Location':'Metro City Fire & Rescue > Main Campus','Payment Terms':'Net 30','Payment Method':'ACH/Direct Deposit','Sales Rep':'sarah.johnson@omnesoft.com','Primary Contact':'James Mitchell','Priority':'Standard','Tags':'Engine Components|Hydraulics','Internal Notes':'EXAMPLE. Delete this row before importing.','Line / Type':'Item','Line / Item':'000-100-001','Line / Unit of Measure':'EA','Line / Quantity':'4','Line / Price Per Unit':'1500','Line / Pricing Rule':'Government Contract' },
  { 'Line / Type':'Item','Line / Item':'000-100-002','Line / Unit of Measure':'EA','Line / Quantity':'2','Line / Price Per Unit':'1500','Line / Notes':'Second line of the same quote: leave Quote No blank to continue it.' },
  { 'Quote No':'Q-000-300-002','Customer Name':'Tri-County EMS Authority','Quote Status':'Draft','Currency Code':'USD','Requested On':'03/18/2026','Payment Terms':'Net 45','Sales Rep':'alex.chen@omnesoft.com','Primary Contact':'Susan Brennan','Priority':'High','Internal Notes':'EXAMPLE. Delete this row before importing.','Line / Type':'Item','Line / Item':'000-100-003','Line / Unit of Measure':'EA','Line / Quantity':'6','Line / Price Per Unit':'1500' },
  { 'Quote No':'Q-000-300-003','Customer Name':'Lakewood Community Hospital','Quote Status':'won','Currency Code':'USD','Requested On':'03/20/2026','Expiration Date':'04/19/2026','Payment Terms':'Net 30','Priority':'medium','Internal Notes':'EXAMPLE, warning: won and medium are not Omne values. They import as Confirmed by Customer and Standard. Delete this row.','Line / Type':'Item','Line / Item':'000-100-026','Line / Unit of Measure':'each','Line / Quantity':'3','Line / Price Per Unit':'1500' },
  { 'Quote No':'Q-000-100-001','Customer Name':'Fairview Ambulance Service','Quote Status':'Sent to Customer','Currency Code':'USD','Requested On':'03/22/2026','Expiration Date':'04/21/2026','Priority':'Standard','Internal Notes':'EXAMPLE, error: this quote number already exists and the customer is not in Omne. Delete this row.','Line / Type':'Item','Line / Item':'000-999-111','Line / Unit of Measure':'EA','Line / Quantity':'1','Line / Price Per Unit':'2400' },
];

const SO_ROWS = [
  { 'SO Number':'SO-000-300-001','Source Quote No':'Q-000-100-001','Customer Name':'Metro City Fire & Rescue','Order Status':'Released','Currency Code':'USD','Requested On':'03/16/2026','Ship By':'03/26/2026','Delivery Location':'Metro City Fire & Rescue > Main Campus','Payment Terms':'Net 30','Payment Method':'ACH/Direct Deposit','Sales Rep':'sarah.johnson@omnesoft.com','Primary Contact':'James Mitchell','Priority':'Standard','Tags':'Engine Companies|Hydraulics','Internal Notes':'EXAMPLE. Delete this row before importing.','Line / Type':'Item','Line / Item':'000-100-001','Line / Unit of Measure':'EA','Line / Quantity':'4','Line / Price Per Unit':'1500','Line / Pricing Rule':'Government Contract' },
  { 'Line / Type':'Item','Line / Item':'000-100-002','Line / Unit of Measure':'EA','Line / Quantity':'2','Line / Price Per Unit':'1500','Line / Notes':'Second line of the same order: leave SO Number blank to continue it.' },
  { 'SO Number':'SO-000-300-002','Customer Name':'Tri-County EMS Authority','Order Status':'Draft','Currency Code':'USD','Requested On':'03/18/2026','Payment Terms':'Net 45','Sales Rep':'alex.chen@omnesoft.com','Primary Contact':'Susan Brennan','Priority':'High','Internal Notes':'EXAMPLE. Delete this row before importing.','Line / Type':'Item','Line / Item':'000-100-003','Line / Unit of Measure':'EA','Line / Quantity':'6','Line / Price Per Unit':'1500' },
  { 'SO Number':'SO-000-300-003','Customer Name':'Lakewood Community Hospital','Order Status':'cleared','Currency Code':'USD','Requested On':'03/20/2026','Ship By':'03/30/2026','Payment Terms':'Net 30','Priority':'medium','Internal Notes':'EXAMPLE, warning: cleared and medium are not Omne values. They import as Released and Standard. Delete this row.','Line / Type':'Item','Line / Item':'000-100-026','Line / Unit of Measure':'each','Line / Quantity':'3','Line / Price Per Unit':'1500' },
  { 'SO Number':'SO-000-000-042','Customer Name':'Fairview Ambulance Service','Order Status':'Released','Currency Code':'USD','Requested On':'03/22/2026','Priority':'Standard','Internal Notes':'EXAMPLE, error: this order number already exists and the customer is not in Omne. Delete this row.','Line / Type':'Item','Line / Item':'000-999-111','Line / Unit of Measure':'EA','Line / Quantity':'1','Line / Price Per Unit':'2400' },
];

function csvCell(v) { return /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v; }

async function write(cols, rows, title, base, dir) {
  const heads = header(cols);
  const body = rows.map((r) => row(cols, r));

  const csv = [heads, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
  writeFileSync(`${dir}/${base}.csv`, csv, 'utf8');

  const wb = new ExcelJS.Workbook();
  wb.created = PINNED;
  wb.modified = PINNED;
  const ws = wb.addWorksheet('Data Entry');
  ws.mergeCells(1, 1, 1, heads.length);
  const banner = ws.getCell(1, 1);
  banner.value = `${title}  ·  keep the header row exactly as it is, one line item per row, * required, † conditional`;
  banner.font = { name: TPL_FONT, bold: true, size: 11, color: { argb: 'FF1A1A18' } };
  banner.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 22;
  ws.addRow(heads);
  /* Shared import-template standard: required ('*') headers white on red,
     optional (including conditional '†') dark on warm grey, bordered example
     rows, then an empty bordered grid to row 600 with required columns tinted. */
  const required = cols.map(([, mark]) => mark === '*');
  styleDataEntryHeader(ws, 2, required);
  body.forEach((r) => ws.addRow(r));
  body.forEach((_, i) => styleDataEntryExampleRow(ws, 3 + i, heads.length));
  applyDataEntryGrid(ws, { firstRow: 3 + body.length, required });
  ws.columns.forEach((col, i) => { col.width = Math.min(40, Math.max(14, String(heads[i]).length + 4)); });
  ws.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  zip.forEach((_, f) => { f.date = PINNED; });
  writeFileSync(`${dir}/${base}.xlsx`, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

/* node gen-templates.mjs [templatesRoot], default public/templates. */
const root = process.argv[2] ?? 'public/templates';
await write(QUOTE_COLS, QUOTE_ROWS, 'OMNE QUOTES IMPORT TEMPLATE', 'OMNE_Quotes_Import_Template', `${root}/quotes`);
await write(SO_COLS, SO_ROWS, 'OMNE SALES ORDERS IMPORT TEMPLATE', 'OMNE_Sales_Orders_Import_Template', `${root}/sales-orders`);
console.log('templates written');
