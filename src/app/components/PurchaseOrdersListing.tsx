import React, { useState, useRef, useMemo, useCallback, useEffect, useSyncExternalStore } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Package } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  Plus, Download, FileText, Clock, AlertTriangle, TrendingUp,
  ChevronDown, ShoppingCart, CheckCircle2, ArrowRight, Building2, X,
  Check, ExternalLink, ArrowLeft,
} from "lucide-react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { getAllPOs, subscribeToPOStore, createPOFromBuyNow, getPO, duplicatePO, createPOFromVendorCheckout } from "./poStore";
import type { PurchaseOrderData } from "./poStore";
import { printPurchaseOrder } from "./PrintPurchaseOrder";
import PrintOptionsDialog from "./PrintOptionsDialog";
import { poVendorCurrencyIsBase } from "./poStore";
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
import { BaseCurrencyKPI } from "./currency/BaseCurrencyKPI";
import { CurrencyAmount } from "./ui/CurrencyAmount";
import { BASE_CURRENCY, convertBetween } from "@/app/data/currencyLibrary";
import { getVendorCurrency } from "./catalogData";
import ImageLightbox from "./ImageLightbox";
import { getItemImages } from "./catalogData";
import PODataTable from "./PODataTable";
import type { PurchaseOrder, ColumnId, ColumnDef, PORowAction } from "./PODataTable";
import { FONT, typography as sharedStyles } from "./designTokens";
import { getStatusBadgeCss, getFilterTabStyle } from "./statusColors";
import AppShell from "./layout/AppShell";
import UserHoverCard from "./UserHoverCard";
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
  { id: "dueDeliveryDate",  label: "Due Delivery Date",  minWidth: 130 },
  { id: "orderDate",        label: "Order Date",         minWidth: 120 },
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
  // Domestic PKR supplier wired into seedListingPOs so po-1 demonstrates the
  // toggle-hidden / no-FX-tooltip branch on the detail page.
  { name: "Karachi Industrial Works", abbr: "KI" },
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
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 py-0.5"
      style={{
        ...s.cellBadge,
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
  { bg: "var(--avatar-1-bg)", text: "var(--avatar-1-text)" },
  { bg: "var(--avatar-2-bg)", text: "var(--avatar-2-text)" },
  { bg: "var(--avatar-3-bg)", text: "var(--avatar-3-text)" },
  { bg: "var(--avatar-4-bg)", text: "var(--avatar-4-text)" },
  { bg: "var(--avatar-5-bg)", text: "var(--avatar-5-text)" },
  { bg: "var(--avatar-6-bg)", text: "var(--avatar-6-text)" },
  { bg: "var(--avatar-7-bg)", text: "var(--avatar-7-text)" },
];

function AvatarCircle({ name, size = 26, initials: customInitials }: { name: string; size?: number; initials?: string }) {
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
        fontSize: initials.length > 1 ? "var(--text-3xs)" : "var(--text-2xs)",
        fontWeight: "var(--font-weight-semibold)",
        fontFamily: FONT,
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      {initials}
    </span>
  );
}

