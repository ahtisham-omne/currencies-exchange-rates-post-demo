/* Inline cell editors for the review grid and the record page, dispatched by
 * the spec column kind (port of role-zen's CellInput + CellFieldDropdowns:
 * text input, SimpleCellDropdown, RolesCellDropdown). All popovers mount
 * already open, portal to body with `data-cell-dropdown` (the grids'
 * outside-click whitelist) and sit at z 320. Single selects cancel on
 * click-outside, the multi select commits its accumulated picks. */
import { useEffect, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CELL_FONT } from "./CellIssueTooltip";
import { DESCRIPTION_MAX, joinList, matchOption, splitList, type SpecColumn } from "./spec";
import { LongTextFieldEditor, TagsFieldEditor } from "./fieldEditors";

export type CommitDir = "down" | "right" | "left";

export const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

export interface CellEditorProps {
  column: SpecColumn;
  value: string;
  onCommit: (next: string, dir?: CommitDir) => void;
  onCancel: () => void;
  /** Extra values offered by a multi-select (the tags already in the file). */
  extraOptions?: string[];
}

/* ─── Dispatch ─── */

export function CellInput(props: CellEditorProps) {
  const { column } = props;
  /* Tags and Description edit on the Data Imports panels (fieldEditors.tsx). */
  if (column.key === "tags") {
    return <TagsFieldEditor initialValue={props.value} onCommit={props.onCommit} onCancel={props.onCancel} entityPlural="items" />;
  }
  if (column.key === "description") {
    return <LongTextFieldEditor initialValue={props.value} onCommit={props.onCommit} onCancel={props.onCancel} label={column.label} maxLength={DESCRIPTION_MAX} />;
  }
  switch (column.kind) {
    case "yesno":
      return <SimpleCellDropdown {...props} options={column.options.length ? column.options : ["Yes", "No"]} />;
    case "select":
      return <SimpleCellDropdown {...props} options={column.options} groups={column.optionsGroups} />;
    case "multiselect":
      return <MultiSelectCellDropdown {...props} />;
    case "number":
      return <TextCellInput {...props} inputMode="decimal" />;
    default:
      return <TextCellInput {...props} placeholder={column.kind === "date" ? "YYYY-MM-DD" : undefined} />;
  }
}

/* ─── Text ─── */

function TextCellInput({
  value,
  onCommit,
  onCancel,
  placeholder,
  inputMode,
}: CellEditorProps & { placeholder?: string; inputMode?: "decimal" }) {
  const [draft, setDraft] = useState(value);
  const finalizedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = (dir?: CommitDir) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    onCommit(draft, dir);
  };
  const cancel = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit("down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit(e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      }}
      onBlur={() => commit()}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        fontFamily: CELL_FONT,
        fontSize: "13px",
        color: "#1E293B",
        padding: "0 12px",
      }}
    />
  );
}

/* ─── Shared trigger ─── */

