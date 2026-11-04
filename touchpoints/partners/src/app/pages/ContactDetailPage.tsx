import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  CircleSlash,
  FileText,
  Paperclip,
  Activity,
  StickyNote,
  Users,
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
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import { CONTACT_DICTIONARY, type ContactPerson, type ContactPhone, type ContactEmail, type ContactSocial } from "../components/vendors/partnerConstants";
import { AttachmentsTab } from "../components/vendors/AttachmentsTab";
import { VendorsListPage } from "./VendorsListPage";
import { getAvatarTint } from "../utils/avatarTints";
import { useVendors } from "../context/VendorContext";
import { usePersonLightbox } from "../components/vendors/PersonAvatarLightbox";
import { ALL_KPI_DEFINITIONS, DEFAULT_ACTIVE_KPIS, computeKpiValue } from "../components/vendors/KpiInsightsPanel";
import { CreatePocModal } from "../components/vendors/PocModals";
import { QuickViewPanel, type QuickViewData } from "../components/vendors/QuickViewPanel";
// Sheet import removed — EntityInsightsPanel uses custom animated drawer (matching KpiInsightsPanel)
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
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
  Sales: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Finance: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

/* ─── Enrichment helper ─── */
interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive";
  linkedPartners: string[];
  createdByName: string;
  createdByInitials: string;
  createdOn: string;
}

