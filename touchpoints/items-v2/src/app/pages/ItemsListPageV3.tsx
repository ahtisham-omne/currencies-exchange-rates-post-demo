import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { GripVertical, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useItems } from "../context/ItemsContext";
import type { Item } from "../context/ItemsContext";
import { CreateItemModal } from "@/app/components/modules/CreateItemModal";
import { ItemLifecycleModal, type ItemLifecycleAction } from "@/app/components/modules/ItemLifecycleModal";
import { ActionsMenu } from "@/app/import-export/ActionsMenu";
import { ExportModal, type ExportContext } from "@/app/import-export/ExportModal";
import { ImportWizardModal } from "@/app/import-export/ImportWizardModal";
import { ImportNoticeBanner } from "@/app/import-export/ImportNoticeBanner";
import { buildValidationContext } from "@/app/import-export/validation";
/* Catalog codes (C-1001..) pass through, free-form names are hashed: same as the Export file. */
import { categoryDisplayCode as categoryCell } from "@/app/import-export/export";
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
  ArchiveRestore,
  CircleCheck,
  CircleSlash,
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
  Download,
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
  AcquisitionMethodsList,
  PreferredAcquisition,
  UserCell,
} from "../components/items-v3";
import { UserDetailModal } from "../components/items-v3";
import type { AcquisitionMethod } from "../components/items-v3";
import { useItemQuickView } from "../components/items-v3";
import type {
  ColumnConfig,
  ColumnFilterState,
  SortConfig,
  AdvancedFilters,
  OverflowItem,
} from "../components/items-v3";
import { NotificationBell } from "../components/notifications/NotificationBell";

/* ─── 11 Item column keys (Slice 2 — restructured) ─── */
const ITEM_COLUMNS: ColumnConfig[] = [
  { key: "part_number", label: "Part Number" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "inventory_control_type", label: "Inventory Control" },
  { key: "primary_category", label: "Primary Category" },
  { key: "additional_categories", label: "Additional Categories" },
  { key: "tags", label: "Tags" },
  { key: "on_hand_qty", label: "On-Hand Qty" },
  { key: "unit", label: "Stocking Unit" },
  { key: "acquisition", label: "Acquisition" },
  { key: "preferred_acquisition", label: "Preferred Acquisition" },
  { key: "created_on", label: "Created On" },
  { key: "created_by", label: "Created By" },
  { key: "owner_id", label: "Owner" },
];

