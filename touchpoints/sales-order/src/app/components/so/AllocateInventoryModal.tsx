import type { SalesOrder, Allocation, WarehouseInventory } from "./types";
import { useState, useMemo, useCallback } from "react";
import {
  X, Search, ChevronDown, ChevronRight, Sparkles, Minus, Plus,
  Check, Package, Layers, ArrowDownUp, RotateCcw, Clock,
  MapPin, Info, Eye,
} from "lucide-react";
import { useSOStore } from "./store";
import { useModalShortcuts } from "./ModalKeyboard";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";

/* ═══ Typography tokens — only Inter from fonts.css ═══ */
/* ═══ Reusable style fragments — font-family inherited from base CSS ═══ */
const F: React.CSSProperties = {};
const micro: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase" as const };
const caption: React.CSSProperties = { fontSize: "var(--text-caption)" };
const captionMed: React.CSSProperties = { ...caption, fontWeight: "var(--font-weight-medium)" };
const captionSemi: React.CSSProperties = { ...caption, fontWeight: "var(--font-weight-semibold)" };
const label: React.CSSProperties = { fontSize: "var(--text-label)" };
const labelSemi: React.CSSProperties = { ...label, fontWeight: "var(--font-weight-semibold)" };

/* ═══ Sub-flow types ═══ */
interface PendingAllocation {
  lineId: string;
  warehouse: string;
  qty: number;
  lotNumber?: string;
  serialNumbers?: string[];
}

