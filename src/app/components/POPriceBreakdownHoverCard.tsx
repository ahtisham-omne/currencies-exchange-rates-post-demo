/* ═══════════════════════════════════════════════════════════════════════════
 *  POPriceBreakdownHoverCard
 *  ─────────────────────────
 *  Ported from Sales-Order-V5 (`so/PriceBreakdownHoverCard.tsx`); the same
 *  hover pattern the SO line grid uses on its TOTAL column. Wraps any
 *  child (a line total number, typically) in a dotted-underline trigger;
 *  on hover-intent (240 ms) shows a portaled overlay listing:
 *    · Subtotal row (qty × PPU)
 *    · One row per active pricing rule that touches this line
 *    · Green Total row (subtotal ± rule impacts)
 *
 *  Adaptation from SO:
 *    · Takes a precomputed `LinePricingBreakdown` (already produced by
 *      `computeLineBreakdowns`) so the card doesn't reach into hook
 *      state itself. Callers pass the entry for the current line.
 *    · One-time item-level discounts/premiums come in as a precomputed
 *      `LineAdjustmentBreakdown` (from `poOrderPricing`) and render as
 *      SO's violet "ONE-TIME" rows.
 *    · Renders nothing (just passes children through with a subtle
 *      dotted underline) when the line has no active rules or
 *      one-times — the hover would be empty otherwise.
 * ═══════════════════════════════════════════════════════════════════════════ */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import type { LinePricingBreakdown } from "./poPricingRulesData";
import { adjustmentDisplayLabel, type LineAdjustmentBreakdown } from "./poOrderPricing";

type Placement = "top" | "bottom";

export interface POPriceBreakdownHoverCardProps {
  line: { id: string; itemCode: string; orderedQty: number; unitPrice: number };
  /** Precomputed breakdown for this specific line. When null / empty
   *  ruleImpacts, the card renders as an inert dotted-underline wrapper
   *  around `children` (no hover overlay). */
  breakdown: LinePricingBreakdown | null;
  /** Item-level one-time discounts/premiums on this line. */
  adjustment?: LineAdjustmentBreakdown | null;
  formatCurrency: (n: number) => string;
  children: ReactNode;
}

