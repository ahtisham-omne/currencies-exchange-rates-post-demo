/* Shared image prefetcher for the View-in-Module screenshots.
 *
 * The screenshots are ~120KB WebPs that live behind two clicks: select a
 * permission, then open View in Module. Waiting until the modal opens to
 * fetch them puts the whole download+decode on the user's click. Instead,
 * callers prefetch at the earlier intent point (permission selected, button
 * hovered) so the modal opens onto an already-decoded bitmap.
 *
 * The cache holds the HTMLImageElement itself, not just a flag: dropping the
 * element lets the browser GC the decoded bitmap, which would silently move
 * the decode cost back onto the modal open. Capped and evicted FIFO so a
 * long browse through 60+ permissions doesn't pin hundreds of MB of pixels.
 */

const CACHE_MAX = 24;

const cache = new Map<string, HTMLImageElement>();

/** Begin fetching + decoding the given images. Safe to call repeatedly —
 *  already-cached sources are refreshed in insertion order but not refetched. */
export function prefetchImages(...srcs: (string | undefined | null)[]): void {
  for (const src of srcs) {
    if (!src) continue;
    const existing = cache.get(src);
    if (existing) {
      // Re-insert so recently-wanted images are last in line for eviction.
      cache.delete(src);
      cache.set(src, existing);
      continue;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    // decode() pushes the bitmap decode off the modal-open path too. Errors
    // (aborted navigation, 404) are non-fatal: the modal's own <img> remains
    // the source of truth and will surface its own failure state.
    img.decode?.().catch(() => {});
    cache.set(src, img);
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
}

/** True when a source has finished loading (bytes are in; decode may already
 *  be done too). Used to skip the skeleton for warm opens. */
export function isImageReady(src: string | undefined | null): boolean {
  if (!src) return false;
  const img = cache.get(src);
  return Boolean(img && img.complete && img.naturalWidth > 0);
}
