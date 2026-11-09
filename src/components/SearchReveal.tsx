import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { listJoin } from '../lib/tableSearch'

/* ─────────────────────── A hidden column a search matched in ───────────────────────
   Every searchable table in the module answers a match in a column that is off
   the same way: the column comes out for the search, next to the column that
   names the row, and a note above the table says which and why. Design review,
   2026-09-30 - Eli: *"the whole point of our system is it's supposed to tell you
   what you're picking up on."* Mahad, 2026-10-05, of that note: *"I really like
   this indicator"* - and asked for it on every table.

   Only for this search: the reader's own column choice is untouched, and a
   column they hide again while searching stays hidden until the search changes. */

/** Which of a table's hidden columns to bring out for a search, given the hidden
 *  columns any listed row matched in. `hide` takes one back down for the rest of
 *  this search, and says whether it was one the search had brought out. */
export function useSearchReveal<K extends string>(query: string, hiddenHits: K[]) {
  const [declined, setDeclined] = useState<K[]>([])
  useEffect(() => { setDeclined(prev => (prev.length ? [] : prev)) }, [query])
  const key = hiddenHits.join('|')
  const revealed = useMemo(
    () => (query.trim() ? hiddenHits.filter(k => !declined.includes(k)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, key, declined],
  )
  const hide = (k: K): boolean => {
    if (!revealed.includes(k)) return false
    setDeclined(prev => [...prev, k])
    return true
  }
  return { revealed, hide }
}

/** A column order with the revealed columns moved in after `after`, where the
 *  eye already is - the columns a search brings out mostly live at the far end. */
export function orderWithRevealed<K extends string>(order: K[], revealed: K[], after: K): K[] {
  if (!revealed.length) return order
  const rest = order.filter(k => !revealed.includes(k))
  const at = rest.indexOf(after) + 1
  return [...rest.slice(0, at), ...revealed, ...rest.slice(at)]
}

/** The note above the table. Nothing when no column was brought out. */
export function SearchRevealNote({ labels }: { labels: string[] }) {
  if (!labels.length) return null
  return (
    <div className="px-4 py-2 bg-info-50 border-b border-info-100 text-info-700 text-xs flex items-center gap-2" data-search-revealed>
      <Info size={14} className="shrink-0 text-info-600" />
      <span>
        Your search also matched {listJoin(labels)}, so {labels.length === 1 ? 'that column is' : 'those columns are'} shown while you search.
      </span>
    </div>
  )
}
