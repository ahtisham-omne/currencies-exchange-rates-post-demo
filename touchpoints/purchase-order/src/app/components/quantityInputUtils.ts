import type { KeyboardEvent } from "react";

export function isValidQuantityDraft(raw: string, serialized: boolean): boolean {
  return serialized ? /^\d*$/.test(raw) : /^\d*(?:\.\d{0,2})?$/.test(raw);
}

export function parseQuantityDraft(raw: string, serialized: boolean): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === ".") return null;
  if (!isValidQuantityDraft(trimmed, serialized)) return null;

  const parsed = serialized ? Number.parseInt(trimmed, 10) : Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;

  const normalized = serialized ? Math.round(parsed) : Math.round(parsed * 100) / 100;
  return Math.max(0, normalized);
}

export function getDraftQuantityValue(raw: string, serialized: boolean): number {
  if (raw.trim() === "" || raw.trim() === ".") return 0;
  return parseQuantityDraft(raw, serialized) ?? 0;
}

export function formatQuantityValue(value: number, serialized: boolean): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (serialized) return String(Math.round(safeValue));

  const rounded = Math.round(safeValue * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function stepQuantity(value: number, delta: number, serialized: boolean): number {
  const stepped = Math.max(0, value + delta);
  return serialized ? Math.round(stepped) : Math.round(stepped * 100) / 100;
}

export function preventInvalidQuantityKey(event: KeyboardEvent<HTMLInputElement>, serialized: boolean) {
  const blockedKeys = serialized ? new Set([".", ",", "e", "E", "-"]) : new Set(["e", "E", "-"]);
  if (blockedKeys.has(event.key)) event.preventDefault();
}