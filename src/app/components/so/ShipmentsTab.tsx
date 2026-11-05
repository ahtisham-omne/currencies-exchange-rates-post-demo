import React, { useMemo, useState, useCallback } from "react";
import {
  Truck, ChevronUp, ChevronDown, ExternalLink, Package, Plus, MapPin, Layers, ArrowRight, Calendar,
} from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ShipmentStatusBadge } from "./StatusBadge";
import { TabHeader } from "@/app/components/shared/TabHeader";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
import { OverflowTooltip } from "./OverflowTooltip";
import type { Shipment, SalesOrder, ShipmentStatus } from "./types";

/** Cross-module link to the Shipment module's detail page.
 *  Shipment2 exposes shipment detail at `/shipments/:id`. Kept as a
 *  helper so the URL scheme has a single source of truth. */
function shipmentModuleUrl(shipmentNumber: string): string {
  return `/shipments/${encodeURIComponent(shipmentNumber)}`;
}

/* ═══ String keys — every user-facing string in this tab reads via
 *     `SH_STR.<key>` so migration to a full i18n resolver later means
 *     replacing the map, not every call site. Order-level fulfillment
 *     copy lives under `.order`; shipment-card copy lives under
 *     `.shipment` so the two number domains stay lexically distinct
 *     (order-level talks about "quantity shipped / lines shipped",
 *     shipment-level talks about "N of M staged" or "N shipped"). ═══ */
const SH_STR = {
  tab: {
    title: "Shipments",
    newShipment: "New Shipment",
    searchPlaceholder: "Search shipments, tracking, carrier...",
    resultLabelShipments: "shipments",
    resultLabelItems: "items",
    viewByShipment: "By Shipments",
    viewByLineItems: "By Line Items",
  },
  filter: {
    all: "All",
    draft: "Draft",
    readyToPick: "Ready to Pick",
    inProgress: "In Progress",
    ready: "Ready to Ship",
    shipped: "Shipped",
    cancelled: "Cancelled",
  },
  empty: {
    title: "Nothing staged or shipped yet",
    descReleased:
      "Kick off the first shipment for this order from here, or wait for the warehouse to stage stock from the shipment module.",
    descPreRelease:
      "Shipments will show up here once the warehouse starts staging stock and dispatching cartons from the shipment module.",
    noFilterMatch: "No shipments match your filters.",
  },
  order: {
    /* Order-level fulfillment header — same "quantities" noun as the
     * per-shipment card chips (mixed UOMs across the SO's line items
     * make "units" misleading here). "Line items" spelled out fully
     * so the count is unambiguous (a "line" without qualifier can
     * mean the SO line, a shipment line, or a shipment slice). */
    fulfillment: "Fulfillment",
    quantitiesShipped: "quantities shipped",
    quantitiesRemaining: "quantities remaining",
    lineItemShipped: "line item shipped",
    lineItemsShipped: "line items shipped",
  },
  shipment: {
    customerPickup: "Customer pickup",
    shipTo: "Ship to",
    /* Full "Shipped on <date>" phrase keyed as one string so re-
     * ordering for i18n (e.g. `<date> shipped`) works without call-
     * site changes. */
    shippedOnDate: (date: string) => `Shipped on ${date}`,
    openInModule: (num: string) => `Open ${num}`,
    /* Pre-departure: "47 of 47 quantities staged" (picking progress).
     * Plural "quantities" makes the unit explicit + reads naturally
     * with a count in front. "Quantities" over "units" intentionally
     * — a shipment's line items can carry mixed UOMs (EA / BOX / CS)
     * so summing them into a single "units" figure would be
     * misleading. Deliberately plural on the shipment card so it
     * stays lexically distinct from the order-level fulfillment
     * strip, which reads "N / M quantity shipped" (singular, as a
     * mass-noun aggregate). */
    qtyStaged: (staged: number, total: number) => `${staged} of ${total} quantities staged`,
    /* Post-departure: "47 quantities shipped" (final count). */
    qtyShipped: (shipped: number) => `${shipped} quantities shipped`,
    /* Caption on the right of the expanded card's line-items table
     * header. Deliberately non-numeric so the per-shipment quantity
     * from the collapsed card head isn't rendered a second time. */
    inThisShipment: "In this shipment",
    /* Aria label on the +N overflow chip in the by-item view.
     * Uses "shipment"/"shipments" split. */
    moreShipments: (n: number) => `+${n} more shipment${n === 1 ? "" : "s"}`,
    /* Count on a per-shipment slice pill (subtitle in the
     * OverflowTooltip + title attr on the inline pill). Cluster is
     * scoped to a single SO line item so its UOM is uniform across
     * every slice — the actual line UOM is wired through instead of
     * the generic "unit" so the reader sees the domain word ("3
     * CARTON", "12 EA", "2 BOX") that matches the column below. */
    sliceQty: (n: number, uom: string) => `${n} ${uom}`,
  },
  /* Shared column keys used by both the by-item view and the
   * per-shipment expanded body — kept in one place so both surfaces
   * always read identical column labels.
   *
   * `columnStaged` and `columnShipped` split by lifecycle: pre-
   * departure line-item rows track picking progress ("Staged");
   * once the shipment has departed, the same column reads "Shipped"
   * to stay aligned with the card-level chip which flips between
   * "N of M quantity staged" and "N quantity shipped". By-item view
   * aggregates across shipments (mixed states possible) so it stays
   * on "Staged" — that's picking progress across all slices. */
  table: {
    lineItemsCount: (n: number) => `Line Items (${n})`,
    columnItem: "Item",
    columnQtyToShip: "Qty to Ship",
    columnStaged: "Staged",
    columnShipped: "Shipped",
  },
  /* Route card — Staging Location ➝ Ship To labels on the expanded
   * card. Named for what the warehouse actually reads: the left anchor
   * is the staging location stock was picked to, the right anchor is
   * the customer's ship-to address. */
  route: {
    stagingLocation: "Staging Location",
    shipTo: "Ship To",
  },
  byItem: {
    aggregatedAcrossShipments: "Aggregated across all shipments",
    in: "In",
    shipmentsCategory: "Shipments",
  },
} as const;

