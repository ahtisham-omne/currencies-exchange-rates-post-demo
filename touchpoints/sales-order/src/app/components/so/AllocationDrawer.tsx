import { useState } from "react";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { useSOStore } from "./store";
import { Button } from "./ui/Button";
import { ItemTypeBadge } from "./StatusBadge";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SOLine, Allocation } from "./types";

interface Props { soId: string; line: SOLine; onClose: () => void; }
interface AllocationRow { tempId: string; warehouse: string; qty: number; lotNumber: string; serialNumbers: string[]; }

export function AllocationDrawer({ soId, line, onClose }: Props) {
  const store = useSOStore();
  
  const inventoryItems = store.getInventoryForItem(line.itemCode);
  const warehouses = [...new Set(inventoryItems.map(i => i.warehouse))];
  const existingUnlocked = line.allocations.filter(a => !a.locked);
  const [rows, setRows] = useState<AllocationRow[]>(
    existingUnlocked.length > 0
      ? existingUnlocked.map(a => ({ tempId: a.id, warehouse: a.warehouse, qty: a.qty, lotNumber: a.lotNumber || "", serialNumbers: a.serialNumbers || [] }))
      : [{ tempId: `tmp-${Date.now()}`, warehouse: warehouses[0] || "Main Warehouse", qty: 0, lotNumber: "", serialNumbers: [] }]
  );
  const remainingToAllocate = line.orderedQty - line.allocations.filter(a => a.locked).reduce((s, a) => s + a.qty, 0);
  const totalNewAlloc = rows.reduce((s, r) => s + (line.itemType === "Serialized" ? r.serialNumbers.length : r.qty), 0);

  const isDirty = rows.some(r => r.qty > 0 || r.serialNumbers.length > 0 || r.lotNumber.length > 0);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  const addRow = () => setRows(prev => [...prev, { tempId: `tmp-${Date.now()}-${Math.random()}`, warehouse: warehouses[0] || "Main Warehouse", qty: 0, lotNumber: "", serialNumbers: [] }]);
  const removeRow = (tempId: string) => setRows(prev => prev.filter(r => r.tempId !== tempId));
  const updateRow = (tempId: string, field: keyof AllocationRow, value: any) => setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
  const getAvailableForRow = (warehouse: string) => store.getAvailable(warehouse, line.itemCode);
  const getLots = (warehouse: string) => { const inv = inventoryItems.find(i => i.warehouse === warehouse); return inv?.lots || []; };
  const getSerials = (warehouse: string) => { const inv = inventoryItems.find(i => i.warehouse === warehouse); return inv?.serialNumbers || []; };

  const handleSave = () => {
    if (totalNewAlloc > remainingToAllocate) { toast.error(`Cannot allocate more than remaining ${remainingToAllocate}`); return; }
    for (const row of rows) {
      const qty = line.itemType === "Serialized" ? row.serialNumbers.length : row.qty;
      if (qty <= 0) continue;
      const available = getAvailableForRow(row.warehouse);
      if (qty > available) { toast.error(`Not enough available in ${row.warehouse} for ${line.itemCode}. Available: ${available}`); return; }
    }
    const allocations: Allocation[] = rows.filter(r => (line.itemType === "Serialized" ? r.serialNumbers.length > 0 : r.qty > 0)).map(r => ({
      id: r.tempId.startsWith("tmp-") ? `ALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : r.tempId,
      warehouse: r.warehouse, qty: line.itemType === "Serialized" ? r.serialNumbers.length : r.qty,
      lotNumber: r.lotNumber || undefined, serialNumbers: r.serialNumbers.length > 0 ? r.serialNumbers : undefined, locked: false,
    }));
    const success = store.allocate(soId, line.id, allocations);
    if (success) { toast.success("Allocation saved"); onClose(); } else { toast.error("Allocation failed. Check availability."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}
      <div className="w-[520px] bg-card shadow-elevation-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[var(--text-base)] text-foreground font-semibold">Allocate Inventory</h3>
            <div className="text-[length:var(--text-caption)] text-foreground/50 mt-0.5 flex items-center gap-1.5">{line.itemCode} · <ItemTypeBadge type={line.itemType} /></div>
          </div>
          <button onClick={guardedClose} className="w-8 h-8 rounded-md border border-border hover:bg-secondary flex items-center justify-center transition-colors"><X className="w-4 h-4 text-foreground/50" /></button>
        </div>

        <div className="px-5 py-3 bg-secondary border-b border-border text-[length:var(--text-caption)]">
          <div className="flex gap-6">
            <div><span className="text-foreground/50">Ordered:</span> <span className="text-foreground font-medium">{line.orderedQty}</span></div>
            <div><span className="text-foreground/50">Already Locked:</span> <span className="text-foreground font-medium">{line.allocations.filter(a => a.locked).reduce((s, a) => s + a.qty, 0)}</span></div>
            <div><span className="text-foreground/50">Remaining:</span> <span className="text-primary font-medium">{remainingToAllocate}</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {rows.map((row, i) => {
            const available = getAvailableForRow(row.warehouse);
            return (
              <div key={row.tempId} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[length:var(--text-caption)] text-foreground/50 font-medium">Allocation #{i + 1}</span>
                  {rows.length > 1 && <button onClick={() => removeRow(row.tempId)} className="text-foreground/35 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="mb-3">
                  <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Location</label>
                  <select value={row.warehouse} onChange={e => updateRow(row.tempId, "warehouse", e.target.value)} className="w-full px-3 py-1.5 border border-border rounded-md text-[length:var(--text-caption)] bg-input-background text-foreground">
                    {warehouses.map(w => <option key={w} value={w}>{w} (Available: {store.getAvailable(w, line.itemCode)})</option>)}
                  </select>
                </div>
                {line.itemType === "Non-Serialized" && (
                  <div>
                    <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Quantity (Available: {available})</label>
                    <input type="number" min={0} max={Math.min(available, remainingToAllocate)} value={row.qty} onChange={e => updateRow(row.tempId, "qty", Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-1.5 border border-border rounded-md text-[length:var(--text-caption)] text-foreground bg-input-background" />
                  </div>
                )}
                {line.itemType === "Lot Controlled" && (
                  <>
                    <div className="mb-3">
                      <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Lot Number</label>
                      <select value={row.lotNumber} onChange={e => updateRow(row.tempId, "lotNumber", e.target.value)} className="w-full px-3 py-1.5 border border-border rounded-md text-[length:var(--text-caption)] bg-input-background text-foreground">
                        <option value="">Select lot...</option>
                        {getLots(row.warehouse).map(lot => <option key={lot.lotNumber} value={lot.lotNumber}>{lot.lotNumber} (Avail: {lot.qty - lot.reserved})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Quantity</label>
                      <input type="number" min={0} max={Math.min(available, remainingToAllocate)} value={row.qty} onChange={e => updateRow(row.tempId, "qty", Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-1.5 border border-border rounded-md text-[length:var(--text-caption)] text-foreground bg-input-background" />
                    </div>
                  </>
                )}
                {line.itemType === "Serialized" && (
                  <div>
                    <label className="text-[length:var(--text-small)] text-foreground/50 block mb-1 font-medium">Select Serial Numbers (qty = 1 each)</label>
                    <div className="max-h-[160px] overflow-y-auto border border-border rounded-md divide-y divide-border">
                      {getSerials(row.warehouse).map(sn => {
                        const isSelected = row.serialNumbers.includes(sn.serial);
                        return (
                          <label key={sn.serial} className={`flex items-center gap-2 px-3 py-1.5 text-[length:var(--text-caption)] cursor-pointer hover:bg-secondary ${!sn.available && !isSelected ? "opacity-40" : ""}`}>
                            <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={isSelected} disabled={!sn.available && !isSelected} onChange={e => { if (e.target.checked) updateRow(row.tempId, "serialNumbers", [...row.serialNumbers, sn.serial]); else updateRow(row.tempId, "serialNumbers", row.serialNumbers.filter(s => s !== sn.serial)); }} />
                            <span className="text-foreground">{sn.serial}</span>
                            {!sn.available && !isSelected && <span className="text-destructive text-[length:var(--text-micro)]">(reserved)</span>}
                          </label>
                        );
                      })}
                    </div>
                    <div className="text-[length:var(--text-small)] text-foreground/35 mt-1">Selected: {row.serialNumbers.length}</div>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={addRow} className="flex items-center gap-1.5 text-[length:var(--text-caption)] text-primary hover:text-primary/80 font-medium transition-colors"><Plus className="w-3.5 h-3.5" /> Add another allocation source</button>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <div className="text-[length:var(--text-caption)] text-foreground/50">
            Total allocating: <span className="text-primary font-medium">{totalNewAlloc}</span> / {remainingToAllocate}
            {totalNewAlloc > remainingToAllocate && <span className="flex items-center gap-1 text-destructive mt-0.5"><AlertCircle className="w-3 h-3" /> Over-allocation blocked</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={guardedClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={totalNewAlloc === 0 || totalNewAlloc > remainingToAllocate}>Save Allocation</Button>
          </div>
        </div>
      </div>
    </div>
  );
}