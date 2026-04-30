import { useState, useMemo, useEffect } from "react";
import {
  X, Archive, AlertTriangle, Check, Info,
  Package, FileText, User, Calendar, Layers,
  ChevronDown, Paperclip, Upload,
} from "lucide-react";
import { ItemDescription } from "./ItemDescription";
import { Button } from "./ui/Button";
import { CancellationConfirmDialog, useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder, SOLine } from "./types";

/* ═══ Typography tokens ═══ */
const captionStyle: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const microStyle: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };

/* ═══ Archive Reasons ═══ */
type ArchiveReason = "Order Completed" | "Outdated Order" | "Customer Inactive" | "Duplicate Record" | "Internal Cleanup" | "Other";

const ARCHIVE_REASONS: { value: ArchiveReason; label: string; description: string; icon: typeof Archive }[] = [
  { value: "Order Completed", label: "Order completed & fulfilled", description: "All items shipped and delivered — archiving for record-keeping", icon: Check },
  { value: "Outdated Order", label: "Outdated or expired order", description: "Order is no longer relevant due to age or changed requirements", icon: Calendar },
  { value: "Customer Inactive", label: "Customer no longer active", description: "Customer account has been deactivated or relationship ended", icon: User },
  { value: "Duplicate Record", label: "Duplicate record", description: "This order is a duplicate of another active order", icon: Layers },
  { value: "Internal Cleanup", label: "Internal cleanup", description: "Archiving as part of periodic data maintenance", icon: FileText },
  { value: "Other", label: "Other reason", description: "Specify the archive reason below", icon: Info },
];

interface Props {
  so: SalesOrder;
  onConfirm: () => void;
  onClose: () => void;
}

