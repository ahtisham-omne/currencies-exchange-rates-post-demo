import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  LayoutGrid,
  List,
  AlignJustify,
  Check,
  ChevronDown,
  X,
  ChartColumn,
  Globe,
  TrendingUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  CircleSlash,
  CircleCheck,
  GripVertical,
  Calendar,
  MapPin,
  Sliders,
  UserCheck,
  UserX,
  Info,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Tag,
  Receipt,
  Settings2,
  Star,
  Download,
} from "lucide-react";
import { highlightMatch } from "../../lib/utils";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { BulkActionBar, type BulkAction } from "../components/BulkActionBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
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
import { getAvatarTint } from "../utils/avatarTints";
import { getLastUpdated } from "../utils/lastUpdated";
import { broadcastSpawnedCreation } from "../utils/spawnedCreationChannel";
import { PARTNER_GROUPS, type PartnerGroup } from "../components/vendors/partnerConstants";
import { buildSeededDelta, insightsRangePeriodLabel, type KpiDelta } from "../components/vendors/KpiInsightsPanel";
import { InsightsRangeMenu, InsightsRefresh, InsightsResetButton, type InsightsRange } from "../components/vendors/InsightsControls";
import { CreatePartnerGroupModal } from "../components/vendors/CreatePartnerGroupModal";
import { PartnerGroupDetailModal } from "../components/vendors/PartnerGroupDetailModal";
import { GroupBulkApplyModal, type GroupBulkApplyChange } from "../components/vendors/GroupBulkApplyModal";
import { useVendors } from "../context/VendorContext";
import { usePartnerGroups } from "../context/PartnerGroupsContext";
import { toast } from "sonner";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "../components/vendors/ColumnSelector";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../components/ui/hover-card";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { QuickViewPanel, type QuickViewData } from "../components/vendors/QuickViewPanel";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  createBlankFilter,
  isFilterActive,
  applyFilters,
  getUniqueColumnValues,
  type CellAccessor,
  type ColumnFilterState,
  type SortConfig,
} from "../components/vendors/ColumnHeaderMenu";
import { GroupStatusChangeDialog, type GroupStatusChangeMode } from "../components/vendors/GroupStatusChangeDialog";
import { ArchivePartnerGroupModal } from "../components/vendors/ArchivePartnerGroupModal";
import type { Vendor } from "../data/vendors";
import { PARTNER_GROUPS_IMPORT_SPEC, type GroupExportRow } from "../import-export/spec";
import { buildValidationContext } from "../import-export/validation";
import { useListingImportExport } from "../import-export/useListingImportExport";
import { TableEmptyRow, TableEmptyState, TableSkeletonRows, CardSkeletonGrid, resolveTableEmptyKind, useTableLoadState, type TableEmptyStateProps } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";

/* ─── Types ─── */
type DensityOption = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";
type QuickFilter =
  | "all"
  | "vendor"
  | "customer"
  | "both"
  | "active"
  | "inactive"
  | "archived";
type TemplateType = "vendor" | "customer" | "both";
type GroupStatus = "Active" | "Inactive" | "Archived";

import type { CreatedByPerson } from "../data/currentUser";
export type { CreatedByPerson };

export interface EnrichedGroup extends PartnerGroup {
  templateType: TemplateType;
  status: GroupStatus;
  createdOn: string;
  createdBy: CreatedByPerson;
  code: string;
  partnerCount: number; // number of partners currently linked (= memberCount)
  hasPricingRules: boolean;
  pricingRuleCount: number;
  hasPaymentTerms: boolean;
  paymentTermLabel: string | null;
  hasCreditConfig: boolean;
}

/* ─── Config ─── */
const DENSITY_CONFIG: { key: DensityOption; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact table view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious table view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid of cards", icon: "layout-grid" },
];

// Listing-rule convention (cross-module): Archived rows are hidden from
// the default view and only surface when the user picks the Archived
// pill. Inactive (Disabled) rows continue to render in the default view
// alongside Active so users notice broken/paused records.
const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean; tone?: "destructive" }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "vendor", label: "Vendor", showCount: true },
  { key: "customer", label: "Customer", showCount: true },
  { key: "both", label: "Vendor + Customer", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  { key: "archived", label: "Archived", showCount: true, tone: "destructive" },
];

// Pricing Rules / Payment Terms columns were removed per Eli's request — both
// values are still surfaced in the group detail modal and remain available as
// quick-filter / KPI inputs, just not as their own table columns.
// GL Accounts is added as an optional placeholder column (hidden by default)
// until Ashma's GL discovery lands; for now the cell shows a neutral "Pending"
// pill so the column is wired and ready when real data arrives.
// Region (country / state / regional label) is an inherited flag, not a grouping
// pillar — kept as optional, off by default. Eli's note: locational commonality
// (country/state/region) is the right framing, not country alone.
const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "group", label: "Partner Groups", minWidth: "320px", sortable: true },
  { key: "type", label: "Partner Group Type", minWidth: "200px", sortable: true },
  { key: "partners", label: "Linked Partners", minWidth: "220px", sortable: true },
  { key: "description", label: "Description", minWidth: "280px" },
  { key: "last_updated_by", label: "Last Updated By", minWidth: "220px", sortable: true },
  { key: "last_updated_on", label: "Last Updated On", minWidth: "140px", sortable: true },
  { key: "created_by", label: "Created By", minWidth: "220px", sortable: true },
  { key: "created_on", label: "Created On", minWidth: "140px", sortable: true },
  { key: "status", label: "Status", minWidth: "120px", sortable: true },
  { key: "gl_accounts", label: "GL Accounts", minWidth: "160px" }, // optional / off by default — Ashma's GL discovery is pending
  { key: "country", label: "Country", minWidth: "160px" }, // on by default — search matches country, so the column must be visible
];

const LOCKED_COLUMNS: string[] = ["group"];
const DEFAULT_HIDDEN_COLUMNS: string[] = ["gl_accounts"];
const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, !DEFAULT_HIDDEN_COLUMNS.includes(c.key)]),
);
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)]),
);
const MIN_COL_WIDTH = 1;
const CHECKBOX_COL_WIDTH = 44;

/** Column keys that should render as multiselect filters */
const MULTISELECT_COLUMNS = new Set(["type", "status", "country", "created_by", "last_updated_by"]);
/** Column keys that render as date filters */
const DATE_COLUMNS = new Set(["created_on", "last_updated_on"]);
/** Column keys that render as numeric range filters */
const RANGE_COLUMNS = new Set(["partners"]);

function getGroupFilterType(columnKey: string): ColumnFilterState["type"] {
  if (MULTISELECT_COLUMNS.has(columnKey)) return "multiselect";
  if (DATE_COLUMNS.has(columnKey)) return "date";
  if (RANGE_COLUMNS.has(columnKey)) return "range";
  return "text";
}

const TYPE_PALETTE: Record<TemplateType, { bg: string; fg: string; border: string; label: string }> = {
  vendor: { bg: "#EBF3FF", fg: "#0548A3", border: "#A8D2FF", label: "Vendor" },
  customer: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE", label: "Customer" },
  both: { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A", label: "Vendor & Customer" },
};

const TEMPLATE_TYPES: TemplateType[] = ["vendor", "customer", "both"];

const TEMPLATE_PAYMENT_TERMS = ["Net 30", "Net 15", "2/10 Net 30", "Net 45", "Net 60"];

/* ─── Sample pool for deterministic "Created By" person per group ─── */
const CREATED_BY_POOL: CreatedByPerson[] = [
  { name: "Ahtisham Ahmad", initials: "AA", photoUrl: "/avatars/ahtisham-ahmad.jpg" },
  { name: "Sarah Chen", initials: "SC", photoUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "Michael Patel", initials: "MP", photoUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "Emily Rodriguez", initials: "ER", photoUrl: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "David Kim", initials: "DK", photoUrl: "https://randomuser.me/api/portraits/men/75.jpg" },
  { name: "Rachel Thompson", initials: "RT", photoUrl: "https://randomuser.me/api/portraits/women/28.jpg" },
  { name: "James Wilson", initials: "JW", photoUrl: "https://randomuser.me/api/portraits/men/46.jpg" },
  { name: "Lisa Nguyen", initials: "LN", photoUrl: "https://randomuser.me/api/portraits/women/17.jpg" },
  { name: "Abdullah Khan", initials: "AK", photoUrl: "https://randomuser.me/api/portraits/men/29.jpg" },
  { name: "Amanda Foster", initials: "AF", photoUrl: "https://randomuser.me/api/portraits/women/56.jpg" },
];

/* ─── Column filter helpers (partner-group flavored) ───
 * One accessor into the shared generic engine — the four filter
 * semantics (contains / in-set / min-max / date-between) live in
 * ColumnHeaderMenu's applyFilters, never per-module. */
const groupCellValue: CellAccessor<EnrichedGroup> = (g, columnKey) => {
  switch (columnKey) {
    case "group": return [g.name, g.id]; // text filter matches name OR id
    case "type": return g.templateType;
    case "partners": return g.partnerCount;
    case "description": return g.description;
    case "country": return g.country;
    case "created_by": return g.createdBy?.name;
    case "created_on": return g.createdOn;
    case "last_updated_by": return getLastUpdated(g.id, g.createdOn).name;
    case "last_updated_on": return getLastUpdated(g.id, g.createdOn).date;
    case "status": return g.status;
    default: return undefined;
  }
};

function getUniqueGroupValues(columnKey: string, groups: EnrichedGroup[]): string[] {
  return getUniqueColumnValues(columnKey, groups, groupCellValue);
}

function applyGroupColumnFilters(
  groups: EnrichedGroup[],
  filters: ColumnFilterState[],
): EnrichedGroup[] {
  return applyFilters(groups, filters, groupCellValue);
}

/* ─── Helpers ─── */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

// CURRENT_USER lives in `../data/currentUser` so other modules (the
// PartnerGroupsContext, future Edit-by surfaces) can pull it without
// statically importing the whole listing page.

export function enrichGroup(g: PartnerGroup): EnrichedGroup {
  const h = hashString(g.id);
  // Real values from the store record win over the deterministic seed
  // (so a freshly-created group reflects the user's actual choices).
  const rec = g as Partial<EnrichedGroup> & {
    createdAt?: string;
    scope?: ("vendor" | "customer")[];
    configData?: Record<string, unknown>;
  };

  // templateType: prefer the recorded scope (vendor / customer / both)
  // when present; otherwise fall back to the deterministic seed.
  const templateType: TemplateType = rec.scope && rec.scope.length > 0
    ? (rec.scope.includes("vendor") && rec.scope.includes("customer")
        ? "both"
        : rec.scope[0] === "customer" ? "customer" : "vendor")
    : TEMPLATE_TYPES[h % TEMPLATE_TYPES.length];

  // Status seeding: a small slice of seeded groups land as Inactive (h%9)
  // and an even smaller slice as Archived (h%17) so the listing has real
  // examples of both states. Real records (rec.status) win when present.
  const seededStatus: GroupStatus = h % 17 === 0 ? "Archived" : (h % 9 === 0 ? "Inactive" : "Active");
  const status: GroupStatus = (rec.status as GroupStatus | undefined) ?? seededStatus;
  const startMs = new Date("2024-01-01").getTime();
  const endMs = new Date("2025-12-31").getTime();
  const offset = h % (endMs - startMs);
  const d = rec.createdAt ? new Date(rec.createdAt) : new Date(startMs + offset);
  const createdOn = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

  // Template flags read live config data when available; otherwise
  // fall back to the deterministic seed for groups still carrying
  // mock-only data.
  const cfg = rec.configData;
  const realPricingRules = (cfg?.configPricingRules as Array<unknown> | undefined)?.length;
  const hasPricingRules = realPricingRules != null
    ? realPricingRules > 0
    : h % 4 !== 3;
  const pricingRuleCount = realPricingRules ?? (hasPricingRules ? 1 + (h % 3) : 0);

  const realPaymentTerm = cfg?.configPaymentTerm as { name?: string } | undefined;
  const hasPaymentTerms = realPaymentTerm != null
    ? !!realPaymentTerm.name
    : h % 3 !== 2;
  const paymentTermLabel = realPaymentTerm?.name
    ?? (hasPaymentTerms ? TEMPLATE_PAYMENT_TERMS[h % TEMPLATE_PAYMENT_TERMS.length] : null);

  const realCredit = cfg?.configCreditLimit as { enforcement?: string; maxCreditLimit?: string } | undefined;
  const hasCreditConfig = realCredit != null
    ? !!(realCredit.enforcement && realCredit.enforcement !== "none") || !!realCredit.maxCreditLimit
    : h % 5 !== 4;

  const createdBy = rec.createdBy ?? CREATED_BY_POOL[h % CREATED_BY_POOL.length];
  return {
    ...g,
    templateType,
    status,
    createdOn,
    createdBy,
    code: g.id,
    partnerCount: g.memberCount,
    hasPricingRules,
    pricingRuleCount,
    hasPaymentTerms,
    paymentTermLabel,
    hasCreditConfig,
  };
}

/* Partners that use a given group as their PRIMARY group. Mirrors the
 * deterministic slice + hash the detail page uses (PartnerGroupDetailsPage:
 * linkedPartnersAll + primaryIds) so the listing's archive flow surfaces the
 * exact same partners the detail page would. */
export function getGroupLinkedPartners(group: { id: string; partnerCount: number; memberIds?: string[] }, vendors: Vendor[]): Vendor[] {
  if (group.memberIds && group.memberIds.length > 0) {
    const ids = new Set(group.memberIds);
    return vendors.filter((v) => ids.has(v.id));
  }
  const h = hashString(group.id);
  const copy = [...vendors];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(vendors.length, group.partnerCount));
}

