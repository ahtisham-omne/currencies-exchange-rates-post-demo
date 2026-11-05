import React, { useState, useMemo } from "react";
import {
  ChevronDown, ChevronUp, ChevronRight, ShoppingCart, Package, AlertTriangle,
  ExternalLink, Copy, Clock, Wrench, Check, CheckCircle, XCircle,
  Truck, ClipboardCheck, FileText, CreditCard, Send, Lock, Plus,
  Paperclip, MessageSquare, Boxes, MapPin, Upload,
} from "lucide-react";
import { HighlightText, TabSearchBar } from "./SearchHighlight";
import { ThTooltip, Tooltip } from "./Tooltip";
import { Button } from "./ui/Button";
import type {
  SalesOrder, ProcurementStatus, SOLine,
} from "./types";

/* ═══════════════════════════════════════════
   Shared helpers (kept from original)
   ═══════════════════════════════════════════ */

const DESC_TRUNCATE = 100;

function ItemCell({
  itemCode, itemName, search, expanded, onToggleExpand,
}: {
  itemCode: string; itemName: string; search: string; expanded: boolean; onToggleExpand: () => void;
}) {
  const needsTruncate = itemName.length > DESC_TRUNCATE;
  const displayText = expanded || !needsTruncate ? itemName : itemName.slice(0, DESC_TRUNCATE) + "...";
  return (
    <div className="flex items-start" style={{ gap: 8 }}>
      <div className="rounded-md bg-secondary/70 flex items-center justify-center shrink-0" style={{ width: 32, height: 32 }}>
        <Package className="w-3.5 h-3.5 text-foreground/15" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
          <HighlightText text={itemCode} search={search} />
        </span>
        <div className="text-muted-foreground" style={{ fontSize: "var(--text-caption)", lineHeight: "1.4", marginTop: 1 }}>
          <HighlightText text={displayText} search={search} />
          {needsTruncate && (
            <>
              {" "}
              <button onClick={e => { e.stopPropagation(); onToggleExpand(); }} className="text-primary hover:underline inline-flex items-center" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", gap: 2 }}>
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

function MiniProgressBar({ pct, barColor }: { pct: number; barColor: string }) {
  return (
    <div className="flex items-center" style={{ gap: 6, minWidth: 80 }}>
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-foreground/50 tabular-nums shrink-0" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const PO_STATUS_STYLES: Record<ProcurementStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-secondary", text: "text-foreground/70" },
  Submitted: { bg: "bg-primary/10", text: "text-primary" },
  Acknowledged: { bg: "bg-chart-3/10", text: "text-chart-3" },
  "Partially Received": { bg: "bg-chart-3/10", text: "text-chart-3" },
  Received: { bg: "bg-success/10", text: "text-success" },
  Cancelled: { bg: "bg-destructive/10", text: "text-destructive" },
};

const WO_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  "In Progress": { bg: "bg-primary/10", text: "text-primary" },
  "Pending": { bg: "bg-chart-3/10", text: "text-chart-3" },
  "Completed": { bg: "bg-success/10", text: "text-success" },
  "Cancelled": { bg: "bg-destructive/10", text: "text-destructive" },
};

const AVATAR_COLORS = [
  { bg: "bg-success/10", text: "text-success" },
  { bg: "bg-chart-3/10", text: "text-chart-3" },
  { bg: "bg-primary/10", text: "text-primary" },
  { bg: "bg-chart-4/10", text: "text-chart-4" },
  { bg: "bg-destructive/10", text: "text-destructive" },
];

function avatarColor(initials: string) {
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = initials.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function QtyUnit({ qty }: { qty: number }) {
  return (
    <div className="inline-flex items-center border border-border rounded-md bg-input-background overflow-hidden">
      <span className="tabular-nums text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", padding: "4px 8px" }}>{qty}</span>
      <div className="w-px self-stretch bg-border" />
      <span className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", padding: "4px 8px" }}>EA</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Section wrapper (collapsible)
   ═══════════════════════════════════════════ */

function SectionCard({
  icon, title, count, rightContent, open, onToggle, children,
}: {
  icon: React.ReactNode; title: string; count?: number; rightContent?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  /* Collapsible section card — Partner-aligned chrome:
   *   - rounded-lg + 1-px border + subtle drop shadow
   *   - light-gray header strip (#FAFBFC) with bottom divider when expanded
   *   - icon chip in primary tint to match TitledSection / DashInfoCard
   */
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div
        className="flex items-center justify-between hover:bg-[#F5F7FA] transition-colors"
        style={{ background: "#FAFBFC", padding: "0 14px", borderBottom: open ? "1px solid #EEF2F6" : "none" }}
      >
        <button onClick={onToggle} className="flex items-center text-left transition-opacity" style={{ gap: 8, padding: "10px 0" }} aria-expanded={open}>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          {icon && (
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5 text-primary", style: { width: 14, height: 14 } } as React.HTMLAttributes<HTMLElement>)
                : icon}
            </div>
          )}
          <span className="text-slate-700" style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
          {count !== undefined && (
            <span
              className="text-primary bg-accent rounded-md text-center"
              style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", minWidth: 18 }}
            >
              {count}
            </span>
          )}
        </button>
        {rightContent && <div className="flex items-center">{rightContent}</div>}
      </div>
      {open && children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Mock Work Order Data
   ═══════════════════════════════════════════ */

interface WorkOrder {
  id: string;
  woNumber: string;
  status: string;
  expectedDate: string;
  items: { soLineId: string; itemCode: string; itemName: string; qty: number; completedQty: number }[];
}

function generateMockWorkOrders(so: SalesOrder): WorkOrder[] {
  const activeLines = so.lines.filter(l => !l.cancelled);
  if (activeLines.length < 3) return [];
  // Only generate WOs for orders that are Cleared or beyond
  if (["Draft", "Pending Review", "Cancelled"].includes(so.status)) return [];

  const wos: WorkOrder[] = [];
  // Take every 3rd line for a WO
  const woLines = activeLines.filter((_, i) => i % 3 === 1);
  if (woLines.length === 0) return [];

  const isShipped = so.status === "Shipped";
  const isPartial = so.status === "Partially Shipped";

  woLines.forEach((line, i) => {
    const completedQty = isShipped ? line.orderedQty : isPartial ? Math.floor(line.orderedQty * 0.6) : 0;
    wos.push({
      id: `wo-${so.id}-${i}`,
      woNumber: `WO-2026-${String(7100 + parseInt(so.id.replace(/\D/g, "") || "0") * 10 + i).padStart(4, "0")}`,
      status: isShipped ? "Completed" : isPartial ? "In Progress" : "Pending",
      expectedDate: `${String(1 + ((i + 2) % 12)).padStart(2, "0")}/${String(15 + (i * 5 % 14)).padStart(2, "0")}/2026`,
      items: [{
        soLineId: line.id,
        itemCode: line.itemCode,
        itemName: line.itemName,
        qty: line.orderedQty,
        completedQty,
      }],
    });
  });
  return wos;
}

/* ═══════════════════════════════════════════
   Mock Inventory Data
   ═══════════════════════════════════════════ */

interface InventoryCard {
  itemCode: string;
  itemName: string;
  onHand: number;
  available: number;
  allocated: number;
  location: string;
}

const LOCATIONS = [
  "Warehouse A — Aisle 1", "Warehouse A — Aisle 4", "Warehouse B — Aisle 3",
  "Warehouse B — Bay 7", "Warehouse C — Zone 2", "Distribution Center — Dock 5",
];

function generateInventoryCards(lines: SOLine[]): InventoryCard[] {
  const seen = new Set<string>();
  return lines.filter(l => !l.cancelled).filter(l => {
    if (seen.has(l.itemCode)) return false;
    seen.add(l.itemCode);
    return true;
  }).map((l, i) => {
    const onHand = 200 + ((i * 137 + l.orderedQty * 3) % 600);
    const allocated = l.allocatedQty;
    return {
      itemCode: l.itemCode,
      itemName: l.itemName,
      onHand,
      available: Math.max(0, onHand - allocated - Math.floor(onHand * 0.15)),
      allocated,
      location: LOCATIONS[i % LOCATIONS.length],
    };
  });
}

/* ═══════════════════════════════════════════
   Operational History Timeline
   ═══════════════════════════════════════════ */

interface OpEvent {
  id: string;
  type: "submitted" | "approved" | "rejected" | "cleared" | "allocation" | "po-created" | "wo-created" | "shipment" | "partial-shipment" | "invoice" | "closed";
  title: string;
  timestamp: string;
  user: string;
  userInitials: string;
  notes?: string;
  attachments?: { name: string; size: string }[];
  linkedRef?: string;
}

const EVENT_ICONS: Record<OpEvent["type"], { icon: typeof Check; color: string; bg: string }> = {
  submitted: { icon: Send, color: "text-primary", bg: "bg-primary/10" },
  approved: { icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
  rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  cleared: { icon: ClipboardCheck, color: "text-success", bg: "bg-success/10" },
  allocation: { icon: Package, color: "text-primary", bg: "bg-primary/10" },
  "po-created": { icon: ShoppingCart, color: "text-chart-4", bg: "bg-chart-4/10" },
  "wo-created": { icon: Wrench, color: "text-chart-3", bg: "bg-chart-3/10" },
  shipment: { icon: Truck, color: "text-success", bg: "bg-success/10" },
  "partial-shipment": { icon: Truck, color: "text-chart-3", bg: "bg-chart-3/10" },
  invoice: { icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
  closed: { icon: Lock, color: "text-foreground/60", bg: "bg-secondary" },
};

function generateOpHistory(so: SalesOrder): OpEvent[] {
  const events: OpEvent[] = [];
  const statuses = ["Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped"];
  const statusIdx = statuses.indexOf(so.status);
  const isCancelled = ["Cancelled", "Partially Cancelled"].includes(so.status);
  const effectiveIdx = isCancelled ? 2 : statusIdx;

  // Always has "submitted"
  if (effectiveIdx >= 1 || isCancelled) {
    events.push({
      id: "op-1", type: "submitted", title: "Order Submitted for Review",
      timestamp: `${so.createdDate} 09:14 AM`, user: "Jordan Rivera", userInitials: "JR",
      notes: "Initial submission — all line items verified against customer PO.",
    });
  }
  if (effectiveIdx >= 2) {
    events.push({
      id: "op-2", type: "approved", title: "Order Approved",
      timestamp: `${so.createdDate} 02:30 PM`, user: "Sarah Chen", userInitials: "SC",
      notes: "Credit check passed. Customer terms: Net 30.",
      attachments: [{ name: "credit-approval.pdf", size: "1.2 MB" }],
    });
    events.push({
      id: "op-3", type: "cleared", title: "Released",
      timestamp: `${so.createdDate} 04:15 PM`, user: "Marcus Webb", userInitials: "MW",
      notes: "Confirmed stock availability in Warehouse B. Picking can begin immediately for lines 1-3. Line 4 requires procurement — PO to be raised.",
      attachments: [{ name: "ops-clearance-notes.pdf", size: "840 KB" }, { name: "warehouse-check.xlsx", size: "1.5 MB" }],
    });
    events.push({
      id: "op-4", type: "allocation", title: "Inventory Allocated",
      timestamp: `${so.createdDate} 04:20 PM`, user: "System", userInitials: "SY",
      notes: `${so.lines.filter(l => !l.cancelled && l.allocatedQty > 0).length} line item(s) allocated from available stock.`,
    });
  }
  if (so.procurementOrders.length > 0) {
    events.push({
      id: "op-5", type: "po-created", title: "Purchase Order Created",
      timestamp: `${so.createdDate} 05:00 PM`, user: "Sarah Chen", userInitials: "SC",
      notes: `${so.procurementOrders[0].poNumber} raised with ${so.procurementOrders[0].vendor} for ${so.procurementOrders[0].items.length} item(s).`,
      linkedRef: so.procurementOrders[0].poNumber,
    });
  }
  if (effectiveIdx >= 3) {
    events.push({
      id: "op-6", type: "partial-shipment", title: "Partial Shipment Dispatched",
      timestamp: "01/20/2026 10:45 AM", user: "Alex Hartman", userInitials: "AH",
      notes: "Shipment SH-001 dispatched via LTL Freight. Remaining items pending procurement receipt.",
      attachments: [{ name: "packing-list-SH001.pdf", size: "2.1 MB" }, { name: "BOL-SH001.pdf", size: "950 KB" }],
      linkedRef: "SH-2026-0001",
    });
  }
  if (effectiveIdx >= 4) {
    events.push({
      id: "op-7", type: "shipment", title: "Final Shipment Dispatched",
      timestamp: "02/05/2026 11:30 AM", user: "Alex Hartman", userInitials: "AH",
      notes: "All remaining items shipped. Order fully fulfilled.",
      linkedRef: "SH-2026-0002",
    });
    events.push({
      id: "op-8", type: "invoice", title: "Invoice Generated",
      timestamp: "02/06/2026 08:00 AM", user: "System", userInitials: "SY",
      notes: "Invoice INV-2026-0089 generated for full order amount.",
      linkedRef: "INV-2026-0089",
    });
  }
  if (effectiveIdx >= 4) {
    events.push({
      id: "op-9", type: "closed", title: "Order Completed",
      timestamp: "02/15/2026 03:00 PM", user: "Marcus Webb", userInitials: "MW",
      notes: "All shipments delivered and confirmed. Payment received in full.",
    });
  }

  return events.reverse(); // newest first
}

/* ═══════════════════════════════════════════
   Main Tab Component
   ═══════════════════════════════════════════ */

interface Props { so: SalesOrder; }

export function SourcingProductionTab({ so }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleItemExpand = (key: string) => setExpandedItems(p => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  // Inline note state per event
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const procurementOrders = so.procurementOrders;
  const workOrders = useMemo(() => generateMockWorkOrders(so), [so]);
  const inventoryCards = useMemo(() => generateInventoryCards(so.lines), [so.lines]);
  const opHistory = useMemo(() => generateOpHistory(so), [so]);

  const filteredPOs = useMemo(() => {
    if (!search) return procurementOrders;
    const q = search.toLowerCase();
    return procurementOrders.filter(po =>
      po.poNumber.toLowerCase().includes(q) || po.vendor.toLowerCase().includes(q) ||
      po.items.some(it => it.itemCode.toLowerCase().includes(q) || it.itemName.toLowerCase().includes(q))
    );
  }, [procurementOrders, search]);

  const filteredWOs = useMemo(() => {
    if (!search) return workOrders;
    const q = search.toLowerCase();
    return workOrders.filter(wo =>
      wo.woNumber.toLowerCase().includes(q) ||
      wo.items.some(it => it.itemCode.toLowerCase().includes(q) || it.itemName.toLowerCase().includes(q))
    );
  }, [workOrders, search]);

  /* Ops clearance status */
  const isCleared = ["Cleared", "Partially Shipped", "Shipped"].includes(so.status);
  const isRejected = false; // would come from real data
  const isPending = ["Draft", "Pending Review"].includes(so.status);

  const handleToast = (msg: string) => {
    // Simple alert fallback — in production would use toast system
    alert(msg);
  };

  return (
    <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)" }} role="region" aria-label="Sourcing & Procurement">
      {/* ── Release Summary Card ── */}
      <div style={{ padding: "var(--space-card-padding)" }}>
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            borderColor: isCleared ? "var(--success)" : isRejected ? "var(--destructive)" : "var(--border)",
            borderLeftWidth: 3,
          }}
        >
          <div className="flex items-start gap-3 bg-card" style={{ padding: "14px 16px" }}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isCleared ? "bg-success/10" : isRejected ? "bg-destructive/10" : "bg-secondary"}`}>
              {isCleared ? <CheckCircle className="w-4 h-4 text-success" /> : isRejected ? <XCircle className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                {isCleared ? "Released" : isRejected ? "Release Rejected" : "Pending Release"}
              </div>
              {isCleared ? (
                <div className="text-foreground/50 mt-1" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${avatarColor("MW").bg} ${avatarColor("MW").text}`} style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>MW</span>
                    <span className="text-foreground/70" style={{ fontWeight: "var(--font-weight-medium)" }}>Marcus Webb</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{so.createdDate} 04:15 PM</span>
                  </div>
                  Confirmed stock availability in Warehouse B. Picking can begin immediately for lines 1-3. Line 4 requires procurement.
                </div>
              ) : (
                <div className="text-muted-foreground mt-0.5" style={{ fontSize: "var(--text-caption)" }}>
                  {isRejected ? "This order was rejected during operations review." : "This order has not yet been reviewed by operations."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search / Filter / Action Buttons Row ── */}
      <TabSearchBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search POs, WOs, items..."
        resultCount={filteredPOs.length + filteredWOs.length}
        resultLabel="records"
      >
        <Button variant="secondary" size="sm" icon={<ShoppingCart className="w-3.5 h-3.5" />} onClick={() => handleToast("Pre-populated PO creation coming soon")}>
          Create Purchase Order
        </Button>
        <Button variant="secondary" size="sm" icon={<Wrench className="w-3.5 h-3.5" />} onClick={() => handleToast("Pre-populated WO creation coming soon")}>
          Create Work Order
        </Button>
      </TabSearchBar>

      <div style={{ padding: "0 var(--space-card-padding) var(--space-card-padding)" }} className="space-y-4">

      {/* ── Purchase Orders Section ── */}
      <SectionCard
        icon={<ShoppingCart className="w-4 h-4 text-foreground/50" />}
        title="Purchase Orders"
        count={filteredPOs.length}
        rightContent={filteredPOs.length > 0 ? (
          <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
            ${filteredPOs.reduce((s, po) => s + po.totalAmount, 0).toLocaleString()}
          </span>
        ) : undefined}
        open={collapsed["po"] !== true}
        onToggle={() => toggle("po")}
      >
        {filteredPOs.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-card" style={{ padding: "32px 16px", gap: 8 }}>
            <ShoppingCart className="w-5 h-5 text-foreground/15" />
            <span className="text-muted-foreground" style={{ fontSize: "var(--text-caption)" }}>No purchase orders linked to this sales order</span>
          </div>
        ) : (
          <div className="bg-card divide-y divide-border">
            {filteredPOs.map(po => {
              const ss = PO_STATUS_STYLES[po.status];
              const ac = avatarColor(po.vendorInitials);
              const barColor = po.status === "Received" ? "var(--success)" : po.status === "Partially Received" ? "var(--chart-3)" : "var(--primary)";
              return (
                <div key={po.id} className="hover:bg-secondary/30 transition-colors" style={{ padding: "12px 16px" }}>
                  {/* PO Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <button className="text-primary hover:underline" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                        <HighlightText text={po.poNumber} search={search} />
                      </button>
                      <div className="flex items-center" style={{ gap: 5 }}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ac.bg} ${ac.text}`} style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}>{po.vendorInitials}</span>
                        <span className="text-foreground/60 truncate" style={{ fontSize: "var(--text-caption)" }}>
                          <HighlightText text={po.vendor} search={search} />
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-[2px] rounded ${ss.bg} ${ss.text}`} style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
                        {po.status}
                      </span>
                    </div>
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: "var(--text-caption)" }}>
                        <Clock className="w-3 h-3 inline mr-1" />{po.expectedDate}
                      </span>
                      <span className="text-foreground tabular-nums" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                        ${po.totalAmount.toLocaleString()}
                      </span>
                      <Tooltip text={`Open ${po.poNumber} in Procurement`} position="top">
                        <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors">
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  {/* PO Line Items */}
                  <div className="space-y-1.5 ml-1">
                    {po.items.map(it => {
                      const pct = it.orderedQty > 0 ? Math.round((it.receivedQty / it.orderedQty) * 100) : 0;
                      const expandKey = `${po.id}--${it.soLineId}`;
                      return (
                        <div key={`${po.id}-${it.soLineId}`} className="flex items-center bg-secondary/30 rounded-lg border border-border/50" style={{ padding: "6px 10px", gap: 10 }}>
                          <div className="flex-1 min-w-0">
                            <ItemCell
                              itemCode={it.itemCode} itemName={it.itemName} search={search}
                              expanded={expandedItems.has(expandKey)} onToggleExpand={() => toggleItemExpand(expandKey)}
                            />
                          </div>
                          <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                            <span className="text-foreground/50 tabular-nums" style={{ fontSize: "var(--text-caption)" }}>
                              {it.receivedQty} of {it.orderedQty} received
                            </span>
                            <div style={{ width: 60 }}>
                              <MiniProgressBar pct={pct} barColor={pct >= 100 ? "var(--success)" : "var(--chart-3)"} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Work Orders Section ── */}
      <SectionCard
        icon={<Wrench className="w-4 h-4 text-foreground/50" />}
        title="Work Orders"
        count={filteredWOs.length}
        open={collapsed["wo"] !== true}
        onToggle={() => toggle("wo")}
      >
        {filteredWOs.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-card" style={{ padding: "32px 16px", gap: 8 }}>
            <Wrench className="w-5 h-5 text-foreground/15" />
            <span className="text-muted-foreground" style={{ fontSize: "var(--text-caption)" }}>No work orders linked to this sales order</span>
          </div>
        ) : (
          <div className="bg-card divide-y divide-border">
            {filteredWOs.map(wo => {
              const ss = WO_STATUS_STYLES[wo.status] || WO_STATUS_STYLES["Pending"];
              return (
                <div key={wo.id} className="hover:bg-secondary/30 transition-colors" style={{ padding: "12px 16px" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <button className="text-primary hover:underline" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>
                        {wo.woNumber}
                      </button>
                      <span className={`inline-flex items-center px-2 py-[2px] rounded ${ss.bg} ${ss.text}`} style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
                        {wo.status}
                      </span>
                    </div>
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: "var(--text-caption)" }}>
                        <Clock className="w-3 h-3 inline mr-1" />{wo.expectedDate}
                      </span>
                      <Tooltip text={`Open ${wo.woNumber} in Production`} position="top">
                        <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors">
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-1.5 ml-1">
                    {wo.items.map(it => {
                      const pct = it.qty > 0 ? Math.round((it.completedQty / it.qty) * 100) : 0;
                      return (
                        <div key={it.soLineId} className="flex items-center bg-secondary/30 rounded-lg border border-border/50" style={{ padding: "6px 10px", gap: 10 }}>
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{it.itemCode}</span>
                            <span className="text-muted-foreground ml-2" style={{ fontSize: "var(--text-caption)" }}>{it.itemName.slice(0, 60)}</span>
                          </div>
                          <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                            <span className="text-foreground/50 tabular-nums" style={{ fontSize: "var(--text-caption)" }}>
                              {it.completedQty} of {it.qty} completed
                            </span>
                            <div style={{ width: 60 }}>
                              <MiniProgressBar pct={pct} barColor={pct >= 100 ? "var(--success)" : "var(--primary)"} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Back Order Tracking — Coming Soon ── */}
      <div className="border-2 border-dashed border-border rounded-xl flex items-center justify-center" style={{ padding: "32px 16px" }}>
        <span className="text-muted-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
          Back order tracking — Coming Soon
        </span>
      </div>

      {/* ── Inventory Overview ── */}
      <SectionCard
        icon={<Boxes className="w-4 h-4 text-foreground/50" />}
        title="Inventory Overview"
        count={inventoryCards.length}
        open={collapsed["inventory"] !== true}
        onToggle={() => toggle("inventory")}
      >
        <div className="bg-card" style={{ padding: "12px 16px" }}>
          <div className="grid grid-cols-3 gap-3">
            {inventoryCards.map(card => (
              <div key={card.itemCode} className="border border-border rounded-lg hover:border-primary/20 transition-colors" style={{ padding: "12px" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-secondary/70 flex items-center justify-center shrink-0">
                    <Package className="w-3 h-3 text-foreground/15" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground truncate" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{card.itemCode}</div>
                    <div className="text-muted-foreground truncate" style={{ fontSize: "var(--text-small)" }}>{card.itemName.slice(0, 40)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1" style={{ fontSize: "var(--text-small)" }}>
                  <div><span className="text-muted-foreground">On Hand</span><div className="text-foreground tabular-nums" style={{ fontWeight: "var(--font-weight-semibold)" }}>{card.onHand}</div></div>
                  <div><span className="text-muted-foreground">Available</span><div className="text-success tabular-nums" style={{ fontWeight: "var(--font-weight-semibold)" }}>{card.available}</div></div>
                  <div><span className="text-muted-foreground">Allocated</span><div className="text-primary tabular-nums" style={{ fontWeight: "var(--font-weight-semibold)" }}>{card.allocated}</div></div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-muted-foreground" style={{ fontSize: "var(--text-small)" }}>
                  <MapPin className="w-3 h-3 shrink-0" />{card.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Operational History Timeline ── */}
      <SectionCard
        icon={<FileText className="w-4 h-4 text-foreground/50" />}
        title="Operational History"
        count={opHistory.length}
        open={collapsed["ophistory"] !== true}
        onToggle={() => toggle("ophistory")}
      >
        <div className="bg-card" style={{ padding: "12px 16px 16px" }}>
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute" style={{ left: 15, top: 24, bottom: 8, width: 2, backgroundColor: "var(--border)" }} />

            <div className="space-y-0">
              {opHistory.map((ev, i) => {
                const cfg = EVENT_ICONS[ev.type];
                const Icon = cfg.icon;
                const ac = avatarColor(ev.userInitials);
                const isAddingNote = addingNoteFor === ev.id;

                return (
                  <div key={ev.id} className="relative flex" style={{ paddingLeft: 40, paddingBottom: i < opHistory.length - 1 ? 20 : 0, paddingTop: 4 }}>
                    {/* Timeline dot */}
                    <div className={`absolute flex items-center justify-center rounded-full ${cfg.bg}`} style={{ left: 6, top: 6, width: 20, height: 20, zIndex: 1 }}>
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Event header */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{ev.title}</span>
                        <span className="text-muted-foreground shrink-0" style={{ fontSize: "var(--text-small)" }}>{ev.timestamp}</span>
                      </div>

                      {/* User */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${ac.bg} ${ac.text}`} style={{ fontSize: "7px", fontWeight: "var(--font-weight-semibold)" }}>{ev.userInitials}</span>
                        <span className="text-foreground/50" style={{ fontSize: "var(--text-small)" }}>{ev.user}</span>
                      </div>

                      {/* Notes */}
                      {ev.notes ? (
                        <div className="text-foreground/60 rounded-md bg-secondary/50 border border-border/50" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5, padding: "8px 10px" }}>
                          {ev.notes}
                        </div>
                      ) : (
                        <div className="text-foreground/20" style={{ fontSize: "var(--text-caption)" }}>No notes</div>
                      )}

                      {/* Attachments */}
                      {ev.attachments && ev.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ev.attachments.map((att, ai) => (
                            <button key={ai} className="inline-flex items-center gap-1.5 border border-border rounded-md bg-secondary/50 hover:bg-secondary transition-colors" style={{ padding: "3px 8px", fontSize: "var(--text-small)" }}>
                              <Paperclip className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground/60">{att.name}</span>
                              <span className="text-foreground/25">{att.size}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Linked reference */}
                      {ev.linkedRef && (
                        <div className="mt-1">
                          <button className="text-primary hover:underline inline-flex items-center gap-1" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
                            <ExternalLink className="w-3 h-3" />{ev.linkedRef}
                          </button>
                        </div>
                      )}

                      {/* Add Note / Attach inline */}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => { setAddingNoteFor(isAddingNote ? null : ev.id); setNoteText(""); }}
                          className="text-foreground/25 hover:text-primary transition-colors inline-flex items-center gap-1"
                          style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}
                        >
                          <MessageSquare className="w-3 h-3" />Add Note
                        </button>
                        <button
                          className="text-foreground/25 hover:text-primary transition-colors inline-flex items-center gap-1"
                          style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}
                        >
                          <Upload className="w-3 h-3" />Attach File
                        </button>
                      </div>

                      {/* Inline note input */}
                      {isAddingNote && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            autoFocus
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add a note..."
                            className="flex-1 border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/25 outline-none focus:ring-2 focus:ring-ring"
                            style={{ fontSize: "var(--text-caption)", padding: "6px 10px" }}
                            onKeyDown={e => { if (e.key === "Escape") setAddingNoteFor(null); }}
                          />
                          <Button variant="primary" size="sm" onClick={() => { setAddingNoteFor(null); setNoteText(""); }}>Save</Button>
                          <Button variant="secondary" size="sm" onClick={() => setAddingNoteFor(null)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
