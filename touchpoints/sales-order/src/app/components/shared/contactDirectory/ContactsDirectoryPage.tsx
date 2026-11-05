// @ts-nocheck
/* ════════════════════════════════════════════════════════════════════════
   ContactsDirectoryPage — embedded-only port from Partner Management.
   The standalone-page chrome (breadcrumbs, hero header, KPI insights,
   CreatePocModal, QuickViewPanel, route-based navigation) has been
   removed; what remains is the toolbar (search + filters + density +
   columns drawer), quick-filter pills, the data table with sticky
   header + sticky checkbox column + sticky right-edge Actions, drag-
   to-reorder columns, sort, multi-value cell chips ("+N more"), and
   pagination. Selection is controlled via `selectable` + `selectedIds`
   + `onSelectionChange` so the parent modal can mirror the picked rows.

   Source of truth: Partner Management's
     src/app/pages/ContactsDirectoryPage.tsx
   Surgery applied:
     - Dropped `useVendors` — `vendors` and `partnerNameToId` are now
       empty fallbacks.
     - Dropped `useNavigate` — row clicks are no-ops by default (the
       parent owns navigation if any).
     - Dropped `<CreatePocModal>` — the parent passes a "Create New"
       trigger via `embeddedToolbarRight`.
     - Dropped `<QuickViewPanel>` and `usePersonLightbox` — quick view
       isn't used in modal contexts.
     - Dropped the KPI Performance Insights section (non-embedded only).
     - Dropped the Insights drawer (non-embedded only).
     - Dropped the Card density mode — modal POC picker is always a table.
   ════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useCallback, cloneElement, useRef } from "react";
import { createPortal } from "react-dom";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "./ColumnSelector";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { HighlightText } from "@/app/components/HighlightText";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "../../ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  List,
  AlignJustify,
  Check,
  ChevronDown,
  X,
  Mail,
  Phone,
  Building2,
  CircleCheck,
  CircleSlash,
  GripVertical,
  ShoppingCart,
  Receipt,
  ClipboardList,
  Star,
} from "lucide-react";
import { Checkbox } from "../../ui/checkbox";
import { CONTACT_DICTIONARY, type ContactPerson } from "./partnerConstants";
import { OverflowTooltip } from "./OverflowTooltip";
import { PrimaryPill } from "./PrimaryPill";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { ColumnHeaderMenu, type SortConfig as CMSortConfig } from "./ColumnHeaderMenu";
import { getAvatarTint } from "./avatarTints";
import {
  FilterModalShell,
  Pill as FilterModalPill,
  Section as FilterModalSection,
  Divider as FilterModalDivider,
  SearchableMultiSelect as FilterModalSearchable,
  DateRangeInputs as FilterModalDateRange,
} from "@/app/components/shared/filterModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../../ui/alert-dialog";

/* ─── Person Avatar Photos ─── */
const PERSON_AVATARS: Record<string, string> = {
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
  "Issac": "https://randomuser.me/api/portraits/men/52.jpg",
  "Elena": "https://randomuser.me/api/portraits/women/39.jpg",
  "Marcus": "https://randomuser.me/api/portraits/men/71.jpg",
};

function getPersonPhoto(name: string): string | undefined {
  const firstName = name.split(" ")[0];
  if (PERSON_AVATARS[firstName]) return PERSON_AVATARS[firstName];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const gender = absHash % 2 === 0 ? "men" : "women";
  const id = (absHash % 99) + 1;
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
}

/** ContactAvatar — row-height preserving sizes so condensed / comfort tables
 *  stay visually consistent. Image falls back to initials chip. */
function ContactAvatar({
  name,
  size = "md",
  circle = false,
  onClick,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  circle?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = getPersonPhoto(name);
  const tint = getAvatarTint(name);
  const initials = name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const sizeClass = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]";
  const showImg = photo && !imgFailed;
  const clickable = !!onClick;
  return (
    <div
      className={`${sizeClass} ${circle ? "rounded-full" : "rounded-lg"} flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] ${clickable ? "cursor-pointer" : ""}`}
      style={{ backgroundColor: showImg ? "transparent" : tint.bg }}
      onClick={(e) => {
        if (onClick) { e.stopPropagation(); onClick(e); }
      }}
    >
      {showImg ? (
        <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      ) : (
        <span className={`${textSize}`} style={{ fontWeight: 700, color: tint.fg }}>{initials}</span>
      )}
    </div>
  );
}

/* ─── Types ─── */
type QuickFilter = "all" | "sales" | "supply_chain" | "finance" | "active" | "inactive" | "archived";
type DensityOption = "condensed" | "comfort";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: string;
  direction: SortDirection;
}

/* ─── Enriched contact type ─── */
interface LinkedEntityRef {
  id: string;
  entityType: "Purchase Order" | "Sales Order" | "Quote";
  refNo: string;
  href: string;
}
interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive" | "archived";
  linkedPartners: string[];
  linkedEntities: LinkedEntityRef[];
  createdByName: string;
  createdByInitials: string;
  createdOn: string;
}

/* ─── Density config ─── */
const DENSITY_CONFIG: {
  key: DensityOption;
  label: string;
  description: string;
  icon: "align-justify" | "list";
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
];

/* ─── Quick filter config ─── */
const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean; tone?: "destructive" }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "sales", label: "Sales", showCount: true },
  { key: "supply_chain", label: "Supply Chain", showCount: true },
  { key: "finance", label: "Finance", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  /* Archived pill matches the other neutral quick-filters now — same
     border/text/count colors as Sales/Supply Chain/Finance. The
     earlier destructive-red treatment broke the rhythm of the row. */
  { key: "archived", label: "Archived", showCount: true },
];

/* ─── Column definitions ─── */
const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean })[] = [
  { key: "contact_name", label: "Contact", minWidth: "280px", sortable: true },
  { key: "role", label: "Title", minWidth: "240px", sortable: true },
  { key: "department", label: "Department", minWidth: "220px", sortable: true },
  { key: "company", label: "Company", minWidth: "260px", sortable: true },
  { key: "phones", label: "Phone", minWidth: "280px" },
  { key: "emails", label: "Email", minWidth: "300px" },
  { key: "socials", label: "Social", minWidth: "260px" },
  { key: "linked_partners", label: "Linked Partners", minWidth: "280px" },
  { key: "linked_entities", label: "Linked Entities", minWidth: "260px" },
  { key: "locations", label: "Locations", minWidth: "240px" },
  { key: "created_by", label: "Created By", minWidth: "240px" },
  { key: "created_on", label: "Created On", minWidth: "160px" },
  { key: "status", label: "Status", minWidth: "120px", sortable: true },
];

const DEFAULT_COLUMN_ORDER = [
  "contact_name",
  "role",
  "department",
  "company",
  "phones",
  "emails",
  "socials",
  "linked_partners",
  "linked_entities",
  "locations",
  "created_by",
  "created_on",
  "status",
];

const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, true])
);
const LOCKED_COLUMNS = ["contact_name"];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const CHECKBOX_COL_WIDTH = 40;
const MIN_COL_WIDTH = 1;

