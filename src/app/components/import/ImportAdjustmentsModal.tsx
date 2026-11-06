import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DollarSign, Info, Maximize2, Minimize2, Package, Pencil, Plus, Trash2, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { AdjustmentFormModal, type AdjustmentFormData } from "@/app/components/shared/AdjustmentFormModal";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
import { ITEM_BY_CODE } from "./importCatalog";
/* The word this module's own adjustments modal uses for the
   record-wide scope ("Order-Level", not "Sales Order-Level"). */
const SCOPE_LABEL = "Quote";
import {
  adjustmentImpact, netImpact, parseAdjustmentList, serializeAdjustmentList, type ParsedAdjustment,
} from "./importAdjustments";
import type { ImportRecord } from "./importModel";

/**
 * One-time adjustments on an import row, scoped to the cell you opened.
 *
 * This is the module's `ManageAdjustmentsModal`, forked for the importer and
 * cut down to one scope. The detail page's version shows a whole quote at
 * once, quote-level and every line's item-level side by side, because that
 * is the question someone asks on a finished record. In a review sheet the
 * question is narrower: you clicked one cell, and that cell holds one list.
 * Showing the record's other lines there invites edits to rows you were not
 * looking at, and the sheet has no way to show which cell they landed in.
 *
 * So: open it from the record column and you get that column's list. Open
 * it from a line and you get that line's list, under that line's own
 * identity. Chrome, spacing and semantics are the module's, and the add and
 * edit form IS the module's, unforked.
 */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export type AdjustmentTarget = { kind: "record" } | { kind: "line"; lineId: string };

