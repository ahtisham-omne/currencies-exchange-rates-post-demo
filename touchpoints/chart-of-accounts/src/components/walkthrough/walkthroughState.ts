/* ──────────────────────────────────────────────────────────────────
 * WHEN THE WALKTHROUGH OFFERS ITSELF
 *
 * Once per session, on the first import that reaches the numbering step. Held
 * at module scope rather than in `localStorage` on purpose: this is a prototype
 * that gets demoed, and a flag that survives a reload would mean the tour is
 * unreachable on the second run of a demo without clearing site data. A reload
 * is the reset.
 *
 * It is consumed by the caller rather than read, so two mounts racing on the
 * same session cannot both win it.
 * ────────────────────────────────────────────────────────────────── */

/* Keyed, because there is more than one tour. Someone who took the import's
   walkthrough this session has not been shown the dimensions one, and a
   single flag would have the first tour spend the second one's only chance. */
const spent = new Set<string>()

/** True at most once per session per tour. Consumes that tour's flag. */
export function takeFirstWalkthrough(key: string): boolean {
  if (spent.has(key)) return false
  spent.add(key)
  return true
}

/* For a tour that opens as the reader steps INTO a step of a wizard already on
   screen: the panel's height transition is 300ms on `cubic-bezier(0.32,0.72,0,1)`
   and the step's own body paints inside it, so this waits for the room to settle
   and then knocks.

   Not for a tour that opens with its modal. There the welcome slide and the
   modal are one arrival, and any delay puts the greeting on a reader who has
   already begun - see the import wizard, which offers itself with no delay at
   all. */
export const WALKTHROUGH_OPEN_DELAY_MS = 620
