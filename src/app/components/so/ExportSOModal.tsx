import { useState } from "react";
import { X, Download, Mail, Settings2, EyeOff } from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder } from "./types";
import { Button } from "./ui/Button";

const font: React.CSSProperties = {};
const caption: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionSemi: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const micro: React.CSSProperties = { ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase" as const };

interface VisibilityOption {
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const DEFAULT_OPTIONS: VisibilityOption[] = [
  { key: "header", label: "Company Logo & Header", description: "Show your company branding at the top.", icon: "🏢", enabled: true },
  { key: "pricing", label: "Pricing Rules", description: "Calculation details and adjustments.", icon: "💰", enabled: true },
  { key: "adjustments", label: "Adjustments", description: "Item-level and order-level adjustments.", icon: "⚙️", enabled: true },
  { key: "attachments", label: "Attachments", description: "Include uploaded files or link references.", icon: "📎", enabled: true },
  { key: "charges", label: "Payment Charges", description: "Fees based on payment method.", icon: "💳", enabled: false },
  { key: "notes", label: "Notes", description: "Internal notes visible to customer.", icon: "📝", enabled: true },
  { key: "terms", label: "Terms & Conditions", description: "Standard terms and payment policies.", icon: "📃", enabled: true },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 40, height: 22,
        backgroundColor: enabled ? "var(--primary)" : "var(--border)",
      }}
    >
      <div
        className="absolute top-[2px] rounded-full bg-card transition-transform"
        style={{
          width: 18, height: 18,
          transform: enabled ? "translateX(20px)" : "translateX(2px)",
          boxShadow: "var(--elevation-1)",
        }}
      />
    </button>
  );
}

/* ── Mock pricing rules per line ── */
function getLinePricingRules(itemCode: string) {
  const rules: { label: string; type: "discount" | "premium"; percent: number }[] = [];
  if (itemCode.includes("001") || itemCode.includes("002")) {
    rules.push({ label: "Fleet Volume Discount", type: "discount", percent: 8 });
  }
  if (itemCode.includes("049") || itemCode.includes("059")) {
    rules.push({ label: "Govt. Contract Premium", type: "premium", percent: 3 });
  }
  if (itemCode.includes("026")) {
    rules.push({ label: "Bulk Lighting Discount", type: "discount", percent: 5 });
  }
  return rules;
}

function getLineAdjustment(itemCode: string): { label: string; amount: number } | null {
  if (itemCode.includes("001")) return { label: "Chassis prep labor credit", amount: -350 };
  if (itemCode.includes("059")) return { label: "Extended warranty add-on", amount: 450 };
  return null;
}

function getLineNote(itemCode: string): string | null {
  if (itemCode.includes("001")) return "Chassis VIN to be confirmed prior to delivery. Customer requires DOT inspection cert.";
  if (itemCode.includes("059")) return "Must include CPR platform and IV mount per spec sheet rev. C.";
  return null;
}

/* ── Order-level adjustments ── */
const ORDER_ADJUSTMENTS = [
  { label: "Early payment incentive (2/10 Net 30)", amount: -1250 },
  { label: "Freight surcharge — oversized load", amount: 780 },
];

const ORDER_PRICING_RULES = [
  { label: "Annual Volume Rebate Tier 2", type: "discount" as const, percent: 2 },
];

