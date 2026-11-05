import type { EntityData } from "./spec.data.mjs";

export const TEMPLATE_STYLES: Record<string, Record<string, unknown>>;
export const DATA_ENTRY_SHEET: "Data Entry";
export const DATA_ROWS: 600;
export const MIDDLE_DOT_SEP: string;
export const FIELD_REFERENCE_HEADERS: string[];
export function BANNER(title: string): string;
export function colLetter(n: number): string;
export function templateHeaders(data: EntityData): string[];
export function countLine(data: EntityData): string;
/** `ExcelJS` is the exceljs module object; the return is an exceljs Workbook. */
export function buildTemplateWorkbook<TWorkbook = unknown>(ExcelJS: { Workbook: new () => TWorkbook }, data: EntityData): TWorkbook;
export const INSTRUCTIONS_WIDTHS: number[];
export const FIELD_REFERENCE_WIDTHS: number[];
export const VALID_VALUES_WIDTHS: number[];
export const ENTRY_ROW_HEIGHT: number;
export function wrappedRowHeight(cells: [string | null | undefined, number | number[], boolean?][]): number;
/** Fillable Data Entry grid on rows fromRow..toRow; `ws` is an exceljs Worksheet. */
export function applyDataEntryGrid(ws: unknown, columns: { required?: boolean; text?: boolean }[], fromRow: number, toRow: number): void;
export function BAND_TEXT(entity: string, sheet: string): string;
export const BAND_HEIGHT: number;
/** Row 1 brand band on an exceljs Worksheet. */
export function applyHeadingBand(ws: unknown, text: string, lastCol: number): void;
export const SPACER_HEIGHT: number;
export const MIN_ROW_HEIGHT: number;
