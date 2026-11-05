import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlignJustify,
  List,
  LayoutGrid,
  ChevronDown,
  Check,
  ArrowUpDown,
  MoreHorizontal,
  ShoppingCart,
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ColumnSelector, ColumnSelectorTrigger } from "../../items-v3/ColumnSelector";
import type { ColumnConfig } from "../../items-v3/ColumnSelector";
import { cn } from "@/lib/utils";
import { InitialAvatar } from "../../items-v3/InitialAvatar";
import type { PurchaseOrder, POStatus } from "../../../context/purchasing/types";
import { PO_STATUS_CONFIG } from "../../../context/purchasing/types";

/* ================================================================
   Density + columns config — mirrors QualifiedVendorsPanel
   ================================================================ */
type Density = "condensed" | "comfort" | "card";

const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

/* Column catalog — verbatim list from the reference PO table.
   Locked: poNumber + partner (always visible). */
const PO_COLUMNS: ColumnConfig[] = [
  { key: "poNumber", label: "PO No" },
  { key: "partner", label: "Vendor" },
  { key: "status", label: "Status" },
  { key: "orderedItems", label: "Ordered Item(s)" },
  { key: "pointOfContact", label: "Point of Contact" },
  { key: "location", label: "Location" },
  { key: "createdBy", label: "Created By" },
  { key: "dueDeliveryDate", label: "Expected PO Completion" },
  { key: "orderDate", label: "Need By Date" },
];
const LOCKED_COLUMNS = ["poNumber", "partner"];

/* ================================================================
   Status pill — Items V2 re-skin of the reference STATUS_CONFIG.
   Each status maps to a tint pair (bg + text) using design tokens.
   ================================================================ */
/* Partners-aligned palette: emerald (success), amber (in-progress), rose (cancelled),
 * neutral slate (draft / informational). No chart colors, no primary tint. */
