import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  X, Search, AlertCircle, AlertTriangle, Check, Layers, Wrench, Trash2,
  Package, Minimize2, Maximize2, ChevronDown, History, RotateCcw, Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/app/components/ui/dropdown-menu";
import {
  ENTITY_META, KEY_COLUMN, RECORD_COLUMNS, RECORD_LABEL, RECORD_NOUN, RECORD_NOUN_PLURAL, STATUS_COLUMN,
} from "./importSpec";
import { validateRecords, suggestNextKey, entityColumnsFor } from "./importValidate";
import type { ValidateOptions } from "./importValidate";
import { splitList } from "./importParse";
import type {
  EntityGap, ImportRecord, Issue, RecordStatus,
  EntityKind,
} from "./importModel";
import type { CatalogKey } from "./importCatalog";
import { LineItemsSheet } from "./LineItemsSheet";
import { EntityPickerHost } from "./EntityPickerHost";
import { CustomerResolveOverlay } from "./CustomerResolveOverlay";
import { ContactCellPicker } from "./ContactCellPicker";
import { BulkApplyConfirm } from "./BulkApplyConfirm";
import { ImportCompleteDialog } from "./ImportCompleteDialog";
import { AdjustmentCell } from "./AdjustmentCell";
import { CellEditor, CellAffordance, cellDisplay } from "./CellEditor";
import { IssueHoverCard } from "./IssueHoverCard";
import { ImportAdjustmentsModal, type AdjustmentTarget } from "./ImportAdjustmentsModal";
import { RECORD_ADJUSTMENT_KEY, LINE_ADJUSTMENT_KEY, parseAdjustmentList, netImpact } from "./importAdjustments";

export interface ImportOutcome {
  created: ImportRecord[];
  skipped: ImportRecord[];
  failed: ImportRecord[];
  warningCount: number;
  /* Carried through so the records this run creates can say where they
     came from: the run's description and the file that fed it end up on
     each record's Legacy Import pill. */
  importName?: string;
  fileName?: string;
}

/**
 * What a set of rows is worth.
 *
 * The complete dialog reports the batch's financial impact, and the only
 * source that knows it at this point is the sheet: line quantity × price,
 * plus the one-time adjustments from both template levels resolved the way
 * the module resolves them (a percentage against the base it applies to).
 */
function priceRecords(records: ImportRecord[]) {
  let subtotal = 0;
  let adjustments = 0;
  let lineCount = 0;
  let largest: { label: string; value: number } | undefined;

  for (const r of records) {
    let recordSubtotal = 0;
    for (const line of r.lines) {
      const qty = parseFloat((line.values.lineQuantity ?? "").trim()) || 0;
      const price = parseFloat((line.values.linePricePerUnit ?? "").trim()) || 0;
      const base = qty * price;
      recordSubtotal += base;
      lineCount += 1;
      adjustments += netImpact(parseAdjustmentList(line.values[LINE_ADJUSTMENT_KEY]), base);
    }
    const recordAdj = netImpact(parseAdjustmentList(r.values[RECORD_ADJUSTMENT_KEY]), recordSubtotal);
    adjustments += recordAdj;
    subtotal += recordSubtotal;
    const value = recordSubtotal + recordAdj;
    if (!largest || value > largest.value) {
      largest = { label: (r.values.soNumber ?? "").trim() || "Untitled", value };
    }
  }
  return { subtotal, adjustments, lineCount, largest };
}

/* Format the suggestion falls back to when a cell is empty. */
const KEY_COLUMN_SAMPLE = (KEY_COLUMN as string) === "quoteNo" ? "Q-000-000-000" : "SO-000-000-000";

type Filter = "all" | "ready" | "errors" | "warnings";

/**
 * Review and Fix Your Data.
 *
 * Ported from the User Access Control review sheet: same shell, same
 * filter chips, same full-view toggle, same footer, same completion
 * dialog. What changed is the unit of a row.
 *
 * UAC reviews one user per spreadsheet row. Our templates flatten a
 * non-linear record across as many rows as it has line items, so this
 * grid shows one row per quote or order and folds the lines into a single
 * summary cell ("4 items · 2 to fix") that opens a nested sheet. Without
 * that fold, a five-record file with forty lines would read as forty rows
 * and the record boundaries would be invisible.
 *
 * The second change is what a bad cell offers. UAC fixes an unknown role
 * from a dropdown. Here an unknown customer or item belongs to another
 * module that this import may not write to, so the cell offers a wrench
 * that opens the resolve dialog: repoint at a real record, optionally
 * across every twin of the same misspelling, or go create it and leave
 * the record failed for a later pass.
 */
