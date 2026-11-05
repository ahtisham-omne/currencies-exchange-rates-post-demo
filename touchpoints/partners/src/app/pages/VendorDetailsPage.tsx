import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { appHref } from "@/embedding";
import { FlagImage, flagEmojiCode } from "../components/currency/FlagImage";
import { useVendors } from "../context/VendorContext";
import fedexLogo from "@/assets/carriers/fedex.png";
import dhlLogo from "@/assets/carriers/dhl.png";
import upsLogo from "@/assets/carriers/ups.png";
import tcsLogo from "@/assets/carriers/tcs.png";
import aramexLogo from "@/assets/carriers/aramex.png";
import maerskLogo from "@/assets/carriers/maersk.png";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../components/ui/sheet";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { PARTNER_GROUPS, CONTACT_DICTIONARY, VENDOR_SUB_TYPES, CUSTOMER_SUB_TYPES, VENDOR_CONFIG_SECTIONS } from "../components/vendors/partnerConstants";
import { ConfigPageContent } from "../components/vendors/CreatePartnerModal";
import { CurrencyFlag } from "../components/currency/CurrencyFlag";
import { CurrencyViewToggle, ProfileCurrencyProvider, profileFormatters, useProfileMoney } from "../components/currency/ProfileCurrency";
import { BASE_CURRENCY, getCurrency } from "../currency/currencies";
import type { CurrencyView } from "../currency/partnerAmounts";
import { usePartnerCurrencyInfo } from "../currency/usePartnerCurrency";
import { ActivityFeed, type ActivityFeedItemType } from "../components/vendors/PartnerGroupDetailModal";
import type { ContactPerson as PartnerContact } from "../components/vendors/partnerConstants";
import { CreatePartnerLocationModal } from "../components/vendors/CreatePartnerLocationModal";
import { CreatePartnerModal } from "../components/vendors/CreatePartnerModal";
import { PartnerItemsTab } from "../components/vendors/PartnerItemsTab";
import { PricingRulesTabNew } from "../components/vendors/PricingRulesTab";
import { KpiInsightsPanel, ALL_KPI_DEFINITIONS, DEFAULT_ACTIVE_KPIS, splitVendorOrders } from "../components/vendors/KpiInsightsPanel";
import { InsightsRangeMenu, InsightsRefresh, InsightsResetButton, type InsightsRange } from "../components/vendors/InsightsControls";
import { PaymentMethodsSection } from "../components/vendors/PaymentMethodsSection";
import { PaymentTermDetailModal } from "../components/vendors/PaymentTermDetailModal";
import { PaymentTermCard } from "../components/vendors/PaymentTermCard";
import { PAYMENT_TERM_PRESETS, type PaymentTermPreset } from "../components/vendors/partnerConstants";
import { PocSectionContent, SelectPocDictionaryModal, CreatePocModal } from "../components/vendors/PocModals";
import { ContactsDirectoryPage } from "./ContactsDirectoryPage";
import { PurchaseOrdersTable } from "../components/vendors/PurchaseOrdersTable";
import { SalesOrdersTable } from "../components/vendors/SalesOrdersTable";
import { QuotesTable } from "../components/vendors/QuotesTable";
import { AttachmentsTab } from "../components/vendors/AttachmentsTab";
import {
  ColumnHeaderMenu,
  isFilterActive,
  type SortConfig,
} from "../components/vendors/ColumnHeaderMenu";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { TableEmptyRow, TableEmptyState, TableSkeletonRows, CardSkeletonGrid, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";
import { getLastUpdated } from "../utils/lastUpdated";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "../components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { ExpandableTextarea } from "../components/vendors/ExpandableTextarea";
import { PrimaryPill } from "../components/vendors/PrimaryPill";
import { type PackageType, PACKAGE_TYPE_LABELS } from "../components/vendors/ShippingCarrierCard";
import type { Vendor, VendorConfigData, SavedPaymentTermConfig, PaymentTerms } from "../data/vendors";
import { PaymentTermsPickerModal } from "../components/vendors/PaymentTermsPickerModal";
import {
  CATEGORY_LABELS,
  PAYMENT_TERMS_LABELS,
} from "../data/vendors";
import { buildPeriodBuckets, bucketWobble } from "../data/chartBuckets";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  MapPin,
  DollarSign,
  FileText,
  Star,
  Calendar,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  Plane,
  Ship,
  Layers,
  Shield,
  Tag,
  Banknote,
  CheckCircle2,
  Package,
  Wallet,
  Receipt,
  Building2,
  ChevronDown,
  Clock,
  Info,
  Upload,
  Paperclip,
  MessageSquare,
  Activity,
  Search,
  Maximize2,
  BarChart3,
  PieChart,
  ClipboardList,
  StickyNote,
  FilePlus2,
  Send,
  Link2,
  RefreshCw,
  Plus,
  Sliders,
  Check,
  ChartColumn,
  Percent,
  X,
  GripVertical,
  Minimize2,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Eye,
  ChevronRight,
  Grid3X3,
  Wrench,
  AlignJustify,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  SlidersHorizontal,
  Sparkles,
  User,
  PhoneCall,
  UserPlus,
  ToggleLeft,
  ToggleRight,
  ChevronUp,
  AlertTriangle,
  Settings2,
  CircleCheck,
  CircleSlash,
  MapPinPlus,
  FileUp,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Ban,
} from "lucide-react";
import React, { Fragment, useState, useEffect, useRef, useCallback, useMemo, cloneElement } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { toAAAColor } from "../utils/colors";
import { getPocAvatarTint } from "../components/vendors/PocPillComponents";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  RadialBarChart,
  RadialBar,
} from "recharts";

// ── External module URLs (open in new browser tab) ──
const PARTNER_COMM_MODULE_URL = "https://sales-charm-flow.lovable.app/vendors";

// ── Tab definitions ──
const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "partner_locations", label: "Partner Locations" },
  { id: "items", label: "Items" },
  // Promoted to a top-level tab from the inner Items sub-tab per Eli's
  // feedback — keeps the trade list (qualified-vendor / approved-buyer)
  // separate from the exchange ledger (Purchases / Sales / Returns).
  // Designed to expand as Sales and Returns datasets come online.
  { id: "transactions", label: "Transactions" },
  { id: "pricing_rules", label: "Pricing Rules" },
  { id: "partner_communication", label: "Partner Communication" },
  { id: "global_contacts", label: "Points of Contact" },
  { id: "carrier_profile", label: "Carrier Profile" },
  { id: "freight_logistics", label: "Freight & Logistics" },
  { id: "payment_methods", label: "Payment Methods" },
  { id: "gl_accounts", label: "GL Accounts" },
  { id: "purchase_orders", label: "Purchase Orders" },
  { id: "quotes", label: "Quotes" },
  { id: "sales_orders", label: "Sales Orders" },
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "recent_activity", label: "Recent Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function VendorDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getVendor, archiveVendor, restoreVendor, updateVendor } = useVendors();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const initialTab = (searchParams.get("tab") as TabId | null) ?? "dashboard";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  // Deep-link: ?tab=partner_locations&loc=<idx> opens PartnerLocationsTab and auto-opens the matching location modal.
  const initialLocationIdx = (() => {
    const raw = searchParams.get("loc");
    if (raw == null) return undefined;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
  })();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<string | null>(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  // Dashboard KPI + widget state (lifted for full-width rendering)
  const DASH_DEFAULT_WIDGETS = ["po_spend_trend", "so_spend_trend", "po_order_activity", "so_order_activity", "po_recent_orders", "so_recent_orders", "spend_by_category", "credit_health", "delivery_perf", "invoice_aging", "primary_contact", "return_rate", "top_items", "payment_history", "compliance_docs"];
  const [dashActiveKpis, setDashActiveKpis] = useState<string[]>(DEFAULT_DASH_KPIS);
  const [dashActiveWidgets, setDashActiveWidgets] = useState<string[]>([...DASH_DEFAULT_WIDGETS]);
  const [dashWidgetSizes, setDashWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  const [dashDateRange, setDashDateRange] = useState<InsightsRange>("last_30");
  const [dashCustom, setDashCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const handleToggleKpi = useCallback((key: string) => {
    setDashActiveKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleToggleWidget = useCallback((key: string) => {
    setDashActiveWidgets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleWidgetSizeChange = useCallback((key: string, size: "sm" | "md" | "lg") => {
    setDashWidgetSizes((prev) => ({ ...prev, [key]: size }));
  }, []);

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    setDashActiveWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setDashActiveKpis((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(() => {
    setDashActiveKpis([...DEFAULT_DASH_KPIS]);
    setDashActiveWidgets([...DASH_DEFAULT_WIDGETS]);
    setDashWidgetSizes({});
    toast.success("Layout reset to defaults");
  }, []);
  /* Reset stays grey until the dashboard diverges from its default
   * KPI/widget set, order, or sizes — mirrors the listing pages'
   * dirty-aware InsightsResetButton. */
  const dashDirty =
    dashActiveKpis.join(",") !== DEFAULT_DASH_KPIS.join(",") ||
    dashActiveWidgets.join(",") !== DASH_DEFAULT_WIDGETS.join(",") ||
    Object.keys(dashWidgetSizes).length > 0;

  const activeKpiDefs = useMemo(
    () => dashActiveKpis.map((k) => DASH_KPI_DEFS.find((d) => d.key === k)).filter(Boolean) as DashKpiDef[],
    [dashActiveKpis]
  );

  // IntersectionObserver sentinel – the compact header kicks in once this
  // sentinel scrolls out of view (i.e. user scrolled past the full header area).
  const sentinelRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [descNeedsTruncation, setDescNeedsTruncation] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "-44px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const vendor = getVendor(id!);

  // The partner's currency (its own, else its primary group's, spec 4.2) and
  // whether this profile shows its amounts in it (the default) or in base.
  const currencyInfoOf = usePartnerCurrencyInfo();
  const partnerCurrency = vendor ? currencyInfoOf(vendor) : null;
  const [profileCurrencyView, setProfileCurrencyView] = useState<CurrencyView>("partner");
  const profileCurrency = useMemo(
    () => ({ view: profileCurrencyView, partnerCurrency: partnerCurrency?.code ?? BASE_CURRENCY, streams: vendor?.currencyBreakdown }),
    [profileCurrencyView, partnerCurrency?.code, vendor?.currencyBreakdown],
  );

  // Generate location data for KPI computations (must be after vendor is available)
  const locationsData = useMemo(() => vendor ? generateLocationsFromVendor(vendor) : [], [vendor]);

  // ── Location KPIs state (matches listing page pattern) ──
  const LOC_KPI_ALL = [
    { key: "loc_total", label: "Total Locations", category: "Overview", iconName: "MapPin", tooltip: "Count of all registered partner locations including warehouses, offices, and distribution centers." },
    { key: "loc_active", label: "Active Locations", category: "Overview", iconName: "CheckCircle2", tooltip: "Locations currently operational and available for transactions, shipping, and order fulfillment." },
    { key: "loc_inactive", label: "Inactive Locations", category: "Overview", iconName: "CircleSlash", tooltip: "Locations that have been temporarily suspended or deactivated. They are excluded from new transactions." },
    { key: "loc_contacts", label: "Total Contacts", category: "People", iconName: "Users", tooltip: "Combined number of assigned point-of-contacts across all locations. Includes primary and secondary contacts." },
    { key: "loc_centers", label: "Service Centers", category: "Operational", iconName: "Wrench", tooltip: "Facilities providing maintenance, repair, or after-sales service. Higher counts indicate stronger on-ground support." },
    { key: "loc_items", label: "Total Items", category: "Operational", iconName: "Package", tooltip: "Aggregate number of SKUs and inventory items managed across all partner locations." },
    { key: "loc_countries", label: "Countries", category: "Overview", iconName: "Globe", tooltip: "Number of unique countries where this partner has registered locations. Indicates geographic footprint." },
    { key: "loc_avg_contacts", label: "Avg Contacts/Location", category: "People", iconName: "User", tooltip: "Average number of assigned contacts per location. Low values may indicate understaffed sites." },
  ];
  const LOC_KPI_DEFAULT = ["loc_total", "loc_active", "loc_contacts", "loc_centers"];
  const [locActiveKpis, setLocActiveKpis] = useState<string[]>([...LOC_KPI_DEFAULT]);
  const [locKpiPanelOpen, setLocKpiPanelOpen] = useState(false);

  const handleLocToggleKpi = useCallback((key: string) => {
    setLocActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const moveLocKpi = useCallback((fromIndex: number, toIndex: number) => {
    setLocActiveKpis(prev => { const next = [...prev]; const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved); return next; });
  }, []);

  const computeLocKpiValue = useCallback((key: string): string => {
    const locs = locationsData;
    const active = locs.filter(l => l.status === "active").length;
    switch (key) {
      case "loc_total": return String(locs.length);
      case "loc_active": return String(active);
      case "loc_inactive": return String(locs.length - active);
      case "loc_contacts": return String(locs.reduce((s, l) => s + l.contacts, 0));
      case "loc_centers": return String(locs.reduce((s, l) => s + l.serviceCenters, 0));
      case "loc_items": return String(locs.reduce((s, l) => s + l.items, 0));
      case "loc_countries": return String(new Set(locs.map(l => l.country)).size);
      case "loc_avg_contacts": { const avg = locs.length > 0 ? (locs.reduce((s, l) => s + l.contacts, 0) / locs.length).toFixed(1) : "0"; return avg; }
      default: return "—";
    }
  }, [locationsData]);

  if (!vendor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Building2 className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">Partner not found.</p>
        <Button variant="outline" onClick={() => navigate("/vendors")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Partners
        </Button>
      </div>
    );
  }

  const handleArchive = () => {
    archiveVendor(vendor.id);
    toast.success(`${vendor.displayName} archived.`);
    setArchiveDialogOpen(false);
  };

  const handleRestore = () => {
    restoreVendor(vendor.id);
    toast.success(`${vendor.displayName} unarchived.`);
  };

  const handleStatusChange = (newStatus: string) => {
    updateVendor(vendor.id, { status: newStatus as "active" | "inactive" | "archived" });
    toast.success(
      newStatus === "active"
        ? `${vendor.displayName} marked as Active.`
        : `${vendor.displayName} marked as Inactive.`,
    );
    setStatusConfirmOpen(false);
    setStatusChangeTarget(null);
  };

  // The partner's amounts are in its currency; these show them in the
  // profile's view (text for charts and labels, money() with its hover).
  const profileMoney = profileFormatters(profileCurrency);
  const formatCurrency = profileMoney.moneyText;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const creditUtilization =
    vendor.creditLimit > 0
      ? Math.round((vendor.creditUtilization / vendor.creditLimit) * 100)
      : 0;

  const cfg = vendor.configData;
  const hasPOCs = cfg?.pointsOfContact && cfg.pointsOfContact.length > 0;
  const hasPaymentMethods = cfg?.paymentMethods && cfg.paymentMethods.length > 0;
  const hasPaymentTerm = !!cfg?.paymentTermConfig;
  const hasPricingRules = cfg?.pricingRules && cfg.pricingRules.length > 0;
  const hasShipping = cfg?.shippingConfig && (cfg.shippingConfig.carrierServices.length > 0 || cfg.shippingConfig.vendorPreferences.length > 0);

  const PAYMENT_TYPE_ICONS: Record<string, typeof Banknote> = {
    ach: Banknote,
    check: FileText,
    wire: Globe,
    card: CreditCard,
    digital_wallet: Wallet,
    cash: DollarSign,
  };

  // Build initials for avatar
  const initials = vendor.displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  // Canonical lifecycle palette — matches the VendorStatusBadge used
  // in the partner listing's Status column. Same values now drive the
  // trigger pill, dropdown items, status badge, and any chip
  // referencing status across every detail surface.
  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
    archived: { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", label: "Archived" },
  };
  const currentStatus = statusConfig[vendor.status] || statusConfig.active;

  // Contact count
  const contactCount = (vendor.globalPointOfContacts?.length || 0) + (cfg?.pointsOfContact?.length || 0);

  // Build the description text once for reuse
  const descriptionText = vendor.description || cfg?.description || `${CATEGORY_LABELS[vendor.category]} partner specializing in ${vendor.services || vendor.vendorType || "industrial solutions"}. Established operations across ${vendor.country || "multiple regions"} with a focus on quality assurance, timely delivery, and competitive pricing. This partner has been onboarded through the standard vendor qualification process and maintains active compliance certifications for all applicable regulatory requirements.`;

  // Detect if description needs truncation (exceeds 1 line at ~20px collapsed max-height)
  useEffect(() => {
    const check = () => {
      const el = descRef.current;
      if (!el) return;
      setDescNeedsTruncation(el.scrollHeight > 22);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [descriptionText]);

  // All statuses a user can switch to
  const ALL_STATUSES = ["active", "inactive", "archived"] as const;

  // ── Actions dropdown (shared between full + compact headers) ──
  const ActionsDropdown = ({ compact = false }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${compact ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"}`} style={{ fontWeight: 500 }}>
          Actions
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[200] w-56">
        {vendor.status !== "archived" && (
          <>
            {/* Create & communicate */}
            <DropdownMenuItem onClick={() => toast.info("Create New Location, coming soon")}>
              <MapPinPlus className="w-4 h-4 mr-2 text-slate-500" />
              Create New Location
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Email feature coming soon")}>
              <Mail className="w-4 h-4 mr-2 text-slate-500" />
              Send Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Purchase Order creation coming soon")}>
              <ClipboardList className="w-4 h-4 mr-2 text-slate-500" />
              Create Purchase Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Sales Order creation coming soon")}>
              <FileText className="w-4 h-4 mr-2 text-slate-500" />
              Create Sales Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Quote creation coming soon")}>
              <FileUp className="w-4 h-4 mr-2 text-slate-500" />
              Create Quote
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Invoice creation coming soon")}>
              <Receipt className="w-4 h-4 mr-2 text-slate-500" />
              Add Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Documents & Notes */}
            <DropdownMenuItem onClick={() => toast.info("Note creation coming soon")}>
              <StickyNote className="w-4 h-4 mr-2 text-slate-500" />
              Add Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Upload feature coming soon")}>
              <Upload className="w-4 h-4 mr-2 text-slate-500" />
              Upload
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Utilities */}
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(appHref()); toast.success("Link copied to clipboard"); }}>
          <Link2 className="w-4 h-4 mr-2 text-slate-500" />
          Copy Link
        </DropdownMenuItem>
        {vendor.website && (
          <DropdownMenuItem onClick={() => window.open(vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2 text-slate-500" />
            Visit Website
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {/* Status & Lifecycle — colors mirror modal CTA palette so the
            menu reads as a quick path to the same action. */}
        {vendor.status === "active" && (
          <DropdownMenuItem
            onClick={() => { setStatusChangeTarget("inactive"); setStatusConfirmOpen(true); }}
            className="focus:bg-amber-50"
            style={{ color: "#B45309" }}
          >
            <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
            Mark as Inactive
          </DropdownMenuItem>
        )}
        {vendor.status === "inactive" && (
          <DropdownMenuItem
            onClick={() => { setStatusChangeTarget("active"); setStatusConfirmOpen(true); }}
            className="focus:bg-emerald-50"
            style={{ color: "#059669" }}
          >
            <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
            Mark as Active
          </DropdownMenuItem>
        )}
        {vendor.status === "archived" ? (
          <DropdownMenuItem
            onClick={handleRestore}
            className="focus:bg-emerald-50"
            style={{ color: "#059669" }}
          >
            <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
            Unarchive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-red-50">
            <Archive className="w-4 h-4 mr-2 text-destructive" />
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ── Edit CTA (shared) — opens edit modal ──
  const EditCta = ({ compact = false }: { compact?: boolean }) => (
    <button
      onClick={() => setEditModalOpen(true)}
      className={`rounded-lg bg-primary hover:bg-[#086AE6] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
      style={{ fontWeight: 600 }}
    >
      <Pencil className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      Edit Partner
    </button>
  );

  // Only active/inactive in the status dropdown (archive is a separate action)
  const DROPDOWN_STATUSES = ["active", "inactive"] as const;

  // ── Status pill with dropdown ──
  const StatusPill = ({ compact = false }: { compact?: boolean }) => (
    <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center rounded-full border cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border ${compact ? "px-1.5 py-px text-[10px] gap-0.5" : "px-2 py-0.5 text-[11px] gap-1"}`}
          style={{ fontWeight: 500, backgroundColor: currentStatus.bg, color: currentStatus.color, borderColor: currentStatus.border }}
        >
          {currentStatus.label}
          <ChevronDown className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="space-y-1">
          {DROPDOWN_STATUSES.map((s) => {
            const sc = statusConfig[s];
            const isCurrent = s === vendor.status;
            return (
              <button
                key={s}
                onClick={() => {
                  if (!isCurrent) {
                    setStatusChangeTarget(s);
                    setStatusConfirmOpen(true);
                    setStatusDropdownOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}
              >
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                  style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}
                >
                  {sc.label}
                </span>
                {isCurrent && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  // Build sub-type pills for display. Vendor Rules and Buyer are the
  // base vendor / customer roles — every partner has them by default
  // and they don't earn a subtype pill. Only meaningful overlays
  // (Carrier today, future ones tomorrow) render as pills.
  const vendorSubTypeLabels = (vendor.vendorSubTypes || []).filter((s) => s !== "Vendor Rules");
  const customerSubTypeLabels = (vendor.customerSubTypes || []).filter((s) => s !== "Customer Rules");
  const allSubTypes = [...vendorSubTypeLabels, ...customerSubTypeLabels];

  return (
    <ProfileCurrencyProvider value={profileCurrency}>
    <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
      {/* ══════════════════════════════════════════════
          TOP NAV BAR
         ══════════════════════════════════════════════ */}
      <div data-page-topbar className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button
            onClick={() => navigate("/partners")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Partners Management
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => navigate("/vendors")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Partners
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground" style={{ fontWeight: 500 }}>{vendor.displayName}</span>
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

      {/* IntersectionObserver sentinel — sits right below nav bar */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════════════════════════════════════════
          SINGLE STICKY HEADER — morphs between full & compact
         ══════════════════════════════════════════════ */}
      <div data-page-topbar className="shrink-0 sticky top-[48px] z-20 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? "8px" : "12px", paddingBottom: "4px", transition: "padding-top 250ms ease" }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
            {/* Status-tinted vertical gradient header — same hues as the
                status pill (active → emerald, inactive → amber,
                archived → rose). Tint sits at the bottom edge and
                fades to white moving upward, matching the reference. */}
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}
              style={
                vendor.status === "archived"
                  ? { background: "linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FECACA" }
                  : vendor.status === "inactive"
                    ? { background: "linear-gradient(to top, #FFFBEB 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FDE68A" }
                    : { background: "#FFFFFF", borderColor: "rgb(var(--border))" }
              }
            >
              {/* Main header row — morphs between full and compact */}
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? "6px 16px" : "12px 16px" }}
              >
                {/* Left: Back + Avatar + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back button */}
                  <button
                    onClick={() => navigate("/vendors")}
                    className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Avatar */}
                  {vendor.profileImage ? (
                    <img
                      src={vendor.profileImage}
                      alt={vendor.displayName}
                      className="rounded-xl object-cover shrink-0 border border-border shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                      style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    />
                  ) : (
                    <div
                      className="rounded-xl flex items-center justify-center shrink-0 text-white border border-white shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_0_0_2px_rgba(10,119,255,0.10)] transition-all duration-250"
                      style={{
                        width: isScrolled ? 32 : 44,
                        height: isScrolled ? 32 : 44,
                        fontSize: isScrolled ? 10 : 14,
                        backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "rgb(var(--primary))"),
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Name + Badges + Description */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Name + Status + Type + (expanded-only: Sub-types + Group) */}
                    <div className="flex items-center flex-wrap gap-1.5 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-foreground truncate transition-all duration-250"
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? "18px" : "22px" }}
                      >
                        {vendor.displayName}
                      </h1>

                      {/* Status badge — clickable dropdown */}
                      <StatusPill compact={isScrolled} />

                      {/* Partner Type badges — with sub-types on hover */}
                      {(vendor.partnerTypes || []).map((type) => {
                        const subs = type === "vendor" ? vendorSubTypeLabels : customerSubTypeLabels;
                        const badge = (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border transition-all duration-250"
                            style={{
                              padding: isScrolled ? "1px 6px" : "2px 8px",
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                              cursor: subs.length > 0 ? "default" : undefined,
                              // Match the partners-listing pill palette so the same Vendor/Customer
                              // tags read identically across the listing table and the detail header.
                              backgroundColor: type === "vendor" ? "#EBF3FF" : "#F5F3FF",
                              color: type === "vendor" ? "#0548A3" : "#5B21B6",
                              borderColor: type === "vendor" ? "#A8D2FF" : "#DDD6FE",
                            }}
                          >
                            {type === "vendor" ? (
                              <Truck className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                            ) : (
                              <ShoppingCart className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                            )}
                            {type === "vendor" ? "Vendor" : "Customer"}
                            {subs.length > 0 && (
                              <span style={{ fontSize: isScrolled ? 9 : 10, opacity: 0.7, fontWeight: 500 }}>· {subs.length}</span>
                            )}
                          </span>
                        );
                        if (subs.length === 0) return <React.Fragment key={type}>{badge}</React.Fragment>;
                        return (
                          <Tooltip key={type}>
                            <TooltipTrigger asChild>{badge}</TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="z-[300] max-w-[260px]">
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>
                                  {type === "vendor" ? "Vendor" : "Customer"} Profiles
                                </p>
                                {subs.map((st) => (
                                  <div key={st} className="flex items-center gap-2 py-0.5">
                                    <Settings2 className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{st}</span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                      {/* Partner Groups — hidden when compact */}
                      {!isScrolled && vendor.partnerGroup && (() => {
                        const primaryGroup = PARTNER_GROUPS.find((g) => g.id === vendor.partnerGroup);
                        // Secondary group sample — pull from the full
                        // catalog regardless of country so the popover
                        // surfaces a diverse set of flags (groups can
                        // span countries). Capped at 6 so the list stays
                        // tight; the popover still height-limits and
                        // scrolls anything that fits.
                        const extraGroups = PARTNER_GROUPS
                          .filter((g) => g.id !== vendor.partnerGroup)
                          .slice(0, 6);
                        if (!primaryGroup) return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-border bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {vendor.partnerGroup}
                          </span>
                        );
                        return (
                          <PartnerGroupHoverPill group={primaryGroup} extraGroups={extraGroups} />
                        );
                      })()}
                    </div>

                    {/* ── Description — hidden when compact ── */}
                    <div
                      className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl relative"
                      style={{
                        maxHeight: isScrolled ? 0 : descExpanded ? 500 : 20,
                        opacity: isScrolled ? 0 : 1,
                        marginTop: isScrolled ? 0 : 6,
                      }}
                    >
                      <div ref={descRef} className="overflow-hidden" style={{ maxHeight: descExpanded ? 500 : 20 }}>
                        <p className="text-[12px] text-slate-500 leading-[1.6]">
                          {descriptionText}
                          {descExpanded && descNeedsTruncation && (
                            <>
                              {" "}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
                                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#086AE6] cursor-pointer align-baseline"
                                style={{ fontWeight: 500 }}
                              >
                                Show Less <ChevronUp className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      {!descExpanded && descNeedsTruncation && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                          className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#086AE6] cursor-pointer"
                          style={{ fontWeight: 500, lineHeight: "20px" }}
                        >
                          ... More <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Fullscreen + Actions + Edit CTA */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        ) : (
                          <Maximize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[300]">{isFullscreen ? "Exit Full Screen" : "Full Screen"}</TooltipContent>
                  </Tooltip>
                  <ActionsDropdown compact={isScrolled} />
                  <EditCta compact={isScrolled} />
                </div>
              </div>

              {/* Tab bar — always visible at the bottom of the card */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isExternal = tab.id === "partner_communication";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (isExternal) {
                          window.open(`${PARTNER_COMM_MODULE_URL}/${id}`, "_blank", "noopener");
                          return;
                        }
                        setActiveTab(tab.id);
                      }}
                      className={`flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                      }`}
                      style={{
                        padding: isScrolled ? "8px 14px" : "10px 14px",
                        fontSize: isScrolled ? 12 : 13,
                        fontWeight: isActive ? 600 : 400,
                        transition: "padding 250ms ease, font-size 250ms ease",
                      }}
                    >
                      {tab.label}
                      {isExternal && <ExternalLink className="w-3 h-3 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Bottom gradient fade — soft edge below sticky header */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)",
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* ── Scroll to top FAB ── */}
      <button
        onClick={() => {
          const el = scrollContainerRef.current;
          if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] active:scale-95 transition-all duration-300"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
          pointerEvents: isScrolled ? "auto" : "none",
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-slate-500" />
      </button>

      {/* ══════════════════════════════════════════════
          BODY: centered container on large screens
         ══════════════════════════════════════════════ */}
      <div className="flex-1">
        <div className={`mx-auto px-3 pt-2 pb-3 space-y-4 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
          {/* Full-width KPI strip — only on Dashboard tab */}
          {activeTab === "dashboard" && (
            <div>
              {/* Info bar — mb-2.5 matches the listing pages' insights header gap */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Dashboard</span>
                  {/* Date Range Filter — shared invoicing control (incl. All time + Custom) */}
                  <InsightsRangeMenu
                    range={dashDateRange}
                    onRangeChange={setDashDateRange}
                    customFrom={dashCustom.from}
                    customTo={dashCustom.to}
                    onCustomChange={(from, to) => setDashCustom({ from, to })}
                  />
                  <InsightsRefresh toastLabel="Dashboard refreshed" />
                </div>
                <div className="flex items-center gap-2">
                  {/* Base ↔ Partner currency — hidden for a partner in the base currency. */}
                  <CurrencyViewToggle view={profileCurrencyView} onChange={setProfileCurrencyView} partnerCurrency={profileCurrency.partnerCurrency} />
                  <InsightsResetButton dirty={dashDirty} onReset={handleResetLayout} />
                  <button
                    onClick={() => setCustomizePanelOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
                  >
                    <Sliders className="w-3 h-3" />
                    Customize Widgets
                  </button>
                </div>
              </div>

              {/* KPI Cards — draggable responsive grid */}
              {activeKpiDefs.length > 0 && (
                <DndProvider backend={HTML5Backend}>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {activeKpiDefs.map((kpi, idx) => {
                      const computed = computeDashKpiValue(kpi.key, vendor, formatCurrency, formatDate);
                      // Top Item Purchased / Top Item Sold render the
                      // composite the Transactions strip uses — mini
                      // avatar + part-number link + % share pill — via
                      // valueNode. The pill is this partner's share of
                      // total volume of that SKU across all partners
                      // (concentration metric), not a within-partner
                      // basket share. Numbers are representative mocks
                      // until the live transaction feed wires through.
                      const isTopPurchased = kpi.key === "top_item_purchased";
                      const isTopSold = kpi.key === "top_item_sold";
                      const isTopItem = isTopPurchased || isTopSold;
                      const valueNode = isTopItem ? (() => {
                        // Mock SKU + share + image pinned to each key per
                        // Eli: the card labeled "Top Item Sold" (key
                        // top_item_purchased) surfaces what WE SELL to this
                        // partner; the card labeled "Top Item Purchased"
                        // (key top_item_sold) surfaces what WE BUY from
                        // them. Keys were left untouched when the visible
                        // labels were flipped, so the share-direction word
                        // here is keyed off the LABEL meaning, not the key
                        // name — top_item_purchased shows "sales" (Sold)
                        // and top_item_sold shows "purchases" (Purchased).
                        const sku = isTopPurchased ? "BRK-PAD-CRMC-22" : "MOTR-AC-075-05";
                        const sharePct = isTopPurchased ? "6.2%" : "4.4%";
                        const shareLabel = `${sharePct} of all ${isTopPurchased ? "sales" : "purchases"} of this SKU across all partners`;
                        const skuImg = isTopPurchased
                          ? "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=80&h=80&fit=crop"
                          : "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=80&h=80&fit=crop";
                        return (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open("/items", "_blank", "noopener,noreferrer"); }}
                              className="w-5 h-5 rounded bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_rgba(10,119,255,0.18)]"
                              title="View item details"
                            >
                              <img src={skuImg} alt="" className="w-full h-full object-cover" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); window.open("/items", "_blank", "noopener,noreferrer"); }}
                              className="text-[14px] text-foreground truncate hover:text-primary hover:underline transition-colors cursor-pointer text-left min-w-0"
                              style={{ fontWeight: 600 }}
                              title={`${sku} · ${shareLabel}`}
                            >
                              {sku}
                            </button>
                            <span
                              className="text-[10px] shrink-0 px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100"
                              style={{ fontWeight: 600 }}
                              title={shareLabel}
                            >
                              {sharePct}
                            </span>
                          </div>
                        );
                      })() : undefined;
                      // Amounts get their currency hover (base or partner amount, and the rate).
                      const moneyNode = dashKpiAmount(kpi.key, vendor);
                      return (
                        <DraggableKpiCard
                          key={kpi.key}
                          index={idx}
                          kpiKey={kpi.key}
                          label={kpi.label}
                          value={computed.value}
                          valueNode={valueNode ?? (moneyNode != null ? <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{profileMoney.money(moneyNode, { rolledUp: kpi.key === "total_spent" })}</p> : undefined)}
                          subtitle={kpi.subtitle}
                          iconName={kpi.iconName}
                          tooltip={kpi.tooltip}
                          change={computed.change}
                          changeColor={computed.changeColor}
                          moveCard={moveKpi}
                          onRemove={() => handleToggleKpi(kpi.key)}
                        />
                      );
                    })}
                  </div>
                </DndProvider>
              )}
            </div>
          )}

          {/* Location KPIs — draggable, with Add Insights panel (matches listing page) */}
          {activeTab === "partner_locations" && locActiveKpis.length > 0 && (
            <div className="mb-1">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Location Insights</span>
                <button
                  onClick={() => setLocKpiPanelOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
                >
                  <Plus className="w-3 h-3" />
                  Add Insights
                </button>
              </div>
              {/* KPI Cards — draggable responsive grid */}
              <DndProvider backend={HTML5Backend}>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                  {locActiveKpis.map((kpiKey, idx) => {
                    const def = LOC_KPI_ALL.find(k => k.key === kpiKey);
                    if (!def) return null;
                    return (
                      <DraggableKpiCard
                        key={kpiKey}
                        index={idx}
                        kpiKey={kpiKey}
                        label={def.label}
                        value={computeLocKpiValue(kpiKey)}
                        iconName={def.iconName}
                        tooltip={def.tooltip}
                        moveCard={moveLocKpi}
                        onRemove={() => handleLocToggleKpi(kpiKey)}
                      />
                    );
                  })}
                </div>
              </DndProvider>
            </div>
          )}
          {/* Location KPI Customize Panel — side drawer (matches KpiInsightsPanel exactly) */}
          {activeTab === "partner_locations" && <LocKpiInsightsDrawer open={locKpiPanelOpen} onOpenChange={setLocKpiPanelOpen} activeKpis={locActiveKpis} onToggleKpi={handleLocToggleKpi} allKpis={LOC_KPI_ALL} computeValue={computeLocKpiValue} />}

          <div className="flex gap-5 items-start">
            {/* ── LEFT PANEL ── */}
            <div className="flex-1 min-w-0">
              {activeTab === "dashboard" && (
                <DashboardTab vendor={vendor} cfg={cfg} formatCurrency={formatCurrency} formatDate={formatDate} activeWidgets={dashActiveWidgets} widgetSizes={dashWidgetSizes} onWidgetSizeChange={handleWidgetSizeChange} onRemoveWidget={handleToggleWidget} moveWidget={moveWidget} />
              )}
              {activeTab === "partner_locations" && (
                <PartnerLocationsTab
                  vendor={vendor}
                  cfg={cfg}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  initialLocationIdx={initialLocationIdx}
                  onInitialLocationConsumed={() => {
                    // Clear the ?loc= param so a subsequent close doesn't reopen the modal on navigation back.
                    const next = new URLSearchParams(searchParams);
                    next.delete("loc");
                    setSearchParams(next, { replace: true });
                  }}
                  dashActiveWidgets={dashActiveWidgets}
                  dashWidgetSizes={dashWidgetSizes}
                  onDashWidgetSizeChange={handleWidgetSizeChange}
                  onDashRemoveWidget={handleToggleWidget}
                  moveDashWidget={moveWidget}
                  onDashResetLayout={handleResetLayout}
                  onDashOpenCustomize={() => setCustomizePanelOpen(true)}
                />
              )}
              {activeTab === "items" && (
                // Viewport-fitting wrapper so the Items tab's pagination
                // footer + Transactions KPI strip stay visible without
                // the user having to scroll the page. The table area
                // has its own internal overflow-auto, so this just
                // bounds the outer surface. dvh keeps the math sane on
                // mobile when the URL bar hides/shows. mb-6 mirrors the
                // page's side padding so the gap below pagination ==
                // the gap on the left/right (~24px), giving the surface
                // even framing on any screen size.
                <div
                  className="flex flex-col mb-6"
                  style={{ height: "calc(100dvh - 220px - 1.5rem)", minHeight: 480 }}
                >
                  <PartnerItemsTab vendor={vendor} />
                </div>
              )}
              {activeTab === "transactions" && (
                /* Transactions — promoted to a top-level tab. Same component
                   as Items renders, but locked to the Transactions sub-tab so
                   the sub-tab strip + direction filter + KPI strip + table
                   render edge-to-edge. */
                <div
                  className="flex flex-col mb-6"
                  style={{ height: "calc(100dvh - 220px - 1.5rem)", minHeight: 480 }}
                >
                  <PartnerItemsTab vendor={vendor} lockSubTab="transactions" />
                </div>
              )}
              {activeTab === "pricing_rules" && (
                <PricingRulesTabNew vendor={vendor} cfg={cfg} />
              )}
              {activeTab === "partner_communication" && (
                <PlaceholderTab label="Partner Communication" description="Manage communication channels and message history with this partner." icon={MessageSquare} />
              )}
              {activeTab === "global_contacts" && (
                <ContactsTab vendor={vendor} cfg={cfg} />
              )}
              {activeTab === "carrier_profile" && (
                <CarrierProfileTab vendor={vendor} />
              )}
              {activeTab === "freight_logistics" && (
                <FreightLogisticsTab vendor={vendor} />
              )}
              {activeTab === "payment_methods" && (
                <PaymentMethodsTab cfg={cfg} PAYMENT_TYPE_ICONS={PAYMENT_TYPE_ICONS} />
              )}
              {activeTab === "gl_accounts" && (
                <PlaceholderTab
                  label="GL Accounts"
                  description="Account mapping for this partner is being designed in a separate workstream (Ashma's GL discovery). Once it lands, this tab will surface 3 to 4 account pickers that decide which ledger accounts transactions for this partner route to. Setting them at the Partner Group level pre-fills them here."
                  icon={Settings2}
                />
              )}
              {activeTab === "purchase_orders" && <PurchaseOrdersTable />}
              {activeTab === "quotes" && <QuotesTable />}
              {activeTab === "sales_orders" && <SalesOrdersTable />}
              {activeTab === "notes" && (
                <PlaceholderTab
                  label="Notes"
                  description="Free-text notes against this partner are being designed alongside the partner-activity feed. Once it lands, this tab will surface a chronological notes list with @-mentions, attachments, and per-note visibility controls so account-team comments stay scoped to the right audience."
                  icon={MessageSquare}
                />
              )}
              {activeTab === "attachments" && <AttachmentsTab />}
              {activeTab === "recent_activity" && (
                <ActivityTab vendor={vendor} formatDate={formatDate} />
              )}
            </div>

            {/* ── RIGHT SIDEBAR ──
                Originally surfaced partner-info cards on the
                Recent Activity tab; per stakeholder feedback the
                Activity Timeline now takes the full width, so the
                sidebar is hidden everywhere. The block stays in
                place (vs. deleted) so the partner-info cards can
                be reactivated later if needed. */}
            <div className="hidden">
              {/* Partner Information Card */}
              <SidebarCard title="Partner Information">
                <div className="space-y-3">
                  {vendor.partnerGroup && (
                    <SidebarRow icon={Building2} label="Partner Group" value={vendor.partnerGroup} />
                  )}
                  {vendor.primaryContact.phone && (
                    <SidebarRow icon={Phone} label="Phone" value={vendor.primaryContact.phone} />
                  )}
                  {vendor.emailAddress && (
                    <SidebarRow icon={Mail} label="Email" value={vendor.emailAddress} />
                  )}
                  {vendor.website && (
                    <SidebarRow icon={Globe} label="Website" value={vendor.website} isLink />
                  )}
                  {vendor.billingAddress.street && (
                    <SidebarRow
                      icon={MapPin}
                      label="Address"
                      value={`${vendor.billingAddress.street}, ${vendor.billingAddress.city}${vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""} ${vendor.billingAddress.zipCode}, ${vendor.billingAddress.country}`}
                      isAddress
                    />
                  )}
                </div>
              </SidebarCard>

              {/* Quick Stats */}
              <SidebarCard title="Quick Stats">
                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox label="Purchase Orders" value={String(splitVendorOrders(vendor).po)} icon={ShoppingCart} />
                  <StatBox label="Sales Orders" value={String(splitVendorOrders(vendor).so)} icon={Receipt} />
                  <StatBox label="Total Spent" value={profileMoney.money(vendor.totalSpent, { rolledUp: true })} icon={TrendingUp} />
                  <StatBox label="Outstanding" value={profileMoney.money(vendor.outstandingBalance || 0)} icon={Receipt} color="#F59E0B" />
                  <StatBox label="Credit Used" value={`${creditUtilization}%`} icon={DollarSign} color={creditUtilization > 80 ? "rgb(var(--destructive))" : creditUtilization > 50 ? "rgb(var(--warning))" : "rgb(var(--success))"} />
                </div>
              </SidebarCard>

              {/* Point of Contacts */}
              {vendor.globalPointOfContacts.length > 0 && (
                <SidebarCard title="Points of Contact">
                  <div className="space-y-2">
                    {vendor.globalPointOfContacts.slice(0, 4).map((contact, idx) => {
                      const _at = getPocAvatarTint(contact.bgColor);
                      return (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] shrink-0"
                          style={{ backgroundColor: _at.bg, color: _at.text, fontWeight: 700 }}
                        >
                          {contact.initials}
                        </div>
                        <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{contact.name}</span>
                        {idx === 0 && (
                          <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent ml-auto shrink-0" style={{ fontWeight: 600 }}>Primary</span>
                        )}
                      </div>
                      );
                    })}
                    {vendor.globalPointOfContacts.length > 4 && (
                      <button
                        onClick={() => setActiveTab("global_contacts")}
                        className="text-xs text-primary hover:text-[#086AE6] transition-colors cursor-pointer mt-1"
                        style={{ fontWeight: 500 }}
                      >
                        +{vendor.globalPointOfContacts.length - 4} more
                      </button>
                    )}
                  </div>
                </SidebarCard>
              )}

              {/* Partner Types */}
              <SidebarCard title="Partner Types">
                <div className="space-y-2">
                  {(vendor.partnerTypes || []).map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${type === "vendor" ? "bg-green-50" : "bg-blue-50"}`}>
                        {type === "vendor" ? (
                          <Truck className="w-3 h-3 text-[#166534]" />
                        ) : (
                          <ShoppingCart className="w-3 h-3 text-blue-800" />
                        )}
                      </div>
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>
                        {type === "vendor" ? "Vendor" : "Customer"}
                      </span>
                    </div>
                  ))}
                  {cfg && (() => {
                    // vendor_rules / buyer are the base roles. They don't
                    // earn a subtype pill; only meaningful overlays do.
                    const vSubs = (cfg.vendorSubTypes || []).filter((s) => s !== "vendor_rules" && s !== "Vendor Rules");
                    const cSubs = (cfg.customerSubTypes || []).filter((s) => s !== "customer_rules" && s !== "Customer Rules");
                    if (vSubs.length === 0 && cSubs.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {vSubs.map((st) => (
                          <span key={st} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
                            {VENDOR_SUB_TYPES.find((t) => t.id === st)?.label ?? st}
                          </span>
                        ))}
                        {cSubs.map((st) => (
                          <span key={st} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
                            {CUSTOMER_SUB_TYPES.find((t) => t.id === st)?.label ?? st}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </SidebarCard>

              {/* Created Info */}
              <SidebarCard title="Created">
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Created By</p>
                    <div className="flex items-center gap-2">
                      {vendor.createdByContact?.photoUrl ? (
                        <img src={vendor.createdByContact.photoUrl} alt={vendor.createdByContact.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0"
                          style={{ backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "#6366f1"), fontWeight: 600 }}
                        >
                          {vendor.createdByContact?.initials || "?"}
                        </div>
                      )}
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{vendor.createdByContact?.name || "—"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Created On</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{formatDate(vendor.createdAt)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Last Updated</p>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{formatDate(vendor.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </SidebarCard>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Customize Widget Panel */}
      {activeTab === "dashboard" && (
        <DashboardCustomizePanel
          open={customizePanelOpen}
          onOpenChange={setCustomizePanelOpen}
          activeKpis={dashActiveKpis}
          onToggleKpi={handleToggleKpi}
          activeWidgets={dashActiveWidgets}
          onToggleWidget={handleToggleWidget}
          widgetSizes={dashWidgetSizes}
          onWidgetSizeChange={handleWidgetSizeChange}
          vendor={vendor}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      {/* ── Dialogs ── */}

      {/* Archive confirmation — canonical lifecycle modal */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setArchiveDialogOpen(false)}
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
                Archive {vendor.displayName}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              This partner is removed from active lists. Existing transactions stay exactly as-is, and the partner can be restored from the archive at any time.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleArchive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Archive Partner
              </button>
              <button
                onClick={() => setArchiveDialogOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Active
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change confirmation — canonical lifecycle modal,
          matching PartnerGroupDetailsPage / ContactDetailPage exactly:
          - Mark as Active: green wash (#ECFDF5), green icon disk
            (#D1FAE5 / #065F46), MARK AS ACTIVE chip (green), green
            CTA #10B981.
          - Mark as Inactive: amber wash (#FFFBEB), amber icon disk
            (#FEF3C7 / #B45309), MARK AS INACTIVE chip (amber),
            amber CTA #F59E0B (NOT orange #F97316). */}
      <AlertDialog open={statusConfirmOpen && statusChangeTarget === "active"} onOpenChange={(o) => { if (!o) { setStatusConfirmOpen(false); setStatusChangeTarget(null); } }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
              <CircleCheck className="w-8 h-8" style={{ color: "#065F46" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}>
              Mark as Active
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Mark {vendor.displayName} as Active?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The partner goes back to Active and reappears in default listings, pickers, and search. Existing assignments stay exactly as-is.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleStatusChange("active")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}>
                Mark as Active
              </button>
              <button onClick={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Keep Inactive
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusConfirmOpen && statusChangeTarget === "inactive"} onOpenChange={(o) => { if (!o) { setStatusConfirmOpen(false); setStatusChangeTarget(null); } }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }}
        >
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
                Mark {vendor.displayName} as Inactive?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The partner stops appearing in pickers and is excluded from new assignments. Existing assignments stay exactly as-is. Re-activate from the header CTA when you're ready.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleStatusChange("inactive")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}>
                Mark as Inactive
              </button>
              <button onClick={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Keep Active
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Partner modal — reuses CreatePartnerModal in edit mode */}
      <CreatePartnerModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        editMode
        editVendor={vendor as unknown as Record<string, unknown>}
        onPartnerCreated={() => {
          setEditModalOpen(false);
          toast.success("Partner updated successfully");
        }}
      />
    </div>
    </ProfileCurrencyProvider>
  );
}

// ══════════════════════════════════════════════
// PARTNER GROUP HOVER PILL WITH QUICK VIEW
// ═══════════════════════════���══════════════════

function PartnerGroupHoverPill({ group, extraGroups = [] }: {
  group: { id: string; name: string; description: string; country: string; countryFlag: string; memberCount: number };
  /** Secondary groups this partner belongs to. When provided, the "+N"
   *  overflow indicator renders inline inside the same pill (instead of
   *  a separate floating pill), mirroring the Vendor / Customer pill
   *  pattern: one pill, dot separator, count tail. The hover card adds
   *  a Secondary Groups section listing them as clickable links with a
   *  per-row quick-card preview rendered to the side. */
  extraGroups?: { id: string; name: string; description: string; country: string; countryFlag: string; memberCount: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [hoveredExtra, setHoveredExtra] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => { setOpen(false); setHoveredExtra(null); }, 150);
  }, []);

  const hoveredExtraGroup = hoveredExtra ? extraGroups.find((g) => g.id === hoveredExtra) : null;

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-border bg-muted text-muted-foreground cursor-default transition-colors hover:bg-border"
        style={{ fontWeight: 600 }}
      >
        <Star className="w-2.5 h-2.5 fill-slate-400 text-slate-400" />
        <FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /> {group.name}
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>· {group.memberCount}</span>
        {extraGroups.length > 0 && (
          <>
            <span className="text-[10px] text-slate-300" style={{ fontWeight: 400 }} aria-hidden="true">·</span>
            <span className="text-[10px] text-primary" style={{ fontWeight: 600 }}>+{extraGroups.length}</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex gap-2 items-start">
        <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
          {/* Dark gradient header — the title row is clickable so the
              primary group is reachable from the hover card too. Opens
              in a new tab so the user keeps their place on the partner
              detail page. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${group.id}`, "_blank", "noopener,noreferrer"); setOpen(false); }}
            className="group/primary w-full bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden text-left cursor-pointer hover:from-slate-700 hover:to-slate-600 transition-colors"
            title={`Open ${group.name} in a new tab`}
          >
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /></span>
                <span className="text-white text-[13px] truncate group-hover/primary:underline" style={{ fontWeight: 600 }}>
                  {group.name}
                </span>
              </div>
              <PrimaryPill className="shrink-0" />
            </div>
          </button>
          {/* Body */}
          <div className="bg-white px-3.5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
              {group.description}
            </p>
            <div className="flex items-center gap-4 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${group.id}`, "_blank", "noopener,noreferrer"); setOpen(false); }}
                className="flex items-center gap-1.5 text-[11px] text-primary hover:underline cursor-pointer transition-colors"
                style={{ fontWeight: 600 }}
                title={`Open ${group.name} in a new tab`}
              >
                <Users className="w-3 h-3" />
                <span>{group.memberCount} partners</span>
              </button>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Globe className="w-3 h-3 text-slate-400" />
                <span style={{ fontWeight: 500 }}>{group.country}</span>
              </div>
            </div>
            {/* Secondary groups — clickable rows that navigate to each
                group's detail page on click and surface a per-row
                quick-card preview alongside on hover. Up to ~5 rows
                visible; everything beyond scrolls in place (matches
                the partner-listing items overflow dropdown pattern). */}
            {extraGroups.length > 0 && (
              <div className="pt-3 border-t border-muted">
                <p className="text-[10px] text-slate-400 mb-2" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Secondary Groups</p>
                <div className="max-h-[200px] overflow-y-auto -mx-1.5 px-1.5">
                  <div className="space-y-0.5">
                    {extraGroups.map((g) => {
                      const isHovered = hoveredExtra === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onMouseEnter={() => setHoveredExtra(g.id)}
                          onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${g.id}`, "_blank", "noopener,noreferrer"); setOpen(false); }}
                          className={`group/row w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${isHovered ? "bg-slate-50" : "hover:bg-slate-50"}`}
                          title={`Open ${g.name} in a new tab`}
                        >
                          <span className="text-sm shrink-0"><FlagImage code={flagEmojiCode(g.countryFlag)} className="text-[13px]" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-slate-700 truncate group-hover/row:text-primary group-hover/row:underline transition-colors" style={{ fontWeight: 600 }}>{g.name}</p>
                            <p className="text-[10px] text-slate-400">{g.memberCount} members</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Per-row hover quick-card — same gradient-header treatment as
            the primary group card, rendered to the side of the main
            popover when a Secondary Groups row is hovered. Clicking
            the card navigates to that group too. */}
        {hoveredExtraGroup && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.open(`/partners/groups/${hoveredExtraGroup.id}`, "_blank", "noopener,noreferrer"); setOpen(false); }}
            className="group/preview w-[260px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60 self-end text-left cursor-pointer hover:shadow-[0_10px_36px_rgba(0,0,0,0.16)] transition-shadow"
            title={`Open ${hoveredExtraGroup.name} in a new tab`}
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(hoveredExtraGroup.countryFlag)} className="text-[13px]" /></span>
                  <span className="text-white text-[13px] truncate group-hover/preview:underline" style={{ fontWeight: 600 }}>{hoveredExtraGroup.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-slate-400 shrink-0" style={{ fontWeight: 600 }}>Secondary</span>
              </div>
            </div>
            <div className="bg-white px-3.5 py-3 space-y-3">
              <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">{hoveredExtraGroup.description}</p>
              <div className="flex items-center gap-4 pt-2 border-t border-muted">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span style={{ fontWeight: 500 }}>{hoveredExtraGroup.memberCount} partners</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span style={{ fontWeight: 500 }}>{hoveredExtraGroup.country}</span>
                </div>
              </div>
            </div>
          </button>
        )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ══════════════════════════════════════════════
// SIDEBAR HELPER COMPONENTS
// ══════════════════════════════════════════════

// PartnerGroupOverflowPill removed — overflow ("+N" secondary groups)
// now renders inline inside PartnerGroupHoverPill, so one merged pill
// carries primary + overflow + hover state.

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    null
  );
}

function SidebarRow({ icon: Icon, label, value, isLink, isAddress }: { icon: React.ElementType; label: string; value: string; isLink?: boolean; isAddress?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{label}</p>
        {isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-primary hover:underline break-all"
            style={{ fontWeight: 500 }}
          >
            {value}
          </a>
        ) : isAddress ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-slate-700 hover:text-primary hover:underline break-words transition-colors"
            style={{ fontWeight: 500 }}
          >
            {value}
          </a>
        ) : (
          <p className="text-[12px] text-slate-700 break-words" style={{ fontWeight: 500 }}>{value}</p>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: React.ReactNode; icon: React.ElementType; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-muted p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color: color || "#94A3B8" }} />
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{label}</span>
      </div>
      <p className="text-[14px] text-slate-700" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

// ══════════════════════════════════════════════
// CARRIER SHIPPING CARD (with tier-style method selector)
// ══════════════════════════════════════════════

function CarrierShippingCard({ carrier, inherited, deactivatedAtLocation, partnerName, onToggleDeactivate, onSetPrimary, onView, onEdit, onRemove, onSetStatus }: {
  carrier: {
    id: string;
    name: string;
    desc: string;
    isDefault: boolean;
    status: "active" | "inactive";
    methods: { id: string; name: string; shortName: string; desc: string; minDays: number; maxDays: number; isDefault: boolean; cost: string }[];
  };
  inherited?: boolean;
  deactivatedAtLocation?: boolean;
  partnerName?: string;
  onToggleDeactivate?: () => void;
  onSetPrimary?: () => void;
  /** Whole-card click + three-dot "View Details" both route here. */
  onView?: () => void;
  /** Three-dot "Edit Carrier" — reopens the canonical Add modal in
   *  edit mode so the user gets the same form they used to add. */
  onEdit?: () => void;
  /** Three-dot "Remove" — destructive, parent confirms. */
  onRemove?: () => void;
  /** Three-dot "Deactivate" / "Activate" — parent confirms with the
   *  canonical amber lifecycle modal. */
  onSetStatus?: (next: "active" | "inactive") => void;
}) {
  const [selectedMethodIdx, setSelectedMethodIdx] = useState(
    Math.max(0, carrier.methods.findIndex((m) => m.isDefault))
  );
  const activeMethod = carrier.methods[selectedMethodIdx];
  const isMuted = inherited && !deactivatedAtLocation;
  const isDeactivated = !!deactivatedAtLocation;

  // Primary cards get the same blue outline + soft shadow
  // treatment the canonical PaymentMethodCard uses, so the
  // active default carrier reads at-a-glance across both surfaces.
  const isPrimary = carrier.isDefault && !isDeactivated;
  const primaryBorder = "#0A77FF66"; // primary/40
  const primaryShadow = "0 2px 12px -4px rgba(10,119,255,0.12)";
  const primaryHoverShadow = "0 4px 20px -4px rgba(10,119,255,0.18)";
  return (
    <div
      onClick={onView}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isPrimary
          ? "border-[1.5px]"
          : "shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      } ${
        isDeactivated ? "border-dashed border-slate-300 bg-slate-50/40" : isPrimary ? "" : "border-border"
      } ${isMuted ? "opacity-[0.92]" : ""}`}
      style={isPrimary ? { borderColor: primaryBorder, boxShadow: primaryShadow } : undefined}
      onMouseEnter={(e) => {
        if (isDeactivated) return;
        if (isPrimary) {
          e.currentTarget.style.boxShadow = primaryHoverShadow;
        } else {
          e.currentTarget.style.borderColor = "#A8D2FF";
          e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #A8D2FF";
        }
      }}
      onMouseLeave={(e) => {
        if (isDeactivated) return;
        if (isPrimary) {
          e.currentTarget.style.boxShadow = primaryShadow;
        } else {
          e.currentTarget.style.borderColor = "rgb(var(--border))";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
        }
      }}
    >
      <div className={`p-3 flex-1 flex flex-col min-h-0 overflow-hidden ${isDeactivated ? "[&_*]:!text-slate-400 grayscale" : ""}`}>
        {/* Row 1: Type pill + badges */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 shrink-0 min-w-0">
            <span className="inline-flex items-stretch rounded-full overflow-hidden border border-blue-200 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-blue-800 bg-blue-50" style={{ fontWeight: 600 }}>
                <Truck className="w-3 h-3" /> Carrier
              </span>
              <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-blue-200" style={{ fontWeight: 500 }}>
                {carrier.methods.length} Method{carrier.methods.length !== 1 ? "s" : ""}
              </span>
            </span>
            {inherited && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border border-slate-200 bg-slate-50 text-slate-500 truncate max-w-[160px]"
                style={{ fontWeight: 500 }}
                title={`Inherited from ${partnerName ?? "partner"}`}
              >
                <Link2 className="w-3 h-3" />
                <span className="truncate">Inherited{partnerName ? ` from ${partnerName}` : ""}</span>
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {isDeactivated && (
              <span className="px-1.5 py-[2px] rounded-md text-[10px] border border-slate-300 bg-slate-100 text-slate-500" style={{ fontWeight: 600 }}>
                Deactivated Here
              </span>
            )}
            {carrier.isDefault && !isDeactivated && (
              <PrimaryPill />
            )}
            {/* Set-as-primary star — visible on non-primary saved
                carriers when the parent provides a handler. Hidden on
                deactivated-inherited rows since their actions surface
                are limited to re-enabling. */}
            {!carrier.isDefault && !isDeactivated && onSetPrimary && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetPrimary(); }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                title="Set as primary"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <span className={`px-2 py-[2px] rounded-full text-[10px] border ${carrier.status === "active" ? "border-[#BBF7D0] bg-green-50 text-[#166534]" : "border-border bg-slate-50 text-slate-400"}`} style={{ fontWeight: 500 }}>
              {carrier.status === "active" ? "Active" : "Inactive"}
            </span>
            {/* Three-dot menu — View Details / Edit / Deactivate
                (amber when active, neutral when inactive) / Remove.
                Mirrors the partner-detail Pricing Rules card.
                Only rendered when the parent provides handlers
                (inherited carriers skip it; their actions are
                Deactivate/Re-enable in the inline footer). */}
            {(onView || onEdit || onRemove || onSetStatus) && !inherited && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                    title="Carrier actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-1 z-[200]" onClick={(e) => e.stopPropagation()}>
                  {onView && (
                    <DropdownMenuItem
                      className="gap-2 py-1.5 cursor-pointer text-[13px]"
                      onSelect={() => onView()}
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem
                      className="gap-2 py-1.5 cursor-pointer text-[13px]"
                      onSelect={() => onEdit()}
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit Carrier
                    </DropdownMenuItem>
                  )}
                  {onSetStatus && (
                    carrier.status === "active" ? (
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px] text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                        onSelect={(e) => { e.preventDefault(); onSetStatus("inactive"); }}
                      >
                        <CircleSlash className="w-3.5 h-3.5 text-amber-600" /> Mark as Inactive
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px]"
                        onSelect={(e) => { e.preventDefault(); onSetStatus("active"); }}
                      >
                        <CircleSlash className="w-3.5 h-3.5 text-slate-500" /> Mark as Active
                      </DropdownMenuItem>
                    )
                  )}
                  {onRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 py-1.5 cursor-pointer text-[13px] text-destructive focus:text-destructive focus:bg-red-50"
                        onSelect={(e) => { e.preventDefault(); onRemove(); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" /> Remove
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Row 2: Carrier name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{carrier.name}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{carrier.desc}</p>
        </div>

        {/* The hero $X.XX / shipment row was removed per stakeholder
            feedback — real shipping pricing depends on weight, lane,
            packaging, etc., so a single static per-shipment number
            on the card was misleading. Days now live next to the
            method name in the bottom strip below. */}

        {/* Row 4: Shipping method tier selector */}
        {carrier.methods.length > 1 && (
          <div className="pt-2 shrink-0">
            <div className="flex items-center gap-1 flex-wrap">
              {carrier.methods.map((m, idx) => {
                const isActive = idx === selectedMethodIdx;
                return (
                <button
                  key={m.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedMethodIdx(idx); }}
                  className={`px-2 py-[3px] rounded-md text-[10px] transition-all cursor-pointer ${isActive ? "shadow-sm" : "hover:bg-border"}`}
                  style={{ fontWeight: isActive ? 600 : 500, backgroundColor: isActive ? "#EBF3FF" : "rgb(var(--muted))", color: isActive ? "rgb(var(--primary))" : "#64748B", boxShadow: isActive ? `0 0 0 1px #0A77FF30` : undefined }}
                >
                  <span className="inline-flex items-center gap-1">{m.shortName}{m.isDefault && <Star className="w-2.5 h-2.5 text-primary fill-primary" />}</span>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 5: Active method detail strip — service name on the
            left, transit window of whichever method chip is active
            on the right. (Cost was dropped from this strip too.) */}
        <div className="mt-auto pt-2 shrink-0">
          <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <Package className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate" style={{ fontWeight: 400 }}>{activeMethod.name}</span>
            </div>
            <span className="shrink-0 ml-2 inline-flex items-center gap-1 text-slate-500" style={{ fontWeight: 600 }}>
              <Clock className="w-3 h-3 text-slate-400" />
              {activeMethod.minDays === activeMethod.maxDays
                ? `${activeMethod.minDays} day${activeMethod.minDays !== 1 ? "s" : ""}`
                : `${activeMethod.minDays} to ${activeMethod.maxDays} days`}
            </span>
          </div>
        </div>
      </div>

      {/* Footer — only present for inherited carriers, where the
          user needs the Deactivate-at-this-location override. The
          Edit + Duplicate row was removed to match the canonical
          ShippingMethodCarrierCard from the partner creation form
          (no inline footer; whole-card click and a hover X cover
          edit/remove). Same alignment we applied to the pricing-
          rule applied cards. */}
      {inherited && onToggleDeactivate && (
        <div className="grid grid-cols-1 border-t border-muted shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleDeactivate(); }}
            className={`inline-flex items-center justify-center gap-1 py-2 text-[11px] transition-colors cursor-pointer ${
              isDeactivated
                ? "text-primary hover:bg-accent"
                : "text-destructive hover:bg-red-50"
            }`}
            style={{ fontWeight: 500 }}
            title={isDeactivated ? "Re-enable this inherited carrier at this location" : "Deactivate this inherited carrier at this location only"}
          >
            {isDeactivated ? (
              <><RotateCcw className="w-3 h-3" /> Re-Enable Here</>
            ) : (
              <><Ban className="w-3 h-3" /> Deactivate Here</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}



function ContentCard({ title, icon: Icon, count, children, action, headerExtras, currentSize, onSizeChange, onRemove, tooltip, isDragging, isOver }: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Inline node rendered immediately after the title (before the size
   *  toggle / action / remove cluster). Used for in-header tab strips
   *  on widgets like Order Activity where the direction switch should
   *  live alongside the title rather than inside the body. */
  headerExtras?: React.ReactNode;
  currentSize?: "sm" | "md" | "lg";
  onSizeChange?: (size: "sm" | "md" | "lg") => void;
  onRemove?: () => void;
  tooltip?: string;
  isDragging?: boolean;
  isOver?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 ${
        isOver && !isDragging
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(10,119,255,0.10)]"
          : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header — entire bar is the drag handle */}
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
          {tooltip && (
            <span className="pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                >
                  <p className="text-[11px] leading-relaxed">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          )}
          {count != null && (
            <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent" style={{ fontWeight: 600 }}>{count}</span>
          )}
        </div>
        {/* In-header extras (e.g. direction tab strip). Wrapped in a
            pointer-events-auto span so its buttons are interactive
            even though the surrounding bar is the drag handle. */}
        {headerExtras && (
          <span className="pointer-events-auto mr-auto ml-4 flex-1 min-w-0 flex items-center" onMouseDown={(e) => e.stopPropagation()}>
            {headerExtras}
          </span>
        )}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Size toggle — slides in from right on hover */}
          <div
            className={`flex items-center transition-all duration-200 ease-out pointer-events-auto ${
              hovered && onSizeChange ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
            }`}
          >
            {onSizeChange && currentSize && (
              <div className="flex items-center h-7 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5">
                {(["sm", "md", "lg"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onSizeChange(s); }}
                    className={`h-6 px-2.5 rounded-md text-[11px] cursor-pointer transition-all duration-150 ${
                      currentSize === s
                        ? "bg-white text-primary shadow-sm border border-border"
                        : "text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent"
                    }`}
                    style={{ fontWeight: currentSize === s ? 600 : 500 }}
                  >
                    {({ sm: "SM", md: "MD", lg: "LG" } as const)[s as "sm" | "md" | "lg"]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="pointer-events-auto">{action}</span>
          {/* Remove button — fades in on hover, inline in header flow */}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); toast.success(`Removed "${title}". Re-enable from Customize Widgets.`); }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`group/rm w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all duration-150 cursor-pointer hover:bg-red-100 hover:text-destructive ${
                hovered ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              title={`Remove ${title}`}
              aria-label={`Remove ${title} widget`}
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-150 group-hover/rm:scale-110" />
            </button>
          )}
        </div>
      </div>
      <div className={`flex-1 flex flex-col justify-between ${currentSize === "sm" ? "p-3" : currentSize === "lg" ? "p-5" : "p-4"}`}>{children}</div>
    </div>
  );
}

// ── Draggable Widget Wrapper with proper DnD ──
const WIDGET_DND_TYPE = "DASHBOARD_WIDGET";

function DraggableWidgetCard({ widgetKey, index, moveWidget, children }: {
  widgetKey: string;
  index: number;
  moveWidget: (from: number, to: number) => void;
  children: (isDragging: boolean, isOver: boolean) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: WIDGET_DND_TYPE,
    item: () => ({ key: widgetKey, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_DND_TYPE,
    drop(item: { key: string; index: number }) {
      if (item.index !== index) {
        moveWidget(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });
  preview(drop(ref));
  drag(ref);
  return (
    <div
      ref={ref}
      data-widget-idx={index}
      className={`h-full transition-all duration-300 ease-out rounded-xl ${isOver && !isDragging ? "ring-2 ring-primary/20 ring-offset-2 scale-[1.005]" : ""}`}
      style={{ opacity: isDragging ? 0.3 : 1, transform: isDragging ? "scale(0.97) rotate(-0.5deg)" : undefined }}
    >
      {children(isDragging, isOver)}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" style={{ animation: "csFade 0.4s ease-out both" }}>
      <div className="relative mb-3">
        <div
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-muted border border-border flex items-center justify-center shadow-sm"
          style={{ animation: "csFloat 4s ease-in-out infinite" }}
        >
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
      <p className="text-[13px] text-slate-700 mb-0.5" style={{ fontWeight: 600 }}>{title}</p>
      <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}

// ════════════════════════════════════════════��═
// CHART DATA
// ══════════════════════════════════════════════

const SPEND_TREND_DATA = [
  { month: "Jan", amount: 42000 },
  { month: "Feb", amount: 58000 },
  { month: "Mar", amount: 65000 },
  { month: "Apr", amount: 72000 },
  { month: "May", amount: 68000 },
  { month: "Jun", amount: 89000 },
  { month: "Jul", amount: 95000 },
  { month: "Aug", amount: 102000 },
  { month: "Sep", amount: 88000 },
  { month: "Oct", amount: 110000 },
  { month: "Nov", amount: 118000 },
  { month: "Dec", amount: 125000 },
];

const ORDER_ACTIVITY_DATA = [
  { day: "Mon", orders: 4, returns: 1 },
  { day: "Tue", orders: 7, returns: 2 },
  { day: "Wed", orders: 5, returns: 0 },
  { day: "Thu", orders: 8, returns: 1 },
  { day: "Fri", orders: 6, returns: 3 },
  { day: "Sat", orders: 3, returns: 0 },
  { day: "Sun", orders: 2, returns: 1 },
];

// Per-direction order activity for the Order Activity widget tabs.
// "po" = purchase orders we issued; "so" = sales orders we shipped.
// Kept separate so the tab swap surfaces different patterns rather
// than rendering the same bars twice.
const ORDER_ACTIVITY_DATA_PO = [
  { day: "Mon", orders: 4, returns: 1 },
  { day: "Tue", orders: 7, returns: 2 },
  { day: "Wed", orders: 5, returns: 0 },
  { day: "Thu", orders: 8, returns: 1 },
  { day: "Fri", orders: 6, returns: 3 },
  { day: "Sat", orders: 3, returns: 0 },
  { day: "Sun", orders: 2, returns: 1 },
];
const ORDER_ACTIVITY_DATA_SO = [
  { day: "Mon", orders: 3, returns: 0 },
  { day: "Tue", orders: 5, returns: 1 },
  { day: "Wed", orders: 4, returns: 1 },
  { day: "Thu", orders: 6, returns: 2 },
  { day: "Fri", orders: 8, returns: 1 },
  { day: "Sat", orders: 2, returns: 0 },
  { day: "Sun", orders: 1, returns: 0 },
];

const PIE_COLORS = ["rgb(var(--primary))", "rgb(var(--violet))", "rgb(var(--success))", "#94A3B8"];

// ═════════════════════���════════════════════════
// TAB CONTENT COMPONENTS
// ═══════════════════════���══════════════════════

// ----- PLACEHOLDER TAB -----
function PlaceholderTab({ label, description, icon: Icon }: { label: string; description: string; icon?: React.ElementType }) {
  const DisplayIcon = Icon || FileText;
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: "3s" }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: "csFloat 4s ease-in-out infinite" }}
          >
            <DisplayIcon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.1s" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: "csFade 0.5s ease-out both", animationDelay: "0.2s" }}
        >
          {label}
        </h3>
        <p
          className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.3s" }}
        >
          {description}
        </p>
      </div>
      <style>{`
        @keyframes csFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes csFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ----- Dashboard KPI DnD type -----
const DND_DASH_KPI = "DASH_KPI_CARD";

// ----- Dashboard KPI definitions (vendor-level) -----
interface DashKpiDef {
  key: string;
  label: string;
  category: string;
  iconName: string;
  subtitle: string;
  tooltip?: string;
}

const DASH_KPI_DEFS: DashKpiDef[] = [
  // Financial — orders split by trade direction per BA pass (no
  // aggregate "Total Orders" roll-up anywhere in the module).
  { key: "purchase_orders", label: "Purchase Orders", category: "Financial", iconName: "ShoppingCart", subtitle: "POs to this partner" },
  { key: "sales_orders", label: "Sales Orders", category: "Financial", iconName: "Package", subtitle: "SOs from this partner" },
  { key: "total_spent", label: "Total Spent", category: "Financial", iconName: "TrendingUp", subtitle: "Cumulative spend" },
  { key: "outstanding", label: "Outstanding", category: "Financial", iconName: "Package", subtitle: "Balance due" },
  { key: "avg_order_value", label: "Avg. Order Value", category: "Financial", iconName: "DollarSign", subtitle: "Per order average", tooltip: "Total spend divided by number of orders. Tracks purchasing efficiency and helps identify cost trends per transaction." },
  { key: "days_payable", label: "Days Payable", category: "Financial", iconName: "Calendar", subtitle: "Payment cycle length", tooltip: "Average number of days between invoice receipt and payment. Lower values indicate faster payment cycles and stronger vendor relationships." },
  { key: "net_margin", label: "Net Margin", category: "Financial", iconName: "Percent", subtitle: "Profit margin %", tooltip: "Net profit as a percentage of total revenue from this partner. Accounts for all costs including goods, logistics, and overhead." },
  { key: "credit_limit", label: "Credit Limit", category: "Financial", iconName: "CreditCard", subtitle: "Total credit line" },
  // Operational
  { key: "last_order_date", label: "Last Order Date", category: "Operational", iconName: "Calendar", subtitle: "Most recent order" },
  { key: "payment_status", label: "Payment Status", category: "Operational", iconName: "CheckCircle2", subtitle: "Current payment state" },
  { key: "credit_utilization", label: "Credit Utilization", category: "Operational", iconName: "Shield", subtitle: "Used vs limit", tooltip: "Percentage of credit limit currently in use. Above 80% is flagged as high risk. Monitored in real-time against the enforcement policy." },
  { key: "on_time_rate", label: "On-Time Delivery", category: "Operational", iconName: "Truck", subtitle: "Delivery performance", tooltip: "Percentage of orders delivered on or before the promised date. Calculated over the last 12 months of completed orders." },
  { key: "total_locations", label: "Total Locations", category: "Operational", iconName: "MapPin", subtitle: "Partner locations" },
  { key: "return_rate", label: "Return Rate", category: "Operational", iconName: "RotateCcw", subtitle: "Returns percentage", tooltip: "Percentage of delivered items returned due to defects, damage, or mismatch. Lower is better; industry benchmark is under 3%." },
  // Per-direction Top Item KPIs — separate cards on the Dashboard
  // strip (Purchased + Sold rendered side-by-side, not merged into
  // a tabbed card). Each surfaces the highest-volume SKU on that
  // direction plus this partner's share of the total across all
  // partners (concentration metric), not a within-partner basket
  // share.
  // NOTE on key/label mismatch: Eli asked for the visible "Top Item
  // Purchased" / "Top Item Sold" labels to swap because the previous
  // wording read inverted relative to his mental model — Purchased =
  // what we buy from this partner (the SKU they sell us most), Sold =
  // what we sell to them. The cards themselves were already right, so
  // this is a text-only fix: only label / subtitle / tooltip flipped,
  // the underlying `key` (and the mock SKU / image / share pinned to
  // each key in the valueNode renderer) stays where it is.
  { key: "top_item_purchased", label: "Top Item Sold",      category: "Financial", iconName: "Package",      subtitle: "Highest-volume SKU we sell to this partner",  tooltip: "The SKU we sell to this partner the most. The share pill is what % of our total sales of that SKU across all partners runs through this partner. High share = customer concentration." },
  { key: "top_item_sold",      label: "Top Item Purchased", category: "Financial", iconName: "ShoppingCart", subtitle: "Highest-volume SKU we buy from this partner", tooltip: "The SKU we buy from this partner the most. The share pill is what % of our total purchases of that SKU across all partners runs through this partner. High share = supplier concentration." },
];

const DEFAULT_DASH_KPIS = [
  "purchase_orders", "sales_orders", "total_spent", "outstanding", "avg_order_value", "days_payable",
  "last_order_date", "payment_status", "credit_utilization", "top_item_purchased", "top_item_sold",
];

/** The amount behind a money KPI (in the partner's currency), or null. */
function dashKpiAmount(key: string, vendor: Vendor): number | null {
  switch (key) {
    case "total_spent": return vendor.totalSpent;
    case "outstanding": return vendor.outstandingBalance;
    case "avg_order_value": return vendor.totalOrders > 0 ? vendor.totalSpent / vendor.totalOrders : 0;
    case "credit_limit": return vendor.creditLimit;
    default: return null;
  }
}

function computeDashKpiValue(
  key: string,
  vendor: Vendor,
  formatCurrency: (v: number) => string,
  formatDate: (d: string) => string,
): { value: string; change?: string; changeColor?: string } {
  const creditPct = vendor.creditLimit > 0
    ? Math.round((vendor.creditUtilization / vendor.creditLimit) * 100)
    : 0;
  switch (key) {
    case "purchase_orders": return { value: String(splitVendorOrders(vendor).po) };
    case "sales_orders": return { value: String(splitVendorOrders(vendor).so) };
    case "total_spent": return { value: formatCurrency(vendor.totalSpent) };
    case "outstanding": return { value: formatCurrency(vendor.outstandingBalance) };
    case "avg_order_value": return {
      value: formatCurrency(vendor.totalOrders > 0 ? vendor.totalSpent / vendor.totalOrders : 0),
      change: `↘ ${formatCurrency(240)}`, changeColor: "#EF4444",
    };
    case "days_payable": return { value: "23 Days" };
    case "net_margin": return { value: `${(vendor.netProfitMargin ?? 0).toFixed(2)}%` };
    case "credit_limit": return { value: formatCurrency(vendor.creditLimit) };
    case "last_order_date": return { value: formatDate(vendor.updatedAt) };
    case "payment_status": return { value: "—" };
    case "credit_utilization": return { value: `${creditPct}%`, change: "↗ 3.7%", changeColor: "rgb(var(--success))" };
    case "on_time_rate": return { value: "94.2%" };
    case "total_locations": return { value: String(vendor.partnerLocations?.length ?? 0) };
    case "return_rate": return { value: "2.1%" };
    default: return { value: "–" };
  }
}

function DashKpiIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const p = { className, style };
  switch (name) {
    case "ShoppingCart": return <ShoppingCart {...p} />;
    case "TrendingUp": return <TrendingUp {...p} />;
    case "Package": return <Package {...p} />;
    case "DollarSign": return <DollarSign {...p} />;
    case "Calendar": return <Calendar {...p} />;
    case "Percent": return <Percent {...p} />;
    case "CreditCard": return <CreditCard {...p} />;
    case "CheckCircle2": return <CheckCircle2 {...p} />;
    case "Shield": return <Shield {...p} />;
    case "Truck": return <Truck {...p} />;
    case "Star": return <Star {...p} />;
    case "MapPin": return <MapPin {...p} />;
    case "RotateCcw": return <RotateCcw {...p} />;
    case "Users": return <Users {...p} />;
    case "Globe": return <Globe {...p} />;
    case "Wrench": return <Wrench {...p} />;
    default: return <ChartColumn {...p} />;
  }
}

// ----- Partner widget catalog: type + description + category for the customize drawer -----
type PartnerWidgetVisualType = "chart" | "list" | "gauge" | "contact" | "text" | "donut" | "bars" | "line";
interface PartnerWidgetDef {
  key: string;
  label: string;
  type: PartnerWidgetVisualType;
  description: string;
  category: "Performance" | "Financial" | "Operational" | "People & Docs";
}
const PARTNER_WIDGET_DEFS: PartnerWidgetDef[] = [
  // Direction-split widgets — mirror the Location Overview surface so
  // partner Dashboard and location Overview read as sibling boards.
  // PO uses primary blue; SO uses the same emerald (#059669) the
  // Location Overview emits. Per-widget period selector lives on the
  // ContentCard `action` slot at render time.
  { key: "po_spend_trend",    label: "Purchase Order Cost Trend",   type: "line",  description: "Money we pay this partner across POs (we → them), by month.", category: "Performance" },
  { key: "so_spend_trend",    label: "Sales Order Revenue Trend",   type: "line",  description: "Money this partner pays us across SOs (them → us), by month.", category: "Performance" },
  { key: "po_order_activity", label: "Purchase Order Activity",    type: "chart", description: "Daily count of POs we issued to this partner, with returns.",  category: "Performance" },
  { key: "so_order_activity", label: "Sale Order Activity",        type: "chart", description: "Daily count of SOs we shipped to this partner, with returns.", category: "Performance" },
  { key: "spend_by_category", label: "Spend by Category",      type: "donut",   description: "Donut breakdown of spend per category",        category: "Performance" },
  { key: "credit_health",     label: "Credit Health",          type: "gauge",   description: "Credit utilization vs available limit",        category: "Financial" },
  { key: "payment_history",   label: "Payment History",        type: "line",    description: "Recent payment volume sparkline",              category: "Financial" },
  { key: "invoice_aging",     label: "Invoice Aging",          type: "bars",    description: "Outstanding invoices grouped by age bucket",   category: "Financial" },
  { key: "delivery_perf",     label: "Delivery Performance",   type: "line",    description: "On-time delivery rate over time",              category: "Operational" },
  { key: "return_rate",       label: "Return Rate",            type: "bars",    description: "Returns volume by month",                      category: "Operational" },
  { key: "top_items",         label: "Top Items",              type: "bars",    description: "Highest-spend items stacked by tier",          category: "Operational" },
  // Recent Orders is split by direction to mirror the PO/SO Order
  // Activity pattern — a single Recent Orders chart hid the SO side of
  // the relationship. Keys stay parallel to the *_order_activity ones.
  { key: "po_recent_orders",  label: "PO Recent Orders",       type: "list",    description: "Five most recent purchase orders by status + amount.",  category: "Operational" },
  { key: "so_recent_orders",  label: "SO Recent Orders",       type: "list",    description: "Five most recent sales orders by status + amount.",     category: "Operational" },
  { key: "primary_contact",   label: "Primary Contact",        type: "contact", description: "Main point-of-contact card with activity",    category: "People & Docs" },
  { key: "compliance_docs",   label: "Compliance & Documents", type: "donut",   description: "Valid vs missing compliance documents",        category: "People & Docs" },
];
const PARTNER_WIDGET_CATEGORY_ORDER: PartnerWidgetDef["category"][] = ["Performance", "Financial", "Operational", "People & Docs"];

/** Visual preview for a partner widget. Light pastel tints (Tailwind 200/300
 *  family) give the drawer an airy feel; inactive cards desaturate to slate. */
function PartnerWidgetVisual({ type, isActive }: { type: PartnerWidgetVisualType; isActive: boolean }) {
  const C = {
    blue:    isActive ? "#7AB8FF" : "rgb(var(--border))",
    orange:  isActive ? "#FDBA74" : "rgb(var(--border))",
    purple:  isActive ? "#C4B5FD" : "rgb(var(--border))",
    green:   isActive ? "#86EFAC" : "rgb(var(--border))",
    red:     isActive ? "#FCA5A5" : "rgb(var(--border))",
    slate:   isActive ? "#CBD5E1" : "rgb(var(--border))",
    needle:  isActive ? "#64748B" : "#94A3B8",
    lineFg:  isActive ? "#7AB8FF" : "#CBD5E1",
  };
  if (type === "chart") {
    const data = [
      { h: 14, c: C.blue }, { h: 24, c: C.blue }, { h: 18, c: C.orange },
      { h: 28, c: C.blue }, { h: 16, c: C.orange }, { h: 22, c: C.blue },
    ];
    return (
      <div className="flex items-end gap-[3px] h-full w-full px-3 pb-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: d.h, backgroundColor: d.c }} />
        ))}
      </div>
    );
  }
  if (type === "list") {
    const dots = [C.blue, C.orange, C.green];
    return (
      <div className="flex flex-col gap-1.5 w-full px-3.5">
        {[82, 64, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dots[i] }} />
            <div className="h-1.5 rounded-sm" style={{ width: `${w}%`, backgroundColor: C.slate }} />
          </div>
        ))}
      </div>
    );
  }
  if (type === "donut") {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="16" stroke={C.orange} strokeWidth="6" strokeDasharray="30 100" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.purple} strokeWidth="6" strokeDasharray="25 100" strokeDashoffset="-30" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.green} strokeWidth="6" strokeDasharray="25 100" strokeDashoffset="-55" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.blue} strokeWidth="6" strokeDasharray="20 100" strokeDashoffset="-80" transform="rotate(-90 22 22)" />
      </svg>
    );
  }
  if (type === "gauge") {
    return (
      <svg width="64" height="36" viewBox="0 0 64 36" fill="none">
        <path d="M6 30 A 26 26 0 0 1 22 8" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
        <path d="M22 8 A 26 26 0 0 1 42 8" stroke={C.orange} strokeWidth="5" strokeLinecap="round" />
        <path d="M42 8 A 26 26 0 0 1 58 30" stroke={C.green} strokeWidth="5" strokeLinecap="round" />
        <line x1="32" y1="30" x2="40" y2="14" stroke={C.needle} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="30" r="2" fill={C.needle} />
      </svg>
    );
  }
  if (type === "bars") {
    const rows = [
      [{ w: 50, c: C.orange }, { w: 25, c: C.green }, { w: 15, c: C.purple }],
      [{ w: 35, c: C.orange }, { w: 30, c: C.green }, { w: 20, c: C.purple }],
      [{ w: 45, c: C.orange }, { w: 20, c: C.green }, { w: 25, c: C.purple }],
    ];
    return (
      <div className="flex flex-col gap-1.5 w-full px-3">
        {rows.map((row, i) => (
          <div key={i} className="flex h-1.5 gap-px">
            {row.map((seg, j) => (
              <div key={j} className="rounded-sm" style={{ width: `${seg.w}%`, backgroundColor: seg.c }} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (type === "contact") {
    return (
      <div className="flex items-center gap-2 w-full px-3">
        <div className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: C.blue }} />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 rounded-sm" style={{ width: "70%", backgroundColor: C.slate }} />
          <div className="h-1.5 rounded-sm" style={{ width: "50%", backgroundColor: C.slate, opacity: 0.7 }} />
        </div>
      </div>
    );
  }
  if (type === "line") {
    return (
      <svg width="80%" height="34" viewBox="0 0 80 32" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g-line-partner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.lineFg} stopOpacity="0.45" />
            <stop offset="100%" stopColor={C.lineFg} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6 L 78 30 L 2 30 Z" fill="url(#g-line-partner)" />
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6" stroke={C.lineFg} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // text
  return (
    <div className="flex flex-col gap-1.5 w-full px-4">
      {[92, 78, 86, 60].map((w, i) => (
        <div key={i} className="h-1.5 rounded-sm" style={{ width: `${w}%`, backgroundColor: C.slate, opacity: i === 0 ? 1 : 0.65 }} />
      ))}
    </div>
  );
}

// ----- Dashboard Customize Widget Panel -----
function DashboardCustomizePanel({ open, onOpenChange, activeKpis, onToggleKpi, activeWidgets, onToggleWidget, widgetSizes, onWidgetSizeChange, vendor, formatCurrency, formatDate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  widgetSizes: Record<string, "sm" | "md" | "lg">;
  onWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
  vendor: Vendor;
  formatCurrency: (v: number) => string;
  formatDate: (d: string) => string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [panelTab, setPanelTab] = useState<"kpis" | "widgets">("kpis");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const categories = useMemo(() => {
    const catMap = new Map<string, DashKpiDef[]>();
    for (const kpi of DASH_KPI_DEFS) {
      if (!searchQuery || kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) || kpi.category.toLowerCase().includes(searchQuery.toLowerCase())) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    return Array.from(catMap, ([name, kpis]) => ({ name, kpis }));
  }, [searchQuery]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgb(var(--accent))" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPI widgets.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all widgets */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKpis.length} of {DASH_KPI_DEFS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = DASH_KPI_DEFS.map(k => k.key);
                const allActive = allKeys.every(k => activeKpis.includes(k));
                if (allActive) {
                  activeKpis.forEach(k => onToggleKpi(k));
                } else {
                  allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                DASH_KPI_DEFS.every(k => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : activeKpis.length === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {DASH_KPI_DEFS.every(k => activeKpis.includes(k.key)) ? (
                <>
                  <ToggleRight className="w-4 h-4 text-primary" />
                  <span>All On</span>
                </>
              ) : activeKpis.length === 0 ? (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>All Off</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>Enable All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-0 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Tab bar — matches header tab style */}
        <div className="flex items-center gap-0 px-5 border-b border-muted shrink-0 mt-3">
          {(["kpis", "widgets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPanelTab(t)}
              className={`px-4 py-2.5 border-b-2 text-[13px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                panelTab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
              style={{ fontWeight: panelTab === t ? 600 : 400 }}
            >
              {t === "kpis" ? "KPIs" : "Widgets"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {panelTab === "kpis" ? (
            <>
              {categories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No metrics found</p>
                </div>
              )}
              {categories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    {cat.name === "Financial" ? <DollarSign className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.kpis.map((kpi) => {
                      const isActive = activeKpis.includes(kpi.key);
                      const computed = computeDashKpiValue(kpi.key, vendor, formatCurrency, formatDate);
                      return (
                        <button
                          key={kpi.key}
                          onClick={() => onToggleKpi(kpi.key)}
                          className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                              : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[11px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                            <div className="shrink-0">
                              {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                            </div>
                          </div>
                          <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>{computed.value}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* ── Widgets tab — pastel visual-card grid grouped by category ── */
            <div className="mt-2">
              {PARTNER_WIDGET_CATEGORY_ORDER.map((cat) => {
                const inCat = PARTNER_WIDGET_DEFS.filter((w) =>
                  w.category === cat &&
                  (!searchQuery || w.label.toLowerCase().includes(searchQuery.toLowerCase()) || w.description.toLowerCase().includes(searchQuery.toLowerCase()))
                );
                if (inCat.length === 0) return null;
                const CatIcon =
                  cat === "Performance"   ? ChartColumn :
                  cat === "Financial"     ? DollarSign :
                  cat === "Operational"   ? Activity :
                  cat === "People & Docs" ? FileText :
                  Sliders;
                return (
                  <div key={cat} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {inCat.map((w) => {
                        const isActive = activeWidgets.includes(w.key);
                        const sz = widgetSizes[w.key] || "md";
                        return (
                          <button
                            key={w.key}
                            type="button"
                            onClick={() => onToggleWidget(w.key)}
                            className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? "border-primary/30 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:shadow-sm"
                            }`}
                          >
                            <div className={`h-[68px] flex items-center justify-center transition-colors ${isActive ? "bg-[#F8FAFF]" : "bg-slate-50"}`}>
                              <PartnerWidgetVisual type={w.type} isActive={isActive} />
                            </div>
                            <div className="absolute top-1.5 right-1.5">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center group-hover:border-slate-300 transition-colors">
                                  <Plus className="w-3 h-3 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-2.5 border-t border-muted">
                              <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }} title={w.label}>{w.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={w.description}>{w.description}</p>
                              {isActive && (
                                <div className="mt-2 flex items-center h-6 rounded-md border border-border bg-slate-50 p-0.5 gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  {(["sm", "md", "lg"] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onWidgetSizeChange(w.key, s); }}
                                      className={`flex-1 h-5 rounded text-[10px] transition-all duration-150 cursor-pointer ${
                                        sz === s ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-700"
                                      }`}
                                      style={{ fontWeight: sz === s ? 600 : 500 }}
                                    >
                                      {({ sm: "SM", md: "MD", lg: "LG" } as const)[s as "sm" | "md" | "lg"]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ----- DASHBOARD TAB (was Overview) -----
function DashboardTab({ vendor, cfg, formatCurrency, formatDate, activeWidgets, widgetSizes, onWidgetSizeChange, onRemoveWidget, moveWidget, noDnd = false }: {
  vendor: Vendor;
  cfg?: VendorConfigData;
  formatCurrency: (val: number) => string;
  formatDate: (dateStr: string) => string;
  activeWidgets: string[];
  widgetSizes: Record<string, "sm" | "md" | "lg">;
  onWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
  onRemoveWidget: (key: string) => void;
  moveWidget: (from: number, to: number) => void;
  /** When true, skip the inner DndProvider — used when DashboardTab renders inside an
   *  existing DnD context (e.g. the Partner Locations tab's location-modal Overview), since
   *  react-dnd's HTML5Backend can only have one instance active at a time. The drag hooks
   *  inside still work because they fall back to the outer provider's context. */
  noDnd?: boolean;
}) {
  const creditPct = getCreditUtilizationPct(vendor);
  const available = vendor.creditLimit - vendor.creditUtilization;
  // The partner's amounts in the profile's currency view (Base / Partner).
  const pm = useProfileMoney();
  const currencyInfo = usePartnerCurrencyInfo()(vendor);
  const spendCategories = [
    { name: "Services", value: Math.round(vendor.totalSpent * 0.4), pct: 40 },
    { name: "Materials", value: Math.round(vendor.totalSpent * 0.3), pct: 30 },
    { name: "Equipment", value: Math.round(vendor.totalSpent * 0.2), pct: 20 },
    { name: "Other", value: Math.round(vendor.totalSpent * 0.1), pct: 10 },
  ];

  const totalCashIn = Math.round(vendor.totalSpent * 0.45);
  const totalCashOut = Math.round(vendor.totalSpent * 0.52);
  const partnerGroupData = PARTNER_GROUPS.find((g) => g.id === vendor.partnerGroup);
  const paymentTermCfg = cfg?.paymentTermConfig;
  const customerPaymentTermCfg = cfg?.customerPaymentTermConfig;
  const [ptDetailOpen, setPtDetailOpen] = useState(false);
  const [ptDetailTerm, setPtDetailTerm] = useState<PaymentTermPreset | null>(null);
  // Which side of the Payment Terms accordion is being changed — opens the
  // same browse/apply picker as the partner-creation flow.
  const [ptPickerSide, setPtPickerSide] = useState<"vendor" | "customer" | null>(null);
  const { updateVendor: updateVendorTerms } = useVendors();

  // Turn a SavedPaymentTermConfig into a displayable preset (prefer the real
  // preset so the card shows the canonical in-use count and badge).
  const presetFromSavedTermCfg = (saved: SavedPaymentTermConfig, fallbackId: string): PaymentTermPreset =>
    PAYMENT_TERM_PRESETS.find((p) => p.id === saved.id) ||
    PAYMENT_TERM_PRESETS.find((p) => p.name === saved.name) || {
      id: fallbackId,
      name: saved.name,
      category: (saved.type === "prepayment" ? "prepayment" : saved.type === "split" ? "split" : "net") as "net" | "prepayment" | "split",
      typeBadge: saved.type === "prepayment" ? "Pre" : saved.type === "split" ? "Split" : "Net",
      badgeColor: saved.type === "prepayment" ? "rgb(var(--violet))" : saved.type === "split" ? "rgb(var(--warning))" : "rgb(var(--primary))",
      trigger: ({ shipping: "Shipping", delivery: "Delivery", production_start: "Production Start", production_end: "Production End", order_confirmation: "Order Confirmation", invoice_date: "Invoice Date" } as Record<string, string>)[saved.trigger] ?? saved.trigger,
      description: saved.description,
      vendorsApplied: 4,
      duration: saved.duration,
      discountPercent: saved.discountPercent,
      discountPeriod: saved.discountPeriod,
    };

  // Vendor side — driven by cfg.paymentTermConfig if set, otherwise vendor.paymentTerms.
  const dashVendorTerm: PaymentTermPreset = paymentTermCfg
    ? presetFromSavedTermCfg(paymentTermCfg, "pt-cfg-v")
    : (PAYMENT_TERM_PRESETS.find((p) => p.name === PAYMENT_TERMS_LABELS[vendor.paymentTerms]) || {
        id: "pt-default-v",
        name: PAYMENT_TERMS_LABELS[vendor.paymentTerms],
        category: "net" as const,
        typeBadge: "Net",
        badgeColor: "rgb(var(--primary))",
        trigger: "Shipping",
        description: "Standard payment terms for vendor bills.",
        vendorsApplied: 3,
      });
  // Customer side — cfg.customerPaymentTermConfig if set, else a sensible
  // default preset (Net 30) so the surface always shows both pillars.
  const dashCustomerTerm: PaymentTermPreset = customerPaymentTermCfg
    ? presetFromSavedTermCfg(customerPaymentTermCfg, "pt-cfg-c")
    : (PAYMENT_TERM_PRESETS.find((p) => p.name === "Net 30") || {
        id: "pt-default-c",
        name: "Net 30",
        category: "net" as const,
        typeBadge: "Net",
        badgeColor: "rgb(var(--primary))",
        trigger: "Invoice Date",
        description: "Standard payment terms for customer invoices.",
        vendorsApplied: 8,
        duration: "30",
      });

  const applyPickedPaymentTerm = (t: PaymentTermPreset) => {
    if (!ptPickerSide) return;
    const saved: SavedPaymentTermConfig = {
      id: t.id,
      name: t.name,
      type: t.category,
      trigger: t.trigger,
      description: t.description,
      duration: t.duration,
      discountPercent: t.discountPercent,
      discountPeriod: t.discountPeriod,
    };
    const updates: Partial<Vendor> = {
      configData: {
        ...cfg,
        [ptPickerSide === "vendor" ? "paymentTermConfig" : "customerPaymentTermConfig"]: saved,
      },
    };
    // Keep the flat enum in sync for vendor-side NET terms so list grids and
    // usage counts (paymentTermUsage) stay consistent with the new pick.
    if (ptPickerSide === "vendor" && t.category === "net" && t.duration && ["15", "30", "45", "60", "90"].includes(t.duration)) {
      updates.paymentTerms = `net_${t.duration}` as PaymentTerms;
    }
    updateVendorTerms(vendor.id, updates);
  };
  const creditStatusLabel = creditPct > 80 ? "Critical" : creditPct > 50 ? "Warning" : "Healthy";
  const creditStatusColor = creditPct > 80 ? "rgb(var(--destructive))" : creditPct > 50 ? "rgb(var(--warning))" : "rgb(var(--success))";
  const creditBarColor = creditPct > 80 ? "#FEE2E2" : creditPct > 50 ? "#FEF3C7" : "#D1FAE5";

  return (
    <>
    <div className="flex gap-5 items-start">

      {/* ═══ LEFT COLUMN — Charts & Widgets (dynamic from activeWidgets) ═══ */}
      <div className="flex-1 min-w-0">
      {(() => {
        const widgetGrid = (
      <div className="flex flex-wrap gap-3 items-stretch min-w-0">
        {(() => {
          // Default spans per widget — overridden by size:
          // Small → always "half" (2 per row), Medium → default, Large → always "full"
          const DEFAULT_SPANS: Record<string, "full" | "half"> = {
            // Direction-split chart widgets default to half-width so PO
            // and SO can sit side-by-side on the same row (matches the
            // Location Overview layout). Bump to full via the Large
            // size toggle if the user wants a wider canvas.
            po_spend_trend: "half", so_spend_trend: "half",
            po_order_activity: "half", so_order_activity: "half",
            spend_by_category: "half", credit_health: "half",
            delivery_perf: "half", invoice_aging: "half",
            primary_contact: "half", return_rate: "half",
            top_items: "half", po_recent_orders: "half", so_recent_orders: "half",
            payment_history: "half", compliance_docs: "half",
          };

          type WidgetNode = { key: string; idx: number; span: "full" | "half"; width: string; node: React.ReactNode };
          const nodes: WidgetNode[] = [];

          // Standardized chart heights per size — same for EVERY widget
          // sm: compact 2-per-row cards, md: standard, lg: full-width expanded
          const CH: Record<string, number> = { sm: 140, md: 200, lg: 280 };

          activeWidgets.forEach((wKey, wIdx) => {
            const sz = widgetSizes[wKey] || "md";
            const sizeProps = { currentSize: sz as "sm" | "md" | "lg", onSizeChange: (s: "sm" | "md" | "lg") => onWidgetSizeChange(wKey, s) };

            let content: React.ReactNode = null;
            let icon: React.ElementType = Info;
            let title = "";
            let tip = "";
            // Optional inline node rendered inside the widget header
            // (next to the title) — used by widgets that surface a
            // direction tab strip in the header rather than the body
            // (e.g. Order Activity: Purchase Orders / Sales Orders).
            let headerExtras: React.ReactNode = null;
            

            // ── Shared chart rendering helper ──
            const chartBox = (h: number, chart: React.ReactNode) => (
              <div style={{ height: h }} className="-ml-2"><ResponsiveContainer width="100%" height="100%">{chart as any}</ResponsiveContainer></div>
            );
            const statRow = (stats: { label: string; value: React.ReactNode; color?: string }[], compact?: boolean, trailing?: React.ReactNode) => (
              <div className={`flex items-end justify-between gap-4 ${compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2"} border-t border-muted`}>
                <div className={`flex items-center ${compact ? "gap-3" : "gap-4"} flex-wrap min-w-0`}>
                  {stats.map((s, i) => (<div key={i}><p className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>{s.label}</p><p className={compact ? "text-[11px]" : "text-[13px]"} style={{ fontWeight: 700, color: s.color || "#334155" }}>{s.value}</p></div>))}
                </div>
                {trailing && <div className="shrink-0 pb-px">{trailing}</div>}
              </div>
            );
            const ttStyle = { borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 };

            // Direction-split Spend Trend + Order Activity — visuals,
            // colors and copies are forked from the Location Overview
            // implementation so the partner Dashboard reads as a
            // sibling board. PO uses primary blue; SO uses the same
            // emerald (#059669) Location Overview emits.
            if (wKey === "po_spend_trend" || wKey === "so_spend_trend") {
              const isSo = wKey === "so_spend_trend";
              const baseSeries = SPEND_TREND_DATA;
              const data = isSo
                ? baseSeries.map((d) => ({ month: d.month, amount: Math.round(d.amount * 0.62) }))
                : baseSeries;
              const stroke = isSo ? "#059669" : "rgb(var(--primary))";
              const gradId = isSo ? "dashSoSpendGrad" : "dashPoSpendGrad";
              const seriesLabel = isSo ? "SO Revenue" : "PO Spend";
              const footnote = isSo
                ? "Inflow from this partner (SOs we ship to them)"
                : "Outflow to this partner (POs we issue)";
              icon = TrendingUp;
              title = isSo ? "Sales Order Revenue Trend" : "Purchase Order Cost Trend";
              tip = isSo
                ? "Money this partner pays us, summed by month, across the sales orders we fulfill to them (them → us)."
                : "Money we pay this partner, summed by month, across the purchase orders we issue (we → them).";
              const totalYTD = data.reduce((s, d) => s + d.amount, 0);
              const avgMonthly = Math.round(totalYTD / Math.max(1, data.length));
              const peakMonth = data.reduce((a, b) => a.amount > b.amount ? a : b);
              const lowMonth = data.reduce((a, b) => a.amount < b.amount ? a : b);
              content = (
                <>
                  {chartBox(CH[sz], (
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity={0.15} /><stop offset="100%" stopColor={stroke} stopOpacity={0.01} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                      <ReTooltip contentStyle={ttStyle} formatter={(val: number) => [pm.moneyText(val), seriesLabel]} />
                      <Area type="monotone" dataKey="amount" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} />
                    </AreaChart>
                  ))}
                  {(() => {
                    const trailing = <span className="text-[11px] text-slate-400 text-right max-w-[200px]" style={{ fontWeight: 500 }}>{footnote}</span>;
                    if (sz === "sm") return statRow([
                      { label: "YTD", value: pm.money(totalYTD) },
                      { label: "Avg/Mo", value: pm.money(avgMonthly) },
                    ], true, trailing);
                    if (sz === "md") return statRow([
                      { label: "YTD Total", value: pm.money(totalYTD) },
                      { label: "Monthly Avg", value: pm.money(avgMonthly) },
                    ], false, trailing);
                    return statRow([
                      { label: "YTD Total", value: pm.money(totalYTD) },
                      { label: "Monthly Avg", value: pm.money(avgMonthly) },
                      { label: "Peak Month", value: <span>{peakMonth.month} · {pm.money(peakMonth.amount)}</span>, color: stroke },
                      { label: "Lowest", value: <span>{lowMonth.month} · {pm.money(lowMonth.amount)}</span>, color: "#94A3B8" },
                    ], false, trailing);
                  })()}
                </>
              );
            } else if (wKey === "po_order_activity" || wKey === "so_order_activity") {
              const isSo = wKey === "so_order_activity";
              const baseData = isSo ? ORDER_ACTIVITY_DATA_SO : ORDER_ACTIVITY_DATA_PO;
              const ordersColor = isSo ? "#059669" : "rgb(var(--primary))";
              const ordersLabel = isSo ? "SOs Shipped" : "POs Issued";
              const footnote = isSo
                ? "Outbound from us (SOs); returns flow back from this partner"
                : "Outbound to this partner (POs); returns flow back to us";
              icon = BarChart3;
              title = isSo ? "Sale Order Activity" : "Purchase Order Activity";
              tip = isSo
                ? "Sales orders we shipped to this partner this week, with items they returned back to us."
                : "Purchase orders we issued to this partner this week, with items they returned back to us.";
              const totalOrd = baseData.reduce((s, d) => s + d.orders, 0);
              const totalRet = baseData.reduce((s, d) => s + d.returns, 0);
              const retPct = totalOrd > 0 ? ((totalRet / totalOrd) * 100).toFixed(1) : "0";
              content = (
                <>
                  {chartBox(CH[sz], (
                    <BarChart data={baseData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <ReTooltip contentStyle={ttStyle} />
                      <Bar dataKey="orders" fill={ordersColor} radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name={ordersLabel} />
                      <Bar dataKey="returns" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name="Returns" />
                    </BarChart>
                  ))}
                  {(() => {
                    const legend = (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ordersColor }} /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{ordersLabel}</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Returns</span></div>
                      </div>
                    );
                    if (sz === "sm") return statRow([
                      { label: ordersLabel, value: `${totalOrd}` },
                      { label: "Returns", value: `${retPct}%`, color: "#F59E0B" },
                    ], true, legend);
                    if (sz === "md") return statRow([
                      { label: "This Week", value: `${totalOrd} ${isSo ? "SOs" : "POs"}` },
                      { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                    ], false, legend);
                    return statRow([
                      { label: "This Week", value: `${totalOrd} ${isSo ? "SOs" : "POs"}` },
                      { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                      { label: "Peak Day", value: "Thursday · 8", color: ordersColor },
                      { label: "Avg / Day", value: `${(totalOrd / 7).toFixed(1)}` },
                    ], false, legend);
                  })()}
                  <p className="text-[10px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>{footnote}</p>
                </>
              );
            } else if (wKey === "spend_by_category") {
            icon = PieChart; title = "Spend by Category"; tip = "Breakdown of total partner spend across procurement categories. Identifies which categories drive the most cost and helps with budget allocation and contract negotiations.";
            const pieSize = sz === "sm" ? 100 : sz === "lg" ? 160 : 130;
            const pieInner = sz === "sm" ? 30 : sz === "lg" ? 52 : 40;
            const pieOuter = sz === "sm" ? 46 : sz === "lg" ? 74 : 60;
            content = (
              <>
                <div className="flex items-center gap-4">
                  <div className="shrink-0 relative" style={{ width: pieSize, height: pieSize }}>
                    <RePieChart width={pieSize} height={pieSize}>
                      <Pie data={spendCategories} cx="50%" cy="50%" innerRadius={pieInner} outerRadius={pieOuter} paddingAngle={2} dataKey="value" stroke="none">
                        {spendCategories.map((_, i) => (<Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                      </Pie>
                    </RePieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] text-slate-700" style={{ fontWeight: 700 }}>{pm.money(vendor.totalSpent, { rolledUp: true })}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {spendCategories.map((cat, idx) => (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx] }} /><span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>{cat.name}</span></div>
                        <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{cat.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {sz === "sm" && statRow(spendCategories.slice(0, 2).map(c => ({ label: c.name, value: pm.money(c.value) })), true)}
                {sz === "md" && statRow(spendCategories.slice(0, 3).map(c => ({ label: c.name, value: pm.money(c.value) })))}
                {sz === "lg" && statRow(spendCategories.map(c => ({ label: c.name, value: pm.money(c.value) })))}
              </>
            );
          } else if (wKey === "credit_health") {
            icon = Shield; title = "Credit Health"; tip = "Shows how much of the approved credit line is currently in use. Utilization above 80% triggers risk alerts. Includes available balance, current usage, and total limit.";
            content = (
              <>
                <div className="flex items-center justify-between mb-2"><span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>Credit Utilization</span><span className="text-[13px] text-slate-700" style={{ fontWeight: 700 }}>{creditPct}%</span></div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(creditPct, 100)}%`, backgroundColor: creditPct > 80 ? "rgb(var(--destructive))" : creditPct > 50 ? "rgb(var(--warning))" : "rgb(var(--success))" }} /></div>
                <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{pm.axis(0)}</span><span className="text-[10px]" style={{ fontWeight: 500, color: creditStatusColor }}>{creditStatusLabel}</span><span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{formatCurrency(vendor.creditLimit)}</span></div>
                {sz === "sm" && statRow([
                  { label: "Available", value: pm.money(Math.max(available, 0)), color: "rgb(var(--success))" },
                  { label: "Limit", value: pm.money(vendor.creditLimit) },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Available", value: pm.money(Math.max(available, 0)), color: "rgb(var(--success))" },
                  { label: "Used", value: pm.money(vendor.creditUtilization) },
                  { label: "Limit", value: pm.money(vendor.creditLimit) },
                ])}
                {sz === "lg" && statRow([
                  { label: "Available", value: pm.money(Math.max(available, 0)), color: "rgb(var(--success))" },
                  { label: "Used", value: pm.money(vendor.creditUtilization) },
                  { label: "Limit", value: pm.money(vendor.creditLimit) },
                  { label: "Status", value: creditStatusLabel, color: creditStatusColor },
                ])}
              </>
            );
          } else if (wKey === "delivery_perf") {
            icon = TrendingUp; title = "Delivery Performance"; tip = "Tracks the percentage of orders delivered on or before the promised date. Monitors trends over 6 months to identify supply chain reliability improvements or deterioration.";
            content = (
              <>
                {chartBox(CH[sz], (
                  <AreaChart data={[{ month: "Oct", rate: 91 }, { month: "Nov", rate: 88 }, { month: "Dec", rate: 93 }, { month: "Jan", rate: 95 }, { month: "Feb", rate: 92 }, { month: "Mar", rate: 94 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--success))" stopOpacity={0.15} /><stop offset="100%" stopColor="rgb(var(--success))" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, "On-Time"]} />
                    <Area type="monotone" dataKey="rate" stroke="rgb(var(--success))" strokeWidth={2} fill="url(#delivGrad)" />
                  </AreaChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "On-Time", value: "94%", color: "rgb(var(--success))" },
                  { label: "Late", value: "6%", color: "rgb(var(--warning))" },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Current", value: "94%", color: "rgb(var(--success))" },
                  { label: "Average", value: "92.2%" },
                  { label: "Late", value: "6%", color: "rgb(var(--warning))" },
                ])}
                {sz === "lg" && statRow([
                  { label: "Current", value: "94%", color: "rgb(var(--success))" },
                  { label: "6-Mo Avg", value: "92.2%" },
                  { label: "Late Rate", value: "6%", color: "rgb(var(--warning))" },
                  { label: "Best Month", value: "Jan · 95%", color: "rgb(var(--success))" },
                ])}
              </>
            );
          } else if (wKey === "invoice_aging") {
            icon = Receipt; title = "Invoice Aging"; tip = "Groups outstanding invoices by how long they've been overdue: 0-30, 31-60, 61-90, and 90+ days. Higher amounts in older buckets indicate payment collection risk.";
            content = (
              <>
                {chartBox(CH[sz], (
                  <BarChart data={[
                    { range: "0-30d", amount: Math.round(vendor.outstandingBalance * 0.4) },
                    { range: "31-60d", amount: Math.round(vendor.outstandingBalance * 0.25) },
                    { range: "61-90d", amount: Math.round(vendor.outstandingBalance * 0.2) },
                    { range: "90d+", amount: Math.round(vendor.outstandingBalance * 0.15) },
                  ]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [pm.moneyText(v), "Amount"]} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 20 : 36}>
                      {[0, 1, 2, 3].map((i) => (<Cell key={i} fill={["rgb(var(--primary))", "#0A77FF", "rgb(var(--warning))", "rgb(var(--destructive))"][i]} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "Overdue", value: pm.money(Math.round(vendor.outstandingBalance * 0.35)), color: "rgb(var(--destructive))" },
                  { label: "Avg Days", value: "42", color: "rgb(var(--warning))" },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Total Overdue", value: pm.money(Math.round(vendor.outstandingBalance * 0.35)), color: "rgb(var(--destructive))" },
                  { label: "Invoices", value: "11" },
                  { label: "Avg Days", value: "42", color: "rgb(var(--warning))" },
                ])}
                {sz === "lg" && statRow([
                  { label: "Total Overdue", value: pm.money(Math.round(vendor.outstandingBalance * 0.35)), color: "rgb(var(--destructive))" },
                  { label: "Open Invoices", value: "11" },
                  { label: "Avg Days", value: "42", color: "rgb(var(--warning))" },
                  { label: "Oldest", value: "98 days", color: "rgb(var(--destructive))" },
                ])}
              </>
            );
          } else if (wKey === "primary_contact") {
            icon = Users; title = "Primary Contact"; tip = "Main point of contact for this partner. Includes contact details and average response time trend across recent weeks to measure communication reliability.";
            content = (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0"><span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{vendor.primaryContact.name.split(" ").map((n) => n[0]).join("")}</span></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.primaryContact.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{vendor.primaryContact.designation}</p>
                  </div>
                </div>
                {sz === "sm" && (
                  <>
                    <div className="mt-2 pt-1.5 border-t border-muted space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-700"><Mail className="w-3 h-3 text-slate-400" /><span className="truncate">{vendor.primaryContact.email || "—"}</span></div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-700"><Phone className="w-3 h-3 text-slate-400" />{vendor.primaryContact.phone || "—"}</div>
                    </div>
                    <div style={{ height: 60 }} className="-ml-2 mt-1.5">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[{ w: "W1", h: 4.2 }, { w: "W2", h: 3.8 }, { w: "W3", h: 2.5 }, { w: "W4", h: 3.1 }, { w: "W5", h: 1.8 }, { w: "W6", h: 2.2 }]} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                          <XAxis dataKey="w" tick={{ fontSize: 8, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                          <Line type="monotone" dataKey="h" stroke="rgb(var(--violet))" strokeWidth={1.5} dot={{ r: 1.5, fill: "rgb(var(--violet))" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
                {sz === "md" && (
                  <>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-muted">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-700"><Mail className="w-3 h-3 text-slate-400" />{vendor.primaryContact.email || "—"}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-700"><Phone className="w-3 h-3 text-slate-400" />{vendor.primaryContact.phone || "—"}</div>
                    </div>
                    <div style={{ height: 100 }} className="-ml-2 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[{ w: "W1", h: 4.2 }, { w: "W2", h: 3.8 }, { w: "W3", h: 2.5 }, { w: "W4", h: 3.1 }, { w: "W5", h: 1.8 }, { w: "W6", h: 2.2 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <XAxis dataKey="w" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                          <Line type="monotone" dataKey="h" stroke="rgb(var(--violet))" strokeWidth={2} dot={{ r: 2, fill: "rgb(var(--violet))" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
                {sz === "lg" && (
                  <>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-muted">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-700"><Mail className="w-3 h-3 text-slate-400" />{vendor.primaryContact.email || "—"}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-700"><Phone className="w-3 h-3 text-slate-400" />{vendor.primaryContact.phone || "—"}</div>
                    </div>
                    <div style={{ height: 160 }} className="-ml-2 mt-2">
                      <p className="text-[10px] text-slate-400 mb-1 ml-2" style={{ fontWeight: 500 }}>Response Time (Hours)</p>
                      <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={[{ w: "W1", h: 4.2 }, { w: "W2", h: 3.8 }, { w: "W3", h: 2.5 }, { w: "W4", h: 3.1 }, { w: "W5", h: 1.8 }, { w: "W6", h: 2.2 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                          <XAxis dataKey="w" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[0, 6]} />
                          <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}h`, "Avg"]} />
                          <Line type="monotone" dataKey="h" stroke="rgb(var(--violet))" strokeWidth={2} dot={{ r: 3, fill: "rgb(var(--violet))" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {statRow([{ label: "Avg Response", value: "2.9h", color: "rgb(var(--violet))" }, { label: "Best", value: "1.8h", color: "rgb(var(--success))" }, { label: "Worst", value: "4.2h", color: "rgb(var(--warning))" }])}
                  </>
                )}
              </>
            );
          } else if (wKey === "return_rate") {
            icon = BarChart3; title = "Return Rate"; tip = "Tracks product return percentage and defect rates over the last 6 months. A declining trend indicates improving quality. Rates above 5% may trigger vendor quality reviews.";
            content = (
              <>
                {chartBox(CH[sz], (
                  <LineChart data={[{ month: "Oct", rate: 3.2, defect: 1.8 }, { month: "Nov", rate: 2.8, defect: 1.5 }, { month: "Dec", rate: 2.1, defect: 1.2 }, { month: "Jan", rate: 2.5, defect: 1.4 }, { month: "Feb", rate: 1.9, defect: 0.9 }, { month: "Mar", rate: 2.1, defect: 1.1 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <ReTooltip contentStyle={ttStyle} />
                    <Line type="monotone" dataKey="rate" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} name="Return %" />
                    <Line type="monotone" dataKey="defect" stroke="rgb(var(--destructive))" strokeWidth={2} dot={{ r: 3, fill: "rgb(var(--destructive))" }} name="Defect %" strokeDasharray="5 5" />
                  </LineChart>
                ))}
                {sz === "sm" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "rgb(var(--destructive))" }], true)}
                {sz === "md" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "rgb(var(--destructive))" }])}
                {sz === "lg" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "rgb(var(--destructive))" }, { label: "6-Mo Trend", value: "↓ Improving", color: "rgb(var(--success))" }, { label: "Items Returned", value: "12" }])}
              </>
            );
          } else if (wKey === "top_items") {
            icon = Package; title = "Top Items by Spend"; tip = "Ranks the top 5 most purchased items by total spend amount. Useful for identifying key SKUs for volume discount negotiations and supply chain risk assessment.";
            const topItemsData = [
              { name: "Steel Alloy A", spend: Math.round(vendor.totalSpent * 0.18) },
              { name: "Precision Bearings", spend: Math.round(vendor.totalSpent * 0.14) },
              { name: "Hydraulic Pump", spend: Math.round(vendor.totalSpent * 0.11) },
              { name: "Carbon Fiber", spend: Math.round(vendor.totalSpent * 0.09) },
              { name: "Ind. Lubricant", spend: Math.round(vendor.totalSpent * 0.07) },
            ];
            content = (
              <>
                {chartBox(CH[sz], (
                  <BarChart layout="vertical" data={topItemsData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={90} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [pm.moneyText(v), "Spend"]} />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]} barSize={sz === "sm" ? 10 : 16}>
                      {topItemsData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([{ label: "#1", value: "Steel Alloy A" }, { label: "Top 5", value: pm.money(topItemsData.reduce((s, d) => s + d.spend, 0)) }], true)}
                {sz === "md" && statRow([{ label: "Top Item", value: "Steel Alloy A" }, { label: "Total (Top 5)", value: pm.money(topItemsData.reduce((s, d) => s + d.spend, 0)) }])}
                {sz === "lg" && statRow([{ label: "Top Item", value: "Steel Alloy A" }, { label: "Top 5 Total", value: pm.money(topItemsData.reduce((s, d) => s + d.spend, 0)) }, { label: "% of Spend", value: "59%" }, { label: "Unique SKUs", value: "5" }])}
              </>
            );
          } else if (wKey === "po_recent_orders" || wKey === "so_recent_orders") {
            // Split Recent Orders by direction — PO side (we → them) uses
            // the canonical primary/success/warning status palette; SO
            // side (them → us) substitutes the SO emerald accent for the
            // primary bar so the two cards read as siblings to the
            // PO/SO Order Activity pair.
            const isSo = wKey === "so_recent_orders";
            const prefix = isSo ? "SO" : "PO";
            const accent = isSo ? "#059669" : "rgb(var(--primary))";
            icon = ClipboardList;
            title = isSo ? "SO Recent Orders" : "PO Recent Orders";
            tip = isSo
              ? "Shows the 5 most recent sales orders shipped to this partner, color-coded by fulfillment status: green (delivered), emerald (in transit), amber (pending)."
              : "Shows the 5 most recent purchase orders issued to this partner, color-coded by fulfillment status: green (delivered), blue (in transit), amber (pending).";
            // Deterministic ids so PO and SO cards don't visually collide.
            const ids = isSo
              ? ["50180", "50255", "50312", "50390", "50451"]
              : ["28180", "28255", "28312", "28390", "28451"];
            const baseAmt = isSo ? vendor.totalSpent * 0.85 : vendor.totalSpent;
            const orderRows = ids.map((id, i) => ({
              ord: id,
              amount: Math.round(baseAmt * [0.04, 0.07, 0.05, 0.06, 0.08][i]),
            }));
            const totalValue = orderRows.reduce((s, r) => s + r.amount, 0);
            content = (
              <>
                {chartBox(CH[sz], (
                  <BarChart data={orderRows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                    <XAxis dataKey="ord" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${prefix}-${v}`} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [pm.moneyText(v), "Amount"]} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 16 : 24}>
                      {[0, 1, 2, 3, 4].map((i) => (<Cell key={i} fill={[1, 2, 4].includes(i) ? "rgb(var(--success))" : i === 3 ? accent : "rgb(var(--warning))"} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([{ label: "Delivered", value: "3", color: "rgb(var(--success))" }, { label: "Pending", value: "1", color: "rgb(var(--warning))" }], true)}
                {sz === "md" && statRow([{ label: "Delivered", value: "3", color: "rgb(var(--success))" }, { label: "In Transit", value: "1", color: accent }, { label: "Pending", value: "1", color: "rgb(var(--warning))" }])}
                {sz === "lg" && statRow([{ label: "Delivered", value: "3", color: "rgb(var(--success))" }, { label: "In Transit", value: "1", color: accent }, { label: "Pending", value: "1", color: "rgb(var(--warning))" }, { label: "Total Value", value: pm.money(totalValue) }])}
              </>
            );
          } else if (wKey === "payment_history") {
            icon = Banknote; title = "Payment History"; tip = "Displays monthly payment amounts (completed) vs pending payments over the last 6 months. The solid green area shows cleared payments, the dashed amber line shows outstanding amounts.";
            const paidTotal = Math.round(vendor.totalSpent * 0.32);
            const pendTotal = Math.round(vendor.totalSpent * 0.06);
            content = (
              <>
                {chartBox(CH[sz], (
                  <AreaChart data={[
                    { month: "Oct", paid: Math.round(vendor.totalSpent * 0.03), pending: Math.round(vendor.totalSpent * 0.01) },
                    { month: "Nov", paid: Math.round(vendor.totalSpent * 0.05), pending: Math.round(vendor.totalSpent * 0.008) },
                    { month: "Dec", paid: Math.round(vendor.totalSpent * 0.04), pending: Math.round(vendor.totalSpent * 0.015) },
                    { month: "Jan", paid: Math.round(vendor.totalSpent * 0.06), pending: Math.round(vendor.totalSpent * 0.005) },
                    { month: "Feb", paid: Math.round(vendor.totalSpent * 0.08), pending: Math.round(vendor.totalSpent * 0.012) },
                    { month: "Mar", paid: Math.round(vendor.totalSpent * 0.06), pending: Math.round(vendor.totalSpent * 0.01) },
                  ]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--success))" stopOpacity={0.12} /><stop offset="100%" stopColor="rgb(var(--success))" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [pm.moneyText(v), ""]} />
                    <Area type="monotone" dataKey="paid" stroke="rgb(var(--success))" strokeWidth={2} fill="url(#paidGrad)" name="Paid" />
                    <Area type="monotone" dataKey="pending" stroke="rgb(var(--warning))" strokeWidth={1.5} fill="none" strokeDasharray="4 4" name="Pending" />
                  </AreaChart>
                ))}
                {sz === "sm" && statRow([{ label: "Paid", value: pm.money(paidTotal), color: "rgb(var(--success))" }, { label: "Pending", value: pm.money(pendTotal), color: "rgb(var(--warning))" }], true)}
                {sz === "md" && statRow([{ label: "Total Paid", value: pm.money(paidTotal), color: "rgb(var(--success))" }, { label: "Pending", value: pm.money(pendTotal), color: "rgb(var(--warning))" }])}
                {sz === "lg" && statRow([{ label: "Total Paid", value: pm.money(paidTotal), color: "rgb(var(--success))" }, { label: "Pending", value: pm.money(pendTotal), color: "rgb(var(--warning))" }, { label: "Transactions", value: "24" }, { label: "Avg Payment", value: pm.money(Math.round(paidTotal / 24)) }])}
              </>
            );
          } else if (wKey === "compliance_docs") {
            icon = Shield; title = "Compliance & Documents"; tip = "Overall compliance score based on document validity. Tracks tax forms, insurance certificates, NDAs, and quality certifications. Documents expiring within 30 days are flagged as warnings.";
            content = (
              <>
                <div className="flex items-center gap-4">
                  <div className="shrink-0 relative" style={{ width: 90, height: 90 }}>
                    <RePieChart width={90} height={90}>
                      <Pie data={[{ value: 75 }, { value: 25 }]} cx="50%" cy="50%" innerRadius={28} outerRadius={40} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                        <Cell fill="rgb(var(--success))" /><Cell fill="rgb(var(--muted))" />
                      </Pie>
                    </RePieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[14px] text-success" style={{ fontWeight: 700 }}>75%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between"><span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>Valid Docs</span><span className="text-[11px] text-success" style={{ fontWeight: 600 }}>3/4</span></div>
                    <div className="flex items-center justify-between"><span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>Expiring Soon</span><span className="text-[11px] text-warning" style={{ fontWeight: 600 }}>1</span></div>
                    <div className="flex items-center justify-between"><span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>Expired</span><span className="text-[11px] text-destructive" style={{ fontWeight: 600 }}>0</span></div>
                  </div>
                </div>
                {sz !== "sm" && (
                  <div className="space-y-2 mt-3 border-t border-muted pt-2.5">
                    {[
                      { name: "W-9 Tax Form", status: "Valid", sc: "rgb(var(--success))", sb: "#ECFDF5" },
                      { name: "Certificate of Insurance", status: "Valid", sc: "rgb(var(--success))", sb: "#ECFDF5" },
                      { name: "NDA Agreement", status: "Active", sc: "rgb(var(--success))", sb: "#ECFDF5" },
                      { name: "Quality Cert (ISO)", status: "Expiring", sc: "rgb(var(--warning))", sb: "#FFFBEB" },
                    ].map((doc, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{doc.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ fontWeight: 500, color: doc.sc, backgroundColor: doc.sb }}>{doc.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          }
          // Notes & Activity widget removed per Eli — Notes lives on
          // its own top-level tab; partner-level recent-activity feed
          // is parked on the backlog.

          if (!content) return;

            // Small → always half, Large → always full, Medium → use default
            const span = sz === "sm" ? "half" : sz === "lg" ? "full" : (DEFAULT_SPANS[wKey] || "half");
            const widthVal = span === "full" ? "100%" : "calc(50% - 6px)";
            nodes.push({
              key: wKey,
              idx: wIdx,
              span,
              width: widthVal,
              node: (
                <DraggableWidgetCard key={wKey} widgetKey={wKey} index={wIdx} moveWidget={moveWidget}>
                  {(dragging, over) => (
                    <ContentCard title={title} icon={icon} headerExtras={headerExtras} {...sizeProps} tooltip={tip} isDragging={dragging} isOver={over} onRemove={() => onRemoveWidget(wKey)}>
                      {content}
                    </ContentCard>
                  )}
                </DraggableWidgetCard>
              ),
            });
          });

          return nodes.map((n) => (
            <div key={n.key} style={{ width: n.width }} className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] h-auto self-stretch">
              {n.node}
            </div>
          ));
        })()}
      </div>
        );
        return noDnd ? widgetGrid : <DndProvider backend={HTML5Backend}>{widgetGrid}</DndProvider>;
      })()}
      </div>

      {/* ═══ RIGHT COLUMN — Information Cards ═══
          Not sticky: the sidebar scrolls in normal flow with the widgets so one
          page scroll moves everything below the header together. */}
      <div className="w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4">

        {/* Partner Information */}
        <DashInfoCard title="Partner Information" icon={Building2}>
          {partnerGroupData && (
            <div className="mb-3">
              <DashInfoLabel>Partner Group</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
                {partnerGroupData.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{partnerGroupData.description}</p>
            </div>
          )}
          {!partnerGroupData && vendor.partnerGroup && (
            <div className="mb-3">
              <DashInfoLabel>Partner Group</DashInfoLabel>
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.partnerGroup}</p>
            </div>
          )}
          <div className="mb-3">
            <DashInfoLabel>Partner Type</DashInfoLabel>
            <div className="flex items-center gap-1.5 mt-1">
              {/* Match the header pill exactly — Truck/ShoppingCart icon · label · "· N"
                  sub-type counter · hover tooltip listing the sub-types. Same colors and
                  feel as the sticky header so the surfaces read identically. */}
              {vendor.partnerTypes.map((t) => {
                // Compute sub-types locally from the vendor prop so this card works inside
                // DashboardTab (the outer-page `vendorSubTypeLabels`/`customerSubTypeLabels`
                // are out of scope here).
                const subs = (t === "vendor" ? vendor.vendorSubTypes : vendor.customerSubTypes) || [];
                const Icon = t === "vendor" ? Truck : ShoppingCart;
                const badge = (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-[2px] text-[11px]"
                    style={{
                      fontWeight: 600,
                      cursor: subs.length > 0 ? "default" : undefined,
                      backgroundColor: t === "vendor" ? "#EBF3FF" : "#F5F3FF",
                      color: t === "vendor" ? "#0548A3" : "#5B21B6",
                      borderColor: t === "vendor" ? "#A8D2FF" : "#DDD6FE",
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {t === "vendor" ? "Vendor" : "Customer"}
                    {subs.length > 0 && (
                      <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>· {subs.length}</span>
                    )}
                  </span>
                );
                if (subs.length === 0) return <React.Fragment key={t}>{badge}</React.Fragment>;
                return (
                  <Tooltip key={t}>
                    <TooltipTrigger asChild>{badge}</TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="z-[300] max-w-[260px]">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>
                          {t === "vendor" ? "Vendor" : "Customer"} Profiles
                        </p>
                        {subs.map((st) => (
                          <div key={st} className="flex items-center gap-2 py-0.5">
                            <Settings2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{st}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          {/* Trimmed contact + locale fields per stakeholder feedback — Partner Code, Category,
              Tax ID, Services were dropped. Email / Website / Phone / Country stay. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel>Email</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.emailAddress || "—"}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Website</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.website || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel>Phone Number</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.primaryContact.phone || "—"}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Country</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}><FlagImage code={flagEmojiCode(vendor.countryFlag)} className="text-[13px]" /> {vendor.country}</p>
            </div>
          </div>
          {vendor.billingAddress.street && (
            <div className="mb-2.5">
              <DashInfoLabel>Address</DashInfoLabel>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${vendor.billingAddress.street}, ${vendor.billingAddress.city}${vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""} ${vendor.billingAddress.zipCode}, ${vendor.billingAddress.country}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-slate-700 hover:text-primary hover:underline transition-colors block"
                style={{ fontWeight: 500 }}
              >
                {vendor.billingAddress.street}, {vendor.billingAddress.city}
                {vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""}{" "}
                {vendor.billingAddress.zipCode}, {vendor.billingAddress.country}
              </a>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 pt-2.5 border-t border-muted">
            <div className="min-w-0">
              <DashInfoLabel>Created By</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5">
                {vendor.createdByContact?.photoUrl ? (
                  <img src={vendor.createdByContact.photoUrl} alt={vendor.createdByContact.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "#6366f1"), fontWeight: 600 }}>
                    {vendor.createdByContact?.initials || "?"}
                  </div>
                )}
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.createdByContact?.name || "—"}</span>
              </div>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Last Updated</DashInfoLabel>
              <p className="text-[12px] text-slate-700 mt-0.5 truncate" style={{ fontWeight: 500 }}>{formatDate(vendor.updatedAt)}</p>
            </div>
          </div>
        </DashInfoCard>

        {/* Financial Overview & Cash Flow — merged */}
        <DashInfoCard title="Financial Summary" icon={Wallet} tooltip="Financial overview including currency, cash flow, and outstanding obligations for this partner.">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
            <div className="min-w-0">
              {/* The partner's currency — the default on every transaction with it. */}
              <DashInfoLabel tooltip={currencyInfo.source === "partner"
                ? "Set on this partner. Every transaction with it defaults to this currency."
                : `Inherited from its partner group${currencyInfo.group?.name ? `, ${currencyInfo.group.name}` : ""}. Every transaction with it defaults to this currency.`}>Currency</DashInfoLabel>
              <p className="text-[12px] text-slate-700 flex items-center gap-1.5 min-w-0" style={{ fontWeight: 600 }}>
                <CurrencyFlag code={currencyInfo.code} />
                <span className="truncate">{getCurrency(currencyInfo.code)?.name ?? currencyInfo.code} ({getCurrency(currencyInfo.code)?.symbol ?? currencyInfo.code})</span>
              </p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Pay To</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Globe className="w-3 h-3 text-slate-500" />
                </div>
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.companyName}</span>
              </div>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Ship To</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
                {vendor.billingAddress.street || "—"}
              </p>
            </div>
          </div>
          <div className="border-t border-muted pt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-x-4">
              <div className="min-w-0">
                <DashInfoLabel tooltip="Total payments received from or on behalf of this partner.">Cash Inflow</DashInfoLabel>
                <p className="text-[15px] text-success" style={{ fontWeight: 700 }}>{pm.money(totalCashIn)}</p>
              </div>
              <div className="min-w-0">
                <DashInfoLabel tooltip="Total disbursements made to this partner.">Cash Outflow</DashInfoLabel>
                <p className="text-[15px] text-destructive" style={{ fontWeight: 700 }}>{pm.money(totalCashOut)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-px">
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding Payables</p>
              <DetailRichTooltip data={{
                title: "Outstanding Payables",
                description: "Total unpaid obligations to this partner.",
                breakdown: [
                  { label: "Pending Invoices", value: formatCurrency(Math.round(vendor.outstandingBalance * 0.55)) },
                  { label: "Overdue Payments", value: formatCurrency(Math.round(vendor.outstandingBalance * 0.30)) },
                  { label: "Scheduled Payments", value: formatCurrency(Math.round(vendor.outstandingBalance * 0.15)) },
                  { label: "Total Outstanding", value: formatCurrency(vendor.outstandingBalance), isResult: true },
                ],
                formula: "Outstanding = Pending + Overdue + Scheduled",
              }}>
                <span className="inline-flex shrink-0"><Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" /></span>
              </DetailRichTooltip>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[15px] text-slate-700" style={{ fontWeight: 700 }}>{pm.money(vendor.outstandingBalance)}</p>
              <button className="text-[11px] text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>Invoice Details</button>
            </div>
          </div>
        </DashInfoCard>

        {/* Credit Limits & Utilization */}
        <DashInfoCard title="Credit Limits" icon={CreditCard} tooltip="Credit exposure summary. Shows approved limit vs current utilization.">
          <div className="grid grid-cols-2 gap-x-4 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1 mb-px">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Credit Limit</p>
                <DetailRichTooltip data={{
                  title: "Credit Utilization",
                  description: "How much of the approved credit line is currently in use. Utilization above 80% is flagged as high risk and may trigger enforcement actions.",
                  breakdown: [
                    { label: "Approved Limit", value: formatCurrency(vendor.creditLimit) },
                    { label: "Currently Used", value: formatCurrency(vendor.creditUtilization) },
                    { label: "Available", value: formatCurrency(vendor.creditLimit - vendor.creditUtilization), isResult: true },
                  ],
                  formula: "Available = Credit Limit - Current Utilization",
                }}>
                  <span className="inline-flex shrink-0"><Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" /></span>
                </DetailRichTooltip>
              </div>
              <p className="text-[16px] text-slate-700 truncate" style={{ fontWeight: 700 }}>{pm.money(vendor.creditLimit)}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel tooltip="Amount of credit currently in use. Calculated as sum of open orders and pending invoices against the credit limit.">Utilization</DashInfoLabel>
              <p className="text-[16px] text-slate-700 truncate" style={{ fontWeight: 700 }}>{pm.money(vendor.creditUtilization)}</p>
            </div>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "rgb(var(--muted))" }}>
            <div className="h-full rounded-full transition-all flex items-center justify-start pl-2" style={{ width: `${Math.max(Math.min(creditPct, 100), 8)}%`, backgroundColor: creditBarColor }}>
              <span className="text-[9px] text-slate-700 whitespace-nowrap" style={{ fontWeight: 600 }}>{creditPct}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>0%</span>
            <span className="text-[10px]" style={{ fontWeight: 500, color: creditStatusColor }}>{creditStatusLabel}</span>
            <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>100%</span>
          </div>
        </DashInfoCard>

        {/* Payment Terms */}
        <DashInfoCard title="Payment Terms" icon={Receipt} tooltip="Active payment terms applied to this partner. Vendor terms apply to bills you receive; Customer terms apply to invoices you issue.">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Vendor</p>
                <button
                  onClick={() => setPtPickerSide("vendor")}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Pencil className="w-3 h-3" /> Change
                </button>
              </div>
              <PaymentTermCard
                term={dashVendorTerm}
                readOnly
                onClick={() => { setPtDetailTerm(dashVendorTerm); setPtDetailOpen(true); }}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Customer</p>
                <button
                  onClick={() => setPtPickerSide("customer")}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Pencil className="w-3 h-3" /> Change
                </button>
              </div>
              <PaymentTermCard
                term={dashCustomerTerm}
                readOnly
                onClick={() => { setPtDetailTerm(dashCustomerTerm); setPtDetailOpen(true); }}
              />
            </div>
          </div>
        </DashInfoCard>

        {/* Freight & Logistics — primary vendor/customer carriers, kept in sync with the
            Freight & Logistics tab's default carriers ("FedEx Freight" / "DHL Express")
            so the sidebar reads as real, consistent data across the two surfaces. */}
        <DashInfoCard title="Freight & Logistics" icon={Truck} tooltip="Preferred carriers and methods configured for this partner. Mirrors the Freight & Logistics tab, primary picks here update there." defaultOpen={false}>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 500 }}>Primary Vendor Carrier</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>FedEx Freight</p>
                  <p className="text-[10px] text-slate-500">FedEx Express (Air) · 1 to 2 days</p>
                </div>
                <PrimaryPill className="shrink-0" />
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 500 }}>Primary Customer Carrier</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-violet" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>DHL Express</p>
                  <p className="text-[10px] text-slate-500">DHL Express Worldwide · 2 to 4 days</p>
                </div>
                <PrimaryPill className="shrink-0" />
              </div>
            </div>
          </div>
        </DashInfoCard>

        {/* Partner Locations (compact) */}
        {vendor.partnerLocations.length > 0 && (
          <DashInfoCard title="Partner Locations" icon={MapPin} count={vendor.partnerLocations.length} defaultOpen={false}>
            <div className="space-y-1.5">
              {vendor.partnerLocations.slice(0, 6).map((loc, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50 border border-muted">
                  <div className="w-4 h-4 rounded bg-accent flex items-center justify-center shrink-0">
                    <Building2 className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{loc}</span>
                </div>
              ))}
              {vendor.partnerLocations.length > 6 && (
                <p className="text-[11px] text-primary text-center pt-1 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
                  +{vendor.partnerLocations.length - 6} more locations
                </p>
              )}
            </div>
          </DashInfoCard>
        )}

        {/* Point of Contacts (compact) */}
        {vendor.globalPointOfContacts.length > 0 && (
          <DashInfoCard title="Points of Contact" icon={Users} count={vendor.globalPointOfContacts.length} defaultOpen={false}>
            <div className="space-y-2">
              {vendor.globalPointOfContacts.slice(0, 5).map((contact, idx) => {
                const _at = getPocAvatarTint(contact.bgColor);
                return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] shrink-0" style={{ backgroundColor: _at.bg, color: _at.text, fontWeight: 700 }}>
                    {contact.initials}
                  </div>
                  <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{contact.name}</span>
                  {idx === 0 && (
                    <span className="text-[9px] text-primary px-1.5 py-0.5 rounded-md bg-accent ml-auto shrink-0" style={{ fontWeight: 600 }}>Primary</span>
                  )}
                </div>
                );
              })}
              {vendor.globalPointOfContacts.length > 5 && (
                <p className="text-[11px] text-primary text-center pt-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
                  +{vendor.globalPointOfContacts.length - 5} more contacts
                </p>
              )}
            </div>
          </DashInfoCard>
        )}
      </div>
    </div>

    {/* Payment Term Detail Modal */}
    <PaymentTermDetailModal
      term={ptDetailTerm}
      open={ptDetailOpen}
      onClose={() => { setPtDetailOpen(false); setPtDetailTerm(null); }}
      mode="view"
      onDisable={(t) => toast.success(`"${t.name}" disabled for this partner`)}
    />

    {/* Payment Terms picker — same browse/apply surface as partner creation */}
    <PaymentTermsPickerModal
      open={ptPickerSide !== null}
      onClose={() => setPtPickerSide(null)}
      selectedTermId={ptPickerSide === "customer" ? dashCustomerTerm.id : dashVendorTerm.id}
      onApply={(t) => {
        applyPickedPaymentTerm(t);
        toast.success(`"${t.name}" applied as ${ptPickerSide === "customer" ? "customer" : "vendor"} payment terms`);
        setPtPickerSide(null);
      }}
      title={ptPickerSide === "customer" ? "Customer Payment Terms" : "Vendor Payment Terms"}
      subtitle={ptPickerSide === "customer" ? "Terms applied to invoices you issue to this partner" : "Terms applied to bills you receive from this partner"}
    />
    </>
  );
}

/* ── Collapsible info card for dashboard right column ── */
// ── Rich KPI Tooltip for Details Page ──
interface DetailTooltipData {
  title: string;
  description: string;
  breakdown: { label: string; value: string; isResult?: boolean }[];
  formula: string;
}

function DetailRichTooltip({ data, children }: { data: DetailTooltipData; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="p-0 w-[300px] max-w-[90vw] z-[400] !bg-white !border-border !shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.04)]">
        <div className="p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Info className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[11px] text-slate-700 tracking-wide" style={{ fontWeight: 700 }}>{data.title}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-[1.6] mb-3">{data.description}</p>
          <div className="border-t border-muted mb-2.5" />
          <div className="space-y-1">
            {data.breakdown.map((row, i) => (
              <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] ${row.isResult ? "bg-green-50 border border-[#D1FAE5]" : ""}`}>
                <span className={row.isResult ? "text-slate-700" : "text-slate-500"} style={{ fontWeight: row.isResult ? 600 : 400 }}>{row.label}</span>
                <span className={row.isResult ? "text-green-600" : "text-slate-700"} style={{ fontWeight: row.isResult ? 700 : 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-muted my-2.5" />
          <div className="px-2.5 py-1.5 rounded-lg bg-[#F0F6FF] border border-blue-100">
            <code className="text-[10px] text-[#094D9F]" style={{ fontWeight: 500 }}>{data.formula}</code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function DashInfoCard({ title, icon: Icon, count, tooltip: cardTooltip, children, defaultOpen = true }: {
  title: string; icon?: React.ElementType; count?: number; tooltip?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
        style={{ borderBottom: isOpen ? "1px solid #F1F5F9" : "none" }}
        onClick={() => setIsOpen((v) => !v)}
      >
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-primary" />
          </div>
        )}
        <span className="text-[12px] text-slate-700 text-left" style={{ fontWeight: 600 }}>{title}</span>
        {cardTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[300]">
              {cardTooltip}
            </TooltipContent>
          </Tooltip>
        )}
        {count != null && (
          <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent" style={{ fontWeight: 600 }}>{count}</span>
        )}
        <ChevronDown
          className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + "px" : "1000px") : "0px",
          opacity: isOpen ? 1 : 0,
          transitionDelay: isOpen ? "0ms, 80ms" : "0ms, 0ms",
        }}
      >
        <div ref={contentRef} className="px-3.5 py-3">{children}</div>
      </div>
    </div>
  );
}

/* ── Small label for dashboard info fields ── */
function DashInfoLabel({ children, tooltip: labelTooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1 mb-px">
      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{children}</p>
      {labelTooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0"><Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" /></span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4} className="max-w-[240px] z-[300]">
            {labelTooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ── Location KPI Insights Drawer (matches KpiInsightsPanel exactly) ──
function LocKpiInsightsDrawer({ open, onOpenChange, activeKpis, onToggleKpi, allKpis, computeValue }: {
  open: boolean; onOpenChange: (open: boolean) => void; activeKpis: string[]; onToggleKpi: (key: string) => void;
  allKpis: { key: string; label: string; category: string; iconName: string; tooltip: string }[];
  computeValue: (key: string) => string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) { setMounted(true); if (timeoutRef.current) clearTimeout(timeoutRef.current); requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); }); }
    else { setVisible(false); timeoutRef.current = setTimeout(() => setMounted(false), 280); }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const categories = useMemo(() => {
    const catMap = new Map<string, typeof allKpis>();
    for (const kpi of allKpis) {
      if (searchQuery && !kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) && !kpi.category.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
      catMap.get(kpi.category)!.push(kpi);
    }
    return Array.from(catMap.entries()).map(([name, kpis]) => ({ name, kpis }));
  }, [searchQuery, allKpis]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out" style={{ backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: visible ? "auto" : "none" }} onClick={() => onOpenChange(false)} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgb(var(--accent))" }}>
                <ChartColumn className="w-5 h-5" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Add Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Customize your dashboard with relevant location metrics.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{activeKpis.length} of {allKpis.length} insights active</span>
            <button
              onClick={() => {
                const allKeys = allKpis.map(k => k.key);
                const allActive = allKeys.every(k => activeKpis.includes(k));
                if (allActive) { activeKpis.forEach(k => onToggleKpi(k)); } else { allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k)); }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allKpis.every(k => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : activeKpis.length === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allKpis.every(k => activeKpis.includes(k.key)) ? (<><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>) : activeKpis.length === 0 ? (<><ToggleLeft className="w-4 h-4" /><span>All Off</span></>) : (<><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>)}
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input placeholder="Search metrics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors" />
          </div>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {categories.length === 0 && (<div className="flex flex-col items-center py-12 text-muted-foreground"><Search className="w-5 h-5 mb-2 opacity-40" /><p className="text-xs text-muted-foreground/60">No metrics found</p></div>)}
          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computeValue(kpi.key);
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                          : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                        <div className="shrink-0">
                          {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                        </div>
                      </div>
                      <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>{value}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

function DraggableKpiCard({ index, kpiKey, label, value, valueNode, subtitle, iconName, tooltip, change, changeColor, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string;
  /** When provided, replaces the default `<p>{value}</p>` render with a custom
   *  node — used by KPIs whose value isn't a plain string (e.g. Top Item by
   *  Spend renders an avatar + part-number link + % pill). */
  valueNode?: React.ReactNode;
  subtitle?: string; iconName?: string; tooltip?: string;
  change?: string; changeColor?: string; moveCard: (from: number, to: number) => void; onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_DASH_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_DASH_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      // KPI cards live in a single horizontal row, so the swap is
      // driven purely by the cursor's X position relative to the
      // hovered card's midpoint. The previous AND-of-X-and-Y check
      // was too eager — it triggered as soon as the cursor entered
      // the wrong quadrant and caused the dragged card to snap back
      // before settling. Dragging right only commits the swap once
      // the cursor passes the right card's midpoint; dragging left
      // mirrors that.
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  /* Dragging ghost — dashed placeholder like overview page */
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
        {/* Drag handle — top-right pill (visual cue only, whole card is draggable) */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        {/* Label row: label + info + icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-[11px] z-[300]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {iconName && <DashKpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
        </div>
        {/* Value row with optional change indicator. valueNode wins over
            the default <p>{value}</p> when present so KPIs like Top Item
            by Spend can render a rich composite (avatar + part-number +
            percent pill) instead of a plain string. */}
        <div className="flex items-baseline gap-1.5">
          {change && (
            <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: changeColor || "rgb(var(--success))" }}>{change}</span>
          )}
          {valueNode ?? (
            <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
          )}
        </div>
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

function DetailRow({ label, value }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>{label}</p>
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{value}</p>
    </div>
  );
}

// ══════════════════════════════════════════════
// PARTNER LOCATIONS TAB
// ═══════════════════════════���══════════════════

interface PartnerLocationData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  contacts: number;
  items: number;
  serviceCenters: number;
  pocNames: { name: string; initials: string; bgColor: string; fgColor?: string; photo?: string }[];
  serviceCenterNames: string[];
  status: "active" | "inactive";
  /** Role(s) this location plays — vendor (we buy from this site), customer
   *  (we sell to this site), or both. Mirrors the partner-level partnerTypes
   *  split so the location grid can be filtered by scope. Eli's note: most
   *  real partners carry sites with mixed roles, so "both" is the common
   *  bucket; pure vendor / pure customer sites are the edge cases. */
  scope: ("vendor" | "customer")[];
  createdBy: { name: string; initials: string; bgColor: string; fgColor?: string; photo?: string };
  lastUpdated: string;
  phone: string;
  email: string;
  /** Optional — when missing, the location card falls back to a Google Maps preview pinned
   *  to the address. */
  image?: string;
}

const MOCK_STREETS = [
  "2972 Westheimer Rd.", "1456 Elm Street", "890 Oak Avenue", "3201 Pine Boulevard",
  "742 Maple Drive", "5100 Cedar Lane", "1823 Birch Court", "4567 Walnut Way",
  "678 Spruce Circle", "2345 Willow Place", "1901 Ash Terrace", "3450 Cherry Lane",
  "5678 Poplar Street", "1234 Juniper Road", "8901 Magnolia Ave.",
  "345 Redwood Drive", "6789 Sequoia Blvd.", "2109 Cypress Way", "4321 Sycamore St.",
  "7654 Hemlock Road", "1098 Dogwood Lane", "5432 Holly Circle", "8765 Ivy Court",
  "2198 Laurel Place", "6543 Olive Terrace", "3876 Palm Avenue", "9012 Rose Street",
  "1357 Sage Boulevard", "4680 Thyme Drive", "7913 Violet Way",
];

const COUNTRY_FLAGS: Record<string, string> = { "USA": "\u{1F1FA}\u{1F1F8}", "United States": "\u{1F1FA}\u{1F1F8}", "Canada": "\u{1F1E8}\u{1F1E6}", "United Kingdom": "\u{1F1EC}\u{1F1E7}", "Germany": "\u{1F1E9}\u{1F1EA}", "France": "\u{1F1EB}\u{1F1F7}", "Japan": "\u{1F1EF}\u{1F1F5}", "China": "\u{1F1E8}\u{1F1F3}", "India": "\u{1F1EE}\u{1F1F3}", "Australia": "\u{1F1E6}\u{1F1FA}", "Brazil": "\u{1F1E7}\u{1F1F7}", "Italy": "\u{1F1EE}\u{1F1F9}", "Spain": "\u{1F1EA}\u{1F1F8}", "Mexico": "\u{1F1F2}\u{1F1FD}", "South Korea": "\u{1F1F0}\u{1F1F7}", "Netherlands": "\u{1F1F3}\u{1F1F1}", "Sweden": "\u{1F1F8}\u{1F1EA}", "Switzerland": "\u{1F1E8}\u{1F1ED}", "Singapore": "\u{1F1F8}\u{1F1EC}", "UAE": "\u{1F1E6}\u{1F1EA}", "South Africa": "\u{1F1FF}\u{1F1E6}" };
function getCountryFlag(country: string): string { return COUNTRY_FLAGS[country] || "\u{1F30D}"; }

const CARRIER_LOGOS: Record<string, string> = { FedEx: fedexLogo, DHL: dhlLogo, UPS: upsLogo, TCS: tcsLogo, Aramex: aramexLogo, Maersk: maerskLogo };
function getCarrierLogo(name: string): string | undefined {
  for (const key of Object.keys(CARRIER_LOGOS)) { if (name.includes(key)) return CARRIER_LOGOS[key]; }
  return undefined;
}
function getCarrierInitials(name: string): string {
  if (name.includes("FedEx")) return "FE"; if (name.includes("DHL")) return "DHL"; if (name.includes("UPS")) return "UPS";
  if (name.includes("TCS")) return "TCS"; if (name.includes("Aramex")) return "AR"; if (name.includes("Maersk")) return "MK";
  if (name.includes("XPO")) return "XPO"; if (name.includes("Swift")) return "SW";
  return name.substring(0, 2).toUpperCase();
}

const MOCK_CITIES = [
  { city: "Santa Ana", state: "Illinois", zip: "85486", country: "United States" },
  { city: "Austin", state: "Texas", zip: "78701", country: "United States" },
  { city: "San Francisco", state: "California", zip: "94102", country: "United States" },
  { city: "Seattle", state: "Washington", zip: "98101", country: "United States" },
  { city: "Chicago", state: "Illinois", zip: "60601", country: "United States" },
  { city: "Miami", state: "Florida", zip: "33101", country: "United States" },
  { city: "Denver", state: "Colorado", zip: "80201", country: "United States" },
  { city: "Boston", state: "Massachusetts", zip: "02101", country: "United States" },
  { city: "Portland", state: "Oregon", zip: "97201", country: "United States" },
  { city: "Atlanta", state: "Georgia", zip: "30301", country: "United States" },
  { city: "London", state: "England", zip: "SW1A 1AA", country: "United Kingdom" },
  { city: "Berlin", state: "Brandenburg", zip: "10115", country: "Germany" },
  { city: "Tokyo", state: "Kanto", zip: "100-0001", country: "Japan" },
  { city: "Shanghai", state: "Shanghai", zip: "200000", country: "China" },
  { city: "Toronto", state: "Ontario", zip: "M5H 2N2", country: "Canada" },
  { city: "Mumbai", state: "Maharashtra", zip: "400001", country: "India" },
  { city: "São Paulo", state: "São Paulo", zip: "01000-000", country: "Brazil" },
  { city: "Sydney", state: "New South Wales", zip: "2000", country: "Australia" },
  { city: "Dubai", state: "Dubai", zip: "00000", country: "UAE" },
  { city: "Seoul", state: "Seoul", zip: "04524", country: "South Korea" },
  { city: "Mexico City", state: "CDMX", zip: "06600", country: "Mexico" },
  { city: "Paris", state: "Île-de-France", zip: "75001", country: "France" },
  { city: "Stockholm", state: "Stockholm", zip: "111 57", country: "Sweden" },
  { city: "Amsterdam", state: "North Holland", zip: "1012", country: "Netherlands" },
  { city: "Milan", state: "Lombardy", zip: "20121", country: "Italy" },
  { city: "Singapore", state: "Singapore", zip: "048583", country: "Singapore" },
  { city: "Zurich", state: "Zurich", zip: "8001", country: "Switzerland" },
  { city: "Bangkok", state: "Bangkok", zip: "10110", country: "Thailand" },
  { city: "Cairo", state: "Cairo", zip: "11511", country: "Egypt" },
  { city: "Lagos", state: "Lagos", zip: "100001", country: "Nigeria" },
  { city: "Johannesburg", state: "Gauteng", zip: "2000", country: "South Africa" },
  { city: "Vancouver", state: "British Columbia", zip: "V6C 1E1", country: "Canada" },
  { city: "Nairobi", state: "Nairobi", zip: "00100", country: "Kenya" },
  { city: "Oslo", state: "Oslo", zip: "0150", country: "Norway" },
  { city: "Helsinki", state: "Uusimaa", zip: "00100", country: "Finland" },
  { city: "Copenhagen", state: "Capital", zip: "1050", country: "Denmark" },
  { city: "Vienna", state: "Vienna", zip: "1010", country: "Austria" },
  { city: "Brussels", state: "Brussels", zip: "1000", country: "Belgium" },
  { city: "Lisbon", state: "Lisbon", zip: "1100-001", country: "Portugal" },
  { city: "Madrid", state: "Madrid", zip: "28001", country: "Spain" },
  { city: "Warsaw", state: "Masovia", zip: "00-001", country: "Poland" },
  { city: "Prague", state: "Prague", zip: "110 00", country: "Czech Republic" },
  { city: "Budapest", state: "Budapest", zip: "1011", country: "Hungary" },
  { city: "Bucharest", state: "Bucharest", zip: "010011", country: "Romania" },
];

const CREATOR_NAMES = [
  { name: "Ahtisham Ahmad", initials: "AA", bgColor: "rgb(var(--accent))", fgColor: "rgb(var(--primary))", photo: "/avatars/ahtisham-ahmad.jpg" },
  { name: "Sarah Mitchell", initials: "SM", bgColor: "#F0FDF4", fgColor: "#16A34A", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "James Wilson", initials: "JW", bgColor: "#FFF7ED", fgColor: "#EA580C", photo: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Maria Garcia", initials: "MG", bgColor: "#F5F3FF", fgColor: "rgb(var(--violet))", photo: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "David Chen", initials: "DC", bgColor: "#ECFEFF", fgColor: "#0891B2", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Emily Johnson", initials: "EJ", bgColor: "#FFF1F2", fgColor: "#E11D48", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Robert Taylor", initials: "RT", bgColor: "#F0FDFA", fgColor: "#0D9488", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Lisa Anderson", initials: "LA", bgColor: "#FEF9C3", fgColor: "#A16207", photo: "https://randomuser.me/api/portraits/women/17.jpg" },
];

// Seeded POC roster for generated locations. Names MUST match entries in
// CONTACT_DICTIONARY so the Linked Partners' Locations tab can resolve each
// location's POC back to its directory row — the partner-level POC tab uses
// that mapping to compute the Location POCs scope filter + the Locations
// column.
const POC_NAMES = [
  { name: "Issac Archer", initials: "IA", bgColor: "rgb(var(--accent))", fgColor: "rgb(var(--primary))", photo: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Braelyn Lowe", initials: "BL", bgColor: "#F5F3FF", fgColor: "rgb(var(--violet))", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "Leah Wilkins", initials: "LW", bgColor: "rgb(var(--accent))", fgColor: "rgb(var(--primary))", photo: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "Jamya House", initials: "JH", bgColor: "#F0FDF4", fgColor: "#16A34A", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Peyton Ellison", initials: "PE", bgColor: "#FEF9C3", fgColor: "#A16207", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Jimena Morrow", initials: "JM", bgColor: "#F5F3FF", fgColor: "rgb(var(--violet))", photo: "https://randomuser.me/api/portraits/women/17.jpg" },
  { name: "Jackson Mahoney", initials: "JM", bgColor: "rgb(var(--accent))", fgColor: "rgb(var(--primary))", photo: "https://randomuser.me/api/portraits/men/64.jpg" },
  { name: "Kelvin Levy", initials: "KL", bgColor: "#F0FDF4", fgColor: "#16A34A", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Jesse Donovan", initials: "JD", bgColor: "#FEF9C3", fgColor: "#A16207", photo: "https://randomuser.me/api/portraits/men/18.jpg" },
  { name: "Sonia Bean", initials: "SB", bgColor: "#F5F3FF", fgColor: "rgb(var(--violet))", photo: "https://randomuser.me/api/portraits/women/56.jpg" },
];

const SERVICE_CENTER_NAMES = [
  "Main Warehouse", "Distribution Hub", "Quality Lab", "Assembly Floor", "Shipping Dock",
  "Cold Storage", "R&D Center", "Packaging Unit", "Returns Processing", "Maintenance Bay",
  "Parts Storage", "Inspection Station", "Loading Bay", "Repair Center", "Testing Facility",
];

const LOCATION_IMAGES = [
  "https://images.unsplash.com/photo-1769778674824-e69f58d7c55d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3YXJlaG91c2UlMjBleHRlcmlvcnxlbnwxfHx8fDE3NzMyMzk4MjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1692133211836-52846376d66f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBvZmZpY2UlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzMxNDYxODN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1761396716215-9ccb2a7eda9d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwZGlzdHJpYnV0aW9uJTIwY2VudGVyfGVufDF8fHx8MTc3MzIzOTgyNHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1770824879981-212a14b628c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tZXJjaWFsJTIwYnVzaW5lc3MlMjBwYXJrfGVufDF8fHx8MTc3MzIzOTgyNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1758789667762-56175fe4601c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb2dpc3RpY3MlMjBmYWNpbGl0eSUyMGV4dGVyaW9yfGVufDF8fHx8MTc3MzIzOTgyNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1764757105617-e765423a3791?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBmYWN0b3J5JTIwYnVpbGRpbmd8ZW58MXx8fHwxNzczMjM5ODI2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1762285334577-b451d4b8e245?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBzdG9yZWZyb250JTIwZXh0ZXJpb3J8ZW58MXx8fHwxNzczMjM5ODI2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1600313401255-ab9a4dcaafc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBjb21wbGV4JTIwYWVyaWFsfGVufDF8fHx8MTc3MzIzOTgyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1731847999830-6f71b78d720e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9yYWdlJTIwZmFjaWxpdHklMjBidWlsZGluZ3xlbnwxfHx8fDE3NzMyMzk4Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1670107767801-e40f61540f5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW51ZmFjdHVyaW5nJTIwcGxhbnQlMjBleHRlcmlvcnxlbnwxfHx8fDE3NzMyMzk4Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
];

function generateLocationsFromVendor(vendor: Vendor): PartnerLocationData[] {
  // Determine which roles the partner itself plays — a customer-only
  // partner can't have a vendor location and vice versa. Default to
  // vendor when partnerTypes is missing so legacy seeds don't lose data.
  const partnerScope = (vendor.partnerTypes && vendor.partnerTypes.length > 0)
    ? vendor.partnerTypes
    : ["vendor"] as ("vendor" | "customer")[];
  const canVendor = partnerScope.includes("vendor");
  const canCustomer = partnerScope.includes("customer");

  return vendor.partnerLocations.map((locName, idx) => {
    const seed = locName.length + idx;
    const cityData = MOCK_CITIES[seed % MOCK_CITIES.length];
    const street = MOCK_STREETS[seed % MOCK_STREETS.length];
    const creator = CREATOR_NAMES[seed % CREATOR_NAMES.length];
    const daysAgo = ((seed * 17 + idx * 7) % 365) + 1;
    const updDate = new Date();
    updDate.setDate(updDate.getDate() - daysAgo);

    // Deterministic scope split for the location. When the partner can
    // play both roles, distribute as ~50% Both, ~25% Vendor-only,
    // ~25% Customer-only so the filter strip sees real distribution.
    // When the partner is single-role, every location takes that role.
    // EXCEPTION: the first location (idx 0) is always the primary HQ-
    // style site — it carries BOTH Vendor and Customer scopes whenever
    // the partner supports them, so every Locations tab opens with a
    // canonical "all sides" anchor card.
    let scope: ("vendor" | "customer")[];
    if (idx === 0) {
      if (canVendor && canCustomer) scope = ["vendor", "customer"];
      else if (canVendor) scope = ["vendor"];
      else scope = ["customer"];
    } else if (canVendor && canCustomer) {
      const bucket = (seed + idx * 3) % 4;
      if (bucket === 0) scope = ["vendor"];
      else if (bucket === 1) scope = ["customer"];
      else scope = ["vendor", "customer"];
    } else if (canVendor) {
      scope = ["vendor"];
    } else {
      scope = ["customer"];
    }

    return {
      id: `loc-${vendor.id}-${idx}`,
      name: `${vendor.companyName} Location ${100 + idx + 1}`,
      address: street,
      city: cityData.city,
      state: cityData.state,
      zipCode: cityData.zip,
      country: cityData.country,
      contacts: ((seed * 3 + idx * 5) % 25) + 2,
      items: ((seed * 7 + idx * 11) % 800) + 50,
      serviceCenters: ((seed * 2 + idx) % 12) + 1,
      pocNames: Array.from({ length: Math.min(((seed * 3 + idx * 5) % 25) + 2, 6) }, (_, i) => POC_NAMES[(seed + i + idx * 3) % POC_NAMES.length]),
      serviceCenterNames: Array.from({ length: Math.min(((seed * 2 + idx) % 12) + 1, 8) }, (_, i) => SERVICE_CENTER_NAMES[(seed + i + idx * 2) % SERVICE_CENTER_NAMES.length]),
      // First location (idx 0) is always Active — it's the partner's
      // primary site, never deactivated. Everything else rotates through
      // the deterministic 1-in-7 inactive cadence for filter realism.
      status: idx === 0 ? "active" as const : (idx % 7 === 0 ? "inactive" as const : "active" as const),
      scope,
      createdBy: creator,
      lastUpdated: updDate.toISOString(),
      phone: `+1 (${300 + (seed % 700)}) ${100 + (idx * 37 % 900)}-${1000 + (seed * 13 % 9000)}`,
      email: `${locName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@${vendor.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
      // Deterministically leave a handful of locations without images so the Google Maps
      // fallback gets exercised in real demo data. Skips ~25% of cards (idx 1, 5, 9, 13, ...).
      image: idx % 4 === 1 ? undefined : LOCATION_IMAGES[(seed + idx) % LOCATION_IMAGES.length],
    };
  });
}

function PartnerLocationsTab({ vendor, cfg, formatDate, formatCurrency, initialLocationIdx, onInitialLocationConsumed, dashActiveWidgets, dashWidgetSizes, onDashWidgetSizeChange, onDashRemoveWidget, moveDashWidget, onDashResetLayout, onDashOpenCustomize }: {
  vendor: Vendor;
  cfg?: VendorConfigData;
  formatDate: (dateStr: string) => string;
  /** Formatter used by the location detail modal Overview tab's dashboard-style widgets. */
  formatCurrency: (val: number) => string;
  /** When set, auto-open the detail modal for the matching location on mount (deep-link from QuickView). */
  initialLocationIdx?: number;
  /** Fired once the deep-link is consumed so the parent can clear the URL param. */
  onInitialLocationConsumed?: () => void;
  /** Dashboard widget state passed through so the location modal Overview tab can render
   *  `<DashboardTab>` with full drag/drop + size + remove + reset + customize parity. */
  dashActiveWidgets: string[];
  dashWidgetSizes: Record<string, "sm" | "md" | "lg">;
  onDashWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
  onDashRemoveWidget: (key: string) => void;
  moveDashWidget: (from: number, to: number) => void;
  onDashResetLayout: () => void;
  onDashOpenCustomize: () => void;
}) {
  // A location trades in its partner's currency (it is set on the partner),
  // shown in the profile's currency view.
  const pm = useProfileMoney();
  const currencyInfo = usePartnerCurrencyInfo()(vendor);
  const generatedLocations = useMemo(() => generateLocationsFromVendor(vendor), [vendor]);
  const [createdLocations, setCreatedLocations] = useState<PartnerLocationData[]>([]);
  /* Displayed location names of every OTHER partner — the Locations tab
   * shows generated names (e.g. "UPS Location 101"), not the raw
   * partnerLocations strings, so cross-partner uniqueness in the create
   * modal must compare against these generated names. */
  const { vendors: allVendorsForNames } = useVendors();
  const otherPartnersLocationNames = useMemo(
    () =>
      allVendorsForNames
        .filter((v) => v.id !== vendor.id)
        .flatMap((v) => generateLocationsFromVendor(v).map((l) => l.name)),
    [allVendorsForNames, vendor.id]
  );
  const [highlightedLocationId, setHighlightedLocationId] = useState<string | null>(null);

  /* Lifecycle overrides — kept on the parent so action-menu confirms
   * persist across renders. archivedLocationIds removes rows from the
   * active listing (they survive in memory and can be restored from
   * an archive view when the surface ships). locationStatusOverrides
   * patches the active/inactive flag per row without mutating the
   * generated source list. */
  const [archivedLocationIds, setArchivedLocationIds] = useState<Set<string>>(new Set());
  const [locationStatusOverrides, setLocationStatusOverrides] = useState<Record<string, "active" | "inactive">>({});
  /* Status-change confirmation modal target — null = closed. Mirrors
   * the partner-level Mark as Active / Mark as Inactive modal visual
   * (green / amber gradient wash, matching CTA color). */
  const [statusChangeLocation, setStatusChangeLocation] = useState<{ loc: PartnerLocationData; target: "active" | "inactive" } | null>(null);
  /* Archive confirmation modal target — null = closed. Lives here
   * (not on the parent) because PartnerLocationsTab is a sibling
   * function to VendorDetailsPage, so they don't share closure
   * scope; keeping the state co-located with the action menus that
   * trigger it avoids prop-drilling. */
  const [archiveLocationTarget, setArchiveLocationTarget] = useState<PartnerLocationData | null>(null);

  /* Active (non-archived) locations — the default view source. Status
   * overrides applied here so the row's status pill stays in sync with
   * any Mark as Active / Inactive the user has performed. */
  const locations = useMemo(() => {
    const merged = [...createdLocations, ...generatedLocations];
    return merged
      .filter((l) => !archivedLocationIds.has(l.id))
      .map((l) => (locationStatusOverrides[l.id] ? { ...l, status: locationStatusOverrides[l.id] } : l));
  }, [createdLocations, generatedLocations, archivedLocationIds, locationStatusOverrides]);
  /* Archived locations — surfaced only when the Archived pill is the
   * active filter. Kept as a separate memo so the count + filtered
   * slice both work off the same source without re-iterating the
   * full merged list on every render. */
  const archivedLocations = useMemo(() => {
    const merged = [...createdLocations, ...generatedLocations];
    return merged.filter((l) => archivedLocationIds.has(l.id));
  }, [createdLocations, generatedLocations, archivedLocationIds]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");
  // Scope filter — mirrors the Vendor / Customer / Both split on the partner
  // listing. Sits alongside the status pills so the user can pivot from
  // "all vendor sites" to "Active customer sites" in two clicks.
  const [scopeFilter, setScopeFilter] = useState<"all" | "vendor" | "customer" | "both">("all");
  const [selectedLocation, setSelectedLocation] = useState<PartnerLocationData | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [locDetailTab, setLocDetailTab] = useState("overview");
  const [locAboutOpen, setLocAboutOpen] = useState(true);
  const [locPocOpen, setLocPocOpen] = useState(true);
  const [locBillingOpen, setLocBillingOpen] = useState(true);
  const [locCreditOpen, setLocCreditOpen] = useState(false);
  const [locCarrierOpen, setLocCarrierOpen] = useState(false);
  const [locPtOpen, setLocPtOpen] = useState(false);
  const [createLocationModalOpen, setCreateLocationModalOpen] = useState(false);
  // When set, the CreatePartnerLocationModal renders in edit mode pre-filled with this data.
  const [locEditData, setLocEditData] = useState<{ locationName?: string; phone?: string; email?: string; address?: string; status?: "Active" | "Inactive"; description?: string; image?: string } | null>(null);

  // ── Location POC modals state ──
  const [locShowSelectModal, setLocShowSelectModal] = useState(false);
  const [locShowCreateModal, setLocShowCreateModal] = useState(false);
  const [locPocSearch, setLocPocSearch] = useState("");
  const [locPocCategoryFilter, setLocPocCategoryFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [locPocPage, setLocPocPage] = useState(1);
  const [locPocTempSelected, setLocPocTempSelected] = useState<Set<string>>(new Set());
  const [locNewPocName, setLocNewPocName] = useState("");
  const [locNewPocDepartment, setLocNewPocDepartment] = useState("Sales");
  const [locNewPocRole, setLocNewPocRole] = useState("");
  const [locNewPocLandline, setLocNewPocLandline] = useState("");
  const [locNewPocLandlineCode, setLocNewPocLandlineCode] = useState("+1");
  const [locNewPocExt, setLocNewPocExt] = useState("");
  const [locNewPocMobile, setLocNewPocMobile] = useState("");
  const [locNewPocMobileCode, setLocNewPocMobileCode] = useState("+1");
  const [locNewPocEmail, setLocNewPocEmail] = useState("");
  const [locSaveAndCreate, setLocSaveAndCreate] = useState(false);

  type LocDensity = "condensed" | "comfort" | "card";
  type LocCardSize = "large" | "medium" | "small";
  const LOC_DENSITY_CONFIG: { key: LocDensity; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
    { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
    { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
    { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
  ];
  const [density, setDensity] = useState<LocDensity>("card");
  const [locCardSize, setLocCardSize] = useState<LocCardSize>("medium");
  const [locPocDensity, setLocPocDensity] = useState<LocDensity>("card");
  const [locPocCardSize, setLocPocCardSize] = useState<LocCardSize>("medium");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  // ── Column infrastructure (matches VendorsListPage exactly) ──
  const LOC_COLUMNS: { key: string; label: string; minWidth: string; sortable?: boolean }[] = [
    { key: "location_name", label: "Location Name", minWidth: "320px", sortable: true },
    { key: "type", label: "Type", minWidth: "200px", sortable: true },
    { key: "address", label: "Address", minWidth: "300px" },
    { key: "city_state", label: "City / State", minWidth: "200px", sortable: true },
    { key: "poc", label: "Point of Contact", minWidth: "280px" },
    { key: "service_centers", label: "Service Centers", minWidth: "260px" },
    { key: "last_updated_by", label: "Last Updated By", minWidth: "240px" },
    { key: "last_updated_on", label: "Last Updated On", minWidth: "180px", sortable: true },
    { key: "created_by", label: "Created By", minWidth: "240px" },
    { key: "status", label: "Status", minWidth: "130px", sortable: true },
  ];
  const LOC_LOCKED_COLUMNS = ["location_name"];
  const LOC_CHECKBOX_W = 40;

  const [locColumnOrder, setLocColumnOrder] = useState<string[]>(LOC_COLUMNS.map(c => c.key));
  const [locColumnWidths, setLocColumnWidths] = useState<Record<string, number>>(() => Object.fromEntries(LOC_COLUMNS.map(c => [c.key, parseInt(c.minWidth, 10)])));
  const [locSortConfig, setLocSortConfig] = useState<SortConfig | null>(null);
  const [locDraggingColumnKey, setLocDraggingColumnKey] = useState<string | null>(null);
  const [locIsResizing, setLocIsResizing] = useState(false);
  const [locResizingColumnKey, setLocResizingColumnKey] = useState<string | null>(null);

  const locColDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const locSuppressClickRef = useRef(false);
  const locResizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);

  const locColDef = (key: string) => LOC_COLUMNS.find(c => c.key === key)!;
  const locVisibleColumns = useMemo(() => {
    const ordered = locColumnOrder.filter(k => LOC_COLUMNS.some(c => c.key === k));
    if (!ordered.includes("location_name")) ordered.unshift("location_name");
    else if (ordered[0] !== "location_name") { ordered.splice(ordered.indexOf("location_name"), 1); ordered.unshift("location_name"); }
    return ordered;
  }, [locColumnOrder]);
  const locTotalWidth = useMemo(() => LOC_CHECKBOX_W + locVisibleColumns.reduce((s, k) => s + (locColumnWidths[k] ?? parseInt(locColDef(k).minWidth, 10)), 0) + 60, [locVisibleColumns, locColumnWidths]);

  const handleLocSort = useCallback((key: string, direction?: "asc" | "desc" | null) => {
    if (direction !== undefined) {
      setLocSortConfig(direction === null ? null : { key, direction });
    } else {
      setLocSortConfig(prev => {
        if (prev?.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null;
        return { key, direction: "asc" };
      });
    }
  }, []);

  // ── Column drag reorder (mouse-event based — matches listing page) ──
  const handleLocHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOC_LOCKED_COLUMNS.includes(columnKey) || locIsResizing || e.button !== 0) return;
    const startX = e.clientX; const startY = e.clientY;
    locColDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };
    const THRESHOLD = 5; const SETTLE = 60;
    const onMove = (me: MouseEvent) => {
      if (!locColDragRef.current) return;
      const dx = me.clientX - locColDragRef.current.startX;
      const dy = me.clientY - locColDragRef.current.startY;
      if (!locColDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
        locColDragRef.current.isDragging = true;
        document.body.style.userSelect = "none"; document.body.style.cursor = "grabbing";
        setLocDraggingColumnKey(locColDragRef.current.columnKey);
      }
      const now = performance.now();
      if (now - locColDragRef.current.lastSwapTime < SETTLE) return;
      const cursorX = me.clientX; const draggedKey = locColDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-loc-col-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;
      const allThs = document.querySelectorAll<HTMLElement>("th[data-loc-col-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-loc-col-key");
        if (!k || k === draggedKey || LOC_LOCKED_COLUMNS.includes(k)) break;
        setLocColumnOrder(prev => { const next = [...prev]; const s = next.indexOf(draggedKey); const t = next.indexOf(k); if (s === -1 || t === -1 || s === t) return prev; next.splice(s, 1); next.splice(t, 0, draggedKey); return next; });
        locColDragRef.current.lastSwapTime = now; break;
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = ""; document.body.style.cursor = "";
      if (locColDragRef.current?.isDragging) { locSuppressClickRef.current = true; requestAnimationFrame(() => { locSuppressClickRef.current = false; }); }
      locColDragRef.current = null; setLocDraggingColumnKey(null);
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }, [locIsResizing]);

  // ── Column resize (matches listing page) ──
  const handleLocResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault(); e.stopPropagation();
    const startWidth = locColumnWidths[columnKey] ?? parseInt(locColDef(columnKey).minWidth, 10);
    locResizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setLocIsResizing(true); setLocResizingColumnKey(columnKey);
    const onMove = (me: MouseEvent) => {
      if (!locResizeRef.current) return;
      const delta = me.clientX - locResizeRef.current.startX;
      const newW = Math.max(1, locResizeRef.current.startWidth + delta);
      setLocColumnWidths(prev => ({ ...prev, [locResizeRef.current!.columnKey]: newW }));
    };
    const onUp = () => {
      locResizeRef.current = null; setLocIsResizing(false); setLocResizingColumnKey(null);
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
  }, [locColumnWidths]);

  // ── Carrier & Shipping tab state ──
  type CarrierSubTab = "vendor" | "customer";
  type CarrierFilter = "all" | "active" | "default" | "Air" | "Sea" | "Ground" | "Freight";
  const [carrierSubTab, setCarrierSubTab] = useState<CarrierSubTab>("vendor");
  // Per-side override for "primary" — when set, takes precedence over
  // the data's isDefault. Stakeholder bug: clicking "Set as primary"
  // on a saved carrier card was a no-op because there was no UI for
  // it; now the star is wired here.
  const [primaryCarrierOverride, setPrimaryCarrierOverride] = useState<Record<CarrierSubTab, string | null>>({ vendor: null, customer: null });
  // ── Pricing Rules sub-tab state (Vendor / Customer) ──
  const [locPricingSubTab, setLocPricingSubTab] = useState<"vendor" | "customer">("vendor");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<CarrierFilter>("all");
  // Inheritance overlay — Eli's April 21 feedback: location detail tabs
  // should default to *only* what's set at this location and let the user
  // opt-in to seeing partner-level inherited rows. When toggled on, an
  // inherited row can be deactivated at this location without touching
  // the partner-level record.
  const [showInheritedCarriers, setShowInheritedCarriers] = useState(false);
  const [deactivatedInheritedCarrierIds, setDeactivatedInheritedCarrierIds] = useState<Set<string>>(new Set());
  const [showInheritedPocs, setShowInheritedPocs] = useState(false);
  const [deactivatedInheritedPocIds, setDeactivatedInheritedPocIds] = useState<Set<string>>(new Set());
  const [showInheritedItems, setShowInheritedItems] = useState(false);
  const [deactivatedInheritedItemIds, setDeactivatedInheritedItemIds] = useState<Set<string>>(new Set());
  const [addCarrierModalOpen, setAddCarrierModalOpen] = useState(false);
  const [addCarrierSearch, setAddCarrierSearch] = useState("");
  const [addCarrierSelectedIds, setAddCarrierSelectedIds] = useState<Set<string>>(new Set());
  const [addCarrierPrimaryId, setAddCarrierPrimaryId] = useState<string | null>(null);
  const [addCarrierMethodIdx, setAddCarrierMethodIdx] = useState<Record<string, number>>({});
  const resetAddCarrierModal = () => {
    setAddCarrierSearch("");
    setAddCarrierSelectedIds(new Set());
    setAddCarrierPrimaryId(null);
    setAddCarrierMethodIdx({});
  };
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [locPtDetailOpen, setLocPtDetailOpen] = useState(false);
  const [locPtDetailTerm, setLocPtDetailTerm] = useState<PaymentTermPreset | null>(null);

  const filtered = useMemo(() => {
    // Archived pill swaps the source list entirely — surfaces archived
    // rows that the default view strips out. Scope filter still
    // applies so users can drill into "archived vendor sites" etc.
    let list = statusFilter === "archived" ? archivedLocations : locations;
    if (searchQuery.trim()) {
      // Name, the location's own email and its address (not type: that's the
      // Vendor / Customer chips; not a contact's email), matching the server search.
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.state.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "active" || statusFilter === "inactive") {
      list = list.filter((l) => l.status === statusFilter);
    }
    if (scopeFilter !== "all") {
      list = list.filter((l) => {
        const isVendor = l.scope.includes("vendor");
        const isCustomer = l.scope.includes("customer");
        if (scopeFilter === "vendor") return isVendor && !isCustomer;
        if (scopeFilter === "customer") return isCustomer && !isVendor;
        // "both" — dual-role sites only
        return isVendor && isCustomer;
      });
    }
    return list;
  }, [locations, archivedLocations, searchQuery, statusFilter, scopeFilter]);

  // Scope counts — computed against the unfiltered list so the pill counts
  // stay stable as the user shifts status / search.
  const scopeCounts = useMemo(() => {
    const counts = { vendor: 0, customer: 0, both: 0 };
    locations.forEach((l) => {
      const isVendor = l.scope.includes("vendor");
      const isCustomer = l.scope.includes("customer");
      if (isVendor && isCustomer) counts.both++;
      else if (isVendor) counts.vendor++;
      else if (isCustomer) counts.customer++;
    });
    return counts;
  }, [locations]);

  const activeCount = locations.filter((l) => l.status === "active").length;
  const inactiveCount = locations.filter((l) => l.status === "inactive").length;

  // "All" is represented by recordsPerPage === -1.
  const effectiveRecordsPerPage = recordsPerPage === -1
    ? Math.max(1, filtered.length)
    : recordsPerPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectiveRecordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * effectiveRecordsPerPage;
    return filtered.slice(start, start + effectiveRecordsPerPage);
  }, [filtered, currentPage, effectiveRecordsPerPage]);

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const filterLayerCount = (statusFilter !== "all" ? 1 : 0) + (scopeFilter !== "all" ? 1 : 0);
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : locations.length + archivedLocations.length,
    filteredCount: tableLoad.forceEmpty ? 0 : filtered.length,
    pageCount: paginated.length,
    searchQuery,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(searchQuery, [...locations, ...archivedLocations].flatMap((l) => [l.name, l.address, l.city, l.state, l.country]));
  }, [emptyKind, searchQuery, locations, archivedLocations]);
  const emptyStateProps = emptyKind && {
    kind: emptyKind,
    entity: { singular: "partner location", plural: "partner locations" },
    searchQuery,
    suggestion: searchSuggestion,
    onApplySuggestion: (v: string) => { setSearchQuery(v); setCurrentPage(1); },
    filterCount: filterLayerCount,
    onClearSearch: () => { setSearchQuery(""); setCurrentPage(1); },
    onClearFilters: () => { setStatusFilter("all"); setScopeFilter("all"); setCurrentPage(1); },
    onClearAll: () => { setSearchQuery(""); setStatusFilter("all"); setScopeFilter("all"); setCurrentPage(1); },
    onRetry: tableLoad.retry,
    retrying: tableLoad.retrying,
    onFirstPage: () => setCurrentPage(1),
    onCreate: () => setCreateLocationModalOpen(true),
    createLabel: "Create New Location",
  };

  const allPageSelected = paginated.length > 0 && paginated.every((l) => selectedRows.has(l.id));
  const somePageSelected = paginated.some((l) => selectedRows.has(l.id));
  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginated.forEach((l) => next.delete(l.id));
      } else {
        paginated.forEach((l) => next.add(l.id));
      }
      return next;
    });
  }, [allPageSelected, paginated]);
  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

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

  const handleOpenLocation = useCallback((loc: PartnerLocationData) => {
    setSelectedLocation(loc);
    setDetailModalOpen(true);
  }, []);

  // Deep-link: open the location modal when arriving with ?loc=<idx>. Uses the generated list so the index aligns with QuickView.
  useEffect(() => {
    if (initialLocationIdx == null) return;
    const target = generatedLocations[initialLocationIdx];
    if (!target) return;
    setSelectedLocation(target);
    setDetailModalOpen(true);
    onInitialLocationConsumed?.();
    // Run once per arrival — the parent clears the param, so this effect won't refire on subsequent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocationIdx]);

  // Per-location primary POC override (location id → contact id). Falls back to the first
  // selected contact for the location if no override is set.
  const [locPrimaryByLoc, setLocPrimaryByLoc] = useState<Record<string, string>>({});
  const [locPrimaryChangeTarget, setLocPrimaryChangeTarget] = useState<{ id: string; name: string } | null>(null);

  // Location modal status pill state — mirrors the partner-detail StatusPill pattern.
  const [locStatusDropdownOpen, setLocStatusDropdownOpen] = useState(false);
  const [locStatusConfirmOpen, setLocStatusConfirmOpen] = useState(false);
  const [locStatusChangeTarget, setLocStatusChangeTarget] = useState<"active" | "inactive" | null>(null);
  const [locArchiveDialogOpen, setLocArchiveDialogOpen] = useState(false);
  const locStatusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
  };
  const handleLocStatusChange = useCallback((next: "active" | "inactive") => {
    setSelectedLocation((prev) => prev ? { ...prev, status: next } : prev);
    setCreatedLocations((prev) => prev.map((l) => (selectedLocation && l.id === selectedLocation.id) ? { ...l, status: next } : l));
    setLocStatusConfirmOpen(false);
    setLocStatusChangeTarget(null);
    toast.success(`Location marked as ${next === "active" ? "Active" : "Inactive"}`);
  }, [selectedLocation]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setIsFullScreen(false);
    setLocDetailTab("overview");
    setLocAboutOpen(true);
    setLocPocOpen(true);
    setLocBillingOpen(true);
    setLocCreditOpen(false);
    setLocCarrierOpen(false);
    setLocPtOpen(false);
    setTimeout(() => setSelectedLocation(null), 200);
  }, []);

  // ── Location POC contact dictionary (local copy) ──
  const [locContactDictionary, setLocContactDictionary] = useState<PartnerContact[]>([...CONTACT_DICTIONARY]);

  // ── Location modal Overview state — KPI ordering + drag/drop, last-refreshed timestamp,
  //    widget visibility/sizes, and the "Customize Widgets" panel state. Same shape as the
  //    partner Dashboard, scoped to the modal so changes don't bleed into the partner-level
  //    dashboard. Declared together so the reset handler's deps array sees both arrays. ──
  // Default Overview KPIs at location level — `ov_pricing` removed because Pricing Rules
  // are no longer a location-level concern (architecture lockdown).
  const LOC_OV_KPI_DEFAULT = useMemo(() => ["ov_contacts", "ov_items", "ov_centers", "ov_carriers", "ov_credit"], []);
  // Categorized KPI definitions — mirrors DASH_KPI_DEFS shape so the customize drawer can
  // render the same OPERATIONAL / FINANCIAL / OVERVIEW grouping as the partner Dashboard.
  const LOC_OV_KPI_DEFS = useMemo(() => [
    // Operational
    { key: "ov_contacts", label: "Contacts", iconName: "Users", category: "Operational", tooltip: "Point-of-contacts assigned to this location." },
    { key: "ov_items", label: "Items", iconName: "Package", category: "Operational", tooltip: "Items stocked or available at this location." },
    { key: "ov_centers", label: "Service Centers", iconName: "Wrench", category: "Operational", tooltip: "Service centers attached to this location." },
    { key: "ov_carriers", label: "Carriers", iconName: "Truck", category: "Operational", tooltip: "Vendor + customer carriers configured at this location." },
    { key: "ov_orders_month", label: "Orders This Month", iconName: "ShoppingCart", category: "Operational", tooltip: "Purchase orders processed at this location in the current month." },
    { key: "ov_on_time", label: "On-Time Delivery", iconName: "CheckCircle2", category: "Operational", tooltip: "Percentage of inbound shipments to this location that arrived on or before their promised date." },
    { key: "ov_returns", label: "Return Rate", iconName: "RotateCcw", category: "Operational", tooltip: "Percentage of items returned from this location." },
    // Financial
    { key: "ov_credit", label: "Credit Used", iconName: "DollarSign", category: "Financial", tooltip: "Credit utilization at this location." },
    { key: "ov_spend_month", label: "Spend This Month", iconName: "TrendingUp", category: "Financial", tooltip: "Total purchase-order spend at this location this month." },
    { key: "ov_avg_order", label: "Avg Order Value", iconName: "Calendar", category: "Financial", tooltip: "Average value of orders processed at this location." },
    // Overview
    { key: "ov_country", label: "Country", iconName: "Globe", category: "Overview", tooltip: "Country this location operates in." },
    { key: "ov_status", label: "Status", iconName: "Star", category: "Overview", tooltip: "Operational status of this location." },
  ], []);
  const LOC_OV_WIDGET_DEFS = useMemo(() => [
    // Performance — Spend / Order Activity is split per direction so it's
    // obvious whether each chart counts money/goods flowing us → them
    // (purchase orders we issue) or them → us (sales orders we fulfill).
    { key: "po_spend_trend", label: "Purchase Order Cost Trend", description: "Monthly dollars we pay out to this location for goods/services we buy from them (we → them).", category: "Performance", visual: "line" as const },
    { key: "so_spend_trend", label: "Sales Order Revenue Trend", description: "Monthly dollars this location pays us for goods/services we sell to them (them → us).", category: "Performance", visual: "line" as const },
    { key: "po_order_activity", label: "Purchase Order Activity", description: "Daily count of purchase orders we issued to this location, with items returned back to us.", category: "Performance", visual: "chart" as const },
    { key: "so_order_activity", label: "Sale Order Activity", description: "Daily count of sales orders we shipped to this location, with items returned back to us.", category: "Performance", visual: "chart" as const },
    { key: "delivery_perf", label: "Delivery Performance", description: "On-time delivery rate over time", category: "Performance", visual: "line" as const },
    { key: "return_rate", label: "Return Rate", description: "Returns volume by month", category: "Performance", visual: "bars" as const },
    // Operational
    { key: "top_items", label: "Top Items", description: "Highest-spend items at this location", category: "Operational", visual: "bars" as const },
    { key: "recent_orders", label: "Recent Orders", description: "Latest orders processed at this location", category: "Operational", visual: "list" as const },
    { key: "carrier_mix", label: "Carrier Mix", description: "Breakdown of carrier usage at this location", category: "Operational", visual: "donut" as const },
    // People
    { key: "primary_contact", label: "Primary Contact", description: "Main POC for this location, with role and contact details", category: "People", visual: "contact" as const },
  ], []);
  const LOC_OV_WIDGET_DEFAULT = useMemo(() => ["po_spend_trend", "so_spend_trend", "po_order_activity", "so_order_activity", "primary_contact"], []);
  const [locOvKpiOrder, setLocOvKpiOrder] = useState<string[]>(LOC_OV_KPI_DEFAULT);
  const [locOvLastRefreshed, setLocOvLastRefreshed] = useState<Date>(() => new Date());
  const [locOvActiveWidgets, setLocOvActiveWidgets] = useState<string[]>(LOC_OV_WIDGET_DEFAULT);
  const [locOvWidgetSizes, setLocOvWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  // Per-widget time-period selector — Eli's "time, time, time" point: every
  // total/average widget needs an explicit window so users aren't left
  // guessing whether the chart spans 30 days, 90 days, or the full year.
  // Same option set the Transactions KPIs use, plus a Custom slot (visual
  // only this pass — the date-range picker lands with the analytics push).
  type LocOvWidgetPeriod = "7d" | "30d" | "90d" | "1y" | "all" | "custom";
  const LOC_OV_PERIOD_OPTIONS: { key: LocOvWidgetPeriod; label: string }[] = [
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "90d", label: "Last 90 Days" },
    { key: "1y", label: "Last Year" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom…" },
  ];
  const [locOvWidgetPeriods, setLocOvWidgetPeriods] = useState<Record<string, LocOvWidgetPeriod>>({});
  const handleLocOvWidgetPeriodChange = useCallback((key: string, period: LocOvWidgetPeriod) => {
    setLocOvWidgetPeriods((prev) => ({ ...prev, [key]: period }));
    if (period === "custom") toast.info("Custom date range, coming with the analytics push");
  }, []);
  const [locOvCustomizeOpen, setLocOvCustomizeOpen] = useState(false);
  const [locOvCustomizeSearch, setLocOvCustomizeSearch] = useState("");
  const [locOvCustomizeTab, setLocOvCustomizeTab] = useState<"kpis" | "widgets">("kpis");
  // Two-stage mount/visible flags so the drawer can animate in (translate + fade backdrop)
  // and out — same pattern the partner Dashboard's DashboardCustomizePanel uses.
  const [locOvCustomizeMounted, setLocOvCustomizeMounted] = useState(false);
  const [locOvCustomizeVisible, setLocOvCustomizeVisible] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (locOvCustomizeOpen) {
      setLocOvCustomizeMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setLocOvCustomizeVisible(true));
      });
    } else {
      setLocOvCustomizeVisible(false);
      t = setTimeout(() => setLocOvCustomizeMounted(false), 280);
    }
    return () => { if (t) clearTimeout(t); };
  }, [locOvCustomizeOpen]);
  const moveLocOvKpi = useCallback((from: number, to: number) => {
    setLocOvKpiOrder((prev) => { const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; });
  }, []);
  const handleLocOvToggleKpi = useCallback((key: string) => {
    setLocOvKpiOrder((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  const handleLocOvWidgetSize = useCallback((key: string, size: "sm" | "md" | "lg") => {
    setLocOvWidgetSizes((prev) => ({ ...prev, [key]: size }));
  }, []);
  const handleLocOvToggleWidget = useCallback((key: string) => {
    setLocOvActiveWidgets((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  // Reorder hook for DraggableWidgetCard — same shape moveWidget uses for
  // the partner Dashboard tab so widgets here participate in the same DnD
  // type (WIDGET_DND_TYPE) and react-dnd's outer DndProvider wired around
  // the location modal.
  const moveLocOvWidget = useCallback((fromIndex: number, toIndex: number) => {
    setLocOvActiveWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);
  const handleLocOvResetLayout = useCallback(() => {
    setLocOvKpiOrder([...LOC_OV_KPI_DEFAULT]);
    setLocOvActiveWidgets([...LOC_OV_WIDGET_DEFAULT]);
    setLocOvWidgetSizes({});
    toast.success("Layout reset to defaults");
  }, [LOC_OV_KPI_DEFAULT, LOC_OV_WIDGET_DEFAULT]);
  const handleLocOvRefresh = useCallback(() => {
    setLocOvLastRefreshed(new Date());
    toast.success("Overview refreshed");
  }, []);
  const [locSelectedPocIds, setLocSelectedPocIds] = useState<Set<string>>(new Set(["C-001", "C-003", "C-006"]));

  const locPocDeptCounts = useMemo(() => {
    const counts: Record<string, number> = { Sales: 0, "Supply Chain Management": 0, Finance: 0 };
    locContactDictionary.forEach((c) => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [locContactDictionary]);

  const locFilteredContacts = useMemo(() => {
    let list = locContactDictionary;
    if (locPocCategoryFilter !== "all") list = list.filter((c) => c.department === locPocCategoryFilter);
    if (locPocSearch.trim()) {
      const q = locPocSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.department.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    return list;
  }, [locContactDictionary, locPocCategoryFilter, locPocSearch]);

  const LOC_POC_PER_PAGE = 20;
  const locPocTotalPages = Math.max(1, Math.ceil(locFilteredContacts.length / LOC_POC_PER_PAGE));
  const locPocPagedContacts = locFilteredContacts.slice((locPocPage - 1) * LOC_POC_PER_PAGE, locPocPage * LOC_POC_PER_PAGE);

  const handleLocOpenSelectModal = useCallback(() => {
    setLocPocTempSelected(new Set(locSelectedPocIds));
    setLocPocSearch("");
    setLocPocCategoryFilter("all");
    setLocPocPage(1);
    setLocShowSelectModal(true);
  }, [locSelectedPocIds]);

  const handleLocTogglePocTemp = useCallback((id: string) => {
    setLocPocTempSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const handleLocConfirmSelect = useCallback(() => {
    setLocSelectedPocIds(new Set(locPocTempSelected));
    setLocShowSelectModal(false);
    toast.success("Location contacts updated");
  }, [locPocTempSelected]);

  const locResetCreateForm = useCallback(() => {
    setLocNewPocName(""); setLocNewPocDepartment("Sales"); setLocNewPocRole("");
    setLocNewPocLandline(""); setLocNewPocLandlineCode("+1"); setLocNewPocExt("");
    setLocNewPocMobile(""); setLocNewPocMobileCode("+1"); setLocNewPocEmail("");
    setLocSaveAndCreate(false);
  }, []);

  const handleLocOpenCreate = useCallback(() => {
    locResetCreateForm();
    setLocShowCreateModal(true);
  }, [locResetCreateForm]);

  const handleLocOpenCreateFromSelect = useCallback(() => {
    setLocShowSelectModal(false);
    locResetCreateForm();
    setLocShowCreateModal(true);
  }, [locResetCreateForm]);

  const handleLocSavePoc = useCallback(() => {
    if (!locNewPocName.trim()) { toast.error("Name is required."); return; }
    const AVATAR_COLORS = ["rgb(var(--primary))", "rgb(var(--violet))", "rgb(var(--success))", "rgb(var(--warning))"];
    const newContact: PartnerContact = {
      id: `C-LOC-${Date.now()}`,
      name: locNewPocName.trim(),
      company: selectedLocation?.name || "Location",
      department: locNewPocDepartment,
      phone: `${locNewPocMobileCode} ${locNewPocMobile.trim()}`,
      phoneExt: "",
      secondaryPhone: `${locNewPocLandlineCode} ${locNewPocLandline.trim()}`,
      secondaryPhoneExt: locNewPocExt.trim(),
      email: locNewPocEmail.trim(),
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };
    setLocContactDictionary((prev) => [newContact, ...prev]);
    setLocSelectedPocIds((prev) => new Set([...prev, newContact.id]));
    toast.success(`"${newContact.name}" created and assigned to this location.`);
    if (locSaveAndCreate) {
      locResetCreateForm();
    } else {
      locResetCreateForm();
      setLocShowCreateModal(false);
    }
  }, [locNewPocName, locNewPocDepartment, locNewPocRole, locNewPocLandline, locNewPocLandlineCode, locNewPocExt, locNewPocMobile, locNewPocMobileCode, locNewPocEmail, locSaveAndCreate, locResetCreateForm]);

  // Detail-modal sizing standard — vendor quick-view is multi-section /
  // tabbed so it gets the stable frame. Width capped at 1480px, min
  // 640px height.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(80vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <>
      {/* Unified Table Container — matches VendorsListPage */}
      <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col" style={{ minHeight: 400 }}>
        {/* Row 1: Search + Filters ... Count + Density */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search by name, email, or address..."
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
            {/* Filters button (placeholder) */}
            <button
              type="button"
              onClick={() => toast.info("Advanced filters coming soon!")}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          {/* Count + Density Dropdown + Create */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span data-table-meta className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
              {filtered.length !== locations.length ? (
                <>
                  <span className="text-foreground">{filtered.length}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{locations.length}</span>
                  <span className="text-muted-foreground/70"> locations</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{locations.length}</span>
                  <span className="text-muted-foreground/70"> locations</span>
                </>
              )}
            </span>

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
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                    {LOC_DENSITY_CONFIG.find((d) => d.key === density)?.label}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                {LOC_DENSITY_CONFIG.map((opt) => (
                  <DropdownMenuItem
                    key={opt.key}
                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                    onSelect={(e) => {
                      if (opt.key === "card") e.preventDefault();
                      setDensity(opt.key);
                    }}
                  >
                    {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                    {opt.icon === "list" && <ListIcon className="w-5 h-5 text-muted-foreground shrink-0" />}
                    {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    {density === opt.key && <Check className="w-4 h-4 text-primary shrink-0" />}
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
                            onClick={() => setLocCardSize(size)}
                            className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                              locCardSize === size
                                ? "bg-primary text-white shadow-sm"
                                : "bg-muted text-slate-500 hover:bg-border"
                            }`}
                            style={{ fontWeight: locCardSize === size ? 600 : 500 }}
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

            <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />

            {/* Create Location Button */}
            <button
              type="button"
              onClick={() => setCreateLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-sm shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create New Location</span>
            </button>
          </div>
        </div>

        {/* Row 2: Quick Filter Pills — single-select across Scope + Status.
            Picking any pill resets the others so only one is active at a time;
            "All Locations" is the reset. */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
          {([
            { key: "all" as const, label: "All Locations", count: locations.length, kind: "all" as const },
            { key: "vendor" as const, label: "Vendor", count: scopeCounts.vendor, kind: "scope" as const },
            { key: "customer" as const, label: "Customer", count: scopeCounts.customer, kind: "scope" as const },
            { key: "both" as const, label: "Vendor + Customer", count: scopeCounts.both, kind: "scope" as const },
            { key: "active" as const, label: "Active", count: activeCount, kind: "status" as const },
            { key: "inactive" as const, label: "Inactive", count: inactiveCount, kind: "status" as const },
            { key: "archived" as const, label: "Archived", count: archivedLocations.length, kind: "status" as const },
          ]).map((f) => {
            const isActive =
              f.kind === "all"
                ? scopeFilter === "all" && statusFilter === "all"
                : f.kind === "scope"
                  ? scopeFilter === f.key && statusFilter === "all"
                  : statusFilter === f.key && scopeFilter === "all";
            return (
              <Fragment key={f.key}>
              {f.key === "archived" && <div className="w-px h-5 bg-border shrink-0" />}
              <button
                onClick={() => {
                  if (f.kind === "all") {
                    setScopeFilter("all");
                    setStatusFilter("all");
                  } else if (f.kind === "scope") {
                    setScopeFilter(f.key as "vendor" | "customer" | "both");
                    setStatusFilter("all");
                  } else {
                    setStatusFilter(f.key as "active" | "inactive" | "archived");
                    setScopeFilter("all");
                  }
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                }`}
                style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "rgb(var(--primary))" : undefined }}
              >
                {f.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                  style={{ fontWeight: 600, color: isActive ? "rgb(var(--primary))" : "rgb(var(--muted-foreground))" }}
                >
                  {f.count}
                </span>
              </button>
              </Fragment>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-border shrink-0" />

        {/* Content area */}
        {density === "card" ? (
          /* Card View */
          <div className="p-4 min-h-0 overflow-y-auto flex-1">
            {tableLoad.loadState === "loading" ? (
              <CardSkeletonGrid />
            ) : emptyStateProps ? (
              <TableEmptyState {...emptyStateProps} />
            ) : (
              <div className={`grid gap-4 ${
                locCardSize === "large" ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" :
                locCardSize === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              }`}>
                {paginated.map((loc) => {
                  const isHighlighted = highlightedLocationId === loc.id;
                  return (
                  <div
                    key={loc.id}
                    className={`bg-white border rounded-xl cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:border-[#93B8F7]/50 transition-all duration-200 group/card flex flex-col overflow-hidden ${
                      isHighlighted
                        ? "border-primary shadow-[0_0_0_2px_rgba(10,119,255,0.15),0_8px_24px_-8px_rgba(10,119,255,0.20)] animate-[highlight-pulse_1.5s_ease-in-out_2]"
                        : "border-border"
                    }`}
                    style={isHighlighted ? { animation: "highlight-pulse 1.5s ease-in-out 2" } : undefined}
                    onClick={() => handleOpenLocation(loc)}
                  >
                    {/* Location Image / Map fallback — top banner.
                        When no image is set, render a tinted empty-state with a centered pin
                        icon (mirrors the Attachments tab card pattern). The whole card click
                        opens the location detail modal — the image area is not a separate
                        affordance. */}
                    <div className="relative w-full h-[160px] overflow-hidden bg-muted">
                      {loc.image ? (
                        <img
                          src={loc.image}
                          alt={loc.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-accent">
                          <MapPin className="w-12 h-12 text-primary" style={{ opacity: 0.35 }} />
                        </div>
                      )}
                      {/* Bottom-right: Status pill (anchored opposite the
                          3-dot menu, mirrors the "Ad" badge placement on
                          food-delivery cards Eli referenced). The NEW pulse
                          chip stays bottom-left so it doesn't fight the
                          status pill on the same edge. Vendor / Customer
                          scope pills moved out of the image into the white
                          card body below — see "Scope pill row". */}
                      {isHighlighted && (
                        <div className="absolute bottom-2.5 left-2.5 z-10">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-wider shadow-sm backdrop-blur-sm"
                            style={{ fontWeight: 700, backgroundColor: "rgba(10,119,255,0.9)", color: "#fff" }}
                          >
                            <Sparkles className="w-3 h-3" />
                            New
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-2.5 right-2.5 z-10">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] shadow-sm backdrop-blur-sm border"
                          style={{
                            fontWeight: 600,
                            backgroundColor: loc.status === "active" ? "rgba(236,253,245,0.92)" : "rgba(255,251,235,0.92)",
                            color: loc.status === "active" ? "#065F46" : "#92400E",
                            borderColor: loc.status === "active" ? "#A7F3D0" : "#FDE68A",
                          }}
                        >
                          {loc.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {/* 3-dot menu on image */}
                      <div className="absolute top-2.5 right-2.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-white/80 backdrop-blur-sm text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-white hover:text-foreground transition-all cursor-pointer shadow-sm"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()} className="w-56">
                            <DropdownMenuItem onClick={() => handleOpenLocation(loc)}>
                              <Eye className="w-4 h-4 mr-2 text-slate-500" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Edit location coming soon!")}>
                              <Pencil className="w-4 h-4 mr-2 text-slate-500" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toast.info("Email feature coming soon")}>
                              <Mail className="w-4 h-4 mr-2 text-slate-500" /> Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Add Note, coming soon")}>
                              <StickyNote className="w-4 h-4 mr-2 text-slate-500" /> Add Note
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Upload, coming soon")}>
                              <Upload className="w-4 h-4 mr-2 text-slate-500" /> Upload
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const url = appHref(`#location/${loc.id}`);
                              navigator.clipboard?.writeText(url).then(
                                () => toast.success("Link copied"),
                                () => toast.error("Could not copy link"),
                              );
                            }}>
                              <Link2 className="w-4 h-4 mr-2 text-slate-500" /> Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {loc.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => setStatusChangeLocation({ loc, target: "inactive" })}
                                className="focus:bg-amber-50"
                                style={{ color: "#B45309" }}
                              >
                                <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
                                Mark as Inactive
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setStatusChangeLocation({ loc, target: "active" })}
                                className="focus:bg-emerald-50"
                                style={{ color: "#059669" }}
                              >
                                <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                                Mark as Active
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setArchiveLocationTarget(loc)}>
                              <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-col flex-1">

                      {/* Title + Address */}
                      <div className="px-3.5 pt-1.5 pb-0">
                        <p className="text-[14px] text-slate-700 truncate" style={{ fontWeight: 600, lineHeight: '20px' }}>{highlightText(loc.name)}</p>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state}, ${loc.country}`)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[12px] text-slate-500 hover:text-primary hover:underline truncate block mt-0.5 transition-colors" style={{ lineHeight: '18px' }}>
                          {loc.address}, {loc.city}, {loc.state}
                        </a>
                      </div>

                      {/* Scope pills + Stats — one balanced row. Scope pills
                          anchor left (Vendor blue, Customer violet — canonical
                          partner-level palette). Contacts + Items stats anchor
                          right, parallel to the pills. Service Centers
                          stripped per Eli — the metric is coming-soon and
                          isn't worth the visual weight on a tight card. */}
                      <div className="px-3.5 pt-2 pb-3 flex-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {loc.scope.includes("vendor") && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px]"
                              style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", borderColor: "#A8D2FF" }}
                            >
                              Vendor
                            </span>
                          )}
                          {loc.scope.includes("customer") && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px]"
                              style={{ fontWeight: 600, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }}
                            >
                              Customer
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-default hover:text-primary transition-colors">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-700" style={{ fontWeight: 600 }}>{loc.contacts || 0}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4} className="z-[300] text-[11px]">
                              {(loc.contacts || 0)} point of contact{(loc.contacts || 0) === 1 ? "" : "s"} at this location
                            </TooltipContent>
                          </Tooltip>
                          <div className="w-px h-3 bg-border" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-default hover:text-primary transition-colors">
                                <Package className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-700" style={{ fontWeight: 600 }}>{loc.items || 0}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4} className="z-[300] text-[11px]">
                              {(loc.items || 0)} item{(loc.items || 0) === 1 ? "" : "s"} this partner sells from this location
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Footer — Primary POC for this location (replaces the
                          stale AI-assigned "Created by" chip). Avatar hover
                          surfaces the same dark contact card the partner
                          listing POC column uses, with a Primary pill anchored
                          inline. The mailto / tel inside the card are visual
                          for this sprint — the live mail-client / dialer
                          handoff lives in the Comms module sprint, per the
                          user story. */}
                      <div className="px-3.5 py-2.5 border-t border-muted flex items-center justify-between text-[10px] text-slate-400">
                        {loc.pocNames.length > 0 ? (() => {
                          const primaryPoc = loc.pocNames[0];
                          const matched = CONTACT_DICTIONARY.find((c) => c.name === primaryPoc.name);
                          const contactHref = matched
                            ? `/partners/contacts/${matched.id}`
                            : `/partners/contacts/${encodeURIComponent(primaryPoc.name.toLowerCase().replace(/\s+/g, "-"))}`;
                          const emailLocal = primaryPoc.name.toLowerCase().replace(/\s+/g, ".");
                          return (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <HoverCard>
                                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] shrink-0 overflow-hidden border border-[#E8ECF1] cursor-pointer"
                                    style={{ backgroundColor: primaryPoc.photo ? "transparent" : primaryPoc.bgColor, fontWeight: 600 }}
                                  >
                                    {primaryPoc.photo
                                      ? <img src={primaryPoc.photo} alt="" className="w-full h-full object-cover" />
                                      : <span style={{ color: primaryPoc.fgColor || "#334155" }}>{primaryPoc.initials}</span>}
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  side="top"
                                  align="start"
                                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                    {/* Primary pill — anchored top-right of the dark header so
                                        the popup carries the same primary indicator the card row
                                        shows in the footer (star icon there, full pill here for
                                        legibility against the dark gradient). */}
                                    <span
                                      className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] bg-blue-500/20 border border-blue-300/40 text-blue-100"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <Star className="w-2.5 h-2.5 fill-blue-200 text-blue-200" />
                                      Primary
                                    </span>
                                    <div className="flex items-center gap-3 relative">
                                      <div
                                        className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
                                        style={{ backgroundColor: primaryPoc.photo ? "transparent" : primaryPoc.bgColor }}
                                      >
                                        {primaryPoc.photo
                                          ? <img src={primaryPoc.photo} alt="" className="w-full h-full object-cover" />
                                          : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{primaryPoc.initials}</div>}
                                      </div>
                                      <div className="min-w-0 pr-14">
                                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{primaryPoc.name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">Point of Contact · {loc.name}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-white px-4 py-3 space-y-2">
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{emailLocal}@company.com</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{loc.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{loc.name}</span>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                              <a
                                href={contactHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 min-w-0 text-muted-foreground hover:text-primary transition-colors"
                                style={{ fontWeight: 500 }}
                                title="Primary point of contact for this location"
                              >
                                <span className="truncate hover:underline">{primaryPoc.name}</span>
                                <Star className="w-3 h-3 fill-blue-600 text-blue-600 shrink-0" aria-label="Primary contact" />
                              </a>
                            </div>
                          );
                        })() : (
                          <span className="text-muted-foreground italic" style={{ fontWeight: 500 }}>No primary contact</span>
                        )}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span className="text-slate-500" style={{ fontWeight: 500 }}>{formatDate(loc.lastUpdated)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Table View (condensed/comfort) — matches VendorsListPage exactly */
          <div className={`min-h-0 overflow-auto flex-1 ${locIsResizing || locDraggingColumnKey ? "select-none" : ""}`}>
            <Table style={{ tableLayout: "fixed", width: `max(${locTotalWidth}px, 100%)` }}>
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow className={`bg-muted/30 hover:bg-muted/30 ${density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"}`}>
                  {/* Checkbox — sticky left */}
                  <TableHead className="sticky left-0 z-20 bg-slate-50 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                    <Checkbox checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false} onCheckedChange={handleSelectAll} aria-label="Select all rows" />
                  </TableHead>
                  {/* Dynamic columns */}
                  {locVisibleColumns.map((key) => {
                    const def = locColDef(key);
                    const isLocked = LOC_LOCKED_COLUMNS.includes(key);
                    const isDraggable = !isLocked;
                    const currentSort: "asc" | "desc" | null = locSortConfig?.key === key ? locSortConfig.direction : null;
                    const w = locColumnWidths[key] ?? parseInt(def.minWidth, 10);
                    const isBeingDragged = locDraggingColumnKey === key;
                    return (
                      <TableHead
                        key={key}
                        data-loc-col-key={key}
                        onMouseDown={isDraggable ? (e) => handleLocHeaderMouseDown(e, key) : undefined}
                        onClickCapture={isDraggable ? (e) => { if (locSuppressClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined}
                        className={`whitespace-nowrap relative group/colheader ${isDraggable ? "cursor-grab" : ""}`}
                        style={{
                          width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                          ...(isBeingDragged ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}),
                        }}
                      >
                        {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "rgb(var(--primary))" }} />}
                        {isDraggable && (
                          <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                        )}
                        <div className="flex items-center">
                          <ColumnHeaderMenu
                            columnKey={key}
                            label={def.label}
                            sortable={def.sortable}
                            sortConfig={locSortConfig}
                            onSort={handleLocSort}
                            onAddFilter={() => {}}
                            onHideColumn={() => {}}
                            isLocked={isLocked}
                          >
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[13px]" style={currentSort ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                              {currentSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                              {currentSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                              {!currentSort && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                            </div>
                          </ColumnHeaderMenu>
                        </div>
                        {/* Resize handle */}
                        <div
                          onMouseDown={(e) => { e.stopPropagation(); handleLocResizeStart(e, key); }}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); setLocColumnWidths(prev => ({ ...prev, [key]: parseInt(def.minWidth, 10) })); }}
                          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                          style={{ touchAction: "none" }}
                        >
                          <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${locResizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                        </div>
                      </TableHead>
                    );
                  })}
                  {/* Actions — sticky right */}
                  <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                    <span className="text-[13px]">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableLoad.loadState === "loading" ? (
                  <TableSkeletonRows columns={locVisibleColumns.length + 2} />
                ) : emptyStateProps ? (
                  <TableEmptyRow colSpan={locVisibleColumns.length + 2} {...emptyStateProps} />
                ) : (
                  paginated.map((loc) => {
                    const isComfort = density === "comfort";
                    const avatarCls = isComfort ? "w-8 h-8" : "w-7 h-7";
                    const avatarTxt = isComfort ? "text-[10px]" : "text-[9px]";
                    const LocAvatar = ({ person }: { person: { initials: string; bgColor: string; fgColor?: string; photo?: string } }) => (
                      <div className={`${avatarCls} rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`} style={{ backgroundColor: person.photo ? "transparent" : person.bgColor }}>
                        {person.photo ? <img src={person.photo} alt="" className="w-full h-full object-cover" /> : <span className={avatarTxt} style={{ fontWeight: 700, color: person.fgColor || "#334155" }}>{person.initials}</span>}
                      </div>
                    );
                    const renderLocCell = (colKey: string) => {
                      switch (colKey) {
                        case "location_name": return (
                          <TableCell key={colKey}>
                            <div className="flex items-center gap-2.5">
                              <div className={`${isComfort ? "w-9 h-9" : "w-7 h-7"} rounded-md overflow-hidden bg-muted shrink-0`}>
                                <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm truncate block" style={{ fontWeight: 500, color: '#1E293B' }}>{highlightText(loc.name)}</span>
                                {isComfort && <span className="text-[11px] text-slate-400 truncate block">{loc.city}, {loc.state}</span>}
                              </div>
                            </div>
                          </TableCell>
                        );
                        case "type": return (
                          <TableCell key={colKey}>
                            {/* Scope pills — same blue (Vendor) / violet (Customer)
                                palette as the card view + the partner-level
                                scope chips. Renders both pills side-by-side
                                when the location is dual-role. */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {loc.scope.includes("vendor") && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border ${isComfort ? "text-[11px]" : "text-[10px]"}`}
                                  style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", borderColor: "#A8D2FF" }}
                                >
                                  Vendor
                                </span>
                              )}
                              {loc.scope.includes("customer") && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border ${isComfort ? "text-[11px]" : "text-[10px]"}`}
                                  style={{ fontWeight: 600, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }}
                                >
                                  Customer
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                        case "address": return (<TableCell key={colKey}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state}, ${loc.country}`)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm text-muted-foreground hover:text-primary hover:underline truncate block transition-colors">{loc.address}</a></TableCell>);
                        case "city_state": return (<TableCell key={colKey} className="text-sm text-muted-foreground whitespace-nowrap">{loc.city}, {loc.state}</TableCell>);
                        case "poc": return (
                          <TableCell key={colKey}>
                            {loc.pocNames.length > 0 ? (
                              <div className={`flex items-center ${isComfort ? "gap-2.5" : "gap-2"}`}>
                                {/* Avatar with HoverCard */}
                                <HoverCard>
                                  <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                    <div className="cursor-pointer"><LocAvatar person={loc.pocNames[0]} /></div>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                    <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                      <div className="flex items-center gap-3 relative">
                                        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: loc.pocNames[0].photo ? "transparent" : loc.pocNames[0].bgColor }}>
                                          {loc.pocNames[0].photo ? <img src={loc.pocNames[0].photo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{loc.pocNames[0].initials}</div>}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{loc.pocNames[0].name}</p>
                                          <p className="text-[11px] text-slate-400 truncate">Contact · {loc.name}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-white px-4 py-3 space-y-2">
                                      <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{loc.pocNames[0].name.toLowerCase().replace(/\s+/g, ".")}@company.com</span></div>
                                      <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>+1 (555) 012-3456</span></div>
                                      <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{loc.name}</span></div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                                <div className="min-w-0">
                                  <span className="text-sm truncate block max-w-[90px]" style={{ fontWeight: 500 }}>{loc.pocNames[0].name}</span>
                                  {isComfort && <span className="text-[10px] text-muted-foreground/60 block">Contact</span>}
                                </div>
                                {loc.pocNames.length > 1 && (
                                  <OverflowTooltip
                                    category="Points of Contact"
                                    scrollable
                                    items={loc.pocNames.slice(1).map((p, i) => ({
                                      id: `${loc.id}-poc-${i}`,
                                      name: p.name,
                                      subtitle: "Contact",
                                      initials: p.initials,
                                      avatarBg: p.bgColor,
                                      avatarFg: p.fgColor,
                                    }))}
                                  >
                                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{loc.pocNames.length - 1} more</span>
                                  </OverflowTooltip>
                                )}
                              </div>
                            ) : (<span className="text-sm text-muted-foreground">{"\u2013"}</span>)}
                          </TableCell>
                        );
                        case "service_centers": return (
                          <TableCell key={colKey}>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 ${isComfort ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[11px]"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
                                <Wrench className="w-3 h-3 text-slate-400" />
                                {loc.serviceCenterNames[0] || "Center"}
                              </span>
                              {loc.serviceCenterNames.length > 1 && (
                                <OverflowTooltip
                                  category="Service Centers"
                                  scrollable
                                  items={loc.serviceCenterNames.slice(1).map((sc, i) => ({
                                    id: `${loc.id}-sc-${i}`,
                                    name: sc,
                                    subtitle: "Service Center",
                                  }))}
                                >
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{loc.serviceCenterNames.length - 1}</span>
                                </OverflowTooltip>
                              )}
                            </div>
                          </TableCell>
                        );
                        case "last_updated_by": {
                          const updater = getLastUpdated(loc.id, loc.lastUpdated);
                          return (
                          <TableCell key={colKey}>
                            <div className={`flex items-center ${isComfort ? "gap-2.5" : "gap-2"}`}>
                              <HoverCard>
                                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div className="cursor-pointer"><LocAvatar person={{ ...updater, photo: updater.photoUrl }} /></div>
                                </HoverCardTrigger>
                                <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                    <div className="flex items-center gap-3 relative">
                                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: updater.bgColor }}>
                                        {updater.photoUrl ? (
                                          <img src={updater.photoUrl} alt={updater.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{updater.initials}</div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{updater.name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">Team Member</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-white px-4 py-3 space-y-2">
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{updater.name.toLowerCase().replace(/\s+/g, ".")}@company.com</span></div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>Operations</span></div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>+1 (555) 987-6543</span></div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                              <div className="min-w-0">
                                <span className="text-sm truncate block max-w-[120px]" style={{ fontWeight: 500, color: '#1E293B' }}>{updater.name}</span>
                                {isComfort && <span className="text-[10px] text-muted-foreground/50 block">Team Member</span>}
                              </div>
                            </div>
                          </TableCell>
                          );
                        }
                        case "created_by": return (
                          <TableCell key={colKey}>
                            <div className={`flex items-center ${isComfort ? "gap-2.5" : "gap-2"}`}>
                              {/* Avatar with HoverCard */}
                              <HoverCard>
                                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div className="cursor-pointer"><LocAvatar person={loc.createdBy} /></div>
                                </HoverCardTrigger>
                                <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                    <div className="flex items-center gap-3 relative">
                                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: loc.createdBy.photo ? "transparent" : loc.createdBy.bgColor }}>
                                        {loc.createdBy.photo ? <img src={loc.createdBy.photo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{loc.createdBy.initials}</div>}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{loc.createdBy.name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">Team Member</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-white px-4 py-3 space-y-2">
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{loc.createdBy.name.toLowerCase().replace(/\s+/g, ".")}@company.com</span></div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>Operations</span></div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>+1 (555) 987-6543</span></div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                              <div className="min-w-0">
                                <span className="text-sm truncate block max-w-[120px]" style={{ fontWeight: 500, color: '#1E293B' }}>{loc.createdBy.name}</span>
                                {isComfort && <span className="text-[10px] text-muted-foreground/50 block">Team Member</span>}
                              </div>
                            </div>
                          </TableCell>
                        );
                        case "last_updated_on": return (
                          <TableCell key={colKey}>
                            <div>
                              <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(loc.lastUpdated)}</span>
                              {isComfort && <span className="text-[10px] text-muted-foreground/50 block">{(() => { const d = Math.floor((Date.now() - new Date(loc.lastUpdated).getTime()) / 86400000); return d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`; })()}</span>}
                            </div>
                          </TableCell>
                        );
                        case "status": return (
                          <TableCell key={colKey}>
                            <span className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0" style={{ fontWeight: 500, backgroundColor: loc.status === "active" ? "#ECFDF5" : "#FFFBEB", color: loc.status === "active" ? "#065F46" : "#92400E", borderColor: loc.status === "active" ? "#A7F3D0" : "#FDE68A" }}>
                              {loc.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                        );
                        default: return (<TableCell key={colKey}>{"\u2013"}</TableCell>);
                      }
                    };
                    return (
                    <TableRow
                      key={loc.id}
                      className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                        density === "condensed" ? "[&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-3 [&>td]:pr-3"
                      } ${highlightedLocationId === loc.id ? "animate-row-flash bg-accent/60" : ""}`}
                      onClick={() => handleOpenLocation(loc)}
                    >
                      <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedRows.has(loc.id)} onCheckedChange={() => handleSelectRow(loc.id)} aria-label={`Select ${loc.name}`} />
                      </TableCell>
                      {locVisibleColumns.map((colKey) => {
                        const cell = renderLocCell(colKey);
                        const w = locColumnWidths[colKey] ?? parseInt(locColDef(colKey).minWidth, 10);
                        const isDraggedCol = locDraggingColumnKey === colKey;
                        const cellWidthStyle: React.CSSProperties = {
                          width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                          ...(isDraggedCol ? { backgroundColor: "rgba(10,119,255,0.035)" } : {}),
                        };
                        return cloneElement(cell, { style: { ...cell.props.style, ...cellWidthStyle } });
                      })}
                      <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center h-full">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenLocation(loc)}>
                              <Eye className="w-4 h-4 mr-2 text-slate-500" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Edit location coming soon!")}>
                              <Pencil className="w-4 h-4 mr-2 text-slate-500" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toast.info("Email feature coming soon")}>
                              <Mail className="w-4 h-4 mr-2 text-slate-500" /> Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Add Note, coming soon")}>
                              <StickyNote className="w-4 h-4 mr-2 text-slate-500" /> Add Note
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Upload, coming soon")}>
                              <Upload className="w-4 h-4 mr-2 text-slate-500" /> Upload
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const url = appHref(`#location/${loc.id}`);
                              navigator.clipboard?.writeText(url).then(
                                () => toast.success("Link copied"),
                                () => toast.error("Could not copy link"),
                              );
                            }}>
                              <Link2 className="w-4 h-4 mr-2 text-slate-500" /> Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {loc.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => setStatusChangeLocation({ loc, target: "inactive" })}
                                className="focus:bg-amber-50"
                                style={{ color: "#B45309" }}
                              >
                                <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
                                Mark as Inactive
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setStatusChangeLocation({ loc, target: "active" })}
                                className="focus:bg-emerald-50"
                                style={{ color: "#059669" }}
                              >
                                <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                                Mark as Active
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-red-50"
                              onClick={() => setArchiveLocationTarget(loc)}
                            >
                              <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
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
        {filtered.length > 0 && (
          <div data-table-meta className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Records per Page</span>
              <Select
                value={recordsPerPage === -1 ? "all" : String(recordsPerPage)}
                onValueChange={(val) => { setRecordsPerPage(val === "all" ? -1 : Number(val)); setCurrentPage(1); }}
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

      {/* ══════ Create Location Modal ══════ */}
      <CreatePartnerLocationModal
        open={createLocationModalOpen}
        onOpenChange={(open) => {
          setCreateLocationModalOpen(open);
          if (!open) setLocEditData(null);
        }}
        vendorName={vendor.companyName}
        existingLocationNames={[...createdLocations, ...generatedLocations].map((l) => l.name)}
        otherPartnersLocationNames={otherPartnersLocationNames}
        editData={locEditData}
        onLocationCreated={(data) => {
          const d = data as Record<string, any>;
          // Parse address parts from the full address string
          const addrParts = (d.address || "").split(",").map((s: string) => s.trim());
          const street = addrParts[0] || "—";
          const city = addrParts[1] || "—";
          const stateZip = addrParts[2] || "";
          const stateMatch = stateZip.match(/^([A-Za-z\s]+)\s*([\d-]+)?$/);
          const state = stateMatch ? stateMatch[1].trim() : stateZip;
          const zipCode = stateMatch ? (stateMatch[2] || "—") : "—";
          const country = addrParts[3] || "USA";

          // Edit mode — patch the currently-selected location instead of creating a new one.
          if (locEditData && selectedLocation) {
            const patched: PartnerLocationData = {
              ...selectedLocation,
              name: d.locationName || selectedLocation.name,
              address: street,
              city,
              state,
              zipCode,
              country,
              status: (d.status || "Active").toLowerCase() === "active" ? "active" : "inactive",
              phone: d.phone || selectedLocation.phone,
              email: d.email || selectedLocation.email,
              image: d.profileImage || selectedLocation.image,
              lastUpdated: new Date().toISOString(),
            };
            setSelectedLocation(patched);
            setCreatedLocations((prev) => prev.map((l) => l.id === selectedLocation.id ? patched : l));
            setLocEditData(null);
            toast.success(`${patched.name} updated`);
            return;
          }

          const newId = `loc-new-${Date.now()}`;
          // Default new locations to the partner's full scope (vendor /
          // customer / both) — the location creation form will let the
          // user narrow this in a later pass; for now mirror the partner.
          const inheritedScope = (vendor.partnerTypes && vendor.partnerTypes.length > 0
            ? vendor.partnerTypes
            : ["vendor"]) as ("vendor" | "customer")[];
          const newLoc: PartnerLocationData = {
            id: newId,
            name: d.locationName || "New Location",
            address: street,
            city,
            state,
            zipCode,
            country,
            contacts: (d.contacts as string[])?.length || 0,
            items: 0,
            serviceCenters: 0,
            pocNames: [],
            serviceCenterNames: [],
            status: (d.status || "Active").toLowerCase() === "active" ? "active" : "inactive",
            scope: inheritedScope,
            createdBy: { name: "You", initials: "YO", bgColor: "rgb(var(--accent))", fgColor: "rgb(var(--primary))" },
            lastUpdated: new Date().toISOString(),
            phone: d.phone || "",
            email: d.email || "",
            image: d.profileImage || LOCATION_IMAGES[Math.floor(Math.random() * LOCATION_IMAGES.length)],
          };

          setCreatedLocations((prev) => [newLoc, ...prev]);
          // Reset filters/search to ensure the new card is in the
          // listing if/when the user navigates back.
          setStatusFilter("all");
          setScopeFilter("all");
          setSearchQuery("");
          setCurrentPage(1);
          // Stakeholder feedback: replace the highlight + pill addition
          // with an immediate redirect to the new location's detail
          // view — same create-then-view pattern used elsewhere in the
          // product.
          setSelectedLocation(newLoc);
          setDetailModalOpen(true);
        }}
      />

      {/* ══════ Location Detail Modal ══════ */}
      <Dialog
        open={detailModalOpen}
        onOpenChange={(open) => {
          // Block ALL close paths while the Customize Widgets drawer is open. The drawer is
          // portal'd to document.body so any click/escape inside it is "outside" the
          // DialogContent — without this guard the modal (and the drawer with it) would close.
          if (locOvCustomizeOpen) return;
          if (!open) handleCloseDetailModal();
        }}
      >
        <DialogContent
          className={`flex flex-col p-0 gap-0 border-0 sm:border z-[200] ${modalSizeClass}`}
          hideCloseButton
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          onPointerDownOutside={(e) => { if (locOvCustomizeOpen) e.preventDefault(); }}
          onInteractOutside={(e) => { if (locOvCustomizeOpen) e.preventDefault(); }}
          onFocusOutside={(e) => { if (locOvCustomizeOpen) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (locOvCustomizeOpen) e.preventDefault(); }}
        >
          <DialogTitle className="sr-only">Location Details</DialogTitle>
          <DialogDescription className="sr-only">View details of this partner location.</DialogDescription>
          {selectedLocation && (() => {
            const loc = selectedLocation;
            const locAddress = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}`;
            const locWebsite = `www.${vendor.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
            const locLandline = `(${loc.phone.replace(/[^\d]/g, "").slice(1, 4)}) ${loc.phone.replace(/[^\d]/g, "").slice(4, 7)}-${loc.phone.replace(/[^\d]/g, "").slice(7, 11)}`;

            // Trimmed tab set per stakeholder feedback ("too cluttered, full
            // module's worth in a modal"). The Overview tab now carries
            // contact / address / primary-contact / credit info that used
            // to live in the right sidebar; PO / SO / Quotes / Service
            // Center / Communication tabs were dropped — they're already
            // present at the parent Vendor Detail level and don't need to
            // duplicate here.
            const LOC_TABS = [
              { id: "overview", label: "Overview", icon: Info },
              { id: "poc", label: "Points of Contact", icon: Users },
              // Items at the location level = "Items They Sell" only. Items They Buy lives at
              // partner level (per stakeholder architecture lockdown — buyer restrictions
              // are not location-specific in 99% of cases).
              { id: "items", label: "Items They Sell", icon: Package },
              // Transactions promoted to a top-level location tab per Eli's
              // feedback — the exchange ledger (Purchases / Sales / Returns)
              // is a different surface from the cleared-to-sell list above.
              // Location scope keeps Sales + Returns as coming-soon stubs.
              { id: "transactions", label: "Transactions", icon: Receipt },
              { id: "carrier_shipping", label: "Freight & Logistics", icon: Truck },
              // Pricing Rules removed at location level — pricing has no location-based
              // component for the Pioneer scope. Lives only at the Partner level.
              { id: "service_centers", label: "Service Centers", icon: Wrench },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "attachments", label: "Attachments", icon: Paperclip },
              { id: "activity", label: "Recent Activity", icon: ChartColumn },
            ];

            const LOC_POC_DATA = [
              { id: "LP-1", name: "Issac Archer", dept: "Sales", phone: "(419) 548-1532", landline: "(736) 267-8659", ext: "123", email: "jimmie@example.com", bgColor: "rgb(var(--primary))" },
              { id: "LP-2", name: "Daniel Whitaker", dept: "Procurement", phone: "(372) 588-9852", landline: "(322) 683-5910", ext: "123", email: "malvar@example.com", bgColor: "rgb(var(--violet))" },
              { id: "LP-3", name: "Kimora Avila", dept: "Finance", phone: "(476) 828-2670", landline: "(822) 622-2842", ext: "123", email: "pthom@example.com", bgColor: "rgb(var(--success))" },
              { id: "LP-4", name: "Laney Zavala", dept: "Production", phone: "(996) 247-1680", landline: "(309) 645-6861", ext: "123", email: "specpr@example.com", bgColor: "rgb(var(--warning))" },
              { id: "LP-5", name: "Wyatt Bates", dept: "Sampling", phone: "(437) 402-2459", landline: "(778) 804-3466", ext: "123", email: "pthon@example.com", bgColor: "rgb(var(--primary))" },
              { id: "LP-6", name: "Kaleb Figueroa", dept: "Assembly", phone: "(456) 844-9096", landline: "(360) 476-4400", ext: "123", email: "kewley@example.com", bgColor: "rgb(var(--destructive))" },
              { id: "LP-7", name: "Kylie Norton", dept: "Pre-Production", phone: "(736) 267-8659", landline: "(989) 930-7596", ext: "123", email: "phyrux@example.com", bgColor: "rgb(var(--violet))" },
              { id: "LP-8", name: "Anya Blevins", dept: "Electrical", phone: "(219) 418-4910", landline: "(437) 402-2459", ext: "123", email: "scottz@example.com", bgColor: "rgb(var(--success))" },
              { id: "LP-9", name: "Jimena Morrow", dept: "Hardware", phone: "(590) 887-7526", landline: "(989) 930-7596", ext: "123", email: "sjava@example.com", bgColor: "rgb(var(--warning))" },
              { id: "LP-10", name: "Vivian Davila", dept: "Sub-Store", phone: "(632) 372-3424", landline: "(536) 554-1064", ext: "123", email: "hikoza@example.com", bgColor: "rgb(var(--primary))" },
            ];

            // source: "location" — explicitly stocked at this location.
            // source: "inherited" — defined at the partner level; hidden by default,
            // surfaced via the Show inherited toggle. Inherited rows can be locally
            // deactivated (tracked in deactivatedInheritedItemIds) without affecting
            // the partner-level catalog.
            const LOC_ITEMS_DATA = [
              { id: "I-1", partNo: "100219-42", desc: "Front bulkhead cabinet lower cover", category: "Ram Pro Master 2500", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", control: "Non-Serialized", source: "location" as const },
              { id: "I-2", partNo: "100219-51", desc: "Box walls inlay cabinet", category: "Hardware", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", control: "Non-Serialized", source: "location" as const },
              { id: "I-3", partNo: "100219-51-01", desc: "Box walls inlay cabinet with defibrillator", category: "Cabinet", type: "Equipment - Capital", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", control: "Serialized", source: "location" as const },
              { id: "I-4", partNo: "100219-51-01RC", desc: "Box walls inlay cabinet with defibrillator (RC)", category: "Electronics", type: "Equipment - Non-Capital", typeBg: "#FEF3C7", typeColor: "rgb(var(--warning))", control: "Non-Serialized", source: "location" as const },
              { id: "I-5", partNo: "100219-51-02", desc: "Box walls inlay cabinet with refrigerator", category: "Hardware", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", control: "Serialized", source: "location" as const },
              { id: "I-6", partNo: "100219-52", desc: "Box closeout top cap inlay cabinet", category: "Electronics", type: "Equipment - Non-Capital", typeBg: "#FEF3C7", typeColor: "rgb(var(--warning))", control: "Non-Serialized", source: "inherited" as const },
              { id: "I-7", partNo: "100120-70", desc: "Toyota long cut, emergency brake assembly", category: "Hardware", type: "Miscellaneous", typeBg: "#FEE2E2", typeColor: "rgb(var(--destructive))", control: "Non-Serialized", source: "inherited" as const },
              { id: "I-8", partNo: "100120-71", desc: "Toyota long cut, brake line bracket", category: "Electronics", type: "Equipment - Capital", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", control: "Serialized", source: "inherited" as const },
            ];

            // source: "location" — explicitly added at this location
            // source: "inherited" — comes from the parent partner; hidden by
            // default and surfaced via the "Show inherited" toggle. Each
            // inherited row can be locally deactivated without affecting
            // the partner-level setup (tracked in deactivatedInheritedCarrierIds).
            const LOC_VENDOR_CARRIERS = [
              { id: "C-1", name: "FedEx Express", desc: "For fastest delivery in USA", isDefault: true, status: "active" as const, source: "location" as const, methods: [
                { id: "M-1", name: "FedEx Express (Air)", shortName: "Air", desc: "Premium air freight for time-critical shipments.", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
                { id: "M-2", name: "FedEx Ground", shortName: "Ground", desc: "Cost-effective road transportation for standard deliveries.", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.50" },
                { id: "M-3", name: "FedEx Freight (LTL)", shortName: "Freight", desc: "Less-than-truckload freight for larger shipments.", minDays: 5, maxDays: 7, isDefault: false, cost: "$85.00" },
              ]},
              { id: "C-2", name: "TCS (Tranzum Courier)", desc: "Regional courier with strong South Asian network coverage", isDefault: false, status: "active" as const, source: "location" as const, methods: [
                { id: "M-4", name: "Ocean Freight (Sea)", shortName: "Sea", desc: "Budget-friendly bulk shipping via sea routes.", minDays: 15, maxDays: 30, isDefault: true, cost: "$8.00" },
                { id: "M-5", name: "TCS Overnight", shortName: "Express", desc: "Next-day delivery within covered regions.", minDays: 1, maxDays: 1, isDefault: false, cost: "$22.00" },
              ]},
              { id: "C-4", name: "UPS (United Parcel Service)", desc: "Reliable domestic and international parcel service", isDefault: false, status: "inactive" as const, source: "inherited" as const, methods: [
                { id: "M-10", name: "UPS Ground", shortName: "Ground", desc: "Standard ground shipping across the continental US.", minDays: 3, maxDays: 5, isDefault: true, cost: "$11.00" },
              ]},
              { id: "C-7", name: "OnTrac", desc: "Regional ground carrier inherited from partner-level setup", isDefault: false, status: "active" as const, source: "inherited" as const, methods: [
                { id: "M-14", name: "OnTrac Ground", shortName: "Ground", desc: "Standard regional ground delivery.", minDays: 2, maxDays: 4, isDefault: true, cost: "$9.50" },
              ]},
            ];
            const LOC_CUSTOMER_CARRIERS = [
              { id: "C-3", name: "DHL Express", desc: "International express shipping with global reach", isDefault: true, status: "active" as const, source: "location" as const, methods: [
                { id: "M-6", name: "DHL Express Worldwide", shortName: "Air", desc: "Door-to-door international express delivery.", minDays: 2, maxDays: 4, isDefault: true, cost: "$55.00" },
                { id: "M-7", name: "DHL Economy Select", shortName: "Ground", desc: "Affordable road freight for less urgent shipments.", minDays: 5, maxDays: 8, isDefault: false, cost: "$18.00" },
                { id: "M-8", name: "DHL Global Forwarding", shortName: "Sea", desc: "Custom logistics solutions for complex supply chains.", minDays: 7, maxDays: 14, isDefault: false, cost: "$120.00" },
                { id: "M-9", name: "DHL Same Day", shortName: "Same Day", desc: "Urgent same-day delivery within metro areas.", minDays: 0, maxDays: 1, isDefault: false, cost: "$95.00" },
              ]},
              { id: "C-5", name: "Aramex", desc: "International express delivery and logistics for Middle East & Global", isDefault: false, status: "active" as const, source: "inherited" as const, methods: [
                { id: "M-11", name: "Aramex Express", shortName: "Air", desc: "International express delivery.", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
                { id: "M-12", name: "Aramex Ground", shortName: "Ground", desc: "Domestic ground delivery.", minDays: 5, maxDays: 8, isDefault: false, cost: "$9.00" },
              ]},
              { id: "C-6", name: "Maersk Line", desc: "World-leading ocean container shipping for bulk orders", isDefault: false, status: "active" as const, source: "location" as const, methods: [
                { id: "M-13", name: "Maersk Ocean", shortName: "Sea", desc: "Container shipping worldwide.", minDays: 14, maxDays: 28, isDefault: true, cost: "$6.50" },
              ]},
            ];
            const LOC_CARRIER_DATA = carrierSubTab === "vendor" ? LOC_VENDOR_CARRIERS : LOC_CUSTOMER_CARRIERS;

            const LOC_PRICING_DATA = [
              { id: "PR-1", name: "Volume-Based Discounts", desc: "Discounts applied when purchasing in bulk", discount: "50%", expiry: "30 Days", minQty: "35 EA", maxQty: "500 EA" },
              { id: "PR-2", name: "Volume-Based Discounts", desc: "Discounts applied when purchasing in bulk", discount: "50%", expiry: "30 Days", minQty: "35 EA", maxQty: "500 EA" },
              { id: "PR-3", name: "Late Payment Penalties", desc: "Additional fees for overdue payments", discount: "50%", expiry: "30 Days", minQty: "35 EA", maxQty: "500 EA" },
            ];

            const creditLimit = 10000;
            const creditUsed = 5400;
            const creditPctLoc = Math.round((creditUsed / creditLimit) * 100);

            return (
            <>
              {/* ─── Header Bar ─── */}
              {/* Status-tinted header background — same pattern as the partner detail header.
                  Inactive → amber wash, Archived → rose wash, Active → white. */}
              <div className={`shrink-0 rounded-t-none sm:rounded-t-2xl border-b ${
                loc.status === "inactive"
                  ? "bg-amber-50/50 border-amber-200"
                  : "bg-white border-[#EEF2F6]"
              }`}>
                <div className="px-3 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={handleCloseDetailModal} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer">
                      <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>{loc.name}</h2>
                        {/* Clickable status pill — same Popover pattern as the partner detail StatusPill. */}
                        {(() => {
                          const cur = locStatusConfig[loc.status] || locStatusConfig.active;
                          return (
                            <Popover open={locStatusDropdownOpen} onOpenChange={setLocStatusDropdownOpen}>
                              <PopoverTrigger asChild>
                                <button
                                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] gap-1 cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border whitespace-nowrap shrink-0"
                                  style={{ fontWeight: 500, backgroundColor: cur.bg, color: cur.color, borderColor: cur.border }}
                                >
                                  {cur.label}
                                  <ChevronDown className="w-2.5 h-2.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300]" onOpenAutoFocus={(e) => e.preventDefault()}>
                                <div className="space-y-1">
                                  {(["active", "inactive"] as const).map((s) => {
                                    const sc = locStatusConfig[s];
                                    const isCurrent = s === loc.status;
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => {
                                          if (!isCurrent) {
                                            setLocStatusChangeTarget(s);
                                            setLocStatusConfirmOpen(true);
                                            setLocStatusDropdownOpen(false);
                                          }
                                        }}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}
                                      >
                                        <span
                                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                                          style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}
                                        >
                                          {sc.label}
                                        </span>
                                        {isCurrent && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                        {/* Scope pills — Vendor (blue) / Customer (violet),
                            matching the partner-detail header palette.
                            Country chip removed per Eli — country still
                            lives on the address line below the title. */}
                        {loc.scope.includes("vendor") && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] shrink-0"
                            style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", borderColor: "#A8D2FF" }}
                          >
                            <Truck className="w-3 h-3" />
                            Vendor
                          </span>
                        )}
                        {loc.scope.includes("customer") && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] shrink-0"
                            style={{ fontWeight: 600, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }}
                          >
                            <ShoppingCart className="w-3 h-3" />
                            Customer
                          </span>
                        )}
                      </div>
                      {/* Phone dropped from the header — it already lives in the
                          Location Information sidebar card, so repeating it here
                          was redundant. */}
                      <div className="flex items-center gap-3 mt-0.5">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}, ${loc.country}`)}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-400 hover:text-primary hover:underline truncate transition-colors" style={{ fontWeight: 400 }}>{loc.address}, {loc.city}, {loc.state}{loc.country ? `, ${loc.country}` : ""}</a>
                      </div>
                    </div>
                  </div>
                  {/* Right CTAs — partner-detail order: Full screen · Actions menu · Edit · Close.
                      Archive moved into the Actions menu, plus same Activate/Deactivate, Copy
                      link, Upload, etc. items as the partner detail page. */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Full screen */}
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 500 }}>
                      {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {isFullScreen ? "Exit Full" : "Full View"}
                    </button>
                    {/* Actions menu — same shape as the partner detail's ActionsDropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm" style={{ fontWeight: 500 }}>
                          Actions
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6} className="z-[200] w-56 rounded-xl border border-border bg-white p-1 shadow-lg">
                        <DropdownMenuItem onClick={() => toast.info("Send Email coming soon")}>
                          <Mail className="w-4 h-4 mr-2 text-slate-500" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Purchase Order coming soon")}>
                          <ClipboardList className="w-4 h-4 mr-2 text-slate-500" />
                          Create Purchase Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Sales Order coming soon")}>
                          <FileText className="w-4 h-4 mr-2 text-slate-500" />
                          Create Sales Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Quote creation coming soon")}>
                          <FileUp className="w-4 h-4 mr-2 text-slate-500" />
                          Create Quote
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast.info("Note creation coming soon")}>
                          <StickyNote className="w-4 h-4 mr-2 text-slate-500" />
                          Add Note
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Upload coming soon")}>
                          <Upload className="w-4 h-4 mr-2 text-slate-500" />
                          Upload
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(appHref()); toast.success("Link copied to clipboard"); }}>
                          <Link2 className="w-4 h-4 mr-2 text-slate-500" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {loc.status === "active" && (
                          <DropdownMenuItem
                            onClick={() => { setLocStatusChangeTarget("inactive"); setLocStatusConfirmOpen(true); }}
                            className="focus:bg-amber-50"
                            style={{ color: "#B45309" }}
                          >
                            <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} />
                            Mark as Inactive
                          </DropdownMenuItem>
                        )}
                        {loc.status === "inactive" && (
                          <DropdownMenuItem
                            onClick={() => { setLocStatusChangeTarget("active"); setLocStatusConfirmOpen(true); }}
                            className="focus:bg-emerald-50"
                            style={{ color: "#059669" }}
                          >
                            <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} />
                            Mark as Active
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setLocArchiveDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-red-50">
                          <Archive className="w-4 h-4 mr-2 text-destructive" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Edit Location — opens the create-location modal in edit mode, pre-filled with this location */}
                    <button
                      onClick={() => {
                        setLocEditData({
                          locationName: loc.name,
                          phone: loc.phone,
                          email: loc.email,
                          address: `${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}, ${loc.country}`,
                          status: loc.status === "active" ? "Active" : "Inactive",
                          image: loc.image,
                          pocIds: Array.from(locSelectedPocIds),
                        });
                        setCreateLocationModalOpen(true);
                      }}
                      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit Location
                    </button>
                    <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />
                    {/* Close X */}
                    <button onClick={handleCloseDetailModal} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Body: single column tab layout. Sidebar removed
                    per stakeholder feedback — its content (contacts,
                    address, primary contact, credit) now lives in the
                    Overview tab body so the modal isn't a "full
                    module's worth" of UI in a dialog. */}
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">

                {/* Sidebar block kept here as a fallback render hidden
                    behind a never-true guard so the data references
                    (locLandline, locWebsite, creditUsed, etc.) still
                    type-check without a separate refactor of the data
                    sources. */}
                {false && (
                <div className="hidden">
                  {/* ── Metric Cards ── */}
                  <div className="px-3 pt-3.5 pb-1">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Contacts", value: String(loc.contacts), icon: Users, color: "rgb(var(--primary))", bg: "linear-gradient(135deg, #EBF3FF 0%, #CFE6FF 100%)" },
                        { label: "Items", value: String(loc.items), icon: Package, color: "rgb(var(--violet))", bg: "linear-gradient(135deg, #F0EBFF 0%, #E9DFFF 100%)" },
                        { label: "Centers", value: String(loc.serviceCenters), icon: Wrench, color: "rgb(var(--warning))", bg: "linear-gradient(135deg, #FEF5E7 0%, #FDE8C8 100%)" },
                      ].map((s) => (
                        <div key={s.label} className="relative rounded-xl border border-white/80 bg-white p-2.5 flex flex-col items-center gap-1.5 transition-all duration-200 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer group/metric" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover/metric:scale-110" style={{ background: s.bg }}>
                            <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                          </div>
                          <p className="text-[15px] text-slate-700" style={{ fontWeight: 700 }}>{s.value}</p>
                          <p className="text-[9px] text-slate-400 tracking-wider" style={{ fontWeight: 600 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Contact Details Card ── */}
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="rounded-xl bg-white border border-[#E8ECF1]/60 overflow-hidden" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04)" }}>
                      <div className="px-3 py-2 flex items-center gap-2 border-b border-muted">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#EBF3FF] to-blue-100 flex items-center justify-center">
                          <Phone className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <p className="text-[10px] text-slate-500 tracking-wider" style={{ fontWeight: 600 }}>Contact Details</p>
                      </div>
                      <div className="p-1.5">
                        {[
                          { icon: Mail, label: "Email", value: loc.email || "support@toyota.com" },
                          { icon: Phone, label: "Phone", value: loc.phone || "+1 327 899 3892" },
                          { icon: PhoneCall, label: "Landline", value: `${locLandline} ext.123` },
                          { icon: Globe, label: "Website", value: locWebsite },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg hover:bg-slate-50 transition-all duration-150 group/row cursor-pointer">
                            <div className="w-6 h-6 rounded-lg bg-slate-50 border border-muted flex items-center justify-center shrink-0 group-hover/row:bg-accent group-hover/row:border-blue-100 transition-all duration-150">
                              <item.icon className="w-3 h-3 text-[#B0BEC5] group-hover/row:text-primary transition-colors" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] text-[#B0BEC5] tracking-wide" style={{ fontWeight: 500 }}>{item.label}</p>
                              <p className="text-[11px] text-slate-800 truncate" style={{ fontWeight: 500 }}>{item.value}</p>
                            </div>
                            <ChevronRight className="w-3 h-3 text-border opacity-0 group-hover/row:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Address Card ── */}
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="rounded-xl bg-white border border-[#E8ECF1]/60 overflow-hidden" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04)" }}>
                      <div className="px-3 py-2 flex items-center gap-2 border-b border-muted">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#FEF5E7] to-[#FDE8C8] flex items-center justify-center">
                          <MapPin className="w-2.5 h-2.5 text-warning" />
                        </div>
                        <p className="text-[10px] text-slate-500 tracking-wider" style={{ fontWeight: 600 }}>Address</p>
                      </div>
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-50 to-muted border border-[#E8ECF1] flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-800" style={{ fontWeight: 600 }}>{loc.address}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{loc.city}, {loc.state} {loc.zipCode}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{loc.country}</p>
                          </div>
                        </div>
                        <button className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-border text-[10px] text-slate-400 hover:text-primary hover:border-blue-200 hover:bg-[#FAFCFF] transition-all duration-150 cursor-pointer" style={{ fontWeight: 500 }}>
                          <ExternalLink className="w-2.5 h-2.5" />
                          View on Map
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Primary Contact Card ── */}
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="rounded-xl bg-white border border-[#E8ECF1]/60 overflow-hidden transition-all duration-200 hover:border-blue-200/60 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.06)]" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04)" }}>
                      <div className="px-3 py-2 flex items-center gap-2 border-b border-muted">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#F0EBFF] to-[#E9DFFF] flex items-center justify-center">
                          <Users className="w-2.5 h-2.5 text-violet" />
                        </div>
                        <p className="text-[10px] text-slate-500 tracking-wider" style={{ fontWeight: 600 }}>Primary Contact</p>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] shrink-0" style={{ background: "linear-gradient(135deg, #EBF3FF 0%, #CFE6FF 100%)", color: "rgb(var(--primary))", fontWeight: 700 }}>IA</div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>Issac Archer</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Sales Department</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {[
                            { icon: Phone, value: "+1 327 899 3892" },
                            { icon: Mail, value: "irtaza.abid@toyota.com" },
                          ].map((c) => (
                            <div key={c.value} className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg bg-slate-50 border border-muted group/cinfo hover:bg-accent hover:border-blue-100 transition-all duration-150 cursor-pointer">
                              <c.icon className="w-3 h-3 text-[#B0BEC5] group-hover/cinfo:text-primary transition-colors shrink-0" />
                              <span className="text-[10px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>{c.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Credit Utilization Card ── */}
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="rounded-xl bg-white border border-[#E8ECF1]/60 overflow-hidden" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04)" }}>
                      <div className="px-3 py-2 flex items-center justify-between border-b border-muted">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: creditPctLoc > 80 ? "linear-gradient(135deg, #FEE2E2, #FECACA)" : creditPctLoc > 50 ? "linear-gradient(135deg, #FEF3C7, #FDE68A)" : "linear-gradient(135deg, #D1FAE5, #A7F3D0)" }}>
                            <DollarSign className="w-2.5 h-2.5" style={{ color: creditPctLoc > 80 ? "#EF4444" : creditPctLoc > 50 ? "rgb(var(--warning))" : "#10B981" }} />
                          </div>
                          <p className="text-[10px] text-slate-500 tracking-wider" style={{ fontWeight: 600 }}>Credit</p>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ fontWeight: 600, color: creditPctLoc > 80 ? "rgb(var(--destructive))" : creditPctLoc > 50 ? "rgb(var(--warning))" : "rgb(var(--success))", backgroundColor: creditPctLoc > 80 ? "#FEE2E2" : creditPctLoc > 50 ? "#FEF3C7" : "#D1FAE5" }}>{creditPctLoc > 80 ? "Critical" : creditPctLoc > 50 ? "Warning" : "Healthy"}</span>
                      </div>
                      <div className="p-3">
                        <div className="flex items-baseline justify-between mb-3">
                          <div>
                            <p className="text-[17px] text-slate-700" style={{ fontWeight: 700 }}>{pm.money(creditUsed)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 400 }}>of {pm.moneyText(creditLimit)} limit</p>
                          </div>
                          <p className="text-[20px]" style={{ fontWeight: 800, color: creditPctLoc > 80 ? "#EF4444" : creditPctLoc > 50 ? "#F59E0B" : "#10B981" }}>{creditPctLoc}%</p>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: creditPctLoc > 80 ? "#FEE2E2" : creditPctLoc > 50 ? "#FEF3C7" : "#D1FAE5" }}>
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${creditPctLoc}%`, background: creditPctLoc > 80 ? "linear-gradient(90deg, #F87171, #EF4444)" : creditPctLoc > 50 ? "linear-gradient(90deg, #FBBF24, #F59E0B)" : "linear-gradient(90deg, #34D399, #10B981)" }} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Available</span>
                          <span className="text-[11px] text-slate-800" style={{ fontWeight: 600 }}>{pm.moneyText(creditLimit - creditUsed)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Meta Footer ── */}
                  <div className="px-3 pt-2.5 pb-3.5 mt-auto">
                    <div className="rounded-xl bg-white/60 border border-[#E8ECF1]/40 p-3" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.02)" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: toAAAColor(loc.createdBy.bgColor), fontWeight: 700 }}>{loc.createdBy.initials}</div>
                          <div className="min-w-0">
                            <p className="text-[9px] text-[#B0BEC5]" style={{ fontWeight: 500 }}>Created By</p>
                            <p className="text-[10px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>{loc.createdBy.name}</p>
                          </div>
                        </div>
                        <div className="w-px h-6 bg-muted" />
                        <div className="text-right shrink-0">
                          <p className="text-[9px] text-[#B0BEC5]" style={{ fontWeight: 500 }}>Updated</p>
                          <p className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>{formatDate(loc.lastUpdated)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* ─── Single-column tab body ─── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white sm:rounded-b-2xl">
                  {/* Tabs row */}
                  <div className="flex items-center border-b border-[#E8ECF1] shrink-0">
                    <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide px-2">
                      {/* Tab labels only — count badges removed per stakeholder feedback
                          (created confusion when the badge number didn't match the actual
                          list contents on the tab body). */}
                      {LOC_TABS.map((t) => {
                        const active = locDetailTab === t.id;
                        const button = (
                          <button
                            key={t.id}
                            onClick={() => setLocDetailTab(t.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                              active ? "border-primary text-primary bg-white" : "border-transparent text-slate-400 hover:text-slate-500"
                            }`}
                            style={{ fontWeight: active ? 600 : 500 }}
                          >
                            {t.label}
                          </button>
                        );
                        // "Items They Sell" tab — surface the explanatory tooltip
                        // here (the sub-tab pill that used to host it inside
                        // PartnerItemsTab is hidden when lockSubTab is in effect,
                        // so the description needs a new home).
                        if (t.id === "items") {
                          return (
                            <Tooltip key={t.id}>
                              <TooltipTrigger asChild>{button}</TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-slate-500">Items where this partner is on the qualified-vendor list. They&apos;re one of the suppliers you&apos;re allowed to source these items from, not necessarily the only one.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                  <p className="text-[11px] text-slate-700 mt-1">Add a part here to add this partner as a <span className="text-[#0548A3]" style={{ fontWeight: 600 }}>qualified vendor</span> on that item&apos;s detail page.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return button;
                      })}
                    </div>
                  </div>

                  {/* ── Overview tab — replaces the right sidebar.
                        Two-column form layout with Contact Details +
                        Address on the left, Primary Contact + Credit on
                        the right. Compact, single body, no separate panel. */}
                  {/* ── Overview tab — renders the same DashboardTab the partner detail page uses, so
                       the location's Overview is visually identical to the partner Dashboard (charts,
                       widgets, right-side Partner Information / Financial Summary / Credit Limits cards).
                       Stakeholder feedback: "make it like the dashboard tab in the partner details page —
                       same visuals etc. here in the overview tab." A simpler header strip + location-scoped
                       KPI cards run above the DashboardTab body. */}
                  {locDetailTab === "overview" && (() => {
                    // Map of KPI key → computed value at runtime. Defs (label/icon/tooltip/category)
                    // come from LOC_OV_KPI_DEFS at component scope; values are computed here so they
                    // reflect the current location.
                    const locOverviewKpiValues: Record<string, string> = {
                      ov_contacts: String(loc.contacts || 0),
                      ov_items: String(loc.items || 0),
                      ov_centers: String(loc.serviceCenters || 0),
                      ov_carriers: String(LOC_VENDOR_CARRIERS.length + LOC_CUSTOMER_CARRIERS.length),
                      ov_credit: `${creditPctLoc}%`,
                      ov_orders_month: "23",
                      ov_on_time: "94.2%",
                      ov_returns: "2.1%",
                      ov_spend_month: formatCurrency(48250),
                      ov_avg_order: formatCurrency(2098),
                      ov_country: loc.country,
                      ov_status: loc.status === "active" ? "Active" : "Inactive",
                    };
                    const locOverviewKpiDefs = Object.fromEntries(LOC_OV_KPI_DEFS.map((d) => [d.key, { ...d, value: locOverviewKpiValues[d.key] || "—" }])) as Record<string, { key: string; label: string; iconName: string; category: string; tooltip: string; value: string }>;

                    return (
                      <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
                        {/* Header strip — Overview · Updated · Refresh + Reset / Customize Widgets */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Overview</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>Updated {format(locOvLastRefreshed, "h:mm a")}</span>
                            <button
                              onClick={handleLocOvRefresh}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D4] transition-colors cursor-pointer"
                              style={{ fontWeight: 500 }}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Refresh
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleLocOvResetLayout}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
                              style={{ fontWeight: 500 }}
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocOvCustomizeOpen(true)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
                              style={{ fontWeight: 500 }}
                            >
                              <Sliders className="w-3.5 h-3.5 text-slate-400" />
                              Customize Widgets
                            </button>
                          </div>
                        </div>

                        {/* Location-scoped KPI strip — same visual as the partner Dashboard's KPI cards
                            (label · info tooltip · value · KPI icon · remove on hover). DnD reorder is
                            intentionally omitted because the parent `partner_locations` tab already mounts
                            an HTML5 DnD backend, and react-dnd doesn't allow two HTML5 backends at once. */}
                        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                          {locOvKpiOrder.map((kpiKey) => {
                            const def = locOverviewKpiDefs[kpiKey];
                            if (!def) return null;
                            return (
                              <div
                                key={kpiKey}
                                className="group border rounded-lg bg-white relative min-w-0 transition-all duration-200 select-none overflow-hidden border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
                              >
                                <div className="px-3 py-2">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{def.label}</p>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" className="inline-flex shrink-0" tabIndex={-1}>
                                            <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-[11px] z-[300]">{def.tooltip}</TooltipContent>
                                      </Tooltip>
                                    </div>
                                    <DashKpiIcon name={def.iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                                  </div>
                                  <div className="flex items-baseline gap-1.5">
                                    <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{def.value}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleLocOvToggleKpi(kpiKey)}
                                  className="absolute bottom-1 right-1 w-6 h-6 rounded-md text-slate-400 hover:bg-red-100 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
                                  title={`Remove ${def.label}`}
                                  aria-label={`Remove ${def.label} KPI`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Two-column body — mirrors the partner Dashboard tab's layout (left: chart
                            widgets, right: info cards). DashboardTab itself isn't reused here because
                            it brings its own DnD provider which conflicts with the partner_locations
                            tab's DnD provider above the modal. The widgets below use the same Recharts
                            visuals (SPEND_TREND_DATA / ORDER_ACTIVITY_DATA) and the same DashInfoCard
                            sidebar treatment so the surface still reads as the partner Dashboard. */}
                        <div className="flex gap-5 items-start">
                          <div className="flex-1 min-w-0 flex flex-wrap gap-3 items-stretch">
                            {/* Widgets render in user-controlled order (locOvActiveWidgets is
                                an ordered array). Each non-sidebar widget is wrapped in
                                DraggableWidgetCard so it participates in the parent tab's
                                react-dnd backend — same WIDGET_DND_TYPE the partner Dashboard
                                widgets use, so the UX matches. The primary_contact widget is
                                skipped here because it lives in the right rail. */}
                            {locOvActiveWidgets.map((key, idx) => {
                              if (key === "primary_contact") return null;
                              const sz = locOvWidgetSizes[key] || "md";
                              const chartH = sz === "sm" ? 140 : sz === "lg" ? 280 : 200;
                              const widthVal = sz === "sm" ? "calc(50% - 6px)" : "100%";
                              const sizeProps = {
                                currentSize: sz,
                                onSizeChange: (s: "sm" | "md" | "lg") => handleLocOvWidgetSize(key, s),
                                onRemove: () => handleLocOvToggleWidget(key),
                              } as const;

                              // Per-widget period — defaults to "1y" so the chart
                              // continues to show the full Jan–Dec curve users are
                              // used to. Trend widgets (monthly data) slice by month
                              // count; activity widgets (daily data) slice by day
                              // count or scale the visible week proportionally.
                              const period: LocOvWidgetPeriod = locOvWidgetPeriods[key] ?? "1y";
                              const periodLabel = LOC_OV_PERIOD_OPTIONS.find((o) => o.key === period)?.label ?? "Last Year";
                              const periodAction = (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:bg-slate-50 hover:text-foreground transition-colors cursor-pointer"
                                      style={{ fontWeight: 500 }}
                                    >
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      <span>{periodLabel}</span>
                                      <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[170px]" onClick={(e) => e.stopPropagation()}>
                                    {LOC_OV_PERIOD_OPTIONS.map((opt) => (
                                      <DropdownMenuItem
                                        key={opt.key}
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handleLocOvWidgetPeriodChange(key, opt.key); }}
                                      >
                                        <span className="text-sm">{opt.label}</span>
                                        {period === opt.key && (
                                          <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );

                              let body: React.ReactNode = null;
                              let title = "";
                              let icon: React.ElementType = TrendingUp;
                              let tooltipCopy = "";

                              if (key === "po_spend_trend" || key === "so_spend_trend") {
                                const isSo = key === "so_spend_trend";
                                // Re-bucket the x-axis to the selected window — 7d
                                // renders day-on-day, 30d week-on-week (whatever
                                // calendar weeks fall inside the last 30 days), 90d
                                // month-on-month clipped to the window. 1y/all keep
                                // the full Jan–Dec curve; "custom" stays at 1y until
                                // the date-range picker ships. Hover surfaces each
                                // bucket's actual date range so clipped edge buckets
                                // read unambiguously. Values stay deterministic off
                                // the monthly baseline until the analytics feed lands.
                                let baseSeries: { month: string; range?: string; amount: number }[];
                                if (period === "7d" || period === "30d" || period === "90d") {
                                  const monthlyAvg = SPEND_TREND_DATA.reduce((s, d) => s + d.amount, 0) / SPEND_TREND_DATA.length;
                                  const unitBase = period === "7d" ? monthlyAvg / 30 : period === "30d" ? (monthlyAvg * 12) / 52 : monthlyAvg;
                                  baseSeries = buildPeriodBuckets(period).map((b, i) => {
                                    // 90d buckets are real calendar months — reuse the
                                    // baseline month's amount (scaled by the clipped
                                    // fraction) so the curve matches the 1y view.
                                    const monthAmt = period === "90d" ? SPEND_TREND_DATA.find((m) => m.month === b.label)?.amount : undefined;
                                    return { month: b.label, range: b.range, amount: Math.round((monthAmt ?? unitBase * bucketWobble(i)) * b.weight) };
                                  });
                                } else {
                                  baseSeries = SPEND_TREND_DATA;
                                }
                                const data = isSo
                                  ? baseSeries.map((d) => ({ ...d, amount: Math.round(d.amount * 0.62) }))
                                  : baseSeries;
                                const stroke = isSo ? "#059669" : "rgb(var(--primary))";
                                const gradId = isSo ? "locOvSoSpendGrad" : "locOvPoSpendGrad";
                                const gradStop = isSo ? "#059669" : "rgb(var(--primary))";
                                const seriesLabel = isSo ? "SO Revenue" : "PO Spend";
                                const footnote = isSo ? "Inflow from this location (SOs we ship to them)" : "Outflow to this location (POs we issue)";
                                title = isSo ? "Sales Order Revenue Trend" : "Purchase Order Cost Trend";
                                icon = TrendingUp;
                                tooltipCopy = isSo
                                  ? "Money this location pays us, summed by month, across the sales orders we fulfill to them (them → us). Use the period selector to widen or narrow the snapshot."
                                  : "Money we pay this location, summed by month, across the purchase orders we issue (we → them). Use the period selector to widen or narrow the snapshot.";
                                body = (
                                  <div className="px-3.5 py-3">
                                    <div style={{ height: chartH }} className="-ml-2">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                          <defs>
                                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor={gradStop} stopOpacity={0.15} />
                                              <stop offset="100%" stopColor={gradStop} stopOpacity={0.01} />
                                            </linearGradient>
                                          </defs>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={pm.axis} />
                                          <ReTooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }} formatter={(val: number) => [pm.moneyText(val), seriesLabel]} labelFormatter={(label, payload) => (payload?.[0]?.payload as { range?: string })?.range ?? label} />
                                          <Area type="monotone" dataKey="amount" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="flex items-end justify-between gap-4 mt-2 pt-2 border-t border-muted">
                                      <div className="flex items-center gap-4 flex-wrap">
                                        <div><p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{periodLabel} Total</p><p className="text-[13px]" style={{ fontWeight: 700, color: "#334155" }}>{formatCurrency(data.reduce((s, d) => s + d.amount, 0))}</p></div>
                                        <div><p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{period === "7d" ? "Daily Avg" : period === "30d" ? "Weekly Avg" : "Monthly Avg"}</p><p className="text-[13px]" style={{ fontWeight: 700, color: "#334155" }}>{formatCurrency(Math.round(data.reduce((s, d) => s + d.amount, 0) / Math.max(1, data.length)))}</p></div>
                                      </div>
                                      <span className="text-[11px] text-slate-400 text-right max-w-[180px]" style={{ fontWeight: 500 }}>{footnote}</span>
                                    </div>
                                  </div>
                                );
                              } else if (key === "po_order_activity" || key === "so_order_activity") {
                                const isSo = key === "so_order_activity";
                                // The x-axis re-buckets to match the selected window —
                                // same behavior as the trend widgets above: 7d renders
                                // the trailing week day-on-day, 30d the calendar weeks
                                // falling inside the window, 90d the calendar months
                                // falling inside it (edge buckets clipped — hover shows
                                // each bucket's actual date range), 1y/all the full
                                // Jan–Dec spread. Bucket volumes derive deterministically
                                // from the weekly baseline until the real activity feed
                                // lands.
                                const weekOrders = ORDER_ACTIVITY_DATA.reduce((s, d) => s + d.orders, 0);
                                const weekReturns = ORDER_ACTIVITY_DATA.reduce((s, d) => s + d.returns, 0);
                                let data: { label: string; range?: string; orders: number; returns: number }[];
                                if (period === "7d") {
                                  data = buildPeriodBuckets("7d").map((b, i) => {
                                    const src = ORDER_ACTIVITY_DATA.find((d) => d.day === b.label) ?? ORDER_ACTIVITY_DATA[i % 7];
                                    return { label: b.label, range: b.range, orders: src.orders, returns: src.returns };
                                  });
                                } else if (period === "30d") {
                                  data = buildPeriodBuckets("30d").map((b, i) => ({
                                    label: b.label,
                                    range: b.range,
                                    orders: Math.max(1, Math.round(weekOrders * b.weight * bucketWobble(i))),
                                    returns: Math.round(weekReturns * b.weight * bucketWobble(i + 2)),
                                  }));
                                } else {
                                  const monthOrders = (weekOrders * 52) / 12;
                                  const monthReturns = (weekReturns * 52) / 12;
                                  if (period === "90d") {
                                    data = buildPeriodBuckets("90d").map((b, i) => ({
                                      label: b.label,
                                      range: b.range,
                                      orders: Math.max(1, Math.round(monthOrders * b.weight * bucketWobble(i))),
                                      returns: Math.round(monthReturns * b.weight * bucketWobble(i + 3)),
                                    }));
                                  } else {
                                    data = SPEND_TREND_DATA.map((m, i) => ({
                                      label: m.month,
                                      orders: Math.max(1, Math.round(monthOrders * bucketWobble(i))),
                                      returns: Math.round(monthReturns * bucketWobble(i + 3)),
                                    }));
                                  }
                                }
                                if (isSo) data = data.map((d) => ({ ...d, orders: Math.max(1, Math.round(d.orders * 0.7)), returns: Math.round(d.returns * 0.8) }));
                                const ordersColor = isSo ? "#059669" : "rgb(var(--primary))";
                                const ordersLabel = isSo ? "SOs Shipped" : "POs Issued";
                                const footnote = isSo
                                  ? "Outbound from us (SOs); returns flow back from this location"
                                  : "Outbound to this location (POs); returns flow back to us";
                                title = isSo ? "Sale Order Activity" : "Purchase Order Activity";
                                icon = BarChart3;
                                tooltipCopy = isSo
                                  ? "Sales orders we shipped to this location across the selected period, with items they returned back to us. Period selector scopes the snapshot."
                                  : "Purchase orders we issued to this location across the selected period, with items they returned back to us. Period selector scopes the snapshot.";
                                body = (
                                  <div className="px-3.5 py-3">
                                    <div style={{ height: chartH }} className="-ml-2">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                                          <ReTooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }} labelFormatter={(label, payload) => (payload?.[0]?.payload as { range?: string })?.range ?? label} />
                                          <Bar dataKey="orders" fill={ordersColor} radius={[4, 4, 0, 0]} barSize={data.length > 7 ? 12 : 24} name={ordersLabel} />
                                          <Bar dataKey="returns" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={data.length > 7 ? 12 : 24} name="Returns" />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="flex items-end justify-between gap-4 mt-2 pt-2 border-t border-muted">
                                      <div className="flex items-center gap-4 flex-wrap">
                                        <div><p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{periodLabel}</p><p className="text-[13px]" style={{ fontWeight: 700, color: "#334155" }}>{data.reduce((s, d) => s + d.orders, 0)} {isSo ? "SOs" : "POs"}</p></div>
                                        <div><p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Returns</p><p className="text-[13px]" style={{ fontWeight: 700, color: "#F59E0B" }}>{data.reduce((s, d) => s + d.returns, 0)}</p></div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ordersColor }} /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{ordersLabel}</span></div>
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Returns</span></div>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>{footnote}</p>
                                  </div>
                                );
                              } else {
                                // Unknown / not-yet-implemented widget key — skip so we don't
                                // blow up if a stale entry lands in locOvActiveWidgets.
                                return null;
                              }

                              // NOTE: drag-to-reorder is intentionally omitted here.
                              // The location modal is portaled out of the parent
                              // tab's DndProvider scope, and adding a second
                              // HTML5Backend inside the modal crashes react-dnd
                              // (only one backend may be active at a time — see
                              // the comment on DashboardTab's noDnd prop). Order
                              // here is still controllable via the Customize
                              // Widgets drawer toggles. Revisit when the parent
                              // tab's DnD provider is hoisted to also cover the
                              // location modal mount.
                              return (
                                <div key={key} style={{ width: widthVal }} className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                                  <ContentCard
                                    title={title}
                                    icon={icon}
                                    tooltip={tooltipCopy}
                                    action={periodAction}
                                    {...sizeProps}
                                  >
                                    {body}
                                  </ContentCard>
                                </div>
                              );
                            })}
                          </div>

                          {/* ═══ RIGHT SIDEBAR — Information cards (matches partner Dashboard's right column) ═══
                              Not sticky: scrolls in normal flow with the widgets so one
                              scroll moves the whole Overview together — same fix as the
                              partner details Dashboard sidebar. */}
                          <div className="w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4">
                            <DashInfoCard title="Location Information" icon={Building2}>
                              <div className="mb-3">
                                <DashInfoLabel>Partner</DashInfoLabel>
                                <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{vendor.companyName}</p>
                              </div>
                              <div className="mb-3">
                                <DashInfoLabel>Status</DashInfoLabel>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px]" style={{ fontWeight: 500, backgroundColor: loc.status === "active" ? "#ECFDF5" : "#FFFBEB", color: loc.status === "active" ? "#065F46" : "#92400E", borderColor: loc.status === "active" ? "#A7F3D0" : "#FDE68A" }}>
                                    {loc.status === "active" ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
                                <div className="min-w-0">
                                  <DashInfoLabel>Phone</DashInfoLabel>
                                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{loc.phone || "—"}</p>
                                </div>
                                <div className="min-w-0">
                                  <DashInfoLabel>Email</DashInfoLabel>
                                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{loc.email || "—"}</p>
                                </div>
                              </div>
                              {/* Country + Zip Code dropped per Eli — the
                                  full address line below already carries
                                  both (city, country, zip), so the
                                  separate fields were duplicative. */}
                              <div className="mb-2.5">
                                <DashInfoLabel>Address</DashInfoLabel>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}, ${loc.country}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] text-slate-700 hover:text-primary hover:underline transition-colors block"
                                  style={{ fontWeight: 500 }}
                                >
                                  {loc.address}, {loc.city}{loc.state ? `, ${loc.state}` : ""} {loc.zipCode}, {loc.country}
                                </a>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 pt-2.5 border-t border-muted">
                                <div className="min-w-0">
                                  <DashInfoLabel>Created By</DashInfoLabel>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] shrink-0 overflow-hidden border border-[#E8ECF1]"
                                      style={{ backgroundColor: loc.createdBy.photo ? "transparent" : loc.createdBy.bgColor }}
                                    >
                                      {loc.createdBy.photo ? (
                                        <img src={loc.createdBy.photo} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span style={{ color: loc.createdBy.fgColor || "#334155", fontWeight: 700 }}>{loc.createdBy.initials}</span>
                                      )}
                                    </div>
                                    <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{loc.createdBy.name}</span>
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <DashInfoLabel>Last Updated</DashInfoLabel>
                                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{formatDate(loc.lastUpdated)}</p>
                                </div>
                              </div>
                            </DashInfoCard>

                            {(() => {
                              const locTotalCashIn = Math.round(vendor.totalSpent * 0.45);
                              const locTotalCashOut = Math.round(vendor.totalSpent * 0.52);
                              return (
                                <DashInfoCard title="Financial Summary" icon={Wallet} tooltip="Financial overview including currency, cash flow, and outstanding obligations for this location.">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
                                    <div className="min-w-0">
                                      <DashInfoLabel tooltip="Set on the partner; every location uses it.">Currency</DashInfoLabel>
                                      <p className="text-[12px] text-slate-700 flex items-center gap-1.5 min-w-0" style={{ fontWeight: 600 }}>
                                        <CurrencyFlag code={currencyInfo.code} />
                                        <span className="truncate">{getCurrency(currencyInfo.code)?.name ?? currencyInfo.code} ({getCurrency(currencyInfo.code)?.symbol ?? currencyInfo.code})</span>
                                      </p>
                                    </div>
                                    <div className="min-w-0">
                                      <DashInfoLabel>Pay To</DashInfoLabel>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                                          <Globe className="w-3 h-3 text-slate-500" />
                                        </div>
                                        <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.companyName}</span>
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <DashInfoLabel>Ship To</DashInfoLabel>
                                      <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
                                        {loc.address || "—"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="border-t border-muted pt-3 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-x-4">
                                      <div className="min-w-0">
                                        <DashInfoLabel tooltip="Money this location paid us, receipts on our sales orders fulfilled to them (them → us).">Cash Inflow</DashInfoLabel>
                                        <p className="text-[15px] text-success" style={{ fontWeight: 700 }}>{pm.money(locTotalCashIn)}</p>
                                      </div>
                                      <div className="min-w-0">
                                        <DashInfoLabel tooltip="Money we paid this location, disbursements on our purchase orders issued to them (we → them).">Cash Outflow</DashInfoLabel>
                                        <p className="text-[15px] text-destructive" style={{ fontWeight: 700 }}>{pm.money(locTotalCashOut)}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 mb-px">
                                      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding Payables</p>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <p className="text-[15px] text-slate-700" style={{ fontWeight: 700 }}>{pm.money(vendor.outstandingBalance || 0)}</p>
                                      <button className="text-[11px] text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>Invoice Details</button>
                                    </div>
                                  </div>
                                </DashInfoCard>
                              );
                            })()}

                            {/* Primary Contact — third card on the right rail. Wired
                                to the Customize Widgets drawer (primary_contact key)
                                so users can toggle it off if the location has none.
                                Same DashInfoCard shell as Location Information and
                                Financial Summary so the rail reads as one stack. */}
                            {locOvActiveWidgets.includes("primary_contact") && (() => {
                              const primary = loc.pocNames[0];
                              if (!primary) {
                                return (
                                  <DashInfoCard title="Primary Contact" icon={Users}>
                                    <p className="text-[12px] text-slate-500 italic" style={{ fontWeight: 500 }}>
                                      No primary contact set for this location yet.
                                    </p>
                                  </DashInfoCard>
                                );
                              }
                              const emailLocal = primary.name.toLowerCase().replace(/\s+/g, ".");
                              return (
                                <DashInfoCard
                                  title="Primary Contact"
                                  icon={Users}
                                  tooltip="Main point of contact for this location, set on the Points of Contact tab."
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#E8ECF1]"
                                      style={{ backgroundColor: primary.photo ? "transparent" : primary.bgColor }}
                                    >
                                      {primary.photo
                                        ? <img src={primary.photo} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center text-[12px]" style={{ color: primary.fgColor || "#334155", fontWeight: 700 }}>{primary.initials}</div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{primary.name}</p>
                                        <Star className="w-3 h-3 fill-blue-600 text-blue-600 shrink-0" aria-label="Primary contact" />
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">Sales Department</p>
                                    </div>
                                  </div>
                                  <div className="mt-3 space-y-1.5">
                                    {[
                                      { icon: Phone, value: loc.phone || "+1 327 899 3892" },
                                      { icon: Mail, value: `${emailLocal}@company.com` },
                                    ].map((c) => (
                                      <div key={c.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-50 border border-border">
                                        <c.icon className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="text-[11px] text-slate-600 truncate" style={{ fontWeight: 500 }}>{c.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </DashInfoCard>
                              );
                            })()}

                          </div>
                        </div>

                        {/* Customize Widgets drawer — slides from the right with KPI / Widget tabs.
                            Mirrors the partner Dashboard's DashboardCustomizePanel structure (search +
                            tab bar + categorized sections + Enable All) scoped to the location's defs. */}
                        {(() => {
                          const q = locOvCustomizeSearch.trim().toLowerCase();
                          const filteredKpis = LOC_OV_KPI_DEFS.filter((d) => !q || d.label.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
                          const filteredWidgets = LOC_OV_WIDGET_DEFS.filter((d) => !q || d.label.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
                          const kpiCategories = Array.from(new Set(filteredKpis.map((d) => d.category)));
                          const widgetCategories = Array.from(new Set(filteredWidgets.map((d) => d.category)));
                          const allKpisActive = LOC_OV_KPI_DEFS.every((d) => locOvKpiOrder.includes(d.key));
                          const allWidgetsActive = LOC_OV_WIDGET_DEFS.every((d) => locOvActiveWidgets.includes(d.key));
                          const onTab = locOvCustomizeTab;
                          const handleEnableAll = () => {
                            if (onTab === "kpis") {
                              if (allKpisActive) LOC_OV_KPI_DEFS.forEach((d) => locOvKpiOrder.includes(d.key) && handleLocOvToggleKpi(d.key));
                              else LOC_OV_KPI_DEFS.filter((d) => !locOvKpiOrder.includes(d.key)).forEach((d) => handleLocOvToggleKpi(d.key));
                            } else {
                              if (allWidgetsActive) LOC_OV_WIDGET_DEFS.forEach((d) => locOvActiveWidgets.includes(d.key) && handleLocOvToggleWidget(d.key));
                              else LOC_OV_WIDGET_DEFS.filter((d) => !locOvActiveWidgets.includes(d.key)).forEach((d) => handleLocOvToggleWidget(d.key));
                            }
                          };
                          const tabAllActive = onTab === "kpis" ? allKpisActive : allWidgetsActive;
                          const tabActiveCount = onTab === "kpis" ? locOvKpiOrder.length : locOvActiveWidgets.length;
                          const tabTotalCount = onTab === "kpis" ? LOC_OV_KPI_DEFS.length : LOC_OV_WIDGET_DEFS.length;
                          if (!locOvCustomizeMounted) return null;
                          // Portal to document.body so the drawer escapes the location modal's
                          // transform/overflow stacking context and pins to the viewport edges
                          // (not the modal's right edge).
                          return createPortal(
                          <>
                            {/* Backdrop — z below drawer so clicks on the drawer area never reach it */}
                            <div
                              data-loc-customize-drawer="true"
                              className="fixed inset-0 z-[300] transition-opacity duration-[250ms] ease-in-out"
                              style={{ backgroundColor: locOvCustomizeVisible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: locOvCustomizeVisible ? "auto" : "none" }}
                              onClick={() => setLocOvCustomizeOpen(false)}
                            />
                            {/* Drawer — z higher than backdrop, stop click propagation as belt-and-suspenders */}
                            <div
                              data-loc-customize-drawer="true"
                              className="fixed right-0 top-0 bottom-0 z-[310] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
                              style={{ transform: locOvCustomizeVisible ? "translateX(0)" : "translateX(100%)", pointerEvents: "auto" }}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {/* Header */}
                              <div className="px-5 pt-5 pb-0 shrink-0">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgb(var(--accent))" }}>
                                      <Sliders className="w-5 h-5" style={{ color: "rgb(var(--primary))" }} />
                                    </div>
                                    <div>
                                      <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Widgets</h2>
                                      <p className="text-[13px] text-muted-foreground mt-0.5">Manage KPIs and widgets on this location's Overview.</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setLocOvCustomizeOpen(false)}
                                    className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
                                  >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </div>
                                {/* Toggle all */}
                                <div className="flex items-center justify-between mt-4 px-1">
                                  <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{tabActiveCount} of {tabTotalCount} {onTab === "kpis" ? "KPIs" : "widgets"} active</span>
                                  <button
                                    onClick={handleEnableAll}
                                    className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                                      tabAllActive
                                        ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                                        : tabActiveCount === 0
                                          ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                                          : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
                                    }`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    {tabAllActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                                    <span>{tabAllActive ? "All On" : tabActiveCount === 0 ? "All Off" : "Enable All"}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Search */}
                              <div className="px-5 pt-3.5 pb-0 shrink-0">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                                  <input
                                    placeholder="Search metrics..."
                                    value={locOvCustomizeSearch}
                                    onChange={(e) => setLocOvCustomizeSearch(e.target.value)}
                                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
                                  />
                                </div>
                              </div>

                              {/* Tab bar */}
                              <div className="flex items-center gap-0 px-5 border-b border-muted shrink-0 mt-3">
                                {(["kpis", "widgets"] as const).map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => setLocOvCustomizeTab(t)}
                                    className={`px-4 py-2.5 border-b-2 text-[13px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                                      locOvCustomizeTab === t
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                    }`}
                                    style={{ fontWeight: locOvCustomizeTab === t ? 600 : 400 }}
                                  >
                                    {t === "kpis" ? "KPIs" : "Widgets"}
                                  </button>
                                ))}
                              </div>

                              {/* Scrollable content — same KPI / Widget card structure as the partner Dashboard */}
                              <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
                                {locOvCustomizeTab === "kpis" ? (
                                  kpiCategories.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-muted-foreground">
                                      <Search className="w-5 h-5 mb-2 opacity-40" />
                                      <p className="text-xs text-muted-foreground/60">No metrics found</p>
                                    </div>
                                  ) : kpiCategories.map((cat) => {
                                    const CatIcon = cat === "Financial" ? DollarSign : cat === "Operational" ? Activity : Globe;
                                    return (
                                      <div key={cat} className="mt-5 first:mt-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <CatIcon className="w-4 h-4 text-muted-foreground" />
                                          <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          {filteredKpis.filter((d) => d.category === cat).map((def) => {
                                            const active = locOvKpiOrder.includes(def.key);
                                            return (
                                              <button
                                                key={def.key}
                                                type="button"
                                                onClick={() => handleLocOvToggleKpi(def.key)}
                                                className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                                                  active
                                                    ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                                    : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-1">
                                                  <span className={`text-[11px] truncate transition-colors ${active ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={def.label}>{def.label}</span>
                                                  <div className="shrink-0">
                                                    {active ? <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                                                  </div>
                                                </div>
                                                <p className={`text-[15px] mt-1 transition-colors ${active ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>{locOverviewKpiValues[def.key] || "—"}</p>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  widgetCategories.length === 0 ? (
                                    <div className="flex flex-col items-center py-12 text-muted-foreground">
                                      <Search className="w-5 h-5 mb-2 opacity-40" />
                                      <p className="text-xs text-muted-foreground/60">No widgets found</p>
                                    </div>
                                  ) : widgetCategories.map((cat) => {
                                    const CatIcon = cat === "Performance" ? ChartColumn : cat === "Operational" ? Activity : cat === "People" ? FileText : Sliders;
                                    return (
                                      <div key={cat} className="mt-5 first:mt-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <CatIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                                          <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2.5">
                                          {filteredWidgets.filter((d) => d.category === cat).map((def) => {
                                            const active = locOvActiveWidgets.includes(def.key);
                                            const sz = locOvWidgetSizes[def.key] || "md";
                                            return (
                                              <button
                                                key={def.key}
                                                type="button"
                                                onClick={() => handleLocOvToggleWidget(def.key)}
                                                className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                                                  active
                                                    ? "border-primary/30 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                                    : "border-border/60 bg-white hover:border-border hover:shadow-sm"
                                                }`}
                                              >
                                                <div className={`h-[68px] flex items-center justify-center transition-colors ${active ? "bg-[#F8FAFF]" : "bg-slate-50"}`}>
                                                  <PartnerWidgetVisual type={def.visual} isActive={active} />
                                                </div>
                                                <div className="absolute top-1.5 right-1.5">
                                                  {active ? (
                                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                    </div>
                                                  ) : (
                                                    <div className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center group-hover:border-slate-300 transition-colors">
                                                      <Plus className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="px-3 py-2.5 border-t border-muted">
                                                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }} title={def.label}>{def.label}</p>
                                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={def.description}>{def.description}</p>
                                                  {active && (
                                                    <div className="mt-2 flex items-center h-6 rounded-md border border-border bg-slate-50 p-0.5 gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                      {(["sm", "md", "lg"] as const).map((s) => (
                                                        <button
                                                          key={s}
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); handleLocOvWidgetSize(def.key, s); }}
                                                          className={`flex-1 h-5 rounded text-[10px] transition-all duration-150 cursor-pointer ${
                                                            sz === s ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-700"
                                                          }`}
                                                          style={{ fontWeight: sz === s ? 600 : 500 }}
                                                        >
                                                          {({ sm: "SM", md: "MD", lg: "LG" } as const)[s as "sm" | "md" | "lg"]}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Footer */}
                              <div className="px-5 py-3 border-t border-border bg-slate-50/40 flex items-center justify-between shrink-0">
                                <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Use Reset to restore defaults</p>
                                <button
                                  type="button"
                                  onClick={() => setLocOvCustomizeOpen(false)}
                                  className="inline-flex items-center h-8 px-3 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer transition-colors"
                                  style={{ fontWeight: 600 }}
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          </>,
                          document.body
                          );
                        })()}

                      </div>
                    );
                  })()}

                  {/* ── Point of Contacts tab — embedded Contacts Directory scoped to this location.
                       Reuses ContactsDirectoryPage with the same toolbar / column set as the partner-detail
                       global_contacts tab so the table reads identically across both surfaces. The primary
                       contact for this location is marked with a Primary pill (with tooltip) next to its
                       name. */}
                  {locDetailTab === "poc" && (() => {
                    const locSelectedContacts = locContactDictionary.filter((c) => locSelectedPocIds.has(c.id));
                    // Primary POC: explicit override per location, else fall back to the first selected contact.
                    const primaryLocContactId = locPrimaryByLoc[loc.id] || locSelectedContacts[0]?.id;
                    return (
                      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <ContactsDirectoryPage
                          embedded
                          flush
                          defaultDensity="card"
                          embeddedContacts={locSelectedContacts}
                          primaryContactId={primaryLocContactId}
                          primaryContactTooltip={`Primary point of contact for ${loc.name}`}
                          onSetPrimaryContact={(id, name) => setLocPrimaryChangeTarget({ id, name })}
                          /* Stakeholder feedback: strip down to Contact / Title / Company /
                             Phone / Email / Status. Drop Department, Social, Linked
                             Partners, Linked Entities, Created By, Created On from default. */
                          defaultVisibleColumns={["contact_name", "role", "company", "phones", "emails", "status"]}
                          embeddedToolbarRight={
                              <>
                                <button
                                  type="button"
                                  onClick={handleLocOpenSelectModal}
                                  className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer text-foreground"
                                  style={{ fontWeight: 500 }}
                                >
                                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm hidden md:inline">Contact Directory</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleLocOpenCreate}
                                  className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-sm shadow-sm transition-colors cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Create New Contact</span>
                                  <span className="sm:hidden">New</span>
                                </button>
                              </>
                            }
                          />
                      </div>
                    );
                  })()}

                  {/* ── Items tab — Items They Sell + Purchased
                       Transactions only. Per stakeholder feedback,
                       Items They Buy doesn't make sense at a location
                       level: buyer access is rarely location-specific
                       (Home Depot doesn't get a different approved-buyer
                       list per store), and "items they buy" for most
                       tenants resolves to the full catalog (28k+ SKUs
                       for FR Conversions). The approved-buyer / purchase
                       history surfaces stay at the partner level. The
                       location modal also drops the Sold transaction
                       direction since the inverse perspective is a
                       partner-level rollup, not location-specific. */}
                  {locDetailTab === "items" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                      {/* lockSubTab="sell" drops the inner Items They Sell |
                          Transactions pill strip — Transactions is its own
                          top-level location tab now, so the sub-pill
                          duplicated nav. With lockSubTab set, the Add CTA
                          moves into the toolbar row next to the Columns
                          selector (PartnerItemsTab handles that swap). */}
                      <PartnerItemsTab vendor={vendor} flush locationView lockSubTab="sell" locationName={selectedLocation?.name} />
                    </div>
                  )}

                  {/* ── Transactions tab — same Items component locked to the
                       Transactions sub-tab. locationView caps Sales/Returns
                       as coming-soon (Purchased is the only side with data
                       at the location scope this push). */}
                  {locDetailTab === "transactions" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <PartnerItemsTab vendor={vendor} flush locationView lockSubTab="transactions" />
                    </div>
                  )}

                  {/* ── Freight & Logistics tab — embeds the partner-detail FreightLogisticsTab edge-to-edge.
                       Renamed from "Carrier & Shipping" so the location modal mirrors the partner detail
                       label and visual layout exactly. */}
                  {locDetailTab === "carrier_shipping" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <FreightLogisticsTab vendor={vendor} flush locationName={selectedLocation?.name} />
                    </div>
                  )}

                  {/* Pricing Rules tab removed at location level (architecture lockdown) —
                      pricing has no location-based component for the Pioneer scope; promotional
                      / regional pricing remains a Partner-level concern. */}

                  {/* ── Service Center (Coming Soon with animation) ── */}
                  {/* ── Service Centers tab — Coming Soon. Reuses the canonical PlaceholderTab so the
                       animation, "Coming Soon" pill, and copy match the partner detail page exactly. */}
                  {locDetailTab === "service_centers" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4 bg-slate-50">
                      <PlaceholderTab
                        label="Service Centers"
                        description="Manage service centers attached to this location, facilities providing maintenance, repair, or after-sales service. This feature is currently under development."
                        icon={Wrench}
                      />
                    </div>
                  )}

                  {/* ── Notes tab — Coming Soon (canonical PlaceholderTab). */}
                  {locDetailTab === "notes" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4 bg-slate-50">
                      <PlaceholderTab
                        label="Notes"
                        description="Free-text notes against this location are being designed alongside the partner-activity feed. Once it lands, this tab will surface a chronological notes list with @-mentions, attachments, and per-note visibility controls."
                        icon={FileText}
                      />
                    </div>
                  )}

                  {/* ── Partner Communication tab — Coming Soon (canonical PlaceholderTab). */}
                  {locDetailTab === "partner_communication" && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4 bg-slate-50">
                      <PlaceholderTab
                        label="Partner Communication"
                        description="Track and manage communications with this partner location. This feature is currently under development."
                        icon={Mail}
                      />
                    </div>
                  )}

                  {/* ── Purchase Orders tab ── */}
                  {locDetailTab === "purchase_orders" && (
                    <div className="flex-1 flex flex-col overflow-hidden p-4">
                      <PurchaseOrdersTable />
                    </div>
                  )}

                  {/* ── Quotes tab ── */}
                  {locDetailTab === "quotes" && (
                    <div className="flex-1 flex flex-col overflow-hidden p-4">
                      <QuotesTable />
                    </div>
                  )}

                  {/* ── Sales Orders tab ── */}
                  {locDetailTab === "sales_orders" && (
                    <div className="flex-1 flex flex-col overflow-hidden p-4">
                      <SalesOrdersTable />
                    </div>
                  )}

                  {/* ── Attachments tab — reuses the shared AttachmentsTab card grid ── */}
                  {locDetailTab === "attachments" && (
                    <div className="flex-1 flex flex-col overflow-hidden p-4">
                      <AttachmentsTab />
                    </div>
                  )}

                  {/* ── Recent Activity tab — reuses the shared ActivityTab timeline ── */}
                  {locDetailTab === "activity" && (
                    <div className="flex-1 flex flex-col overflow-hidden p-4">
                      <ActivityTab vendor={vendor} formatDate={formatDate} />
                    </div>
                  )}

                  {/* ── Generic Coming Soon for any other tab ── */}
                  {!["overview", "poc", "items", "transactions", "carrier_shipping", "service_centers", "notes", "partner_communication", "purchase_orders", "quotes", "sales_orders", "attachments", "activity"].includes(locDetailTab) && (
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4 bg-slate-50">
                      <PlaceholderTab
                        label={LOC_TABS.find((x) => x.id === locDetailTab)?.label || locDetailTab}
                        description="This feature is currently under development."
                        icon={LOC_TABS.find((x) => x.id === locDetailTab)?.icon}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ══════ Location status-change confirmation (Active) — same canonical lifecycle modal as partner detail ══════ */}
      <AlertDialog open={locStatusConfirmOpen && locStatusChangeTarget === "active"} onOpenChange={(o) => { if (!o) { setLocStatusConfirmOpen(false); setLocStatusChangeTarget(null); } }}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" style={{ zIndex: 220 }}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
              <CircleCheck className="w-8 h-8" style={{ color: "#065F46" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}>
              Mark as Active
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Mark {selectedLocation?.name} as Active?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The location goes back to Active and reappears in default listings, pickers, and search. Existing assignments stay exactly as-is.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleLocStatusChange("active")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}>
                Mark as Active
              </button>
              <button onClick={() => { setLocStatusConfirmOpen(false); setLocStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Keep Inactive
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════ Location status-change confirmation (Inactive) ══════ */}
      <AlertDialog open={locStatusConfirmOpen && locStatusChangeTarget === "inactive"} onOpenChange={(o) => { if (!o) { setLocStatusConfirmOpen(false); setLocStatusChangeTarget(null); } }}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" style={{ zIndex: 220 }}>
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
                Mark {selectedLocation?.name} as Inactive?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The location stops appearing in pickers and is excluded from new assignments. Existing assignments stay exactly as-is. Re-activate from the header CTA when you're ready.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleLocStatusChange("inactive")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}>
                Mark as Inactive
              </button>
              <button onClick={() => { setLocStatusConfirmOpen(false); setLocStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Keep Active
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════ Location primary POC change confirmation ══════ */}
      <AlertDialog open={!!locPrimaryChangeTarget} onOpenChange={(o) => { if (!o) setLocPrimaryChangeTarget(null); }}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" style={{ zIndex: 220 }}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
              <Star className="w-8 h-8 fill-blue-700 text-blue-700" />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
              Change Primary
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              Set {locPrimaryChangeTarget?.name} as primary?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              {locPrimaryChangeTarget?.name} becomes the main point of contact for {selectedLocation?.name}. The current primary stays in this location's POC list but loses its primary status here.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (locPrimaryChangeTarget && selectedLocation) {
                    setLocPrimaryByLoc((prev) => ({ ...prev, [selectedLocation.id]: locPrimaryChangeTarget.id }));
                    toast.success(`${locPrimaryChangeTarget.name} is now the primary contact for ${selectedLocation.name}`);
                  }
                  setLocPrimaryChangeTarget(null);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#0A77FF", color: "#fff" }}
              >
                Set as Primary
              </button>
              <button onClick={() => setLocPrimaryChangeTarget(null)} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════ Location archive confirmation ══════ */}
      <AlertDialog open={locArchiveDialogOpen} onOpenChange={setLocArchiveDialogOpen}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" style={{ zIndex: 220 }}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-8 h-8" style={{ color: "#991B1B" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Archive
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              Archive {selectedLocation?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The location is moved to the Archived view. Existing data is preserved and can be restored from the Archived tab.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => { setLocArchiveDialogOpen(false); toast.success(`${selectedLocation?.name} archived`); handleCloseDetailModal(); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}>
                Archive Location
              </button>
              <button onClick={() => setLocArchiveDialogOpen(false)} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentTermDetailModal
        term={locPtDetailTerm}
        open={locPtDetailOpen}
        onClose={() => { setLocPtDetailOpen(false); setLocPtDetailTerm(null); }}
        mode="view"
        onDisable={(t) => toast.success(`"${t.name}" disabled for this partner`)}
      />

      {/* ══════ Location POC: Select from Directory Modal ══════ */}
      <SelectPocDictionaryModal
        open={locShowSelectModal}
        onOpenChange={setLocShowSelectModal}
        contactDictionary={locContactDictionary}
        pocSearch={locPocSearch}
        onPocSearchChange={(v) => { setLocPocSearch(v); setLocPocPage(1); }}
        pocCategoryFilter={locPocCategoryFilter}
        onPocCategoryFilterChange={(v) => { setLocPocCategoryFilter(v as any); setLocPocPage(1); }}
        pocDepartmentCounts={locPocDeptCounts}
        pocPagedContacts={locPocPagedContacts}
        pocPage={locPocPage}
        pocTotalPages={locPocTotalPages}
        onPocPageChange={setLocPocPage}
        pocTempSelected={locPocTempSelected}
        onTogglePocTemp={handleLocTogglePocTemp}
        onConfirm={handleLocConfirmSelect}
        onOpenCreatePoc={handleLocOpenCreateFromSelect}
        contextLabel={selectedLocation?.name || "this location"}
      />

      {/* ══════ Location POC: Create New Contact Modal ══════ */}
      <CreatePocModal
        open={locShowCreateModal}
        onOpenChange={setLocShowCreateModal}
        contextName={selectedLocation?.name || "Location"}
        newPocName={locNewPocName}
        onNewPocNameChange={setLocNewPocName}
        newPocDepartment={locNewPocDepartment}
        onNewPocDepartmentChange={setLocNewPocDepartment}
        newPocRole={locNewPocRole}
        onNewPocRoleChange={setLocNewPocRole}
        newPocLandline={locNewPocLandline}
        onNewPocLandlineChange={setLocNewPocLandline}
        newPocLandlineCode={locNewPocLandlineCode}
        onNewPocLandlineCodeChange={setLocNewPocLandlineCode}
        newPocExt={locNewPocExt}
        onNewPocExtChange={setLocNewPocExt}
        newPocMobile={locNewPocMobile}
        onNewPocMobileChange={setLocNewPocMobile}
        newPocMobileCode={locNewPocMobileCode}
        onNewPocMobileCodeChange={setLocNewPocMobileCode}
        newPocEmail={locNewPocEmail}
        onNewPocEmailChange={setLocNewPocEmail}
        saveAndCreateAnother={locSaveAndCreate}
        onSaveAndCreateAnotherChange={setLocSaveAndCreate}
        onSave={handleLocSavePoc}
      />

      {/* Location archive confirmation — canonical lifecycle visual
          (gradient red wash, archive icon disk, ARCHIVE pill,
          destructive CTA + Keep active). Confirming archives the row
          via archivedLocationIds, which the locations memo strips
          from the active listing. */}
      <AlertDialog open={!!archiveLocationTarget} onOpenChange={(o) => { if (!o) setArchiveLocationTarget(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setArchiveLocationTarget(null)}
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
                Archive {archiveLocationTarget?.name || "this location"}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              This location is removed from the partner's active sites. Existing transactions stay exactly as-is, and the location can be restored from the archive at any time.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  const id = archiveLocationTarget?.id;
                  const name = archiveLocationTarget?.name || "Location";
                  if (id) {
                    setArchivedLocationIds((prev) => {
                      const next = new Set(prev);
                      next.add(id);
                      return next;
                    });
                  }
                  setArchiveLocationTarget(null);
                  toast.success(`${name} archived`);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Archive Location
              </button>
              <button
                onClick={() => setArchiveLocationTarget(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Active
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Location status-change confirmation — single modal, two
          palettes (green for Mark as Active, amber for Mark as
          Inactive). Confirming writes to locationStatusOverrides, the
          locations memo applies the override and the row's status
          pill updates immediately. */}
      {statusChangeLocation && (() => {
        const isActivating = statusChangeLocation.target === "active";
        const palette = isActivating
          ? {
              wash: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)",
              glow: "#10B981",
              iconBg: "#D1FAE5",
              icon: "#065F46",
              pillBg: "#ECFDF5",
              pillText: "#065F46",
              pillLabel: "Mark as Active",
              cta: "#10B981",
              ctaLabel: "Mark as Active",
              title: `Mark ${statusChangeLocation.loc.name} as Active?`,
              desc: "This location is shown as Active across the partner's site list. Existing transactions stay exactly as-is.",
            }
          : {
              wash: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)",
              glow: "#F59E0B",
              iconBg: "#FEF3C7",
              icon: "#B45309",
              pillBg: "#FFFBEB",
              pillText: "#92400E",
              pillLabel: "Mark as Inactive",
              cta: "#F59E0B",
              ctaLabel: "Mark as Inactive",
              title: `Mark ${statusChangeLocation.loc.name} as Inactive?`,
              desc: "This location is shown as Inactive across the partner's site list. Existing transactions stay exactly as-is.",
            };
        return (
          <AlertDialog open onOpenChange={(o) => { if (!o) setStatusChangeLocation(null); }}>
            <AlertDialogContent
              className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
              style={{ zIndex: 220 }}
              onInteractOutside={() => setStatusChangeLocation(null)}
            >
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: palette.wash }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: palette.glow }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: palette.iconBg }}>
                  {isActivating
                    ? <CircleCheck className="w-8 h-8" style={{ color: palette.icon }} />
                    : <CircleSlash className="w-8 h-8" style={{ color: palette.icon }} />}
                </div>
                <span
                  className="mt-4 px-3 py-1 rounded-full text-[11px]"
                  style={{ fontWeight: 600, backgroundColor: palette.pillBg, color: palette.pillText, letterSpacing: "0.05em" }}
                >
                  {palette.pillLabel}
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                    {palette.title}
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {palette.desc}
                </AlertDialogDescription>
                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      const id = statusChangeLocation.loc.id;
                      const target = statusChangeLocation.target;
                      setLocationStatusOverrides((prev) => ({ ...prev, [id]: target }));
                      setStatusChangeLocation(null);
                      toast.success(`${statusChangeLocation.loc.name} marked as ${target === "active" ? "Active" : "Inactive"}`);
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: palette.cta, color: "#fff" }}
                  >
                    {palette.ctaLabel}
                  </button>
                  <button
                    onClick={() => setStatusChangeLocation(null)}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                  >
                    Keep {isActivating ? "Inactive" : "Active"}
                  </button>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </>
  );
}

// ----- BILLING & SHIPPING TAB -----
function BillingShippingTab({ vendor, cfg }: { vendor: Vendor; cfg?: VendorConfigData }) {
  const hasShipping = cfg?.shippingConfig && (cfg.shippingConfig.carrierServices.length > 0 || cfg.shippingConfig.vendorPreferences.length > 0);

  return (
    <div className="space-y-4">
      {/* Billing Address */}
      <ContentCard title="Billing Address" icon={MapPin}>
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-[12px] text-slate-700 space-y-0.5">
            <p style={{ fontWeight: 500 }}>{vendor.billingAddress.street}</p>
            {vendor.billingAddress.city && (
              <p>{vendor.billingAddress.city}{vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""} {vendor.billingAddress.zipCode}</p>
            )}
            <p>{vendor.billingAddress.country}</p>
          </div>
        </div>
        {vendor.shippingAddress && (
          <>
            <Separator className="my-2.5" />
            <p className="text-[11px] text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Shipping Address</p>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-[12px] text-slate-700 space-y-0.5">
                <p style={{ fontWeight: 500 }}>{vendor.shippingAddress.street}</p>
                {vendor.shippingAddress.city && (
                  <p>{vendor.shippingAddress.city}{vendor.shippingAddress.state ? `, ${vendor.shippingAddress.state}` : ""} {vendor.shippingAddress.zipCode}</p>
                )}
                <p>{vendor.shippingAddress.country}</p>
              </div>
            </div>
          </>
        )}
      </ContentCard>

      {/* Primary carriers — kept in sync with the Freight & Logistics tab's defaults so the
          surfaces report the same data. */}
      <ContentCard title="Primary Carriers" icon={Truck}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Primary Vendor Carrier</p>
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>FedEx Freight</p>
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Primary Customer Carrier</p>
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>DHL Express</p>
            </div>
          </div>
        </div>
      </ContentCard>

      {/* Shipping Configuration from Step 3 */}
      {hasShipping && (
        <ContentCard title="Shipping Configuration" icon={Package}>
          <div className="space-y-3">
            {cfg!.shippingConfig!.carrierServices.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Carrier Services</p>
                <div className="space-y-1.5">
                  {cfg!.shippingConfig!.carrierServices.map((cs, idx) => (
                    <div key={idx} className="rounded-md border border-border p-2.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{cs.name}</span>
                          {cs.isDefault && (
                            <PrimaryPill />
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5">{cs.description}</p>
                      </div>
                      <span className="text-[12px] text-slate-400 shrink-0 ml-3" style={{ fontWeight: 500 }}>
                        {cs.minDays} to {cs.maxDays} days
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cfg!.shippingConfig!.vendorPreferences.length > 0 && cfg!.shippingConfig!.vendorPreferences.some((vp) => vp.carrier) && (
              <div>
                <p className="text-[11px] text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Vendor Preferences</p>
                <div className="space-y-1.5">
                  {cfg!.shippingConfig!.vendorPreferences.filter((vp) => vp.carrier).map((vp, idx) => (
                    <div key={idx} className="rounded-md border border-border p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vp.carrier}</span>
                        {vp.methods.length > 0 && (
                          <p className="text-[12px] text-slate-500 mt-0.5">{vp.methods.join(", ")}</p>
                        )}
                      </div>
                      {vp.isDefault && (
                        <PrimaryPill />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ContentCard>
      )}

      {!hasShipping && !vendor.shippingAddress && (
        <ContentCard title="Shipping Configuration" icon={Package}>
          <EmptyState icon={Package} title="No shipping configuration" description="Shipping details will appear here once configured during partner creation." />
        </ContentCard>
      )}
    </div>
  );
}

// ----- CARRIER PROFILE TAB -----
// Surfaces the canonical Carrier Configuration flow on the
// partner-detail page. Empty state shows an Enable CTA; once
// enabled, opens the same Dialog + sections sidebar +
// ConfigPageContent that the partner creation form / partner
// group config use, so saving carrier-level config feels
// identical across all three surfaces.
function CarrierProfileTab({ vendor }: { vendor: Vendor }) {
  const [enabled, setEnabled] = useState(false);
  // Carrier-owned section now: Shipping Methods. Billing / payment /
  // credit / terms / pricing live under Vendor Rules and are reachable
  // via their own top-level tabs on this detail page (Payment Methods,
  // Freight & Logistics, Pricing Rules, etc.). The Carrier tab only
  // surfaces the methods this partner offers as a freight provider.
  const [activeSectionId, setActiveSectionId] = useState<string>("shipping_methods");
  const configDataRef = React.useRef<Record<string, unknown>>({});
  // Dirty tracking — Save Changes is disabled until the user
  // interacts with the configuration body (typing, toggling a
  // pill, selecting a method, etc.). Reset to false on Save and
  // on Cancel/Discard. ConfigPageContent doesn't surface change
  // events, so we listen for input/click events at the body
  // wrapper to flip the flag on any interaction.
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // Confirmation prompts for enable / disable lifecycle actions.
  // Enabling carries a meaningful permission shift (the partner
  // becomes available as a freight provider); disabling tears
  // down the configuration. Both route through canonical
  // lifecycle modals so users don't toggle accidentally.
  const [enableConfirmOpen, setEnableConfirmOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  // Bumps a remount key so a discard rebuilds ConfigPageContent
  // from scratch (fresh local state inside the section).
  const [resetKey, setResetKey] = useState(0);
  const handleSave = () => {
    setDirty(false);
    toast.success("Carrier configuration saved");
  };
  const handleCancel = () => {
    if (!dirty) return;
    setDiscardOpen(true);
  };
  const confirmDiscard = () => {
    setDirty(false);
    setDiscardOpen(false);
    configDataRef.current = {};
    setResetKey((k) => k + 1);
    toast.info("Changes discarded");
  };
  // Sections owned by the Carrier subtype only — Step 2 of the
  // Vendor Rules refactor moved partner-global config to Vendor Rules,
  // leaving Carrier with just the per-method "Shipping Methods" list.
  // The titleBySubType override renders "Shipping Methods" instead of
  // "Freight & Logistics" since this carrier IS the freight vendor.
  const sections = VENDOR_CONFIG_SECTIONS
    .filter((s) => !s.ownedBy || s.ownedBy.includes("carrier"))
    .map((s) => (s.titleBySubType?.carrier ? { ...s, title: s.titleBySubType.carrier } : s));

  return (
    /* Tab card extends to the bottom of the viewport so the
       sections sidebar + ConfigPageContent get the full height
       to scroll within, instead of leaving a slab of empty space
       below. The 220px offset accounts for the page header,
       breadcrumbs, partner header, tab strip, and the tab card's
       internal toolbar. */
    <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col" style={{ height: "calc(100dvh - 220px)", minHeight: 400 }}>
      {!enabled ? (
        /* Empty state — same shape as the canonical
           partner-creation Carrier section: icon + title +
           description + Enable CTA. Centered in the empty
           container. */
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="w-full max-w-md text-center">
            {/* Animated icon — same floating + ping-ring primitive used
                by the Coming Soon placeholders (PlaceholderTab) and the
                Configure Vendor carrier empty state, so all three
                surfaces read as one visual pattern. */}
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: "3s" }} />
              <div
                className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
                style={{ animation: "csFloat 4s ease-in-out infinite" }}
              >
                <Truck className="w-7 h-7 text-slate-400" />
              </div>
            </div>
            <h3 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Carrier Profile</h3>
            <p className="text-[12px] text-slate-500 mt-1 max-w-[340px] mx-auto leading-relaxed">
              Make this partner pickable as a shipping provider, similar to <span className="text-foreground" style={{ fontWeight: 600 }}>FedEx</span> or <span className="text-foreground" style={{ fontWeight: 600 }}>UPS</span>. Configure shipping methods, rates, and terms after enabling.
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 mt-3">
              <span className="inline-flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Configuration sections</span>
              <span className="inline-flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Auto-inherits group defaults</span>
            </div>
            <button
              type="button"
              onClick={() => setEnableConfirmOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" /> Enable Carrier Profile
            </button>
          </div>
        </div>
      ) : (
        /* Enabled — render the canonical sections sidebar +
           ConfigPageContent inline so the user can edit any
           section directly without opening a modal. Top toolbar
           shows the carrier-profile-enabled context + Disable +
           Save shortcut; Save in the footer commits all changes
           (configDataRef captures field values internally). */
        <>
          {/* Top toolbar — context + lifecycle actions */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-white shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Carrier Profile</p>
                <p className="text-[11px] text-slate-500 leading-relaxed" style={{ fontWeight: 400 }}>
                  Set up {vendor.companyName} as a freight carrier, list the shipping methods they offer (Ground, Express, Overnight, etc.) so other partners can book them on their orders.{" "}
                  <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline align-baseline" style={{ fontWeight: 500 }}>
                    Learn More <ExternalLink className="w-3 h-3" />
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Disable Carrier Profile — amber-tinted to signal
                  the deactivate path, matching the canonical
                  Deactivate palette used on F&L / Payment Methods
                  cards (#FFFBEB bg / #FDE68A border / #92400E
                  text) so the action reads consistently across
                  the system. Copy spells out the noun so the
                  button is unambiguous on its own. */}
              <button
                type="button"
                onClick={() => setDisableConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] transition-colors cursor-pointer"
                style={{ fontWeight: 600, backgroundColor: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF3C7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFBEB"; }}
              >
                <CircleSlash className="w-3.5 h-3.5" /> Disable Carrier Profile
              </button>
            </div>
          </div>

          {/* Body — sections sidebar (left) + ConfigPageContent
              (right). Mirrors the modal layout but lives directly
              in the tab so quick edits don't require opening a
              dialog. Body-level pointerdown/keydown listeners
              flip the dirty flag on any user interaction inside
              the right pane, since ConfigPageContent doesn't
              surface change events upward. */}
          <div
            className="flex-1 flex min-h-0 overflow-hidden bg-[#FAFBFC]"
            onPointerDown={(e) => {
              // Ignore clicks on the section sidebar itself —
              // those don't dirty the config, just navigate.
              const target = e.target as HTMLElement;
              if (target.closest("[data-cf-sidebar]")) return;
              if (!dirty) setDirty(true);
            }}
            onKeyDown={() => { if (!dirty) setDirty(true); }}
          >
            {sections.length > 1 && (
              <div data-cf-sidebar className="w-[240px] shrink-0 border-r border-[#EEF2F6] bg-white overflow-y-auto p-3">
                <p className="text-[10px] text-slate-400 tracking-wider px-2 pt-1 pb-1.5" style={{ fontWeight: 600 }}>Sections</p>
                <nav className="flex flex-col gap-0.5">
                  {sections.map((s) => {
                    const isActive = activeSectionId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSectionId(s.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isActive ? "bg-accent text-primary" : "text-slate-600 hover:bg-slate-50"}`}
                        style={{ fontWeight: isActive ? 600 : 500 }}
                      >
                        <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`}>
                          {s.icon}
                        </span>
                        <span className="text-[12px] flex-1 truncate">{s.title}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-y-auto p-5">
              <ConfigPageContent
                key={resetKey}
                sectionId={activeSectionId}
                configType="vendor"
                activeSubType="carrier"
                selectedGroup={null}
                partnerName={vendor.companyName}
                configDataRef={configDataRef}
                isCarrier
                suppressCarrierSectionHeader
              />
            </div>
          </div>
        </>
      )}

      {/* ── Enable Carrier Profile confirmation ──
          Emerald-glow Activate modal (matches the canonical
          Activate pattern used on F&L / Payment Methods so all
          "turn-on" actions read the same way). */}
      <AlertDialog open={enableConfirmOpen} onOpenChange={setEnableConfirmOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setEnableConfirmOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
              <Truck className="w-8 h-8" style={{ color: "#047857" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}>
              Enable Carrier Profile
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Turn on freight carrier mode for {vendor.companyName}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                <p>
                  Other users will be able to pick {vendor.companyName} as a freight carrier on their orders, similar to picking <span className="text-foreground" style={{ fontWeight: 600 }}>FedEx</span> or <span className="text-foreground" style={{ fontWeight: 600 }}>UPS</span>. Configure billing, payments, pricing, and shipping methods after enabling.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]" style={{ fontWeight: 600 }}>
                  <Info className="w-3 h-3" />
                  Doesn't replace the vendor or customer setup
                </span>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => { setEnabled(true); setEnableConfirmOpen(false); toast.success("Carrier profile enabled"); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}
              >
                Enable Carrier Profile
              </button>
              <button
                onClick={() => setEnableConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Disable Carrier Profile confirmation ──
          Canonical amber Deactivate palette + tighter copy: drop
          the "snapshot" jargon, lead with the practical impact
          (where the partner won't show up). Matches the F&L /
          Payment Methods deactivate prompts. */}
      <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setDisableConfirmOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <CircleSlash className="w-8 h-8" style={{ color: "#B45309" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}>
              Disable Carrier Profile
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Turn off freight carrier mode for {vendor.companyName}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              Hidden from new orders as a freight option. In-flight shipments stay as is. The configuration is preserved, so you can turn it back on any time.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setEnabled(false);
                  setDirty(false);
                  setDisableConfirmOpen(false);
                  toast.success("Carrier profile disabled");
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
              >
                Disable Carrier Profile
              </button>
              <button
                onClick={() => setDisableConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Enabled
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Discard confirmation ──
          Canonical centered red-glow lifecycle modal so the
          discard prompt looks identical to every other discard
          in the module. */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setDiscardOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Discard Carrier Configuration
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Discard unsaved changes?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              Edits across every carrier section will revert. This action cannot be undone.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={confirmDiscard}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Discard Changes
              </button>
              <button
                onClick={() => setDiscardOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----- FREIGHT & LOGISTICS TAB -----
// Top-level partner-detail surface for shipping carriers + methods.
// Mirrors the location detail's Carrier & Shipping sub-tab visually
// (vendor / customer split, CarrierShippingCard grid) but at the
// partner level — no inheritance toggle, no per-location overrides.
type FLCarrier = React.ComponentProps<typeof CarrierShippingCard>["carrier"];

// Master catalog used by the Add Carrier modal. Mirrors the location
// detail modal's MASTER_CARRIERS roster so users see a consistent set
// of options whether they're adding at the partner or location level.
const FL_MASTER_CARRIERS: Array<{
  id: string;
  name: string;
  type: string;
  avgDelivery: string;
  regions: string[];
  status: "Active" | "Under Review" | "Inactive";
  shipments: number;
  desc: string;
  methods: { id: string; name: string; shortName: string; desc: string; minDays: number; maxDays: number; isDefault: boolean; cost: string }[];
  /** Pickup entries are self-service handoffs (no third-party carrier).
   *  They ship with zero methods so users add custom modes per partner —
   *  a pickup carrier with no method is valid by design. Pickups are
   *  pinned to the top of the carrier-picker dropdown. */
  isPickup?: boolean;
}> = [
  // Pickup options — pinned to the top of the dropdown. System uses
  // the partner's default staging location, so no per-row pickup-
  // location field is needed here.
  { id: "FLMC-CUST-PICKUP", name: "Customer Pickup", type: "Pickup", avgDelivery: "0-1 days", regions: ["Local"], status: "Active", shipments: 0, desc: "Customer picks up the order from our staging location, no third-party carrier handoff. Add custom pickup modes as needed.", methods: [], isPickup: true },
  { id: "FLMC-VEND-PICKUP", name: "Vendor Pickup", type: "Pickup", avgDelivery: "0-1 days", regions: ["Local"], status: "Active", shipments: 0, desc: "We pick up directly from the vendor's staging location, no third-party carrier handoff. Add custom pickup modes as needed.", methods: [], isPickup: true },
  { id: "FLMC-1", name: "FedEx Express", type: "Air & Ground", avgDelivery: "2-3 days", regions: ["North America", "Europe"], status: "Active", shipments: 1245, desc: "Premium express shipping for time-critical deliveries", methods: [
    { id: "flmc1-m1", name: "FedEx Express (Air)", shortName: "Air", desc: "Premium air freight", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
    { id: "flmc1-m2", name: "FedEx Ground", shortName: "Ground", desc: "Standard ground delivery", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.00" },
  ]},
  { id: "FLMC-2", name: "DHL International", type: "International", avgDelivery: "3-5 days", regions: ["Global"], status: "Active", shipments: 892, desc: "Global logistics and international shipping solutions", methods: [
    { id: "flmc2-m1", name: "DHL Express", shortName: "Air", desc: "International express", minDays: 3, maxDays: 5, isDefault: true, cost: "$38.00" },
    { id: "flmc2-m2", name: "DHL Ocean", shortName: "Sea", desc: "Ocean freight", minDays: 14, maxDays: 21, isDefault: false, cost: "$8.50" },
  ]},
  { id: "FLMC-3", name: "UPS Freight", type: "Ground & Freight", avgDelivery: "3-7 days", regions: ["North America"], status: "Active", shipments: 634, desc: "Reliable ground freight and LTL services", methods: [
    { id: "flmc3-m1", name: "UPS Ground", shortName: "Ground", desc: "Ground shipping", minDays: 3, maxDays: 7, isDefault: true, cost: "$15.00" },
    { id: "flmc3-m2", name: "UPS Freight LTL", shortName: "Freight", desc: "Less-than-truckload freight", minDays: 5, maxDays: 10, isDefault: false, cost: "$22.00" },
  ]},
  { id: "FLMC-4", name: "Maersk Line", type: "Ocean Freight", avgDelivery: "14-21 days", regions: ["Global"], status: "Active", shipments: 156, desc: "World-leading ocean container shipping", methods: [
    { id: "flmc4-m1", name: "Maersk Ocean", shortName: "Sea", desc: "Container shipping", minDays: 14, maxDays: 21, isDefault: true, cost: "$6.50" },
  ]},
  { id: "FLMC-5", name: "XPO Logistics", type: "LTL & Freight", avgDelivery: "5-10 days", regions: ["North America", "Europe"], status: "Under Review", shipments: 423, desc: "Freight brokerage and logistics management", methods: [
    { id: "flmc5-m1", name: "XPO LTL", shortName: "Freight", desc: "LTL freight", minDays: 5, maxDays: 10, isDefault: true, cost: "$18.00" },
  ]},
  { id: "FLMC-6", name: "TCS (Tranzum Courier)", type: "Regional", avgDelivery: "1-3 days", regions: ["South Asia"], status: "Active", shipments: 312, desc: "Regional express courier for South Asian markets", methods: [
    { id: "flmc6-m1", name: "TCS Express", shortName: "Air", desc: "Express courier", minDays: 1, maxDays: 3, isDefault: true, cost: "$5.00" },
  ]},
  { id: "FLMC-7", name: "Aramex", type: "International", avgDelivery: "3-7 days", regions: ["Middle East", "Global"], status: "Active", shipments: 578, desc: "International express delivery and logistics", methods: [
    { id: "flmc7-m1", name: "Aramex Express", shortName: "Air", desc: "International express", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
    { id: "flmc7-m2", name: "Aramex Ground", shortName: "Ground", desc: "Domestic ground", minDays: 5, maxDays: 8, isDefault: false, cost: "$9.00" },
  ]},
  { id: "FLMC-8", name: "USPS Priority Mail", type: "Ground", avgDelivery: "2-3 days", regions: ["North America"], status: "Active", shipments: 1023, desc: "USPS domestic priority shipping network", methods: [
    { id: "flmc8-m1", name: "USPS Priority", shortName: "Ground", desc: "2 to 3 day priority shipping", minDays: 2, maxDays: 3, isDefault: true, cost: "$8.00" },
  ]},
];

function FreightLogisticsTab({ vendor, flush, locationName }: {
  vendor: Vendor;
  /** When true, drops the outer border + rounded-xl + minHeight so the tab renders edge-to-edge inside its container (e.g. location detail modal). */
  flush?: boolean;
  /** When provided, the tab is scoped to a single Partner Location — the Add
   *  CTA + modal copy switch to location-specific wording so users can tell
   *  they're configuring freight for that location, not vendor-wide. */
  locationName?: string;
}) {
  type FLSubTab = "vendor" | "customer";
  const [subTab, setSubTab] = useState<FLSubTab>("vendor");
  const [search, setSearch] = useState("");
  const [primaryOverride, setPrimaryOverride] = useState<Record<FLSubTab, string | null>>({ vendor: null, customer: null });

  // ── Add Freight & Logistics modal state — draft-based picker
  //    that mirrors the canonical "Add Freight & Logistics" modal
  //    from the partner creation form. Each draft is one carrier
  //    + selected methods; user can stack multiple drafts via
  //    "Add Another Carrier". ──
  type FLMethod = { id: string; name: string; shortName: string; desc: string; minDays: number; maxDays: number; isDefault: boolean; cost: string };
  type AddDraft = {
    id: string;
    carrierId: string;       // FL_MASTER_CARRIERS.id
    methodIds: string[];     // selected method ids on that carrier
    primaryMethodId: string; // which selected method is the carrier's default
    isDefault: boolean;      // is this carrier the partner's primary
    carrierOpen: boolean;    // popover state for the Carrier dropdown
    methodOpen: boolean;     // popover state for the Methods dropdown
    carrierSearch: string;   // search text inside Carrier popover
    methodSearch: string;    // search text inside Methods popover
  };
  const makeAddDraft = (): AddDraft => ({
    id: `addd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    carrierId: "",
    methodIds: [],
    primaryMethodId: "",
    isDefault: true,
    carrierOpen: false,
    methodOpen: false,
    carrierSearch: "",
    methodSearch: "",
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addDrafts, setAddDrafts] = useState<AddDraft[]>([makeAddDraft()]);
  // Per-draft inline error flags. Replaces the old "toast on Save"
  // pattern — matches the canonical creation-form modal where a
  // missing carrier highlights the field and shows "Please select
  // a carrier first" under it.
  const [addCarrierErrors, setAddCarrierErrors] = useState<Record<string, boolean>>({});
  // When non-empty, the Add modal is in edit mode for this carrier
  // — Save replaces the row instead of appending. Title + CTA copy
  // flip to "Edit Freight & Logistics" / "Update Methods".
  const [editingCarrierId, setEditingCarrierId] = useState<string>("");
  // Details modal (read-only summary of a saved carrier).
  const [detailsCarrier, setDetailsCarrier] = useState<FLCarrier | null>(null);
  // Remove confirmation.
  const [removeCarrier, setRemoveCarrier] = useState<FLCarrier | null>(null);
  // Status-change confirmation — { carrier, next }; canonical amber
  // glow when next === "inactive", emerald glow when reactivating.
  const [statusChange, setStatusChange] = useState<{ carrier: FLCarrier; next: "active" | "inactive" } | null>(null);
  // Primary-change confirmation — fires when the user clicks the
  // star on a non-primary carrier and there's already an existing
  // primary on this side. First-primary-of-the-side skips the
  // prompt since there's nothing to displace.
  const [primaryChange, setPrimaryChange] = useState<FLCarrier | null>(null);
  // Custom methods created on the fly via "+ Create Shipping
  // Method" — keyed by carrier id so they show up in the methods
  // dropdown for that carrier (mirrors the creation-form pattern).
  const [flCustomMethods, setFlCustomMethods] = useState<Record<string, FLMethod[]>>({});
  // Create Shipping Method sub-modal state — mirrors the canonical
  // creation-form modal structure (Mode tiles + Method Details +
  // Coverage toggle with regions tag input).
  type CsmMode = "" | "air" | "ground" | "sea" | "multi";
  const [createFlMethodOpen, setCreateFlMethodOpen] = useState(false);
  const [createFlMethodForCarrier, setCreateFlMethodForCarrier] = useState<string>("");
  const [createFlMethodForDraft, setCreateFlMethodForDraft] = useState<string>("");
  const [createFlMethodForm, setCreateFlMethodForm] = useState<{
    mode: CsmMode;
    name: string;
    shortName: string;
    desc: string;
    minDays: string;
    maxDays: string;
    showCoverage: boolean;
    packagingMode: "standard" | "custom";
    packageTypes: PackageType[];
    weight: string;
    weightUnit: "lb" | "kg" | "g" | "oz";
    length: string;
    width: string;
    height: string;
    dimensionUnit: "in" | "cm" | "mm" | "ft";
  }>({ mode: "", name: "", shortName: "", desc: "", minDays: "", maxDays: "", showCoverage: false, packagingMode: "standard", packageTypes: [], weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" });
  const resetCreateFlMethodForm = () => setCreateFlMethodForm({ mode: "", name: "", shortName: "", desc: "", minDays: "", maxDays: "", showCoverage: false, packagingMode: "standard", packageTypes: [], weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" });
  // Tracks whether the Create Shipping Method form has been touched
  // — drives the discard-confirmation prompt on close.
  const isCsmFormDirty = () => {
    const f = createFlMethodForm;
    return Boolean(
      f.mode ||
      f.name.trim() || f.shortName.trim() || f.desc.trim() ||
      f.minDays || f.maxDays ||
      f.showCoverage ||
      f.packageTypes.length ||
      f.weight || f.length || f.width || f.height
    );
  };
  const [csmDiscardOpen, setCsmDiscardOpen] = useState(false);
  // Tracks whether the Add Freight & Logistics form has been touched
  // — same purpose, drives the parent modal's discard prompt.
  const isAddFlDirty = () => addDrafts.some((d) => d.carrierId || d.methodIds.length > 0);
  const [addFlDiscardOpen, setAddFlDiscardOpen] = useState(false);
  function resetAddModal() {
    setAddDrafts([makeAddDraft()]);
    setAddCarrierErrors({});
  }
  const updateAddDraft = (id: string, patch: Partial<AddDraft>) => {
    setAddDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const addAnotherDraft = () => {
    setAddDrafts((prev) => [...prev, { ...makeAddDraft(), isDefault: false }]);
  };
  const removeAddDraft = (id: string) => {
    setAddDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      // If we removed the primary draft, promote the first remaining to primary.
      if (next.length > 0 && !next.some((d) => d.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next.length > 0 ? next : [makeAddDraft()];
    });
  };
  const setPrimaryDraft = (id: string) => {
    setAddDrafts((prev) => prev.map((d) => ({ ...d, isDefault: d.id === id })));
  };

  // ── Vendor-side carriers — services this partner uses to ship to us ──
  const [vendorCarriers, setVendorCarriers] = useState<FLCarrier[]>(() => [
    {
      id: "fl-v-1",
      name: "FedEx Freight",
      desc: "Premium air + ground network for time-critical inbound shipments",
      isDefault: true,
      status: "active",
      methods: [
        { id: "flv1-m1", name: "FedEx Express (Air)", shortName: "Air", desc: "1 to 2 day air freight for urgent goods.", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
        { id: "flv1-m2", name: "FedEx Ground", shortName: "Ground", desc: "Standard ground delivery, lower cost.", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.00" },
        { id: "flv1-m3", name: "FedEx Freight LTL", shortName: "Freight", desc: "Less-than-truckload palletized freight.", minDays: 5, maxDays: 8, isDefault: false, cost: "$22.00" },
      ],
    },
    {
      id: "fl-v-2",
      name: "DHL International",
      desc: "Cross-border express + ocean for global manufacturing inbound",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flv2-m1", name: "DHL Express Worldwide", shortName: "Air", desc: "International air, customs-cleared.", minDays: 3, maxDays: 5, isDefault: true, cost: "$38.00" },
        { id: "flv2-m2", name: "DHL Ocean FCL", shortName: "Sea", desc: "Full container ocean shipping.", minDays: 14, maxDays: 21, isDefault: false, cost: "$8.50" },
      ],
    },
    {
      id: "fl-v-3",
      name: "UPS Freight",
      desc: "Reliable LTL ground freight across North America",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flv3-m1", name: "UPS Ground", shortName: "Ground", desc: "Standard ground; widest US coverage.", minDays: 3, maxDays: 7, isDefault: true, cost: "$15.00" },
        { id: "flv3-m2", name: "UPS Freight LTL", shortName: "Freight", desc: "LTL palletized freight, NMFC rated.", minDays: 5, maxDays: 10, isDefault: false, cost: "$22.00" },
      ],
    },
    {
      id: "fl-v-4",
      name: "Maersk Line",
      desc: "Ocean container shipping for high-volume seasonal restock",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flv4-m1", name: "Maersk FCL", shortName: "Sea", desc: "Door-to-door ocean container.", minDays: 18, maxDays: 32, isDefault: true, cost: "$6,200.00" },
      ],
    },
    {
      id: "fl-v-5",
      name: "OnTrac",
      desc: "Regional ground carrier, West Coast last-mile",
      isDefault: false,
      status: "inactive",
      methods: [
        { id: "flv5-m1", name: "OnTrac Ground", shortName: "Ground", desc: "Regional ground delivery, West Coast.", minDays: 2, maxDays: 4, isDefault: true, cost: "$9.50" },
      ],
    },
  ]);

  // ── Customer-side carriers — services we use to deliver to this partner ──
  const [customerCarriers, setCustomerCarriers] = useState<FLCarrier[]>(() => [
    {
      id: "fl-c-1",
      name: "DHL Express",
      desc: "Door-to-door international express for outbound deliveries",
      isDefault: true,
      status: "active",
      methods: [
        { id: "flc1-m1", name: "DHL Express Worldwide", shortName: "Air", desc: "Premium worldwide express service.", minDays: 2, maxDays: 4, isDefault: true, cost: "$55.00" },
        { id: "flc1-m2", name: "DHL Economy Select", shortName: "Ground", desc: "Affordable ground freight.", minDays: 5, maxDays: 8, isDefault: false, cost: "$18.00" },
      ],
    },
    {
      id: "fl-c-2",
      name: "Aramex",
      desc: "Express delivery + logistics for the Middle East and South Asia",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flc2-m1", name: "Aramex Express", shortName: "Air", desc: "International express delivery.", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
        { id: "flc2-m2", name: "Aramex Domestic", shortName: "Ground", desc: "In-country domestic delivery.", minDays: 1, maxDays: 3, isDefault: false, cost: "$7.50" },
      ],
    },
    {
      id: "fl-c-3",
      name: "USPS Priority Mail",
      desc: "Domestic ground network for low-cost outbound parcels",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flc3-m1", name: "USPS Priority", shortName: "Ground", desc: "2 to 3 day domestic priority shipping.", minDays: 2, maxDays: 3, isDefault: true, cost: "$8.00" },
      ],
    },
    {
      id: "fl-c-4",
      name: "Blue Dart",
      desc: "Domestic express courier, South Asia regional coverage",
      isDefault: false,
      status: "active",
      methods: [
        { id: "flc4-m1", name: "Blue Dart Apex", shortName: "Air", desc: "Same-day to 24-hour delivery.", minDays: 0, maxDays: 1, isDefault: true, cost: "$12.00" },
      ],
    },
  ]);

  const carriers = subTab === "vendor" ? vendorCarriers : customerCarriers;
  const setCarriersForSubTab = subTab === "vendor" ? setVendorCarriers : setCustomerCarriers;
  // Active sub-tab tint — reused on the Add CTA + the modal accent so
  // the user has a clear visual link between the tab they're on and
  // the side they're adding into.
  const tint = subTab === "vendor"
    ? { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF", hoverBg: "#CFE6FF", label: "Vendor Carriers" }
    : { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", hoverBg: "#D1FAE5", label: "Customer Carriers" };
  const filtered = carriers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
  });

  // overrideId still drives the per-side primary-carrier override
  // applied to each card via effectiveCarrier below. The KPI strip
  // (totalMethods / primaryName / avgTransit) was dropped per
  // stakeholder feedback so those derived values are gone too.
  const overrideId = primaryOverride[subTab];

  return (
    <div className={`bg-card overflow-clip flex flex-col ${flush ? "flex-1 min-h-0" : "border border-border rounded-xl"}`} style={flush ? undefined : { minHeight: 400 }}>
      {/* Sub-tabs row — same blue / emerald palette as Items + Pricing Rules */}
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border shrink-0">
        <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
          {([
            {
              key: "vendor" as FLSubTab,
              label: "Vendor Freight & Logistics",
              color: "#0548A3",
              tip: "Carriers and methods this partner uses to ship goods to you.",
              example: <><span className="text-[#0548A3]" style={{ fontWeight: 600 }}>FedEx Express (Air)</span>, 1 to 2 day inbound from a critical supplier.</>,
            },
            {
              key: "customer" as FLSubTab,
              label: "Customer Freight & Logistics",
              color: "#065F46",
              tip: "Carriers and methods you use to deliver goods to this partner.",
              example: <><span className="text-[#065F46]" style={{ fontWeight: 600 }}>DHL Express Worldwide</span>, outbound international door-to-door.</>,
            },
          ]).map((t) => {
            const active = subTab === t.key;
            return (
              <Tooltip key={t.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setSubTab(t.key); setSearch(""); }}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                      active ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                    }`}
                    style={{ fontWeight: active ? 600 : 500, color: active ? t.color : undefined }}
                  >
                    <Truck className="w-3.5 h-3.5" style={{ color: active ? t.color : "#94A3B8" }} />
                    {t.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                  <p className="text-slate-500">{t.tip}</p>
                  <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                    <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                    <p className="text-[11px] text-slate-700 mt-1">{t.example}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-sm hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{filtered.length}</span>
            <span className="text-muted-foreground/70"> {filtered.length === 1 ? "carrier" : "carriers"}</span>
          </span>
          {/* Add Carrier CTA — tinted to match the active sub-tab,
              matching the Items / Pricing Rules tab pattern. */}
          <button
            type="button"
            onClick={() => { resetAddModal(); setAddOpen(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: tint.bg, borderColor: tint.border, color: tint.color }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {locationName
                ? subTab === "vendor"
                  ? "Add Vendor Freight for This Location"
                  : "Add Customer Freight for This Location"
                : subTab === "vendor"
                  ? "Add Vendor Freight & Logistics"
                  : "Add Customer Freight & Logistics"}
            </span>
          </button>
        </div>
      </div>

      {/* Toolbar: search */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2 shrink-0 ${flush ? "bg-slate-50" : ""}`}>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
          <Input
            placeholder="Search carriers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards grid */}
      <div className={`flex-1 overflow-auto px-4 pb-4 pt-1 ${flush ? "bg-slate-50" : ""}`}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>No carriers found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((carrier) => {
              const effectiveCarrier = overrideId !== null
                ? { ...carrier, isDefault: carrier.id === overrideId }
                : carrier;
              return (
                <CarrierShippingCard
                  key={carrier.id}
                  carrier={effectiveCarrier}
                  partnerName={vendor.companyName}
                  onSetPrimary={() => {
                    // First-primary-of-the-side path: nothing to
                    // displace, so set straight away. Otherwise
                    // route through a confirmation prompt.
                    const existingPrimary = filtered.find((c) => (overrideId !== null ? c.id === overrideId : c.isDefault));
                    if (!existingPrimary || existingPrimary.id === carrier.id) {
                      setPrimaryOverride((prev) => ({ ...prev, [subTab]: carrier.id }));
                      toast.success(`${carrier.name} is now the primary ${subTab} carrier`);
                      return;
                    }
                    setPrimaryChange(carrier);
                  }}
                  onView={() => setDetailsCarrier(carrier)}
                  onEdit={() => {
                    // Resolve the saved carrier back to a catalog
                    // entry, then map its saved methods to the
                    // catalog method ids by matching name OR
                    // shortName. Required because seed-created rows
                    // have method ids that don't align with the
                    // catalog (e.g. flv1-m1 vs flmc1-m1) — without
                    // this remap the dropdown would render with no
                    // checkboxes pre-checked and the chip strip
                    // would silently disappear.
                    const master = FL_MASTER_CARRIERS.find((m) => m.name === carrier.name) ?? FL_MASTER_CARRIERS[0];
                    const catalogIds: string[] = [];
                    let primaryCatalogId = "";
                    for (const saved of carrier.methods) {
                      const match = master.methods.find((cm) => cm.name === saved.name || cm.shortName === saved.shortName);
                      if (match) {
                        catalogIds.push(match.id);
                        if (saved.isDefault) primaryCatalogId = match.id;
                      }
                    }
                    setEditingCarrierId(carrier.id);
                    setAddDrafts([{
                      ...makeAddDraft(),
                      carrierId: master.id,
                      methodIds: catalogIds,
                      primaryMethodId: primaryCatalogId || catalogIds[0] || "",
                      isDefault: carrier.isDefault,
                    }]);
                    setAddOpen(true);
                  }}
                  onRemove={() => setRemoveCarrier(carrier)}
                  onSetStatus={(next) => setStatusChange({ carrier, next })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Freight & Logistics Modal ──
          Carrier + methods picker that mirrors the canonical
          "Add Freight & Logistics" modal from the partner creation
          form. Each draft is one carrier with a methods multi-
          select; user can stack drafts via "Add Another Carrier".
          On save, drafts are converted to FLCarrier shape and
          appended to the active sub-tab's carriers list. */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (open) { setAddOpen(true); return; }
          if (isAddFlDirty()) { setAddFlDiscardOpen(true); return; }
          setAddOpen(false); setEditingCarrierId(""); resetAddModal();
        }}
      >
        <DialogContent
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col !border-border/60"
          style={{ maxWidth: "min(65vw, 960px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "90vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          hideCloseButton
          onPointerDownOutside={(e) => { if (isAddFlDirty()) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isAddFlDirty()) { e.preventDefault(); setAddFlDiscardOpen(true); } }}
        >
          <DialogTitle className="sr-only">
            {locationName
              ? (editingCarrierId ? `Edit Freight for ${locationName}` : `Add Freight for ${locationName}`)
              : (editingCarrierId ? "Edit Freight & Logistics" : "Add Freight & Logistics")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {locationName
              ? `Pick a carrier and the methods used at ${locationName}. Add another carrier below to stack multiple.`
              : "Pick a carrier and the methods it offers. Add another carrier below to stack multiple."}
          </DialogDescription>

          {/* Header — title row + chip + subtitle, matches the
              creation-form Add Freight & Logistics modal. */}
          <div className="px-4 sm:px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    {locationName
                      ? (editingCarrierId ? "Edit Freight for This Location" : "Add Freight for This Location")
                      : (editingCarrierId ? "Edit Freight & Logistics" : "Add Freight & Logistics")}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    <Truck className="w-3 h-3" /> Carrier · Methods
                  </span>
                  {locationName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[11px] text-blue-700 border border-blue-100" style={{ fontWeight: 600 }}>
                      <MapPin className="w-3 h-3" /> {locationName}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                  {editingCarrierId
                    ? (locationName
                        ? `Update the carrier and the methods used at ${locationName}.`
                        : "Update the carrier and the methods this partner uses.")
                    : (locationName
                        ? `Pick a carrier and the methods used at ${locationName}. Add another carrier below to stack multiple.`
                        : "Pick a carrier and the methods it offers. Add another carrier below to stack multiple.")}
                </p>
              </div>
              <button
                onClick={() => {
                  if (isAddFlDirty()) { setAddFlDiscardOpen(true); return; }
                  setAddOpen(false); setEditingCarrierId(""); resetAddModal();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — drafts list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4 bg-[#FAFBFC]">
            <div className="space-y-3">
              {addDrafts.map((draft, dIdx) => {
                const isMulti = addDrafts.length > 1;
                const selectedCarrier = FL_MASTER_CARRIERS.find((c) => c.id === draft.carrierId);
                // Merge catalog methods with any custom methods the user
                // created on the fly via "+ Create Shipping Method" so
                // newly created methods immediately appear in the list.
                const carrierMethods: FLMethod[] = draft.carrierId
                  ? [...(selectedCarrier?.methods ?? []), ...(flCustomMethods[draft.carrierId] ?? [])]
                  : [];
                return (
                  <div key={draft.id} className={`rounded-lg bg-white overflow-hidden transition-all ${
                    isMulti && draft.isDefault
                      ? "border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)]"
                      : "border border-border"
                  }`}>
                    {/* Card header strip */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                      <div className="flex items-center gap-2 min-w-0">
                        {isMulti && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[11px]" style={{ fontWeight: 700 }}>
                            {dIdx + 1}
                          </span>
                        )}
                        {selectedCarrier ? (
                          <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{selectedCarrier.name}</span>
                        ) : (
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Carrier {dIdx + 1}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isMulti && (
                          draft.isDefault ? (
                            <PrimaryPill />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPrimaryDraft(draft.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-white text-[10px] text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-accent transition-all cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <Star className="w-2.5 h-2.5" /> Set as Primary
                            </button>
                          )
                        )}
                        {isMulti && (
                          <button
                            type="button"
                            onClick={() => removeAddDraft(draft.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                            aria-label="Remove carrier"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card body — Carrier + Methods dropdowns side by side */}
                    <div className="px-4 py-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Shipping Carrier dropdown — Popover with
                            search + Create New Carrier link + carrier
                            logos. Mirrors the canonical creation-form
                            picker. */}
                        <div>
                          <label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>
                            Shipping Carrier<span className="text-destructive">*</span>
                          </label>
                          <Popover
                            open={draft.carrierOpen}
                            onOpenChange={(o) => {
                              updateAddDraft(draft.id, { carrierOpen: o, carrierSearch: o ? draft.carrierSearch : "" });
                              // Clear the error the moment the user
                              // engages with the field — matches the
                              // canonical creation-form pattern.
                              if (o && addCarrierErrors[draft.id]) {
                                setAddCarrierErrors((p) => ({ ...p, [draft.id]: false }));
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`mt-1 w-full flex items-center justify-between h-10 px-3 rounded-lg border bg-white text-sm transition-colors cursor-pointer ${
                                  addCarrierErrors[draft.id]
                                    ? "border-destructive focus-within:ring-1 focus-within:ring-destructive"
                                    : "border-border hover:border-slate-300"
                                }`}
                              >
                                {selectedCarrier ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    {(() => {
                                      const logo = getCarrierLogo(selectedCarrier.name);
                                      return logo ? (
                                        <img src={logo} alt={selectedCarrier.name} className="w-6 h-6 rounded object-contain shrink-0" />
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                                          <span className="text-[9px] text-muted-foreground" style={{ fontWeight: 700 }}>{getCarrierInitials(selectedCarrier.name)}</span>
                                        </div>
                                      );
                                    })()}
                                    <span className="text-foreground text-sm truncate">{selectedCarrier.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-sm">Select a carrier</span>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={4}
                              className="p-0 z-[260] flex flex-col rounded-xl border border-[#E8ECF1] bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.16)] overflow-hidden"
                              style={{ width: "var(--radix-popover-trigger-width)", maxHeight: 480 }}
                            >
                              <div className="p-2 border-b border-[#F1F5F9] shrink-0">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    value={draft.carrierSearch}
                                    onChange={(e) => updateAddDraft(draft.id, { carrierSearch: e.target.value })}
                                    placeholder="Search carriers..."
                                    autoFocus
                                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300"
                                  />
                                </div>
                              </div>
                              {(() => {
                                const q = draft.carrierSearch.toLowerCase().trim();
                                // Pickup options are side-specific: only the
                                // pickup that matches the active sub-tab (Vendor /
                                // Customer Freight & Logistics) is exposed. Strip
                                // the wrong-side pickup BEFORE search filtering so
                                // it can't slip in via partial match.
                                const allowedPickupId = subTab === "customer" ? "FLMC-CUST-PICKUP" : "FLMC-VEND-PICKUP";
                                const scoped = FL_MASTER_CARRIERS.filter((c) => {
                                  if (!c.isPickup) return true;
                                  return c.id === allowedPickupId;
                                });
                                const filtered = q
                                  ? scoped.filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
                                  : scoped;
                                const pickups = filtered.filter((c) => c.isPickup);
                                const carriers = filtered.filter((c) => !c.isPickup);
                                const renderCarrierRow = (c: typeof FL_MASTER_CARRIERS[number]) => {
                                  const isActive = draft.carrierId === c.id;
                                  const logo = getCarrierLogo(c.name);
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => updateAddDraft(draft.id, { carrierId: c.id, methodIds: [], primaryMethodId: "", carrierOpen: false, carrierSearch: "" })}
                                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isActive ? "bg-primary/10" : "hover:bg-muted/60"}`}
                                    >
                                      {logo ? (
                                        <img src={logo} alt={c.name} className="w-6 h-6 rounded object-contain" />
                                      ) : c.isPickup ? (
                                        <div className="w-6 h-6 rounded bg-amber-50 border border-amber-200 flex items-center justify-center">
                                          <Package className="w-3 h-3 text-amber-700" />
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                                          <span className="text-[9px] text-muted-foreground" style={{ fontWeight: 700 }}>{getCarrierInitials(c.name)}</span>
                                        </div>
                                      )}
                                      <span className="text-sm text-foreground flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                                      {isActive && <Check className="w-4 h-4 text-primary" />}
                                    </button>
                                  );
                                };
                                return (
                                  <>
                                    {/* Sticky header — Create New Carrier CTA + the
                                        scoped Pickup row. Lives OUTSIDE the scroll
                                        container so it stays visible regardless of
                                        scroll position (per Eli's note). */}
                                    <div className="p-1.5 shrink-0 border-b border-[#F1F5F9] space-y-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          window.open("/vendors?createPartner=carrier", "_blank", "noopener,noreferrer");
                                          updateAddDraft(draft.id, { carrierOpen: false, carrierSearch: "" });
                                        }}
                                        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                                        style={{ fontWeight: 600 }}
                                      >
                                        <Plus className="w-3.5 h-3.5" /> Create New Carrier
                                      </button>
                                      {pickups.length > 0 && (
                                        <>
                                          <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Pickup</p>
                                          {pickups.map(renderCarrierRow)}
                                        </>
                                      )}
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
                                      {carriers.length > 0 && (
                                        <p className="px-2.5 pt-0.5 pb-0.5 text-[10px] tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Carriers</p>
                                      )}
                                      {carriers.map(renderCarrierRow)}
                                      {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No carriers found</p>}
                                    </div>
                                  </>
                                );
                              })()}
                            </PopoverContent>
                          </Popover>
                          {addCarrierErrors[draft.id] && (
                            <p className="mt-1 text-[10px] text-destructive" style={{ fontWeight: 500 }}>
                              Please select a carrier first
                            </p>
                          )}
                        </div>

                        {/* Shipping Methods multi-select — Popover with
                            search + Create Shipping Method link + rich
                            method rows (name + description + days + edit
                            for custom + primary star). */}
                        <div>
                          <label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>
                            Shipping Methods
                          </label>
                          <Popover
                            open={draft.methodOpen}
                            onOpenChange={(o) => {
                              // Block opening + flag the carrier
                              // field if no carrier is picked yet —
                              // matches the canonical creation-form
                              // pattern.
                              if (o && !draft.carrierId) {
                                setAddCarrierErrors((p) => ({ ...p, [draft.id]: true }));
                                return;
                              }
                              updateAddDraft(draft.id, { methodOpen: o, methodSearch: o ? draft.methodSearch : "" });
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="mt-1 w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-border bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer overflow-hidden"
                              >
                                {draft.methodIds.length > 0 ? (
                                  (() => {
                                    const MAX_INLINE = 2;
                                    const visibleIds = draft.methodIds.slice(0, MAX_INLINE);
                                    const overflow = draft.methodIds.length - visibleIds.length;
                                    return (
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        {visibleIds.map((mid) => {
                                          const m = carrierMethods.find((x) => x.id === mid);
                                          if (!m) return null;
                                          const isPrimary = draft.primaryMethodId === mid;
                                          return (
                                            <span
                                              key={mid}
                                              className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border shrink-0 max-w-[140px] ${isPrimary ? "bg-primary/10 text-primary border-primary/25" : "bg-slate-50 text-slate-600 border-[#E8ECF1]"}`}
                                              style={{ fontWeight: 500 }}
                                            >
                                              {isPrimary && <Star className="w-2.5 h-2.5 fill-current shrink-0" />}
                                              <span className="truncate">{m.name}</span>
                                            </span>
                                          );
                                        })}
                                        {overflow > 0 && (
                                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-[#E8ECF1] shrink-0" style={{ fontWeight: 500 }}>+{overflow} more</span>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-300 text-sm">Select methods</span>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={4}
                              className="p-0 z-[260] flex flex-col rounded-xl border border-[#E8ECF1] bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.16)] overflow-hidden"
                              style={{ width: "var(--radix-popover-trigger-width)", maxHeight: 480 }}
                            >
                              <div className="p-2 border-b border-[#F1F5F9] shrink-0">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    value={draft.methodSearch}
                                    onChange={(e) => updateAddDraft(draft.id, { methodSearch: e.target.value })}
                                    placeholder="Search methods..."
                                    autoFocus
                                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300"
                                  />
                                </div>
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
                                {/* Create Shipping Method — opens an inline modal
                                    for adding a carrier-specific custom method. */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!draft.carrierId) return;
                                    updateAddDraft(draft.id, { methodOpen: false, methodSearch: "" });
                                    setCreateFlMethodForDraft(draft.id);
                                    setCreateFlMethodForCarrier(draft.carrierId);
                                    resetCreateFlMethodForm();
                                    setCreateFlMethodOpen(true);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                >
                                  <Plus className="w-3.5 h-3.5" /> Create Shipping Method
                                </button>
                                {(() => {
                                  const q = draft.methodSearch.toLowerCase().trim();
                                  const filtered = q
                                    ? carrierMethods.filter((m) => m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q))
                                    : carrierMethods;
                                  return (
                                    <>
                                      {filtered.length > 0 && <div className="h-px bg-[#F1F5F9] my-1 mx-1" />}
                                      {filtered.map((m) => {
                                        const checked = draft.methodIds.includes(m.id);
                                        const isPrimary = draft.primaryMethodId === m.id;
                                        const daysLabel = m.minDays === m.maxDays ? `${m.minDays} day${m.minDays !== 1 ? "s" : ""}` : `${m.minDays}-${m.maxDays} days`;
                                        const isCustom = m.id.startsWith("flcust-");
                                        return (
                                          <div
                                            key={m.id}
                                            onClick={() => {
                                              const isRemoving = checked;
                                              const next = isRemoving
                                                ? draft.methodIds.filter((x) => x !== m.id)
                                                : [...draft.methodIds, m.id];
                                              let nextPrimary = draft.primaryMethodId;
                                              if (isRemoving && draft.primaryMethodId === m.id) nextPrimary = next[0] || "";
                                              else if (!isRemoving && !draft.primaryMethodId) nextPrimary = m.id;
                                              updateAddDraft(draft.id, { methodIds: next, primaryMethodId: nextPrimary });
                                            }}
                                            className={`group/m flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/60"}`}
                                          >
                                            <div className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${checked ? "border-primary bg-primary" : "border-border bg-background"}`}>
                                              {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{m.name}</span>
                                              <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                              <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{daysLabel}</span>
                                              {isCustom && (
                                                <span className="text-[9px] text-primary bg-primary/10 px-1 py-0.5 rounded" style={{ fontWeight: 600 }}>New</span>
                                              )}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const nextIds = checked ? draft.methodIds : [...draft.methodIds, m.id];
                                                  updateAddDraft(draft.id, { methodIds: nextIds, primaryMethodId: m.id });
                                                }}
                                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                                  isPrimary
                                                    ? "text-primary"
                                                    : checked
                                                      ? "text-slate-300 hover:text-amber-500 hover:bg-white"
                                                      : "text-slate-200 opacity-0 group-hover/m:opacity-100 hover:text-amber-500 hover:bg-white"
                                                }`}
                                                title={isPrimary ? "Primary method" : "Set as primary"}
                                              >
                                                <Star className={`w-3 h-3 ${isPrimary ? "fill-primary" : ""}`} />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No methods found</p>}
                                    </>
                                  );
                                })()}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Selected methods chips — shows the picked methods
                            with a star on the primary one + remove X. */}
                        {draft.methodIds.length > 0 && (
                          <div className="col-span-2 flex flex-wrap gap-1.5">
                            {draft.methodIds.map((mid) => {
                              const m = carrierMethods.find((x) => x.id === mid);
                              if (!m) return null;
                              const isPrimary = draft.primaryMethodId === mid;
                              return (
                                <span
                                  key={mid}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border ${
                                    isPrimary
                                      ? "bg-primary/10 text-primary border-primary/25"
                                      : "bg-slate-50 text-slate-600 border-[#E8ECF1]"
                                  }`}
                                  style={{ fontWeight: 500 }}
                                >
                                  {isPrimary && <Star className="w-2.5 h-2.5 fill-current shrink-0" />}
                                  <span className="truncate max-w-[180px]">{m.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = draft.methodIds.filter((x) => x !== mid);
                                      const nextPrimary = isPrimary ? next[0] || "" : draft.primaryMethodId;
                                      updateAddDraft(draft.id, { methodIds: next, primaryMethodId: nextPrimary });
                                    }}
                                    className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Another Carrier — hidden in edit mode (one row
                  edits one saved carrier; the user can't add a
                  second carrier inside an edit session). */}
              {!editingCarrierId && (
                <button
                  type="button"
                  onClick={addAnotherDraft}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-[#DBE4F0] bg-white text-[12px] text-primary hover:bg-accent hover:border-primary/30 transition-all cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Carrier
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
            <button
              onClick={() => {
                if (isAddFlDirty()) { setAddFlDiscardOpen(true); return; }
                setAddOpen(false); setEditingCarrierId(""); resetAddModal();
              }}
              className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Validate: every draft needs a carrier + at least
                // one method. Missing carriers flag inline (red
                // border + "Please select a carrier first" beneath
                // the field). Missing methods only fall back to a
                // toast since those are dependent on a carrier
                // already being chosen.
                const carrierMissing = addDrafts.filter((d) => !d.carrierId);
                if (carrierMissing.length > 0) {
                  const next: Record<string, boolean> = {};
                  for (const d of carrierMissing) next[d.id] = true;
                  setAddCarrierErrors((p) => ({ ...p, ...next }));
                  return;
                }
                const valid = addDrafts.filter((d) => d.carrierId && d.methodIds.length > 0);
                if (valid.length === 0) {
                  toast.error("Add at least one shipping method");
                  return;
                }
                const newRows: FLCarrier[] = valid.map((d) => {
                  const c = FL_MASTER_CARRIERS.find((x) => x.id === d.carrierId)!;
                  const allMethods: FLMethod[] = [...c.methods, ...(flCustomMethods[d.carrierId] ?? [])];
                  return {
                    id: editingCarrierId || `fl-${subTab}-${c.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: c.name,
                    desc: c.desc,
                    isDefault: d.isDefault,
                    status: c.status === "Active" ? "active" : "inactive",
                    methods: allMethods
                      .filter((m) => d.methodIds.includes(m.id))
                      .map((m) => ({ ...m, isDefault: m.id === d.primaryMethodId })),
                  };
                });
                if (editingCarrierId) {
                  // Replace the existing row in place, keep order.
                  setCarriersForSubTab((prev) => {
                    const updated = prev.map((p) => p.id === editingCarrierId ? newRows[0] : p);
                    return newRows[0].isDefault
                      ? updated.map((p) => p.id === editingCarrierId ? p : { ...p, isDefault: false })
                      : updated;
                  });
                  if (newRows[0].isDefault) {
                    setPrimaryOverride((prev) => ({ ...prev, [subTab]: newRows[0].id }));
                  }
                  toast.success(`${newRows[0].name} updated`);
                } else {
                  setCarriersForSubTab((prev) => {
                    // If a new primary draft was set, clear isDefault on existing rows.
                    const cleared = newRows.some((r) => r.isDefault) ? prev.map((p) => ({ ...p, isDefault: false })) : prev;
                    return [...cleared, ...newRows];
                  });
                  const newPrimary = newRows.find((r) => r.isDefault);
                  if (newPrimary) {
                    setPrimaryOverride((prev) => ({ ...prev, [subTab]: newPrimary.id }));
                  }
                  toast.success(`${newRows.length} carrier${newRows.length > 1 ? "s" : ""} added`);
                }
                setAddOpen(false);
                setEditingCarrierId("");
                resetAddModal();
              }}
              className="px-4 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              {editingCarrierId ? "Update Methods" : "Save Methods"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Shipping Method Modal ──
          Mirrors the canonical creation-form Create Shipping Method
          modal: Mode tiles (Air / Ground / Sea / Multi-modal),
          Method Details card (name + description + min/max days),
          Coverage toggle with packaging block (Service Regions removed
          per Eli — parked on backlog). Stacks above the parent Add
          Freight & Logistics modal at z-[271] / overlay z-[270]. On
          Save, the new method is added to flCustomMethods, auto-checks
          on the active draft, and shows up immediately in the Methods
          popover. */}
      <Dialog
        open={createFlMethodOpen}
        onOpenChange={(open) => {
          if (open) { setCreateFlMethodOpen(true); return; }
          if (isCsmFormDirty()) { setCsmDiscardOpen(true); return; }
          setCreateFlMethodOpen(false); resetCreateFlMethodForm();
        }}
      >
        <DialogContent
          className="!p-0 !gap-0 overflow-hidden flex flex-col z-[271] !border-0 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          overlayClassName="!bg-black/40 !z-[270]"
          style={{ maxWidth: "min(62vw, 820px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "88vh", borderRadius: 14, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)" }}
          hideCloseButton
          onPointerDownOutside={(e) => {
            // Block backdrop close when there's unsaved data; the
            // controlled onOpenChange already routes through the
            // discard prompt.
            if (isCsmFormDirty()) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isCsmFormDirty()) { e.preventDefault(); setCsmDiscardOpen(true); }
          }}
        >
          <DialogTitle className="sr-only">Create Shipping Method</DialogTitle>
          <DialogDescription className="sr-only">Define mode, lead time, and coverage for the new shipping method.</DialogDescription>

          {/* Header — title + chip + carrier context badge + subtitle */}
          <div className="px-4 sm:px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Create Shipping Method</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    <Truck className="w-3 h-3" /> Shipping Method
                  </span>
                  {(() => {
                    const c = FL_MASTER_CARRIERS.find((x) => x.id === createFlMethodForCarrier);
                    if (!c) return null;
                    const logo = getCarrierLogo(c.name);
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E8ECF1] bg-white text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                        {logo ? <img src={logo} alt={c.name} className="w-3.5 h-3.5 object-contain rounded" /> : <Truck className="w-3 h-3 text-slate-400" />}
                        {c.name}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                  Add a shipping method this carrier offers. Coverage is optional.
                </p>
              </div>
              <button
                onClick={() => {
                  if (isCsmFormDirty()) { setCsmDiscardOpen(true); return; }
                  setCreateFlMethodOpen(false); resetCreateFlMethodForm();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — Mode tiles + Method Details + Coverage */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
            <div className="px-4 py-4 space-y-5">
              {/* Mode — 4 tiles (Air, Ground, Sea, Multi-modal) */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Mode</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                      <p className="text-slate-500">Pick how this method moves cargo. Hover each card for details.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(["air", "ground", "sea", "multi"] as const).map((m) => {
                    const isActive = createFlMethodForm.mode === m;
                    const cfg = m === "air"
                      ? { icon: Plane, label: "Air", desc: "Time-critical", color: "#0A77FF", bg: "#EBF3FF", border: "#7AB8FF", hoverBorder: "hover:border-blue-200", hoverCircle: "group-hover:border-[#7AB8FF]", explain: "Fastest mode, used for time-critical or high-value goods.", example: "Priority Overnight", exampleDesc: "1-day international parcel delivery." }
                      : m === "ground"
                      ? { icon: Truck, label: "Ground", desc: "Road · Rail", color: "#22C55E", bg: "#F0FDF4", border: "#86EFAC", hoverBorder: "hover:border-green-200", hoverCircle: "group-hover:border-[#86EFAC]", explain: "Road or rail, standard for domestic and regional shipments.", example: "Ground Freight", exampleDesc: "5-day cross-country LTL or full truckload." }
                      : m === "sea"
                      ? { icon: Ship, label: "Sea", desc: "Bulk · Ocean", color: "#06B6D4", bg: "#ECFEFF", border: "#67E8F9", hoverBorder: "hover:border-cyan-200", hoverCircle: "group-hover:border-[#67E8F9]", explain: "Ocean freight, lowest cost for bulk and international cargo.", example: "Ocean Container", exampleDesc: "4-week port-to-port FCL shipping." }
                      : { icon: Layers, label: "Multi-Modal", desc: "Combined", color: "#F59E0B", bg: "#FFFBEB", border: "#FCD34D", hoverBorder: "hover:border-amber-200", hoverCircle: "group-hover:border-[#FCD34D]", explain: "Combines two or more modes on a single route.", example: "Sea + Truck", exampleDesc: "Ocean leg to port, then drayage to warehouse." };
                    const Icon = cfg.icon;
                    return (
                      <Tooltip key={m}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => setCreateFlMethodForm((p) => ({ ...p, mode: m }))}
                            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                              isActive ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" : `border-border bg-white ${cfg.hoverBorder} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                            }`}
                            style={isActive ? { borderColor: `${cfg.border}b3` } : undefined}
                          >
                            <div
                              className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
                              style={{ background: `linear-gradient(135deg, ${cfg.bg}80 0%, transparent 70%)` }}
                            />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div
                                className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "" : "group-hover:scale-105"}`}
                                style={{ background: `linear-gradient(135deg, ${cfg.bg}, ${cfg.border}40)`, color: cfg.color }}
                              >
                                <Icon className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-[13px] truncate transition-colors duration-150 ${isActive ? "" : "text-foreground group-hover:text-slate-800"}`}
                                  style={{ fontWeight: 600, color: isActive ? cfg.color : undefined }}
                                >
                                  {cfg.label}
                                </p>
                                <p className="text-[11px] mt-0.5 truncate transition-colors duration-150" style={{ color: isActive ? cfg.color : "#94A3B8" }}>
                                  {cfg.desc}
                                </p>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                                  isActive ? "" : `border-[1.5px] border-[#D1D5DB] bg-white ${cfg.hoverCircle}`
                                }`}
                                style={isActive ? { backgroundColor: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}26` } : {}}
                              >
                                {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">{cfg.explain}</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1">
                              <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.example}</span>: {cfg.exampleDesc}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Method Details — name + description + min/max days */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Method Details</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                      <p className="text-slate-500">Name, summary, and transit window shown on POs and order tracking.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                        Shipping Method Name<span className="text-destructive ml-0.5">*</span>
                      </label>
                      <Input
                        value={createFlMethodForm.name}
                        onChange={(e) => setCreateFlMethodForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Express, Ground"
                        className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    {/* Description — expandable textarea (matches the
                        canonical creation-form modal). Use "contained"
                        mode since we're inside a fixed-width dialog and
                        the full slide-out would overflow. */}
                    <ExpandableTextarea
                      label="Description"
                      value={createFlMethodForm.desc}
                      onChange={(v) => setCreateFlMethodForm((p) => ({ ...p, desc: v }))}
                      placeholder="Brief summary of what this shipping method covers."
                      expandMode="contained"
                    />
                    <div>
                      <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum (Days)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={createFlMethodForm.minDays}
                          onChange={(e) => setCreateFlMethodForm((p) => ({ ...p, minDays: e.target.value }))}
                          placeholder="e.g. 3"
                          className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum (Days)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={createFlMethodForm.maxDays}
                          onChange={(e) => setCreateFlMethodForm((p) => ({ ...p, maxDays: e.target.value }))}
                          placeholder="e.g. 6"
                          className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coverage — toggle + packaging block. Service Regions field
                  was removed per Eli (parked on backlog) — coverage now
                  scopes to packaging details only. */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Coverage</span>
                  <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                      <p className="text-slate-500">Capture packaging so this method routes correctly. Skip if it handles anything within the carrier's defaults.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center gap-2.5">
                    <Switch checked={createFlMethodForm.showCoverage} onCheckedChange={(v) => setCreateFlMethodForm((p) => ({ ...p, showCoverage: v }))} />
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Add Coverage Details</span>
                    <span className="text-[11px] text-slate-400">Specify packaging for this method.</span>
                  </div>
                  {createFlMethodForm.showCoverage && (
                    <div className="mt-4 pt-4 border-t border-[#EEF2F6] space-y-4">
                      {/* Packaging — Standard pills (parcel/box/pallet/
                          ltl/ftl) OR Custom (3D box illustration + L/W/H
                          inputs). Mirrors the canonical creation-form
                          modal block exactly. */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Packaging</label>
                          <div className="inline-flex rounded-md bg-muted p-0.5">
                            {(["standard", "custom"] as const).map((m) => {
                              const isSelected = createFlMethodForm.packagingMode === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setCreateFlMethodForm((p) => ({ ...p, packagingMode: m }))}
                                  className={`px-2.5 h-7 rounded-sm text-[11px] transition-all cursor-pointer ${
                                    isSelected ? "bg-white shadow-sm text-foreground" : "text-slate-500 hover:text-slate-700"
                                  }`}
                                  style={{ fontWeight: isSelected ? 600 : 500 }}
                                >
                                  {m === "standard" ? "Standard" : "Custom"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {createFlMethodForm.packagingMode === "standard" ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(["parcel", "box", "pallet", "ltl", "ftl"] as PackageType[]).map((pt) => {
                              const selected = createFlMethodForm.packageTypes.includes(pt);
                              const info = pt === "parcel"
                                ? { desc: "Small individual packages handled by parcel carriers (FedEx, UPS, USPS).", example: "Up to 70 lb · max 108 in length + girth", useCase: "E-commerce orders, individual parcels, small B2B." }
                                : pt === "box"
                                ? { desc: "Standard cardboard cartons, bulkier than a parcel, smaller than a pallet.", example: "Up to 150 lb · single carton", useCase: "Retail bulk shipments, multi-item B2B orders." }
                                : pt === "pallet"
                                ? { desc: "Standardized wooden pallet (48×40 in) carrying stacked goods.", example: "48×40 in · up to 4,000 lb", useCase: "Warehouse-to-warehouse, bulk B2B distribution." }
                                : pt === "ltl"
                                ? { desc: "Less-Than-Truckload, multiple shippers share a single truck.", example: "1 to 6 pallets · 150 to 15,000 lb", useCase: "Mid-volume freight, regional distribution lanes." }
                                : { desc: "Full Truckload, your shipment fills the entire truck. Fastest freight tier.", example: "Up to 26 pallets · 26,000 to 44,000 lb", useCase: "High-volume, time-sensitive freight, single destination." };
                              return (
                                <Tooltip key={pt}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCreateFlMethodForm((p) => ({
                                          ...p,
                                          packageTypes: selected ? p.packageTypes.filter((x) => x !== pt) : [...p.packageTypes, pt],
                                        }));
                                      }}
                                      className={`px-3 h-8 rounded-md border text-[12px] transition-all cursor-pointer ${
                                        selected ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-white text-slate-600 hover:border-slate-300"
                                      }`}
                                      style={{ fontWeight: selected ? 600 : 500 }}
                                    >
                                      {PACKAGE_TYPE_LABELS[pt]}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">{info.desc}</p>
                                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Typical Size</p>
                                      <p className="text-[11px] text-slate-700 mt-1" style={{ fontWeight: 600 }}>{info.example}</p>
                                      <p className="text-[10px] text-slate-400 tracking-wide mt-2" style={{ fontWeight: 600 }}>When to Use</p>
                                      <p className="text-[11px] text-slate-600 mt-1">{info.useCase}</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* 3D box illustration — isometric cardboard
                                box that reflects the L/W/H values typed
                                by the user. Defaults to a balanced
                                placeholder when all three are empty. */}
                            {(() => {
                              const f = createFlMethodForm;
                              const L = Math.max(parseFloat(f.length) || 0, 0);
                              const W = Math.max(parseFloat(f.width) || 0, 0);
                              const H = Math.max(parseFloat(f.height) || 0, 0);
                              const anyTyped = L > 0 || W > 0 || H > 0;
                              const fallback = anyTyped ? Math.max(L, W, H) : 60;
                              const valL = L > 0 ? L : fallback;
                              const valW = W > 0 ? W : fallback * 0.7;
                              const valH = H > 0 ? H : fallback;
                              const maxDim = Math.max(valL, valW, valH, 1);
                              const scale = 130 / maxDim;
                              const pxL = Math.max(valL * scale, 14);
                              const pxW = Math.max(valW * scale, 14);
                              const pxH = Math.max(valH * scale, 14);
                              const dx = pxW * 0.55;
                              const dy = -pxW * 0.34;
                              const cx = 135;
                              const baseY = 168;
                              const flx = cx - pxL / 2 - dx / 2;
                              const fty = baseY - pxH;
                              const fbl: [number, number] = [flx, baseY];
                              const fbr: [number, number] = [flx + pxL, baseY];
                              const ftl: [number, number] = [flx, fty];
                              const ftr: [number, number] = [flx + pxL, fty];
                              const bbr: [number, number] = [fbr[0] + dx, fbr[1] + dy];
                              const btl: [number, number] = [ftl[0] + dx, ftl[1] + dy];
                              const btr: [number, number] = [ftr[0] + dx, ftr[1] + dy];
                              const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
                              const topPts = `${pt(ftl)} ${pt(btl)} ${pt(btr)} ${pt(ftr)}`;
                              const frontPts = `${pt(fbl)} ${pt(ftl)} ${pt(ftr)} ${pt(fbr)}`;
                              const rightPts = `${pt(fbr)} ${pt(ftr)} ${pt(btr)} ${pt(bbr)}`;
                              const tapeFront: [number, number] = [
                                ftl[0] + (ftr[0] - ftl[0]) * 0.5 - 18,
                                ftl[1] + (ftr[1] - ftl[1]) * 0.5,
                              ];
                              const tapeFrontEdge = (offset: number): [number, number] => [
                                ftl[0] + (ftr[0] - ftl[0]) * 0.5 + offset + dx * 0.5,
                                ftl[1] + (ftr[1] - ftl[1]) * 0.5 + dy * 0.5,
                              ];
                              const seamTop: [number, number] = [(ftl[0] + ftr[0]) / 2, (ftl[1] + ftr[1]) / 2];
                              const seamBot: [number, number] = [(fbl[0] + fbr[0]) / 2, (fbl[1] + fbr[1]) / 2];
                              const hGuideX = btr[0] + 9;
                              const hLabelY = (btr[1] + bbr[1]) / 2 + 4;
                              const lGuideY = baseY + 10;
                              const lLabelX = (fbl[0] + fbr[0]) / 2 - 3;
                              const wMid: [number, number] = [(fbr[0] + bbr[0]) / 2 + 6, (fbr[1] + bbr[1]) / 2 + 5];
                              const hint = anyTyped ? "" : "Typical 60×42×60 in placeholder shown";
                              return (
                                <div className="flex flex-col items-center justify-center py-2 group/box">
                                  <svg width="220" height="190" viewBox="0 0 280 200" className="select-none transition-transform duration-300 ease-out group-hover/box:scale-[1.04]" aria-hidden="true">
                                    <defs>
                                      <linearGradient id="csmFlBoxTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#F4DDB1" />
                                        <stop offset="55%" stopColor="#E5C48C" />
                                        <stop offset="100%" stopColor="#CFA467" />
                                      </linearGradient>
                                      <linearGradient id="csmFlBoxFront" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#D9A86A" />
                                        <stop offset="100%" stopColor="#A97A41" />
                                      </linearGradient>
                                      <linearGradient id="csmFlBoxRight" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#B58451" />
                                        <stop offset="100%" stopColor="#7E5828" />
                                      </linearGradient>
                                      <radialGradient id="csmFlBoxShadow" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#1E293B" stopOpacity="0.45" />
                                        <stop offset="100%" stopColor="#1E293B" stopOpacity="0" />
                                      </radialGradient>
                                    </defs>
                                    <ellipse cx={cx} cy={baseY + 14} rx={Math.min(pxL * 0.55 + dx * 0.4, 110)} ry={9} fill="url(#csmFlBoxShadow)" />
                                    <g style={{ transformOrigin: `${cx}px ${(fty + baseY) / 2}px` }}>
                                      <polygon points={rightPts} fill="url(#csmFlBoxRight)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                      <polygon points={topPts} fill="url(#csmFlBoxTop)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                      <polygon points={frontPts} fill="url(#csmFlBoxFront)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                      <polygon
                                        points={`${pt([tapeFront[0], tapeFront[1]])} ${pt([tapeFront[0] + 36, tapeFront[1]])} ${pt(tapeFrontEdge(36 - 2))} ${pt(tapeFrontEdge(2))}`}
                                        fill="#9A6F3D"
                                        opacity="0.55"
                                      />
                                      <line x1={seamTop[0]} y1={seamTop[1]} x2={seamBot[0]} y2={seamBot[1]} stroke="#6B4920" strokeWidth="0.6" opacity="0.55" strokeDasharray="2 2.5" />
                                      <line x1={ftl[0]} y1={ftl[1]} x2={ftr[0]} y2={ftr[1]} stroke="#FCEAC4" strokeWidth="1" opacity="0.55" />
                                      <line x1={btl[0]} y1={btl[1]} x2={btr[0]} y2={btr[1]} stroke="#FCEAC4" strokeWidth="1" opacity="0.45" />
                                      <line x1={ftl[0]} y1={ftl[1]} x2={btl[0]} y2={btl[1]} stroke="#FCEAC4" strokeWidth="0.75" opacity="0.4" />
                                      <line x1={ftr[0]} y1={ftr[1]} x2={fbr[0]} y2={fbr[1]} stroke="#5C3F1A" strokeWidth="0.5" opacity="0.45" />
                                    </g>
                                    <line x1={hGuideX} y1={btr[1]} x2={hGuideX} y2={bbr[1]} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                    <text x={hGuideX + 4} y={hLabelY} fontSize="12" fill="#475569" fontWeight="700">H</text>
                                    <line x1={fbl[0]} y1={lGuideY} x2={fbr[0]} y2={lGuideY} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                    <text x={lLabelX} y={lGuideY + 12} fontSize="12" fill="#475569" fontWeight="700">L</text>
                                    <line x1={fbr[0] + 4} y1={fbr[1] + 4} x2={bbr[0] + 4} y2={bbr[1] + 4} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                    <text x={wMid[0]} y={wMid[1]} fontSize="12" fill="#475569" fontWeight="700">W</text>
                                  </svg>
                                  {hint && (
                                    <p className="text-[10px] text-slate-400 mt-1" style={{ fontWeight: 500 }}>{hint}</p>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Weight + L/W/H grid with unit selectors. */}
                            <div className="grid grid-cols-4 gap-2">
                              {([
                                { key: "weight" as const, label: "Weight", unitField: "weightUnit" as const, units: ["lb", "kg", "g", "oz"] as const, placeholder: "0" },
                                { key: "length" as const, label: "Length", unitField: "dimensionUnit" as const, units: ["in", "cm", "mm", "ft"] as const, placeholder: "0" },
                                { key: "width" as const, label: "Width", unitField: "dimensionUnit" as const, units: ["in", "cm", "mm", "ft"] as const, placeholder: "0" },
                                { key: "height" as const, label: "Height", unitField: "dimensionUnit" as const, units: ["in", "cm", "mm", "ft"] as const, placeholder: "0" },
                              ]).map((field) => (
                                <div key={field.key}>
                                  <label className="text-[11px] text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>{field.label}</label>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={createFlMethodForm[field.key]}
                                      onChange={(e) => setCreateFlMethodForm((p) => ({ ...p, [field.key]: e.target.value }))}
                                      placeholder={field.placeholder}
                                      className="h-9 rounded-md border-border bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                                      inputMode="numeric"
                                    />
                                    <select
                                      value={createFlMethodForm[field.unitField]}
                                      onChange={(e) => setCreateFlMethodForm((p) => ({ ...p, [field.unitField]: e.target.value as never }))}
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-1.5 rounded-md border-0 bg-slate-100 text-[10px] text-slate-600 cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                      style={{ fontWeight: 600 }}
                                      aria-label={`${field.label} unit`}
                                    >
                                      {field.units.map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Service Regions field removed per Eli — backlog. */}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0">
            <button
              onClick={() => {
                if (isCsmFormDirty()) { setCsmDiscardOpen(true); return; }
                setCreateFlMethodOpen(false); resetCreateFlMethodForm();
              }}
              className="px-4 h-9 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-muted transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Discard
            </button>
            <button
              onClick={() => {
                const f = createFlMethodForm;
                if (!f.name.trim()) {
                  toast.error("Shipping method name is required");
                  return;
                }
                const newMethod: FLMethod = {
                  id: `flcust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: f.name.trim(),
                  shortName: f.shortName.trim() || (f.mode === "air" ? "Air" : f.mode === "ground" ? "Ground" : f.mode === "sea" ? "Sea" : f.mode === "multi" ? "Multi" : "Custom"),
                  desc: f.desc.trim() || "Custom method",
                  minDays: Math.max(0, parseInt(f.minDays || "1", 10) || 1),
                  maxDays: Math.max(0, parseInt(f.maxDays || f.minDays || "1", 10) || 1),
                  isDefault: false,
                  // Cost was dropped from the form per stakeholder
                  // feedback — real shipping pricing depends on weight,
                  // distance, hazard class, packaging, etc., and is
                  // tracked as a backlog carrier-API integration. The
                  // FLMethod shape still requires cost, so we mark
                  // custom methods with an em dash for now.
                  cost: "—",
                };
                setFlCustomMethods((prev) => ({
                  ...prev,
                  [createFlMethodForCarrier]: [...(prev[createFlMethodForCarrier] ?? []), newMethod],
                }));
                setAddDrafts((prev) => prev.map((d) => {
                  if (d.id !== createFlMethodForDraft) return d;
                  const nextIds = [...d.methodIds, newMethod.id];
                  return { ...d, methodIds: nextIds, primaryMethodId: d.primaryMethodId || newMethod.id };
                }));
                toast.success(`"${newMethod.name}" added`);
                setCreateFlMethodOpen(false);
                resetCreateFlMethodForm();
              }}
              className="px-5 h-9 rounded-lg bg-primary text-white text-[12px] hover:bg-[#086AE6] transition-colors cursor-pointer shadow-sm"
              style={{ fontWeight: 600 }}
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Discard-confirmation prompts ──
          Centered red-glow layout that matches the canonical
          "Discard partner creation?" prompt used elsewhere in
          the system: gradient header, AlertTriangle icon, DISCARD
          pill, stacked Discard / Continue editing buttons. Both
          the Add Freight & Logistics modal and the inline Create
          Shipping Method modal route their close paths through
          these. */}
      <AlertDialog open={csmDiscardOpen} onOpenChange={setCsmDiscardOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          overlayClassName="!z-[289] !bg-black/50"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setCsmDiscardOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Discard new shipping method?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The mode, details, and coverage you entered will be lost. This action cannot be undone.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => { setCsmDiscardOpen(false); setCreateFlMethodOpen(false); resetCreateFlMethodForm(); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Discard Changes
              </button>
              <button
                onClick={() => setCsmDiscardOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={addFlDiscardOpen} onOpenChange={setAddFlDiscardOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          overlayClassName="!z-[289] !bg-black/50"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setAddFlDiscardOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Discard freight & logistics changes?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The carriers and methods you picked will be lost. This action cannot be undone.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => { setAddFlDiscardOpen(false); setAddOpen(false); setEditingCarrierId(""); resetAddModal(); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Discard Changes
              </button>
              <button
                onClick={() => setAddFlDiscardOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Carrier Details modal ──
          Read-only summary opened via whole-card click or the
          three-dot "View Details" item. Surfaces the carrier
          name, description, applied methods (with cost + transit
          window), and the primary chip.  Edit / Remove route to
          the same flows the dropdown uses so users can pivot from
          read to action without closing first. */}
      <Dialog open={!!detailsCarrier} onOpenChange={(open) => { if (!open) setDetailsCarrier(null); }}>
        <DialogContent
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col !border-border/60"
          style={{ maxWidth: "min(60vw, 600px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "85vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          hideCloseButton
        >
          <DialogTitle className="sr-only">Carrier Details</DialogTitle>
          <DialogDescription className="sr-only">Read-only summary of the carrier and its methods.</DialogDescription>
          {detailsCarrier && (
            <>
              <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-2xl border-b border-[#EEF2F6]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-stretch rounded-full overflow-hidden border border-blue-200 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-blue-800 bg-blue-50" style={{ fontWeight: 600 }}>
                          <Truck className="w-3 h-3" /> Carrier
                        </span>
                        <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-blue-200" style={{ fontWeight: 500 }}>
                          {detailsCarrier.methods.length} Method{detailsCarrier.methods.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                      {detailsCarrier.isDefault && <PrimaryPill />}
                      <span className={`px-1.5 py-[2px] rounded-md text-[10px] border ${detailsCarrier.status === "active" ? "border-[#BBF7D0] bg-green-50 text-[#166534]" : "border-border bg-slate-50 text-slate-400"}`} style={{ fontWeight: 500 }}>
                        {detailsCarrier.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h2 className="text-[16px] sm:text-[17px] text-foreground mt-2" style={{ fontWeight: 700 }}>{detailsCarrier.name}</h2>
                    <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>{detailsCarrier.desc}</p>
                  </div>
                  <button onClick={() => setDetailsCarrier(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#FAFBFC] space-y-2">
                <p className="text-[10px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Methods</p>
                {detailsCarrier.methods.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-white px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{m.name}</span>
                        {m.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] bg-primary/10 text-primary" style={{ fontWeight: 600 }}>
                            <Star className="w-2.5 h-2.5 fill-current" /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                    <div className="text-right shrink-0 leading-tight">
                      <div className="inline-flex items-center gap-1 text-[12px] text-slate-600" style={{ fontWeight: 600 }}>
                        <Clock className="w-3 h-3 text-slate-400" />
                        {m.minDays === m.maxDays ? `${m.minDays} day${m.minDays !== 1 ? "s" : ""}` : `${m.minDays} to ${m.maxDays} days`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
                <button
                  onClick={() => setDetailsCarrier(null)}
                  className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const c = detailsCarrier;
                    setDetailsCarrier(null);
                    // Same name/shortName remap as the card-menu
                    // Edit handler so seed-created rows resolve
                    // their methods correctly against the catalog.
                    const master = FL_MASTER_CARRIERS.find((m) => m.name === c.name) ?? FL_MASTER_CARRIERS[0];
                    const catalogIds: string[] = [];
                    let primaryCatalogId = "";
                    for (const saved of c.methods) {
                      const match = master.methods.find((cm) => cm.name === saved.name || cm.shortName === saved.shortName);
                      if (match) {
                        catalogIds.push(match.id);
                        if (saved.isDefault) primaryCatalogId = match.id;
                      }
                    }
                    setEditingCarrierId(c.id);
                    setAddDrafts([{
                      ...makeAddDraft(),
                      carrierId: master.id,
                      methodIds: catalogIds,
                      primaryMethodId: primaryCatalogId || catalogIds[0] || "",
                      isDefault: c.isDefault,
                    }]);
                    setAddOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  style={{ fontWeight: 600 }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remove-carrier confirmation ──
          Same canonical red-glow Discard layout but framed for a
          delete action ("Remove carrier?"). Keeps the lifecycle-
          modal contract used by Pricing Rules and elsewhere. */}
      <AlertDialog open={!!removeCarrier} onOpenChange={(open) => { if (!open) setRemoveCarrier(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setRemoveCarrier(null)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}>
              Remove {subTab === "vendor" ? "Vendor" : "Customer"} Carrier
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                Remove {removeCarrier?.name}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              The carrier and its methods will be removed from this {subTab === "vendor" ? "vendor" : "customer"} side. You can re-add it later from Add Freight.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (!removeCarrier) return;
                  const id = removeCarrier.id;
                  const name = removeCarrier.name;
                  setCarriersForSubTab((prev) => prev.filter((c) => c.id !== id));
                  // Clear the override if the removed row was the
                  // active primary so the next save / paint doesn't
                  // reference a deleted id.
                  setPrimaryOverride((prev) => prev[subTab] === id ? { ...prev, [subTab]: null } : prev);
                  setRemoveCarrier(null);
                  toast.success(`${name} removed`);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Remove
              </button>
              <button
                onClick={() => setRemoveCarrier(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Status-change confirmation ──
          Amber when deactivating (rule fires on new orders →
          stops), emerald when reactivating. Same canonical
          lifecycle modal contract used by Pricing Rules. */}
      {/* ── Primary-change confirmation ──
          Fires when the star is clicked on a non-primary carrier
          while another carrier already holds primary on this side.
          Same canonical lifecycle modal contract: gradient header,
          icon, uppercase pill, stacked actions. Blue palette since
          this is "promote", not destructive. */}
      <AlertDialog open={!!primaryChange} onOpenChange={(open) => { if (!open) setPrimaryChange(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setPrimaryChange(null)}
        >
          {(() => {
            if (!primaryChange) return null;
            const existingPrimary = carriers.find((c) => (overrideId !== null ? c.id === overrideId : c.isDefault));
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
                    <Star className="w-8 h-8 fill-[#094D9F]" style={{ color: "#094D9F" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
                    Change Primary {subTab === "vendor" ? "Vendor" : "Customer"} Carrier
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                      Make {primaryChange.name} the primary carrier?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {existingPrimary && existingPrimary.id !== primaryChange.id ? (
                      <>New {subTab === "vendor" ? "inbound" : "outbound"} shipments will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{primaryChange.name}</span> instead of <span className="text-foreground" style={{ fontWeight: 600 }}>{existingPrimary.name}</span>. Existing shipments are unaffected. You can switch back any time.</>
                    ) : (
                      <>New {subTab === "vendor" ? "inbound" : "outbound"} shipments will default to <span className="text-foreground" style={{ fontWeight: 600 }}>{primaryChange.name}</span>. You can switch back any time.</>
                    )}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        const c = primaryChange;
                        setPrimaryOverride((prev) => ({ ...prev, [subTab]: c.id }));
                        toast.success(`${c.name} is now the primary ${subTab} carrier`);
                        setPrimaryChange(null);
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))", color: "#fff" }}
                    >
                      Make Primary
                    </button>
                    <button
                      onClick={() => setPrimaryChange(null)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      Keep Current Primary
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!statusChange} onOpenChange={(open) => { if (!open) setStatusChange(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 290 }}
          onInteractOutside={() => setStatusChange(null)}
        >
          {(() => {
            if (!statusChange) return null;
            const { carrier: sc, next } = statusChange;
            const isDeactivating = next === "inactive";
            // Amber palette for "this is about to stop firing"
            // (deactivate); emerald for "this is going to start
            // firing again" (reactivate).
            const palette = isDeactivating
              ? { headerBg: "#FFFBEB", headerBgFade: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", pillBg: "#FFFBEB", pillColor: "#92400E", actionBg: "#F59E0B", pillLabel: `Deactivate ${subTab === "vendor" ? "Vendor" : "Customer"} Carrier` }
              : { headerBg: "#ECFDF5", headerBgFade: "rgba(236,253,245,0.3)", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#047857", pillBg: "#ECFDF5", pillColor: "#065F46", actionBg: "#10B981", pillLabel: `Activate ${subTab === "vendor" ? "Vendor" : "Customer"} Carrier` };
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${palette.headerBg} 0%, ${palette.headerBgFade} 70%, transparent 100%)` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: palette.glow }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: palette.iconBg }}>
                    <CircleSlash className="w-8 h-8" style={{ color: palette.iconColor }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: palette.pillBg, color: palette.pillColor, letterSpacing: "0.05em" }}>
                    {palette.pillLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                      {isDeactivating ? `Mark ${sc.name} as Inactive?` : `Mark ${sc.name} as Active?`}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {isDeactivating
                      ? <>The carrier stops being available for new {subTab === "vendor" ? "inbound" : "outbound"} shipments. Existing shipment records keep their snapshot. Re-activate any time from the same menu.</>
                      : <>The carrier becomes available again for new {subTab === "vendor" ? "inbound" : "outbound"} shipments to this partner.</>
                    }
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setCarriersForSubTab((prev) => prev.map((c) => c.id === sc.id ? { ...c, status: next } : c));
                        toast.success(isDeactivating ? `${sc.name} marked as Inactive` : `${sc.name} marked as Active`);
                        setStatusChange(null);
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: palette.actionBg, color: "#fff" }}
                    >
                      {isDeactivating ? "Mark as Inactive" : "Mark as Active"}
                    </button>
                    <button
                      onClick={() => setStatusChange(null)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      {isDeactivating ? "Keep Active" : "Keep Inactive"}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----- PAYMENT METHODS TAB -----
function PaymentMethodsTab({ cfg, PAYMENT_TYPE_ICONS: _PAYMENT_TYPE_ICONS }: { cfg?: VendorConfigData; PAYMENT_TYPE_ICONS: Record<string, React.ElementType> }) {
  // Fixed discounts and charges are in the partner's currency.
  const pmCurrency = useProfileMoney().partnerCurrency;
  type PMSubTab = "vendor" | "customer";
  type PMEntry = import("../components/vendors/partnerConstants").PaymentMethodEntry;

  // Seed entries from cfg.paymentMethods. All seeded methods land
  // on the vendor side initially (the partner-detail page is a
  // vendor partner today); customer side starts empty for the
  // user to populate. First entry on each side is primary by
  // default.
  const seedEntries = React.useMemo<PMEntry[]>(() => {
    if (!cfg?.paymentMethods || cfg.paymentMethods.length === 0) return [];
    return cfg.paymentMethods.map((pm, idx): PMEntry => ({
      id: pm.id,
      type: pm.type as import("../components/vendors/partnerConstants").PaymentMethodType,
      expanded: false,
      isSaved: pm.isSaved,
      isPrimary: idx === 0,
      nickname: pm.typeLabel,
      bankName: pm.bankName || "",
      accountTitle: "",
      accountNumber: pm.accountNumber || "",
      routingNumber: pm.routingNumber || "",
      swiftCode: pm.wireRoutingNumber || "",
      accountType: "checking" as const,
      cardholderName: "",
      cardNumber: pm.cardNumber || "",
      expiryDate: pm.expiryDate || "",
      billingAddress: "",
      walletProvider: pm.walletProvider || "",
      walletId: pm.walletId || "",
      payeeName: pm.checkPayableTo || "",
      mailingAddress: "",
      recipientName: "",
      collectionPoint: "",
      methodName: "",
      description: "",
      documentLink: "",
      phone: "",
      countryCode: "+1",
      specialInstructions: "",
      applyDiscount: (pm.discountPercent != null && pm.discountPercent > 0) || (pm.additionalChargesPercent != null && pm.additionalChargesPercent > 0),
      discountPercent: pm.discountPercent != null ? String(pm.discountPercent) : "",
      additionalCharges: pm.additionalChargesPercent != null ? String(pm.additionalChargesPercent) : "",
      discountMode: "percent" as const,
      additionalChargesMode: "percent" as const,
    }));
  }, [cfg]);

  const [subTab, setSubTab] = useState<PMSubTab>("vendor");
  const [vendorEntries, setVendorEntries] = useState<PMEntry[]>(() => seedEntries);
  const [customerEntries, setCustomerEntries] = useState<PMEntry[]>([]);
  // Refs so the outer toolbar's Add CTA can drive each side's
  // PaymentMethodsSection.openAddModal — same pattern F&L uses.
  const vendorPmRef = React.useRef<import("../components/vendors/PaymentMethodsSection").PaymentMethodsSectionHandle>(null);
  const customerPmRef = React.useRef<import("../components/vendors/PaymentMethodsSection").PaymentMethodsSectionHandle>(null);

  const tint = subTab === "vendor"
    ? { color: "#0548A3", bg: "#EBF3FF", border: "#A8D2FF", hoverBg: "#CFE6FF" }
    : { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", hoverBg: "#D1FAE5" };
  const activeEntries = subTab === "vendor" ? vendorEntries : customerEntries;
  const activeSavedCount = activeEntries.filter((e) => e.isSaved).length;

  // Helpers per side — match the signatures PaymentMethodsSection
  // expects (updatePaymentEntry / savePaymentEntry / removePaymentEntry).
  // Forked from CreatePartnerModal so the canonical Add Payment
  // Method modal + per-type sub-modals work identically here.
  const makeHandlers = (
    setEntries: React.Dispatch<React.SetStateAction<PMEntry[]>>,
  ) => ({
    updatePaymentEntry: (id: string, updates: Partial<PMEntry>) =>
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e))),
    savePaymentEntry: (id: string) =>
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isSaved: true, isPrimary: prev.some((x) => x.isPrimary) ? e.isPrimary : true } : e))),
    removePaymentEntry: (id: string) =>
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        // Promote first remaining row to primary if we just dropped the primary one.
        if (next.length > 0 && !next.some((e) => e.isPrimary)) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      }),
  });
  const vendorHandlers = makeHandlers(setVendorEntries);
  const customerHandlers = makeHandlers(setCustomerEntries);

  return (
    <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col" style={{ minHeight: 400 }}>
      {/* Sub-tabs row — same shape as F&L: sub-tabs on the left,
          count + tinted Add CTA on the right. Single Add button
          location for both sides; PaymentMethodsSection's own
          toolbar is hidden via hideToolbar. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border shrink-0">
        <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
          {([
            { key: "vendor" as PMSubTab, label: "Vendor Payment Methods", color: "#0548A3", tip: "How this partner pays you (or is paid by you) on this partner's invoices." },
            { key: "customer" as PMSubTab, label: "Customer Payment Methods", color: "#065F46", tip: "How you collect payment from this partner on outbound sales orders." },
          ]).map((t) => {
            const active = subTab === t.key;
            return (
              <Tooltip key={t.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSubTab(t.key)}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                      active ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                    }`}
                    style={{ fontWeight: active ? 600 : 500, color: active ? t.color : undefined }}
                  >
                    <CreditCard className="w-3.5 h-3.5" style={{ color: active ? t.color : "#94A3B8" }} />
                    {t.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                  <p className="text-slate-500">{t.tip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-sm hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{activeSavedCount}</span>
            <span className="text-muted-foreground/70"> {activeSavedCount === 1 ? "method" : "methods"}</span>
          </span>
          <button
            type="button"
            onClick={() => (subTab === "vendor" ? vendorPmRef : customerPmRef).current?.openAddModal()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: tint.bg, borderColor: tint.border, color: tint.color }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{subTab === "vendor" ? "Add Vendor Payment Method" : "Add Customer Payment Method"}</span>
          </button>
        </div>
      </div>

      {/* Body — canonical PaymentMethodsSection per side. Pulls
          the same Add Payment Method modal (type-picker grid +
          per-type form sub-modal) used in the partner creation
          form, so adding a method on the detail page goes through
          the exact same flow. Internal toolbar is hidden — outer
          row above owns the count + Add CTA. Clicking a card opens
          a read-only view; Edit/Remove live in that modal's header.
          confirmMutations prompts before saving edits / removing. */}
      <div className="flex-1 overflow-auto p-4">
        {subTab === "vendor" ? (
          <PaymentMethodsSection
            ref={vendorPmRef}
            configType="vendor"
            paymentEntries={vendorEntries}
            setPaymentEntries={setVendorEntries}
            savedPaymentEntries={vendorEntries.filter((e) => e.isSaved)}
            updatePaymentEntry={vendorHandlers.updatePaymentEntry}
            savePaymentEntry={vendorHandlers.savePaymentEntry}
            removePaymentEntry={vendorHandlers.removePaymentEntry}
            hideToolbar
            confirmMutations
            currency={pmCurrency}
          />
        ) : (
          <PaymentMethodsSection
            ref={customerPmRef}
            configType="customer"
            paymentEntries={customerEntries}
            setPaymentEntries={setCustomerEntries}
            savedPaymentEntries={customerEntries.filter((e) => e.isSaved)}
            updatePaymentEntry={customerHandlers.updatePaymentEntry}
            savePaymentEntry={customerHandlers.savePaymentEntry}
            removePaymentEntry={customerHandlers.removePaymentEntry}
            hideToolbar
            confirmMutations
            currency={pmCurrency}
          />
        )}
      </div>
    </div>
  );
}

// ----- PAYMENT TERMS TAB -----
function PaymentTermsTab({ vendor, cfg }: { vendor: Vendor; cfg?: VendorConfigData }) {
  const pm = useProfileMoney();
  const hasPaymentTerm = !!cfg?.paymentTermConfig;

  return (
    <div className="space-y-4">
      {/* Base payment terms from vendor data */}
      <ContentCard title="Payment Configuration" icon={Receipt}>
        <div className="space-y-0">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-[12px]">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Payment Terms</span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{PAYMENT_TERMS_LABELS[vendor.paymentTerms]}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-[12px]">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Credit Limit</span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {vendor.creditLimit > 0 ? pm.money(vendor.creditLimit) : "Not Set"}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-[12px]">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Credit Utilization</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-20 bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(getCreditUtilizationPct(vendor), 100)}%`,
                    backgroundColor: getCreditUtilizationPct(vendor) > 80 ? "rgb(var(--destructive))" : getCreditUtilizationPct(vendor) > 50 ? "rgb(var(--warning))" : "rgb(var(--success))",
                  }}
                />
              </div>
              <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                {getCreditUtilizationPct(vendor)}%
              </span>
            </div>
          </div>
        </div>
      </ContentCard>

      {/* Applied Payment Term from Step 3 config */}
      {hasPaymentTerm ? (
        <ContentCard title="Applied Payment Term" icon={Receipt}>
          <PaymentTermCard
            term={{
              id: "pt-applied",
              name: cfg!.paymentTermConfig!.name,
              category: (cfg!.paymentTermConfig!.type === "Pre" ? "prepayment" : cfg!.paymentTermConfig!.type === "Split" ? "split" : "net") as "net" | "prepayment" | "split",
              typeBadge: cfg!.paymentTermConfig!.type,
              badgeColor: cfg!.paymentTermConfig!.type === "Pre" ? "rgb(var(--violet))" : cfg!.paymentTermConfig!.type === "Split" ? "rgb(var(--warning))" : "rgb(var(--primary))",
              trigger: cfg!.paymentTermConfig!.trigger,
              description: cfg!.paymentTermConfig!.description,
              vendorsApplied: 4,
              duration: cfg!.paymentTermConfig!.duration,
              discountPercent: cfg!.paymentTermConfig!.discountPercent,
              discountPeriod: cfg!.paymentTermConfig!.discountPeriod,
            }}
            readOnly
          />
        </ContentCard>
      ) : (
        <ContentCard title="Applied Payment Term" icon={Receipt}>
          <EmptyState icon={Receipt} title="No custom payment term" description="A custom payment term can be configured during partner creation." />
        </ContentCard>
      )}
    </div>
  );
}

function getCreditUtilizationPct(vendor: Vendor): number {
  return vendor.creditLimit > 0 ? Math.round((vendor.creditUtilization / vendor.creditLimit) * 100) : 0;
}

// ----- PRICING RULES TAB -----
function PricingRulesTab({ cfg }: { cfg?: VendorConfigData }) {
  const hasPricingRules = cfg?.pricingRules && cfg.pricingRules.length > 0;

  return (
    <div className="space-y-4">
      <ContentCard title="Applied Pricing Rules" icon={Tag} count={hasPricingRules ? cfg!.pricingRules!.length : undefined}>
        {hasPricingRules ? (
          <div className="@container/prdetail">
          <div className="grid grid-cols-1 @[400px]/prdetail:grid-cols-2 @[750px]/prdetail:grid-cols-3 gap-2">
            {cfg!.pricingRules!.map((rule) => (
              <div key={rule.id} className="rounded-md border border-border p-3 space-y-1.5 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] text-white"
                    style={{ fontWeight: 700, backgroundColor: rule.type === "discount" ? "rgb(var(--success))" : "rgb(var(--warning))" }}
                  >
                    {rule.type === "discount" ? "Discount" : "Premium"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-slate-500 border border-border" style={{ fontWeight: 500 }}>
                    {rule.basis}
                  </span>
                </div>
                <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>{rule.name}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{rule.description}</p>
                {rule.tiers && rule.tiers.length > 0 && (
                  <div className="mt-2 pt-2.5 border-t border-muted">
                    <p className="text-[11px] text-slate-400 mb-1.5" style={{ fontWeight: 600 }}>Tiers</p>
                    <div className="space-y-1">
                      {rule.tiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">{tier.from}���{tier.to === Infinity ? "∞" : tier.to}</span>
                          <span className="text-slate-700" style={{ fontWeight: 600 }}>{tier.discount}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        ) : (
          <EmptyState icon={Tag} title="No pricing rules applied" description="Pricing rules can be configured during partner creation or editing." />
        )}
      </ContentCard>
    </div>
  );
}

// ----- CONTACTS TAB -----
function ContactsTab({ vendor, cfg }: { vendor: Vendor; cfg?: VendorConfigData }) {
  // ── Contact Dictionary (local copy for adding new contacts) ──
  const [contactDictionary, setContactDictionary] = useState<PartnerContact[]>([...CONTACT_DICTIONARY]);

  // ── Selected POC IDs (the contacts assigned to this partner) ──
  const [selectedPocIds, setSelectedPocIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    // Pull enriched POCs from cfg (added during partner creation Step 3)
    if (cfg?.pointsOfContact) {
      cfg.pointsOfContact.forEach((epc) => {
        const match = CONTACT_DICTIONARY.find(
          (c) => c.name === epc.name || c.email === epc.email
        );
        if (match) ids.add(match.id);
      });
    }
    // Pull global POCs from vendor data
    vendor.globalPointOfContacts.forEach((gpc) => {
      const match = CONTACT_DICTIONARY.find(
        (c) => c.name === gpc.name || c.name.split(" ")[0] === gpc.name.split(" ")[0]
      );
      if (match) ids.add(match.id);
    });
    // If nothing matched but vendor has global POCs, assign first N from dictionary
    if (ids.size === 0 && vendor.globalPointOfContacts.length > 0) {
      CONTACT_DICTIONARY.slice(0, Math.min(vendor.globalPointOfContacts.length, 6)).forEach(
        (c) => ids.add(c.id)
      );
    }
    return ids;
  });

  // ── Primary POC state — first selected contact is treated as primary by default. ──
  const [primaryPocId, setPrimaryPocId] = useState<string | null>(null);
  const [primaryChangeTarget, setPrimaryChangeTarget] = useState<{ id: string; name: string } | null>(null);
  // Initialize primary on first non-empty selection.
  useEffect(() => {
    if (!primaryPocId && selectedPocIds.size > 0) setPrimaryPocId(Array.from(selectedPocIds)[0]);
  }, [primaryPocId, selectedPocIds]);

  // ── Scope filter — All / Partner POCs only / Location POCs only. ──
  const [pocScopeFilter, setPocScopeFilter] = useState<"all" | "partner" | "location">("all");

  // ── Locations map for the Locations column + the Location-only / Partner-only scopes. ──
  const partnerLocations = useMemo(() => generateLocationsFromVendor(vendor), [vendor]);
  // Build contact id → list of location names. Match POC names from each location's
  // `pocNames` to entries in CONTACT_DICTIONARY by exact name.
  const contactLocationsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of partnerLocations) {
      for (const p of l.pocNames || []) {
        const match = CONTACT_DICTIONARY.find((c) => c.name === p.name);
        if (!match) continue;
        if (!map[match.id]) map[match.id] = [];
        if (!map[match.id].includes(l.name)) map[match.id].push(l.name);
      }
    }
    return map;
  }, [partnerLocations]);

  // ── Combined contact pool: union of partner-level selected POCs + every location's POCs.
  //    `partnerScope` flags which side a given contact belongs to so the scope filter pills
  //    can show partner-only / location-only correctly. ──
  const combinedContactsByScope = useMemo(() => {
    const map = new Map<string, { contact: PartnerContact; partner: boolean; location: boolean }>();
    selectedPocIds.forEach((id) => {
      const c = contactDictionary.find((x) => x.id === id);
      if (c) map.set(id, { contact: c, partner: true, location: !!contactLocationsMap[id] });
    });
    Object.keys(contactLocationsMap).forEach((id) => {
      const c = contactDictionary.find((x) => x.id === id);
      if (!c) return;
      const existing = map.get(id);
      if (existing) existing.location = true;
      else map.set(id, { contact: c, partner: false, location: true });
    });
    return Array.from(map.values());
  }, [selectedPocIds, contactDictionary, contactLocationsMap]);

  const scopedContacts = useMemo(() => {
    return combinedContactsByScope
      .filter((e) => pocScopeFilter === "all" || (pocScopeFilter === "partner" ? e.partner : e.location))
      .map((e) => e.contact);
  }, [combinedContactsByScope, pocScopeFilter]);

  // ── Select Modal state ──
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [pocSearch, setPocSearch] = useState("");
  const [pocCategoryFilter, setPocCategoryFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [pocPage, setPocPage] = useState(1);
  const [pocTempSelected, setPocTempSelected] = useState<Set<string>>(new Set());

  // ── Create Modal state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPocName, setNewPocName] = useState("");
  const [newPocDepartment, setNewPocDepartment] = useState("");
  const [newPocRole, setNewPocRole] = useState("");
  const [newPocLandline, setNewPocLandline] = useState("");
  const [newPocLandlineCode, setNewPocLandlineCode] = useState("+1");
  const [newPocExt, setNewPocExt] = useState("");
  const [newPocMobile, setNewPocMobile] = useState("");
  const [newPocMobileCode, setNewPocMobileCode] = useState("+1");
  const [newPocEmail, setNewPocEmail] = useState("");
  const [saveAndCreate, setSaveAndCreate] = useState(false);

  // ── Tab-level search / filter / pagination ──
  const [tabSearch, setTabSearch] = useState("");
  const [tabDeptFilter, setTabDeptFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [tabPage, setTabPage] = useState(1);
  const [globalPocDensity, setGlobalPocDensity] = useState<"condensed" | "comfort" | "card">("card");
  const [globalPocCardSize, setGlobalPocCardSize] = useState<"large" | "medium" | "small">("medium");
  const GLOBAL_POC_DENSITY_CONFIG: { key: "condensed" | "comfort" | "card"; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
    { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
    { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
    { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
  ];

  // ── Derived data ──
  const selectedContacts = useMemo(
    () => contactDictionary.filter((c) => selectedPocIds.has(c.id)),
    [contactDictionary, selectedPocIds]
  );

  const selectedDeptCounts = useMemo(() => {
    const counts: Record<string, number> = { Sales: 0, "Supply Chain Management": 0, Finance: 0 };
    selectedContacts.forEach((c) => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [selectedContacts]);

  const filteredSelected = useMemo(() => {
    let list = selectedContacts;
    if (tabDeptFilter !== "all") list = list.filter((c) => c.department === tabDeptFilter);
    if (tabSearch.trim()) {
      const q = tabSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    return list;
  }, [selectedContacts, tabDeptFilter, tabSearch]);

  const TAB_PER_PAGE = 12;
  const tabTotalPages = Math.max(1, Math.ceil(filteredSelected.length / TAB_PER_PAGE));
  const tabPaginated = filteredSelected.slice((tabPage - 1) * TAB_PER_PAGE, tabPage * TAB_PER_PAGE);

  useEffect(() => {
    if (tabPage > tabTotalPages) setTabPage(tabTotalPages);
  }, [tabPage, tabTotalPages]);

  const pocHighlightText = useCallback((text: string) => {
    if (!tabSearch.trim()) return text;
    const regex = new RegExp(`(${tabSearch.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
      ) : (
        part
      )
    );
  }, [tabSearch]);

  const TAB_DEPT_COLORS: Record<string, { bg: string; text: string; accent: string; border: string }> = {
    "Sales": { bg: "#F0F4FF", text: "#3B6FC2", accent: "#4B83DB", border: "#D6E2F5" },
    "Supply Chain Management": { bg: "#ECFDF5", text: "#1B7A52", accent: "#34B77A", border: "#C6F0DA" },
    "Finance": { bg: "#FFF8ED", text: "#B05E10", accent: "#E58E2A", border: "#FADCB0" },
  };
  const TAB_AVATAR_TINTS: Record<string, { bg: string; text: string }> = {
    "rgb(var(--primary))": { bg: "#EBF3FF", text: "rgb(var(--primary))" },
    "rgb(var(--violet))": { bg: "#F0EBFF", text: "rgb(var(--violet))" },
    "rgb(var(--success))": { bg: "#E8FAF3", text: "rgb(var(--success))" },
    "rgb(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
  };
  const getTabAvatarTint = (c: string) => TAB_AVATAR_TINTS[c] || { bg: "#F0F4FF", text: c };
  const getTabInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const getTabPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (tabTotalPages <= 7) {
      for (let i = 1; i <= tabTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (tabPage > 3) pages.push("...");
      const start = Math.max(2, tabPage - 1);
      const end = Math.min(tabTotalPages - 1, tabPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (tabPage < tabTotalPages - 2) pages.push("...");
      pages.push(tabTotalPages);
    }
    return pages;
  };

  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "location">("all");

  const QUICK_DEPT_FILTERS: { key: "all" | "Sales" | "Supply Chain Management" | "Finance"; label: string; count: number }[] = [
    { key: "all", label: "All", count: selectedContacts.length },
    { key: "Sales", label: "Sales", count: selectedDeptCounts["Sales"] || 0 },
    { key: "Supply Chain Management", label: "Supply Chain", count: selectedDeptCounts["Supply Chain Management"] || 0 },
    { key: "Finance", label: "Finance", count: selectedDeptCounts["Finance"] || 0 },
  ];

  const SCOPE_FILTERS = [
    { key: "all" as const, label: "All Contacts", count: selectedContacts.length },
    { key: "global" as const, label: "Global", count: Math.min(selectedContacts.length, Math.max(vendor.globalPointOfContacts.length, 3)) },
    { key: "location" as const, label: "Location", count: Math.max(0, selectedContacts.length - Math.max(vendor.globalPointOfContacts.length, 3)) },
  ];

  const pocDeptCounts = useMemo(() => {
    const counts: Record<string, number> = { Sales: 0, "Supply Chain Management": 0, Finance: 0 };
    contactDictionary.forEach((c) => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [contactDictionary]);

  const filteredContacts = useMemo(() => {
    let list = contactDictionary;
    if (pocCategoryFilter !== "all") list = list.filter((c) => c.department === pocCategoryFilter);
    if (pocSearch.trim()) {
      const q = pocSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    return list;
  }, [contactDictionary, pocCategoryFilter, pocSearch]);

  const POC_PER_PAGE = 20;
  const pocTotalPages = Math.max(1, Math.ceil(filteredContacts.length / POC_PER_PAGE));
  const pocPagedContacts = filteredContacts.slice((pocPage - 1) * POC_PER_PAGE, pocPage * POC_PER_PAGE);

  // ── Handlers ──
  const handleRemovePoc = useCallback((id: string) => {
    setSelectedPocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast.success("Contact removed from this partner.");
  }, []);

  const handleOpenSelect = useCallback(() => {
    setPocTempSelected(new Set(selectedPocIds));
    setPocSearch("");
    setPocCategoryFilter("all");
    setPocPage(1);
    setShowSelectModal(true);
  }, [selectedPocIds]);

  const handleTogglePocTemp = useCallback((id: string) => {
    setPocTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleConfirmSelect = useCallback(() => {
    const added = [...pocTempSelected].filter((id) => !selectedPocIds.has(id)).length;
    const removed = [...selectedPocIds].filter((id) => !pocTempSelected.has(id)).length;
    setSelectedPocIds(new Set(pocTempSelected));
    setShowSelectModal(false);
    if (added > 0 || removed > 0) {
      toast.success(
        `${added > 0 ? `${added} contact${added > 1 ? "s" : ""} added` : ""}${added > 0 && removed > 0 ? ", " : ""}${removed > 0 ? `${removed} removed` : ""}`
      );
    }
  }, [pocTempSelected, selectedPocIds]);

  const resetCreateForm = useCallback(() => {
    setNewPocName(""); setNewPocDepartment(""); setNewPocRole("");
    setNewPocLandline(""); setNewPocLandlineCode("+1"); setNewPocExt("");
    setNewPocMobile(""); setNewPocMobileCode("+1"); setNewPocEmail("");
  }, []);

  const handleSavePoc = useCallback(() => {
    if (!newPocName.trim()) { toast.error("Name is required."); return; }
    const AVATAR_COLORS = ["rgb(var(--primary))", "rgb(var(--violet))", "rgb(var(--success))", "rgb(var(--warning))"];
    const newContact: PartnerContact = {
      id: `C-NEW-${Date.now()}`,
      name: newPocName.trim(),
      company: vendor.displayName || vendor.companyName,
      department: newPocDepartment,
      phone: newPocLandline ? `${newPocLandlineCode} ${newPocLandline}` : "",
      phoneExt: newPocExt,
      secondaryPhone: newPocMobile ? `${newPocMobileCode} ${newPocMobile}` : "",
      secondaryPhoneExt: "",
      email: newPocEmail.trim(),
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };
    setContactDictionary((prev) => [newContact, ...prev]);
    setSelectedPocIds((prev) => new Set([...prev, newContact.id]));
    toast.success(`"${newContact.name}" created and assigned to this partner.`);
    if (saveAndCreate) {
      resetCreateForm();
    } else {
      resetCreateForm();
      setShowCreateModal(false);
    }
  }, [newPocName, newPocDepartment, newPocLandline, newPocLandlineCode, newPocExt, newPocMobile, newPocMobileCode, newPocEmail, saveAndCreate, vendor, resetCreateForm]);

  const handleOpenCreate = useCallback(() => {
    resetCreateForm();
    setShowCreateModal(true);
  }, [resetCreateForm]);

  const handleOpenCreateFromSelect = useCallback(() => {
    setShowSelectModal(false);
    resetCreateForm();
    setShowCreateModal(true);
  }, [resetCreateForm]);

  return (
    <div>
      <ContactsDirectoryPage
        embedded
        embeddedContacts={scopedContacts}
        primaryContactId={primaryPocId || undefined}
        primaryContactTooltip={`Primary point of contact for ${vendor.companyName}`}
        onSetPrimaryContact={(id, name) => setPrimaryChangeTarget({ id, name })}
        contactLocationsMap={contactLocationsMap}
        /* Match the location-modal POC column set, plus a Locations column
           so users can see at a glance which locations each POC is tied
           to — uses the +N more overflow pattern when a contact spans
           multiple locations. */
        defaultVisibleColumns={["contact_name", "role", "company", "phones", "emails", "locations", "status"]}
        embeddedHeaderBar={
          <>
            {/* Segmented scope control — mirrors the Items tab header
                (Items They Sell / Items They Buy). Color cue per scope:
                neutral for All, blue for Partner, emerald for Location. */}
            <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
              {([
                { key: "all" as const, label: "All POCs", color: "#334155" },
                { key: "partner" as const, label: "Partner POCs", color: "#0548A3" },
                { key: "location" as const, label: "Location POCs", color: "#065F46" },
              ]).map((t) => {
                const isActive = pocScopeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setPocScopeFilter(t.key)}
                    className={`inline-flex items-center justify-center px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                      isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                    }`}
                    style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center h-8 gap-1.5 px-3 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[13px] shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create New Contact</span>
              <span className="sm:hidden">New</span>
            </button>
          </>
        }
        embeddedToolbarRight={
          <button
            type="button"
            onClick={handleOpenSelect}
            className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer text-foreground"
            style={{ fontWeight: 500 }}
          >
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm hidden md:inline">Contact Directory</span>
          </button>
        }
      />

      {/* Select from Directory Modal */}
      <SelectPocDictionaryModal
        open={showSelectModal}
        onOpenChange={setShowSelectModal}
        contactDictionary={contactDictionary}
        pocSearch={pocSearch}
        onPocSearchChange={(v) => { setPocSearch(v); setPocPage(1); }}
        pocCategoryFilter={pocCategoryFilter}
        onPocCategoryFilterChange={(v) => { setPocCategoryFilter(v); setPocPage(1); }}
        pocDepartmentCounts={pocDeptCounts}
        pocPagedContacts={pocPagedContacts}
        pocPage={pocPage}
        pocTotalPages={pocTotalPages}
        onPocPageChange={setPocPage}
        pocTempSelected={pocTempSelected}
        onTogglePocTemp={handleTogglePocTemp}
        onConfirm={handleConfirmSelect}
        onOpenCreatePoc={handleOpenCreateFromSelect}
        contextLabel="this partner"
      />

      {/* Create New POC Modal */}
      <CreatePocModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        contextName={vendor.displayName || vendor.companyName}
        newPocName={newPocName}
        onNewPocNameChange={setNewPocName}
        newPocDepartment={newPocDepartment}
        onNewPocDepartmentChange={setNewPocDepartment}
        newPocRole={newPocRole}
        onNewPocRoleChange={setNewPocRole}
        newPocLandline={newPocLandline}
        onNewPocLandlineChange={setNewPocLandline}
        newPocLandlineCode={newPocLandlineCode}
        onNewPocLandlineCodeChange={setNewPocLandlineCode}
        newPocExt={newPocExt}
        onNewPocExtChange={setNewPocExt}
        newPocMobile={newPocMobile}
        onNewPocMobileChange={setNewPocMobile}
        newPocMobileCode={newPocMobileCode}
        onNewPocMobileCodeChange={setNewPocMobileCode}
        newPocEmail={newPocEmail}
        onNewPocEmailChange={setNewPocEmail}
        saveAndCreateAnother={saveAndCreate}
        onSaveAndCreateAnotherChange={setSaveAndCreate}
        onSave={handleSavePoc}
      />

      {/* Change Primary POC confirmation — canonical lifecycle modal pattern */}
      <AlertDialog open={!!primaryChangeTarget} onOpenChange={(o) => { if (!o) setPrimaryChangeTarget(null); }}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
              <Star className="w-8 h-8 fill-blue-700 text-blue-700" />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}>
              Change Primary
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              Set {primaryChangeTarget?.name} as primary?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              {primaryChangeTarget?.name} becomes the main point of contact for {vendor.companyName}. The current primary stays in the contact list but loses its primary status.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (primaryChangeTarget) {
                    setPrimaryPocId(primaryChangeTarget.id);
                    toast.success(`${primaryChangeTarget.name} is now the primary contact`);
                  }
                  setPrimaryChangeTarget(null);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#0A77FF", color: "#fff" }}
              >
                Set as Primary
              </button>
              <button onClick={() => setPrimaryChangeTarget(null)} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ----- DOCUMENTS TAB -----
function DocumentsTab() {
  return (
    <PlaceholderTab
      label="Attachments"
      description="Upload and manage documents, contracts, and files associated with this partner."
      icon={Paperclip}
    />
  );
}

// ----- ACTIVITY TAB -----
function ActivityTab({ vendor, formatDate }: { vendor: Vendor; formatDate: (d: string) => string }) {
  // Mapped to the shared ActivityFeed feed format (icon-circle + rail + person/verb/target sentence).
  const items: { id: string; type: ActivityFeedItemType; user: string; verb: string; target?: string; date: string }[] = [
    { id: "act-1", type: "edit",   user: "System",            verb: "updated the partner profile",     target: vendor.displayName || vendor.companyName, date: formatDate(vendor.updatedAt) },
    { id: "act-2", type: "apply",  user: "Finance Team",      verb: "saved payment configuration for", target: vendor.displayName || vendor.companyName, date: formatDate(vendor.updatedAt) },
    { id: "act-3", type: "edit",   user: "Logistics",         verb: "configured shipping preferences", date: formatDate(vendor.createdAt) },
    { id: "act-4", type: "create", user: "Omnesoft",          verb: "created partner",                  target: vendor.displayName || vendor.companyName, date: formatDate(vendor.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <ContentCard title="Activity Timeline" icon={Activity}>
        <ActivityFeed items={items} />
        <div className="pt-2.5 mt-3 border-t border-muted text-center">
          <p className="text-[11px] text-slate-400">Full activity log will be available with backend integration</p>
        </div>
      </ContentCard>
    </div>
  );
}

// ----- NOTES & ATTACHMENTS TAB -----
function NotesTab({ vendor, cfg }: { vendor: Vendor; cfg?: VendorConfigData }) {
  return (
    <div className="space-y-4">
      {/* Notes */}
      <ContentCard title="Notes" icon={MessageSquare}>
        {vendor.notes ? (
          <div className="rounded-md bg-[#FAFBFC] border border-muted p-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{vendor.notes}</p>
          </div>
        ) : (
          <EmptyState icon={MessageSquare} title="No notes" description="Notes about this partner will appear here." />
        )}
      </ContentCard>

      {/* Description from config */}
      {(vendor.description || cfg?.description) && (
        <ContentCard title="Description" icon={Info}>
          <div className="rounded-md bg-[#FAFBFC] border border-muted p-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{vendor.description || cfg?.description}</p>
          </div>
        </ContentCard>
      )}

      {/* Attachments placeholder */}
      <ContentCard title="Attachments" icon={Paperclip}>
        <EmptyState icon={Paperclip} title="No attachments" description="File attachments will be displayed here once uploaded. This feature will be available with backend integration." />
      </ContentCard>
    </div>
  );
}
