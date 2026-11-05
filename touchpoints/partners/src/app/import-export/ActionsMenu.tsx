/* "Actions ▾" outline button (Import / Export), placed immediately left of
 * the primary create button on both listings. Uses this repo's outline
 * toolbar recipe; the 144px end-aligned menu mirrors User Access Control. */

import { ChevronDown, Download, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface ActionsMenuProps {
  onImport: () => void;
  onExport: () => void;
}

export function ActionsMenu({ onImport, onExport }: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0"
          aria-label="Actions"
        >
          <span className="text-[13px]" style={{ fontWeight: 500 }}>
            Actions
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[144px]">
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={onImport}>
          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
          Import
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={onExport}>
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          Export
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