/* ═══ Typography (CSS var tokens only) ═══ */
const T = {
  captionSemi: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  captionMed: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  captionNormal: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
  microSemi: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  label: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
  labelMed: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  micro: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
};

interface Props {
  shipments: Shipment[];
  soId: string;
  so?: SalesOrder;
  createdViaUI?: boolean;
  soStatus?: string;
  onNewShipment?: () => void;
}

type ShipFilter =
  | "all"
  | "draft"
  | "ready-to-pick"
  | "in-progress"
  | "ready"
  | "shipped"
  | "cancelled";

function allShipLineQty(lineId: string, shipments: Shipment[]): number {
  return shipments.reduce(
    (sum, sh) => sum + sh.lines.filter(sl => sl.soLineId === lineId).reduce((s, sl) => s + sl.selectedQty, 0),
    0,
  );
}

/** UOM resolver — prefers the SOLine's persisted UOM and falls back to
 *  a coarse guess from the item name so seed data without an explicit
 *  uom still renders a code next to each qty. */
function getLineUom(
  soLine: { uom?: string; itemName?: string } | undefined,
  shipLine: { itemName: string },
): string {
  if (soLine?.uom) return soLine.uom;
  const name = (soLine?.itemName || shipLine.itemName || "").toLowerCase();
  if (name.includes("box")) return "BOX";
  if (name.includes("case")) return "CS";
  return "EA";
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
        <div className="text-muted-foreground" style={{ fontSize: "var(--text-caption)", lineHeight: "1.4", marginTop: 1 }}>
          <HighlightText text={text} search={search} />
          {needs && (
            <>
              {" "}
              <button
                data-desc-toggle
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

/* ═══ Fulfillment Overview — order-level summary strip ═══
 *  Order-level fulfillment number lives here (in the summary
 *  header) — visually + lexically distinct from the per-shipment
 *  "N of M staged" copy on the cards below. */
function FulfillmentOverview({ so }: { so: SalesOrder }) {
  const activeLines = so.lines.filter(l => !l.cancelled);
  if (activeLines.length === 0) return null;

  const totalOrdered = activeLines.reduce((s, l) => s + l.orderedQty, 0);
  const totalShipped = activeLines.reduce((s, l) => s + l.shippedQty, 0);
  const remaining = Math.max(0, totalOrdered - totalShipped);
  const isComplete = totalShipped >= totalOrdered && totalOrdered > 0;
  const linesFullyShipped = activeLines.filter(l => l.shippedQty >= l.orderedQty).length;
  const totalLines = activeLines.length;

  return (
    <div
      className="flex items-center justify-between gap-3 flex-wrap"
      style={{
        borderRadius: "var(--radius-lg)",
        padding: "10px 14px",
        background: "#EBF3FF",
        border: "1px solid #A8D2FF",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Layers className="text-primary shrink-0" style={{ width: 14, height: 14 }} />
        <span className="text-foreground" style={T.captionSemi}>{SH_STR.order.fulfillment}</span>
        <SOStatusPill status={so.status} />
      </div>
      <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
        <div className="flex items-baseline" style={{ gap: 4 }}>
          <span
            className={`tabular-nums ${isComplete ? "text-emerald-700" : totalShipped > 0 ? "text-amber-700" : "text-slate-600"}`}
            style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}
          >
            {totalShipped}
          </span>
          <span className="text-slate-500 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
            / {totalOrdered}
          </span>
          <span className="text-slate-500" style={{ fontSize: 12, fontWeight: 500, marginLeft: 4 }}>
            {SH_STR.order.quantitiesShipped}
          </span>
        </div>
        {!isComplete && remaining > 0 && (
          <>
            <span className="text-foreground/20" aria-hidden>·</span>
            <div className="flex items-baseline" style={{ gap: 4 }}>
              <span className="text-amber-700 tabular-nums" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                {remaining}
              </span>
              <span className="text-slate-500" style={{ fontSize: 12, fontWeight: 500 }}>
                {SH_STR.order.quantitiesRemaining}
              </span>
            </div>
          </>
        )}
        <span className="text-foreground/20" aria-hidden>·</span>
        <div className="flex items-baseline" style={{ gap: 4 }}>
          <span
            className={`tabular-nums ${linesFullyShipped >= totalLines ? "text-emerald-700" : linesFullyShipped > 0 ? "text-amber-700" : "text-slate-600"}`}
            style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}
          >
            {linesFullyShipped}
          </span>
          <span className="text-slate-500 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
            / {totalLines}
          </span>
          <span className="text-slate-500" style={{ fontSize: 12, fontWeight: 500, marginLeft: 4 }}>
            {totalLines === 1 ? SH_STR.order.lineItemShipped : SH_STR.order.lineItemsShipped}
          </span>
        </div>
      </div>
    </div>
  );
}

/** SO status pill — kept alongside FulfillmentOverview so the summary
 *  row carries the SO-level state (Cleared / Partially Shipped / etc.)
 *  while the shipment cards below carry their own per-shipment pill. */
function SOStatusPill({ status }: { status: string }) {
  const tint: Record<string, { bg: string; text: string; border: string }> = {
    "Draft":              { bg: "rgba(100,116,139,0.10)", text: "#334155", border: "rgba(100,116,139,0.25)" },
    "Pending Review":     { bg: "rgba(245,158,11,0.12)",  text: "#B45309", border: "rgba(245,158,11,0.30)" },
    "Cleared":            { bg: "rgba(10,119,255,0.10)",  text: "#0F62D6", border: "rgba(10,119,255,0.25)" },
    "Partially Shipped":  { bg: "rgba(124,58,237,0.10)",  text: "#5B21B6", border: "rgba(124,58,237,0.28)" },
    "Shipped":            { bg: "rgba(16,185,129,0.10)",  text: "#047857", border: "rgba(16,185,129,0.28)" },
    "Cancelled":          { bg: "rgba(220,38,38,0.10)",   text: "#991B1B", border: "rgba(220,38,38,0.28)" },
    "Partially Cancelled":{ bg: "rgba(245,158,11,0.12)",  text: "#B45309", border: "rgba(245,158,11,0.30)" },
    "Archived":           { bg: "rgba(100,116,139,0.10)", text: "#475569", border: "rgba(100,116,139,0.28)" },
  };
  const c = tint[status] ?? tint["Draft"];
  const label = status === "Cleared" ? "Released" : status;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        padding: "1px 8px", borderRadius: 999,
        fontSize: 11, fontWeight: 500, lineHeight: 1.3,
        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      }}
    >
      {label}
    </span>
  );
}

