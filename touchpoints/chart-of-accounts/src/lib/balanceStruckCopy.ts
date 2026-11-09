/* What a balance tile prints under its figure: when that figure was struck.

   The caption used to answer a different question - whether the account had ever
   been posted to - and printed the answer under a figure that was not nothing.
   6530 Loss on Sale of Assets carries an opening of $3,200 and has never been
   posted to, so its Running balance tile read "+$ 3,200" over "No postings yet"
   and left the reader to work out where the 3,200 came from.

   A balance standing with no postings behind it is an opening balance, not an
   absence. So "No postings yet" is kept for the tile that really is showing
   nothing, and a tile showing a figure says that nothing has moved it instead.

   Stated here rather than at each tile because the posting account's Running
   balance and the summary's rolled-up Balance make the same claim about the same
   kind of figure, and a caption that means one thing on one page and another on
   the next is the defect this replaces. */

// An account with a figure and no movement behind it in view. Borrowed verbatim
// from the activity chart's own empty state, so the page says it one way.
export const NO_ACTIVITY_IN_WINDOW = 'No activity in this window'

// An account with no postings and no figure - the one case where there is
// genuinely nothing to date.
export const NEVER_POSTED = 'No postings yet'

/**
 * `postedOn` is the last posting's date, already formatted for display, or
 * undefined when nothing has ever posted here. `balance` is the figure the tile
 * is printing, so the caption can tell an empty account from a dormant one.
 */
export function balanceStruckLabel(postedOn: string | undefined, balance: number): string {
  if (postedOn) return `As of ${postedOn}`
  return balance === 0 ? NEVER_POSTED : NO_ACTIVITY_IN_WINDOW
}
