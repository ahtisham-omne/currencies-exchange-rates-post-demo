// @ts-nocheck
// Shipments table — Items-listing chrome parity (Slice 2).
// Toolbar (Search + Filters visual + count + Density + Columns) → Pill row →
// Sticky title-case headers → Standardized pagination. The Create Shipment CTA
// lives in the SalesOverviewPanel sub-tab strip — do not duplicate here.
import React, { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  AlignJustify,
  List,
  ChevronDown,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
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
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { cn } from "@/lib/utils";
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  InitialAvatar,
  OverflowTooltip,
  StatusPill,
  getShipmentStatusTone,
  normalizeShipmentStatusLabel,
} from "../../items-v3";
import type { ColumnConfig } from "../../items-v3";

/* ─── Data shape ─── */
interface Shipment {
  id: string;
  orders: string;
  moreOrders: number;
  customer: string;
  customerIcon: string;
  items: string;
  moreItems: number;
  status: string;
  dispatch: string;
  shipTo: string;
  address: string;
  carrier: string;
  carrierIcon: string;
  carrierColor: string; // tailwind bg class — brand-correct, data-driven
  method: string;
  delivery: string;
  rep: string;
  created: string;
}

/* Mock data — preserved verbatim from ItemDetail.tsx Shipments body. */
const SHIPMENTS: Shipment[] = [
  { id: "SH739320", orders: "SO98376543", moreOrders: 2, customer: "Toyota International Motor Manufacturing", customerIcon: "T", items: "274984394", moreItems: 3, status: "Draft", dispatch: "Dec 1, 2025", shipTo: "General Motor Manufacturing, Illinois (GMMI)", address: "1538 Maple Street, Rivertown, New Jersey 07000, United States", carrier: "FedEx", carrierIcon: "F", carrierColor: "bg-purple-600", method: "FedEx Air", delivery: "Dec 1, 2025", rep: "Eli Rosenbloom", created: "Dec 1, 2025" },
  { id: "SH739321", orders: "SO9638521",  moreOrders: 0, customer: "General Motors (GM)",                       customerIcon: "G", items: "274984394", moreItems: 3, status: "Draft", dispatch: "Dec 15, 2025", shipTo: "General Motor Manufacturing, Illinois (GMMI)", address: "5827 Pine Avenue, Maplewood, Minnesota 55109, United States", carrier: "Blue Dart", carrierIcon: "B", carrierColor: "bg-blue-500",   method: "Blue Dart Express", delivery: "Dec 15, 2025", rep: "Eesha Imtiaz",   created: "Dec 15, 2025" },
  { id: "SH739322", orders: "SO3214568",  moreOrders: 3, customer: "Ford Motor Company",                        customerIcon: "F", items: "274984394", moreItems: 3, status: "Picking In Progress", dispatch: "Nov 30, 2025", shipTo: "Toyota Industries Tokyo, Japan",         address: "2643 Oak Lane, Greenfield, Wisconsin 53220, United States",   carrier: "Japan Post", carrierIcon: "J", carrierColor: "bg-yellow-500", method: "Japan Post Air",     delivery: "Nov 30, 2025", rep: "Eesha Imtiaz",   created: "Nov 30, 2025" },
  { id: "SH739323", orders: "SO3682581",  moreOrders: 3, customer: "Tesla, Inc.",                               customerIcon: "T", items: "274984394", moreItems: 3, status: "Ready to pick",        dispatch: "Dec 20, 2025", shipTo: "Honda Manufacturing Toronto, Canada",     address: "1075 Elm Drive, Lakeview, Oregon 97034, United States",       carrier: "FedEx",     carrierIcon: "F", carrierColor: "bg-purple-600", method: "FedEx Express",      delivery: "Dec 20, 2025", rep: "Eli Rosenbloom", created: "Dec 20, 2025" },
  { id: "SH739324", orders: "SO9376543",  moreOrders: 2, customer: "Chrysler (Stellantis N.V.)",                 customerIcon: "C", items: "274984394", moreItems: 3, status: "Shipped",              dispatch: "Nov 1, 2025",  shipTo: "BMW Group Munich, Germany",               address: "4321 Birch Road, Ashville, North Carolina 28801, United States", carrier: "TCS",      carrierIcon: "T", carrierColor: "bg-red-600",    method: "TCS (Tranzum Carrier Service)", delivery: "Nov 1, 2025", rep: "Areeb Tanveer",  created: "Nov 1, 2025" },
  { id: "SH739325", orders: "SO1597534",  moreOrders: 2, customer: "Rivian Automotive",                          customerIcon: "R", items: "274984394", moreItems: 3, status: "Shipped",              dispatch: "Dec 5, 2025",  shipTo: "Volkswagen AG Wolfsburg, Germany",        address: "7610 Cedar Boulevard, Riverview, Florida 33569, United States", carrier: "Japan Post", carrierIcon: "J", carrierColor: "bg-yellow-500", method: "Japan Post Air", delivery: "Dec 5, 2025", rep: "Eli Rosenbloom", created: "Dec 5, 2025" },
  { id: "SH739326", orders: "SO7416529",  moreOrders: 0, customer: "Lucid Motors",                               customerIcon: "L", items: "274984394", moreItems: 3, status: "Picking In Progress", dispatch: "Dec 10, 2025", shipTo: "General Motors Detroit, USA",             address: "5689 Spruce Court, Hilltop, Ohio 44101, United States",       carrier: "FedEx",     carrierIcon: "F", carrierColor: "bg-purple-600", method: "FedEx Air",          delivery: "Dec 10, 2025", rep: "Eli Rosenbloom", created: "Dec 10, 2025" },
  { id: "SH739327", orders: "SO2583647",  moreOrders: 2, customer: "Honda Motor Co., Ltd. (USA)",                customerIcon: "H", items: "274984394", moreItems: 3, status: "Picking In Progress", dispatch: "Nov 15, 2025", shipTo: "Nissan Motors Yokohama, Japan",           address: "2398 Redwood Crescent, Valley City, Utah 84001, United States", carrier: "Japan Post", carrierIcon: "J", carrierColor: "bg-yellow-500", method: "Japan Post Express", delivery: "Nov 15, 2025", rep: "Eli Rosenbloom", created: "Nov 15, 2025" },
  { id: "SH739328", orders: "SO4561238",  moreOrders: 2, customer: "Nissan North America",                       customerIcon: "N", items: "274984394", moreItems: 3, status: "Ready to ship",        dispatch: "Dec 25, 2025", shipTo: "Hyundai Motors Seoul, South Korea",       address: "3214 Chestnut Way, Pleasantville, California 94566, United States", carrier: "TCS", carrierIcon: "T", carrierColor: "bg-red-600",    method: "TCS (Tranzum Carrier Service)", delivery: "Dec 25, 2025", rep: "Eesha Imtiaz", created: "Dec 25, 2025" },
  { id: "SH739329", orders: "SO3571598",  moreOrders: 2, customer: "BMW of North America",                       customerIcon: "B", items: "274984394", moreItems: 3, status: "Shipped",              dispatch: "Oct 30, 2025", shipTo: "Mercedes-Benz Stuttgart, Germany",        address: "4876 Willow Street, Montgomery, Alabama 36101, United States", carrier: "DHL", carrierIcon: "D", carrierColor: "bg-amber-500",  method: "DHL Express",        delivery: "Oct 30, 2025", rep: "Eesha Imtiaz", created: "Oct 30, 2025" },
];

