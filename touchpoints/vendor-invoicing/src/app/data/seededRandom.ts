// Deterministic PRNG (mulberry32). Used by mock data generators so
// the seeded dataset is identical across page reloads — the
// listings and detail pages must show the same rows after a
// refresh unless the user actually mutates state (create invoice,
// change status, etc.). Each mock file owns its own seed so they
// can be evolved independently.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
