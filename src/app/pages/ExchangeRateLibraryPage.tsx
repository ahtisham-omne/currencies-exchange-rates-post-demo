import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useExchangeRates } from "../context/ExchangeRateContext";
import {
  BASE_CURRENCY,
  BASE_CURRENCY_NAME,
  API_PROVIDER,
  LAST_SYNC,
  type MidMarketRate,
  type StandardRate,
} from "../data/exchangeRates";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "../components/vendors/ColumnSelector";
import { getFlagUrl, getCountryName } from "../utils/currencyFlags";
import { EXPLANATORY_BLOCKS, INVERSE_BADGE_TOOLTIP, RATE_TOOLTIPS } from "../utils/rateCopy";
import {
  ExchangeRateFiltersModal,
  DEFAULT_EXCHANGE_RATE_FILTERS,
  countActiveExchangeRateFilters,
  currencyMatchesExchangeRateRegionFilter,
  type ExchangeRateFilters,
} from "../components/vendors/ExchangeRateFiltersModal";
import { Checkbox } from "../components/ui/checkbox";
import {
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Cloud,
  Star,
  RefreshCw,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Info,
  Minus,
  RotateCcw,
  AlignJustify,
  List,
  LayoutGrid,
  GripVertical,
  Check,
  SlidersHorizontal,
  Eye,
  Archive,
  Copy,
  Link2,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

type ActiveTab = "mid-market" | "standard";
type QuickFilter = "all" | "active" | "inactive" | "archived";
type SortKey = string;
type SortDir = "asc" | "desc";
type DensityOption = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";

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

const QUICK_FILTERS_MID: { key: QuickFilter; label: string; showCount: boolean }[] = [];

// A corporate rate either exists (active) or it's been retired (archived).
// Inactive was ambiguous and has been removed from filters, badges, and the
// Add/Update modal.
const QUICK_FILTERS_STD: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "active", label: "Active", showCount: true },
  { key: "archived", label: "Archived", showCount: true },
];

/* ─── Column definitions for Mid-Market table ─── */
const MID_COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "sourceCurrency", label: "Source Currency", minWidth: "200px", sortable: true },
  { key: "rate", label: "Mid-Market Exchange Rate", minWidth: "200px", sortable: true, align: "right" },
  { key: "inverseRate", label: "Inverse Rate", minWidth: "160px", sortable: true, align: "right" },
  { key: "change24h", label: "Change (24h)", minWidth: "140px", sortable: true, align: "right" },
];

const STD_COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "sourceCurrency", label: "Source Currency", minWidth: "200px", sortable: true },
  { key: "standardRate", label: "Corporate Exchange Rate", minWidth: "200px", sortable: true, align: "right" },
  { key: "inverseStdRate", label: "Inverse Rate", minWidth: "160px", sortable: true, align: "right" },
  { key: "midMarketRate", label: "Mid-Market Exchange Rate", minWidth: "200px", sortable: true, align: "right" },
  { key: "variance", label: "Variance", minWidth: "120px", sortable: true, align: "right" },
  { key: "effectiveDate", label: "Effective Date", minWidth: "150px", sortable: true },
  { key: "createdBy", label: "Created By", minWidth: "180px" },
];

const MID_DEFAULT_ORDER = MID_COLUMN_DEFS.map(c => c.key);
const STD_DEFAULT_ORDER = STD_COLUMN_DEFS.map(c => c.key);
const MID_DEFAULT_VIS: Record<string, boolean> = Object.fromEntries(MID_COLUMN_DEFS.map(c => [c.key, true]));
const STD_DEFAULT_VIS: Record<string, boolean> = Object.fromEntries(STD_COLUMN_DEFS.map(c => [c.key, true]));
const MID_DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(MID_COLUMN_DEFS.map(c => [c.key, parseInt(c.minWidth, 10)]));
const STD_DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(STD_COLUMN_DEFS.map(c => [c.key, parseInt(c.minWidth, 10)]));
const LOCKED_COLUMNS = ["sourceCurrency"];
const MIN_COL_WIDTH = 1;
const CHEVRON_COL_WIDTH = 36;
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 60;

/** Single combined search-and-trigger picker for the Add Corporate Rate modal.
 * Replaces the previous trigger-button + popover-search pair. The input
 * itself is the search field — opens a dropdown directly below as the user
 * types or focuses it. */
