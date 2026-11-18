/* Provenance: your-invoice-mate/src/app/components/import-adjustment/textMeasure.d.mts
 * sha256 da0f070ac4490a1a7c561ef57587f34e5e4c3b89cf531bdc18c62c47a63d6d0c
 * Copied into role-zen 2026-09-30. Verbatim. */
export const PX_PER_WIDTH: number;
export const COLUMN_PX_OFFSET: number;
export const CELL_PADDING_PX: number;
export function charWidth(ch: string, bold?: boolean): number;
export function textWidth(text: string | null | undefined, bold?: boolean): number;
export function usableWidth(widths: number | number[]): number;
export function lineCount(text: string | null | undefined, widths: number | number[], bold?: boolean): number;
