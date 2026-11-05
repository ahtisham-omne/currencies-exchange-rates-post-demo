/* ═══════════════════════════════════════════════════════════════
   Shared Catalog Data — Item types, base catalog, scale builder
   Used by NewPurchaseOrderPage, PurchaseSearchModal, and OrderFlow
   ═══════════════════════════════════════════════════════════════ */

import { UOM_REGISTRY, type UOMDefinition } from "./uomRegistry";

/* Mock data seed pool — drawn from the canonical registry so generated
   items always use UOMs the picker knows about. Picked sub-set keeps
   the mix recognizable to procurement users (no Drum/Tote on a count
   item; no Ton on an Each item). */
const MOCK_COUNT_VENDOR_UOMS: Array<{ uom: string; qty: number }> = (() => {
  const compat = UOM_REGISTRY.filter((u: UOMDefinition) => u.dimension === "count");
  const picks = ["Case", "Box", "Pallet", "Pack", "Unit", "Carton"];
  return picks
    .map((name) => compat.find((u) => u.name === name))
    .filter((u): u is UOMDefinition => !!u)
    .map((u) => ({ uom: u.name, qty: u.conversionFactor }));
})();

const MOCK_DEFAULT_UOMS: string[] = ["Each", "Piece", "Unit"].filter((name) =>
  UOM_REGISTRY.some((u) => u.name === name),
);

export interface CatalogItem {
  id: string;
  itemNumber: string;
  descriptiveName: string;
  image: string;
  /** Multiple images for lightbox cycling. First is the primary. */
  images?: string[];
  unitPrice: number;
  currentStock: number;
  minQuantity: number;
  shortageDate: string | null;
  partnerLocation: string;
  category: string;
  location: string;
  vendorUOM: string;
  vendorUOMQty: number;
  defaultUOM: string;
  discount: number;
}

/** Extra images pool for items that only have one image */
const EXTRA_IMAGES_POOL = [
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1590239481209-b99e795df500?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1764537432322-dad234b0848d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1763848843013-e83a5f30b8e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
];

/** Get all images for an item — always returns at least 2 */
export function getItemImages(item: CatalogItem): string[] {
  if (item.images && item.images.length > 1) return item.images;
  const primary = item.images?.[0] || item.image;
  // Deterministically pick 2 extra images based on item id hash
  const hash = item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const extras = EXTRA_IMAGES_POOL.filter((url) => url !== primary);
  const pick1 = extras[hash % extras.length];
  const pick2 = extras[(hash + 2) % extras.length];
  return [primary, pick1, pick1 === pick2 ? extras[(hash + 3) % extras.length] : pick2];
}

