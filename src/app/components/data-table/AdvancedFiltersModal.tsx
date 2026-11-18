/**
 * AdvancedFiltersModal: config-driven advanced filters panel.
 *
 * Layout/UI mirrors the Partner Management "Filters" modal (centered dialog,
 * sectioned body, segmented control + chips + searchable chip groups, sticky
 * "Clear all" / "Show N results" footer). The blue (`primary`/`accent`) tokens
 * from that app are remapped to UAC's blue (#007FFF / #EDF4FF); neutral tokens
 * (border / muted / foreground) are kept. Filter LOGIC stays UAC-native: the
 * sections + predicate are supplied per table via `AdvancedFilterConfig`.
 */
import { useState, useMemo, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp, Search } from "lucide-react";
import type {
  AdvancedFilterOption,
  AdvancedFilterSection,
  AdvancedFilterValues,
} from "./types";
import { highlightMatch } from "../../lib/highlight-text";

const BLUE = "#007FFF";
const BLUE_TINT = "#EDF4FF";

/** Number of sections with a non-empty selection. */
export function countAdvancedFilters(
  sections: AdvancedFilterSection[],
  values: AdvancedFilterValues,
): number {
  return sections.reduce(
    (n, s) => n + ((values[s.key]?.length ?? 0) > 0 ? 1 : 0),
    0,
  );
}

