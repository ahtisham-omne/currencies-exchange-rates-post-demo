/**
 * ============================================================================
 * OMNESOFT DATA TABLE — STYLE REFERENCE
 * ============================================================================
 *
 * A self-contained reference component documenting every styling pattern used
 * in the Omnesoft Partners data table. Copy this file into any Figma Make
 * project as a blueprint for building identical data table UIs.
 *
 * TECH STACK:
 *   - React 18.3.x
 *   - Tailwind CSS v4 (utility-first, no tailwind.config.js)
 *   - shadcn/ui components (plain function declarations, React.ComponentProps)
 *   - lucide-react icons
 *   - date-fns for date formatting
 *   - sonner for toasts
 *   - Inter variable font via Google Fonts
 *
 * COLOR PALETTE:
 *   Primary:        #0A77FF (--primary)
 *   Primary-50:     #EDF4FF  (subtle bg wash, active pill bg)
 *   Primary-100:    #D6E8FF  (light bg, hover fills)
 *   Primary-200:    #ADD1FF  (soft borders on active)
 *   Primary-600:    #085FCC  (pressed / "+N more" text)
 *   Foreground:     #0F172A  (--foreground)
 *   Muted FG:       #475569  (--muted-foreground)
 *   Border:         #E2E8F0  (--border)
 *   Muted BG:       #F1F5F9  (--muted / --secondary)
 *   Card BG:        #ffffff  (--card)
 *   Background:     #F7F8FA  (--background)
 *
 * Z-INDEX HIERARCHY:
 *   z-[200]  — DropdownMenu, Popover, Dialog, AlertDialog, Sheet
 *   z-[210]  — Stacked child modals
 *   z-[220]  — Cancel confirmation AlertDialog
 *   z-[250]  — Select
 *   z-[300]  — Tooltip
 *   z-20     — Sticky table columns (header)
 *   z-10     — Sticky table columns (body cells)
 *
 * KEY CONSTRAINTS:
 *   - Inside Radix `asChild` triggers, use native <button> not shadcn <Button>
 *   - No forwardRef, no const arrow functions in shadcn/ui components
 *   - Search highlight uses yellow <mark> tag
 *   - WCAG AAA color audit with toAAAColor() for avatar backgrounds
 *   - Tabular nums on all table cells (via theme.css base layer)
 *
 * ============================================================================
 */

import React, { useState, cloneElement } from "react";
import { format } from "date-fns";
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Users,
  User,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlignJustify,
  Menu,
  List,
  LayoutGrid,
} from "lucide-react";

// shadcn/ui imports — all from /src/app/components/ui/
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";

// Project utility — WCAG AAA color mapping
import { toAAAColor } from "../../utils/colors";

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Column definition for configurable table columns */
interface ColumnDef {
  key: string;
  label: string;
  minWidth: number;        // px — sets style={{ minWidth }}
  sortable: boolean;
  align?: "left" | "right"; // default "left"
}

/** Density mode config */
interface DensityOption {
  key: "condensed" | "comfort" | "relaxed" | "card";
  label: string;
  icon: "align-justify" | "menu" | "list" | "layout-grid";
  description: string;
}

/** Quick-filter pill */
interface QuickFilterOption {
  key: string;
  label: string;
  showCount: boolean;
}

/** Sort state */
interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/** Contact with colored avatar initials */
interface ContactRef {
  name: string;
  initials: string;
  bgColor: string; // raw color — pass through toAAAColor() before rendering
}

