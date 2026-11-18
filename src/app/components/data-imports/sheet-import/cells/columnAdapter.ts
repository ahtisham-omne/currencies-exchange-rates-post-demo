import type { ColumnSpec, EntityKind } from "./importModel";
import type { SheetColumn } from "../sheetSpec";

/* The Quote and Sales Order modules' own cell editors read a ColumnSpec, whose
   `entity` names the module a value has to exist in. This sheet spec calls that
   same thing `catalog`, so translate at the boundary rather than forking the
   editors. */
export function toColumnSpec(col: SheetColumn): ColumnSpec {
  return {
    key: col.key,
    label: col.label,
    level: col.level,
    requirement: col.requirement,
    conditionalNote: col.conditionalNote,
    kind: col.kind,
    set: col.set ? [...col.set] : undefined,
    entity: col.catalog as EntityKind | undefined,
    list: col.list,
    width: col.width,
  };
}
