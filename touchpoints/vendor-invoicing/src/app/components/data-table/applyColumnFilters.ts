import type { ColumnFilterState } from './types';
import { isFilterActive } from './ColumnHeaderMenu';

/** Generic column-filter evaluator. Caller supplies a `getValue(row, columnKey)`
 *  accessor so this helper doesn't have to know the row shape.
 *
 *  Filter semantics:
 *   - text: substring (case-insensitive). Accepts array values too (any element matches).
 *   - multiselect: row.value ∈ selected[]. For array values, any element matches.
 *   - range: min ≤ row.value ≤ max (numeric).
 *   - date: from ≤ row.value ≤ to (yyyy-mm-dd lexicographic).
 */
export function applyColumnFilters<T>(
  rows: T[],
  filters: ColumnFilterState[],
  getValue: (row: T, columnKey: string) => unknown
): T[] {
  const active = filters.filter(isFilterActive);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => matchOne(row, f, getValue)));
}

function matchOne<T>(
  row: T,
  filter: ColumnFilterState,
  getValue: (row: T, columnKey: string) => unknown
): boolean {
  const raw = getValue(row, filter.columnKey);

  switch (filter.type) {
    case 'text': {
      const q = filter.text.toLowerCase();
      if (Array.isArray(raw)) {
        return raw.some((v) => String(v).toLowerCase().includes(q));
      }
      const s = raw == null ? '' : String(raw);
      return s.toLowerCase().includes(q);
    }
    case 'multiselect': {
      if (filter.values.length === 0) return true;
      if (Array.isArray(raw)) {
        return raw.some((v) => filter.values.includes(String(v)));
      }
      return filter.values.includes(String(raw));
    }
    case 'range': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return false;
      if (filter.min !== '' && n < Number(filter.min)) return false;
      if (filter.max !== '' && n > Number(filter.max)) return false;
      return true;
    }
    case 'date': {
      if (raw == null) return false;
      // Normalise to yyyy-mm-dd for lexicographic compare. Handles ISO strings + Date.
      let d: string;
      if (raw instanceof Date) d = raw.toISOString().slice(0, 10);
      else d = String(raw).slice(0, 10);
      if (filter.dateFrom && d < filter.dateFrom) return false;
      if (filter.dateTo && d > filter.dateTo) return false;
      return true;
    }
    default:
      return true;
  }
}
