// SOLineGrid.tsx - Line Items table with bulk actions
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Plus, Package, Ban, ChevronDown, ChevronUp, Target, Layers, Check, Copy, X, Trash2, DollarSign, FileText, RefreshCw } from "lucide-react";
import { ItemDescription } from "./ItemDescription";
import { ItemTypeBadge, DuplicateBadge } from "./StatusBadge";
import { ProgressFractionCell } from "./ProgressFractionCell";
import { ConfirmationModal } from "./ConfirmationModal";
import type { SalesOrder, SOLine } from "./types";
import { Button } from "./ui/Button";

interface SOLineGridProps {
  so: SalesOrder;
  onAddLine: () => void;
  onAllocateLine?: (line: SOLine) => void;
  onAllocateAll?: () => void;
  onDeleteLine: (lineId: string) => void;
  onCancelLines?: (lineIds: string[]) => void;
  onConfigureLine?: (line: SOLine) => void;
  onUpdateLine?: (lineId: string, updates: Partial<SOLine>) => void;
  onDuplicateLine?: (line: SOLine) => void;
}

const UOM_OPTIONS = [
  { code: "EA", label: "Each", isDefault: true },
  { code: "BOX", label: "Box (12 units)" },
  { code: "CTN", label: "Carton (24 units)" },
  { code: "PLT", label: "Pallet (480 units)" },
  { code: "PCS", label: "Pieces" },
  { code: "SET", label: "Set" },
  { code: "KG", label: "Kilogram" },
  { code: "LB", label: "Pound" },
];

const DOLLAR = "\u0024";

function formatCompactValue(value: number) {
  if (Math.abs(value) < 1000) return value.toLocaleString();
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value).toLowerCase();
}

