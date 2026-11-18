import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../ui/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (size: number) => void;
  pageSizeOptions: number[];
  /** When true, the records-per-page dropdown gains an "All" item that emits
   *  Number.POSITIVE_INFINITY. Callers using this should treat a non-finite
   *  `recordsPerPage` as "no pagination, render every row". */
  allowAll?: boolean;
}

/* DOM <option> values are strings; use this sentinel for the "All" item so
 * the select can round-trip Infinity through the value attribute. */
const ALL_OPTION_VALUE = "all";

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
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

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  pageSizeOptions,
  allowAll = false,
}: PaginationProps) {
  const isAllSelected = !Number.isFinite(recordsPerPage);
  const selectValue = isAllSelected ? ALL_OPTION_VALUE : String(recordsPerPage);
  const handleSizeChange = (raw: string) => {
    if (raw === ALL_OPTION_VALUE) onRecordsPerPageChange(Number.POSITIVE_INFINITY);
    else onRecordsPerPageChange(Number(raw));
  };
  const navBtn =
    "inline-flex items-center justify-center h-8 w-8 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
  const navTextBtn =
    "inline-flex items-center gap-1 h-8 px-2 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

  return (
    <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-2.5 border-t border-[#E2E8F0] bg-white">
      <div className="flex items-center gap-2" style={{ fontSize: "12.5px", color: "#64748B" }}>
        <span>Records per Page</span>
        <div className="relative">
          <select
            value={selectValue}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="h-8 pl-2.5 pr-7 rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] cursor-pointer outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
            style={{ fontSize: "12.5px", fontWeight: 500, appearance: "none" }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={String(opt)}>
                {opt}
              </option>
            ))}
            {allowAll && (
              <option value={ALL_OPTION_VALUE}>All</option>
            )}
          </select>
          <ChevronRight
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 pointer-events-none"
            style={{ color: "#94A3B8" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-0.5" style={{ fontSize: "12.5px" }}>
        <button
          type="button"
          aria-label="First page"
          className={navBtn}
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Previous page"
          className={navTextBtn}
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          style={{ fontSize: "12.5px", fontWeight: 500 }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {getPageNumbers(currentPage, totalPages).map((page, idx) =>
          page === "..." ? (
            <span key={`dots-${idx}`} className="px-1.5 text-[#94A3B8]" style={{ fontSize: "12.5px" }}>
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page as number)}
              className={cn(
                "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md tabular-nums transition-colors cursor-pointer",
                currentPage === page
                  ? "text-white"
                  : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
              )}
              style={{
                fontSize: "12.5px",
                fontWeight: 500,
                ...(currentPage === page ? { backgroundColor: "#0A77FF" } : null),
              }}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          className={navTextBtn}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          style={{ fontSize: "12.5px", fontWeight: 500 }}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label="Last page"
          className={navBtn}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
