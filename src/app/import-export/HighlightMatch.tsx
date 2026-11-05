/* Search-hit highlighter shared by the review grid, the history table and
 * the record page (port of role-zen's alerts-settings/HighlightMatch). */
import type { ReactNode } from "react";

export const SEARCH_HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightMatch({
  text,
  query,
  matchClassName = SEARCH_HIGHLIGHT_CLASS,
}: {
  text: string;
  query: string;
  matchClassName?: string;
}): ReactNode {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={matchClassName}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Export-modal flavour: yellow mark with 500 weight (ExportUsersModal highlightMatch). */
export function highlightLabel(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
