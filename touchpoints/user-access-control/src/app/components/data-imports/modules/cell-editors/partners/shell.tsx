/* Chrome shared by the Partners / Partner Group cell pickers.
 *
 * Every picker mounts already open (the cell only renders it while editing),
 * portals its panel to <body> and carries `data-cell-dropdown`, the marker the
 * review grid's outside-click handler whitelists, exactly like the Users
 * License Type / Assigned Roles dropdowns in import-review/CellFieldDropdowns.
 *
 * Commit contract (same as the generic editors):
 *   single pick   click or Enter commits and moves down
 *   multi pick    Done or Enter commits; dismissing commits the picks so far
 *   Tab / Shift+Tab commits and moves right / left
 *   Esc           cancels, the cell keeps its value */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { CellNavDir } from "../registry";

export const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";
export const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

/** Commit / cancel exactly once per opening, whatever closes the picker first.
 *  `finished` closes the panel; the grid may keep the same cell in edit mode
 *  (the review modal does when there is no row below to move to), so the
 *  picker stays mounted and `reopen` re-arms it when the user opens it again. */
export function useFinalize(onCommit: (next: string, dir?: CellNavDir) => void, onCancel: () => void) {
  const done = useRef(false);
  const [finished, setFinished] = useState(false);
  const commit = useCallback(
    (next: string, dir: CellNavDir = "down") => {
      if (done.current) return;
      done.current = true;
      setFinished(true);
      onCommit(next, dir);
    },
    [onCommit],
  );
  const cancel = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setFinished(true);
    onCancel();
  }, [onCancel]);
  const reopen = useCallback(() => {
    done.current = false;
    setFinished(false);
  }, []);
  return { commit, cancel, finished, reopen };
}

/** What every picker hands its shell so it can close and re-arm. */
export interface FinalizeState {
  finished: boolean;
  reopen: () => void;
}

/** Tab / Shift+Tab / Enter handling for a panel. `current` is the value to commit. */
export function panelKeys(
  e: React.KeyboardEvent,
  current: () => string,
  commit: (next: string, dir?: CellNavDir) => void,
  opts: { enterCommits?: boolean } = {},
) {
  if (e.key === "Tab") {
    e.preventDefault();
    commit(current(), e.shiftKey ? "left" : "right");
  } else if (e.key === "Enter" && opts.enterCommits) {
    e.preventDefault();
    commit(current(), "down");
  }
}

/** The button that fills the editing cell and anchors the popover. */
function CellTrigger({ children, placeholder }: { children?: ReactNode; placeholder: string }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
      >
        <span className="flex items-center gap-1 min-w-0 overflow-hidden whitespace-nowrap" style={{ color: empty ? "#94A3B8" : "#1E293B" }}>
          {empty ? placeholder : children}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

/** Anchored popover picker. `onDismiss` runs when it closes without an explicit pick. */
export function CellPopover({
  fin,
  trigger,
  placeholder = "- Select -",
  width,
  onDismiss,
  onEscape,
  onKeyDown,
  children,
  className = "",
}: {
  fin: FinalizeState;
  trigger?: ReactNode;
  placeholder?: string;
  width: number;
  onDismiss: () => void;
  onEscape: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  const open = !fin.finished;
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) fin.reopen();
        else onDismiss();
      }}
    >
      <CellTrigger placeholder={placeholder}>{trigger}</CellTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className={`${PANEL_CLASS} flex flex-col ${className}`}
          style={{ width, fontFamily: CELL_FONT, maxHeight: "min(560px, var(--radix-popover-content-available-height))" }}
          onEscapeKeyDown={onEscape}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Full-screen picker for the card grids (partner groups). The cell keeps a
 *  static trigger underneath so the grid row does not jump. */