export function POPriceBreakdownHoverCard({
  line,
  breakdown,
  adjustment,
  formatCurrency,
  children,
}: POPriceBreakdownHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseSubtotal = breakdown?.baseSubtotal ?? line.orderedQty * line.unitPrice;
  const ruleImpacts = breakdown?.ruleImpacts ?? [];
  const adjRows = (adjustment?.impacts ?? []).filter((r) => r.dollars !== 0);
  const hasOverlay = ruleImpacts.length > 0 || adjRows.length > 0;
  const lineTotal = (breakdown?.total ?? baseSubtotal) + (adjustment?.net ?? 0);

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const rowCount = 1 + ruleImpacts.length + adjRows.length + 1;
    const estimatedH = 56 + rowCount * 22 + 36;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: Placement = spaceBelow > estimatedH + 12 ? "bottom" : "top";
    setPos({
      x: rect.right,
      y: placement === "bottom" ? rect.bottom + 6 : rect.top - 6,
      placement,
    });
  }, [ruleImpacts.length, adjRows.length]);

  const handleEnter = useCallback(() => {
    if (!hasOverlay) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    openTimer.current = setTimeout(() => {
      calcPos();
      setOpen(true);
    }, 240);
  }, [calcPos, hasOverlay]);

  const handleLeave = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);

  const handleCardEnter = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const handleCardLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        /* Dotted bottom border signals "hover for breakdown" on every
           line. Stronger tint when at least one rule is active. */
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          cursor: hasOverlay ? "help" : "default",
          borderBottom: hasOverlay
            ? "1.5px dotted rgba(15, 23, 42, 0.45)"
            : "1.5px dotted transparent",
          paddingBottom: 1,
          lineHeight: 1.2,
        }}
      >
        {children}
      </span>

      {open &&
        pos &&
        createPortal(
          <div
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.placement === "bottom" ? pos.y : undefined,
              bottom: pos.placement === "top" ? window.innerHeight - pos.y : undefined,
              transform: "translateX(-100%)",
              zIndex: 99999,
              fontFamily: "Inter, system-ui, sans-serif",
              animation: "poPbhcIn 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes poPbhcIn {
                from { opacity: 0; transform: translateX(-100%) translateY(${pos.placement === "bottom" ? "-4px" : "4px"}) scale(0.97); }
                to   { opacity: 1; transform: translateX(-100%) translateY(0) scale(1); }
              }
            `}</style>

            <div
              style={{
                width: 272,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              {/* Header — mirrors SO exactly. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px 8px",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <Info style={{ width: 13, height: 13, color: "#9CA3AF", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#1F2937",
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  Price Breakdown
                </span>
              </div>

              {/* Body rows + highlighted Total row (same pattern as SO). */}
              <div style={{ padding: "6px 0" }}>
                <BreakdownRow
                  label="Subtotal"
                  sub={`${line.orderedQty} × ${formatCurrency(line.unitPrice)}`}
                  value={formatCurrency(baseSubtotal)}
                  bold
                />

                {ruleImpacts.length > 0 && (
                  <>
                    <Divider />
                    {ruleImpacts.map((r) => (
                      <BreakdownRow
                        key={r.ruleId}
                        label={r.ruleName}
                        kind="Pricing Rule"
                        kindColor="#1B6EF3"
                        kindBg="#EFF6FF"
                        kindBorder="#BFDBFE"
                        value={`${r.type === "discount" ? "−" : "+"}${formatCurrency(r.amount)}`}
                        valueColor={r.type === "discount" ? "#059669" : "#B45309"}
                        indent
                      />
                    ))}
                  </>
                )}

                {adjRows.length > 0 && (
                  <>
                    <Divider />
                    {adjRows.map((r) => (
                      <BreakdownRow
                        key={r.adjustmentId}
                        label={adjustmentDisplayLabel(r)}
                        kind="One-Time"
                        kindColor="#7C3AED"
                        kindBg="#F5F3FF"
                        kindBorder="#DDD6FE"
                        value={`${r.type === "discount" ? "−" : "+"}${formatCurrency(r.dollars)}`}
                        valueColor={r.type === "discount" ? "#059669" : "#B45309"}
                        indent
                      />
                    ))}
                  </>
                )}

                <Divider />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 14px",
                    backgroundColor: "#F0FDF4",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1F2937",
                      lineHeight: 1.4,
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#059669",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.4,
                    }}
                  >
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function BreakdownRow({
  label,
  sub,
  value,
  valueColor,
  bold,
  indent,
  kind,
  kindColor,
  kindBg,
  kindBorder,
}: {
  label: string;
  sub?: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  indent?: boolean;
  kind?: string;
  kindColor?: string;
  kindBg?: string;
  kindBorder?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `3px 14px 3px ${indent ? 26 : 14}px`,
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: bold ? 600 : 400,
              color: indent ? "#4B5563" : "#374151",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {label}
          </span>
          {kind && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: kindColor ?? "#6B7280",
                backgroundColor: kindBg ?? "#F3F4F6",
                border: `1px solid ${kindBorder ?? "#E5E7EB"}`,
                padding: "1px 5px",
                borderRadius: 3,
                lineHeight: 1,
                letterSpacing: 0.2,
                textTransform: "uppercase",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {kind}
            </span>
          )}
        </div>
        {sub && (
          <span
            style={{
              fontSize: 10,
              color: "#9CA3AF",
              lineHeight: 1.3,
              marginTop: 1,
            }}
          >
            {sub}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: bold ? 600 : 500,
          color: valueColor ?? "#1F2937",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 14px" }} />;
}
