import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Package, Truck, CheckCircle2, Hash, MapPin,
  ChevronDown, ChevronUp, CircleDot, User, Settings,
} from "lucide-react";
import { Button } from "./ui/Button";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import type { SalesOrder, Shipment, SOLine, ShipmentMethod } from "./types";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";

/* ═══ Typography tokens (no hardcoded fontFamily — inherited from body) ═══ */
const captionSemi: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const captionMed: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const microStyle: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };
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
    case "Lot Controlled":
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
      className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg overflow-hidden"
      style={{ boxShadow: "var(--elevation-3)", zIndex: "var(--z-dropdown)" }}
    >
      {/* Method grid */}
      <div style={{ padding: "var(--space-card-padding)" }}>
        <div className="text-foreground/50 tracking-wider" style={{ ...microStyle, marginBottom: "var(--space-inline-gap)" }}>
          SHIPMENT METHOD
        </div>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(m => {
            const isActive = selectedMethod === m.key;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMethod(m.key)}
                className={`text-left rounded-lg border transition-all ${
                  isActive
                    ? "border-primary bg-primary/[0.03]"
                    : "border-border bg-card hover:border-foreground/15 hover:bg-secondary/30"
                }`}
                style={{ padding: "var(--space-inline-gap)" }}
              >
                <div className="flex items-start" style={{ gap: "var(--space-inline-gap)" }}>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? "bg-primary/10" : "bg-secondary"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-foreground/35"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`${isActive ? "text-foreground" : "text-foreground/70"}`} style={captionSemi}>
                      {m.key}
                    </div>
                    <div className="text-foreground/40" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)", marginTop: 1 }}>
                      {m.description}
                    </div>
                    <div className="flex items-center mt-1.5" style={{ gap: "var(--space-inline-gap)" }}>
                      <span className="text-foreground/35" style={{ fontSize: "var(--text-label)" }}>{m.timeline}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Details section */}
      {(activeMethod.needsCarrier || activeMethod.needsPickupLocation) && (
        <div className="border-t border-border" style={{ padding: "var(--space-card-padding)" }}>
          <div className="text-foreground/50 tracking-wider" style={{ ...microStyle, marginBottom: "var(--space-inline-gap)" }}>
            DETAILS
          </div>

          {/* Carrier */}
          {activeMethod.needsCarrier && (
            <div style={{ marginBottom: activeMethod.needsPickupLocation ? "var(--space-card-padding)" : 0 }}>
              <div className="text-foreground/50" style={{ ...captionNormal, marginBottom: "6px" }}>Carrier</div>
              <div className="relative">
                <button
                  onClick={() => setCarrierOpen(!carrierOpen)}
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
                  style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
                >
                  <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      <Truck className="w-3 h-3 text-foreground/35" />
                    </div>
                    <span className="text-foreground" style={captionMed}>{selectedCarrier}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-foreground/35" />
                </button>
                {carrierOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg py-1 overflow-hidden"
                    style={{ boxShadow: "var(--elevation-2)", zIndex: "var(--z-popover)" }}
                  >
                    {CARRIERS.map(c => (
                      <button
                        key={c}
                        onClick={() => { setSelectedCarrier(c); setCarrierOpen(false); }}
                        className={`w-full text-left px-4 py-2 hover:bg-secondary transition-colors flex items-center justify-between ${
                          c === selectedCarrier ? "bg-secondary/50" : ""
                        }`}
                        style={captionMed}
                      >
                        <span className="text-foreground">{c}</span>
                        {c === selectedCarrier && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pickup locations */}
          {activeMethod.needsPickupLocation && (
            <div>
              <div className="text-foreground/50" style={{ ...captionNormal, marginBottom: "6px" }}>Pick-up Location</div>
              <div className="flex flex-col" style={{ gap: "6px" }}>
                {PICKUP_LOCATIONS.map(loc => {
                  const isActive = selectedPickup === loc.name;
                  return (
                    <button
                      key={loc.name}
                      onClick={() => setSelectedPickup(loc.name)}
                      className={`text-left rounded-lg border transition-all flex items-start ${
                        isActive
                          ? "border-primary bg-primary/[0.03]"
                          : "border-border bg-card hover:border-foreground/15"
                      }`}
                      style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
                    >
                      <div className="flex items-center flex-1 min-w-0" style={{ gap: "var(--space-inline-gap)" }}>
                        <CircleDot className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-foreground/25"}`} />
                        <div className="min-w-0">
                          <div className="text-foreground" style={captionSemi}>{loc.name}</div>
                          <div className="text-foreground/40" style={{ fontSize: "var(--text-label)" }}>
                            {loc.address} · {loc.hours}
                          </div>
                        </div>
                      </div>
                      {isActive && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done button */}
      <div className="border-t border-border flex justify-end" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
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

export function CreateShipmentModal({ so, shipments, onClose, onConfirm }: Props) {
  const [toShipQtys, setToShipQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    so.lines.forEach(l => { init[l.id] = 0; });
    return init;
  });
  const [selectedMethod, setSelectedMethod] = useState<ShipmentMethod>("Courier Pick Up");
  const [selectedCarrier, setSelectedCarrier] = useState(CARRIERS[0]);
  const [selectedPickup, setSelectedPickup] = useState(PICKUP_LOCATIONS[0].name);
  const [configOpen, setConfigOpen] = useState(false);

  const activeMethod = METHODS.find(m => m.key === selectedMethod)!;

  const isDirty = Object.values(toShipQtys).some(v => v > 0) || selectedMethod !== "Courier Pick Up";
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

  const canConfirm = Object.values(toShipQtys).some(v => v > 0);
  const totalToShip = Object.values(toShipQtys).reduce((s, v) => s + v, 0);
  const linesSelected = Object.values(toShipQtys).filter(v => v > 0).length;

  const handleQtyChange = (lineId: string, val: string, max: number) => {
    const num = Math.max(0, Math.min(max, parseInt(val) || 0));
    setToShipQtys(prev => ({ ...prev, [lineId]: num }));
  };

  const handleFillAll = () => {
    const updated: Record<string, number> = {};
    lineData.forEach(d => { updated[d.line.id] = d.remaining; });
    setToShipQtys(updated);
  };

  const handleConfirm = () => {
    const entries = lineData
      .filter(d => (toShipQtys[d.line.id] || 0) > 0)
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

  /* Summary text for the collapsed shipping config trigger */
  const configSummary = (() => {
    const parts: string[] = [selectedMethod];
    if (activeMethod.needsCarrier) parts.push(selectedCarrier);
    if (activeMethod.needsPickupLocation) parts.push(selectedPickup);
    return parts;
  })();

  const MethodIcon = activeMethod.icon;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-modal)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 " style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}

      {/* Modal */}
      <div
        className="relative bg-card rounded-lg border border-border flex flex-col overflow-hidden"
        style={{
          boxShadow: "var(--elevation-4)",
          width: 900,
          maxWidth: "calc(100vw - 48px)",
          height: "min(calc(100vh - 64px), 860px)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b border-border shrink-0"
          style={{ padding: "var(--space-card-padding)" }}
        >
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Create Shipment</div>
              <div className="flex items-center" style={{ gap: "6px", marginTop: 1 }}>
                <span className="text-foreground/35" style={{ fontSize: "var(--text-caption)" }}>for</span>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-secondary border border-border text-foreground/70"
                  style={captionMed}
                >
                  <Package className="w-2.5 h-2.5 text-foreground/30" />
                  {so.soNumber}
                </span>
                <span className="text-foreground/25" style={captionNormal}>·</span>
                <span className="text-foreground/35" style={captionNormal}>{so.customer}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "8px" }}>
            <KbdHint keys="Esc" />
            <button
              onClick={guardedClose}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors border border-border hover:bg-secondary"
            >
              <X className="w-3.5 h-3.5 text-foreground/50" />
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

          {/* Dropdown panel */}
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

        {/* ── Line Items (takes all remaining space) ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Table header bar */}
          <div
            className="bg-secondary flex items-center justify-between shrink-0"
            style={{ padding: "8px var(--space-card-padding)" }}
          >
            <span className="text-foreground/50" style={microStyle}>
              LINE ITEMS TO SHIP
            </span>
            <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
              <span className="text-foreground/35" style={labelNormal}>
                {lineData.filter(d => !d.fulfilled).length} of {lineData.length} available
              </span>
              <button
                onClick={handleFillAll}
                className="text-primary hover:text-primary/70 transition-colors"
                style={labelMed}
              >
                Fill All
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full" style={{ fontSize: "var(--text-caption)" }}>
              <thead className="sticky top-0 bg-card" style={{ zIndex: 1 }}>
                <tr className="border-b border-border">
                  {[
                    { h: "#", w: 44 },
                    { h: "TYPE", w: 68 },
                    { h: "ITEM DETAILS", w: undefined },
                    { h: "FULFILLMENT", w: 120, align: "text-right" as const },
                    { h: "TO SHIP", w: 96, align: "text-center" as const },
                    { h: "UOM", w: 44 },
                  ].map((c, i) => (
                    <th
                      key={i}
                      className={`py-2 text-foreground/40 tracking-wider ${c.align || "text-left"}`}
                      style={{
                        ...microStyle,
                        width: c.w ? `${c.w}px` : undefined,
                        paddingLeft: i === 0 ? "var(--space-card-padding)" : "8px",
                        paddingRight: i === 5 ? "var(--space-card-padding)" : "8px",
                      }}
                    >
                      {c.h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineData.map(d => {
                  const { line, idx, allocated, remaining, fulfilled, uom, badge } = d;
                  const toShip = toShipQtys[line.id] || 0;
                  const lineNum = String(idx + 1).padStart(3, "0");

                  return (
                    <tr
                      key={line.id}
                      className={`border-b border-border last:border-b-0 transition-colors ${
                        fulfilled ? "opacity-40" : toShip > 0 ? "bg-primary/[0.02]" : "hover:bg-secondary/30"
                      }`}
                    >
                      {/* Line number */}
                      <td
                        className="py-2.5 text-foreground/30 tabular-nums"
                        style={{ ...captionMed, paddingLeft: "var(--space-card-padding)", paddingRight: "8px" }}
                      >
                        {lineNum}
                      </td>

                      {/* Type badge */}
                      <td style={{ padding: "0 8px" }}>
                        <span
                          className={`inline-flex items-center px-1.5 py-[2px] rounded ${badge.bg} ${badge.text}`}
                          style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Item details */}
                      <td style={{ padding: "0 8px" }}>
                        <div className="text-foreground" style={captionSemi}>{line.itemCode}</div>
                        <div className="text-foreground/35 truncate max-w-[280px]" style={{ fontSize: "var(--text-label)", marginTop: 1 }}>
                          {line.itemName}
                        </div>
                      </td>

                      {/* Fulfillment */}
                      <td className="text-right tabular-nums" style={{ padding: "0 8px" }}>
                        <span className="text-foreground" style={captionSemi}>{allocated}</span>
                        <span className="text-foreground/25" style={captionNormal}> / {line.orderedQty}</span>
                        <span className="text-foreground/30 ml-0.5 uppercase" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>
                          {uom}
                        </span>
                      </td>

                      {/* To Ship input */}
                      <td className="text-center" style={{ padding: "0 8px" }}>
                        {fulfilled ? (
                          <span
                            className="inline-flex items-center gap-1 text-accent"
                            style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Done
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={toShip || ""}
                            onChange={e => handleQtyChange(line.id, e.target.value, remaining)}
                            placeholder="0"
                            className="w-full rounded-md border border-border bg-input-background text-foreground text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            style={{ ...captionMed, padding: "5px 6px", maxWidth: 64 }}
                          />
                        )}
                      </td>

                      {/* UOM */}
                      <td
                        className="text-foreground/30 uppercase"
                        style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", paddingRight: "var(--space-card-padding)", paddingLeft: "4px" }}
                      >
                        {!fulfilled && uom}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between border-t border-border shrink-0"
          style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
        >
          <div className="flex items-center" style={{ gap: "var(--space-card-padding)" }}>
            {canConfirm ? (
              <>
                <div className="flex items-center" style={{ gap: "6px" }}>
                  <Hash className="w-3 h-3 text-foreground/20" />
                  <span className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>{linesSelected}</span>
                  <span className="text-foreground/40" style={labelNormal}>line{linesSelected !== 1 ? "s" : ""}</span>
                </div>
                <div className="w-px h-3.5 bg-border" />
                <div className="flex items-center" style={{ gap: "6px" }}>
                  <Package className="w-3 h-3 text-foreground/20" />
                  <span className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>{totalToShip}</span>
                  <span className="text-foreground/40" style={labelNormal}>unit{totalToShip !== 1 ? "s" : ""}</span>
                </div>
                <div className="w-px h-3.5 bg-border" />
                <div className="flex items-center" style={{ gap: "6px" }}>
                  <MapPin className="w-3 h-3 text-foreground/20" />
                  <span className="text-foreground/40" style={labelNormal}>{selectedMethod}</span>
                </div>
              </>
            ) : (
              <span className="text-foreground/30" style={labelNormal}>Enter quantities to create shipment</span>
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
              Confirm Selection
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}