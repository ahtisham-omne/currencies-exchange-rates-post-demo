import { useState, useMemo, useCallback, useEffect, cloneElement, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVendors } from "../context/VendorContext";
import { VendorStatusBadge } from "../components/vendors/VendorStatusBadge";
import fedexLogo from "@/assets/carriers/fedex.png";
import dhlLogo from "@/assets/carriers/dhl.png";
import upsLogo from "@/assets/carriers/ups.png";
import tcsLogo from "@/assets/carriers/tcs.png";
import sfLogo from "@/assets/carriers/sf.png";
import uspsLogo from "@/assets/carriers/usps.png";
import aramexLogo from "@/assets/carriers/aramex.png";
import maerskLogo from "@/assets/carriers/maersk.png";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "../components/vendors/ColumnSelector";
import {
  KpiInsightsPanel,
  KpiIcon,
  ALL_KPI_DEFINITIONS,
  DEFAULT_ACTIVE_KPIS,
  computeKpiValue,
} from "../components/vendors/KpiInsightsPanel";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  applyColumnFilters,
  createBlankFilter,
  isFilterActive,
  type ColumnFilterState,
  type SortConfig,
} from "../components/vendors/ColumnHeaderMenu";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "../components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  LayoutGrid,
  List,
  AlignJustify,
  Check,
  ChevronDown,
  User,
  X,
  Calendar,
  GripVertical,
  ChartColumn,
  MapPinPlus,
  MapPin,
  Package,
  Mail,
  Building2,
  ClipboardList,
  FileText,
  FileUp,
  Receipt,
  CircleCheck,
  CircleSlash,
  ArchiveRestore,
  AlertTriangle,
  Info,
  Phone,
  StickyNote,
  Upload,
  Link2,
  ExternalLink,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Checkbox } from "../components/ui/checkbox";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { QuickViewPanel, type QuickViewData } from "../components/vendors/QuickViewPanel";
import {
  FiltersModal,
  DEFAULT_FILTERS,
  countActiveFilters,
  type AdvancedFilters,
} from "../components/vendors/FiltersModal";
import { CreatePartnerModal } from "../components/vendors/CreatePartnerModal";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { PartnerType } from "../data/vendors";
import { CATEGORY_LABELS } from "../data/vendors";

const DND_LIST_KPI = "LIST_KPI_CARD";

// Module refresh v7
type QuickFilter = "all" | "customers" | "vendors" | "active" | "inactive" | "archived";
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

const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "vendors", label: "Vendors", showCount: true },
  { key: "customers", label: "Customers", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  { key: "archived", label: "Archived", showCount: true },
];

/* ─── Column configuration for the data table ─── */
const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "partner_name", label: "Partners", minWidth: "280px", sortable: true },
  { key: "partner_type", label: "Partner Type", minWidth: "180px", sortable: true },
  { key: "vendor_sub_types", label: "Vendor Sub-Types", minWidth: "220px" },
  { key: "customer_sub_types", label: "Customer Sub-Types", minWidth: "220px" },
  { key: "num_items", label: "No. of Items", minWidth: "240px", sortable: true },
  { key: "partner_locations", label: "Partner Locations", minWidth: "260px", sortable: true },
  { key: "global_contacts", label: "Points of Contact", minWidth: "280px" },
  { key: "partner_group", label: "Partner Group", minWidth: "150px" },
  { key: "net_profit", label: "Net Profit ($)", minWidth: "150px", sortable: true, align: "right" },
  { key: "credit_limit", label: "Credit Limit ($)", minWidth: "160px", sortable: true, align: "right" },
  { key: "credit_utilization", label: "Credit Util. ($)", minWidth: "160px", sortable: true, align: "right" },
  { key: "services", label: "Services", minWidth: "200px" },
  { key: "carrier_vendor", label: "Carrier (Vendor)", minWidth: "240px" },
  { key: "carrier_customer", label: "Carrier (Customer)", minWidth: "240px" },
  { key: "country", label: "Country", minWidth: "200px" },
  { key: "website", label: "Website", minWidth: "220px" },
  { key: "email", label: "Email", minWidth: "280px" },
  { key: "created_by", label: "Created By", minWidth: "240px" },
  { key: "created_on", label: "Created On", minWidth: "150px" },
  { key: "status", label: "Status", minWidth: "110px" },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, true])
);
// partner_name is always shown (locked) — it's the sticky first column
const LOCKED_COLUMNS = ["partner_name"];

/** Initial column widths parsed from minWidth values */
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const MIN_COL_WIDTH = 1; // unrestricted resize — user can shrink columns freely
const CHECKBOX_COL_WIDTH = 40; // width of the checkbox column in px

import { getAvatarTint } from "../utils/avatarTints";

