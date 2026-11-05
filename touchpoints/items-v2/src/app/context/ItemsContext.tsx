import React, { createContext, useContext, useState, useCallback } from "react";
import {
  reviewRowToItem,
  reviewRowToPatch,
  type ItemReviewRow,
  type MapperLookups,
} from "@/app/import-export/mappers";

/* ─── Item type (matches INITIAL_ITEMS shape from legacy App.tsx) ─── */
export interface Item {
  id: string;
  partNumber: string;
  description: string;
  /** Lifecycle status — listing-table semantics. "Active" | "Inactive". Loose-typed
   * as string to remain compatible with legacy consumers that compare against
   * stock-state literals ("In Stock", "Archived", …) without breaking type-checks. */
  status: string;
  /** Stock-state — preserved for the Item Detail page header chip and other
   * stock-aware surfaces. Replaces the meaning the listing's `status` used to carry. */
  stockStatus?: string;
  images: string[];
  inventoryControlType: string;
  primaryCategory: string;
  additionalCategories: string[];
  onHandQty: number;
  /** Quantity currently inbound on open purchase orders. Drives the listing
   *  "Items on Order" KPI; 0 / undefined means nothing on order. */
  onOrderQty?: number;
  unit: string;
  alternativeStockingUnits: string;
  inboundLocations: string[];
  outboundLocations: string[];
  /** Legacy shape preserved for downstream consumers (header, quick-view). */
  acquisitionMethod: string | { methods: string[]; primary: string };
  /** Normalised acquisition methods — listing-table source of truth. */
  acquisitionMethods: ("Purchase" | "Manufacturing")[];
  primaryAcquisition: "Purchase" | "Manufacturing" | null;
  /** Lot-control flag — independent of inventoryControlType (Serialized | Non-Serialized). */
  lotControl: boolean;
  /** Inventory valuation / costing method. Reconciled when the primary
   *  category changes (adoptable, never blocked). */
  valuationMethod?: "fifo" | "wac" | "lifo" | "specific";
  /** Real Tier-1 signal for category reconciliation: has the item EVER
   *  transacted. Distinct from on-hand stock or currently-open transactions;
   *  when true, Base UOM can't be adopted from a new category. */
  hasTransactionHistory?: boolean;
  manufacturer: string;
  mpn: string;
  ownerId: string;
  /** Display name of the user who created the record. "System" → SYS glyph in tables. */
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];

  /* ─── Configuration fields carried by the Import / Export feature ───
   * The create modal keeps these in its AdvancedConfig and discards them on
   * save; an import lands the whole 39-column template, so the record holds
   * them as optional fields using the AdvancedConfig vocabulary. */
  inventoryType?: "Stock" | "Non-stock" | "Asset";
  lotIdSource?: "system" | "vendor";
  shelfLifeValue?: number;
  shelfLifeUnit?: "days" | "months" | "years";
  alternativeUnits?: { id: string; unit: string; conversionFactor: string }[];
  minStock?: number;
  maxStock?: number;
  defaultInboundLocation?: string;
  defaultOutboundLocation?: string;
  receivingStagingLocation?: string[];
  shippingStagingLocation?: string[];
  minPurchase?: number;
  maxPurchase?: number;
  multiples?: number;
  shortageRule?: "demand" | "min" | "zero" | "off";
  sellingScope?: "all" | "specific";
  specificPartners?: string[];
  pricing?: { id: string; price: string; uom: string }[];
  owners?: { materialHandling: string[]; purchasing: string | null; finance: string | null };
  cycleTolerance?: number;
  approvers?: string[];
  scanLocation?: boolean;
  scanItem?: boolean;
  scanLot?: boolean;
  scanSerial?: boolean;
}

export const CURRENT_USER_ID = "user-123";
/** Display name of the current user (matches OWNER_DIRECTORY["user-123"] on the listing). */
export const CURRENT_USER_NAME = "Ahtisham Ahmad";

