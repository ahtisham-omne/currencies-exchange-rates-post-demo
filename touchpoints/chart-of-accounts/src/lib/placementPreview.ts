import { compareAccountNumbers, type Account } from '../types'
import type { ChartIndex } from './chartTree'

/**
 * The branch an account lands on, read top to bottom: the summary accounts above
 * it, the siblings around it, and what it holds.
 *
 * All three parts, and a count for whatever each one leaves out. A window with
 * nothing marking its edges reads as the whole branch, which is how a draft
 * landing first among twenty siblings came to show three rows and look like a
 * branch of three.
 *
 * Structure comes from the parent, so the branch is read off the chart index
 * rather than reconstructed from account numbers, and there is no closing row on
 * the way back out.
 */

export const DRAFT_ID = '__draft__'

/** Siblings shown either side of the draft, and children shown inside it. */
const SIDE = 2
const HELD_SHOWN = 3

export interface PlacementRow {
  key: string
  /** The account the row shows. Absent for a collapsed run, which carries `note`. */
  account?: Account
  depth: number
  trunks: boolean[]
  note?: string
}

export interface PlacementPreview {
  /** The summary accounts enclosing the draft, outermost first. */
  chain: Account[]
  rows: PlacementRow[]
  /** Siblings the window left out at each end, and children left out inside. */
  above: number
  below: number
  heldRest: number
}

export function placementPreview({ index, draft, parent, exclude = [], held: heldAll = [] }: {
  index: ChartIndex
  /** A stand-in for the account being placed, carrying whatever has been typed. */
  draft: Account
  parent: Account | null
  /** Accounts pulled out of the sibling run: the one being edited, or wrapped. */
  exclude?: string[]
  /** What the draft contains - children it already has, or an account moving in. */
  held?: Account[]
}): PlacementPreview {
  const chain = parent ? [...index.ancestorsOf(parent.id)].reverse().concat(parent) : []
  const depth = chain.length
  const parentAt = parent?.id ?? null
  const out = new Set(exclude)

  /* Spliced in at its landing spot rather than sorted in by number, so it holds
     its place before a number is typed - at the head of the run, which is where
     an unnumbered account belongs. */
  const siblings = (parent ? index.childrenOf(parent.id) : index.roots).filter(a => !out.has(a.id))
  const after = siblings.findIndex(a => compareAccountNumbers(a.accountNumber, draft.accountNumber) > 0)
  const draftAt = after === -1 ? siblings.length : after
  const ordered = [...siblings.slice(0, draftAt), draft, ...siblings.slice(draftAt)]

  const from = Math.max(0, draftAt - SIDE)
  const to = Math.min(ordered.length - 1, draftAt + SIDE)
  const above = from
  const below = ordered.length - 1 - to
  const held = heldAll.slice(0, HELD_SHOWN)
  const heldRest = heldAll.length - held.length

  /* Vertical nesting guides, computed the way the list view computes them
     (AccountTable's `listStructure`): one trunk per ancestor on screen, carrying
     past a row only while that ancestor has another row further down, and closing
     on its last child. Built from the rows the preview actually draws - the
     collapsed runs standing in the same place as the accounts they replace - so no
     line points at a row that is not there. The table draws each account row's
     curved branch off its trunk, as the chart listing does (2026-10-01); a
     collapsed run keeps a straight line, being no account of its own. */
  const seq: { id: string; parentId: string | null }[] =
    chain.map((a, i) => ({ id: a.id, parentId: i === 0 ? null : chain[i - 1].id }))
  if (above > 0) seq.push({ id: 'sk-above', parentId: parentAt })
  for (let at = from; at <= to; at++) {
    seq.push({ id: ordered[at].id, parentId: parentAt })
    if (at !== draftAt) continue
    for (const h of held) seq.push({ id: h.id, parentId: DRAFT_ID })
    if (heldRest > 0) seq.push({ id: 'sk-inside', parentId: DRAFT_ID })
  }
  if (below > 0) seq.push({ id: 'sk-below', parentId: parentAt })

  const parentOf = new Map(seq.map(g => [g.id, g.parentId]))
  const ancestorsOf = (id: string) => {
    const acc: string[] = []
    for (let p = parentOf.get(id) ?? null; p; p = parentOf.get(p) ?? null) acc.push(p)
    return acc.reverse()
  }
  const lastChild = new Map<string, string>()
  for (const g of seq) if (g.parentId) lastChild.set(g.parentId, g.id)
  const trunksOf = (id: string) => {
    const anc = ancestorsOf(id)
    return anc.map((pid, i) => lastChild.get(pid) !== (anc[i + 1] ?? id))
  }

  const rows: PlacementRow[] = chain.map((a, i) => ({ key: a.id, account: a, depth: i, trunks: trunksOf(a.id) }))
  const gap = (key: string, d: number, note: string) => ({ key, depth: d, trunks: trunksOf(key), note })
  if (above > 0) rows.push(gap('sk-above', depth, `${above} more above`))
  for (let at = from; at <= to; at++) {
    const a = ordered[at]
    rows.push({ key: a.id, account: a, depth, trunks: trunksOf(a.id) })
    if (at !== draftAt) continue
    for (const h of held) rows.push({ key: h.id, account: h, depth: depth + 1, trunks: trunksOf(h.id) })
    if (heldRest > 0) rows.push(gap('sk-inside', depth + 1, `${heldRest} more inside`))
  }
  if (below > 0) rows.push(gap('sk-below', depth, `${below} more below`))

  return { chain, rows, above, below, heldRest }
}