function CellTrigger({ label, placeholder }: { label: string; placeholder: string }) {
  const empty = label.trim() === "";
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
      >
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: empty ? "#94A3B8" : "#1E293B" }}>
          {empty ? placeholder : label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

function SearchField({
  query,
  onChange,
  placeholder,
  autoFocus,
}: {
  query: string;
  onChange: (q: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="p-2 border-b border-[#F1F5F9]">
      <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0A77FF] focus-within:bg-white transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{ fontSize: "13px", color: "#1E293B", fontFamily: CELL_FONT }}
        />
        {query && (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="shrink-0 cursor-pointer">
            <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="px-2 pt-2 pb-1 uppercase tracking-wide" style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}>
      {label}
    </div>
  );
}

/* ─── Single select ─── */

interface Group {
  label: string;
  options: string[];
}

function SimpleCellDropdown({
  column,
  value,
  onCommit,
  onCancel,
  options,
  groups,
}: CellEditorProps & { options: string[]; groups?: Group[] }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const finalizedRef = useRef(false);
  const current = matchOption(value, options);
  const searchable = options.length > 10;

  const sections = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const base: Group[] = groups && groups.length ? groups : [{ label: "", options }];
    return base
      .map((g) => ({ label: g.label, options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options }))
      .filter((g) => g.options.length > 0);
  }, [groups, options, query]);

  const cancel = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setOpen(false);
    onCancel();
  };
  const pick = (o: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setOpen(false);
    onCommit(o, "down");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => !o && cancel()}>
      <CellTrigger label={current ?? ""} placeholder="- Select -" />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            if (!searchable) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            e.stopPropagation();
            cancel();
          }}
          onInteractOutside={cancel}
          className={`${PANEL_CLASS} ${searchable ? "w-[260px]" : "min-w-[180px]"} flex flex-col`}
          style={{ fontFamily: CELL_FONT }}
        >
          {searchable && <SearchField query={query} onChange={setQuery} placeholder={`Search ${column.label.toLowerCase()}`} autoFocus />}
          <div className="overflow-y-auto p-1.5" style={{ maxHeight: 248, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
            {sections.length === 0 && (
              <div className="px-3 py-6 text-center" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
                No options match &ldquo;{query}&rdquo;
              </div>
            )}
            {sections.map((g) => (
              <div key={g.label || "_"} className="pb-1">
                {g.label && <SectionHeading label={g.label} />}
                {g.options.map((o) => {
                  const selected = o === current;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => pick(o)}
                      className="flex items-center justify-between gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer hover:bg-[#F8FAFC]"
                      style={{ fontSize: "13px", color: "#0F172A", backgroundColor: selected ? "#F1F5F9" : undefined }}
                    >
                      <span className="truncate">{o}</span>
                      {selected && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/* ─── Multi select ─── */

function MultiSelectCellDropdown({ column, value, onCommit, onCancel, extraOptions = [] }: CellEditorProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const finalizedRef = useRef(false);
  const allowCustom = column.options.length === 0;
  const noun = column.label.toLowerCase();

  const catalog = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of [...column.options, ...extraOptions]) {
      const k = o.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, o.trim());
    }
    return seen;
  }, [column.options, extraOptions]);

  const [selected, setSelected] = useState<string[]>(() => {
    const out: string[] = [];
    for (const v of splitList(value, catalog)) {
      const canon = catalog.get(v.toLowerCase()) ?? (allowCustom ? v : null);
      if (canon && !out.some((x) => x.toLowerCase() === canon.toLowerCase())) out.push(canon);
    }
    return out;
  });

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const base: Group[] =
      column.optionsGroups && column.optionsGroups.length
        ? column.optionsGroups
        : allowCustom
          ? [
              { label: `${column.label} in this file`, options: [...catalog.values()].sort((a, b) => a.localeCompare(b)) },
            ]
          : [{ label: column.label, options: column.options }];
    const filtered = base
      .map((g) => ({ label: g.label, options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options }))
      .filter((g) => g.options.length > 0);
    // Custom picks not in the catalog live in their own section.
    const custom = selected.filter((s) => !catalog.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)));
    if (custom.length) filtered.unshift({ label: "Selected", options: custom });
    return filtered;
  }, [column, allowCustom, catalog, query, selected]);

  const isSelected = (o: string) => selected.some((s) => s.toLowerCase() === o.toLowerCase());
  const toggle = (o: string) => {
    setSelected((prev) => (prev.some((s) => s.toLowerCase() === o.toLowerCase()) ? prev.filter((s) => s.toLowerCase() !== o.toLowerCase()) : [...prev, o]));
  };

  const commit = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setOpen(false);
    onCommit(joinList(selected), "down");
  };
  const cancel = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setOpen(false);
    onCancel();
  };

  const trimmedQuery = query.trim();
  const canAddCustom = allowCustom && trimmedQuery !== "" && ![...catalog.keys()].includes(trimmedQuery.toLowerCase()) && !isSelected(trimmedQuery);
  const nothingToShow = groups.length === 0 && !canAddCustom;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => !o && commit()}>
      <CellTrigger label={joinList(selected)} placeholder={`- Select ${noun} -`} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          onEscapeKeyDown={(e) => {
            e.stopPropagation();
            cancel();
          }}
          onInteractOutside={commit}
          className={`${PANEL_CLASS} w-[288px] flex flex-col`}
          style={{ fontFamily: CELL_FONT }}
        >
          <SearchField query={query} onChange={setQuery} placeholder={`Search ${noun}`} autoFocus />
          <div className="overflow-y-auto py-1.5" style={{ maxHeight: 248, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
            {canAddCustom && (
              <div className="px-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    toggle(trimmedQuery);
                    setQuery("");
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[#EFF6FF] text-left"
                  style={{ fontSize: "13px", color: "#0A77FF", fontWeight: 500 }}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Add &ldquo;{trimmedQuery}&rdquo;</span>
                </button>
              </div>
            )}
            {nothingToShow && (
              <div className="px-3 py-6 text-center" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
                No {noun} match &ldquo;{query}&rdquo;
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label} className="px-1.5 pb-1">
                <SectionHeading label={g.label} />
                {g.options.map((o) => {
                  const checked = isSelected(o);
                  return (
                    <div key={o} className="group flex items-center gap-1 w-full px-2 py-1.5 rounded-lg transition-colors hover:bg-[#F8FAFC]">
                      <button type="button" onClick={() => toggle(o)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="h-4 w-4 rounded-[4px] data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(o);
                          }}
                        />
                        <span className="truncate" style={{ fontSize: "13px", fontWeight: 450, color: "#0F172A" }}>
                          {o}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
            <span style={{ fontSize: "12px", color: "#64748B" }}>{selected.length} selected</span>
            <button
              type="button"
              onClick={commit}
              className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
              style={{ fontSize: "12.5px", fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
