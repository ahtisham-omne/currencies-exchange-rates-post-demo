/**
 * poItemAttachmentsStore — shared "which item attachments are attached to
 * which PO" state. Both the Item Detail modal picker (OrderFlow) and the
 * PO Detail Attachments tab read/write this store so the two surfaces stay
 * in sync. Shape: { poId → { lineItemId → Set<attachmentId> } }.
 *
 * Pub/sub via a per-PO listener set — consumers use useSyncExternalStore
 * with a subscriber scoped to their poId to avoid re-renders from unrelated
 * POs.
 */

type PoMap = Map<string, Map<string, Set<string>>>;

const store: PoMap = new Map();
const listeners = new Map<string, Set<() => void>>();
const EMPTY_SET: Set<string> = new Set();
/* Cached snapshot for `getAllPickedForPo` per-PO. useSyncExternalStore
 * compares snapshots by identity, so we must return the same array
 * reference until the underlying data changes (invalidated on every
 * write below via `notify`). */
const allPickedCache = new Map<string, Array<{ lineItemId: string; attId: string }>>();
const EMPTY_ALL_PICKED: Array<{ lineItemId: string; attId: string }> = [];

function notify(poId: string) {
  allPickedCache.delete(poId);
  const set = listeners.get(poId);
  if (!set) return;
  set.forEach((fn) => fn());
}

function ensurePo(poId: string): Map<string, Set<string>> {
  let po = store.get(poId);
  if (!po) {
    po = new Map();
    store.set(poId, po);
  }
  return po;
}

export function getPickedAttachmentIds(poId: string, lineItemId: string): Set<string> {
  // Stable reference for the empty case — required so React hooks like
  // useSyncExternalStore see the same snapshot when nothing has changed.
  return store.get(poId)?.get(lineItemId) ?? EMPTY_SET;
}

export function togglePickedAttachment(poId: string, lineItemId: string, attId: string): void {
  const po = ensurePo(poId);
  let set = po.get(lineItemId);
  if (!set) {
    set = new Set();
    po.set(lineItemId, set);
  } else {
    set = new Set(set);
    po.set(lineItemId, set);
  }
  if (set.has(attId)) set.delete(attId);
  else set.add(attId);
  notify(poId);
}

export function removePickedAttachment(poId: string, lineItemId: string, attId: string): void {
  const po = store.get(poId);
  const set = po?.get(lineItemId);
  if (!set || !set.has(attId)) return;
  const next = new Set(set);
  next.delete(attId);
  po!.set(lineItemId, next);
  notify(poId);
}

/** All picked (lineItemId, attId) pairs for a PO — used by the PO Detail
 *  Attachments tab to render the Item Attachments section. Returns a
 *  stable reference until the next write (see `notify`), so React
 *  useSyncExternalStore can rely on Object.is identity. */
export function getAllPickedForPo(poId: string): Array<{ lineItemId: string; attId: string }> {
  const cached = allPickedCache.get(poId);
  if (cached) return cached;
  const po = store.get(poId);
  if (!po || po.size === 0) return EMPTY_ALL_PICKED;
  const out: Array<{ lineItemId: string; attId: string }> = [];
  po.forEach((set, lineItemId) => {
    set.forEach((attId) => out.push({ lineItemId, attId }));
  });
  allPickedCache.set(poId, out);
  return out;
}

export function subscribe(poId: string, cb: () => void): () => void {
  let set = listeners.get(poId);
  if (!set) {
    set = new Set();
    listeners.set(poId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(poId);
  };
}