export function ExportSOModal({ open, so, onClose }: { open: boolean; so: SalesOrder; onClose: () => void }) {
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  

  const toggleOption = (key: string) => {
    setOptions(prev => prev.map(o => o.key === key ? { ...o, enabled: !o.enabled } : o));
  };

  const activeLines = so.lines.filter(l => !l.cancelled);
  const subtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);

  // Compute pricing adjustments
  const showPricing = options.find(o => o.key === "pricing")?.enabled;
  const showAdjustments = options.find(o => o.key === "adjustments")?.enabled;
  const showAttachments = options.find(o => o.key === "attachments")?.enabled;
  const showNotes = options.find(o => o.key === "notes")?.enabled;

  // Line-level pricing & adjustments
  let totalLinePricingAdj = 0;
  let totalLineAdj = 0;
  activeLines.forEach(l => {
    const lineTotal = l.orderedQty * l.unitPrice;
    getLinePricingRules(l.itemCode).forEach(r => {
      const amt = r.type === "discount" ? -(lineTotal * r.percent / 100) : (lineTotal * r.percent / 100);
      totalLinePricingAdj += amt;
    });
    const adj = getLineAdjustment(l.itemCode);
    if (adj) totalLineAdj += adj.amount;
  });

  // Order-level
  const orderPricingAdj = ORDER_PRICING_RULES.reduce((s, r) => s + (r.type === "discount" ? -(subtotal * r.percent / 100) : (subtotal * r.percent / 100)), 0);
  const orderAdj = ORDER_ADJUSTMENTS.reduce((s, a) => s + a.amount, 0);

  const grandTotal = subtotal + (showPricing ? totalLinePricingAdj + orderPricingAdj : 0) + (showAdjustments ? totalLineAdj + orderAdj : 0);

  // Attachments refs
  const attachmentRefs = so.attachments.filter(a => a.inOrder);

  const handleExport = () => {
    toast.success(`Exporting Sales Order ${so.soNumber} as PDF…`);
    onClose();
  };

  const handleEmail = () => {
    toast.success(`Emailing Sales Order ${so.soNumber} to customer…`);
    onClose();
  };

  const isDirty = options.some((o, i) => o.enabled !== DEFAULT_OPTIONS[i].enabled);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleExport, onClose: guardedClose, confirmDisabled: !open });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }}
      onClick={guardedClose}
    >
      <div
        className="bg-card rounded-xl border border-border"
        style={{
          boxShadow: "var(--elevation-4)",
          width: showOptions ? 900 : 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          transition: "width 300ms ease",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: "var(--space-card-padding) 20px" }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-foreground" style={{ ...captionSemi, fontSize: "var(--text-label)" }}>Export Sales Order</div>
              <div className="text-foreground/50" style={caption}>Preview before exporting — customize what's visible</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center rounded-lg border transition-colors ${showOptions ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground/60 hover:bg-secondary"}`}
              style={{ ...caption, gap: 8, padding: "8px 12px" }}
            >
              {showOptions ? <><EyeOff className="w-3.5 h-3.5" /> Hide Options</> : <><Settings2 className="w-3.5 h-3.5" /> Visibility Options</>}
            </button>
            <button onClick={guardedClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-foreground/50" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Visibility Settings panel */}
          {showOptions && (
            <div className="border-r border-border overflow-y-auto" style={{ width: 280, flexShrink: 0, padding: "var(--space-card-padding)" }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
                <Settings2 className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-foreground" style={{ ...micro }}>VISIBILITY SETTINGS</span>
              </div>
              <div className="text-foreground/50" style={{ ...caption, fontWeight: "var(--font-weight-normal)", marginBottom: 16 }}>
                Choose what your customer will see on this sales order.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {options.map(opt => (
                  <div key={opt.key} className="flex items-start justify-between" style={{ gap: 12 }}>
                    <div className="flex items-start" style={{ gap: 10 }}>
                      <span style={{ fontSize: "var(--text-base)", lineHeight: 1, marginTop: 2 }}>{opt.icon}</span>
                      <div>
                        <div className="text-foreground" style={captionSemi}>{opt.label}</div>
                        <div className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>{opt.description}</div>
                      </div>
                    </div>
                    <Toggle enabled={opt.enabled} onChange={() => toggleOption(opt.key)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview area */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-card-padding)", background: "var(--secondary)" }}>
            <div className="text-foreground/40" style={{ ...micro, marginBottom: 8 }}>PREVIEW</div>
            <div className="bg-card rounded-lg border border-border" style={{ boxShadow: "var(--elevation-1)", padding: "32px 40px", minHeight: 500 }}>
              {/* Omne branding header */}
              {options.find(o => o.key === "header")?.enabled && (
                <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center" style={{ color: "var(--primary-foreground)", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>O</div>
                      <span className="text-foreground" style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" }}>Omne</span>
                    </div>
                    <div className="text-foreground/50" style={{ ...caption, fontWeight: "var(--font-weight-normal)", lineHeight: 1.5 }}>
                      200 Park Avenue, 18th Floor<br />
                      New York, NY 10166 · (212) 555-0482
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-foreground" style={{ fontSize: "var(--text-h3)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.02em" }}>SALES ORDER</div>
                    <div className="text-foreground/60" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>
                      {so.soNumber}<br />
                      Date: {so.createdDate.split("/").slice(1).join("/") + "/" + so.createdDate.split("/")[0]}<br />
                      Valid Until: {(() => {
                        const parts = so.createdDate.split("/").map(Number);
                        const d = new Date(parts[0], parts[1] - 1, parts[2]);
                        d.setDate(d.getDate() + 30);
                        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 3, background: "var(--primary)", borderRadius: 2, marginBottom: 24 }} />

              {/* Bill To + SO Details */}
              <div className="flex" style={{ gap: 40, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <div className="text-foreground/40" style={{ ...micro, marginBottom: 4 }}>BILL TO</div>
                  <div className="text-foreground" style={{ ...captionSemi, marginBottom: 2 }}>{so.customer}</div>
                  <div className="text-foreground/60" style={{ ...caption, fontWeight: "var(--font-weight-normal)", lineHeight: 1.5 }}>
                    Attn: Karen Rodriguez<br />
                    456 Enterprise Blvd, Floor 12<br />
                    New York, NY 10001
                  </div>
                </div>
                <div>
                  <div className="text-foreground/40" style={{ ...micro, marginBottom: 4 }}>SO DETAILS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {[
                      { l: "Sales Rep:", v: so.salesRep },
                      { l: "Currency:", v: so.currency },
                      { l: "Payment:", v: so.paymentTerms },
                    ].map(r => (
                      <div key={r.l} className="flex" style={{ gap: 12 }}>
                        <span className="text-foreground/50" style={{ ...caption, fontWeight: "var(--font-weight-normal)", minWidth: 70 }}>{r.l}</span>
                        <span className="text-foreground" style={captionSemi}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Line items table */}
              <table className="w-full" style={{ marginBottom: 0 }}>
                <thead>
                  <tr className="border-b border-border">
                    {["#", "DESCRIPTION", "QTY", "UOM", "UNIT PRICE", "AMOUNT"].map(h => (
                      <th
                        key={h}
                        className={`text-foreground/40 ${h === "DESCRIPTION" || h === "#" ? "text-left" : "text-right"}`}
                        style={{ ...micro, padding: "8px 0", fontWeight: "var(--font-weight-semibold)", ...(h === "#" ? { width: 24 } : {}) }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeLines.map((line, lineIdx) => {
                    const lineTotal = line.orderedQty * line.unitPrice;
                    const pricingRules = getLinePricingRules(line.itemCode);
                    const adjustment = getLineAdjustment(line.itemCode);
                    const note = getLineNote(line.itemCode);
                    const hasAttachment = attachmentRefs.some(a => a.lineItemId === line.id);
                    const attachmentIdx = attachmentRefs.findIndex(a => a.lineItemId === line.id);

                    return (
                      <tr key={line.id} className="border-b border-border/40 align-top">
                        <td className="text-foreground/30" style={{ ...caption, padding: "12px 4px 12px 0", verticalAlign: "top" }}>{lineIdx + 1}</td>
                        <td className="text-foreground" style={{ ...caption, fontWeight: "var(--font-weight-normal)", padding: "12px 8px 12px 0", maxWidth: 320, verticalAlign: "top" }}>
                          <div className="flex items-start gap-2">
                            {/* Thumbnail placeholder */}
                            <div className="shrink-0 rounded" style={{ width: 28, height: 28, backgroundColor: "#F9FAFB", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 9, color: "#9CA3AF" }}>📦</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span style={captionSemi}>{line.itemCode}</span>
                                {hasAttachment && (
                                  <span className="text-primary" style={{ fontSize: 10, fontWeight: 600 }}>[{attachmentIdx + 1}]</span>
                                )}
                              </div>
                              {line.itemName && (
                                <span className="text-foreground/50" style={{ display: "block", marginTop: 2, ...caption, fontWeight: "var(--font-weight-normal)", lineHeight: 1.4 }}>
                                  {line.itemName.length > 120 ? line.itemName.slice(0, 120) + "…" : line.itemName}
                                </span>
                              )}
                              {/* Item-level pricing rules */}
                              {showPricing && pricingRules.length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  {pricingRules.map((r, ri) => (
                                    <div key={ri} className="flex items-center gap-1" style={{ fontSize: 10, color: r.type === "discount" ? "#059669" : "#D97706", lineHeight: 1.6 }}>
                                      <span>{r.type === "discount" ? "−" : "+"}{r.percent}%</span>
                                      <span style={{ color: "var(--muted-foreground)" }}>{r.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Item-level adjustment */}
                              {showAdjustments && adjustment && (
                                <div style={{ fontSize: 10, color: adjustment.amount < 0 ? "#059669" : "#D97706", lineHeight: 1.6, marginTop: 2 }}>
                                  {`${adjustment.amount < 0 ? "−" : "+"}$${Math.abs(adjustment.amount).toLocaleString()} ${adjustment.label}`}
                                </div>
                              )}
                              {/* Item-level note */}
                              {showNotes && note && (
                                <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.5, marginTop: 4, fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 6 }}>
                                  {note}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-foreground" style={{ ...caption, padding: "12px 0", verticalAlign: "top" }}>{line.orderedQty}</td>
                        <td className="text-right text-foreground/60" style={{ ...caption, fontWeight: "var(--font-weight-normal)", padding: "12px 0", verticalAlign: "top" }}>Each</td>
                        <td className="text-right text-foreground" style={{ ...caption, padding: "12px 0", verticalAlign: "top" }}>${line.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                        <td className="text-right text-foreground" style={{ ...captionSemi, padding: "12px 0", verticalAlign: "top" }}>${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals section */}
              <div className="flex flex-col items-end" style={{ gap: 4, marginTop: 16 }}>
                <div className="flex items-center border-b border-border/60" style={{ gap: 40, paddingBottom: 4, minWidth: 240 }}>
                  <span className="text-foreground/50" style={caption}>Subtotal</span>
                  <span className="text-foreground ml-auto" style={captionSemi}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                </div>

                {/* Order-level pricing rules */}
                {showPricing && ORDER_PRICING_RULES.map((r, ri) => (
                  <div key={`opr-${ri}`} className="flex items-center" style={{ gap: 20, minWidth: 240 }}>
                    <span className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)", flex: 1 }}>{r.label} ({r.type === "discount" ? "−" : "+"}{r.percent}%)</span>
                    <span style={{ ...caption, color: r.type === "discount" ? "#059669" : "#D97706" }}>
                      {`${r.type === "discount" ? "−" : "+"}$${Math.abs(subtotal * r.percent / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                    </span>
                  </div>
                ))}

                {showPricing && totalLinePricingAdj !== 0 && (
                  <div className="flex items-center" style={{ gap: 20, minWidth: 240 }}>
                    <span className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)", flex: 1 }}>Item-level pricing adjustments</span>
                    <span style={{ ...caption, color: totalLinePricingAdj < 0 ? "#059669" : "#D97706" }}>
                      {`${totalLinePricingAdj < 0 ? "−" : "+"}$${Math.abs(totalLinePricingAdj).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                    </span>
                  </div>
                )}

                {/* Order-level adjustments */}
                {showAdjustments && ORDER_ADJUSTMENTS.map((a, ai) => (
                  <div key={`oa-${ai}`} className="flex items-center" style={{ gap: 20, minWidth: 240 }}>
                    <span className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)", flex: 1 }}>{a.label}</span>
                    <span style={{ ...caption, color: a.amount < 0 ? "#059669" : "#D97706" }}>
                      {`${a.amount < 0 ? "−" : "+"}$${Math.abs(a.amount).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                    </span>
                  </div>
                ))}

                {showAdjustments && totalLineAdj !== 0 && (
                  <div className="flex items-center" style={{ gap: 20, minWidth: 240 }}>
                    <span className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)", flex: 1 }}>Item-level adjustments</span>
                    <span style={{ ...caption, color: totalLineAdj < 0 ? "#059669" : "#D97706" }}>
                      {`${totalLineAdj < 0 ? "−" : "+"}$${Math.abs(totalLineAdj).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center border-t border-border" style={{ gap: 40, minWidth: 240, paddingTop: 6, marginTop: 4 }}>
                  <span className="text-foreground" style={{ ...captionSemi, fontSize: "var(--text-label)" }}>Total</span>
                  <span className="text-foreground ml-auto" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>{`$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}</span>
                </div>
              </div>

              {/* Notes */}
              {showNotes && so.internalNotes && (
                <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div className="text-foreground/40" style={{ ...micro, marginBottom: 4 }}>NOTES</div>
                  <div className="text-foreground/60" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>{so.internalNotes}</div>
                </div>
              )}

              {/* Attachments references */}
              {showAttachments && attachmentRefs.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div className="text-foreground/40" style={{ ...micro, marginBottom: 6 }}>ATTACHMENTS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {attachmentRefs.map((att, ai) => (
                      <div key={att.id} className="flex items-center gap-2" style={{ fontSize: 11, color: "#6B7280" }}>
                        <span className="text-primary" style={{ fontWeight: 600, minWidth: 18 }}>[{ai + 1}]</span>
                        <span style={{ fontWeight: 500, color: "#374151" }}>{att.name}</span>
                        <span className="text-foreground/30">·</span>
                        <span>{att.size}</span>
                        {att.description && <><span className="text-foreground/30">·</span><span style={{ fontStyle: "italic" }}>{att.description}</span></>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terms */}
              {options.find(o => o.key === "terms")?.enabled && (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div className="text-foreground/40" style={{ ...micro, marginBottom: 4 }}>TERMS & CONDITIONS</div>
                  <div className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)", lineHeight: 1.5 }}>
                    Payment is due within the terms stated above. All prices are in {so.currency}. This Sales Order is subject to our standard terms of service. Returns must be initiated within 30 days of delivery.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border" style={{ padding: "12px 20px" }}>
          <div className="text-foreground/40" style={{ ...caption, fontWeight: "var(--font-weight-normal)" }}>
            Changes only affect this export — they won't modify the sales order.
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleEmail} icon={<Mail className="w-3.5 h-3.5" />}>
              Email to Customer
            </Button>
            <Button variant="primary" size="sm" onClick={handleExport} icon={<Download className="w-3.5 h-3.5" />}>
              Export Sales Order <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
        {discardDialog}
      </div>
    </div>
  );
}
