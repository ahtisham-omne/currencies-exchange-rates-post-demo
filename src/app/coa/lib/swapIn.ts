import { useState } from 'react'

/**
 * The entrance for content that swaps in place under a header that stays put
 * (a tab's body, a table switched by SegmentedTabs): CoA's `animate-step-in`,
 * a short fade and rise. The caller keys the element by the same value, so
 * each swap remounts it and replays the entrance. Empty until `key` first
 * changes: on the first render the page's own `animate-page-in` is already
 * bringing the content in, and the two would stack.
 */
export function useSwapIn(key: string | undefined): string {
  const [first] = useState(key)
  const [swapped, setSwapped] = useState(false)
  if (!swapped && key !== first) setSwapped(true)
  return swapped || key !== first ? 'animate-step-in motion-reduce:animate-none' : ''
}
