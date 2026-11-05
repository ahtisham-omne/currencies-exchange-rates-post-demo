import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appHref } from "@/embedding";
import { FlagImage, flagEmojiCode } from "../components/currency/FlagImage";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Users,
  Trash2,
  GripVertical,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  ShoppingCart,
  Star,
  Globe,
  ToggleLeft,
  ToggleRight,
  Search,
  Plus,
  Building2,
  Pencil,
  Archive,
  ArchiveRestore,
  CircleSlash,
  CircleCheck,
  Copy,
  MessageSquare,
  Activity,
  FileText,
  Settings2,
  Link2,
  Tag,
  Receipt,
  CreditCard,
  DollarSign,
  Wallet,
  MapPin,
  Ship,
  Truck,
  Calendar as CalendarIcon,
  ExternalLink,
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  RefreshCw,
  Check,
  Info,
  Unlink2,
  Eye,
  ShieldAlert,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../components/ui/popover";
import { useVendors } from "../context/VendorContext";
import { usePartnerGroups } from "../context/PartnerGroupsContext";
import { CreatePartnerGroupModal } from "../components/vendors/CreatePartnerGroupModal";
import { splitVendorOrders } from "../components/vendors/KpiInsightsPanel";
import { InsightsRangeMenu, InsightsRefresh, InsightsResetButton, type InsightsRange } from "../components/vendors/InsightsControls";
import { GroupBulkApplyModal, type GroupBulkApplyChange } from "../components/vendors/GroupBulkApplyModal";
import { ArchivePartnerGroupModal } from "../components/vendors/ArchivePartnerGroupModal";
import { GroupStatusChangeDialog } from "../components/vendors/GroupStatusChangeDialog";
import { diffConfigData } from "../components/vendors/configDiff";
import type { Vendor } from "../data/vendors";
import { buildPeriodBuckets, bucketWobble } from "../data/chartBuckets";
import { PARTNER_GROUPS } from "../components/vendors/partnerConstants";
import {
  TYPE_PALETTE,
  SetupTab,
  ActivityFeed,
  AddPartnersToGroupModal,
  hashString,
  type ActivityFeedItemType,
  type PartnerGroupTemplateSummary,
} from "../components/vendors/PartnerGroupDetailModal";
import { AttachmentsTab, type AttachmentFile } from "../components/vendors/AttachmentsTab";
import { enrichGroup } from "./PartnerGroupsPage";
import { VendorsListPage } from "./VendorsListPage";
import { BASE_CURRENCY } from "../currency/currencies";
import { formatCompactMoney, formatMoney } from "../currency/money";
import { partnerCurrencyOf, toBaseNow } from "../currency/partnerCurrency";

/* ─── Tabs (Dashboard first to match Partner Detail) */
const PG_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "configuration", label: "Configuration" },
  { id: "partners", label: "Linked Partners" },
  { id: "communications", label: "Communications" },
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "activity", label: "Recent Activity" },
] as const;
type PgTabId = (typeof PG_TABS)[number]["id"];

/* ─── Dummy data (same shapes the modal used) */
const DUMMY_NOTES = [
  { id: "n1", author: "Sarah Johnson", date: "Mar 28, 2026", text: "Approved pricing rule updates for all partners in this group." },
  { id: "n2", author: "Michael Torres", date: "Mar 22, 2026", text: "Added Net 30 as the default payment term for onboarding." },
];
const DUMMY_ACTIVITY: { id: string; type: ActivityFeedItemType; user: string; verb: string; target?: string; date: string }[] = [
  { id: "act1", type: "apply",  user: "Sarah Johnson",  verb: "applied pricing rule",   target: "Bulk Fastener Discount", date: "Mar 28, 2026 · 2:45 PM" },
  { id: "act2", type: "edit",   user: "Michael Torres", verb: "updated payment term to", target: "Net 30",                  date: "Mar 25, 2026 · 11:30 AM" },
  { id: "act3", type: "link",   user: "Emily Chen",     verb: "linked partner",           target: "Toyota International",    date: "Mar 20, 2026 · 9:15 AM" },
  { id: "act4", type: "create", user: "Omnesoft",       verb: "created group",             date: "Feb 14, 2026 · 4:00 PM" },
];
const DUMMY_ATTACHMENTS: AttachmentFile[] = [
  { id: "a1", name: "Group_Configuration_v2.pdf", size: "198 KB", type: "pdf", date: "2026-03-26T09:00:00Z", uploadedBy: "Sarah Johnson" },
  { id: "a2", name: "Onboarding_Checklist.xlsx", size: "74 KB", type: "xlsx", date: "2026-03-20T11:30:00Z", uploadedBy: "Michael Torres" },
];

/* ─── Page-level error boundary so a runtime throw renders a fallback
   surface instead of blanking the whole route. The page is full of
   IIFEs and dynamic memos, and a single bad shape on a transient
   render shouldn't take the entire detail page down. */
class PageBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error("[PartnerGroupDetailsPage] uncaught render error", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-6">
          <div className="max-w-[420px] text-center">
            <p className="text-[14px] text-slate-700" style={{ fontWeight: 600 }}>Something went wrong on this page</p>
            <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
              We hit a render error while showing this Partner Group. The
              data is safe — refresh the page and the surface will rebuild
              from the live store.
            </p>
            {this.state.error.message && (
              <pre className="mt-3 text-[11px] text-left text-slate-500 bg-white border border-border rounded-lg p-3 overflow-auto max-h-[160px]">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Page ─── */
export function PartnerGroupDetailsPage() {
  return (
    <DndProvider backend={HTML5Backend}>
      <PageBoundary>
        <PartnerGroupDetailsPageInner />
      </PageBoundary>
    </DndProvider>
  );
}

function PartnerGroupDetailsPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vendors } = useVendors();
  const [activeTab, setActiveTab] = useState<PgTabId>("dashboard");
  const [dateRange, setDateRange] = useState<InsightsRange>("last_30");
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  // Fullscreen toggle — expands the inner container to full viewport width.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Pending state-change confirmation for the header Archive / Disable
  // buttons. Pioneer keeps both states (active / inactive / archived);
  // mirror that here and surface the action through a confirmation
  // dialog instead of a coming-soon toast so the chrome demonstrates
  // the canonical state-change flow.
  const [pendingStateChange, setPendingStateChange] = useState<"archive" | "disable" | "unarchive" | "enable" | null>(null);
  // Archive-with-reassignment flow — opens when the group being archived
  // is the primary for one or more partners (they must be reassigned to
  // another group first). Groups with no primary partners use the simple
  // confirm above instead.
  const [archiveFlowOpen, setArchiveFlowOpen] = useState(false);
  // Reassign-first confirmation gate shown before the reassignment modal.
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false);
  // Status pill is a popover trigger — clicking it lets the user
  // switch between Active / Inactive (Archive lives in the Actions
  // dropdown). Mirrors VendorDetailsPage so the chrome reads the same
  // across detail surfaces.
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  // Header "Edit Group" → opens the create modal pre-filled with this group's
  // data. On save, we route through the Yes/No push prompt below so the
  // configuration-edit logic stays consistent with the spec.
  const [editModalOpen, setEditModalOpen] = useState(false);
  // Pending edit awaiting user's "push to associated partners?" decision.
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, unknown> | null>(null);

  // ─── Sticky/morphing header — IntersectionObserver pattern (matches Partner Detail) ───
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const root = scrollRef.current;
    const el = sentinelRef.current;
    if (!root || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Resolve + enrich the group same way the listing does so type/status/etc. stay
  // consistent across surfaces. Reads from the live store so freshly-created
  // and freshly-edited groups resolve here too — falls back to the seed
  // constant for ids unknown to the store (deep links, legacy data, etc.).
  const { groups: storeGroups, updateGroup } = usePartnerGroups();
  const storeGroup = useMemo(() => storeGroups.find((g) => g.id === id), [storeGroups, id]);
  const group = useMemo<PartnerGroupTemplateSummary | null>(() => {
    if (!id) return null;
    const base = storeGroup ?? PARTNER_GROUPS.find((g) => g.id === id);
    if (!base) return null;
    const e = enrichGroup(base);
    return {
      id: e.id, name: e.name, description: e.description,
      country: e.country, countryFlag: e.countryFlag,
      partnerCount: e.partnerCount, templateType: e.templateType,
      status: e.status, createdOn: e.createdOn, code: e.code,
      hasPricingRules: e.hasPricingRules, pricingRuleCount: e.pricingRuleCount,
      hasPaymentTerms: e.hasPaymentTerms, paymentTermLabel: e.paymentTermLabel,
      hasCreditConfig: e.hasCreditConfig,
    };
  }, [id, storeGroup]);

  // Linked partners — same deterministic slice.
  const linkedPartnersAll = useMemo<Vendor[]>(() => {
    if (!group) return [];
    const h = hashString(group.id);
    const copy = [...vendors];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(vendors.length, group.partnerCount));
  }, [vendors, group]);

  // Locally-unlinked partner ids — clicking "Unlink from group" on a row
  // in the Linked Partners table doesn't mutate the upstream store; it
  // just hides the row in this surface session. Real persistence lives
  // upstream once the unlink mutation is wired to the partner-groups
  // store.
  const [unlinkedIds, setUnlinkedIds] = useState<Set<string>>(new Set());
  const linkedPartners = useMemo<Vendor[]>(
    () => linkedPartnersAll.filter((v) => !unlinkedIds.has(v.id)),
    [linkedPartnersAll, unlinkedIds],
  );

  // Add Partner modal (group-scoped picker) + Unlink confirmation state.
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<{ id: string; name: string } | null>(null);
  // Set-as-Primary confirmation state — opens the canonical
  // "inherit vs keep" modal from the Linked Partners row menu.
  // (There is no unset-as-primary flow from the partner group.)
  const [pendingSetPrimary, setPendingSetPrimary] = useState<{ id: string; name: string } | null>(null);

  // Primary partners — set of partner ids for whom THIS group is the
  // primary. Seeded with the same deterministic hash the old PartnersTab
  // used so the visual mark stays stable across renders; tracked as
  // state so "Set as primary" / toast-undo can mutate it. Hooks up to
  // the partner-groups store once primaryGroupId lands on Vendor.
  const [primaryIds, setPrimaryIds] = useState<Set<string>>(() => {
    if (!group) return new Set();
    const s = new Set<string>();
    for (const v of linkedPartnersAll) {
      if (hashString(v.id + group.id) % 3 === 0) s.add(v.id);
    }
    return s;
  });
  // Keep the seed in sync if the linked list changes (e.g. Add Partner)
  // — adds any new partner that the deterministic rule says is primary,
  // doesn't touch existing entries (so user-set primaries persist).
  useEffect(() => {
    if (!group) return;
    setPrimaryIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const v of linkedPartnersAll) {
        if (!next.has(v.id) && hashString(v.id + group.id) % 3 === 0) {
          next.add(v.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [linkedPartnersAll, group]);

  // Partners that use THIS group as their primary — these are the ones the
  // archive flow must reassign before the group can be archived.
  const primaryPartners = useMemo<Vendor[]>(
    () => linkedPartners.filter((v) => primaryIds.has(v.id)),
    [linkedPartners, primaryIds],
  );

  // Change-list for the GroupBulkApplyModal — compute in a useMemo so
  // the reference is stable across renders, and wrap in try/catch so a
  // missing field on a malformed payload can never blank the page.
  const editChange = useMemo<GroupBulkApplyChange | null>(() => {
    if (!pendingEditPayload) return null;
    try {
      const items: GroupBulkApplyChange["changes"] = [];
      const cfgDiff = diffConfigData(storeGroup?.configData, pendingEditPayload);
      items.push(...cfgDiff);
      if (storeGroup) {
        const newName = ((pendingEditPayload.groupName as string | undefined) ?? "").trim();
        if (newName && newName !== storeGroup.name) {
          items.push({ field: "Group Name", previous: storeGroup.name, next: newName });
        }
        const newDesc = (pendingEditPayload.description as string | undefined) ?? "";
        if (newDesc !== (storeGroup.description ?? "")) {
          items.push({ field: "Description", previous: storeGroup.description || "—", next: newDesc || "—" });
        }
        const newStatus = (pendingEditPayload.status as string | undefined) ?? storeGroup.status ?? "Active";
        if (storeGroup.status && newStatus !== storeGroup.status) {
          items.push({ field: "Status", previous: storeGroup.status, next: newStatus });
        }
        const newMembers = (pendingEditPayload.memberIds as string[] | undefined) ?? [];
        // Seed groups carry a memberCount without memberIds, so compare
        // against the partners this page actually shows as linked.
        const oldCount = linkedPartnersAll.length;
        if (newMembers.length !== oldCount) {
          items.push({
            field: "Linked Partners",
            previous: `${oldCount} partner${oldCount === 1 ? "" : "s"}`,
            next: `${newMembers.length} partner${newMembers.length === 1 ? "" : "s"}`,
          });
        }
      }
      return {
        settingLabel: "Group Configuration",
        changes: items.length > 0 ? items : undefined,
      };
    } catch (err) {
      // Never blank the page on a diff error — fall back to the
      // bare prompt without the changes list.
      console.error("[Edit Group] failed to compute change diff", err);
      return { settingLabel: "Group Configuration" };
    }
  }, [pendingEditPayload, storeGroup, linkedPartnersAll]);

  if (!group) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center">
        <div className="text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] text-slate-700" style={{ fontWeight: 600 }}>Partner group not found</p>
          <p className="text-[12px] text-slate-400 mt-1">This group may have been archived or deleted.</p>
          <button
            onClick={() => navigate("/partners/groups")}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Partner Groups
          </button>
        </div>
      </div>
    );
  }

  const typePalette = TYPE_PALETTE[group.templateType];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top nav bar — breadcrumbs + Search + user profile. Mirrors Partner Detail. */}
      <div data-page-topbar className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0 z-30">
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
            onClick={() => navigate("/partners/groups")}
            className="hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Partner Groups
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground" style={{ fontWeight: 500 }}>{group.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              placeholder="Search..."
              className="pl-9 w-[260px] h-8 rounded-md bg-white border border-border/60 text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
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

      {/* Scrollable content area — sentinel + sticky header live inside this. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        {/* IntersectionObserver sentinel — flips isScrolled when it scrolls out. */}
        <div ref={sentinelRef} className="h-px shrink-0" />

        {/* Sticky/morphing header — shrinks on scroll like Partner Detail. */}
        {(() => null)()}
        {/* Archived flag drives the header tint, the status pill, and
            which primary CTA is shown (Edit vs. Unarchive). */}
        <div data-page-topbar className="sticky top-0 z-20 bg-slate-50">
          <div
            style={{ paddingTop: isScrolled ? 8 : 12, paddingBottom: 4, transition: "padding-top 250ms ease" }}
            className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}
          >
            {/* Status-tinted vertical gradient header — same hues as the
                status pill (Active → emerald, Inactive → amber,
                Archived → rose). Tint sits at the bottom edge and
                fades to white moving upward, matching the reference. */}
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}
              style={
                group.status === "Archived"
                  ? { background: "linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FECACA" }
                  : group.status === "Inactive"
                    ? { background: "linear-gradient(to top, #FFFBEB 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FDE68A" }
                    : { background: "#FFFFFF", borderColor: "rgb(var(--border))" }
              }
            >
          <div
            className="flex items-center justify-between gap-4 transition-all duration-250 ease-in-out"
            style={{ padding: isScrolled ? "6px 16px" : "12px 20px" }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => navigate("/partners/groups")}
                className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] transition-all duration-250"
                style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
              >
                <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
              </button>
              <div
                className="rounded-xl flex items-center justify-center shrink-0 transition-all duration-250"
                style={{
                  width: isScrolled ? 32 : 44,
                  height: isScrolled ? 32 : 44,
                  backgroundColor: typePalette.bg,
                  border: `1px solid ${typePalette.border}`,
                }}
              >
                {group.countryFlag ? (
                  <span className="leading-none transition-all duration-250" style={{ fontSize: isScrolled ? 14 : 18 }}><FlagImage code={flagEmojiCode(group.countryFlag)} /></span>
                ) : (
                  <Users className="transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20, color: typePalette.fg }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-1.5">
                  <h1
                    className="text-foreground truncate transition-all duration-250"
                    style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? "18px" : "22px" }}
                  >{group.name}</h1>
                  {(group.templateType === "both" ? ["vendor", "customer"] : [group.templateType]).map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md border"
                      style={{
                        fontWeight: 600,
                        backgroundColor: scope === "vendor" ? "#EBF3FF" : "#F5F3FF",
                        color: scope === "vendor" ? "#0548A3" : "#5B21B6",
                        borderColor: scope === "vendor" ? "#A8D2FF" : "#DDD6FE",
                      }}
                    >
                      {scope === "vendor" ? "Vendor" : "Customer"}
                    </span>
                  ))}
                  {/* Status pill — clickable trigger that opens an
                      Active/Inactive switcher. Routes through the same
                      lifecycle confirmation modal as the Actions menu
                      so all status changes flow through one place. */}
                  <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={`inline-flex items-center rounded-full border cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border ${isScrolled ? "px-1.5 py-px text-[10px] gap-0.5" : "px-2 py-0.5 text-[11px] gap-1"}`}
                        style={{
                          fontWeight: 500,
                          backgroundColor: group.status === "Active" ? "#ECFDF5" : group.status === "Archived" ? "#FEF2F2" : "#FFFBEB",
                          color: group.status === "Active" ? "#065F46" : group.status === "Archived" ? "#991B1B" : "#92400E",
                          borderColor: group.status === "Active" ? "#A7F3D0" : group.status === "Archived" ? "#FECACA" : "#FDE68A",
                        }}
                      >
                        {group.status}
                        <ChevronDown className={isScrolled ? "w-2.5 h-2.5" : "w-3 h-3"} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300]" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <div className="space-y-1">
                        {(["Active", "Inactive"] as const).map((s) => {
                          const isCurrent = s === group.status;
                          const sStyle = s === "Active"
                            ? { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" }
                            : { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" };
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                if (!isCurrent) {
                                  setPendingStateChange(s === "Inactive" ? "disable" : "enable");
                                  setStatusDropdownOpen(false);
                                }
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}
                            >
                              <span
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                                style={{ fontWeight: 500, backgroundColor: sStyle.bg, color: sStyle.color, borderColor: sStyle.border }}
                              >
                                {s}
                              </span>
                              {isCurrent && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {/* Region — shows the country flag emoji + name (Partner-detail "Americas 🇺🇸" style) */}
                  {group.country && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-50 text-slate-600 border border-border" style={{ fontWeight: 500 }}>
                      {group.countryFlag && <span className="text-[12px] leading-none"><FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /></span>}
                      {group.country}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-50 text-slate-600 border border-border" style={{ fontWeight: 500 }}>
                    <Users className="w-3 h-3" /> {group.partnerCount} {group.partnerCount === 1 ? "partner" : "partners"}
                  </span>
                </div>
                {group.description && !isScrolled && (
                  <p className="text-[12px] text-slate-500 mt-1 line-clamp-1 transition-opacity duration-200">{group.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Fullscreen toggle — sits right before Duplicate, mirroring Partner Detail */}
              <button
                onClick={() => setIsFullscreen((v) => !v)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              {/* Actions dropdown + Edit Group — always visible.
                  Header CTAs stay the same in every state so the chrome
                  reads consistent; only the lifecycle items inside the
                  dropdown swap based on group.status:
                  - Active   → Mark as Inactive (amber) + Archive (red)
                  - Inactive → Mark as Active (green) + Archive (red)
                  - Archived → Unarchive (green) only. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Actions <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[210px]">
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(appHref()); toast.success("Link copied"); }}>
                    <Link2 className="w-4 h-4 mr-2" /> Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {group.status === "Active" && (
                    <DropdownMenuItem
                      onClick={() => setPendingStateChange("disable")}
                      className="focus:bg-amber-50"
                      style={{ color: "#B45309" }}
                    >
                      <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} /> Mark as Inactive
                    </DropdownMenuItem>
                  )}
                  {group.status === "Inactive" && (
                    <DropdownMenuItem
                      onClick={() => setPendingStateChange("enable")}
                      className="focus:bg-emerald-50"
                      style={{ color: "#059669" }}
                    >
                      <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Mark as Active
                    </DropdownMenuItem>
                  )}
                  {group.status === "Archived" ? (
                    <DropdownMenuItem
                      onClick={() => setPendingStateChange("unarchive")}
                      className="focus:bg-emerald-50"
                      style={{ color: "#059669" }}
                    >
                      <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Unarchive
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => {
                        // Primary partners must be reassigned first → open the
                        // confirmation gate (then the reassignment flow).
                        // Otherwise the simple archive confirm.
                        if (primaryPartners.length > 0) setReassignConfirmOpen(true);
                        else setPendingStateChange("archive");
                      }}
                      className="text-destructive focus:text-destructive focus:bg-red-50"
                    >
                      <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Group
              </button>
            </div>
          </div>

          {/* Tab bar — always full size; only padding shrinks slightly when scrolled */}
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-5">
            {PG_TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`text-[13px] border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                  style={{
                    padding: isScrolled ? "8px 14px" : "10px 14px",
                    fontSize: isScrolled ? 12 : 13,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
            </div>
          </div>
        </div>

      {/* Tab content */}
      <div className={`mx-auto px-3 pt-2 pb-3 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
        {activeTab === "dashboard" && (
          <DashboardTab
            group={group}
            linkedPartners={linkedPartners}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            customFrom={insightsCustom.from}
            customTo={insightsCustom.to}
            onCustomChange={(from, to) => setInsightsCustom({ from, to })}
          />
        )}
        {activeTab !== "dashboard" && (
          <div className="space-y-4">
            {activeTab === "configuration" && <SetupTab group={group} linkedPartners={linkedPartners} />}
            {activeTab === "partners" && (
              /* Use the canonical Partners listing data table (same
                  component as /partners) in embedded mode so the
                  Linked Partners surface stays 1:1 with the listing
                  page. Data is scoped to this group's linkedPartners,
                  columns are trimmed to the set Eli signed off on, and
                  the row actions / primary CTA are swapped to the
                  group-scoped flows (Add Partner, Unlink from group). */
              <VendorsListPage
                embedded
                embeddedVendors={linkedPartners}
                embeddedDefaultDensity="condensed"
                embeddedHideArchivedFilter
                embeddedDefaultColumnVisibility={{
                  partner_name: true,
                  partner_type: true,
                  vendor_sub_types: true,
                  customer_sub_types: true,
                  num_items: true,
                  partner_locations: true,
                  global_contacts: true,
                  partner_group: false,
                  net_profit: false,
                  credit_limit: false,
                  credit_utilization: false,
                  services: false,
                  carrier_vendor: false,
                  carrier_customer: false,
                  country: true,
                  website: false,
                  email: false,
                  last_updated_by: false,
                  last_updated_on: false,
                  created_by: false,
                  created_on: false,
                  status: true,
                }}
                embeddedPrimaryAction={{
                  label: "Add Partner",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setAddPartnerOpen(true),
                }}
                embeddedPrimaryPartnerIds={primaryIds}
                embeddedRowActions={(vendor) => (
                  <>
                    <DropdownMenuItem onClick={() => navigate(`/vendors/${vendor.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Open Partner
                    </DropdownMenuItem>
                    {/* Set as Primary — blue treatment mirrors the canonical
                        "Set as Primary" row action used on the Contacts
                        Directory + Location POC menus so all primary-related
                        rows read the same across surfaces. There is no
                        "Unset as primary" action from the partner group. */}
                    {!primaryIds.has(vendor.id) && (
                      <DropdownMenuItem
                        className="focus:bg-blue-50"
                        style={{ color: "#094D9F" }}
                        onClick={() => setPendingSetPrimary({ id: vendor.id, name: vendor.displayName || vendor.companyName })}
                      >
                        <Star className="w-4 h-4 mr-2 fill-blue-700 text-blue-700" />
                        Set This Group as Primary
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                embeddedRowActionsLifecycle={(vendor) => (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setPendingUnlink({ id: vendor.id, name: vendor.displayName || vendor.companyName })}
                    className="focus:bg-red-50"
                  >
                    <Unlink2 className="w-4 h-4 mr-2 text-destructive" />
                    Unlink from Group
                  </DropdownMenuItem>
                )}
              />
            )}
            {/* Communications / Notes / Recent Activity all sit behind
                Coming Soon placeholders for now — the partner-level
                surfaces will land first (real channels, real notes, real
                audit log) and the group-level versions inherit those
                primitives. Uses the same animated PlaceholderTab pattern
                as the partner detail page so the look is consistent. */}
            {activeTab === "communications" && (
              <PlaceholderTab
                label="Communications"
                description={`Internal channel for ${group.name}, discuss template changes, partner exceptions, and ownership hand-offs. Lands once the partner-level Communication channel ships; the group thread will reuse the same primitive.`}
                icon={MessageSquare}
              />
            )}
            {activeTab === "notes" && (
              <PlaceholderTab
                label="Notes"
                description={`Pinned notes about ${group.name}, assumptions, edge cases, why specific defaults exist. Available once the partner-level Notes surface ships; the group view reuses the same model.`}
                icon={FileText}
              />
            )}
            {activeTab === "attachments" && (
              <AttachmentsTab files={DUMMY_ATTACHMENTS} embedded={false} initialDensity="card" />
            )}
            {activeTab === "activity" && (
              <PlaceholderTab
                label="Recent Activity"
                description={`Audit trail for ${group.name}, every template edit, member link/unlink, and configuration push. Surfaces once the group-level event log is wired to the audit pipeline.`}
                icon={Activity}
              />
            )}
          </div>
        )}
      </div>
      </div>

      {/* Pioneer-mirror state-change confirmation. Both Disable and
          Archive are reversible (Pioneer keeps the data either way) so
          the prompt names the side-effects without scaring the user
          off — copy adapts to which action was triggered. Lives at the
          page-inner scope (not inside DashboardTab) so the state is
          accessible from the header buttons regardless of active tab. */}
      <AlertDialog open={!!pendingStateChange} onOpenChange={(open) => { if (!open) setPendingStateChange(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setPendingStateChange(null)}
        >
          {(() => {
            const isUnarchive = pendingStateChange === "unarchive";
            const isArchive = pendingStateChange === "archive";
            const isEnable = pendingStateChange === "enable";
            const isDisable = pendingStateChange === "disable";
            const greenTone = { wash: "#ECFDF5", washSoft: "rgba(236,253,245,0.3)", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#065F46", chipBg: "#ECFDF5", chipFg: "#065F46", primaryBg: "#10B981" };
            const redTone = { wash: "#FEF2F2", washSoft: "rgba(254,242,242,0.3)", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "rgb(var(--destructive))", chipBg: "#FEF2F2", chipFg: "#991B1B", primaryBg: "rgb(var(--destructive))" };
            const amberTone = { wash: "#FFFBEB", washSoft: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", chipBg: "#FFFBEB", chipFg: "#92400E", primaryBg: "#F59E0B" };
            const tone = isUnarchive || isEnable
              ? greenTone
              : isArchive
                ? redTone
                : amberTone;
            const Icon = isUnarchive
              ? ArchiveRestore
              : isEnable
                ? CircleCheck
                : isArchive
                  ? Archive
                  : CircleSlash;
            const chipLabel = isUnarchive
              ? "Unarchive"
              : isEnable
                ? "Mark as Active"
                : isArchive
                  ? "Archive"
                  : "Mark as Inactive";
            const title = isUnarchive
              ? `Unarchive ${group.name}?`
              : isEnable
                ? `Mark ${group.name} as Active?`
                : isArchive
                  ? `Archive ${group.name}?`
                  : `Mark ${group.name} as Inactive?`;
            const desc = isUnarchive
              ? <>The group goes back to Active and reappears in default listings and pickers. Linked partners keep their existing settings, unarchiving doesn't reapply the template.</>
              : isEnable
                ? <>The group goes back to Active. It reappears in pickers and resumes seeding new partners. Linked partners keep their existing settings, re-activating doesn't reapply the template.</>
                : isArchive
                  ? <>This group is removed from active lists and stops seeding new partners. Existing linked partners keep their settings, and the group can be restored from the archive at any time. Existing transactions are unaffected.</>
                  : <>This group stops appearing in pickers and stops seeding new partners. Existing linked partners keep their settings exactly as-is. Re-activate from the header CTA when you're ready.</>;
            const primaryLabel = isUnarchive
              ? "Unarchive Group"
              : isEnable
                ? "Mark as Active"
                : isArchive
                  ? "Archive Group"
                  : "Mark as Inactive";
            const cancelLabel = isUnarchive ? "Keep Archived" : isEnable ? "Keep Inactive" : "Keep Active";
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${tone.wash} 0%, ${tone.washSoft} 70%, transparent 100%)` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: tone.glow }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: tone.iconBg }}>
                    <Icon className="w-8 h-8" style={{ color: tone.iconColor }} />
                  </div>
                  <span
                    className="mt-4 px-3 py-1 rounded-full text-[11px]"
                    style={{ fontWeight: 600, backgroundColor: tone.chipBg, color: tone.chipFg, letterSpacing: "0.05em" }}
                  >
                    {chipLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                      {title}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {desc}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        // Persist the new status so the listing's pills
                        // pick it up and the header swaps treatments
                        // immediately.
                        const nextStatus: "Active" | "Inactive" | "Archived" = isUnarchive || isEnable
                          ? "Active"
                          : isArchive
                            ? "Archived"
                            : "Inactive";
                        if (id) updateGroup(id, { ...(storeGroup as unknown as Record<string, unknown> ?? {}), status: nextStatus });
                        toast.success(
                          isUnarchive
                            ? `${group.name} unarchived.`
                            : isEnable
                              ? `${group.name} marked as Active.`
                              : isArchive
                                ? `${group.name} archived.`
                                : `${group.name} marked as Inactive.`,
                        );
                        setPendingStateChange(null);
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: tone.primaryBg, color: "#fff" }}
                    >
                      {primaryLabel}
                    </button>
                    <button
                      onClick={() => setPendingStateChange(null)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      {cancelLabel}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign-first gate — confirmation modal shown before the
          reassignment flow when the group is primary for some partners. */}
      <GroupStatusChangeDialog
        open={reassignConfirmOpen}
        onOpenChange={setReassignConfirmOpen}
        groupName={group.name}
        mode="archive"
        reassignCount={primaryPartners.length}
        onConfirm={() => {
          setReassignConfirmOpen(false);
          setArchiveFlowOpen(true);
        }}
      />

      {/* Archive with reassignment — primary partners are reassigned to
          other groups before the group is archived, with an optional
          push of the new group's configuration to those partners. */}
      <ArchivePartnerGroupModal
        open={archiveFlowOpen}
        onOpenChange={setArchiveFlowOpen}
        groupId={group.id}
        groupName={group.name}
        primaryPartners={primaryPartners}
        onArchived={({ assignments, push }) => {
          const reassignedIds = Object.keys(assignments);
          // Reassigned partners no longer mark this group as primary.
          setPrimaryIds((prev) => {
            const next = new Set(prev);
            reassignedIds.forEach((pid) => next.delete(pid));
            return next;
          });
          if (id) updateGroup(id, { ...(storeGroup as unknown as Record<string, unknown> ?? {}), status: "Archived" });
          toast.success(
            `${group.name} archived. ${reassignedIds.length} ${reassignedIds.length === 1 ? "partner" : "partners"} reassigned${push ? " and updated to their new group's configuration." : "; their configurations were left unchanged."}`,
          );
        }}
      />

      {/* Edit Group — opens the same creation modal in edit mode with all
          fields pre-filled. On save, we hold the payload and prompt the
          user with the Yes / No push question (single binary choice per
          the Partner Group Configuration – Edit & Push Logic spec). */}
      <CreatePartnerGroupModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        editMode
        editVendor={storeGroup as unknown as Record<string, unknown> | null}
        onPartnerCreated={(data) => setPendingEditPayload(data)}
      />

      <GroupBulkApplyModal
        open={!!pendingEditPayload}
        onOpenChange={(v) => { if (!v) setPendingEditPayload(null); }}
        groupName={group.name}
        linkedPartners={linkedPartners}
        change={editChange}
        // ERP-10410 — Customer Rules travel with the push whenever the
        // saved scope includes customers (Customer Rules is the required
        // customer profile). Also covers a vendor-only group switched to
        // customers in the same save.
        includesCustomerRules={((pendingEditPayload?.scope as string[] | undefined) ?? []).includes("customer")}
        onSaveTemplateOnly={() => {
          if (pendingEditPayload && id) updateGroup(id, pendingEditPayload);
          setPendingEditPayload(null);
          toast.success(`${group.name} saved. Existing partners are not affected; new partners going forward inherit the updated configuration.`);
        }}
        onSaveAndApply={(applyToIds, opts) => {
          if (pendingEditPayload && id) updateGroup(id, pendingEditPayload);
          setPendingEditPayload(null);
          const vendorOnlyNote = opts
            ? opts.makeVendorOnlyCustomers
              ? " Vendor-only partners are now customers too."
              : " Vendor-only partners stay vendor-only."
            : "";
          toast.success(`${group.name} saved and pushed to ${applyToIds.length} associated ${applyToIds.length === 1 ? "partner" : "partners"} for future transactions.${vendorOnlyNote}`);
        }}
      />

      {/* Add Partner — same step-2 picker the creation flow uses,
          reusing the existing modal so search/scope/primary-toggle
          behavior stays identical across surfaces. */}
      <AddPartnersToGroupModal
        open={addPartnerOpen}
        onOpenChange={setAddPartnerOpen}
        group={group}
        existingPartners={linkedPartners}
        onAddPartners={({ linkedCount, primaryCount }) => {
          toast.success(
            `${linkedCount} partner${linkedCount === 1 ? "" : "s"} added to ${group.name}${primaryCount > 0 ? ` · ${primaryCount} marked primary` : ""}.`,
          );
          setAddPartnerOpen(false);
        }}
      />

      {/* Unlink-from-group confirmation. Same destructive-tone treatment
          the rest of the page uses (archive / mark inactive), with an
          Unlink2 icon to clarify the action. The mutation is local-only
          for now (unlinkedIds set) — wires to the partner-groups store
          when that mutation ships. */}
      <AlertDialog open={!!pendingUnlink} onOpenChange={(open) => { if (!open) setPendingUnlink(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setPendingUnlink(null)}
        >
          {(() => {
            // A partner must always keep a primary group. If this group is the
            // partner's primary, unlinking is blocked until they set another
            // group as primary — surface a popup + inline banner explaining
            // why, with a path to fix it (open the partner to reassign).
            const isPrimaryUnlink = !!pendingUnlink && primaryIds.has(pendingUnlink.id);
            const tone = isPrimaryUnlink
              ? { wash: "#FFFBEB", washSoft: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", chipBg: "#FFFBEB", chipFg: "#92400E" }
              : { wash: "#FEF2F2", washSoft: "rgba(254,242,242,0.3)", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "rgb(var(--destructive))", chipBg: "#FEF2F2", chipFg: "#991B1B" };
            return (
              <>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${tone.wash} 0%, ${tone.washSoft} 70%, transparent 100%)` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: tone.glow }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: tone.iconBg }}>
              {isPrimaryUnlink ? <ShieldAlert className="w-8 h-8" style={{ color: tone.iconColor }} /> : <Unlink2 className="w-8 h-8" style={{ color: tone.iconColor }} />}
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: tone.chipBg, color: tone.chipFg, letterSpacing: "0.05em" }}
            >
              {isPrimaryUnlink ? "Primary Group" : "Unlink"}
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {isPrimaryUnlink
                  ? `Can't unlink ${pendingUnlink?.name ?? "this partner"} yet`
                  : `Unlink ${pendingUnlink?.name ?? "this partner"} from ${group.name}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              {isPrimaryUnlink
                ? <>{group.name} is the primary group for {pendingUnlink?.name}. A partner must always have a primary group, so set a different group as their primary first, then you can unlink them from {group.name}.</>
                : <>Only the group association is removed. The partner's existing payment terms, pricing rules, credit settings, and transaction history all stay exactly as-is, they just stop inheriting future template updates from {group.name}.</>}
            </AlertDialogDescription>

            {isPrimaryUnlink && (
              <div className="w-full mt-4 flex items-start gap-2 px-3 py-2 rounded-lg border text-left" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
                <ShieldAlert className="w-4 h-4 shrink-0 mt-px" style={{ color: "#B45309" }} />
                <p className="text-[12px]" style={{ fontWeight: 500, color: "#92400E" }}>
                  Reassign this partner's primary group, then return here to unlink.
                </p>
              </div>
            )}

            <div className="w-full mt-7 flex flex-col gap-2.5">
              {isPrimaryUnlink ? (
                <button
                  onClick={() => {
                    const id = pendingUnlink?.id;
                    setPendingUnlink(null);
                    if (id) navigate(`/vendors/${id}`);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 inline-flex items-center justify-center gap-1.5"
                  style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))", color: "#fff" }}
                >
                  <Eye className="w-4 h-4" /> Open partner to reassign primary
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (pendingUnlink) {
                      setUnlinkedIds((prev) => {
                        const next = new Set(prev);
                        next.add(pendingUnlink.id);
                        return next;
                      });
                      toast.success(`${pendingUnlink.name} unlinked from ${group.name}.`);
                    }
                    setPendingUnlink(null);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                >
                  Unlink Partner
                </button>
              )}
              <button
                onClick={() => setPendingUnlink(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Linked
              </button>
            </div>
          </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Set as Primary — canonical two-option "inherit vs keep" prompt.
          Mirrors the AddPartnersToGroupModal's per-row Set-as-Primary
          modal so the surface (header glow, badge, options) reads as
          the same primitive at every touchpoint. */}
      <AlertDialog open={!!pendingSetPrimary} onOpenChange={(o) => { if (!o) setPendingSetPrimary(null); }}>
        <AlertDialogContent
          className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setPendingSetPrimary(null)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
              <Star className="w-8 h-8 fill-current" style={{ color: "rgb(var(--primary))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}
            >
              Set as Primary
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {`Make ${group.name} the primary group for ${pendingSetPrimary?.name ?? "this partner"}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingSetPrimary?.name}</span> may already have payment terms, pricing rules, or other settings configured. Pick how setting primary should handle their values.
            </AlertDialogDescription>
            <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
              {/* Option 1 — Inherit from this group's template */}
              <button
                type="button"
                onClick={() => {
                  if (pendingSetPrimary) {
                    setPrimaryIds((prev) => { const next = new Set(prev); next.add(pendingSetPrimary.id); return next; });
                    toast.success(`${group.name} is now the primary group for ${pendingSetPrimary.name}. Templated values applied.`);
                  }
                  setPendingSetPrimary(null);
                }}
                className="w-full text-left rounded-xl border border-blue-100 bg-accent hover:bg-blue-100 transition-colors cursor-pointer p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                    <Star className="w-[18px] h-[18px] fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Set as Primary and Inherit Values from This Group</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-700 truncate">
                          Templated defaults adopt{" "}
                          <span className="text-foreground" style={{ fontWeight: 600 }}>{group.name}</span>'s template.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-700 truncate">
                          Going forward, new transactions resolve from the group's template.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
              {/* Option 2 — Keep existing partner values */}
              <button
                type="button"
                onClick={() => {
                  if (pendingSetPrimary) {
                    setPrimaryIds((prev) => { const next = new Set(prev); next.add(pendingSetPrimary.id); return next; });
                    toast.success(`${group.name} is now the primary group for ${pendingSetPrimary.name}. Existing values kept.`);
                  }
                  setPendingSetPrimary(null);
                }}
                className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                    <Check className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Set as Primary but Keep Existing Values</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600 truncate">
                          {pendingSetPrimary?.name ?? "Partner"} is marked primary; existing settings stay untouched.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600 truncate">
                          Example: a partner on Net 60 keeps Net 60 even if the group default is Net 30.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setPendingSetPrimary(null)}
                className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

/* ─────────────────────── Dashboard tab ─────────────────────── */
type KpiKey = "total" | "active" | "vendors" | "customers" | "purchaseOrders" | "salesOrders" | "spend" | "outstanding" | "avgOrder" | "regions";
// Dashboard widgets — first four mirror the Partner Detail board
// (PO/SO cost + activity, blue=PO / emerald=SO); the remaining are
// group-specific composition / configuration views (Type, Status, and
// per-scope Vendor / Customer Configuration cards — split per
// stakeholder ask so each scope reads separately, scope-gated to the
// group's templateType). Stale entries in `pg-widget-order` (e.g. the
// retired single "coverage" key) are healed back to `ALL_WIDGETS` by
// the order hook below.
type WidgetKey = "po_spend_trend" | "so_spend_trend" | "po_order_activity" | "so_order_activity" | "type" | "status" | "vendor_coverage" | "customer_coverage";
const ALL_KPIS: KpiKey[] = ["total", "active", "vendors", "customers", "purchaseOrders", "salesOrders", "spend", "outstanding", "avgOrder", "regions"];
const ALL_WIDGETS: WidgetKey[] = ["po_spend_trend", "so_spend_trend", "po_order_activity", "so_order_activity", "type", "status", "vendor_coverage", "customer_coverage"];
const DEFAULT_WIDGET_SIZES: Record<WidgetKey, "sm" | "md" | "lg"> = {
  po_spend_trend: "md", so_spend_trend: "md", po_order_activity: "md", so_order_activity: "md",
  type: "sm", status: "sm", vendor_coverage: "md", customer_coverage: "md",
};

function DashboardTab({
  group,
  linkedPartners,
  dateRange,
  onDateRangeChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  group: PartnerGroupTemplateSummary;
  linkedPartners: Vendor[];
  dateRange: InsightsRange;
  onDateRangeChange: (v: InsightsRange) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  // Partner currencies come from their groups, as the store has them.
  const { groups: partnerGroups } = usePartnerGroups();
  /* Chart bucketing still thinks in the legacy 7d/30d/90d/1y windows —
   * map the shared InsightsRange onto them (All time + Custom fall back
   * to the yearly buckets until the analytics feed lands). */
  const bucketRange: "7d" | "30d" | "90d" | "1y" =
    dateRange === "last_7" ? "7d" : dateRange === "last_30" ? "30d" : dateRange === "last_90" ? "90d" : "1y";
  // KPI ordering (drag/drop) + visibility (remove) — persisted to localStorage.
  // We sanitize the persisted state against the current ALL_KPIS list so any
  // keys that were removed in a deploy (e.g. "rating") don't blow up the
  // KPI_TILE_DATA[k] callsite below. Missing keys from new deploys are
  // appended so the user automatically picks up new tiles.
  const [kpiOrder, setKpiOrder] = useState<KpiKey[]>(() => {
    const known = new Set<KpiKey>(ALL_KPIS);
    try {
      const r = localStorage.getItem("pg-kpi-order");
      if (r) {
        const parsed = JSON.parse(r) as unknown[];
        const valid = parsed.filter((k): k is KpiKey => typeof k === "string" && known.has(k as KpiKey));
        const missing = ALL_KPIS.filter((k) => !valid.includes(k));
        return [...valid, ...missing];
      }
    } catch { /* ignore */ }
    return ALL_KPIS;
  });
  const [hiddenKpis, setHiddenKpis] = useState<Set<KpiKey>>(() => {
    const known = new Set<KpiKey>(ALL_KPIS);
    try {
      const r = localStorage.getItem("pg-kpi-hidden");
      if (r) {
        const parsed = JSON.parse(r) as unknown[];
        const valid = parsed.filter((k): k is KpiKey => typeof k === "string" && known.has(k as KpiKey));
        return new Set(valid);
      }
    } catch { /* ignore */ }
    return new Set();
  });
  useEffect(() => { try { localStorage.setItem("pg-kpi-order", JSON.stringify(kpiOrder)); } catch { /* ignore */ } }, [kpiOrder]);
  useEffect(() => { try { localStorage.setItem("pg-kpi-hidden", JSON.stringify(Array.from(hiddenKpis))); } catch { /* ignore */ } }, [hiddenKpis]);
  const moveKpi = (from: number, to: number) => {
    setKpiOrder((prev) => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next; });
  };
  const removeKpi = (k: KpiKey) => {
    setHiddenKpis((prev) => { const next = new Set(prev); next.add(k); return next; });
    toast.success(`KPI removed, re-enable in Customize Widgets`);
  };
  const restoreKpis = () => { setHiddenKpis(new Set()); setKpiOrder(ALL_KPIS); };

  // Widget sizes (sm / md / lg) + visibility + order — persisted.
  const [widgetSizes, setWidgetSizes] = useState<Record<WidgetKey, "sm" | "md" | "lg">>(() => {
    try { const r = localStorage.getItem("pg-widget-sizes"); if (r) return { ...DEFAULT_WIDGET_SIZES, ...JSON.parse(r) }; } catch { /* ignore */ }
    return DEFAULT_WIDGET_SIZES;
  });
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetKey>>(() => {
    try { const r = localStorage.getItem("pg-widget-hidden"); if (r) return new Set(JSON.parse(r)); } catch { /* ignore */ }
    return new Set();
  });
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(() => {
    try {
      const r = localStorage.getItem("pg-widget-order");
      if (r) {
        const parsed: WidgetKey[] = JSON.parse(r);
        // Heal: ensure every known widget appears exactly once even if catalog grew.
        const known = new Set(ALL_WIDGETS);
        const seen = new Set<WidgetKey>();
        const out = parsed.filter((k) => known.has(k) && !seen.has(k) && (seen.add(k), true));
        ALL_WIDGETS.forEach((k) => { if (!seen.has(k)) out.push(k); });
        return out;
      }
    } catch { /* ignore */ }
    return ALL_WIDGETS;
  });
  useEffect(() => { try { localStorage.setItem("pg-widget-sizes", JSON.stringify(widgetSizes)); } catch { /* ignore */ } }, [widgetSizes]);
  useEffect(() => { try { localStorage.setItem("pg-widget-hidden", JSON.stringify(Array.from(hiddenWidgets))); } catch { /* ignore */ } }, [hiddenWidgets]);
  useEffect(() => { try { localStorage.setItem("pg-widget-order", JSON.stringify(widgetOrder)); } catch { /* ignore */ } }, [widgetOrder]);
  const setWidgetSize = (k: WidgetKey, s: "sm" | "md" | "lg") => setWidgetSizes((prev) => ({ ...prev, [k]: s }));
  const removeWidget = (k: WidgetKey, label: string) => {
    setHiddenWidgets((prev) => { const next = new Set(prev); next.add(k); return next; });
    toast.success(`Removed "${label}", re-enable in Customize Widgets`);
  };
  const moveWidget = (from: number, to: number) => {
    setWidgetOrder((prev) => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next; });
  };
  // Derived counts off the linked-partner slice — live numbers, not seeded.
  const stats = useMemo<KpiTileStats & { archived: number }>(() => {
    const vendor = linkedPartners.filter((v) => (v.partnerTypes || []).includes("vendor")).length;
    const customer = linkedPartners.filter((v) => (v.partnerTypes || []).includes("customer")).length;
    const active = linkedPartners.filter((v) => v.status === "active").length;
    const inactive = linkedPartners.filter((v) => v.status === "inactive").length;
    const archived = linkedPartners.filter((v) => v.status === "archived").length;
    // Partners keep their figures in their own currencies; group totals add
    // them up in the base currency (each converted at today's mid-market rate).
    const inBase = (v: Vendor, amount: number | undefined) => toBaseNow(amount || 0, partnerCurrencyOf(v, partnerGroups));
    const totalSpend = linkedPartners.reduce((sum, v) => sum + inBase(v, v.totalSpent), 0);
    const outstanding = linkedPartners.reduce((sum, v) => sum + inBase(v, v.outstandingBalance), 0);
    const totalOrders = linkedPartners.reduce((sum, v) => sum + (v.totalOrders || 0), 0);
    // Orders split by trade direction per BA pass — POs to vendor-side
    // partners, SOs from customer-side. Total kept only as the
    // avg-order-value denominator, never displayed.
    const purchaseOrders = linkedPartners.reduce((sum, v) => sum + splitVendorOrders(v).po, 0);
    const salesOrders = linkedPartners.reduce((sum, v) => sum + splitVendorOrders(v).so, 0);
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;
    // No rating system in product — Avg Rating KPI removed per
    // stakeholder feedback ("we have no rating system, AI keeps
    // inserting it").
    // Credit used across the group, as a share of its credit limits (both in base).
    const creditLimitTotal = linkedPartners.reduce((sum, v) => sum + inBase(v, v.creditLimit), 0);
    const creditUtil = creditLimitTotal > 0
      ? (linkedPartners.reduce((sum, v) => sum + inBase(v, v.creditUtilization), 0) / creditLimitTotal) * 100
      : 0;
    const uniqueRegions = new Set(linkedPartners.map((v) => v.country).filter(Boolean)).size || 1;
    return { vendor, customer, active, inactive, archived, totalSpend, outstanding, creditUtil, uniqueRegions, totalOrders, purchaseOrders, salesOrders, avgOrderValue };
  }, [linkedPartners, partnerGroups]);

  // Group-level data series — mirrors the Partner Detail dashboard
  // (SPEND_TREND_DATA / ORDER_ACTIVITY_DATA_PO|SO), scaled to aggregate
  // across all linked partners. The PO trend sums to the group's actual
  // totalSpend so the chart and the "Total Spend" KPI agree; the SO trend
  // mirrors at ~62% of PO spend so the visual ratio matches the partner page.
  // Activity bars are scaled by partnerCount with deterministic jitter off
  // the group id so the same group always paints the same chart.
  const PO_TREND_SHAPE = [42, 58, 65, 72, 68, 89, 95, 102, 88, 110, 118, 125];
  const TREND_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const poSpendTrend = useMemo(() => {
    const shapeSum = PO_TREND_SHAPE.reduce((a, b) => a + b, 0);
    const targetTotal = Math.max(shapeSum, stats.totalSpend);
    const scale = targetTotal / shapeSum;
    const monthly = TREND_LABELS.map((month, i) => ({ month, range: undefined as string | undefined, amount: Math.round(PO_TREND_SHAPE[i] * scale) }));
    if (bucketRange === "1y") return monthly;
    // Windowed views re-bucket one level of granularity down — 7d
    // day-on-day, 30d week-on-week, 90d month-on-month, with edge
    // buckets clipped to the window (the `range` field carries the
    // actual dates for the hover tooltip). 90d reuses the matching
    // baseline month's amount so the curve agrees with the 1y view.
    const monthlyAvg = monthly.reduce((s, d) => s + d.amount, 0) / monthly.length;
    const unitBase = bucketRange === "7d" ? monthlyAvg / 30 : bucketRange === "30d" ? (monthlyAvg * 12) / 52 : monthlyAvg;
    return buildPeriodBuckets(bucketRange).map((b, i) => {
      const monthAmt = bucketRange === "90d" ? monthly.find((m) => m.month === b.label)?.amount : undefined;
      return { month: b.label, range: b.range, amount: Math.round((monthAmt ?? unitBase * bucketWobble(i)) * b.weight) };
    });
  }, [stats.totalSpend, bucketRange]);
  const soSpendTrend = useMemo(
    () => poSpendTrend.map((d) => ({ ...d, amount: Math.round(d.amount * 0.62) })),
    [poSpendTrend],
  );

  const PO_ACTIVITY_SHAPE = [4, 7, 5, 8, 6, 3, 2];
  const PO_RETURNS_SHAPE  = [1, 2, 0, 1, 3, 0, 1];
  const SO_ACTIVITY_SHAPE = [3, 5, 4, 6, 8, 2, 1];
  const SO_RETURNS_SHAPE  = [0, 1, 1, 2, 1, 0, 0];
  const ACTIVITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Activity bars re-bucket to the dashboard's date window — 7d keeps the
  // daily baseline, 30d rolls it up week-on-week, 90d month-on-month
  // (clipped edge buckets carry their actual dates in `range` for the
  // hover tooltip), 1y spreads across the 12 months.
  const buildOrderActivity = useCallback((dailyShape: number[], returnsShape: number[], hashSeed: string, multFactor: number, jitterStep: number, jitterMod: number) => {
    const h = hashString(hashSeed);
    const mult = Math.max(1, Math.round(linkedPartners.length * multFactor));
    const daily = ACTIVITY_DAYS.map((day, i) => ({
      label: day,
      range: undefined as string | undefined,
      orders: dailyShape[i] * mult + (h + i * jitterStep) % jitterMod,
      returns: returnsShape[i] * mult,
    }));
    if (bucketRange === "7d") {
      return buildPeriodBuckets("7d").map((b, i) => {
        const src = daily.find((d) => d.label === b.label) ?? daily[i % 7];
        return { ...src, label: b.label, range: b.range };
      });
    }
    const weekOrders = daily.reduce((s, d) => s + d.orders, 0);
    const weekReturns = daily.reduce((s, d) => s + d.returns, 0);
    if (bucketRange === "30d") {
      return buildPeriodBuckets("30d").map((b, i) => ({
        label: b.label,
        range: b.range,
        orders: Math.max(1, Math.round(weekOrders * b.weight * bucketWobble(h + i))),
        returns: Math.round(weekReturns * b.weight * bucketWobble(h + i + 2)),
      }));
    }
    const monthOrders = (weekOrders * 52) / 12;
    const monthReturns = (weekReturns * 52) / 12;
    if (bucketRange === "90d") {
      return buildPeriodBuckets("90d").map((b, i) => ({
        label: b.label,
        range: b.range,
        orders: Math.max(1, Math.round(monthOrders * b.weight * bucketWobble(h + i))),
        returns: Math.round(monthReturns * b.weight * bucketWobble(h + i + 3)),
      }));
    }
    return TREND_LABELS.map((m, i) => ({
      label: m,
      range: undefined as string | undefined,
      orders: Math.max(1, Math.round(monthOrders * bucketWobble(h + i))),
      returns: Math.round(monthReturns * bucketWobble(h + i + 3)),
    }));
    // ACTIVITY_DAYS / TREND_LABELS / shapes are module-stable constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPartners.length, bucketRange]);
  const poOrderActivity = useMemo(
    () => buildOrderActivity(PO_ACTIVITY_SHAPE, PO_RETURNS_SHAPE, group.id, 0.6, 13, 7),
    [group.id, buildOrderActivity],
  );
  const soOrderActivity = useMemo(
    () => buildOrderActivity(SO_ACTIVITY_SHAPE, SO_RETURNS_SHAPE, group.id + ":so", 0.45, 17, 5),
    [group.id, buildOrderActivity],
  );

  // Donut breakdowns — fed by the live stats slice computed above.
  const typeBreakdown = [
    { name: "Vendor", value: stats.vendor, color: "#0A77FF" },
    { name: "Customer", value: stats.customer, color: "#8B5CF6" },
  ];
  const statusBreakdown = [
    { name: "Active", value: stats.active, color: "#10B981" },
    { name: "Inactive", value: stats.inactive, color: "#F59E0B" },
    { name: "Archived", value: stats.archived, color: "#94A3B8" },
  ];

  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  const handleToggleKpiVisibility = (k: KpiKey) => {
    setHiddenKpis((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const handleToggleWidgetVisibility = (k: WidgetKey) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const handleResetLayout = () => {
    setHiddenKpis(new Set());
    setKpiOrder(ALL_KPIS);
    setHiddenWidgets(new Set());
    setWidgetOrder(ALL_WIDGETS);
    setWidgetSizes(DEFAULT_WIDGET_SIZES);
    toast.success("Dashboard layout reset");
  };
  /* Reset stays grey until the dashboard diverges from its default
   * KPI/widget set or order — mirrors the listing pages' dirty-aware
   * InsightsResetButton. */
  const dashDirty =
    hiddenKpis.size > 0 ||
    kpiOrder.join(",") !== ALL_KPIS.join(",") ||
    hiddenWidgets.size > 0 ||
    widgetOrder.join(",") !== ALL_WIDGETS.join(",");
  const dateRangeLabel = bucketRange === "7d" ? "Last 7 Days"
    : bucketRange === "30d" ? "Last 30 Days"
    : bucketRange === "90d" ? "Last 90 Days"
    : "Last Year";

  return (
    <div className="space-y-4">
      {/* Toolbar — Dashboard label + date dropdown + Updated · Refresh on left,
          Reset + Customize Widgets on the right (matches Partner Detail).
          mb-2.5 to the KPI strip matches the listing pages' insights gap. */}
      <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Dashboard</span>
            {/* Date Range Filter — shared invoicing control (incl. All time + Custom) */}
            <InsightsRangeMenu
              range={dateRange}
              onRangeChange={onDateRangeChange}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={onCustomChange}
            />
            <InsightsRefresh toastLabel="Dashboard refreshed" />
          </div>
          <div className="flex items-center gap-2">
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

        {/* KPI strip — compact responsive grid, drag-to-reorder, hover-remove. */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
          {kpiOrder.filter((k) => !hiddenKpis.has(k)).map((k, idx) => {
            const tile = KPI_TILE_DATA[k](group, stats);
            return (
              <DraggableKpiTile
                key={k}
                kpiKey={k}
                index={idx}
                moveCard={moveKpi}
                onRemove={() => removeKpi(k)}
              >
                <CompactKpiCard
                  label={tile.label}
                  value={tile.value}
                  change={tile.delta}
                  changeColor={tile.deltaColor ?? (tile.deltaUp ? "rgb(var(--success))" : "rgb(var(--muted-foreground))")}
                  icon={tile.icon}
                  tooltip={tile.tooltip}
                />
              </DraggableKpiTile>
            );
          })}
        </div>
      </div>

      {/* Charts + Sidebar grid — KPIs above are full-width, this row splits */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="min-w-0">

        {/* Widgets — each wrapped in resizable card + draggable wrapper. Layout
            mirrors Partner Detail: a flex-wrap container where each widget gets
            either a "full" (100%) or "half" (calc(50% - 6px)) span based on its
            current size + a default span baseline. Drag re-orders within the
            same flex container. */}
        <div className="flex flex-wrap gap-3 items-stretch min-w-0">
          {(() => {
            const DEFAULT_SPANS: Record<WidgetKey, "full" | "half"> = {
              po_spend_trend: "half", so_spend_trend: "half", po_order_activity: "half", so_order_activity: "half",
              type: "half", status: "half", vendor_coverage: "half", customer_coverage: "half",
            };
            const ttStyle = { borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 };
            // Stat row helper — same shape as Partner Detail. `trailing` sits on
            // the right edge of the same baseline (legend / period label).
            const statRow = (stats: { label: string; value: string; color?: string }[], compact?: boolean, trailing?: React.ReactNode) => (
              <div className={`flex items-end justify-between gap-4 ${compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2"} border-t border-muted`}>
                <div className={`flex items-center ${compact ? "gap-3" : "gap-4"} flex-wrap min-w-0`}>
                  {stats.map((s, i) => (
                    <div key={i}>
                      <p className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>{s.label}</p>
                      <p className={compact ? "text-[11px]" : "text-[13px]"} style={{ fontWeight: 700, color: s.color || "#334155" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {trailing && <div className="shrink-0 pb-px">{trailing}</div>}
              </div>
            );
            // Scope-gate the configuration cards — a vendor-only group
            // never shows the Customer Configuration widget (and vice
            // versa), mirroring how the Configuration tab hides the
            // irrelevant sub-tab.
            const hasVendorScope = group.templateType === "vendor" || group.templateType === "both";
            const hasCustomerScope = group.templateType === "customer" || group.templateType === "both";
            const visibleOrder = widgetOrder.filter((k) =>
              !hiddenWidgets.has(k)
              && !(k === "vendor_coverage" && !hasVendorScope)
              && !(k === "customer_coverage" && !hasCustomerScope));
            return visibleOrder.map((wKey, wIdx) => {
              const sz = widgetSizes[wKey] || "md";
              const span = sz === "sm" ? "half" : sz === "lg" ? "full" : DEFAULT_SPANS[wKey];
              const widthVal = span === "full" ? "100%" : "calc(50% - 6px)";

              let title = "";
              let icon: React.ElementType = TrendingUp;
              let tip = "";
              let body: React.ReactNode = null;

              if (wKey === "po_spend_trend" || wKey === "so_spend_trend") {
                const isSo = wKey === "so_spend_trend";
                const data = isSo ? soSpendTrend : poSpendTrend;
                const stroke = isSo ? "#059669" : "rgb(var(--primary))";
                const gradId = isSo ? "pgSoSpendGrad" : "pgPoSpendGrad";
                const seriesLabel = isSo ? "SO Revenue" : "PO Spend";
                const footnote = isSo
                  ? "Inflow across all partners in this group (SOs we ship to them)"
                  : "Outflow across all partners in this group (POs we issue)";
                icon = TrendingUp;
                title = isSo ? "Sales Order Revenue Trend" : "Purchase Order Cost Trend";
                tip = isSo
                  ? "Money the partners in this group pay us, summed by month, across the sales orders we fulfill to them (them → us)."
                  : "Money we pay the partners in this group, summed by month, across the purchase orders we issue (we → them).";
                const totalYTD = data.reduce((s, d) => s + d.amount, 0);
                const avgMonthly = Math.round(totalYTD / Math.max(1, data.length));
                const peakMonth = data.reduce((a, b) => a.amount > b.amount ? a : b);
                const lowMonth = data.reduce((a, b) => a.amount < b.amount ? a : b);
                // Stat labels follow the dashboard window — buckets are days
                // for 7d, weeks for 30d, months for 90d/1y.
                const totalLabel = bucketRange === "1y" ? "YTD Total" : `${dateRangeLabel} Total`;
                const totalLabelSm = bucketRange === "1y" ? "YTD" : "Total";
                const avgLabel = bucketRange === "7d" ? "Daily Avg" : bucketRange === "30d" ? "Weekly Avg" : "Monthly Avg";
                const avgLabelSm = bucketRange === "7d" ? "Avg/day" : bucketRange === "30d" ? "Avg/wk" : "Avg/mo";
                const bucketNoun = bucketRange === "7d" ? "Day" : bucketRange === "30d" ? "Week" : "Month";
                body = (
                  <>
                    <ResponsiveContainer width="100%" height={chartHeight(sz, "area")}>
                      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity={0.15} /><stop offset="100%" stopColor={stroke} stopOpacity={0.01} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactMoney(v, BASE_CURRENCY)} />
                        <ReTooltip contentStyle={ttStyle} formatter={(val: number) => [formatMoney(val, BASE_CURRENCY), seriesLabel]} labelFormatter={(label, payload) => (payload?.[0]?.payload as { range?: string })?.range ?? label} />
                        <Area type="monotone" dataKey="amount" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                    {(() => {
                      const trailing = <span className="text-[11px] text-slate-400 text-right max-w-[260px]" style={{ fontWeight: 500 }}>{footnote}</span>;
                      if (sz === "sm") return statRow([
                        { label: totalLabelSm, value: formatCurrency(totalYTD) },
                        { label: avgLabelSm, value: formatCurrency(avgMonthly) },
                      ], true, trailing);
                      if (sz === "md") return statRow([
                        { label: totalLabel, value: formatCurrency(totalYTD) },
                        { label: avgLabel, value: formatCurrency(avgMonthly) },
                      ], false, trailing);
                      return statRow([
                        { label: totalLabel, value: formatCurrency(totalYTD) },
                        { label: avgLabel, value: formatCurrency(avgMonthly) },
                        { label: `Peak ${bucketNoun}`, value: `${peakMonth.month} · ${formatCurrency(peakMonth.amount)}`, color: stroke },
                        { label: "Lowest", value: `${lowMonth.month} · ${formatCurrency(lowMonth.amount)}`, color: "#94A3B8" },
                      ], false, trailing);
                    })()}
                  </>
                );
              } else if (wKey === "po_order_activity" || wKey === "so_order_activity") {
                const isSo = wKey === "so_order_activity";
                const baseData = isSo ? soOrderActivity : poOrderActivity;
                const ordersColor = isSo ? "#059669" : "rgb(var(--primary))";
                const ordersLabel = isSo ? "SOs Shipped" : "POs Issued";
                const footnote = isSo
                  ? "Outbound from us across the group (SOs); returns flow back to us"
                  : "Outbound to the group's partners (POs); returns flow back to us";
                icon = BarChart3;
                title = isSo ? "Sale Order Activity" : "Purchase Order Activity";
                tip = isSo
                  ? "Sales orders we shipped to the partners in this group across the selected period, with items they returned back to us."
                  : "Purchase orders we issued to the partners in this group across the selected period, with items they returned back to us.";
                const totalOrd = baseData.reduce((s, d) => s + d.orders, 0);
                const totalRet = baseData.reduce((s, d) => s + d.returns, 0);
                const retPct = totalOrd > 0 ? ((totalRet / totalOrd) * 100).toFixed(1) : "0";
                const peakDay = baseData.reduce((a, b) => (a.orders > b.orders ? a : b), baseData[0]);
                const avgDay = (totalOrd / Math.max(1, baseData.length)).toFixed(1);
                // Buckets are days for 7d, weeks for 30d, months for 90d/1y.
                const actBucketNoun = bucketRange === "7d" ? "Day" : bucketRange === "30d" ? "Week" : "Month";
                const legend = (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ordersColor }} /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{ordersLabel}</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Returns</span></div>
                  </div>
                );
                body = (
                  <>
                    <ResponsiveContainer width="100%" height={chartHeight(sz, "bar")}>
                      <BarChart data={baseData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={32} />
                        <ReTooltip contentStyle={ttStyle} labelFormatter={(label, payload) => (payload?.[0]?.payload as { range?: string })?.range ?? label} />
                        <Bar dataKey="orders" fill={ordersColor} radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name={ordersLabel} />
                        <Bar dataKey="returns" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={sz === "sm" ? 14 : 24} name="Returns" />
                      </BarChart>
                    </ResponsiveContainer>
                    {sz === "sm" && statRow([
                      { label: ordersLabel, value: `${totalOrd}` },
                      { label: "Returns", value: `${retPct}%`, color: "#F59E0B" },
                    ], true, legend)}
                    {sz === "md" && statRow([
                      { label: dateRangeLabel, value: `${totalOrd} ${isSo ? "SOs" : "POs"}` },
                      { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                    ], false, legend)}
                    {sz === "lg" && statRow([
                      { label: dateRangeLabel, value: `${totalOrd} ${isSo ? "SOs" : "POs"}` },
                      { label: "Returns", value: `${totalRet} (${retPct}%)`, color: "#F59E0B" },
                      { label: `Peak ${actBucketNoun}`, value: `${peakDay?.label ?? "—"} · ${peakDay?.orders ?? 0}`, color: ordersColor },
                      { label: `Avg / ${actBucketNoun}`, value: avgDay },
                    ], false, legend)}
                    <p className="text-[10px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>{footnote}</p>
                  </>
                );
              } else if (wKey === "type") {
                title = "Type Breakdown"; icon = PieIcon;
                tip = "Vendor vs. Customer split among linked partners.";
                const totalVC = stats.vendor + stats.customer;
                const vendorPct = totalVC > 0 ? Math.round((stats.vendor / totalVC) * 100) : 0;
                const customerPct = totalVC > 0 ? Math.round((stats.customer / totalVC) * 100) : 0;
                const ratio = stats.customer > 0 ? (stats.vendor / stats.customer).toFixed(1) : "—";
                body = (
                  <>
                    <DonutChart data={typeBreakdown} total={linkedPartners.length} centerLabel="Partners" size={sz} />
                    {sz === "sm" && statRow([
                      { label: "Vendor", value: stats.vendor.toString(), color: "#0A77FF" },
                      { label: "Customer", value: stats.customer.toString(), color: "#8B5CF6" },
                    ], true)}
                    {sz === "md" && statRow([
                      { label: "Vendor", value: `${stats.vendor} (${vendorPct}%)`, color: "#0A77FF" },
                      { label: "Customer", value: `${stats.customer} (${customerPct}%)`, color: "#8B5CF6" },
                    ])}
                    {sz === "lg" && statRow([
                      { label: "Vendor", value: `${stats.vendor} (${vendorPct}%)`, color: "#0A77FF" },
                      { label: "Customer", value: `${stats.customer} (${customerPct}%)`, color: "#8B5CF6" },
                      { label: "V : C Ratio", value: `${ratio} : 1` },
                      { label: "Total", value: totalVC.toString() },
                    ])}
                  </>
                );
              } else if (wKey === "status") {
                title = "Status Breakdown"; icon = PieIcon;
                tip = "Active / Inactive / Archived distribution.";
                const totalSt = stats.active + stats.inactive + stats.archived;
                const activePct = totalSt > 0 ? Math.round((stats.active / totalSt) * 100) : 0;
                body = (
                  <>
                    <DonutChart data={statusBreakdown} total={linkedPartners.length} centerLabel="Partners" size={sz} />
                    {sz === "sm" && statRow([
                      { label: "Active", value: stats.active.toString(), color: "#10B981" },
                      { label: "Inactive", value: stats.inactive.toString(), color: "#F59E0B" },
                    ], true)}
                    {sz === "md" && statRow([
                      { label: "Active", value: `${stats.active} (${activePct}%)`, color: "#10B981" },
                      { label: "Inactive", value: stats.inactive.toString(), color: "#F59E0B" },
                      { label: "Archived", value: stats.archived.toString(), color: "#94A3B8" },
                    ])}
                    {sz === "lg" && statRow([
                      { label: "Active", value: `${stats.active} (${activePct}%)`, color: "#10B981" },
                      { label: "Inactive", value: stats.inactive.toString(), color: "#F59E0B" },
                      { label: "Archived", value: stats.archived.toString(), color: "#94A3B8" },
                      { label: "Health", value: activePct >= 80 ? "Healthy" : activePct >= 50 ? "Watch" : "At Risk", color: activePct >= 80 ? "rgb(var(--success))" : activePct >= 50 ? "rgb(var(--warning))" : "rgb(var(--destructive))" },
                    ])}
                  </>
                );
              } else if (wKey === "vendor_coverage" || wKey === "customer_coverage") {
                const scope = wKey === "vendor_coverage" ? ("vendor" as const) : ("customer" as const);
                title = scope === "vendor" ? "Vendor Configuration" : "Customer Configuration";
                icon = Settings2;
                tip = scope === "vendor"
                  ? "Every vendor-side templated setting for this group — Set means new vendor partners inherit it, Not set means they pick their own."
                  : "Every customer-side templated setting for this group — Set means new customer partners inherit it, Not set means they pick their own.";
                body = <ConfigurationCoverageBody group={group} scope={scope} size={sz} />;
              }

              return (
                <div
                  key={wKey}
                  style={{ width: widthVal }}
                  className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                >
                  <DraggableWidget widgetKey={wKey} index={wIdx} moveWidget={moveWidget}>
                    {(dragging, over) => (
                      <ResizableChartCard
                        title={title} icon={icon} tip={tip} size={sz}
                        onSizeChange={(s) => setWidgetSize(wKey, s)}
                        onRemove={() => removeWidget(wKey, title)}
                        isDragging={dragging} isOver={over}
                      >
                        {body}
                      </ResizableChartCard>
                    )}
                  </DraggableWidget>
                </div>
              );
            });
          })()}
        </div>
      </div>

        {/* Sidebar */}
        <div className="hidden lg:block space-y-4">
          <GroupInformationCard group={group} />
          <TemplateSummaryCard group={group} />
          <RecentActivitySidebarCard />
        </div>
      </div>

      {/* Customize Widgets side drawer */}
      <CustomizeWidgetsPanel
        open={customizePanelOpen}
        onOpenChange={setCustomizePanelOpen}
        hiddenKpis={hiddenKpis}
        onToggleKpi={handleToggleKpiVisibility}
        hiddenWidgets={hiddenWidgets}
        onToggleWidget={handleToggleWidgetVisibility}
        widgetSizes={widgetSizes}
        onWidgetSizeChange={setWidgetSize}
        group={group}
        stats={stats}
      />
    </div>
  );
}

/* ─── Reusable bits */

interface KpiTileStats {
  active: number;
  inactive: number;
  totalSpend: number;
  outstanding: number;
  creditUtil: number;
  vendor: number;
  customer: number;
  uniqueRegions: number;
  totalOrders: number;
  purchaseOrders: number;
  salesOrders: number;
  avgOrderValue: number;
}

// KPI data resolver — keyed by KpiKey. Recomputes when group/stats change.
// `deltaColor` lets a tile override the default green/muted delta color
// (used by Active to render the inactive count in amber so the
// active-vs-inactive relationship reads at a glance).
const KPI_TILE_DATA: Record<KpiKey, (group: PartnerGroupTemplateSummary, stats: KpiTileStats) => { label: string; value: string; delta?: string; deltaUp?: boolean; deltaColor?: string; tooltip?: string; icon: React.ElementType }> = {
  total:       (g)    => ({ label: "Total Partners",       value: g.partnerCount.toLocaleString(),         delta: "+12%",                                deltaUp: true,  icon: Users }),
  active:      (_, s) => ({ label: "Active",               value: s.active.toLocaleString(),               delta: s.inactive > 0 ? `${s.inactive} inactive` : "All active", deltaColor: s.inactive > 0 ? "#B45309" : undefined, icon: Check, tooltip: `${s.active} active partners, ${s.inactive} inactive in this group.` }),
  vendors:     (_, s) => ({ label: "Vendor Partners",      value: s.vendor.toLocaleString(),               delta: s.vendor > 0 ? "+3.2%" : undefined, deltaUp: true, icon: ShoppingCart }),
  customers:   (_, s) => ({ label: "Customer Partners",    value: s.customer.toLocaleString(),             delta: s.customer > 0 ? "+1.8%" : undefined, deltaUp: true, icon: Users }),
  purchaseOrders: (_, s) => ({ label: "Purchase Orders",   value: s.purchaseOrders.toLocaleString(),       delta: "+4.6%",                               deltaUp: true,  icon: ShoppingCart, tooltip: "Purchase orders placed with vendor-side partners in this group." }),
  salesOrders: (_, s) => ({ label: "Sales Orders",         value: s.salesOrders.toLocaleString(),          delta: "+3.1%",                               deltaUp: true,  icon: Receipt, tooltip: "Sales orders received from customer-side partners in this group." }),
  spend:       (_, s) => ({ label: "Total Spend",          value: formatCurrency(s.totalSpend),            delta: "+1.2%",                               deltaUp: true,  icon: TrendingUp }),
  outstanding: (_, s) => ({ label: "Outstanding",          value: formatCurrency(s.outstanding),           delta: s.outstanding > 0 ? "Pending" : "Cleared", icon: Receipt }),
  avgOrder:    (_, s) => ({ label: "Avg. Order Value",     value: formatCurrency(s.avgOrderValue),         delta: "+2.1%",                               deltaUp: true,  icon: DollarSign, tooltip: "Aggregate spend divided by aggregate orders across all partners in this group." }),
  regions:     (_, s) => ({ label: "Countries Covered",    value: s.uniqueRegions.toLocaleString(),        delta: `${s.creditUtil.toFixed(0)}% credit used`, icon: Globe, tooltip: "Collective list of countries from all partners in this group. Counted at the partner level, not the group level." }),
};

// Compact KPI card — matches the Partner Detail dashboard tile layout exactly:
// label + tiny info icon at top-left, small icon top-right, big value with an
// optional inline change indicator on the same baseline.
function CompactKpiCard({
  label,
  value,
  change,
  changeColor,
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: string;
  change?: string;
  changeColor?: string;
  icon?: React.ElementType;
  /** Optional small info icon next to the label that surfaces a
   *  native title-tooltip — used for KPIs whose meaning isn't
   *  obvious from the label alone (e.g. "Countries Covered"). */
  tooltip?: string;
}) {
  return (
    <div className="px-3 py-2 select-none">
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
          {tooltip && (
            <span title={tooltip} className="inline-flex shrink-0 cursor-help">
              <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 transition-colors" />
            </span>
          )}
        </div>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        {change && (
          <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: changeColor || "rgb(var(--success))" }}>{change}</span>
        )}
        <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
      </div>
    </div>
  );
}

// Draggable KPI tile wrapper — react-dnd hover-to-reorder + hover-to-remove.
const PG_KPI_DND = "PG_KPI_CARD";
function DraggableKpiTile({
  kpiKey, index, moveCard, onRemove, children,
}: {
  kpiKey: KpiKey;
  index: number;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: PG_KPI_DND,
    item: () => ({ key: kpiKey, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: PG_KPI_DND,
    drop(item: { key: string; index: number }) {
      if (item.index !== index) {
        moveCard(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });
  preview(drop(ref));
  drag(ref);

  // Dragging ghost — dashed placeholder like Partner Detail.
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
      {isOver && <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />}
      {children}
      {/* Drag affordance — top-right pill on hover (visual only; whole card drags) */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
        <GripVertical className="w-3 h-3 text-slate-500" />
      </div>
      {/* Remove button — bottom-right on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
        title="Remove KPI"
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
      </button>
    </div>
  );
}

// Chart card with size dropdown + remove button (mirrors Partner Detail ContentCard).
function ResizableChartCard({
  title, icon: Icon, tip, size, onSizeChange, onRemove, isDragging, isOver, children,
}: {
  title: string;
  icon: React.ElementType;
  tip?: string;
  size: "sm" | "md" | "lg";
  onSizeChange: (s: "sm" | "md" | "lg") => void;
  onRemove: () => void;
  isDragging?: boolean;
  isOver?: boolean;
  children: React.ReactNode;
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
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between gap-2 shrink-0 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 min-w-0 pointer-events-none">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
          {tip && (
            <span title={tip} className="inline-flex shrink-0 cursor-help pointer-events-auto">
              <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Size segmented control — slides in on hover */}
          <div
            className={`transition-all duration-200 ease-out ${
              hovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
            }`}
          >
            <div className="flex items-center h-7 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5">
              {(["sm", "md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onSizeChange(s); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`h-6 px-2.5 rounded-md text-[11px] cursor-pointer transition-all ${
                    size === s
                      ? "bg-white text-primary shadow-sm border border-border"
                      : "text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent"
                  }`}
                  style={{ fontWeight: size === s ? 600 : 500 }}
                >
                  {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
                </button>
              ))}
            </div>
          </div>
          {/* Remove button — fades in on hover */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all cursor-pointer hover:bg-red-100 hover:text-destructive ${
              hovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            title={`Remove ${title}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className={`flex-1 ${size === "sm" ? "p-3" : size === "lg" ? "p-5" : "p-4"}`}>{children}</div>
    </div>
  );
}

// ── Draggable Widget Wrapper — same DnD shape as VendorDetailsPage's DraggableWidgetCard ──
const PG_WIDGET_DND = "PG_DASHBOARD_WIDGET";
function DraggableWidget({ widgetKey, index, moveWidget, children }: {
  widgetKey: string;
  index: number;
  moveWidget: (from: number, to: number) => void;
  children: (isDragging: boolean, isOver: boolean) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: PG_WIDGET_DND,
    item: () => ({ key: widgetKey, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: PG_WIDGET_DND,
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

// Per-size chart heights so resize actually changes the canvas.
function chartHeight(size: "sm" | "md" | "lg", kind: "area" | "bar"): number {
  if (kind === "area") return size === "sm" ? 160 : size === "lg" ? 320 : 240;
  return size === "sm" ? 140 : size === "lg" ? 280 : 220;
}

/* ─── Customize Widgets side drawer ───
   Mirrors the Partner Detail DashboardCustomizePanel: right-anchored drawer
   with header + count + Enable All + search + KPIs/Widgets tabs + categorized
   cells. Toggles hiddenKpis / hiddenWidgets state and respects activeKpis. */

const PG_KPI_CATALOG: { key: KpiKey; label: string; category: string; subtitle?: string; icon: React.ElementType }[] = [
  { key: "total",       label: "Total Partners",    category: "Overview",   subtitle: "All partners linked",        icon: Users },
  { key: "active",      label: "Active",            category: "Overview",   subtitle: "Active vs. inactive split",  icon: Check },
  { key: "vendors",     label: "Vendor Partners",   category: "Composition", subtitle: "Suppliers in this group",    icon: ShoppingCart },
  { key: "customers",   label: "Customer Partners", category: "Composition", subtitle: "Buyers in this group",       icon: Users },
  { key: "purchaseOrders", label: "Purchase Orders", category: "Financial",  subtitle: "POs to vendor partners",      icon: ShoppingCart },
  { key: "salesOrders",    label: "Sales Orders",    category: "Financial",  subtitle: "SOs from customer partners",  icon: Receipt },
  { key: "spend",       label: "Total Spend",       category: "Financial",  subtitle: "Aggregate transaction value", icon: TrendingUp },
  { key: "outstanding", label: "Outstanding",       category: "Financial",  subtitle: "Unpaid balance across group", icon: Receipt },
  { key: "avgOrder",    label: "Avg. Order Value",  category: "Financial",  subtitle: "Aggregate spend ÷ aggregate orders", icon: DollarSign },
  { key: "regions",     label: "Countries Covered", category: "Geography",  subtitle: "Distinct countries from partners", icon: Globe },
];
type WidgetVisualType = "line" | "bars" | "donut" | "stacked";
const PG_WIDGET_CATALOG: { key: WidgetKey; label: string; description: string; type: WidgetVisualType; category: string }[] = [
  { key: "po_spend_trend",    label: "Purchase Order Cost Trend", description: "Monthly dollars we pay the partners in this group across POs (we → them).", type: "line", category: "Performance" },
  { key: "so_spend_trend",    label: "Sales Order Revenue Trend", description: "Monthly dollars the partners in this group pay us across SOs (them → us).", type: "line", category: "Performance" },
  { key: "po_order_activity", label: "Purchase Order Activity",   description: "Weekly count of POs we issued to this group, with returns flowing back.", type: "bars", category: "Performance" },
  { key: "so_order_activity", label: "Sale Order Activity",       description: "Weekly count of SOs we shipped to this group, with returns flowing back.", type: "bars", category: "Performance" },
  { key: "type",              label: "Type Breakdown",            description: "Vendor vs. Customer split among linked partners.",         type: "donut",   category: "Composition" },
  { key: "status",            label: "Status Breakdown",          description: "Active / Inactive / Archived distribution.",               type: "donut",   category: "Composition" },
  { key: "vendor_coverage",   label: "Vendor Configuration",      description: "Vendor-side templated settings — Set vs. Not set per section.",   type: "stacked", category: "Configuration" },
  { key: "customer_coverage", label: "Customer Configuration",    description: "Customer-side templated settings — Set vs. Not set per section.", type: "stacked", category: "Configuration" },
];

/* Mini chart-shape preview for each widget — visualizes what the widget renders.
   Mirrors the Partner Detail PartnerWidgetVisual but with the four shapes we use. */
function PgWidgetVisual({ type, isActive }: { type: WidgetVisualType; isActive: boolean }) {
  const C = {
    blue:   isActive ? "#7AB8FF" : "rgb(var(--border))",
    orange: isActive ? "#FDBA74" : "rgb(var(--border))",
    purple: isActive ? "#C4B5FD" : "rgb(var(--border))",
    green:  isActive ? "#86EFAC" : "rgb(var(--border))",
    slate:  isActive ? "#CBD5E1" : "rgb(var(--border))",
  };
  if (type === "line") {
    return (
      <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
        <path d="M2 32 L14 26 L24 28 L36 18 L48 22 L60 12 L78 8" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 32 L14 26 L24 28 L36 18 L48 22 L60 12 L78 8 L78 40 L2 40 Z" fill={C.blue} fillOpacity={isActive ? 0.18 : 0.08} />
      </svg>
    );
  }
  if (type === "bars") {
    const heights = [14, 24, 18, 28, 16, 22, 20];
    return (
      <div className="flex items-end gap-[3px] h-full w-full px-3 pb-2">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: h, backgroundColor: i % 3 === 1 ? C.orange : C.blue }} />
        ))}
      </div>
    );
  }
  if (type === "donut") {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="16" stroke={C.blue}   strokeWidth="6" strokeDasharray="40 100" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.purple} strokeWidth="6" strokeDasharray="35 100" strokeDashoffset="-40" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.green}  strokeWidth="6" strokeDasharray="25 100" strokeDashoffset="-75" transform="rotate(-90 22 22)" />
      </svg>
    );
  }
  // stacked
  const rows: { w: number; c: string }[][] = [
    [{ w: 50, c: C.blue }, { w: 25, c: C.green }, { w: 15, c: C.slate }],
    [{ w: 35, c: C.blue }, { w: 30, c: C.green }, { w: 20, c: C.slate }],
    [{ w: 45, c: C.blue }, { w: 20, c: C.green }, { w: 25, c: C.slate }],
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

function CustomizeWidgetsPanel({
  open, onOpenChange,
  hiddenKpis, onToggleKpi,
  hiddenWidgets, onToggleWidget,
  widgetSizes, onWidgetSizeChange,
  group, stats,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hiddenKpis: Set<KpiKey>;
  onToggleKpi: (k: KpiKey) => void;
  hiddenWidgets: Set<WidgetKey>;
  onToggleWidget: (k: WidgetKey) => void;
  widgetSizes: Record<WidgetKey, "sm" | "md" | "lg">;
  onWidgetSizeChange: (k: WidgetKey, s: "sm" | "md" | "lg") => void;
  group: PartnerGroupTemplateSummary;
  stats: KpiTileStats;
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
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  // Group KPIs by category, filtered by search.
  const kpiCategories = useMemo(() => {
    const map = new Map<string, typeof PG_KPI_CATALOG>();
    const q = searchQuery.toLowerCase();
    for (const k of PG_KPI_CATALOG) {
      if (q && !k.label.toLowerCase().includes(q) && !k.category.toLowerCase().includes(q)) continue;
      const arr = map.get(k.category) ?? [];
      arr.push(k);
      map.set(k.category, arr);
    }
    return Array.from(map, ([name, kpis]) => ({ name, kpis }));
  }, [searchQuery]);

  const widgetsFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    // Scope-gate the per-side configuration cards to the group's
    // templateType — same rule as the dashboard render loop, so the
    // panel never offers a widget the board can't show.
    const hasVendorScope = group.templateType === "vendor" || group.templateType === "both";
    const hasCustomerScope = group.templateType === "customer" || group.templateType === "both";
    return PG_WIDGET_CATALOG.filter((w) =>
      !(w.key === "vendor_coverage" && !hasVendorScope)
      && !(w.key === "customer_coverage" && !hasCustomerScope)
      && (!q || w.label.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)));
  }, [searchQuery, group.templateType]);

  if (!mounted) return null;

  const activeKpiCount = PG_KPI_CATALOG.length - hiddenKpis.size;
  const allKpisOn = hiddenKpis.size === 0;
  const allKpisOff = hiddenKpis.size === PG_KPI_CATALOG.length;
  const handleEnableAllKpis = () => {
    if (allKpisOn) {
      // toggle all off
      PG_KPI_CATALOG.forEach((k) => onToggleKpi(k.key));
    } else {
      // turn on the disabled ones
      PG_KPI_CATALOG.forEach((k) => { if (hiddenKpis.has(k.key)) onToggleKpi(k.key); });
    }
  };

  return createPortal(
    <>
      {/* Backdrop — portaled to body so it covers the full viewport regardless
          of parent stacking contexts (sidebar, breadcrumb, etc). */}
      <div
        className="fixed inset-0 z-[1000] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? "rgba(15,23,42,0.45)" : "rgba(15,23,42,0)", pointerEvents: visible ? "auto" : "none" }}
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[1001] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
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
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPI widgets.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKpiCount} of {PG_KPI_CATALOG.length} widgets active
            </span>
            <button
              onClick={handleEnableAllKpis}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allKpisOn ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                : allKpisOff ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allKpisOn ? <><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>
                : allKpisOff ? <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
                : <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>}
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

        {/* Tab bar */}
        <div className="flex items-center gap-0 px-5 border-b border-muted shrink-0 mt-3">
          {(["kpis", "widgets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPanelTab(t)}
              className={`px-4 py-2.5 border-b-2 text-[13px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                panelTab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
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
              {kpiCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-[12px]">No metrics match "{searchQuery}"</p>
                </div>
              )}
              {kpiCategories.map((cat) => {
                // Matches Partner Detail's category header — small leading icon + uppercase
                const CatIcon = cat.name === "Financial" ? TrendingUp
                  : cat.name === "Performance" ? Star
                  : cat.name === "Geography" ? Globe
                  : cat.name === "Composition" ? PieIcon
                  : Users;
                // Financial-tier KPIs depend on data that only lights up after the
                // Pioneer billing integration ships — flag the section so demos
                // make the dependency explicit.
                const isPostPioneer = cat.name === "Financial";
                return (
                  <div key={cat.name} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                      {isPostPioneer && (
                        <span
                          className="inline-flex items-center px-1.5 py-px rounded-md text-[9px] border bg-amber-50 text-amber-700 border-amber-200"
                          style={{ fontWeight: 600, letterSpacing: "0.04em" }}
                          title="Available after the Pioneer billing integration ships. Values shown are stubbed."
                        >
                          Post-Pioneer
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.kpis.map((k) => {
                        const isActive = !hiddenKpis.has(k.key);
                        const computed = KPI_TILE_DATA[k.key](group, stats);
                        return (
                          <button
                            key={k.key}
                            onClick={() => onToggleKpi(k.key)}
                            className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-[11px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`}
                                style={{ fontWeight: 500 }}
                                title={k.label}
                              >
                                {k.label}
                              </span>
                              <div className="shrink-0">
                                {isActive
                                  ? <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
                                  : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                              </div>
                            </div>
                            <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>
                              {computed.value}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {widgetsFiltered.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-[12px]">No widgets match "{searchQuery}"</p>
                </div>
              )}
              {/* Group widgets by category — same chrome as the Partner Detail panel. */}
              {(() => {
                const cats = Array.from(new Set(widgetsFiltered.map((w) => w.category)));
                return cats.map((cat) => {
                  const inCat = widgetsFiltered.filter((w) => w.category === cat);
                  const CatIcon = cat === "Performance" ? TrendingUp
                    : cat === "Composition" ? PieIcon
                    : cat === "Configuration" ? Settings2
                    : Sliders;
                  return (
                    <div key={cat} className="mt-5 first:mt-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CatIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {inCat.map((w) => {
                          const isActive = !hiddenWidgets.has(w.key);
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
                              {/* Mini-preview canvas */}
                              <div className={`h-[68px] flex items-center justify-center transition-colors ${isActive ? "bg-[#F8FAFF]" : "bg-slate-50"}`}>
                                <PgWidgetVisual type={w.type} isActive={isActive} />
                              </div>
                              {/* Toggle indicator — top-right corner */}
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
                              {/* Label + description + size row */}
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
                                        {({ sm: "SM", md: "MD", lg: "LG" } as const)[s]}
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
                });
              })()}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function DonutChart({ data, total, centerLabel, size = "md" }: { data: { name: string; value: number; color: string }[]; total: number; centerLabel: string; size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? 140 : size === "lg" ? 240 : 200;
  const inner = size === "sm" ? 40 : size === "lg" ? 70 : 55;
  const outer = size === "sm" ? 58 : size === "lg" ? 100 : 80;
  const totalFont = size === "sm" ? "text-[16px]" : size === "lg" ? "text-[24px]" : "text-[20px]";
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={inner} outerRadius={outer} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <ReTooltip contentStyle={{ borderRadius: 8, border: "1px solid rgb(var(--border))", fontSize: 12, padding: "6px 10px" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 0 }}>
        <span className={`${totalFont} text-foreground`} style={{ fontWeight: 700 }}>{total.toLocaleString()}</span>
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{centerLabel}</span>
      </div>
      {size !== "sm" && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-[11px] text-slate-500">{d.name}</span>
              <span className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigurationCoverageBody({ group, scope, size = "md" }: { group: PartnerGroupTemplateSummary; scope: "vendor" | "customer"; size?: "sm" | "md" | "lg" }) {
  // Section list mirrors the Configuration tab's group-level sections
  // (GROUP_VENDOR/CUSTOMER_CONFIG_SECTIONS) — every section is always
  // listed with a Set / Not set pill, so the card never collapses to
  // an empty 0/0 state. The vendor side additionally carries the
  // Carrier profile's shipping methods (v1's second enable-able
  // vendor profile).
  const { getGroup } = usePartnerGroups();
  const configData = getGroup(group.id)?.configData ?? {};
  // The config store keys are shared across scopes today
  // (configBillingType, configShipping, …) so both cards read the same
  // flags — they diverge per side once the API scopes the payload.
  const hasBilling = Boolean(configData.configBillingType);
  const hasShipping = ((configData.configShipping as { vendorPreferences?: unknown[] } | undefined)?.vendorPreferences?.length ?? 0) > 0;
  const hasCarrierMethods = ((configData.configCustomMethods as { self?: unknown[] } | undefined)?.self?.length ?? 0) > 0;

  const items = [
    { key: "billing",  label: "Billing & Shipping",                                                                                                        set: hasBilling,           icon: MapPin,     color: "#0369A1" },
    { key: "credit",   label: "Credit Limit",                                                                                                              set: group.hasCreditConfig, icon: CreditCard, color: "#B45309" },
    { key: "terms",    label: group.hasPaymentTerms && group.paymentTermLabel ? `Payment Terms · ${group.paymentTermLabel}` : "Payment Terms",             set: group.hasPaymentTerms, icon: Receipt,    color: "#0891B2" },
    { key: "pricing",  label: group.hasPricingRules ? `Pricing Rules · ${group.pricingRuleCount} ${group.pricingRuleCount === 1 ? "rule" : "rules"}` : "Pricing Rules", set: group.hasPricingRules, icon: Tag, color: "#4F46E5" },
    { key: "freight",  label: "Freight & Logistics",                                                                                                       set: hasShipping,          icon: Ship,       color: "#059669" },
    ...(scope === "vendor"
      ? [{ key: "carrier", label: "Carrier Profile", set: hasCarrierMethods, icon: Truck, color: "#9333EA" }]
      : []),
  ];
  const setCount = items.filter((i) => i.set).length;
  // Progress accent follows the scope palette — blue for vendor,
  // violet for customer (same pairing as the Type pills / breakdown).
  const accent = scope === "vendor" ? "#0A77FF" : "#8B5CF6";
  // sm only shows the headline + bar; md/lg show items grid (md = 2 cols, lg = 3 cols)
  const visibleItems = size === "sm" ? items.slice(0, 4) : items;
  const gridCols = size === "lg" ? "md:grid-cols-3" : "md:grid-cols-2";
  const headlineSize = size === "sm" ? "text-[18px]" : size === "lg" ? "text-[28px]" : "text-[24px]";
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className={`${headlineSize} text-foreground`} style={{ fontWeight: 700 }}>{setCount}<span className="text-[14px] text-slate-400" style={{ fontWeight: 500 }}>/{items.length}</span></div>
        <div className="flex-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(setCount / items.length) * 100}%`, backgroundColor: accent }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{Math.round((setCount / items.length) * 100)}% of {scope} templated settings configured</p>
        </div>
      </div>
      {size !== "sm" && (
        <div className={`grid grid-cols-1 ${gridCols} gap-2`}>
          {visibleItems.map((it) => (
            <div key={it.key} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md border ${it.set ? "border-emerald-100 bg-emerald-50/40" : "border-border bg-slate-50/60"}`}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${it.color}15`, color: it.color }}>
                <it.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[12px] text-slate-700 truncate min-w-0 flex-1" style={{ fontWeight: 500 }}>{it.label}</span>
              <span className={`ml-auto shrink-0 whitespace-nowrap text-[10px] inline-flex items-center gap-1 px-1.5 py-px rounded-full border ${it.set ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : "bg-muted text-muted-foreground border-slate-200"}`} style={{ fontWeight: 600 }}>
                {it.set ? <><Check className="w-2.5 h-2.5" /> Set</> : "Not Set"}
              </span>
            </div>
          ))}
        </div>
      )}
      {size === "sm" && (
        <div className="grid grid-cols-2 gap-1.5">
          {items.slice(0, 4).map((it) => (
            <div key={it.key} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${it.set ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="text-[10px] text-slate-600 truncate">{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GroupInformationCard({ group }: { group: PartnerGroupTemplateSummary }) {
  const scopes = group.templateType === "both" ? ["vendor", "customer"] : [group.templateType];
  return (
    <CollapsibleSidebarCard title="Group Information" icon={Building2} storageKey="pg-info">
      {/* Description — full width header block, mirrors Partner Information's "Partner Group" section */}
      {group.description && (
        <div className="mb-3">
          <PgInfoLabel>Description</PgInfoLabel>
          <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-3" style={{ fontWeight: 500 }}>{group.description}</p>
        </div>
      )}

      {/* Type pills — full width row, same shape as Partner Detail's "Partner Type" */}
      <div className="mb-3">
        <PgInfoLabel>Type</PgInfoLabel>
        <div className="flex items-center flex-wrap gap-1.5 mt-1">
          {scopes.map((s) => (
            <span
              key={s}
              className="text-[11px] px-2.5 py-1 rounded-md border"
              style={{
                fontWeight: 500,
                backgroundColor: s === "vendor" ? "#EBF3FF" : "#F5F3FF",
                color: s === "vendor" ? "#0548A3" : "#5B21B6",
                borderColor: s === "vendor" ? "#A8D2FF" : "#DDD6FE",
              }}
            >
              {s === "vendor" ? "Vendor" : "Customer"}
            </span>
          ))}
        </div>
      </div>

      {/* 2-col grid — Status / Region / Partners Linked */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
        <div className="min-w-0">
          <PgInfoLabel>Status</PgInfoLabel>
          {/* Same status pill as the Partner Groups listing table —
              tri-state Active / Inactive / Archived palette. */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border mt-0.5"
            style={{
              fontWeight: 500,
              backgroundColor: group.status === "Active" ? "#ECFDF5" : group.status === "Archived" ? "#FEF2F2" : "#FFFBEB",
              color: group.status === "Active" ? "#065F46" : group.status === "Archived" ? "#991B1B" : "#92400E",
              borderColor: group.status === "Active" ? "#A7F3D0" : group.status === "Archived" ? "#FECACA" : "#FDE68A",
            }}
          >
            {group.status}
          </span>
        </div>
        <div className="min-w-0">
          <PgInfoLabel>Region</PgInfoLabel>
          <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
            {group.countryFlag ? <span className="mr-1"><FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /></span> : null}{group.country || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <PgInfoLabel>Partners Linked</PgInfoLabel>
          <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{group.partnerCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Footer separator + 2-col Created On / Template */}
      <div className="grid grid-cols-2 gap-x-4 pt-2.5 border-t border-muted">
        <div className="min-w-0">
          <PgInfoLabel>Created On</PgInfoLabel>
          <p className="text-[12px] text-slate-700 truncate mt-0.5" style={{ fontWeight: 500 }}>{group.createdOn}</p>
        </div>
        <div className="min-w-0">
          <PgInfoLabel>Template</PgInfoLabel>
          <p className="text-[12px] text-slate-700 truncate mt-0.5" style={{ fontWeight: 500 }}>{TYPE_PALETTE[group.templateType].label}</p>
        </div>
      </div>
    </CollapsibleSidebarCard>
  );
}

function PgInfoLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>{children}</p>;
}

function CollapsibleSidebarCard({
  title,
  icon: Icon,
  storageKey,
  children,
}: {
  title: string;
  icon: React.ElementType;
  storageKey: string;
  children: React.ReactNode;
}) {
  const key = `pg-sidebar-collapsed:${storageKey}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  return (
    <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50/60 transition-colors cursor-pointer relative"
      >
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
        <span
          className="ml-auto text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
        {/* Header bottom border — fades with the body so collapsed state has no orphan line. */}
        <span
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-px bg-muted transition-opacity duration-300 ease-out"
          style={{ opacity: collapsed ? 0 : 1 }}
        />
      </button>
      {/* Smooth height/opacity reveal using the grid-template-rows trick.
          Collapsed: rows = 0fr (no content height). Expanded: rows = 1fr (auto). */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className="p-4 transition-opacity duration-200 ease-out"
            style={{
              opacity: collapsed ? 0 : 1,
              transitionDelay: collapsed ? "0ms" : "120ms",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateSummaryCard({ group }: { group: PartnerGroupTemplateSummary }) {
  const chips: { label: string; tone: { bg: string; fg: string; border: string }; icon: React.ElementType; show: boolean }[] = [
    { label: `${group.pricingRuleCount} Pricing ${group.pricingRuleCount === 1 ? "Rule" : "Rules"}`, tone: { bg: "#EEF2FF", fg: "#4F46E5", border: "#E0E7FF" }, icon: Tag,         show: group.hasPricingRules },
    { label: group.paymentTermLabel || "Net 30",                                                       tone: { bg: "#ECFEFF", fg: "#0891B2", border: "#CFFAFE" }, icon: Receipt,     show: group.hasPaymentTerms },
    { label: "Credit Policy Set",                                                                       tone: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" }, icon: CreditCard,  show: group.hasCreditConfig },
    { label: "Payment Methods Set",                                                                     tone: { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" }, icon: Wallet,      show: true },
    { label: "GL Accounts Pending",                                                                     tone: { bg: "rgb(var(--muted))", fg: "rgb(var(--muted-foreground))", border: "rgb(var(--border))" }, icon: Settings2, show: true },
  ];
  return (
    <CollapsibleSidebarCard title="Template Summary" icon={Settings2} storageKey="pg-template">
      <div className="flex flex-wrap gap-1.5">
        {chips.filter((c) => c.show).map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] whitespace-nowrap"
            style={{ fontWeight: 500, backgroundColor: c.tone.bg, color: c.tone.fg, borderColor: c.tone.border }}
          >
            <c.icon className="w-3 h-3 shrink-0" />
            {c.label}
          </span>
        ))}
      </div>
      <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Switch to the Configuration tab to edit templated settings."); }} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-3">
        Open configuration <ExternalLink className="w-3 h-3" />
      </a>
    </CollapsibleSidebarCard>
  );
}

/* ─── PlaceholderTab — canonical Coming Soon empty state ────────────
 *
 * Mirrors the partner-detail PlaceholderTab exactly: animated icon
 * chip (slow ping ring + 4s gentle float), "Coming Soon" pulse-dot
 * pill, label, description. Used on the Communications / Notes /
 * Recent Activity tabs while the real backends ship at the partner
 * level first. */
function PlaceholderTab({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description: string;
  icon?: React.ElementType;
}) {
  const DisplayIcon = Icon || FileText;
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: "3s" }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: "pgcsFloat 4s ease-in-out infinite" }}
          >
            <DisplayIcon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: "pgcsFade 0.5s ease-out both", animationDelay: "0.1s" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: "pgcsFade 0.5s ease-out both", animationDelay: "0.2s" }}
        >
          {label}
        </h3>
        <p
          className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
          style={{ animation: "pgcsFade 0.5s ease-out both", animationDelay: "0.3s" }}
        >
          {description}
        </p>
      </div>
      <style>{`
        @keyframes pgcsFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes pgcsFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function RecentActivitySidebarCard() {
  return (
    <CollapsibleSidebarCard title="Recent Activity" icon={Activity} storageKey="pg-activity">
      <ActivityFeed items={DUMMY_ACTIVITY.slice(0, 3)} />
    </CollapsibleSidebarCard>
  );
}

/** A group total, in the base currency (its partners trade in different ones). */
function formatCurrency(n: number): string {
  return formatCompactMoney(n, BASE_CURRENCY);
}

/* ─── Communications tab — internal channel for the group ───────────
 *
 * Phase 3 minimum: a chat-style scaffold matching the rest of the
 * system's internal-chat surfaces. Backend integration comes later;
 * the seed messages let stakeholders see the layout without typing
 * lorem ipsum into every demo.
 */
function CommunicationsTab({ groupName }: { groupName: string }) {
  const [draft, setDraft] = useState("");
  type ChatMsg = { id: string; author: string; initials: string; tint: { bg: string; fg: string }; date: string; text: string; isMe?: boolean };
  const seedMessages: ChatMsg[] = [
    { id: "m1", author: "Sarah Johnson", initials: "SJ", tint: { bg: "#EBF3FF", fg: "#094D9F" }, date: "Mar 28 · 2:45 PM", text: `Heads up, pricing rule defaults for ${groupName} were updated this morning. New partners will pick up the change automatically.` },
    { id: "m2", author: "Michael Torres", initials: "MT", tint: { bg: "#F5F3FF", fg: "#5B21B6" }, date: "Mar 28 · 3:02 PM", text: "Got it. I'll loop the AP team in once we route the next batch of POs through." },
    { id: "m3", author: "Emily Chen", initials: "EC", tint: { bg: "#ECFDF5", fg: "#047857" }, date: "Mar 25 · 11:30 AM", text: "Reminder: Net 30 is the only payment term flagged on this group right now. Anything else needs to be set per partner." },
  ];
  return (
    <div className="flex flex-col h-[480px]">
      {/* Channel header */}
      <div className="px-1 pb-3 border-b border-muted shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
            <MessageSquare className="w-3.5 h-3.5" />
          </span>
          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>#{groupName.toLowerCase().replace(/\s+/g, "-")}</p>
          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Internal · {seedMessages.length} messages</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Internal-only thread for this group. Use it to coordinate template changes, flag partner exceptions, or hand off ownership, visible to anyone with access to {groupName}.
        </p>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {seedMessages.map((m) => (
          <div key={m.id} className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0" style={{ backgroundColor: m.tint.bg, color: m.tint.fg, fontWeight: 700 }}>
              {m.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{m.author}</p>
                <span className="text-[10px] text-slate-400">{m.date}</span>
              </div>
              <p className="text-[12px] text-foreground/90 mt-0.5 leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Composer */}
      <div className="shrink-0 border-t border-muted pt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message #${groupName.toLowerCase().replace(/\s+/g, "-")}...`}
            rows={2}
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-[12px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!draft.trim()) return;
              toast.success("Message sent");
              setDraft("");
            }}
            disabled={!draft.trim()}
            className="h-9 px-3.5 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
