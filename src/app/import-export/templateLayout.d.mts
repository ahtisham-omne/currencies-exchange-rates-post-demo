/* Type surface of templateLayout.mjs. */
import type { ColumnReference, CompareTable, InstructionSection, ItemReviewField, TemplateCopy } from "./spec.data.mjs";

export interface TemplateModelColumn {
  key: ItemReviewField;
  label: string;
  required: boolean;
  width: number;
  text: boolean;
  group: string;
  reference: ColumnReference;
  /** Fixed values: the column gets a Data Entry dropdown. */
  options?: string[];
}

export interface ResolvedValidValuesBlock {
  heading: string;
  subHeader?: string[];
  rows?: string[][];
  note?: string;
}

export interface TemplateModel {
  fileBase: string;
  guideFile: string;
  title: string;
  bannerFieldReference: string;
  sheetTitle: string;
  moduleLine: string;
  countLine: string;
  frSubtitle: string;
  vvTitle: string;
  vvSubtitle: string;
  columns: TemplateModelColumn[];
  headers: string[];
  examples: string[][];
  instructions: { quickStart: string[]; sections: InstructionSection[] };
  compareTable: CompareTable;
  validValues: ResolvedValidValuesBlock[];
  guide: TemplateCopy["guide"];
}

export const DATA_ENTRY_SHEET: "Data Entry";
export const DATA_ROWS: 600;
export const FROZEN_COLUMNS: 3;
export const GUIDE_WIDTH: 66;
export const DATA_ENTRY_ROW_HEIGHT: 20;
export const SPACER_ROW_HEIGHT: 18;
export const MIN_ROW_HEIGHT: 15;

export function buildTemplateModel(): TemplateModel;
/** `ExcelJS` is the exceljs module (its default export). Returns an ExcelJS Workbook. */
export function buildWorkbookWith(ExcelJS: any, model?: TemplateModel): any;
/** Outline rows fromRow..toRow of a Data Entry worksheet as the empty, bordered grid the template ships with. */
export function applyDataEntryGrid(ws: any, columns: { required: boolean; text: boolean }[], fromRow: number, toRow: number): void;
/** Row 1 brand band shared by every tab: "<title>  ·  <sheet>" on 1D4E89 across A..lastCol. */
export function applyListValidations(ws: any, columns: { label: string; options?: string[] }[], fromRow: number, toRow: number): void;
export function applyHeadingBand(ws: any, title: string, sheetName: string, lastCol: number): void;
export function buildTemplateCsvText(model?: TemplateModel): string;
export function buildGuideText(model?: TemplateModel): string;
export function wrapText(text: string, width?: number, indent?: number, firstIndent?: number): string[];
