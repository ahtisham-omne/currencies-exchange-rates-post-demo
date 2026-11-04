import React, { useState, useMemo, useCallback, cloneElement, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "../components/vendors/ColumnSelector";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "../components/ui/hover-card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
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
  X,
  Mail,
  Phone,
  Building2,
  CircleCheck,
  CircleSlash,
  AlertTriangle,
  PhoneCall,
  UserPlus,
  UserCheck,
  Briefcase,
  Truck,
  DollarSign,
  Link2,
  ChevronUp,
  ChartColumn,
  Calendar,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Globe,
  Trash2,
  ShoppingCart,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogHeader,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Checkbox } from "../components/ui/checkbox";
import { CONTACT_DICTIONARY, type ContactPerson, type ContactPhone, type ContactEmail, type ContactSocial } from "../components/vendors/partnerConstants";
import { CreatePocModal } from "../components/vendors/PocModals";
import { OverflowTooltip } from "../components/vendors/OverflowTooltip";
import { QuickViewPanel, type QuickViewData } from "../components/vendors/QuickViewPanel";
import { useVendors } from "../context/VendorContext";
import { ColumnHeaderMenu, type SortConfig as CMSortConfig } from "../components/vendors/ColumnHeaderMenu";
import { getAvatarTint } from "../utils/avatarTints";
import { usePersonLightbox } from "../components/vendors/PersonAvatarLightbox";

/* ─── Name → Contact ID resolver ─── */
const _contactByName: Record<string, string> = {};
CONTACT_DICTIONARY.forEach((c) => { if (!_contactByName[c.name]) _contactByName[c.name] = c.id; });
function resolveContactId(name: string): string {
  if (!name) return CONTACT_DICTIONARY[0].id;
  if (_contactByName[name]) return _contactByName[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CONTACT_DICTIONARY[Math.abs(h) % CONTACT_DICTIONARY.length].id;
}

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
  "Abdullah": "https://randomuser.me/api/portraits/men/29.jpg",
  "Issac": "https://randomuser.me/api/portraits/men/52.jpg",
  "Elena": "https://randomuser.me/api/portraits/women/39.jpg",
  "Marcus": "https://randomuser.me/api/portraits/men/71.jpg",
  "Priya": "https://randomuser.me/api/portraits/women/63.jpg",
  "Omar": "https://randomuser.me/api/portraits/men/43.jpg",
  "Mei": "https://randomuser.me/api/portraits/women/25.jpg",
  "Carlos": "https://randomuser.me/api/portraits/men/59.jpg",
  "Fatima": "https://randomuser.me/api/portraits/women/81.jpg",
  "Raj": "https://randomuser.me/api/portraits/men/88.jpg",
  "Anna": "https://randomuser.me/api/portraits/women/12.jpg",
  "Viktor": "https://randomuser.me/api/portraits/men/37.jpg",
  "Yuki": "https://randomuser.me/api/portraits/women/50.jpg",
  "Ahmed": "https://randomuser.me/api/portraits/men/94.jpg",
};

function getPersonPhoto(name: string): string | undefined {
  const firstName = name.split(" ")[0];
  if (PERSON_AVATARS[firstName]) return PERSON_AVATARS[firstName];
  // Deterministic fallback: use hash to pick from randomuser.me pool
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const gender = absHash % 2 === 0 ? "men" : "women";
  const id = (absHash % 99) + 1;
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
}

/* ─── DnD type for Contact Directory KPI reorder ─── */
const DND_CONTACT_DIRECTORY_KPI = "CONTACT_DIRECTORY_KPI";

/** Hover-revealed drag handle + remove button KPI card.
 *  Mirrors the pattern used by the Partners listing (DraggableListKpiCard). */