const STATUS_TONE: Record<POStatus, { bg: string; text: string; border: string }> = {
  draft:                    { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  sent:                     { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  confirmed:                { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  active_with_cancellation: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  partially_received:       { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  fully_received:           { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  cancelled:                { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

function StatusPill({ status }: { status: POStatus }) {
  const cfg = PO_STATUS_CONFIG[status];
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: tone.bg,
        color: tone.text,
        borderColor: tone.border,
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ================================================================
   Quick filter pills — All + every status with a count
   ================================================================ */
const QUICK_FILTER_ORDER: POStatus[] = [
  "draft",
  "sent",
  "confirmed",
  "partially_received",
  "fully_received",
  "active_with_cancellation",
  "cancelled",
];

/* ================================================================
   Row actions — verbatim from spec; status-driven menu items
   ================================================================ */
function rowActionsForStatus(status: POStatus): { label: string; destructive?: boolean }[] {
  switch (status) {
    case "draft":
      return [{ label: "Edit" }, { label: "Submit" }, { label: "Delete", destructive: true }];
    case "sent":
      return [{ label: "View" }, { label: "Cancel", destructive: true }];
    case "confirmed":
      return [{ label: "Receive" }, { label: "View" }, { label: "Cancel", destructive: true }];
    case "partially_received":
      return [{ label: "Receive Remaining" }, { label: "View" }];
    case "fully_received":
      return [{ label: "View" }];
    case "cancelled":
      return [{ label: "View" }];
    case "active_with_cancellation":
      return [{ label: "View" }, { label: "Cancel", destructive: true }];
  }
}

/* ================================================================
   Sort helpers
   ================================================================ */
const SORT_FIELD: Record<string, (p: PurchaseOrder) => unknown> = {
  poNumber: (p) => p.poNumber,
  partner: (p) => p.partnerName,
  status: (p) => p.status,
  orderedItems: (p) => p.orderedItems,
  pointOfContact: (p) => p.pointOfContact,
  location: (p) => p.location,
  createdBy: (p) => p.createdByName,
  dueDeliveryDate: (p) => p.dueDeliveryDate,
  orderDate: (p) => p.orderDate,
};

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/* ================================================================
   Public props — mirrors QualifiedVendorsPanel
   ================================================================ */
export interface PurchaseOrdersPanelProps {
  itemId: string;
  pos: PurchaseOrder[];
  /** Primary toggle row injected by ItemPurchasingTab. */
  headerSlot?: ReactNode;
  /** Callback fired when the empty-state CTA is clicked. */
  onCreatePO?: () => void;
}

export function PurchaseOrdersPanel({ itemId, pos, headerSlot, onCreatePO }: PurchaseOrdersPanelProps) {
  void itemId; // PO list is already item-scoped by the parent

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | POStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [density, setDensity] = useState<Density>("condensed");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(PO_COLUMNS.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PO_COLUMNS.map((c) => [c.key, true])),
  );

  const visibleColumnKeys = useMemo(
    () => columnOrder.filter((k) => columnVisibility[k] !== false),
    [columnOrder, columnVisibility],
  );
  const visibleCount = visibleColumnKeys.length;

  /* Counts per status for the quick-filter pills (computed off the unfiltered list). */
  const statusCounts = useMemo(() => {
    const map = new Map<POStatus, number>();
    for (const po of pos) map.set(po.status, (map.get(po.status) ?? 0) + 1);
    return map;
  }, [pos]);

  /* Filter → sort pipeline */
  const visible = useMemo(() => {
    let list = pos;
    if (quickFilter !== "all") list = list.filter((p) => p.status === quickFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.poNumber.toLowerCase().includes(q) ||
          p.partnerName.toLowerCase().includes(q) ||
          p.pointOfContact.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.orderedItems.toLowerCase().includes(q),
      );
    }
    if (sortKey && SORT_FIELD[sortKey]) {
      const fn = SORT_FIELD[sortKey];
      list = [...list].sort((a, b) => {
        const cmp = compareValues(fn(a), fn(b));
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [pos, searchQuery, quickFilter, sortKey, sortDirection]);

  const totalCount = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = totalCount === 0 ? 0 : (safePage - 1) * pageSize;
  const endIdx = Math.min(safePage * pageSize, totalCount);
  const pageRows = useMemo(
    () => visible.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visible, safePage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, quickFilter, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleHideColumn = (key: string) => {
    if (LOCKED_COLUMNS.includes(key)) return;
    setColumnVisibility((prev) => ({ ...prev, [key]: false }));
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

  const handleRowClick = (po: PurchaseOrder) => {
    // eslint-disable-next-line no-console
    console.log("[PO] Row click", { po });
    toast.info("PO detail coming in Slice 2C");
  };

  const handleAction = (action: string, po: PurchaseOrder) => {
    // eslint-disable-next-line no-console
    console.log("[PO] action", { action, po: po.poNumber });
    toast.info(`${action} ${po.poNumber} — coming soon`);
  };

  const isEmpty = pos.length === 0;

  return (
    <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip">
      <div className="flex-1 min-w-0 flex flex-col overflow-clip">
        {headerSlot && <div className="border-b border-border shrink-0">{headerSlot}</div>}

        {isEmpty ? (
          /* Empty state — centered card matching QV empty-state pattern */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No purchase orders yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create a purchase order to start ordering this item from qualified vendors.
            </p>
            <Button
              size="sm"
              className="mt-4 h-8 gap-1.5 px-3 text-xs"
              onClick={() => (onCreatePO ? onCreatePO() : toast.info("Create PO coming in Slice 2B"))}
            >
              <ShoppingCart className="h-3 w-3" />
              Create PO
            </Button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    placeholder="Search purchase orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toast.info("PO filters land in slice 3.")}
                  className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm text-foreground hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                </button>
              </div>

              {/* Right cluster — count + density + columns */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                  {totalCount !== pos.length ? (
                    <>
                      <span className="text-foreground">{totalCount}</span>
                      <span className="text-muted-foreground/60"> of </span>
                      <span className="text-muted-foreground">{pos.length}</span>
                      <span className="text-muted-foreground/70"> orders</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground">{pos.length}</span>
                      <span className="text-muted-foreground/70"> orders</span>
                    </>
                  )}
                </span>

                <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      {density === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      {density === "card" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                        {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                    {DENSITY_CONFIG.map((opt) => (
                      <DropdownMenuItem
                        key={opt.key}
                        className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                        disabled={opt.key === "card"}
                        onSelect={(e) => {
                          if (opt.key === "card") { e.preventDefault(); return; }
                          setDensity(opt.key);
                        }}
                      >
                        {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                        {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                        {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {opt.key === "card" ? "Coming soon" : opt.description}
                          </div>
                        </div>
                        {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <ColumnSelectorTrigger
                  visibleCount={visibleCount}
                  active={columnsOpen}
                  onClick={() => setColumnsOpen(!columnsOpen)}
                />
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
              {([
                { key: "all" as const, label: "All", count: pos.length },
                ...QUICK_FILTER_ORDER
                  .filter((s) => (statusCounts.get(s) ?? 0) > 0)
                  .map((s) => ({ key: s, label: PO_STATUS_CONFIG[s].label, count: statusCounts.get(s) ?? 0 })),
              ]).map((qf) => {
                const isActive = quickFilter === qf.key;
                return (
                  <button
                    key={qf.key}
                    onClick={() => setQuickFilter(qf.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                    }`}
                    style={{
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? "#0A77FF" : undefined,
                    }}
                  >
                    {qf.label}
                    <span
                      className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                        isActive ? "bg-primary/10" : "bg-muted"
                      }`}
                      style={{
                        fontWeight: 600,
                        color: isActive ? "#0A77FF" : "#475569",
                      }}
                    >
                      {qf.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div className="border-t border-border/60 flex-1 min-h-0 flex flex-col">
              {totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1 min-h-0">
                  <p className="text-sm" style={{ fontWeight: 500 }}>
                    {searchQuery.trim() ? "No purchase orders match your search." : "No purchase orders match your filters."}
                  </p>
                </div>
              ) : (
                <POTable
                  rows={pageRows}
                  visibleColumnKeys={visibleColumnKeys}
                  density={density}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onHideColumn={handleHideColumn}
                  onRowClick={handleRowClick}
                  onAction={handleAction}
                />
              )}

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Records per page</span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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
          </>
        )}
      </div>

      <ColumnSelector
        columns={PO_COLUMNS}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        onColumnOrderChange={setColumnOrder}
        onColumnVisibilityChange={setColumnVisibility}
        lockedColumns={LOCKED_COLUMNS}
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
      />
    </div>
  );
}

/* ================================================================
   POTable — table body, ported from reference but re-skinned to
   match Items V2 / QVTable design tokens.
   ================================================================ */
interface POTableProps {
  rows: PurchaseOrder[];
  visibleColumnKeys: string[];
  density: Density;
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
  onHideColumn: (key: string) => void;
  onRowClick: (po: PurchaseOrder) => void;
  onAction: (action: string, po: PurchaseOrder) => void;
}

function POTable({
  rows,
  visibleColumnKeys,
  density,
  sortKey,
  sortDirection,
  onSort,
  onHideColumn,
  onRowClick,
  onAction,
}: POTableProps) {
  const cellPad = density === "condensed" ? "py-1 px-3" : "py-2 px-3";
  const headerHeight = density === "condensed" ? "h-8" : "h-9";

  const columnLabel: Record<string, string> = Object.fromEntries(PO_COLUMNS.map((c) => [c.key, c.label]));
  const sortable = new Set(["poNumber", "partner", "orderedItems", "pointOfContact", "dueDeliveryDate", "orderDate"]);

  return (
    <div className="overflow-x-auto flex-1 min-h-0">
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: "1100px" }}>
        <thead className="bg-muted/30 border-b border-border sticky top-0 z-10">
          <tr className={headerHeight}>
            {visibleColumnKeys.map((key) => {
              const isSortable = sortable.has(key);
              const isSorted = sortKey === key;
              return (
                <th
                  key={key}
                  className="text-left text-[13px] font-medium text-muted-foreground px-3 whitespace-nowrap"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                      >
                        <span>{columnLabel[key]}</span>
                        {isSortable && (
                          <ArrowUpDown
                            className={cn(
                              "w-3 h-3 transition-opacity",
                              isSorted ? "opacity-100 text-foreground" : "opacity-50",
                            )}
                          />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {isSortable && (
                        <>
                          <DropdownMenuItem onSelect={() => { onSort(key); if (sortKey !== key || sortDirection !== "asc") onSort(key); }}>
                            Sort A → Z
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => { if (sortKey !== key) onSort(key); onSort(key); }}>
                            Sort Z → A
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {!LOCKED_COLUMNS.includes(key) && (
                        <DropdownMenuItem onSelect={() => onHideColumn(key)}>
                          Hide column
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
              );
            })}
            <th className="w-[60px] px-2 text-[13px] text-left font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/60 transition-colors cursor-pointer group hover:bg-[#F0F7FF]"
              onClick={() => onRowClick(row)}
            >
              {visibleColumnKeys.map((key) => (
                <td key={key} className={cn(cellPad, "text-[13px] text-foreground whitespace-nowrap")}>
                  {renderCell(key, row)}
                </td>
              ))}
              <td className={cn(cellPad, "w-[60px]")} data-row-action onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px] bg-popover">
                    {rowActionsForStatus(row.status).map((a) => (
                      <DropdownMenuItem
                        key={a.label}
                        className={cn("cursor-pointer", a.destructive ? "text-destructive focus:text-destructive" : "")}
                        onSelect={() => onAction(a.label, row)}
                      >
                        {a.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(key: string, row: PurchaseOrder) {
  switch (key) {
    case "poNumber":
      return <span className="text-[13px] font-medium text-foreground hover:text-primary hover:underline">{row.poNumber}</span>;
    case "partner":
      return (
        <div className="flex items-center gap-2 group/p cursor-pointer">
          <InitialAvatar name={row.partnerName} size="sm" />
          <span className="text-[13px] text-foreground truncate max-w-[14rem] group-hover/p:text-primary group-hover/p:underline transition-colors" style={{ fontWeight: 500 }}>{row.partnerName}</span>
        </div>
      );
    case "status":
      return <StatusPill status={row.status} />;
    case "orderedItems":
      return (
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-foreground">{row.orderedItems || "—"}</span>
          {row.orderedItemsMore ? (
            <span className="text-[11px] cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{row.orderedItemsMore} more</span>
          ) : null}
        </div>
      );
    case "pointOfContact":
      return row.pointOfContact ? (
        <div className="flex items-center gap-2 group/c cursor-pointer">
          <InitialAvatar name={row.pointOfContact} size="sm" />
          <span className="text-[13px] text-foreground truncate max-w-[10rem] group-hover/c:text-primary group-hover/c:underline transition-colors">{row.pointOfContact}</span>
        </div>
      ) : (
        <span className="text-[13px] text-muted-foreground">—</span>
      );
    case "location":
      return <span className="text-[13px] text-foreground">{row.location || "—"}</span>;
    case "createdBy":
      return (
        <div className="flex items-center gap-2 group/cb cursor-pointer">
          <InitialAvatar name={row.createdByName} size="sm" />
          <span className="text-[13px] text-foreground truncate max-w-[10rem] group-hover/cb:text-primary group-hover/cb:underline transition-colors">{row.createdByName}</span>
        </div>
      );
    case "dueDeliveryDate":
      return <span className="text-[13px] text-foreground">{row.dueDeliveryDate || "—"}</span>;
    case "orderDate":
      return <span className="text-[13px] text-foreground">{row.orderDate || "—"}</span>;
    default:
      return null;
  }
}