let PARTNER_NAMES = [
  "Acme Corp", "TechVault", "NexGen Solutions", "Apex Industries", "Summit Group",
  "Vertex Labs", "Pioneer Systems", "Atlas Logistics", "Beacon Analytics", "Cascade Networks",
  "Delta Manufacturing", "Echo Enterprises", "Falcon Dynamics", "Granite Holdings", "Horizon Partners",
  "Ionic Solutions", "Jade Innovations", "Keystone Global", "Lumen Corp", "Metro Supply",
];

const ENTITY_MODULE_URLS: Record<LinkedEntityRef["entityType"], string> = {
  "Purchase Order": "https://pleasant-flow.lovable.app/purchase-orders",
  "Sales Order":    "https://pleasant-flow.lovable.app/sales-orders",
  "Quote":          "https://pleasant-flow.lovable.app/quotes",
};
const ENTITY_TYPE_KEYS: LinkedEntityRef["entityType"][] = ["Purchase Order", "Sales Order", "Quote"];

const ENTITY_TYPE_META: Record<LinkedEntityRef["entityType"], { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string; border: string }> = {
  "Purchase Order": { icon: ShoppingCart,  color: "hsl(var(--primary))", bg: "hsl(var(--accent))", border: "#BFDBFE" },
  "Sales Order":    { icon: Receipt,       color: "hsl(var(--success))", bg: "#ECFDF5", border: "#A7F3D0" },
  "Quote":          { icon: ClipboardList, color: "hsl(var(--violet))", bg: "#F5F3FF", border: "#DDD6FE" },
};

function enrichContacts(contacts: ContactPerson[], partnerNames: string[]): EnrichedContact[] {
  const pNames = partnerNames.length > 0 ? partnerNames : PARTNER_NAMES;
  return contacts.map((c) => {
    let hash = 0;
    for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
    const absHash = Math.abs(hash);

    const status: "active" | "inactive" = absHash % 5 === 0 ? "inactive" : "active";

    const partnerCount = 1 + (absHash % 5);
    const linkedPartners: string[] = [];
    for (let p = 0; p < partnerCount; p++) {
      linkedPartners.push(pNames[(absHash + p * 7) % pNames.length]);
    }

    const entityCount = absHash % 7;
    const linkedEntities: LinkedEntityRef[] = [];
    for (let e = 0; e < entityCount; e++) {
      const type = ENTITY_TYPE_KEYS[(absHash + e * 3) % 3];
      const prefix = type === "Purchase Order" ? "PO" : type === "Sales Order" ? "SO" : "QT";
      const num = 1000 + ((absHash + e * 17) % 9000);
      linkedEntities.push({
        id: `${c.id}-ent-${e}`,
        entityType: type,
        refNo: `${prefix}-${num}`,
        href: ENTITY_MODULE_URLS[type],
      });
    }

    const CREATORS = ["Ahtisham Ahmad", "Sarah Johnson", "David Kim", "Emily Chen", "Marcus Obi", "Elena Volkov"];
    const createdByName = CREATORS[absHash % CREATORS.length];
    const createdByInitials = createdByName.split(" ").map(w => w[0]).join("").toUpperCase();

    const month = (absHash % 12) + 1;
    const day = (absHash % 28) + 1;
    const year = absHash % 3 === 0 ? 2025 : 2026;
    const createdOn = new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return { ...c, status, linkedPartners, linkedEntities, createdByName, createdByInitials, createdOn };
  });
}

/* ─── Status pill styles ─── */
const STATUS_STYLES = {
  active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};

function colDef(key: string) {
  return COLUMN_DEFS.find((c) => c.key === key) || COLUMN_DEFS[0];
}

export interface ContactsDirectoryPageProps {
  embedded?: boolean;
  embeddedContacts?: ContactPerson[];
  embeddedToolbarRight?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  defaultVisibleColumns?: string[];
  compactToolbar?: boolean;
  primaryContactId?: string;
  primaryContactTooltip?: string;
  onSetPrimaryContact?: (contactId: string, contactName: string) => void;
  /** Customer the picker is currently scoped to. Surfaces in the Set-as-
   *  Primary confirmation copy so the user sees which record the change
   *  applies to before committing. */
  customerName?: string;
  contactLocationsMap?: Record<string, string[]>;
  flush?: boolean;
  defaultDensity?: "condensed" | "comfort";
  /** Row click handler. Defaults to no-op when embedded. */
  onRowClick?: (contact: ContactPerson) => void;
  /** When true, any contact in `selectedIds` is always present in
   *  the filtered/sorted result (added back if a filter excluded it)
   *  and sorted to the top so the user can find their picks at a
   *  glance. Used by the POC selection modal where previously-
   *  selected contacts must always be visible. */
  pinSelectedTop?: boolean;
  /** Extra scope pills rendered before the standard quick-filter
   *  pill row (with a vertical divider separator). Used by the POC
   *  modal to surface "This customer's contacts" / "This location
   *  only" toggles without modifying the directory's hard-coded
   *  department/status filters. Each pill is independent (clicking
   *  toggles its `active` flag through `onChange`). Filtering logic
   *  lives in `match` — the directory excludes any contact for
   *  which an active scope returns `false`. Selected contacts are
   *  still pinned visible via `pinSelectedTop`. */
  scopePills?: Array<{
    key: string;
    label: string;
    active: boolean;
    onChange: (active: boolean) => void;
    match: (contact: ContactPerson) => boolean;
    /** Optional icon glyph rendered before the label. Use a lucide
     *  component reference (e.g. `Building2`, `MapPin`). */
    icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    /** Optional accent tint applied to the active state. Falls back
     *  to the system primary blue. */
    accent?: 'purple' | 'green';
    /** Optional plain-language explanation surfaced as a hover card
     *  (Partner v7 white tooltip). When set, hovering the pill opens
     *  a `<HoverCard>` with a short title + description. */
    tooltip?: { title: string; description: string };
  }>;
  /** Segmented toggle rendered in the toolbar's Row 1, just right of
   *  the Filters button. Mirrors the Partner Management Items tab
   *  "Browse Inventory / Added Items" control. Used by the POC modal
   *  to flip between the customer's already-added contacts and the
   *  full directory. */
  viewToggle?: {
    options: Array<{
      key: string;
      label: string;
      icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
      activeTone?: 'primary' | 'success';
      count: number;
      match: (contact: ContactPerson) => boolean;
    }>;
    activeKey: string;
    onChange: (key: string) => void;
  };
  /** Inline notice rendered between the filter pills row and the
   *  table. Used by the POC modal to surface the active scope ("you
   *  are viewing this customer's contacts") so the picker explains
   *  itself without a separate pre-modal banner. */
  scopeNotice?: React.ReactNode;
  /** When true, the density dropdown and column selector in Row 1 are
   *  hidden. Used by the POC modal where the toolbar would otherwise
   *  feel crowded. The count + Create New stay; only the per-user
   *  view tweaks go away. */
  hideViewControls?: boolean;
}

