/* Physical Inventory's Import list picker (your-invoice-mate
 * import-adjustment/cells/ListCellPicker.tsx), ported for the Data Imports
 * Physical Inventory tabs. Its shell is this repo's own Data Imports list
 * editor (import-review/CellFieldDropdowns.tsx OptionsCellDropdown): a cell
 * trigger with a chevron, a panel with a focused search on top, uppercase
 * section labels, option rows with a check mark, and a footer with
 * "n selected" and the blue Done button. Physical Inventory's content sits
 * inside it: a sub-line per option, a quantity badge, and an optional row
 * action above the footer (Create New LOT, a custom reason).
 *
 * Single select: clicking a row selects it; Done or Enter commits; Esc cancels;
 * a click outside cancels. Arrow keys move the highlight, Tab commits the
 * current selection and moves to the next cell. */

import { useMemo, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { CellNavDir } from "../registry";

const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";
/* role-zen cells use the app font. */
const CELL_FONT = "inherit";

export interface PickerOption {
  value: string;
  label: string;
  /** Second line under the label. */
  sub?: string;
  /** Right-aligned badge (a quantity, a "New" marker). */
  badge?: string;
  /** Section the option is listed under. */
  group?: string;
}

export interface PickerAction {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
}

export function ListCellPicker({
  value,
  options,
  searchPlaceholder,
  groupOrder,
  defaultGroupLabel,
  action,
  onCommit,
  onCancel,
  width = 288,
}: {
  value: string;
  options: PickerOption[];
  searchPlaceholder: string;
  /** Section order; options in other groups follow in first-seen order. */
  groupOrder?: string[];
  /** Label for options without a group (e.g. "LOTS"). */
  defaultGroupLabel?: string;
  /** Row action pinned above the footer. */
  action?: PickerAction;
  onCommit: (next: string, dir?: CellNavDir) => void;
  onCancel: () => void;
  width?: number;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const initial = options.find((o) => o.value.toLowerCase() === value.trim().toLowerCase())?.value ?? "";
  const [selected, setSelected] = useState<string>(initial);
  const finalized = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const finalize = (mode: "commit" | "cancel", next: string, dir: CellNavDir = "down") => {
    if (finalized.current) return;
    finalized.current = true;
    if (mode === "cancel") onCancel();
    else onCommit(next, dir);
  };
  const commitSelected = (dir: CellNavDir = "down") => {
    /* Nothing picked: Done keeps what the cell had, as a cancel does. */
    if (!selected) finalize("cancel", value);
    else finalize("commit", selected, dir);
    setOpen(false);
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q)) : options),
    [options, q],
  );
  const sections = useMemo(() => {
    const order: string[] = [];
    const by = new Map<string, PickerOption[]>();
    for (const o of filtered) {
      const g = o.group ?? defaultGroupLabel ?? "";
      if (!by.has(g)) { by.set(g, []); order.push(g); }
      by.get(g)!.push(o);
    }
    const ranked = groupOrder ? [...groupOrder.filter((g) => by.has(g)), ...order.filter((g) => !groupOrder.includes(g))] : order;
    return ranked.map((g) => ({ label: g, items: by.get(g)! }));
  }, [filtered, groupOrder, defaultGroupLabel]);
  const flat = sections.flatMap((s) => s.items);
  const [hi, setHi] = useState(() => Math.max(0, flat.findIndex((o) => o.value === initial)));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      /* Enter on a highlighted row that is not the selection selects it first;
         Enter on the selection commits. */
      const target = flat[hi];
      if (target && target.value !== selected) setSelected(target.value);
      else commitSelected("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitSelected(e.shiftKey ? "left" : "right");
    }
  };

  let rowIndex = -1;
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) finalize("cancel", value);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
          style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
        >
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: selected ? "#1E293B" : "#94A3B8" }}>
            {selected ? options.find((o) => o.value === selected)?.label ?? selected : "- Select -"}
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
          className={`${PANEL_CLASS} flex flex-col`}
          style={{ width }}
          onEscapeKeyDown={() => finalize("cancel", value)}
          onKeyDown={onKeyDown}
        >
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0A77FF] focus-within:bg-white transition-colors">
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHi(0); }}
                placeholder={searchPlaceholder}
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

          <div ref={listRef} className="max-h-[248px] overflow-y-auto py-1.5 px-1.5">
            {flat.length === 0 && (
              <div className="px-3 py-6 text-center" style={{ fontFamily: CELL_FONT, fontSize: "12.5px", color: "#94A3B8" }}>
                No options match “{query}”
              </div>
            )}
            {sections.map((section) => (
              <div key={section.label || "_"}>
                {section.label && (
                  <div
                    className="px-2 pt-2 pb-1 uppercase tracking-wide"
                    style={{ fontFamily: CELL_FONT, fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}
                  >
                    {section.label}
                  </div>
                )}
                {section.items.map((o) => {
                  rowIndex += 1;
                  const idx = rowIndex;
                  const checked = o.value === selected;
                  const highlighted = idx === hi;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => { setSelected(o.value); setHi(idx); }}
                      onMouseEnter={() => setHi(idx)}
                      className="flex items-center justify-between gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
                      style={{
                        fontFamily: CELL_FONT, fontSize: "13px", color: "#0F172A",
                        backgroundColor: checked ? "#F1F5F9" : highlighted ? "#F8FAFC" : "transparent",
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{o.label}</span>
                        {o.sub && (
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: "11.5px", color: "#64748B", marginTop: 1 }}>
                            {o.sub}
                          </span>
                        )}
                      </span>
                      {o.badge && (
                        <span
                          className="shrink-0 inline-flex items-center px-1.5 h-[18px] rounded-full"
                          style={{ fontSize: "10.5px", fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569" }}
                        >
                          {o.badge}
                        </span>
                      )}
                      {checked && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {action && (
            <div className="px-1.5 pb-1.5">
              <button
                type="button"
                onClick={() => { finalized.current = true; setOpen(false); action.onSelect(); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer hover:bg-[#EDF4FF]"
                style={{ fontFamily: CELL_FONT, fontSize: "13px", fontWeight: 500, color: "#0A77FF" }}
              >
                {action.icon}
                {action.label}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
            <span style={{ fontFamily: CELL_FONT, fontSize: "12px", color: "#64748B" }}>{selected ? 1 : 0} selected</span>
            <button
              type="button"
              onClick={() => commitSelected("down")}
              className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
              style={{ fontFamily: CELL_FONT, fontSize: "12.5px", fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
