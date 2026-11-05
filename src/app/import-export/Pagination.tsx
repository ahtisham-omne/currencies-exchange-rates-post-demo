/* Centred pagination bar shared by the review grid, the history table and
 * the record page (port of role-zen's data-imports/Pagination.tsx). */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (n: number) => void;
  pageSizeOptions?: number[];
  /** Adds an "All" option (Number.POSITIVE_INFINITY). */
  allowAll?: boolean;
}

const navBtn =
  "inline-flex items-center justify-center h-8 w-8 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
const navTextBtn =
  "inline-flex items-center gap-1 h-8 px-2 rounded-md text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  pageSizeOptions = [20, 50, 100],
  allowAll = false,
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const selectValue = Number.isFinite(recordsPerPage) ? String(recordsPerPage) : "all";
  return (
    <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-2.5 border-t border-[#E2E8F0] bg-white">
      <div className="flex items-center gap-2" style={{ fontSize: "12.5px", color: "#64748B" }}>
        <span>Records per Page</span>
        <div className="relative">
          <select
            value={selectValue}
            onChange={(e) => onRecordsPerPageChange(e.target.value === "all" ? Number.POSITIVE_INFINITY : Number(e.target.value))}
            className="h-8 pl-2.5 pr-7 rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] cursor-pointer outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
            style={{ fontSize: "12.5px", fontWeight: 500, appearance: "none" }}
            aria-label="Records per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {allowAll && <option value="all">All</option>}
          </select>
          <ChevronRight
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 pointer-events-none"
            style={{ color: "#94A3B8" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-0.5" style={{ fontSize: "12.5px" }}>
        <button type="button" className={navBtn} onClick={() => onPageChange(1)} disabled={currentPage <= 1} aria-label="First page">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={navTextBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{ fontWeight: 500 }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        {getPageNumbers(currentPage, safeTotal).map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="px-1.5 text-[#94A3B8]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md tabular-nums transition-colors cursor-pointer ${
                p === currentPage ? "text-white" : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              }`}
              style={{ fontWeight: 500, ...(p === currentPage ? { backgroundColor: "#0A77FF" } : {}) }}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={navTextBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= safeTotal}
          style={{ fontWeight: 500 }}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={navBtn}
          onClick={() => onPageChange(safeTotal)}
          disabled={currentPage >= safeTotal}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