/* ─── Pill chip (Status chips + grouped chips) ─── */
function Pill({
  label,
  selected,
  onClick,
  count,
  prefix,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
  prefix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected
          ? "border-[#007FFF]/30 text-[#007FFF]"
          : "bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      style={{
        fontWeight: selected ? 500 : 400,
        backgroundColor: selected ? BLUE_TINT : undefined,
      }}
    >
      {prefix && <span>{prefix}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[11px] tabular-nums ${
            selected ? "text-[#007FFF]/60" : "text-muted-foreground/50"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Segmented control (Any / A / B …) ─── */
function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: AdvancedFilterOption[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const allSelected = selected.length === 0;
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`flex-1 py-2.5 text-[13px] cursor-pointer transition-colors border-r border-border ${
          allSelected ? "text-[#007FFF]" : "bg-white text-foreground hover:bg-muted/30"
        }`}
        style={{ fontWeight: 500, backgroundColor: allSelected ? BLUE_TINT : undefined }}
      >
        Any
      </button>
      {options.map((opt, i) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              isSelected
                ? onChange(selected.filter((v) => v !== opt.value))
                : onChange([...selected, opt.value])
            }
            className={`flex-1 py-2.5 text-[13px] cursor-pointer transition-colors ${
              i < options.length - 1 ? "border-r border-border" : ""
            } ${isSelected ? "text-[#007FFF]" : "bg-white text-foreground hover:bg-muted/30"}`}
            style={{ fontWeight: 500, backgroundColor: isSelected ? BLUE_TINT : undefined }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Pill section with "Show all N" ─── */
function PillSection({
  options,
  selected,
  onToggle,
  getCount,
  threshold = 8,
}: {
  options: AdvancedFilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount?: (value: string) => number;
  threshold?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? options : options.slice(0, threshold);
  const hasMore = options.length > threshold;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => (
          <Pill
            key={opt.value}
            label={opt.label}
            prefix={opt.prefix}
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
            count={getCount?.(opt.value)}
          />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="inline-flex items-center gap-1 mt-2.5 text-[13px] cursor-pointer transition-colors"
          style={{ fontWeight: 500, color: BLUE }}
        >
          {showAll ? "Show less" : `Show all ${options.length}`}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

/* ─── Searchable multi-select chip group ─── */
function SearchableMultiSelect({
  options,
  selected,
  onToggle,
  getCount,
  placeholder = "Search…",
}: {
  options: AdvancedFilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount?: (value: string) => number;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const chip = (opt: AdvancedFilterOption, isChecked: boolean) => (
    <button
      key={opt.value}
      type="button"
      onClick={() => onToggle(opt.value)}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
        isChecked
          ? "border-[#007FFF]/25 text-[#007FFF]"
          : "bg-white border-border text-foreground hover:bg-muted/40"
      }`}
      style={{ fontWeight: isChecked ? 500 : 400, backgroundColor: isChecked ? BLUE_TINT : undefined }}
    >
      {opt.prefix && <span>{opt.prefix}</span>}
      <span className="truncate max-w-[140px]">{highlightMatch(opt.label, query)}</span>
      {getCount && (
        <span className={`text-[10px] tabular-nums ${isChecked ? "text-[#007FFF]/60" : "text-muted-foreground/50"}`}>
          {getCount(opt.value)}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] placeholder:text-muted-foreground/40"
          style={{ paddingLeft: "2.125rem" }}
        />
      </div>

      <div className="max-h-[180px] overflow-y-auto -mx-1 px-1 overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-3 text-center">No Results</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const selectedSet = new Set(selected);
              const isSearching = !!query.trim();

              if (isSearching) {
                return filtered.map((opt) => chip(opt, selectedSet.has(opt.value)));
              }

              const selectedOpts = filtered.filter((o) => selectedSet.has(o.value));
              const suggestions = filtered
                .filter((o) => !selectedSet.has(o.value))
                .sort((a, b) => (getCount?.(b.value) ?? 0) - (getCount?.(a.value) ?? 0))
                .slice(0, 6);
              const display = [...selectedOpts, ...suggestions];
              const remaining =
                filtered.filter((o) => !selectedSet.has(o.value)).length - suggestions.length;

              return (
                <>
                  {display.map((opt) => chip(opt, selectedSet.has(opt.value)))}
                  {remaining > 0 && (
                    <span className="inline-flex items-center h-[30px] px-2.5 text-[12px] text-[#717182]/60 italic">
                      +{remaining} more, type to search
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section chrome ─── */
function Divider() {
  return <div className="border-t border-border/50 mx-6" />;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>
        {title}
      </h4>
      {subtitle ? (
        <p className="text-[12px] text-muted-foreground mb-3">{subtitle}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </div>
  );
}

/* ─── Main component ─── */
interface AdvancedFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: AdvancedFilterSection[];
  values: AdvancedFilterValues;
  onValuesChange: (values: AdvancedFilterValues) => void;
  filteredCount: number;
  entityLabel: string;
}

export function AdvancedFiltersModal({
  open,
  onOpenChange,
  sections,
  values,
  onValuesChange,
  filteredCount,
  entityLabel,
}: AdvancedFiltersModalProps) {
  const setSection = (key: string, next: string[]) =>
    onValuesChange({ ...values, [key]: next });

  const toggleSection = (key: string, value: string) => {
    const arr = values[key] ?? [];
    setSection(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const activeCount = countAdvancedFilters(sections, values);
  const singular = entityLabel.endsWith("s") ? entityLabel.slice(0, -1) : entityLabel;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none font-['Inter',sans-serif]"
        >
          <DialogPrimitive.Title className="sr-only">Filters</DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>
              Filters
            </span>
            {activeCount > 0 && (
              <span
                className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: BLUE, fontWeight: 600 }}
              >
                {activeCount}
              </span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {sections.map((section, idx) => {
              const selected = values[section.key] ?? [];
              return (
                <div key={section.key}>
                  <Section title={section.title} subtitle={section.subtitle}>
                    {section.kind === "segmented" && (
                      <SegmentedControl
                        options={section.options}
                        selected={selected}
                        onChange={(next) => setSection(section.key, next)}
                      />
                    )}

                    {section.kind === "pills" && (
                      <div className="flex flex-wrap gap-1.5">
                        <Pill
                          label="Any"
                          selected={selected.length === 0}
                          onClick={() => setSection(section.key, [])}
                        />
                        {section.options.map((opt) => (
                          <Pill
                            key={opt.value}
                            label={opt.label}
                            prefix={opt.prefix}
                            selected={selected.includes(opt.value)}
                            onClick={() => toggleSection(section.key, opt.value)}
                            count={section.getCount?.(opt.value)}
                          />
                        ))}
                      </div>
                    )}

                    {section.kind === "pillsExpandable" && (
                      <PillSection
                        options={section.options}
                        selected={selected}
                        onToggle={(v) => toggleSection(section.key, v)}
                        getCount={section.getCount}
                        threshold={section.threshold}
                      />
                    )}

                    {section.kind === "searchable" && (
                      <SearchableMultiSelect
                        options={section.options}
                        selected={selected}
                        onToggle={(v) => toggleSection(section.key, v)}
                        getCount={section.getCount}
                        placeholder={section.placeholder}
                      />
                    )}
                  </Section>
                  {idx < sections.length - 1 && <Divider />}
                </div>
              );
            })}
          </div>

          {/* Sticky footer */}
          <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => onValuesChange({})}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
              style={{ backgroundColor: BLUE, fontWeight: 600 }}
            >
              Show {filteredCount.toLocaleString()} {filteredCount !== 1 ? entityLabel : singular}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
