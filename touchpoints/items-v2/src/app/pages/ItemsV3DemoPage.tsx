import { useState, useMemo } from "react";
import { useItems } from "../context/ItemsContext";
import {
  OverflowTooltip,
  ItemStatusBadge,
  ColumnSelector,
  ColumnSelectorTrigger,
  ColumnHeaderMenu,
  ColumnFilterChip,
  ActiveFiltersBar,
  applyColumnFilters,
  createBlankFilter,
  KpiInsightsPanel,
  DEFAULT_ACTIVE_KPIS,
  ALL_KPI_DEFINITIONS,
  FiltersModal,
  DEFAULT_FILTERS,
  countActiveFilters,
} from "../components/items-v3";
import type {
  ColumnFilterState,
  SortConfig,
  AdvancedFilters,
  ColumnConfig,
} from "../components/items-v3";

/* ─── 15 Item column keys (Slice 1b set) ─── */
const ITEM_COLUMNS: ColumnConfig[] = [
  { key: "part_number", label: "Part Number" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "inventory_control_type", label: "Inventory Control" },
  { key: "primary_category", label: "Primary Category" },
  { key: "additional_categories", label: "Additional Categories" },
  { key: "on_hand_qty", label: "On-Hand Qty" },
  { key: "unit", label: "Unit" },
  { key: "inbound_locations", label: "Inbound Locations" },
  { key: "outbound_locations", label: "Outbound Locations" },
  { key: "acquisition_method", label: "Acquisition Method" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "mpn", label: "MPN" },
  { key: "owner_id", label: "Owner" },
  { key: "created_on", label: "Created" },
];

const COLUMN_LABELS = ITEM_COLUMNS.reduce<Record<string, string>>((acc, c) => {
  acc[c.key] = c.label;
  return acc;
}, {});

