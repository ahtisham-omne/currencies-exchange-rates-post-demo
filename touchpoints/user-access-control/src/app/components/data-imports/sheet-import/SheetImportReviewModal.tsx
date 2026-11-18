import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, RotateCcw, Search, Trash2, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card";
import type { SheetImportSpec } from "./sheetSpec";
import { headerFor } from "./sheetSpec";
import type { CellIssue, RowOutcome, SheetRow } from "./sheetRecords";
import { issuesFor, worstLevel } from "./sheetRecords";
import { totals, validateRows } from "./sheetValidation";
import { CellEditor } from "./cells/CellEditor";
import { CellAffordance } from "./cells/CellAffordance";
import { LineItemsSheet } from "./cells/LineItemsSheet";
import { ResolveEntityDialog } from "./cells/ResolveEntityDialog";
import { CustomerResolveOverlay } from "./cells/CustomerResolveOverlay";
import type { EntityGap, EntityKind } from "./cells/importModel";
import { setActiveSpec } from "./cells/specBridge";
import { lineIdFor, rowNumberFromLineId, toImportRecord, toRecordValidation } from "./cells/rowAdapter";
import { toColumnSpec } from "./cells/columnAdapter";
import { ImportColumnHeaderMenu } from "../table-columns/ImportColumnHeaderMenu";
import { useColumnControls } from "../table-columns/useColumnControls";
import { DensityDropdown, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, type DensityOption } from "../density";

/* Table metrics come from the same place the Users review sheet reads them, so
   both sheets share their row heights and type scale. The sheet opens in the
   condensed density (the sleeker of the two) and the header carries the same
   control to switch. */
const DensityContext = React.createContext<DensityOption>("condensed");
const useRowHeight = () =>
  React.useContext(DensityContext) === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
const useHeaderHeight = () => (React.useContext(DensityContext) === "comfort" ? 44 : 36);
const ROW_NUM_WIDTH = 52;
const RESULT_COL_WIDTH = 110;
const LINES_COL_WIDTH = 96;
const ACTION_COL_WIDTH = 96;
const DEFAULT_COL_WIDTH = 150;