/* ─── Column config + widths ─── */
const SHIPMENT_COLUMNS: ColumnConfig[] = [
  { key: "id",            label: "Shipment ID" },
  { key: "orders",        label: "Included Sales Orders" },
  { key: "customer",      label: "Customer Name" },
  { key: "items",         label: "Items to Ship" },
  { key: "status",        label: "Shipment Status" },
  { key: "dispatch",      label: "Due Dispatch Date" },
  { key: "shipTo",        label: "Ship To" },
  { key: "address",       label: "Shipping Address" },
  { key: "carrier",       label: "Carrier" },
  { key: "method",        label: "Shipment Method" },
  { key: "delivery",      label: "Est. Delivery Date" },
  { key: "rep",           label: "Sales Rep" },
  { key: "created",       label: "Created On" },
  { key: "actions",       label: "Actions" },
];

const SH_COLUMN_WIDTHS: Record<string, number> = {
  id:       110,
  orders:   170,
  customer: 240,
  items:    160,
  status:   150,
  dispatch: 140,
  shipTo:   200,
  address:  220,
  carrier:  140,
  method:   180,
  delivery: 140,
  rep:      170,
  created:  120,
  actions:  60,
};

const SH_LOCKED_COLUMNS = ["id"];

const SH_QUICK_FILTERS = [
  { key: "All",                 label: "All" },
  { key: "Drafts",              label: "Drafts" },
  { key: "Ready to Pick",       label: "Ready to Pick" },
  { key: "Picking in progress", label: "Picking in progress" },
  { key: "Ready to Ship",       label: "Ready to Ship" },
  { key: "Shipped",             label: "Shipped" },
] as const;
type ShQuickFilter = (typeof SH_QUICK_FILTERS)[number]["key"];

