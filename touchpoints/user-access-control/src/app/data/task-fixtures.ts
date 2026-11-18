/**
 * Realistic fixture pools used to build human-readable task labels for
 * the deactivation / reassignment flow. Pulled from real-world warehouse
 * codes, customers, carriers, and document number formats so the modal
 * never shows placeholder text like "Cycle Count Task #CC-1042".
 */

export const WAREHOUSES = [
  "Memphis DC",
  "Reno DC",
  "Carlisle DC",
  "Düsseldorf Hub",
  "Singapore West",
  "Mississauga 02",
  "Rotterdam Cross-Dock",
  "Atlanta South 4",
] as const;

export const AISLES = [
  "Aisle 04A",
  "Aisle 09C",
  "Aisle 14B",
  "Aisle 22D",
  "Aisle 31E",
  "Mezzanine 02",
  "Bulk Zone 1",
] as const;

export const CUSTOMERS = [
  "Patagonia",
  "REI Co-op",
  "Wayfair",
  "Maersk",
  "Siemens Healthineers",
  "Bombardier",
  "Komatsu",
  "Asahi Beverages",
  "Olam Agri",
  "Frito-Lay",
  "Decathlon",
  "Ocado Retail",
] as const;

export const CARRIERS = [
  "FedEx Ground",
  "DHL Express",
  "Old Dominion",
  "Maersk Line",
  "DB Schenker",
  "XPO Logistics",
] as const;

export const VENDORS = [
  "Henkel Adhesives",
  "Bosch Rexroth",
  "3M Industrial",
  "SKF Bearings",
  "Trelleborg Sealing",
] as const;

export type Pool = readonly string[];

/** Deterministic pick from a pool: same (key, pool) always returns the same item. */
export function pick<T extends string>(pool: readonly T[], key: string | number): T {
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
