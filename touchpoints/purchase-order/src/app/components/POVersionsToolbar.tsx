import { useState } from "react";
import { Search, ArrowLeftRight, X, SlidersHorizontal, User, GitBranch } from "lucide-react";
import { FONT } from "./designTokens";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { versionPalette as C } from "./poVersionDisplay";
import {
  PO_VERSION_QUICK_FILTERS,
  advancedPOFilterCount,
  type POVersionChangeFilter,
  type POVersionFilterState,
} from "./poVersionFilters";

/* Status options shown in the advanced popover. `any` sits first so it
   reads as the reset choice. Buyer 2026-07-31: dropped the
   "Partially Received" pill — the version status filter narrows the
   version list, not receiving progress, so a partial-receiving state
   isn't a useful lens here. */
const PO_STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const statusLabel = (key: string): string =>
  PO_STATUS_OPTIONS.find((o) => o.key === key)?.label ?? capitalize(key);

/**
 * PO version-history toolbar — search field + quick-filter chip row +
 * Compare toggle + Compare action bar.
 *
 * Extracted from POVersionHistoryTab.tsx (was inline lines ~110-199 of the
 * original 774-LOC file) as part of the 2026-07-10 component split. Quick-
 * filter chips added in the follow-up filter-parity pass to match SO's
 * `pages/quote-detail/tabs/versions/VersionsToolbar.tsx`.
 *
 * Purely presentational — every piece of state is owned by the parent
 * `POVersionHistoryTab` so the compare/search/filter flow stays in one place.
 */
interface POVersionsToolbarProps {
  /** Full filter state (search + quick filter + status + creator). Owned
      by the parent tab so all narrowing flows through one source of truth. */
  filterState: POVersionFilterState;
  /** Patch the parent's filter state (only touched keys). Mirrors SO's
      `VersionsToolbar` shape so patches like `{ search: "abc" }` or
      `{ status: "confirmed" }` land in one setter. */
  onFilterChange: (patch: Partial<POVersionFilterState>) => void;
  /** Distinct authors across the version history — feeds the "Created by"
      section of the advanced popover. */
  creators: string[];
  compareMode: boolean;
  /** Toggles compareMode and clears the current selection. Parent handles both. */
  onToggleCompareMode: () => void;
  compareSelectionCount: number;
  onStartComparison: () => void;
  /** Only rendered on the "Compare V{n} → V{m}" CTA; supply both when
      compareSelectionCount === 2. */
  minCompareVersion?: number;
  maxCompareVersion?: number;
}

