import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { DateCellEditor } from "../../shared-cells/DateCellEditor";
import type { ColumnSpec } from "./importModel";
import { ChoiceCellDropdown, SEARCH_THRESHOLD } from "../../import-review/ChoiceCellDropdown";
import type { CatalogKey } from "./importCatalog";
import { sheetChoiceOptions } from "./sheetChoices";
import { LongTextFieldEditor, TagsFieldEditor } from "../../shared-cells/CommonFieldEditors";
import { activeRecordPlural } from "./specBridge";

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
 * Entity columns open the shared cell dropdown here too, on the catalog the
 * import validates against (sheetChoices.ts): the full-screen customer search
 * and the resolve dialog are no longer opened from a cell.
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
  const label = column.label.replace(/^Line \/ /, "");

  /* A closed set is a list, never a text box: the plain list, searchable
     once long, as every Data Imports review grid opens a single select. */
  if (column.set) {
    return (
      <ChoiceCellDropdown
        value={value}
        options={[...column.set]}
        searchable={column.set.length > SEARCH_THRESHOLD}
        label={label}
        onCommit={(next) => onCommit(next)}
        onCancel={onCancel}
      />
    );
  }

  /* A record in another module (customer, location, contact, item, pricing
     rule, payment term or method, sales rep, unit) is picked in the cell from
     the catalog this import validates against: a searchable list, or the
     checkbox panel with Done for a list column. No full-screen search. */
  if (column.entity) {
    const options = sheetChoiceOptions(column.entity as CatalogKey);
    if (options.length > 0) {
      return (
        <ChoiceCellDropdown
          value={value}
          options={options}
          multi={!!column.list}
          searchable={options.length > SEARCH_THRESHOLD}
          label={label}
          keepOrder
          onCommit={(next) => onCommit(next)}
          onCancel={onCancel}
        />
      );
    }
  }

  /* A date is typed in the cell (MM/DD/YYYY, or just the digits) or picked
     from the calendar icon at the cell's edge. */
  if (column.kind === "date") return <DateCellEditor value={value} format="mdy" framed onCommit={(next) => onCommit(next)} onCancel={onCancel} />;

  /* A free-form list (tags) is chips, not a pipe-separated string, on the one
     Tags editor every Data Import shares. Lists that name records in other
     modules keep their own pickers. */
  if (column.list && !column.entity) {
    return <TagsFieldEditor initialValue={value} onCommit={(next) => onCommit(next)} onCancel={onCancel} entityPlural={activeRecordPlural()} />;
  }

  /* Prose (notes, descriptions) opens the shared long-text editor. */
  if (column.kind !== "number" && /notes|description/i.test(column.key)) {
    return (
      <LongTextFieldEditor
        initialValue={value}
        onCommit={(next) => onCommit(next)}
        onCancel={onCancel}
        label={label}
      />
    );
  }

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
