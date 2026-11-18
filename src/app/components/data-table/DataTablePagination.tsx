import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  recordsPerPage: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (size: number) => void;
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }
  return pages;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  recordsPerPage,
  onPageChange,
  onRecordsPerPageChange,
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Records per Page</span>
        <Select
          value={Number.isFinite(recordsPerPage) ? String(recordsPerPage) : "all"}
          onValueChange={(val) =>
            onRecordsPerPageChange(val === "all" ? Infinity : Number(val))
          }
        >
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-sm text-muted-foreground"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </Button>

        {getPageNumbers(currentPage, totalPages).map((page, idx) =>
          page === "..." ? (
            <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "ghost"}
              size="sm"
              className={`h-8 w-8 p-0 text-sm ${
                currentPage === page
                  ? "text-white hover:opacity-90"
                  : "text-muted-foreground"
              }`}
              style={currentPage === page ? { backgroundColor: "#007FFF" } : undefined}
              onClick={() => onPageChange(page as number)}
            >
              {page}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-sm text-muted-foreground"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
