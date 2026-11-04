import { useState, useMemo, useRef, useEffect } from "react";
import { SlidersHorizontal, X, Search } from "lucide-react";

/**
 * Highlights matching search terms with yellow background across the SO module.
 */
export function HighlightText({ text, search }: { text: string; search: string }) {
  const parts = useMemo(() => {
    if (!search || !text) return [{ text, match: false }];
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const segments: { text: string; match: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.slice(lastIndex, match.index), match: false });
      }
      segments.push({ text: match[1], match: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), match: false });
    }
    return segments.length > 0 ? segments : [{ text, match: false }];
  }, [text, search]);

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="bg-chart-3/35"
            style={{
              color: "inherit",
              borderRadius: 2,
              padding: "0 4px",
              font: "inherit",
            }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * Shared search + filter bar component with optional filter button for all tabs.
 */
export function TabSearchBar({
  search,
  onSearchChange,
  placeholder = "Search...",
  resultCount,
  resultLabel = "results",
  children,
  filterContent,
  leftContent,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  resultCount?: number;
  resultLabel?: string;
  children?: React.ReactNode;
  filterContent?: React.ReactNode;
  leftContent?: React.ReactNode;
}) {
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFilter]);

  return (
    <div style={{ padding: "var(--space-card-padding) var(--space-card-padding) var(--space-inline-gap)" }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between" style={{ gap: 8 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div
            className="flex items-center border border-border rounded-lg"
            style={{ gap: 8, padding: "7px 12px", width: 240 }}
          >
            <Search className="w-3.5 h-3.5 text-foreground/35 shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground/35"
              style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" }}
              placeholder={placeholder}
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
            {search && (
              <button onClick={() => onSearchChange("")} className="text-foreground/35 hover:text-foreground transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Filter button */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center border rounded-lg transition-colors ${showFilter ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground/60 hover:bg-secondary"}`}
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: "var(--font-weight-medium)",
                gap: 6,
                padding: "7px 12px",
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            </button>
            {showFilter && filterContent && (
              <div
                className="absolute top-full left-0 bg-card border border-border rounded-lg"
                style={{
                  zIndex: "var(--z-dropdown)",
                  boxShadow: "var(--elevation-2)",
                  marginTop: 4,
                  minWidth: 240,
                  padding: "var(--space-card-padding)",
                }}
              >
                {filterContent}
              </div>
            )}
          </div>
          {leftContent}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {children}
          {resultCount !== undefined && (
            <span
              className="text-foreground/50"
              style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
            >
              {resultCount} {resultLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shared filter pills row for tabs — matches main table listing style with
 * background color for count, shadow, etc.
 */
export function FilterPills<T extends string>({
  pills,
  active,
  onSelect,
}: {
  pills: { key: T; label: string; count: number }[];
  active: T;
  onSelect: (key: any) => void;
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6, padding: "0 var(--space-card-padding) var(--space-card-padding)" }}>
      {pills.map(p => {
        const isActive = active === p.key;
        return (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            className={`inline-flex items-center rounded-full border transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground/70 border-border hover:bg-secondary"
            }`}
            style={{
              fontSize: "var(--text-caption)",
              fontWeight: "var(--font-weight-medium)",
              gap: 6,
              padding: "5px 12px",
              boxShadow: isActive ? "none" : "var(--elevation-1)",
            }}
          >
            {p.label}
            <span
              className={`inline-flex items-center justify-center rounded-md ${
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-foreground/40"
              }`}
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: "var(--font-weight-semibold)",
                padding: "0 4px",
                minWidth: 20,
              }}
            >
              {p.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}