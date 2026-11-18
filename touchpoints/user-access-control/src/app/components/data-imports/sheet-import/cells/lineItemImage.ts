/* Sample line-item images.
   Five photos cycled deterministically via a hash of the product id /
   line code so every render of the same id lands on the same thumbnail.
   Avoids the "linking a unique image everywhere" overhead while still
   reading as real product photography instead of a flat icon. */

/* Each URL was probed against the live Unsplash CDN. The previous
   list carried two photo IDs that the photographer had since
   removed (HTTP 404), so roughly two out of every five table rows
   rendered the broken-image placeholder. Replaced with verified
   200-status photos. */
const SAMPLE_LINE_ITEM_IMAGES = [
  'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
] as const;

/* Safety net used by `<img onError>` handlers: when a hash lands on
   a future-broken URL, swap to the first verified photo so the
   user never sees the placeholder. Exported so callers don't have
   to reach into the array. */
export const FALLBACK_LINE_ITEM_IMAGE = SAMPLE_LINE_ITEM_IMAGES[0];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Sample thumbnail URL for a given line item / product key. Stable
 *  across renders so the same SKU always reads as the same photo. */
export function getLineItemImage(key: string | undefined | null): string {
  const safe = key && key.length > 0 ? key : 'default';
  const idx = hashString(safe) % SAMPLE_LINE_ITEM_IMAGES.length;
  return SAMPLE_LINE_ITEM_IMAGES[idx];
}

export { SAMPLE_LINE_ITEM_IMAGES };
