import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { getFlagUrl, getFlagUrlByCountry } from "../utils/currencyFlags";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useCurrencies } from "../context/CurrencyContext";
import type { Currency } from "../data/currencies";
import { hasOpenDocuments, countInUse } from "../data/currencies";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { currencyMatchesRegionFilter } from "../components/vendors/CurrencyFiltersModal";
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  type ColumnConfig,
} from "../components/vendors/ColumnSelector";
import {
  CurrencyFiltersModal,
  DEFAULT_CURRENCY_FILTERS,
  countActiveCurrencyFilters,
  currencyMatchesInUseFilter,
  type CurrencyFilters,
} from "../components/vendors/CurrencyFiltersModal";
import {
  Search,
  MoreHorizontal,
  Eye,
  ToggleLeft,
  ToggleRight,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  SlidersHorizontal,
  AlignJustify,
  List,
  LayoutGrid,
  Check,
  X,
  GripVertical,
  Coins,
  CircleCheck,
  CircleSlash,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

/* ─── Density / View mode ─── */
type DensityOption = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";

const DENSITY_CONFIG: { key: DensityOption; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

/* ─── Quick filter pills ─── */
type QuickFilter = "all" | "active" | "inactive" | "base";

const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  { key: "base", label: "Base Currency", showCount: true },
];

/* ─── Column configuration ─── */
const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "code", label: "Currency", minWidth: "300px", sortable: true },
  { key: "symbol", label: "Symbol", minWidth: "100px" },
  { key: "decimalPlaces", label: "Decimals", minWidth: "120px", sortable: true },
  { key: "country", label: "Country / Region", minWidth: "220px", sortable: true },
  { key: "inUse", label: "In Use", minWidth: "140px", sortable: true },
  { key: "status", label: "Status", minWidth: "130px", sortable: true },
  { key: "numericCode", label: "Numeric Code", minWidth: "160px", sortable: true },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.key === "numericCode" ? false : true])
);
const LOCKED_COLUMNS = ["code"];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const MIN_COL_WIDTH = 1;
const CHECKBOX_COL_WIDTH = 40;

type SortKey = string;
type SortDir = "asc" | "desc";

