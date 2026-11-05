import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X, Ban, AlertTriangle, Package, Check,
  Truck, RotateCcw, Warehouse, Info,
  Minus, Plus, DollarSign, FileText, ArrowRight,
  ChevronDown, Paperclip, Upload, User,
  CreditCard, Calendar, Search, Scale,
  ShieldAlert, XOctagon,
} from "lucide-react";
import { ItemTypeBadge } from "./StatusBadge";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { ItemDescription } from "./ItemDescription";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { DisabledCTATooltip } from "./DisabledCTATooltip";
import { CancellationConfirmDialog, useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder, SOLine, CancellationReason, LineCancelAction } from "./types";

/* ═══════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════ */

const REASON_OPTIONS: { value: CancellationReason; label: string; description: string; icon: typeof Ban }[] = [
  { value: "Customer Request", label: "Customer requested cancellation", description: "The buyer changed their mind or no longer needs the order", icon: User },
  { value: "Out of Stock", label: "Item out of stock", description: "Product unavailable or insufficient inventory to fulfill the order", icon: Package },
  { value: "Pricing Error", label: "Pricing or quotation error", description: "Incorrect pricing, missing discounts, or disagreement on quoted terms", icon: DollarSign },
  { value: "Duplicate Order", label: "Duplicate order", description: "The same order was entered twice, either by the customer or internally", icon: FileText },
  { value: "Delivery Date", label: "Delivery date not acceptable", description: "The promised or revised lead time no longer works for the customer", icon: Calendar },
  { value: "Better Alternative", label: "Customer found a better alternative", description: "The customer sourced a comparable product from another vendor", icon: Search },
  { value: "Credit Issue", label: "Credit or payment issue", description: "Order fails credit check, or required payment was not received", icon: CreditCard },
  { value: "Product Discontinued", label: "Product discontinued or unavailable", description: "The item has been discontinued, recalled, or is permanently unavailable", icon: XOctagon },
  { value: "Regulatory", label: "Regulatory or export restriction", description: "Export control, sanctioned entity, or compliance block prevents fulfillment", icon: Scale },
  { value: "Fraudulent Order", label: "Fraudulent or suspicious order", description: "Order flagged for fraud review or confirmed as unauthorized", icon: ShieldAlert },
  { value: "Other", label: "Other reason", description: "Specify the cancellation reason below", icon: Info },
];

/** Determine what cancel action is needed per line based on its lifecycle position.
 *  For partially shipped lines, the already-shipped portion has left the
 *  warehouse and cannot be cancelled. Only the unshipped remainder is
 *  cancellable, so the action reflects that remainder. */
function getLineCancelAction(line: SOLine, soStatus: string): LineCancelAction {
  if (line.cancelled) return "none";
  if (line.deliveredQty >= line.orderedQty) return "rma";
  if (line.shippedQty >= line.orderedQty) return "intercept"; // fully shipped — shouldn't reach here via cancellableLines
  // Partially shipped: shipped units are protected, unshipped portion follows normal logic
  const unshippedQty = line.orderedQty - line.shippedQty;
  if (unshippedQty <= 0) return "none";
  if (line.pickedQty > 0) return "put-back";
  if (soStatus === "Cleared" && line.readyToPick) return "halt-pick";
  if (line.allocatedQty > 0) return "release";
  return "void";
}

const ACTION_LABELS: Record<LineCancelAction, { label: string; icon: typeof Ban; color: string }> = {
  void: { label: "No inventory impact. The line will be voided.", icon: Info, color: "var(--foreground)" },
  release: { label: "Allocated inventory will be released back to available stock.", icon: Package, color: "var(--primary)" },
  "halt-pick": { label: "Warehouse will be notified to halt picking for this item.", icon: Warehouse, color: "var(--chart-3)" },
  "put-back": { label: "Picked items will need a put-back confirmation from the warehouse.", icon: RotateCcw, color: "var(--chart-3)" },
  intercept: { label: "A carrier intercept will be requested. Success is not guaranteed.", icon: Truck, color: "var(--destructive)" },
  rma: { label: "Already delivered. Use the Returns / RMA module instead.", icon: ArrowRight, color: "var(--chart-4)" },
  none: { label: "Already cancelled.", icon: Ban, color: "var(--foreground)" },
};

/* ═══ Inline typography styles ═══ */
const captionStyle: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const microStyle: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };
const smallStyle: React.CSSProperties = { fontSize: "var(--text-small)", fontWeight: "var(--font-weight-normal)" };

interface Props {
  so: SalesOrder;
  mode: "full" | "partial";
  preselectedLineIds?: string[];
  onConfirmFull: (reason: CancellationReason, reasonText: string) => void;
  onConfirmPartial: (lineIds: string[], cancelQtys: Record<string, number>, reason: CancellationReason, reasonText: string) => void;
  onClose: () => void;
}

