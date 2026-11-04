// Ported from chart-of-accounts-v2.1/src/lib/journalEntry.ts; adapted: only `hashSeed`, the one helper lib/comms.ts reads from that file.

/** FNV-1a over a string: a stable seed for anything derived from a record's id,
 *  so demo data neither shifts between renders nor reshuffles on reload. */
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
