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
  Eye,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  InitialAvatar,
} from "../../items-v3";
import type { ColumnConfig } from "../../items-v3";

/* ─── Data shape ─── */
interface SalesOrder {
  id: string;
  salesOrderNumber: string;
  quoteNumber: string;
  customerName: string;
  poc: string;
  pocOverflow?: string; // e.g. "+1"
  salesRep: string;
  orderValue: string;
  orderDate: string;
  shipBy: string;
  deliveryDate: string;
  createdOn: string;
  createdBy: string;
  isLate?: boolean;
  status: SalesOrderStatus;
}

type SalesOrderStatus =
  | "Pending Approval"
  | "Active"
  | "Overdue"
  | "Completed"
  | "Cancelled";

/* Mock data — preserved from legacy SalesOverview.tsx (lines 128-204), with status added. */
const SALES_ORDERS: SalesOrder[] = [
  { id: "1", salesOrderNumber: "SO-2026-001", quoteNumber: "QT-2026-1001", customerName: "Precision Parts Ltd.", poc: "Kevin", pocOverflow: "+1", salesRep: "James Rodriquez", orderValue: "$20,850", orderDate: "2025-12-17", shipBy: "2025-12-29", deliveryDate: "2026-01-03", createdOn: "2025-12-17", createdBy: "Sarah Wilson", status: "Active" },
  { id: "2", salesOrderNumber: "SO-2026-002", quoteNumber: "QT-2026-1002", customerName: "MegaCorp Inc.",        poc: "Jim",   salesRep: "David Park",      orderValue: "$11,225", orderDate: "2025-12-16", shipBy: "2026-02-20", deliveryDate: "2026-02-25", createdOn: "2025-12-16", createdBy: "Emily Chen", status: "Pending Approval" },
  { id: "3", salesOrderNumber: "SO-2026-003", quoteNumber: "QT-2026-1003", customerName: "BuildIt Construction",  poc: "Robert",pocOverflow: "+1", salesRep: "Emily Chen",      orderValue: "$557,555", orderDate: "2025-11-08", shipBy: "2025-11-19", deliveryDate: "2025-11-24", createdOn: "2025-11-08", createdBy: "Admin User", status: "Completed" },
  { id: "4", salesOrderNumber: "SO-2026-004", quoteNumber: "QT-2026-1004", customerName: "Acme Corporation",      poc: "Andy",  salesRep: "James Rodriquez", orderValue: "$167,875", orderDate: "2025-10-15", shipBy: "2026-01-18", deliveryDate: "2026-01-23", createdOn: "2025-10-15", createdBy: "System Import", status: "Overdue", isLate: true },
];

/* ─── Column config + widths ─── */
const SALES_ORDER_COLUMNS: ColumnConfig[] = [
  { key: "quickView",        label: "Quick View" },
  { key: "salesOrderNumber", label: "Sales Order #" },
  { key: "quoteNumber",      label: "Quote #" },
  { key: "customerName",     label: "Customer Name" },
  { key: "poc",              label: "POC" },
  { key: "salesRep",         label: "Sales Rep" },
  { key: "orderValue",       label: "Order Value" },
  { key: "orderDate",        label: "Order Date" },
  { key: "shipBy",           label: "Ship By" },
  { key: "deliveryDate",     label: "Delivery Date" },
  { key: "createdOn",        label: "Created On" },
  { key: "createdBy",        label: "Created By" },
];

const SO_COLUMN_WIDTHS: Record<string, number> = {
  quickView:        60,
  salesOrderNumber: 140,
  quoteNumber:      130,
  customerName:     220,
  poc:              140,
  salesRep:         180,
  orderValue:       110,
  orderDate:        120,
  shipBy:           140,
  deliveryDate:     120,
  createdOn:        120,
  createdBy:        180,
};

const SO_LOCKED_COLUMNS = ["quickView", "salesOrderNumber"];

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

/* "System Import" / "Admin User" rendered as plain text with a small neutral
 * glyph — only humans get the InitialAvatar treatment. */
function isSystemUser(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("system") || n === "admin user";
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
      case "quickView":
        return (
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Eye size={16} />
          </button>
        );
      case "salesOrderNumber":
        return (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
            <span className={`${cellTextSize} text-primary`} style={{ fontWeight: 500 }}>{row.salesOrderNumber}</span>
          </div>
        );
      case "quoteNumber":
        return <span className={`${cellTextSize} text-foreground`}>{row.quoteNumber}</span>;
      case "customerName":
        return (
          <div className="flex items-center gap-2.5">
            <InitialAvatar name={row.customerName} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{row.customerName}</span>
          </div>
        );
      case "poc":
        return (
          <div className="flex items-center gap-2">
            <InitialAvatar name={row.poc} size={isRelaxed ? "md" : "sm"} />
            <span className={`${cellTextSize} text-foreground`}>{row.poc}</span>
            {row.pocOverflow && (
              <span className="text-[10px] text-muted-foreground">{row.pocOverflow}</span>
            )}
          </div>
        );
      case "salesRep":
        return (
          <div className="flex items-center gap-2">
            <InitialAvatar name={row.salesRep} size={isRelaxed ? "md" : "sm"} />
            <span className={`${cellTextSize} text-foreground truncate`}>{row.salesRep}</span>
          </div>
        );
      case "orderValue":
        return (
          <span className={`${cellTextSize} font-medium text-foreground tabular-nums`}>
            {row.orderValue}
          </span>
        );
      case "orderDate":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.orderDate}</span>;
      case "shipBy":
        return (
          <div className="flex items-center gap-2">
            <span className={`${cellTextSize} text-muted-foreground`}>{row.shipBy}</span>
            {row.isLate && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">4d late</Badge>
            )}
          </div>
        );
      case "deliveryDate":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.deliveryDate}</span>;
      case "createdOn":
        return <span className={`${cellTextSize} text-muted-foreground`}>{row.createdOn}</span>;
      case "createdBy":
        if (isSystemUser(row.createdBy)) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1] bg-muted/50 text-muted-foreground" style={{ fontSize: 11, fontWeight: 700 }}>
                SYS
              </div>
              <span className={`${cellTextSize} text-muted-foreground italic`}>{row.createdBy}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2.5">
            <InitialAvatar name={row.createdBy} size={isRelaxed ? "md" : "sm"} />
            <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{row.createdBy}</span>
          </div>
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
                const isQuickView = col.key === "quickView";
                const width = SO_COLUMN_WIDTHS[col.key] ?? 160;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap",
                      isOrderValue && "text-right",
                      isQuickView && "text-center"
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
                  const isOrderValue = col.key === "orderValue";
                  const isQuickView = col.key === "quickView";
                  const width = SO_COLUMN_WIDTHS[col.key] ?? 160;
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        cellPadY,
                        isOrderValue && "text-right",
                        isQuickView && "text-center"
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
  );
}