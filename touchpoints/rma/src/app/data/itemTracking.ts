/**
 * How a part is controlled, and where its stock sits.
 *
 * These four facts -- the control type, the two questions it answers, and the
 * bins a part is held in -- are read by the seeded RMA set and by the
 * provenance layer alike. They used to live in `mockRMAs`, which meant
 * `itemProvenance` imported the seeded returns to ask what kind of part it was
 * looking at, and the seeded returns could not ask provenance anything back.
 * A batch on a seeded return was invented rather than drawn from the batches
 * the part is actually held in, and it could not be otherwise while the
 * dependency ran that way.
 *
 * So the shared vocabulary sits on its own, both sides import it, and the
 * seeded data can be built from the same stock every picker reads.
 */

/** Stable numeric seed from a string key, so a pool comes out identical on
 *  every render without having to be stored anywhere. */
export function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** How a part is controlled. Four types, the same four the master carries:
 *  a part is serialized or not, and it is lot-controlled or not, and the two
 *  are separate facts. `lot` is a batch counted by quantity; `lot-serialized`
 *  is a batch whose units are numbered inside it. */
export type TrackingMode = 'serialized' | 'lot' | 'lot-serialized' | 'none';

/** Lot-controlled, either kind. */
export const isLotMode = (m: TrackingMode) => m === 'lot' || m === 'lot-serialized';
/** Carries unit numbers, either inside a batch or on its own. */
export const hasSerials = (m: TrackingMode) => m === 'serialized' || m === 'lot-serialized';

export function trackingModeFor(sku: string): TrackingMode {
  if (sku.startsWith('ELEC-') || sku.startsWith('SENS-') || sku.startsWith('TECH-')) return 'serialized';
  // Lot-controlled stock comes in two kinds, and the master treats them as two
  // different control types rather than as one with a footnote: a batch whose
  // units are themselves serialized, and a batch counted by quantity. Cable
  // and washers carry unit numbers inside the batch; bolts and nuts do not.
  if (sku.startsWith('WASH-') || sku.startsWith('CAB-')) return 'lot-serialized';
  if (sku.startsWith('BOLT-') || sku.startsWith('NUT-')) return 'lot';
  // Fall back to "none" for the rest -- a plain qty return with no unit picker.
  return 'none';
}

/**
 * The bins one part is held in.
 *
 * Three or four, stable on the part. Hashing every unit into the whole
 * warehouse put a part in all 288 bins at once, which is not a warehouse, and
 * it made "filter by location" a list nobody could use. Real stock of one
 * part sits in a few places.
 */
export function binsForItem(sku: string): string[] {
  const h = hashKey(`${sku}:bins`);
  const count = 3 + (h % 2);
  return Array.from({ length: count }, (_, i) => {
    const k = hashKey(`${sku}:bin:${i}`);
    const aisle = String.fromCharCode(65 + (k % 6));
    const rack = 1 + ((k >>> 3) % 12);
    const bin = 1 + ((k >>> 7) % 4);
    return `${aisle}-${String(rack).padStart(2, '0')}-${bin}`;
  });
}

/** Plant of manufacture, the first thing a real serial encodes. */
const SERIAL_PLANTS = ['MX', 'CN', 'VN', 'US', 'DE'];

/** Manufacturer-format serial: family, build plant and week, then an
 *  8-character unique tail. Only the tail identifies the unit, which is why
 *  the pickers collapse everything before it behind a preview control. */
export function buildSerial(sku: string, seed: number, index: number): string {
  const prefix = sku.split('-')[0] || 'SN';
  const plant = SERIAL_PLANTS[seed % SERIAL_PLANTS.length]!;
  const week = String((seed % 52) + 1).padStart(2, '0');
  const n = (seed + index * 2654435761) >>> 0;
  const m = (n * 0x45d9f3b) >>> 0;
  const tail = `${n.toString(36)}${m.toString(36)}`.toUpperCase().padStart(8, '0').slice(-8);
  return `${prefix}-24${week}${plant}-${tail}`;
}

/**
 * The individual units on hand for a received line -- the pool every picker
 * chooses from, and the pool provenance reads a unit's delivery out of.
 * Multiplying by a large odd constant keeps the run collision-free, so no two
 * units in a pool share a number.
 */
export function availableSerials(sku: string, poLineId: string, receivedQty: number): string[] {
  const base = hashKey(`${sku}:${poLineId}`);
  const out: string[] = [];
  for (let i = 0; i < receivedQty; i++) out.push(buildSerial(sku, base, i));
  return out;
}