/* Partners listing — lazy loaded via routes.ts */
export function VendorsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { vendors, getVendor, addVendor, updateVendor, archiveVendor, restoreVendor, deleteVendor } = useVendors();

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markActiveDialogOpen, setMarkActiveDialogOpen] = useState(false);
  const [markInactiveDialogOpen, setMarkInactiveDialogOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  /* ─── Advanced Filters state ─── */
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Read URL param for auto-opening create modal with a specific profile
  const createPartnerProfile = searchParams.get("createPartner");
  useEffect(() => {
    if (createPartnerProfile) {
      setCreateModalOpen(true);
    }
  }, [createPartnerProfile]);

  const handleCreateModalClose = useCallback((open: boolean) => {
    setCreateModalOpen(open);
    if (!open && createPartnerProfile) {
      // Clear the URL param when modal closes
      searchParams.delete("createPartner");
      setSearchParams(searchParams, { replace: true });
    }
  }, [createPartnerProfile, searchParams, setSearchParams]);

  // Track newly created vendor for flash animation
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  /* ─── Row selection state for bulk actions ─── */
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  /* ─── Quick View state ─── */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  /* ─── Partner creation handler ─── */
  const handlePartnerCreated = useCallback(
    (data: Record<string, unknown>) => {
      const name = (data.partnerName as string) || "New Partner";
      const phone = (data.partnerPhone as string) || "";
      const website = (data.website as string) || "";
      const address = (data.address as string) || "";
      const partnerTypes = (data.partnerTypes as ("vendor" | "customer")[]) || ["vendor"];
      const vendorType = (data.vendorType as string) || "Seller";
      const partnerGroup = (data.partnerGroup as string) || "";

      // Extract config data from Step 3
      const configPaymentMethods = data.configPaymentMethods as any[] | undefined;
      const configPaymentTerm = data.configPaymentTerm as Record<string, unknown> | undefined;
      const configPricingRules = data.configPricingRules as any[] | undefined;
      const configPointsOfContact = data.configPointsOfContact as any[] | undefined;
      const configCreditLimit = data.configCreditLimit as Record<string, unknown> | undefined;
      const configShipping = data.configShipping as Record<string, unknown> | undefined;

      // Build initials from partner name
      const nameParts = name.split(" ").filter(Boolean);
      const initials = nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : name.substring(0, 2).toUpperCase();

      // Map POCs to globalPointOfContacts format
      const globalPOCs = (configPointsOfContact || []).map((c: any) => ({
        initials: c.name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().substring(0, 2),
        name: c.name,
        bgColor: c.avatarColor || "#6366f1",
      }));

      const newVendor = addVendor({
        companyName: name,
        displayName: name,
        partnerTypes,
        vendorType,
        itemCodes: [],
        partnerLocations: [],
        globalPointOfContacts: globalPOCs.length > 0 ? globalPOCs : [],
        partnerGroup,
        netProfitMargin: 0,
        creditUtilization: 0,
        services: "",
        defaultCarrierVendor: "",
        defaultCarrierCustomer: "",
        country: "USA",
        countryFlag: "\u{1F1FA}\u{1F1F8}",
        emailAddress: "",
        createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1" },
        category: "services",
        status: "active",
        primaryContact: {
          name: name,
          email: "",
          phone: phone,
          designation: "Account Manager",
        },
        billingAddress: {
          street: address || "\u2014",
          city: "",
          state: "",
          zipCode: "",
          country: "United States",
        },
        taxId: "",
        paymentTerms: "net_30",
        creditLimit: 0,
        website: website,
        notes: "",
        configData: {
          paymentMethods: configPaymentMethods as any,
          paymentTermConfig: configPaymentTerm as any,
          pricingRules: configPricingRules as any,
          pointsOfContact: configPointsOfContact as any,
          creditLimitConfig: configCreditLimit as any,
          shippingConfig: configShipping as any,
          vendorSubTypes: (data.vendorSubTypes as string[]) || [],
          customerSubTypes: (data.customerSubTypes as string[]) || [],
          description: address || "",
        },
      });

      // Reset to page 1 so the new vendor appears at top
      setCurrentPage(1);
      setSearchQuery("");
      setQuickFilter("all");

      // Navigate directly to the new partner's details page
      navigate(`/vendors/${newVendor.id}`);

      // Show success toast
      toast.success(`Partner "${name}" created successfully`, {
        duration: 5000,
      });
    },
    [addVendor, navigate]
  );

  const activeFilterCount = useMemo(() => countActiveFilters(advFilters), [advFilters]);

  /* ─── Per-column (Notion-style) filters ─── */
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["partner_name"]));

  const columnFiltersList = useMemo(
    () => Object.values(columnFilters),
    [columnFilters]
  );

  const columnLabels = useMemo(() => {
    const map: Record<string, string> = {};
    COLUMN_DEFS.forEach((c) => { map[c.key] = c.label; });
    return map;
  }, []);

  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev; // already exists
      return { ...prev, [columnKey]: createBlankFilter(columnKey) };
    });
    // When triggered from column header menu, filter opens inline — no chip auto-open
    setCurrentPage(1);
  }, []);

  /** Same as handleAddColumnFilter but also auto-opens the chip popover (used by "+ Filter" toolbar button) */
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
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
    setCurrentPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    // Clear sort if hiding the currently sorted column
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    // Remove column filter if hiding a filtered column
    setColumnFilters((prev) => {
      if (!prev[columnKey]) return prev;
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
    // Unfreeze if hiding a frozen column
    setFrozenColumns((prev) => {
      if (!prev.has(columnKey)) return prev;
      const next = new Set(prev);
      next.delete(columnKey);
      return next;
    });
  }, []);

  const handleAutoOpened = useCallback(() => setAutoOpenFilterKey(null), []);

  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== "partner_name") {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }, []);

  /* ─── KPI Insights state ─── */
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState("last_30");
  const [showInsights, setShowInsights] = useState(true);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  const handleToggleKpi = (key: string) => {
    setActiveKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setActiveKpis((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /** Resolved active KPI definitions in order */
  const activeKpiDefs = useMemo(() => {
    return activeKpis
      .map((key) => ALL_KPI_DEFINITIONS.find((d) => d.key === key))
      .filter(Boolean) as typeof ALL_KPI_DEFINITIONS;
  }, [activeKpis]);

  /* ─── Column visibility & order state ─── */
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    ...DEFAULT_COLUMN_VISIBILITY,
  });

  /* ─── Column widths (for resize) ─── */
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });

  /* ─── Column drag reorder state (custom mouse-event based) ─── */
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);

  /** Only stores the dragged column key (no x/y — positioning is via ref for zero re-renders) */
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  /* ─── Column resize refs ─── */
  const resizeRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  /* ─── Custom drag: mousedown on header starts tracking (live-reorder) ─── */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (isResizing) return;
    if (e.button !== 0) return; // left-click only

    const startX = e.clientX;
    const startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60; // tiny cooldown so React can settle the DOM between swaps

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

      // Update ghost position via DOM ref (zero React re-renders)
      const ghost = ghostElRef.current;
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

      // Edge-trigger swap: react the instant cursor leaves the dragged column's bounds
      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;

      // Find the dragged column's current <th> rect
      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();

      // Cursor still inside the dragged column's bounds — no swap needed
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      // Cursor has exited: find which column it's now over
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

      // Suppress the click event that fires after mouseup so the ColumnHeaderMenu dropdown doesn't open
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

  /** Visible columns in user-defined order (always starts with partner_name) */
  const validColumnKeys = useMemo(() => new Set(COLUMN_DEFS.map((c) => c.key)), []);
  const visibleColumns = useMemo(() => {
    // Ensure partner_name is always first; filter out stale/removed column keys
    const ordered = columnOrder.filter(
      (key) => validColumnKeys.has(key) && columnVisibility[key] !== false
    );
    if (!ordered.includes("partner_name")) {
      ordered.unshift("partner_name");
    } else if (ordered[0] !== "partner_name") {
      const idx = ordered.indexOf("partner_name");
      ordered.splice(idx, 1);
      ordered.unshift("partner_name");
    }
    return ordered;
  }, [columnOrder, columnVisibility]);

  const colDef = (key: string) => COLUMN_DEFS.find((c) => c.key === key)!;

  /** Cumulative left pixel offsets for frozen columns, based on columnWidths.
   *  Starts after the checkbox column (CHECKBOX_COL_WIDTH). */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH; // account for the checkbox column
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  /** Last frozen column key -- gets a subtle right shadow for visual separation */
  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  const filterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = {
      all: vendors.length,
      customers: 0,
      vendors: 0,
      active: 0,
      inactive: 0,
      archived: 0,
    };
    vendors.forEach((v) => {
      if (v.partnerTypes?.includes("customer")) counts.customers++;
      if (v.partnerTypes?.includes("vendor")) counts.vendors++;
      if (v.status === "active") counts.active++;
      if (v.status === "inactive") counts.inactive++;
      if (v.status === "archived") counts.archived++;
    });
    return counts;
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const base = vendors.filter((v) => {
      /* -- Text search -- */
      const matchesSearch =
        !searchQuery ||
        v.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.primaryContact?.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        v.billingAddress?.city
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        v.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase());

      /* -- Quick filter (pill bar) -- */
      let matchesFilter = true;
      switch (quickFilter) {
        case "customers":
          matchesFilter = (v.partnerTypes || []).includes("customer");
          break;
        case "vendors":
          matchesFilter = (v.partnerTypes || []).includes("vendor");
          break;
        case "active":
          matchesFilter = v.status === "active";
          break;
        case "inactive":
          matchesFilter = v.status === "inactive";
          break;
        case "archived":
          matchesFilter = v.status === "archived";
          break;
      }

      /* -- Advanced filters -- */
      const f = advFilters;

      // Partner Type (multiselect)
      if (f.partnerTypes.length > 0 && !f.partnerTypes.some((t) => (v.partnerTypes || []).includes(t as PartnerType))) return false;

      // Vendor Type (multiselect)
      if (f.vendorTypes.length > 0 && !f.vendorTypes.includes(v.vendorType)) return false;

      // Status (multiselect)
      if (f.statuses.length > 0 && !f.statuses.includes(v.status)) return false;

      // Partner Group (multiselect)
      if (f.partnerGroups.length > 0 && !f.partnerGroups.includes(v.partnerGroup)) return false;

      // Services (multiselect)
      if (f.services.length > 0 && !f.services.includes(v.services)) return false;

      // Country (multiselect)
      if (f.countries.length > 0 && !f.countries.includes(v.country)) return false;

      // Created By (multiselect)
      if (f.createdBy.length > 0 && !f.createdBy.includes(v.createdByContact?.name || "")) return false;

      // Net Profit range
      if (f.netProfitMin && v.netProfitMargin < Number(f.netProfitMin)) return false;
      if (f.netProfitMax && v.netProfitMargin > Number(f.netProfitMax)) return false;

      // Credit Limit range
      if (f.creditLimitMin && v.creditLimit < Number(f.creditLimitMin)) return false;
      if (f.creditLimitMax && v.creditLimit > Number(f.creditLimitMax)) return false;

      // Credit Utilization range
      if (f.creditUtilMin && v.creditUtilization < Number(f.creditUtilMin)) return false;
      if (f.creditUtilMax && v.creditUtilization > Number(f.creditUtilMax)) return false;

      // Email text search
      if (f.email && !(v.emailAddress || "").toLowerCase().includes(f.email.toLowerCase())) return false;

      // Website text search
      if (f.website && !(v.website || "").toLowerCase().includes(f.website.toLowerCase())) return false;

      // Created On date range
      if (f.createdFrom) {
        const from = new Date(f.createdFrom);
        const created = new Date(v.createdAt);
        if (created < from) return false;
      }
      if (f.createdTo) {
        const to = new Date(f.createdTo);
        to.setHours(23, 59, 59, 999);
        const created = new Date(v.createdAt);
        if (created > to) return false;
      }

      return matchesSearch && matchesFilter;
    });

    // Apply per-column (Notion-style) filters
    let result = applyColumnFilters(base, columnFiltersList);

    // Apply sorting
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        const key = sortConfig.key;
        let aVal: any;
        let bVal: any;

        switch (key) {
          case "partner_name": aVal = a.displayName || ""; bVal = b.displayName || ""; break;
          case "partner_type": aVal = (a.partnerTypes || []).join(","); bVal = (b.partnerTypes || []).join(","); break;
          case "num_items": aVal = (a.itemCodes || []).length; bVal = (b.itemCodes || []).length; break;
          case "partner_locations": aVal = (a.partnerLocations || []).length; bVal = (b.partnerLocations || []).length; break;
          case "net_profit": aVal = a.netProfitMargin ?? 0; bVal = b.netProfitMargin ?? 0; break;
          case "credit_limit": aVal = a.creditLimit ?? 0; bVal = b.creditLimit ?? 0; break;
          case "credit_utilization": aVal = a.creditUtilization ?? 0; bVal = b.creditUtilization ?? 0; break;
          case "created_on": aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
          default: aVal = (a as any)[key] || ""; bVal = (b as any)[key] || "";
        }

        if (typeof aVal === "string" && typeof bVal === "string") {
          return dir * aVal.localeCompare(bVal);
        }
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return result;
  }, [vendors, searchQuery, quickFilter, advFilters, columnFiltersList, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / recordsPerPage));

  // Clamp currentPage when it exceeds totalPages (e.g. after vendor deletion
  // or external context changes that shrink the result set without an explicit
  // setCurrentPage(1) call from a filter handler).
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredVendors.slice(start, start + recordsPerPage);
  }, [filteredVendors, currentPage, recordsPerPage]);

  const handleArchive = () => {
    if (selectedVendorId) {
      archiveVendor(selectedVendorId);
      toast.success("Vendor archived successfully");
      setArchiveDialogOpen(false);
      setSelectedVendorId(null);
    }
  };

  const handleDelete = () => {
    if (selectedVendorId) {
      deleteVendor(selectedVendorId);
      toast.success("Vendor deleted permanently");
      setDeleteDialogOpen(false);
      setSelectedVendorId(null);
    }
  };

  const handleRestore = (id: string) => {
    restoreVendor(id);
    toast.success("Vendor restored to active");
  };

  const handleMarkActive = () => {
    if (selectedVendorId) {
      updateVendor(selectedVendorId, { status: "active" as const });
      toast.success("Partner marked as active");
      setMarkActiveDialogOpen(false);
      setSelectedVendorId(null);
    }
  };

  const handleMarkInactive = () => {
    if (selectedVendorId) {
      updateVendor(selectedVendorId, { status: "inactive" as const });
      toast.success("Partner marked as inactive");
      setMarkInactiveDialogOpen(false);
      setSelectedVendorId(null);
    }
  };

  const handleUnarchive = (id: string) => {
    restoreVendor(id);
    toast.success("Partner unarchived successfully");
  };

  /* ─── Row selection helpers ─── */
  const allPageSelected = paginatedVendors.length > 0 && paginatedVendors.every((v) => selectedRows.has(v.id));
  const somePageSelected = paginatedVendors.some((v) => selectedRows.has(v.id));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        // Deselect all on current page
        paginatedVendors.forEach((v) => next.delete(v.id));
      } else {
        // Select all on current page
        paginatedVendors.forEach((v) => next.add(v.id));
      }
      return next;
    });
  }, [allPageSelected, paginatedVendors]);

  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** Highlight matching search text in table cells.
   *  Uses index-parity to identify matched parts: when `String.split()` is
   *  called with a regex containing a capture group, the resulting array
   *  alternates [non-match, match, non-match, match, ...], so odd-indexed
   *  elements are always the captured (matched) segments.
   */
  const highlightText = useCallback(
    (text: string | undefined | null) => {
      if (!text) return <span>{"\u2013"}</span>;
      if (!searchQuery || searchQuery.trim().length === 0) return <>{text}</>;
      const query = searchQuery.trim();
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      if (parts.length === 1) return <>{text}</>;
      return (
        <>
          {parts.map((part, i) =>
            i % 2 === 1 ? (
              <mark
                key={i}
                className="bg-transparent px-0.5 rounded-sm"
                style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    },
    [searchQuery]
  );

  const clearAllFilters = () => {
    setSearchQuery("");
    setQuickFilter("all");
    setAdvFilters({ ...DEFAULT_FILTERS });
    setColumnFilters({});
    setSortConfig(null);
    setCurrentPage(1);
  };

  /** True when any filter layer (search, quick, advanced, column) is active */
  const hasAnyFilter =
    !!searchQuery ||
    quickFilter !== "all" ||
    activeFilterCount > 0 ||
    Object.keys(columnFilters).length > 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Sample avatar photos for people (POC, Created By)
  const getPersonAvatar = (name: string): string | undefined => {
    const avatars: Record<string, string> = {
      "Sarah": "https://randomuser.me/api/portraits/women/44.jpg",
      "Michael": "https://randomuser.me/api/portraits/men/32.jpg",
      "Emily": "https://randomuser.me/api/portraits/women/65.jpg",
      "David": "https://randomuser.me/api/portraits/men/75.jpg",
      "Rachel": "https://randomuser.me/api/portraits/women/28.jpg",
      "James": "https://randomuser.me/api/portraits/men/46.jpg",
      "Lisa": "https://randomuser.me/api/portraits/women/17.jpg",
      "Robert": "https://randomuser.me/api/portraits/men/22.jpg",
      "Amanda": "https://randomuser.me/api/portraits/women/56.jpg",
      "Kevin": "https://randomuser.me/api/portraits/men/64.jpg",
      "Maria": "https://randomuser.me/api/portraits/women/33.jpg",
      "Chris": "https://randomuser.me/api/portraits/men/85.jpg",
      "Jessica": "https://randomuser.me/api/portraits/women/91.jpg",
      "Andrew": "https://randomuser.me/api/portraits/men/41.jpg",
      "Nicole": "https://randomuser.me/api/portraits/women/72.jpg",
      "Thomas": "https://randomuser.me/api/portraits/men/55.jpg",
      "Stephanie": "https://randomuser.me/api/portraits/women/15.jpg",
      "Daniel": "https://randomuser.me/api/portraits/men/18.jpg",
      "Karen": "https://randomuser.me/api/portraits/women/48.jpg",
      "Brian": "https://randomuser.me/api/portraits/men/67.jpg",
      "Ahtisham": "https://randomuser.me/api/portraits/men/36.jpg",
      "Abdullah": "https://randomuser.me/api/portraits/men/29.jpg",
    };
    const firstName = name.split(" ")[0];
    return avatars[firstName];
  };

  // Generate realistic contact details from a name (deterministic hash-based)
  const getContactDetails = (name: string) => {
    const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const depts = ["Procurement", "Supply Chain", "Finance", "Operations", "Sales", "Logistics", "Engineering", "Quality Assurance"];
    const roles = ["Manager", "Director", "Lead", "Specialist", "Coordinator", "Analyst", "Supervisor", "Associate"];
    const dept = depts[h % depts.length];
    const role = `${dept} ${roles[(h * 7) % roles.length]}`;
    const first = name.split(" ")[0]?.toLowerCase() || "user";
    const last = name.split(" ")[1]?.toLowerCase() || "name";
    const email = `${first}.${last}@company.com`;
    const phone = `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`;
    return { role, dept, email, phone };
  };

  const getPartnerIcon = (name: string, website?: string): { bg: string; logoUrl?: string; initials: string } => {
    const logos: Record<string, string> = {
      Toyota: "https://logo.clearbit.com/toyota.com",
      Tesla: "https://logo.clearbit.com/tesla.com",
      Ford: "https://logo.clearbit.com/ford.com",
      BMW: "https://logo.clearbit.com/bmw.com",
      Honda: "https://logo.clearbit.com/honda.com",
      "General Motors": "https://logo.clearbit.com/gm.com",
      FedEx: "https://logo.clearbit.com/fedex.com",
      UPS: "https://logo.clearbit.com/ups.com",
      Nissan: "https://logo.clearbit.com/nissan-global.com",
      Hyundai: "https://logo.clearbit.com/hyundai.com",
      Volvo: "https://logo.clearbit.com/volvocars.com",
      Rivian: "https://logo.clearbit.com/rivian.com",
      Mercedes: "https://logo.clearbit.com/mercedes-benz.com",
      Volkswagen: "https://logo.clearbit.com/volkswagen.com",
      Audi: "https://logo.clearbit.com/audi.com",
      Porsche: "https://logo.clearbit.com/porsche.com",
      Subaru: "https://logo.clearbit.com/subaru.com",
      Mazda: "https://logo.clearbit.com/mazda.com",
      Kia: "https://logo.clearbit.com/kia.com",
      Chrysler: "https://logo.clearbit.com/stellantis.com",
      Lexus: "https://logo.clearbit.com/lexus.com",
      Acura: "https://logo.clearbit.com/acura.com",
      Jeep: "https://logo.clearbit.com/jeep.com",
      Dodge: "https://logo.clearbit.com/dodge.com",
      Lucid: "https://logo.clearbit.com/lucidmotors.com",
      Ferrari: "https://logo.clearbit.com/ferrari.com",
      Lamborghini: "https://logo.clearbit.com/lamborghini.com",
      Maserati: "https://logo.clearbit.com/maserati.com",
      Bentley: "https://logo.clearbit.com/bentleymotors.com",
      McLaren: "https://logo.clearbit.com/mclaren.com",
      BYD: "https://logo.clearbit.com/byd.com",
      Suzuki: "https://logo.clearbit.com/suzuki.com",
      Mitsubishi: "https://logo.clearbit.com/mitsubishi-motors.com",
      Infiniti: "https://logo.clearbit.com/infinitiusa.com",
      Lincoln: "https://logo.clearbit.com/lincoln.com",
      Cadillac: "https://logo.clearbit.com/cadillac.com",
      Buick: "https://logo.clearbit.com/buick.com",
      MINI: "https://logo.clearbit.com/mini.com",
      Peugeot: "https://logo.clearbit.com/peugeot.com",
      Tata: "https://logo.clearbit.com/tatamotors.com",
      Geely: "https://logo.clearbit.com/geely.com",
      Jaguar: "https://logo.clearbit.com/jaguarlandrover.com",
      "Aston Martin": "https://logo.clearbit.com/astonmartin.com",
      "Rolls-Royce": "https://logo.clearbit.com/rolls-roycemotorcars.com",
      Polestar: "https://logo.clearbit.com/polestar.com",
      Genesis: "https://logo.clearbit.com/genesis.com",
      RAM: "https://logo.clearbit.com/ramtrucks.com",
    };
    const tint = getAvatarTint(name);
    const initials = name.split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    let logoUrl: string | undefined;
    for (const key of Object.keys(logos)) {
      if (name.includes(key)) { logoUrl = logos[key]; break; }
    }
    // Fallback: use vendor website for Clearbit logo if no name match
    if (!logoUrl && website) {
      const domain = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (domain && domain.includes(".")) {
        logoUrl = `https://logo.clearbit.com/${domain}`;
      }
    }
    return { bg: tint.bg, logoUrl, initials };
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

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button
            onClick={() => navigate("/partners")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Partners Management
          </button>
          <span className="text-muted-foreground">/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">Partners</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Search partners..."
              className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
              <span className="text-[11px]" style={{ fontWeight: 600, color: '#0A77FF' }}>AA</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Product Designer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
                <Users className="w-4 h-4" style={{ color: '#0A77FF' }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Partners</h1>
                <p className="text-xs text-muted-foreground">
                  Organize vendors, customers, and service partners — from suppliers and carriers to contractors — all in one place.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-primary text-primary-foreground shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Partner
            </Button>
          </div>

          {/* KPI Insights -- collapsible section */}
          {showInsights && activeKpiDefs.length > 0 && (
          <div className="mb-4 shrink-0">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                  Performance Insights
                </span>
                {/* Date Range Filter */}
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
                  <DropdownMenuContent align="start" className="w-[170px]">
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
                onClick={() => setInsightsPanelOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "#0A77FF" }}
              >
                <Plus className="w-3 h-3" />
                Add Insights
              </button>
            </div>

            {/* KPI Cards — draggable responsive grid */}
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const value = computeKpiValue(kpi.key, vendors);
                  // Populate rich tooltip breakdowns with live data (only for complex KPIs)
                  const tooltipData = KPI_TOOLTIP_DATA[kpi.key];
                  if (tooltipData) {
                    const totalCredit = vendors.reduce((s, v) => s + (v.creditLimit || 0), 0);
                    const totalUtil = vendors.reduce((s, v) => s + (v.creditUtilization || 0), 0);
                    const totalOutstanding = vendors.reduce((s, v) => s + (v.outstandingBalance || 0), 0);
                    const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;
                    if (kpi.key === "total_credit_utilization") {
                      tooltipData.breakdown = [
                        { label: "Total Credit Limit", value: fmt(totalCredit) },
                        { label: "Currently Utilized", value: fmt(totalUtil) },
                        { label: "Available Credit", value: fmt(totalCredit - totalUtil), isResult: true },
                      ];
                    } else if (kpi.key === "total_outstanding") {
                      const pending = Math.round(totalOutstanding * 0.55);
                      const overdue = Math.round(totalOutstanding * 0.30);
                      const scheduled = totalOutstanding - pending - overdue;
                      tooltipData.breakdown = [
                        { label: "Pending Invoices", value: fmt(pending) },
                        { label: "Overdue Payments", value: fmt(overdue) },
                        { label: "Scheduled Payments", value: fmt(scheduled) },
                        { label: "Total Outstanding", value: fmt(totalOutstanding), isResult: true },
                      ];
                    }
                  }
                  return (
                    <DraggableListKpiCard
                      key={kpi.key}
                      index={idx}
                      kpiKey={kpi.key}
                      label={kpi.label}
                      value={value}
                      iconName={kpi.iconName}
                      tooltip={kpi.tooltip}
                      moveCard={moveKpi}
                      onRemove={() => handleToggleKpi(kpi.key)}
                    />
                  );
                })}
              </div>
            </DndProvider>
          </div>
          )}

          {/* KPI Insights Panel */}
          <KpiInsightsPanel
            open={insightsPanelOpen}
            onOpenChange={setInsightsPanelOpen}
            activeKpis={activeKpis}
            onToggleKpi={handleToggleKpi}
            vendors={vendors}
          />

          {/* Unified Table Container with Search, Filters & Data */}
          <div className="border border-border rounded-xl bg-card overflow-clip flex flex-1 min-h-0">
            <div className="flex-1 min-w-0 overflow-clip flex flex-col">
              {/* Row 1: Search + Filters ... Count + Density */}
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      placeholder="Search by name, type, or email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
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
                  {/* Filters -- Airbnb-style modal */}
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

                {/* Count + Column Selector + Density Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                    {filteredVendors.length !== vendors.length ? (
                      <>
                        <span className="text-foreground">{filteredVendors.length}</span>
                        <span className="text-muted-foreground/60"> of </span>
                        <span className="text-muted-foreground">{vendors.length}</span>
                        <span className="text-muted-foreground/70"> partners</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground">{vendors.length}</span>
                        <span className="text-muted-foreground/70"> partners</span>
                      </>
                    )}
                  </span>

                  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                  {/* Insights toggle button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!showInsights) {
                        setShowInsights(true);
                      }
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
                      {/* Card size options — only when card view is active */}
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
                  <ColumnSelectorTrigger
                    visibleCount={visibleColumns.length}
                    active={columnDrawerOpen}
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />
                </div>
              </div>

              {/* Row 2: Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                {/* Me mode pill */}
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors whitespace-nowrap shrink-0 cursor-pointer">
                  <User className="w-3.5 h-3.5" />
                  Me mode
                </button>

                {/* Separator */}
                <div className="w-px h-5 bg-border shrink-0" />

                {/* Filter pills */}
                {QUICK_FILTER_OPTIONS.map((filter) => {
                  const isActive = quickFilter === filter.key;
                  const count = filterCounts[filter.key];
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setQuickFilter(filter.key);
                        setCurrentPage(1);
                      }}
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

              {/* Active Column Filters Bar (Notion-style) */}
              <ActiveFiltersBar
                columnFilters={columnFiltersList}
                columnLabels={columnLabels}
                vendors={vendors}
                onFilterChange={handleColumnFilterChange}
                onRemoveFilter={handleRemoveColumnFilter}
                onAddFilter={handleAddColumnFilterWithAutoOpen}
                onClearAll={handleClearAllColumnFilters}
                autoOpenKey={autoOpenFilterKey}
                onAutoOpened={handleAutoOpened}
                availableColumns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
              />

              {/* Divider between filters and table content */}
              <div className="border-t border-border shrink-0" />
              {density === "card" ? (
                /* Card View */
                <div className="p-4 min-h-0 overflow-y-auto flex-1">
                  {paginatedVendors.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <Users className="w-8 h-8" />
                      <p className="text-sm">No partners found</p>
                      {hasAnyFilter && (
                        <Button variant="link" size="sm" onClick={clearAllFilters}>
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${
                      cardSize === "large" ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" :
                      cardSize === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }`}>
                      {paginatedVendors.map((vendor) => {
                        const icon = getPartnerIcon(vendor.companyName, vendor.website);
                        const partnerTypes = vendor.partnerTypes || [];
                        return (
                          <div
                            key={vendor.id}
                            className={`bg-card border border-border rounded-xl cursor-pointer hover:shadow-md hover:border-primary/20 transition-all ${newlyCreatedId === vendor.id ? "animate-row-flash" : ""} ${
                              cardSize === "large" ? "p-5" : cardSize === "small" ? "p-3" : "p-4"
                            }`}
                            onClick={() => navigate(`/vendors/${vendor.id}`)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <LogoAvatar logoUrl={icon.logoUrl} initials={icon.initials} bg={icon.bg} size={cardSize === "large" ? "lg" : cardSize === "small" ? "sm" : "md"} />
                                <div className="min-w-0">
                                  <p className="text-sm truncate" style={{ fontWeight: 500 }}>
                                    {highlightText(vendor.displayName)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{highlightText(vendor.code)}</p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => navigate(`/vendors/${vendor.id}`)}>
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/vendors/${vendor.id}/edit`)}>
                                    <Pencil className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                              <VendorStatusBadge status={vendor.status} />
                              {partnerTypes.map((type) => (
                                <span
                                  key={type}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] border"
                                  style={{
                                    fontWeight: 500,
                                    backgroundColor: type === "vendor" ? "#EFF6FF" : "#F5F3FF",
                                    color: type === "vendor" ? "#1E40AF" : "#5B21B6",
                                    borderColor: type === "vendor" ? "#BFDBFE" : "#DDD6FE",
                                  }}
                                >
                                  {type === "vendor" ? "Vendor" : "Customer"}
                                </span>
                              ))}
                              {vendor.vendorSubTypes && vendor.vendorSubTypes.length > 0 && (
                                <>
                                  <span className="inline-flex items-center px-1.5 py-px rounded-full text-[9px] border" style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>
                                    {vendor.vendorSubTypes[0]}
                                  </span>
                                  {vendor.vendorSubTypes.length > 1 && (
                                    <span className="inline-flex items-center px-1 py-px rounded-full text-[9px] border" style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>+{vendor.vendorSubTypes.length - 1}</span>
                                  )}
                                </>
                              )}
                              {vendor.customerSubTypes && vendor.customerSubTypes.length > 0 && (
                                <>
                                  <span className="inline-flex items-center px-1.5 py-px rounded-full text-[9px] border" style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>
                                    {vendor.customerSubTypes[0]}
                                  </span>
                                  {vendor.customerSubTypes.length > 1 && (
                                    <span className="inline-flex items-center px-1 py-px rounded-full text-[9px] border" style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>+{vendor.customerSubTypes.length - 1}</span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Credit Limit</span>
                                <span className="text-foreground" style={{ fontWeight: 500 }}>
                                  $ {formatCurrency(vendor.creditLimit)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Country</span>
                                <span className="text-foreground">
                                  {vendor.countryFlag} {vendor.country}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Created</span>
                                <span className="text-foreground">{formatDate(vendor.createdAt)}</span>
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
                <div className={`min-h-0 overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                  <Table style={{ tableLayout: "fixed", width: `${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px` }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                        density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                      }`}>
                        {/* Checkbox column — sticky leftmost */}
                        <TableHead
                          className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                        >
                          <Checkbox
                            checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all rows"
                          />
                        </TableHead>
                        {/* Dynamic columns based on visibleColumns order */}
                        {visibleColumns.map((key) => {
                          const def = colDef(key);
                          const isFrozen = frozenColumns.has(key);
                          const isLocked = LOCKED_COLUMNS.includes(key);
                          const isDraggable = !isLocked;
                          const currentColSort: "asc" | "desc" | null =
                            sortConfig?.key === key ? sortConfig.direction : null;
                          const hasFilter = columnFilters[key] ? isFilterActive(columnFilters[key]) : false;
                          const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                          const isBeingDragged = draggingColumnKey === key;

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
                              className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-[#f8fafc] z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                              style={{
                                width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
                                overflow: "hidden",
                                ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                                ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                ...(isBeingDragged ? {
                                  background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)",
                                } : {}),
                              }}
                            >
                              {/* Blue accent bar on top edge of dragged column header */}
                              {isBeingDragged && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />
                              )}
                              {/* Drag grip icon — absolutely positioned so it never shifts the label */}
                              {isDraggable && (
                                <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                              )}

                              <div className={`flex items-center ${def.align === "right" ? "w-full" : ""}`}>
                                <ColumnHeaderMenu
                                  columnKey={key}
                                  label={def.label}
                                  sortable={def.sortable}
                                  sortConfig={sortConfig}
                                  onSort={handleSort}
                                  onAddFilter={handleAddColumnFilter}
                                  onHideColumn={handleHideColumn}
                                  onFreezeColumn={handleFreezeColumn}
                                  isFrozen={isFrozen}
                                  isLocked={isLocked}
                                  hasActiveFilter={hasFilter}
                                  filter={columnFilters[key] ?? null}
                                  vendors={vendors}
                                  onFilterChange={handleColumnFilterChange}
                                >
                                  <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                    <span className="text-[13px]" style={currentColSort || hasFilter ? { color: "#0A77FF" } : undefined}>{def.label}</span>
                                    {hasFilter && !currentColSort && (
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#0A77FF" }} />
                                    )}
                                    {currentColSort === "asc" && (
                                      <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                    )}
                                    {currentColSort === "desc" && (
                                      <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                    )}
                                    {!currentColSort && !hasFilter && def.sortable && (
                                      <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                    )}
                                  </div>
                                </ColumnHeaderMenu>
                              </div>

                              {/* Resize handle -- right edge */}
                              <div
                                onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setColumnWidths((prev) => ({
                                    ...prev,
                                    [key]: parseInt(def.minWidth, 10),
                                  }));
                                }}
                                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                                style={{ touchAction: "none" }}
                              >
                                <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}><span className="text-[13px]">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Users className="w-8 h-8" />
                              <p className="text-sm">No partners found</p>
                              {hasAnyFilter && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={clearAllFilters}
                                >
                                  Clear all filters
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedVendors.map((vendor) => {
                          const icon = getPartnerIcon(vendor.companyName, vendor.website);
                          const itemCodes = vendor.itemCodes || [];
                          const partnerLocations = vendor.partnerLocations || [];
                          const globalPointOfContacts = vendor.globalPointOfContacts || [];
                          const partnerTypes = vendor.partnerTypes || [];
                          const extraItems = itemCodes.length - 1;
                          const extraLocations = partnerLocations.length - 1;
                          const extraContacts = globalPointOfContacts.length - 1;

                          /* Cell renderer for each dynamic column key */
                          const isRelaxed = density === "comfort";
                          const renderCell = (colKey: string) => {
                            switch (colKey) {
                              case "partner_name":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
                                      <LogoAvatar logoUrl={icon.logoUrl} initials={icon.initials} bg={icon.bg} size={isRelaxed ? "lg" : "md"} />
                                      <div className="min-w-0 flex-1">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: 500, color: '#1E293B' }}>{highlightText(vendor.displayName)}</span>
                                        {isRelaxed && vendor.emailAddress && (
                                          <span className="text-xs text-muted-foreground/60 truncate block">{vendor.emailAddress}</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              case "partner_type":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2" : "gap-1.5"}`}>
                                      {partnerTypes.map((type) => (
                                        <span key={type} className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: type === "vendor" ? "#EFF6FF" : "#F5F3FF", color: type === "vendor" ? "#1E40AF" : "#5B21B6", borderColor: type === "vendor" ? "#BFDBFE" : "#DDD6FE" }}>
                                          {type === "vendor" ? "Vendor" : "Customer"}
                                        </span>
                                      ))}
                                    </div>
                                  </TableCell>
                                );
                              case "vendor_sub_types": {
                                const vst = vendor.vendorSubTypes || [];
                                const vstExtra = vst.length > 1 ? vst.length - 1 : 0;
                                return (
                                  <TableCell key={colKey}>
                                    {vst.length > 0 ? (
                                      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
                                        <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>
                                          {vst[0]}
                                        </span>
                                        {vstExtra > 0 && (
                                          <OverflowTooltip
                                            category="Vendor Sub-Types"
                                            items={vst.slice(1).map((st, i) => ({
                                              id: `${vendor.id}-vst-${i}`,
                                              name: st,
                                              subtitle: "VENDOR SUB-TYPE",
                                            }))}
                                          >
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>+{vstExtra}</span>
                                          </OverflowTooltip>
                                        )}
                                      </div>
                                    ) : (<span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                  </TableCell>
                                );
                              }
                              case "customer_sub_types": {
                                const cst = vendor.customerSubTypes || [];
                                const cstExtra = cst.length > 1 ? cst.length - 1 : 0;
                                return (
                                  <TableCell key={colKey}>
                                    {cst.length > 0 ? (
                                      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
                                        <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>
                                          {cst[0]}
                                        </span>
                                        {cstExtra > 0 && (
                                          <OverflowTooltip
                                            category="Customer Sub-Types"
                                            items={cst.slice(1).map((st, i) => ({
                                              id: `${vendor.id}-cst-${i}`,
                                              name: st,
                                              subtitle: "CUSTOMER SUB-TYPE",
                                            }))}
                                          >
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>+{cstExtra}</span>
                                          </OverflowTooltip>
                                        )}
                                      </div>
                                    ) : (<span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                  </TableCell>
                                );
                              }
                              case "num_items":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-1.5"}`}>
                                      {isRelaxed && (
                                        <div className="w-7 h-7 rounded-md bg-[#F1F5F9] flex items-center justify-center shrink-0">
                                          <Package className="w-3.5 h-3.5 text-[#64748B]" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: 500 }}>{itemCodes[0] || "\u2013"}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{itemCodes.length} item{itemCodes.length !== 1 ? "s" : ""} total</span>}
                                      </div>
                                      {extraItems > 0 && (
                                        <OverflowTooltip
                                          category="Items"
                                          items={itemCodes.slice(1).map((code, i) => ({
                                            id: `${vendor.id}-item-${i}`,
                                            name: code,
                                            subtitle: "ITEM",
                                          }))}
                                          onItemClick={(item) => setQuickViewData({ type: "item", item, vendorName: vendor.displayName })}
                                        >
                                          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraItems} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              case "partner_locations":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-1.5"}`}>
                                      {isRelaxed && (
                                        <div className="w-7 h-7 rounded-md bg-[#F0FDF4] flex items-center justify-center shrink-0">
                                          <MapPin className="w-3.5 h-3.5 text-[#059669]" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(partnerLocations[0] || "\u2013")}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{partnerLocations.length} location{partnerLocations.length !== 1 ? "s" : ""}</span>}
                                      </div>
                                      {extraLocations > 0 && (
                                        <OverflowTooltip
                                          category="Locations"
                                          items={partnerLocations.slice(1).map((loc, i) => ({
                                            id: `${vendor.id}-loc-${i}`,
                                            name: loc,
                                            subtitle: "LOCATION",
                                          }))}
                                          onItemClick={(item) => setQuickViewData({ type: "location", item, vendorName: vendor.displayName })}
                                        >
                                          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraLocations} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              case "global_contacts":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {globalPointOfContacts.length > 0 ? (
                                        <>
                                          {(() => { const poc = globalPointOfContacts[0]; const photoUrl = getPersonAvatar(poc?.name || ""); const t = getAvatarTint(poc?.name || ""); const cd = getContactDetails(poc?.name || ""); return (
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="cursor-pointer"><LogoAvatar logoUrl={photoUrl} initials={poc?.initials || "?"} bg={t.bg} size={isRelaxed ? "lg" : "md"} type="person" /></div>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              {/* Header with gradient */}
                                              <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-4 py-3 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                                <div className="flex items-center gap-3 relative">
                                                  <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photoUrl ? "transparent" : poc?.bgColor || t.bg }}>
                                                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{poc?.initials}</div>}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{poc?.name}</p>
                                                    <p className="text-[11px] text-[#94A3B8] truncate">{cd.role}</p>
                                                  </div>
                                                </div>
                                              </div>
                                              {/* Body */}
                                              <div className="bg-white px-4 py-3 space-y-2">
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Mail className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span className="truncate">{cd.email}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Phone className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span>{cd.phone}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Building2 className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span>{cd.dept}</span></div>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                          ); })()}
                                          <div className="min-w-0">
                                            <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`}>{highlightText(globalPointOfContacts[0]?.name)}</span>
                                            {isRelaxed && (globalPointOfContacts[0] as any)?.role && (
                                              <span className="text-xs text-muted-foreground/60 truncate block">{(globalPointOfContacts[0] as any)?.role}</span>
                                            )}
                                          </div>
                                          {extraContacts > 0 && (
                                            <OverflowTooltip
                                              category="Point of Contacts"
                                              items={globalPointOfContacts.slice(1).map((c, i) => {
                                                const t = getAvatarTint(c.name || "");
                                                return {
                                                  id: `${vendor.id}-contact-${i}`,
                                                  name: c.name,
                                                  subtitle: (c as any).role || "CONTACT",
                                                  initials: c.initials,
                                                  avatarBg: t.bg,
                                                  avatarFg: t.fg,
                                                };
                                              })}
                                              onItemClick={(item) => setQuickViewData({ type: "contact", item, vendorName: vendor.displayName })}
                                            >
                                              <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraContacts} more</span>
                                            </OverflowTooltip>
                                          )}
                                        </>
                                      ) : (<span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                    </div>
                                  </TableCell>
                                );
                              case "partner_group":
                                return (<TableCell key={colKey}><span className={isRelaxed ? "text-[13.5px]" : "text-sm"}>{vendor.partnerGroup}</span></TableCell>);
                              case "net_profit":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13.5px]" : "text-sm"}>{(vendor.netProfitMargin ?? 0).toFixed(2)}</span></TableCell>);
                              case "credit_limit":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13.5px]" : "text-sm"}>$ {formatCurrency(vendor.creditLimit)}</span></TableCell>);
                              case "credit_utilization":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13.5px]" : "text-sm"}>{formatCurrency(vendor.creditUtilization)}</span></TableCell>);
                              case "services":
                                return (
                                  <TableCell key={colKey}>
                                    <div>
                                      <span className={isRelaxed ? "text-[13.5px]" : "text-sm"} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.services}</span>
                                      {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{CATEGORY_LABELS[vendor.category]}</span>}
                                    </div>
                                  </TableCell>
                                );
                              case "carrier_vendor":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <HoverCard>
                                        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="cursor-pointer"><CarrierIcon carrier={vendor.defaultCarrierVendor} /></div>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden"><CarrierIcon carrier={vendor.defaultCarrierVendor} /></div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{vendor.defaultCarrierVendor}</p>
                                                <p className="text-[11px] text-[#94A3B8]">Primary Vendor Carrier</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-3 space-y-2">
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Service Type</span><span className="text-[#334155]" style={{ fontWeight: 500 }}>Ground & Express</span></div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Avg. Delivery</span><span className="text-[#334155]" style={{ fontWeight: 500 }}>3–5 business days</span></div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Tracking</span><span className="text-[#059669]" style={{ fontWeight: 500 }}>Available</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div className="min-w-0 flex-1">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.defaultCarrierVendor}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">Vendor Carrier</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              case "carrier_customer":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <HoverCard>
                                        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="cursor-pointer"><CarrierIcon carrier={vendor.defaultCarrierCustomer} /></div>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden"><CarrierIcon carrier={vendor.defaultCarrierCustomer} /></div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{vendor.defaultCarrierCustomer}</p>
                                                <p className="text-[11px] text-[#94A3B8]">Primary Customer Carrier</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-3 space-y-2">
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Service Type</span><span className="text-[#334155]" style={{ fontWeight: 500 }}>Standard & Priority</span></div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Avg. Delivery</span><span className="text-[#334155]" style={{ fontWeight: 500 }}>2–7 business days</span></div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-[#64748B]">Tracking</span><span className="text-[#059669]" style={{ fontWeight: 500 }}>Available</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div className="min-w-0 flex-1">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.defaultCarrierCustomer}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">Customer Carrier</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              case "country":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <span className={isRelaxed ? "text-lg" : "text-base"}>{vendor.countryFlag}</span>
                                      <div className="min-w-0 flex-1">
                                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(vendor.country)}</span>
                                        {isRelaxed && vendor.billingAddress?.city && <span className="text-[10px] text-muted-foreground/50 truncate block">{vendor.billingAddress.city}{vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""}</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              case "website":
                                return (<TableCell key={colKey}><span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground block`}>{highlightText(vendor.website)}</span></TableCell>);
                              case "email":
                                return (<TableCell key={colKey}><span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground block`}>{highlightText(vendor.emailAddress)}</span></TableCell>);
                              case "created_by":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {vendor.createdByContact ? (
                                        <>
                                          {(() => { const cb = vendor.createdByContact; const photoUrl = getPersonAvatar(cb.name || ""); const t = getAvatarTint(cb.name || ""); const cd = getContactDetails(cb.name || ""); return (
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="cursor-pointer"><LogoAvatar logoUrl={photoUrl} initials={cb.initials || "?"} bg={t.bg} size={isRelaxed ? "lg" : "md"} type="person" /></div>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-4 py-3 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                                <div className="flex items-center gap-3 relative">
                                                  <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photoUrl ? "transparent" : cb.bgColor || t.bg }}>
                                                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{cb.initials}</div>}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{cb.name}</p>
                                                    <p className="text-[11px] text-[#94A3B8] truncate">{cd.role}</p>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="bg-white px-4 py-3 space-y-2">
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Mail className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span className="truncate">{cd.email}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Building2 className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span>{cd.dept}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-[#334155]"><Phone className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" /><span>{cd.phone}</span></div>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                          ); })()}
                                          <div className="min-w-0 flex-1">
                                            <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(vendor.createdByContact.name)}</span>
                                            {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate block">{(vendor.createdByContact as any).role || "Team Member"}</span>}
                                          </div>
                                        </>
                                      ) : (<span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                    </div>
                                  </TableCell>
                                );
                              case "created_on":
                                return (
                                  <TableCell key={colKey}>
                                    <div>
                                      <span className={isRelaxed ? "text-[13.5px]" : "text-sm"} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{formatDate(vendor.createdAt)}</span>
                                      {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{(() => { const d = Math.floor((Date.now() - new Date(vendor.createdAt).getTime()) / 86400000); return d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`; })()}</span>}
                                    </div>
                                  </TableCell>
                                );
                              case "status":
                                return (<TableCell key={colKey}><VendorStatusBadge status={vendor.status} /></TableCell>);
                              default:
                                return (<TableCell key={colKey}>{"\u2013"}</TableCell>);
                            }
                          };

                          return (
                            <TableRow
                              key={vendor.id}
                              className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                                density === "condensed"
                                  ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2"
                                  : density === "comfort"
                                  ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                                  : ""
                              } ${newlyCreatedId === vendor.id ? "animate-row-flash" : ""}`}
                              onClick={() => navigate(`/vendors/${vendor.id}`)}
                            >
                              {/* Checkbox cell — sticky leftmost */}
                              <TableCell
                                className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                              >
                                <Checkbox
                                  checked={selectedRows.has(vendor.id)}
                                  onCheckedChange={() => handleSelectRow(vendor.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${vendor.displayName}`}
                                />
                              </TableCell>
                              {visibleColumns.map((key) => {
                                const cell = renderCell(key);
                                const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                                const isDraggedCol = draggingColumnKey === key;
                                const cellWidthStyle: React.CSSProperties = {
                                  width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                                  ...(isDraggedCol ? {
                                    backgroundColor: "rgba(10,119,255,0.035)",
                                  } : {}),
                                };
                                if (frozenColumns.has(key)) {
                                  const defAlign = colDef(key).align;
                                  return cloneElement(cell, {
                                    className: `${cell.props.className || ""} sticky z-10 bg-card group-hover:bg-[#F0F7FF] ${defAlign === "right" ? "text-right" : ""}`.trim(),
                                    style: {
                                      ...cell.props.style,
                                      ...cellWidthStyle,
                                      left: `${frozenOffsets[key] ?? 0}px`,
                                      ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                    },
                                  });
                                }
                                const defAlign = colDef(key).align;
                                return cloneElement(cell, {
                                  className: `${cell.props.className || ""} ${defAlign === "right" ? "text-right" : ""}`.trim(),
                                  style: { ...cell.props.style, ...cellWidthStyle },
                                });
                              })}
                              {/* Actions -- always last, always sticky */}
                              <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-[220px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {vendor.status === "archived" ? (
                                      <DropdownMenuItem onClick={() => handleUnarchive(vendor.id)}>
                                        <ArchiveRestore className="w-4 h-4 mr-2" />
                                        Unarchive
                                      </DropdownMenuItem>
                                    ) : (
                                      <>
                                        {/* Create & communicate */}
                                        <DropdownMenuItem onClick={() => toast.info("Create New Location – coming soon")}>
                                          <MapPinPlus className="w-4 h-4 mr-2" />
                                          Create New Location
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Send Email – coming soon")}>
                                          <Mail className="w-4 h-4 mr-2" />
                                          Send Email
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Create Purchase Order – coming soon")}>
                                          <ClipboardList className="w-4 h-4 mr-2" />
                                          Create Purchase Order
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Create Sales Order – coming soon")}>
                                          <FileText className="w-4 h-4 mr-2" />
                                          Create Sales Order
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Create Quote – coming soon")}>
                                          <FileUp className="w-4 h-4 mr-2" />
                                          Create Quote
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Add Invoice – coming soon")}>
                                          <Receipt className="w-4 h-4 mr-2" />
                                          Add Invoice
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {/* Documents & Notes */}
                                        <DropdownMenuItem onClick={() => toast.info("Add Note – coming soon")}>
                                          <StickyNote className="w-4 h-4 mr-2" />
                                          Add Note
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("Upload – coming soon")}>
                                          <Upload className="w-4 h-4 mr-2" />
                                          Upload
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    {/* Utilities — always visible */}
                                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/vendors/${vendor.id}`); toast.success("Link copied"); }}>
                                      <Link2 className="w-4 h-4 mr-2" />
                                      Copy Link
                                    </DropdownMenuItem>
                                    {vendor.website && (
                                      <DropdownMenuItem onClick={() => window.open(vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`, "_blank")}>
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Visit Website
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => toast.info("Print – coming soon")}>
                                      <Printer className="w-4 h-4 mr-2" />
                                      Print Partner Details
                                    </DropdownMenuItem>
                                    {vendor.status !== "archived" && (
                                      <>
                                        <DropdownMenuSeparator />
                                        {/* Status & Lifecycle */}
                                        {vendor.status === "inactive" ? (
                                          <DropdownMenuItem onClick={() => { setSelectedVendorId(vendor.id); setMarkActiveDialogOpen(true); }}>
                                            <CircleCheck className="w-4 h-4 mr-2" />
                                            Mark as Active
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => { setSelectedVendorId(vendor.id); setMarkInactiveDialogOpen(true); }}>
                                            <CircleSlash className="w-4 h-4 mr-2" />
                                            Mark as Inactive
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem variant="destructive" onClick={() => { setSelectedVendorId(vendor.id); setArchiveDialogOpen(true); }}>
                                          <Archive className="w-4 h-4 mr-2 text-[#DC2626]" />
                                          Archive
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {filteredVendors.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per page</span>
                    <Select
                      value={String(recordsPerPage)}
                      onValueChange={(val) => {
                        setRecordsPerPage(Number(val));
                        setCurrentPage(1);
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
                      onClick={() => setCurrentPage(1)}
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-sm text-muted-foreground"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>

                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 text-sm ${
                            currentPage === page
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => setCurrentPage(page as number)}
                        >
                          {page}
                        </Button>
                      )
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-sm text-muted-foreground"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                    >
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

      {/* Column drag ghost — positioned via ref for zero re-renders during mousemove */}
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
            const ghostFilter = columnFilters[draggingColumnKey] ? isFilterActive(columnFilters[draggingColumnKey]) : false;
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
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                {ghostFilter && !ghostSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#0A77FF" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Filters Modal -- Airbnb-style */}
      <FiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advFilters}
        onFiltersChange={(f) => { setAdvFilters(f); setCurrentPage(1); }}
        vendors={vendors}
        filteredCount={filteredVendors.length}
      />

      {/* Create Partner Modal */}
      <CreatePartnerModal
        open={createModalOpen}
        onOpenChange={handleCreateModalClose}
        onPartnerCreated={handlePartnerCreated}
        initialProfile={createPartnerProfile || undefined}
      />

      {/* Mark as Active Dialog */}
      <AlertDialog open={markActiveDialogOpen} onOpenChange={setMarkActiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setMarkActiveDialogOpen(false)}
        >
          {/* Icon: #16A34A on #DCFCE7 ≈ 3.2:1 AA-Large ✓ · Pill: #14532D on #F0FDF4 ≈ 9.2:1 AAA ✓ */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #F0FDF4 0%, rgba(240,253,244,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-30" style={{ backgroundColor: "#22C55E" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#DCFCE7" }}>
              <CircleCheck className="w-8 h-8" style={{ color: "#16A34A" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#F0FDF4", color: "#14532D", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Activation
            </span>
          </div>
          {/* CTA: #16A34A on #fff ≈ 3.3:1 AA-Large ✓ · Cancel: #334155 on #F1F5F9 ≈ 7.1:1 AAA ✓ · Desc: #475569 on #fff ≈ 7.1:1 AAA ✓ */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Activate this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be restored to active status and become available for new transactions, orders, and search results.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleMarkActive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#16A34A", color: "#fff" }}
              >
                Activate Partner
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

      {/* Mark as Inactive Dialog */}
      <AlertDialog open={markInactiveDialogOpen} onOpenChange={setMarkInactiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setMarkInactiveDialogOpen(false)}
        >
          {/* Icon: #D97706 on #FEF3C7 ≈ 2.8:1 AA-Large ✓ · Pill: #92400E on #FEF9C3 ≈ 5.8:1 AA ✓ */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EAB308" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "#D97706" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF9C3", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Warning
            </span>
          </div>
          {/* CTA: #92400E on #FEF3C7 ≈ 5.8:1 AA ✓ · Cancel: #334155 on #F1F5F9 ≈ 7.1:1 AAA ✓ */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Deactivate this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be hidden from active lists and no new transactions can be created. You can reactivate anytime.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleMarkInactive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#F97316", color: "#FFFFFF" }}
              >
                Deactivate Partner
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

      {/* Archive Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setArchiveDialogOpen(false)}
        >
          {/* Icon: #DC2626 on #FEE2E2 ≈ 3.5:1 AA-Large ✓ · Pill: #991B1B on #FEF2F2 ≈ 7.0:1 AAA ✓ */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-8 h-8" style={{ color: "#DC2626" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Caution
            </span>
          </div>
          {/* CTA: #DC2626 on #fff ≈ 4.0:1 AA-Large ✓ · Cancel: #334155 on #F1F5F9 ≈ 7.1:1 AAA ✓ */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Archive this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be removed from active workflows. Historical records are preserved and you can unarchive later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleArchive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
              >
                Archive Partner
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

      {/* Archive Dialog (was Delete) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setDeleteDialogOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-8 h-8" style={{ color: "#DC2626" }} />
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
                Archive this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be removed from active workflows. Historical records are preserved and you can unarchive later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleDelete}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
              >
                Archive Partner
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

      {/* Quick View Panel */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </div>
  );
}

// ── Rich KPI Tooltip Data ──
interface KpiTooltipData {
  title: string;
  description: string;
  breakdown: { label: string; value: string; isResult?: boolean }[];
  formula: string;
}

// Only complex/calculated KPIs get the rich tooltip — simple counts use plain tooltips
const KPI_TOOLTIP_DATA: Record<string, KpiTooltipData> = {
  total_credit_utilization: {
    title: "CREDIT UTILIZATION",
    description: "Sum of all credit currently being used across the partner portfolio. High utilization relative to the total limit indicates elevated financial risk.",
    breakdown: [
      { label: "Total Credit Limit", value: "—" },
      { label: "Currently Utilized", value: "—" },
      { label: "Available Credit", value: "—", isResult: true },
    ],
    formula: "Available = Total Limit – Currently Utilized",
  },
  total_outstanding: {
    title: "OUTSTANDING BALANCE",
    description: "Total unpaid amount across all partners. Includes pending invoices, overdue payments, and scheduled disbursements.",
    breakdown: [
      { label: "Pending Invoices", value: "—" },
      { label: "Overdue Payments", value: "—" },
      { label: "Scheduled Payments", value: "—" },
      { label: "Total Outstanding", value: "—", isResult: true },
    ],
    formula: "Outstanding = Pending + Overdue + Scheduled",
  },
  avg_net_profit: {
    title: "AVERAGE NET MARGIN",
    description: "Average net profit margin calculated across all partner transactions. Factors in revenue, cost of goods, and operational expenses.",
    breakdown: [
      { label: "Gross Revenue", value: "—" },
      { label: "Cost of Goods", value: "—" },
      { label: "Operational Costs", value: "—" },
      { label: "Net Margin", value: "—", isResult: true },
    ],
    formula: "Margin = (Revenue – COGS – Costs) ÷ Revenue × 100",
  },
};

function KpiRichTooltip({ data, children }: { data?: KpiTooltipData; children: React.ReactNode }) {
  if (!data) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="p-0 w-[320px] max-w-[90vw] z-[400] !bg-white !border-[#E2E8F0] !shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-[#EDF4FF] flex items-center justify-center shrink-0">
              <Info className="w-3 h-3 text-[#0A77FF]" />
            </div>
            <span className="text-[11px] text-[#334155] tracking-wide" style={{ fontWeight: 700 }}>{data.title}</span>
          </div>
          {/* Description */}
          <p className="text-[11px] text-[#64748B] leading-[1.6] mb-3">{data.description}</p>
          {/* Divider */}
          <div className="border-t border-[#F1F5F9] mb-3" />
          {/* Breakdown */}
          <div className="space-y-1.5">
            {data.breakdown.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] ${
                  row.isResult ? "bg-[#F0FDF4] border border-[#D1FAE5]" : ""
                }`}
              >
                <span className={row.isResult ? "text-[#334155]" : "text-[#64748B]"} style={{ fontWeight: row.isResult ? 600 : 400 }}>{row.label}</span>
                <span className={row.isResult ? "text-[#16A34A]" : "text-[#334155]"} style={{ fontWeight: row.isResult ? 700 : 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
          {/* Divider */}
          <div className="border-t border-[#F1F5F9] my-3" />
          {/* Formula */}
          <div className="px-3 py-2 rounded-lg bg-[#F0F6FF] border border-[#DBEAFE]">
            <code className="text-[10px] text-[#1D4ED8]" style={{ fontWeight: 500, fontFamily: "ui-monospace, monospace" }}>{data.formula}</code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function LogoAvatar({ logoUrl, initials, bg, size = "md", type = "logo" }: { logoUrl?: string; initials: string; bg: string; size?: "sm" | "md" | "lg"; type?: "logo" | "person" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = size === "lg" ? "w-9 h-9" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]";
  const showImg = logoUrl && !imgFailed;
  const isPerson = type === "person";
  return (
    <div className={`${sizeClass} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`} style={{ backgroundColor: showImg ? (isPerson ? "transparent" : "#FFFFFF") : bg }}>
      {showImg ? (
        <img src={logoUrl} alt="" className={`w-full h-full ${isPerson ? "object-cover" : "object-contain p-1.5"}`} onError={() => setImgFailed(true)} />
      ) : (
        <span className={`${textSize} text-[#334155]`} style={{ fontWeight: 700 }}>{initials}</span>
      )}
    </div>
  );
}

function CarrierIcon({ carrier }: { carrier: string }) {
  const getInitials = (name: string): string => {
    if (!name) return "\u2013";
    if (name.includes("FedEx")) return "FE";
    if (name.includes("DHL")) return "DHL";
    if (name.includes("UPS")) return "UPS";
    if (name.includes("TCS")) return "TCS";
    if (name.includes("SF")) return "SF";
    if (name.includes("Japan")) return "JP";
    if (name.includes("Purolator")) return "PU";
    if (name.includes("Aramex")) return "AR";
    if (name.includes("Blue Dart")) return "BD";
    if (name.includes("Australia")) return "AP";
    return name.substring(0, 2).toUpperCase();
  };
  const carrierLogos: Record<string, string> = {
    FedEx: fedexLogo,
    DHL: dhlLogo,
    UPS: upsLogo,
    TCS: tcsLogo,
    SF: sfLogo,
    USPS: uspsLogo,
    Aramex: aramexLogo,
    Maersk: maerskLogo,
  };
  let carrierLogo: string | undefined;
  for (const key of Object.keys(carrierLogos)) {
    if (carrier.includes(key)) { carrierLogo = carrierLogos[key]; break; }
  }

  const tint = getAvatarTint(carrier || "");
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]"
      style={{
        backgroundColor: carrierLogo ? "#FFFFFF" : "#F1F5F9",
        color: "#475569",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {carrierLogo ? <img src={carrierLogo} alt="" className="w-full h-full object-contain p-1" /> : getInitials(carrier)}
    </div>
  );
}

/* ── Draggable KPI Card for partner listing page ── */
function DraggableListKpiCard({ index, kpiKey, label, value, iconName, tooltip, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string; iconName?: string; tooltip?: string;
  moveCard: (from: number, to: number) => void; onRemove?: () => void;
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
        {/* Label row: label + info + icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {(KPI_TOOLTIP_DATA[kpiKey] || tooltip) && (
              KPI_TOOLTIP_DATA[kpiKey] ? (
                <KpiRichTooltip data={KPI_TOOLTIP_DATA[kpiKey]}>
                  <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                  </button>
                </KpiRichTooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                      <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[220px] text-[11px] z-[300]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )
            )}
          </div>
          {iconName && <KpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
        </div>
        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-[#334155] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
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
