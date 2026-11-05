/* ═══════════════════════════════════════════════════════════════
   Purchase Requests — listing page (requester side)

   Reuses the Purchase Orders shell + table verbatim so the two
   surfaces are visually identical. This file is thin on purpose:
   it maps `PurchaseRequest` records into the `PurchaseOrder`
   shape `PODataTable` expects, wires the required prop surface,
   and overrides the status cell so PR-specific chips render in
   place of the PO status badge.

   Data-shape mapping:
     PurchaseRequest              → PurchaseOrder field
     ────────────────────────────────────────────────
     id                           → id
     id (e.g. "PR-10247")         → poNumber (pinned column)
     preferredVendor              → partnerLocation ("Vendor")
     status (PR)                  → status (cast; re-rendered)
     itemId → CATALOG lookup      → orderedItems[0]
     requester.name               → createdBy
     needBy (formatted)           → dueDeliveryDate
     submittedAt (formatted)      → orderDate
     always "me"                  → owner
   ═══════════════════════════════════════════════════════════════ */

"use client";

import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardEdit, Package, Plus, CheckCircle2, Clock, XCircle, PauseCircle } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { FONT } from "./designTokens";
import { CATALOG } from "./catalogData";
import { Button } from "./ui/button";
import AppShell from "./layout/AppShell";
import TopBar from "./layout/TopBar";
import PageHeaderWithIcon from "./layout/PageHeaderWithIcon";
import UserHoverCard from "./UserHoverCard";
import ItemHoverCard from "./ItemHoverCard";
import PODataTable, {
  type PurchaseOrder,
  type ColumnDef,
  type ColumnId,
} from "./PODataTable";
import NewRequestTypeModal, { type NewRequestKind } from "./NewRequestTypeModal";
import ItemsCatalogueModal from "./CatalogueModal";
import PurchaseRequestReviewModal from "./PurchaseRequestReviewModal";
import NewItemRequestModal from "./NewItemRequestModal";
import type { CatalogItem } from "./catalogData";
import { EMPTY_FILTERS, type POFilterState } from "./POFilterBar";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  getMyPRs,
  STATUS_META,
  formatPRDate,
  formatPRDateRange,
  type PRStatus,
} from "./prData";

/* ── Avatar colour palette — mirrors PurchaseOrdersListing's
       `AVATAR_COLORS` so the same vendor renders the same tint on
       both surfaces. Same 11-slot hash-indexed palette (Partners spec). */
const AVATAR_COLORS = [
  { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFEFF", text: "#0891B2" },
  { bg: "#FFF1F2", text: "#E11D48" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#F0FDFA", text: "#0D9488" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#F5F5F4", text: "#57534E" },
];

function vendorAvatarColor(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function vendorInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase() || "PR"
  );
}

/* ── PR-status ↔ PO-status label bridge ─────────────────────── */

/* PR statuses masquerade as POStatus at the TypeScript layer so
   the PODataTable's tab/filter machinery keeps working unchanged.
   The `status` cell is overridden via `renderCell` below, so the
   user never sees a "Draft" / "Sent" / etc. label leak through. */
const PR_STATUS_TO_LABEL: Record<PRStatus, string> = {
  submitted: "Submitted",
  denied: "Denied",
  deferred: "Deferred",
  "po-created": "PO Created",
};
const LABEL_TO_PR_STATUS: Record<string, PRStatus> = {
  Submitted: "submitted",
  Denied: "denied",
  Deferred: "deferred",
  "PO Created": "po-created",
};

const STATUS_ICON: Record<PRStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  submitted: Clock,
  denied: XCircle,
  deferred: PauseCircle,
  "po-created": CheckCircle2,
};

/* ── Ordered-items cell + multi-item hover popover ─────────────
   Ported from PurchaseOrdersListing (`OrderedItemsCell` +
   `ItemsHoverPopover`) so the PR listing exposes the same "+N more"
   hover treatment as the PO listing instead of a native title
   tooltip. Kept as local helpers here — copying is cheap and lets
   the PR page render new-item rows (ClipboardEdit placeholder,
   primary tint) without threading a bunch of options across
   PurchaseOrdersListing. */

