/* Sample line-item images.
   Five photos cycled deterministically via a hash of the product code
   so every render of the same SKU lands on the same thumbnail. Mirrors
   the Quote module's `lineItemImage` helper so both sides read the
   same. Used by the SO line item catalogue + selected cards in place
   of the empty Package icon placeholder. */

/* Each URL was probed against the live Unsplash CDN. The previous
   list carried two photo IDs that the photographer had since
   removed (HTTP 404), so roughly two out of every five table rows
   rendered the broken-image placeholder. Replaced with verified
   200-status photos. Mirrors the Quote module's helper. */
const SAMPLE_LINE_ITEM_IMAGES = [
  'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
] as const;

/* Safety net used by `<img onError>` handlers: when a hash lands
   on a future-broken URL, swap to the first verified photo so the
   user never sees the placeholder. */
export const FALLBACK_LINE_ITEM_IMAGE = SAMPLE_LINE_ITEM_IMAGES[0];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getLineItemImage(key: string | undefined | null): string {
  const safe = key && key.length > 0 ? key : 'default';
  const idx = hashString(safe) % SAMPLE_LINE_ITEM_IMAGES.length;
  return SAMPLE_LINE_ITEM_IMAGES[idx];
}

export { SAMPLE_LINE_ITEM_IMAGES };