function formatCurrencyValue(value: number, compact = false) {
  if (!compact || Math.abs(value) < 100000) {
    return `${DOLLAR}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${DOLLAR}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value).toLowerCase()}`;
}
/* ═══ Price Change Confirmation Modal ═══ */
function PriceChangeModal({ newPrice, onThisOrderOnly, onUpdateItemMaster, onCancel }: {
  newPrice: number; onThisOrderOnly: () => void; onUpdateItemMaster: () => void; onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div
        className="bg-card"
        style={{ borderRadius: "var(--radius-xl)", width: 420, padding: 24, boxShadow: "var(--elevation-3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--primary)" }}>
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        {/* Title */}
        <h3 className="text-foreground mb-1.5" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>Apply Price Change</h3>
        {/* Message */}
        <p className="text-foreground/50 mb-5" style={{ fontSize: 13, lineHeight: 1.5 }}>
          You're changing the unit price to <strong className="text-foreground" style={{ fontWeight: 600 }}>{formatCurrencyValue(newPrice)}</strong>.
          <br />Should this change apply only to this order, or update the item master price for all future orders?
        </p>
        {/* Options */}
        <div className="flex flex-col gap-2.5 mb-4">
          <button
            onClick={onThisOrderOnly}
            className="w-full flex items-center gap-3 text-left transition-all"
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 3%, var(--card))"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--card)"; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)" }}>
              <FileText style={{ width: 15, height: 15, color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>This Order Only</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>Override price for this line item. Item master stays unchanged.</div>
            </div>
          </button>
          <button
            onClick={onUpdateItemMaster}
            className="w-full flex items-center gap-3 text-left transition-all"
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--chart-3)"; e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--chart-3) 3%, var(--card))"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--card)"; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--chart-3) 10%, transparent)" }}>
              <RefreshCw style={{ width: 15, height: 15, color: "var(--chart-3)" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Update Item Master</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--chart-3)", backgroundColor: "color-mix(in srgb, var(--chart-3) 10%, transparent)", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>GLOBAL</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>Set as the new default price for all future orders.</div>
            </div>
          </button>
        </div>
        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full text-foreground/50 hover:text-foreground transition-colors"
          style={{ height: 36, fontSize: 13, fontWeight: 500, backgroundColor: "transparent", border: "none", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ═══ PPU capsule — matches Quote module: $ + price in outlined capsule, unit label BELOW ═══ */
function PriceCapsule({ price, unit = "EA", cancelled, editable, onChangePrice }: { price: number; unit?: string; cancelled?: boolean; editable?: boolean; onChangePrice?: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(price));
  const [showPriceConfirm, setShowPriceConfirm] = useState(false);
  const [pendingPrice, setPendingPrice] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(String(price)); }, [price, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== price && onChangePrice) {
      setPendingPrice(parsed);
      setShowPriceConfirm(true);
    } else {
      setDraft(String(price));
    }
    setEditing(false);
  };
  const formatted = formatCurrencyValue(price, true);
  const isCan = !!cancelled;
  const uomLabel = UOM_OPTIONS.find(u => u.code === unit)?.label || unit;

  return (
    <div className={`${isCan ? "opacity-50" : ""}`} style={{ position: "relative", display: "inline-block", width: 110 }}>
      {editing ? (
        <div
          style={{
            display: "inline-flex", alignItems: "center", width: "100%", height: 30,
            padding: "0 8px", gap: 1, borderRadius: 6,
            border: "1px solid #3B82F6", backgroundColor: "#FFFFFF",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.10)",
          }}
        >
          <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1, flexShrink: 0 }}>$</span>
          <input ref={inputRef} type="text" inputMode="decimal" value={draft}
            onChange={e => { const v = e.target.value; if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') setDraft(v); }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(price)); setEditing(false); } }}
            className="bg-transparent text-foreground outline-none"
            style={{ width: 90, height: "100%", border: "none", fontSize: 13, fontWeight: 500, color: "#1F2937", padding: "0 2px" }} />
        </div>
      ) : (
        <button
          onClick={editable ? () => { setDraft(String(price)); setEditing(true); } : undefined}
          style={{
            display: "inline-flex", alignItems: "center", gap: 1,
            width: "100%", height: editable ? 30 : "auto",
            padding: editable ? "0 10px" : "0", borderRadius: 6,
            border: `1px solid ${editable ? "#D1D5DB" : "transparent"}`,
            backgroundColor: editable ? "#FFFFFF" : "transparent",
            cursor: editable ? "text" : "default", transition: "all 100ms",
          }}
          tabIndex={editable ? 0 : -1}
          title={formatCurrencyValue(price)}
        >
          <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1 }}>$</span>
          <span className={isCan ? "line-through" : ""} style={{ fontSize: 13, fontWeight: 500, color: "#1F2937", lineHeight: 1 }}>
            {price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </button>
      )}
      {/* Unit label below PPU like Quotes module */}
      <span style={{
        position: "absolute", top: "100%", left: 0, marginTop: 2,
        fontSize: 10, fontWeight: 400, color: "#9CA3AF", lineHeight: 1,
        userSelect: "none", whiteSpace: "nowrap",
      }}>
        {uomLabel}
      </span>

      {/* PPU Change Confirmation Modal */}
      {showPriceConfirm && pendingPrice !== null && (
        <PriceChangeModal
          newPrice={pendingPrice}
          onThisOrderOnly={() => { onChangePrice?.(pendingPrice); setShowPriceConfirm(false); setPendingPrice(null); }}
          onUpdateItemMaster={() => { onChangePrice?.(pendingPrice); setShowPriceConfirm(false); setPendingPrice(null); }}
          onCancel={() => { setShowPriceConfirm(false); setPendingPrice(null); setDraft(String(price)); }}
        />
      )}
    </div>
  );
}

