import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { DatePickerField } from "@/app/components/quote-creation/date-picker-field";
import type { ColumnSpec } from "./importModel";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { TagsField } from "@/app/components/shared/EntityTagChip";
import { RepCellDropdown } from "./RepCellDropdown";
import { SetCellDropdown } from "./SetCellDropdown";
import { UomCellDropdown } from "./UomCellDropdown";

/**
 * What a cell turns into when you click it.
 *
 * Every column in this template is one of five things, and only one of them
 * is free text. Typing a payment term, a rep's email or a date into a bare
 * box asks the person importing to remember values that live in another
 * module, and then reports their typo back to them a second later. So the
 * cell opens whatever that column's own module already uses:
 *
 *   · a closed set (status, priority, type) → the module's own list
 *   · a unit of measure                     → the item-aware unit list
 *   · another module's record               → that module's picker, opened
 *                                             by the sheet (see `entity`
 *                                             handling in the review modal,
 *                                             which owns those overlays)
 *   · a date                                → the module's date picker
 *   · a number, or genuinely free prose     → an input, typed here
 *
 * Entity columns are not handled in this component because their pickers are
 * full-screen overlays owned by the review modal; it routes a click on those
 * cells straight to them. Everything else is local, and lives here.
 */
export function CellEditor({
  column,
  value,
  onCommit,
  onCancel,
}: {
  column: ColumnSpec;
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  /* A closed set is a list, never a text box. */
  if (column.set) {
    return (
      <SetCellDropdown
        value={value}
        options={column.set}
        label={column.label.replace(/^Line \/ /, "")}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  /* People are picked in the cell, on the module's own selector. */
  if (column.entity === "user") {
    return <RepCellDropdown value={value} multiple={!!column.list} onCommit={onCommit} onCancel={onCancel} />;
  }

  if (column.kind === "date") return <DateCell value={value} onCommit={onCommit} onCancel={onCancel} />;

  /* A free-form list (tags) is chips, not a pipe-separated string. Lists that
     name records in other modules keep their own pickers. */
  if (column.list && !column.entity) return <ListCell value={value} onCommit={onCommit} onCancel={onCancel} />;

  return (
    <input
      autoFocus
      defaultValue={value}
      inputMode={column.kind === "number" ? "decimal" : undefined}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit((e.target as HTMLInputElement).value);
        if (e.key === "Escape") onCancel();
      }}
      className="w-full h-full px-3 py-2 text-[12.5px] outline-none border-2 border-primary bg-white"
    />
  );
}

/**
 * A date cell, on the module's own picker.
 *
 * The sheet stores dates the way the template does, `YYYY-MM-DD`, and the
 * picker speaks `Date`. Translating in both directions here keeps the file
 * format out of the picker and the calendar out of the parser. A value the
 * file carried that is not a date is left in place and shown as-is, so the
 * validation message next to it still makes sense.
 */
function DateCell({
  value, onCommit, onCancel,
}: { value: string; onCommit: (next: string) => void; onCancel: () => void }) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? new Date(`${value.trim()}T00:00:00`) : undefined;
  const [current, setCurrent] = useState<Date | undefined>(
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
  );

  return (
    <div
      className="px-2 py-1.5"
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <DatePickerField
        value={current}
        placeholder="Pick a date"
        onChange={(d) => {
          setCurrent(d);
          if (!d) { onCommit(""); return; }
          /* Local parts, not `toISOString`, so a date never slips a day
             across a timezone on the way into the sheet. */
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          onCommit(iso);
        }}
      />
    </div>
  );
}

/** The glyph that says what this cell opens: a caret for a list, a calendar
 *  for a date, a chevron for a picker in another module. Quiet by default and
 *  solid on row hover, the same way this module's inline-edit fields behave. */
export function CellAffordance({ column }: { column: ColumnSpec }) {
  const Icon = column.set ? ChevronDown : column.kind === "date" ? CalendarDays : column.entity ? ChevronRight : null;
  if (!Icon) return null;
  return (
    <Icon
      className="shrink-0 mt-[2px] text-slate-300 group-hover/row:text-slate-400 transition-colors"
      style={{ width: 12, height: 12 }}
      aria-hidden
    />
  );
}

/**
 * A list cell, on the module's own editor.
 *
 * The file carries `legacy|fleet-build`; nobody should have to read or type
 * that. The cell shows the module's chips and edits them with the module's tag
 * editor, and the pipe notation stays where it belongs, in the file.
 */
function ListCell({
  value, onCommit, onCancel,
}: { value: string; onCommit: (next: string) => void; onCancel: () => void }) {
  const [tags, setTags] = useState<string[]>(
    () => value.split("|").map((t) => t.trim()).filter(Boolean),
  );
  return (
    <Popover open onOpenChange={(next) => { if (!next) onCommit(tags.join("|")); }}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full text-left outline-none cursor-pointer" style={{ padding: "8px 12px", fontSize: "12.5px" }}>
          {tags.length ? tags.join(", ") : <span className="text-muted-foreground">Add tags</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={5}
        collisionPadding={12}
        className="p-0 rounded-xl w-auto"
        style={{ zIndex: 12420 }}
        onEscapeKeyDown={onCancel}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div style={{ padding: 10, width: 320 }}>
          {/* The module's tag field, unchanged: same chip, same limits, same
              helper line as the creation form. */}
          <TagsField tags={tags} onChange={setTags} label="" />
          <div className="flex items-center justify-end" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onCommit(tags.join("|"))}
              className="text-primary cursor-pointer"
              style={{ fontSize: 11.5, fontWeight: 500, border: 0, background: "transparent" }}
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * How a cell's raw value reads in the grid.
 *
 * The file stores a list as `a|b|c` and a rep as an email. Neither belongs in
 * a column header's worth of space: four pipe-joined addresses pushed the
 * Secondary Sales Reps column past any sane width. So a list shows its first
 * two entries and a count, an email shows the person, and the full value stays
 * in the cell's tooltip.
 */
export function cellDisplay(column: ColumnSpec, raw: string): { text: string; title?: string } {
  const value = (raw ?? "").trim();
  if (!value) return { text: "" };

  const pretty = (v: string) => {
    if (column.entity !== "user" || !v.includes("@")) return v;
    /* A rep reads as a person, not an address. */
    const parts = v.split("@")[0].split(".");
    return parts.filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  };

  if (column.list) {
    const items = value.split("|").map((s) => s.trim()).filter(Boolean).map(pretty);
    if (items.length <= 2) return { text: items.join(", "), title: items.join(", ") };
    return {
      text: `${items.slice(0, 2).join(", ")} +${items.length - 2}`,
      title: items.join("\n"),
    };
  }
  const text = pretty(value);
  return { text, title: text === value ? undefined : value };
}
