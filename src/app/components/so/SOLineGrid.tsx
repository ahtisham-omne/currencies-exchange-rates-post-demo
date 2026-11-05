// SOLineGrid.tsx - Line Items table with bulk actions
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Package, Ban, ChevronDown, ChevronUp, Target, Layers, Check, Copy, X, Trash2, DollarSign, FileText, RefreshCw, Warehouse as WarehouseIcon, Pencil } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ItemDescription } from "./ItemDescription";
import { ItemTypeBadge, DuplicateBadge } from "./StatusBadge";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { NumberPill } from "@/app/components/shared/NumberPill";
import { useItemQuickView } from "@/app/components/shared/ItemQuickView";
import { ProgressFractionCell } from "./ProgressFractionCell";
import { ConfirmationModal } from "./ConfirmationModal";
import { PriceScopeModal, type PriceScope } from "./PriceScopeModal";
import { PriceBreakdownHoverCard } from "./PriceBreakdownHoverCard";
import { toast } from "sonner";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
import type { SalesOrder, SOLine } from "./types";
import { Button } from "./ui/Button";
import { getLineItemImage } from "./lineItemImage";
import "./line-table-responsive.css";

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
  /* Inline PPU edits need to surface the version-bump prompt BEFORE the
     scope modal whenever the SO is in a post-Cleared state. The parent
     supplies this callback; PriceCapsule opens its scope modal only
     after the parent calls back. */
  onRequestPriceVersionConfirm?: (lineId: string, newPrice: number, applyCallback: () => void) => void;
  /* Unit changes scale PPU (and per-line + order totals) by the
     conversion factor between the old and new UoM. The parent handles
     the version-bump prompt + the actual store mutation; the grid just
     surfaces the user intent so SODetail can wire it into the same
     auto-version confirm flow the PPU edits already use. */
  onRequestUomChange?: (line: SOLine, newUom: string) => void;
  requiresVersionFirst?: boolean;
  /* Shared pricing/adjustments APIs so the TOTAL column can render
     the line's true total (subtotal + line-scoped rules + line-scoped
     adjustments) instead of the bare line subtotal. The Advanced
     Configurator already shows the same breakdown — they should
     reconcile. */
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
}

/* UoM definitions — `multiplier` is the number of base units (EA)
   contained in one of the given unit. Used to scale PPU when the user
   switches a line's UoM so the per-line total stays consistent with the
   underlying item cost (e.g. swapping EA→BOX with multiplier 12 turns
   $10/EA into $120/BOX). PCS / SET / KG / LB don't have a deterministic
   conversion to EA so they keep multiplier=1 (rename-only). */
/* UoM data layer — central `data/uomSets` module is the source of
   truth across every consumer (this grid, the Add Line Item dialog,
   the SO creation step, anywhere uom is displayed). `UOM_OPTIONS`
   exists as the discrete-set alias, but rendering surfaces use the
   per-product set helpers below. */
import {
  UOM_SETS,
  type UomOption,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  findSetContainingUom,
  multiplierWithinSet,
} from '../../data/uomSets';
const UOM_OPTIONS: UomOption[] = UOM_SETS.discrete;

/** Scale factor for a UoM swap. Returns 1 when either side is unknown
 *  OR the two UoMs live in different sets (a Liter and a Box never
 *  interconvert — only same-set conversions are valid). */
export function uomScaleFactor(oldCode: string, newCode: string): number {
  const oldSetId = findSetContainingUom(oldCode);
  const newSetId = findSetContainingUom(newCode);
  if (!oldSetId || !newSetId || oldSetId !== newSetId) return 1;
  const set = UOM_SETS[oldSetId];
  const oldMult = multiplierWithinSet(oldCode, set);
  const newMult = multiplierWithinSet(newCode, set);
  return newMult / oldMult;
}

const DOLLAR = "\u0024";

function formatCompactValue(value: number) {
  // Always return the full grouped number (e.g. "1,400,000") so users can
  // read every digit. CSS truncation + tooltip handles cells that get
  // genuinely too wide (≥100s of billions).
  return value.toLocaleString();
}

