import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlagImage, flagEmojiCode } from "../currency/FlagImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import {
  ArrowLeft,
  X,
  Pencil,
  Archive,
  Maximize2,
  Minimize2,
  Users,
  FileText,
  Paperclip,
  Clock,
  MessageSquare,
  Activity,
  Plus,
  Link2,
  Unlink2,
  Search,
  SlidersHorizontal,
  Check,
  Lock,
  Copy,
  Tag,
  Receipt,
  CircleSlash,
  Settings2,
  CreditCard,
  Truck as TruckIcon,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  AlignJustify,
  List,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Info,
  MapPin,
  Building2,
  Star,
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { OverflowTooltip } from "./OverflowTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { PrimaryPill } from "./PrimaryPill";
import { QuickViewPanel, mockLocationData, type QuickViewData } from "./QuickViewPanel";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { getAvatarTint } from "../../utils/avatarTints";
import { useVendors } from "../../context/VendorContext";
import { usePartnerGroups } from "../../context/PartnerGroupsContext";
import { STATUS_LABELS, type Vendor } from "../../data/vendors";
import { GroupBulkApplyModal, type GroupBulkApplyChange } from "./GroupBulkApplyModal";
import { diffConfigData, type ConfigChangeItem } from "./configDiff";
import { getGroupBulkApplyTier } from "./groupBulkApplyTiers";
import { AttachmentsTab, type AttachmentFile } from "./AttachmentsTab";
import {
  VENDOR_SUB_TYPES,
  CUSTOMER_SUB_TYPES,
  GROUP_VENDOR_CONFIG_SECTIONS,
  GROUP_CUSTOMER_CONFIG_SECTIONS,
  PARTNER_GROUPS,
  type ConfigSection,
} from "./partnerConstants";
import { ConfigPageContent, GroupMembersStep, isPartnerPrimaryLockedToGroup } from "./CreatePartnerGroupModal";
import { UnlinkPartnerDialog } from "./UnlinkPartnerDialog";
import { TableEmptyState, resolveTableEmptyKind, useTableLoadState, type TableEmptyStateProps } from "../ui/table-empty-state";
import { Skeleton } from "../ui/skeleton";
import { findSearchSuggestion } from "../../utils/searchSuggestion";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  createBlankFilter,
  isFilterActive,
  applyFilters,
  sortRows,
  getUniqueColumnValues,
  vendorCellValue,
  type CellAccessor,
  type ColumnFilterState,
  type FilterType,
  type SortConfig,
} from "./ColumnHeaderMenu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

/* ─── Types shared with PartnerGroupsPage ─── */
type TemplateType = "vendor" | "customer" | "both";
type GroupStatus = "Active" | "Inactive";

export interface PartnerGroupTemplateSummary {
  id: string;
  name: string;
  description: string;
  /** Country is an inherited flag, kept for back-compat. Prefer `region` going forward. */
  country: string;
  countryFlag: string;
  /**
   * Optional locational hint. Country / state / regional label — broader than
   * country alone, which Eli explicitly said should not drive grouping.
   */
  region?: { country?: string; state?: string; regionLabel?: string };
  partnerCount: number;
  templateType: TemplateType;
  status: GroupStatus;
  createdOn: string;
  code: string;
  hasPricingRules: boolean;
  pricingRuleCount: number;
  hasPaymentTerms: boolean;
  paymentTermLabel: string | null;
  hasCreditConfig: boolean;
}

interface PartnerGroupDetailModalProps {
  group: PartnerGroupTemplateSummary | null;
  open: boolean;
  onClose: () => void;
  mode?: "view" | "create";
  onDuplicate?: (g: PartnerGroupTemplateSummary) => void;
  onApply?: (g: PartnerGroupTemplateSummary) => void;
  onEdit?: (g: PartnerGroupTemplateSummary) => void;
  onArchive?: (g: PartnerGroupTemplateSummary) => void;
  onDisable?: (g: PartnerGroupTemplateSummary) => void;
  /** Pass the pricing-rule bulk-apply confirmation handler here from the page. */
  onPricingRuleSaveRequest?: (g: PartnerGroupTemplateSummary) => void;
}

