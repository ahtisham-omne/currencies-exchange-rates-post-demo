/**
 * Return authorization document store.
 *
 * Holds the vendor's authorization paperwork for a return (the RMA number
 * confirmation email, the vendor's signed authorization form). Shared
 * between whichever surface uploads them and the Attachments tab that
 * displays them.
 *
 * Module-level `Map<rmaKey, RmaAuthDocument[]>`, with a small listener API
 * so subscribers re-render when documents are added or removed.
 */
export interface RmaAuthDocument {
  id: string;
  name: string;
  size: string;
  type: string;            // file extension: 'pdf', 'xlsx', 'docx', etc.
  uploadedBy: string;
  uploadedAt: string;      // free-form date string, such as '10/22/2025' or '2026-02-19'
}

const rmaAuthDocs: Map<string, RmaAuthDocument[]> = new Map();
const rmaAuthListeners: Map<string, Set<() => void>> = new Map();

/** Read the current document list for a return key. */
export function getRmaAuthDocs(rmaKey: string): RmaAuthDocument[] {
  return rmaAuthDocs.get(rmaKey) || [];
}

/** Replace the entire document list for a return key. */
export function setRmaAuthDocs(rmaKey: string, docs: RmaAuthDocument[]): void {
  rmaAuthDocs.set(rmaKey, docs);
  notify(rmaKey);
}

/** Append a single document. */
export function addRmaAuthDoc(rmaKey: string, doc: RmaAuthDocument): void {
  const current = rmaAuthDocs.get(rmaKey) || [];
  rmaAuthDocs.set(rmaKey, [...current, doc]);
  notify(rmaKey);
}

/** Remove a document by id. */
export function removeRmaAuthDoc(rmaKey: string, docId: string): void {
  const current = rmaAuthDocs.get(rmaKey) || [];
  rmaAuthDocs.set(rmaKey, current.filter((d) => d.id !== docId));
  notify(rmaKey);
}

/** Subscribe to changes, returns an unsubscribe function. */
export function subscribeRmaAuthDocs(rmaKey: string, listener: () => void): () => void {
  if (!rmaAuthListeners.has(rmaKey)) {
    rmaAuthListeners.set(rmaKey, new Set());
  }
  rmaAuthListeners.get(rmaKey)!.add(listener);
  return () => {
    rmaAuthListeners.get(rmaKey)?.delete(listener);
  };
}

function notify(rmaKey: string): void {
  rmaAuthListeners.get(rmaKey)?.forEach((fn) => fn());
}
