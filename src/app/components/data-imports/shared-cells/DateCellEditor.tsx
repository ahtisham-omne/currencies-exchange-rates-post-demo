/* The date cell of every Data Imports grid (review modal and import record
 * page): the cell itself is the input, with a calendar icon at its right edge.
 * No bordered "Pick a date" field inside the cell.
 *
 * Type it:  07/02/2026, 7/2/2026, 07022026 (also 07-02-2026, 07.02.2026 or
 *           2026-07-02). The value lands in the column's own file format.
 * Pick it:  the icon opens the shared calendar under the cell; a day commits.
 *
 * Enter commits and moves down, Tab right (Shift+Tab left), Escape cancels,
 * leaving the cell commits. Text that is not a real date is kept as typed, so
 * the cell's validation message can say what is wrong with it. */
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DateCalendarPopover } from "../sheet-import/cells/date-picker-field";

type NavDir = "up" | "down" | "left" | "right";

/** How the column writes a date: Quotes / Sales Orders "MM/DD/YYYY", the
 *  Users template's Date of Birth "YYYY-MM-DD". */
export type DateCellFormat = "mdy" | "iso";

const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";

function valid(y: number, m: number, d: number): Date | null {
  if (y < 1000 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Read a typed or stored date. Month first for anything that is not ISO. */
export function parseCellDate(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (m) return valid(+m[3], +m[1], +m[2]);
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(v);
  if (m) return valid(+m[3], +m[1], +m[2]);
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatCellDate(d: Date, format: DateCellFormat): string {
  return format === "iso"
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/** Typed text → the column's format, or the text untouched when it is not a date. */
export function normalizeCellDate(raw: string, format: DateCellFormat): string {
  const d = parseCellDate(raw);
  return d ? formatCellDate(d, format) : raw.trim();
}

export function DateCellEditor({
  value,
  format = "mdy",
  framed = false,
  onCommit,
  onCancel,
}: {
  value: string;
  format?: DateCellFormat;
  /** Draw the 2px blue editing frame here, for grids whose cell does not. */
  framed?: boolean;
  onCommit: (next: string, dir?: NavDir) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finalizedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finalize = (mode: "commit" | "cancel", next?: string, dir?: NavDir) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (mode === "cancel") onCancel();
    else onCommit(normalizeCellDate(next ?? text, format), dir);
  };

  return (
    /* The editor never sizes the column: a bare <input> asks for about 20
       characters, which made an auto-layout table widen the whole column the
       moment the cell opened. size=1 and w-0 let it take only the cell. */
    <div
      ref={wrapRef}
      className="relative flex items-center w-full h-full bg-white"
      style={framed ? { boxShadow: "inset 0 0 0 2px #0A77FF", minHeight: 34 } : undefined}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        size={1}
        value={text}
        placeholder={format === "iso" ? "YYYY-MM-DD" : "MM/DD/YYYY"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finalize("commit", text, "down");
          } else if (e.key === "Tab") {
            e.preventDefault();
            finalize("commit", text, e.shiftKey ? "left" : "right");
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (calendarOpen) setCalendarOpen(false);
            else finalize("cancel");
          }
        }}
        onBlur={() => {
          /* Focus leaves for the calendar while it is open; commit only when
             the person has really left the cell. */
          if (!calendarOpen) finalize("commit");
        }}
        className="flex-1 w-0 min-w-0 h-full bg-transparent outline-none"
        style={{ fontFamily: CELL_FONT, fontSize: "13px", color: "#1E293B", padding: "0 2px 0 12px" }}
      />
      <button
        type="button"
        aria-label="Pick a date"
        title="Pick a date"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setCalendarOpen((o) => !o)}
        className="group shrink-0 flex items-center justify-center h-6 w-6 mr-1 rounded-md cursor-pointer transition-colors hover:bg-[#EFF6FF]"
      >
        <CalendarDays className="w-3.5 h-3.5 transition-colors" style={{ color: calendarOpen ? "#0A77FF" : "#94A3B8" }} />
      </button>
      {calendarOpen && (
        <DateCalendarPopover
          anchorRef={wrapRef}
          value={parseCellDate(text) ?? undefined}
          onPick={(d) => {
            setCalendarOpen(false);
            finalize("commit", formatCellDate(d, format), "down");
          }}
          onClose={() => {
            setCalendarOpen(false);
            finalize("commit");
          }}
        />
      )}
    </div>
  );
}
