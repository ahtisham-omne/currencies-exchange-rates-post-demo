/* ═══════════════════════════════════════════════════════════════
   DEMAND DASHBOARD — Command center for procurement signals.

   Four sections:
   1. Summary cards (SO Gaps / Low Stock / Pending Requests / Stale POs)
   2. Demand Signals table (left, 60%) — unified table of actionable
      inventory & sales-order driven signals
   3. Purchase Requests panel (right, 40%) — internal request approvals
   4. Stale POs section (full-width, collapsible) — POs that have been
      sitting in Draft/Sent state too long

   All four are wired to mock data; signals reference real catalog items
   when possible so item hover-cards and downstream PO creation work.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Package,
  Clock,
  FileWarning,
  Plus,
  Check,
  X,
  Calendar,
  ExternalLink,
  Info,
  ArrowLeftRight,
  Inbox,
  TrendingUp,
  BarChart3,
  Activity,
  PieChart as PieChartIcon,
  RefreshCw,
  Sliders,
  Search,
  Eye,
  DollarSign,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "sonner";
import { FONT } from "./designTokens";
import UserHoverCard from "./UserHoverCard";
import ItemHoverCard from "./ItemHoverCard";
import { ImageWithFallback } from "./figma/ImageWithFallback";

/* ─────────── Avatar palette (matches listing + catalog) ─────────── */

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

function avatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function AvatarCircle({
  name,
  initials,
  size = 32,
}: {
  name: string;
  initials?: string;
  size?: number;
}) {
  const t = avatarTint(name);
  const ini =
    initials ||
    name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size <= 24 ? "9px" : "10.5px",
        fontWeight: 700,
        fontFamily: FONT,
        backgroundColor: t.bg,
        color: t.text,
      }}
    >
      {ini}
    </span>
  );
}

/* ─────────── Types ─────────── */

export type DemandSignalType = "SO Gap" | "Low Stock" | "Above Max";
export type Urgency = "Critical" | "Soon" | "Normal";

export interface VendorOffer {
  vendor: string;
  abbr: string;
  unitPrice: number;
  leadDays: number;
  isDefault: boolean;
}

export interface DemandSignal {
  id: string;
  type: DemandSignalType;
  itemCode: string;
  itemName: string;
  itemImage: string;
  currentStock: number;
  uom: string;
  delta: number; // shortage (negative meaning) or overage (positive)
  preferredVendor: string;
  urgency: Urgency;
  /** Sales Order reference — populated only for "SO Gap" signals */
  soNumber?: string;
  soDate?: string;
  soUrl?: string;
  /** ISO date this signal was raised. Drives the time-range filter on
      the Demand Gaps section + KPI count. For SO Gap signals this is
      typically the same as soDate; for Low Stock and Above Max it's
      the date inventory thresholds were crossed. */
  raisedDate: string;
  /** Vendor offers — empty for "Above Max" signals (not a buy signal) */
  offers: VendorOffer[];
}

export type RequestStatus = "Pending" | "Approved" | "Denied" | "Deferred";

export interface PurchaseRequest {
  id: string;
  requesterName: string;
  itemName: string;
  itemCode: string;
  itemImage: string;
  quantity: number;
  uom: string;
  reason: string;
  submittedDate: string;
  status: RequestStatus;
  denyReason?: string;
  deferUntil?: string;
}

/* ─────────── Mock data ─────────── */

/* Helper to build an offers array — default first, then alternatives */
function mkOffers(...rows: Array<[string, string, number, number]>): VendorOffer[] {
  return rows.map(([vendor, abbr, unitPrice, leadDays], i) => ({
    vendor, abbr, unitPrice, leadDays, isDefault: i === 0,
  }));
}