const ALL_STATUSES = ["In Stock", "Low Stock", "Out of Stock", "Discontinued", "Archived"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-xl bg-white p-5 mb-5">
      <h2 className="text-base font-semibold text-foreground mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export default function ItemsV3DemoPage() {
  const { items } = useItems();

  /* ─── KPI panel state ─── */
  const [kpiOpen, setKpiOpen] = useState(false);
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const toggleKpi = (key: string) =>
    setActiveKpis((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  /* ─── Filters Modal state ─── */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
  const advancedFilteredCount = useMemo(() => {
    return items.filter((it) => {
      const f = advancedFilters;
      if (f.statuses.length && !f.statuses.includes(it.status)) return false;
      if (f.inventoryControl.length && !f.inventoryControl.includes(it.inventoryControlType)) return false;
      if (f.primaryCategories.length && !f.primaryCategories.includes(it.primaryCategory)) return false;
      if (f.units.length && !f.units.includes(it.unit)) return false;
      if (f.locations) {
        const all = [...(it.inboundLocations || []), ...(it.outboundLocations || [])].join(" ").toLowerCase();
        if (!all.includes(f.locations.toLowerCase())) return false;
      }
      if (f.onHandMin && it.onHandQty < Number(f.onHandMin)) return false;
      if (f.onHandMax && it.onHandQty > Number(f.onHandMax)) return false;
      return true;
    }).length;
  }, [items, advancedFilters]);

  /* ─── Column Selector state ─── */
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(ITEM_COLUMNS.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    ITEM_COLUMNS.reduce<Record<string, boolean>>((a, c) => ({ ...a, [c.key]: true }), {})
  );
  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;

  /* ─── Column Header Menu / inline filters state ─── */
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([]);
  const [autoOpenKey, setAutoOpenKey] = useState<string | null>(null);

  const handleAddFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev.find((f) => f.columnKey === columnKey)) return prev;
      return [...prev, createBlankFilter(columnKey)];
    });
    setAutoOpenKey(columnKey);
  };
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => prev.map((f) => (f.columnKey === columnKey ? filter : f)));
  };
  const handleRemoveColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => prev.filter((f) => f.columnKey !== columnKey));
  };

  /* ─── Pre-seed 2 active filters on mount for the ActiveFiltersBar demo ─── */
  const [demoActiveFilters, setDemoActiveFilters] = useState<ColumnFilterState[]>(() => {
    const statusFilter = createBlankFilter("status");
    statusFilter.values = ["In Stock", "Low Stock"];
    const mfgFilter = createBlankFilter("manufacturer");
    mfgFilter.values = ["BoltMaster Inc."];
    return [statusFilter, mfgFilter];
  });

  /* ─── Mini-table data (3 columns) ─── */
  const miniTableItems = useMemo(() => {
    let rows = items.slice(0, 6);
    rows = applyColumnFilters(rows, columnFilters) as typeof rows;
    if (sortConfig) {
      rows = [...rows].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        if (sortConfig.key === "part_number") return a.partNumber.localeCompare(b.partNumber) * dir;
        if (sortConfig.key === "status") return a.status.localeCompare(b.status) * dir;
        if (sortConfig.key === "on_hand_qty") return (a.onHandQty - b.onHandQty) * dir;
        return 0;
      });
    }
    return rows;
  }, [items, columnFilters, sortConfig]);

  /* ─── OverflowTooltip demo data ─── */
  const seededLocations = items[0]?.inboundLocations.concat(items[1]?.inboundLocations || []) || [];
  const overflowItems = seededLocations.slice(0, 3).map((loc, i) => ({
    id: `loc-${i}`,
    name: loc,
    subtitle: "Storage location",
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc]">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold mb-3">
            ⚠ THROWAWAY DEMO ROUTE — deleted at Slice 2
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Items V3 Helpers Preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual QA aid showing the 6 helpers built so far against real {items.length} items.
          </p>
        </div>

        {/* 1. KPI Insights Panel */}
        <Section title="1. KPI Insights Panel">
          <button
            type="button"
            onClick={() => setKpiOpen(true)}
            className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-border bg-white text-sm font-medium hover:bg-muted/40"
          >
            Open KPI Panel ({activeKpis.length} active)
          </button>
          <div className="mt-3 text-xs text-muted-foreground">
            <div className="font-semibold mb-1">Active KPIs:</div>
            <div className="flex flex-wrap gap-1.5">
              {activeKpis.length === 0 ? (
                <span className="italic">none</span>
              ) : (
                activeKpis.map((k) => {
                  const def = ALL_KPI_DEFINITIONS.find((d) => d.key === k);
                  return (
                    <span key={k} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {def?.label ?? k}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </Section>

        {/* 2. Filters Modal */}
        <Section title="2. Filters Modal">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-border bg-white text-sm font-medium hover:bg-muted/40"
          >
            Open Advanced Filters ({countActiveFilters(advancedFilters)} active)
          </button>
          <div className="mt-3 text-xs text-muted-foreground">
            <div className="font-semibold mb-1">
              Filtered count: {advancedFilteredCount} / {items.length}
            </div>
            <pre className="mt-1 p-3 bg-muted/30 rounded text-[11px] overflow-x-auto max-h-48">
              {JSON.stringify(advancedFilters, null, 2)}
            </pre>
          </div>
        </Section>

        {/* 3. Column Selector */}
        <Section title="3. Column Selector">
          <div className="flex items-center gap-3 mb-3">
            <ColumnSelectorTrigger
              visibleCount={visibleCount}
              active={columnSelectorOpen}
              onClick={() => setColumnSelectorOpen((v) => !v)}
            />
            <span className="text-xs text-muted-foreground">
              {visibleCount} of {ITEM_COLUMNS.length} visible
            </span>
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden h-[420px]">
            <div className="flex-1 p-4 text-xs text-muted-foreground bg-[#fafbfc]">
              <div className="font-semibold mb-2">Visible columns (in order):</div>
              <ol className="list-decimal list-inside space-y-0.5">
                {columnOrder
                  .filter((k) => columnVisibility[k])
                  .map((k) => (
                    <li key={k}>{COLUMN_LABELS[k]}</li>
                  ))}
              </ol>
            </div>
            <ColumnSelector
              columns={ITEM_COLUMNS}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              onColumnOrderChange={setColumnOrder}
              onColumnVisibilityChange={setColumnVisibility}
              lockedColumns={["part_number"]}
              open={columnSelectorOpen}
              onOpenChange={setColumnSelectorOpen}
            />
          </div>
        </Section>

        {/* 4. Column Header Menu (mini table) */}
        <Section title="4. Column Header Menu — 3-column mini table">
          <div className="text-xs text-muted-foreground mb-2">
            Click a column header to open the menu. Try filtering on Status (multiselect) or On-Hand Qty (range).
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#fafbfc] border-b border-border">
                <tr>
                  {(["part_number", "status", "on_hand_qty"] as const).map((key) => {
                    const filter = columnFilters.find((f) => f.columnKey === key) ?? null;
                    return (
                      <th key={key} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        <ColumnHeaderMenu
                          columnKey={key}
                          label={COLUMN_LABELS[key]}
                          sortable
                          sortConfig={sortConfig}
                          onSort={(k, dir) => setSortConfig(dir ? { key: k, direction: dir } : null)}
                          onAddFilter={handleAddFilter}
                          onHideColumn={() => {}}
                          hasActiveFilter={!!filter}
                          filter={filter}
                          items={items}
                          onFilterChange={handleColumnFilterChange}
                        >
                          <span>{COLUMN_LABELS[key]}</span>
                        </ColumnHeaderMenu>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {miniTableItems.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-foreground font-medium">{it.partNumber}</td>
                    <td className="px-3 py-2"><ItemStatusBadge status={it.status} /></td>
                    <td className="px-3 py-2 tabular-nums">{it.onHandQty.toLocaleString()}</td>
                  </tr>
                ))}
                {miniTableItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No items match active header filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Showing {miniTableItems.length} rows · sort: {sortConfig ? `${sortConfig.key} ${sortConfig.direction}` : "none"} · header filters: {columnFilters.length}
          </div>
        </Section>

        {/* 5. Active Filters Bar */}
        <Section title="5. Active Filters Bar — pre-seeded with 2 chips">
          <div className="border border-border rounded-lg pt-3 bg-white">
            <ActiveFiltersBar
              columnFilters={demoActiveFilters}
              columnLabels={COLUMN_LABELS}
              items={items}
              onFilterChange={(key, filter) =>
                setDemoActiveFilters((prev) =>
                  prev.map((f) => (f.columnKey === key ? filter : f))
                )
              }
              onRemoveFilter={(key) =>
                setDemoActiveFilters((prev) => prev.filter((f) => f.columnKey !== key))
              }
              onAddFilter={(key) => {
                setDemoActiveFilters((prev) => {
                  if (prev.find((f) => f.columnKey === key)) return prev;
                  return [...prev, createBlankFilter(key)];
                });
              }}
              onClearAll={() => setDemoActiveFilters([])}
              autoOpenKey={null}
              onAutoOpened={() => {}}
              availableColumns={ITEM_COLUMNS}
            />
          </div>
          {demoActiveFilters.length === 0 && (
            <button
              type="button"
              onClick={() => {
                const s = createBlankFilter("status");
                s.values = ["In Stock"];
                setDemoActiveFilters([s]);
              }}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Re-seed sample filters
            </button>
          )}
        </Section>

        {/* 6. OverflowTooltip */}
        <Section title="6. OverflowTooltip">
          <div className="text-xs text-muted-foreground mb-2">
            Hover the chip below to preview locations from the first seeded item.
          </div>
          <OverflowTooltip items={overflowItems} category="Locations">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-border text-xs font-medium bg-white cursor-default">
              📍 +{overflowItems.length} locations
            </span>
          </OverflowTooltip>
        </Section>

        {/* 7. ItemStatusBadge */}
        <Section title="7. ItemStatusBadge — all 5 statuses">
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <ItemStatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Mounted helpers ─── */}
      <KpiInsightsPanel
        open={kpiOpen}
        onOpenChange={setKpiOpen}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        items={items}
      />
      <FiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advancedFilters}
        onFiltersChange={setAdvancedFilters}
        items={items}
        filteredCount={advancedFilteredCount}
      />
    </div>
  );
}
