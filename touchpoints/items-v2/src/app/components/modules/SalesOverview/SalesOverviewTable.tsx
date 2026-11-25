// @ts-nocheck
// Sales Overview table — Items-listing chrome parity (Slice 1).
// Toolbar (Search + Filters visual + count + Density + Columns) → Pill row → Sticky title-case headers → Pagination.
// Per-column ColumnHeaderMenu / ActiveFiltersBar / FiltersModal deferred to generalization slice.
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
  Package,
  Layers,
  Warehouse as WarehouseIcon,
  EyeOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
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
import { OverflowTooltip } from "./OverflowTooltip";
import type { OverflowItem } from "./OverflowTooltip";
import { cn } from "@/lib/utils";
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  InitialAvatar,
} from "../../items-v3";
import type { ColumnConfig } from "../../items-v3";
import { isBaseCurrency } from "@/app/currency/currencies";
import { RATE_PROVIDER, rateOn } from "@/app/currency/rates";
import { fromUsd } from "@/app/currency/vendorFx";
import { baseMoney } from "@/app/currency/itemMoney";
import { type MoneyFx } from "../../currency/Money";
import { ColumnView, RowMoney, RowViewTable, ShowValuesAs, useColumnView } from "../../currency/RowCurrencyView";
import { CurrencyCodeCell } from "../../currency/CurrencyCodeCell";

/* ─── Data shape ─── */
type SalesOrderPriority = "Low" | "Standard" | "High";

interface SalesOrderLineItem {
  itemCode: string;
  itemName: string;
}

interface SalesOrder {
  id: string;
  salesOrderNumber: string;
  quoteNumber: string;
  customerName: string;
  poc: string;
  additionalPocs?: { name: string; role?: string; email?: string }[];
  salesRep: string;
  /** The order's currency, the customer's. The amounts below are in it. */
  currency: string;
  orderValue: number;
  orderDate: string;
  shipBy: string;
  deliveryDate: string;
  createdOn: string;
  createdBy: string;
  isLate?: boolean;
  status: SalesOrderStatus;
  /* Columns ported from Sales-Order-V5 listing */
  invoicedAmount: number | null;   // null for none
  paymentsMade: number | null;     // null for none
  requestedOn: string;      // customer-requested date
  confirmationDate: string; // "" until non-Draft/Pending
  priority: SalesOrderPriority;
  tags: string[];
  lastUpdatedOn: string;
  lastUpdatedBy: string;
  lineItems: SalesOrderLineItem[];
}

type SalesOrderStatus =
  | "Pending Approval"
  | "Active"
  | "Overdue"
  | "Completed"
  | "Cancelled";

/* Priority pill — ported verbatim from Sales-Order-V5 PriorityBadge
 * (StatusBadge.tsx lines 181-196). rounded-full, hairline colored border,
 * text-xs / fontWeight 500. */
const PRIORITY_TOKENS: Record<SalesOrderPriority, { bg: string; text: string; border: string }> = {
  Low:      { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  Standard: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  High:     { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

function PriorityPill({ priority }: { priority: SalesOrderPriority }) {
  const t = PRIORITY_TOKENS[priority];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, fontWeight: 500 }}
    >
      {priority}
    </span>
  );
}

/* SO status pill — ported verbatim from Sales-Order-V5 SOStatusBadge
 * (StatusBadge.tsx lines 34-62). rounded-full, dot-color-derived hairline
 * border at 20% opacity, text-xs / fontWeight 500. Palette mapped from
 * the source's SO statuses to the item app's 5-status vocabulary. */
const SO_STATUS_TOKENS: Record<SalesOrderStatus, { bg: string; text: string; dot: string }> = {
  "Pending Approval": { bg: "#FFFBEB", text: "#92400E", dot: "#D97706" },
  Active:             { bg: "#E5F0FF", text: "#0F62D6", dot: "#0A77FF" },
  Overdue:            { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
  Completed:          { bg: "#ECFDF5", text: "#065F46", dot: "#059669" },
  Cancelled:          { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
};

function SOStatusPill({ status }: { status: SalesOrderStatus }) {
  const c = SO_STATUS_TOKENS[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        fontWeight: 500,
        border: `1px solid ${c.dot}20`,
      }}
    >
      {status}
    </span>
  );
}