export const BASE_CATALOG: CatalogItem[] = [
  { id: "cat-1", itemNumber: "482910-34-17", descriptiveName: "Brake Pad Assembly Kit — Semi-metallic, front axle, low-dust formula for passenger vehicles. OE-equivalent friction material with chamfered edges and hardware included", image: "https://images.unsplash.com/photo-1625465329054-dde00a74a072?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbW90aXZlJTIwYnJha2UlMjBwYWQlMjBhc3NlbWJseSUyMHBhcnRzfGVufDF8fHx8MTc3MTc5NTUwMnww&ixlib=rb-4.1.0&q=80&w=1080", images: ["https://images.unsplash.com/photo-1625465329054-dde00a74a072?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbW90aXZlJTIwYnJha2UlMjBwYWQlMjBhc3NlbWJseSUyMHBhcnRzfGVufDF8fHx8MTc3MTc5NTUwMnww&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"], unitPrice: 87.50, currentStock: 12, minQuantity: 50, shortageDate: "Mar 15, 2026", partnerLocation: "General Motors (GM)", category: "Braking System", location: "Pasadena, Oklahoma", vendorUOM: "Kit", vendorUOMQty: 1, defaultUOM: "Kit", discount: 0 },
  { id: "cat-2", itemNumber: "519374-21-08", descriptiveName: "Hydraulic Pump Unit — Variable displacement axial piston, 3000 PSI max, 20 GPM flow rate. SAE-flanged ports with integrated pressure compensator", image: "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoeWRyYXVsaWMlMjBwdW1wJTIwaW5kdXN0cmlhbCUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NzE3OTU1MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080", images: ["https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoeWRyYXVsaWMlMjBwdW1wJTIwaW5kdXN0cmlhbCUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NzE3OTU1MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1590239481209-b99e795df500?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"], unitPrice: 342.00, currentStock: 3, minQuantity: 10, shortageDate: "Mar 05, 2026", partnerLocation: "Toyota Technical Center (TTC)", category: "Hydraulics", location: "Great Falls, Maryland", vendorUOM: "Unit", vendorUOMQty: 1, defaultUOM: "Unit", discount: 0 },
  { id: "cat-3", itemNumber: "637281-45-22", descriptiveName: "LED Headlight Module — Bi-LED projector, 6000K daylight white, 12V/24V compatible. IP67 waterproof with integrated DRL and turn signal function", image: "https://images.unsplash.com/photo-1765555648980-c5ab1665604e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxMRUQlMjBoZWFkbGlnaHQlMjBtb2R1bGUlMjBhdXRvbW90aXZlfGVufDF8fHx8MTc3MTc5NTUwM3ww&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 214.75, currentStock: 45, minQuantity: 30, shortageDate: null, partnerLocation: "Ford Motor Company", category: "Lighting", location: "Lansing, Illinois", vendorUOM: "Module", vendorUOMQty: 1, defaultUOM: "Module", discount: 0 },
  { id: "cat-4", itemNumber: "758493-67-31", descriptiveName: "Precision Bearing Set — Tapered roller, 62mm bore, chrome steel. Class 2 precision with double-sealed design for high-speed spindle applications", image: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwYmVhcmluZyUyMHN0ZWxlJTIwbWVjaGFuaWNhbHxlbnwxfHx8fDE3NzE3OTU1MDN8MA&ixlib=rb-4.1.0&q=80&w=1080", images: ["https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwYmVhcmluZyUyMHN0ZWxlJTIwbWVjaGFuaWNhbHxlbnwxfHx8fDE3NzE3OTU1MDN8MA&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1764537432322-dad234b0848d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"], unitPrice: 28.90, currentStock: 8, minQuantity: 100, shortageDate: "Feb 28, 2026", partnerLocation: "Tesla, Inc.", category: "Bearings", location: "Lafayette, California", vendorUOM: "Case", vendorUOMQty: 12, defaultUOM: "Each", discount: 5 },
  { id: "cat-5", itemNumber: "391847-12-55", descriptiveName: "Radiator Cooling Assembly — Aluminum core, 2-row cross-flow, 26\" x 18\". Direct-fit replacement with integrated transmission oil cooler and mounting brackets", image: "https://images.unsplash.com/photo-1760804462141-442810513d4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbW90aXZlJTIwcmFkaWF0b3IlMjBjb29saW5nJTIwc3lzdGVtfGVufDF8fHx8MTc3MTc5NTUwNHww&ixlib=rb-4.1.0&q=80&w=1080", images: ["https://images.unsplash.com/photo-1760804462141-442810513d4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbW90aXZlJTIwcmFkaWF0b3IlMjBjb29saW5nJTIwc3lzdGVtfGVufDF8fHx8MTc3MTc5NTUwNHww&ixlib=rb-4.1.0&q=80&w=1080", "https://images.unsplash.com/photo-1763848843013-e83a5f30b8e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"], unitPrice: 189.00, currentStock: 6, minQuantity: 15, shortageDate: "Mar 22, 2026", partnerLocation: "Chrysler (Stellantis N.V.)", category: "Cooling System", location: "Stockton, New Hampshire", vendorUOM: "Assembly", vendorUOMQty: 1, defaultUOM: "Assembly", discount: 0 },
  { id: "cat-6", itemNumber: "246810-33-19", descriptiveName: "Spark Plug Set (6-Pack) — Iridium-tipped, pre-gapped 0.032\", 14mm thread. Extended electrode for improved fuel efficiency and 100K mile service life", image: "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFyayUyMHBsdWclMjBpZ25pdGlvbiUyMGVuZ2luZSUyMHBhcnRzfGVufDF8fHx8MTc3MTc5NTUwNHww&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 54.60, currentStock: 120, minQuantity: 80, shortageDate: null, partnerLocation: "Honda Motor Co., Ltd. (USA)", category: "Ignition", location: "Portland, Illinois", vendorUOM: "Box", vendorUOMQty: 6, defaultUOM: "Each", discount: 3 },
  { id: "cat-7", itemNumber: "873561-78-42", descriptiveName: "Proximity Sensor Module — Inductive, 8mm detection range, PNP NO output. M18 stainless steel barrel with LED indicator for harsh industrial environments", image: "https://images.unsplash.com/photo-1767608880954-f36dbd2e5ddb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2Vuc29yJTIwZWxlY3Ryb25pYyUyMGNvbXBvbmVudHxlbnwxfHx8fDE3NzE3OTU1MDR8MA&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 67.25, currentStock: 22, minQuantity: 40, shortageDate: "Apr 10, 2026", partnerLocation: "BMW of North America", category: "Electronics", location: "Great Falls, Maryland", vendorUOM: "Pack", vendorUOMQty: 4, defaultUOM: "Each", discount: 0 },
  { id: "cat-8", itemNumber: "654928-56-73", descriptiveName: "Coolant Hose Kit — Silicone reinforced, 3-ply construction, rated to 350°F. Includes upper/lower radiator hoses, bypass hose, and stainless clamps", image: "https://images.unsplash.com/photo-1763848843013-e83a5f30b8e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxydWJiZXIlMjBob3NlJTIwYXV0b21vdGl2ZSUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzcxNzk1NTA1fDA&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 36.40, currentStock: 0, minQuantity: 25, shortageDate: "Feb 25, 2026", partnerLocation: "Rivian Automotive", category: "Cooling System", location: "Pasadena, Oklahoma", vendorUOM: "Kit", vendorUOMQty: 1, defaultUOM: "Kit", discount: 7 },
  { id: "cat-9", itemNumber: "412736-89-14", descriptiveName: "Air Filter Element — High-flow pleated cellulose, 12\" OD x 8\" ID, washable and reusable. Multi-layer filtration media with 99.5% efficiency rating", image: "https://images.unsplash.com/photo-1764537432322-dad234b0848d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdXRvbW90aXZlJTIwYWlyJTIwZmlsdGVyJTIwZW5naW5lfGVufDF8fHx8MTc3MTc5NTUwOXww&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 19.95, currentStock: 200, minQuantity: 100, shortageDate: null, partnerLocation: "Nissan North America", category: "Filtration", location: "Lansing, Illinois", vendorUOM: "Element", vendorUOMQty: 1, defaultUOM: "Element", discount: 0 },
  { id: "cat-10", itemNumber: "589013-42-66", descriptiveName: "Pressure Relief Valve — Spring-loaded, 1/2\" NPT, adjustable 500-3000 PSI. Stainless steel body with Buna-N seals for hydraulic and pneumatic systems", image: "https://images.unsplash.com/photo-1590239481209-b99e795df500?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMHZhbHZlJTIwaW5kdXN0cmlhbHxlbnwxfHx8fDE3NzE3OTU1MDl8MA&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 78.30, currentStock: 5, minQuantity: 20, shortageDate: "Mar 08, 2026", partnerLocation: "Lucid Motors", category: "Hydraulics", location: "Lafayette, California", vendorUOM: "Valve", vendorUOMQty: 1, defaultUOM: "Valve", discount: 0 },
  { id: "cat-11", itemNumber: "731256-91-28", descriptiveName: "Wiring Harness Sub-Assembly — Engine bay main harness, 48-pin ECU connector. Heat-shrink junctions with CAN bus and power distribution integrated", image: "https://images.unsplash.com/photo-1564912139097-6e35a037c77f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJpY2FsJTIwd2lyaW5nJTIwaGFybmVzcyUyMGF1dG9tb3RpdmV8ZW58MXx8fHwxNzcxNzk1NTA5fDA&ixlib=rb-4.1.0&q=80&w=1080", unitPrice: 156.80, currentStock: 2, minQuantity: 12, shortageDate: "Mar 01, 2026", partnerLocation: "General Motors (GM)", category: "Electronics", location: "Stockton, New Hampshire", vendorUOM: "Sub-Assembly", vendorUOMQty: 1, defaultUOM: "Sub-Assembly", discount: 0 },
  { id: "cat-12", itemNumber: "198374-15-83", descriptiveName: "Steel Fastener Kit (200pc) — Grade 8.8 hex bolts, nuts, and washers, zinc-plated. Assorted M6-M12 metric sizes in organized compartment case", image: "https://images.unsplash.com/photo-1769971361558-3e32ddc52388?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGVlbCUyMGJvbHRzJTIwZmFzdGVuZXJzJTIwaGFyZHdhcmV8ZW58MXx8fHwxNzcxNzkzNDU5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 42.10, currentStock: 18, minQuantity: 50, shortageDate: "Apr 02, 2026", partnerLocation: "Toyota Technical Center (TTC)", category: "Fasteners", location: "Portland, Illinois", vendorUOM: "Kit", vendorUOMQty: 200, defaultUOM: "Kit", discount: 0 },
  /* ── Unassigned Vendor Items (partnerLocation = "") ── */
  { id: "cat-ua-1", itemNumber: "920115-48-27", descriptiveName: "Heavy-Duty Hydraulic Cylinder — 4\" Bore, 24\" Stroke", image: "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwaHlkcmF1bGljJTIwY3lsaW5kZXIlMjBtYW51ZmFjdHVyaW5nfGVufDF8fHx8MTc3MTg3OTcxNHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 4, minQuantity: 10, shortageDate: "Mar 28, 2026", partnerLocation: "", category: "Hydraulics", location: "Pasadena, Oklahoma", vendorUOM: "Unit", vendorUOMQty: 1, defaultUOM: "Unit", discount: 0 },
  { id: "cat-ua-2", itemNumber: "831467-73-55", descriptiveName: "Brushless DC Motor — 48V, 3kW, IP65 Rated", image: "https://images.unsplash.com/photo-1767739791243-af1facf4b87b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMG1vdG9yJTIwaW5kdXN0cmlhbCUyMGNvbXBvbmVudHxlbnwxfHx8fDE3NzE4Nzk3MTR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 0, minQuantity: 8, shortageDate: "Mar 10, 2026", partnerLocation: "", category: "Electronics", location: "Lafayette, California", vendorUOM: "Unit", vendorUOMQty: 1, defaultUOM: "Unit", discount: 0 },
  { id: "cat-ua-3", itemNumber: "745290-66-18", descriptiveName: "Cold-Rolled Steel Plate — 1/4\" x 48\" x 96\", A36 Grade", image: "https://images.unsplash.com/photo-1658825959612-8f4bce484393?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGVlbCUyMHBsYXRlJTIwbWV0YWwlMjBpbmR1c3RyaWFsJTIwbWF0ZXJpYWx8ZW58MXx8fHwxNzcxODc5NzE0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 15, minQuantity: 20, shortageDate: null, partnerLocation: "", category: "Raw Materials", location: "Lansing, Illinois", vendorUOM: "Sheet", vendorUOMQty: 1, defaultUOM: "Sheet", discount: 0 },
  { id: "cat-ua-4", itemNumber: "618734-29-41", descriptiveName: "Viton O-Ring Assortment Kit — 382pc, Imperial Sizes", image: "https://images.unsplash.com/photo-1721048379815-751e1c6a748a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxydWJiZXIlMjBzZWFsJTIwb3JpbmclMjBpbmR1c3RyaWFsJTIwcGFydHxlbnwxfHx8fDE3NzE4Nzk3MTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 35, minQuantity: 40, shortageDate: "Apr 20, 2026", partnerLocation: "", category: "Seals & Gaskets", location: "Great Falls, Maryland", vendorUOM: "Kit", vendorUOMQty: 1, defaultUOM: "Kit", discount: 0 },
  { id: "cat-ua-5", itemNumber: "503871-82-63", descriptiveName: "Pneumatic Solenoid Valve — 5/2 Way, 1/4\" NPT, 24VDC", image: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbmV1bWF0aWMlMjB2YWx2ZSUyMGluZHVzdHJpYWwlMjBjb21wb25lbnR8ZW58MXx8fHwxNzcxODc5NzE1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 7, minQuantity: 15, shortageDate: "Mar 18, 2026", partnerLocation: "", category: "Pneumatics", location: "Stockton, New Hampshire", vendorUOM: "Valve", vendorUOMQty: 1, defaultUOM: "Valve", discount: 0 },
  { id: "cat-ua-6", itemNumber: "396142-57-34", descriptiveName: "Enameled Copper Magnet Wire — 18 AWG, 10lb Spool", image: "https://images.unsplash.com/photo-1635179885954-c778885a1197?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3BwZXIlMjB3aXJlJTIwc3Bvb2wlMjBlbGVjdHJpY2FsfGVufDF8fHx8MTc3MTg3OTcxNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral", unitPrice: 0, currentStock: 22, minQuantity: 30, shortageDate: null, partnerLocation: "", category: "Electrical", location: "Portland, Illinois", vendorUOM: "Spool", vendorUOMQty: 1, defaultUOM: "Spool", discount: 0 },
];

export function buildScaledCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [...BASE_CATALOG];
  const names = [
    "Transmission Gear Set — Helical cut, 6-speed manual, hardened alloy steel. Matched set with synchro rings and needle bearings for smooth shifting", "Exhaust Manifold Gasket — Multi-layer steel construction, embossed sealing rings. Heat resistant to 1800°F with anti-stick coating for easy removal", "Fuel Injector Nozzle — High-impedance, 4-hole spray pattern, 220cc/min flow rate. OE-spec pintle design with built-in micro filter", "Timing Belt Kit — HNBR compound, double-sided teeth, includes tensioner and idler pulleys. 100K mile rated with water pump gasket included",
    "Power Window Motor — 12V DC, 80 RPM, 10Nm torque output. Integrated gear reduction with thermal overload protection and weatherproof connector", "Alternator Assembly — 150A output, 12V, Denso-type with integrated voltage regulator. Internal fan cooled with heavy-duty rectifier bridge", "Starter Motor Unit — 1.4kW gear-reduction type, 12V solenoid-engaged. Permanent magnet design with planetary gear set for high cranking torque", "Clutch Plate Set — Organic friction material, 240mm diameter, sprung hub center. Includes pressure plate and throw-out bearing for complete replacement",
    "Turbo Intercooler Core — Bar-and-plate aluminum construction, 24\" x 12\" x 3\". 500HP rated with 2.5\" inlet/outlet for maximum airflow efficiency", "CV Joint Boot Kit — Thermoplastic polyurethane, split-design for easy install without removing axle. Includes clamps, grease packet, and instructions", "EGR Valve Assembly — Electronically controlled, PWM-actuated with position sensor. Stainless steel pintle valve with integrated coolant passages", "Oxygen Sensor (Lambda) — Wideband 4-wire, heated element, 0-5V output. Zirconia sensing element with stainless steel housing and OE connector",
    "Catalytic Converter Shell — Stainless steel 409, dual-substrate with heat shield. EPA/CARB compliant with ceramic honeycomb substrate and precious metal coating", "Drive Shaft Coupling — Flexible rubber disc type, 6-bolt pattern, dynamic balanced. Vibration dampening design with heat-treated steel hub flanges", "Wheel Hub Bearing — Double-row angular contact, pre-greased and sealed. Integrated ABS sensor ring with press-fit inner race and bolt-on flange", "Suspension Strut Mount — Rubber-bonded steel, bearing-integrated top mount. Self-aligning design with corrosion-resistant zinc plating and dust boot",
    "Anti-Roll Bar Link — Ball-joint end links, zinc-plated steel shaft with polyurethane boots. OE-length replacement with thread pitch matching factory specs", "Fuel Pump Module — In-tank electric, 255 LPH flow rate at 43 PSI. Includes fuel level sender, strainer, and wiring harness with OE connector", "Thermostat Housing — Aluminum die-cast with integrated thermostat and gasket. Includes coolant temperature sensor port and bleed valve for air purging", "Oil Pressure Switch — Single-wire sender, 1/4\" NPT thread, 0-100 PSI range. Brass body with Viton seal for compatibility with synthetic oils",
    "Camshaft Position Sensor — Hall-effect type, 3-pin connector, magnetoresistive element. Precise timing signal with integrated signal conditioning circuit", "Crankshaft Pulley — Harmonic balancer with tuned rubber damper ring. SFI-rated forged steel hub with precision-machined serpentine belt groove profile", "Water Pump Impeller — Cast aluminum with six-vane design, 3\" diameter. Dynamically balanced with hardened shaft and ceramic mechanical seal assembly", "Ignition Coil Pack — Coil-on-plug design, 35kV secondary output, epoxy-filled. Built-in igniter module with EMI shielding for interference-free operation",
    "Throttle Body Assembly — Electronic drive-by-wire, 65mm bore diameter. Integrated TPS and IAC motor with aluminum alloy body and coolant bypass port", "Mass Airflow Sensor — Hot-wire type, 5V analog output, 0-750 kg/h range. Temperature-compensated with integrated intake air temperature sensor", "Intake Manifold Plenum — Composite polymer, variable-length runner design. Includes integrated MAP sensor port, PCV valve fitting, and fuel rail mounting", "Piston Ring Set — 3-piece set per cylinder, moly-filled top ring, chrome second ring. Oil control ring with spring expander for optimal sealing",
    "Connecting Rod Bearing — Tri-metal construction, copper-lead-tin overlay. Precision crush height with oil groove and locating tab for exact positioning", "Valve Cover Gasket Set — Molded silicone rubber with steel carrier, includes spark plug tube seals. Oil-resistant compound rated for continuous 350°F exposure", "Rocker Arm Assembly — Roller-tip design, investment cast steel with hardened pivot. Reduced friction with needle bearing roller for extended valve train life", "Push Rod Set — Hardened 4130 chromoly steel, 0.080\" wall thickness, heat-treated tips. Precision ground to ±0.001\" length tolerance for consistent valve lift",
    "Head Bolt Kit — Torque-to-yield fasteners, Grade 12.9, phosphate-coated. Includes ARP-spec washers with complete torque sequence documentation", "Flywheel Assembly — Nodular iron casting, 153-tooth ring gear, SFI 1.1 certified. Precision surface ground with dowel pin holes for accurate alignment", "Torque Converter — 3-element design, 12\" diameter, 2200 RPM stall speed. Lock-up clutch with anti-balloon plate and furnace-brazed turbine assembly", "Differential Pinion Gear — Spiral bevel, 8620 alloy steel, carburized and lapped. Matched ring-and-pinion set with correct backlash and contact pattern",
    "Transfer Case Chain — Morse HY-VO silent chain, 1.25\" pitch, 42-link. Pre-stretched and heat-treated with hardened rollers for extended service life", "Axle Shaft Assembly — Full-floating design, 4340 chromoly steel, 31-spline. Shot-peened and Magnaflux inspected with new wheel studs pressed in", "Tie Rod End — Forged steel housing, greaseable ball joint with Zerk fitting. Includes castle nut, cotter pin, and jam nut for toe adjustment", "Ball Joint (Lower) — Forged steel, press-fit type with dust boot and grease fitting. Extended ball stud with 360° rotation and low-friction bearing",
    "Control Arm Bushing — Hydraulic-filled polyurethane, OE-spec durometer. Progressive rate design with integrated metal sleeve for bolt-through mounting", "Shock Absorber Unit — Twin-tube gas-charged, velocity-sensitive valving. Hardened chrome piston rod with multi-lip oil seal and stone guard", "Leaf Spring Pack — Multi-leaf SAE 5160 spring steel, shot-peened and stress-relieved. Military wrap eye design with zinc clips and center bolt", "Coil Spring Set — Progressive rate, H-VAR cold-wound steel, powder-coated. Load-matched pair with correct free length and spring rate specifications",
    "Brake Caliper Assembly — Single-piston sliding design, phenolic piston with dust boot. Zinc-plated bracket with new guide pins, boots, and bleeder screw", "Brake Disc Rotor — Vented dual-disc design, G3000 grey iron casting. Directional cooling vanes with anti-rust coating and precision hub bore finish", "Master Cylinder Kit — Tandem bore, 1-1/8\" diameter, aluminum body. Includes reservoir, cap, seals, and proportioning valve with integrated pressure switch", "Brake Booster Unit — Dual-diaphragm vacuum-assisted, 9\" diameter. Powder-coated steel housing with integrated check valve and pushrod adjustment",
    "Power Steering Rack — Hydraulic rack-and-pinion, variable ratio. Remanufactured with new seals, tie rod boots, and flow control valve assembly", "AC Compressor Clutch — Electromagnetic, 6-groove serpentine pulley, 12V coil. Pre-balanced assembly with precision air gap and thermal protection", "Heater Core Assembly — Brazed aluminum tube-and-fin, 6-5/8\" x 7-1/4\" core. OE-fit with inlet/outlet tubes and foam gasket seal for dash mounting", "Blower Motor Resistor — Wire-wound ceramic substrate, 4-speed control. Thermal fuse protection with OE-spec connector and mounting hardware",
    "Door Lock Actuator — 12V DC motor with integrated latch mechanism. Dual-wire control with anti-theft coding capability and weatherproof connector", "Window Regulator Assembly — Cable-driven with DC motor, auto-up/down function. Anti-pinch safety feature with integrated motor and wiring harness", "Windshield Wiper Motor — 12V DC, 2-speed with intermittent control module. Sealed gear housing with hardened output shaft and park position switch", "Rear View Mirror Assembly — Auto-dimming electrochromic, integrated HomeLink and compass. Wired connection with map light module and rain sensor mount",
    "Fuel Rail Pressure Regulator — Diaphragm-type, vacuum referenced, 43 PSI base pressure. Stainless steel housing with Viton diaphragm and return line fitting", "Variable Valve Timing Solenoid — Oil control valve, PWM-driven, 12V. Aluminum body with mesh screen filter and integrated O-ring seals for leak-free installation", "Engine Mount Bracket — Hydraulic-filled rubber isolator, load-rated to 300 lbs. Cast aluminum bracket with integrated torque strut for vibration reduction", "Transmission Filter Kit — OE-spec felt media with molded rubber gasket. Includes drain plug washer, magnet, and correct fluid capacity documentation",
    "Differential Seal Kit — Complete axle tube and pinion seal set, fluoroelastomer. Includes output shaft seals, cover gasket, and thread sealant tube", "Stabilizer Bar Bushing Set — Split polyurethane, 24mm ID, self-lubricating. Greaseless design with stainless steel brackets and hardware for corrosion resistance", "Steering Column Bearing — Needle roller with integrated dust shield, pressed steel cage. Pre-greased for lifetime lubrication with snap ring retainer", "Exhaust Flex Pipe Connector — Stainless steel braided inner liner, 2.25\" x 10\" body. Double-braided outer mesh with interlock inner core for maximum flexibility",
  ];
  const images = BASE_CATALOG.map((c) => c.image);
  const categories = ["Braking System", "Hydraulics", "Lighting", "Bearings", "Cooling System", "Ignition", "Electronics", "Filtration", "Fasteners", "Drivetrain", "Suspension", "Engine"];
  const partners = ["General Motors (GM)", "Toyota Technical Center (TTC)", "Ford Motor Company", "Tesla, Inc.", "Chrysler (Stellantis N.V.)", "Rivian Automotive", "Lucid Motors", "Honda Motor Co., Ltd. (USA)", "Nissan North America", "BMW of North America"];
  const locations = ["Pasadena, Oklahoma", "Great Falls, Maryland", "Lansing, Illinois", "Lafayette, California", "Stockton, New Hampshire", "Portland, Illinois"];
  for (let i = 0; i < names.length; i++) {
    const stock = Math.floor(Math.random() * 250);
    const minQ = [10, 15, 20, 25, 30, 40, 50, 80, 100][Math.floor(Math.random() * 9)];
    // Drawn from the registry so generated mock items never reference
    // a unit the picker can't render.
    const vendorUOM = MOCK_COUNT_VENDOR_UOMS[i % MOCK_COUNT_VENDOR_UOMS.length];
    const defaultUOMs = MOCK_DEFAULT_UOMS;
    const discount = i % 5 === 0 ? [3, 5, 7, 10][Math.floor(Math.random() * 4)] : 0;
    items.push({
      id: `cat-gen-${i}`,
      itemNumber: `${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`,
      descriptiveName: names[i],
      image: images[i % images.length],
      unitPrice: Math.round((15 + Math.random() * 400) * 100) / 100,
      currentStock: stock,
      minQuantity: minQ,
      shortageDate: stock < minQ ? ["Mar 05, 2026", "Mar 12, 2026", "Mar 20, 2026", "Apr 01, 2026", "Apr 15, 2026"][Math.floor(Math.random() * 5)] : null,
      partnerLocation: partners[i % partners.length],
      category: categories[i % categories.length],
      location: locations[i % locations.length],
      vendorUOM: vendorUOM.uom,
      vendorUOMQty: vendorUOM.qty,
      defaultUOM: defaultUOMs[i % defaultUOMs.length],
      discount,
    });
  }
  return items;
}

/** Full catalog, generated once */
export const CATALOG = buildScaledCatalog();

/** Unique categories sorted */
export const CATEGORIES = [...new Set(CATALOG.map((c) => c.category))].sort();

/** All known vendor names — includes catalog-assigned vendors + extended vendor network */
const EXTENDED_VENDOR_NAMES = [
  "Bosch Rexroth", "Continental AG", "Denso Corporation", "ZF Friedrichshafen",
  "Magna International", "Aisin Corporation", "Schaeffler Group", "BorgWarner Inc.",
  "Dana Incorporated", "Valeo SA", "Aptiv PLC", "Hyundai Mobis",
  "Sensata Technologies", "Eaton Corporation", "Parker Hannifin",
  "Cummins Inc.", "Timken Company", "SKF Group", "Flex-N-Gate",
];

/** Unique partner locations sorted (excluding unassigned) — includes all vendors from catalog + extended network */
export const PARTNER_LOCATIONS = [...new Set([
  ...CATALOG.map((c) => c.partnerLocation).filter(Boolean),
  ...EXTENDED_VENDOR_NAMES,
])].sort();

/** Unique locations sorted */
export const LOCATIONS = [...new Set(CATALOG.map((c) => c.location))].sort();

/** Vendor metadata for suggestion cards */
export interface VendorInfo {
  name: string;
  abbr: string;
  itemCount: number;
  categories: string[];
}

export function getVendorSuggestions(): VendorInfo[] {
  const vendorMap = new Map<string, { categories: Set<string>; count: number }>();
  for (const item of CATALOG) {
    if (!item.partnerLocation) continue; // skip unassigned items
    const entry = vendorMap.get(item.partnerLocation) || { categories: new Set<string>(), count: 0 };
    entry.count++;
    entry.categories.add(item.category);
    vendorMap.set(item.partnerLocation, entry);
  }

  const abbrMap: Record<string, string> = {
    "General Motors (GM)": "GM",
    "Toyota Technical Center (TTC)": "TTC",
    "Ford Motor Company": "FMC",
    "Tesla, Inc.": "T",
    "Chrysler (Stellantis N.V.)": "CS",
    "Rivian Automotive": "RA",
    "Lucid Motors": "LM",
    "Honda Motor Co., Ltd. (USA)": "HM",
    "Nissan North America": "NNA",
    "BMW of North America": "BMW",
  };

  return Array.from(vendorMap.entries())
    .map(([name, data]) => ({
      name,
      abbr: abbrMap[name] || name.slice(0, 3).toUpperCase(),
      itemCount: data.count,
      categories: [...data.categories].slice(0, 3),
    }))
    .sort((a, b) => b.itemCount - a.itemCount);
}

/** POC / Contact suggestions — pulled from the Partners module per vendor */
export interface VendorContactInfo {
  name: string;
  role: string;
  email: string;
  phone: string;
}

/** Per-vendor POC directory (from Partners module) */
export const VENDOR_CONTACTS: Record<string, VendorContactInfo[]> = {
  "General Motors (GM)": [
    { name: "Richard Kowalski", role: "Vendor Account Manager", email: "r.kowalski@gm.com", phone: "+1 (313) 556-5102" },
    { name: "Linda Vasquez", role: "Supply Chain Coordinator", email: "l.vasquez@gm.com", phone: "+1 (313) 556-5203" },
    { name: "James Rodriguez", role: "Warehouse Manager", email: "j.rodriguez@gm.com", phone: "+1 (390) 555-0101" },
    { name: "Patricia Kim", role: "Quality Assurance Lead", email: "p.kim@gm.com", phone: "+1 (313) 556-5310" },
    { name: "Michael Chen", role: "Logistics Director", email: "m.chen@gm.com", phone: "+1 (313) 556-5415" },
    { name: "Sarah O'Brien", role: "Procurement Analyst", email: "s.obrien@gm.com", phone: "+1 (313) 556-5520" },
    { name: "David Patel", role: "Inventory Specialist", email: "d.patel@gm.com", phone: "+1 (313) 556-5625" },
    { name: "Jennifer Wong", role: "Shipping Coordinator", email: "j.wong@gm.com", phone: "+1 (313) 556-5730" },
    { name: "Robert Garcia", role: "Parts Manager", email: "r.garcia@gm.com", phone: "+1 (313) 556-5835" },
    { name: "Amanda Foster", role: "Vendor Compliance Officer", email: "a.foster@gm.com", phone: "+1 (313) 556-6045" },
    { name: "Thomas Nguyen", role: "Technical Liaison", email: "t.nguyen@gm.com", phone: "+1 (313) 556-6150" },
    { name: "Rachel Simmons", role: "Contract Administrator", email: "r.simmons@gm.com", phone: "+1 (313) 556-6255" },
  ],
  "Toyota Technical Center (TTC)": [
    { name: "Kenji Nakamura", role: "Procurement Lead", email: "k.nakamura@toyota-tech.com", phone: "+1 (734) 995-2701" },
    { name: "Emily Sato", role: "Parts Coordinator", email: "e.sato@toyota-tech.com", phone: "+1 (734) 995-2715" },
  ],
  "Ford Motor Company": [
    { name: "Brian Mitchell", role: "Vendor Relations Manager", email: "b.mitchell@ford.com", phone: "+1 (313) 322-3120" },
    { name: "Samantha Cole", role: "Logistics Coordinator", email: "s.cole@ford.com", phone: "+1 (313) 322-3145" },
  ],
  "Tesla, Inc.": [
    { name: "Jason Wu", role: "Procurement Specialist", email: "j.wu@tesla.com", phone: "+1 (650) 681-5140" },
    { name: "Priya Sharma", role: "Vendor Ops Lead", email: "p.sharma@tesla.com", phone: "+1 (650) 681-5155" },
  ],
  "Chrysler (Stellantis N.V.)": [
    { name: "Angela Ricci", role: "Supply Chain Manager", email: "a.ricci@stellantis.com", phone: "+1 (248) 576-5810" },
    { name: "David Morales", role: "Purchasing Coordinator", email: "d.morales@stellantis.com", phone: "+1 (248) 576-5825" },
  ],
  "Honda Motor Co., Ltd. (USA)": [
    { name: "Takeshi Honda", role: "Vendor Account Lead", email: "t.honda@honda.com", phone: "+1 (310) 783-2105" },
    { name: "Michelle Lee", role: "Parts Procurement Specialist", email: "m.lee@honda.com", phone: "+1 (310) 783-2118" },
  ],
  "Nissan North America": [
    { name: "Carlos Fernandez", role: "Vendor Relations Lead", email: "c.fernandez@nissan-usa.com", phone: "+1 (615) 725-1112" },
    { name: "Ayumi Tanaka", role: "Supply Operations Manager", email: "a.tanaka@nissan-usa.com", phone: "+1 (615) 725-1130" },
  ],
  "BMW of North America": [
    { name: "Stefan Bauer", role: "Procurement Manager", email: "s.bauer@bmwna.com", phone: "+1 (201) 307-4110" },
    { name: "Katherine Walsh", role: "Vendor Coordinator", email: "k.walsh@bmwna.com", phone: "+1 (201) 307-4125" },
  ],
  "Rivian Automotive": [
    { name: "Omar Jenkins", role: "Supply Chain Lead", email: "o.jenkins@rivian.com", phone: "+1 (888) 748-4305" },
    { name: "Chloe Zhang", role: "Procurement Analyst", email: "c.zhang@rivian.com", phone: "+1 (888) 748-4320" },
  ],
  "Lucid Motors": [
    { name: "Nathan Reeves", role: "Vendor Ops Manager", email: "n.reeves@lucidmotors.com", phone: "+1 (510) 648-3601" },
    { name: "Sofia Martinez", role: "Parts Sourcing Lead", email: "s.martinez@lucidmotors.com", phone: "+1 (510) 648-3615" },
  ],
};

/** Default fallback contact when vendor has no POC configured */
const DEFAULT_VENDOR_CONTACT: VendorContactInfo = {
  name: "Vendor Contact",
  role: "Account Representative",
  email: "contact@vendor.com",
  phone: "+1 (555) 000-0000",
};

/** Get vendor contacts for a given partner location */
export function getVendorContacts(partnerLocation: string): VendorContactInfo[] {
  return VENDOR_CONTACTS[partnerLocation] || [DEFAULT_VENDOR_CONTACT];
}

/** @deprecated — kept for backward-compat; use VENDOR_CONTACTS instead */
export interface ContactInfo {
  name: string;
  role: string;
  email: string;
  phone: string;
}

/** @deprecated — old internal contacts; use getVendorContacts() instead */
export const CONTACTS: ContactInfo[] = [
  { name: "Sarah Chen", role: "Procurement Manager", email: "sarah.chen@omne-erp.com", phone: "+1 (405) 555-0121" },
  { name: "Marcus Rivera", role: "Supply Chain Lead", email: "m.rivera@omne-erp.com", phone: "+1 (405) 555-0198" },
  { name: "Diana Park", role: "Warehouse Coordinator", email: "d.park@omne-erp.com", phone: "+1 (312) 555-0164" },
  { name: "James Thompson", role: "Operations Director", email: "j.thompson@omne-erp.com", phone: "+1 (301) 555-0187" },
];

/** Frequently ordered items — simulated order frequency data */
export interface FrequentItem extends CatalogItem {
  orderCount: number;
  lastOrdered: string;
}

export function getFrequentlyOrderedItems(): FrequentItem[] {
  const frequentIds = [
    { id: "cat-1", orderCount: 47, lastOrdered: "2 days ago" },
    { id: "cat-4", orderCount: 38, lastOrdered: "3 days ago" },
    { id: "cat-6", orderCount: 35, lastOrdered: "1 week ago" },
    { id: "cat-2", orderCount: 29, lastOrdered: "4 days ago" },
    { id: "cat-11", orderCount: 26, lastOrdered: "5 days ago" },
    { id: "cat-5", orderCount: 22, lastOrdered: "1 week ago" },
    { id: "cat-3", orderCount: 19, lastOrdered: "2 weeks ago" },
    { id: "cat-8", orderCount: 17, lastOrdered: "6 days ago" },
  ];

  return frequentIds
    .map(({ id, orderCount, lastOrdered }) => {
      const item = CATALOG.find((c) => c.id === id);
      if (!item) return null;
      return { ...item, orderCount, lastOrdered };
    })
    .filter(Boolean) as FrequentItem[];
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR ENTITIES — Rich vendor data with locations for
   Pay To, Shipped To, and Funded By selection flows
   ═══════════════════════════════════════════════════════════════ */

export interface VendorLocationInfo {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  contacts?: VendorEntityContact[];
}

export interface VendorEntityContact {
  name: string;
  initials: string;
  role: string;
  phone: string;
  department: string;
  email: string;
}

export interface VendorEntity {
  id: string;
  name: string;
  abbr: string;
  locations: VendorLocationInfo[];
  contact: VendorEntityContact;
}

/** Pay To vendors — financial entities for payment */
export const PAY_TO_VENDORS: VendorEntity[] = [
  {
    id: "payto-1",
    name: "General Motors Financial",
    abbr: "GM",
    locations: [
      { id: "gm-loc-1", name: "GM Financial HQ", description: "General Motors Financial, 801 Cherry St, Fort Worth, TX.", isDefault: true, contacts: [
        { name: "Richard Kowalski", initials: "RK", role: "Accounts Receivable", phone: "(313) 556-5102", department: "Finance & Billing", email: "r.kowalski@gm.com" },
        { name: "Sandra Mitchell", initials: "SM", role: "AP Coordinator", phone: "(313) 556-5200", department: "Finance & Billing", email: "s.mitchell@gm.com" },
      ] },
      { id: "gm-loc-2", name: "GM Financial Detroit", description: "General Motors Financial, 300 Renaissance Ctr, Detroit, MI.", isDefault: false, contacts: [
        { name: "Tom Baines", initials: "TB", role: "Regional Finance Lead", phone: "(313) 667-4100", department: "Regional Operations", email: "t.baines@gm.com" },
      ] },
      { id: "gm-loc-3", name: "GM Financial Austin", description: "General Motors Financial, 7500 Rialto Blvd, Austin, TX.", isDefault: false, contacts: [
        { name: "Maria Gonzales", initials: "MG", role: "Vendor Relations", phone: "(512) 443-7800", department: "Vendor Operations", email: "m.gonzales@gm.com" },
        { name: "Derek Cho", initials: "DC", role: "Payment Processing", phone: "(512) 443-7812", department: "Finance & Billing", email: "d.cho@gm.com" },
      ] },
      { id: "gm-loc-4", name: "GM Financial Charlotte", description: "General Motors Financial, 600 S Tryon St, Charlotte, NC.", isDefault: false, contacts: [
        { name: "Leah Patterson", initials: "LP", role: "Finance Analyst", phone: "(704) 355-9100", department: "Corporate Finance", email: "l.patterson@gm.com" },
      ] },
      { id: "gm-loc-5", name: "GM Financial Phoenix", description: "General Motors Financial, 2800 N Central Ave, Phoenix, AZ.", isDefault: false, contacts: [
        { name: "Ryan Okafor", initials: "RO", role: "Billing Manager", phone: "(602) 271-3300", department: "Southwest Operations", email: "r.okafor@gm.com" },
        { name: "Jenny Lin", initials: "JL", role: "AP Specialist", phone: "(602) 271-3315", department: "Southwest Operations", email: "j.lin@gm.com" },
      ] },
    ],
    contact: { name: "Richard Kowalski", initials: "RK", role: "Accounts Receivable", phone: "(313) 556-5102", department: "Finance & Billing", email: "r.kowalski@gm.com" },
  },
  {
    id: "payto-2",
    name: "Toyota Motor Credit",
    abbr: "TM",
    locations: [
      { id: "ttc-loc-1", name: "Toyota Motor Credit Corp.", description: "Toyota Motor Credit, 6565 Headquarters Dr, Plano, TX.", isDefault: true, contacts: [
        { name: "Kenji Nakamura", initials: "KN", role: "Procurement Lead", phone: "(734) 995-2701", department: "Supply Chain Management", email: "k.nakamura@toyota-tech.com" },
        { name: "Aisha Patel", initials: "AP", role: "Vendor Finance", phone: "(734) 995-2750", department: "Supply Chain Management", email: "a.patel@toyota-tech.com" },
      ] },
      { id: "ttc-loc-2", name: "Toyota Financial Edmonton", description: "Toyota Financial Services, 10235 101 St NW, Edmonton, AB.", isDefault: false, contacts: [
        { name: "Claire Bergeron", initials: "CB", role: "Regional Coordinator", phone: "(780) 422-3300", department: "Canada Operations", email: "c.bergeron@toyota.ca" },
      ] },
      { id: "ttc-loc-3", name: "Toyota Financial Los Angeles", description: "Toyota Motor Credit, 19001 S Western Ave, Torrance, CA.", isDefault: false, contacts: [
        { name: "David Reyes", initials: "DR", role: "West Coast Finance Lead", phone: "(310) 468-5100", department: "Pacific Division", email: "d.reyes@toyota.com" },
        { name: "Susan Park", initials: "SP", role: "AP Analyst", phone: "(310) 468-5120", department: "Pacific Division", email: "s.park@toyota.com" },
      ] },
      { id: "ttc-loc-4", name: "Toyota Financial Chicago", description: "Toyota Motor Credit, 150 N Michigan Ave, Chicago, IL.", isDefault: false, contacts: [
        { name: "Marcus Jennings", initials: "MJ", role: "Midwest Finance Mgr", phone: "(312) 555-8900", department: "Central Division", email: "m.jennings@toyota.com" },
      ] },
      { id: "ttc-loc-5", name: "Toyota Financial Miami", description: "Toyota Motor Credit, 1200 Brickell Ave, Miami, FL.", isDefault: false, contacts: [
        { name: "Isabella Torres", initials: "IT", role: "Southeast Coordinator", phone: "(305) 374-2200", department: "Southeast Division", email: "i.torres@toyota.com" },
      ] },
      { id: "ttc-loc-6", name: "Toyota Financial Seattle", description: "Toyota Motor Credit, 3400 Westlake Ave N, Seattle, WA.", isDefault: false, contacts: [
        { name: "Alex Whitfield", initials: "AW", role: "NW Regional Lead", phone: "(206) 555-3700", department: "Northwest Division", email: "a.whitfield@toyota.com" },
      ] },
    ],
    contact: { name: "Kenji Nakamura", initials: "KN", role: "Procurement Lead", phone: "(734) 995-2701", department: "Supply Chain Management", email: "k.nakamura@toyota-tech.com" },
  },
  {
    id: "payto-3",
    name: "Ford Motor Credit",
    abbr: "FM",
    locations: [
      { id: "ford-loc-1", name: "Ford Motors Express", description: "Ford Motor Credit, 1234 Innovation Drive, Torrance, CA.", isDefault: true, contacts: [
        { name: "Braelyn Lowe", initials: "BL", role: "Administrative Support", phone: "(390) 412-9029", department: "Supply Chain Management", email: "b.lowe@ford.com" },
      ] },
      { id: "ford-loc-2", name: "Ford Credit Dearborn", description: "Ford Motor Credit, One American Rd, Dearborn, MI.", isDefault: false, contacts: [
        { name: "Patrick Sullivan", initials: "PS", role: "HQ Finance Director", phone: "(313) 322-4000", department: "Corporate Finance", email: "p.sullivan@ford.com" },
        { name: "Nina Kapoor", initials: "NK", role: "Vendor Payments Lead", phone: "(313) 322-4025", department: "Corporate Finance", email: "n.kapoor@ford.com" },
      ] },
      { id: "ford-loc-3", name: "Ford Credit Dallas", description: "Ford Motor Credit, 5600 Ross Ave, Dallas, TX.", isDefault: false, contacts: [
        { name: "Robert Garcia", initials: "RG", role: "SW Regional Lead", phone: "(214) 855-6000", department: "Southwest Operations", email: "r.garcia@ford.com" },
      ] },
      { id: "ford-loc-4", name: "Ford Credit Atlanta", description: "Ford Motor Credit, 3300 Peachtree Rd NE, Atlanta, GA.", isDefault: false, contacts: [
        { name: "Tanya Williams", initials: "TW", role: "SE Finance Coordinator", phone: "(404) 733-2100", department: "Southeast Division", email: "t.williams@ford.com" },
      ] },
    ],
    contact: { name: "Braelyn Lowe", initials: "BL", role: "Administrative and Support", phone: "(390) 412-9029", department: "Supply Chain Manageme...", email: "braelyn@toyota.technical" },
  },
  {
    id: "payto-4",
    name: "Tesla Financial Services",
    abbr: "TS",
    locations: [
      { id: "tesla-loc-1", name: "Tesla Financial HQ", description: "Tesla Financial Services, 3500 Deer Creek Rd, Palo Alto, CA.", isDefault: true },
    ],
    contact: { name: "Jason Wu", initials: "JW", role: "Procurement Specialist", phone: "(650) 681-5140", department: "Vendor Operations", email: "j.wu@tesla.com" },
  },
  {
    id: "payto-5",
    name: "Stellantis Financial",
    abbr: "SF",
    locations: [
      { id: "stell-loc-1", name: "Stellantis Financial HQ", description: "Stellantis Financial, 999 Chrysler Dr, Auburn Hills, MI.", isDefault: true },
      { id: "stell-loc-2", name: "Stellantis West Coast", description: "Stellantis Financial, 2200 Pacific Ave, Long Beach, CA.", isDefault: false },
    ],
    contact: { name: "Angela Ricci", initials: "AR", role: "Supply Chain Manager", phone: "(248) 576-5810", department: "Purchasing & Finance", email: "a.ricci@stellantis.com" },
  },
  {
    id: "payto-6",
    name: "Honda Financial Services",
    abbr: "HF",
    locations: [
      { id: "honda-loc-1", name: "Honda Financial HQ", description: "Honda Financial Services, 1919 Torrance Blvd, Torrance, CA.", isDefault: true },
    ],
    contact: { name: "Takeshi Honda", initials: "TH", role: "Vendor Account Lead", phone: "(310) 783-2105", department: "Parts Procurement", email: "t.honda@honda.com" },
  },
  {
    id: "payto-7",
    name: "Nissan Motor Acceptance",
    abbr: "NM",
    locations: [
      { id: "nissan-loc-1", name: "Nissan Acceptance HQ", description: "Nissan Motor Acceptance, One Nissan Way, Franklin, TN.", isDefault: true },
      { id: "nissan-loc-2", name: "Nissan West Regional", description: "Nissan Motor Acceptance, 4800 S Eastern Ave, Commerce, CA.", isDefault: false },
      { id: "nissan-loc-3", name: "Nissan Highland Express", description: "Nissan Motors, situated at 5678 Progress Avenue, Carson City, NV.", isDefault: false },
    ],
    contact: { name: "Bree Lowe", initials: "BL", role: "Administrative Support Services", phone: "(555) 123-4567", department: "Logistics Management", email: "bree.lowe@toyota.com" },
  },
  {
    id: "payto-8",
    name: "BMW Financial Services",
    abbr: "BM",
    locations: [
      { id: "bmw-loc-1", name: "BMW Financial HQ", description: "BMW Financial Services, 300 Chestnut Ridge Rd, Woodcliff Lake, NJ.", isDefault: true },
    ],
    contact: { name: "Stefan Bauer", initials: "SB", role: "Procurement Manager", phone: "(201) 307-4110", department: "Vendor Relations", email: "s.bauer@bmwna.com" },
  },
  {
    id: "payto-9",
    name: "Rivian Capital",
    abbr: "RC",
    locations: [
      { id: "rivian-loc-1", name: "Rivian Capital HQ", description: "Rivian Capital, 14600 Myford Rd, Irvine, CA.", isDefault: true },
    ],
    contact: { name: "Omar Jenkins", initials: "OJ", role: "Supply Chain Lead", phone: "(888) 748-4305", department: "Finance & Accounts", email: "o.jenkins@rivian.com" },
  },
  {
    id: "payto-10",
    name: "Lucid Financial",
    abbr: "LF",
    locations: [
      { id: "lucid-loc-1", name: "Lucid Financial HQ", description: "Lucid Financial, 7373 Gateway Blvd, Newark, CA.", isDefault: true },
      { id: "lucid-loc-2", name: "Lucid Financial Southeast", description: "Lucid Financial, 1500 Peachtree St NW, Atlanta, GA.", isDefault: false },
    ],
    contact: { name: "Nathan Reeves", initials: "NR", role: "Vendor Ops Manager", phone: "(510) 648-3601", department: "Accounts Receivable", email: "n.reeves@lucidmotors.com" },
  },
  {
    id: "payto-11",
    name: "Hyundai Capital America",
    abbr: "HC",
    locations: [
      { id: "hyundai-loc-1", name: "Hyundai Capital HQ", description: "Hyundai Capital America, 3161 Michelson Dr, Irvine, CA.", isDefault: true },
    ],
    contact: { name: "Min-Jun Park", initials: "MP", role: "Accounts Payable Lead", phone: "(949) 468-4800", department: "Finance Operations", email: "m.park@hca.com" },
  },
  {
    id: "payto-12",
    name: "Volvo Financial Services",
    abbr: "VF",
    locations: [
      { id: "volvo-loc-1", name: "Volvo Financial HQ", description: "Volvo Financial Services, 7025 Albert Pick Rd, Greensboro, NC.", isDefault: true },
      { id: "volvo-loc-2", name: "Volvo Financial West", description: "Volvo Financial Services, 1600 Harbor Bay Pkwy, Alameda, CA.", isDefault: false },
    ],
    contact: { name: "Erik Lindgren", initials: "EL", role: "Treasury Manager", phone: "(336) 393-2400", department: "Corporate Treasury", email: "e.lindgren@volvo.com" },
  },
  {
    id: "payto-13",
    name: "Mazda Motor Credit",
    abbr: "MM",
    locations: [
      { id: "mazda-loc-1", name: "Mazda Credit HQ", description: "Mazda Motor Credit, 200 Spectrum Center Dr, Irvine, CA.", isDefault: true },
    ],
    contact: { name: "Yuki Tanaka", initials: "YT", role: "Credit Operations Lead", phone: "(949) 727-1990", department: "Dealer Financial Services", email: "y.tanaka@mazdausa.com" },
  },
  {
    id: "payto-14",
    name: "Subaru Financial Services",
    abbr: "SU",
    locations: [
      { id: "subaru-loc-1", name: "Subaru Financial HQ", description: "Subaru Financial Services, 1 Subaru Dr, Camden, NJ.", isDefault: true },
    ],
    contact: { name: "David Nakamura", initials: "DN", role: "Vendor Finance Mgr", phone: "(856) 488-8500", department: "Purchasing & Accounts", email: "d.nakamura@subaru.com" },
  },
  {
    id: "payto-15",
    name: "Peugeot Financial Corp.",
    abbr: "PF",
    locations: [
      { id: "peugeot-loc-1", name: "Peugeot Financial US", description: "Peugeot Financial Corp., 600 Renaissance Ctr, Detroit, MI.", isDefault: true },
      { id: "peugeot-loc-2", name: "Peugeot Financial Canada", description: "Peugeot Financial Corp., 2150 Islington Ave, Toronto, ON.", isDefault: false },
    ],
    contact: { name: "Claire Dubois", initials: "CD", role: "International Finance Dir", phone: "(313) 872-4000", department: "Global Finance", email: "c.dubois@peugeot.com" },
  },
];

/** Shipped To vendors — destination warehouses/locations */
export const SHIPPED_TO_VENDORS: VendorEntity[] = [
  {
    id: "shipto-1",
    name: "Omne Warehouse Network",
    abbr: "OW",
    locations: [
      { id: "wh-a", name: "Warehouse A - Central", description: "Omne Manufacturing, 4500 Industrial Pkwy, Pasadena, OK.", isDefault: true, contacts: [
        { name: "Diana Park", initials: "DP", role: "Warehouse Coordinator", phone: "(312) 555-0164", department: "Inbound Logistics", email: "d.park@omne-erp.com" },
        { name: "Samuel Torres", initials: "ST", role: "Receiving Lead", phone: "(312) 555-0170", department: "Inbound Logistics", email: "s.torres@omne-erp.com" },
      ] },
      { id: "wh-b", name: "Warehouse B - East", description: "Omne Distribution, 1200 Commerce Dr, Great Falls, MD.", isDefault: false, contacts: [
        { name: "Mike Brennan", initials: "MB", role: "East Ops Manager", phone: "(301) 555-4200", department: "Distribution Ops", email: "m.brennan@omne-erp.com" },
      ] },
      { id: "wh-c", name: "Warehouse C - Midwest", description: "Omne Logistics, 800 Lakeshore Blvd, Lansing, IL.", isDefault: false, contacts: [
        { name: "Priya Sharma", initials: "PS", role: "Midwest Logistics Lead", phone: "(517) 555-3100", department: "Regional Logistics", email: "p.sharma@omne-erp.com" },
        { name: "Kevin O'Brien", initials: "KO", role: "Inventory Specialist", phone: "(517) 555-3115", department: "Regional Logistics", email: "k.obrien@omne-erp.com" },
      ] },
      { id: "wh-d", name: "Warehouse D - South", description: "Omne Warehousing, 3200 Gulf Fwy, Houston, TX.", isDefault: false, contacts: [
        { name: "Carlos Vega", initials: "CV", role: "South Region Lead", phone: "(713) 555-8800", department: "Southern Operations", email: "c.vega@omne-erp.com" },
      ] },
      { id: "wh-e", name: "Warehouse E - West Coast", description: "Omne Distribution West, 1600 Harbor Blvd, Long Beach, CA.", isDefault: false, contacts: [
        { name: "Lisa Tran", initials: "LT", role: "West Coast Coordinator", phone: "(562) 555-6100", department: "Pacific Operations", email: "l.tran@omne-erp.com" },
      ] },
      { id: "wh-f", name: "Warehouse F - Pacific NW", description: "Omne Logistics NW, 2400 Elliott Ave, Seattle, WA.", isDefault: false, contacts: [
        { name: "Nathan Hughes", initials: "NH", role: "NW Facility Manager", phone: "(206) 555-2400", department: "Northwest Operations", email: "n.hughes@omne-erp.com" },
      ] },
      { id: "wh-g", name: "Warehouse G - Northeast", description: "Omne Distribution NE, 500 Harbor Dr, Newark, NJ.", isDefault: false, contacts: [
        { name: "Rachel Kim", initials: "RK", role: "NE Receiving Lead", phone: "(973) 555-5000", department: "Northeast Operations", email: "r.kim@omne-erp.com" },
        { name: "James Doyle", initials: "JD", role: "Quality Inspector", phone: "(973) 555-5015", department: "Northeast Operations", email: "j.doyle@omne-erp.com" },
      ] },
    ],
    contact: { name: "Diana Park", initials: "DP", role: "Warehouse Coordinator", phone: "(312) 555-0164", department: "Inbound Logistics", email: "d.park@omne-erp.com" },
  },
  {
    id: "shipto-2",
    name: "Pacific Distribution Hub",
    abbr: "PD",
    locations: [
      { id: "pac-1", name: "Pacific Hub - Lafayette", description: "Pacific Distribution, 2100 Valley View Rd, Lafayette, CA.", isDefault: true },
    ],
    contact: { name: "Marcus Rivera", initials: "MR", role: "Distribution Manager", phone: "(405) 555-0198", department: "Supply Chain Ops", email: "m.rivera@omne-erp.com" },
  },
  {
    id: "shipto-3",
    name: "Northeast Fulfillment",
    abbr: "NF",
    locations: [
      { id: "ne-1", name: "NE Fulfillment - Stockton", description: "Northeast Fulfillment, 350 Elm St, Stockton, NH.", isDefault: true },
      { id: "ne-2", name: "NE Fulfillment - Portland", description: "Northeast Fulfillment, 900 River Rd, Portland, IL.", isDefault: false },
    ],
    contact: { name: "Sarah Chen", initials: "SC", role: "Procurement Manager", phone: "(405) 555-0121", department: "Receiving & QC", email: "sarah.chen@omne-erp.com" },
  },
  {
    id: "shipto-4",
    name: "Great Lakes Depot",
    abbr: "GL",
    locations: [
      { id: "gl-1", name: "Great Lakes Primary", description: "Great Lakes Depot, 7700 Lakefront Ave, Lansing, IL.", isDefault: true },
    ],
    contact: { name: "James Thompson", initials: "JT", role: "Operations Director", phone: "(301) 555-0187", department: "Warehouse Operations", email: "j.thompson@omne-erp.com" },
  },
  {
    id: "shipto-5",
    name: "Southern Cross Logistics",
    abbr: "SC",
    locations: [
      { id: "sc-1", name: "Southern Cross HQ", description: "Southern Cross Logistics, 4400 Industrial Blvd, Dallas, TX.", isDefault: true },
      { id: "sc-2", name: "Southern Cross Annex", description: "Southern Cross Logistics, 2100 Port Rd, Houston, TX.", isDefault: false },
    ],
    contact: { name: "Carlos Mendez", initials: "CM", role: "Logistics Coordinator", phone: "(214) 555-0133", department: "Transportation & Freight", email: "c.mendez@sclogistics.com" },
  },
  {
    id: "shipto-6",
    name: "Rocky Mountain Storage",
    abbr: "RM",
    locations: [
      { id: "rm-1", name: "RM Storage Denver", description: "Rocky Mountain Storage, 1800 Pikes Peak Rd, Denver, CO.", isDefault: true },
    ],
    contact: { name: "Elena Brooks", initials: "EB", role: "Facility Manager", phone: "(303) 555-0177", department: "Inventory Management", email: "e.brooks@rmstorage.com" },
  },
  {
    id: "shipto-7",
    name: "Atlantic Port Warehouse",
    abbr: "AP",
    locations: [
      { id: "ap-1", name: "Atlantic Port Main", description: "Atlantic Port Warehouse, 500 Harbor Dr, Baltimore, MD.", isDefault: true },
      { id: "ap-2", name: "Atlantic Port Overflow", description: "Atlantic Port Warehouse, 750 Dock St, Newark, NJ.", isDefault: false },
      { id: "ap-3", name: "Atlantic Port Edmonton", description: "Atlantic Port Warehouse, 11250 170 St NW, Edmonton, AB.", isDefault: false },
    ],
    contact: { name: "Robert Kim", initials: "RK", role: "Port Operations Lead", phone: "(410) 555-0199", department: "Import/Export Handling", email: "r.kim@atlanticport.com" },
  },
  {
    id: "shipto-8",
    name: "Midwest Assembly Plant",
    abbr: "MA",
    locations: [
      { id: "ma-1", name: "Midwest Assembly HQ", description: "Midwest Assembly Plant, 3300 Factory Lane, Detroit, MI.", isDefault: true },
    ],
    contact: { name: "Patricia Wong", initials: "PW", role: "Plant Receiving Lead", phone: "(313) 555-0211", department: "Manufacturing Logistics", email: "p.wong@midwestassembly.com" },
  },
  {
    id: "shipto-9",
    name: "West Coast Terminal",
    abbr: "WC",
    locations: [
      { id: "wc-1", name: "West Coast Terminal - LA", description: "West Coast Terminal, 2800 Long Beach Blvd, Long Beach, CA.", isDefault: true },
    ],
    contact: { name: "Andrew Patel", initials: "AP", role: "Terminal Manager", phone: "(562) 555-0244", department: "Container Operations", email: "a.patel@wcterminal.com" },
  },
  {
    id: "shipto-10",
    name: "Sunbelt Receiving Center",
    abbr: "SR",
    locations: [
      { id: "sr-1", name: "Sunbelt Receiving - Phoenix", description: "Sunbelt Receiving, 6600 Camelback Rd, Phoenix, AZ.", isDefault: true },
      { id: "sr-2", name: "Sunbelt Receiving - Tampa", description: "Sunbelt Receiving, 4200 Bay Area Blvd, Tampa, FL.", isDefault: false },
    ],
    contact: { name: "Lisa Hernandez", initials: "LH", role: "Receiving Supervisor", phone: "(602) 555-0288", department: "Quality Assurance", email: "l.hernandez@sunbeltrc.com" },
  },
  {
    id: "shipto-11",
    name: "Texas Freight Terminal",
    abbr: "TF",
    locations: [
      { id: "tf-1", name: "Texas Freight Main", description: "Texas Freight Terminal, 9200 Cargo Rd, San Antonio, TX.", isDefault: true },
      { id: "tf-2", name: "Texas Freight Annex", description: "Texas Freight Terminal, 4100 Airport Blvd, Austin, TX.", isDefault: false },
    ],
    contact: { name: "Roberto Garza", initials: "RG", role: "Terminal Operations Mgr", phone: "(210) 555-0311", department: "Freight Ops", email: "r.garza@texasfreight.com" },
  },
  {
    id: "shipto-12",
    name: "Northern Plains Depot",
    abbr: "NP",
    locations: [
      { id: "np-1", name: "Northern Plains Main", description: "Northern Plains Depot, 1100 Prairie Ave, Fargo, ND.", isDefault: true },
    ],
    contact: { name: "Karen Olsen", initials: "KO", role: "Depot Coordinator", phone: "(701) 555-0344", department: "Inventory Control", email: "k.olsen@nplains.com" },
  },
  {
    id: "shipto-13",
    name: "Cascade Logistics Center",
    abbr: "CL",
    locations: [
      { id: "cl-1", name: "Cascade LC - Seattle", description: "Cascade Logistics Center, 2800 Harbor Island, Seattle, WA.", isDefault: true },
      { id: "cl-2", name: "Cascade LC - Portland", description: "Cascade Logistics Center, 700 Swan Island Rd, Portland, OR.", isDefault: false },
    ],
    contact: { name: "Jennifer Wu", initials: "JW", role: "Regional Logistics Lead", phone: "(206) 555-0377", department: "West Coast Distribution", email: "j.wu@cascadelc.com" },
  },
  {
    id: "shipto-14",
    name: "Gulf Coast Warehouse",
    abbr: "GC",
    locations: [
      { id: "gc-1", name: "Gulf Coast Primary", description: "Gulf Coast Warehouse, 5500 Port Rd, New Orleans, LA.", isDefault: true },
    ],
    contact: { name: "Antoine Boudreaux", initials: "AB", role: "Warehouse Director", phone: "(504) 555-0399", department: "Southern Operations", email: "a.boudreaux@gcwarehouse.com" },
  },
  {
    id: "shipto-15",
    name: "Mountain View Storage",
    abbr: "MV",
    locations: [
      { id: "mv-1", name: "Mountain View HQ", description: "Mountain View Storage, 3200 Peak Blvd, Salt Lake City, UT.", isDefault: true },
      { id: "mv-2", name: "Mountain View Annex", description: "Mountain View Storage, 1800 Foothill Dr, Boise, ID.", isDefault: false },
      { id: "mv-3", name: "Mountain View South", description: "Mountain View Storage, 4500 Mesa Rd, Albuquerque, NM.", isDefault: false },
    ],
    contact: { name: "Ryan Mitchell", initials: "RM", role: "Facility Operations Lead", phone: "(801) 555-0422", department: "Regional Warehousing", email: "r.mitchell@mvstorage.com" },
  },
];

/** Funded By entities — internal organizations/divisions */
export const FUNDED_BY_VENDORS: VendorEntity[] = [
  {
    id: "fund-1",
    name: "Omne Manufacturing Corp.",
    abbr: "OM",
    locations: [
      { id: "omne-1", name: "Omne Manufacturing HQ", description: "Omne Manufacturing Corp., 1000 Enterprise Way, Pasadena, OK.", isDefault: true },
    ],
    contact: { name: "Sarah Chen", initials: "SC", role: "Procurement Manager", phone: "(405) 555-0121", department: "Corporate Finance", email: "sarah.chen@omne-erp.com" },
  },
  {
    id: "fund-2",
    name: "Omne Automotive Division",
    abbr: "OA",
    locations: [
      { id: "oauto-1", name: "Automotive Division HQ", description: "Omne Automotive Division, 2500 Motor Way, Detroit, MI.", isDefault: true },
      { id: "oauto-2", name: "Automotive Division West", description: "Omne Automotive Division, 1800 Pacific Coast Hwy, Torrance, CA.", isDefault: false },
    ],
    contact: { name: "James Thompson", initials: "JT", role: "Operations Director", phone: "(301) 555-0187", department: "Division Finance", email: "j.thompson@omne-erp.com" },
  },
  {
    id: "fund-3",
    name: "Omne Industrial Group",
    abbr: "OI",
    locations: [
      { id: "oind-1", name: "Industrial Group HQ", description: "Omne Industrial Group, 3200 Factory Blvd, Lansing, IL.", isDefault: true },
    ],
    contact: { name: "Marcus Rivera", initials: "MR", role: "Supply Chain Lead", phone: "(405) 555-0198", department: "Industrial Procurement", email: "m.rivera@omne-erp.com" },
  },
  {
    id: "fund-4",
    name: "Omne Precision Engineering",
    abbr: "OP",
    locations: [
      { id: "opre-1", name: "Precision Engineering HQ", description: "Omne Precision Engineering, 700 Tech Park Dr, Lafayette, CA.", isDefault: true },
    ],
    contact: { name: "Diana Park", initials: "DP", role: "Warehouse Coordinator", phone: "(312) 555-0164", department: "R&D Finance", email: "d.park@omne-erp.com" },
  },
  {
    id: "fund-5",
    name: "Omne Fleet Services",
    abbr: "OF",
    locations: [
      { id: "oflt-1", name: "Fleet Services Main", description: "Omne Fleet Services, 5500 Fleet Dr, Stockton, NH.", isDefault: true },
      { id: "oflt-2", name: "Fleet Services South", description: "Omne Fleet Services, 4100 Transport Ave, Dallas, TX.", isDefault: false },
    ],
    contact: { name: "Kevin O'Brien", initials: "KO", role: "Fleet Finance Manager", phone: "(603) 555-0155", department: "Fleet Operations", email: "k.obrien@omne-erp.com" },
  },
  {
    id: "fund-6",
    name: "Omne Energy Systems",
    abbr: "OE",
    locations: [
      { id: "oen-1", name: "Energy Systems HQ", description: "Omne Energy Systems, 9100 Solar Blvd, Phoenix, AZ.", isDefault: true },
    ],
    contact: { name: "Rachel Torres", initials: "RT", role: "Energy Division CFO", phone: "(480) 555-0199", department: "Energy Finance", email: "r.torres@omne-erp.com" },
  },
  {
    id: "fund-7",
    name: "Omne Advanced Materials",
    abbr: "AM",
    locations: [
      { id: "oam-1", name: "Advanced Materials Lab", description: "Omne Advanced Materials, 1400 Research Pkwy, Portland, IL.", isDefault: true },
      { id: "oam-2", name: "Advanced Materials Plant", description: "Omne Advanced Materials, 2800 Chemical Rd, Houston, TX.", isDefault: false },
      { id: "oam-3", name: "Advanced Materials North", description: "Omne Advanced Materials, 6700 Industrial Park, Edmonton, AB.", isDefault: false },
    ],
    contact: { name: "Dr. Alan Fischer", initials: "AF", role: "Materials Division Head", phone: "(217) 555-0233", department: "Materials Science Finance", email: "a.fischer@omne-erp.com" },
  },
  {
    id: "fund-8",
    name: "Omne Logistics Corp.",
    abbr: "OL",
    locations: [
      { id: "olog-1", name: "Logistics Corp. HQ", description: "Omne Logistics Corp., 6000 Supply Chain Way, Great Falls, MD.", isDefault: true },
    ],
    contact: { name: "Samantha Blake", initials: "SB", role: "Logistics Finance Lead", phone: "(301) 555-0222", department: "Supply Chain Finance", email: "s.blake@omne-erp.com" },
  },
  {
    id: "fund-9",
    name: "Omne Defense & Aerospace",
    abbr: "OD",
    locations: [
      { id: "oda-1", name: "Defense & Aerospace HQ", description: "Omne Defense & Aerospace, 8800 Aerospace Blvd, Wichita, KS.", isDefault: true },
    ],
    contact: { name: "Col. Michael Grant", initials: "MG", role: "Defense Programs CFO", phone: "(316) 555-0277", department: "Defense Finance", email: "m.grant@omne-erp.com" },
  },
  {
    id: "fund-10",
    name: "Omne Global Ventures",
    abbr: "OG",
    locations: [
      { id: "ogv-1", name: "Global Ventures NY", description: "Omne Global Ventures, 350 Park Ave, New York, NY.", isDefault: true },
      { id: "ogv-2", name: "Global Ventures London", description: "Omne Global Ventures, 25 Cabot Square, London, UK.", isDefault: false },
    ],
    contact: { name: "Victoria Ashworth", initials: "VA", role: "Global Finance Director", phone: "(212) 555-0300", department: "International Finance", email: "v.ashworth@omne-erp.com" },
  },
  {
    id: "fund-11",
    name: "Omne Smart Mobility",
    abbr: "SM",
    locations: [
      { id: "osm-1", name: "Smart Mobility HQ", description: "Omne Smart Mobility, 4200 Innovation Ct, San Jose, CA.", isDefault: true },
    ],
    contact: { name: "Priya Sharma", initials: "PS", role: "Mobility Division CFO", phone: "(408) 555-0333", department: "Smart Mobility Finance", email: "p.sharma@omne-erp.com" },
  },
  {
    id: "fund-12",
    name: "Omne Sustainability Fund",
    abbr: "OS",
    locations: [
      { id: "osf-1", name: "Sustainability Fund HQ", description: "Omne Sustainability Fund, 1000 Green Way, Portland, OR.", isDefault: true },
      { id: "osf-2", name: "Sustainability Fund East", description: "Omne Sustainability Fund, 500 Eco Blvd, Boston, MA.", isDefault: false },
    ],
    contact: { name: "Emily Chen", initials: "EC", role: "ESG Finance Director", phone: "(503) 555-0366", department: "Sustainability Finance", email: "e.chen@omne-erp.com" },
  },
  {
    id: "fund-13",
    name: "Omne Digital Solutions",
    abbr: "DS",
    locations: [
      { id: "ods-1", name: "Digital Solutions HQ", description: "Omne Digital Solutions, 800 Tech Park Dr, Austin, TX.", isDefault: true },
    ],
    contact: { name: "Alex Rodriguez", initials: "AR", role: "Digital Ops Finance Lead", phone: "(512) 555-0388", department: "Digital Division Budget", email: "a.rodriguez@omne-erp.com" },
  },
  {
    id: "fund-14",
    name: "Omne Capital Partners",
    abbr: "CP",
    locations: [
      { id: "ocp-1", name: "Capital Partners NY", description: "Omne Capital Partners, 200 Park Ave, New York, NY.", isDefault: true },
      { id: "ocp-2", name: "Capital Partners Chicago", description: "Omne Capital Partners, 333 W Wacker Dr, Chicago, IL.", isDefault: false },
    ],
    contact: { name: "Margaret O'Sullivan", initials: "MO", role: "Managing Partner", phone: "(212) 555-0411", department: "Investment & Capital", email: "m.osullivan@omne-erp.com" },
  },
  {
    id: "fund-15",
    name: "Omne Heritage Division",
    abbr: "OH",
    locations: [
      { id: "ohd-1", name: "Heritage Division HQ", description: "Omne Heritage Division, 1200 Classic Motor Way, Dearborn, MI.", isDefault: true },
    ],
    contact: { name: "Thomas Wright", initials: "TW", role: "Heritage Finance Manager", phone: "(313) 555-0444", department: "Classic Programs Finance", email: "t.wright@omne-erp.com" },
  },
];

/** Look up a vendor entity by name across all vendor lists */
export function findVendorEntity(name: string, list: VendorEntity[]): VendorEntity | undefined {
  return list.find((v) => v.name === name);
}

/** Get the default location for a vendor entity */
export function getDefaultLocation(vendor: VendorEntity): VendorLocationInfo {
  return vendor.locations.find((l) => l.isDefault) || vendor.locations[0];
}

/* ═══════════════════════════════════════════════════════════════
   ITEM–VENDOR OFFERS — Multiple vendors can supply the same item
   Each offer has a different price, priority, location & contact
   ═══════════════════════════════════════════════════════════════ */

export interface VendorOfferLocation {
  name: string;
  address: string;
  isDefault: boolean;
}

export interface VendorOfferContact {
  name: string;
  initials: string;
  role: string;
  phone: string;
  department: string;
  email: string;
}

/**
 * Multi-unit pricing — a single vendor-item relationship can carry
 * several (unit, price) tiers (e.g. Piece $50, Box $280, Carton $1200).
 * `isDefault` flags the tier shown by default in dropdowns / detail views.
 * `conversionFactor` describes how many base units are in this UOM
 * (e.g. a Box of 6 Pieces has conversionFactor 6).
 *
 * A price of 0 (or null/undefined) is VALID throughout the system —
 * never block, validate, or warn against zero-priced tiers.
 */
export interface VendorUnitPrice {
  unit: string;
  price: number;
  isDefault: boolean;
  conversionFactor?: number;
  /** True when this tier was added only for the current PO (via
   *  "Use for this PO only" in the price-diff confirmation) and has
   *  NOT been persisted to the qualified vendor's master price book.
   *  Surfaces as a "PO only" badge on the tier row and on the Vendor
   *  Stocking Unit dropdown so buyers can tell qualified from
   *  ad-hoc tiers. Absent / false = qualified with the vendor. */
  poOnly?: boolean;
  /** Per-unit ordering contract captured when the vendor is qualified
   *  for the item (Partners' "Pricing & ordering rules" card). All
   *  optional — absent means no rule for this unit. */
  orderingRules?: VendorUnitOrderingRules;
}

export interface VendorUnitOrderingRules {
  minOrderQty?: number;
  maxOrderQty?: number;
  multiples?: number;
  acceptedDeviationPct?: number;
  leadTimeDays?: number;
}

export interface ItemVendorOffer {
  vendorName: string;
  abbr: string;
  /** Legacy single-price field — kept for backwards compatibility with snapshots
   *  and components not yet migrated. Mirrors the default tier's price. */
  unitPrice: number;
  priority: string;
  isDefault: boolean;
  /** Legacy UOM fields — mirror the default tier's unit. */
  uom: string;
  uomQty: number;
  defaultUOM: string;
  /** Multi-unit price tiers per (vendor, item) — 1..N entries. */
  unitPrices: VendorUnitPrice[];
  discount: number;
  locations: VendorOfferLocation[];
  contact: VendorOfferContact;
}

/** Get the default tier from an offer (falls back to the first). */
export function getDefaultUnitPrice(offer: ItemVendorOffer): VendorUnitPrice | undefined {
  return offer.unitPrices?.find((p) => p.isDefault) || offer.unitPrices?.[0];
}

/** Find the matching tier for a given unit on a vendor offer. */
export function findUnitPrice(offer: ItemVendorOffer, unit: string): VendorUnitPrice | undefined {
  if (!offer.unitPrices) return undefined;
  const target = unit.trim().toLowerCase();
  return offer.unitPrices.find((p) => p.unit.trim().toLowerCase() === target);
}

/** Vendor offer templates — reusable vendor profiles */
export const VENDOR_PROFILES: Record<string, { abbr: string; locations: VendorOfferLocation[]; contact: VendorOfferContact }> = {
  "General Motors (GM)": {
    abbr: "GM",
    locations: [
      { name: "GM Manufacturing HQ", address: "General Motors, 300 Renaissance Center, Detroit, MI.", isDefault: true },
      { name: "GM Pasadena Plant", address: "General Motors, 4500 Industrial Pkwy, Pasadena, OK.", isDefault: false },
    ],
    contact: { name: "Richard Kowalski", initials: "RK", role: "Vendor Account Manager", phone: "(313) 556-5102", department: "Supply Chain Management", email: "r.kowalski@gm.com" },
  },
  "Toyota Technical Center (TTC)": {
    abbr: "TTC",
    locations: [
      { name: "Toyota Motors Express", address: "Toyota Motors, located at 1234 Innovation Drive, Torrance, CA.", isDefault: true },
      { name: "Toyota Technical Ann Arbor", address: "Toyota Technical Center, 1555 Woodridge Ave, Ann Arbor, MI.", isDefault: false },
    ],
    contact: { name: "Braelyn Lowe", initials: "BL", role: "Administrative and Support", phone: "(390) 412-9029", department: "Supply Chain Manageme...", email: "braelynlowe@toyota.technical.com" },
  },
  "Ford Motor Company": {
    abbr: "FMC",
    locations: [
      { name: "Ford Motors Express", address: "Ford Motors, located at 1234 Innovation Drive, Torrance, CA.", isDefault: true },
    ],
    contact: { name: "Braelyn Lowe", initials: "BL", role: "Administrative and Support", phone: "(390) 412-9029", department: "Supply Chain Manageme...", email: "braelyn@ford.technical.com" },
  },
  "Tesla, Inc.": {
    abbr: "TSL",
    locations: [
      { name: "Tesla Fremont Factory", address: "Tesla, Inc., 45500 Fremont Blvd, Fremont, CA.", isDefault: true },
      { name: "Tesla Gigafactory Nevada", address: "Tesla, Inc., 1 Electric Ave, Sparks, NV.", isDefault: false },
    ],
    contact: { name: "Jason Wu", initials: "JW", role: "Procurement Specialist", phone: "(650) 681-5140", department: "Vendor Operations", email: "j.wu@tesla.com" },
  },
  "Chrysler (Stellantis N.V.)": {
    abbr: "CS",
    locations: [
      { name: "Stellantis Auburn Hills", address: "Chrysler, 999 Chrysler Dr, Auburn Hills, MI.", isDefault: true },
    ],
    contact: { name: "Angela Ricci", initials: "AR", role: "Supply Chain Manager", phone: "(248) 576-5810", department: "Purchasing & Finance", email: "a.ricci@stellantis.com" },
  },
  "Honda Motor Co., Ltd. (USA)": {
    abbr: "HM",
    locations: [
      { name: "Honda Torrance HQ", address: "Honda Motor Co., 1919 Torrance Blvd, Torrance, CA.", isDefault: true },
    ],
    contact: { name: "Takeshi Honda", initials: "TH", role: "Vendor Account Lead", phone: "(310) 783-2105", department: "Parts Procurement", email: "t.honda@honda.com" },
  },
  "Nissan North America": {
    abbr: "NNA",
    locations: [
      { name: "Nissan Franklin HQ", address: "Nissan North America, One Nissan Way, Franklin, TN.", isDefault: true },
      { name: "Nissan Commerce Depot", address: "Nissan North America, 4800 S Eastern Ave, Commerce, CA.", isDefault: false },
    ],
    contact: { name: "Carlos Fernandez", initials: "CF", role: "Vendor Relations Lead", phone: "(615) 725-1112", department: "Logistics Management", email: "c.fernandez@nissan-usa.com" },
  },
  "BMW of North America": {
    abbr: "BMW",
    locations: [
      { name: "BMW Woodcliff Lake HQ", address: "BMW NA, 300 Chestnut Ridge Rd, Woodcliff Lake, NJ.", isDefault: true },
      { name: "BMW Spartanburg Plant", address: "BMW Manufacturing, 1400 Highway 101 S, Greer, SC.", isDefault: false },
      { name: "BMW Ontario Regional Warehouse", address: "BMW NA, 3350 E Airport Dr, Ontario, CA.", isDefault: false },
    ],
    contact: { name: "Stefan Bauer", initials: "SB", role: "Procurement Manager", phone: "(201) 307-4110", department: "Vendor Relations", email: "s.bauer@bmwna.com" },
  },
  "Rivian Automotive": {
    abbr: "RA",
    locations: [
      { name: "Rivian Normal Plant", address: "Rivian Automotive, 100 Rivian Motorway, Normal, IL.", isDefault: true },
    ],
    contact: { name: "Omar Jenkins", initials: "OJ", role: "Supply Chain Lead", phone: "(888) 748-4305", department: "Finance & Accounts", email: "o.jenkins@rivian.com" },
  },
  "Lucid Motors": {
    abbr: "LM",
    locations: [
      { name: "Lucid AMP-1 Factory", address: "Lucid Motors, 7373 Gateway Blvd, Newark, CA.", isDefault: true },
      { name: "Lucid Casa Grande Plant", address: "Lucid Motors, 3400 Lucid Way, Casa Grande, AZ.", isDefault: false },
    ],
    contact: { name: "Nathan Reeves", initials: "NR", role: "Vendor Ops Manager", phone: "(510) 648-3601", department: "Accounts Receivable", email: "n.reeves@lucidmotors.com" },
  },
  "Bosch Rexroth": {
    abbr: "BR",
    locations: [
      { name: "Bosch Rexroth HQ", address: "Bosch Rexroth, 5150 Prairie Stone Pkwy, Hoffman Estates, IL.", isDefault: true },
      { name: "Bosch Rexroth South", address: "Bosch Rexroth, 2200 Industrial Blvd, Charlotte, NC.", isDefault: false },
    ],
    contact: { name: "Hans Weber", initials: "HW", role: "Key Account Manager", phone: "(847) 645-3600", department: "Industrial Automation", email: "h.weber@boschrexroth.com" },
  },
  "Continental AG": {
    abbr: "CON",
    locations: [
      { name: "Continental North America", address: "Continental AG, 1830 MacMillan Park Dr, Fort Mill, SC.", isDefault: true },
    ],
    contact: { name: "Klaus Richter", initials: "KR", role: "OEM Sales Director", phone: "(803) 548-5200", department: "Automotive Division", email: "k.richter@continental.com" },
  },
  "Denso Corporation": {
    abbr: "DNS",
    locations: [
      { name: "Denso International", address: "Denso Corp., 24777 Denso Dr, Southfield, MI.", isDefault: true },
      { name: "Denso Manufacturing TN", address: "Denso Manufacturing, 1720 Robert C Jackson Dr, Maryville, TN.", isDefault: false },
    ],
    contact: { name: "Yuki Tanaka", initials: "YT", role: "Supply Chain Manager", phone: "(248) 350-7500", department: "Thermal Systems", email: "y.tanaka@denso.com" },
  },
  "ZF Friedrichshafen": {
    abbr: "ZF",
    locations: [
      { name: "ZF North America HQ", address: "ZF Group, 12001 Tech Center Dr, Livonia, MI.", isDefault: true },
    ],
    contact: { name: "Martin Scholz", initials: "MS", role: "Procurement Lead", phone: "(734) 855-2600", department: "Driveline Technology", email: "m.scholz@zf.com" },
  },
  "Magna International": {
    abbr: "MNA",
    locations: [
      { name: "Magna Troy Office", address: "Magna International, 750 Tower Dr, Troy, MI.", isDefault: true },
      { name: "Magna Aurora HQ", address: "Magna International, 337 Magna Dr, Aurora, ON.", isDefault: false },
    ],
    contact: { name: "Jennifer Walsh", initials: "JW", role: "Vendor Relations Lead", phone: "(248) 631-5500", department: "Body Exteriors", email: "j.walsh@magna.com" },
  },
  "Aisin Corporation": {
    abbr: "AIS",
    locations: [
      { name: "Aisin World Corp.", address: "Aisin Corporation, 39575 Lewis Dr, Novi, MI.", isDefault: true },
    ],
    contact: { name: "Masato Ito", initials: "MI", role: "Account Executive", phone: "(248) 277-5100", department: "Drivetrain Systems", email: "m.ito@aisin.com" },
  },
  "Schaeffler Group": {
    abbr: "SCH",
    locations: [
      { name: "Schaeffler Americas", address: "Schaeffler Group, 308 Springhill Farm Rd, Fort Mill, SC.", isDefault: true },
    ],
    contact: { name: "Thomas Braun", initials: "TB", role: "Technical Sales Mgr", phone: "(803) 548-8500", department: "Bearing Solutions", email: "t.braun@schaeffler.com" },
  },
  "BorgWarner Inc.": {
    abbr: "BW",
    locations: [
      { name: "BorgWarner HQ", address: "BorgWarner Inc., 3850 Hamlin Rd, Auburn Hills, MI.", isDefault: true },
      { name: "BorgWarner Ithaca", address: "BorgWarner Inc., 800 Warren Rd, Ithaca, NY.", isDefault: false },
    ],
    contact: { name: "David Chen", initials: "DC", role: "Powertrain Sales Dir", phone: "(248) 754-9200", department: "ePropulsion", email: "d.chen@borgwarner.com" },
  },
  "Dana Incorporated": {
    abbr: "DAN",
    locations: [
      { name: "Dana Maumee HQ", address: "Dana Inc., 3939 Technology Dr, Maumee, OH.", isDefault: true },
    ],
    contact: { name: "Patrick O'Brien", initials: "PO", role: "OEM Account Mgr", phone: "(419) 887-3000", department: "Light Vehicle Drive", email: "p.obrien@dana.com" },
  },
  "Valeo SA": {
    abbr: "VAL",
    locations: [
      { name: "Valeo North America", address: "Valeo SA, 43799 S Groesbeck Hwy, Clinton Township, MI.", isDefault: true },
      { name: "Valeo Auburn Hills", address: "Valeo SA, 150 Stephenson Hwy, Troy, MI.", isDefault: false },
    ],
    contact: { name: "Pierre Dumont", initials: "PD", role: "Regional Sales Dir", phone: "(586) 954-6600", department: "Thermal Systems", email: "p.dumont@valeo.com" },
  },
  "Aptiv PLC": {
    abbr: "APT",
    locations: [
      { name: "Aptiv Troy Tech Center", address: "Aptiv PLC, 5725 Delphi Dr, Troy, MI.", isDefault: true },
    ],
    contact: { name: "Sarah Kim", initials: "SK", role: "Connector Sales Mgr", phone: "(248) 813-2000", department: "Signal & Power", email: "s.kim@aptiv.com" },
  },
  "Hyundai Mobis": {
    abbr: "HMB",
    locations: [
      { name: "Hyundai Mobis Georgia", address: "Hyundai Mobis, 3395 Marconi Dr, Alpharetta, GA.", isDefault: true },
    ],
    contact: { name: "Sung Park", initials: "SP", role: "Parts Sales Lead", phone: "(770) 643-3000", department: "Module Division", email: "s.park@mobis.com" },
  },
  "Sensata Technologies": {
    abbr: "SEN",
    locations: [
      { name: "Sensata Attleboro HQ", address: "Sensata Technologies, 529 Pleasant St, Attleboro, MA.", isDefault: true },
    ],
    contact: { name: "Michael Torres", initials: "MT", role: "Sensor Sales Dir", phone: "(508) 236-3800", department: "Performance Sensing", email: "m.torres@sensata.com" },
  },
  "Eaton Corporation": {
    abbr: "ETN",
    locations: [
      { name: "Eaton Cleveland HQ", address: "Eaton Corp., 1000 Eaton Blvd, Cleveland, OH.", isDefault: true },
      { name: "Eaton Galesburg Plant", address: "Eaton Corp., 2500 E Main St, Galesburg, MI.", isDefault: false },
    ],
    contact: { name: "Robert Hayes", initials: "RH", role: "Vehicle Group Sales", phone: "(440) 523-5000", department: "Vehicle Group", email: "r.hayes@eaton.com" },
  },
  "Parker Hannifin": {
    abbr: "PHN",
    locations: [
      { name: "Parker Cleveland HQ", address: "Parker Hannifin, 6035 Parkland Blvd, Cleveland, OH.", isDefault: true },
    ],
    contact: { name: "Linda Foster", initials: "LF", role: "Fluid Connectors Dir", phone: "(216) 896-3000", department: "Engineered Materials", email: "l.foster@parker.com" },
  },
  "Cummins Inc.": {
    abbr: "CMI",
    locations: [
      { name: "Cummins Columbus HQ", address: "Cummins Inc., 500 Jackson St, Columbus, IN.", isDefault: true },
    ],
    contact: { name: "James Wright", initials: "JW", role: "Aftermarket Sales Mgr", phone: "(812) 377-5000", department: "Distribution", email: "j.wright@cummins.com" },
  },
  "Timken Company": {
    abbr: "TKR",
    locations: [
      { name: "Timken Canton HQ", address: "Timken Company, 4500 Mt Pleasant St NW, North Canton, OH.", isDefault: true },
    ],
    contact: { name: "Mark Stevens", initials: "MS", role: "Bearing Solutions Mgr", phone: "(234) 262-3000", department: "Engineered Bearings", email: "m.stevens@timken.com" },
  },
  "SKF Group": {
    abbr: "SKF",
    locations: [
      { name: "SKF USA Lansdale", address: "SKF Group, 890 Forty Foot Rd, Lansdale, PA.", isDefault: true },
      { name: "SKF Gothenburg HQ", address: "SKF Group, Hornsgatan 1, Gothenburg, Sweden.", isDefault: false },
    ],
    contact: { name: "Erik Lindberg", initials: "EL", role: "Industrial Sales Dir", phone: "(267) 436-6000", department: "Industrial Markets", email: "e.lindberg@skf.com" },
  },
  "Flex-N-Gate": {
    abbr: "FNG",
    locations: [
      { name: "Flex-N-Gate Urbana HQ", address: "Flex-N-Gate, 1605 N Main St, Urbana, IL.", isDefault: true },
    ],
    contact: { name: "Ahmed Hassan", initials: "AH", role: "OEM Program Mgr", phone: "(217) 328-0333", department: "Metal Stampings", email: "a.hassan@flexngate.com" },
  },
};

/**
 * Build a realistic 2–4 tier unit-price ladder from a per-piece price.
 * Larger units get a volume discount of ~3–8% per step.
 * Returns tiers in ascending unit-size order. The first tier (smallest unit)
 * is flagged as default unless `defaultUnit` is provided.
 *
 * NOTE: A zero baseline price is preserved — every tier just stays at $0.
 * Zero-dollar tiers are valid throughout the system; we never block them.
 */
export function buildUnitPriceLadder(
  baseUnit: string,
  basePerUnit: number,
  vendorUOM: string,
  vendorUOMQty: number,
  seed: number = 0,
): VendorUnitPrice[] {
  const tiers: VendorUnitPrice[] = [];
  // Always include the per-piece tier as the baseline
  const seenUnits = new Set<string>();
  const norm = (u: string) => u.trim().toLowerCase();

  const pushTier = (unit: string, conversionFactor: number, isDefault: boolean) => {
    if (seenUnits.has(norm(unit))) return;
    seenUnits.add(norm(unit));
    // Volume discount: 4–8% per step, deterministic from seed
    const discountPct = conversionFactor > 1 ? (0.04 + ((seed + conversionFactor) % 5) / 100) : 0;
    const pricePerBase = basePerUnit * (1 - discountPct);
    const price = basePerUnit > 0 ? Math.round(pricePerBase * conversionFactor * 100) / 100 : 0;
    tiers.push({ unit, price, isDefault, conversionFactor });
  };

  pushTier(baseUnit || "Each", 1, vendorUOMQty <= 1);

  // Add vendor UOM tier if it differs from base
  if (vendorUOM && vendorUOMQty > 1) {
    pushTier(vendorUOM, vendorUOMQty, true); // vendor UOM is default when qty > 1
  }

  // Add 1–2 additional ladder tiers
  const ladderCandidates: Array<{ unit: string; factor: number }> = [
    { unit: "Box", factor: 6 },
    { unit: "Case", factor: 12 },
    { unit: "Carton", factor: 24 },
    { unit: "Pallet", factor: 48 },
    { unit: "Pack", factor: 4 },
    { unit: "Kit", factor: 10 },
  ];
  // Pick deterministically based on seed
  const pickCount = 1 + (seed % 2); // 1–2 extra tiers (total 2–4)
  for (let i = 0; i < pickCount; i++) {
    const candidate = ladderCandidates[(seed + i * 3) % ladderCandidates.length];
    pushTier(candidate.unit, candidate.factor, false);
  }

  // Ensure exactly ONE default
  const hasDefault = tiers.some((t) => t.isDefault);
  if (!hasDefault && tiers.length > 0) tiers[0].isDefault = true;
  // De-dupe: keep first-occurrence default flag
  let firstDefaultSeen = false;
  for (const t of tiers) {
    if (t.isDefault) {
      if (firstDefaultSeen) t.isDefault = false;
      else firstDefaultSeen = true;
    }
  }

  return tiers;
}

/**
 * Build multi-vendor offers for each catalog item.
 * The item's current `partnerLocation` becomes the default vendor.
 * Additional vendors are assigned with varying prices and priorities.
 */
function buildItemVendorOffers(): Map<string, ItemVendorOffer[]> {
  const allVendorNames = Object.keys(VENDOR_PROFILES);
  const offerMap = new Map<string, ItemVendorOffer[]>();

  for (const item of CATALOG) {
    if (!item.partnerLocation) continue;

    const offers: ItemVendorOffer[] = [];
    const defaultProfile = VENDOR_PROFILES[item.partnerLocation];
    if (!defaultProfile) continue;

    const itemSeed = item.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const defaultTiers = buildUnitPriceLadder(item.defaultUOM, item.unitPrice, item.vendorUOM, item.vendorUOMQty, itemSeed);
    offers.push({
      vendorName: item.partnerLocation,
      abbr: defaultProfile.abbr,
      unitPrice: item.unitPrice,
      priority: "default",
      isDefault: true,
      uom: item.vendorUOM,
      uomQty: item.vendorUOMQty,
      defaultUOM: item.defaultUOM,
      unitPrices: defaultTiers,
      discount: item.discount,
      locations: defaultProfile.locations,
      contact: defaultProfile.contact,
    });

    const hash = item.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const altVendors = allVendorNames.filter((v) => v !== item.partnerLocation);
    // Scale: base items (cat-1 to cat-12) get many vendors to showcase 20+ vendor dropdown
    const isBaseItem = item.id.startsWith("cat-") && !item.id.startsWith("cat-gen-") && !item.id.startsWith("cat-ua-");
    const numAlts = isBaseItem
      ? Math.min(altVendors.length, 8 + (hash % 14)) // 8–21 alt vendors for base catalog items
      : 2 + (hash % 5); // 2–6 alt vendors for generated items
    const usedNames = new Set<string>();
    let priorityIndex = 2; // starts at 2nd (default is 1st)

    for (let i = 0; i < numAlts && i < altVendors.length; i++) {
      const altIdx = (hash + i * 7) % altVendors.length;
      const altName = altVendors[altIdx];
      if (usedNames.has(altName)) continue;
      usedNames.add(altName);
      const altProfile = VENDOR_PROFILES[altName];
      if (!altProfile) continue;

      const priceMult = 0.85 + ((hash + i * 13) % 35) / 100;
      const altPrice = Math.round(item.unitPrice * priceMult * 100) / 100;
      const altDiscount = (hash + i) % 8 === 0 ? [3, 5, 7][i % 3] : 0;

      const altTiers = buildUnitPriceLadder(item.defaultUOM, altPrice, item.vendorUOM, item.vendorUOMQty, itemSeed + i * 11);
      offers.push({
        vendorName: altName,
        abbr: altProfile.abbr,
        unitPrice: altPrice,
        priority: `${priorityIndex}`,
        isDefault: false,
        uom: item.vendorUOM,
        uomQty: item.vendorUOMQty,
        defaultUOM: item.defaultUOM,
        unitPrices: altTiers,
        discount: altDiscount,
        locations: altProfile.locations,
        contact: altProfile.contact,
      });
      priorityIndex++;
    }

    offerMap.set(item.id, offers);
  }

  return offerMap;
}

/** Pre-built item→vendor offers map */
export const ITEM_VENDOR_OFFERS = buildItemVendorOffers();

/**
 * Build full-system vendor offers for items that have no pre-assigned vendor.
 * These offers intentionally have no preset pricing; price is entered manually
 * during assignment in the OrderFlow modal.
 */
export function getAllSystemVendorOffersForItem(
  item: Pick<CatalogItem, "vendorUOM" | "vendorUOMQty" | "defaultUOM">
): ItemVendorOffer[] {
  const vendorNames = Object.keys(VENDOR_PROFILES);

  return vendorNames.map((vendorName, index) => {
    const profile = VENDOR_PROFILES[vendorName];
    const priority = index === 0 ? "default" : `${index + 1}`;

    // System-wide candidates: empty/zero pricing. The user enters prices during assignment.
    // Still seed an empty default tier so UI components have something to render.
    const seededTiers: VendorUnitPrice[] = [
      { unit: item.defaultUOM || "Each", price: 0, isDefault: true, conversionFactor: 1 },
    ];
    if (item.vendorUOM && item.vendorUOMQty > 1 && item.vendorUOM !== item.defaultUOM) {
      seededTiers.push({ unit: item.vendorUOM, price: 0, isDefault: false, conversionFactor: item.vendorUOMQty });
    }
    return {
      vendorName,
      abbr: profile.abbr,
      unitPrice: 0,
      priority,
      isDefault: priority === "default",
      uom: item.vendorUOM,
      uomQty: item.vendorUOMQty,
      defaultUOM: item.defaultUOM,
      unitPrices: seededTiers,
      discount: 0,
      locations: profile.locations,
      contact: profile.contact,
    };
  });
}

/** Get vendor offers for a specific item */
export function getVendorOffersForItem(itemId: string): ItemVendorOffer[] {
  return ITEM_VENDOR_OFFERS.get(itemId) || [];
}

/**
 * Demo qualification seed (2026-07-28) — vendor-agnostic list of item
 * numbers that should be treated as qualified for ANY picked vendor.
 * The seeded demo PO 395-9900 uses itemNumbers that don't otherwise
 * exist in `CATALOG`, so without this short-circuit the Duplicate flow
 * would flag every line as unfulfillable regardless of vendor choice.
 * Listing the first four here yields a consistent "4 qualified,
 * 2 needing review" demo across any Different-vendor pick.
 *
 * Real product data continues through the offers table below.
 */
const DEMO_ALWAYS_QUALIFIED_ITEMS: Set<string> = new Set([
  "HYD-4420-A1",
  "BRG-7750-C3",
  "ELC-1190-H2",
  "GSK-3305-R1",
]);

/**
 * Global-scope qualify from the Duplicate PO flow's "Qualify Vendor &
 * Use Here" branch — extends the demo qualification set at runtime so
 * subsequent PO duplicates treat this itemNumber as universally
 * fulfillable (mock stand-in for a real item↔vendor association write
 * that would happen in the Partners app). No-op for items already in
 * the set. The "po-only" branch does NOT call this; it merely stamps
 * `qualifiedForVendor` on the specific line.
 */
export function qualifyItemForVendorGlobally(itemNumber: string): void {
  const trimmed = itemNumber.trim();
  if (!trimmed) return;
  DEMO_ALWAYS_QUALIFIED_ITEMS.add(trimmed);
}

/**
 * Vendor↔item fulfillability check used by the Duplicate PO flow. Returns
 * true when the vendor has an offer for the catalog item that matches the
 * given `itemNumber`. When the itemNumber has no matching catalog entry
 * (e.g. legacy demo line items), the vendor is treated as unable to
 * fulfill it — the duplicate flow will then ask the buyer to Remove or
 * Qualify the line.
 *
 * Case-insensitive vendor-name match to survive minor whitespace/casing
 * drift between the PO's stored vendor name and the VENDOR_PROFILES key.
 */
export function isItemFulfillableByVendor(
  itemNumber: string,
  vendorName: string,
): boolean {
  const trimmed = itemNumber.trim();
  if (!trimmed) return false;
  const target = vendorName.trim().toLowerCase();
  if (!target) return false;
  if (DEMO_ALWAYS_QUALIFIED_ITEMS.has(trimmed)) return true;
  const item = CATALOG.find((c) => c.itemNumber === trimmed);
  if (!item) return false;
  const offers = ITEM_VENDOR_OFFERS.get(item.id);
  if (!offers || offers.length === 0) return false;
  return offers.some((o) => o.vendorName.trim().toLowerCase() === target);
}

/** Get the default vendor offer for an item */
export function getDefaultVendorOffer(itemId: string): ItemVendorOffer | undefined {
  const offers = ITEM_VENDOR_OFFERS.get(itemId);
  return offers?.find((o) => o.isDefault) || offers?.[0];
}

/* ═══════════════════════════════════════════════════════════════
   MULTI-UNIT PRICE — mutators on the master ITEM_VENDOR_OFFERS map
   ═══════════════════════════════════════════════════════════════ */

/** Find a tier on a vendor offer for an item. Returns undefined if missing. */
export function getVendorUnitPrice(
  itemId: string,
  vendorName: string,
  unit: string,
): VendorUnitPrice | undefined {
  const offers = ITEM_VENDOR_OFFERS.get(itemId);
  const offer = offers?.find((o) => o.vendorName === vendorName);
  return offer ? findUnitPrice(offer, unit) : undefined;
}

/**
 * Qualify a vendor for an item on the master record — used when the
 * buyer adds a not-yet-qualified vendor from the Items Detail Modal
 * and fills in its selling units. Replaces any existing offer for the
 * same vendor so a re-qualify doesn't duplicate it.
 */
export function qualifyVendorForItem(itemId: string, offer: ItemVendorOffer): void {
  const offers = ITEM_VENDOR_OFFERS.get(itemId) ?? [];
  const next = offers.filter((o) => o.vendorName !== offer.vendorName);
  next.push({ ...offer, unitPrices: offer.unitPrices.map((t) => ({ ...t, poOnly: false })) });
  ITEM_VENDOR_OFFERS.set(itemId, next);
}

/**
 * Upsert a unit-price tier on the master record.
 *  - If the (unit) tier exists, its price is updated.
 *  - If it doesn't exist, a new tier is appended.
 *  - When `markAsDefault` is true, all other tiers' `isDefault` are cleared.
 *
 * Note: $0 is a VALID price. Callers must NOT filter against zero.
 */
export function upsertVendorUnitPrice(
  itemId: string,
  vendorName: string,
  unit: string,
  price: number,
  opts?: { markAsDefault?: boolean; conversionFactor?: number },
): void {
  const offers = ITEM_VENDOR_OFFERS.get(itemId);
  if (!offers) return;
  const offer = offers.find((o) => o.vendorName === vendorName);
  if (!offer) return;
  if (!offer.unitPrices) offer.unitPrices = [];

  const idx = offer.unitPrices.findIndex(
    (p) => p.unit.trim().toLowerCase() === unit.trim().toLowerCase(),
  );
  if (idx >= 0) {
    offer.unitPrices[idx] = {
      ...offer.unitPrices[idx],
      price,
      ...(opts?.conversionFactor !== undefined ? { conversionFactor: opts.conversionFactor } : {}),
    };
  } else {
    offer.unitPrices.push({
      unit,
      price,
      isDefault: false,
      conversionFactor: opts?.conversionFactor,
    });
  }

  if (opts?.markAsDefault) {
    for (const tier of offer.unitPrices) {
      tier.isDefault = tier.unit.trim().toLowerCase() === unit.trim().toLowerCase();
    }
    // Mirror the new default into the legacy fields so existing consumers keep working
    const newDefault = findUnitPrice(offer, unit);
    if (newDefault) {
      offer.unitPrice = newDefault.price;
      offer.uom = newDefault.unit;
      offer.uomQty = newDefault.conversionFactor ?? 1;
      offer.defaultUOM = newDefault.unit;
    }
  }
}

/** Remove a unit-price tier from the master record. */
export function removeVendorUnitPrice(itemId: string, vendorName: string, unit: string): void {
  const offers = ITEM_VENDOR_OFFERS.get(itemId);
  if (!offers) return;
  const offer = offers.find((o) => o.vendorName === vendorName);
  if (!offer?.unitPrices) return;
  const wasDefault = findUnitPrice(offer, unit)?.isDefault === true;
  offer.unitPrices = offer.unitPrices.filter(
    (p) => p.unit.trim().toLowerCase() !== unit.trim().toLowerCase(),
  );
  // If we removed the default, promote the first remaining tier
  if (wasDefault && offer.unitPrices.length > 0) {
    offer.unitPrices[0].isDefault = true;
    offer.unitPrice = offer.unitPrices[0].price;
    offer.uom = offer.unitPrices[0].unit;
    offer.uomQty = offer.unitPrices[0].conversionFactor ?? 1;
    offer.defaultUOM = offer.unitPrices[0].unit;
  }
}