export function ArchiveModal({ so, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState<ArchiveReason | "">("");
  const [reasonText, setReasonText] = useState("");
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const reasonValid = reason !== "" && (reason !== "Other" || reasonText.trim().length > 0);
  const isDirty = reason !== "" || reasonText.length > 0;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  const reasonLabel = ARCHIVE_REASONS.find(r => r.value === reason)?.label || "";
  const selectedReasonMeta = ARCHIVE_REASONS.find(r => r.value === reason);

  // Keyboard shortcuts — NOT using useModalShortcuts to prevent accidental triggers
  // Only Escape to close (via guardedClose)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (showConfirmDialog) setShowConfirmDialog(false);
        else guardedClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [guardedClose, showConfirmDialog]);

  const activeLines = so.lines.filter(l => !l.cancelled);
  const totalValue = activeLines.reduce((sum, l) => sum + l.orderedQty * l.unitPrice, 0);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
        <div
          className="relative bg-card rounded-xl border border-border flex flex-col overflow-hidden"
          style={{ width: 560, maxHeight: "85vh", boxShadow: "var(--elevation-3)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "16px 20px" }}>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 flex items-center justify-center" style={{ width: 40, height: 40 }}>
                <Archive className="text-destructive" style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <h3 className="text-foreground" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" }}>
                  Archive Sales Order
                </h3>
                <p className="text-foreground/50 mt-0.5" style={captionNormal}>
                  {so.soNumber} &middot; {so.customer} &middot; ${totalValue.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={guardedClose}
              className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5 text-foreground/50" />
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "20px" }}>
            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/[0.03]" style={{ padding: "10px 12px", marginBottom: 20 }}>
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
              <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.7, lineHeight: 1.45 }}>
                Archived orders are hidden from the main listing by default. They can only be viewed when the{" "}
                <span style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--destructive)" }}>Archived</span>{" "}
                filter is active. You can unarchive at any time.
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-lg border border-border bg-secondary/30" style={{ padding: "12px 14px", marginBottom: 20 }}>
              <div style={microStyle} className="text-foreground/40 mb-2">ORDER SUMMARY</div>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ ...captionStyle, color: "var(--foreground)" }}>{so.soNumber}</span>
                <span style={{ ...captionStyle, color: "var(--foreground)" }}>${totalValue.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3" style={captionNormal}>
                <span className="text-foreground/50">{activeLines.length} active line{activeLines.length !== 1 ? "s" : ""}</span>
                <span className="text-foreground/25">·</span>
                <span className="text-foreground/50">Status: {so.status}</span>
                {so.version && so.version.number > 1 && (
                  <>
                    <span className="text-foreground/25">·</span>
                    <span className="text-foreground/50">Version {so.version.number}</span>
                  </>
                )}
              </div>
            </div>

            {/* Reason selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={microStyle} className="text-foreground/40 block mb-2">ARCHIVE REASON</label>
              <div className="relative">
                <button
                  onClick={() => setReasonDropdownOpen(!reasonDropdownOpen)}
                  className={`w-full flex items-center justify-between rounded-lg border transition-colors ${reason ? "border-border bg-card" : "border-border/60 bg-secondary/30"}`}
                  style={{ height: 40, padding: "0 12px", cursor: "pointer" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedReasonMeta && <selectedReasonMeta.icon className="w-3.5 h-3.5 text-foreground/40 shrink-0" />}
                    <span className={reason ? "text-foreground" : "text-foreground/35"} style={{ ...captionStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {reason ? reasonLabel : "Select a reason for archiving..."}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-foreground/35 shrink-0" />
                </button>
                {reasonDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setReasonDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg z-20 py-1" style={{ boxShadow: "var(--elevation-2)", maxHeight: 280, overflowY: "auto" }}>
                      {ARCHIVE_REASONS.map(opt => {
                        const Icon = opt.icon;
                        const isActive = reason === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setReason(opt.value); setReasonDropdownOpen(false); }}
                            className={`w-full flex items-start gap-3 px-3 py-2.5 transition-colors ${isActive ? "bg-primary/[0.04]" : "hover:bg-secondary"}`}
                          >
                            <div className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 mt-0.5 ${isActive ? "bg-primary border-primary" : "bg-card border-2 border-border"}`} style={{ borderRadius: 4 }}>
                              {isActive && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="text-foreground" style={captionStyle}>{opt.label}</div>
                              <div className="text-foreground/40 mt-0.5" style={{ fontSize: "var(--text-small)", lineHeight: 1.4 }}>{opt.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Other reason text */}
            {reason === "Other" && (
              <div style={{ marginBottom: 16 }}>
                <label style={microStyle} className="text-foreground/40 block mb-2">SPECIFY REASON</label>
                <textarea
                  value={reasonText}
                  onChange={e => setReasonText(e.target.value)}
                  placeholder="Enter the reason for archiving this order..."
                  className={`w-full rounded-lg border text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none ${!reasonText.trim() && reason === "Other" ? "border-destructive/30 bg-destructive/[0.02]" : "border-border"}`}
                  style={{ ...captionNormal, padding: "10px 12px", minHeight: 72, lineHeight: 1.5 }}
                />
              </div>
            )}

            {/* What happens section */}
            <div className="rounded-lg border border-chart-3/20 bg-chart-3/[0.03]" style={{ padding: "12px 14px" }}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-chart-3 shrink-0" />
                <span style={{ ...captionStyle, color: "var(--chart-3)" }}>What happens when you archive</span>
              </div>
              <ul className="text-foreground/60 space-y-1.5" style={{ ...captionNormal, lineHeight: 1.5, paddingLeft: 22 }}>
                <li>Order is hidden from the default listing view</li>
                <li>Visible only when "Archived" filter is active</li>
                <li>All line items and history are preserved</li>
                <li>You can unarchive at any time to restore</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-border bg-secondary shrink-0" style={{ padding: "14px 20px" }}>
            <button
              onClick={() => { if (reasonValid) setShowConfirmDialog(true); }}
              disabled={!reasonValid}
              className={`w-full flex items-center justify-center gap-2 rounded-lg transition-colors ${reasonValid ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" : "bg-destructive/30 text-destructive-foreground/50 cursor-not-allowed"}`}
              style={{ height: 38, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
            >
              <Archive className="w-3.5 h-3.5" /> Archive Order
            </button>
            <button
              onClick={guardedClose}
              className="w-full flex items-center justify-center gap-2 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
              style={{ height: 32, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", border: "none", background: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation sub-dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60000 }}>
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }} onClick={() => setShowConfirmDialog(false)} />
          <div className="relative bg-card rounded-xl border border-border overflow-hidden" style={{ width: 400, boxShadow: "var(--elevation-3)" }}>
            <div style={{ padding: "20px" }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-chart-3/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <h4 className="text-foreground" style={{ fontSize: 14, fontWeight: 600 }}>Confirm Archive</h4>
                  <p className="text-foreground/50 mt-1" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    You are about to archive <strong className="text-foreground">{so.soNumber}</strong>.
                    {reason === "Other" && reasonText ? ` Reason: "${reasonText}"` : ` Reason: ${reasonLabel}`}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-chart-3/20 bg-[#FFF7ED]" style={{ padding: "10px 12px", marginBottom: 4 }}>
                <div className="flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5 shrink-0" style={{ color: "#78350F" }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#78350F", lineHeight: 1.4 }}>
                    This order will be moved to the archive. It can be restored at any time using Unarchive.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-border" style={{ padding: "14px 20px", backgroundColor: "#FFFBF5" }}>
              <button
                onClick={() => { setShowConfirmDialog(false); onConfirm(); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg text-white transition-colors hover:opacity-90 cursor-pointer"
                style={{ height: 36, fontSize: 13, fontWeight: 600, backgroundColor: "#D97706" }}
              >
                <Archive className="w-3.5 h-3.5" /> Yes, Archive Order
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="w-full flex items-center justify-center rounded-lg text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                style={{ height: 32, fontSize: 13, fontWeight: 500, border: "none", background: "none" }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {discardDialog}
    </>
  );
}
