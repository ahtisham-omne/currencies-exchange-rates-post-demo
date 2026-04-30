import { useState, useMemo } from "react";
import {
  X, Send, Lock, Ban, AlertTriangle, ChevronDown, ChevronUp,
  Package, Info, Check, User, FileText, DollarSign, Calendar,
  CreditCard, ShieldAlert, Search, XOctagon, Scale,
  Paperclip, Upload,
} from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { SOStatusBadge } from "./StatusBadge";
import type { SalesOrder, CancellationReason } from "./types";

/* ═══════════════════════════════════════════════════════
   Shared styles — design system tokens only
   ═══════════════════════════════════════════════════════ */

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-weight-semibold)",
  color: "var(--foreground)",
};
const captionStyle: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-medium)",
};
const captionNormal: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-normal)",
};
const microLabel: React.CSSProperties = {
  fontSize: "var(--text-micro)",
  fontWeight: "var(--font-weight-medium)",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "var(--foreground)",
  opacity: 0.5,
};
const smallStyle: React.CSSProperties = {
  fontSize: "var(--text-small)",
  fontWeight: "var(--font-weight-normal)",
};

/* ═══════════════════════════════════════════════════════
   Shared expandable order row
   ═══════════════════════════════════════════════════════ */
function OrderAccordionRow({
  so,
  expandedSO,
  setExpandedSO,
}: {
  so: SalesOrder;
  expandedSO: string | null;
  setExpandedSO: (id: string | null) => void;
}) {
  const activeLines = so.lines.filter(l => !l.cancelled);
  const soSubtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const isExpanded = expandedSO === so.id;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setExpandedSO(isExpanded ? null : so.id)}
        className="w-full flex items-center hover:bg-secondary/50 transition-colors"
        style={{ padding: "10px 16px", gap: "var(--space-inline-gap)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span style={{ ...captionStyle, color: "var(--primary)" }}>{so.soNumber}</span>
          <span className="truncate" style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.6 }}>
            {so.customer}
          </span>
        </div>
        <SOStatusBadge status={so.status} />
        <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
          {activeLines.length} item{activeLines.length !== 1 ? "s" : ""}
        </span>
        <span style={{ ...captionStyle, color: "var(--foreground)" }}>
          ${soSubtotal.toLocaleString()}
        </span>
        {isExpanded
          ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--foreground)", opacity: 0.4 }} />
          : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--foreground)", opacity: 0.4 }} />}
      </button>
      {isExpanded && (
        <div style={{ padding: "0 16px 10px 16px" }}>
          <div
            className="grid border-b border-border"
            style={{
              gridTemplateColumns: "100px 1fr 50px 90px",
              ...microLabel,
              padding: "4px 0",
            }}
          >
            <span>ITEM #</span><span>DESCRIPTION</span>
            <span className="text-center">QTY</span><span className="text-right">TOTAL</span>
          </div>
          {activeLines.map(line => (
            <div
              key={line.id}
              className="grid items-center border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: "100px 1fr 50px 90px", ...captionNormal, padding: "6px 0" }}
            >
              <span style={{ color: "var(--primary)", fontWeight: "var(--font-weight-medium)" }}>{line.itemCode}</span>
              <span className="truncate pr-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>{line.itemName}</span>
              <span className="text-center" style={{ color: "var(--foreground)" }}>{line.orderedQty}</span>
              <span className="text-right" style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>
                ${(line.orderedQty * line.unitPrice).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   1) Bulk Submit for Review Modal
   ═══════════════════════════════════════════════════════ */

interface BulkSubmitProps {
  orders: SalesOrder[];
  onConfirm: (soIds: string[]) => void;
  onClose: () => void;
}

export function BulkSubmitForReviewModal({ orders, onConfirm, onClose }: BulkSubmitProps) {
  const [expandedSO, setExpandedSO] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const eligible = useMemo(
    () => orders.filter(so => so.status === "Draft"),
    [orders],
  );
  const skipped = orders.length - eligible.length;

  const totalLines = eligible.reduce((s, so) => s + so.lines.filter(l => !l.cancelled).length, 0);
  const grandTotal = eligible.reduce(
    (s, so) => s + so.lines.filter(l => !l.cancelled).reduce((ls, l) => ls + l.orderedQty * l.unitPrice, 0),
    0,
  );

  const doConfirm = () => onConfirm(eligible.map(so => so.id));
  useModalShortcuts({ onConfirm: doConfirm, onClose });

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className="relative bg-card rounded-lg border border-border w-full max-w-[680px] max-h-[90vh] flex flex-col"
        style={{ boxShadow: "var(--elevation-3)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: "16px 24px" }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg flex items-center justify-center bg-primary/10"
              style={{ width: 36, height: 36 }}
            >
              <Send className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={labelStyle}>Submit for Review</div>
              <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
                {eligible.length} draft order{eligible.length !== 1 ? "s" : ""} will move to Pending Review
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.5 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          {/* Warning for skipped */}
          {skipped > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-chart-3/10" style={{ padding: "10px 16px" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-chart-3" />
              <div style={{ ...captionNormal, color: "var(--foreground)" }}>
                <span style={{ fontWeight: "var(--font-weight-medium)" }}>{skipped}</span> order{skipped !== 1 ? "s" : ""} skipped
                — only Draft orders can be submitted for review.
              </div>
            </div>
          )}

          {/* Orders list */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary" style={{ padding: "10px 16px" }}>
              <span style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                Orders to Submit ({eligible.length})
              </span>
              <span
                className="rounded bg-primary/10 text-primary"
                style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", padding: "2px 8px" }}
              >
                ${grandTotal.toLocaleString()}
              </span>
            </div>
            {eligible.map(so => (
              <OrderAccordionRow
                key={so.id}
                so={so}
                expandedSO={expandedSO}
                setExpandedSO={setExpandedSO}
              />
            ))}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 6 }}>
              <span style={microLabel}>NOTES</span>
              <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.35 }}>(optional)</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Batch submission for Q2 orders — reviewed by Sales Manager"
              className="w-full border border-border rounded-md focus:outline-none transition-colors resize-none"
              style={{ padding: "8px 12px", ...captionNormal, color: "var(--foreground)", background: "var(--input-background)" }}
              rows={2}
            />
          </div>

          {/* Info */}
          <div
            className="border border-border rounded-md"
            style={{ background: "var(--secondary)", padding: "12px var(--space-card-padding)", ...captionNormal, color: "var(--foreground)", opacity: 0.7 }}
          >
            Submitting will move{" "}
            <span style={{ fontWeight: "var(--font-weight-semibold)", opacity: 1, color: "var(--foreground)" }}>
              {eligible.length} order{eligible.length !== 1 ? "s" : ""}
            </span>{" "}
            ({totalLines} line item{totalLines !== 1 ? "s" : ""}) from Draft to Pending Review. They will appear in the review queue for Operations clearance.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between shrink-0 border-t border-border" style={{ padding: "12px 24px" }}>
          <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
            {eligible.length} order{eligible.length !== 1 ? "s" : ""} &middot; {totalLines} items &middot; ${grandTotal.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="primary" size="sm" onClick={doConfirm} disabled={eligible.length === 0} icon={<Send className="w-3.5 h-3.5" />}>
              Submit {eligible.length} Order{eligible.length !== 1 ? "s" : ""}
              <KbdHint keys="&#8984;&#9166;" variant="light" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   2) Bulk Close Orders Modal
   ═══════════════════════════════════════════════════════ */

interface BulkCloseProps {
  orders: SalesOrder[];
  onConfirm: (soIds: string[]) => void;
  onClose: () => void;
}

export function BulkCloseOrdersModal({ orders, onConfirm, onClose }: BulkCloseProps) {
  const [expandedSO, setExpandedSO] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const eligible = useMemo(
    () => orders.filter(so => so.status === "Shipped" || so.status === "Partially Shipped"),
    [orders],
  );
  const skipped = orders.length - eligible.length;
  const partialCount = eligible.filter(so => so.status === "Partially Shipped").length;

  const totalLines = eligible.reduce((s, so) => s + so.lines.filter(l => !l.cancelled).length, 0);
  const grandTotal = eligible.reduce(
    (s, so) => s + so.lines.filter(l => !l.cancelled).reduce((ls, l) => ls + l.orderedQty * l.unitPrice, 0),
    0,
  );

  const doConfirm = () => onConfirm(eligible.map(so => so.id));
  useModalShortcuts({ onConfirm: doConfirm, onClose });

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className="relative bg-card rounded-lg border border-border w-full max-w-[680px] max-h-[90vh] flex flex-col"
        style={{ boxShadow: "var(--elevation-3)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: "16px 24px" }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg flex items-center justify-center bg-chart-4/10"
              style={{ width: 36, height: 36 }}
            >
              <Lock className="text-chart-4" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={labelStyle}>Close Sales Orders</div>
              <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
                {eligible.length} order{eligible.length !== 1 ? "s" : ""} will be permanently closed
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.5 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          {/* Warning for skipped */}
          {skipped > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-chart-3/10" style={{ padding: "10px 16px" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-chart-3" />
              <div style={{ ...captionNormal, color: "var(--foreground)" }}>
                <span style={{ fontWeight: "var(--font-weight-medium)" }}>{skipped}</span> order{skipped !== 1 ? "s" : ""} skipped
                — only Shipped or Partially Shipped orders can be closed.
              </div>
            </div>
          )}

          {/* Partial shipment warning */}
          {partialCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-chart-3/20 bg-chart-3/5" style={{ padding: "10px 16px" }}>
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-chart-3" />
              <div style={{ ...captionNormal, color: "var(--foreground)" }}>
                <span style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--chart-3)" }}>{partialCount}</span> order{partialCount !== 1 ? "s have" : " has"} partial
                shipments. Closing will finalize them as-is — unshipped quantities will not be fulfilled.
              </div>
            </div>
          )}

          {/* Orders list */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary" style={{ padding: "10px 16px" }}>
              <span style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                Orders to Close ({eligible.length})
              </span>
              <span
                className="rounded bg-chart-4/10 text-chart-4"
                style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", padding: "2px 8px" }}
              >
                ${grandTotal.toLocaleString()}
              </span>
            </div>
            {eligible.map(so => (
              <OrderAccordionRow
                key={so.id}
                so={so}
                expandedSO={expandedSO}
                setExpandedSO={setExpandedSO}
              />
            ))}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 6 }}>
              <span style={microLabel}>NOTES</span>
              <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.35 }}>(optional)</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., End-of-month close — all shipments confirmed by warehouse"
              className="w-full border border-border rounded-md focus:outline-none transition-colors resize-none"
              style={{ padding: "8px 12px", ...captionNormal, color: "var(--foreground)", background: "var(--input-background)" }}
              rows={2}
            />
          </div>

          {/* Info */}
          <div
            className="border border-border rounded-md"
            style={{ background: "var(--secondary)", padding: "12px var(--space-card-padding)", ...captionNormal, color: "var(--foreground)", opacity: 0.7 }}
          >
            Closing is permanent.{" "}
            <span style={{ fontWeight: "var(--font-weight-semibold)", opacity: 1, color: "var(--foreground)" }}>
              {eligible.length} order{eligible.length !== 1 ? "s" : ""}
            </span>{" "}
            ({totalLines} line item{totalLines !== 1 ? "s" : ""}, ${grandTotal.toLocaleString()}) will be marked as Closed and locked from further edits.
            Closed orders can still be archived.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between shrink-0 border-t border-border" style={{ padding: "12px 24px" }}>
          <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
            {eligible.length} order{eligible.length !== 1 ? "s" : ""} &middot; {totalLines} items &middot; ${grandTotal.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="primary" size="sm" onClick={doConfirm} disabled={eligible.length === 0} icon={<Lock className="w-3.5 h-3.5" />}>
              Close {eligible.length} Order{eligible.length !== 1 ? "s" : ""}
              <KbdHint keys="&#8984;&#9166;" variant="light" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   3) Bulk Cancellation Modal
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

const NON_CANCELLABLE = ["Cancelled", "Archived"];

interface BulkCancelProps {
  orders: SalesOrder[];
  onConfirm: (soIds: string[], reason: CancellationReason, reasonText: string) => void;
  onClose: () => void;
}

export function BulkCancellationModal({ orders, onConfirm, onClose }: BulkCancelProps) {
  const [expandedSO, setExpandedSO] = useState<string | null>(null);
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [reasonText, setReasonText] = useState("");
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const eligible = useMemo(
    () => orders.filter(so => !NON_CANCELLABLE.includes(so.status)),
    [orders],
  );
  const skipped = orders.length - eligible.length;

  const totalLines = eligible.reduce((s, so) => s + so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty).length, 0);
  const grandTotal = eligible.reduce(
    (s, so) => s + so.lines.filter(l => !l.cancelled).reduce((ls, l) => ls + l.orderedQty * l.unitPrice, 0),
    0,
  );

  const hasInFlightOrders = eligible.some(so =>
    so.lines.some(l => !l.cancelled && (l.pickedQty > 0 || l.shippedQty > 0)),
  );

  const reasonValid = reason !== "" && (reason !== "Other" || reasonText.trim().length > 0);
  const reasonLabel = REASON_OPTIONS.find(r => r.value === reason)?.label || "";

  const handleAddAttachment = () => {
    const mockFiles = ["cancellation-request.pdf", "customer-email.eml", "credit-memo-draft.xlsx", "return-authorization.pdf"];
    const next = mockFiles[attachments.length % mockFiles.length];
    if (!attachments.includes(next)) setAttachments(prev => [...prev, next]);
  };
  const handleRemoveAttachment = (name: string) => setAttachments(prev => prev.filter(a => a !== name));

  const doConfirm = () => {
    if (!reason || !reasonValid) return;
    onConfirm(eligible.map(so => so.id), reason as CancellationReason, reasonText);
  };

  useModalShortcuts({
    onConfirm: () => { if (!showConfirm && reasonValid && eligible.length > 0) setShowConfirm(true); },
    onClose: showConfirm ? () => setShowConfirm(false) : onClose,
    confirmDisabled: !reasonValid || eligible.length === 0,
  });

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
        <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
        <div
          className="relative bg-card rounded-lg border border-border w-full max-w-[760px] max-h-[90vh] flex flex-col"
          style={{ boxShadow: "var(--elevation-3)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: "16px 24px" }}>
            <div className="flex items-center gap-3">
              <div
                className="rounded-lg flex items-center justify-center bg-destructive/10"
                style={{ width: 36, height: 36 }}
              >
                <Ban className="text-destructive" style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div style={labelStyle}>Cancel Sales Orders</div>
                <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
                  {eligible.length} order{eligible.length !== 1 ? "s" : ""} eligible for cancellation
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.5 }} />
            </button>
          </div>

          {/* Body — two-column layout */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left — Order list */}
            <div className="flex-1 flex flex-col border-r border-border min-w-0">
              <div className="flex items-center gap-2 border-b border-border bg-secondary shrink-0" style={{ padding: "10px 16px" }}>
                <span style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                  Orders to Cancel ({eligible.length})
                </span>
                <span
                  className="rounded bg-destructive/10 text-destructive"
                  style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", padding: "2px 8px" }}
                >
                  ${grandTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Warning for skipped */}
                {skipped > 0 && (
                  <div className="flex items-start gap-3 border-b border-border bg-chart-3/5" style={{ padding: "10px 16px" }}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-chart-3" />
                    <div style={{ ...captionNormal, color: "var(--foreground)" }}>
                      <span style={{ fontWeight: "var(--font-weight-medium)" }}>{skipped}</span> order{skipped !== 1 ? "s" : ""} skipped
                      — already cancelled, shipped, or closed.
                    </div>
                  </div>
                )}

                {eligible.map(so => (
                  <OrderAccordionRow
                    key={so.id}
                    so={so}
                    expandedSO={expandedSO}
                    setExpandedSO={setExpandedSO}
                  />
                ))}

                {eligible.length === 0 && (
                  <div className="text-center" style={{ padding: "48px 16px", ...captionNormal, color: "var(--foreground)", opacity: 0.35 }}>
                    No orders eligible for cancellation.
                  </div>
                )}
              </div>
            </div>

            {/* Right — Reason & summary */}
            <div className="flex flex-col" style={{ width: 300 }}>
              <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
                {/* Reason Picker */}
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-1" style={{ marginBottom: 6 }}>
                    <span style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                      Cancellation Reason
                    </span>
                    <span
                      className="text-destructive"
                      style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}
                    >
                      REQUIRED
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setReasonDropdownOpen(!reasonDropdownOpen)}
                      className={`w-full flex items-center justify-between border rounded-lg transition-colors bg-input-background ${
                        reason ? "border-border text-foreground" : "border-destructive/30 text-foreground/35"
                      }`}
                      style={{ ...captionNormal, padding: "8px 12px", fontWeight: reason ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}
                    >
                      <span className="truncate text-left">{reason ? reasonLabel : "Select a reason..."}</span>
                      <ChevronDown
                        className={`text-foreground/35 shrink-0 transition-transform ${reasonDropdownOpen ? "rotate-180" : ""}`}
                        style={{ width: 14, height: 14 }}
                      />
                    </button>
                    {reasonDropdownOpen && (
                      <>
                        <div className="fixed inset-0" style={{ zIndex: "var(--z-overlay)" }} onClick={() => setReasonDropdownOpen(false)} />
                        <div
                          className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg py-1 overflow-y-auto"
                          style={{ zIndex: "var(--z-popover)", boxShadow: "var(--elevation-2)", maxHeight: 280 }}
                        >
                          {REASON_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setReason(opt.value); setReasonDropdownOpen(false); }}
                              className={`w-full text-left flex items-start gap-2.5 hover:bg-secondary transition-colors ${
                                reason === opt.value ? "text-primary bg-primary/5" : "text-foreground/80"
                              }`}
                              style={{ padding: "8px 12px" }}
                            >
                              <opt.icon className="text-foreground/35 shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
                              <div className="flex-1 min-w-0">
                                <div style={{ ...captionNormal, fontWeight: reason === opt.value ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}>
                                  {opt.label}
                                </div>
                                <div className="text-foreground/35 mt-0.5" style={smallStyle}>
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
                    <textarea
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      placeholder="Please describe the reason..."
                      className={`w-full border rounded-lg text-foreground placeholder-foreground/35 outline-none focus:ring-2 resize-none bg-input-background ${
                        reasonText.trim().length === 0 ? "border-destructive/50 focus:ring-destructive/30" : "border-border focus:ring-ring"
                      }`}
                      style={{ ...captionNormal, padding: "8px 12px", marginTop: 8 }}
                      rows={2}
                    />
                  )}
                  {reason === "Other" && reasonText.trim().length === 0 && (
                    <div className="text-destructive mt-1 flex items-center gap-1" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
                      <span>Reason text is required when "Other" is selected</span>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-1" style={{ marginBottom: 6 }}>
                    <span style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                      Attachments
                    </span>
                    <span style={{ ...smallStyle, color: "var(--foreground)", opacity: 0.35 }}>optional</span>
                  </div>
                  {attachments.length > 0 && (
                    <div className="space-y-1.5" style={{ marginBottom: 8 }}>
                      {attachments.map(name => (
                        <div key={name} className="flex items-center gap-2 border border-border rounded-md bg-secondary/50" style={{ padding: "6px 10px" }}>
                          <Paperclip className="text-foreground/35 shrink-0" style={{ width: 12, height: 12 }} />
                          <span className="truncate flex-1 text-foreground/70" style={smallStyle}>{name}</span>
                          <button onClick={() => handleRemoveAttachment(name)} className="text-foreground/30 hover:text-destructive shrink-0 transition-colors">
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAddAttachment}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg hover:bg-secondary/50 transition-colors text-foreground/40 hover:text-foreground/60"
                    style={{ ...captionNormal, padding: "10px 12px" }}
                  >
                    <Upload style={{ width: 14, height: 14 }} />
                    <span>Attach supporting file</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-border" style={{ marginBottom: 16 }} />

                {/* Impact summary */}
                <div>
                  <div style={{ ...microLabel, marginBottom: 8 }}>IMPACT SUMMARY</div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between" style={captionNormal}>
                      <span style={{ color: "var(--foreground)", opacity: 0.5 }}>Orders</span>
                      <span style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-semibold)" }}>{eligible.length}</span>
                    </div>
                    <div className="flex items-center justify-between" style={captionNormal}>
                      <span style={{ color: "var(--foreground)", opacity: 0.5 }}>Lines affected</span>
                      <span style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-semibold)" }}>{totalLines}</span>
                    </div>
                    <div className="border-t border-border" />
                    <div className="flex items-center justify-between" style={captionNormal}>
                      <span style={{ color: "var(--foreground)", opacity: 0.5 }}>Cancellation value</span>
                      <span style={{ color: "var(--destructive)", fontWeight: "var(--font-weight-semibold)" }}>
                        -${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* In-flight warning */}
                {hasInFlightOrders && (
                  <div className="flex items-start gap-2 rounded-lg border border-chart-3/20 bg-chart-3/5" style={{ padding: 10, marginTop: 16 }}>
                    <AlertTriangle className="text-chart-3 shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
                    <div style={{ ...smallStyle, color: "var(--foreground)" }}>
                      <span style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--chart-3)" }}>Some orders have picked or shipped items</span>
                      <span style={{ color: "var(--foreground)", opacity: 0.6 }}>
                        {" "}— warehouse put-back or carrier intercept may be required.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between shrink-0 border-t border-border" style={{ padding: "12px 24px" }}>
            <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>
              {eligible.length} order{eligible.length !== 1 ? "s" : ""} &middot; {totalLines} lines &middot; -${grandTotal.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-3.5 h-3.5" />}>
                Keep Orders <KbdHint keys="Esc" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={!reasonValid || eligible.length === 0}
                icon={<Ban className="w-3.5 h-3.5" />}
              >
                Cancel {eligible.length} Order{eligible.length !== 1 ? "s" : ""}
                {eligible.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center rounded bg-destructive-foreground text-destructive"
                    style={{
                      fontSize: "var(--text-micro)",
                      fontWeight: "var(--font-weight-semibold)",
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      marginLeft: 2,
                      lineHeight: 1,
                    }}
                  >
                    {totalLines}
                  </span>
                )}
                <KbdHint keys="&#8984;&#9166;" variant="light" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Confirmation Overlay ═══ */}
      {showConfirm && (
        <BulkCancelConfirmOverlay
          count={eligible.length}
          totalLines={totalLines}
          soNumbers={eligible.map(so => so.soNumber)}
          onConfirm={doConfirm}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

/* ── Confirmation overlay for bulk cancel — lean "are you sure?" with type-to-confirm ── */
function BulkCancelConfirmOverlay({
  count, totalLines, soNumbers,
  onConfirm, onClose,
}: {
  count: number;
  totalLines: number;
  soNumbers: string[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typeConfirmValue, setTypeConfirmValue] = useState("");
  const confirmKeyword = "CANCEL";
  const canConfirm = typeConfirmValue === confirmKeyword;

  useModalShortcuts({ onConfirm: () => { if (canConfirm) onConfirm(); }, onClose, confirmDisabled: !canConfirm });

  const captionNormalLocal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
  const captionMediumLocal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-popover)" }}>
      <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className="relative bg-card rounded-xl border border-border overflow-hidden"
        style={{ width: 420, boxShadow: "var(--elevation-3)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 flex items-center justify-center" style={{ width: 40, height: 40 }}>
              <AlertTriangle className="text-destructive" style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                Confirm Bulk Cancellation
              </h3>
              <p style={{ ...captionNormalLocal, color: "var(--foreground)", opacity: 0.5, marginTop: 2 }}>
                {count} order{count !== 1 ? "s" : ""} &middot; {totalLines} line{totalLines !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" style={{ color: "var(--foreground)", opacity: 0.5 }} />
          </button>
        </div>

        {/* Body — lean type-to-confirm */}
        <div style={{ padding: "20px 20px" }}>
          <p style={{ ...captionNormalLocal, color: "var(--foreground)", opacity: 0.6, marginBottom: 12 }}>
            This will cancel all active line items across{" "}
            <span style={{ fontWeight: "var(--font-weight-semibold)", opacity: 1, color: "var(--foreground)" }}>{count}</span>{" "}
            order{count !== 1 ? "s" : ""}. This action cannot be easily undone.
          </p>

          {/* SO numbers box */}
          <div
            className="border border-border rounded-md overflow-hidden"
            style={{ marginBottom: 16, maxHeight: 80, overflowY: "auto", background: "var(--secondary)" }}
          >
            <div className="flex flex-wrap gap-1.5" style={{ padding: "8px 10px" }}>
              {soNumbers.map(num => (
                <span
                  key={num}
                  className="inline-flex items-center rounded bg-destructive/10 text-destructive"
                  style={{
                    fontSize: "var(--text-small)",
                    fontWeight: "var(--font-weight-medium)",
                    padding: "2px 8px",
                    lineHeight: 1.4,
                  }}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-lg" style={{ padding: 14, background: "var(--secondary)" }}>
            <div style={{ ...captionMediumLocal, color: "var(--foreground)", marginBottom: 8 }}>
              Type{" "}
              <span
                className="text-destructive bg-destructive/10 rounded"
                style={{
                  fontWeight: "var(--font-weight-semibold)",
                  padding: "2px 8px",
                  letterSpacing: "0.04em",
                  fontSize: "var(--text-caption)",
                }}
              >
                {confirmKeyword}
              </span>{" "}
              to continue
            </div>
            <input
              type="text"
              value={typeConfirmValue}
              onChange={e => setTypeConfirmValue(e.target.value)}
              placeholder={confirmKeyword}
              className="w-full border border-border rounded-md text-foreground placeholder-foreground/25 outline-none focus:ring-2 focus:ring-destructive/30 bg-input-background"
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: "var(--font-weight-medium)",
                padding: "8px 12px",
                letterSpacing: "0.04em",
              }}
              autoFocus
            />
            {typeConfirmValue && typeConfirmValue !== confirmKeyword && (
              <div className="mt-1.5" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", color: "var(--destructive)" }}>
                Does not match
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary" style={{ padding: "12px 20px" }}>
          <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-3.5 h-3.5" />}>
            Go Back <KbdHint keys="Esc" />
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={!canConfirm} icon={<Ban className="w-3.5 h-3.5" />}>
            Confirm Cancellation <KbdHint keys="&#8984;&#9166;" variant="light" />
          </Button>
        </div>
      </div>
    </div>
  );
}