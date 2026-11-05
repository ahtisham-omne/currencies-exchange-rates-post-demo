import { useMemo, useState, type ReactNode } from "react";
import {
  Search,
  X,
  Plus,
  SlidersHorizontal,
  AlignJustify,
  List as ListIcon,
  LayoutGrid,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QVCardList } from "./QVCardList";
import {
  QVTable,
  QV_COLUMN_DEFS,
  QV_LOCKED_COLUMNS,
  QV_DEFAULT_HIDDEN_COLUMNS,
} from "./QVTable";
import { VendorDetailModal } from "./VendorDetailModal";
import { RemoveVendorDialog } from "./RemoveVendorDialog";
import { ColumnSelector, ColumnSelectorTrigger } from "../../items-v3/ColumnSelector";
import { usePurchasing } from "../../../context/PurchasingContext";
import type { QualifiedVendor } from "../../../context/purchasing/types";

export interface QualifiedVendorsPanelProps {
  itemId: string;
  qvs: QualifiedVendor[];
  /** Optional header row rendered as Row 1 of the outer card (above the toolbar),
   *  separated by `border-b border-border`. Used by ItemPurchasingTab to inject the
   *  primary Qualified Vendors / Purchase Orders toggle + CTA inside the same card. */
  headerSlot?: ReactNode;
  /** Optional node rendered inside the toolbar's right cluster, just before the vendor count. */
  toolbarRightSlot?: ReactNode;
  /** Row → "Edit Configuration": opens the qualify modal in edit mode. */
  onEditConfig?: (qv: QualifiedVendor) => void;
  /** Opens the Add Qualified Vendor modal — drives the empty-state CTA. */
  onAddVendor?: () => void;
}

type Density = "condensed" | "comfort" | "card";

/* Density options — mirrors the Partners "Items they sell" tab density
   dropdown (Condensed / Comfortable / Card). Card view reuses QVCardList. */
const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact rows — more vendors on screen", icon: "align-justify" },
  { key: "comfort", label: "Comfortable", description: "Roomier rows, easier scanning", icon: "list" },
  { key: "card", label: "Card", description: "Vendor cards with drag-to-rank", icon: "layout-grid" },
];

/* Maps a column key to a comparable value for client-side sorting. */
function sortValue(v: QualifiedVendor, key: string): number | string {
  switch (key) {
    case "priority": return v.priority;
    case "partner": return v.vendorName.toLowerCase();
    case "location": return v.location.toLowerCase();
    case "country": return (v.country ?? "").toLowerCase();
    case "creditLimit": return v.creditLimit ?? -1;
    case "pricePerUnit": return v.pricePerUnit;
    case "lastPoPricePerUnit": return v.lastPOPricePerUnit;
    case "lastPoTotalAmount": return v.lastPOTotalAmount;
    case "minOrderQty": return v.minOrderQty ?? -1;
    case "maxOrderQty": return v.maxOrderQty ?? -1;
    case "multiples": return v.multiples ?? -1;
    case "acceptedDeviation": return v.acceptedDeviation;
    case "shipOnTime": return v.shipOnTime;
    case "leadTime": return v.lastPOLeadTime;
    default: return 0;
  }
}

/* The vendor (partner) detail page lives in the separate Partner module
   (Partner-Management---Vendor), deployed at PARTNER_MODULE_BASE and serving the
   `/vendors/:id` route — no detail page is built here. "View Details" opens that
   route in a NEW TAB. */
const PARTNER_MODULE_BASE = "https://partner-management-module.lovable.app";
/* The two apps carry INDEPENDENT mock vendor data: this app's qualified-vendor
   ids are "V-#####", while the Partner module keys vendors as "v-001".."v-019".
   This bridges each of our mock vendors to a real partner record so the deep-link
   resolves. Replace with a shared vendor id once the modules share a source.
   Unknown ids fall back to a deterministic in-range partner id. */
