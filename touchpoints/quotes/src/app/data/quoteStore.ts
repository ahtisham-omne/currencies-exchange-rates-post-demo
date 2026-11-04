import { Quote } from '../types/quote';

// Module-level store for dynamically created quotes
// This persists across React navigations within the same session
const createdQuotes: Map<string, Quote> = new Map();

// Store line items from creation flow (keyed by quote id)
export interface CreatedLineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  image?: string;
}

const createdQuoteLineItems: Map<string, CreatedLineItem[]> = new Map();

export function addCreatedQuote(quote: Quote, lineItems?: CreatedLineItem[]): void {
  createdQuotes.set(quote.id, quote);
  if (lineItems && lineItems.length > 0) {
    createdQuoteLineItems.set(quote.id, lineItems);
  }
}

export function getCreatedQuote(id: string): Quote | undefined {
  return createdQuotes.get(id);
}

export function getCreatedQuoteLineItems(id: string): CreatedLineItem[] | undefined {
  return createdQuoteLineItems.get(id);
}

export function getAllCreatedQuotes(): Quote[] {
  return Array.from(createdQuotes.values());
}

// ── Quote description persistence (survives navigation, keyed by quoteId or quoteNumber) ──
const quoteDescriptions: Map<string, string> = new Map();

export function getQuoteDescription(key: string): string {
  return quoteDescriptions.get(key) || '';
}

export function setQuoteDescription(key: string, description: string): void {
  quoteDescriptions.set(key, description);
}

// ── Pre-quote (RFQ/RFP) document store ──────────────────────────────────────
// Shared between OverviewTab (upload/remove) and LinkedTransactionsTab (display)
export interface PreQuoteDocument {
  id: string;
  name: string;
  size: string;
  type: string;           // file extension: 'pdf', 'xlsx', 'docx', etc.
  uploadedBy: string;
  uploadedAt: string;     // ISO date string e.g. '2026-02-19'
}

const preQuoteDocs: Map<string, PreQuoteDocument[]> = new Map();
let preQuoteListeners: Map<string, Set<() => void>> = new Map();

export function getPreQuoteDocs(quoteKey: string): PreQuoteDocument[] {
  return preQuoteDocs.get(quoteKey) || [];
}

export function addPreQuoteDoc(quoteKey: string, doc: PreQuoteDocument): void {
  const current = preQuoteDocs.get(quoteKey) || [];
  preQuoteDocs.set(quoteKey, [...current, doc]);
  notifyPreQuoteListeners(quoteKey);
}

export function removePreQuoteDoc(quoteKey: string, docId: string): void {
  const current = preQuoteDocs.get(quoteKey) || [];
  preQuoteDocs.set(quoteKey, current.filter(d => d.id !== docId));
  notifyPreQuoteListeners(quoteKey);
}

/** Subscribe to changes — returns unsubscribe function */
export function subscribePreQuoteDocs(quoteKey: string, listener: () => void): () => void {
  if (!preQuoteListeners.has(quoteKey)) {
    preQuoteListeners.set(quoteKey, new Set());
  }
  preQuoteListeners.get(quoteKey)!.add(listener);
  return () => {
    preQuoteListeners.get(quoteKey)?.delete(listener);
  };
}

function notifyPreQuoteListeners(quoteKey: string) {
  preQuoteListeners.get(quoteKey)?.forEach(fn => fn());
}