/* ═══ QTY/UOM capsule — matches Quote module: qty | UOM in outlined capsule ═══ */
function QtyUomCapsule({ qty, unit = "EA", cancelled, editable, onChangeQty, onChangeUnit }: {
  qty: number; unit?: string; cancelled?: boolean; editable?: boolean;
  onChangeQty?: (v: number) => void; onChangeUnit?: (u: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const [unitOpen, setUnitOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!editing) setDraft(String(qty)); }, [qty, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  useEffect(() => {
    if (!unitOpen) return;
    const handler = (e: MouseEvent) => { if (capsuleRef.current && !capsuleRef.current.contains(e.target as Node)) setUnitOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [unitOpen]);
  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== qty && onChangeQty) onChangeQty(parsed);
    else setDraft(String(qty));
    setEditing(false);
  };
  const isCan = !!cancelled;
  const showEditAffordance = !!editable;

  return (
    <div className="relative" ref={capsuleRef}>
      <div
        style={{
          position: "relative", display: "inline-flex", alignItems: "stretch",
          height: 30, borderRadius: 6, overflow: "visible",
          border: `1px solid ${editing ? "#3B82F6" : unitOpen ? "#BFDBFE" : showEditAffordance ? "#D1D5DB" : "transparent"}`,
          backgroundColor: editing || unitOpen || showEditAffordance ? "#FFFFFF" : "transparent",
          transition: "border-color 100ms, background-color 100ms",
          boxShadow: editing ? "0 0 0 2px rgba(59,130,246,0.10)" : "none",
        }}
      >
        {/* LEFT — Quantity */}
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
            <input ref={inputRef} type="number" min={0} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(qty)); setEditing(false); } }}
              style={{ width: 64, height: "100%", border: "none", textAlign: "center", outline: "none", fontSize: 13, fontWeight: 600, color: "#1F2937", backgroundColor: "transparent", padding: "0 2px" }} />
          </div>
        ) : (
          <button
            onClick={editable ? () => { setDraft(String(qty)); setEditing(true); } : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 10px", minWidth: 40, border: "none", backgroundColor: "transparent",
              cursor: showEditAffordance ? "text" : "default",
            }}
            tabIndex={editable ? 0 : -1}
            title={qty.toLocaleString()}
          >
            <span className={isCan ? "line-through" : ""} style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1, whiteSpace: "nowrap" }}>
              {formatCompactValue(qty)}
            </span>
          </button>
        )}

        {/* DIVIDER */}
        {editing || unitOpen || showEditAffordance ? (
          <div style={{ width: 1, backgroundColor: "#E5E7EB", flexShrink: 0, alignSelf: "stretch" }} />
        ) : (
          <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: "30px", flexShrink: 0, userSelect: "none", padding: "0 2px" }}>/</span>
        )}

        {/* RIGHT — UoM */}
        <button
          onClick={editable ? (e) => { e.stopPropagation(); setUnitOpen(!unitOpen); } : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "0 8px",
            minWidth: 36, border: "none",
            backgroundColor: unitOpen ? "#F9FAFB" : "transparent",
            cursor: showEditAffordance ? "pointer" : "default",
            transition: "background-color 100ms", borderRadius: "0 5px 5px 0",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { if (showEditAffordance && !unitOpen) e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
          onMouseLeave={e => { if (!unitOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
          tabIndex={editable ? 0 : -1}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", lineHeight: 1 }}>{unit}</span>
          {showEditAffordance && <ChevronDown style={{ width: 11, height: 11, color: "#9CA3AF", flexShrink: 0 }} />}
        </button>
      </div>

      {/* UoM dropdown */}
      {unitOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-card border border-border rounded-lg" style={{ zIndex: "var(--z-dropdown)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 200, overflow: "hidden" }}>
          {UOM_OPTIONS.map(opt => {
            const isActive = opt.code === unit;
            return (
              <button key={opt.code} onClick={() => { if (onChangeUnit) onChangeUnit(opt.code); setUnitOpen(false); }}
                className="w-full flex items-center justify-between transition-colors"
                style={{ padding: "10px 12px", border: "none", backgroundColor: isActive ? "#F9FAFB" : "transparent", cursor: "pointer", borderBottom: "1px solid #F3F4F6" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? "#F9FAFB" : "transparent"; }}
              >
                <div className="flex flex-col items-start" style={{ gap: 2 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: "#1F2937", lineHeight: 1 }}>{opt.code}</span>
                    {opt.isDefault && <span style={{ fontSize: 9, fontWeight: 600, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "2px 4px", borderRadius: 3, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.3px" }}>DEFAULT</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>{opt.label}</span>
                </div>
                {isActive && <div className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0"><Check className="w-2 h-2 text-primary-foreground" strokeWidth={2.5} /></div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineRow({ line, idx, isEditable, isDraft, expandedRows, selectedLineIds, duplicateOfMap, onDeleteLine, onCancelLines, onConfigureLine, onUpdateLine, toggleExpand, toggleSelectLine }: {
  line: SOLine; idx: number; isEditable: boolean; isDraft: boolean; expandedRows: Set<string>; selectedLineIds: Set<string>; duplicateOfMap: Map<number, number>;
  onDeleteLine?: (id: string) => void; onCancelLines?: (ids: string[]) => void; onConfigureLine?: (l: SOLine) => void; onUpdateLine?: (id: string, u: Partial<SOLine>) => void;
  toggleExpand: (id: string) => void; toggleSelectLine: (id: string) => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isExp = expandedRows.has(line.id);
  const isCan = line.cancelled;
  const isSel = selectedLineIds.has(line.id);
  const canSel = !isCan && line.shippedQty < line.orderedQty;
  const toShip = Math.max(0, line.orderedQty - line.shippedQty);
  const dash = <span className="text-foreground/15" style={{ fontSize: "var(--text-caption)" }}>{"\u2014"}</span>;

  const showEditAffordance = isEditable && !isCan;

  return (
    <>
    <tr className={`border-b border-border/40 transition-colors group cursor-pointer ${isCan ? "bg-secondary/50 opacity-60" : isSel ? "bg-destructive/5" : "hover:bg-secondary/30"}`}
      onClick={e => { const t = e.target as HTMLElement; if (!t.closest('input, button, select, a, [role="button"]') && onConfigureLine) onConfigureLine(line); }}>
      <td style={{ padding: "10px 8px 10px var(--space-inline-gap)", verticalAlign: "top" }}>
        {onCancelLines && canSel ? <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={isSel} onChange={() => toggleSelectLine(line.id)} />
          : <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" disabled checked={isCan} readOnly />}
      </td>
      <td className="text-foreground/30 tabular-nums" style={{ padding: "10px 0 10px 0", fontSize: 11, fontWeight: 400, verticalAlign: "top", textAlign: "center", width: 28 }}>{idx + 1}</td>
      <td style={{ padding: "8px var(--space-inline-gap)", verticalAlign: "top" }}>
        <div className="flex items-start" style={{ gap: "10px" }}>
          {/* Image placeholder with visible background — matches Quote module */}
          <div style={{
            width: 72, height: 72, borderRadius: 8,
            backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Package style={{ width: 24, height: 24, color: "#D1D5DB" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap" style={{ gap: "6px", marginBottom: 4 }}>
              <span className={`text-foreground ${isCan ? "line-through" : ""}`} style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>{line.itemCode}</span>
              <ItemTypeBadge type={line.itemType} />
              {duplicateOfMap.has(idx) && <DuplicateBadge ofIndex={duplicateOfMap.get(idx)!} />}
              {isCan && <span className="inline-flex items-center rounded bg-destructive/8 text-destructive" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "1px 6px" }}>CANCELLED</span>}
            </div>
            <ItemDescription text={line.itemName} maxLines={2} className="mt-0.5" />
            {isCan && line.cancelledReason && <div className="text-destructive" style={{ fontSize: "var(--text-caption)", marginTop: "2px" }}>{line.cancelledReason}</div>}
          </div>
        </div>
      </td>
      {/* QTY/UOM capsule first */}
      <td style={{ padding: "10px 12px", verticalAlign: "top" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-start">
          <QtyUomCapsule qty={line.orderedQty} unit="EA" cancelled={isCan} editable={showEditAffordance && !!onUpdateLine} onChangeQty={v => onUpdateLine?.(line.id, { orderedQty: v })} />
        </div>
      </td>
      {/* PPU column after QTY */}
      <td style={{ padding: "10px 12px", verticalAlign: "top" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-start">
          <PriceCapsule price={line.unitPrice} unit="EA" cancelled={isCan} editable={showEditAffordance && !!onUpdateLine} onChangePrice={v => onUpdateLine?.(line.id, { unitPrice: v })} />
        </div>
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "right" }}>
        {!isCan ? (
          <span className="text-foreground tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }} title={formatCurrencyValue(line.orderedQty * line.unitPrice)}>
            {formatCurrencyValue(line.orderedQty * line.unitPrice, true)}
          </span>
        ) : dash}
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "right" }}>{!isCan ? <ProgressFractionCell value={line.allocatedQty} total={toShip} /> : dash}</td>
      <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "right" }}>{!isCan ? <ProgressFractionCell value={line.shippedQty} total={line.orderedQty} altPartialColor /> : dash}</td>
      <td style={{ padding: "10px 4px", verticalAlign: "top", textAlign: "center" }}>
        {!isCan && canSel && (() => {
          if (isDraft && onDeleteLine) {
            // Draft: delete with confirmation
            return (
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(true); }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6, border: "1px solid transparent",
                  backgroundColor: "transparent", cursor: "pointer", transition: "all 120ms",
                  padding: 0, color: "#C4C9D1",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#C4C9D1"; }}
                title="Delete line item"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            );
          }
          if (!isDraft && onCancelLines) {
            // Post-draft: cancel line
            return (
              <button
                onClick={e => { e.stopPropagation(); onCancelLines([line.id]); }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6, border: "1px solid transparent",
                  backgroundColor: "transparent", cursor: "pointer", transition: "all 120ms",
                  padding: 0, color: "#C4C9D1",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#C4C9D1"; }}
                title="Cancel line"
              >
                <Ban style={{ width: 13, height: 13 }} />
              </button>
            );
          }
          return null;
        })()}
      </td>
    </tr>
    {/* Delete confirmation modal for draft */}
    {deleteConfirm && (
      <tr style={{ display: "none" }}>
        <td>
          <ConfirmationModal
            isOpen={deleteConfirm}
            title="Delete Line Item?"
            message={`Are you sure you want to delete "${line.itemCode}" from this order? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Keep"
            onConfirm={() => { onDeleteLine?.(line.id); setDeleteConfirm(false); }}
            onCancel={() => setDeleteConfirm(false)}
            variant="red"
            icon={<Trash2 className="w-6 h-6 text-white" />}
          />
        </td>
      </tr>
    )}
    </>
  );
}

export function SOLineGrid({ so, onAddLine, onAllocateLine, onAllocateAll, onDeleteLine, onCancelLines, onConfigureLine, onUpdateLine, onDuplicateLine }: SOLineGridProps) {
  const isEditable = !["Cancelled", "Shipped", "Archived"].includes(so.status);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [duplicateConfirmLine, setDuplicateConfirmLine] = useState<SOLine | null>(null);
  const toggleExpand = (id: string) => setExpandedRows(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectLine = (id: string) => setSelectedLineIds(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { const c = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty); setSelectedLineIds(selectedLineIds.size === c.length ? new Set() : new Set(c.map(l => l.id))); };
  const handleBulkCancel = () => { if (onCancelLines && selectedLineIds.size > 0) { onCancelLines(Array.from(selectedLineIds)); setSelectedLineIds(new Set()); } };
  const cancelledLines = so.lines.filter(l => l.cancelled);
  const activeLines = so.lines.filter(l => !l.cancelled);
  const fullyAllocCount = activeLines.filter(l => l.allocatedQty >= l.orderedQty).length;
  const partAllocCount = activeLines.filter(l => l.allocatedQty > 0 && l.allocatedQty < l.orderedQty).length;
  const isDraft = so.status === "Draft";
  const isPendingConfirm = so.status === "Pending Review";
  // QTY/UOM first, then PPU
  const cols = [{ label: "PRODUCT", align: "text-left", width: "" }, { label: "QTY / UOM", align: "text-left", width: "w-[120px]" }, { label: "PPU", align: "text-left", width: "w-[130px]" }, { label: "TOTAL", align: "text-right", width: "w-[120px]" }, { label: "ALLOCATED", align: "text-right", width: "w-[100px]" }, { label: "SHIPPED", align: "text-right", width: "w-[100px]" }];
  const firstMap = new Map<string, number>();
  const dupMap = new Map<number, number>();
  so.lines.forEach((l, i) => { if (firstMap.has(l.itemCode)) dupMap.set(i, firstMap.get(l.itemCode)!); else firstMap.set(l.itemCode, i + 1); });

  const handleDuplicateConfirm = () => {
    if (duplicateConfirmLine && onDuplicateLine) {
      onDuplicateLine(duplicateConfirmLine);
    }
    setDuplicateConfirmLine(null);
  };

  return (
    <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-1)" }}>
      <div className="flex items-center justify-between border-b border-border" style={{ padding: "10px var(--space-card-padding)" }}>
        <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
          <span className="text-foreground" style={{ fontSize: 14, fontWeight: 700 }}>Line Items</span>
          {selectedLineIds.size > 0 ? (
            <span className="text-primary" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{selectedLineIds.size} selected</span>
          ) : (
            <>
              <span className="text-foreground/35" style={{ fontSize: "var(--text-caption)" }}>{activeLines.length} active{cancelledLines.length > 0 ? `, ${cancelledLines.length} cancelled` : ""}</span>
              <div className="w-px h-3.5 bg-border" />
              <span className="text-foreground/35" style={{ fontSize: "var(--text-caption)" }}>Allocation{" "}<span className={fullyAllocCount === activeLines.length && activeLines.length > 0 ? "text-accent" : "text-primary"} style={{ fontWeight: "var(--font-weight-semibold)" }}>{fullyAllocCount}/{activeLines.length}</span></span>
              {partAllocCount > 0 && <span className="text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{partAllocCount} partial</span>}
            </>
          )}
        </div>
        <div className="flex items-center" style={{ gap: "8px" }}>
          {onCancelLines && selectedLineIds.size > 0 && <Button variant="ghost" size="sm" icon={<Ban className="w-3.5 h-3.5 text-destructive" />} onClick={handleBulkCancel} className="border border-destructive/30 text-destructive hover:bg-destructive/5">Cancel {selectedLineIds.size} line item{selectedLineIds.size !== 1 ? "s" : ""}</Button>}
          {onAllocateAll && <Button variant="secondary" size="sm" icon={<Layers className="w-3.5 h-3.5" />} onClick={onAllocateAll} className="border-primary/15 text-primary hover:bg-primary/5">Allocate Inventory</Button>}
          {isEditable && <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onAddLine}>Add Line Item</Button>}
        </div>
      </div>
      {isDraft && activeLines.length > 0 && <div className="flex items-center rounded-md" style={{ margin: "var(--space-card-padding) var(--space-card-padding) 0", padding: "var(--space-inline-gap) var(--space-card-padding)", gap: "var(--space-inline-gap)", backgroundColor: "rgba(10,119,255,0.08)" }}><Target className="w-3.5 h-3.5 text-primary shrink-0" /><span className="text-primary" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any }}>Allocate inventory to reserve stock for this order.</span></div>}
      {isPendingConfirm && activeLines.length > 0 && <div className="flex items-center rounded-md" style={{ margin: "var(--space-card-padding) var(--space-card-padding) 0", padding: "var(--space-inline-gap) var(--space-card-padding)", gap: "var(--space-inline-gap)", backgroundColor: "rgba(239,162,47,0.08)" }}><Package className="w-3.5 h-3.5 shrink-0" style={{ color: "#B45309" }} /><span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "#B45309" }}>Inventory allocated. Clear this Sales Order to enable shipping.</span></div>}
      <div style={{ paddingTop: "var(--space-inline-gap)", overflow: "visible" }}>
        <table className="w-full" style={{ overflow: "visible" }}>
          <thead><tr className="border-b border-border/60">
            <th style={{ width: "40px", padding: "8px var(--space-inline-gap)" }}>{onCancelLines ? <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={selectedLineIds.size > 0 && selectedLineIds.size === so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty).length} onChange={toggleSelectAll} /> : <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={false} readOnly />}</th>
            <th className="text-center text-foreground/30 tracking-wider uppercase" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "8px 0", letterSpacing: "0.06em", width: "28px" }}>#</th>
            {cols.map(c => <th key={c.label} className={`${c.align} ${c.width} text-foreground/30 tracking-wider uppercase`} style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "8px var(--space-inline-gap)", letterSpacing: "0.06em" }}>{c.label}</th>)}
            <th style={{ width: "52px", padding: "8px 8px" }} />
          </tr></thead>
          <tbody>
            {so.lines.map((line, i) => <LineRow key={line.id} line={line} idx={i} isEditable={isEditable} isDraft={isDraft} expandedRows={expandedRows} selectedLineIds={selectedLineIds} duplicateOfMap={dupMap} onDeleteLine={onDeleteLine} onCancelLines={onCancelLines} onConfigureLine={onConfigureLine} onUpdateLine={onUpdateLine} toggleExpand={toggleExpand} toggleSelectLine={toggleSelectLine} />)}
            {so.lines.length === 0 && <tr><td colSpan={8} className="text-center text-foreground/40" style={{ padding: "var(--space-section-gap) var(--space-card-padding)", fontSize: "var(--text-caption)" }}>No line items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Duplicate Line Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!duplicateConfirmLine}
        title="Duplicate Line Item?"
        message={`This will create a separate line entry for ${duplicateConfirmLine?.itemCode || ""}. Use this when items need different parameters (e.g. ship dates, warehouses). To increase quantity, edit the existing line instead.`}
        confirmText="Duplicate as Separate Line"
        cancelText="Cancel"
        onConfirm={handleDuplicateConfirm}
        onCancel={() => setDuplicateConfirmLine(null)}
        variant="blue"
        icon={<Copy className="w-6 h-6 text-white" />}
      />
    </div>
  );
}