/** Sample vendor row */
interface VendorRow {
  id: string;
  companyName: string;
  displayName: string;
  code: string;
  status: "active" | "inactive" | "archived";
  partnerTypes: ("vendor" | "customer")[];
  vendorType: string;
  itemCodes: string[];
  partnerLocations: string[];
  globalPointOfContacts: ContactRef[];
  partnerGroup: string;
  netProfitMargin: number;
  creditLimit: number;
  creditUtilization: number;
  services: string;
  defaultCarrierVendor: string;
  defaultCarrierCustomer: string;
  country: string;
  countryFlag: string;
  website: string;
  emailAddress: string;
  createdByContact: ContactRef | null;
  createdAt: string; // ISO date
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const DENSITY_CONFIG: DensityOption[] = [
  { key: "condensed", label: "Condensed", icon: "align-justify", description: "Compact rows, more data visible" },
  { key: "comfort", label: "Comfort", icon: "menu", description: "Default balanced spacing" },
  { key: "relaxed", label: "Relaxed", icon: "list", description: "More breathing room per row" },
  { key: "card", label: "Card view", icon: "layout-grid", description: "Visual grid cards layout" },
];

const QUICK_FILTER_OPTIONS: QuickFilterOption[] = [
  { key: "all", label: "All", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
  { key: "archived", label: "Archived", showCount: true },
];

/**
 * Column definitions — order matters for initial render.
 * `LOCKED_COLUMNS` can't be hidden or reordered by the user.
 */
const COLUMN_DEFS: ColumnDef[] = [
  { key: "partner_name", label: "Partner name", minWidth: 200, sortable: true },
  { key: "partner_type", label: "Partner type", minWidth: 140, sortable: false },
  { key: "vendor_type", label: "Vendor type", minWidth: 130, sortable: true },
  { key: "num_items", label: "Items", minWidth: 140, sortable: false },
  { key: "partner_locations", label: "Locations", minWidth: 160, sortable: false },
  { key: "global_contacts", label: "Points of Contact", minWidth: 180, sortable: false },
  { key: "partner_group", label: "Partner group", minWidth: 140, sortable: true },
  { key: "net_profit", label: "Net profit (%)", minWidth: 110, sortable: true, align: "right" },
  { key: "credit_limit", label: "Credit limit", minWidth: 120, sortable: true, align: "right" },
  { key: "credit_utilization", label: "Utilization", minWidth: 110, sortable: true, align: "right" },
  { key: "services", label: "Services", minWidth: 140, sortable: false },
  { key: "carrier_vendor", label: "Carrier (vendor)", minWidth: 180, sortable: true },
  { key: "carrier_customer", label: "Carrier (customer)", minWidth: 180, sortable: true },
  { key: "country", label: "Country", minWidth: 150, sortable: true },
  { key: "website", label: "Website", minWidth: 160, sortable: false },
  { key: "email", label: "Email", minWidth: 220, sortable: true },
  { key: "created_by", label: "Created by", minWidth: 170, sortable: true },
  { key: "created_on", label: "Created on", minWidth: 120, sortable: true },
  { key: "status", label: "Status", minWidth: 110, sortable: true },
];

const LOCKED_COLUMNS = ["partner_name"];


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Format currency: 50000 → "50,000.00" */
function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format ISO date → "Feb 25, 2026" */
function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

/**
 * Yellow <mark> highlighting for search matches.
 * Wraps matched substrings in a <mark> with yellow background.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Deterministic partner icon from company name.
 * Returns { emoji, bg } for the colored avatar tile.
 */
function getPartnerIcon(companyName: string): { emoji: string; bg: string } {
  const icons = [
    { emoji: "🏢", bg: "#DBEAFE" },
    { emoji: "🏭", bg: "#D1FAE5" },
    { emoji: "🏬", bg: "#FEF3C7" },
    { emoji: "🏗️", bg: "#E0E7FF" },
    { emoji: "📦", bg: "#FCE7F3" },
    { emoji: "🔧", bg: "#ECFDF5" },
  ];
  const hash = companyName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return icons[hash % icons.length];
}

/** Status badge component */
function VendorStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
    active: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#22C55E", label: "Active" },
    inactive: { bg: "#FEF9C3", text: "#854D0E", border: "#FDE68A", dot: "#EAB308", label: "Inactive" },
    archived: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", dot: "hsl(var(--destructive))", label: "Archived" },
  };
  const c = config[status] || config.active;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, fontWeight: 500 }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

/** Partner type badge (Vendor / Customer) */
function PartnerTypeBadge({ type }: { type: "vendor" | "customer" }) {
  const isVendor = type === "vendor";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
      style={{
        fontWeight: 500,
        backgroundColor: isVendor ? "#F0FDF4" : "#EFF6FF",
        color: isVendor ? "#166534" : "#1E40AF",
        borderColor: isVendor ? "#BBF7D0" : "#BFDBFE",
      }}
    >
      {isVendor ? "Vendor" : "Customer"}
    </span>
  );
}

/**
 * "+N more" overflow indicator — used for items, locations, contacts.
 * Uses primary-600 (#085FCC) color.
 */
function MoreBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-xs shrink-0" style={{ fontWeight: 500, color: "#085FCC" }}>
      +{count} more
    </span>
  );
}

/**
 * Colored avatar initials — rounded-md for table cells, rounded-full for created-by.
 * Uses soft tinted backgrounds with colored text for a gentle, modern look.
 */