export function getGroupPrimaryPartners(group: { id: string; partnerCount: number }, vendors: Vendor[]): Vendor[] {
  const h = hashString(group.id);
  const copy = [...vendors];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const linked = copy.slice(0, Math.min(vendors.length, group.partnerCount));
  return linked.filter((v) => hashString(v.id + group.id) % 3 === 0);
}

/* ─── Deterministic member-avatar picker ─── */

/* ─── KPI card — draggable, matches listing DraggableListKpiCard ─── */
interface KpiDef {
  key: string;
  label: string;
  value: string;
  /** Optional small secondary line under the main value — used by
   *  Most-used Group to show partner count + share without truncating
   *  the group name. Mirrors the two-line partner-detail KPI pattern. */
  subValue?: string;
  icon: React.ReactNode;
  /** Plain-text description shown in the tooltip body. */
  tooltip?: string;
  /** Optional concrete example rendered under the description as a
   *  separate "Example:" line — matches the pricing-rule tooltip
   *  pattern Eli flagged as the canonical reference. */
  example?: string;
  /** Range-scoped period-over-period delta prefix (invoicing pattern). */
  delta?: KpiDelta;
  /** Period anchor for the "vs prior X" clause under the value. */
  rangeLabel?: string;
  /** Fixed-pitch calculation shown in the tooltip's Calculation block. */
  formula?: string;
}

const GROUP_KPI_DND = "GROUP_KPI_CARD";

