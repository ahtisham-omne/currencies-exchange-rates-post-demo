/* Provenance: your-invoice-mate/src/app/data/inventory-data.ts, your-invoice-mate/src/app/data/location-data.ts, your-invoice-mate/src/app/components/adjust-inventory-modal.tsx
 * sha256 40353c815c9a877c1518c6874f2cd8791977e7bc833dc9690109aec8b40f9354
 * sha256 0554eaac4004b52b2cf372a73fe871328b9ddeaa89bf303c5037404aac12a633
 * sha256 f4c82244f02a7881d4b81f06109d65342f6a387083ae93e3c3ea90d8743ff833
 * Copied into role-zen 2026-09-30. Snapshot of the values the import layer reads. */
/* Snapshot of Physical Inventory's data that the vendored import layer reads
 * (validation.ts, template.ts), taken 2026-09-30:
 *   inventory-data.ts   ALL_UOM_OPTIONS, SERIALIZED_UOM, the item catalog
 *   location-data.ts    locationRows (the fields the layer reads), LOCATION_DESCRIPTIONS
 *   adjust-inventory-modal.tsx  LOCATION_GROUPS (Default / Suggested) and LOT_OPTIONS
 * Regenerate from the sources rather than editing values by hand. */

export type PiControlType = "Serialized" | "Non-Serialized" | "Lot" | "Lot-Serialized";

export const ALL_UOM_OPTIONS = [
  "EA",
  "Boxes",
  "Carton"
] as const;

export const SERIALIZED_UOM = "EA";

export interface PiLocationRow {
  locationCode: string;
  locationDetails: string;
  type: "location" | "person";
  onHandQty: number;
}

export const locationRows: PiLocationRow[] = [
  {
    "locationCode": "Zone A-01",
    "locationDetails": "Zone A, Bay 1, Central Warehouse",
    "type": "location",
    "onHandQty": 15
  },
  {
    "locationCode": "Zone A-02",
    "locationDetails": "Zone A, Bay 2, Central Warehouse",
    "type": "location",
    "onHandQty": 180
  },
  {
    "locationCode": "Zone B-05",
    "locationDetails": "Zone B, Bay 2, Central Warehouse",
    "type": "location",
    "onHandQty": 100
  },
  {
    "locationCode": "Zone C-03",
    "locationDetails": "Zone C, Bin 301, South Warehouse",
    "type": "location",
    "onHandQty": 50
  },
  {
    "locationCode": "Zone C-01",
    "locationDetails": "Zone C, Bay 1, South Warehouse",
    "type": "location",
    "onHandQty": 340
  },
  {
    "locationCode": "Zone D-10",
    "locationDetails": "Zone D, Rack 10, East Warehouse",
    "type": "location",
    "onHandQty": 220
  },
  {
    "locationCode": "ADJ-1001",
    "locationDetails": "Receiving Bay, Ground Floor, North Processing Facility",
    "type": "location",
    "onHandQty": 11920
  },
  {
    "locationCode": "Person-JS",
    "locationDetails": "Jonas Summers",
    "type": "person",
    "onHandQty": 12
  },
  {
    "locationCode": "Person-CT",
    "locationDetails": "Colin Trevors",
    "type": "person",
    "onHandQty": 18
  },
  {
    "locationCode": "Person-RJ",
    "locationDetails": "Rashada Jones",
    "type": "person",
    "onHandQty": 18
  },
  {
    "locationCode": "Person-AA",
    "locationDetails": "Ahtisham Ahmad",
    "type": "person",
    "onHandQty": 24
  }
];

export const LOCATION_DESCRIPTIONS: Record<string, string> = {
  "Zone B-03": "Zone B, Bay 3, Central Warehouse",
  "Zone C-11": "Zone C, Bin 311, South Warehouse",
  "Zone TR-012": "Transit Rack 12, Central Warehouse",
  "Staging-1": "Staging Area 1, Ground Floor, Central Warehouse",
  "Dock-2A": "Dock 2A, Receiving, North Processing Facility",
  "WH1-1-L2": "Warehouse 1, Aisle 1, Level 2",
  "Zone B": "Zone B, Central Warehouse",
  "Zone D-02": "Zone D, Bay 2, East Warehouse",
  "Zone E-05": "Zone E, Bay 5, East Warehouse",
  "Zone H-08": "Zone H, Bay 8, South Warehouse",
  "Zone A-01": "Zone A, Bay 1, Central Warehouse",
  "Zone A-02": "Zone A, Bay 2, Central Warehouse",
  "Zone B-05": "Zone B, Bay 2, Central Warehouse",
  "Zone C-03": "Zone C, Bin 301, South Warehouse",
  "Zone C-01": "Zone C, Bay 1, South Warehouse",
  "Zone D-10": "Zone D, Rack 10, East Warehouse",
  "ADJ-1001": "Receiving Bay, Ground Floor, North Processing Facility"
};

