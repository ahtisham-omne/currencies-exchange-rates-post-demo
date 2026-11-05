import React, { useState, useRef, useMemo, useCallback, useEffect, useSyncExternalStore } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Package } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  Plus, Download, FileText, Clock, AlertTriangle, TrendingUp,
  ChevronDown, ShoppingCart, CheckCircle2, ArrowRight, Building2, X,
  Check, ExternalLink, ArrowLeft, GripVertical, Trash2, MoreHorizontal,
  Eye, Pencil,
} from "lucide-react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { getAllPOs, subscribeToPOStore, createPOFromBuyNow, getPO, duplicatePO, createPOFromVendorCheckout, computeExpectedPOCompletion, isPOArchived, archivePO, restorePO, ARCHIVE_CANCELS_STATUSES } from "./poStore";
import { ArchivePODialog } from "./ArchivePODialog";
import { PODocumentPreviewDialog } from "./PODocumentPreviewDialog";
import type { PurchaseOrderData } from "./poStore";
import ItemsCatalogueModal from "./CatalogueModal";
import { CATALOG } from "./catalogData";
import { getCart, subscribeToCart, addToCart as addToGlobalCart } from "./cartStore";
import type { CatalogItem } from "./catalogData";
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult, OrderFlowMode, OrderFlowPrefill } from "./OrderFlow";
import {
  type POFilterState,
  EMPTY_FILTERS,
} from "./POFilterBar";
import InsightsDrawer from "./InsightsDrawer";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import { getItemImages } from "./catalogData";
import PODataTable from "./PODataTable";
import POVersionHistoryModal from "./POVersionHistoryModal";
import { StateTransitionOverlay } from "./StateTransitionOverlay";
import { usePOTransitions } from "./usePOTransitions";
import { DuplicatePODialog } from "./PurchaseOrderDraft";
import { Copy } from "lucide-react";
import type { PurchaseOrder, ColumnId, ColumnDef, PORowAction } from "./PODataTable";
import { FONT, typography as sharedStyles } from "./designTokens";
import { getStatusBadgeCss, getFilterTabStyle } from "./statusColors";
import AppShell from "./layout/AppShell";
import TopBar from "./layout/TopBar";
import { PlannerDevWidget } from "./PlannerDevWidget";
import { POPermissionsDevWidget } from "./POPermissionsDevWidget";
import { permissionReason, useCan } from "./poPermissions";
import PageHeaderWithIcon from "./layout/PageHeaderWithIcon";
import UserHoverCard from "./UserHoverCard";
import ItemHoverCard from "./ItemHoverCard";
import PODashboard from "./PODashboard";
import PODemands from "./PODemands";
import { FlaskConical } from "lucide-react";
import { useOpenPlannerItems, useLastActiveItem } from "./plannerSession";
import {
  PATTERN_C2_CONTENT,
  PAGE_HEADER_FLEX,
} from "../../config/responsive-guidelines";

/* ═════════════════════════════════════════════════════════════
   CONSTANTS & TYPES
   ═══════════════════════════════════════════════════════════════ */

/* Types PurchaseOrder, ColumnId, ColumnDef imported from PODataTable */

type POStatus =
  | "Draft" | "Sent" | "Confirmed" | "Cancelled"
  | "Partially Received" | "Fully Received"
  | "Active with Cancellation" | "Closed with Cancellations" | "Closed";

interface OrderedItem { code: string; image: string; }

const AVAILABLE_COLUMNS: ColumnDef[] = [
  { id: "partnerLocation",  label: "Partner Location",   minWidth: 200, sortable: true },
  { id: "status",           label: "Status",             minWidth: 170 },
  { id: "orderedItems",     label: "Ordered Item(s)",    minWidth: 180, sortable: true },
  { id: "pointOfContact",   label: "Point of Contact",   minWidth: 170, sortable: true },
  { id: "location",         label: "Location",           minWidth: 160 },
  { id: "createdBy",        label: "Created By",         minWidth: 140 },
  { id: "dueDeliveryDate",  label: "Expected PO completion",  minWidth: 160 },
  { id: "orderDate",        label: "Need By Date",       minWidth: 130 },
];

const PARTNER_LOCATIONS = [
  { name: "General Motors (GM)", abbr: "GM" },
  { name: "Toyota Technical Center (TTC)", abbr: "TT" },
  { name: "Ford Motor Company", abbr: "FM" },
  { name: "Tesla, Inc.", abbr: "TI" },
  { name: "Chrysler (Stellantis N.V.)", abbr: "CS" },
  { name: "Rivian Automotive", abbr: "RA" },
  { name: "Lucid Motors", abbr: "LM" },
  { name: "Honda Motor Co., Ltd. (USA)", abbr: "HM" },
  { name: "Nissan North America", abbr: "NA" },
  { name: "BMW of North America", abbr: "BN" },
];

const CONTACTS = [
  "Sherry Brown", "Cameron Williamson", "Leslie Alexander",
  "Jerome Bell", "Marvin McKinney", "Brooklyn Simmons",
  "Savannah Nguyen", "Leslie Alexander", "Jerome Bell",
  "Cameron Williamson",
];
const CREATED_BY = [
  "Areeb Tanvir", "Shehryar Hasan",
  "Nophil Anwer", "Irtaza Abid", "Eli Rosenbloom",
];
const CURRENT_USER_CREATED_BY_VARIANTS = new Set(["areeb tanvir"]);
const isCurrentUserCreatedBy = (createdBy: string | undefined) => !!createdBy && CURRENT_USER_CREATED_BY_VARIANTS.has(createdBy.trim().toLowerCase());
const LOCATION_ADDRESSES: Record<string, string> = {
  "Pasadena, Oklahoma": "4500 Industrial Pkwy, Pasadena, OK 73001",
  "Great Falls, Maryland": "221 Commerce Blvd, Great Falls, MD 21046",
  "Lansing, Illinois": "780 Manufacturing Dr, Lansing, IL 60438",
  "Portland, Illinois": "1125 River Rd, Portland, IL 62374",
  "Lafayette, California": "300 Mt Diablo Blvd, Lafayette, CA 94549",
  "Stockton, New Hampshire": "55 Granite St, Stockton, NH 03227",
  "Omne Warehouse Network": "1200 Logistics Ave, Detroit, MI 48201",
  "Northeast Fulfillment": "88 Harbor Blvd, Newark, NJ 07102",
  "Great Lakes Depot": "450 Lakeshore Dr, Chicago, IL 60611",
  "Pacific Distribution Hub": "2700 Pacific Hwy, San Diego, CA 92101",
  "Southern Cross Logistics": "600 Peachtree St, Atlanta, GA 30308",
};

const LOCATIONS = Object.entries(LOCATION_ADDRESSES).slice(0, 10).map(([name, address]) => ({ name, address }));

const ITEM_IMAGES = [
  "https://images.unsplash.com/photo-1758873263428-f4b2edb45fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWV0YWwlMjBwYXJ0cyUyMGF1dG9tb3RpdmV8ZW58MXx8fHwxNzcxNzkzNDU4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1760842543713-108c3cadbba1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwY2lyY3VpdCUyMGJvYXJkJTIwY29tcG9uZW50fGVufDF8fHx8MTc3MTc5MzQ1OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1769971361558-3e32ddc52388?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGVlbCUyMGJvbHRzJTIwZmFzdGVuZXJzJTIwaGFyZHdhcmV8ZW58MXx8fHwxNzcxNzkzNDU5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxydWJiZXIlMjBnYXNrZXQlMjBzZWFsJTIwbWFudWZhY3R1cmluZ3xlbnwxfHx8fDE3NzE3OTM0NTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1648020265916-7d1d3a183a4c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3BwZXIlMjB3aXJlJTIwY29pbCUyMGVsZWN0cmljYWx8ZW58MXx8fHwxNzcxNzkzNDYwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHVtaW51bSUyMHNoZWV0JTIwbWV0YWwlMjBmYWJyaWNhdGlvbnxlbnwxfHx8fDE3NzE3OTM0NjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
];

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ══════════════════════════════════════════════════════════════ */

