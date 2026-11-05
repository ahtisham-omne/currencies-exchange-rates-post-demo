import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { appHref } from "@/embedding";
import { useParams, useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Phone,
  Mail,
  Building2,
  Pencil,
  Archive,
  ArchiveRestore,
  CircleSlash,
  FileText,
  Paperclip,
  Activity,
  StickyNote,
  Users,
  UserCheck,
  Clock,
  Download,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  DollarSign,
  MoreHorizontal,
  Globe,
  ExternalLink,
  Calendar,
  CircleCheck,
  Link2,
  MessageSquare,
  Briefcase,
  ShoppingCart,
  Receipt,
  ClipboardList,
  Search,
  RefreshCw,
  RotateCcw,
  BarChart3,
  TrendingUp,
  Star,
  Package,
  GripVertical,
  Trash2,
  Info,
  X,
  Plus,
  Check,
  Sliders,
  ToggleLeft,
  ToggleRight,
  PhoneCall,
  Shield,
  Maximize2,
  Minimize2,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Send,
  MessageCircle,
  Upload,
  LayoutGrid,
  List,
  AlignJustify,
  MoreVertical,
  Image as ImageIcon,
  FileSpreadsheet,
  ChartColumn,
  Columns3,
  Tag,
  Eye,
  Unlink2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import { CONTACT_DICTIONARY, type ContactPerson, type ContactPhone, type ContactEmail, type ContactSocial } from "../components/vendors/partnerConstants";
import { AttachmentsTab } from "../components/vendors/AttachmentsTab";
import { ActivityFeed, type ActivityFeedItemType } from "../components/vendors/PartnerGroupDetailModal";
import { VendorsListPage } from "./VendorsListPage";
import { getAvatarTint } from "../utils/avatarTints";
import { getLastUpdated } from "../utils/lastUpdated";
import { useVendors } from "../context/VendorContext";
import { usePersonLightbox } from "../components/vendors/PersonAvatarLightbox";
import { ALL_KPI_DEFINITIONS, DEFAULT_ACTIVE_KPIS, computeKpiValue, buildSeededDelta, insightsRangePeriodLabel, type KpiDelta } from "../components/vendors/KpiInsightsPanel";
import { InsightsRangeMenu, InsightsRefresh, InsightsResetButton, type InsightsRange } from "../components/vendors/InsightsControls";
import { CreatePocModal } from "../components/vendors/PocModals";
import { QuickViewPanel, type QuickViewData } from "../components/vendors/QuickViewPanel";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  createBlankFilter,
  isFilterActive,
  applyFilters,
  sortRows,
  getUniqueColumnValues,
  type CellAccessor,
  type ColumnFilterState,
  type FilterType,
  type SortConfig,
} from "../components/vendors/ColumnHeaderMenu";
// Sheet import removed — EntityInsightsPanel uses custom animated drawer (matching KpiInsightsPanel)
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { TableEmptyRow, TableSkeletonRows, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";

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
  "Ahtisham": "/avatars/ahtisham-ahmad.jpg",
  "Irtaza": "/avatars/irtaza-abid.jpg",
  "Mahreen": "/avatars/mahreen-ghafoor.png",
  "Nophil": "/avatars/nophil-anwer.png",
  "Eli": "/avatars/eli-rosenbloom.png",
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
  // Deterministic fallback — hash-based randomuser.me URL (same as ContactsDirectoryPage)
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const gender = absHash % 2 === 0 ? "men" : "women";
  const id = (absHash % 99) + 1;
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
}

/* ─── Partner name pool for linked partners ─── */
const PARTNER_NAMES = [
  "Acme Corp", "TechVault", "NexGen Solutions", "Apex Industries", "Summit Group",
  "Vertex Labs", "Pioneer Systems", "Atlas Logistics", "Beacon Analytics", "Cascade Networks",
  "Delta Manufacturing", "Echo Enterprises", "Falcon Dynamics", "Granite Holdings", "Horizon Partners",
  "Ionic Solutions", "Jade Innovations", "Keystone Global", "Lumen Corp", "Metro Supply",
];

/* ─── Department pill styles ─── */
const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Sales: { bg: "#EBF3FF", text: "#0548A3", border: "#A8D2FF" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Finance: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

/* ─── Enrichment helper ─── */
interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive" | "archived";
  linkedPartners: string[];
  createdByName: string;
  createdByInitials: string;
  createdOn: string;
}

function enrichContactWithNames(c: ContactPerson, names: string[]): EnrichedContact {
  let hash = 0;
  for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const status: "active" | "inactive" | "archived" = absHash % 5 === 0 ? "inactive" : "active";
  const partnerCount = 1 + (absHash % 5);
  const linkedPartners: string[] = [];
  for (let p = 0; p < partnerCount; p++) {
    linkedPartners.push(names[(absHash + p * 7) % names.length]);
  }
  const CREATORS = ["Ahtisham Ahmad", "Sarah Johnson", "David Kim", "Emily Chen", "Marcus Obi", "Elena Volkov"];
  const createdByName = CREATORS[absHash % CREATORS.length];
  const createdByInitials = createdByName.split(" ").map(w => w[0]).join("").toUpperCase();
  const month = (absHash % 12) + 1;
  const day = (absHash % 28) + 1;
  const year = absHash % 3 === 0 ? 2025 : 2026;
  const createdOn = new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { ...c, status, linkedPartners, createdByName, createdByInitials, createdOn };
}

/* ─── Dummy data ─── */
const ACTIVITY_LOG = [
  { id: 1, action: "Purchase Order PO-3021 was approved", user: "Sarah Johnson", date: "2026-03-28T10:15:00Z", icon: "create" },
  { id: 2, action: "Email sent to issacarcher@toyota.technical.com", user: "System", date: "2026-03-25T14:00:00Z", icon: "email" },
  { id: 3, action: "Quote QT-4501 accepted", user: "Issac Archer", date: "2026-03-25T09:30:00Z", icon: "create" },
  { id: 4, action: "Sales Order SO-1102 fulfilled", user: "System", date: "2026-03-26T11:00:00Z", icon: "create" },
  { id: 5, action: "Phone number updated", user: "Admin", date: "2026-03-20T10:05:00Z", icon: "edit" },
  { id: 6, action: "Linked to NexGen Solutions", user: "Sarah Johnson", date: "2026-03-15T16:33:00Z", icon: "link" },
  { id: 7, action: "Quote QT-4487 sent for review", user: "Michael Lee", date: "2026-03-18T14:30:00Z", icon: "create" },
  { id: 8, action: "Email address updated", user: "Admin", date: "2026-02-14T11:45:00Z", icon: "edit" },
  { id: 9, action: "Linked to Acme Corp", user: "Sarah Johnson", date: "2026-01-08T16:33:00Z", icon: "link" },
  { id: 10, action: "Contact created", user: "System", date: "2025-11-02T09:15:00Z", icon: "create" },
];

const NOTES_DATA = [
  { id: 1, author: "Sarah Johnson", date: "2026-03-15T09:00:00Z", text: "Confirmed preferred communication channel is email. Direct phone line available for urgent matters only." },
  { id: 2, author: "Michael Lee", date: "2026-02-20T14:30:00Z", text: "Attended annual vendor review meeting. Contact expressed interest in expanding partnership to include logistics services." },
  { id: 3, author: "Admin", date: "2026-01-10T11:15:00Z", text: "Verified contact details during quarterly data cleanup. All information current and accurate." },
];

const PURCHASE_ORDERS_DATA = [
  { id: "PO-3021", vendor: "Acme Corp", amount: "$18,500", status: "Approved", date: "2026-03-28T09:00:00Z" },
  { id: "PO-2984", vendor: "TechVault", amount: "$7,200", status: "Pending", date: "2026-03-22T14:00:00Z" },
  { id: "PO-2951", vendor: "NexGen Solutions", amount: "$34,800", status: "Delivered", date: "2026-03-15T10:30:00Z" },
  { id: "PO-2913", vendor: "Apex Industries", amount: "$12,100", status: "Delivered", date: "2026-03-08T11:00:00Z" },
  { id: "PO-2887", vendor: "Summit Group", amount: "$5,600", status: "Approved", date: "2026-02-28T16:00:00Z" },
  { id: "PO-2845", vendor: "Vertex Labs", amount: "$22,400", status: "Delivered", date: "2026-02-20T09:30:00Z" },
];

const SALES_ORDERS_DATA = [
  { id: "SO-1102", customer: "Acme Corp", amount: "$9,800", status: "Fulfilled", date: "2026-03-26T10:00:00Z" },
  { id: "SO-1089", customer: "Pioneer Systems", amount: "$15,300", status: "Processing", date: "2026-03-20T14:30:00Z" },
  { id: "SO-1074", customer: "Atlas Logistics", amount: "$6,400", status: "Fulfilled", date: "2026-03-14T09:00:00Z" },
  { id: "SO-1058", customer: "Beacon Analytics", amount: "$28,700", status: "Shipped", date: "2026-03-08T11:00:00Z" },
  { id: "SO-1041", customer: "Cascade Networks", amount: "$11,200", status: "Fulfilled", date: "2026-02-28T16:30:00Z" },
  { id: "SO-1029", customer: "Delta Manufacturing", amount: "$4,500", status: "Fulfilled", date: "2026-02-22T10:00:00Z" },
];

const QUOTES_DATA = [
  { id: "QT-4501", partner: "Acme Corp", amount: "$24,000", status: "Accepted", validUntil: "2026-04-30T00:00:00Z", date: "2026-03-25T09:00:00Z" },
  { id: "QT-4487", partner: "TechVault", amount: "$8,900", status: "Pending", validUntil: "2026-04-15T00:00:00Z", date: "2026-03-18T14:00:00Z" },
  { id: "QT-4472", partner: "NexGen Solutions", amount: "$41,200", status: "Expired", validUntil: "2026-03-01T00:00:00Z", date: "2026-02-15T10:00:00Z" },
  { id: "QT-4458", partner: "Summit Group", amount: "$6,750", status: "Accepted", validUntil: "2026-05-01T00:00:00Z", date: "2026-03-10T11:30:00Z" },
  { id: "QT-4441", partner: "Vertex Labs", amount: "$19,300", status: "Rejected", validUntil: "2026-03-20T00:00:00Z", date: "2026-02-28T09:00:00Z" },
];

