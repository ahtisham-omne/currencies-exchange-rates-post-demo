import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Package, Truck, CheckCircle2, MapPin,
  ChevronDown, ChevronUp, User, Settings, Building2, FileText,
  Boxes, Sparkles,
} from "lucide-react";
import { Button } from "./ui/Button";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import type { SalesOrder, Shipment, SOLine, ShipmentMethod } from "./types";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { InactiveItemPill } from "../shared/InactiveItemPill";

/* ═══ Typography tokens ═══ */
const captionSemi: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const captionMed: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const microSemi: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase" as const };
const labelMed: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" };
const labelNormal: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" };

/* ═══ Shipment Method Config ═══ */
interface MethodConfig {
  key: ShipmentMethod;
  icon: typeof Truck;
  description: string;
  timeline: string;
  needsCarrier: boolean;
  needsPickupLocation: boolean;
}

const METHODS: MethodConfig[] = [
  { key: "Courier Pick Up", icon: Truck, description: "Carrier picks up from your facility", timeline: "3-7 business days", needsCarrier: true, needsPickupLocation: true },
  { key: "Courier Drop By", icon: Package, description: "Carrier delivers to customer location", timeline: "5-10 business days", needsCarrier: true, needsPickupLocation: false },
  { key: "Customer Pick Up", icon: User, description: "Customer collects from your facility", timeline: "1-2 business days", needsCarrier: false, needsPickupLocation: true },
  { key: "Self-Managed Delivery", icon: Settings, description: "You handle delivery logistics", timeline: "3-14 business days", needsCarrier: false, needsPickupLocation: false },
];

const CARRIERS = [
  "Hansen & Adkins Auto Transport",
  "UPS Freight",
  "FedEx Express Freight",
  "R+L Carriers",
  "XPO Logistics",
];

const PICKUP_LOCATIONS = [
  { name: "Conversion Plant - OH", address: "4200 Industrial Pkwy, Columbus, OH 43228", hours: "Mon-Fri 7AM-5PM" },
  { name: "Assembly Center - PA", address: "1800 Lancaster Ave, Lancaster, PA 17601", hours: "Mon-Fri 8AM-4PM" },
  { name: "South Build Facility - TX", address: "9500 Commerce St, San Antonio, TX 78227", hours: "Mon-Sat 6AM-6PM" },
];

/* ═══ Helpers ═══ */
function getShippedAllocated(line: SOLine, shipments: Shipment[]): number {
  return shipments.reduce(
    (sum, sh) => sum + sh.lines.filter(sl => sl.soLineId === line.id).reduce((s, sl) => s + sl.selectedQty, 0),
    0,
  );
}

function getUom(line: SOLine): string {
  const name = line.itemName.toLowerCase();
  if (name.includes("box")) return "BOX";
  if (name.includes("case")) return "CS";
  return "EA";
}

function getItemTypeBadge(line: SOLine): { label: string; bg: string; text: string } {
  switch (line.itemType) {
    case "Serialized":
      return { label: "Serialized", bg: "bg-chart-4/10", text: "text-chart-4" };
    case "Lot Non-Serialized":
      return { label: "Lot", bg: "bg-chart-3/10", text: "text-chart-3" };
    default:
      return { label: "Parts", bg: "bg-primary/10", text: "text-primary" };
  }
}

