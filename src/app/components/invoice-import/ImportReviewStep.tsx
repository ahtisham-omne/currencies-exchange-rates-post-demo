/* ── Step 4 · Review and fix (spec S5, simplified 9/15/26 PM) ─────────
 * The listing's own table language: slate header row with DRAG to
 * reorder columns (the RunDetailScreen recipe), condensed rows, and
 * INLINE editing: click any cell and it becomes an input or a select in
 * place, Enter commits, Escape cancels. A flagged cell pre-fills the
 * engine's suggestion; fixing a value shared by other broken rows
 * offers "Fix all N" on the toast (map once, apply everywhere).
 * Severity counts are compact filter chips, not cards.
 */

import { Fragment, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Download, Info, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { PAYMENT_TERM_PRESETS } from '@/app/data/paymentTermPresets';
import { downloadTextFile, HEADER_INVOICE_STATUSES, type ImportRunConfig } from './importModel';
import {
  computedTotal,
  paidAllocated,
  creditAllocated,
  failedRowsCsv,
  rowSeverity,
  severityCounts,
  type ImportInvoiceRow,
  type RowIssue,
  type Severity,
} from './importEngine';

// Owed-only scope (Eli 10/9): the balance that will actually import.
const owedOf = (r: ImportInvoiceRow) =>
  Math.max(0, Math.round((computedTotal(r) - paidAllocated(r) - creditAllocated(r)) * 100) / 100);
import { SEVERITY_META, SeverityPill, fmtDate, fmtPeriod, money } from './importUi';

type FilterKey = Severity | 'ready' | 'excluded';

const SEVERITY_RANK: Record<Severity | 'ready', number> = { blocker: 0, exception: 1, warning: 2, ready: 3 };

const SELECT_FIELDS: Record<string, readonly string[]> = {
  invoice_status: HEADER_INVOICE_STATUSES,
  payment_terms: PAYMENT_TERM_PRESETS.map((p) => p.name),
};

interface CellSpec { field: string; label: string; align?: 'right'; render?: (row: ImportInvoiceRow) => string }

// Payment status is no longer a column (Eli 10/9): the import carries only
// the open balance, so the reviewer sees the original total and what will
// actually import ("Open balance"), not a payment-status the file stops
// tracking.
const LINE_TYPE_LABEL: Record<string, string> = { item: 'Item', freight: 'Freight', misc: 'Misc' };

const CELLS: CellSpec[] = [
  { field: 'vendor_name', label: 'Vendor' },
  { field: 'vendor_invoice_number', label: 'Invoice No.' },
  { field: 'invoice_status', label: 'Invoice Status' },
  { field: 'payment_terms', label: 'Terms' },
  { field: 'vendor_invoice_date', label: 'Invoice Date', render: (r) => fmtDate(r.header.vendor_invoice_date) },
  { field: 'due_date', label: 'Due Date', render: (r) => fmtDate(r.header.due_date) },
  { field: 'total', label: 'Original Total', align: 'right', render: (r) => money(computedTotal(r)) },
  { field: 'open_balance', label: 'Open Balance', align: 'right', render: (r) => money(owedOf(r)) },
];

function cellIssues(row: ImportInvoiceRow, field: string): RowIssue[] {
  return row.issues.filter((i) => i.field === field);
}

function worst(issues: RowIssue[]): Severity | null {
  if (issues.some((i) => i.severity === 'blocker')) return 'blocker';
  if (issues.some((i) => i.severity === 'exception')) return 'exception';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return null;
}

const CELL_TONE: Record<Severity, { text: string; ring: string }> = {
  blocker: { text: '#B91C1C', ring: 'shadow-[inset_0_0_0_1.5px_#FCA5A5] bg-red-50/40' },
  exception: { text: '#C2410C', ring: 'shadow-[inset_0_0_0_1.5px_#FDBA74] bg-orange-50/40' },
  warning: { text: '#475569', ring: 'shadow-[inset_0_0_0_1px_#CBD5E1] bg-slate-50/50' },
};

function EditableCell({
  row,
  cell,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  row: ImportInvoiceRow;
  cell: CellSpec;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const issues = cellIssues(row, cell.field);
  const tone = worst(issues);
  const raw = row.header[cell.field] ?? '';
  const display = cell.render ? cell.render(row) : raw;
  const suggestion = issues.find((i) => i.suggestion)?.suggestion;
  const title = issues.length > 0 ? issues.map((i) => i.message).join('\n') : 'Click to edit';
  const options = SELECT_FIELDS[cell.field];

  /* Display and editor occupy the SAME 33px box, full width, no margins:
   * entering edit mode must not shift the row or the column grid. */
  if (editing) {
    if (options) {
      return (
        <Select
          defaultOpen
          value={options.includes(raw) ? raw : undefined}
          onValueChange={(v) => onCommit(v)}
          onOpenChange={(open) => { if (!open) onCancel(); }}
        >
          <SelectTrigger className="h-[33px] min-h-0 py-0 text-[12px] bg-white w-full rounded-md border-primary/50 ring-2 ring-primary/15 shadow-none [&>span]:truncate">
            <SelectValue placeholder={suggestion ? `Suggested: ${suggestion}` : 'Pick a value'} />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}{o === suggestion ? ' · Suggested' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        autoFocus
        defaultValue={suggestion ?? raw}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value.trim());
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== raw) onCommit(v);
          else onCancel();
        }}
        className={`h-[33px] py-0 text-[12px] bg-white w-full px-2.5 rounded-md border-primary/50 ring-2 ring-primary/15 shadow-none ${cell.align === 'right' ? 'text-right ' : ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onStartEdit}
      className={`w-full h-[33px] flex items-center px-2.5 text-[12px] rounded-md transition-colors cursor-pointer hover:bg-slate-100/70 ${
        tone ? CELL_TONE[tone].ring : ''
      } ${cell.align === 'right' ? 'justify-end ' : ''}`}
      style={{ color: tone ? CELL_TONE[tone].text : '#334155', fontWeight: tone ? 500 : 400 }}
    >
      <span className="truncate block min-w-0">{display || (tone ? 'Missing' : '')}</span>
    </button>
  );
}

export function ImportReviewStep({
  rows,
  config,
  unmatchedNote,
  onFix,
  onFixEverywhere,
  onToggleExclude,
  onAcceptNearDuplicate,
}: {
  rows: ImportInvoiceRow[];
  config: ImportRunConfig;
  unmatchedNote?: string | null;
  onFix: (ref: string, field: string, value: string) => void;
  onFixEverywhere: (field: string, oldValue: string, value: string) => void;
  onToggleExclude: (ref: string, excluded: boolean) => void;
  onAcceptNearDuplicate: (ref: string) => void;
}) {
  const counts = severityCounts(rows);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ ref: string; field: string } | null>(null);
  const [colOrder, setColOrder] = useState<string[]>(() => CELLS.map((c) => c.field));
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const orderedCells = colOrder
    .map((key) => CELLS.find((c) => c.field === key))
    .filter((c): c is CellSpec => !!c);

  const visible = useMemo(() => {
    const list = rows.filter((r) => {
      if (filters.size === 0) return true;
      if (r.excluded) return filters.has('excluded');
      return filters.has(rowSeverity(r));
    });
    // Blockers first, then exceptions (spec S5 default), stable by ref.
    return [...list].sort((a, b) => {
      const ax = a.excluded ? 4 : SEVERITY_RANK[rowSeverity(a)];
      const bx = b.excluded ? 4 : SEVERITY_RANK[rowSeverity(b)];
      if (ax !== bx) return ax - bx;
      return a.ref.localeCompare(b.ref);
    });
  }, [rows, filters]);

  const toggleFilter = (key: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpand = (ref: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const commitEdit = (row: ImportInvoiceRow, field: string, value: string) => {
    setEditingCell(null);
    if (!value || value === (row.header[field] ?? '')) return;
    const oldValue = row.header[field] ?? '';
    onFix(row.ref, field, value);
    // Map once, apply everywhere: other broken rows carrying the same
    // raw value get a one-click bulk fix on the toast.
    const others = rows.filter(
      (r) => r.ref !== row.ref && !r.excluded && (r.header[field] ?? '') === oldValue && cellIssues(r, field).length > 0,
    );
    const label = CELLS.find((c) => c.field === field)?.label ?? field;
    if (oldValue && others.length > 0) {
      toast(`${label} updated`, {
        description: `${others.length} other row${others.length === 1 ? '' : 's'} also say "${oldValue}".`,
        action: { label: `Fix All ${others.length}`, onClick: () => onFixEverywhere(field, oldValue, value) },
      });
    }
  };

  const reorderCols = (from: string, to: string) =>
    setColOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });

  const blockersLeft = counts.blocker;
  const CHIPS: { key: FilterKey; label: string; count: number; fg: string }[] = [
    { key: 'ready', label: 'Ready', count: counts.ready, fg: SEVERITY_META.ready.fg },
    { key: 'blocker', label: 'Blockers', count: counts.blocker, fg: SEVERITY_META.blocker.fg },
    { key: 'exception', label: 'Exceptions', count: counts.exception, fg: SEVERITY_META.exception.fg },
    { key: 'warning', label: 'Warnings', count: counts.warning, fg: SEVERITY_META.warning.fg },
    ...(counts.excluded > 0 ? [{ key: 'excluded' as FilterKey, label: 'Excluded', count: counts.excluded, fg: '#94A3B8' }] : []),
  ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Severity chips: counts that filter, in the quick-filter pill language. */}
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map((chip) => {
            const active = filters.has(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => toggleFilter(chip.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  active ? 'border-primary bg-accent' : 'border-border bg-white hover:bg-slate-50'
                }`}
                style={{ fontWeight: 500, color: active ? 'hsl(var(--primary))' : '#475569' }}
                title={active ? 'Clear this filter' : `Show only ${chip.label}`}
              >
                {chip.label}
                <span className="" style={{ fontWeight: 600, color: chip.count > 0 ? chip.fg : '#CBD5E1' }}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            downloadTextFile('failed-rows.csv', failedRowsCsv(rows));
            toast.success('Failed rows downloaded', { description: 'Same columns plus an error column. Fix in Excel, re-upload just that subset.' });
          }}
          disabled={blockersLeft === 0}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
          style={{ fontWeight: 500 }}
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          Failed Rows
        </button>
      </div>

      {/* The table, in the listing's language. */}
      <div className="bg-white border border-border rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-border">
                <th className="w-[30px] px-3 py-2.5" />
                <th className="text-left px-2.5 py-2.5 text-foreground whitespace-nowrap" style={{ fontWeight: 500 }}>Status</th>
                <th className="text-left px-2.5 py-2.5 text-foreground whitespace-nowrap" style={{ fontWeight: 500 }}>Reference</th>
                {orderedCells.map((c) => (
                  <th
                    key={c.field}
                    draggable
                    onDragStart={(e) => {
                      dragColRef.current = c.field;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', c.field);
                    }}
                    onDragOver={(e) => {
                      if (dragColRef.current && dragColRef.current !== c.field) {
                        e.preventDefault();
                        setDragOverCol(c.field);
                      }
                    }}
                    onDragLeave={() => setDragOverCol((v) => (v === c.field ? null : v))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragColRef.current;
                      if (from && from !== c.field) reorderCols(from, c.field);
                      dragColRef.current = null;
                      setDragOverCol(null);
                    }}
                    onDragEnd={() => {
                      dragColRef.current = null;
                      setDragOverCol(null);
                    }}
                    className={`px-2.5 py-2.5 text-foreground whitespace-nowrap cursor-grab active:cursor-grabbing transition-colors hover:bg-slate-200/60 ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    } ${dragOverCol === c.field ? 'bg-blue-50/70' : ''}`}
                    style={{ fontWeight: 500 }}
                    title="Drag to reorder this column"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-[70px] px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const sev = rowSeverity(row);
                const rowLevel = row.issues.filter((i) => !i.field);
                const nearDup = row.issues.find((i) => i.nearDuplicateOf)?.nearDuplicateOf;
                const isExpanded = expanded.has(row.ref);
                const hasDetail = rowLevel.length > 0 || !!nearDup || row.lines.length > 0;
                return (
                  <Fragment key={row.ref}>
                    <tr className={`border-b border-slate-100 transition-colors ${row.excluded ? 'opacity-45' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-3 py-1">
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.ref)}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-2.5 py-1 whitespace-nowrap">
                        {row.excluded ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-px text-[11px] text-slate-400" style={{ fontWeight: 600 }}>
                            Excluded
                          </span>
                        ) : (
                          <SeverityPill severity={sev} />
                        )}
                      </td>
                      <td className={`px-2.5 py-1 whitespace-nowrap text-slate-700 ${row.excluded ? 'line-through' : ''}`} style={{ fontWeight: 500 }}>
                        {row.ref}
                      </td>
                      {orderedCells.map((c) => (
                        <td key={c.field} className="p-0.5 min-w-[110px] max-w-[190px] align-middle">
                          {row.excluded ? (
                            <span className={`h-[33px] flex items-center px-2.5 text-[12px] text-slate-400 ${c.align === 'right' ? 'justify-end ' : ''}`}>
                              <span className="truncate block min-w-0">{c.render ? c.render(row) : row.header[c.field] ?? ''}</span>
                            </span>
                          ) : (
                            <EditableCell
                              row={row}
                              cell={c}
                              editing={editingCell?.ref === row.ref && editingCell?.field === c.field}
                              onStartEdit={() => setEditingCell({ ref: row.ref, field: c.field })}
                              onCommit={(value) => commitEdit(row, c.field, value)}
                              onCancel={() => setEditingCell(null)}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1 text-right whitespace-nowrap">
                        {row.excluded ? (
                          <button
                            type="button"
                            onClick={() => onToggleExclude(row.ref, false)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] text-primary hover:bg-accent transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleExclude(row.ref, true)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                            title="Leave this row out of the import"
                          >
                            Exclude
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={orderedCells.length + 4} className="px-4 py-3">
                          {/* Sticky left: the detail panel stays in view while
                              the wide table scrolls sideways underneath. */}
                          <div className="flex flex-col gap-3 max-w-[920px] sticky left-4">
                            {rowLevel.length > 0 && (
                              <div className="space-y-1">
                                {rowLevel.map((iss, i) => (
                                  <p key={i} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: SEVERITY_META[iss.severity].fg, fontWeight: 400 }}>
                                    <span className="mt-[3px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_META[iss.severity].fg }} />
                                    {iss.message}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Near duplicate: both rows side by side, three decisions. */}
                            {nearDup && !row.excluded && (
                              <div className="border border-orange-200 bg-white rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-orange-50/70 border-b border-orange-100 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                  <p className="text-[12px] text-orange-800" style={{ fontWeight: 600 }}>Possible Duplicate</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                                  {[
                                    { tag: 'Incoming Row', ref: row.ref, vendor: row.header.vendor_name, number: row.header.vendor_invoice_number, date: row.header.vendor_invoice_date, total: computedTotal(row) },
                                    { tag: nearDup.inOmne ? 'Already in Omne' : 'Also in This File', ref: nearDup.ref, vendor: nearDup.vendor, number: nearDup.invoiceNumber, date: nearDup.date, total: nearDup.total },
                                  ].map((side, i) => (
                                    <div key={i} className="px-3.5 py-2.5">
                                      <p className="text-[10.5px] text-slate-400" style={{ fontWeight: 600 }}>{side.tag}</p>
                                      <p className="text-[12.5px] text-foreground mt-1" style={{ fontWeight: 600 }}>{side.ref}</p>
                                      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px]">
                                        <span className="text-slate-400">Vendor</span><span className="text-slate-700">{side.vendor}</span>
                                        <span className="text-slate-400">Invoice No.</span>
                                        <span className="text-slate-700" style={i === 0 ? { fontWeight: 600 } : undefined}>{side.number}</span>
                                        <span className="text-slate-400">Date</span>
                                        <span className="text-slate-700" style={{ fontWeight: 600 }}>{fmtDate(side.date)}</span>
                                        <span className="text-slate-400">Total</span><span className="text-slate-700 ">{money(side.total)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="px-3.5 py-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => onAcceptNearDuplicate(row.ref)}
                                    className="h-8 px-3 rounded-lg text-[12px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer border-0"
                                    style={{ fontWeight: 600 }}
                                  >
                                    Import Anyway
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onToggleExclude(row.ref, true)}
                                    className="h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    style={{ fontWeight: 500 }}
                                  >
                                    Exclude This Row
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onToggleExclude(row.ref, true);
                                      toast.success('Linked as the same invoice', { description: `${row.ref} was excluded; ${nearDup.ref} carries the record.` });
                                    }}
                                    className="h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    style={{ fontWeight: 500 }}
                                  >
                                    Link as the Same Invoice
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Lines, read only: header with the count, typed
                                rows, and a total that ties to the invoice. */}
                            {row.lines.length > 0 && (() => {
                              const lineVal = (s: string | undefined) => Number((s || '0').replace(/[$,\s]/g, '')) || 0;
                              const linesTotal = row.lines.reduce((s, l) => s + lineVal(l.amount), 0);
                              return (
                                <div className="border border-border rounded-lg overflow-hidden bg-white">
                                  <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border-b border-border">
                                    <p className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                                      Line Items
                                      <span className="ml-1.5 text-slate-400 " style={{ fontWeight: 500 }}>{row.lines.length}</span>
                                    </p>
                                    <p className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>
                                      From the rows of your file that share this invoice number
                                    </p>
                                  </div>
                                  <table className="w-full text-[11.5px]">
                                    <thead>
                                      <tr className="border-b border-slate-100">
                                        {['No.', 'Type', 'Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                                          <th key={h} className={`px-3 py-1.5 text-slate-400 whitespace-nowrap ${i >= 3 ? 'text-right' : 'text-left'}`} style={{ fontWeight: 500 }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.lines.map((l, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                          <td className="px-3 py-2 text-slate-400 w-[36px]">{l.line_number}</td>
                                          <td className="px-3 py-2 w-[86px]">
                                            <span
                                              className={`inline-flex items-center rounded-full px-2 py-px text-[10.5px] ${
                                                l.line_type === 'item' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                                              }`}
                                              style={{ fontWeight: 500 }}
                                            >
                                              {LINE_TYPE_LABEL[l.line_type] ?? l.line_type}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-700 max-w-[340px] truncate">
                                            {l.description || <span className="text-slate-300">No description</span>}
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-600 ">{l.quantity || ''}</td>
                                          <td className="px-3 py-2 text-right text-slate-600 ">{l.unit_price ? money(lineVal(l.unit_price)) : ''}</td>
                                          <td className="px-3 py-2 text-right text-slate-700 " style={{ fontWeight: 500 }}>{money(lineVal(l.amount))}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-slate-50/70">
                                        <td colSpan={5} className="px-3 py-2 text-right text-slate-500" style={{ fontWeight: 500 }}>Lines Total</td>
                                        <td className="px-3 py-2 text-right text-slate-900 " style={{ fontWeight: 600 }}>{money(linesTotal)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={orderedCells.length + 4}>
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                      <p className="text-[13px] text-slate-600" style={{ fontWeight: 600 }}>Nothing matches this filter</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Clear a chip above to see the rest of the import.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3.5 py-2 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px] text-slate-400 shrink-0">
          <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
            <Info className="w-3 h-3 shrink-0 text-slate-300" />
            {unmatchedNote ? (
              <span className="text-orange-600" style={{ fontWeight: 500 }}>{unmatchedNote}</span>
            ) : (
              <>
                Click a cell to edit it in place. Drag a column header to reorder.
                {config.mode === 'migration' ? ` Posting dates land in ${fmtPeriod(config.postingPeriod)}.` : ''}
              </>
            )}
          </span>
          {blockersLeft > 0 && (
            <span className="inline-flex items-center gap-1.5 text-red-600 shrink-0" style={{ fontWeight: 500 }}>
              <Ban className="w-3 h-3" />
              {blockersLeft} blocker{blockersLeft === 1 ? '' : 's'} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function includedBlockerCount(rows: ImportInvoiceRow[]): number {
  return rows.filter((r) => !r.excluded && rowSeverity(r) === 'blocker').length;
}
