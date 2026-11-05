import React, { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  ArrowLeft,
  X,
  Pencil,
  Archive,
  ArchiveRestore,
  CircleSlash,
  CircleCheck,
  Maximize2,
  Minimize2,
  Package,
  Building2,
  FileText,
  Paperclip,
  Clock,
  Search,
  SlidersHorizontal,
  Copy,
  Check,
  Shield,
  Receipt,
  Lock,
  Ban,
  ExternalLink,
  AlignJustify,
  List,
  ChevronDown,
  CalendarDays,
  SquareSplitHorizontal,
  MessageSquare,
  Activity,
  Plus,
  Banknote,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { getAvatarTint } from "../../utils/avatarTints";
import {
  type PaymentTermPreset,
  CREATE_PT_TYPES,
  CREATE_PT_TRIGGERS,
  PARTNER_GROUPS,
} from "./partnerConstants";

/* Written mid-sentence phrase for each trigger label ("...days after the order confirmation."). */
const TRIGGER_PHRASE: Record<string, string> = {
  "Order Confirmation": "order confirmation",
  "Production Start": "production start",
  "Production End": "production end",
  Shipping: "shipping",
  Delivery: "delivery",
};

/* ─── Parse split-term milestones from the description ─── */
// Handles phrasings like: "30% is due at production start, 70% at delivery"
// or "20% at order confirmation, 30% at production end, 50% at delivery"
function parseSplitMilestones(description: string): { pct: string; label: string }[] {
  if (!description) return [];
  const re = /(\d+)%\s+(?:is\s+)?(?:due\s+)?(?:at\s+|on\s+|upon\s+)?([^,.;]+)/gi;
  const out: { pct: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(description)) !== null) {
    const pct = `${m[1]}%`;
    const rawLabel = m[2].trim();
    if (!rawLabel) continue;
    // Show the written trigger label (case-insensitive lookup), else the text as written
    const cleaned = rawLabel.replace(/\s+/g, " ");
    const label = CREATE_PT_TRIGGERS.find((t) => t.label.toLowerCase() === cleaned.toLowerCase())?.label ?? cleaned;
    out.push({ pct, label });
  }
  return out;
}

/* ─── Partner logo lookup (mirrors VendorsListPage) ─── */
const PARTNER_LOGOS: Record<string, string> = {
  Toyota: "https://logo.clearbit.com/toyota.com",
  Tesla: "https://logo.clearbit.com/tesla.com",
  Ford: "https://logo.clearbit.com/ford.com",
  BMW: "https://logo.clearbit.com/bmw.com",
  Honda: "https://logo.clearbit.com/honda.com",
  "General Motors": "https://logo.clearbit.com/gm.com",
  FedEx: "https://logo.clearbit.com/fedex.com",
  UPS: "https://logo.clearbit.com/ups.com",
  Nissan: "https://logo.clearbit.com/nissan-global.com",
  Chrysler: "https://logo.clearbit.com/stellantis.com",
  Rivian: "https://logo.clearbit.com/rivian.com",
  Lucid: "https://logo.clearbit.com/lucidmotors.com",
};
function getPtPartnerLogo(name: string): string | undefined {
  for (const k of Object.keys(PARTNER_LOGOS)) if (name.includes(k)) return PARTNER_LOGOS[k];
  return undefined;
}
const PT_LOC_PHOTOS = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=80&h=80&fit=crop",
];

/* ─── Person avatar lookup (mirrors VendorsListPage) ─── */
const PT_PERSON_AVATARS: Record<string, string> = {
  Sarah: "https://randomuser.me/api/portraits/women/44.jpg",
  Michael: "https://randomuser.me/api/portraits/men/32.jpg",
  Emily: "https://randomuser.me/api/portraits/women/65.jpg",
  David: "https://randomuser.me/api/portraits/men/75.jpg",
  Rachel: "https://randomuser.me/api/portraits/women/28.jpg",
  James: "https://randomuser.me/api/portraits/men/46.jpg",
  Lisa: "https://randomuser.me/api/portraits/women/17.jpg",
  Robert: "https://randomuser.me/api/portraits/men/22.jpg",
  Amanda: "https://randomuser.me/api/portraits/women/56.jpg",
  Kevin: "https://randomuser.me/api/portraits/men/64.jpg",
  Maria: "https://randomuser.me/api/portraits/women/33.jpg",
  Chris: "https://randomuser.me/api/portraits/men/85.jpg",
  Jessica: "https://randomuser.me/api/portraits/women/91.jpg",
  Andrew: "https://randomuser.me/api/portraits/men/41.jpg",
  Nicole: "https://randomuser.me/api/portraits/women/72.jpg",
  Thomas: "https://randomuser.me/api/portraits/men/55.jpg",
  Stephanie: "https://randomuser.me/api/portraits/women/15.jpg",
  Daniel: "https://randomuser.me/api/portraits/men/18.jpg",
  Karen: "https://randomuser.me/api/portraits/women/48.jpg",
  Brian: "https://randomuser.me/api/portraits/men/67.jpg",
  Tanya: "https://randomuser.me/api/portraits/women/21.jpg",
  Jennifer: "https://randomuser.me/api/portraits/women/38.jpg",
  Mark: "https://randomuser.me/api/portraits/men/29.jpg",
  Anna: "https://randomuser.me/api/portraits/women/81.jpg",
  Tom: "https://randomuser.me/api/portraits/men/12.jpg",
  Beth: "https://randomuser.me/api/portraits/women/52.jpg",
  Nina: "https://randomuser.me/api/portraits/women/9.jpg",
  Irtaza: "/avatars/irtaza-abid.jpg",
  Mahreen: "/avatars/mahreen-ghafoor.png",
  Nophil: "/avatars/nophil-anwer.png",
  Eli: "/avatars/eli-rosenbloom.png",
};
function getPtPersonAvatar(name: string): string | undefined {
  const first = name.split(" ")[0];
  return PT_PERSON_AVATARS[first];
}