function AvatarInitials({
  initials,
  bgColor,
  rounded = "md",
  size = 6,
}: {
  initials: string;
  bgColor: string;
  rounded?: "md" | "full";
  size?: 6 | 7 | 9;
}) {
  const sizeClass = size === 9 ? "w-9 h-9" : size === 7 ? "w-7 h-7" : "w-6 h-6";
  const textSize = size === 9 ? "text-sm" : "text-[10px]";
  const POC_TINTS: Record<string, { bg: string; text: string }> = {
    "hsl(var(--primary))": { bg: "#EBF3FF", text: "hsl(var(--primary))" }, "hsl(var(--violet))": { bg: "#F0EBFF", text: "hsl(var(--violet))" },
    "hsl(var(--success))": { bg: "#E8FAF3", text: "hsl(var(--success))" }, "hsl(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
    "hsl(var(--destructive))": { bg: "#FEF2F2", text: "hsl(var(--destructive))" }, "#0891B2": { bg: "#ECFEFF", text: "#0891B2" },
    "#4F46E5": { bg: "#EEF2FF", text: "#4F46E5" }, "#BE185D": { bg: "#FDF2F8", text: "#BE185D" },
    "#0ea5e9": { bg: "#F0F9FF", text: "#0284C7" }, "#8b5cf6": { bg: "#F5F3FF", text: "hsl(var(--violet))" },
    "#f59e0b": { bg: "#FFFBEB", text: "hsl(var(--warning))" }, "#10b981": { bg: "#ECFDF5", text: "hsl(var(--success))" },
    "#6366f1": { bg: "#EEF2FF", text: "#4F46E5" }, "#ec4899": { bg: "#FDF2F8", text: "#DB2777" },
  };
  const tint = POC_TINTS[bgColor] || { bg: "#F0F4FF", text: bgColor };
  return (
    <div
      className={`${sizeClass} rounded-${rounded} flex items-center justify-center ${textSize} shrink-0`}
      style={{ backgroundColor: tint.bg, color: tint.text, fontWeight: 700 }}
    >
      {initials}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — STYLING PATTERNS (DOCUMENTED INLINE)
   ═══════════════════════════════════════════════════════════════════════════

   Below is the complete data table component with every styling decision
   annotated. The structure is:

   ┌─ Outer container ─────────────────────────────────────────────────────┐
   │  border border-border rounded-xl bg-card overflow-clip               │
   │                                                                       │
   │  ┌─ Row 1: Toolbar ────────────────────────────────────────────────┐ │
   │  │  Search input | Filters button | Count | Column selector |      │ │
   │  │  Density dropdown                                               │ │
   │  │  px-4 pt-3.5 pb-2                                              │ │
   │  └─────────────────────────────────────────────────────────────────┘ │
   │                                                                       │
   │  ┌─ Row 2: Quick Filter Pills ─────────────────────────────────────┐ │
   │  │  [Me mode] | [All 42] [Active 38] [Inactive 3] [Archived 1]    │ │
   │  │  px-4 pb-3  overflow-x-auto                                     │ │
   │  └─────────────────────────────────────────────────────────────────┘ │
   │                                                                       │
   │  ┌─ Row 3: Active Filters Bar (Notion-style) ──────────────────────┐ │
   │  │  Optional — shows when column filters are active                │ │
   │  └─────────────────────────────────────────────────────────────────┘ │
   │                                                                       │
   │  ─── border-t border-border (divider) ──────────────────────────────  │
   │                                                                       │
   │  ┌─ Content: Table OR Card Grid ──────────────────────────────────┐  │
   │  │  Table: horizontally scrollable, sticky columns                │  │
   │  │  Cards: responsive grid (1/2/3/4 cols)                         │  │
   │  └────────────────────────────────────────────────────────────────┘  │
   │                                                                       │
   │  ┌─ Pagination ────────────────────────────────────────────────────┐ │
   │  │  Records per page [select] | « ‹ Prev  1 2 ... 5  Next › »     │ │
   │  │  px-4 py-3 border-t border-border                              │ │
   │  └─────────────────────────────────────────────────────────────────┘ │
   └───────────────────────────────────────────────────────────────────────┘

   ═══════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 — MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_VENDORS: VendorRow[] = [
  {
    id: "1",
    companyName: "Acme Corp",
    displayName: "Acme Corporation",
    code: "VND-001",
    status: "active",
    partnerTypes: ["vendor"],
    vendorType: "Manufacturer",
    itemCodes: ["ACM-100", "ACM-200", "ACM-300"],
    partnerLocations: ["New York, NY", "Los Angeles, CA"],
    globalPointOfContacts: [{ name: "John Smith", initials: "JS", bgColor: "#0ea5e9" }],
    partnerGroup: "Tier 1 Suppliers",
    netProfitMargin: 12.45,
    creditLimit: 50000,
    creditUtilization: 12500,
    services: "Manufacturing",
    defaultCarrierVendor: "FedEx",
    defaultCarrierCustomer: "UPS",
    country: "United States",
    countryFlag: "🇺🇸",
    website: "acmecorp.com",
    emailAddress: "contact@acmecorp.com",
    createdByContact: { name: "Sarah Chen", initials: "SC", bgColor: "#8b5cf6" },
    createdAt: "2025-12-15",
  },
  {
    id: "2",
    companyName: "GlobalTech Industries",
    displayName: "GlobalTech Industries",
    code: "VND-002",
    status: "active",
    partnerTypes: ["vendor", "customer"],
    vendorType: "Distributor",
    itemCodes: ["GTI-400"],
    partnerLocations: ["London, UK"],
    globalPointOfContacts: [
      { name: "Emily Watts", initials: "EW", bgColor: "#10b981" },
      { name: "David Kim", initials: "DK", bgColor: "#f59e0b" },
    ],
    partnerGroup: "Premium Partners",
    netProfitMargin: 8.92,
    creditLimit: 120000,
    creditUtilization: 45000,
    services: "Distribution",
    defaultCarrierVendor: "DHL",
    defaultCarrierCustomer: "FedEx",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    website: "globaltech.co.uk",
    emailAddress: "info@globaltech.co.uk",
    createdByContact: { name: "Michael Torres", initials: "MT", bgColor: "#ef4444" },
    createdAt: "2026-01-08",
  },
  {
    id: "3",
    companyName: "Zenith Supply Co",
    displayName: "Zenith Supply Co.",
    code: "VND-003",
    status: "inactive",
    partnerTypes: ["vendor"],
    vendorType: "Wholesaler",
    itemCodes: ["ZSC-700", "ZSC-800"],
    partnerLocations: ["Toronto, CA", "Vancouver, CA", "Montreal, CA"],
    globalPointOfContacts: [],
    partnerGroup: "Tier 2 Suppliers",
    netProfitMargin: 5.31,
    creditLimit: 25000,
    creditUtilization: 18750,
    services: "Wholesale",
    defaultCarrierVendor: "UPS",
    defaultCarrierCustomer: "USPS",
    country: "Canada",
    countryFlag: "🇨🇦",
    website: "zenithsupply.ca",
    emailAddress: "orders@zenithsupply.ca",
    createdByContact: null,
    createdAt: "2025-11-20",
  },
];


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — MAIN REFERENCE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DataTableStyleReference() {
  /* ── State ────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [density, setDensity] = useState<DensityOption["key"]>("comfort");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [activeFilterCount] = useState(0); // Wire to real filter logic
  const [newlyCreatedId] = useState<string | null>(null);

  // Visible columns & order (would normally come from state + localStorage)
  const visibleColumns = COLUMN_DEFS.map((c) => c.key);

  // Frozen (sticky) columns — "partner_name" is always frozen
  const frozenColumns = new Set(["partner_name"]);
  const frozenOffsets: Record<string, number> = { partner_name: 0 };
  const lastFrozenKey = "partner_name";

  /* ── Derived data ─────────────────────────────────── */
  const vendors = MOCK_VENDORS;
  const filteredVendors = vendors.filter((v) => {
    if (quickFilter !== "all" && v.status !== quickFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.displayName.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        v.emailAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / recordsPerPage));
  const paginatedVendors = filteredVendors.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const filterCounts: Record<string, number> = {
    all: vendors.length,
    active: vendors.filter((v) => v.status === "active").length,
    inactive: vendors.filter((v) => v.status === "inactive").length,
    archived: vendors.filter((v) => v.status === "archived").length,
  };

  const hasAnyFilter = searchQuery || quickFilter !== "all" || activeFilterCount > 0;

  const colDef = (key: string) => COLUMN_DEFS.find((c) => c.key === key)!;

  const hl = (text: string) => highlightText(text, searchQuery);

  /* ── Handlers ─────────────────────────────────────── */
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc"
          ? { key, direction: "desc" }
          : null;
      }
      return { key, direction: "asc" };
    });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setQuickFilter("all");
    setCurrentPage(1);
  };

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  /* ── Cell renderer ────────────────────────────────── */
  const renderCell = (vendor: VendorRow, colKey: string) => {
    const icon = getPartnerIcon(vendor.companyName);
    const partnerTypes = vendor.partnerTypes || [];
    const itemCodes = vendor.itemCodes || [];
    const partnerLocations = vendor.partnerLocations || [];
    const globalPointOfContacts = vendor.globalPointOfContacts || [];

    switch (colKey) {
      /* ── Partner name: emoji icon tile + name ── */
      case "partner_name":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-2.5">
              {/*
                Icon tile: rounded-md, 28px, colored bg from getPartnerIcon().
                In Card view the tile is 36px (w-9 h-9).
              */}
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs shrink-0"
                style={{ backgroundColor: icon.bg }}
              >
                {icon.emoji}
              </div>
              {/* Name: truncate at 170px, fontWeight 500, text-sm */}
              <span className="text-sm truncate max-w-[170px]" style={{ fontWeight: 500 }}>
                {hl(vendor.displayName)}
              </span>
            </div>
          </TableCell>
        );

      /* ── Partner type badges ── */
      case "partner_type":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1.5">
              {partnerTypes.map((type) => (
                <PartnerTypeBadge key={type} type={type} />
              ))}
            </div>
          </TableCell>
        );

      /* ── Simple text cell ── */
      case "vendor_type":
        return (
          <TableCell key={colKey}>
            <span className="text-sm text-muted-foreground">{hl(vendor.vendorType || "–")}</span>
          </TableCell>
        );

      /* ── Items with "+N more" overflow ── */
      case "num_items":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{itemCodes[0] || "–"}</span>
              <MoreBadge count={itemCodes.length - 1} />
            </div>
          </TableCell>
        );

      /* ── Locations with "+N more" overflow ── */
      case "partner_locations":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm truncate max-w-[110px]">{hl(partnerLocations[0] || "–")}</span>
              <MoreBadge count={partnerLocations.length - 1} />
            </div>
          </TableCell>
        );

      /* ── Contact with colored avatar initials + "+N more" ── */
      case "global_contacts":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-2">
              {globalPointOfContacts.length > 0 ? (
                <>
                  {/*
                    Avatar: 24px (w-6 h-6), rounded-md, white text, 10px,
                    bg via toAAAColor() for WCAG AAA compliance
                  */}
                  <AvatarInitials
                    initials={globalPointOfContacts[0].initials}
                    bgColor={globalPointOfContacts[0].bgColor}
                    rounded="md"
                    size={6}
                  />
                  <span className="text-sm truncate max-w-[90px]">
                    {hl(globalPointOfContacts[0].name)}
                  </span>
                  <MoreBadge count={globalPointOfContacts.length - 1} />
                </>
              ) : (
                <span className="text-sm text-muted-foreground">–</span>
              )}
            </div>
          </TableCell>
        );

      /* ── Right-aligned numeric cells ── */
      case "net_profit":
        return (
          <TableCell key={colKey} className="text-right">
            <span className="text-sm">{(vendor.netProfitMargin ?? 0).toFixed(2)}</span>
          </TableCell>
        );
      case "credit_limit":
        return (
          <TableCell key={colKey} className="text-right">
            <span className="text-sm">$ {formatCurrency(vendor.creditLimit)}</span>
          </TableCell>
        );
      case "credit_utilization":
        return (
          <TableCell key={colKey} className="text-right">
            <span className="text-sm">{formatCurrency(vendor.creditUtilization)}</span>
          </TableCell>
        );

      /* ── Country with flag emoji ── */
      case "country":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-2">
              <span className="text-base">{vendor.countryFlag}</span>
              <span className="text-sm">{hl(vendor.country)}</span>
            </div>
          </TableCell>
        );

      /* ── Truncated muted text cells ── */
      case "website":
        return (
          <TableCell key={colKey}>
            <span className="text-sm text-muted-foreground truncate block max-w-[140px]">
              {hl(vendor.website)}
            </span>
          </TableCell>
        );
      case "email":
        return (
          <TableCell key={colKey}>
            <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
              {hl(vendor.emailAddress)}
            </span>
          </TableCell>
        );

      /* ── Created by: round avatar + name ── */
      case "created_by":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-2">
              {vendor.createdByContact ? (
                <>
                  <AvatarInitials
                    initials={vendor.createdByContact.initials}
                    bgColor={vendor.createdByContact.bgColor}
                    rounded="full"
                    size={6}
                  />
                  <span className="text-sm truncate max-w-[120px]">
                    {hl(vendor.createdByContact.name)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">–</span>
              )}
            </div>
          </TableCell>
        );

      /* ── Date cell ── */
      case "created_on":
        return (
          <TableCell key={colKey}>
            <span className="text-sm">{formatDate(vendor.createdAt)}</span>
          </TableCell>
        );

      /* ── Status badge ── */
      case "status":
        return (
          <TableCell key={colKey}>
            <VendorStatusBadge status={vendor.status} />
          </TableCell>
        );

      default:
        return <TableCell key={colKey}>–</TableCell>;
    }
  };


  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* ════════════════════════════════════════════════════════════════
          OUTER CONTAINER
          - border border-border: 1px solid #E2E8F0
          - rounded-xl: 12px border radius
          - bg-card: white background
          - overflow-clip: clips child overflow (table scroll stays inside)
         ════════════════════════════════════════════════════════════════ */}
      <div className="border border-border rounded-xl bg-card overflow-clip">

        {/* ──────────────────────────────────────────────────────────────
            ROW 1: TOOLBAR — Search + Filters ... Count + Density
            Layout: flex justify-between, px-4 pt-3.5 pb-2
           ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">

          {/* LEFT SIDE: Search + Filters */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">

            {/* SEARCH INPUT
                - Relative container for icon positioning
                - Search icon: absolute left-3, centered vertically, 16px, muted
                - Input: pl-9 for icon space, pr-8 for clear button, h-9
                - White bg, subtle shadow, muted placeholder at 50% opacity
                - Focus: primary border + primary ring at 20% opacity
                - Clear button: absolute right, round, hover:bg-muted
            */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search by name, type, or email…"
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

            {/* FILTERS BUTTON
                - Native <button> (not shadcn) for Radix asChild compatibility
                - h-9, rounded-lg, border, white bg, shadow-sm
                - Active state: primary text + primary/30 border
                - Inactive state: foreground text + border/80
                - Count badge: rounded-full, white text, #0A77FF bg, 11px, fontWeight 600
            */}
            <button
              type="button"
              className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                activeFilterCount > 0
                  ? "text-primary border-primary/30"
                  : "text-foreground border-border/80"
              }`}
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                  style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* RIGHT SIDE: Count + Density */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* RECORD COUNT
                - tabular-nums for aligned digits
                - fontWeight 500
                - "X of Y partners" when filtered, "X partners" otherwise
                - Different text colors for emphasis hierarchy
            */}
            <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
              {filteredVendors.length !== vendors.length ? (
                <>
                  <span className="text-foreground">{filteredVendors.length}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{vendors.length}</span>
                  <span className="text-muted-foreground/70"> partners</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{vendors.length}</span>
                  <span className="text-muted-foreground/70"> partners</span>
                </>
              )}
            </span>

            {/* VERTICAL DIVIDER */}
            <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

            {/* DENSITY DROPDOWN
                - Native <button> inside DropdownMenuTrigger asChild
                - Same h-9, rounded-lg, border, white bg, shadow-sm pattern
                - Shows icon + label + chevron
                - Menu items: icon + label + description + check mark
                - Active check uses #0A77FF color
                - Card view separated by DropdownMenuSeparator
            */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "comfort" && <Menu className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "relaxed" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "card" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                    {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                {DENSITY_CONFIG.map((opt, idx) => (
                  <div key={opt.key}>
                    {idx === 3 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                      onSelect={() => setDensity(opt.key)}
                    >
                      {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "menu" && <Menu className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                      {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            ROW 2: QUICK FILTER PILLS
            - Horizontal scroll with overflow-x-auto
            - Pills: rounded-full, border, text-xs, transition-colors
            - Active pill: primary text, #EDF4FF bg, primary border inferred
            - Inactive pill: muted text, border-border, hover:bg-muted/60
            - Count badge: 10px text, rounded-full, different bg per state
            - "Me mode" pill with User icon, separated by vertical divider
           ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
          {/* Me mode pill */}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors whitespace-nowrap shrink-0 cursor-pointer">
            <User className="w-3.5 h-3.5" />
            Me mode
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-border shrink-0" />

          {/* Filter pills */}
          {QUICK_FILTER_OPTIONS.map((filter) => {
            const isActive = quickFilter === filter.key;
            const count = filterCounts[filter.key];
            return (
              <button
                key={filter.key}
                onClick={() => { setQuickFilter(filter.key); setCurrentPage(1); }}
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

        {/* ──────────────────────────────────────────────────────────────
            ACTIVE FILTERS BAR (Notion-style)
            Placeholder — in the real app this is the <ActiveFiltersBar> component
           ────────────────────────────────────────────────────────────── */}
        {/* <ActiveFiltersBar ... /> */}

        {/* ──────────────────────────────────────────────────────────────
            DIVIDER between filters and content
           ────────────────────────────────────────────────────────────── */}
        <div className="border-t border-border" />

        {/* ──────────────────────────────────────────────────────────────
            CONTENT AREA — Card View or Table View based on density
           ────────────────────────────────────────────────────────────── */}
        {density === "card" ? (
          /* ════════════════════════════════════════════════════════════
             CARD VIEW
             - p-4 container padding
             - Responsive grid: 1 / 2 (sm) / 3 (lg) / 4 (xl) columns
             - Card: bg-card, border, rounded-xl, p-4
             - Hover: shadow-md + primary/20 border
             - Row flash animation for newly created items
            ════════════════════════════════════════════════════════════ */
          <div className="p-4">
            {paginatedVendors.length === 0 ? (
              /* EMPTY STATE: centered icon + message + optional clear link */
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Users className="w-8 h-8" />
                <p className="text-sm">No partners found</p>
                {hasAnyFilter && (
                  <Button variant="link" size="sm" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedVendors.map((vendor) => {
                  const icon = getPartnerIcon(vendor.companyName);
                  return (
                    <div
                      key={vendor.id}
                      className={`bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all ${
                        newlyCreatedId === vendor.id ? "animate-row-flash" : ""
                      }`}
                    >
                      {/* Card header: icon tile + name/code + actions menu */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: icon.bg }}
                          >
                            {icon.emoji}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ fontWeight: 500 }}>
                              {hl(vendor.displayName)}
                            </p>
                            <p className="text-xs text-muted-foreground">{hl(vendor.code)}</p>
                          </div>
                        </div>
                        {/* Actions: native <button> inside asChild */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Eye className="w-4 h-4 mr-2" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Badges row: status + partner type */}
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        <VendorStatusBadge status={vendor.status} />
                        {vendor.partnerTypes.map((type) => (
                          <PartnerTypeBadge key={type} type={type} />
                        ))}
                      </div>

                      {/* KPI rows: label left, value right */}
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Credit Limit</span>
                          <span className="text-foreground" style={{ fontWeight: 500 }}>
                            $ {formatCurrency(vendor.creditLimit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Country</span>
                          <span className="text-foreground">
                            {vendor.countryFlag} {vendor.country}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created</span>
                          <span className="text-foreground">{formatDate(vendor.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════
             TABLE VIEW
             - shadcn <Table> wraps in a div with overflow-x-auto
             - Header row: bg-muted/30, no hover change
             - Density classes on header: condensed h-8, relaxed h-12
             - Body density: condensed py-1 px-2, relaxed py-3.5
             - Frozen columns: sticky, z-20 (header) / z-10 (body)
             - Frozen shadow on last frozen column: boxShadow 3px
             - Actions column: sticky right-0, z-10/z-20
             - Row hover: bg-muted/20
             - Row flash: animate-row-flash (CSS keyframe in theme.css)
            ════════════════════════════════════════════════════════════ */
          <div>
            <Table>
              <TableHeader>
                <TableRow
                  className={`bg-muted/30 hover:bg-muted/30 ${
                    density === "condensed" ? "[&>th]:h-8" : density === "relaxed" ? "[&>th]:h-12" : ""
                  }`}
                >
                  {visibleColumns.map((key) => {
                    const def = colDef(key);
                    const isFrozen = frozenColumns.has(key);
                    const currentColSort: "asc" | "desc" | null =
                      sortConfig?.key === key ? sortConfig.direction : null;

                    return (
                      <TableHead
                        key={key}
                        className={`whitespace-nowrap ${isFrozen ? "sticky bg-muted/30 z-20" : ""}`}
                        style={{
                          minWidth: def.minWidth,
                          ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                          ...(key === lastFrozenKey ? { boxShadow: "3px 0 6px -2px rgba(0,0,0,0.08)" } : {}),
                        }}
                      >
                        {/* COLUMN HEADER
                            - Clickable for sorting (when sortable)
                            - Active sort: blue text (#0A77FF) + arrow icon
                            - Active filter: blue dot indicator
                            - Idle sortable: ghost arrow on group-hover
                        */}
                        <button
                          type="button"
                          className="flex items-center gap-1 group/header cursor-pointer"
                          onClick={() => def.sortable && handleSort(key)}
                        >
                          <span style={currentColSort ? { color: "hsl(var(--primary))" } : undefined}>
                            {def.label}
                          </span>
                          {currentColSort === "asc" && <ArrowUp className="w-3 h-3" style={{ color: "hsl(var(--primary))" }} />}
                          {currentColSort === "desc" && <ArrowDown className="w-3 h-3" style={{ color: "hsl(var(--primary))" }} />}
                          {!currentColSort && def.sortable && (
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </TableHead>
                    );
                  })}

                  {/* ACTIONS HEADER — always last, sticky right */}
                  <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-muted/30 z-20">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedVendors.length === 0 ? (
                  /* EMPTY STATE ROW */
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="w-8 h-8" />
                        <p className="text-sm">No partners found</p>
                        {hasAnyFilter && (
                          <Button variant="link" size="sm" onClick={clearAllFilters}>
                            Clear all filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVendors.map((vendor) => (
                    <TableRow
                      key={vendor.id}
                      className={`cursor-pointer group hover:bg-muted/20 ${
                        density === "condensed"
                          ? "[&>td]:py-1 [&>td]:px-2"
                          : density === "relaxed"
                          ? "[&>td]:py-3.5"
                          : ""
                      } ${newlyCreatedId === vendor.id ? "animate-row-flash" : ""}`}
                    >
                      {visibleColumns.map((key) => {
                        const cell = renderCell(vendor, key);
                        if (frozenColumns.has(key)) {
                          /* FROZEN CELL STYLING
                             - sticky positioning with computed left offset
                             - z-10 body (z-20 header)
                             - bg-card base + group-hover matches row hover
                             - Last frozen column gets a soft drop shadow
                          */
                          return cloneElement(cell, {
                            className: `${cell.props.className || ""} sticky z-10 bg-card group-hover:bg-muted/20`.trim(),
                            style: {
                              ...cell.props.style,
                              left: `${frozenOffsets[key] ?? 0}px`,
                              ...(key === lastFrozenKey
                                ? { boxShadow: "3px 0 6px -2px rgba(0,0,0,0.08)" }
                                : {}),
                            },
                          });
                        }
                        return cell;
                      })}

                      {/* ACTIONS CELL — sticky right, native <button> in asChild */}
                      <TableCell className="sticky right-0 bg-card group-hover:bg-muted/20 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem><Eye className="w-4 h-4 mr-2" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {vendor.status === "archived" ? (
                              <>
                                <DropdownMenuItem><RotateCcw className="w-4 h-4 mr-2" /> Restore</DropdownMenuItem>
                                <DropdownMenuItem variant="destructive">
                                  <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem variant="destructive">
                                <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────
            PAGINATION
            - Centered layout with flex-col on mobile, flex-row on sm+
            - Records per page: Select with w-[70px] h-8
            - Page buttons: ghost variant, h-8 w-8
            - Active page: bg-primary text-primary-foreground
            - First/Last: ChevronsLeft/ChevronsRight
            - Prev/Next: text + chevron, muted text
            - Ellipsis: "..." spans
            - Container: px-4 py-3, border-t
           ────────────────────────────────────────────────────────────── */}
        {filteredVendors.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Records per page</span>
              <Select
                value={String(recordsPerPage)}
                onValueChange={(val) => { setRecordsPerPage(Number(val)); setCurrentPage(1); }}
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
              {/* First page */}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              {/* Prev */}
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </Button>

              {/* Page numbers */}
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
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

              {/* Next */}
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              {/* Last page */}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>


      {/* ════════════════════════════════════════════════════════════════════
          APPENDIX: QUICK STYLE CHEATSHEET
          ════════════════════════════════════════════════════════════════════

          ┌─────────────────────────┬────────────────────────────────────────┐
          │ Pattern                 │ Classes / Styles                       │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Outer container         │ border border-border rounded-xl       │
          │                         │ bg-card overflow-clip                  │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Toolbar row             │ flex justify-between gap-3            │
          │                         │ px-4 pt-3.5 pb-2                      │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Search input            │ pl-9 pr-8 h-9 text-sm bg-white       │
          │                         │ border-border/80 shadow-sm            │
          │                         │ focus-visible:border-primary          │
          │                         │ focus-visible:ring-primary/20         │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Toolbar button          │ h-9 px-3 rounded-lg border bg-white  │
          │                         │ shadow-sm hover:bg-muted/50           │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Quick filter pill       │ px-3 py-1.5 rounded-full border      │
          │   (inactive)            │ text-xs text-muted-foreground         │
          │   (active)              │ border-primary bg-accent           │
          │                         │ color: #0A77FF fontWeight: 500        │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Count badge (pill)      │ text-[10px] rounded-full px-1.5      │
          │                         │ min-w-[18px] fontWeight: 600          │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Filter count badge      │ text-[11px] rounded-full min-w-[18px]│
          │                         │ h-5 bg-primary text-white          │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Table header row        │ bg-muted/30 hover:bg-muted/30        │
          │   condensed             │ [&>th]:h-8                            │
          │   relaxed               │ [&>th]:h-12                           │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Table body row          │ hover:bg-muted/20 cursor-pointer     │
          │   condensed             │ [&>td]:py-1 [&>td]:px-2              │
          │   relaxed               │ [&>td]:py-3.5                        │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Frozen column (header)  │ sticky z-20 bg-muted/30              │
          │ Frozen column (body)    │ sticky z-10 bg-card                   │
          │ Frozen shadow           │ boxShadow: 3px 0 6px -2px            │
          │                         │   rgba(0,0,0,0.08)                    │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Actions column          │ sticky right-0 z-10/z-20 bg-card     │
          │ Actions button          │ h-8 w-8 rounded-md                    │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Sort indicator (active) │ color: #0A77FF (text + icon)          │
          │ Sort indicator (idle)   │ opacity-0 group-hover:opacity-100     │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ "+N more" text          │ text-xs color: #085FCC fontWeight:500 │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Status badge            │ rounded-full px-2.5 py-1 text-xs     │
          │                         │ border + dot circle (1.5×1.5)         │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Partner type badge      │ rounded px-2 py-0.5 text-xs border   │
          │   Vendor                │ bg-green-50 text-[#166534]          │
          │   Customer              │ bg-blue-50 text-blue-800          │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Avatar initials         │ rounded-md (table) or rounded-full   │
          │                         │ bg via toAAAColor() + white text      │
          │                         │ text-[10px] fontWeight: 600           │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Card view card          │ bg-card border rounded-xl p-4        │
          │                         │ hover:shadow-md hover:border-         │
          │                         │   primary/20 transition-all           │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Card grid               │ grid-cols-1 sm:2 lg:3 xl:4 gap-4    │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Pagination container    │ flex-col sm:flex-row justify-center  │
          │                         │ px-4 py-3 border-t gap-3             │
          │ Page button (active)    │ bg-primary text-primary-foreground   │
          │ Page button (inactive)  │ ghost variant text-muted-foreground  │
          │ Records select          │ w-[70px] h-8                          │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Search highlight        │ <mark> bg-yellow-200/80 rounded-sm   │
          │                         │ px-px text-inherit                    │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Empty state             │ flex-col items-center gap-2 py-16    │
          │                         │ text-muted-foreground                 │
          ├─────────────────────────┼────────────────────────────────────────┤
          │ Row flash animation     │ .animate-row-flash (theme.css)       │
          │                         │ 2.5s ease-out, blue-tinted bg flash  │
          └─────────────────────────┴────────────────────────────────────────┘

         ════════════════════════════════════════════════════════════════════ */}
    </div>
  );
}