const s = {
  ...sharedStyles,
  thLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  cellId: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cellText: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cellMuted: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cellBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ══════════════════════════════════════════════════════════════
   MOCK DATA
   ══════════════════════════════════════════════════════════════ */

function genItemCode() {
  const a = String(Math.floor(Math.random() * 900000) + 100000);
  const b = String(Math.floor(Math.random() * 90) + 10);
  const c = String(Math.floor(Math.random() * 90) + 10);
  return `${a}-${b}-${c}`;
}

function fmtDate(d: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function generateMockData(): PurchaseOrder[] {
  const statuses: POStatus[] = [
    "Draft", "Sent", "Active with Cancellation", "Draft", "Sent",
    "Active with Cancellation", "Confirmed", "Partially Received",
    "Cancelled", "Fully Received", "Confirmed", "Partially Received",
    "Active with Cancellation", "Fully Received", "Draft", "Sent",
    "Closed with Cancellations", "Sent", "Draft", "Sent",
  ];
  const versions = [4, 5, 2, 1, 4, 3, 2, 3, 4, 3, 2, 1, 5, 4, 3, 2, 1, 4, 5, 2];
  const quoteValues = [
    230500, 95900, 51600, 430300, 425100, 289800, 213500, 338400, 324400, 317900,
    409800, 187600, 562100, 145300, 278900, 391200, 520800, 168400, 445700, 293600,
  ];
  // Fixed item codes matching the screenshot
  const itemCodes = [
    "100219-51-01", "100219-51-01", "100219-51-01", "3212-41-02",
    "100219-51-01", "IT8249-96", "099282-98", "100219-51-01",
    "100219-51-01", "100219-51-01", "100219-51-01", "84719-10",
    "001234-04", "100219-51-01", "000123-10", "109342-69",
    "454634-12", "100219-51-01", "857635-00", "328578-06",
  ];
  const moreCounts = [2, 4, 4, 3, 1, 1, 2, 2, 2, 2, 4, 2, 2, 1, 3, 1, 1, 1, 0, 2];
  const poNumbers = [
    "395-9825", "395-9823", "395-9824", "395-9826", "395-9827",
    "395-9828", "395-9829", "395-9830", "395-9831", "395-9832",
    "395-9823", "395-9834", "395-9835", "395-9836", "395-9837",
    "395-9838", "395-9839", "395-9840", "395-9841", "395-9842",
  ];
  return Array.from({ length: 20 }, (_, i) => {
    const partner = PARTNER_LOCATIONS[i % PARTNER_LOCATIONS.length];
    const contact = CONTACTS[i % CONTACTS.length];
    const createdBy = CREATED_BY[i % CREATED_BY.length];
    const contactInitials = contact.split(" ").map((w) => w[0]).join("").toUpperCase();
    const totalItems = (moreCounts[i] || 0) + 1;
    const baseDate = new Date(2024, 11, 23); // Dec 23, 2024
    return {
      id: `po-${i + 1}`,
      poNumber: poNumbers[i],
      version: versions[i % versions.length],
      partnerLocation: partner.name,
      partnerAbbr: partner.abbr,
      status: statuses[i % statuses.length],
      orderedItems: Array.from({ length: totalItems }, (__, j) => ({
        code: j === 0 ? itemCodes[i] : genItemCode(),
        image: ITEM_IMAGES[(i + j) % ITEM_IMAGES.length],
      })),
      pointOfContact: contact,
      pointOfContactAbbr: contactInitials,
      location: LOCATIONS[i % LOCATIONS.length].name,
      locationAddress: LOCATIONS[i % LOCATIONS.length].address,
      quoteValue: quoteValues[i % quoteValues.length],
      createdBy,
      dueDeliveryDate: fmtDate(new Date(baseDate.getTime() - i * 14 * 86400000)),
      orderDate: fmtDate(new Date(baseDate.getTime() - (14 + i * 14) * 86400000)),
      owner: isCurrentUserCreatedBy(createdBy) ? "me" : "other",
      hasNotification: i === 2 || i === 14,
    };
  });
}

const MOCK_DATA = generateMockData();

/* ═════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: POStatus }) {
  const style = getStatusBadgeCss(status);
  const isClosedWithCancellations = status === "Closed with Cancellations";
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 text-xs rounded-md border"
      style={{
        fontWeight: 500,
        fontFamily: FONT,
        ...style,
      }}
    >
      {status}
      {isClosedWithCancellations && (
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: "var(--status-active-cancel-text)" }}
        />
      )}
    </span>
  );
}

const AVATAR_COLORS = [
  { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFEFF", text: "#0891B2" },
  { bg: "#FFF1F2", text: "#E11D48" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#F0FDFA", text: "#0D9488" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#F5F5F4", text: "#57534E" },
];

function AvatarCircle({ name, size = 32, initials: customInitials }: { name: string; size?: number; initials?: string }) {
  const initials = customInitials || name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: "11px",
        fontWeight: 600,
        fontFamily: FONT,
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      {initials}
    </span>
  );
}

/** Abbreviation avatar — Partners spec: 32x32. Companies use rounded-lg, people use rounded-full. */
function LetterAvatar({
  letter,
  name,
  shape = "lg",
}: {
  letter: string;
  name: string;
  shape?: "lg" | "full";
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden border ${
        shape === "lg" ? "rounded-lg" : "rounded-full"
      }`}
      style={{
        width: 32,
        height: 32,
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: FONT,
        backgroundColor: color.bg,
        color: "rgb(51, 65, 85)",
        borderColor: "#E8ECF1",
      }}
    >
      {letter}
    </span>
  );
}

const DND_KPI = "kpi-card";

/** Draggable + removable KPI card matching Partners' interaction pattern */
function DraggableKpiCard({
  index,
  id,
  label,
  value,
  Icon,
  moveCard,
  onRemove,
}: {
  index: number;
  id: string;
  label: string;
  value: string;
  Icon?: React.ElementType;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;
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
        className="rounded-lg border border-dashed shrink-0 pointer-events-none"
        style={{ width: 211, minHeight: 52, borderColor: "hsl(var(--primary) / 0.2)", backgroundColor: "hsl(var(--primary) / 0.02)" }}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`group relative rounded-lg border bg-card shrink-0 min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
      style={{ width: 211, fontFamily: FONT }}
      data-kpi-id={id}
    >
      {/* Drag handle hint — top-right on hover */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
        <GripVertical className="w-3.5 h-3.5" style={{ color: "rgb(100, 116, 139)" }} />
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-1 min-w-0">
          <p
            className="text-[10.5px] whitespace-nowrap truncate"
            style={{ fontWeight: 500, color: "rgb(100, 116, 139)" }}
          >
            {label}
          </p>
          {Icon && (
            <Icon className="w-3 h-3 shrink-0" style={{ color: "rgb(148, 163, 184)" }} />
          )}
        </div>
        <p
          className="text-[15px] leading-tight"
          style={{ fontWeight: 600, color: "rgb(51, 65, 85)" }}
        >
          {value}
        </p>
      </div>
      {/* Remove button — bottom-right on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
        title={`Remove ${label}`}
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
      </button>
    </div>
  );
}

/** Version badge (v1, v2, etc.) */
function VersionBadge({ version }: { version: number }) {
  const vColors: Record<number, { bg: string; text: string }> = {
    1: { bg: "var(--version-1-bg)", text: "var(--version-1-text)" },
    2: { bg: "var(--version-2-bg)", text: "var(--version-2-text)" },
    3: { bg: "var(--version-3-bg)", text: "var(--version-3-text)" },
    4: { bg: "var(--version-4-bg)", text: "var(--version-4-text)" },
    5: { bg: "var(--version-5-bg)", text: "var(--version-5-text)" },
  };
  const c = vColors[version] || vColors[1];
  return (
    <span
      className="inline-flex items-center justify-center rounded-[3px] shrink-0"
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-weight-semibold)",
        fontFamily: FONT,
        lineHeight: "16px",
        padding: "1px 6px",
        backgroundColor: c.bg,
        color: c.text,
      }}
    >
      v{version}
    </span>
  );
}

function MeBadge() {
  return (
    <span
      className="inline-flex items-center rounded-[3px] bg-primary/10 text-primary px-1 py-px ml-1.5 shrink-0"
      style={{ fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-semibold)", lineHeight: "14px", fontFamily: FONT, letterSpacing: "0.03em" }}
    >
      ME
    </span>
  );
}

/** Ordered items: thumbnail + code + hoverable "+N more" popover */
function OrderedItemsCell({ items, relaxed = false, onImageClick }: { items: OrderedItem[]; relaxed?: boolean; onImageClick?: (item: OrderedItem) => void }) {
  const first = items[0];
  const moreCount = items.length - 1;
  const [popover, setPopover] = useState<DOMRect | null>(null);
  const hoverTimeout = useRef<number | null>(null);

  const cancelClose = () => { if (hoverTimeout.current) { clearTimeout(hoverTimeout.current); hoverTimeout.current = null; } };
  const startClose = () => { cancelClose(); hoverTimeout.current = window.setTimeout(() => setPopover(null), 150); };

  return (
    <div className="flex items-center gap-2">
      <ItemHoverCard code={first.code} imageUrl={first.image}>
        <div
          className={`${relaxed ? "size-10" : "w-7 h-7"} rounded-md bg-muted overflow-hidden shrink-0 border cursor-pointer`}
          style={{ borderColor: "#E8ECF1" }}
          onClick={(e) => { e.stopPropagation(); onImageClick?.(first); }}
        >
          <ImageWithFallback
            src={first.image}
            alt="Item"
            className="w-full h-full object-cover"
          />
        </div>
      </ItemHoverCard>
      <div className="min-w-0 cursor-pointer group/itemcode">
        <span
          className="text-sm block truncate group-hover/itemcode:text-primary group-hover/itemcode:underline transition-colors"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          {first.code}
        </span>
      </div>
      {moreCount > 0 && (
        <span
          className="text-[11px] shrink-0 cursor-default leading-none whitespace-nowrap"
          style={{ fontWeight: 600, color: "hsl(var(--primary))", fontFamily: FONT }}
          onClick={e => e.stopPropagation()}
          onMouseEnter={e => { cancelClose(); setPopover(e.currentTarget.getBoundingClientRect()); }}
          onMouseLeave={startClose}
        >
          +{moreCount} more
        </span>
      )}
      {popover && (
        <ItemsHoverPopover
          rect={popover}
          items={items}
          onMouseEnter={cancelClose}
          onMouseLeave={() => setPopover(null)}
          onImageClick={onImageClick}
        />
      )}
    </div>
  );
}

/** Hover popover listing all ordered items — matches Category project design */
function ItemsHoverPopover({
  rect,
  items,
  onMouseEnter,
  onMouseLeave,
  onImageClick,
}: {
  rect: DOMRect;
  items: OrderedItem[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onImageClick?: (item: OrderedItem) => void;
}) {
  const flipUp = rect.bottom + 220 > window.innerHeight;
  return (
    <div
      className="fixed z-50"
      style={{
        top: flipUp ? undefined : rect.bottom + 4,
        bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        background: "hsl(var(--card))",
        border: "0.75px solid hsl(var(--border))",
        borderRadius: 8,
        boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)",
        padding: 0,
        minWidth: 220,
        maxWidth: 280,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3"
        style={{ height: 32, borderBottom: "0.75px solid hsl(var(--border))" }}
      >
        <span
          style={{
            fontSize: "var(--text-3xs)",
            fontWeight: "var(--font-weight-semibold)",
            color: "hsl(var(--muted-foreground))",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: FONT,
          }}
        >
          Items
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-weight-semibold)",
            color: "hsl(var(--muted-foreground))",
            fontFamily: FONT,
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Item list */}
      <div style={{ maxHeight: 5 * 38, overflowY: items.length > 5 ? "auto" : undefined, paddingBottom: items.length >= 5 ? 6 : 0 }}>
        {items.map((item, idx) => (
          <div
            key={`${item.code}-${idx}`}
            className="flex items-center gap-2.5 transition-colors"
            style={{ padding: "6px 12px", fontSize: "var(--text-label)", fontFamily: FONT, color: "hsl(var(--foreground))" }}
            onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--secondary))")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div
              className="size-[22px] rounded-[5px] overflow-hidden border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
              onClick={(e) => { e.stopPropagation(); onImageClick?.(item); }}
            >
              <ImageWithFallback
                src={item.image}
                alt="Item"
                className="w-full h-full object-cover"
              />
            </div>
            <span style={{ fontSize: 12, fontFamily: FONT }}>{item.code}</span>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <div style={{ fontSize: "var(--text-3xs)", color: "hsl(var(--muted-foreground))", textAlign: "center", padding: "4px 0 6px", borderTop: "0.75px solid hsl(var(--border))", fontFamily: FONT }}>
          Scroll for more
        </div>
      )}
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      {/* Partners' canonical yellow-highlight recipe (`Partners/.../ColumnHeaderMenu.tsx:32`) */}
      <mark
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════��═════════════════ */

interface PurchaseOrdersListingProps {
  /** Route-driven override for the top tab. Each of the three
   *  PO surfaces (`/purchase-orders`, `/procurement-planning`,
   *  `/dashboard`) is a dedicated route now; the wrapper passes
   *  the corresponding id so the initial paint (heading,
   *  subtitle, breadcrumb, body) matches the URL. Tab-switching
   *  happens via the sidebar — the old in-page tab strip is
   *  gone. */
  initialTopTab?: "purchase-orders" | "dashboard" | "demands";
}

/* Print / Download source for a listing row — the store PO when there
   is one, otherwise a minimal PurchaseOrderData built from the row. */
function printSourceFor(item: PurchaseOrder): PurchaseOrderData {
  return getPO(item.id) ?? {
    id: item.id,
    poNumber: item.poNumber,
    status: item.status as PurchaseOrderData["status"],
    orderDate: item.orderDate ? new Date(item.orderDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    deliveryDate: item.dueDeliveryDate ? new Date(item.dueDeliveryDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { name: item.partnerLocation, address: "", phone: "", email: "", taxId: "" },
    recipient: { name: item.pointOfContact, role: "Vendor Contact", email: "", phone: "" },
    secondaryContactNames: [],
    lineItems: item.orderedItems.map((oi, idx) => ({
      id: `print-${item.id}-${idx}`,
      itemNumber: oi.code,
      descriptiveName: oi.code,
      image: oi.image,
      unitPrice: (item.quoteValue || 50000) / Math.max(1, item.orderedItems.length),
      vendorQty: 1,
      vendorUOM: "Unit",
      vendorUOMQty: 1,
      quantity: 1,
      defaultUOM: "Unit",
      discount: 0,
      lineTotal: (item.quoteValue || 50000) / Math.max(1, item.orderedItems.length),
      shipmentMethod: "fedex-ground",
      needByDate: item.dueDeliveryDate ? new Date(item.dueDeliveryDate).toISOString().split("T")[0] : "",
      inboundLocation: item.location,
      category: "General",
      receivedQuantity: 0,
    })),
    payment: { paymentTerms: "Net 30", payTo: item.partnerLocation, paymentMethod: "Wire Transfer", shippedTo: item.location, fundedBy: "Omne Manufacturing Corp." },
    subtotal: item.quoteValue || 50000,
    shippingFee: 0,
    discountTotal: 0,
    total: item.quoteValue || 50000,
    notes: "",
    poNotes: [],
    createdBy: item.createdBy,
    receivingRecords: [],
    currentVersion: item.version,
    versions: [],
  };
}

export default function PurchaseOrdersListing({ initialTopTab }: PurchaseOrdersListingProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Initialize state from URL search params (one-time read) ──
     `topTab` is canonicalized so a buyer who deep-links to (or returns
     from a detail view via Back) lands on the exact same surface they
     were on. Without this, every back-navigation reset the page to the
     default "Purchase Orders" tab even when the buyer was on
     "Procurement Planning" or "Dashboard". */
  const [initialState] = useState(() => {
    const p = searchParams;
    const rawTopTab = p.get("topTab");
    /* Priority: explicit prop from the route wrapper > `?topTab=`
       query fallback (deep-link back-compat) > default. */
    const queryTopTab: "purchase-orders" | "dashboard" | "demands" =
      rawTopTab === "dashboard" || rawTopTab === "demands" || rawTopTab === "purchase-orders"
        ? rawTopTab
        : "purchase-orders";
    const topTab = initialTopTab ?? queryTopTab;
    return {
      topTab,
      tab: p.get("tab") || "all",
      q: p.get("q") || "",
      filters: {
        status: (p.get("status")?.split(",").filter(Boolean) || []) as POFilterState["status"],
        partnerLocation: p.get("partner")?.split(",").filter(Boolean) || [],
        pointOfContact: p.get("contact")?.split(",").filter(Boolean) || [],
        createdBy: p.get("creator")?.split(",").filter(Boolean) || [],
        location: p.get("location")?.split(",").filter(Boolean) || [],
        dueDateFrom: p.get("dueFrom") || "",
        dueDateTo: p.get("dueTo") || "",
        orderDateFrom: p.get("orderFrom") || "",
        orderDateTo: p.get("orderTo") || "",
        ownership: (p.get("me") === "1" ? "me" : "all") as "all" | "me",
      } satisfies POFilterState,
    };
  });

  /* ── Top-level page tab: Purchase Orders | Procurement Planning | Dashboard ──
     Defaults to Purchase Orders (the primary surface for buyers). The
     "Procurement Planner" tab was retired in favour of the in-place
     `PlannerSandboxModal` that opens from the item detail modal's
     "Plan in sandbox" CTA. Keeping a separate tab was duplicating the
     surface — Procurement Planning (formerly Demands) already answers
     "what's short?" and the sandbox modal handles the "design a fix"
     workflow. */
  const [topTab, setTopTab] = useState<"purchase-orders" | "dashboard" | "demands">(initialState.topTab);
  /* Pioneer v1.0 permission gates. Reactive — flipping a toggle in the
     POPermissionsDevWidget re-renders every consumer. All defaults match
     the spec (Access On, everything else Off). */
  const canAccessPO = useCan("po.access");
  const canCreateEditPO = useCan("po.create_edit");
  const canCancelArchivePO = useCan("po.cancel_archive");
  /* `po.bulk_import` and `po.one_time_discounts` are scaffolded in the
     store + widget but have no dedicated UI to gate yet — enforcement
     lands when those affordances ship. */
  /* Version-history modal opens from the V{n} chip on any row. `null` =
     closed. Stores the PO id + poNumber so the modal can load the correct
     history and render the header title. */
  const [versionHistoryPO, setVersionHistoryPO] = useState<{ id: string; poNumber: string } | null>(null);
  /* Duplicate row-action overlay — mirrors SO's animated transition.
     Wraps the existing `duplicatePO` / `createPOFromVendorCheckout` calls
     so the 1800ms `StateTransitionOverlay` plays before navigation. */
  const poTransitions = usePOTransitions();

  /* Inline Duplicate PO dialog — opens directly on the listing when
     the row action fires (buyer 2026-07-28: "This doesn't need to
     redirect on the detail page it needs to be open only this modal").
     Only store-backed rows can open it because the dialog needs the
     full PurchaseOrderData (versions, vendor, etc.); mock rows fall
     back to the quick animated duplicate below. */
  const [duplicateDialogPO, setDuplicateDialogPO] = useState<PurchaseOrderData | null>(null);
  const [duplicateSourceVersion, setDuplicateSourceVersion] = useState<number>(1);
  const [duplicateViewDetailsOpen, setDuplicateViewDetailsOpen] = useState(false);
  useEffect(() => {
    if (duplicateDialogPO) {
      setDuplicateSourceVersion(duplicateDialogPO.currentVersion);
    }
  }, [duplicateDialogPO]);

  /* Sandbox session bookkeeping — read here (not just inside PODemands) so
     the Procurement Planning top-tab header can render an "Open sandbox"
     primary action that replaces the Cart + Create-PO buttons on that tab.
     Same session store PODemands subscribes to, so counts stay consistent. */
  const plannerOpenItems = useOpenPlannerItems();
  const plannerLastActiveItem = useLastActiveItem();
  /* Whether PODemands is past its FTU questionnaire (buyer pressed "Show my
     demand" and the table is now visible). Defaults false so the top-of-
     page "Open sandbox" CTA does NOT render on the FTU landing — per
     feedback ("we don't need to show button on this page"). PODemands
     broadcasts the flip via `onScopeAppliedChange` on mount + on apply. */
  const [plannerScopeApplied, setPlannerScopeApplied] = useState(false);

  const [searchTerm, setSearchTerm] = useState(initialState.q);
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [filters, setFilters] = useState<POFilterState>(initialState.filters);
  /* Quick-filter pill state — single-select, independent from the modal's
     `filters.status` (multi-select). Pills are radio-style: clicking a new
     status replaces the previous one. The modal's status array stays
     untouched, and both apply via AND when filtering rows. */
  const [quickStatus, setQuickStatus] = useState<"all" | POStatus | "Archived">("all");
  /* Archive window target (ERP-4744 / ERP-4772). */
  const [archiveTarget, setArchiveTarget] = useState<PurchaseOrder | null>(null);
  /* Print / Download preview (row menu > Print PO / Download PDF). */
  const [docPreview, setDocPreview] = useState<{ po: PurchaseOrderData; mode: "print" | "download" } | null>(null);
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(AVAILABLE_COLUMNS.map((c) => c.id));
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ColumnId[]>([]);
  const [storePOs, setStorePOs] = useState<PurchaseOrderData[]>([]);

  /* ── Catalogue modal overlay state (direct entry point — replaces search modal) ── */
  const [catalogueModalOpen, setCatalogueModalOpen] = useState(false);
  const [catalogueInitialSearch, setCatalogueInitialSearch] = useState("");
  const [catalogueInitialVendor, setCatalogueInitialVendor] = useState("");

  /* ── Drawer states ── */
  const [insightsDrawerOpen, setInsightsDrawerOpen] = useState(false);
  /* Default KPIs on the strip — buyer 2026-07-31 trimmed to five
     status snapshots. All five come from the "Order Status" group in
     the Insights drawer. */
  const [activeInsightIds, setActiveInsightIds] = useState<string[]>([
    "total-orders",
    "cancelled-orders",
    "active-with-cancellations",
    "closed-with-cancellations",
    "fully-received-orders",
  ]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  /* ── Unified OrderFlow + vendor-assign states ── */
  const [orderFlowItem, setOrderFlowItem] = useState<CatalogItem | null>(null);
  const [orderFlowMode, setOrderFlowMode] = useState<OrderFlowMode>("add-to-cart");

  /* ── QuickView modal state (item + contact) ── */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);

  const handleThumbnailClick = useCallback((oi: OrderedItem, parentItem?: PurchaseOrder) => {
    setQuickViewData({
      type: "item",
      item: { id: oi.code, name: oi.code, imageUrl: oi.image },
      vendorName: parentItem?.partnerLocation || "—",
    });
  }, []);

  const handleContactClick = useCallback((name: string, vendorName?: string) => {
    if (!name) return;
    const initials = name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const tints = [
      { bg: "hsl(var(--accent))", fg: "hsl(var(--primary))" },
      { bg: "#F0FDF4", fg: "#16A34A" },
      { bg: "#FFF7ED", fg: "#EA580C" },
      { bg: "#F5F3FF", fg: "#7C3AED" },
      { bg: "#ECFEFF", fg: "#0891B2" },
      { bg: "#FFF1F2", fg: "#E11D48" },
      { bg: "#FEF9C3", fg: "#A16207" },
      { bg: "#F0FDFA", fg: "#0D9488" },
      { bg: "#FDF2F8", fg: "#DB2777" },
      { bg: "#EFF6FF", fg: "#2563EB" },
      { bg: "#F5F5F4", fg: "#57534E" },
    ];
    const t = tints[Math.abs(hash) % tints.length];
    setQuickViewData({
      type: "contact",
      item: { id: name, name, initials, avatarBg: t.bg, avatarFg: t.fg },
      vendorName: vendorName || "—",
    });
  }, []);

  /* ── Global Cart (shared store) ── */
  const globalCart = useSyncExternalStore(subscribeToCart, getCart, getCart);
  const cartItemCount = globalCart.length;
  const [orderFlowPrefill, setOrderFlowPrefill] = useState<OrderFlowPrefill | null>(null);

  const [createdPOs, setCreatedPOs] = useState<Array<{ id: string; poNumber: string; vendor: string; itemCount: number; total: number }> | null>(null);
  const [createdPOsChecked, setCreatedPOsChecked] = useState<Set<string>>(new Set());

  /* ── Sync filter/search/tab state TO URL params (replace, no history pollution) ──
     `topTab` is NOT written here anymore — the top tab is owned
     by the URL PATH now (each of the 3 tabs has its own route),
     so writing `?topTab=…` would duplicate that. Other filter
     state is still query-driven so Back restores the exact same
     sub-tab / search / filter combo. */
  useEffect(() => {
    const p = new URLSearchParams();
    if (activeTab !== "all") p.set("tab", activeTab);
    if (searchTerm) p.set("q", searchTerm);
    if (filters.ownership === "me") p.set("me", "1");
    if (filters.status.length) p.set("status", filters.status.join(","));
    if (filters.partnerLocation.length) p.set("partner", filters.partnerLocation.join(","));
    if (filters.pointOfContact.length) p.set("contact", filters.pointOfContact.join(","));
    if (filters.createdBy.length) p.set("creator", filters.createdBy.join(","));
    if (filters.location.length) p.set("location", filters.location.join(","));
    if (filters.dueDateFrom) p.set("dueFrom", filters.dueDateFrom);
    if (filters.dueDateTo) p.set("dueTo", filters.dueDateTo);
    if (filters.orderDateFrom) p.set("orderFrom", filters.orderDateFrom);
    if (filters.orderDateTo) p.set("orderTo", filters.orderDateTo);
    setSearchParams(p, { replace: true });
  }, [activeTab, searchTerm, filters, setSearchParams]);

  /* ── Keep top tab in sync with the incoming route prop ──
     When the buyer clicks a different sibling in the sidebar
     (e.g. /purchase-orders → /procurement-planning), React
     Router hands us a new `initialTopTab`; mirror it into local
     state so the tab strip repaints without a remount. */
  useEffect(() => {
    if (initialTopTab && initialTopTab !== topTab) {
      setTopTab(initialTopTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopTab]);

  /* ── Auto-open catalogue modal when navigated from Homepage "Create PO" action ── */
  useEffect(() => {
    const state = location.state as { openSearchModal?: boolean } | null;
    if (state?.openSearchModal) {
      setCatalogueInitialSearch("");
      setCatalogueInitialVendor("");
      setCatalogueModalOpen(true);
      // Clear state so refreshing doesn't re-open the modal
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  /* ── Convert CatalogItem → OrderFlowItem for OrderFlow ── */
  const toFlowItem = useCallback((item: CatalogItem): OrderFlowItem => ({
    id: item.id, itemNumber: item.itemNumber, descriptiveName: item.descriptiveName,
    image: item.image, unitPrice: item.unitPrice, currentStock: item.currentStock,
    minQuantity: item.minQuantity, shortageDate: item.shortageDate, partnerLocation: item.partnerLocation,
    category: item.category, location: item.location, vendorUOM: item.vendorUOM,
    vendorUOMQty: item.vendorUOMQty, defaultUOM: item.defaultUOM, discount: item.discount,
  }), []);

  /* ── Close OrderFlow ── */
  const closeOrderFlow = useCallback(() => {
    setOrderFlowItem(null);
    setOrderFlowMode("add-to-cart");
  }, []);

  /** Unified onComplete handler -- dispatches based on result.completedMode */
  const handleOrderFlowComplete = useCallback((result: OrderFlowResult) => {
    const actionMode = result.completedMode || orderFlowMode;
    if (result && (actionMode === "add-to-cart" || actionMode === "edit-cart")) {
      // Add to global cart
      const catalogRef = CATALOG.find((c) => c.id === result.item.id);
      if (catalogRef) {
        addToGlobalCart({
          catalogItem: catalogRef,
          vendorQty: result.vendorQty,
          quantity: result.quantity,
          unitPrice: result.unitPrice,
          discount: result.discount,
          shipmentMethod: result.shipmentMethod,
          needByDate: result.needByDate,
          promisedShipDate: result.promisedShipDate,
          expectedDeliveryDate: result.expectedDeliveryDate,
          inboundLocation: result.inboundLocation,
          oneTimeAdjustments: result.oneTimeAdjustments,
        });
      }
      closeOrderFlow();
      // Navigate to cart page so user can see the item was added
      navigate("/cart");
    } else if (actionMode === "buy-now") {
      const po = createPOFromBuyNow(
        {
          id: result.item.id, itemNumber: result.item.itemNumber, descriptiveName: result.item.descriptiveName,
          image: result.item.image, unitPrice: result.item.unitPrice, vendorUOM: result.item.vendorUOM,
          vendorUOMQty: result.item.vendorUOMQty, defaultUOM: result.item.defaultUOM, discount: result.item.discount,
          partnerLocation: result.item.partnerLocation, category: result.item.category,
        },
        {
          vendorQty: result.vendorQty, quantity: result.quantity, shipByDate: result.shipByDate,
          shipmentMethod: result.shipmentMethod, needByDate: result.needByDate, promisedShipDate: result.promisedShipDate,
          expectedDeliveryDate: result.expectedDeliveryDate,
          inboundLocation: result.inboundLocation, contactName: result.vendorContactName,
          contactEmail: result.vendorContactEmail, contactPhone: result.vendorContactPhone,
          notes: result.notes, totalPrice: result.totalPrice,
          oneTimeAdjustments: result.oneTimeAdjustments,
        }
      );
      closeOrderFlow();
      navigate(`/purchase-orders/${po.id}`);
    }
  }, [orderFlowMode, navigate, closeOrderFlow]);

  /* ── Subscribe to PO store for newly created POs ── */
  useEffect(() => {
    setStorePOs(getAllPOs());
    const unsub = subscribeToPOStore(() => {
      setStorePOs(getAllPOs());
    });
    return unsub;
  }, []);

  /* ── Convert store POs to listing format and merge ── */
  const allData = useMemo(() => {
    const statusMap: Record<string, string> = {
      "Active with Cancellations": "Active with Cancellation",
      "Fully Received with Cancellations": "Closed with Cancellations",
    };
    const storeMapped: PurchaseOrder[] = storePOs.map((spo) => {
      const partner = PARTNER_LOCATIONS.find((p) => p.name === spo.vendor.name);
      const contactInitials = spo.recipient.name.split(" ").map((w) => w[0]).join("").toUpperCase();
      return {
        id: spo.id,
        poNumber: spo.poNumber,
        version: spo.currentVersion || 1,
        partnerLocation: spo.vendor.name,
        partnerAbbr: partner?.abbr || spo.vendor.name.slice(0, 2).toUpperCase(),
        status: (statusMap[spo.status] || spo.status) as POStatus,
        orderedItems: spo.lineItems.filter((li) => !li.cancelled).map((li) => ({ code: li.itemNumber, image: li.image })),
        pointOfContact: spo.recipient.name,
        pointOfContactAbbr: contactInitials,
        location: spo.payment.shippedTo,
        locationAddress: LOCATION_ADDRESSES[spo.payment.shippedTo] || spo.payment.shippedTo,
        quoteValue: spo.total || 50000,
        createdBy: spo.createdBy,
        // Feed the row's "dueDeliveryDate" slot (kept as the column id for
        // backward-compat with layout code) from the derived Expected PO
        // completion — max(expectedDeliveryDate) across lines, falling back
        // to max(needByDate). If no line data, use the header deliveryDate.
        dueDeliveryDate: (() => {
          const iso = computeExpectedPOCompletion(spo) || spo.deliveryDate;
          return fmtDate(new Date(iso + "T00:00:00"));
        })(),
        orderDate: fmtDate(new Date(spo.orderDate + "T00:00:00")),
        owner: isCurrentUserCreatedBy(spo.createdBy) ? "me" : "other",
        hasNotification: false,
      };
    });
    /* Store POs are the source of truth; MOCK_DATA fills any gaps */
    const storeIds = new Set(storeMapped.map((s) => s.id));
    const remainingMock = MOCK_DATA.filter((m) => !storeIds.has(m.id));
    return [...storeMapped, ...remainingMock].map((d) => ({ ...d, archived: isPOArchived(d.id) }));
  }, [storePOs]);

  /* ── Derived ── */
  const filteredData = useMemo(() => {
    let data = [...allData];

    // ── STATUS FILTERING ──
    // Two independent status filters:
    //   1. `quickStatus` — single-select pill (radio behavior). Set from the
    //      toolbar's status tabs.
    //   2. `filters.status` — multi-select array from the Filters modal.
    // Both apply via AND so a row passes only when it matches both checks.
    // Archived POs show only under the Archived pill (cross-module rule).
    if (quickStatus === "Archived") {
      data = data.filter((d) => d.archived);
    } else {
      data = data.filter((d) => !d.archived);
      if (quickStatus !== "all") data = data.filter((d) => d.status === quickStatus);
    }
    if (filters.status.length > 0) {
      data = data.filter((d) => filters.status.includes(d.status));
    }

    // ── OWNERSHIP ──
    if (filters.ownership === "me") data = data.filter((d) => isCurrentUserCreatedBy(d.createdBy));

    // ── SEARCH ──
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((d) =>
        (d.poNumber || "").toLowerCase().includes(q) ||
        (d.partnerLocation || "").toLowerCase().includes(q) ||
        (d.pointOfContact || "").toLowerCase().includes(q) ||
        (d.createdBy || "").toLowerCase().includes(q) ||
        d.orderedItems.some((item) => (item.code || "").toLowerCase().includes(q))
      );
    }

    // ── NON-STATUS CUSTOM FILTERS ──
    if (filters.partnerLocation.length > 0) data = data.filter((d) => filters.partnerLocation.includes(d.partnerLocation));
    if (filters.pointOfContact.length > 0) data = data.filter((d) => filters.pointOfContact.includes(d.pointOfContact));
    if (filters.createdBy.length > 0) data = data.filter((d) => filters.createdBy.includes(d.createdBy));
    if (filters.location.length > 0) data = data.filter((d) => filters.location.includes(d.location));

    // Date range filters — parse the display date strings back for comparison
    if (filters.dueDateFrom || filters.dueDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.dueDeliveryDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.dueDateFrom) {
          const from = new Date(filters.dueDateFrom + "T00:00:00");
          if (parsed < from) return false;
        }
        if (filters.dueDateTo) {
          const to = new Date(filters.dueDateTo + "T23:59:59");
          if (parsed > to) return false;
        }
        return true;
      });
    }
    if (filters.orderDateFrom || filters.orderDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.orderDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.orderDateFrom) {
          const from = new Date(filters.orderDateFrom + "T00:00:00");
          if (parsed < from) return false;
        }
        if (filters.orderDateTo) {
          const to = new Date(filters.orderDateTo + "T23:59:59");
          if (parsed > to) return false;
        }
        return true;
      });
    }
    return data;
  }, [searchTerm, filters, quickStatus, allData]);

  const resetFilters = () => setFilters({ ...EMPTY_FILTERS, ownership: filters.ownership });

  /** When user clicks a status tab, the tab acts as an
      additional AND scope — status filters from the modal
      remain active and further narrow results within the tab. */
  const handleTabChange = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
  }, []);


  const toggleInsight = useCallback((id: string) => {
    setActiveInsightIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setActiveInsightIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /* ── Row action handler ── */
  const handleRowAction = useCallback((action: PORowAction, item: PurchaseOrder) => {
    switch (action) {
      case "view":
        navigate(`/purchase-orders/${item.id}`);
        break;
      case "send-to-vendor":
        toast.success(`PO ${item.poNumber} sent to vendor`);
        break;
      case "mark-confirmed":
        toast.success(`PO ${item.poNumber} marked as Confirmed`);
        break;
      case "mark-partially-received":
        toast.success(`PO ${item.poNumber} marked as Partially Received`);
        break;
      case "mark-fully-received":
        toast.success(`PO ${item.poNumber} marked as Fully Received`);
        break;
      case "duplicate": {
        /* Store-backed POs open the same DuplicatePODialog the detail
           page uses, inline on the listing (buyer 2026-07-28: "This
           doesn't need to redirect on the detail page it needs to be
           open only this modal"). Mock rows can't drive the dialog
           (they don't have versions or a real vendor entity), so they
           still fall through to the animated quick-duplicate. */
        const storePO = getPO(item.id);
        if (storePO) {
          setDuplicateDialogPO(storePO);
        } else {
          poTransitions.start({
            fromLabel: item.poNumber,
            toLabel: "New Draft",
            tone: "info",
            Icon: Copy,
            heading: "Duplicating PO",
            meta: item.poNumber,
            commit: () => {
              const newPO = createPOFromVendorCheckout(
                item.partnerLocation,
                item.orderedItems.map((oi, idx) => ({
                  id: `dup-${item.id}-${idx}`,
                  itemNumber: oi.code,
                  descriptiveName: oi.code,
                  image: oi.image,
                  unitPrice: (item.quoteValue || 50000) / Math.max(1, item.orderedItems.length),
                  vendorQty: 1,
                  vendorUOM: "Unit",
                  vendorUOMQty: 1,
                  quantity: 1,
                  defaultUOM: "Unit",
                  discount: 0,
                  shipmentMethod: "fedex-ground",
                  needByDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
                  inboundLocation: item.location,
                  category: "General",
                })),
                "",
              );
              toast.success("PO duplicated.", {
                description: `A copy of ${item.poNumber} was created as a new draft.`,
                position: "top-right",
              });
              navigate(`/purchase-orders/${newPO.id}`, { state: { fromDuplicate: true } });
            },
          });
        }
        break;
      }
      case "print":
      case "download-pdf":
        /* Both open the in-app document preview — Print or Download PDF
           (the download used to be a toast-only stub). */
        setDocPreview({ po: printSourceFor(item), mode: action === "print" ? "print" : "download" });
        break;
      case "archive":
        if (!canCancelArchivePO) {
          toast.error("Cannot archive PO", {
            description: permissionReason("po.cancel_archive"),
          });
          break;
        }
        setArchiveTarget(item);
        break;
      case "restore":
        restorePO(item.id);
        toast.success(`PO ${item.poNumber} restored`);
        break;
    }
  }, [navigate, canCancelArchivePO]);

  /* ── Cell renderers ── */
  const renderCell = (col: ColumnDef, item: PurchaseOrder, viewMode?: "compact" | "comfort" | "grid"): React.ReactNode => {
    switch (col.id) {
      case "partnerLocation":
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <LetterAvatar letter={item.partnerAbbr} name={item.partnerLocation} shape="lg" />
            <div className="min-w-0 flex-1">
              <span
                className="text-sm block truncate"
                style={{ fontWeight: 500, color: "rgb(30, 41, 59)", fontFamily: FONT }}
              >
                {highlightText(item.partnerLocation, searchTerm)}
              </span>
            </div>
          </div>
        );
      case "status":
        return <StatusBadge status={item.status} />;
      case "orderedItems":
        return <OrderedItemsCell items={item.orderedItems} relaxed={viewMode === "comfort"} onImageClick={(oi) => handleThumbnailClick(oi, item)} />;
      case "pointOfContact": {
        const poc = item.pointOfContact || "";
        const pocInitials = poc
          ? poc.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase()
          : "—";
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserHoverCard name={poc}>
              <div
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleContactClick(poc, item.partnerLocation); }}
              >
                <LetterAvatar letter={pocInitials} name={poc} shape="full" />
              </div>
            </UserHoverCard>
            <UserHoverCard name={poc}>
              <div
                className="min-w-0 cursor-pointer group/poc"
                onClick={(e) => { e.stopPropagation(); handleContactClick(poc, item.partnerLocation); }}
              >
                <span
                  className="text-sm block truncate group-hover/poc:text-primary group-hover/poc:underline transition-colors"
                  style={{ fontFamily: FONT }}
                >
                  {highlightText(poc, searchTerm)}
                </span>
              </div>
            </UserHoverCard>
          </div>
        );
      }
      case "location":
        return <span className="truncate block" style={{ ...s.cellText, color: "hsl(var(--muted-foreground))" }} title={item.locationAddress || item.location}>{item.locationAddress || item.location}</span>;
      case "createdBy": {
        const cb = item.createdBy || "";
        const cbInitials = cb
          ? cb.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase()
          : "—";
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserHoverCard name={cb}>
              <div
                className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handleContactClick(cb, item.partnerLocation); }}
              >
                <LetterAvatar letter={cbInitials} name={cb} shape="full" />
              </div>
            </UserHoverCard>
            <UserHoverCard name={cb}>
              <div
                className="min-w-0 flex-1 cursor-pointer group/cb"
                onClick={(e) => { e.stopPropagation(); handleContactClick(cb, item.partnerLocation); }}
              >
                <span
                  className="text-sm block truncate group-hover/cb:text-primary group-hover/cb:underline transition-colors"
                  style={{ fontFamily: FONT }}
                >
                  {cb}
                </span>
              </div>
            </UserHoverCard>
          </div>
        );
      }
      case "dueDeliveryDate":
        return <span className="block whitespace-nowrap" style={{ ...s.cellMuted, color: "hsl(var(--muted-foreground))" }}>{item.dueDeliveryDate}</span>;
      case "orderDate":
        return <span className="block whitespace-nowrap" style={{ ...s.cellMuted, color: "hsl(var(--muted-foreground))" }}>{item.orderDate}</span>;
      default:
        return null;
    }
  };

  /* ── Tab definitions ── */
  const TAB_DEFS = [
    { value: "all",                   label: "All" },
    { value: "draft",                 label: "Draft" },
    { value: "sent",                  label: "Sent" },
    { value: "confirmed",             label: "Confirmed" },
    { value: "partially-received",    label: "Partially Received" },
    { value: "fully-received",        label: "Fully Received" },
    { value: "archived",              label: "Archived" },
  ];

  const tabColor = (val: string, active: boolean): React.CSSProperties => {
    return getFilterTabStyle(val, active);
  };

  /* ── KPI stats ──
     Buyer 2026-07-31: trimmed to the five status snapshots that
     matter for the listing strip. All values are derived off
     MOCK_DATA statuses so the counts stay live with the mock. */
  const kpiStats = useMemo(() => {
    const total = MOCK_DATA.length;
    const cancelled = MOCK_DATA.filter((d) => d.status === "Cancelled").length;
    const activeWithCancellations = MOCK_DATA.filter(
      (d) => d.status === "Active with Cancellations" || d.status === "Active with Cancellation",
    ).length;
    const closedWithCancellations = MOCK_DATA.filter(
      (d) => d.status === "Fully Received with Cancellations" || d.status === "Closed with Cancellations",
    ).length;
    const fullyReceived = MOCK_DATA.filter((d) => d.status === "Fully Received").length;
    return [
      { id: "total-orders",              label: "Total Orders",              value: String(total),                 sub: "All purchase orders",     icon: FileText,      iconClass: "text-primary bg-primary/8" },
      { id: "cancelled-orders",          label: "Cancelled Orders",          value: String(cancelled),             sub: "Cancelled before receipt", icon: AlertTriangle, iconClass: "text-destructive bg-destructive/8" },
      { id: "active-with-cancellations", label: "Active with Cancellations", value: String(activeWithCancellations), sub: "Partial cancellations",  icon: AlertTriangle, iconClass: "text-chart-3 bg-chart-3/8" },
      { id: "closed-with-cancellations", label: "Closed with Cancellations", value: String(closedWithCancellations), sub: "Closed after cancels",   icon: Clock,         iconClass: "text-chart-3 bg-chart-3/8" },
      { id: "fully-received-orders",     label: "Fully Received",            value: String(fullyReceived),         sub: "Fully delivered",          icon: FileText,      iconClass: "text-accent bg-accent/8" },
    ];
  }, []);

  /* ── Tab counts — reflect all non-status filters so users see accurate per-tab totals ── */
  const TAB_STATUS_MAP: Record<string, POStatus[]> = {
    confirmed: ["Confirmed"], draft: ["Draft"], sent: ["Sent"],
    cancelled: ["Cancelled"], "partially-received": ["Partially Received"],
    "fully-received": ["Fully Received"], "active-cancellation": ["Active with Cancellation"],
    "closed-cancellations": ["Closed with Cancellations"],
    closed: ["Closed"],
  };

  const tabCounts = useMemo(() => {
    // Apply all non-status filters to get the base dataset for counting.
    // Tab counts show how many rows match each status BEFORE status filtering,
    // so users can see what's available to select/deselect.
    let data = [...allData];
    if (filters.ownership === "me") data = data.filter((d) => isCurrentUserCreatedBy(d.createdBy));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((d) =>
        (d.poNumber || "").toLowerCase().includes(q) ||
        (d.partnerLocation || "").toLowerCase().includes(q) ||
        (d.pointOfContact || "").toLowerCase().includes(q) ||
        (d.createdBy || "").toLowerCase().includes(q) ||
        d.orderedItems.some((item) => (item.code || "").toLowerCase().includes(q))
      );
    }
    if (filters.partnerLocation.length > 0) data = data.filter((d) => filters.partnerLocation.includes(d.partnerLocation));
    if (filters.pointOfContact.length > 0) data = data.filter((d) => filters.pointOfContact.includes(d.pointOfContact));
    if (filters.createdBy.length > 0) data = data.filter((d) => filters.createdBy.includes(d.createdBy));
    if (filters.location.length > 0) data = data.filter((d) => filters.location.includes(d.location));
    if (filters.dueDateFrom || filters.dueDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.dueDeliveryDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.dueDateFrom && parsed < new Date(filters.dueDateFrom + "T00:00:00")) return false;
        if (filters.dueDateTo && parsed > new Date(filters.dueDateTo + "T23:59:59")) return false;
        return true;
      });
    }
    if (filters.orderDateFrom || filters.orderDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.orderDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.orderDateFrom && parsed < new Date(filters.orderDateFrom + "T00:00:00")) return false;
        if (filters.orderDateTo && parsed > new Date(filters.orderDateTo + "T23:59:59")) return false;
        return true;
      });
    }

    // Archived rows are excluded from every count except Archived.
    const archivedCount = data.filter((d) => d.archived).length;
    data = data.filter((d) => !d.archived);
    // "all" count = total after non-status filters
    const counts: Record<string, number> = { all: data.length, archived: archivedCount };
    for (const [tabVal, statuses] of Object.entries(TAB_STATUS_MAP)) {
      counts[tabVal] = data.filter((d) => statuses.includes(d.status)).length;
    }
    return counts;
  }, [allData, filters, searchTerm]);

  const meCount = useMemo(() => {
    let data = allData.filter((d) => !d.archived);
    if (filters.status.length > 0) data = data.filter((d) => filters.status.includes(d.status));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((d) =>
        (d.poNumber || "").toLowerCase().includes(q) ||
        (d.partnerLocation || "").toLowerCase().includes(q) ||
        (d.pointOfContact || "").toLowerCase().includes(q) ||
        (d.createdBy || "").toLowerCase().includes(q) ||
        d.orderedItems.some((item) => (item.code || "").toLowerCase().includes(q))
      );
    }
    if (filters.partnerLocation.length > 0) data = data.filter((d) => filters.partnerLocation.includes(d.partnerLocation));
    if (filters.pointOfContact.length > 0) data = data.filter((d) => filters.pointOfContact.includes(d.pointOfContact));
    if (filters.createdBy.length > 0) data = data.filter((d) => filters.createdBy.includes(d.createdBy));
    if (filters.location.length > 0) data = data.filter((d) => filters.location.includes(d.location));
    if (filters.dueDateFrom || filters.dueDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.dueDeliveryDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.dueDateFrom && parsed < new Date(filters.dueDateFrom + "T00:00:00")) return false;
        if (filters.dueDateTo && parsed > new Date(filters.dueDateTo + "T23:59:59")) return false;
        return true;
      });
    }
    if (filters.orderDateFrom || filters.orderDateTo) {
      data = data.filter((d) => {
        const parsed = new Date(d.orderDate);
        if (isNaN(parsed.getTime())) return true;
        if (filters.orderDateFrom && parsed < new Date(filters.orderDateFrom + "T00:00:00")) return false;
        if (filters.orderDateTo && parsed > new Date(filters.orderDateTo + "T23:59:59")) return false;
        return true;
      });
    }
    return data.filter((d) => isCurrentUserCreatedBy(d.createdBy)).length;
  }, [allData, filters, searchTerm]);


  return (
    /* PersonAvatarLightboxProvider is now mounted at the app root in
       `src/app/App.tsx` so the zoom icon in QuickViewPanel works from
       every surface, not just this listing. */
    <DndProvider backend={HTML5Backend}>
    <AppShell>
    <TopBar
      breadcrumbs={[
        { label: "Supply Chain Management", onClick: () => navigate("/") },
        {
          label:
            topTab === "demands"
              ? "Procurement Planning"
              : topTab === "dashboard"
                ? "Dashboard"
                : "Purchase Orders",
        },
      ]}
      showSearch
      searchPlaceholder="Search..."
      showCreateButton={false}
      /* Dev-only widgets in the top bar:
         - Planner journey switcher on the planning tab.
         - PO permissions (Pioneer v1.0) on the orders tab. */
      actions={
        topTab === "demands" ? (
          <PlannerDevWidget />
        ) : (
          <POPermissionsDevWidget />
        )
      }
    />
    <div className="animate-page-fade-in flex-1 overflow-hidden flex flex-col bg-slate-50">
      <div
        className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex flex-col"
        style={{ fontFamily: FONT }}
      >
        {!canAccessPO && topTab !== "demands" && (
          /* po.access is off — soft-lock the PO surfaces with a no-access
             banner. Planning stays reachable because it's its own module
             gate (out of scope for the PO permission set). The rest of
             the content below still mounts (so React state stays alive),
             but a `pointer-events-none opacity-30` wrapper on the table
             renders it as a stale backdrop. */
          <div className="mb-4 flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-6 text-center">
            <FileText className="size-6 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900" style={{ fontFamily: FONT }}>
              You don&apos;t have access to Purchase Orders
            </h3>
            <p className="max-w-md text-xs text-slate-500" style={{ fontFamily: FONT }}>
              {permissionReason("po.access")} Toggle it back on in the Permissions widget (top-right) to preview.
            </p>
          </div>
        )}
        {/* ══════════ PAGE HEADER ══════════
             Per-route title + subtitle. The old tab strip that sat
             under the header was retired when each surface got its
             own URL — the sidebar handles switching between them
             now, so surfacing a duplicate tab strip inside the page
             would just be noise. */}
        {(() => {
          const pageIdentity: Record<"purchase-orders" | "demands" | "dashboard", { title: string; subtitle: string }> = {
            "purchase-orders": {
              title: "Purchase Orders",
              subtitle: "Create, track, and manage all vendor purchase orders across multiple locations.",
            },
            "demands": {
              title: "Procurement Planning",
              subtitle: "Spot upcoming shortages, plan supply against demand, and design purchase-order proposals before you commit.",
            },
            "dashboard": {
              title: "Dashboard",
              subtitle: "At-a-glance status of your procurement pipeline — spend, deliveries, active POs, and vendor health.",
            },
          };
          const { title: pageTitle, subtitle: pageSubtitle } = pageIdentity[topTab];
          /* Procurement Planning tab replaces Cart + Create-PO with a
             single always-available "Open sandbox" action. Sandbox is the
             only outbound path from this tab per feedback ("we will only
             have a single button called Open sandbox that will be always
             available"). Hidden on the FTU questionnaire landing (before the
             buyer has applied a scope) per follow-up feedback — nothing to
             plan yet. The scope-bar's own sandbox pill was removed to avoid
             duplication. */
          const primaryAction =
            topTab === "demands" ? (
              !plannerScopeApplied ? null : (
              <Button
                className="bg-primary text-primary-foreground shrink-0 h-9 gap-2 px-3 rounded-lg shadow-sm"
                style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13 }}
                onClick={() => {
                  const target =
                    plannerLastActiveItem ?? plannerOpenItems[0] ?? null;
                  if (target) {
                    navigate(`/purchase-orders/plan/${target}`);
                  } else {
                    toast.info("Add items from the demand list to open the sandbox.");
                  }
                }}
                title={
                  plannerOpenItems.length > 0
                    ? plannerLastActiveItem
                      ? `Open sandbox — resumes with ${plannerLastActiveItem}`
                      : "Open sandbox"
                    : "Sandbox is empty. Add items from the demand list to plan them here."
                }
              >
                <FlaskConical className="w-4 h-4" />
                <span className="whitespace-nowrap">Open sandbox</span>
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5"
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: FONT,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    color: "white",
                  }}
                >
                  {plannerOpenItems.length}
                </span>
              </Button>
              )
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  className="relative flex items-center justify-center h-9 w-9 rounded-md border border-border cursor-pointer transition-all hover:bg-secondary/60 bg-card"
                  onClick={() => navigate("/cart")}
                  aria-label={`Shopping cart with ${cartItemCount} items`}
                >
                  <ShoppingCart
                    className="size-4"
                    style={{ color: cartItemCount > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                  />
                  {cartItemCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 bg-primary text-primary-foreground"
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        fontFamily: FONT,
                        lineHeight: "14px",
                      }}
                    >
                      {cartItemCount}
                    </span>
                  )}
                </button>
                <Button
                  className="bg-primary text-primary-foreground shrink-0"
                  disabled={!canCreateEditPO}
                  title={canCreateEditPO ? undefined : permissionReason("po.create_edit")}
                  onClick={() => {
                    if (!canCreateEditPO) return;
                    setCatalogueInitialSearch("");
                    setCatalogueInitialVendor("");
                    setCatalogueModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Create New Purchase Order
                </Button>
              </div>
            );
          return (
            <PageHeaderWithIcon
              icon={FileText}
              title={pageTitle}
              subtitle={pageSubtitle}
              primaryAction={primaryAction}
            />
          );
        })()}

        {topTab === "dashboard" ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-6">
            <PODashboard />
          </div>
        ) : topTab === "demands" ? (
          /* Bounded (not page-scrolling) so the demands table scrolls
             internally and its pagination footer pins to the bottom —
             matches the Purchase Orders table branch below. */
          <div className="flex-1 min-h-0 flex flex-col">
            {(() => {
              /* Build stale POs from allData: Drafts older than 7 days only. */
              const today = new Date();
              /* Take the 5 oldest Draft POs. If there aren't 5 in the data,
                 fall through to the next-oldest non-Draft so the table always
                 shows exactly 5 rows (the user wants 5 stale POs displayed). */
              const buildStaleEntry = (po: PurchaseOrder, days: number) => ({
                id: po.id,
                poNumber: po.poNumber,
                version: po.version,
                vendor: po.partnerLocation,
                vendorAbbr: po.partnerAbbr,
                status: "Draft" as const,
                total: po.quoteValue,
                orderDate: po.orderDate,
                daysStale: days,
                orderedItems: po.orderedItems,
                pointOfContact: po.pointOfContact,
                pointOfContactAbbr: po.pointOfContactAbbr,
                location: po.location,
                locationAddress: po.locationAddress,
                createdBy: po.createdBy,
                dueDeliveryDate: po.dueDeliveryDate,
              });
              const withAge = allData.map((p) => {
                const days = Math.floor((today.getTime() - new Date(p.orderDate).getTime()) / 86_400_000);
                return { po: p, days };
              });
              const draftStales = withAge
                .filter((x) => x.po.status === "Draft")
                .sort((a, b) => b.days - a.days);
              const nonDraftFallback = withAge
                .filter((x) => x.po.status !== "Draft")
                .sort((a, b) => b.days - a.days);
              const stale = [
                ...draftStales,
                ...nonDraftFallback,
              ]
                .slice(0, 5)
                .map(({ po, days }) => buildStaleEntry(po, days));
              return (
                <PODemands
                  stalePOs={stale}
                  onScopeAppliedChange={setPlannerScopeApplied}
                  onNavigatePO={(id) => navigate(`/purchase-orders/${id}`)}
                  onPlanInSandbox={(itemCode) => {
                    /* Clicking a listing row enters the full-screen
                       Procurement Planning workspace at a dedicated route
                       (per product direction: "full screen, not overlay").
                       The workspace supports planning several items at once
                       via tabs; the route param drives the active tab. */
                    navigate(`/purchase-orders/plan/${itemCode}`);
                  }}
                  onCreatePO={(opts) => {
                    setCatalogueInitialSearch(opts?.searchTerm || "");
                    setCatalogueInitialVendor(opts?.vendor || "");
                    setCatalogueModalOpen(true);
                  }}
                  onConfirmDraftPO={(result) => {
                    /* Buy-now → land in Draft PO directly. Mirrors the existing
                       buy-now handler used by the cart page. */
                    const po = createPOFromBuyNow(
                      {
                        id: result.item.id,
                        itemNumber: result.item.itemNumber,
                        descriptiveName: result.item.descriptiveName,
                        image: result.item.image,
                        unitPrice: result.item.unitPrice,
                        vendorUOM: result.item.vendorUOM,
                        vendorUOMQty: result.item.vendorUOMQty,
                        defaultUOM: result.item.defaultUOM,
                        discount: result.item.discount,
                        partnerLocation: result.item.partnerLocation,
                        category: result.item.category,
                      },
                      {
                        vendorQty: result.vendorQty,
                        quantity: result.quantity,
                        shipByDate: result.shipByDate,
                        shipmentMethod: result.shipmentMethod,
                        needByDate: result.needByDate,
                        promisedShipDate: result.promisedShipDate,
                        inboundLocation: result.inboundLocation,
                        contactName: result.vendorContactName,
                        contactEmail: result.vendorContactEmail,
                        contactPhone: result.vendorContactPhone,
                        notes: result.notes,
                        totalPrice: result.totalPrice,
                        oneTimeAdjustments: result.oneTimeAdjustments,
                      },
                    );
                    navigate(`/purchase-orders/${po.id}`);
                  }}
                />
              );
            })()}
          </div>
        ) : (
          <>
        {/* ── Performance Insights section ── */}
        <div className="shrink-0 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "14px", fontWeight: 500, color: "hsl(var(--muted-foreground))", fontFamily: FONT }}>Performance Insights</span>
                <button
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500, fontFamily: FONT }}
                >
                  <Clock className="size-3" />
                  Last 30 days
                  <ChevronDown className="size-3 opacity-50" />
                </button>
              </div>
              <button
                className="flex items-center gap-1 text-primary cursor-pointer hover:underline transition-colors"
                style={s.uiLabel}
                onClick={() => setInsightsDrawerOpen(true)}
              >
                <Plus className="size-3.5" />
                Add Insights
              </button>
            </div>

            {/* KPI Cards — minimal Partners style with drag-drop reorder + remove */}
            <div className="flex gap-2.5 flex-wrap">
              {activeInsightIds
                .map((id) => kpiStats.find((k) => k.id === id))
                .filter((kpi): kpi is typeof kpiStats[number] => Boolean(kpi))
                .map((kpi, idx) => (
                  <DraggableKpiCard
                    key={kpi.id}
                    index={idx}
                    id={kpi.id}
                    label={kpi.label}
                    value={kpi.value}
                    Icon={kpi.icon}
                    moveCard={moveKpi}
                    onRemove={() => toggleInsight(kpi.id)}
                  />
                ))}
            </div>
        </div>

        {/* ══════════ MAIN ══════════ */}
        <div className="flex-1 min-h-0 flex flex-col">
          <PODataTable
            filteredData={filteredData}
            allData={allData}
            columns={AVAILABLE_COLUMNS}
            columnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            hiddenColumnIds={hiddenColumnIds}
            onHiddenColumnsChange={setHiddenColumnIds}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            tabDefs={TAB_DEFS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabCounts={tabCounts}
            tabColor={tabColor}
            ownershipFilter={filters.ownership}
            ownershipCount={meCount}
            isCurrentUserPO={(item) => isCurrentUserCreatedBy(item.createdBy)}
            onOwnershipToggle={() => setFilters((p) => ({ ...p, ownership: p.ownership === "me" ? "all" : "me" }))}
            onNavigate={(id, opts) => {
              /* `versionHistory` opens the listing-side modal in place —
                 mirrors SO's QuoteVersionHistoryModal flow (buyer stays on
                 the listing, previews the timeline + snapshot without
                 losing scroll position). All other flows keep routing to
                 the detail page. `outdated` deep-link stays. */
              if (opts?.versionHistory) {
                const row = allData.find((r) => r.id === id);
                setVersionHistoryPO({ id, poNumber: row?.poNumber ?? id });
                return;
              }
              const suffix = opts?.outdated ? "?outdated=1" : "";
              navigate(`/purchase-orders/${id}${suffix}`);
            }}
            onCreateNew={() => {
              setCatalogueInitialSearch("");
              setCatalogueInitialVendor("");
              setCatalogueModalOpen(true);
            }}
            onResetFilters={() => { setSearchTerm(""); resetFilters(); setQuickStatus("all"); setActiveTab("all"); }}
            quickStatus={quickStatus}
            onQuickStatusChange={setQuickStatus}
            renderCell={renderCell}
            highlightText={highlightText}
            activeInsightCount={activeInsightIds.length}
            onInsightsDrawerOpen={() => setInsightsDrawerOpen(true)}
            renderGridCard={(item, cardSize = "medium") => {
              const padding = cardSize === "large" ? "p-5" : cardSize === "small" ? "p-3" : "p-4";
              const isSmall = cardSize === "small";
              return (
                <div
                  key={item.id}
                  className={`bg-card border border-border rounded-xl ${padding} cursor-pointer hover:shadow-md hover:border-primary/20 transition-all`}
                  style={{ fontFamily: FONT }}
                  onClick={() => navigate(`/purchase-orders/${item.id}`)}
                >
                  {/* Header: avatar + name/code + 3-dot menu */}
                  <div className={`flex items-start justify-between ${isSmall ? "mb-2" : "mb-3"}`}>
                    <div className={`flex items-center ${isSmall ? "gap-2" : "gap-3"} min-w-0`}>
                      <LetterAvatar letter={item.partnerAbbr} name={item.partnerLocation} shape="lg" />
                      <div className="min-w-0">
                        <p className={`${isSmall ? "text-xs" : "text-sm"} truncate`} style={{ fontWeight: 500 }}>
                          {item.partnerLocation}
                        </p>
                        <p className={`${isSmall ? "text-[10px]" : "text-xs"} text-muted-foreground truncate`}>
                          PO-{item.poNumber} · v{item.version}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Badge row: status + Me */}
                  <div className={`flex items-center gap-1.5 ${isSmall ? "mb-2" : "mb-3"} flex-wrap`}>
                    <StatusBadge status={item.status} />
                    {item.owner === "me" && <MeBadge />}
                  </div>

                  {/* Detail rows — small size shows fewer rows to stay compact */}
                  <div className={`${isSmall ? "space-y-1 text-[10.5px]" : "space-y-1.5 text-xs"} text-muted-foreground`}>
                    <div className="flex justify-between gap-2">
                      <span>Items</span>
                      <span className="text-foreground truncate" style={{ fontWeight: 500 }}>
                        {item.orderedItems[0]?.code}{item.orderedItems.length > 1 ? ` +${item.orderedItems.length - 1}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Contact</span>
                      <span className="text-foreground truncate">{item.pointOfContact}</span>
                    </div>
                    {!isSmall && (
                      <div className="flex justify-between gap-2">
                        <span>Location</span>
                        <span className="text-foreground truncate" title={item.locationAddress || item.location}>
                          {item.location}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span>Due Date</span>
                      <span className="text-foreground">{item.dueDeliveryDate}</span>
                    </div>
                    {!isSmall && (
                      <div className="flex justify-between gap-2">
                        <span>Created By</span>
                        <span className="text-foreground truncate">{item.createdBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
            filters={filters}
            onFiltersChange={setFilters}
            filterPanelOpen={filterPanelOpen}
            onFilterPanelToggle={() => setFilterPanelOpen((p) => !p)}
            onRowAction={handleRowAction}
          />
        </div>
          </>
        )}
      </div>
    {/* end main flex container */}

    {/* ── ARCHIVE PO WINDOW ── */}
    <PODocumentPreviewDialog
      open={docPreview !== null}
      onOpenChange={(o) => { if (!o) setDocPreview(null); }}
      po={docPreview?.po ?? null}
      mode={docPreview?.mode ?? "print"}
    />

    <ArchivePODialog
      open={archiveTarget !== null}
      onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}
      poNumber={archiveTarget?.poNumber ?? ""}
      status={archiveTarget?.status ?? ""}
      onConfirm={(reason, notes) => {
        if (!archiveTarget) return;
        const cancels = ARCHIVE_CANCELS_STATUSES.has(archiveTarget.status);
        archivePO(archiveTarget.id, reason, notes);
        toast.success(`PO ${archiveTarget.poNumber} archived`, {
          description: cancels ? "PO cancelled and vendor notified" : "Moved out of your active list",
        });
      }}
    />

    {/* ── ITEMS CATALOGUE MODAL (direct entry — replaces search modal) ── */}
    <ItemsCatalogueModal
      open={catalogueModalOpen}
      onClose={() => setCatalogueModalOpen(false)}
      initialSearchTerm={catalogueInitialSearch}
      initialVendor={catalogueInitialVendor}
      onPOsCreated={(created) => {
        setCreatedPOs(created);
        setCreatedPOsChecked(new Set(created.map((c) => c.id)));
      }}
    />

    {/* ── UNIFIED ORDER FLOW (replaces ItemDetailModal + BuyNowFlow) ── */}
    <OrderFlow
      open={!!orderFlowItem}
      onOpenChange={(o) => { if (!o) closeOrderFlow(); }}
      item={orderFlowItem ? toFlowItem(orderFlowItem) : null}
      mode={orderFlowMode}
      prefill={orderFlowPrefill}
      onComplete={handleOrderFlowComplete}
    />

    {/* ── INSIGHTS DRAWER ── */}
    <InsightsDrawer
      open={insightsDrawerOpen}
      onOpenChange={setInsightsDrawerOpen}
      activeInsightIds={activeInsightIds}
      onToggleInsight={toggleInsight}
    />

    {/* The Procurement Planning sandbox now lives at its own full-screen
        route (/purchase-orders/plan/:itemCode) — see PlannerWorkspacePage.
        Row clicks navigate there, so the old in-place modal is retired. */}

    {/* ── Created POs Confirmation Overlay ── */}
    <AnimatePresence>
    {createdPOs && (() => {
      const checkedCount = createdPOs.filter((c) => createdPOsChecked.has(c.id)).length;
      return (
        <motion.div
          key="created-pos-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in srgb, hsl(var(--foreground)) 40%, transparent)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[520px] mx-4 rounded-[var(--radius-lg)] border border-border overflow-hidden"
            style={{ backgroundColor: "hsl(var(--card))", boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
              <div
                className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0"
                style={{ backgroundColor: "hsl(var(--success-tint))" }}
              >
                <Check className="size-5" style={{ color: "hsl(var(--success))" }} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "20px", fontFamily: FONT }}>
                  Purchase Orders Created
                </h3>
                <p className="text-muted-foreground mt-0.5" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                  {createdPOs.length} purchase orders have been created — one per vendor.
                </p>
              </div>
              <button
                className="flex items-center justify-center size-7 rounded-[var(--radius)] text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                onClick={() => setCreatedPOs(null)}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* PO List with checkboxes */}
            <div className="px-5 py-3 flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
              {createdPOs.map((po) => {
                const isChecked = createdPOsChecked.has(po.id);
                return (
                  <label
                    key={po.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer transition-colors hover:bg-secondary/60"
                    style={{ backgroundColor: isChecked ? "hsl(var(--secondary))" : "transparent", border: "1px solid hsl(var(--border))" }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {
                        setCreatedPOsChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(po.id)) next.delete(po.id); else next.add(po.id);
                          return next;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground" style={{ fontSize: "14px", fontWeight: "var(--font-weight-medium)", lineHeight: "20px", fontFamily: FONT }}>{po.poNumber}</span>
                        <span className="text-muted-foreground" style={{ fontSize: "11px", fontFamily: FONT }}>·</span>
                        <span className="text-muted-foreground truncate" style={{ fontSize: "11px", fontFamily: FONT }}>{po.vendor}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-foreground" style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}>
                          ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-muted-foreground" style={{ fontSize: "11px", fontFamily: FONT }}>
                          {po.itemCount} item{po.itemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="size-3.5 text-muted-foreground/40 shrink-0" />
                  </label>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 gap-1.5"
                style={{ fontSize: "12px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px", fontFamily: FONT }}
                onClick={() => setCreatedPOs(null)}
              >
                <ArrowLeft className="size-3.5" />
                Back to Orders
              </Button>
              <Button
                size="sm"
                className="h-9 px-4 gap-1.5"
                style={{ fontSize: "12px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px", fontFamily: FONT }}
                disabled={checkedCount === 0}
                onClick={() => {
                  const selected = createdPOs.filter((c) => createdPOsChecked.has(c.id));
                  setCreatedPOs(null);
                  if (selected.length === 1) {
                    navigate(`/purchase-orders/${selected[0].id}`);
                  } else {
                    selected.forEach((po) => {
                      window.open(`/purchase-orders/${po.id}`, "_blank");
                    });
                  }
                }}
              >
                <ExternalLink className="size-3.5" />
                Open Selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      );
    })()}
    </AnimatePresence>

    {/* ── Quick View Panel (item + contact) ── */}
    <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

    {/* ── Version history modal (opens from any row's V{n} chip) ── */}
    <POVersionHistoryModal
      poId={versionHistoryPO?.id ?? null}
      poNumber={versionHistoryPO?.poNumber}
      onClose={() => setVersionHistoryPO(null)}
    />

    {/* ── Duplicate PO — SO-parity animated overlay ── */}
    <StateTransitionOverlay
      isActive={poTransitions.overlay !== null}
      fromLabel={poTransitions.overlay?.fromLabel ?? ""}
      toLabel={poTransitions.overlay?.toLabel ?? ""}
      tone={poTransitions.overlay?.tone}
      Icon={poTransitions.overlay?.Icon}
      heading={poTransitions.overlay?.heading}
      meta={poTransitions.overlay?.meta}
      onComplete={poTransitions.onOverlayComplete}
    />

    {/* ── Duplicate PO — same modal the detail page uses. Opened
        directly on the listing so the buyer doesn't need to
        navigate before configuring the duplicate (buyer 2026-07-28).
        On confirm, hands off to the animated overlay which plays the
        real `duplicatePO` mutation + navigates to the new draft. ── */}
    {duplicateDialogPO && (
      <DuplicatePODialog
        open={duplicateDialogPO !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateDialogPO(null);
        }}
        po={duplicateDialogPO}
        sourceVersion={duplicateSourceVersion}
        onSourceVersionChange={setDuplicateSourceVersion}
        onConfirm={({ sourceVersion, vendor, vendorLocation }) => {
          const source = duplicateDialogPO;
          setDuplicateDialogPO(null);
          poTransitions.startDuplicate(source, {
            sourceVersion:
              sourceVersion !== source.currentVersion ? sourceVersion : undefined,
            vendor,
            vendorLocation,
            onDone: (created) =>
              navigate(`/purchase-orders/${created.id}`, {
                state: { fromDuplicate: true },
              }),
          });
        }}
        onViewDetails={(version) => {
          setDuplicateSourceVersion(version);
          setDuplicateViewDetailsOpen(true);
        }}
      />
    )}

    {/* Version History modal, launched from the Duplicate dialog's
        "View details" affordance on the listing. Layers over the
        Duplicate modal (same nested pattern the detail page uses). */}
    <POVersionHistoryModal
      poId={duplicateViewDetailsOpen && duplicateDialogPO ? duplicateDialogPO.id : null}
      poNumber={duplicateDialogPO?.poNumber}
      initialSelectedVersion={duplicateSourceVersion}
      onSelectForDuplicate={(v) => {
        setDuplicateSourceVersion(v);
        setDuplicateViewDetailsOpen(false);
      }}
      onClose={() => setDuplicateViewDetailsOpen(false)}
    />

    </div>
    </AppShell>
    </DndProvider>
  );
}
// end PurchaseOrdersListing