import { Fragment, useState, useMemo, useCallback, useEffect, cloneElement, useRef } from "react";
import { FlagImage, flagEmojiCode } from "../components/currency/FlagImage";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVendors } from "../context/VendorContext";
import { broadcastSpawnedCreation } from "../utils/spawnedCreationChannel";
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
  computeKpi,
  insightsRangePeriodLabel,
  kpiMoneySubset,
  kpiNumeric,
  MONEY_KPI_KEYS,
  RATE_KPI_KEYS,
  type KpiDelta,
} from "../components/vendors/KpiInsightsPanel";
import { CurrencyAmount } from "../components/currency/CurrencyAmount";
import { RateKpiValue } from "../components/currency/RateKpiValue";
import { BASE_CURRENCY } from "../currency/currencies";
import { formatCompactMoney } from "../currency/money";
import { toBaseNow } from "../currency/partnerCurrency";
import { currencyBreakdown, partnerAmount, type CurrencyView } from "../currency/partnerAmounts";
import { usePartnerCurrencyOf } from "../currency/usePartnerCurrency";
import { appUrl } from "@/embedding";
import { InsightsRangeMenu, InsightsRefresh, InsightsResetButton, type InsightsRange } from "../components/vendors/InsightsControls";
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
import { BulkActionBar, type BulkAction } from "../components/BulkActionBar";
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
import { ItemHoverCardContent } from "../components/vendors/ItemHoverCardContent";
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
  Pencil,
  Archive,
  RotateCcw,
  RefreshCw,
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
  Truck,
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
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Checkbox } from "../components/ui/checkbox";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { QuickViewPanel, mockLocationData, type QuickViewData } from "../components/vendors/QuickViewPanel";
import {
  FiltersModal,
  DEFAULT_FILTERS,
  countActiveFilters,
  type AdvancedFilters,
} from "../components/vendors/FiltersModal";
import { CreatePartnerModal } from "../components/vendors/CreatePartnerModal";
import { PrimaryPill } from "../components/vendors/PrimaryPill";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { PartnerType, Vendor } from "../data/vendors";
import { CATEGORY_LABELS } from "../data/vendors";

const DND_LIST_KPI = "LIST_KPI_CARD";

/* The money columns: each shows its amounts in the base currency (the
   default, comparable across partners) or in each partner's own currency,
   chosen from the column's header menu. Sorting and range filters always
   use the base-currency amount. */
type MoneyColumn = "net_profit" | "credit_limit" | "credit_utilization";
const isMoneyColumn = (key: string): key is MoneyColumn =>
  key === "net_profit" || key === "credit_limit" || key === "credit_utilization";

/** The money columns' note, shown in their header menu. */
const MONEY_COLUMN_NOTE = `Each partner's amount is kept in its own currency. Base shows it in ${BASE_CURRENCY} at today's mid-market rate; sorting and range filters use that.`;

// Module refresh v7
type QuickFilter = "all" | "customers" | "vendors" | "both" | "active" | "inactive" | "archived";
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

const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean; tone?: "destructive" }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "vendors", label: "Vendors", showCount: true },
  { key: "customers", label: "Customers", showCount: true },
  // Dual-role bucket — partners who carry both vendor + customer scope.
  // Sits next to Vendors / Customers so the role split is symmetric with
  // the Pricing Rules tab pattern (Customer Rules / Vendor Rules / Both).
  { key: "both", label: "Vendor + Customer", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  { key: "archived", label: "Archived", showCount: true, tone: "destructive" },
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
  { key: "partner_group", label: "Partner Group", minWidth: "240px" },
  { key: "net_profit", label: "Net Profit", minWidth: "150px", sortable: true, align: "right" },
  { key: "credit_limit", label: "Credit Limit", minWidth: "160px", sortable: true, align: "right" },
  { key: "credit_utilization", label: "Credit Utilization", minWidth: "180px", sortable: true, align: "right" },
  { key: "services", label: "Services", minWidth: "200px" },
  { key: "carrier_vendor", label: "Carrier (Vendor)", minWidth: "240px" },
  { key: "carrier_customer", label: "Carrier (Customer)", minWidth: "240px" },
  { key: "country", label: "Country", minWidth: "200px" },
  { key: "website", label: "Website", minWidth: "220px" },
  { key: "email", label: "Email", minWidth: "280px" },
  { key: "last_updated_by", label: "Last Updated By", minWidth: "240px" },
  { key: "last_updated_on", label: "Last Updated On", minWidth: "170px" },
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
const CHECKBOX_COL_WIDTH = 44; // width of the checkbox column in px (full-cell hit area)

// A partner belongs to one PRIMARY group plus zero-or-more secondary groups.
// The mock data only carries a single primaryGroup id, so we derive a stable
// secondary set deterministically from the partner id. Returns the primary
// group (always shown) and the rest (surfaced behind "+N more").
function getVendorGroups(vendorId: string, primaryGroupId: string): { primary: typeof PARTNER_GROUPS[number]; others: typeof PARTNER_GROUPS[number][] } {
  let h = 0;
  for (let i = 0; i < vendorId.length; i++) h = vendorId.charCodeAt(i) + ((h << 5) - h);
  h = Math.abs(h);
  const primary = PARTNER_GROUPS.find((g) => g.id === primaryGroupId) ?? PARTNER_GROUPS[h % PARTNER_GROUPS.length];
  const pool = PARTNER_GROUPS.filter((g) => g.id !== primary.id);
  const count = h % 5; // 0–4 secondary groups
  const others: typeof PARTNER_GROUPS[number][] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    others.push(pool[(h + i * 7) % pool.length]);
  }
  // De-dupe in case the stride collides.
  const seen = new Set<string>();
  return { primary, others: others.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true))) };
}

import { getAvatarTint } from "../utils/avatarTints";
import { getLastUpdated } from "../utils/lastUpdated";
import { usePersonLightbox } from "../components/vendors/PersonAvatarLightbox";

