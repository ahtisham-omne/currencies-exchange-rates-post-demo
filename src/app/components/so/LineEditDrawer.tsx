import { useState } from "react";
import { X } from "lucide-react";
import { useSOStore } from "./store";
import { Button } from "./ui/Button";
import { ItemTypeBadge } from "./StatusBadge";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SOLine } from "./types";

interface Props { soId: string; line: SOLine; onClose: () => void; }

export function LineEditDrawer({ soId, line, onClose }: Props) {
  const store = useSOStore();
  
  const [orderedQty, setOrderedQty] = useState(line.orderedQty);
  const [unitPrice, setUnitPrice] = useState(line.unitPrice);
  const [taxRate, setTaxRate] = useState(line.taxRate);
  const [warehouse, setWarehouse] = useState(line.warehouse);
  const minQty = line.shippedQty;
  const lineTotal = orderedQty * unitPrice * (1 + taxRate);

  const isDirty = orderedQty !== line.orderedQty || unitPrice !== line.unitPrice
    || taxRate !== line.taxRate || warehouse !== line.warehouse;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  const handleSave = () => {
    if (orderedQty < minQty) { toast.error(`Cannot reduce ordered qty below shipped qty (${minQty})`); return; }
    store.updateSOLine(soId, line.id, { orderedQty, unitPrice, taxRate, warehouse });
    toast.success("Line updated"); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}
      <div className="w-[420px] bg-card shadow-elevation-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[var(--text-base)] text-foreground font-semibold">Edit Line Item</h3>
            <div className="flex items-center gap-2 mt-1 text-[length:var(--text-caption)] text-foreground/50">{line.itemCode} <ItemTypeBadge type={line.itemType} /></div>
          </div>
          <button onClick={guardedClose} className="w-8 h-8 rounded-md border border-border hover:bg-secondary flex items-center justify-center transition-colors"><X className="w-4 h-4 text-foreground/50" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-[length:var(--text-caption)] text-foreground/50">{line.itemName}</div>
          <div className="grid grid-cols-2 gap-3 p-3 bg-secondary rounded-lg text-[length:var(--text-caption)]">
            <div><span className="text-foreground/50">Allocated:</span> <span className="text-foreground font-medium">{line.allocatedQty}</span></div>
            <div><span className="text-foreground/50">Picked:</span> <span className="text-foreground font-medium">{line.pickedQty}</span></div>
            <div><span className="text-foreground/50">Shipped:</span> <span className="text-foreground font-medium">{line.shippedQty}</span></div>
            <div><span className="text-foreground/50">Remaining:</span> <span className="text-foreground font-medium">{orderedQty - line.shippedQty}</span></div>
          </div>
          <div>
            <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Warehouse</label>
            <select value={warehouse} onChange={e => setWarehouse(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-[length:var(--text-caption)] bg-input-background text-foreground">
              <option value="Main Warehouse">Main Warehouse</option><option value="East Hub">East Hub</option><option value="West Depot">West Depot</option>
            </select>
          </div>
          <div>
            <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Ordered Qty {minQty > 0 && <span className="text-destructive">(min: {minQty} -- shipped)</span>}</label>
            <input type="number" min={minQty} value={orderedQty} onChange={e => setOrderedQty(Math.max(minQty, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border border-border rounded-lg text-[length:var(--text-caption)] text-foreground bg-input-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Unit Price</label>
            <input type="number" step={0.01} value={unitPrice} onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border rounded-lg text-[length:var(--text-caption)] text-foreground bg-input-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Tax Rate</label>
            <input type="number" step={0.01} min={0} max={1} value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border rounded-lg text-[length:var(--text-caption)] text-foreground bg-input-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <div className="flex justify-between text-[length:var(--text-caption)]">
              <span className="text-foreground/80 font-medium">Line Total</span>
              <span className="text-foreground font-semibold">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          {line.allocations.length > 0 && (
            <div>
              <label className="text-[length:var(--text-small)] text-foreground/50 block mb-2 font-medium">Current Allocations</label>
              <div className="space-y-1">
                {line.allocations.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-1.5 bg-secondary rounded text-[length:var(--text-caption)]">
                    <span className="text-foreground">{a.warehouse} {a.lotNumber && `· ${a.lotNumber}`}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/50">Qty: <span className="text-foreground font-medium">{a.qty}</span></span>
                      {a.locked && <span className="text-[length:var(--text-micro)] text-chart-3 bg-chart-3/10 border border-chart-3/20 px-1.5 py-0.5 rounded font-medium">Locked</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={guardedClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}