import { useState } from "react";
import { Check, ChevronDown, Search, User, X } from "lucide-react";

import { cn } from "../ui/utils";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TEAM } from "./data";

/**
 * TRIMMED PORT NOTE: SOURCE's multi-view.tsx is three interchangeable
 * Activity Log views (Table/Timeline/Flat) sharing one toolbar, but
 * warehouse-activity-log.tsx only ever imports two toolbar pieces from it
 * — MultiSelectFilterPill and MeModeChip. The rest of that file
 * (ActivityLogMultiView and everything only it needs: CreatedByHoverCard
 * and ColumnSelector from a `../shared/` folder that does not exist in
 * this repo, plus EntityChip, ActivityDetailModal, DateRangeField and
 * the ui/table primitives wired together for that view) does not compile
 * here, since those shared components only exist in the source repo.
 * Only the two components this port actually uses are kept. If a future
 * module needs the full multi-view (table/timeline/flat switcher), port
 * it then, together with CreatedByHoverCard/ColumnSelector.
 */

/* ─── Shared bits ─── */

/** More options than this and the dropdown scrolls, so it gets a search box. */
const SEARCHABLE_FROM = 10;

export function MultiSelectFilterPill<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable: searchableProp = false,
  avatars = false,
  renderAvatar,
  counts,
}: {
  label: string;
  options: { key: T; label: string }[];
  selected: T[];
  onToggle: (key: T) => void;
  onClear: () => void;
  /** Force the search box on. Past SEARCHABLE_FROM options it appears on its own. */
  searchable?: boolean;
  avatars?: boolean;
  /** Overrides the default TEAM-lookup <img> avatar — pass this when a
   * consumer has its own avatar component (photo + initials fallback) so
   * the dropdown doesn't need a second one built for it. */
  renderAvatar?: (label: string) => React.ReactNode;
  counts?: Partial<Record<T, number>>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // A list long enough to scroll gets the same search box the User pill
  // has, whatever the pill — Changed in Items lists 18 fields.
  const searchable = searchableProp || options.length > SEARCHABLE_FROM;
  const active = selected.length > 0;
  const triggerValue =
    selected.length === 0 ? "All" : selected.length === 1 ? options.find((o) => o.key === selected[0])!.label : `${selected.length} selected`;
  const visibleOptions = searchable && search.trim() ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase())) : options;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors",
            active ? "border-primary bg-accent text-primary" : "border-border bg-white text-muted-foreground hover:bg-muted/60",
          )}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          <span>{label}:</span>
          <span className="max-w-[140px] truncate">{triggerValue}</span>
          {active ? (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              className="flex size-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/15"
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("activity-log-portal p-1", avatars ? "w-[260px]" : "w-[240px]")}>
        {searchable && (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-8 w-full rounded-md border border-border bg-white pl-8 pr-7 text-[12px] outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-muted/60">
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        <button type="button" onClick={onClear} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50">
          <span className="text-[12px] text-foreground" style={{ fontWeight: selected.length === 0 ? 600 : 400 }}>All</span>
          {selected.length === 0 && <Check className="size-3.5 text-primary" />}
        </button>
        <div className="my-1 h-px bg-border/60" />

        {visibleOptions.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-muted-foreground">No matches</p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {visibleOptions.map((opt) => {
              const checked = selected.includes(opt.key);
              const count = counts?.[opt.key];
              return (
                <div
                  key={opt.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggle(opt.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(opt.key);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  {avatars ? (
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      {renderAvatar ? (
                        renderAvatar(opt.label)
                      ) : (
                        <img src={TEAM[opt.label]?.avatar} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                      )}
                      <span className="flex-1 truncate text-[12px] text-foreground">{opt.label}</span>
                    </span>
                  ) : (
                    <span className="flex-1 truncate text-[12px] text-foreground">{opt.label}</span>
                  )}
                  {count !== undefined && <span className="shrink-0 text-[11px] text-muted-foreground">{count}</span>}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function MeModeChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
          : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground active:bg-muted",
      )}
      style={active ? { color: "var(--primary)", fontWeight: 500 } : { fontWeight: 400 }}
    >
      <User className="size-3.5" />
      Me mode
    </button>
  );
}
