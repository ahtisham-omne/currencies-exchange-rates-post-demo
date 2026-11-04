import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FlagImage, flagEmojiCode } from "@/app/components/ui/FlagImage";
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
import { PARTNER_GROUPS, CONTACT_DICTIONARY, VENDOR_SUB_TYPES, CUSTOMER_SUB_TYPES } from "../components/vendors/partnerConstants";
import type { ContactPerson as PartnerContact } from "../components/vendors/partnerConstants";
import { CreatePartnerLocationModal } from "../components/vendors/CreatePartnerLocationModal";
import { CreatePartnerModal } from "../components/vendors/CreatePartnerModal";
import { PartnerItemsTab } from "../components/vendors/PartnerItemsTab";
import { PricingRulesTabNew } from "../components/vendors/PricingRulesTab";
import { KpiInsightsPanel, ALL_KPI_DEFINITIONS, DEFAULT_ACTIVE_KPIS } from "../components/vendors/KpiInsightsPanel";
import { PaymentMethodCard as PaymentMethodCardBase } from "../components/vendors/PaymentMethodsSection";
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
import { CurrencyAmount } from "../components/ui/CurrencyAmount";
import { CurrencyFlag } from "../components/ui/CurrencyFlag";
import {
  BASE_CURRENCY,
  convertToBase,
  getLibraryCurrency,
  renderPartnerAmount,
  renderProfileAmount,
  shortAxisFormatter,
} from "../data/currencyLibrary";
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
import type { Vendor, VendorConfigData } from "../data/vendors";
import {
  CATEGORY_LABELS,
  PAYMENT_TERMS_LABELS,
} from "../data/vendors";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  Printer,
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
} from "lucide-react";
import React, { useState, useEffect, useRef, useCallback, useMemo, cloneElement } from "react";
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
  { id: "pricing_rules", label: "Pricing Rules" },
  { id: "partner_communication", label: "Partner Communication" },
  { id: "global_contacts", label: "Points of Contact" },
  { id: "carrier_profile", label: "Carrier Profile" },
  { id: "payment_methods", label: "Payment Methods" },
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
  const [dashActiveKpis, setDashActiveKpis] = useState<string[]>(DEFAULT_DASH_KPIS);
  const [dashActiveWidgets, setDashActiveWidgets] = useState<string[]>(["spend_trend", "order_activity", "spend_by_category", "credit_health", "delivery_perf", "invoice_aging", "primary_contact", "return_rate", "top_items", "recent_orders", "payment_history", "compliance_docs", "notes"]);
  const [dashWidgetSizes, setDashWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  /**
   * Currency view for this profile's financial surfaces (KPI bar, charts,
   * widgets, Financial Summary, Credit Limits). Toggled from the dashboard
   * action bar; defaults to the partner's own default transaction currency.
   */
  const [profileCurrencyMode, setProfileCurrencyMode] = useState<"base" | "partner">("partner");
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [dashDateRange, setDashDateRange] = useState("last_30");

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

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date());
    toast.success("Dashboard refreshed");
  }, []);

  const handleResetLayout = useCallback(() => {
    setDashActiveKpis([...DEFAULT_DASH_KPIS]);
    setDashActiveWidgets(["spend_trend", "order_activity", "spend_by_category", "credit_health", "delivery_perf", "invoice_aging", "primary_contact", "return_rate", "top_items", "recent_orders", "payment_history", "compliance_docs", "notes"]);
    setDashWidgetSizes({});
    toast.success("Layout reset to defaults");
  }, []);

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
    toast.success("Partner archived successfully");
    setArchiveDialogOpen(false);
  };

  const handleRestore = () => {
    restoreVendor(vendor.id);
    toast.success("Partner restored to active");
  };

  const handleStatusChange = (newStatus: string) => {
    updateVendor(vendor.id, { status: newStatus as "active" | "inactive" | "archived" });
    toast.success(`Partner status changed to ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
    setStatusConfirmOpen(false);
    setStatusChangeTarget(null);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(val);

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

  // Status config
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
            <DropdownMenuItem onClick={() => toast.info("Create New Location – coming soon")}>
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
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied to clipboard"); }}>
          <Link2 className="w-4 h-4 mr-2 text-slate-500" />
          Copy Link
        </DropdownMenuItem>
        {vendor.website && (
          <DropdownMenuItem onClick={() => window.open(vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2 text-slate-500" />
            Visit Website
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => toast.info("Print feature coming soon")}>
          <Printer className="w-4 h-4 mr-2 text-slate-500" />
          Print Partner Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Status & Lifecycle */}
        {vendor.status === "active" && (
          <DropdownMenuItem onClick={() => { setStatusChangeTarget("inactive"); setStatusConfirmOpen(true); }}>
            <CircleSlash className="w-4 h-4 mr-2" />
            Mark as Inactive
          </DropdownMenuItem>
        )}
        {vendor.status === "inactive" && (
          <DropdownMenuItem onClick={() => { setStatusChangeTarget("active"); setStatusConfirmOpen(true); }}>
            <CircleCheck className="w-4 h-4 mr-2" />
            Mark as Active
          </DropdownMenuItem>
        )}
        {vendor.status === "archived" ? (
          <DropdownMenuItem onClick={handleRestore}>
            <ArchiveRestore className="w-4 h-4 mr-2" />
            Unarchive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)} className="text-destructive focus:text-destructive">
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
      className={`rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
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

  // Build sub-type pills for display
  const vendorSubTypeLabels = vendor.vendorSubTypes || [];
  const customerSubTypeLabels = vendor.customerSubTypes || [];
  const allSubTypes = [...vendorSubTypeLabels, ...customerSubTypeLabels];

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
      {/* ══════════════════════════════════════════════
          TOP NAV BAR
         ══════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0 sticky top-0 z-30">
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--accent))" }}>
              <span className="text-[11px]" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>AA</span>
            </div>
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
      <div className="shrink-0 sticky top-[48px] z-20 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? "8px" : "12px", paddingBottom: "4px", transition: "padding-top 250ms ease" }}>
          <div className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
            <div className={`bg-white border border-border rounded-xl overflow-hidden transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}>
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
                        backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "hsl(var(--primary))"),
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
                            className={`inline-flex items-center gap-1 rounded-md border transition-all duration-250 ${
                              type === "vendor"
                                ? "border-blue-200 bg-blue-100 text-[#2563EB]"
                                : "border-[#C4B5FD] bg-[#EDE9FE] text-violet"
                            }`}
                            style={{ padding: isScrolled ? "1px 6px" : "2px 8px", fontSize: isScrolled ? 10 : 11, fontWeight: 600, cursor: subs.length > 0 ? "default" : undefined }}
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
                                <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
                        const extraGroups = PARTNER_GROUPS.filter((g) => g.id !== vendor.partnerGroup && g.country === vendor.country).slice(0, 2);
                        if (!primaryGroup) return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-border bg-muted text-muted-foreground" style={{ fontWeight: 500 }}>
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {vendor.partnerGroup}
                          </span>
                        );
                        return (
                          <>
                            <PartnerGroupHoverPill group={primaryGroup} />
                            {extraGroups.length > 0 && (
                              <PartnerGroupOverflowPill groups={extraGroups} />
                            )}
                          </>
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
                                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer align-baseline"
                                style={{ fontWeight: 500 }}
                              >
                                Show less <ChevronUp className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      {!descExpanded && descNeedsTruncation && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                          className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer"
                          style={{ fontWeight: 500, lineHeight: "20px" }}
                        >
                          ... more <ChevronDown className="w-3 h-3" />
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
        <div className={`mx-auto px-4 lg:px-6 xl:px-8 pt-3 pb-5 space-y-4 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
          {/* Full-width KPI strip — only on Dashboard tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-3">
              {/* Info bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Dashboard</span>
                  {/* Date Range Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                        <Calendar className="w-3 h-3" />
                        <span style={{ fontWeight: 500 }}>
                          {dashDateRange === "last_7" && "Last 7 days"}
                          {dashDateRange === "last_30" && "Last 30 days"}
                          {dashDateRange === "last_90" && "Last 90 days"}
                          {dashDateRange === "last_365" && "Last 12 months"}
                          {dashDateRange === "all_time" && "All time"}
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
                          onClick={() => setDashDateRange(opt.key)}
                        >
                          <span className="text-sm">{opt.label}</span>
                          {dashDateRange === opt.key && (
                            <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-slate-300">|</span>
                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>Updated {format(lastRefreshed, "h:mm a")}</span>
                  <button onClick={handleRefresh} className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D4] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Base ↔ Partner currency toggle — hidden when this partner
                      already settles in the base currency, since both sides
                      would render identically. */}
                  {vendor.defaultTransactionCurrency.toUpperCase() !== BASE_CURRENCY && (
                    <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0">
                      <button
                        type="button"
                        onClick={() => setProfileCurrencyMode("base")}
                        aria-pressed={profileCurrencyMode === "base"}
                        className={`inline-flex items-center h-7 px-2.5 rounded-md text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
                          profileCurrencyMode === "base"
                            ? "bg-accent text-primary"
                            : "text-slate-700 hover:bg-muted/60"
                        }`}
                        style={{ fontWeight: profileCurrencyMode === "base" ? 600 : 500 }}
                      >
                        Base Currency
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileCurrencyMode("partner")}
                        aria-pressed={profileCurrencyMode === "partner"}
                        className={`inline-flex items-center h-7 px-2.5 rounded-md text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
                          profileCurrencyMode === "partner"
                            ? "bg-accent text-primary"
                            : "text-slate-700 hover:bg-muted/60"
                        }`}
                        style={{ fontWeight: profileCurrencyMode === "partner" ? 600 : 500 }}
                      >
                        Partner Currency
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleResetLayout}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    Reset
                  </button>
                  <button
                    onClick={() => setCustomizePanelOpen(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    Customize Widgets
                  </button>
                </div>
              </div>

              {/* KPI Cards — draggable responsive grid */}
              {activeKpiDefs.length > 0 && (
                <DndProvider backend={HTML5Backend}>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {activeKpiDefs.map((kpi, idx) => {
                      const computed = computeDashKpiValue(kpi.key, vendor, formatCurrency, formatDate, profileCurrencyMode);
                      return (
                        <DraggableKpiCard
                          key={kpi.key}
                          index={idx}
                          kpiKey={kpi.key}
                          label={kpi.label}
                          value={computed.value}
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
                  style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                <DashboardTab vendor={vendor} cfg={cfg} formatCurrency={formatCurrency} formatDate={formatDate} activeWidgets={dashActiveWidgets} widgetSizes={dashWidgetSizes} onWidgetSizeChange={handleWidgetSizeChange} onRemoveWidget={handleToggleWidget} moveWidget={moveWidget} currencyMode={profileCurrencyMode} />
              )}
              {activeTab === "partner_locations" && (
                <PartnerLocationsTab vendor={vendor} cfg={cfg} formatDate={formatDate} initialLocationIdx={initialLocationIdx} onInitialLocationConsumed={() => {
                  // Clear the ?loc= param so a subsequent close doesn't reopen the modal on navigation back.
                  const next = new URLSearchParams(searchParams);
                  next.delete("loc");
                  setSearchParams(next, { replace: true });
                }} />
              )}
              {activeTab === "items" && (
                <PartnerItemsTab vendor={vendor} />
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
                <PlaceholderTab label="Carrier Profile" description="View and configure carrier profile details and shipping preferences." icon={Truck} />
              )}
              {activeTab === "payment_methods" && (
                <PaymentMethodsTab cfg={cfg} PAYMENT_TYPE_ICONS={PAYMENT_TYPE_ICONS} />
              )}
              {activeTab === "purchase_orders" && <PurchaseOrdersTable />}
              {activeTab === "quotes" && <QuotesTable />}
              {activeTab === "sales_orders" && <SalesOrdersTable />}
              {activeTab === "notes" && (
                <NotesTab vendor={vendor} cfg={cfg} />
              )}
              {activeTab === "attachments" && <AttachmentsTab />}
              {activeTab === "recent_activity" && (
                <ActivityTab vendor={vendor} formatDate={formatDate} />
              )}
            </div>

            {/* ── RIGHT SIDEBAR (hidden on dashboard & partner_locations — info cards are inline) ── */}
            <div className={`w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4 ${activeTab !== "recent_activity" ? "!hidden" : ""}`}>
              {/* Partner Information Card */}
              <SidebarCard title="PARTNER INFORMATION">
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
              <SidebarCard title="QUICK STATS">
                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox label="Total Orders" value={String(vendor.totalOrders)} icon={ShoppingCart} />
                  <StatBox label="Total Spent" value={<CurrencyAmount {...renderProfileAmount(vendor, vendor.totalSpent, profileCurrencyMode)} />} icon={TrendingUp} />
                  <StatBox label="Rating" value={vendor.rating > 0 ? `${vendor.rating}/5` : "N/A"} icon={Star} color="#F59E0B" />
                  <StatBox label="Credit Used" value={`${creditUtilization}%`} icon={DollarSign} color={creditUtilization > 80 ? "hsl(var(--destructive))" : creditUtilization > 50 ? "hsl(var(--warning))" : "hsl(var(--success))"} />
                </div>
              </SidebarCard>

              {/* Point of Contacts */}
              {vendor.globalPointOfContacts.length > 0 && (
                <SidebarCard title="POINT OF CONTACTS">
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
                          <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent ml-auto shrink-0" style={{ fontWeight: 600 }}>PRIMARY</span>
                        )}
                      </div>
                      );
                    })}
                    {vendor.globalPointOfContacts.length > 4 && (
                      <button
                        onClick={() => setActiveTab("global_contacts")}
                        className="text-xs text-primary hover:text-[#0862D0] transition-colors cursor-pointer mt-1"
                        style={{ fontWeight: 500 }}
                      >
                        +{vendor.globalPointOfContacts.length - 4} more
                      </button>
                    )}
                  </div>
                </SidebarCard>
              )}

              {/* Partner Types */}
              <SidebarCard title="PARTNER TYPES">
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
                  {cfg && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(cfg.vendorSubTypes || []).map((st) => (
                        <span key={st} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
                          {st.replace(/_/g, " ")}
                        </span>
                      ))}
                      {(cfg.customerSubTypes || []).map((st) => (
                        <span key={st} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
                          {st.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </SidebarCard>

              {/* Created Info */}
              <SidebarCard title="CREATED">
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Created By</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0"
                        style={{ backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "#6366f1"), fontWeight: 600 }}
                      >
                        {vendor.createdByContact?.initials || "?"}
                      </div>
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
          currencyMode={profileCurrencyMode}
        />
      )}

      {/* ── Dialogs ── */}

      {/* Archive confirmation — matches creation form discard pattern */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setArchiveDialogOpen(false)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Archive
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Archive this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{vendor.displayName}</span>{" "}
              will be removed from active workflows. Historical records are preserved and you can restore later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleArchive}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
              >
                Archive Partner
              </button>
              <button
                onClick={() => setArchiveDialogOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change confirmation — matches listing page modals */}
      {/* Mark as Active */}
      <AlertDialog open={statusConfirmOpen && statusChangeTarget === "active"} onOpenChange={(o) => { if (!o) { setStatusConfirmOpen(false); setStatusChangeTarget(null); } }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #F0FDF4 0%, rgba(240,253,244,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-30" style={{ backgroundColor: "#22C55E" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#DCFCE7" }}>
              <CircleCheck className="w-8 h-8" style={{ color: "#16A34A" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#F0FDF4", color: "#14532D", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Activation
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Activate this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{vendor.displayName}</span>{" "}
              will be restored to active status and become available for new transactions, orders, and search results.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleStatusChange("active")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#16A34A", color: "#fff" }}>
                Activate Partner
              </button>
              <button onClick={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}>
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Inactive */}
      <AlertDialog open={statusConfirmOpen && statusChangeTarget === "inactive"} onOpenChange={(o) => { if (!o) { setStatusConfirmOpen(false); setStatusChangeTarget(null); } }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EAB308" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "hsl(var(--warning))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF9C3", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Warning
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Deactivate this partner?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{vendor.displayName}</span>{" "}
              will be hidden from active lists and no new transactions can be created. You can reactivate anytime.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button onClick={() => handleStatusChange("inactive")} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#F97316", color: "#FFFFFF" }}>
                Deactivate Partner
              </button>
              <button onClick={() => { setStatusConfirmOpen(false); setStatusChangeTarget(null); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}>
                Cancel
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
  );
}

// ══════════════════════════════════════════════
// PARTNER GROUP HOVER PILL WITH QUICK VIEW
// ═══════════════════════════���══════════════════

function PartnerGroupHoverPill({ group }: { group: { id: string; name: string; description: string; country: string; countryFlag: string; memberCount: number } }) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border border-border bg-muted text-muted-foreground cursor-default transition-colors hover:bg-border"
        style={{ fontWeight: 600 }}
      >
        <Star className="w-2.5 h-2.5 fill-slate-400 text-slate-400" />
        <FlagImage code={flagEmojiCode(group.countryFlag)} /> {group.name}
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>· {group.memberCount}</span>
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
        <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
          {/* Dark gradient header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(group.countryFlag)} /></span>
                <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                  {group.name}
                </span>
              </div>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/25 text-[#60A5FA] shrink-0"
                style={{ fontWeight: 600 }}
              >
                <Star className="w-2.5 h-2.5 fill-[#60A5FA]" /> Primary
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 relative">
              {group.country} Region
            </p>
          </div>
          {/* Body */}
          <div className="bg-white px-3.5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
              {group.description}
            </p>
            <div className="flex items-center gap-4 pt-2 border-t border-muted">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Users className="w-3 h-3 text-slate-400" />
                <span style={{ fontWeight: 500 }}>{group.memberCount} partners</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Globe className="w-3 h-3 text-slate-400" />
                <span style={{ fontWeight: 500 }}>{group.country}</span>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ══════════════════════════════════════════════
// SIDEBAR HELPER COMPONENTS
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// PARTNER GROUP OVERFLOW "+X more" WITH HOVER CARDS
// ══════════════════════════════════════════════

function PartnerGroupOverflowPill({ groups }: { groups: { id: string; name: string; description: string; country: string; countryFlag: string; memberCount: number }[] }) {
  const [listOpen, setListOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const listLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleListEnter = useCallback(() => {
    if (listLeaveTimer.current) { clearTimeout(listLeaveTimer.current); listLeaveTimer.current = null; }
    setListOpen(true);
  }, []);

  const handleListLeave = useCallback(() => {
    listLeaveTimer.current = setTimeout(() => { setListOpen(false); setHoveredGroup(null); }, 200);
  }, []);

  return (
    <Popover open={listOpen} onOpenChange={(o) => { if (!o) { setListOpen(false); setHoveredGroup(null); } }}>
      <PopoverTrigger
        onMouseEnter={handleListEnter}
        onMouseLeave={handleListLeave}
        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border border-border bg-muted text-primary cursor-default transition-colors hover:bg-border"
        style={{ fontWeight: 600 }}
      >
        +{groups.length}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleListEnter}
        onMouseLeave={handleListLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex gap-2">
          {/* List dropdown */}
          <div className="w-[220px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60 bg-white">
            <div className="px-3 py-2 border-b border-muted">
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Secondary Groups</p>
            </div>
            <div className="py-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onMouseEnter={() => setHoveredGroup(g.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-default ${hoveredGroup === g.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <span className="text-sm shrink-0"><FlagImage code={flagEmojiCode(g.countryFlag)} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{g.name}</p>
                    <p className="text-[10px] text-slate-400">{g.memberCount} members · {g.country}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Hover card — shows for the hovered group */}
          {hoveredGroup && (() => {
            const g = groups.find((grp) => grp.id === hoveredGroup);
            if (!g) return null;
            return (
              <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60 self-start">
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(g.countryFlag)} /></span>
                      <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>{g.name}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-slate-400 shrink-0" style={{ fontWeight: 600 }}>
                      Secondary
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 relative">{g.country} Region</p>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-3">
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">{g.description}</p>
                  <div className="flex items-center gap-4 pt-2 border-t border-muted">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span style={{ fontWeight: 500 }}>{g.memberCount} partners</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Globe className="w-3 h-3 text-slate-400" />
                      <span style={{ fontWeight: 500 }}>{g.country}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

function CarrierShippingCard({ carrier }: {
  carrier: {
    id: string;
    name: string;
    desc: string;
    isDefault: boolean;
    status: "active" | "inactive";
    methods: { id: string; name: string; shortName: string; desc: string; minDays: number; maxDays: number; isDefault: boolean; cost: string }[];
  };
}) {
  const [selectedMethodIdx, setSelectedMethodIdx] = useState(
    Math.max(0, carrier.methods.findIndex((m) => m.isDefault))
  );
  const activeMethod = carrier.methods[selectedMethodIdx];

  return (
    <div
      className="bg-white border border-border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "hsl(var(--border))"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; }}
    >
      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill + badges */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border border-blue-200 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-blue-800 bg-blue-50" style={{ fontWeight: 600 }}>
              <Truck className="w-3 h-3" /> Carrier
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-blue-200" style={{ fontWeight: 500 }}>
              {carrier.methods.length} Method{carrier.methods.length !== 1 ? "s" : ""}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {carrier.isDefault && (
              <span className="px-1.5 py-[2px] rounded-md text-[10px] border border-blue-200 bg-blue-50 text-blue-800" style={{ fontWeight: 600 }}>Primary</span>
            )}
            <span className={`px-1.5 py-[2px] rounded-md text-[10px] border ${carrier.status === "active" ? "border-[#BBF7D0] bg-green-50 text-[#166534]" : "border-border bg-slate-50 text-slate-400"}`} style={{ fontWeight: 500 }}>
              {carrier.status === "active" ? "Active" : "Inactive"}
            </span>
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

        {/* Row 4: Hero metric + vendor count inline */}
        <div className="flex items-baseline justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {activeMethod.cost}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>/ shipment</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
            <Clock className="w-3 h-3" /> {activeMethod.minDays}–{activeMethod.maxDays} days
          </span>
        </div>

        {/* Row 5: Shipping method tier selector */}
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
                  style={{ fontWeight: isActive ? 600 : 500, backgroundColor: isActive ? "#EFF6FF" : "hsl(var(--muted))", color: isActive ? "hsl(var(--primary))" : "#64748B", boxShadow: isActive ? `0 0 0 1px #0A77FF30` : undefined }}
                >
                  <span className="inline-flex items-center gap-1">{m.shortName}{m.isDefault && <Star className="w-2.5 h-2.5 text-primary fill-primary" />}</span>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 6: Active method detail strip */}
        <div className="mt-auto pt-2 shrink-0">
          <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <Package className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate" style={{ fontWeight: 400 }}>{activeMethod.name}</span>
            </div>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>{activeMethod.cost}</span>
          </div>
        </div>
      </div>

      {/* Footer — full-width 2-col CTAs matching pricing rules */}
      <div className="grid grid-cols-2 border-t border-muted shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); toast.info("Edit carrier coming soon"); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-muted cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toast.info("Duplicate carrier coming soon"); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
      </div>
    </div>
  );
}



function ContentCard({ title, icon: Icon, count, children, action, currentSize, onSizeChange, onRemove, tooltip, isDragging, isOver }: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
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
                    {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
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
              onClick={(e) => { e.stopPropagation(); onRemove(); toast.success(`Removed "${title}" — re-enable in Customize Widgets`); }}
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
      className={`transition-all duration-300 ease-out rounded-xl ${isOver && !isDragging ? "ring-2 ring-primary/20 ring-offset-2 scale-[1.005]" : ""}`}
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

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--violet))", "hsl(var(--success))", "#94A3B8"];

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
  // Financial
  { key: "total_orders", label: "Total Orders", category: "Financial", iconName: "ShoppingCart", subtitle: "All purchase orders" },
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
  { key: "rating", label: "Vendor Rating", category: "Operational", iconName: "Star", subtitle: "Performance score", tooltip: "Composite score based on delivery reliability, product quality, responsiveness, and compliance. Updated quarterly." },
  { key: "total_locations", label: "Total Locations", category: "Operational", iconName: "MapPin", subtitle: "Partner locations" },
  { key: "return_rate", label: "Return Rate", category: "Operational", iconName: "RotateCcw", subtitle: "Returns percentage", tooltip: "Percentage of delivered items returned due to defects, damage, or mismatch. Lower is better — industry benchmark is under 3%." },
];

const DEFAULT_DASH_KPIS = [
  "total_orders", "total_spent", "outstanding", "avg_order_value", "days_payable",
  "last_order_date", "payment_status", "credit_utilization",
];

function computeDashKpiValue(
  key: string,
  vendor: Vendor,
  _formatCurrency: (v: number) => string,
  formatDate: (d: string) => string,
  currencyMode: "base" | "partner" = "base",
): { value: React.ReactNode; change?: string; changeColor?: string } {
  const creditPct = vendor.creditLimit > 0
    ? Math.round((vendor.creditUtilization / vendor.creditLimit) * 100)
    : 0;
  const money = (v: number) => <CurrencyAmount {...renderProfileAmount(vendor, v, currencyMode)} />;
  switch (key) {
    case "total_orders": return { value: String(vendor.totalOrders) };
    case "total_spent": return { value: money(vendor.totalSpent) };
    case "outstanding": return { value: money(vendor.outstandingBalance) };
    case "avg_order_value": return {
      value: money(vendor.totalOrders > 0 ? vendor.totalSpent / vendor.totalOrders : 0),
      change: "↘ 240", changeColor: "#EF4444",
    };
    case "days_payable": return { value: "23 Days" };
    case "net_margin": return { value: `${(vendor.netProfitMargin ?? 0).toFixed(2)}%` };
    case "credit_limit": return { value: money(vendor.creditLimit) };
    case "last_order_date": return { value: formatDate(vendor.updatedAt) };
    case "payment_status": return { value: "—" };
    case "credit_utilization": return { value: `${creditPct}%`, change: "↗ 3.7%", changeColor: "hsl(var(--success))" };
    case "on_time_rate": return { value: "94.2%" };
    case "rating": return { value: `${vendor.rating.toFixed(1)} / 5` };
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
  category: "Performance" | "Financial" | "Operational" | "People & Docs" | "Notes";
}
const PARTNER_WIDGET_DEFS: PartnerWidgetDef[] = [
  { key: "spend_trend",       label: "Spend Trend",            type: "line",    description: "Yearly spend curve with area fill",            category: "Performance" },
  { key: "order_activity",    label: "Order Activity",         type: "chart",   description: "Orders vs returns by weekday",                 category: "Performance" },
  { key: "spend_by_category", label: "Spend by Category",      type: "donut",   description: "Donut breakdown of spend per category",        category: "Performance" },
  { key: "credit_health",     label: "Credit Health",          type: "gauge",   description: "Credit utilization vs available limit",        category: "Financial" },
  { key: "payment_history",   label: "Payment History",        type: "line",    description: "Recent payment volume sparkline",              category: "Financial" },
  { key: "invoice_aging",     label: "Invoice Aging",          type: "bars",    description: "Outstanding invoices grouped by age bucket",   category: "Financial" },
  { key: "delivery_perf",     label: "Delivery Performance",   type: "line",    description: "On-time delivery rate over time",              category: "Operational" },
  { key: "return_rate",       label: "Return Rate",            type: "bars",    description: "Returns volume by month",                      category: "Operational" },
  { key: "top_items",         label: "Top Items",              type: "bars",    description: "Highest-spend items stacked by tier",          category: "Operational" },
  { key: "recent_orders",     label: "Recent Orders",          type: "list",    description: "Latest orders with status colour dots",        category: "Operational" },
  { key: "primary_contact",   label: "Primary Contact",        type: "contact", description: "Main point-of-contact card with activity",    category: "People & Docs" },
  { key: "compliance_docs",   label: "Compliance & Documents", type: "donut",   description: "Valid vs missing compliance documents",        category: "People & Docs" },
  { key: "notes",             label: "Notes",                  type: "text",    description: "Internal notes & comments on this partner",    category: "Notes" },
];
const PARTNER_WIDGET_CATEGORY_ORDER: PartnerWidgetDef["category"][] = ["Performance", "Financial", "Operational", "People & Docs", "Notes"];

/** Visual preview for a partner widget. Light pastel tints (Tailwind 200/300
 *  family) give the drawer an airy feel; inactive cards desaturate to slate. */
function PartnerWidgetVisual({ type, isActive }: { type: PartnerWidgetVisualType; isActive: boolean }) {
  const C = {
    blue:    isActive ? "#93C5FD" : "hsl(var(--border))",
    orange:  isActive ? "#FDBA74" : "hsl(var(--border))",
    purple:  isActive ? "#C4B5FD" : "hsl(var(--border))",
    green:   isActive ? "#86EFAC" : "hsl(var(--border))",
    red:     isActive ? "#FCA5A5" : "hsl(var(--border))",
    slate:   isActive ? "#CBD5E1" : "hsl(var(--border))",
    needle:  isActive ? "#64748B" : "#94A3B8",
    lineFg:  isActive ? "#93C5FD" : "#CBD5E1",
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
function DashboardCustomizePanel({ open, onOpenChange, activeKpis, onToggleKpi, activeWidgets, onToggleWidget, widgetSizes, onWidgetSizeChange, vendor, formatCurrency, formatDate, currencyMode }: {
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
  currencyMode: "base" | "partner";
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
                style={{ backgroundColor: "hsl(var(--accent))" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
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
                    <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.kpis.map((kpi) => {
                      const isActive = activeKpis.includes(kpi.key);
                      const computed = computeDashKpiValue(kpi.key, vendor, formatCurrency, formatDate, currencyMode);
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
                            <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                            <div className="shrink-0">
                              {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
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
                      <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
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
                              <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }} title={w.label}>{w.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={w.description}>{w.description}</p>
                              {isActive && (
                                <div className="mt-2 flex items-center h-6 rounded-md border border-border bg-slate-50 p-0.5 gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  {(["sm", "md", "lg"] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onWidgetSizeChange(w.key, s); }}
                                      className={`flex-1 h-5 rounded text-[9.5px] transition-all duration-150 cursor-pointer ${
                                        sz === s ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-700"
                                      }`}
                                      style={{ fontWeight: sz === s ? 600 : 500 }}
                                    >
                                      {s.toUpperCase()}
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
function DashboardTab({ vendor, cfg, formatCurrency, formatDate, activeWidgets, widgetSizes, onWidgetSizeChange, onRemoveWidget, moveWidget, currencyMode }: {
  vendor: Vendor;
  cfg?: VendorConfigData;
  formatCurrency: (val: number) => string;
  formatDate: (dateStr: string) => string;
  activeWidgets: string[];
  widgetSizes: Record<string, "sm" | "md" | "lg">;
  onWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
  onRemoveWidget: (key: string) => void;
  moveWidget: (from: number, to: number) => void;
  /** "base" (default) shows PKR, "partner" shows the partner's default currency. */
  currencyMode: "base" | "partner";
}) {
  const creditPct = getCreditUtilizationPct(vendor);
  const available = vendor.creditLimit - vendor.creditUtilization;
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
  const [ptDetailOpen, setPtDetailOpen] = useState(false);
  const [ptDetailTerm, setPtDetailTerm] = useState<PaymentTermPreset | null>(null);
  const creditStatusLabel = creditPct > 80 ? "Critical" : creditPct > 50 ? "Warning" : "Healthy";
  const creditStatusColor = creditPct > 80 ? "hsl(var(--destructive))" : creditPct > 50 ? "hsl(var(--warning))" : "hsl(var(--success))";
  const creditBarColor = creditPct > 80 ? "#FEE2E2" : creditPct > 50 ? "#FEF3C7" : "#D1FAE5";

  return (
    <>
    <div className="flex gap-5 items-start">

      {/* ═══ LEFT COLUMN — Charts & Widgets (dynamic from activeWidgets) ═══ */}
      <div className="flex-1 min-w-0">
      <DndProvider backend={HTML5Backend}>
      <div className="flex flex-wrap gap-3 items-stretch min-w-0">
        {(() => {
          // Default spans per widget — overridden by size:
          // Small → always "half" (2 per row), Medium → default, Large → always "full"
          const DEFAULT_SPANS: Record<string, "full" | "half"> = {
            spend_trend: "full", order_activity: "full",
            spend_by_category: "half", credit_health: "half",
            delivery_perf: "half", invoice_aging: "half",
            primary_contact: "half", return_rate: "half",
            top_items: "half", recent_orders: "half",
            payment_history: "half", compliance_docs: "half",
            notes: "full",
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
            

            // ── Shared chart rendering helper ──
            const chartBox = (h: number, chart: React.ReactNode) => (
              <div style={{ height: h }} className="-ml-2"><ResponsiveContainer width="100%" height="100%">{chart as any}</ResponsiveContainer></div>
            );
            const statRow = (stats: { label: string; value: React.ReactNode; color?: string }[], compact?: boolean) => (
              <div className={`flex items-center ${compact ? "gap-3 mt-1.5 pt-1.5" : "gap-4 mt-2 pt-2"} border-t border-muted`}>
                {stats.map((s, i) => (<div key={i}><p className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>{s.label}</p><p className={compact ? "text-[11px]" : "text-[13px]"} style={{ fontWeight: 700, color: s.color || "#334155" }}>{s.value}</p></div>))}
              </div>
            );
            // Values flowing through <CurrencyAmount> via renderProfileAmount are
            // still passed in the partner's default currency — the helper converts
            // to base when currencyMode === "base" and picks the right display mode.
            const money = (v: number) => <CurrencyAmount {...renderProfileAmount(vendor, v, currencyMode)} />;
            const displayCode = currencyMode === "base" ? BASE_CURRENCY : vendor.defaultTransactionCurrency;
            const partnerCurInfo = getLibraryCurrency(displayCode);
            const axisInDisplay = shortAxisFormatter(displayCode);
            // Chart tick + tooltip values come straight from the raw (partner-currency)
            // data arrays; convert to base in the formatter when the toggle is on so
            // the axis labels and tooltip match the cells above.
            const toDisplayValue = (v: number) =>
              currencyMode === "base" ? convertToBase(v, vendor.defaultTransactionCurrency) : v;
            const partnerAxisFormatter = (v: number) => axisInDisplay(toDisplayValue(v));
            const chartMoneyFormatter = (val: number): [string, string] => {
              const sym = partnerCurInfo?.symbol ?? displayCode;
              return [`${sym} ${toDisplayValue(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Spend"];
            };
            const ttStyle = { borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 };

            if (wKey === "spend_trend") {
            icon = TrendingUp; title = "Spend Trend"; tip = "Tracks total monthly spend with this partner across all purchase orders and invoices. Use this to identify seasonal patterns and budget alignment.";
            const totalYTD = SPEND_TREND_DATA.reduce((s, d) => s + d.amount, 0);
            const avgMonthly = Math.round(totalYTD / SPEND_TREND_DATA.length);
            const peakMonth = SPEND_TREND_DATA.reduce((a, b) => a.amount > b.amount ? a : b);
            const lowMonth = SPEND_TREND_DATA.reduce((a, b) => a.amount < b.amount ? a : b);
            content = (
              <>
                {chartBox(CH[sz], (
                  <AreaChart data={SPEND_TREND_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="spendGradientUniq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={partnerAxisFormatter} />
                    <ReTooltip contentStyle={ttStyle} formatter={chartMoneyFormatter} />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#spendGradientUniq)" />
                  </AreaChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "YTD", value: money(totalYTD) },
                  { label: "Avg/mo", value: money(avgMonthly) },
                ], true)}
                {sz === "md" && statRow([
                  { label: "YTD Total", value: money(totalYTD) },
                  { label: "Monthly Avg", value: money(avgMonthly) },
                ])}
                {sz === "lg" && statRow([
                  { label: "YTD Total", value: money(totalYTD) },
                  { label: "Monthly Avg", value: money(avgMonthly) },
                  { label: "Peak Month", value: <span>{peakMonth.month} · {money(peakMonth.amount)}</span>, color: "hsl(var(--primary))" },
                  { label: "Lowest", value: <span>{lowMonth.month} · {money(lowMonth.amount)}</span>, color: "#94A3B8" },
                ])}
                <div className="flex items-center justify-end mt-1.5"><span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>This Year</span></div>
              </>
            );
          } else if (wKey === "order_activity") {
            icon = BarChart3; title = "Order Activity"; tip = "Shows daily order volume and return rates for the current week. Helps identify peak ordering days and track return patterns for quality monitoring.";
            const totalOrd = ORDER_ACTIVITY_DATA.reduce((s, d) => s + d.orders, 0);
            const totalRet = ORDER_ACTIVITY_DATA.reduce((s, d) => s + d.returns, 0);
            const retPct = totalOrd > 0 ? ((totalRet / totalOrd) * 100).toFixed(1) : "0";
            content = (
              <>
                {chartBox(CH[sz], (
                  <BarChart data={ORDER_ACTIVITY_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <ReTooltip contentStyle={ttStyle} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name="Orders" />
                    <Bar dataKey="returns" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name="Returns" />
                  </BarChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "Orders", value: `${totalOrd}` },
                  { label: "Returns", value: `${retPct}%`, color: "#F59E0B" },
                ], true)}
                {sz === "md" && statRow([
                  { label: "This Week", value: `${totalOrd} orders` },
                  { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                ])}
                {sz === "lg" && statRow([
                  { label: "This Week", value: `${totalOrd} orders` },
                  { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                  { label: "Peak Day", value: "Thursday · 8", color: "hsl(var(--primary))" },
                  { label: "Avg / Day", value: `${(totalOrd / 7).toFixed(1)}` },
                ])}
                <div className="flex items-center justify-end gap-3 mt-1.5">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /><span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Orders</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Returns</span></div>
                </div>
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
                      <span className="text-[11px] text-slate-700" style={{ fontWeight: 700 }}>{money(vendor.totalSpent)}</span>
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
                {sz === "sm" && statRow(spendCategories.slice(0, 2).map(c => ({ label: c.name, value: money(c.value) })), true)}
                {sz === "md" && statRow(spendCategories.slice(0, 3).map(c => ({ label: c.name, value: money(c.value) })))}
                {sz === "lg" && statRow(spendCategories.map(c => ({ label: c.name, value: money(c.value) })))}
              </>
            );
          } else if (wKey === "credit_health") {
            icon = Shield; title = "Credit Health"; tip = "Shows how much of the approved credit line is currently in use. Utilization above 80% triggers risk alerts. Includes available balance, current usage, and total limit.";
            content = (
              <>
                <div className="flex items-center justify-between mb-2"><span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>Credit Utilization</span><span className="text-[13px] text-slate-700" style={{ fontWeight: 700 }}>{creditPct}%</span></div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(creditPct, 100)}%`, backgroundColor: creditPct > 80 ? "hsl(var(--destructive))" : creditPct > 50 ? "hsl(var(--warning))" : "hsl(var(--success))" }} /></div>
                <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{money(0)}</span><span className="text-[10px]" style={{ fontWeight: 500, color: creditStatusColor }}>{creditStatusLabel}</span><span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{money(vendor.creditLimit)}</span></div>
                {sz === "sm" && statRow([
                  { label: "Available", value: money(Math.max(available, 0)), color: "hsl(var(--success))" },
                  { label: "Limit", value: money(vendor.creditLimit) },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Available", value: money(Math.max(available, 0)), color: "hsl(var(--success))" },
                  { label: "Used", value: money(vendor.creditUtilization) },
                  { label: "Limit", value: money(vendor.creditLimit) },
                ])}
                {sz === "lg" && statRow([
                  { label: "Available", value: money(Math.max(available, 0)), color: "hsl(var(--success))" },
                  { label: "Used", value: money(vendor.creditUtilization) },
                  { label: "Limit", value: money(vendor.creditLimit) },
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
                    <defs><linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.15} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`, "On-Time"]} />
                    <Area type="monotone" dataKey="rate" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#delivGrad)" />
                  </AreaChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "On-Time", value: "94%", color: "hsl(var(--success))" },
                  { label: "Late", value: "6%", color: "hsl(var(--warning))" },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Current", value: "94%", color: "hsl(var(--success))" },
                  { label: "Average", value: "92.2%" },
                  { label: "Late", value: "6%", color: "hsl(var(--warning))" },
                ])}
                {sz === "lg" && statRow([
                  { label: "Current", value: "94%", color: "hsl(var(--success))" },
                  { label: "6-Mo Avg", value: "92.2%" },
                  { label: "Late Rate", value: "6%", color: "hsl(var(--warning))" },
                  { label: "Best Month", value: "Jan · 95%", color: "hsl(var(--success))" },
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={partnerAxisFormatter} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number): [string, string] => {
                      const sym = partnerCurInfo?.symbol ?? displayCode;
                      return [`${sym} ${toDisplayValue(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Amount"];
                    }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 20 : 36}>
                      {[0, 1, 2, 3].map((i) => (<Cell key={i} fill={["hsl(var(--primary))", "#3B82F6", "hsl(var(--warning))", "hsl(var(--destructive))"][i]} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([
                  { label: "Overdue", value: money(Math.round(vendor.outstandingBalance * 0.35)), color: "hsl(var(--destructive))" },
                  { label: "Avg Days", value: "42", color: "hsl(var(--warning))" },
                ], true)}
                {sz === "md" && statRow([
                  { label: "Total Overdue", value: money(Math.round(vendor.outstandingBalance * 0.35)), color: "hsl(var(--destructive))" },
                  { label: "Invoices", value: "11" },
                  { label: "Avg Days", value: "42", color: "hsl(var(--warning))" },
                ])}
                {sz === "lg" && statRow([
                  { label: "Total Overdue", value: money(Math.round(vendor.outstandingBalance * 0.35)), color: "hsl(var(--destructive))" },
                  { label: "Open Invoices", value: "11" },
                  { label: "Avg Days", value: "42", color: "hsl(var(--warning))" },
                  { label: "Oldest", value: "98 days", color: "hsl(var(--destructive))" },
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
                          <Line type="monotone" dataKey="h" stroke="hsl(var(--violet))" strokeWidth={1.5} dot={{ r: 1.5, fill: "hsl(var(--violet))" }} />
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
                          <Line type="monotone" dataKey="h" stroke="hsl(var(--violet))" strokeWidth={2} dot={{ r: 2, fill: "hsl(var(--violet))" }} />
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
                      <p className="text-[10px] text-slate-400 mb-1 ml-2" style={{ fontWeight: 500 }}>Response Time (hours)</p>
                      <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={[{ w: "W1", h: 4.2 }, { w: "W2", h: 3.8 }, { w: "W3", h: 2.5 }, { w: "W4", h: 3.1 }, { w: "W5", h: 1.8 }, { w: "W6", h: 2.2 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                          <XAxis dataKey="w" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[0, 6]} />
                          <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}h`, "Avg"]} />
                          <Line type="monotone" dataKey="h" stroke="hsl(var(--violet))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--violet))" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {statRow([{ label: "Avg Response", value: "2.9h", color: "hsl(var(--violet))" }, { label: "Best", value: "1.8h", color: "hsl(var(--success))" }, { label: "Worst", value: "4.2h", color: "hsl(var(--warning))" }])}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <ReTooltip contentStyle={ttStyle} />
                    <Line type="monotone" dataKey="rate" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} name="Return %" />
                    <Line type="monotone" dataKey="defect" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--destructive))" }} name="Defect %" strokeDasharray="5 5" />
                  </LineChart>
                ))}
                {sz === "sm" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "hsl(var(--destructive))" }], true)}
                {sz === "md" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "hsl(var(--destructive))" }])}
                {sz === "lg" && statRow([{ label: "Returns", value: "2.1%", color: "#F59E0B" }, { label: "Defects", value: "1.1%", color: "hsl(var(--destructive))" }, { label: "6-Mo Trend", value: "↓ Improving", color: "hsl(var(--success))" }, { label: "Items Returned", value: "12" }])}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={partnerAxisFormatter} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={90} />
                    <ReTooltip contentStyle={ttStyle} formatter={chartMoneyFormatter} />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]} barSize={sz === "sm" ? 10 : 16}>
                      {topItemsData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([{ label: "#1", value: "Steel Alloy A" }, { label: "Top 5", value: money(topItemsData.reduce((s, d) => s + d.spend, 0)) }], true)}
                {sz === "md" && statRow([{ label: "Top Item", value: "Steel Alloy A" }, { label: "Total (Top 5)", value: money(topItemsData.reduce((s, d) => s + d.spend, 0)) }])}
                {sz === "lg" && statRow([{ label: "Top Item", value: "Steel Alloy A" }, { label: "Top 5 Total", value: money(topItemsData.reduce((s, d) => s + d.spend, 0)) }, { label: "% of Spend", value: "59%" }, { label: "Unique SKUs", value: "5" }])}
              </>
            );
          } else if (wKey === "recent_orders") {
            icon = ClipboardList; title = "Recent Orders"; tip = "Shows the 5 most recent purchase orders with their current fulfillment status and value. Color-coded bars indicate delivery status: green (delivered), blue (in transit), amber (pending).";
            content = (
              <>
                {chartBox(CH[sz], (
                  <BarChart data={[
                    { po: "28180", amount: Math.round(vendor.totalSpent * 0.04) }, { po: "28255", amount: Math.round(vendor.totalSpent * 0.07) },
                    { po: "28312", amount: Math.round(vendor.totalSpent * 0.05) }, { po: "28390", amount: Math.round(vendor.totalSpent * 0.06) },
                    { po: "28451", amount: Math.round(vendor.totalSpent * 0.08) },
                  ]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="po" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `PO-${v}`} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={partnerAxisFormatter} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number): [string, string] => {
                      const sym = partnerCurInfo?.symbol ?? displayCode;
                      return [`${sym} ${toDisplayValue(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Amount"];
                    }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 16 : 24}>
                      {[0, 1, 2, 3, 4].map((i) => (<Cell key={i} fill={[1, 2, 4].includes(i) ? "hsl(var(--success))" : i === 3 ? "hsl(var(--primary))" : "hsl(var(--warning))"} />))}
                    </Bar>
                  </BarChart>
                ))}
                {sz === "sm" && statRow([{ label: "Delivered", value: "3", color: "hsl(var(--success))" }, { label: "Pending", value: "1", color: "hsl(var(--warning))" }], true)}
                {sz === "md" && statRow([{ label: "Delivered", value: "3", color: "hsl(var(--success))" }, { label: "In Transit", value: "1", color: "hsl(var(--primary))" }, { label: "Pending", value: "1", color: "hsl(var(--warning))" }])}
                {sz === "lg" && statRow([{ label: "Delivered", value: "3", color: "hsl(var(--success))" }, { label: "In Transit", value: "1", color: "hsl(var(--primary))" }, { label: "Pending", value: "1", color: "hsl(var(--warning))" }, { label: "Total Value", value: money(Math.round(vendor.totalSpent * 0.3)) }])}
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
                    <defs><linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.12} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={partnerAxisFormatter} />
                    <ReTooltip contentStyle={ttStyle} formatter={(v: number): [string, string] => {
                      const sym = partnerCurInfo?.symbol ?? displayCode;
                      return [`${sym} ${toDisplayValue(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, ""];
                    }} />
                    <Area type="monotone" dataKey="paid" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#paidGrad)" name="Paid" />
                    <Area type="monotone" dataKey="pending" stroke="hsl(var(--warning))" strokeWidth={1.5} fill="none" strokeDasharray="4 4" name="Pending" />
                  </AreaChart>
                ))}
                {sz === "sm" && statRow([{ label: "Paid", value: money(paidTotal), color: "hsl(var(--success))" }, { label: "Pending", value: money(pendTotal), color: "hsl(var(--warning))" }], true)}
                {sz === "md" && statRow([{ label: "Total Paid", value: money(paidTotal), color: "hsl(var(--success))" }, { label: "Pending", value: money(pendTotal), color: "hsl(var(--warning))" }])}
                {sz === "lg" && statRow([{ label: "Total Paid", value: money(paidTotal), color: "hsl(var(--success))" }, { label: "Pending", value: money(pendTotal), color: "hsl(var(--warning))" }, { label: "Transactions", value: "24" }, { label: "Avg Payment", value: money(Math.round(paidTotal / 24)) }])}
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
                        <Cell fill="hsl(var(--success))" /><Cell fill="hsl(var(--muted))" />
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
                      { name: "W-9 Tax Form", status: "Valid", sc: "hsl(var(--success))", sb: "#ECFDF5" },
                      { name: "Certificate of Insurance", status: "Valid", sc: "hsl(var(--success))", sb: "#ECFDF5" },
                      { name: "NDA Agreement", status: "Active", sc: "hsl(var(--success))", sb: "#ECFDF5" },
                      { name: "Quality Cert (ISO)", status: "Expiring", sc: "hsl(var(--warning))", sb: "#FFFBEB" },
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
          } else if (wKey === "notes") {
            if (!vendor.notes) return null;
            icon = MessageSquare; title = "Notes & Activity"; tip = "Internal partner notes and a chronological timeline of recent activities including payments, deliveries, approvals, and manual annotations by team members.";
            content = (
              <div>
                <p className={`text-[12px] text-muted-foreground leading-relaxed ${sz === "sm" ? "line-clamp-3 mb-2" : "mb-3"}`}>{vendor.notes}</p>
                {sz === "sm" && (
                  <div className="space-y-2 border-t border-muted pt-2">
                    {[
                      { time: "Mar 28", action: "Payment received", detail: "PAY-9841 · $8,520", color: "hsl(var(--success))" },
                      { time: "Mar 21", action: "Order delivered", detail: "PO-28390 · 42 items", color: "hsl(var(--primary))" },
                    ].map((event, i, arr) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex flex-col items-center mt-0.5"><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />{i < arr.length - 1 && <div className="w-px h-5 bg-border mt-0.5" />}</div>
                        <div className="min-w-0"><p className="text-[10px] text-slate-700" style={{ fontWeight: 500 }}>{event.action}</p><p className="text-[9px] text-slate-400">{event.time} · {event.detail}</p></div>
                      </div>
                    ))}
                  </div>
                )}
                {sz !== "sm" && (
                  <div className="space-y-3 border-t border-muted pt-3">
                    {[
                      { time: "Mar 28", action: "Payment received", detail: "PAY-9841 · $8,520", color: "hsl(var(--success))" },
                      { time: "Mar 21", action: "Order delivered", detail: "PO-28390 · 42 items", color: "hsl(var(--primary))" },
                      { time: "Mar 15", action: "Note added", detail: "Quality review completed", color: "hsl(var(--violet))" },
                      ...(sz === "lg" ? [{ time: "Mar 10", action: "Invoice approved", detail: "INV-1204 · $11,400", color: "#F59E0B" }] : []),
                    ].map((event, i, arr) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center mt-0.5"><div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />{i < arr.length - 1 && <div className="w-px h-6 bg-border mt-0.5" />}</div>
                        <div className="min-w-0"><p className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{event.action}</p><p className="text-[10px] text-slate-400">{event.time} · {event.detail}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

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
                    <ContentCard title={title} icon={icon} {...sizeProps} tooltip={tip} isDragging={dragging} isOver={over} onRemove={() => onRemoveWidget(wKey)}>
                      {content}
                    </ContentCard>
                  )}
                </DraggableWidgetCard>
              ),
            });
          });

          return nodes.map((n) => (
            <div key={n.key} style={{ width: n.width }} className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
              {n.node}
            </div>
          ));
        })()}
      </div>
      </DndProvider>
      </div>

      {/* ═══ RIGHT COLUMN — Information Cards ═══ */}
      <div className="w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4 sticky top-[160px]">

        {/* Partner Information */}
        <DashInfoCard title="Partner Information" icon={Building2}>
          {partnerGroupData && (
            <div className="mb-3">
              <DashInfoLabel>Partner Group</DashInfoLabel>
              <p className="text-[12.5px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
                {partnerGroupData.id} <span className="text-slate-500" style={{ fontWeight: 400 }}>•</span> {partnerGroupData.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{partnerGroupData.description}</p>
            </div>
          )}
          {!partnerGroupData && vendor.partnerGroup && (
            <div className="mb-3">
              <DashInfoLabel>Partner Group</DashInfoLabel>
              <p className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.partnerGroup}</p>
            </div>
          )}
          <div className="mb-3">
            <DashInfoLabel>Partner Type</DashInfoLabel>
            <div className="flex items-center gap-1.5 mt-1">
              {vendor.partnerTypes.map((t) => (
                <span key={t} className={`text-[11px] px-2.5 py-1 rounded-md border ${t === "vendor" ? "bg-green-50 border-[#BBF7D0] text-[#166534]" : "bg-blue-50 border-blue-200 text-blue-800"}`} style={{ fontWeight: 500 }}>
                  {t === "vendor" ? "Vendor" : "Customer"}
                </span>
              ))}
            </div>
            {cfg && (cfg.vendorSubTypes?.length || cfg.customerSubTypes?.length) ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {(cfg.vendorSubTypes || []).map((st) => (
                  <span key={st} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>{st.replace(/_/g, " ")}</span>
                ))}
                {(cfg.customerSubTypes || []).map((st) => (
                  <span key={st} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>{st.replace(/_/g, " ")}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel>Partner Code</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate font-mono" style={{ fontWeight: 500 }}>{vendor.code}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Category</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{CATEGORY_LABELS[vendor.category]}</p>
            </div>
          </div>
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
              <DashInfoLabel>Tax ID</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate font-mono" style={{ fontWeight: 500 }}>{vendor.taxId || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel>Services</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{vendor.services || "—"}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Country</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}><FlagImage code={flagEmojiCode(vendor.countryFlag)} /> {vendor.country}</p>
            </div>
          </div>
          {vendor.billingAddress.street && (
            <div className="mb-2.5">
              <DashInfoLabel>Address</DashInfoLabel>
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>
                {vendor.billingAddress.street}, {vendor.billingAddress.city}
                {vendor.billingAddress.state ? `, ${vendor.billingAddress.state}` : ""}{" "}
                {vendor.billingAddress.zipCode}, {vendor.billingAddress.country}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 pt-2.5 border-t border-muted">
            <div className="min-w-0">
              <DashInfoLabel>Created By</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: toAAAColor(vendor.createdByContact?.bgColor || "#6366f1"), fontWeight: 600 }}>
                  {vendor.createdByContact?.initials || "?"}
                </div>
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
              <DashInfoLabel>Default Transaction Currency</DashInfoLabel>
              {(() => {
                const pc = getLibraryCurrency(vendor.defaultTransactionCurrency);
                if (!pc) return <p className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>—</p>;
                const sym = pc.symbol ?? pc.code;
                return (
                  <p className="text-[12.5px] text-slate-700 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                    <CurrencyFlag currency={pc} size={16} />
                    <span>{pc.name} ({sym})</span>
                  </p>
                );
              })()}
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Rating</DashInfoLabel>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.rating.toFixed(1)} / 5</span>
              </div>
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
                <p className="text-[15px] text-success" style={{ fontWeight: 700 }}>
                  <CurrencyAmount {...renderProfileAmount(vendor, totalCashIn, currencyMode)} />
                </p>
              </div>
              <div className="min-w-0">
                <DashInfoLabel tooltip="Total disbursements made to this partner.">Cash Outflow</DashInfoLabel>
                <p className="text-[15px] text-destructive" style={{ fontWeight: 700 }}>
                  <CurrencyAmount {...renderProfileAmount(vendor, totalCashOut, currencyMode)} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-px">
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding Payables</p>
              <DetailRichTooltip data={{
                title: "OUTSTANDING PAYABLES",
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
              <p className="text-[15px] text-slate-700" style={{ fontWeight: 700 }}>
                <CurrencyAmount {...renderProfileAmount(vendor, vendor.outstandingBalance, currencyMode)} />
              </p>
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
                  title: "CREDIT UTILIZATION",
                  description: "How much of the approved credit line is currently in use. Utilization above 80% is flagged as high risk and may trigger enforcement actions.",
                  breakdown: [
                    { label: "Approved Limit", value: formatCurrency(vendor.creditLimit) },
                    { label: "Currently Used", value: formatCurrency(vendor.creditUtilization) },
                    { label: "Available", value: formatCurrency(vendor.creditLimit - vendor.creditUtilization), isResult: true },
                  ],
                  formula: "Available = Credit Limit – Current Utilization",
                }}>
                  <span className="inline-flex shrink-0"><Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" /></span>
                </DetailRichTooltip>
              </div>
              <p className="text-[16px] text-slate-700 truncate" style={{ fontWeight: 700 }}>
                <CurrencyAmount {...renderProfileAmount(vendor, vendor.creditLimit, currencyMode)} />
              </p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel tooltip="Amount of credit currently in use. Calculated as sum of open orders and pending invoices against the credit limit.">Utilization</DashInfoLabel>
              <p className="text-[16px] text-slate-700 truncate" style={{ fontWeight: 700 }}>
                <CurrencyAmount {...renderProfileAmount(vendor, vendor.creditUtilization, currencyMode)} />
              </p>
            </div>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "hsl(var(--muted))" }}>
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
        <DashInfoCard title="Payment Terms" icon={Receipt} tooltip="Active payment terms applied to this partner. Determines when payment is due, early payment discounts, and enforcement rules.">
          {(() => {
            const termPreset: PaymentTermPreset = paymentTermCfg
              ? (PAYMENT_TERM_PRESETS.find((p) => p.name === paymentTermCfg.name) || {
                  id: "pt-cfg",
                  name: paymentTermCfg.name,
                  category: (paymentTermCfg.type === "prepayment" ? "prepayment" : "net") as "net" | "prepayment" | "split",
                  typeBadge: paymentTermCfg.type === "prepayment" ? "Pre" : "NET",
                  badgeColor: paymentTermCfg.type === "prepayment" ? "hsl(var(--violet))" : "hsl(var(--primary))",
                  trigger: paymentTermCfg.trigger.replace(/_/g, " "),
                  description: paymentTermCfg.description,
                  vendorsApplied: 4,
                  duration: paymentTermCfg.duration,
                  discountPercent: paymentTermCfg.discountPercent,
                  discountPeriod: paymentTermCfg.discountPeriod,
                })
              : (PAYMENT_TERM_PRESETS.find((p) => p.name === PAYMENT_TERMS_LABELS[vendor.paymentTerms]) || {
                  id: "pt-default",
                  name: PAYMENT_TERMS_LABELS[vendor.paymentTerms],
                  category: "net" as const,
                  typeBadge: "NET",
                  badgeColor: "hsl(var(--primary))",
                  trigger: "Invoice Date",
                  description: "Standard payment terms for this partner.",
                  vendorsApplied: 3,
                });
            return (
              <PaymentTermCard
                term={termPreset}
                readOnly
                onClick={() => { setPtDetailTerm(termPreset); setPtDetailOpen(true); }}
                currencyMode={currencyMode}
                partnerCurrency={vendor.defaultTransactionCurrency}
              />
            );
          })()}
        </DashInfoCard>

        {/* Carrier & Shipping */}
        <DashInfoCard title="Carrier & Shipping" icon={Truck} tooltip="Preferred shipping carriers and methods configured for this partner. Affects primary carrier selection on new purchase orders." defaultOpen={false}>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 500 }}>Primary Carrier (Vendor)</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.defaultCarrierVendor || "—"}</p>
                  <p className="text-[10.5px] text-slate-500">For fastest delivery</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-blue-800 shrink-0" style={{ fontWeight: 600 }}>Primary</span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 500 }}>Primary Carrier (Customer)</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-violet" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.defaultCarrierCustomer || "—"}</p>
                  <p className="text-[10.5px] text-slate-500">For customer shipments</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-blue-800 shrink-0" style={{ fontWeight: 600 }}>Primary</span>
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
          <DashInfoCard title="Point of Contacts" icon={Users} count={vendor.globalPointOfContacts.length} defaultOpen={false}>
            <div className="space-y-2">
              {vendor.globalPointOfContacts.slice(0, 5).map((contact, idx) => {
                const _at = getPocAvatarTint(contact.bgColor);
                return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] shrink-0" style={{ backgroundColor: _at.bg, color: _at.text, fontWeight: 700 }}>
                    {contact.initials}
                  </div>
                  <span className="text-[11.5px] text-slate-700" style={{ fontWeight: 500 }}>{contact.name}</span>
                  {idx === 0 && (
                    <span className="text-[9px] text-primary px-1.5 py-0.5 rounded-md bg-accent ml-auto shrink-0" style={{ fontWeight: 600 }}>PRIMARY</span>
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
      currencyMode={currencyMode}
      partnerCurrency={vendor.defaultTransactionCurrency}
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
            <code className="text-[10px] text-[#1D4ED8]" style={{ fontWeight: 500, fontFamily: "ui-monospace, monospace" }}>{data.formula}</code>
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
          className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + "px" : "1000px") : "0px",
          opacity: isOpen ? 1 : 0,
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
                <ChartColumn className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
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
                <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
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
                        <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                        <div className="shrink-0">
                          {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
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

function DraggableKpiCard({ index, kpiKey, label, value, subtitle, iconName, tooltip, change, changeColor, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: React.ReactNode; subtitle?: string; iconName?: string; tooltip?: string;
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
            <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
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
        {/* Value row with optional change indicator */}
        <div className="flex items-baseline gap-1.5">
          {change && (
            <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: changeColor || "hsl(var(--success))" }}>{change}</span>
          )}
          <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
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

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>{label}</p>
      <p className={`text-[12px] text-slate-700 ${mono ? "font-mono" : ""}`} style={{ fontWeight: 500 }}>{value}</p>
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
  createdBy: { name: string; initials: string; bgColor: string; fgColor?: string; photo?: string };
  lastUpdated: string;
  phone: string;
  email: string;
  image: string;
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
  { name: "Ahtisham Ahmad", initials: "AA", bgColor: "hsl(var(--accent))", fgColor: "hsl(var(--primary))", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
  { name: "Sarah Mitchell", initials: "SM", bgColor: "#F0FDF4", fgColor: "#16A34A", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "James Wilson", initials: "JW", bgColor: "#FFF7ED", fgColor: "#EA580C", photo: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Maria Garcia", initials: "MG", bgColor: "#F5F3FF", fgColor: "hsl(var(--violet))", photo: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "David Chen", initials: "DC", bgColor: "#ECFEFF", fgColor: "#0891B2", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Emily Johnson", initials: "EJ", bgColor: "#FFF1F2", fgColor: "#E11D48", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Robert Taylor", initials: "RT", bgColor: "#F0FDFA", fgColor: "#0D9488", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Lisa Anderson", initials: "LA", bgColor: "#FEF9C3", fgColor: "#A16207", photo: "https://randomuser.me/api/portraits/women/17.jpg" },
];

const POC_NAMES = [
  { name: "Sarah Mitchell", initials: "SM", bgColor: "hsl(var(--accent))", fgColor: "hsl(var(--primary))", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "James Wilson", initials: "JW", bgColor: "#F0FDF4", fgColor: "#16A34A", photo: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Maria Garcia", initials: "MG", bgColor: "#FFF7ED", fgColor: "#EA580C", photo: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "David Chen", initials: "DC", bgColor: "#F5F3FF", fgColor: "hsl(var(--violet))", photo: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Emily Johnson", initials: "EJ", bgColor: "#ECFEFF", fgColor: "#0891B2", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Robert Taylor", initials: "RT", bgColor: "#FFF1F2", fgColor: "#E11D48", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Lisa Anderson", initials: "LA", bgColor: "#FEF9C3", fgColor: "#A16207", photo: "https://randomuser.me/api/portraits/women/17.jpg" },
  { name: "Kevin Brown", initials: "KB", bgColor: "#F0FDFA", fgColor: "#0D9488", photo: "https://randomuser.me/api/portraits/men/64.jpg" },
  { name: "Amanda White", initials: "AW", bgColor: "#FDF2F8", fgColor: "#DB2777", photo: "https://randomuser.me/api/portraits/women/56.jpg" },
  { name: "Daniel Martinez", initials: "DM", bgColor: "#EFF6FF", fgColor: "#2563EB", photo: "https://randomuser.me/api/portraits/men/18.jpg" },
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
  return vendor.partnerLocations.map((locName, idx) => {
    const seed = locName.length + idx;
    const cityData = MOCK_CITIES[seed % MOCK_CITIES.length];
    const street = MOCK_STREETS[seed % MOCK_STREETS.length];
    const creator = CREATOR_NAMES[seed % CREATOR_NAMES.length];
    const daysAgo = ((seed * 17 + idx * 7) % 365) + 1;
    const updDate = new Date();
    updDate.setDate(updDate.getDate() - daysAgo);

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
      status: idx % 7 === 0 ? "inactive" as const : "active" as const,
      createdBy: creator,
      lastUpdated: updDate.toISOString(),
      phone: `+1 (${300 + (seed % 700)}) ${100 + (idx * 37 % 900)}-${1000 + (seed * 13 % 9000)}`,
      email: `${locName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@${vendor.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
      image: LOCATION_IMAGES[(seed + idx) % LOCATION_IMAGES.length],
    };
  });
}

function PartnerLocationsTab({ vendor, cfg, formatDate, initialLocationIdx, onInitialLocationConsumed }: {
  vendor: Vendor;
  cfg?: VendorConfigData;
  formatDate: (dateStr: string) => string;
  /** When set, auto-open the detail modal for the matching location on mount (deep-link from QuickView). */
  initialLocationIdx?: number;
  /** Fired once the deep-link is consumed so the parent can clear the URL param. */
  onInitialLocationConsumed?: () => void;
}) {
  const generatedLocations = useMemo(() => generateLocationsFromVendor(vendor), [vendor]);
  const [createdLocations, setCreatedLocations] = useState<PartnerLocationData[]>([]);
  const [highlightedLocationId, setHighlightedLocationId] = useState<string | null>(null);

  const locations = useMemo(() => [...createdLocations, ...generatedLocations], [createdLocations, generatedLocations]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedLocation, setSelectedLocation] = useState<PartnerLocationData | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [locDetailTab, setLocDetailTab] = useState("poc");
  const [locAboutOpen, setLocAboutOpen] = useState(true);
  const [locPocOpen, setLocPocOpen] = useState(true);
  const [locBillingOpen, setLocBillingOpen] = useState(true);
  const [locCreditOpen, setLocCreditOpen] = useState(false);
  const [locCarrierOpen, setLocCarrierOpen] = useState(false);
  const [locPtOpen, setLocPtOpen] = useState(false);
  const [createLocationModalOpen, setCreateLocationModalOpen] = useState(false);

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
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  // ── Column infrastructure (matches VendorsListPage exactly) ──
  const LOC_COLUMNS: { key: string; label: string; minWidth: string; sortable?: boolean }[] = [
    { key: "location_name", label: "Location Name", minWidth: "320px", sortable: true },
    { key: "address", label: "Address", minWidth: "300px" },
    { key: "city_state", label: "City / State", minWidth: "200px", sortable: true },
    { key: "poc", label: "Point of Contact", minWidth: "280px" },
    { key: "service_centers", label: "Service Centers", minWidth: "260px" },
    { key: "created_by", label: "Created By", minWidth: "240px" },
    { key: "last_updated", label: "Last Updated", minWidth: "180px", sortable: true },
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
  // ── Pricing Rules sub-tab state (Vendor / Customer) ──
  const [locPricingSubTab, setLocPricingSubTab] = useState<"vendor" | "customer">("vendor");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<CarrierFilter>("all");
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
    let list = locations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.state.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((l) => l.status === statusFilter);
    }
    return list;
  }, [locations, searchQuery, statusFilter]);

  const activeCount = locations.filter((l) => l.status === "active").length;
  const inactiveCount = locations.filter((l) => l.status === "inactive").length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filtered.slice(start, start + recordsPerPage);
  }, [filtered, currentPage, recordsPerPage]);

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

  const QUICK_FILTERS: { key: "all" | "active" | "inactive"; label: string; count: number }[] = [
    { key: "all", label: "Show All", count: locations.length },
    { key: "active", label: "Active", count: activeCount },
    { key: "inactive", label: "Inactive", count: inactiveCount },
  ];

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

  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setIsFullScreen(false);
    setLocDetailTab("poc");
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
    const AVATAR_COLORS = ["hsl(var(--primary))", "hsl(var(--violet))", "hsl(var(--success))", "hsl(var(--warning))"];
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

  const modalBaseClass = "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  const modalSizeClass = isFullScreen
    ? `${modalBaseClass} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `${modalBaseClass} !max-w-[100%] sm:!max-w-[1200px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl`;

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
                placeholder="Search by name, type, or email..."
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
            <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
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
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
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
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create New Location</span>
            </button>
          </div>
        </div>

        {/* Row 2: Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
          {QUICK_FILTERS.map((f) => {
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                }`}
                style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "hsl(var(--primary))" : undefined }}
              >
                {f.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                  style={{ fontWeight: 600, color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-border shrink-0" />

        {/* Content area */}
        {density === "card" ? (
          /* Card View */
          <div className="p-4 min-h-0 overflow-y-auto flex-1">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MapPin className="w-8 h-8" />
                <p className="text-sm">No locations found</p>
                {searchQuery && (
                  <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setCurrentPage(1); }}>
                    Clear search
                  </Button>
                )}
              </div>
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
                    {/* Location Image — top banner */}
                    <div className="relative w-full h-[160px] overflow-hidden bg-muted">
                      <img
                        src={loc.image}
                        alt={loc.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                      />
                      {/* Bottom-left: Status + Country pills on image */}
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                        {isHighlighted && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase shadow-sm backdrop-blur-sm"
                            style={{ fontWeight: 700, backgroundColor: "rgba(10,119,255,0.9)", color: "#fff" }}
                          >
                            <Sparkles className="w-3 h-3" />
                            NEW
                          </span>
                        )}
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                          style={{
                            fontWeight: 600,
                            backgroundColor: loc.status === "active" ? "rgba(236,253,245,0.92)" : "rgba(255,251,235,0.92)",
                            color: loc.status === "active" ? "#065F46" : "#92400E",
                            borderColor: loc.status === "active" ? "#A7F3D0" : "#FDE68A",
                          }}
                        >
                          {loc.status === "active" ? "Active" : "Inactive"}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                          style={{
                            fontWeight: 500,
                            backgroundColor: "rgba(241,245,249,0.92)",
                            color: "#334155",
                            borderColor: "#CBD5E1",
                          }}
                        >
                          <span className="text-[12px]"><FlagImage code={flagEmojiCode(getCountryFlag(loc.country))} /></span>
                          {loc.country}
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
                          <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleOpenLocation(loc)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Edit location coming soon!")}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => toast.info("Archive coming soon")}>
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

                      {/* Stats — inline compact row */}
                      <div className="px-3.5 pt-3 pb-3 flex-1 flex items-end">
                        <div className="flex items-center gap-3 text-[11.5px]">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{loc.contacts}</span>
                          </div>
                          <div className="w-px h-3 bg-border" />
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{loc.items}</span>
                          </div>
                          <div className="w-px h-3 bg-border" />
                          <div className="flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{loc.serviceCenters}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-3.5 py-2.5 border-t border-muted flex items-center justify-between text-[10.5px] text-slate-400">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] shrink-0 overflow-hidden border border-[#E8ECF1]"
                            style={{ backgroundColor: loc.createdBy.photo ? "transparent" : loc.createdBy.bgColor, fontWeight: 600 }}
                          >
                            {loc.createdBy.photo ? <img src={loc.createdBy.photo} alt="" className="w-full h-full object-cover" /> : <span style={{ color: loc.createdBy.fgColor || "#334155" }}>{loc.createdBy.initials}</span>}
                          </div>
                          <span className="text-muted-foreground truncate" style={{ fontWeight: 500 }}>{loc.createdBy.name}</span>
                        </div>
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
                        {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "hsl(var(--primary))" }} />}
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
                              <span className="text-[13px]" style={currentSort ? { color: "hsl(var(--primary))" } : undefined}>{def.label}</span>
                              {currentSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                              {currentSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
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
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <MapPin className="w-8 h-8" />
                        <p className="text-sm">No locations found</p>
                      </div>
                    </TableCell>
                  </TableRow>
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
                                    category="Point of Contacts"
                                    items={loc.pocNames.slice(1).map((p, i) => ({
                                      id: `${loc.id}-poc-${i}`,
                                      name: p.name,
                                      subtitle: "CONTACT",
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
                              <span className={`inline-flex items-center gap-1 ${isComfort ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[11px]"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>
                                <Wrench className="w-3 h-3 text-slate-400" />
                                {loc.serviceCenterNames[0] || "Center"}
                              </span>
                              {loc.serviceCenterNames.length > 1 && (
                                <OverflowTooltip
                                  category="Service Centers"
                                  items={loc.serviceCenterNames.slice(1).map((sc, i) => ({
                                    id: `${loc.id}-sc-${i}`,
                                    name: sc,
                                    subtitle: "SERVICE CENTER",
                                  }))}
                                >
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>+{loc.serviceCenterNames.length - 1}</span>
                                </OverflowTooltip>
                              )}
                            </div>
                          </TableCell>
                        );
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
                        case "last_updated": return (
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
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Edit location coming soon!")}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-red-50"
                              onClick={() => toast.info("Archive coming soon")}
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
        onOpenChange={setCreateLocationModalOpen}
        vendorName={vendor.companyName}
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

          const newId = `loc-new-${Date.now()}`;
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
            createdBy: { name: "You", initials: "YO", bgColor: "hsl(var(--accent))", fgColor: "hsl(var(--primary))" },
            lastUpdated: new Date().toISOString(),
            phone: d.phone || "",
            email: d.email || "",
            image: d.profileImage || LOCATION_IMAGES[Math.floor(Math.random() * LOCATION_IMAGES.length)],
          };

          setCreatedLocations((prev) => [newLoc, ...prev]);
          setHighlightedLocationId(newId);
          // Reset filters/search to ensure the new card is visible
          setStatusFilter("all");
          setSearchQuery("");
          setCurrentPage(1);
          // Clear highlight after 3.5s
          setTimeout(() => setHighlightedLocationId(null), 3500);
        }}
      />

      {/* ══════ Location Detail Modal ══════ */}
      <Dialog open={detailModalOpen} onOpenChange={(open) => { if (!open) handleCloseDetailModal(); }}>
        <DialogContent
          className={`flex flex-col p-0 gap-0 border-0 sm:border z-[200] ${modalSizeClass}`}
          hideCloseButton
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <DialogTitle className="sr-only">Location Details</DialogTitle>
          <DialogDescription className="sr-only">View details of this partner location.</DialogDescription>
          {selectedLocation && (() => {
            const loc = selectedLocation;
            const locAddress = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}`;
            const locWebsite = `www.${vendor.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
            const locLandline = `(${loc.phone.replace(/[^\d]/g, "").slice(1, 4)}) ${loc.phone.replace(/[^\d]/g, "").slice(4, 7)}-${loc.phone.replace(/[^\d]/g, "").slice(7, 11)}`;

            const LOC_TABS = [
              { id: "poc", label: "Point of Contacts", icon: Users },
              { id: "items", label: "Items", icon: Package },
              { id: "service_centers", label: "Service Center", icon: Wrench },
              { id: "carrier_shipping", label: "Carrier & Shipping", icon: Truck },
              { id: "pricing_rules", label: "Pricing Rules", icon: Tag },
              { id: "partner_communication", label: "Communication", icon: Mail },
              { id: "purchase_orders", label: "Purchase Orders", icon: ShoppingCart },
              { id: "quotes", label: "Quotes", icon: StickyNote },
              { id: "sales_orders", label: "Sales Orders", icon: FileText },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "attachments", label: "Attachments", icon: Paperclip },
              { id: "activity", label: "Recent Activity", icon: ChartColumn },
            ];

            const LOC_POC_DATA = [
              { id: "LP-1", name: "Issac Archer", dept: "Sales", phone: "(419) 548-1532", landline: "(736) 267-8659", ext: "123", email: "jimmie@example.com", bgColor: "hsl(var(--primary))" },
              { id: "LP-2", name: "Daniel Whitaker", dept: "Procurement", phone: "(372) 588-9852", landline: "(322) 683-5910", ext: "123", email: "malvar@example.com", bgColor: "hsl(var(--violet))" },
              { id: "LP-3", name: "Kimora Avila", dept: "Finance", phone: "(476) 828-2670", landline: "(822) 622-2842", ext: "123", email: "pthom@example.com", bgColor: "hsl(var(--success))" },
              { id: "LP-4", name: "Laney Zavala", dept: "Production", phone: "(996) 247-1680", landline: "(309) 645-6861", ext: "123", email: "specpr@example.com", bgColor: "hsl(var(--warning))" },
              { id: "LP-5", name: "Wyatt Bates", dept: "Sampling", phone: "(437) 402-2459", landline: "(778) 804-3466", ext: "123", email: "pthon@example.com", bgColor: "hsl(var(--primary))" },
              { id: "LP-6", name: "Kaleb Figueroa", dept: "Assembly", phone: "(456) 844-9096", landline: "(360) 476-4400", ext: "123", email: "kewley@example.com", bgColor: "hsl(var(--destructive))" },
              { id: "LP-7", name: "Kylie Norton", dept: "Pre-Production", phone: "(736) 267-8659", landline: "(989) 930-7596", ext: "123", email: "phyrux@example.com", bgColor: "hsl(var(--violet))" },
              { id: "LP-8", name: "Anya Blevins", dept: "Electrical", phone: "(219) 418-4910", landline: "(437) 402-2459", ext: "123", email: "scottz@example.com", bgColor: "hsl(var(--success))" },
              { id: "LP-9", name: "Jimena Morrow", dept: "Hardware", phone: "(590) 887-7526", landline: "(989) 930-7596", ext: "123", email: "sjava@example.com", bgColor: "hsl(var(--warning))" },
              { id: "LP-10", name: "Vivian Davila", dept: "Sub-Store", phone: "(632) 372-3424", landline: "(536) 554-1064", ext: "123", email: "hikoza@example.com", bgColor: "hsl(var(--primary))" },
            ];

            const LOC_ITEMS_DATA = [
              { partNo: "100219-42", desc: "Front bulkhead cabinet lower cov...", category: "Ram Pro Master 2500...", type: "Parts", typeBg: "#DBEAFE", typeColor: "hsl(var(--primary))", control: "Non-Serialized" },
              { partNo: "100219-51", desc: "Box walls inlay cabinet", category: "Hardware", type: "Parts", typeBg: "#DBEAFE", typeColor: "hsl(var(--primary))", control: "Non-Serialized" },
              { partNo: "100219-51-01", desc: "Box walls inlay cabinet with defib...", category: "Cabinet", type: "Equipment - Capital", typeBg: "#DBEAFE", typeColor: "hsl(var(--primary))", control: "Serialized" },
              { partNo: "100219-51-01RC", desc: "Box walls inlay cabinet with defib...", category: "Electronics", type: "Equipment - Non-Capital", typeBg: "#FEF3C7", typeColor: "hsl(var(--warning))", control: "Non-Serialized" },
              { partNo: "100219-51-02", desc: "Box walls inlay cabinet with refrig...", category: "Hardware", type: "Parts", typeBg: "#DBEAFE", typeColor: "hsl(var(--primary))", control: "Serialized" },
              { partNo: "100219-52", desc: "Box closeout top cap inlay cabinet", category: "Electronics", type: "Equipment - Non-Capital", typeBg: "#FEF3C7", typeColor: "hsl(var(--warning))", control: "Non-Serialized" },
              { partNo: "100120-70", desc: "Toyota long cut, emergency brak...", category: "Hardware", type: "Miscellaneous", typeBg: "#FEE2E2", typeColor: "hsl(var(--destructive))", control: "Non-Serialized" },
              { partNo: "100120-71", desc: "Toyota long cut, brake line bracket", category: "Electronics", type: "Equipment - Capital", typeBg: "#DBEAFE", typeColor: "hsl(var(--primary))", control: "Serialized" },
            ];

            const LOC_VENDOR_CARRIERS = [
              { id: "C-1", name: "FedEx Express", desc: "For fastest delivery in USA", isDefault: true, status: "active" as const, methods: [
                { id: "M-1", name: "FedEx Express (Air)", shortName: "Air", desc: "Premium air freight for time-critical shipments.", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
                { id: "M-2", name: "FedEx Ground", shortName: "Ground", desc: "Cost-effective road transportation for standard deliveries.", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.50" },
                { id: "M-3", name: "FedEx Freight (LTL)", shortName: "Freight", desc: "Less-than-truckload freight for larger shipments.", minDays: 5, maxDays: 7, isDefault: false, cost: "$85.00" },
              ]},
              { id: "C-2", name: "TCS (Tranzum Courier)", desc: "Regional courier with strong South Asian network coverage", isDefault: false, status: "active" as const, methods: [
                { id: "M-4", name: "Ocean Freight (Sea)", shortName: "Sea", desc: "Budget-friendly bulk shipping via sea routes.", minDays: 15, maxDays: 30, isDefault: true, cost: "$8.00" },
                { id: "M-5", name: "TCS Overnight", shortName: "Express", desc: "Next-day delivery within covered regions.", minDays: 1, maxDays: 1, isDefault: false, cost: "$22.00" },
              ]},
              { id: "C-4", name: "UPS (United Parcel Service)", desc: "Reliable domestic and international parcel service", isDefault: false, status: "inactive" as const, methods: [
                { id: "M-10", name: "UPS Ground", shortName: "Ground", desc: "Standard ground shipping across the continental US.", minDays: 3, maxDays: 5, isDefault: true, cost: "$11.00" },
              ]},
            ];
            const LOC_CUSTOMER_CARRIERS = [
              { id: "C-3", name: "DHL Express", desc: "International express shipping with global reach", isDefault: true, status: "active" as const, methods: [
                { id: "M-6", name: "DHL Express Worldwide", shortName: "Air", desc: "Door-to-door international express delivery.", minDays: 2, maxDays: 4, isDefault: true, cost: "$55.00" },
                { id: "M-7", name: "DHL Economy Select", shortName: "Ground", desc: "Affordable road freight for less urgent shipments.", minDays: 5, maxDays: 8, isDefault: false, cost: "$18.00" },
                { id: "M-8", name: "DHL Global Forwarding", shortName: "Sea", desc: "Custom logistics solutions for complex supply chains.", minDays: 7, maxDays: 14, isDefault: false, cost: "$120.00" },
                { id: "M-9", name: "DHL Same Day", shortName: "Same Day", desc: "Urgent same-day delivery within metro areas.", minDays: 0, maxDays: 1, isDefault: false, cost: "$95.00" },
              ]},
              { id: "C-5", name: "Aramex", desc: "International express delivery and logistics for Middle East & Global", isDefault: false, status: "active" as const, methods: [
                { id: "M-11", name: "Aramex Express", shortName: "Air", desc: "International express delivery.", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
                { id: "M-12", name: "Aramex Ground", shortName: "Ground", desc: "Domestic ground delivery.", minDays: 5, maxDays: 8, isDefault: false, cost: "$9.00" },
              ]},
              { id: "C-6", name: "Maersk Line", desc: "World-leading ocean container shipping for bulk orders", isDefault: false, status: "active" as const, methods: [
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
              <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
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
                        <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap shrink-0" style={{ fontWeight: 500, backgroundColor: loc.status === "active" ? "#ECFDF5" : "#FFFBEB", color: loc.status === "active" ? "#065F46" : "#92400E", borderColor: loc.status === "active" ? "#A7F3D0" : "#FDE68A" }}>
                          {loc.status === "active" ? "Active" : "Inactive"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                          <span className="text-[12px]"><FlagImage code={flagEmojiCode(getCountryFlag(loc.country))} /></span> {loc.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}, ${loc.country}`)}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-400 hover:text-primary hover:underline truncate transition-colors" style={{ fontWeight: 400 }}>{loc.address}, {loc.city}, {loc.state}</a>
                        {loc.phone && <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">· {loc.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Edit Button */}
                    <button onClick={() => toast.info("Edit coming soon")} className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 500 }}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    {/* Archive Button */}
                    <button onClick={() => toast.info("Archive coming soon")} className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-destructive hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer" style={{ fontWeight: 500 }}>
                      <Archive className="w-3.5 h-3.5 text-destructive" /> Archive
                    </button>
                    {/* More Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="hidden sm:flex w-8 h-8 rounded-lg border border-border bg-white items-center justify-center cursor-pointer transition-all duration-150 hover:bg-accent hover:border-blue-200 hover:text-primary active:scale-[0.96]">
                          <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6} className="z-[200] min-w-[190px] rounded-xl border border-border bg-white p-1 shadow-lg">
                        <DropdownMenuItem onClick={() => toast.info("Send Email coming soon")} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-primary" style={{ fontWeight: 500 }}>
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Purchase Order coming soon")} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-primary" style={{ fontWeight: 500 }}>
                          <ShoppingCart className="w-3.5 h-3.5 text-slate-400" /> Purchase Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Sales Order coming soon")} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-primary" style={{ fontWeight: 500 }}>
                          <FileText className="w-3.5 h-3.5 text-slate-400" /> Sales Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Create Quote coming soon")} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-primary" style={{ fontWeight: 500 }}>
                          <StickyNote className="w-3.5 h-3.5 text-slate-400" /> Create Quote
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-border" />
                        <DropdownMenuItem onClick={() => toast.info("Upload Attachment coming soon")} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-primary" style={{ fontWeight: 500 }}>
                          <Upload className="w-3.5 h-3.5 text-slate-400" /> Upload Attachment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 500 }}>
                      {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {isFullScreen ? "Exit full" : "Full view"}
                    </button>
                    <button onClick={handleCloseDetailModal} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Body: Split Layout ─── */}
              <div className="flex flex-row-reverse flex-1 overflow-hidden min-h-0">

                {/* ─── RIGHT PANEL (Sidebar) ─── */}
                <div className="w-[280px] border-l border-[#E8ECF1] flex flex-col bg-gradient-to-b from-slate-50 to-muted shrink-0 overflow-y-auto">
                  {/* ── Metric Cards ── */}
                  <div className="px-3 pt-3.5 pb-1">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Contacts", value: String(loc.contacts), icon: Users, color: "hsl(var(--primary))", bg: "linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)" },
                        { label: "Items", value: String(loc.items), icon: Package, color: "hsl(var(--violet))", bg: "linear-gradient(135deg, #F0EBFF 0%, #E9DFFF 100%)" },
                        { label: "Centers", value: String(loc.serviceCenters), icon: Wrench, color: "hsl(var(--warning))", bg: "linear-gradient(135deg, #FEF5E7 0%, #FDE8C8 100%)" },
                      ].map((s) => (
                        <div key={s.label} className="relative rounded-xl border border-white/80 bg-white p-2.5 flex flex-col items-center gap-1.5 transition-all duration-200 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer group/metric" style={{ boxShadow: "0 1px 3px -1px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover/metric:scale-110" style={{ background: s.bg }}>
                            <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                          </div>
                          <p className="text-[15px] text-slate-700 tabular-nums" style={{ fontWeight: 700 }}>{s.value}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>{s.label}</p>
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
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider" style={{ fontWeight: 600 }}>Contact Details</p>
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
                              <p className="text-[9px] text-[#B0BEC5] uppercase tracking-wide" style={{ fontWeight: 500 }}>{item.label}</p>
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
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider" style={{ fontWeight: 600 }}>Address</p>
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
                          View on map
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
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider" style={{ fontWeight: 600 }}>Primary Contact</p>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] shrink-0" style={{ background: "linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)", color: "hsl(var(--primary))", fontWeight: 700 }}>IA</div>
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
                            <DollarSign className="w-2.5 h-2.5" style={{ color: creditPctLoc > 80 ? "#EF4444" : creditPctLoc > 50 ? "hsl(var(--warning))" : "#10B981" }} />
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider" style={{ fontWeight: 600 }}>Credit</p>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ fontWeight: 600, color: creditPctLoc > 80 ? "hsl(var(--destructive))" : creditPctLoc > 50 ? "hsl(var(--warning))" : "hsl(var(--success))", backgroundColor: creditPctLoc > 80 ? "#FEE2E2" : creditPctLoc > 50 ? "#FEF3C7" : "#D1FAE5" }}>{creditPctLoc > 80 ? "Critical" : creditPctLoc > 50 ? "Warning" : "Healthy"}</span>
                      </div>
                      <div className="p-3">
                        <div className="flex items-baseline justify-between mb-3">
                          <div>
                            <p className="text-[17px] text-slate-700 tabular-nums" style={{ fontWeight: 700 }}>${creditUsed.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 400 }}>of ${creditLimit.toLocaleString()} limit</p>
                          </div>
                          <p className="text-[20px] tabular-nums" style={{ fontWeight: 800, color: creditPctLoc > 80 ? "#EF4444" : creditPctLoc > 50 ? "#F59E0B" : "#10B981" }}>{creditPctLoc}%</p>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: creditPctLoc > 80 ? "#FEE2E2" : creditPctLoc > 50 ? "#FEF3C7" : "#D1FAE5" }}>
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${creditPctLoc}%`, background: creditPctLoc > 80 ? "linear-gradient(90deg, #F87171, #EF4444)" : creditPctLoc > 50 ? "linear-gradient(90deg, #FBBF24, #F59E0B)" : "linear-gradient(90deg, #34D399, #10B981)" }} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Available</span>
                          <span className="text-[11px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>${(creditLimit - creditUsed).toLocaleString()}</span>
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
                            <p className="text-[9px] text-[#B0BEC5]" style={{ fontWeight: 500 }}>Created by</p>
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

                {/* ─── LEFT PANEL (Tabs) ─── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  {/* Tabs row */}
                  <div className="flex items-center border-b border-[#E8ECF1] shrink-0">
                    <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide px-2">
                      {LOC_TABS.map((t) => {
                        const active = locDetailTab === t.id;
                        const count = t.id === "poc" ? LOC_POC_DATA.length : t.id === "items" ? LOC_ITEMS_DATA.length : t.id === "carrier_shipping" ? LOC_CARRIER_DATA.length : t.id === "pricing_rules" ? LOC_PRICING_DATA.length : t.id === "purchase_orders" ? 5 : t.id === "quotes" ? 3 : t.id === "sales_orders" ? 4 : 0;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setLocDetailTab(t.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                              active ? "border-primary text-primary bg-white" : "border-transparent text-slate-400 hover:text-slate-500"
                            }`}
                            style={{ fontWeight: active ? 600 : 500 }}
                          >
                            {t.label}
                            {count > 0 && (
                              <span className={`text-[9px] rounded-full px-1.5 py-px min-w-[16px] text-center ${active ? "bg-primary/10 text-primary" : "bg-muted text-slate-400"}`} style={{ fontWeight: 700 }}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overview tab removed — POC is now default */}

                  {/* ── Point of Contacts tab ── */}
                  {/* ── Point of Contacts tab — embedded Contacts Directory scoped to this location ── */}
                  {locDetailTab === "poc" && (() => {
                    const locSelectedContacts = locContactDictionary.filter((c) => locSelectedPocIds.has(c.id));
                    return (
                      <div className="flex-1 flex flex-col overflow-hidden p-4">
                        <ContactsDirectoryPage
                          embedded
                          embeddedContacts={locSelectedContacts}
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
                                className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer"
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

                  {/* ── Items tab ── */}
                  {locDetailTab === "items" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <PartnerItemsTab vendor={vendor} />
                    </div>
                  )}

                  {/* ── Carrier & Shipping Methods tab ── */}
                  {locDetailTab === "carrier_shipping" && (() => {
                    const CARRIER_SUB_TABS: { key: CarrierSubTab; label: string }[] = [
                      { key: "vendor", label: "Vendor Carriers" },
                      { key: "customer", label: "Customer Carriers" },
                    ];

                    // Filter carriers based on sub-tab, search, and filter
                    const filteredCarriers = LOC_CARRIER_DATA.filter((c) => {
                      // Search filter
                      if (carrierSearch.trim()) {
                        const q = carrierSearch.toLowerCase();
                        if (!c.name.toLowerCase().includes(q) && !c.desc.toLowerCase().includes(q)) return false;
                      }
                      // Status/type filter
                      if (carrierFilter === "active") return c.status === "active";
                      if (carrierFilter === "default") return c.isDefault;
                      if (["Air", "Sea", "Ground", "Freight"].includes(carrierFilter)) {
                        return c.methods.some((m) => m.shortName === carrierFilter);
                      }
                      return true;
                    });

                    const CARRIER_FILTERS: { key: CarrierFilter; label: string; count: number }[] = [
                      { key: "all", label: "All Carriers", count: LOC_CARRIER_DATA.length },
                      { key: "active", label: "Active", count: LOC_CARRIER_DATA.filter((c) => c.status === "active").length },
                      { key: "default", label: "Primary Only", count: LOC_CARRIER_DATA.filter((c) => c.isDefault).length },
                      { key: "Air", label: "Air", count: LOC_CARRIER_DATA.filter((c) => c.methods.some((m) => m.shortName === "Air")).length },
                      { key: "Sea", label: "Sea", count: LOC_CARRIER_DATA.filter((c) => c.methods.some((m) => m.shortName === "Sea")).length },
                      { key: "Ground", label: "Ground", count: LOC_CARRIER_DATA.filter((c) => c.methods.some((m) => m.shortName === "Ground")).length },
                      { key: "Freight", label: "Freight", count: LOC_CARRIER_DATA.filter((c) => c.methods.some((m) => m.shortName === "Freight")).length },
                    ];

                    return (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Row 1: Sub-tabs + primary CTA (matches Items tab) */}
                      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border shrink-0">
                        <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
                        {CARRIER_SUB_TABS.map((t) => {
                          const isActive = carrierSubTab === t.key;
                          const tint = t.key === "vendor"
                            ? { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE", hoverBg: "#DBEAFE" }
                            : { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE", hoverBg: "#EDE9FE" };
                          return (
                            <button
                              key={t.key}
                              onClick={() => { setCarrierSubTab(t.key); setCarrierFilter("all"); setCarrierSearch(""); }}
                              className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                                isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                              }`}
                              style={{ fontWeight: isActive ? 600 : 500, color: isActive ? tint.color : undefined }}
                            >
                              <Truck className="w-3.5 h-3.5" style={{ color: isActive ? tint.color : "#94A3B8" }} />
                              {t.label}
                            </button>
                          );
                        })}
                        </div>

                        {/* Add Carrier CTA — tinted to match active sub-tab (matches Items tab) */}
                        {(() => {
                          const tint = carrierSubTab === "vendor"
                            ? { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE", hoverBg: "#DBEAFE" }
                            : { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE", hoverBg: "#EDE9FE" };
                          return (
                            <button
                              type="button"
                              onClick={() => setAddCarrierModalOpen(true)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                              style={{ fontWeight: 600, backgroundColor: tint.bg, borderColor: tint.border, color: tint.color }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{carrierSubTab === "vendor" ? "Add Vendor Carrier" : "Add Customer Carrier"}</span>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Toolbar — matching Items tab */}
                      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                            <Input
                              placeholder="Search carriers..."
                              value={carrierSearch}
                              onChange={(e) => setCarrierSearch(e.target.value)}
                              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                            />
                            {carrierSearch && (
                              <button
                                onClick={() => setCarrierSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toast.info("Advanced filters coming soon!")}
                            className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                            {filteredCarriers.length !== LOC_CARRIER_DATA.length ? (
                              <>
                                <span className="text-foreground">{filteredCarriers.length}</span>
                                <span className="text-muted-foreground/60"> of </span>
                                <span className="text-muted-foreground">{LOC_CARRIER_DATA.length}</span>
                                <span className="text-muted-foreground/70"> carriers</span>
                              </>
                            ) : (
                              <>
                                <span className="text-foreground">{LOC_CARRIER_DATA.length}</span>
                                <span className="text-muted-foreground/70"> carriers</span>
                              </>
                            )}
                          </span>

                        </div>
                      </div>

                      {/* Filter pills — matching Items tab */}
                      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                        {CARRIER_FILTERS.map((f) => {
                          const isActive = carrierFilter === f.key;
                          return (
                            <button
                              key={f.key}
                              onClick={() => setCarrierFilter(f.key)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                isActive
                                  ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                                  : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                              }`}
                              style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "hsl(var(--primary))" : undefined }}
                            >
                              {f.label}
                              <span
                                className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                                style={{ fontWeight: 600, color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                              >
                                {f.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border shrink-0" />

                      {/* Cards grid */}
                      <div className="flex-1 overflow-auto p-4">
                        {filteredCarriers.length === 0 ? (
                          <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                              <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                              <p className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>No carriers found</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredCarriers.map((carrier) => (
                              <CarrierShippingCard key={carrier.id} carrier={carrier} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer pagination */}
                      <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0 bg-muted/30">
                        <span className="text-[11px] text-muted-foreground">Records per page <select className="h-6 px-1.5 rounded border border-border text-[11px] cursor-pointer outline-none ml-1 bg-background"><option>20</option><option>50</option></select></span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground" style={{ fontWeight: 600 }}>1</span>
                        </div>
                      </div>

                      {/* ── Add New Carrier Modal ── */}
                      <Dialog open={addCarrierModalOpen} onOpenChange={(open) => { setAddCarrierModalOpen(open); if (!open) resetAddCarrierModal(); }}>
                        <DialogContent
                          className="!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[720px] !max-h-[100dvh] sm:!max-h-[82vh] rounded-none sm:!rounded-2xl flex flex-col p-0 gap-0 border-0 sm:border"
                          hideCloseButton
                          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
                        >
                          <DialogTitle className="sr-only">Add Carrier</DialogTitle>
                          <DialogDescription className="sr-only">Select from existing carriers or create a new one</DialogDescription>

                          {/* ─── Header ─── */}
                          <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Add Carrier</h2>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>Browse and select carriers to associate with this location.</p>
                              </div>
                              <button onClick={() => { setAddCarrierModalOpen(false); resetAddCarrierModal(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Search + Create New */}
                          <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 shrink-0">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                              <Input
                                placeholder="Search carriers by name or type..."
                                value={addCarrierSearch}
                                onChange={(e) => setAddCarrierSearch(e.target.value)}
                                className="pl-9 pr-8 h-9 text-sm bg-background border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                              />
                              {addCarrierSearch && (
                                <button onClick={() => setAddCarrierSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <a
                              href="/vendors?createPartner=carrier"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer shrink-0"
                              style={{ fontWeight: 600 }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Create New Carrier
                            </a>
                          </div>

                          {/* Carrier cards grid */}
                          <div className="flex-1 overflow-auto px-5 pb-3">
                            {(() => {
                              const MASTER_CARRIERS = [
                                { id: "MC-1", name: "FedEx Express", type: "Air & Ground", rating: 4.8, avgDelivery: "2-3 days", regions: ["North America", "Europe"], status: "Active", shipments: 1245, desc: "Premium express shipping for time-critical deliveries", methods: [
                                  { id: "M-1", name: "FedEx Express (Air)", shortName: "Air", desc: "Premium air freight", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
                                  { id: "M-2", name: "FedEx Ground", shortName: "Ground", desc: "Standard ground delivery", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.00" },
                                ] },
                                { id: "MC-2", name: "DHL International", type: "International", rating: 4.6, avgDelivery: "3-5 days", regions: ["Global"], status: "Active", shipments: 892, desc: "Global logistics and international shipping solutions", methods: [
                                  { id: "M-3", name: "DHL Express", shortName: "Air", desc: "International express", minDays: 3, maxDays: 5, isDefault: true, cost: "$38.00" },
                                  { id: "M-4", name: "DHL Ocean", shortName: "Sea", desc: "Ocean freight", minDays: 14, maxDays: 21, isDefault: false, cost: "$8.50" },
                                ] },
                                { id: "MC-3", name: "UPS Freight", type: "Ground & Freight", rating: 4.5, avgDelivery: "3-7 days", regions: ["North America"], status: "Active", shipments: 634, desc: "Reliable ground freight and LTL services", methods: [
                                  { id: "M-5", name: "UPS Ground", shortName: "Ground", desc: "Ground shipping", minDays: 3, maxDays: 7, isDefault: true, cost: "$15.00" },
                                  { id: "M-6", name: "UPS Freight LTL", shortName: "Freight", desc: "Less-than-truckload freight", minDays: 5, maxDays: 10, isDefault: false, cost: "$22.00" },
                                ] },
                                { id: "MC-4", name: "Maersk Line", type: "Ocean Freight", rating: 4.3, avgDelivery: "14-21 days", regions: ["Global"], status: "Active", shipments: 156, desc: "World-leading ocean container shipping", methods: [
                                  { id: "M-7", name: "Maersk Ocean", shortName: "Sea", desc: "Container shipping", minDays: 14, maxDays: 21, isDefault: true, cost: "$6.50" },
                                ] },
                                { id: "MC-5", name: "XPO Logistics", type: "LTL & Freight", rating: 4.1, avgDelivery: "5-10 days", regions: ["North America", "Europe"], status: "Under Review", shipments: 423, desc: "Freight brokerage and logistics management", methods: [
                                  { id: "M-8", name: "XPO LTL", shortName: "Freight", desc: "LTL freight", minDays: 5, maxDays: 10, isDefault: true, cost: "$18.00" },
                                ] },
                                { id: "MC-6", name: "Swift Transport", type: "Ground", rating: 3.9, avgDelivery: "4-6 days", regions: ["North America"], status: "Inactive", shipments: 0, desc: "Regional ground delivery services", methods: [
                                  { id: "M-9", name: "Swift Ground", shortName: "Ground", desc: "Ground delivery", minDays: 4, maxDays: 6, isDefault: true, cost: "$10.00" },
                                ] },
                                { id: "MC-7", name: "TCS (Tranzum Courier)", type: "Regional", rating: 4.2, avgDelivery: "1-3 days", regions: ["South Asia"], status: "Active", shipments: 312, desc: "Regional express courier for South Asian markets", methods: [
                                  { id: "M-10", name: "TCS Express", shortName: "Air", desc: "Express courier", minDays: 1, maxDays: 3, isDefault: true, cost: "$5.00" },
                                ] },
                                { id: "MC-8", name: "Aramex", type: "International", rating: 4.4, avgDelivery: "3-7 days", regions: ["Middle East", "Global"], status: "Active", shipments: 578, desc: "International express delivery and logistics", methods: [
                                  { id: "M-11", name: "Aramex Express", shortName: "Air", desc: "International express", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
                                  { id: "M-12", name: "Aramex Ground", shortName: "Ground", desc: "Domestic ground", minDays: 5, maxDays: 8, isDefault: false, cost: "$9.00" },
                                ] },
                              ];
                              const q = addCarrierSearch.toLowerCase();
                              const filteredMaster = MASTER_CARRIERS.filter(c =>
                                c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
                              );
                              const alreadyAdded = new Set(LOC_CARRIER_DATA.map(c => c.name));

                              return filteredMaster.length === 0 ? (
                                <div className="flex items-center justify-center py-16">
                                  <div className="text-center">
                                    <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>No carriers match your search</p>
                                    <a
                                      href="/vendors?createPartner=carrier"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline mt-2 inline-block"
                                    >
                                      Create a new carrier instead
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {filteredMaster.map((carrier) => {
                                    const isAdded = alreadyAdded.has(carrier.name);
                                    const isSelected = addCarrierSelectedIds.has(carrier.id);
                                    const isPrimary = addCarrierPrimaryId === carrier.id;
                                    const activeMethodIdx = addCarrierMethodIdx[carrier.id] ?? Math.max(0, carrier.methods.findIndex(m => m.isDefault));
                                    const activeMethod = carrier.methods[activeMethodIdx] || carrier.methods[0];
                                    return (
                                      <div
                                        key={carrier.id}
                                        onClick={() => {
                                          if (isAdded) return;
                                          setAddCarrierSelectedIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(carrier.id)) { next.delete(carrier.id); if (addCarrierPrimaryId === carrier.id) setAddCarrierPrimaryId(null); }
                                            else { next.add(carrier.id); if (!addCarrierPrimaryId) setAddCarrierPrimaryId(carrier.id); }
                                            return next;
                                          });
                                        }}
                                        className={`bg-white border rounded-xl cursor-pointer group/cc transition-all duration-200 flex flex-col relative ${
                                          isSelected || isAdded
                                            ? "border-primary bg-[#F8FAFF] shadow-[0_0_0_3px_rgba(10,119,255,0.06)]"
                                            : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
                                        }`}
                                      >
                                        <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
                                          {/* Row 1: Logo + Name/Desc left, Checkbox + Star + Status right */}
                                          <div className="flex items-start gap-2.5 mb-2 shrink-0">
                                            {(() => {
                                              const logo = getCarrierLogo(carrier.name);
                                              return (
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ backgroundColor: logo ? "#fff" : "hsl(var(--muted))" }}>
                                                  {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-1" /> : <span className="text-[9px] text-muted-foreground" style={{ fontWeight: 700 }}>{getCarrierInitials(carrier.name)}</span>}
                                                </div>
                                              );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{carrier.name}</p>
                                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5" style={{ fontWeight: 400 }}>{carrier.desc}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                              {/* Status */}
                                              <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap" style={{ fontWeight: 500, backgroundColor: carrier.status === "Active" ? "#ECFDF5" : carrier.status === "Under Review" ? "#FFFBEB" : "hsl(var(--muted))", color: carrier.status === "Active" ? "#065F46" : carrier.status === "Under Review" ? "#92400E" : "#64748B", borderColor: carrier.status === "Active" ? "#A7F3D0" : carrier.status === "Under Review" ? "#FDE68A" : "hsl(var(--border))" }}>
                                                {carrier.status}
                                              </span>
                                              {/* Primary star */}
                                              <div
                                                onClick={(e) => { e.stopPropagation(); if (isSelected || isAdded) setAddCarrierPrimaryId(carrier.id); }}
                                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                                  isPrimary ? "text-primary" : (isSelected || isAdded) ? "text-slate-400 hover:text-primary" : "text-border"
                                                }`}
                                                title={isPrimary ? "Primary carrier" : "Set as primary"}
                                              >
                                                <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-primary" : ""}`} />
                                              </div>
                                              {/* Checkbox */}
                                              <div className={`w-[18px] h-[18px] rounded flex items-center justify-center border-[1.5px] transition-all duration-150 ${isSelected || isAdded ? "border-primary bg-primary shadow-[0_0_0_2px_rgba(10,119,255,0.12)]" : "border-slate-300 bg-white"}`}>
                                                {(isSelected || isAdded) && <Check className="w-3 h-3 text-white" />}
                                              </div>
                                            </div>
                                          </div>
                                          {/* Row 2: Price + delivery */}
                                          <div className="flex items-baseline justify-between shrink-0">
                                            <div className="flex items-baseline gap-2">
                                              <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>{activeMethod.cost}</span>
                                              <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>/ shipment</span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                                              <Clock className="w-3 h-3" /> {activeMethod.minDays}–{activeMethod.maxDays} days
                                            </span>
                                          </div>
                                          {/* Row 3: Method chips — clickable */}
                                          <div className="pt-2 shrink-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {carrier.methods.map((m, mIdx) => {
                                                const isMethodActive = mIdx === activeMethodIdx;
                                                return (
                                                  <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setAddCarrierMethodIdx(prev => ({ ...prev, [carrier.id]: mIdx })); }}
                                                    className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[10px] transition-all cursor-pointer ${isMethodActive ? "shadow-sm" : "hover:bg-border"}`}
                                                    style={{ fontWeight: isMethodActive ? 600 : 500, backgroundColor: isMethodActive ? "#EFF6FF" : "hsl(var(--muted))", color: isMethodActive ? "hsl(var(--primary))" : "#64748B", boxShadow: isMethodActive ? "0 0 0 1px #0A77FF30" : undefined }}
                                                  >
                                                    {m.shortName}{m.isDefault && <Star className="w-2.5 h-2.5 text-primary fill-primary" />}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                          {/* Row 4: Detail strip */}
                                          <div className="mt-auto pt-2 shrink-0">
                                            <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
                                              <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                                <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                                                <span style={{ fontWeight: 500 }}>{carrier.rating}</span>
                                                <span className="text-slate-300">·</span>
                                                <span>{carrier.shipments} shipments</span>
                                              </div>
                                              <span className="shrink-0 ml-2 text-slate-400">{carrier.regions.slice(0, 2).join(", ")}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-t border-[#EEF2F6] shrink-0 bg-white sm:rounded-b-2xl">
                            <button onClick={() => { setAddCarrierModalOpen(false); resetAddCarrierModal(); }} className="h-9 px-5 rounded-lg border border-border text-slate-500 hover:text-foreground hover:border-slate-300 text-[13px] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Cancel</button>
                            <div className="flex items-center gap-2">
                              {addCarrierSelectedIds.size > 0 && (
                                <span className="text-xs text-muted-foreground">{addCarrierSelectedIds.size} selected</span>
                              )}
                              <button
                                onClick={() => {
                                  if (addCarrierSelectedIds.size === 0) { toast.error("Please select at least one carrier"); return; }
                                  toast.success(`${addCarrierSelectedIds.size} carrier${addCarrierSelectedIds.size > 1 ? "s" : ""} added successfully`);
                                  setAddCarrierModalOpen(false);
                                  resetAddCarrierModal();
                                }}
                                disabled={addCarrierSelectedIds.size === 0}
                                className="h-9 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ fontWeight: 600 }}
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Selected
                              </button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    );
                  })()}

                  {/* ── Pricing Rules tab ── */}
                  {locDetailTab === "pricing_rules" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Row 1: Vendor/Customer pill toggle + primary CTAs (matches Items tab) */}
                      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border shrink-0">
                        <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
                          {([
                            { key: "vendor" as const,   label: "Vendor Pricing",   icon: Package,       color: "#1E40AF" },
                            { key: "customer" as const, label: "Customer Pricing", icon: ShoppingCart,  color: "#5B21B6" },
                          ]).map((t) => {
                            const isActive = locPricingSubTab === t.key;
                            return (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => setLocPricingSubTab(t.key)}
                                className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                                  isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
                              >
                                <t.icon className="w-3.5 h-3.5" style={{ color: isActive ? t.color : "#94A3B8" }} />
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const tint = locPricingSubTab === "vendor"
                              ? { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE", hoverBg: "#DBEAFE" }
                              : { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE", hoverBg: "#EDE9FE" };
                            return (
                              <button
                                type="button"
                                onClick={() => toast.info("Add pricing rule coming soon")}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                                style={{ fontWeight: 600, backgroundColor: tint.bg, borderColor: tint.border, color: tint.color }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Add Pricing Rule</span>
                              </button>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={() => toast.info("Templates coming soon")}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Templates</span>
                          </button>
                        </div>
                      </div>

                      {/* Toolbar — Search + Filters */}
                      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="relative flex-1 max-w-[220px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input type="text" placeholder="Search pricing rules..." className="w-full pl-8 h-9 text-[13px] bg-white border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors" />
                          </div>
                          <button className="h-9 px-3 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 cursor-pointer transition-colors inline-flex items-center gap-1.5 shrink-0" style={{ fontWeight: 500 }}>
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                          </button>
                        </div>
                      </div>

                      {/* Filter chips */}
                      <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
                        {["Me mode", "Discount", "Premium Plus Rules", "Active", "Inactive"].map((chip) => (
                          <span key={chip} className="text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors bg-slate-50 text-slate-500 border border-border hover:bg-muted whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
                            {chip}
                          </span>
                        ))}
                      </div>
                      <div className="h-px bg-[#E8ECF1] shrink-0" />
                      <div className="flex-1 overflow-auto p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                          {LOC_PRICING_DATA.map((rule) => (
                            <div
                              key={rule.id}
                              onClick={() => toast.info("View details coming soon")}
                              className="bg-white border border-border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#BFDBFE";
                                e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "hsl(var(--border))";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            >
                              <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                                {/* Row 1: Type pill */}
                                <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                                  <span className="inline-flex items-stretch rounded-full overflow-hidden border border-[#D1FAE5] shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] text-[#047857] bg-emerald-50" style={{ fontWeight: 600 }}>
                                      <Tag className="w-3 h-3" /> Discount
                                    </span>
                                    <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l border-[#D1FAE5]" style={{ fontWeight: 500 }}>
                                      Value
                                    </span>
                                  </span>
                                  <span className="px-1.5 py-[2px] rounded-md text-[10px] border border-border bg-white text-slate-500" style={{ fontWeight: 500 }}>Custom</span>
                                </div>

                                {/* Row 2: Name */}
                                <p className="text-[13px] text-slate-700 truncate shrink-0 mb-1" style={{ fontWeight: 600 }}>{rule.name}</p>

                                {/* Row 3: Description */}
                                <div className="h-[32px] shrink-0 mb-2">
                                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{rule.desc}</p>
                                </div>

                                {/* Row 4: Hero value */}
                                <div className="flex items-baseline gap-2 shrink-0">
                                  <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
                                    {rule.discount}
                                  </span>
                                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>off</span>
                                </div>

                                {/* Row 5: Range detail */}
                                <div className="mt-auto pt-2 shrink-0">
                                  <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
                                    <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                      <span style={{ fontWeight: 400 }}>{rule.minQty}</span>
                                      <span className="text-slate-300">–</span>
                                      <span style={{ fontWeight: 400 }}>{rule.maxQty}</span>
                                    </div>
                                    <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>{rule.discount}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-muted shrink-0">
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-white text-muted-foreground" style={{ fontWeight: 500 }}>Expire In ({rule.expiry})</span>
                                <span
                                  className="ml-auto px-2 py-[2px] rounded-full text-[10px] border"
                                  style={{ fontWeight: 500, color: "hsl(var(--success))", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                                >
                                  Active
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2 border-t border-[#E8ECF1] shrink-0 bg-[#FAFBFC]">
                        <span className="text-[11px] text-slate-400">Records per page <select className="h-6 px-1.5 rounded border border-border text-[11px] cursor-pointer outline-none ml-1"><option>20</option><option>50</option></select></span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-primary text-white" style={{ fontWeight: 600 }}>1</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Service Center (Coming Soon with animation) ── */}
                  {locDetailTab === "service_centers" && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-[#FEF5E7] to-[#FDE8C8] border border-amber-200/30 animate-pulse">
                          <Wrench className="w-7 h-7 text-warning" />
                        </div>
                        <p className="text-[15px] text-slate-700" style={{ fontWeight: 600 }}>Service Center</p>
                        <p className="text-[12px] text-slate-400 mt-1.5 max-w-[260px] mx-auto leading-relaxed">Manage service centers associated with this location. This feature is currently under development.</p>
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEF5E7] border border-amber-200/40 text-[11px] text-warning" style={{ fontWeight: 600 }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                          Coming Soon
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Partner Communication (Coming Soon with animation) ── */}
                  {locDetailTab === "partner_communication" && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-[#EBF3FF] to-blue-100 border border-blue-200/30 animate-pulse">
                          <Mail className="w-7 h-7 text-primary" />
                        </div>
                        <p className="text-[15px] text-slate-700" style={{ fontWeight: 600 }}>Partner Communication</p>
                        <p className="text-[12px] text-slate-400 mt-1.5 max-w-[260px] mx-auto leading-relaxed">Track and manage communications with this partner location. This feature is currently under development.</p>
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-blue-200/40 text-[11px] text-primary" style={{ fontWeight: 600 }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          Coming Soon
                        </div>
                      </div>
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

                  {/* ── Generic placeholder for tabs that are still WIP (e.g. Notes) ── */}
                  {!["poc", "items", "carrier_shipping", "pricing_rules", "service_centers", "partner_communication", "purchase_orders", "quotes", "sales_orders", "attachments", "activity"].includes(locDetailTab) && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 bg-accent border border-primary/15">
                          {(() => { const T = LOC_TABS.find((x) => x.id === locDetailTab); return T ? <T.icon className="w-5 h-5 text-primary" /> : null; })()}
                        </div>
                        <p className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{LOC_TABS.find((x) => x.id === locDetailTab)?.label || locDetailTab}</p>
                        <p className="text-[11px] text-slate-300 mt-1" style={{ fontWeight: 400 }}>Coming soon</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
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

      {/* Default Carriers */}
      <ContentCard title="Primary Carriers" icon={Truck}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Primary Carrier (Vendor)</p>
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.defaultCarrierVendor || "—"}</p>
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Primary Carrier (Customer)</p>
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{vendor.defaultCarrierCustomer || "—"}</p>
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
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-primary" style={{ fontWeight: 600 }}>Primary</span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5">{cs.description}</p>
                      </div>
                      <span className="text-[12px] text-slate-400 shrink-0 ml-3" style={{ fontWeight: 500 }}>
                        {cs.minDays}–{cs.maxDays} days
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-primary" style={{ fontWeight: 600 }}>Primary</span>
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

// Read-only wrapper for PaymentMethodCard on details page
function PaymentMethodCardView({ entry }: { entry: import("../components/vendors/partnerConstants").PaymentMethodEntry }) {
  return <PaymentMethodCardBase entry={entry} onEdit={() => {}} onDelete={() => {}} onSetPrimary={() => {}} />;
}

// ----- PAYMENT METHODS TAB -----
function PaymentMethodsTab({ cfg, PAYMENT_TYPE_ICONS }: { cfg?: VendorConfigData; PAYMENT_TYPE_ICONS: Record<string, React.ElementType> }) {
  const hasPaymentMethods = cfg?.paymentMethods && cfg.paymentMethods.length > 0;

  // Convert SavedPaymentMethod → PaymentMethodEntry shape for the shared card
  const asEntries = React.useMemo(() => {
    if (!hasPaymentMethods) return [];
    return cfg!.paymentMethods!.map((pm): import("../components/vendors/partnerConstants").PaymentMethodEntry => ({
      id: pm.id,
      type: pm.type as import("../components/vendors/partnerConstants").PaymentMethodType,
      expanded: false,
      isSaved: pm.isSaved,
      isPrimary: false,
      nickname: pm.typeLabel,
      bankName: pm.bankName || "",
      accountTitle: "",
      accountNumber: pm.accountNumber || "",
      routingNumber: pm.routingNumber || "",
      swiftCode: pm.wireRoutingNumber || "",
      accountType: "checking",
      cardholderName: "",
      cardNumber: pm.cardNumber || "",
      expiryDate: pm.expiryDate || "",
      cvv: "",
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
  }, [cfg, hasPaymentMethods]);

  return (
    <div className="space-y-4">
      <ContentCard
        title="Payment Methods"
        icon={CreditCard}
        count={hasPaymentMethods ? cfg!.paymentMethods!.length : undefined}
      >
        {hasPaymentMethods ? (
          <div className="@container/pmgrid w-full">
          <div className="grid grid-cols-1 @[400px]/pmgrid:grid-cols-2 @[750px]/pmgrid:grid-cols-3 gap-3">
            {asEntries.map((entry) => (
              <PaymentMethodCardView
                key={entry.id}
                entry={entry}
              />
            ))}
          </div>
          </div>
        ) : (
          <EmptyState icon={CreditCard} title="No payment methods configured" description="Payment methods will appear here once added during partner creation or editing." />
        )}
      </ContentCard>
    </div>
  );
}

// ----- PAYMENT TERMS TAB -----
function PaymentTermsTab({
  vendor,
  cfg,
  currencyMode = "base",
}: {
  vendor: Vendor;
  cfg?: VendorConfigData;
  /** Which currency to render fixed amounts in — inherits the partner-details toggle. */
  currencyMode?: "base" | "partner";
}) {
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
              {vendor.creditLimit > 0 ? `$${vendor.creditLimit.toLocaleString()}` : "Not set"}
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
                    backgroundColor: getCreditUtilizationPct(vendor) > 80 ? "hsl(var(--destructive))" : getCreditUtilizationPct(vendor) > 50 ? "hsl(var(--warning))" : "hsl(var(--success))",
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
              badgeColor: cfg!.paymentTermConfig!.type === "Pre" ? "hsl(var(--violet))" : cfg!.paymentTermConfig!.type === "Split" ? "hsl(var(--warning))" : "hsl(var(--primary))",
              trigger: cfg!.paymentTermConfig!.trigger,
              description: cfg!.paymentTermConfig!.description,
              vendorsApplied: 4,
              duration: cfg!.paymentTermConfig!.duration,
              discountPercent: cfg!.paymentTermConfig!.discountPercent,
              discountPeriod: cfg!.paymentTermConfig!.discountPeriod,
              discountMode: cfg!.paymentTermConfig!.discountMode,
              discountAmountBase: cfg!.paymentTermConfig!.discountAmountBase,
              discountAmountPartner: cfg!.paymentTermConfig!.discountAmountPartner,
              discountPartnerCurrency: cfg!.paymentTermConfig!.discountPartnerCurrency,
              prepaymentMode: cfg!.paymentTermConfig!.prepaymentMode,
              prepaymentPercent: cfg!.paymentTermConfig!.prepaymentPercent,
              prepaymentAmountBase: cfg!.paymentTermConfig!.prepaymentAmountBase,
              prepaymentAmountPartner: cfg!.paymentTermConfig!.prepaymentAmountPartner,
              prepaymentPartnerCurrency: cfg!.paymentTermConfig!.prepaymentPartnerCurrency,
              prepaymentTrigger: cfg!.paymentTermConfig!.prepaymentTrigger,
              splitInstallments: cfg!.paymentTermConfig!.splitInstallments,
            }}
            readOnly
            currencyMode={currencyMode}
            partnerCurrency={vendor.defaultTransactionCurrency}
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
                    style={{ fontWeight: 700, backgroundColor: rule.type === "discount" ? "hsl(var(--success))" : "hsl(var(--warning))" }}
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
                    <p className="text-[11px] text-slate-400 mb-1.5" style={{ fontWeight: 600 }}>TIERS</p>
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
    "hsl(var(--primary))": { bg: "#EBF3FF", text: "hsl(var(--primary))" },
    "hsl(var(--violet))": { bg: "#F0EBFF", text: "hsl(var(--violet))" },
    "hsl(var(--success))": { bg: "#E8FAF3", text: "hsl(var(--success))" },
    "hsl(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
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
    const AVATAR_COLORS = ["hsl(var(--primary))", "hsl(var(--violet))", "hsl(var(--success))", "hsl(var(--warning))"];
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
    <div className="space-y-4">
      {/* Full-width POC container — matches Partner Locations layout */}
      <ContactsDirectoryPage
        embedded
        embeddedContacts={selectedContacts}
        embeddedToolbarRight={
          <>
            <button
              type="button"
              onClick={handleOpenSelect}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer text-foreground"
              style={{ fontWeight: 500 }}
            >
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm hidden md:inline">Contact Directory</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create New Contact</span>
              <span className="sm:hidden">New</span>
            </button>
          </>
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
  const activities = [
    { action: "Partner profile last updated", date: vendor.updatedAt, icon: Pencil, color: "hsl(var(--primary))" },
    { action: "Payment configuration saved", date: vendor.updatedAt, icon: CreditCard, color: "hsl(var(--violet))" },
    { action: "Shipping preferences configured", date: vendor.createdAt, icon: Truck, color: "hsl(var(--success))" },
    { action: "Partner created", date: vendor.createdAt, icon: Calendar, color: "hsl(var(--warning))" },
  ];

  return (
    <div className="space-y-4">
      <ContentCard title="Activity Timeline" icon={Activity}>
        <div className="space-y-0">
          {activities.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-start gap-2.5 relative pb-4 last:pb-0">
                {/* Timeline line */}
                {index < activities.length - 1 && (
                  <div className="absolute left-[13px] top-[30px] w-px h-[calc(100%-20px)] bg-border" />
                )}
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${item.color}10` }}
                >
                  <Icon className="w-3 h-3" style={{ color: item.color }} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{item.action}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(item.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-2.5 mt-2.5 border-t border-muted text-center">
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
