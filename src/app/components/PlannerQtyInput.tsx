/* ═══════════════════════════════════════════════════════════════
   PlannerQtyInput — the shared, freely-editable qty field
   ───────────────────────────────────────────────────────────────
   One component for BOTH the vendor drawer (PlannerVendorPanel) and
   the graph add-chooser (PlannerAddChooser) so the two can't drift.

   Fixes the controlled-`type="number"` editing bug: when a keystroke
   parses to the SAME number (e.g. typing a leading zero, "0120" → 120
   → 120), React skips updating the DOM, so the stray "0" sticks and the
   field can't be cleared. We hold a local TEXT buffer instead — the
   buyer can clear it to empty, strip a leading zero, and retype freely.
   The parsed value commits on every edit; an empty/short value is
   normalised to `floor` on blur. When the parent changes `value` for
   another reason (the +/- steppers), we re-sync the buffer — but only
   while the field isn't being edited, so typing is never clobbered.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";

export default function PlannerQtyInput({
  value,
  floor,
  baseUom,
  ariaLabel,
  focusClass,
  onCommit,
  readOnly = false,
}: {
  value: number;
  /** Lower bound applied on blur / when cleared (0 in the drawer so the row
      can be zeroed; MOQ in the chooser). NOT a typing cap — max is soft. */
  floor: number;
  baseUom: string;
  ariaLabel: string;
  /** Literal Tailwind focus-within class — must be static text for the JIT. */
  focusClass: string;
  onCommit: (n: number) => void;
  /** Snapshot-view read-only lock (buyer feedback 2026-07-20). When true,
      the input is not editable and edits (typing / blur) are suppressed. */
  readOnly?: boolean;
}) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  /* Mirror external changes (the +/- steppers) when not actively typing. */
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  return (
    <div
      className={`flex items-center gap-1 rounded-md border border-slate-200 px-1 transition-colors 2xl:px-1.5 ${focusClass}`}
    >
      <input
        type="text"
        inputMode="numeric"
        value={text}
        readOnly={readOnly}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => {
          if (readOnly) return;
          /* Digits only; drop a leading zero once another digit follows
             ("0120" → "120"), but keep a lone "0" and allow empty. */
          const raw = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
          setText(raw);
          if (raw !== "") onCommit(Math.round(Number(raw)));
        }}
        onBlur={() => {
          editing.current = false;
          if (readOnly) return;
          const n = text === "" ? floor : Math.max(floor, Math.round(Number(text) || floor));
          onCommit(n);
          setText(String(n));
        }}
        className={`w-10 bg-transparent py-0.5 text-center text-[13px] font-semibold text-slate-900 outline-none 2xl:w-12 2xl:py-1 2xl:text-sm ${
          readOnly ? "cursor-not-allowed opacity-70" : ""
        }`}
        aria-label={ariaLabel}
      />
      <span className="text-[9.5px] text-slate-400 2xl:text-[10px]">{baseUom}</span>
    </div>
  );
}