import { CONTACT_DICTIONARY, PARTNER_GROUPS } from "../components/vendors/partnerConstants";
import { usePartnerGroups } from "../context/PartnerGroupsContext";
import { PARTNERS_IMPORT_SPEC } from "../import-export/spec";
import { buildValidationContext } from "../import-export/validation";
import { useListingImportExport } from "../import-export/useListingImportExport";
import { TableEmptyRow, TableEmptyState, TableSkeletonRows, CardSkeletonGrid, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";

/* ─── Name → Contact ID resolver ─── */
const _cbNameMap: Record<string, string> = {};
CONTACT_DICTIONARY.forEach((c) => { if (!_cbNameMap[c.name]) _cbNameMap[c.name] = c.id; });
function resolveContactId(name: string): string {
  if (!name) return CONTACT_DICTIONARY[0].id;
  if (_cbNameMap[name]) return _cbNameMap[name];
  // Fallback: hash to an existing contact
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CONTACT_DICTIONARY[Math.abs(h) % CONTACT_DICTIONARY.length].id;
}

/* Partners listing — lazy loaded via routes.ts */
export interface VendorsListPageProps {
  /** When true, hides page chrome (top bar, page header, KPI section, Create button) for embedding inside another page (e.g., Contact Detail's Linked Partners tab) */
  embedded?: boolean;
  /** Override the vendors data source (e.g., a filtered subset for Linked Partners). When omitted, uses the full list from context. */
  embeddedVendors?: ReturnType<typeof useVendors>["vendors"];
  /** Initial column visibility map for embedded mode (e.g., a trimmed default set for sub-tab use). All columns remain available via the column selector. */
  embeddedDefaultColumnVisibility?: Record<string, boolean>;
  /** Initial density for embedded mode. Defaults to "condensed". */
  embeddedDefaultDensity?: DensityOption;
  /** Embedded-mode primary CTA — renders in the table toolbar (right side, where the listing page would otherwise show "Create New-Partner"). Used by surfaces like Partner Group Details → Linked Partners to surface "Add Partner". */
  embeddedPrimaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  /** Embedded-mode row-actions override — when provided, the row's "⋯" dropdown renders these items in the TOP section instead of the default Edit/Create/Send/etc. block. Receives the row's vendor and should return DropdownMenuItem(s). */
  embeddedRowActions?: (vendor: ReturnType<typeof useVendors>["vendors"][number]) => React.ReactNode;
  /** Embedded-mode lifecycle-row-actions slot — appended to the lifecycle section (after Archive). Used by surfaces like Partner Group Details to surface a destructive group-scoped action (e.g. "Unlink from group") alongside the canonical Archive / Mark as Inactive. */
  embeddedRowActionsLifecycle?: (vendor: ReturnType<typeof useVendors>["vendors"][number]) => React.ReactNode;
  /** Embedded-mode FULL row-actions override — when provided, the row's "⋯" dropdown (in every density, including card view) renders ONLY these items: no utilities, no lifecycle block. Used by surfaces like the Contact detail → Linked Partners tab where the row menu is scoped to the host record (View / Remove from this POC). Takes precedence over embeddedRowActions / embeddedRowActionsLifecycle. */
  embeddedRowActionsExclusive?: (vendor: ReturnType<typeof useVendors>["vendors"][number]) => React.ReactNode;
  /** When true (and embedded), drops the "Archived" quick-filter pill from the toolbar. Used by surfaces where archived partners shouldn't appear (e.g. Partner Group Details → Linked Partners). */
  embeddedHideArchivedFilter?: boolean;
  /** Set of partner ids that should render the canonical PrimaryPill next to their name in the Partner column. Used by Partner Group Details → Linked Partners to mark partners for whom this group is primary. */
  embeddedPrimaryPartnerIds?: Set<string>;
}

export function VendorsListPage({ embedded, embeddedVendors, embeddedDefaultColumnVisibility, embeddedDefaultDensity, embeddedPrimaryAction, embeddedRowActions, embeddedRowActionsLifecycle, embeddedRowActionsExclusive, embeddedHideArchivedFilter, embeddedPrimaryPartnerIds }: VendorsListPageProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ctx = useVendors();
  const { getVendor, addVendor, updateVendor, archiveVendor, restoreVendor, deleteVendor } = ctx;
  // When embedded, prefer the supplied vendors subset; otherwise use the full context list.
  const vendors = embeddedVendors ?? ctx.vendors;
  const { groups: partnerGroupsStore } = usePartnerGroups();
  // Each partner's currency: its own, else its primary group's (spec 4.2).
  const currencyOf = usePartnerCurrencyOf();
  /** A partner's amount (in its currency) in the base currency. */
  const inBase = useCallback((v: Vendor, amount: number | undefined) => toBaseNow(amount ?? 0, currencyOf(v)), [currencyOf]);
  const [columnCurrencyView, setColumnCurrencyView] = useState<Record<MoneyColumn, CurrencyView>>({
    net_profit: "base",
    credit_limit: "base",
    credit_utilization: "base",
  });
  /** A partner's amount in a money column, in the view that column is set to. */
  const listingMoney = (v: Vendor, amount: number | undefined, column: MoneyColumn) => (
    <CurrencyAmount {...partnerAmount(amount ?? 0, currencyOf(v), columnCurrencyView[column])} />
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>(embeddedDefaultDensity ?? "condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markActiveDialogOpen, setMarkActiveDialogOpen] = useState(false);
  const [markInactiveDialogOpen, setMarkInactiveDialogOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  /* ─── Advanced Filters state ─── */
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Record<string, unknown> | null>(null);

  // Read URL param for auto-opening create modal with a specific profile
  const createPartnerProfile = searchParams.get("createPartner");
  // True when this tab was spawned from another tab's "Create New Carrier"
  // (or similar) CTA — on success we broadcast the new vendor to the
  // originating tab + close ourselves rather than routing into details.
  const [spawnedForCarrierCreation, setSpawnedForCarrierCreation] = useState(false);
  useEffect(() => {
    if (createPartnerProfile) {
      setCreateModalOpen(true);
      if (createPartnerProfile === "carrier") {
        setSpawnedForCarrierCreation(true);
      }
    }
  }, [createPartnerProfile]);

  const handleCreateModalClose = useCallback((open: boolean) => {
    setCreateModalOpen(open);
    if (!open) {
      setEditingVendor(null);
      if (createPartnerProfile) {
        // Clear the URL param when modal closes
        searchParams.delete("createPartner");
        setSearchParams(searchParams, { replace: true });
      }
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
      const vendorType = (data.vendorType as string) || "Vendor";
      const partnerGroup = (data.partnerGroup as string) || "";

      // Extract config data from Step 3
      const configPaymentMethods = data.configPaymentMethods as any[] | undefined;
      const configPaymentTerm = data.configPaymentTerm as Record<string, unknown> | undefined;
      const configPricingRules = data.configPricingRules as any[] | undefined;
      const configPointsOfContact = data.configPointsOfContact as any[] | undefined;
      // A partner has one currency (spec 4.2), saved with its credit limit.
      // An override made in either side's Billing & Shipping is kept (the
      // vendor side's first). Left as inherited, no currency is saved, so the
      // partner follows its group's.
      const customerSideConfig = (data.customerConfig as Record<string, unknown> | undefined) ?? {};
      const configuredSides = [data as Record<string, unknown>, customerSideConfig].filter((c) => c.configCreditLimit);
      const overrideSide = configuredSides.find((c) => c.currencyInherited === false);
      const sideCreditLimit = configuredSides[0]?.configCreditLimit as Record<string, unknown> | undefined;
      const configCreditLimit = sideCreditLimit && {
        ...sideCreditLimit,
        currency: (overrideSide?.configCreditLimit as { currency?: string } | undefined)?.currency,
      };
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
        createdByContact: { initials: "AA", name: "Ahtisham Ahmad", bgColor: "#6366f1", photoUrl: "/avatars/ahtisham-ahmad.jpg" },
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

      // Spawned-creation path: this tab was opened from another tab's
      // "Create New Carrier" CTA solely to create one record. Broadcast
      // it back to the originating tab's carrier picker, then close
      // ourselves so focus snaps back to the partner-creation flow.
      if (spawnedForCarrierCreation) {
        broadcastSpawnedCreation({
          kind: "carrier",
          payload: newVendor as unknown as Record<string, unknown>,
        });
        window.close();
        return;
      }

      // Navigate directly to the new partner's details page
      navigate(`/vendors/${newVendor.id}`);

      // Show success toast
      toast.success(`Partner "${name}" created successfully`, {
        duration: 5000,
      });
    },
    [addVendor, navigate, spawnedForCarrierCreation]
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
    const willFreeze = !(frozenColumns.has(columnKey) && columnKey !== "partner_name");
    const nextFrozen = new Set(frozenColumns);
    if (willFreeze) nextFrozen.add(columnKey);
    else nextFrozen.delete(columnKey);
    setFrozenColumns(nextFrozen);

    // Keep the frozen block contiguous at the left: snap the toggled column to
    // the freeze boundary. On freeze it lands at the end of the frozen block;
    // on unfreeze it becomes the first unfrozen column. frozenOffsets assumes
    // this contiguity, and it matches the drag constraint that blocks columns
    // from crossing the boundary.
    setColumnOrder((prevOrder) => {
      const order = prevOrder.filter((k) => k !== columnKey);
      let lastFrozenIdx = -1;
      order.forEach((k, i) => { if (nextFrozen.has(k)) lastFrozenIdx = i; });
      order.splice(lastFrozenIdx + 1, 0, columnKey);
      return order;
    });
  }, [frozenColumns]);

  /* ─── KPI Insights state ─── */
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const handleResetInsights = useCallback(() => {
    setActiveKpis([...DEFAULT_ACTIVE_KPIS]);
    toast.success("Insights reset to defaults");
  }, []);
  /* Reset stays grey until the band diverges from its default set/order —
   * mirrors Vendor Invoicing's dirty-aware InsightsResetButton. */
  const insightsDirty = activeKpis.join(",") !== DEFAULT_ACTIVE_KPIS.join(",");
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState<InsightsRange>("last_30");
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
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
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    embeddedDefaultColumnVisibility
      ? { ...DEFAULT_COLUMN_VISIBILITY, ...embeddedDefaultColumnVisibility }
      : { ...DEFAULT_COLUMN_VISIBILITY }
  );

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

        // Don't let the drag cross the freeze boundary: a frozen (sticky)
        // column may only be reordered among other frozen columns, and an
        // unfrozen column may only move among unfrozen columns. This keeps
        // the frozen block contiguous at the left (frozenOffsets assumes it)
        // and stops an unfrozen column from being pushed into the sticky area.
        if (frozenColumns.has(draggedKey) !== frozenColumns.has(k)) break;

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
  }, [isResizing, frozenColumns]);

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
      both: 0,
      active: 0,
      inactive: 0,
      archived: 0,
    };
    vendors.forEach((v) => {
      const types = v.partnerTypes || [];
      const isVendor = types.includes("vendor");
      const isCustomer = types.includes("customer");
      if (isCustomer) counts.customers++;
      if (isVendor) counts.vendors++;
      // Eli's split: the dual-role bucket is partners who carry both
      // partnerTypes simultaneously — same source of truth the partner-
      // location split uses. Solo-role partners stay in their respective
      // vendor/customer counts.
      if (isVendor && isCustomer) counts.both++;
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

      /* -- Quick filter (pill bar) --
         Cross-module rule: archived rows are hidden from the default
         listing and only surface when the Archived pill is explicitly
         selected. Inactive (Disabled) rows continue to render in the
         default view alongside Active. */
      let matchesFilter = true;
      if (quickFilter !== "archived" && v.status === "archived") {
        matchesFilter = false;
      } else {
        switch (quickFilter) {
          case "customers":
            matchesFilter = (v.partnerTypes || []).includes("customer");
            break;
          case "vendors":
            matchesFilter = (v.partnerTypes || []).includes("vendor");
            break;
          case "both":
            // Dual-role partners only — must carry both vendor AND customer
            // in partnerTypes. A solo-role partner doesn't make it into
            // this bucket even though the Vendor / Customer filters would
            // each include them on their own.
            matchesFilter = (v.partnerTypes || []).includes("vendor") && (v.partnerTypes || []).includes("customer");
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

      // Net Profit range (amounts in base currency, as the modal labels them)
      if (f.netProfitMin && inBase(v, v.netProfitMargin) < Number(f.netProfitMin)) return false;
      if (f.netProfitMax && inBase(v, v.netProfitMargin) > Number(f.netProfitMax)) return false;

      // Credit Limit range
      if (f.creditLimitMin && inBase(v, v.creditLimit) < Number(f.creditLimitMin)) return false;
      if (f.creditLimitMax && inBase(v, v.creditLimit) > Number(f.creditLimitMax)) return false;

      // Credit Utilization range
      if (f.creditUtilMin && inBase(v, v.creditUtilization) < Number(f.creditUtilMin)) return false;
      if (f.creditUtilMax && inBase(v, v.creditUtilization) > Number(f.creditUtilMax)) return false;

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
          // Money columns sort on the base-currency amount, whichever view is shown.
          case "net_profit": aVal = inBase(a, a.netProfitMargin); bVal = inBase(b, b.netProfitMargin); break;
          case "credit_limit": aVal = inBase(a, a.creditLimit); bVal = inBase(b, b.creditLimit); break;
          case "credit_utilization": aVal = inBase(a, a.creditUtilization); bVal = inBase(b, b.creditUtilization); break;
          case "created_on": aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
          case "last_updated_on": aVal = new Date(getLastUpdated(a.id, a.createdAt).date).getTime(); bVal = new Date(getLastUpdated(b.id, b.createdAt).date).getTime(); break;
          case "last_updated_by": aVal = getLastUpdated(a.id, a.createdAt).name; bVal = getLastUpdated(b.id, b.createdAt).name; break;
          default: aVal = (a as any)[key] || ""; bVal = (b as any)[key] || "";
        }

        if (typeof aVal === "string" && typeof bVal === "string") {
          return dir * aVal.localeCompare(bVal);
        }
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return result;
  }, [vendors, searchQuery, quickFilter, advFilters, columnFiltersList, sortConfig, inBase]);

  // "All" is represented by recordsPerPage === -1; resolve to the full set
  // length so the page math (totalPages/slice) still works as a single page.
  const effectiveRecordsPerPage = recordsPerPage === -1
    ? Math.max(1, filteredVendors.length)
    : recordsPerPage;
  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / effectiveRecordsPerPage));

  // Clamp currentPage when it exceeds totalPages (e.g. after vendor deletion
  // or external context changes that shrink the result set without an explicit
  // setCurrentPage(1) call from a filter handler).
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * effectiveRecordsPerPage;
    return filteredVendors.slice(start, start + effectiveRecordsPerPage);
  }, [filteredVendors, currentPage, effectiveRecordsPerPage]);

  /* -- Global empty / error states -- */
  const tableLoad = useTableLoadState();
  // Insight cards come from the same failed load: show the card's
  // "Couldn't load" state instead of numbers (no value, no trend).
  const insightsFailed = tableLoad.loadState === "error";
  const filterLayerCount =
    (quickFilter !== "all" ? 1 : 0) + activeFilterCount + Object.keys(columnFilters).length;
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : vendors.length,
    filteredCount: tableLoad.forceEmpty ? 0 : filteredVendors.length,
    pageCount: paginatedVendors.length,
    searchQuery,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(
      searchQuery,
      vendors.flatMap((v) => [v.companyName, v.displayName, v.code, v.primaryContact?.name, v.billingAddress?.city, v.country, v.emailAddress]),
    );
  }, [emptyKind, searchQuery, vendors]);

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

  /* ─── Shared row-actions menu — single source of truth for the "⋯"
   *  dropdown across every density (table rows AND card view) so the
   *  menus never drift apart. */
  const renderRowActionItems = (vendor: (typeof paginatedVendors)[number]) =>
    embedded && embeddedRowActionsExclusive ? (
      /* Exclusive override — host surface owns the entire menu (e.g.
         Contact → Linked Partners: View + Remove from this POC only). */
      embeddedRowActionsExclusive(vendor)
    ) : (
      <>
        {embedded && embeddedRowActions ? (
          embeddedRowActions(vendor)
        ) : vendor.status === "archived" ? (
          <DropdownMenuItem
            onClick={() => handleUnarchive(vendor.id)}
            className="focus:bg-emerald-50"
            style={{ color: "#059669" }}
          >
            <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
            Unarchive
          </DropdownMenuItem>
        ) : (
          <>
            {/* Edit */}
            <DropdownMenuItem onClick={() => { setEditingVendor(vendor as unknown as Record<string, unknown>); setCreateModalOpen(true); }}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Partner
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Create & communicate */}
            <DropdownMenuItem onClick={() => toast.info("Create New Location, coming soon")}>
              <MapPinPlus className="w-4 h-4 mr-2" />
              Create New Location
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Send Email, coming soon")}>
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Create Purchase Order, coming soon")}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Create Purchase Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Create Sales Order, coming soon")}>
              <FileText className="w-4 h-4 mr-2" />
              Create Sales Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Create Quote, coming soon")}>
              <FileUp className="w-4 h-4 mr-2" />
              Create Quote
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Add Invoice, coming soon")}>
              <Receipt className="w-4 h-4 mr-2" />
              Add Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Documents & Notes */}
            <DropdownMenuItem onClick={() => toast.info("Add Note, coming soon")}>
              <StickyNote className="w-4 h-4 mr-2" />
              Add Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Upload, coming soon")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Utilities — always visible */}
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(new URL(appUrl(`/vendors/${vendor.id}`), window.location.origin).href); toast.success("Link copied"); }}>
          <Link2 className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        {vendor.website && (
          <DropdownMenuItem onClick={() => window.open(vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Visit Website
          </DropdownMenuItem>
        )}
        {vendor.status !== "archived" && (
          <>
            <DropdownMenuSeparator />
            {/* Lifecycle slot — embedded surfaces (e.g. Linked Partners)
                prepend their group-scoped destructive action here so the
                cluster reads: Unlink → Mark as Active/Inactive → Archive
                (group-context first, partner-level state second). */}
            {embedded && embeddedRowActionsLifecycle && embeddedRowActionsLifecycle(vendor)}
            {/* Status & Lifecycle — colors mirror the modal CTA palette so
                the menu reads as a quick path to the same action: amber for
                inactivate, green for activate, red for archive. */}
            {vendor.status === "inactive" ? (
              <DropdownMenuItem
                onClick={() => { setSelectedVendorId(vendor.id); setMarkActiveDialogOpen(true); }}
                className="focus:bg-emerald-50"
                style={{ color: "#059669" }}
              >
                <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                Mark as Active
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => { setSelectedVendorId(vendor.id); setMarkInactiveDialogOpen(true); }}
                className="focus:bg-amber-50"
                style={{ color: "#B45309" }}
              >
                <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
                Mark as Inactive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => { setSelectedVendorId(vendor.id); setArchiveDialogOpen(true); }} className="focus:bg-red-50">
              <Archive className="w-4 h-4 mr-2 text-destructive" />
              Archive
            </DropdownMenuItem>
          </>
        )}
      </>
    );

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

  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  /* ─── Drag-to-select state ───
   * Click on a checkbox cell + drag down/up to extend selection across
   * consecutive rows. Eli explicitly required this — no per-row re-click. */
  const dragSelectRef = useRef<{
    anchorId: string;
    anchorIndex: number;
    mode: "add" | "remove";
    /** Ids touched in the *current* drag — restored if the user drags back past them. */
    touched: Set<string>;
    /** Snapshot of selectedRows at drag start, so we can recompute deterministically. */
    baseline: Set<string>;
  } | null>(null);

  /** Visible-row order on the current page — drives the contiguous range during drag. */
  const visibleRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    paginatedVendors.forEach((v, i) => map.set(v.id, i));
    return map;
  }, [paginatedVendors]);

  const handleCheckboxMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    // Only react to primary button; ignore modified clicks (let the browser do its thing).
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const idx = visibleRowIndex.get(id);
    if (idx === undefined) return;

    setSelectedRows((prev) => {
      const baseline = new Set(prev);
      const isSelected = baseline.has(id);
      const mode: "add" | "remove" = isSelected ? "remove" : "add";

      dragSelectRef.current = {
        anchorId: id,
        anchorIndex: idx,
        mode,
        touched: new Set<string>([id]),
        baseline,
      };

      const next = new Set(baseline);
      if (mode === "add") next.add(id); else next.delete(id);
      return next;
    });
  }, [visibleRowIndex]);

  const handleCheckboxMouseEnter = useCallback((id: string) => {
    const drag = dragSelectRef.current;
    if (!drag) return;

    const idx = visibleRowIndex.get(id);
    if (idx === undefined) return;

    const [lo, hi] = drag.anchorIndex <= idx
      ? [drag.anchorIndex, idx]
      : [idx, drag.anchorIndex];

    setSelectedRows(() => {
      const next = new Set(drag.baseline);
      // Reset any rows previously touched in this drag that are no longer in range.
      drag.touched.forEach((touchedId) => {
        const tIdx = visibleRowIndex.get(touchedId);
        if (tIdx === undefined || tIdx < lo || tIdx > hi) {
          // Revert to baseline state.
          if (drag.baseline.has(touchedId)) next.add(touchedId);
          else next.delete(touchedId);
        }
      });
      // Apply mode across the current range.
      for (let i = lo; i <= hi; i++) {
        const rowId = paginatedVendors[i]?.id;
        if (!rowId) continue;
        drag.touched.add(rowId);
        if (drag.mode === "add") next.add(rowId);
        else next.delete(rowId);
      }
      return next;
    });
  }, [paginatedVendors, visibleRowIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const end = () => { dragSelectRef.current = null; };
    window.addEventListener("mouseup", end);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("dragend", end);
    };
  }, []);

  /* ─── ESC clears selection ─── */
  useEffect(() => {
    if (selectedRows.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Skip when focus is in an input/textarea/contenteditable — let the
      // native ESC behaviour win (e.g. clearing a search field, closing a
      // popover). Otherwise treat ESC as "cancel selection."
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      setSelectedRows(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRows.size]);

  /* ─── Bulk action confirm dialogs ─── */
  const [bulkConfirm, setBulkConfirm] = useState<"inactive" | "active" | "archive" | null>(null);

  const selectedVendors = useMemo(
    () => vendors.filter((v) => selectedRows.has(v.id)),
    [vendors, selectedRows],
  );

  /* Per-action target subsets — each CTA only counts (and only operates on)
   * the rows where the action makes sense. Already-inactive rows are excluded
   * from "Mark as Inactive", already-archived rows are excluded from Archive,
   * and so on. */
  const markInactiveTargets = useMemo(
    () => selectedVendors.filter((v) => v.status === "active"),
    [selectedVendors],
  );
  const markActiveTargets = useMemo(
    () => selectedVendors.filter((v) => v.status === "inactive"),
    [selectedVendors],
  );
  const archiveTargets = useMemo(
    () => selectedVendors.filter((v) => v.status !== "archived"),
    [selectedVendors],
  );

  /* ─── Import / Export (Actions menu, Export modal, Import wizard) ───
   * Archived partners never reach the export flow or its counts. */
  const exportableVendors = useMemo(() => vendors.filter((v) => v.status !== "archived"), [vendors]);
  const exportableFilteredVendors = useMemo(() => filteredVendors.filter((v) => v.status !== "archived"), [filteredVendors]);
  const partnerReferenceOptions = useMemo(
    () => ({
      groups: partnerGroupsStore.map((g) => g.name),
      contacts: Array.from(new Set(CONTACT_DICTIONARY.map((c) => c.name).filter(Boolean))),
    }),
    [partnerGroupsStore],
  );
  const importExport = useListingImportExport({
    spec: PARTNERS_IMPORT_SPEC,
    allRows: exportableVendors,
    filteredRows: exportableFilteredVendors,
    isFiltered: () => hasAnyFilter,
    clearFilters: () => clearAllFilters(),
    selectAll: () => setSelectedRows(new Set(exportableFilteredVendors.map((v) => v.id))),
    columnVisibility,
    buildValidationContext: () => buildValidationContext(PARTNERS_IMPORT_SPEC, ctx.vendors, partnerGroupsStore),
    referenceOptions: partnerReferenceOptions,
    onApplied: ({ created, updated }) => {
      const result = ctx.upsertImportedVendors([...created, ...updated], { groups: partnerGroupsStore });
      setCurrentPage(1);
      return result;
    },
  });
  const openSelectedExport = importExport.openSelectedExport;

  const handleBulkExport = useCallback(() => {
    if (selectedVendors.length === 0) return;
    openSelectedExport(selectedVendors.filter((v) => v.status !== "archived"));
  }, [selectedVendors, openSelectedExport]);

  const handleBulkMarkInactive = useCallback(() => {
    markInactiveTargets.forEach((v) => updateVendor(v.id, { status: "inactive" as const }));
    toast.success(`${markInactiveTargets.length} partner${markInactiveTargets.length === 1 ? "" : "s"} marked as inactive`);
    setSelectedRows(new Set());
    setBulkConfirm(null);
  }, [markInactiveTargets, updateVendor]);

  const handleBulkMarkActive = useCallback(() => {
    markActiveTargets.forEach((v) => updateVendor(v.id, { status: "active" as const }));
    toast.success(`${markActiveTargets.length} partner${markActiveTargets.length === 1 ? "" : "s"} marked as active`);
    setSelectedRows(new Set());
    setBulkConfirm(null);
  }, [markActiveTargets, updateVendor]);

  const handleBulkArchive = useCallback(() => {
    archiveTargets.forEach((v) => archiveVendor(v.id));
    toast.success(`${archiveTargets.length} partner${archiveTargets.length === 1 ? "" : "s"} archived`);
    setSelectedRows(new Set());
    setBulkConfirm(null);
  }, [archiveTargets, archiveVendor]);

  const bulkActions: BulkAction[] = useMemo(() => [
    { key: "export", label: "Export", icon: Download, onClick: handleBulkExport, tone: "neutral", count: selectedVendors.length },
    { key: "active", label: "Mark as Active", icon: CircleCheck, onClick: () => setBulkConfirm("active"), tone: "success", count: markActiveTargets.length },
    { key: "inactive", label: "Mark as Inactive", icon: CircleSlash, onClick: () => setBulkConfirm("inactive"), tone: "warning", count: markInactiveTargets.length },
    { key: "archive", label: "Archive", icon: Archive, onClick: () => setBulkConfirm("archive"), tone: "destructive", count: archiveTargets.length },
  ], [handleBulkExport, selectedVendors.length, markActiveTargets.length, markInactiveTargets.length, archiveTargets.length]);

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

  const emptyStateProps = emptyKind && {
    kind: emptyKind,
    entity: { singular: "partner", plural: "partners" },
    searchQuery,
    suggestion: searchSuggestion,
    onApplySuggestion: (s: string) => { setSearchQuery(s); setCurrentPage(1); },
    filterCount: filterLayerCount,
    onClearSearch: () => { setSearchQuery(""); setCurrentPage(1); },
    onClearFilters: () => {
      setQuickFilter("all");
      setAdvFilters({ ...DEFAULT_FILTERS });
      setColumnFilters({});
      setCurrentPage(1);
    },
    onClearAll: clearAllFilters,
    onRetry: tableLoad.retry,
    retrying: tableLoad.retrying,
    onFirstPage: () => setCurrentPage(1),
    ...(embedded
      ? { title: "No linked partners yet", description: "Partners linked to this record will show up here.", onCreate: embeddedPrimaryAction?.onClick, createLabel: embeddedPrimaryAction?.label }
      : { onCreate: () => setCreateModalOpen(true), createLabel: "Create New Partner" }),
  };


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
      "Ahtisham": "/avatars/ahtisham-ahmad.jpg",
      "Irtaza": "/avatars/irtaza-abid.jpg",
      "Mahreen": "/avatars/mahreen-ghafoor.png",
      "Nophil": "/avatars/nophil-anwer.png",
      "Eli": "/avatars/eli-rosenbloom.png",
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
    <div className={embedded ? "flex flex-col min-h-[calc(100vh-360px)] pb-4 bg-transparent" : "flex flex-col h-full bg-slate-50"}>
      {/* Top Bar — hidden when embedded */}
      {!embedded && (
      <div data-page-topbar className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0">
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
              placeholder="Search..."
              className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <img src="/avatars/ahtisham-ahmad.jpg" alt="Ahtisham Ahmad" className="w-8 h-8 rounded-full flex items-center justify-center object-cover" />
            <div className="hidden sm:block">
              <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Senior Product Designer</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Content */}
      <div className={embedded ? "flex-1 flex flex-col" : "flex-1 overflow-hidden flex flex-col min-h-0"}>
        <div className={embedded ? "flex-1 flex flex-col" : "p-3 flex-1 min-h-0 flex flex-col"}>
          {/* Page Header — hidden when embedded */}
          {!embedded && (
          <div data-page-heading className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 -mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgb(var(--accent))" }}>
                <Users className="w-4 h-4" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Partners</h1>
                <p className="text-xs text-muted-foreground">
                  Organize vendors, customers, and service partners, from suppliers and carriers to contractors, all in one place.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {importExport.actionsMenu}
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="bg-primary text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create New Partner
              </Button>
            </div>
          </div>
          )}

          {/* KPI Insights -- collapsible section (hidden when embedded) */}
          {!embedded && showInsights && activeKpiDefs.length > 0 && (
          <div className="mb-4 shrink-0">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                  Performance Insights
                </span>
                {/* Date Range Filter — shared invoicing control (incl. All time + Custom) */}
                <InsightsRangeMenu
                  range={insightsDateRange}
                  onRangeChange={setInsightsDateRange}
                  customFrom={insightsCustom.from}
                  customTo={insightsCustom.to}
                  onCustomChange={(from, to) => setInsightsCustom({ from, to })}
                />
                <InsightsRefresh />
              </div>
              <div className="flex items-center gap-2">
                <InsightsResetButton dirty={insightsDirty} onReset={handleResetInsights} />
                <button
                  onClick={() => setInsightsPanelOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
                >
                  <Plus className="w-3 h-3" />
                  Add Insights
                </button>
              </div>
            </div>

            {/* KPI Cards — draggable responsive grid */}
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const computed = computeKpi(kpi.key, vendors, insightsDateRange, currencyOf);
                  // Money KPIs: the base-currency total, with a hover listing
                  // the currencies of the partners it adds up. Rate KPIs: when
                  // the rates were last updated.
                  const value: React.ReactNode = insightsFailed
                    ? "—"
                    : MONEY_KPI_KEYS.has(kpi.key)
                      ? (
                        <CurrencyAmount
                          mode="aggregated-base"
                          compact
                          value={kpiNumeric(kpi.key, vendors, currencyOf)}
                          currency={BASE_CURRENCY}
                          partnerBreakdown={currencyBreakdown(kpiMoneySubset(kpi.key, vendors).map(currencyOf))}
                        />
                      )
                      : RATE_KPI_KEYS.has(kpi.key)
                        ? <RateKpiValue rateType={kpi.key === "market_rate" ? "mid" : "corporate"} />
                        : computed.value;
                  // Populate rich tooltip breakdowns with live data (only for complex KPIs)
                  const tooltipData = KPI_TOOLTIP_DATA[kpi.key];
                  if (tooltipData) {
                    // In the base currency, each partner converted from its own.
                    const sumInBase = (pick: (v: Vendor) => number | undefined) => vendors.reduce((s, v) => s + inBase(v, pick(v)), 0);
                    const totalCredit = sumInBase((v) => v.creditLimit);
                    const totalUtil = sumInBase((v) => v.creditUtilization);
                    const totalOutstanding = sumInBase((v) => v.outstandingBalance);
                    const fmt = (n: number) => formatCompactMoney(n, BASE_CURRENCY);
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
                      sub={insightsFailed ? "Couldn't load" : computed.sub}
                      delta={insightsFailed ? undefined : computed.delta}
                      rangeLabel={insightsRangePeriodLabel(insightsDateRange)}
                      iconName={kpi.iconName}
                      tooltip={kpi.tooltip}
                      formula={kpi.formula}
                      moveCard={moveKpi}
                      onRemove={() => handleToggleKpi(kpi.key)}
                    />
                  );
                })}
              </div>
            </DndProvider>
          </div>
          )}

          {/* KPI Insights Panel — hidden when embedded */}
          {!embedded && (
          <KpiInsightsPanel
            open={insightsPanelOpen}
            onOpenChange={setInsightsPanelOpen}
            activeKpis={activeKpis}
            onToggleKpi={handleToggleKpi}
            vendors={vendors}
          />
          )}

          {!embedded && importExport.notice}

          {/* Unified Table Container with Search, Filters & Data */}
          <div className={`border border-border rounded-xl bg-card flex flex-1 min-h-0 ${embedded ? "" : "overflow-clip"}`}>
            <div className={`flex-1 min-w-0 flex flex-col ${embedded ? "" : "overflow-clip"}`}>
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
                        style={{ backgroundColor: "rgb(var(--primary))", fontWeight: 600 }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Count + Column Selector + Density Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span data-table-meta className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
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

                  {!embedded && <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />}

                  {/* Insights toggle button — hidden when embedded since the
                      KPI panel itself is already gated off in embedded mode
                      (clicking would no-op). */}
                  {!embedded && (
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
                          style={{ backgroundColor: "rgb(var(--accent))", color: "rgb(var(--primary))", fontWeight: 600 }}
                        >
                          {activeKpiDefs.length}
                        </span>
                      )}
                    </button>
                  )}

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
                          {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                        </DropdownMenuItem>
                      ))}
                      {/* Card size options — only when card view is active */}
                      {density === "card" && (
                        <>
                          <div className="mx-2 my-1.5 border-t border-muted" />
                          <div className="px-3 py-1.5">
                            <p className="text-[10px] text-slate-400 tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                            <div className="flex items-center gap-1.5">
                              {(["large", "medium", "small"] as const).map((size) => (
                                <button
                                  key={size}
                                  onClick={() => setCardSize(size)}
                                  className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                                    cardSize === size
                                      ? "bg-primary text-white shadow-sm"
                                      : "bg-muted text-slate-500 hover:bg-border"
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
                    disabled={density === "card"}
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />
                  {/* Embedded-mode primary CTA (e.g. "Add Partner" on the
                      Partner Group Details → Linked Partners tab). Sits in
                      the toolbar where the listing page's "Create New-Partner"
                      header CTA would otherwise live. */}
                  {embedded && embeddedPrimaryAction && (
                    <>
                      <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
                      <Button
                        size="sm"
                        onClick={embeddedPrimaryAction.onClick}
                        className="h-9 gap-1.5 px-3 rounded-lg shadow-sm"
                      >
                        {embeddedPrimaryAction.icon ?? <Plus className="w-4 h-4" />}
                        <span className="text-sm" style={{ fontWeight: 500 }}>
                          {embeddedPrimaryAction.label}
                        </span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Quick Filter Pills — replaced by the Bulk Action Bar
                  when one or more rows are selected, so users see actions in
                  the same horizontal slot instead of stacking two toolbars. */}
              {selectedRows.size > 0 ? (
                <BulkActionBar
                  count={selectedRows.size}
                  noun="partner"
                  actions={bulkActions}
                  onClear={handleClearSelection}
                />
              ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                {/* Me mode pill */}
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors whitespace-nowrap shrink-0 cursor-pointer">
                  <User className="w-3.5 h-3.5" />
                  Me Mode
                </button>

                {/* Separator */}
                <div className="w-px h-5 bg-border shrink-0" />

                {/* Filter pills */}
                {(embedded && embeddedHideArchivedFilter
                  ? QUICK_FILTER_OPTIONS.filter((o) => o.key !== "archived")
                  : QUICK_FILTER_OPTIONS
                ).map((filter) => {
                  const isActive = quickFilter === filter.key;
                  const count = filterCounts[filter.key];
                  const isDestructive = filter.tone === "destructive";
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
                    <Fragment key={filter.key}>
                    {filter.key === "archived" && <div className="w-px h-5 bg-border shrink-0" />}
                    <button
                      onClick={() => {
                        setQuickFilter(filter.key);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${baseClass}`}
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive
                          ? (isDestructive ? 'rgb(var(--destructive))' : 'rgb(var(--primary))')
                          : (isDestructive ? 'rgb(var(--destructive))' : undefined),
                      }}
                    >
                      {isDestructive && <Archive className="w-3 h-3" />}
                      {filter.label}
                      {filter.showCount && (
                        <span
                          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                            isActive
                              ? (isDestructive ? "bg-red-100" : "bg-primary/10")
                              : (isDestructive ? "bg-red-50" : "bg-muted")
                          }`}
                          style={{
                            fontWeight: 600,
                            color: isActive
                              ? (isDestructive ? 'rgb(var(--destructive))' : 'rgb(var(--primary))')
                              : (isDestructive ? 'rgb(var(--destructive))' : 'rgb(var(--muted-foreground))'),
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                    </Fragment>
                  );
                })}
              </div>
              )}

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
                <div className={embedded ? "p-4" : "p-4 min-h-0 overflow-y-auto flex-1"}>
                  {tableLoad.loadState === "loading" ? (
                    <CardSkeletonGrid />
                  ) : emptyStateProps ? (
                    <TableEmptyState {...emptyStateProps} />
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
                            onClick={() => {
                              if (embedded) window.open(`/vendors/${vendor.id}`, "_blank", "noopener");
                              else navigate(`/vendors/${vendor.id}`);
                            }}
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
                                <DropdownMenuContent align="end" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
                                  {/* Same shared menu as the table densities so
                                      all views stay in sync. */}
                                  {renderRowActionItems(vendor)}
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
                                    backgroundColor: type === "vendor" ? "#EBF3FF" : "#F5F3FF",
                                    color: type === "vendor" ? "#0548A3" : "#5B21B6",
                                    borderColor: type === "vendor" ? "#A8D2FF" : "#DDD6FE",
                                  }}
                                >
                                  {type === "vendor" ? "Vendor" : "Customer"}
                                </span>
                              ))}
                              {(() => {
                                // Vendor Rules / Buyer are the base vendor-side
                                // and customer-side roles — every partner has
                                // them, so they don't earn a subtype pill. Only
                                // meaningful subtype overlays (Carrier today,
                                // future ones tomorrow) render here.
                                const vSubs = (vendor.vendorSubTypes || []).filter(s => s !== "Vendor Rules");
                                const cSubs = (vendor.customerSubTypes || []).filter(s => s !== "Customer Rules");
                                return (
                                  <>
                                    {vSubs.length > 0 && (
                                      <>
                                        <span className="inline-flex items-center px-1.5 py-px rounded-full text-[9px] border" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
                                          {vSubs[0]}
                                        </span>
                                        {vSubs.length > 1 && (
                                          <span className="inline-flex items-center px-1 py-px rounded-full text-[9px] border" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{vSubs.length - 1}</span>
                                        )}
                                      </>
                                    )}
                                    {cSubs.length > 0 && (
                                      <>
                                        <span className="inline-flex items-center px-1.5 py-px rounded-full text-[9px] border" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
                                          {cSubs[0]}
                                        </span>
                                        {cSubs.length > 1 && (
                                          <span className="inline-flex items-center px-1 py-px rounded-full text-[9px] border" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{cSubs.length - 1}</span>
                                        )}
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Credit Limit</span>
                                <span className="text-foreground" style={{ fontWeight: 500 }}>
                                  {listingMoney(vendor, vendor.creditLimit, "credit_limit")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Country</span>
                                <span className="text-foreground">
                                  <FlagImage code={flagEmojiCode(vendor.countryFlag)} className="text-[13px]" /> {vendor.country}
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
                <div className={`${embedded ? "overflow-x-auto" : "min-h-0 overflow-auto flex-1"} ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                  <Table style={{ tableLayout: "fixed", width: `max(${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px, 100%)` }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                        density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                      }`}>
                        {/* Checkbox column — sticky leftmost. Whole cell is the hit-area. */}
                        <TableHead
                          className="sticky left-0 z-20 bg-slate-50 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none"
                          onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
                          aria-label="Select all rows on this page"
                        >
                          <div className="flex h-full w-full items-center justify-center">
                            <Checkbox
                              checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                              tabIndex={-1}
                              className="pointer-events-none"
                              aria-hidden="true"
                            />
                          </div>
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
                              className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
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
                                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "rgb(var(--primary))" }} />
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
                                  currencyView={isMoneyColumn(key) ? columnCurrencyView[key] : undefined}
                                  onCurrencyViewChange={isMoneyColumn(key) ? (view) => setColumnCurrencyView((prev) => ({ ...prev, [key]: view })) : undefined}
                                  currencyNote={isMoneyColumn(key) ? MONEY_COLUMN_NOTE : undefined}
                                >
                                  <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                    <span className="text-[13px]" style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                                    {hasFilter && !currentColSort && (
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                                    )}
                                    {currentColSort === "asc" && (
                                      <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
                                    )}
                                    {currentColSort === "desc" && (
                                      <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
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
                        {selectedRows.size === 0 && (
                          <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}><span className="text-[13px]">Actions</span></TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableLoad.loadState === "loading" ? (
                        <TableSkeletonRows columns={visibleColumns.length + (selectedRows.size > 0 ? 1 : 2)} />
                      ) : emptyStateProps ? (
                        <TableEmptyRow colSpan={visibleColumns.length + (selectedRows.size > 0 ? 1 : 2)} {...emptyStateProps} />
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
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate`} style={{ fontWeight: 500, color: '#1E293B' }}>{highlightText(vendor.displayName)}</span>
                                          {embedded && embeddedPrimaryPartnerIds?.has(vendor.id) && (
                                            <PrimaryPill size="xs" className="shrink-0" />
                                          )}
                                        </div>
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
                                        <span key={type} className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: type === "vendor" ? "#EBF3FF" : "#F5F3FF", color: type === "vendor" ? "#0548A3" : "#5B21B6", borderColor: type === "vendor" ? "#A8D2FF" : "#DDD6FE" }}>
                                          {type === "vendor" ? "Vendor" : "Customer"}
                                        </span>
                                      ))}
                                    </div>
                                  </TableCell>
                                );
                              case "vendor_sub_types": {
                                const vst = (vendor.vendorSubTypes || []).filter((s) => s !== "Vendor Rules");
                                const vstExtra = vst.length > 1 ? vst.length - 1 : 0;
                                return (
                                  <TableCell key={colKey}>
                                    {vst.length > 0 ? (
                                      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
                                        <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
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
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{vstExtra}</span>
                                          </OverflowTooltip>
                                        )}
                                      </div>
                                    ) : (<span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                  </TableCell>
                                );
                              }
                              case "customer_sub_types": {
                                const cst = (vendor.customerSubTypes || []).filter((s) => s !== "Customer Rules");
                                const cstExtra = cst.length > 1 ? cst.length - 1 : 0;
                                return (
                                  <TableCell key={colKey}>
                                    {cst.length > 0 ? (
                                      <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
                                        <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
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
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{cstExtra}</span>
                                          </OverflowTooltip>
                                        )}
                                      </div>
                                    ) : (<span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                  </TableCell>
                                );
                              }
                              case "num_items": {
                                const ITEM_PHOTOS_CELL = [
                                  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1713575882582-8938739db351?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=80&h=80&fit=crop",
                                ];
                                let itemPhotoHash = 0; for (let c = 0; c < vendor.id.length; c++) itemPhotoHash = vendor.id.charCodeAt(c) + ((itemPhotoHash << 5) - itemPhotoHash);
                                const itemPhotoUrl = ITEM_PHOTOS_CELL[Math.abs(itemPhotoHash) % ITEM_PHOTOS_CELL.length];
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {(() => {
                                        /* Deterministic item mock data for hover card — fields
                                           mirror the canonical Items Library listing columns
                                           (category, inventory control, on-hand + unit, status,
                                           preferred acquisition) via the shared ItemHoverCardContent. */
                                        const code0 = itemCodes[0] || "";
                                        let ih = 0; for (let c = 0; c < code0.length; c++) ih = code0.charCodeAt(c) + ((ih << 5) - ih);
                                        const aih = Math.abs(ih);
                                        const ITEM_DESCS_HC = ["Zinc-plated hex head screw, industrial grade", "Deep groove ball bearing, sealed type", "DC relay, SPDT, 10A contact rating", "Push-to-connect fitting, brass tube", "Stainless welding rod, 3/32\" diameter", "Cut-resistant safety gloves, ANSI A4", "Classical V-belt, B68, heavy duty", "Inductive proximity sensor, M12 barrel"];
                                        const ITEM_CATS = ["Fasteners", "Bearings", "Electrical", "Pneumatics", "Welding", "Safety", "Power Trans", "Sensors"];
                                        const ITEM_MFRS = ["BoltMaster Inc.", "MotionPro", "CircuitPro", "AirLine", "WeldPro", "SafeHand", "DrivePro", "SenseLogic"];
                                        const ITEM_UNITS = ["EA", "PK", "BX", "ft", "SET", "RL"];
                                        const hcDesc = ITEM_DESCS_HC[aih % ITEM_DESCS_HC.length];
                                        const hcCat = ITEM_CATS[aih % ITEM_CATS.length];
                                        const hcMfr = ITEM_MFRS[aih % ITEM_MFRS.length];
                                        const hcUnit = ITEM_UNITS[aih % ITEM_UNITS.length];
                                        const hcControl = aih % 3 === 0 ? "Serialized" : "Non-Serialized";
                                        const hcStatus: "Active" | "Inactive" = aih % 7 === 0 ? "Inactive" : "Active";
                                        const hcAcq = aih % 2 === 0 ? "Purchased" : "Manufactured";
                                        const hcQty = ((aih * 13) % 15000) + 100;
                                        return (
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div
                                                className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer`}
                                                onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "item", item: { id: `${vendor.id}-item-0`, name: code0 || "Item", subtitle: vendor.displayName, imageUrl: itemPhotoUrl }, vendorName: vendor.displayName }); }}
                                              >
                                                <img src={itemPhotoUrl} alt="" className="w-full h-full object-cover" />
                                              </div>
                                            </HoverCardTrigger>
                                            <ItemHoverCardContent
                                              image={itemPhotoUrl}
                                              partNo={code0 || "Item"}
                                              category={hcCat}
                                              manufacturer={hcMfr}
                                              description={hcDesc}
                                              inventoryControl={hcControl}
                                              onHand={hcQty}
                                              onHandUnit={hcUnit}
                                              status={hcStatus}
                                              preferredAcquisition={hcAcq}
                                            />
                                          </HoverCard>
                                        );
                                      })()}
                                      <div
                                        className="min-w-0 cursor-pointer group/itemcode"
                                        onClick={(e) => { e.stopPropagation(); window.open("https://lovable.dev/projects/e2a76e6d-aa32-48d4-afb2-14909ce77ec2", "_blank", "noopener"); }}
                                      >
                                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/itemcode:text-primary group-hover/itemcode:underline transition-colors`} style={{ fontWeight: 500 }}>{itemCodes[0] || "\u2013"}</span>
                                        {isRelaxed && (() => {
                                          const FIRST_ITEM_DESCS = ["Zinc-plated hex head screw, industrial grade", "Deep groove ball bearing, sealed type", "DC relay, SPDT, 10A contact rating", "Push-to-connect fitting, brass tube", "Stainless welding rod, 3/32\" diameter", "Cut-resistant safety gloves, ANSI A4", "Classical V-belt, B68, heavy duty", "Inductive proximity sensor, M12 barrel"];
                                          let dh = 0; for (let c = 0; c < (itemCodes[0] || "").length; c++) dh = (itemCodes[0] || "").charCodeAt(c) + ((dh << 5) - dh);
                                          return <span className="text-[10px] text-muted-foreground/50 block truncate max-w-[180px]">{FIRST_ITEM_DESCS[Math.abs(dh) % FIRST_ITEM_DESCS.length]}</span>;
                                        })()}
                                      </div>
                                      {extraItems > 0 && (
                                        <OverflowTooltip
                                          category="Items"
                                          items={itemCodes.slice(1).map((code, i) => {
                                            const ITEM_PHOTOS_SM = [
                                              "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1713575882582-8938739db351?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=80&h=80&fit=crop",
                                            ];
                                            let ch = 0; for (let c = 0; c < code.length; c++) ch = code.charCodeAt(c) + ((ch << 5) - ch);
                                            const ITEM_DESCS_SHORT = [
                                              "Zinc-plated hex head screw, industrial grade",
                                              "Deep groove ball bearing, sealed",
                                              "DC relay, SPDT, 10A contact rating",
                                              "Push-to-connect fitting, brass tube",
                                              "Stainless welding rod, 3/32\" dia",
                                              "Cut-resistant gloves, ANSI level",
                                              "Classical V-belt, B68, heavy duty",
                                              "Inductive proximity sensor, M12",
                                              "Compression spring, .750 OD",
                                              "Jaw coupling hub, L099, bore",
                                            ];
                                            return {
                                              id: `${vendor.id}-item-${i}`,
                                              name: code,
                                              subtitle: ITEM_DESCS_SHORT[Math.abs(ch) % ITEM_DESCS_SHORT.length],
                                              imageUrl: ITEM_PHOTOS_SM[Math.abs(ch) % ITEM_PHOTOS_SM.length],
                                              nameHref: "https://lovable.dev/projects/e2a76e6d-aa32-48d4-afb2-14909ce77ec2",
                                            };
                                          })}
                                          onItemClick={(item) => setQuickViewData({ type: "item", item, vendorName: vendor.displayName })}
                                          viewMoreHref={`/vendors/${vendor.id}?tab=items`}
                                          viewMoreLabel={`View All ${itemCodes.length} Items for ${vendor.displayName}`}
                                        >
                                          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraItems} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              }
                              case "partner_locations": {
                                /* Hoist photo + address generation so they're available for both modes and the hover card */
                                const LOC_PHOTOS_PL = [
                                  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=80&h=80&fit=crop",
                                  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=80&h=80&fit=crop",
                                ];
                                let plHash = 0; for (let c = 0; c < (partnerLocations[0] || "").length; c++) plHash = (partnerLocations[0] || "").charCodeAt(c) + ((plHash << 5) - plHash);
                                const locPhoto = LOC_PHOTOS_PL[Math.abs(plHash) % LOC_PHOTOS_PL.length];
                                const PL_STREETS = ["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Factory Rd", "Park Ave", "Main St"];
                                const PL_CITIES = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX", "Chicago, IL"];
                                const plAddr = `${(Math.abs(plHash) % 999) + 1} ${PL_STREETS[Math.abs(plHash) % PL_STREETS.length]}, ${PL_CITIES[Math.abs(plHash + 1) % PL_CITIES.length]}`;
                                const plLocDescription = mockLocationData(partnerLocations[0] || "Location").description;
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-1.5"}`}>
                                      {/* Photo in both condensed & comfort */}
                                      <HoverCard>
                                        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div
                                            className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer`}
                                            onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "location", item: { id: `${vendor.id}-loc-0`, name: partnerLocations[0], subtitle: "Location", imageUrl: locPhoto }, vendorName: vendor.displayName, vendorId: vendor.id, locationIdx: 0 }); }}
                                          >
                                            <img src={locPhoto} alt="" className="w-full h-full object-cover" />
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0"><img src={locPhoto} alt="" className="w-full h-full object-cover" /></div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{partnerLocations[0] || "Location"}</p>
                                                <p className="text-[11px] text-slate-400 line-clamp-2" style={{ lineHeight: 1.35 }}>{plLocDescription}</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-3 space-y-2">
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{plAddr}</span></div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{vendor.displayName}</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div className="min-w-0">
                                        <span
                                          className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate cursor-pointer hover:text-primary hover:underline transition-colors`}
                                          style={{ fontWeight: isRelaxed ? 500 : undefined }}
                                          onClick={(e) => { e.stopPropagation(); window.open(`/vendors/${vendor.id}?tab=partner_locations&loc=0`, "_blank", "noopener"); }}
                                        >{highlightText(partnerLocations[0] || "\u2013")}</span>
                                        {isRelaxed && (
                                          <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plAddr)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-muted-foreground/50 block truncate hover:text-primary hover:underline transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >{plAddr}</a>
                                        )}
                                      </div>
                                      {extraLocations > 0 && (
                                        <OverflowTooltip
                                          category="Locations"
                                          items={partnerLocations.slice(1).map((loc, i) => {
                                            const LOC_PHOTOS_SM = [
                                              "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=80&h=80&fit=crop",
                                              "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=80&h=80&fit=crop",
                                            ];
                                            const STREETS = ["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Factory Rd"];
                                            const CITIES = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX"];
                                            let lh = 0; for (let c = 0; c < loc.length; c++) lh = loc.charCodeAt(c) + ((lh << 5) - lh);
                                            const locAddr = `${(Math.abs(lh) % 999) + 1} ${STREETS[Math.abs(lh) % STREETS.length]}, ${CITIES[Math.abs(lh + 1) % CITIES.length]}`;
                                            return {
                                              id: `${vendor.id}-loc-${i}`,
                                              name: loc,
                                              subtitle: locAddr,
                                              subtitleHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locAddr)}`,
                                              imageUrl: LOC_PHOTOS_SM[Math.abs(lh) % LOC_PHOTOS_SM.length],
                                              nameHref: `/vendors/${vendor.id}?tab=partner_locations&loc=${i + 1}`,
                                              /* Real idx in vendor.partnerLocations — tooltip starts at index 1 */
                                              meta: { locationIdx: i + 1 },
                                            };
                                          })}
                                          onItemClick={(item) => setQuickViewData({
                                            type: "location",
                                            item,
                                            vendorName: vendor.displayName,
                                            vendorId: vendor.id,
                                            locationIdx: (item.meta?.locationIdx as number | undefined),
                                          })}
                                          viewMoreHref={`/vendors/${vendor.id}?tab=partner_locations`}
                                          viewMoreLabel={`View All ${partnerLocations.length} Locations for ${vendor.displayName}`}
                                        >
                                          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraLocations} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              }
                              case "global_contacts":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {globalPointOfContacts.length > 0 ? (
                                        <>
                                          {(() => { const poc = globalPointOfContacts[0]; const photoUrl = getPersonAvatar(poc?.name || ""); const t = getAvatarTint(poc?.name || ""); const cd = getContactDetails(poc?.name || ""); return (
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "contact", item: { id: resolveContactId(poc?.name || ""), name: poc?.name, subtitle: (poc as any)?.role || cd.role || "CONTACT", initials: poc?.initials, avatarBg: t.bg, avatarFg: t.fg, imageUrl: photoUrl, meta: { role: cd.role, dept: cd.dept, email: cd.email, phone: cd.phone } }, vendorName: vendor.displayName }); }}><LogoAvatar logoUrl={photoUrl} initials={poc?.initials || "?"} bg={t.bg} size={isRelaxed ? "lg" : "md"} type="person" /></div>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              {/* Header with gradient */}
                                              <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                                <div className="flex items-center gap-3 relative">
                                                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photoUrl ? "transparent" : poc?.bgColor || t.bg }}>
                                                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{poc?.initials}</div>}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{poc?.name}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{cd.role}</p>
                                                  </div>
                                                </div>
                                              </div>
                                              {/* Body */}
                                              <div className="bg-white px-4 py-3 space-y-2">
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{cd.email}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cd.phone}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cd.dept}</span></div>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                          ); })()}
                                          <div
                                            className="min-w-0 cursor-pointer group/poc"
                                            onClick={(e) => { e.stopPropagation(); window.open(`/partners/contacts/${resolveContactId(globalPointOfContacts[0]?.name || "")}`, "_blank", "noopener"); }}
                                          >
                                            <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/poc:text-primary group-hover/poc:underline transition-colors`}>{highlightText(globalPointOfContacts[0]?.name)}</span>
                                            {isRelaxed && (() => {
                                              const cdPrimary = getContactDetails(globalPointOfContacts[0]?.name || "");
                                              return (
                                                <a
                                                  href={`mailto:${cdPrimary.email}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-[11px] text-muted-foreground/60 truncate block hover:text-primary hover:underline transition-colors"
                                                >{cdPrimary.email}</a>
                                              );
                                            })()}
                                          </div>
                                          {extraContacts > 0 && (
                                            <OverflowTooltip
                                              category="Point of Contacts"
                                              items={globalPointOfContacts.slice(1).map((c, i) => {
                                                const t = getAvatarTint(c.name || "");
                                                const cd = getContactDetails(c.name || "");
                                                return {
                                                  id: `${vendor.id}-contact-${i}`,
                                                  name: c.name,
                                                  /* Email reads better than role in the tooltip — makes the row instantly actionable. */
                                                  subtitle: cd.email,
                                                  subtitleHref: `mailto:${cd.email}`,
                                                  initials: c.initials,
                                                  avatarBg: t.bg,
                                                  avatarFg: t.fg,
                                                  imageUrl: getPersonAvatar(c.name || ""),
                                                  nameHref: `/partners/contacts/${resolveContactId(c.name || "")}`,
                                                  meta: { role: cd.role, dept: cd.dept, email: cd.email, phone: cd.phone },
                                                };
                                              })}
                                              onItemClick={(item) => setQuickViewData({ type: "contact", item, vendorName: vendor.displayName })}
                                              viewMoreHref={`/vendors/${vendor.id}?tab=points_of_contact`}
                                              viewMoreLabel={`View All ${globalPointOfContacts.length} Contacts for ${vendor.displayName}`}
                                            >
                                              <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraContacts} more</span>
                                            </OverflowTooltip>
                                          )}
                                        </>
                                      ) : (<span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                    </div>
                                  </TableCell>
                                );
                              case "partner_group": {
                                // Primary group is always shown (avatar + name);
                                // secondary groups collapse into "+N more" using
                                // the same overflow interaction as other columns.
                                const { primary: primaryGroup, others: otherGroups } = getVendorGroups(vendor.id, vendor.partnerGroup);
                                const pgInitials = (name: string) => name.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                                const pgTint = getAvatarTint(primaryGroup.name);
                                return (
                                  <TableCell key={colKey}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <HoverCard openDelay={250} closeDelay={80}>
                                        <HoverCardTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${primaryGroup.id}`, "_blank", "noopener"); }}
                                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                                            style={{ backgroundColor: pgTint.bg, color: pgTint.fg, fontWeight: 700 }}
                                            title="Open partner group"
                                          >
                                            {pgInitials(primaryGroup.name)}
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px]" style={{ backgroundColor: pgTint.bg, color: pgTint.fg, fontWeight: 700 }}>{pgInitials(primaryGroup.name)}</div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{primaryGroup.name}</p>
                                                <p className="text-[11px] text-slate-400 truncate">Primary Group</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-3 space-y-2">
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Users className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{primaryGroup.memberCount} members</span></div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate"><span className="mr-1"><FlagImage code={flagEmojiCode(primaryGroup.countryFlag)} className="text-[13px]" /></span>{primaryGroup.country}</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div className="min-w-0">
                                        <span
                                          className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate cursor-pointer hover:text-primary hover:underline transition-colors`}
                                          style={{ fontWeight: isRelaxed ? 500 : undefined }}
                                          onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${primaryGroup.id}`, "_blank", "noopener"); }}
                                        >{highlightText(primaryGroup.name)}</span>
                                      </div>
                                      {otherGroups.length > 0 && (
                                        <OverflowTooltip
                                          category="Groups"
                                          items={otherGroups.map((g, i) => {
                                            const t = getAvatarTint(g.name);
                                            return {
                                              id: `${vendor.id}-grp-${i}`,
                                              name: g.name,
                                              subtitle: `${g.memberCount} members`,
                                              initials: pgInitials(g.name),
                                              avatarBg: t.bg,
                                              avatarFg: t.fg,
                                              nameHref: `/partners/groups/${g.id}`,
                                            };
                                          })}
                                          viewMoreHref={`/vendors/${vendor.id}`}
                                          viewMoreLabel={`View All Groups for ${vendor.displayName}`}
                                        >
                                          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{otherGroups.length} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              }
                              case "net_profit":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13px]" : "text-sm"}>{listingMoney(vendor, vendor.netProfitMargin, "net_profit")}</span></TableCell>);
                              case "credit_limit":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13px]" : "text-sm"}>{listingMoney(vendor, vendor.creditLimit, "credit_limit")}</span></TableCell>);
                              case "credit_utilization":
                                return (<TableCell key={colKey} className="text-right tabular-nums"><span className={isRelaxed ? "text-[13px]" : "text-sm"}>{listingMoney(vendor, vendor.creditUtilization, "credit_utilization")}</span></TableCell>);
                              case "services":
                                return (
                                  <TableCell key={colKey}>
                                    <div>
                                      <span className={isRelaxed ? "text-[13px]" : "text-sm"} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.services}</span>
                                      {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{CATEGORY_LABELS[vendor.category]}</span>}
                                    </div>
                                  </TableCell>
                                );
                              case "carrier_vendor": {
                                /* Deterministic carrier mock data */
                                let cvh = 0; for (let c = 0; c < vendor.defaultCarrierVendor.length; c++) cvh = vendor.defaultCarrierVendor.charCodeAt(c) + ((cvh << 5) - cvh);
                                const acvh = Math.abs(cvh);
                                const cvPrice = `$${((acvh % 40) + 8)}.00`;
                                const cvDays = `${(acvh % 5) + 1} to ${(acvh % 5) + 5} days`;
                                const cvShipments = ((acvh % 1200) + 100).toLocaleString();
                                const CV_SERVICES = ["Ground & Express", "Freight", "Ground", "Express & Priority", "Standard & Freight"];
                                const CV_REGIONS = ["North America", "Global", "North America, Europe", "Asia Pacific", "Americas"];
                                const cvService = CV_SERVICES[acvh % CV_SERVICES.length];
                                const cvRegion = CV_REGIONS[acvh % CV_REGIONS.length];
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <HoverCard>
                                        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "carrier", item: { id: `${vendor.id}-cv`, name: vendor.defaultCarrierVendor, subtitle: "Vendor Carrier" }, vendorName: vendor.displayName }); }}><CarrierIcon carrier={vendor.defaultCarrierVendor} large={isRelaxed} /></div>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden"><CarrierIcon carrier={vendor.defaultCarrierVendor} /></div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{vendor.defaultCarrierVendor}</p>
                                                <p className="text-[11px] text-slate-400">Primary Vendor Carrier</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-2.5 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{cvPrice}<span className="text-[11px] text-slate-400 ml-0.5" style={{ fontWeight: 400 }}>/shipment</span></span>
                                              <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{cvDays}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cvService}</span></div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <span className="text-slate-500">{cvShipments} shipments</span>
                                              <span className="text-slate-500">{cvRegion}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-slate-500">Tracking</span><span className="text-success" style={{ fontWeight: 500 }}>Available</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div
                                        className="min-w-0 flex-1 cursor-pointer group/cv"
                                        onClick={(e) => { e.stopPropagation(); window.open("/partners/carriers", "_blank", "noopener"); }}
                                      >
                                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/cv:text-primary group-hover/cv:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.defaultCarrierVendor}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">Vendor Carrier</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              }
                              case "carrier_customer": {
                                let cch = 0; for (let c = 0; c < vendor.defaultCarrierCustomer.length; c++) cch = vendor.defaultCarrierCustomer.charCodeAt(c) + ((cch << 5) - cch);
                                const acch = Math.abs(cch);
                                const ccPrice = `$${((acch % 35) + 5)}.00`;
                                const ccDays = `${(acch % 6) + 2} to ${(acch % 6) + 8} days`;
                                const ccShipments = ((acch % 900) + 80).toLocaleString();
                                const CC_SERVICES = ["Standard & Priority", "Ground", "Express", "Freight & Ground", "Priority Express"];
                                const CC_REGIONS = ["Global", "North America", "Asia Pacific", "Europe", "Americas"];
                                const ccService = CC_SERVICES[acch % CC_SERVICES.length];
                                const ccRegion = CC_REGIONS[acch % CC_REGIONS.length];
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <HoverCard>
                                        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "carrier", item: { id: `${vendor.id}-cc`, name: vendor.defaultCarrierCustomer, subtitle: "Customer Carrier" }, vendorName: vendor.displayName }); }}><CarrierIcon carrier={vendor.defaultCarrierCustomer} large={isRelaxed} /></div>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden"><CarrierIcon carrier={vendor.defaultCarrierCustomer} /></div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{vendor.defaultCarrierCustomer}</p>
                                                <p className="text-[11px] text-slate-400">Primary Customer Carrier</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-3.5 py-2.5 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{ccPrice}<span className="text-[11px] text-slate-400 ml-0.5" style={{ fontWeight: 400 }}>/shipment</span></span>
                                              <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{ccDays}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{ccService}</span></div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <span className="text-slate-500">{ccShipments} shipments</span>
                                              <span className="text-slate-500">{ccRegion}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]"><span className="text-slate-500">Tracking</span><span className="text-success" style={{ fontWeight: 500 }}>Available</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      <div
                                        className="min-w-0 flex-1 cursor-pointer group/cc"
                                        onClick={(e) => { e.stopPropagation(); window.open("/partners/carriers", "_blank", "noopener"); }}
                                      >
                                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/cc:text-primary group-hover/cc:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{vendor.defaultCarrierCustomer}</span>
                                        {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">Customer Carrier</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              }
                              case "country":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      <span className={isRelaxed ? "text-lg" : "text-base"}><FlagImage code={flagEmojiCode(vendor.countryFlag)} className="text-[13px]" /></span>
                                      <div className="min-w-0 flex-1">
                                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(vendor.country)}</span>
                                        {isRelaxed && vendor.billingAddress?.city && <span className="text-[10px] text-muted-foreground/50 truncate block">{vendor.billingAddress.city}{vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""}</span>}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              case "website":
                                return (<TableCell key={colKey}><span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground block`}>{highlightText(vendor.website)}</span></TableCell>);
                              case "email":
                                return (<TableCell key={colKey}><span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground block`}>{highlightText(vendor.emailAddress)}</span></TableCell>);
                              case "last_updated_by":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {(() => { const lu = getLastUpdated(vendor.id, vendor.createdAt); const photoUrl = getPersonAvatar(lu.name); const t = getAvatarTint(lu.name); const cd = getContactDetails(lu.name); return (
                                        <>
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "contact", item: { id: resolveContactId(lu.name), name: lu.name, subtitle: cd.role || "Team Member", initials: lu.initials, avatarBg: t.bg, avatarFg: t.fg, imageUrl: photoUrl, meta: { role: cd.role, email: cd.email, phone: cd.phone, isUser: true } }, vendorName: vendor.displayName }); }}><LogoAvatar logoUrl={photoUrl} initials={lu.initials || "?"} bg={t.bg} size={isRelaxed ? "lg" : "md"} type="person" /></div>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                                <div className="flex items-center gap-3 relative">
                                                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photoUrl ? "transparent" : lu.bgColor || t.bg }}>
                                                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{lu.initials}</div>}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{lu.name}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{cd.role}</p>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="bg-white px-4 py-3 space-y-2">
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{cd.email}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cd.phone}</span></div>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                          <div
                                            className="min-w-0 flex-1 cursor-pointer group/cb"
                                            onClick={(e) => { e.stopPropagation(); window.open(`/partners/contacts/${resolveContactId(lu.name)}`, "_blank", "noopener"); }}
                                          >
                                            <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(lu.name)}</span>
                                            {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate block">{cd.role || "Team Member"}</span>}
                                          </div>
                                        </>
                                      ); })()}
                                    </div>
                                  </TableCell>
                                );
                              case "last_updated_on":
                                return (
                                  <TableCell key={colKey}>
                                    <div>
                                      {(() => { const lu = getLastUpdated(vendor.id, vendor.createdAt); return (
                                        <>
                                          <span className={isRelaxed ? "text-[13px]" : "text-sm"} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{formatDate(lu.date)}</span>
                                          {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{(() => { const d = Math.floor((Date.now() - new Date(lu.date).getTime()) / 86400000); return d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`; })()}</span>}
                                        </>
                                      ); })()}
                                    </div>
                                  </TableCell>
                                );
                              case "created_by":
                                return (
                                  <TableCell key={colKey}>
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                                      {vendor.createdByContact ? (
                                        <>
                                          {(() => { const cb = vendor.createdByContact; const photoUrl = getPersonAvatar(cb.name || ""); const t = getAvatarTint(cb.name || ""); const cd = getContactDetails(cb.name || ""); return (
                                          <HoverCard>
                                            <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setQuickViewData({ type: "contact", item: { id: resolveContactId(cb.name || ""), name: cb.name, subtitle: (cb as any).role || cd.role || "Team Member", initials: cb.initials, avatarBg: t.bg, avatarFg: t.fg, imageUrl: photoUrl, meta: { role: cd.role, email: cd.email, phone: cd.phone, isUser: true } }, vendorName: vendor.displayName }); }}><LogoAvatar logoUrl={photoUrl} initials={cb.initials || "?"} bg={t.bg} size={isRelaxed ? "lg" : "md"} type="person" /></div>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                                <div className="flex items-center gap-3 relative">
                                                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photoUrl ? "transparent" : cb.bgColor || t.bg }}>
                                                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{cb.initials}</div>}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{cb.name}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{cd.role}</p>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="bg-white px-4 py-3 space-y-2">
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{cd.email}</span></div>
                                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cd.phone}</span></div>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                          ); })()}
                                          <div
                                            className="min-w-0 flex-1 cursor-pointer group/cb"
                                            onClick={(e) => { e.stopPropagation(); window.open(`/partners/contacts/${resolveContactId(vendor.createdByContact.name || "")}`, "_blank", "noopener"); }}
                                          >
                                            <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{highlightText(vendor.createdByContact.name)}</span>
                                            {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate block">{(vendor.createdByContact as any).role || "Team Member"}</span>}
                                          </div>
                                        </>
                                      ) : (<span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{"\u2013"}</span>)}
                                    </div>
                                  </TableCell>
                                );
                              case "created_on":
                                return (
                                  <TableCell key={colKey}>
                                    <div>
                                      <span className={isRelaxed ? "text-[13px]" : "text-sm"} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{formatDate(vendor.createdAt)}</span>
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

                          const isRowSelected = selectedRows.has(vendor.id);
                          const isBulkMode = selectedRows.size > 0;
                          return (
                            <TableRow
                              key={vendor.id}
                              data-selected={isRowSelected || undefined}
                              className={`cursor-pointer group ${
                                isRowSelected
                                  ? "bg-[#F8FAFF] hover:bg-[#F0F7FF]"
                                  : "hover:bg-[#F0F7FF]"
                              } ${
                                density === "condensed"
                                  ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2"
                                  : density === "comfort"
                                  ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                                  : ""
                              } ${newlyCreatedId === vendor.id ? "animate-row-flash" : ""}`}
                              onClick={() => {
                                /* In bulk-selection mode the row click is repurposed
                                 * to toggle selection (no detail navigation) — matches
                                 * the reference behaviour in Cycle Count and is the
                                 * only sane interaction while bulk actions are armed. */
                                if (isBulkMode) {
                                  handleSelectRow(vendor.id);
                                  return;
                                }
                                /* In embedded mode (e.g. Linked Partners tab on Contact Detail), open in a new browser tab — matches PO/SO/Quotes row behaviour. Standalone listing keeps in-app navigation. */
                                if (embedded) window.open(`/vendors/${vendor.id}`, "_blank", "noopener");
                                else navigate(`/vendors/${vendor.id}`);
                              }}
                            >
                              {/* Checkbox cell — sticky leftmost. Whole cell is the
                                  hit-area: clicking anywhere inside toggles the row,
                                  and click-and-drag extends a contiguous selection. */}
                              <TableCell
                                className={`sticky left-0 z-10 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none ${
                                  isRowSelected
                                    ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                    : "bg-card group-hover:bg-[#F0F7FF]"
                                }`}
                                onMouseDown={(e) => handleCheckboxMouseDown(e, vendor.id)}
                                onMouseEnter={() => handleCheckboxMouseEnter(vendor.id)}
                                onClick={(e) => { e.stopPropagation(); }}
                                aria-label={`Select ${vendor.displayName}`}
                              >
                                <div className="flex h-full w-full items-center justify-center">
                                  <Checkbox
                                    checked={isRowSelected}
                                    tabIndex={-1}
                                    className="pointer-events-none"
                                    aria-hidden="true"
                                  />
                                </div>
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
                                  /* Selected rows: the sticky frozen cell needs to
                                   * carry the SAME opaque tint as the row, otherwise
                                   * the left-most column reads as a different shade
                                   * because transparent tints stack over the row bg. */
                                  const frozenBg = isRowSelected
                                    ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                    : "bg-card group-hover:bg-[#F0F7FF]";
                                  return cloneElement(cell, {
                                    className: `${cell.props.className || ""} sticky z-10 ${frozenBg} ${defAlign === "right" ? "text-right" : ""}`.trim(),
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
                              {/* Actions cell — hidden while bulk-action mode is
                                  active, since per-row interactions are replaced
                                  by the bulk action bar. */}
                              {!isBulkMode && (
                              <TableCell className={`sticky right-0 z-10 !pl-2 !pr-2 ${
                                isRowSelected
                                  ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                  : "bg-card group-hover:bg-[#F0F7FF]"
                              }`} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
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
                                    {renderRowActionItems(vendor)}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                              )}
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
                <div data-table-meta className={`flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0 ${embedded ? "mt-auto" : ""}`}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per Page</span>
                    <Select
                      value={recordsPerPage === -1 ? "all" : String(recordsPerPage)}
                      onValueChange={(val) => {
                        setRecordsPerPage(val === "all" ? -1 : Number(val));
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
                        <SelectItem value="all">All</SelectItem>
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
            {importExport.modals}
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
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />
                <span className="text-[13px]" style={{ color: "rgb(var(--primary))", fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                {ghostFilter && !ghostSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />}
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
        editMode={!!editingVendor}
        editVendor={editingVendor}
      />

      {/* Mark as Active Dialog — canonical green palette */}
      <AlertDialog open={markActiveDialogOpen} onOpenChange={setMarkActiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setMarkActiveDialogOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
              <CircleCheck className="w-8 h-8" style={{ color: "#065F46" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}
            >
              Mark as Active
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Mark {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "this partner") : "this partner"} as Active?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The partner goes back to Active and reappears in default listings, pickers, and search. Existing assignments stay exactly as-is.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleMarkActive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}
              >
                Mark as Active
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Inactive
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Inactive Dialog — canonical amber palette */}
      <AlertDialog open={markInactiveDialogOpen} onOpenChange={setMarkInactiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setMarkInactiveDialogOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <CircleSlash className="w-8 h-8" style={{ color: "#B45309" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}
            >
              Mark as Inactive
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Mark {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "this partner") : "this partner"} as Inactive?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The partner stops appearing in pickers and is excluded from new assignments. Existing assignments stay exactly as-is. Re-activate from the header CTA when you're ready.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleMarkInactive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
              >
                Mark as Inactive
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Active
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
              <Archive className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}
            >
              Archive
            </span>
          </div>
          {/* CTA: #DC2626 on #fff ≈ 4.0:1 AA-Large ✓ · Cancel: #334155 on #F1F5F9 ≈ 7.1:1 AAA ✓ */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Archive this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be removed from active workflows. Historical records are preserved and you can unarchive later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleArchive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Archive Partner
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk confirm dialog — used for "Mark Inactive" / "Archive" multi-row actions. */}
      <AlertDialog open={bulkConfirm !== null} onOpenChange={(open) => { if (!open) setBulkConfirm(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setBulkConfirm(null)}
        >
          {bulkConfirm === "inactive" ? (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                  <CircleSlash className="w-8 h-8" style={{ color: "#B45309" }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}>
                  Mark as Inactive
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Mark {markInactiveTargets.length} partner{markInactiveTargets.length === 1 ? "" : "s"} as Inactive?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {selectedVendors.length > markInactiveTargets.length && (
                    <span className="block mb-1.5 text-amber-700" style={{ fontWeight: 500 }}>
                      {selectedVendors.length - markInactiveTargets.length} of {selectedVendors.length} selected are already inactive or archived and will be skipped.
                    </span>
                  )}
                  These partners stop appearing in pickers and are excluded from new assignments. Existing assignments stay exactly as-is. You can re-activate any of them later.
                </AlertDialogDescription>
                {markInactiveTargets.length > 0 && markInactiveTargets.length <= 6 && (
                  <ul className="mt-4 w-full text-left text-[12px] space-y-1 max-h-[120px] overflow-y-auto px-3">
                    {markInactiveTargets.map((v) => (
                      <li key={v.id} className="text-muted-foreground truncate">• {v.displayName}</li>
                    ))}
                  </ul>
                )}
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={handleBulkMarkInactive}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
                  >
                    Mark {markInactiveTargets.length} as Inactive
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Keep Active
                  </AlertDialogCancel>
                </div>
              </div>
            </>
          ) : bulkConfirm === "active" ? (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
                  <CircleCheck className="w-8 h-8" style={{ color: "#047857" }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}>
                  Mark as Active
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Mark {markActiveTargets.length} partner{markActiveTargets.length === 1 ? "" : "s"} as Active?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {selectedVendors.length > markActiveTargets.length && (
                    <span className="block mb-1.5 text-emerald-700" style={{ fontWeight: 500 }}>
                      {selectedVendors.length - markActiveTargets.length} of {selectedVendors.length} selected are already active or archived and will be skipped.
                    </span>
                  )}
                  These partners will reappear in pickers and become available for new assignments again.
                </AlertDialogDescription>
                {markActiveTargets.length > 0 && markActiveTargets.length <= 6 && (
                  <ul className="mt-4 w-full text-left text-[12px] space-y-1 max-h-[120px] overflow-y-auto px-3">
                    {markActiveTargets.map((v) => (
                      <li key={v.id} className="text-muted-foreground truncate">• {v.displayName}</li>
                    ))}
                  </ul>
                )}
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={handleBulkMarkActive}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}
                  >
                    Mark {markActiveTargets.length} as Active
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Cancel
                  </AlertDialogCancel>
                </div>
              </div>
            </>
          ) : bulkConfirm === "archive" ? (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                  <Archive className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
                  Archive
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    Archive {archiveTargets.length} partner{archiveTargets.length === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {selectedVendors.length > archiveTargets.length && (
                    <span className="block mb-1.5 text-destructive" style={{ fontWeight: 500 }}>
                      {selectedVendors.length - archiveTargets.length} of {selectedVendors.length} selected are already archived and will be skipped.
                    </span>
                  )}
                  These partners will be removed from active workflows. Historical records are preserved and you can unarchive later.
                </AlertDialogDescription>
                {archiveTargets.length > 0 && archiveTargets.length <= 6 && (
                  <ul className="mt-4 w-full text-left text-[12px] space-y-1 max-h-[120px] overflow-y-auto px-3">
                    {archiveTargets.map((v) => (
                      <li key={v.id} className="text-muted-foreground truncate">• {v.displayName}</li>
                    ))}
                  </ul>
                )}
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <AlertDialogAction
                    onClick={handleBulkArchive}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                  >
                    Archive {archiveTargets.length} Partner{archiveTargets.length === 1 ? "" : "s"}
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Cancel
                  </AlertDialogCancel>
                </div>
              </div>
            </>
          ) : null}
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
              <Archive className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}
            >
              Archive
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Archive this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {selectedVendorId ? (getVendor(selectedVendorId)?.displayName ?? "This partner") : "This partner"}
              </span>{" "}
              will be removed from active workflows. Historical records are preserved and you can unarchive later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleDelete}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Archive Partner
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
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

const BASE_CURRENCY_NOTE = `Shown in the base currency (${BASE_CURRENCY}); each partner's amount is converted from its own currency at today's mid-market rate.`;

// Only complex/calculated KPIs get the rich tooltip — simple counts use plain tooltips
const KPI_TOOLTIP_DATA: Record<string, KpiTooltipData> = {
  total_credit_utilization: {
    title: "Credit Utilization",
    description: `Sum of all credit currently being used across the partner portfolio. High utilization relative to the total limit indicates elevated financial risk. ${BASE_CURRENCY_NOTE}`,
    breakdown: [
      { label: "Total Credit Limit", value: "—" },
      { label: "Currently Utilized", value: "—" },
      { label: "Available Credit", value: "—", isResult: true },
    ],
    formula: "Available = Total Limit - Currently Utilized",
  },
  total_outstanding: {
    title: "Outstanding Balance",
    description: `Total unpaid amount across all partners. Includes pending invoices, overdue payments, and scheduled disbursements. ${BASE_CURRENCY_NOTE}`,
    breakdown: [
      { label: "Pending Invoices", value: "—" },
      { label: "Overdue Payments", value: "—" },
      { label: "Scheduled Payments", value: "—" },
      { label: "Total Outstanding", value: "—", isResult: true },
    ],
    formula: "Outstanding = Pending + Overdue + Scheduled",
  },
  avg_net_profit: {
    title: "Average Net Profit",
    description: `Average net profit per partner across the portfolio. ${BASE_CURRENCY_NOTE}`,
    breakdown: [
      { label: "Gross Revenue", value: "—" },
      { label: "Cost of Goods", value: "—" },
      { label: "Operational Costs", value: "—" },
      { label: "Net Profit", value: "—", isResult: true },
    ],
    formula: "Avg Net Profit = sum(Net Profit in PKR) ÷ Partners",
  },
};

function KpiRichTooltip({ data, children }: { data?: KpiTooltipData; children: React.ReactNode }) {
  if (!data) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="p-0 w-[320px] max-w-[90vw] z-[400] !bg-white !border-border !shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Info className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[11px] text-slate-700 tracking-wide" style={{ fontWeight: 700 }}>{data.title}</span>
          </div>
          {/* Description */}
          <p className="text-[11px] text-slate-500 leading-[1.6] mb-3">{data.description}</p>
          {/* Divider */}
          <div className="border-t border-muted mb-3" />
          {/* Breakdown */}
          <div className="space-y-1.5">
            {data.breakdown.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] ${
                  row.isResult ? "bg-green-50 border border-[#D1FAE5]" : ""
                }`}
              >
                <span className={row.isResult ? "text-slate-700" : "text-slate-500"} style={{ fontWeight: row.isResult ? 600 : 400 }}>{row.label}</span>
                <span className={row.isResult ? "text-green-600" : "text-slate-700"} style={{ fontWeight: row.isResult ? 700 : 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
          {/* Divider */}
          <div className="border-t border-muted my-3" />
          {/* Formula */}
          <div className="px-3 py-2 rounded-lg bg-[#F0F6FF] border border-blue-100">
            <code className="text-[10px] text-[#094D9F]" style={{ fontWeight: 500 }}>{data.formula}</code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function LogoAvatar({ logoUrl, initials, bg, size = "md", type = "logo", personName }: { logoUrl?: string; initials: string; bg: string; size?: "sm" | "md" | "lg"; type?: "logo" | "person"; personName?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { openLightbox } = usePersonLightbox();
  const sizeClass = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]";
  const showImg = logoUrl && !imgFailed;
  const isPerson = type === "person";
  const canLightbox = isPerson && showImg && personName;
  return (
    <div
      className={`${sizeClass} ${isPerson ? "rounded-full" : "rounded-lg"} flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] ${canLightbox ? "cursor-zoom-in" : ""}`}
      style={{ backgroundColor: showImg ? (isPerson ? "transparent" : "#FFFFFF") : bg }}
      onClick={canLightbox ? (e) => { e.stopPropagation(); openLightbox({ src: logoUrl!, name: personName! }); } : undefined}
    >
      {showImg ? (
        <img src={logoUrl} alt="" className={`w-full h-full ${isPerson ? "object-cover" : "object-contain p-1.5"}`} onError={() => setImgFailed(true)} />
      ) : (
        <span className={`${textSize} text-slate-700`} style={{ fontWeight: 700 }}>{initials}</span>
      )}
    </div>
  );
}

function CarrierIcon({ carrier, large }: { carrier: string; large?: boolean }) {
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
      className={`${large ? "w-10 h-10" : "w-7 h-7"} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`}
      style={{
        backgroundColor: carrierLogo ? "#FFFFFF" : "rgb(var(--muted))",
        color: "rgb(var(--muted-foreground))",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {carrierLogo ? <img src={carrierLogo} alt="" className="w-full h-full object-contain p-1" /> : getInitials(carrier)}
    </div>
  );
}

/* ── Draggable KPI Card for partner listing page ──
 *  Mirrors the Vendor Invoicing listing card: colored period-over-period
 *  delta prefix, complement sub-line with the "vs prior X" anchor, and a
 *  Calculation block inside the tooltip. */
function DraggableListKpiCard({ index, kpiKey, label, value, sub, delta, rangeLabel, iconName, tooltip, formula, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: React.ReactNode; sub?: string; delta?: KpiDelta; rangeLabel?: string; iconName?: string; tooltip?: string; formula?: string;
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
        className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {/* Drop zone overlay */}
      {isOver && (
        <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2">
        {/* Drag handle — top-right pill */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        {/* Label row: label + info + icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {(KPI_TOOLTIP_DATA[kpiKey] || tooltip || formula) && (
              KPI_TOOLTIP_DATA[kpiKey] ? (
                <KpiRichTooltip data={KPI_TOOLTIP_DATA[kpiKey]}>
                  <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </KpiRichTooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                      <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px] leading-snug z-[300] p-0 overflow-hidden">
                    {tooltip && <p className="px-3 pt-2.5 pb-2 text-slate-600">{tooltip}</p>}
                    {formula && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                        <p className="text-[10px] tracking-wider text-slate-400 mb-1" style={{ fontWeight: 600 }}>
                          Calculation
                        </p>
                        <pre className="text-[10px] text-slate-700 whitespace-pre-wrap leading-snug">{formula}</pre>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            )}
          </div>
          {iconName && <KpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
        </div>
        {/* Headline row — delta prefix inline on the left, value next
            to it (Vendor Invoicing card rhythm). */}
        <div className="flex items-baseline gap-1 min-w-0">
          {delta && (
            <span
              className="text-[10px] shrink-0"
              style={{
                color:
                  delta.tone === "positive"
                    ? "rgb(var(--success))"
                    : delta.tone === "negative"
                      ? "rgb(var(--destructive))"
                      : "rgb(var(--muted-foreground))",
                fontWeight: 600,
              }}
            >
              {delta.text}
            </span>
          )}
          {/* The rate insights' "Updated as of …" is long: smaller, and it wraps. */}
          {RATE_KPI_KEYS.has(kpiKey) ? (
            <p className="text-[12px] text-slate-700 tracking-tight" style={{ fontWeight: 600, lineHeight: 1.3 }}>{value}</p>
          ) : (
            <p className="text-[15px] text-slate-700 tracking-tight truncate" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
          )}
        </div>
        {/* Sub-line — complement metric with the period anchor appended
            inline. All-time range drops the anchor clause. */}
        {(sub || (delta && rangeLabel)) && (
          <div className="text-[10px] text-slate-400/80 truncate mt-0.5">
            {sub}
            {sub && delta && rangeLabel && <span className="text-slate-300"> · </span>}
            {delta && rangeLabel && <span>vs prior {rangeLabel}</span>}
          </div>
        )}
      </div>
      {/* Remove button — bottom-right on hover */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  );
}