function formatCurrencyValue(value: number, _compact = false) {
  // Always render full currency (e.g. "$1,400,000.00"). The legacy
  // `compact` flag is ignored; CSS truncation + tooltip handles overflow.
  return `${DOLLAR}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ═══ PPU capsule — matches Quote module: $ + price in outlined capsule, unit label BELOW ═══ */
function PriceCapsule({
  price,
  unit = "EA",
  cancelled,
  editable,
  onChangePrice,
  /* When the SO is in a post-Cleared state, the version-bump consent
     has to happen BEFORE the scope modal — editing a locked order
     without first agreeing to fork a new draft would be "editing in
     read-only state". The parent supplies onRequestVersionConfirm
     which opens AutoVersionConfirm and calls the apply callback only
     after the user has consented; PriceCapsule then opens its scope
     modal on that callback. */
  requiresVersionFirst,
  onRequestVersionConfirm,
}: {
  price: number; unit?: string; cancelled?: boolean; editable?: boolean;
  onChangePrice?: (v: number) => void;
  requiresVersionFirst?: boolean;
  onRequestVersionConfirm?: (newPrice: number, applyCallback: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(price));
  const [showPriceConfirm, setShowPriceConfirm] = useState(false);
  const [pendingPrice, setPendingPrice] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(String(price)); }, [price, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  const openScopeModal = (parsed: number) => {
    setPendingPrice(parsed);
    setShowPriceConfirm(true);
  };
  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== price && onChangePrice) {
      if (requiresVersionFirst && onRequestVersionConfirm) {
        // Defer the scope modal until the user has consented to the
        // version bump. Parent opens AutoVersionConfirm; the apply
        // callback below runs only on confirm.
        onRequestVersionConfirm(parsed, () => openScopeModal(parsed));
      } else {
        openScopeModal(parsed);
      }
    } else {
      setDraft(String(price));
    }
    setEditing(false);
  };
  const formatted = formatCurrencyValue(price, true);
  const isCan = !!cancelled;
  const uomLabel = UOM_OPTIONS.find(u => u.code === unit)?.label || unit;

  return (
    <div className={`${isCan ? "opacity-50" : ""}`} style={{ position: "relative", display: "inline-block", width: editable || editing ? 110 : "auto" }}>
      {/* Read-only state — Shipment-style inline display: bold black price +
          small slimmer gray UOM label on the same baseline. Capsule chrome
          and absolutely-positioned UOM stay in editable mode. */}
      {!editing && !editable ? (
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, lineHeight: 1 }}>$</span>
          <span className={isCan ? "line-through" : ""} style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {uomLabel}
          </span>
        </span>
      ) : editing ? (
        <div
          style={{
            display: "inline-flex", alignItems: "center", width: "100%", height: 30,
            padding: "0 8px", gap: 1, borderRadius: 6,
            border: "1px solid #3B82F6", backgroundColor: "#FFFFFF",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.10)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, lineHeight: 1, flexShrink: 0 }}>$</span>
          <input ref={inputRef} type="text" inputMode="decimal" value={draft}
            onChange={e => { const v = e.target.value; if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') setDraft(v); }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(price)); setEditing(false); } }}
            className="bg-transparent text-foreground outline-none"
            /* `flex: 1, minWidth: 0` lets the input shrink and grow inside
               the capsule so a long value scrolls within the field instead
               of overflowing the column. */
            style={{ flex: 1, minWidth: 0, height: "100%", border: "none", fontSize: 13, fontWeight: 500, color: "#1F2937", padding: "0 2px" }} />
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
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600, lineHeight: 1, flexShrink: 0 }}>$</span>
          {/* Long values truncate with an ellipsis inside the capsule
             rather than spilling into the next column. The `title`
             attribute on the parent button surfaces the full value on
             hover. */}
          <span className={isCan ? "line-through" : ""} style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
            {price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </button>
      )}
      {/* Unit label below PPU — only in editable mode (read-only branch
          shows it inline next to the price). */}
      {(editing || editable) && (
        <span style={{
          position: "absolute", top: "100%", left: 0, marginTop: 2,
          fontSize: 10, fontWeight: 400, color: "#9CA3AF", lineHeight: 1,
          userSelect: "none", whiteSpace: "nowrap",
        }}>
          {uomLabel}
        </span>
      )}

      {/* PPU scope modal — same dialog the configurator shows. Picking a
          scope commits the new value via onChangePrice; the parent's
          onUpdateLine then runs its version-bump check (AutoVersionConfirm
          fires for post-Cleared orders) so the scope and version flows
          chain cleanly. */}
      {showPriceConfirm && pendingPrice !== null && (
        <PriceScopeModal
          newPrice={pendingPrice}
          onApply={(scope: PriceScope) => {
            setShowPriceConfirm(false);
            setPendingPrice(null);
            onChangePrice?.(pendingPrice);
            if (scope === "master") {
              toast.success("Item master price updated — future orders will use this price");
            } else {
              toast.success("Price updated for this order only");
            }
          }}
          onCancel={() => { setShowPriceConfirm(false); setPendingPrice(null); setDraft(String(price)); }}
        />
      )}
    </div>
  );
}

/* ═══ QTY/UOM capsule — matches Quote module: qty | UOM in outlined capsule ═══ */
function QtyUomCapsule({ qty, unit = "EA", cancelled, editable, onChangeQty, onChangeUnit, uomSet = UOM_OPTIONS, primaryUomCode = 'EA' }: {
  qty: number; unit?: string; cancelled?: boolean; editable?: boolean;
  onChangeQty?: (v: number) => void; onChangeUnit?: (u: string) => void;
  /* Per-product UoM list + primary code. The capsule reads from the
     line item's product set so liquids surface Liter/Gallon/Drum,
     lengths surface Foot/Yard/Roll, and the rest stay on the
     discrete EA/Box/Carton/Pallet ladder. */
  uomSet?: UomOption[];
  primaryUomCode?: string;
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
      {/* Read-only state — Shipment-style inline display: bold black qty +
          small slimmer gray UOM (no slash, no border). Capsule chrome only
          renders when the row is editable. */}
      {!editing && !unitOpen && !showEditAffordance ? (
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
          <span className={isCan ? "line-through" : ""} style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {formatCompactValue(qty)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {unit}
          </span>
        </span>
      ) : (
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
        {/* LEFT — Quantity: STATIC 64px width sized for 5-digit values
            so the cell doesn't grow when the user taps in to edit. Both
            the read button and the edit input share the same width so
            the row layout stays stable. */}
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", width: 64, padding: 0 }}>
            <input ref={inputRef} type="number" min={0} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(qty)); setEditing(false); } }}
              style={{ width: "100%", height: "100%", border: "none", textAlign: "center", outline: "none", fontSize: 13, fontWeight: 600, color: "#1F2937", backgroundColor: "transparent", padding: 0 }} />
          </div>
        ) : (
          <button
            onClick={editable ? () => { setDraft(String(qty)); setEditing(true); } : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, width: 64, border: "none", backgroundColor: "transparent",
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

        {/* Hairline divider between qty input and UoM selector — only used
            in editable capsule mode (read-only is the inline branch above). */}
        <div style={{ width: 1, backgroundColor: "#E5E7EB", flexShrink: 0, alignSelf: "stretch" }} />

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
          {/* Cap to ~6 characters so the capsule doesn't expand when
              a user picks a longer UoM. Anything past 6 chars
              truncates with an ellipsis. */}
          <span title={unit} style={{ fontSize: 12, fontWeight: 600, color: "#374151", lineHeight: 1, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{unit}</span>
          {showEditAffordance && <ChevronDown style={{ width: 11, height: 11, color: "#9CA3AF", flexShrink: 0 }} />}
        </button>
      </div>
      )}

      {/* UoM dropdown */}
      {unitOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-card border border-border rounded-lg" style={{ zIndex: "var(--z-dropdown)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 200, overflow: "hidden" }}>
          {uomSet.map(opt => {
            /* `unit` is the line's stored UoM (could be code or name);
               match against either id/name case-insensitively so the
               option highlights regardless of how the seed wrote it. */
            const unitN = (unit || '').toLowerCase();
            const isActive = opt.id.toLowerCase() === unitN || opt.name.toLowerCase() === unitN;
            const isPrimary = opt.id.toLowerCase() === (primaryUomCode || '').toLowerCase() || opt.name.toLowerCase() === (primaryUomCode || '').toLowerCase();
            return (
              <button key={opt.id} onClick={() => { if (onChangeUnit) onChangeUnit(opt.name); setUnitOpen(false); }}
                className="w-full flex items-center justify-between transition-colors"
                style={{ padding: "10px 12px", border: "none", backgroundColor: isActive ? "#F9FAFB" : "transparent", cursor: "pointer", borderBottom: "1px solid #F3F4F6" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? "#F9FAFB" : "transparent"; }}
              >
                <div className="flex flex-col items-start" style={{ gap: 2 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: "#1F2937", lineHeight: 1 }}>{opt.name}</span>
                    {/* Partner Management "Primary" pill — surfaces the
                        item's preferred UoM at a glance. */}
                    {isPrimary && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#1B6EF3', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 5px', borderRadius: 3, lineHeight: 1, letterSpacing: 0.2, textTransform: 'uppercase' }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>{opt.fullName}</span>
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

function LineRow({ line, idx, isEditable, isDraft, expandedRows, selectedLineIds, duplicateOfMap, onDeleteLine, onCancelLines, onConfigureLine, onUpdateLine, onPreviewLine, toggleExpand, toggleSelectLine, requiresVersionFirst, onRequestPriceVersionConfirm, onRequestUomChange, pricingAPI, adjustmentsAPI, isNewlyAdded = false }: {
  line: SOLine; idx: number; isEditable: boolean; isDraft: boolean; expandedRows: Set<string>; selectedLineIds: Set<string>; duplicateOfMap: Map<number, number>;
  onDeleteLine?: (id: string) => void; onCancelLines?: (ids: string[]) => void; onConfigureLine?: (l: SOLine) => void; onUpdateLine?: (id: string, u: Partial<SOLine>) => void;
  onPreviewLine: (l: SOLine) => void;
  toggleExpand: (id: string) => void; toggleSelectLine: (id: string) => void;
  requiresVersionFirst?: boolean;
  onRequestPriceVersionConfirm?: (lineId: string, newPrice: number, applyCallback: () => void) => void;
  onRequestUomChange?: (line: SOLine, newUom: string) => void;
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
  isNewlyAdded?: boolean;
}) {
  const isExp = expandedRows.has(line.id);
  const isCan = line.cancelled;
  const isSel = selectedLineIds.has(line.id);
  const canSel = !isCan && line.shippedQty < line.orderedQty;
  const toShip = Math.max(0, line.orderedQty - line.shippedQty);
  const dash = <span className="text-foreground/15" style={{ fontSize: "var(--text-caption)" }}>{"\u2014"}</span>;

  // Per-line edit gate. Cancelled lines, and lines with ANY shipped qty,
  // are locked even when the SO itself is still editable — you can't
  // un-ship what's gone out. This is what protects Partially Shipped SOs:
  // the unshipped lines stay fully editable through the new-version flow,
  // but already-shipped lines reject qty/PPU edits.
  const hasShipped = (line.shippedQty ?? 0) > 0;
  const showEditAffordance = isEditable && !isCan && !hasShipped;

  return (
    <>
    {/* Smooth removal animation — mirrors the Quote ItemsTable row
        exit treatment so a delete reads as a fade + slide-out + height
        collapse rather than a hard pop. Layout-animated so the rows
        above slide up smoothly when a middle row is removed. */}
    <motion.tr
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`li-row border-b border-border/40 group transition-colors duration-150 ${isCan ? "bg-secondary/50 opacity-60" : isSel ? "bg-[#EBF3FF]" : "hover:bg-muted/30 cursor-pointer"} ${isNewlyAdded ? "so-grid-newly-added-row" : ""}`}
      onClick={(e) => {
        /* Row-level click opens the Advanced Configurator (Purchase
           Order parity). Inline edit affordances (qty input, unit
           dropdown, PPU input, action buttons) stop propagation so they
           don't bubble; the closest() guard adds a belt-and-braces
           check for any new control that might land in the row later. */
        if (isCan || !onConfigureLine) return;
        const t = e.target as HTMLElement;
        if (t.closest('input, button, select, a, [role="button"]')) return;
        onConfigureLine(line);
      }}>
      {/* Hover bg + cursor-pointer mirror PO `LineItemsPanel` — the row
          itself is the primary affordance for opening the configurator;
          the explicit Pencil stays for users who prefer an icon target. */}
      {/* Row checkbox: Purchase Order's table checkbox (PODemands). The
          column only exists while lines can be acted on (PO's
          `showSelect`). A line that can't be selected shows PO Cart's
          disabled box with a tooltip saying why. The cell stops the
          click so ticking a line never opens the configurator. */}
      <td
        className="li-sel"
        onClick={(e) => { e.stopPropagation(); }}
        style={{ padding: onCancelLines ? "11px 0 0 16px" : 0, width: onCancelLines ? undefined : 0, verticalAlign: "top" }}
      >
        {onCancelLines && (canSel ? (
          <Checkbox
            checked={isSel}
            onCheckedChange={() => toggleSelectLine(line.id)}
            aria-label={isSel ? `Deselect line ${idx + 1}` : `Select line ${idx + 1}`}
          />
        ) : (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-not-allowed">
                <Checkbox
                  checked={false}
                  disabled
                  className="disabled:opacity-100 bg-slate-200 border-slate-300"
                  aria-label={isCan ? "Cancelled line can't be selected" : "Fully shipped line can't be selected"}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {isCan ? "Cancelled lines can't be selected" : "Fully shipped lines can't be selected"}
            </TooltipContent>
          </Tooltip>
        ))}
      </td>
      <td className="li-num text-muted-foreground tabular-nums" style={{ padding: "10px 0 10px 0", fontSize: 11, fontWeight: 400, verticalAlign: "top", textAlign: "center", width: 32 }}>{String(idx + 1).padStart(3, "0")}</td>
      <td className="li-main" style={{ padding: "8px var(--space-inline-gap)", verticalAlign: "top" }}>
        <div className="flex items-start" style={{ gap: "10px" }}>
          {/* Item thumbnail — Partner v7 chrome.
              - Tinted background derived from the item code so each row
                reads as its own item.
              - HoverCard preview on hover (gradient header, category,
                on-hand qty, unit price, status pill).
              - Tap opens the full item quick-view via onPreviewLine. */}
          {(() => {
            const previewTokens = (() => {
              const code = line.itemCode || "";
              let h = 0; for (let c = 0; c < code.length; c++) h = code.charCodeAt(c) + ((h << 5) - h);
              const ah = Math.abs(h);
              const TINTS = ["#FDE8E8", "#FEF3C7", "#DBEAFE", "#E0E7FF", "#D1FAE5", "#FCE7F3", "#F1F5F9"];
              const CATS = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
              const STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];
              const STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
                "In Stock": { bg: "#F0FDF4", fg: "#166534" },
                "Low Stock": { bg: "#FFFBEB", fg: "#92400E" },
                "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B" },
                "On Order": { bg: "#EFF6FF", fg: "#1E40AF" },
              };
              const status = STATUSES[ah % STATUSES.length];
              return {
                tint: TINTS[ah % TINTS.length],
                category: CATS[ah % CATS.length],
                status,
                statusTokens: STATUS_TOKENS[status],
                onHand: 100 + ((ah * 13) % 15000),
                unitPrice: 10 + ((ah * 7) % 500),
              };
            })();
            return (
              <HoverCard openDelay={140} closeDelay={80}>
                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPreviewLine(line); }}
                    aria-label={`Preview ${line.itemCode}`}
                    style={{
                      width: 40, height: 40, borderRadius: 6,
                      border: "1px solid var(--border)", padding: 0,
                      flexShrink: 0, cursor: "pointer",
                      background: "transparent", overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(27, 110, 243, 0.45)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(27, 110, 243, 0.10)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Sample line item image — hashed by SKU so every
                        render of the same item picks the same photo.
                        Replaces the slate Package fallback so the
                        table reads as real items, not placeholders. */}
                    <img
                      src={getLineItemImage(line.itemCode)}
                      alt={line.itemName}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      draggable={false}
                    />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom" align="start" sideOffset={8}
                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div
                    className="px-3.5 py-3 relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)" }}
                  >
                    <div className="flex items-center gap-3 relative">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                        <img
                          src={getLineItemImage(line.itemCode)}
                          alt={line.itemName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{line.itemCode}</p>
                        <p className="text-[11px] truncate" style={{ color: "rgba(148,163,184,0.9)" }}>{line.itemName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-3.5 py-3 space-y-2">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{previewTokens.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>On-Hand: <b>{previewTokens.onHand.toLocaleString()}</b></span>
                      </div>
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                        ${previewTokens.unitPrice.toFixed(2)}
                        <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
                      </span>
                    </div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px]"
                      style={{ fontWeight: 600, backgroundColor: previewTokens.statusTokens.bg, color: previewTokens.statusTokens.fg }}
                    >
                      {previewTokens.status}
                    </span>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })()}
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap" style={{ gap: "6px", marginBottom: 4 }}>
              {/* Quotes product-code typography: 13px / weight 500 / foreground-soft (lighter than full --foreground). */}
              <span className={`${isCan ? "line-through" : ""}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground-soft)", lineHeight: 1 }}>{line.itemCode}</span>
              {/* Item-master status straight after the code, PO's order. */}
              <InactiveItemPill code={line.itemCode} size="md" />
              <ItemTypeBadge type={line.itemType} />
              {duplicateOfMap.has(idx) && <DuplicateBadge ofIndex={duplicateOfMap.get(idx)!} />}
              {isCan && <span className="inline-flex items-center rounded bg-destructive/8 text-destructive" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "1px 6px" }}>CANCELLED</span>}
            </div>
            <ItemDescription text={line.itemName} maxLines={1} className="mt-0.5" />
            {isCan && line.cancelledReason && <div className="text-destructive" style={{ fontSize: "var(--text-caption)", marginTop: "2px" }}>{line.cancelledReason}</div>}
          </div>
        </div>
      </td>
      {/* QTY/UOM capsule first */}
      <td className="li-fig" data-label="Qty / UoM" style={{ padding: "8px 12px", verticalAlign: "top" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-start">
          {(() => {
            /* Resolve the line's UoM set from the product. The
               heuristic runs on the itemName + itemCode (e.g. "Paint
               …" → liquid; "Cable …" → length; everything else →
               discrete) and stays consistent with how the Add Line
               Item dialog and the SO creation step assigned the set
               at seed time. */
            const productLike = { itemCode: line.itemCode, itemName: line.itemName };
            const itemSet = getUomSetForProduct(productLike);
            const primary = findUomById(getPrimaryUomForProduct(productLike));
            return (
              <QtyUomCapsule
                qty={line.orderedQty}
                unit={line.uom || primary?.name || "EA"}
                cancelled={isCan}
                editable={showEditAffordance && !!onUpdateLine}
                onChangeQty={v => onUpdateLine?.(line.id, { orderedQty: v })}
                onChangeUnit={u => onRequestUomChange?.(line, u)}
                uomSet={itemSet}
                primaryUomCode={primary?.name || "EA"}
              />
            );
          })()}
        </div>
      </td>
      {/* PPU column after QTY */}
      <td className="li-fig" data-label="Price per unit" style={{ padding: "8px 12px", verticalAlign: "top" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-start">
          <PriceCapsule
            price={line.unitPrice}
            unit={line.uom || "EA"}
            cancelled={isCan}
            editable={showEditAffordance && !!onUpdateLine}
            onChangePrice={v => onUpdateLine?.(line.id, { unitPrice: v })}
            requiresVersionFirst={requiresVersionFirst}
            onRequestVersionConfirm={(newPrice, applyCb) => onRequestPriceVersionConfirm?.(line.id, newPrice, applyCb)}
          />
        </div>
      </td>
      <td className="li-fig li-end" data-label="Total" style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "right", maxWidth: 0 }}>
        {!isCan ? (() => {
          /* Line TOTAL = baseSubtotal + line-scoped pricing-rule impact
             + line-scoped one-time adjustment net. The breakdown sub-
             line was replaced with a hover card that itemises each
             rule and adjustment so users see the full composition
             without polluting every row. */
          const baseSubtotal = line.orderedQty * line.unitPrice;
          const ruleBreakdown = pricingAPI?.breakdowns?.find((b) => b.lineId === line.id);
          const ruleDelta = ruleBreakdown ? (ruleBreakdown.premiumAmount - ruleBreakdown.discountAmount) : 0;
          const adjBreakdown = adjustmentsAPI?.lineBreakdowns?.get(line.id);
          const adjDelta = adjBreakdown ? adjBreakdown.net : 0;
          const lineTotal = baseSubtotal + ruleDelta + adjDelta;
          const hasOverlay = ruleDelta !== 0 || adjDelta !== 0;
          return (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <PriceBreakdownHoverCard
                line={{ id: line.id, itemCode: line.itemCode, orderedQty: line.orderedQty, unitPrice: line.unitPrice }}
                pricingAPI={pricingAPI}
                adjustmentsAPI={adjustmentsAPI}
                formatCurrency={formatCurrencyValue}
              >
                {/* Hover affordance — only when there IS a breakdown
                    to reveal. A faint dotted underline under the price
                    keeps the column right-aligned and never offsets
                    the header. */}
                <span
                  className="text-foreground tabular-nums block"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1F2937",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {formatCurrencyValue(lineTotal)}
                </span>
              </PriceBreakdownHoverCard>
            </div>
          );
        })() : dash}
      </td>
      <td className="li-fig li-fig-sm" data-label="Allocated" style={{ padding: "8px 8px", verticalAlign: "top", textAlign: "right" }}>{!isCan ? <ProgressFractionCell value={line.allocatedQty} total={toShip} /> : dash}</td>
      <td className="li-fig li-fig-sm" data-label="Shipped" style={{ padding: "8px 8px", verticalAlign: "top", textAlign: "right" }}>{!isCan ? <ProgressFractionCell value={line.shippedQty} total={line.orderedQty} altPartialColor /> : dash}</td>
      <td
        className="li-act"
        style={{ padding: "10px 4px", verticalAlign: "top", textAlign: "center", whiteSpace: "nowrap" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Edit pencil — opens the advanced configurator. Pure Tailwind
            chrome (Purchase Order `LineItemsPanel` parity, line for line)
            so the hover bg actually paints — inline backgroundColor was
            overriding the hover-state class earlier. */}
        <div className="inline-flex items-center justify-end gap-1">
        {!isCan && onConfigureLine && (
          <button
            onClick={e => { e.stopPropagation(); onConfigureLine(line); }}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
            title="Edit line"
            aria-label="Edit line"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {!isCan && canSel && (() => {
          if (isDraft && onDeleteLine) {
            /* Draft: delete immediately, matches the Quote line item
               table's X. Previously this opened an inline
               ConfirmationModal wrapped in a `<tr style={{ display:
               'none' }}>` — the hidden row hid the modal itself
               (ConfirmationModal renders inline, not via portal), so
               the click looked like a no-op. The delete handler in
               SODetail already guards on shipped qty and surfaces a
               toast, so the modal was double-confirming nothing. */
            return (
              <button
                onClick={e => { e.stopPropagation(); onDeleteLine(line.id); }}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
                title="Remove line item"
                aria-label="Remove line item"
              >
                <X className="size-3.5" />
              </button>
            );
          }
          if (!isDraft && onCancelLines) {
            // Post-draft: cancel line
            return (
              <button
                onClick={e => { e.stopPropagation(); onCancelLines([line.id]); }}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
                title="Cancel line"
                aria-label="Cancel line"
              >
                <Ban className="size-3.5" />
              </button>
            );
          }
          return null;
        })()}
        </div>
      </td>
    </motion.tr>
    </>
  );
}

export function SOLineGrid({ so, onAddLine, onAllocateLine, onAllocateAll, onDeleteLine, onCancelLines, onConfigureLine, onUpdateLine, onDuplicateLine, onRequestPriceVersionConfirm, onRequestUomChange, requiresVersionFirst, pricingAPI, adjustmentsAPI }: SOLineGridProps) {
  // SO-level edit gate — Shipped / Cancelled / Archived are terminal and
  // fully locked. Everything else (Draft / Pending Review / Cleared /
  // Partially Shipped / Partially Cancelled) is editable; per-line
  // shipped-qty locking is applied per row below.
  const isEditable = !["Cancelled", "Shipped", "Archived"].includes(so.status);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [duplicateConfirmLine, setDuplicateConfirmLine] = useState<SOLine | null>(null);

  /* Newly-added row highlight — soft accent fade, parity with Quote
     `ItemsTabTableClean`. State lives here (not in the parent) because
     SOLineGrid owns the line-level visual lifecycle; we diff the line
     ids each render against the previous set to spot new arrivals. */
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const prevLineIdsRef = useRef<Set<string>>(new Set());
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prev = prevLineIdsRef.current;
    const added: string[] = [];
    const nextIds = new Set<string>();
    for (const line of so.lines) {
      nextIds.add(line.id);
      if (!prev.has(line.id)) added.push(line.id);
    }
    prevLineIdsRef.current = nextIds;
    /* Skip the very first render so existing rows on a freshly-opened
       SO don't all flash at once — only true subsequent additions
       should animate. */
    if (prev.size === 0) return;
    if (added.length) {
      setNewlyAddedIds((p) => new Set([...p, ...added]));
      if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
      newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2000);
    }
  }, [so.lines]);
  useEffect(() => () => {
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
  }, []);

  // Item peek modal — opens from any line thumbnail in the grid.
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewLine = (line: SOLine) => {
    const fmtUSD = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    openItemQuickView({
      code: line.itemCode,
      description: line.itemName,
      primaryTag: `Primary: ${line.itemType}`,
      uom: line.uom,
      onHand: line.allocatedQty,
      metrics: [
        { label: "Unit Price", value: fmtUSD(line.unitPrice), caption: "Unit Price" },
        { label: "Ordered", value: `${line.orderedQty} ${line.uom}`, caption: "Ordered" },
        { label: "Allocated", value: `${line.allocatedQty} ${line.uom}`, caption: "Allocated" },
        { label: "Shipped", value: `${line.shippedQty} ${line.uom}`, caption: "Shipped" },
      ],
    });
  };
  const toggleExpand = (id: string) => setExpandedRows(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectLine = (id: string) => setSelectedLineIds(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectableLines = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
  const allSelectableSelected = selectableLines.length > 0 && selectedLineIds.size === selectableLines.length;
  const toggleSelectAll = () => setSelectedLineIds(allSelectableSelected ? new Set() : new Set(selectableLines.map(l => l.id)));
  const handleBulkCancel = () => { if (onCancelLines && selectedLineIds.size > 0) { onCancelLines(Array.from(selectedLineIds)); setSelectedLineIds(new Set()); } };
  // Bulk duplicate / delete — mirrors Quote `ItemsTabTableClean`.
  const handleBulkDuplicate = () => {
    if (!onDuplicateLine) return;
    const ids = Array.from(selectedLineIds);
    ids.forEach(id => {
      const line = so.lines.find(l => l.id === id);
      if (line) onDuplicateLine(line);
    });
    setSelectedLineIds(new Set());
  };
  const handleBulkDelete = () => {
    const ids = Array.from(selectedLineIds);
    ids.forEach(id => onDeleteLine(id));
    setSelectedLineIds(new Set());
  };
  const cancelledLines = so.lines.filter(l => l.cancelled);
  const activeLines = so.lines.filter(l => !l.cancelled);
  const fullyAllocCount = activeLines.filter(l => l.allocatedQty >= l.orderedQty).length;
  const partAllocCount = activeLines.filter(l => l.allocatedQty > 0 && l.allocatedQty < l.orderedQty).length;
  const isDraft = so.status === "Draft";
  const isPendingConfirm = so.status === "Pending Review";
  // QTY/UOM first, then PPU
  // Wider PPU + TOTAL columns so full numbers fit ("$1,400,000.00" needs
  // ~140px). At 100s of billions the cell still truncates with `…` and
  // shows the full number on hover via the `title` attribute.
  /* QTY / UOM was 100px which clipped the dropdown the moment the user
     picked a longer-label unit (Pallet, Bundle, Carton). Bumped to 140px
     so the capsule sits with breathing room. The description column
     soaks up the difference. */
  const cols = [{ label: "LINE ITEMS", align: "text-left", width: "" }, { label: "QTY / UOM", align: "text-left", width: "w-[132px]" }, { label: "PRICE PER UNIT", align: "text-left", width: "w-[132px]" }, { label: "TOTAL", align: "text-right", width: "w-[124px]" }, { label: "ALLOCATED", align: "text-right", width: "w-[90px]" }, { label: "SHIPPED", align: "text-right", width: "w-[90px]" }];
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
      {/* Soft accent fade for newly-added rows — parity with the Quote
          line-items table. No green ring, no qty-bump flash here — the
          ring/flash treatment is reserved for the add-line-items right
          cards (creation Step 2 and Add Line Item dialog). */}
      <style>{`
        @keyframes soGridNewRow {
          0%   { background-color: var(--accent); }
          40%  { background-color: var(--accent); }
          100% { background-color: transparent; }
        }
        .so-grid-newly-added-row { animation: soGridNewRow 2s ease-out forwards; }
      `}</style>
      {/* On a narrow card the buttons wrap under the title rather than
          squeezing it onto two lines. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border" style={{ padding: "10px var(--space-card-padding)" }}>
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          {/* Icon chip + title + count badge — Quotes ItemsTabTableClean header */}
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-primary" />
          </div>
          <span className="text-slate-700" style={{ fontSize: 13, fontWeight: 600 }}>Line Items</span>
          <NumberPill count={activeLines.length} />
          {/* Status sub-pills — Partner StatusPill chrome: rounded-full,
              padding 2px 10px, fontSize 11, hairline border tinted by tone. */}
          {selectedLineIds.size > 0 ? (
            // Plain selection count text — matches Quote `ItemsTabTableClean`.
            // No icon/emoji prefix (Partner pattern).
            <span
              className="shrink-0 ml-1 whitespace-nowrap"
              style={{
                fontSize: 12, fontWeight: 500, lineHeight: 1,
                color: "var(--muted-foreground)",
              }}
            >
              {selectedLineIds.size} selected
            </span>
          ) : (
            <div className="flex items-center gap-1.5 ml-1 min-w-0">
              {cancelledLines.length > 0 && (
                <span
                  className="inline-flex items-center shrink-0 whitespace-nowrap"
                  style={{
                    padding: "2px 10px", borderRadius: 9999,
                    fontSize: 11, fontWeight: 500, lineHeight: 1.4,
                    backgroundColor: "#F1F5F9", color: "#475569",
                    border: "1px solid #64748B33",
                  }}
                >
                  {cancelledLines.length} cancelled
                </span>
              )}
              <span
                className="inline-flex items-center shrink-0 whitespace-nowrap"
                style={{
                  padding: "2px 10px", borderRadius: 9999,
                  fontSize: 11, fontWeight: 500, lineHeight: 1.4,
                  backgroundColor: fullyAllocCount === activeLines.length && activeLines.length > 0 ? "#ECFDF5" : "#E5F0FF",
                  color: fullyAllocCount === activeLines.length && activeLines.length > 0 ? "#065F46" : "#0F62D6",
                  border: `1px solid ${fullyAllocCount === activeLines.length && activeLines.length > 0 ? "#05966933" : "#0A77FF33"}`,
                }}
              >
                Allocation {fullyAllocCount}/{activeLines.length}
              </span>
              {partAllocCount > 0 && (
                <span
                  className="inline-flex items-center shrink-0 whitespace-nowrap"
                  style={{
                    padding: "2px 10px", borderRadius: 9999,
                    fontSize: 11, fontWeight: 500, lineHeight: 1.4,
                    backgroundColor: "#FFFBEB", color: "#92400E",
                    border: "1px solid #D9770633",
                  }}
                >
                  {partAllocCount} partial
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center flex-wrap justify-end ml-auto" style={{ gap: "6px" }}>
          {selectedLineIds.size > 0 ? (
            // Bulk action bar — direct port of Quote `ItemsTabTableClean`:
            // Duplicate (white), Delete (destructive outline), optional Cancel
            // when the SO is in a state where line cancellation is allowed,
            // and a clear-selection X. Buttons share the Partner small-button
            // chrome: 32px / 8px radius / 13px / weight 500 / hairline border.
            <>
              {onDuplicateLine && (
                <button
                  onClick={handleBulkDuplicate}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    height: 32, padding: "0 12px",
                    borderRadius: 8, border: "1px solid var(--border)",
                    backgroundColor: "#FFFFFF", color: "var(--foreground)",
                    fontSize: 13, fontWeight: 500, lineHeight: 1,
                    cursor: "pointer", transition: "all 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                >
                  <Copy style={{ width: 12, height: 12 }} /> Duplicate
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  height: 32, padding: "0 12px",
                  borderRadius: 8, border: "1px solid #FCA5A5",
                  backgroundColor: "#FFFFFF", color: "var(--destructive)",
                  fontSize: 13, fontWeight: 500, lineHeight: 1,
                  cursor: "pointer", transition: "all 150ms",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              >
                <Trash2 style={{ width: 12, height: 12 }} /> Delete
              </button>
              {onCancelLines && (
                <button
                  onClick={handleBulkCancel}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    height: 32, padding: "0 12px",
                    borderRadius: 8, border: "1px solid var(--border)",
                    backgroundColor: "#FFFFFF", color: "var(--foreground)",
                    fontSize: 13, fontWeight: 500, lineHeight: 1,
                    cursor: "pointer", transition: "all 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                >
                  <Ban style={{ width: 12, height: 12 }} /> Cancel
                </button>
              )}
              <div style={{ width: 1, height: 18, backgroundColor: "var(--border)", flexShrink: 0 }} />
              <button
                onClick={() => setSelectedLineIds(new Set())}
                title="Clear selection"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid var(--border)", backgroundColor: "#FFFFFF",
                  cursor: "pointer", padding: 0, transition: "all 150ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              >
                <X style={{ width: 13, height: 13, color: "var(--muted-foreground)" }} />
              </button>
            </>
          ) : (
            <>
              {/* Partner v7 top-right button chrome —
                  VendorDetailsPage.tsx:5159 (white) + :5224 (primary).
                  Both buttons sit at h-9, share the same shadow and
                  hover treatments so the cluster reads as one toolbar. */}
              {onAllocateAll && (
                <button
                  type="button"
                  onClick={onAllocateAll}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span className="text-primary">Allocate Inventory</span>
                </button>
              )}
              {isEditable && (
                <button
                  type="button"
                  onClick={onAddLine}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {isDraft && activeLines.length > 0 && <div className="flex items-center rounded-md" style={{ margin: "var(--space-card-padding) var(--space-card-padding) 0", padding: "var(--space-inline-gap) var(--space-card-padding)", gap: "var(--space-inline-gap)", backgroundColor: "rgba(10,119,255,0.08)" }}><Target className="w-3.5 h-3.5 text-primary shrink-0" /><span className="text-primary" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any }}>Allocate inventory to reserve stock for this order.</span></div>}
      {isPendingConfirm && activeLines.length > 0 && <div className="flex items-center rounded-md" style={{ margin: "var(--space-card-padding) var(--space-card-padding) 0", padding: "var(--space-inline-gap) var(--space-card-padding)", gap: "var(--space-inline-gap)", backgroundColor: "rgba(239,162,47,0.08)" }}><Package className="w-3.5 h-3.5 shrink-0" style={{ color: "#B45309" }} /><span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "#B45309" }}>Inventory allocated. Clear this Sales Order to enable shipping.</span></div>}
      {/* Never scrolls sideways. Below ~980px of card width each row
          brings its five figures down under the item instead; the
          gutter and action widths below feed that layout
          (line-table-responsive.css). */}
      <div className="li-wrap" style={{ paddingTop: "var(--space-inline-gap)" }}>
        <table
          className="li-table w-full"
          style={{ ["--li-sel-w" as string]: onCancelLines ? "44px" : "0px", ["--li-num-w" as string]: "32px", ["--li-act-w" as string]: "76px" } as React.CSSProperties}
        >
          <thead><tr className="border-b border-border/60">
            {/* Select-all: PO's table checkbox. Ticked when every
                selectable line is selected, the minus glyph when some
                are, disabled when none can be. */}
            <th className="li-sel" style={{ width: onCancelLines ? "44px" : 0, padding: onCancelLines ? "8px 0 8px 16px" : 0, textAlign: "left" }}>
              {onCancelLines && (
                <Checkbox
                  checked={allSelectableSelected ? true : selectedLineIds.size > 0 ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={selectableLines.length === 0}
                  aria-label={allSelectableSelected ? "Deselect all lines" : "Select all lines"}
                  className="translate-y-[1px]"
                />
              )}
            </th>
            <th className="li-num text-center text-muted-foreground tracking-wider uppercase" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "8px 0", letterSpacing: "0.06em", width: "28px" }}>#</th>
            {cols.map((c, ci) => <th key={c.label} className={`${ci === 0 ? "li-main" : "li-fig"} ${c.align} ${c.width} text-muted-foreground tracking-wider uppercase`} style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "8px var(--space-inline-gap)", letterSpacing: "0.06em" }}>{c.label}</th>)}
            <th className="li-act" style={{ width: "52px", padding: "8px 8px" }} />
          </tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {so.lines.map((line, i) => <LineRow key={line.id} line={line} idx={i} isEditable={isEditable} isDraft={isDraft} expandedRows={expandedRows} selectedLineIds={selectedLineIds} duplicateOfMap={dupMap} onDeleteLine={onDeleteLine} onCancelLines={onCancelLines} onConfigureLine={onConfigureLine} onUpdateLine={onUpdateLine} onPreviewLine={previewLine} toggleExpand={toggleExpand} toggleSelectLine={toggleSelectLine} requiresVersionFirst={requiresVersionFirst} onRequestPriceVersionConfirm={onRequestPriceVersionConfirm} onRequestUomChange={onRequestUomChange} pricingAPI={pricingAPI} adjustmentsAPI={adjustmentsAPI} isNewlyAdded={newlyAddedIds.has(line.id)} />)}
            </AnimatePresence>
            {so.lines.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "32px var(--space-card-padding)" }}>
                  <EmptyPlaceholder
                    icon={Package}
                    title="No line items yet"
                    description="Add products to this order to start building line items."
                    actionLabel={isEditable ? "Add Line Item" : undefined}
                    onAction={isEditable ? onAddLine : undefined}
                  />
                </td>
              </tr>
            )}
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
      {/* Item peek modal — opens on thumbnail click anywhere in this grid */}
      {itemQuickViewModal}
    </div>
  );
}