function enrichContactWithNames(c: ContactPerson, names: string[]): EnrichedContact {
  let hash = 0;
  for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const status: "active" | "inactive" = absHash % 5 === 0 ? "inactive" : "active";
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
  { id: "communications", label: "Communications", icon: MessageSquare },
  { id: "notes", label: "Notes", icon: StickyNote },
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
  "Purchase Order":   { icon: ShoppingCart,  color: "hsl(var(--primary))", bg: "hsl(var(--accent))", border: "#BFDBFE" },
  "Sales Order":      { icon: Receipt,       color: "hsl(var(--success))", bg: "#ECFDF5", border: "#A7F3D0" },
  "Quote":            { icon: ClipboardList, color: "hsl(var(--violet))", bg: "#F5F3FF", border: "#DDD6FE" },
  "Vendor Invoice":   { icon: FileText,      color: "hsl(var(--warning))", bg: "#FFFBEB", border: "#FDE68A" },
  "Customer Invoice": { icon: FileText,      color: "hsl(var(--destructive))", bg: "#FEF2F2", border: "#FECACA" },
  "Shipment":         { icon: Package,       color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
  "Payment":          { icon: Star,          color: "#65A30D", bg: "#F7FEE7", border: "#D9F99D" },
};

/* ─── Status color palette — shared with source modules ─── */
const LINKED_ENTITY_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  // PO
  "Confirmed":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Approved":                 { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Draft":                    { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", border: "#CBD5E1" },
  "Sent":                     { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Pending":                  { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Partially Received":       { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  "Fully Received":           { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Active with Cancellation": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  "Cancelled":                { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Delivered":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  // SO
  "Fulfilled":                { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Processing":               { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Shipped":                  { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
  // Quote
  "Accepted":                 { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  "Rejected":                 { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Expired":                  { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", border: "#CBD5E1" },
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
          <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          {change && <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: change.startsWith("\u2191") ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>{change}</span>}
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

const CONTACT_WIDGET_DEFS: ContactWidgetDef[] = [
  { key: "interaction_activity", label: "Interaction Activity", type: "chart", description: "Daily call & email volume by weekday", category: "Performance" },
  { key: "communication_trend", label: "Communication Trend", type: "line", description: "Yearly communication trend (line chart)", category: "Performance" },
  { key: "recent_communications", label: "Recent Communications", type: "list", description: "Latest emails, calls and messages", category: "Activity" },
  { key: "order_summary", label: "Order Summary", type: "bars", description: "Aggregated stats across all orders", category: "Orders" },
  { key: "purchase_orders", label: "Purchase Orders", type: "list", description: "POs linked to this contact", category: "Orders" },
  { key: "sales_orders", label: "Sales Orders", type: "list", description: "SOs linked to this contact", category: "Orders" },
  { key: "activity_timeline", label: "Activity Timeline", type: "list", description: "Chronological event history", category: "Activity" },
  { key: "notes", label: "Notes", type: "text", description: "Internal notes & comments on this contact", category: "Notes" },
];

const CONTACT_WIDGET_CATEGORY_ORDER: ContactWidgetDef["category"][] = ["Performance", "Activity", "Orders", "Notes"];

const DEFAULT_CONTACT_WIDGETS = [
  "interaction_activity", "communication_trend",
  "recent_communications", "order_summary",
  "purchase_orders", "sales_orders",
  "activity_timeline", "notes",
];

const CONTACT_WIDGET_DEFAULT_SPANS: Record<string, "full" | "half"> = {
  interaction_activity: "full",
  communication_trend: "full",
  recent_communications: "half",
  order_summary: "half",
  purchase_orders: "half",
  sales_orders: "half",
  activity_timeline: "half",
  notes: "full",
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
          onClick={(e) => { e.stopPropagation(); onRemove(); toast.success(`Removed "${title}" — re-enable in Customize Widgets`); }}
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
    blue:    isActive ? "#93C5FD" : "hsl(var(--border))",  // blue-300 / slate-200
    orange:  isActive ? "#FDBA74" : "hsl(var(--border))",  // orange-300 / slate-200
    purple:  isActive ? "#C4B5FD" : "hsl(var(--border))",  // purple-300 / slate-200
    green:   isActive ? "#86EFAC" : "hsl(var(--border))",  // green-300 / slate-200
    red:     isActive ? "#FCA5A5" : "hsl(var(--border))",  // red-300 / slate-200
    slate:   isActive ? "#CBD5E1" : "hsl(var(--border))",  // slate-300 / slate-200
    needle:  isActive ? "#64748B" : "#94A3B8",  // slate-500 / slate-400 — gauge needle
    lineFg:  isActive ? "#93C5FD" : "#CBD5E1",  // line stroke
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
                <Sliders className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
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
                    <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>Contact Insights</span>
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
                            <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                            <div className="shrink-0">
                              {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
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
                      <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
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
                              <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }} title={w.label}>{w.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={w.description}>{w.description}</p>
                              {isActive && (
                                <div className="mt-2 flex items-center h-6 rounded-md border border-border bg-slate-50 p-0.5 gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  {(["sm", "md", "lg"] as const).map((s) => (
                                    <button
                                      key={s}
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

export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { vendors } = useVendors();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // KPI drag-drop state
  const CONTACT_KPIS = [
    { key: "linked_partners", label: "Linked Partners", value: "0", icon: Link2, change: null, description: "Companies linked to this contact" },
    { key: "total_orders", label: "Total Orders", value: "24", icon: Package, change: "\u2191 12%", description: "All purchase & sales orders" },
    { key: "email_interactions", label: "Email Interactions", value: "156", icon: Mail, change: "\u2191 8%", description: "Total email volume sent & received" },
    { key: "last_active", label: "Last Active", value: "Mar 01, 2026", icon: Clock, change: null, description: "Date of most recent interaction" },
    { key: "avg_response", label: "Avg. Response", value: "4.2 hrs", icon: Activity, change: "\u2193 15%", description: "Mean reply time across channels" },
    { key: "satisfaction", label: "Satisfaction", value: "4.8 / 5", icon: Star, change: null, description: "Customer satisfaction (CSAT) score" },
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
    setKpiOrder(["linked_partners", "total_orders", "email_interactions", "last_active", "avg_response", "satisfaction"]);
    setHiddenKpis(new Set());
    setActiveWidgets([...DEFAULT_CONTACT_WIDGETS]);
    setWidgetSizes({});
    toast.success("Layout reset to defaults");
  }, []);
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

  // Confirmation modals
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Status dropdown state (matches VendorDetailsPage)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

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
  const handleAddTag = () => {
    const v = tagInputValue.trim().toLowerCase();
    if (v && !contactTags.includes(v)) {
      setContactTags((prev) => [...prev, v]);
      toast.success(`Tag "${v}" added`);
    }
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
    return enrichContactWithNames(raw, vendorNames);
  }, [contactId, vendorNames]);

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
  };
  const currentStatus = statusConfig[contact.status] || statusConfig.active;
  const sStyle = contact.status === "active" ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" } : { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" };

  // Multi-field data
  const phoneList: ContactPhone[] = contact.phones && contact.phones.length > 0
    ? contact.phones
    : [{ id: "p1", type: "Office" as const, code: "+1", number: contact.phone, ext: contact.phoneExt || "" }, ...(contact.secondaryPhone ? [{ id: "p2", type: "Mobile" as const, code: "+1", number: contact.secondaryPhone, ext: contact.secondaryPhoneExt || "" }] : [])];
  const emailList: ContactEmail[] = contact.emails && contact.emails.length > 0
    ? contact.emails
    : [{ id: "e1", type: "Work" as const, address: contact.email }];
  const socialList: ContactSocial[] = contact.socials || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Top Nav Bar — breadcrumb + search + user profile */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0 sticky top-0 z-30">
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

      {/* Sentinel */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* Sticky Header Card — VendorDetailsPage pattern */}
      <div className="shrink-0 sticky top-[48px] z-20 bg-slate-50">
        <div style={{ paddingTop: isCompact ? "8px" : "12px", paddingBottom: "4px", transition: "padding 250ms ease" }}>
          <div className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
            <div className={`bg-white border border-border rounded-xl overflow-hidden transition-shadow duration-250 ${isCompact ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}>
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
                      width: isCompact ? 36 : 120,
                      height: isCompact ? 36 : 120,
                      borderRadius: isCompact ? 12 : 16,
                      border: isCompact ? "1px solid #E2E8F0" : "3px solid white",
                      boxShadow: isCompact ? "0 1px 3px rgba(0,0,0,0.04)" : "0 4px 16px -4px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
                      backgroundColor: tint.bg,
                      cursor: photo && !imgFailed ? "zoom-in" : "default",
                    }}
                  >
                    {photo && !imgFailed ? <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} /> : <span className="transition-all duration-250" style={{ fontSize: isCompact ? 12 : 36, fontWeight: 700, color: tint.fg }}>{initials}</span>}
                  </button>
                  {/* Info column */}
                  <div className="min-w-0 flex-1" style={{ paddingTop: isCompact ? 0 : 2 }}>
                    {/* Row 1: Name + Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-foreground truncate transition-all duration-250" style={{ fontSize: isCompact ? 14 : 17, fontWeight: isCompact ? 600 : 700, lineHeight: 1.3 }}>{contact.name}</h1>
                      <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                        <PopoverTrigger asChild>
                          <button className="inline-flex items-center rounded-full border cursor-pointer transition-all duration-250 hover:ring-2 hover:ring-offset-1 hover:ring-border" style={{ padding: isCompact ? "1px 6px" : "2px 8px", fontSize: isCompact ? 10 : 11, gap: isCompact ? 2 : 4, fontWeight: 500, backgroundColor: currentStatus.bg, color: currentStatus.color, borderColor: currentStatus.border }}>
                            {currentStatus.label}
                            <ChevronDown style={{ width: isCompact ? 10 : 12, height: isCompact ? 10 : 12 }} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300]" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="space-y-1">
                            {(["active", "inactive"] as const).map((s) => {
                              const sc = statusConfig[s];
                              const isCurrent = s === contact.status;
                              return (
                                <button key={s} onClick={() => { if (!isCurrent) { if (s === "inactive") setShowDeactivateModal(true); else toast.success("Contact activated"); setStatusDropdownOpen(false); } }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]" style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                                  {isCurrent && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {/* Row 2: Role · Company */}
                    <p className="text-slate-500 truncate transition-all duration-250" style={{ fontSize: isCompact ? 11 : 13, marginTop: isCompact ? 1 : 8 }}>{contact.role || "Contact"} <span className="text-slate-300 mx-0.5">·</span> {(contact.companies || [contact.company])[0]}</p>
                    {/* Rows 3+4: Dept pills + Tags — collapse on scroll */}
                    <div className="overflow-hidden transition-all duration-250 ease-in-out" style={{ maxHeight: isCompact ? 0 : 200, opacity: isCompact ? 0 : 1, marginTop: isCompact ? 0 : 8 }}>
                      {/* Row 3: Department pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {departments.slice(0, 2).map((d, i) => {
                          const ds = DEPT_STYLES[d] || DEPT_STYLES.Sales;
                          return <span key={i} className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px]" style={{ fontWeight: 600, backgroundColor: ds.bg, color: ds.text, borderColor: ds.border }}>{shortDept(d)}</span>;
                        })}
                        {departments.length > 2 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border border-border bg-muted text-primary cursor-default" style={{ fontWeight: 600 }}>+{departments.length - 2} more</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="z-[300] max-w-[240px]">
                              <div className="flex flex-wrap gap-1.5">
                                {departments.slice(2).map((d, i) => {
                                  const ds = DEPT_STYLES[d] || DEPT_STYLES.Sales;
                                  return <span key={i} className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px]" style={{ fontWeight: 600, backgroundColor: ds.bg, color: ds.text, borderColor: ds.border }}>{shortDept(d)}</span>;
                                })}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {/* Row 4: Tags */}
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {contactTags.map((tag) => {
                          const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
                            "vendor": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
                            "key-account": { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
                            "vip": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
                            "preferred": { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
                          };
                          const tc = TAG_COLORS[tag] || { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", border: "#CBD5E1" };
                          return (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] group/tag" style={{ fontWeight: 600, backgroundColor: tc.bg, color: tc.text, borderColor: tc.border }}>
                              {tag}
                              <button onClick={() => handleRemoveTag(tag)} className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-0.5 -mr-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
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
                            <button onClick={handleAddTag} className="h-6 px-2 rounded-md bg-primary text-white text-[10px] cursor-pointer hover:bg-[#0862D0] transition-colors" style={{ fontWeight: 600 }}>Save</button>
                            <button onClick={() => { setTagInputOpen(false); setTagInputValue(""); }} className="h-6 px-2 rounded-md border border-border bg-white text-slate-500 text-[10px] cursor-pointer hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setTagInputOpen(true); setTimeout(() => tagInputRef.current?.focus(), 50); }} className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                            <Plus className="w-3 h-3" /> Add Tag
                          </button>
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
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}><Link2 className="w-4 h-4 mr-2" /> Copy Link</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-amber-800 focus:text-amber-800 focus:bg-amber-50" onClick={() => setShowDeactivateModal(true)}><CircleSlash className="w-4 h-4 mr-2 text-amber-800" /> {contact.status === "active" ? "Deactivate" : "Activate"}</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setShowArchiveModal(true)}><Archive className="w-4 h-4 mr-2 text-destructive" /> Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={handleOpenEdit} className={`rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-250 ${isCompact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`} style={{ fontWeight: 600 }}><Pencil className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} /> Edit Contact</button>
                  </div>
                  {/* Contact data — collapses on scroll */}
                  <div className="overflow-hidden transition-all duration-250 ease-in-out hidden md:block" style={{ maxHeight: isCompact ? 0 : 120, opacity: isCompact ? 0 : 1 }}>
                    <div className="flex flex-col gap-2 items-end pt-2">
                      {/* Socials */}
                      {socialList.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {socialList.map((s) => {
                            const socialMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
                              "LinkedIn": { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
                              "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
                              "Website": { icon: Globe, color: "hsl(var(--primary))", label: "Website" },
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
        <div className={`mx-auto w-full px-4 lg:px-6 xl:px-8 pt-3 pb-5 flex-1 flex flex-col min-h-0 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>
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
            />
          )}



          {activeTab === "linked_partners" && (() => {
            // Filter the full vendors list down to those linked to this contact (case-insensitive name match against displayName / companyName)
            const linkedNames = new Set(contact.linkedPartners.map(n => n.trim().toLowerCase()));
            const linkedVendors = vendors.filter(v =>
              linkedNames.has(v.displayName.trim().toLowerCase()) ||
              linkedNames.has(v.companyName.trim().toLowerCase())
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
              />
            );
          })()}

          {activeTab === "linked_entities" && (
            <LinkedEntitiesTab contactName={contact.name} />
          )}

          {activeTab === "communications" && (
            // Deferred to the Communications module (owned by a separate team).
            // We keep the tab in the nav so the structure stays stable — just show
            // a clean empty state until the module ships.
            <div className="bg-white border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <p className="text-[15px] text-foreground" style={{ fontWeight: 600 }}>
                Communications coming soon
              </p>
              <p className="text-[12.5px] text-slate-500 mt-1 max-w-[380px]" style={{ fontWeight: 400 }}>
                Email, call, and message history will appear here once the Communications module is enabled for your workspace.
              </p>
            </div>
          )}

          {activeTab === "notes" && <NotesTab />}
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

      {/* Archive Confirmation Modal */}
      <AlertDialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Archive className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-[16px] text-foreground" style={{ fontWeight: 700 }}>
              Archive Contact
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              Are you sure you want to archive <strong>{contact.name}</strong>? This contact will be removed from active listings but records will be preserved.
            </AlertDialogDescription>
          </div>
          <div className="px-6 pb-6 flex flex-col gap-2">
            <button onClick={() => { toast.success("Contact archived"); setShowArchiveModal(false); navigate("/partners/contacts"); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}>
              Archive Contact
            </button>
            <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border border-border bg-white text-slate-700 hover:bg-slate-50 cursor-pointer" style={{ fontWeight: 500 }}>
              Cancel
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Confirmation Modal */}
      <AlertDialog open={showDeactivateModal} onOpenChange={setShowDeactivateModal}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
              <CircleSlash className="w-6 h-6 text-[#F97316]" />
            </div>
            <AlertDialogTitle className="text-[16px] text-foreground" style={{ fontWeight: 700 }}>
              Deactivate Contact
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              Are you sure you want to deactivate <strong>{contact.name}</strong>? This contact will be marked as inactive and excluded from new assignments.
            </AlertDialogDescription>
          </div>
          <div className="px-6 pb-6 flex flex-col gap-2">
            <button onClick={() => { toast.success("Contact deactivated"); setShowDeactivateModal(false); }} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "#F97316", color: "#FFFFFF" }}>
              Deactivate Contact
            </button>
            <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border border-border bg-white text-slate-700 hover:bg-slate-50 cursor-pointer" style={{ fontWeight: 500 }}>
              Cancel
            </AlertDialogCancel>
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
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] transition-colors cursor-pointer"
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
function ContactOverviewTab({ contact, sStyle, partnerNameToId, kpiOrder, hiddenKpis, moveKpi, toggleKpi, CONTACT_KPIS, activeWidgets, widgetSizes, onWidgetSizeChange, onRemoveWidget, moveWidget, setCustomizeOpen, onResetLayout }: {
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
}) {
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: isSmall ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  {!isSmall && <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />}
                  <ReTooltip contentStyle={ttStyle} cursor={{ fill: "rgba(10,119,255,0.04)" }} />
                  <Bar dataKey="emails" name="Emails" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={isSmall ? 14 : 24} />
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
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: isSmall ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  {!isSmall && <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />}
                  <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}`, "Interactions"]} />
                  <Area type="monotone" dataKey="value" name="Interactions" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ctAreaGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }} />
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
        return (
          <>
            <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
              {pos.slice(0, isSmall ? 4 : sz === "lg" ? 6 : 5).map((o) => (
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
              ...(!isSmall ? [{ label: "Pending", value: "3", color: "hsl(var(--warning))" }] : []),
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
        return (
          <>
            <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
              {sos.slice(0, isSmall ? 4 : sz === "lg" ? 6 : 5).map((o) => (
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
              ...(!isSmall ? [{ label: "Processing", value: "2", color: "hsl(var(--warning))" }] : []),
            ], isSmall)}</div>
          </>
        );
      }

      case "recent_communications": {
        const comms = [
          { type: "email", subject: "Q1 Report Follow-up", date: "Mar 28, 2026", from: contact.name },
          { type: "call", subject: "Contract Discussion", date: "Mar 25, 2026", from: "Sarah Johnson" },
          { type: "email", subject: "Invoice #2847 Clarification", date: "Mar 22, 2026", from: contact.name },
          { type: "email", subject: "Meeting Reschedule", date: "Mar 20, 2026", from: "Admin" },
          { type: "call", subject: "Quarterly Review", date: "Mar 18, 2026", from: contact.name },
        ];
        return (
          <>
            <div className="space-y-1.5 flex-1 min-h-0 overflow-hidden">
              {comms.slice(0, isSmall ? 3 : sz === "lg" ? 5 : 4).map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: c.type === "email" ? "hsl(var(--accent))" : "#FFF7ED" }}>
                    {c.type === "email" ? <Mail className="w-3 h-3 text-primary" /> : <PhoneCall className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{c.subject}</p>
                    {!isSmall && <p className="text-[10px] text-slate-400 mt-0.5">{c.from} &middot; {c.date}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }

      case "order_summary": {
        const orders = [
          { id: "PO-2847", amount: "$12,400", status: "Delivered", date: "Mar 15" },
          { id: "PO-2831", amount: "$8,750", status: "In Transit", date: "Mar 08" },
          { id: "PO-2819", amount: "$23,100", status: "Delivered", date: "Feb 28" },
          { id: "SO-1045", amount: "$5,200", status: "Processing", date: "Mar 22" },
        ];
        return (
          <>
            <div className="space-y-1.5 flex-1 min-h-0 overflow-hidden">
              {orders.slice(0, isSmall ? 3 : 4).map((o, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{o.id}</p>
                    {!isSmall && <p className="text-[10px] text-slate-400 mt-0.5">{o.date}</p>}
                  </div>
                  <span className="text-[11px] text-slate-700 shrink-0" style={{ fontWeight: 600 }}>{o.amount}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${
                    o.status === "Delivered" ? "bg-green-50 text-[#166534]" :
                    o.status === "In Transit" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"
                  }`} style={{ fontWeight: 500 }}>{o.status}</span>
                </div>
              ))}
            </div>
            {!isSmall && <div className="shrink-0">{statRow([
              { label: "Total Orders", value: "24" },
              { label: "Total Value", value: "$128.4K" },
            ])}</div>}
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

      case "notes":
        return (
          <div className="space-y-2.5 flex-1 min-h-0 overflow-hidden">
            {NOTES_DATA.slice(0, isSmall ? 1 : sz === "lg" ? 3 : 2).map((note) => (
              <div key={note.id} className="px-3 py-2.5 rounded-lg border border-muted hover:border-border transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center"><User className="w-2.5 h-2.5 text-slate-500" /></div>
                  <span className="text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{note.author}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(note.date)}</span>
                </div>
                <p className={`text-[12px] text-slate-500 leading-relaxed ${isSmall ? "line-clamp-2" : ""}`}>{note.text}</p>
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
      recent_communications: MessageSquare,
      order_summary: Package,
      purchase_orders: ShoppingCart,
      sales_orders: Receipt,
      activity_timeline: Activity,
      notes: StickyNote,
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
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Overview</span>
          <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-slate-500 hover:bg-muted hover:text-slate-700 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            <Calendar className="w-3 h-3" /> Last 30 days <ChevronDown className="w-2.5 h-2.5" />
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-400">Updated {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          <button className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D4] transition-colors cursor-pointer" style={{ fontWeight: 500 }} onClick={() => toast.success("Refreshed")}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer" style={{ fontWeight: 500 }} onClick={onResetLayout}>
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset
          </button>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer" style={{ fontWeight: 500 }} onClick={() => setCustomizeOpen(true)}>
            <Sliders className="w-3.5 h-3.5 text-slate-400" /> Customize Widgets
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
          {/* Contact Information — matches Partner Information layout */}
          <ContactSidebarCard title="Contact Information" icon={User}>
            <div>
              {/* Company — full width */}
              <div className="mb-3">
                <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Company</p>
                <p className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{contact.company}</p>
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
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Phone</p>
                        <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{phones[0].number}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 mb-px" style={{ fontWeight: 500 }}>Secondary</p>
                        <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{phones.length > 1 ? phones[1].number : "—"}</p>
                      </div>
                    </div>
                    {phones.length > 2 && (
                      <div className="mb-3 -mt-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] cursor-default" style={{ fontWeight: 600, color: "#085FCC" }}>+{phones.length - 2} more phone numbers</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="z-[300] max-w-[280px] p-1">
                            <div className="space-y-0.5">
                              {phones.slice(2).map((p) => (
                                <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-default">
                                  <span className="text-[10px] text-slate-400 shrink-0 min-w-[42px]" style={{ fontWeight: 500 }}>{p.type}</span>
                                  <span className="text-[11px] text-slate-700">{p.code} {p.number}{p.ext ? ` ext. ${p.ext}` : ""}</span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
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
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}>
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

          {/* Quick Stats */}
          <ContactSidebarCard title="Quick Stats" icon={BarChart3}>
            <div className="grid grid-cols-2 gap-2.5">
              <ContactStatBox label="Total Orders" value="24" icon={Package} />
              <ContactStatBox label="Email Sent" value="156" icon={Mail} color="hsl(var(--primary))" />
              <ContactStatBox label="Satisfaction" value="4.8/5" icon={Star} color="#F59E0B" />
              <ContactStatBox label="Avg Response" value="4.2 hrs" icon={Clock} color="hsl(var(--success))" />
            </div>
          </ContactSidebarCard>

          {/* Linked Partners */}
          <ContactSidebarCard title="Linked Partners" icon={Link2} count={contact.linkedPartners.length}>
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
              {contact.linkedPartners.length > 5 && (
                <p className="text-xs text-primary hover:text-[#0862D0] transition-colors cursor-pointer mt-1" style={{ fontWeight: 500 }}>
                  +{contact.linkedPartners.length - 5} more
                </p>
              )}
            </div>
          </ContactSidebarCard>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Tab ─── */
function ActivityTab() {
  const iconMap: Record<string, React.ElementType> = { create: CircleCheck, link: Link2, edit: Pencil, email: Mail };
  const colorMap: Record<string, { bg: string; fg: string }> = { create: { bg: "#ECFDF5", fg: "hsl(var(--success))" }, link: { bg: "#EFF6FF", fg: "#2563EB" }, edit: { bg: "#FFFBEB", fg: "hsl(var(--warning))" }, email: { bg: "hsl(var(--accent))", fg: "hsl(var(--primary))" } };
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-muted flex items-center justify-between">
        <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Activity History</h3>
        <span className="text-[11px] shrink-0" style={{ fontWeight: 600, color: "#085FCC" }}>{ACTIVITY_LOG.length} events</span>
      </div>
      <div className="px-5 py-2">
        {ACTIVITY_LOG.map((item, idx) => {
          const Icon = iconMap[item.icon] || Activity;
          const color = colorMap[item.icon] || colorMap.edit;
          return (
            <div key={item.id} className="flex items-start gap-3 relative" style={{ paddingBottom: idx === ACTIVITY_LOG.length - 1 ? 8 : 0 }}>
              {/* Timeline line */}
              {idx < ACTIVITY_LOG.length - 1 && <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-border" />}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-2.5 z-10" style={{ backgroundColor: color.bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color: color.fg }} />
              </div>
              <div className="flex-1 min-w-0 py-2.5 border-b border-muted last:border-b-0" style={{ borderBottom: idx === ACTIVITY_LOG.length - 1 ? "none" : undefined }}>
                <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{item.action}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{item.user}</span>
                  <span className="text-[11px] text-slate-300">·</span>
                  <span className="text-[11px] text-slate-400">{formatDateTime(item.date)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Notes Tab ─── */
function NotesTab() {
  const [newNote, setNewNote] = useState("");
  return (
    <div className="space-y-4">
      {/* Add note input */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-muted">
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
              className="h-8 px-4 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer transition-colors"
              style={{ fontWeight: 600 }}
            >
              Add Note
            </button>
          </div>
        </div>
      </div>
      {/* Existing notes */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-muted flex items-center justify-between">
          <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Notes</h3>
          <span className="text-[11px] shrink-0" style={{ fontWeight: 600, color: "#085FCC" }}>{NOTES_DATA.length} notes</span>
        </div>
        <div className="divide-y divide-muted">
          {NOTES_DATA.map((note) => {
            const noteInitials = note.author.split(" ").map(w => w[0]).join("").toUpperCase();
            return (
              <div key={note.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] text-white shrink-0" style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 700 }}>{noteInitials}</div>
                  <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{note.author}</span>
                  <span className="text-[11px] text-slate-400">{formatDate(note.date)}</span>
                </div>
                <p className="text-[12px] text-slate-500 leading-relaxed pl-[34px]">{note.text}</p>
              </div>
            );
          })}
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
  "Elena Volkov", "Areeb Tanvir", "Shehryar Hasan", "Nophil Anwer", "Eli Rosenbloom",
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
}
const ENTITY_KPI_DEFS: EntityKpiDef[] = [
  { key: "total",  label: "Total Linked",    iconName: "briefcase" },
  { key: "po",     label: "Purchase Orders", iconName: "shopping-cart" },
  { key: "so",     label: "Sales Orders",    iconName: "receipt" },
  { key: "quotes", label: "Quotes",          iconName: "clipboard-list" },
  { key: "value",  label: "Total Value",     iconName: "dollar-sign" },
];
const DEFAULT_ENTITY_KPIS = ["total", "po", "so", "quotes", "value"];

/* ─── Draggable KPI card for linked-entities (mirrors partner listing) ─── */
function DraggableEntityKpiCard({ index, kpiKey, label, value, iconName, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string | number; iconName: string;
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
            <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
          </div>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
                <Sliders className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Add Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Customize your dashboard with relevant metrics.</p>
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
                <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>
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
  const rows = useMemo(() => {
    type Row = LinkedEntityRow & { createdBy: string };
    const poRows: Row[] = PURCHASE_ORDERS_DATA.map((po) => ({
      id: `po-${po.id}`,
      entityType: "Purchase Order",
      refNo: po.id,
      partner: po.vendor,
      status: po.status,
      date: po.date,
      amount: po.amount,
      role: "Primary POC",
      href: MODULE_URLS["Purchase Order"]!,
      createdBy: entityCreator(`po-${po.id}`),
    }));
    const soRows: Row[] = SALES_ORDERS_DATA.map((so) => ({
      id: `so-${so.id}`,
      entityType: "Sales Order",
      refNo: so.id,
      partner: so.customer,
      status: so.status,
      date: so.date,
      amount: so.amount,
      role: "Primary POC",
      href: MODULE_URLS["Sales Order"]!,
      createdBy: entityCreator(`so-${so.id}`),
    }));
    const qRows: Row[] = QUOTES_DATA.map((q) => ({
      id: `qt-${q.id}`,
      entityType: "Quote",
      refNo: q.id,
      partner: q.partner,
      status: q.status,
      date: q.date,
      amount: q.amount,
      role: "Primary POC",
      href: MODULE_URLS["Quote"]!,
      createdBy: entityCreator(`qt-${q.id}`),
    }));
    return [...poRows, ...soRows, ...qRows];
  }, []);

  /* ─── Filter / sort / density / insights / quickview state ─── */
  const [typeFilter, setTypeFilter] = useState<"all" | LinkedEntityType>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof (typeof rows)[number]>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [density, setDensity] = useState<EntityDensity>("condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [showInsights, setShowInsights] = useState(true);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ENTITY_KPIS]);
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const isRelaxed = density === "comfort";
  const NUM_COLUMNS = 8; // visible data columns (for Columns badge)

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
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        x.refNo.toLowerCase().includes(q) ||
        x.partner.toLowerCase().includes(q) ||
        x.status.toLowerCase().includes(q) ||
        x.role.toLowerCase().includes(q) ||
        x.entityType.toLowerCase().includes(q) ||
        x.createdBy.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sortKey === "date") return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      if (sortKey === "amount") {
        const nA = Number(String(a.amount).replace(/[^0-9.-]/g, "")) || 0;
        const nB = Number(String(b.amount).replace(/[^0-9.-]/g, "")) || 0;
        return (nA - nB) * dir;
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * dir;
    });
    return r;
  }, [rows, typeFilter, search, sortKey, sortDir]);

  /* ─── Pagination ─── */
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / recordsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  // Reset to page 1 when filter/search/density change
  useEffect(() => { setCurrentPage(1); }, [typeFilter, search, recordsPerPage]);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return visibleRows.slice(start, start + recordsPerPage);
  }, [visibleRows, currentPage, recordsPerPage]);

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

  /** Sort toggle — same-key flips, new key defaults to desc for numeric/date cols. */
  const handleSort = (key: keyof (typeof rows)[number]) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  };

  const SortArrow = ({ colKey }: { colKey: keyof (typeof rows)[number] }) => (
    sortKey === colKey ? (
      sortDir === "asc"
        ? <ArrowUp className="w-3 h-3 inline ml-1" style={{ color: "hsl(var(--primary))" }} />
        : <ArrowDown className="w-3 h-3 inline ml-1" style={{ color: "hsl(var(--primary))" }} />
    ) : (
      <ArrowUpDown className="w-3 h-3 inline ml-1 text-muted-foreground/40 opacity-0 group-hover/th:opacity-100 transition-opacity" />
    )
  );

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

  /* ─── Column widths — summed for min-width to give sticky + scroll behaviour ─── */
  const COL_WIDTHS = {
    entityType: 150,
    refNo:      140,
    partner:    200,
    status:     140,
    role:       130,
    createdBy:  200,
    date:       130,
    amount:     130,
  } as const;
  const ACTIONS_W = 64;
  const TOTAL_W = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0) + ACTIONS_W;

  return (
    <div className="flex flex-col">
      {/* ═══ Performance Insights — collapsible, draggable KPI row (partner listing style) ═══ */}
      {showInsights && activeKpiDefs.length > 0 && (
        <div className="mb-4 shrink-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
              Linked Entities Insights
            </span>
            <button
              onClick={() => setInsightsPanelOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
            >
              <Plus className="w-3 h-3" />
              Add Insights
            </button>
          </div>
          {/* KPI Cards — draggable responsive grid */}
          <DndProvider backend={HTML5Backend}>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {activeKpiDefs.map((kpi, idx) => (
                <DraggableEntityKpiCard
                  key={kpi.key}
                  index={idx}
                  kpiKey={kpi.key}
                  label={kpi.label}
                  value={kpiValues[kpi.key] ?? "–"}
                  iconName={kpi.iconName}
                  moveCard={moveKpi}
                  onRemove={() => handleToggleKpi(kpi.key)}
                />
              ))}
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
              onClick={() => toast.info("Advanced filters — coming soon")}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
            >
              <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
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
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", fontWeight: 600 }}>
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
                  {density === "condensed" && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md" onSelect={() => setDensity("comfort")}>
                  <List className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1"><div className="text-sm" style={{ fontWeight: 500 }}>Comfort</div></div>
                  {density === "comfort" && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns button — matches ColumnSelectorTrigger style */}
            <button
              type="button"
              onClick={() => toast.info("Column customization — coming soon")}
              className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", fontWeight: 600 }}>
                {NUM_COLUMNS}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
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
                  color: isActive ? "hsl(var(--primary))" : undefined,
                }}
              >
                {opt.label}
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
              </button>
            );
          })}
        </div>

        <div className="border-t border-border shrink-0" />

        {/* ═══ Table — shadcn Table with fixed layout + sticky Actions ═══ */}
        <Table style={{ tableLayout: "fixed", width: `max(${TOTAL_W}px, 100%)` }}>
          <TableHeader className="bg-card">
            <TableRow className={`bg-muted/30 hover:bg-muted/30 ${isRelaxed ? "[&>th]:h-9" : "[&>th]:h-8"}`}>
              <TableHead onClick={() => handleSort("entityType")} style={{ width: COL_WIDTHS.entityType }} className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Type<SortArrow colKey="entityType" /></span></TableHead>
              <TableHead onClick={() => handleSort("refNo")}      style={{ width: COL_WIDTHS.refNo }}      className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Reference<SortArrow colKey="refNo" /></span></TableHead>
              <TableHead onClick={() => handleSort("partner")}    style={{ width: COL_WIDTHS.partner }}    className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Partner<SortArrow colKey="partner" /></span></TableHead>
              <TableHead onClick={() => handleSort("status")}     style={{ width: COL_WIDTHS.status }}     className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Status<SortArrow colKey="status" /></span></TableHead>
              <TableHead onClick={() => handleSort("role")}       style={{ width: COL_WIDTHS.role }}       className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">POC Role<SortArrow colKey="role" /></span></TableHead>
              <TableHead onClick={() => handleSort("createdBy")}  style={{ width: COL_WIDTHS.createdBy }}  className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Created By<SortArrow colKey="createdBy" /></span></TableHead>
              <TableHead onClick={() => handleSort("date")}       style={{ width: COL_WIDTHS.date }}       className="whitespace-nowrap cursor-pointer select-none group/th"><span className="text-[13px]">Created On<SortArrow colKey="date" /></span></TableHead>
              <TableHead onClick={() => handleSort("amount")}     style={{ width: COL_WIDTHS.amount }}     className="whitespace-nowrap cursor-pointer select-none group/th text-right"><span className="text-[13px]">Amount<SortArrow colKey="amount" /></span></TableHead>
              <TableHead className="whitespace-nowrap sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ width: ACTIONS_W, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}><span className="text-[13px]">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Briefcase className="w-7 h-7 opacity-60" />
                    <p className="text-sm">No linked entities{typeFilter !== "all" ? ` of type "${typeFilter}"` : ""} found{search ? ` matching "${search}"` : ""}.</p>
                    {(search || typeFilter !== "all") && (
                      <button onClick={() => { setSearch(""); setTypeFilter("all"); }} className="text-[12px] text-primary hover:underline" style={{ fontWeight: 500 }}>Clear filters</button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => {
                const meta = ENTITY_TYPE_META[row.entityType];
                const TIcon = meta.icon;
                const statusStyle = LINKED_ENTITY_STATUS_STYLES[row.status] || { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", border: "#CBD5E1" };
                const cbTint = getAvatarTint(row.createdBy);
                const cbPhoto = getPersonPhoto(row.createdBy);
                const cbInitials = row.createdBy.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => window.open(row.href, "_blank", "noopener,noreferrer")}
                    className={`hover:bg-[#F0F7FF] cursor-pointer group ${
                      isRelaxed ? "[&>td]:py-2.5" : "[&>td]:py-1.5"
                    }`}
                  >
                    <TableCell style={{ width: COL_WIDTHS.entityType }}>
                      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] truncate max-w-full" style={{ fontWeight: 500, backgroundColor: meta.bg, color: meta.color, borderColor: meta.border }}>
                        <TIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{row.entityType}</span>
                      </span>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.refNo }}>
                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground tabular-nums group-hover:text-primary group-hover:underline transition-colors`} style={{ fontWeight: 600 }}>{row.refNo}</span>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.partner }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate`} style={{ fontWeight: 500 }}>{row.partner}</span>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.status }}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border truncate max-w-full" style={{ fontWeight: 500, backgroundColor: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}>
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.role }}>
                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{row.role}</span>
                    </TableCell>
                    {/* Created By — clickable → opens QuickViewPanel */}
                    <TableCell style={{ width: COL_WIDTHS.createdBy }}>
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
                              meta: { role: "Team Member", dept: "Operations", email: `${row.createdBy.toLowerCase().replace(/\s/g, ".")}@company.com`, phone: "+1 (555) 000-0000" },
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
                        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors`} style={{ fontWeight: isRelaxed ? 500 : undefined }}>{row.createdBy}</span>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.date }}>
                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>{formatDate(row.date)}</span>
                    </TableCell>
                    <TableCell style={{ width: COL_WIDTHS.amount }} className="text-right">
                      <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground tabular-nums`} style={{ fontWeight: 600 }}>{row.amount}</span>
                    </TableCell>
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
          <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
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

