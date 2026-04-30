import { useState, useMemo, useCallback } from "react";
import {
  Truck, ChevronUp, ChevronDown, Clock, Package,
  ExternalLink, Calendar, MapPin, Plus, ShieldCheck,
  CheckCircle2, FileText, User, Navigation, ArrowRight,
  ClipboardList, FileBox, Tag, ScrollText, Copy, Check,
  Layers,
} from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ShipmentStatusBadge } from "./StatusBadge";
import { CreateShipmentModal } from "./CreateShipmentModal";
import { Button } from "./ui/Button";
import { useSOStore } from "./store";
import { toast } from "sonner";
import type { Shipment, SalesOrder, ShipmentStatus } from "./types";

/* ═══ Typography (CSS var tokens only) ═══ */
const T = {
  captionSemi: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  captionMed: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  captionNormal: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
  microSemi: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" } as React.CSSProperties,
  label: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
  labelMed: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  micro: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
};

interface Props { shipments: Shipment[]; soId: string; so?: SalesOrder; }
type ShipFilter = "all" | "shipped" | "in-progress" | "preparing" | "cancelled";

/* ── Lifecycle ── */
const LIFECYCLE: ShipmentStatus[] = ["Draft", "Ready to Pick", "In Progress", "Ready", "Shipped"];
function progressPct(s: ShipmentStatus): number {
  if (s === "Cancelled") return 0;
  const i = LIFECYCLE.indexOf(s);
  return i < 0 ? 0 : Math.round((i / (LIFECYCLE.length - 1)) * 100);
}
function barColor(s: ShipmentStatus): string {
  if (s === "Cancelled") return "var(--destructive)";
  if (s === "Shipped") return "var(--accent)";
  if (s === "In Progress" || s === "Ready") return "var(--chart-3)";
  return "var(--primary)";
}