const PARTNER_VENDOR_ID_MAP: Record<string, string> = {
  "V-11002": "v-001",
  "V-22918": "v-002",
  "V-33421": "v-003",
  "V-44921": "v-004",
  "V-55782": "v-005",
  "V-66104": "v-006",
  "V-77293": "v-007",
  "V-88742": "v-008",
  "V-99281": "v-009",
};
const PARTNER_VENDOR_COUNT = 19; // v-001..v-019 exist in the Partner module
function toPartnerVendorId(vendorId: string): string {
  const trimmed = (vendorId ?? "").trim();
  if (PARTNER_VENDOR_ID_MAP[trimmed]) return PARTNER_VENDOR_ID_MAP[trimmed];
  if (/^v-\d{3,}$/i.test(trimmed)) return trimmed.toLowerCase(); // already partner-form
  const digits = trimmed.replace(/\D/g, "");
  const n = digits ? (Number(digits) % PARTNER_VENDOR_COUNT) + 1 : 1;
  return `v-${String(n).padStart(3, "0")}`;
}
function partnerDetailUrl(vendorId: string): string {
  return `${PARTNER_MODULE_BASE}/vendors/${encodeURIComponent(toPartnerVendorId(vendorId))}`;
}

export function QualifiedVendorsPanel({ itemId, qvs, headerSlot, toolbarRightSlot, onEditConfig, onAddVendor }: QualifiedVendorsPanelProps) {
  const { reorderQVs, deleteQV } = usePurchasing();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  /* View + table controls — Partners parity. */
  const [density, setDensity] = useState<Density>("condensed");
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(QV_COLUMN_DEFS.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(QV_COLUMN_DEFS.map((c) => [c.key, !QV_DEFAULT_HIDDEN_COLUMNS.includes(c.key)])),
  );
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /* Selected QV opens the Partner Detail center modal. */
  const [selectedQVForDetail, setSelectedQVForDetail] = useState<QualifiedVendor | null>(null);

  /* Vendor pending removal — drives the shared remove-warning modal. */
  const [pendingRemove, setPendingRemove] = useState<QualifiedVendor | null>(null);

  const matchesSearch = (v: QualifiedVendor, q: string) =>
    v.vendorName.toLowerCase().includes(q) || v.location.toLowerCase().includes(q);

  /* Search applied; priority order preserved unless a column sort is active. */
  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? qvs.filter((v) => matchesSearch(v, q)) : qvs;
  }, [qvs, searchQuery]);

  const sorted = useMemo(() => {
    if (!sortKey) return visible;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [visible, sortKey, sortDirection]);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = totalCount === 0 ? 0 : (safePage - 1) * pageSize;
  const endIdx = Math.min(safePage * pageSize, totalCount);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const visibleColumnKeys = useMemo(
    () => columnOrder.filter((k) => columnVisibility[k] !== false),
    [columnOrder, columnVisibility],
  );

  const handleReorder = (next: QualifiedVendor[]) => {
    reorderQVs(itemId, next);
  };

  /* Row / card click intentionally does NOT open the Partner Detail modal — the
     modal is fully hidden per request. Its component, `selectedQVForDetail`
     state, and render below are PRESERVED in the codebase (may be needed again);
     nothing triggers it now. Partner detail opens via the "View Details" action
     (→ partner module, new tab). To restore row-click → modal, uncomment below. */
  const handleRowClick = (_qv: QualifiedVendor) => {
    // setSelectedQVForDetail(_qv);
  };

  /* "View" → open the vendor's detail page in the Partner module in a new tab
     (mirrors that module's /vendors/:id route). The in-app VendorDetailModal is
     intentionally KEPT (still wired to row/card click below) in case we need the
     modal interaction back — to restore it for View, point this handler at
     setSelectedQVForDetail(qv) again. */
  const handleEdit = (qv: QualifiedVendor) => {
    window.open(partnerDetailUrl(qv.vendorId), "_blank", "noopener");
  };

  /* Row / card "Remove" → the shared warning modal (same one shown inside the
     Edit Vendors modal). The modal is the gate; confirm commits the removal. */
  const handleDelete = (qv: QualifiedVendor) => {
    setPendingRemove(qv);
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    deleteQV(itemId, pendingRemove.id);
    toast.success(`${pendingRemove.vendorName} removed from this item's vendors.`);
    setPendingRemove(null);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleHideColumn = (key: string) => {
    setColumnVisibility((v) => ({ ...v, [key]: false }));
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const activeDensity = DENSITY_CONFIG.find((d) => d.key === density)!;

  return (
    /* Outer card is a horizontal flex: [ main column ] + [ ColumnSelector drawer ].
       Matches the Items Library listing layout so the drawer slides in beside the table. */
    <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip">
      <div className="flex-1 min-w-0 flex flex-col overflow-clip">
        {/* Row 1 (optional) — primary toggle + CTA injected by parent (ItemPurchasingTab). */}
        {headerSlot && (
          <div className="border-b border-border shrink-0">{headerSlot}</div>
        )}

        {/* Toolbar — hidden until the first vendor exists. With nothing added
            there is nothing to search, filter, sort, or pick columns for, so the
            controls only appear once vendors are present (the empty state below
            carries the sole Add CTA). Mirrors the partner vendor-config pattern. */}
        {qvs.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search vendors by name or location..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => toast.info("Advanced vendor filters coming soon!")}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          {/* Right cluster — count + density + columns */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
              {totalCount !== qvs.length ? (
                <>
                  <span className="text-foreground">{totalCount}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{qvs.length}</span>
                  <span className="text-muted-foreground/70"> vendors</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{qvs.length}</span>
                  <span className="text-muted-foreground/70"> vendors</span>
                </>
              )}
            </span>
            {toolbarRightSlot}

            <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />

            {/* Density dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "comfort" && <ListIcon className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "card" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{activeDensity.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px] p-1.5 bg-popover">
                {DENSITY_CONFIG.map((opt) => (
                  <DropdownMenuItem
                    key={opt.key}
                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                    onSelect={() => setDensity(opt.key)}
                  >
                    {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                    {opt.icon === "list" && <ListIcon className="w-5 h-5 text-muted-foreground shrink-0" />}
                    {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Column selector — disabled in card view (columns don't apply to cards) */}
            <ColumnSelectorTrigger
              visibleCount={visibleColumnKeys.length}
              active={columnDrawerOpen}
              onClick={() => density !== "card" && setColumnDrawerOpen(!columnDrawerOpen)}
            />
          </div>
        </div>
        )}

        {/* Body */}
        <div className={`flex-1 min-h-0 flex flex-col ${qvs.length > 0 ? "border-t border-border/60" : ""}`}>
          {qvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center flex-1 min-h-0">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-sm font-medium text-foreground">No qualified vendors yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Add vendors to manage pricing, lead times, and order parameters for this item.
              </p>
              {onAddVendor && (
                <button
                  type="button"
                  onClick={onAddVendor}
                  className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm shadow-sm hover:bg-[#0862D0] transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-4 h-4" />
                  Add your first vendor
                </button>
              )}
            </div>
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1 min-h-0">
              <p className="text-sm" style={{ fontWeight: 500 }}>
                {searchQuery.trim() ? "No vendors match your search." : "No vendors match this filter."}
              </p>
            </div>
          ) : density === "card" ? (
            <QVCardList
              qvs={pageRows}
              onReorder={handleReorder}
              onCardClick={handleRowClick}
              onEdit={handleEdit}
              onRemove={handleDelete}
            />
          ) : (
            <QVTable
              qvs={pageRows}
              visibleColumnKeys={visibleColumnKeys}
              density={density}
              lockedColumns={QV_LOCKED_COLUMNS}
              onReorder={handleReorder}
              onRowClick={handleRowClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onHideColumn={handleHideColumn}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              onEditConfig={onEditConfig}
              /* Priority + the default vendor are managed in the Configure tier
                 lanes and the Edit Vendors modal, not here; drag-to-reorder is
                 intentionally disabled in this listing. */
              disableDrag
            />
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Records per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Showing {startIdx + 1}-{endIdx} of {totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage === 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </Button>
                {getPageNumbers().map((pg, idx) =>
                  pg === "..." ? (
                    <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={pg}
                      variant={safePage === pg ? "default" : "ghost"}
                      size="sm"
                      className={`h-8 w-8 p-0 text-sm ${safePage === pg ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => setPage(pg as number)}
                    >
                      {pg}
                    </Button>
                  ),
                )}
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))}>
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Column selector drawer — slides in beside the table (Items Library parity) */}
      <ColumnSelector
        open={columnDrawerOpen && density !== "card"}
        onOpenChange={setColumnDrawerOpen}
        columns={QV_COLUMN_DEFS}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        lockedColumns={QV_LOCKED_COLUMNS}
      />

      {/* Partner Detail center modal */}
      <VendorDetailModal
        open={selectedQVForDetail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedQVForDetail(null);
        }}
        vendor={selectedQVForDetail}
        itemId={itemId}
      />

      {/* Remove-vendor warning — the same modal used inside the Edit Vendors modal. */}
      <RemoveVendorDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => { if (!open) setPendingRemove(null); }}
        vendorName={pendingRemove?.vendorName}
        isDefault={!!pendingRemove?.isPrimary}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