/** The Increase grid's location picker groups (adjust-inventory-modal.tsx LOCATION_GROUPS). */
export const LOCATION_GROUPS: Record<string, string> = {
  "Zone A-01": "Default",
  "Zone A-02": "Suggested",
  "Zone B-05": "Suggested",
  "Zone C-01": "Suggested",
};

/** Extra pick-list codes the Increase grid offers (adjust-inventory-modal.tsx LOCATION_OPTIONS). */
export const EXTRA_LOCATION_CODES = ["Zone B-03", "Zone C-11", "Zone TR-012", "Staging-1", "Dock-2A", "WH1-1-L2"];

export interface PiItem {
  partNumber: string;
  /** The description's lead phrase, the item's name in pickers. */
  name: string;
  controlType: PiControlType;
  unit: string;
  onHandQty: number;
  status: "Active" | "Inactive";
  primaryCategory: string;
}

export const PI_ITEMS: PiItem[] = [
  {
    "partNumber": "P-00891",
    "name": "Front bulkhead cabinet lower cover inlay",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 450,
    "status": "Active",
    "primaryCategory": "Body & Exterior"
  },
  {
    "partNumber": "P-01229",
    "name": "Fuel Injector Assembly",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 128,
    "status": "Active",
    "primaryCategory": "Engine"
  },
  {
    "partNumber": "P-00961",
    "name": "Crankshaft Assembly (4-Cylinder)",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 64,
    "status": "Active",
    "primaryCategory": "Engine"
  },
  {
    "partNumber": "P-01005",
    "name": "Turbocharger Assembly (Twin-Scroll)",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 36,
    "status": "Active",
    "primaryCategory": "Engine"
  },
  {
    "partNumber": "P-00912",
    "name": "Rear brake pad kit (ceramic, 4pc)",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 312,
    "status": "Active",
    "primaryCategory": "Brakes"
  },
  {
    "partNumber": "P-0043",
    "name": "Front Stabilizer Bar (Heavy Duty)",
    "controlType": "Serialized",
    "unit": "EA",
    "onHandQty": 88,
    "status": "Active",
    "primaryCategory": "Suspension"
  },
  {
    "partNumber": "P-00988",
    "name": "Hex Socket Cap Screws (M10×30)",
    "controlType": "Non-Serialized",
    "unit": "EA",
    "onHandQty": 12840,
    "status": "Active",
    "primaryCategory": "Fastener"
  },
  {
    "partNumber": "P-01044",
    "name": "Viton O-Ring Kit (AS568 Standard)",
    "controlType": "Non-Serialized",
    "unit": "Kit",
    "onHandQty": 5400,
    "status": "Active",
    "primaryCategory": "Sealing"
  },
  {
    "partNumber": "P-01022",
    "name": "Copper Crush Washers (M14)",
    "controlType": "Non-Serialized",
    "unit": "EA",
    "onHandQty": 24000,
    "status": "Active",
    "primaryCategory": "Hardware"
  },
  {
    "partNumber": "P-0034",
    "name": "Cabin Air Filter (Carbon Type)",
    "controlType": "Non-Serialized",
    "unit": "EA",
    "onHandQty": 1860,
    "status": "Active",
    "primaryCategory": "HVAC"
  },
  {
    "partNumber": "P-01001",
    "name": "Alternator (12V, 90A, Compact)",
    "controlType": "Lot",
    "unit": "EA",
    "onHandQty": 640,
    "status": "Active",
    "primaryCategory": "Electrical"
  },
  {
    "partNumber": "P-01088",
    "name": "Radiator Assembly (Aluminum Core)",
    "controlType": "Lot",
    "unit": "EA",
    "onHandQty": 240,
    "status": "Active",
    "primaryCategory": "Cooling"
  },
  {
    "partNumber": "P-00985",
    "name": "Ventilated Front Brake Disc, 320mm",
    "controlType": "Lot-Serialized",
    "unit": "EA",
    "onHandQty": 520,
    "status": "Active",
    "primaryCategory": "Brakes"
  },
  {
    "partNumber": "P-01112",
    "name": "ECU Module (Engine Control Unit)",
    "controlType": "Lot-Serialized",
    "unit": "EA",
    "onHandQty": 180,
    "status": "Active",
    "primaryCategory": "Electrical"
  },
  {
    "partNumber": "P-01145",
    "name": "ABS Wheel Speed Sensor (Front)",
    "controlType": "Lot-Serialized",
    "unit": "EA",
    "onHandQty": 420,
    "status": "Active",
    "primaryCategory": "Brakes"
  }
];
