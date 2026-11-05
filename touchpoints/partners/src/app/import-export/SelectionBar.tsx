/**
 * ImportSelectionBar: the bar that replaces the filter chips in the Review
 * and Fix grid and on an import record page while rows are selected. Copied
 * from User Access Control (role-zen data-imports/ImportSelectionBar.tsx) so
 * every module's import grids select the same way; byte-identical in
 * radiant-core-fusion, nimble-palette and partner-management-module. Mirrors Partner Management's
 * BulkActionBar: a plain-text "N records selected" status in blue, a
 * vertical divider, then bordered neutral action buttons carrying a count
 * badge ("Export (N)"), and "Clear selection" on the right. Export keeps UAC's
 * CSV / Excel choice in a dropdown. Surfaces with other bulk actions (the
 * review modals) pass them as `actions`, styled with SELECTION_ACTION_CLASS.
 */
import type { ReactNode } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


/** Bordered action button tones, Partner Management's BulkActionBar palette in UAC hex. */
export const SELECTION_ACTION_CLASS = {
  neutral:
    "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F1F5F9]/60 hover:text-[#0F172A] hover:border-[#CBD5E1] active:bg-[#F1F5F9]",
  destructive:
    "border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#F87171] active:bg-[#FECACA]",
} as const;
export const SELECTION_ACTION_BASE =
  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30 text-[13px] font-medium";
export type SelectionExportFormat = "csv" | "xlsx";

export function ImportSelectionBar({
  count,
  noun = "record",
  nounPlural,
  onExport,
  actions,
  onClear,
}: {
  count: number;
  noun?: string;
  nounPlural?: string;
  /** Adds the "Export (N)" button with the CSV / Excel choice. */
  onExport?: (format: SelectionExportFormat) => void;
  /** Extra action buttons rendered after the divider (and after Export). */
  actions?: ReactNode;
  onClear: () => void;
}) {
  if (count === 0) return null;
  const label = count === 1 ? noun : (nounPlural ?? `${noun}s`);

  return (
    <div className="shrink-0 flex items-center justify-between gap-3 px-4 pb-3 border-b border-[#E2E8F0] text-[13px]">
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          style={{ fontSize: "13px", fontWeight: 500, color: "#0A77FF" }}
        >
          <span>{count}</span>
          <span>{label} selected</span>
        </span>

        <div className="w-px h-5 bg-[#E2E8F0] shrink-0" />

        {onExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.neutral}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <span className="opacity-80">({count})</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="z-[200] w-[210px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
          >
            {([
              { format: "csv" as const, label: "Download as CSV", Icon: FileText },
              { format: "xlsx" as const, label: "Download as Excel", Icon: FileSpreadsheet },
            ]).map(({ format, label: itemLabel, Icon }) => (
              <DropdownMenuItem
                key={format}
                onSelect={() => onExport(format)}
                className="flex items-center gap-2.5 py-2 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9]"
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>{itemLabel}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        )}
        {actions}
      </div>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="inline-flex items-center gap-1 shrink-0 text-[#64748B] hover:text-[#0F172A] transition-colors whitespace-nowrap cursor-pointer"
        style={{ fontSize: "12px" }}
      >
        <X className="w-3.5 h-3.5" />
        Clear Selection
      </button>
    </div>
  );
}

/** "Set <Field> ▾" bulk action: a neutral bordered button with the column's
 *  options (UAC import-review BulkSetDropdown). */
export function BulkSetDropdown({
  label,
  options,
  onPick,
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.neutral}`}>
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[160px] z-[200] bg-white border border-[#E2E8F0] rounded-lg py-1 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => onPick(opt)}
            className="px-3 py-1.5 cursor-pointer text-[#0F172A] data-[highlighted]:bg-[#F1F5F9]"
            style={{ fontSize: "13px" }}
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