/* ─── Seed data (extracted from legacy App.tsx) ─── */
export const INITIAL_ITEMS: Item[] = [
  {
    id: "1",
    partNumber: "FAST-HEX-001",
    description: 'Zinc-Plated Steel Hex Head Screw, 1/4"-20 Thread Size, 1" Long',
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1617123623686-2b7b339785da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2NyZXclMjBib2x0fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1766337941300-74d12e751c58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxmbGFuZ2UlMjBib2x0JTIwaGVhdnklMjBkdXR5fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Fasteners",
    additionalCategories: ["Screws", "Hardware"],
    onHandQty: 15400,
    onOrderQty: 5000,
    unit: "ea",
    alternativeStockingUnits: "Box (100)",
    inboundLocations: ["Warehouse A, Row 01, Shelf 02"],
    outboundLocations: ["Warehouse A, Row 01, Shelf 02"],
    acquisitionMethod: { methods: ["Purchased"], primary: "Purchased" },
    manufacturer: "BoltMaster Inc.",
    mpn: "BM-2520-100",
    valuationMethod: "wac",
    hasTransactionHistory: true,
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Ahtisham Ahmad",
    createdAt: "2024-09-12T10:14:00.000Z",
    tags: ["High Demand", "Critical", "Q4 Restock", "Top Seller", "Bulk Buy"],
  },
  {
    id: "2",
    partNumber: "VALV-BAL-316",
    description: '316 Stainless Steel Ball Valve, 2-Piece, 1" NPT Female',
    // Archive "clean case" demo: Active + zero on-hand + closed-only PO history → archivable.
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1761353854316-ef3803c6437b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMGJhbGwlMjB2YWx2ZXxlbnwxfHx8fDE3Njg0NjQ5NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1598023707207-276835c2b5fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxoeWRyYXVsaWMlMjBob3NlJTIwaW5kdXN0cmlhbHxlbnwxfHx8fDE3NjgzODc2NzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Plumbing",
    additionalCategories: ["Valves", "Industrial"],
    onHandQty: 0,
    unit: "ea",
    alternativeStockingUnits: "Carton (10)",
    inboundLocations: ["Warehouse B, Row 04, Shelf 15"],
    outboundLocations: ["Warehouse B, Row 04, Shelf 15"],
    acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Manufactured" },
    manufacturer: "FlowControl",
    mpn: "SS-BV-100",
    valuationMethod: "fifo",
    hasTransactionHistory: false,
    ownerId: "user-456",
    stockStatus: "Out of Stock",
    acquisitionMethods: ["Purchase", "Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: true,
    createdBy: "Maya Patel",
    createdAt: "2025-01-05T14:32:00.000Z",
    tags: ["Stainless", "Industrial Grade", "ISO Certified", "Special Order", "Heavy Use"],
  },
  {
    id: "3",
    partNumber: "SEAL-OR-012",
    valuationMethod: "fifo",
    hasTransactionHistory: true,
    tags: ["Consumable", "Fast Moving"],
    description: "Buna-N O-Ring, Dash Number 012, Hardness 70A",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1674899201457-5b8a5ef9b3cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxydWJiZXIlMjBvLXJpbmclMjBpbmR1c3RyaWFsfGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1617123623686-2b7b339785da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxpbmR1c3RyaWFsJTIwc2NyZXclMjBib2x0fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Seals",
    additionalCategories: ["O-Rings", "Rubber Goods"],
    onHandQty: 5000,
    unit: "pk",
    alternativeStockingUnits: "Bag (100)",
    inboundLocations: ["Warehouse C, Bin 12"],
    outboundLocations: ["Warehouse C, Bin 12"],
    acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Purchased" },
    manufacturer: "SealTech",
    mpn: "BN-70-012",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase", "Manufacturing"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Liam Chen",
    createdAt: "2024-11-20T09:08:00.000Z",
  },
  {
    id: "4",
    partNumber: "TOOL-EM-050",
    tags: ["Tooling", "Precision", "Carbide"],
    description: 'Solid Carbide Square End Mill, 1/2" Cutting Diameter, 4 Flute',
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1713662653109-5e372136d4bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxtaWxsaW5nJTIwY3V0dGVyJTIwZHJpbGwlMjBiaXR8ZW58MXx8fHwxNzY4NDY0OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxwbmV1bWF0aWMlMjBjeWxpbmRlciUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4NDY0OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Tools",
    additionalCategories: ["Milling", "Carbide"],
    onHandQty: 45,
    onOrderQty: 100,
    unit: "ea",
    alternativeStockingUnits: "Tube (1)",
    inboundLocations: ["Tool Room, Cabinet 5, Drawer 2"],
    outboundLocations: ["Tool Room, Cabinet 5, Drawer 2"],
    acquisitionMethod: "Purchased",
    manufacturer: "PrecisionTools",
    mpn: "SC-EM-4F-500",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Sarah Johnson",
    createdAt: "2025-02-18T16:45:00.000Z",
  },
  {
    id: "5",
    partNumber: "MAT-AL-6061",
    description: '6061-T6 Aluminum Sheet, 12" x 24" x 0.125"',
    status: "Inactive",
    images: [
      "https://images.unsplash.com/photo-1740657287784-ba199c31e75b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxhbHVtaW51bSUyMHNoZWV0JTIwbWV0YWwlMjB0ZXh0dXJlfGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1693359052806-dfdc172d3676?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxiYWxsJTIwYmVhcmluZyUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4MzcyMDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Raw Materials",
    additionalCategories: ["Metals", "Sheet Stock"],
    onHandQty: 0,
    unit: "sh",
    alternativeStockingUnits: "Pallet (50)",
    inboundLocations: ["Yard, Rack 01"],
    outboundLocations: ["Yard, Rack 01"],
    acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Manufactured" },
    manufacturer: "AluSupply",
    mpn: "AL-6061-125",
    ownerId: CURRENT_USER_ID,
    stockStatus: "Out of Stock",
    acquisitionMethods: ["Purchase", "Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: false,
    createdBy: "Ahtisham Ahmad",
    createdAt: "2024-08-03T11:22:00.000Z",
  },
  {
    id: "6",
    partNumber: "MECH-BRG-6204",
    tags: ["Critical", "OEM"],
    description: "Deep Groove Ball Bearing, 6204-2RS, Sealed",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1693359052806-dfdc172d3676?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxiYWxsJTIwYmVhcmluZyUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4MzcyMDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1766337941300-74d12e751c58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxmbGFuZ2UlMjBib2x0JTIwaGVhdnklMjBkdXR5fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Power Trans",
    additionalCategories: ["Bearings", "Mechanical"],
    onHandQty: 240,
    unit: "ea",
    alternativeStockingUnits: "Box (10)",
    inboundLocations: ["Parts Room, Row 02, Bin 12"],
    outboundLocations: ["Parts Room, Row 02, Bin 12"],
    acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Purchased" },
    manufacturer: "MotionPro",
    mpn: "6204-2RS",
    ownerId: "user-456",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase", "Manufacturing"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Maya Patel",
    createdAt: "2025-03-09T08:56:00.000Z",
  },
  {
    id: "7",
    partNumber: "PNEU-CYL-50",
    description: "ISO 15552 Pneumatic Cylinder, 50mm Bore, 100mm Stroke",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxwbmV1bWF0aWMlMjBjeWxpbmRlciUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4NDY0OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1598023707207-276835c2b5fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxoeWRyYXVsaWMlMjBob3NlJTIwaW5kdXN0cmlhbHxlbnwxfHx8fDE3NjgzODc2NzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Pneumatics",
    additionalCategories: ["Cylinders", "Automation"],
    onHandQty: 4,
    onOrderQty: 24,
    unit: "ea",
    alternativeStockingUnits: "Crate (1)",
    inboundLocations: ["Warehouse Z, Zone 09"],
    outboundLocations: ["Warehouse Z, Zone 09"],
    acquisitionMethod: "Purchased",
    manufacturer: "AirDynamics",
    mpn: "ISO-50-100",
    ownerId: CURRENT_USER_ID,
    stockStatus: "Low Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Liam Chen",
    createdAt: "2024-12-14T13:30:00.000Z",
  },
  {
    id: "8",
    partNumber: "ELEC-CB-20A",
    description: "Miniature Circuit Breaker, 1 Pole, 20A, C Curve, DIN Rail",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1761251947512-a293e482919f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxjaXJjdWl0JTIwYnJlYWtlciUyMGluZHVzdHJpYWwlMjBlbGVjdHJpY3xlbnwxfHx8fDE3Njg0NjQ5NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1617123623686-2b7b339785da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxpbmR1c3RyaWFsJTIwc2NyZXclMjBib2x0fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Electrical",
    additionalCategories: ["Circuit Protection", "DIN Rail"],
    onHandQty: 85,
    unit: "ea",
    alternativeStockingUnits: "Box (12)",
    inboundLocations: ["Electric Shop, Shelf 03"],
    outboundLocations: ["Electric Shop, Shelf 03"],
    acquisitionMethod: "Purchased",
    manufacturer: "VoltGuard",
    mpn: "MCB-1P-20C",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: false,
    createdBy: "Michael Reed",
    createdAt: "2025-01-28T15:11:00.000Z",
  },
  {
    id: "9",
    partNumber: "TEST-DMM-87V",
    description: "True RMS Industrial Digital Multimeter, 1000V AC/DC",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1729944950511-e9c71556cfd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwbXVsdGltZXRlciUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4NDc1OTA3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxlbGVjdHJpY2lhbiUyMHRvb2xzfGVufDF8fHx8MTc2ODQ3NTkwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Test Equip",
    additionalCategories: ["Multimeters", "Tools"],
    onHandQty: 15,
    unit: "ea",
    alternativeStockingUnits: "Kit (1)",
    inboundLocations: ["Lab A, Cabinet 02"],
    outboundLocations: ["Lab A, Cabinet 02"],
    acquisitionMethod: "Purchased",
    manufacturer: "Fluke Corp",
    mpn: "FLUKE-87-5",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Ahtisham Ahmad",
    createdAt: "2024-10-07T10:02:00.000Z",
  },
  {
    id: "10",
    partNumber: "ASM-PUMP-01",
    description: "High Pressure Hydraulic Pump Assembly, Custom Build",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1531297461136-82lw4a9191?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwcHVtcHxlbnwxfHx8fDE3Njg0NzU5MDd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Assemblies",
    additionalCategories: ["Hydraulics", "Custom"],
    onHandQty: 2,
    onOrderQty: 10,
    unit: "ea",
    alternativeStockingUnits: "-",
    inboundLocations: ["Assembly Area 1"],
    outboundLocations: ["Shipping Dock"],
    acquisitionMethod: "Manufactured",
    manufacturer: "Internal",
    mpn: "HP-PUMP-ASM-01",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: true,
    createdBy: "Maya Patel",
    createdAt: "2025-04-02T09:40:00.000Z",
  },
  {
    id: "11",
    partNumber: "HYD-HOSE-3T",
    tags: ["High Pressure", "Hydraulic", "Made-to-Length"],
    description: "3-Wire Braided Hydraulic Hose, 1/2\" ID, 4000 PSI, SAE 100R2AT",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1598023707207-276835c2b5fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxoeWRyYXVsaWMlMjBob3NlJTIwaW5kdXN0cmlhbHxlbnwxfHx8fDE3NjgzODc2NzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Hydraulics",
    additionalCategories: ["Hoses", "Fluid Power"],
    onHandQty: 320,
    unit: "ft",
    alternativeStockingUnits: "Reel (100ft)",
    inboundLocations: ["Warehouse A, Row 03, Shelf 04"],
    outboundLocations: ["Warehouse A, Row 03, Shelf 04"],
    acquisitionMethod: "Purchased",
    manufacturer: "FluidLine Co.",
    mpn: "R2AT-08-100",
    ownerId: "user-456",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Sarah Johnson",
    createdAt: "2024-07-21T11:05:00.000Z",
  },
  {
    id: "12",
    partNumber: "GASKET-CU-150",
    description: "Copper Crush Gasket, 150# Flange, NPS 2\"",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1674899201457-5b8a5ef9b3cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxydWJiZXIlMjBvLXJpbmclMjBpbmR1c3RyaWFsfGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Seals",
    additionalCategories: ["Gaskets", "Flange"],
    onHandQty: 980,
    unit: "pk",
    alternativeStockingUnits: "Box (50)",
    inboundLocations: ["Warehouse C, Bin 18"],
    outboundLocations: ["Warehouse C, Bin 18"],
    acquisitionMethod: "Purchased",
    manufacturer: "SealTech",
    mpn: "CU-150-2",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Michael Reed",
    createdAt: "2024-06-15T14:18:00.000Z",
  },
  {
    id: "13",
    partNumber: "MOTOR-AC-5HP",
    description: "TEFC 3-Phase AC Induction Motor, 5HP, 1750 RPM, 184T Frame",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1693359052806-dfdc172d3676?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxiYWxsJTIwYmVhcmluZyUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4MzcyMDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Power Trans",
    additionalCategories: ["Motors", "Electrical"],
    onHandQty: 8,
    onOrderQty: 30,
    unit: "ea",
    alternativeStockingUnits: "Crate (1)",
    inboundLocations: ["Warehouse B, Row 06"],
    outboundLocations: ["Warehouse B, Row 06"],
    acquisitionMethod: "Purchased",
    manufacturer: "MotionPro",
    mpn: "AC-5HP-184T",
    ownerId: "user-789",
    stockStatus: "Low Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Liam Chen",
    createdAt: "2024-09-30T08:22:00.000Z",
  },
  {
    id: "14",
    partNumber: "WIRE-THHN-12",
    tags: ["Electrical", "Bulk Buy"],
    description: "12 AWG THHN Stranded Copper Wire, 600V, Black",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1761251947512-a293e482919f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxjaXJjdWl0JTIwYnJlYWtlciUyMGluZHVzdHJpYWwlMjBlbGVjdHJpY3xlbnwxfHx8fDE3Njg0NjQ5NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Electrical",
    additionalCategories: ["Wire", "Cable"],
    onHandQty: 12500,
    unit: "m",
    alternativeStockingUnits: "Spool (500ft)",
    inboundLocations: ["Electric Shop, Reel Rack"],
    outboundLocations: ["Electric Shop, Reel Rack"],
    acquisitionMethod: "Purchased",
    manufacturer: "VoltGuard",
    mpn: "THHN-12-BLK",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Ahtisham Ahmad",
    createdAt: "2024-05-08T10:33:00.000Z",
  },
  {
    id: "15",
    partNumber: "FILTER-HYD-10",
    description: "Hydraulic Spin-On Filter, 10 Micron, 25 GPM",
    status: "Inactive",
    images: [
      "https://images.unsplash.com/photo-1701448149957-b96dbd1926ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxwbmV1bWF0aWMlMjBjeWxpbmRlciUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4NDY0OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Hydraulics",
    additionalCategories: ["Filtration", "Maintenance"],
    onHandQty: 26,
    unit: "bx",
    alternativeStockingUnits: "Box (6)",
    inboundLocations: ["Maint Shop, Shelf 11"],
    outboundLocations: ["Maint Shop, Shelf 11"],
    acquisitionMethod: "Purchased",
    manufacturer: "FluidLine Co.",
    mpn: "SOF-10-25",
    ownerId: "user-456",
    stockStatus: "Low Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Maya Patel",
    createdAt: "2024-04-19T13:47:00.000Z",
  },
  {
    id: "16",
    partNumber: "BOLT-HEX-M10",
    description: "M10 x 50mm Hex Head Bolt, Class 10.9, Zinc Plated",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1617123623686-2b7b339785da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxpbmR1c3RyaWFsJTIwc2NyZXclMjBib2x0fGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Fasteners",
    additionalCategories: ["Bolts", "Metric"],
    onHandQty: 8420,
    unit: "ea",
    alternativeStockingUnits: "Box (100)",
    inboundLocations: ["Warehouse A, Row 02, Shelf 09"],
    outboundLocations: ["Warehouse A, Row 02, Shelf 09"],
    acquisitionMethod: "Purchased",
    manufacturer: "BoltMaster Inc.",
    mpn: "BM-M10-50",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Sarah Johnson",
    createdAt: "2024-10-25T15:00:00.000Z",
  },
  {
    id: "17",
    partNumber: "PLC-S7-1200",
    description: "Siemens S7-1200 PLC CPU 1214C, DC/DC/DC, 14DI/10DO/2AI",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1761251947512-a293e482919f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxjaXJjdWl0JTIwYnJlYWtlciUyMGluZHVzdHJpYWwlMjBlbGVjdHJpY3xlbnwxfHx8fDE3Njg0NjQ5NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Automation",
    additionalCategories: ["PLC", "Controls"],
    onHandQty: 11,
    onOrderQty: 20,
    unit: "ea",
    alternativeStockingUnits: "Box (1)",
    inboundLocations: ["Lab B, Rack 04"],
    outboundLocations: ["Lab B, Rack 04"],
    acquisitionMethod: "Purchased",
    manufacturer: "Siemens",
    mpn: "6ES7214-1AG40-0XB0",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Michael Reed",
    createdAt: "2025-02-03T09:15:00.000Z",
  },
  {
    id: "18",
    partNumber: "LUBE-GR-EP2",
    description: "EP2 Lithium Complex Grease, NLGI Grade 2, 14oz Cartridge",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxlbGVjdHJpY2lhbiUyMHRvb2xzfGVufDF8fHx8MTc2ODQ3NTkwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Lubricants",
    additionalCategories: ["Grease", "MRO"],
    onHandQty: 144,
    unit: "cs",
    alternativeStockingUnits: "Case (10)",
    inboundLocations: ["Maint Shop, Bin 04"],
    outboundLocations: ["Maint Shop, Bin 04"],
    acquisitionMethod: "Purchased",
    manufacturer: "LubePro",
    mpn: "EP2-14OZ",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Liam Chen",
    createdAt: "2024-11-11T16:40:00.000Z",
  },
  {
    id: "19",
    partNumber: "DRILL-HSS-25",
    description: "HSS Twist Drill Bit, 1/4\" Diameter, 135° Split Point",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1713662653109-5e372136d4bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxtaWxsaW5nJTIwY3V0dGVyJTIwZHJpbGwlMjBiaXR8ZW58MXx8fHwxNzY4NDY0OTcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Tools",
    additionalCategories: ["Drill Bits", "Cutting"],
    onHandQty: 210,
    unit: "dz",
    alternativeStockingUnits: "Pack (10)",
    inboundLocations: ["Tool Room, Cabinet 2, Drawer 4"],
    outboundLocations: ["Tool Room, Cabinet 2, Drawer 4"],
    acquisitionMethod: "Purchased",
    manufacturer: "PrecisionTools",
    mpn: "HSS-250-135",
    ownerId: "user-456",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Ahtisham Ahmad",
    createdAt: "2025-03-22T12:08:00.000Z",
  },
  {
    id: "20",
    partNumber: "STEEL-RD-1018",
    description: "1018 Cold Rolled Steel Round Bar, 1\" Diameter, 12ft Length",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1740657287784-ba199c31e75b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxhbHVtaW51bSUyMHNoZWV0JTIwbWV0YWwlMjB0ZXh0dXJlfGVufDF8fHx8MTc2ODQ2NDk3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Raw Materials",
    additionalCategories: ["Steel", "Bar Stock"],
    onHandQty: 64,
    unit: "kg",
    alternativeStockingUnits: "Bundle (10)",
    inboundLocations: ["Yard, Rack 03"],
    outboundLocations: ["Yard, Rack 03"],
    acquisitionMethod: "Purchased",
    manufacturer: "AluSupply",
    mpn: "1018-CR-100-12",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Sarah Johnson",
    createdAt: "2024-08-29T09:55:00.000Z",
  },
  {
    id: "21",
    partNumber: "BELT-V-A48",
    description: "Classical V-Belt, A48 Section, Wrapped, 50\" Outside Length",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1693359052806-dfdc172d3676?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxiYWxsJTIwYmVhcmluZyUyMGluZHVzdHJpYWx8ZW58MXx8fHwxNzY4MzcyMDE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Power Trans",
    additionalCategories: ["Belts", "Drives"],
    onHandQty: 38,
    unit: "ea",
    alternativeStockingUnits: "Box (5)",
    inboundLocations: ["Parts Room, Row 01, Bin 07"],
    outboundLocations: ["Parts Room, Row 01, Bin 07"],
    acquisitionMethod: "Purchased",
    manufacturer: "MotionPro",
    mpn: "A48-CL",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Michael Reed",
    createdAt: "2024-12-02T11:25:00.000Z",
  },
  {
    id: "22",
    partNumber: "SAFETY-GLV-L",
    tags: ["PPE", "Safety", "Reorder"],
    description: "Cut-Resistant Safety Gloves, Level A4, Nitrile Coated, Size L",
    status: "Active",
    images: [
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxlbGVjdHJpY2lhbiUyMHRvb2xzfGVufDF8fHx8MTc2ODQ3NTkwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Non-Serialized",
    primaryCategory: "Safety",
    additionalCategories: ["PPE", "Gloves"],
    onHandQty: 360,
    unit: "pr",
    alternativeStockingUnits: "Case (12)",
    inboundLocations: ["PPE Cage, Shelf 02"],
    outboundLocations: ["PPE Cage, Shelf 02"],
    acquisitionMethod: "Purchased",
    manufacturer: "SafeGrip",
    mpn: "CR-A4-L",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Maya Patel",
    createdAt: "2025-01-14T14:50:00.000Z",
  },
];

/* ─── Context API (mirrors VendorContext: data-only, no UI state) ─── */
/** Result of an import batch: counts plus the ids touched (first created id
 *  is handy for the listing's row flash). */
export interface UpsertImportedResult {
  created: number;
  updated: number;
  createdIds: string[];
  updatedIds: string[];
}

interface ItemsContextType {
  items: Item[];
  getItem: (id: string) => Item | undefined;
  addItem: (item: Partial<Item> & { partNumber: string; description: string }) => Item;
  updateItem: (id: string, updates: Partial<Item>) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
  deleteItem: (id: string) => void;
  /** Apply validated import review rows: rows whose Part Number matches an
   *  existing item (trim, case-insensitive) patch that item, the rest become
   *  new items prepended to the listing. `lookups` canonicalises names. */
  upsertImportedItems: (rows: ItemReviewRow[], lookups?: MapperLookups) => UpsertImportedResult;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);

  const getItem = useCallback(
    (id: string) => items.find((i) => i.id === id),
    [items]
  );

  const addItem = useCallback(
    (itemData: Partial<Item> & { partNumber: string; description: string }): Item => {
      const now = new Date().toISOString();
      /* Spread first so optional fields (tags, valuationMethod,
       * hasTransactionHistory, the configuration fields) are kept; the
       * explicit keys below then apply the same defaults as before. */
      const newItem: Item = {
        ...itemData,
        id: generateItemId(),
        partNumber: itemData.partNumber,
        description: itemData.description,
        status: itemData.status ?? "Active",
        stockStatus: itemData.stockStatus ?? "In Stock",
        images: itemData.images ?? [],
        inventoryControlType: itemData.inventoryControlType ?? "Non-Serialized",
        primaryCategory: itemData.primaryCategory ?? "",
        additionalCategories: itemData.additionalCategories ?? [],
        onHandQty: itemData.onHandQty ?? 0,
        onOrderQty: itemData.onOrderQty ?? 0,
        unit: itemData.unit ?? "ea",
        alternativeStockingUnits: itemData.alternativeStockingUnits ?? "-",
        inboundLocations: itemData.inboundLocations ?? [],
        outboundLocations: itemData.outboundLocations ?? [],
        acquisitionMethod: itemData.acquisitionMethod ?? "Purchase",
        acquisitionMethods: itemData.acquisitionMethods ?? ["Purchase"],
        primaryAcquisition: itemData.primaryAcquisition ?? "Purchase",
        lotControl: itemData.lotControl ?? false,
        manufacturer: itemData.manufacturer ?? "",
        mpn: itemData.mpn ?? "",
        ownerId: itemData.ownerId ?? CURRENT_USER_ID,
        createdBy: itemData.createdBy ?? "System",
        createdAt: now,
        updatedAt: now,
      };
      setItems((prev) => [newItem, ...prev]);
      return newItem;
    },
    []
  );

  const updateItem = useCallback((id: string, updates: Partial<Item>) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      )
    );
  }, []);

  const archiveItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "Archived", updatedAt: new Date().toISOString() }
          : i
      )
    );
  }, []);

  const restoreItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "Active", updatedAt: new Date().toISOString() }
          : i
      )
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const upsertImportedItems = useCallback(
    (rows: ItemReviewRow[], lookups: MapperLookups = {}): UpsertImportedResult => {
      const now = new Date().toISOString();
      const actor = { currentUserId: CURRENT_USER_ID, currentUserName: CURRENT_USER_NAME };
      const byKey = new Map<string, Item>();
      for (const it of items) {
        const k = (it.partNumber ?? "").trim().toLowerCase();
        if (k && !byKey.has(k)) byKey.set(k, it);
      }
      const patches = new Map<string, Partial<Item>>();
      const created: Item[] = [];
      for (const row of rows) {
        const key = (row.partNumber ?? "").trim().toLowerCase();
        if (!key) continue;
        const existing = byKey.get(key);
        if (existing) {
          const patch = reviewRowToPatch(row, { ...existing, ...(patches.get(existing.id) ?? {}) }, lookups);
          patches.set(existing.id, { ...(patches.get(existing.id) ?? {}), ...patch });
          continue;
        }
        const item: Item = { ...reviewRowToItem(row, actor, lookups), id: generateItemId(), createdAt: now, updatedAt: now };
        created.push(item);
        byKey.set(key, item);
      }
      const createdIds = created.map((i) => i.id);
      const updatedIds = [...patches.keys()];
      setItems((prev) => {
        const prevIds = new Set(prev.map((i) => i.id));
        const merged = prev.map((i) => (patches.has(i.id) ? { ...i, ...patches.get(i.id)!, updatedAt: now } : i));
        return [...created.filter((c) => !prevIds.has(c.id)), ...merged];
      });
      return { created: created.length, updated: updatedIds.length, createdIds, updatedIds };
    },
    [items]
  );

  return (
    <ItemsContext.Provider
      value={{
        items,
        getItem,
        addItem,
        updateItem,
        archiveItem,
        restoreItem,
        deleteItem,
        upsertImportedItems,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) {
    throw new Error("useItems must be used within an ItemsProvider");
  }
  return ctx;
}
