/* Ported from the financial reporting module's comms cluster
   (components/fr/comms/highlightMatch.tsx), behaviour verbatim.

   Wraps the substrings of `text` matching `query` in a <mark>, so the thread
   list, the message body and the search results all read identically while a
   search is active. */
import React from 'react'

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g

export function highlightMatch(text: string, query: string | undefined | null): React.ReactNode {
  if (!text) return text
  const trimmed = (query ?? '').trim()
  if (!trimmed) return text
  // A query is user text, so it reaches the RegExp constructor escaped. The
  // catch is the second line of defence: an unbalanced pattern returns the
  // plain string rather than taking the pane down with it.
  try {
    const parts = text.split(new RegExp(`(${trimmed.replace(ESCAPE_RE, '\\$&')})`, 'i'))
    return (
      <>
        {parts.map((p, i) =>
          p.toLowerCase() === trimmed.toLowerCase() ? (
            <mark
              key={i}
              className="px-0.5 rounded-sm"
              // COA's own --foreground is an HSL triplet consumed as
              // hsl(var(--foreground)), so using it bare here emitted an
              // invalid declaration and the mark rendered with no ink.
              style={{ background: 'var(--color-amber-100)', color: 'var(--color-slate-900)' }}
            >
              {p}
            </mark>
          ) : (
            <React.Fragment key={i}>{p}</React.Fragment>
          ),
        )}
      </>
    )
  } catch {
    return text
  }
}