const ATTACHMENTS_DATA = [
  { id: 1, name: "NDA_Agreement_2026.pdf", size: "1.2 MB", date: "2026-03-10T09:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 2, name: "Contact_Onboarding_Form.docx", size: "340 KB", date: "2026-01-15T14:20:00Z", type: "doc", uploadedBy: "Admin" },
  { id: 3, name: "ID_Verification.png", size: "2.8 MB", date: "2025-12-05T10:45:00Z", type: "img", uploadedBy: "Michael Lee" },
  { id: 4, name: "Meeting_Notes_Q1.pdf", size: "520 KB", date: "2026-03-28T16:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 5, name: "Vendor_Agreement_v2.xlsx", size: "890 KB", date: "2026-02-20T11:30:00Z", type: "xlsx", uploadedBy: "Elena Volkov" },
  { id: 6, name: "Partnership_Contract.pdf", size: "3.4 MB", date: "2026-01-05T08:30:00Z", type: "pdf", uploadedBy: "Daniel Adams" },
  { id: 7, name: "Company_Logo.jpg", size: "1.8 MB", date: "2025-11-20T15:00:00Z", type: "img", uploadedBy: "Alex Morgan" },
  { id: 8, name: "Financial_Report_Q4.xlsx", size: "2.1 MB", date: "2026-02-10T09:45:00Z", type: "xlsx", uploadedBy: "Lisa Park" },
];

/* ─── Tab definitions ─── */
/**
 * `linked_entities` replaces the former Purchase Orders, Sales Orders, and Quotes
 * tabs — a contact can link to 8+ entity types (POs, SOs, Quotes, Vendor Invoices,
 * Customer Invoices, Shipments, Payments, …) and a tab per type doesn't scale.
 * Communications is a deferred placeholder pending the Comms module.
 */
const TABS = [
  { id: "overview", label: "Overview", icon: User },
  { id: "linked_partners", label: "Linked Partners", icon: Link2 },
  { id: "linked_entities", label: "Linked Entities", icon: Briefcase },
  // Communications + Notes are deferred behind their own modules —
  // tabs stay in the strip so navigation structure doesn't churn, but
  // the body renders the canonical PlaceholderTab and the label
  // carries a small "soon" badge so users see the state up front.
  { id: "communications", label: "Communications", icon: MessageSquare, comingSoon: true },
  { id: "notes", label: "Notes", icon: StickyNote, comingSoon: true },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Activity History", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Linked Entities — unified row type across POs / SOs / Quotes / … ─── */
type LinkedEntityType =
  | "Purchase Order"
  | "Sales Order"
  | "Quote"
  | "Vendor Invoice"
  | "Customer Invoice"
  | "Shipment"
  | "Payment";

interface LinkedEntityRow {
  id: string;
  entityType: LinkedEntityType;
  refNo: string;
  partner: string;
  status: string;
  date: string;
  amount: string;
  role: string;
  /** Deep-link URL opened in a new tab when the row is clicked. */
  href: string;
}

/* ─── Per-entity-type styling (icon + accent color) ─── */
const ENTITY_TYPE_META: Record<LinkedEntityType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  "Purchase Order":   { icon: ShoppingCart,  color: "rgb(var(--primary))", bg: "rgb(var(--accent))", border: "#A8D2FF" },
  "Sales Order":      { icon: Receipt,       color: "rgb(var(--success))", bg: "#ECFDF5", border: "#A7F3D0" },
  "Quote":            { icon: ClipboardList, color: "rgb(var(--violet))", bg: "#F5F3FF", border: "#DDD6FE" },
  "Vendor Invoice":   { icon: FileText,      color: "rgb(var(--warning))", bg: "#FFFBEB", border: "#FDE68A" },
  "Customer Invoice": { icon: FileText,      color: "rgb(var(--destructive))", bg: "#FEF2F2", border: "#FECACA" },
  "Shipment":         { icon: Package,       color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
  "Payment":          { icon: Star,          color: "#65A30D", bg: "#F7FEE7", border: "#D9F99D" },
};

/* ─── Status color palette — shared with source modules ─── */
const LINKED_ENTITY_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  // PO
  "Confirmed":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Approved":                 { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Draft":                    { bg: "rgb(var(--muted))", text: "rgb(var(--muted-foreground))", border: "#CBD5E1" },
  "Sent":                     { bg: "#EBF3FF", text: "#0548A3", border: "#A8D2FF" },
  "Pending":                  { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Partially Received":       { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  "Fully Received":           { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Active with Cancellation": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Cancelled":                { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Delivered":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  // SO
  "Fulfilled":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Processing":               { bg: "#EBF3FF", text: "#0548A3", border: "#A8D2FF" },
  "Shipped":                  { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
  // Quote
  "Accepted":                 { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Rejected":                 { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Expired":                  { bg: "rgb(var(--muted))", text: "rgb(var(--muted-foreground))", border: "#CBD5E1" },
};

/* ─── Format date helper ─── */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/*  ContactDetailPage                                             */
/* ═══════════════════════════════════════════════════════════════ */
/* ─── DnD KPI Card ─── */
const DND_CONTACT_KPI = "CONTACT_KPI";

function DraggableContactKpi({ index, kpiKey, label, value, icon: Icon, change, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string; icon: React.ElementType; change: string | null; moveCard: (from: number, to: number) => void; onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({ type: DND_CONTACT_KPI, item: () => ({ index }), collect: (m) => ({ isDragging: m.isDragging() }) });
  const [{ isOver }, drop] = useDrop({
    accept: DND_CONTACT_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIdx = item.index;
      if (dragIdx === index) return;
      const rect = ref.current.getBoundingClientRect();
      const midX = (rect.right - rect.left) / 2;
      const midY = (rect.bottom - rect.top) / 2;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const cx = offset.x - rect.left;
      const cy = offset.y - rect.top;
      if (dragIdx < index && cy < midY && cx < midX) return;
      if (dragIdx > index && cy > midY && cx > midX) return;
      moveCard(dragIdx, index);
      item.index = index;
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });
  preview(drop(ref));
  drag(ref);
  if (isDragging) return <div ref={ref} className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none" />;
  return (
    <div ref={ref} className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${isOver ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]" : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"}`}>
      {isOver && <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />}
      <div className="px-3 py-2">
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none"><GripVertical className="w-3.5 h-3.5 text-slate-500" /></div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          {change && <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: change.startsWith("\u2191") ? "rgb(var(--success))" : "rgb(var(--destructive))" }}>{change}</span>}
          <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
      </div>
      {/* Remove button — bottom-right, hover-revealed (mirrors partner KPI card) */}
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

/* ─── Contact Widget Definitions ─── */
interface ContactWidgetDef {
  key: string;
  label: string;
  type: "chart" | "list" | "gauge" | "contact" | "text" | "donut" | "bars" | "line";
  description: string;
  category: "Performance" | "Activity" | "Orders" | "Notes";
}

/* Recent Communications + Notes widgets dropped per BA pass — the
 * Communications module list ships post-Pioneer and Notes lives on its
 * own tab; neither earned Overview real estate. The PO/SO Activity bar
 * charts were dropped from the contact directory per BA pass — they read
 * as duplicate of the PO/SO list widgets and the weekly cut adds no
 * signal at the contact level. */
const CONTACT_WIDGET_DEFS: ContactWidgetDef[] = [
  { key: "interaction_activity", label: "Interaction Activity", type: "chart", description: "Daily call & email volume by weekday", category: "Performance" },
  { key: "communication_trend", label: "Communication Trend", type: "line", description: "Yearly communication trend (line chart)", category: "Performance" },
  { key: "purchase_orders", label: "Purchase Orders", type: "list", description: "POs linked to this contact", category: "Orders" },
  { key: "sales_orders", label: "Sales Orders", type: "list", description: "SOs linked to this contact", category: "Orders" },
  { key: "activity_timeline", label: "Activity Timeline", type: "list", description: "Chronological event history", category: "Activity" },
];

const CONTACT_WIDGET_CATEGORY_ORDER: ContactWidgetDef["category"][] = ["Performance", "Activity", "Orders"];

/* Default widget order — Pioneer-scope set: PO list, SO list (where
 * this contact is primary), and the Activity Timeline. The
 * Communications-module charts (interaction_activity,
 * communication_trend) ship deferred — defs stay in CONTACT_WIDGET_DEFS
 * so users can opt in from the Customize panel post-Pioneer, but they
 * don't claim default real estate. */
const DEFAULT_CONTACT_WIDGETS = [
  "purchase_orders", "sales_orders", "activity_timeline",
];

/* Interaction Activity + Communication Trend ship half-width so they sit
 * side-by-side — same paired-chart layout as the partner Dashboard's
 * PO Cost Trend / SO Revenue Trend row. */
const CONTACT_WIDGET_DEFAULT_SPANS: Record<string, "full" | "half"> = {
  interaction_activity: "half",
  communication_trend: "half",
  purchase_orders: "half",
  sales_orders: "half",
  activity_timeline: "half",
};

/* ─── Content Card — entire header is the drag handle ─── */
function ContactContentCard({ title, icon: Icon, count, children, currentSize, onSizeChange, onRemove, isDragging, isOver }: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  children: React.ReactNode;
  currentSize?: "sm" | "md" | "lg";
  onSizeChange?: (size: "sm" | "md" | "lg") => void;
  /** When provided, shows a hover-revealed ✕ in the top-right corner that
   *  removes this widget from the dashboard. Reversible via the Customize
   *  Widgets panel (the widget switches to "off" and can be re-enabled). */
  onRemove?: () => void;
  isDragging?: boolean;
  isOver?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 relative ${
        isOver && !isDragging
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(10,119,255,0.10)]"
          : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Remove widget button — larger hit target, hover state applied at the
       *  button level so the icon turns red whenever the button is hovered,
       *  not just when the cursor is directly on the tiny glyph. */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); toast.success(`Removed "${title}", re-enable in Customize Widgets`); }}
          onMouseDown={(e) => e.stopPropagation()}
          className={`group/rm absolute top-2 right-2 z-10 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all duration-150 cursor-pointer hover:bg-red-100 hover:text-destructive ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          title={`Remove ${title}`}
          aria-label={`Remove ${title} widget`}
        >
          <Trash2 className="w-4 h-4 transition-transform duration-150 group-hover/rm:scale-110" />
        </button>
      )}
      {/* Header — entire bar is the drag handle */}
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
          {count != null && (
            <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent" style={{ fontWeight: 600 }}>{count}</span>
          )}
        </div>
        {/* Size toggle — slides in on hover. Leaves room for the remove ✕ on the far right. */}
        <div
          className={`flex items-center transition-all duration-200 ease-out pointer-events-auto ${
            hovered && onSizeChange ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
          }`}
          style={{ marginRight: onRemove ? 28 : 0 }}
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
      </div>
      {/* Body — natural height, flex stretches to match siblings */}
      <div className={`flex-1 flex flex-col justify-between ${currentSize === "sm" ? "p-3" : currentSize === "lg" ? "p-5" : "p-4"}`}>
        {children}
      </div>
    </div>
  );
}

/* ─── Sidebar Card (matches VendorDetailsPage DashInfoCard — collapsible with icon) ─── */
function ContactSidebarCard({ title, icon: Icon, count, children, defaultOpen = true }: {
  title: string; icon?: React.ElementType; count?: number; children: React.ReactNode; defaultOpen?: boolean;
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

function ContactSidebarRow({ icon: Icon, label, value, isLink }: { icon: React.ElementType; label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{label}</p>
        {isLink ? (
          <a href={`mailto:${value}`} className="text-[12px] text-primary hover:underline break-all" style={{ fontWeight: 500 }}>{value}</a>
        ) : (
          <p className="text-[12px] text-slate-700 break-words" style={{ fontWeight: 500 }}>{value}</p>
        )}
      </div>
    </div>
  );
}

function ContactStatBox({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color?: string }) {
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

/* ─── Draggable Widget Card ─── */
const WIDGET_DND_TYPE = "CONTACT_WIDGET";

function DraggableContactWidget({ widgetKey, index, children }: {
  widgetKey: string;
  index: number;
  /** Kept in signature for backwards-compat; all reorder logic now lives in
   *  the parent `WidgetGridDropZone` so drops can happen in negative space. */
  moveWidget: (from: number, to: number) => void;
  children: (isDragging: boolean, isOver: boolean) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: WIDGET_DND_TYPE,
    item: () => ({ key: widgetKey, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  // Widget is a drop target ONLY to capture the "isOver" visual feedback
  // (ring around the target widget). All actual reordering happens in the
  // grid-level drop zone so gaps and whitespace are valid drop regions too.
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_DND_TYPE,
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  });
  preview(drop(ref));
  // Attach drag to the ref too — the header will call drag() separately
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

/* ─── Grid-level drop zone with live hover reorder.
 *  Row-major aware: for flex-wrap layouts, vertical position dominates.
 *  Cursor above a card's top → insert before; below its bottom → insert after;
 *  inside vertical range → fall back to horizontal midpoint.
 *  Splice semantics are handled so the target index is correct whether the
 *  item is moving forward or backward in the array. */
function WidgetGridDropZone({
  children,
  moveWidget,
}: {
  children: React.ReactNode;
  moveWidget: (from: number, to: number) => void;
  activeCount: number;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const lastSwapRef = useRef(0);
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_DND_TYPE,
    hover(item: { key: string; index: number }, monitor) {
      if (!gridRef.current) return;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const now = performance.now();
      if (now - lastSwapRef.current < 50) return;

      const cards = Array.from(
        gridRef.current.querySelectorAll<HTMLElement>("[data-widget-idx]")
      );
      if (cards.length === 0) return;

      // Find nearest widget by Euclidean distance.
      // IMPORTANT: skip the dragged item itself — it's still in the DOM at its
      // original position (with 0.3 opacity), and without this skip, it's
      // almost always detected as "nearest" and the reorder never fires.
      let bestIdx = -1;
      let bestDist = Infinity;
      let nearestRect: DOMRect | null = null;
      for (const el of cards) {
        const elIdx = Number(el.getAttribute("data-widget-idx"));
        if (elIdx === item.index) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(offset.x - cx, offset.y - cy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = elIdx;
          nearestRect = r;
        }
      }
      if (bestIdx < 0 || !nearestRect) return;

      // Decide: insert BEFORE or AFTER the nearest widget.
      // Row-major: Y dominates. Only fall back to X for same-row disambiguation.
      let insertBefore: boolean;
      if (offset.y < nearestRect.top) {
        insertBefore = true;
      } else if (offset.y > nearestRect.bottom) {
        insertBefore = false;
      } else {
        const midX = (nearestRect.left + nearestRect.right) / 2;
        insertBefore = offset.x < midX;
      }

      // Translate to a target index that respects splice semantics.
      // `moveWidget` does arr.splice(from,1) then arr.splice(to,0,item), so
      // `to` is relative to the post-removal array.
      let target: number;
      if (item.index < bestIdx) {
        // Moving the dragged item forward: nearest shifts down by one after removal.
        target = insertBefore ? bestIdx - 1 : bestIdx;
      } else if (item.index > bestIdx) {
        // Moving backward: nearest stays at bestIdx after removal.
        target = insertBefore ? bestIdx : bestIdx + 1;
      } else {
        // Cursor is over the dragged item itself — nothing to do.
        return;
      }
      target = Math.max(0, Math.min(target, cards.length - 1));

      if (target === item.index) return;
      lastSwapRef.current = now;
      moveWidget(item.index, target);
      item.index = target;
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: false }) }),
  });
  drop(gridRef);

  return (
    <div
      ref={gridRef}
      /* Large min-height ensures plenty of drop surface — user can move cursor
         anywhere within this tall zone (including whitespace below the last
         row of widgets) and hover fires to keep the grid reflowing live. */
      className={`flex flex-wrap gap-3 items-stretch rounded-xl transition-colors duration-150 ${
        isOver ? "bg-primary/[0.02]" : ""
      }`}
      style={{ minHeight: "60vh" }}
    >
      {children}
    </div>
  );
}

/* ─── Contact Customize Panel (KPIs + Widgets tabs) ─── */
/** Visual preview for a widget by type. Uses light Tailwind 200/300-equivalent
 *  tints (e.g. blue-300, orange-200, green-300) so the preview feels airy and
 *  matches the soft pastel palette of the dashboard previews. Inactive cards
 *  fall back to a neutral slate. */
function WidgetTypeVisual({ type, isActive }: { type: ContactWidgetDef["type"]; isActive: boolean }) {
  // Light pastel tints (Tailwind 200/300 family) used when active
  const C = {
    blue:    isActive ? "#7AB8FF" : "rgb(var(--border))",  // blue-300 / slate-200
    orange:  isActive ? "#FDBA74" : "rgb(var(--border))",  // orange-300 / slate-200
    purple:  isActive ? "#C4B5FD" : "rgb(var(--border))",  // purple-300 / slate-200
    green:   isActive ? "#86EFAC" : "rgb(var(--border))",  // green-300 / slate-200
    red:     isActive ? "#FCA5A5" : "rgb(var(--border))",  // red-300 / slate-200
    slate:   isActive ? "#CBD5E1" : "rgb(var(--border))",  // slate-300 / slate-200
    needle:  isActive ? "#64748B" : "#94A3B8",  // slate-500 / slate-400 — gauge needle
    lineFg:  isActive ? "#7AB8FF" : "#CBD5E1",  // line stroke
  };
  if (type === "chart") {
    const data: { h: number; c: string }[] = [
      { h: 14, c: C.blue },
      { h: 24, c: C.blue },
      { h: 18, c: C.orange },
      { h: 28, c: C.blue },
      { h: 16, c: C.orange },
      { h: 22, c: C.blue },
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
          <linearGradient id="g-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.lineFg} stopOpacity="0.45" />
            <stop offset="100%" stopColor={C.lineFg} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6 L 78 30 L 2 30 Z" fill="url(#g-line)" />
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6" stroke={C.lineFg} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // text — sticky-note style for the Notes widget
  return (
    <div className="flex flex-col gap-1.5 w-full px-4">
      {[92, 78, 86, 60].map((w, i) => (
        <div key={i} className="h-1.5 rounded-sm" style={{ width: `${w}%`, backgroundColor: C.slate, opacity: i === 0 ? 1 : 0.65 }} />
      ))}
    </div>
  );
}

function ContactCustomizePanel({ open, onOpenChange, contactKpis, hiddenKpis, onToggleKpi, activeWidgets, onToggleWidget, widgetSizes, onWidgetSizeChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All possible contact KPIs — the same definitions rendered in the strip. */
  contactKpis: { key: string; label: string; value: string; icon: React.ElementType; description: string }[];
  /** Keys the user has hidden from the strip; "active" = NOT in this set. */
  hiddenKpis: Set<string>;
  onToggleKpi: (key: string) => void;
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  widgetSizes: Record<string, "sm" | "md" | "lg">;
  onWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
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

  const filteredKpis = useMemo(() => {
    if (!searchQuery) return contactKpis;
    return contactKpis.filter((k) => k.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, contactKpis]);

  const filteredWidgets = useMemo(() => {
    if (!searchQuery) return CONTACT_WIDGET_DEFS;
    return CONTACT_WIDGET_DEFS.filter(w => w.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const allItems = panelTab === "kpis" ? contactKpis : CONTACT_WIDGET_DEFS;
  const activeKpiCount = contactKpis.filter((k) => !hiddenKpis.has(k.key)).length;
  const activeItemsCount = panelTab === "kpis" ? activeKpiCount : activeWidgets.length;

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
              {activeItemsCount} of {allItems.length} {panelTab === "kpis" ? "KPIs" : "widgets"} active
            </span>
            <button
              onClick={() => {
                if (panelTab === "kpis") {
                  const hidden = contactKpis.filter((k) => hiddenKpis.has(k.key));
                  const visible = contactKpis.filter((k) => !hiddenKpis.has(k.key));
                  // If everything visible → hide all; otherwise show all hidden
                  if (hidden.length === 0) visible.forEach((k) => onToggleKpi(k.key));
                  else hidden.forEach((k) => onToggleKpi(k.key));
                } else {
                  const allKeys = CONTACT_WIDGET_DEFS.map((k) => k.key);
                  const allActive = allKeys.every((k) => activeWidgets.includes(k));
                  if (allActive) activeWidgets.forEach((k) => onToggleWidget(k));
                  else allKeys.filter((k) => !activeWidgets.includes(k)).forEach((k) => onToggleWidget(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                activeItemsCount === allItems.length
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : activeItemsCount === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {activeItemsCount === allItems.length ? (
                <><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>
              ) : activeItemsCount === 0 ? (
                <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
              ) : (
                <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
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

        {/* Tab bar */}
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
              {filteredKpis.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No metrics found</p>
                </div>
              )}
              {filteredKpis.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>Contact Insights</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredKpis.map((kpi) => {
                      const isActive = !hiddenKpis.has(kpi.key);
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
                          <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>{kpi.value}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-2">
              {filteredWidgets.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No widgets found</p>
                </div>
              )}
              {filteredWidgets.length > 0 && CONTACT_WIDGET_CATEGORY_ORDER.map((cat) => {
                const inCat = filteredWidgets.filter((w) => w.category === cat);
                if (inCat.length === 0) return null;
                const CatIcon = cat === "Performance" ? Activity : cat === "Activity" ? Clock : cat === "Orders" ? Package : Sliders;
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
                            onClick={() => onToggleWidget(w.key)}
                            className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? "border-primary/30 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:shadow-sm"
                            }`}
                          >
                            <div className={`h-[68px] flex items-center justify-center transition-colors ${isActive ? "bg-[#F8FAFF]" : "bg-slate-50"}`}>
                              <WidgetTypeVisual type={w.type} isActive={isActive} />
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
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { vendors } = useVendors();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  /* Scroll-to-top on tab change — the inner scroll container holds
   * its position when the user switches tabs, which lands new tabs
   * mid-page (e.g. clicking Linked Partners after scrolling Overview
   * lands you several screens down). Mirrors the partner detail
   * surface behaviour. */
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pageScrollRef.current) {
      pageScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab]);
  const goToLinkedPartnersTab = useCallback(() => {
    setActiveTab("linked_partners");
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  // KPI drag-drop state \u2014 Satisfaction (CSAT) dropped earlier.
  // Last Active + Avg Response also dropped per BA pass: both are
  // derived from the (post-Pioneer) Communications module, so the
  // tile would render against data we don't ship yet.
  // Orders ship split by trade direction per BA pass \u2014 no aggregate
  // "Total Orders" roll-up anywhere in the module. Counts mirror the
  // Purchase Orders / Sales Orders overview widgets.
  // Trend deltas dropped per BA pass \u2014 the green \u2191% indicators read as
  // meaningless against static contact-level counts (no period baseline
  // to trend against), so KPIs ship value-only.
  const CONTACT_KPIS = [
    { key: "linked_partners", label: "Linked Partners", value: "0", icon: Link2, change: null, description: "Companies linked to this contact" },
    { key: "purchase_orders", label: "Purchase Orders", value: "18", icon: ClipboardList, change: null, description: "Purchase orders this contact is attached to" },
    { key: "sales_orders", label: "Sales Orders", value: "12", icon: Receipt, change: null, description: "Sales orders this contact is attached to" },
    { key: "email_interactions", label: "Emails Sent", value: "156", icon: Mail, change: null, description: "Total emails sent to this contact" },
  ];
  const [kpiOrder, setKpiOrder] = useState<string[]>(CONTACT_KPIS.map(k => k.key));
  const [hiddenKpis, setHiddenKpis] = useState<Set<string>>(new Set());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const moveKpi = useCallback((from: number, to: number) => {
    setKpiOrder((prev) => { const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; });
  }, []);
  const toggleKpi = useCallback((key: string) => {
    setHiddenKpis((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }, []);

  // Widget state (matches VendorDetailsPage pattern)
  const [activeWidgets, setActiveWidgets] = useState<string[]>([...DEFAULT_CONTACT_WIDGETS]);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const handleToggleWidget = useCallback((key: string) => {
    setActiveWidgets((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  const handleWidgetSizeChange = useCallback((key: string, size: "sm" | "md" | "lg") => {
    setWidgetSizes((prev) => ({ ...prev, [key]: size }));
  }, []);
  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    setActiveWidgets((prev) => { const next = [...prev]; const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved); return next; });
  }, []);
  const handleResetLayout = useCallback(() => {
    setKpiOrder(["linked_partners", "purchase_orders", "sales_orders", "email_interactions"]);
    setHiddenKpis(new Set());
    setActiveWidgets([...DEFAULT_CONTACT_WIDGETS]);
    setWidgetSizes({});
    toast.success("Layout reset to defaults");
  }, []);
  /* Reset stays grey until the overview layout diverges from its
   * defaults — mirrors the listing pages' dirty-aware reset. */
  const layoutDirty =
    kpiOrder.join(",") !== CONTACT_KPIS.map((k) => k.key).join(",") ||
    hiddenKpis.size > 0 ||
    activeWidgets.join(",") !== DEFAULT_CONTACT_WIDGETS.join(",") ||
    Object.keys(widgetSizes).length > 0;
  const [imgFailed, setImgFailed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const { openLightbox } = usePersonLightbox();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPocName, setEditPocName] = useState("");
  const [editPocDepartment, setEditPocDepartment] = useState("");
  const [editPocRole, setEditPocRole] = useState("");
  const [editPocLandline, setEditPocLandline] = useState("");
  const [editPocLandlineCode, setEditPocLandlineCode] = useState("+1");
  const [editPocExt, setEditPocExt] = useState("");
  const [editPocMobile, setEditPocMobile] = useState("");
  const [editPocMobileCode, setEditPocMobileCode] = useState("+1");
  const [editPocEmail, setEditPocEmail] = useState("");
  const [editSaveAnother, setEditSaveAnother] = useState(false);

  // Lifecycle state-change confirmation — single canonical modal that
  // covers all four flows (archive / unarchive / disable / enable),
  // matching the pattern used on PartnerGroupDetailsPage and the rest
  // of the module so confirmation chrome reads the same everywhere.
  const [pendingStateChange, setPendingStateChange] = useState<"archive" | "unarchive" | "disable" | "enable" | null>(null);
  // Local status override — the seeded contact carries a hash-derived
  // status, so we layer a local state on top to capture user actions
  // without writing back to the seed. Lets the header swap into the
  // amber/red wash and lets the menu items render the correct
  // lifecycle action without a router round-trip or context change.
  const [statusOverride, setStatusOverride] = useState<"active" | "inactive" | "archived" | null>(null);

  // Status dropdown state (matches VendorDetailsPage)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Linked Partners tab — locally-removed partner ids + pending-removal
  // confirmation. Same session-local mutation pattern as the Partner Group
  // Details page's unlinkedIds: wires to the contacts store when that
  // mutation ships.
  const [removedLinkedIds, setRemovedLinkedIds] = useState<Set<string>>(new Set());
  const [pendingRemoveLinked, setPendingRemoveLinked] = useState<{ id: string; name: string } | null>(null);

  // Email compose box
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Tags state
  const [contactTags, setContactTags] = useState<string[]>(["vendor", "key-account"]);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const MAX_TAG_COUNT = 10;
  const handleAddTag = () => {
    const v = tagInputValue.trim().toLowerCase();
    if (!v) {
      setTagInputValue("");
      setTagInputOpen(false);
      return;
    }
    if (contactTags.includes(v)) {
      toast.error(`Tag "${v}" is already on this contact`);
      setTagInputValue("");
      setTagInputOpen(false);
      return;
    }
    if (contactTags.length >= MAX_TAG_COUNT) {
      toast.error(`A contact can carry up to ${MAX_TAG_COUNT} tags. Remove one to add another.`);
      setTagInputValue("");
      setTagInputOpen(false);
      return;
    }
    setContactTags((prev) => [...prev, v]);
    toast.success(`Tag "${v}" added`);
    setTagInputValue("");
    setTagInputOpen(false);
  };
  const handleRemoveTag = (tag: string) => {
    setContactTags((prev) => prev.filter((t) => t !== tag));
    toast.success(`Tag "${tag}" removed`);
  };

  // Use real vendor names for linked partners
  const vendorNames = useMemo(() => vendors.length > 0 ? vendors.map((v) => v.displayName) : PARTNER_NAMES, [vendors]);
  const partnerNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => { map[v.displayName] = v.id; map[v.companyName] = v.id; });
    return map;
  }, [vendors]);

  const contact = useMemo(() => {
    const raw = CONTACT_DICTIONARY.find((c) => c.id === contactId);
    if (!raw) return null;
    const enriched = enrichContactWithNames(raw, vendorNames);
    // Local override (set by archive / unarchive / disable / enable
    // actions in this session) wins over the seeded status so the
    // header chrome and menu actions reflect what the user just did.
    return statusOverride ? { ...enriched, status: statusOverride } : enriched;
  }, [contactId, vendorNames, statusOverride]);

  const handleOpenEdit = () => {
    if (!contact) return;
    setEditPocName(contact.name);
    setEditPocDepartment(contact.department);
    setEditPocRole(contact.role || "");
    setEditPocEmail(contact.emails && contact.emails.length > 0 ? contact.emails[0].address : contact.email);
    const phoneList = contact.phones && contact.phones.length > 0 ? contact.phones : [{ id: "fb", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }];
    setEditPocLandline(phoneList[0].number);
    setEditPocLandlineCode(phoneList[0].code || "+1");
    setEditPocExt(phoneList[0].ext || "");
    if (phoneList.length > 1) {
      setEditPocMobile(phoneList[1].number);
      setEditPocMobileCode(phoneList[1].code || "+1");
    } else {
      setEditPocMobile(contact.secondaryPhone || "");
      setEditPocMobileCode("+1");
    }
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    toast.success(`Contact "${editPocName}" updated successfully`);
    setEditModalOpen(false);
  };

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <User className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">Contact not found.</p>
        <Button variant="outline" onClick={() => navigate("/partners/contacts")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const tint = getAvatarTint(contact.name);
  const photo = getPersonPhoto(contact.name);
  const initials = contact.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const deptStyle = DEPT_STYLES[contact.department] || DEPT_STYLES.Sales;
  const shortDept = (d: string) => d === "Supply Chain Management" ? "Supply Chain" : d;
  const departments = contact.departments || [contact.department];
  const primaryDept = departments[0];
  const extraDepts = departments.slice(1);
  const primaryDeptStyle = DEPT_STYLES[primaryDept] || DEPT_STYLES.Sales;
  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
    archived: { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", label: "Archived" },
  };
  const currentStatus = statusConfig[contact.status] || statusConfig.active;
  const sStyle = contact.status === "active"
    ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }
    : contact.status === "archived"
      ? { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" }
      : { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };

  // Multi-field data
  const phoneList: ContactPhone[] = contact.phones && contact.phones.length > 0
    ? contact.phones
    : [{ id: "p1", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }, ...(contact.secondaryPhone ? [{ id: "p2", type: "Mobile" as const, code: "+1", number: contact.secondaryPhone, ext: contact.secondaryPhoneExt || "" }] : [])];
  const emailList: ContactEmail[] = contact.emails && contact.emails.length > 0
    ? contact.emails
    : [{ id: "e1", type: "Work" as const, address: contact.email }];
  const socialList: ContactSocial[] = contact.socials || [];

  return (
    <div ref={pageScrollRef} className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Top Nav Bar — breadcrumb + search + user profile */}
      <div data-page-topbar className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button onClick={() => navigate("/partners")} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Partners Management</button>
          <span className="text-muted-foreground">/</span>
          <button onClick={() => navigate("/partners/contacts")} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Contacts Directory</button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground" style={{ fontWeight: 500 }}>{contact.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input placeholder="Search..." className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50" />
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

      {/* Sentinel */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* Sticky Header Card — VendorDetailsPage pattern */}
      <div data-page-topbar className="shrink-0 sticky top-[48px] z-20 bg-slate-50">
        <div style={{ paddingTop: isCompact ? "8px" : "12px", paddingBottom: "4px", transition: "padding 250ms ease" }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
            {/* Status-tinted vertical gradient header — same hues as the
                status pill (active → emerald, inactive → amber,
                archived → rose). Tint sits at the bottom edge and
                fades to white moving upward, matching the reference. */}
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${isCompact ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}
              style={
                contact.status === "archived"
                  ? { background: "linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FECACA" }
                  : contact.status === "inactive"
                    ? { background: "linear-gradient(to top, #FFFBEB 0%, #FFFFFF 55%, #FFFFFF 100%)", borderColor: "#FDE68A" }
                    : { background: "#FFFFFF", borderColor: "rgb(var(--border))" }
              }
            >
              {/* ─── Single morphing header — CSS transitions instead of conditional render ─── */}
              <div className="flex justify-between transition-all duration-250 ease-in-out" style={{ padding: isCompact ? "8px 16px" : "16px 20px", gap: isCompact ? 12 : 16 }}>
                {/* ═══ LEFT: Back + Avatar + Info ═══ */}
                <div className="flex items-start min-w-0 flex-1 transition-all duration-250" style={{ gap: isCompact ? 10 : 16 }}>
                  <button onClick={() => navigate("/partners/contacts")} className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] transition-all duration-250 self-start" style={{ width: isCompact ? 32 : 40, height: isCompact ? 32 : 40, marginTop: isCompact ? 0 : 4 }}>
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isCompact ? 16 : 18, height: isCompact ? 16 : 18 }} />
                  </button>
                  {/* Avatar — morphs between 110px and 36px */}
                  <button
                    type="button"
                    onClick={() => { if (photo && !imgFailed) openLightbox({ src: photo, name: contact.name, subtitle: `${contact.department} · ${contact.company}` }); }}
                    className="flex items-center justify-center shrink-0 overflow-hidden focus:outline-none transition-all duration-250"
                    style={{
                      width: isCompact ? 36 : 96,
                      height: isCompact ? 36 : 96,
                      borderRadius: isCompact ? 12 : 14,
                      border: isCompact ? "1px solid #E2E8F0" : "3px solid white",
                      boxShadow: isCompact ? "0 1px 3px rgba(0,0,0,0.04)" : "0 4px 16px -4px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
                      backgroundColor: tint.bg,
                      cursor: photo && !imgFailed ? "zoom-in" : "default",
                    }}
                  >
                    {photo && !imgFailed ? <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} /> : <span className="transition-all duration-250" style={{ fontSize: isCompact ? 12 : 30, fontWeight: 700, color: tint.fg }}>{initials}</span>}
                  </button>
                  {/* Info column */}
                  <div className="min-w-0 flex-1" style={{ paddingTop: isCompact ? 0 : 2 }}>
                    {/* Row 1: Name + Status + Primary Department + Role
                        — promotes the dept/role chips into the always-
                        on header row (they previously only lived in
                        the collapsible secondary row, so when the
                        user scrolled the page lost its read on what
                        kind of contact this is). */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-foreground truncate transition-all duration-250" style={{ fontSize: isCompact ? 14 : 17, fontWeight: isCompact ? 600 : 700, lineHeight: 1.3 }}>{contact.name}</h1>
                      <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                        <PopoverTrigger asChild>
                          <button
                            className={`inline-flex items-center rounded-full border cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border ${isCompact ? "px-1.5 py-px text-[10px] gap-0.5" : "px-2 py-0.5 text-[11px] gap-1"}`}
                            style={{ fontWeight: 500, backgroundColor: currentStatus.bg, color: currentStatus.color, borderColor: currentStatus.border }}
                          >
                            {currentStatus.label}
                            <ChevronDown className={isCompact ? "w-2.5 h-2.5" : "w-3 h-3"} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300]" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="space-y-1">
                            {(["active", "inactive"] as const).map((s) => {
                              const sc = statusConfig[s];
                              const isCurrent = s === contact.status;
                              return (
                                <button key={s} onClick={() => { if (!isCurrent) { setPendingStateChange(s === "inactive" ? "disable" : "enable"); setStatusDropdownOpen(false); } }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]" style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                                  {isCurrent && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {/* Always-on header pills — primary department +
                          role at a glance. Mirror the pill language
                          partner detail headers use (Active · Vendor ·
                          Customer); for a contact, status · department ·
                          role gives the same one-row read of who this
                          person is and where they sit. */}
                      {departments[0] && (() => {
                        const ds = DEPT_STYLES[departments[0]] || DEPT_STYLES.Sales;
                        return (
                          <span
                            className={`inline-flex items-center rounded-md border ${isCompact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
                            style={{ fontWeight: 600, backgroundColor: ds.bg, color: ds.text, borderColor: ds.border }}
                          >
                            {shortDept(departments[0])}
                          </span>
                        );
                      })()}
                      {contact.role && (
                        <span
                          className={`inline-flex items-center rounded-md border bg-slate-50 text-slate-600 border-slate-200 ${isCompact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
                          style={{ fontWeight: 500 }}
                        >
                          {contact.role}
                        </span>
                      )}
                    </div>
                    {/* Row 2: Company — primary association line.
                        Role lives as a pill next to the name already,
                        so we don't repeat it here; the company line
                        adds the partner context the pills can't carry
                        and keeps the right column from collapsing
                        against the avatar. */}
                    <p className="text-slate-500 truncate transition-all duration-250" style={{ fontSize: isCompact ? 11 : 13, marginTop: isCompact ? 1 : 6 }}>
                      {(contact.companies || [contact.company])[0]}
                    </p>
                    {/* Row 3: Tags — collapses on scroll. The Row 3
                        department-pills strip was dropped per BA pass
                        (department + role already render as pills
                        next to the name, so re-stating them below
                        read as duplicate metadata). */}
                    <div className="overflow-hidden transition-all duration-250 ease-in-out" style={{ maxHeight: isCompact ? 0 : 200, opacity: isCompact ? 0 : 1, marginTop: isCompact ? 0 : 8 }}>
                      {/* Row 4: Tags — neutral gray chips (the green/
                          purple palette read as AI-generated noise per
                          BA pass). No char limit on individual tag
                          length; hard cap at MAX_TAG_COUNT (10) tags
                          per contact. Tags wrap to a second row, and
                          beyond the visible threshold collapse into a
                          "+N more" popover that scrolls within row
                          height instead of pushing layout. */}
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {(() => {
                          const VISIBLE_TAG_LIMIT = 6;
                          const visibleTags = contactTags.slice(0, VISIBLE_TAG_LIMIT);
                          const overflowTags = contactTags.slice(VISIBLE_TAG_LIMIT);
                          return (
                            <>
                              {visibleTags.map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] group/tag bg-slate-50 text-slate-700 border-slate-200" style={{ fontWeight: 500 }}>
                                  {tag}
                                  <button onClick={() => handleRemoveTag(tag)} className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-0.5 -mr-0.5">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              {overflowTags.length > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                      style={{ fontWeight: 600 }}
                                    >
                                      +{overflowTags.length} more
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="bottom"
                                    align="start"
                                    sideOffset={6}
                                    className="w-[260px] p-2 max-h-[220px] overflow-y-auto z-[300]"
                                  >
                                    <p className="text-[10px] tracking-wide text-slate-400 mb-1.5" style={{ fontWeight: 600 }}>All Tags · {contactTags.length}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {contactTags.map((tag) => (
                                        <span key={tag} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] bg-slate-50 text-slate-700 border-slate-200" style={{ fontWeight: 500 }}>
                                          {tag}
                                          <button onClick={() => handleRemoveTag(tag)} className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-0.5 -mr-0.5">
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </>
                          );
                        })()}
                        {tagInputOpen ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              ref={tagInputRef}
                              value={tagInputValue}
                              onChange={(e) => setTagInputValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); if (e.key === "Escape") { setTagInputOpen(false); setTagInputValue(""); } }}
                              placeholder="Enter tag..."
                              className="h-6 w-[120px] px-2 text-[11px] rounded-md border border-primary/40 bg-white text-foreground placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20"
                              autoFocus
                            />
                            <button onClick={handleAddTag} className="h-6 px-2 rounded-md bg-primary text-white text-[10px] cursor-pointer hover:bg-[#086AE6] transition-colors" style={{ fontWeight: 600 }}>Save</button>
                            <button onClick={() => { setTagInputOpen(false); setTagInputValue(""); }} className="h-6 px-2 rounded-md border border-border bg-white text-slate-500 text-[10px] cursor-pointer hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancel</button>
                          </div>
                        ) : (
                          contactTags.length < MAX_TAG_COUNT && (
                            <button onClick={() => { setTagInputOpen(true); setTimeout(() => tagInputRef.current?.focus(), 50); }} className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                              <Plus className="w-3 h-3" /> Add Tag
                            </button>
                          )
                        )}
                      </div>
                    </div>{/* end collapsible wrapper */}
                  </div>
                </div>

                {/* ═══ RIGHT: CTAs + contact data ═══ */}
                <div className="shrink-0 flex flex-col items-end justify-between self-stretch">
                  {/* CTAs — always visible */}
                  <div className="flex items-center transition-all duration-250" style={{ gap: isCompact ? 6 : 8 }}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => setIsFullscreen(!isFullscreen)} className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250" style={{ width: isCompact ? 32 : 36, height: isCompact ? 32 : 36 }}>
                          {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-500" /> : <Maximize2 className="w-4 h-4 text-slate-500" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[300]">{isFullscreen ? "Exit Full Screen" : "Full Screen"}</TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-250 ${isCompact ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"}`} style={{ fontWeight: 500 }}>Actions <ChevronDown className="w-3.5 h-3.5 text-slate-400" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[210px]">
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(appHref()); toast.success("Link copied"); }}><Link2 className="w-4 h-4 mr-2" /> Copy Link</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Canonical lifecycle set: Mark as Active /
                            Mark as Inactive / Archive / Unarchive,
                            swapping per current status. */}
                        {contact.status === "active" && (
                          <DropdownMenuItem className="focus:bg-amber-50" style={{ color: "#B45309" }} onClick={() => setPendingStateChange("disable")}>
                            <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} /> Mark as Inactive
                          </DropdownMenuItem>
                        )}
                        {contact.status === "inactive" && (
                          <DropdownMenuItem className="focus:bg-emerald-50" style={{ color: "#059669" }} onClick={() => setPendingStateChange("enable")}>
                            <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Mark as Active
                          </DropdownMenuItem>
                        )}
                        {contact.status === "archived" ? (
                          <DropdownMenuItem className="focus:bg-emerald-50" style={{ color: "#059669" }} onClick={() => setPendingStateChange("unarchive")}>
                            <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Unarchive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setPendingStateChange("archive")}><Archive className="w-4 h-4 mr-2 text-destructive" /> Archive</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={handleOpenEdit} className={`rounded-lg bg-primary hover:bg-[#086AE6] text-white inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-250 ${isCompact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`} style={{ fontWeight: 600 }}><Pencil className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} /> Edit Contact</button>
                  </div>
                  {/* Contact data — collapses on scroll */}
                  <div className="overflow-hidden transition-all duration-250 ease-in-out hidden md:block" style={{ maxHeight: isCompact ? 0 : 120, opacity: isCompact ? 0 : 1 }}>
                    <div className="flex flex-col gap-2 items-end pt-2">
                      {/* Socials — icon-only buttons with brand color
                          on hover; tooltip names the platform. Mapping
                          is shared with the Users detail page in
                          Company Setup so the icon set reads as one
                          canonical primitive. Antonio maintains the
                          authoritative list — sync any additions
                          here.
                          ──────── Social icon mapping ────────
                          linkedin     → Linkedin
                          twitter / x  → Twitter
                          facebook     → Facebook
                          instagram    → Instagram
                          youtube      → Youtube
                          website      → Globe
                          whatsapp     → MessageCircle (green)
                          skype        → MessageCircle (cyan)
                          other        → ExternalLink (fallback)
                          ────────────────────────────────────── */}
                      {socialList.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {socialList.map((s) => {
                            const socialMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
                              "LinkedIn": { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
                              "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
                              "Facebook": { icon: Facebook, color: "#1877F2", label: "Facebook" },
                              "Instagram": { icon: Instagram, color: "#E4405F", label: "Instagram" },
                              "YouTube": { icon: Youtube, color: "#FF0000", label: "YouTube" },
                              "Website": { icon: Globe, color: "rgb(var(--primary))", label: "Website" },
                              "Skype": { icon: MessageCircle, color: "#00AFF0", label: "Skype" },
                              "WhatsApp": { icon: MessageCircle, color: "#25D366", label: "WhatsApp" },
                              "Other": { icon: ExternalLink, color: "#64748B", label: "Link" },
                            };
                            const meta = socialMeta[s.type] || socialMeta.Other;
                            const SIcon = meta.icon;
                            return (
                              <Tooltip key={s.id}>
                                <TooltipTrigger asChild>
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="group/social relative w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted transition-all">
                                    <SIcon className="w-3.5 h-3.5 text-slate-400 group-hover/social:opacity-0 transition-opacity" />
                                    <SIcon className="w-3.5 h-3.5 absolute opacity-0 group-hover/social:opacity-100 transition-opacity" style={{ color: meta.color }} />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="z-[300]"><span className="text-[11px]">{meta.label}</span></TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                      {/* Email */}
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <button onClick={() => { setComposeTo(emailList[0].address); setComposeSubject(""); setComposeBody(""); setComposeOpen(true); setComposeMinimized(false); }} className="text-[12px] text-slate-700 hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 truncate max-w-[220px]" style={{ fontWeight: 500 }}>{emailList[0].address}</button>
                        {emailList.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] shrink-0 cursor-default" style={{ fontWeight: 600, color: "#085FCC" }}>+{emailList.length - 1} more</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="end" className="z-[300] max-w-[320px] p-1">
                              <div className="space-y-0.5">
                                {emailList.map((e) => (
                                  <a key={e.id} href={`mailto:${e.address}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                                    <span className="text-[10px] text-slate-400 shrink-0 min-w-[52px]" style={{ fontWeight: 500 }}>{e.type}</span>
                                    <span className="text-[11px] text-slate-700 hover:text-primary transition-colors">{e.address}</span>
                                  </a>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {/* Phone */}
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{phoneList[0].code} {phoneList[0].number}{phoneList[0].ext ? ` ext. ${phoneList[0].ext}` : ""}</span>
                        {phoneList.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] shrink-0 cursor-default" style={{ fontWeight: 600, color: "#085FCC" }}>+{phoneList.length - 1} more</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="end" className="z-[300] max-w-[300px] p-1">
                              <div className="space-y-0.5">
                                {phoneList.slice(1).map((p) => (
                                  <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-default">
                                    <span className="text-[10px] text-slate-400 shrink-0 min-w-[42px]" style={{ fontWeight: 500 }}>{p.type}</span>
                                    <span className="text-[11px] text-slate-700">{p.code} {p.number}{p.ext ? ` ext. ${p.ext}` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>{/* end contact data collapsible */}
                </div>
              </div>

              {/* Tab bar — icons + labels */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                      }`}
                      style={{
                        padding: isCompact ? "7px 12px" : "9px 12px",
                        fontSize: isCompact ? 12 : 12.5,
                        fontWeight: isActive ? 600 : 500,
                        transition: "padding 250ms ease, font-size 250ms ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none transition-opacity duration-300" style={{ height: 8, background: "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)", opacity: isCompact ? 1 : 0 }} />
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`mx-auto w-full px-3 pt-2 pb-3 flex-1 flex flex-col min-h-0 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
          {activeTab === "overview" && (
            <ContactOverviewTab
              contact={contact}
              sStyle={sStyle}
              partnerNameToId={partnerNameToId}
              kpiOrder={kpiOrder}
              hiddenKpis={hiddenKpis}
              moveKpi={moveKpi}
              toggleKpi={toggleKpi}
              CONTACT_KPIS={CONTACT_KPIS}
              activeWidgets={activeWidgets}
              widgetSizes={widgetSizes}
              onWidgetSizeChange={handleWidgetSizeChange}
              onRemoveWidget={handleToggleWidget}
              moveWidget={moveWidget}
              setCustomizeOpen={setCustomizeOpen}
              onResetLayout={handleResetLayout}
              layoutDirty={layoutDirty}
            />
          )}



          {activeTab === "linked_partners" && (() => {
            // Filter the full vendors list down to those linked to this contact (case-insensitive name match against displayName / companyName)
            const linkedNames = new Set(contact.linkedPartners.map(n => n.trim().toLowerCase()));
            const linkedVendors = vendors.filter(v =>
              !removedLinkedIds.has(v.id) && (
                linkedNames.has(v.displayName.trim().toLowerCase()) ||
                linkedNames.has(v.companyName.trim().toLowerCase())
              )
            );
            // Trimmed default column visibility for the sub-tab — all columns remain available via the column selector
            const linkedPartnersDefaultVisibility: Record<string, boolean> = {
              partner_name: true,
              partner_type: true,
              vendor_sub_types: true,
              customer_sub_types: true,
              num_items: false,
              partner_locations: false,
              global_contacts: true,
              partner_group: true,
              net_profit: false,
              credit_limit: false,
              credit_utilization: false,
              services: false,
              carrier_vendor: false,
              carrier_customer: false,
              country: true,
              website: false,
              email: true,
              last_updated_by: false,
              last_updated_on: false,
              created_by: false,
              created_on: false,
              status: true,
            };
            return (
              <VendorsListPage
                embedded
                embeddedVendors={linkedVendors}
                embeddedDefaultColumnVisibility={linkedPartnersDefaultVisibility}
                embeddedDefaultDensity="card"
                embeddedHideArchivedFilter
                embeddedRowActionsExclusive={(vendor) => (
                  /* Contact-scoped row menu — every density shows exactly two
                     actions: open the partner, or detach it from this POC
                     (with a confirmation prompt before anything changes). */
                  <>
                    <DropdownMenuItem onClick={() => window.open(`/vendors/${vendor.id}`, "_blank", "noopener")}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Partner Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="focus:bg-red-50"
                      onClick={() => setPendingRemoveLinked({ id: vendor.id, name: vendor.displayName || vendor.companyName })}
                    >
                      <Unlink2 className="w-4 h-4 mr-2 text-destructive" />
                      Remove Partner from This POC
                    </DropdownMenuItem>
                  </>
                )}
              />
            );
          })()}

          {activeTab === "linked_entities" && (
            <LinkedEntitiesTab contactName={contact.name} />
          )}

          {activeTab === "communications" && (
            <ContactPlaceholderTab
              label="Communications"
              description="Email, call, and message history will appear here once the Communications module is enabled for your workspace."
              icon={MessageSquare}
            />
          )}

          {activeTab === "notes" && (
            <ContactPlaceholderTab
              label="Notes"
              description="Internal notes and comments will live here once the Notes module ships. Mention teammates, leave context, and keep a thread of decisions on this contact."
              icon={StickyNote}
            />
          )}
          {activeTab === "attachments" && <AttachmentsTab />}
          {activeTab === "activity" && <ActivityTab />}
        </div>
      </div>

      {/* Edit Contact Modal */}
      <CreatePocModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        editMode
        editContactName={contact.name}
        editContact={CONTACT_DICTIONARY.find(c => c.id === contactId) || null}
        newPocName={editPocName}
        onNewPocNameChange={setEditPocName}
        newPocDepartment={editPocDepartment}
        onNewPocDepartmentChange={setEditPocDepartment}
        newPocRole={editPocRole}
        onNewPocRoleChange={setEditPocRole}
        newPocLandline={editPocLandline}
        onNewPocLandlineChange={setEditPocLandline}
        newPocLandlineCode={editPocLandlineCode}
        onNewPocLandlineCodeChange={setEditPocLandlineCode}
        newPocExt={editPocExt}
        onNewPocExtChange={setEditPocExt}
        newPocMobile={editPocMobile}
        onNewPocMobileChange={setEditPocMobile}
        newPocMobileCode={editPocMobileCode}
        onNewPocMobileCodeChange={setEditPocMobileCode}
        newPocEmail={editPocEmail}
        onNewPocEmailChange={setEditPocEmail}
        saveAndCreateAnother={editSaveAnother}
        onSaveAndCreateAnotherChange={setEditSaveAnother}
        onSave={handleSaveEdit}
      />

      {/* Customize Widgets Panel — rendered at root level for correct overlay alignment */}
      {activeTab === "overview" && (
        <ContactCustomizePanel
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          contactKpis={CONTACT_KPIS.map((k) => ({
            key: k.key,
            label: k.label,
            value: k.key === "linked_partners" ? String(contact.linkedPartners.length) : k.value,
            icon: k.icon,
            description: k.description,
          }))}
          hiddenKpis={hiddenKpis}
          onToggleKpi={toggleKpi}
          activeWidgets={activeWidgets}
          onToggleWidget={handleToggleWidget}
          widgetSizes={widgetSizes}
          onWidgetSizeChange={handleWidgetSizeChange}
        />
      )}

      {/* Canonical lifecycle confirmation modal — same shape as the
          PartnerGroupDetailsPage version (gradient header, glow + icon
          disk, uppercase chip, state-coded CTA). One modal handles all
          four flows (archive / unarchive / disable / enable). On
          confirm, the local statusOverride is updated so the header
          flips into the right wash and the menu actions reshuffle —
          the user stays on the contact detail page. */}
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
              ? `Unarchive ${contact.name}?`
              : isEnable
                ? `Mark ${contact.name} as Active?`
                : isArchive
                  ? `Archive ${contact.name}?`
                  : `Mark ${contact.name} as Inactive?`;
            const desc = isUnarchive
              ? <>The contact goes back to Active and reappears in default listings and pickers. Linked partners and assignments are unaffected.</>
              : isEnable
                ? <>The contact goes back to Active. They reappear in default listings and pickers and become available for new assignments.</>
                : isArchive
                  ? <>This contact is removed from active listings. Existing assignments and history stay intact, and the contact can be restored from the archive at any time.</>
                  : <>This contact stops appearing in pickers and is excluded from new assignments. Existing assignments stay exactly as-is. Re-activate from the header CTA when you're ready.</>;
            const primaryLabel = isUnarchive
              ? "Unarchive Contact"
              : isEnable
                ? "Mark as Active"
                : isArchive
                  ? "Archive Contact"
                  : "Mark as Inactive";
            const cancelLabel = isUnarchive ? "Keep Archived" : isEnable ? "Keep Inactive" : "Keep Active";
            const toastLine = isUnarchive
              ? `${contact.name} unarchived.`
              : isEnable
                ? `${contact.name} marked as Active.`
                : isArchive
                  ? `${contact.name} archived.`
                  : `${contact.name} marked as Inactive.`;
            const nextStatus: "active" | "inactive" | "archived" = isUnarchive || isEnable
              ? "active"
              : isArchive
                ? "archived"
                : "inactive";
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
                        // Persist the new status locally so the header
                        // flips into the right wash and the menu items
                        // reshuffle. NO redirect — the user stays on
                        // the detail page so they see the state change
                        // in context.
                        setStatusOverride(nextStatus);
                        toast.success(toastLine);
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

      {/* Remove-partner-from-POC confirmation. Same destructive-tone
          treatment as the Partner Group "Unlink from group" prompt so the
          detach primitive reads identically across surfaces. Only the
          contact↔partner association is removed — the partner record
          itself is untouched. */}
      <AlertDialog open={!!pendingRemoveLinked} onOpenChange={(open) => { if (!open) setPendingRemoveLinked(null); }}>
        <AlertDialogContent
          className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setPendingRemoveLinked(null)}
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Unlink2 className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}
            >
              Remove
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                {`Remove ${pendingRemoveLinked?.name ?? "this partner"} from ${contact.name}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
              Only the link between this partner and {contact.name} is removed, the partner record, its locations, transactions, and other contacts all stay exactly as-is. {contact.name} will simply no longer appear as a point of contact for {pendingRemoveLinked?.name ?? "this partner"}.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (pendingRemoveLinked) {
                    setRemovedLinkedIds((prev) => {
                      const next = new Set(prev);
                      next.add(pendingRemoveLinked.id);
                      return next;
                    });
                    toast.success(`${pendingRemoveLinked.name} removed from ${contact.name}.`);
                  }
                  setPendingRemoveLinked(null);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                Remove Partner
              </button>
              <button
                onClick={() => setPendingRemoveLinked(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
              >
                Keep Linked
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>


      {/* ── Gmail-style Compose Email Box ── */}
      {composeOpen && (
        <div
          className="fixed z-[400] transition-all duration-200 ease-out"
          style={{
            bottom: 0,
            right: 24,
            width: composeMinimized ? 280 : 420,
            boxShadow: "0 -4px 24px -6px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
          }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-4 h-10 cursor-pointer select-none"
            style={{ backgroundColor: "#1E293B" }}
            onClick={() => setComposeMinimized(!composeMinimized)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="text-[13px] text-white truncate" style={{ fontWeight: 600 }}>
                {composeMinimized ? `To: ${composeTo}` : "New Message"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setComposeMinimized(!composeMinimized); }}
                className="w-6 h-6 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {composeMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setComposeOpen(false); }}
                className="w-6 h-6 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Body — hidden when minimized */}
          <div
            className="bg-white overflow-hidden transition-all duration-200 ease-out"
            style={{ maxHeight: composeMinimized ? 0 : 340, opacity: composeMinimized ? 0 : 1 }}
          >
            {/* To */}
            <div className="flex items-center border-b border-muted px-4 h-9">
              <span className="text-[12px] text-slate-400 shrink-0 w-8" style={{ fontWeight: 500 }}>To</span>
              <input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="flex-1 text-[13px] text-slate-700 bg-transparent border-0 outline-none placeholder:text-slate-300"
                placeholder="recipient@email.com"
              />
            </div>
            {/* Subject */}
            <div className="flex items-center border-b border-muted px-4 h-9">
              <span className="text-[12px] text-slate-400 shrink-0 w-8" style={{ fontWeight: 500 }}>Sub</span>
              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="flex-1 text-[13px] text-slate-700 bg-transparent border-0 outline-none placeholder:text-slate-300"
                placeholder="Subject"
              />
            </div>
            {/* Body */}
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="w-full h-[180px] px-4 py-3 text-[13px] text-slate-700 bg-transparent border-0 outline-none resize-none placeholder:text-slate-300"
              placeholder="Write your message..."
            />
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-muted">
              <button
                onClick={() => { toast.success(`Email sent to ${composeTo}`); setComposeOpen(false); }}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[13px] transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
              <button
                onClick={() => setComposeOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Contact Overview Tab (with draggable, resizable widgets) ─── */
function ContactOverviewTab({ contact, sStyle, partnerNameToId, kpiOrder, hiddenKpis, moveKpi, toggleKpi, CONTACT_KPIS, activeWidgets, widgetSizes, onWidgetSizeChange, onRemoveWidget, moveWidget, setCustomizeOpen, onResetLayout, layoutDirty }: {
  contact: EnrichedContact;
  sStyle: { bg: string; text: string; border: string };
  partnerNameToId: Record<string, string>;
  kpiOrder: string[];
  hiddenKpis: Set<string>;
  moveKpi: (from: number, to: number) => void;
  toggleKpi: (key: string) => void;
  CONTACT_KPIS: { key: string; label: string; value: string; icon: React.ElementType; change: string | null }[];
  activeWidgets: string[];
  widgetSizes: Record<string, "sm" | "md" | "lg">;
  onWidgetSizeChange: (key: string, size: "sm" | "md" | "lg") => void;
  /** Remove this widget from the overview — same effect as toggling it off in
   *  the Customize Widgets panel, so the action is reversible. */
  onRemoveWidget: (key: string) => void;
  moveWidget: (from: number, to: number) => void;
  setCustomizeOpen: (open: boolean) => void;
  onResetLayout: () => void;
  layoutDirty: boolean;
}) {
  /* Overview date-range — shared invoicing control (visual scope for the
   * seeded demo data; wires to the real feed with the analytics push). */
  const [overviewRange, setOverviewRange] = useState<InsightsRange>("last_30");
  const [overviewCustom, setOverviewCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const CH: Record<string, number> = { sm: 140, md: 200, lg: 280 };

  const statRow = (stats: { label: string; value: string; color?: string }[], compact?: boolean) => (
    <div className={`flex items-center ${compact ? "gap-3 mt-1.5 pt-1.5" : "gap-4 mt-2 pt-2"} border-t border-muted`}>
      {stats.map((s, i) => (
        <div key={i}>
          <p className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-400`} style={{ fontWeight: 500 }}>{s.label}</p>
          <p className={compact ? "text-[11px]" : "text-[13px]"} style={{ fontWeight: 700, color: s.color || "#334155" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );

  /* Build widget nodes — every widget uses the same fixed height per size */
  const renderWidgetContent = (wKey: string, sz: "sm" | "md" | "lg") => {
    const h = CH[sz];
    const isSmall = sz === "sm";

    const ttStyle = { borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 };

    const widgetBody = (() => {
    switch (wKey) {
      case "interaction_activity": {
        const barData = [
          { day: "Mon", emails: 3, calls: 1 },
          { day: "Tue", emails: 7, calls: 3 },
          { day: "Wed", emails: 5, calls: 2 },
          { day: "Thu", emails: 8, calls: 4 },
          { day: "Fri", emails: 4, calls: 2 },
          { day: "Sat", emails: 1, calls: 0 },
          { day: "Sun", emails: 2, calls: 1 },
        ];
        return (
          <>
            <div className="flex-1 min-h-0 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: isSmall ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  {!isSmall && <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />}
                  <ReTooltip contentStyle={ttStyle} cursor={{ fill: "rgba(10,119,255,0.04)" }} />
                  <Bar dataKey="emails" name="Emails" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} barSize={isSmall ? 14 : 24} />
                  <Bar dataKey="calls" name="Calls" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={isSmall ? 14 : 24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="shrink-0">
              {statRow([
                { label: "Total Emails", value: "30" },
                { label: "Total Calls", value: "13" },
                ...(!isSmall ? [{ label: "Avg/Day", value: "6.1" }] : []),
              ], isSmall)}
            </div>
          </>
        );
      }

      case "communication_trend": {
        const trendData = [
          { month: "Jan", value: 12 }, { month: "Feb", value: 18 }, { month: "Mar", value: 22 },
          { month: "Apr", value: 28 }, { month: "May", value: 32 }, { month: "Jun", value: 26 },
          { month: "Jul", value: 30 }, { month: "Aug", value: 35 }, { month: "Sep", value: 38 },
          { month: "Oct", value: 42 }, { month: "Nov", value: 34 }, { month: "Dec", value: 45 },
        ];
        return (
          <>
            <div className="flex-1 min-h-0 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="ctAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--muted))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: isSmall ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  {!isSmall && <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />}
                  <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}`, "Interactions"]} />
                  <Area type="monotone" dataKey="value" name="Interactions" stroke="rgb(var(--primary))" strokeWidth={2} fill="url(#ctAreaGrad)" dot={false} activeDot={{ r: 4, fill: "rgb(var(--primary))", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="shrink-0">
              {statRow([
                { label: "YTD Total", value: "342" },
                { label: "Monthly Avg", value: "28.5" },
                ...(!isSmall ? [{ label: "Peak Month", value: "Dec" }] : []),
              ], isSmall)}
            </div>
          </>
        );
      }

      case "purchase_orders": {
        const pos = [
          { id: "PO-3021", vendor: "Acme Corp", amount: "$18,500", status: "Approved", date: "Mar 28, 2026" },
          { id: "PO-2984", vendor: "TechVault", amount: "$7,200", status: "Pending", date: "Mar 22, 2026" },
          { id: "PO-2951", vendor: "NexGen Solutions", amount: "$34,800", status: "Delivered", date: "Mar 15, 2026" },
          { id: "PO-2913", vendor: "Apex Industries", amount: "$12,100", status: "Delivered", date: "Mar 08, 2026" },
          { id: "PO-2887", vendor: "Summit Group", amount: "$5,600", status: "Approved", date: "Feb 28, 2026" },
          { id: "PO-2845", vendor: "Vertex Labs", amount: "$22,400", status: "Delivered", date: "Feb 20, 2026" },
        ];
        // Pioneer scope: only the 3 most recent POs surface in the
        // widget — anything older lives one click away in the
        // Linked Entities tab.
        return (
          <>
            <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
              {pos.slice(0, 3).map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{o.id} &middot; {o.vendor}</p>
                    {!isSmall && <p className="text-[10px] text-slate-400 mt-0.5">{o.date}</p>}
                  </div>
                  <span className="text-[11px] text-slate-700 shrink-0" style={{ fontWeight: 600 }}>{o.amount}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${
                    o.status === "Delivered" ? "bg-green-50 text-[#166534]" :
                    o.status === "Approved" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"
                  }`} style={{ fontWeight: 500 }}>{o.status}</span>
                </div>
              ))}
            </div>
            <div className="shrink-0">{statRow([
              { label: "Total POs", value: "18" },
              { label: "Total Value", value: "$186.2K" },
              ...(!isSmall ? [{ label: "Pending", value: "3", color: "rgb(var(--warning))" }] : []),
            ], isSmall)}</div>
          </>
        );
      }

      case "sales_orders": {
        const sos = [
          { id: "SO-1102", customer: "Acme Corp", amount: "$9,800", status: "Fulfilled", date: "Mar 26, 2026" },
          { id: "SO-1089", customer: "Pioneer Systems", amount: "$15,300", status: "Processing", date: "Mar 20, 2026" },
          { id: "SO-1074", customer: "Atlas Logistics", amount: "$6,400", status: "Fulfilled", date: "Mar 14, 2026" },
          { id: "SO-1058", customer: "Beacon Analytics", amount: "$28,700", status: "Shipped", date: "Mar 08, 2026" },
          { id: "SO-1041", customer: "Cascade Networks", amount: "$11,200", status: "Fulfilled", date: "Feb 28, 2026" },
          { id: "SO-1029", customer: "Delta Mfg", amount: "$4,500", status: "Fulfilled", date: "Feb 22, 2026" },
        ];
        // Pioneer scope: only the 3 most recent SOs where this
        // contact is the primary POC. We don't have a poc.isPrimary
        // flag on the mock data yet — treat the first 3 of the
        // seeded list as primary until the model lands.
        return (
          <>
            <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
              {sos.slice(0, 3).map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center shrink-0">
                    <Receipt className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{o.id} &middot; {o.customer}</p>
                    {!isSmall && <p className="text-[10px] text-slate-400 mt-0.5">{o.date}</p>}
                  </div>
                  <span className="text-[11px] text-slate-700 shrink-0" style={{ fontWeight: 600 }}>{o.amount}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${
                    o.status === "Fulfilled" ? "bg-green-50 text-[#166534]" :
                    o.status === "Shipped" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"
                  }`} style={{ fontWeight: 500 }}>{o.status}</span>
                </div>
              ))}
            </div>
            <div className="shrink-0">{statRow([
              { label: "Total SOs", value: "12" },
              { label: "Revenue", value: "$142.8K" },
              ...(!isSmall ? [{ label: "Processing", value: "2", color: "rgb(var(--warning))" }] : []),
            ], isSmall)}</div>
          </>
        );
      }

      case "activity_timeline":
        return (
          <div className="space-y-2.5 flex-1 min-h-0 overflow-hidden">
            {ACTIVITY_LOG.slice(0, isSmall ? 3 : sz === "lg" ? 6 : 4).map((e) => (
              <div key={e.id} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  {e.icon === "create" ? <User className="w-3 h-3 text-primary" /> : e.icon === "link" ? <Link2 className="w-3 h-3 text-violet" /> : <Pencil className="w-3 h-3 text-amber-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{e.action}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{!isSmall ? `${e.user} \u00B7 ` : ""}{formatDate(e.date)}</p>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return <p className="text-[12px] text-slate-400">Widget content</p>;
    }
    })();

    // Wrap every widget in a fixed-height flex column so all cards match at same size
    return (
      <div className="flex flex-col" style={{ height: h }}>
        {widgetBody}
      </div>
    );
  };

  const getWidgetIcon = (key: string): React.ElementType => {
    const map: Record<string, React.ElementType> = {
      interaction_activity: BarChart3,
      communication_trend: TrendingUp,
      purchase_orders: ShoppingCart,
      sales_orders: Receipt,
      activity_timeline: Activity,
    };
    return map[key] || Info;
  };

  const getWidgetTitle = (key: string): string => {
    return CONTACT_WIDGET_DEFS.find(w => w.key === key)?.label || key;
  };

  /* Build layout — flex wrap: each widget width depends on its own size */
  const getWidgetWidth = (sz: "sm" | "md" | "lg", defaultSpan: "full" | "half"): string => {
    if (sz === "sm") return "calc(50% - 6px)";
    if (sz === "lg") return "100%";
    // medium — use the widget's default span
    return defaultSpan === "full" ? "100%" : "calc(50% - 6px)";
  };

  return (
    <div className="space-y-4">
      {/* Header bar — mb-2.5 to the KPI strip matches the listing pages' insights gap */}
      <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Overview</span>
          {/* Date Range Filter — shared invoicing control (incl. All time + Custom) */}
          <InsightsRangeMenu
            range={overviewRange}
            onRangeChange={setOverviewRange}
            customFrom={overviewCustom.from}
            customTo={overviewCustom.to}
            onCustomChange={(from, to) => setOverviewCustom({ from, to })}
          />
          <InsightsRefresh />
        </div>
        <div className="flex items-center gap-2">
          <InsightsResetButton dirty={layoutDirty} onReset={onResetLayout} />
          <button
            className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
            onClick={() => setCustomizeOpen(true)}
          >
            <Sliders className="w-3 h-3" /> Customize Widgets
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <DndProvider backend={HTML5Backend}>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
          {kpiOrder.filter(k => !hiddenKpis.has(k)).map((key, idx) => {
            const kpi = CONTACT_KPIS.find(k => k.key === key);
            if (!kpi) return null;
            const v = kpi.key === "linked_partners" ? String(contact.linkedPartners.length) : kpi.value;
            return <DraggableContactKpi key={kpi.key} index={idx} kpiKey={kpi.key} label={kpi.label} value={v} icon={kpi.icon} change={kpi.change} moveCard={moveKpi} onRemove={() => toggleKpi(kpi.key)} />;
          })}
        </div>
      </DndProvider>
      </div>

      {/* Two-column layout: Widgets (left) + Sidebar (right) */}
      <div className="flex gap-5 items-start">
        {/* ── LEFT: Widgets ── */}
        <div className="flex-1 min-w-0">
          <DndProvider backend={HTML5Backend}>
            <WidgetGridDropZone moveWidget={moveWidget} activeCount={activeWidgets.length}>
              {activeWidgets.map((wKey, wIdx) => {
                const sz = widgetSizes[wKey] || "md";
                const defaultSpan = CONTACT_WIDGET_DEFAULT_SPANS[wKey] || "half";
                const width = getWidgetWidth(sz, defaultSpan);
                return (
                  <div key={wKey} style={{ width }} className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    <DraggableContactWidget widgetKey={wKey} index={wIdx} moveWidget={moveWidget}>
                      {(dragging, over) => (
                        <ContactContentCard
                          title={getWidgetTitle(wKey)}
                          icon={getWidgetIcon(wKey)}
                          currentSize={sz}
                          onSizeChange={(s) => onWidgetSizeChange(wKey, s)}
                          onRemove={() => onRemoveWidget(wKey)}
                          isDragging={dragging}
                          isOver={over}
                        >
                          {renderWidgetContent(wKey, sz)}
                        </ContactContentCard>
                      )}
                    </DraggableContactWidget>
                  </div>
                );
              })}
            </WidgetGridDropZone>
          </DndProvider>
        </div>

        {/* ── RIGHT: Sidebar — all data lives here ── */}
        <div className="w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4">
          {/* Contact Information — matches Partner Information layout.
              Company / Department / Role are wired against single-
              value placeholder fields; the real multi-partner /
              multi-department model lands post-Pioneer. */}
          <ContactSidebarCard title="Contact Information" icon={User}>
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-500 border border-slate-200" style={{ fontWeight: 500 }}>
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                Company · Department · Role, captured post-Pioneer
              </div>
              {/* Company — full width */}
              <div className="mb-3">
                <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Company</p>
                <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{contact.company}</p>
              </div>
              {/* Department + Role — 2-col grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Department</p>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{contact.department}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Role</p>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{contact.role || `${contact.department} Rep`}</p>
                </div>
              </div>
              {/* Phone + Secondary — 2-col grid */}
              {(() => {
                const phones: ContactPhone[] = contact.phones && contact.phones.length > 0
                  ? contact.phones
                  : [{ id: "p1", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }, ...(contact.secondaryPhone ? [{ id: "p2", type: "Mobile" as const, code: "+1", number: contact.secondaryPhone, ext: contact.secondaryPhoneExt || "" }] : [])];
                const emails: ContactEmail[] = contact.emails && contact.emails.length > 0
                  ? contact.emails
                  : [{ id: "e1", type: "Work" as const, address: contact.email }];
                return (
                  <>
                    {/* Phone — clubbed to one line + "+N more"
                        tooltip, mirroring the email pattern below
                        and the header's email/phone treatments. Two
                        side-by-side phone columns read as duplicate
                        addresses; one canonical line with overflow
                        scales cleanly as the data model accepts more
                        types. */}
                    <div className="mb-3">
                      <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Phone</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
                          {phones[0].code} {phones[0].number}{phones[0].ext ? ` ext. ${phones[0].ext}` : ""}
                        </span>
                        {phones.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] shrink-0 cursor-default" style={{ fontWeight: 600, color: "#085FCC" }}>+{phones.length - 1} more</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="z-[300] max-w-[300px] p-1">
                              <div className="space-y-0.5">
                                {phones.slice(1).map((p) => (
                                  <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-default">
                                    <span className="text-[10px] text-slate-400 shrink-0 min-w-[42px]" style={{ fontWeight: 500 }}>{p.type}</span>
                                    <span className="text-[11px] text-slate-700">{p.code} {p.number}{p.ext ? ` ext. ${p.ext}` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    {/* Email — full width */}
                    <div className="mb-3">
                      <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Email</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a href={`mailto:${emails[0].address}`} className="text-[12px] text-primary hover:underline break-all" style={{ fontWeight: 500 }}>{emails[0].address}</a>
                        {emails.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] shrink-0 cursor-default" style={{ fontWeight: 600, color: "#085FCC" }}>+{emails.length - 1} more</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="z-[300] max-w-[320px] p-1">
                              <div className="space-y-0.5">
                                {emails.slice(1).map((e) => (
                                  <a key={e.id} href={`mailto:${e.address}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
                                    <span className="text-[10px] text-slate-400 shrink-0 min-w-[52px]" style={{ fontWeight: 500 }}>{e.type}</span>
                                    <span className="text-[11px] text-slate-700 hover:text-primary transition-colors">{e.address}</span>
                                  </a>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
              {/* Status + Last Active — 2-col grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Status</p>
                  <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full border" style={{ fontWeight: 500, backgroundColor: sStyle.bg, color: sStyle.text, borderColor: sStyle.border }}>
                    {contact.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Last Active</p>
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>Mar 01, 2026</p>
                </div>
              </div>
              {/* Created By + Created On — 2-col at bottom with separator */}
              <div className="pt-2.5 mt-1 border-t border-muted">
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Created By</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: "rgb(var(--primary))", fontWeight: 600 }}>
                        {contact.createdByInitials}
                      </div>
                      <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{contact.createdByName}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Created On</p>
                    <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{contact.createdOn}</p>
                  </div>
                </div>
              </div>
            </div>
          </ContactSidebarCard>

          {/* Quick Stats — Pioneer scope: orders split by trade
              direction (no Total Orders roll-up per BA pass), Emails
              Sent, Open POs. Avg Response dropped (Communications
              module derives it; ships post-Pioneer). */}
          <ContactSidebarCard title="Quick Stats" icon={BarChart3}>
            <div className="grid grid-cols-2 gap-2.5">
              <ContactStatBox label="Purchase Orders" value="18" icon={ClipboardList} />
              <ContactStatBox label="Sales Orders" value="12" icon={Receipt} />
              <ContactStatBox label="Emails Sent" value="156" icon={Mail} color="rgb(var(--primary))" />
              <ContactStatBox label="Open POs" value="7" icon={ClipboardList} color="rgb(var(--violet))" />
            </div>
          </ContactSidebarCard>

          {/* Linked Partners — sidebar preview of partners where this
              contact is a POC. Capped at 5 rows in the card; the
              real total drives the See all CTA, which jumps the user
              to the full Linked Partners tab. */}
          <ContactSidebarCard
            title="POC for Partners"
            icon={Link2}
            count={contact.linkedPartners.length}
          >
            <div className="space-y-2">
              {contact.linkedPartners.slice(0, 5).map((partner, idx) => {
                const pTint = getAvatarTint(partner);
                const pI = partner.split(" ").filter(Boolean).map((w) => w[0]).slice(0,2).join("").toUpperCase();
                const pId = partnerNameToId[partner];
                return (
                  <div key={idx} className={"flex items-center gap-2.5 " + (pId ? "cursor-pointer" : "")} onClick={() => { if (pId) window.open("/vendors/" + pId, "_blank"); }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] shrink-0" style={{ backgroundColor: pTint.bg, color: pTint.fg, fontWeight: 700 }}>
                      {pI}
                    </div>
                    <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{partner}</span>
                    {idx === 0 && (
                      <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent ml-auto shrink-0" style={{ fontWeight: 600 }}>PRIMARY</span>
                    )}
                  </div>
                );
              })}
              {/* See all CTA — only when the linked-partner count
                  exceeds what the card displays. Clicking jumps to
                  the Linked Partners tab + scrolls the page to top
                  so the user lands on the table header. */}
              {contact.linkedPartners.length > 5 && (
                <button
                  type="button"
                  onClick={goToLinkedPartnersTab}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:text-[#086AE6] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  See all ({contact.linkedPartners.length})
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </ContactSidebarCard>
        </div>
      </div>
    </div>
  );
}

/* ─── Coming Soon placeholder — mirrors the canonical PlaceholderTab
 *     used across the partner detail surface (animated ping + Coming
 *     Soon pill + label + description). Local copy so the contact
 *     detail page doesn't take a hard dep on a partner-detail
 *     internal that isn't exported. */
function ContactPlaceholderTab({ label, description, icon: Icon }: { label: string; description: string; icon?: React.ElementType }) {
  const DisplayIcon = Icon || FileText;
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
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

/* ─── Activity Tab ─── unified feed-style log */
function ActivityTab() {
  // Build a sentence by extracting a "target" snippet where possible so the
  // shared ActivityFeed can render it as a primary-tinted link, matching the
  // pattern used in Partner / Group / Payment Term / Pricing Rule details.
  const items = ACTIVITY_LOG.map((it) => {
    const type: ActivityFeedItemType = it.icon === "create"
      ? "create"
      : it.icon === "link"
        ? "link"
        : it.icon === "edit"
          ? "edit"
          : it.icon === "email"
            ? "info"
            : "info";
    // Try to lift a target like "PO-3021", "QT-4501", "Acme Corp", etc.
    const tokenMatch = it.action.match(/\b([A-Z]{2,}-\d{2,}|[A-Z][\w&]+(?:\s+[A-Z][\w&]+){0,3})\b/);
    const target = tokenMatch ? tokenMatch[0] : undefined;
    const phrase = target ? it.action.replace(target, "").replace(/\s{2,}/g, " ").trim() : it.action;
    // The verb sits mid-sentence after the user's name ("Sarah Johnson updated …"),
    // and ActivityFeed no longer lowercases it, so start the phrase in lowercase here.
    const verb = phrase.charAt(0).toLowerCase() + phrase.slice(1);
    return {
      id: String(it.id),
      type,
      user: it.user,
      verb,
      target,
      date: formatDateTime(it.date),
    };
  });
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Activity History</h3>
        </div>
        <span className="text-[11px] shrink-0" style={{ fontWeight: 600, color: "#085FCC" }}>{ACTIVITY_LOG.length} events</span>
      </div>
      <div className="p-4">
        <ActivityFeed items={items} />
      </div>
    </div>
  );
}

/* ─── Notes Tab ─── matches Partner-details Notes treatment */
function NotesTab() {
  const [newNote, setNewNote] = useState("");
  return (
    <div className="space-y-4">
      {/* Add note input */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-muted flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Add a Note</h3>
        </div>
        <div className="p-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note..."
            className="w-full h-[80px] px-3 py-2.5 text-[13px] text-slate-700 bg-slate-50 border border-border rounded-lg outline-none resize-none placeholder:text-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => { if (newNote.trim()) { toast.success("Note added"); setNewNote(""); } }}
              className="h-8 px-4 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer transition-colors"
              style={{ fontWeight: 600 }}
            >
              Add Note
            </button>
          </div>
        </div>
      </div>
      {/* Existing notes — same Partner-details soft-card visual */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Notes</h3>
            <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full ml-1" style={{ fontWeight: 500 }}>{NOTES_DATA.length}</span>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {NOTES_DATA.map((note) => (
            <div key={note.id} className="rounded-md bg-[#FAFBFC] border border-muted p-3">
              <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
              <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-muted/60">
                <span className="text-slate-500" style={{ fontWeight: 500 }}>{note.author}</span> · {formatDate(note.date)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LinkedEntitiesTab                                             */
/*  Unified table for all entities this contact is linked to as a */
/*  Point of Contact — POs, SOs, Quotes (and extensible to more). */
/*  Styled to match the Partners / PO / SO / Quotes listings:     */
/*  same toolbar (search + Filters + density + Columns), filter   */
/*  chips with counts, sortable headers, status pills in source-  */
/*  module colors, Created By person cell, sticky Actions col.    */
/* ═══════════════════════════════════════════════════════════════ */

/* ─── Creator pool (deterministic per entity id) — mirrors the Partners list
 *  so the "Created By" cell renders an avatar + name like everywhere else. */
const ENTITY_CREATORS = [
  "Ahtisham Ahmad", "Sarah Johnson", "David Kim", "Emily Chen", "Marcus Obi",
  "Elena Volkov", "Irtaza Abid", "Shehryar Hasan", "Nophil Anwer", "Eli Rosenbloom",
];
function entityCreator(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  const idx = Math.abs(h) % ENTITY_CREATORS.length;
  return ENTITY_CREATORS[idx];
}

type EntityDensity = "condensed" | "comfort";

/* ─── Entity KPI definitions (local to this tab) ─── */
const DND_ENTITY_KPI = "ENTITY_KPI_CARD";

interface EntityKpiDef {
  key: string;
  label: string;
  iconName: string;
  /** Hover tooltip body + fixed-pitch Calculation block — mirrors the
   *  Vendor Invoicing listing card pattern. */
  tooltip?: string;
  formula?: string;
}
const ENTITY_KPI_DEFS: EntityKpiDef[] = [
  { key: "total",  label: "Total Linked",    iconName: "briefcase",      tooltip: "Every purchase order, sales order, and quote this contact is attached to.", formula: "count(linked entities)" },
  { key: "po",     label: "Purchase Orders", iconName: "shopping-cart",  tooltip: "Purchase orders where this contact is a point of contact.", formula: "count(type = Purchase Order)" },
  { key: "so",     label: "Sales Orders",    iconName: "receipt",        tooltip: "Sales orders where this contact is a point of contact.", formula: "count(type = Sales Order)" },
  { key: "quotes", label: "Quotes",          iconName: "clipboard-list", tooltip: "Quotes where this contact is a point of contact.", formula: "count(type = Quote)" },
  { key: "value",  label: "Total Value",     iconName: "dollar-sign",    tooltip: "Combined monetary value across all linked entities.", formula: "sum(entity.amount)" },
];
const DEFAULT_ENTITY_KPIS = ["total", "po", "so", "quotes", "value"];

/* ─── Draggable KPI card for linked-entities (mirrors partner listing) ─── */
function DraggableEntityKpiCard({ index, kpiKey, label, value, sub, delta, rangeLabel, tooltip, formula, iconName, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string | number; sub?: string; delta?: KpiDelta; rangeLabel?: string; tooltip?: string; formula?: string; iconName: string;
  moveCard: (from: number, to: number) => void; onRemove: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const KPI_ICON_MAP_LOCAL: Record<string, React.ElementType> = {
    "briefcase": Briefcase, "shopping-cart": ShoppingCart, "receipt": Receipt,
    "clipboard-list": ClipboardList, "dollar-sign": DollarSign,
  };
  const Icon = KPI_ICON_MAP_LOCAL[iconName] || ChartColumn;

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_ENTITY_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: DND_ENTITY_KPI,
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
      <div ref={ref} className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none" />
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
      <div className="px-3 py-2">
        {/* Drag grip — top-right pill */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate" style={{ fontWeight: 500 }}>{label}</p>
            {(tooltip || formula) && (
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
                      <p className="text-[10px] tracking-wider text-slate-400 mb-1" style={{ fontWeight: 600 }}>Calculation</p>
                      <pre className="text-[10px] text-slate-700 whitespace-pre-wrap leading-snug">{formula}</pre>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1 min-w-0">
          {delta && (
            <span
              className="text-[10px] shrink-0"
              style={{
                color: delta.tone === "positive" ? "rgb(var(--success))" : delta.tone === "negative" ? "rgb(var(--destructive))" : "rgb(var(--muted-foreground))",
                fontWeight: 600,
              }}
            >
              {delta.text}
            </span>
          )}
          <p className="text-[15px] text-slate-700 tracking-tight truncate" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
        {(sub || (delta && rangeLabel)) && (
          <div className="text-[10px] text-slate-400/80 truncate mt-0.5">
            {sub}
            {sub && delta && rangeLabel && <span className="text-slate-300"> · </span>}
            {delta && rangeLabel && <span>vs prior {rangeLabel}</span>}
          </div>
        )}
      </div>
      {/* Remove button — bottom-right on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
        title={`Remove ${label}`}
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
      </button>
    </div>
  );
}

/* ─── Entity Insights side drawer — matches KpiInsightsPanel design ─── */
function EntityInsightsPanel({ open, onOpenChange, activeKpis, onToggleKpi, kpiValues }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  kpiValues: Record<string, string | number>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
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

  if (!mounted) return null;

  const filtered = searchQuery
    ? ENTITY_KPI_DEFS.filter((k) => k.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : ENTITY_KPI_DEFS;
  const allActive = ENTITY_KPI_DEFS.every((k) => activeKpis.includes(k.key));

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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgb(var(--accent))" }}>
                <Sliders className="w-5 h-5" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Widgets</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPI widgets.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKpis.length} of {ENTITY_KPI_DEFS.length} insights active
            </span>
            <button
              onClick={() => {
                const allKeys = ENTITY_KPI_DEFS.map((k) => k.key);
                if (allActive) {
                  activeKpis.forEach((k) => onToggleKpi(k));
                } else {
                  allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : activeKpis.length === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? (
                <><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>
              ) : activeKpis.length === 0 ? (
                <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
              ) : (
                <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
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

        <div className="border-b border-muted mt-3 shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="mt-5">
              {/* Category Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>
                  Entity Metrics
                </span>
              </div>
              {/* KPI Cards Grid — 2 columns (compact text-only design) */}
              <div className="grid grid-cols-2 gap-2">
                {filtered.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = kpiValues[kpi.key] ?? "–";
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
                        <span
                          className={`text-[11px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`}
                          style={{ fontWeight: 500 }}
                          title={kpi.label}
                        >
                          {kpi.label}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          )}
                        </div>
                      </div>
                      <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>
                        {value}
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

/* ─── Linked Entities table — shared column-header system (Column Filters spec) ─── */
type LinkedEntityTableRow = LinkedEntityRow & { createdBy: string; updatedBy: string; updatedOn: string };

interface LinkedEntityColDef { key: string; label: string; width: number; align?: "right"; locked?: boolean; filterType: FilterType }

/* `filterType` follows the Column Filters spec's data-type rule: reference
 * numbers → free text, types / statuses / roles / people → constrained
 * checkbox set, money → min-max range, dates → date range. */
const LINKED_ENTITY_COLUMN_DEFS: LinkedEntityColDef[] = [
  { key: "entityType", label: "Type",            width: 150, locked: true, filterType: "multiselect" },
  { key: "refNo",      label: "Reference",       width: 140, filterType: "text" },
  { key: "partner",    label: "Partner",         width: 200, filterType: "multiselect" },
  { key: "status",     label: "Status",          width: 140, filterType: "multiselect" },
  { key: "role",       label: "POC Role",        width: 130, filterType: "multiselect" },
  { key: "updatedBy",  label: "Last Updated By", width: 200, filterType: "multiselect" },
  { key: "updatedOn",  label: "Last Updated On", width: 140, filterType: "date" },
  { key: "createdBy",  label: "Created By",      width: 200, filterType: "multiselect" },
  { key: "date",       label: "Created On",      width: 130, filterType: "date" },
  { key: "amount",     label: "Amount",          width: 130, align: "right", filterType: "range" },
];
const linkedEntityFilterTypeFor = (key: string): FilterType =>
  LINKED_ENTITY_COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

/* Accessor into the shared generic filter/sort engine — the four filter
 * semantics live in ColumnHeaderMenu, never per-table. */
const linkedEntityCellValue: CellAccessor<LinkedEntityTableRow> = (row, columnKey) => {
  switch (columnKey) {
    case "entityType": return row.entityType;
    case "refNo":      return row.refNo;
    case "partner":    return row.partner;
    case "status":     return row.status;
    case "role":       return row.role;
    case "updatedBy":  return row.updatedBy;
    case "updatedOn":  return row.updatedOn;
    case "createdBy":  return row.createdBy;
    case "date":       return row.date;
    case "amount":     return Number(String(row.amount).replace(/[^0-9.-]/g, "")) || 0;
    default:           return undefined;
  }
};

function LinkedEntitiesTab({ contactName }: { contactName: string }) {
  /** Deep-link base URLs per entity module. Clicking a row opens the
   *  entity in its own module in a new browser tab. */
  const MODULE_URLS: Partial<Record<LinkedEntityType, string>> = {
    "Purchase Order": "https://pleasant-flow.lovable.app/purchase-orders",
    "Sales Order":    "https://pleasant-flow.lovable.app/sales-orders",
    "Quote":          "https://pleasant-flow.lovable.app/quotes",
  };

  /** Aggregate + normalize dummy data from the three source arrays, and attach
   *  a deterministic "Created By" name per row so the cell mirrors the source
   *  tables' design (avatar + name). */
  // Deterministic split: every third entity surfaces this contact as
  // a non-primary POC ("POC"), the rest as Primary. The Primary POC
  // pill below filters down to the primary rows only — non-primary
  // entries stay in the default view per Eli's call.
  const isPrimaryById = (id: string) => id.length % 3 !== 1;
  const rows = useMemo(() => {
    type Row = LinkedEntityTableRow;
    const poRows: Row[] = PURCHASE_ORDERS_DATA.map((po) => {
      const lu = getLastUpdated(`po-${po.id}`, po.date);
      return {
        id: `po-${po.id}`,
        entityType: "Purchase Order" as const,
        refNo: po.id,
        partner: po.vendor,
        status: po.status,
        date: po.date,
        amount: po.amount,
        role: isPrimaryById(po.id) ? "Primary POC" : "POC",
        href: MODULE_URLS["Purchase Order"]!,
        createdBy: entityCreator(`po-${po.id}`),
        updatedBy: lu.name,
        updatedOn: lu.date,
      };
    });
    const soRows: Row[] = SALES_ORDERS_DATA.map((so) => {
      const lu = getLastUpdated(`so-${so.id}`, so.date);
      return {
        id: `so-${so.id}`,
        entityType: "Sales Order" as const,
        refNo: so.id,
        partner: so.customer,
        status: so.status,
        date: so.date,
        amount: so.amount,
        role: isPrimaryById(so.id) ? "Primary POC" : "POC",
        href: MODULE_URLS["Sales Order"]!,
        createdBy: entityCreator(`so-${so.id}`),
        updatedBy: lu.name,
        updatedOn: lu.date,
      };
    });
    const qRows: Row[] = QUOTES_DATA.map((q) => {
      const lu = getLastUpdated(`qt-${q.id}`, q.date);
      return {
        id: `qt-${q.id}`,
        entityType: "Quote" as const,
        refNo: q.id,
        partner: q.partner,
        status: q.status,
        date: q.date,
        amount: q.amount,
        role: isPrimaryById(q.id) ? "Primary POC" : "POC",
        href: MODULE_URLS["Quote"]!,
        createdBy: entityCreator(`qt-${q.id}`),
        updatedBy: lu.name,
        updatedOn: lu.date,
      };
    });
    return [...poRows, ...soRows, ...qRows];
  }, []);

  /* ─── Filter / sort / density / insights / quickview state ─── */
  const [typeFilter, setTypeFilter] = useState<"all" | LinkedEntityType>("all");
  /* Primary POC pill — composes with the entity-type pill so users
   * can isolate "entities where this contact is the primary POC for
   * a PO" vs. all PO touchpoints. Plain "primary" isn't enough per
   * Nophil + Eli — it has to compose with the type slice. */
  const [primaryPocOnly, setPrimaryPocOnly] = useState(false);
  const [search, setSearch] = useState("");
  /* ─── Column header state — sort / per-column filters / hide / freeze (spec) ─── */
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: "date", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<EntityDensity>("condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [showInsights, setShowInsights] = useState(true);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  // Insights date range — same control as the Partners listing strip;
  // drives the period-over-period delta chips on the KPI cards.
  const [entityInsightsRange, setEntityInsightsRange] = useState<InsightsRange>("last_30");
  const [entityInsightsCustom, setEntityInsightsCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ENTITY_KPIS]);
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const isRelaxed = density === "comfort";

  /* ─── Shared column-header machinery — filters / sort / hide / freeze ─── */
  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => Object.fromEntries(LINKED_ENTITY_COLUMN_DEFS.map((c) => [c.key, c.label])), []);
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    LINKED_ENTITY_COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, rows, linkedEntityCellValue);
    });
    return map;
  }, [rows]);
  const visibleColumnDefs = useMemo(() => LINKED_ENTITY_COLUMN_DEFS.filter((c) => !hiddenColumns.has(c.key)), [hiddenColumns]);
  /* Frozen columns go sticky-left, stacking in visible order with cumulative
   * offsets (widths are fixed per column, so offsets are known). */
  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = 0;
    for (const c of visibleColumnDefs) {
      if (frozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    }
    return offsets;
  }, [visibleColumnDefs, frozenColumns]);
  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, linkedEntityFilterTypeFor(columnKey)) });
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, linkedEntityFilterTypeFor(columnKey)) });
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
    setHiddenColumns((prev) => { const next = new Set(prev); next.add(columnKey); return next; });
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  /* ─── KPI drag-reorder + toggle ─── */
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
  const activeKpiDefs = useMemo(() => {
    return activeKpis
      .map((key) => ENTITY_KPI_DEFS.find((d) => d.key === key))
      .filter(Boolean) as EntityKpiDef[];
  }, [activeKpis]);

  /* ─── Counts per type — drive the filter chips ─── */
  const typeCounts = useMemo(() => {
    const out: Record<string, number> = { all: rows.length };
    rows.forEach((r) => { out[r.entityType] = (out[r.entityType] || 0) + 1; });
    return out;
  }, [rows]);

  /* ─── Aggregate KPI values for Performance Insights cards ─── */
  const parseAmount = (s: string) => Number(String(s).replace(/[^0-9.-]/g, "")) || 0;
  const insights = useMemo(() => {
    const total = rows.length;
    const poCount = rows.filter((r) => r.entityType === "Purchase Order").length;
    const soCount = rows.filter((r) => r.entityType === "Sales Order").length;
    const qCount  = rows.filter((r) => r.entityType === "Quote").length;
    const totalValue = rows.reduce((sum, r) => sum + parseAmount(r.amount), 0);
    const fmtMoney = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toLocaleString()}`;
    return { total, poCount, soCount, qCount, totalValueLabel: fmtMoney(totalValue) };
  }, [rows]);

  /* ─── Filtered + sorted rows ─── */
  const visibleRows = useMemo(() => {
    let r = rows;
    if (typeFilter !== "all") r = r.filter((x) => x.entityType === typeFilter);
    if (primaryPocOnly) r = r.filter((x) => x.role === "Primary POC");
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        x.refNo.toLowerCase().includes(q) ||
        x.partner.toLowerCase().includes(q) ||
        x.status.toLowerCase().includes(q) ||
        x.role.toLowerCase().includes(q) ||
        x.entityType.toLowerCase().includes(q) ||
        x.updatedBy.toLowerCase().includes(q) ||
        x.createdBy.toLowerCase().includes(q)
      );
    }
    r = applyFilters(r, columnFiltersList, linkedEntityCellValue);
    return sortRows(r, sortConfig, linkedEntityCellValue, linkedEntityFilterTypeFor);
  }, [rows, typeFilter, primaryPocOnly, search, columnFiltersList, sortConfig]);

  /* ─── Pagination ─── */
  // "All" is represented by recordsPerPage === -1.
  const effectiveRecordsPerPage = recordsPerPage === -1
    ? Math.max(1, visibleRows.length)
    : recordsPerPage;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / effectiveRecordsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  // Reset to page 1 when filter/search/density change
  useEffect(() => { setCurrentPage(1); }, [typeFilter, primaryPocOnly, search, recordsPerPage]);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * effectiveRecordsPerPage;
    return visibleRows.slice(start, start + effectiveRecordsPerPage);
  }, [visibleRows, currentPage, effectiveRecordsPerPage]);

  /* ─── Global empty / error states ─── */
  const tableLoad = useTableLoadState();
  const filterLayerCount = (typeFilter !== "all" ? 1 : 0) + (primaryPocOnly ? 1 : 0) + Object.keys(columnFilters).length;
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : rows.length,
    filteredCount: tableLoad.forceEmpty ? 0 : visibleRows.length,
    pageCount: pagedRows.length,
    searchQuery: search,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(search, rows.flatMap((x) => [x.refNo, x.partner, x.status, x.role, x.entityType, x.updatedBy, x.createdBy]));
  }, [emptyKind, search, rows]);

  const getPageNumbers = (): (number | "...")[] => {
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

  /* ─── Filter chip options — plural labels to match source module tabs ─── */
  const filterOptions: { key: "all" | LinkedEntityType; label: string }[] = [
    { key: "all",              label: "Show All" },
    { key: "Purchase Order",   label: "Purchase Orders" },
    { key: "Sales Order",      label: "Sales Orders" },
    { key: "Quote",            label: "Quotes" },
  ];

  /* ─── KPI value lookup by key ─── */
  const kpiValues: Record<string, string | number> = useMemo(() => ({
    total:  insights.total,
    po:     insights.poCount,
    so:     insights.soCount,
    quotes: insights.qCount,
    value:  insights.totalValueLabel,
  }), [insights]);

  /* ─── Column widths — from the shared defs, summed for min-width ─── */
  const ACTIONS_W = 64;
  const TOTAL_W = visibleColumnDefs.reduce((a, c) => a + c.width, 0) + ACTIONS_W;

  return (
    <div className="flex flex-col">
      {/* ═══ Performance Insights — collapsible, draggable KPI row (partner listing style) ═══ */}
      {showInsights && activeKpiDefs.length > 0 && (
        <div className="mb-4 shrink-0">
          {/* Header row — label + range dropdown (Partners listing pattern) */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                Linked Entities Insights
              </span>
              {/* Date Range Filter — shared invoicing control (incl. All time + Custom) */}
              <InsightsRangeMenu
                range={entityInsightsRange}
                onRangeChange={setEntityInsightsRange}
                customFrom={entityInsightsCustom.from}
                customTo={entityInsightsCustom.to}
                onCustomChange={(from, to) => setEntityInsightsCustom({ from, to })}
              />
            </div>
            <button
              onClick={() => setInsightsPanelOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
            >
              <Plus className="w-3 h-3" />
              Add Insights
            </button>
          </div>
          {/* KPI Cards — draggable responsive grid */}
          <DndProvider backend={HTML5Backend}>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {activeKpiDefs.map((kpi, idx) => {
                // Complement sub-line + delta numeric per KPI — same
                // shape the Vendor Invoicing listing cards consume.
                const pctOfLinked = (n: number) => (insights.total ? `${Math.round((n / insights.total) * 100)}% of linked` : "");
                const subs: Record<string, string> = {
                  total: `${insights.totalValueLabel} total value`,
                  po: pctOfLinked(insights.poCount),
                  so: pctOfLinked(insights.soCount),
                  quotes: pctOfLinked(insights.qCount),
                  value: `across ${insights.total} entities`,
                };
                const numerics: Record<string, number> = {
                  total: insights.total, po: insights.poCount, so: insights.soCount, quotes: insights.qCount, value: insights.total,
                };
                return (
                  <DraggableEntityKpiCard
                    key={kpi.key}
                    index={idx}
                    kpiKey={kpi.key}
                    label={kpi.label}
                    value={kpiValues[kpi.key] ?? "–"}
                    sub={subs[kpi.key]}
                    delta={buildSeededDelta(`entities_${kpi.key}`, entityInsightsRange, numerics[kpi.key] ?? 0, true)}
                    rangeLabel={insightsRangePeriodLabel(entityInsightsRange)}
                    tooltip={kpi.tooltip}
                    formula={kpi.formula}
                    iconName={kpi.iconName}
                    moveCard={moveKpi}
                    onRemove={() => handleToggleKpi(kpi.key)}
                  />
                );
              })}
            </div>
          </DndProvider>
        </div>
      )}

      {/* Entity Insights side drawer */}
      <EntityInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpis}
        onToggleKpi={handleToggleKpi}
        kpiValues={kpiValues}
      />

      {/* ═══ Main table card ═══ */}
      <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col">
        {/* Row 1: Search + Filters | record count + Insights + Condensed + Columns */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search type, ref, partner, creator…"
                className="pl-9 pr-8 h-9 text-sm rounded-md w-full bg-white border border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
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
            <button
              type="button"
              onClick={() => toast.info("Advanced filters, coming soon")}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
            >
              <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span data-table-meta className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
              {visibleRows.length !== rows.length ? (
                <>
                  <span className="text-foreground">{visibleRows.length}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{rows.length}</span>
                  <span className="text-muted-foreground/70"> records</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{rows.length}</span>
                  <span className="text-muted-foreground/70"> records</span>
                </>
              )}
            </span>
            <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

            {/* Insights toggle — matches partner listing */}
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
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
              {activeKpiDefs.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "rgb(var(--accent))", color: "rgb(var(--primary))", fontWeight: 600 }}>
                  {activeKpiDefs.length}
                </span>
              )}
            </button>

            {/* Density toggle — matches partner listing */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {density === "condensed"
                    ? <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />
                    : <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                    {density === "condensed" ? "Condensed" : "Comfort"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] p-1.5">
                <DropdownMenuItem className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md" onSelect={() => setDensity("condensed")}>
                  <AlignJustify className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1"><div className="text-sm" style={{ fontWeight: 500 }}>Condensed</div></div>
                  {density === "condensed" && <Check className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md" onSelect={() => setDensity("comfort")}>
                  <List className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1"><div className="text-sm" style={{ fontWeight: 500 }}>Comfort</div></div>
                  {density === "comfort" && <Check className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns button — rendered disabled (same greyed-out treatment
                as ColumnSelectorTrigger's card-view state) since column
                customization isn't available on this tab yet. */}
            <button
              type="button"
              disabled
              aria-disabled
              title="Column customization is not available on this tab"
              className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-slate-50 text-muted-foreground/60 shadow-sm cursor-not-allowed outline-none"
            >
              <Columns3 className="w-[18px] h-[18px] text-muted-foreground/40" />
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "rgb(var(--muted))", color: "rgb(var(--muted-foreground))", fontWeight: 600 }}>
                {visibleColumnDefs.length}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
          {/* Primary POC pill — composes with the entity-type pills
              below so "Primary POC + Purchase Orders" slices to only
              the POs where this contact is the primary point of
              contact. */}
          <button
            type="button"
            onClick={() => setPrimaryPocOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              primaryPocOnly
                ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
            }`}
            style={{ fontWeight: primaryPocOnly ? 500 : 400, color: primaryPocOnly ? "rgb(var(--primary))" : undefined }}
            title="Show only entities where this contact is the primary POC"
          >
            <UserCheck className="w-3 h-3" />
            Primary POC
          </button>
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          {filterOptions.map((opt) => {
            const isActive = typeFilter === opt.key;
            const count = typeCounts[opt.key] ?? 0;
            return (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                }`}
                style={{
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "rgb(var(--primary))" : undefined,
                }}
              >
                {opt.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                    isActive ? "bg-primary/10" : "bg-muted"
                  }`}
                  style={{
                    fontWeight: 600,
                    color: isActive ? "rgb(var(--primary))" : "rgb(var(--muted-foreground))",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Column Filters Bar (Notion-style, shared) */}
        <ActiveFiltersBar
          columnFilters={columnFiltersList}
          columnLabels={columnLabels}
          uniqueValuesByKey={uniqueValuesMap}
          lockedColumnKey="entityType"
          onFilterChange={handleColumnFilterChange}
          onRemoveFilter={handleRemoveColumnFilter}
          onAddFilter={handleAddColumnFilterWithAutoOpen}
          onClearAll={handleClearAllColumnFilters}
          autoOpenKey={autoOpenFilterKey}
          onAutoOpened={() => setAutoOpenFilterKey(null)}
          availableColumns={LINKED_ENTITY_COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
        />

        <div className="border-t border-border shrink-0" />

        {/* ═══ Table — shadcn Table with fixed layout + sticky Actions ═══ */}
        <Table style={{ tableLayout: "fixed", width: `max(${TOTAL_W}px, 100%)` }}>
          <TableHeader className="bg-card">
            <TableRow className={`bg-muted/30 hover:bg-muted/30 ${isRelaxed ? "[&>th]:h-9" : "[&>th]:h-8"}`}>
              {visibleColumnDefs.map((def) => {
                const key = def.key;
                const currentColSort: "asc" | "desc" | null = sortConfig?.key === key ? sortConfig.direction : null;
                const hasFilter = columnFilters[key] ? isFilterActive(columnFilters[key]) : false;
                const isFrozen = frozenColumns.has(key);
                return (
                  <TableHead
                    key={key}
                    className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky z-20 bg-slate-50" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""} ${def.align === "right" ? "text-right" : ""}`}
                    style={{ width: def.width, ...(isFrozen ? { left: stickyOffsets[key] } : {}) }}
                  >
                    <div className={`flex items-center ${def.align === "right" ? "w-full" : ""}`}>
                      <ColumnHeaderMenu
                        columnKey={key}
                        label={def.label}
                        sortable
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onAddFilter={handleAddColumnFilter}
                        onHideColumn={handleHideColumn}
                        onFreezeColumn={handleFreezeColumn}
                        isFrozen={isFrozen}
                        isLocked={def.locked}
                        hasActiveFilter={hasFilter}
                        filter={columnFilters[key] ?? null}
                        uniqueValues={uniqueValuesMap[key]}
                        filterTypeOverride={def.filterType}
                        onFilterChange={handleColumnFilterChange}
                      >
                        <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                          <span className="text-[13px]" style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                          {hasFilter && !currentColSort && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                          )}
                          {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                          {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                          {!currentColSort && !hasFilter && (
                            <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </ColumnHeaderMenu>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="whitespace-nowrap sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ width: ACTIONS_W, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}><span className="text-[13px]">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableLoad.loadState === "loading" ? (
              <TableSkeletonRows columns={visibleColumnDefs.length + 1} />
            ) : emptyKind ? (
              <TableEmptyRow
                colSpan={visibleColumnDefs.length + 1}
                kind={emptyKind}
                entity={{ singular: "linked entity", plural: "linked entities" }}
                searchQuery={search}
                suggestion={searchSuggestion}
                onApplySuggestion={setSearch}
                filterCount={filterLayerCount}
                onClearSearch={() => setSearch("")}
                onClearFilters={() => { setTypeFilter("all"); setPrimaryPocOnly(false); setColumnFilters({}); }}
                onClearAll={() => { setSearch(""); setTypeFilter("all"); setPrimaryPocOnly(false); setColumnFilters({}); }}
                onRetry={tableLoad.retry}
                retrying={tableLoad.retrying}
                onFirstPage={() => setCurrentPage(1)}
                description="Purchase orders, sales orders and quotes this contact is on will show up here."
                compact
              />
            ) : (
              pagedRows.map((row) => {
                const meta = ENTITY_TYPE_META[row.entityType];
                const TIcon = meta.icon;
                const statusStyle = LINKED_ENTITY_STATUS_STYLES[row.status] || { bg: "rgb(var(--muted))", text: "rgb(var(--muted-foreground))", border: "#CBD5E1" };
                const cbTint = getAvatarTint(row.createdBy);
                const cbPhoto = getPersonPhoto(row.createdBy);
                const cbInitials = row.createdBy.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                const ubTint = getAvatarTint(row.updatedBy);
                const ubPhoto = getPersonPhoto(row.updatedBy);
                const ubInitials = row.updatedBy.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                /* Cell content per column key — wrapped by the visible-columns
                 * map below so Hide/Freeze from the header menu apply to the
                 * body too. */
                const renderCell = (key: string): React.ReactNode => {
                  switch (key) {
                    case "entityType": return (
                      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] truncate max-w-full" style={{ fontWeight: 500, backgroundColor: meta.bg, color: meta.color, borderColor: meta.border }}>
                        <TIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{row.entityType}</span>
                      </span>
                    );
                    case "refNo": return (
                      <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-foreground group-hover:text-primary group-hover:underline transition-colors`} style={{ fontWeight: 600 }}>{row.refNo}</span>
                    );
                    case "partner": return (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-foreground truncate`} style={{ fontWeight: 500 }}>{row.partner}</span>
                      </div>
                    );
                    case "status": return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border truncate max-w-full" style={{ fontWeight: 500, backgroundColor: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}>
                        {row.status}
                      </span>
                    );
                    case "role": return (
                      <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{row.role}</span>
                    );
                    /* Last Updated By — clickable → opens QuickViewPanel */
                    case "updatedBy": return (
                      <div
                        className="flex items-center gap-2 min-w-0 cursor-pointer group/ub"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewData({
                            type: "contact",
                            item: {
                              id: row.id + "-ub",
                              name: row.updatedBy,
                              subtitle: "Team Member",
                              initials: ubInitials,
                              avatarBg: ubTint.bg,
                              avatarFg: ubTint.fg,
                              imageUrl: ubPhoto,
                              meta: { role: "Team Member", email: `${row.updatedBy.toLowerCase().replace(/\s/g, ".")}@company.com`, phone: "+1 (555) 000-0000", isUser: true },
                            },
                            vendorName: row.partner,
                          });
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full shrink-0 overflow-hidden border border-[#E8ECF1] flex items-center justify-center"
                          style={{ backgroundColor: ubPhoto ? "transparent" : ubTint.bg }}
                        >
                          {ubPhoto
                            ? <img src={ubPhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[10px]" style={{ fontWeight: 700, color: ubTint.fg }}>{ubInitials}</span>}
                        </div>
                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} truncate group-hover/ub:text-primary group-hover/ub:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{row.updatedBy}</span>
                      </div>
                    );
                    case "updatedOn": return (
                      <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{formatDate(row.updatedOn)}</span>
                    );
                    /* Created By — clickable → opens QuickViewPanel */
                    case "createdBy": return (
                      <div
                        className="flex items-center gap-2 min-w-0 cursor-pointer group/cb"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewData({
                            type: "contact",
                            item: {
                              id: row.id + "-cb",
                              name: row.createdBy,
                              subtitle: "Team Member",
                              initials: cbInitials,
                              avatarBg: cbTint.bg,
                              avatarFg: cbTint.fg,
                              imageUrl: cbPhoto,
                              meta: { role: "Team Member", email: `${row.createdBy.toLowerCase().replace(/\s/g, ".")}@company.com`, phone: "+1 (555) 000-0000", isUser: true },
                            },
                            vendorName: row.partner,
                          });
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full shrink-0 overflow-hidden border border-[#E8ECF1] flex items-center justify-center"
                          style={{ backgroundColor: cbPhoto ? "transparent" : cbTint.bg }}
                        >
                          {cbPhoto
                            ? <img src={cbPhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[10px]" style={{ fontWeight: 700, color: cbTint.fg }}>{cbInitials}</span>}
                        </div>
                        <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{row.createdBy}</span>
                      </div>
                    );
                    case "date": return (
                      <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{formatDate(row.date)}</span>
                    );
                    case "amount": return (
                      <span className={`${isRelaxed ? "text-[13px]" : "text-sm"} text-foreground`} style={{ fontWeight: 600 }}>{row.amount && row.amount.trim() ? row.amount : "—"}</span>
                    );
                    default: return null;
                  }
                };
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => window.open(row.href, "_blank", "noopener,noreferrer")}
                    className={`hover:bg-[#F0F7FF] cursor-pointer group ${
                      isRelaxed ? "[&>td]:py-2.5" : "[&>td]:py-1.5"
                    }`}
                  >
                    {visibleColumnDefs.map((def) => {
                      const isFrozen = frozenColumns.has(def.key);
                      return (
                        <TableCell
                          key={def.key}
                          className={`${isFrozen ? "sticky z-10 bg-white group-hover:bg-[#F0F7FF]" : ""} ${def.align === "right" ? "text-right" : ""}`}
                          style={{ width: def.width, ...(isFrozen ? { left: stickyOffsets[def.key] } : {}) }}
                        >
                          {renderCell(def.key)}
                        </TableCell>
                      );
                    })}
                    <TableCell
                      className="sticky right-0 bg-white group-hover:bg-[#F0F7FF] !pl-2 !pr-2"
                      style={{ width: ACTIONS_W, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.05)" }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => window.open(row.href, "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="w-4 h-4 mr-2" /> Open in {row.entityType} module
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(row.refNo); toast.success(`Copied ${row.refNo}`); }}>
                            <FileText className="w-4 h-4 mr-2" /> Copy Reference #
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

        {/* ═══ Pagination — mirrors partner listing pattern ═══ */}
        {visibleRows.length > 0 && (
          <div data-table-meta className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </Button>
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">…</span>
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

      {/* ═══ QuickView Panel — Created By contact card ═══ */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </div>
  );
}