export function ImportReviewModal({
  open,
  fileName,
  importName,
  records: initialRecords,
  validateOptions,
  onClose,
  onApplied,
  onGoToListing,
}: {
  open: boolean;
  fileName: string;
  /** What the user called this run in the wizard, shown beside the file. */
  importName?: string;
  records: ImportRecord[];
  validateOptions?: ValidateOptions;
  onClose: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  onGoToListing?: () => void;
}) {
  const [records, setRecords] = useState<ImportRecord[]>(initialRecords);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [fullView, setFullView] = useState(false);
  const [openLinesFor, setOpenLinesFor] = useState<string | null>(null);
  const [resolving, setResolving] = useState<EntityGap | null>(null);
  /* A pick made in the module's search overlay, held while we ask whether
     to apply it to every twin. */
  const [pendingPick, setPendingPick] = useState<{ gap: EntityGap; value: string } | null>(null);
  const [editing, setEditing] = useState<{ recordId: string; field: string } | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  /* UAC runs the import behind a blocker before the complete dialog: the grid
     dims, a spinner counts records processed, then the summary appears. Same
     phase shape and the same 2400ms window. */
  const [phase, setPhase] = useState<{ processed: number; total: number } | null>(null);

  const summary = useMemo(
    () => validateRecords(records, validateOptions ?? {}),
    [records, validateOptions],
  );

  const active = records.filter((r) => !r.excluded);

  const statusOf = useCallback(
    (r: ImportRecord): RecordStatus => summary.byRecord[r.id]?.status ?? "ready",
    [summary],
  );

  const visible = useMemo(() => {
    let list = active;
    if (filter === "ready") list = list.filter((r) => statusOf(r) === "ready");
    if (filter === "errors") list = list.filter((r) => statusOf(r) === "error");
    if (filter === "warnings") list = list.filter((r) => statusOf(r) === "warning");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        Object.values(r.values).some((v) => v.toLowerCase().includes(q)) ||
        r.lines.some((l) => Object.values(l.values).some((v) => v.toLowerCase().includes(q))));
    }
    return list;
  }, [active, filter, query, statusOf]);

  /* ── edits ── */

  /* Which record's adjustments are open, and which section first.
     One-time discounts and premiums are edited in the module's own
     adjustments modal rather than as text in a cell. */
  const [adjustingFor, setAdjustingFor] = useState<{ recordId: string; target: AdjustmentTarget } | null>(null);

  const editRecord = (recordId: string, field: string, value: string) =>
    setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, values: { ...r.values, [field]: value } } : r)));

  const editLine = (recordId: string, lineId: string, field: string, value: string) =>
    setRecords((prev) => prev.map((r) => r.id !== recordId ? r : {
      ...r,
      lines: r.lines.map((l) => (l.id === lineId ? { ...l, values: { ...l.values, [field]: value } } : l)),
    }));

  const dropLine = (recordId: string, lineId: string) => {
    setRecords((prev) => prev.map((r) => r.id !== recordId ? r : { ...r, lines: r.lines.filter((l) => l.id !== lineId) }));
    toast.info("Line dropped from this import.");
  };

  const excludeRecord = (recordId: string) => {
    setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, excluded: true } : r)));
    toast.info(`${RECORD_LABEL} removed from this import.`);
  };

  /* ── Bulk disposition ───────────────────────────────────────────────
     Resolving dependencies one dialog at a time is the careful path, and
     it stays. But someone importing a legacy file often already knows
     they do not want the broken rows in this run: they want the clean
     ones in and the rest held back for a second pass. These decide that
     in one action, and `restoreDropped` means the decision is never a
     dead end. Dropping is per record, so a row held back here does not
     stop the rest of the file. */
  const dropByStatus = (statuses: RecordStatus[], label: string) => {
    const ids = new Set(active.filter((r) => statuses.includes(statusOf(r))).map((r) => r.id));
    if (ids.size === 0) return;
    setRecords((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, excluded: true } : r)));
    toast.info(
      `${ids.size} ${ids.size === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL} dropped (${label}). Kept in Data Imports to finish later.`,
    );
  };

  const restoreDropped = () => {
    const n = records.filter((r) => r.excluded).length;
    if (n === 0) return;
    setRecords((prev) => prev.map((r) => (r.excluded ? { ...r, excluded: false } : r)));
    toast.info(`${n} ${n === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL} restored to this import.`);
  };

  /**
   * Replace one dependency value. `all` rewrites every cell in the file
   * holding it, at record and line level alike, which is what makes one
   * misspelling a single fix instead of one per row.
   */
  /* How many cells in this import still hold a given value for an entity.
     Drives the "apply everywhere?" prompt after a single fix. */
  const countCellsHolding = (entity: EntityKind, raw: string): number => {
    const target = raw.trim().toLowerCase();
    if (!target) return 0;
    const cols = entityColumnsFor(entity as CatalogKey);
    let n = 0;
    for (const r of records) {
      for (const key of cols) {
        const recordCol = RECORD_COLUMNS.find((c) => c.key === key);
        if (recordCol) {
          const v = r.values[key] ?? "";
          n += splitList(v).filter((p) => p.toLowerCase() === target).length || (v.trim().toLowerCase() === target ? 1 : 0);
        }
      }
      for (const l of r.lines) {
        for (const key of cols) {
          const v = l.values[key] ?? "";
          n += splitList(v).filter((p) => p.toLowerCase() === target).length || (v.trim().toLowerCase() === target ? 1 : 0);
        }
      }
    }
    return n;
  };

  const applyResolution = (gap: EntityGap, replacement: string, scope: "all" | "one") => {
    /* Opened from a specific cell, a pick writes that cell, whatever it held
       before. The value-matching path below is for fixing every cell that
       shares a bad value. */
    if (gap.cell && scope === "one") {
      if (gap.cell.lineId) editLine(gap.cell.recordId, gap.cell.lineId, gap.cell.field, replacement);
      else editRecord(gap.cell.recordId, gap.cell.field, replacement);
      /* The same old value usually sits in other rows too. Ask once, here,
         rather than making someone repeat the fix row by row. */
      const twins = countCellsHolding(gap.entity, gap.rawValue);
      if (twins > 1) setPendingPick({ gap: { ...gap, occurrences: twins, cell: undefined }, value: replacement });
      return;
    }
    const cols = entityColumnsFor(gap.entity as CatalogKey);
    const target = gap.rawValue.trim().toLowerCase();
    const limitTo = scope === "one" ? new Set([gap.recordIds[0]]) : null;

    const swap = (raw: string, isList: boolean) => {
      if (!raw) return raw;
      if (!isList) return raw.trim().toLowerCase() === target ? replacement : raw;
      const parts = splitList(raw);
      if (!parts.some((p) => p.toLowerCase() === target)) return raw;
      return parts.map((p) => (p.toLowerCase() === target ? replacement : p)).join("|");
    };

    setRecords((prev) => prev.map((r) => {
      if (limitTo && !limitTo.has(r.id)) return r;
      const values = { ...r.values };
      for (const key of cols) {
        const col = RECORD_COLUMNS.find((c) => c.key === key);
        if (col && values[key] != null) values[key] = swap(values[key], !!col.list);
      }
      const lines = r.lines.map((l) => {
        const lv = { ...l.values };
        for (const key of cols) {
          if (lv[key] != null) {
            const isList = key === "linePricingRule";
            lv[key] = swap(lv[key], isList);
          }
        }
        return { ...l, values: lv };
      });
      return { ...r, values, lines };
    }));

    const count = scope === "all" ? gap.occurrences : 1;
    toast.success(`Replaced "${gap.rawValue}" with "${replacement}" in ${count} cell${count === 1 ? "" : "s"}.`);
    setResolving(null);
  };

  /** Build a gap on demand so a single cell's wrench can open the dialog. */
  /* Clicking a cell that points at another module opens that module's own
     picker, not a text box: the value has to exist over there, and the picker
     is where it can be found or created. Both overlays are keyed by entity, so
     this is the same path an error's wrench takes, minus the error. */
  const openEntityPicker = (
    entity: EntityKind,
    current: string,
    cell?: { recordId: string; lineId?: string; field: string },
  ) =>
    /* The cell travels with the request. Without it a pick had nowhere to
       land: `applyResolution` rewrites cells that match the old value, and a
       cell whose value is already valid matches nothing to rewrite. */
    setResolving({
      entity,
      rawValue: current.trim(),
      occurrences: 1,
      recordIds: cell ? [cell.recordId] : [],
      cell,
    });

  const gapFor = (issue: Issue): EntityGap | null => {
    if (!issue.entity || !issue.rawValue) return null;
    const found = summary.entityGaps.find(
      (g) => g.entity === issue.entity && g.rawValue.toLowerCase() === issue.rawValue!.toLowerCase());
    return found ?? { entity: issue.entity, rawValue: issue.rawValue, occurrences: 1, recordIds: [] };
  };

  const startImport = () => {
    const created: ImportRecord[] = [];
    const skipped: ImportRecord[] = [];
    const failed: ImportRecord[] = [];
    let warningCount = 0;
    for (const r of active) {
      const v = summary.byRecord[r.id];
      if (!v) continue;
      const isSkip = v.issues.some((i) => i.code === "ALREADY_IMPORTED");
      if (v.status === "error") failed.push(r);
      else if (isSkip) skipped.push(r);
      else {
        created.push(r);
        if (v.status === "warning") warningCount++;
      }
    }
    const out = { created, skipped, failed, warningCount, importName, fileName };

    /* Count the records through, then finish. Nothing here is a real network
       call, so the window is UAC's fixed 2400ms rather than progress from a
       server. */
    const total = created.length;
    setPhase({ processed: 0, total });
    const startedAt = performance.now();
    const durationMs = 2400;
    let raf = 0;
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - startedAt) / durationMs);
      const processed = Math.min(total, Math.floor(ratio * total));
      setPhase((cur) => (cur ? { ...cur, processed } : cur));
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      cancelAnimationFrame(raf);
      setPhase(null);
      setOutcome(out);
      onApplied?.(out);
    };
    raf = requestAnimationFrame(tick);
  };

  if (!open) return null;

  if (outcome) {
    return (
      <ImportCompleteDialog
        createdCount={outcome.created.length}
        financials={(() => {
          const created = priceRecords(outcome.created);
          const held = priceRecords([...outcome.failed, ...outcome.skipped]);
          return {
            subtotal: created.subtotal,
            adjustments: created.adjustments,
            lineCount: created.lineCount,
            largest: outcome.created.length > 1 ? created.largest : undefined,
            heldBack: held.subtotal + held.adjustments,
          };
        })()}
        skippedCount={outcome.skipped.length}
        failedCount={outcome.failed.length}
        warningCount={outcome.warningCount}
        onGoToListing={() => { setOutcome(null); onClose(); onGoToListing?.(); }}
        onViewHistory={() => {
          toast.info("Import history lives in Company Setup, Data Imports.");
          setOutcome(null); onClose();
        }}
        /* Card deep-links. UAC routes these to the import detail page on a
           filter tab; that page is not built on this side yet, so each one
           reports what it would open and where. */
        onViewDetail={(filter) => {
          toast.info(
            filter === "failed"
              ? `${outcome.failed.length + outcome.skipped.length} orders held back. Opens this run's detail page, filtered to the rows that did not import.`
              : `${outcome.created.length} orders imported. Opens this run's detail page, filtered to the rows that landed.`,
          );
        }}
      />
    );
  }

  const openRecord = records.find((r) => r.id === openLinesFor) ?? null;
  /* The module's search overlay portals to body at z-index 10001 and takes
     over the screen. Rather than edit that shared component, this modal
     steps beneath it for as long as it is open. */
  /* Every one of these opens a modal that belongs to the module (the search
     overlay, the payment libraries, the rep selector), each portalled at its
     own z-index. This shell steps beneath them rather than those shared
     components being re-layered for the importer. */
  const customerOverlayOpen =
    !!resolving && ["customer", "contact", "location", "paymentTerm", "paymentMethod", "pricingRule"].includes(resolving.entity);
  const stepUnder = customerOverlayOpen;
  const importable = summary.readyCount + summary.warningCount;
  const droppedCount = records.filter((r) => r.excluded).length;

  /* "Review missing records" used to open entityGaps[0] and close on resolve,
     which told nobody what the other three were or that they existed. A file
     usually has several distinct unknown values spread over several columns,
     so the menu lists them: which module each belongs to, the value itself,
     and how many cells carry it. Picking one opens the picker for that value,
     and the existing apply-everywhere prompt covers its twins. Grouped by
     entity, biggest first, because thirty unknown items matter more than one
     unknown payment term. */
  const gapGroups = useMemo(() => {
    const by = new Map<EntityKind, EntityGap[]>();
    for (const g of summary.entityGaps) {
      const list = by.get(g.entity) ?? [];
      list.push(g);
      by.set(g.entity, list);
    }
    return [...by.entries()]
      .map(([entity, list]) => ({
        entity,
        gaps: [...list].sort((a, b) => b.occurrences - a.occurrences),
      }))
      .sort((a, b) => b.gaps.length - a.gaps.length);
  }, [summary.entityGaps]);

  /* Hard cap so the submenu never becomes a directory, the same rule Partner
     puts on OverflowTooltip. Anything past it is reachable from the cells. */
  const GAP_MENU_CAP = 12;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: stepUnder ? 9990 : 12300, background: "rgba(15,23,42,0.6)" }}
    >
      <div
        className="flex flex-col bg-white"
        style={{
          width: fullView ? "calc(100vw - 24px)" : "min(1480px, calc(100vw - 48px))",
          height: fullView ? "calc(100vh - 24px)" : "auto",
          /* A floor as well as a ceiling. Without it the sheet shrink-wraps to
             its row count, so a three-row import produced a parent shorter
             than the line-items child that opens on top of it. 720 keeps the
             parent above the child's 640 at every import size. */
          minHeight: fullView ? undefined : "min(720px, calc(100vh - 64px))",
          maxHeight: fullView ? undefined : "min(900px, calc(100vh - 64px))",
          borderRadius: 14, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.3)",
        }}
      >
        {/* ── header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] text-slate-900" style={{ fontWeight: 650 }}>Review and Fix Your Data</h2>
              <span className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-[10.5px]"
                    style={{ fontWeight: 600 }}>
                <History className="w-3 h-3" /> Legacy Import
              </span>
              <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-slate-100 border border-border text-slate-600 text-[10.5px]"
                    style={{ fontWeight: 600 }}>
                V1 only
              </span>
            </div>
            <p className="text-[12.5px] text-slate-500 mt-1">
              Check your {RECORD_NOUN_PLURAL} before importing. {RECORD_LABEL}s with errors will not be imported until you fix them.{" "}
              {RECORD_LABEL}s with warnings import as they are.
              {importName && <span className="text-slate-400"> · {importName}</span>}
              {fileName && <span className="text-slate-400"> · {fileName}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFullView((f) => !f)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullView ? "Exit Full View" : "Full View"}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── toolbar + chips ── */}
        <div className="px-6 shrink-0">
          <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-muted">
              <div className="relative flex-1" style={{ maxWidth: 320 }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${RECORD_NOUN_PLURAL}, customers, items...`}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <span className="ml-auto text-[12.5px] text-slate-500" style={{ fontWeight: 500 }}>
                <span className="text-slate-900" style={{ fontWeight: 600 }}>{visible.length}</span> of {active.length} {RECORD_NOUN_PLURAL}
              </span>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-b border-muted flex-wrap">
              <Chip label="Show All" count={active.length} active={filter === "all"} onClick={() => setFilter("all")} />
              <Chip label="Ready" count={summary.readyCount} tone="green" active={filter === "ready"} onClick={() => setFilter("ready")} />
              <Chip label="Errors" count={summary.errorCount} tone="red" active={filter === "errors"} onClick={() => setFilter("errors")} />
              <Chip label="Warnings" count={summary.warningCount} tone="amber" active={filter === "warnings"} onClick={() => setFilter("warnings")} />

              {(summary.entityGaps.length > 0 || droppedCount > 0) && (
                <div className="ml-auto flex items-center gap-2">
                  {summary.entityGaps.length > 0 && (
                    <span className="text-[11.5px] text-slate-500">
                      {summary.entityGaps.length} missing record{summary.entityGaps.length === 1 ? "" : "s"} to resolve
                    </span>
                  )}
                  {droppedCount > 0 && (
                    <span className="text-[11.5px] text-slate-400">
                      {droppedCount} dropped
                    </span>
                  )}
                  {/* The chevron used to be decoration on a button that only
                      ever opened the first gap. It opens a real menu now, and
                      every entry says what it does to the rows. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-accent text-primary text-[12px] hover:bg-blue-100 cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Resolve
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[268px]" style={{ zIndex: 12460 }}>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        Fix
                      </DropdownMenuLabel>
                      {summary.entityGaps.length === 0 ? (
                        <DropdownMenuItem disabled>
                          <Wrench className="w-3.5 h-3.5 text-slate-500" />
                          <span className="flex-1">Nothing left to match</span>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="cursor-pointer">
                            <Wrench className="w-3.5 h-3.5 text-slate-500" />
                            <span className="flex-1">Match a missing record</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">{summary.entityGaps.length}</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[300px]" style={{ zIndex: 12470 }}>
                            {gapGroups.map(({ entity, gaps }) => (
                              <div key={entity}>
                                {/* "Items in Items" and "Warehouses in
                                    Warehouses" are what naming both halves
                                    gets you when a module is named after the
                                    record it holds. Collapse those. */}
                                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                                  {(() => {
                                    const noun = `${ENTITY_META[entity].noun}s`;
                                    const mod = ENTITY_META[entity].module;
                                    return noun.toLowerCase() === mod.toLowerCase() ? mod : `${noun} in ${mod}`;
                                  })()}
                                </DropdownMenuLabel>
                                {gaps.slice(0, GAP_MENU_CAP).map((g) => (
                                  <DropdownMenuItem
                                    key={`${entity}-${g.rawValue}`}
                                    onClick={() => setResolving(g)}
                                    className="cursor-pointer"
                                  >
                                    <span className="flex-1 truncate" title={g.rawValue}>{g.rawValue || "(blank)"}</span>
                                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                      {g.occurrences} {g.occurrences === 1 ? "cell" : "cells"}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                                {gaps.length > GAP_MENU_CAP && (
                                  <div className="px-2 py-1">
                                    <p className="text-[11px] text-muted-foreground/70" style={{ margin: 0 }}>
                                      and {gaps.length - GAP_MENU_CAP} more, reachable from the cells.
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 flex items-start gap-1.5">
                              <Info className="w-3 h-3 mt-[2px] shrink-0 text-muted-foreground/40" />
                              <p className="text-[11px] text-muted-foreground/80" style={{ margin: 0, lineHeight: 1.45 }}>
                                Picking one opens the record picker for that value. If the
                                same value sits on other rows, you are asked once whether
                                to fix them all.
                              </p>
                            </div>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuSeparator />
                      {/* "Drop" and "Restore" are the words the UAC sheet
                          importer uses for the same two actions, and its
                          recorded outcome for a dropped row is "Skipped". Same
                          vocabulary here so a row dropped in this module reads
                          the same way when it turns up in Data Imports. */}
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        Or drop them for now
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={summary.errorCount === 0}
                        onClick={() => dropByStatus(["error"], "rows with errors")}
                        className="cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="flex-1">Drop rows with errors</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{summary.errorCount}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={summary.errorCount + summary.warningCount === 0}
                        onClick={() => dropByStatus(["error", "warning"], "rows with errors or warnings")}
                        className="cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="flex-1">Drop rows with warnings too</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{summary.errorCount + summary.warningCount}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={droppedCount === 0}
                        onClick={restoreDropped}
                        className="cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span className="flex-1">Restore dropped rows</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{droppedCount}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {/* The one thing the actions above cannot say for
                          themselves: dropping is not discarding. */}
                      <div className="px-2 py-1.5 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-[2px] shrink-0 text-muted-foreground/40" />
                        <p className="text-[11px] text-muted-foreground/80" style={{ margin: 0, lineHeight: 1.45 }}>
                          Dropped {RECORD_NOUN_PLURAL} are kept, not discarded. Fix and
                          import them later from Company Setup, Data Imports.
                        </p>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* ── grid ── */}
            <div className="flex-1 overflow-auto relative" style={{ minHeight: 0 }}>
              <AnimatePresence>
                {phase && (
                  <motion.div
                    key="import-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-[1px] pointer-events-auto"
                  >
                    <div
                      className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-white border border-border"
                      style={{ boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)" }}
                    >
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
                      <p className="text-foreground" style={{ fontSize: "14px", fontWeight: 600 }}>
                        Importing {phase.total} {phase.total === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL}...
                      </p>
                      <p className="text-slate-500 tabular-nums" style={{ fontSize: "12.5px" }}>
                        Importing... {phase.processed} of {phase.total} {RECORD_NOUN_PLURAL} processed
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {visible.length === 0 ? (
                <div className="py-16 text-center">
                  <Layers className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-[13px] text-slate-600 mt-2" style={{ fontWeight: 600 }}>Nothing to show</p>
                  <p className="text-[12px] text-slate-400 mt-1">
                    {query ? "No match for your search." : "No records under this filter."}
                  </p>
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <Th style={{ width: 40 }}>#</Th>
                      <Th style={{ width: 100 }}>Result</Th>
                      <Th style={{ width: 200, minWidth: 200 }}>Line Items</Th>
                      {RECORD_COLUMNS.map((c) => (
                        /* A column is sized, not sized-by-content: a cell
                           holding four pipe-joined addresses used to stretch
                           its column past the whole sheet. */
                        <Th key={c.key} style={{ minWidth: c.width ?? 140, maxWidth: (c.width ?? 140) + 60 }}>
                          {c.label}
                          {c.requirement === "required" && <span className="text-red-500"> *</span>}
                          {c.requirement === "conditional" && <span className="text-amber-500"> †</span>}
                        </Th>
                      ))}
                      <Th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, idx) => {
                      const v = summary.byRecord[r.id];
                      const st = v?.status ?? "ready";
                      const errLines = v?.errorLineIds.length ?? 0;
                      const warnLines = v?.warningLineIds.length ?? 0;
                      return (
                        <tr key={r.id} className={`group/row ${st === "error" ? "bg-red-50/30" : st === "warning" ? "bg-amber-50/20" : ""}`}>
                          <Td className="text-slate-400">{idx + 1}</Td>
                          <Td><StatusPill status={st} /></Td>
                          <Td>
                            <button
                              onClick={() => setOpenLinesFor(r.id)}
                              className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border text-[11.5px] cursor-pointer transition-colors whitespace-nowrap ${
                                errLines > 0
                                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  : warnLines > 0
                                    ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                    : "border-border bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              style={{ fontWeight: 600 }}
                            >
                              <Package className="w-3 h-3" />
                              {r.lines.length} item{r.lines.length === 1 ? "" : "s"}
                              {errLines > 0 && <> · {errLines} to fix</>}
                              {errLines === 0 && warnLines > 0 && <> · {warnLines} warn</>}
                            </button>
                          </Td>
                          {RECORD_COLUMNS.map((c) => {
                            const issues = v?.byField[c.key] ?? [];
                            const worst = issues.find((i) => i.severity === "error") ?? issues[0];
                            const value = r.values[c.key] ?? "";
                            const isEditing = editing?.recordId === r.id && editing.field === c.key;
                            const entityFix = worst?.code === "ENTITY_NOT_FOUND";
                            return (
                              <Td
                                key={c.key}
                                bg={worst ? (worst.severity === "error" ? "rgba(254,226,226,0.55)" : "rgba(254,243,199,0.5)") : undefined}
                                pad={false}
                              >
                                {c.key === RECORD_ADJUSTMENT_KEY ? (
                                  /* One-time adjustments are objects, not
                                     text: chips here, the module's modal
                                     for changing them. */
                                  <AdjustmentCell
                                    raw={value}
                                    base={r.lines.reduce((sum, l) =>
                                      sum + (parseFloat(l.values.lineQuantity ?? "") || 0) * (parseFloat(l.values.linePricePerUnit ?? "") || 0), 0)}
                                    onEdit={() => setAdjustingFor({ recordId: r.id, target: { kind: "record" } })}
                                  />
                                ) : isEditing ? (
                                  <CellEditor
                                    column={c}
                                    value={value}
                                    onCommit={(next) => { editRecord(r.id, c.key, next); setEditing(null); }}
                                    onCancel={() => setEditing(null)}
                                  />
                                ) : (
                                  <IssueHoverCard issues={issues}>
                                  <div
                                    className="px-3 py-2 flex items-start gap-1.5 cursor-pointer"
                                    title={issues.length ? undefined : cellDisplay(c, value).title}
                                    /* The whole cell is the target, the way a
                                       sheet cell behaves; the text alone left
                                       most of the cell dead. */
                                    onClick={() => {
                                      /* Reps are picked in the cell; the rest
                                         open their module's modal. */
                                      if (c.entity && c.entity !== "user") openEntityPicker(c.entity, value, { recordId: r.id, field: c.key });
                                      else setEditing({ recordId: r.id, field: c.key });
                                    }}
                                  >
                                    <button
                                      tabIndex={-1}
                                      className="text-left text-[12.5px] text-slate-700 min-w-0 flex-1 truncate cursor-text hover:text-slate-900"
                                    >
                                      {cellDisplay(c, value).text || <span className="text-slate-300">—</span>}
                                    </button>
                                    <CellAffordance column={c} />
                                    {/* A number that already exists blocks the row.
                                        Same inline fix affordance as an unknown
                                        entity, offering the next free number. */}
                                    {worst?.code === "ALREADY_IMPORTED" && (() => {
                                      const suggestion = suggestNextKey(validateOptions?.alreadyImported, value || KEY_COLUMN_SAMPLE);
                                      return (
                                        <button
                                          onClick={() => { editRecord(r.id, KEY_COLUMN, suggestion); toast.success(`Renumbered to ${suggestion}.`); }}
                                          title={`Use the next free number, ${suggestion}`}
                                          className="shrink-0 mt-[1px] inline-flex items-center justify-center w-5 h-5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                                        >
                                          <Wrench className="w-3 h-3" />
                                        </button>
                                      );
                                    })()}
                                    {entityFix && (
                                      <button
                                        onClick={() => { const g = gapFor(worst!); if (g) setResolving(g); }}
                                        title={worst!.message}
                                        className="shrink-0 mt-[1px] inline-flex items-center justify-center w-5 h-5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Wrench className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  </IssueHoverCard>
                                )}
                              </Td>
                            );
                          })}
                          <Td>
                            <button
                              onClick={() => excludeRecord(r.id)}
                              title={`Remove this ${RECORD_NOUN} from the import`}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── footer ── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <p className="text-[12px] text-slate-500">
            {summary.errorCount > 0 ? (
              <>
                <span className="text-red-600" style={{ fontWeight: 600 }}>{summary.errorCount}</span>{" "}
                {RECORD_NOUN}{summary.errorCount === 1 ? "" : "s"} will not import. They are kept and can be finished from
                Company Setup, Data Imports.
              </>
            ) : (
              <>All {active.length} {RECORD_NOUN_PLURAL} are ready to import.</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              disabled={importable === 0}
              onClick={startImport}
              className="h-9 px-4 rounded-lg text-[13px] cursor-pointer disabled:cursor-not-allowed transition-colors"
              style={{ fontWeight: 600,
                       background: importable > 0 ? "var(--primary)" : "var(--muted)",
                       color: importable > 0 ? "#FFFFFF" : "var(--muted-foreground)" }}
            >
              Start Import{importable > 0 ? ` (${importable})` : ""}
            </button>
          </div>
        </div>
      </div>

      {adjustingFor && (() => {
        const target = records.find((r) => r.id === adjustingFor.recordId);
        if (!target) return null;
        return (
          <ImportAdjustmentsModal
            record={target}
            target={adjustingFor.target}
            onCommit={(value) => {
              if (adjustingFor.target.kind === "record") editRecord(target.id, RECORD_ADJUSTMENT_KEY, value);
              else editLine(target.id, adjustingFor.target.lineId, LINE_ADJUSTMENT_KEY, value);
            }}
            onClose={() => setAdjustingFor(null)}
          />
        );
      })()}


      {openRecord && (
        <LineItemsSheet

          record={openRecord}
          validation={summary.byRecord[openRecord.id]}
          onEditLine={(lineId, field, value) => editLine(openRecord.id, lineId, field, value)}
          onEditAdjustments={(lineId) => setAdjustingFor({ recordId: openRecord.id, target: { kind: "line", lineId } })}
          onOpenEntity={openEntityPicker}
          onDropLine={(lineId) => dropLine(openRecord.id, lineId)}
          onResolveIssue={(issue) => { const g = gapFor(issue); if (g) setResolving(g); }}
          onClose={() => setOpenLinesFor(null)}
        />
      )}

      {/* Customers, their locations and their contacts are resolved on the
          module's own search overlay, the one behind the change-customer
          flow, because it already searches all three together. Everything
          else uses the compact list dialog. */}
      {resolving && resolving.entity === "customer" && (
        <CustomerResolveOverlay
          open
          entity={resolving.entity}
          onPick={(value) => {
            if (resolving.occurrences > 1) setPendingPick({ gap: resolving, value });
            else applyResolution(resolving, value, "one");
            setResolving(null);
          }}
          onClose={() => setResolving(null)}
        />
      )}

      {/* Contacts: the module's "Select Point of Contact" modal, scoped to the
          row's customer. */}
      {resolving && resolving.entity === "contact" && (
        <ContactCellPicker
          customerName={
            (resolving.cell
              ? records.find((r) => r.id === resolving.cell!.recordId)?.values.customerName
              : undefined) ?? ""
          }
          value={resolving.rawValue}
          multiple={!!RECORD_COLUMNS.find((c) => c.key === resolving.cell?.field)?.list}
          onCommit={(next) => { if (resolving.cell) applyResolution(resolving, next, "one"); }}
          onClose={() => setResolving(null)}
        />
      )}

      {resolving && !["customer", "contact"].includes(resolving.entity) && (
        <EntityPickerHost
          gap={resolving}
          customerName={records.find((r) => r.id === (openLinesFor ?? ""))?.values.customerName
            ?? records[0]?.values.customerName}
          onApply={(replacement, scope) => applyResolution(resolving, replacement, scope)}
          onClose={() => setResolving(null)}
        />
      )}

      {pendingPick && (
        <BulkApplyConfirm
          gap={pendingPick.gap}
          replacement={pendingPick.value}
          onApply={(scope) => { applyResolution(pendingPick.gap, pendingPick.value, scope); setPendingPick(null); }}
          onCancel={() => setPendingPick(null)}
        />
      )}
    </div>,
    document.body,
  );
}

/* ── bits ── */

function Chip({
  label, count, active, tone, onClick,
}: { label: string; count: number; active: boolean; tone?: "green" | "red" | "amber"; onClick: () => void }) {
  const tint = tone === "green" ? "#047857" : tone === "red" ? "#B91C1C" : tone === "amber" ? "#92400E" : "var(--foreground)";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] cursor-pointer transition-colors ${
        active ? "border-primary bg-accent" : "border-border bg-white hover:bg-slate-50"
      }`}
      style={{ fontWeight: active ? 600 : 500, color: active ? "var(--primary)" : "#475569" }}
    >
      {label}
      <span
        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]"
        style={{ fontWeight: 700, background: active ? "var(--primary-100, #DBEAFE)" : "var(--surface-secondary)", color: active ? "var(--primary)" : tint }}
      >
        {count}
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: RecordStatus }) {
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[10.5px]" style={{ fontWeight: 600 }}>
      <AlertCircle className="w-3 h-3" /> Error
    </span>
  );
  if (status === "warning") return (
    <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px]" style={{ fontWeight: 600 }}>
      <AlertTriangle className="w-3 h-3" /> Warning
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px]" style={{ fontWeight: 600 }}>
      <Check className="w-3 h-3" /> Ready
    </span>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      className="bg-slate-50 border-b border-border text-left px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap"
      style={{ fontWeight: 600, ...style }}
    >
      {children}
    </th>
  );
}

function Td({
  children, className, bg, pad = true,
}: { children?: React.ReactNode; className?: string; bg?: string; pad?: boolean }) {
  return (
    <td
      className={`border-b border-muted align-top ${pad ? "px-3 py-2" : ""} ${className ?? ""}`}
      style={{ background: bg, fontSize: 12.5 }}
    >
      {children}
    </td>
  );
}