interface RowOrderedItem {
  code: string;
  image: string;
}

function ItemsHoverPopover({
  rect,
  items,
  onMouseEnter,
  onMouseLeave,
}: {
  rect: DOMRect;
  items: RowOrderedItem[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const flipUp = rect.bottom + 220 > window.innerHeight;
  return (
    <div
      className="fixed z-50"
      style={{
        top: flipUp ? undefined : rect.bottom + 4,
        bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        background: "hsl(var(--card))",
        border: "0.75px solid hsl(var(--border))",
        borderRadius: 8,
        boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)",
        minWidth: 220,
        maxWidth: 280,
        fontFamily: FONT,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-3"
        style={{
          height: 32,
          borderBottom: "0.75px solid hsl(var(--border))",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "hsl(var(--muted-foreground))",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Items on this request
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {items.length}
        </span>
      </div>
      <div
        style={{
          maxHeight: 5 * 38,
          overflowY: items.length > 5 ? "auto" : undefined,
          paddingBottom: items.length >= 5 ? 6 : 0,
        }}
      >
        {items.map((item, idx) => {
          const isNewItem = item.code === "New item";
          return (
            <div
              key={`${item.code}-${idx}`}
              className="flex items-center gap-2.5 transition-colors"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                color: "hsl(var(--foreground))",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "hsl(var(--secondary))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                className="size-[22px] rounded-[5px] overflow-hidden border shrink-0"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                {item.image ? (
                  <ImageWithFallback
                    src={item.image}
                    alt={item.code}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      backgroundColor: "hsl(var(--accent))",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    <Package className="w-3 h-3" />
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isNewItem ? 600 : 500,
                  color: isNewItem
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground))",
                }}
              >
                {item.code}
              </span>
            </div>
          );
        })}
      </div>
      {items.length > 5 && (
        <div
          style={{
            fontSize: 10,
            color: "hsl(var(--muted-foreground))",
            textAlign: "center",
            padding: "4px 0 6px",
            borderTop: "0.75px solid hsl(var(--border))",
          }}
        >
          Scroll for more
        </div>
      )}
    </div>
  );
}

/** Ordered-items cell — wraps the first item's thumbnail in
    ItemHoverCard (single-item preview) and pops open a multi-item
    list via ItemsHoverPopover when the buyer hovers "+N more". */
function OrderedItemsCell({
  items,
  searchTerm,
  highlightText,
}: {
  items: RowOrderedItem[];
  searchTerm: string;
  highlightText: (text: string, query: string) => React.ReactNode;
}) {
  const first = items[0];
  const moreCount = items.length - 1;
  const [popover, setPopover] = useState<DOMRect | null>(null);
  const hoverTimeout = useRef<number | null>(null);

  const cancelClose = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };
  const startClose = () => {
    cancelClose();
    hoverTimeout.current = window.setTimeout(() => setPopover(null), 150);
  };

  if (!first) return null;
  const isNewItem = first.code === "New item";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ItemHoverCard code={first.code} imageUrl={first.image}>
        <div
          className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border cursor-pointer"
          style={{ borderColor: "#E8ECF1" }}
          onClick={(e) => e.stopPropagation()}
        >
          {first.image ? (
            <ImageWithFallback
              src={first.image}
              alt={first.code}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                backgroundColor: "hsl(var(--accent))",
                color: "hsl(var(--primary))",
              }}
            >
              <Package className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </ItemHoverCard>
      <div className="min-w-0 flex-1 flex items-center gap-1.5">
        <span
          className="text-sm truncate"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          {isNewItem ? (
            <span style={{ color: "hsl(var(--primary))" }}>{first.code}</span>
          ) : (
            highlightText(first.code, searchTerm)
          )}
        </span>
        {moreCount > 0 && (
          <span
            className="text-[11px] shrink-0 cursor-default leading-none whitespace-nowrap"
            style={{
              fontWeight: 600,
              color: "hsl(var(--primary))",
              fontFamily: FONT,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => {
              cancelClose();
              setPopover(e.currentTarget.getBoundingClientRect());
            }}
            onMouseLeave={startClose}
          >
            +{moreCount} more
          </span>
        )}
      </div>
      {popover && (
        <ItemsHoverPopover
          rect={popover}
          items={items}
          onMouseEnter={cancelClose}
          onMouseLeave={() => setPopover(null)}
        />
      )}
    </div>
  );
}

