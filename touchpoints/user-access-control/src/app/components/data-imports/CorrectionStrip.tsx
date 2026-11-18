/* "Waiting on your corrected file" strip.
 *
 * Downloading an import's error rows used to open the re-import wizard the
 * same instant the file hit the disk, before the admin had fixed a single
 * cell. The only sensible action on that modal was Cancel.
 *
 * This replaces the ambush with a task that stays put. The download arms it;
 * it then sits under the import's header until the corrected file comes back
 * or the admin dismisses it, and the listing carries a matching cue so the
 * work can be picked up from either surface, minutes or days later. It is
 * also a drop target, so the round trip can finish with a drag rather than a
 * dialog.
 *
 * Deliberately not a modal: the admin's next step happens in Excel, not in
 * Omne, and a task they are going to leave and come back to should not be
 * something they have to dismiss first. */

import { useCallback, useState } from "react";
import { Upload, X, ChevronDown, FileText, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";
import type { PendingCorrection } from "./pendingCorrections";

export interface CorrectionStripProps {
  pending: PendingCorrection;
  /** Open the re-import wizard with no file preloaded. */
  onOpenUpload: () => void;
  /** A file was dropped straight onto the strip: open the wizard with it
   *  already accepted, so the round trip finishes in one gesture. */
  onDropFile: (file: File) => void;
  /** Hand the admin the error file again, in either format. */
  onRedownload: (format: "csv" | "xlsx") => void;
  /** Drop the pending state. The rows stay failing; only the reminder goes. */
  onDismiss: () => void;
}

function formatDownloadedAt(iso: string): string {
  try {
    return format(new Date(iso), "MMM d 'at' h:mm a");
  } catch {
    return "";
  }
}

export function CorrectionStrip({
  pending,
  onOpenUpload,
  onDropFile,
  onRedownload,
  onDismiss,
}: CorrectionStripProps) {
  /* Counter rather than a boolean: dragging over a child element fires a
   * leave on the parent, which would otherwise flicker the highlight off. */
  const [dragDepth, setDragDepth] = useState(0);
  const dragging = dragDepth > 0;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragDepth(0);
      const file = e.dataTransfer.files?.[0];
      if (file) onDropFile(file);
    },
    [onDropFile],
  );

  const rowLabel = `${pending.rowCount} error row${pending.rowCount === 1 ? "" : "s"}`;
  const downloadedAt = formatDownloadedAt(pending.startedISO);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors",
        dragging ? "border-[#0A77FF] bg-[#EFF6FF]" : "border-[#FDE68A] bg-[#FFFBEB]",
      )}
      style={{ borderStyle: dragging ? "dashed" : "solid", borderWidth: 1.5 }}
      aria-label="Awaiting corrected file"
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-md"
        style={{
          width: 32,
          height: 32,
          backgroundColor: dragging ? "#DBEAFE" : "#FEF3C7",
        }}
      >
        <Upload className="w-4 h-4" style={{ color: dragging ? "#0A77FF" : "#B45309" }} />
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 600 }}>
          {dragging ? "Drop to upload your corrected file" : "Waiting on your corrected file"}
        </p>
        <p className="text-[#92400E] mt-0.5 truncate" style={{ fontSize: "12px" }}>
          <span style={{ fontWeight: 500 }}>{pending.fileName}</span>, {rowLabel}
          {downloadedAt ? `, downloaded ${downloadedAt}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <RedownloadDropdown onPick={onRedownload} />
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-md text-white shadow-sm transition-colors cursor-pointer hover:bg-[#B45309]"
          style={{ backgroundColor: "#D97706", fontSize: "13px", fontWeight: 600 }}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Corrected File
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#B45309] hover:bg-[#FEF3C7] transition-colors cursor-pointer shrink-0"
          aria-label="Stop waiting for a corrected file"
          title="Stop waiting for a corrected file"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* Re-issues the same error file. The admin who lost it in their Downloads
 * folder should not have to go back through the filter and the menu. */
function RedownloadDropdown({ onPick }: { onPick: (format: "csv" | "xlsx") => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-md border border-[#D97706] bg-white text-[#B45309] shadow-sm hover:bg-[#FEF3C7] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          Download Again
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[200] w-[200px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        <RedownloadItem icon="csv" label="Download as CSV" onSelect={() => onPick("csv")} />
        <RedownloadItem icon="xlsx" label="Download as Excel" onSelect={() => onPick("xlsx")} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RedownloadItem({
  icon,
  label,
  onSelect,
}: {
  icon: "csv" | "xlsx";
  label: string;
  onSelect: () => void;
}) {
  const Icon = icon === "csv" ? FileText : FileSpreadsheet;
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-[#334155] focus:bg-[#F1F5F9] focus:text-[#0F172A]"
      style={{ fontSize: "13px", fontWeight: 500 }}
    >
      <Icon className="w-4 h-4" style={{ color: "#64748B" }} />
      {label}
    </DropdownMenuItem>
  );
}