interface LineSelection {
  selected: boolean;
  cancelQty: number;
  maxCancelQty: number;
  action: LineCancelAction;
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export function CancellationModal({ so, mode: initialMode, preselectedLineIds, onConfirmFull, onConfirmPartial, onClose }: Props) {
  /* Track whether any active line has partially shipped units (informational) */
  const hasShippedItems = useMemo(() => so.lines.some(l => !l.cancelled && l.shippedQty > 0), [so.lines]);

  /* Compute cancellable lines upfront for disable logic.
     A line is cancellable when it has remaining unshipped, uncancelled qty. */
  const cancellableLinesForCheck = useMemo(() =>
    so.lines.filter(l => !l.cancelled && (l.orderedQty - l.shippedQty - (l.cancelledQty || 0)) > 0),
  [so.lines]);

  /* Partial cancellation is only meaningless when full cancellation is still valid
     and there is no meaningful quantity granularity to choose from. */
  const isPartialMeaningless = useMemo(() => {
    if (cancellableLinesForCheck.length === 0) return true;
    if (hasShippedItems) return false;
    if (cancellableLinesForCheck.length === 1) {
      const line = cancellableLinesForCheck[0];
      const maxQty = line.orderedQty - line.shippedQty - (line.cancelledQty || 0);
      if (maxQty <= 1) return true;
    }
    return false;
  }, [cancellableLinesForCheck, hasShippedItems]);

  /* Full cancellation is blocked once any units have shipped, or when nothing remains cancellable. */
  const isFullBlocked = hasShippedItems || cancellableLinesForCheck.length === 0;
  const fullBlockedReason = hasShippedItems
    ? "Full cancellation is no longer available. Some units on this order have already shipped."
    : "Full cancellation is no longer available. Every line on this order is fully shipped.";

  const effectiveInitialMode = isFullBlocked ? "partial" : isPartialMeaningless ? "full" : initialMode;

  const [mode, setMode] = useState<"full" | "partial">(effectiveInitialMode);
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [reasonText, setReasonText] = useState("");
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    if (isFullBlocked && mode === "full") {
      setMode("partial");
    }
  }, [isFullBlocked, mode]);

  // Line selections — includes lines with partial shipments (unshipped portion is cancellable)
  const cancellableLines = useMemo(() =>
    so.lines.filter(l => !l.cancelled && (l.orderedQty - l.shippedQty - (l.cancelledQty || 0)) > 0),
  [so.lines]);

  const rmaLines = useMemo(() =>
    so.lines.filter(l => !l.cancelled && l.deliveredQty >= l.orderedQty),
  [so.lines]);

  /* Fully shipped lines (all units shipped, not yet delivered) — cannot cancel any portion */
  const nonCancellableLines = useMemo(() =>
    so.lines.filter(l => !l.cancelled && l.shippedQty >= l.orderedQty && l.deliveredQty < l.orderedQty),
  [so.lines]);

  const preselectedSet = useMemo(() => new Set(preselectedLineIds || []), [preselectedLineIds]);

  const initSelections = useCallback((): Record<string, LineSelection> => {
    const sel: Record<string, LineSelection> = {};
    cancellableLines.forEach(line => {
      const action = getLineCancelAction(line, so.status);
      const maxQty = line.orderedQty - line.shippedQty - (line.cancelledQty || 0);
      const isPreselected = preselectedSet.has(line.id);
      sel[line.id] = {
        selected: mode === "full" || isPreselected,
        cancelQty: (mode === "full" || isPreselected) ? Math.max(0, maxQty) : 0,
        maxCancelQty: Math.max(0, maxQty),
        action,
      };
    });
    return sel;
  }, [cancellableLines, mode, so.status, preselectedSet]);

  const [lineSelections, setLineSelections] = useState<Record<string, LineSelection>>(initSelections);

  const handleModeSwitch = (newMode: "full" | "partial") => {
    setMode(newMode);
    const sel: Record<string, LineSelection> = {};
    cancellableLines.forEach(line => {
      const action = getLineCancelAction(line, so.status);
      const maxQty = line.orderedQty - line.shippedQty - (line.cancelledQty || 0);
      sel[line.id] = {
        selected: newMode === "full",
        cancelQty: newMode === "full" ? Math.max(0, maxQty) : 0,
        maxCancelQty: Math.max(0, maxQty),
        action,
      };
    });
    setLineSelections(sel);
  };

  const toggleLine = (id: string) => {
    setLineSelections(prev => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, selected: !cur.selected, cancelQty: !cur.selected ? cur.maxCancelQty : 0 } };
    });
  };

  const setQty = (id: string, qty: number) => {
    setLineSelections(prev => {
      const cur = prev[id];
      if (!cur) return prev;
      const clamped = Math.max(0, Math.min(qty, cur.maxCancelQty));
      return { ...prev, [id]: { ...cur, cancelQty: clamped, selected: clamped > 0 } };
    });
  };

  const toggleAll = () => {
    const allSelected = cancellableLines.every(l => lineSelections[l.id]?.selected);
    setLineSelections(prev => {
      const next = { ...prev };
      cancellableLines.forEach(l => {
        if (next[l.id]) {
          next[l.id] = { ...next[l.id], selected: !allSelected, cancelQty: !allSelected ? next[l.id].maxCancelQty : 0 };
        }
      });
      return next;
    });
  };

  const handleAddAttachment = () => {
    const mockFiles = ["cancellation-request.pdf", "customer-email.eml", "credit-memo-draft.xlsx", "return-authorization.pdf"];
    const next = mockFiles[attachments.length % mockFiles.length];
    if (!attachments.includes(next)) {
      setAttachments(prev => [...prev, next]);
    }
  };

  const handleRemoveAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a !== name));
  };

  // Derived values
  const selectedLines = cancellableLines.filter(l => lineSelections[l.id]?.selected);
  const selectedCount = selectedLines.length;

  const totalCancelValue = selectedLines.reduce((sum, l) => {
    const qty = lineSelections[l.id]?.cancelQty || 0;
    return sum + qty * l.unitPrice;
  }, 0);

  const totalAllocToRelease = selectedLines.reduce((sum, l) => {
    const sel = lineSelections[l.id];
    if (!sel || sel.action === "intercept" || sel.action === "rma") return sum;
    return sum + l.allocations.filter(a => !a.locked).reduce((s, a) => s + a.qty, 0);
  }, 0);

  const totalPickedPutBack = selectedLines.reduce((sum, l) => {
    const sel = lineSelections[l.id];
    if (!sel || sel.action !== "put-back") return sum;
    return sum + l.pickedQty;
  }, 0);

  const totalShippedIntercept = selectedLines.reduce((sum, l) => {
    const sel = lineSelections[l.id];
    if (!sel || sel.action !== "intercept") return sum;
    return sum + l.shippedQty;
  }, 0);

  const hasInterceptLines = selectedLines.some(l => lineSelections[l.id]?.action === "intercept");
  const hasPutBackLines = selectedLines.some(l => lineSelections[l.id]?.action === "put-back");
  const hasHaltPickLines = selectedLines.some(l => lineSelections[l.id]?.action === "halt-pick");

  const reasonValid = reason !== "" && (reason !== "Other" || reasonText.trim().length > 0);
  const canReview = mode === "full" ? (!isFullBlocked && reasonValid) : (selectedCount > 0 && reasonValid);

  const reasonLabel = REASON_OPTIONS.find(r => r.value === reason)?.label || "";

  // Discard guard — dirty when user has entered any meaningful data
  const isDirty = reason !== "" || reasonText.length > 0 || attachments.length > 0 || (mode === "partial" && selectedCount > 0);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  const handleConfirm = () => {
    if (!reason) return;
    if (mode === "full" && isFullBlocked) return;
    if (mode === "full") {
      onConfirmFull(reason as CancellationReason, reasonText);
    } else {
      const lineIds = selectedLines.map(l => l.id);
      const cancelQtys: Record<string, number> = {};
      selectedLines.forEach(l => { cancelQtys[l.id] = lineSelections[l.id]?.cancelQty || 0; });
      onConfirmPartial(lineIds, cancelQtys, reason as CancellationReason, reasonText);
    }
    onClose();
  };

  useModalShortcuts({
    onConfirm: () => { if (!showConfirmDialog && canReview) setShowConfirmDialog(true); },
    onClose: showConfirmDialog ? () => setShowConfirmDialog(false) : guardedClose,
    confirmDisabled: !canReview,
  });

  const allSelected = cancellableLines.length > 0 && cancellableLines.every(l => lineSelections[l.id]?.selected);
  const someSelected = cancellableLines.some(l => lineSelections[l.id]?.selected) && !allSelected;

  /* ═══ Line Item Card ═══ */
  const renderLineCard = (line: SOLine, selectable: boolean) => {
    const sel = lineSelections[line.id];
    const action = sel?.action || getLineCancelAction(line, so.status);
    const actionMeta = ACTION_LABELS[action];
    const isSelected = sel?.selected || false;
    const cancelProgress = sel?.maxCancelQty ? Math.round((sel.cancelQty / sel.maxCancelQty) * 100) : 0;
    const progressTone = cancelProgress >= 100 ? "bg-destructive" : cancelProgress >= 50 ? "bg-chart-3" : "bg-primary";
    

    return (
      <div
        key={line.id}
        className={`rounded-lg border transition-all ${
          isSelected ? "border-destructive/30 bg-destructive/[0.03]" : "border-border hover:border-border"
        } ${selectable ? "cursor-pointer" : ""}`}
        style={{ boxShadow: "var(--elevation-0)" }}
        onClick={selectable ? () => toggleLine(line.id) : undefined}
      >
        <div style={{ padding: "12px 16px" }} className="flex items-start gap-3">
          {/* Checkbox */}
          {selectable && (
            <div
              className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                isSelected ? "bg-destructive border-destructive" : "bg-card border-2 border-border"
              }`}
              style={{ borderRadius: "calc(var(--radius) - 6px)" }}
            >
              {isSelected && <Check className="w-3 h-3 text-destructive-foreground" strokeWidth={3} />}
            </div>
          )}

          {/* Thumbnail */}
          <div className="shrink-0 flex items-center justify-center bg-secondary/70 rounded-md" style={{ width: 36, height: 36 }}>
            <Package className="text-foreground/15" style={{ width: 16, height: 16 }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
              <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>{line.itemCode}</span>
              <InactiveItemPill code={line.itemCode} size="md" />
              <ItemTypeBadge type={line.itemType} />
            </div>

            {/* Description with proper overflow detection "more >>" */}
            <ItemDescription text={line.itemName} maxLines={2} />

            {/* Stats row — Allocated / Picked / Shipped */}
            <div className="text-foreground/50 mt-1" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
              Allocated: {line.allocatedQty} · Picked: {line.pickedQty} · Shipped: {line.shippedQty}
            </div>

            {/* Shipped-vs-unshipped breakdown for partially shipped lines.
                Shipped units have already left the warehouse, so only the
                unshipped balance can be cancelled here. */}
            {line.shippedQty > 0 && line.shippedQty < line.orderedQty && (
              <div className="flex items-center gap-1.5 mt-1.5 rounded" style={{ fontSize: "var(--text-small)", padding: "3px 8px", backgroundColor: "rgba(245, 158, 11, 0.08)" }}>
                <Truck style={{ width: 11, height: 11, flexShrink: 0, color: "#92400E" }} />
                <span style={{ color: "#78350F", fontWeight: "var(--font-weight-medium)" }}>
                  {line.shippedQty} already shipped · {line.orderedQty - line.shippedQty} still unshipped and cancellable
                </span>
              </div>
            )}

            {/* Action description — subtle inline with icon */}
            {action !== "void" && action !== "none" && (
              <div className="flex items-center gap-1.5 mt-1.5 rounded" style={{ fontSize: "var(--text-small)", padding: "3px 8px", backgroundColor: "rgba(10, 119, 255, 0.05)" }}>
                <actionMeta.icon style={{ width: 11, height: 11, flexShrink: 0, color: "#1E40AF" }} />
                <span style={{ color: "#1E3A5F", fontWeight: "var(--font-weight-medium)" }}>{actionMeta.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Qty adjuster — only show when selected & >1 possible */}
        {selectable && isSelected && sel && sel.maxCancelQty > 1 && (
          <div
            className="border-t border-border/50 mx-4"
            style={{ padding: "8px 0 10px 0" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-foreground/50 shrink-0" style={captionStyle}>Cancel qty:</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  onClick={() => setQty(line.id, sel.cancelQty - 1)}
                  className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-secondary"
                  style={{ background: "var(--card)" }}
                >
                  <Minus className="w-3 h-3 text-foreground/70" />
                </button>
                <input
                  type="number"
                  value={sel.cancelQty}
                  onChange={e => setQty(line.id, parseInt(e.target.value) || 0)}
                  className="w-14 h-6 text-center border border-border rounded text-foreground bg-card outline-none focus:ring-1 focus:ring-ring"
                  style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
                  min={0}
                  max={sel.maxCancelQty}
                />
                <button
                  onClick={() => setQty(line.id, sel.cancelQty + 1)}
                  className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-secondary"
                  style={{ background: "var(--card)" }}
                >
                  <Plus className="w-3 h-3 text-foreground/70" />
                </button>
                <span className="text-foreground/50 ml-1" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>of {sel.maxCancelQty} EA</span>
                <span className="text-foreground/50 ml-auto" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                  ${(sel.cancelQty * line.unitPrice).toLocaleString()}
                </span>
              </div>
            </div>
            {/* Inline progress bar */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-[6px] overflow-hidden rounded-full bg-secondary">
                <div className={`${progressTone} h-full rounded-full transition-all`} style={{ width: `${cancelProgress}%` }} />
              </div>
              <span className="text-foreground/60 shrink-0" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-semibold)", minWidth: 32, textAlign: "right" }}>{cancelProgress}%</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ═══ Main Modal ═══ */}
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
        <div
          className="relative bg-card rounded-xl border border-border flex flex-col overflow-hidden"
          style={{
            width: 920,
            height: "min(calc(100vh - 64px), 860px)",
            boxShadow: "var(--elevation-3)",
          }}
        >

          {/* Header — Quotes canonical warn variant: 32px chip with warning/20 bg, 14px title, 11px subtitle. */}
          <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: "16px 20px" }}>
            <div className="flex items-center gap-3">
              <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: "rgba(217, 119, 6, 0.18)" }}>
                <Ban style={{ width: 16, height: 16, color: "var(--warning)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>
                  Cancel Sales Order
                </h3>
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4, margin: 0 }}>
                  {so.soNumber} · {so.customer}
                </p>
              </div>
            </div>
            <button
              onClick={guardedClose}
              className="rounded-md flex items-center justify-center transition-colors"
              style={{ width: 28, height: 28, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <X style={{ width: 16, height: 16, color: "var(--muted-foreground)" }} />
            </button>
          </div>

          {/* ══ Body — Split Panel ══ */}
          <div className="flex flex-1 overflow-hidden">

            {/* ═══ LEFT — Line Items ═══ */}
            <div className="flex-1 flex flex-col border-r border-border min-w-0">
              {/* Mode Toggle — modern card-style toggles with descriptions */}
              <div style={{ padding: "12px 16px 0 16px" }}>
                <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12 }}>
                  {/* Full cancellation card */}
                  <button
                    onClick={() => !isFullBlocked && handleModeSwitch("full")}
                    className={`flex items-start gap-2.5 rounded-lg border transition-all text-left ${
                      isFullBlocked
                        ? "border-border bg-secondary/30 text-foreground/25 cursor-not-allowed opacity-50"
                        : mode === "full"
                          ? "border-destructive/30 bg-destructive/[0.04]"
                          : "border-border bg-card hover:border-foreground/15"
                    }`}
                    style={{ padding: "10px 12px" }}
                    disabled={isFullBlocked}
                    title={isFullBlocked ? fullBlockedReason : undefined}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        mode === "full" && !isFullBlocked ? "border-destructive bg-destructive" : "border-border"
                      }`}
                    >
                      {mode === "full" && !isFullBlocked && <div className="w-1.5 h-1.5 rounded-full bg-destructive-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Ban style={{ width: 12, height: 12, flexShrink: 0, color: mode === "full" && !isFullBlocked ? "var(--destructive)" : "currentColor" }} />
                        <span style={{ ...captionStyle, fontWeight: mode === "full" && !isFullBlocked ? "var(--font-weight-semibold)" : "var(--font-weight-medium)", color: mode === "full" && !isFullBlocked ? "var(--destructive)" : "currentColor" }}>
                          Cancel Entire Order
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-small)", lineHeight: 1.35 }}>
                        {hasShippedItems ? "Not available once any units on the order have shipped." : "Cancel every line and void the order."}
                      </div>
                    </div>
                  </button>

                  {/* Partial cancellation card */}
                  <button
                    onClick={() => !isPartialMeaningless && handleModeSwitch("partial")}
                    className={`flex items-start gap-2.5 rounded-lg border transition-all text-left ${
                      isPartialMeaningless
                        ? "border-border bg-secondary/30 text-foreground/25 cursor-not-allowed opacity-50"
                        : mode === "partial"
                          ? "border-chart-3/30 bg-chart-3/[0.04]"
                          : "border-border bg-card hover:border-foreground/15"
                    }`}
                    style={{ padding: "10px 12px" }}
                    disabled={isPartialMeaningless}
                    title={isPartialMeaningless ? "Partial cancellation is not available. This order has only one cancellable line with a single unit left." : undefined}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        mode === "partial" && !isPartialMeaningless ? "border-chart-3 bg-chart-3" : "border-border"
                      }`}
                    >
                      {mode === "partial" && !isPartialMeaningless && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--card)" }} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Package style={{ width: 12, height: 12, flexShrink: 0, color: mode === "partial" && !isPartialMeaningless ? "var(--chart-3)" : "currentColor" }} />
                        <span style={{ ...captionStyle, fontWeight: mode === "partial" && !isPartialMeaningless ? "var(--font-weight-semibold)" : "var(--font-weight-medium)", color: mode === "partial" && !isPartialMeaningless ? "var(--chart-3)" : "currentColor" }}>
                          Partial Cancellation
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-small)", lineHeight: 1.35 }}>
                        {isPartialMeaningless
                          ? "Not available. Only one cancellable unit remains."
                          : "Pick specific lines and quantities to cancel."
                        }
                      </div>
                    </div>
                  </button>
                </div>

                {/* Informational banner shown whenever any units have left
                    the warehouse. Shipped units are out of our hands at
                    this point; only the unshipped balance is cancellable. */}
                {hasShippedItems && (
                  <div className="flex items-start gap-2 rounded-lg" style={{ padding: "8px 12px", marginBottom: 12, backgroundColor: "rgba(245, 158, 11, 0.06)" }}>
                    <Truck className="shrink-0 mt-0.5" style={{ width: 13, height: 13, color: "#92400E" }} />
                    <span style={{ fontSize: "var(--text-small)", color: "#78350F", fontWeight: "var(--font-weight-medium)" }}>
                      Only items that have not been shipped can be cancelled. Any units already shipped remain on the order and need to go through Returns instead.
                    </span>
                  </div>
                )}

                {/* Partial meaningless note */}
                {isPartialMeaningless && !hasShippedItems && (
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30" style={{ padding: "8px 12px", marginBottom: 12 }}>
                    <Info className="text-muted-foreground shrink-0 mt-0.5" style={{ width: 13, height: 13 }} />
                    <span className="text-foreground/50" style={{ fontSize: "var(--text-small)" }}>
                      Partial cancellation is not available. This order has only one cancellable line with a single unit left.
                    </span>
                  </div>
                )}

                {/* Line Items header with left-aligned checkbox */}
                <div className="flex items-center" style={{ marginBottom: 8, gap: "var(--space-inline-gap)" }}>
                  {mode === "partial" && (
                    <div
                      onClick={toggleAll}
                      className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        allSelected ? "bg-destructive border-destructive" : someSelected ? "bg-destructive/50 border-destructive/50" : "bg-card border-2 border-border hover:border-foreground/20"
                      }`}
                      style={{ borderRadius: "calc(var(--radius) - 6px)" }}
                    >
                      {allSelected && <Check className="w-3 h-3 text-destructive-foreground" strokeWidth={3} />}
                      {someSelected && !allSelected && <Minus className="w-3 h-3 text-destructive-foreground" strokeWidth={3} />}
                    </div>
                  )}
                  <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>Line Items</span>
                  <span className="text-muted-foreground" style={smallStyle}>({cancellableLines.length} cancellable)</span>
                </div>
              </div>

              {/* Scrollable card list */}
              <div className="flex-1 overflow-y-auto scroll-hover" style={{ padding: "0 16px 16px 16px" }}>
                {cancellableLines.length === 0 && (
                  <div className="text-center text-muted-foreground" style={{ ...captionNormal, padding: "48px 0" }}>
                    No lines are eligible for cancellation. Every line on this order has already shipped in full.
                  </div>
                )}

                <div className="space-y-2">
                  {cancellableLines.map(line => renderLineCard(line, mode === "partial"))}
                </div>

                {/* Non-cancellable shipped lines */}
                {nonCancellableLines.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                      <Truck className="text-foreground/25 shrink-0" style={{ width: 13, height: 13 }} />
                      <span className="text-muted-foreground" style={captionStyle}>Already shipped, cannot be cancelled ({nonCancellableLines.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {nonCancellableLines.map(line => (
                        <div key={line.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary" style={{ padding: "8px 16px", opacity: 0.55 }}>
                          <Truck className="text-muted-foreground shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-foreground/50 truncate flex-1" style={captionNormal}>
                            {line.itemCode} · {line.shippedQty} of {line.orderedQty} shipped
                          </span>
                          <span className="text-muted-foreground shrink-0" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
                            Not cancellable
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RMA-only lines */}
                {rmaLines.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                      <span className="text-muted-foreground" style={captionStyle}>Already delivered, use Returns ({rmaLines.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {rmaLines.map(line => (
                        <div key={line.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary opacity-60" style={{ padding: "8px 16px" }}>
                          <ArrowRight className="text-chart-4 shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-foreground/50 truncate flex-1" style={captionNormal}>
                            {line.itemCode} · delivered in full ({line.deliveredQty} of {line.orderedQty})
                          </span>
                          <button className="text-chart-4 hover:underline shrink-0" style={{ ...captionStyle, fontSize: "var(--text-small)", color: "var(--chart-4)", background: "none", border: "none", cursor: "pointer" }}>
                            Create RMA →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ RIGHT — Configuration Panel ═══ */}
            <div className="flex flex-col" style={{ width: 320 }}>
              <div className="flex-1 overflow-y-auto scroll-hover" style={{ padding: 16 }}>

                {/* Reason Picker */}
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-1" style={{ marginBottom: 6 }}>
                    <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>Cancellation Reason</span>
                    <span className="text-destructive" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>REQUIRED</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setReasonDropdownOpen(!reasonDropdownOpen)}
                      className={`w-full flex items-center justify-between border rounded-lg transition-colors bg-card ${
                        reason ? "border-border text-foreground" : "border-destructive/30 text-muted-foreground"
                      }`}
                      style={{ ...captionNormal, padding: "8px 12px", fontWeight: reason ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}
                    >
                      <span className="truncate text-left">{reason ? reasonLabel : "Select a reason..."}</span>
                      <ChevronDown className={`text-muted-foreground shrink-0 transition-transform ${reasonDropdownOpen ? "rotate-180" : ""}`} style={{ width: 14, height: 14 }} />
                    </button>
                    {reasonDropdownOpen && (
                      <>
                        <div className="fixed inset-0" style={{ zIndex: "var(--z-overlay)" }} onClick={() => setReasonDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg py-1 overflow-y-auto" style={{ zIndex: "var(--z-popover)", boxShadow: "var(--elevation-2)", maxHeight: 320 }}>
                          {REASON_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setReason(opt.value); setReasonDropdownOpen(false); }}
                              className={`w-full text-left flex items-start gap-2.5 hover:bg-secondary transition-colors ${
                                reason === opt.value ? "text-primary bg-primary/5" : "text-foreground/80"
                              }`}
                              style={{ padding: "8px 12px" }}
                            >
                              <opt.icon className="text-muted-foreground shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
                              <div className="flex-1 min-w-0">
                                <div style={{ ...captionNormal, fontWeight: reason === opt.value ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}>
                                  {opt.label}
                                </div>
                                <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-small)" }}>
                                  {opt.description}
                                </div>
                              </div>
                              {reason === opt.value && <Check className="text-primary shrink-0 mt-0.5" style={{ width: 12, height: 12 }} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {reason === "Other" && (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        value={reasonText}
                        onChange={e => setReasonText(e.target.value)}
                        placeholder="Please describe the reason..."
                        className={`w-full rounded-lg text-foreground placeholder-foreground/35 outline-none focus:ring-2 resize-none transition-colors ${
                          reasonText.trim().length === 0 ? "focus:ring-destructive/30" : "focus:ring-ring"
                        }`}
                        style={{
                          ...captionNormal,
                          padding: "8px 12px",
                          border: reasonText.trim().length === 0 ? "1px solid var(--destructive)" : "1px solid var(--border)",
                          backgroundColor: reasonText.trim().length === 0 ? "rgba(255, 69, 58, 0.04)" : "var(--input-background)",
                        }}
                        rows={2}
                      />
                      {reasonText.trim().length === 0 && (
                        <div className="text-destructive flex items-center gap-1" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", marginTop: 4 }}>
                          <AlertTriangle style={{ width: 10, height: 10, flexShrink: 0 }} />
                          <span>Please provide a reason</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Attachments (optional) */}
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-1" style={{ marginBottom: 6 }}>
                    <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>Attachments</span>
                    <span className="text-muted-foreground" style={{ fontSize: "var(--text-small)" }}>optional</span>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-1.5" style={{ marginBottom: 8 }}>
                      {attachments.map(name => (
                        <div key={name} className="flex items-center gap-2 border border-border rounded-md bg-secondary/50" style={{ padding: "6px 10px" }}>
                          <Paperclip className="text-muted-foreground shrink-0" style={{ width: 12, height: 12 }} />
                          <span className="truncate flex-1 text-foreground/70" style={{ fontSize: "var(--text-small)" }}>{name}</span>
                          <button
                            onClick={() => handleRemoveAttachment(name)}
                            className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleAddAttachment}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground/60"
                    style={{ ...captionNormal, padding: "10px 12px" }}
                  >
                    <Upload style={{ width: 14, height: 14 }} />
                    <span>Attach supporting file</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-border" style={{ marginBottom: 16 }} />

                {/* Impact Summary */}
                <div style={{ marginBottom: 16 }}>
                  <div className="text-foreground" style={{ ...microStyle, opacity: 0.5, marginBottom: 8, letterSpacing: "0.05em" }}>IMPACT SUMMARY</div>

                  {selectedCount === 0 ? (
                    <div className="text-muted-foreground text-center" style={{ ...captionNormal, padding: "24px 0" }}>
                      {mode === "partial" ? "Select line items to see impact" : "No cancellable lines"}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Lines count */}
                      <div className="flex items-center gap-2" style={captionNormal}>
                        <Ban className="text-muted-foreground shrink-0" style={{ width: 14, height: 14 }} />
                        <span className="text-foreground/70">
                          <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)" }}>{selectedCount}</span> line(s) to cancel
                        </span>
                      </div>

                      {/* Inventory release */}
                      {totalAllocToRelease > 0 && (
                        <div className="flex items-center gap-2" style={captionNormal}>
                          <Package className="text-primary shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-foreground/70">
                            <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)" }}>{totalAllocToRelease}</span> allocated units released
                          </span>
                        </div>
                      )}

                      {/* Put-back */}
                      {totalPickedPutBack > 0 && (
                        <div className="flex items-center gap-2" style={captionNormal}>
                          <RotateCcw className="text-chart-3 shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-foreground/70">
                            <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)" }}>{totalPickedPutBack}</span> already picked, put-back required
                          </span>
                        </div>
                      )}

                      {/* Intercept */}
                      {totalShippedIntercept > 0 && (
                        <div className="flex items-center gap-2" style={captionNormal}>
                          <Truck className="text-destructive shrink-0" style={{ width: 14, height: 14 }} />
                          <span className="text-foreground/70">
                            <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)" }}>{totalShippedIntercept}</span> already shipped, carrier intercept requested
                          </span>
                        </div>
                      )}

                      {totalAllocToRelease === 0 && totalPickedPutBack === 0 && totalShippedIntercept === 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground" style={captionNormal}>
                          <Info className="shrink-0" style={{ width: 14, height: 14 }} />
                          <span>No inventory impact</span>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Financial */}
                      <div className="flex items-center justify-between" style={captionNormal}>
                        <span className="text-foreground/50">Cancellation value</span>
                        <span className="text-destructive" style={{ fontWeight: "var(--font-weight-semibold)" }}>
                          -${totalCancelValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Warnings — only Carrier Intercept shown here; Warehouse Put-Back moved to confirmation */}
                {hasInterceptLines && (
                  <div className="flex items-start gap-3 rounded-lg border border-border overflow-hidden" style={{ marginBottom: 12 }}>
                    <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: "var(--destructive)" }} />
                    <div style={{ padding: "10px 12px 10px 0" }}>
                      <div className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
                        <Truck style={{ width: 12, height: 12, color: "var(--destructive)" }} />
                        <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>Carrier Intercept</span>
                      </div>
                      <div className="text-foreground/50" style={smallStyle}>
                        For units that have already shipped, we will request a carrier intercept. The carrier is not guaranteed to catch the shipment before delivery.
                      </div>
                    </div>
                  </div>
                )}

                {hasHaltPickLines && (
                  <div className="flex items-start gap-3 rounded-lg border border-border overflow-hidden" style={{ marginBottom: 12 }}>
                    <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: "var(--chart-3)" }} />
                    <div style={{ padding: "10px 12px 10px 0" }}>
                      <div className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
                        <Warehouse style={{ width: 12, height: 12, color: "var(--chart-3)" }} />
                        <span className="text-foreground" style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}>Halt Picking</span>
                      </div>
                      <div className="text-foreground/50" style={smallStyle}>
                        Cancellation request sent to warehouse to halt picking operations for affected items.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ Footer ══ */}
          <div className="flex items-center justify-between shrink-0 border-t border-border bg-secondary" style={{ padding: "12px 20px" }}>
            <div className="text-foreground/50" style={captionNormal}>
              {selectedCount} of {cancellableLines.length} lines · ${totalCancelValue.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
                Keep Order <KbdHint keys="Esc" />
              </Button>
              <DisabledCTATooltip
                disabled={!canReview}
                reason={!reason ? "A cancellation reason is required" : mode === "partial" && selectedCount === 0 ? "Select at least one line item to cancel" : ""}
                action={!reason ? "Choose a reason from the dropdown above." : "Select lines from the left panel."}
              >
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!canReview}
                  icon={<Ban className="w-3.5 h-3.5" />}
                  className="shadow-sm hover:shadow-md active:translate-y-px active:shadow-sm transition-all disabled:shadow-none"
                >
                  {mode === "full"
                    ? "Cancel entire sales order"
                    : `Cancel ${selectedCount} line item${selectedCount !== 1 ? "s" : ""}`}
                  <KbdHint keys="⌘↵" variant="light" />
                </Button>
              </DisabledCTATooltip>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Confirmation Dialog ═══ */}
      <CancellationConfirmDialog
        open={showConfirmDialog}
        selectedCount={selectedCount}
        onConfirm={handleConfirm}
        onClose={() => setShowConfirmDialog(false)}
        effects={[
          ...(totalAllocToRelease > 0 ? [{ icon: <Package style={{ width: 14, height: 14, color: "var(--primary)", flexShrink: 0 }} />, label: `${totalAllocToRelease} allocated units will be released back to stock` }] : []),
          ...(totalPickedPutBack > 0 ? [{ icon: <RotateCcw style={{ width: 14, height: 14, color: "var(--chart-3)", flexShrink: 0 }} />, label: `${totalPickedPutBack} picked items require warehouse put-back` }] : []),
          ...(totalShippedIntercept > 0 ? [{ icon: <Truck style={{ width: 14, height: 14, color: "var(--destructive)", flexShrink: 0 }} />, label: `${totalShippedIntercept} already shipped, carrier intercept requested` }] : []),
          { icon: <Ban style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.4, flexShrink: 0 }} />, label: "SO status will update based on remaining active lines" },
        ]}
      />

      {/* ═══ Discard Dialog ═══ */}
      {discardDialog}
    </>
  );
}