/* Legacy import path — the canonical ColumnSelector lives in
 * data-table/ColumnSelector.tsx (deduped 9/4/26 when the drawer gained
 * the freeze toggle; the two copies had drifted only in comments and a
 * closed-state height). Every host resolves to the same component. */
export { ColumnSelector, ColumnSelectorTrigger } from './data-table/ColumnSelector';
export type { ColumnConfig } from './data-table/ColumnSelector';