const MOCK_SIGNALS: DemandSignal[] = [
  // SO Gap (6) — tied to specific Sales Orders
  { id: "sg-1", type: "SO Gap", itemCode: "HYD-4420-A1", itemName: "Hydraulic Pump Unit — Variable displacement axial-piston", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", currentStock: 12, uom: "EA", delta: -18, preferredVendor: "General Motors (GM)", urgency: "Critical", soNumber: "SO-10428", soDate: "2026-05-04", soUrl: "/sales-orders/SO-10428", raisedDate: "2026-05-04",
    offers: mkOffers(
      ["General Motors (GM)", "GM", 277.00, 7],
      ["Toyota Technical Center (TTC)", "TT", 295.00, 9],
      ["Ford Motor Company", "FM", 268.50, 12],
    ) },
  { id: "sg-2", type: "SO Gap", itemCode: "BFA-4210-R2", itemName: "Brake Friction Assembly — Ceramic compound", itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200", currentStock: 4, uom: "PR", delta: -22, preferredVendor: "Ford Motor Company", urgency: "Critical", soNumber: "SO-10431", soDate: "2026-05-05", soUrl: "/sales-orders/SO-10431", raisedDate: "2026-05-05",
    offers: mkOffers(
      ["Ford Motor Company", "FM", 142.75, 5],
      ["Chrysler (Stellantis N.V.)", "CS", 138.20, 8],
      ["General Motors (GM)", "GM", 154.10, 6],
      ["Honda Motor Co., Ltd. (USA)", "HM", 149.99, 10],
    ) },
  { id: "sg-3", type: "SO Gap", itemCode: "CLP-2290-M3", itemName: "Carbon-Lined Piston", itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200", currentStock: 30, uom: "EA", delta: -10, preferredVendor: "Toyota Technical Center (TTC)", urgency: "Soon", soNumber: "SO-10437", soDate: "2026-05-07", soUrl: "/sales-orders/SO-10437", raisedDate: "2026-05-07",
    offers: mkOffers(
      ["Toyota Technical Center (TTC)", "TT", 86.40, 11],
      ["Honda Motor Co., Ltd. (USA)", "HM", 91.20, 9],
    ) },
  { id: "sg-4", type: "SO Gap", itemCode: "AFE-5520-K1", itemName: "Air Filter Element — Heavy-duty pleated", itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200", currentStock: 8, uom: "EA", delta: -14, preferredVendor: "Tesla, Inc.", urgency: "Soon", soNumber: "SO-10440", soDate: "2026-05-08", soUrl: "/sales-orders/SO-10440", raisedDate: "2026-05-08",
    offers: mkOffers(
      ["Tesla, Inc.", "TI", 34.50, 14],
      ["Rivian Automotive", "RA", 31.80, 16],
      ["Lucid Motors", "LM", 38.25, 12],
    ) },
  { id: "sg-5", type: "SO Gap", itemCode: "RDC-4450-CU", itemName: "Radiator Cooling Assembly — Aluminum core", itemImage: "https://images.unsplash.com/photo-1593941707882-a5bba53b0998?w=200", currentStock: 0, uom: "EA", delta: -6, preferredVendor: "Honda Motor Co., Ltd. (USA)", urgency: "Critical", soNumber: "SO-10444", soDate: "2026-05-09", soUrl: "/sales-orders/SO-10444", raisedDate: "2026-05-09",
    offers: mkOffers(
      ["Honda Motor Co., Ltd. (USA)", "HM", 412.00, 8],
      ["Toyota Technical Center (TTC)", "TT", 425.50, 10],
      ["Nissan North America", "NA", 398.75, 12],
    ) },
  { id: "sg-6", type: "SO Gap", itemCode: "CVJ-5590-ST", itemName: "CV Joint Assembly — Outboard fixed", itemImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=200", currentStock: 45, uom: "EA", delta: -5, preferredVendor: "BMW of North America", urgency: "Normal", soNumber: "SO-10451", soDate: "2026-05-10", soUrl: "/sales-orders/SO-10451", raisedDate: "2026-05-10",
    offers: mkOffers(
      ["BMW of North America", "BN", 198.40, 15],
      ["Tesla, Inc.", "TI", 188.99, 13],
    ) },

  // Low Stock (6)
  { id: "ls-1", type: "Low Stock", itemCode: "667205-32-41", itemName: "Brake Caliper Assembly — Single-piston sliding design", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", currentStock: 18, uom: "EA", delta: -32, preferredVendor: "Chrysler (Stellantis N.V.)", urgency: "Soon", raisedDate: "2026-05-11",
    offers: mkOffers(
      ["Chrysler (Stellantis N.V.)", "CS", 245.00, 9],
      ["Ford Motor Company", "FM", 252.75, 11],
      ["General Motors (GM)", "GM", 261.10, 7],
    ) },
  { id: "ls-2", type: "Low Stock", itemCode: "608497-26-54", itemName: "Suspension Coil Spring — Variable rate", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", currentStock: 24, uom: "EA", delta: -26, preferredVendor: "Lucid Motors", urgency: "Normal", raisedDate: "2026-05-06",
    offers: mkOffers(
      ["Lucid Motors", "LM", 124.50, 18],
      ["Rivian Automotive", "RA", 118.75, 20],
      ["Tesla, Inc.", "TI", 131.20, 14],
    ) },
  { id: "ls-3", type: "Low Stock", itemCode: "511564-21-08", itemName: "Wheel Bearing Hub — Sealed double-row", itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200", currentStock: 9, uom: "EA", delta: -41, preferredVendor: "Rivian Automotive", urgency: "Critical", raisedDate: "2026-05-01",
    offers: mkOffers(
      ["Rivian Automotive", "RA", 88.20, 13],
      ["Lucid Motors", "LM", 92.40, 11],
      ["Tesla, Inc.", "TI", 95.75, 10],
      ["BMW of North America", "BN", 99.50, 16],
    ) },
  { id: "ls-4", type: "Low Stock", itemCode: "519574-21-08", itemName: "Ignition Coil Pack — Multi-cylinder direct", itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200", currentStock: 35, uom: "EA", delta: -15, preferredVendor: "Toyota Technical Center (TTC)", urgency: "Soon", raisedDate: "2026-04-22",
    offers: mkOffers(
      ["Toyota Technical Center (TTC)", "TT", 64.30, 8],
      ["Honda Motor Co., Ltd. (USA)", "HM", 67.10, 9],
    ) },
  { id: "ls-5", type: "Low Stock", itemCode: "PB-9921-TR", itemName: "Power Brake Booster — Vacuum-assisted", itemImage: "https://images.unsplash.com/photo-1593941707882-a5bba53b0998?w=200", currentStock: 5, uom: "EA", delta: -25, preferredVendor: "Nissan North America", urgency: "Critical", raisedDate: "2026-04-08",
    offers: mkOffers(
      ["Nissan North America", "NA", 312.50, 14],
      ["Honda Motor Co., Ltd. (USA)", "HM", 305.80, 11],
      ["Toyota Technical Center (TTC)", "TT", 318.40, 10],
    ) },
  { id: "ls-6", type: "Low Stock", itemCode: "GT-7740-LX", itemName: "Gear Shift Lever Assembly", itemImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=200", currentStock: 28, uom: "EA", delta: -12, preferredVendor: "Ford Motor Company", urgency: "Normal", raisedDate: "2026-03-15",
    offers: mkOffers(
      ["Ford Motor Company", "FM", 72.95, 12],
      ["General Motors (GM)", "GM", 78.20, 9],
    ) },

  // Above Max (3) — informational only, no buy action
  { id: "am-1", type: "Above Max", itemCode: "391847-12-55", itemName: "Window Regulator Motor — Power-window driver", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", currentStock: 320, uom: "EA", delta: 70, preferredVendor: "General Motors (GM)", urgency: "Normal", raisedDate: "2026-02-15", offers: [] },
  { id: "am-2", type: "Above Max", itemCode: "TT-5566-AM", itemName: "Timing Belt Tensioner", itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200", currentStock: 540, uom: "EA", delta: 140, preferredVendor: "Tesla, Inc.", urgency: "Normal", raisedDate: "2025-12-20", offers: [] },
  { id: "am-3", type: "Above Max", itemCode: "OF-3320-PS", itemName: "Oil Filter Cartridge — Synthetic-grade", itemImage: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=200", currentStock: 800, uom: "EA", delta: 200, preferredVendor: "Chrysler (Stellantis N.V.)", urgency: "Normal", raisedDate: "2025-09-15", offers: [] },
];

const INITIAL_REQUESTS: PurchaseRequest[] = [
  { id: "pr-1", requesterName: "Areeb Tanvir", itemName: "MacBook Pro 14\" — M3 chip, 32GB RAM", itemCode: "LAP-MBP-14-M3", itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200", quantity: 1, uom: "EA", reason: "Replacement for failed dev machine", submittedDate: "2026-05-09", status: "Pending" },
  { id: "pr-2", requesterName: "Nophil Anwer", itemName: "Figma Organization License", itemCode: "SW-FIGMA-ORG", itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200", quantity: 5, uom: "Seat", reason: "Design team expansion — 5 new seats needed", submittedDate: "2026-05-10", status: "Pending" },
  { id: "pr-3", requesterName: "Shehryar Hasan", itemName: "Industrial Safety Goggles — ANSI Z87.1", itemCode: "SAF-GOG-Z87", itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200", quantity: 24, uom: "EA", reason: "Shop floor compliance refresh", submittedDate: "2026-05-08", status: "Pending" },
  { id: "pr-4", requesterName: "Irtaza Abid", itemName: "Logitech MX Master 3S mouse", itemCode: "PERIPH-MX3S", itemImage: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200", quantity: 3, uom: "EA", reason: "Standard issue for new hires onboarding next week", submittedDate: "2026-05-11", status: "Pending" },
  { id: "pr-5", requesterName: "Eli Rosenbloom", itemName: "Replacement bearing for line 3 conveyor", itemCode: "511564-21-08", itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200", quantity: 6, uom: "EA", reason: "Production maintenance — scheduled downtime Friday", submittedDate: "2026-05-10", status: "Pending" },
  { id: "pr-6", requesterName: "Areeb Tanvir", itemName: "Office chair — Herman Miller Aeron Size B", itemCode: "FURN-HM-AERON-B", itemImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200", quantity: 1, uom: "EA", reason: "Ergonomic accommodation", submittedDate: "2026-05-05", status: "Approved" },
  { id: "pr-7", requesterName: "Nophil Anwer", itemName: "AWS Reserved Instance — m6i.2xlarge", itemCode: "CLOUD-AWS-M6I", itemImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200", quantity: 2, uom: "Unit", reason: "Increased compute for ML pipeline", submittedDate: "2026-05-04", status: "Denied", denyReason: "Budget constraints" },
  { id: "pr-8", requesterName: "Shehryar Hasan", itemName: "Standing desk converter — VariDesk Pro Plus 36", itemCode: "FURN-VARI-36", itemImage: "https://images.unsplash.com/photo-1518542698903-cef942a8c7b1?w=200", quantity: 1, uom: "EA", reason: "Wellness initiative request", submittedDate: "2026-05-07", status: "Deferred", deferUntil: "2026-06-01" },
];

const DENY_REASONS = [
  "Budget constraints",
  "Not approved at this time",
  "Item available in stock",
  "Duplicate request",
];


/* ─────────── Pill — shared filled-style badge ─────────── */

const PILL: Record<string, { bg: string; fg: string }> = {
  // Signal types
  "SO Gap":    { bg: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)", fg: "hsl(var(--destructive))" },
  "Low Stock": { bg: "color-mix(in srgb, hsl(var(--warning)) 16%, transparent)",     fg: "hsl(var(--warning))" },
  "Above Max": { bg: "hsl(var(--muted))",                                            fg: "hsl(var(--muted-foreground))" },
  // Urgency
  Critical:    { bg: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)", fg: "hsl(var(--destructive))" },
  Soon:        { bg: "color-mix(in srgb, hsl(var(--warning)) 16%, transparent)",     fg: "hsl(var(--warning))" },
  Normal:      { bg: "color-mix(in srgb, hsl(var(--success)) 14%, transparent)",     fg: "hsl(var(--success))" },
  // Request status
  Pending:     { bg: "color-mix(in srgb, hsl(var(--warning)) 16%, transparent)",     fg: "hsl(var(--warning))" },
  Approved:    { bg: "color-mix(in srgb, hsl(var(--success)) 14%, transparent)",     fg: "hsl(var(--success))" },
  Denied:      { bg: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)", fg: "hsl(var(--destructive))" },
  Deferred:    { bg: "hsl(var(--muted))",                                            fg: "hsl(var(--muted-foreground))" },
  Draft:       { bg: "hsl(var(--muted))",                                            fg: "hsl(var(--muted-foreground))" },
};

function Pill({ label }: { label: string }) {
  const p = PILL[label] || { bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))" };
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] whitespace-nowrap"
      style={{ fontWeight: 600, backgroundColor: p.bg, color: p.fg, fontFamily: FONT }}
    >
      {label}
    </span>
  );
}

/* ─────────── WidgetCard — mirrors Partners' ContentCard chrome ─────────── */

function WidgetCard({
  icon: Icon,
  title,
  count,
  tooltip,
  actions,
  children,
  contentClassName = "p-4",
}: {
  icon?: React.ElementType;
  title: string;
  count?: React.ReactNode;
  tooltip?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden flex flex-col transition-[box-shadow] duration-300"
      style={{
        fontFamily: FONT,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px -2px rgba(0,0,0,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)")}
    >
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "hsl(var(--accent))" }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
            </div>
          )}
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", fontFamily: FONT }}
          >
            {title}
          </span>
          {count !== undefined && (
            <span
              className="shrink-0"
              style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
            >
              · {count}
            </span>
          )}
          {tooltip && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-help"
                  >
                    <Info className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-[260px]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className={`flex-1 flex flex-col ${contentClassName}`}>{children}</div>
    </div>
  );
}

/* ─────────── Stat row footer for chart widgets ─────────── */

function StatRow({ stats }: { stats: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <div className="flex items-end justify-between gap-4 mt-2 pt-2 border-t border-muted shrink-0">
      <div className="flex items-center gap-4 flex-wrap min-w-0">
        {stats.map((s, i) => (
          <div key={i}>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}>{s.label}</p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: s.color || "#334155",
                fontFamily: FONT,
              }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── DashboardItemCard — mirrors CatalogueModal list-row chrome ─────────── */

function DashboardItemCard({
  thumbnail,
  code,
  name,
  pills,
  contextLine,
  rightTopBlock,
  actions,
  onCodeClick,
}: {
  thumbnail?: { src: string; alt: string };
  code: React.ReactNode;
  name?: React.ReactNode;
  pills?: React.ReactNode;
  contextLine?: React.ReactNode;
  rightTopBlock?: React.ReactNode;
  actions?: React.ReactNode;
  onCodeClick?: () => void;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden transition-all shrink-0"
      style={{ fontFamily: FONT }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "hsl(var(--accent))";
        e.currentTarget.style.boxShadow = "var(--elevation-sm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "hsl(var(--card))";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="flex items-start gap-3 px-3 pt-2.5 pb-2.5">
        {/* Thumbnail */}
        {thumbnail ? (
          <div
            className="relative shrink-0 w-14 h-14 min-w-[56px] min-h-[56px] rounded-[var(--radius)] overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/30"
            style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
          >
            <ImageWithFallback src={thumbnail.src} alt={thumbnail.alt} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="relative shrink-0 w-14 h-14 min-w-[56px] min-h-[56px] rounded-[var(--radius)] flex items-center justify-center"
            style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
          >
            <FileWarning className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        {/* Identity + context */}
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="truncate"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                fontFamily: FONT,
                cursor: onCodeClick ? "pointer" : "default",
              }}
              onClick={onCodeClick}
            >
              {code}
            </span>
            {pills}
          </div>
          {name && (
            <span
              className="truncate"
              style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", fontFamily: FONT, lineHeight: "16px" }}
            >
              {name}
            </span>
          )}
          {contextLine && (
            <div
              className="mt-0.5"
              style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: FONT, lineHeight: "15px" }}
            >
              {contextLine}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="shrink-0 flex flex-col items-end gap-2 pl-6 min-w-[220px]">
          {rightTopBlock}
          {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────── ChartWidget — wraps a chart in a WidgetCard ─────────── */

function ChartWidget({
  icon,
  title,
  wide = false,
  height = 200,
  footerStats,
  children,
}: {
  icon?: React.ElementType;
  title: string;
  wide?: boolean;
  height?: number;
  footerStats?: Array<{ label: string; value: string; color?: string }>;
  children: React.ReactElement;
}) {
  return (
    <div
      style={{
        flex: wide ? "1 1 100%" : "1 1 calc(50% - 6px)",
        minWidth: wide ? "100%" : 280,
      }}
    >
      <WidgetCard icon={icon} title={title} contentClassName="p-4">
        <div style={{ height }} className="-ml-2">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
        {footerStats && footerStats.length > 0 && <StatRow stats={footerStats} />}
      </WidgetCard>
    </div>
  );
}

/* ─────────── KpiCard — reference-style top-of-page metric tile ─────────────
   Pattern: tinted icon circle + label + optional tooltip on top row,
   large bold value (optionally prefixed by a small badge), caption below.
   Used in the 5-card snapshot strip at the top of the dashboard. */

/* Tints lifted from CurrencyPairDetailPage.tsx ALL_KPI_DEFS — exact hex.
   Mirrors the reference exactly so the KPI strip reads as the same component. */
const KPI_TONE: Record<
  "red" | "blue" | "orange" | "violet" | "gray" | "green",
  { bg: string; fg: string }
> = {
  red:    { bg: "#FEF2F2", fg: "#DC2626" },
  blue:   { bg: "#EDF4FF", fg: "#0A77FF" },
  orange: { bg: "#FFF7ED", fg: "#EA580C" },
  violet: { bg: "#F5F3FF", fg: "#7C3AED" },
  gray:   { bg: "#F1F5F9", fg: "#64748B" },
  green:  { bg: "#F0FDF4", fg: "#16A34A" },
};

function KpiCard({
  icon: Icon,
  tone,
  label,
  badge,
  value,
  valueColor,
  caption,
  tooltip,
  onClick,
}: {
  icon: React.ElementType;
  tone: keyof typeof KPI_TONE;
  label: string;
  badge?: { text: string; color?: string };
  value: React.ReactNode;
  valueColor?: string;
  caption?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
}) {
  const t = KPI_TONE[tone];
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`group relative flex-1 min-w-[200px] rounded-lg border border-[#E2E8F0] bg-white overflow-hidden transition-all duration-200 select-none ${
        interactive
          ? "cursor-pointer hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
          : ""
      }`}
      style={{ fontFamily: FONT }}
    >
      <div className="px-3 py-2">
        {/* Top row: icon + label + tooltip */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: t.bg }}
            >
              <Icon className="w-3 h-3" style={{ color: t.fg }} />
            </div>
            <p
              className="whitespace-nowrap truncate"
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: "#64748B",
                fontFamily: FONT,
              }}
            >
              {label}
            </p>
            {tooltip && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex shrink-0"
                      tabIndex={-1}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-[280px] text-[11px] z-[300] whitespace-pre-line"
                  >
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        {/* Value row: small change badge inline + value */}
        <div className="flex items-baseline gap-1.5">
          {badge && (
            <span
              className="shrink-0"
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: badge.color || "#059669",
                fontFamily: FONT,
              }}
            >
              {badge.text}
            </span>
          )}
          <p
            className="tracking-tight whitespace-nowrap"
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.2,
              color: valueColor || "#334155",
              fontFamily: FONT,
            }}
          >
            {value}
          </p>
        </div>
        {/* Caption / sublabel */}
        {caption && (
          <p
            className="mt-0.5 truncate"
            style={{
              fontSize: 9.5,
              fontWeight: 400,
              color: "#94A3B8",
              fontFamily: FONT,
            }}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── Mock chart data ─────────── */

const SPEND_TREND_DATA = [
  { month: "Jun", amount: 12400 },
  { month: "Jul", amount: 18900 },
  { month: "Aug", amount: 15600 },
  { month: "Sep", amount: 22100 },
  { month: "Oct", amount: 19500 },
  { month: "Nov", amount: 24800 },
  { month: "Dec", amount: 28200 },
  { month: "Jan", amount: 25400 },
  { month: "Feb", amount: 27600 },
  { month: "Mar", amount: 29800 },
  { month: "Apr", amount: 26500 },
  { month: "May", amount: 24500 },
];

const WEEKLY_ACTIVITY_DATA = [
  { week: "W1", created: 6, sent: 4 },
  { week: "W2", created: 8, sent: 7 },
  { week: "W3", created: 5, sent: 5 },
  { week: "W4", created: 9, sent: 6 },
  { week: "W5", created: 4, sent: 3 },
];

const RESPONSE_TIME_DATA = [
  { week: "W1", days: 3.1 },
  { week: "W2", days: 2.8 },
  { week: "W3", days: 2.5 },
  { week: "W4", days: 2.2 },
  { week: "W5", days: 2.4 },
  { week: "W6", days: 2.1 },
  { week: "W7", days: 2.3 },
  { week: "W8", days: 2.3 },
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#7C3AED",
  "hsl(var(--success))",
  "#94A3B8",
];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 12,
  fontFamily: FONT,
};

/* ─────────── Time-range filter (mirrors CurrencyPairDetailPage) ─────────── */

type TimeRange = "TODAY" | "1W" | "1M" | "3M" | "1Y" | "MAX" | "CUSTOM";

const TIME_RANGE_BUTTONS: { key: TimeRange; label: string }[] = [
  { key: "TODAY",  label: "Today" },
  { key: "1W",     label: "1W" },
  { key: "1M",     label: "1M" },
  { key: "3M",     label: "3M" },
  { key: "1Y",     label: "1Y" },
  { key: "MAX",    label: "Max" },
  { key: "CUSTOM", label: "Custom" },
];

function daysForRange(r: TimeRange): number {
  switch (r) {
    case "TODAY":  return 1;
    case "1W":     return 7;
    case "1M":     return 30;
    case "3M":     return 90;
    case "1Y":     return 365;
    case "MAX":
    case "CUSTOM":
    default:       return 9999;
  }
}

function rangeLabel(r: TimeRange, custom?: { from: string; to: string }): string {
  switch (r) {
    case "TODAY":  return "Today";
    case "1W":     return "Last 7 days";
    case "1M":     return "Last 30 days";
    case "3M":     return "Last 90 days";
    case "1Y":     return "Last 12 months";
    case "MAX":    return "All time";
    case "CUSTOM": return custom?.from && custom?.to ? `${custom.from} → ${custom.to}` : "Custom range";
  }
}

/* ─────────── KPI + Widget registries (Customize Widgets) ─────────── */

interface DashboardKpiDef {
  key: string;
  label: string;
  category: "Operational" | "Financial";
}

interface DashboardWidgetDef {
  key: string;
  label: string;
  category: "Financial" | "Activity" | "Analytics" | "Vendor";
  description: string;
  previewType: "area" | "bar" | "pie" | "line";
}

const ALL_DASHBOARD_KPI_DEFS: DashboardKpiDef[] = [
  { key: "critical",          label: "Critical",          category: "Operational" },
  { key: "demand_gaps",       label: "Demand Gaps",       category: "Operational" },
  { key: "pending_approvals", label: "Pending Approvals", category: "Operational" },
  { key: "stale_drafts",      label: "Stale Drafts",      category: "Operational" },
  { key: "monthly_spend",     label: "Monthly Spend",     category: "Financial" },
];

const ALL_DASHBOARD_WIDGET_DEFS: DashboardWidgetDef[] = [
  { key: "spend_trend",     label: "Spend Trend",          category: "Financial", description: "Total spend over time",   previewType: "area" },
  { key: "weekly_activity", label: "Weekly Activity",      category: "Activity",  description: "POs created and sent",    previewType: "bar" },
  { key: "request_status",  label: "Request Status",       category: "Analytics", description: "Approval status breakdown", previewType: "pie" },
  { key: "vendor_response", label: "Vendor Response Time", category: "Vendor",    description: "Avg confirmation days",   previewType: "line" },
];

const DEFAULT_KPIS = ALL_DASHBOARD_KPI_DEFS.map((k) => k.key);
const DEFAULT_WIDGETS = ALL_DASHBOARD_WIDGET_DEFS.map((w) => w.key);

/* ─────────── MiniChartPreview — small SVG previews for the customize panel
   Lifted verbatim from CurrencyPairDetailPage. */

function MiniChartPreview({ type }: { type?: string }) {
  if (type === "line") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      <polyline points="5,30 20,25 35,28 50,18 65,22 80,12 95,15 115,8" fill="none" stroke="#0A77FF" strokeWidth="2" strokeLinecap="round" />
      <polyline points="5,32 20,30 35,31 50,28 65,29 80,26 95,27 115,24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  );
  if (type === "area") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      <defs><linearGradient id="mp-area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity="0.2" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" /></linearGradient></defs>
      <path d="M5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10 115,38 5,38Z" fill="url(#mp-area-grad)" />
      <polyline points="5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === "bar") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      {[10, 22, 34, 46, 58, 70, 82, 94].map((x, i) => {
        const h = [22, 14, 26, 18, 30, 20, 24, 16][i];
        return <rect key={i} x={x} y={36 - h} width="8" height={h} rx="2" fill="#0A77FF" opacity="0.6" />;
      })}
    </svg>
  );
  if (type === "pie") return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 mx-auto block">
      {/* Donut sectors approximation */}
      <circle cx="20" cy="20" r="14" fill="none" stroke="#0A77FF" strokeWidth="6" strokeDasharray="40 88" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#16A34A" strokeWidth="6" strokeDasharray="22 106" strokeDashoffset="-40" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#7C3AED" strokeWidth="6" strokeDasharray="14 114" strokeDashoffset="-62" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#94A3B8" strokeWidth="6" strokeDasharray="12 116" strokeDashoffset="-76" />
    </svg>
  );
  return null;
}

/* ─────────── WidgetCategoryIcon — category → icon (for customize panel headers) */

function WidgetCategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Operational": return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    case "Financial":   return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    case "Activity":    return <Activity className="w-4 h-4 text-muted-foreground" />;
    case "Analytics":   return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
    case "Vendor":      return <Building2 className="w-4 h-4 text-muted-foreground" />;
    default:            return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

/* ─────────── CustomizePanel — slide-in panel for toggling KPIs and widgets
   Ported from CurrencyPairDetailPage.tsx CustomizeKpiPanel (lines 439-656).
   Adapted to use our procurement KPI/widget registries. */

function CustomizePanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  activeWidgets,
  onToggleWidget,
  kpiValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  /** Map of kpiKey → display value to show on each tile (mirrors what's on the dashboard) */
  kpiValues: Record<string, string>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"kpis" | "widgets">("kpis");
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
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open]);

  const kpiCategories = useMemo(() => {
    const catMap = new Map<string, DashboardKpiDef[]>();
    for (const kpi of ALL_DASHBOARD_KPI_DEFS) {
      if (
        searchQuery &&
        !kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !kpi.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
        continue;
      if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
      catMap.get(kpi.category)!.push(kpi);
    }
    return Array.from(catMap.entries()).map(([name, kpis]) => ({ name, kpis }));
  }, [searchQuery]);

  const widgetCategories = useMemo(() => {
    const catMap = new Map<string, DashboardWidgetDef[]>();
    for (const w of ALL_DASHBOARD_WIDGET_DEFS) {
      if (
        searchQuery &&
        !w.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !w.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
        continue;
      if (!catMap.has(w.category)) catMap.set(w.category, []);
      catMap.get(w.category)!.push(w);
    }
    return Array.from(catMap.entries()).map(([name, widgets]) => ({ name, widgets }));
  }, [searchQuery]);

  if (!mounted) return null;

  const totalKpis = ALL_DASHBOARD_KPI_DEFS.length;
  const totalWidgets = ALL_DASHBOARD_WIDGET_DEFS.length;
  const activeKpiCount = activeKpis.length;
  const activeWidgetCount = activeWidgets.length;

  const handleEnableAll = () => {
    if (activeTab === "kpis") {
      const allKeys = ALL_DASHBOARD_KPI_DEFS.map((k) => k.key);
      const allActive = allKeys.every((k) => activeKpis.includes(k));
      if (allActive) {
        allKeys.forEach((k) => onToggleKpi(k));
      } else {
        allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
      }
    } else {
      const allKeys = ALL_DASHBOARD_WIDGET_DEFS.map((w) => w.key);
      const allActive = allKeys.every((k) => activeWidgets.includes(k));
      if (allActive) {
        allKeys.forEach((k) => onToggleWidget(k));
      } else {
        allKeys.filter((k) => !activeWidgets.includes(k)).forEach((k) => onToggleWidget(k));
      }
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          fontFamily: FONT,
        }}
      >
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPI and chart widgets.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Count + Enable All */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeTab === "kpis"
                ? `${activeKpiCount} of ${totalKpis} KPIs active`
                : `${activeWidgetCount} of ${totalWidgets} widgets active`}
            </span>
            <button
              onClick={handleEnableAll}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]"
              style={{ fontWeight: 600 }}
            >
              <Eye className="w-4 h-4" />
              <span>Enable All</span>
            </button>
          </div>

          {/* Search */}
          <div className="mt-3">
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

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-3 px-1">
            {(["kpis", "widgets"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[12px] text-center transition-all cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? "border-[#0A77FF] text-[#0A77FF]"
                    : "border-transparent text-[#94A3B8] hover:text-[#64748B]"
                }`}
                style={{ fontWeight: activeTab === tab ? 600 : 500 }}
              >
                {tab === "kpis" ? "KPIs" : "Widgets"}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[#F1F5F9] shrink-0" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {activeTab === "kpis" ? (
            <>
              {kpiCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No metrics found</p>
                </div>
              )}
              {kpiCategories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <WidgetCategoryIcon category={cat.name} />
                    <span
                      className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                      style={{ fontWeight: 600 }}
                    >
                      {cat.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.kpis.map((kpi) => {
                      const isActive = activeKpis.includes(kpi.key);
                      const computed = kpiValues[kpi.key] ?? "—";
                      return (
                        <button
                          key={kpi.key}
                          onClick={() => onToggleKpi(kpi.key)}
                          className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                              : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[11.5px] truncate transition-colors ${
                                isActive ? "text-[#0A77FF]" : "text-muted-foreground/70"
                              }`}
                              style={{ fontWeight: 500 }}
                              title={kpi.label}
                            >
                              {kpi.label}
                            </span>
                            <div className="shrink-0">
                              {isActive ? (
                                <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                              ) : (
                                <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                              )}
                            </div>
                          </div>
                          <p
                            className={`text-[15px] mt-1 transition-colors ${
                              isActive ? "text-foreground" : "text-foreground/80"
                            }`}
                            style={{ fontWeight: 600 }}
                          >
                            {computed}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {widgetCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No widgets found</p>
                </div>
              )}
              {widgetCategories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <WidgetCategoryIcon category={cat.name} />
                    <span
                      className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                      style={{ fontWeight: 600 }}
                    >
                      {cat.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.widgets.map((widget) => {
                      const isActive = activeWidgets.includes(widget.key);
                      return (
                        <button
                          key={widget.key}
                          onClick={() => onToggleWidget(widget.key)}
                          className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                              : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                          }`}
                        >
                          {/* Preview area */}
                          <div className={`px-3 pt-3 pb-1 ${isActive ? "bg-[#EDF4FF]/50" : "bg-[#F8FAFC]"}`}>
                            <MiniChartPreview type={widget.previewType} />
                            {/* Toggle indicator */}
                            <div className="absolute top-2 right-2">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
                              )}
                            </div>
                          </div>
                          {/* Info */}
                          <div className="px-3 py-2.5">
                            <span
                              className={`text-[12px] transition-colors block ${
                                isActive ? "text-foreground" : "text-foreground/80"
                              }`}
                              style={{ fontWeight: 600 }}
                            >
                              {widget.label}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                              {widget.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─────────── Props for DemandDashboard ─────────── */

export interface DemandDashboardProps {
  stalePOs: Array<{
    id: string;
    poNumber: string;
    vendor: string;
    status: "Draft" | "Sent";
    total: number;
    orderDate: string;
    daysStale: number;
  }>;
  onNavigatePO: (id: string) => void;
  /** Open the PO creation flow (CatalogueModal), pre-filled with optional
      item search term and/or vendor. The dashboard's "Create PO" buttons
      route through this callback so all entry points share the same flow
      as the listing's "Create New Purchase Order" button. */
  onCreatePO: (opts?: { searchTerm?: string; vendor?: string }) => void;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function getDemandDashboardCounts() {
  const so = MOCK_SIGNALS.filter((s) => s.type === "SO Gap").length;
  const low = MOCK_SIGNALS.filter((s) => s.type === "Low Stock").length;
  const above = MOCK_SIGNALS.filter((s) => s.type === "Above Max").length;
  const pending = INITIAL_REQUESTS.filter((r) => r.status === "Pending").length;
  return {
    soGaps: so,
    lowStock: low,
    aboveMax: above,
    pendingRequests: pending,
    totalSignals: so + low + above + pending,
  };
}

export default function DemandDashboard({ stalePOs, onNavigatePO, onCreatePO }: DemandDashboardProps) {
  const [signals] = useState<DemandSignal[]>(MOCK_SIGNALS);
  const [requests, setRequests] = useState<PurchaseRequest[]>(INITIAL_REQUESTS);
  const [denyForId, setDenyForId] = useState<string | null>(null);
  const [deferForId, setDeferForId] = useState<string | null>(null);
  const [deferDate, setDeferDate] = useState<string>("");

  /* View-all dialog state */
  const [viewAll, setViewAll] = useState<null | "gaps" | "requests" | "stale">(null);
  const [requestModalFilter, setRequestModalFilter] = useState<RequestStatus>("Pending");

  /* Toolbar state — time range filter + customize panel */
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [activeKpis, setActiveKpis] = useState<string[]>(DEFAULT_KPIS);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const toggleKpi = (key: string) =>
    setActiveKpis((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleWidget = (key: string) =>
    setActiveWidgets((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const resetDashboard = () => {
    setTimeRange("1M");
    setCustomRange({ from: "", to: "" });
    setActiveKpis(DEFAULT_KPIS);
    setActiveWidgets(DEFAULT_WIDGETS);
    toast.success("Dashboard reset to defaults");
  };

  const today = useMemo(() => new Date(), []);
  const daysSince = (date: string) =>
    Math.floor((today.getTime() - new Date(date).getTime()) / 86400000);

  /* ─── Time-range filter — drives all section + KPI counts ─── */

  const rangeDays = useMemo(() => {
    if (timeRange === "CUSTOM" && customRange.from && customRange.to) {
      const from = new Date(customRange.from);
      const to = new Date(customRange.to);
      return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    }
    return daysForRange(timeRange);
  }, [timeRange, customRange]);

  const rangeCutoff = useMemo(
    () => today.getTime() - rangeDays * 86400000,
    [today, rangeDays]
  );

  /* Universal filter: signals filter by raisedDate, requests by
     submittedDate, stale POs by orderDate. The underlying state
     (signals/requests/stalePOs) is kept intact for action handlers. */
  const filteredSignals = useMemo(
    () => signals.filter((s) => new Date(s.raisedDate).getTime() >= rangeCutoff),
    [signals, rangeCutoff]
  );
  const filteredRequests = useMemo(
    () => requests.filter((r) => new Date(r.submittedDate).getTime() >= rangeCutoff),
    [requests, rangeCutoff]
  );
  const filteredStale = useMemo(
    () => stalePOs.filter((p) => new Date(p.orderDate).getTime() >= rangeCutoff),
    [stalePOs, rangeCutoff]
  );

  /* ─── Counts (all derived from filtered datasets) ─── */
  const totalSignalsCount = filteredSignals.length;
  const soGapCount = filteredSignals.filter((s) => s.type === "SO Gap").length;
  const lowStockCount = filteredSignals.filter((s) => s.type === "Low Stock").length;
  const aboveMaxCount = filteredSignals.filter((s) => s.type === "Above Max").length;
  const pendingRequestCount = filteredRequests.filter((r) => r.status === "Pending").length;
  const totalRequestsCount = filteredRequests.length;
  const staleCount = filteredStale.length;

  /* ─── Request handlers (operate on full state) ─── */
  const updateRequest = (id: string, patch: Partial<PurchaseRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const approveRequest = (r: PurchaseRequest) => {
    updateRequest(r.id, { status: "Approved" });
    toast.success(`Request approved — ${r.requesterName} will be notified`);
  };
  const denyRequest = (r: PurchaseRequest, reason: string) => {
    updateRequest(r.id, { status: "Denied", denyReason: reason });
    toast.success(`Request denied — requester notified`, { description: `Reason: ${reason}` });
    setDenyForId(null);
  };
  const deferRequest = (r: PurchaseRequest, until: string) => {
    updateRequest(r.id, { status: "Deferred", deferUntil: until });
    toast.success(`Deferred — will resurface on ${until}`);
    setDeferForId(null);
    setDeferDate("");
  };
  const createPOForSignal = (s: DemandSignal) => {
    const offer = s.offers[0];
    onCreatePO({ searchTerm: s.itemCode, vendor: offer?.vendor });
  };
  const createPOForRequest = (r: PurchaseRequest) => {
    onCreatePO({ searchTerm: r.itemCode });
  };
  const createPOForStale = (p: DemandDashboardProps["stalePOs"][number]) => {
    onCreatePO({ vendor: p.vendor });
  };

  /* ─── Critical split (derived from filtered) ─── */
  const criticalSignals = filteredSignals.filter(
    (s) =>
      (s.type === "SO Gap" && s.urgency === "Critical") ||
      s.currentStock === 0 ||
      (s.type === "Low Stock" && s.urgency === "Critical")
  );
  const criticalRequests = filteredRequests.filter(
    (r) => r.status === "Pending" && daysSince(r.submittedDate) > 3
  );
  const criticalStale = filteredStale.filter((p) => p.daysStale > 14);
  const criticalCount = criticalSignals.length + criticalRequests.length + criticalStale.length;

  /* ─── Section sorting + top-3 (derived from filtered) ─── */
  const sortedSignals = useMemo(() => {
    const score = (s: DemandSignal) => {
      if (s.type === "SO Gap" && s.urgency === "Critical") return 1;
      if (s.currentStock === 0) return 2;
      if (s.type === "Low Stock" && s.urgency === "Critical") return 3;
      if (s.urgency === "Soon") return s.type === "Low Stock" ? 4 : 5;
      if (s.type === "Low Stock") return 6;
      if (s.type === "Above Max") return 7;
      return 8;
    };
    return [...filteredSignals].sort((a, b) => score(a) - score(b));
  }, [filteredSignals]);
  const topGaps = sortedSignals.slice(0, 3);

  const sortedRequests = useMemo(() => {
    return [...filteredRequests]
      .filter((r) => r.status === "Pending")
      .sort((a, b) => daysSince(b.submittedDate) - daysSince(a.submittedDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRequests]);
  const topRequests = sortedRequests.slice(0, 3);

  const sortedStale = useMemo(
    () => [...filteredStale].sort((a, b) => b.daysStale - a.daysStale),
    [filteredStale]
  );
  const topStale = sortedStale.slice(0, 3);

  /* ─── Sidebar stats (from filtered requests) ─── */
  const requestCounts = {
    pending: filteredRequests.filter((r) => r.status === "Pending").length,
    approved: filteredRequests.filter((r) => r.status === "Approved").length,
    denied: filteredRequests.filter((r) => r.status === "Denied").length,
    deferred: filteredRequests.filter((r) => r.status === "Deferred").length,
  };
  const pendingOver3 = filteredRequests.filter(
    (r) => r.status === "Pending" && daysSince(r.submittedDate) > 3
  ).length;
  const approvedPct =
    totalRequestsCount > 0 ? Math.round((requestCounts.approved / totalRequestsCount) * 100) : 0;

  const filteredSpendTrend = useMemo(() => {
    const months = Math.max(1, Math.ceil(rangeDays / 30));
    return SPEND_TREND_DATA.slice(Math.max(0, SPEND_TREND_DATA.length - months));
  }, [rangeDays]);

  const filteredWeeklyActivity = useMemo(() => {
    const weeks = Math.max(1, Math.ceil(rangeDays / 7));
    return WEEKLY_ACTIVITY_DATA.slice(Math.max(0, WEEKLY_ACTIVITY_DATA.length - weeks));
  }, [rangeDays]);

  const filteredResponseTime = useMemo(() => {
    const weeks = Math.max(1, Math.ceil(rangeDays / 7));
    return RESPONSE_TIME_DATA.slice(Math.max(0, RESPONSE_TIME_DATA.length - weeks));
  }, [rangeDays]);

  /* ─── Pie chart data (uses filteredRequests directly) ─── */
  const requestStatusData = useMemo(() => {
    return [
      { name: "Pending", value: filteredRequests.filter((r) => r.status === "Pending").length },
      { name: "Approved", value: filteredRequests.filter((r) => r.status === "Approved").length },
      { name: "Denied", value: filteredRequests.filter((r) => r.status === "Denied").length },
      { name: "Deferred", value: filteredRequests.filter((r) => r.status === "Deferred").length },
    ].filter((d) => d.value > 0);
  }, [filteredRequests]);

  /* ─── Spend KPI (filtered) ─── */
  const monthlySpendTotal = useMemo(
    () => filteredSpendTrend.reduce((sum, d) => sum + d.amount, 0),
    [filteredSpendTrend]
  );
  const monthlySpendValue = `$${(monthlySpendTotal / 1000).toFixed(1)}K`;
  const monthlySpendLabel = `Spend · ${rangeLabel(timeRange, customRange)}`;

  /* ─── KPI value map for the Customize panel tiles ─── */
  const kpiValues: Record<string, string> = {
    critical: String(criticalCount),
    demand_gaps: String(totalSignalsCount),
    pending_approvals: String(pendingRequestCount),
    stale_drafts: String(staleCount),
    monthly_spend: monthlySpendValue,
  };

  /* ─── Per-section card renderers ─── */

  const renderSignalCard = (s: DemandSignal) => {
    const isAboveMax = s.type === "Above Max";
    const offer = s.offers[0];
    const targetQty = s.currentStock + Math.abs(s.delta);

    let contextLine: React.ReactNode = null;
    if (s.type === "SO Gap") {
      contextLine = (
        <>
          Need <strong className="text-foreground" style={{ fontWeight: 600 }}>{targetQty} {s.uom}</strong> ·
          {" "}Have <strong className="text-foreground" style={{ fontWeight: 600 }}>{s.currentStock} {s.uom}</strong> ·
          {" "}Gap: <strong style={{ fontWeight: 600, color: "hsl(var(--destructive))" }}>{s.delta}</strong>
          {s.soNumber && (
            <>
              {" · "}
              <a
                href={s.soUrl}
                onClick={(e) => { e.preventDefault(); toast.info(`Open ${s.soNumber}`, { description: s.soUrl }); }}
                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer whitespace-nowrap"
                style={{ fontWeight: 600 }}
              >
                {s.soNumber}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </>
          )}
        </>
      );
    } else if (s.type === "Low Stock") {
      contextLine = (
        <>
          Stock: <strong className="text-foreground" style={{ fontWeight: 600 }}>{s.currentStock} {s.uom}</strong> ·
          {" "}Reorder: <strong className="text-foreground" style={{ fontWeight: 600 }}>{targetQty}</strong> ·
          {" "}Gap: <strong style={{ fontWeight: 600, color: "hsl(var(--destructive))" }}>{s.delta}</strong>
        </>
      );
    } else {
      contextLine = (
        <>
          Stock: <strong className="text-foreground" style={{ fontWeight: 600 }}>{s.currentStock} {s.uom}</strong> ·
          {" "}Excess: <strong style={{ fontWeight: 600, color: "hsl(var(--warning))" }}>+{s.delta}</strong>
        </>
      );
    }

    const rightTopBlock = isAboveMax ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>
        <AlertTriangle className="w-3 h-3" />
        Informational — no buy
      </span>
    ) : offer ? (
      <div className="flex items-center gap-2">
        <AvatarCircle name={offer.vendor} initials={offer.abbr} size={20} />
        <div className="flex flex-col items-end">
          <span className="text-[12px] text-foreground truncate max-w-[140px]" style={{ fontWeight: 600 }}>
            {offer.vendor.split(" (")[0]}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ${offer.unitPrice.toFixed(2)}/{s.uom} · {offer.leadDays}d
          </span>
        </div>
      </div>
    ) : null;

    const actions = isAboveMax ? (
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] gap-1"
        onClick={() => toast.info(`Reduce-stock flow for ${s.itemCode}`)}
      >
        <ArrowLeftRight className="w-3 h-3" /> Reduce / Transfer
      </Button>
    ) : (
      <Button size="sm" className="h-7 px-2.5 text-[11px] gap-1" onClick={() => createPOForSignal(s)}>
        <Plus className="w-3 h-3" /> Create PO
      </Button>
    );

    return (
      <DashboardItemCard
        key={s.id}
        thumbnail={{ src: s.itemImage, alt: s.itemName }}
        code={
          <ItemHoverCard code={s.itemCode} imageUrl={s.itemImage}>
            <span>{s.itemCode}</span>
          </ItemHoverCard>
        }
        name={s.itemName}
        pills={
          <>
            <Pill label={s.type} />
            <Pill label={s.urgency} />
          </>
        }
        contextLine={contextLine}
        rightTopBlock={rightTopBlock}
        actions={actions}
      />
    );
  };

  const renderRequestCard = (r: PurchaseRequest) => {
    const initials = r.requesterName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const days = daysSince(r.submittedDate);
    const waitingText =
      days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;

    const rightTopBlock = (
      <div className="flex items-center gap-2">
        <UserHoverCard name={r.requesterName}>
          <div>
            <AvatarCircle name={r.requesterName} initials={initials} size={20} />
          </div>
        </UserHoverCard>
        <div className="flex flex-col items-end">
          <span className="text-[12px] text-foreground truncate max-w-[140px]" style={{ fontWeight: 600 }}>
            {r.requesterName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {r.quantity} {r.uom} · {waitingText}
          </span>
        </div>
      </div>
    );

    let actions: React.ReactNode;
    if (r.status === "Pending") {
      actions = (
        <>
          <Button size="sm" className="h-7 px-2.5 text-[11px] gap-1" onClick={() => approveRequest(r)}>
            <Check className="w-3 h-3" /> Approve
          </Button>
          <Popover open={denyForId === r.id} onOpenChange={(o) => setDenyForId(o ? r.id : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11.5px] text-foreground hover:text-primary transition-colors cursor-pointer"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                Deny
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="end">
              <div className="text-[10px] text-muted-foreground px-2 py-1.5">Pick a reason:</div>
              {DENY_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => denyRequest(r, reason)}
                  className="w-full text-left px-2 py-1.5 rounded-sm text-[11px] hover:bg-muted/60 transition-colors"
                  style={{ fontFamily: FONT }}
                >
                  {reason}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover
            open={deferForId === r.id}
            onOpenChange={(o) => {
              setDeferForId(o ? r.id : null);
              if (o) setDeferDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                style={{ fontWeight: 500, fontFamily: FONT }}
              >
                Defer
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="text-[10px] text-muted-foreground mb-1.5">Review again on:</div>
              <input
                type="date"
                value={deferDate}
                onChange={(e) => setDeferDate(e.target.value)}
                className="w-full px-2 py-1 rounded-sm border border-border text-[11px] mb-2"
                style={{ fontFamily: FONT }}
              />
              <Button
                size="sm"
                className="w-full h-7 text-[11px]"
                onClick={() => deferDate && deferRequest(r, deferDate)}
                disabled={!deferDate}
              >
                Defer
              </Button>
            </PopoverContent>
          </Popover>
        </>
      );
    } else if (r.status === "Approved") {
      actions = (
        <Button
          size="sm"
          className="h-7 px-2.5 text-[11px] gap-1"
          onClick={() => createPOForRequest(r)}
        >
          <Plus className="w-3 h-3" /> Create PO
        </Button>
      );
    } else {
      actions = null;
    }

    return (
      <DashboardItemCard
        key={r.id}
        thumbnail={{ src: r.itemImage, alt: r.itemName }}
        code={
          <ItemHoverCard code={r.itemCode} imageUrl={r.itemImage}>
            <span>{r.itemCode}</span>
          </ItemHoverCard>
        }
        name={r.itemName}
        pills={<Pill label={r.status} />}
        contextLine={
          <span className="italic">
            "{r.reason}"
            {r.status === "Denied" && r.denyReason && (
              <span style={{ color: "hsl(var(--destructive))", fontStyle: "normal" }}>
                {" · "}Denied: {r.denyReason}
              </span>
            )}
            {r.status === "Deferred" && r.deferUntil && (
              <span style={{ fontStyle: "normal" }}> · Review on {r.deferUntil}</span>
            )}
          </span>
        }
        rightTopBlock={rightTopBlock}
        actions={actions}
      />
    );
  };

  const renderStaleCard = (p: DemandDashboardProps["stalePOs"][number]) => {
    const rightTopBlock = (
      <div className="flex items-center gap-2">
        <AvatarCircle name={p.vendor} size={20} />
        <div className="flex flex-col items-end">
          <span className="text-[12px] text-foreground truncate max-w-[140px]" style={{ fontWeight: 600 }}>
            {p.vendor.split(" (")[0]}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ${p.total.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    );

    return (
      <DashboardItemCard
        key={p.id}
        code={
          <button
            onClick={() => onNavigatePO(p.id)}
            className="text-primary hover:underline"
            style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
          >
            PO-{p.poNumber}
          </button>
        }
        pills={
          <>
            <Pill label="Draft" />
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] whitespace-nowrap"
              style={{
                fontWeight: 600,
                backgroundColor: p.daysStale > 14
                  ? "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)"
                  : "color-mix(in srgb, hsl(var(--warning)) 16%, transparent)",
                color: p.daysStale > 14 ? "hsl(var(--destructive))" : "hsl(var(--warning))",
                fontFamily: FONT,
              }}
            >
              Stale {p.daysStale}d
            </span>
          </>
        }
        contextLine={
          <>
            Drafted {p.orderDate} · No activity for {p.daysStale} days
          </>
        }
        rightTopBlock={rightTopBlock}
        actions={
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px] gap-1"
            onClick={() => createPOForStale(p)}
          >
            <Plus className="w-3 h-3" /> Create PO
          </Button>
        }
      />
    );
  };

  /* ─── View-all dialog content builders (uses filteredRequests so modal
     reflects the same time-range slice as the dashboard) ─── */
  const allRequestsForFilter = useMemo(
    () => filteredRequests.filter((r) => r.status === requestModalFilter),
    [filteredRequests, requestModalFilter]
  );
  const filterTabCounts: Record<RequestStatus, number> = {
    Pending: filteredRequests.filter((r) => r.status === "Pending").length,
    Approved: filteredRequests.filter((r) => r.status === "Approved").length,
    Denied: filteredRequests.filter((r) => r.status === "Denied").length,
    Deferred: filteredRequests.filter((r) => r.status === "Deferred").length,
  };

  /* ─── Render ─── */

  const updatedTime = useMemo(() => {
    const d = today;
    return `${d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })} at ${d
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /* Cash-Management-style shell — content capped at 1120px wide and
       centred so KPIs / charts don't stretch on wide viewports. */
    <div className="w-full max-w-[1120px] mx-auto flex flex-col gap-5" style={{ fontFamily: FONT }}>
      {/* ═════════ TOOLBAR — sync info + reset/customize + time-range pills ═════════ */}
      <div className="flex flex-col gap-3">
        {/* Row 1: info bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", fontFamily: FONT }}
          >
            Updated as of {updatedTime}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetDashboard}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[12px] shadow-sm transition-all cursor-pointer"
              style={{ fontWeight: 500, fontFamily: FONT }}
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8]" /> Reset
            </button>
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[12px] shadow-sm transition-all cursor-pointer"
              style={{ fontWeight: 500, fontFamily: FONT }}
            >
              <Sliders className="w-3.5 h-3.5 text-[#94A3B8]" /> Customize Widgets
            </button>
          </div>
        </div>

        {/* Row 2: time-range pills */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center flex-wrap gap-1">
            {TIME_RANGE_BUTTONS.map(({ key: r, label }) => {
              if (r === "CUSTOM") {
                return (
                  <div key={r} className="relative">
                    <button
                      type="button"
                      onClick={() => setCustomPopoverOpen((o) => !o)}
                      className={`px-3 py-1 rounded-md text-[12px] transition-all inline-flex items-center gap-1 ${
                        timeRange === r
                          ? "bg-[#0A77FF] text-white shadow-sm"
                          : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                      }`}
                      style={{ fontWeight: timeRange === r ? 600 : 500, fontFamily: FONT }}
                    >
                      <Calendar className="w-3 h-3" />
                      {label}
                      {timeRange === "CUSTOM" && customRange.from && customRange.to && (
                        <span className="text-[11px]">
                          : {customRange.from} – {customRange.to}
                        </span>
                      )}
                    </button>
                    {customPopoverOpen && (
                      <div className="absolute top-full mt-2 left-0 z-30 w-[280px] rounded-xl border border-[#E2E8F0] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.10)] p-3">
                        <p
                          className="text-[11px] text-muted-foreground mb-2"
                          style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
                        >
                          Custom Range
                        </p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
                            <input
                              type="date"
                              value={customRange.from}
                              onChange={(e) =>
                                setCustomRange((p) => ({ ...p, from: e.target.value }))
                              }
                              className="w-full h-8 px-2 rounded-md border border-[#E2E8F0] text-[12px]"
                              style={{ fontFamily: FONT }}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">To</label>
                            <input
                              type="date"
                              value={customRange.to}
                              onChange={(e) =>
                                setCustomRange((p) => ({ ...p, to: e.target.value }))
                              }
                              className="w-full h-8 px-2 rounded-md border border-[#E2E8F0] text-[12px]"
                              style={{ fontFamily: FONT }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-[12px]"
                            disabled={!customRange.from || !customRange.to}
                            onClick={() => {
                              setTimeRange("CUSTOM");
                              setCustomPopoverOpen(false);
                            }}
                          >
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[12px]"
                            onClick={() => setCustomPopoverOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 rounded-md text-[12px] transition-all ${
                    timeRange === r
                      ? "bg-[#0A77FF] text-white shadow-sm"
                      : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                  }`}
                  style={{ fontWeight: timeRange === r ? 600 : 500, fontFamily: FONT }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span
            style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}
          >
            Analytics: {rangeLabel(timeRange, customRange)}
          </span>
        </div>
      </div>

      {/* ═════════ INSIGHTS HEADER — mirrors Cash Management overview ═════════ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm text-muted-foreground" style={{ fontWeight: 500, fontFamily: FONT }}>
            Insights
          </h4>
          <span className="text-[11px] text-muted-foreground/60" style={{ fontFamily: FONT }}>
            {activeKpis.length} KPI{activeKpis.length === 1 ? "" : "s"} · {activeWidgets.length} widget{activeWidgets.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCustomizeOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-[#0A77FF] hover:bg-[#EDF4FF] transition-colors cursor-pointer"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          <Sliders className="w-3.5 h-3.5" />
          Add Insights
        </button>
      </div>

      {/* ═════════ KPI STRIP — conditionally rendered per activeKpis, grid like Cash Management ═════════ */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
      >
        {activeKpis.includes("critical") && (
          <KpiCard
            icon={AlertTriangle}
            tone="red"
            label="Critical"
            value={criticalCount}
            valueColor={criticalCount > 0 ? "hsl(var(--destructive))" : undefined}
            caption={criticalCount > 0 ? "needing action today" : "all clear today"}
            tooltip="SO gaps with Critical urgency, zero-stock items, requests pending > 3 days, and drafts stale > 14 days"
          />
        )}
        {activeKpis.includes("demand_gaps") && (
          <KpiCard
            icon={Package}
            tone="blue"
            label="Demand Gaps"
            value={totalSignalsCount}
            caption={`${soGapCount} SO · ${lowStockCount} Low Stock · ${aboveMaxCount} Above Max`}
            onClick={() => setViewAll("gaps")}
          />
        )}
        {activeKpis.includes("pending_approvals") && (
          <KpiCard
            icon={Inbox}
            tone="violet"
            label="Pending Approvals"
            value={pendingRequestCount}
            badge={
              pendingOver3 > 0
                ? { text: `+${pendingOver3} > 3d`, color: "hsl(var(--destructive))" }
                : undefined
            }
            caption={pendingRequestCount === 0 ? "all caught up" : "awaiting your review"}
            onClick={() => {
              setRequestModalFilter("Pending");
              setViewAll("requests");
            }}
          />
        )}
        {activeKpis.includes("stale_drafts") && (
          <KpiCard
            icon={FileWarning}
            tone="orange"
            label="Stale Drafts"
            value={staleCount}
            caption="Drafts inactive > 7 days"
            onClick={() => setViewAll("stale")}
          />
        )}
        {activeKpis.includes("monthly_spend") && (
          <KpiCard
            icon={TrendingUp}
            tone="green"
            label={monthlySpendLabel}
            value={monthlySpendValue}
            badge={{ text: "+12%", color: "#16A34A" }}
            caption="vs prior period"
          />
        )}
      </div>

      {/* Demand Gaps + Purchase Requests — side-by-side row */}
      <div className="flex flex-wrap gap-3 items-stretch min-w-0">
        <div style={{ flex: "1 1 calc(50% - 6px)", minWidth: 380 }}>
          <WidgetCard
            icon={Package}
            title="Demand Gaps"
            count={`${totalSignalsCount} ${totalSignalsCount === 1 ? "item" : "items"}`}
            actions={
              totalSignalsCount > 3 && (
                <button
                  type="button"
                  onClick={() => setViewAll("gaps")}
                  className="text-[12.5px] text-primary hover:underline transition-colors cursor-pointer"
                  style={{ fontWeight: 600, fontFamily: FONT, background: "transparent", border: 0 }}
                >
                  View all {totalSignalsCount} →
                </button>
              )
            }
            contentClassName="p-3"
          >
            <div className="flex flex-col gap-1.5">
              {topGaps.map((s) => renderSignalCard(s))}
              {topGaps.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-6">No demand gaps right now.</div>
              )}
            </div>
          </WidgetCard>
        </div>

        <div style={{ flex: "1 1 calc(50% - 6px)", minWidth: 380 }}>
          <WidgetCard
            icon={Inbox}
            title="Purchase Requests"
            count={`${pendingRequestCount} pending`}
            actions={
              totalRequestsCount > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setRequestModalFilter("Pending");
                    setViewAll("requests");
                  }}
                  className="text-[12.5px] text-primary hover:underline transition-colors cursor-pointer"
                  style={{ fontWeight: 600, fontFamily: FONT, background: "transparent", border: 0 }}
                >
                  View all {totalRequestsCount} →
                </button>
              )
            }
            contentClassName="p-3"
          >
            <div className="flex flex-col gap-1.5">
              {topRequests.map((r) => renderRequestCard(r))}
              {topRequests.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-6">No pending requests.</div>
              )}
            </div>
          </WidgetCard>
        </div>

        {/* Stale POs — same half-width as Demand Gaps / Purchase Requests
            (flex-grow: 0 so it stays at 50% when alone on its row) */}
        <div style={{ flex: "0 1 calc(50% - 6px)", minWidth: 380 }}>
          <WidgetCard
            icon={FileWarning}
            title="Stale Purchase Orders"
            count={`${staleCount} ${staleCount === 1 ? "draft" : "drafts"}`}
            tooltip="Only Draft POs with no activity for more than 7 days are shown here. Sent and Confirmed POs use a separate follow-up flow."
            actions={
              staleCount > 3 && (
                <button
                  type="button"
                  onClick={() => setViewAll("stale")}
                  className="text-[12.5px] text-primary hover:underline transition-colors cursor-pointer"
                  style={{ fontWeight: 600, fontFamily: FONT, background: "transparent", border: 0 }}
                >
                  View all {staleCount} →
                </button>
              )
            }
            contentClassName="p-3"
          >
            <div className="flex flex-col gap-1.5">
              {topStale.map((p) => renderStaleCard(p))}
              {topStale.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-6">No stale drafts — everything is current.</div>
              )}
            </div>
          </WidgetCard>
        </div>
      </div>

        {/* Analytics widgets — conditionally rendered per activeWidgets, filtered by timeRange */}
        <div className="flex flex-wrap gap-3 items-stretch min-w-0">
          {activeWidgets.includes("spend_trend") && (
          <ChartWidget
            icon={TrendingUp}
            title="Spend Trend"
            height={200}
            footerStats={[
              { label: rangeLabel(timeRange, customRange), value: monthlySpendValue },
              { label: "vs prior period", value: "+12%", color: "hsl(var(--success))" },
              { label: "12-mo avg", value: "$22.6K" },
            ]}
          >
            <AreaChart data={filteredSpendTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <ReTooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(val: number) => [`$${val.toLocaleString()}`, "Spend"]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#spendGrad)"
              />
            </AreaChart>
          </ChartWidget>
          )}

          {activeWidgets.includes("weekly_activity") && (
          <ChartWidget
            icon={BarChart3}
            title="Weekly Activity"
            height={200}
            footerStats={[
              { label: "POs created", value: "32" },
              { label: "POs sent", value: "25" },
              { label: "Items received", value: "12" },
              { label: "Total spend", value: "$24,500", color: "#1F2937" },
            ]}
          >
            <BarChart data={filteredWeeklyActivity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="created" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="sent" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ChartWidget>
          )}

          {activeWidgets.includes("request_status") && (
          <ChartWidget
            icon={PieChartIcon}
            title="Request Status"
            height={200}
            footerStats={[
              { label: "Pending", value: String(requestCounts.pending) },
              { label: "Approved", value: `${requestCounts.approved} (${approvedPct}%)`, color: "hsl(var(--success))" },
              { label: "Denied", value: String(requestCounts.denied) },
              { label: "Deferred", value: String(requestCounts.deferred) },
              {
                label: "Pending > 3d",
                value: String(pendingOver3),
                color: pendingOver3 > 0 ? "hsl(var(--destructive))" : undefined,
              },
            ]}
          >
            <PieChart>
              <Pie
                data={requestStatusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                dataKey="value"
              >
                {requestStatusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ReTooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ChartWidget>
          )}

          {activeWidgets.includes("vendor_response") && (
          <ChartWidget
            icon={Activity}
            title="Vendor Response Time"
            height={200}
            footerStats={[
              { label: "Avg this month", value: "2.3 days" },
              { label: "vs last month", value: "-18%", color: "hsl(var(--success))" },
              { label: "Pending confirm", value: "3" },
              { label: "Overdue", value: "1", color: "hsl(var(--warning))" },
            ]}
          >
            <LineChart data={filteredResponseTime} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}d`}
              />
              <ReTooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`${val} days`, "Avg"]} />
              <Line
                type="monotone"
                dataKey="days"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartWidget>
          )}
        </div>

      {/* ═════════ Customize Widgets slide-in panel ═════════ */}
      <CustomizePanel
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        activeWidgets={activeWidgets}
        onToggleWidget={toggleWidget}
        kpiValues={kpiValues}
      />

      {/* ═════════ View-all dialogs ═════════ */}
      <Dialog open={viewAll === "gaps"} onOpenChange={(o) => !o && setViewAll(null)}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>All Demand Gaps · {totalSignalsCount}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
            {sortedSignals.map((s) => renderSignalCard(s))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewAll === "requests"} onOpenChange={(o) => !o && setViewAll(null)}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>All Purchase Requests · {totalRequestsCount}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {(["Pending", "Approved", "Denied", "Deferred"] as RequestStatus[]).map((t) => {
              const active = requestModalFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRequestModalFilter(t)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                    active
                      ? "bg-accent text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                  style={{ fontWeight: 500, fontFamily: FONT }}
                >
                  {t}
                  <span
                    className="inline-flex items-center px-1 rounded-sm text-[9px]"
                    style={{
                      fontWeight: 600,
                      backgroundColor: active
                        ? "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)"
                        : "hsl(var(--muted))",
                      color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {filterTabCounts[t]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5 max-h-[65vh] overflow-y-auto">
            {allRequestsForFilter.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8">
                No {requestModalFilter.toLowerCase()} requests.
              </div>
            ) : (
              allRequestsForFilter.map((r) => renderRequestCard(r))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewAll === "stale"} onOpenChange={(o) => !o && setViewAll(null)}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>All Stale Draft POs · {staleCount}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
            {sortedStale.map((p) => renderStaleCard(p))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
