export const PX_PER_WIDTH: number;
export const COLUMN_PX_OFFSET: number;
export const CELL_PADDING_PX: number;
export function charWidth(ch: string, bold?: boolean): number;
export function textWidth(text: string | null | undefined, bold?: boolean): number;
export function usableWidth(widths: number | number[]): number;
export function lineCount(text: string | null | undefined, widths: number | number[], bold?: boolean): number;