/* ═══ Shipping Config Dropdown Panel ═══ */
function ShippingConfigPanel({
  selectedMethod, setSelectedMethod,
  selectedCarrier, setSelectedCarrier,
  selectedPickup, setSelectedPickup,
  onClose,
}: {
  selectedMethod: ShipmentMethod;
  setSelectedMethod: (m: ShipmentMethod) => void;
  selectedCarrier: string;
  setSelectedCarrier: (c: string) => void;
  selectedPickup: string;
  setSelectedPickup: (p: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeMethod = METHODS.find(m => m.key === selectedMethod)!;
  const [carrierOpen, setCarrierOpen] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute left-0 right-0 top-full bg-card border-x border-b border-border shadow-lg"
      style={{ zIndex: 20, marginTop: -1 }}
    >
      <div style={{ padding: "var(--space-card-padding)" }}>
        <div className="grid grid-cols-2 gap-2" style={{ marginBottom: activeMethod.needsCarrier || activeMethod.needsPickupLocation ? "var(--space-card-padding)" : 0 }}>
          {METHODS.map(m => {
            const MethodIcon = m.icon;
            const isSel = m.key === selectedMethod;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMethod(m.key)}
                className={`text-left rounded-lg border transition-all ${
                  isSel
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                }`}
                style={{ padding: 12 }}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isSel ? "bg-primary/12" : "bg-secondary"}`}>
                    <MethodIcon className={`w-4 h-4 ${isSel ? "text-primary" : "text-foreground/40"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground" style={captionSemi}>{m.key}</div>
                    <div className="text-muted-foreground" style={{ ...labelNormal, marginTop: 2 }}>{m.timeline}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {activeMethod.needsCarrier && (
          <div style={{ marginBottom: activeMethod.needsPickupLocation ? "var(--space-inline-gap)" : 0 }}>
            <div className="text-muted-foreground" style={{ ...microSemi, marginBottom: 6 }}>Carrier</div>
            <div className="relative">
              <button
                onClick={() => setCarrierOpen(o => !o)}
                className="w-full flex items-center justify-between rounded-md border border-border bg-card hover:border-primary/40 transition-colors"
                style={{ padding: "8px 12px" }}
              >
                <span className="text-foreground" style={captionMed}>{selectedCarrier}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {carrierOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg" style={{ zIndex: 21 }}>
                  {CARRIERS.map(c => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCarrier(c); setCarrierOpen(false); }}
                      className={`w-full text-left transition-colors ${c === selectedCarrier ? "bg-primary/8 text-primary" : "hover:bg-secondary"}`}
                      style={{ padding: "8px 12px", ...captionMed }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeMethod.needsPickupLocation && (
          <div>
            <div className="text-muted-foreground" style={{ ...microSemi, marginBottom: 6 }}>Pickup Location</div>
            <div className="grid grid-cols-1 gap-1.5">
              {PICKUP_LOCATIONS.map(loc => {
                const isSel = loc.name === selectedPickup;
                return (
                  <button
                    key={loc.name}
                    onClick={() => setSelectedPickup(loc.name)}
                    className={`text-left rounded-md border transition-colors ${isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    style={{ padding: "8px 12px" }}
                  >
                    <div className="text-foreground" style={captionSemi}>{loc.name}</div>
                    <div className="text-muted-foreground" style={{ ...labelNormal, marginTop: 2 }}>{loc.address}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border flex justify-end" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
        <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/* ═══ Props ═══ */
interface Props {
  so: SalesOrder;
  shipments: Shipment[];
  onClose: () => void;
  onConfirm: (lines: { soLineId: string; allocationId: string; qty: number }[], method?: string, carrier?: string, pickupLocation?: string) => void;
}

/* ═══ Checkbox — Partner-consistent square check ═══ */
function Check3({ checked, indeterminate, onChange, disabled }: {
  checked: boolean; indeterminate?: boolean; onChange: (next: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked); }}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[4px] border transition-colors ${
        disabled
          ? "border-border/60 bg-secondary/60 cursor-not-allowed"
          : checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/60"
      }`}
      style={{ width: 16, height: 16 }}
      aria-checked={checked}
      role="checkbox"
    >
      {indeterminate ? (
        <span style={{ width: 8, height: 2, background: "currentColor", borderRadius: 1 }} />
      ) : checked ? (
        <CheckCircle2 style={{ width: 12, height: 12 }} />
      ) : null}
    </button>
  );
}

export function CreateShipmentModal({ so, shipments, onClose, onConfirm }: Props) {
  const [toShipQtys, setToShipQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    so.lines.forEach(l => { init[l.id] = 0; });
    return init;
  });
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [selectedMethod, setSelectedMethod] = useState<ShipmentMethod>("Courier Pick Up");
  const [selectedCarrier, setSelectedCarrier] = useState(CARRIERS[0]);
  const [selectedPickup, setSelectedPickup] = useState(PICKUP_LOCATIONS[0].name);
  const [configOpen, setConfigOpen] = useState(false);

  const activeMethod = METHODS.find(m => m.key === selectedMethod)!;

  const isDirty = selectedLines.size > 0 || Object.values(toShipQtys).some(v => v > 0) || selectedMethod !== "Courier Pick Up";
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  useModalShortcuts({ onClose: guardedClose });

  const lineData = useMemo(() => {
    return so.lines
      .filter(l => !l.cancelled)
      .map((line, idx) => {
        const allocated = getShippedAllocated(line, shipments);
        const remaining = Math.max(0, line.orderedQty - allocated);
        const fulfilled = remaining === 0;
        const uom = getUom(line);
        const badge = getItemTypeBadge(line);
        return { line, idx, allocated, remaining, fulfilled, uom, badge };
      });
  }, [so.lines, shipments]);

  const availableLines = useMemo(() => lineData.filter(d => !d.fulfilled), [lineData]);

  /* Aggregate stats for the footer summary chips. */
  const linesSelectedCount = Array.from(selectedLines).filter(id => (toShipQtys[id] || 0) > 0).length;
  const totalToShip = Array.from(selectedLines).reduce((s, id) => s + (toShipQtys[id] || 0), 0);
  const canConfirm = linesSelectedCount > 0;

  const handleQtyChange = (lineId: string, val: string, max: number) => {
    const num = Math.max(0, Math.min(max, parseInt(val) || 0));
    setToShipQtys(prev => ({ ...prev, [lineId]: num }));
    if (num > 0) {
      setSelectedLines(prev => {
        if (prev.has(lineId)) return prev;
        const next = new Set(prev);
        next.add(lineId);
        return next;
      });
    }
  };

  const toggleLine = (lineId: string, remaining: number) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
        setToShipQtys(qty => ({ ...qty, [lineId]: 0 }));
      } else {
        next.add(lineId);
        setToShipQtys(qty => (qty[lineId] > 0 ? qty : { ...qty, [lineId]: remaining }));
      }
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = availableLines.every(d => selectedLines.has(d.line.id));
    if (allSelected) {
      setSelectedLines(new Set());
      setToShipQtys(prev => {
        const next = { ...prev };
        availableLines.forEach(d => { next[d.line.id] = 0; });
        return next;
      });
    } else {
      const next = new Set(selectedLines);
      const qtyNext = { ...toShipQtys };
      availableLines.forEach(d => {
        next.add(d.line.id);
        if (!qtyNext[d.line.id]) qtyNext[d.line.id] = d.remaining;
      });
      setSelectedLines(next);
      setToShipQtys(qtyNext);
    }
  };

  const handleFullShipment = (lineId: string, remaining: number) => {
    setToShipQtys(prev => ({ ...prev, [lineId]: remaining }));
    setSelectedLines(prev => {
      if (prev.has(lineId)) return prev;
      const next = new Set(prev);
      next.add(lineId);
      return next;
    });
  };

  const handleConfirm = () => {
    const entries = lineData
      .filter(d => selectedLines.has(d.line.id) && (toShipQtys[d.line.id] || 0) > 0)
      .map(d => {
        const unlocked = d.line.allocations.find(a => !a.locked);
        const alloc = unlocked || d.line.allocations[0];
        return {
          soLineId: d.line.id,
          allocationId: alloc?.id || `auto-alloc-${d.line.id}`,
          qty: toShipQtys[d.line.id],
        };
      });
    onConfirm(
      entries,
      selectedMethod,
      activeMethod.needsCarrier ? selectedCarrier : undefined,
      activeMethod.needsPickupLocation ? selectedPickup : undefined,
    );
  };

  const configSummary = (() => {
    const parts: string[] = [selectedMethod];
    if (activeMethod.needsCarrier) parts.push(selectedCarrier);
    if (activeMethod.needsPickupLocation) parts.push(selectedPickup);
    return parts;
  })();

  const MethodIcon = activeMethod.icon;
  const allSelected = availableLines.length > 0 && availableLines.every(d => selectedLines.has(d.line.id));
  const anySelected = selectedLines.size > 0;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}

      {/* Modal */}
      <div
        className="relative bg-card rounded-lg border border-border flex flex-col overflow-hidden"
        style={{
          boxShadow: "var(--elevation-4)",
          width: 940,
          maxWidth: "calc(100vw - 48px)",
          height: "min(calc(100vh - 64px), 880px)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b border-border shrink-0"
          style={{ padding: "16px 20px" }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="rounded-lg bg-accent flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <Truck className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>
                Create New Shipment
              </div>
              <div className="flex items-center" style={{ gap: 6 }}>
                <span
                  className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20"
                  style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", padding: "1px 6px" }}
                >
                  <Sparkles style={{ width: 10, height: 10 }} />
                  Ship by Sales Order
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>·</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pick lines from this order</span>
              </div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <KbdHint keys="Esc" />
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
        </div>

        {/* ── Compact Shipping Config Trigger ── */}
        <div className="border-b border-border shrink-0 relative" style={{ padding: "0 var(--space-card-padding)" }}>
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="w-full flex items-center justify-between py-2.5 group transition-colors"
          >
            <div className="flex items-center min-w-0" style={{ gap: "var(--space-inline-gap)" }}>
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <MethodIcon className="w-3 h-3 text-primary" />
              </div>
              <div className="flex items-center flex-wrap min-w-0" style={{ gap: "6px" }}>
                {configSummary.map((part, i) => (
                  <span key={i} className="flex items-center" style={{ gap: "6px" }}>
                    {i > 0 && <span className="text-foreground/15" style={captionNormal}>·</span>}
                    <span className={i === 0 ? "text-foreground" : "text-foreground/50"} style={i === 0 ? captionSemi : captionMed}>
                      {part}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center shrink-0" style={{ gap: "6px" }}>
              <span className="text-primary group-hover:text-primary/70 transition-colors" style={labelMed}>
                {configOpen ? "Close" : "Configure"}
              </span>
              {configOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-primary group-hover:text-primary/70 transition-colors" />
                : <ChevronDown className="w-3.5 h-3.5 text-primary group-hover:text-primary/70 transition-colors" />
              }
            </div>
          </button>
          {configOpen && (
            <ShippingConfigPanel
              selectedMethod={selectedMethod}
              setSelectedMethod={setSelectedMethod}
              selectedCarrier={selectedCarrier}
              setSelectedCarrier={setSelectedCarrier}
              selectedPickup={selectedPickup}
              setSelectedPickup={setSelectedPickup}
              onClose={() => setConfigOpen(false)}
            />
          )}
        </div>

        {/* ── Scope card: locked customer + SO context ──
             Mirrors the Shipment2 wizard's group layout but with the
             customer + SO pinned to the current order. There's no
             switcher because the caller (SO detail page) is scoped
             to one order + one customer by construction. */}
        <div className="border-b border-border shrink-0 bg-secondary/40" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-md bg-card border border-border" style={{ padding: "5px 10px" }}>
              <Building2 style={{ width: 12, height: 12, color: "var(--muted-foreground)" }} />
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>Customer</span>
              <span className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>{so.customer}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-card border border-border" style={{ padding: "5px 10px" }}>
              <FileText style={{ width: 12, height: 12, color: "var(--muted-foreground)" }} />
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>Sales Order</span>
              <span className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>{so.soNumber}</span>
            </div>
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>
              Scope locked to current customer and order
            </span>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Table header bar */}
          <div
            className="bg-card border-b border-border flex items-center justify-between shrink-0"
            style={{ padding: "10px var(--space-card-padding)" }}
          >
            <div className="flex items-center gap-3">
              <Check3
                checked={allSelected}
                indeterminate={anySelected && !allSelected}
                onChange={toggleAll}
                disabled={availableLines.length === 0}
              />
              <span className="text-foreground" style={captionSemi}>Line items to ship</span>
              <span className="text-muted-foreground" style={labelNormal}>
                {availableLines.length} available
              </span>
            </div>
            <div className="flex items-center gap-3">
              {anySelected && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary" style={{ padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>
                  1 SO
                  <span className="text-primary/50">·</span>
                  {linesSelectedCount} ITEM{linesSelectedCount === 1 ? "" : "S"}
                </span>
              )}
              <button
                onClick={toggleAll}
                className="text-primary hover:text-primary/70 transition-colors"
                style={labelMed}
                disabled={availableLines.length === 0}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div
            className="bg-secondary/60 border-b border-border grid items-center shrink-0"
            style={{ gridTemplateColumns: "24px 1fr 140px 200px", gap: 12, padding: "6px var(--space-card-padding)" }}
          >
            <span />
            <span className="text-muted-foreground" style={microSemi}>Item</span>
            <span className="text-muted-foreground text-right" style={microSemi}>Quantity Fulfilment</span>
            <span className="text-muted-foreground text-right" style={microSemi}>Quantity To Ship</span>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {lineData.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground" style={captionNormal}>No line items on this order.</span>
              </div>
            )}
            {lineData.map(d => {
              const { line, idx, allocated, remaining, fulfilled, uom, badge } = d;
              const toShip = toShipQtys[line.id] || 0;
              const checked = selectedLines.has(line.id);
              const isFullShipment = toShip > 0 && toShip === remaining && !fulfilled;

              return (
                <div
                  key={line.id}
                  className={`grid items-center border-b border-border/60 last:border-b-0 transition-colors ${
                    fulfilled ? "opacity-50" : checked ? "bg-primary/[0.03]" : "hover:bg-secondary/40"
                  }`}
                  style={{ gridTemplateColumns: "24px 1fr 140px 200px", gap: 12, padding: "10px var(--space-card-padding)" }}
                >
                  {/* Row checkbox */}
                  <div>
                    <Check3
                      checked={checked}
                      onChange={() => toggleLine(line.id, remaining)}
                      disabled={fulfilled}
                    />
                  </div>

                  {/* Item cell */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground tabular-nums" style={microSemi}>
                        {String(idx + 1).padStart(3, "0")}
                      </span>
                      <span className={`inline-flex items-center rounded ${badge.bg} ${badge.text}`}
                        style={{ padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                        {badge.label}
                      </span>
                      <span className="text-foreground" style={captionSemi}>{line.itemCode}</span>
                      {/* Siblings here are 10px chips, so PO's 10px pill. */}
                      <InactiveItemPill code={line.itemCode} />
                      {isFullShipment && (
                        <span
                          className="inline-flex items-center gap-1 rounded"
                          style={{ padding: "1px 6px", fontSize: 10, fontWeight: 600, background: "rgba(16,185,129,0.10)", color: "#047857", border: "1px solid rgba(16,185,129,0.25)" }}
                        >
                          <CheckCircle2 style={{ width: 10, height: 10 }} /> Full Shipment
                        </span>
                      )}
                      {fulfilled && (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-secondary text-muted-foreground"
                          style={{ padding: "1px 6px", fontSize: 10, fontWeight: 600 }}
                        >
                          <CheckCircle2 style={{ width: 10, height: 10 }} /> Fulfilled
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate" style={{ ...labelNormal, marginTop: 2 }}>
                      {line.itemName}
                    </div>
                  </div>

                  {/* Quantity Fulfilment */}
                  <div className="text-right tabular-nums">
                    <span className="text-foreground" style={captionSemi}>{allocated}</span>
                    <span className="text-foreground/25" style={captionNormal}> / {line.orderedQty}</span>
                    <div className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em", marginTop: 2 }}>
                      {uom}
                    </div>
                  </div>

                  {/* Quantity To Ship */}
                  <div className="flex items-center justify-end gap-1.5">
                    {fulfilled ? (
                      <span className="inline-flex items-center gap-1 text-success" style={captionSemi}>
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFullShipment(line.id, remaining)}
                          className="rounded-md border border-border text-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
                          style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600 }}
                          title="Ship remaining"
                        >
                          Full
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={toShip || ""}
                          onChange={e => handleQtyChange(line.id, e.target.value, remaining)}
                          onClick={e => e.stopPropagation()}
                          placeholder="0"
                          className="rounded-md border border-border bg-input-background text-foreground text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          style={{ ...captionMed, padding: "5px 6px", width: 72 }}
                        />
                        <span className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>
                          / {remaining}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between border-t border-border shrink-0"
          style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
        >
          <div className="flex items-center" style={{ gap: 10 }}>
            {canConfirm ? (
              <>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary" style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                  1 SO <span className="text-primary/50">·</span> {linesSelectedCount} ITEM{linesSelectedCount === 1 ? "" : "S"}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary border border-border text-foreground" style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
                  <Boxes className="w-3 h-3 text-muted-foreground" />
                  {totalToShip} unit{totalToShip !== 1 ? "s" : ""}
                </div>
                <div className="inline-flex items-center gap-1.5 text-muted-foreground" style={{ padding: "4px 4px", fontSize: 11 }}>
                  <MapPin className="w-3 h-3" />
                  {selectedMethod}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground" style={labelNormal}>
                Select line items to ship
              </span>
            )}
          </div>
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <Button variant="secondary" size="sm" onClick={guardedClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!canConfirm}
              onClick={handleConfirm}
              icon={<Truck className="w-3.5 h-3.5" />}
            >
              Create Shipment
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