/* ═══ HeaderChip — small tinted pill for a single card fact ═══
 *  Mirrors Partner Management's `PartnerChip` treatment (rounded-lg,
 *  1px border, slate-50 neutral bg) — the same visual language used
 *  across the SO detail surfaces (see ShipmentMethodModal). Each fact
 *  on the collapsed shipment card renders as its own chip so they
 *  read as discrete data points instead of one long muted sentence. */
type ChipTone = "neutral" | "primary" | "success" | "warning" | "muted";
function HeaderChip({
  icon: Icon, label, tone = "neutral", search, title,
}: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  tone?: ChipTone;
  search?: string;
  title?: string;
}) {
  const tint: Record<ChipTone, { bg: string; border: string; fg: string; iconFg: string }> = {
    neutral: { bg: "#F8FAFC",                  border: "#E2E8F0",              fg: "#475569", iconFg: "#64748B" },
    primary: { bg: "rgba(10,119,255,0.08)",    border: "rgba(10,119,255,0.25)", fg: "#0F62D6", iconFg: "#0A77FF" },
    success: { bg: "rgba(16,185,129,0.10)",    border: "rgba(16,185,129,0.28)", fg: "#047857", iconFg: "#10B981" },
    warning: { bg: "rgba(245,158,11,0.12)",    border: "rgba(245,158,11,0.30)", fg: "#B45309", iconFg: "#F59E0B" },
    muted:   { bg: "#F1F5F9",                  border: "#E2E8F0",              fg: "#94A3B8", iconFg: "#CBD5E1" },
  };
  const t = tint[tone];
  return (
    <span
      className="inline-flex items-center rounded-lg shrink-0"
      title={title}
      style={{
        gap: 6,
        padding: "2px 8px",
        fontSize: 11, fontWeight: 500,
        border: `1px solid ${t.border}`,
        backgroundColor: t.bg,
        color: t.fg,
        lineHeight: 1.4,
      }}
    >
      <Icon style={{ width: 11, height: 11, color: t.iconFg }} />
      <span className="truncate max-w-[240px]">
        {search ? <HighlightText text={label} search={search} /> : label}
      </span>
    </span>
  );
}

/* ═══ Shipment card ═══
 *  Six KEEP facts, split across the collapsed header and the expanded
 *  body so the header stays scannable and the address doesn't wrap
 *  awkwardly at narrow widths:
 *
 *  Header (always visible):
 *    1. Shipment number (linked to Shipment module)
 *    2. Status pill (`ShipmentStatusBadge` — same 6-state set as the
 *       Shipment module)
 *    3. Shipment method (carrier name, or "Customer pickup" when pickup)
 *    4. One quantity read (staged pre-departure / shipped post-)
 *    6. Shipped on — only rendered once the shipment departs
 *
 *  Expanded body (chevron toggle):
 *    5. Ship-to address (in the Staging Location ➝ Ship To route card)
 *    · Line items table for this shipment (Item / Qty to Ship / Staged)
 *
 *  Header + full-detail affordance both link to the Shipment module. */
