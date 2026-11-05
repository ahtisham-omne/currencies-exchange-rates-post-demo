/* Review and Fix issue strip (copied from the Partners app's IssuesBanner.tsx), after the Vendor Invoicing payment-proposal issue strip
 * (vendor-invoicing-payments RunProposalStage): flush under the header, one line with the count and
 * what blocks, and a Review dropdown listing every issue separately. Clicking an issue jumps to the
 * cell that has it. */

import { useState } from "react";
import { ChevronDown, ChevronRight, SkipForward, TriangleAlert, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


export interface ReviewIssue {
  rowId: string;
  /** Row number as the grid's # column shows it. */
  rowNumber: number;
  field: string;
  columnLabel: string;
  severity: "error" | "warning";
  message: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The Review list says what is wrong and where; how to fix it (accepted values, examples, "Fix the
 *  value before importing", "Must match an existing location") lives in the cell's own tooltip, so the
 *  list keeps only the fault. The cell tooltip and the failed-rows download keep the full message. */
const INSTRUCTION =
  /^(Fix|Use|See|Shorten|Remove|Enter|Leave|Clear|Pick|List|Add|Set|Choose|Change|Select|Make|Keep|Try|Check|Create|Rename|Split|Move|Delete|Type|Must|Each|Expected|Alternatives|Alternative UOM|Alternative Units)\b/;
const REWRITES: [RegExp, string][] = [
  [/^.+ must be a US number, like .+$/, "Invalid US phone number format."],
  [/^Selling Scope is ALL, so leave (.+) blank, or set the scope to SELECTED\.$/, "$1 is filled, but Selling Scope is ALL."],
  [/^Selling Scope is Specific, so list at least one partner in (.+)\.$/, "$1 is empty, but Selling Scope is Specific."],
  [/^Fill in (.+) only when (.+) is (\S+)\.$/, "$1 is filled, but $2 is not $3."],
  [/^Remove the % sign\.$/, "Contains a % sign."],
  [/ is not a order /, " is not an order "],
  [/, such as .+\.$/, "."],
];
/** Whole-message rewrites, for faults whose second sentence carries the actual problem. */
const FULL_REWRITES: [RegExp, string][] = [
  [/^"(.+)" is the Base UOM\. Alternative UOM cannot repeat the Base UOM\.$/, '"$1" repeats the Base UOM.'],
  [/^"(.+)" is the base unit\. Alternative Units must be a different unit from a different category\.$/, '"$1" repeats the base unit.'],
];
function issueSummary(raw: string): string {
  let message = raw;
  for (const [re, to] of FULL_REWRITES) message = message.replace(re, to);
  const sentences = message.split(/(?<=[.!?])\s+(?=["A-Z])/).map((x) => x.trim()).filter(Boolean);
  const kept = sentences.filter((s, i) => i === 0 || !INSTRUCTION.test(s));
  let first = kept[0] ?? message;
  for (const [re, to] of REWRITES) first = first.replace(re, to);
  return [first, ...kept.slice(1)].join(" ");
}

export function IssuesBanner({
  issues,
  noun,
  onJump,
  errorRowCount = 0,
  onSkipErrorRows,
  skippedRowCount = 0,
  onUndoSkipped,
}: {
  issues: ReviewIssue[];
  noun: string;
  onJump: (issue: ReviewIssue) => void;
  /** Rows with an error (not issues). */
  errorRowCount?: number;
  /** Asks to leave the error rows out of this import (the caller confirms first). */
  onSkipErrorRows?: () => void;
  /** Rows skipped so far in this review. */
  skippedRowCount?: number;
  /** Puts the skipped rows back in the grid. */
  onUndoSkipped?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canUndo = skippedRowCount > 0 && !!onUndoSkipped;
  if (issues.length === 0 && !canUndo) return null;
  /* Counted the way a person sees the grid: highlighted cells, and the rows they sit in. */
  const cellCount = new Set(issues.map((i) => `${i.rowId}::${i.field}`)).size;
  const rowCount = new Set(issues.map((i) => i.rowId)).size;
  return (
    <div className="shrink-0 px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2.5">
      <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
      <p className="text-[12.5px] text-amber-800 min-w-0 truncate" style={{ fontWeight: 500 }}>
        {issues.length > 0 ? (
          <>
            <span style={{ fontWeight: 700 }}>{plural(cellCount, "error", "errors")}</span> found in{" "}
            <span style={{ fontWeight: 700 }}>{plural(rowCount, "row", "rows")}</span>. Fix {cellCount === 1 ? "it" : "them"} to continue the import.
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700 }}>{plural(skippedRowCount, "row", "rows")}</span> skipped from this import.
          </>
        )}
      </p>
      {issues.length > 0 && (
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full border border-amber-300 bg-white text-[12px] text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            style={{ fontWeight: 600 }}
            aria-expanded={open}
          >
            Review
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="z-[200] w-[400px] p-0 bg-white border border-border rounded-xl overflow-hidden"
          style={{ boxShadow: "0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)" }}
        >
          {/* Every issue is an error (there are no warnings): one list; each line starts
              with its row pill, no icon. */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {(() => {
              return (
                <div className="px-2">
                  {issues.map((issue, i) => (
                    <button
                      key={`${issue.rowId}-${issue.field}-${i}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onJump(issue);
                      }}
                      className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                    >
                      {/* The row pill in its own fixed column, so every title and its description line up. */}
                      <span className="shrink-0 w-[60px] flex">
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full border border-[#E2E8F0] bg-[#F1F5F9] text-[#475569] tabular-nums" style={{ fontSize: "11px", fontWeight: 600 }}>
                          Row {issue.rowNumber}
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-5 text-slate-800 truncate" style={{ fontWeight: 600 }}>{issue.columnLabel}</p>
                        <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{issueSummary(issue.message)}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 self-center shrink-0" aria-hidden />
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </PopoverContent>
      </Popover>
      )}
      {issues.length > 0 && ((errorRowCount > 0 && onSkipErrorRows) || canUndo) && (
        /* Sets Review apart from the actions after it, in the strip's own amber. */
        <span aria-hidden className="shrink-0 w-px h-4 bg-amber-300" />
      )}
      {errorRowCount > 0 && onSkipErrorRows && (
        /* The grid's Skip error rows action, at the strip's 26px height, next to Review. */
        <button
          type="button"
          onClick={onSkipErrorRows}
          className="shrink-0 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FCA5A5]"
          style={{ fontSize: "12px", fontWeight: 500 }}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip {errorRowCount} error {errorRowCount === 1 ? "row" : "rows"}
        </button>
      )}
      {canUndo && (
        /* Brings the skipped rows back as they were, at the strip's 26px height. */
        <button
          type="button"
          onClick={onUndoSkipped}
          className="shrink-0 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          style={{ fontSize: "12px", fontWeight: 500 }}
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo skipped {skippedRowCount === 1 ? "row" : "rows"}
        </button>
      )}
      <span className="sr-only">{`Issues found in ${noun} rows`}</span>
    </div>
  );
}
