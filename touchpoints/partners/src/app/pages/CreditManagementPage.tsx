import { useCallback, useMemo, useState } from "react";
import { Search, CreditCard, TrendingUp, TrendingDown, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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
import { TableEmptyRow, TableSkeletonRows, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";

/* ─── Row data — numeric fields stay numbers so range filters and
 * sorting operate on real values; cells format at render. ─── */
interface CreditRow {
  id: number;
  name: string;
  creditLimit: number;
  utilized: number;
  available: number;
  utilization: number;
  status: "Good" | "Warning" | "Critical";
}

const CREDIT_ROWS: CreditRow[] = [
  { id: 1, name: "Acme Corporation", creditLimit: 500000, utilized: 342000, available: 158000, utilization: 68, status: "Good" },
  { id: 2, name: "Global Industries", creditLimit: 350000, utilized: 310000, available: 40000, utilization: 89, status: "Warning" },
  { id: 3, name: "TechSupply Co", creditLimit: 200000, utilized: 85000, available: 115000, utilization: 43, status: "Good" },
  { id: 4, name: "Premium Logistics", creditLimit: 150000, utilized: 148500, available: 1500, utilization: 99, status: "Critical" },
  { id: 5, name: "SteelWorks Ltd", creditLimit: 400000, utilized: 220000, available: 180000, utilization: 55, status: "Good" },
  { id: 6, name: "NexGen Materials", creditLimit: 250000, utilized: 188000, available: 62000, utilization: 75, status: "Warning" },
];

/* ─── Column defs — `filterType` follows the Column Filters spec's
 * data-type rule (money/percent → range, fixed pick-list → multiselect,
 * open text → text search). ─── */
const COLUMN_DEFS: { key: string; label: string; width: number; sortable: boolean; filterType: FilterType }[] = [
  { key: "partner", label: "Partner", width: 240, sortable: true, filterType: "text" },
  { key: "credit_limit", label: "Credit Limit", width: 160, sortable: true, filterType: "range" },
  { key: "utilized", label: "Utilized", width: 160, sortable: true, filterType: "range" },
  { key: "available", label: "Available", width: 160, sortable: true, filterType: "range" },
  { key: "utilization", label: "Utilization", width: 180, sortable: true, filterType: "range" },
  { key: "status", label: "Status", width: 130, sortable: true, filterType: "multiselect" },
];
const LOCKED_COLUMN = "partner";
const filterTypeFor = (key: string): FilterType =>
  COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

const creditCellValue: CellAccessor<CreditRow> = (r, columnKey) => {
  switch (columnKey) {
    case "partner": return r.name;
    case "credit_limit": return r.creditLimit;
    case "utilized": return r.utilized;
    case "available": return r.available;
    case "utilization": return r.utilization;
    case "status": return r.status;
    default: return undefined;
  }
};

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;

export function CreditManagementPage() {
  const summaryCards = [
    { label: "Total Credit Extended", value: "$2,450,000", change: "+12.5%", up: true, icon: CreditCard, color: "rgb(var(--primary))" },
    { label: "Credit Utilization", value: "68.3%", change: "+3.2%", up: true, icon: TrendingUp, color: "#EA580C" },
    { label: "Outstanding Balance", value: "$1,673,500", change: "-5.1%", up: false, icon: TrendingDown, color: "#16A34A" },
    { label: "Overdue Accounts", value: "4", change: "+2", up: true, icon: AlertTriangle, color: "rgb(var(--destructive))" },
  ];

  const statusColors: Record<string, { bg: string; text: string }> = {
    Good: { bg: "#F0FDF4", text: "#16A34A" },
    Warning: { bg: "#FFF7ED", text: "#EA580C" },
    Critical: { bg: "#FEF2F2", text: "rgb(var(--destructive))" },
  };

  /* ─── Search + column header state (sort / filter / hide / freeze) ─── */
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set([LOCKED_COLUMN]));

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c.label])), []);
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, CREDIT_ROWS, creditCellValue);
    });
    return map;
  }, []);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, filterTypeFor(columnKey)) });
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, filterTypeFor(columnKey)) });
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
    setHiddenColumns((prev) => new Set(prev).add(columnKey));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== LOCKED_COLUMN) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => COLUMN_DEFS.filter((c) => !hiddenColumns.has(c.key)), [hiddenColumns]);

  /* Frozen columns stack from the left in visible order — same offset
   * math as the Partners listing reference. */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = 0;
    visibleColumns.forEach((c) => {
      if (frozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    });
    return offsets;
  }, [visibleColumns, frozenColumns]);
  const lastFrozenKey = useMemo(() => {
    const frozen = visibleColumns.filter((c) => frozenColumns.has(c.key));
    return frozen.length ? frozen[frozen.length - 1].key : null;
  }, [visibleColumns, frozenColumns]);

  const rows = useMemo(() => {
    let result = CREDIT_ROWS;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    result = applyFilters(result, columnFiltersList, creditCellValue);
    return sortRows(result, sortConfig, creditCellValue, filterTypeFor);
  }, [searchQuery, columnFiltersList, sortConfig]);

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : CREDIT_ROWS.length,
    filteredCount: tableLoad.forceEmpty ? 0 : rows.length,
    searchQuery,
    filterCount: columnFiltersList.length,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(searchQuery, CREDIT_ROWS.map((r) => r.name));
  }, [emptyKind, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div data-page-topbar className="px-5 py-3.5 border-b border-border bg-card">
        <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
          Credit Management
        </h1>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
          Monitor credit limits, utilization, and outstanding balances.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}14` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <span
                    className="text-[12px]"
                    style={{ fontWeight: 500, color: card.up ? (card.color === "#16A34A" ? "#16A34A" : "#EA580C") : "#16A34A" }}
                  >
                    {card.change}
                  </span>
                </div>
                <p className="text-muted-foreground mb-1" style={{ fontSize: "12px" }}>{card.label}</p>
                <p className="text-foreground" style={{ fontSize: "22px", fontWeight: 600 }}>{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partners..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Active column filter chips — shared Notion-style bar */}
          {columnFiltersList.length > 0 && (
            <div className="pt-2.5">
              <ActiveFiltersBar
                columnFilters={columnFiltersList}
                columnLabels={columnLabels}
                uniqueValuesByKey={uniqueValuesMap}
                lockedColumnKey={LOCKED_COLUMN}
                onFilterChange={handleColumnFilterChange}
                onRemoveFilter={handleRemoveColumnFilter}
                onAddFilter={handleAddColumnFilterWithAutoOpen}
                onClearAll={handleClearAllColumnFilters}
                autoOpenKey={autoOpenFilterKey}
                onAutoOpened={() => setAutoOpenFilterKey(null)}
                availableColumns={COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
              />
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                {visibleColumns.map((def) => {
                  const isFrozen = frozenColumns.has(def.key);
                  const isLocked = def.key === LOCKED_COLUMN;
                  const currentColSort: "asc" | "desc" | null = sortConfig?.key === def.key ? sortConfig.direction : null;
                  const hasFilter = columnFilters[def.key] ? isFilterActive(columnFilters[def.key]) : false;
                  return (
                    <th
                      key={def.key}
                      className={`text-left px-5 py-3 text-muted-foreground whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""}`}
                      style={{
                        fontSize: "12px", fontWeight: 500,
                        minWidth: `${def.width}px`,
                        ...(isFrozen ? { left: `${frozenOffsets[def.key] ?? 0}px` } : {}),
                        ...(def.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                      }}
                    >
                      <div className="flex items-center">
                        <ColumnHeaderMenu
                          columnKey={def.key}
                          label={def.label}
                          sortable={def.sortable}
                          sortConfig={sortConfig}
                          onSort={handleSort}
                          onAddFilter={handleAddColumnFilter}
                          onHideColumn={handleHideColumn}
                          onFreezeColumn={handleFreezeColumn}
                          isFrozen={isFrozen}
                          isLocked={isLocked}
                          hasActiveFilter={hasFilter}
                          filter={columnFilters[def.key] ?? null}
                          uniqueValues={uniqueValuesMap[def.key]}
                          filterTypeOverride={def.filterType}
                          onFilterChange={handleColumnFilterChange}
                        >
                          <div className="inline-flex items-center gap-1">
                            <span style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                            {hasFilter && !currentColSort && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                            )}
                            {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                            {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                            {!currentColSort && !hasFilter && def.sortable && (
                              <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </ColumnHeaderMenu>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tableLoad.loadState === "loading" && <TableSkeletonRows columns={visibleColumns.length} />}
              {emptyKind && (
                <TableEmptyRow
                  colSpan={visibleColumns.length}
                  kind={emptyKind}
                  entity={{ singular: "credit account", plural: "credit accounts" }}
                  searchQuery={searchQuery}
                  suggestion={searchSuggestion}
                  onApplySuggestion={setSearchQuery}
                  filterCount={columnFiltersList.length}
                  onClearSearch={() => setSearchQuery("")}
                  onClearFilters={handleClearAllColumnFilters}
                  onClearAll={() => { setSearchQuery(""); handleClearAllColumnFilters(); }}
                  onRetry={tableLoad.retry}
                  retrying={tableLoad.retrying}
                />
              )}
              {!emptyKind && tableLoad.loadState !== "loading" && rows.map((partner) => {
                const colors = statusColors[partner.status] || statusColors.Good;
                const cell = (key: string) => {
                  switch (key) {
                    case "partner":
                      return <span style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{partner.name}</span>;
                    case "credit_limit":
                      return <span style={{ fontSize: "13px", color: "#334155" }}>{fmtMoney(partner.creditLimit)}</span>;
                    case "utilized":
                      return <span style={{ fontSize: "13px", color: "#334155" }}>{fmtMoney(partner.utilized)}</span>;
                    case "available":
                      return <span style={{ fontSize: "13px", color: "#334155" }}>{fmtMoney(partner.available)}</span>;
                    case "utilization":
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${partner.utilization}%`,
                                backgroundColor: partner.utilization > 90 ? "rgb(var(--destructive))" : partner.utilization > 75 ? "#EA580C" : "rgb(var(--primary))",
                              }}
                            />
                          </div>
                          <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{partner.utilization}%</span>
                        </div>
                      );
                    case "status":
                      return (
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{ fontSize: "11px", fontWeight: 500, backgroundColor: colors.bg, color: colors.text }}
                        >
                          {partner.status}
                        </span>
                      );
                    default:
                      return null;
                  }
                };
                return (
                  <tr key={partner.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                    {visibleColumns.map((def) => {
                      const isFrozen = frozenColumns.has(def.key);
                      return (
                        <td
                          key={def.key}
                          className={`px-5 py-3.5 whitespace-nowrap ${isFrozen ? "sticky bg-card z-10" : ""}`}
                          style={{
                            ...(isFrozen ? { left: `${frozenOffsets[def.key] ?? 0}px` } : {}),
                            ...(def.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                          }}
                        >
                          {cell(def.key)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
