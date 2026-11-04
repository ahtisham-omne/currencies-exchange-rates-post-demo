import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { GripVertical, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useItems } from "../context/ItemsContext";
import type { Item } from "../context/ItemsContext";
import { CreateItemModal } from "@/app/components/modules/CreateItemModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Archive,
  Trash2,
  AlignJustify,
  List,
  LayoutGrid,
  ChevronDown,
  Check,
  User,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ItemStatusBadge,
  ColumnSelector,
  ColumnSelectorTrigger,
  ColumnHeaderMenu,
  ActiveFiltersBar,
  OverflowTooltip,
  applyColumnFilters,
  createBlankFilter,
  isFilterActive,
  KpiInsightsPanel,
  KpiIcon,
  DEFAULT_ACTIVE_KPIS,
  ALL_KPI_DEFINITIONS,
  computeKpiValue,
  FiltersModal,
  DEFAULT_FILTERS,
  countActiveFilters,
  LotPill,
  AcquisitionPills,
  InitialAvatar,
} from "../components/items-v3";
import type { AcquisitionMethod } from "../components/items-v3";
import { useItemQuickView } from "../components/items-v3";
import type {
  ColumnConfig,
  ColumnFilterState,
  SortConfig,
  AdvancedFilters,
  OverflowItem,
} from "../components/items-v3";

/* ─── 11 Item column keys (Slice 2 — restructured) ─── */
const ITEM_COLUMNS: ColumnConfig[] = [
  { key: "part_number", label: "Part Number" },
  { key: "status", label: "Status" },
  { key: "inventory_control_type", label: "Inventory Control" },
  { key: "primary_category", label: "Primary Category" },
  { key: "additional_categories", label: "Additional Categories" },
  { key: "on_hand_qty", label: "On-Hand Qty" },
  { key: "unit", label: "Stocking Unit" },
  { key: "acquisition_method", label: "Acquisition Method" },
  { key: "created_on", label: "Created On" },
  { key: "created_by", label: "Created By" },
  { key: "owner_id", label: "Owner" },
];

/* ─── Per-column widths (Slice G — Partners pattern) ─── */
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 60;
const ITEM_COLUMN_WIDTHS: Record<string, number> = {
  part_number: 280,
  status: 120,
  inventory_control_type: 200,
  primary_category: 200,
  additional_categories: 220,
  on_hand_qty: 140,
  unit: 130,
  acquisition_method: 200,
  created_on: 150,
  created_by: 200,
  owner_id: 220,
};

const COLUMN_LABELS = ITEM_COLUMNS.reduce<Record<string, string>>((acc, c) => {
  acc[c.key] = c.label;
  return acc;
}, {});

/* ─── Right-aligned numeric columns (Slice H — mirrors Partners colDef(key).align === "right" pattern, line 2216) ─── */
const RIGHT_ALIGNED_COLUMNS = new Set<string>(["on_hand_qty"]);

const QUICK_FILTERS = ["All", "Active", "Inactive"] as const;
type QuickFilter = (typeof QUICK_FILTERS)[number];

