import type { EntityData } from "./spec.data.mjs";

export const GUIDE_WIDTH: 66;
export function csvCell(value: unknown): string;
export function wrap(text: string, width?: number): string[];
export function buildTemplateCsv(data: EntityData): string;
export function buildGuideText(data: EntityData): string;
