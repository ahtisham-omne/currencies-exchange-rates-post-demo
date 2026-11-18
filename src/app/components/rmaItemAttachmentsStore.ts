/**
 * rmaItemAttachmentsStore — shared "which item attachments are attached to
 * which RMA" state. Both the line-item attachment picker and the
 * RMA Detail Attachments tab read/write this store so the two surfaces stay
 * in sync. Shape: { rmaId → { lineItemId → Set<attachmentId> } }.
 *
 * Pub/sub via a per-RMA listener set — consumers use useSyncExternalStore
 * with a subscriber scoped to their rmaId to avoid re-renders from unrelated
 * RMAs.
 */

type RmaMap = Map<string, Map<string, Set<string>>>;

const store: RmaMap = new Map();
const listeners = new Map<string, Set<() => void>>();
const EMPTY_SET: Set<string> = new Set();
/* Cached snapshot for `getAllPickedForRma` per-RMA. useSyncExternalStore
 * compares snapshots by identity, so we must return the same array
 * reference until the underlying data changes (invalidated on every
 * write below via `notify`). */
const allPickedCache = new Map<string, Array<{ lineItemId: string; attId: string }>>();
const EMPTY_ALL_PICKED: Array<{ lineItemId: string; attId: string }> = [];

function notify(rmaId: string) {
  allPickedCache.delete(rmaId);
  const set = listeners.get(rmaId);
  if (!set) return;
  set.forEach((fn) => fn());
}

function ensureRma(rmaId: string): Map<string, Set<string>> {
  let rma = store.get(rmaId);
  if (!rma) {
    rma = new Map();
    store.set(rmaId, rma);
  }
  return rma;
}

export function getPickedAttachmentIds(rmaId: string, lineItemId: string): Set<string> {
  // Stable reference for the empty case — required so React hooks like
  // useSyncExternalStore see the same snapshot when nothing has changed.
  return store.get(rmaId)?.get(lineItemId) ?? EMPTY_SET;
}

export function togglePickedAttachment(rmaId: string, lineItemId: string, attId: string): void {
  const rma = ensureRma(rmaId);
  let set = rma.get(lineItemId);
  if (!set) {
    set = new Set();
    rma.set(lineItemId, set);
  } else {
    set = new Set(set);
    rma.set(lineItemId, set);
  }
  if (set.has(attId)) set.delete(attId);
  else set.add(attId);
  notify(rmaId);
}

export function removePickedAttachment(rmaId: string, lineItemId: string, attId: string): void {
  const rma = store.get(rmaId);
  const set = rma?.get(lineItemId);
  if (!set || !set.has(attId)) return;
  const next = new Set(set);
  next.delete(attId);
  rma!.set(lineItemId, next);
  notify(rmaId);
}

/** All picked (lineItemId, attId) pairs for an RMA — used by the RMA Detail
 *  Attachments tab to render the Item Attachments section. Returns a
 *  stable reference until the next write (see `notify`), so React
 *  useSyncExternalStore can rely on Object.is identity. */
export function getAllPickedForRma(rmaId: string): Array<{ lineItemId: string; attId: string }> {
  const cached = allPickedCache.get(rmaId);
  if (cached) return cached;
  const rma = store.get(rmaId);
  if (!rma || rma.size === 0) return EMPTY_ALL_PICKED;
  const out: Array<{ lineItemId: string; attId: string }> = [];
  rma.forEach((set, lineItemId) => {
    set.forEach((attId) => out.push({ lineItemId, attId }));
  });
  allPickedCache.set(rmaId, out);
  return out;
}

export function subscribe(rmaId: string, cb: () => void): () => void {
  let set = listeners.get(rmaId);
  if (!set) {
    set = new Set();
    listeners.set(rmaId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(rmaId);
  };
}