/* Mock data — preserved from legacy SalesOverview.tsx (lines 128-204), with status added.
   Each order now has the customer's currency (Currency Touchpoints Map, Items
   5): SO-2026-001 USD, SO-2026-004 EUR, the others PKR. The design writes the
   amounts in $; they are restated in the order's currency below. */
const SALES_ORDERS: SalesOrder[] = ([
  {
    id: "1", salesOrderNumber: "SO-2026-001", quoteNumber: "QT-2026-1001",
    customerName: "Precision Parts Ltd.", poc: "Kevin",
    additionalPocs: [{ name: "Marissa Cole", role: "Procurement Lead", email: "marissa.cole@precisionparts.com" }],
    salesRep: "James Rodriquez", currency: "USD", orderValue: 20850,
    orderDate: "2025-12-17", shipBy: "2025-12-29", deliveryDate: "2026-01-03",
    createdOn: "2025-12-17", createdBy: "Sarah Wilson", status: "Active",
    invoicedAmount: 8500, paymentsMade: 5000,
    requestedOn: "2025-12-15", confirmationDate: "2025-12-19",
    priority: "High", tags: ["Rush", "Repeat"],
    lastUpdatedOn: "2026-01-12", lastUpdatedBy: "James Rodriquez",
    lineItems: [
      { itemCode: "VALV-BAL-316", itemName: "Ball Valve 316 SS" },
      { itemCode: "GKT-EPDM-2", itemName: "EPDM Gasket 2 inch" },
      { itemCode: "PIPE-SCH40", itemName: "Sch 40 Pipe" },
      { itemCode: "FLNG-150#", itemName: "Flange 150#" },
      { itemCode: "ELB-90-2", itemName: "90 Elbow 2 inch" },
    ],
  },
  {
    id: "2", salesOrderNumber: "SO-2026-002", quoteNumber: "QT-2026-1002",
    customerName: "MegaCorp Inc.", poc: "Jim",
    salesRep: "David Park", currency: "PKR", orderValue: 11225,
    orderDate: "2025-12-16", shipBy: "2026-02-20", deliveryDate: "2026-02-25",
    createdOn: "2025-12-16", createdBy: "Emily Chen", status: "Pending Approval",
    invoicedAmount: null, paymentsMade: null,
    requestedOn: "2025-12-14", confirmationDate: "",
    priority: "Standard", tags: ["New Customer"],
    lastUpdatedOn: "2025-12-18", lastUpdatedBy: "Emily Chen",
    lineItems: [
      { itemCode: "VALV-BAL-316", itemName: "Ball Valve 316 SS" },
      { itemCode: "SEAL-VIT-A1", itemName: "Viton Seal A1" },
      { itemCode: "BOLT-M8-25", itemName: "M8x25 Bolt" },
    ],
  },
  {
    id: "3", salesOrderNumber: "SO-2026-003", quoteNumber: "QT-2026-1003",
    customerName: "BuildIt Construction", poc: "Robert",
    additionalPocs: [{ name: "Sandra Liu", role: "Site Manager", email: "sandra.liu@buildit.com" }],
    salesRep: "Emily Chen", currency: "PKR", orderValue: 557555,
    orderDate: "2025-11-08", shipBy: "2025-11-19", deliveryDate: "2025-11-24",
    createdOn: "2025-11-08", createdBy: "Robert Zhang", status: "Completed",
    invoicedAmount: 557555, paymentsMade: 557555,
    requestedOn: "2025-11-06", confirmationDate: "2025-11-10",
    priority: "Standard", tags: ["Bulk"],
    lastUpdatedOn: "2025-12-28", lastUpdatedBy: "Robert Zhang",
    lineItems: [
      { itemCode: "VALV-BAL-316", itemName: "Ball Valve 316 SS" },
      { itemCode: "PIPE-SCH80", itemName: "Sch 80 Pipe" },
      { itemCode: "TEE-EQ-3", itemName: "Equal Tee 3 inch" },
      { itemCode: "REDUCER-3-2", itemName: "Reducer 3x2" },
      { itemCode: "FLNG-300#", itemName: "Flange 300#" },
      { itemCode: "GKT-PTFE-3", itemName: "PTFE Gasket 3 inch" },
      { itemCode: "STUD-B7-1", itemName: "B7 Stud 1 inch" },
      { itemCode: "NUT-2H-1", itemName: "2H Nut 1 inch" },
      { itemCode: "ELB-45-3", itemName: "45 Elbow 3 inch" },
      { itemCode: "CAP-BLIND-3", itemName: "Blind Cap 3 inch" },
      { itemCode: "STRAINER-Y-3", itemName: "Y Strainer 3 inch" },
      { itemCode: "CHECK-SW-3", itemName: "Swing Check 3 inch" },
    ],
  },
  {
    id: "4", salesOrderNumber: "SO-2026-004", quoteNumber: "QT-2026-1004",
    customerName: "Acme Corporation", poc: "Andy",
    additionalPocs: [
      { name: "Priya Nair", role: "Buyer", email: "priya.nair@acme.com" },
      { name: "Tom Becker", role: "Warehouse Ops", email: "tom.becker@acme.com" },
    ],
    salesRep: "James Rodriquez", currency: "EUR", orderValue: 167875,
    orderDate: "2025-10-15", shipBy: "2026-01-18", deliveryDate: "2026-01-23",
    createdOn: "2025-10-15", createdBy: "Priya Nair", status: "Overdue", isLate: true,
    invoicedAmount: 80000, paymentsMade: 40000,
    requestedOn: "2025-10-13", confirmationDate: "2025-10-17",
    priority: "High", tags: ["Rush", "VIP", "Escalated"],
    lastUpdatedOn: "2026-01-05", lastUpdatedBy: "Priya Nair",
    lineItems: [
      { itemCode: "VALV-BAL-316", itemName: "Ball Valve 316 SS" },
      { itemCode: "ACT-PNEU-A", itemName: "Pneumatic Actuator A" },
      { itemCode: "REG-PRES-1", itemName: "Pressure Regulator 1" },
      { itemCode: "GAUGE-100PSI", itemName: "100 PSI Gauge" },
      { itemCode: "TUBE-CU-1/2", itemName: "Copper Tube 1/2" },
      { itemCode: "COMP-FIT-1/2", itemName: "Compression Fitting 1/2" },
      { itemCode: "MANIFOLD-4W", itemName: "4-Way Manifold" },
      { itemCode: "SOL-VALV-24V", itemName: "24V Solenoid Valve" },
    ],
  },
] as SalesOrder[]).map(inOrderCurrency);

