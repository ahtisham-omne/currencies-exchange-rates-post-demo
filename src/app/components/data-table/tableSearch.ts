/* ──────────────────────────────────────────────────────────────────
 * WHAT A TABLE SEARCH FINDS (hidden-column-search spec, 10/14/26)
 *
 * One rule for every DataTable in the system: a search reads EVERY column,
 * shown or not, by the text its cell prints. A match in a column the reader
 * has switched off brings that column out while the search runs (DataTable
 * owns that part), so a row never comes back with nothing on screen saying
 * why it matched.
 *
 * A query with a digit skips thousands separators on both sides, so 1250
 * finds "$1,250.00" and 1,250 finds a bare 1250. The yellow mark
 * (highlightText) is drawn with this same pattern.
 * ────────────────────────────────────────────────────────────────── */
import { formatUsDate } from '@/app/lib/dueBucket';
import type { ColumnDef } from './types';

const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let lastQuery = '';
let lastSource: string | null = null;

/** The pattern a query finds in a cell's text, as a RegExp source; null for
 *  an empty query. Cached on the query, since a table asks once per cell. */
export function searchPatternSource(q: string | undefined | null): string | null {
  const raw = q ?? '';
  if (raw === lastQuery) return lastSource;
  lastQuery = raw;
  const query = raw.trim();
  if (!query) return (lastSource = null);
  if (/\d/.test(query)) {
    const chars = [...query.replace(/,/g, '')];
    lastSource = chars.length ? chars.map(escape).join(',?') : null;
  } else {
    lastSource = [...query].map(escape).join('');
  }
  return lastSource;
}

/** A test for one query, built once and run against every cell. */
export function searchMatcher(q: string | undefined | null): (text: string | undefined | null) => boolean {
  const source = searchPatternSource(q);
  if (!source) return () => true;
  const re = new RegExp(source, 'i');
  return (text) => !!text && re.test(text);
}

/** "A", "A and B", "A, B and C". */
export const listJoin = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function printed(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return ISO_DATE.test(v) ? formatUsDate(v) : v;
  // Figures print as money in most cells and as a bare count in the rest;
  // both forms are searched so either reading finds the row.
  // Zero mostly prints as an empty cell, which is never a match.
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0 ? `${v} ${money(v)}` : '';
  if (typeof v === 'boolean') return '';
  if (Array.isArray(v)) return v.map(printed).filter(Boolean).join(' ');
  return '';
}

/** The text a column's cell prints for a row: the column's own `searchText`
 *  when it has one, otherwise its value as the cell shows it (ISO dates as
 *  "Sep 12, 2026", figures as money). Placeholders and yes/no flags never
 *  match. Columns can opt out with `searchable: false`. */
export function columnSearchText<T>(col: ColumnDef<T>, row: T): string {
  if (col.searchable === false) return '';
  if (col.searchText) return col.searchText(row) ?? '';
  return printed(col.getValue(row));
}

/** Does any of the given columns hold the query for this row? Screens OR
 *  this into their search predicate so every column, on or off, is read. */
export function rowMatchesColumns<T>(
  row: T,
  columns: ColumnDef<T>[],
  query: string | undefined | null,
): boolean {
  if (!searchPatternSource(query)) return true;
  const test = searchMatcher(query);
  return columns.some((c) => test(columnSearchText(c, row)));
}

/** The hidden columns any listed row matched in, in the table's column order.
 *  Only columns that are in the order and switched off count; locked and
 *  right-pinned columns are never off, so never brought out. */
export function hiddenSearchHits<T>(
  rows: T[],
  columns: ColumnDef<T>[],
  columnOrder: string[],
  columnVisibility: Record<string, boolean>,
  query: string | undefined | null,
): string[] {
  if (!searchPatternSource(query) || rows.length === 0) return [];
  const test = searchMatcher(query);
  const byKey = new Map(columns.map((c) => [c.key, c] as const));
  const hits: string[] = [];
  for (const key of columnOrder) {
    if (columnVisibility[key] !== false) continue;
    const col = byKey.get(key);
    if (!col || col.locked || col.sticky === 'right') continue;
    if (rows.some((r) => test(columnSearchText(col, r)))) hits.push(key);
  }
  return hits;
}

/** A column order with the revealed columns moved in after `after`, where
 *  the eye already is; most hidden columns live at the far end. */
export function orderWithRevealed(order: string[], revealed: string[], after: string | null): string[] {
  if (!revealed.length) return order;
  const rest = order.filter((k) => !revealed.includes(k));
  const at = after ? rest.indexOf(after) + 1 : 0;
  return [...rest.slice(0, at), ...revealed, ...rest.slice(at)];
}
