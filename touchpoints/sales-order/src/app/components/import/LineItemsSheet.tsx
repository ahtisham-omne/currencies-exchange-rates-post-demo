import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, AlertTriangle, Check, Trash2, Wrench } from "lucide-react";
import { LINE_COLUMNS } from "./importSpec";
import { UomCellDropdown } from "./UomCellDropdown";
import { AdjustmentCell } from "./AdjustmentCell";
import { CellEditor, CellAffordance, cellDisplay } from "./CellEditor";
import { IssueHoverCard } from "./IssueHoverCard";
import { LINE_ADJUSTMENT_KEY } from "./importAdjustments";
import type { EntityKind, ImportLine, ImportRecord, Issue, RecordValidation } from "./importModel";

/**
 * The line items behind one record.
 *
 * A quote or order can carry a dozen lines, so they cannot live in the
 * review grid's row. The grid shows a summary cell instead, and this sheet
 * is what opens from it: every line, its own cells, and its own issues,
 * fixable in place. Lines that need attention sort to the top, because
 * with eleven lines and one bad unit the user should not have to hunt.
 *
 * A line can also be dropped. That is the escape hatch for a legacy line
 * pointing at a part number retired years ago: remove the line and the
 * rest of the record still imports.
 */
export function LineItemsSheet({
  record,
  validation,
  onEditLine,
  onEditAdjustments,
  onOpenEntity,
  onDropLine,
  onResolveIssue,
  onClose,
}: {
  record: ImportRecord;
  validation: RecordValidation | undefined;
  onEditLine: (lineId: string, field: string, value: string) => void;
  /** Opens the adjustments modal for ONE line. The modal is owned by the
   *  review shell, which holds the whole record. */
  onEditAdjustments: (lineId: string) => void;
  /** Opens the owning module's picker for an entity cell (item, pricing rule).
   *  The overlays belong to the review shell, which holds the whole record. */
  onOpenEntity: (entity: EntityKind, current: string, cell: { recordId: string; lineId: string; field: string }) => void;

  onDropLine: (lineId: string) => void;
  onResolveIssue: (issue: Issue) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<{ lineId: string; field: string } | null>(null);
  const byLine = validation?.byLine ?? {};

  const rank = (l: ImportLine) => {
    const f = byLine[l.id];
    if (!f) return 2;
    const arr = Object.values(f).flat();
    if (arr.some((i) => i.severity === "error")) return 0;
    if (arr.length) return 1;
    return 2;
  };
  const lines = [...record.lines].sort((a, b) => rank(a) - rank(b));
  const errorCount = validation?.errorLineIds.length ?? 0;
  const warnCount = validation?.warningLineIds.length ?? 0;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12350, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-white"
        /* Partner's nested-modal geometry: a *fixed* height, not `auto`, so a
           record with one line reads as a child of the review modal rather
           than a compact strip. Partner sizes its modal-inside-a-modal at
           `min(640px, 85vh)` (CreatePartnerModal, CreatePartnerGroupModal);
           the width stays wider than Partner's 680px because this one carries
           a thirteen-column sheet. Smaller than its parent, still clearly a
           modal. */
        style={{ width: "min(1100px, calc(100vw - 96px))",
                 height: "min(640px, 85vh)", maxHeight: "min(640px, 85vh)",
                 borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-muted shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15.5px] text-slate-900" style={{ fontWeight: 650 }}>
              Line items on {record.values[Object.keys(record.values)[0]] || "this record"}
            </h3>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              {record.lines.length} line{record.lines.length === 1 ? "" : "s"}
              {errorCount > 0 && <> · <span className="text-red-600" style={{ fontWeight: 600 }}>{errorCount} to fix</span></>}
              {warnCount > 0 && <> · <span className="text-amber-700" style={{ fontWeight: 600 }}>{warnCount} with warnings</span></>}
              {errorCount === 0 && warnCount === 0 && <> · all good</>}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Slate ground under the rows, so the space a short record leaves
            over reads as the panel it is rather than dead white. */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <table className="w-full bg-white" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-slate-50 border-b border-border text-left px-3 py-2 text-[11px] text-slate-400"
                    style={{ fontWeight: 600, width: 40 }}>#</th>
                <th className="bg-slate-50 border-b border-border text-left px-3 py-2 text-[11px] text-slate-400"
                    style={{ fontWeight: 600, width: 96 }}>Result</th>
                {LINE_COLUMNS.map((c) => (
                  <th key={c.key}
                      className="bg-slate-50 border-b border-border text-left px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap"
                      style={{ fontWeight: 600, minWidth: c.width ?? 130 }}>
                    {c.label.replace(/^Line \/ /, "")}
                    {c.requirement === "required" && <span className="text-red-500"> *</span>}
                    {c.requirement === "conditional" && <span className="text-amber-500"> †</span>}
                  </th>
                ))}
                <th className="bg-slate-50 border-b border-border px-3 py-2" style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const fields = byLine[line.id] ?? {};
                const flat = Object.values(fields).flat();
                const isErr = flat.some((x) => x.severity === "error");
                const isWarn = !isErr && flat.length > 0;
                return (
                  <tr key={line.id} className={`group/row ${isErr ? "bg-red-50/40" : isWarn ? "bg-amber-50/30" : ""}`}>
                    <td className="border-b border-muted px-3 py-2 text-[12px] text-slate-400 align-top">{i + 1}</td>
                    <td className="border-b border-muted px-3 py-2 align-top">
                      {isErr ? (
                        <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[10.5px]" style={{ fontWeight: 600 }}>
                          <AlertCircle className="w-3 h-3" /> Error
                        </span>
                      ) : isWarn ? (
                        <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px]" style={{ fontWeight: 600 }}>
                          <AlertTriangle className="w-3 h-3" /> Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px]" style={{ fontWeight: 600 }}>
                          <Check className="w-3 h-3" /> Ready
                        </span>
                      )}
                    </td>
                    {LINE_COLUMNS.map((c) => {
                      const cellIssues = fields[c.key] ?? [];
                      const worst = cellIssues.find((x) => x.severity === "error") ?? cellIssues[0];
                      const isEditing = editing?.lineId === line.id && editing.field === c.key;
                      const value = line.values[c.key] ?? "";
                      const entityFix = worst?.code === "ENTITY_NOT_FOUND";
                      return (
                        <td key={c.key}
                            className="border-b border-muted px-0 py-0 align-top"
                            style={{ background: worst ? (worst.severity === "error" ? "rgba(254,226,226,0.55)" : "rgba(254,243,199,0.5)") : undefined }}>
                          {c.key === LINE_ADJUSTMENT_KEY ? (
                            /* Same treatment as the record-level column:
                               chips, and the module's own modal to edit. */
                            <AdjustmentCell
                              raw={value}
                              base={(parseFloat(line.values.lineQuantity ?? "") || 0) * (parseFloat(line.values.linePricePerUnit ?? "") || 0)}
                              onEdit={() => onEditAdjustments(line.id)}
                            />
                          ) : isEditing && c.key === "lineUnitOfMeasure" ? (
                            /* A unit is a closed set gated by the line's item,
                               so this cell is a dropdown rather than free text. */
                            <UomCellDropdown
                              value={value}
                              itemCode={(line.values.lineItem ?? "").trim()}
                              onCommit={(next) => { onEditLine(line.id, c.key, next); setEditing(null); }}
                              onCancel={() => setEditing(null)}
                            />
                          ) : isEditing ? (
                            <CellEditor
                              column={c}
                              value={value}
                              onCommit={(next) => { onEditLine(line.id, c.key, next); setEditing(null); }}
                              onCancel={() => setEditing(null)}
                            />
                          ) : (
                            <IssueHoverCard issues={cellIssues}>
                            <div
                              className="px-3 py-2 flex items-start gap-1.5 cursor-pointer"
                              onClick={() => {
                                /* An item or a pricing rule lives in another
                                   module, so the cell opens its picker. */
                                if (c.entity && c.entity !== "uom") {
                                  onOpenEntity(c.entity, value, { recordId: record.id, lineId: line.id, field: c.key });
                                  return;
                                }
                                setEditing({ lineId: line.id, field: c.key });
                              }}
                            >
                              <button
                                tabIndex={-1}
                                className="text-left text-[12.5px] text-slate-700 min-w-0 flex-1 cursor-text hover:text-slate-900"
                              >
                                {cellDisplay(c, value).text || <span className="text-slate-300">—</span>}
                              </button>
                              <CellAffordance column={c} />
                              {entityFix && (
                                <button
                                  onClick={() => onResolveIssue(worst!)}
                                  title={`Fix this ${worst!.entity}`}
                                  className="shrink-0 mt-[1px] inline-flex items-center justify-center w-5 h-5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Wrench className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            </IssueHoverCard>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-muted px-2 py-2 align-top">
                      <button
                        onClick={() => onDropLine(line.id)}
                        title="Drop this line from the import"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-muted shrink-0">
          <p className="text-[11.5px] text-slate-500">
            Click a cell to edit it. Dropping a line keeps the rest of the record importable.
          </p>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12.5px] shadow-sm transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
