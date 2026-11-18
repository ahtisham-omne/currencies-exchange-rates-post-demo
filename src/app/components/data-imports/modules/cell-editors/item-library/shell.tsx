/* Shared shell + atoms for the Item Library cell editors.
 *
 * EditorPopover mounts already open (the grid only renders an editor while
 * the cell is being edited), portals its panel to <body> and carries the
 * `data-cell-dropdown` marker the review grid's outside-click handler
 * whitelists, the same contract as import-review/CellFieldDropdowns.tsx.
 * useFinalize makes commit / cancel fire exactly once, whichever of click,
 * Enter, Tab, Escape or dismiss gets there first.
 *
 * The atoms are the Create New Item flow's own controls (configAtoms.tsx in
 * nimble-palette: RadioOption, ToggleSwitch, CheckboxControl, the UOM
 * abbreviation badge and Standard / Custom pill), in UAC hex tokens. */

import { useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { uomAbbrev, uomType } from "../../categories/uom.mjs";
import type { CellNavDir } from "../registry";

export const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";
export const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

/** `dir` undefined moves down like the other grid editors; null commits in
 *  place (overlays, where re-opening on the next row would be jarring). */
export type Finalize = (mode: "commit" | "cancel", next?: string, dir?: CellNavDir | null) => void;

export function useFinalize(
  initialValue: string,
  onCommit: (next: string, dir?: CellNavDir) => void,
  onCancel: () => void,
): Finalize {
  const done = useRef(false);
  return (mode, next, dir) => {
    if (done.current) return;
    done.current = true;
    if (mode === "cancel") onCancel();
    else if (dir === null) onCommit(next ?? initialValue);
    else onCommit(next ?? initialValue, dir ?? "down");
  };
}

/** Tab / Shift+Tab commit the editor's current value and move sideways,
 *  like the Users CellInput. */
export function tabDir(e: React.KeyboardEvent): CellNavDir | null {
  if (e.key !== "Tab") return null;
  return e.shiftKey ? "left" : "right";
}

/* ─── Trigger that fills the editing cell ─── */
export function CellTrigger({ children, placeholder = "- Select -" }: { children?: ReactNode; placeholder?: string }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
      >
        <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: empty ? "#94A3B8" : "#1E293B" }}>
          {empty ? placeholder : children}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

/* ─── Popover frame ─── */
export function EditorPopover({
  trigger,
  width,
  onDismiss,
  onEscape,
  onKeyDown,
  autoFocusContent = true,
  children,
}: {
  trigger: ReactNode;
  width: number;
  /** Outside click / focus loss. */
  onDismiss: () => void;
  onEscape: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Focus the panel itself on open (lists); false when a child input autofocuses. */
  autoFocusContent?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onDismiss();
      }}
    >
      {trigger}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={contentRef}
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          tabIndex={-1}
          className={`${PANEL_CLASS} flex flex-col`}
          style={{ width, fontFamily: CELL_FONT, maxHeight: "min(560px, var(--radix-popover-content-available-height))" }}
          onEscapeKeyDown={() => onEscape()}
          onOpenAutoFocus={(e) => {
            if (!autoFocusContent) return;
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onKeyDown={onKeyDown}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Arrow-key highlight over a flat option list; Enter picks. */
export function useListNav(count: number, initial: number) {
  const [active, setActive] = useState(Math.max(0, Math.min(initial, count - 1)));
  const onArrow = (e: React.KeyboardEvent): boolean => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(1, count));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + Math.max(1, count)) % Math.max(1, count));
      return true;
    }
    return false;
  };
  return { active, setActive, onArrow };
}

/* ─── Panel pieces ─── */
export function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-3.5 pt-3 pb-2 border-b border-[#F1F5F9] shrink-0">
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{title}</div>
      {hint && <div style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search...",
  autoFocus = true,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="p-2 border-b border-[#F1F5F9] shrink-0">
      <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0A77FF] focus-within:bg-white transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{ fontFamily: CELL_FONT, fontSize: "13px", color: "#1E293B" }}
        />
        {value && (
          <button type="button" onClick={() => onChange("")} className="shrink-0 cursor-pointer" aria-label="Clear search">
            <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        )}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 uppercase" style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}>
      {children}
    </div>
  );
}

export function PanelFooter({ left, onDone, doneLabel = "Done" }: { left?: ReactNode; onDone: () => void; doneLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9] shrink-0">
      <span style={{ fontSize: "12px", color: "#64748B" }}>{left}</span>
      <button
        type="button"
        onClick={onDone}
        className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30"
        style={{ fontSize: "12.5px", fontWeight: 600 }}
      >
        {doneLabel}
      </button>
    </div>
  );
}

export function EmptyResults({ query }: { query: string }) {
  return (
    <div className="px-3 py-6 text-center" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
      No results match “{query}”
    </div>
  );
}

/* ─── Home atoms ─── */

/** RadioOption's dot (Lot ID Assignment, Selling Scope, PO rules). */
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center bg-white transition-all"
      style={{ width: 18, height: 18, border: selected ? "2px solid #3B82F6" : "1.5px solid #D1D5DB" }}
    >
      {selected && <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
    </span>
  );
}

/** CheckboxControl: flat 16px box, primary fill when checked. */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className="shrink-0 flex items-center justify-center transition-colors"
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        border: checked ? "1.5px solid #0A77FF" : "1.5px solid #CBD5E1",
        backgroundColor: checked ? "#0A77FF" : "#FFFFFF",
      }}
    >
      {checked && <Check className="text-white" style={{ width: 12, height: 12 }} strokeWidth={3} />}
    </span>
  );
}

/** ToggleSwitch: the 40 x 22 Category-literal switch. */
export function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      className="relative shrink-0 transition-colors inline-block"
      style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: checked ? "#0A77FF" : "#CBD5E1" }}
    >
      <span
        className="absolute bg-white rounded-full shadow-sm"
        style={{ width: 18, height: 18, top: 2, left: checked ? 20 : 2, transition: "left 0.15s ease" }}
      />
    </span>
  );
}

/** The 26px unit abbreviation tile used by the UOM pickers. */
export function UnitBadge({ unit, muted = false }: { unit: string; muted?: boolean }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width: 26, height: 26, borderRadius: 6, background: muted ? "#FFFFFF" : "#EDF4FF", border: muted ? "1px solid #E2E8F0" : undefined }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: muted ? "#475569" : "#0A77FF", letterSpacing: 0.4 }}>
        {unit ? uomAbbrev(unit) : "-"}
      </span>
    </span>
  );
}

/** UomTypePill: Standard / Custom badge. */
export function UomTypePill({ unit }: { unit: string }) {
  const t = uomType(unit);
  if (!t) return null;
  const std = t === "standard";
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 6px",
        lineHeight: 1.2,
        backgroundColor: std ? "#F3F4F6" : "#EFF6FF",
        color: std ? "#4B5563" : "#2563EB",
      }}
    >
      {std ? "Standard" : "Custom"}
    </span>
  );
}

/** Initials avatar: the home InitialAvatar (tinted circle) or a solid colour tile. */
export function Initials({ text, bg, color, size = 28, square = false }: { text: string; bg: string; color: string; size?: number; square?: boolean }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: square ? 6 : "50%",
        background: bg,
        color,
        fontSize: size >= 36 ? 12 : 10,
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      {text}
    </span>
  );
}