/** Abbreviation avatar for partner locations */
function LetterAvatar({ letter, name }: { letter: string; name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 26,
        height: 26,
        fontSize: letter.length > 1 ? "var(--text-3xs)" : "var(--text-xs)",
        fontWeight: "var(--font-weight-semibold)",
        fontFamily: FONT,
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      {letter}
    </span>
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
      <div
        className={`${relaxed ? "size-10" : "size-6"} rounded-[4px] overflow-hidden border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all`}
        onClick={(e) => { e.stopPropagation(); onImageClick?.(first); }}
      >
        <ImageWithFallback
          src={first.image}
          alt="Item"
          className="w-full h-full object-cover"
        />
      </div>
      <span className="truncate" style={{ ...s.cellMuted, color: "var(--foreground)" }}>{first.code}</span>
      {moreCount > 0 && (
        <span
          className="inline-flex items-center whitespace-nowrap shrink-0 cursor-default"
          style={{ ...s.cellMuted, color: "var(--primary)", fontWeight: "var(--font-weight-medium)" as string }}
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
        background: "var(--card)",
        border: "0.75px solid var(--border)",
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
        style={{ height: 32, borderBottom: "0.75px solid var(--border)" }}
      >
        <span
          style={{
            fontSize: "var(--text-3xs)",
            fontWeight: "var(--font-weight-semibold)",
            color: "var(--muted-foreground)",
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
            color: "var(--muted-foreground)",
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
            style={{ padding: "6px 12px", fontSize: "var(--text-label)", fontFamily: FONT, color: "var(--foreground)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--secondary)")}
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
        <div style={{ fontSize: "var(--text-3xs)", color: "var(--muted-foreground)", textAlign: "center", padding: "4px 0 6px", borderTop: "0.75px solid var(--border)", fontFamily: FONT }}>
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
      <mark className="rounded-sm bg-primary/15 text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════��═════════════════ */

export default function PurchaseOrdersListing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Initialize state from URL search params (one-time read) ── */
  const [initialState] = useState(() => {
    const p = searchParams;
    return {
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

  const [searchTerm, setSearchTerm] = useState(initialState.q);
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [filters, setFilters] = useState<POFilterState>(initialState.filters);
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(AVAILABLE_COLUMNS.map((c) => c.id));
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ColumnId[]>([]);
  const [storePOs, setStorePOs] = useState<PurchaseOrderData[]>([]);

  /* ── Catalogue modal overlay state (direct entry point — replaces search modal) ── */
  const [catalogueModalOpen, setCatalogueModalOpen] = useState(false);
  const [catalogueInitialSearch, setCatalogueInitialSearch] = useState("");
  const [catalogueInitialVendor, setCatalogueInitialVendor] = useState("");

  /* ── Drawer states ── */
  const [insightsDrawerOpen, setInsightsDrawerOpen] = useState(false);
  const [activeInsightIds, setActiveInsightIds] = useState<string[]>(["total-orders", "pending-approval", "overdue-deliveries"]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  /* ── Unified OrderFlow + vendor-assign states ── */
  const [orderFlowItem, setOrderFlowItem] = useState<CatalogItem | null>(null);
  const [orderFlowMode, setOrderFlowMode] = useState<OrderFlowMode>("add-to-cart");

  /* ── Image Lightbox state ── */
  const [lightboxData, setLightboxData] = useState<{ images: string[]; partNumber: string; itemName: string } | null>(null);

  const handleThumbnailClick = useCallback((oi: OrderedItem) => {
    // Try to find a matching catalog item for multi-image support
    const catItem = CATALOG.find((c) => c.itemNumber === oi.code);
    const images = catItem ? getItemImages(catItem) : getItemImages({ id: oi.code, image: oi.image } as any);
    setLightboxData({ images, partNumber: oi.code, itemName: catItem?.descriptiveName || oi.code });
  }, []);

  /* ── Global Cart (shared store) ── */
  const globalCart = useSyncExternalStore(subscribeToCart, getCart, getCart);
  const cartItemCount = globalCart.length;
  const [orderFlowPrefill, setOrderFlowPrefill] = useState<OrderFlowPrefill | null>(null);

  const [createdPOs, setCreatedPOs] = useState<Array<{ id: string; poNumber: string; vendor: string; itemCount: number; total: number }> | null>(null);
  const [createdPOsChecked, setCreatedPOsChecked] = useState<Set<string>>(new Set());

  /* ── Sync filter/search/tab state TO URL params (replace, no history pollution) ── */
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
          dueDeliveryDate: result.dueDeliveryDate,
          inboundLocation: result.inboundLocation,
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
          shipmentMethod: result.shipmentMethod, dueDeliveryDate: result.dueDeliveryDate,
          inboundLocation: result.inboundLocation, contactName: result.vendorContactName,
          contactEmail: result.vendorContactEmail, contactPhone: result.vendorContactPhone,
          notes: result.notes, totalPrice: result.totalPrice,
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
        dueDeliveryDate: fmtDate(new Date(spo.deliveryDate + "T00:00:00")),
        orderDate: fmtDate(new Date(spo.orderDate + "T00:00:00")),
        owner: isCurrentUserCreatedBy(spo.createdBy) ? "me" : "other",
        hasNotification: false,
      };
    });
    /* Store POs are the source of truth; MOCK_DATA fills any gaps */
    const storeIds = new Set(storeMapped.map((s) => s.id));
    const remainingMock = MOCK_DATA.filter((m) => !storeIds.has(m.id));
    return [...storeMapped, ...remainingMock];
  }, [storePOs]);

  /* ── Derived ── */
  const filteredData = useMemo(() => {
    let data = [...allData];

    // ── STATUS FILTERING ──
    // The tab pills now write directly to filters.status (multi-select).
    // Within status, multiple values use OR (a PO has one status).
    // Across categories, all filters AND together.
    if (filters.status.length > 0) {
      data = data.filter((d) => filters.status.includes(d.status));
    }

    // ── OWNERSHIP ──
    if (filters.ownership === "me") data = data.filter((d) => isCurrentUserCreatedBy(d.createdBy));

    // ── SEARCH ──
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((d) =>
        d.poNumber.toLowerCase().includes(q) ||
        d.partnerLocation.toLowerCase().includes(q) ||
        d.pointOfContact.toLowerCase().includes(q) ||
        d.createdBy.toLowerCase().includes(q) ||
        d.orderedItems.some((item) => item.code.toLowerCase().includes(q))
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
  }, [searchTerm, filters, allData]);

  const resetFilters = () => setFilters({ ...EMPTY_FILTERS, ownership: filters.ownership });

  /** When user clicks a status tab, the tab acts as an
      additional AND scope — status filters from the modal
      remain active and further narrow results within the tab. */
  const handleTabChange = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
  }, []);

  /* ── Delete confirmation modal ── */
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [printTarget, setPrintTarget] = useState<PurchaseOrderData | null>(null);

  const toggleInsight = useCallback((id: string) => {
    setActiveInsightIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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
        // Try store PO first, then create from mock data
        const storePO = getPO(item.id);
        if (storePO) {
          const newPO = duplicatePO(item.id);
          if (newPO) {
            toast.success(`PO duplicated as ${newPO.poNumber} (Draft)`);
            navigate(`/purchase-orders/${newPO.id}`);
          }
        } else {
          // Mock PO — create a new store PO from the listing data
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
              dueDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
              inboundLocation: item.location,
              category: "General",
            })),
            ""
          );
          toast.success(`PO duplicated as ${newPO.poNumber} (Draft)`);
          navigate(`/purchase-orders/${newPO.id}`);
        }
        break;
      }
      case "print": {
        // Try store PO first for full data, otherwise build a minimal PO for print
        const printSource = getPO(item.id);
        const target = printSource ?? ({
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
            dueDeliveryDate: item.dueDeliveryDate ? new Date(item.dueDeliveryDate).toISOString().split("T")[0] : "",
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
        } as PurchaseOrderData);
        setPrintTarget(target);
        break;
      }
      case "download-pdf":
        toast.success(`PDF download started for PO ${item.poNumber}`);
        break;
      case "archive":
        toast.success(`PO ${item.poNumber} archived`);
        break;
      case "delete-draft":
        setDeleteTarget(item);
        break;
    }
  }, [navigate]);

  /* ── Cell renderers ── */
  const renderCell = (col: ColumnDef, item: PurchaseOrder, viewMode?: "compact" | "comfort" | "grid"): React.ReactNode => {
    switch (col.id) {
      case "partnerLocation":
        return (
          <div className="flex items-center gap-2 min-w-0">
            <LetterAvatar letter={item.partnerAbbr} name={item.partnerLocation} />
            <span className="truncate" style={{ ...s.cellText, color: "var(--foreground)" }}>
              {highlightText(item.partnerLocation, searchTerm)}
            </span>
          </div>
        );
      case "status":
        return <StatusBadge status={item.status} />;
      case "orderedItems":
        return <OrderedItemsCell items={item.orderedItems} relaxed={viewMode === "comfort"} onImageClick={handleThumbnailClick} />;
      case "pointOfContact":
        return (
          <span className="truncate block" style={{ ...s.cellText, color: "var(--muted-foreground)" }}>
            {highlightText(item.pointOfContact, searchTerm)}
          </span>
        );
      case "location":
        return <span className="truncate block" style={{ ...s.cellText, color: "var(--muted-foreground)" }} title={item.locationAddress || item.location}>{item.locationAddress || item.location}</span>;
      case "createdBy":
        return (
          <UserHoverCard name={item.createdBy}>
            <span className="truncate block cursor-pointer" style={{ ...s.cellText, color: "var(--muted-foreground)" }}>{item.createdBy}</span>
          </UserHoverCard>
        );
      case "dueDeliveryDate":
        return <span className="block whitespace-nowrap" style={{ ...s.cellMuted, color: "var(--muted-foreground)" }}>{item.dueDeliveryDate}</span>;
      case "orderDate":
        return <span className="block whitespace-nowrap" style={{ ...s.cellMuted, color: "var(--muted-foreground)" }}>{item.orderDate}</span>;
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
  ];

  const tabColor = (val: string, active: boolean): React.CSSProperties => {
    return getFilterTabStyle(val, active);
  };

  /* ── KPI stats ── */
  const kpiStats = useMemo(() => {
    const total = MOCK_DATA.length;
    const draft = MOCK_DATA.filter((d) => d.status === "Draft").length;
    const overdue = MOCK_DATA.filter((d) => d.status === "Partially Received" || d.status === "Active with Cancellation").length;
    const totalValuePKR = MOCK_DATA.reduce((sum, d) => sum + (d.quoteValue || 0), 0);
    const avgOrderValuePKR = total > 0 ? totalValuePKR / total : 0;
    const outstandingPKR = MOCK_DATA
      .filter((d) => d.status !== "Fully Received" && d.status !== "Cancelled" && d.status !== "Closed" && d.status !== "Closed with Cancellations")
      .reduce((sum, d) => sum + (d.quoteValue || 0), 0);
    const totalSpentPKR = MOCK_DATA
      .filter((d) => d.status === "Fully Received" || d.status === "Partially Received" || d.status === "Closed")
      .reduce((sum, d) => sum + (d.quoteValue || 0), 0);
    const discountTotalPKR = totalValuePKR * 0.019;
    return [
      { id: "total-orders",      label: "TOTAL ORDERS",      value: String(total), sub: "+8% from last month",   icon: FileText,       iconClass: "text-primary bg-primary/8" },
      { id: "pending-approval",  label: "PENDING APPROVAL",   value: String(draft), sub: "Awaiting confirmation",  icon: Clock,          iconClass: "text-chart-3 bg-chart-3/8" },
      { id: "overdue-deliveries",label: "OVERDUE DELIVERIES", value: String(overdue), sub: "Requires attention",   icon: AlertTriangle,  iconClass: "text-destructive bg-destructive/8" },
      { id: "total-value",       label: "TOTAL VALUE",        value: "",    pkrValue: totalValuePKR,     financial: true, sub: "Order valuation",        icon: TrendingUp,     iconClass: "text-accent bg-accent/8" },
      { id: "avg-order-value",   label: "AVG ORDER VALUE",    value: "",    pkrValue: avgOrderValuePKR,  financial: true, sub: "Per order average",      icon: TrendingUp,     iconClass: "text-accent bg-accent/8" },
      { id: "outstanding-balance",label: "OUTSTANDING",       value: "",    pkrValue: outstandingPKR,    financial: true, sub: "Unpaid balance",         icon: AlertTriangle,  iconClass: "text-chart-3 bg-chart-3/8" },
      { id: "total-spent",       label: "TOTAL SPENT",        value: "",    pkrValue: totalSpentPKR,     financial: true, sub: "Received to date",        icon: TrendingUp,     iconClass: "text-accent bg-accent/8" },
      { id: "discount-total",    label: "TOTAL DISCOUNTS",    value: "",    pkrValue: discountTotalPKR,  financial: true, sub: "Savings captured",        icon: TrendingUp,     iconClass: "text-accent bg-accent/8" },
      { id: "active-orders",     label: "ACTIVE ORDERS",      value: String(total - draft), sub: "Currently active", icon: FileText,     iconClass: "text-primary bg-primary/8" },
      { id: "completed-orders",  label: "COMPLETED",          value: "12",          sub: "Fully delivered",         icon: FileText,       iconClass: "text-accent bg-accent/8" },
      { id: "cancelled-orders",  label: "CANCELLED",          value: "2",           sub: "Cancelled orders",        icon: AlertTriangle,  iconClass: "text-destructive bg-destructive/8" },
    ] as Array<{ id: string; label: string; value: string; pkrValue?: number; financial?: boolean; sub: string; icon: React.ElementType; iconClass: string }>;
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
        d.poNumber.toLowerCase().includes(q) ||
        d.partnerLocation.toLowerCase().includes(q) ||
        d.pointOfContact.toLowerCase().includes(q) ||
        d.createdBy.toLowerCase().includes(q) ||
        d.orderedItems.some((item) => item.code.toLowerCase().includes(q))
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

    // "all" count = total after non-status filters
    const counts: Record<string, number> = { all: data.length };
    for (const [tabVal, statuses] of Object.entries(TAB_STATUS_MAP)) {
      counts[tabVal] = data.filter((d) => statuses.includes(d.status)).length;
    }
    return counts;
  }, [allData, filters, searchTerm]);

  const meCount = useMemo(() => {
    let data = [...allData];
    if (filters.status.length > 0) data = data.filter((d) => filters.status.includes(d.status));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter((d) =>
        d.poNumber.toLowerCase().includes(q) ||
        d.partnerLocation.toLowerCase().includes(q) ||
        d.pointOfContact.toLowerCase().includes(q) ||
        d.createdBy.toLowerCase().includes(q) ||
        d.orderedItems.some((item) => item.code.toLowerCase().includes(q))
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
    <DndProvider backend={HTML5Backend}>
    <AppShell>
    <div className="animate-page-fade-in">
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--secondary)", fontFamily: FONT }}>

        {/* ══════════ PAGE HEADER ══════════ */}
        <div className="shrink-0">
          {/* ── White header band (breadcrumb + title) ── */}
          <div
            className="px-4 pt-5 pb-5 lg:px-8 lg:pt-6 lg:pb-5 2xl:px-16 3xl:px-24 border-b border-border"
            style={{ backgroundColor: "var(--card)" }}
          >
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 mb-3" aria-label="Breadcrumb">
              <button
                className="hover:text-foreground/60 transition-colors cursor-pointer"
                style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}
                onClick={() => navigate("/")}
              >
                Supply Chain Management
              </button>
              <span style={{ ...s.uiCaption, color: "var(--muted-foreground)", opacity: 0.4 }}>/</span>
              <span style={{ ...s.uiCaption, fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", fontFamily: FONT }}>Purchase Orders</span>
            </nav>

            {/* Title row — icon badge + title + CTA */}
            <div className={`${PAGE_HEADER_FLEX} md:items-center`}>
              <div className="flex items-center gap-3.5">
                {/* Blue page icon badge */}
                <div
                  className="flex items-center justify-center rounded-[var(--radius-lg)] shrink-0"
                  style={{ width: 44, height: 44, backgroundColor: "var(--primary-tint)" }}
                >
                  <FileText className="size-5" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <h4 style={s.pageTitle} className="text-foreground">Purchase Orders</h4>
                  <p className="mt-0.5 max-w-xl" style={{ ...s.pageSub, color: "var(--muted-foreground)" }}>
                    Create, track, and manage all vendor purchase orders across multiple locations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Cart button */}
                <button
                  className="relative flex items-center justify-center h-9 w-9 rounded-[var(--radius)] border border-border cursor-pointer transition-all hover:bg-secondary/60"
                  style={{ backgroundColor: "var(--card)" }}
                  onClick={() => navigate("/cart")}
                  aria-label={`Shopping cart with ${cartItemCount} items`}
                >
                  <ShoppingCart className="size-4" style={{ color: cartItemCount > 0 ? "var(--primary)" : "var(--muted-foreground)" }} />
                  {cartItemCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                        fontSize: "10px",
                        fontWeight: "var(--font-weight-semibold)",
                        fontFamily: FONT,
                        lineHeight: "14px",
                      }}
                    >
                      {cartItemCount}
                    </span>
                  )}
                </button>
                <Button
                  className="h-9 gap-2 px-5 rounded-[var(--radius)]"
                  style={{
                    ...s.uiLabel,
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-weight-medium)" as string,
                    fontFamily: FONT,
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                  onClick={() => {
                    setCatalogueInitialSearch("");
                    setCatalogueInitialVendor("");
                    setCatalogueModalOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Create New Purchase Order
                </Button>
              </div>
            </div>
          </div>

          {/* ── Insights section (on default bg) ── */}
          <div className="px-4 pt-5 pb-0 lg:px-8 lg:pt-6 2xl:px-16 3xl:px-24">
            {/* Performance Insights section */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-foreground" style={s.sectionTitle}>Performance Insights</span>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border border-border cursor-pointer hover:bg-secondary/60 transition-colors"
                  style={{ ...s.uiCaption, color: "var(--muted-foreground)", backgroundColor: "var(--card)" }}
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

            {/* KPI Cards — based on active insights */}
            <div className="flex gap-4 flex-wrap">
              {kpiStats
                .filter((kpi) => activeInsightIds.includes(kpi.id))
                  .map((kpi) => {
                    // Generate deterministic sparkline points for each card
                    const sparkPoints = (() => {
                      let seed = 0;
                      for (let i = 0; i < kpi.id.length; i++) seed = kpi.id.charCodeAt(i) + ((seed << 5) - seed);
                      const pts: number[] = [];
                      for (let i = 0; i < 8; i++) {
                        seed = (seed * 16807 + 0) % 2147483647;
                        pts.push(20 + (seed % 60));
                      }
                      return pts;
                    })();
                    const isPositive = sparkPoints[sparkPoints.length - 1] >= sparkPoints[0];
                    const sparkColor = isPositive ? "var(--accent)" : "var(--destructive)";
                    const maxY = Math.max(...sparkPoints);
                    const minY = Math.min(...sparkPoints);
                    const range = maxY - minY || 1;
                    const svgW = 56;
                    const svgH = 22;
                    const pathD = sparkPoints.map((p, i) => {
                      const x = (i / (sparkPoints.length - 1)) * svgW;
                      const y = svgH - ((p - minY) / range) * (svgH - 4) - 2;
                      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(" ");

                    return (
                   <div
                     key={kpi.id}
                     className="flex items-start justify-between rounded-[var(--radius-lg)] border border-border p-4 shrink-0"
                     style={{ backgroundColor: "var(--card)", width: 220, minWidth: 220, maxWidth: 220 }}
                   >
                     <div className="flex flex-col gap-1 min-w-0">
                       <span className="text-foreground/40" style={s.sectionLabel}>{kpi.label}</span>
                       <span
                         className="text-foreground"
                         style={{ fontSize: "var(--text-h3)", fontWeight: "var(--font-weight-semibold)", lineHeight: "32px", fontFamily: FONT }}
                       >
                         {kpi.financial && typeof kpi.pkrValue === "number" ? (
                           <BaseCurrencyKPI valuePKR={kpi.pkrValue} />
                         ) : (
                           kpi.value
                         )}
                       </span>
                       <span className="text-foreground/40 mt-0.5" style={s.uiCaption}>{kpi.sub}</span>
                     </div>
                     {/* Sparkline mini graph */}
                     <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
                       <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} fill="none">
                         <path d={pathD} stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                       </svg>
                       <span style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", lineHeight: "12px", fontFamily: FONT, color: sparkColor }}>
                         {isPositive ? "↑" : "↓"} {Math.abs(sparkPoints[sparkPoints.length - 1] - sparkPoints[0])}%
                       </span>
                     </div>
                   </div>
                    );})}
            </div>
          </div>
        </div>

        {/* ══════════ MAIN ══════════ */}
        <div className={`flex-1 min-h-0 flex flex-col ${PATTERN_C2_CONTENT}`}>
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
            onNavigate={(id) => navigate(`/purchase-orders/${id}`)}
            onCreateNew={() => {
              setCatalogueInitialSearch("");
              setCatalogueInitialVendor("");
              setCatalogueModalOpen(true);
            }}
            onResetFilters={() => { setSearchTerm(""); resetFilters(); setActiveTab("all"); }}
            renderCell={renderCell}
            highlightText={highlightText}
            activeInsightCount={activeInsightIds.length}
            onInsightsDrawerOpen={() => setInsightsDrawerOpen(true)}
            renderGridCard={(item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-lg)] border border-border overflow-hidden cursor-pointer transition-all duration-150 hover:shadow-[var(--elevation-sm)] hover:border-foreground/15"
                style={{ backgroundColor: "var(--card)", fontFamily: FONT }}
                onClick={() => navigate(`/purchase-orders/${item.id}`)}
              >
                {/* Top row: PO Number + Status */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-foreground truncate" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>
                      PO-{item.poNumber}
                    </span>
                    <VersionBadge version={item.version} />
                    {item.owner === "me" && <MeBadge />}
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Middle section: Vendor, items, contact */}
                <div className="px-4 pb-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <LetterAvatar letter={item.partnerAbbr} name={item.partnerLocation} />
                    <span className="text-foreground truncate" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", lineHeight: "18px", fontFamily: FONT }}>
                      {item.partnerLocation}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderedItemsCell items={item.orderedItems} onImageClick={handleThumbnailClick} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AvatarCircle name={item.pointOfContact} size={20} />
                    <span className="text-muted-foreground truncate" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-normal)", lineHeight: "16px", fontFamily: FONT }}>
                      {item.pointOfContact}
                    </span>
                  </div>
                </div>

                {/* Bottom row: Location, Date, Created By */}
                <div
                  className="flex items-center justify-between gap-2 px-4 py-2"
                  style={{ borderTop: "1px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--secondary) 50%, var(--card))" }}
                >
                  <span className="text-muted-foreground truncate" style={{ fontSize: "var(--text-xs)", lineHeight: "16px", fontFamily: FONT }} title={item.locationAddress || item.location}>{item.locationAddress || item.location}</span>
                  <span className="text-muted-foreground shrink-0" style={{ fontSize: "var(--text-xs)", lineHeight: "16px", fontFamily: FONT }}>{item.dueDeliveryDate}</span>
                  <UserHoverCard name={item.createdBy}>
                    <span className="text-muted-foreground shrink-0 cursor-pointer" style={{ fontSize: "var(--text-xs)", lineHeight: "16px", fontFamily: FONT }}>{item.createdBy}</span>
                  </UserHoverCard>
                </div>
              </div>
            )}
            filters={filters}
            onFiltersChange={setFilters}
            filterPanelOpen={filterPanelOpen}
            onFilterPanelToggle={() => setFilterPanelOpen((p) => !p)}
            onRowAction={handleRowAction}
          />
        </div>
      </div>
    {/* end main flex container */}

    {/* ── DELETE DRAFT CONFIRMATION ── */}
    <AnimatePresence>
      {deleteTarget && (
        <motion.div
          key="delete-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 40%, transparent)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[420px] mx-4 rounded-[var(--radius-lg)] border border-border overflow-hidden"
            style={{ backgroundColor: "var(--card)", boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-foreground" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", lineHeight: "22px", fontFamily: FONT }}>
                Delete PO {deleteTarget.poNumber}?
              </h3>
              <p className="text-muted-foreground mt-1.5" style={{ fontSize: "var(--text-label)", lineHeight: "20px", fontFamily: FONT }}>
                This draft will be permanently removed. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
              <Button variant="outline" size="sm" className="h-9 px-4" style={{ fontFamily: FONT }} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive" size="sm" className="h-9 px-4"
                style={{ fontFamily: FONT }}
                onClick={() => {
                  toast.success(`PO ${deleteTarget.poNumber} deleted`);
                  setDeleteTarget(null);
                }}
              >
                Delete Draft
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── PRINT OPTIONS DIALOG (currency rule) ── */}
    <PrintOptionsDialog
      open={!!printTarget}
      onOpenChange={(v) => { if (!v) setPrintTarget(null); }}
      context={printTarget ? `PO ${printTarget.poNumber}` : undefined}
      hideCurrencyMode={!!printTarget && poVendorCurrencyIsBase(printTarget)}
      onConfirm={(opts) => {
        if (printTarget) printPurchaseOrder(printTarget, { printOptions: opts });
        setPrintTarget(null);
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
          style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 40%, transparent)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[520px] mx-4 rounded-[var(--radius-lg)] border border-border overflow-hidden"
            style={{ backgroundColor: "var(--card)", boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
              <div
                className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0"
                style={{ backgroundColor: "var(--success-tint)" }}
              >
                <Check className="size-5" style={{ color: "var(--success)" }} />
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
                    style={{ backgroundColor: isChecked ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}
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
                          {(() => {
                            const vCur = getVendorCurrency(po.vendor).toUpperCase();
                            if (vCur === BASE_CURRENCY) {
                              return (
                                <CurrencyAmount mode="single" currency={BASE_CURRENCY} value={po.total} />
                              );
                            }
                            const nativeValue = convertBetween(po.total, BASE_CURRENCY, vCur);
                            return (
                              <CurrencyAmount
                                mode="listing-base"
                                currency={BASE_CURRENCY}
                                value={po.total}
                                partnerDefaultCurrency={vCur}
                                partnerDefaultValue={nativeValue}
                              />
                            );
                          })()}
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

    {/* ── Image Lightbox ── */}
    <ImageLightbox
      open={!!lightboxData}
      onClose={() => setLightboxData(null)}
      images={lightboxData?.images ?? []}
      partNumber={lightboxData?.partNumber ?? ""}
      itemName={lightboxData?.itemName ?? ""}
    />

    </div>
    </AppShell>
    </DndProvider>
  );
}
// end PurchaseOrdersListing