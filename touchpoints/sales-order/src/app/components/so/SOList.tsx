import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FIELD_RULES, getMissingFields, joinLabels } from "@/app/components/shared/fieldRequirements";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useSOStore, setImportedAdjustments } from "./store";
import { usePersona } from "./PersonaContext";
import { SOStatusBadge, PriorityBadge } from "./StatusBadge";
import { HighlightText } from "./SearchHighlight";
import { InsightsPanel, type ActiveInsight } from "./InsightsPanel";
import { SOColumnConfigurator, type ColumnDef } from "./SOColumnConfigurator";
import { SOKanbanBoard } from "./SOKanbanBoard";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { SOColumnHeaderMenu, type SortConfig, isFilterActive } from "./SOColumnHeaderMenu";
import { OverflowTooltip, type OverflowItem } from "./OverflowTooltip";
import { getAvatarTint } from "./avatarTints";
import { Avatar } from "@/app/components/shared/Avatar";
import { CustomerHoverCard } from "./CustomerHoverCard";
import { SOFilterBar } from "./SOFilterBar";
import { DatePickerField } from "./date-picker-field";
import { InsightsRangeMenu, InsightsRefresh, type InsightsRange } from "@/app/components/shared/InsightsControls";
import { summarizeSO } from "./summarizeSO";
// SOFilterPills removed — filters managed via modal only
import { EMPTY_SO_FILTERS, countActiveSOFilters, soMatchesAdvancedFilters, type SOActiveFilters } from "./SOFilterUtils";
import { FilterPill as SharedFilterPill } from "@/app/components/shared/FilterPill";
import type { SOStatus } from "./types";
import { ARCHIVABLE_STATES } from "./types";
import {
  FileText, Plus, Search, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Columns3,
  Archive, ArchiveRestore,
  BarChart3, MoreHorizontal, Copy, FileDown, Eye, Ban, Printer, Download,
  User, AlignJustify, List, LayoutGrid, X, Trash2, Info,
  Send, ArrowUpRight, CheckCircle, Check, Link2,
  SlidersHorizontal, GripVertical, ArrowUp, ArrowDown, ArrowUpDown,
  AlertCircle, Layers, Users, Building2, Flag, Calendar, Maximize2, Minimize2,
  Mail, Phone, Package, Warehouse as WarehouseIcon, Upload,
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { ItemQuickViewPanel, type ItemQuickViewData } from "@/app/components/shared/ItemQuickViewPanel";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/app/components/ui/tooltip";
import { CreateSOModal, type SOCreationPayload } from "./CreateSOModal";
import { DuplicateSOModal } from "./DuplicateSOModal";
import { buildDuplicateSOPayload, isDuplicateBlockedByOps, duplicateBlockedReason } from "./duplicateSO";
import { StateTransitionOverlay } from "@/app/components/shared/StateTransitionOverlay";
import { SendToCustomerModal } from "./SendToCustomerModal";
import { ExportSOModal } from "./ExportSOModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { BulkConfirmSOModal } from "./BulkConfirmSOModal";
import { CancellationModal } from "./CancellationModal";
import { ArchiveModal } from "./ArchiveModal";
import { BulkSubmitForReviewModal } from "./BulkActionModals";
import { toast } from "sonner";
import { ImportWizardModal } from '@/app/components/import/ImportWizardModal';
import { IMPORT_EXPORT_ENABLED } from '@/app/config/featureFlags';
import type { ExportRecord } from "@/app/components/import/importExport";
import { ExportRecordsModal } from "@/app/components/import/ExportRecordsModal";
import { materializeSO } from "@/app/components/import/importMaterialize";
import { ImportNoticeBanner, setImportNotice, dismissImportNotice, useImportNotice } from "@/app/components/import/importNotice";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
/* ═══════════════════════════════════════════════════════
   Status filter pills — Archived is separated
   ═══════════════════════════════════════════════════════ */
/* Rejection flow is temporarily hidden in the SO module — Quotes
   still own the reject-and-reactivate loop. Remove `Rejected` from
   listing filters, columns, and the kanban until the SO rejection
   surface is re-enabled. */
const MAIN_STATUS_FILTERS: ("All" | SOStatus)[] = [
  "All", "Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped", "Cancelled", "Partially Cancelled",
];

const STATUS_FILTER_LABELS: Record<string, string> = {
  "All": "Show All", "Draft": "Draft", "Pending Review": "Pending Review",
  "Cleared": "Released", "Partially Shipped": "Partially Shipped",
  "Shipped": "Shipped", "Rejected": "Rejected", "Cancelled": "Cancelled", "Partially Cancelled": "Partially Cancelled", "Archived": "Archived",
};

const STATUS_FILTER_MAP: Record<string, SOStatus[]> = {
  "Cancelled": ["Cancelled"],
};

/* ═══ Mock data arrays ═══ */
// Full names so the listing column shows "Meredith Palmer" rather than
// stripping to "Meredith". Initials are derived from the full string at
// render time (`name.split(" ").map(w => w[0]).join("")`).
const POC_NAMES = [
  "Meredith Palmer", "Toby Flenderson", "Robert California", "Ryan Howard",
  "Kevin Malone", "Pam Beesly", "Holly Flax", "Creed Bratton",
  "Meredith Palmer", "Ryan Howard", "Kevin Malone", "Robert California",
  "Holly Flax", "Toby Flenderson", "Pam Beesly", "Meredith Palmer",
];
const POC_EXTRA = [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];

/* Listing cell for a person field with nobody on file (no contact,
   no rep). Muted FIELD_RULES label, same as the Quotes listing's
   EmptyPersonCell; no avatar and no hover card. */
function EmptyPersonCell({ label }: { label: string }) {
  return <span className="text-[13px] text-muted-foreground whitespace-nowrap">{label}</span>;
}

/* Deterministic mock contact details for hover cards — mirrors the
   Partner v7 helper so the same name yields the same role/dept/email/phone
   wherever it appears. */
/* ISO ↔ Date helpers — used by the Kanban Custom Range picker so we
   can hand DatePickerField a Date object while keeping the canonical
   `yyyy-MM-dd` string in state. Same shape as ShipmentMethodModal. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function getContactDetails(name: string) {
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
}
const CREATED_BY = [
  "Emily Chen", "Adrian User", "System Import", "Marcus Taylor",
  "Adrian User", "David Park", "Emily Chen", "Emily Chen",
  "System Import", "Marcus Taylor", "James Rodriguez", "Emily Chen",
];

/* Roster used for the Last Updated By column. Distinct pool from
   CREATED_BY so a row's most recent editor doesn't always match its
   original creator, keeping the column visually meaningful in the
   demo data. */
const LAST_UPDATED_BY = [
  "Sarah Chen", "James Wilson", "Emily Torres", "Marcus Taylor",
  "David Park", "Maria Garcia", "James Rodriguez", "Adrian User",
  "Emily Chen", "Sarah Chen", "David Park", "James Wilson",
];

/* Version badge — now using shared component */
import { VersionBadge } from "./VersionBadge";

/* ═══ Density config matching Partner module ═══ */
type DensityOption = "condensed" | "comfort" | "kanban";
const DENSITY_CONFIG: { key: DensityOption; label: string; description: string; icon: typeof AlignJustify }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: AlignJustify },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: List },
  { key: "kanban", label: "Kanban View", description: "Board layout", icon: LayoutGrid },
];

/* ═══ Column definitions — Partner-style with minWidth, sortable ═══ */
interface SOColumnDef {
  key: string;
  label: string;
  minWidth: number;
  sortable?: boolean;
  align?: "left" | "right";
  locked?: boolean;
}

/* Column widths right-sized to content so the label/value never
   gets cropped (Order Status needs ~200 to host "Partially
   Cancelled") and so columns with sparse content don't leave a
   trail of whitespace (Line Items dropped from 190 → 160 because
   the thumbnail + first code + "+N more" pill never exceeds the
   smaller width). */
const COLUMN_DEFS: SOColumnDef[] = [
  { key: "so", label: "Sales Order #", minWidth: 220, sortable: true, locked: true },
  { key: "quote", label: "Quote #", minWidth: 130, sortable: true },
  { key: "customer", label: "Customer Name", minWidth: 210, sortable: true },
  { key: "status", label: "Order Status", minWidth: 200, sortable: true },
  /* Line Items sits right after Order Status so it matches the Quote
     listing's ordering (Quote uses `items` in the same slot). */
  { key: "linecount", label: "Line Items", minWidth: 160, sortable: true },
  { key: "poc", label: "POC", minWidth: 210 },
  { key: "salesrep", label: "Sales Rep", minWidth: 180, sortable: true },
  { key: "value", label: "Order Value", minWidth: 130, sortable: true, align: "right" },
  { key: "invoiced", label: "Invoiced Amount", minWidth: 150, sortable: true },
  { key: "payments", label: "Payments Made", minWidth: 150, sortable: true },
  { key: "orderdate", label: "Requested On", minWidth: 120, sortable: true },
  { key: "shipby", label: "Ship By", minWidth: 110 },
  { key: "delivery", label: "Delivery Date", minWidth: 130 },
  { key: "confirmation", label: "Confirmation Date", minWidth: 150 },
  { key: "priority", label: "Priority", minWidth: 100, sortable: true },
  { key: "currency", label: "Currency", minWidth: 90 },
  /* Tags — chips + `+N` overflow. Positioned right before the audit
     block so both listings (Quote + SO) read the same. */
  { key: "tags", label: "Tags", minWidth: 200 },
  /* Audit-trail columns — Created On / By, Last Updated / By — sit at
     the tail of the grid, right before the action affordances. Same
     ordering as Quote so both listings read the same. */
  { key: "createdon", label: "Created On", minWidth: 120, sortable: true },
  { key: "createdby", label: "Created By", minWidth: 150 },
  { key: "lastupdated", label: "Last Updated On", minWidth: 120 },
  { key: "lastupdatedby", label: "Last Updated By", minWidth: 180 },
  /* Rejected On / Rejected By columns are dropped while the SO
     rejection flow is hidden. Keep the code path elsewhere but
     stop advertising the columns in the configurator. */
];

/* Default order places "customer" directly after "so" so the two
   pre-pinned columns sit visually adjacent on the left edge. Sticky
   positioning leaks visually when a non-frozen column scrolls between
   two frozen ones, so they need to be neighbors in the column order. */
const DEFAULT_COLUMN_ORDER = (() => {
  const keys = COLUMN_DEFS.map(c => c.key);
  const reordered = ["so", "customer", ...keys.filter(k => k !== "so" && k !== "customer")];
  return reordered;
})();
/* Columns opted-out of the default listing view. Users can toggle
   them on via the column configurator. */
const HIDDEN_BY_DEFAULT_COLUMNS = new Set(["currency"]);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, !HIDDEN_BY_DEFAULT_COLUMNS.has(c.key)])
);
const LOCKED_COLUMNS = ["so"];
const MIN_COL_WIDTH = 60;
const CHECKBOX_COL_WIDTH = 40;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, c.minWidth])
);

function colDef(key: string) { return COLUMN_DEFS.find(c => c.key === key)!; }

/* Canonical sign-in identity. Matches the name seeded into store.tsx
   so Me mode + the "Assigned to you" badge resolve against the same
   string. Mirror the Quote module's CURRENT_USER_NAME so both
   surfaces stay in lockstep. */
const CURRENT_USER_NAME = "Yahya Naveed";

/* True when the signed-in user is the SO's primary sales rep or
   appears among the additional salesReps[]. */
function isSOSalesRepMe(so: { salesRep?: string; salesReps?: { name?: string }[] }): boolean {
  if (so.salesRep === CURRENT_USER_NAME) return true;
  if (Array.isArray(so.salesReps)) return so.salesReps.some(r => r?.name === CURRENT_USER_NAME);
  return false;
}

/* True when the signed-in user created the SO. We don't carry a
   first-class createdBy field on SalesOrder; the closest signal is
   the activity log's "Created" entry, which is stamped at creation
   with the originator's name. */
function isSOCreatedByMe(so: { activityLog?: { user?: string; action?: string }[] }): boolean {
  const created = so.activityLog?.find(a => a?.action === "Created");
  return created?.user === CURRENT_USER_NAME;
}

function isSOMine(so: any): boolean {
  return isSOSalesRepMe(so) || isSOCreatedByMe(so);
}

/* Reason string surfaced in the row badge's tooltip so the user sees
   why their row was flagged. Names the role explicitly so the badge
   is never read as a generic "assigned" marker. */
function mineReason(createdByMe: boolean, salesRepMe: boolean): string {
  if (createdByMe && salesRepMe) return "You created this sales order and are assigned as a sales representative on it";
  if (createdByMe) return "You created this sales order";
  return "You're assigned as a sales representative on this sales order";
}

/* ═══ Styled Tooltip for bulk action icons ═══ */
function ActionTooltip({ children, label, description }: { children: React.ReactNode; label: string; description: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const onEnter = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    setShow(true);
  };

  return (
    <div ref={triggerRef} onMouseEnter={onEnter} onMouseLeave={() => setShow(false)} className="relative">
      {children}
      {show && (
        <div className="fixed z-[300] pointer-events-none" style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}>
          <div className="bg-white rounded-lg border border-border/50 px-3 py-2 text-left" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", minWidth: 140, maxWidth: 220 }}>
            <div className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5" style={{ fontWeight: 400 }}>{description}</div>
          </div>
          <div className="flex justify-center -mt-px">
            <div className="w-2 h-2 rotate-45 bg-white border-b border-r border-border/50" />
          </div>
        </div>
      )}
    </div>
  );
}

const DND_LIST_KPI = "LIST_KPI_CARD";

