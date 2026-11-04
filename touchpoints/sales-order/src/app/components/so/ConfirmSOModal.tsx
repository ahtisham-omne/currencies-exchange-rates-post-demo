import { useState } from "react";
import { X, FileText, Calendar, Upload, Paperclip } from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder } from "./types";

interface Props {
  so: SalesOrder;
  onConfirm: (data: { shipByDate: string; expectedDelivery: string; notes: string }) => void;
  onClose: () => void;
}

function addDaysStr(dateStr: string, days: number): string {
  const parts = dateStr.split("/").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ConfirmSOModal({ so, onConfirm, onClose }: Props) {
  const defaultShipBy = addDaysStr(so.createdDate, 30);
  const defaultDelivery = so.requestedDeliveryDate
    ? (() => { const p = so.requestedDeliveryDate.split("/").map(Number); return `${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}/${p[0]}`; })()
    : addDaysStr(so.createdDate, 45);

  const [shipByDate, setShipByDate] = useState(defaultShipBy);
  const [expectedDelivery, setExpectedDelivery] = useState(defaultDelivery);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  const subtotal = so.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const taxRate = 0.0825;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;
  const activeLines = so.lines.filter(l => !l.cancelled);

  const handleFileDrop = () => setAttachments(prev => [...prev, `Document_${prev.length + 1}.pdf`]);
  const doConfirm = () => onConfirm({ shipByDate, expectedDelivery, notes });

  const isDirty = shipByDate !== defaultShipBy || expectedDelivery !== defaultDelivery || notes.length > 0 || attachments.length > 0;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: doConfirm, onClose: guardedClose });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}
      <div className="relative bg-card rounded-lg border border-border shadow-elevation-sm w-full max-w-[680px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <div className="text-foreground" style={{ ...{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" } }}>Clear Sales Order</div>
              <div className="text-xs text-foreground/50">{so.soNumber} · {so.customer}</div>
            </div>
          </div>
          <button onClick={guardedClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Fulfillment Schedule */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-foreground/50" />
              <span className="text-xs font-semibold text-foreground">Fulfillment Schedule</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs tracking-wider text-foreground/50 mb-1.5 font-medium">SHIP BY DATE</div>
                <input type="text" value={shipByDate} onChange={e => setShipByDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-input-background text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div>
                <div className="text-xs tracking-wider text-foreground/50 mb-1.5 font-medium">EXPECTED DELIVERY</div>
                <input type="text" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-input-background text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
              </div>
            </div>
            <div className="text-xs text-foreground/35 mt-2">These are order-level defaults. Override per line item below if needed.</div>
          </div>

          {/* Line Items */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
              <span className="text-xs font-semibold text-foreground">Line Items ({activeLines.length})</span>
              <span className="text-xs font-semibold bg-accent/10 text-accent px-2 py-[2px] rounded">${subtotal.toLocaleString()}</span>
              <span className="ml-auto text-xs font-medium text-primary cursor-pointer">Verify dates ↗</span>
            </div>

            <div className="grid text-xs font-medium text-foreground/50 px-4 py-2 border-b border-border tracking-wider" style={{ gridTemplateColumns: "100px 1fr 40px 50px 90px 90px 90px" }}>
              <span>ITEM #</span><span>DESCRIPTION</span><span className="text-center">QTY</span><span className="text-center">UOM</span><span className="text-right">LINE TOTAL</span><span className="text-right">SHIP BY</span><span className="text-right">DELIVERY BY</span>
            </div>

            {activeLines.map(line => (
              <div key={line.id} className="grid px-4 py-2.5 border-b border-border last:border-b-0 text-xs items-center" style={{ gridTemplateColumns: "100px 1fr 40px 50px 90px 90px 90px" }}>
                <span className="text-primary font-medium">{line.itemCode}</span>
                <span className="text-foreground/70 truncate pr-2">{line.itemName}</span>
                <span className="text-center text-foreground">{line.orderedQty}</span>
                <span className="text-center text-foreground/50">{(line as any).uom || "EA"}</span>
                <span className="text-right text-foreground font-medium">${(line.orderedQty * line.unitPrice).toLocaleString()}</span>
                <span className="text-right text-foreground/50 flex items-center justify-end gap-1"><Calendar className="w-3 h-3 text-foreground/25" />{shipByDate}</span>
                <span className="text-right text-foreground/50 flex items-center justify-end gap-1"><Calendar className="w-3 h-3 text-foreground/25" />{expectedDelivery}</span>
              </div>
            ))}

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-6 text-xs">
              <div className="text-right"><div className="text-foreground/50">Subtotal</div><div className="text-foreground font-medium">${subtotal.toLocaleString()}</div></div>
              <div className="text-right"><div className="text-foreground/50">Tax ({(taxRate * 100).toFixed(2)}%)</div><div className="text-foreground font-medium">${tax.toLocaleString()}</div></div>
              <div className="text-right"><div className="text-foreground/50">Total</div><div className="text-accent font-semibold">${total.toLocaleString()}</div></div>
            </div>
          </div>

          {/* Supporting Documents */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs tracking-wider text-foreground/50 font-medium">SUPPORTING DOCUMENTS</span>
              <span className="text-xs text-foreground/35">(optional)</span>
            </div>
            <div className="text-xs text-foreground/40 mb-2">Upload signed quotes, purchase orders, or any related agreements.</div>
            <div onClick={handleFileDrop} className="border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/30 transition-colors">
              <Upload className="w-5 h-5 text-foreground/25 mb-2" />
              <span className="text-xs text-foreground/50">Drag documents here</span>
              <span className="text-xs text-foreground/35">or <span className="text-primary cursor-pointer font-medium">Browse Files</span></span>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md text-xs">
                    <Paperclip className="w-3 h-3 text-foreground/35" />
                    <span className="text-foreground/70 flex-1">{name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-foreground/25 hover:text-foreground/50"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs tracking-wider text-foreground/50 font-medium">NOTES</span>
              <span className="text-xs text-foreground/35">(optional)</span>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='e.g., "Verbal confirmation via phone call with John Smith on 02/05/2026"' className="w-full px-3 py-2.5 border border-border rounded-md bg-input-background text-xs text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 transition-colors resize-none" rows={3} />
          </div>

          {/* Confirmation info */}
          <div className="bg-secondary/60 border border-border rounded-md px-4 py-3 text-xs text-foreground/60">
            Clearing will lock <span className="text-foreground font-semibold">{so.soNumber}</span> from further line edits. All{" "}
            <span className="text-foreground font-medium">{activeLines.length} line items</span>{" "}
            (${total.toLocaleString()} incl. tax) will be ready for shipping.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
          <span className="text-xs text-foreground/50">{activeLines.length} items · ${total.toLocaleString()} total</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="accent" size="sm" onClick={doConfirm} icon={<FileText className="w-3.5 h-3.5" />}>
              Clear Sales Order <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}