/* ── Shipment type badge ── */
function TypeBadge({ type }: { type: string }) {
  const c: Record<string, { bg: string; text: string }> = {
    Standard: { bg: "bg-secondary", text: "text-foreground/60" },
    Consolidated: { bg: "bg-primary/10", text: "text-primary" },
    Split: { bg: "bg-chart-4/10", text: "text-chart-4" },
    "Fast Execute": { bg: "bg-chart-3/10", text: "text-chart-3" },
    "Over-Ship": { bg: "bg-destructive/10", text: "text-destructive" },
    "Short Ship": { bg: "bg-chart-3/10", text: "text-chart-3" },
  };
  const v = c[type] || c.Standard;
  return (
    <span className={`inline-flex items-center ${v.bg} ${v.text}`}
      style={{ padding: "2px 8px", fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", borderRadius: 4, lineHeight: 1, whiteSpace: "nowrap" }}>
      {type}
    </span>
  );
}

/* ── Tracking URL ── */
function trackUrl(sh: Shipment): string | null {
  if (sh.trackingUrl) return sh.trackingUrl;
  if (!sh.trackingCode || !sh.carrier) return null;
  const c = sh.carrier.toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${sh.trackingCode}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${sh.trackingCode}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${sh.trackingCode}`;
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${sh.trackingCode}`;
  return null;
}

function allShipLineQty(lineId: string, shipments: Shipment[]): number {
  return shipments.reduce((sum, sh) => sum + sh.lines.filter(sl => sl.soLineId === lineId).reduce((s, sl) => s + sl.selectedQty, 0), 0);
}

/* ── Doc chips by lifecycle ── */
interface DocChip { label: string; icon: typeof FileText; color: string; bg: string }
function getDocs(status: ShipmentStatus): DocChip[] {
  const docs: DocChip[] = [];
  if (status === "Cancelled" || status === "Draft") return docs;
  if (["Ready to Pick", "In Progress", "Ready", "Shipped"].includes(status)) {
    docs.push({ label: "Pick List", icon: ClipboardList, color: "text-primary", bg: "bg-primary/8" });
    docs.push({ label: "Packing List", icon: FileBox, color: "text-chart-3", bg: "bg-chart-3/8" });
  }
  if (status === "Shipped") {
    docs.push({ label: "Shipping Label", icon: Tag, color: "text-accent", bg: "bg-accent/8" });
    docs.push({ label: "Bill of Lading", icon: ScrollText, color: "text-chart-4", bg: "bg-chart-4/8" });
  }
  return docs;
}

/* ═══ Standard Item Cell — photo placeholder + code + 2-line desc + more toggle ═══ */
const DESC_LIMIT = 55;

function ItemCell({ code, name, search, expanded, onToggle }: {
  code: string; name: string; search: string; expanded: boolean; onToggle: () => void;
}) {
  const needs = name.length > DESC_LIMIT;
  const text = expanded || !needs ? name : name.slice(0, DESC_LIMIT) + "...";
  return (
    <div className="flex items-start" style={{ gap: 8 }}>
      <div className="w-8 h-8 rounded-md bg-secondary/70 flex items-center justify-center shrink-0">
        <Package className="w-3.5 h-3.5 text-foreground/15" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-foreground" style={T.captionSemi}>
          <HighlightText text={code} search={search} />
        </span>
        <div className="text-foreground/40" style={{ fontSize: "var(--text-caption)", lineHeight: "1.4", marginTop: 1 }}>
          <HighlightText text={text} search={search} />
          {needs && (
            <>
              {" "}
              <button
                onClick={e => { e.stopPropagation(); onToggle(); }}
                className="text-primary hover:underline inline-flex items-center"
                style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", gap: 2 }}
              >
                {expanded ? "less" : "more"}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Route Card — map-like visual for Ship From / Ship To ═══ */
function RouteCard({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return null;
  return (
    <div className="border-t border-border bg-card" style={{ padding: "var(--space-card-padding)" }}>
      <div className="relative overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-xl)" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }} />
        <div className="relative flex items-stretch">
          <div className="flex-1" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <div className="flex items-center justify-center rounded-full bg-primary/12 shrink-0" style={{ width: 22, height: 22 }}>
                <div className="rounded-full bg-primary" style={{ width: 8, height: 8 }} />
              </div>
              <span className="text-foreground/40" style={T.microSemi}>Origin</span>
            </div>
            <div className="text-foreground" style={{ ...T.captionMed, lineHeight: 1.4 }}>{from || "—"}</div>
          </div>
          <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 48 }}>
            <div className="w-px flex-1" style={{ borderLeft: "2px dashed var(--border)" }} />
            <div className="flex items-center justify-center rounded-full bg-secondary border border-border" style={{ width: 28, height: 28, margin: "4px 0" }}>
              <ArrowRight className="text-foreground/30" style={{ width: 13, height: 13 }} />
            </div>
            <div className="w-px flex-1" style={{ borderLeft: "2px dashed var(--border)" }} />
          </div>
          <div className="flex-1" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <div className="flex items-center justify-center rounded-full bg-accent/12 shrink-0" style={{ width: 22, height: 22 }}>
                <MapPin className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <span className="text-foreground/40" style={T.microSemi}>Destination</span>
            </div>
            <div className="text-foreground" style={{ ...T.captionMed, lineHeight: 1.4 }}>{to || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Person chip ═══ */
function PersonChip({ name, initials, role, colorBg, colorText, useIcon }: {
  name: string; initials?: string; role: string; colorBg: string; colorText: string; useIcon?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-secondary/50 rounded-lg border border-border/50" style={{ padding: "8px 12px" }}>
      <div className={`flex items-center justify-center rounded-full ${colorBg} ${colorText} shrink-0`}
        style={{ width: 28, height: 28, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>
        {useIcon ? <User style={{ width: 13, height: 13 }} /> : (initials || "—")}
      </div>
      <div className="min-w-0">
        <div className="text-foreground truncate" style={T.captionMed}>{name}</div>
        <div className="text-foreground/35" style={T.micro}>{role}</div>
      </div>
    </div>
  );
}

/* ═══ Tracking block ═══ */
function TrackingBlock({ sh, search }: { sh: Shipment; search: string }) {
  const [copied, setCopied] = useState(false);
  const url = trackUrl(sh);
  const doCopy = () => {
    if (sh.trackingCode) {
      navigator.clipboard.writeText(sh.trackingCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  if (!sh.trackingCode && !sh.estimatedDelivery) return null;
  return (
    <div className="border-t border-border bg-card" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-1 text-foreground/35" style={{ ...T.microSemi, marginBottom: 6 }}>
            <Navigation className="shrink-0" style={{ width: 10, height: 10 }} />TRACKING
          </div>
          {sh.trackingCode ? (
            <div className="flex items-center gap-2 flex-wrap">
              <code className="inline-flex items-center bg-secondary/80 border border-border rounded-md text-foreground tabular-nums"
                style={{ padding: "5px 10px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", letterSpacing: "0.03em" }}>
                <HighlightText text={sh.trackingCode} search={search} />
              </code>
              <button onClick={e => { e.stopPropagation(); doCopy(); }}
                className={`inline-flex items-center gap-1 rounded-md border transition-all ${copied ? "border-accent/30 text-accent bg-accent/5" : "border-border text-foreground/40 hover:text-foreground/60 hover:bg-secondary"}`}
                style={{ padding: "5px 8px", fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>
                {copied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
                {copied ? "Copied" : "Copy"}
              </button>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 text-primary hover:bg-primary/5 transition-colors"
                  style={{ padding: "5px 10px", fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>
                  Track Package <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              )}
            </div>
          ) : (
            <span className="text-foreground/30" style={T.captionMed}>
              {["Draft", "Ready to Pick"].includes(sh.status) ? "Generated after shipment execution" : "—"}
            </span>
          )}
        </div>
        {sh.estimatedDelivery && (
          <div className="shrink-0 md:text-right">
            <div className="flex items-center gap-1 text-foreground/35 md:justify-end" style={{ ...T.microSemi, marginBottom: 6 }}>
              <Calendar className="shrink-0" style={{ width: 10, height: 10 }} />EST. ARRIVAL
            </div>
            <div className="text-foreground" style={T.captionMed}>{sh.estimatedDelivery}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Document footer ═══ */
function DocumentBar({ docs, shipmentNumber }: { docs: DocChip[]; shipmentNumber: string }) {
  return (
    <div className="border-t border-border bg-card" style={{ padding: "10px var(--space-card-padding)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {docs.length > 0 ? docs.map(doc => (
            <button key={doc.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
              style={{ padding: "5px 10px", fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>
              <span className={`inline-flex items-center justify-center rounded ${doc.bg} ${doc.color}`} style={{ width: 18, height: 18 }}>
                <doc.icon style={{ width: 10, height: 10 }} />
              </span>
              {doc.label}
            </button>
          )) : (
            <span className="text-foreground/20" style={T.label}>Documents available after picking begins</span>
          )}
        </div>
        <button onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground text-card hover:opacity-90 transition-opacity"
          style={{ padding: "7px 14px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
          Go to {shipmentNumber}
          <ExternalLink style={{ width: 12, height: 12, opacity: 0.7 }} />
        </button>
      </div>
    </div>
  );
}

/* ═══ Fulfillment Overview — sleek stat blocks + collapsible per-item detail ═══ */
function FulfillmentOverview({
  so, shipments, search, expandedDescs, toggleDesc,
}: {
  so: SalesOrder;
  shipments: Shipment[];
  search: string;
  expandedDescs: Set<string>;
  toggleDesc: (id: string) => void;
}) {
  const [showItems, setShowItems] = useState(false);
  const activeLines = so.lines.filter(l => !l.cancelled);
  if (activeLines.length === 0) return null;

  const totalOrdered = activeLines.reduce((s, l) => s + l.orderedQty, 0);
  const totalShipped = activeLines.reduce((s, l) => s + l.shippedQty, 0);
  const totalPicked = activeLines.reduce((s, l) => s + l.pickedQty, 0);
  const remaining = Math.max(0, totalOrdered - totalShipped);
  const pct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
  const pickedPct = totalOrdered > 0 ? Math.round((totalPicked / totalOrdered) * 100) : 0;
  const remainPct = totalOrdered > 0 ? Math.round((remaining / totalOrdered) * 100) : 0;

  const stats = [
    { label: "Shipped", value: totalShipped, total: totalOrdered, pctVal: pct, color: "var(--accent)", textClass: "text-accent", bgClass: "bg-accent" },
    { label: "Picked", value: totalPicked, total: totalOrdered, pctVal: pickedPct, color: "var(--chart-3)", textClass: "text-chart-3", bgClass: "bg-chart-3" },
    { label: "Remaining", value: remaining, total: totalOrdered, pctVal: remainPct, color: "var(--border)", textClass: "text-foreground/50", bgClass: "bg-border" },
  ];

  return (
    <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-1)" }}>
      {/* Header row */}
      <div className="flex items-center justify-between" style={{ padding: "var(--space-card-padding) var(--space-card-padding) 0" }}>
        <div className="flex items-center gap-2">
          <Layers className="text-foreground/20 shrink-0" style={{ width: 14, height: 14 }} />
          <span className="text-foreground" style={T.captionSemi}>Fulfillment</span>
          <span className="text-foreground/30 tabular-nums" style={T.label}>{totalOrdered} units · {activeLines.length} items</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-foreground tabular-nums" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" }}>{pct}%</span>
          <span className="text-foreground/30" style={T.label}>fulfilled</span>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div style={{ padding: "10px var(--space-card-padding) 0" }}>
        <div className="flex h-2 rounded-full bg-border/30 overflow-hidden">
          {totalShipped > 0 && (
            <div className="h-full transition-all duration-500 rounded-l-full" style={{ width: `${(totalShipped / totalOrdered) * 100}%`, backgroundColor: "var(--accent)" }} />
          )}
          {totalPicked > totalShipped && (
            <div className="h-full transition-all duration-500" style={{ width: `${((totalPicked - totalShipped) / totalOrdered) * 100}%`, backgroundColor: "var(--chart-3)" }} />
          )}
        </div>
      </div>

      {/* 3 stat blocks */}
      <div className="grid grid-cols-3" style={{ padding: "var(--space-card-padding)", paddingBottom: 0, gap: "var(--space-inline-gap)" }}>
        {stats.map(st => {
          const fraction = st.total > 0 ? st.value / st.total : 0;
          return (
            <div key={st.label} className="border border-border rounded-lg" style={{ padding: "10px 12px" }}>
              <div className="flex items-baseline gap-1" style={{ marginBottom: 4 }}>
                <span className={`tabular-nums ${st.textClass}`}
                  style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1.2 }}>
                  {st.value}
                </span>
                <span className="text-foreground/30 tabular-nums" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" }}>
                  / {st.total}
                </span>
              </div>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
                <div className={`rounded-full shrink-0 ${st.bgClass}`} style={{ width: 5, height: 5 }} />
                <span className="text-foreground/60" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{st.label}</span>
                <span className={`tabular-nums ${st.textClass}`} style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                  {st.pctVal}%
                </span>
              </div>
              {/* Individual mini bar */}
              <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fraction * 100}%`, backgroundColor: st.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Items toggle */}
      <div style={{ padding: "var(--space-inline-gap) var(--space-card-padding) var(--space-card-padding)" }}>
        <button
          onClick={() => setShowItems(!showItems)}
          className="inline-flex items-center gap-1.5 text-primary hover:text-primary/70 transition-colors"
          style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
        >
          {showItems ? "Hide" : "View"} item breakdown
          {showItems ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
        </button>
      </div>

      {/* Collapsible per-line items */}
      {showItems && (
        <div className="border-t border-border">
          {activeLines.map((line, idx) => {
            const sh = line.shippedQty;
            const ord = line.orderedQty;
            const full = sh >= ord;
            const partial = sh > 0 && !full;
            const linePct = ord > 0 ? Math.round((sh / ord) * 100) : 0;
            const dKey = `ov-${line.id}`;
            const isExp = expandedDescs.has(dKey);

            return (
              <div key={line.id}
                className={`flex items-center gap-3 hover:bg-secondary/30 transition-colors ${idx > 0 ? "border-t border-border/40" : ""}`}
                style={{ padding: "10px var(--space-card-padding)" }}
              >
                <div className="flex-1 min-w-0">
                  <ItemCell code={line.itemCode} name={line.itemName} search={search}
                    expanded={isExp} onToggle={() => toggleDesc(dKey)} />
                </div>

                {/* Progress bar + fraction */}
                <div className="shrink-0" style={{ minWidth: 100 }}>
                  <div className="flex items-center justify-end gap-1" style={{ marginBottom: 4 }}>
                    <span className={`tabular-nums ${full ? "text-accent" : partial ? "text-chart-3" : "text-foreground/20"}`} style={T.captionSemi}>
                      {sh}
                    </span>
                    <span className="text-foreground/15" style={T.captionNormal}>/</span>
                    <span className="text-foreground/35 tabular-nums" style={T.captionNormal}>{ord}</span>
                    <span className="text-foreground/15 ml-0.5" style={{ fontSize: "var(--text-micro)" }}>EA</span>
                  </div>
                  <div className="h-[3px] rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${linePct}%`, backgroundColor: full ? "var(--accent)" : partial ? "var(--chart-3)" : "transparent" }} />
                  </div>
                </div>

                <div className="shrink-0 text-right" style={{ minWidth: 72 }}>
                  {full ? (
                    <span className="inline-flex items-center gap-1 text-accent" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>
                      <CheckCircle2 style={{ width: 11, height: 11 }} /> Shipped
                    </span>
                  ) : partial ? (
                    <span className="text-chart-3" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>
                      {ord - sh} left
                    </span>
                  ) : (
                    <span className="text-foreground/20" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>
                      Not shipped
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ Main Tab ═══ */
export function ShipmentsTab({ shipments, soId, so }: Props) {
  const store = useSOStore();
  
  const [expandedId, setExpandedId] = useState<string | null>(shipments.length > 0 ? shipments[0].id : null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ShipFilter>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  const toggleDesc = useCallback((key: string) => {
    setExpandedDescs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const hasUnfulfilled = useMemo(() => {
    if (!so) return false;
    return so.lines.some(l => !l.cancelled && allShipLineQty(l.id, shipments) < l.orderedQty);
  }, [so, shipments]);

  const isConfirmed = so ? ["Cleared", "Partially Shipped", "Shipped"].includes(so.status) : false;
  const canCreateShipment = isConfirmed && hasUnfulfilled;

  const filtered = useMemo(() => {
    let list = shipments;
    if (filter === "shipped") list = list.filter(s => s.status === "Shipped");
    else if (filter === "in-progress") list = list.filter(s => ["In Progress", "Ready"].includes(s.status));
    else if (filter === "preparing") list = list.filter(s => ["Draft", "Ready to Pick"].includes(s.status));
    else if (filter === "cancelled") list = list.filter(s => s.status === "Cancelled");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.shipmentNumber.toLowerCase().includes(q) || (s.trackingCode || "").toLowerCase().includes(q) ||
        (s.carrier || "").toLowerCase().includes(q) || (s.assignedTo || "").toLowerCase().includes(q) ||
        s.lines.some(l => l.itemCode.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [shipments, filter, search]);

  const shipped = shipments.filter(s => s.status === "Shipped").length;
  const inProgress = shipments.filter(s => ["In Progress", "Ready"].includes(s.status)).length;
  const preparing = shipments.filter(s => ["Draft", "Ready to Pick"].includes(s.status)).length;
  const cancelled = shipments.filter(s => s.status === "Cancelled").length;

  const pills: { key: ShipFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: shipments.length },
    { key: "shipped", label: "Shipped", count: shipped },
    ...(inProgress > 0 ? [{ key: "in-progress" as const, label: "In Progress", count: inProgress }] : []),
    ...(preparing > 0 ? [{ key: "preparing" as const, label: "Preparing", count: preparing }] : []),
    ...(cancelled > 0 ? [{ key: "cancelled" as const, label: "Cancelled", count: cancelled }] : []),
  ];

  const handleCreate = (lines: { soLineId: string; allocationId: string; qty: number }[], method?: string, carrier?: string, pickupLocation?: string) => {
    const r = store.createShipment(soId, lines, so?.warehouse || "WH-Primary", method as any, carrier, pickupLocation);
    if (r) { toast.success(`Shipment ${r.shipmentNumber} created with ${lines.length} line(s)`); setShowCreateModal(false); setExpandedId(r.id); }
    else toast.error("Failed to create shipment");
  };

  /* ── Empty state ── */
  if (shipments.length === 0) {
    return (
      <>
        <div className="bg-card rounded-lg border border-border text-center" style={{ boxShadow: "var(--elevation-1)", padding: "var(--space-section-gap) var(--space-card-padding)" }}>
          <div className="inline-flex items-center justify-center rounded-xl bg-secondary" style={{ width: 48, height: 48, marginBottom: 12 }}>
            <Truck className="text-foreground/20" style={{ width: 22, height: 22 }} />
          </div>
          <div className="text-foreground/60" style={T.captionSemi}>No shipments yet</div>
          <div className="text-foreground/30 mt-1" style={T.label}>
            {isConfirmed ? "Create a shipment to start fulfilling this order." : "This order needs to be cleared before shipments can be created."}
          </div>
          {!isConfirmed && (
            <div className="flex items-center justify-center mt-3 gap-1.5">
              <ShieldCheck className="text-foreground/20" style={{ width: 13, height: 13 }} />
              <span className="text-foreground/40" style={T.labelMed}>Current status: <span className="text-foreground/60">{so?.status ?? "Unknown"}</span></span>
            </div>
          )}
          {canCreateShipment && (
            <div style={{ marginTop: "var(--space-card-padding)" }}>
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>Create Shipment</Button>
            </div>
          )}
        </div>
        {showCreateModal && so && <CreateShipmentModal so={so} shipments={shipments} onClose={() => setShowCreateModal(false)} onConfirm={handleCreate} />}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-card-padding)" }}>
      {/* ═══ 1. Search + Filters + Create button (FIRST) ═══ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 bg-card rounded-lg border border-border" style={{ boxShadow: "var(--elevation-1)" }}>
          <TabSearchBar search={search} onSearchChange={setSearch} placeholder="Search shipments, tracking, carrier..." resultCount={filtered.length} resultLabel="shipments" />
          <FilterPills pills={pills} active={filter} onSelect={setFilter} />
        </div>
        {canCreateShipment && (
          <div className="shrink-0">
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>Create Shipment</Button>
          </div>
        )}
      </div>

      {/* ═══ 2. Fulfillment Overview (with stats integrated) ═══ */}
      {so && <FulfillmentOverview so={so} shipments={shipments} search={search}
        expandedDescs={expandedDescs} toggleDesc={toggleDesc} />}

      {/* ═══ 3. Shipment cards ═══ */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-foreground/40" style={{ ...T.captionNormal, boxShadow: "var(--elevation-1)" }}>
          No shipments match your filters.
        </div>
      ) : (
        filtered.map(sh => {
          const isExp = expandedId === sh.id;
          const totalSel = sh.lines.reduce((s, l) => s + l.selectedQty, 0);
          const totalShip = sh.lines.reduce((s, l) => s + l.shippedQty, 0);
          const totalPick = sh.lines.reduce((s, l) => s + l.pickedQty, 0);
          const pct = progressPct(sh.status);
          const docs = getDocs(sh.status);

          return (
            <div key={sh.id} className="border border-border rounded-lg overflow-hidden" style={{ boxShadow: "var(--elevation-1)" }}>
              {/* ── Header ── */}
              <div
                className="flex items-center justify-between bg-card cursor-pointer hover:bg-secondary/40 transition-colors"
                style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
                onClick={() => setExpandedId(isExp ? null : sh.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExp
                    ? <ChevronUp className="text-foreground/30 shrink-0" style={{ width: 14, height: 14 }} />
                    : <ChevronDown className="text-foreground/30 shrink-0" style={{ width: 14, height: 14 }} />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Truck className="text-foreground/25" style={{ width: 13, height: 13 }} />
                      <span className="text-foreground" style={T.captionSemi}>
                        <HighlightText text={sh.shipmentNumber} search={search} />
                      </span>
                      <ShipmentStatusBadge status={sh.status} />
                      <TypeBadge type={sh.shipmentType} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-foreground/35 flex-wrap" style={T.label}>
                      {sh.shippingMode && <span>{sh.shippingMode}</span>}
                      {sh.shippingMode && sh.carrier && <span className="text-foreground/15">·</span>}
                      {sh.carrier && <span><HighlightText text={sh.carrier} search={search} /></span>}
                      <span className="text-foreground/15">·</span>
                      <span>{sh.warehouse}</span>
                      <span className="text-foreground/15">·</span>
                      <span>{totalSel} unit{totalSel !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="flex items-center gap-2 w-24">
                    <div className="flex-1 h-[3px] rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor(sh.status) }} />
                    </div>
                    <span className="text-foreground/35 tabular-nums" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>{pct}%</span>
                  </div>
                  {sh.estimatedDelivery && (
                    <div className="text-right hidden md:block">
                      <div className="text-foreground/30" style={T.micro}>Est. Arrival</div>
                      <div className="text-foreground/70" style={T.labelMed}>{sh.estimatedDelivery}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Expanded ── */}
              {isExp && (
                <div className="border-t border-border">
                  {/* Logistics grid — Shipping Mode first */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
                    {[
                      { label: "Shipping Mode", value: sh.shippingMode || "—", icon: Navigation },
                      { label: "Carrier", value: sh.carrier || "—", icon: Truck },
                      { label: "Ship Date", value: sh.shipDate || "Pending", icon: Clock },
                      { label: "Created", value: sh.createdDate || "—", icon: Calendar },
                    ].map(d => (
                      <div key={d.label} className="bg-card" style={{ padding: "12px var(--space-card-padding)" }}>
                        <div className="flex items-center gap-1 text-foreground/30" style={{ ...T.microSemi, marginBottom: 4 }}>
                          <d.icon className="shrink-0" style={{ width: 10, height: 10 }} />{d.label}
                        </div>
                        <div className="text-foreground" style={T.captionSemi}>
                          <HighlightText text={d.value} search={search} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* People */}
                  {(sh.assignedTo || sh.confirmedBy || sh.driverName) && (
                    <div className="border-t border-border bg-card" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                      <div className="flex items-center flex-wrap gap-2">
                        {sh.assignedTo && <PersonChip name={sh.assignedTo} initials={sh.assignedToInitials} role="Handler / Picker" colorBg="bg-primary/12" colorText="text-primary" />}
                        {sh.confirmedBy && <PersonChip name={sh.confirmedBy} initials={sh.confirmedByInitials} role="Confirmed by" colorBg="bg-accent/12" colorText="text-accent" />}
                        {sh.driverName && <PersonChip name={sh.driverName} role="Driver" colorBg="bg-chart-3/12" colorText="text-chart-3" useIcon />}
                      </div>
                    </div>
                  )}

                  {/* Tracking */}
                  <TrackingBlock sh={sh} search={search} />

                  {/* Route card */}
                  <RouteCard from={sh.shipFrom} to={sh.shipTo} />

                  {/* Items table — standard item cell format */}
                  <div className="border-t border-border">
                    <div className="bg-card flex items-center justify-between border-b border-border/50" style={{ padding: "8px var(--space-card-padding)" }}>
                      <span className="text-foreground/60" style={{ ...T.labelMed, fontWeight: "var(--font-weight-semibold)" }}>
                        Items ({sh.lines.length})
                      </span>
                      <span className="text-foreground/40 tabular-nums" style={T.label}>
                        {totalPick} picked · {totalShip} shipped of {totalSel}
                      </span>
                    </div>
                    {sh.lines.map((line, li) => {
                      const full = line.shippedQty >= line.selectedQty;
                      const fullPick = line.pickedQty >= line.selectedQty;
                      const partPick = line.pickedQty > 0 && !fullPick;
                      const rem = line.selectedQty - line.shippedQty;
                      const dKey = `sh-${sh.id}-${line.id}`;
                      const isDescExp = expandedDescs.has(dKey);

                      return (
                        <div key={line.id}
                          className={`flex items-center gap-3 hover:bg-secondary/30 transition-colors ${li > 0 ? "border-t border-border/40" : "border-t border-border/40"}`}
                          style={{ padding: "10px var(--space-card-padding)" }}
                        >
                          {/* Item cell */}
                          <div className="flex-1 min-w-0">
                            <ItemCell code={line.itemCode} name={line.itemName} search={search}
                              expanded={isDescExp} onToggle={() => toggleDesc(dKey)} />
                            {line.pickLocation && (
                              <div className="text-foreground/20 ml-10" style={{ ...T.micro, marginTop: 2 }}>
                                {line.stagedLocation ? `Staged: ${line.stagedLocation}` : `Pick: ${line.pickLocation}`}
                              </div>
                            )}
                          </div>

                          {/* Picked / Shipped fractions with progress bars */}
                          <div className="shrink-0 grid grid-cols-2 gap-4 text-right" style={{ minWidth: 150 }}>
                            <div>
                              <div className="text-foreground/30" style={{ ...T.microSemi, marginBottom: 2 }}>PICKED</div>
                              <div className="flex items-center justify-end gap-0.5">
                                <span className={`tabular-nums ${fullPick ? "text-accent" : partPick ? "text-chart-3" : "text-foreground/20"}`} style={T.captionMed}>
                                  {line.pickedQty}
                                </span>
                                <span className="text-foreground/15" style={T.captionNormal}>/{line.selectedQty}</span>
                              </div>
                              <div className="h-[3px] rounded-full bg-border/30 overflow-hidden" style={{ marginTop: 4 }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{
                                  width: `${line.selectedQty > 0 ? (line.pickedQty / line.selectedQty) * 100 : 0}%`,
                                  backgroundColor: fullPick ? "var(--accent)" : partPick ? "var(--chart-3)" : "transparent"
                                }} />
                              </div>
                            </div>
                            <div>
                              <div className="text-foreground/30" style={{ ...T.microSemi, marginBottom: 2 }}>SHIPPED</div>
                              <div className="flex items-center justify-end gap-0.5">
                                <span className={`tabular-nums ${full ? "text-accent" : line.shippedQty > 0 ? "text-chart-3" : "text-foreground/20"}`} style={T.captionMed}>
                                  {line.shippedQty}
                                </span>
                                <span className="text-foreground/15" style={T.captionNormal}>/{line.selectedQty}</span>
                              </div>
                              <div className="h-[3px] rounded-full bg-border/30 overflow-hidden" style={{ marginTop: 4 }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{
                                  width: `${line.selectedQty > 0 ? (line.shippedQty / line.selectedQty) * 100 : 0}%`,
                                  backgroundColor: full ? "var(--accent)" : line.shippedQty > 0 ? "var(--chart-3)" : "transparent"
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="shrink-0 text-right" style={{ minWidth: 80 }}>
                            {full ? (
                              <span className="inline-flex items-center gap-1 text-accent" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>
                                <CheckCircle2 style={{ width: 11, height: 11 }} /> Shipped
                              </span>
                            ) : line.shippedQty > 0 ? (
                              <span className="text-chart-3" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>{rem} left</span>
                            ) : fullPick ? (
                              <span className="text-chart-4" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>Ready</span>
                            ) : partPick ? (
                              <span className="text-chart-3" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>Picking</span>
                            ) : (
                              <span className="text-foreground/20" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>Pending</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Document bar + CTA */}
                  <DocumentBar docs={docs} shipmentNumber={sh.shipmentNumber} />
                </div>
              )}
            </div>
          );
        })
      )}

      {showCreateModal && so && <CreateShipmentModal so={so} shipments={shipments} onClose={() => setShowCreateModal(false)} onConfirm={handleCreate} />}
    </div>
  );
}