/* ─── Density (Slice B): Condensed + Comfort wired; Card View deferred to Slice 2c ─── */
type DensityOption = "condensed" | "comfort" | "card";
const DENSITY_CONFIG: {
  key: DensityOption;
  label: string;
  description: string;
  icon: "align-justify" | "list" | "layout-grid";
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

const KPI_ICON_MAP: Record<string, typeof Package> = {
  total_items: Package,
};

/* ─── Owner directory (mock) ─── */
const OWNER_DIRECTORY: Record<string, { name: string; initials: string; bg: string; fg: string }> = {
  "user-123": { name: "Ahtisham Ahmad", initials: "AA", bg: "#EDF4FF", fg: "#0A77FF" },
  "user-456": { name: "Maya Patel", initials: "MP", bg: "#FDF2F8", fg: "#BE185D" },
  "user-789": { name: "Liam Chen", initials: "LC", bg: "#ECFDF5", fg: "#047857" },
};

function resolveOwner(ownerId: string) {
  return OWNER_DIRECTORY[ownerId] ?? {
    name: ownerId,
    initials: ownerId.slice(0, 2).toUpperCase(),
    bg: "#F1F5F9",
    fg: "#475569",
  };
}

function getPrimaryAcquisitionStr(item: Item): string {
  const am = item.acquisitionMethod;
  if (typeof am === "string") return am;
  if (am && typeof am === "object" && "primary" in am) return am.primary;
  return "";
}

/* ─── Simple text cell with truncation (density-aware, mirrors Partners) ─── */
function TextCell({ value, isRelaxed }: { value: string | number | undefined; isRelaxed?: boolean }) {
  const display = value === undefined || value === null || value === "" ? "\u2013" : String(value);
  return (
    <span
      className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block`}
      style={{ fontWeight: isRelaxed ? 500 : undefined }}
      title={display}
    >
      {display}
    </span>
  );
}

/* ─── Cell: list with overflow tooltip (categories, locations) ───
 * Two literal Partners patterns:
 *   - "chip"  → first value rendered as a gray bordered chip + "+N" overflow chip
 *               (mirrors Partners vendor_sub_types line 1865/1877)
 *   - "list"  → first value as plain text + plain blue "+N more" overflow trigger
 *               (mirrors Partners item_codes line 2023)
 */
function OverflowListCell({
  values,
  category,
  emptyText = "\u2013",
  variant = "list",
  isRelaxed = false,
}: {
  values: string[];
  category: string;
  emptyText?: string;
  variant?: "chip" | "list";
  isRelaxed?: boolean;
}) {
  if (!values || values.length === 0) {
    return <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{emptyText}</span>;
  }
  const first = values[0];
  const rest = values.length - 1;
  const overflowItems: OverflowItem[] = values.map((v, i) => ({
    id: `${i}-${v}`,
    name: v,
    subtitle: "",
  }));

  if (variant === "chip") {
    return (
      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
        <span
          className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`}
          style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}
        >
          {first}
        </span>
        {rest > 0 && (
          <OverflowTooltip items={overflowItems.slice(1)} category={category}>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default"
              style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}
            >
              +{rest}
            </span>
          </OverflowTooltip>
        )}
      </div>
    );
  }

  // variant === "list"
  if (rest === 0) {
    return (
      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block`} title={first}>
        {first}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate`} title={first}>
        {first}
      </span>
      <OverflowTooltip items={overflowItems} category={category}>
        <span
          className="text-[11px] shrink-0 cursor-default leading-none"
          style={{ fontWeight: 600, color: "#085FCC" }}
        >
          +{rest} more
        </span>
      </OverflowTooltip>
    </div>
  );
}

/* ─── Cell: owner avatar + name (density-aware, mirrors Partners LogoAvatar md/lg + line 2393) ─── */
function OwnerCell({ ownerId, isRelaxed = false }: { ownerId: string; isRelaxed?: boolean }) {
  const owner = resolveOwner(ownerId);
  return (
    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
      <div
        className={`${isRelaxed ? "w-10 h-10 text-[11px]" : "w-8 h-8 text-[10px]"} rounded-full flex items-center justify-center shrink-0 border border-[#E8ECF1]`}
        style={{ backgroundColor: owner.bg, color: owner.fg, fontWeight: 700 }}
      >
        {owner.initials}
      </div>
      <span
        className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}
        style={{ fontWeight: isRelaxed ? 500 : undefined }}
        title={owner.name}
      >
        {owner.name}
      </span>
    </div>
  );
}

