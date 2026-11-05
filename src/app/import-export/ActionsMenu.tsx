/* "Import/Export ▾" outline button + Import / Export dropdown, placed immediately
 * left of "Create New Item" in the Items Library header (port of the UAC
 * header menu, re-expressed in this repo's toolbar outline recipe). */
import { ChevronDown, Download, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ActionsMenuProps {
  onImport: () => void;
  onExport: () => void;
  importDisabled?: boolean;
  exportDisabled?: boolean;
}

export function ActionsMenu({ onImport, onExport, importDisabled, exportDisabled }: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ fontWeight: 500 }}
        >
          Import/Export
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 bg-popover">
        <DropdownMenuItem
          className={importDisabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
          disabled={importDisabled}
          onClick={onImport}
        >
          <Upload className="w-3.5 h-3.5 text-[#64748B]" />
          Import
        </DropdownMenuItem>
        <DropdownMenuItem
          className={exportDisabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
          disabled={exportDisabled}
          onClick={onExport}
        >
          <Download className="w-3.5 h-3.5 text-[#64748B]" />
          Export
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