/* ─── Small logo-avatar with fallback initials (mirrors listing page style) ─── */
function PtLogoAvatar({ logoUrl, initials, bg, size = "md" }: { logoUrl?: string; initials: string; bg: string; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const showImg = logoUrl && !failed;
  const sizeClass = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : "text-[10px]";
  return (
    <div
      className={`${sizeClass} rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`}
      style={{ backgroundColor: showImg ? "#FFFFFF" : bg }}
    >
      {showImg ? (
        <img src={logoUrl} alt="" className="w-full h-full object-contain p-1.5" onError={() => setFailed(true)} />
      ) : (
        <span className={`${textSize} text-slate-700`} style={{ fontWeight: 700 }}>{initials}</span>
      )}
    </div>
  );
}

/* ─── Round person-avatar for POC column (mirrors listing page style) ─── */
function PtPersonAvatar({ photoUrl, initials, bg, fg, size = "md" }: { photoUrl?: string; initials: string; bg: string; fg: string; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const showImg = photoUrl && !failed;
  const sizeClass = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : "text-[10px]";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`}
      style={{ backgroundColor: showImg ? "transparent" : bg }}
    >
      {showImg ? (
        <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className={textSize} style={{ fontWeight: 700, color: fg }}>{initials}</span>
      )}
    </div>
  );
}

/* ─── Tab config ─── */
// Overview goes first per the v1 review: users were duplicating terms just
// to see the structure. The Overview tab shows the layout in read-only form
// for templates and editable form for custom terms, plus the term's
// metadata (created by, updated at, condition pills) that used to live in
// the header. Notes was removed in favour of Chat as the canonical
// discussion surface.
const PT_DETAIL_TABS = [
  { id: "setup", label: "Overview", icon: FileText },
  { id: "vendors", label: "Partners", icon: Building2 },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Recent Activity", icon: Clock },
];

const PT_DUMMY_ATTACHMENTS: AttachmentFile[] = [
  { id: "a1", name: "Payment_Terms_Agreement_v2.pdf", size: "245 KB", type: "pdf", date: "2026-03-28T09:00:00Z", uploadedBy: "Sarah Johnson" },
  { id: "a2", name: "Vendor_Credit_Assessment.xlsx", size: "128 KB", type: "xlsx", date: "2026-03-22T14:20:00Z", uploadedBy: "Michael Torres" },
  { id: "a3", name: "Discount_Policy_2026.pdf", size: "89 KB", type: "pdf", date: "2026-03-15T10:30:00Z", uploadedBy: "Emily Chen" },
];

const PT_DUMMY_ACTIVITY = [
  { id: "act1", action: "payment term applied", target: "BoltMaster Inc.", user: "Sarah Johnson", date: "Mar 28, 2026 · 2:45 PM", type: "apply" },
  { id: "act2", action: "early discount updated", target: "2% → 3% within 10 days", user: "Michael Torres", date: "Mar 25, 2026 · 11:30 AM", type: "edit" },
  { id: "act3", action: "payment term created", target: "", user: "Emily Chen", date: "Mar 20, 2026 · 9:15 AM", type: "create" },
  { id: "act4", action: "payment term applied", target: "Toyota International", user: "David Kim", date: "Mar 18, 2026 · 4:00 PM", type: "apply" },
  { id: "act5", action: "duration changed", target: "30 days → 45 days", user: "Sarah Johnson", date: "Mar 15, 2026 · 10:20 AM", type: "edit" },
];

/* ─── Mock items matching partner listing table ─── */
const PT_MOCK_ITEMS = [
  { id: "1", code: "FAST-HEX-001", desc: "Zinc-Plated Steel Hex Head Screw, 1/4\"-20 x 1\"", vendor: "BoltMaster Inc.", partNo: "BM-2520-100", status: "In Stock", controlType: "Non-Serialized", primaryCat: "Fasteners", additionalCat: ["Screws", "Hardware"], img: "🔩" },
  { id: "2", code: "VALV-BAL-316", desc: "316 Stainless Steel Ball Valve, 2-Piece, 1\"", vendor: "FlowControl", partNo: "SS-BV-100", status: "Low Stock", controlType: "Serialized", primaryCat: "Plumbing", additionalCat: ["Valves", "Industrial"], img: "🔧" },
  { id: "3", code: "SEAL-OR-012", desc: "Buna-N O-Ring, Dash Number 012, Hardness 70A", vendor: "SealTech", partNo: "BN-70-012", status: "In Stock", controlType: "Non-Serialized", primaryCat: "Seals", additionalCat: ["O-Rings", "Rubber Goods"], img: "⭕" },
  { id: "4", code: "TOOL-EM-050", desc: "Solid Carbide Square End Mill, 1/2\" Cutting Dia", vendor: "PrecisionTools", partNo: "SC-EM-4F-500", status: "In Stock", controlType: "Non-Serialized", primaryCat: "Tools", additionalCat: ["Milling", "Carbide"], img: "⚙️" },
  { id: "5", code: "MAT-AL-6061", desc: "6061-T6 Aluminum Sheet, 12\" x 24\" x 0.125\"", vendor: "AluSupply", partNo: "AL-6061-125", status: "Out of Stock", controlType: "Non-Serialized", primaryCat: "Raw Materials", additionalCat: ["Metals", "Sheet Stock"], img: "📦" },
  { id: "6", code: "MECH-BRG-6204", desc: "Deep Groove Ball Bearing, 6204-2RS, Sealed", vendor: "MotionPro", partNo: "6204-2RS", status: "In Stock", controlType: "Serialized", primaryCat: "Power Trans", additionalCat: ["Bearings", "Mechanical"], img: "🔘" },
];

/* ─── Vendors pulled from partner listing data ─── */
import { useVendors } from "../../context/VendorContext";
import { STATUS_LABELS, type Vendor } from "../../data/vendors";
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
import { usePaymentTermStatus } from "../../context/PaymentTermStatusContext";
import { CATEGORY_LABELS } from "../../data/vendors";
import { getVendorsForPaymentTerm } from "./paymentTermUsage";
import { SubmoduleChatTab } from "./SubmoduleChatTab";
import { TableEmptyRow, TableSkeletonRows, resolveTableEmptyKind, useTableLoadState } from "../ui/table-empty-state";
import { AttachmentsTab, type AttachmentFile } from "./AttachmentsTab";
import { ActivityFeed, type ActivityFeedItemType } from "./PartnerGroupDetailModal";

/* ─── Linked-partners table: shared column-header system (Column Filters
 * spec). `filterType` follows the data-type rule — fixed pick-list →
 * multiselect, open text → text search. Widths are fixed px so frozen
 * columns can compute cumulative sticky-left offsets; proportions mirror
 * the previous auto-layout. ─── */
const PT_PARTNER_COLUMN_DEFS: { key: string; label: string; width: number; sortable: boolean; filterType: FilterType }[] = [
  { key: "partner_name", label: "Partner", width: 240, sortable: true, filterType: "text" },
  { key: "partner_type", label: "Partner Type", width: 160, sortable: true, filterType: "multiselect" },
  { key: "partner_locations", label: "Partner Locations", width: 220, sortable: true, filterType: "text" },
  { key: "global_contacts", label: "Points of Contact", width: 200, sortable: true, filterType: "text" },
  { key: "partner_group", label: "Partner Group", width: 170, sortable: true, filterType: "multiselect" },
  { key: "status", label: "Status", width: 110, sortable: true, filterType: "multiselect" },
];
const PT_PARTNER_LOCKED_COLUMN = "partner_name";
const ptPartnerFilterTypeFor = (key: string): FilterType =>
  PT_PARTNER_COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

/* Thin wrapper over the canonical Partners accessor — overrides the two
 * keys whose rendered value differs from the raw field: partner name
 * falls back to companyName (matching the cell), and partner group
 * resolves the id to its display name so multiselect options and filter
 * chips read like the cells do. */
const ptPartnerCellValue: CellAccessor<Vendor> = (v, columnKey) => {
  if (columnKey === "partner_name") return v.displayName || v.companyName;
  if (columnKey === "partner_group") {
    return PARTNER_GROUPS.find((g) => g.id === v.partnerGroup)?.name || v.partnerGroup;
  }
  return vendorCellValue(v, columnKey);
};

interface PaymentTermDetailModalProps {
  term: PaymentTermPreset | null;
  open: boolean;
  onClose: () => void;
  /** "view" = read-only on details page, "create" = inside creation form with Apply to Partner */
  mode?: "view" | "create";
  onDisable?: (term: PaymentTermPreset) => void;
  onApply?: (term: PaymentTermPreset) => void;
  onDuplicate?: (term: PaymentTermPreset) => void;
}

/* Card chrome that visually mirrors the Partner Details ContentCard. */
function ModalContentCard({
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

function PaymentTermDetailModal({ term, open, onClose, mode = "create", onDisable, onApply, onDuplicate }: PaymentTermDetailModalProps) {
  const [tab, setTab] = useState("setup");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [itemFilter, setItemFilter] = useState("all");
  const [density, setDensity] = useState<"condensed" | "comfort">("condensed");
  const [densityOpen, setDensityOpen] = useState(false);
  // Pending lifecycle confirmations — both surface a centered AlertDialog
  // matching the Set-as-Primary pattern. Only one is open at a time.
  const [pendingAction, setPendingAction] = useState<"disable" | "enable" | "archive" | "restore" | null>(null);
  const { vendors } = useVendors();
  const { getStatus, setStatus } = usePaymentTermStatus();

  /* ─── Linked-partners table: sort / filter / hide / freeze state ─── */
  const [ptSortConfig, setPtSortConfig] = useState<SortConfig | null>(null);
  const [ptColumnFilters, setPtColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [ptAutoOpenFilterKey, setPtAutoOpenFilterKey] = useState<string | null>(null);
  const [ptHiddenColumns, setPtHiddenColumns] = useState<Set<string>>(new Set());
  const [ptFrozenColumns, setPtFrozenColumns] = useState<Set<string>>(new Set([PT_PARTNER_LOCKED_COLUMN]));

  const ptColumnFiltersList = useMemo(() => Object.values(ptColumnFilters), [ptColumnFilters]);
  const ptColumnLabels = useMemo(
    () => Object.fromEntries(PT_PARTNER_COLUMN_DEFS.map((c) => [c.key, c.label])),
    [],
  );

  // Filter the global vendor list down to those whose payment-terms enum
  // matches this preset (see paymentTermUsage.ts). Same helper drives the
  // count on PaymentTermCard so the pill and the list never diverge.
  const ptVendors = useMemo(
    () => (term ? getVendorsForPaymentTerm(term, vendors) : []),
    [term, vendors],
  );

  const ptUniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    PT_PARTNER_COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, ptVendors, ptPartnerCellValue);
    });
    return map;
  }, [ptVendors]);

  const handlePtSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setPtSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handlePtAddColumnFilter = useCallback((columnKey: string) => {
    setPtColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, ptPartnerFilterTypeFor(columnKey)) });
  }, []);
  const handlePtAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setPtColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, ptPartnerFilterTypeFor(columnKey)) });
    setPtAutoOpenFilterKey(null);
    setTimeout(() => setPtAutoOpenFilterKey(columnKey), 0);
  }, []);
  const handlePtColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setPtColumnFilters((prev) => ({ ...prev, [columnKey]: filter }));
  }, []);
  const handlePtRemoveColumnFilter = useCallback((columnKey: string) => {
    setPtColumnFilters((prev) => { const next = { ...prev }; delete next[columnKey]; return next; });
  }, []);
  const handlePtClearAllColumnFilters = useCallback(() => setPtColumnFilters({}), []);
  const handlePtHideColumn = useCallback((columnKey: string) => {
    setPtHiddenColumns((prev) => new Set(prev).add(columnKey));
    setPtSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handlePtFreezeColumn = useCallback((columnKey: string) => {
    setPtFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== PT_PARTNER_LOCKED_COLUMN) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  const ptVisibleColumns = useMemo(() => PT_PARTNER_COLUMN_DEFS.filter((c) => !ptHiddenColumns.has(c.key)), [ptHiddenColumns]);

  /* Frozen columns stack from the left in visible order — same offset
   * math as the Partners listing reference. */
  const ptFrozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = 0;
    ptVisibleColumns.forEach((c) => {
      if (ptFrozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    });
    return offsets;
  }, [ptVisibleColumns, ptFrozenColumns]);
  const ptLastFrozenKey = useMemo(() => {
    const frozen = ptVisibleColumns.filter((c) => ptFrozenColumns.has(c.key));
    return frozen.length ? frozen[frozen.length - 1].key : null;
  }, [ptVisibleColumns, ptFrozenColumns]);

  /* Pipeline: column filters, then sort — same engine as the Partners grid. */
  const ptRows = useMemo(() => {
    const filtered = applyFilters(ptVendors, ptColumnFiltersList, ptPartnerCellValue);
    return sortRows(filtered, ptSortConfig, ptPartnerCellValue, ptPartnerFilterTypeFor);
  }, [ptVendors, ptColumnFiltersList, ptSortConfig]);

  /* Global empty / error states for the linked-partners grid. */
  const ptTableLoad = useTableLoadState();
  const ptEmptyKind = resolveTableEmptyKind({
    loadState: ptTableLoad.loadState,
    totalCount: ptTableLoad.forceEmpty ? 0 : ptVendors.length,
    filteredCount: ptTableLoad.forceEmpty ? 0 : ptRows.length,
    filterCount: ptColumnFiltersList.length,
  });

  if (!term) return null;

  const ptDuration = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  const ptTypeLabel = CREATE_PT_TYPES.find((t) => t.id === term.category)?.label || "Net Terms";
  // Locked per-category palette — NET = blue, Pre = violet, Split = orange.
  // Kept here as explicit hex so CSS opacity concatenation can't silently fail.
  const pill =
    term.category === "net"
      ? { text: "#0A77FF", bg: "#EBF3FF", border: "#CFE6FF" }
      : term.category === "prepayment"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  const badgeColor = pill.text;
  const isCustom = term.id.startsWith("pt-custom-");
  const isPreset = !isCustom;
  // Runtime status — preset terms are always active; custom terms can
  // be inactive (disabled) or archived. Drives the status pill and the
  // Archive / Disable button copy.
  const runtimeStatus = isPreset ? "active" : getStatus(term.id);
  const statusBadge =
    runtimeStatus === "inactive"
      ? { label: "Inactive", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }
      : runtimeStatus === "archived"
        ? { label: "Archived", bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" }
        : { label: "Active", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" };

  // Detail-modal sizing standard — multi-tab modals keep a stable frame
  // (height + width) so switching between tabs doesn't shrink/grow the
  // modal. Body uses `flex-1 min-h-0 overflow-y-auto` for internal scroll.
  //  • Width: 70vw, capped at 1480px on very wide monitors (industry
  //    line-length / travel-distance limit).
  //  • Height: 88vh with a 640px floor so short laptops aren't cramped
  //    and a 1180px ceiling so the modal isn't awkwardly stretched on
  //    portrait monitors.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullscreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  const itemCount = PT_MOCK_ITEMS.length;
  const vendorCount = ptVendors.length;
  const creatorTint = getAvatarTint("Omnesoft");

  const filteredItems = PT_MOCK_ITEMS;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setIsFullscreen(false); setIsEditing(false); setTab("setup"); } }}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[220] ${modalSizeClass}`}
        hideCloseButton
        overlayClassName="z-[215]"
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Payment Term Details, {term.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of payment term {term.name}</DialogDescription>

        {/* ─── Header: hero-style with inline actions + meta (matches Pricing Rule) ─── */}
        <div data-page-topbar className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
          <div className="px-4 sm:px-5 pt-3 pb-3">
            {/* Top row: back + avatar + (title+badges+description) + actions */}
            <div className="flex items-start gap-3">
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {/* Themed term avatar — category icon + value (matches tab filter icons) */}
              <div
                className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                style={{ backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
              >
                {term.category === "net" ? (
                  <Receipt className="w-4 h-4" style={{ color: pill.text }} />
                ) : term.category === "prepayment" ? (
                  <Clock className="w-4 h-4" style={{ color: pill.text }} />
                ) : (
                  <SquareSplitHorizontal className="w-4 h-4" style={{ color: pill.text }} />
                )}
                <span className="text-[11px] leading-none" style={{ color: pill.text, fontWeight: 700 }}>
                  {term.category === "net" ? ptDuration : term.typeBadge}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{term.name}</h1>
                  {/* Type + Trigger (segmented pill) — locked colors, icons on both sides */}
                  <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}>
                      {term.category === "net" ? (
                        <Receipt className="w-3 h-3" />
                      ) : term.category === "prepayment" ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <SquareSplitHorizontal className="w-3 h-3" />
                      )}
                      {term.typeBadge}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                      <CalendarDays className="w-3 h-3" />
                      {term.trigger || "Shipping"}
                    </span>
                  </span>
                  {/* Status — driven by the runtime status store. Custom
                      terms can land in Inactive (Disabled) or Archived
                      states; preset templates always render Active. */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border" style={{ fontWeight: 500, backgroundColor: statusBadge.bg, color: statusBadge.text, borderColor: statusBadge.border }}>
                    {statusBadge.label}
                  </span>
                  {/* Template / Custom marker */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isCustom ? "border-slate-300 bg-white text-slate-500" : "bg-muted border-slate-300 text-slate-500"}`} style={{ fontWeight: 600 }}>
                    {isCustom ? "Custom" : <><Lock className="w-2.5 h-2.5" /> Template</>}
                  </span>
                </div>
                {/* Description — right below the name */}
                <p className="text-[12px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
                  {term.description || `Payment is due ${ptDuration} days after the ${term.trigger ? (TRIGGER_PHRASE[term.trigger] ?? term.trigger) : "invoice date"}.`}
                </p>
              </div>
              {/* Right-side actions. Edit and Archive are disabled for system
                  templates with a tooltip explaining why; users are pointed to
                  Duplicate as the path forward. The buttons are wrapped in a
                  span when disabled because Radix's Tooltip needs a non-disabled
                  child to receive pointer events. */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => { if (isCustom) { setIsEditing(true); setTab("setup"); } }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      This term ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => {
                          if (!isCustom) return;
                          // Toggle between archive ↔ restore based on
                          // current status.
                          setPendingAction(runtimeStatus === "archived" ? "restore" : "archive");
                        }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Archive className="w-3.5 h-3.5" />{runtimeStatus === "archived" ? "Unarchive" : "Archive"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be archived because they ship with the software. <span className="font-semibold">Duplicate</span> the template if you need a version you can manage.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => {
                          if (!isCustom) return;
                          // Toggle between disable ↔ enable based on
                          // current status.
                          setPendingAction(runtimeStatus === "inactive" ? "enable" : "disable");
                        }}
                        disabled={isPreset || runtimeStatus === "archived"}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Ban className="w-3.5 h-3.5" />{runtimeStatus === "inactive" ? "Enable" : "Disable"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be disabled. <span className="font-semibold">Duplicate</span> the template to create a custom copy you can disable.
                    </TooltipContent>
                  )}
                </Tooltip>
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { onClose(); setIsFullscreen(false); setIsEditing(false); setTab("setup"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Condition pills + created/updated metadata moved to the
                Overview tab — keeping the header focused on identity and
                primary actions only. */}
          </div>
        </div>

        {/* ─── Body: full-width content (no right sidebar) ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Tabs */}
            <div data-page-topbar className="flex items-center border-b border-border shrink-0 px-1 bg-white">
              {PT_DETAIL_TABS.map((t) => {
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

            {/* Setup Tab — structure of the term, mirrors the create-form layout.
                Templates render disabled with a tooltip explaining why; custom
                terms are editable. Editing a term that was cloned from a template
                surfaces a "create new version" confirm before saving. */}
            {tab === "setup" && (
              <PaymentTermSetupTab term={term} isEditing={isEditing} onStopEditing={() => setIsEditing(false)} />
            )}

            {/* Partners Tab */}
            {tab === "vendors" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 shrink-0 bg-white border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[240px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input type="text" placeholder="Search partners..." className="w-full pl-9 pr-3 h-8 text-xs bg-slate-50 border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-slate-400" />
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
                              { key: "condensed", label: "Condensed", desc: "Compact view", Icon: AlignJustify },
                              { key: "comfort", label: "Comfort", desc: "Spacious view", Icon: List },
                            ] as const).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => { setDensity(opt.key); setDensityOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${density === opt.key ? "bg-accent/40" : "hover:bg-slate-50"}`}
                              >
                                <opt.Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{opt.label}</p>
                                  <p className="text-[10px] text-slate-400">{opt.desc}</p>
                                </div>
                                {density === opt.key && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Active column filter chips — shared Notion-style bar */}
                {ptColumnFiltersList.length > 0 && (
                  <div className="shrink-0 bg-white border-b border-border pt-2.5">
                    <ActiveFiltersBar
                      columnFilters={ptColumnFiltersList}
                      columnLabels={ptColumnLabels}
                      uniqueValuesByKey={ptUniqueValuesMap}
                      lockedColumnKey={PT_PARTNER_LOCKED_COLUMN}
                      onFilterChange={handlePtColumnFilterChange}
                      onRemoveFilter={handlePtRemoveColumnFilter}
                      onAddFilter={handlePtAddColumnFilterWithAutoOpen}
                      onClearAll={handlePtClearAllColumnFilters}
                      autoOpenKey={ptAutoOpenFilterKey}
                      onAutoOpened={() => setPtAutoOpenFilterKey(null)}
                      availableColumns={PT_PARTNER_COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
                    />
                  </div>
                )}
                <div className="flex-1 overflow-auto">
                  {(() => {
                    const isRelaxed = density === "comfort";
                    // Row heights: fixed per density so rows stay uniform regardless of cell content.
                    const rowH = isRelaxed ? "h-[56px]" : "h-[40px]";
                    const nameSize = isRelaxed ? "text-[13px]" : "text-sm";
                    const bodyText = isRelaxed ? "text-[13px]" : "text-sm";
                    const cellPadY = isRelaxed ? "py-2" : "py-1";
                    const pillPad = isRelaxed ? "px-2.5 py-1" : "px-2 py-0.5";
                    return (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-30">
                          <tr className="bg-slate-50">
                            {ptVisibleColumns.map((def, colIdx) => {
                              const isFrozen = ptFrozenColumns.has(def.key);
                              const isLocked = def.key === PT_PARTNER_LOCKED_COLUMN;
                              const currentColSort: "asc" | "desc" | null = ptSortConfig?.key === def.key ? ptSortConfig.direction : null;
                              const hasFilter = ptColumnFilters[def.key] ? isFilterActive(ptColumnFilters[def.key]) : false;
                              return (
                                <th
                                  key={def.key}
                                  className={`text-left pl-4 ${colIdx === ptVisibleColumns.length - 1 ? "pr-4" : "pr-2"} py-2.5 text-slate-500 text-[11px] border-b border-border whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""}`}
                                  style={{
                                    fontWeight: 500,
                                    minWidth: `${def.width}px`,
                                    ...(isFrozen ? { left: `${ptFrozenOffsets[def.key] ?? 0}px` } : {}),
                                    ...(def.key === ptLastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                  }}
                                >
                                  <div className="flex items-center">
                                    <ColumnHeaderMenu
                                      columnKey={def.key}
                                      label={def.label}
                                      sortable={def.sortable}
                                      sortConfig={ptSortConfig}
                                      onSort={handlePtSort}
                                      onAddFilter={handlePtAddColumnFilter}
                                      onHideColumn={handlePtHideColumn}
                                      onFreezeColumn={handlePtFreezeColumn}
                                      isFrozen={isFrozen}
                                      isLocked={isLocked}
                                      hasActiveFilter={hasFilter}
                                      filter={ptColumnFilters[def.key] ?? null}
                                      uniqueValues={ptUniqueValuesMap[def.key]}
                                      filterTypeOverride={def.filterType}
                                      onFilterChange={handlePtColumnFilterChange}
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
                          </tr>
                        </thead>
                        <tbody>
                          {ptTableLoad.loadState === "loading" && <TableSkeletonRows columns={ptVisibleColumns.length} rows={5} />}
                          {ptEmptyKind && (
                            <TableEmptyRow
                              colSpan={ptVisibleColumns.length}
                              kind={ptEmptyKind}
                              entity={{ singular: "partner", plural: "partners" }}
                              title={ptEmptyKind === "no-data" ? "No partners use this payment term yet" : undefined}
                              description={ptEmptyKind === "no-data" ? "Partners assigned this payment term will show up here." : undefined}
                              filterCount={ptColumnFiltersList.length}
                              onClearFilters={handlePtClearAllColumnFilters}
                              onRetry={ptTableLoad.retry}
                              retrying={ptTableLoad.retrying}
                              compact
                            />
                          )}
                          {!ptEmptyKind && ptTableLoad.loadState !== "loading" && ptRows.map((v) => {
                            const vTint = getAvatarTint(v.companyName);
                            const vInit = v.companyName.split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                            const logo = getPtPartnerLogo(v.companyName);
                            const partnerTypes = v.partnerTypes || [];
                            const locations = v.partnerLocations || [];
                            const contacts = v.globalPointOfContacts || [];
                            const extraLoc = Math.max(0, locations.length - 1);
                            let plHash = 0;
                            const locSeed = locations[0] || "";
                            for (let c = 0; c < locSeed.length; c++) plHash = locSeed.charCodeAt(c) + ((plHash << 5) - plHash);
                            const locPhoto = PT_LOC_PHOTOS[Math.abs(plHash) % PT_LOC_PHOTOS.length];
                            const groupName = PARTNER_GROUPS.find((g) => g.id === v.partnerGroup)?.name || v.partnerGroup || "–";
                            const statusColor = v.status === "active"
                              ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }
                              : v.status === "inactive"
                                ? { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" }
                                : { bg: "rgb(var(--muted))", text: "#334155", border: "#CBD5E1" };
                            const cell = (key: string) => {
                              switch (key) {
                                case "partner_name":
                                  return (
                                    <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
                                      <PtLogoAvatar logoUrl={logo} initials={vInit} bg={vTint.bg} size={isRelaxed ? "lg" : "md"} />
                                      <div className="min-w-0 flex-1">
                                        <span className={`${nameSize} block truncate`} style={{ fontWeight: 500, color: '#1E293B' }}>{v.displayName || v.companyName}</span>
                                        {isRelaxed && v.emailAddress && (
                                          <span className="text-xs text-muted-foreground/60 truncate block">{v.emailAddress}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                case "partner_type":
                                  return partnerTypes.length > 0 ? (
                                    <div className={`flex items-center ${isRelaxed ? "gap-2" : "gap-1.5"} flex-wrap`}>
                                      {partnerTypes.map((type) => (
                                        <span
                                          key={type}
                                          className={`inline-flex items-center ${pillPad} text-xs rounded-md border`}
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
                                    </div>
                                  ) : <span className={`${bodyText} text-muted-foreground`}>&ndash;</span>;
                                case "partner_locations":
                                  return locations.length > 0 ? (
                                    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-1.5"} min-w-0`}>
                                      <div className={`${isRelaxed ? "w-10 h-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1]`}>
                                        <img src={locPhoto} alt="" className="w-full h-full object-cover" />
                                      </div>
                                      <span className={`${bodyText} truncate`} style={{ fontWeight: isRelaxed ? 500 : undefined, color: '#1E293B' }}>{locations[0]}</span>
                                      {extraLoc > 0 && (
                                        <span className="text-[11px] shrink-0 leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraLoc} more</span>
                                      )}
                                    </div>
                                  ) : <span className={`${bodyText} text-muted-foreground`}>&ndash;</span>;
                                case "global_contacts":
                                  return contacts.length > 0 ? (
                                    (() => {
                                      const poc = contacts[0];
                                      const pocTint = getAvatarTint(poc?.name || "");
                                      const pocPhoto = getPtPersonAvatar(poc?.name || "");
                                      const extraContacts = Math.max(0, contacts.length - 1);
                                      return (
                                        <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
                                          <PtPersonAvatar photoUrl={pocPhoto} initials={poc.initials || "?"} bg={pocTint.bg} fg={pocTint.fg} size={isRelaxed ? "lg" : "md"} />
                                          <span className={`${bodyText} truncate`} style={{ color: '#1E293B' }}>{poc.name}</span>
                                          {extraContacts > 0 && (
                                            <span className="text-[11px] shrink-0 leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraContacts} more</span>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : <span className={`${bodyText} text-muted-foreground`}>&ndash;</span>;
                                case "partner_group":
                                  return <span className={bodyText} style={{ color: '#1E293B' }}>{groupName}</span>;
                                case "status":
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border" style={{ fontWeight: 500, backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}>
                                      {STATUS_LABELS[v.status] ?? v.status}
                                    </span>
                                  );
                                default:
                                  return null;
                              }
                            };
                            return (
                              <tr key={v.id} className={`${rowH} bg-white hover:bg-[#F0F7FF] transition-colors border-b border-muted cursor-pointer`}>
                                {ptVisibleColumns.map((def, colIdx) => {
                                  const isFrozen = ptFrozenColumns.has(def.key);
                                  return (
                                    <td
                                      key={def.key}
                                      className={`pl-4 ${colIdx === ptVisibleColumns.length - 1 ? "pr-4" : "pr-2"} ${cellPadY} align-middle ${def.key === "status" ? "whitespace-nowrap" : ""} ${isFrozen ? "sticky bg-white z-10" : ""}`}
                                      style={{
                                        ...(isFrozen ? { left: `${ptFrozenOffsets[def.key] ?? 0}px` } : {}),
                                        ...(def.key === ptLastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                      }}
                                    >
                                      {cell(def.key)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
                <div data-table-meta className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0 bg-white">
                  <span className="text-[11px] text-slate-500">Showing <span className="text-foreground" style={{ fontWeight: 600 }}>{ptRows.length}</span> of <span className="text-foreground" style={{ fontWeight: 600 }}>{vendorCount}</span> partners</span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Records per Page</span>
                    <select className="h-6 px-1.5 rounded border border-border bg-white text-[11px] text-slate-700 cursor-pointer outline-none">
                      <option>20</option><option>50</option><option>All</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Tab — Partner-details-style soft card with subtle author footer. */}
            {/* Chat Tab — shared submodule chat surface. Conversation
                history scoped to this term via threadKey. */}
            {tab === "chat" && (
              <SubmoduleChatTab
                threadKey={term.id}
                contextLabel={`payment term "${term.name}"`}
              />
            )}

            {/* Attachments Tab — shared component matches Partner Detail page */}
            {tab === "attachments" && (
              <div className="flex-1 overflow-auto">
                <AttachmentsTab files={PT_DUMMY_ATTACHMENTS} embedded />
              </div>
            )}

            {/* Recent Activity Tab — shared feed-style log. */}
            {tab === "activity" && (
              <div className="flex-1 overflow-auto p-4">
                <ModalContentCard title="Activity Timeline" icon={Activity}>
                  <ActivityFeed
                    items={PT_DUMMY_ACTIVITY.map((act) => ({
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
            <span className="text-[11px] text-slate-500">Reviewing: <span className="text-foreground" style={{ fontWeight: 600 }}>{term.name}</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (term && onDuplicate) { onDuplicate(term); onClose(); } else { toast.info("Duplicate coming soon"); } }}
                className="h-8 px-3.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              {mode === "create" && (
                <button
                  onClick={() => {
                    if (!term || !onApply) return;
                    if (runtimeStatus === "inactive") {
                      // Disabled terms stay browsable but can't be applied.
                      toast.error(`${term.name} is disabled`, {
                        description: "Disabled terms can't be applied to partners. Enable it from the header to use it again.",
                      });
                      return;
                    }
                    onApply(term);
                    onClose();
                  }}
                  className={`h-8 px-3.5 rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    runtimeStatus === "inactive" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90"
                  }`} style={{ fontWeight: 500 }}
                >
                  <Check className="w-3.5 h-3.5" /> Apply to Partner
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Lifecycle confirmation — Disable / Enable / Archive / Restore.
          Mirrors the Set-as-Primary modal pattern (centered glow header
          + title + description + full-width action button + cancel). */}
      <AlertDialog open={!!pendingAction} onOpenChange={(v) => { if (!v) setPendingAction(null); }}>
        <AlertDialogContent
          className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
          overlayClassName="!bg-black/20 !z-[235]"
          onInteractOutside={() => setPendingAction(null)}
        >
          {(() => {
            // Canonical lifecycle palette + copy that matches the
            // trigger CTA wording on the term detail header (Archive,
            // Unarchive, Disable, Enable).
            const cfg = pendingAction === "archive"
              ? { gradTop: "#FEF2F2", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "rgb(var(--destructive))", icon: <Archive className="w-8 h-8" />, badge: "Archive", badgeBg: "#FEF2F2", badgeText: "#991B1B", title: `Archive ${term.name}?`, body: "This term is removed from active templates. Partners that already use it keep it; you won't be able to apply it to new partners. The term can be restored from the archive at any time.", confirm: "Archive Term", confirmBg: "rgb(var(--destructive))", cancel: "Keep Active" }
              : pendingAction === "restore"
                ? { gradTop: "#ECFDF5", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#065F46", icon: <ArchiveRestore className="w-8 h-8" />, badge: "Unarchive", badgeBg: "#ECFDF5", badgeText: "#065F46", title: `Unarchive ${term.name}?`, body: "The term goes back to active templates and reappears in default listings and pickers. Partners that already use it are unaffected.", confirm: "Unarchive Term", confirmBg: "#10B981", cancel: "Keep Archived" }
                : pendingAction === "disable"
                  ? { gradTop: "#FFFBEB", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", icon: <CircleSlash className="w-8 h-8" />, badge: "Disable", badgeBg: "#FFFBEB", badgeText: "#92400E", title: `Disable ${term.name}?`, body: "The term stays visible in templates but can't be applied to partners while disabled. Partners that already use it keep it. You can re-enable it from the term detail at any time.", confirm: "Disable Term", confirmBg: "#F59E0B", cancel: "Keep Enabled" }
                  : { gradTop: "#ECFDF5", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#065F46", icon: <CircleCheck className="w-8 h-8" />, badge: "Enable", badgeBg: "#ECFDF5", badgeText: "#065F46", title: `Enable ${term.name}?`, body: "The term goes back to active templates and becomes available for new assignments. Existing assignments stay exactly as-is.", confirm: "Enable Term", confirmBg: "#10B981", cancel: "Keep Disabled" };
            const targetStatus = pendingAction === "archive" ? "archived" : pendingAction === "disable" ? "inactive" : "active";
            const successCopy = pendingAction === "archive" ? `${term.name} archived.` : pendingAction === "restore" ? `${term.name} unarchived.` : pendingAction === "disable" ? `${term.name} disabled.` : `${term.name} enabled.`;
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${cfg.gradTop} 0%, rgba(255,255,255,0.3) 70%, transparent 100%)` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: cfg.glow }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}>
                    {cfg.icon}
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: cfg.badgeBg, color: cfg.badgeText, letterSpacing: "0.05em" }}>
                    {cfg.badge}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600 }}>
                      {cfg.title}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[420px]" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                    {cfg.body}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setStatus(term.id, targetStatus);
                        // Keep onDisable backward-compat — fire it for
                        // the legacy disable callsite if provided.
                        if (pendingAction === "disable" && onDisable) onDisable(term);
                        toast.success(successCopy);
                        setPendingAction(null);
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: cfg.confirmBg, color: "#fff" }}
                    >
                      {cfg.confirm}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                    >
                      {cfg.cancel}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

export { PaymentTermDetailModal };

/* ─────────────────────────────────────────────────────────────────────
   Overview Tab — shows the term's structure (type tiles, trigger,
   duration, discount, splits) in the same visual language as the
   "Create Payment Term" modal so users get one mental model across
   create + view + edit.

   Templates render with disabled fields and a tooltip explaining why.
   Custom terms are editable. Editing a template-derived custom term
   surfaces a "create new version" confirm the first time a field is
   touched, since the spec says those edits get versioned.

   Footer carries the term metadata (Created by / Updated) that used to
   live in the modal header.
   ──────────────────────────────────────────────────────────────────── */
function PaymentTermSetupTab({ term, isEditing = false, onStopEditing }: { term: PaymentTermPreset; isEditing?: boolean; onStopEditing?: () => void }) {
  const isCustom = term.id.startsWith("pt-custom-");
  const isPreset = !isCustom;
  // Heuristic: any custom term whose name shares a duration with a stock
  // template is treated as template-derived for now. Once the data layer
  // tracks `clonedFromId` we'll switch to that.
  const isTemplateDerived = isCustom;

  const splitMilestones = parseSplitMilestones(term.description);
  const triggerLabel = term.trigger || "Shipping";

  // Local edit state — only used in custom mode. Starts seeded with the
  // term's current values so the user sees what they're editing.
  const [editName, setEditName] = useState(term.name);
  const [editDuration, setEditDuration] = useState(term.duration || "");
  const [editDiscountPct, setEditDiscountPct] = useState(term.discountPercent || "");
  const [editDiscountPeriod, setEditDiscountPeriod] = useState(term.discountPeriod || "");
  const [editDescription, setEditDescription] = useState(term.description);

  const [dirty, setDirty] = useState(false);
  const [versionPromptOpen, setVersionPromptOpen] = useState(false);
  const [versionAcknowledged, setVersionAcknowledged] = useState(false);

  // First edit on a template-derived term: surface the confirm. After the
  // user acknowledges once we let them keep editing freely.
  const guardEdit = () => {
    if (isPreset) return false;
    if (isTemplateDerived && !versionAcknowledged) {
      setVersionPromptOpen(true);
      return true;
    }
    setDirty(true);
    return false;
  };

  const onChangeName = (v: string) => { if (!guardEdit()) setEditName(v); };
  const onChangeDuration = (v: string) => { if (!guardEdit()) setEditDuration(v); };
  const onChangeDiscountPct = (v: string) => { if (!guardEdit()) setEditDiscountPct(v); };
  const onChangeDiscountPeriod = (v: string) => { if (!guardEdit()) setEditDiscountPeriod(v); };
  const onChangeDescription = (v: string) => { if (!guardEdit()) setEditDescription(v); };

  const acknowledgeVersion = () => {
    setVersionAcknowledged(true);
    setVersionPromptOpen(false);
    setDirty(true);
  };

  const handleSave = () => {
    toast.success(isTemplateDerived ? "New version saved." : "Changes saved.");
    setDirty(false);
    onStopEditing?.();
  };

  const handleDiscard = () => {
    setEditName(term.name);
    setEditDuration(term.duration || "");
    setEditDiscountPct(term.discountPercent || "");
    setEditDiscountPeriod(term.discountPeriod || "");
    setEditDescription(term.description);
    setDirty(false);
    onStopEditing?.();
  };

  // All fields start disabled. Custom terms can be unlocked via the Edit
  // button in the header, but we still wrap every field in a tooltip so
  // users understand why it's greyed out.
  const fieldsDisabled = isPreset || !isEditing;

  const LockedField = ({ children }: { children: React.ReactNode }) => {
    if (!fieldsDisabled) return <>{children}</>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center leading-relaxed text-xs">
          {isPreset
            ? <>This is a system template and can&rsquo;t be edited. Use <span className="font-semibold">Duplicate</span> to make a custom version.</>
            : <>Click <span className="font-semibold">Edit</span> in the header to modify this term.</>}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* Mode banner — explains read-only / version-on-edit upfront */}
        <div className={`rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5 ${isPreset ? "border-[#E8ECF1] bg-white" : isEditing ? "border-[#A8D2FF] bg-[#EBF3FF]" : "border-[#E8ECF1] bg-white"}`}>
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isPreset ? "bg-slate-50 border border-[#E8ECF1] text-slate-500" : isEditing ? "bg-white border border-[#A8D2FF] text-primary" : "bg-slate-50 border border-[#E8ECF1] text-slate-500"}`}>
            {isPreset ? <Lock className="w-3.5 h-3.5" /> : isEditing ? <Pencil className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
              {isPreset ? "System Template (Read-Only)" : isEditing ? "Editing Mode" : "Custom Term (Read-Only)"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {isPreset
                ? "This term ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                : isEditing
                  ? isTemplateDerived
                    ? "You're editing this term. Saving will create a new version so the original template stays intact."
                    : "You're editing this term. Save when you're done."
                  : "Click Edit in the header to modify this term's details."}
            </p>
          </div>
        </div>

        {/* ── Payment Term Type — tile selector mirroring the create modal.
              Always disabled here; the user picks type at create time. ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Type</span>
            <Tooltip>
              <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                <p className="text-slate-500">Type is fixed once a term is created. To change it, duplicate this term and pick a new type.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {CREATE_PT_TYPES.map((t) => {
              const isActive = term.category === t.id;
              const icon = t.id === "net" ? <Clock className="w-[18px] h-[18px]" /> : t.id === "prepayment" ? <Banknote className="w-[18px] h-[18px]" /> : <ArrowUpDown className="w-[18px] h-[18px]" />;
              const shortLabel = t.id === "net" ? "Net Terms" : t.id === "prepayment" ? "Prepayment" : "Split Payment";
              const shortDesc = t.id === "net" ? "Pay after X days" : t.id === "prepayment" ? "Pay before delivery" : "Multiple installments";
              const accentColor = t.id === "net" ? "rgb(var(--primary))" : t.id === "prepayment" ? "rgb(var(--violet))" : "rgb(var(--warning))";
              const accentBg = t.id === "net" ? "#EBF3FF" : t.id === "prepayment" ? "#F5F3FF" : "#FFFBEB";
              const accentBorder = t.id === "net" ? "#7AB8FF" : t.id === "prepayment" ? "#C4B5FD" : "#FCD34D";
              const activeBorderClass = t.id === "net" ? "border-[#7AB8FF]/70" : t.id === "prepayment" ? "border-[#C4B5FD]/70" : "border-[#FCD34D]/70";
              const circleActiveBg = t.id === "net" ? "#0A77FF" : t.id === "prepayment" ? "#8B5CF6" : "#F59E0B";
              const circleActiveShadow = t.id === "net" ? "rgba(59,130,246,0.15)" : t.id === "prepayment" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)";
              return (
                <div
                  key={t.id}
                  className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${
                    isActive
                      ? `${activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]`
                      : "border-border bg-white opacity-50"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${accentBg}80 0%, transparent 70%)` }} />
                  )}
                  <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${accentBg}, ${accentBorder}40)`, color: accentColor }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px]" style={{ fontWeight: 600, color: isActive ? accentColor : "#475569" }}>{shortLabel}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: isActive ? accentColor : "#94A3B8" }}>{shortDesc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? "" : "border-[1.5px] border-[#D1D5DB] bg-white"}`}
                      style={isActive ? { backgroundColor: circleActiveBg, boxShadow: `0 0 0 2px ${circleActiveShadow}` } : {}}
                    >
                      {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Payment Term Details — Term Name / Trigger / Duration / Description ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Details</span>
            <Tooltip>
              <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                <p className="text-slate-500">Name, duration, and trigger as they appear on POs and invoices.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                  {term.category === "net" ? "Net Term Name" : term.category === "prepayment" ? "Prepayment Term Name" : "Split Term Name"}
                </Label>
                <LockedField>
                  <Input
                    value={editName}
                    disabled={fieldsDisabled}
                    onChange={(e) => onChangeName(e.target.value)}
                    className="mt-1 !h-10 text-sm"
                  />
                </LockedField>
              </div>

              <div>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</Label>
                <Input value={triggerLabel} disabled className="mt-1 !h-10 text-sm" />
              </div>

              {term.category === "net" && (
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Net Duration (Days)</Label>
                  <LockedField>
                    <Input
                      value={editDuration}
                      type="number"
                      inputMode="numeric"
                      disabled={fieldsDisabled}
                      onChange={(e) => onChangeDuration(e.target.value)}
                      className="mt-1 !h-10 text-sm"
                    />
                  </LockedField>
                </div>
              )}

              <div className={term.category === "net" ? "" : "sm:col-span-2"}>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Description</Label>
                <LockedField>
                  <Input
                    value={editDescription}
                    disabled={fieldsDisabled}
                    onChange={(e) => onChangeDescription(e.target.value)}
                    placeholder="Brief summary of payment term purpose or context."
                    className="mt-1 !h-10 text-sm"
                  />
                </LockedField>
              </div>
            </div>
          </div>
        </div>

        {/* ── Split Milestones — only for split terms ── */}
        {term.category === "split" && splitMilestones.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Split Milestones</span>
            </div>
            <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {splitMilestones.map((m, i) => (
                <div key={i} className="rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">{m.label}</span>
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Early Payment Discount — shown for all NET terms ── */}
        {term.category === "net" && (() => {
          const hasDiscount = !!(term.applyDiscount || term.discountPercent);
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${hasDiscount ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`} style={{ fontWeight: 600 }}>
                  {hasDiscount ? "Enabled" : "Not Configured"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                    <p className="text-slate-500">Reward early payment with a percent discount applied within a defined window.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Discount</Label>
                  <LockedField>
                    <div className="relative mt-1">
                      <Input
                        value={editDiscountPct}
                        type="number"
                        inputMode="decimal"
                        disabled={fieldsDisabled}
                        onChange={(e) => onChangeDiscountPct(e.target.value)}
                        placeholder={hasDiscount ? "" : "—"}
                        className="!h-10 text-sm pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">%</span>
                    </div>
                  </LockedField>
                  <p className="text-[10px] text-slate-400 mt-1">Payment-term discounts are percent-only.</p>
                </div>
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                  <LockedField>
                    <div className="relative mt-1">
                      <Input
                        value={editDiscountPeriod}
                        type="number"
                        inputMode="numeric"
                        disabled={fieldsDisabled}
                        onChange={(e) => onChangeDiscountPeriod(e.target.value)}
                        placeholder={hasDiscount ? "" : "—"}
                        className="!h-10 text-sm pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">days</span>
                    </div>
                  </LockedField>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Metadata footer (moved from header) ── */}
        <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
          <span className="inline-flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-accent text-primary" style={{ fontWeight: 700 }}>OS</div>
            <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>Omnesoft</span></span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>Updated <span className="text-slate-700" style={{ fontWeight: 600 }}>Dec 15, 2025</span></span>
        </div>

        {/* Save bar — visible when editing a custom term */}
        {!isPreset && isEditing && (
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-[#E8ECF1] flex items-center justify-end gap-2">
            <button
              onClick={handleDiscard}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              style={{ fontWeight: 600 }}
            >
              <Check className="w-3.5 h-3.5" /> {isTemplateDerived ? "Save as New Version" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Version-confirm dialog — fires once on first edit of a template-derived term. */}
      <AlertDialog open={versionPromptOpen} onOpenChange={setVersionPromptOpen}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create a New Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This term was derived from a template. Editing it will save your changes as a new version so the original template stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setVersionPromptOpen(false)}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={acknowledgeVersion}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Continue Editing
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