function DraggableGroupKpiCard({
  index, def, moveCard, onRemove,
}: {
  index: number;
  def: KpiDef;
  moveCard: (from: number, to: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: GROUP_KPI_DND,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: GROUP_KPI_DND,
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

  if (isDragging) {
    return <div ref={ref} className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none" />;
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
      <div className="px-3 py-2">
        {/* Drag handle — top-right pill */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        {/* Label row */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{def.label}</p>
            {def.tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 cursor-help"
                  >
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px] leading-[1.5] z-[300] p-0 overflow-hidden">
                  <div className="p-2.5">
                    <p>{def.tooltip}</p>
                    {def.example && (
                      <p className="mt-1.5 pt-1.5 border-t border-border/40 text-popover-foreground/80">
                        <span className="text-popover-foreground" style={{ fontWeight: 600 }}>Example: </span>
                        {def.example}
                      </p>
                    )}
                  </div>
                  {def.formula && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                      <p className="text-[10px] tracking-wider text-slate-400 mb-1" style={{ fontWeight: 600 }}>Calculation</p>
                      <pre className="text-[10px] text-slate-700 whitespace-pre-wrap leading-snug">{def.formula}</pre>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }}>{def.icon}</div>
        </div>
        {/* Value row — delta prefix + number on the left, optional
            secondary detail (e.g. group name for Most-used Group) on
            the right of the same line so the card stays the same
            height as KPIs that only carry a single value. */}
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <div className="flex items-baseline gap-1 min-w-0">
            {def.delta && (
              <span
                className="text-[10px] shrink-0"
                style={{
                  color: def.delta.tone === "positive" ? "rgb(var(--success))" : def.delta.tone === "negative" ? "rgb(var(--destructive))" : "rgb(var(--muted-foreground))",
                  fontWeight: 600,
                }}
              >
                {def.delta.text}
              </span>
            )}
            <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap truncate shrink-0" style={{ fontWeight: 600, lineHeight: 1.2 }}>{def.value}</p>
          </div>
          {def.subValue && (
            <p className="text-[11px] text-slate-500 whitespace-nowrap truncate text-right min-w-0" style={{ fontWeight: 500 }} title={def.subValue}>
              {def.subValue}
            </p>
          )}
        </div>
        {/* Period anchor — "vs prior X" clause (invoicing card pattern). */}
        {def.delta && def.rangeLabel && (
          <div className="text-[10px] text-slate-400/80 truncate mt-0.5">vs prior {def.rangeLabel}</div>
        )}
      </div>
      {/* Remove button — bottom-right on hover */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${def.label}`}
        >
          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  );
}

/* ─── Group-specific KPI catalog for the Customize Widgets drawer
   Focused on how groups are used as templates — not geography. */
interface GroupKpiCatalogEntry {
  key: string;
  label: string;
  category: "Group Overview" | "Usage" | "Templates" | "Status";
  /** Short caption shown under the KPI in the Customize drawer. */
  subtitle: string;
  /** Full sentence used for the hover tooltip on the KPI card. */
  description: string;
  /** Concrete example surfaced under the description in the tooltip,
   *  rendered after a bold "Example:" label. Helps non-technical
   *  stakeholders read the metric without re-asking what it means. */
  example: string;
  iconName:
    | "Users"
    | "Building2"
    | "TrendingUp"
    | "Globe"
    | "UserCheck"
    | "UserX"
    | "Check"
    | "ChartColumn"
    | "TagIcon"
    | "ReceiptIcon"
    | "Crown";
  iconBg: string;
  iconColor: string;
  /** Fixed-pitch calculation shown in the tooltip's Calculation block —
   *  mirrors the Vendor Invoicing listing card pattern. */
  formula?: string;
}
const GROUP_KPI_CATALOG: GroupKpiCatalogEntry[] = [
  // Group Overview
  { key: "total_groups", label: "Total Groups", category: "Group Overview", subtitle: "All partner group templates", description: "Total number of Partner Group templates in the system. Each group acts as a template that pre-configures default settings (currency, payment terms, credit policy, etc.) for the partners linked to it.", example: "200 groups across all regions and partner scopes.", iconName: "Building2", iconBg: "rgb(var(--accent))", iconColor: "rgb(var(--primary))", formula: "count(groups)" },
  { key: "vendor_groups", label: "Vendor Groups", category: "Group Overview", subtitle: "All groups with vendor scope", description: "All partner groups whose scope includes vendor partners. Counts dual-scope groups (vendor + customer) as well, any group that applies to suppliers, carriers, or service providers is included here.", example: "120 vendor-only groups + 14 dual-scope groups = 134 Vendor Groups.", iconName: "Users", iconBg: "#EBF3FF", iconColor: "#0548A3", formula: "count(scope ∋ Vendor)" },
  { key: "customer_groups", label: "Customer Groups", category: "Group Overview", subtitle: "All groups with customer scope", description: "All partner groups whose scope includes customer partners. Counts dual-scope groups (vendor + customer) as well, any group that applies to buyers, distributors, or B2B clients is included here.", example: "120 customer-only groups + 14 dual-scope groups = 134 Customer Groups.", iconName: "Users", iconBg: "#F5F3FF", iconColor: "rgb(var(--violet))", formula: "count(scope ∋ Customer)" },
  // Usage
  { key: "partners_mapped", label: "Total Partners", category: "Usage", subtitle: "Partners across all groups", description: "Total number of partners across all partner groups. Each partner inherits its group's templated defaults (currency, payment terms, credit policy, etc.) when created.", example: "19,241 partners are currently spread across the 200 groups.", iconName: "Users", iconBg: "#F0FDF4", iconColor: "#16A34A", formula: "sum(group.partnerCount)" },
  { key: "avg_partners_per_group", label: "Avg Partners per Group", category: "Usage", subtitle: "Average partners per group", description: "Average number of partners per group. Calculated as total partners divided by the number of groups that have at least one partner linked. (Mathematical average, not the median.)", example: "19,241 partners ÷ 200 active groups ≈ 96 partners per group.", iconName: "TrendingUp", iconBg: "#FFF7ED", iconColor: "#EA580C", formula: "sum(partners) ÷ count(groups with partners)" },
  { key: "most_used_group", label: "Most-used Group", category: "Usage", subtitle: "Highest partner count", description: "The partner group with the largest number of linked partners. The card shows that partner count and its share of all partners on the left, with the group name on the right, useful for spotting where the bulk of your partner population is concentrated.", example: "312 (15%)  ·  Greater China, 312 of 2,080 partners sit in this one group.", iconName: "Crown", iconBg: "#FFFBEB", iconColor: "#B45309", formula: "argmax over group of partnerCount" },
  { key: "unused_groups", label: "Unused Groups", category: "Usage", subtitle: "Groups with no partners linked", description: "Partner groups that have zero linked partners. The templates are still available for use but no partner has been created under them yet.", example: "169 groups exist as templates but have no partners assigned yet.", iconName: "UserX", iconBg: "#FEF2F2", iconColor: "#DC2626", formula: "count(partnerCount = 0)" },
  // Status
  { key: "active_groups", label: "Active Groups", category: "Status", subtitle: "Groups currently active", description: "Partner groups with status set to Active. Only active groups appear in the group picker when creating a new partner.", example: "188 of 200 groups are Active and selectable when creating a partner.", iconName: "UserCheck", iconBg: "#ECFDF5", iconColor: "#059669", formula: "count(status = Active)" },
  { key: "inactive_groups", label: "Inactive Groups", category: "Status", subtitle: "Groups marked inactive", description: "Partner groups with status set to Inactive. They remain visible in the listing for reference but are hidden from the create-partner group picker.", example: "12 groups marked Inactive, visible in the listing, hidden from the picker.", iconName: "UserX", iconBg: "#FFFBEB", iconColor: "#D97706", formula: "count(status = Inactive)" },
];

function GroupKpiIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const props = { className, style } as const;
  switch (name) {
    case "Users": return <Users {...props} />;
    case "Building2": return <Building2 {...props} />;
    case "TrendingUp": return <TrendingUp {...props} />;
    case "Globe": return <Globe {...props} />;
    case "UserCheck": return <UserCheck {...props} />;
    case "UserX": return <UserX {...props} />;
    case "Check": return <Check {...props} />;
    case "ChartColumn": return <ChartColumn {...props} />;
    case "TagIcon": return <Tag {...props} />;
    case "ReceiptIcon": return <Receipt {...props} />;
    case "Crown": return <Star {...props} />;
    default: return <ChartColumn {...props} />;
  }
}

/* ─── Main page ─── */
export function PartnerGroupsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [showInsights, setShowInsights] = useState(true);
  const [insightsDateRange, setInsightsDateRange] = useState<InsightsRange>("last_30");
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["group"]));
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  // Default sort intentionally left empty — table loads in its natural source
  // order. Users can click any sortable column header to apply a sort.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const GROUP_DEFAULT_KPIS = ["total_groups", "partners_mapped", "most_used_group", "avg_partners_per_group", "unused_groups"];
  const [activeKpis, setActiveKpis] = useState<string[]>([...GROUP_DEFAULT_KPIS]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  /* Reset for the Insights strip — mirrors the Partners listing /
   * Vendor Invoicing pattern: grey until the band diverges from its
   * default set/order, red once there's something to reset. */
  const handleResetInsights = useCallback(() => {
    setActiveKpis([...GROUP_DEFAULT_KPIS]);
    toast.success("Insights reset to defaults");
  }, []);
  const insightsDirty = activeKpis.join(",") !== GROUP_DEFAULT_KPIS.join(",");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  // Tracks whether this tab was spawned solely to create a group (via the
  // "Create New Group" link inside the partner-creation modal). When set,
  // a successful creation closes the tab and hands focus back to the
  // originating tab instead of routing to the new group's detail page.
  const [spawnedForCreation, setSpawnedForCreation] = useState(false);
  const [detailGroup, setDetailGroup] = useState<EnrichedGroup | null>(null);
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [bulkApplyGroup, setBulkApplyGroup] = useState<EnrichedGroup | null>(null);
  const { vendors } = useVendors();
  const { groups: storeGroups, addGroup, updateGroup, upsertImportedGroups } = usePartnerGroups();

  // Lifecycle handler shared by the table + card grid menus. Persists
  // the new status into PartnerGroupsContext so the listing pill, the
  // detail-page header chrome, and the active-set filtering all stay
  // in sync without a router round-trip.
  const handleGroupStatusChange = useCallback((g: EnrichedGroup, next: GroupStatus) => {
    const base = storeGroups.find((s) => s.id === g.id);
    if (!base) return;
    updateGroup(g.id, { ...(base as unknown as Record<string, unknown>), status: next });
    const verb = next === "Active"
      ? (g.status === "Archived" ? "unarchived" : "marked as Active")
      : next === "Inactive"
        ? "marked as Inactive"
        : "archived";
    toast.success(`${g.name} ${verb}.`);
  }, [storeGroups, updateGroup]);

  // Row-menu lifecycle changes route through a confirmation step so the
  // listing matches the detail page exactly: Active/Inactive/Unarchive open
  // the shared confirm dialog, and Archive opens the reassignment flow when
  // the group is primary for any partner (else the simple confirm).
  const [pendingStatusChange, setPendingStatusChange] = useState<{ group: EnrichedGroup; mode: GroupStatusChangeMode } | null>(null);
  // Archive-with-primaries runs: reassign-confirm → reassignment modal.
  const [reassignConfirmGroup, setReassignConfirmGroup] = useState<EnrichedGroup | null>(null);
  const [archiveFlowGroup, setArchiveFlowGroup] = useState<EnrichedGroup | null>(null);
  const archiveFlowPrimaries = useMemo<Vendor[]>(
    () => (archiveFlowGroup ? getGroupPrimaryPartners(archiveFlowGroup, vendors) : []),
    [archiveFlowGroup, vendors],
  );
  const reassignConfirmCount = useMemo<number>(
    () => (reassignConfirmGroup ? getGroupPrimaryPartners(reassignConfirmGroup, vendors).length : 0),
    [reassignConfirmGroup, vendors],
  );
  const requestStatusChange = useCallback((g: EnrichedGroup, next: GroupStatus) => {
    const mode: GroupStatusChangeMode = next === "Inactive"
      ? "disable"
      : next === "Active"
        ? (g.status === "Archived" ? "unarchive" : "enable")
        : "archive";
    // Archiving a group that is primary for some partners requires
    // reassigning them first — open the confirmation gate, then the modal.
    if (mode === "archive" && getGroupPrimaryPartners(g, vendors).length > 0) {
      setReassignConfirmGroup(g);
      return;
    }
    setPendingStatusChange({ group: g, mode });
  }, [vendors]);

  const allGroups = useMemo(() => storeGroups.map(enrichGroup), [storeGroups]);

  /* Deep-link: ?group=<id> redirects to the dedicated detail page so the
     same URL keeps working for any external link / Step 1 picker → eye-icon
     handoff that previously opened the in-place modal. Also handles
     `?action=create` from the Create New Group link inside the partner-
     creation flow — opens the create modal directly so the user lands
     ready to fill in a new template. */
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get("group");
    if (requested) {
      navigate(`/partners/groups/${requested}`, { replace: true });
      return;
    }
    if (searchParams.get("action") === "create") {
      setCreateGroupOpen(true);
      setSpawnedForCreation(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* counts for quick filters — one pass over enriched groups */
  const filterCounts = useMemo(() => {
    const c: Record<QuickFilter, number> = {
      all: 0,
      vendor: 0,
      customer: 0,
      both: 0,
      active: 0,
      inactive: 0,
      archived: 0,
    };
    for (const g of allGroups) {
      // Archived rows don't count toward the default "Show All" total —
      // matching the listing rule that hides them unless the Archived
      // filter is explicitly selected.
      if (g.status === "Archived") {
        c.archived++;
        continue;
      }
      c.all++;
      if (g.templateType === "vendor") c.vendor++;
      else if (g.templateType === "customer") c.customer++;
      else c.both++;
      if (g.status === "Active") c.active++; else if (g.status === "Inactive") c.inactive++;
    }
    return c;
  }, [allGroups]);

  /* filter + sort + paginate */
  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);

  const columnLabels = useMemo(() => {
    const m: Record<string, string> = {};
    COLUMN_DEFS.forEach((c) => { m[c.key] = c.label; });
    return m;
  }, []);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const afterSearch = allGroups.filter((g) => {
      // Archived rows are excluded from every view EXCEPT the Archived
      // filter itself. Disabled (Inactive) rows stay visible in the
      // default view — that's the canonical archive-vs-disable rule.
      if (quickFilter !== "archived" && g.status === "Archived") return false;
      if (
        q &&
        !(
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q) ||
          (g.country || "").toLowerCase().includes(q)
        )
      ) return false;
      switch (quickFilter) {
        case "vendor": return g.templateType === "vendor";
        case "customer": return g.templateType === "customer";
        case "both": return g.templateType === "both";
        case "active": return g.status === "Active";
        case "inactive": return g.status === "Inactive";
        case "archived": return g.status === "Archived";
        default: return true;
      }
    });
    return applyGroupColumnFilters(afterSearch, columnFiltersList);
  }, [allGroups, searchQuery, quickFilter, columnFiltersList]);

  const sortedGroups = useMemo(() => {
    if (!sortConfig) return filteredGroups;
    const { key, direction } = sortConfig;
    const copy = [...filteredGroups];
    copy.sort((a, b) => {
      let av: string | number = ""; let bv: string | number = "";
      switch (key) {
        case "group": av = a.name; bv = b.name; break;
        case "type": av = a.templateType; bv = b.templateType; break;
        case "partners": av = a.partnerCount; bv = b.partnerCount; break;
        case "description": av = a.description; bv = b.description; break;
        case "created_on": av = new Date(a.createdOn).getTime(); bv = new Date(b.createdOn).getTime(); break;
        case "created_by": av = a.createdBy?.name || ""; bv = b.createdBy?.name || ""; break;
        case "last_updated_on": av = new Date(getLastUpdated(a.id, a.createdOn).date).getTime(); bv = new Date(getLastUpdated(b.id, b.createdOn).date).getTime(); break;
        case "last_updated_by": av = getLastUpdated(a.id, a.createdOn).name; bv = getLastUpdated(b.id, b.createdOn).name; break;
        case "status": av = a.status; bv = b.status; break;
        case "country": av = a.country || ""; bv = b.country || ""; break;
        default: av = a.name; bv = b.name;
      }
      if (typeof av === "number" && typeof bv === "number") return direction === "asc" ? av - bv : bv - av;
      return direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [filteredGroups, sortConfig]);

  // "All" is represented by perPage === -1.
  const effectivePerPage = perPage === -1 ? Math.max(1, sortedGroups.length) : perPage;
  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / effectivePerPage));
  const pageSafe = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => sortedGroups.slice((pageSafe - 1) * effectivePerPage, pageSafe * effectivePerPage), [sortedGroups, pageSafe, effectivePerPage]);

  /* ─── Global empty / error states ─── */
  const tableLoad = useTableLoadState();
  // Insight cards come from the same failed load: show the card's
  // "Couldn't load" state instead of numbers (no value, no trend).
  const insightsFailed = tableLoad.loadState === "error";
  const filterLayerCount = (quickFilter !== "all" ? 1 : 0) + Object.keys(columnFilters).length;
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : allGroups.length,
    filteredCount: tableLoad.forceEmpty ? 0 : sortedGroups.length,
    pageCount: paginated.length,
    searchQuery,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(searchQuery, allGroups.flatMap((g) => [g.name, g.description, g.id, g.country]));
  }, [emptyKind, searchQuery, allGroups]);
  const emptyStateProps: TableEmptyStateProps | null = emptyKind && {
    kind: emptyKind,
    entity: { singular: "partner group", plural: "partner groups" },
    searchQuery,
    suggestion: searchSuggestion,
    onApplySuggestion: (s: string) => { setSearchQuery(s); setCurrentPage(1); },
    filterCount: filterLayerCount,
    onClearSearch: () => { setSearchQuery(""); setCurrentPage(1); },
    onClearFilters: () => { setQuickFilter("all"); setColumnFilters({}); setCurrentPage(1); },
    onClearAll: () => { setSearchQuery(""); setQuickFilter("all"); setColumnFilters({}); setCurrentPage(1); },
    onRetry: tableLoad.retry,
    retrying: tableLoad.retrying,
    onFirstPage: () => setCurrentPage(1),
    onCreate: () => setCreateGroupOpen(true),
    createLabel: "Create New Group",
  };

  // Matches VendorsListPage.tsx getPageNumbers — ellipsis when more than 7 pages.
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (pageSafe > 3) pages.push("...");
      const start = Math.max(2, pageSafe - 1);
      const end = Math.min(totalPages - 1, pageSafe + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (pageSafe < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  /* ─── Column-header menu handlers ─── */
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const f = createBlankFilter(columnKey);
      f.type = getGroupFilterType(columnKey);
      return { ...prev, [columnKey]: f };
    });
    setCurrentPage(1);
  }, []);

  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const f = createBlankFilter(columnKey);
      f.type = getGroupFilterType(columnKey);
      return { ...prev, [columnKey]: f };
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
    setSortConfig(direction === null ? null : { key, direction });
    setCurrentPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    setColumnFilters((prev) => {
      if (!prev[columnKey]) return prev;
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
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
      if (next.has(columnKey) && columnKey !== "group") next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  /* ─── Column drag reorder (custom mouse-event based) ─── */
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

  const colDef = useCallback((key: string) => COLUMN_DEFS.find((c) => c.key === key)!, []);

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
  }, [columnWidths, colDef]);

  /* ─── Visible columns in user-defined order (always puts "group" first) ─── */
  const validColumnKeys = useMemo(() => new Set(COLUMN_DEFS.map((c) => c.key)), []);
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(
      (key) => validColumnKeys.has(key) && columnVisibility[key] !== false,
    );
    if (!ordered.includes("group")) ordered.unshift("group");
    else if (ordered[0] !== "group") {
      const idx = ordered.indexOf("group");
      ordered.splice(idx, 1);
      ordered.unshift("group");
    }
    return ordered;
  }, [columnOrder, columnVisibility, validColumnKeys]);

  /* ─── Cumulative left pixel offsets for frozen columns ─── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths, colDef]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ─── Per-column unique values for multiselect filter menus ─── */
  const groupUniqueValuesMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const key of MULTISELECT_COLUMNS) {
      m[key] = getUniqueGroupValues(key, allGroups);
    }
    return m;
  }, [allGroups]);

  const toggleRowSel = (id: string) => {
    setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const allPageSelected = paginated.length > 0 && paginated.every((g) => selectedIds.has(g.id));
  const togglePageSel = () => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (allPageSelected) paginated.forEach((g) => n.delete(g.id));
      else paginated.forEach((g) => n.add(g.id));
      return n;
    });
  };

  /* ─── Drag-to-select consecutive rows ─── */
  const dragSelectRef = useRef<{
    anchorId: string;
    anchorIndex: number;
    mode: "add" | "remove";
    touched: Set<string>;
    baseline: Set<string>;
  } | null>(null);

  const visibleRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    paginated.forEach((g, i) => map.set(g.id, i));
    return map;
  }, [paginated]);

  const handleCheckboxMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const idx = visibleRowIndex.get(id);
    if (idx === undefined) return;
    setSelectedIds((prev) => {
      const baseline = new Set(prev);
      const isSelected = baseline.has(id);
      const mode: "add" | "remove" = isSelected ? "remove" : "add";
      dragSelectRef.current = { anchorId: id, anchorIndex: idx, mode, touched: new Set<string>([id]), baseline };
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
    const [lo, hi] = drag.anchorIndex <= idx ? [drag.anchorIndex, idx] : [idx, drag.anchorIndex];
    setSelectedIds(() => {
      const next = new Set(drag.baseline);
      drag.touched.forEach((tid) => {
        const tIdx = visibleRowIndex.get(tid);
        if (tIdx === undefined || tIdx < lo || tIdx > hi) {
          if (drag.baseline.has(tid)) next.add(tid); else next.delete(tid);
        }
      });
      for (let i = lo; i <= hi; i++) {
        const rowId = paginated[i]?.id;
        if (!rowId) continue;
        drag.touched.add(rowId);
        if (drag.mode === "add") next.add(rowId); else next.delete(rowId);
      }
      return next;
    });
  }, [paginated, visibleRowIndex]);

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
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size]);

  /* ─── Bulk actions ─── */
  const [bulkConfirm, setBulkConfirm] = useState<"inactive" | "active" | "archive" | null>(null);

  const selectedGroups = useMemo(
    () => allGroups.filter((g) => selectedIds.has(g.id)),
    [allGroups, selectedIds],
  );

  /* Per-action target subsets — excludes rows where the action wouldn't apply. */
  const markInactiveTargets = useMemo(
    () => selectedGroups.filter((g) => g.status === "Active"),
    [selectedGroups],
  );
  const markActiveTargets = useMemo(
    () => selectedGroups.filter((g) => g.status === "Inactive"),
    [selectedGroups],
  );
  const archiveTargets = useMemo(
    () => selectedGroups.filter((g) => g.status !== "Archived"),
    [selectedGroups],
  );

  /* ─── Import / Export (Actions menu, Export modal, Import wizard) ───
   * Archived groups never reach the export flow or its counts. Member names
   * are resolved from the vendor store since the record only holds ids. */
  const toExportRow = useCallback(
    (g: EnrichedGroup): GroupExportRow => ({
      ...(g as GroupExportRow),
      memberNames: getGroupLinkedPartners(g, vendors).map((v) => v.displayName),
      primaryMemberNames: getGroupPrimaryPartners(g, vendors).map((v) => v.displayName),
    }),
    [vendors],
  );
  const exportableGroups = useMemo(() => allGroups.filter((g) => g.status !== "Archived").map(toExportRow), [allGroups, toExportRow]);
  const exportableFilteredGroups = useMemo(() => sortedGroups.filter((g) => g.status !== "Archived").map(toExportRow), [sortedGroups, toExportRow]);
  const groupReferenceOptions = useMemo(() => ({ partners: vendors.map((v) => v.displayName).filter(Boolean) }), [vendors]);
  const importExport = useListingImportExport({
    spec: PARTNER_GROUPS_IMPORT_SPEC,
    allRows: exportableGroups,
    filteredRows: exportableFilteredGroups,
    isFiltered: () => !!searchQuery.trim() || quickFilter !== "all" || columnFiltersList.length > 0,
    clearFilters: () => {
      setSearchQuery("");
      setQuickFilter("all");
      setColumnFilters({});
      setCurrentPage(1);
    },
    selectAll: () => setSelectedIds(new Set(sortedGroups.filter((g) => g.status !== "Archived").map((g) => g.id))),
    columnVisibility,
    buildValidationContext: () => buildValidationContext(PARTNER_GROUPS_IMPORT_SPEC, vendors, storeGroups),
    referenceOptions: groupReferenceOptions,
    onApplied: ({ created, updated }) => {
      const result = upsertImportedGroups([...created, ...updated], { partners: vendors });
      setCurrentPage(1);
      return result;
    },
  });
  const openSelectedExport = importExport.openSelectedExport;

  const handleBulkExport = useCallback(() => {
    if (selectedGroups.length === 0) return;
    openSelectedExport(selectedGroups.filter((g) => g.status !== "Archived").map(toExportRow));
  }, [selectedGroups, openSelectedExport, toExportRow]);

  const handleBulkMarkInactive = useCallback(() => {
    markInactiveTargets.forEach((g) => handleGroupStatusChange(g, "Inactive"));
    setSelectedIds(new Set());
    setBulkConfirm(null);
  }, [markInactiveTargets, handleGroupStatusChange]);

  const handleBulkMarkActive = useCallback(() => {
    markActiveTargets.forEach((g) => handleGroupStatusChange(g, "Active"));
    setSelectedIds(new Set());
    setBulkConfirm(null);
  }, [markActiveTargets, handleGroupStatusChange]);

  const handleBulkArchive = useCallback(() => {
    archiveTargets.forEach((g) => handleGroupStatusChange(g, "Archived"));
    setSelectedIds(new Set());
    setBulkConfirm(null);
  }, [archiveTargets, handleGroupStatusChange]);

  const bulkActions: BulkAction[] = useMemo(() => [
    { key: "export", label: "Export", icon: Download, onClick: handleBulkExport, tone: "neutral", count: selectedGroups.length },
    { key: "active", label: "Mark as Active", icon: CircleCheck, onClick: () => setBulkConfirm("active"), tone: "success", count: markActiveTargets.length },
    { key: "inactive", label: "Mark as Inactive", icon: CircleSlash, onClick: () => setBulkConfirm("inactive"), tone: "warning", count: markInactiveTargets.length },
    { key: "archive", label: "Archive", icon: Archive, onClick: () => setBulkConfirm("archive"), tone: "destructive", count: archiveTargets.length },
  ], [handleBulkExport, selectedGroups.length, markActiveTargets.length, markInactiveTargets.length, archiveTargets.length]);

  /* Build extended KPI value map — shared by inline cards + drawer.
   *
   * Each entry is { value, subValue? }. The optional `subValue` powers
   * the small secondary line under the main value — currently only
   * Most-used Group uses it, so the group name doesn't truncate when
   * the count + percentage are appended. */
  const kpiValueMap = useMemo(() => {
    const total = allGroups.length;
    const partnersMapped = allGroups.reduce((s, g) => s + g.partnerCount, 0);
    const active = allGroups.filter((g) => g.status === "Active").length;
    const inactive = allGroups.filter((g) => g.status === "Inactive").length;
    // Average is computed against groups that actually have at least one
    // partner — divisor matches the description so the value is meaningful
    // even when many group templates are empty.
    const groupsWithPartners = allGroups.filter((g) => g.partnerCount > 0).length;
    const avg = groupsWithPartners === 0 ? 0 : Math.round(partnersMapped / groupsWithPartners);
    const mostUsed = allGroups.reduce((best, g) => (!best || g.partnerCount > best.partnerCount ? g : best), allGroups[0]);
    // Vendor + Customer KPIs count dual-scope ("both") groups in both
    // buckets, per Eli's clarification — "Vendor Groups" means "all groups
    // a vendor partner could land in", not "vendor-only groups".
    const vendorGroups = allGroups.filter((g) => g.templateType === "vendor" || g.templateType === "both").length;
    const customerGroups = allGroups.filter((g) => g.templateType === "customer" || g.templateType === "both").length;
    const unusedGroups = allGroups.filter((g) => g.partnerCount === 0).length;
    // Most-used: number + share on the left of the value line, group
    // name as a smaller pill on the right of the same line. Keeps the
    // card the same height as every other KPI (no stacked sub-line).
    let mostUsedValue = "—";
    let mostUsedSub: string | undefined;
    if (mostUsed && mostUsed.partnerCount > 0) {
      const pct = partnersMapped > 0
        ? Math.round((mostUsed.partnerCount / partnersMapped) * 100)
        : 0;
      mostUsedValue = `${mostUsed.partnerCount.toLocaleString()} (${pct}%)`;
      mostUsedSub = mostUsed.name;
    }
    const m: Record<string, { value: string; subValue?: string }> = {
      total_groups: { value: total.toString() },
      vendor_groups: { value: vendorGroups.toString() },
      customer_groups: { value: customerGroups.toString() },
      partners_mapped: { value: partnersMapped.toLocaleString() },
      avg_partners_per_group: { value: avg.toString() },
      most_used_group: { value: mostUsedValue, subValue: mostUsedSub },
      unused_groups: { value: unusedGroups.toString() },
      active_groups: { value: active.toString() },
      inactive_groups: { value: inactive.toString() },
    };
    return m;
  }, [allGroups]);

  /* Build KPI definitions — preserves active-KPI order for rendering */
  const kpiDefs: KpiDef[] = useMemo(() => {
    return activeKpis
      .map((k) => {
        const cat = GROUP_KPI_CATALOG.find((c) => c.key === k);
        if (!cat) return null;
        const v = kpiValueMap[cat.key];
        // Growth direction per metric — drives delta tone (more unused/
        // inactive groups = bad). Most-used Group skips the delta: it's
        // a name card, not a trendable scalar.
        const growthIsGood = !["unused_groups", "inactive_groups"].includes(cat.key);
        const numeric = cat.key === "most_used_group" ? 0 : parseFloat((v?.value ?? "").replace(/[^0-9.]/g, "")) || 0;
        return {
          key: cat.key,
          label: cat.label,
          value: v?.value ?? "—",
          subValue: v?.subValue,
          icon: <GroupKpiIcon name={cat.iconName} className="w-3.5 h-3.5" />,
          tooltip: cat.description,
          example: cat.example,
          delta: buildSeededDelta(`groups_${cat.key}`, insightsDateRange, numeric, growthIsGood),
          rangeLabel: insightsRangePeriodLabel(insightsDateRange),
          formula: cat.formula,
        } as KpiDef;
      })
      .filter((d): d is KpiDef => d !== null);
  }, [activeKpis, kpiValueMap, insightsDateRange]);

  const toggleKpi = (key: string) => {
    setActiveKpis((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const enableAllKpis = () => setActiveKpis(GROUP_KPI_CATALOG.map((k) => k.key));
  const disableAllKpis = () => setActiveKpis([]);
  const moveKpi = (from: number, to: number) => {
    setActiveKpis((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const visibleCount = visibleColumns.length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ─── Top Bar: breadcrumb + search + profile ─── */}
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
          <span style={{ fontWeight: 500 }} className="text-foreground">Partner Groups</span>
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

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="p-3 flex-1 min-h-0 flex flex-col">
          {/* ─── Page Header ─── */}
          <div data-page-heading className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 -mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgb(var(--accent))" }}>
                <Users className="w-4 h-4" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Partner Groups</h1>
                <p className="text-xs text-muted-foreground">
                  Organize vendors, customers, and service partners into regions, families, and industries.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {importExport.actionsMenu}
              <Button
                onClick={() => setCreateGroupOpen(true)}
                className="bg-primary text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create New Group
              </Button>
            </div>
          </div>

          {/* ─── Performance Insights — collapsible ─── */}
          {showInsights && kpiDefs.length > 0 && (
            <div className="mb-4 shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
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
                    <Plus className="w-3 h-3" /> Add Insights
                  </button>
                </div>
              </div>
              <DndProvider backend={HTML5Backend}>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                  {kpiDefs.map((def, idx) => (
                    <DraggableGroupKpiCard
                      key={def.key}
                      index={idx}
                      def={insightsFailed ? { ...def, value: "—", subValue: "Couldn't load", delta: undefined } : def}
                      moveCard={moveKpi}
                      onRemove={() => toggleKpi(def.key)}
                    />
                  ))}
                </div>
              </DndProvider>
            </div>
          )}

          {importExport.notice}

          {/* ─── Unified Table Container ─── */}
          <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-clip">
            <div className="flex-1 min-w-0 flex flex-col overflow-clip">
              {/* Row 1: Search + Filters ... Count + Density + Columns */}
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      placeholder="Search by name or country..."
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
                  <button
                    type="button"
                    onClick={() => toast.info("Advanced filters, coming soon")}
                    className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span data-table-meta className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                    {filteredGroups.length !== allGroups.length ? (
                      <>
                        <span className="text-foreground">{filteredGroups.length}</span>
                        <span className="text-muted-foreground/60"> of </span>
                        <span className="text-muted-foreground">{allGroups.length}</span>
                        <span className="text-muted-foreground/70"> groups</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground">{allGroups.length}</span>
                        <span className="text-muted-foreground/70"> groups</span>
                      </>
                    )}
                  </span>

                  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                  {/* Insights toggle */}
                  <button
                    type="button"
                    onClick={() => { if (!showInsights) setShowInsights(true); setInsightsPanelOpen(true); }}
                    className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      insightsPanelOpen ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                    <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                    {kpiDefs.length > 0 && (
                      <span
                        className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                        style={{ backgroundColor: "rgb(var(--accent))", color: "rgb(var(--primary))", fontWeight: 600 }}
                      >
                        {kpiDefs.length}
                      </span>
                    )}
                  </button>

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
                          {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                      {DENSITY_CONFIG.map((opt) => (
                        <DropdownMenuItem
                          key={opt.key}
                          className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                          onSelect={(e) => { if (opt.key === "card") e.preventDefault(); setDensity(opt.key); }}
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
                                    cardSize === size ? "bg-primary text-white shadow-sm" : "bg-muted text-slate-500 hover:bg-border"
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

                  {/* Columns selector — disabled (greyed) in card view
                      since column visibility doesn't apply to cards.
                      Standard pattern across all data tables with a
                      density toggle. */}
                  <ColumnSelectorTrigger
                    visibleCount={visibleCount}
                    active={columnDrawerOpen}
                    disabled={density === "card"}
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />
                </div>
              </div>

              {/* Row 2: Quick filter pills — replaced by the Bulk Action Bar
                  when one or more rows are selected, so users see actions in
                  the same horizontal slot instead of stacking two toolbars. */}
              {selectedIds.size > 0 ? (
                <BulkActionBar
                  count={selectedIds.size}
                  noun="group"
                  actions={bulkActions}
                  onClear={clearSelection}
                />
              ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors whitespace-nowrap shrink-0 cursor-pointer">
                  <Users className="w-3.5 h-3.5" />
                  Me Mode
                </button>
                <div className="w-px h-5 bg-border shrink-0" />
                {QUICK_FILTER_OPTIONS.map((filter) => {
                  const isActive = quickFilter === filter.key;
                  const count = filterCounts[filter.key];
                  const isDestructive = filter.tone === "destructive";
                  // Archived pill carries a red accent — both at rest and
                  // when active — to signal the destructive/terminal state.
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
                      onClick={() => { setQuickFilter(filter.key); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${baseClass}`}
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive
                          ? (isDestructive ? "rgb(var(--destructive))" : "rgb(var(--primary))")
                          : (isDestructive ? "rgb(var(--destructive))" : undefined),
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
                              ? (isDestructive ? "rgb(var(--destructive))" : "rgb(var(--primary))")
                              : (isDestructive ? "rgb(var(--destructive))" : "rgb(var(--muted-foreground))"),
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
                vendors={[]}
                uniqueValuesByKey={groupUniqueValuesMap}
                lockedColumnKey="group"
                onFilterChange={handleColumnFilterChange}
                onRemoveFilter={handleRemoveColumnFilter}
                onAddFilter={handleAddColumnFilterWithAutoOpen}
                onClearAll={handleClearAllColumnFilters}
                autoOpenKey={autoOpenFilterKey}
                onAutoOpened={handleAutoOpened}
                availableColumns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
              />

              {/* Content */}
              <div className={`flex-1 overflow-auto min-h-0 border-t border-border ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                {density === "card" ? (
                  <CardGrid
                    loading={tableLoad.loadState === "loading"}
                    emptyState={emptyStateProps}
                    groups={paginated}
                    size={cardSize}
                    onSelect={toggleRowSel}
                    selected={selectedIds}
                    onOpen={(g) => navigate(`/partners/groups/${g.id}`)}
                  />
                ) : (
                  <GroupsListingTable
                    groups={paginated}
                    density={density}
                    visibleColumns={visibleColumns}
                    columnWidths={columnWidths}
                    columnFilters={columnFilters}
                    sortConfig={sortConfig}
                    frozenColumns={frozenColumns}
                    frozenOffsets={frozenOffsets}
                    lastFrozenKey={lastFrozenKey}
                    draggingColumnKey={draggingColumnKey}
                    resizingColumnKey={resizingColumnKey}
                    suppressNextClickRef={suppressNextClickRef}
                    onHeaderMouseDown={handleHeaderMouseDown}
                    onResizeStart={handleResizeStart}
                    onResizeReset={(key) => setColumnWidths((prev) => ({ ...prev, [key]: parseInt(colDef(key).minWidth, 10) }))}
                    onSort={handleSort}
                    onAddFilter={handleAddColumnFilter}
                    onHideColumn={handleHideColumn}
                    onFreezeColumn={handleFreezeColumn}
                    onFilterChange={handleColumnFilterChange}
                    groupUniqueValuesMap={groupUniqueValuesMap}
                    selectedIds={selectedIds}
                    onRowSel={toggleRowSel}
                    allPageSelected={allPageSelected}
                    onTogglePage={togglePageSel}
                    onCheckboxMouseDown={handleCheckboxMouseDown}
                    onCheckboxMouseEnter={handleCheckboxMouseEnter}
                    isBulkMode={selectedIds.size > 0}
                    onRowOpen={(g) => navigate(`/partners/groups/${g.id}`)}
                    onRowStatusChange={requestStatusChange}
                    searchQuery={searchQuery}
                    loading={tableLoad.loadState === "loading"}
                    emptyState={emptyStateProps}
                  />
                )}
              </div>

              {/* (Column selector drawer relocated — see below just before the outer table-container close) */}
              {/* Pagination — mirrors VendorsListPage for visual parity */}
              {sortedGroups.length > 0 && (
                <div data-table-meta className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per Page</span>
                    <Select
                      value={perPage === -1 ? "all" : String(perPage)}
                      onValueChange={(val) => { setPerPage(val === "all" ? -1 : Number(val)); setCurrentPage(1); }}
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
                      disabled={pageSafe === 1}
                      onClick={() => setCurrentPage(1)}
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-sm text-muted-foreground"
                      disabled={pageSafe === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>

                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={page}
                          variant={pageSafe === page ? "default" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 text-sm ${
                            pageSafe === page
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
                      disabled={pageSafe === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={pageSafe === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {/* Column Selector Side Drawer — sibling of the table wrapper so it
                animates width in-line (matches VendorsListPage layout). */}
            <ColumnSelector
              columns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
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

      {/* ─── Customize Widgets side drawer ─── */}
      <GroupKpiDrawer
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpis}
        onToggle={toggleKpi}
        onEnableAll={enableAllKpis}
        onDisableAll={disableAllKpis}
        valueMap={kpiValueMap}
      />

      {importExport.modals}

      {/* ─── Create Partner Group (forked from Partner create) ─── */}
      <CreatePartnerGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onPartnerCreated={(data) => {
          const created = addGroup(data);
          toast.success(`Partner group "${created.name}" created`);
          // If this tab was spawned from another tab's "Create New Group"
          // CTA (?action=create), broadcast the new group so the
          // originating tab's group picker can show it + toast, then
          // close ourselves. Otherwise route into the newly-created
          // group's details page.
          if (spawnedForCreation) {
            broadcastSpawnedCreation({ kind: "group", payload: created });
            window.close();
            return;
          }
          navigate(`/partners/groups/${created.id}`);
        }}
      />

      {/* ─── Detail modal (Setup tab + Partners tab) ─── */}
      <PartnerGroupDetailModal
        group={detailGroup}
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        onPricingRuleSaveRequest={(g) => {
          setBulkApplyGroup(g as EnrichedGroup);
          setBulkApplyOpen(true);
        }}
      />

      {/* ─── Bulk-apply pricing-rule change modal ─── */}
      <GroupBulkApplyModal
        open={bulkApplyOpen}
        onOpenChange={setBulkApplyOpen}
        groupName={bulkApplyGroup?.name || ""}
        linkedPartners={bulkApplyGroup
          ? vendors.slice(0, Math.min(vendors.length, bulkApplyGroup.partnerCount))
          : []}
        change={bulkApplyGroup
          ? ({
              settingLabel: "Bulk Fastener Discount",
              previousValue: "5% at 100 EA",
              nextValue: "8% at 100 EA",
            } as GroupBulkApplyChange)
          : null}
        onSaveTemplateOnly={() => {
          setBulkApplyOpen(false);
          toast.success("Template updated, new partners will inherit the change.");
        }}
        onSaveAndApply={(ids) => {
          setBulkApplyOpen(false);
          toast.success(`Template updated and applied to ${ids.length} linked ${ids.length === 1 ? "partner" : "partners"}.`);
        }}
      />

      {/* ─── Bulk status confirm (active / inactive / archive) ─── */}
      <AlertDialog open={bulkConfirm !== null} onOpenChange={(open) => { if (!open) setBulkConfirm(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setBulkConfirm(null)}
        >
          {bulkConfirm === "active" ? (() => {
            const targets = markActiveTargets;
            const total = selectedGroups.length;
            return (
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
                      Mark {targets.length} group{targets.length === 1 ? "" : "s"} as Active?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {total > targets.length && (
                      <span className="block mb-1.5 text-emerald-700" style={{ fontWeight: 500 }}>
                        {total - targets.length} of {total} selected are already active or archived and will be skipped.
                      </span>
                    )}
                    These groups will reappear in pickers and become available for new assignments again.
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={handleBulkMarkActive} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}>
                      Mark {targets.length} as Active
                    </AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                      Cancel
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })() : bulkConfirm === "inactive" ? (() => {
            const targets = markInactiveTargets;
            const total = selectedGroups.length;
            return (
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
                      Mark {targets.length} group{targets.length === 1 ? "" : "s"} as Inactive?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {total > targets.length && (
                      <span className="block mb-1.5 text-amber-700" style={{ fontWeight: 500 }}>
                        {total - targets.length} of {total} selected are already inactive or archived and will be skipped.
                      </span>
                    )}
                    These groups stop appearing in pickers and are excluded from new assignments. Existing assignments stay exactly as-is.
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={handleBulkMarkInactive} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}>
                      Mark {targets.length} as Inactive
                    </AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                      Keep Active
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })() : (() => {
            const targets = archiveTargets;
            const total = selectedGroups.length;
            return (
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
                      Archive {targets.length} group{targets.length === 1 ? "" : "s"}?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {total > targets.length && (
                      <span className="block mb-1.5 text-destructive" style={{ fontWeight: 500 }}>
                        {total - targets.length} of {total} selected are already archived and will be skipped.
                      </span>
                    )}
                    These groups will be removed from active workflows. Templates and historical records are preserved and you can unarchive later.
                  </AlertDialogDescription>
                  {targets.length > 0 && targets.length <= 6 && (
                    <ul className="mt-4 w-full text-left text-[12px] space-y-1 max-h-[120px] overflow-y-auto px-3">
                      {targets.map((g) => (
                        <li key={g.id} className="text-muted-foreground truncate">• {g.name}</li>
                      ))}
                    </ul>
                  )}
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={handleBulkArchive} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}>
                      Archive {targets.length} Group{targets.length === 1 ? "" : "s"}
                    </AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
                      Cancel
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Row-menu lifecycle confirm — same dialog the detail-page header
          menu uses (Active / Inactive / Unarchive, and Archive when the
          group has no primary partners). */}
      <GroupStatusChangeDialog
        open={!!pendingStatusChange}
        onOpenChange={(o) => { if (!o) setPendingStatusChange(null); }}
        groupName={pendingStatusChange?.group.name || ""}
        mode={pendingStatusChange?.mode || "archive"}
        onConfirm={() => {
          if (!pendingStatusChange) return;
          const { group, mode } = pendingStatusChange;
          const next: GroupStatus = mode === "disable" ? "Inactive" : mode === "archive" ? "Archived" : "Active";
          handleGroupStatusChange(group, next);
          setPendingStatusChange(null);
        }}
      />

      {/* Reassign-first gate — the confirmation modal that precedes the
          reassignment flow when the group is primary for some partners. */}
      <GroupStatusChangeDialog
        open={!!reassignConfirmGroup}
        onOpenChange={(o) => { if (!o) setReassignConfirmGroup(null); }}
        groupName={reassignConfirmGroup?.name || ""}
        mode="archive"
        reassignCount={reassignConfirmCount}
        onConfirm={() => {
          setArchiveFlowGroup(reassignConfirmGroup);
          setReassignConfirmGroup(null);
        }}
      />

      {/* Archive with reassignment — opens after the gate above when the
          group is primary for one or more partners. */}
      <ArchivePartnerGroupModal
        open={!!archiveFlowGroup}
        onOpenChange={(o) => { if (!o) setArchiveFlowGroup(null); }}
        groupId={archiveFlowGroup?.id || ""}
        groupName={archiveFlowGroup?.name || ""}
        primaryPartners={archiveFlowPrimaries}
        onArchived={({ assignments, push }) => {
          if (archiveFlowGroup) {
            handleGroupStatusChange(archiveFlowGroup, "Archived");
            const count = Object.keys(assignments).length;
            // handleGroupStatusChange already toasts the archive; add a
            // follow-up note about the reassignment outcome.
            toast.success(
              `${count} ${count === 1 ? "partner" : "partners"} reassigned${push ? " and updated to their new group's configuration." : "; configurations left unchanged."}`,
            );
          }
          setArchiveFlowGroup(null);
        }}
      />

      {/* ─── Column drag ghost — positioned via ref for zero re-renders ─── */}
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
        document.body,
      )}
    </div>
  );
}

/* ─── Customize Widgets drawer — mirrors listing KpiInsightsPanel exactly ─── */
function GroupKpiDrawer({
  open, onOpenChange, activeKpis, onToggle, onEnableAll, onDisableAll, valueMap,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeKpis: string[];
  onToggle: (key: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  valueMap: Record<string, { value: string; subValue?: string }>;
}) {
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const categories = useMemo(() => {
    const map = new Map<string, GroupKpiCatalogEntry[]>();
    const q = search.trim().toLowerCase();
    for (const entry of GROUP_KPI_CATALOG) {
      if (q && !(entry.label.toLowerCase().includes(q) || entry.category.toLowerCase().includes(q))) continue;
      if (!map.has(entry.category)) map.set(entry.category, []);
      map.get(entry.category)!.push(entry);
    }
    return Array.from(map.entries()).map(([name, kpis]) => ({ name, kpis }));
  }, [search]);

  const activeCount = activeKpis.length;
  const totalCount = GROUP_KPI_CATALOG.length;
  const allActive = activeCount === totalCount;
  const noneActive = activeCount === 0;

  if (!mounted) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: visible ? "auto" : "none" }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
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
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPIs.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle-all row */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {totalCount} widgets active
            </span>
            <button
              onClick={() => { if (allActive) onDisableAll(); else onEnableAll(); }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : noneActive
                    ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                    : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive
                ? <><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>
                : noneActive
                  ? <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
                  : <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
              }
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-0 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Separator */}
        <div className="border-b border-muted mt-3 shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              {/* Category header */}
              <div className="flex items-center gap-1.5 mb-2">
                {cat.name === "Group Overview" && <Building2 className="w-4 h-4 text-muted-foreground" />}
                {cat.name === "Usage" && <Users className="w-4 h-4 text-muted-foreground" />}
                {cat.name === "Templates" && <Tag className="w-4 h-4 text-muted-foreground" />}
                {cat.name === "Status" && <ChartColumn className="w-4 h-4 text-muted-foreground" />}
                <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>
                  {cat.name}
                </span>
              </div>
              {/* KPI cards — 2-column compact */}
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const entry = valueMap[kpi.key];
                  const value = entry?.value ?? "—";
                  const subValue = entry?.subValue;
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggle(kpi.key)}
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
                          title={kpi.label}
                        >
                          {kpi.label}
                        </span>
                        <div className="shrink-0">
                          {isActive
                            ? <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
                            : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          }
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-1 min-w-0">
                        <p className={`text-[15px] transition-colors truncate shrink-0 ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>
                          {value}
                        </p>
                        {subValue && (
                          <p className="text-[11px] text-muted-foreground/70 truncate text-right min-w-0" style={{ fontWeight: 500 }} title={subValue}>
                            {subValue}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Listing-style table (ported from VendorsListPage) ─── */
interface GroupsListingTableProps {
  groups: EnrichedGroup[];
  density: DensityOption;
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  columnFilters: Record<string, ColumnFilterState>;
  sortConfig: SortConfig | null;
  frozenColumns: Set<string>;
  frozenOffsets: Record<string, number>;
  lastFrozenKey: string;
  draggingColumnKey: string | null;
  resizingColumnKey: string | null;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  onHeaderMouseDown: (e: React.MouseEvent, columnKey: string) => void;
  onResizeStart: (e: React.MouseEvent, columnKey: string) => void;
  onResizeReset: (columnKey: string) => void;
  onSort: (key: string, direction: "asc" | "desc" | null) => void;
  onAddFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  onFreezeColumn: (columnKey: string) => void;
  onFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  groupUniqueValuesMap: Record<string, string[]>;
  selectedIds: Set<string>;
  onRowSel: (id: string) => void;
  allPageSelected: boolean;
  onTogglePage: () => void;
  onCheckboxMouseDown: (e: React.MouseEvent, id: string) => void;
  onCheckboxMouseEnter: (id: string) => void;
  /** When any row is selected, the table flips into bulk-action mode:
   *  Actions column is hidden and row clicks toggle selection. */
  isBulkMode: boolean;
  onRowOpen?: (g: EnrichedGroup) => void;
  /** Lifecycle action triggered from the row's three-dot menu. The page
   *  passes a callback that mutates the underlying record via
   *  PartnerGroupsContext.updateGroup so the listing pill + detail page
   *  stay in sync without a roundtrip. */
  onRowStatusChange?: (g: EnrichedGroup, next: GroupStatus) => void;
  /** Current search input — passed through so name/description cells
   *  can render matched substrings via highlightMatch. */
  searchQuery?: string;
  loading?: boolean;
  emptyState?: TableEmptyStateProps | null;
}

function GroupsListingTable({
  groups,
  density,
  visibleColumns,
  columnWidths,
  columnFilters,
  sortConfig,
  frozenColumns,
  frozenOffsets,
  lastFrozenKey,
  draggingColumnKey,
  resizingColumnKey,
  suppressNextClickRef,
  onHeaderMouseDown,
  onResizeStart,
  onResizeReset,
  onSort,
  onAddFilter,
  onHideColumn,
  onFreezeColumn,
  onFilterChange,
  groupUniqueValuesMap,
  selectedIds,
  onRowSel,
  allPageSelected,
  onTogglePage,
  onCheckboxMouseDown,
  onCheckboxMouseEnter,
  isBulkMode,
  onRowOpen,
  onRowStatusChange,
  searchQuery = "",
  loading,
  emptyState,
}: GroupsListingTableProps) {
  const isRelaxed = density === "comfort";
  // Use cell-padding rather than a fixed row height — matches VendorsListPage
  // (lines 2425-2429). Explicit row heights ran tall because default TableCell
  // padding (py-2 ≈ 16px) added on top of the 40px floor. Content-driven
  // heights keep condensed rows at ~41px parity with Partners listing.
  const rowPadClass = isRelaxed
    ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
    : "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2";
  // Vendors context — used to surface actual linked-partner names / avatars in
  // the Partners column and drive OverflowTooltip / QuickView on click.
  const { vendors } = useVendors();
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  // Deterministic partner slice per group id — same stable pseudo-shuffle as
  // PartnerGroupDetailModal.PartnersTab so the same "linked partners" show
  // across listing rows and the detail modal.
  const linkedPartnersFor = (groupId: string, count: number) => {
    if (vendors.length === 0 || count <= 0) return [];
    const h = hashString(groupId);
    const copy = [...vendors];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(vendors.length, count));
  };
  // Open the partner business-card QuickView (same card as the partner
  // detail Items tab) fed from the real vendor record — not the generic
  // contact card, which showed unrelated mock contact data.
  const openPartnerQuickView = (p: (typeof vendors)[number]) =>
    setQuickViewData({
      type: "partner",
      item: {
        id: p.id,
        name: p.displayName || p.companyName,
        subtitle: p.code || "PARTNER",
        meta: {
          types: p.partnerTypes,
          status: p.status,
          code: p.code,
          country: p.country,
          email: p.emailAddress,
          website: p.website,
          creditLimit: p.creditLimit,
          totalSpent: p.totalSpent,
          locations: (p.partnerLocations || []).length,
          logoUrl: p.profileImage || undefined,
        },
      },
      vendorName: p.displayName || p.companyName,
      vendorId: p.id,
    });
  const colDef = (key: string) => COLUMN_DEFS.find((c) => c.key === key)!;
  const somePageSelected = groups.some((g) => selectedIds.has(g.id)) && !allPageSelected;

  const tableWidth = `max(${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px, 100%)`;

  return (
    <>
    <Table style={{ tableLayout: "fixed", width: tableWidth }}>
      <TableHeader className="sticky top-0 z-20 bg-card">
        <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
          density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
        }`}>
          {/* Checkbox column — sticky leftmost. Whole cell is the hit-area. */}
          <TableHead
            className="sticky left-0 z-20 bg-slate-50 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none"
            onClick={(e) => { e.stopPropagation(); onTogglePage(); }}
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
          {/* Dynamic columns */}
          {visibleColumns.map((key) => {
            const def = colDef(key);
            const isFrozen = frozenColumns.has(key);
            const isLocked = LOCKED_COLUMNS.includes(key);
            const isDraggable = !isLocked;
            const currentColSort: "asc" | "desc" | null = sortConfig?.key === key ? sortConfig.direction : null;
            const hasFilter = columnFilters[key] ? isFilterActive(columnFilters[key]) : false;
            const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
            const isBeingDragged = draggingColumnKey === key;
            return (
              <TableHead
                key={key}
                data-col-drag-key={key}
                onMouseDown={isDraggable ? (e) => onHeaderMouseDown(e, key) : undefined}
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
                {isBeingDragged && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "rgb(var(--primary))" }} />
                )}
                {isDraggable && (
                  <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                )}

                <div className={`flex items-center ${def.align === "right" ? "w-full" : ""}`}>
                  <ColumnHeaderMenu
                    columnKey={key}
                    label={def.label}
                    sortable={def.sortable}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onAddFilter={onAddFilter}
                    onHideColumn={onHideColumn}
                    onFreezeColumn={onFreezeColumn}
                    isFrozen={isFrozen}
                    isLocked={isLocked}
                    hasActiveFilter={hasFilter}
                    filter={columnFilters[key] ?? null}
                    uniqueValues={groupUniqueValuesMap[key]}
                    filterTypeOverride={getGroupFilterType(key)}
                    onFilterChange={onFilterChange}
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

                {/* Resize handle — right edge */}
                <div
                  onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, key); }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => { e.stopPropagation(); onResizeReset(key); }}
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                  style={{ touchAction: "none" }}
                >
                  <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                </div>
              </TableHead>
            );
          })}
          {!isBulkMode && (
            <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2 text-center" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
              <span className="text-[13px]">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableSkeletonRows columns={visibleColumns.length + (isBulkMode ? 1 : 2)} />
        ) : emptyState ? (
          <TableEmptyRow colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)} {...emptyState} />
        ) : groups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)} className="h-32 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Users className="w-8 h-8" />
                <p className="text-sm">No partner groups found</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          groups.map((g) => {
            const tint = getAvatarTint(g.name);
            const initials = g.name.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const pal = TYPE_PALETTE[g.templateType];
            const isRowSelected = selectedIds.has(g.id);
            return (
              <TableRow
                key={g.id}
                data-selected={isRowSelected || undefined}
                onClick={() => {
                  /* In bulk-action mode the row click toggles selection
                   * rather than opening the detail page — matches the
                   * Cycle Count reference behaviour. */
                  if (isBulkMode) onRowSel(g.id);
                  else onRowOpen?.(g);
                }}
                className={`cursor-pointer group bg-white ${rowPadClass} ${
                  isRowSelected
                    ? "!bg-[#F8FAFF] hover:!bg-[#F0F7FF]"
                    : "hover:bg-[#F0F7FF]"
                }`}
              >
                {/* Checkbox column — sticky. Whole cell is the hit-area;
                    click-and-drag extends a contiguous selection. */}
                <TableCell
                  className={`sticky left-0 z-10 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none ${
                    isRowSelected ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]" : "bg-inherit"
                  }`}
                  onMouseDown={(e) => onCheckboxMouseDown(e, g.id)}
                  onMouseEnter={() => onCheckboxMouseEnter(g.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${g.name}`}
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
                  const def = colDef(key);
                  const isFrozen = frozenColumns.has(key);
                  const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                  return (
                    <TableCell
                      key={key}
                      className={`${isFrozen ? "sticky bg-inherit z-10" : ""} ${def.align === "right" ? "text-right" : ""}`}
                      style={{
                        width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
                        overflow: "hidden",
                        ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                        ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.04)" } : {}),
                      }}
                    >
                      {key === "group" && (
                        <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
                          <div
                            className={`${isRelaxed ? "w-10 h-10 text-[11px]" : "w-8 h-8 text-[10px]"} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`}
                            style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate`} style={{ fontWeight: 500, color: "#1E293B" }}>{highlightMatch(g.name, searchQuery)}</span>
                          </div>
                        </div>
                      )}
                      {key === "type" && (() => {
                        // Split pills per type — matches Partner listing (VendorsListPage.tsx:1854)
                        // so a "both" group renders Vendor + Customer side-by-side instead
                        // of a single amber "Vendor & Customer" badge.
                        const scopes: ("vendor" | "customer")[] =
                          g.templateType === "both"
                            ? ["vendor", "customer"]
                            : [g.templateType];
                        const pillClass = isRelaxed
                          ? "inline-flex items-center px-2.5 py-1 text-xs rounded-md border"
                          : "inline-flex items-center px-2 py-0.5 text-xs rounded-md border";
                        return (
                          <div className={`flex items-center flex-wrap ${isRelaxed ? "gap-2" : "gap-1.5"}`}>
                            {scopes.map((t) => (
                              <span
                                key={t}
                                className={pillClass}
                                style={{
                                  fontWeight: 500,
                                  backgroundColor: t === "vendor" ? "#EBF3FF" : "#F5F3FF",
                                  color: t === "vendor" ? "#0548A3" : "#5B21B6",
                                  borderColor: t === "vendor" ? "#A8D2FF" : "#DDD6FE",
                                }}
                              >
                                {t === "vendor" ? "Vendor" : "Customer"}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {key === "partners" && (() => {
                        if (g.partnerCount <= 0) {
                          return <span className={`${isRelaxed ? "text-[13px]" : "text-[12px]"} text-slate-400 italic`}>Unused</span>;
                        }
                        const linked = linkedPartnersFor(g.id, g.partnerCount);
                        const first = linked[0];
                        const extra = Math.max(0, linked.length - 1);
                        // Thumbnail shows the partner's own logo/profile
                        // image — falls back to tinted initials below.
                        const firstAvatar = first?.profileImage || undefined;
                        const firstTint = first ? getAvatarTint(first.companyName) : null;
                        const firstInitials = first
                          ? first.companyName.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                          : "";
                        return (
                          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                            {/* Single square thumbnail — matches Partner Locations cell visuals */}
                            {first && (
                              <HoverCard>
                                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <div
                                    className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPartnerQuickView(first);
                                    }}
                                  >
                                    {firstAvatar ? (
                                      <img src={firstAvatar} alt="" className="w-full h-full object-cover" />
                                    ) : firstTint && (
                                      <div
                                        className="w-full h-full flex items-center justify-center text-[10px]"
                                        style={{ backgroundColor: firstTint.bg, color: firstTint.fg, fontWeight: 700 }}
                                      >
                                        {firstInitials}
                                      </div>
                                    )}
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  side="bottom"
                                  align="start"
                                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                    <div className="flex items-center gap-3 relative">
                                      {firstTint && (
                                        <div
                                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px]"
                                          style={{ backgroundColor: firstTint.bg, color: firstTint.fg, fontWeight: 700 }}
                                        >
                                          {firstInitials}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{first.displayName || first.companyName}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{first.code}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-white px-3.5 py-3 space-y-2">
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">
                                        {(first.partnerTypes || []).length > 0
                                          ? (first.partnerTypes || []).map((t) => t === "vendor" ? "Vendor" : "Customer").join(" & ")
                                          : "—"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">
                                        <span className="mr-1">{first.countryFlag}</span>{first.country}
                                      </span>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            )}
                            {/* First partner name */}
                            {first && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPartnerQuickView(first);
                                }}
                                className="min-w-0 text-left cursor-pointer"
                              >
                                <span
                                  className={`${isRelaxed ? "text-[13px]" : "text-sm"} truncate block hover:text-primary hover:underline transition-colors`}
                                  style={{ fontWeight: 500, color: "#1E293B" }}
                                >
                                  {first.displayName || first.companyName}
                                </span>
                              </button>
                            )}
                            {/* "+N more" link — same blue style as Partner Locations */}
                            {extra > 0 && (
                              <OverflowTooltip
                                category="Partners"
                                items={linked.slice(1).map((p, i) => ({
                                  id: `${g.id}-partner-${i + 1}`,
                                  name: p.displayName || p.companyName,
                                  subtitle: p.code || "LINKED PARTNER",
                                  meta: { partnerId: p.id },
                                }))}
                                onItemClick={(item) => {
                                  const p = linked.find((x) => x.id === (item.meta?.partnerId as string));
                                  if (p) openPartnerQuickView(p);
                                }}
                                onViewMore={() => navigate(`/partners/groups/${g.id}`)}
                                viewMoreLabel={`View All ${linked.length} Partners in ${g.name}`}
                              >
                                <span
                                  className="text-[11px] shrink-0 cursor-default leading-none"
                                  style={{ fontWeight: 600, color: "#085FCC" }}
                                >+{extra.toLocaleString()} more</span>
                              </OverflowTooltip>
                            )}
                          </div>
                        );
                      })()}
                      {/* GL Accounts — placeholder pill until Ashma's GL
                          discovery lands. Hidden by default; user can enable
                          via the Columns selector. Shows neutral "Pending"
                          state for every row right now. */}
                      {key === "gl_accounts" && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border"
                          style={{
                            fontWeight: 500,
                            backgroundColor: "rgb(var(--muted))",
                            color: "rgb(var(--muted-foreground))",
                            borderColor: "rgb(var(--border))",
                          }}
                          title="GL account mapping is being designed in a separate workstream."
                        >
                          <Settings2 className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                      {key === "description" && (
                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-slate-600 truncate block`}>{highlightMatch(g.description, searchQuery)}</span>
                      )}
                      {key === "last_updated_by" && (() => {
                        const lu = getLastUpdated(g.id, g.createdOn);
                        const t = getAvatarTint(lu.name);
                        return (
                          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                            <div
                              className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-full overflow-hidden shrink-0 border border-[#E8ECF1] flex items-center justify-center`}
                              style={{ backgroundColor: t.bg }}
                            >
                              {lu.photoUrl ? (
                                <img src={lu.photoUrl} alt={lu.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className={`${isRelaxed ? "text-[11px]" : "text-[10px]"} text-slate-700`} style={{ fontWeight: 700 }}>
                                  {lu.initials}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined, color: "#1E293B" }}>
                                {lu.name}
                              </span>
                              {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate block">Team Member</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {key === "last_updated_on" && (
                        <span className="text-[12px] text-slate-600">
                          {new Date(getLastUpdated(g.id, g.createdOn).date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                        </span>
                      )}
                      {key === "created_by" && (() => {
                        const cb = g.createdBy;
                        if (!cb) return <span className="text-[12px] text-slate-400">—</span>;
                        const t = getAvatarTint(cb.name);
                        return (
                          <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
                            <div
                              className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-full overflow-hidden shrink-0 border border-[#E8ECF1] flex items-center justify-center`}
                              style={{ backgroundColor: cb.photoUrl ? "transparent" : t.bg }}
                            >
                              {cb.photoUrl ? (
                                <img src={cb.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className={`${isRelaxed ? "text-[11px]" : "text-[10px]"} text-slate-700`} style={{ fontWeight: 700 }}>
                                  {cb.initials}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} block truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined, color: "#1E293B" }}>
                                {cb.name}
                              </span>
                              {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate block">Team Member</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {key === "created_on" && (
                        <span className="text-[12px] text-slate-600">{g.createdOn}</span>
                      )}
                      {key === "status" && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border"
                          style={{
                            fontWeight: 500,
                            backgroundColor: g.status === "Active" ? "#ECFDF5" : g.status === "Archived" ? "#FEF2F2" : "#FFFBEB",
                            color: g.status === "Active" ? "#065F46" : g.status === "Archived" ? "#991B1B" : "#92400E",
                            borderColor: g.status === "Active" ? "#A7F3D0" : g.status === "Archived" ? "#FECACA" : "#FDE68A",
                          }}
                        >
                          {g.status}
                        </span>
                      )}
                      {key === "country" && (
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                          <span className="text-[15px] leading-none">{g.countryFlag}</span>
                          {g.country}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
                {/* Actions — sticky right, centered. Hidden in bulk-action mode. */}
                {!isBulkMode && (
                <TableCell
                  className="w-[60px] sticky right-0 bg-inherit z-10 !pl-2 !pr-2 text-center"
                  style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center h-7 w-7 mx-auto rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem onClick={() => onRowOpen?.(g)}>
                        <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Edit group, coming soon")}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {/* Lifecycle: Active ↔ Inactive ↔ Archived. The
                          menu only shows the action that flips the row
                          to a different state — no "Archive" option on
                          rows already archived, etc. */}
                      {/* Lifecycle text + icon colors are pulled directly
                          from the modal CTA palette so the menu reads
                          as a quick path to the same action. */}
                      {g.status === "Active" && (
                        <DropdownMenuItem
                          onClick={() => onRowStatusChange?.(g, "Inactive")}
                          className="focus:bg-amber-50"
                          style={{ color: "#B45309" }}
                        >
                          <CircleSlash className="w-3.5 h-3.5 mr-2" style={{ color: "#F59E0B" }} /> Mark as Inactive
                        </DropdownMenuItem>
                      )}
                      {g.status === "Inactive" && (
                        <DropdownMenuItem
                          onClick={() => onRowStatusChange?.(g, "Active")}
                          className="focus:bg-emerald-50"
                          style={{ color: "#059669" }}
                        >
                          <CircleCheck className="w-3.5 h-3.5 mr-2" style={{ color: "#10B981" }} /> Mark as Active
                        </DropdownMenuItem>
                      )}
                      {g.status === "Archived" ? (
                        <DropdownMenuItem
                          onClick={() => onRowStatusChange?.(g, "Active")}
                          className="focus:bg-emerald-50"
                          style={{ color: "#059669" }}
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 mr-2" style={{ color: "#10B981" }} /> Unarchive
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onRowStatusChange?.(g, "Archived")} className="text-destructive focus:text-destructive focus:bg-red-50">
                          <Archive className="w-3.5 h-3.5 mr-2 text-destructive" /> Archive
                        </DropdownMenuItem>
                      )}
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
    {/* Shared quick-view modal for item / location / contact click-throughs
        from the Partners column (and any future rich cells). */}
    <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </>
  );
}

/* ─── Card grid renderer ─── */
function CardGrid({ groups, size, onSelect, selected, onOpen, loading, emptyState }: { groups: EnrichedGroup[]; size: CardSize; onSelect: (id: string) => void; selected: Set<string>; onOpen?: (g: EnrichedGroup) => void; loading?: boolean; emptyState?: TableEmptyStateProps | null }) {
  if (loading) return <CardSkeletonGrid className="p-4" />;
  if (emptyState) return <TableEmptyState {...emptyState} />;
  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="w-8 h-8" />
          <p className="text-sm">No partner groups found</p>
        </div>
      </div>
    );
  }
  const cols = size === "large" ? "lg:grid-cols-2 xl:grid-cols-3" : size === "small" ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-4";
  return (
    <div className={`p-4 grid grid-cols-1 md:grid-cols-2 ${cols} gap-3`}>
      {groups.map((g) => {
        const isSelected = selected.has(g.id);
        // Scope is templateType from enrichGroup — render as Vendor / Customer
        // pills (both side-by-side for "both") to match the Step 1 picker.
        const scopes: ("vendor" | "customer")[] =
          g.templateType === "both" ? ["vendor", "customer"] : [g.templateType];
        return (
          <div
            key={g.id}
            onClick={() => (onOpen ? onOpen(g) : onSelect(g.id))}
            className={`group relative text-left p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
              isSelected
                ? "border-primary ring-1 ring-primary/20 bg-[#F5F9FF] shadow-[0_0_0_1px_rgba(10,119,255,0.15),0_1px_3px_rgba(10,119,255,0.06)]"
                : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFCFF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"
            }`}
          >
            {/* Header: country flag tile (replaces Building2 to match Step 1) */}
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 shrink-0 transition-colors ${
                isSelected ? "bg-[#D6E8FF]" : "bg-muted"
              }`}
              title={g.country}
            >
              {g.countryFlag ? (
                <span className="text-[16px] leading-none">{g.countryFlag}</span>
              ) : (
                <Building2 className={`w-4 h-4 transition-colors ${isSelected ? "text-primary" : "text-slate-500"}`} />
              )}
            </div>

            {/* Name */}
            <p className="text-[13px] text-foreground pr-2 break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>
              {g.name}
            </p>

            {/* Scope pills — Vendor (blue) / Customer (violet) */}
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {scopes.map((scope) => (
                <span
                  key={scope}
                  className="inline-flex items-center px-1.5 py-px rounded-md border text-[10px]"
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
            </div>

            {/* Description */}
            <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 pr-2 break-words min-h-[28px]">
              {g.description}
            </p>

            {/* Footer: partner count + status pill */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 min-w-0">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">{g.memberCount} partner{g.memberCount !== 1 ? "s" : ""}</span>
              </div>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border shrink-0"
                style={{
                  fontWeight: 500,
                  backgroundColor: g.status === "Active" ? "#ECFDF5" : "#FFFBEB",
                  color: g.status === "Active" ? "#065F46" : "#92400E",
                  borderColor: g.status === "Active" ? "#A7F3D0" : "#FDE68A",
                }}
              >
                {g.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