function Th({
  children,
  sticky,
  stickyLeft = 0,
  style,
  className,
  ...rest
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  style?: React.CSSProperties;
  className?: string;
} & Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "children" | "style" | "className">) {
  const headerHeight = useHeaderHeight();
  return (
    <th
      {...rest}
      className={`text-left align-middle px-3 whitespace-nowrap bg-[#F8FAFC] border-b border-[#CBD5E1] border-r border-r-[#E2E8F0] last:border-r-0 sticky top-0${className ? ` ${className}` : ""}`}
      style={{
        height: headerHeight,
        fontSize: 12,
        fontWeight: 500,
        color: "#64748B",
        lineHeight: "1.2",
        zIndex: sticky ? 30 : 20,
        ...(sticky ? { left: stickyLeft, position: "sticky" } : null),
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  sticky,
  stickyLeft = 0,
  tinted,
  style,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  /** Cell carries a severity tint the shared row hover must keep. */
  tinted?: boolean;
  style?: React.CSSProperties;
}) {
  const rowHeight = useRowHeight();
  return (
    <td
      data-cell-tint={tinted ? "" : undefined}
      className={`px-3 align-middle border-b border-[#F1F5F9] border-r border-r-[#F1F5F9] last:border-r-0${sticky ? " sticky z-10" : ""}`}
      style={{
        ...(sticky ? { left: stickyLeft, background: "#FFFFFF" } : null),
        height: rowHeight,
        fontSize: 13,
        color: "#1E293B",
        fontFamily: "Aptos, Inter, ui-sans-serif, system-ui, -apple-system",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export interface SheetImportOutcome {
  imported: number;
  skipped: number;
  failed: number;
  records: number;
  rows: SheetRow[];
}

interface Props {
  open: boolean;
  spec: SheetImportSpec;
  /** Keys already in the module, so a re-used number is caught before import. */
  existingKeys?: readonly string[];
  importName: string;
  importDescription: string;
  fileName: string;
  parsedRows: SheetRow[];
  onClose: () => void;
  /** Fires with the final rows once the user commits the import. */
  onApplied: (outcome: SheetImportOutcome) => void;
}

/* Review is one screen: the sheet as it arrived, every flagged cell explaining
 * itself on hover, and edits made in place. Warnings never block, errors block
 * only their own row, and a row the user cannot fix here can be dropped. */
export function SheetImportReviewModal({
  open,
  spec,
  existingKeys,
  importName,
  importDescription,
  fileName,
  parsedRows,
  onClose,
  onApplied,
}: Props) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [filter, setFilter] = useState<"all" | "ready" | "errors" | "warnings">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ row: number; field: string } | null>(null);
  const [density, setDensity] = useState<DensityOption>("condensed");

  useEffect(() => {
    if (!open) return;
    setRows(validateRows(parsedRows, spec, { existingKeys }));
    setFilter("all");
    setEditing(null);
  }, [open, parsedRows, spec, existingKeys]);

  const t = useMemo(() => totals(rows.filter((r) => !r._skipped)), [rows]);

  /* The main grid carries the record's own columns; a record's line items open
     in the module's own line-items sheet, exactly as they do in the Quote and
     Sales Order modules. */
  const recordColumns = useMemo(() => spec.columns.filter((c) => c.level === "record"), [spec]);
  /* Header menu (sort, hide, freeze) and drag reorder, the Inventory
     Movement table pattern shared by every Data Import table. */
  const controlledColumns = useMemo(
    () => recordColumns.map((c) => ({ ...c, label: headerFor(c), width: c.width ?? DEFAULT_COL_WIDTH })),
    [recordColumns],
  );
  const columns = useColumnControls(controlledColumns);
  const hasFrozen = columns.frozenColumns.length > 0;
  const frozenLeft = columns.frozenLefts(ROW_NUM_WIDTH + RESULT_COL_WIDTH + LINES_COL_WIDTH);
  const lastFrozenKey = hasFrozen ? columns.frozenColumns[columns.frozenColumns.length - 1].key : null;
  useEffect(() => { setActiveSpec(spec); }, [spec]);

  /* One grid row per record: its first source row carries the record columns. */
  const recordRows = useMemo(() => {
    const groups = new Map<string, SheetRow[]>();
    for (const r of rows) {
      const list = groups.get(r._key) ?? [];
      list.push(r);
      groups.set(r._key, list);
    }
    return [...groups.entries()].map(([key, group]) => ({ key, head: group[0], group }));
  }, [rows]);

  const [openLinesFor, setOpenLinesFor] = useState<string | null>(null);
  /* A catalog cell resolves through the module's own picker, the same dialog the
     Quote and Sales Order review sheets use, rather than a text box. */
  const [resolving, setResolving] = useState<{ gap: EntityGap; row: number; field: string } | null>(null);
  const openGroup = openLinesFor ? recordRows.find((r) => r.key === openLinesFor) : undefined;

  const applyEdit = useCallback(
    (rowNo: number, field: string, value: string) => {
      setRows((prev) =>
        validateRows(
          prev.map((r) => (r._row === rowNo ? { ...r, values: { ...r.values, [field]: value } } : r)),
          spec,
          { existingKeys },
        ),
      );
      setEditing(null);
    },
    [spec, existingKeys],
  );

  const toggleSkip = useCallback((rowNo: number) => {
    setRows((prev) => prev.map((r) => (r._row === rowNo ? { ...r, _skipped: !r._skipped } : r)));
  }, []);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recordRows.filter(({ group }) => {
      const issues = group.flatMap((r) => r.issues);
      const hasError = issues.some((i) => i.level === "error");
      if (filter === "errors" && !hasError) return false;
      if (filter === "warnings" && (hasError || issues.length === 0)) return false;
      if (filter === "ready" && issues.length > 0) return false;
      if (!q) return true;
      return group.some((r) => Object.values(r.values).some((v) => v.toLowerCase().includes(q)));
    });
  }, [recordRows, filter, query]);

  const { sortRows } = columns;
  const sortedRecords = useMemo(
    () =>
      sortRows(visibleRecords, ({ head, group }, key) => {
        if (key === "_result") {
          const issues = group.flatMap((r) => r.issues);
          return head._skipped ? 3 : issues.some((i) => i.level === "error") ? 0 : issues.length > 0 ? 1 : 2;
        }
        return head.values[key];
      }),
    [sortRows, visibleRecords],
  );

  const blockedRows = rows.filter((r) => !r._skipped && r.issues.some((i) => i.level === "error"));
  const canImport = rows.some((r) => !r._skipped) && blockedRows.length === 0;

  const handleImport = useCallback(() => {
    const finalRows: SheetRow[] = rows.map((r) => ({
      ...r,
      _outcome: (r._skipped
        ? "Skipped"
        : r.issues.some((i) => i.level === "error")
          ? "Failed"
          : "Created") as RowOutcome,
    }));
    const imported = finalRows.filter((r) => r._outcome === "Created").length;
    onApplied({
      imported,
      skipped: finalRows.filter((r) => r._outcome === "Skipped").length,
      failed: finalRows.filter((r) => r._outcome === "Failed").length,
      records: new Set(finalRows.filter((r) => r._outcome === "Created").map((r) => r._key)).size,
      rows: finalRows,
    });
  }, [rows, onApplied]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
      />
      <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 14 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
          className="relative bg-white flex flex-col overflow-hidden pointer-events-auto rounded-2xl w-[calc(100vw-2rem)] h-[calc(100vh-3rem)]"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          {/* Header */}
          <div className="px-5 py-4 shrink-0 bg-white border-b border-[#EEF2F6] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[#0F172A]" style={{ fontSize: 17, fontWeight: 700 }}>
                Review and Fix Your Data
              </h2>
              <p className="text-[#64748B] mt-0.5" style={{ fontSize: 12 }}>
                Check your {spec.recordLabelPlural.toLowerCase()} before importing. Rows with errors will not be imported
                until you fix them. Rows with warnings will import as they are.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Everything below the header lives in one inset card, the way the
              Users review sheet frames its table. */}
          <div className="flex-1 min-h-0 overflow-hidden bg-[#F8FAFC] px-4 lg:px-5 py-4">
          <div className="h-full flex flex-col rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          {/* Toolbar: the same search, density and chip row the Users sheet
              carries, sitting inside the table card rather than the modal
              chrome. */}
          <div className="px-4 lg:px-5 pt-3 pb-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-[320px]">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-[#64748B]" style={{ fontSize: 12 }}>
              <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
              A blocked cell names the module to create the missing record in.
            </span>
            <div className="ml-auto shrink-0">
              <DensityDropdown density={density} onChange={setDensity} />
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 px-4 lg:px-5 pb-3 border-b border-[#E2E8F0] overflow-x-auto">
            <Chip label="Show All" count={t.rows} active={filter === "all"} onClick={() => setFilter("all")} />
            <Chip label="Ready" count={t.cleanRows} tone="ready" active={filter === "ready"} onClick={() => setFilter("ready")} />
            <Chip label="Errors" count={t.errorRows} tone="error" active={filter === "errors"} onClick={() => setFilter("errors")} />
            <Chip label="Warnings" count={t.warningRows} tone="warning" active={filter === "warnings"} onClick={() => setFilter("warnings")} />
          </div>

          {/* Grid */}
          <DensityContext.Provider value={density}>
          <div className="flex-1 min-h-0 overflow-auto">
            {/* Same table contract as the Users review sheet: fixed column
                widths, one line per cell with an ellipsis, and the module's
                row and header heights, so a long value never grows a row. */}
            <table className="border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: ROW_NUM_WIDTH }} />
                <col style={{ width: RESULT_COL_WIDTH }} />
                <col style={{ width: LINES_COL_WIDTH }} />
                {columns.visibleColumns.map((col) => (
                  <col key={col.key} style={{ width: col.width }} />
                ))}
                <col style={{ width: ACTION_COL_WIDTH }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  <Th sticky style={{ width: ROW_NUM_WIDTH, textAlign: "right", paddingLeft: 4, paddingRight: 8 }}>
                    <span style={{ color: "#94A3B8" }}>#</span>
                  </Th>
                  <Th sticky={hasFrozen} stickyLeft={ROW_NUM_WIDTH} style={{ width: RESULT_COL_WIDTH }}>
                    <ImportColumnHeaderMenu
                      columnKey="_result"
                      label="Result"
                      sort={columns.sort}
                      onSort={columns.onSort}
                      labelStyle={{ fontSize: "12px", fontWeight: 500 }}
                    />
                  </Th>
                  <Th sticky={hasFrozen} stickyLeft={ROW_NUM_WIDTH + RESULT_COL_WIDTH} style={{ width: LINES_COL_WIDTH }}>Line items</Th>
                  {columns.visibleColumns.map((col) => {
                    const isFrozen = columns.frozen.has(col.key);
                    return (
                      <Th
                        key={col.key}
                        {...columns.headerDragProps(col.key)}
                        sticky={isFrozen}
                        stickyLeft={frozenLeft[col.key]}
                        className="group/colheader cursor-grab select-none"
                        style={{
                          overflow: "hidden",
                          ...(col.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 #E2E8F0" } : null),
                          ...columns.draggedHeaderStyle(col.key),
                        }}
                      >
                        {columns.dragAdornments(col.key)}
                        <ImportColumnHeaderMenu
                          columnKey={col.key}
                          label={col.label}
                          sort={columns.sort}
                          onSort={columns.onSort}
                          onHide={columns.onHide}
                          isFrozen={isFrozen}
                          onFreeze={columns.onFreeze}
                          labelStyle={{ fontSize: "12px", fontWeight: 500 }}
                          suppressClick={columns.suppressClick}
                        />
                      </Th>
                    );
                  })}
                  <Th>Row</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map(({ key, head: row, group }) => {
                  const hasError = group.some((r) => r.issues.some((i) => i.level === "error"));
                  return (
                    <tr
                      key={row._row}
                      className={row._skipped ? "import-row-hover opacity-45" : "import-row-hover"}
                      style={{ background: row._skipped ? "#F8FAFC" : undefined }}
                    >
                      <Td sticky style={{ textAlign: "right", paddingLeft: 4, paddingRight: 8, color: "#94A3B8", background: "#FFFFFF" }}>
                        <span className="inline-flex items-center gap-1 justify-end w-full">
                          {hasError && !row._skipped && <AlertTriangle className="w-3 h-3 text-[#DC2626]" />}
                          {row._row}
                        </span>
                      </Td>
                      <Td sticky={hasFrozen} stickyLeft={ROW_NUM_WIDTH}>
                        <ResultChip row={row} />
                      </Td>
                      <Td sticky={hasFrozen} stickyLeft={ROW_NUM_WIDTH + RESULT_COL_WIDTH}>
                        <LinesOpener
                          count={group.length}
                          hasIssues={group.some((r) =>
                            r.issues.some((i) => spec.columns.find((c) => c.key === i.field)?.level === "line"),
                          )}
                          onOpen={() => setOpenLinesFor(key)}
                        />
                      </Td>
                      {columns.visibleColumns.map((col) => {
                        const shown = false;
                        const isFrozenCol = columns.frozen.has(col.key);
                        const cellIssues = issuesFor(row, col.key);
                        const level = worstLevel(cellIssues);
                        const isEditing = editing?.row === row._row && editing.field === col.key;
                        return (
                          <Td
                            key={col.key}
                            sticky={isFrozenCol}
                            stickyLeft={frozenLeft[col.key]}
                            tinted={!!level || isEditing}
                            style={{
                              padding: 0,
                              background:
                                level === "error" ? "#FEF2F2"
                                : level === "warning" ? "#FFFBEB"
                                : columns.draggingKey === col.key ? "#F7FAFF"
                                : isFrozenCol ? "#FFFFFF"
                                : undefined,
                              ...(col.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 #E2E8F0" } : null),
                            }}
                          >
                            {shown ? (
                              <span className="block px-3 text-[#CBD5E1]">·</span>
                            ) : isEditing ? (
                              <div className="px-2">
                                <CellEditor
                                  column={toColumnSpec(col)}
                                  value={row.values[col.key] ?? ""}
                                  onCommit={(next) => applyEdit(row._row, col.key, next)}
                                  onCancel={() => setEditing(null)}
                                />
                              </div>
                            ) : (
                              <CellButton
                                text={row.values[col.key] ?? ""}
                                issues={cellIssues}
                                label={col.label}
                                affordance={<CellAffordance column={col} />}
                                onEdit={() => {
                                  /* Every cell, catalog columns included, edits in place on the shared
                                     cell dropdown (no full-screen search, no resolve dialog). */
                                  setEditing({ row: row._row, field: col.key });
                                }}
                              />
                            )}
                          </Td>
                        );
                      })}
                      <Td>
                        <button
                          type="button"
                          onClick={() => toggleSkip(row._row)}
                          className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                          style={{ fontSize: 12.5, fontWeight: 500 }}
                        >
                          {row._skipped ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {row._skipped ? "Restore" : "Drop"}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </DensityContext.Provider>
          {columns.ghost}
          </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#64748B]" style={{ fontSize: 12 }}>
              {canImport ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                  {t.cleanRows + t.warningRows} of {rows.length} rows ready to import.
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  {blockedRows.length} {blockedRows.length === 1 ? "row needs" : "rows need"} a fix or a drop before you can import.
                </>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center px-5 h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canImport}
                onClick={handleImport}
                className="inline-flex items-center gap-1.5 px-5 h-9 rounded-[8px] bg-[#0A77FF] hover:bg-[#0066D6] text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Start Import
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {resolving && ["customer", "location", "contact"].includes(resolving.gap.entity) && (
        <CustomerResolveOverlay
          open
          entity={resolving.gap.entity}
          onPick={(value) => { applyEdit(resolving.row, resolving.field, value); setResolving(null); }}
          onClose={() => setResolving(null)}
        />
      )}

      {resolving && !["customer", "location", "contact"].includes(resolving.gap.entity) && (
        <ResolveEntityDialog
          gap={resolving.gap}
          onApply={(replacement) => {
            applyEdit(resolving.row, resolving.field, replacement);
            setResolving(null);
          }}
          onClose={() => setResolving(null)}
        />
      )}

      {openGroup && (
        <LineItemsSheet
          record={toImportRecord(openGroup.key, openGroup.group)}
          validation={toRecordValidation(openGroup.group, spec)}
          onEditLine={(lineId, field, value) => applyEdit(rowNumberFromLineId(lineId), field, value)}
          onEditAdjustments={() => undefined}
          onOpenEntity={(entity, current, cell) =>
            setResolving({
              gap: {
                entity,
                rawValue: current,
                occurrences: 1,
                recordIds: [openGroup.key],
                cell: { recordId: openGroup.key, lineId: cell.lineId, field: cell.field },
              },
              row: rowNumberFromLineId(cell.lineId),
              field: cell.field,
            })
          }
          onDropLine={(lineId) => toggleSkip(rowNumberFromLineId(lineId))}
          onResolveIssue={() => undefined}
          onClose={() => setOpenLinesFor(null)}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* The record's line-item count, as the way into the module's line sheet. */
function LinesOpener({
  count,
  hasIssues,
  onOpen,
}: {
  count: number;
  hasIssues: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md border border-[#E2E8F0] bg-white hover:border-[#0A77FF] hover:text-[#0A77FF] transition-colors cursor-pointer"
      style={{ font: "inherit", fontSize: 12, fontWeight: 500, color: hasIssues ? "#B45309" : "#475569" }}
    >
      {count} {count === 1 ? "line" : "lines"}
      {hasIssues && <AlertTriangle className="w-3 h-3" />}
    </button>
  );
}

/* A cell is the click target, not just its text, so a blank flagged cell can
 * still be opened for editing. */
function CellButton({
  text,
  issues,
  label,
  affordance,
  onEdit,
}: {
  text: string;
  issues: CellIssue[];
  label: string;
  affordance?: React.ReactNode;
  onEdit: () => void;
}) {
  const rowHeight = useRowHeight();
  const body = (
    <button
      type="button"
      onClick={onEdit}
      className="group/cell flex w-full items-center gap-1.5 text-left px-3 cursor-pointer hover:bg-[#F0F7FF] transition-colors"
      style={{
        height: rowHeight,
        lineHeight: `${rowHeight}px`,
        /* A bare button picks up the app's 16px/500 button base style, which is
           what made these cells read heavier than the Users sheet. */
        font: "inherit",
        color: "inherit",
      }}
      title={text || undefined}
    >
      <span className={`truncate ${text ? "text-[#1E293B]" : "text-[#CBD5E1]"}`}>{text || "Empty"}</span>
      {affordance}
    </button>
  );
  if (issues.length === 0) return body;
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>{body}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={6} className="w-[290px] p-0 rounded-xl border-0 overflow-hidden z-[300]" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
        <div
          className="px-3.5 py-2.5"
          style={{ background: issues.some((i) => i.level === "error") ? "#FEF2F2" : "#FFFBEB" }}
        >
          <p className="text-[#0F172A]" style={{ fontSize: 12, fontWeight: 600 }}>
            {label}
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: issues.some((i) => i.level === "error") ? "#B91C1C" : "#B45309" }}>
            {issues.some((i) => i.level === "error") ? "Needs a fix before import" : "Imports with a change"}
          </p>
        </div>
        <div className="bg-white px-3.5 py-3 flex flex-col gap-2">
          {issues.map((issue, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <p className="text-[#334155]" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                {issue.message}
              </p>
              {issue.hint && (
                <p className="text-[#94A3B8]" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
                  {issue.hint}
                </p>
              )}
            </div>
          ))}
          <p className="text-[#94A3B8]" style={{ fontSize: 11, margin: 0 }}>
            Click the cell to edit it here.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/* Per-row outcome, the way the Users sheet leads its table: Ready, Warning or
   Error, so the row states its own verdict before you read its cells. */
function ResultChip({ row }: { row: SheetRow }) {
  const palette = row._skipped
    ? { bg: "#F1F5F9", text: "#475569", label: "Dropped" }
    : row.issues.some((i) => i.level === "error")
      ? { bg: "#FEF2F2", text: "#B91C1C", label: "Error" }
      : row.issues.length > 0
        ? { bg: "#FFFBEB", text: "#B45309", label: "Warning" }
        : { bg: "#ECFDF5", text: "#065F46", label: "Ready" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ fontSize: 11, fontWeight: 600, background: palette.bg, color: palette.text }}
    >
      {palette.label}
    </span>
  );
}

function Chip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: "ready" | "error" | "warning";
  active: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === "error"
      ? { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" }
      : tone === "warning"
        ? { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" }
        : tone === "ready"
          ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }
          : { bg: "#EDF4FF", text: "#0A77FF", border: "#0A77FF" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 cursor-pointer transition-colors"
      style={{
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        background: active ? palette.bg : "#FFFFFF",
        color: active ? palette.text : "#64748B",
        borderColor: active ? palette.border : "#E2E8F0",
      }}
    >
      {label}
      <span
        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums"
        style={{ fontSize: 11, background: active ? "rgba(10,119,255,0.1)" : "#F1F5F9", color: active ? palette.text : "#475569" }}
      >
        {count}
      </span>
    </button>
  );
}

