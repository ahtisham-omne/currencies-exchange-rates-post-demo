/* The shell every special cell editor sits in (first built for Categories):
 * a trigger that fills the editing cell and a panel portalled below it, the
 * same contract as the Users cell dropdowns (import-review/CellFieldDropdowns.tsx).
 * The panel mounts open, carries `data-cell-dropdown` so the grids' outside-click
 * handlers leave it alone, and finalizes exactly once: a pick or Done
 * commits, Esc cancels, a click outside either commits the draft (editors
 * that build a value up) or cancels (single-pick lists). */

import { useCallback, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import type { CellNavDir } from "../modules/cell-editors/registry";

export const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

/* Home module (radiant-core-fusion ConfigureCategory) field chrome. */
export const FIELD_LABEL_STYLE: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#475569" };
export const FIELD_HINT_STYLE: React.CSSProperties = { fontSize: 11, color: "#94A3B8", lineHeight: 1.4 };

/** Finalize-once guard shared by every editor. */
export function useFinalize(onCommit: (next: string, dir?: CellNavDir) => void, onCancel: () => void) {
  const done = useRef(false);
  const commit = useCallback(
    (next: string, dir: CellNavDir = "down") => {
      if (done.current) return;
      done.current = true;
      onCommit(next, dir);
    },
    [onCommit],
  );
  const cancel = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCancel();
  }, [onCancel]);
  return { commit, cancel };
}

export function CellEditorPopover({
  display,
  placeholder = "- Select -",
  width,
  onDismiss,
  onEscape,
  onKeyDown,
  focusContent = false,
  children,
}: {
  /** What the cell shows while the panel is open; null shows the placeholder. */
  display: ReactNode | null;
  placeholder?: string;
  width: number;
  /** Click outside the panel. */
  onDismiss: () => void;
  onEscape: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Focus the panel itself (lists driven by arrow keys) rather than its first control. */
  focusContent?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onDismiss();
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
          style={{ padding: "0 10px 0 12px", fontSize: "13px" }}
        >
          <span className="flex-1 min-w-0 block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: display == null ? "#94A3B8" : "#1E293B" }}>
            {display ?? placeholder}
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
          tabIndex={-1}
          className={PANEL_CLASS}
          style={{ width }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onEscape();
            setOpen(false);
          }}
          onOpenAutoFocus={(e) => {
            if (!focusContent) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          onKeyDown={onKeyDown}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Panel heading: the home field label plus its hint line. */
export function PanelHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="px-3.5 pt-3 pb-2">
      <div style={FIELD_LABEL_STYLE}>{label}</div>
      {hint && <div style={{ ...FIELD_HINT_STYLE, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** Informational note inside a panel (e.g. a column that only applies conditionally). */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <div className="mx-3.5 mb-2 px-2.5 py-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB]" style={{ fontSize: 11.5, color: "#92400E", lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

export function PanelFooter({ left, onDone, doneLabel = "Done" }: { left?: ReactNode; onDone: () => void; doneLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
      <span style={{ fontSize: 12, color: "#64748B" }}>{left}</span>
      <button
        type="button"
        onClick={onDone}
        className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
        style={{ fontSize: 12.5, fontWeight: 600 }}
      >
        {doneLabel}
      </button>
    </div>
  );
}

/** Tab / Shift+Tab direction for the grids' cell navigation. */
export function tabDir(e: React.KeyboardEvent): CellNavDir {
  return e.shiftKey ? "left" : "right";
}

/** Arrow-key highlight over a fixed list of choices, Enter / Tab to pick. */
export function useChoiceKeys<T>(choices: readonly T[], initialIndex: number, pick: (choice: T, dir: CellNavDir) => void) {
  const [active, setActive] = useState(Math.max(0, initialIndex));
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive((i) => (i + 1) % choices.length);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => (i - 1 + choices.length) % choices.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (choices[active] !== undefined) pick(choices[active], "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (choices[active] !== undefined) pick(choices[active], tabDir(e));
    }
  };
  return { active, setActive, onKeyDown };
}
