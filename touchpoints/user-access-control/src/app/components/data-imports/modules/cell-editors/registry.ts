/* Special cell editors for the module imports (Item Library, Categories, Physical Inventory,
 * Partners, Partner Group). A column listed here opens the same picker its
 * home module uses when the record is created there (the way the Users
 * License Type cell opens the priced license list and the Sales customer cell
 * opens the customer search). Columns not listed keep the generic editor in
 * renderModuleCellEditor: text input, short dropdown, or searchable list. */

import type { ComponentType } from "react";
import type { ModuleColumn, ModuleImportDef, ModuleImportSlug, ModuleRow } from "../moduleImportDefs";

export type CellNavDir = "right" | "down" | "left" | "up";

export interface SpecialCellEditorProps {
  initialValue: string;
  onCommit: (next: string, dir?: CellNavDir) => void;
  onCancel: () => void;
  def: ModuleImportDef;
  col: ModuleColumn;
  /** Every value of the row being edited (edits applied), for pickers that
   *  depend on another column, e.g. alternative units on the base unit. */
  row: ModuleRow;
}

export type SpecialCellEditor = ComponentType<SpecialCellEditorProps>;
export type SpecialEditorMap = Record<string, SpecialCellEditor>;

const registry: Partial<Record<ModuleImportSlug, SpecialEditorMap>> = {};

/** Each module's editors file calls this once at import time. */
export function registerSpecialEditors(slug: ModuleImportSlug, map: SpecialEditorMap): void {
  registry[slug] = { ...(registry[slug] ?? {}), ...map };
}

export function getSpecialEditor(slug: ModuleImportSlug, colKey: string): SpecialCellEditor | undefined {
  return registry[slug]?.[colKey];
}