/* ═══ DraggableListKpiCard — matches Partner Management exactly ═══ */
function DraggableInsightCard({ index, card, moveCard, onRemove }: {
  index: number;
  card: { label: string; value: string; trending?: "up" | "down" | "neutral"; description?: string };
  moveCard: (from: number, to: number) => void;
  onRemove?: (label: string) => void;
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
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none cursor-grab active:cursor-grabbing ${
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
        {/* Label row: label + info icon + trend icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap" style={{ fontWeight: 500 }}>{card.label}</p>
            {card.description && (
              <div className="relative group/info inline-flex shrink-0">
                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                  <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                </button>
                <div className="absolute z-50 w-[220px] pointer-events-none opacity-0 group-hover/info:opacity-100 transition-opacity duration-200 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2">
                  <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-md text-[11px] text-muted-foreground" style={{ lineHeight: 1.55 }}>
                    {card.description}
                  </div>
                </div>
              </div>
            )}
          </div>
          {card.trending === "up" && (
            <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0" style={{ marginRight: card.description ? 18 : 0 }}>
              <path d="M1 9L5 4L8 7L13 1" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-[#0F172A] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{card.value}</p>
        </div>
      </div>
      {/* Remove button — bottom-right on hover, trash icon */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(card.label); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${card.label}`}
        >
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SOList Component
   ═══════════════════════════════════════════════════════ */
export function SOList() {
  const { salesOrders, createSO, unarchiveSO, archiveSO, cancelSO, confirmSO, markUnconfirmed, cancelSOLines, updateSO, reactivateSO, revertToVersion } = useSOStore();
  const navigate = useNavigate();
  /* Outcome of the last import, on the listing where the records landed.
     Survives navigating away and back, and clears on its own X. */
  const importNotice = useImportNotice();
  /* Export runs through UAC's export modal: pick a format, pick the columns. */
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRows, setExportRows] = useState<ExportRecord[]>([]);
  
  const { isCreator, isReviewer } = usePersona();
  /* Multi-select status filter. Empty set + archived off = "Show All".
     Toggling a state pill adds/removes it from the set; toggling
     Archived flips its own boolean and clears the active-state set
     because archived SOs aren't returned by the state-pill query. */
  const [activeStates, setActiveStates] = useState<Set<SOStatus>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const showAll = activeStates.size === 0 && !showArchived;
  const toggleActiveState = useCallback((key: SOStatus) => {
    setShowArchived(false);
    setActiveStates(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
    setSelectedIds(new Set());
  }, []);
  const selectShowAll = useCallback(() => {
    setActiveStates(new Set());
    setShowArchived(false);
    setPage(1);
    setSelectedIds(new Set());
  }, []);
  const toggleArchived = useCallback(() => {
    setShowArchived(prev => {
      const next = !prev;
      if (next) setActiveStates(new Set());
      return next;
    });
    setPage(1);
    setSelectedIds(new Set());
  }, []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /* Tracks which row the cursor is currently over. Frozen cells
     carry inline `background: var(--card)` styles that would
     otherwise override the row's `hover:bg-muted/50` Tailwind class,
     leaving the first two (and last) columns stuck on white while
     the middle columns tinted. Reading `hoveredRowId` inside each
     sticky cell's inline style keeps the whole row consistent. */
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // Item quick-view (opens on item-thumbnail tap in the Line Items column).
  const [itemQuickView, setItemQuickView] = useState<ItemQuickViewData | null>(null);
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [densityOpen, setDensityOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [meMode, setMeMode] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  /* Legacy import / export. The importer groups the file's rows into one
     order per group and hands back what it created. */
  const [importOpen, setImportOpen] = useState(false);
  const handleExportOrders = useCallback(() => {
    const rows = salesOrders.map((so) => ({
      values: {
        soNumber: so.soNumber,
        customerName: so.customer,
        orderStatus: so.status,
        currencyCode: 'USD',
        requestedOn: so.orderDate || so.createdDate,
        priority: so.priority,
      },
      lines: (so.lines ?? []).map((l) => ({
        lineItem: l.itemCode,
        lineUnitOfMeasure: l.uom,
        lineQuantity: String(l.orderedQty),
        linePricePerUnit: String(l.unitPrice),
        lineDescription: l.itemName,
      })),
    }));
    setExportRows(rows);
    setExportOpen(true);
  }, [salesOrders]);
  const [printSO, setPrintSO] = useState<SalesOrder | null>(null);
  const [downloadSO, setDownloadSO] = useState<SalesOrder | null>(null);
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState<InsightsRange>('last_30');
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const moveInsight = useCallback((fromIndex: number, toIndex: number) => {
    setActiveInsights((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);
  const [activeInsights, setActiveInsights] = useState<ActiveInsight[]>([
    { label: "Total Orders", value: "", trending: "up" },
    { label: "Total Projected Revenue", value: "", trending: "up", description: "Cumulative value of all confirmed sales orders in the selected period. Represents order bookings, not invoiced revenue." },
    { label: "Overdue Orders", value: "", trending: "up", description: "Orders where at least one line item has passed its promised ship-by date and has not yet been shipped." },
    { label: "High Priority Orders", value: "", description: "Total number of orders currently marked with Critical priority status." },
    { label: "Ready to Ship", value: "", description: "Orders that are fully allocated and packed, awaiting carrier pickup or shipment dispatch." },
    { label: "Avg. Days to Fulfill", value: "", description: "Average number of days from Released to fully shipped, across all completed orders in the selected period." },
  ]);
  const [confirmSingleSO, setConfirmSingleSO] = useState<SalesOrder | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [cancelTargetSO, setCancelTargetSO] = useState<SalesOrder | null>(null);
  const [archiveTargetSO, setArchiveTargetSO] = useState<SalesOrder | null>(null);
  /* Row-level duplicate flow. Same shape used in QuotesListPage:
     - `duplicateTargetSO` opens the DuplicateSOModal for that row.
     - `duplicateOverlay` holds animation metadata while the overlay
       plays; on complete we toast + navigate to the new SO. */
  const [duplicateTargetSO, setDuplicateTargetSO] = useState<SalesOrder | null>(null);
  const [duplicateOverlay, setDuplicateOverlay] = useState<{
    fromNumber: string;
    toNumber: string;
    targetId: string;
    versionLabel: string;
  } | null>(null);
  const [cancelModalMode, setCancelModalMode] = useState<"full" | "partial">("full");
  const [showBulkSubmitReview, setShowBulkSubmitReview] = useState(false);
  const [versionModalSO, setVersionModalSO] = useState<SalesOrder | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<SOActiveFilters>(EMPTY_SO_FILTERS);

  // Kanban-specific controls (lifted from SOKanbanBoard)
  const [kanbanGroupBy, setKanbanGroupBy] = useState<"none" | "salesRep" | "customer" | "priority">("none");
  const [kanbanGroupByOpen, setKanbanGroupByOpen] = useState(false);
  const kanbanGroupByRef = useRef<HTMLDivElement>(null);
  // The board opens on the last 30 days. The window only applies while
  // the board is showing (its control lives in the board toolbar), so
  // the table view always lists every order.
  const [kanbanTimeDuration, setKanbanTimeDuration] = useState("last_30_days");
  const [kanbanTimeDurationOpen, setKanbanTimeDurationOpen] = useState(false);
  const kanbanTimeDurationRef = useRef<HTMLDivElement>(null);
  // Bug A5: custom From / To range, paired with kanbanTimeDuration === 'custom'.
  const [kanbanCustomRange, setKanbanCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [kanbanFullscreen, setKanbanFullscreen] = useState(false);
  /* Listing-table fullscreen mode has been retired — no other module
     ships a fullscreen for its list, and the redundant variant was
     keeping two copies of the row JSX in sync. Kanban still has a
     fullscreen since the wide swimlanes benefit from the extra room. */

  // Escape key: clear selection first, then exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedIds.size > 0) { e.preventDefault(); setSelectedIds(new Set()); return; }
        if (kanbanFullscreen) { e.preventDefault(); setKanbanFullscreen(false); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedIds.size, kanbanFullscreen]);

  const anyFullscreen = kanbanFullscreen;

  const isKanban = density === "kanban";
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  /* SO No is the locked anchor; Customer is pre-pinned alongside it so
     users open onto both identifying columns sticky on the left. */
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["so", "customer"]));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  /* Column drag reorder state */
  const colDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  /* Column resize refs */
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  const contentCardRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No-op: shadcn DropdownMenu handles its own click-outside via
    // Radix's dismiss layer. The legacy mousedown handler here used
    // to close the hand-rolled popup, but it fired before option
    // click events could register — leaving the menu visibly broken.
    return () => {};
  }, []);

  /* ── Visible columns in user-defined order ── */
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(k => COLUMN_DEFS.some(c => c.key === k) && columnVisibility[k] !== false);
    if (!ordered.includes("so")) ordered.unshift("so");
    else if (ordered[0] !== "so") { const idx = ordered.indexOf("so"); ordered.splice(idx, 1); ordered.unshift("so"); }
    return ordered;
  }, [columnOrder, columnVisibility]);

  const visibleColCount = visibleColumns.length;

  /* ── Kanban-specific column defs (card fields) ── */
  const KANBAN_COLUMN_DEFS: { key: string; label: string; defaultVisible: boolean }[] = [
    { key: "Draft", label: "Draft", defaultVisible: true },
    { key: "Pending Review", label: "Pending Review", defaultVisible: true },
    { key: "Cleared", label: "Released", defaultVisible: true },
    { key: "Partially Shipped", label: "Partially Shipped", defaultVisible: true },
    { key: "Shipped", label: "Shipped", defaultVisible: true },
    { key: "Cancelled", label: "Cancelled", defaultVisible: true },
    { key: "Archived", label: "Archived", defaultVisible: true },
    { key: "Expired", label: "Expired", defaultVisible: true },
  ];

  /* ── For legacy SOColumnConfigurator ── */
  const legacyColumns: ColumnDef[] = useMemo(() => {
    if (isKanban) {
      return KANBAN_COLUMN_DEFS.map(kd => ({
        key: kd.key, label: kd.label,
        visible: columnVisibility[kd.key] !== undefined ? columnVisibility[kd.key] : kd.defaultVisible,
        locked: false,
      }));
    }
    return columnOrder.map(key => {
      const def = COLUMN_DEFS.find(c => c.key === key);
      if (!def) return null;
      /* `locked` covers both the hard-locked anchor (SO No) and the
         user's frozen columns. The configurator uses `locked` to drop
         the row into the Pinned section, hide the drag handle, and
         block the visibility toggle, matching Partner Management. */
      const isPinned = LOCKED_COLUMNS.includes(key) || frozenColumns.has(key);
      return { key, label: def.label, visible: columnVisibility[key] !== false, locked: isPinned };
    }).filter(Boolean) as ColumnDef[];
  }, [columnOrder, columnVisibility, isKanban, frozenColumns]);

  const handleLegacyColumnsChange = useCallback((cols: ColumnDef[]) => {
    setColumnOrder(cols.map(c => c.key));
    const vis: Record<string, boolean> = {};
    cols.forEach(c => { vis[c.key] = c.visible; });
    setColumnVisibility(vis);
  }, []);

  /* ── Frozen column offsets ── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? colDef(key).minWidth;
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) { if (frozenColumns.has(key)) last = key; }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ── Column drag reorder (Partner-style mouse events) ── */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    /* Frozen columns are pinned to the left edge and cannot be picked
       up; locked columns (SO No) likewise stay put. */
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (frozenColumns.has(columnKey)) return;
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
      if (ghost) ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
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
        /* Don't let the drag cross the freeze boundary: a frozen column
           may only be reordered among other frozen columns, and an
           unfrozen column may only move among unfrozen columns. Keeps
           the frozen block contiguous at the left (frozenOffsets
           assumes it) and stops any unfrozen column from being pushed
           into the sticky area. Mirrors Partner Management exactly. */
        if (frozenColumns.has(draggedKey) !== frozenColumns.has(k)) break;
        setColumnOrder(prev => {
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
  }, [isResizing, frozenColumns]);

  /* ── Column resize ── */
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? colDef(columnKey).minWidth;
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
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

  /* ── Column header menu handlers ── */
  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
    setPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnKey]: false }));
    setSortConfig(prev => (prev?.key === columnKey ? null : prev));
  }, []);

  const handleFreezeColumn = useCallback((columnKey: string) => {
    const willFreeze = !(frozenColumns.has(columnKey) && columnKey !== "so");
    const nextFrozen = new Set(frozenColumns);
    if (willFreeze) nextFrozen.add(columnKey);
    else nextFrozen.delete(columnKey);
    setFrozenColumns(nextFrozen);
    /* Keep the frozen block contiguous at the left — snap the toggled
       column to the freeze boundary. On freeze it lands at the end of
       the frozen block; on unfreeze it becomes the first unfrozen
       column. Matches Partner Management so the drag-guard stays
       symmetric and frozenOffsets can assume contiguity. */
    setColumnOrder(prevOrder => {
      const order = prevOrder.filter(k => k !== columnKey);
      let lastFrozenIdx = -1;
      order.forEach((k, i) => { if (nextFrozen.has(k)) lastFrozenIdx = i; });
      order.splice(lastFrozenIdx + 1, 0, columnKey);
      return order;
    });
  }, [frozenColumns]);

  const handleAddColumnFilter = useCallback((_columnKey: string) => {
    // No-op — column filters managed via filter pills/modal
  }, []);

  /* ── Row actions ── */
  const handleDuplicate = (soId: string) => {
    const original = salesOrders.find(s => s.id === soId);
    if (!original) return;
    /* Defense in depth: row dropdown items render disabled when ops has
       accepted the SO (Cleared and beyond), but if the click leaks
       through anyway we toast the reason instead of opening the modal —
       no duplicate can be created behind ops' back. */
    const blockedReason = duplicateBlockedReason(original.status);
    if (blockedReason) {
      toast.error(blockedReason);
      setOpenActionId(null);
      return;
    }
    setDuplicateTargetSO(original);
    setOpenActionId(null);
  };
  const handleArchiveRow = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; setArchiveTargetSO(so); setOpenActionId(null); };
  const handleConfirmArchive = () => { if (!archiveTargetSO) return; const so = archiveTargetSO; archiveSO(so.id); setArchiveTargetSO(null); setTimeout(() => toast.success(`${so.soNumber} archived`), 1400); };
  const handleViewPDF = (soId: string) => { const so = salesOrders.find(s => s.id === soId); toast.success(`Generating PDF for ${so?.soNumber ?? soId}…`); setOpenActionId(null); };
  const handleExportCSV = (soId: string) => { const so = salesOrders.find(s => s.id === soId); toast.success(`Exporting CSV for ${so?.soNumber ?? soId}…`); setOpenActionId(null); };
  const handleCancelRow = (soId: string, forcePartial?: boolean) => {
    const so = salesOrders.find(s => s.id === soId);
    if (!so) return;
    const hasShipped = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
    setCancelTargetSO(so);
    setCancelModalMode(forcePartial || hasShipped ? "partial" : "full");
    setOpenActionId(null);
  };
  const handleUnarchiveRow = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; unarchiveSO(soId); toast.success(`${so.soNumber} unarchived`); setOpenActionId(null); };
  const handleCancelFull = (reason: import("./types").CancellationReason, reasonText: string) => {
    if (!cancelTargetSO) return;
    if (cancelTargetSO.status === "Cancelled" || cancelTargetSO.status === "Archived") {
      toast.error(`Sales Order ${cancelTargetSO.soNumber} can't be cancelled from ${cancelTargetSO.status}`);
      setCancelTargetSO(null);
      return;
    }
    const soNumber = cancelTargetSO.soNumber;
    cancelSO(cancelTargetSO.id, reason, reasonText);
    setTimeout(() => toast.success(`Sales Order ${soNumber} cancelled`), 1400);
    setCancelTargetSO(null);
  };
  const handleCancelPartial = (lineIds: string[], cancelQtys: Record<string, number>, reason: import("./types").CancellationReason, reasonText: string) => {
    if (!cancelTargetSO) return;
    if (cancelTargetSO.status === "Cancelled" || cancelTargetSO.status === "Archived") {
      toast.error(`Sales Order ${cancelTargetSO.soNumber} can't be cancelled from ${cancelTargetSO.status}`);
      setCancelTargetSO(null);
      return;
    }
    if (lineIds.length === 0) {
      toast.error("No lines selected to cancel");
      setCancelTargetSO(null);
      return;
    }
    const soNumber = cancelTargetSO.soNumber;
    cancelSOLines(cancelTargetSO.id, lineIds, reason === "Other" && reasonText ? `${reason}: ${reasonText}` : reason, cancelQtys);
    const totalCancelledQty = Object.values(cancelQtys).reduce((s, n) => s + (n || 0), 0);
    setTimeout(() => {
      const lineLabel = `${lineIds.length} line${lineIds.length === 1 ? "" : "s"}`;
      const qtyLabel = totalCancelledQty > 0 ? ` (${totalCancelledQty} unit${totalCancelledQty === 1 ? "" : "s"})` : "";
      toast.success(`Cancelled ${lineLabel}${qtyLabel} on ${soNumber}`);
    }, 1400);
    setCancelTargetSO(null);
  };

  /* ── Kanban drag-drop handlers ──
     Mirrors the detail page's lifecycle actions so every kanban move
     fires the same store action a button click in the detail header
     would. Modals (cancellation, clearance confirm, reactivation) are
     opened by SOKanbanBoard itself and route through these handlers on
     confirm. Allowed transitions are gated upstream by canDropToColumn,
     so we only need to map each landing status to its store call. */
  const handleKanbanStatusChange = useCallback((soId: string, fromStatus: SOStatus, toStatus: SOStatus) => {
    try {
      if (toStatus === "Draft") {
        if (fromStatus === "Archived" || fromStatus === "Cancelled" || fromStatus === "Partially Cancelled") {
          reactivateSO(soId);
        } else {
          updateSO(soId, { status: "Draft" });
        }
      } else if (toStatus === "Pending Review") {
        // Same path as the dropdown's "Submit for Review" action.
        markUnconfirmed(soId);
      } else if (toStatus === "Cleared") {
        const result = confirmSO(soId);
        if (!result.valid && result.errors) result.errors.forEach(e => toast.error(e));
      }
    } catch (err) {
      console.error("Kanban status change error:", err);
      toast.error("Failed to update order status");
    }
  }, [confirmSO, markUnconfirmed, reactivateSO, updateSO]);

  const handleKanbanCancelRequest = useCallback((so: SalesOrder) => {
    const hasShipped = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
    setCancelTargetSO(so);
    setCancelModalMode(hasShipped ? "partial" : "full");
  }, []);


  /* SOs augmented with the summarised `grandTotal` — passed to the
     filter modal so its "Show N Sales Orders" CTA can preview the
     match count against the staged draft including the value
     filter. Memoised so we don't re-summarise on every keystroke. */
  const salesOrdersForFilterPreview = useMemo(
    () => salesOrders.map(so => ({ ...so, grandTotal: summarizeSO(so).grandTotal })),
    [salesOrders],
  );

  const selectedSOs = useMemo(() => salesOrders.filter(so => selectedIds.has(so.id)), [salesOrders, selectedIds]);
  const bulkApprovableCount = useMemo(() => selectedSOs.filter(so => so.status === "Pending Review" || so.status === "Draft").length, [selectedSOs]);
  const bulkSubmitCount = useMemo(() => selectedSOs.filter(so => so.status === "Draft").length, [selectedSOs]);

  /* Bulk handlers are intentionally narrow. Submit for Review and
     Release for Fulfillment are the only state-change verbs we expose
     in bulk. Archive, Cancel, Export, and Print are deliberately
     not offered — those flows live on the row action menu where the
     per-record context (reason, line-level cancellation, document
     rendering) can be captured properly. */
  const handleBulkApprove = () => { if (bulkApprovableCount === 1) { const target = selectedSOs.find(so => so.status === "Pending Review" || so.status === "Draft"); if (target) setConfirmSingleSO(target); } else setShowBulkConfirm(true); };
  const handleBulkConfirmDone = (soIds: string[]) => { let approved = 0, errors = 0; soIds.forEach(id => { const result = confirmSO(id); if (result.valid) approved++; else errors++; }); if (approved > 0) toast.success(`Released ${approved} order${approved > 1 ? "s" : ""} for fulfillment`); if (errors > 0) toast.info(`${errors} order${errors > 1 ? "s" : ""} could not be released`); setSelectedIds(new Set()); setShowBulkConfirm(false); setConfirmSingleSO(null); };
  const handleSingleConfirmDone = () => { if (!confirmSingleSO) return; const result = confirmSO(confirmSingleSO.id); if (result.valid) toast.success("Sales Order released for fulfillment"); else result.errors.forEach(e => toast.error(e)); setConfirmSingleSO(null); setSelectedIds(new Set()); };
  const handleBulkSubmitForReview = () => { setShowBulkSubmitReview(true); };
  const handleBulkSubmitConfirmed = (soIds: string[]) => { let submitted = 0; soIds.forEach(id => { markUnconfirmed(id); submitted++; }); toast.success(`Submitted ${submitted} order${submitted > 1 ? "s" : ""} for review`); setSelectedIds(new Set()); setShowBulkSubmitReview(false); };

  /* ── Filtering & Sorting ── */
  const filtered = useMemo(() => {
    let list = salesOrders;
    /* Status pill predicate:
       - Archived view: only Archived SOs.
       - Active-state set non-empty: any SO whose status is in the
         set (multi-select OR). STATUS_FILTER_MAP supplies aliases
         for any pill that should match more than one literal status.
       - Otherwise (Show All): every non-Archived SO. Archived is
         hidden by default — the Archived pill explicitly toggles
         them on. */
    if (showArchived) {
      list = list.filter(so => so.status === "Archived");
    } else if (activeStates.size === 0) {
      list = list.filter(so => so.status !== "Archived");
    } else {
      list = list.filter(so => {
        if (so.status === "Archived") return false;
        for (const key of activeStates) {
          const mapped = STATUS_FILTER_MAP[key];
          if (mapped) { if (mapped.includes(so.status) || so.status === key) return true; }
          else if (so.status === key) return true;
        }
        return false;
      });
    }
    /* Me mode — show only SOs where the signed-in user is the
       primary sales rep OR appears in the salesReps[] secondary
       roster. The store seeds Yahya Naveed (the current user)
       across both surfaces so toggling the filter actually
       returns rows. */
    if (meMode) list = list.filter(so => isSOMine(so));
    if (search) { const q = search.toLowerCase(); list = list.filter(so => so.soNumber.toLowerCase().includes(q) || (so.customer || "").toLowerCase().includes(q) || (so.salesRep || "").toLowerCase().includes(q) || (so.sourceQuoteRef || "").toLowerCase().includes(q)); }

    /* Apply the advanced filter set committed from the filters
       modal. Previously this state was set but never consumed by
       the listing pipeline so clicking Apply was a no-op — wired
       in via the shared `soMatchesAdvancedFilters` predicate so
       the modal's draft count and the listing pipeline stay
       consistent. `grandTotal` is supplied per row so the value
       filter compares against the real summarised total. */
    if (countActiveSOFilters(advancedFilters) > 0) {
      list = list.filter(so => soMatchesAdvancedFilters(
        { ...so, grandTotal: summarizeSO(so).grandTotal } as any,
        advancedFilters,
      ));
    }

    // Bug A6: kanbanTimeDuration was rendered but never applied. Window
    // each SO by createdDate using the active preset or custom range.
    // Board only: the table has no time control, so it never filters.
    if (isKanban) {
      let from: Date | null = null;
      let to: Date | null = null;
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      switch (kanbanTimeDuration) {
        case "last_7_days":    from = new Date(startOfToday); from.setDate(from.getDate() - 7);  to = endOfToday; break;
        case "last_30_days":   from = new Date(startOfToday); from.setDate(from.getDate() - 30); to = endOfToday; break;
        case "last_6_months":  from = new Date(startOfToday); from.setMonth(from.getMonth() - 6); to = endOfToday; break;
        case "last_12_months": from = new Date(startOfToday); from.setMonth(from.getMonth() - 12); to = endOfToday; break;
        case "custom":
          if (kanbanCustomRange.from) from = new Date(kanbanCustomRange.from + "T00:00:00");
          if (kanbanCustomRange.to)   { to = new Date(kanbanCustomRange.to + "T00:00:00"); to.setHours(23, 59, 59, 999); }
          break;
      }
      if (from || to) {
        list = list.filter((so) => {
          if (!so.createdDate) return false;
          const d = new Date(so.createdDate);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }
    }

    // Apply sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        let aVal: any, bVal: any;
        switch (sortConfig.key) {
          case "so": aVal = a.soNumber; bVal = b.soNumber; break;
          case "quote": aVal = a.sourceQuoteRef; bVal = b.sourceQuoteRef; break;
          case "customer": aVal = a.customer; bVal = b.customer; break;
          case "status": aVal = a.status; bVal = b.status; break;
          case "salesrep": aVal = a.salesRep; bVal = b.salesRep; break;
          case "value": aVal = summarizeSO(a).grandTotal; bVal = summarizeSO(b).grandTotal; break;
          case "priority": aVal = a.priority; bVal = b.priority; break;
          case "linecount": aVal = a.lines.length; bVal = b.lines.length; break;
          case "orderdate": aVal = a.orderDate; bVal = b.orderDate; break;
          case "createdon": aVal = a.createdDate; bVal = b.createdDate; break;
          case "rejectedon": aVal = a.rejectedAt || ""; bVal = b.rejectedAt || ""; break;
          default: aVal = ""; bVal = "";
        }
        if (typeof aVal === "string" && typeof bVal === "string") return dir * aVal.localeCompare(bVal);
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return list;
  }, [salesOrders, activeStates, showArchived, search, meMode, sortConfig, kanbanTimeDuration, kanbanCustomRange, advancedFilters, isKanban]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  /* ── Analytics ──
     KPI rollups sum the grand total per SO (subtotal + tax + freight +
     adjustments − rules) so the cards match what the listing column
     and the detail sidebar render for the same record. The previous
     `so.total` only included line subtotals with tax. */
  const activeSOs = useMemo(() => salesOrders.filter(s => s.status !== "Archived"), [salesOrders]);
  const stats = useMemo(() => {
    const grand = (so: typeof activeSOs[number]) => summarizeSO(so).grandTotal;
    const totalRevenue = activeSOs.reduce((s, so) => s + grand(so), 0);
    const totalOrders = activeSOs.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const pendingApproval = activeSOs.filter(s => s.status === "Pending Review").length;
    const overdueOrders = activeSOs.filter(s => s.status === "Cleared" || s.status === "Partially Shipped").length;
    const openOrderValue = activeSOs.filter(s => !["Cancelled", "Shipped"].includes(s.status)).reduce((s, so) => s + grand(so), 0);
    const revenueAtRisk = activeSOs.filter(s => s.status === "Partially Cancelled").reduce((s, so) => s + grand(so), 0);
    return { totalRevenue, totalOrders, avgOrderValue, pendingApproval, overdueOrders, openOrderValue, revenueAtRisk };
  }, [activeSOs]);

  const insightCardData = useMemo(() => {
    const grand = (so: typeof activeSOs[number]) => summarizeSO(so).grandTotal;
    const highPriorityCount = activeSOs.filter(s => s.priority === "High").length;
    const readyToShipCount = activeSOs.filter(s => s.status === "Cleared" && s.lines.every(l => l.cancelled || l.allocatedQty >= l.orderedQty)).length;
    const pipelineValue = activeSOs.filter(s => !["Cancelled", "Archived"].includes(s.status)).reduce((s, so) => s + grand(so), 0);
    const clearedValue = activeSOs.filter(s => s.status === "Cleared").reduce((s, so) => s + grand(so), 0);
    const valueMap: Record<string, string> = {
      "Total Projected Revenue": `$${(stats.totalRevenue / 1000).toFixed(0)}K`,
      "Average Order Value": `$${(stats.avgOrderValue / 1000).toFixed(1)}K`,
      "Total Orders": String(stats.totalOrders),
      "Pending Approval": String(stats.pendingApproval),
      "Overdue Orders": String(stats.overdueOrders),
      "Open Order Value": `$${(stats.openOrderValue / 1000).toFixed(0)}K`,
      "Revenue at Risk": `$${(stats.revenueAtRisk / 1000).toFixed(0)}K`,
      "High Priority Orders": String(highPriorityCount),
      "Ready to Ship": String(readyToShipCount),
      "Avg. Days to Fulfill": "3.2 days",
      "Order Fill Rate": "87%",
      "Order Revisions": String(activeSOs.filter(s => !["Cancelled", "Shipped"].includes(s.status) && s.version && s.version.number > 1).length),
      "Pipeline Value": pipelineValue >= 1000000 ? `$${(pipelineValue / 1000000).toFixed(1)}M` : `$${(pipelineValue / 1000).toFixed(0)}K`,
      "Cleared Value": clearedValue >= 1000000 ? `$${(clearedValue / 1000000).toFixed(1)}M` : `$${(clearedValue / 1000).toFixed(0)}K`,
    };
    return activeInsights.map(ins => ({ label: ins.label, value: valueMap[ins.label] || ins.value, trending: ins.trending, description: ins.description }));
  }, [activeInsights, stats, activeSOs]);

  const statusCount = (s: "All" | SOStatus | "Archived") => {
    if (s === "All") return salesOrders.filter(so => so.status !== "Archived").length;
    if (s === "Archived") return salesOrders.filter(so => so.status === "Archived").length;
    const mapped = STATUS_FILTER_MAP[s];
    if (mapped) return salesOrders.filter(so => mapped.includes(so.status) || so.status === s).length;
    return salesOrders.filter(so => so.status === s).length;
  };

  const handleBulkUnarchive = () => { selectedIds.forEach(id => unarchiveSO(id)); setSelectedIds(new Set()); };
  const toggleSelectSO = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleSelectAll = () => { if (selectedIds.size === paginated.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginated.map(so => so.id))); };

  const deriveDates = (so: typeof salesOrders[0], idx: number) => {
    const base = so.orderDate.split("/").map(Number);
    const year = base[0], month = base[1], day = base[2];
    const fmtDate = (y: number, m: number, d: number) => {
      try { return format(new Date(y, m - 1, d), "MM/dd/yyyy"); } catch { return "—"; }
    };
    /* Prefer the persisted `so.lastUpdated` when set so the display
       date matches what the advanced-filter modal is filtering
       against. Fall back to the previous index-derived date for legacy
       records that don't carry the field. */
    const luRaw = so.lastUpdated;
    let lastUpdatedDisplay: string;
    if (luRaw) {
      const [ly, lm, ld] = luRaw.split("/").map(Number);
      lastUpdatedDisplay = fmtDate(ly, lm, ld);
    } else {
      lastUpdatedDisplay = fmtDate(year, Math.min(12, month + 1), Math.min(28, day + (idx % 5)));
    }
    return { orderDate: fmtDate(year, month, day), shipBy: fmtDate(year, Math.min(12, month + 2), Math.min(28, day)), deliveryDate: fmtDate(year, Math.min(12, month + 3), Math.min(28, day)), createdOn: fmtDate(year, month, Math.max(1, day - 3)), lastUpdated: lastUpdatedDisplay, confirmationDate: so.status !== "Draft" && so.status !== "Pending Review" ? fmtDate(year, month, Math.min(28, day + 2)) : "" };
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 6) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else { pages.push(1); if (page > 3) pages.push("..."); const start = Math.max(2, page - 1); const end = Math.min(totalPages - 1, page + 1); for (let i = start; i <= end; i++) pages.push(i); if (page < totalPages - 2) pages.push("..."); pages.push(totalPages); }
    return pages;
  };

  const isCondensed = density === "condensed";
  const rowH = isCondensed ? "py-1 px-2" : "py-2 px-2";
  const cellFontSize = "13px";
  const avatarSize = isCondensed ? 22 : 24;
  const avatarFontSize = isCondensed ? 9 : 10;
  const smallAvatarSize = isCondensed ? 20 : 24;
  const smallAvatarFontSize = isCondensed ? 8 : 9;

  /* ═══ Cell renderers with avatars & overflow tooltips ═══ */
  const renderCell = useCallback((colKey: string, so: typeof salesOrders[0], globalIdx: number) => {
    const dates = deriveDates(so, globalIdx);
    /* Primary PoC comes from the SO record now (seeded from
       getCustomerDefaults at generation). POC_NAMES is kept only as
       a last-resort fallback for legacy mock entries that pre-date
       the `pocs[]` field. Without this swap the listing column showed
       "Meredith Palmer" while the sidebar showed the customer's real
       PoC roster — same SO, different names. */
    const summary = summarizeSO(so);
    /* `so.pocs` present (even empty) is the record's truth: an empty
       list means no contact on file and renders the empty label, never a mock name. */
    const pocsOnRecord = so.pocs !== undefined;
    const poc = summary.primaryPoC?.name || (pocsOnRecord ? "" : POC_NAMES[globalIdx % POC_NAMES.length]);
    const pocExtra = summary.additionalPoCs.length > 0 || pocsOnRecord
      ? summary.additionalPoCs.length
      : POC_EXTRA[globalIdx % POC_EXTRA.length];
    const createdBy = CREATED_BY[globalIdx % CREATED_BY.length];
    /* Offset the LAST_UPDATED_BY index so it doesn't correlate with
       createdBy — the two columns should feel independent in the
       demo grid. */
    const lastUpdatedBy = LAST_UPDATED_BY[(globalIdx + 3) % LAST_UPDATED_BY.length];

    switch (colKey) {
      case "quote":
        return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}><HighlightText text={so.sourceQuoteRef} search={search} /></span>;
      case "customer": {
        const tint = getAvatarTint(so.customer);
        return (
          <CustomerHoverCard customerName={so.customer} customerInitials={so.customerInitials}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ width: isCondensed ? 28 : 32, height: isCondensed ? 28 : 32, backgroundColor: tint.bg }}>
                <span style={{ fontSize: isCondensed ? 9 : 10, fontWeight: 700, color: '#334155' }}>{so.customerInitials}</span>
              </div>
              <span className="truncate" style={{ fontWeight: 500, maxWidth: 160, fontSize: '13px', color: '#334155' }}><HighlightText text={so.customer} search={search} /></span>
            </div>
          </CustomerHoverCard>
        );
      }
      case "status":
        return <div className="whitespace-nowrap"><SOStatusBadge status={so.status} /></div>;
      case "poc": {
        if (!poc) return <EmptyPersonCell label={FIELD_RULES.poc.emptyLabel} />;
        const pocTint = getAvatarTint(poc);
        const pocInitials = poc.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
        const pocDetails = getContactDetails(poc);
        return (
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden min-w-0 whitespace-nowrap">
            <HoverCard openDelay={250}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Avatar name={poc} size={isCondensed ? 24 : 28} />
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div
                      className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
                      style={{ backgroundColor: pocTint.bg }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>
                        {pocInitials}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{poc}</p>
                      <p className="text-[11px] text-slate-400 truncate">{pocDetails.role}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{pocDetails.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{pocDetails.phone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{pocDetails.dept}</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <span className="truncate min-w-0" style={{ fontWeight: 500, fontSize: '13px', color: '#334155', maxWidth: pocExtra > 0 ? 96 : 200 }}>{poc}</span>
            {pocExtra > 0 && (
              <OverflowTooltip
                category="Point of Contacts"
                items={Array.from({ length: pocExtra }, (_, i) => {
                  /* Pull real additionalPoCs from the SO when present; fall
                     back to POC_NAMES only for legacy entries. Same name
                     in the listing and the detail sidebar this way. */
                  const realPoc = summary.additionalPoCs[i];
                  const name = realPoc?.name || POC_NAMES[(globalIdx + i + 1) % POC_NAMES.length];
                  const t = getAvatarTint(name);
                  return { id: `${so.id}-poc-${i}`, name, subtitle: realPoc?.title || "CONTACT", initials: realPoc?.initials || name.charAt(0), avatarBg: t.bg, avatarFg: t.fg };
                })}
              >
                <span className="text-[11px] inline-flex shrink-0 cursor-default whitespace-nowrap leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{pocExtra} more</span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "salesrep": {
        /* Sales Rep cell with hover card + "+N more" overflow —
           mirrors the POC pattern above so the listings carry the
           same multi-person affordance. The primary rep is the one
           recorded on `so.salesRep`; siblings are derived from
           `so.salesReps` by filtering out the primary by name. */
        const allReps = (so.salesReps && so.salesReps.length > 0
          ? so.salesReps
          : [{ name: so.salesRep, primary: true }]).filter((r) => !!r.name);
        /* No rep assigned: muted label, no hover card with made-up details. */
        if (allReps.length === 0) return <EmptyPersonCell label={FIELD_RULES.salesRep.emptyLabel} />;
        const primaryRep = allReps.find((r) => r.primary) ?? allReps[0];
        const extraReps = allReps.filter((r) => r.name !== primaryRep.name);
        const primaryTint = getAvatarTint(primaryRep.name);
        const primaryInitials = primaryRep.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
        const repDetails = getContactDetails(primaryRep.name);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <HoverCard openDelay={250}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Avatar name={primaryRep.name} size={isCondensed ? 24 : 28} />
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div
                      className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
                      style={{ backgroundColor: primaryTint.bg }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>
                        {primaryInitials}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{primaryRep.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{repDetails.role}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{repDetails.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{repDetails.phone}</span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <span className="whitespace-nowrap" style={{ fontWeight: 500, fontSize: '13px', color: '#334155' }}>
              <HighlightText text={primaryRep.name} search={search} />
            </span>
            {extraReps.length > 0 && (
              <OverflowTooltip
                category="Sales Reps"
                items={extraReps.map<OverflowItem>((r, i) => {
                  const t = getAvatarTint(r.name);
                  const initials = r.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                  return {
                    id: `${so.id}-rep-${i}`,
                    name: r.name,
                    subtitle: `${r.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
                    subtitleHref: `mailto:${r.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
                    initials,
                    avatarBg: t.bg,
                    avatarFg: t.fg,
                  };
                })}
                viewMoreLabel={`View all ${extraReps.length + 1} sales reps`}
              >
                <span className="text-[11px] inline-flex shrink-0 cursor-default whitespace-nowrap leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>
                  +{extraReps.length} more
                </span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "value":
        /* Listing's "Order Value" is the GRAND TOTAL (subtotal + tax +
           freight + adjustments − rules), not the line-subtotal-with-tax.
           Same number the detail sidebar's "Grand Total" tile shows. */
        return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>${summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      case "invoiced": {
        const invoiced = so.linkedTransactions.filter(t => t.type === "Invoice").reduce((s, t) => s + t.amount, 0);
        const invoiceList = so.linkedTransactions.filter(t => t.type === "Invoice");
        return (
          <div className="relative group/inv">
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: invoiced > 0 ? '#0F172A' : '#94A3B8' }}>
                {invoiced > 0 ? `$${invoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </span>
              {invoiceList.length > 0 && (
                <ArrowUpRight className="w-3 h-3 text-primary/40 group-hover/inv:text-primary transition-colors" />
              )}
            </div>
            {invoiceList.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-[300] w-[260px] bg-white border border-border rounded-lg shadow-lg p-3 opacity-0 pointer-events-none group-hover/inv:opacity-100 group-hover/inv:pointer-events-auto transition-opacity duration-150">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Linked Invoices</div>
                <div className="flex flex-col gap-1.5">
                  {invoiceList.map((inv, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/40 transition-colors cursor-pointer">
                      <span className="text-[12px] text-primary" style={{ fontWeight: 500 }}>{inv.number}</span>
                      <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>${inv.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }
      case "payments": {
        const payments = so.linkedTransactions.filter(t => t.type === "Payment Receipt").reduce((s, t) => s + t.amount, 0);
        return <span className="whitespace-nowrap tabular-nums text-left" style={{ fontSize: '13px', fontWeight: 500, color: payments > 0 ? '#0F172A' : '#94A3B8' }}>{payments > 0 ? `$${payments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>;
      }
      case "orderdate": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.orderDate}</span>;
      case "shipby": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.shipBy}</span>;
      case "delivery": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.deliveryDate}</span>;
      case "createdon": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.createdOn}</span>;
      case "createdby": {
        const isSystem = /system/i.test(createdBy);
        const cbTint = getAvatarTint(createdBy);
        const cbInitials = createdBy.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
        const cbDetails = !isSystem ? getContactDetails(createdBy) : null;
        return (
          <div className="flex items-center gap-2">
            {cbDetails ? (
              <HoverCard openDelay={250}>
                <HoverCardTrigger asChild>
                  <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Avatar name={createdBy} size={isCondensed ? 24 : 28} />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="start"
                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                    <div className="flex items-center gap-3 relative">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: cbTint.bg }}>
                        <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{cbInitials}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{createdBy}</p>
                        <p className="text-[11px] text-slate-400 truncate">{cbDetails.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{cbDetails.email}</span></div>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cbDetails.phone}</span></div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <Avatar name={createdBy} size={isCondensed ? 24 : 28} />
            )}
            <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{createdBy}</span>
          </div>
        );
      }
      case "lastupdated": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.lastUpdated}</span>;
      case "lastupdatedby": {
        /* Same chrome as `createdby` — avatar + PersonHoverCard with
           email / phone / department. Kept in lockstep with the
           createdby renderer so the two columns read as a matched
           pair. System-attributed edits skip the hover card. */
        const isSystem = /system/i.test(lastUpdatedBy);
        const luTint = getAvatarTint(lastUpdatedBy);
        const luInitials = lastUpdatedBy.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
        const luDetails = !isSystem ? getContactDetails(lastUpdatedBy) : null;
        return (
          <div className="flex items-center gap-2">
            {luDetails ? (
              <HoverCard openDelay={250}>
                <HoverCardTrigger asChild>
                  <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Avatar name={lastUpdatedBy} size={isCondensed ? 24 : 28} />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="start"
                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                    <div className="flex items-center gap-3 relative">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: luTint.bg }}>
                        <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{luInitials}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{lastUpdatedBy}</p>
                        <p className="text-[11px] text-slate-400 truncate">{luDetails.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{luDetails.email}</span></div>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{luDetails.phone}</span></div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <Avatar name={lastUpdatedBy} size={isCondensed ? 24 : 28} />
            )}
            <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{lastUpdatedBy}</span>
          </div>
        );
      }
      case "confirmation": return dates.confirmationDate ? <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.confirmationDate}</span> : <span style={{ fontSize: '13px', color: '#CBD5E1' }}>—</span>;
      case "rejectedon": {
        /* MM/DD/YYYY hh:mm — matches the rejection banner subtitle so
           the timestamp reads consistently across the record. Only
           carries a value when the SO record has `rejectedAt` set. */
        if (!so.rejectedAt) return <span style={{ fontSize: '13px', color: '#CBD5E1' }}>—</span>;
        const d = new Date(so.rejectedAt);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{`${mm}/${dd}/${yyyy} ${hh}:${mi}`}</span>;
      }
      case "rejectedby": {
        if (!so.rejectedBy) return <span style={{ fontSize: '13px', color: '#CBD5E1' }}>—</span>;
        return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{so.rejectedBy}</span>;
      }
      case "priority": return <PriorityBadge priority={so.priority} />;
      case "currency": return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{so.currency}</span>;
      case "tags": {
        /* Tags cell — Partner Management chrome
           (PartnersVendorsListPage.tsx:1946). Explicit slate colors
           match the Quote listing exactly. SO uses `isCondensed` as
           its density flag (inverse of Quote's `isRelaxed`), so the
           density-dependent padding branches read from that. */
        const tags = so.tags || [];
        if (tags.length === 0) return <span className={`${isCondensed ? 'text-sm' : 'text-[13.5px]'} text-muted-foreground`}>{'–'}</span>;
        const extra = tags.length > 1 ? tags.length - 1 : 0;
        const pillStyle: React.CSSProperties = {
          fontWeight: 500,
          backgroundColor: '#F1F5F9',
          color: '#475569',
          borderColor: '#E2E8F0',
        };
        return (
          <div className={`flex items-center ${isCondensed ? 'gap-1' : 'gap-1.5'}`}>
            <span
              className={`inline-flex items-center ${isCondensed ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} rounded-md border`}
              style={pillStyle}
            >
              {tags[0]}
            </span>
            {extra > 0 && (
              <OverflowTooltip
                category="Tags"
                items={tags.slice(1).map((t, i) => ({
                  id: `${so.id}-tag-${i}`,
                  name: t,
                  subtitle: 'TAG',
                }))}
              >
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default"
                  style={{ ...pillStyle, fontWeight: 600 }}
                >
                  +{extra}
                </span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "linecount": {
        const lineItems = so.lines;
        const extraLineItems = lineItems.length - 1;
        const first = lineItems[0];
        // Deterministic Partner v7-style preview tokens hashed off the
        // item code — same pattern used in the SO line grid thumbnails so
        // every appearance of an item reads consistently.
        const previewTokens = (() => {
          const code = first?.itemCode || "";
          let h = 0; for (let c = 0; c < code.length; c++) h = code.charCodeAt(c) + ((h << 5) - h);
          const ah = Math.abs(h);
          const TINTS = ["#FDE8E8", "#FEF3C7", "#DBEAFE", "#E0E7FF", "#D1FAE5", "#FCE7F3", "#F1F5F9"];
          const CATS = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
          const STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];
          const STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
            "In Stock": { bg: "#F0FDF4", fg: "#166534" },
            "Low Stock": { bg: "#FFFBEB", fg: "#92400E" },
            "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B" },
            "On Order": { bg: "#EFF6FF", fg: "#1E40AF" },
          };
          const status = STATUSES[ah % STATUSES.length];
          return {
            tint: TINTS[ah % TINTS.length],
            category: CATS[ah % CATS.length],
            status,
            statusTokens: STATUS_TOKENS[status],
            onHand: 100 + ((ah * 13) % 15000),
            unitPrice: 10 + ((ah * 7) % 500),
          };
        })();
        const thumbSize = isCondensed ? 28 : 40;
        return (
          <div className={`flex items-center whitespace-nowrap ${isCondensed ? "gap-1.5" : "gap-2.5"}`}>
            <HoverCard openDelay={140} closeDelay={80}>
              <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!first) return;
                    // Open the Partner v7-style item quick view (image
                    // carousel + meta cards + Go to Item CTA) instead of
                    // navigating away. Tap-to-navigate happens through the
                    // row click or the "Go to Item" footer button.
                    setItemQuickView({
                      code: first.itemCode,
                      name: first.itemName,
                      description: first.itemName,
                      category: previewTokens.category,
                      uom: "EA",
                      unitPrice: previewTokens.unitPrice,
                      onHand: previewTokens.onHand,
                      reorderAt: Math.floor(previewTokens.onHand * 0.2),
                      leadTimeDays: 5 + (Math.abs(first.itemCode.charCodeAt(0) || 0) % 14),
                      status: previewTokens.status,
                      partner: so.customer,
                      tint: previewTokens.tint,
                    });
                  }}
                  aria-label={`Preview ${first?.itemCode || "item"}`}
                  style={{
                    width: thumbSize, height: thumbSize, flexShrink: 0,
                    borderRadius: 6, backgroundColor: previewTokens.tint,
                    border: "1px solid #E8ECF1", padding: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Package style={{ width: isCondensed ? 14 : 18, height: isCondensed ? 14 : 18, color: "#64748B", opacity: 0.65 }} />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom" align="start" sideOffset={8}
                className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className="px-3.5 py-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)" }}>
                  <div className="flex items-center gap-3 relative">
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: previewTokens.tint }}>
                      <Package className="w-4 h-4" style={{ color: "#475569" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{first?.itemCode || "–"}</p>
                      <p className="text-[11px] truncate" style={{ color: "rgba(148,163,184,0.9)" }}>{first?.itemName || ""}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{previewTokens.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>On-Hand: <b>{previewTokens.onHand.toLocaleString()}</b></span>
                    </div>
                    <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                      ${previewTokens.unitPrice.toFixed(2)}
                      <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px]"
                    style={{ fontWeight: 600, backgroundColor: previewTokens.statusTokens.bg, color: previewTokens.statusTokens.fg }}
                  >
                    {previewTokens.status}
                  </span>
                </div>
              </HoverCardContent>
            </HoverCard>
            <span className={`${isCondensed ? "text-sm" : "text-[13.5px]"} truncate`} style={{ fontWeight: 500 }}>{first?.itemCode || "–"}</span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</span>
            {extraLineItems > 0 && (
              <OverflowTooltip
                category="Line Items"
                items={lineItems.slice(1).map((li, i) => ({
                  id: `${so.id}-line-${i}`,
                  name: li.itemCode,
                  subtitle: li.itemName,
                  icon: <Package className="w-3.5 h-3.5" />,
                }))}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraLineItems} more</span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      default: return null;
    }
  }, [search, isCondensed, cellFontSize, avatarSize, avatarFontSize, smallAvatarSize, smallAvatarFontSize]);

  const isTableView = density !== "kanban";

  /* ═══ Render ═══ */
  /* Submit for Review and Release for Fulfillment from a row check the
     order's essential fields first (shared FIELD_RULES, `release`
     stage: customer, Ship to, an active line). A gap shows a short toast
     naming what is missing, with a way into the order. Otherwise the
     row opens the order and runs the header's own flow there
     (inactive-items warning, then submit or the release confirm modal),
     so nothing skips the steps the detail page asks for. */
  const runIfOrderReady = (so: typeof salesOrders[0], goal: string, run: () => void) => {
    const missing = getMissingFields(
      { customer: so.customer, shipTo: so.shippingAddress, lineItems: so.lines.filter(l => !l.cancelled) },
      "release",
    );
    setOpenActionId(null);
    if (missing.length === 0) { run(); return; }
    toast.error(`${so.soNumber} isn't ready yet`, {
      description: `${joinLabels(missing)} ${missing.length === 1 ? "is" : "are"} required to ${goal}.`,
      action: { label: "Open Order", onClick: () => navigate(`/sales-orders/${so.id}`) },
    });
  };

  /* Row menu, shared by the table and the fullscreen table so both
     stay identical. Order (product spec): View Details, Copy Link,
     Print, Download, the persona's next step (Sales View: Submit for Review;
     Approver View: Release for Fulfillment, which creates the approved
     order straight from a Draft), Duplicate, Archive, Cancel. Export
     CSV stays off the row (backlog, see IMPORT_EXPORT_ENABLED). */
  const renderRowMenuItems = (so: typeof salesOrders[0]) => {
    const canArchiveRow = ARCHIVABLE_STATES.includes(so.status);
    const canUnarchiveRow = so.status === "Archived";
    /* Nothing left to cancel once every open line has shipped, even if
       the status has not caught up to Shipped yet. */
    const hasShippedLinesRow = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
    const cancellableLinesRow = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
    const fullyShippedRow = hasShippedLinesRow && cancellableLinesRow.length === 0;
    const canCancelRow = !fullyShippedRow && !["Cancelled", "Archived", "Cancellation Requested", "Shipped"].includes(so.status);
    const isPartialOnlyRow = canCancelRow && hasShippedLinesRow && cancellableLinesRow.length > 0;
    const showSubmit = so.status === "Draft" && isCreator;
    const showRelease = (so.status === "Pending Review" || so.status === "Draft") && isReviewer;
    const hasNextStep = showSubmit || showRelease;
    return (
      <>
        <DropdownMenuItem onClick={() => navigate(`/sales-orders/${so.id}`)}>
          <Eye className="w-4 h-4 mr-2" /> View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/sales-orders/${so.id}`); toast.success("Link copied"); }}>
          <Link2 className="w-4 h-4 mr-2" /> Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPrintSO(so)}>
          <Printer className="w-4 h-4 mr-2" /> Print Sales Order
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDownloadSO(so)}>
          <Download className="w-4 h-4 mr-2" /> Download Sales Order
        </DropdownMenuItem>
        {hasNextStep && <DropdownMenuSeparator />}
        {showSubmit && (
          <DropdownMenuItem onClick={() => runIfOrderReady(so, "submit it for review", () => navigate(`/sales-orders/${so.id}?action=submit`))}>
            <Send className="w-4 h-4 mr-2" /> Submit for Review
          </DropdownMenuItem>
        )}
        {showRelease && (
          <DropdownMenuItem onClick={() => runIfOrderReady(so, "release it for fulfillment", () => navigate(`/sales-orders/${so.id}?action=release`))}>
            <CheckCircle className="w-4 h-4 mr-2" /> Release for Fulfillment
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleDuplicate(so.id)}>
          <Copy className="w-4 h-4 mr-2" /> Duplicate
        </DropdownMenuItem>
        {canUnarchiveRow && (
          <DropdownMenuItem onClick={() => handleUnarchiveRow(so.id)}>
            <ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive
          </DropdownMenuItem>
        )}
        {canArchiveRow && (
          <DropdownMenuItem onClick={() => handleArchiveRow(so.id)} className="text-destructive focus:text-destructive focus:bg-destructive/5">
            <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
          </DropdownMenuItem>
        )}
        {canCancelRow && !isPartialOnlyRow && (
          <DropdownMenuItem onClick={() => handleCancelRow(so.id)} className="text-destructive focus:text-destructive focus:bg-destructive/5">
            <Ban className="w-4 h-4 mr-2 text-destructive" /> Cancel Order
          </DropdownMenuItem>
        )}
        {isPartialOnlyRow && (
          <DropdownMenuItem
            onClick={() => handleCancelRow(so.id, true)}
            className="focus:bg-orange-50"
            style={{ color: "#D97706" }}
          >
            <Ban className="w-4 h-4 mr-2" style={{ color: "#D97706" }} />
            Cancel Lines
            <span className="ml-auto text-[10px] text-muted-foreground">partial</span>
          </DropdownMenuItem>
        )}
      </>
    );
  };

  return (
    <>
    <div className="flex-1 min-w-0 flex flex-col h-full px-6 lg:px-8 py-6" style={{ paddingBottom: 0, overflowX: "hidden", overflowY: "auto" }}>

        {/* ─── Page Header — Quotes pattern: bg-accent icon chip, semantic tokens, sticky to top ─── */}
        <div className="flex items-center justify-between shrink-0 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent">
              <FileText className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-[20px]">Sales Orders</h1>
              <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Manage and track sales orders — from confirmation through allocation, picking, and shipping.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Actions, Import / Export (hidden: IMPORT_EXPORT_ENABLED). Same trigger and menu placement as the
                User Access Control listing, so bulk operations live in the same
                spot across modules. */}
            {IMPORT_EXPORT_ENABLED && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0">
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3.5 h-3.5 text-[#64748B]" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { void handleExportOrders(); }}>
                  <Download className="w-3.5 h-3.5 text-[#64748B]" />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Create New SO
            </button>
          </div>
        </div>

        {/* ─── Performance Insights Cards ─── */}
        {!insightsCollapsed && activeInsights.length > 0 && !anyFullscreen && (
          <div className="shrink-0" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                <InsightsRangeMenu
                  range={insightsDateRange}
                  onRangeChange={setInsightsDateRange}
                  customFrom={insightsCustom.from}
                  customTo={insightsCustom.to}
                  onCustomChange={(from, to) => setInsightsCustom({ from, to })}
                />
                <InsightsRefresh toastLabel="Sales order insights refreshed" />
              </div>
              <button onClick={() => setShowInsights(true)} className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer" style={{ fontWeight: 500, color: "hsl(var(--primary))" }}>
                <Plus className="w-3 h-3" /> Add Insights
              </button>
            </div>
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {insightCardData.map((card, idx) => (
                  <DraggableInsightCard key={card.label} index={idx} card={card} moveCard={moveInsight} onRemove={(label) => setActiveInsights(prev => prev.filter(i => i.label !== label))} />
                ))}
              </div>
            </DndProvider>
          </div>
        )}

        {insightsCollapsed && activeInsights.length > 0 && !anyFullscreen && (
          <div className="flex items-center gap-2 shrink-0 mb-2">
            <button onClick={() => setInsightsCollapsed(false)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <BarChart3 className="w-3 h-3" /> Show Insights
            </button>
          </div>
        )}


        {IMPORT_EXPORT_ENABLED && !anyFullscreen && importNotice && (
          <ImportNoticeBanner
            notice={importNotice}
            entity={{ singular: 'order', plural: 'orders' }}
            onOpenDetails={() => {
              /* The run's detail page lives in Company Setup, Data Imports,
                 which is not built on this side yet. */
              toast.info('Import details live in Company Setup, Data Imports.');
            }}
            onDismiss={dismissImportNotice}
          />
        )}

        {/* ─── White Card — search, pills, table / kanban, pagination ─── */}
        {!anyFullscreen && (
        <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl" style={{ marginBottom: 24 }} ref={contentCardRef}>

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                <input className="w-full h-[34px] border border-border/80 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400, backgroundColor: '#FFFFFF' }} />
                {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
              </div>
              <SOFilterBar
                filters={advancedFilters}
                onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                isKanbanView={density === "kanban"}
                salesOrders={salesOrdersForFilterPreview as any}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {filtered.length !== salesOrders.filter(s => s.status !== "Archived").length ? (
                  <><span className="text-foreground">{filtered.length}</span><span className="text-muted-foreground/60"> of </span><span className="text-muted-foreground">{salesOrders.length}</span><span className="text-muted-foreground/70"> orders</span></>
                ) : (
                  <><span className="text-foreground">{filtered.length}</span><span className="text-muted-foreground/70"> orders</span></>
                )}
              </span>
              <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

              {/* Insights toggle — hidden in fullscreen kanban so the board
                  area isn't cluttered. Insights cards are already hidden in
                  that mode; the toggle returns when the user exits fullscreen. */}
              {!(isKanban && kanbanFullscreen) && (
                <button type="button" onClick={() => { if (!showInsights) { setInsightsCollapsed(false); } setShowInsights(true); }} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showInsights ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                  <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                  {insightCardData.length > 0 && (
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}>{insightCardData.length}</span>
                  )}
                </button>
              )}

              {/* Density dropdown */}
              <div className="relative">
                <button type="button" onClick={() => setDensityOpen(!densityOpen)} className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none">
                  {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "kanban" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{DENSITY_CONFIG.find(d => d.key === density)?.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
                {densityOpen && (
                  <div className="absolute right-0 top-full mt-1 w-[230px] bg-popover border border-border rounded-lg z-[200] p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    {DENSITY_CONFIG.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button key={opt.key} onClick={() => { setDensity(opt.key); setDensityOpen(false); }} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                          <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                          {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column selector — irrelevant in kanban (status columns are
                  fixed there, not user-configurable table columns), so hidden
                  in that view. */}
              {!isKanban && (
                <button onClick={() => setShowColumns(!showColumns)} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showColumns ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                  <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
                  <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}>{visibleColCount}</span>
                </button>
              )}

              {/* Fullscreen toggle — Kanban view only. Sits last in the
                  cluster (separated by a vertical divider) so the order
                  matches the Quote toolbar: Insights → Density →
                  Columns → ▏ → Fullscreen. Entering fullscreen forces
                  the insights cards to show so the behaviour is the
                  same as the Quote module (instead of carrying the
                  user's normal-view collapsed state into fullscreen). */}
              {isKanban && (
                <>
                  <div className="w-px h-5 bg-border/60 mx-1" />
                  {/* Portal-rendered white tooltip — matches the
                      design-system surface used elsewhere (Partner v7
                      / Quote KPI info hover-cards), no more black bubble. */}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            if (!kanbanFullscreen) setInsightsCollapsed(false);
                            setKanbanFullscreen(!kanbanFullscreen);
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0"
                        >
                          {kanbanFullscreen ? <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" /> : <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={6}
                        className="bg-white text-muted-foreground border border-border rounded-lg px-3 py-2 shadow-md text-[11px]"
                        style={{ lineHeight: 1.55, fontWeight: 500 }}
                      >
                        {kanbanFullscreen ? "Exit fullscreen view" : "Expand to fullscreen view"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}

            </div>
          </div>

          {/* Filter pills removed — filters managed via modal only */}

          {/* ── Quick Filter Pills (always shown) ── */}
          <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: isKanban ? 'visible' : 'auto', flexWrap: isKanban ? 'wrap' : 'nowrap' }}>
            <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-accent text-primary hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400 }}>
              <User className="w-3.5 h-3.5" /> Me mode
            </button>
            {/* In kanban view, only show Me mode and Show All — status pills are redundant as columns represent statuses */}
            {!isKanban && (
              <>
                <div className="w-px h-5 bg-border shrink-0" />
                {MAIN_STATUS_FILTERS.map(sf => {
                  const isShowAllPill = sf === "All";
                  const isActive = isShowAllPill ? showAll : activeStates.has(sf as SOStatus);
                  const count = statusCount(sf);
                  return (
                    <SharedFilterPill
                      key={sf}
                      label={STATUS_FILTER_LABELS[sf] || sf}
                      active={isActive}
                      count={sf !== "All" ? count : undefined}
                      onClick={() => { if (isShowAllPill) selectShowAll(); else toggleActiveState(sf as SOStatus); }}
                    />
                  );
                })}
                {/* Archived pill — destructive tone, red accent at rest
                    AND when active. Uses the shared FilterPill so size,
                    hover, badge, and border all match Partner. */}
                <div className="w-px h-5 bg-border mx-1 shrink-0" />
                <SharedFilterPill
                  label="Archived"
                  tone="destructive"
                  icon={Archive}
                  active={showArchived}
                  count={statusCount("Archived")}
                  onClick={toggleArchived}
                />
              </>
            )}
            {isKanban && (
              <>
                {/* Separator between Me mode and Kanban controls */}
                <div className="w-px h-5 bg-border mx-1 shrink-0" />

                {/* Group By button — next to Me mode */}
                <div ref={kanbanGroupByRef} className="relative shrink-0">
                  <button type="button" onClick={() => setKanbanGroupByOpen(!kanbanGroupByOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanGroupBy !== "none" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanGroupBy !== "none" ? 500 : 400, color: kanbanGroupBy !== "none" ? "#0A77FF" : undefined }}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{kanbanGroupBy === "none" ? "Group By" : (kanbanGroupBy === "salesRep" ? "Sales Rep" : kanbanGroupBy === "customer" ? "Customer" : "Priority")}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {kanbanGroupByOpen && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setKanbanGroupByOpen(false)} />
                      {/* Compact dropdown — same chrome as the Time Duration
                          dropdown beside it (and the Quote board's Group By).
                          Label + check only, no icon/description rows. */}
                      <div className="fixed z-[9999] w-[180px] bg-popover border border-border rounded-lg p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", top: (kanbanGroupByRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (kanbanGroupByRef.current?.getBoundingClientRect().right ?? 0) - 180 }}>
                        {([
                          { value: "none" as const, label: "No Grouping" },
                          { value: "salesRep" as const, label: "Sales Rep" },
                          { value: "customer" as const, label: "Customer" },
                          { value: "priority" as const, label: "Priority" },
                        ]).map(opt => (
                          <button key={opt.value} onClick={() => { setKanbanGroupBy(opt.value); setKanbanGroupByOpen(false); }} className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                            <span className="flex-1 text-sm text-left" style={{ fontWeight: 500, color: kanbanGroupBy === opt.value ? '#0A77FF' : undefined }}>{opt.label}</span>
                            {kanbanGroupBy === opt.value && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Time Duration button — next to Group By */}
                <div ref={kanbanTimeDurationRef} className="relative shrink-0">
                  <button type="button" onClick={() => setKanbanTimeDurationOpen(!kanbanTimeDurationOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanTimeDuration !== "all" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanTimeDuration !== "all" ? 500 : 400, color: kanbanTimeDuration !== "all" ? "#0A77FF" : undefined }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{
                      kanbanTimeDuration === "last_7_days" ? "Last 7 days" :
                      kanbanTimeDuration === "last_30_days" ? "Last 30 days" :
                      kanbanTimeDuration === "last_6_months" ? "Last 6 months" :
                      kanbanTimeDuration === "last_12_months" ? "Last 12 months" :
                      kanbanTimeDuration === "custom" ? (kanbanCustomRange.from && kanbanCustomRange.to ? `${kanbanCustomRange.from} → ${kanbanCustomRange.to}` : "Custom range") : "All"
                    }</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {kanbanTimeDurationOpen && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setKanbanTimeDurationOpen(false)} />
                      <div className="fixed z-[9999] w-[300px] bg-popover border border-border rounded-lg p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", top: (kanbanTimeDurationRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (kanbanTimeDurationRef.current?.getBoundingClientRect().right ?? 0) - 300 }}>
                        {[
                          { value: "last_7_days", label: "Last 7 days" },
                          { value: "last_30_days", label: "Last 30 days" },
                          { value: "last_6_months", label: "Last 6 months" },
                          { value: "last_12_months", label: "Last 12 months" },
                          { value: "all", label: "All" },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => { setKanbanTimeDuration(opt.value); setKanbanTimeDurationOpen(false); }} className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                            <span className="flex-1 text-sm text-left" style={{ fontWeight: 500, color: kanbanTimeDuration === opt.value ? '#0A77FF' : undefined }}>{opt.label}</span>
                            {kanbanTimeDuration === opt.value && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                          </button>
                        ))}
                        {/* Bug A5: Custom range. Reuses native
                            <input type="date"> like the rest of the SO
                            module so no new picker is introduced. */}
                        {/* Custom range — uses the same `DatePickerField`
                            chrome the Freight / Shipment Method modal
                            renders, so every date input across the
                            module shares one calendar (MM/DD/YYYY
                            trigger, custom month + year dropdowns
                            inside the calendar). */}
                        {/* Custom range — sub-heading typography matches
                            Partners' menu section labels (10px / 600 /
                            uppercase / tracking-widest / muted-foreground/50)
                            as seen in ColumnSelector. From/To sit side
                            by side now that the menu is wider. */}
                        <div className="border-t border-border mt-1 pt-2 px-3 pb-3">
                          <div className="flex items-center justify-between mb-2 px-0.5">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60" style={{ fontWeight: 600 }}>Custom range</span>
                            {kanbanTimeDuration === "custom" && <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />}
                          </div>
                          <div className="flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 min-w-0">
                              <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                              <DatePickerField
                                value={fromIsoDate(kanbanCustomRange.from)}
                                onChange={(d) => {
                                  setKanbanCustomRange((r) => ({ ...r, from: d ? toIsoDate(d) : "" }));
                                  setKanbanTimeDuration("custom");
                                }}
                                placeholder="MM/DD/YYYY"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                              <DatePickerField
                                value={fromIsoDate(kanbanCustomRange.to)}
                                onChange={(d) => {
                                  setKanbanCustomRange((r) => ({ ...r, to: d ? toIsoDate(d) : "" }));
                                  setKanbanTimeDuration("custom");
                                }}
                                minDate={fromIsoDate(kanbanCustomRange.from)}
                                placeholder="MM/DD/YYYY"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Bulk Action Bar — separate row, sits BELOW the filter pills
                 while a selection is active. Symmetric `py-3` padding so the
                 buttons don't sit flush against the top divider. */}
          {selectedIds.size > 0 && !showArchived && isTableView && (
            <div role="toolbar" aria-label="Bulk actions for selected orders" className="flex items-center gap-1.5 px-4 py-3 shrink-0 border-t border-border">
              <div className="flex items-center w-full" style={{ height: "30px", gap: "12px" }}>
                <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", color: "var(--muted-foreground)" }}>
                  {selectedIds.size} {selectedIds.size === 1 ? "order" : "orders"} selected
                </span>
                <div style={{ width: "1px", height: "20px", background: "var(--border)", flexShrink: 0 }} />
                <div className="inline-flex items-center" style={{ gap: "4px" }}>
                {/* Bulk actions are intentionally narrow. Submit for
                    Review and Release for Fulfillment are the only verbs
                    we expose in bulk. Export, Print, Archive, and
                    Cancel are deliberately not offered here — those
                    flows require per-record context (reason capture,
                    line-level cancellation matrix, document rendering)
                    that does not generalise across a multi-select. */}
                {bulkSubmitCount > 0 && isCreator && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                    style={{ fontWeight: 500 }}
                    onClick={(e) => { e.stopPropagation(); handleBulkSubmitForReview(); }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Review</span>
                    <span className="tabular-nums opacity-80">({bulkSubmitCount})</span>
                  </button>
                )}
                {bulkApprovableCount > 0 && isReviewer && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                    style={{ fontWeight: 500 }}
                    onClick={(e) => { e.stopPropagation(); handleBulkApprove(); }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Release for Fulfillment</span>
                    <span className="tabular-nums opacity-80">({bulkApprovableCount})</span>
                  </button>
                )}
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "var(--font-weight-medium)", color: "var(--muted-foreground)" }}
              >
                Esc to clear
                <X size={12} />
              </button>
            </div>
          </div>
          )}

          <div className="border-t border-border shrink-0" />

          {/* Archived banner */}
          {showArchived && (
            <div className="flex items-center justify-between bg-muted/50 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5"><Archive className="w-4 h-4 text-muted-foreground" /><span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>Showing archived orders — these are hidden from the default view</span></div>
              {selectedIds.size > 0 && <button onClick={handleBulkUnarchive} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-white cursor-pointer" style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive {selectedIds.size}</button>}
            </div>
          )}


          {/* ── Content: Table or Kanban ── */}
          {!isTableView ? (
            <div className="flex-1 min-h-0 min-w-0 flex relative">
              <SOKanbanBoard salesOrders={filtered} search={search} columnVisibility={columnVisibility} groupBy={kanbanGroupBy} isFullscreen={false} onToggleFullscreen={() => setKanbanFullscreen(true)} onStatusChange={handleKanbanStatusChange} onCancelRequest={handleKanbanCancelRequest} />
              {/* Column Configurator Panel for Kanban */}
              {showColumns && (
                <div className="shrink-0 h-full" style={{ zIndex: 20 }}>
                  <SOColumnConfigurator columns={legacyColumns} onChange={handleLegacyColumnsChange} onClose={() => setShowColumns(false)} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 flex relative">
              <div ref={scrollContainerRef} className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-card">
                    {/* Quotes-aligned header row: font-medium (not browser-bold), muted-foreground text.
                        Sticky cells use an explicit hex matching `bg-muted/30` against white so the
                        frozen columns blend seamlessly with the rest of the header row. */}
                    <tr className={`bg-muted/30 hover:bg-muted/30 border-b border-border [&>th]:font-medium [&>th]:text-muted-foreground ${density === "condensed" ? "[&>th]:h-9" : "[&>th]:h-11"}`}>
                      {/* Checkbox */}
                      <th className="sticky left-0 z-20 text-left whitespace-nowrap !pl-2 !pr-0 w-[40px] min-w-[40px] max-w-[40px]" style={{ background: "#F8FAFC" }}>
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selectedIds.size > 0 && selectedIds.size === paginated.length}
                            onClick={toggleSelectAll}
                            className="shrink-0 flex items-center justify-center"
                            style={{
                              width: "16px", height: "16px", borderRadius: "4px",
                              border: selectedIds.size > 0 && selectedIds.size === paginated.length ? "1.5px solid #2563EB" : "1.5px solid #D1D5DB",
                              background: selectedIds.size > 0 && selectedIds.size === paginated.length ? "#2563EB" : "#fff",
                              cursor: "pointer", padding: 0, outline: "none", transition: "all 0.15s ease",
                            }}
                          >
                            {selectedIds.size > 0 && selectedIds.size === paginated.length && <Check size={11} strokeWidth={2.5} style={{ color: "#fff" }} />}
                          </button>
                        </div>
                      </th>
                      {/* Dynamic columns with header menus */}
                      {visibleColumns.map(key => {
                        const def = colDef(key);
                        const isFrozen = frozenColumns.has(key);
                        const isLocked = LOCKED_COLUMNS.includes(key);
                        const isDraggable = !isLocked;
                        const currentColSort: "asc" | "desc" | null = sortConfig?.key === key ? sortConfig.direction : null;
                        const width = columnWidths[key] ?? def.minWidth;
                        const isBeingDragged = draggingColumnKey === key;

                        return (
                          <th
                            key={key}
                            data-col-drag-key={key}
                            onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                            onClickCapture={isDraggable ? (e) => { if (suppressNextClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined}
                            className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky z-20" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                            style={{
                              width: `${width}px`,
                              overflow: "hidden",
                              ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px`, background: "#F8FAFC" } : {}),
                              ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                              ...(isBeingDragged ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}),
                            }}
                          >
                            {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
                            {isDraggable && <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/70"}`} />}

                            <div className={`flex items-center ${def.align === "right" ? "w-full" : ""} pl-4 pr-2`} style={key === "so" ? { paddingLeft: 40 } : undefined}>
                              <SOColumnHeaderMenu
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
                              >
                                <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                  <span className="text-[13px]" style={currentColSort ? { color: "#0A77FF" } : undefined}>{def.label}</span>
                                  {/* Sort arrow — always visible for sortable columns; muted slate by
                                      default, primary blue once the user clicks to sort. */}
                                  {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                  {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                  {!currentColSort && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground/60 transition-colors" />}
                                </div>
                              </SOColumnHeaderMenu>
                            </div>

                            {/* Resize handle */}
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => { e.stopPropagation(); setColumnWidths(prev => ({ ...prev, [key]: def.minWidth })); }}
                              className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                              style={{ touchAction: "none" }}
                            >
                              <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                            </div>
                          </th>
                        );
                      })}
                      {/* Actions */}
                      <th className="sticky right-0 z-20 whitespace-nowrap w-[60px] !pl-2 !pr-2" style={{ background: "#F8FAFC", boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                        <span className="text-[13px]">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody style={{ pointerEvents: draggingColumnKey ? "none" : undefined }}>
                    {paginated.map((so, idx) => {
                      const globalIdx = (page - 1) * perPage + idx;
                      const versionNum = so.version?.number ?? (1 + (globalIdx % 4));
                      const hoveredRow2 = hoveredRow === so.id;
                      const canArchiveRow = ARCHIVABLE_STATES.includes(so.status);
                      const canUnarchiveRow = so.status === "Archived";
                      const canCancelRow = !["Cancelled", "Archived", "Cancellation Requested", "Shipped"].includes(so.status);
                      const hasShippedLinesRow = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
                      const cancellableLinesRow = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
                      const isFullCancelBlockedRow = hasShippedLinesRow;
                      const isPartialOnlyRow = canCancelRow && isFullCancelBlockedRow && cancellableLinesRow.length > 0;
                      const canApproveRow = so.status === "Pending Review" || so.status === "Draft";
                      const canSubmitRow = so.status === "Draft";
                      const canCloseRow = so.status === "Shipped" || so.status === "Partially Shipped";

                      const isRowDisabled = ["Cancelled", "Archived", "Cancellation Requested"].includes(so.status);
                      const isSelected = selectedIds.has(so.id);
                      const selectionActive = selectedIds.size > 0;

                      /* Row hover is suppressed while a column is being
                         dragged so the left sticky rail stays white
                         under the cursor — matches Partner Management. */
                      const isHovered = hoveredRowId === so.id && !draggingColumnKey;
                      /* Blend of `--muted: #F1F5F9` at 50% opacity on
                         white — matches what PM's `hover:bg-muted/50`
                         renders. Frozen cells need this as a solid
                         value because their inline `background:
                         var(--card)` would otherwise mask the
                         Tailwind alpha wash from the tr. */
                      const stickyBg = isSelected ? "#EFF6FF" : isHovered ? "#F8FAFC" : "var(--card)";
                      return (
                        <tr key={so.id}
                          className={`border-b border-border/50 transition-colors group ${isSelected ? "" : (draggingColumnKey ? "cursor-pointer" : "hover:bg-muted/50 cursor-pointer")}`}
                          onClick={() => {
                            if (selectionActive) {
                              if (!isRowDisabled) toggleSelectSO(so.id);
                              return;
                            }
                            navigate(`/sales-orders/${so.id}`);
                          }}
                          onMouseEnter={() => setHoveredRowId(so.id)}
                          onMouseLeave={() => setHoveredRowId((cur) => (cur === so.id ? null : cur))}
                          style={{
                             background: isSelected ? "#EFF6FF" : undefined,
                            opacity: isRowDisabled && selectionActive ? 0.45 : 1,
                            cursor: selectionActive ? (isRowDisabled ? "not-allowed" : "pointer") : "pointer",
                            transition: "background 0.15s ease, opacity 0.15s ease",
                          }}
                        >
                          <td className={`sticky left-0 transition-colors ${rowH} !pl-2 !pr-0 z-10`} style={{ width: 40, background: stickyBg, borderBottom: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                disabled={isRowDisabled && selectionActive}
                                onClick={() => { if (!isRowDisabled) toggleSelectSO(so.id); }}
                                className="shrink-0 flex items-center justify-center"
                                style={{
                                  width: "16px", height: "16px", borderRadius: "4px",
                                  border: (isRowDisabled && selectionActive) ? "1.5px solid #D5D7DB" : isSelected ? "1.5px solid #2563EB" : "1.5px solid #D1D5DB",
                                  background: (isRowDisabled && selectionActive) ? "#F0F1F3" : isSelected ? "#2563EB" : "#fff",
                                  cursor: (isRowDisabled && selectionActive) ? "not-allowed" : "pointer",
                                  padding: 0, outline: "none", transition: "all 0.15s ease",
                                }}
                              >
                                {isSelected && !(isRowDisabled && selectionActive) && <Check size={11} strokeWidth={2.5} style={{ color: "#fff" }} />}
                              </button>
                            </div>
                          </td>
                          {visibleColumns.map(key => {
                            const isFrozen = frozenColumns.has(key);
                            const def2 = colDef(key);
                            const width = columnWidths[key] ?? def2.minWidth;

                            if (key === "so") {
                              const createdByMe = isSOCreatedByMe(so);
                              const salesRepMe = isSOSalesRepMe(so);
                              const mine = createdByMe || salesRepMe;
                              const mineLabel = mineReason(createdByMe, salesRepMe);
                              return (
                                <td key={key} className={`sticky transition-colors ${rowH} pl-4 pr-2 z-10`} style={{ left: frozenOffsets[key] ?? CHECKBOX_COL_WIDTH, width: `${width}px`, background: stickyBg, ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}), ...(draggingColumnKey === key ? { backgroundImage: "linear-gradient(rgba(10,119,255,0.035), rgba(10,119,255,0.035))" } : {}) }}>
                                  {/* Reserved 16px slot before the SO number
                                      so the ID text always lands at the same
                                      X whether or not the row is mine. The
                                      header label is shifted by the same
                                      offset further down. */}
                                  <div className="flex items-center w-full" style={{ gap: 8 }}>
                                    <span className="inline-flex items-center justify-center shrink-0" style={{ width: 16, height: 16 }} aria-hidden={!mine}>
                                      {mine && (
                                        <TooltipProvider delayDuration={150}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex" aria-label={mineLabel}>
                                                <User className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: "#2563EB" }} />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" sideOffset={6} className="bg-white text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 shadow-md text-[11px]">
                                              {mineLabel}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </span>
                                    <span className={`text-foreground hover:text-primary hover:underline cursor-pointer whitespace-nowrap text-[13px] ${isCondensed ? "" : "flex-1"}`} style={{ fontWeight: 500 }}><HighlightText text={so.soNumber} search={search} /></span>
                                    {/* Outdated-configuration surface moved out of the listing; the
                                        detail-page version banner is now the single entry point for
                                        the sync flow. The listing stays on the version badge alone. */}
                                    <VersionBadge
                                      version={versionNum}
                                      compact
                                      showExpandIcon
                                      onClick={(e) => { e.stopPropagation(); setVersionModalSO(so); }}
                                    />
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={key} className={`${isFrozen ? "sticky transition-colors z-10" : ""} ${rowH} pl-4 pr-2 ${def2.align === "right" ? "text-right" : ""}`}
                                style={{
                                  width: `${width}px`,
                                  ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px`, background: stickyBg } : {}),
                                  ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                  ...(draggingColumnKey === key ? { backgroundImage: "linear-gradient(rgba(10,119,255,0.035), rgba(10,119,255,0.035))" } : {}),
                                }}
                              >
                                {renderCell(key, so, globalIdx)}
                              </td>
                            );
                          })}
                          {/* Actions — Partner v7 row-menu pattern:
                              shadcn DropdownMenu around a 8x8 MoreHorizontal
                              trigger. Radix manages click-outside + focus
                              so the menu actually stays open when the user
                              hovers an option. */}
                          <td className={`sticky right-0 transition-colors ${rowH} z-10 !pl-2 !pr-2`} style={{ width: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)", background: stickyBg }} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
                                  {renderRowMenuItems(so)}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginated.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground py-12 text-[13px]">No sales orders match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Column Configurator Panel */}
              {showColumns && (
                <div className="shrink-0 h-full" style={{ zIndex: 20 }}>
                  <SOColumnConfigurator columns={legacyColumns} onChange={handleLegacyColumnsChange} onClose={() => setShowColumns(false)} />
                </div>
              )}
              </div>
            </div>
          )}

          {/* ── Pagination ── */}
          {isTableView && (
            <div className="flex items-center justify-center border-t border-border px-4 py-3">
              <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Records per page</span>
                  <div className="relative">
                    <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="appearance-none bg-card border border-border rounded-md cursor-pointer outline-none hover:border-muted-foreground/30 text-foreground text-[13px] px-2 py-1 pr-6">
                      <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-muted-foreground/50 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors px-2 py-1"><ChevronLeft className="w-3 h-3" /> Prev</button>
                  {getPageNumbers().map((p, i) => p === "..." ? <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-muted-foreground/50">…</span> : <button key={p} onClick={() => setPage(p as number)} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors text-[13px] ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"}`} style={{ fontWeight: 500 }}>{p}</button>)}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="flex items-center gap-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors px-2 py-1">Next <ChevronRight className="w-3 h-3" /></button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ═══ Fullscreen Portal ═══ */}
        {anyFullscreen && createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col bg-background" style={{ overflow: 'hidden' }}>
            {/* Page header bar — kept visible in fullscreen so the user
                can still spin up a new sales order without exiting back
                to the regular listing first. Mirrors the bar that ships
                above the non-fullscreen layout. */}
            <div className="flex items-center justify-between shrink-0 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent">
                  <FileText className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-[20px]">Sales Orders</h1>
                  <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Manage and track sales orders — from confirmation through allocation, picking, and shipping.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Actions, Import / Export (hidden: IMPORT_EXPORT_ENABLED). Same trigger and menu placement as the
                    User Access Control listing, so bulk operations live in the same
                    spot across modules. */}
                {IMPORT_EXPORT_ENABLED && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Actions
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0">
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setImportOpen(true)}>
                      <Upload className="w-3.5 h-3.5 text-[#64748B]" />
                      Import
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { void handleExportOrders(); }}>
                      <Download className="w-3.5 h-3.5 text-[#64748B]" />
                      Export
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
                <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                  <Plus className="w-4 h-4" strokeWidth={2.5} /> Create New SO
                </button>
              </div>
            </div>
            {/* Performance Insights is intentionally HIDDEN in fullscreen
                kanban — the panel exists to surface KPIs at a glance, but
                fullscreen is for maximizing the board surface, so we hand
                all vertical pixels to the kanban below. The panel still
                renders in the regular (non-fullscreen) layout above.
                Non-kanban fullscreens (none today, but future) keep the
                panel via the `!isKanban` guard. */}
            {!isKanban && !insightsCollapsed && activeInsights.length > 0 && (
              <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 4 }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                  </div>
                  <button onClick={() => setInsightsCollapsed(true)} className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <DndProvider backend={HTML5Backend}>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {insightCardData.map((card, idx) => (
                      <DraggableInsightCard key={card.label} index={idx} card={card} moveCard={moveInsight} onRemove={(label) => setActiveInsights(prev => prev.filter(i => i.label !== label))} />
                    ))}
                  </div>
                </DndProvider>
              </div>
            )}
            {!isKanban && insightsCollapsed && activeInsights.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 px-5 py-2">
                <button onClick={() => setInsightsCollapsed(false)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                  <BarChart3 className="w-3 h-3" /> Show Insights
                </button>
              </div>
            )}
            {/* White card with full content */}
            <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl mx-4 mb-4 mt-2">
              {isKanban ? (
                <>
                  {/* Kanban fullscreen toolbar */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                        <input className="w-full h-[34px] border border-border/80 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400, backgroundColor: '#FFFFFF' }} />
                        {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
                      </div>
                      <SOFilterBar
                        filters={advancedFilters}
                        onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                        isKanbanView={true}
                        salesOrders={salesOrdersForFilterPreview as any}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Insights + Columns buttons are intentionally omitted in
                          the fullscreen kanban toolbar — fullscreen exists to
                          maximise the board surface, and kanban columns aren't
                          user-configurable (they map to status), so neither
                          control is useful here. Both reappear when the user
                          exits fullscreen. */}
                      {/* Exit fullscreen — portal-rendered white tooltip,
                          same surface as KPI info hover-cards. */}
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => { setKanbanFullscreen(false); }}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0"
                            >
                              <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            sideOffset={6}
                            className="bg-white text-muted-foreground border border-border rounded-lg px-3 py-2 shadow-md text-[11px]"
                            style={{ lineHeight: 1.55, fontWeight: 500 }}
                          >
                            Exit fullscreen · <kbd className="text-[10px] opacity-70">Esc</kbd>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  {/* Kanban pills row */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                    <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-accent text-primary hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400 }}>
                      <User className="w-3.5 h-3.5" /> Me mode
                    </button>
                    <div className="w-px h-5 bg-border mx-1 shrink-0" />
                    {/* Group By */}
                    <div ref={kanbanGroupByRef} className="relative shrink-0">
                      <button type="button" onClick={() => setKanbanGroupByOpen(!kanbanGroupByOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanGroupBy !== "none" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanGroupBy !== "none" ? 500 : 400, color: kanbanGroupBy !== "none" ? "#0A77FF" : undefined }}>
                        <Layers className="w-3.5 h-3.5" />
                        <span>{kanbanGroupBy === "none" ? "Group By" : (kanbanGroupBy === "salesRep" ? "Sales Rep" : kanbanGroupBy === "customer" ? "Customer" : "Priority")}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Time Duration */}
                    <div ref={kanbanTimeDurationRef} className="relative shrink-0">
                      <button type="button" onClick={() => setKanbanTimeDurationOpen(!kanbanTimeDurationOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanTimeDuration !== "all" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanTimeDuration !== "all" ? 500 : 400, color: kanbanTimeDuration !== "all" ? "#0A77FF" : undefined }}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{kanbanTimeDuration === "last_7_days" ? "Last 7 days" : kanbanTimeDuration === "last_30_days" ? "Last 30 days" : kanbanTimeDuration === "last_6_months" ? "Last 6 months" : kanbanTimeDuration === "last_12_months" ? "Last 12 months" : kanbanTimeDuration === "custom" ? (kanbanCustomRange.from && kanbanCustomRange.to ? `${kanbanCustomRange.from} → ${kanbanCustomRange.to}` : "Custom range") : "All"}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-px h-5 bg-border mx-1 shrink-0" />
                    {MAIN_STATUS_FILTERS.map(sf => {
                      const isShowAllPill = sf === "All";
                      const isActive = isShowAllPill ? showAll : activeStates.has(sf as SOStatus);
                      const count = statusCount(sf);
                      return (
                        <SharedFilterPill
                          key={sf}
                          label={STATUS_FILTER_LABELS[sf] || sf}
                          active={isActive}
                          count={sf !== "All" ? count : undefined}
                          onClick={() => { if (isShowAllPill) selectShowAll(); else toggleActiveState(sf as SOStatus); }}
                        />
                      );
                    })}
                  </div>
                  <div className="border-t border-border shrink-0" />
                  <div className="flex-1 min-h-0 flex relative">
                    <SOKanbanBoard salesOrders={filtered} search={search} columnVisibility={columnVisibility} groupBy={kanbanGroupBy} isFullscreen onToggleFullscreen={() => setKanbanFullscreen(false)} onStatusChange={handleKanbanStatusChange} onCancelRequest={handleKanbanCancelRequest} />
                  </div>
                </>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Toolbar in fullscreen — all controls visible */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                        <input className="w-full h-[34px] border border-border/80 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400, backgroundColor: '#FFFFFF' }} />
                        {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
                      </div>
                      <SOFilterBar
                        filters={advancedFilters}
                        onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                        isKanbanView={false}
                        salesOrders={salesOrdersForFilterPreview as any}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Insights toggle */}
                      <button type="button" onClick={() => { setInsightsCollapsed(!insightsCollapsed); }} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${!insightsCollapsed ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                      </button>
                      {/* Density toggle */}
                      <button type="button" onClick={() => setDensity(density === "condensed" ? "comfort" : "condensed")} className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none">
                        {density === "condensed" ? <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" /> : <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{density === "condensed" ? "Condensed" : "Comfort"}</span>
                      </button>
                      {/* Columns */}
                      <button onClick={() => setShowColumns(!showColumns)} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showColumns ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
                      </button>
                      <div className="w-px h-5 bg-border/60 mx-1" />
                      {/* Exit fullscreen */}
                      <div className="relative group/fs">
                        <button type="button" onClick={() => setKanbanFullscreen(false)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
                          <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        </button>
                        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/fs:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-[#1E293B] text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ fontWeight: 500 }}>
                            Exit fullscreen · <kbd className="text-[10px] opacity-70">Esc</kbd>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Pills in fullscreen */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                    <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-accent text-primary hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400 }}>
                      <User className="w-3.5 h-3.5" /> Me mode
                    </button>
                    <div className="w-px h-5 bg-border shrink-0" />
                    {MAIN_STATUS_FILTERS.map(sf => {
                      const isShowAllPill = sf === "All";
                      const isActive = isShowAllPill ? showAll : activeStates.has(sf as SOStatus);
                      const count = statusCount(sf);
                      return (
                        <SharedFilterPill
                          key={sf}
                          label={STATUS_FILTER_LABELS[sf] || sf}
                          active={isActive}
                          count={sf !== "All" ? count : undefined}
                          onClick={() => { if (isShowAllPill) selectShowAll(); else toggleActiveState(sf as SOStatus); }}
                        />
                      );
                    })}
                  </div>
                  <div className="border-t border-border shrink-0" />
                  {/* Full table in fullscreen */}
                  <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: "thin" }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-20 bg-card">
                        <tr className="bg-muted/30 hover:bg-muted/30 border-b border-border [&>th]:font-medium [&>th]:text-muted-foreground [&>th]:h-9">
                          <th className="sticky left-0 z-20 text-left whitespace-nowrap !pl-2 !pr-0 w-[40px] min-w-[40px] max-w-[40px]" style={{ background: "#F8FAFC" }}>
                            <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === paginated.length} onChange={toggleSelectAll} />
                          </th>
                          {visibleColumns.map(key => {
                            const def = colDef(key);
                            const width = columnWidths[key] ?? def.minWidth;
                            return (
                              <th key={key} className={`whitespace-nowrap ${def.align === "right" ? "text-right" : ""}`} style={{ width: `${width}px`, padding: "0 8px" }}>
                                <span className="text-[13px]">{def.label}</span>
                              </th>
                            );
                          })}
                          <th className="whitespace-nowrap w-[60px] !pl-2 !pr-2"><span className="text-[13px]">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((so, idx) => {
                          const globalIdx = (page - 1) * perPage + idx;
                          /* Stage-driven capability flags — same as the
                             standard table render above (SOList.tsx
                             :1339). Keeping them inline keeps the menu
                             content identical between the standard
                             list view and this fullscreen variant. */
                          const canArchiveRow = ARCHIVABLE_STATES.includes(so.status);
                          const canUnarchiveRow = so.status === "Archived";
                          const canCancelRow = !["Cancelled", "Archived", "Cancellation Requested", "Shipped"].includes(so.status);
                          const isFullCancelBlockedRow = ["Partially Shipped"].includes(so.status);
                          const cancellableLinesRow = isFullCancelBlockedRow ? so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty) : [];
                          const isPartialOnlyRow = canCancelRow && isFullCancelBlockedRow && cancellableLinesRow.length > 0;
                          const canApproveRow = so.status === "Pending Review" || so.status === "Draft";
                          const canSubmitRow = so.status === "Draft";
                          const canCloseRow = so.status === "Shipped" || so.status === "Partially Shipped";
                          return (
                            <tr key={so.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate(`/sales-orders/${so.id}`)}>
                              <td className="!pl-2 !pr-0 py-1" style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" checked={selectedIds.has(so.id)} onChange={() => toggleSelectSO(so.id)} />
                              </td>
                              {visibleColumns.map(key => (
                                <td key={key} className={`py-1 px-2 ${colDef(key).align === "right" ? "text-right" : ""}`}>
                                  {renderCell(key, so, globalIdx)}
                                </td>
                              ))}
                              <td className="!pl-2 !pr-2 py-1" style={{ width: 60 }} onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
                                      {renderRowMenuItems(so)}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {paginated.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground py-12 text-[13px]">No sales orders match your filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Column drag ghost — Partner-parity pill with grip icon, blur
          surface, and optional sort/filter indicators. Positioned via
          the ref set inside the mousemove handler so drag movement
          runs at zero re-renders. */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed", top: 0, left: 0, zIndex: 9999,
            pointerEvents: "none",
            opacity: draggingColumnKey ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform",
          }}
        >
          {draggingColumnKey && (() => {
            const ghostSort: "asc" | "desc" | null = sortConfig?.key === draggingColumnKey ? sortConfig.direction : null;
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
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "var(--primary)" }} />
                <span className="text-[13px]" style={{ color: "var(--primary)", fontWeight: 500 }}>
                  {colDef(draggingColumnKey).label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "var(--primary)" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "var(--primary)" }} />}
              </div>
            );
          })()}
        </div>,
        document.body,
      )}

      {/* Insights Panel — overlay drawer (not pushing) */}
      <InsightsPanel onClose={() => setShowInsights(false)} onActiveChange={setActiveInsights} open={showInsights} />
      <ItemQuickViewPanel data={itemQuickView} onClose={() => setItemQuickView(null)} />
      {/* Legacy import. The wizard owns template, upload, the
          record-shaped review sheet, and the completion dialog. */}
      <ExportRecordsModal
        open={IMPORT_EXPORT_ENABLED && exportOpen}
        onClose={() => setExportOpen(false)}
        records={exportRows}
        scopeNote="Every order on your list will be exported"
      />

      <ImportWizardModal
        open={IMPORT_EXPORT_ENABLED && importOpen}
        onClose={() => setImportOpen(false)}
        onGoToListing={() => setImportOpen(false)}
        validateOptions={{
          singleCurrency: true,
          conditionalDateKey: 'shipBy',
          datesRequiredForStatuses: ['Released', 'Shipped'],
          alreadyImported: new Set(salesOrders.map((so) => so.soNumber.toLowerCase())),
        }}
        onApplied={(outcome) => {
          if (outcome.created.length === 0) return;
          /* Turn the reviewed rows into real orders through the store's
             own `createSO`, the same call the in-app creation flow makes,
             so the listing updates and the detail page can open an
             imported order without any import-specific plumbing. */
          const importedAt = new Date().toISOString();
          const meta = { importedAt, importName: outcome.importName, fileName: outcome.fileName };
          const built = outcome.created.map((record, i) => {
            const { partial, adjustments } = materializeSO(record, meta, i);
            const so = createSO(partial);
            /* The file's one-time discounts and premiums, waiting for the
               detail page to seed its adjustments layer. */
            setImportedAdjustments(so.id, adjustments);
            return so;
          });
          /* Land the user on a view where the new rows are actually
             visible rather than filtered out. */
          setPage(1); setSearch(''); setAdvancedFilters(EMPTY_SO_FILTERS);
          const n = built.length;
          setImportNotice({
            created: n,
            updated: 0,
            skipped: outcome.skipped.length + outcome.failed.length,
            warnings: outcome.warningCount,
            importId: `IMP-${Date.now()}`,
          });
          toast.success(`${n} order${n === 1 ? '' : 's'} imported as V1 and tagged Legacy Import.`, {
            description: n === 1 ? `${built[0].soNumber} is now at the top of the listing.` : 'They are at the top of the listing.',
            action: { label: n === 1 ? 'Open' : 'Open first', onClick: () => navigate(`/sales-orders/${built[0].id}`) },
          });
        }}
      />

      <CreateSOModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onContinue={(payload: SOCreationPayload, opts?: { createAnother?: boolean }) => {
        const primaryRep = payload.salesReps.find(r => r.primary) ?? payload.salesReps[0];
        const so = createSO({
          customer: payload.customer,
          customerInitials: payload.customerInitials,
          customerId: payload.customerId,
          /* Bill to / Ship to / payment come from step 1 as picked. A
             name-only customer passes "" and the record keeps it empty. */
          shippingAddress: payload.shippingAddress,
          billingAddress: payload.billingAddress,
          paymentTerms: payload.paymentTerms,
          paymentMethod: payload.paymentMethod,
          /* Description intentionally left empty for user-created SOs
             — the "Sales order for X, N line items" auto-copy was
             boilerplate that duplicated info already visible in the
             header (customer + line count). Users can add their own
             description via the empty-state pencil affordance. */
          description: "",
          priority: payload.priority,
          tags: payload.tags,
          pocs: payload.pocs,
          primaryPocId: payload.primaryPocId,
          salesRep: primaryRep?.name ?? "",
          salesReps: payload.salesReps,
          lines: payload.lineItems.map(li => ({ id: "", itemCode: li.itemCode, itemName: li.itemName, itemType: li.itemType, warehouse: "Main Warehouse", orderedQty: li.qty, allocatedQty: 0, pickedQty: 0, shippedQty: 0, deliveredQty: 0, unitPrice: li.unitPrice, taxRate: 0.08, allocations: [], cancelled: false, cancelledQty: 0, readyToPick: false })),
        });
        /* Partner create toast: "<Entity> <name> created successfully". */
        toast.success(`Sales order ${so.soNumber} created successfully`, { duration: 5000 });
        /* Create & Make Another keeps the modal open; it resets itself. */
        if (opts?.createAnother) return;
        setShowCreateModal(false);
        navigate(`/sales-orders/${so.id}`);
      }} />
      {confirmSingleSO && <ConfirmSOModal so={confirmSingleSO} onConfirm={() => handleSingleConfirmDone()} onClose={() => setConfirmSingleSO(null)} />}
      {showBulkConfirm && <BulkConfirmSOModal orders={selectedSOs} onConfirm={(soIds) => handleBulkConfirmDone(soIds)} onClose={() => setShowBulkConfirm(false)} />}
      {cancelTargetSO && <CancellationModal so={cancelTargetSO} mode={cancelModalMode} onConfirmFull={handleCancelFull} onConfirmPartial={handleCancelPartial} onClose={() => setCancelTargetSO(null)} />}
      {archiveTargetSO && <ArchiveModal so={archiveTargetSO} onConfirm={handleConfirmArchive} onClose={() => setArchiveTargetSO(null)} />}
      {/* Duplicate SO — modal + overlay flow. On confirm we build the
          duplicate via the shared helper, persist it through the SO
          store (so the listing reflects it immediately), play the
          shared overlay animation, then navigate to the new SO. */}
      {duplicateTargetSO && (
        <DuplicateSOModal
          isOpen={true}
          onClose={() => setDuplicateTargetSO(null)}
          soNumber={duplicateTargetSO.soNumber}
          currentCustomer={duplicateTargetSO.customer}
          availableVersions={duplicateTargetSO.versions}
          currentVersion={duplicateTargetSO.version?.number}
          onConfirm={({ customerId, customerName, versionMode, selectedVersion }) => {
            const source = duplicateTargetSO;
            setDuplicateTargetSO(null);
            const payload = buildDuplicateSOPayload(source, {
              newCustomerId: customerId,
              newCustomerName: customerName,
              versionMode,
              selectedVersion,
            });
            const dup = createSO(payload);
            const versionLabel = versionMode === 'all'
              ? 'all versions copied'
              : `from V${selectedVersion}`;
            setDuplicateOverlay({
              fromNumber: source.soNumber,
              toNumber: dup.soNumber,
              targetId: dup.id,
              versionLabel,
            });
          }}
        />
      )}
      <StateTransitionOverlay
        isActive={duplicateOverlay !== null}
        fromLabel={duplicateOverlay?.fromNumber ?? ''}
        toLabel={duplicateOverlay?.toNumber ?? ''}
        tone="info"
        Icon={Copy}
        heading="Duplicating Sales Order"
        meta={duplicateOverlay?.versionLabel}
        duration={2000}
        onComplete={() => {
          if (!duplicateOverlay) return;
          const { targetId, toNumber } = duplicateOverlay;
          setDuplicateOverlay(null);
          toast.success(`Sales Order duplicated → ${toNumber}`);
          navigate(`/sales-orders/${targetId}`);
        }}
      />
      {showBulkSubmitReview && <BulkSubmitForReviewModal orders={selectedSOs} onConfirm={handleBulkSubmitConfirmed} onClose={() => setShowBulkSubmitReview(false)} />}
      {versionModalSO && (
        <VersionHistoryModal
          soNumber={versionModalSO.soNumber}
          currentVersion={versionModalSO.version?.number ?? 1}
          onClose={() => setVersionModalSO(null)}
          onRevert={(toVersion) => {
            revertToVersion(versionModalSO.id, toVersion);
            setVersionModalSO(prev => prev ? { ...prev, version: prev.version ? { ...prev.version, number: toVersion } : { number: toVersion, label: 'Latest', date: '' } } : prev);
          }}
        />
      )}
      {printSO && (
        <SendToCustomerModal
          isOpen={true}
          so={printSO}
          isResend={false}
          mode="print"
          onClose={() => setPrintSO(null)}
          onSend={() => setPrintSO(null)}
        />
      )}
      {downloadSO && (
        <ExportSOModal
          open={true}
          so={downloadSO}
          onClose={() => setDownloadSO(null)}
        />
      )}
    </>
  );
}
