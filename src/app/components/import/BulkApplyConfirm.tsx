import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowRight, Wand2 } from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { ENTITY_META } from "./importSpec";
import type { EntityGap } from "./importModel";

/**
 * "Apply this fix everywhere?"
 *
 * The module's search overlay is the right place to pick a customer, but
 * it knows nothing about this import, so it cannot offer the thing that
 * makes a legacy fix cheap: one misspelling usually appears on many rows,
 * and correcting it once should clear all of them.
 *
 * So the overlay picks, and this asks the one question it cannot. It only
 * appears when the value really does appear more than once, which keeps
 * the single-cell case a single click.
 *
 * Chrome is Partner Management's confirmation pattern, measurement for
 * measurement, as implemented in `components/ConfirmationModal` (blue
 * "Heads up" variant). It is not a call to that component only because
 * this question needs two things a string `message` cannot carry: the
 * from → to pills and the scope choice.
 */

/* The blue variant's tokens, copied from ConfirmationModal's VARIANT_TOKENS. */
const T = {
  glow: "#3B82F6",
  iconBg: "#DBEAFE",
  iconColor: "#1D4ED8",
  pillLabel: "Heads up",
  pillBg: "#EFF6FF",
  pillColor: "#1E40AF",
  gradient: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)",
  ctaBg: "var(--primary)",
} as const;

export function BulkApplyConfirm({
  gap,
  replacement,
  onApply,
  onCancel,
}: {
  gap: EntityGap;
  replacement: string;
  onApply: (scope: "all" | "one") => void;
  onCancel: () => void;
}) {
  const [applyToAll, setApplyToAll] = useState(true);
  const meta = ENTITY_META[gap.entity];
  const stacked = gap.rawValue.length + replacement.length > 34;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onApply(applyToAll ? "all" : "one");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyToAll, onApply, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12460, backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col overflow-hidden bg-white"
        style={{
          width: "min(400px, calc(100vw - 32px))",
          borderRadius: "16px",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tinted gradient strip with glow + icon + pill */}
        <div className="relative flex flex-col items-center" style={{ padding: "40px 0 24px", background: T.gradient }}>
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: 9999, filter: "blur(50px)", opacity: 0.25, backgroundColor: T.glow }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: T.iconBg }}
          >
            <Wand2 style={{ width: 32, height: 32, color: T.iconColor }} />
          </div>
          <span
            className="mt-4"
            style={{ padding: "4px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600, backgroundColor: T.pillBg, color: T.pillColor }}
          >
            {T.pillLabel}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center" style={{ padding: "0 32px 32px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>
            Apply this fix everywhere?
          </h3>

          {/* Long names wrap badly side by side in Partners' 400px shell,
              so they stack with a downward arrow instead. */}
          <div
            className={`flex items-center justify-center gap-2 ${stacked ? "flex-col" : ""}`}
            style={{ marginTop: 14 }}
          >
            <span
              className="inline-flex items-center h-7 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700"
              style={{ fontSize: "12.5px", fontWeight: 600 }}
            >
              {gap.rawValue}
            </span>
            {stacked
              ? <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
              : <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
            <span
              className="inline-flex items-center h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
              style={{ fontSize: "12.5px", fontWeight: 600 }}
            >
              {replacement}
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.65, maxWidth: 300 }}>
            That {meta.noun} appears in{" "}
            <span style={{ fontWeight: 600, color: "#1E293B" }}>{gap.occurrences}</span> cells across{" "}
            <span style={{ fontWeight: 600, color: "#1E293B" }}>{gap.recordIds.length}</span> records.
          </p>

          <label
            className="w-full flex items-start gap-2.5 cursor-pointer text-left border border-border hover:bg-slate-50 transition-colors"
            style={{ marginTop: 18, padding: "12px 14px", borderRadius: 12 }}
          >
            {/* The shared Checkbox primitive, the one Partners' pickers
                use, rather than a bare native input. */}
            <span className="mt-0.5">
              <Checkbox checked={applyToAll} onCheckedChange={(v) => setApplyToAll(v === true)} />
            </span>
            <span style={{ fontSize: "12.5px", color: "var(--foreground-soft)", lineHeight: 1.55 }}>
              Fix all {gap.occurrences} cells
              <span className="text-slate-400"> · leave this off to fix only the one you opened</span>
            </span>
          </label>

          <div className="w-full flex flex-col" style={{ marginTop: 24, gap: 10 }}>
            <button
              autoFocus
              onClick={() => onApply(applyToAll ? "all" : "one")}
              className="w-full cursor-pointer transition-colors hover:opacity-90"
              style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600, backgroundColor: T.ctaBg, color: "#FFFFFF", border: 0 }}
            >
              {applyToAll ? `Replace ${gap.occurrences} cells` : "Replace this cell"}
            </button>
            <button
              onClick={onCancel}
              className="w-full cursor-pointer transition-colors"
              style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155", border: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