/* The design's $ amounts in the order's currency, at the last sync's
   mid-market rate (as the qualified vendors' amounts are restated). A USD
   order keeps the design's figures. */
function inOrderCurrency(row: SalesOrder): SalesOrder {
  const to = (n: number | null) => (n == null ? null : fromUsd(n, row.currency));
  return { ...row, orderValue: to(row.orderValue) ?? 0, invoicedAmount: to(row.invoicedAmount), paymentsMade: to(row.paymentsMade) };
}

/* The order's rate to base: mid-market on the order date, the rate the order
   locks when confirmed. Order value, invoiced and paid show in base at it,
   and the hover gives the amount in the order's currency. Null for a base
   (PKR) order, which shows plain PKR. */
function orderFx(row: SalesOrder): MoneyFx | null {
  if (isBaseCurrency(row.currency)) return null;
  const q = rateOn(row.currency, row.orderDate, "mid");
  return q.rate ? { rate: q.rate, rateType: "mid", rateDate: row.orderDate, source: RATE_PROVIDER } : null;
}

/** An order amount in its column's view: base (the default), or the order's
 *  own currency on the column's "Show values as: Customer currency"; the other
 *  figure is on the hover of a foreign order. */
function OrderAmount({ row, value, className }: { row: SalesOrder; value: number; className?: string }) {
  return (
    <RowMoney
      value={value}
      currency={row.currency}
      fx={orderFx(row)}
      dateLabel="order date"
      role="order currency"
      className={className}
    />
  );
}

