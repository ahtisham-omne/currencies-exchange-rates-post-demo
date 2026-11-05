/**
 * Pre-Sales-Order (RFQ / RFP) document store.
 *
 * Mirrors the Quote module's `preQuoteDocs` store pattern (see
 * `Quotes-Detail-V6.5/src/app/data/quoteStore.ts`). Shared between
 * `DealInformationTab` (upload/remove) and `AttachmentsTab` (display).
 *
 * Module-level `Map<soKey, PreSoDocument[]>`, with a tiny listener API so
 * subscribers can re-render when documents are added or removed.
 */

export interface PreSoDocument {
  id: string;
  name: string;
  size: string;
  type: string;            // file extension: 'pdf', 'xlsx', 'docx', etc.
  uploadedBy: string;
  uploadedAt: string;      // free-form date string, eg '10/22/2025' or '2026-02-19'
}

const preSoDocs: Map<string, PreSoDocument[]> = new Map();
const preSoListeners: Map<string, Set<() => void>> = new Map();

/** Read the current document list for a sales-order key. */
export function getPreSoDocs(soKey: string): PreSoDocument[] {
  return preSoDocs.get(soKey) || [];
}

/** Replace the entire document list for a sales-order key. */
export function setPreSoDocs(soKey: string, docs: PreSoDocument[]): void {
  preSoDocs.set(soKey, docs);
  notify(soKey);
}

/** Append a single document. */
export function addPreSoDoc(soKey: string, doc: PreSoDocument): void {
  const current = preSoDocs.get(soKey) || [];
  preSoDocs.set(soKey, [...current, doc]);
  notify(soKey);
}

/** Remove a document by id. */
export function removePreSoDoc(soKey: string, docId: string): void {
  const current = preSoDocs.get(soKey) || [];
  preSoDocs.set(soKey, current.filter((d) => d.id !== docId));
  notify(soKey);
}

/** Subscribe to changes, returns an unsubscribe function. */
export function subscribePreSoDocs(soKey: string, listener: () => void): () => void {
  if (!preSoListeners.has(soKey)) {
    preSoListeners.set(soKey, new Set());
  }
  preSoListeners.get(soKey)!.add(listener);
  return () => {
    preSoListeners.get(soKey)?.delete(listener);
  };
}

function notify(soKey: string): void {
  preSoListeners.get(soKey)?.forEach((fn) => fn());
}