function ShipmentCard({
  sh, search, isExp, onToggleExp, so,
}: {
  sh: Shipment; search: string; isExp: boolean; onToggleExp: () => void; so?: SalesOrder;
}) {
  const isShipped = sh.status === "Shipped";
  const isPickup = sh.departureType === "customer-pickup";

  /* Method label — carrier name if we have one, else "Customer pickup"
   *  when the departure is pickup, else the raw shipping mode. */
  const methodLabel = isPickup
    ? SH_STR.shipment.customerPickup
    : (sh.carrier || sh.shippingMode || "—");

  /* One quantity read per card — never a duplicate. Post-departure
   *  reads as "N shipped" (final count, no denominator); pre-departure
   *  reads as "N of M staged" (picking progress). Chip tone tracks
   *  fulfillment state but stays off green — green is reserved for
   *  the ShipmentStatusBadge on this card. Tint map:
   *    · shipped → neutral (status pill already signals it)
   *    · fully staged → primary
   *    · partially staged → warning
   *    · nothing staged → muted */
  const totalSel = sh.lines.reduce((s, l) => s + l.selectedQty, 0);
  const totalPick = sh.lines.reduce((s, l) => s + l.pickedQty, 0);
  const totalShip = sh.lines.reduce((s, l) => s + l.shippedQty, 0);
  const qtyLabel = isShipped
    ? SH_STR.shipment.qtyShipped(totalShip || totalSel)
    : SH_STR.shipment.qtyStaged(totalPick, totalSel);
  const qtyTone: ChipTone = isShipped
    ? "neutral"
    : totalPick === 0
      ? "muted"
      : totalPick >= totalSel
        ? "primary"
        : "warning";

  /* Status-tinted left stripe so each card reads as a distinct box
   *  and picks out its state at a glance. */
  const stripeTint: Record<ShipmentStatus, string> = {
    "Draft":          "#94A3B8",
    "Ready to Pick":  "#0A77FF",
    "In Progress":    "#F59E0B",
    "Ready":          "#7C3AED",
    "Shipped":        "#10B981",
    "Cancelled":      "#DC2626",
  };
  const stripe = stripeTint[sh.status];

  const hasRoute = !!(sh.shipFrom || sh.shipTo);

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      style={{
        boxShadow: isExp ? "var(--elevation-2)" : "var(--elevation-1)",
        borderLeft: `3px solid ${stripe}`,
      }}
    >
      <div
        className="flex items-start justify-between gap-3 cursor-pointer hover:bg-secondary/40 transition-colors"
        style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}
        onClick={onToggleExp}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {isExp
            ? <ChevronUp className="text-muted-foreground shrink-0" style={{ width: 14, height: 14, marginTop: 3 }} />
            : <ChevronDown className="text-muted-foreground shrink-0" style={{ width: 14, height: 14, marginTop: 3 }} />}
          <Truck className="text-foreground/25 shrink-0" style={{ width: 14, height: 14, marginTop: 2 }} />
          <div className="min-w-0 flex-1">
            {/* Row 1 · Shipment number (linked) + Status pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={shipmentModuleUrl(sh.shipmentNumber)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-foreground hover:text-primary hover:underline transition-colors"
                style={T.captionSemi}
              >
                <HighlightText text={sh.shipmentNumber} search={search} />
              </a>
              <ShipmentStatusBadge status={sh.status} />
            </div>

            {/* Row 2 · Chip strip — method, one quantity read, and
                (when shipped) the ship date. Each fact renders as
                its own tinted chip so the reader sees discrete data
                points, not a plaintext sentence. Quantity chip tone
                tracks the picking/shipping state so the chip's tint
                reinforces the number without needing extra copy. */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <HeaderChip
                icon={isPickup ? MapPin : Truck}
                label={methodLabel}
                tone="neutral"
                search={search}
              />
              <HeaderChip
                icon={Package}
                label={qtyLabel}
                tone={qtyTone}
              />
              {isShipped && sh.shipDate && (
                <HeaderChip
                  icon={Calendar}
                  label={SH_STR.shipment.shippedOnDate(sh.shipDate)}
                  tone="neutral"
                />
              )}
            </div>
          </div>
        </div>

        {/* Open in Shipment module — the sole action affordance on the
            card since full line-item drilldown lives there. */}
        <a
          href={shipmentModuleUrl(sh.shipmentNumber)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={SH_STR.shipment.openInModule(sh.shipmentNumber)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors shrink-0"
          style={{ padding: "5px 10px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
        >
          {SH_STR.shipment.openInModule(sh.shipmentNumber)} <ExternalLink style={{ width: 11, height: 11 }} />
        </a>
      </div>

      {/* Expanded body — Staging Location ➝ Ship To route card followed by
          the line-items table. Ship-to lives in the route card so long
          addresses no longer wrap awkwardly inside the collapsed
          header. */}
      {isExp && (
        <div className="border-t border-border" style={{ background: "var(--muted, #F8FAFC)" }}>
          <div style={{ padding: "var(--space-card-padding)", display: "flex", flexDirection: "column", gap: "var(--space-card-padding)" }}>
            {hasRoute && <RouteCard from={sh.shipFrom} to={sh.shipTo} />}
            <ShipmentLinesTable sh={sh} so={so} search={search} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Route card — Staging Location ➝ Ship To ═══
 *  Structured tile with a dashed connector and status-tinted anchor
 *  circles. Scales to long addresses without deforming the shipment
 *  card's collapsed header (previously the address was inline in the
 *  header row and clipped / wrapped at narrow widths). */
function RouteCard({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: "var(--radius-lg)" }}>
      <div className="relative overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative flex items-stretch">
          <div className="flex-1 min-w-0" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <div className="flex items-center justify-center rounded-full bg-primary/12 shrink-0" style={{ width: 22, height: 22 }}>
                <div className="rounded-full bg-primary" style={{ width: 8, height: 8 }} />
              </div>
              <span className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>
                {SH_STR.route.stagingLocation}
              </span>
            </div>
            <div className="text-foreground" style={{ ...T.captionMed, lineHeight: 1.4 }}>{from || "—"}</div>
          </div>
          <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 48 }}>
            <div className="w-px flex-1" style={{ borderLeft: "2px dashed var(--border)" }} />
            <div className="flex items-center justify-center rounded-full bg-secondary border border-border" style={{ width: 28, height: 28, margin: "4px 0" }}>
              <ArrowRight className="text-muted-foreground" style={{ width: 13, height: 13 }} />
            </div>
            <div className="w-px flex-1" style={{ borderLeft: "2px dashed var(--border)" }} />
          </div>
          <div className="flex-1 min-w-0" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <div className="flex items-center justify-center rounded-full bg-success/12 shrink-0" style={{ width: 22, height: 22 }}>
                <MapPin className="text-success" style={{ width: 12, height: 12 }} />
              </div>
              <span className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>
                {SH_STR.route.shipTo}
              </span>
            </div>
            <div className="text-foreground" style={{ ...T.captionMed, lineHeight: 1.4 }}>{to || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Per-shipment Line Items table ═══
 *  Same column shape as the by-item view (Item / Qty to Ship /
 *  {Staged | Shipped}). The third column flips its label + values
 *  once the shipment has departed:
 *    · pre-departure → "Staged", picked / selected
 *    · post-departure → "Shipped", shipped / selected
 *  Stays lexically aligned with the card-level chip which flips
 *  between "N of M quantities staged" and "N quantities shipped".
 *
 *  Right-hand caption is intentionally non-numeric so the shipment-
 *  level count from the card header is never rendered a second
 *  time. */
function ShipmentLinesTable({ sh, so, search }: { sh: Shipment; so?: SalesOrder; search: string }) {
  const isShipped = sh.status === "Shipped";
  const progressColLabel = isShipped ? SH_STR.table.columnShipped : SH_STR.table.columnStaged;
  return (
    <div className="bg-card border border-border overflow-hidden" style={{ borderRadius: "var(--radius-lg)" }}>
      <div className="flex items-center justify-between border-b border-border" style={{ padding: "10px var(--space-card-padding)" }}>
        <span className="text-foreground/60" style={{ ...T.labelMed, fontWeight: "var(--font-weight-semibold)" }}>
          {SH_STR.table.lineItemsCount(sh.lines.length)}
        </span>
        <span className="text-muted-foreground" style={T.label}>
          {SH_STR.shipment.inThisShipment}
        </span>
      </div>
      {/* Column headers — third column flips Staged ⇄ Shipped
          based on shipment status. */}
      <div
        className="border-b border-border/60 bg-secondary/40 grid items-center"
        style={{ gridTemplateColumns: "1fr 100px 24px 140px", gap: 0, padding: "6px var(--space-card-padding)" }}
      >
        <span className="text-muted-foreground" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{SH_STR.table.columnItem}</span>
        <span className="text-muted-foreground text-right" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{SH_STR.table.columnQtyToShip}</span>
        <span />
        <span className="text-muted-foreground text-right" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{progressColLabel}</span>
      </div>
      {sh.lines.map((line, li) => {
        /* Progress-column source depends on lifecycle. Shipped
         * shipments show `shippedQty` (falling back to picked/
         * selected when seed data hasn't stamped `shippedQty`);
         * pre-departure shipments show `pickedQty`. */
        const progressQty = isShipped
          ? (line.shippedQty || line.pickedQty || line.selectedQty)
          : line.pickedQty;
        const full = progressQty >= line.selectedQty;
        const isEmpty = progressQty === 0;
        const soLine = so?.lines.find(l => l.id === line.soLineId);
        const textCls = full ? "text-emerald-700" : isEmpty ? "text-slate-400" : "text-amber-700";
        const trackCls = full ? "bg-emerald-50" : isEmpty ? "bg-slate-100" : "bg-amber-50";
        const fillCls = full ? "bg-emerald-500" : isEmpty ? "bg-slate-300" : "bg-amber-500";
        const pct = line.selectedQty > 0 ? Math.min(1, progressQty / line.selectedQty) : 0;
        return (
          <div
            key={line.id}
            className={`grid items-center ${li > 0 ? "border-t border-border/40" : ""}`}
            style={{ gridTemplateColumns: "1fr 100px 24px 140px", gap: 0, padding: "12px var(--space-card-padding)" }}
          >
            <div className="min-w-0 flex items-start gap-2">
              <div className="w-8 h-8 rounded-md bg-secondary/70 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-foreground/15" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-foreground" style={T.captionSemi}>
                  <HighlightText text={line.itemCode} search={search} />
                </span>
                <div className="text-muted-foreground" style={{ fontSize: "var(--text-caption)", lineHeight: 1.4, marginTop: 1 }}>
                  <HighlightText text={line.itemName} search={search} />
                </div>
              </div>
            </div>

            <div className="text-right tabular-nums">
              <div className="text-foreground" style={{ ...T.captionSemi, lineHeight: 1 }}>
                {line.selectedQty}
              </div>
              <div className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em", marginTop: 3 }}>
                {getLineUom(soLine, line)}
              </div>
            </div>

            <span />

            <div className="min-w-0">
              <div className="flex flex-col items-end gap-1 w-full">
                <div className={`tabular-nums ${textCls}`} style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                  {progressQty}/{line.selectedQty}
                </div>
                <div className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>
                  {getLineUom(soLine, line)}
                </div>
                <div className={`w-full h-1 rounded-full overflow-hidden ${trackCls}`}>
                  <div className={`h-full rounded-full transition-all ${fillCls}`} style={{ width: `${pct * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ViewMode = "by-shipment" | "by-item";

/* ═══ Main Tab ═══ */
export function ShipmentsTab({ shipments, soId: _soId, so, createdViaUI = false, soStatus, onNewShipment }: Props) {
  void _soId;

  const canCreateShipment = (() => {
    if (!so || !onNewShipment) return false;
    const status = soStatus ?? so.status;
    if (!(status === "Cleared" || status === "Partially Shipped")) return false;
    return so.lines.some(l => !l.cancelled && allShipLineQty(l.id, shipments) < l.orderedQty);
  })();

  const newShipmentButton = canCreateShipment ? (
    <button
      onClick={onNewShipment}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      style={{ padding: "6px 12px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
    >
      <Plus style={{ width: 13, height: 13 }} /> {SH_STR.tab.newShipment}
    </button>
  ) : null;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ShipFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("by-shipment");
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  /* Single-open expand model: at most one shipment card is expanded
   * at a time. Default to the first shipment so users landing on the
   * tab immediately see the staging location / ship-to + line items
   * breakdown for something. */
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(
    shipments.length > 0 ? shipments[0].id : null,
  );

  const toggleDesc = useCallback((key: string) => {
    setExpandedDescs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let list = shipments;
    if (filter === "draft") list = list.filter(s => s.status === "Draft");
    else if (filter === "ready-to-pick") list = list.filter(s => s.status === "Ready to Pick");
    else if (filter === "in-progress") list = list.filter(s => s.status === "In Progress");
    else if (filter === "ready") list = list.filter(s => s.status === "Ready");
    else if (filter === "shipped") list = list.filter(s => s.status === "Shipped");
    else if (filter === "cancelled") list = list.filter(s => s.status === "Cancelled");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.shipmentNumber.toLowerCase().includes(q) ||
        (s.trackingCode || "").toLowerCase().includes(q) ||
        (s.carrier || "").toLowerCase().includes(q) ||
        (s.shipTo || "").toLowerCase().includes(q) ||
        s.lines.some(l => l.itemCode.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [shipments, filter, search]);

  const statusCounts: Record<ShipmentStatus, number> = {
    "Draft": 0, "Ready to Pick": 0, "In Progress": 0, "Ready": 0, "Shipped": 0, "Cancelled": 0,
  };
  shipments.forEach(s => { statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1; });

  const pills: { key: ShipFilter; label: string; count: number }[] = [
    { key: "all", label: SH_STR.filter.all, count: shipments.length },
    ...(statusCounts["Draft"] > 0         ? [{ key: "draft"          as const, label: SH_STR.filter.draft,        count: statusCounts["Draft"] }]         : []),
    ...(statusCounts["Ready to Pick"] > 0 ? [{ key: "ready-to-pick"  as const, label: SH_STR.filter.readyToPick,  count: statusCounts["Ready to Pick"] }] : []),
    ...(statusCounts["In Progress"] > 0   ? [{ key: "in-progress"    as const, label: SH_STR.filter.inProgress,   count: statusCounts["In Progress"] }]   : []),
    ...(statusCounts["Ready"] > 0         ? [{ key: "ready"          as const, label: SH_STR.filter.ready,        count: statusCounts["Ready"] }]         : []),
    ...(statusCounts["Shipped"] > 0       ? [{ key: "shipped"        as const, label: SH_STR.filter.shipped,      count: statusCounts["Shipped"] }]       : []),
    ...(statusCounts["Cancelled"] > 0     ? [{ key: "cancelled"      as const, label: SH_STR.filter.cancelled,    count: statusCounts["Cancelled"] }]     : []),
  ];
  /* Hide the filter row entirely when there's nothing to filter — one
   * distinct status (or none) means "All" and that single status pill
   * carry the same result set, so the row is just chrome. `pills`
   * always starts with "All", so >2 means we have real filter
   * choices. */
  const showFilterPills = pills.length > 2;

  /* ── Empty state ── */
  const effectiveStatus = soStatus ?? so?.status;
  const isPreShipmentStage = effectiveStatus === "Draft" || effectiveStatus === "Pending Review";
  if (createdViaUI || isPreShipmentStage || shipments.length === 0) {
    if (canCreateShipment) {
      return (
        <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TabHeader icon={Truck} title={SH_STR.tab.title} count={0}>
            {newShipmentButton}
          </TabHeader>
          <div style={{ padding: "var(--space-card-padding)" }}>
            <EmptyPlaceholder
              block
              icon={Truck}
              title={SH_STR.empty.title}
              description={SH_STR.empty.descReleased}
            />
          </div>
        </div>
      );
    }
    return (
      <EmptyPlaceholder
        block
        icon={Truck}
        title={SH_STR.empty.title}
        description={SH_STR.empty.descPreRelease}
      />
    );
  }

  /* Per-line-item fulfillment cut. */
  const itemRows = so ? so.lines.filter(l => !l.cancelled).map(line => {
    let picked = 0;
    let shipped = 0;
    const shipmentSlices: Array<{ id: string; number: string; status: ShipmentStatus; qty: number }> = [];
    for (const sh of shipments) {
      let qtyInShipment = 0;
      for (const sl of sh.lines) {
        if (sl.soLineId !== line.id) continue;
        qtyInShipment += sl.selectedQty;
        picked += sl.pickedQty;
        shipped += sl.shippedQty;
      }
      if (qtyInShipment > 0) {
        shipmentSlices.push({ id: sh.id, number: sh.shipmentNumber, status: sh.status, qty: qtyInShipment });
      }
    }
    return { line, picked, shipped, shipmentSlices };
  }) : [];

  return (
    <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TabHeader icon={Truck} title={SH_STR.tab.title} count={shipments.length}>
        {newShipmentButton}
      </TabHeader>

      {/* Search + view toggle + filter pills */}
      <div className="border-b border-border">
        <TabSearchBar
          search={search}
          onSearchChange={setSearch}
          placeholder={SH_STR.tab.searchPlaceholder}
          resultCount={viewMode === "by-shipment" ? filtered.length : itemRows.length}
          resultLabel={viewMode === "by-shipment" ? SH_STR.tab.resultLabelShipments : SH_STR.tab.resultLabelItems}
          leftContent={
            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0" style={{ marginLeft: 4 }}>
              {([
                { key: "by-shipment", label: SH_STR.tab.viewByShipment,  count: shipments.length },
                { key: "by-item",     label: SH_STR.tab.viewByLineItems, count: itemRows.length },
              ] as const).map(opt => {
                const active = viewMode === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setViewMode(opt.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                      active
                        ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {opt.label}
                    <span
                      className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${
                        active ? "bg-accent text-primary" : "bg-border text-slate-500"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          }
        />
        {showFilterPills && (
          <div className="flex items-center flex-wrap gap-2" style={{ padding: "0 var(--space-card-padding) 8px" }}>
            <FilterPills pills={pills} active={filter} onSelect={setFilter} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-card-padding)", padding: "var(--space-card-padding)" }}>

        {/* Order-level fulfillment summary — order-level number lives
            here so it stays visually + lexically distinct from the
            shipment-level number on each card. */}
        {so && <FulfillmentOverview so={so} />}

        {viewMode === "by-item" ? (
          <ByItemView
            itemRows={itemRows}
            so={so}
            search={search}
            expandedDescs={expandedDescs}
            toggleDesc={toggleDesc}
          />
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground" style={{ ...T.captionNormal, boxShadow: "var(--elevation-1)" }}>
            {SH_STR.empty.noFilterMatch}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-inline-gap)" }}>
            {filtered.map(sh => (
              <ShipmentCard
                key={sh.id}
                sh={sh}
                so={so}
                search={search}
                isExp={expandedShipmentId === sh.id}
                onToggleExp={() => setExpandedShipmentId(id => (id === sh.id ? null : sh.id))}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* ═══ By-Line-Item view ═══
 *  Keeps the by-item table intact. Two behavior changes vs. before:
 *    1. Only 1 shipment slice renders inline per row (was 3). Beyond
 *       1, a `+N more` chip opens the shared `OverflowTooltip`
 *       list-menu with every shipment carrying units of the item.
 *       Same list-menu Partners uses — no bespoke expander.
 *    2. Row is no longer clickable — nothing opens a modal. Each
 *       shipment pill (inline + inside the list-menu) is its own link
 *       to the Shipment module. */
function ByItemView({
  itemRows, so, search, expandedDescs, toggleDesc,
}: {
  itemRows: Array<{
    line: SalesOrder["lines"][number];
    picked: number;
    shipped: number;
    shipmentSlices: Array<{ id: string; number: string; status: ShipmentStatus; qty: number }>;
  }>;
  so: SalesOrder | undefined;
  search: string;
  expandedDescs: Set<string>;
  toggleDesc: (key: string) => void;
}) {
  /* Per-row lifecycle: a row is "fully shipped" iff every shipment
   * slice carrying units of the line is in the Shipped state. Used
   * both by the row itself (which numerator / label to show) and by
   * the table header (flips Staged ⇄ Shipped when every row is
   * fully shipped). Kept out of the render loop so both surfaces
   * read from the same source of truth. */
  const rowFullyShipped = (slices: Array<{ status: ShipmentStatus }>): boolean =>
    slices.length > 0 && slices.every(s => s.status === "Shipped");
  const allRowsShipped = itemRows.length > 0 && itemRows.every(r => rowFullyShipped(r.shipmentSlices));
  const progressColLabel = allRowsShipped ? SH_STR.table.columnShipped : SH_STR.table.columnStaged;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ boxShadow: "var(--elevation-1)" }}>
      <div className="flex items-center justify-between border-b border-border" style={{ padding: "10px var(--space-card-padding)" }}>
        <span className="text-foreground/60" style={{ ...T.labelMed, fontWeight: "var(--font-weight-semibold)" }}>
          {SH_STR.table.lineItemsCount(itemRows.length)}
        </span>
        <span className="text-muted-foreground tabular-nums" style={T.label}>
          {SH_STR.byItem.aggregatedAcrossShipments}
        </span>
      </div>

      {/* Column headers — SH_STR.table.* keys are shared with the
          per-shipment expanded body so column labels stay identical
          across both views. Third column flips Staged ⇄ Shipped
          when every row is fully shipped. */}
      <div
        className="border-b border-border/60 bg-secondary/40 grid items-center"
        style={{ gridTemplateColumns: "1fr 100px 24px 140px", gap: 0, padding: "6px var(--space-card-padding)" }}
      >
        <span className="text-muted-foreground" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{SH_STR.table.columnItem}</span>
        <span className="text-muted-foreground text-right" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{SH_STR.table.columnQtyToShip}</span>
        <span />
        <span className="text-muted-foreground text-right" style={{ ...T.microSemi, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{progressColLabel}</span>
      </div>

      {itemRows.map(({ line, picked, shipped, shipmentSlices }, idx) => {
        const ord = line.orderedQty;
        const dKey = `bi-${line.id}`;
        const isExp = expandedDescs.has(dKey);
        const soLine = so?.lines.find(l => l.id === line.id);
        /* Per-row source-of-truth for the progress column: when
         * every slice is Shipped, show the aggregated `shipped`
         * quantity — otherwise show the aggregated `picked`
         * (staging progress). Keeps the number consistent with the
         * shipment cards' per-card chip. */
        const rowShipped = rowFullyShipped(shipmentSlices);
        const progressQty = rowShipped ? shipped : picked;
        return (
          <div
            key={line.id}
            className={`grid items-start ${idx > 0 ? "border-t border-border/40" : ""}`}
            style={{ gridTemplateColumns: "1fr 100px 24px 140px", gap: 0, padding: "12px var(--space-card-padding)" }}
          >
            {/* Item + inline shipment pill(s). UOM is uniform across
                every slice for this line (they're all shipments of
                the same SO line item) so a single line-level UOM is
                threaded through the cluster. */}
            <div className="min-w-0">
              <ItemCell code={line.itemCode} name={line.itemName} search={search} expanded={isExp} onToggle={() => toggleDesc(dKey)} />
              {shipmentSlices.length > 0 && (
                <div className="ml-10" style={{ marginTop: 6 }}>
                  <ShipmentSlicesCluster
                    slices={shipmentSlices}
                    uom={getLineUom(soLine, { itemName: line.itemName })}
                  />
                </div>
              )}
            </div>

            {/* Qty to Ship */}
            <div className="text-right tabular-nums">
              <div className="text-foreground" style={{ ...T.captionSemi, lineHeight: 1 }}>
                {ord}
              </div>
              <div className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em", marginTop: 3 }}>
                {getLineUom(soLine, { itemName: line.itemName })}
              </div>
            </div>

            <span />

            {/* Progress — Staged aggregated pre-departure, Shipped
                once every slice is Shipped. */}
            <div className="min-w-0">
              {(() => {
                const isFull = progressQty >= ord;
                const isEmpty = progressQty === 0;
                const textCls = isFull ? "text-emerald-700" : isEmpty ? "text-slate-400" : "text-amber-700";
                const trackCls = isFull ? "bg-emerald-50" : isEmpty ? "bg-slate-100" : "bg-amber-50";
                const fillCls = isFull ? "bg-emerald-500" : isEmpty ? "bg-slate-300" : "bg-amber-500";
                const pct = ord > 0 ? Math.min(1, progressQty / ord) : 0;
                return (
                  <div className="flex flex-col items-end gap-1 w-full">
                    <div className={`tabular-nums ${textCls}`} style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                      {progressQty}/{ord}
                    </div>
                    <div className="text-muted-foreground uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>
                      {getLineUom(soLine, { itemName: line.itemName })}
                    </div>
                    <div className={`w-full h-1 rounded-full overflow-hidden ${trackCls}`}>
                      <div className={`h-full rounded-full transition-all ${fillCls}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Shipment-slice cluster (1 inline + list-menu +N) ═══
 *  Shows the first slice as an inline pill; if the line lands on more
 *  than one shipment, a `+N more` chip opens the shared
 *  `OverflowTooltip` list-menu with every shipment carrying units of
 *  this item. Each entry (inline pill + overflow row) is its own link
 *  to the Shipment module — no bespoke expander, no row-level modal. */
type Slice = { id: string; number: string; status: ShipmentStatus; qty: number };

function ShipmentSlicesCluster({ slices, uom }: { slices: Slice[]; uom: string }) {
  const VISIBLE_CAP = 1;
  const visible = slices.slice(0, VISIBLE_CAP);
  const overflow = slices.slice(VISIBLE_CAP);
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
      <span className="text-muted-foreground" style={T.micro}>{SH_STR.byItem.in}</span>
      {visible.map(sl => (
        <SlicePill key={sl.id} slice={sl} multi={slices.length > 1} uom={uom} />
      ))}
      {overflow.length > 0 && (
        <OverflowTooltip
          category={SH_STR.byItem.shipmentsCategory}
          items={overflow.map(sl => ({
            id: sl.id,
            name: sl.number,
            subtitle: `${SH_STR.shipment.sliceQty(sl.qty, uom)} · ${sl.status}`,
            meta: { url: shipmentModuleUrl(sl.number) },
          }))}
          onItemClick={(item) => {
            const url = (item.meta as { url?: string } | undefined)?.url;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          <span
            className="inline-flex items-center gap-1 rounded-md bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors cursor-default"
            style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600 }}
            aria-label={SH_STR.shipment.moreShipments(overflow.length)}
          >
            +{overflow.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

function SlicePill({ slice, multi, uom }: { slice: Slice; multi: boolean; uom: string }) {
  return (
    <a
      href={shipmentModuleUrl(slice.number)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors"
      style={{ padding: "2px 8px" }}
      title={`${slice.number} · ${SH_STR.shipment.sliceQty(slice.qty, uom)} · ${slice.status}`}
    >
      <Truck style={{ width: 10, height: 10, color: "var(--foreground-soft, #475569)" }} />
      <span className="text-foreground tabular-nums" style={{ fontSize: 11, fontWeight: 600 }}>
        {slice.number}
      </span>
      {multi && (
        <span className="text-muted-foreground tabular-nums" style={{ fontSize: 11 }}>
          · {slice.qty} {uom}
        </span>
      )}
      <ShipmentStatusDot status={slice.status} />
    </a>
  );
}

/** Compact colored dot + short status label used on inline slice
 *  pills. Shares the tint set with `ShipmentStatusBadge` so pill and
 *  card status colouring stays consistent. */
function ShipmentStatusDot({ status }: { status: ShipmentStatus }) {
  const tone: Record<ShipmentStatus, { dot: string; label: string; color: string }> = {
    "Draft":          { dot: "#94A3B8", label: "Draft",    color: "#475569" },
    "Ready to Pick":  { dot: "#0A77FF", label: "Ready",    color: "#0F62D6" },
    "In Progress":    { dot: "#F59E0B", label: "Picking",  color: "#B45309" },
    "Ready":          { dot: "#7C3AED", label: "Staged",   color: "#5B21B6" },
    "Shipped":        { dot: "#10B981", label: "Shipped",  color: "#047857" },
    "Cancelled":      { dot: "#DC2626", label: "Cancelled", color: "#991B1B" },
  };
  const t = tone[status];
  return (
    <span className="inline-flex items-center gap-1" style={{ marginLeft: 2 }}>
      <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: t.dot }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: t.color, letterSpacing: "0.02em" }}>{t.label}</span>
    </span>
  );
}
