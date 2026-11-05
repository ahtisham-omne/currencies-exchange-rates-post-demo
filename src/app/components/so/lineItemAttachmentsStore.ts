/**
 * lineItemAttachmentsStore — the single source of truth for line-item
 * attachments on a Sales Order.
 *
 * Two surfaces read and write this store, so a file added or deleted on
 * one shows up on the other immediately:
 *   · The line-item configurator's Attachments tab (per line).
 *   · The SO Detail Attachments tab's "Item Attachments" folder (all
 *     lines, merged into the folder tree).
 *
 * Before this store the two surfaces each held their own local mock list,
 * so a deletion in one was invisible to the other. Everything that used
 * to be seeded as `category: "item"` inside `so.attachments` now lives
 * here instead (see `store.tsx`'s `generateAttachments`).
 *
 * Item-gallery files: copying one in from the item master's gallery
 * creates an ordinary, independent attachment record here. We cannot
 * track a live link back to the item master, so we do not pretend to:
 * `galleryId` records only which gallery entry it was copied FROM, which
 * lets the gallery view show what has already been added. Later changes
 * to the item master's gallery never touch the copy on this order.
 *
 * Same module-level Map + listener shape as `preSoDocsStore`.
 */

import type { FileKind } from "./types";

export interface LineItemAttachment {
  id: string;
  name: string;
  /** Human-readable description shown on the card's hover tooltip. */
  description?: string;
  /** Human-readable size string, e.g. "2.4 MB". */
  size: string;
  uploadedBy: string;
  /** Free-form date string, matching `Attachment.date` (e.g. "01/22"). */
  date: string;
  fileKind: FileKind;
  previewUrl?: string | null;
  /** The SO line this file is attached to. */
  lineItemId: string;
  /** Set only when the file was copied in from the item master's
   *  gallery. Provenance for the gallery view's "Added" state, NOT a
   *  live link: the copy is independent of the item master. */
  galleryId?: string;
}

/** soKey -> lineItemId -> attachments */
const store: Map<string, Map<string, LineItemAttachment[]>> = new Map();
const listeners: Map<string, Set<() => void>> = new Map();
const EMPTY: LineItemAttachment[] = [];

function notify(soKey: string): void {
  listeners.get(soKey)?.forEach((fn) => fn());
}

function ensureOrder(soKey: string): Map<string, LineItemAttachment[]> {
  let order = store.get(soKey);
  if (!order) {
    order = new Map();
    store.set(soKey, order);
  }
  return order;
}

/** Attachments on one line. Returns a stable empty array when none. */
export function getLineItemAttachments(soKey: string, lineItemId: string): LineItemAttachment[] {
  return store.get(soKey)?.get(lineItemId) ?? EMPTY;
}

/** Every line-item attachment on the order, flattened. Feeds the SO
 *  Detail Attachments tab's Item Attachments folder. */
export function getAllLineItemAttachments(soKey: string): LineItemAttachment[] {
  const order = store.get(soKey);
  if (!order) return EMPTY;
  const out: LineItemAttachment[] = [];
  order.forEach((list) => out.push(...list));
  return out;
}

/** Attach a file to a line. */
export function addLineItemAttachment(soKey: string, att: LineItemAttachment): void {
  const order = ensureOrder(soKey);
  const current = order.get(att.lineItemId) ?? [];
  order.set(att.lineItemId, [att, ...current]);
  notify(soKey);
}

/** Detach a file. Called from both surfaces, so it searches every line
 *  rather than requiring the caller to know which line owns the id. */
export function removeLineItemAttachment(soKey: string, attId: string): void {
  const order = store.get(soKey);
  if (!order) return;
  let changed = false;
  order.forEach((list, lineItemId) => {
    if (list.some((a) => a.id === attId)) {
      order.set(lineItemId, list.filter((a) => a.id !== attId));
      changed = true;
    }
  });
  if (changed) notify(soKey);
}

/** Rename a file in place. */
export function renameLineItemAttachment(soKey: string, attId: string, name: string): void {
  const order = store.get(soKey);
  if (!order) return;
  let changed = false;
  order.forEach((list, lineItemId) => {
    if (list.some((a) => a.id === attId)) {
      order.set(lineItemId, list.map((a) => a.id === attId ? { ...a, name } : a));
      changed = true;
    }
  });
  if (changed) notify(soKey);
}

/** Seed a line's attachments. Used once per SO by the mock generator in
 *  `store.tsx`; writes silently because nothing is subscribed yet. */
export function seedLineItemAttachments(soKey: string, lineItemId: string, atts: LineItemAttachment[]): void {
  ensureOrder(soKey).set(lineItemId, atts);
}

/** Subscribe to one order's line-item attachments. */
export function subscribeLineItemAttachments(soKey: string, listener: () => void): () => void {
  let set = listeners.get(soKey);
  if (!set) {
    set = new Set();
    listeners.set(soKey, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(soKey);
  };
}