/* Preserve literal counts from the legacy pill row (151/10/15/5/1/100). */
const SH_QUICK_FILTER_COUNTS: Record<ShQuickFilter, number> = {
  "All": 151,
  "Drafts": 10,
  "Ready to Pick": 15,
  "Picking in progress": 5,
  "Ready to Ship": 1,
  "Shipped": 100,
};

type ShDensity = "condensed" | "comfort";
const SH_DENSITY_CONFIG: { key: ShDensity; label: string; description: string; icon: "align-justify" | "list" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view",  icon: "align-justify" },
  { key: "comfort",   label: "Comfort",   description: "Spacious view", icon: "list" },
];

function shMatchesQuickFilter(row: Shipment, qf: ShQuickFilter): boolean {
  if (qf === "All") return true;
  const s = row.status.toLowerCase();
  if (qf === "Drafts") return s === "draft";
  if (qf === "Ready to Pick") return s.includes("ready to pick");
  if (qf === "Picking in progress") return s.includes("picking");
  if (qf === "Ready to Ship") return s.includes("ready to ship");
  if (qf === "Shipped") return s === "shipped";
  return true;
}

function shMatchesSearch(row: Shipment, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return Object.values(row).some((v) => String(v).toLowerCase().includes(needle));
}

export function ShipmentsTable() {
  const [shSearch, setShSearch] = useState("");
  const [shQuickFilter, setShQuickFilter] = useState<ShQuickFilter>("All");
  const [shColumnOrder, setShColumnOrder] = useState<string[]>(SHIPMENT_COLUMNS.map((c) => c.key));
  const [shColumnVisibility, setShColumnVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(SHIPMENT_COLUMNS.map((c) => [c.key, true]))
  );
  const [shColumnsOpen, setShColumnsOpen] = useState(false);
  const [shDensity, setShDensity] = useState<ShDensity>("condensed");
  const [shPage, setShPage] = useState(1);
  const [shPageSize, setShPageSize] = useState(20);

  const shFilteredRows = useMemo(
    () => SHIPMENTS.filter((r) => shMatchesQuickFilter(r, shQuickFilter) && shMatchesSearch(r, shSearch)),
    [shSearch, shQuickFilter]
  );

  const totalRows = SHIPMENTS.length;
  const filteredCount = shFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / shPageSize));
  const currentPage = Math.min(shPage, totalPages);
  const startIdx = (currentPage - 1) * shPageSize;
  const pagedRows = shFilteredRows.slice(startIdx, startIdx + shPageSize);

  const visibleColumns = shColumnOrder
    .map((k) => SHIPMENT_COLUMNS.find((c) => c.key === k))
    .filter((c): c is ColumnConfig => !!c && shColumnVisibility[c.key] !== false);
  const visibleCount = visibleColumns.length;

  const isRelaxed = shDensity === "comfort";
  const cellPadY = isRelaxed ? "py-3" : "py-1.5";
  const cellTextSize = isRelaxed ? "text-[13.5px]" : "text-xs";

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

  const renderCell = (col: ColumnConfig, row: Shipment) => {
    switch (col.key) {
      case "id":
        return <span className={`${cellTextSize} font-mono text-foreground`} style={{ fontWeight: 500 }}>{row.id}</span>;
      case "orders":
        return (
          <div className="flex items-center gap-1.5">
            <span className={`${cellTextSize} font-mono text-muted-foreground`}>{row.orders}</span>
            {row.moreOrders > 0 && (
              <span className="text-[10px] text-primary underline cursor-pointer hover:text-primary/80">+{row.moreOrders} more</span>
            )}
          </div>
        );
      case "customer":
        return (
          <div className="flex items-center gap-2.5">
            <InitialAvatar name={row.customer} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{row.customer}</span>
          </div>
        );
      case "items":
        return (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-secondary/50 border border-border p-0.5 shrink-0">
              <ImageIcon size={12} className="text-muted-foreground w-full h-full opacity-50" />
            </div>
            <div className="flex items-center gap-1">
              <span className={`${cellTextSize} font-mono text-muted-foreground`}>{row.items}</span>
              <span className="text-[10px] text-muted-foreground">+{row.moreItems} more</span>
            </div>
          </div>
        );
      case "status":
        return (
          <StatusPill
            label={normalizeShipmentStatusLabel(row.status)}
            tone={getShipmentStatusTone(row.status)}
          />
        );
      case "dispatch":
        return <span className={`${cellTextSize} text-muted-foreground whitespace-nowrap`}>{row.dispatch}</span>;
      case "shipTo":
        return (
          <OverflowTooltip
            category="Ship To"
            items={[{ id: row.id + "-shipto", name: row.shipTo, subtitle: row.address }]}
          >
            <span className={`${cellTextSize} text-muted-foreground truncate block`}>{row.shipTo}</span>
          </OverflowTooltip>
        );
      case "address":
        return (
          <OverflowTooltip
            category="Shipping Address"
            items={[{ id: row.id + "-addr", name: row.address, subtitle: row.shipTo }]}
          >
            <span className={`${cellTextSize} text-muted-foreground truncate block`}>{row.address}</span>
          </OverflowTooltip>
        );
      case "carrier":
        return (
          <div className="inline-flex items-center gap-2">
            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", row.carrierColor)}>
              {row.carrierIcon}
            </div>
            <span className={`${cellTextSize} text-foreground`}>{row.carrier}</span>
          </div>
        );
      case "method":
        return (
          <div className="flex items-center gap-1.5">
            <div className={cn("h-2 w-6 rounded-sm shrink-0", row.carrierColor)} />
            <span className={`${cellTextSize} text-muted-foreground truncate`}>{row.method}</span>
          </div>
        );
      case "delivery":
        return <span className={`${cellTextSize} text-muted-foreground whitespace-nowrap`}>{row.delivery}</span>;
      case "rep":
        return (
          <div className="flex items-center gap-2.5">
            <InitialAvatar name={row.rep} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{row.rep}</span>
          </div>
        );
      case "created":
        return <span className={`${cellTextSize} text-muted-foreground whitespace-nowrap`}>{row.created}</span>;
      case "actions":
        return (
          <button className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted">
            <MoreHorizontal size={14} />
          </button>
        );
      default:
        return <span className={`${cellTextSize} text-muted-foreground`}>{(row as any)[col.key] ?? "-"}</span>;
    }
  };

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      {/* Toolbar Row 1: Search + Filters | count + Density + Columns */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search shipments..."
              value={shSearch}
              onChange={(e) => { setShSearch(e.target.value); setShPage(1); }}
              className="pl-9 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            {filteredCount !== totalRows ? (
              <>
                <span className="text-foreground">{filteredCount}</span>
                <span className="text-muted-foreground/60"> of </span>
                <span className="text-muted-foreground">{totalRows}</span>
                <span className="text-muted-foreground/70"> shipments</span>
              </>
            ) : (
              <>
                <span className="text-foreground">{totalRows}</span>
                <span className="text-muted-foreground/70"> shipments</span>
              </>
            )}
          </span>

          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {shDensity === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                {shDensity === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                  {SH_DENSITY_CONFIG.find((d) => d.key === shDensity)?.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[230px] p-1.5">
              {SH_DENSITY_CONFIG.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                  onSelect={() => setShDensity(opt.key)}
                >
                  {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                  {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                  {shDensity === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ColumnSelectorTrigger
            visibleCount={visibleCount}
            active={shColumnsOpen}
            onClick={() => setShColumnsOpen(!shColumnsOpen)}
          />
        </div>
      </div>

      {/* Toolbar Row 2: Quick filter pills (Partners literal active styling) */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
        {SH_QUICK_FILTERS.map((qf) => {
          const isActive = shQuickFilter === qf.key;
          const count = SH_QUICK_FILTER_COUNTS[qf.key];
          const showCount = qf.key !== "All";
          return (
            <button
              key={qf.key}
              onClick={() => { setShQuickFilter(qf.key); setShPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                  : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
              }`}
              style={{
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "#0A77FF" : undefined,
              }}
            >
              {qf.label}
              {(showCount || qf.key === "All") && (
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                    isActive ? "bg-primary/10" : "bg-muted"
                  }`}
                  style={{
                    fontWeight: 600,
                    color: isActive ? "#0A77FF" : "#475569",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow
              className={cn(
                "bg-muted/30 hover:bg-muted/30 border-b border-border",
                isRelaxed ? "[&>th]:h-9" : "[&>th]:h-8"
              )}
            >
              <TableHead className="pl-4" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                <Checkbox className="scale-75" />
              </TableHead>
              {visibleColumns.map((col) => {
                const isActions = col.key === "actions";
                const width = SH_COLUMN_WIDTHS[col.key] ?? 160;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap",
                      isActions && "text-center pr-4"
                    )}
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      overflow: "hidden",
                    }}
                  >
                    <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>
                      {col.label}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row, i) => (
              <TableRow
                key={`${row.id}-${i}`}
                className="group border-b border-border/50 hover:bg-[#F0F7FF] transition-colors"
              >
                <TableCell className={cn("pl-4", cellPadY)} style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                  <Checkbox className="scale-75" />
                </TableCell>
                {visibleColumns.map((col) => {
                  const isActions = col.key === "actions";
                  const width = SH_COLUMN_WIDTHS[col.key] ?? 160;
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        cellPadY,
                        isActions && "text-center pr-4"
                      )}
                      style={{
                        width: `${width}px`,
                        minWidth: `${width}px`,
                        maxWidth: `${width}px`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {renderCell(col, row)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {pagedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-12 text-sm text-muted-foreground">
                  No shipments match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — literal from ItemsListPageV3 */}
      {filteredCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Records per page</span>
            <Select value={String(shPageSize)} onValueChange={(val) => { setShPageSize(Number(val)); setShPage(1); }}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setShPage(1)}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setShPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>
            {getPageNumbers().map((pg, idx) =>
              pg === "..." ? (
                <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  key={pg}
                  variant={currentPage === pg ? "default" : "ghost"}
                  size="sm"
                  className={`h-8 w-8 p-0 text-sm ${currentPage === pg ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => setShPage(pg as number)}
                >
                  {pg}
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setShPage((p) => Math.min(totalPages, p + 1))}>
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setShPage(totalPages)}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Column Selector Side Drawer */}
      <ColumnSelector
        columns={SHIPMENT_COLUMNS}
        columnOrder={shColumnOrder}
        columnVisibility={shColumnVisibility}
        onColumnOrderChange={setShColumnOrder}
        onColumnVisibilityChange={setShColumnVisibility}
        lockedColumns={SH_LOCKED_COLUMNS}
        open={shColumnsOpen}
        onOpenChange={setShColumnsOpen}
      />
    </div>
  );
}