import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, PackageCheck, Upload, FileText, Check, AlertTriangle,
  Truck, CreditCard, Camera,
} from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder, SOLine } from "./types";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};
const h4Style: React.CSSProperties = { ...font, fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" };
const labelStyle: React.CSSProperties = { ...font, fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" };
const labelSemi: React.CSSProperties = { ...font, fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" };
const captionStyle: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const microStyle: React.CSSProperties = { ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };

type FulfillmentMode = "complete" | "partial";

interface FulfillmentModalProps {
  open: boolean;
  so: SalesOrder;
  onClose: () => void;
  onConfirm: (deliveryQtys?: Record<string, number>, proofFiles?: string[], invoiceNote?: string) => void;
}

export function FulfillmentModal({ open, so, onClose, onConfirm }: FulfillmentModalProps) {
  const [mode, setMode] = useState<FulfillmentMode>("complete");
  const [partialQtys, setPartialQtys] = useState<Record<string, number>>({});
  const [proofFiles, setProofFiles] = useState<string[]>([]);
  const [invoiceNote, setInvoiceNote] = useState("");
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const deliverableLines = useMemo(() =>
    so.lines.filter(l => !l.cancelled && l.shippedQty > l.deliveredQty),
    [so.lines]
  );

  const totalDeliverable = useMemo(() =>
    deliverableLines.reduce((s, l) => s + (l.shippedQty - l.deliveredQty), 0),
    [deliverableLines]
  );

  const partialTotal = useMemo(() =>
    Object.values(partialQtys).reduce((s, v) => s + v, 0),
    [partialQtys]
  );

  const handleFileChange = () => {
    if (fileRef.current?.files) {
      const newFiles = Array.from(fileRef.current.files).map(f => f.name);
      setProofFiles(prev => [...prev, ...newFiles]);
      fileRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    if (mode === "partial") {
      onConfirm(partialQtys, proofFiles.length > 0 ? proofFiles : undefined, generateInvoice ? invoiceNote || "Auto-generated" : undefined);
    } else {
      onConfirm(undefined, proofFiles.length > 0 ? proofFiles : undefined, generateInvoice ? invoiceNote || "Auto-generated" : undefined);
    }
  };

  const isDisabled = mode === "partial" && partialTotal === 0;
  const isDirty = proofFiles.length > 0 || invoiceNote.length > 0 || Object.values(partialQtys).some(v => v > 0) || mode !== "complete";
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleConfirm, onClose: guardedClose, confirmDisabled: isDisabled });

  if (!open) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal)" as any, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        className="bg-foreground/35"
        style={{ position: "absolute", inset: 0, backdropFilter: "blur(6px)" }}
        onClick={guardedClose}
      />
      <div style={{
        position: "relative", width: 560, maxHeight: "85vh",
        background: "var(--card)", borderRadius: 20,
        boxShadow: "var(--elevation-5)", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "var(--secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <PackageCheck style={{ width: 18, height: 18, color: "var(--accent)" }} />
              </div>
              <div>
                <div style={{ ...h4Style, color: "var(--foreground)" }}>Confirm Fulfillment</div>
                <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5 }}>{so.soNumber}</div>
              </div>
            </div>
            <button onClick={guardedClose} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--card)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "var(--foreground)", opacity: 0.5,
            }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 0, marginTop: 16, borderBottom: "1px solid var(--border)" }}>
            {(["complete", "partial"] as FulfillmentMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "12px 20px", border: "none", cursor: "pointer",
                  background: "transparent",
                  borderBottom: mode === m ? "2px solid var(--accent)" : "2px solid transparent",
                  ...labelStyle,
                  color: mode === m ? "var(--accent)" : "var(--foreground)",
                  opacity: mode === m ? 1 : 0.5,
                  transition: "all 120ms",
                }}
              >
                {m === "complete" ? "Complete Fulfillment" : "Partial Fulfillment"}
              </button>
            ))}
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Summary */}
          <div style={{
            padding: "16px 16px", borderRadius: 12,
            background: "var(--secondary)",
            border: "1px solid var(--border)",
            marginBottom: 16,
          }}>
            {mode === "complete" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check style={{ width: 16, height: 16, color: "var(--accent)" }} />
                <span style={{ ...captionStyle, color: "var(--foreground)" }}>
                  All {totalDeliverable} deliverable unit(s) across {deliverableLines.length} line(s) will be marked as delivered.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: "var(--chart-3)" }} />
                <span style={{ ...captionStyle, color: "var(--foreground)" }}>
                  Select specific quantities to confirm delivery for each line item.
                </span>
              </div>
            )}
          </div>

          {/* Line items */}
          <div style={{ ...microStyle, color: "var(--foreground)", opacity: 0.4, marginBottom: 8 }}>
            LINE ITEMS ({deliverableLines.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {deliverableLines.map(line => {
              const maxQty = line.shippedQty - line.deliveredQty;
              const pQty = partialQtys[line.id] ?? 0;
              return (
                <div key={line.id} style={{
                  padding: "12px 16px", borderRadius: 12,
                  border: "1px solid var(--border)", background: "var(--card)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...captionStyle, color: "var(--foreground)" }}>{line.itemCode}</div>
                      <div style={{
                        ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" as any,
                        color: "var(--foreground)", opacity: 0.5,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{line.itemName}</div>
                    </div>
                    {mode === "partial" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <input
                          type="number"
                          min={0}
                          max={maxQty}
                          value={pQty}
                          onChange={e => {
                            const v = Math.min(maxQty, Math.max(0, parseInt(e.target.value) || 0));
                            setPartialQtys(prev => ({ ...prev, [line.id]: v }));
                          }}
                          style={{
                            width: 56, height: 28, padding: "0 6px", borderRadius: 6,
                            border: "1px solid var(--border)", background: "var(--input-background)",
                            ...captionStyle, color: "var(--foreground)", textAlign: "center", outline: "none",
                          }}
                        />
                        <span style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.4 }}>/ {maxQty}</span>
                      </div>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <ProgressMini label="Shipped" value={mode === "complete" ? line.shippedQty : line.deliveredQty + pQty} total={line.orderedQty} color="var(--accent)" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Proof of Delivery */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...microStyle, color: "var(--foreground)", opacity: 0.4, marginBottom: 8 }}>
              PROOF OF DELIVERY
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "16px", borderRadius: 12,
                border: "2px dashed var(--border)",
                background: "var(--secondary)",
                textAlign: "center", cursor: "pointer",
                transition: "all 120ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <Camera style={{ width: 24, height: 24, color: "var(--foreground)", opacity: 0.25, margin: "0 auto 6px" }} />
              <div style={{ ...captionStyle, color: "var(--foreground)", opacity: 0.6 }}>Upload proof of delivery</div>
              <div style={{ ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" as any, color: "var(--foreground)", opacity: 0.35, marginTop: 2 }}>
                Photos, signed receipts, or delivery confirmations
              </div>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
            {proofFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {proofFiles.map((f, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 6,
                    background: "var(--secondary)",
                    border: "1px solid var(--border)",
                    ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--accent)",
                  }}>
                    <Upload style={{ width: 10, height: 10 }} /> {f}
                    <button
                      onClick={() => setProofFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--destructive)", padding: 0, display: "flex" }}
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Invoice section */}
          <div>
            <div style={{ ...microStyle, color: "var(--foreground)", opacity: 0.4, marginBottom: 8 }}>
              PAYMENT & INVOICING
            </div>
            <div style={{
              padding: "12px 14px", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--card)",
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: generateInvoice ? 10 : 0 }}>
                <div
                  onClick={() => setGenerateInvoice(!generateInvoice)}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: generateInvoice ? "none" : "1.5px solid var(--border)",
                    background: generateInvoice ? "var(--primary)" : "var(--card)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 120ms", cursor: "pointer",
                  }}
                >
                  {generateInvoice && <Check style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} />}
                </div>
                <div>
                  <div style={{ ...captionStyle, color: "var(--foreground)" }}>Generate payment invoice</div>
                  <div style={{ ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" as any, color: "var(--foreground)", opacity: 0.5 }}>
                    Create an invoice linked to this fulfillment
                  </div>
                </div>
                <CreditCard style={{ width: 16, height: 16, color: "var(--foreground)", opacity: 0.25, marginLeft: "auto" }} />
              </label>
              {generateInvoice && (
                <textarea
                  rows={2}
                  value={invoiceNote}
                  onChange={e => setInvoiceNote(e.target.value)}
                  placeholder="Invoice memo or notes (optional)..."
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 8, resize: "vertical",
                    border: "1px solid var(--border)", background: "var(--input-background)",
                    ...captionNormal, color: "var(--foreground)", outline: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X style={{ width: 14, height: 14 }} />}>
            Cancel <KbdHint keys="Esc" />
          </Button>
          <Button variant="accent" size="sm" onClick={handleConfirm} disabled={isDisabled} icon={<PackageCheck style={{ width: 14, height: 14 }} />}>
            {mode === "complete"
              ? `Confirm Full Delivery (${totalDeliverable})`
              : `Confirm Partial (${partialTotal})`
            }
            <KbdHint keys="⌘↵" variant="light" />
          </Button>
        </div>
      </div>
      {discardDialog}
    </div>,
    document.body
  );
}

/* ═══ Mini progress bar ═══ */
function ProgressMini({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{
          fontSize: "var(--text-micro)",
          fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", opacity: 0.4,
          letterSpacing: "0.02em",
        }}>{label}</span>
        <span style={{
          fontSize: "var(--text-micro)",
          fontWeight: "var(--font-weight-semibold)", color,
        }}>{value}/{total}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--secondary)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, background: color,
          width: `${pct}%`, transition: "width 300ms ease",
        }} />
      </div>
    </div>
  );
}