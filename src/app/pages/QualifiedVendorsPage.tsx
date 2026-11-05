import { useCallback, useMemo, useState } from "react";
import { Search, Plus, ShieldCheck, Clock, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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

interface QualifiedVendorRow {
  id: number;
  name: string;
  category: string;
  rating: string;
  leadTime: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  qualified: string;
  expiry: string;
  status: "Qualified" | "Expiring Soon" | "Expired";
}

const VENDOR_ROWS: QualifiedVendorRow[] = [
  { id: 1, name: "Acme Corporation", category: "Raw Materials", rating: "A+", leadTime: "3-5 days", priority: "Critical", qualified: "2024-01-15", expiry: "2026-01-15", status: "Qualified" },
  { id: 2, name: "Global Industries", category: "Components", rating: "A", leadTime: "5-7 days", priority: "High", qualified: "2023-11-20", expiry: "2025-11-20", status: "Qualified" },
  { id: 3, name: "TechSupply Co", category: "Electronics", rating: "A", leadTime: "2-4 days", priority: "Critical", qualified: "2024-03-10", expiry: "2026-03-10", status: "Qualified" },
  { id: 4, name: "SteelWorks Ltd", category: "Raw Materials", rating: "B+", leadTime: "7-10 days", priority: "Medium", qualified: "2024-06-01", expiry: "2026-06-01", status: "Qualified" },
  { id: 5, name: "NexGen Materials", category: "Specialty", rating: "A-", leadTime: "5-8 days", priority: "High", qualified: "2023-09-15", expiry: "2025-09-15", status: "Expiring Soon" },
  { id: 6, name: "QuickShip Inc", category: "Packaging", rating: "B", leadTime: "1-3 days", priority: "Low", qualified: "2023-05-01", expiry: "2025-05-01", status: "Expired" },
];

/* ─── Column defs — `filterType` per the Column Filters spec's data-type
 * rule. Lead Time is ad-hoc text ("3-5 days") → free-text fallback. ─── */
const COLUMN_DEFS: { key: string; label: string; width: number; sortable: boolean; filterType: FilterType }[] = [
  { key: "vendor", label: "Vendor", width: 240, sortable: true, filterType: "text" },
  { key: "category", label: "Category", width: 180, sortable: true, filterType: "multiselect" },
  { key: "lead_time", label: "Lead Time", width: 150, sortable: true, filterType: "text" },
  { key: "priority", label: "Priority", width: 130, sortable: true, filterType: "multiselect" },
  { key: "expiry", label: "Expiry", width: 150, sortable: true, filterType: "date" },
  { key: "status", label: "Status", width: 160, sortable: true, filterType: "multiselect" },
];
const LOCKED_COLUMN = "vendor";
const filterTypeFor = (key: string): FilterType =>
  COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

const qualifiedVendorCellValue: CellAccessor<QualifiedVendorRow> = (r, columnKey) => {
  switch (columnKey) {
    case "vendor": return r.name;
    case "category": return r.category;
    case "lead_time": return r.leadTime;
    case "priority": return r.priority;
    case "expiry": return r.expiry;
    case "status": return r.status;
    default: return undefined;
  }
};

export function QualifiedVendorsPage() {
  const statusColors: Record<string, { bg: string; text: string }> = {
    Qualified: { bg: "#F0FDF4", text: "#16A34A" },
    "Expiring Soon": { bg: "#FFF7ED", text: "#EA580C" },
    Expired: { bg: "#FEF2F2", text: "rgb(var(--destructive))" },
  };

  const priorityColors: Record<string, { bg: string; text: string }> = {
    Critical: { bg: "#FEF2F2", text: "rgb(var(--destructive))" },
    High: { bg: "#FFF7ED", text: "#EA580C" },
    Medium: { bg: "rgb(var(--accent))", text: "rgb(var(--primary))" },
    Low: { bg: "rgb(var(--muted))", text: "#64748B" },
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
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, VENDOR_ROWS, qualifiedVendorCellValue);
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
    let result = VENDOR_ROWS;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }
    result = applyFilters(result, columnFiltersList, qualifiedVendorCellValue);
    return sortRows(result, sortConfig, qualifiedVendorCellValue, filterTypeFor);
  }, [searchQuery, columnFiltersList, sortConfig]);

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : VENDOR_ROWS.length,
    filteredCount: tableLoad.forceEmpty ? 0 : rows.length,
    searchQuery,
    filterCount: columnFiltersList.length,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(searchQuery, VENDOR_ROWS.flatMap((r) => [r.name, r.category]));
  }, [emptyKind, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div data-page-topbar className="px-6 py-4 border-b border-border bg-card">
        <div data-page-heading className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
              Qualified Vendors
            </h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
              Manage approved vendor relationships with lead times and priorities.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] transition-colors hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--primary))", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Qualify Vendor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search qualified vendors..."
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
                  entity={{ singular: "qualified vendor", plural: "qualified vendors" }}
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
              {!emptyKind && tableLoad.loadState !== "loading" && rows.map((vendor) => {
                const sColors = statusColors[vendor.status] || statusColors.Qualified;
                const pColors = priorityColors[vendor.priority] || priorityColors.Medium;
                const cell = (key: string) => {
                  switch (key) {
                    case "vendor":
                      return (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgb(var(--accent))" }}>
                            <ShieldCheck className="w-4 h-4" style={{ color: "rgb(var(--primary))" }} />
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{vendor.name}</span>
                        </div>
                      );
                    case "category":
                      return <span style={{ fontSize: "13px", color: "#334155" }}>{vendor.category}</span>;
                    case "lead_time":
                      return (
                        <div className="flex items-center gap-1.5" style={{ fontSize: "13px", color: "#334155" }}>
                          <Clock className="w-3.5 h-3.5" />
                          {vendor.leadTime}
                        </div>
                      );
                    case "priority":
                      return (
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{ fontSize: "11px", fontWeight: 500, backgroundColor: pColors.bg, color: pColors.text }}
                        >
                          {vendor.priority}
                        </span>
                      );
                    case "expiry":
                      return <span style={{ fontSize: "13px", color: "rgb(var(--muted-foreground))" }}>{vendor.expiry}</span>;
                    case "status":
                      return (
                        <div className="flex items-center gap-1.5">
                          {vendor.status === "Expiring Soon" && <AlertCircle className="w-3.5 h-3.5" style={{ color: "#EA580C" }} />}
                          {vendor.status === "Expired" && <AlertCircle className="w-3.5 h-3.5" style={{ color: "rgb(var(--destructive))" }} />}
                          <span
                            className="px-2.5 py-1 rounded-full"
                            style={{ fontSize: "11px", fontWeight: 500, backgroundColor: sColors.bg, color: sColors.text }}
                          >
                            {vendor.status}
                          </span>
                        </div>
                      );
                    default:
                      return null;
                  }
                };
                return (
                  <tr key={vendor.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
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