/* ── Column set — Purchase Requests have no point-of-contact and
       no receiving location, so those two columns are dropped
       entirely (not just hidden). Uses ColumnId names verbatim so
       PODataTable's column-selector recognises them. */
const AVAILABLE_COLUMNS: ColumnDef[] = [
  { id: "partnerLocation", label: "Preferred Vendor", minWidth: 200, sortable: true },
  { id: "status", label: "Status", minWidth: 160 },
  { id: "orderedItems", label: "Item", minWidth: 260, sortable: true },
  { id: "createdBy", label: "Requested By", minWidth: 160 },
  { id: "dueDeliveryDate", label: "Need By", minWidth: 130 },
  { id: "orderDate", label: "Submitted", minWidth: 130 },
];

const DEFAULT_HIDDEN_COLUMNS: ColumnId[] = [];

const TAB_DEFS = [
  { value: "all", label: "All" },
  { value: "Submitted", label: "Submitted" },
  { value: "Deferred", label: "Deferred" },
  { value: "Denied", label: "Denied" },
  { value: "PO Created", label: "PO Created" },
];

/* ── Simple highlight helper — same signature PODataTable
       expects. Wraps matched substrings in a semi-transparent
       yellow, matching the PO listing's search-highlight style. */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "rgba(250, 204, 21, 0.35)", padding: 0 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function PurchaseRequestsPage() {
  const navigate = useNavigate();

  const prs = useMemo(() => getMyPRs(), []);

  // Keep a lookup so the overridden `status` cell can read the
  // original PR record (chip metadata) by id.
  const prById = useMemo(() => {
    const m: Record<string, ReturnType<typeof getMyPRs>[number]> = {};
    prs.forEach((p) => (m[p.id] = p));
    return m;
  }, [prs]);

  /* ── Map PR → PurchaseOrder shape ────────────────────────── */
  const allData = useMemo<PurchaseOrder[]>(() => {
    return prs.map((p) => {
      /* Iterate every line item so the PODataTable's OrderedItems
         cell receives one entry per line — enables the +N more chip
         for multi-item PRs. */
      const orderedItems = p.lineItems.map((li) => {
        const cat = li.itemId ? CATALOG.find((c) => c.id === li.itemId) : undefined;
        const code = cat?.itemNumber ?? (li.isNewItem ? "New item" : "—");
        const image = cat?.image ?? "";
        return { code, image };
      });
      /* Vendor rollup — dedupe preferredVendor across line items and
         let the renderCell surface a "+N vendors" chip when a PR has
         more than one preferred supplier. First vendor wins the
         partnerLocation string / avatar since the type only carries
         one; the full list is looked up via prById in renderCell. */
      const uniqueVendors = Array.from(
        new Set(p.lineItems.map((li) => li.preferredVendor).filter(Boolean)),
      ) as string[];
      const hasNewItem = p.lineItems.some((li) => li.isNewItem);
      const vendor =
        uniqueVendors[0] ?? (hasNewItem ? "New vendor" : "—");
      const totalEstimated = p.lineItems.reduce(
        (sum, li) => sum + (li.estimatedUnitPrice ?? 0) * li.quantity,
        0,
      );
      /* Status label is used for tabs + filtering; the `status` cell
         is overridden via `renderCell` so the PODataTable's default
         POStatus badge never renders — safe to cast. */
      const statusLabel = PR_STATUS_TO_LABEL[p.status] as PurchaseOrder["status"];
      return {
        id: p.id,
        poNumber: p.id,
        version: 1,
        partnerLocation: vendor,
        partnerAbbr: vendorInitials(vendor),
        status: statusLabel,
        orderedItems,
        pointOfContact: "",
        pointOfContactAbbr: "",
        quoteValue: totalEstimated,
        location: "",
        createdBy: p.requester.name,
        dueDeliveryDate: formatPRDateRange(p.needBy, p.needByEnd),
        orderDate: formatPRDate(p.submittedAt),
        owner: "me" as const,
      };
    });
  }, [prs]);

  /* ── Local UI state — same shape as PurchaseOrdersListing ── */
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(
    AVAILABLE_COLUMNS.map((c) => c.id),
  );
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ColumnId[]>(DEFAULT_HIDDEN_COLUMNS);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [quickStatus, setQuickStatus] = useState<"all" | PurchaseOrder["status"]>("all");
  const [filters, setFilters] = useState<POFilterState>(EMPTY_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  /* Item filter is owned locally so item vocabulary doesn't leak
     into POFilterState (see POFiltersModal `itemOptions` / etc.).
     Options are every unique item code appearing on any PR line. */
  const [filterItems, setFilterItems] = useState<string[]>([]);
  const itemFilterOptions = useMemo(() => {
    const set = new Set<string>();
    prs.forEach((p) =>
      p.lineItems.forEach((li) => {
        const cat = li.itemId ? CATALOG.find((c) => c.id === li.itemId) : undefined;
        const code = cat?.itemNumber ?? (li.isNewItem && li.newItemName ? li.newItemName : null);
        if (code) set.add(code);
      }),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [prs]);
  /* ── New-request modal state ──
     Three-stage launcher:
       1) `typePickerOpen` — the small "Existing item vs New item" picker.
       2) The pick either
          · opens the shared ItemsCatalogueModal (the same full
            catalogue browser used at PO creation, reused as-is via
            `mode="po"` so it doesn't touch the global cart; picks
            accumulate in `catalogPicks` while the buyer browses), or
          · opens the PR wizard directly in new-item mode.
       3) On catalogue-modal close, if the buyer added at least one
          item, we open the PR wizard preseeded with those picks at
          Step 2 so they skip the wizard's built-in Step-1 picker
          entirely. */
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  /* Two single-surface flows replace the earlier 3-step wizard:
       · Existing item → catalogue → PurchaseRequestReviewModal
       · New item      → NewItemRequestModal (single form + list)
     The old PurchaseRequestModal (wizard) file is left in the repo
     but no longer mounted from this page. */
  const [catalogueModalOpen, setCatalogueModalOpen] = useState(false);
  const [catalogPicks, setCatalogPicks] = useState<CatalogItem[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  /* `mode="po"` shows an "In PO · N" badge on items already added,
     keyed by itemNumber. We reuse the same channel for the PR flow
     so buyers see "already added" feedback while browsing. */
  const catalogPickQtyByNumber = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of catalogPicks) map[item.itemNumber] = 1;
    return map;
  }, [catalogPicks]);
  /* Ownership toggle — same shape as PurchaseOrdersListing's Me-mode
     chip. Starts on "me" (matches the previous hardcoded behavior); the
     chip lets the buyer switch to "all" and see every PR in the dataset
     regardless of requester. */
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "me">("me");
  const isCurrentUserPR = React.useCallback(
    (id: string) => {
      const pr = prById[id];
      const req = pr?.requester;
      // Areeb Tanvir is the mock current user (see prData.ts CURRENT_USER).
      return req?.id === "user-areeb";
    },
    [prById],
  );

  /* ── Filtering — respects tab, quickStatus, search, ownership ── */
  const filteredData = useMemo(() => {
    let data = [...allData];
    if (ownershipFilter === "me") {
      data = data.filter((d) => isCurrentUserPR(d.id));
    }
    if (activeTab !== "all") {
      data = data.filter((d) => d.status === (activeTab as PurchaseOrder["status"]));
    }
    if (quickStatus !== "all") {
      data = data.filter((d) => d.status === quickStatus);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      data = data.filter((d) => {
        const pr = prById[d.id];
        /* Fold in every line item's code + new-item name so a search
           for a specific SKU or descriptive term matches a multi-
           item PR even when that item isn't the primary one. */
        const lineItemNames = pr
          ? pr.lineItems.map((li) => li.newItemName ?? "").join(" ")
          : "";
        const haystack = [
          d.poNumber,
          d.partnerLocation,
          d.orderedItems.map((oi) => oi.code).join(" "),
          pr?.reason ?? "",
          lineItemNames,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    /* Modal filters — keep the PR page aligned with the PO listing's
       filter contract. Only fields the PR data model exposes are
       honoured (Vendor Contact + Location are hidden in the modal;
       Status is hidden and driven by the tab strip). */
    if (filters.partnerLocation.length > 0) {
      data = data.filter((d) => filters.partnerLocation.includes(d.partnerLocation));
    }
    if (filters.createdBy.length > 0) {
      data = data.filter((d) => filters.createdBy.includes(d.createdBy));
    }
    if (filterItems.length > 0) {
      data = data.filter((d) =>
        d.orderedItems.some((oi) => filterItems.includes(oi.code)),
      );
    }
    return data;
  }, [allData, activeTab, quickStatus, searchTerm, prById, ownershipFilter, isCurrentUserPR, filters, filterItems]);

  /* ── Tab counts ── */
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: allData.length };
    TAB_DEFS.forEach((t) => {
      if (t.value === "all") return;
      c[t.value] = allData.filter((d) => d.status === (t.value as PurchaseOrder["status"])).length;
    });
    return c;
  }, [allData]);

  /* ── Empty state — four distinct messages per spec §6.
     Priority: no data at all → status tab → me mode → search/filters. */
  const emptyState = useMemo(() => {
    const hasNoData = allData.length === 0;
    const hasSearchOrFilters =
      searchTerm.trim().length > 0 ||
      filters.partnerLocation.length > 0 ||
      filters.createdBy.length > 0 ||
      Boolean(filters.dueDateFrom) ||
      Boolean(filters.dueDateTo) ||
      Boolean(filters.orderDateFrom) ||
      Boolean(filters.orderDateTo) ||
      filterItems.length > 0;
    if (hasNoData) {
      return {
        title: "No purchase requests yet.",
        description: "New requests raised across the system will appear here.",
        hideResetAction: true,
      };
    }
    if (activeTab !== "all" || quickStatus !== "all") {
      const statusLabel = (
        activeTab !== "all" ? activeTab : (quickStatus as string)
      ).toLowerCase();
      return {
        title: `No ${statusLabel} requests.`,
        description: "Try a different status tab or reset filters to see everything.",
      };
    }
    if (ownershipFilter === "me" && !hasSearchOrFilters) {
      return {
        title: "No requests submitted or approved by the current user.",
        description: "Switch off Me mode to see every request raised across the system.",
      };
    }
    if (hasSearchOrFilters) {
      return {
        title: "No requests match the current search or filters.",
        description: "Try clearing the search or resetting filters.",
      };
    }
    return {
      title: "No purchase requests yet.",
      description: "New requests raised across the system will appear here.",
      hideResetAction: true,
    };
  }, [
    allData.length,
    activeTab,
    quickStatus,
    ownershipFilter,
    searchTerm,
    filters.partnerLocation,
    filters.createdBy,
    filters.dueDateFrom,
    filters.dueDateTo,
    filters.orderDateFrom,
    filters.orderDateTo,
    filterItems,
  ]);

  /* ── Same tab colour helper the PO listing uses ── */
  const tabColor = (val: string, active: boolean): React.CSSProperties => {
    // Non-active tabs get muted foreground; active gets the status
    // accent colour. Uses the PR STATUS_META palette so the pill
    // matches the chip rendered in the status cell.
    const prStatus = val === "all" ? undefined : LABEL_TO_PR_STATUS[val];
    const meta = prStatus ? STATUS_META[prStatus] : undefined;
    if (active && meta) {
      return {
        color: meta.fg,
        backgroundColor: meta.bg,
        borderColor: meta.border,
      };
    }
    if (active) {
      return { color: "hsl(var(--primary))", backgroundColor: "hsl(var(--accent))" };
    }
    return { color: "hsl(var(--muted-foreground))" };
  };

  /* ── Cell renderer — reuses PODataTable's built-ins for most
         columns, overrides `status` with a PR chip, and pipes
         PR-friendly copy through the item / vendor cells. ─────── */
  const renderCell = (col: ColumnDef, item: PurchaseOrder): React.ReactNode => {
    switch (col.id) {
      case "status": {
        const pr = prById[item.id];
        if (!pr) return null;
        const meta = STATUS_META[pr.status];
        const Icon = STATUS_ICON[pr.status];
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{
              backgroundColor: meta.bg,
              color: meta.fg,
              borderColor: meta.border,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        );
      }
      case "partnerLocation": {
        /* Match PO listing's `LetterAvatar` recipe: 32×32 rounded-lg,
           hash-indexed AVATAR_COLORS palette, 10px 700 weight. When a
           multi-item PR spans more than one preferred vendor, surface
           a "+N vendors" chip beside the primary name. */
        const pr = prById[item.id];
        const uniqueVendors = pr
          ? (Array.from(
              new Set(pr.lineItems.map((li) => li.preferredVendor).filter(Boolean)),
            ) as string[])
          : [];
        const color = vendorAvatarColor(item.partnerLocation);
        const extraCount = Math.max(0, uniqueVendors.length - 1);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center justify-center shrink-0 overflow-hidden border rounded-lg"
              style={{
                width: 32,
                height: 32,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: FONT,
                backgroundColor: color.bg,
                color: "rgb(51, 65, 85)",
                borderColor: "#E8ECF1",
              }}
            >
              {item.partnerAbbr}
            </span>
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span
                className="text-sm truncate"
                style={{ fontWeight: 500, color: "rgb(30, 41, 59)", fontFamily: FONT }}
              >
                {highlightText(item.partnerLocation, searchTerm)}
              </span>
              {extraCount > 0 && (
                <span
                  className="text-[11px] shrink-0 whitespace-nowrap"
                  style={{ fontWeight: 600, color: "hsl(var(--primary))", fontFamily: FONT }}
                  title={uniqueVendors.slice(1).join(", ")}
                >
                  +{extraCount} vendor{extraCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        );
      }
      case "orderedItems": {
        /* Uses the local OrderedItemsCell helper that wraps the first
           thumbnail in ItemHoverCard (single-item preview) and opens
           an ItemsHoverPopover listing every item when the buyer
           hovers "+N more" — same pattern as the PO listing. */
        return (
          <OrderedItemsCell
            items={item.orderedItems}
            searchTerm={searchTerm}
            highlightText={highlightText}
          />
        );
      }
      case "createdBy": {
        /* Match PO listing's `createdBy` recipe (`PurchaseOrdersListing.tsx:1234`):
           32×32 rounded-full LetterAvatar-style with hash-tinted
           AVATAR_COLORS palette + slate initials, wrapped in
           UserHoverCard for the Partners-style dark hover-card. */
        const pr = prById[item.id];
        const requester = pr?.requester;
        const cb = requester?.name || item.createdBy || "";
        if (!cb) return "—";
        const cbInitials = requester?.initials
          || vendorInitials(cb);
        const color = vendorAvatarColor(cb);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserHoverCard name={cb}>
              <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span
                  className="inline-flex items-center justify-center shrink-0 overflow-hidden border rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: FONT,
                    backgroundColor: color.bg,
                    color: "rgb(51, 65, 85)",
                    borderColor: "#E8ECF1",
                  }}
                >
                  {cbInitials}
                </span>
              </div>
            </UserHoverCard>
            <UserHoverCard name={cb}>
              <div className="min-w-0 flex-1 cursor-pointer group/cb" onClick={(e) => e.stopPropagation()}>
                <span
                  className="text-sm block truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors"
                  style={{ fontFamily: FONT }}
                >
                  {highlightText(cb, searchTerm)}
                </span>
              </div>
            </UserHoverCard>
          </div>
        );
      }
      case "dueDeliveryDate":
        return (
          <span
            className="block whitespace-nowrap text-sm"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            {item.dueDeliveryDate}
          </span>
        );
      case "orderDate":
        return (
          <span
            className="block whitespace-nowrap text-sm"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            {item.orderDate}
          </span>
        );
      case "pointOfContact":
      case "location":
        return (
          <span
            className="block text-sm"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            —
          </span>
        );
      default:
        return null;
    }
  };

  /* ═══════════════════════════════════════════════════════════ */

  return (
    <DndProvider backend={HTML5Backend}>
      <AppShell>
        <TopBar
          breadcrumbs={[
            { label: "Supply Chain Management", onClick: () => navigate("/") },
            { label: "Purchase Requests" },
          ]}
          showSearch
          searchPlaceholder="Search..."
          showCreateButton={false}
        />
        <div className="animate-page-fade-in flex-1 overflow-hidden flex flex-col bg-slate-50">
          <div
            className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col"
            style={{ fontFamily: FONT }}
          >
            <PageHeaderWithIcon
              icon={ClipboardEdit}
              title="Purchase Requests"
              subtitle="Every purchase request raised across the system, with its status, preferred vendor, and need-by date."
              primaryAction={
                <Button
                  className="bg-primary text-primary-foreground shrink-0"
                  onClick={() => setTypePickerOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1.5" /> New Request
                </Button>
              }
            />

            {/* ══════════ TABLE — same PODataTable used on the PO listing ══════════ */}
            <div className="flex-1 min-h-0 flex flex-col">
              <PODataTable
                filteredData={filteredData}
                allData={allData}
                columns={AVAILABLE_COLUMNS}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
                hiddenColumnIds={hiddenColumnIds}
                onHiddenColumnsChange={setHiddenColumnIds}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                tabDefs={TAB_DEFS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tabCounts={tabCounts}
                tabColor={tabColor}
                ownershipFilter={ownershipFilter}
                ownershipCount={
                  allData.filter((d) => isCurrentUserPR(d.id)).length
                }
                isCurrentUserPO={(item) => isCurrentUserPR(item.id)}
                onOwnershipToggle={() =>
                  setOwnershipFilter((prev) => (prev === "me" ? "all" : "me"))
                }
                onNavigate={(id) => navigate(`/purchase-requests/${id}`)}
                onCreateNew={() => setTypePickerOpen(true)}
                onResetFilters={() => {
                  setSearchTerm("");
                  setFilters(EMPTY_FILTERS);
                  setFilterItems([]);
                  setQuickStatus("all");
                  setActiveTab("all");
                }}
                quickStatus={quickStatus}
                onQuickStatusChange={setQuickStatus}
                renderCell={renderCell}
                highlightText={highlightText}
                activeInsightCount={0}
                onInsightsDrawerOpen={() => {
                  /* No insights drawer for PRs — badge stays at 0. */
                }}
                filters={filters}
                onFiltersChange={setFilters}
                filterPanelOpen={filterPanelOpen}
                onFilterPanelToggle={() => setFilterPanelOpen((v) => !v)}
                pinnedColumnLabel="PR No"
                hideActionsColumn
                hideVersion
                hideInsights
                rowHoverAccent
                hideFilterPointOfContact
                hideFilterLocation
                hideFilterStatus
                searchPlaceholder="Search by PR, vendor, or item..."
                resultNoun={{ singular: "request", plural: "requests" }}
                emptyState={{
                  ...emptyState,
                  createLabel: "New Request",
                }}
                filterItemOptions={itemFilterOptions}
                filterItemSelected={filterItems}
                onFilterItemToggle={(item) =>
                  setFilterItems((prev) =>
                    prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
                  )
                }
                filterLabels={{
                  partnerLocation: {
                    title: "Preferred Vendor",
                    subtitle: "Filter by preferred vendor on the request",
                    placeholder: "Search vendors...",
                  },
                  createdBy: {
                    title: "Requested By",
                    subtitle: "Filter by who raised the request",
                    placeholder: "Search requesters...",
                  },
                  dueDate: {
                    title: "Need By",
                    subtitle: "Filter by the need-by window",
                  },
                  orderDate: {
                    title: "Submitted",
                    subtitle: "Filter by when the request was submitted",
                  },
                  item: {
                    title: "Item",
                    subtitle: "Filter by items on the request",
                    placeholder: "Search items...",
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* ── New-request flow — two-step launcher ──
             1) The Type picker asks whether the buyer is raising a
                request for an existing catalogue item or a new item
                that isn't on file yet.
             2) After a pick, the wizard modal opens with the matching
                Step-1 surface (catalog picker vs new-item form). */}
        <NewRequestTypeModal
          open={typePickerOpen}
          onOpenChange={setTypePickerOpen}
          onSelect={(kind: NewRequestKind) => {
            if (kind === "catalog") {
              /* Existing item — hand off to the catalogue modal. Picks
                 accumulate in `catalogPicks`; review modal opens on
                 close or when the buyer taps the header pill. */
              setCatalogPicks([]);
              setCatalogueModalOpen(true);
            } else {
              /* New item — straight into the single-surface new-item
                 modal (see `NewItemRequestModal`). No wizard steps. */
              setNewItemModalOpen(true);
            }
          }}
        />
        <ItemsCatalogueModal
          open={catalogueModalOpen}
          onClose={() => {
            setCatalogueModalOpen(false);
            /* Fallback bridge — closing the catalogue with picks
               staged still forwards the buyer to the review surface
               so nothing is lost. The primary path is the header
               "Continue to request" pill (see `reviewCTA`). */
            if (catalogPicks.length > 0) setReviewModalOpen(true);
          }}
          mode="po"
          headingOverride="New Purchase Request"
          subtitleOverride="Browse the catalog and add items to the request."
          addButtonLabel="Add to request"
          itemBadgeLabel="In request"
          existingPOItemQtyByNumber={catalogPickQtyByNumber}
          onAddItem={(item) =>
            setCatalogPicks((prev) =>
              prev.some((p) => p.id === item.id) ? prev : [...prev, item],
            )
          }
          reviewCTA={{
            count: catalogPicks.length,
            label: "Continue to request",
            sublabel: "Continue to request",
            onClick: () => {
              setCatalogueModalOpen(false);
              setReviewModalOpen(true);
            },
          }}
          disableItemDetail
        />
        <PurchaseRequestReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          itemIds={catalogPicks.map((p) => p.id)}
          onRemoveItem={(id) =>
            setCatalogPicks((prev) => prev.filter((p) => p.id !== id))
          }
          onBackToItems={() => {
            /* Reopen the catalogue with picks preserved so the buyer
               can add/remove items and return to review. The review
               modal closes itself before firing this callback. */
            setCatalogueModalOpen(true);
          }}
          onSuccess={(id) => navigate(`/purchase-requests/${id}`)}
        />
        <NewItemRequestModal
          open={newItemModalOpen}
          onOpenChange={setNewItemModalOpen}
          onSuccess={(id) => navigate(`/purchase-requests/${id}`)}
        />
      </AppShell>
    </DndProvider>
  );
}