export function ImportAdjustmentsModal({
  record,
  target,
  onCommit,
  onClose,
}: {
  record: ImportRecord;
  target: AdjustmentTarget;
  /** The cell's new value, in the template's own notation. */
  onCommit: (value: string) => void;
  onClose: () => void;
}) {
  const isRecordScope = target.kind === "record";
  const lineIndex = isRecordScope ? -1 : record.lines.findIndex((l) => l.id === target.lineId);
  const line = lineIndex >= 0 ? record.lines[lineIndex] : null;

  /* The base a percentage resolves against: the record's line subtotal for
     record scope, this line's own subtotal for a line. */
  const { base, lineLabel, lineDescription } = useMemo(() => {
    const subtotalOf = (l: (typeof record.lines)[number]) =>
      (parseFloat((l.values.lineQuantity ?? "").trim()) || 0) * (parseFloat((l.values.linePricePerUnit ?? "").trim()) || 0);
    if (isRecordScope) {
      return { base: record.lines.reduce((s, l) => s + subtotalOf(l), 0), lineLabel: "", lineDescription: "" };
    }
    const code = (line?.values.lineItem ?? "").trim();
    const row = ITEM_BY_CODE[code];
    return {
      base: line ? subtotalOf(line) : 0,
      /* Position in the record, not the source row id: the sheet numbers
         its lines 1..n and so does this. */
      lineLabel: `${String(lineIndex + 1).padStart(3, "0")} · ${code || "No item"}`,
      lineDescription: (line?.values.lineDescription ?? "").trim() || row?.description || row?.name || "",
    };
  }, [isRecordScope, line, lineIndex, record]);

  const cellKey = isRecordScope ? "quoteLevelDiscountPremium" : "lineDiscountPremium";
  const initial = isRecordScope
    ? parseAdjustmentList(record.values[cellKey])
    : parseAdjustmentList(line?.values[cellKey]);

  const [list, setList] = useState<ParsedAdjustment[]>(initial);
  const [fullView, setFullView] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAt, setEditingAt] = useState<number | null>(null);

  /* Write back on every change rather than behind a Save button: the module
     applies an adjustment the moment it is added, and a second commit step
     here would let the sheet and this modal disagree. */
  const commit = (next: ParsedAdjustment[]) => {
    setList(next);
    onCommit(serializeAdjustmentList(next));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      /* The add/edit form owns Escape while it is open. */
      if (showAdd || editingAt !== null) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showAdd, editingAt]);

  const net = netImpact(list, base);
  const scopeWord = isRecordScope ? `${SCOPE_LABEL}-level` : "This line";
  const addLabel = isRecordScope ? `Add ${SCOPE_LABEL}-Level Adjustment` : "Add Item-Level Adjustment";

  const toForm = (a: ParsedAdjustment): AdjustmentFormData => ({
    label: a.label, type: a.type, amountType: a.amountType, amount: a.amount,
    scope: isRecordScope ? "quote" : "item",
  });
  const fromForm = (d: AdjustmentFormData): ParsedAdjustment => ({
    label: d.label.trim() || (d.type === "discount" ? "Discount" : "Premium"),
    type: d.type, amountType: d.amountType, amount: d.amount,
  });

  /* One entry, so the form's applied-to table has exactly the line you
     opened and cannot spray the adjustment across the record. */
  const formLineItems = !isRecordScope && line
    ? [{
        id: line.id,
        code: (line.values.lineItem ?? "").trim(),
        description: lineDescription,
        subtotal: base,
        qty: parseFloat((line.values.lineQuantity ?? "").trim()) || 0,
      }]
    : undefined;

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 12600, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="One-Time Discounts and Premiums"
          className={`relative bg-white flex flex-col overflow-hidden border border-border ${fullView ? "w-screen h-screen max-h-screen" : "w-[calc(100%-2rem)] sm:w-[640px] max-h-[88vh]"}`}
          style={{
            borderRadius: fullView ? 0 : 16,
            boxShadow: fullView ? "none" : "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
            transition: "width 220ms cubic-bezier(0.4, 0, 0.2, 1), max-height 220ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 border-b border-border shrink-0 bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
              >
                <DollarSign className="w-4 h-4" style={{ color: "#1B6EF3" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-[14px] text-foreground truncate" style={{ fontWeight: 600 }}>
                    One-Time Discounts/Premiums
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                    style={{ fontWeight: 600, color: "#475569", backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
                  >
                    {list.length}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                  {isRecordScope
                    ? `${SCOPE_LABEL.toLowerCase()}-level on ${(record.values.quoteNo ?? "").trim() || "this row"}`
                    : `line ${lineLabel}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setFullView((v) => !v)}
                aria-label={fullView ? "Exit full view" : "Enter full view"}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {fullView ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-white">
            {/* Section heading */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                {isRecordScope ? <DollarSign className="w-3 h-3 text-primary" /> : <Package className="w-3 h-3 text-primary" />}
              </div>
              <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                {isRecordScope ? `${SCOPE_LABEL}-level` : "Item-level"}
              </span>
              <span
                className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border"
                style={{ fontWeight: 600, color: "#475569", backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                {list.length}
              </span>
            </div>

            <div className="flex items-start gap-2 mb-3 rounded-lg border border-[#DBEAFE] bg-[#F0F7FF] px-3 py-2">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-[1px]" />
              <p className="text-[12px] leading-relaxed text-slate-600" style={{ margin: 0 }}>
                {isRecordScope
                  ? `Applied to the entire ${SCOPE_LABEL.toLowerCase()} total. Use for overall discounts or fees.`
                  : "Applied to this line item only. Use for delivery fees, setup charges, or item-specific discounts."}
              </p>
            </div>

            {/* Line identity, so it is obvious which cell is being edited */}
            {!isRecordScope && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 border border-border bg-slate-50" style={{ borderRadius: 10 }}>
                <div className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center bg-slate-100">
                  <Package className="w-3 h-3 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10.5px] text-slate-500 tabular-nums leading-tight" style={{ fontWeight: 600 }}>
                    #{lineLabel}
                  </div>
                  <div className="text-[12px] text-foreground truncate leading-snug">{lineDescription || "No description"}</div>
                </div>
                <div className="text-[11.5px] text-slate-500 tabular-nums shrink-0">{fmtCurrency(base)}</div>
              </div>
            )}

            {list.length === 0 ? (
              <div className="flex items-center justify-center px-6 py-8 mb-2">
                <EmptyPlaceholder
                  icon={DollarSign}
                  title={isRecordScope ? `No ${SCOPE_LABEL.toLowerCase()}-level adjustments yet` : "No adjustments on this line yet"}
                  description={
                    isRecordScope
                      ? `Add a one-time discount or premium that applies to this entire ${SCOPE_LABEL.toLowerCase()}.`
                      : "Add a one-time discount or premium that applies to this line item."
                  }
                  actionLabel={addLabel}
                  onAction={() => setShowAdd(true)}
                  compact
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((adj, i) => (
                  <AdjustmentRow
                    key={`${adj.label}-${i}`}
                    adjustment={adj}
                    dollarImpact={adjustmentImpact(adj, base)}
                    onEdit={() => setEditingAt(i)}
                    onDelete={() => commit(list.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}

            {list.length > 0 && (
              <button
                onClick={() => setShowAdd(true)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  width: "100%", padding: "9px 0", marginTop: "8px",
                  borderRadius: "6px", cursor: "pointer",
                  borderWidth: "1.5px", borderStyle: "dashed", borderColor: "var(--accent)",
                  backgroundColor: "var(--background)",
                  fontSize: "12px", fontWeight: 500, color: "var(--primary)", lineHeight: "1", transition: "all 150ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.borderColor = "rgba(10, 119, 255, 0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--background)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              >
                <Plus style={{ width: "13px", height: "13px" }} />
                {addLabel}
              </button>
            )}
          </div>

          {/* ── Footer: one scope, so one line plus the net ── */}
          <div className="px-5 py-3 border-t border-border bg-white shrink-0">
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span className="text-[11px] text-slate-500">{scopeWord} subtotal</span>
              <span className="text-[12px] tabular-nums text-slate-600" style={{ fontWeight: 500 }}>{fmtCurrency(base)}</span>
            </div>
            <div style={{ height: 1, backgroundColor: "var(--border)", marginBottom: 8 }} />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Net Adjustment</span>
              <span
                className="text-[15px] tabular-nums"
                style={{ fontWeight: 700, color: net > 0 ? "#6D28D9" : net < 0 ? "#047857" : "#0F172A" }}
              >
                {net >= 0 ? "+" : ""}{fmtCurrency(net)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add / edit: the module's own form, unforked ── */}
      {showAdd && (
        <AdjustmentFormModal
          mode="add"
          scope={isRecordScope ? "quote" : "item"}
          lineItems={formLineItems}
          onSave={(d) => { commit([...list, fromForm(d)]); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {editingAt !== null && list[editingAt] && (
        <AdjustmentFormModal
          mode="edit"
          scope={isRecordScope ? "quote" : "item"}
          initial={toForm(list[editingAt])}
          lineItems={formLineItems}
          onSave={(d) => {
            commit(list.map((a, j) => (j === editingAt ? fromForm(d) : a)));
            setEditingAt(null);
          }}
          onCancel={() => setEditingAt(null)}
        />
      )}
    </>,
    document.body,
  );
}

/* Row chrome copied from the module's `AdjustmentRow`: emerald pill for a
   discount, violet for a premium, and a percentage showing the dollars it
   actually resolves to rather than a bare number. */
function AdjustmentRow({
  adjustment, dollarImpact, onEdit, onDelete,
}: {
  adjustment: ParsedAdjustment;
  dollarImpact: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAdd = adjustment.type === "premium";
  const isPct = adjustment.amountType === "%";
  const sign = isAdd ? "+" : "-";
  const pill = isAdd
    ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE", icon: TrendingUp }
    : { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5", icon: TrendingDown };
  const PillIcon = pill.icon;

  return (
    <div
      className="group flex items-center justify-between gap-3 bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] hover:bg-slate-50 transition-colors px-3 py-2.5"
      style={{ borderRadius: 10 }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span
          className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10.5px] border shrink-0"
          style={{ color: pill.text, backgroundColor: pill.bg, borderColor: pill.border, fontWeight: 600 }}
        >
          <PillIcon style={{ width: 11, height: 11 }} />
          {isAdd ? "Premium" : "Discount"}
        </span>
        <span className="text-[13px] text-foreground truncate">{adjustment.label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className="text-[13px] tabular-nums" style={{ fontWeight: 600, color: pill.text }}>
            {sign}{isPct ? `${adjustment.amount}%` : fmtCurrency(adjustment.amount)}
          </div>
          {isPct && (
            <div className="text-[10.5px] tabular-nums text-slate-500">
              {sign}{fmtCurrency(Math.abs(dollarImpact))}
            </div>
          )}
        </div>
        <button
          onClick={onEdit}
          aria-label="Edit adjustment"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-accent transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Remove adjustment"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