function SourceCurrencyPicker({
  value,
  onChange,
  midMarketRates,
}: {
  value: string;
  onChange: (code: string) => void;
  midMarketRates: MidMarketRate[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(
    () => midMarketRates.find(r => r.sourceCurrency === value) ?? null,
    [midMarketRates, value]
  );

  // Show all currencies (not just those with existing rates). The input
  // doubles as the trigger — focusing or typing opens the dropdown.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...midMarketRates].sort((a, b) =>
      a.sourceCurrency.localeCompare(b.sourceCurrency)
    );
    if (!q) return list;
    return list.filter(r =>
      r.sourceCurrency.toLowerCase().includes(q) ||
      r.sourceCurrencyName.toLowerCase().includes(q)
    );
  }, [midMarketRates, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 h-9 px-3 rounded-md border bg-white text-[13px] transition-colors ${
          open ? "border-primary/40 ring-2 ring-primary/10 rounded-b-none" : "border-border"
        }`}
      >
        {selected && !query && (() => {
          const flag = getFlagUrl(selected.sourceCurrency);
          return flag ? (
            <img src={flag} alt={selected.sourceCurrency} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />
          ) : null;
        })()}
        <input
          ref={inputRef}
          type="text"
          value={query !== "" ? query : selected ? `${selected.sourceCurrency} — ${selected.sourceCurrencyName}` : ""}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search currency code or name..."
          className="flex-1 outline-none bg-transparent placeholder:text-muted-foreground/60 min-w-0"
        />
        {(selected || query) && (
          <button
            type="button"
            onClick={() => { onChange(""); setQuery(""); inputRef.current?.focus(); setOpen(true); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 top-full -mt-px border border-primary/40 border-t-0 rounded-b-md bg-white shadow-lg max-h-[280px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No currencies match your search.</p>
          ) : (
            filtered.map(r => {
              const flag = getFlagUrl(r.sourceCurrency);
              const isActive = value === r.sourceCurrency;
              return (
                <button
                  key={r.sourceCurrency}
                  type="button"
                  onClick={() => handleSelect(r.sourceCurrency)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors ${
                    isActive ? "bg-primary/[0.06] text-primary" : "hover:bg-muted/50"
                  }`}
                >
                  {flag && <img src={flag} alt={r.sourceCurrency} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />}
                  <span style={{ fontWeight: 600 }}>{r.sourceCurrency}</span>
                  <span className="text-muted-foreground truncate">{r.sourceCurrencyName}</span>
                  {isActive && <Check className="w-4 h-4 ml-auto text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ExchangeRateLibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { midMarketRates, standardRates, addStandardRate, updateStandardRate, deleteStandardRate } = useExchangeRates();

  const [activeTab, setActiveTab] = useState<ActiveTab>("mid-market");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sourceCurrency");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advFilters, setAdvFilters] = useState<ExchangeRateFilters>({ ...DEFAULT_EXCHANGE_RATE_FILTERS });

  /* Column management */
  const [midColOrder, setMidColOrder] = useState([...MID_DEFAULT_ORDER]);
  const [midColVis, setMidColVis] = useState({ ...MID_DEFAULT_VIS });
  const [midColWidths, setMidColWidths] = useState<Record<string, number>>({ ...MID_DEFAULT_WIDTHS });
  const [stdColOrder, setStdColOrder] = useState([...STD_DEFAULT_ORDER]);
  const [stdColVis, setStdColVis] = useState({ ...STD_DEFAULT_VIS });
  const [stdColWidths, setStdColWidths] = useState<Record<string, number>>({ ...STD_DEFAULT_WIDTHS });
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  /* Column resize */
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  /* Expanded row inversion state — tracks which expanded rows are showing inverted view */
  const [invertedRows, setInvertedRows] = useState<Set<string>>(new Set());
  /* Global inversion toggle via column header swap icons */
  const [globalInverted, setGlobalInverted] = useState(false);

  const toggleRowExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const toggleRowInvert = useCallback((id: string) => {
    setInvertedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGlobalInvert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalInverted(prev => !prev);
  }, []);

  /* Row selection */
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  /* Modal for add/edit standard rate */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StandardRate | null>(null);
  const [modalForm, setModalForm] = useState({
    sourceCurrency: "",
    standardRate: "",
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; rate: StandardRate | null }>({ open: false, rate: null });

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  useEffect(() => {
    setQuickFilter("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setSortKey("sourceCurrency");
    setSortDir("asc");
    setCurrentPage(1);
    setSelectedRows(new Set());
    setAdvFilters({ ...DEFAULT_EXCHANGE_RATE_FILTERS });
  }, [activeTab]);

  const midCount = midMarketRates.filter(r => r.status === "active").length;
  const stdCount = standardRates.length;

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
  const setColOrderRef = useRef<React.Dispatch<React.SetStateAction<string[]>>>(setMidColOrder);

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
        setColOrderRef.current((prev: string[]) => {
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

  const getQuickFilterCount = useCallback((filter: QuickFilter): number => {
    if (activeTab === "mid-market") {
      switch (filter) {
        case "active": return midMarketRates.filter(r => r.status === "active").length;
        case "inactive": return midMarketRates.filter(r => r.status === "inactive").length;
        case "archived": return 0;
        default: return midMarketRates.length;
      }
    } else {
      switch (filter) {
        case "active": return standardRates.filter(r => r.status === "active").length;
        case "archived": return standardRates.filter(r => r.status === "archived").length;
        // "Show All" excludes archived — archived rates only surface via the Archived pill
        default: return standardRates.filter(r => r.status !== "archived").length;
      }
    }
  }, [activeTab, midMarketRates, standardRates]);

  const pinnedMidRow = useMemo(
    () => midMarketRates.find(r => r.sourceCurrency === BASE_CURRENCY) ?? null,
    [midMarketRates]
  );

  const filteredMid = useMemo(() => {
    let list = midMarketRates.filter(r => r.sourceCurrency !== BASE_CURRENCY);
    if (quickFilter === "active") list = list.filter(r => r.status === "active");
    if (quickFilter === "inactive") list = list.filter(r => r.status === "inactive");
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(r =>
        r.sourceCurrency.toLowerCase().includes(q) ||
        r.sourceCurrencyName.toLowerCase().includes(q) ||
        getCountryName(r.sourceCurrency).toLowerCase().includes(q)
      );
    }
    if (advFilters.regions.length > 0) list = list.filter(r => currencyMatchesExchangeRateRegionFilter(r.sourceCurrency, advFilters.regions));
    return list;
  }, [midMarketRates, quickFilter, debouncedSearch, advFilters.regions]);

  const filteredStd = useMemo(() => {
    let list = [...standardRates];
    // Archived rates surface only when explicitly requested via the Archived pill.
    // Inactive is no longer a valid corporate-rate state — only Active/Archived.
    if (quickFilter === "archived") list = list.filter(r => r.status === "archived");
    else if (quickFilter === "active") list = list.filter(r => r.status === "active");
    else list = list.filter(r => r.status !== "archived");
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(r =>
        r.sourceCurrency.toLowerCase().includes(q) ||
        r.sourceCurrencyName.toLowerCase().includes(q) ||
        getCountryName(r.sourceCurrency).toLowerCase().includes(q)
      );
    }
    if (advFilters.regions.length > 0) list = list.filter(r => currencyMatchesExchangeRateRegionFilter(r.sourceCurrency, advFilters.regions));
    return list;
  }, [standardRates, quickFilter, debouncedSearch, advFilters.regions]);

  const currentList = activeTab === "mid-market" ? filteredMid : filteredStd;

  const sorted = useMemo(() => {
    const list = [...currentList];
    list.sort((a, b) => {
      let cmp = 0;
      const valA = (a as unknown as Record<string, unknown>)[sortKey];
      const valB = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof valA === "string" && typeof valB === "string") cmp = valA.localeCompare(valB);
      else if (typeof valA === "number" && typeof valB === "number") cmp = valA - valB;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [currentList, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / recordsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const paged = sorted.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const highlightText = useCallback((text: string) => {
    if (!searchQuery.trim()) return <>{text}</>;
    const regex = new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    if (parts.length === 1) return <>{text}</>;
    return <>{parts.map((part, i) => i % 2 === 1 ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark> : <span key={i}>{part}</span>)}</>;
  }, [searchQuery]);

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const hasAnyFilter = !!searchQuery || quickFilter !== "all" || advFilters.regions.length > 0;
  const activeFilterCount = countActiveExchangeRateFilters(advFilters);
  const allCurrencyCodes = useMemo(() => {
    if (activeTab === "mid-market") return midMarketRates.map(r => r.sourceCurrency);
    return standardRates.map(r => r.sourceCurrency);
  }, [activeTab, midMarketRates, standardRates]);
  const clearAllFilters = () => {
    setSearchQuery("");
    setQuickFilter("all");
    setAdvFilters({ ...DEFAULT_EXCHANGE_RATE_FILTERS });
    setCurrentPage(1);
  };

  /* ─── Row selection helpers ─── */
  const allPageSelected = paged.length > 0 && paged.every(r => selectedRows.has(r.id));
  const somePageSelected = paged.some(r => selectedRows.has(r.id));

  const handleSelectAll = useCallback(() => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paged.forEach(r => next.delete(r.id));
      } else {
        paged.forEach(r => next.add(r.id));
      }
      return next;
    });
  }, [allPageSelected, paged]);

  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ─── Duplicate detection for add modal ─── */
  const existingRateForSelected = useMemo(() => {
    if (editingRate || !modalForm.sourceCurrency) return null;
    return standardRates.find(r => r.sourceCurrency === modalForm.sourceCurrency && r.status === "active") || null;
  }, [modalForm.sourceCurrency, standardRates, editingRate]);

  /* ─── Modal handlers ─── */
  const openAddModal = useCallback((prefillCurrency?: string) => {
    setEditingRate(null);
    setModalForm({
      sourceCurrency: prefillCurrency || "",
      standardRate: "",
      effectiveDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setModalOpen(true);
  }, []);

  // Pre-fill the Add Corporate Rate modal when arriving with ?addCorp=CODE.
  // The Currency Detail converter's "Set Corporate Rate" CTA points here so
  // users can drop straight into the right form.
  useEffect(() => {
    const code = searchParams.get("addCorp");
    if (!code) return;
    setActiveTab("standard");
    openAddModal(code.toUpperCase());
    const next = new URLSearchParams(searchParams);
    next.delete("addCorp");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openAddModal]);

  const openEditModal = (rate: StandardRate) => {
    setEditingRate(rate);
    setModalForm({
      sourceCurrency: rate.sourceCurrency,
      standardRate: String(rate.standardRate),
      effectiveDate: rate.effectiveDate,
      notes: rate.notes,
    });
    setModalOpen(true);
  };

  const handleModalSave = () => {
    const rateVal = parseFloat(modalForm.standardRate);
    if (!modalForm.sourceCurrency || isNaN(rateVal) || rateVal <= 0 || !modalForm.effectiveDate) {
      toast.error("Please fill all required fields with valid values");
      return;
    }
    const mid = midMarketRates.find(r => r.sourceCurrency === modalForm.sourceCurrency);
    const midRate = mid?.rate || 0;
    const variance = midRate > 0 ? +((rateVal - midRate) / midRate * 100).toFixed(2) : 0;

    if (editingRate) {
      updateStandardRate(editingRate.id, {
        standardRate: rateVal,
        effectiveDate: modalForm.effectiveDate,
        notes: modalForm.notes,
        midMarketRate: midRate,
        variance,
      });
      toast.success(`Corporate rate for ${modalForm.sourceCurrency} updated`);
    } else {
      addStandardRate({
        baseCurrency: BASE_CURRENCY,
        sourceCurrency: modalForm.sourceCurrency,
        sourceCurrencyName: mid?.sourceCurrencyName || modalForm.sourceCurrency,
        standardRate: rateVal,
        midMarketRate: midRate,
        variance,
        effectiveDate: modalForm.effectiveDate,
        createdBy: "Ahtisham Ahmad",
        notes: modalForm.notes,
        status: "active",
      });
      toast.success(`Corporate rate for ${modalForm.sourceCurrency} created`);
    }
    setModalOpen(false);
  };

  const handleArchiveRate = () => {
    if (!deleteDialog.rate) return;
    deleteStandardRate(deleteDialog.rate.id);
    toast.success(`Corporate rate for ${deleteDialog.rate.sourceCurrency} archived`);
    setDeleteDialog({ open: false, rate: null });
  };

  type ExportFormat = "csv" | "xlsx" | "pdf";
  const exportStandardRates = (
    rows: StandardRate[],
    baseName: string,
    fmt: ExportFormat
  ) => {
    const headers = [
      "Base Currency",
      "Source Currency",
      "Corporate Exchange Rate",
      "Mid-Market Exchange Rate",
      "Variance",
      "Effective Date",
      "Created By",
    ];
    const data = rows.map(r => [
      r.baseCurrency,
      r.sourceCurrency,
      String(r.standardRate),
      String(r.midMarketRate),
      `${r.variance}%`,
      r.effectiveDate,
      r.createdBy,
    ]);

    if (fmt === "csv") {
      const esc = (v: string) =>
        /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      const text = [headers.map(esc).join(","), ...data.map(r => r.map(esc).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (fmt === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws["!cols"] = [
        { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Corporate Rates");
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Corporate Exchange Rates", 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${rows.length} rates · Exported ${format(new Date(), "dd MMM yyyy, HH:mm")}`,
        40,
        56,
      );
      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 72,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [10, 119, 255], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      });
      doc.save(`${baseName}.pdf`);
    }
    toast.success(`${fmt.toUpperCase()} exported`);
  };

  const liveVariance = useMemo(() => {
    const rateVal = parseFloat(modalForm.standardRate);
    if (isNaN(rateVal) || !modalForm.sourceCurrency) return null;
    const mid = midMarketRates.find(r => r.sourceCurrency === modalForm.sourceCurrency);
    if (!mid || mid.rate === 0) return null;
    return +((rateVal - mid.rate) / mid.rate * 100).toFixed(2);
  }, [modalForm.standardRate, modalForm.sourceCurrency, midMarketRates]);

  const midRef = midMarketRates.find(r => r.sourceCurrency === modalForm.sourceCurrency);
  const quickFilters = activeTab === "mid-market" ? QUICK_FILTERS_MID : QUICK_FILTERS_STD;

  // Column management
  const colDefs = activeTab === "mid-market" ? MID_COLUMN_DEFS : STD_COLUMN_DEFS;
  const colOrder = activeTab === "mid-market" ? midColOrder : stdColOrder;
  const colVis = activeTab === "mid-market" ? midColVis : stdColVis;
  const colWidths = activeTab === "mid-market" ? midColWidths : stdColWidths;
  const setColOrder = activeTab === "mid-market" ? setMidColOrder : setStdColOrder;
  setColOrderRef.current = setColOrder;
  const setColVis = activeTab === "mid-market" ? setMidColVis : setStdColVis;
  const setColWidths = activeTab === "mid-market" ? setMidColWidths : setStdColWidths;

  // Mirrors CurrencyListPage.handleResizeStart exactly — captures the setter from
  // the active-tab closure, reads startWidth from the current widths, and commits
  // via the setter's functional form so it stays correct under rapid state updates.
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidths[columnKey] ?? parseInt(colDefs.find(c => c.key === columnKey)?.minWidth ?? "160", 10);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
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
  }, [colWidths, colDefs, setColWidths]);

  const visibleColumns = useMemo(() => {
    const validKeys = new Set(colDefs.map(c => c.key));
    const ordered = colOrder.filter(k => validKeys.has(k) && colVis[k] !== false);
    if (!ordered.includes("sourceCurrency")) ordered.unshift("sourceCurrency");
    else if (ordered[0] !== "sourceCurrency") {
      const idx = ordered.indexOf("sourceCurrency");
      ordered.splice(idx, 1);
      ordered.unshift("sourceCurrency");
    }
    return ordered;
  }, [colOrder, colVis, colDefs]);

  const colDef = (key: string) => colDefs.find(c => c.key === key)!;

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd MMM yyyy"); } catch { return dateStr; }
  };

  const isRelaxed = density === "comfort";

  /* ─── Backdating validation for effective date ─── */
  const effectiveDateWarning = useMemo(() => {
    if (!modalForm.sourceCurrency || !modalForm.effectiveDate) return null;
    const existing = standardRates.find(r => r.sourceCurrency === modalForm.sourceCurrency && r.status === "active");
    if (!existing) return null; // new currency pair — allow any date
    const selectedDate = new Date(modalForm.effectiveDate);
    const existingDate = new Date(existing.effectiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < existingDate) {
      return { type: "block" as const, message: `Cannot set a date before the current rate's effective date (${formatDate(existing.effectiveDate)}).` };
    }
    if (selectedDate < today && selectedDate >= existingDate) {
      return { type: "warn" as const, message: `Setting a past effective date means this rate applies retroactively from ${formatDate(modalForm.effectiveDate)}. Transactions processed between ${formatDate(modalForm.effectiveDate)} and today may have used a different rate.` };
    }
    return null;
  }, [modalForm.sourceCurrency, modalForm.effectiveDate, standardRates]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] [&_::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button onClick={() => navigate("/accounting")} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Accounting
          </button>
          <span className="text-muted-foreground">/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">Exchange Rate Library</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
            <span className="text-[11px]" style={{ fontWeight: 600, color: '#0A77FF' }}>AA</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Product Designer</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col">
          {/* Page Header */}
          <div className="flex flex-col gap-1 mb-0 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                  <ArrowLeftRight className="w-4 h-4" style={{ color: '#059669' }} />
                </div>
                <h1 className="font-bold text-[20px]">Exchange Rate Library</h1>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === "standard" && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          Export
                          <ChevronDown className="w-3 h-3 text-muted-foreground/70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onClick={() => exportStandardRates(standardRates, "standard_rates", "csv")}>
                          <FileText className="w-4 h-4 mr-2 text-muted-foreground" /> CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportStandardRates(standardRates, "standard_rates", "xlsx")}>
                          <FileSpreadsheet className="w-4 h-4 mr-2 text-muted-foreground" /> Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportStandardRates(standardRates, "standard_rates", "pdf")}>
                          <FileText className="w-4 h-4 mr-2 text-muted-foreground" /> PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button className="bg-primary text-primary-foreground shrink-0" onClick={() => openAddModal()}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Corporate Rate
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              Manage all exchange rates for your company.
            </p>
          </div>

          {/* Tab Bar */}
          <div className="-mx-6 lg:-mx-8 px-6 lg:px-8 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab("mid-market")}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
                  activeTab === "mid-market" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontWeight: activeTab === "mid-market" ? 600 : 400 }}
              >
                <Cloud className="w-4 h-4" />
                Mid-Market Rates
                <span className={`ml-1 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 ${
                  activeTab === "mid-market" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`} style={{ fontWeight: 600 }}>
                  {midCount}
                </span>
                {activeTab === "mid-market" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("standard")}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
                  activeTab === "standard" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontWeight: activeTab === "standard" ? 600 : 400 }}
              >
                <Star className="w-4 h-4" />
                Corporate Rates
                <span className={`ml-1 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 ${
                  activeTab === "standard" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`} style={{ fontWeight: 600 }}>
                  {stdCount}
                </span>
                {activeTab === "standard" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                )}
              </button>
            </div>
          </div>

          {/* Tab-specific explanatory block — soft background, left accent.
             Swaps copy based on the active tab and uses the shared standard
             phrasing from rateCopy so wording stays in sync everywhere. */}
          <div
            className="mt-3 rounded-lg border-l-[3px] flex items-start gap-3 px-4 py-3"
            style={{
              backgroundColor: activeTab === "mid-market" ? "#F5F3FF" : "#FFFBEB",
              borderLeftColor: activeTab === "mid-market" ? "#7C3AED" : "#D97706",
            }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: activeTab === "mid-market" ? "#EDE9FE" : "#FEF3C7" }}
            >
              {activeTab === "mid-market" ? (
                <Cloud className="w-4 h-4" style={{ color: "#7C3AED" }} />
              ) : (
                <Star className="w-4 h-4" style={{ color: "#D97706" }} />
              )}
            </div>
            <div className="min-w-0 text-[12px] leading-snug text-[#475569]">
              {activeTab === "mid-market"
                ? EXPLANATORY_BLOCKS.midMarket
                : EXPLANATORY_BLOCKS.corporate}
            </div>
          </div>

          {/* Unified Table Container */}
          <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip mt-3">
            <div className="flex-1 min-w-0 flex flex-col overflow-clip">
              {/* Row 1: Search + Filters ... Count + Density + Column Manager */}
              <div className={`flex items-center justify-between gap-3 px-4 pt-3.5 shrink-0 ${quickFilters.length === 0 && !(selectedRows.size > 0 && activeTab === "standard") ? "pb-3" : "pb-2"}`}>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      placeholder="Search by currency code or name..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                    />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Filter button */}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer ${
                      activeFilterCount > 0
                        ? "border-primary/30 bg-[#EDF4FF] text-primary hover:bg-[#D6E8FF]"
                        : "border-border/80 bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                    {activeFilterCount > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center px-1 text-white"
                        style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {hasAnyFilter && (
                    <button type="button" onClick={clearAllFilters} className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="text-sm" style={{ fontWeight: 500 }}>Reset</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                   <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                    <span className="text-foreground">{sorted.length + (activeTab === "mid-market" && pinnedMidRow ? 1 : 0)}</span>
                    <span className="text-muted-foreground/70"> rates</span>
                  </span>
                  {activeTab === "mid-market" && (
                    <span className="text-[11px] text-muted-foreground hidden sm:inline ml-1" style={{ fontWeight: 500 }}>
                      · Synced every 24h from {API_PROVIDER} · Updated as of {format(new Date(LAST_SYNC), "dd MMM yyyy")} at {format(new Date(LAST_SYNC), "HH:mm")} PKT
                    </span>
                  )}

                  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                  {/* Density dropdown */}
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
                      {DENSITY_CONFIG.map(opt => (
                        <DropdownMenuItem
                          key={opt.key}
                          className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                          onSelect={() => setDensity(opt.key)}
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
                                    cardSize === size
                                      ? "bg-[#0A77FF] text-white shadow-sm"
                                      : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
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

                  {/* Column Manager */}
                  <ColumnSelectorTrigger
                    visibleCount={visibleColumns.length}
                    active={columnDrawerOpen}
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />
                </div>
              </div>

              {(quickFilters.length > 0 || (selectedRows.size > 0 && activeTab === "standard")) && (
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 min-h-[36px]" style={{ scrollbarWidth: "none" }}>
                {selectedRows.size > 0 && activeTab === "standard" ? (
                  /* Bulk Action Bar */
                  <>
                    <span className="text-[13px] text-muted-foreground mr-2 shrink-0" style={{ fontWeight: 500 }}>
                      {selectedRows.size} selected
                    </span>
                    <button
                      onClick={() => {
                        const ids = Array.from(selectedRows);
                        ids.forEach(id => deleteStandardRate(id));
                        setSelectedRows(new Set());
                        toast.success(`${ids.length} rate(s) archived`);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      style={{ fontWeight: 500 }}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                    <button
                      onClick={() => setSelectedRows(new Set())}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-muted-foreground text-[13px] hover:bg-muted/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  quickFilters.map(filter => {
                    const isActive = quickFilter === filter.key;
                    const count = getQuickFilterCount(filter.key);
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
                            className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                              isActive ? "bg-primary/10" : "bg-muted"
                            }`}
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
              )}

              {/* Divider */}
              <div className="border-t border-border shrink-0" />

              {density === "card" ? (
                /* Card View */
                <div className="p-4 min-h-0 overflow-y-auto flex-1">
                  {paged.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <ArrowLeftRight className="w-8 h-8" />
                      <p className="text-sm">No rates found</p>
                      {hasAnyFilter && <Button variant="link" size="sm" onClick={clearAllFilters}>Clear all filters</Button>}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${
                      cardSize === "large" ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" :
                      cardSize === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }`}>
                      {paged.map(r => {
                        const isMid = activeTab === "mid-market";
                        const rate = isMid ? (r as MidMarketRate) : (r as StandardRate);
                        return (
                          <div
                            key={r.id}
                            className={`bg-card border border-border rounded-xl cursor-pointer hover:shadow-md hover:border-primary/20 transition-all ${
                              cardSize === "large" ? "p-5" : cardSize === "small" ? "p-3" : "p-4"
                            }`}
                            onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=${isMid ? "mid" : "std"}`)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary" style={{ fontWeight: 600 }}>{r.sourceCurrency}</span>
                                <span className="text-[12px]">{r.sourceCurrencyName}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>{isMid ? "Mid-Market Exchange Rate" : "Corporate Exchange Rate"}</span>
                                <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                                  {isMid ? (r as MidMarketRate).rate.toFixed(4) : (r as StandardRate).standardRate.toFixed(4)}
                                </span>
                              </div>
                              {isMid && (
                                <div className="flex justify-between">
                                  <span>24h Change</span>
                                  <span className={`tabular-nums ${(r as MidMarketRate).change24h > 0 ? "text-emerald-600" : (r as MidMarketRate).change24h < 0 ? "text-red-500" : "text-muted-foreground"}`} style={{ fontWeight: 500 }}>
                                    {(r as MidMarketRate).change24h > 0 ? "+" : ""}{(r as MidMarketRate).change24h.toFixed(2)}%
                                  </span>
                                </div>
                              )}
                              {!isMid && (
                                <div className="flex justify-between">
                                  <span>Variance</span>
                                  <span className="tabular-nums" style={{ fontWeight: 500 }}>
                                    {(r as StandardRate).variance > 0 ? "+" : ""}{(r as StandardRate).variance.toFixed(2)}%
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Effective</span>
                                <span className="text-foreground">{formatDate(r.effectiveDate)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Table View */
                <div className={`min-h-0 overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`} style={{ scrollbarWidth: "none" }}>
                  <Table style={{ tableLayout: "fixed", minWidth: `${CHEVRON_COL_WIDTH + (activeTab === "standard" ? CHECKBOX_COL_WIDTH : 0) + visibleColumns.reduce((sum, key) => sum + (colWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + ACTIONS_COL_WIDTH}px`, width: "100%" }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                        density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"
                      }`}>
                        {/* Expand chevron column — sticky leftmost on Corporate tab */}
                        <TableHead
                          className={`w-[36px] min-w-[36px] max-w-[36px] !pl-2 !pr-0 ${
                            activeTab === "standard" ? "sticky left-0 z-30 bg-[#F4F6F9]" : ""
                          }`}
                        />
                        {/* Checkbox column — corporate rates only; sticky after chevron */}
                        {activeTab === "standard" && (
                        <TableHead className="w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 sticky left-[36px] z-30 bg-[#F4F6F9]">
                          <Checkbox
                            checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all rows"
                          />
                        </TableHead>
                        )}
                        {visibleColumns.map(key => {
                          const def = colDef(key);
                          if (!def) return null;
                          const currentColSort: "asc" | "desc" | null = sortKey === key ? sortDir : null;
                          const isDraggable = !LOCKED_COLUMNS.includes(key);
                          const isBeingDragged = draggingColumnKey === key;
                          const width = colWidths[key] ?? parseInt(def.minWidth, 10);
                          // On the Corporate tab, the first data column (sourceCurrency) stays
                          // frozen after the chevron (36px) and checkbox (40px) sticky columns.
                          const isFrozenLeftHeader = activeTab === "standard" && key === "sourceCurrency";
                          return (
                            <TableHead
                              key={key}
                              data-col-drag-key={key}
                              onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                              onClickCapture={isDraggable ? (e) => {
                                if (suppressNextClickRef.current) { e.stopPropagation(); e.preventDefault(); return; }
                              } : undefined}
                              className={`whitespace-nowrap select-none hover:bg-muted/30 transition-colors group/colheader relative ${def.align === "right" ? "text-right" : ""} ${isDraggable ? "cursor-grab" : "cursor-default"} ${isBeingDragged ? "opacity-30" : ""} ${isFrozenLeftHeader ? "sticky z-30 bg-[#F4F6F9]" : ""}`}
                              style={{
                                width: `${width}px`,
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                                overflow: "hidden",
                                ...(isFrozenLeftHeader
                                  ? {
                                      left: `${CHEVRON_COL_WIDTH + CHECKBOX_COL_WIDTH}px`,
                                      boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)",
                                    }
                                  : {}),
                              }}
                              onClick={() => def.sortable && !suppressNextClickRef.current && handleSort(key)}
                            >
                              {isDraggable && (
                                <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                              )}
                              <div className={`flex items-center gap-1 ${def.align === "right" ? "justify-end" : ""}`}>
                                <span className="text-[13px] truncate" style={currentColSort ? { color: "#0A77FF" } : undefined}>
                                  {def.label}
                                </span>
                                {(() => {
                                  const tip =
                                    key === "inverseRate" || key === "inverseStdRate"
                                      ? RATE_TOOLTIPS.inverse
                                      : key === "rate" || key === "midMarketRate"
                                      ? RATE_TOOLTIPS.midMarket
                                      : key === "standardRate"
                                      ? RATE_TOOLTIPS.corporate
                                      : key === "baseCurrency"
                                      ? RATE_TOOLTIPS.baseCurrency
                                      : key === "sourceCurrency"
                                      ? RATE_TOOLTIPS.sourceCurrency
                                      : key === "change24h"
                                      ? RATE_TOOLTIPS.change24h
                                      : key === "variance"
                                      ? RATE_TOOLTIPS.variance
                                      : key === "effectiveDate"
                                      ? RATE_TOOLTIPS.effectiveDate
                                      : null;
                                  if (!tip) return null;
                                  return (
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex shrink-0"
                                            onClick={e => e.stopPropagation()}
                                          >
                                            <Info className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[300px] text-[11.5px] whitespace-pre-line">
                                          {tip}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
                                {def.sortable && (
                                  currentColSort === "asc" ? <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} /> :
                                  currentColSort === "desc" ? <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} /> :
                                  <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                )}
                              </div>
                              {/* Resize handle */}
                              <div
                                onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setColWidths(prev => ({ ...prev, [key]: parseInt(def.minWidth, 10) }));
                                }}
                                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                                style={{ touchAction: "none" }}
                              >
                                <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead
                          className={`whitespace-nowrap w-[60px] !pl-2 !pr-2 ${
                            activeTab === "standard" ? "sticky right-0 z-30 bg-[#F4F6F9]" : ""
                          }`}
                          style={
                            activeTab === "standard"
                              ? { boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08), -3px 0 6px -2px rgba(0,0,0,0.06)" }
                              : undefined
                          }
                        >
                          <span className="text-[13px]">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTab === "standard" && paged.length > 0 && (() => {
                        const baseFlag = getFlagUrl(BASE_CURRENCY);
                        const colSpan = visibleColumns.length + 3;
                        return (
                          <TableRow className="hover:bg-transparent" style={{ backgroundColor: "#fffbf2" }}>
                            <TableCell colSpan={colSpan} className="!py-2.5 !px-4" style={{ borderLeft: "3px solid #e65100" }}>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                {baseFlag && <img src={baseFlag} alt={BASE_CURRENCY} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />}
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0" style={{ fontWeight: 600 }}>{BASE_CURRENCY}</span>
                                <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>{BASE_CURRENCY_NAME}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7" }}>Base</span>
                                <span className="text-[11.5px] text-muted-foreground" style={{ fontWeight: 500 }}>All exchange rates below are quoted against this currency.</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                      {activeTab === "mid-market" && pinnedMidRow && (() => {
                        const r = pinnedMidRow;
                        const isExpanded = expandedRows.has(r.id);
                        const isInverted = invertedRows.has(r.id) !== globalInverted;
                        const flagUrl = getFlagUrl(r.sourceCurrency);
                        const baseFlagUrl = getFlagUrl(r.baseCurrency);
                        const fromAmount = isInverted ? (1 / r.rate) : 1;
                        const toAmount = isInverted ? 1 : r.rate;
                        const colSpan = visibleColumns.length + 2;
                        const PINNED_BG = "#fffbf2";
                        const PINNED_BORDER = "3px solid #e65100";
                        return (
                          <React.Fragment key={`pinned-${r.id}`}>
                            <TableRow
                              className={`cursor-pointer group ${
                                density === "condensed" ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                              }`}
                              style={{ backgroundColor: PINNED_BG }}
                              onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=mid`)}
                            >
                              <TableCell
                                className="w-[36px] min-w-[36px] max-w-[36px] !pl-2 !pr-0"
                                style={{ borderLeft: PINNED_BORDER }}
                                onClick={e => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => toggleRowExpand(r.id, e)}
                                  aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-transparent text-muted-foreground hover:bg-amber-100/60 hover:text-foreground hover:border-amber-200 transition-colors cursor-pointer"
                                >
                                  <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                                </button>
                              </TableCell>
                              {visibleColumns.map(key => {
                                switch (key) {
                                  case "sourceCurrency":
                                    return (
                                      <TableCell key={key}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />}
                                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0" style={{ fontWeight: 600 }}>{r.sourceCurrency}</span>
                                          <span className={`${isRelaxed ? "text-[13.5px]" : "text-[12px]"} truncate min-w-0`}>{r.sourceCurrencyName}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ fontWeight: 600, color: "#92400E", backgroundColor: "#FEF3C7" }}>Base</span>
                                        </div>
                                      </TableCell>
                                    );
                                  case "rate":
                                    return (
                                      <TableCell key={key} className="text-right tabular-nums">
                                        <span className={isRelaxed ? "text-[13.5px]" : "text-[13px]"} style={{ fontWeight: 700 }}>{r.rate.toFixed(4)}</span>
                                      </TableCell>
                                    );
                                  case "inverseRate":
                                    return (
                                      <TableCell key={key} className="text-right tabular-nums">
                                        <span className={isRelaxed ? "text-[13.5px]" : "text-[13px]"} style={{ fontWeight: 500, color: "#64748B" }}>{(1 / r.rate).toFixed(6)}</span>
                                      </TableCell>
                                    );
                                  case "change24h":
                                    return (
                                      <TableCell key={key} className="text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                                          <span className="text-[12px] tabular-nums text-muted-foreground" style={{ fontWeight: 500 }}>
                                            {r.change24h.toFixed(2)}%
                                          </span>
                                        </div>
                                      </TableCell>
                                    );
                                  default:
                                    return <TableCell key={key}>—</TableCell>;
                                }
                              })}
                              <TableCell onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Row actions"
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:bg-amber-100/60 hover:text-foreground hover:border-amber-200 data-[state=open]:bg-amber-100/60 data-[state=open]:border-amber-200 transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[200px]">
                                    <DropdownMenuItem onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=mid`)}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-transparent" style={{ backgroundColor: PINNED_BG }}>
                              <TableCell colSpan={colSpan} className="!py-1.5 !px-4" style={{ borderLeft: PINNED_BORDER }}>
                                <span className="text-[11.5px] text-muted-foreground" style={{ fontWeight: 500 }}>
                                  All exchange rates below are quoted against this currency.
                                </span>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-[#F8FBFF] hover:bg-[#F8FBFF] border-b border-border">
                                <TableCell colSpan={colSpan} className="!py-4 !px-4">
                                  <div className="flex items-center gap-4 pl-10">
                                    <div>
                                      <p className="text-[11px] text-emerald-600 mb-1.5" style={{ fontWeight: 600 }}>From</p>
                                      <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                        {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[13px]" style={{ fontWeight: 600 }}>{r.sourceCurrency} <span style={{ fontWeight: 400 }}>{r.sourceCurrencyName}</span></p>
                                          <p className="text-[11px] text-muted-foreground">{getCountryName(r.sourceCurrency)}</p>
                                        </div>
                                        <div className="border-l border-border pl-3 ml-2">
                                          <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                          <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{fromAmount.toFixed(isInverted ? 6 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleRowInvert(r.id); }}
                                      aria-pressed={isInverted}
                                      aria-label={isInverted ? "Restore default direction" : "Swap direction"}
                                      className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-5 transition-colors cursor-pointer ${
                                        isInverted
                                          ? "bg-[#0A77FF] text-white border border-[#0A77FF] hover:bg-[#0862D0]"
                                          : "bg-white text-muted-foreground border border-border hover:bg-muted/60"
                                      }`}
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                    </button>
                                    <div>
                                      <p className="text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>To</p>
                                      <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                        {baseFlagUrl && <img src={baseFlagUrl} alt={BASE_CURRENCY} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[13px]" style={{ fontWeight: 600 }}>{BASE_CURRENCY} <span style={{ fontWeight: 400 }}>{BASE_CURRENCY_NAME}</span></p>
                                          <p className="text-[11px] text-muted-foreground">{getCountryName(BASE_CURRENCY)}</p>
                                        </div>
                                        <div className="border-l border-border pl-3 ml-2">
                                          <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                          <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{toAmount.toFixed(isInverted ? 0 : 4).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })()}
                      {paged.length === 0 && !(activeTab === "mid-market" && pinnedMidRow && debouncedSearch && (
                        pinnedMidRow.sourceCurrency.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                        pinnedMidRow.sourceCurrencyName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                        getCountryName(pinnedMidRow.sourceCurrency).toLowerCase().includes(debouncedSearch.toLowerCase())
                      )) ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns.length + (activeTab === "standard" ? 3 : 2)} className="text-center py-16 text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <ArrowLeftRight className="w-8 h-8" />
                              <p className="text-sm">No rates found matching your criteria.</p>
                              {hasAnyFilter && <Button variant="link" size="sm" onClick={clearAllFilters}>Clear all filters</Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : paged.length === 0 ? null : activeTab === "mid-market" ? (
                        (paged as MidMarketRate[]).map(r => {
                          const isExpanded = expandedRows.has(r.id);
                          const isInverted = invertedRows.has(r.id) !== globalInverted;
                          const flagUrl = getFlagUrl(r.sourceCurrency);
                          const baseFlagUrl = getFlagUrl(r.baseCurrency);
                          // Normal: 1 source = rate base. Inverted: inverseRate source = 1 base.
                          const fromAmount = isInverted ? (1 / r.rate) : 1;
                          const toAmount = isInverted ? 1 : r.rate;
                          return (
                          <React.Fragment key={r.id}>
                          <TableRow
                            className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                              density === "condensed" ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                            } ${isExpanded ? "bg-[#F8FBFF]" : ""}`}
                            onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=mid`)}
                          >
                            {/* Chevron — separate click target with its own hover */}
                            <TableCell className="w-[36px] min-w-[36px] max-w-[36px] !pl-2 !pr-0" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => toggleRowExpand(r.id, e)}
                                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground hover:border-slate-200 transition-colors cursor-pointer"
                              >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            </TableCell>
                            {visibleColumns.map(key => {
                              switch (key) {
                                case "sourceCurrency":
                                  return (
                                    <TableCell key={key}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />}
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0" style={{ fontWeight: 600 }}>{highlightText(r.sourceCurrency)}</span>
                                        <TooltipProvider delayDuration={300}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className={`${isRelaxed ? "text-[13.5px]" : "text-[12px]"} truncate min-w-0`}>
                                                {highlightText(r.sourceCurrencyName)}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[11.5px]">{r.sourceCurrencyName}</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </TableCell>
                                  );
                                case "rate":
                                  return (
                                    <TableCell key={key} className="text-right tabular-nums">
                                      <span className={isRelaxed ? "text-[13.5px]" : "text-[13px]"} style={{ fontWeight: 700 }}>{r.rate.toFixed(4)}</span>
                                    </TableCell>
                                  );
                                case "inverseRate":
                                  return (
                                    <TableCell key={key} className="text-right tabular-nums">
                                      <span className={isRelaxed ? "text-[13.5px]" : "text-[13px]"} style={{ fontWeight: 500, color: "#64748B" }}>{(1 / r.rate).toFixed(6)}</span>
                                    </TableCell>
                                  );
                                case "change24h":
                                  return (
                                    <TableCell key={key} className="text-right">
                                      <div className="flex items-center gap-1 justify-end">
                                        {r.change24h > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : r.change24h < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                                        <span className={`text-[12px] tabular-nums ${r.change24h > 0 ? "text-emerald-600" : r.change24h < 0 ? "text-red-500" : "text-muted-foreground"}`} style={{ fontWeight: 500 }}>
                                          {r.change24h > 0 ? "+" : ""}{r.change24h.toFixed(2)}%
                                        </span>
                                      </div>
                                    </TableCell>
                                  );
                                default:
                                  return <TableCell key={key}>—</TableCell>;
                              }
                            })}
                            <TableCell onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Row actions"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground hover:border-slate-200 data-[state=open]:bg-slate-100 data-[state=open]:border-slate-200 transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                  <DropdownMenuItem onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=mid`)}>
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          {/* Expanded detail row */}
                          {isExpanded && (
                            <TableRow className="bg-[#F8FBFF] hover:bg-[#F8FBFF] border-b border-border">
                              <TableCell colSpan={visibleColumns.length + 2} className="!py-4 !px-4">
                                <div className="flex items-center gap-4 pl-10">
                                  {/* From card — always source currency */}
                                  <div>
                                    <p className="text-[11px] text-emerald-600 mb-1.5" style={{ fontWeight: 600 }}>From</p>
                                    <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                      {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px]" style={{ fontWeight: 600 }}>{r.sourceCurrency} <span style={{ fontWeight: 400 }}>{r.sourceCurrencyName}</span></p>
                                        <p className="text-[11px] text-muted-foreground">{getCountryName(r.sourceCurrency)}</p>
                                      </div>
                                      <div className="border-l border-border pl-3 ml-2">
                                        <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                        <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{fromAmount.toFixed(isInverted ? 6 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Swap icon — accent fill when inverse view is active */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleRowInvert(r.id); }}
                                    aria-pressed={isInverted}
                                    aria-label={isInverted ? "Restore default direction" : "Swap direction"}
                                    className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-5 transition-colors cursor-pointer ${
                                      isInverted
                                        ? "bg-[#0A77FF] text-white border border-[#0A77FF] hover:bg-[#0862D0]"
                                        : "bg-white text-muted-foreground border border-border hover:bg-muted/60"
                                    }`}
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                  </button>
                                  {/* To card — always base currency */}
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>To</p>
                                    <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                      {baseFlagUrl && <img src={baseFlagUrl} alt={BASE_CURRENCY} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px]" style={{ fontWeight: 600 }}>{BASE_CURRENCY} <span style={{ fontWeight: 400 }}>{BASE_CURRENCY_NAME}</span></p>
                                        <p className="text-[11px] text-muted-foreground">{getCountryName(BASE_CURRENCY)}</p>
                                      </div>
                                      <div className="border-l border-border pl-3 ml-2">
                                        <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                        <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{toAmount.toFixed(isInverted ? 0 : 4).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {isInverted && (
                                  <div className="pl-10 mt-2" onClick={e => e.stopPropagation()}>
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] cursor-help"
                                            style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                                            tabIndex={0}
                                          >
                                            <ArrowLeftRight className="w-2.5 h-2.5" />
                                            Inverse rate
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[320px] text-[11.5px]">
                                          {INVERSE_BADGE_TOOLTIP}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                          );
                        })
                      ) : (
                        (paged as StandardRate[]).map(r => {
                          const isExpanded = expandedRows.has(r.id);
                          const isInverted = invertedRows.has(r.id) !== globalInverted;
                          const flagUrl = getFlagUrl(r.sourceCurrency);
                          const baseFlagUrl = getFlagUrl(r.baseCurrency);
                          const midRate = midMarketRates.find(m => m.sourceCurrency === r.sourceCurrency);
                          // Normal: 1 source = rate base. Inverted: inverseRate source = 1 base.
                          const fromAmount = isInverted ? (1 / r.standardRate) : 1;
                          const toAmount = isInverted ? 1 : r.standardRate;
                          return (
                          <React.Fragment key={r.id}>
                          <TableRow
                            className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                              density === "condensed" ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                            } ${isExpanded ? "bg-[#F8FBFF]" : ""}`}
                            onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=std`)}
                          >
                            {/* Chevron — sticky leftmost */}
                            <TableCell
                              className="w-[36px] min-w-[36px] max-w-[36px] !pl-2 !pr-0 sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF]"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => toggleRowExpand(r.id, e)}
                                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground hover:border-slate-200 transition-colors cursor-pointer"
                              >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            </TableCell>
                            <TableCell className="w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 sticky left-[36px] z-10 bg-card group-hover:bg-[#F0F7FF]">
                              <Checkbox
                                checked={selectedRows.has(r.id)}
                                onCheckedChange={() => handleSelectRow(r.id)}
                                onClick={e => e.stopPropagation()}
                                aria-label={`Select ${r.sourceCurrency}`}
                              />
                            </TableCell>
                            {visibleColumns.map(key => {
                              switch (key) {
                                case "sourceCurrency": {
                                  const width = colWidths["sourceCurrency"] ?? parseInt(colDef("sourceCurrency").minWidth, 10);
                                  return (
                                    <TableCell
                                      key={key}
                                      className="sticky z-10 bg-card group-hover:bg-[#F0F7FF]"
                                      style={{
                                        left: `${CHEVRON_COL_WIDTH + CHECKBOX_COL_WIDTH}px`,
                                        width: `${width}px`,
                                        minWidth: `${width}px`,
                                        maxWidth: `${width}px`,
                                        boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)",
                                      }}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-5 h-[14px] rounded-[2px] object-cover shrink-0" />}
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0" style={{ fontWeight: 600 }}>{highlightText(r.sourceCurrency)}</span>
                                        <TooltipProvider delayDuration={300}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className={`${isRelaxed ? "text-[13.5px]" : "text-[12px]"} truncate min-w-0`}>
                                                {highlightText(r.sourceCurrencyName)}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[11.5px]">{r.sourceCurrencyName}</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </TableCell>
                                  );
                                }
                                case "standardRate":
                                  return (
                                    <TableCell key={key} className="text-right tabular-nums">
                                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-[13px]"} text-primary`} style={{ fontWeight: 700 }}>{r.standardRate.toFixed(4)}</span>
                                    </TableCell>
                                  );
                                case "inverseStdRate":
                                  return (
                                    <TableCell key={key} className="text-right tabular-nums">
                                      <span className={isRelaxed ? "text-[13.5px]" : "text-[13px]"} style={{ fontWeight: 500, color: "#64748B" }}>{(1 / r.standardRate).toFixed(6)}</span>
                                    </TableCell>
                                  );
                                case "midMarketRate":
                                  return (
                                    <TableCell key={key} className="text-right tabular-nums">
                                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-[12px]"} text-muted-foreground`}>{r.midMarketRate.toFixed(4)}</span>
                                    </TableCell>
                                  );
                                case "variance":
                                  return (
                                    <TableCell key={key} className="text-right">
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full border tabular-nums ${
                                        Math.abs(r.variance) > 1
                                          ? "text-amber-700 bg-amber-50 border-amber-200"
                                          : "text-emerald-700 bg-emerald-50 border-emerald-200"
                                      }`} style={{ fontWeight: 500 }}>
                                        {r.variance > 0 ? "+" : ""}{r.variance.toFixed(2)}%
                                      </span>
                                    </TableCell>
                                  );
                                case "effectiveDate":
                                  return (
                                    <TableCell key={key} className="text-[12px] text-muted-foreground">
                                      {formatDate(r.effectiveDate)}
                                    </TableCell>
                                  );
                                case "createdBy":
                                  return <TableCell key={key} className={`${isRelaxed ? "text-[13.5px]" : "text-[12px]"}`}>{r.createdBy}</TableCell>;
                                default:
                                  return <TableCell key={key}>—</TableCell>;
                              }
                            })}
                            <TableCell
                              onClick={e => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-card group-hover:bg-[#F0F7FF]"
                              style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08), -3px 0 6px -2px rgba(0,0,0,0.06)" }}
                            >
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Row actions"
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground hover:border-slate-200 data-[state=open]:bg-slate-100 data-[state=open]:border-slate-200 transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[200px]">
                                    <DropdownMenuItem onClick={() => navigate(`/accounting/exchange-rates/${r.sourceCurrency}?type=std`)}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditModal(r)}>
                                      <Pencil className="w-4 h-4 mr-2" /> Update Rate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-amber-700 gap-2" onClick={() => setDeleteDialog({ open: true, rate: r })}>
                                      <Archive className="w-3.5 h-3.5 text-amber-600" /> Archive Rate
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expanded detail row */}
                          {isExpanded && (
                            <TableRow className="bg-[#F8FBFF] hover:bg-[#F8FBFF] border-b border-border">
                              <TableCell colSpan={visibleColumns.length + 3} className="!py-4 !px-4">
                                <div className="flex items-center gap-4 pl-16">
                                  {/* From card — always source currency */}
                                  <div>
                                    <p className="text-[11px] text-emerald-600 mb-1.5" style={{ fontWeight: 600 }}>From</p>
                                    <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                      {flagUrl && <img src={flagUrl} alt={r.sourceCurrency} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px]" style={{ fontWeight: 600 }}>{r.sourceCurrency} <span style={{ fontWeight: 400 }}>{r.sourceCurrencyName}</span></p>
                                        <p className="text-[11px] text-muted-foreground">{getCountryName(r.sourceCurrency)}</p>
                                      </div>
                                      <div className="border-l border-border pl-3 ml-2">
                                        <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                        <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{fromAmount.toFixed(isInverted ? 6 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Swap icon — accent fill when inverse view is active */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleRowInvert(r.id); }}
                                    aria-pressed={isInverted}
                                    aria-label={isInverted ? "Restore default direction" : "Swap direction"}
                                    className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-5 transition-colors cursor-pointer ${
                                      isInverted
                                        ? "bg-[#0A77FF] text-white border border-[#0A77FF] hover:bg-[#0862D0]"
                                        : "bg-white text-muted-foreground border border-border hover:bg-muted/60"
                                    }`}
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                  </button>
                                  {/* To card — always base currency */}
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>To</p>
                                    <div className="flex items-center gap-3 bg-white rounded-lg border border-border pl-4 pr-2 py-3 min-w-[280px]">
                                      {baseFlagUrl && <img src={baseFlagUrl} alt={BASE_CURRENCY} className="w-8 h-[22px] rounded-[3px] object-cover shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[13px]" style={{ fontWeight: 600 }}>{BASE_CURRENCY} <span style={{ fontWeight: 400 }}>{BASE_CURRENCY_NAME}</span></p>
                                        <p className="text-[11px] text-muted-foreground">{getCountryName(BASE_CURRENCY)}</p>
                                      </div>
                                      <div className="border-l border-border pl-3 ml-2">
                                        <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Amount</p>
                                        <p key={isInverted ? "inv" : "std"} className="text-[15px] tabular-nums animate-fade-in" style={{ fontWeight: 700 }}>{toAmount.toFixed(isInverted ? 0 : 4).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {isInverted && (
                                  <div className="pl-16 mt-2" onClick={e => e.stopPropagation()}>
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] cursor-help"
                                            style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                                            tabIndex={0}
                                          >
                                            <ArrowLeftRight className="w-2.5 h-2.5" />
                                            Inverse rate
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[320px] text-[11.5px]">
                                          {INVERSE_BADGE_TOOLTIP}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                          );
                        })
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
                    <Select value={String(recordsPerPage)} onValueChange={v => { setRecordsPerPage(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
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
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
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
              columns={colDefs}
              columnOrder={colOrder}
              columnVisibility={colVis}
              onColumnOrderChange={setColOrder}
              onColumnVisibilityChange={setColVis}
              lockedColumns={LOCKED_COLUMNS}
              open={columnDrawerOpen}
              onOpenChange={setColumnDrawerOpen}
            />
          </div>
        </div>
      </div>

      {/* Add/Edit Corporate Rate — Archive-pattern Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" hideCloseButton>
          <div className="relative flex flex-col items-center pt-6 pb-4 text-center" style={{ background: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160px] h-[60px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#3B82F6" }} />
            <div className="relative w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
              {editingRate ? <Pencil className="w-5 h-5" style={{ color: "#2563EB" }} /> : <Plus className="w-6 h-6" style={{ color: "#2563EB" }} />}
            </div>
            <DialogTitle className="mt-3 text-[16px] tracking-[-0.01em]" style={{ fontWeight: 600, color: "#0F172A" }}>
              {editingRate ? `Update Corporate Rate — ${editingRate.sourceCurrency}` : "Add Corporate Rate"}
            </DialogTitle>
            <DialogDescription className="text-[12px] mt-1 max-w-[320px] mx-auto" style={{ color: "#475569", lineHeight: "1.5" }}>
              {editingRate ? `Update the corporate rate for ${editingRate.sourceCurrency} / ${BASE_CURRENCY}.` : "Define a new corporate rate for a currency pair."}
            </DialogDescription>
          </div>
          <div className="px-5 py-4 space-y-3.5 max-h-[56vh] overflow-y-auto">
            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                Base Currency
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex"><Info className="w-3 h-3 text-muted-foreground/60 cursor-help" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">{RATE_TOOLTIPS.baseCurrency}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <div className="h-9 px-3 rounded-md border border-border bg-muted/30 flex items-center text-[13px]">
                <span style={{ fontWeight: 600 }}>{BASE_CURRENCY}</span>
                <span className="ml-1.5 text-muted-foreground">— {BASE_CURRENCY_NAME}</span>
              </div>
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                Source Currency *
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex"><Info className="w-3 h-3 text-muted-foreground/60 cursor-help" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">{RATE_TOOLTIPS.sourceCurrency}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              {editingRate ? (
                <div className="h-9 px-3 rounded-md border border-border bg-muted/30 flex items-center text-[13px]">
                  <span style={{ fontWeight: 600 }}>{modalForm.sourceCurrency}</span>
                </div>
              ) : (
                <SourceCurrencyPicker
                  value={modalForm.sourceCurrency}
                  onChange={(code) => setModalForm(p => ({ ...p, sourceCurrency: code }))}
                  midMarketRates={midMarketRates}
                />
              )}
            </div>

            {/* Duplicate detection card */}
            {existingRateForSelected && !editingRate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-[12px] text-amber-800" style={{ fontWeight: 500 }}>
                  A corporate rate already exists for this currency pair.
                </p>
                <p className="text-[12px] text-amber-700 mt-1">
                  Current rate: <span style={{ fontWeight: 600 }}>{existingRateForSelected.standardRate.toFixed(4)}</span> · Effective from {formatDate(existingRateForSelected.effectiveDate)}
                </p>
                <p className="text-[12px] text-amber-700 mt-1">Do you want to update it?</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    className="h-8 text-[12px]"
                    onClick={() => {
                      setModalOpen(false);
                      openEditModal(existingRateForSelected);
                    }}
                  >
                    Update existing rate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[12px]"
                    onClick={() => setModalForm(p => ({ ...p, sourceCurrency: "" }))}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {midRef && !existingRateForSelected && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                  Mid-Market Reference
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex"><Info className="w-3 h-3 text-muted-foreground/60 cursor-help" /></span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">{RATE_TOOLTIPS.midMarket}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
                <p className="text-[15px] tabular-nums" style={{ fontWeight: 700 }}>{midRef.rate.toFixed(4)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">As of {format(new Date(midRef.effectiveDate), "dd MMM yyyy")}</p>
              </div>
            )}

            {!existingRateForSelected && (
              <>
                <div>
                  <Label className="text-[12px] text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                    Corporate Exchange Rate *
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex"><Info className="w-3 h-3 text-muted-foreground/60 cursor-help" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">{RATE_TOOLTIPS.corporate}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="e.g., 279.0000"
                    value={modalForm.standardRate}
                    onChange={e => setModalForm(p => ({ ...p, standardRate: e.target.value }))}
                    className="h-9 text-[13px] tabular-nums"
                  />
                  {liveVariance !== null && (
                    <p className="text-[11px] mt-1.5 text-amber-600" style={{ fontWeight: 500 }}>
                      Variance from mid-market: {liveVariance > 0 ? "+" : ""}{liveVariance.toFixed(2)}%
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-[12px] text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                    Effective Date *
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex"><Info className="w-3 h-3 text-muted-foreground/60 cursor-help" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] text-[11.5px]">{RATE_TOOLTIPS.effectiveDate}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    type="date"
                    value={modalForm.effectiveDate}
                    onChange={e => setModalForm(p => ({ ...p, effectiveDate: e.target.value }))}
                    className="h-9 text-[13px]"
                  />
                  {effectiveDateWarning?.type === "block" && (
                    <p className="text-[11px] mt-1.5 text-red-600" style={{ fontWeight: 500 }}>
                      {effectiveDateWarning.message}
                    </p>
                  )}
                  {effectiveDateWarning?.type === "warn" && (
                    <p className="text-[11px] mt-1.5 text-amber-600" style={{ fontWeight: 500 }}>
                      {effectiveDateWarning.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-[12px] text-muted-foreground mb-1.5">Notes (optional)</Label>
                  <Textarea
                    placeholder="Add notes about this rate..."
                    value={modalForm.notes}
                    onChange={e => setModalForm(p => ({ ...p, notes: e.target.value.slice(0, 500) }))}
                    className="text-[13px] resize-none"
                    rows={3}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">{modalForm.notes.length}/500</p>
                </div>
              </>
            )}
          </div>
          {!existingRateForSelected && (
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="h-9 text-[13px] rounded-lg border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 text-[13px] rounded-lg border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#0A77FF", color: "#fff" }}
                onClick={handleModalSave}
                disabled={effectiveDateWarning?.type === "block"}
              >
                {editingRate ? "Update Rate" : "Save Rate"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={o => !o && setDeleteDialog({ open: false, rate: null })}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <Archive className="w-8 h-8" style={{ color: "#D97706" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Archive
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Archive this rate?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              The corporate rate for <span style={{ fontWeight: 600, color: "#1E293B" }}>{deleteDialog.rate?.sourceCurrency}</span> will be archived. It will remain in rate history but will no longer be selectable for new transactions.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleArchiveRate}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#D97706", color: "#fff" }}
              >
                Archive Rate
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

      {/* Drag ghost portal */}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-lg bg-white"
              style={{ transform: "translate(-50%, -120%)", borderColor: "#0A77FF" }}
            >
              <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
              <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
                {colDef(draggingColumnKey)?.label}
              </span>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Exchange Rate Filters Modal */}
      <ExchangeRateFiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advFilters}
        onFiltersChange={(f) => { setAdvFilters(f); setCurrentPage(1); }}
        currencyCodes={allCurrencyCodes}
        filteredCount={sorted.length + (activeTab === "mid-market" && pinnedMidRow ? 1 : 0)}
      />
    </div>
  );
}
