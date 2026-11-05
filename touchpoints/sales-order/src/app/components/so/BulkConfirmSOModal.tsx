import { useState, useMemo } from "react";
import { X, Calendar, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import { toSOBase } from "@/app/currency/soFx";

/* Orders are in different currencies: totals across them are in base, each
   order at its own rate (spec 4.3); an order's own figures are in its currency. */
const fmtBase = (n: number) => formatMoney(n, BASE_CURRENCY);

interface Props {
  orders: SalesOrder[];
  onConfirm: (soIds: string[], data: { shipByDate: string; expectedDelivery: string; notes: string }) => void;
  onClose: () => void;
}

function addDaysStr(dateStr: string, days: number): string {
  const parts = dateStr.split("/").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BulkConfirmSOModal({ orders, onConfirm, onClose }: Props) {
  const defaultShipBy = addDaysStr(orders[0]?.createdDate ?? "2026/03/13", 30);
  const defaultDelivery = addDaysStr(orders[0]?.createdDate ?? "2026/03/13", 45);

  const [shipByDate, setShipByDate] = useState(defaultShipBy);
  const [expectedDelivery, setExpectedDelivery] = useState(defaultDelivery);
  const [notes, setNotes] = useState("");
  const [expandedSO, setExpandedSO] = useState<string | null>(null);

  const approvable = useMemo(
    () => orders.filter(so => so.status === "Pending Review" || so.status === "Draft"),
    [orders],
  );

  const totalLines = approvable.reduce((s, so) => s + so.lines.filter(l => !l.cancelled).length, 0);
  const grandTotal = approvable.reduce(
    (s, so) => s + toSOBase(so, so.lines.filter(l => !l.cancelled).reduce((ls, l) => ls + l.orderedQty * l.unitPrice, 0)),
    0,
  );
  const taxRate = 0.0825;
  const tax = Math.round(grandTotal * taxRate);
  const total = grandTotal + tax;

  const doConfirm = () =>
    onConfirm(
      approvable.map(so => so.id),
      { shipByDate, expectedDelivery, notes },
    );
  useModalShortcuts({ onConfirm: doConfirm, onClose });

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="relative bg-card rounded-lg border border-border w-full max-w-[720px] max-h-[90vh] flex flex-col" style={{ boxShadow: "var(--elevation-3)" }}>
        {/* Header — Quotes canonical success variant: 32px chip (success/20 bg), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: "rgba(5, 150, 105, 0.18)" }}>
              <CheckCircle className="text-success" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>
                Bulk Release for Fulfillment
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                {approvable.length} order{approvable.length !== 1 ? "s" : ""} eligible for release
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md flex items-center justify-center transition-colors"
            style={{ width: 28, height: 28, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X style={{ width: 16, height: 16, color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          {/* Warning if some cannot be approved */}
          {orders.length > approvable.length && (
            <div className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 bg-chart-3/10">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-chart-3" />
              <div style={{ fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                <span style={{ fontWeight: "var(--font-weight-medium)" }}>{orders.length - approvable.length}</span> order{orders.length - approvable.length !== 1 ? "s" : ""} cannot be cleared (already cleared, shipped, or cancelled) and will be skipped.
              </div>
            </div>
          )}

          {/* Fulfillment Schedule */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.5 }} />
              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                Fulfillment Schedule (applied to all)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div style={{ fontSize: "var(--text-micro)", letterSpacing: "0.05em", color: "var(--foreground)", opacity: 0.5, fontWeight: "var(--font-weight-medium)", marginBottom: 6 }}>
                  SHIP BY DATE
                </div>
                <input
                  type="text"
                  value={shipByDate}
                  onChange={e => setShipByDate(e.target.value)}
                  className="w-full border border-border rounded-md focus:outline-none transition-colors"
                  style={{ padding: "8px 12px", fontSize: "var(--text-caption)", color: "var(--foreground)", background: "var(--input-background)" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "var(--text-micro)", letterSpacing: "0.05em", color: "var(--foreground)", opacity: 0.5, fontWeight: "var(--font-weight-medium)", marginBottom: 6 }}>
                  EXPECTED DELIVERY
                </div>
                <input
                  type="text"
                  value={expectedDelivery}
                  onChange={e => setExpectedDelivery(e.target.value)}
                  className="w-full border border-border rounded-md focus:outline-none transition-colors"
                  style={{ padding: "8px 12px", fontSize: "var(--text-caption)", color: "var(--foreground)", background: "var(--input-background)" }}
                />
              </div>
            </div>
          </div>

          {/* Orders Summary */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary">
              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                Orders to Release ({approvable.length})
              </span>
              <span className="rounded bg-success/10 text-success" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", padding: "2px 8px" }}>
                {fmtBase(grandTotal)}
              </span>
            </div>

            {approvable.map(so => {
              const activeLines = so.lines.filter(l => !l.cancelled);
              const soSubtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
              const isExpanded = expandedSO === so.id;

              return (
                <div key={so.id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => setExpandedSO(isExpanded ? null : so.id)}
                    className="w-full flex items-center px-4 py-3 hover:bg-secondary/50 transition-colors"
                    style={{ gap: "var(--space-inline-gap)" }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", color: "var(--primary)" }}>
                        {so.soNumber}
                      </span>
                      <span className="truncate" style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.6 }}>
                        {so.customer}
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>
                      {activeLines.length} items
                    </span>
                    <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)" }}>
                      {formatMoney(soSubtotal, so.currency)}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--foreground)", opacity: 0.4 }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--foreground)", opacity: 0.4 }} />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div
                        className="grid text-foreground/50 border-b border-border"
                        style={{ gridTemplateColumns: "100px 1fr 50px 90px", fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)", letterSpacing: "0.05em", padding: "4px 0" }}
                      >
                        <span>ITEM #</span><span>DESCRIPTION</span><span className="text-center">QTY</span><span className="text-right">TOTAL</span>
                      </div>
                      {activeLines.map(line => (
                        <div
                          key={line.id}
                          className="grid items-center border-b border-border last:border-b-0"
                          style={{ gridTemplateColumns: "100px 1fr 50px 90px", fontSize: "var(--text-caption)", padding: "6px 0" }}
                        >
                          <span style={{ color: "var(--primary)", fontWeight: "var(--font-weight-medium)" }}>{line.itemCode}</span>
                          <span className="truncate pr-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>{line.itemName}</span>
                          <span className="text-center" style={{ color: "var(--foreground)" }}>{line.orderedQty}</span>
                          <span className="text-right" style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>
                            {formatMoney(line.orderedQty * line.unitPrice, so.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="px-4 py-3 border-t border-border flex items-center justify-end" style={{ gap: 24, fontSize: "var(--text-caption)" }}>
              <div className="text-right">
                <div style={{ color: "var(--foreground)", opacity: 0.5 }}>Subtotal</div>
                <div style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>{fmtBase(grandTotal)}</div>
              </div>
              <div className="text-right">
                <div style={{ color: "var(--foreground)", opacity: 0.5 }}>Tax ({(taxRate * 100).toFixed(2)}%)</div>
                <div style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>{fmtBase(tax)}</div>
              </div>
              <div className="text-right">
                <div style={{ color: "var(--foreground)", opacity: 0.5 }}>Total</div>
                <div style={{ color: "var(--success)", fontWeight: "var(--font-weight-semibold)" }}>{fmtBase(total)}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span style={{ fontSize: "var(--text-micro)", letterSpacing: "0.05em", color: "var(--foreground)", opacity: 0.5, fontWeight: "var(--font-weight-medium)" }}>
                NOTES
              </span>
              <span style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.35 }}>(optional)</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Batch approval — reviewed and signed off by Operations Manager"
              className="w-full border border-border rounded-md focus:outline-none transition-colors resize-none"
              style={{ padding: "8px 12px", fontSize: "var(--text-caption)", color: "var(--foreground)", background: "var(--input-background)" }}
              rows={2}
            />
          </div>

          {/* Confirmation info */}
          <div className="border border-border rounded-md" style={{ background: "var(--secondary)", padding: "12px var(--space-card-padding)", fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.7 }}>
            Releasing will lock{" "}
            <span style={{ fontWeight: "var(--font-weight-semibold)", opacity: 1, color: "var(--foreground)" }}>
              {approvable.length} order{approvable.length !== 1 ? "s" : ""}
            </span>{" "}
            from further line edits. A total of{" "}
            <span style={{ fontWeight: "var(--font-weight-medium)", opacity: 1, color: "var(--foreground)" }}>
              {totalLines} line items
            </span>{" "}
            ({fmtBase(total)} incl. tax) will be ready for fulfillment.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
          <span style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>
            {approvable.length} orders &middot; {totalLines} items &middot; {fmtBase(total)} total
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="accent" size="sm" onClick={doConfirm} icon={<CheckCircle className="w-3.5 h-3.5" />}>
              Release {approvable.length} Order{approvable.length !== 1 ? "s" : ""} <KbdHint keys="&#8984;&#9166;" variant="light" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}