export default function POVersionsToolbar({
  filterState,
  onFilterChange,
  creators,
  compareMode,
  onToggleCompareMode,
  compareSelectionCount,
  onStartComparison,
  minCompareVersion,
  maxCompareVersion,
}: POVersionsToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedCount = advancedPOFilterCount(filterState);
  const advancedActive = advancedCount > 0;

  return (
    <>
      {/* Top row — Partners compact-form input (h-9, shadow-sm, focus:ring-2
          primary/20) + advanced filter popover + outline-neutral compare
          toggle. */}
      <div className="px-4 py-3 flex items-center gap-2">
        {/* Search */}
        <div className="relative w-60 shrink-0">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 14, height: 14, color: C.text400 }}
          />
          <input
            value={filterState.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search changes..."
            className="w-full h-9 pl-8 pr-8 rounded-md border bg-white outline-none shadow-sm transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: C.text900,
              borderColor: `color-mix(in srgb, ${C.border} 80%, transparent)`,
              fontFamily: FONT,
              lineHeight: 1.4,
            }}
          />
          {filterState.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ search: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md transition-colors hover:bg-muted/60"
              style={{ width: 20, height: 20 }}
            >
              <X style={{ width: 12, height: 12, color: C.text400 }} />
            </button>
          )}
        </div>

        {/* Advanced filter popover — Status + Created-by. Trigger carries
            a badge showing how many advanced filters are narrowing the
            list. Mirrors SO's VersionsToolbar `Filters` menu. */}
        <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-9 px-2.5 rounded-md border inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-150 hover:bg-muted/60"
              style={{
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT,
                lineHeight: 1,
                color: advancedOpen || advancedActive ? "hsl(var(--primary))" : C.text700,
                backgroundColor: advancedOpen || advancedActive ? "hsl(var(--primary-tint))" : "#FFFFFF",
                borderColor:
                  advancedOpen || advancedActive
                    ? "hsl(var(--primary))"
                    : `color-mix(in srgb, ${C.border} 80%, transparent)`,
              }}
            >
              <SlidersHorizontal style={{ width: 14, height: 14 }} />
              Filters
              {advancedCount > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full ml-0.5"
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: FONT,
                    lineHeight: 1,
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {advancedCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-64 p-0"
          >
            <div
              className="flex items-center justify-between px-3.5 py-2.5 border-b"
              style={{ borderColor: C.border }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text900,
                  fontFamily: FONT,
                }}
              >
                Filters
              </span>
              {advancedCount > 0 && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ status: "any", creator: "all" })}
                  className="rounded px-1.5 py-0.5 transition-colors hover:bg-rose-50"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#B91C1C",
                    fontFamily: FONT,
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Status section */}
            <div
              className="px-3.5 py-2.5 border-b"
              style={{ borderColor: C.border }}
            >
              <div
                className="flex items-center mb-2"
                style={{ gap: 6 }}
              >
                <GitBranch style={{ width: 12, height: 12, color: C.text500 }} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.text500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontFamily: FONT,
                  }}
                >
                  Version status
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {PO_STATUS_OPTIONS.map((o) => {
                  const active = filterState.status === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => onFilterChange({ status: o.key })}
                      aria-pressed={active}
                      className="inline-flex items-center h-7 px-2.5 rounded-full border cursor-pointer transition-colors"
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        lineHeight: 1,
                        fontFamily: FONT,
                        color: active ? "hsl(var(--primary))" : C.text600,
                        backgroundColor: active ? "hsl(var(--primary-tint))" : "#FFFFFF",
                        borderColor: active
                          ? "hsl(var(--primary))"
                          : `color-mix(in srgb, ${C.border} 80%, transparent)`,
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Created by section */}
            <div className="px-3.5 py-2.5">
              <div
                className="flex items-center mb-2"
                style={{ gap: 6 }}
              >
                <User style={{ width: 12, height: 12, color: C.text500 }} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.text500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontFamily: FONT,
                  }}
                >
                  Created by
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onFilterChange({ creator: "all" })}
                  className="text-left rounded-md px-2 py-1.5 transition-colors cursor-pointer"
                  style={{
                    fontSize: 12,
                    fontFamily: FONT,
                    fontWeight: filterState.creator === "all" ? 500 : 400,
                    color: filterState.creator === "all" ? "hsl(var(--primary))" : C.text700,
                    backgroundColor:
                      filterState.creator === "all" ? "hsl(var(--primary-tint))" : "transparent",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (filterState.creator !== "all") {
                      e.currentTarget.style.backgroundColor = "#F1F5F9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filterState.creator !== "all") {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  Everyone
                </button>
                {creators.map((c) => {
                  const active = filterState.creator === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onFilterChange({ creator: c })}
                      className="text-left rounded-md px-2 py-1.5 transition-colors cursor-pointer"
                      style={{
                        fontSize: 12,
                        fontFamily: FONT,
                        fontWeight: active ? 500 : 400,
                        color: active ? "hsl(var(--primary))" : C.text700,
                        backgroundColor: active ? "hsl(var(--primary-tint))" : "transparent",
                        border: "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.backgroundColor = "#F1F5F9";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Compare toggle — SO parity 2026-07-28: emerald tint when
            off, blue tint when active. Signals "Compare Versions" as
            an available action, then "Exit Compare" to leave. Replaces
            the earlier destructive-red "Cancel" state which read as
            deletion. */}
        <button
          type="button"
          onClick={onToggleCompareMode}
          className="h-9 px-3 rounded-md border inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT,
            lineHeight: 1,
            color: compareMode ? "#1E40AF" : "#065F46",
            backgroundColor: compareMode ? "#EFF6FF" : "#ECFDF5",
            borderColor: compareMode ? "#BFDBFE" : "#A7F3D0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = compareMode ? "#DBEAFE" : "#D1FAE5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = compareMode ? "#EFF6FF" : "#ECFDF5";
          }}
        >
          <ArrowLeftRight style={{ width: 14, height: 14 }} />
          {compareMode ? "Exit Compare" : "Compare Versions"}
        </button>
      </div>

      {/* Quick-filter chip row + removable advanced-filter tags. Mirrors
          SO's VersionsToolbar row 2. Hidden in compare mode (which uses
          its own action bar with a different tint). */}
      {!compareMode && (
        <div
          className="flex items-center flex-wrap gap-1.5 px-4 py-2 border-t"
          style={{ borderColor: C.divider, backgroundColor: "#FFFFFF" }}
        >
          {PO_VERSION_QUICK_FILTERS.map((chip) => {
            const active = filterState.changeFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange({ changeFilter: chip.key })}
                className="inline-flex items-center h-7 px-2.5 rounded-full border cursor-pointer transition-all duration-150"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1,
                  fontFamily: FONT,
                  color: active ? "hsl(var(--primary))" : C.text600,
                  backgroundColor: active ? "hsl(var(--primary-tint))" : "#FFFFFF",
                  borderColor: active
                    ? "hsl(var(--primary))"
                    : `color-mix(in srgb, ${C.border} 80%, transparent)`,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = C.muted;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                  }
                }}
              >
                {chip.label}
              </button>
            );
          })}

          {/* Active advanced-filter tags (removable). Only render when
              at least one is set — separated from the quick chips by a
              vertical divider. */}
          {advancedActive && (
            <>
              <span
                className="mx-1 h-5 w-px shrink-0"
                style={{ backgroundColor: C.border }}
                aria-hidden
              />
              {filterState.status !== "any" && (
                <span
                  className="inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    fontFamily: FONT,
                    backgroundColor: "hsl(var(--primary-tint))",
                    color: "hsl(var(--primary))",
                  }}
                >
                  Status: {statusLabel(filterState.status)}
                  <button
                    type="button"
                    aria-label="Clear status filter"
                    onClick={() => onFilterChange({ status: "any" })}
                    className="flex items-center justify-center rounded transition-colors"
                    style={{
                      width: 14,
                      height: 14,
                      border: "none",
                      backgroundColor: "transparent",
                      color: "hsl(var(--primary))",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </span>
              )}
              {filterState.creator !== "all" && (
                <span
                  className="inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    fontFamily: FONT,
                    backgroundColor: "hsl(var(--primary-tint))",
                    color: "hsl(var(--primary))",
                  }}
                >
                  By: {filterState.creator}
                  <button
                    type="button"
                    aria-label="Clear creator filter"
                    onClick={() => onFilterChange({ creator: "all" })}
                    className="flex items-center justify-center rounded transition-colors"
                    style={{
                      width: 14,
                      height: 14,
                      border: "none",
                      backgroundColor: "transparent",
                      color: "hsl(var(--primary))",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "hsl(var(--primary) / 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Border between toolbar and list (idle state only — compare mode
          uses its own action bar below with its own top-border). */}
      {!compareMode && <div style={{ height: 1, backgroundColor: C.border }} />}

      {/* Compare action bar — Partners Vendor-blue palette
          (`#EFF6FF` bg / `#BFDBFE` border / `#1E40AF` text). Primary CTA
          uses the canonical filled-primary recipe (`hsl(var(--primary))`
          + hover `#0862D0`) for parity with the header `[Send to Vendor]`. */}
      {compareMode && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            backgroundColor: "#EFF6FF",
            borderTop: "1px solid #BFDBFE",
            borderBottom: "1px solid #BFDBFE",
          }}
        >
          <ArrowLeftRight style={{ width: 14, height: 14, color: "#1E40AF" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#1E40AF",
              lineHeight: 1.35,
              fontFamily: FONT,
            }}
          >
            Select two versions to compare
            {compareSelectionCount > 0 && (
              <span className="tabular-nums" style={{ marginLeft: 4 }}>
                · {compareSelectionCount}/2 selected
              </span>
            )}
          </span>
          <div className="flex-1" />
          {compareSelectionCount === 2 &&
            minCompareVersion != null &&
            maxCompareVersion != null && (
              <button
                type="button"
                onClick={onStartComparison}
                className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors duration-150"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: FONT,
                  lineHeight: 1,
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#0862D0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "hsl(var(--primary))";
                }}
              >
                Compare V{minCompareVersion} ↔ V{maxCompareVersion}
              </button>
            )}
        </div>
      )}
    </>
  );
}