/* ─── Per-column widths (Slice G — Partners pattern) ─── */
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 60;
const ITEM_COLUMN_WIDTHS: Record<string, number> = {
  part_number: 280,
  description: 320,
  status: 120,
  inventory_control_type: 200,
  primary_category: 200,
  additional_categories: 220,
  tags: 280,
  on_hand_qty: 140,
  unit: 130,
  acquisition: 220,
  preferred_acquisition: 200,
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

/* ─── Locked columns — cannot be reordered (Partners parity: VendorsListPage line 196) ─── */
const LOCKED_COLUMNS: string[] = ["part_number"];

/* ─── Resize floor (Partners parity) ─── */
const MIN_COL_W = 80;

const QUICK_FILTERS = ["All", "Active", "Inactive", "Archived"] as const;
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
  const display = value === undefined || value === null || value === "" ? "\u2014" : String(value);
  return (
    <span
      className={`text-sm truncate block`}
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
  emptyText = "\u2014",
  variant = "list",
  isRelaxed = false,
  maxVisible = 1,
  popoverVariant = "rows",
}: {
  values: string[];
  category: string;
  emptyText?: string;
  variant?: "chip" | "list";
  isRelaxed?: boolean;
  /** How many chips to show before collapsing the rest into a "+N" (chip variant only). */
  maxVisible?: number;
  /** Hover-popover style for the "+N" overflow: rich rows (default) or pill chips. */
  popoverVariant?: "rows" | "pills";
}) {
  if (!values || values.length === 0) {
    return <span className={`text-sm text-muted-foreground`}>{emptyText}</span>;
  }
  const first = values[0];
  const rest = values.length - 1;
  const overflowItems: OverflowItem[] = values.map((v, i) => ({
    id: `${i}-${v}`,
    name: v,
    subtitle: "",
  }));

  if (variant === "chip") {
    const shown = values.slice(0, Math.max(1, maxVisible));
    const overflow = values.length - shown.length;
    return (
      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
        {shown.map((v, i) => (
          <span
            key={`${i}-${v}`}
            className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border whitespace-nowrap`}
            style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}
          >
            {v}
          </span>
        ))}
        {overflow > 0 && (
          <OverflowTooltip items={overflowItems.slice(shown.length)} category={category} variant={popoverVariant}>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default whitespace-nowrap"
              style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}
            >
              +{overflow}
            </span>
          </OverflowTooltip>
        )}
      </div>
    );
  }

  // variant === "list"
  if (rest === 0) {
    return (
      <span className={`text-sm truncate block`} title={first}>
        {first}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`text-sm truncate`} title={first}>
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
function OwnerCell({
  ownerId,
  isRelaxed = false,
  onUserClick,
}: {
  ownerId: string;
  isRelaxed?: boolean;
  onUserClick?: (name: string) => void;
}) {
  const owner = resolveOwner(ownerId);
  return (
    <UserCell
      name={owner.name}
      subtitle="Owner"
      size={isRelaxed ? "md" : "sm"}
      onClick={onUserClick}
    />
  );
}

export default function ItemsListPageV3() {
  const navigate = useNavigate();
  const { items, archiveItem, deleteItem, restoreItem, addItem, updateItem } = useItems();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  /* Import / Export (Actions menu, bulk bar "Export") */
  const [importOpen, setImportOpen] = useState(false);
  const [exportContext, setExportContext] = useState<ExportContext | null>(null);
  const [exportRows, setExportRows] = useState<Item[]>([]);
  const itemQuickView = useItemQuickView();
  /* User detail modal — opened by clicking a user avatar / name in any cell. */
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

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

  /* ─── Column drag-reorder state (Partners parity: VendorsListPage 528–638) ─── */
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60;

    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX;
      const dy = moveEvt.clientY - colDragRef.current.startY;

      if (!colDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        colDragRef.current.isDragging = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDraggingColumnKey(colDragRef.current.columnKey);
      }

      const ghost = ghostElRef.current;
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key");
        if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;
        // Keep frozen columns contiguous: never reorder across the frozen/non-frozen
        // boundary, so a non-frozen column can't be dropped between frozen ones.
        if (frozenColumnsRef.current.has(draggedKey) !== frozenColumnsRef.current.has(k)) break;

        setColumnOrder((prev) => {
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        });
        colDragRef.current.lastSwapTime = now;
        break;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      if (colDragRef.current?.isDragging) {
        suppressNextClickRef.current = true;
        requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      }

      colDragRef.current = null;
      setDraggingColumnKey(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  /* ─── Column resize state + handler (Partners parity) ─── */
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  const getColWidth = useCallback(
    (key: string) => columnWidths[key] ?? ITEM_COLUMN_WIDTHS[key] ?? 180,
    [columnWidths]
  );

  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = getColWidth(columnKey);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const onMove = (moveEvt: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = moveEvt.clientX - resizeRef.current.startX;
      const next = Math.max(MIN_COL_W, resizeRef.current.startWidth + dx);
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: next }));
    };
    const onUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [getColWidth]);

  /* ─── Frozen columns (Partners parity) — Part Number is always frozen ─── */
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["part_number"]));
  // Mirror for synchronous reads inside the (stable-closure) drag handler.
  const frozenColumnsRef = useRef(frozenColumns);
  frozenColumnsRef.current = frozenColumns;

  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      // Locked columns (e.g. part_number) stay frozen — they can't be unfrozen (Partners parity).
      if (next.has(columnKey) && !LOCKED_COLUMNS.includes(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  // Frozen columns are always a contiguous block pinned to the LEFT. Whenever the
  // frozen set changes (freeze / unfreeze / hide), re-partition the column order so a
  // newly-frozen column jumps next to the other frozen columns and no non-frozen
  // column can sit between them. Order within each partition is preserved (stable).
  useEffect(() => {
    setColumnOrder((order) => {
      const frozen = order.filter((k) => frozenColumns.has(k));
      const rest = order.filter((k) => !frozenColumns.has(k));
      const next = [...frozen, ...rest];
      return next.length === order.length && next.every((k, i) => k === order[i]) ? order : next;
    });
  }, [frozenColumns]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  /* ─── Density (Slice B) ─── */
  const [density, setDensity] = useState<DensityOption>("condensed");

  /* ─── Selection state ─── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ─── Confirmation dialogs (single-row only; bulk removed in Slice A) ─── */
  const [singleArchiveId, setSingleArchiveId] = useState<string | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  /* ─── Lifecycle modal (mirrors detail page Actions dropdown) ─── */
  const [lifecycleItemId, setLifecycleItemId] = useState<string | null>(null);
  const [pendingLifecycle, setPendingLifecycle] = useState<ItemLifecycleAction>(null);
  const lifecycleItem = lifecycleItemId ? items.find((i) => i.id === lifecycleItemId) : undefined;
  const openLifecycle = (id: string, action: Exclude<ItemLifecycleAction, null>) => {
    setLifecycleItemId(id);
    setPendingLifecycle(action);
  };
  const confirmLifecycle = (next: "active" | "inactive" | "archived") => {
    if (!lifecycleItemId) return;
    const label = next === "active" ? "Active" : next === "inactive" ? "Inactive" : "Archived";
    updateItem(lifecycleItemId, { status: label });
    const verb = next === "active" ? "marked as Active" : next === "inactive" ? "marked as Inactive" : "archived";
    toast.success(`${lifecycleItem?.partNumber ?? "Item"} ${verb}.`);
    setPendingLifecycle(null);
    setLifecycleItemId(null);
  };

  /* ─── Bulk-action confirmation (Partners parity) ─── */
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  /* ─── Newly created row flash (Partners parity: VendorsListPage line 1586) ─── */
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

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
          case "acquisition": {
            av = (a.acquisitionMethods ?? []).join(",");
            bv = (b.acquisitionMethods ?? []).join(",");
            break;
          }
          case "preferred_acquisition": av = a.primaryAcquisition ?? ""; bv = b.primaryAcquisition ?? ""; break;
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

  // Whole-listing filter state — drives the empty-state "Clear all filters" link
  // (partner-listing parity). Resets every filter dimension + search + page.
  const hasAnyFilter =
    quickFilter !== "All" ||
    searchQuery.trim() !== "" ||
    columnFilters.length > 0 ||
    JSON.stringify(advancedFilters) !== JSON.stringify(DEFAULT_FILTERS);

  const clearAllFilters = useCallback(() => {
    setQuickFilter("All");
    setSearchQuery("");
    setAdvancedFilters(DEFAULT_FILTERS);
    setColumnFilters([]);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    // Hiding a frozen column also unfreezes it, so it doesn't return frozen on re-show (Partners parity).
    setFrozenColumns((prev) => {
      if (!prev.has(columnKey)) return prev;
      const next = new Set(prev);
      next.delete(columnKey);
      return next;
    });
  }, []);

  const handleRowClick = (e: React.MouseEvent, item: Item) => {
    // Ignore clicks coming from interactive cells (checkbox / action menu)
    const target = e.target as HTMLElement;
    if (target.closest("[data-row-action]")) return;
    // Row click navigates to the item detail page.
    // Quick view remains accessible via the item image cell.
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
      const item = items.find((i) => i.id === singleArchiveId);
      archiveItem(singleArchiveId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleArchiveId);
        return next;
      });
      toast.success(`Archived ${item?.partNumber ?? "item"}`, {
        description: "Move it back any time from the Archived filter.",
        action: { label: "Undo", onClick: () => restoreItem(singleArchiveId) },
      });
    }
    setSingleArchiveId(null);
  };

  const handleConfirmSingleDelete = () => {
    if (singleDeleteId) {
      const item = items.find((i) => i.id === singleDeleteId);
      deleteItem(singleDeleteId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleDeleteId);
        return next;
      });
      toast.success(`Deleted ${item?.partNumber ?? "item"}`);
    }
    setSingleDeleteId(null);
  };

  /* ─── Bulk archive/delete (restored — Partners parity) ─── */
  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => archiveItem(id));
    setSelectedIds(new Set());
    setBulkArchiveOpen(false);
    toast.success(`Archived ${ids.length} item${ids.length === 1 ? "" : "s"}`);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => deleteItem(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast.success(`Deleted ${ids.length} item${ids.length === 1 ? "" : "s"}`);
  };

  const handleRowRestore = (id: string) => {
    const item = items.find((i) => i.id === id);
    restoreItem(id);
    toast.success(`Restored ${item?.partNumber ?? "item"}`);
  };

  /* Snapshot of existing part numbers + catalogs for the import validator (rebuilt when items change). */
  const importValidationContext = useMemo(() => buildValidationContext(items), [items]);

  const visibleColumns = columnOrder
    .filter((key) => columnVisibility[key])
    .map((key) => ITEM_COLUMNS.find((c) => c.key === key)!)
    .filter(Boolean);

  /* ─── Frozen-column left offsets (Partners parity) ─── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = 0;
    for (const col of visibleColumns) {
      if (frozenColumns.has(col.key)) {
        offsets[col.key] = cumLeft;
        cumLeft += getColWidth(col.key);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, getColWidth]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const col of visibleColumns) if (frozenColumns.has(col.key)) last = col.key;
    return last;
  }, [visibleColumns, frozenColumns]);

  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
  const advFilterCount = countActiveFilters(advancedFilters);

  // Hide the Quick/Preset filter row once "real" filters are applied (Filters
  // Modal or column-header filters). Selecting a status preset / search box does
  // not count. Clearing those filters restores the preset row automatically.
  const hasAppliedFilters = advFilterCount > 0 || columnFilters.length > 0;

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
              className={`${isRelaxed ? "w-10 h-10" : "w-8 h-8"} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] transition hover:border-[#0A77FF] hover:ring-2 hover:ring-[#0A77FF]/30 focus-visible:outline-none focus-visible:border-[#0A77FF] focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30`}
              style={{ backgroundColor: img ? "#FFFFFF" : fallbackBg, cursor: "pointer" }}
              aria-label={`Quick view ${item.partNumber}`}
            >
              {img ? (
                <img src={img} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className={`${isRelaxed ? "text-[11px]" : "text-[10px]"} text-slate-700`} style={{ fontWeight: 700 }}>
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={`text-sm block truncate`}
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
      case "description":
        return <TextCell value={item.description || "\u2014"} isRelaxed={isRelaxed} />;
      case "inventory_control_type":
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-sm truncate`}
              style={{ fontWeight: isRelaxed ? 500 : undefined }}
              title={item.inventoryControlType}
            >
              {item.inventoryControlType || "\u2014"}
            </span>
            {item.lotControl && <LotPill />}
          </div>
        );
      case "primary_category":
        return <TextCell value={item.primaryCategory ? categoryCell(item.primaryCategory) : ""} isRelaxed={isRelaxed} />;
      case "additional_categories":
        return (
          <OverflowListCell
            values={(item.additionalCategories || []).map(categoryCell)}
            category="Categories"
            variant="chip"
            isRelaxed={isRelaxed}
          />
        );
      case "tags":
        return (
          <OverflowListCell
            values={item.tags || []}
            category="Tags"
            variant="chip"
            maxVisible={2}
            popoverVariant="pills"
            isRelaxed={isRelaxed}
          />
        );
      case "on_hand_qty":
        return (
          <span className={`text-sm tabular-nums`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>
            {item.onHandQty.toLocaleString()}
            <span className="text-muted-foreground/60 ml-1">{item.unit}</span>
          </span>
        );
      case "unit":
        return <TextCell value={item.unit} isRelaxed={isRelaxed} />;
      case "acquisition":
        return (
          <AcquisitionMethodsList
            methods={(item.acquisitionMethods ?? []) as AcquisitionMethod[]}
          />
        );
      case "preferred_acquisition":
        return (
          <PreferredAcquisition
            primary={(item.primaryAcquisition ?? null) as AcquisitionMethod | null}
          />
        );
      case "created_by": {
        const name = item.createdBy ?? "System";
        return (
          <UserCell
            name={name}
            subtitle="Created by"
            size={isRelaxed ? "md" : "sm"}
            onClick={setSelectedUser}
          />
        );
      }
      case "owner_id":
        return (
          <OwnerCell
            ownerId={item.ownerId}
            isRelaxed={isRelaxed}
            onUserClick={setSelectedUser}
          />
        );
      case "created_on": {
        /* Mirrors Partners line 2402-2408 literal pattern: title + comfort-only "Xmo ago" secondary line */
        const dateStr = item.createdAt
          ? new Date(item.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "\u2014";
        return (
          <div>
            <span
              className="text-sm"
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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar — Partners pattern: breadcrumb left, search + avatar right (no Plus) */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Items & Inventory
          </button>
          <span className="text-muted-foreground">/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "hsl(var(--accent))" }}
            >
              <span className="text-[11px]" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>
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
                style={{ backgroundColor: "hsl(var(--accent))" }}
              >
                <Package className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Items Library</h1>
                <p className="text-xs text-muted-foreground">
                  Centralized master data for all items, SKUs, and variants.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ActionsMenu
                onImport={() => setImportOpen(true)}
                onExport={() => {
                  if (hasAnyFilter) {
                    setExportRows(filteredItems);
                    setExportContext({ kind: "filtered", filteredCount: filteredItems.length, totalCount: items.length });
                  } else {
                    setExportRows(filteredItems);
                    setExportContext({ kind: "all", totalCount: items.length });
                  }
                }}
              />
              <Button
                onClick={() => setCreateModalOpen(true)}
                size="sm"
                className="bg-primary text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create New Item
              </Button>
            </div>
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
                          <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={() => setInsightsOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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

          {/* Post-import notice sits directly above the table card (UAC placement). */}
          <ImportNoticeBanner />

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
                      style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}
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
                      style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", fontWeight: 600 }}
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
                        {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
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

            {/* Row 2: Quick/Preset filter pills — Partners pattern with Me mode + separator.
                Hidden once "real" filters (Filters Modal or column filters) are applied;
                restored automatically when those filters are cleared. */}
            {/* Bulk action bar: swaps in place of the preset pills while rows are selected (UAC parity). */}
            {selectedCount > 0 && (
              <div
                className="flex items-center justify-between gap-3 px-4 pb-3 shrink-0"
                style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)" }}
              >
                <div className="flex items-center gap-1.5 overflow-x-auto h-10">
                  <button
                    type="button"
                    onClick={() => {
                      const rows = items.filter((i) => selectedIds.has(i.id) && i.status !== "Archived");
                      setExportRows(rows);
                      setExportContext({ kind: "selected", selectedCount: rows.length });
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#BFDBFE] bg-white text-[#0A77FF] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                    style={{ fontSize: "12.5px", fontWeight: 500 }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#0A77FF]" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {selectedCount} selected
                  </span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                    style={{ fontSize: "12.5px", fontWeight: 500 }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {selectedCount === 0 && !hasAppliedFilters && (
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
                const isDestructive = qf === "Archived";
                // Archived pill carries a red accent — both at rest
                // and when active — to flag the destructive state.
                const baseClass = isActive
                  ? (isDestructive
                      ? "border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200"
                      : "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]")
                  : (isDestructive
                      ? "border-red-200 text-destructive hover:bg-red-50 hover:border-red-300 active:bg-red-100"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted");
                return (
                  <button
                    key={qf}
                    onClick={() => { setQuickFilter(qf); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${baseClass}`}
                    style={{
                      fontWeight: isActive ? 500 : 400,
                      color: isActive
                        ? (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--primary))")
                        : (isDestructive ? "hsl(var(--destructive))" : undefined),
                    }}
                  >
                    {isDestructive && <Archive className="w-3 h-3" />}
                    {qf}
                    {showCount && (
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                          isActive
                            ? (isDestructive ? "bg-red-100" : "bg-primary/10")
                            : (isDestructive ? "bg-red-50" : "bg-muted")
                        }`}
                        style={{
                          fontWeight: 600,
                          color: isActive
                            ? (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--primary))")
                            : (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"),
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            )}

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

            <div className={`min-h-0 overflow-auto flex-1 ${draggingColumnKey || isResizing ? "select-none" : ""}`}>
                <Table
                  style={{
                    tableLayout: "fixed",
                    width: `max(${
                      visibleColumns.reduce((sum, c) => sum + getColWidth(c.key), 0) +
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
                        const width = getColWidth(col.key);
                        const isLocked = LOCKED_COLUMNS.includes(col.key);
                        const isDraggable = !isLocked;
                        const isBeingDragged = draggingColumnKey === col.key;
                        const isFrozen = frozenColumns.has(col.key);
                        return (
                          <TableHead
                            key={col.key}
                            data-col-drag-key={col.key}
                            onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, col.key) : undefined}
                            onClickCapture={isDraggable ? (e) => {
                              if (suppressNextClickRef.current) {
                                e.stopPropagation();
                                e.preventDefault();
                              }
                            } : undefined}
                            className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-[#f8fafc] z-20" : ""} ${hasFilter && !isBeingDragged && !isFrozen ? "bg-primary/[0.03]" : ""} ${isDraggable ? "cursor-grab" : ""} ${RIGHT_ALIGNED_COLUMNS.has(col.key) ? "text-right pr-2" : ""}`}
                            style={{
                              width: `${width}px`,
                              minWidth: `${width}px`,
                              maxWidth: `${width}px`,
                              overflow: "hidden",
                              ...(isFrozen ? { left: `${frozenOffsets[col.key] ?? 0}px` } : {}),
                              ...(col.key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                              ...(isBeingDragged ? {
                                background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)",
                              } : {}),
                            }}
                          >
                            {isBeingDragged && (
                              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                            )}
                            {isDraggable && (
                              <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                            )}
                            <div className={`flex items-center ${RIGHT_ALIGNED_COLUMNS.has(col.key) ? "justify-end" : ""}`}>
                              <ColumnHeaderMenu
                                columnKey={col.key}
                                label={col.label}
                                sortable
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                onAddFilter={handleAddColumnFilter}
                                onHideColumn={handleHideColumn}
                                onFreezeColumn={handleFreezeColumn}
                                isFrozen={isFrozen}
                                isLocked={isLocked}
                                hasActiveFilter={hasFilter}
                                filter={filter ?? null}
                                items={items}
                                onFilterChange={handleColumnFilterChange}
                                align={RIGHT_ALIGNED_COLUMNS.has(col.key) ? "right" : "left"}
                              >
                                <div className={`inline-flex items-center gap-1 ${RIGHT_ALIGNED_COLUMNS.has(col.key) ? "flex-row-reverse" : ""}`}>
                                  <span className="text-[13px]" style={currentColSort || hasFilter ? { color: "hsl(var(--primary))" } : undefined}>{col.label}</span>
                                  {hasFilter && !currentColSort && (
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--primary))" }} />
                                  )}
                                  {currentColSort === "asc" && (
                                    <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                  )}
                                  {currentColSort === "desc" && (
                                    <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                  )}
                                  {!currentColSort && !hasFilter && (
                                    <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              </ColumnHeaderMenu>
                            </div>
                            {/* Resize handle — right edge */}
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col.key); }}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setColumnWidths((prev) => {
                                  const next = { ...prev };
                                  delete next[col.key];
                                  return next;
                                });
                              }}
                              className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                              style={{ touchAction: "none" }}
                            >
                              <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === col.key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
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
                            isSelected && "bg-[#EDF4FF]/60 hover:bg-[#EDF4FF]",
                            newlyCreatedId === item.id && "animate-row-flash"
                          )}
                        >
                          {visibleColumns.map((col) => {
                            const width = getColWidth(col.key);
                            const isRightAligned = RIGHT_ALIGNED_COLUMNS.has(col.key);
                            const isDraggedCol = draggingColumnKey === col.key;
                            const isFrozenCol = frozenColumns.has(col.key);
                            return (
                              <TableCell
                                key={col.key}
                                className={cn(
                                  cellPad,
                                  isRightAligned && "text-right tabular-nums",
                                  isFrozenCol && "sticky z-10 bg-card group-hover:bg-[#F0F7FF]",
                                  isFrozenCol && isSelected && "bg-[#EDF4FF]/60 group-hover:bg-[#EDF4FF]"
                                )}
                                style={{
                                  width: `${width}px`,
                                  minWidth: `${width}px`,
                                  maxWidth: `${width}px`,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  ...(isFrozenCol ? { left: `${frozenOffsets[col.key] ?? 0}px` } : {}),
                                  ...(col.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                  ...(isDraggedCol ? {
                                    background: "linear-gradient(180deg, rgba(10,119,255,0.06) 0%, rgba(10,119,255,0.02) 100%)",
                                  } : {}),
                                }}
                              >
                                {renderCell(item, col.key)}
                              </TableCell>
                            );
                          })}
                          {/* Actions — always last, always sticky. Vertical padding via cellPadY; horizontal !pl-2 !pr-2 preserved. */}
                          <TableCell className={cn("sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2", cellPadY)} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            {/* stopPropagation: DropdownMenuContent is portaled, but React
                                events bubble through the React tree to the row's onClick.
                                Without this, clicking a menu item (Mark Active/Inactive,
                                Archive…) navigates to the detail page instead of opening
                                the lifecycle modal (the closest("[data-row-action]") guard
                                in handleRowClick can't see the portaled item). */}
                            <div data-row-action className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
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
                                  {item.status === "Archived" ? (
                                    <DropdownMenuItem
                                      onClick={() => openLifecycle(item.id, "unarchive")}
                                      className="cursor-pointer focus:bg-emerald-50"
                                      style={{ color: "#059669" }}
                                    >
                                      <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                                      Restore
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      {item.status === "Active" ? (
                                        <DropdownMenuItem
                                          onClick={() => openLifecycle(item.id, "disable")}
                                          className="cursor-pointer focus:bg-amber-50"
                                          style={{ color: "#B45309" }}
                                        >
                                          <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
                                          Mark as Inactive
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => openLifecycle(item.id, "enable")}
                                          className="cursor-pointer focus:bg-emerald-50"
                                          style={{ color: "#059669" }}
                                        >
                                          <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                                          Mark as Active
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => openLifecycle(item.id, "archive")}
                                        className="cursor-pointer focus:bg-red-50"
                                        style={{ color: "#B91C1C" }}
                                      >
                                        <Archive className="w-4 h-4 mr-2" style={{ color: "#EF4444" }} />
                                        Archive
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {/* Empty state — pinned to the viewport (sticky left-0 + w-full resolves
                    to the scroll container's width, not the wide table), so it stays
                    centered in view. Header above stays visible. Partner-listing parity. */}
                {pagedItems.length === 0 && (
                  <div className="sticky left-0 w-full flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
                    <Boxes className="w-8 h-8" />
                    <p className="text-sm" style={{ fontWeight: 500 }}>No items found</p>
                    {hasAnyFilter ? (
                      <Button variant="link" size="sm" onClick={clearAllFilters} className="h-auto p-0 text-primary">
                        Clear all filters
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">Create your first item to get started.</p>
                    )}
                  </div>
                )}
              </div>

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

      {/* Lifecycle modal — Mark as Active / Mark as Inactive / Archive / Restore */}
      <ItemLifecycleModal
        open={!!pendingLifecycle}
        action={pendingLifecycle}
        itemName={lifecycleItem?.partNumber ?? "item"}
        itemId={lifecycleItem?.id ?? ""}
        onHandQty={lifecycleItem?.onHandQty ?? 0}
        onCancel={() => { setPendingLifecycle(null); setLifecycleItemId(null); }}
        onConfirm={confirmLifecycle}
      />

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

      {/* Create Item Modal — Slice M.1 wiring */}
      <CreateItemModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={(newItem?: Partial<Item> & { partNumber?: string; description?: string }) => {
          // Part Number is the only required field (Description is optional in the
          // modal). Gate creation + redirect on it alone — otherwise an item created
          // without a description silently skips addItem/navigate and just closes.
          if (newItem && newItem.partNumber) {
            const created = addItem(newItem as Partial<Item> & { partNumber: string; description: string });
            toast.success(`Created ${created.partNumber}`);
            setCreateModalOpen(false);
            // Land on the new item's detail page (not back on the listing).
            navigate(`/items/${created.id}`);
            return;
          }
          setCreateModalOpen(false);
        }}
      />

      {/* Import / Export */}
      <ImportWizardModal open={importOpen} onClose={() => setImportOpen(false)} validationContext={importValidationContext} />
      <ExportModal
        open={exportContext !== null}
        onClose={() => setExportContext(null)}
        context={exportContext}
        rows={exportRows}
        tableColumnVisibility={columnVisibility}
        onClearFilters={() => {
          /* Reset the listing behind the modal, then export every item. */
          clearAllFilters();
          setExportRows(items);
          setExportContext({ kind: "all", totalCount: items.length });
        }}
        onSelectAll={() => {
          /* Select every item the listing shows and export them all. */
          setSelectedIds(new Set(filteredItems.map((i) => i.id)));
          if (hasAnyFilter) {
            setExportRows(filteredItems);
            setExportContext({ kind: "filtered", filteredCount: filteredItems.length, totalCount: items.length });
          } else {
            setExportRows(filteredItems);
            setExportContext({ kind: "all", totalCount: items.length });
          }
        }}
      />

      {/* Item Quick View Modal — opens from the row thumbnail (and tooltip rows) */}
      {itemQuickView.modal}

      {/* User Detail Modal — opens when a Created By or Owner avatar/name is clicked */}
      <UserDetailModal
        user={selectedUser}
        assignedCount={
          selectedUser
            ? items.filter(
                (i) =>
                  (i.createdBy && i.createdBy === selectedUser) ||
                  resolveOwner(i.ownerId).name === selectedUser,
              ).length
            : 0
        }
        onClose={() => setSelectedUser(null)}
      />

      {/* Column drag ghost — Partners parity (VendorsListPage 2706–2749) */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: draggingColumnKey ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform",
          }}
        >
          {draggingColumnKey && (() => {
            const ghostSort = sortConfig?.key === draggingColumnKey ? sortConfig.direction : null;
            const ghostFilterEntry = columnFilters.find((f) => f.columnKey === draggingColumnKey);
            const ghostFilter = ghostFilterEntry ? isFilterActive(ghostFilterEntry) : false;
            const label = COLUMN_LABELS[draggingColumnKey] ?? draggingColumnKey;
            return (
              <div
                className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
                style={{
                  marginLeft: 12,
                  marginTop: -14,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(10,119,255,0.3)",
                  boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)",
                }}
              >
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <span className="text-[13px]" style={{ color: "hsl(var(--primary))", fontWeight: 500 }}>
                  {label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                {ghostFilter && !ghostSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--primary))" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}
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
