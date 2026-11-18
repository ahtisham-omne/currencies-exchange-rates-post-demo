/* Provenance: your-invoice-mate/src/app/components/import-adjustment/templateLayout.d.mts
 * sha256 1886bf76ecac4f763e64d09c9c3a7330a52ae56dec10c570cc22b3cac4a9493f
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Type surface for templateLayout.mjs, the shared Omne import template layout
   (copied from radiant-core-fusion/src/app/import-export/templateLayout.mjs, the
   same file every module's templates are built from). Only the parts Physical
   Inventory uses are typed here. */
import type { Workbook, Worksheet } from "exceljs";

export interface ExcelJSLike {
  Workbook: new () => Workbook;
}

/** One template column, in the shape the layout reads. */
export interface TemplateColumn {
  label: string;
  required: boolean;
  width?: number;
  /** Numbers are written as numbers so Excel does not flag them as text. */
  example1: string | number;
  example2: string | number;
  textFormat?: boolean;
  reference: { description: string; format: string; validValues: string; example: string };
}

export interface TemplateSpec {
  columns: TemplateColumn[];
  template: {
    bannerTitle: string;
    moduleLine: string;
    countLine: string;
    frSubtitle: string;
    instructions: {
      quickStart: string[];
      sections: { heading: string; intro?: string; items?: [string, string][] }[];
    };
    compareTable?: {
      heading: string;
      colHeaders: [string, string];
      rows: [string, string, string][];
      mergedLast?: [string, string];
    };
    validValues: { heading: string; subHeader?: string[]; rows?: [string, string][]; note?: string }[];
  };
}

export const DATA_ROWS: number;
export const GRID_ROW_HEIGHT: number;
export const SPACER_HEIGHT: number;
export const BAND_HEIGHT: number;
export const SHEET_NAMES: string[];
export const BAND_TEXT: (title: string, sheetName: string) => string;
export function applyHeadingBand(ws: Worksheet, title: string, sheetName: string, lastCol: number): void;
export function templateHeaders(spec: TemplateSpec): string[];
export function wrappedRowHeight(cells: Array<[unknown, number | number[], boolean?]>): number;
export function buildTemplateWorkbook(ExcelJS: ExcelJSLike, spec: TemplateSpec): Workbook;
export function escapeCsvCell(value: unknown): string;
export function buildTemplateCsv(spec: TemplateSpec): string;