/* The amount columns, each with "Show values as" in its header menu. */
const SO_MONEY_COLUMNS = new Set(["orderValue", "invoicedAmount", "paymentsMade"]);

/* A money column's header menu, as the Partners listing draws it: the column
   name, "Show values as" (Base currency | Customer currency), then Hide. The
   table has no sort or filter yet, so those are not offered. */
function SoMoneyHeader({ col, onHide }: { col: ColumnConfig; onHide?: () => void }) {
  const [open, setOpen] = useState(false);
  const view = useColumnView(col.key);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="inline-flex items-center cursor-pointer select-none hover:text-foreground transition-colors"
      >
        <span className="text-[13px] text-muted-foreground hover:text-foreground" style={{ fontWeight: 500 }}>
          {col.label}
        </span>
      </PopoverTrigger>
      <PopoverContent align={col.key === "orderValue" ? "end" : "start"} sideOffset={4} className="p-0 rounded-lg shadow-lg border border-border/80 z-[200] w-[200px]">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{col.label}</span>
          </div>
        </div>
        <div className="border-t border-border/60" />
        <div className="py-1 px-1">
          {view && (
            <ShowValuesAs
              view={view[0]}
              onChange={(v) => { view[1](v); setOpen(false); }}
              rowLabel="Customer currency"
              divider={false}
            />
          )}
          {onHide && (
            <>
              {view && <div className="border-t border-border/60 my-1" />}
              <button
                type="button"
                onClick={() => { onHide(); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/60"
              >
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Hide</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Column config + widths ─── */
const SALES_ORDER_COLUMNS: ColumnConfig[] = [
  { key: "salesOrderNumber", label: "Sales Order #" },
  { key: "quoteNumber",      label: "Quote #" },
  { key: "customerName",     label: "Customer Name" },
  /* The order's currency (the customer's), as the Currency Library draws it. */
  { key: "currency",         label: "Currency" },
  { key: "status",           label: "Order Status" },
  { key: "poc",              label: "POC" },
  { key: "salesRep",         label: "Sales Rep" },
  { key: "orderValue",       label: "Order Value" },
  { key: "invoicedAmount",   label: "Invoiced Amount" },
  { key: "paymentsMade",     label: "Payments Made" },
  { key: "requestedOn",      label: "Requested On" },
  { key: "shipBy",           label: "Ship By" },
  { key: "deliveryDate",     label: "Delivery Date" },
  { key: "confirmationDate", label: "Confirmation Date" },
  { key: "lineItems",        label: "Line Items" },
  { key: "priority",         label: "Priority" },
  { key: "tags",             label: "Tags" },
  { key: "createdOn",        label: "Created On" },
  { key: "createdBy",        label: "Created By" },
  { key: "lastUpdatedOn",    label: "Last Updated On" },
  { key: "lastUpdatedBy",    label: "Last Updated By" },
];

const SO_COLUMN_WIDTHS: Record<string, number> = {
  salesOrderNumber: 140,
  quoteNumber:      130,
  customerName:     220,
  status:           150,
  poc:              140,
  salesRep:         180,
  // Amounts in base (₨) to the cent.
  orderValue:       200,
  // Fits "United Arab Emirates Dirham" after the code.
  currency:         264,
  invoicedAmount:   160,
  paymentsMade:     160,
  requestedOn:      120,
  shipBy:           140,
  deliveryDate:     120,
  confirmationDate: 150,
  lineItems:        260,
  priority:         110,
  tags:             200,
  createdOn:        120,
  createdBy:        180,
  lastUpdatedOn:    130,
  lastUpdatedBy:    180,
};

const SO_LOCKED_COLUMNS = ["salesOrderNumber"];

const SO_QUICK_FILTERS = ["All", "Pending Approval", "Active", "Overdue", "Completed", "Cancelled"] as const;
type SoQuickFilter = (typeof SO_QUICK_FILTERS)[number];

type SoDensity = "condensed" | "comfort";
const SO_DENSITY_CONFIG: { key: SoDensity; label: string; description: string; icon: "align-justify" | "list" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view",  icon: "align-justify" },
  { key: "comfort",   label: "Comfort",   description: "Spacious view", icon: "list" },
];

function soMatchesQuickFilter(row: SalesOrder, qf: SoQuickFilter): boolean {
  if (qf === "All") return true;
  return row.status === qf;
}

function soMatchesSearch(row: SalesOrder, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return Object.values(row).some((v) => String(v).toLowerCase().includes(needle));
}

export function SalesOverviewTable() {
  const [soSearch, setSoSearch] = useState("");
  const [soQuickFilter, setSoQuickFilter] = useState<SoQuickFilter>("All");
  const [soColumnOrder, setSoColumnOrder] = useState<string[]>(SALES_ORDER_COLUMNS.map((c) => c.key));
  const [soColumnVisibility, setSoColumnVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(SALES_ORDER_COLUMNS.map((c) => [c.key, true]))
  );
  const [soColumnsOpen, setSoColumnsOpen] = useState(false);
  const [soDensity, setSoDensity] = useState<SoDensity>("condensed");
  const [soPage, setSoPage] = useState(1);
  const [soPageSize, setSoPageSize] = useState(20);

  /* Orders are in their customers' currencies, so the table has no one
     currency to flip to: each money column's header menu shows its orders in
     base (the default) or each in its own currency (RowCurrencyView). */

  const soFilteredRows = useMemo(
    () => SALES_ORDERS.filter((r) => soMatchesQuickFilter(r, soQuickFilter) && soMatchesSearch(r, soSearch)),
    [soSearch, soQuickFilter]
  );

  const totalRows = SALES_ORDERS.length;
  const filteredCount = soFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / soPageSize));
  const currentPage = Math.min(soPage, totalPages);
  const startIdx = (currentPage - 1) * soPageSize;
  const pagedRows = soFilteredRows.slice(startIdx, startIdx + soPageSize);

  const visibleColumns = soColumnOrder
    .map((k) => SALES_ORDER_COLUMNS.find((c) => c.key === k))
    .filter((c): c is ColumnConfig => !!c && soColumnVisibility[c.key] !== false);
  const visibleCount = visibleColumns.length;

  const isRelaxed = soDensity === "comfort";
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

  const renderCell = (col: ColumnConfig, row: SalesOrder) => {
    switch (col.key) {
      case "salesOrderNumber":
        return (
          <span className={`${cellTextSize} text-foreground hover:text-primary hover:underline cursor-pointer`} style={{ fontWeight: 500 }}>
            {row.salesOrderNumber}
          </span>
        );
      case "quoteNumber":
        return <span className={`${cellTextSize} text-foreground`}>{row.quoteNumber}</span>;
      case "customerName":
        return (
          <div className="flex items-center gap-2.5 group/name cursor-pointer">
            <InitialAvatar name={row.customerName} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate text-foreground group-hover/name:text-primary group-hover/name:underline transition-colors" style={{ fontWeight: 500 }}>{row.customerName}</span>
          </div>
        );
      case "poc": {
        const extras = row.additionalPocs ?? [];
        const overflowItems: OverflowItem[] = extras.map((p, i) => {
          const initials = p.name
            .split(" ")
            .map((s) => s[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return {
            id: `${row.id}-poc-${i}`,
            name: p.name,
            subtitle: p.role || "CONTACT",
            initials,
          };
        });
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 group/poc cursor-pointer min-w-0">
              <InitialAvatar name={row.poc} size={isRelaxed ? "md" : "sm"} />
              <span className={`${cellTextSize} text-foreground truncate group-hover/poc:text-primary group-hover/poc:underline transition-colors`}>{row.poc}</span>
            </div>
            {overflowItems.length > 0 && (
              <OverflowTooltip category="Point of Contacts" items={overflowItems}>
                <span
                  className="text-[11px] inline-flex shrink-0 cursor-default whitespace-nowrap leading-none"
                  style={{ fontWeight: 600, color: "#085FCC" }}
                >
                  +{overflowItems.length} more
                </span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "salesRep":
        return (
          <div className="flex items-center gap-2 group/rep cursor-pointer">
            <InitialAvatar name={row.salesRep} size={isRelaxed ? "md" : "sm"} />
            <span className={`${cellTextSize} text-foreground truncate group-hover/rep:text-primary group-hover/rep:underline transition-colors`}>{row.salesRep}</span>
          </div>
        );
      case "orderValue":
        /* In the column's view (base by default); the order's own currency is in the Currency column. */
        return (
          <span className="inline-flex items-center gap-1.5 max-w-full">
            <OrderAmount row={row} value={row.orderValue} className={`${cellTextSize} font-medium text-foreground`} />
          </span>
        );
      case "currency":
        return (
          <span className={`inline-flex whitespace-nowrap max-w-full ${cellTextSize}`}>
            <CurrencyCodeCell code={row.currency} title="The order's currency" />
          </span>
        );
      case "shipBy":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.shipBy}</span>;
      case "deliveryDate":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.deliveryDate}</span>;
      case "createdOn":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.createdOn}</span>;
      case "createdBy":
        return (
          <div className="flex items-center gap-2.5 group/cb cursor-pointer">
            <InitialAvatar name={row.createdBy} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate text-foreground group-hover/cb:text-primary group-hover/cb:underline transition-colors" style={{ fontWeight: 500 }}>{row.createdBy}</span>
          </div>
        );
      case "status":
        return <SOStatusPill status={row.status} />;
      case "invoicedAmount": {
        const hasVal = row.invoicedAmount != null;
        return (
          <span
            className={`${cellTextSize} tabular-nums whitespace-nowrap`}
            style={{ fontWeight: 500, color: hasVal ? "#0F172A" : "#94A3B8" }}
          >
            {hasVal ? <OrderAmount row={row} value={row.invoicedAmount} /> : "—"}
          </span>
        );
      }
      case "paymentsMade": {
        const hasVal = row.paymentsMade != null;
        return (
          <span
            className={`${cellTextSize} tabular-nums whitespace-nowrap`}
            style={{ fontWeight: 500, color: hasVal ? "#0F172A" : "#94A3B8" }}
          >
            {hasVal ? <OrderAmount row={row} value={row.paymentsMade} /> : "—"}
          </span>
        );
      }
      case "requestedOn":
        return <span className={`${cellTextSize} text-muted-foreground tabular-nums`}>{row.requestedOn || "—"}</span>;
      case "confirmationDate":
        return row.confirmationDate
          ? <span className={`${cellTextSize} text-muted-foreground tabular-nums`}>{row.confirmationDate}</span>
          : <span className={`${cellTextSize}`} style={{ color: "#CBD5E1" }}>—</span>;
      case "lineItems": {
        /* Verbatim port of Sales-Order-V5 SOList.tsx:1344-1471 linecount
         * renderer. Partner v7-style preview: hashed tint thumbnail with
         * HoverCard (dark gradient header + item details), primary item
         * code, "N items" count, and OverflowTooltip for extras. */
        const isCondensed = !isRelaxed;
        const lineItems = row.lineItems;
        const first = lineItems[0];
        const extraLineItems = lineItems.length - 1;
        const previewTokens = (() => {
          const code = first?.itemCode || "";
          let h = 0;
          for (let c = 0; c < code.length; c++) h = code.charCodeAt(c) + ((h << 5) - h);
          const ah = Math.abs(h);
          const TINTS = ["#FDE8E8", "#FEF3C7", "#DBEAFE", "#E0E7FF", "#D1FAE5", "#FCE7F3", "#F1F5F9"];
          const CATS = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
          const STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];
          const STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
            "In Stock":     { bg: "#F0FDF4", fg: "#166534" },
            "Low Stock":    { bg: "#FFFBEB", fg: "#92400E" },
            "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B" },
            "On Order":     { bg: "#EFF6FF", fg: "#1E40AF" },
          };
          const status = STATUSES[ah % STATUSES.length];
          return {
            tint:         TINTS[ah % TINTS.length],
            category:     CATS[ah % CATS.length],
            status,
            statusTokens: STATUS_TOKENS[status],
            onHand:       100 + ((ah * 13) % 15000),
            unitPrice:    10 + ((ah * 7) % 500),
          };
        })();
        const thumbSize = isCondensed ? 28 : 40;
        return (
          <div className={`flex items-center whitespace-nowrap ${isCondensed ? "gap-1.5" : "gap-2.5"}`}>
            <HoverCard openDelay={140} closeDelay={80}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Preview ${first?.itemCode || "item"}`}
                  style={{
                    width: thumbSize, height: thumbSize, flexShrink: 0,
                    borderRadius: 6, backgroundColor: previewTokens.tint,
                    border: "1px solid #E8ECF1", padding: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Package style={{ width: isCondensed ? 14 : 18, height: isCondensed ? 14 : 18, color: "#64748B", opacity: 0.65 }} />
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom" align="start" sideOffset={8}
                className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div
                  className="px-3.5 py-3 relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)" }}
                >
                  <div className="flex items-center gap-3 relative">
                    <div
                      className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: previewTokens.tint }}
                    >
                      <Package className="w-4 h-4" style={{ color: "#475569" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{first?.itemCode || "–"}</p>
                      <p className="text-[11px] truncate" style={{ color: "rgba(148,163,184,0.9)" }}>{first?.itemName || ""}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{previewTokens.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>On-Hand: <b>{previewTokens.onHand.toLocaleString()}</b></span>
                    </div>
                    {/* An item price, in the base currency like every item price. */}
                    <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                      {baseMoney(previewTokens.unitPrice)}
                      <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px]"
                    style={{ fontWeight: 600, backgroundColor: previewTokens.statusTokens.bg, color: previewTokens.statusTokens.fg }}
                  >
                    {previewTokens.status}
                  </span>
                </div>
              </HoverCardContent>
            </HoverCard>
            <span className={`${isCondensed ? "text-sm" : "text-[13.5px]"} truncate`} style={{ fontWeight: 500 }}>
              {first?.itemCode || "–"}
            </span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
            </span>
            {extraLineItems > 0 && (
              <OverflowTooltip
                category="Line Items"
                items={lineItems.slice(1).map((li, i) => ({
                  id: `${row.id}-line-${i}`,
                  name: li.itemCode,
                  subtitle: li.itemName,
                  icon: <Package className="w-3.5 h-3.5" />,
                }))}
              >
                <span
                  className="text-[11px] shrink-0 cursor-default leading-none"
                  style={{ fontWeight: 600, color: "#085FCC" }}
                >
                  +{extraLineItems} more
                </span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "priority":
        return <PriorityPill priority={row.priority} />;
      case "tags": {
        /* Tag chip chrome ported verbatim from Sales-Order-V5
         * DealInformationTab.tsx:473-485 — bg-secondary + text-foreground/80,
         * 26px tall, 0/10 padding, 5px radius, T.caption (12px / weight 500),
         * no border. "+N" overflow uses the same chrome with muted text. */
        if (!row.tags.length) {
          return <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 400 }}>No tags</span>;
        }
        const visibleTags = row.tags.slice(0, 2);
        const overflow = row.tags.length - visibleTags.length;
        return (
          <div className="flex items-center min-w-0" style={{ gap: 6 }}>
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center bg-secondary text-foreground/80 whitespace-nowrap shrink-0"
                style={{ gap: 4, height: 26, padding: "0 10px", borderRadius: 5, fontSize: 12, fontWeight: 500 }}
              >
                {tag}
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="inline-flex items-center bg-secondary text-muted-foreground whitespace-nowrap shrink-0"
                style={{ gap: 4, height: 26, padding: "0 10px", borderRadius: 5, fontSize: 12, fontWeight: 500 }}
              >
                +{overflow}
              </span>
            )}
          </div>
        );
      }
      case "lastUpdatedOn":
        return <span className={`${cellTextSize} text-muted-foreground tabular-nums`}>{row.lastUpdatedOn}</span>;
      case "lastUpdatedBy":
        return (
          <div className="flex items-center gap-2.5 group/lu cursor-pointer">
            <InitialAvatar name={row.lastUpdatedBy} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate text-foreground group-hover/lu:text-primary group-hover/lu:underline transition-colors" style={{ fontWeight: 500 }}>{row.lastUpdatedBy}</span>
          </div>
        );
      default:
        return <span className={`${cellTextSize} text-muted-foreground`}>{(row as any)[col.key] ?? "-"}</span>;
    }
  };

  return (
    <RowViewTable tableKey="sales-orders">
    <div className="flex flex-1 min-w-0 flex-col">
      {/* Toolbar Row 1: Search + Filters | count + Density + Columns */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search sales orders..."
              value={soSearch}
              onChange={(e) => { setSoSearch(e.target.value); setSoPage(1); }}
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
                <span className="text-muted-foreground/70"> orders</span>
              </>
            ) : (
              <>
                <span className="text-foreground">{totalRows}</span>
                <span className="text-muted-foreground/70"> orders</span>
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
                {soDensity === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                {soDensity === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                  {SO_DENSITY_CONFIG.find((d) => d.key === soDensity)?.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[230px] p-1.5">
              {SO_DENSITY_CONFIG.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                  onSelect={() => setSoDensity(opt.key)}
                >
                  {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                  {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                  {soDensity === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ColumnSelectorTrigger
            visibleCount={visibleCount}
            active={soColumnsOpen}
            onClick={() => setSoColumnsOpen(!soColumnsOpen)}
          />
        </div>
      </div>

      {/* Toolbar Row 2: Quick filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
        {SO_QUICK_FILTERS.map((qf) => {
          const isActive = soQuickFilter === qf;
          const count =
            qf === "All"
              ? SALES_ORDERS.length
              : SALES_ORDERS.filter((o) => o.status === qf).length;
          const showCount = qf !== "All";
          return (
            <button
              key={qf}
              onClick={() => { setSoQuickFilter(qf); setSoPage(1); }}
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
              {qf}
              {showCount && (
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
                const isOrderValue = col.key === "orderValue";
                const width = SO_COLUMN_WIDTHS[col.key] ?? 160;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap",
                      isOrderValue && "text-right"
                    )}
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      overflow: "hidden",
                    }}
                  >
                    {SO_MONEY_COLUMNS.has(col.key) ? (
                      <SoMoneyHeader
                        col={col}
                        onHide={SO_LOCKED_COLUMNS.includes(col.key) ? undefined : () => setSoColumnVisibility((prev) => ({ ...prev, [col.key]: false }))}
                      />
                    ) : (
                      <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>
                        {col.label}
                      </span>
                    )}
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
                  const isOrderValue = col.key === "orderValue";
                  const width = SO_COLUMN_WIDTHS[col.key] ?? 160;
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        cellPadY,
                        isOrderValue && "text-right"
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
                      {SO_MONEY_COLUMNS.has(col.key) ? <ColumnView column={col.key}>{renderCell(col, row)}</ColumnView> : renderCell(col, row)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {pagedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-12 text-sm text-muted-foreground">
                  No sales orders match the current filters.
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
            <Select value={String(soPageSize)} onValueChange={(val) => { setSoPageSize(Number(val)); setSoPage(1); }}>
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
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setSoPage(1)}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setSoPage((p) => Math.max(1, p - 1))}>
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
                  onClick={() => setSoPage(pg as number)}
                >
                  {pg}
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setSoPage((p) => Math.min(totalPages, p + 1))}>
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setSoPage(totalPages)}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Column Selector Side Drawer */}
      <ColumnSelector
        columns={SALES_ORDER_COLUMNS}
        columnOrder={soColumnOrder}
        columnVisibility={soColumnVisibility}
        onColumnOrderChange={setSoColumnOrder}
        onColumnVisibilityChange={setSoColumnVisibility}
        lockedColumns={SO_LOCKED_COLUMNS}
        open={soColumnsOpen}
        onOpenChange={setSoColumnsOpen}
      />
    </div>
    </RowViewTable>
  );
}