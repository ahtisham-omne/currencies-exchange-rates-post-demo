import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Highlight matched substrings of `query` inside `text` with a soft
 *  amber background. Case-insensitive, escapes regex metacharacters
 *  in the query so user-typed punctuation doesn't crash the regex.
 *  Returns the original text untouched when query is empty.
 *
 *  Used by list pages to surface what the search matched on. The
 *  styling intentionally stays subtle so the rest of the row keeps
 *  reading naturally — yellow-100 background, no foreground change. */
export function highlightMatch(text: string | undefined | null, query: string): React.ReactNode {
  if (!text) return text || "";
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return React.createElement(
        "mark",
        {
          key: i,
          className: "bg-yellow-100 text-foreground rounded-[2px] px-px",
        },
        part,
      );
    }
    return part;
  });
}
