type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type ExportCell = string | number | Date | null | undefined;

export const EXPORT_STYLES: Record<string, Record<string, unknown>>;
export const MIDDLE_DOT_SEP: string;
export const BAND_HEIGHT: number;
export const HEADER_HEIGHT: number;
export const SPACER_HEIGHT: number;
export const GLOSSARY_SHEET: string;
export const GLOSSARY_WIDTHS: number[];
export const MIN_COL_WIDTH: number;
export const MAX_COL_WIDTH: number;
export function displayDate(d?: Date): string;
export function colLetter(n: number): string;
export function addExportSheet(
  wb: Workbook,
  opts: { entity: string; sheetName: string; headers: string[]; rows: ExportCell[][]; numFmts?: (string | undefined)[]; freezeColumns?: number; date?: Date },
): Worksheet;
export function addGlossarySheet(
  wb: Workbook,
  opts: { entity: string; sheetName: string; entries: [string, string | null | undefined][] },
): Worksheet;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildExportPdf(jsPDF: any, autoTable: any, opts: { entity: string; headers: string[]; body: string[][]; date?: Date }): any;