export function CellOverlay({
  fin,
  trigger,
  placeholder = "- Select -",
  title,
  subtitle,
  onDismiss,
  onEscape,
  onKeyDown,
  footer,
  children,
}: {
  fin: FinalizeState;
  trigger?: ReactNode;
  placeholder?: string;
  title: string;
  subtitle: string;
  onDismiss: () => void;
  onEscape: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fin.finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onEscape, fin.finished]);
  const empty = trigger === null || trigger === undefined || trigger === "";
  return (
    <>
      <button
        type="button"
        onClick={() => { if (fin.finished) fin.reopen(); }}
        className="flex items-center justify-between gap-1.5 w-full h-full text-left cursor-pointer outline-none"
        style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: empty ? "#94A3B8" : "#1E293B" }}>
          {empty ? placeholder : trigger}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
      {!fin.finished && createPortal(
        <div
          data-cell-dropdown
          className="fixed inset-0 z-[330] flex items-start justify-center p-6 sm:p-10"
          style={{ fontFamily: CELL_FONT }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onDismiss();
          }}
        >
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] pointer-events-none" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            onKeyDown={onKeyDown}
            className="relative w-full max-w-[920px] max-h-full flex flex-col bg-[#FAFBFC] border border-[#E2E8F0] rounded-2xl shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)] overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 bg-white border-b border-[#EEF2F6]">
              <div className="min-w-0">
                <h4 className="text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>{title}</h4>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onEscape}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
            <div className="flex items-center justify-between gap-2 px-5 py-3 bg-white border-t border-[#EEF2F6]">{footer}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus = true,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
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
  );
}

/** "N selected" + Clear + Done footer used by every multi-select picker. */
export function MultiFooter({ count, onClear, onDone }: { count: number; onClear: () => void; onDone: () => void }) {
  return (
    <>
      <span className="flex items-center gap-2" style={{ fontSize: "12px", color: "#64748B" }}>
        {count} selected
        {count > 0 && (
          <button type="button" onClick={onClear} className="text-[#0A77FF] hover:underline cursor-pointer" style={{ fontWeight: 500 }}>
            Clear
          </button>
        )}
      </span>
      <button
        type="button"
        onClick={onDone}
        className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
        style={{ fontSize: "12.5px", fontWeight: 600 }}
      >
        Done
      </button>
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 uppercase" style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}>
      {children}
    </div>
  );
}

/** Round radio used by the single-pick cards (credit enforcement). */
export function Radio({ on, color = "#0A77FF" }: { on: boolean; color?: string }) {
  return (
    <span
      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
      style={{ borderColor: on ? `${color}99` : "#CBD5E1" }}
    >
      {on && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
    </span>
  );
}

/** Square checkbox mark used by the multi-pick cards. */
export function CheckMark({ on, color = "#0A77FF" }: { on: boolean; color?: string }) {
  return (
    <span
      className="w-[18px] h-[18px] rounded flex items-center justify-center border-[1.5px] shrink-0 transition-all"
      style={{ borderColor: on ? color : "#CBD5E1", backgroundColor: on ? color : "#FFFFFF" }}
    >
      {on && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
    </span>
  );
}

/** Keyboard highlight for a single-pick list: ArrowUp / ArrowDown move, Enter picks. */
export function useListHighlight(count: number, initial = 0) {
  const [index, setIndex] = useState(Math.max(0, Math.min(initial, count - 1)));
  useEffect(() => {
    setIndex((i) => (count === 0 ? 0 : Math.min(i, count - 1)));
  }, [count]);
  const onKeyDown = (e: React.KeyboardEvent, pick: (i: number) => void) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(count - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && count > 0) {
      e.preventDefault();
      pick(index);
    }
  };
  return { index, setIndex, onKeyDown };
}

/** Case-insensitive membership helpers for pipe lists. */
export const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export function toggleIn(list: string[], value: string): string[] {
  return list.some((v) => sameText(v, value)) ? list.filter((v) => !sameText(v, value)) : [...list, value];
}
export function hasIn(list: string[], value: string): boolean {
  return list.some((v) => sameText(v, value));
}

/** Initials for an avatar tile. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Picked values the picker's list does not know (a typo or a name missing
 *  from Omne): shown as removable chips so nothing is dropped silently. */
export function UnknownPicks({
  picked,
  known,
  onRemove,
}: {
  picked: string[];
  known: readonly string[];
  onRemove: (value: string) => void;
}) {
  const unknown = picked.filter((v) => !hasIn([...known], v));
  if (unknown.length === 0) return null;
  return (
    <div className="px-2.5 pt-2 pb-1 flex flex-wrap items-center gap-1.5 border-b border-[#F1F5F9]">
      <span className="text-[10.5px] uppercase" style={{ fontWeight: 700, color: "#B45309", letterSpacing: "0.04em" }}>Not in Omne</span>
      {unknown.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border text-[12px]"
          style={{ fontWeight: 500, backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }}
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            aria-label={`Remove ${v}`}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
