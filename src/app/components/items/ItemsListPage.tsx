import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useItems, type Item } from "../../context/ItemsContext";
import { ItemStatusBadge } from "./ItemStatusBadge";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "./ColumnSelector";
import {
  ItemKpiInsightsPanel,
  ALL_ITEM_KPI_DEFINITIONS,
  DEFAULT_ACTIVE_ITEM_KPIS,
  computeItemKpiValue,
  ItemKpiIcon,
} from "./ItemKpiInsightsPanel";
import {
  ItemColumnHeaderMenu,
  ItemActiveFiltersBar,
  applyItemColumnFilters,
  createBlankFilter,
  type ColumnFilterState,
  type SortConfig,
} from "./ItemColumnHeaderMenu";
import {
  ItemFiltersModal,
  DEFAULT_ITEM_FILTERS,
  countActiveItemFilters,
  type ItemAdvancedFilters,
} from "./ItemFiltersModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  ChevronDown,
  X,
  Calendar,
  ChartColumn,
  Package,
  AlignJustify,
  List,
  LayoutGrid,
  ArchiveRestore,
} from "lucide-react";

type QuickFilter = "all" | "in_stock" | "low_stock" | "out_of_stock" | "archived";
type DensityOption = "condensed" | "comfort";

const DENSITY_CONFIG: {
  key: DensityOption;
  label: string;
  description: string;
  icon: "align-justify" | "list";
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
];

const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "in_stock", label: "In Stock", showCount: true },
  { key: "low_stock", label: "Low Stock", showCount: true },
  { key: "out_of_stock", label: "Out of Stock", showCount: true },
  { key: "archived", label: "Archived", showCount: true },
];

const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "part_number", label: "Items", minWidth: "320px", sortable: true },
  { key: "status", label: "Status", minWidth: "130px" },
  { key: "primary_category", label: "Primary Category", minWidth: "180px", sortable: true },
  { key: "inventory_control", label: "Inventory Control", minWidth: "170px" },
  { key: "on_hand_qty", label: "On Hand", minWidth: "140px", sortable: true, align: "right" },
  { key: "unit", label: "Unit", minWidth: "100px" },
  { key: "manufacturer", label: "Manufacturer", minWidth: "180px", sortable: true },
  { key: "mpn", label: "MPN", minWidth: "160px" },
  { key: "acquisition_method", label: "Acquisition", minWidth: "150px" },
  { key: "created_on", label: "Created On", minWidth: "150px", sortable: true },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, true])
);
const LOCKED_COLUMNS = ["part_number"];

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getAcquisitionLabel(item: Item): string {
  const a = item.acquisitionMethod;
  if (typeof a === "string") return a;
  return a?.primary ?? "—";
}