/* ─── Config ─── */
export const TYPE_PALETTE: Record<TemplateType, { bg: string; fg: string; border: string; label: string }> = {
  vendor: { bg: "#EBF3FF", fg: "#0548A3", border: "#A8D2FF", label: "Vendor" },
  customer: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE", label: "Customer" },
  both: { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A", label: "Vendor & Customer" },
};

const DETAIL_TABS = [
  { id: "setup", label: "Setup", icon: Settings2 },
  { id: "partners", label: "Partners", icon: Users },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Recent Activity", icon: Clock },
] as const;

type TabId = (typeof DETAIL_TABS)[number]["id"];

type ScopeFilter = "all" | "vendor" | "customer" | "both";

const DUMMY_NOTES = [
  { id: "n1", author: "Sarah Johnson", initials: "SJ", color: "rgb(var(--primary))", date: "Mar 28, 2026", text: "Approved pricing rule updates for all partners in this group." },
  { id: "n2", author: "Michael Torres", initials: "MT", color: "rgb(var(--violet))", date: "Mar 22, 2026", text: "Added Net 30 as the default payment term for onboarding." },
];

const DUMMY_ATTACHMENTS: AttachmentFile[] = [
  { id: "a1", name: "Group_Configuration_v2.pdf", size: "198 KB", type: "pdf", date: "2026-03-26T09:00:00Z", uploadedBy: "Sarah Johnson" },
  { id: "a2", name: "Onboarding_Checklist.xlsx", size: "74 KB", type: "xlsx", date: "2026-03-20T11:30:00Z", uploadedBy: "Michael Torres" },
];

const DUMMY_ACTIVITY = [
  { id: "act1", action: "pricing rule applied", target: "Bulk Fastener Discount", user: "Sarah Johnson", date: "Mar 28, 2026 · 2:45 PM", type: "apply" },
  { id: "act2", action: "template updated", target: "Payment term changed to Net 30", user: "Michael Torres", date: "Mar 25, 2026 · 11:30 AM", type: "edit" },
  { id: "act3", action: "partner linked", target: "Toyota International", user: "Emily Chen", date: "Mar 20, 2026 · 9:15 AM", type: "link" },
  { id: "act4", action: "group created", target: "", user: "Omnesoft", date: "Feb 14, 2026 · 4:00 PM", type: "create" },
];

/* ─── Helpers ─── */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getInitials(name: string): string {
  return name.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ─── Lightweight ContentCard chrome — visually matches the Partner Details
   page's ContentCard so Notes / Recent Activity tabs read consistently across
   modals. Stripped of the drag/sizing affordances since modal tabs don't need
   them; everything else (border, shadow, header strip with rounded icon
   chip, title, optional count) is identical. */
export function ModalContentCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-muted flex items-center gap-2">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
        {typeof count === "number" && (
          <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full ml-1" style={{ fontWeight: 500 }}>{count}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── Shared Activity feed renderer ───
   Renders a Dribbble-style activity log:
     [icon-circle] | Date · Time
                   | <strong>User</strong> verb <link>target</link>
   A thin gray rail connects the icon-circles vertically. Used by every
   detail modal's Recent Activity tab + the Partner detail page so the
   Recent Activity story reads identically everywhere. */
export type ActivityFeedItemType = "create" | "edit" | "link" | "apply" | "delete" | "info";
export interface ActivityFeedItem {
  id: string;
  type: ActivityFeedItemType;
  /** Person who triggered the activity. Rendered bold inline. */
  user: string;
  /** Lower-case verb phrase, e.g. "applied pricing rule", "updated payment term". */
  verb: string;
  /** Optional target object — displayed as a primary-colored "link" tone. */
  target?: string;
  /** Human-readable date / timestamp string. */
  date: string;
}

function activityIconFor(type: ActivityFeedItemType): { Icon: React.ElementType; color: string } {
  switch (type) {
    case "create": return { Icon: Plus, color: "rgb(var(--success))" };
    case "edit":   return { Icon: Pencil, color: "rgb(var(--primary))" };
    case "link":   return { Icon: Link2, color: "rgb(var(--violet))" };
    case "apply":  return { Icon: Activity, color: "rgb(var(--warning))" };
    case "delete": return { Icon: X, color: "rgb(var(--destructive))" };
    default:       return { Icon: Clock, color: "rgb(var(--muted-foreground))" };
  }
}

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-[12px] text-slate-400">No activity yet.</div>
    );
  }
  return (
    <div className="relative">
      {/* Rail — sits behind the circles */}
      {items.length > 1 && (
        <div
          className="absolute left-[15px] top-3 bottom-3 w-px bg-muted"
          aria-hidden
        />
      )}
      <ul className="relative space-y-3.5">
        {items.map((item) => {
          const { Icon, color } = activityIconFor(item.type);
          return (
            <li key={item.id} className="flex items-start gap-3 relative">
              <div
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10 border border-border bg-white"
                style={{ color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10px] text-slate-400 leading-tight">{item.date}</p>
                <p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed">
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{item.user}</span>
                  <span className="text-slate-500"> {item.verb}</span>
                  {item.target && (
                    <>
                      {" "}
                      <span className="text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>{item.target}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── Main component ─── */
export function PartnerGroupDetailModal({
  group,
  open,
  onClose,
  mode = "view",
  onDuplicate,
  onApply,
  onEdit,
  onArchive,
  onDisable,
  onPricingRuleSaveRequest,
}: PartnerGroupDetailModalProps) {
  const [tab, setTab] = useState<TabId>("setup");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { vendors } = useVendors();

  // Linked-partner sample is computed once at the top level so both the
  // Setup tab (for in-flight detection in the bulk-apply modal) and the
  // Partners tab (for the visible table) read from the same list.
  const linkedPartners = useMemo(() => {
    if (!group) return [] as Vendor[];
    const h = hashString(group.id);
    const copy = [...vendors];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(vendors.length, group.partnerCount));
  }, [vendors, group]);

  if (!group) return null;

  const typePalette = TYPE_PALETTE[group.templateType];
  const isTemplate = !group.id.startsWith("PG-custom-");
  const creatorInitials = "OS";

  // Detail-modal sizing standard — see PaymentTermDetailModal for rationale.
  // Stable frame across tabs, width capped at 1480px, min 640px height.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullscreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(80vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) { onClose(); setIsFullscreen(false); setTab("setup"); }
      }}
    >
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[220] ${modalSizeClass}`}
        hideCloseButton
        overlayClassName="z-[215]"
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Partner Group, {group.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of partner group {group.name}</DialogDescription>

        {/* ─── Header ─── */}
        <div data-page-topbar className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
          <div className="px-4 sm:px-5 pt-3 pb-3">
            <div className="flex items-start gap-3">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {/* Themed avatar */}
              <div
                className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                style={{ backgroundColor: typePalette.bg, border: `1px solid ${typePalette.border}` }}
              >
                <Users className="w-5 h-5" style={{ color: typePalette.fg }} />
                <span className="text-[10px] leading-none" style={{ color: typePalette.fg, fontWeight: 700 }}>
                  {group.partnerCount.toLocaleString()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{group.name}</h1>
                  {/* Template type pill */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full border"
                    style={{ fontWeight: 600, backgroundColor: typePalette.bg, color: typePalette.fg, borderColor: typePalette.border }}
                  >
                    {typePalette.label}
                  </span>
                  {/* Status */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border"
                    style={{
                      fontWeight: 500,
                      backgroundColor: group.status === "Active" ? "#ECFDF5" : "#FFFBEB",
                      color: group.status === "Active" ? "#065F46" : "#92400E",
                      borderColor: group.status === "Active" ? "#A7F3D0" : "#FDE68A",
                    }}
                  >
                    {group.status}
                  </span>
                  {/* Template / Custom */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isTemplate ? "bg-muted border-slate-300 text-slate-500" : "border-slate-300 bg-white text-slate-500"}`} style={{ fontWeight: 600 }}>
                    {isTemplate ? <><Lock className="w-2.5 h-2.5" /> Template</> : "Custom"}
                  </span>
                  {/* Partners using */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-border" style={{ fontWeight: 500 }}>
                    <Users className="w-3 h-3" /> {group.partnerCount} {group.partnerCount === 1 ? "Partner" : "Partners"} Linked
                  </span>
                </div>
                {group.description && (
                  <p className="text-[12px] text-slate-500 mt-2 leading-relaxed line-clamp-2">{group.description}</p>
                )}
              </div>
              {/* Right-side actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { if (onEdit) onEdit(group); else toast.info("Edit, coming soon"); }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { if (onArchive) onArchive(group); else toast.info("Archive, coming soon"); }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  onClick={() => { if (onDisable) onDisable(group); else toast.info("Disable, coming soon"); }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <CircleSlash className="w-3.5 h-3.5" /> Disable
                </button>
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { onClose(); setIsFullscreen(false); setTab("setup"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom row — template summary chips + meta */}
            <div className="flex items-center justify-between gap-4 mt-3 pl-[44px]">
              <div className="flex items-center flex-wrap gap-2 min-w-0">
                {group.hasPricingRules && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E0E7FF] bg-[#EEF2FF] text-[11px]" style={{ fontWeight: 500, color: "#4F46E5" }}>
                    <Tag className="w-3 h-3" />
                    {group.pricingRuleCount} {group.pricingRuleCount === 1 ? "Pricing Rule" : "Pricing Rules"}
                  </span>
                )}
                {group.paymentTermLabel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#CFFAFE] bg-[#ECFEFF] text-[11px]" style={{ fontWeight: 500, color: "#0891B2" }}>
                    <Receipt className="w-3 h-3" /> {group.paymentTermLabel}
                  </span>
                )}
                {group.hasCreditConfig && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-[11px]" style={{ fontWeight: 500, color: "#B45309" }}>
                    <CreditCard className="w-3 h-3" /> Credit Policy Set
                  </span>
                )}
                {!group.hasPricingRules && !group.paymentTermLabel && !group.hasCreditConfig && (
                  <span className="text-[11px] text-slate-400 italic">No template settings configured yet</span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[12px] text-slate-600 whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
                <span className="inline-flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-accent text-primary" style={{ fontWeight: 700 }}>
                    {creatorInitials}
                  </div>
                  <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>Omnesoft</span></span>
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>Created <span className="text-slate-700" style={{ fontWeight: 600 }}>{group.createdOn}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Body: full-width content ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Tabs */}
            <div data-page-topbar className="flex items-center border-b border-border shrink-0 px-1 bg-white">
              {DETAIL_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      active ? "border-primary text-primary font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Setup tab */}
            {tab === "setup" && (
              <SetupTab
                group={group}
                linkedPartners={linkedPartners}
                onPricingRuleSaveRequest={onPricingRuleSaveRequest}
              />
            )}

            {/* Partners tab */}
            {tab === "partners" && (
              <PartnersTab group={group} linkedPartners={linkedPartners} />
            )}

            {/* Notes — exact match for the Partner Details "Notes" card:
                a single ContentCard with each note rendered as a soft
                bg-[#FAFBFC] body. Author/date kept as a subtle footer line
                so the per-author data is preserved without breaking the
                clean Partner-Details look. */}
            {tab === "notes" && (
              <div className="flex-1 overflow-auto p-4">
                <ModalContentCard title="Notes" icon={MessageSquare} count={DUMMY_NOTES.length}>
                  <div className="space-y-2">
                    {DUMMY_NOTES.map((note) => (
                      <div key={note.id} className="rounded-md bg-[#FAFBFC] border border-muted p-3">
                        <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                        <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-muted/60">
                          <span className="text-slate-500" style={{ fontWeight: 500 }}>{note.author}</span> · {note.date}
                        </p>
                      </div>
                    ))}
                  </div>
                </ModalContentCard>
              </div>
            )}

            {/* Attachments — shared component matches Partner Detail page */}
            {tab === "attachments" && (
              <div className="flex-1 overflow-auto">
                <AttachmentsTab files={DUMMY_ATTACHMENTS} embedded />
              </div>
            )}

            {/* Activity — feed-style: circular icon + rail, date/time on top,
                person + verb + linked target underneath. Same pattern is used
                across all detail modals + the Partner detail page so
                Recent Activity reads identically everywhere. */}
            {tab === "activity" && (
              <div className="flex-1 overflow-auto p-4">
                <ModalContentCard title="Activity Timeline" icon={Activity}>
                  <ActivityFeed
                    items={DUMMY_ACTIVITY.map((act) => ({
                      id: act.id,
                      type: act.type as ActivityFeedItemType,
                      user: act.user,
                      verb: act.action,
                      target: act.target || undefined,
                      date: act.date,
                    }))}
                  />
                  <div className="pt-2.5 mt-3 border-t border-muted text-center">
                    <p className="text-[11px] text-slate-400">Full activity log will be available with backend integration</p>
                  </div>
                </ModalContentCard>
              </div>
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl">
          <div className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Reviewing: <span className="text-foreground" style={{ fontWeight: 600 }}>{group.name}</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (onDuplicate) { onDuplicate(group); onClose(); } else { toast.info("Duplicate, coming soon"); } }}
                className="h-8 px-3.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              {mode === "create" && (
                <button
                  onClick={() => { if (onApply) { onApply(group); onClose(); } }}
                  className="h-8 px-3.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  style={{ fontWeight: 500 }}
                >
                  <Check className="w-3.5 h-3.5" /> Use Template
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Setup tab — template configuration surface ───
 *
 * Each section's "Edit / Configure" button routes through GroupBulkApplyModal
 * with the tier from groupBulkApplyTiers.ts. Until inline editors are extracted
 * from CreatePartnerModal Step 3 (Phase 1 of the plan), the modal demonstrates
 * the canonical save path with a representative change object.
 */
type SetupSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  configured: boolean;
  summary: string;
  /** Demo change shown in the bulk-apply modal until the real inline editor is wired. */
  demoChange: GroupBulkApplyChange;
};

/** One-line summary text shown under each profile card name. Keeps the
 *  vocabulary consistent with the rest of the system. */
function profileSummary(id: string): string {
  switch (id) {
    case "vendor_rules": return "Default billing, payment, credit, terms, pricing, and freight for every partner in this group.";
    case "carrier": return "Default shipping methods for partners in this group that ship freight.";
    case "customer_rules": return "Default billing, payment, credit, terms, pricing, and freight applied to every customer in this group.";
    default: return "Profile-level configuration defaults.";
  }
}

/** Tiny metric line shown in the card footer. Falls back to gentle copy
 *  when the group's data model doesn't carry per-profile counts yet. */
function profileMetric(id: string, group: PartnerGroupTemplateSummary): string {
  if (id === "vendor_rules" || id === "customer_rules") {
    const bits: string[] = [];
    if (group.hasPaymentTerms) bits.push("payment terms");
    if (group.hasPricingRules) bits.push(`${group.pricingRuleCount} pricing rule${group.pricingRuleCount === 1 ? "" : "s"}`);
    if (group.hasCreditConfig) bits.push("credit policy");
    return bits.length > 0 ? bits.join(" · ") : "No defaults yet";
  }
  return "No defaults yet";
}

export function SetupTab({
  group,
  linkedPartners,
  onPricingRuleSaveRequest,
}: {
  group: PartnerGroupTemplateSummary;
  linkedPartners: Vendor[];
  onPricingRuleSaveRequest?: (g: PartnerGroupTemplateSummary) => void;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  // Phase 1: Vendor/Customer sub-tab + profile-card grid in front of the
  // existing per-section list. Drilling into a profile card opens a
  // configuration Dialog with a sidebar nav (Billing & Shipping,
  // Payment Methods, etc.) on the left and the active section's
  // detail on the right — same shape as the Configure Vendor flow in
  // CreatePartnerModal Step 3 so the two surfaces feel sibling.
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"vendor" | "customer">("vendor");
  // Sidebar selection inside the profile-config Dialog. Defaults to
  // billing_shipping when the dialog opens; tracked separately from
  // activeSectionId (which drives the GroupBulkApplyModal opening).
  const [dialogSectionId, setDialogSectionId] = useState<string>("billing_shipping");
  // Stash the form values ConfigPageContent writes into. Persists for
  // the lifetime of SetupTab so flipping between sections inside the
  // dialog doesn't lose data.
  const configDataRef = useRef<Record<string, unknown>>({});
  // Snapshot of the configData at the moment the per-profile dialog
  // opened. Compared against configDataRef.current at Save time to
  // build the "Changes you made" list shown in GroupBulkApplyModal.
  const configSnapshotRef = useRef<Record<string, unknown>>({});
  // The diff list captured when the user clicks Save Configuration —
  // surfaced inside GroupBulkApplyModal so the user can see exactly
  // what they changed before picking inherit-or-keep.
  const [pendingChangesList, setPendingChangesList] = useState<ConfigChangeItem[]>([]);

  // Pull the live store record so the dialog hydrates from whatever was
  // saved during creation (or the last edit) — and so Save persists
  // back to the same source via updateGroup.
  const { getGroup, updateGroup } = usePartnerGroups();
  const storeGroup = getGroup(group.id);

  // Sync configDataRef with the current group's configData BEFORE
  // ConfigPageContent mounts. ConfigPageContent's useState lazy
  // initializers read configDataRef.current on mount — if we did this
  // in a useEffect, the effect would fire after mount and the child
  // would see empty defaults. Doing it inline at render time makes
  // PG-1-1's showcase data (Net 30, pricing rules, payment methods,
  // credit limit, carrier services) appear immediately for every
  // profile, including Carrier. Also captures the snapshot so the
  // change diff at Save time has a stable baseline.
  if (activeProfileId && storeGroup?.configData) {
    configDataRef.current = { ...storeGroup.configData };
    configSnapshotRef.current = { ...storeGroup.configData };
  } else if (!activeProfileId) {
    configDataRef.current = {};
    configSnapshotRef.current = {};
  }

  const sections: SetupSection[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <Info className="w-4 h-4" />,
      configured: true,
      summary: `${group.name} · ${TYPE_PALETTE[group.templateType].label} template`,
      demoChange: { settingLabel: "Group Description", previousValue: "—", nextValue: "Updated description" },
    },
    {
      id: "payment_terms",
      label: "Payment Terms",
      icon: <Receipt className="w-4 h-4" />,
      configured: group.hasPaymentTerms,
      summary: group.paymentTermLabel ? `Default term: ${group.paymentTermLabel}` : "No payment term set, partners will pick their own.",
      demoChange: { settingLabel: "Default Payment Term", previousValue: group.paymentTermLabel || "Not Set", nextValue: "Net 30" },
    },
    {
      id: "pricing_rules",
      label: "Pricing Rules",
      icon: <Tag className="w-4 h-4" />,
      configured: group.hasPricingRules,
      summary: group.hasPricingRules
        ? `${group.pricingRuleCount} ${group.pricingRuleCount === 1 ? "rule" : "rules"} applied by default.`
        : "No pricing rules, partners will not inherit any discounts or premiums.",
      demoChange: {
        settingLabel: "Pricing Rules",
        previousValue: group.hasPricingRules ? `${group.pricingRuleCount} rules` : "None",
        nextValue: `${group.pricingRuleCount + 1} rules`,
      },
    },
    {
      id: "credit",
      label: "Credit Policy",
      icon: <CreditCard className="w-4 h-4" />,
      configured: group.hasCreditConfig,
      summary: group.hasCreditConfig
        ? "Credit limit + enforcement level set as template defaults."
        : "No credit policy, partners inherit account-level defaults.",
      demoChange: { settingLabel: "Credit Policy", previousValue: group.hasCreditConfig ? "Set" : "Not Set", nextValue: "Updated policy" },
    },
    {
      id: "shipping",
      label: "Shipping Preferences",
      icon: <TruckIcon className="w-4 h-4" />,
      configured: false,
      summary: "No shipping rules, partners will define their own carriers.",
      demoChange: { settingLabel: "Shipping Preferences", previousValue: "None", nextValue: "Default carrier set" },
    },
    {
      id: "items",
      label: "Items",
      icon: <Package className="w-4 h-4" />,
      configured: false,
      summary: "No catalog items linked by default.",
      demoChange: { settingLabel: "Linked Items", previousValue: "0 items", nextValue: "1+ items" },
    },
    {
      id: "categories",
      label: "Categories",
      icon: <Layers className="w-4 h-4" />,
      configured: false,
      summary: "No item categories linked by default.",
      demoChange: { settingLabel: "Linked Categories", previousValue: "0 categories", nextValue: "1+ categories" },
    },
    {
      id: "gl",
      label: "GL Accounts",
      icon: <Settings2 className="w-4 h-4" />,
      configured: false,
      summary: "Mapping is being designed in a separate workstream (Ashma's GL discovery). Once it lands, this becomes 3 to 4 account pickers that decide where transactions for partners in this group route.",
      demoChange: { settingLabel: "GL Accounts", previousValue: "—", nextValue: "—" },
    },
  ];

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;
  const activeTier = activeSection ? getGroupBulkApplyTier(activeSection.id) : "template-only";
  // Profile-level save (whole config dialog) routes through GroupBulkApplyModal
  // too — activeSectionId holds the synthetic id "profile_save:<profileId>".
  const profileSaveId = activeSectionId?.startsWith("profile_save:") ? activeSectionId.slice("profile_save:".length) : null;
  const profileSaveProfile = profileSaveId
    ? [...VENDOR_SUB_TYPES, ...CUSTOMER_SUB_TYPES].find((p) => p.id === profileSaveId) ?? null
    : null;
  const effectiveChange: GroupBulkApplyChange | null = activeSection?.demoChange
    ?? (profileSaveProfile
      ? {
          settingLabel: `${profileSaveProfile.label} configuration`,
          previousValue: undefined,
          nextValue: undefined,
          // Hand the diff list captured on click so the push-prompt
          // renders the "Changes you made" panel with a count badge.
          changes: pendingChangesList.length > 0 ? pendingChangesList : undefined,
        }
      : null);
  const effectiveLabel = activeSection?.label ?? (profileSaveProfile ? `${profileSaveProfile.label} configuration` : "Configuration");

  const handleConfigure = (s: SetupSection) => {
    const tier = getGroupBulkApplyTier(s.id);
    if (tier === "pending") {
      toast.info("GL Accounts editor — pending Ashma's discovery");
      return;
    }
    // Pricing Rules has a dedicated handler from the parent for the demo flow.
    if (s.id === "pricing_rules" && onPricingRuleSaveRequest) {
      onPricingRuleSaveRequest(group);
      return;
    }
    setActiveSectionId(s.id);
  };

  // ── Profile-card-grid view (Phase 1 entry point). Mirrors the User
  //    Access permission-card layout. Drilling into a card flips
  //    activeProfileId; the legacy section list renders as the
  //    "detail" view with a back link.
  const groupHasVendorScope = group.templateType === "vendor" || group.templateType === "both";
  const groupHasCustomerScope = group.templateType === "customer" || group.templateType === "both";
  // If the group is single-scope, force the relevant sub-tab so the
  // user never sees an empty Vendor tab on a customer-only group.
  const effectiveSubTab: "vendor" | "customer" = !groupHasVendorScope
    ? "customer"
    : !groupHasCustomerScope
      ? "vendor"
      : activeSubTab;
  const profilesForActiveSubTab = effectiveSubTab === "vendor" ? VENDOR_SUB_TYPES : CUSTOMER_SUB_TYPES;
  const activeProfile = activeProfileId
    ? [...VENDOR_SUB_TYPES, ...CUSTOMER_SUB_TYPES].find((p) => p.id === activeProfileId) ?? null
    : null;

  // Heuristic for "is this profile configured already?" — only the v1
  // profiles (Vendor Rules, Carrier on the vendor side, Buyer on the
  // customer side) actually carry settings today. Comparable to the
  // existing per-section configured flags.
  const profileIsConfigured = (id: string): boolean => {
    if (id === "vendor_rules" || id === "customer_rules") return group.hasPaymentTerms || group.hasPricingRules || group.hasCreditConfig;
    if (id === "carrier") return false;
    return false;
  };

  return (
    <div className="flex-1 overflow-auto px-4 pt-3 pb-4">
      {/* ── Grid view: sub-tab strip + profile cards (always shown).
          Drilling into a card opens a Dialog modal below — the section
          list is no longer rendered in-place. The page-level "these
          settings seed every partner..." preamble was removed per
          stakeholder ask — the same explanation is now surfaced
          on-demand via the sub-tab tooltip pattern (mirrors the
          Items They Sell / Items They Buy helper bubbles).
          Vertical rhythm: top padding (pt-3) + intra-section gap (mb-2.5
          on the strip) matches the Linked Partners toolbar spacing so
          the gap below the page tabs reads as consistent across tabs. */}
      <div>
          {/* Vendor / Customer sub-tab strip — matches Vendor Detail's
              "Items They Sell" / "Items They Purchase" pattern: blue tint
              when Vendor is active, violet when Customer. Each tab carries
              a helper tooltip explaining what gets templated here and how
              the inheritance behaves for existing vs new partners. Hidden
              when the group is single-scope (auto-selecting the relevant
              tab). */}
          {groupHasVendorScope && groupHasCustomerScope && (
            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 mb-2.5">
              {([
                {
                  key: "vendor" as const,
                  label: "Vendor Profiles",
                  color: "#0548A3",
                  tip: "Default catalog, payment terms, carriers, and pricing rules for vendor-side partners in this group. Edits here only seed new partners.",
                  example: <>Configure a profile here to set the <span className="text-[#0548A3]" style={{ fontWeight: 600 }}>vendor defaults</span> every new vendor under this group inherits.</>,
                },
                {
                  key: "customer" as const,
                  label: "Customer Profiles",
                  color: "#5B21B6",
                  tip: "Default credit policy, payment terms, and pricing rules for customer-side partners in this group. Edits here only seed new partners — existing partners keep what they were configured with.",
                  example: <>Configure a profile here to set the <span className="text-[#5B21B6]" style={{ fontWeight: 600 }}>customer defaults</span> every new customer under this group inherits.</>,
                },
              ]).map((tab) => {
                const isActive = effectiveSubTab === tab.key;
                return (
                  <Tooltip key={tab.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab(tab.key)}
                        className={`inline-flex items-center justify-center px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                          isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-500 hover:text-slate-700"
                        }`}
                        style={{ fontWeight: isActive ? 600 : 500, color: isActive ? tab.color : undefined }}
                      >
                        {tab.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                      <p className="text-slate-500">{tab.tip}</p>
                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                        <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                        <p className="text-[11px] text-slate-700 mt-1">{tab.example}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Profile cards — User Access permission-card layout. Click
              opens the profile's per-section configuration list. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {profilesForActiveSubTab.map((p) => {
              const configured = profileIsConfigured(p.id);
              const isComing = !!p.comingSoon;
              return (
                <div
                  key={p.id}
                  onClick={() => { if (!isComing) setActiveProfileId(p.id); }}
                  className={`group relative rounded-xl border bg-white overflow-hidden transition-all duration-200 ${
                    isComing
                      ? "border-border opacity-70 cursor-not-allowed"
                      : "border-border hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] cursor-pointer"
                  }`}
                >
                  <div className="px-3.5 py-3 space-y-2">
                    {/* Top row — icon chip + status pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                        configured ? "bg-primary/10 text-primary" : "bg-muted text-slate-500"
                      } ${isComing ? "" : "group-hover:scale-105"}`}>
                        {p.icon}
                      </div>
                      {isComing ? (
                        <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-slate-50 text-slate-500 border-slate-200" style={{ fontWeight: 500 }}>
                          Coming Soon
                        </span>
                      ) : configured ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] border bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" style={{ fontWeight: 500 }}>
                          <Check className="w-2.5 h-2.5" /> Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-muted text-muted-foreground border-slate-300" style={{ fontWeight: 500 }}>
                          Not Configured
                        </span>
                      )}
                    </div>
                    {/* Name + descriptor */}
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{p.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {profileSummary(p.id)}
                      </p>
                    </div>
                    {/* Footer strip — metric + configure affordance */}
                    <div className="flex items-center justify-between pt-1 border-t border-muted">
                      <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                        {profileMetric(p.id, group)}
                      </span>
                      {!isComing && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontWeight: 600 }}>
                          {configured ? "Edit" : "Configure"} <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* ── Profile config Dialog. Opens when the user clicks a profile
          card; renders the same per-section list (Payment Terms,
          Pricing Rules, Credit Policy, etc.) inside a modal so the
          group's main page stays in the grid view. Save flows
          (GroupBulkApplyModal, pricing-rule routing, GL pending state)
          all keep working unchanged. */}
      {/* Per-profile config dialog — focused, single-profile view.
          Header carries the profile label; sidebar shows ONLY the
          config sections for that profile (Billing & Shipping,
          Payment Terms, Pricing Rules, Freight & Logistics; vendor
          also gets Credit Limit). Right pane reuses the SAME
          ConfigPageContent the creation form uses, so cards/inputs/
          recipient pickers all render with the creation-form
          treatment. Modal sized to give that pane real room. */}
      <Dialog open={!!activeProfile} onOpenChange={(open) => { if (!open) setActiveProfileId(null); }}>
        <DialogContent
          className="!p-0 !gap-0 overflow-hidden flex flex-col z-[210] !border-0"
          overlayClassName="!bg-black/40 !z-[200]"
          style={{ maxWidth: "min(80vw, 1180px)", width: "calc(100% - 2rem)", height: "min(88vh, 820px)", maxHeight: "88vh", minHeight: 600, borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)" }}
          hideCloseButton
        >
          <DialogTitle className="sr-only">{activeProfile?.label} configuration</DialogTitle>
          <DialogDescription className="sr-only">Templated defaults for this profile.</DialogDescription>

          {/* Header — profile-scoped, matches the creation form's right-pane header */}
          <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {activeProfile?.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    {activeProfile?.label} configuration
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {activeProfile ? profileSummary(activeProfile.id) : ""} · Applied to every partner associated with <span className="text-foreground" style={{ fontWeight: 600 }}>{group.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProfileId(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — section nav (sidebar) + ConfigPageContent (right pane) */}
          {(() => {
            const isVendorProfile = VENDOR_SUB_TYPES.some((p) => p.id === activeProfileId);
            const dialogConfigType: "vendor" | "customer" = isVendorProfile ? "vendor" : "customer";
            const baseSections: ConfigSection[] = dialogConfigType === "vendor" ? GROUP_VENDOR_CONFIG_SECTIONS : GROUP_CUSTOMER_CONFIG_SECTIONS;
            // Per-profile section logic:
            //  - Carrier profile: ONLY exposes Shipping Methods. Per
            //    stakeholder ask (May 2026): the rest of the config
            //    surface (billing & shipping, payment methods, credit
            //    limit, payment terms, pricing rules) is partner-level
            //    not carrier-level, so it doesn't belong on the carrier
            //    template at all. We drop the standalone "Carrier
            //    Profile" section (its fields move under Shipping
            //    Methods) AND every other section, then render the
            //    content full-width without the section sidebar.
            //  - Other profiles: keep the full section list, drop only
            //    the carrier_profile sub-section.
            // Filter sections by ownership: each section declares which
            // subtype(s) own it. Sections without an owner are shared.
            const dialogSections = baseSections
              .filter((s) => !s.ownedBy || s.ownedBy.includes(activeProfileId || ""))
              .map((s) => (s.titleBySubType?.[activeProfileId || ""]
                ? { ...s, title: s.titleBySubType[activeProfileId || ""] }
                : s));
            const syntheticGroup = PARTNER_GROUPS.find((g) => g.id === group.id) ?? null;
            const effectiveSectionId = dialogSections.some((s) => s.id === dialogSectionId)
              ? dialogSectionId
              : dialogSections[0]?.id ?? "billing_shipping";
            return (
              <div className="flex-1 flex min-h-0 overflow-hidden bg-[#FAFBFC]">
                {/* Section sidebar — hidden when only a single section
                    exists (carrier profile) so Shipping Methods owns the
                    full canvas. */}
                {dialogSections.length > 1 && (
                  <div className="w-[240px] shrink-0 border-r border-[#EEF2F6] bg-white overflow-y-auto p-3">
                    <p className="text-[10px] text-slate-400 tracking-wider px-2 pt-1 pb-1.5" style={{ fontWeight: 600 }}>
                      Sections
                    </p>
                    <nav className="flex flex-col gap-0.5">
                      {dialogSections.map((s) => {
                        const isActive = dialogSectionId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setDialogSectionId(s.id)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isActive ? "bg-accent text-primary" : "text-slate-600 hover:bg-slate-50"
                            }`}
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
                    sectionId={effectiveSectionId}
                    configType={dialogConfigType}
                    activeSubType={activeProfileId ?? "vendor_rules"}
                    selectedGroup={syntheticGroup}
                    partnerName={group.name}
                    configDataRef={configDataRef}
                    groupContext
                  />
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setActiveProfileId(null)}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-muted transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Compute the diff between the snapshot taken at open
                // and the live configDataRef so the push-prompt can
                // surface a "Changes you made" quick-view. Wrapped in
                // try/catch — never let a diff issue blank the page;
                // fall through with an empty list so the bare prompt
                // still opens.
                try {
                  const diff = diffConfigData(configSnapshotRef.current, configDataRef.current);
                  setPendingChangesList(diff);
                } catch (err) {
                  console.error("[Per-profile save] failed to compute change diff", err);
                  setPendingChangesList([]);
                }
                setActiveSectionId(`profile_save:${activeProfileId ?? ""}`);
              }}
              className="h-9 px-5 rounded-lg bg-primary text-white text-[12px] hover:bg-[#086AE6] transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Save Configuration
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Push-prompt modal — single Yes/No question per the stakeholder
          spec. Opens for both per-field saves (activeSection set) and
          per-profile saves (activeSectionId starts with "profile_save:").
          Pricing Rules has its own dedicated handler so it skips this. */}
      <GroupBulkApplyModal
        open={!!effectiveChange}
        onOpenChange={(v) => { if (!v) { setActiveSectionId(null); setPendingChangesList([]); if (profileSaveProfile) setActiveProfileId(null); } }}
        groupName={group.name}
        linkedPartners={linkedPartners}
        change={effectiveChange}
        tier={activeTier}
        // ERP-10410 — Customer Rules profile save flags vendor-only partners.
        includesCustomerRules={profileSaveId === "customer_rules"}
        onSaveTemplateOnly={() => {
          // Per-profile saves: persist whatever ConfigPageContent
          // wrote into configDataRef back to the store. Per-section
          // saves (activeSection set) currently surface the prompt
          // for demo flows but don't have a live form bound, so they
          // fall through with no payload write.
          if (profileSaveProfile) {
            updateGroup(group.id, { ...configDataRef.current });
          }
          toast.success(`${effectiveLabel} saved on ${group.name}. Existing partners are not affected; new partners going forward will inherit the updated configuration.`);
          setActiveSectionId(null);
          setPendingChangesList([]);
          if (profileSaveProfile) setActiveProfileId(null);
        }}
        onSaveAndApply={(ids, opts) => {
          if (profileSaveProfile) {
            updateGroup(group.id, { ...configDataRef.current });
          }
          const vendorOnlyNote = opts
            ? opts.makeVendorOnlyCustomers
              ? " Vendor-only partners are now customers too."
              : " Vendor-only partners stay vendor-only."
            : "";
          toast.success(`${effectiveLabel} saved on ${group.name} and pushed to ${ids.length} associated partner${ids.length === 1 ? "" : "s"}. Past transactions stay unchanged; future transactions will use the new configuration.${vendorOnlyNote}`);
          setActiveSectionId(null);
          setPendingChangesList([]);
          if (profileSaveProfile) setActiveProfileId(null);
        }}
      />
    </div>
  );
}

/* ─── Linked Partners table — shared column-header system defs ───
 *
 * Keys match the Partners listing reference so `vendorCellValue` covers
 * every column. `filterType` follows the Column Filters spec's data-type
 * rule: fixed pick-list → multiselect, numeric count → range, open
 * text → text search. */
const GROUP_COLUMN_DEFS: { key: string; label: string; width: number; sortable: boolean; filterType: FilterType }[] = [
  { key: "partner_name", label: "Partner", width: 200, sortable: true, filterType: "text" },
  { key: "partner_type", label: "Partner Type", width: 110, sortable: true, filterType: "multiselect" },
  { key: "vendor_sub_types", label: "Vendor Sub-Types", width: 130, sortable: true, filterType: "multiselect" },
  { key: "customer_sub_types", label: "Customer Sub-Types", width: 130, sortable: true, filterType: "multiselect" },
  { key: "num_items", label: "No. of Items", width: 120, sortable: true, filterType: "range" },
  { key: "partner_locations", label: "Partner Locations", width: 140, sortable: true, filterType: "text" },
  { key: "global_contacts", label: "Points of Contact", width: 130, sortable: true, filterType: "text" },
  { key: "country", label: "Country", width: 90, sortable: true, filterType: "multiselect" },
  { key: "status", label: "Status", width: 90, sortable: true, filterType: "multiselect" },
];
const GROUP_LOCKED_COLUMN = "partner_name";
const groupFilterTypeFor = (key: string): FilterType =>
  GROUP_COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

/** Cell accessor — delegates to the canonical Partners accessor, with a
 *  partner_name override to mirror the rendered `displayName || companyName`
 *  fallback so sort/filter operate on exactly what the user sees. */
const groupCellValue: CellAccessor<Vendor> = (v, columnKey) => {
  if (columnKey === "partner_name") return v.displayName || v.companyName;
  return vendorCellValue(v, columnKey);
};

/** Shadow applied to the last frozen column so the frozen block reads as
 *  a pinned pane during horizontal scroll (matches the Partners listing). */
const FROZEN_EDGE_SHADOW = "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)";

/* ─── Partners tab — scope pills + sortable table ─── */
export function PartnersTab({ group, linkedPartners }: { group: PartnerGroupTemplateSummary; linkedPartners: Vendor[] }) {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<"condensed" | "comfort">("condensed");
  const [densityOpen, setDensityOpen] = useState(false);
  // Shared column-header system state (sort / filter / hide / freeze) —
  // same shape as the Partners listing + Credit Management references.
  // Default sort preserved from the bespoke table: Partner ascending.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: GROUP_LOCKED_COLUMN, direction: "asc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set([GROUP_LOCKED_COLUMN]));
  // Quick-view modal state — opened from rich cell clicks (item/location photo,
  // "+N more" tooltip item, etc.). Mirrors VendorsListPage's pattern.
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  // Unlink confirmation dialog candidate.
  const [pendingUnlink, setPendingUnlink] = useState<{ id: string; name: string } | null>(null);
  // Local "unlinked from this group" set. linkedPartners is derived
  // deterministically upstream, so we filter the visible rows here
  // when the user confirms an unlink — the partner stays in the
  // wider system, just stops showing under this group.
  const [unlinkedIds, setUnlinkedIds] = useState<Set<string>>(new Set());
  // Add-partner modal — reuses the same step-2 surface from
  // CreatePartnerGroupModal so the "add existing partner" flow looks
  // and behaves identically whether it's hit during group creation or
  // post-creation from the Linked Partners tab.
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  // Pagination — matches the canonical listing-page treatment
  // (Records per page · ‹‹ ‹ Prev · 1 2 ... · Next › ››).
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  // Row selection — mirrors the canonical Partners listing table.
  // Stored as a Set of partner ids; visible page rows drive the
  // select-all / indeterminate header checkbox state.
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Suppress unused-variable warning in case future filters key off the group id.
  void group;

  const scopeCounts = useMemo(() => {
    const c = { all: linkedPartners.length, vendor: 0, customer: 0, both: 0 };
    for (const v of linkedPartners) {
      const types = v.partnerTypes || [];
      const isV = types.includes("vendor");
      const isC = types.includes("customer");
      if (isV && isC) c.both++;
      else if (isV) c.vendor++;
      else if (isC) c.customer++;
    }
    return c;
  }, [linkedPartners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return linkedPartners.filter((v) => {
      if (q && !(v.companyName.toLowerCase().includes(q) || v.code.toLowerCase().includes(q) || v.country.toLowerCase().includes(q))) return false;
      const types = v.partnerTypes || [];
      const isV = types.includes("vendor");
      const isC = types.includes("customer");
      switch (scope) {
        case "vendor": return isV && !isC;
        case "customer": return isC && !isV;
        case "both": return isV && isC;
        default: return true;
      }
    });
  }, [linkedPartners, scope, search]);

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => Object.fromEntries(GROUP_COLUMN_DEFS.map((c) => [c.key, c.label])), []);
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    GROUP_COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, linkedPartners, groupCellValue);
    });
    return map;
  }, [linkedPartners]);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, groupFilterTypeFor(columnKey)) });
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, groupFilterTypeFor(columnKey)) });
    setAutoOpenFilterKey(null);
    setTimeout(() => setAutoOpenFilterKey(columnKey), 0);
  }, []);
  const handleColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: filter }));
  }, []);
  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[columnKey]; return next; });
  }, []);
  const handleClearAllColumnFilters = useCallback(() => setColumnFilters({}), []);
  const handleHideColumn = useCallback((columnKey: string) => {
    setHiddenColumns((prev) => new Set(prev).add(columnKey));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== GROUP_LOCKED_COLUMN) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => GROUP_COLUMN_DEFS.filter((c) => !hiddenColumns.has(c.key)), [hiddenColumns]);
  const visibleColumnKeys = useMemo(() => visibleColumns.map((c) => c.key), [visibleColumns]);

  /* Frozen columns stack from the left in visible order. The sticky
   * select-all checkbox column owns the first 40px, so cumulative
   * offsets start there — the locked Partner column lands at 40, same
   * as the previous hard-coded stickyOffset. */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = 40;
    visibleColumns.forEach((c) => {
      if (frozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    });
    return offsets;
  }, [visibleColumns, frozenColumns]);
  const lastFrozenKey = useMemo(() => {
    const frozen = visibleColumns.filter((c) => frozenColumns.has(c.key));
    return frozen.length ? frozen[frozen.length - 1].key : null;
  }, [visibleColumns, frozenColumns]);

  const sorted = useMemo(() => {
    const result = applyFilters(filtered, columnFiltersList, groupCellValue);
    return sortRows(result, sortConfig, groupCellValue, groupFilterTypeFor);
  }, [filtered, columnFiltersList, sortConfig]);

  /* ─── Global empty / error states ─── */
  const tableLoad = useTableLoadState();
  const filterLayerCount = (scope !== "all" ? 1 : 0) + Object.keys(columnFilters).length;
  const visibleSortedCount = useMemo(() => sorted.filter((v) => !unlinkedIds.has(v.id)).length, [sorted, unlinkedIds]);
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : linkedPartners.filter((v) => !unlinkedIds.has(v.id)).length,
    filteredCount: tableLoad.forceEmpty ? 0 : visibleSortedCount,
    searchQuery: search,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(search, linkedPartners.flatMap((v) => [v.companyName, v.code, v.country]));
  }, [emptyKind, search, linkedPartners]);
  const emptyStateProps: TableEmptyStateProps | null = emptyKind && {
    kind: emptyKind,
    entity: { singular: "partner", plural: "partners" },
    title: emptyKind === "no-data" ? "No linked partners yet" : undefined,
    description: emptyKind === "no-data" ? "Partners linked to this group will show up here." : undefined,
    searchQuery: search,
    suggestion: searchSuggestion,
    onApplySuggestion: (q: string) => { setSearch(q); setPage(1); },
    filterCount: filterLayerCount,
    onClearSearch: () => { setSearch(""); setPage(1); },
    onClearFilters: () => { setScope("all"); setColumnFilters({}); setPage(1); },
    onClearAll: () => { setSearch(""); setScope("all"); setColumnFilters({}); setPage(1); },
    onRetry: tableLoad.retry,
    retrying: tableLoad.retrying,
    onCreate: () => setAddPartnerOpen(true),
    createLabel: "Add Partner",
    compact: true,
  };

  const isRelaxed = density === "comfort";
  const rowH = isRelaxed ? "h-[56px]" : "h-[44px]";

  const SCOPE_PILLS: { key: ScopeFilter; label: string }[] = [
    { key: "all", label: "Show All" },
    { key: "vendor", label: "Vendor" },
    { key: "customer", label: "Customer" },
    { key: "both", label: "Both" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 shrink-0 bg-white border-b border-border">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partners..."
              className="pl-9 pr-3 h-8 text-xs bg-white border-border rounded-lg shadow-sm placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <button className="h-8 px-3 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </button>
          <div className="flex-1" />
          {/* Density toggle */}
          <div className="relative">
            <button
              onClick={() => setDensityOpen((v) => !v)}
              className="h-8 px-3 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors inline-flex items-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              {density === "condensed" ? <AlignJustify className="w-3.5 h-3.5 text-slate-500" /> : <List className="w-3.5 h-3.5 text-slate-500" />}
              {density === "condensed" ? "Condensed" : "Comfort"}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {densityOpen && (
              <>
                <div className="fixed inset-0 z-[10]" onClick={() => setDensityOpen(false)} />
                <div className="absolute right-0 mt-1 w-[180px] rounded-lg border border-border bg-white shadow-lg z-[20] overflow-hidden">
                  {([
                    { key: "condensed" as const, label: "Condensed", icon: AlignJustify },
                    { key: "comfort" as const, label: "Comfort", icon: List },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setDensity(opt.key); setDensityOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${density === opt.key ? "bg-accent/40" : "hover:bg-slate-50"}`}
                    >
                      <opt.icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 text-[12px] text-foreground" style={{ fontWeight: 500 }}>{opt.label}</span>
                      {density === opt.key && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Add Partner CTA — anchored to the rightmost position so it
              sits with the rest of the page-level actions (mirrors the
              Edit Group / Actions placement on the page header). Opens
              the same step-2 (member-selection) modal used during group
              creation, with the same primary-toggle flow + logic. */}
          <button
            type="button"
            onClick={() => setAddPartnerOpen(true)}
            className="h-8 px-3 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-sm"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Partner
          </button>
        </div>
        {/* Scope pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {SCOPE_PILLS.map((p) => {
            const active = scope === p.key;
            const count = scopeCounts[p.key];
            return (
              <button
                key={p.key}
                onClick={() => setScope(p.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                }`}
                style={{ fontWeight: active ? 500 : 400, color: active ? "rgb(var(--primary))" : undefined }}
              >
                {p.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${active ? "bg-primary/10" : "bg-muted"}`}
                  style={{ fontWeight: 600, color: active ? "rgb(var(--primary))" : "rgb(var(--muted-foreground))" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active column filter chips — shared Notion-style bar, rendered
          directly above the table so it survives the filtered-empty state. */}
      {columnFiltersList.length > 0 && (
        <div className="pt-2.5 shrink-0 bg-white border-b border-border">
          <ActiveFiltersBar
            columnFilters={columnFiltersList}
            columnLabels={columnLabels}
            uniqueValuesByKey={uniqueValuesMap}
            lockedColumnKey={GROUP_LOCKED_COLUMN}
            onFilterChange={handleColumnFilterChange}
            onRemoveFilter={handleRemoveColumnFilter}
            onAddFilter={handleAddColumnFilterWithAutoOpen}
            onClearAll={handleClearAllColumnFilters}
            autoOpenKey={autoOpenFilterKey}
            onAutoOpened={() => setAutoOpenFilterKey(null)}
            availableColumns={GROUP_COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
          />
        </div>
      )}

      {/* Table — explicit min-widths per column + horizontal scroll on the
          wrapper, matching the Partners listing page so column treatments
          stay consistent instead of squeezing to fit. */}
      <div className="flex-1 overflow-auto">
        {tableLoad.loadState === "loading" ? (
          <div className="p-4 space-y-3" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={`h-3.5 rounded bg-slate-100 ${["w-3/4", "w-1/2", "w-2/3", "w-5/6"][i % 4]}`} />
            ))}
          </div>
        ) : emptyStateProps ? (
          <TableEmptyState {...emptyStateProps} />
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No partners match this filter</p>
            </div>
          </div>
        ) : (
          <table className="text-xs w-full" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                {(() => {
                  const visible = sorted.filter((v) => !unlinkedIds.has(v.id));
                  // "All" is represented by perPage === -1.
                  const effective = perPage === -1 ? Math.max(1, visible.length) : perPage;
                  const startIdx = (page - 1) * effective;
                  const pageRows = visible.slice(startIdx, startIdx + effective);
                  const pageIds = pageRows.map((v) => v.id);
                  const pageSelectedCount = pageIds.filter((id) => selectedRowIds.has(id)).length;
                  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
                  const somePageSelected = pageSelectedCount > 0 && pageSelectedCount < pageIds.length;
                  return (
                    <th
                      className="sticky left-0 bg-slate-50 z-[6] w-[40px] min-w-[40px] max-w-[40px] py-2.5 pl-3 pr-0 border-b border-border"
                    >
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            if (checked) pageIds.forEach((id) => next.add(id));
                            else pageIds.forEach((id) => next.delete(id));
                            return next;
                          });
                        }}
                        aria-label="Select all visible rows"
                      />
                    </th>
                  );
                })()}
                {visibleColumns.map((def) => {
                  const isFrozen = frozenColumns.has(def.key);
                  const isLocked = def.key === GROUP_LOCKED_COLUMN;
                  const currentColSort: "asc" | "desc" | null = sortConfig?.key === def.key ? sortConfig.direction : null;
                  const hasFilter = columnFilters[def.key] ? isFilterActive(columnFilters[def.key]) : false;
                  return (
                    <th
                      key={def.key}
                      className={`text-left pl-4 pr-2 py-2.5 text-slate-500 text-[11px] border-b border-border whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-[5]" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""}`}
                      style={{
                        fontWeight: 500,
                        minWidth: `${def.width}px`,
                        width: `${def.width}px`,
                        ...(isFrozen ? { left: frozenOffsets[def.key] ?? 0 } : {}),
                        ...(def.key === lastFrozenKey ? { boxShadow: FROZEN_EDGE_SHADOW } : {}),
                      }}
                    >
                      <div className="flex items-center">
                        <ColumnHeaderMenu
                          columnKey={def.key}
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
                          filter={columnFilters[def.key] ?? null}
                          uniqueValues={uniqueValuesMap[def.key]}
                          filterTypeOverride={def.filterType}
                          onFilterChange={handleColumnFilterChange}
                        >
                          <div className="inline-flex items-center gap-1">
                            <span style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                            {hasFilter && !currentColSort && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                            )}
                            {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                            {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                            {!currentColSort && !hasFilter && def.sortable && (
                              <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </ColumnHeaderMenu>
                      </div>
                    </th>
                  );
                })}
                <th className="text-center pr-4 py-2.5 text-slate-500 text-[11px] border-b border-border sticky right-0 bg-slate-50 z-[5]" style={{ fontWeight: 500, minWidth: 60, width: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.06)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const visible = sorted.filter((v) => !unlinkedIds.has(v.id));
                const effective = perPage === -1 ? Math.max(1, visible.length) : perPage;
                const startIdx = (page - 1) * effective;
                return visible.slice(startIdx, startIdx + effective).map((v) => (
                  <PartnerRow
                    key={v.id}
                    v={v}
                    rowH={rowH}
                    isRelaxed={isRelaxed}
                    visibleColumnKeys={visibleColumnKeys}
                    frozenOffsets={frozenOffsets}
                    lastFrozenKey={lastFrozenKey}
                    onQuickView={setQuickViewData}
                    onRequestUnlink={() => setPendingUnlink({ id: v.id, name: v.displayName || v.companyName })}
                    isSelected={selectedRowIds.has(v.id)}
                    onToggleSelected={() => setSelectedRowIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
                      return next;
                    })}
                    /* Deterministic "this group is the partner's primary"
                        — every 3rd partner. Real data will replace this
                        once partners carry a primaryGroupId field. */
                    isPrimary={hashString(v.id + group.id) % 3 === 0}
                  />
                ));
              })()}
            </tbody>
          </table>
        )}
      </div>

      {(() => {
        const visibleCount = sorted.filter((v) => !unlinkedIds.has(v.id)).length;
        const effective = perPage === -1 ? Math.max(1, visibleCount) : perPage;
        const totalPages = Math.max(1, Math.ceil(visibleCount / effective));
        // Snap to last page when current page falls past the available
        // range (e.g. perPage just changed). Effect rather than render-
        // time set to avoid a setState-during-render warning.
        return (
          <>
            {page > totalPages && <PageSnap totalPages={totalPages} setPage={setPage} />}
            <PaginationFooter
              page={Math.min(page, totalPages)}
              perPage={perPage}
              totalPages={totalPages}
              onPageChange={setPage}
              onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
            />
          </>
        );
      })()}

      {/* Quick-view modal — item / location / contact detail (shared primitive) */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

      {/* Unlink-from-group confirmation dialog — shared canonical dialog:
          red confirm for regular rows, amber "Can't unlink yet" guard when
          this group is the partner's primary (same prompts as the group
          details page's Linked Partners tab). */}
      <UnlinkPartnerDialog
        pending={pendingUnlink ? { kind: "single", ...pendingUnlink } : null}
        onClose={() => setPendingUnlink(null)}
        groupName={group.name}
        lockedPrimaryIds={new Set(
          pendingUnlink && isPartnerPrimaryLockedToGroup(pendingUnlink.id, group.id) ? [pendingUnlink.id] : [],
        )}
        onOpenPartner={(id) => window.open(`/vendors/${id}`, "_blank", "noopener,noreferrer")}
        onConfirm={(ids) => {
          if (ids.length === 0 || !pendingUnlink) return;
          setUnlinkedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
          });
          toast.success(`${pendingUnlink.name} unlinked from ${group.name}.`);
        }}
      />

      {/* Add Partner modal — single-step; renders the same member-selection
          surface (search, scope-filtered table, primary toggle, bulk
          actions) used as step 2 in CreatePartnerGroupModal. Set-as-primary
          fires the same two-option inherit-vs-keep confirmation prompt as
          the creation flow. */}
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
    </div>
  );
}

/* ─── Standard pagination footer ───────────────────────────────────
 *
 * Mirrors the canonical listing-page pagination (Records per page · ‹‹
 * ‹ Prev · 1 2 ... · Next › ››). Re-used across the Linked Partners
 * tab, the Add Partners modal, and Create Partner Group step 2 so the
 * surfaces feel sibling.
 */
function PaginationFooter({
  page,
  perPage,
  totalPages,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  perPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
}) {
  const pageNumbers = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);
  return (
    <div data-table-meta className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Records per Page</span>
        <Select value={perPage === -1 ? "all" : String(perPage)} onValueChange={(v) => onPerPageChange(v === "all" ? -1 : Number(v))}>
          <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[350]">
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </Button>
        {pageNumbers.map((p, idx) => p === "..." ? (
          <span key={`d${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
        ) : (
          <Button
            key={p}
            variant={page === p ? "default" : "ghost"}
            size="sm"
            className={`h-8 w-8 p-0 text-sm ${page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* Tiny side-effect helper so render code can react to perPage changes
 * (snapping the current page back into range) without setState-in-render. */
function PageSnap({ totalPages, setPage }: { totalPages: number; setPage: (n: number) => void }) {
  useEffect(() => { setPage(totalPages); }, [totalPages, setPage]);
  return null;
}

/* Shared photo palettes (match VendorsListPage so hover/QuickView images are stable) */
const ITEM_PHOTOS_ROW = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=80&h=80&fit=crop",
];
const LOC_PHOTOS_ROW = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=80&h=80&fit=crop",
];
const LOC_STREETS_ROW = ["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Factory Rd", "Park Ave", "Main St"];
const LOC_CITIES_ROW = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX", "Chicago, IL"];
const LOC_TYPES_ROW = ["Warehouse", "Distribution Center", "Manufacturing", "Regional Office", "HQ"];

function PartnerRow({
  v,
  rowH,
  isRelaxed,
  visibleColumnKeys,
  frozenOffsets,
  lastFrozenKey,
  onQuickView,
  onRequestUnlink,
  isPrimary,
  isSelected,
  onToggleSelected,
}: {
  v: Vendor;
  rowH: string;
  isRelaxed: boolean;
  /** Ordered data-column keys to render (hidden columns already removed). */
  visibleColumnKeys: string[];
  /** Sticky-left offsets for user-frozen columns (cumulative, past the
   *  40px checkbox column) — mirrors the header's freeze mechanism. */
  frozenOffsets: Record<string, number>;
  /** Last frozen column key — carries the pinned-pane edge shadow. */
  lastFrozenKey: string | null;
  onQuickView: (data: QuickViewData) => void;
  onRequestUnlink: () => void;
  /** True when this group is the partner's primary (default) group —
   *  surfaces a star badge in the Primary column. */
  isPrimary: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
}) {
  const tint = getAvatarTint(v.companyName);
  const initials = getInitials(v.companyName);
  const types = v.partnerTypes || [];
  const itemCodes = v.itemCodes || [];
  const partnerLocations = v.partnerLocations || [];
  const globalPointOfContacts = v.globalPointOfContacts || [];
  const extraItems = Math.max(0, itemCodes.length - 1);
  const extraLocations = Math.max(0, partnerLocations.length - 1);
  const extraContacts = Math.max(0, globalPointOfContacts.length - 1);

  const itemHash = hashString(itemCodes[0] || v.id);
  const itemPhoto = ITEM_PHOTOS_ROW[itemHash % ITEM_PHOTOS_ROW.length];
  const locHash = hashString(partnerLocations[0] || v.id);
  const locPhoto = LOC_PHOTOS_ROW[locHash % LOC_PHOTOS_ROW.length];
  const locAddr = `${(locHash % 999) + 1} ${LOC_STREETS_ROW[locHash % LOC_STREETS_ROW.length]}, ${LOC_CITIES_ROW[(locHash + 1) % LOC_CITIES_ROW.length]}`;
  const locDescription = mockLocationData(partnerLocations[0] || v.id).description;

  const statusColor = v.status === "active"
    ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }
    : v.status === "inactive"
      ? { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }
      : { bg: "rgb(var(--muted))", text: "#334155", border: "#CBD5E1" };

  /* Column visibility + frozen treatment — driven by the shared
   * column-header system in PartnersTab. Column ORDER is fixed (users
   * hide/freeze but never reorder), so the hard-coded cell sequence
   * below stays valid; hidden columns simply don't render. Frozen cells
   * mirror the header: sticky at the cumulative offset, solid background
   * so scrolled content passes underneath, edge shadow on the last one. */
  const show = (key: string) => visibleColumnKeys.includes(key);
  const tdProps = (key: string): { className: string; style?: React.CSSProperties } => {
    const frozen = key in frozenOffsets;
    return {
      className: `pl-4 pr-2 py-2 align-middle${key === "status" ? " whitespace-nowrap" : ""}${frozen ? ` sticky z-[2] ${isSelected ? "bg-[#F0F7FF]" : "bg-white group-hover:bg-[#F0F7FF]"}` : ""}`,
      style: frozen
        ? { left: frozenOffsets[key], ...(key === lastFrozenKey ? { boxShadow: FROZEN_EDGE_SHADOW } : {}) }
        : undefined,
    };
  };

  return (
    <tr className={`${rowH} ${isSelected ? "bg-[#F0F7FF]" : "bg-white"} hover:bg-[#F0F7FF] transition-colors border-b border-muted cursor-pointer group`}>
      {/* Checkbox — sticky-left, mirrors the canonical Partners listing
          treatment (40px wide, no left padding). Clicking the cell
          flips selection without bubbling to the row click handler. */}
      <td
        className={`sticky left-0 z-[3] w-[40px] min-w-[40px] max-w-[40px] py-2 pl-3 pr-0 align-middle ${isSelected ? "bg-[#F0F7FF]" : "bg-white group-hover:bg-[#F0F7FF]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelected}
          aria-label={`Select ${v.displayName || v.companyName}`}
        />
      </td>
      {/* Partner — locked/frozen so it stays visible during horizontal
          scroll. Primary-group indicator: when this group is the partner's
          primary group, the canonical PrimaryPill sits to the right of
          the name. */}
      {show("partner_name") && (
      <td {...tdProps("partner_name")}>
        <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
          <div
            className={`${isRelaxed ? "w-9 h-9 text-[10px]" : "w-7 h-7 text-[9px]"} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`}
            style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <a
                href={`/vendors/${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${isRelaxed ? "text-[13px]" : "text-sm"} truncate hover:text-primary hover:underline transition-colors`}
                style={{ fontWeight: 500, color: "#1E293B" }}
              >
                {v.displayName || v.companyName}
              </a>
              {isPrimary && (
                <span
                  className="inline-flex shrink-0"
                  title="This group is the partner's primary group"
                  aria-label="Primary Group"
                >
                  <PrimaryPill size="xs" />
                </span>
              )}
            </div>
            {isRelaxed && <span className="text-[10px] text-muted-foreground/60 block">{v.code}</span>}
          </div>
        </div>
      </td>
      )}

      {/* Type */}
      {show("partner_type") && (
      <td {...tdProps("partner_type")}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {types.length > 0 ? types.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-md border"
              style={{
                fontWeight: 500,
                backgroundColor: t === "vendor" ? "#EBF3FF" : "#F5F3FF",
                color: t === "vendor" ? "#0548A3" : "#5B21B6",
                borderColor: t === "vendor" ? "#A8D2FF" : "#DDD6FE",
              }}
            >
              {t === "vendor" ? "Vendor" : "Customer"}
            </span>
          )) : <span className="text-[12px] text-slate-400">–</span>}
        </div>
      </td>
      )}

      {/* Vendor Sub-Types — pills with overflow tooltip, matches listing page */}
      {show("vendor_sub_types") && (
      <td {...tdProps("vendor_sub_types")}>
        {(() => {
          const vst = (v.vendorSubTypes || []).filter((s) => s !== "Vendor Rules");
          const vstExtra = vst.length > 1 ? vst.length - 1 : 0;
          if (vst.length === 0) return <span className="text-[12px] text-slate-400">–</span>;
          return (
            <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
              <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
                {vst[0]}
              </span>
              {vstExtra > 0 && (
                <OverflowTooltip
                  category="Vendor Sub-Types"
                  items={vst.slice(1).map((st, i) => ({
                    id: `${v.id}-vst-${i}`,
                    name: st,
                    subtitle: "VENDOR SUB-TYPE",
                  }))}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{vstExtra}</span>
                </OverflowTooltip>
              )}
            </div>
          );
        })()}
      </td>
      )}

      {/* Customer Sub-Types — same pill treatment as the listing page */}
      {show("customer_sub_types") && (
      <td {...tdProps("customer_sub_types")}>
        {(() => {
          const cst = (v.customerSubTypes || []).filter((s) => s !== "Customer Rules");
          const cstExtra = cst.length > 1 ? cst.length - 1 : 0;
          if (cst.length === 0) return <span className="text-[12px] text-slate-400">–</span>;
          return (
            <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
              <span className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>
                {cst[0]}
              </span>
              {cstExtra > 0 && (
                <OverflowTooltip
                  category="Customer Sub-Types"
                  items={cst.slice(1).map((st, i) => ({
                    id: `${v.id}-cst-${i}`,
                    name: st,
                    subtitle: "CUSTOMER SUB-TYPE",
                  }))}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", borderColor: "rgb(var(--border))" }}>+{cstExtra}</span>
                </OverflowTooltip>
              )}
            </div>
          );
        })()}
      </td>
      )}

      {/* No. of Items — photo + first code + "+N more" OverflowTooltip, click opens QuickView */}
      {show("num_items") && (
      <td {...tdProps("num_items")}>
        {itemCodes.length > 0 ? (
          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
            <div
              className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickView({ type: "item", item: { id: `${v.id}-item-0`, name: itemCodes[0], subtitle: v.displayName || v.companyName, imageUrl: itemPhoto }, vendorName: v.displayName || v.companyName });
              }}
            >
              <img src={itemPhoto} alt="" className="w-full h-full object-cover" />
            </div>
            <a
              href={`/vendors/${v.id}?tab=items`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`min-w-0 ${isRelaxed ? "text-[13px]" : "text-sm"} block truncate hover:text-primary hover:underline transition-colors`}
              style={{ fontWeight: 500, color: "#1E293B" }}
            >
              {itemCodes[0]}
            </a>
            {extraItems > 0 && (
              <OverflowTooltip
                category="Items"
                items={itemCodes.slice(1).map((code, i) => ({
                  id: `${v.id}-item-${i + 1}`,
                  name: code,
                  subtitle: "Item Code",
                  imageUrl: ITEM_PHOTOS_ROW[hashString(code) % ITEM_PHOTOS_ROW.length],
                }))}
                onItemClick={(item) => onQuickView({ type: "item", item, vendorName: v.displayName || v.companyName })}
                viewMoreHref={`/vendors/${v.id}?tab=items`}
                viewMoreLabel={`View All ${itemCodes.length} Items for ${v.displayName || v.companyName}`}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extraItems} more</span>
              </OverflowTooltip>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-slate-400">–</span>
        )}
      </td>
      )}

      {/* Partner Locations — photo + HoverCard preview + click → QuickView, "+N more" OverflowTooltip */}
      {show("partner_locations") && (
      <td {...tdProps("partner_locations")}>
        {partnerLocations.length > 0 ? (
          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-1.5"}`}>
            <HoverCard>
              <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div
                  className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickView({
                      type: "location",
                      item: { id: `${v.id}-loc-0`, name: partnerLocations[0], subtitle: "Location", imageUrl: locPhoto },
                      vendorName: v.displayName || v.companyName,
                      vendorId: v.id,
                      locationIdx: 0,
                    });
                  }}
                >
                  <img src={locPhoto} alt="" className="w-full h-full object-cover" />
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
                      <img src={locPhoto} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{partnerLocations[0]}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2" style={{ lineHeight: 1.35 }}>{locDescription}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{locAddr}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{v.displayName || v.companyName}</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <div className="min-w-0">
              <span
                className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate cursor-pointer hover:text-primary hover:underline transition-colors`}
                style={{ fontWeight: isRelaxed ? 500 : undefined, color: "#1E293B" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView({
                    type: "location",
                    item: { id: `${v.id}-loc-0`, name: partnerLocations[0], subtitle: "Location", imageUrl: locPhoto },
                    vendorName: v.displayName || v.companyName,
                    vendorId: v.id,
                    locationIdx: 0,
                  });
                }}
              >
                {partnerLocations[0]}
              </span>
              {isRelaxed && (
                <span className="text-[10px] text-muted-foreground/50 block truncate">{locAddr}</span>
              )}
            </div>
            {extraLocations > 0 && (
              <OverflowTooltip
                category="Locations"
                items={partnerLocations.slice(1).map((loc, i) => {
                  const ph = hashString(loc);
                  return {
                    id: `${v.id}-loc-${i + 1}`,
                    name: loc,
                    subtitle: LOC_TYPES_ROW[ph % LOC_TYPES_ROW.length],
                    imageUrl: LOC_PHOTOS_ROW[ph % LOC_PHOTOS_ROW.length],
                  };
                })}
                onItemClick={(item) => {
                  // Map the clicked overflow item back to its source index (+1 because the visible row is idx 0).
                  const idx = partnerLocations.findIndex((loc) => loc === item.name);
                  onQuickView({
                    type: "location",
                    item,
                    vendorName: v.displayName || v.companyName,
                    vendorId: v.id,
                    locationIdx: idx >= 0 ? idx : 0,
                  });
                }}
                viewMoreHref={`/vendors/${v.id}?tab=partner_locations`}
                viewMoreLabel={`View All ${partnerLocations.length} Locations for ${v.displayName || v.companyName}`}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extraLocations} more</span>
              </OverflowTooltip>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-slate-400">–</span>
        )}
      </td>
      )}

      {/* Points of Contact — avatar + name + "+N more" */}
      {show("global_contacts") && (
      <td {...tdProps("global_contacts")}>
        {globalPointOfContacts.length > 0 ? (
          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
            <div
              className={`${isRelaxed ? "w-8 h-8 text-[10px]" : "w-6 h-6 text-[9px]"} rounded-full flex items-center justify-center shrink-0 text-white cursor-pointer`}
              style={{ backgroundColor: globalPointOfContacts[0].bgColor, fontWeight: 700 }}
              onClick={(e) => {
                e.stopPropagation();
                onQuickView({
                  type: "contact",
                  item: { id: `${v.id}-poc-0`, name: globalPointOfContacts[0].name, subtitle: "Point of Contact" },
                  vendorName: v.displayName || v.companyName,
                });
              }}
            >
              {globalPointOfContacts[0].initials}
            </div>
            <a
              href={`/vendors/${v.id}?tab=points_of_contact`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`min-w-0 ${isRelaxed ? "text-[13px]" : "text-sm"} block truncate hover:text-primary hover:underline transition-colors`}
              style={{ fontWeight: 500, color: "#1E293B" }}
            >
              {globalPointOfContacts[0].name}
            </a>
            {extraContacts > 0 && (
              <OverflowTooltip
                category="Contacts"
                items={globalPointOfContacts.slice(1).map((c, i) => ({
                  id: `${v.id}-poc-${i + 1}`,
                  name: c.name,
                  subtitle: "Point of Contact",
                }))}
                onItemClick={(item) => onQuickView({
                  type: "contact",
                  item,
                  vendorName: v.displayName || v.companyName,
                })}
                viewMoreHref={`/vendors/${v.id}?tab=points_of_contact`}
                viewMoreLabel={`View All ${globalPointOfContacts.length} Contacts for ${v.displayName || v.companyName}`}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extraContacts} more</span>
              </OverflowTooltip>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-slate-400">–</span>
        )}
      </td>
      )}

      {/* Country */}
      {show("country") && (
      <td {...tdProps("country")}>
        <div className="flex items-center gap-1.5 text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
          <span className="text-[14px] leading-none"><FlagImage code={flagEmojiCode(v.countryFlag)} className="text-[13px]" /></span>
          {v.country}
        </div>
      </td>
      )}

      {/* Status */}
      {show("status") && (
      <td {...tdProps("status")}>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border"
          style={{ fontWeight: 500, backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
        >
          {STATUS_LABELS[v.status]}
        </span>
      </td>
      )}

      {/* Actions — sticky-right so the menu stays reachable during scroll */}
      <td
        className="w-[60px] text-center pr-3 align-middle sticky right-0 bg-white group-hover:bg-[#F0F7FF] z-[2]"
        style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.06)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center h-7 w-7 mx-auto rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[170px]">
            <DropdownMenuItem onClick={() => window.open(`/vendors/${v.id}`, "_blank", "noopener,noreferrer")}>
              <Eye className="w-3.5 h-3.5 mr-2" /> View Partner
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRequestUnlink} className="text-destructive focus:text-destructive">
              <Unlink2 className="w-3.5 h-3.5 mr-2 text-destructive" /> Unlink from Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

/* ─── AddPartnersToGroupModal ────────────────────────────────────────
 *
 * Single-step modal mounted from the Linked Partners tab's Add Partner
 * CTA. Reuses GroupMembersStep — the same component CreatePartnerGroupModal
 * renders as its Step 2 — so the search, scope-filtered table, primary
 * toggle, and bulk-set-primary all behave identically.
 *
 * Set-as-primary fires the same inherit-vs-keep prompt as the creation
 * flow (re-implemented inline here rather than imported, mirroring the
 * exact layout, copy, and option semantics from CreatePartnerGroupModal).
 */
export function AddPartnersToGroupModal({
  open,
  onOpenChange,
  group,
  existingPartners,
  onAddPartners,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: PartnerGroupTemplateSummary;
  /** Partners already linked to this group — surfaced in the Added
   *  Partners view so users can see who's already in the group while
   *  picking new members in Browse Partners. */
  existingPartners: Vendor[];
  onAddPartners: (result: { linkedCount: number; primaryCount: number }) => void;
}) {
  const { vendors } = useVendors();
  // Local selection state mirrors CreatePartnerGroupModal's step-2 state.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryIds, setPrimaryIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  // View toggle — mirrors the Browse Inventory / Added Items pattern used
  // by the qualified-vendor item picker (PartnerItemsTab). "browse" surfaces
  // every candidate partner (search-friendly bulk-pick); "added" narrows
  // to just the rows currently selected in this session so the user can
  // review their picks + primary markers before saving.
  const [view, setView] = useState<"browse" | "added">("browse");
  // Pending primary confirmation — per-row OR bulk. Single state with a
  // discriminator so one AlertDialog can serve both surfaces, matching
  // the per-row + bulk pattern in CreatePartnerGroupModal.
  const [pendingPrimary, setPendingPrimary] = useState<
    | { kind: "single"; id: string; name: string }
    | { kind: "bulk"; ids: string[] }
    | null
  >(null);
  // Locally-removed existing partners — when the user clicks Remove on
  // a row that was already linked to the group, we don't actually
  // mutate the upstream linked list; we just hide it inside this modal
  // session. Real unlink-from-group lives in the page's row menu.
  const [removedExistingIds, setRemovedExistingIds] = useState<Set<string>>(new Set());
  // Added view selections — checkbox set on the Added tab. Drives the
  // bulk action toolbar (Set primary / Remove primary / Remove). Reset
  // between modal opens. Separate from selectedIds (which tracks the
  // Browse-view "rows being added").
  const [removalSelectedIds, setRemovalSelectedIds] = useState<Set<string>>(new Set());
  // Existing partners whose pre-existing primary marker the user has
  // explicitly removed this session. Subtracted from addedViewPrimaryIds
  // below so the Added view's bulk "Remove primary" can act on rows
  // that were primary via the deterministic seed (not just session
  // picks).
  const [unsetPrimaryIds, setUnsetPrimaryIds] = useState<Set<string>>(new Set());
  // Pending unlink confirmation — fires on single Remove (X) click OR
  // bulk Remove. Discriminated union so one AlertDialog serves both.
  const [pendingRemove, setPendingRemove] = useState<
    | { kind: "single"; id: string; name: string }
    | { kind: "bulk"; ids: string[] }
    | null
  >(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setPrimaryIds(new Set());
      setSearch("");
      setView("browse");
      setPendingPrimary(null);
      setRemovedExistingIds(new Set());
      setRemovalSelectedIds(new Set());
      setUnsetPrimaryIds(new Set());
      setPendingRemove(null);
    }
  }, [open]);
  // Drop removal selections when switching back to Browse so re-entering
  // Added starts clean.
  useEffect(() => {
    if (view === "browse") setRemovalSelectedIds(new Set());
  }, [view]);

  // Show the full partner directory in the Browse view, minus partners
  // with status === "archived". Archived partners aren't valid pick
  // candidates — they're paused org-wide and shouldn't appear in the
  // data table per stakeholder ask (only Active + Inactive).
  const candidateVendors = useMemo(
    () => vendors.filter((v) => v.status !== "archived"),
    [vendors],
  );
  // Existing partners minus the ones the user removed in this modal
  // session AND minus any archived rows (same filter as Browse).
  const visibleExistingPartners = useMemo(
    () => existingPartners.filter((v) => v.status !== "archived" && !removedExistingIds.has(v.id)),
    [existingPartners, removedExistingIds],
  );
  const existingIds = useMemo(
    () => new Set(visibleExistingPartners.map((v) => v.id)),
    [visibleExistingPartners],
  );
  // Pre-existing primary marker — same deterministic rule the Linked
  // Partners table uses (`hashString(v.id + group.id) % 3 === 0`), so
  // the Added view in the modal reflects the same primaries the user
  // sees on the parent page.
  const preExistingPrimaryIds = useMemo(() => {
    const s = new Set<string>();
    for (const v of visibleExistingPartners) {
      if (hashString(v.id + group.id) % 3 === 0) s.add(v.id);
    }
    return s;
  }, [visibleExistingPartners, group.id]);
  // Added Partners view = partners already linked to this group + any
  // new picks from this session that aren't yet in the linked set.
  // De-dup by id, preserving existing-first order so the user sees the
  // group's current membership at the top and their new picks below.
  const addedViewVendors = useMemo(() => {
    const merged: Vendor[] = [...visibleExistingPartners];
    for (const v of candidateVendors) {
      if (selectedIds.has(v.id) && !existingIds.has(v.id)) merged.push(v);
    }
    return merged;
  }, [visibleExistingPartners, candidateVendors, selectedIds, existingIds]);
  // In the Added view, every row is "selected" — existing members AND
  // the new picks. Lets the table render the same checked-row styling
  // for both, keeping the view as a single review surface.
  const addedViewSelectedIds = useMemo(() => {
    const merged = new Set(selectedIds);
    for (const id of existingIds) merged.add(id);
    return merged;
  }, [selectedIds, existingIds]);
  // In the Added view, primaries = parent-page primaries (deterministic
  // hash) ∪ session primaries (newly marked in this modal) MINUS any
  // session-explicitly-unset primaries so the bulk Remove-primary
  // action reads naturally on pre-existing primary rows too.
  const addedViewPrimaryIds = useMemo(() => {
    const merged = new Set(primaryIds);
    for (const id of preExistingPrimaryIds) merged.add(id);
    for (const id of unsetPrimaryIds) merged.delete(id);
    return merged;
  }, [primaryIds, preExistingPrimaryIds, unsetPrimaryIds]);

  // Commit a removal — single OR bulk. Existing partners get pushed to
  // removedExistingIds (locally hidden); new session picks get dropped
  // from selectedIds + primaryIds.
  const commitRemoval = (ids: string[]) => {
    const toHideExisting = new Set<string>();
    const toDropSelection = new Set<string>();
    for (const id of ids) {
      if (existingIds.has(id)) toHideExisting.add(id);
      else toDropSelection.add(id);
    }
    if (toHideExisting.size > 0) {
      setRemovedExistingIds((prev) => {
        const next = new Set(prev);
        toHideExisting.forEach((id) => next.add(id));
        return next;
      });
    }
    if (toDropSelection.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        toDropSelection.forEach((id) => next.delete(id));
        return next;
      });
      setPrimaryIds((prev) => {
        const next = new Set(prev);
        toDropSelection.forEach((id) => next.delete(id));
        return next;
      });
    }
    // Drop the just-removed rows from the bulk-removal selection too.
    setRemovalSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  // Group-template scope drives which partners are even valid candidates
  // (vendor-only group can't link customer-only partners, etc.). Same
  // semantics as CreatePartnerGroupModal's scope prop.
  const scope = useMemo(() => {
    const s = new Set<string>();
    if (group.templateType === "vendor" || group.templateType === "both") s.add("vendor");
    if (group.templateType === "customer" || group.templateType === "both") s.add("customer");
    return s;
  }, [group.templateType]);

  const handleToggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Drop primary status alongside the link — same coupling as the
        // creation flow ("unlink ⇒ unprimary").
        setPrimaryIds((p) => {
          const np = new Set(p);
          np.delete(id);
          return np;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTogglePrimary = (id: string, partnerName: string) => {
    // Pre-existing primaries are locked (ERP-5770: a partner must always
    // keep a primary group) — the pill is disabled in the row; this guard
    // is belt-and-braces for any other caller.
    if (preExistingPrimaryIds.has(id) && !unsetPrimaryIds.has(id)) {
      toast.error(`${partnerName} keeps ${group.name} as primary. Reassign their primary group from the partner page first.`);
      return;
    }
    // True primary state = session primary OR pre-existing primary
    // minus session-unset. Mirrors addedViewPrimaryIds.
    const isCurrentlyPrimary = (primaryIds.has(id) || preExistingPrimaryIds.has(id)) && !unsetPrimaryIds.has(id);
    if (isCurrentlyPrimary) {
      // Silent removal — drop from session primaries AND record an
      // explicit unset for pre-existing primaries so the row stays
      // unprimary after re-render.
      setPrimaryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (preExistingPrimaryIds.has(id)) {
        setUnsetPrimaryIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
      toast.success(`${partnerName} no longer marked primary.`);
    } else {
      setPendingPrimary({ kind: "single", id, name: partnerName });
    }
  };

  // Bulk handlers — closure picks the right source set per view.
  // Browse: operates on selectedIds (rows being added).
  // Added : operates on removalSelectedIds (rows checked for bulk action).
  const handleBulkSetPrimary = () => {
    const sourceIds = view === "added" ? removalSelectedIds : selectedIds;
    const ids = Array.from(sourceIds).filter((id) => !addedViewPrimaryIds.has(id));
    if (ids.length === 0) return;
    setPendingPrimary({ kind: "bulk", ids });
  };

  const handleBulkRemovePrimary = () => {
    const sourceIds = view === "added" ? removalSelectedIds : selectedIds;
    const allPrimary = Array.from(sourceIds).filter((id) => addedViewPrimaryIds.has(id));
    // Pre-existing primaries are locked — this group is their primary
    // group, and a partner must always keep one. Skip with an explainer.
    const lockedSel = allPrimary.filter((id) => preExistingPrimaryIds.has(id));
    const ids = allPrimary.filter((id) => !preExistingPrimaryIds.has(id));
    if (allPrimary.length === 0) return;
    if (ids.length === 0) {
      toast.error(`${lockedSel.length === 1 ? "This partner keeps" : `These ${lockedSel.length} partners keep`} ${group.name} as primary. Reassign their primary group from the partner page first.`);
      return;
    }
    setPrimaryIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(
      lockedSel.length > 0
        ? `Primary marker removed from ${ids.length} partner${ids.length === 1 ? "" : "s"}. ${lockedSel.length} skipped — ${group.name} is their primary group.`
        : `Primary marker removed from ${ids.length} partner${ids.length === 1 ? "" : "s"}.`,
    );
  };

  const handleConfirmPrimary = (_mode: "inherit" | "keepExisting") => {
    if (!pendingPrimary) return;
    // Setting clears any prior session-unset entry for the same id so
    // re-promoting a row that was just unprimary'd actually sticks.
    const ids = pendingPrimary.kind === "single" ? [pendingPrimary.id] : pendingPrimary.ids;
    setUnsetPrimaryIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPrimaryIds((prev) => {
      const next = new Set(prev);
      if (pendingPrimary.kind === "single") next.add(pendingPrimary.id);
      else pendingPrimary.ids.forEach((id) => next.add(id));
      return next;
    });
    setPendingPrimary(null);
  };

  const handleSave = () => {
    onAddPartners({
      linkedCount: selectedIds.size,
      primaryCount: primaryIds.size,
    });
  };

  const pendingPrimaryName = pendingPrimary?.kind === "single"
    ? pendingPrimary.name
    : pendingPrimary?.kind === "bulk"
      ? `${pendingPrimary.ids.length} partner${pendingPrimary.ids.length === 1 ? "" : "s"}`
      : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="!p-0 !gap-0 overflow-hidden flex flex-col z-[215] !border-0"
          overlayClassName="!bg-black/40 !z-[210]"
          style={{
            // Match the Create Partner Group modal's footprint so the
            // two surfaces feel sibling.
            maxWidth: "min(70vw, 1320px)",
            width: "calc(100% - 2rem)",
            height: "min(90vh, 920px)",
            maxHeight: "90vh",
            minHeight: 600,
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
          }}
          hideCloseButton
        >
          <DialogTitle className="sr-only">Add partners to {group.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Pick existing partners to link to this group, optionally marking some as primary.
          </DialogDescription>

          {/* Header — matches the per-profile config dialog header treatment */}
          <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Users className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    Add partners to {group.name}
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    Link partners to this group. Mark a row as <span className="text-foreground" style={{ fontWeight: 600 }}>primary</span> to inherit {group.name}'s template.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — single step; renders the same component used as step 2
              in the creation modal so the table, search, scope, primary
              actions, and bulk toolbar are byte-identical. The view
              toggle (Browse / Added) is injected inline with the search
              row via `toolbarExtras` to match the qualified-vendor item
              picker layout. `flush` makes the table fill the modal body
              edge-to-edge (no surrounding padding/border). */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            {view === "added" && selectedIds.size === 0 && existingPartners.length === 0 ? (
              /* Empty state for Added view — drops users back to Browse
                  with a single click so they don't get stuck staring at
                  the empty members table. Only shown when this group has
                  zero partners AND nothing has been picked this session. */
              <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>No partners added yet</p>
                <p className="text-[12px] text-slate-500 mt-1 max-w-[300px]">
                  Pick partners from <span className="text-foreground" style={{ fontWeight: 600 }}>Browse Partners</span> to add them to {group.name}.
                </p>
                <button
                  type="button"
                  onClick={() => setView("browse")}
                  className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-accent text-primary text-[12px] hover:bg-blue-100 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Browse Partners
                </button>
              </div>
            ) : (
              <GroupMembersStep
                vendors={
                  view === "browse"
                    ? candidateVendors
                    : addedViewVendors
                }
                /* Browse view → live selection drives the "pick to add"
                   set. Added view → checkboxes start empty and drive
                   the bulk-removal set (separate state). */
                selectedMemberIds={view === "added" ? removalSelectedIds : selectedIds}
                primaryMemberIds={view === "added" ? addedViewPrimaryIds : primaryIds}
                onToggleMember={view === "added"
                  ? (id) => setRemovalSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    })
                  : handleToggleMember
                }
                onTogglePrimary={handleTogglePrimary}
                onBulkSetPrimary={handleBulkSetPrimary}
                onBulkRemovePrimary={handleBulkRemovePrimary}
                search={search}
                onSearchChange={setSearch}
                scope={scope}
                hideHelperBanner
                flush
                lockedPrimaryIds={preExistingPrimaryIds}
                currentGroup={{ id: group.id, name: group.name }}
                /* Added view stays clickable so users can multi-select
                    for the new bulk Primary / Remove-primary / Remove
                    actions; alwaysShowPrimary keeps the primary toggle
                    visible for every existing member regardless of the
                    selection state. */
                alwaysShowPrimary={view === "added"}
                onRowRemove={view === "added" ? (id, name) => {
                  // Single Remove → confirmation modal (matches the
                  // page's row-menu unlink dialog).
                  setPendingRemove({ kind: "single", id, name });
                } : undefined}
                bulkRemoveMode={view === "added" ? {
                  onBulkRemove: () => {
                    if (removalSelectedIds.size === 0) return;
                    setPendingRemove({ kind: "bulk", ids: Array.from(removalSelectedIds) });
                  },
                } : undefined}
                toolbarExtras={
                  <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                    <button
                      onClick={() => setView("browse")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                        view === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                      }`}
                      style={{ fontWeight: view === "browse" ? 600 : 500 }}
                    >
                      <Users className={`w-3.5 h-3.5 ${view === "browse" ? "text-primary" : "text-slate-400"}`} />
                      Browse Partners
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "browse" ? "bg-accent text-primary" : "bg-border text-slate-500"}`}
                        style={{ fontWeight: 600 }}
                      >
                        {candidateVendors.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setView("added")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                        view === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                      }`}
                      style={{ fontWeight: view === "added" ? 600 : 500 }}
                    >
                      <Check className={`w-3.5 h-3.5 ${view === "added" ? "text-emerald-500" : "text-slate-400"}`} />
                      Added Partners
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "added" ? "bg-emerald-50 text-emerald-700" : "bg-border text-slate-500"}`}
                        style={{ fontWeight: 600 }}
                      >
                        {addedViewVendors.length}
                      </span>
                    </button>
                  </div>
                }
              />
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedIds.size}</span> selected
              {primaryIds.size > 0 && (
                <>
                  {" · "}
                  <span className="text-primary" style={{ fontWeight: 600 }}>{primaryIds.size}</span> primary
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-muted transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedIds.size === 0}
                className={`h-9 px-4 rounded-lg text-[12px] inline-flex items-center gap-1.5 transition-colors ${
                  selectedIds.size === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-[#086AE6] cursor-pointer shadow-sm"
                }`}
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add {selectedIds.size > 0 ? selectedIds.size : ""} partner{selectedIds.size === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set-as-Primary confirmation prompt — re-implements the exact
          modal CreatePartnerGroupModal opens when the user marks a row
          as primary (single OR bulk). Same icon, same gradient, same
          two-option inherit-vs-keep stacked layout, same copy.
          The parent Add Partners Dialog sits at z-215; the prompt's
          overlay must be ABOVE that (z-220) so the picker is properly
          dimmed instead of peeking through. Content sits at z-230. */}
      <AlertDialog open={!!pendingPrimary} onOpenChange={(o) => { if (!o) setPendingPrimary(null); }}>
        <AlertDialogContent
          className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 230 }}
          overlayClassName="!bg-black/50 !z-[220]"
          onInteractOutside={() => setPendingPrimary(null)}
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
              {pendingPrimary?.kind === "bulk" ? "Bulk · Set as Primary" : "Set as Primary"}
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {`Make ${group.name} the primary group for ${pendingPrimaryName}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingPrimaryName}</span> may already have payment terms, pricing rules, or other settings configured. Pick how setting primary should handle their values.
            </AlertDialogDescription>
            <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
              {/* Option 1 — Inherit from this group's template */}
              <button
                type="button"
                onClick={() => handleConfirmPrimary("inherit")}
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
                onClick={() => handleConfirmPrimary("keepExisting")}
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
                          Partners are marked primary; existing settings stay untouched.
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
                onClick={() => setPendingPrimary(null)}
                className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink confirmation prompt — fires from the per-row Remove (X)
          OR the bulk "Remove N partners" toolbar action. Shared canonical
          dialog with the primary-group guard baked in: rows whose primary
          group is THIS group are skipped (bulk) or blocked (single) with
          the same amber prompts the group details page uses. */}
      <UnlinkPartnerDialog
        pending={pendingRemove}
        onClose={() => setPendingRemove(null)}
        groupName={group.name}
        lockedPrimaryIds={preExistingPrimaryIds}
        onOpenPartner={(id) => window.open(`/vendors/${id}`, "_blank", "noopener,noreferrer")}
        zIndex={230}
        overlayClassName="!bg-black/50 !z-[220]"
        onConfirm={(ids, skippedCount) => {
          if (ids.length === 0) return;
          commitRemoval(ids);
          const base = pendingRemove?.kind === "single"
            ? `${pendingRemove.name} unlinked from ${group.name}.`
            : `${ids.length} partner${ids.length === 1 ? "" : "s"} unlinked from ${group.name}.`;
          toast.success(
            skippedCount > 0
              ? `${base} ${skippedCount} primary partner${skippedCount === 1 ? "" : "s"} skipped.`
              : base,
          );
        }}
      />
    </>
  );
}