export default function ItemsListPageV3() {
  const navigate = useNavigate();
  const { items, archiveItem, deleteItem, addItem } = useItems();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const itemQuickView = useItemQuickView();

  /* ─── State ─── */
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("All");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([]);
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [insightsDateRange, setInsightsDateRange] = useState("last_30");

  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const [columnOrder, setColumnOrder] = useState<string[]>(ITEM_COLUMNS.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ITEM_COLUMNS.map((c) => [c.key, true]))
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  /* ─── Density (Slice B) ─── */
  const [density, setDensity] = useState<DensityOption>("condensed");

  /* ─── Selection state ─── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ─── Confirmation dialogs (single-row only; bulk removed in Slice A) ─── */
  const [singleArchiveId, setSingleArchiveId] = useState<string | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  /* ─── Derive filtered + sorted items ─── */
  const filteredItems = useMemo(() => {
    let result = items;

    // Quick filter
    if (quickFilter !== "All") {
      result = result.filter((i) => i.status === quickFilter);
    }

    // Search — Slice 2: MPN + Manufacturer dropped from search predicate
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.partNumber.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }

    // Advanced filters
    if (advancedFilters.statuses.length > 0) {
      result = result.filter((i) => advancedFilters.statuses.includes(i.status));
    }
    if (advancedFilters.inventoryControl.length > 0) {
      result = result.filter((i) =>
        advancedFilters.inventoryControl.includes(i.inventoryControlType)
      );
    }
    if (advancedFilters.primaryCategories.length > 0) {
      result = result.filter((i) =>
        advancedFilters.primaryCategories.includes(i.primaryCategory)
      );
    }
    if (advancedFilters.acquisitionMethods.length > 0) {
      result = result.filter((i) =>
        advancedFilters.acquisitionMethods.includes(getPrimaryAcquisitionStr(i))
      );
    }
    if (advancedFilters.units.length > 0) {
      result = result.filter((i) => advancedFilters.units.includes(i.unit));
    }
    if (advancedFilters.locations.trim()) {
      const q = advancedFilters.locations.toLowerCase();
      result = result.filter(
        (i) =>
          (i.inboundLocations || []).some((l) => l.toLowerCase().includes(q)) ||
          (i.outboundLocations || []).some((l) => l.toLowerCase().includes(q))
      );
    }
    if (advancedFilters.onHandMin !== "") {
      const min = Number(advancedFilters.onHandMin);
      result = result.filter((i) => i.onHandQty >= min);
    }
    if (advancedFilters.onHandMax !== "") {
      const max = Number(advancedFilters.onHandMax);
      result = result.filter((i) => i.onHandQty <= max);
    }

    // Column filters
    result = applyColumnFilters(result, columnFilters);

    // Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        switch (sortConfig.key) {
          case "part_number": av = a.partNumber; bv = b.partNumber; break;
          case "status": av = a.status; bv = b.status; break;
          case "on_hand_qty": av = a.onHandQty; bv = b.onHandQty; break;
          case "primary_category": av = a.primaryCategory; bv = b.primaryCategory; break;
          case "unit": av = a.unit ?? ""; bv = b.unit ?? ""; break;
          case "inventory_control_type": av = a.inventoryControlType ?? ""; bv = b.inventoryControlType ?? ""; break;
          case "acquisition_method": av = a.primaryAcquisition ?? ""; bv = b.primaryAcquisition ?? ""; break;
          case "owner_id": av = resolveOwner(a.ownerId).name; bv = resolveOwner(b.ownerId).name; break;
          case "created_by": av = a.createdBy ?? ""; bv = b.createdBy ?? ""; break;
          case "additional_categories":
            av = (a.additionalCategories || []).length;
            bv = (b.additionalCategories || []).length;
            break;
          case "created_on":
            av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          default: return 0;
        }
        if (typeof av === "number" && typeof bv === "number") {
          return sortConfig.direction === "asc" ? av - bv : bv - av;
        }
        return sortConfig.direction === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    return result;
  }, [items, quickFilter, searchQuery, advancedFilters, columnFilters, sortConfig]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pagedItems = filteredItems.slice(startIdx, startIdx + pageSize);

  /* ─── KPI computation — Partners parity (VendorsListPage lines 497–511) ─── */
  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setActiveKpis((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleToggleKpi = useCallback((key: string) => {
    setActiveKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  /** Resolved active KPI definitions in order — preserves drag-reorder, no cap */
  const activeKpiDefs = useMemo(() => {
    return activeKpis
      .map((key) => ALL_KPI_DEFINITIONS.find((d) => d.key === key))
      .filter(Boolean) as typeof ALL_KPI_DEFINITIONS;
  }, [activeKpis]);

  /* ─── Handlers ─── */
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev.some((f) => f.columnKey === columnKey)) return prev;
      return [...prev, createBlankFilter(columnKey)];
    });
    setAutoOpenFilterKey(columnKey);
  }, []);

  const handleColumnFilterChange = useCallback(
    (columnKey: string, filter: ColumnFilterState) => {
      setColumnFilters((prev) =>
        prev.map((f) => (f.columnKey === columnKey ? filter : f))
      );
    },
    []
  );

  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev.filter((f) => f.columnKey !== columnKey));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setColumnFilters([]);
  }, []);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
  }, []);

  const handleRowClick = (e: React.MouseEvent, item: Item) => {
    // Ignore clicks coming from interactive cells (checkbox / action menu)
    const target = e.target as HTMLElement;
    if (target.closest("[data-row-action]")) return;
    // TODO: integrate QuickViewPanel in Slice 2.5
    navigate(`/items/${item.id}`);
  };

  /* ─── Selection helpers ─── */
  const pageIds = pagedItems.map((i) => i.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allOnPageSelected;
  const selectedCount = selectedIds.size;

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [pageIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleConfirmSingleArchive = () => {
    if (singleArchiveId) {
      archiveItem(singleArchiveId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleArchiveId);
        return next;
      });
    }
    setSingleArchiveId(null);
  };

  const handleConfirmSingleDelete = () => {
    if (singleDeleteId) {
      deleteItem(singleDeleteId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleDeleteId);
        return next;
      });
    }
    setSingleDeleteId(null);
  };

  // Bulk archive/delete handlers removed in Slice A — single-row dialogs only.

  const visibleColumns = columnOrder
    .filter((key) => columnVisibility[key])
    .map((key) => ITEM_COLUMNS.find((c) => c.key === key)!)
    .filter(Boolean);

  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
  const advFilterCount = countActiveFilters(advancedFilters);

  /* ─── Density-aware flag — mirrors Partners line 1829 ─── */
  const isRelaxed = density === "comfort";

  /* ─── Cell renderer ─── */
  const renderCell = (item: Item, columnKey: string) => {
    switch (columnKey) {
      case "part_number": {
        const img = item.images?.[0];
        // Deterministic color palette for fallback (mirrors Partners LogoAvatar bg/initials pattern at lines 3049-3069).
        const FALLBACK_PALETTE = [
          "#DBEAFE", "#FEE2E2", "#DCFCE7", "#FEF3C7",
          "#EDE9FE", "#FCE7F3", "#CFFAFE", "#FFEDD5",
        ];
        let hash = 0;
        for (let i = 0; i < item.partNumber.length; i++) {
          hash = item.partNumber.charCodeAt(i) + ((hash << 5) - hash);
        }
        const fallbackBg = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
        const initials = item.partNumber.slice(0, 2).toUpperCase();
        return (
          <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"} min-w-0`}>
            <div
              data-row-action
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                itemQuickView.open(item);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  itemQuickView.open(item);
                }
              }}
              className={`${isRelaxed ? "w-9 h-9" : "w-7 h-7"} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] hover:border-slate-300 transition-colors`}
              style={{ backgroundColor: img ? "#FFFFFF" : fallbackBg, cursor: "pointer" }}
              aria-label={`Quick view ${item.partNumber}`}
            >
              {img ? (
                <img src={img} alt="" className="w-full h-full object-contain p-1" />
              ) : (
                <span className={`${isRelaxed ? "text-[11px]" : "text-[10px]"} text-[#334155]`} style={{ fontWeight: 700 }}>
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`}
                style={{ fontWeight: 500, color: "#1E293B" }}
              >
                {item.partNumber}
              </span>
              {isRelaxed && item.description && (
                <span className="text-xs text-muted-foreground/60 truncate block">
                  {item.description}
                </span>
              )}
            </div>
          </div>
        );
      }
      case "status":
        return <ItemStatusBadge status={item.status as any} />;
      case "inventory_control_type":
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate`}
              style={{ fontWeight: isRelaxed ? 500 : undefined }}
              title={item.inventoryControlType}
            >
              {item.inventoryControlType || "\u2013"}
            </span>
            {item.lotControl && <LotPill />}
          </div>
        );
      case "primary_category":
        return <TextCell value={item.primaryCategory} isRelaxed={isRelaxed} />;
      case "additional_categories":
        return (
          <OverflowListCell
            values={item.additionalCategories || []}
            category="Categories"
            variant="chip"
            isRelaxed={isRelaxed}
          />
        );
      case "on_hand_qty":
        return (
          <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} tabular-nums`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>
            {item.onHandQty.toLocaleString()}
            <span className="text-muted-foreground/60 ml-1">{item.unit}</span>
          </span>
        );
      case "unit":
        return <TextCell value={item.unit} isRelaxed={isRelaxed} />;
      case "acquisition_method":
        return (
          <AcquisitionPills
            methods={(item.acquisitionMethods ?? []) as AcquisitionMethod[]}
            primary={(item.primaryAcquisition ?? null) as AcquisitionMethod | null}
          />
        );
      case "created_by": {
        const name = item.createdBy ?? "System";
        if (name === "System") {
          return (
            <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
              <div
                className={`${isRelaxed ? "w-9 h-9" : "w-8 h-8"} rounded-lg flex items-center justify-center shrink-0 border border-[#E2E8F0]`}
                style={{ backgroundColor: "#F1F5F9", color: "#64748B", fontSize: isRelaxed ? 10 : 9, fontWeight: 700 }}
                title="System"
              >
                SYS
              </div>
              <span
                className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground truncate`}
                style={{ fontWeight: isRelaxed ? 500 : undefined }}
              >
                System
              </span>
            </div>
          );
        }
        return (
          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
            <InitialAvatar name={name} size={isRelaxed ? "md" : "sm"} />
            <span
              className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}
              style={{ fontWeight: isRelaxed ? 500 : undefined }}
              title={name}
            >
              {name}
            </span>
          </div>
        );
      }
      case "owner_id":
        return <OwnerCell ownerId={item.ownerId} isRelaxed={isRelaxed} />;
      case "created_on": {
        /* Mirrors Partners line 2402-2408 literal pattern: title + comfort-only "Xmo ago" secondary line */
        const dateStr = item.createdAt
          ? new Date(item.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "\u2013";
        return (
          <div>
            <span
              className={isRelaxed ? "text-[13.5px]" : "text-sm"}
              style={{ fontWeight: isRelaxed ? 500 : undefined }}
            >
              {dateStr}
            </span>
            {isRelaxed && item.createdAt && (
              <span className="text-[10px] text-muted-foreground/50 block">
                {(() => {
                  const d = Math.floor(
                    (Date.now() - new Date(item.createdAt).getTime()) / 86400000,
                  );
                  return d < 30
                    ? `${d}d ago`
                    : d < 365
                      ? `${Math.floor(d / 30)}mo ago`
                      : `${Math.floor(d / 365)}y ago`;
                })()}
              </span>
            )}
          </div>
        );
      }
      default:
        return <TextCell value="" isRelaxed={isRelaxed} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar — Partners pattern: breadcrumb left, search + avatar right (no Plus) */}
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
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Items
          </span>
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
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#EDF4FF" }}
            >
              <span className="text-[11px]" style={{ fontWeight: 600, color: "#0A77FF" }}>
                AA
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px]" style={{ fontWeight: 500 }}>
                Ahtisham Ahmad
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Senior Product Designer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content — Partners literal (VendorsListPage line 1178) */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col">
          {/* Page Header — full-bleed white bar with bottom border (Partners pattern) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <Package className="w-4 h-4" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Items</h1>
                <p className="text-xs text-muted-foreground">
                  Centralized master data for all items, SKUs, and variants.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-primary text-primary-foreground shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Item
            </Button>
          </div>

          {/* Performance Insights — Partners parity (VendorsListPage lines 1204–1307) */}
          {showInsights && activeKpiDefs.length > 0 && (
          <div className="mb-4 shrink-0">
            {/* Header row: label + date range dropdown // Add Insights link */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                  Performance Insights
                </span>
                {/* Date Range Filter — literal Partners */}
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
                        {insightsDateRange === opt.key && (
                          <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={() => setInsightsOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "#0A77FF" }}
              >
                <Plus className="w-3 h-3" />
                Add Insights
              </button>
            </div>

            {/* KPI Cards — draggable responsive grid (Partners parity) */}
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {activeKpiDefs.map((kpi, idx) => (
                  <DraggableListKpiCard
                    key={kpi.key}
                    index={idx}
                    kpiKey={kpi.key}
                    label={kpi.label}
                    value={computeKpiValue(kpi.key, items)}
                    iconName={kpi.iconName}
                    tooltip={kpi.tooltip}
                    moveCard={moveKpi}
                    onRemove={() => handleToggleKpi(kpi.key)}
                  />
                ))}
              </div>
            </DndProvider>
          </div>
          )}

          {/* Unified Card — Partners literal (VendorsListPage lines 1321-1322): two-layer wrapper hosting content + ColumnSelector as siblings */}
          <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip">
            <div className="flex-1 min-w-0 flex flex-col overflow-clip">
            {/* Row 1: Search + Filters | Insights toggle + Columns */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    placeholder="Search items by part number, description, MPN..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="pl-9 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersModalOpen(true)}
                  className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                    advFilterCount > 0
                      ? "text-primary border-primary/30"
                      : "text-foreground border-border/80"
                  }`}
                >
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${advFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                  {advFilterCount > 0 && (
                    <span
                      className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                      style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                    >
                      {advFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Count + Insights + Density + Columns — Partners pattern */}
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
                    if (!showInsights) {
                      setShowInsights(true);
                    }
                    setInsightsOpen(true);
                  }}
                  className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    insightsOpen
                      ? "border-primary/30 bg-primary/[0.04] text-foreground"
                      : "border-border bg-white text-foreground hover:bg-muted/40"
                  }`}
                >
                  <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                    Insights
                  </span>
                  {activeKpis.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                      style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}
                    >
                      {activeKpis.length}
                    </span>
                  )}
                </button>

                {/* Density dropdown — Card View deferred to Slice 2c (option disabled here) */}
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
                        {DENSITY_CONFIG.find(d => d.key === density)?.label}
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
                        {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
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

            {/* Row 2: Quick filter pills — Partners pattern with Me mode + separator */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
              {/* Me mode pill (visual parity with Partners; no per-user filter dimension yet for Items) */}
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors whitespace-nowrap shrink-0 cursor-pointer">
                <User className="w-3.5 h-3.5" />
                Me mode
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-border shrink-0" />

              {QUICK_FILTERS.map((qf) => {
                const isActive = quickFilter === qf;
                const count =
                  qf === "All"
                    ? items.length
                    : items.filter((i) => i.status === qf).length;
                const showCount = qf !== "All";
                return (
                  <button
                    key={qf}
                    onClick={() => { setQuickFilter(qf); setPage(1); }}
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
                    {qf}
                    {showCount && (
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                          isActive
                            ? "bg-primary/10"
                            : "bg-muted"
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

            {/* Active column filters bar */}
            <ActiveFiltersBar
              columnFilters={columnFilters}
              columnLabels={COLUMN_LABELS}
              items={items}
              onFilterChange={handleColumnFilterChange}
              onRemoveFilter={handleRemoveColumnFilter}
              onAddFilter={handleAddColumnFilter}
              onClearAll={handleClearAllFilters}
              autoOpenKey={autoOpenFilterKey}
              onAutoOpened={() => setAutoOpenFilterKey(null)}
              availableColumns={visibleColumns}
            />

            {/* Table body / pagination — share unified card border. Inner flex makes the table scroll while pagination pins to the card bottom. */}
            <div className="border-t border-border/60 flex-1 min-h-0 flex flex-col">

            {pagedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1 min-h-0">
                <Boxes className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm" style={{ fontWeight: 500 }}>
                  No items found
                </p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  Try adjusting your filters or search query.
                </p>
              </div>
            ) : (
              <div className="min-h-0 overflow-auto flex-1">
                <Table
                  style={{
                    tableLayout: "fixed",
                    width: `max(${
                      visibleColumns.reduce((sum, c) => sum + (ITEM_COLUMN_WIDTHS[c.key] ?? 180), 0) +
                      ACTIONS_COL_WIDTH
                    }px, 100%)`,
                  }}
                >
                  <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableRow
                      className={`bg-muted/30 hover:bg-muted/30 ${
                        density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                      }`}
                    >
                      {visibleColumns.map((col) => {
                        const filter = columnFilters.find((f) => f.columnKey === col.key);
                        const hasFilter = filter ? isFilterActive(filter) : false;
                        const currentColSort: "asc" | "desc" | null =
                          sortConfig?.key === col.key ? sortConfig.direction : null;
                        const width = ITEM_COLUMN_WIDTHS[col.key] ?? 180;
                        return (
                          <TableHead
                            key={col.key}
                            className={`whitespace-nowrap relative group/colheader ${hasFilter ? "bg-primary/[0.03]" : ""} ${RIGHT_ALIGNED_COLUMNS.has(col.key) ? "text-right" : ""}`}
                            style={{
                              width: `${width}px`,
                              minWidth: `${width}px`,
                              maxWidth: `${width}px`,
                              overflow: "hidden",
                            }}
                          >
                            <div className={`flex items-center ${RIGHT_ALIGNED_COLUMNS.has(col.key) ? "justify-end" : ""}`}>
                              <ColumnHeaderMenu
                                columnKey={col.key}
                                label={col.label}
                                sortable
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                onAddFilter={handleAddColumnFilter}
                                onHideColumn={handleHideColumn}
                                hasActiveFilter={hasFilter}
                                filter={filter ?? null}
                                items={items}
                                onFilterChange={handleColumnFilterChange}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[13px]" style={currentColSort || hasFilter ? { color: "#0A77FF" } : undefined}>{col.label}</span>
                                  {hasFilter && !currentColSort && (
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#0A77FF" }} />
                                  )}
                                  {currentColSort === "asc" && (
                                    <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                  )}
                                  {currentColSort === "desc" && (
                                    <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                  )}
                                  {!currentColSort && !hasFilter && (
                                    <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              </ColumnHeaderMenu>
                            </div>
                          </TableHead>
                        );
                      })}
                      {/* Actions column — sticky rightmost */}
                      <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                        <span className="text-[13px]">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      // Slice I: density padding applied directly to each <TableCell> via className
                      // (not [&>td]: parent selector) because tailwind-merge can't resolve cross-element
                      // conflicts against shadcn TableCell's base `p-4`. Partners uses the parent-selector
                      // pattern but their build's utility-cascade order happens to let py-1 win; ours
                      // doesn't, producing 48px rows instead of ~32px. Direct className lets cn() merge.
                      const cellPadY = density === "condensed" ? "py-1" : density === "comfort" ? "py-2" : "";
                      const cellPad = density === "condensed"
                        ? "py-1 pl-4 pr-2"
                        : density === "comfort"
                        ? "py-2 pl-4 pr-2"
                        : "";
                      return (
                        <TableRow
                          key={item.id}
                          onClick={(e) => handleRowClick(e, item)}
                          className={cn(
                            "cursor-pointer group hover:bg-[#F0F7FF]",
                            isSelected && "bg-[#EDF4FF]/60 hover:bg-[#EDF4FF]"
                          )}
                        >
                          {visibleColumns.map((col) => {
                            const width = ITEM_COLUMN_WIDTHS[col.key] ?? 180;
                            const isRightAligned = RIGHT_ALIGNED_COLUMNS.has(col.key);
                            return (
                              <TableCell
                                key={col.key}
                                className={cn(cellPad, isRightAligned && "text-right tabular-nums")}
                                style={{
                                  width: `${width}px`,
                                  minWidth: `${width}px`,
                                  maxWidth: `${width}px`,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {renderCell(item, col.key)}
                              </TableCell>
                            );
                          })}
                          {/* Actions — always last, always sticky. Vertical padding via cellPadY; horizontal !pl-2 !pr-2 preserved. */}
                          <TableCell className={cn("sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2", cellPadY)} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <div data-row-action className="flex items-center justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                    aria-label="Row actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px] bg-popover">
                                  <DropdownMenuItem
                                    onClick={() => navigate(`/items/${item.id}`)}
                                    className="cursor-pointer"
                                  >
                                    Open
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setSingleArchiveId(item.id)}
                                    className="cursor-pointer"
                                  >
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setSingleDeleteId(item.id)}
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {filteredItems.length > 0 && (() => {
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
              return (
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(val) => {
                        setPageSize(Number(val));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-sm text-muted-foreground"
                      disabled={currentPage === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>

                    {getPageNumbers().map((pg, idx) =>
                      pg === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={pg}
                          variant={currentPage === pg ? "default" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 text-sm ${
                            currentPage === pg
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => setPage(pg as number)}
                        >
                          {pg}
                        </Button>
                      )
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-sm text-muted-foreground"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
          </div>{/* /inner card (Partners VendorsListPage line 1322 close) */}
            {/* Column Selector Side Drawer — sibling of inner card, inside outer card (Partners literal line 2675-2685) */}
            <ColumnSelector
              columns={ITEM_COLUMNS}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onColumnOrderChange={setColumnOrder}
              onColumnVisibilityChange={setColumnVisibility}
              lockedColumns={["part_number"]}
              open={columnsOpen}
              onOpenChange={setColumnsOpen}
            />
          </div>{/* /outer card (Partners VendorsListPage line 1321 close) */}
        </div>{/* /padded shell */}
      </div>{/* /content wrapper */}

      {/* Overlay drawers (portal-style, fixed position) */}
      <FiltersModal
        open={filtersModalOpen}
        onOpenChange={setFiltersModalOpen}
        filters={advancedFilters}
        onFiltersChange={setAdvancedFilters}
        items={items}
        filteredCount={filteredItems.length}
      />

      <KpiInsightsPanel
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        activeKpis={activeKpis}
        onToggleKpi={(key) =>
          setActiveKpis((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
          )
        }
        items={items}
      />

      {/* Single Archive Dialog */}
      <AlertDialog
        open={singleArchiveId !== null}
        onOpenChange={(open) => { if (!open) setSingleArchiveId(null); }}
      >
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the item to the Archived state. You can restore it later from the Archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSingleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Dialog */}
      <AlertDialog
        open={singleDeleteId !== null}
        onOpenChange={(open) => { if (!open) setSingleDeleteId(null); }}
      >
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSingleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk dialogs removed in Slice A — per-row 3-dot menu handles archive/delete */}

      {/* Create Item Modal — Slice M.1 wiring */}
      <CreateItemModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={(newItem?: Partial<Item> & { partNumber?: string; description?: string }) => {
          if (newItem && newItem.partNumber && newItem.description) {
            addItem(newItem as Partial<Item> & { partNumber: string; description: string });
          }
          setCreateModalOpen(false);
        }}
      />

      {/* Item Quick View Modal — opens from the row thumbnail (and tooltip rows) */}
      {itemQuickView.modal}
    </div>
  );
}

/* ── Draggable KPI Card for items listing page — literal Partners parity (VendorsListPage lines 3118–3229) ── */
const DND_LIST_KPI = "ITEMS_LIST_KPI";

function DraggableListKpiCard({
  index,
  kpiKey: _kpiKey,
  label,
  value,
  iconName,
  tooltip: _tooltip,
  moveCard,
  onRemove,
}: {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  iconName?: string;
  tooltip?: string;
  moveCard: (from: number, to: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_LIST_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_LIST_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  /* Dragging ghost — dashed placeholder */
  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-lg border border-dashed border-[#0A77FF]/20 bg-[#0A77FF]/[0.02] min-h-[52px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-[#0A77FF]/30 bg-[#0A77FF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {/* Drop zone overlay */}
      {isOver && (
        <div className="absolute inset-0 rounded-lg bg-[#0A77FF]/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2">
        {/* Drag handle — top-right pill */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-[#F1F5F9] rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        {/* Label row */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p
              className="whitespace-nowrap"
              style={{ fontSize: "10.5px", fontWeight: 500, lineHeight: "14px", color: "#64748B" }}
            >
              {label}
            </p>
          </div>
          {iconName && <KpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
        </div>
        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <p
            className="tracking-tight whitespace-nowrap"
            style={{ fontSize: "15px", fontWeight: 600, lineHeight: "18px", color: "#334155" }}
          >
            {value}
          </p>
        </div>
      </div>
      {/* Remove button — bottom-right on hover */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  );
}