export function ItemsListPage() {
  const navigate = useNavigate();
  const { items, archiveItem, restoreItem, deleteItem } = useItems();

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  /* Advanced Filters */
  const [advFilters, setAdvFilters] = useState<ItemAdvancedFilters>({ ...DEFAULT_ITEM_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveItemFilters(advFilters), [advFilters]);

  /* Per-column filters */
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => {
    const map: Record<string, string> = {};
    COLUMN_DEFS.forEach((c) => { map[c.key] = c.label; });
    return map;
  }, []);

  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      return { ...prev, [columnKey]: createBlankFilter(columnKey) };
    });
    setCurrentPage(1);
  }, []);

  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      return { ...prev, [columnKey]: createBlankFilter(columnKey) };
    });
    setAutoOpenFilterKey(null);
    setTimeout(() => setAutoOpenFilterKey(columnKey), 0);
  }, []);

  const handleColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: filter }));
    setCurrentPage(1);
  }, []);

  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  }, []);

  const handleClearAllColumnFilters = useCallback(() => {
    setColumnFilters({});
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
    setCurrentPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    setColumnFilters((prev) => {
      if (!prev[columnKey]) return prev;
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  }, []);

  const handleAutoOpened = useCallback(() => setAutoOpenFilterKey(null), []);

  /* KPI state */
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_ITEM_KPIS]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState("last_30");
  const [showInsights, setShowInsights] = useState(true);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  const handleToggleKpi = (key: string) => {
    setActiveKpis((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const activeKpiDefs = useMemo(() => {
    return activeKpis
      .map((key) => ALL_ITEM_KPI_DEFINITIONS.find((d) => d.key === key))
      .filter(Boolean) as typeof ALL_ITEM_KPI_DEFINITIONS;
  }, [activeKpis]);

  /* Column visibility */
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });

  const validColumnKeys = useMemo(() => new Set(COLUMN_DEFS.map((c) => c.key)), []);
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter((key) => validColumnKeys.has(key) && columnVisibility[key] !== false);
    if (!ordered.includes("part_number")) ordered.unshift("part_number");
    else if (ordered[0] !== "part_number") {
      const idx = ordered.indexOf("part_number");
      ordered.splice(idx, 1);
      ordered.unshift("part_number");
    }
    return ordered;
  }, [columnOrder, columnVisibility, validColumnKeys]);

  const colDef = (key: string) => COLUMN_DEFS.find((c) => c.key === key)!;

  const filterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = {
      all: items.length,
      in_stock: 0,
      low_stock: 0,
      out_of_stock: 0,
      archived: 0,
    };
    items.forEach((i) => {
      if (i.status === "In Stock") counts.in_stock++;
      if (i.status === "Low Stock") counts.low_stock++;
      if (i.status === "Out of Stock") counts.out_of_stock++;
      if (i.status === "Archived") counts.archived++;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const base = items.filter((i) => {
      const matchesSearch =
        !searchQuery ||
        i.partNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.mpn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.primaryCategory?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      switch (quickFilter) {
        case "in_stock": matchesFilter = i.status === "In Stock"; break;
        case "low_stock": matchesFilter = i.status === "Low Stock"; break;
        case "out_of_stock": matchesFilter = i.status === "Out of Stock"; break;
        case "archived": matchesFilter = i.status === "Archived"; break;
      }

      const f = advFilters;
      if (f.statuses.length > 0 && !f.statuses.includes(i.status)) return false;
      if (f.inventoryControl.length > 0 && !f.inventoryControl.includes(i.inventoryControlType)) return false;
      if (f.primaryCategories.length > 0 && !f.primaryCategories.includes(i.primaryCategory)) return false;
      if (f.manufacturers.length > 0 && !f.manufacturers.includes(i.manufacturer)) return false;
      if (f.acquisitionMethods.length > 0) {
        const a = i.acquisitionMethod;
        const label = typeof a === "string" ? a : a?.primary ?? "";
        if (!f.acquisitionMethods.includes(label)) return false;
      }
      if (f.onHandMin && i.onHandQty < Number(f.onHandMin)) return false;
      if (f.onHandMax && i.onHandQty > Number(f.onHandMax)) return false;
      if (f.partNumber && !i.partNumber?.toLowerCase().includes(f.partNumber.toLowerCase())) return false;
      if (f.mpn && !(i.mpn || "").toLowerCase().includes(f.mpn.toLowerCase())) return false;
      if (f.createdFrom && i.createdAt) {
        if (new Date(i.createdAt) < new Date(f.createdFrom)) return false;
      }
      if (f.createdTo && i.createdAt) {
        const to = new Date(f.createdTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(i.createdAt) > to) return false;
      }

      return matchesSearch && matchesFilter;
    });

    let result = applyItemColumnFilters(base, columnFiltersList);

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        const key = sortConfig.key;
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (key) {
          case "part_number": aVal = a.partNumber || ""; bVal = b.partNumber || ""; break;
          case "primary_category": aVal = a.primaryCategory || ""; bVal = b.primaryCategory || ""; break;
          case "on_hand_qty": aVal = a.onHandQty ?? 0; bVal = b.onHandQty ?? 0; break;
          case "manufacturer": aVal = a.manufacturer || ""; bVal = b.manufacturer || ""; break;
          case "created_on": aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0; bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0; break;
        }
        if (typeof aVal === "string" && typeof bVal === "string") return dir * aVal.localeCompare(bVal);
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }
    return result;
  }, [items, searchQuery, quickFilter, advFilters, columnFiltersList, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / recordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredItems.slice(start, start + recordsPerPage);
  }, [filteredItems, currentPage, recordsPerPage]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setQuickFilter("all");
    setAdvFilters({ ...DEFAULT_ITEM_FILTERS });
    setColumnFilters({});
    setSortConfig(null);
    setCurrentPage(1);
  };

  const hasAnyFilter =
    !!searchQuery ||
    quickFilter !== "all" ||
    activeFilterCount > 0 ||
    Object.keys(columnFilters).length > 0;

  const handleArchive = () => {
    if (selectedItemId) {
      archiveItem(selectedItemId);
      setArchiveDialogOpen(false);
      setSelectedItemId(null);
    }
  };

  const handleDelete = () => {
    if (selectedItemId) {
      deleteItem(selectedItemId);
      setDeleteDialogOpen(false);
      setSelectedItemId(null);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const renderCellContent = (item: Item, columnKey: string) => {
    switch (columnKey) {
      case "part_number":
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
              {item.images && item.images[0] ? (
                <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-4 h-4 text-muted-foreground/50" />
              )}
            </div>
            <div className="min-w-0">
              <button
                onClick={() => navigate(`/items/${item.id}`)}
                className="text-[13px] hover:underline text-left truncate block w-full cursor-pointer"
                style={{ fontWeight: 500, color: "#0f172a" }}
              >
                {item.partNumber}
              </button>
              <p className="text-[12px] text-muted-foreground truncate">{item.description}</p>
            </div>
          </div>
        );
      case "status":
        return <ItemStatusBadge status={item.status} />;
      case "primary_category":
        return <span className="text-[13px] text-foreground">{item.primaryCategory || "—"}</span>;
      case "inventory_control":
        return (
          <span
            className="inline-flex items-center text-[12px] px-2 py-0.5 rounded-md border border-border/60 bg-muted/30 text-foreground"
            style={{ fontWeight: 500 }}
          >
            {item.inventoryControlType}
          </span>
        );
      case "on_hand_qty":
        return (
          <span className="text-[13px] tabular-nums text-foreground" style={{ fontWeight: 500 }}>
            {formatNumber(item.onHandQty)} <span className="text-muted-foreground/70" style={{ fontWeight: 400 }}>{item.unit}</span>
          </span>
        );
      case "unit":
        return <span className="text-[13px] text-muted-foreground">{item.unit}</span>;
      case "manufacturer":
        return <span className="text-[13px] text-foreground">{item.manufacturer || "—"}</span>;
      case "mpn":
        return <span className="text-[13px] text-muted-foreground tabular-nums">{item.mpn || "—"}</span>;
      case "acquisition_method":
        return <span className="text-[13px] text-foreground">{getAcquisitionLabel(item)}</span>;
      case "created_on":
        return <span className="text-[13px] text-muted-foreground tabular-nums">{formatDate(item.createdAt)}</span>;
      default:
        return <span className="text-[13px] text-muted-foreground">—</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Inventory Management
          </button>
          <span className="text-muted-foreground">/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">Items</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Search..."
              className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
              <span className="text-[11px]" style={{ fontWeight: 600, color: '#0A77FF' }}>AA</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Senior Product Designer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col">
          {/* Page Header — bleeds out to full width via negative margins */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
                <Package className="w-4 h-4" style={{ color: '#0A77FF' }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Items</h1>
                <p className="text-xs text-muted-foreground">
                  Manage your inventory catalog — parts, materials, assemblies, and consumables — all in one place.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/items/new")}
              className="bg-primary text-primary-foreground shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Item
            </Button>
          </div>

          {/* KPI Insights */}
          {showInsights && activeKpiDefs.length > 0 && (
            <div className="mb-4 shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                    Inventory Insights
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                        <Calendar className="w-3 h-3" />
                        <span style={{ fontWeight: 500 }}>
                          {insightsDateRange === "last_7" && "Last 7 days"}
                          {insightsDateRange === "last_30" && "Last 30 days"}
                          {insightsDateRange === "last_90" && "Last 90 days"}
                          {insightsDateRange === "last_365" && "Last 12 months"}
                          {insightsDateRange === "all_time" && "All time"}
                        </span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[170px] bg-popover">
                      {[
                        { key: "last_7", label: "Last 7 days" },
                        { key: "last_30", label: "Last 30 days" },
                        { key: "last_90", label: "Last 90 days" },
                        { key: "last_365", label: "Last 12 months" },
                        { key: "all_time", label: "All time" },
                      ].map((opt) => (
                        <DropdownMenuItem
                          key={opt.key}
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setInsightsDateRange(opt.key)}
                        >
                          <span className="text-sm">{opt.label}</span>
                          {insightsDateRange === opt.key && <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button
                  onClick={() => setInsightsPanelOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  style={{ fontWeight: 500, color: "#0A77FF" }}
                >
                  <Plus className="w-3 h-3" />
                  Add Insights
                </button>
              </div>

              {/* KPI Cards — static grid (no drag-reorder per Phase 2 scope) */}
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {activeKpiDefs.map((kpi) => {
                  const value = computeItemKpiValue(kpi.key, items);
                  return (
                    <div
                      key={kpi.key}
                      className="bg-white rounded-xl border border-border p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: kpi.iconBg }}
                      >
                        <ItemKpiIcon name={kpi.iconName} className="w-5 h-5" style={{ color: kpi.iconColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>
                          {kpi.label}
                        </p>
                        <p className="text-[18px] tabular-nums truncate" style={{ fontWeight: 600 }}>
                          {value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customize KPI drawer */}
          <ItemKpiInsightsPanel
            open={insightsPanelOpen}
            onOpenChange={setInsightsPanelOpen}
            activeKpis={activeKpis}
            onToggleKpi={handleToggleKpi}
            items={items}
          />

          {/* Unified Table Container */}
          <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip">
            <div className="flex-1 min-w-0 flex flex-col overflow-clip">

              {/* Row 1: Search + Filters ... Count + Density */}
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      placeholder="Search by part #, description, manufacturer..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                      activeFilterCount > 0
                        ? "text-primary border-primary/30"
                        : "text-foreground border-border/80"
                    }`}
                  >
                    <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                    {activeFilterCount > 0 && (
                      <span
                        className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                        style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                    {filteredItems.length !== items.length ? (
                      <>
                        <span className="text-foreground">{filteredItems.length}</span>
                        <span className="text-muted-foreground/60"> of </span>
                        <span className="text-muted-foreground">{items.length}</span>
                        <span className="text-muted-foreground/70"> items</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground">{items.length}</span>
                        <span className="text-muted-foreground/70"> items</span>
                      </>
                    )}
                  </span>

                  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => {
                      if (!showInsights) setShowInsights(true);
                      setInsightsPanelOpen(true);
                    }}
                    className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      insightsPanelOpen
                        ? "border-primary/30 bg-primary/[0.04] text-foreground"
                        : "border-border bg-white text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                    <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                      Insights
                    </span>
                    {activeKpiDefs.length > 0 && (
                      <span
                        className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                        style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}
                      >
                        {activeKpiDefs.length}
                      </span>
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                        {density === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                          {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[230px] p-1.5 bg-popover">
                      {DENSITY_CONFIG.map((opt) => (
                        <DropdownMenuItem
                          key={opt.key}
                          className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                          onSelect={() => setDensity(opt.key)}
                        >
                          {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                          {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                          {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ColumnSelectorTrigger
                    visibleCount={visibleColumns.length}
                    active={columnDrawerOpen}
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />
                </div>
              </div>

              {/* Row 2: Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                {QUICK_FILTER_OPTIONS.map((filter) => {
                  const isActive = quickFilter === filter.key;
                  const count = filterCounts[filter.key];
                  return (
                    <button
                      key={filter.key}
                      onClick={() => { setQuickFilter(filter.key); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                      }`}
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? '#0A77FF' : undefined,
                      }}
                    >
                      {filter.label}
                      {filter.showCount && (
                        <span
                          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                            isActive ? "bg-primary/10" : "bg-muted"
                          }`}
                          style={{
                            fontWeight: 600,
                            color: isActive ? '#0A77FF' : '#475569',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Column Filters Bar */}
              <ItemActiveFiltersBar
                columnFilters={columnFiltersList}
                columnLabels={columnLabels}
                items={items}
                onFilterChange={handleColumnFilterChange}
                onRemoveFilter={handleRemoveColumnFilter}
                onAddFilter={handleAddColumnFilterWithAutoOpen}
                onClearAll={handleClearAllColumnFilters}
                autoOpenKey={autoOpenFilterKey}
                onAutoOpened={handleAutoOpened}
                availableColumns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
              />

              <div className="border-t border-border shrink-0" />

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                {paginatedItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <Package className="w-8 h-8" />
                    <p className="text-sm">No items found</p>
                    {hasAnyFilter && (
                      <Button variant="link" size="sm" onClick={clearAllFilters}>
                        Clear all filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                        {visibleColumns.map((key) => {
                          const def = colDef(key);
                          const isLocked = LOCKED_COLUMNS.includes(key);
                          const hasActiveFilter = !!columnFilters[key];
                          return (
                            <TableHead
                              key={key}
                              className="text-[12px] text-muted-foreground px-3"
                              style={{
                                minWidth: def.minWidth,
                                fontWeight: 600,
                                textAlign: def.align === "right" ? "right" : "left",
                              }}
                            >
                              <ItemColumnHeaderMenu
                                columnKey={key}
                                label={def.label}
                                sortable={def.sortable}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                onAddFilter={handleAddColumnFilter}
                                onHideColumn={handleHideColumn}
                                isLocked={isLocked}
                                hasActiveFilter={hasActiveFilter}
                                filter={columnFilters[key] ?? null}
                                items={items}
                                onFilterChange={handleColumnFilterChange}
                              >
                                <span className="uppercase tracking-wide" style={{ fontWeight: 600 }}>{def.label}</span>
                                {sortConfig?.key === key && (
                                  <span className="text-primary ml-1">
                                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </ItemColumnHeaderMenu>
                            </TableHead>
                          );
                        })}
                        <TableHead className="w-12 px-3" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`border-b border-border/60 hover:bg-muted/30 ${density === "comfort" ? "h-16" : "h-12"}`}
                        >
                          {visibleColumns.map((key) => {
                            const def = colDef(key);
                            return (
                              <TableCell
                                key={key}
                                className="px-3"
                                style={{ textAlign: def.align === "right" ? "right" : "left" }}
                              >
                                {renderCellContent(item, key)}
                              </TableCell>
                            );
                          })}
                          <TableCell className="px-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[180px] bg-popover">
                                <DropdownMenuItem onClick={() => navigate(`/items/${item.id}`)} className="cursor-pointer">
                                  <Eye className="w-4 h-4 mr-2" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/items/${item.id}`)} className="cursor-pointer">
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {item.status === "Archived" ? (
                                  <DropdownMenuItem onClick={() => restoreItem(item.id)} className="cursor-pointer">
                                    <ArchiveRestore className="w-4 h-4 mr-2" />
                                    Restore
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedItemId(item.id); setArchiveDialogOpen(true); }}
                                    className="cursor-pointer"
                                  >
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => { setSelectedItemId(item.id); setDeleteDialogOpen(true); }}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border shrink-0">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span style={{ fontWeight: 500 }}>Rows per page:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-white hover:bg-muted/40 transition-colors cursor-pointer text-foreground" style={{ fontWeight: 500 }}>
                        {recordsPerPage}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-popover">
                      {[10, 20, 50, 100].map((n) => (
                        <DropdownMenuItem
                          key={n}
                          className="cursor-pointer"
                          onClick={() => { setRecordsPerPage(n); setCurrentPage(1); }}
                        >
                          {n}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {getPageNumbers().map((pg, i) =>
                    pg === "..." ? (
                      <span key={`ell-${i}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={pg}
                        onClick={() => setCurrentPage(pg)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-[12px] cursor-pointer transition-colors ${
                          currentPage === pg
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        {pg}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Filters Modal */}
      <ItemFiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advFilters}
        onFiltersChange={setAdvFilters}
        items={items}
        filteredCount={filteredItems.length}
      />

      {/* Column Selector */}
      <ColumnSelector
        open={columnDrawerOpen}
        onOpenChange={setColumnDrawerOpen}
        columns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        lockedColumns={LOCKED_COLUMNS}
      />

      {/* Archive Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the item to the archived state. You can restore it later from the Archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
