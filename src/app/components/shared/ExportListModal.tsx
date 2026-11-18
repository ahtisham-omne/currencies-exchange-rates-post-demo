import { useState } from "react";
import { Download, X, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "./ModalShell";

export type ExportFormat = "csv" | "excel" | "pdf";

interface ExportListModalProps {
  open: boolean;
  onClose: () => void;
  /** "Users" | "Roles", used for titles, body copy, and toast message */
  entity: "Users" | "Roles";
  /** Comma-separated list of fields included in the exported file (shown in body copy) */
  fieldsLine: string;
  /** Called when the user confirms, receives the chosen format */
  onExport: (format: ExportFormat) => void;
}

const FORMAT_OPTIONS: { key: ExportFormat; label: string; description: string; icon: typeof FileText }[] = [
  { key: "csv", label: "CSV", description: "Comma-separated values, opens in any spreadsheet tool.", icon: FileText },
  { key: "excel", label: "Excel", description: "Microsoft Excel workbook (.xlsx).", icon: FileSpreadsheet },
  { key: "pdf", label: "PDF", description: "Formatted, print-ready document.", icon: FileType },
];

/** Format option row. Hover + selected states mirror the Create-User RoleCard treatment. */
function FormatOptionRow({
  opt,
  isSelected,
  onSelect,
}: {
  opt: (typeof FORMAT_OPTIONS)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = opt.icon;
  const [isHovered, setIsHovered] = useState(false);
  return (
    <label
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-all duration-150"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      <input
        type="radio"
        name="export-format"
        value={opt.key}
        checked={isSelected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center"
        style={{ borderColor: isSelected ? "#0A77FF" : "#CBD5E1" }}
      >
        {isSelected && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#0A77FF" }}
          />
        )}
      </span>
      <Icon
        className="w-[18px] h-[18px] shrink-0"
        style={{ color: isSelected ? "#0A77FF" : "#94A3B8" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px]" style={{ fontWeight: 600, color: "#0F172A" }}>
          {opt.label}
        </div>
        <div className="text-[12px] leading-[16px]" style={{ color: "#64748B", fontWeight: 400 }}>
          {opt.description}
        </div>
      </div>
    </label>
  );
}

export function ExportListModal({ open, onClose, entity, fieldsLine, onExport }: ExportListModalProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");

  const lower = entity.toLowerCase();
  const handleExport = () => {
    onExport(format);
    toast.success(`${entity} list exported successfully. Check your downloads.`);
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 520, maxWidth: "calc(100vw - 32px)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <Download className="w-[18px] h-[18px]" style={{ color: "#2563EB" }} />
            </div>
            <div>
              <h2 className="text-[16px] leading-[22px]" style={{ fontWeight: 650, color: "#0F172A" }}>
                Export {entity} List
              </h2>
              <p className="text-[12.5px] mt-0.5" style={{ color: "#64748B", fontWeight: 400 }}>
                Download the current {lower} listing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors text-[#64748B] hover:text-[#0F172A]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div className="text-[13px] leading-[19px] space-y-2.5" style={{ color: "#334155", fontWeight: 400 }}>
            <p>
              Export the {lower} currently shown on this page as a downloadable file. If you have active filters or a search applied, only the matching {lower} will be exported. If no filters are applied, all {lower} will be exported.
            </p>
            <p>
              The exported file will contain: {fieldsLine}.
            </p>
          </div>

          {/* Format options */}
          <div>
            <div
              className="text-[11px] mb-2 uppercase tracking-[0.04em]"
              style={{ fontWeight: 600, color: "#64748B" }}
            >
              Format
            </div>
            <div className="space-y-1.5">
              {FORMAT_OPTIONS.map((opt) => (
                <FormatOptionRow
                  key={opt.key}
                  opt={opt}
                  isSelected={format === opt.key}
                  onSelect={() => setFormat(opt.key)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] hover:bg-[#F1F5F9] transition-colors"
            style={{ fontWeight: 500, color: "#334155" }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white inline-flex items-center gap-1.5 transition-colors"
            style={{ fontWeight: 600, backgroundColor: "#007FFF" }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
