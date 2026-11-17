import { Download, FileText, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { LOG_TODAY } from "./date-range-field";

/**
 * Export for the entity activity log — the same experience the modules already
 * use for exporting a listing (User Access Control's Export List button and
 * modal): a toolbar button, a modal that states what will be exported, a
 * primary "Export as CSV", and a success toast. CSV is the only format for
 * now, so there is no format to choose: the dialog's job is to say what you
 * are about to get. Its scope banner follows the house export pattern
 * (Category's ExportModal). Exports the events as currently filtered, one
 * row per event.
 */

export type ExportRow = { date: string; time: string; user: string; event: string; changed: string; details: string };

const HEADERS = ["Date", "Time", "User", "Event", "Changed", "Details"];
const cells = (r: ExportRow) => [r.date, r.time, r.user, r.event, r.changed, r.details];

/* ─────────────────────── file builders (dependency-free, so every module can ship them) ─────────────────────── */

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(rows: ExportRow[]): string {
  const lines = [HEADERS.map(escapeCsvCell).join(","), ...rows.map((r) => cells(r).map(escapeCsvCell).join(","))];
  // BOM so Excel reads the UTF-8 (names, en dashes) correctly — same as the Items record export.
  return "﻿" + lines.join("\r\n");
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp(): string {
  const d = new Date(LOG_TODAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────────────── toolbar button (UAC ExportListButton) ─────────────────────── */

export function ExportLogButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-border bg-white px-3 text-foreground shadow-sm outline-none transition-colors hover:bg-muted/40"
    >
      <Download className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />
      <span className="text-sm" style={{ fontWeight: 500 }}>
        Export Log
      </span>
    </button>
  );
}

/* ─────────────────────── modal (UAC ExportListModal) ─────────────────────── */

export function ExportLogModal({
  open,
  onClose,
  entityLabel,
  entityCode,
  rows,
  totalInRange,
  rangeLabel,
}: {
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  entityCode: string;
  /** The events as currently filtered — what gets exported. */
  rows: ExportRow[];
  /** Events in the date range before search / Me mode / pills, so the copy can say whether filters narrowed it. */
  totalInRange: number;
  rangeLabel: string;
}) {
  const narrowed = rows.length !== totalInRange;
  const n = rows.length;
  const stem = `${entityCode}-activity-log-${todayStamp()}`;

  const handleExport = () => {
    downloadFile(`${stem}.csv`, buildCsv(rows), "text/csv;charset=utf-8");
    toast.success("Activity log exported successfully. Check your downloads.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="activity-log-portal flex flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl sm:max-w-[520px] [&>button:last-child]:hidden"
        style={{ width: 520, maxWidth: "calc(100vw - 32px)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#EFF6FF" }}>
              <Download className="h-[18px] w-[18px]" style={{ color: "#2563EB" }} />
            </div>
            <div>
              <DialogTitle className="text-[16px] leading-[22px]" style={{ fontWeight: 650, color: "#0F172A" }}>
                Export Activity Log
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12.5px]" style={{ color: "#64748B", fontWeight: 400 }}>
                Download the activity for {entityLabel.toLowerCase()} {entityCode}.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* The scope, as the house export pattern states it: a bordered
              strip with the count in weight and what it covers beneath. */}
          <div className="flex items-start gap-3 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <FileText className="mt-[2px] h-4 w-4 shrink-0" style={{ color: "#64748B" }} />
            <div>
              <div className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>
                {n} {n === 1 ? "event" : "events"}
              </div>
              <div className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
                {narrowed
                  ? `Your search or filters narrow this to ${n} of the ${totalInRange} events in ${rangeLabel}; only those ${n} will be exported.`
                  : `No search or filters are applied, so all ${n} events in ${rangeLabel} will be exported.`}
              </div>
            </div>
          </div>
          {/* Stays: with no Columns panel, this sentence is what says which
              columns the file carries. */}
          <p className="text-[13px] leading-[19px]" style={{ color: "#334155", fontWeight: 400 }}>
            The exported file will contain: Date, Time, User, Event, Changed, Details.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[8px] border border-[#E2E8F0] bg-white px-4 text-[13px] transition-colors hover:bg-[#F1F5F9]"
            style={{ fontWeight: 500, color: "#334155" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={n === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-4 text-[13px] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontWeight: 600, backgroundColor: "#007FFF" }}
          >
            <Download className="h-3.5 w-3.5" />
            Export as CSV
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
