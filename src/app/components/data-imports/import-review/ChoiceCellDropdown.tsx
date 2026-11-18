/* ────────────────────────────────────────────────────────────
   The one cell dropdown every Data Imports grid uses (review
   modal and import record page, every module).

   It follows the Review and Fix Your Data modal of the home
   modules (Partners, Categories, Items), which pick the editor
   from the column, not per column by hand:

   • single select, short list   → plain list, check on the right
   • single select, long list    → the same list under a search box
   • multi select (pipe list)    → search box, uppercase section
                                   header, checkbox rows, footer
                                   "N selected" + Done

   An option may carry a description, shown as a second muted line
   under its label (License Type: "Field User" / "$15 / user ·
   month"). The cell itself always shows plain text, never a chip.

   Mounts already open; the panel portals to <body> and carries
   `data-cell-dropdown` so the grids' outside-click handlers leave
   it alone. Single: a click commits and moves down, Escape or an
   outside click cancels. Multi: picks stay local, Done commits and
   moves down, an outside click commits in place, Escape cancels.
   ──────────────────────────────────────────────────────────── */
import { useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";

type NavDir = "up" | "down" | "left" | "right";

export interface ChoiceOption {
  /** What the cell stores. */
  value: string;
  /** What the list shows; defaults to the value. */
  label?: string;
  /** Second, muted line under the label. */
  description?: string;
}

export interface ChoiceGroup {
  label: string;
  options: (string | ChoiceOption)[];
}

export interface ChoiceCellDropdownProps {
  value: string;
  /** Flat options. Ignored when `groups` is given. */
  options?: (string | ChoiceOption)[];
  /** Sectioned options (uppercase heading per group). */
  groups?: ChoiceGroup[];
  multi?: boolean;
  /** Single select only: show the search box. Multi always searches. */
  searchable?: boolean;
  /** Column label, for the placeholder, the search hint and the empty state. */
  label?: string;
  /** Multi section heading; defaults to the column label. */
  sectionLabel?: string;
  /** Multi: keep the given order instead of sorting A to Z. */
  keepOrder?: boolean;
  onCommit: (next: string, dir?: NavDir) => void;
  onCancel: () => void;
}

/** Single search box from this many options up (Partners and Categories
 *  search a single list of more than 8; Items of more than 10). */
export const SEARCH_THRESHOLD = 8;

const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";
const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";
const HEADING_STYLE = { fontFamily: CELL_FONT, fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" } as const;

const toOption = (o: string | ChoiceOption): ChoiceOption => (typeof o === "string" ? { value: o } : o);
const labelOf = (o: ChoiceOption) => o.label ?? o.value;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function ChoiceCellDropdown({
  value,
  options = [],
  groups,
  multi = false,
  searchable = false,
  label = "",
  sectionLabel,
  keepOrder = false,
  onCommit,
  onCancel,
}: ChoiceCellDropdownProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const finalizedRef = useRef(false);

  /* Groups, normalised. Multi lists read A to Z, like the home modules. */
  const sections = useMemo<{ label: string; options: ChoiceOption[] }[]>(() => {
    const raw = groups
      ? groups.map((g) => ({ label: g.label, options: g.options.map(toOption) }))
      : [{ label: multi ? (sectionLabel ?? label) : "", options: options.map(toOption) }];
    if (!multi || keepOrder) return raw;
    return raw.map((g) => ({ ...g, options: [...g.options].sort((a, b) => labelOf(a).localeCompare(labelOf(b))) }));
  }, [groups, options, multi, keepOrder, sectionLabel, label]);
  const all = useMemo(() => sections.flatMap((s) => s.options), [sections]);

  /* Pipe list in, canonical spellings, no duplicates. */
  const [selected, setSelected] = useState<string[]>(() => {
    const out: string[] = [];
    for (const raw of multi ? value.split("|") : [value]) {
      const token = raw.trim();
      if (!token) continue;
      const canonical = all.find((o) => same(o.value, token))?.value ?? token;
      if (!out.some((s) => same(s, canonical))) out.push(canonical);
    }
    return out;
  });
  const isChecked = (v: string) => selected.some((s) => same(s, v));
  const unknown = multi ? selected.filter((s) => !all.some((o) => same(o.value, s))) : [];

  const finalize = (mode: "commit" | "cancel", next?: string, dir?: NavDir) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (mode === "cancel") onCancel();
    else onCommit(next ?? "", dir);
  };
  const commitMulti = (dir?: NavDir) => finalize("commit", selected.join("|"), dir);
  const pick = (v: string) => {
    finalize("commit", v, "down");
    setOpen(false);
  };
  const toggle = (v: string) =>
    setSelected((prev) => (prev.some((s) => same(s, v)) ? prev.filter((s) => !same(s, v)) : [...prev, v]));

  const showSearch = multi || searchable;
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      sections
        .map((s) => ({
          ...s,
          options: q
            ? s.options.filter((o) => [o.value, o.label ?? "", o.description ?? ""].some((t) => t.toLowerCase().includes(q)))
            : s.options,
        }))
        .filter((s) => s.options.length > 0),
    [sections, q],
  );
  const hasDescriptions = all.some((o) => o.description);
  const noun = (sectionLabel ?? label).toLowerCase();

  const current = !multi ? all.find((o) => isChecked(o.value)) : undefined;
  const triggerText = multi
    ? selected.map((s) => labelOf(all.find((o) => same(o.value, s)) ?? { value: s })).join(" · ")
    : current
      ? labelOf(current)
      : "";
  const placeholder = multi && label ? `- Select ${label.toLowerCase()} -` : "- Select -";

  const width = multi ? "w-[288px]" : showSearch ? (hasDescriptions ? "w-[300px]" : "w-[260px]") : hasDescriptions ? "min-w-[240px] max-w-[320px]" : "min-w-[180px] max-w-[320px]";

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          if (multi) commitMulti();
          else finalize("cancel");
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
          style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
        >
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: triggerText ? "#1E293B" : "#94A3B8" }}>
            {triggerText || placeholder}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className={`${PANEL_CLASS} ${width} flex flex-col`}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            finalize("cancel");
          }}
          onOpenAutoFocus={(e) => {
            if (!showSearch) e.preventDefault();
          }}
        >
          {showSearch && (
            <div className="p-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0A77FF] focus-within:bg-white transition-colors">
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={noun ? `Search ${noun}` : "Search"}
                  className="flex-1 min-w-0 bg-transparent outline-none"
                  style={{ fontFamily: CELL_FONT, fontSize: "13px", color: "#1E293B" }}
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="shrink-0 cursor-pointer" aria-label="Clear search">
                    <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            className={`overflow-y-auto ${showSearch ? "py-1.5" : "p-1.5"}`}
            style={{ maxHeight: 248, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
          >
            {visible.length === 0 && unknown.length === 0 && (
              <div className="px-3 py-6 text-center" style={{ fontFamily: CELL_FONT, fontSize: "12.5px", color: "#94A3B8" }}>
                {multi && noun ? `No ${noun} match “${query}”` : `No options match “${query}”`}
              </div>
            )}

            {multi && !q && unknown.length > 0 && (
              <div className="px-1.5 pb-1">
                <div className="px-2 pt-2 pb-1 uppercase" style={HEADING_STYLE}>Not in Omne</div>
                {unknown.map((v) => (
                  <CheckRow key={v} option={{ value: v }} checked onToggle={() => toggle(v)} />
                ))}
              </div>
            )}

            {visible.map((s) => (
              <div key={s.label || "_"} className={showSearch ? "px-1.5 pb-1" : undefined}>
                {s.label && <div className="px-2 pt-2 pb-1 uppercase" style={HEADING_STYLE}>{s.label}</div>}
                {s.options.map((o) =>
                  multi ? (
                    <CheckRow key={o.value} option={o} checked={isChecked(o.value)} onToggle={() => toggle(o.value)} />
                  ) : (
                    <ListRow key={o.value} option={o} selected={isChecked(o.value)} onPick={() => pick(o.value)} />
                  ),
                )}
              </div>
            ))}
          </div>

          {multi && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
              <span style={{ fontFamily: CELL_FONT, fontSize: "12px", color: "#64748B" }}>{selected.length} selected</span>
              <button
                type="button"
                onClick={() => {
                  commitMulti("down");
                  setOpen(false);
                }}
                className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
                style={{ fontFamily: CELL_FONT, fontSize: "12.5px", fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Label, then the description as a muted second line when there is one. */
function OptionText({ option }: { option: ChoiceOption }) {
  return (
    <span className="flex-1 min-w-0">
      <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: "13px", color: "#0F172A" }}>
        {labelOf(option)}
      </span>
      {option.description && (
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: "11.5px", color: "#64748B", marginTop: 1 }}>
          {option.description}
        </span>
      )}
    </span>
  );
}

function ListRow({ option, selected, onPick }: { option: ChoiceOption; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex items-center justify-between gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${selected ? "bg-[#F1F5F9]" : "hover:bg-[#F8FAFC]"}`}
      style={{ fontFamily: CELL_FONT }}
    >
      <OptionText option={option} />
      {selected && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
    </button>
  );
}

function CheckRow({ option, checked, onToggle }: { option: ChoiceOption; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full min-h-9 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer hover:bg-[#F8FAFC]"
      style={{ fontFamily: CELL_FONT }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center shrink-0 size-4 rounded-[4px] border transition-colors"
        style={checked ? { backgroundColor: "#0A77FF", borderColor: "#0A77FF" } : { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1" }}
      >
        {checked && <Check className="size-3" strokeWidth={3} style={{ color: "#FFFFFF" }} />}
      </span>
      <OptionText option={option} />
    </button>
  );
}
