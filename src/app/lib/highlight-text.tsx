import type { ReactNode } from "react";
import { subsequenceMatchIndices } from "./subsequence-match";

/**
 * Highlights matching portions of text with a soft amber background.
 * The highlighted text keeps its original font color.
 */
export function highlightMatch(text: string | null | undefined, query: string): ReactNode {
  if (!text) return <span>{"\u2013"}</span>;
  if (!query || query.trim().length === 0) return <>{text}</>;
  const q = query.trim();
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="px-0.5 rounded-sm"
            style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const MATCH_STYLE = { backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 } as const;

/**
 * Highlights each letter of an in-order, spread-apart match (see
 * subsequenceMatchIndices) in the same yellow as highlightMatch. Neighbouring
 * matched letters share one mark. Used only by the Columns panel search
 * (ERP-5144 AC9); everything else keeps highlightMatch's one-run behaviour.
 */
export function highlightSubsequence(text: string, query: string): ReactNode {
  if (!query || query.trim().length === 0) return <>{text}</>;
  const indices = subsequenceMatchIndices(text, query);
  if (!indices || indices.length === 0) return <>{text}</>;

  const matched = new Set(indices);
  const parts: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const isMatch = matched.has(i);
    let j = i;
    while (j < text.length && matched.has(j) === isMatch) j++;
    const chunk = text.slice(i, j);
    parts.push(
      isMatch ? (
        <mark key={i} className="rounded-sm" style={MATCH_STYLE}>
          {chunk}
        </mark>
      ) : (
        <span key={i}>{chunk}</span>
      )
    );
    i = j;
  }
  return <>{parts}</>;
}
