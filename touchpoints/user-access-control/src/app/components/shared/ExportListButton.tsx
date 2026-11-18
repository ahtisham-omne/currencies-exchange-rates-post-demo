import { Download } from "lucide-react";

interface ExportListButtonProps {
  onClick: () => void;
}

/** Toolbar button styled to match Filters / Columns buttons in DataTableToolbar. */
export function ExportListButton({ onClick }: ExportListButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-[8px] border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none"
    >
      <Download className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
      <span className="text-sm" style={{ fontWeight: 500 }}>Export List</span>
    </button>
  );
}