const CHART_COLORS = ["#0A77FF", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const DONUT_COLORS = ["#059669", "#94A3B8"];

export function CurrencyListPage() {
  const navigate = useNavigate();
  const { currencies, activateCurrency, deactivateCurrency, bulkActivate, bulkDeactivate } = useCurrencies();

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  

  /* ─── Sort state — usage-based default (highest In Use first) ─── */
  const [sortKey, setSortKey] = useState<SortKey>("inUse");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ─── Advanced Filters ─── */
  const [advFilters, setAdvFilters] = useState<CurrencyFilters>({ ...DEFAULT_CURRENCY_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveCurrencyFilters(advFilters), [advFilters]);

  /* ─── Column visibility & order ─── */
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  /* ─── Column drag reorder state ─── */
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

  /* ─── Column resize ─── */
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  // Dialog states
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; currency: Currency | null }>({ open: false, currency: null });
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; code: string }>({ open: false, code: "" });
  const [openDocsErrorDialog, setOpenDocsErrorDialog] = useState<{ open: boolean; currency: Currency | null }>({ open: false, currency: null });
  const [bulkDeactivateResultDialog, setBulkDeactivateResultDialog] = useState<{ open: boolean; skippedCodes: string[] }>({ open: false, skippedCodes: [] });

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 200);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);


  /* ─── Column drag: mousedown ─── */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (isResizing) return;
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
  }, [isResizing]);

  /* ─── Column resize handlers ─── */
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? parseInt(colDef(columnKey).minWidth, 10);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths]);

  /* ─── Visible columns ─── */
  const validColumnKeys = useMemo(() => new Set(COLUMN_DEFS.map((c) => c.key)), []);
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter((key) => validColumnKeys.has(key) && columnVisibility[key] !== false);
    if (!ordered.includes("code")) ordered.unshift("code");
    else if (ordered[0] !== "code") {
      const idx = ordered.indexOf("code");
      ordered.splice(idx, 1);
      ordered.unshift("code");
    }
    return ordered;
  }, [columnOrder, columnVisibility, validColumnKeys]);

  const colDef = (key: string) => COLUMN_DEFS.find((c) => c.key === key)!;

  /* ─── Filter counts ─── */
  const filterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = { all: currencies.length, active: 0, inactive: 0, base: 0 };
    currencies.forEach((c) => {
      if (c.status === "active") counts.active++;
      if (c.status === "inactive") counts.inactive++;
      if (c.isBaseCurrency) counts.base++;
    });
    return counts;
  }, [currencies]);

  /* ─── Filtering ─── */
  const filtered = useMemo(() => {
    let list = [...currencies];

    switch (quickFilter) {
      case "active": list = list.filter((c) => c.status === "active"); break;
      case "inactive": list = list.filter((c) => c.status === "inactive"); break;
      case "base": list = list.filter((c) => c.isBaseCurrency); break;
    }

    if (advFilters.statuses.length > 0) list = list.filter((c) => advFilters.statuses.includes(c.status));
    if (advFilters.decimalPlaces.length > 0) list = list.filter((c) => advFilters.decimalPlaces.includes(String(c.decimalPlaces)));
    if (advFilters.regions.length > 0) list = list.filter((c) => currencyMatchesRegionFilter(c, advFilters.regions));
    if (advFilters.inUseFilter !== "any") list = list.filter((c) => currencyMatchesInUseFilter(c, advFilters));

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.numericCode.includes(q)
      );
    }
    return list;
  }, [currencies, quickFilter, advFilters, debouncedSearch]);

  /* ─── Sorting ─── */
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "code": cmp = a.code.localeCompare(b.code); break;
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "numericCode": cmp = a.numericCode.localeCompare(b.numericCode); break;
        case "decimalPlaces": cmp = a.decimalPlaces - b.decimalPlaces; break;
        case "country": cmp = a.country.localeCompare(b.country); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "inUse": cmp = countInUse(a) - countInUse(b); break;
        default: cmp = 0;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / recordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paged = sorted.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  /* ─── Selection ─── */
  const allVisibleSelected = paged.length > 0 && paged.every((c) => selectedRows.has(c.code));
  const someVisibleSelected = paged.some((c) => selectedRows.has(c.code));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        paged.forEach((c) => next.delete(c.code));
      } else {
        paged.forEach((c) => next.add(c.code));
      }
      return next;
    });
  }, [allVisibleSelected, paged]);

  const handleSelectRow = useCallback((code: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  /* ─── Sort handling ─── */
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "inUse" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  /* ─── Status toggle logic (with deactivation guard) ─── */
  const handleToggleStatus = (c: Currency, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (c.status === "inactive") {
      activateCurrency(c.code);
      toast.success(`${c.code} activated`);
      return;
    }
    if (c.isBaseCurrency) {
      setErrorDialog({ open: true, code: c.code });
      return;
    }
    // Deactivation guard: check open documents
    if (hasOpenDocuments(c)) {
      setOpenDocsErrorDialog({ open: true, currency: c });
      return;
    }
    setDeactivateDialog({ open: true, currency: c });
  };

  const confirmDeactivate = () => {
    if (!deactivateDialog.currency) return;
    deactivateCurrency(deactivateDialog.currency.code);
    toast.success(`${deactivateDialog.currency.code} deactivated`);
    setDeactivateDialog({ open: false, currency: null });
  };

  /* ─── Bulk actions ─── */
  const handleBulkActivate = () => {
    const codes = Array.from(selectedRows);
    const { activated, alreadyActive } = bulkActivate(codes);
    toast.success(`${activated} currencies activated.${alreadyActive > 0 ? ` ${alreadyActive} were already active.` : ""}`);
    setSelectedRows(new Set());
  };

  const handleBulkDeactivate = () => {
    const codes = Array.from(selectedRows);
    const { deactivated, skippedBase, skippedOpenDocs } = bulkDeactivate(codes);
    const skippedCount = skippedBase + skippedOpenDocs.length;
    if (skippedOpenDocs.length > 0) {
      toast.info(`${deactivated} currencies deactivated. ${skippedOpenDocs.length} could not be deactivated due to open documents.`);
      setBulkDeactivateResultDialog({ open: true, skippedCodes: skippedOpenDocs });
    } else {
      let msg = `${deactivated} currencies deactivated.`;
      if (skippedBase > 0) msg += ` ${skippedBase} skipped (base currency).`;
      toast.success(msg);
    }
    setSelectedRows(new Set());
  };

  const handleBulkExport = () => {
    const codes = Array.from(selectedRows);
    const selected = currencies.filter(c => codes.includes(c.code));
    const header = "Code,Name,ISO Numeric Code,Symbol,Decimal Places,Country,Status\n";
    const rows = selected
      .map((c) => `${c.code},${c.name},${c.numericCode},${c.symbol},${c.decimalPlaces},${c.country},${c.status}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "currencies_selected.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selected.length} currencies exported`);
  };

  /* ─── CSV export (all) ─── */
  const handleExport = () => {
    const header = "Code,Name,ISO Numeric Code,Symbol,Decimal Places,Country,Status\n";
    const rows = filtered
      .map((c) => `${c.code},${c.name},${c.numericCode},${c.symbol},${c.decimalPlaces},${c.country},${c.status}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "currencies.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const hasAnyFilter = !!searchQuery || quickFilter !== "all" || activeFilterCount > 0;

  const clearAllFilters = () => {
    setSearchQuery("");
    setQuickFilter("all");
    setAdvFilters({ ...DEFAULT_CURRENCY_FILTERS });
    setCurrentPage(1);
  };

  /** Text highlight helper */
  const highlightText = useCallback(
    (text: string | undefined | null) => {
      if (!text) return <span>–</span>;
      if (!searchQuery || searchQuery.trim().length === 0) return <>{text}</>;
      const query = searchQuery.trim();
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      if (parts.length === 1) return <>{text}</>;
      return (
        <>
          {parts.map((part, i) =>
            i % 2 === 1 ? (
              <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    },
    [searchQuery]
  );

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

  /* ─── Cell renderer ─── */
  const isRelaxed = density === "comfort";

  const renderCell = (c: Currency, colKey: string) => {
    const inUse = countInUse(c);
    const totalDocs = c.usage.totalLifetimeDocuments;
    switch (colKey) {
      case "code":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-2.5">
              {(() => { const flag = getFlagUrl(c.code); return flag ? <img src={flag} alt={c.code} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" /> : null; })()}
              <span className={`text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary ${isRelaxed ? "" : ""}`} style={{ fontWeight: 600 }}>{highlightText(c.code)}</span>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"}`}>{highlightText(c.name)}</span>
              {c.isBaseCurrency && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7" }}>Base</span>
              )}
            </div>
          </TableCell>
        );
      case "name":
        return null;
      case "numericCode":
        return <TableCell key={colKey} className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} tabular-nums text-muted-foreground`}>{c.numericCode}</TableCell>;
      case "symbol":
        return <TableCell key={colKey} className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} text-muted-foreground`}>{c.symbol}</TableCell>;
      case "decimalPlaces":
        return <TableCell key={colKey} className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} tabular-nums`}>{c.decimalPlaces}</TableCell>;
      case "country": {
        const extra = c.additionalCountries ?? [];
        const extraCount = extra.length;
        return (
          <TableCell key={colKey} className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} overflow-hidden whitespace-nowrap max-w-0`}>
            <span>{highlightText(c.country)}</span>
            {extraCount > 0 && (
              <OverflowTooltip
                category="Countries / Regions"
                items={extra.map((country, i) => ({
                  id: `${c.code}-country-${i}`,
                  name: country,
                  subtitle: "",
                  image: getFlagUrlByCountry(country) || undefined,
                }))}
              >
                <span
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1.5 text-[12px] cursor-default"
                  style={{ color: "#0A77FF", fontWeight: 500 }}
                >
                  +{extraCount} more
                </span>
              </OverflowTooltip>
            )}
          </TableCell>
        );
      }
      case "inUse":
        return (
          <TableCell key={colKey}>
            <div className="flex flex-col leading-tight whitespace-nowrap">
              {inUse > 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/accounting/currencies/${c.code}?tab=documents&filter=active`);
                  }}
                  className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} hover:underline cursor-pointer text-left w-fit`}
                  style={{ fontWeight: 600, color: "#0A77FF" }}
                >
                  {inUse} active
                </button>
              ) : (
                <span
                  className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} text-muted-foreground`}
                  style={{ fontWeight: 500 }}
                >
                  0 active
                </span>
              )}
              <span className="text-[11px] text-muted-foreground/70 mt-0.5">
                {totalDocs} total
              </span>
            </div>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={colKey}>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full border"
              style={
                c.status === "active"
                  ? { fontWeight: 500, color: "#065F46", backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }
                  : { fontWeight: 500, color: "#475569", backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }
              }
            >
              {c.status === "active" ? "Active" : "Inactive"}
            </span>
          </TableCell>
        );
      default:
        return <TableCell key={colKey}>–</TableCell>;
    }
  };


  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] [&_::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {/* Top Bar / Breadcrumb */}
      <div className="flex items-center justify-between px-4 lg:px-6 h-11 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <button onClick={() => navigate("/accounting")} className="hover:text-[#0F172A] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Currencies & Exchange Rates
          </button>
          <span className="text-[#CBD5E1]">/</span>
          <span style={{ fontWeight: 500 }} className="text-[#0F172A]">Currency Library</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Search currencies..."
              className="pl-9 w-[220px] h-8 bg-[#F8FAFC] border-[#E2E8F0] text-[13px] placeholder:text-[#94A3B8] rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 border-[#E2E8F0]" style={{ backgroundColor: '#0A77FF' }}>
              <span className="text-[11px] text-white" style={{ fontWeight: 600 }}>AA</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
              <p className="text-[11px] text-[#94A3B8] leading-tight">Product Designer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
                <Coins className="w-4 h-4" style={{ color: '#0A77FF' }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Currency Library</h1>
                <p className="text-xs text-muted-foreground">
                  A complete list of all world currencies available in your system. All currencies are active by default — deactivate currencies you don't transact in to keep your workspace organised.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>

          {/* Unified Table Container */}
          <div className="px-6 lg:px-8 pt-4 pb-6 flex-1 min-h-0 flex flex-col">
            <div className="border border-border rounded-xl bg-card overflow-clip flex flex-1 min-h-0">
              <div className="flex-1 min-w-0 overflow-clip flex flex-col">
                {/* Row 1: Search + Filters ... Count + Density + Columns */}
                <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        placeholder="Search by code, name, or country..."
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
                    {/* Filters button */}
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(true)}
                      className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                        activeFilterCount > 0 ? "text-primary border-primary/30" : "text-foreground border-border/80"
                      }`}
                    >
                      <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                      {activeFilterCount > 0 && (
                        <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white" style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}>
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                    {/* Reset button - only visible when filters applied */}
                    {hasAnyFilter && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-sm" style={{ fontWeight: 500 }}>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Count + Bulk Actions + Density + Column Selector */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                      {filtered.length !== currencies.length ? (
                        <>
                          <span className="text-foreground">{filtered.length}</span>
                          <span className="text-muted-foreground/60"> of </span>
                          <span className="text-muted-foreground">{currencies.length}</span>
                          <span className="text-muted-foreground/70"> currencies</span>
                        </>
                      ) : (
                        <>
                          <span className="text-foreground">{currencies.length}</span>
                          <span className="text-muted-foreground/70"> currencies</span>
                        </>
                      )}
                    </span>

                    <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                    {/* Density Dropdown */}
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
                            onSelect={(e) => {
                              if (opt.key === "card") e.preventDefault();
                              setDensity(opt.key);
                            }}
                          >
                            {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                            {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                            {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                            {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                          </DropdownMenuItem>
                        ))}
                        {density === "card" && (
                          <>
                            <div className="mx-2 my-1.5 border-t border-[#F1F5F9]" />
                            <div className="px-3 py-1.5">
                              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                              <div className="flex items-center gap-1.5">
                                {(["large", "medium", "small"] as const).map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => setCardSize(size)}
                                    className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                                      cardSize === size ? "bg-[#0A77FF] text-white shadow-sm" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                                    }`}
                                    style={{ fontWeight: cardSize === size ? 600 : 500 }}
                                  >
                                    {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Column Selector Trigger */}
                    <ColumnSelectorTrigger
                      visibleCount={visibleColumns.length}
                      active={columnDrawerOpen}
                      onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                    />
                  </div>
                </div>

                {/* Row 2: Quick Filter Pills OR Bulk Action Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 min-h-[36px]" style={{ scrollbarWidth: "none" }}>
                  {selectedRows.size > 0 ? (
                    /* Bulk Action Bar — rectangular buttons */
                    <>
                      <span className="text-[13px] text-muted-foreground mr-2 shrink-0" style={{ fontWeight: 500 }}>
                        {selectedRows.size} selected
                      </span>
                      <button
                        onClick={handleBulkActivate}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer border-border bg-white text-foreground hover:bg-muted/50"
                        style={{ fontWeight: 500 }}
                      >
                        <CircleCheck className="w-3.5 h-3.5" />
                        Activate
                      </button>
                      <button
                        onClick={handleBulkDeactivate}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer border-border bg-white text-foreground hover:bg-muted/50"
                        style={{ fontWeight: 500 }}
                      >
                        <CircleSlash className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                      <button
                        onClick={handleBulkExport}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer border-border bg-white text-foreground hover:bg-muted/50"
                        style={{ fontWeight: 500 }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export Selected
                      </button>
                      <button
                        onClick={() => setSelectedRows(new Set())}
                        className="inline-flex items-center gap-1 h-8 px-2 rounded-md text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        style={{ fontWeight: 500 }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    </>
                  ) : (
                    /* Quick Filter Pills */
                    QUICK_FILTER_OPTIONS.map((filter) => {
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
                          style={{ fontWeight: isActive ? 500 : 400, color: isActive ? '#0A77FF' : undefined }}
                        >
                          {filter.label}
                          {filter.showCount && (
                            <span
                              className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                              style={{ fontWeight: 600, color: isActive ? '#0A77FF' : '#475569' }}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border shrink-0" />

                {density === "card" ? (
                  /* ─── Card View ─── */
                  <div className="p-4 min-h-0 overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>
                    {paged.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                        <Coins className="w-8 h-8" />
                        <p className="text-sm">No currencies found</p>
                        {hasAnyFilter && <Button variant="link" size="sm" onClick={clearAllFilters}>Clear all filters</Button>}
                      </div>
                    ) : (
                      <div className={`grid gap-4 ${
                        cardSize === "large" ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" :
                        cardSize === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      }`}>
                        {paged.map((c) => (
                          <div
                            key={c.code}
                            className={`bg-card border border-border rounded-xl cursor-pointer hover:shadow-md hover:border-primary/20 transition-all ${
                              cardSize === "large" ? "p-5" : cardSize === "small" ? "p-3" : "p-4"
                            }`}
                            onClick={() => navigate(`/accounting/currencies/${c.code}`)}
                            style={c.isBaseCurrency ? { borderLeft: "3px solid #e65100", backgroundColor: "#fffbf2" } : undefined}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm" style={{ fontWeight: 600 }}>{c.code}</span>
                                  {c.isBaseCurrency && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7" }}>Base</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{c.name}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-lg" style={{ fontWeight: 500 }}>{c.symbol}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button type="button" className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => navigate(`/accounting/currencies/${c.code}`)}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {c.status === "active" ? (
                                      <DropdownMenuItem onClick={(e) => handleToggleStatus(c, e as unknown as React.MouseEvent)}>
                                        <CircleSlash className="w-4 h-4 mr-2" /> Deactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={(e) => handleToggleStatus(c, e as unknown as React.MouseEvent)}>
                                        <CircleCheck className="w-4 h-4 mr-2" /> Activate
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <span
                                className="text-[11px] px-2 py-0.5 rounded-full border"
                                style={
                                  c.status === "active"
                                    ? { fontWeight: 500, color: "#065F46", backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }
                                    : { fontWeight: 500, color: "#475569", backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }
                                }
                              >
                                {c.status === "active" ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{c.country}</span>
                              <span>·</span>
                              <span>{c.decimalPlaces} decimals</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ─── Table View ─── */
                  <div className={`min-h-0 overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`} style={{ scrollbarWidth: "none" }}>
                    <Table style={{ tableLayout: "fixed", minWidth: `${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px`, width: "100%" }}>
                      <TableHeader className="sticky top-0 z-20 bg-card">
                        <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                          density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"
                        }`}>
                          {/* Checkbox column */}
                          <TableHead className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                            <Checkbox
                              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all rows"
                            />
                          </TableHead>
                          {/* Dynamic columns */}
                          {visibleColumns.map((key) => {
                            const def = colDef(key);
                            const isLocked = LOCKED_COLUMNS.includes(key);
                            const isDraggable = !isLocked;
                            const isBeingDragged = draggingColumnKey === key;
                            const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                            const isSorted = sortKey === key;

                            return (
                              <TableHead
                                key={key}
                                data-col-drag-key={key}
                                onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                                onClickCapture={isDraggable ? (e) => {
                                  if (suppressNextClickRef.current) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }
                                } : undefined}
                                className={`whitespace-nowrap relative group/colheader ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                                style={{
                                  width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
                                  overflow: "hidden",
                                  ...(isBeingDragged ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}),
                                }}
                              >
                                {isBeingDragged && (
                                  <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />
                                )}
                                {isDraggable && (
                                  <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                                )}

                                <div className={`flex items-center ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                  {def.sortable ? (
                                    <button
                                      onClick={() => handleSort(key)}
                                      className="inline-flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                                      style={isSorted ? { color: "#0A77FF" } : undefined}
                                    >
                                      <span>{def.label}</span>
                                      {isSorted && sortDir === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                      {isSorted && sortDir === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                      {!isSorted && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                                    </button>
                                  ) : (
                                    <span className="text-[13px]">{def.label}</span>
                                  )}
                                </div>

                                {/* Resize handle */}
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setColumnWidths((prev) => ({ ...prev, [key]: parseInt(def.minWidth, 10) }));
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                                  style={{ touchAction: "none" }}
                                >
                                  <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                                </div>
                              </TableHead>
                            );
                          })}
                          <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <span className="text-[13px]">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paged.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Coins className="w-8 h-8" />
                                <p className="text-sm">No currencies found</p>
                                {hasAnyFilter && <Button variant="link" size="sm" onClick={clearAllFilters}>Clear all filters</Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paged.map((c) => (
                            <TableRow
                              key={c.code}
                              onClick={() => navigate(`/accounting/currencies/${c.code}`)}
                              className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                                density === "condensed" ? "[&>td]:py-1.5 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-2.5 [&>td]:pl-4 [&>td]:pr-2"
                              }`}
                              style={c.isBaseCurrency ? { backgroundColor: "#fffbf2", borderLeft: "3px solid #e65100" } : undefined}
                            >
                              <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] !pl-2 !pr-0 w-[40px]" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedRows.has(c.code)}
                                  onCheckedChange={() => handleSelectRow(c.code)}
                                  aria-label={`Select ${c.code}`}
                                />
                              </TableCell>
                              {visibleColumns.map((key) => renderCell(c, key))}
                              <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[60px]" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => navigate(`/accounting/currencies/${c.code}`)}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {c.status === "active" ? (
                                      hasOpenDocuments(c) ? (
                                        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed" title="Cannot deactivate — this currency has open documents.">
                                          <CircleSlash className="w-4 h-4 mr-2" /> Deactivate
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onClick={(e) => handleToggleStatus(c, e as unknown as React.MouseEvent)}>
                                          <CircleSlash className="w-4 h-4 mr-2" /> Deactivate
                                        </DropdownMenuItem>
                                      )
                                    ) : (
                                      <DropdownMenuItem onClick={(e) => handleToggleStatus(c, e as unknown as React.MouseEvent)}>
                                        <CircleCheck className="w-4 h-4 mr-2" /> Activate
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {sorted.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Records per page</span>
                      <Select
                        value={String(recordsPerPage)}
                        onValueChange={(val) => { setRecordsPerPage(Number(val)); setCurrentPage(1); }}
                      >
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </Button>

                      {getPageNumbers().map((page, idx) =>
                        page === "..." ? (
                          <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 w-8 p-0 text-sm ${currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() => setCurrentPage(page as number)}
                          >
                            {page}
                          </Button>
                        )
                      )}

                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Column Selector Side Drawer */}
              <ColumnSelector
                columns={COLUMN_DEFS}
                columnOrder={columnOrder}
                columnVisibility={columnVisibility}
                onColumnOrderChange={setColumnOrder}
                onColumnVisibilityChange={setColumnVisibility}
                lockedColumns={LOCKED_COLUMNS}
                open={columnDrawerOpen}
                onOpenChange={setColumnDrawerOpen}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Column drag ghost */}
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
          {draggingColumnKey && (
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
              <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
              <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
                {colDef(draggingColumnKey)?.label}
              </span>
              {sortKey === draggingColumnKey && sortDir === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
              {sortKey === draggingColumnKey && sortDir === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Filters Modal */}
      <CurrencyFiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advFilters}
        onFiltersChange={(f) => { setAdvFilters(f); setCurrentPage(1); }}
        currencies={currencies}
        filteredCount={filtered.length}
      />

      {/* Deactivation Confirmation — destructive (Archive-modal pattern) */}
      <AlertDialog open={deactivateDialog.open} onOpenChange={(o) => !o && setDeactivateDialog({ open: false, currency: null })}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setDeactivateDialog({ open: false, currency: null })}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <CircleSlash className="w-8 h-8" style={{ color: "#DC2626" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Caution
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Deactivate {deactivateDialog.currency?.code}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {deactivateDialog.currency?.name ?? "This currency"}
              </span>{" "}
              will no longer be available for new transactions. Historical records are preserved and you can re-activate it at any time.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={confirmDeactivate}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
              >
                Deactivate Currency
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivation BLOCKED — open docs exist (amber informational, Archive-modal pattern) */}
      <AlertDialog open={openDocsErrorDialog.open} onOpenChange={(o) => !o && setOpenDocsErrorDialog({ open: false, currency: null })}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setOpenDocsErrorDialog({ open: false, currency: null })}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "#D97706" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Warning
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Cannot Deactivate Currency
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[320px] mx-auto text-center" style={{ color: "#475569", lineHeight: "1.65" }}>
                <p>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{openDocsErrorDialog.currency?.code}</span>{" "}
                  has open documents that must be resolved before deactivation.
                </p>
                {openDocsErrorDialog.currency && (
                  <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5 text-left">
                    {openDocsErrorDialog.currency.usage.openInvoices.length > 0 && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#64748B]">Open Vendor Invoices:</span>
                        <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{openDocsErrorDialog.currency.usage.openInvoices.length}</span>
                      </div>
                    )}
                    {openDocsErrorDialog.currency.usage.openCustomerInvoices.length > 0 && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#64748B]">Open Customer Invoices:</span>
                        <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{openDocsErrorDialog.currency.usage.openCustomerInvoices.length}</span>
                      </div>
                    )}
                    {openDocsErrorDialog.currency.usage.openPurchaseOrders.length > 0 && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#64748B]">Open Purchase Orders:</span>
                        <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{openDocsErrorDialog.currency.usage.openPurchaseOrders.length}</span>
                      </div>
                    )}
                    {openDocsErrorDialog.currency.usage.openSalesOrders.length > 0 && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#64748B]">Open Sales Orders:</span>
                        <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{openDocsErrorDialog.currency.usage.openSalesOrders.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 mt-0"
                style={{ fontWeight: 600, backgroundColor: "#D97706", color: "#fff" }}
              >
                Understood
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Base Currency Error — amber informational (Archive-modal pattern) */}
      <AlertDialog open={errorDialog.open} onOpenChange={(o) => !o && setErrorDialog({ open: false, code: "" })}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setErrorDialog({ open: false, code: "" })}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "#D97706" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Warning
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Cannot Deactivate Base Currency
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[320px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{errorDialog.code}</span>{" "}
              is set as the base currency and cannot be deactivated. Change your base currency in Company Settings first.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 mt-0"
                style={{ fontWeight: 600, backgroundColor: "#D97706", color: "#fff" }}
              >
                OK
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Deactivate Result — amber informational (Archive-modal pattern) */}
      <AlertDialog open={bulkDeactivateResultDialog.open} onOpenChange={(o) => !o && setBulkDeactivateResultDialog({ open: false, skippedCodes: [] })}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setBulkDeactivateResultDialog({ open: false, skippedCodes: [] })}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "#D97706" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Warning
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Some Currencies Could Not Be Deactivated
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[360px] mx-auto text-center" style={{ color: "#475569", lineHeight: "1.65" }}>
                <p>The following currencies were skipped because they have open documents:</p>
                <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-left max-h-[220px] overflow-y-auto">
                  {bulkDeactivateResultDialog.skippedCodes.map(code => {
                    const c = currencies.find(x => x.code === code);
                    if (!c) return null;
                    return (
                      <div key={code} className="border-b border-[#F1F5F9] last:border-b-0 pb-2 last:pb-0">
                        <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{c.code} — {c.name}</p>
                        <div className="mt-1 space-y-0.5 text-[12px] text-[#64748B]">
                          {c.usage.openInvoices.length > 0 && <p>Vendor Invoices: {c.usage.openInvoices.length}</p>}
                          {c.usage.openCustomerInvoices.length > 0 && <p>Customer Invoices: {c.usage.openCustomerInvoices.length}</p>}
                          {c.usage.openPurchaseOrders.length > 0 && <p>Purchase Orders: {c.usage.openPurchaseOrders.length}</p>}
                          {c.usage.openSalesOrders.length > 0 && <p>Sales Orders: {c.usage.openSalesOrders.length}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 mt-0"
                style={{ fontWeight: 600, backgroundColor: "#D97706", color: "#fff" }}
              >
                Close
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
