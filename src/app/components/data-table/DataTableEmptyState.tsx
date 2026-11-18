import type { ReactNode } from "react";
import { User } from "lucide-react";

/* ─── Data-table empty state ──────────────────────────────────────────────
 * One treatment for every "nothing to show" in the app's tables, whichever
 * entity they list. Borrowed from `ComingSoonEmptyState` so the two read as
 * the same family: the floating icon tile with its slow glow ring, and the
 * staggered fade-in.
 *
 * Deliberately lighter than the coming-soon version. No status pill and no
 * paragraph, because an empty table is a transient result rather than an
 * announcement: the heading and, when filters are on, the way back out of
 * them are the only two things worth saying.
 *
 * The icon comes from the table (Shield for roles, Users for people, Inbox
 * for requests, and so on), so each surface keeps its own glyph. Callers size
 * it for the old inline layout, which the child selectors below override.
 */

/** Words that stay lowercase inside a title unless they open it. */
const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or",
  "the", "to", "via", "with", "yet",
]);

/** Title-cases a short empty-state phrase: "No users found" → "No Users Found".
 *  A trailing full stop is dropped, since these render as headings. */
function toEmptyStateTitle(message: string): string {
  const words = message.trim().replace(/\.$/, "").split(/\s+/);
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && MINOR_WORDS.has(lower)) return lower;
      /* Leave words that already carry inner capitals alone (e.g. "MFA"). */
      if (/[A-Z]/.test(word.slice(1))) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function DataTableEmptyState({
  icon,
  message,
  onClearFilters,
  action,
}: {
  /** The table's own glyph; falls back to a person. */
  icon?: ReactNode;
  message: string;
  /** Omitted when no filter or search is narrowing the table. */
  onClearFilters?: () => void;
  /** Primary CTA for a table that is empty because nothing has been added yet,
   *  e.g. "Add Users" on a role with no members. Rendered in place of the
   *  Clear All Filters link, which only applies when a filter is what emptied
   *  the table: with filters on, the way back out of them stays the answer. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10">
      {/* Animated icon tile */}
      <div className="relative mb-5">
        <div
          className="absolute inset-0 w-16 h-16 rounded-2xl animate-ping"
          style={{ backgroundColor: "rgba(10,119,255,0.05)", animationDuration: "3s" }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl border border-[#E2E8F0] flex items-center justify-center shadow-sm [&>svg]:w-7 [&>svg]:h-7 [&>svg]:text-slate-400 [&_svg]:w-7 [&_svg]:h-7 [&_svg]:text-slate-400"
          style={{
            backgroundImage: "linear-gradient(to bottom right, #F8FAFC, #EBF4FF)",
            animation: "csFloat 4s ease-in-out infinite",
          }}
        >
          {icon ?? <User />}
        </div>
      </div>

      <h3
        className="text-[#0F172A] text-[16px]"
        style={{
          fontWeight: 600,
          lineHeight: 1.5,
          letterSpacing: "-0.015em",
          animation: "csFade 0.5s ease-out both",
          animationDelay: "0.1s",
        }}
      >
        {toEmptyStateTitle(message)}
      </h3>

      {!onClearFilters && action && (
        <div
          className="mt-4"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.2s" }}
        >
          {action}
        </div>
      )}

      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2.5 text-[13px] text-[#007FFF] hover:text-[#0066D6] hover:underline transition-colors cursor-pointer"
          style={{ fontWeight: 500, animation: "csFade 0.5s ease-out both", animationDelay: "0.2s" }}
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}
