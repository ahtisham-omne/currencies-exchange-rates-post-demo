// StatusPill — single-segment generic status pill atom.
// Shared across detail-page tables (Sales Order Status, Shipment Status, future
// Purchasing/Production). Caller picks the tone; atom owns the visual contract.
import React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "amber"
  | "emerald"
  | "rose"
  | "blue"
  | "purple"
  | "violet";

/* Token map: bg / text / border per tone. Verbatim hex values mirror the
 * Partners pill literal palette so adoption requires no per-call overrides. */
const TONE_TOKENS: Record<StatusTone, { bg: string; text: string; border: string }> = {
  neutral: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  amber:   { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  emerald: { bg: "#D1FAE5", text: "#047857", border: "#A7F3D0" },
  rose:    { bg: "#FFE4E6", text: "#BE123C", border: "#FECDD3" },
  blue:    { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
  purple:  { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" },
  violet:  { bg: "#F5F3FF", text: "#7C3AED", border: "#E9D5FF" },
};

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

/**
 * StatusPill — flat coloured rounded pill with subtle border.
 * Default tone is neutral; callers should pass an explicit tone.
 */
export function StatusPill({ label, tone = "neutral", className }: StatusPillProps) {
  const t = TONE_TOKENS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap border",
        className,
      )}
      style={{
        backgroundColor: t.bg,
        color: t.text,
        borderColor: t.border,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

/* Convenience helper — Sales Order status → tone mapping (used by Slice 1).
 * Shipment status mapping will be added in Slice 2. */
export function getSalesOrderStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("pending")) return "amber";
  if (s.includes("active") || s.includes("in progress")) return "blue";
  if (s.includes("overdue")) return "rose";
  if (s.includes("completed") || s.includes("delivered")) return "emerald";
  if (s.includes("cancelled") || s.includes("canceled")) return "neutral";
  return "neutral";
}

/* Shipment status → tone mapping (Slice 2).
 * Draft → neutral, Ready to pick → purple, Picking In Progress → amber,
 * Ready to ship → blue, Shipped → emerald. Casing is normalized. */
export function getShipmentStatusTone(status: string): StatusTone {
  const s = status.toLowerCase().trim();
  if (s === "draft") return "neutral";
  if (s.includes("picking")) return "amber";
  if (s.includes("ready to pick")) return "purple";
  if (s.includes("ready to ship")) return "blue";
  if (s === "shipped" || s.includes("delivered")) return "emerald";
  if (s.includes("cancel")) return "rose";
  return "neutral";
}

/* Normalize Shipment status display label to Title Case. */
export function normalizeShipmentStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "draft") return "Draft";
  if (s.includes("picking")) return "Picking In Progress";
  if (s.includes("ready to pick")) return "Ready to Pick";
  if (s.includes("ready to ship")) return "Ready to Ship";
  if (s === "shipped") return "Shipped";
  return status;
}