export function ContactsDirectoryPage({
  embedded = true,
  embeddedContacts,
  embeddedToolbarRight,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  defaultVisibleColumns,
  compactToolbar = false,
  primaryContactId,
  primaryContactTooltip,
  onSetPrimaryContact,
  customerName,
  contactLocationsMap,
  flush = false,
  defaultDensity,
  onRowClick,
  pinSelectedTop = false,
  scopePills,
  viewToggle,
  scopeNotice,
  hideViewControls = false,
}: ContactsDirectoryPageProps = {}) {
  // No vendor context in target modules — fall back to constant partner list.
  const vendorNames = useMemo(() => PARTNER_NAMES, []);
  const partnerNameToId: Record<string, string> = useMemo(() => ({}), []);

  /* ─── Data ─── */
  const sourceContacts = embeddedContacts ?? CONTACT_DICTIONARY;
  const allContacts = useMemo(() => enrichContacts(sourceContacts, vendorNames), [sourceContacts, vendorNames]);

  /* ─── State ─── */
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [density, setDensity] = useState<DensityOption>(defaultDensity || "condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
      const allowed = new Set(defaultVisibleColumns);
      return Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, allowed.has(c.key)]));
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(new Set());
  const selectedRows = selectable && controlledSelectedIds ? controlledSelectedIds : internalSelectedRows;
  const setSelectedRows = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (selectable && onSelectionChange) {
      const next = typeof updater === "function" ? updater(controlledSelectedIds ?? new Set()) : updater;
      onSelectionChange(next);
    } else {
      setInternalSelectedRows(updater as React.SetStateAction<Set<string>>);
    }
  }, [selectable, onSelectionChange, controlledSelectedIds]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: "contact_name", direction: "asc" });

  /* Holds the contact pending the Set-as-Primary confirmation. The
     Set-as-Primary triggers (row-hover pill + row dropdown item) open
     this gate instead of mutating the primary directly so the user
     can review who they are about to promote and back out cleanly. */
  const [pendingPrimary, setPendingPrimary] = useState<{ id: string; name: string } | null>(null);
  const requestSetPrimary = useCallback((id: string, name: string) => {
    setPendingPrimary({ id, name });
  }, []);
  const confirmSetPrimary = useCallback(() => {
    if (pendingPrimary && onSetPrimaryContact) {
      onSetPrimaryContact(pendingPrimary.id, pendingPrimary.name);
    }
    setPendingPrimary(null);
  }, [pendingPrimary, onSetPrimaryContact]);

  /* Advanced filters — staged through the shared `FilterModalShell`
     so this directory's filter UI matches the listing FiltersModal
     in chrome and behaviour. */
  type ContactAdvancedFilters = {
    departments: string[];
    statuses: ("active" | "inactive" | "archived")[];
    companies: string[];
    titles: string[];
    creators: string[];
    createdFrom: string;
    createdTo: string;
  };
  const EMPTY_CONTACT_FILTERS: ContactAdvancedFilters = {
    departments: [],
    statuses: [],
    companies: [],
    titles: [],
    creators: [],
    createdFrom: "",
    createdTo: "",
  };
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [contactFilters, setContactFilters] = useState<ContactAdvancedFilters>(EMPTY_CONTACT_FILTERS);
  const countContactFilters = (f: ContactAdvancedFilters) =>
    f.departments.length + f.statuses.length + f.companies.length + f.titles.length +
    f.creators.length + (f.createdFrom || f.createdTo ? 1 : 0);
  const contactMatchesAdvanced = (c: EnrichedContact, f: ContactAdvancedFilters): boolean => {
    if (f.departments.length > 0 && !f.departments.includes(c.department)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(c.status)) return false;
    if (f.companies.length > 0 && !f.companies.includes(c.company)) return false;
    if (f.titles.length > 0 && c.role && !f.titles.includes(c.role)) return false;
    if (f.titles.length > 0 && !c.role) return false;
    if (f.creators.length > 0 && !f.creators.includes(c.createdByName)) return false;
    if (f.createdFrom && c.createdOn && c.createdOn < f.createdFrom) return false;
    if (f.createdTo && c.createdOn && c.createdOn > f.createdTo) return false;
    return true;
  };

  /* ─── Frozen columns ─── */
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["contact_name"]));

  /* ─── Pin-selected-top snapshot ───
     Frozen until search / filter / sort / scope changes so that
     toggling a checkbox doesn't reorder the visible rows. The memo
     below mutates these refs imperatively. */
  const pinSnapshotRef = useRef<Set<string>>(new Set());
  const pinSnapshotFilterKeyRef = useRef<string>("");

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

  /* ─── Column resize refs ─── */
  const resizeRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  /* ─── Visible columns ─── */
  const visibleColumns = useMemo(
    () => columnOrder.filter((key) => columnVisibility[key]),
    [columnOrder, columnVisibility]
  );

  /* ─── Filtering ─── */
  const filteredContacts = useMemo(() => {
    let result = allContacts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q)
      );
    }

    if (quickFilter !== "archived") {
      result = result.filter((c) => c.status !== "archived");
    }

    /* Apply each active scope pill. Selected contacts are added
       back later via pinSelectedTop so they survive even when the
       filter would normally exclude them. */
    if (scopePills && scopePills.length > 0) {
      for (const pill of scopePills) {
        if (pill.active) {
          result = result.filter((c) => pill.match(c));
        }
      }
    }
    /* Segmented view toggle filter runs alongside scope pills. */
    if (viewToggle) {
      const activeOption = viewToggle.options.find((opt) => opt.key === viewToggle.activeKey);
      if (activeOption) {
        result = result.filter((c) => activeOption.match(c));
      }
    }
    switch (quickFilter) {
      case "sales":
        result = result.filter((c) => c.department === "Sales");
        break;
      case "supply_chain":
        result = result.filter((c) => c.department === "Supply Chain Management");
        break;
      case "finance":
        result = result.filter((c) => c.department === "Finance");
        break;
      case "active":
        result = result.filter((c) => c.status === "active");
        break;
      case "inactive":
        result = result.filter((c) => c.status === "inactive");
        break;
      case "archived":
        result = result.filter((c) => c.status === "archived");
        break;
    }

    /* Advanced filter set committed from the modal. */
    if (countContactFilters(contactFilters) > 0) {
      result = result.filter((c) => contactMatchesAdvanced(c, contactFilters));
    }

    if (sortConfig) {
      const { key, direction } = sortConfig;
      const dir = direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (key === "created_on") {
          return (new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()) * dir;
        }
        let aVal = "";
        let bVal = "";
        switch (key) {
          case "contact_name": aVal = a.name; bVal = b.name; break;
          case "role": aVal = a.role || ""; bVal = b.role || ""; break;
          case "department": aVal = a.department; bVal = b.department; break;
          case "company": aVal = a.company; bVal = b.company; break;
          case "created_by": aVal = a.createdByName; bVal = b.createdByName; break;
          case "status": aVal = a.status; bVal = b.status; break;
          default: return 0;
        }
        return aVal.localeCompare(bVal) * dir;
      });
    }

    /* Safety net for the POC modal: previously-selected contacts
       must remain visible regardless of the active filter / sort.
       Re-add any selected contacts the filter excluded and sort
       them to the top of the result so the user lands on their
       existing picks immediately.

       The snapshot is intentionally frozen across selection toggles
       and only refreshes when search / filter / sort / scope change.
       That keeps rows static while the user is picking — toggling a
       checkbox would otherwise re-sort the table and "shuffle" the
       row positions, which is disorienting on a multi-page picker. */
    const filterKey = JSON.stringify({
      searchQuery,
      quickFilter,
      sortConfig,
      scope: scopePills?.map((p) => [p.key, p.active]) ?? [],
      view: viewToggle?.activeKey ?? null,
    });
    if (pinSelectedTop && controlledSelectedIds && controlledSelectedIds.size > 0) {
      if (pinSnapshotFilterKeyRef.current !== filterKey) {
        pinSnapshotFilterKeyRef.current = filterKey;
        pinSnapshotRef.current = new Set(controlledSelectedIds);
      }
      const snapshot = pinSnapshotRef.current;
      if (snapshot.size > 0) {
        const seen = new Set(result.map((c) => c.id));
        const missingSelected = allContacts.filter((c) => snapshot.has(c.id) && !seen.has(c.id));
        result = [...missingSelected, ...result];
        result.sort((a, b) => {
          const aSel = snapshot.has(a.id) ? 0 : 1;
          const bSel = snapshot.has(b.id) ? 0 : 1;
          return aSel - bSel;
        });
      }
    }

    return result;
    /* `controlledSelectedIds` intentionally excluded from deps — see
       comment above. Selection toggles must not re-run this memo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContacts, searchQuery, quickFilter, sortConfig, pinSelectedTop, scopePills, viewToggle, controlledSelectedIds]);

  const filterCounts = useMemo(() => {
    const base = searchQuery.trim()
      ? allContacts.filter((c) => {
          const q = searchQuery.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.department.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q)
          );
        })
      : allContacts;

    const nonArchived = base.filter((c) => c.status !== "archived");
    return {
      all: nonArchived.length,
      sales: nonArchived.filter((c) => c.department === "Sales").length,
      supply_chain: nonArchived.filter((c) => c.department === "Supply Chain Management").length,
      finance: nonArchived.filter((c) => c.department === "Finance").length,
      active: nonArchived.filter((c) => c.status === "active").length,
      inactive: nonArchived.filter((c) => c.status === "inactive").length,
      archived: base.filter((c) => c.status === "archived").length,
    };
  }, [allContacts, searchQuery]);

  /* ─── Pagination ─── */
  const effectiveRecordsPerPage = recordsPerPage === -1
    ? Math.max(1, filteredContacts.length)
    : recordsPerPage;
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / effectiveRecordsPerPage));
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * effectiveRecordsPerPage;
    return filteredContacts.slice(start, start + effectiveRecordsPerPage);
  }, [filteredContacts, currentPage, effectiveRecordsPerPage]);

  const getPageNumbers = useCallback((): (number | "...")[] => {
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
  }, [totalPages, currentPage]);

  /* ─── Selection ─── */
  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedRows]);

  const allPageSelected = paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedRows.has(c.id));
  const somePageSelected = paginatedContacts.some((c) => selectedRows.has(c.id));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedContacts.forEach((c) => next.delete(c.id));
      } else {
        paginatedContacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }, [allPageSelected, paginatedContacts, setSelectedRows]);

  /* ─── Sort ─── */
  const handleSort = useCallback((key: string, direction?: "asc" | "desc" | null) => {
    if (direction === undefined) {
      setSortConfig((prev) => {
        if (!prev || prev.key !== key) return { key, direction: "asc" };
        if (prev.direction === "asc") return { key, direction: "desc" };
        return null;
      });
    } else if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
    setCurrentPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    setFrozenColumns((prev) => {
      if (!prev.has(columnKey)) return prev;
      const next = new Set(prev);
      next.delete(columnKey);
      return next;
    });
  }, []);

  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== "contact_name") {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }, []);

  /* ─── Header drag-reorder (custom mouse-event) ─── */
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
  }, [columnWidths]);

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
  }, [visibleColumns, frozenColumns, columnWidths]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ─── Render helpers ─── */
  const isRelaxed = density === "comfort";

  const handleRowSelect = (contact: EnrichedContact) => {
    if (selectable) {
      handleSelectRow(contact.id);
    } else if (onRowClick) {
      onRowClick(contact);
    }
  };

  const renderCell = (contact: EnrichedContact, colKey: string) => {
    switch (colKey) {
      case "contact_name": {
        return (
          <TableCell key={colKey}>
            {/* No inner HoverCard here — the row-level HoverCard below
                covers every cell, so hovering anywhere on the row fires
                the preview. Keeping this cell HoverCard-free avoids
                nested triggers that would flicker over the avatar. */}
            <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
              <ContactAvatar
                name={contact.name}
                size={isRelaxed ? "lg" : "md"}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate text-slate-800`}
                    style={{ fontWeight: 500 }}
                  ><HighlightText text={contact.name} searchTerm={searchQuery} /></span>
                  {primaryContactId === contact.id ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
                          <PrimaryPill size="xs" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11px] z-[300]">
                        {primaryContactTooltip || "Primary point of contact"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    onSetPrimaryContact && (
                      /* Row-hover Set-as-Primary pill — reveals on row
                         hover via the unnamed `group` class on the
                         parent TableRow. */
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); requestSetPrimary(contact.id, contact.name); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-white text-[10.5px] text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-accent transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        <Star className="w-2.5 h-2.5" /> Set as Primary
                      </button>
                    )
                  )}
                </div>
                {isRelaxed && contact.email && (
                  <span className="text-xs text-muted-foreground/60 truncate block"><HighlightText text={contact.email} searchTerm={searchQuery} /></span>
                )}
              </div>
            </div>
          </TableCell>
        );
      }

      case "department": {
        const depts = contact.departments || [contact.department];
        const shortDept = (d: string) => d === "Supply Chain Management" ? "Supply Chain" : d;
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
              <span
                className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-md border`}
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
              >
                {shortDept(depts[0])}
              </span>
              {depts.length > 1 && (
                <OverflowTooltip
                  category="Departments"
                  items={depts.slice(1).map((d, i) => ({
                    id: `${contact.id}-dept-${i}`,
                    name: d === "Supply Chain Management" ? "Supply Chain" : d,
                    subtitle: "",
                  }))}
                >
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>+{depts.length - 1}</span>
                </OverflowTooltip>
              )}
            </div>
          </TableCell>
        );
      }

      case "role":
        return (
          <TableCell key={colKey}>
            <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground`}>{contact.role ? <HighlightText text={contact.role} searchTerm={searchQuery} /> : "—"}</span>
          </TableCell>
        );

      case "company": {
        const comps = contact.companies || [contact.company];
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block`}><HighlightText text={comps[0]} searchTerm={searchQuery} /></span>
              {comps.length > 1 && (
                <OverflowTooltip
                  category="Companies"
                  items={comps.slice(1).map((co, i) => ({
                    id: `${contact.id}-comp-${i}`,
                    name: co,
                    subtitle: "",
                  }))}
                >
                  <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{comps.length - 1} more</span>
                </OverflowTooltip>
              )}
            </div>
          </TableCell>
        );
      }

      case "phones": {
        const phoneList = contact.phones && contact.phones.length > 0
          ? contact.phones
          : [{ id: `${contact.id}-ph-fb`, type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }];
        const firstPhone = phoneList[0];
        const phoneExtra = phoneList.length - 1;
        /* `number` upstream may or may not already include the country
           code (some seed paths prefix "+1 ", others just give the
           NPA). Detect a leading "+" and skip the code field so we
           never render "+1 +1 (NPA) …". */
        const numberHasCode = typeof firstPhone.number === 'string' && firstPhone.number.trim().startsWith('+');
        const formattedPhone = `${numberHasCode ? '' : `${firstPhone.code} `}${firstPhone.number}${firstPhone.ext ? ` ext. ${firstPhone.ext}` : ''}`;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} tabular-nums truncate`} style={{ fontWeight: 500 }}>
                  <HighlightText text={formattedPhone} searchTerm={searchQuery} />
                </span>
                {phoneExtra > 0 && (
                  <OverflowTooltip
                    category="Phone Numbers"
                    items={phoneList.slice(1).map((ph) => {
                      const hasCode = typeof ph.number === 'string' && ph.number.trim().startsWith('+');
                      return {
                        id: ph.id,
                        name: `${hasCode ? '' : `${ph.code} `}${ph.number}${ph.ext ? ` ext. ${ph.ext}` : ''}`,
                        subtitle: ph.type,
                      };
                    })}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{phoneExtra} more</span>
                  </OverflowTooltip>
                )}
              </div>
              {isRelaxed && <span className="text-[10px] text-muted-foreground/60 block">{firstPhone.type}</span>}
            </div>
          </TableCell>
        );
      }

      case "emails": {
        const emailList = contact.emails && contact.emails.length > 0
          ? contact.emails
          : [{ id: `${contact.id}-em-fb`, type: "Work" as const, address: contact.email }];
        const firstEmail = emailList[0];
        const emailExtra = emailList.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}><HighlightText text={firstEmail.address} searchTerm={searchQuery} /></span>
                {emailExtra > 0 && (
                  <OverflowTooltip
                    category="Email Addresses"
                    items={emailList.slice(1).map((em) => ({
                      id: em.id,
                      name: em.address,
                      subtitle: em.type,
                    }))}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{emailExtra} more</span>
                  </OverflowTooltip>
                )}
              </div>
              {isRelaxed && <span className="text-[10px] text-muted-foreground/60 block">{firstEmail.type}</span>}
            </div>
          </TableCell>
        );
      }

      case "socials": {
        const socialList = contact.socials || [];
        if (socialList.length === 0) {
          return <TableCell key={colKey}><span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"—"}</span></TableCell>;
        }
        const firstSocial = socialList[0];
        const socialExtra = socialList.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`} style={{ fontWeight: 500 }}>{firstSocial.url}</span>
                {socialExtra > 0 && (
                  <OverflowTooltip
                    category="Social Profiles"
                    items={socialList.slice(1).map((s) => ({
                      id: s.id,
                      name: s.url,
                      subtitle: s.type,
                    }))}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{socialExtra} more</span>
                  </OverflowTooltip>
                )}
              </div>
              {isRelaxed && <span className="text-[10px] text-muted-foreground/60 block">{firstSocial.type}</span>}
            </div>
          </TableCell>
        );
      }

      case "linked_partners": {
        const partners = contact.linkedPartners;
        const first = partners[0];
        const extra = partners.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}
                  style={{ fontWeight: 500 }}
                >
                  {first}
                </span>
                {extra > 0 && (
                  <OverflowTooltip
                    category="Linked Partners"
                    items={partners.slice(1).map((p, i) => ({
                      id: `${contact.id}-lp-${i}`,
                      name: p,
                      subtitle: "",
                    }))}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra} more</span>
                  </OverflowTooltip>
                )}
              </div>
              {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{partners.length} partner{partners.length !== 1 ? "s" : ""}</span>}
            </div>
          </TableCell>
        );
      }

      case "linked_entities": {
        const ents = contact.linkedEntities;
        if (ents.length === 0) {
          return (
            <TableCell key={colKey}>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"—"}</span>
            </TableCell>
          );
        }
        const first = ents[0];
        const extra = ents.length - 1;
        const uniqueTypes: LinkedEntityRef["entityType"][] = [];
        for (const e of ents) {
          if (!uniqueTypes.includes(e.entityType)) uniqueTypes.push(e.entityType);
        }
        const codeFor = (t: LinkedEntityRef["entityType"]) =>
          t === "Purchase Order" ? "PO" : t === "Sales Order" ? "SO" : "QT";
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {uniqueTypes.map((t) => {
                  const m = ENTITY_TYPE_META[t];
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center justify-center rounded px-1 h-4 text-[9.5px] shrink-0 tracking-wide"
                      style={{ fontWeight: 700, backgroundColor: m.bg, color: m.color }}
                      title={t}
                    >
                      {codeFor(t)}
                    </span>
                  );
                })}
                <span
                  className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate tabular-nums`}
                  style={{ fontWeight: 500 }}
                >
                  {first.refNo}
                </span>
                {extra > 0 && (
                  <OverflowTooltip
                    category="Linked Entities"
                    items={ents.slice(1).map((e) => {
                      const m = ENTITY_TYPE_META[e.entityType];
                      return {
                        id: e.id,
                        name: e.refNo,
                        subtitle: e.entityType,
                        initials: codeFor(e.entityType),
                        avatarBg: m.bg,
                        avatarFg: m.color,
                      };
                    })}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra} more</span>
                  </OverflowTooltip>
                )}
              </div>
            </div>
          </TableCell>
        );
      }

      case "locations": {
        const locs = contactLocationsMap?.[contact.id] || [];
        if (locs.length === 0) {
          return (
            <TableCell key={colKey}>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"—"}</span>
            </TableCell>
          );
        }
        const first = locs[0];
        const extra = locs.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}
                  style={{ fontWeight: 500 }}
                >
                  {first}
                </span>
                {extra > 0 && (
                  <OverflowTooltip
                    category="Locations"
                    items={locs.slice(1).map((name, i) => ({ id: `${contact.id}-loc-${i}`, name, subtitle: "" }))}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra} more</span>
                  </OverflowTooltip>
                )}
              </div>
              {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block">{locs.length} location{locs.length !== 1 ? "s" : ""}</span>}
            </div>
          </TableCell>
        );
      }

      case "created_by": {
        const cbTint = getAvatarTint(contact.createdByName);
        const cbPhoto = getPersonPhoto(contact.createdByName);
        const cbHash = contact.createdByName.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
        const cbDepts = ["Procurement", "Supply Chain", "Finance", "Operations", "Sales", "Logistics", "Engineering", "Quality Assurance"];
        const cbRoles = ["Manager", "Director", "Lead", "Specialist", "Coordinator", "Analyst", "Supervisor", "Associate"];
        const cbDept = cbDepts[cbHash % cbDepts.length];
        const cbRole = `${cbDept} ${cbRoles[(cbHash * 7) % cbRoles.length]}`;
        const cbFirst = contact.createdByName.split(" ")[0]?.toLowerCase() || "user";
        const cbLast = contact.createdByName.split(" ")[1]?.toLowerCase() || "name";
        const cbEmail = `${cbFirst}.${cbLast}@company.com`;
        const cbPhone = `(${300 + (cbHash % 700)}) ${100 + (cbHash % 900)}-${1000 + (cbHash % 9000)}`;
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"}`}>
              <HoverCard openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <div className="cursor-pointer">
                    <ContactAvatar
                      name={contact.createdByName}
                      size={isRelaxed ? "lg" : "md"}
                      circle
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12700]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                    <div className="flex items-center gap-3 relative">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: cbPhoto ? "transparent" : cbTint.bg }}>
                        {cbPhoto ? <img src={cbPhoto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{contact.createdByInitials}</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{contact.createdByName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{cbRole}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{cbEmail}</span></div>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cbDept}</span></div>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cbPhone}</span></div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <div className="min-w-0">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{contact.createdByName}</span>
                {isRelaxed && <span className="text-[10px] text-muted-foreground/50 block truncate">{cbRole}</span>}
              </div>
            </div>
          </TableCell>
        );
      }

      case "created_on":
        return (
          <TableCell key={colKey}>
            <div>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"}`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{contact.createdOn}</span>
            </div>
          </TableCell>
        );

      case "status": {
        const sStyle = STATUS_STYLES[contact.status];
        return (
          <TableCell key={colKey}>
            <span
              className={`inline-flex items-center ${isRelaxed ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"} rounded-full border`}
              style={{ fontWeight: 500, backgroundColor: sStyle.bg, color: sStyle.text, borderColor: sStyle.border }}
            >
              {contact.status === "active" ? "Active" : "Inactive"}
            </span>
          </TableCell>
        );
      }

      default:
        return <TableCell key={colKey}>{"–"}</TableCell>;
    }
  };

  return (
    <div className={flush ? "flex flex-col flex-1 min-h-0 bg-transparent" : "flex flex-col bg-transparent"}>
      {/* Intermediate wrappers cascade `flex-1 min-h-0` when flush so the
          table's overflow-auto container actually fills the modal body.
          Without it, the inner scroller shrink-wraps to content and the
          horizontal scrollbar floats at the bottom of the table itself
          (mid-modal) instead of at the bottom of the modal body. */}
      <div className={flush ? "flex flex-col flex-1 min-h-0" : "flex flex-col"}>
        <div className={flush ? "flex flex-col flex-1 min-h-0" : "flex flex-col"}>
          {/* Data Table Container */}
          <div className={`bg-card flex ${flush ? "border-0 rounded-none flex-1 min-h-0 overflow-clip" : "border border-border rounded-xl"}`}>
            <div className={`flex-1 min-w-0 flex flex-col ${flush ? "min-h-0" : ""}`}>
              {/* Row 1: Search + Filters | Count + Density + Column Selector */}
              <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      placeholder="Search by name, email, department..."
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
                  {!compactToolbar && (() => {
                    const appliedAdvCount = countContactFilters(contactFilters);
                    return (
                      <button
                        type="button"
                        onClick={() => setShowFilterModal(true)}
                        className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                          appliedAdvCount > 0 ? "text-primary border-primary/30" : "text-foreground border-border/80"
                        }`}
                      >
                        <SlidersHorizontal className={`w-3.5 h-3.5 ${appliedAdvCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                        {appliedAdvCount > 0 && (
                          <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                            style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}>{appliedAdvCount}</span>
                        )}
                      </button>
                    );
                  })()}
                  {/* Segmented Browse / Added toggle — Partner pattern. */}
                  {viewToggle && (
                    <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                      {viewToggle.options.map((opt) => {
                        const isActive = opt.key === viewToggle.activeKey;
                        const tone = opt.activeTone ?? 'primary';
                        const Icon = opt.icon;
                        const iconColor = isActive
                          ? (tone === 'success' ? 'var(--success)' : 'hsl(var(--primary))')
                          : '#94A3B8';
                        const countBg = isActive
                          ? (tone === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'var(--accent)')
                          : 'var(--border)';
                        const countColor = isActive
                          ? (tone === 'success' ? 'var(--success)' : 'hsl(var(--primary))')
                          : '#64748B';
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => viewToggle.onChange(opt.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                              isActive
                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                            style={{ fontWeight: isActive ? 600 : 500 }}
                          >
                            {Icon && <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />}
                            {opt.label}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center"
                              style={{ fontWeight: 600, backgroundColor: countBg, color: countColor }}
                            >
                              {opt.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!compactToolbar && (
                  <>
                  <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                    {filteredContacts.length !== allContacts.length ? (
                      <>
                        <span className="text-foreground">{filteredContacts.length}</span>
                        <span className="text-muted-foreground/60"> of </span>
                        <span className="text-muted-foreground">{allContacts.length}</span>
                        <span className="text-muted-foreground/70"> contacts</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground">{allContacts.length}</span>
                        <span className="text-muted-foreground/70"> contacts</span>
                      </>
                    )}
                  </span>

                  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
                  </>
                  )}

                  {!hideViewControls && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                          {density === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
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
                            onSelect={() => setDensity(opt.key)}
                          >
                            {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                            {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                            {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {!compactToolbar && !hideViewControls && (
                    <ColumnSelectorTrigger
                      visibleCount={visibleColumns.length}
                      active={columnDrawerOpen}
                      onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                    />
                  )}

                  {embeddedToolbarRight}
                </div>
              </div>

              {/* Row 2: Quick Filter Pills — scope pills (if any)
                  appear first, then a vertical separator, then the
                  standard department/status pills. */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                {scopePills && scopePills.length > 0 && (
                  <>
                    {scopePills.map((pill) => {
                      const isActive = pill.active;
                      /* Accent palette for the active state. The
                         pill's color carries the semantic of WHAT it
                         filters by (customer = violet, location =
                         green), independent of the directory's
                         primary blue. Inactive pills stay on the
                         neutral muted tone shared with the rest of
                         the chrome so the row reads as one family. */
                      const accent = pill.accent;
                      const accentStyle: React.CSSProperties =
                        accent === 'purple'
                          ? { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', color: '#5B21B6' }
                          : accent === 'green'
                            ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }
                            : {};
                      const Icon = pill.icon;
                      const button = (
                        <button
                          key={`scope-${pill.key}`}
                          type="button"
                          onClick={() => { pill.onChange(!isActive); setCurrentPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive && !accent
                              ? 'border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]'
                              : !isActive
                                ? 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'
                                : ''
                          }`}
                          style={{
                            fontWeight: isActive ? 500 : 400,
                            ...(isActive ? (accent ? accentStyle : { color: 'hsl(var(--primary))' }) : {}),
                          }}
                        >
                          {Icon && <Icon className="w-3.5 h-3.5" style={isActive && accent ? { color: accentStyle.color as string } : undefined} />}
                          {pill.label}
                        </button>
                      );
                      if (!pill.tooltip) return button;
                      /* Wrap in a Partner-style white HoverCard so
                         the user can hover the pill to learn what it
                         filters before clicking. */
                      return (
                        <HoverCard key={`scope-${pill.key}`} openDelay={200} closeDelay={80}>
                          <HoverCardTrigger asChild>{button}</HoverCardTrigger>
                          {/* Explicit z-index — the directory is
                              embedded inside the RecipientsSelectionModal
                              which sits at z-index 12100+. HoverCard's
                              default `z-50` puts the portal under the
                              modal, so the card was opening but
                              rendering invisible behind the backdrop. */}
                          <HoverCardContent
                            side="bottom"
                            align="start"
                            sideOffset={8}
                            style={{ zIndex: 12500 }}
                            className="w-[260px] p-3 rounded-lg border border-border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
                          >
                            <div className="text-[12.5px]" style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>
                              {pill.tooltip.title}
                            </div>
                            <div className="text-[11.5px]" style={{ color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                              {pill.tooltip.description}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                    <div className="shrink-0" style={{ width: 1, height: 20, backgroundColor: '#E5E7EB', margin: '0 4px' }} />
                  </>
                )}
                {QUICK_FILTER_OPTIONS.map((filter) => {
                  const isActive = quickFilter === filter.key;
                  const count = (filterCounts as any)[filter.key];
                  const isDestructive = filter.tone === "destructive";
                  const baseClass = isActive
                    ? (isDestructive
                        ? "border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200"
                        : "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]")
                    : (isDestructive
                        ? "border-red-200 text-destructive hover:bg-red-50 hover:border-red-300 active:bg-red-100"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted");
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setQuickFilter(filter.key);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${baseClass}`}
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive
                          ? (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--primary))")
                          : (isDestructive ? "hsl(var(--destructive))" : undefined),
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
                              ? (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--primary))")
                              : (isDestructive ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"),
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border shrink-0" />

              {/* Optional scope notice rendered between filter pills and table. */}
              {scopeNotice && (
                <div className="shrink-0">{scopeNotice}</div>
              )}

              {/* ─── Table View ─── */}
              <div className={`${flush ? "min-h-0 overflow-auto flex-1" : "overflow-x-auto"} ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                <Table style={{ tableLayout: "fixed", width: `max(${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px, 100%)` }}>
                  <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                      density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                    }`}>
                      <TableHead className="sticky left-0 z-20 bg-slate-50 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      {visibleColumns.map((key) => {
                        const def = colDef(key);
                        const isFrozen = frozenColumns.has(key);
                        const isLocked = LOCKED_COLUMNS.includes(key);
                        const isDraggable = !isLocked;
                        const currentColSort: "asc" | "desc" | null =
                          sortConfig?.key === key ? sortConfig.direction : null;
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
                            className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${isDraggable ? "cursor-grab" : ""}`}
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
                              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                            )}
                            {isDraggable && (
                              <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                            )}

                            <div className="flex items-center">
                              <ColumnHeaderMenu
                                columnKey={key}
                                label={def.label}
                                sortable={def.sortable}
                                sortConfig={sortConfig as CMSortConfig | null}
                                onSort={handleSort}
                                onAddFilter={() => {}}
                                onHideColumn={handleHideColumn}
                                onFreezeColumn={handleFreezeColumn}
                                isFrozen={isFrozen}
                                isLocked={isLocked}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[13px]" style={currentColSort ? { color: "hsl(var(--primary))" } : undefined}>{def.label}</span>
                                  {currentColSort === "asc" && (
                                    <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                  )}
                                  {currentColSort === "desc" && (
                                    <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                  )}
                                  {!currentColSort && def.sortable && (
                                    <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              </ColumnHeaderMenu>
                            </div>

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
                      <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                        <span className="text-[13px]">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  {/* Restore the bottom stroke on the last row — shadcn's
                      TableBody primitive strips it via
                      `[&_tr:last-child]:border-0`, which leaves the
                      table visually open at the bottom. The directory
                      reads cleaner as a closed grid. */}
                  <TableBody className="[&_tr:last-child]:border-b">
                    {paginatedContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="w-8 h-8" />
                            <p className="text-sm">No contacts found</p>
                            {(searchQuery || quickFilter !== "all") && (
                              <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setQuickFilter("all"); setCurrentPage(1); }}>
                                Clear all filters
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedContacts.map((contact) => {
                        /* Per-contact preview material — captured once
                           per row so the row-level HoverCardContent
                           below renders consistently regardless of
                           which cell the user lands on. */
                        const cPhoto = getPersonPhoto(contact.name);
                        const cTint = getAvatarTint(contact.name);
                        const cDeptLabel = contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department;
                        /* Partner Management's Select Point of Contact picker
                         * (Vendors-8 `ContactsDirectoryPage.tsx:3117-3206`)
                         * tints already-selected rows in `#F8FAFF` (slate-50
                         * with a faint blue cast) so the user can scan the
                         * picker and immediately see which contacts are
                         * already on the record. We mirror that here so the
                         * Quote / SO PoC pickers read identically.
                         *
                         * Sticky cells (left checkbox, frozen columns, right
                         * actions) must carry the same opaque tint as the
                         * row, otherwise a transparent tint stacks over the
                         * row bg and the sticky columns read as a different
                         * shade. */
                        const isRowSelected = selectedRows.has(contact.id);
                        return (
                          <HoverCard key={contact.id} openDelay={150} closeDelay={80}>
                            <HoverCardTrigger asChild>
                          <TableRow
                            onClick={() => handleRowSelect(contact)}
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
                            }`}
                          >
                            <TableCell className={`sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 ${
                              isRowSelected
                                ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                : "bg-card group-hover:bg-[#F0F7FF]"
                            }`}>
                              <Checkbox
                                checked={isRowSelected}
                                onCheckedChange={() => handleSelectRow(contact.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${contact.name}`}
                              />
                            </TableCell>
                            {visibleColumns.map((key) => {
                              const cell = renderCell(contact, key);
                              const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                              const isDraggedCol = draggingColumnKey === key;
                              const cellWidthStyle: React.CSSProperties = {
                                width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                                ...(isDraggedCol ? {
                                  backgroundColor: "rgba(10,119,255,0.035)",
                                } : {}),
                              };
                              if (frozenColumns.has(key)) {
                                const frozenBg = isRowSelected
                                  ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                  : "bg-card group-hover:bg-[#F0F7FF]";
                                return cloneElement(cell as React.ReactElement<any>, {
                                  className: `${(cell as any).props.className || ""} sticky z-10 ${frozenBg}`.trim(),
                                  style: {
                                    ...(cell as any).props.style,
                                    ...cellWidthStyle,
                                    left: `${frozenOffsets[key] ?? 0}px`,
                                    ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                  },
                                });
                              }
                              return cloneElement(cell as React.ReactElement<any>, {
                                className: `${(cell as any).props.className || ""}`.trim(),
                                style: { ...(cell as any).props.style, ...cellWidthStyle },
                              });
                            })}
                            <TableCell className={`sticky right-0 z-10 !pl-2 !pr-2 ${
                              isRowSelected
                                ? "bg-[#F8FAFF] group-hover:bg-[#F0F7FF]"
                                : "bg-card group-hover:bg-[#F0F7FF]"
                            }`} style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
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
                                  <DropdownMenuItem onClick={() => onRowClick?.(contact)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {onSetPrimaryContact && (
                                    <DropdownMenuItem
                                      className={primaryContactId === contact.id ? "focus:bg-blue-50/40 opacity-70 cursor-default" : "focus:bg-blue-50"}
                                      style={{ color: "#1D4ED8" }}
                                      disabled={primaryContactId === contact.id}
                                      onClick={() => { if (primaryContactId !== contact.id) requestSetPrimary(contact.id, contact.name); }}
                                    >
                                      <Star className="w-4 h-4 mr-2 fill-blue-700 text-blue-700" />
                                      {primaryContactId === contact.id ? "Primary (current)" : "Set as Primary"}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                            </HoverCardTrigger>
                            {/* Row-level contact preview — fires on hover
                                anywhere in the row. Portal'd above the
                                recipients modal (z-12101) and column-drag
                                overlay (z-12500) via z-[12700]. */}
                            <HoverCardContent
                              side="bottom"
                              align="start"
                              className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12700]"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                <div className="flex items-center gap-3 relative">
                                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: cPhoto ? "transparent" : cTint.bg }}>
                                    {cPhoto ? <img src={cPhoto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{contact.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase()}</div>}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{contact.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{contact.role || cDeptLabel}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-white px-4 py-3 space-y-2">
                                {contact.email && <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{contact.email}</span></div>}
                                <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{cDeptLabel}</span></div>
                                {contact.phone && <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{contact.phone}</span></div>}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {filteredContacts.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per page</span>
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
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <span className="text-[13px]" style={{ color: "hsl(var(--primary))", fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Advanced filters modal — uses the shared FilterModalShell so
          this surface reads as the same component as the listing
          SOFilterBar. Fields mirror the table's columns: department,
          status, company, title, created-by, created-on range. */}
      <FilterModalShell<ContactAdvancedFilters>
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        applied={contactFilters}
        empty={EMPTY_CONTACT_FILTERS}
        onApply={(next) => setContactFilters(next)}
        countActive={countContactFilters}
        getDraftMatchCount={(draft) => allContacts.filter((c) => contactMatchesAdvanced(c, draft)).length}
        itemLabel="contact"
        itemLabelPlural="contacts"
      >
        {({ draft, update, toggleMulti }) => {
          const departments = Array.from(new Set(allContacts.map((c) => c.department))).sort();
          const companies = Array.from(new Set(allContacts.map((c) => c.company))).sort();
          const titles = Array.from(new Set(allContacts.map((c) => c.role).filter(Boolean) as string[])).sort();
          const creators = Array.from(new Set(allContacts.map((c) => c.createdByName).filter(Boolean))).sort();
          return (
            <>
              <FilterModalSection title="Department" subtitle="Filter contacts by their department.">
                <div className="flex flex-wrap gap-1.5">
                  <FilterModalPill
                    label="Any"
                    selected={draft.departments.length === 0}
                    onClick={() => update("departments", [])}
                  />
                  {departments.map((d) => (
                    <FilterModalPill
                      key={d}
                      label={d}
                      selected={draft.departments.includes(d)}
                      onClick={() => toggleMulti("departments", d)}
                      count={allContacts.filter((c) => c.department === d).length}
                    />
                  ))}
                </div>
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Status" subtitle="Filter contacts by lifecycle status.">
                <div className="flex flex-wrap gap-1.5">
                  <FilterModalPill
                    label="Any"
                    selected={draft.statuses.length === 0}
                    onClick={() => update("statuses", [])}
                  />
                  {(["active", "inactive", "archived"] as const).map((s) => (
                    <FilterModalPill
                      key={s}
                      label={s.charAt(0).toUpperCase() + s.slice(1)}
                      selected={draft.statuses.includes(s)}
                      onClick={() => toggleMulti("statuses", s)}
                      count={allContacts.filter((c) => c.status === s).length}
                    />
                  ))}
                </div>
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Company">
                <FilterModalSearchable
                  options={companies.map((c) => ({ value: c, label: c }))}
                  selected={draft.companies}
                  onToggle={(v) => toggleMulti("companies", v)}
                  getCount={(val) => allContacts.filter((c) => c.company === val).length}
                  placeholder="Search companies…"
                />
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Title">
                <FilterModalSearchable
                  options={titles.map((t) => ({ value: t, label: t }))}
                  selected={draft.titles}
                  onToggle={(v) => toggleMulti("titles", v)}
                  getCount={(val) => allContacts.filter((c) => c.role === val).length}
                  placeholder="Search titles…"
                />
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Created by">
                <FilterModalSearchable
                  options={creators.map((c) => ({ value: c, label: c }))}
                  selected={draft.creators}
                  onToggle={(v) => toggleMulti("creators", v)}
                  getCount={(val) => allContacts.filter((c) => c.createdByName === val).length}
                  placeholder="Search people…"
                />
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Created on" subtitle="Filter by contact creation date.">
                <FilterModalDateRange
                  from={draft.createdFrom}
                  to={draft.createdTo}
                  onFromChange={(v) => update("createdFrom", v)}
                  onToChange={(v) => update("createdTo", v)}
                />
              </FilterModalSection>
            </>
          );
        }}
      </FilterModalShell>

      {/* Set-as-Primary confirmation — canonical Partner Management
          lifecycle modal pattern (Vendors-8 `VendorDetailsPage.tsx:
          11429-11468`). Reused verbatim so this picker speaks the same
          chrome the rest of the suite ships with. */}
      <AlertDialog open={!!pendingPrimary} onOpenChange={(o) => { if (!o) setPendingPrimary(null); }}>
        <AlertDialogContent
          overlayClassName="z-[12500]"
          className="z-[12501] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#3B82F6" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
              <Star className="w-8 h-8 fill-blue-700 text-blue-700" />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Change Primary
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>
              Set {pendingPrimary?.name} as primary?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
              {pendingPrimary?.name} becomes the main point of contact{customerName ? ` for ${customerName}` : ""}. The current primary stays in the contact list but loses its primary status.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={confirmSetPrimary}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#3B82F6", color: "#fff" }}
              >
                Set as Primary
              </button>
              <button
                onClick={() => setPendingPrimary(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}
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