/* ═══ Badge Components ═══ */
function TypeBadge({ type }: { type: string }) {
  const isSerialized = type.includes("Serialized") || type === "Serialized";
  const isLot = type.includes("Lot");
  return (
    <span
      className={`inline-flex shrink-0 ${isSerialized ? "bg-foreground/[0.07] text-foreground/70" : isLot ? "bg-foreground/[0.05] text-foreground/55" : "bg-foreground/[0.04] text-foreground/45"}`}
      style={{ ...F, padding: "0px 5px", borderRadius: 3, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}
    >
      {type}
    </span>
  );
}

function SufficiencyBadge({ available, needed }: { available: number; needed: number }) {
  const diff = available - needed;
  return diff >= 0
    ? <span className="inline-flex bg-accent/10 text-accent" style={{ ...F, padding: "1px 8px", borderRadius: 999, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>Sufficient (+{diff})</span>
    : <span className="inline-flex bg-destructive/[0.08] text-destructive" style={{ ...F, padding: "1px 8px", borderRadius: 999, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>Insufficient ({diff})</span>;
}

/* ═══ Auto-allocate strategies ═══ */
type AllocStrategy = "fifo" | "lifo" | "fefo" | "spread";
const STRATEGIES: { id: AllocStrategy; label: string; desc: string }[] = [
  { id: "fifo", label: "FIFO", desc: "First In, First Out — oldest stock first" },
  { id: "lifo", label: "LIFO", desc: "Last In, First Out — newest stock first" },
  { id: "fefo", label: "FEFO", desc: "First Expiry, First Out — earliest lots first" },
  { id: "spread", label: "Spread Evenly", desc: "Distribute across all locations" },
];

function sortWarehousesByStrategy(inventories: WarehouseInventory[], strategy: AllocStrategy): WarehouseInventory[] {
  const sorted = [...inventories];
  switch (strategy) {
    case "lifo": sorted.sort((a, b) => b.warehouse.localeCompare(a.warehouse)); break;
    case "spread": sorted.sort((a, b) => (b.onHand - b.reserved) - (a.onHand - a.reserved)); break;
    default: sorted.sort((a, b) => a.warehouse.localeCompare(b.warehouse)); break;
  }
  return sorted;
}

/* ═══ Location mock detail ═══ */
const LOC_DETAIL: Record<string, string> = {
  "Main Warehouse": "Receiving Dock, Aisle 01, Shelf 02",
  "East Hub": "Cold Storage, Aisle 02, Shelf 04",
  "West Depot": "Main Floor, Aisle 05, Shelf 02",
};
function locDetail(wh: string) { return LOC_DETAIL[wh] || "Aisle 03, Shelf 01"; }

/* ═══ Aggregate lots across all warehouses for an item ═══ */
function aggregateLots(inventories: WarehouseInventory[]) {
  const map = new Map<string, { lotNumber: string; totalQty: number; totalReserved: number; warehouses: { warehouse: string; qty: number; reserved: number }[] }>();
  inventories.forEach(inv => {
    (inv.lots || []).forEach(lot => {
      const existing = map.get(lot.lotNumber);
      if (existing) {
        existing.totalQty += lot.qty;
        existing.totalReserved += lot.reserved;
        existing.warehouses.push({ warehouse: inv.warehouse, qty: lot.qty, reserved: lot.reserved });
      } else {
        map.set(lot.lotNumber, { lotNumber: lot.lotNumber, totalQty: lot.qty, totalReserved: lot.reserved, warehouses: [{ warehouse: inv.warehouse, qty: lot.qty, reserved: lot.reserved }] });
      }
    });
  });
  return Array.from(map.values());
}

/* ═══════════════════════════════════════════════════════
   Main Modal
   ═══════════════════════════════════════════════════════ */
interface AllocateInventoryModalProps {
  so: SalesOrder;
  onClose: () => void;
  initialLineId?: string;
  singleLineMode?: boolean;
}

export function AllocateInventoryModal({ so, onClose, initialLineId, singleLineMode }: AllocateInventoryModalProps) {
  const store = useSOStore();
  

  const activeLines = useMemo(() => so.lines.filter(l => !l.cancelled), [so.lines]);

  const [selectedIdx, setSelectedIdx] = useState(() => {
    if (initialLineId) { const idx = activeLines.findIndex(l => l.id === initialLineId); return idx >= 0 ? idx : 0; }
    return 0;
  });
  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");
  const [allocationsExpanded, setAllocationsExpanded] = useState(true);
  const [allocTab, setAllocTab] = useState<"quantity" | "location" | "lot">("quantity");
  const [pendingAllocations, setPendingAllocations] = useState<PendingAllocation[]>([]);
  const [showAutoAllocMenu, setShowAutoAllocMenu] = useState(false);
  const [locationQtys, setLocationQtys] = useState<Record<string, number>>({});
  const [lotQtys, setLotQtys] = useState<Record<string, number>>({});
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());

  const selected = activeLines[selectedIdx];
  const noActiveLines = !selected;

  /* ── Helpers ── */
  const pendingForLine = (lineId: string) =>
    pendingAllocations.filter(p => p.lineId === lineId).reduce((s, p) => s + p.qty, 0);

  const currentAllocated = selected.allocatedQty + pendingForLine(selected.id);
  const toShip = selected.orderedQty - selected.shippedQty;
  const remaining = Math.max(0, toShip - currentAllocated);

  const inventoryForItem = store.getInventoryForItem(selected.itemCode);
  const totalAvailable = inventoryForItem.reduce((s, inv) => s + Math.max(0, inv.onHand - inv.reserved), 0);

  const pct = toShip > 0 ? Math.min(100, Math.round((currentAllocated / toShip) * 100)) : 0;
  const pctColor = pct >= 100 ? "var(--primary)" : "var(--accent)";

  const fullyAllocatedCount = activeLines.filter(line => {
    const p = pendingForLine(line.id);
    const lineToShip = line.orderedQty - line.shippedQty;
    return (line.allocatedQty + p) >= lineToShip;
  }).length;

  const totalPendingChanges = pendingAllocations.length;

  /* ── Pending serial helpers ── */
  const pendingSerialSelections = pendingAllocations
    .filter(p => p.lineId === selected.id && p.serialNumbers)
    .flatMap(p => p.serialNumbers!.map(s => ({ serial: s, warehouse: p.warehouse })));

  const toggleSerialPending = (serial: string, warehouse: string) => {
    const isAlreadySelected = pendingSerialSelections.some(s => s.serial === serial && s.warehouse === warehouse);
    if (!isAlreadySelected && remaining <= 0) return;
    setPendingAllocations(prev => {
      const idx = prev.findIndex(p => p.lineId === selected.id && p.warehouse === warehouse && p.serialNumbers);
      if (idx >= 0) {
        const existing = prev[idx];
        const has = existing.serialNumbers?.includes(serial);
        if (has) {
          const newS = existing.serialNumbers!.filter(s => s !== serial);
          if (newS.length === 0) return prev.filter((_, i) => i !== idx);
          return prev.map((p, i) => i === idx ? { ...p, qty: newS.length, serialNumbers: newS } : p);
        }
        const newS = [...existing.serialNumbers!, serial];
        return prev.map((p, i) => i === idx ? { ...p, qty: newS.length, serialNumbers: newS } : p);
      }
      return [...prev, { lineId: selected.id, warehouse, qty: 1, serialNumbers: [serial] }];
    });
  };

  const selectAllSerials = (serials: { serial: string; warehouse: string }[]) => {
    const maxCanSelect = Math.max(0, toShip - selected.allocatedQty);
    const toSelect = serials.slice(0, maxCanSelect);
    if (toSelect.length === 0) return;
    setPendingAllocations(prev => {
      let result = prev.filter(p => !(p.lineId === selected.id && p.serialNumbers));
      const byWh = new Map<string, string[]>();
      toSelect.forEach(s => { byWh.set(s.warehouse, [...(byWh.get(s.warehouse) || []), s.serial]); });
      byWh.forEach((sns, wh) => { result.push({ lineId: selected.id, warehouse: wh, qty: sns.length, serialNumbers: sns }); });
      return result;
    });
  };

  /* ── Quantity-only ── */
  const defaultWhPendingQty = pendingAllocations.find(p =>
    p.lineId === selected.id && p.warehouse === selected.warehouse && !p.serialNumbers && !p.lotNumber
  )?.qty || 0;

  const updatePendingQty = (newQty: number) => {
    const maxAllowable = remaining + defaultWhPendingQty;
    const clamped = Math.min(newQty, maxAllowable);
    setPendingAllocations(prev => {
      const idx = prev.findIndex(p =>
        p.lineId === selected.id && p.warehouse === selected.warehouse && !p.serialNumbers && !p.lotNumber
      );
      if (clamped <= 0) return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      if (idx >= 0) return prev.map((p, i) => i === idx ? { ...p, qty: clamped } : p);
      return [...prev, { lineId: selected.id, warehouse: selected.warehouse, qty: clamped }];
    });
  };

  /* ── Location-based ── */
  const handleLocationQtyChange = (warehouse: string, qty: number, maxAvail: number) => {
    const prevRowQty = locationQtys[warehouse] || 0;
    const clamped = Math.max(0, Math.min(qty, Math.min(maxAvail, remaining + prevRowQty)));
    setLocationQtys(prev => ({ ...prev, [warehouse]: clamped }));
    setPendingAllocations(prev => {
      const idx = prev.findIndex(p => p.lineId === selected.id && p.warehouse === warehouse && !p.serialNumbers && !p.lotNumber);
      if (clamped <= 0) return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      if (idx >= 0) return prev.map((p, i) => i === idx ? { ...p, qty: clamped } : p);
      return [...prev, { lineId: selected.id, warehouse, qty: clamped }];
    });
  };

  /* ── Lot-based ── */
  const handleLotQtyChange = (lotNumber: string, warehouse: string, qty: number, maxAvail: number) => {
    const key = `${lotNumber}::${warehouse}`;
    const prevQty = lotQtys[key] || 0;
    const clamped = Math.max(0, Math.min(qty, Math.min(maxAvail, remaining + prevQty)));
    setLotQtys(prev => ({ ...prev, [key]: clamped }));
    setPendingAllocations(prev => {
      const idx = prev.findIndex(p => p.lineId === selected.id && p.warehouse === warehouse && p.lotNumber === lotNumber);
      if (clamped <= 0) return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      if (idx >= 0) return prev.map((p, i) => i === idx ? { ...p, qty: clamped } : p);
      return [...prev, { lineId: selected.id, warehouse, qty: clamped, lotNumber }];
    });
  };

  /* ── Allocate All (per item) ── */
  const handleAllocateAll = useCallback(() => {
    if (remaining <= 0) { toast.info("Already fully allocated"); return; }
    if (selected.itemType === "Serialized") {
      const allAvail = inventoryForItem.flatMap(inv =>
        (inv.serialNumbers || []).filter(sn => sn.available)
          .filter(sn => !pendingSerialSelections.some(ps => ps.serial === sn.serial && ps.warehouse === inv.warehouse))
          .map(sn => ({ serial: sn.serial, warehouse: inv.warehouse }))
      );
      selectAllSerials(allAvail);
      toast.success(`Auto-selected serials for ${selected.itemCode}`);
      return;
    }
    updatePendingQty(remaining);
    toast.success(`Allocated ${remaining} to ${selected.itemCode}`);
  }, [remaining, selected, inventoryForItem, pendingSerialSelections]);

  /* ── Auto-Allocate All strategy ── */
  const handleAutoAllocateStrategy = useCallback((strategy: AllocStrategy) => {
    setShowAutoAllocMenu(false);
    let count = 0;
    const newPending: PendingAllocation[] = [];
    activeLines.forEach(line => {
      const pending = pendingForLine(line.id);
      const lineToShip = line.orderedQty - line.shippedQty;
      const lineAlloc = line.allocatedQty + pending;
      const rem = lineToShip - lineAlloc;
      if (rem <= 0) return;
      const itemInv = store.getInventoryForItem(line.itemCode);
      if (line.itemType === "Serialized") {
        const sorted = sortWarehousesByStrategy(itemInv, strategy);
        let needed = rem;
        for (const inv of sorted) {
          if (needed <= 0) break;
          const avail = inv.serialNumbers?.filter(sn => sn.available) || [];
          const pick = avail.slice(0, needed);
          if (pick.length > 0) { newPending.push({ lineId: line.id, warehouse: inv.warehouse, qty: pick.length, serialNumbers: pick.map(sn => sn.serial) }); needed -= pick.length; }
        }
        if (needed < rem) count++;
        return;
      }
      if (line.itemType === "Lot Controlled") {
        const sorted = sortWarehousesByStrategy(itemInv, strategy);
        let lotRem = rem;
        for (const inv of sorted) {
          if (lotRem <= 0) break;
          for (const lot of (inv.lots || [])) {
            if (lotRem <= 0) break;
            const avail = lot.qty - lot.reserved;
            if (avail <= 0) continue;
            const take = Math.min(avail, lotRem);
            newPending.push({ lineId: line.id, warehouse: inv.warehouse, qty: take, lotNumber: lot.lotNumber });
            lotRem -= take;
          }
        }
        if (lotRem < rem) count++;
        return;
      }
      const sorted = sortWarehousesByStrategy(itemInv, strategy);
      let leftover = rem;
      for (const inv of sorted) {
        if (leftover <= 0) break;
        const avail = Math.max(0, inv.onHand - inv.reserved);
        if (avail <= 0) continue;
        const take = Math.min(avail, leftover);
        newPending.push({ lineId: line.id, warehouse: inv.warehouse, qty: take });
        leftover -= take;
      }
      if (leftover < rem) count++;
    });
    setPendingAllocations(prev => [...prev, ...newPending]);
    const lb = STRATEGIES.find(s => s.id === strategy)?.label || strategy;
    if (count > 0) toast.success(`${lb}: Auto-allocated ${count} item(s)`); else toast.info(`${lb}: No items eligible`);
  }, [activeLines, store, pendingAllocations]);

  /* ── Undo All ── */
  const handleUndoAll = () => { setPendingAllocations([]); setLocationQtys({}); setLotQtys({}); toast.info("All pending changes undone"); };

  /* ── Save ── */
  const handleSave = useCallback(() => {
    const byLine = new Map<string, PendingAllocation[]>();
    pendingAllocations.forEach(p => { const arr = byLine.get(p.lineId) || []; arr.push(p); byLine.set(p.lineId, arr); });
    let ok = 0, fail = 0;
    byLine.forEach((allocs, lineId) => {
      const line = activeLines.find(l => l.id === lineId);
      const existing: Allocation[] = line?.allocations.filter(a => !a.locked) || [];
      const newAllocs: Allocation[] = allocs.map((a, i) => ({
        id: `ALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
        warehouse: a.warehouse, qty: a.qty, lotNumber: a.lotNumber, serialNumbers: a.serialNumbers, locked: false,
      }));
      if (store.allocate(so.id, lineId, [...existing, ...newAllocs])) ok++; else fail++;
    });
    if (ok > 0) toast.success(`Allocations saved for ${ok} line(s)`);
    if (fail > 0) toast.error(`${fail} line(s) failed`);
    onClose();
  }, [pendingAllocations, store, so.id, onClose, activeLines]);

  const isDirty = pendingAllocations.length > 0 || Object.values(locationQtys).some(v => v > 0) || Object.values(lotQtys).some(v => v > 0);
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleSave, onClose: guardedClose, confirmDisabled: totalPendingChanges === 0 });

  /* ── Filters ── */
  const filteredItems = useMemo(() => {
    if (!searchLeft) return activeLines.map((l, i) => ({ line: l, idx: i }));
    const q = searchLeft.toLowerCase();
    return activeLines.map((l, i) => ({ line: l, idx: i })).filter(({ line }) =>
      line.itemCode.toLowerCase().includes(q) || line.itemName.toLowerCase().includes(q)
    );
  }, [activeLines, searchLeft]);

  const filteredWarehouses = useMemo(() => {
    if (!searchRight) return inventoryForItem;
    const q = searchRight.toLowerCase();
    return inventoryForItem.filter(inv => inv.warehouse.toLowerCase().includes(q));
  }, [inventoryForItem, searchRight]);

  const pendingForCurrent = pendingAllocations.filter(p => p.lineId === selected.id);
  const totalPendingForCurrent = pendingForCurrent.reduce((s, p) => s + p.qty, 0);
  const totalAllocDisplay = selected.allocatedQty + totalPendingForCurrent;

  /* ── Serial helpers ── */
  const allSerials = useMemo(() =>
    inventoryForItem.flatMap(inv =>
      (inv.serialNumbers || []).filter(sn => sn.available).map(sn => ({ serial: sn.serial, warehouse: inv.warehouse }))
    ), [inventoryForItem]);

  const filteredSerials = useMemo(() => {
    if (!searchRight) return allSerials;
    const q = searchRight.toLowerCase();
    return allSerials.filter(s => s.serial.toLowerCase().includes(q) || s.warehouse.toLowerCase().includes(q));
  }, [allSerials, searchRight]);

  /* ── Lot helpers ── */
  const aggregatedLots = useMemo(() => aggregateLots(inventoryForItem), [inventoryForItem]);
  const filteredLots = useMemo(() => {
    if (!searchRight) return aggregatedLots;
    const q = searchRight.toLowerCase();
    return aggregatedLots.filter(l => l.lotNumber.toLowerCase().includes(q));
  }, [aggregatedLots, searchRight]);

  const selectedSerialCount = pendingSerialSelections.length;
  const selectedLotQtyTotal = Object.values(lotQtys).reduce((s, v) => s + v, 0);
  const uom = "EA";

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */
  if (noActiveLines) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
        <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
        <div className="relative bg-card border border-border text-center" style={{ padding: 28, borderRadius: 12, boxShadow: "var(--elevation-3)" }}>
          <p className="text-foreground/40" style={{ ...caption }}>No active lines to allocate.</p>
          <button onClick={onClose} className="bg-primary text-primary-foreground" style={{ ...captionMed, marginTop: 12, padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}

      <div
        className="relative bg-card flex flex-col overflow-hidden border border-border"
        style={{ width: "90vw", height: "88vh", maxWidth: 980, maxHeight: 820, borderRadius: 14, boxShadow: "var(--elevation-4)" }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: "12px 20px" }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <div className="flex items-center justify-center shrink-0 bg-primary" style={{ width: 32, height: 32, borderRadius: 10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="var(--primary-foreground)" strokeWidth="1.2" fill="none" />
                <circle cx="8" cy="8" r="3" stroke="var(--primary-foreground)" strokeWidth="1.2" fill="none" />
                <circle cx="8" cy="8" r="1" fill="var(--primary-foreground)" />
              </svg>
            </div>
            <div>
              <div className="text-foreground" style={{ ...labelSemi, lineHeight: 1.2 }}>Allocate Inventory</div>
              <div className="text-foreground/45" style={{ ...F, fontSize: "var(--text-small)", lineHeight: 1.3 }}>Hard-commit inventory to shipment line items at your chosen specificity level</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {totalPendingChanges > 0 && (
              <button onClick={handleUndoAll} className="flex items-center border border-chart-3 text-chart-3 bg-card hover:bg-chart-3/5" style={{ ...captionMed, gap: 4, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>
                <RotateCcw style={{ width: 12, height: 12 }} /> Undo All
              </button>
            )}
            <div className="relative">
              <button onClick={() => setShowAutoAllocMenu(!showAutoAllocMenu)} className="flex items-center border border-border bg-card text-foreground/70 hover:bg-secondary" style={{ ...captionMed, gap: 5, padding: "5px 12px", borderRadius: 8, cursor: "pointer", transition: "background 120ms" }}>
                <Sparkles style={{ width: 13, height: 13, color: "var(--primary)" }} /> Auto Allocate All (FIFO) <ChevronDown style={{ width: 11, height: 11, opacity: 0.4 }} />
              </button>
              {showAutoAllocMenu && (
                <>
                  <div className="fixed inset-0" style={{ zIndex: "var(--z-overlay)" }} onClick={() => setShowAutoAllocMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border overflow-hidden" style={{ width: 280, borderRadius: 10, zIndex: "var(--z-dropdown)", boxShadow: "var(--elevation-3)" }}>
                    <div className="border-b border-border" style={{ padding: "8px 12px" }}>
                      <div className="flex items-center text-foreground/35" style={{ gap: 5 }}>
                        <ArrowDownUp style={{ width: 11, height: 11 }} />
                        <span style={{ ...micro, fontSize: "var(--text-micro)" }}>ALLOCATION STRATEGY</span>
                      </div>
                    </div>
                    {STRATEGIES.map(s => (
                      <button key={s.id} onClick={() => handleAutoAllocateStrategy(s.id)} className="w-full text-left hover:bg-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", transition: "background 120ms" }}>
                        <div className="flex items-center justify-center shrink-0 bg-primary/[0.08]" style={{ width: 24, height: 24, borderRadius: 6 }}>
                          {s.id === "spread" ? <Layers style={{ width: 12, height: 12, color: "var(--primary)" }} /> : <span style={{ ...F, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "var(--primary)" }}>{s.id.slice(0, 2).toUpperCase()}</span>}
                        </div>
                        <div>
                          <div className="text-foreground" style={{ ...captionSemi }}>{s.label}</div>
                          <div className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{s.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Body ═══ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left Panel ── */}
          {!singleLineMode && (
            <div className="flex flex-col shrink-0 bg-card border-r border-border" style={{ width: 260 }}>
              {/* Search */}
              <div style={{ padding: "10px 10px 6px" }}>
                <div className="flex items-center border border-border bg-secondary/60" style={{ gap: 6, padding: "5px 8px", borderRadius: 8 }}>
                  <Search style={{ width: 13, height: 13, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
                  <input
                    value={searchLeft} onChange={e => setSearchLeft(e.target.value)}
                    placeholder="Search items..."
                    className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground/35"
                    style={{ ...F, border: "none", fontSize: "var(--text-caption)" }}
                  />
                </div>
              </div>
              {/* Counts */}
              <div className="flex items-center justify-between" style={{ padding: "0 12px 4px" }}>
                <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{activeLines.length} items</span>
                <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{fullyAllocatedCount} fully allocated</span>
              </div>
              {/* SO label */}
              <div style={{ padding: "0 12px 6px" }}>
                <span className="text-foreground/50" style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>{so.soNumber}</span>
              </div>

              {/* Item list */}
              <div className="flex-1 overflow-y-auto scroll-hover">
                {filteredItems.map(({ line, idx }) => {
                  const isActive = idx === selectedIdx;
                  const pending = pendingForLine(line.id);
                  const lineToShip = line.orderedQty - line.shippedQty;
                  const totalAlloc = line.allocatedQty + pending;
                  const isFull = totalAlloc >= lineToShip;
                  const linePct = lineToShip > 0 ? Math.min(100, (totalAlloc / lineToShip) * 100) : 0;
                  const barColor = isFull ? "var(--primary)" : totalAlloc > 0 ? "var(--accent)" : "transparent";
                  return (
                    <button
                      key={line.id}
                      onClick={() => { setSelectedIdx(idx); setSearchRight(""); setLocationQtys({}); setLotQtys({}); }}
                      className={`w-full text-left relative block border-b border-border/50 ${isActive ? "bg-primary/[0.04]" : "hover:bg-secondary/60"}`}
                      style={{ padding: "7px 10px 7px 12px", cursor: "pointer", transition: "background 100ms" }}
                    >
                      {isActive && <div className="absolute left-0 top-0 bottom-0 bg-primary" style={{ width: 3, borderRadius: "0 2px 2px 0" }} />}
                      <div className="flex" style={{ gap: 8 }}>
                        <div className="flex items-center justify-center shrink-0 bg-secondary" style={{ width: 34, height: 34, borderRadius: 17 }}>
                          <Package style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.3 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center" style={{ gap: 6, marginBottom: 1 }}>
                            <span className="text-foreground" style={{ ...captionSemi, lineHeight: 1.2 }}>{line.itemCode}</span>
                            <TypeBadge type={line.itemType} />
                            {isFull && pending > 0 && <span className="inline-block bg-primary" style={{ width: 5, height: 5, borderRadius: 3, flexShrink: 0, marginLeft: "auto" }} />}
                          </div>
                          <div className="text-foreground/45 truncate" style={{ ...F, fontSize: "var(--text-small)", lineHeight: 1.3 }}>
                            {line.itemName.length > 36 ? line.itemName.slice(0, 36) + "..." : line.itemName}
                          </div>
                          <div className="flex items-center" style={{ gap: 4, marginTop: 3 }}>
                            <span style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-semibold)", color: barColor === "transparent" ? "var(--foreground)" : barColor, opacity: barColor === "transparent" ? 0.3 : 1, lineHeight: 1 }}>
                              {totalAlloc}/{lineToShip}
                            </span>
                            <div className="flex-1 bg-border" style={{ height: 3, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 2, width: `${linePct}%`, background: barColor, transition: "width 250ms" }} />
                            </div>
                            <span className="text-foreground/25 shrink-0" style={{ ...F, fontSize: "var(--text-micro)" }}>EA</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Right Panel ── */}
          <div className="flex-1 overflow-y-auto scroll-hover">
            <div style={{ padding: "14px 20px 20px" }}>

              {/* Item Header */}
              <div className="flex items-start" style={{ gap: 10, marginBottom: 12 }}>
                <div className="flex items-center justify-center shrink-0 bg-secondary" style={{ width: 38, height: 38, borderRadius: 19 }}>
                  <Package style={{ width: 16, height: 16, color: "var(--foreground)", opacity: 0.3 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 2 }}>
                    <span className="text-foreground" style={{ ...F, fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1.2 }}>{selected.itemCode}</span>
                    <TypeBadge type={selected.itemType} />
                    <SufficiencyBadge available={totalAvailable} needed={remaining} />
                  </div>
                  <div className="text-foreground/55 truncate" style={{ ...F, fontSize: "var(--text-small)", marginBottom: 3 }}>{selected.itemName}</div>
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <span className="flex items-center text-foreground/35" style={{ ...F, gap: 3, fontSize: "var(--text-small)" }}>
                      <Package style={{ width: 10, height: 10 }} /> {so.soNumber}
                    </span>
                    <span className="flex items-center text-chart-3" style={{ ...F, gap: 3, fontSize: "var(--text-small)" }}>
                      <Clock style={{ width: 10, height: 10 }} /> Due {so.requestedDeliveryDate || "TBD"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Row — single bordered container with 3 cols */}
              <div className="grid grid-cols-3 border border-border overflow-hidden" style={{ marginBottom: 10, borderRadius: 8 }}>
                {[
                  { label: "ON HAND AVAILABLE", value: totalAvailable },
                  { label: "TO SHIP", value: toShip },
                  { label: "ALLOCATED", value: currentAllocated },
                ].map((stat, i) => (
                  <div key={stat.label} className={i < 2 ? "border-r border-border" : ""} style={{ padding: "8px 12px" }}>
                    <div className="text-foreground/35" style={{ ...micro, fontSize: "var(--text-micro)", marginBottom: 2 }}>{stat.label}</div>
                    <div className="flex items-baseline" style={{ gap: 3 }}>
                      <span className="text-foreground" style={{ ...F, fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>{stat.value}</span>
                      <span className="text-foreground/35" style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>{uom}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                <span style={{ ...captionSemi, color: pctColor }}>{currentAllocated}/{toShip} {uom}</span>
                <span style={{ ...captionSemi, color: pctColor }}>{pct}%</span>
              </div>
              <div className="bg-border" style={{ height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: pctColor, transition: "width 250ms" }} />
              </div>

              {/* Search bar */}
              <div className="flex items-center border border-border bg-secondary/60" style={{ gap: 6, padding: "6px 10px", borderRadius: 8, marginBottom: 14 }}>
                <Search style={{ width: 13, height: 13, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
                <input
                  value={searchRight} onChange={e => setSearchRight(e.target.value)}
                  placeholder={allocTab === "lot" ? "Search lots or locations..." : allocTab === "location" ? "Search locations..." : "Search by lot number or location..."}
                  className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground/35"
                  style={{ ...F, border: "none", fontSize: "var(--text-caption)" }}
                />
                {searchRight && (
                  <button onClick={() => setSearchRight("")} className="text-foreground/35 hover:text-foreground/55" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>

              {/* ── Allocations collapsible ── */}
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setAllocationsExpanded(!allocationsExpanded)} className="flex items-center" style={{ gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                  <ChevronRight style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.35, transition: "transform 150ms", transform: allocationsExpanded ? "rotate(90deg)" : "none" }} />
                  <Package style={{ width: 13, height: 13, color: "var(--foreground)", opacity: 0.35 }} />
                  <span className="text-foreground" style={{ ...captionSemi }}>Allocations</span>
                  <span className="bg-primary/[0.08] text-primary" style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-semibold)", padding: "1px 7px", borderRadius: 5, marginLeft: 2 }}>{totalAllocDisplay} {uom}</span>
                </button>
                <div className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)", marginLeft: 31, marginTop: 1 }}>
                  {selected.allocatedQty} {uom} from SO{totalPendingForCurrent > 0 ? ` · +${totalPendingForCurrent} ${uom} pending` : ""}
                </div>

                {allocationsExpanded && (
                  <div style={{ marginLeft: 31, marginTop: 8 }}>
                    {selected.allocations.length > 0 && (
                      <div className="text-foreground/30" style={{ ...micro, fontSize: "var(--text-micro)", marginBottom: 6 }}>SALES ORDER ALLOCATIONS ({selected.allocatedQty} {uom})</div>
                    )}
                    {selected.allocations.map(alloc => (
                      <div key={alloc.id} className="flex items-center justify-between border border-border" style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 4 }}>
                        <div className="flex items-center" style={{ gap: 8 }}>
                          <MapPin style={{ width: 12, height: 12, color: "var(--accent)", flexShrink: 0 }} />
                          <div>
                            <span className="text-foreground" style={{ ...captionSemi }}>{alloc.warehouse}</span>
                            <div className="text-foreground/35" style={{ ...F, fontSize: "var(--text-small)" }}>{locDetail(alloc.warehouse)}</div>
                          </div>
                        </div>
                        <div className="flex items-center" style={{ gap: 8 }}>
                          <span className="bg-foreground/[0.05] text-foreground/50" style={{ ...F, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)", padding: "1px 6px", borderRadius: 4 }}>
                            {alloc.lotNumber ? "Lot" : "Location"}
                          </span>
                          <span className="text-foreground" style={{ ...captionSemi }}>{alloc.qty} {uom}</span>
                          <button className="flex items-center text-primary border border-primary/30 bg-card hover:bg-primary/5" style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", gap: 3, padding: "2px 8px", borderRadius: 6, cursor: "pointer", transition: "background 120ms" }}>
                            <MapPin style={{ width: 10, height: 10 }} /> {alloc.lotNumber ? "Select Lots" : "Select Locations"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingForCurrent.length > 0 && (
                      <>
                        <div className="text-primary" style={{ ...micro, fontSize: "var(--text-micro)", marginTop: 6, marginBottom: 4 }}>PENDING (unsaved)</div>
                        {pendingForCurrent.map((p, i) => (
                          <div key={i} className="flex items-center justify-between border border-primary/25 bg-primary/[0.02]" style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 4 }}>
                            <div className="flex items-center" style={{ gap: 8 }}>
                              <div className="bg-primary" style={{ width: 6, height: 6, borderRadius: 3 }} />
                              <div>
                                <span className="text-foreground" style={{ ...captionSemi }}>{p.warehouse}</span>
                                <span className="text-foreground/35" style={{ ...F, fontSize: "var(--text-small)", marginLeft: 6 }}>
                                  {p.serialNumbers ? `SN: ${p.serialNumbers.join(", ")}` : p.lotNumber ? `Lot: ${p.lotNumber}` : "Quantity-only"}
                                </span>
                              </div>
                            </div>
                            <span className="text-primary" style={{ ...captionSemi }}>{p.qty} {uom}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {selected.allocations.length === 0 && pendingForCurrent.length === 0 && (
                      <div className="text-foreground/25" style={{ ...caption }}>No allocations yet</div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════ Allocate from Inventory ══════ */}
              <div className="border-t border-border" style={{ paddingTop: 14 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 2 }}>
                  <Package style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.5 }} />
                  <span className="text-foreground" style={{ ...labelSemi }}>Allocate from Inventory</span>
                  {remaining > 0 ? (
                    <span className="inline-flex bg-accent/[0.08] text-accent" style={{ ...F, padding: "1px 8px", borderRadius: 999, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-semibold)" }}>
                      {remaining} {uom} remaining
                    </span>
                  ) : (
                    <span className="inline-flex bg-primary/[0.08] text-primary" style={{ ...F, padding: "1px 8px", borderRadius: 999, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-semibold)" }}>
                      Fully allocated
                    </span>
                  )}
                </div>
                <div className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)", marginBottom: 10, marginLeft: 22 }}>
                  Choose specificity, then select inventory
                </div>

                {/* Three-way Tab Bar */}
                <div className="flex border border-border overflow-hidden" style={{ marginBottom: 10, borderRadius: 8 }}>
                  {(["quantity", "location", "lot"] as const).map((tab, i) => {
                    const labels = { quantity: "Quantity Only", location: "By Location", lot: "By Lot" };
                    const isAct = allocTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => { setAllocTab(tab); setSearchRight(""); }}
                        className={`flex-1 transition-colors ${isAct ? "bg-card text-foreground" : "bg-secondary/50 text-foreground/45 hover:bg-secondary"}`}
                        style={{
                          ...captionMed, padding: "7px 0", border: "none",
                          borderBottom: isAct ? "2px solid var(--foreground)" : "2px solid transparent",
                          fontWeight: isAct ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                          cursor: "pointer", borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                          fontSize: "var(--text-caption)", transition: "all 120ms",
                        }}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* ═══ Tab: Quantity Only ═══ */}
                {allocTab === "quantity" && (
                  <>
                    <div className="flex items-center text-foreground/40" style={{ gap: 5, marginBottom: 10 }}>
                      <Info style={{ width: 12, height: 12 }} />
                      <span style={{ ...F, fontSize: "var(--text-small)" }}>Reserve units without specifying where from</span>
                    </div>
                    <div className="border border-border" style={{ borderRadius: 8, padding: "10px 12px" }}>
                      <div className="flex items-center" style={{ gap: 6, marginBottom: 10 }}>
                        <div className="flex items-center justify-center bg-primary/[0.08]" style={{ width: 18, height: 18, borderRadius: 9 }}>
                          <Package style={{ width: 9, height: 9, color: "var(--primary)" }} />
                        </div>
                        <span className="text-foreground" style={{ ...captionSemi }}>Quantity-Only Allocation</span>
                      </div>
                      <div className="flex items-end flex-wrap" style={{ gap: 14 }}>
                        <div>
                          <div className="text-foreground/35" style={{ ...micro, marginBottom: 4 }}>ALLOCATE QTY</div>
                          <QtyInput value={defaultWhPendingQty} onChange={updatePendingQty} max={remaining + defaultWhPendingQty} />
                          <div className="text-foreground/30" style={{ ...F, fontSize: "var(--text-small)", marginTop: 3 }}>of {remaining + defaultWhPendingQty} {uom} remaining</div>
                        </div>
                        <div className="border border-border" style={{ borderRadius: 6, padding: "6px 10px" }}>
                          <div className="text-foreground/35" style={{ ...micro, marginBottom: 2 }}>TOTAL AVAILABLE</div>
                          <div className="text-foreground" style={{ ...labelSemi }}>{totalAvailable} {uom}</div>
                        </div>
                        <div className="border border-border" style={{ borderRadius: 6, padding: "6px 10px" }}>
                          <div className="text-foreground/35" style={{ ...micro, marginBottom: 2 }}>ACROSS</div>
                          <div className="text-foreground" style={{ ...labelSemi }}>{inventoryForItem.length} locations</div>
                        </div>
                        <button onClick={handleAllocateAll} disabled={remaining <= 0}
                          className="border border-primary text-primary bg-card hover:bg-primary/5 disabled:opacity-40"
                          style={{ ...captionMed, marginLeft: "auto", padding: "5px 14px", borderRadius: 6, cursor: remaining <= 0 ? "not-allowed" : "pointer", transition: "background 120ms" }}
                        >Allocate All</button>
                      </div>
                    </div>
                  </>
                )}

                {/* ═══ Tab: By Location ═══ */}
                {allocTab === "location" && (
                  <>
                    <div className="flex items-center text-foreground/40" style={{ gap: 5, marginBottom: 10 }}>
                      <Info style={{ width: 12, height: 12 }} />
                      <span style={{ ...F, fontSize: "var(--text-small)" }}>Reserve units from specific warehouse locations</span>
                    </div>
                    <div className="flex items-center border border-border bg-secondary/60" style={{ gap: 6, padding: "5px 10px", borderRadius: 8, marginBottom: 8 }}>
                      <Search style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
                      <input value={searchRight} onChange={e => setSearchRight(e.target.value)} placeholder="Search locations..."
                        className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground/35" style={{ ...F, border: "none", fontSize: "var(--text-caption)" }} />
                    </div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{filteredWarehouses.length} locations</span>
                      <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{pendingForCurrent.filter(p => !p.serialNumbers && !p.lotNumber).length}/{filteredWarehouses.length} selected</span>
                    </div>
                    {/* Table header */}
                    <div className="flex items-center border-b border-border" style={{ padding: "4px 0" }}>
                      <div className="text-foreground/30" style={{ ...micro, flex: 1 }}>LOCATION</div>
                      <div className="text-foreground/30 text-center" style={{ ...micro, width: 70 }}>AVAILABLE</div>
                      <div className="text-foreground/30 text-center" style={{ ...micro, width: 180 }}>ALLOCATE QTY</div>
                    </div>
                    {filteredWarehouses.map((inv) => {
                      const avail = Math.max(0, inv.onHand - inv.reserved);
                      const rowQty = locationQtys[inv.warehouse] || 0;
                      return (
                        <div key={`${inv.warehouse}-${inv.itemCode}`} className="flex items-center border-b border-border/50" style={{ padding: "7px 0" }}>
                          <div style={{ flex: 1 }}>
                            <div className="flex items-center" style={{ gap: 6 }}>
                              <div className="bg-accent" style={{ width: 6, height: 6, borderRadius: 3 }} />
                              <span className="text-foreground" style={{ ...captionSemi }}>{inv.warehouse}</span>
                            </div>
                            <div className="text-foreground/30" style={{ ...F, fontSize: "var(--text-small)", marginLeft: 12 }}>{locDetail(inv.warehouse)}</div>
                          </div>
                          <div className="text-center" style={{ width: 70 }}>
                            <span className="text-foreground" style={{ ...captionMed }}>{avail}</span>
                          </div>
                          <div className="flex items-center justify-center" style={{ width: 180, gap: 6 }}>
                            <QtyInput value={rowQty} onChange={v => handleLocationQtyChange(inv.warehouse, v, avail)} max={Math.min(avail, remaining + rowQty)} small />
                            <button onClick={() => handleLocationQtyChange(inv.warehouse, avail, avail)} className="text-foreground/40 hover:text-foreground/60" style={{ ...F, border: "none", background: "transparent", cursor: "pointer", fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}>
                              Allocate max
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredWarehouses.length === 0 && <EmptyState text="No inventory found" />}
                  </>
                )}

                {/* ═══ Tab: By Lot ═══ */}
                {allocTab === "lot" && (
                  <>
                    <div className="flex items-center text-foreground/40" style={{ gap: 5, marginBottom: 10 }}>
                      <Info style={{ width: 12, height: 12 }} />
                      <span style={{ ...F, fontSize: "var(--text-small)" }}>Reserve units from specific lot numbers at locations</span>
                    </div>
                    <div className="flex items-center border border-border bg-secondary/60" style={{ gap: 6, padding: "5px 10px", borderRadius: 8, marginBottom: 8 }}>
                      <Search style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
                      <input value={searchRight} onChange={e => setSearchRight(e.target.value)} placeholder="Search lots or locations..."
                        className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground/35" style={{ ...F, border: "none", fontSize: "var(--text-caption)" }} />
                    </div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{filteredLots.length} lots available</span>
                      <span className="text-foreground/40" style={{ ...F, fontSize: "var(--text-small)" }}>{selectedLotQtyTotal}/{remaining + selectedLotQtyTotal} selected</span>
                    </div>
                    {/* Lot rows */}
                    {filteredLots.map(lot => {
                      const avail = lot.totalQty - lot.totalReserved;
                      const isExpanded = expandedLots.has(lot.lotNumber);
                      // Compute total pending for this lot across warehouses
                      const totalLotPending = lot.warehouses.reduce((s, w) => s + (lotQtys[`${lot.lotNumber}::${w.warehouse}`] || 0), 0);
                      return (
                        <div key={lot.lotNumber} className="border border-border" style={{ borderRadius: 8, marginBottom: 6, overflow: "hidden" }}>
                          <div className="flex items-center" style={{ padding: "8px 10px", gap: 8 }}>
                            <div className="flex items-center justify-center shrink-0 bg-accent/10" style={{ width: 28, height: 28, borderRadius: 14 }}>
                              <Layers style={{ width: 13, height: 13, color: "var(--accent)" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="text-foreground" style={{ ...captionSemi }}>{lot.lotNumber}</div>
                              <div className="text-foreground/35" style={{ ...F, fontSize: "var(--text-small)" }}>
                                {avail} available · {lot.warehouses.length} location{lot.warehouses.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                            {/* Single-warehouse shortcut: inline qty */}
                            {lot.warehouses.length === 1 ? (
                              <div className="flex items-center" style={{ gap: 6 }}>
                                <QtyInput
                                  value={lotQtys[`${lot.lotNumber}::${lot.warehouses[0].warehouse}`] || 0}
                                  onChange={v => handleLotQtyChange(lot.lotNumber, lot.warehouses[0].warehouse, v, lot.warehouses[0].qty - lot.warehouses[0].reserved)}
                                  max={Math.min(lot.warehouses[0].qty - lot.warehouses[0].reserved, remaining + (lotQtys[`${lot.lotNumber}::${lot.warehouses[0].warehouse}`] || 0))}
                                  small
                                />
                                <button
                                  onClick={() => setExpandedLots(prev => { const n = new Set(prev); if (n.has(lot.lotNumber)) n.delete(lot.lotNumber); else n.add(lot.lotNumber); return n; })}
                                  className="flex items-center text-foreground/40 border border-border bg-card hover:bg-secondary"
                                  style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", gap: 3, padding: "3px 8px", borderRadius: 6, cursor: "pointer", transition: "background 120ms" }}
                                >
                                  <Eye style={{ width: 10, height: 10 }} /> View Locations ({lot.warehouses.length})
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center" style={{ gap: 6 }}>
                                {totalLotPending > 0 && <span className="text-primary" style={{ ...captionSemi }}>{totalLotPending} {uom}</span>}
                                <button
                                  onClick={() => setExpandedLots(prev => { const n = new Set(prev); if (n.has(lot.lotNumber)) n.delete(lot.lotNumber); else n.add(lot.lotNumber); return n; })}
                                  className="flex items-center text-foreground/40 border border-border bg-card hover:bg-secondary"
                                  style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", gap: 3, padding: "3px 8px", borderRadius: 6, cursor: "pointer", transition: "background 120ms" }}
                                >
                                  <Eye style={{ width: 10, height: 10 }} /> View Locations ({lot.warehouses.length})
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Expanded: per-warehouse breakdown */}
                          {isExpanded && (
                            <div className="bg-secondary/40 border-t border-border" style={{ padding: "6px 10px 8px 46px" }}>
                              {lot.warehouses.map(w => {
                                const wAvail = w.qty - w.reserved;
                                const key = `${lot.lotNumber}::${w.warehouse}`;
                                return (
                                  <div key={w.warehouse} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
                                    <div className="flex items-center" style={{ gap: 6 }}>
                                      <MapPin style={{ width: 10, height: 10, color: "var(--foreground)", opacity: 0.3 }} />
                                      <span className="text-foreground/60" style={{ ...F, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>{w.warehouse}</span>
                                      <span className="text-foreground/30" style={{ ...F, fontSize: "var(--text-small)" }}>— {wAvail} avail</span>
                                    </div>
                                    <QtyInput
                                      value={lotQtys[key] || 0}
                                      onChange={v => handleLotQtyChange(lot.lotNumber, w.warehouse, v, wAvail)}
                                      max={Math.min(wAvail, remaining + (lotQtys[key] || 0))}
                                      small
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredLots.length === 0 && (
                      selected.itemType === "Lot Controlled"
                        ? <EmptyState text="No lots match your search" />
                        : <EmptyState text="This item is not lot-controlled. Use Quantity Only or By Location." />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="shrink-0 flex items-center justify-between border-t border-border bg-card" style={{ padding: "10px 20px" }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <div className="bg-border overflow-hidden" style={{ width: 80, height: 4, borderRadius: 2 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${activeLines.length > 0 ? (fullyAllocatedCount / activeLines.length) * 100 : 0}%`,
                background: fullyAllocatedCount === activeLines.length ? "var(--primary)" : "var(--chart-3)",
                transition: "width 250ms",
              }} />
            </div>
            <span style={{ ...captionMed, color: fullyAllocatedCount === activeLines.length ? "var(--primary)" : "var(--chart-3)" }}>
              {fullyAllocatedCount}/{activeLines.length} items fully allocated
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button onClick={guardedClose}
              className="border border-border bg-card text-foreground hover:bg-secondary"
              style={{ ...captionMed, padding: "7px 18px", borderRadius: 8, cursor: "pointer", transition: "background 120ms" }}
            >Close</button>
            <button onClick={handleSave} disabled={totalPendingChanges === 0}
              className="flex items-center bg-primary text-primary-foreground disabled:opacity-40"
              style={{ ...captionMed, gap: 6, padding: "7px 18px", borderRadius: 8, border: "none", cursor: totalPendingChanges > 0 ? "pointer" : "not-allowed", transition: "opacity 120ms" }}
            >
              <Check style={{ width: 13, height: 13 }} />
              Save Allocation
              {totalPendingChanges > 0 && (
                <span className="bg-primary-foreground/20" style={{ ...F, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "1px 6px", borderRadius: 4 }}>
                  +{totalPendingChanges}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Shared QtyInput — compact +/- stepper
   ════════════════════════════════════════════════════ */
function QtyInput({ value, onChange, max, small }: { value: number; onChange: (v: number) => void; max: number; small?: boolean }) {
  const h = small ? 26 : 30;
  const w = small ? 28 : 32;
  const fw = small ? 34 : 42;
  return (
    <div className="flex items-center border border-border overflow-hidden" style={{ borderRadius: 6 }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} className="flex items-center justify-center text-foreground/45 hover:bg-secondary border-r border-border" style={{ width: w, height: h, border: "none", background: "var(--card)", cursor: "pointer", transition: "background 100ms" }}>
        <Minus style={{ width: small ? 11 : 13, height: small ? 11 : 13 }} />
      </button>
      <input
        type="number" min={0} value={value}
        onChange={e => { const v = parseInt(e.target.value) || 0; onChange(Math.max(0, Math.min(v, max))); }}
        className="text-foreground text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ ...F, width: fw, height: h, border: "none", background: "var(--card)", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
      />
      <button onClick={() => onChange(Math.min(max, value + 1))} className="flex items-center justify-center text-foreground/45 hover:bg-secondary border-l border-border" style={{ width: w, height: h, border: "none", background: "var(--card)", cursor: "pointer", transition: "background 100ms" }}>
        <Plus style={{ width: small ? 11 : 13, height: small ? 11 : 13 }} />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   EmptyState
   ════════════════════════════════════════════════════ */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center" style={{ padding: "28px 0" }}>
      <Package style={{ width: 20, height: 20, color: "var(--foreground)", opacity: 0.15, margin: "0 auto 6px" }} />
      <div className="text-foreground/25" style={{ ...F, fontSize: "var(--text-caption)" }}>{text}</div>
    </div>
  );
}