function DraggableContactDirectoryKpiCard({
  index,
  kpiKey,
  label,
  value,
  Icon,
  moveCard,
  onRemove,
}: {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  Icon: ContactKpi["icon"];
  moveCard: (from: number, to: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_CONTACT_DIRECTORY_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_CONTACT_DIRECTORY_KPI,
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
      data-kpi-key={kpiKey}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2">
        {/* Drag handle — top-right pill, hover-revealed */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
      </div>
      {/* Remove button — bottom-right, hover-revealed */}
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

/** ContactAvatar — row-height preserving sizes so condensed/comfort tables stay
 *  visually consistent with the rest of the system (Partners, Items, POs).
 *  Card view uses a hero image banner instead of this component.
 */
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
  const { openLightbox } = usePersonLightbox();
  const photo = getPersonPhoto(name);
  const tint = getAvatarTint(name);
  const initials = name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const sizeClass = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textSize = size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]";
  const showImg = photo && !imgFailed;
  const clickable = showImg || !!onClick;
  return (
    <div
      className={`${sizeClass} ${circle ? "rounded-full" : "rounded-lg"} flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1] ${clickable ? "cursor-pointer" : ""}`}
      style={{ backgroundColor: showImg ? "transparent" : tint.bg }}
      onClick={(e) => {
        if (onClick) { e.stopPropagation(); onClick(e); return; }
        if (showImg) { e.stopPropagation(); openLightbox({ src: photo!, name }); }
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

/* ─── Contact Insights Panel — matches KpiInsightsPanel exactly ─── */
interface ContactKpi {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  tooltip: string;
}

function ContactInsightsPanel({ open, onOpenChange, allKpis, activeKeys, onToggle }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allKpis: ContactKpi[];
  activeKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); });
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  const filtered = searchQuery.trim()
    ? allKpis.filter((k) => k.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : allKpis;

  const allActive = allKpis.every((k) => activeKeys.has(k.key));
  const noneActive = activeKeys.size === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: visible ? "auto" : "none" }}
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
                <ChartColumn className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Add Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Customize your dashboard with relevant metrics.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKeys.size} of {allKpis.length} insights active
            </span>
            <button
              onClick={() => {
                if (allActive) {
                  allKpis.forEach((k) => { if (activeKeys.has(k.key)) onToggle(k.key); });
                } else {
                  allKpis.forEach((k) => { if (!activeKeys.has(k.key)) onToggle(k.key); });
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] shadow-sm shadow-primary/10"
                  : noneActive
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? (
                <><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>
              ) : noneActive ? (
                <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
              ) : (
                <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
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

        {/* Scrollable Content — 2-column card grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>Contact Metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filtered.map((kpi) => {
                  const Icon = kpi.icon;
                  const isActive = activeKeys.has(kpi.key);
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
                      {/* Top row: label + toggle icon */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11.5px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`}
                          style={{ fontWeight: 500 }}
                          title={kpi.label}
                        >
                          {kpi.label}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          )}
                        </div>
                      </div>
                      {/* Value */}
                      <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>
                        {kpi.value}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Types ─── */
type QuickFilter = "all" | "sales" | "supply_chain" | "finance" | "active" | "inactive";
type DensityOption = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: string;
  direction: SortDirection;
}

/* ─── Enriched contact type ─── */
interface LinkedEntityRef {
  id: string;
  /** e.g. "Purchase Order", "Sales Order", "Quote" — renders alongside ref in the
   *  popover; drives the deep-link URL. */
  entityType: "Purchase Order" | "Sales Order" | "Quote";
  refNo: string;
  /** Target URL (opens in a new tab) — same module URLs used in the Linked
   *  Entities tab on the detail page. */
  href: string;
}
interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive";
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
  icon: "align-justify" | "list" | "layout-grid";
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

/* ─── Quick filter config ─── */
const QUICK_FILTER_OPTIONS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "sales", label: "Sales", showCount: true },
  { key: "supply_chain", label: "Supply Chain", showCount: true },
  { key: "finance", label: "Finance", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
];

/* ─── Column definitions ─── */
const COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean })[] = [
  { key: "contact_name", label: "Contact", minWidth: "280px", sortable: true },
  { key: "role", label: "Role / Title", minWidth: "240px", sortable: true },
  { key: "department", label: "Department", minWidth: "220px", sortable: true },
  { key: "company", label: "Company", minWidth: "260px", sortable: true },
  { key: "phones", label: "Phone", minWidth: "280px" },
  { key: "emails", label: "Email", minWidth: "300px" },
  { key: "socials", label: "Social", minWidth: "260px" },
  { key: "linked_partners", label: "Linked Partners", minWidth: "280px" },
  { key: "linked_entities", label: "Linked Entities", minWidth: "260px" },
  { key: "created_by", label: "Created By", minWidth: "240px" },
  { key: "created_on", label: "Created On", minWidth: "160px" },
  { key: "status", label: "Status", minWidth: "120px", sortable: true },
];

/* ─── Default order: contact-first, then company/phone/email/links, then metadata ─── */
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
  "created_by",
  "created_on",
  "status",
];
/** All columns visible by default — contact directory is metadata-rich and users
 *  have explicitly asked to see created_by/created_on/linked_entities out of the
 *  box. Hide via the column selector if noisy for a given workspace. */
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, true])
);
const LOCKED_COLUMNS = ["contact_name"];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const CHECKBOX_COL_WIDTH = 40;
const MIN_COL_WIDTH = 1;

/* ─── Partner name pool for linked partners ─── */
// Will be populated from vendor context at runtime
let PARTNER_NAMES = [
  "Acme Corp", "TechVault", "NexGen Solutions", "Apex Industries", "Summit Group",
  "Vertex Labs", "Pioneer Systems", "Atlas Logistics", "Beacon Analytics", "Cascade Networks",
  "Delta Manufacturing", "Echo Enterprises", "Falcon Dynamics", "Granite Holdings", "Horizon Partners",
  "Ionic Solutions", "Jade Innovations", "Keystone Global", "Lumen Corp", "Metro Supply",
];

/* ─── Deep-link URLs per entity type — same targets used by the detail page's
 *  "Linked Entities" tab, so click-through behavior is identical in both places. */
const ENTITY_MODULE_URLS: Record<LinkedEntityRef["entityType"], string> = {
  "Purchase Order": "https://pleasant-flow.lovable.app/purchase-orders",
  "Sales Order":    "https://pleasant-flow.lovable.app/sales-orders",
  "Quote":          "https://pleasant-flow.lovable.app/quotes",
};
const ENTITY_TYPE_KEYS: LinkedEntityRef["entityType"][] = ["Purchase Order", "Sales Order", "Quote"];

/* ─── Entity type styling — mirrors ContactDetailPage.ENTITY_TYPE_META so the
 *  Linked Entities column reads identically in both places. */
const ENTITY_TYPE_META: Record<LinkedEntityRef["entityType"], { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string; border: string }> = {
  "Purchase Order": { icon: ShoppingCart,  color: "hsl(var(--primary))", bg: "hsl(var(--accent))", border: "#BFDBFE" },
  "Sales Order":    { icon: Receipt,       color: "hsl(var(--success))", bg: "#ECFDF5", border: "#A7F3D0" },
  "Quote":          { icon: ClipboardList, color: "hsl(var(--violet))", bg: "#F5F3FF", border: "#DDD6FE" },
};

/* ─── Deterministic enrichment of contacts ─── */
function enrichContacts(contacts: ContactPerson[], partnerNames: string[]): EnrichedContact[] {
  const pNames = partnerNames.length > 0 ? partnerNames : PARTNER_NAMES;
  return contacts.map((c) => {
    // Deterministic hash from id
    let hash = 0;
    for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
    const absHash = Math.abs(hash);

    // 80% active, 20% inactive
    const status: "active" | "inactive" = absHash % 5 === 0 ? "inactive" : "active";

    // 1-5 linked partners, deterministic
    const partnerCount = 1 + (absHash % 5);
    const linkedPartners: string[] = [];
    for (let p = 0; p < partnerCount; p++) {
      linkedPartners.push(pNames[(absHash + p * 7) % pNames.length]);
    }

    // 0-6 linked entities (POs, SOs, Quotes) — mirrors the detail page's data
    // shape so this column's popover rows match the Linked Entities tab.
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

    // Created by — deterministic
    const CREATORS = ["Ahtisham Ahmad", "Sarah Johnson", "David Kim", "Emily Chen", "Marcus Obi", "Elena Volkov"];
    const createdByName = CREATORS[absHash % CREATORS.length];
    const createdByInitials = createdByName.split(" ").map(w => w[0]).join("").toUpperCase();

    // Created on — deterministic date in 2025-2026
    const month = (absHash % 12) + 1;
    const day = (absHash % 28) + 1;
    const year = absHash % 3 === 0 ? 2025 : 2026;
    const createdOn = new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return { ...c, status, linkedPartners, linkedEntities, createdByName, createdByInitials, createdOn };
  });
}

/* ─── Department pill styles ─── */
const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Sales: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Finance: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

/* ─── Status pill styles ─── */
const STATUS_STYLES = {
  active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};

/* ─── Helper: get initials from name ─── */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ─── Helper: column def lookup ─── */
function colDef(key: string) {
  return COLUMN_DEFS.find((c) => c.key === key) || COLUMN_DEFS[0];
}

export interface ContactsDirectoryPageProps {
  /** When true, hides the top breadcrumb bar, page header and KPI insights panel. Used when embedding the directory inside another surface (POC tab, modal, etc). */
  embedded?: boolean;
  /** Optional contact subset to render instead of the full CONTACT_DICTIONARY. */
  embeddedContacts?: ContactPerson[];
  /** Optional toolbar slot rendered to the right of the density/column controls (e.g. "+ Create New Contact"). Embedded only. */
  embeddedToolbarRight?: React.ReactNode;
  /** When true, the table's checkbox column becomes the primary selection mechanism and selection state is controlled via `selectedIds` / `onSelectionChange`. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function ContactsDirectoryPage({
  embedded = false,
  embeddedContacts,
  embeddedToolbarRight,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
}: ContactsDirectoryPageProps = {}) {
  const navigate = useNavigate();
  const { vendors } = useVendors();

  // Map partner display names to vendor IDs for navigation
  const partnerNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => { map[v.displayName] = v.id; map[v.companyName] = v.id; });
    return map;
  }, [vendors]);

  // Use real vendor names for linked partners
  const vendorNames = useMemo(() => vendors.length > 0 ? vendors.map((v) => v.displayName) : PARTNER_NAMES, [vendors]);

  /* ─── Data ─── */
  const sourceContacts = embeddedContacts ?? CONTACT_DICTIONARY;
  const allContacts = useMemo(() => enrichContacts(sourceContacts, vendorNames), [sourceContacts, vendorNames]);

  /* ─── State ─── */
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  /** Factory default: Condensed table view — per stakeholder feedback this is the
   *  primary workflow surface. Card view remains one click away via the density menu. */
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);
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
  /** Default sort: alphabetical by name (A→Z) — the ship-default experience. */
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: "contact_name", direction: "asc" });
  const [showInsights, setShowInsights] = useState(true);
  const [insightsDateRange, setInsightsDateRange] = useState("last_30");
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [activeKpiKeys, setActiveKpiKeys] = useState<Set<string>>(new Set(["total", "active", "sales", "supply_chain", "finance", "avg_partners"]));
  /** Display order of KPI cards — drives drag-drop reorder. New keys append at the end. */
  const [kpiOrder, setKpiOrder] = useState<string[]>(["total", "active", "sales", "supply_chain", "finance", "avg_partners"]);
  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setKpiOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /* ─── Frozen columns ─── */
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["contact_name"]));

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

  /* ─── Create / Edit Contact Modal State ─── */
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [newPocName, setNewPocName] = useState("");
  const [newPocDepartment, setNewPocDepartment] = useState("");
  const [newPocRole, setNewPocRole] = useState("");
  const [newPocLandline, setNewPocLandline] = useState("");
  const [newPocLandlineCode, setNewPocLandlineCode] = useState("+1");
  const [newPocExt, setNewPocExt] = useState("");
  const [newPocMobile, setNewPocMobile] = useState("");
  const [newPocMobileCode, setNewPocMobileCode] = useState("+1");
  const [newPocEmail, setNewPocEmail] = useState("");
  const [saveAndCreateAnother, setSaveAndCreateAnother] = useState(false);
  const [archiveContactId, setArchiveContactId] = useState<string | null>(null);
  const [deactivateContactId, setDeactivateContactId] = useState<string | null>(null);

  /* ─── Rich QuickView replaces the old photo lightbox — avatar/image clicks
   *  now open the full QuickView modal; name clicks navigate to the detail page. */

  /* ─── Rich QuickView for the "Created By" column — mirrors the Partners
   *  listing so the interaction is identical across tables. Click the creator's
   *  name → slide-in card with their photo, stats, contact details, and a
   *  "Go to Contact" deep link. */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  const resetCreateForm = () => {
    setNewPocName(""); setNewPocDepartment(""); setNewPocRole("");
    setNewPocLandline(""); setNewPocLandlineCode("+1"); setNewPocExt("");
    setNewPocMobile(""); setNewPocMobileCode("+1"); setNewPocEmail("");
  };

  const handleSaveContact = () => {
    if (!newPocName.trim()) { toast.error("Please enter a contact name"); return; }
    if (editMode) {
      toast.success(`Contact "${newPocName}" updated successfully`);
      setCreateModalOpen(false);
      setEditMode(false);
      setEditContactId(null);
      resetCreateForm();
    } else {
      toast.success(`Contact "${newPocName}" created successfully`);
      if (saveAndCreateAnother) {
        resetCreateForm();
      } else {
        setCreateModalOpen(false);
        resetCreateForm();
      }
    }
  };

  const handleEditContact = (contact: typeof allContacts[0]) => {
    setEditMode(true);
    setEditContactId(contact.id);
    setNewPocName(contact.name);
    setNewPocDepartment(contact.department);
    setNewPocRole(contact.role || "");
    setNewPocEmail(contact.emails && contact.emails.length > 0 ? contact.emails[0].address : contact.email);
    const phoneList = contact.phones && contact.phones.length > 0 ? contact.phones : [{ id: "fb", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }];
    setNewPocLandline(phoneList[0].number);
    setNewPocLandlineCode(phoneList[0].code || "+1");
    setNewPocExt(phoneList[0].ext || "");
    if (phoneList.length > 1) {
      setNewPocMobile(phoneList[1].number);
      setNewPocMobileCode(phoneList[1].code || "+1");
    } else {
      setNewPocMobile(contact.secondaryPhone || "");
      setNewPocMobileCode("+1");
    }
    setCreateModalOpen(true);
  };

  /* ─── Visible columns ─── */
  const visibleColumns = useMemo(
    () => columnOrder.filter((key) => columnVisibility[key]),
    [columnOrder, columnVisibility]
  );

  /* ─── Filtering ─── */
  const filteredContacts = useMemo(() => {
    let result = allContacts;

    // Search
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

    // Quick filter
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
    }

    // Sort
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

    return result;
  }, [allContacts, searchQuery, quickFilter, sortConfig]);

  /* ─── Filter counts ─── */
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

    return {
      all: base.length,
      sales: base.filter((c) => c.department === "Sales").length,
      supply_chain: base.filter((c) => c.department === "Supply Chain Management").length,
      finance: base.filter((c) => c.department === "Finance").length,
      active: base.filter((c) => c.status === "active").length,
      inactive: base.filter((c) => c.status === "inactive").length,
    };
  }, [allContacts, searchQuery]);

  /* ─── KPI Insights ─── */
  const allKpiData = useMemo(() => {
    const total = allContacts.length;
    const active = allContacts.filter((c) => c.status === "active").length;
    const inactive = allContacts.filter((c) => c.status === "inactive").length;
    const sales = allContacts.filter((c) => c.department === "Sales").length;
    const supplyChain = allContacts.filter((c) => c.department === "Supply Chain Management").length;
    const finance = allContacts.filter((c) => c.department === "Finance").length;
    const avgPartners = total > 0 ? (allContacts.reduce((sum, c) => sum + c.linkedPartners.length, 0) / total).toFixed(1) : "0";
    const totalPartners = allContacts.reduce((sum, c) => sum + c.linkedPartners.length, 0);
    return [
      { key: "total", label: "Total Contacts", value: String(total), icon: Users, color: "hsl(var(--primary))", bg: "hsl(var(--accent))", tooltip: "Total number of contacts in the directory" },
      { key: "active", label: "Active Contacts", value: String(active), icon: UserCheck, color: "hsl(var(--success))", bg: "#ECFDF5", tooltip: "Contacts currently marked as active" },
      { key: "inactive", label: "Inactive Contacts", value: String(inactive), icon: CircleSlash, color: "hsl(var(--warning))", bg: "#FFFBEB", tooltip: "Contacts currently marked as inactive" },
      { key: "sales", label: "Sales Department", value: String(sales), icon: Briefcase, color: "hsl(var(--violet))", bg: "#F5F3FF", tooltip: "Contacts in the Sales department" },
      { key: "supply_chain", label: "Supply Chain", value: String(supplyChain), icon: Truck, color: "hsl(var(--warning))", bg: "#FFFBEB", tooltip: "Contacts in Supply Chain Management" },
      { key: "finance", label: "Finance Department", value: String(finance), icon: DollarSign, color: "#0891B2", bg: "#ECFEFF", tooltip: "Contacts in the Finance department" },
      { key: "avg_partners", label: "Avg. Partners/Contact", value: avgPartners, icon: Link2, color: "hsl(var(--destructive))", bg: "#FEF2F2", tooltip: "Average number of linked partners per contact" },
      { key: "total_partners", label: "Total Partner Links", value: String(totalPartners), icon: Users, color: "hsl(var(--primary))", bg: "hsl(var(--accent))", tooltip: "Sum of all partner links across contacts" },
    ];
  }, [allContacts]);

  /** kpiData honors the user's drag-drop order, with any newly-toggled-on keys appended. */
  const kpiData = useMemo(() => {
    const lookup = new Map(allKpiData.map((k) => [k.key, k] as const));
    const ordered = kpiOrder.filter((k) => activeKpiKeys.has(k)).map((k) => lookup.get(k));
    return ordered.filter(Boolean) as typeof allKpiData;
  }, [allKpiData, activeKpiKeys, kpiOrder]);

  const handleToggleKpi = useCallback((key: string) => {
    setActiveKpiKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setKpiOrder((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / recordsPerPage));
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredContacts.slice(start, start + recordsPerPage);
  }, [filteredContacts, currentPage, recordsPerPage]);

  /* ─── Page numbers ─── */
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
  }, []);

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
  }, [allPageSelected, paginatedContacts]);

  /* ─── Sort (ColumnHeaderMenu compatible signature) ─── */
  const handleSort = useCallback((key: string, direction?: "asc" | "desc" | null) => {
    if (direction === undefined) {
      // Legacy toggle behaviour (cycle asc → desc → clear)
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

  /* ─── Hide column handler ─── */
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

  /* ─── Freeze column handler ─── */
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

  /* ─── Custom drag: mousedown on header starts tracking (live-reorder) ─── */
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

  /** Cumulative left pixel offsets for frozen columns */
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

  /** Last frozen column key -- gets a subtle right shadow for visual separation */
  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ─── Render helpers ─── */
  const isRelaxed = density === "comfort";

  const renderCell = (contact: EnrichedContact, colKey: string) => {
    switch (colKey) {
      case "contact_name": {
        const cPhoto = getPersonPhoto(contact.name);
        const cTint = getAvatarTint(contact.name);
        const cDeptLabel = contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department;
        const cCompany = (contact.companies && contact.companies[0]) || contact.company;
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}>
              <HoverCard>
                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <div className="cursor-pointer">
                    <ContactAvatar
                      name={contact.name}
                      size={isRelaxed ? "lg" : "md"}
                      onClick={() => {
                        setQuickViewData({
                          type: "contact",
                          item: {
                            id: contact.id,
                            name: contact.name,
                            subtitle: contact.role || cDeptLabel,
                            imageUrl: cPhoto,
                            initials: contact.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase(),
                            avatarBg: cTint.bg,
                            avatarFg: cTint.fg,
                            meta: { role: contact.role, dept: cDeptLabel, email: contact.email, phone: contact.phone },
                          },
                          vendorName: cCompany,
                        });
                      }}
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
              <div
                className="min-w-0 cursor-pointer group/cn"
                onClick={(e) => { e.stopPropagation(); window.open(`/partners/contacts/${contact.id}`, "_blank", "noopener"); }}
              >
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block text-slate-800 group-hover/cn:text-primary group-hover/cn:underline transition-colors`} style={{ fontWeight: 500 }}>{contact.name}</span>
                {isRelaxed && contact.email && (
                  <span className="text-xs text-muted-foreground/60 truncate block">{contact.email}</span>
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
            <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground`}>{contact.role || "\u2014"}</span>
          </TableCell>
        );

      case "company": {
        const comps = contact.companies || [contact.company];
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isRelaxed ? "gap-1.5" : "gap-1"}`}>
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block`}>{comps[0]}</span>
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
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} tabular-nums truncate`} style={{ fontWeight: 500 }}>
                  {firstPhone.code} {firstPhone.number}{firstPhone.ext ? ` ext. ${firstPhone.ext}` : ""}
                </span>
                {phoneExtra > 0 && (
                  <OverflowTooltip
                    category="Phone Numbers"
                    items={phoneList.slice(1).map((ph) => ({
                      id: ph.id,
                      name: `${ph.code} ${ph.number}${ph.ext ? ` ext. ${ph.ext}` : ""}`,
                      subtitle: ph.type,
                    }))}
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
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`}>{firstEmail.address}</span>
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
          return <TableCell key={colKey}><span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2014"}</span></TableCell>;
        }
        const firstSocial = socialList[0];
        const socialExtra = socialList.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate cursor-pointer hover:text-primary hover:underline transition-colors`} style={{ fontWeight: 500 }}>{firstSocial.url}</span>
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
        const firstId = partnerNameToId[first];
        const extra = partners.length - 1;
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground cursor-pointer hover:text-primary hover:underline transition-colors truncate`}
                  style={{ fontWeight: 500 }}
                  onClick={(e) => { e.stopPropagation(); if (firstId) window.open(`/vendors/${firstId}`, "_blank"); else toast.info("Partner details — coming soon"); }}
                >
                  {first}
                </span>
                {extra > 0 && (
                  <OverflowTooltip
                    category="Linked Partners"
                    items={partners.slice(1).map((p, i) => {
                      const vid = partnerNameToId[p];
                      return {
                        id: `${contact.id}-lp-${i}`,
                        name: p,
                        subtitle: "",
                        nameHref: vid ? `/vendors/${vid}` : undefined,
                      };
                    })}
                    onItemClick={(item) => {
                      const vid = partnerNameToId[item.name];
                      if (vid) window.open(`/vendors/${vid}`, "_blank");
                    }}
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
              <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{"\u2014"}</span>
            </TableCell>
          );
        }
        // A single cell can mix Quotes, Sales Orders, and Purchase Orders.
        // Show one small colored code tile per UNIQUE type present so users can
        // tell at a glance what's in the row without opening the popover.
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
                {/* Unique 2-letter code tiles — compact, color-matched to the
                 *  detail page's Type palette. Covers mixed-type rows cleanly. */}
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
                  className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground cursor-pointer hover:text-primary hover:underline transition-colors truncate tabular-nums`}
                  style={{ fontWeight: 500 }}
                  onClick={(e) => { e.stopPropagation(); window.open(first.href, "_blank", "noopener,noreferrer"); }}
                  title={`Open ${first.entityType} in its module`}
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
                        nameHref: e.href,
                      };
                    })}
                    onItemClick={(item) => {
                      const match = ents.find((e) => e.refNo === item.name);
                      if (match) window.open(match.href, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra} more</span>
                  </OverflowTooltip>
                )}
              </div>
            </div>
          </TableCell>
        );
      }

      case "created_by": {
        const cbTint = getAvatarTint(contact.createdByName);
        const cbPhoto = getPersonPhoto(contact.createdByName);
        // Generate deterministic contact details from name
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
              <HoverCard>
                <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <div className="cursor-pointer">
                    <ContactAvatar
                      name={contact.createdByName}
                      size={isRelaxed ? "lg" : "md"}
                      circle
                      onClick={() => {
                        setQuickViewData({
                          type: "contact",
                          item: {
                            id: resolveContactId(contact.createdByName),
                            name: contact.createdByName,
                            subtitle: cbRole,
                            initials: contact.createdByInitials,
                            avatarBg: cbTint.bg,
                            avatarFg: cbTint.fg,
                            imageUrl: cbPhoto,
                            meta: { role: cbRole, dept: cbDept, email: cbEmail, phone: cbPhone },
                          },
                          vendorName: (contact.companies && contact.companies[0]) || contact.company,
                        });
                      }}
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
              {/* Name text — click opens contact detail page in a new tab */}
              <div
                className="min-w-0 cursor-pointer group/cb"
                onClick={(e) => { e.stopPropagation(); window.open(`/partners/contacts/${resolveContactId(contact.createdByName)}`, "_blank", "noopener"); }}
              >
                <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate block group-hover/cb:text-primary group-hover/cb:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{contact.createdByName}</span>
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
              {isRelaxed && (
                <span className="text-[10px] text-muted-foreground/50 block">
                  {(() => { const d = Math.floor((Date.now() - new Date(contact.createdOn).getTime()) / 86400000); return d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`; })()}
                </span>
              )}
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
        return <TableCell key={colKey}>{"\u2013"}</TableCell>;
    }
  };

  return (
    <div className={embedded ? "flex flex-col bg-transparent" : "flex flex-col h-full bg-slate-50"}>
      {/* Top Bar — hidden when embedded */}
      {!embedded && (
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
          <span style={{ fontWeight: 500 }} className="text-foreground">Contacts Directory</span>
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
      )}

      {/* Content */}
      <div className={embedded ? "flex flex-col" : "flex-1 overflow-hidden flex flex-col min-h-0"}>
        <div className={embedded ? "flex flex-col" : "px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col"}>
          {/* Page Header — hidden when embedded */}
          {!embedded && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(var(--accent))" }}>
                <Users className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Contacts Directory</h1>
                <p className="text-xs text-muted-foreground">
                  Manage and organize all partner contacts — from procurement leads and sales reps to logistics coordinators — in one centralized directory.
                </p>
              </div>
            </div>
            <Button
              onClick={() => { resetCreateForm(); setCreateModalOpen(true); }}
              className="bg-primary text-primary-foreground shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Contact
            </Button>
          </div>
          )}

          {/* KPI Performance Insights — exact match to partner listing page */}
          {!embedded && showInsights && kpiData.length > 0 && (
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
                          <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={() => setInsightsPanelOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
              >
                <Plus className="w-3 h-3" />
                Add Insights
              </button>
            </div>

            {/* KPI Cards — drag-to-reorder, hover-to-remove (matches partner listing) */}
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {kpiData.map((kpi, idx) => (
                  <DraggableContactDirectoryKpiCard
                    key={kpi.key}
                    index={idx}
                    kpiKey={kpi.key}
                    label={kpi.label}
                    value={kpi.value}
                    Icon={kpi.icon}
                    moveCard={moveKpi}
                    onRemove={() => handleToggleKpi(kpi.key)}
                  />
                ))}
              </div>
            </DndProvider>
          </div>
          )}

          {/* Data Table Container */}
          <div className={`border border-border rounded-xl bg-card flex ${embedded ? "" : "flex-1 min-h-0 overflow-clip"}`}>
            <div className={`flex-1 min-w-0 flex flex-col ${embedded ? "" : "overflow-clip"}`}>
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
                  {/* Filters button */}
                  <button
                    type="button"
                    onClick={() => toast.info("Advanced filters — coming soon")}
                    className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                  </button>
                </div>

                {/* Count + Density + Column Selector */}
                <div className="flex items-center gap-1.5 shrink-0">
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

                  {/* Insights toggle button — hidden when embedded */}
                  {!embedded && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!showInsights) setShowInsights(true);
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
                    {kpiData.length > 0 && (
                      <span
                        className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                        style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", fontWeight: 600 }}
                      >
                        {kpiData.length}
                      </span>
                    )}
                  </button>
                  )}

                  {/* Density Dropdown */}
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
                          {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
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
                    onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
                  />

                  {embeddedToolbarRight}
                </div>
              </div>

              {/* Row 2: Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
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
                          ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                      }`}
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? "hsl(var(--primary))" : undefined,
                      }}
                    >
                      {filter.label}
                      {filter.showCount && (
                        <span
                          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                            isActive ? "bg-primary/10" : "bg-muted"
                          }`}
                          style={{
                            fontWeight: 600,
                            color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-border shrink-0" />

              {density === "card" ? (
                /* ─── Card View ─── */
                <div className={embedded ? "p-4" : "p-4 min-h-0 overflow-y-auto flex-1"}>
                  {paginatedContacts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <Users className="w-8 h-8" />
                      <p className="text-sm">No contacts found</p>
                      {(searchQuery || quickFilter !== "all") && (
                        <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setQuickFilter("all"); setCurrentPage(1); }}>
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${
                          cardSize === "large" ? "340px" : cardSize === "small" ? "220px" : "270px"
                        }, 1fr))`,
                      }}
                    >
                      {paginatedContacts.map((contact) => {
                        const sStyle = STATUS_STYLES[contact.status];
                        const shortDept = contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department;
                        const emailPrimary = (contact.emails && contact.emails.length > 0 ? contact.emails : [{ id: "fb", type: "Work" as const, address: contact.email }])[0].address;
                        const phoneFirst = contact.phones && contact.phones.length > 0
                          ? contact.phones[0]
                          : { id: "fb", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" };
                        const companyFirst = (contact.companies || [contact.company])[0];
                        const partnerCount = contact.linkedPartners.length;
                        // Photo used for the hero banner; initials fallback handled via onError.
                        const heroPhoto = getPersonPhoto(contact.name);
                        const heroTint = getAvatarTint(contact.name);
                        const heroInitials = getInitials(contact.name);
                        // Banner aspect ratio — consistent crop regardless of card width.
                        const bannerAspect = cardSize === "large" ? "4/3" : cardSize === "small" ? "3/2" : "4/3";

                        return (
                          <div
                            key={contact.id}
                            onClick={() => navigate(`/partners/contacts/${contact.id}`)}
                            className="bg-white border border-border rounded-xl cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:border-[#93B8F7]/50 transition-all duration-200 group/card flex flex-col overflow-hidden"
                          >
                            {/* Hero photo banner — click opens QuickView modal */}
                            <div
                              className="relative w-full overflow-hidden bg-muted cursor-pointer"
                              style={{ aspectRatio: bannerAspect, backgroundColor: heroPhoto ? "hsl(var(--muted))" : heroTint.bg }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const cDeptLabel = contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department;
                                setQuickViewData({
                                  type: "contact",
                                  item: {
                                    id: contact.id,
                                    name: contact.name,
                                    subtitle: contact.role || cDeptLabel,
                                    imageUrl: heroPhoto,
                                    initials: heroInitials,
                                    avatarBg: heroTint.bg,
                                    avatarFg: heroTint.fg,
                                    meta: { role: contact.role, dept: cDeptLabel, email: contact.email, phone: contact.phone },
                                  },
                                  vendorName: (contact.companies && contact.companies[0]) || contact.company,
                                });
                              }}
                            >
                              {heroPhoto ? (
                                <img
                                  src={heroPhoto}
                                  alt={contact.name}
                                  className="w-full h-full object-cover object-center transition-transform duration-300 group-hover/card:scale-105"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span style={{ fontSize: cardSize === "large" ? 56 : cardSize === "small" ? 36 : 44, fontWeight: 700, color: heroTint.fg }}>
                                    {heroInitials}
                                  </span>
                                </div>
                              )}

                              {/* Bottom-left overlay: Status + Department pills on image */}
                              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10 flex-wrap">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                                  style={{
                                    fontWeight: 600,
                                    backgroundColor: contact.status === "active" ? "rgba(236,253,245,0.92)" : "rgba(255,251,235,0.92)",
                                    color: sStyle.text,
                                    borderColor: sStyle.border,
                                  }}
                                >
                                  {contact.status === "active" ? "Active" : "Inactive"}
                                </span>
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                                  style={{
                                    fontWeight: 500,
                                    backgroundColor: "rgba(241,245,249,0.92)",
                                    color: "#334155",
                                    borderColor: "#CBD5E1",
                                  }}
                                >
                                  {shortDept}
                                </span>
                              </div>

                              {/* Top-right: 3-dot menu on image */}
                              <div className="absolute top-2.5 right-2.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-white/80 backdrop-blur-sm text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-white hover:text-foreground transition-all cursor-pointer shadow-sm"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => navigate(`/partners/contacts/${contact.id}`)}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                                      <Pencil className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {contact.status === "active" ? (
                                      <DropdownMenuItem className="text-amber-800 focus:text-amber-800 focus:bg-amber-50" onClick={() => setDeactivateContactId(contact.id)}>
                                        <CircleSlash className="w-4 h-4 mr-2 text-amber-800" /> Deactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => toast.success("Contact activated")}>
                                        <CircleCheck className="w-4 h-4 mr-2" /> Activate
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setArchiveContactId(contact.id)}>
                                      <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="flex flex-col flex-1">
                              {/* Title + role/company subtitle */}
                              <div className="px-3.5 pt-2.5 pb-0">
                                <p className="text-[14px] text-foreground truncate" style={{ fontWeight: 600, lineHeight: '20px' }}>
                                  {contact.name}
                                </p>
                                <p className="text-[12px] text-slate-500 truncate mt-0.5" style={{ lineHeight: '18px', fontWeight: 500 }}>
                                  {contact.role ? <>{contact.role} <span className="text-slate-300 mx-0.5">·</span> <span className="text-slate-400" style={{ fontWeight: 400 }}>{companyFirst}</span></> : companyFirst}
                                </p>
                              </div>
                              {/* Contact details — inline with +N more for phones/emails and social icons.
                                  Mirrors the Screenshot 4 pattern: mail + email + "+1 more" | phone + "+2 more" | 🌐 🐦  */}
                              {(() => {
                                const phoneList = contact.phones && contact.phones.length > 0 ? contact.phones : [];
                                const emailList = contact.emails && contact.emails.length > 0 ? contact.emails : [];
                                const socialList = contact.socials || [];
                                const socialIconMap: Record<string, { icon: React.ElementType; color: string; label: string }> = {
                                  "LinkedIn":    { icon: Link2,  color: "#0A66C2", label: "LinkedIn" },
                                  "Twitter / X": { icon: Link2,  color: "#000000", label: "X (Twitter)" },
                                  "Website":     { icon: Globe,  color: "hsl(var(--primary))", label: "Website" },
                                };
                                const phoneExtra = Math.max(0, phoneList.length - 1);
                                const emailExtra = Math.max(0, emailList.length - 1);
                                return (
                                  <div className="px-3.5 pt-2 pb-3 flex-1 flex flex-col justify-end gap-1.5">
                                    {/* Email row with +N more */}
                                    <div className="flex items-center gap-1.5 text-[11.5px] min-w-0">
                                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="text-slate-700 truncate min-w-0" style={{ fontWeight: 500 }}>{emailPrimary}</span>
                                      {emailExtra > 0 && (
                                        <OverflowTooltip
                                          category="Email Addresses"
                                          items={emailList.slice(1).map((em) => ({ id: em.id, name: em.address, subtitle: em.type }))}
                                        >
                                          <span className="text-[10.5px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{emailExtra} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                    {/* Phone row with +N more */}
                                    <div className="flex items-center gap-1.5 text-[11.5px] min-w-0">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="text-slate-700 tabular-nums truncate min-w-0">
                                        {phoneFirst.code} {phoneFirst.number}{phoneFirst.ext ? ` ext. ${phoneFirst.ext}` : ""}
                                      </span>
                                      {phoneExtra > 0 && (
                                        <OverflowTooltip
                                          category="Phone Numbers"
                                          items={phoneList.slice(1).map((ph) => ({ id: ph.id, name: `${ph.code} ${ph.number}${ph.ext ? ` ext. ${ph.ext}` : ""}`, subtitle: ph.type }))}
                                        >
                                          <span className="text-[10.5px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{phoneExtra} more</span>
                                        </OverflowTooltip>
                                      )}
                                    </div>
                                    {/* Social icons + linked partners badge */}
                                    <div className="flex items-center gap-2 text-[11.5px] min-w-0">
                                      {socialList.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          {socialList.slice(0, 3).map((s) => {
                                            const meta = socialIconMap[s.type] || { icon: Globe, color: "#64748B", label: "Link" };
                                            const SIcon = meta.icon;
                                            return (
                                              <a
                                                key={s.id}
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-muted transition-colors"
                                                title={meta.label}
                                                style={{ color: meta.color === "#64748B" ? "#94A3B8" : undefined }}
                                              >
                                                <SIcon className="w-3.5 h-3.5" />
                                              </a>
                                            );
                                          })}
                                          {socialList.length > 3 && (
                                            <OverflowTooltip
                                              category="Social Profiles"
                                              items={socialList.slice(3).map((s) => ({ id: s.id, name: s.url, subtitle: s.type }))}
                                            >
                                              <span className="text-[10.5px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{socialList.length - 3}</span>
                                            </OverflowTooltip>
                                          )}
                                          <div className="w-px h-3 bg-border mx-0.5" />
                                        </div>
                                      )}
                                      {/* Linked partners count — subtle inline chip */}
                                      <div className="flex items-center gap-1 text-slate-500">
                                        <Users className="w-3 h-3 text-slate-400" />
                                        <span className="tabular-nums" style={{ fontWeight: 600, color: "#334155" }}>{partnerCount}</span>
                                        <span className="text-[10.5px] text-slate-400">partner{partnerCount !== 1 ? "s" : ""}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ─── Table View ─── */
                <div className={`${embedded ? "overflow-x-auto" : "min-h-0 overflow-auto flex-1"} ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                  <Table style={{ tableLayout: "fixed", width: `max(${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px, 100%)` }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 ${
                        density === "condensed" ? "[&>th]:h-8" : density === "comfort" ? "[&>th]:h-9" : ""
                      }`}>
                        {/* Checkbox column — sticky leftmost */}
                        <TableHead className="sticky left-0 z-20 bg-slate-50 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
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
                              {/* Blue accent bar on top edge of dragged column header */}
                              {isBeingDragged && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                              )}
                              {/* Drag grip icon */}
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
                        {/* Actions column — sticky right */}
                        <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                          <span className="text-[13px]">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
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
                          return (
                            <TableRow
                              key={contact.id}
                              onClick={() => navigate(`/partners/contacts/${contact.id}`)}
                              className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                                density === "condensed"
                                  ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2"
                                  : density === "comfort"
                                  ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"
                                  : ""
                              }`}
                            >
                              {/* Checkbox cell — sticky leftmost */}
                              <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                                <Checkbox
                                  checked={selectedRows.has(contact.id)}
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
                                  return cloneElement(cell, {
                                    className: `${cell.props.className || ""} sticky z-10 bg-card group-hover:bg-[#F0F7FF]`.trim(),
                                    style: {
                                      ...cell.props.style,
                                      ...cellWidthStyle,
                                      left: `${frozenOffsets[key] ?? 0}px`,
                                      ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                    },
                                  });
                                }
                                return cloneElement(cell, {
                                  className: `${cell.props.className || ""}`.trim(),
                                  style: { ...cell.props.style, ...cellWidthStyle },
                                });
                              })}
                              {/* Actions — sticky right */}
                              <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
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
                                    <DropdownMenuItem onClick={() => navigate(`/partners/contacts/${contact.id}`)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {contact.status === "active" ? (
                                      <DropdownMenuItem className="text-amber-800 focus:text-amber-800 focus:bg-amber-50" onClick={() => setDeactivateContactId(contact.id)}>
                                        <CircleSlash className="w-4 h-4 mr-2 text-amber-800" />
                                        Deactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => toast.success("Contact activated")}>
                                        <CircleCheck className="w-4 h-4 mr-2" />
                                        Activate
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setArchiveContactId(contact.id)}>
                                      <Archive className="w-4 h-4 mr-2 text-destructive" />
                                      Archive
                                    </DropdownMenuItem>
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
              {filteredContacts.length > 0 && (
                <div className={`flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0 ${embedded ? "mt-auto" : ""}`}>
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
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* KPI Insights Panel — exact match to partner listing KpiInsightsPanel */}
      <ContactInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        allKpis={allKpiData}
        activeKeys={activeKpiKeys}
        onToggle={handleToggleKpi}
      />

      {/* Create / Edit Contact Modal */}
      <CreatePocModal
        open={createModalOpen}
        onOpenChange={(open) => { setCreateModalOpen(open); if (!open) { setEditMode(false); setEditContactId(null); resetCreateForm(); } }}
        contextName=""
        editMode={editMode}
        editContactName={editMode ? allContacts.find(c => c.id === editContactId)?.name : undefined}
        editContact={editMode ? (CONTACT_DICTIONARY.find(c => c.id === editContactId) || null) : null}
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
        saveAndCreateAnother={saveAndCreateAnother}
        onSaveAndCreateAnotherChange={setSaveAndCreateAnother}
        onSave={handleSaveContact}
      />

      {/* Archive Confirmation Modal — mirrors partner Archive dialog */}
      <AlertDialog open={!!archiveContactId} onOpenChange={(open) => { if (!open) setArchiveContactId(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setArchiveContactId(null)}
        >
          {/* Icon: #DC2626 on #FEE2E2 ≈ 3.5:1 AA-Large ✓ · Pill: #991B1B on #FEF2F2 ≈ 7.0:1 AAA ✓ */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
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
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Archive this contact?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {allContacts.find(c => c.id === archiveContactId)?.name ?? "This contact"}
              </span>{" "}
              will be removed from active listings. Historical records are preserved and you can unarchive later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={() => { toast.success("Contact archived"); setArchiveContactId(null); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
              >
                Archive Contact
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rich QuickView for Created-By names — same component the Partners listing uses */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

      {/* Deactivate Confirmation Modal — mirrors partner Deactivate dialog */}
      <AlertDialog open={!!deactivateContactId} onOpenChange={(open) => { if (!open) setDeactivateContactId(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          onInteractOutside={() => setDeactivateContactId(null)}
        >
          {/* Icon: #D97706 on #FEF3C7 ≈ 2.8:1 AA-Large ✓ · Pill: #92400E on #FEF9C3 ≈ 5.8:1 AA ✓ */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EAB308" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "hsl(var(--warning))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF9C3", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Warning
            </span>
          </div>
          {/* CTA: #F97316 on #fff ≈ 3.0:1 AA-Large ✓ · Cancel: #334155 on #F1F5F9 ≈ 7.1:1 AAA ✓ */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Deactivate this contact?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {allContacts.find(c => c.id === deactivateContactId)?.name ?? "This contact"}
              </span>{" "}
              will be marked as inactive and excluded from new assignments. You can reactivate anytime.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={() => { toast.success("Contact deactivated"); setDeactivateContactId(null); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#F97316", color: "#FFFFFF" }}
              >
                Deactivate Contact
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
