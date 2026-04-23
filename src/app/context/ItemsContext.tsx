import React, { createContext, useContext, useState, useCallback } from "react";

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
  manufacturer: string;
  mpn: string;
  ownerId: string;
  /** Display name of the user who created the record. "System" → SYS glyph in tables. */
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export const CURRENT_USER_ID = "user-123";

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
    unit: "ea",
    alternativeStockingUnits: "Box (100)",
    inboundLocations: ["Warehouse A, Row 01, Shelf 02"],
    outboundLocations: ["Warehouse A, Row 01, Shelf 02"],
    acquisitionMethod: { methods: ["Purchased"], primary: "Purchased" },
    manufacturer: "BoltMaster Inc.",
    mpn: "BM-2520-100",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Ahtisham Ahmad",
  },
  {
    id: "2",
    partNumber: "VALV-BAL-316",
    description: '316 Stainless Steel Ball Valve, 2-Piece, 1" NPT Female',
    status: "Inactive",
    images: [
      "https://images.unsplash.com/photo-1761353854316-ef3803c6437b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMGJhbGwlMjB2YWx2ZXxlbnwxfHx8fDE3Njg0NjQ5NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1598023707207-276835c2b5fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxoeWRyYXVsaWMlMjBob3NlJTIwaW5kdXN0cmlhbHxlbnwxfHx8fDE3NjgzODc2NzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    inventoryControlType: "Serialized",
    primaryCategory: "Plumbing",
    additionalCategories: ["Valves", "Industrial"],
    onHandQty: 12,
    unit: "ea",
    alternativeStockingUnits: "Carton (10)",
    inboundLocations: ["Warehouse B, Row 04, Shelf 15"],
    outboundLocations: ["Warehouse B, Row 04, Shelf 15"],
    acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Manufactured" },
    manufacturer: "FlowControl",
    mpn: "SS-BV-100",
    ownerId: "user-456",
    stockStatus: "Low Stock",
    acquisitionMethods: ["Purchase", "Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: true,
    createdBy: "Maya Patel",
  },
  {
    id: "3",
    partNumber: "SEAL-OR-012",
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
  },
  {
    id: "4",
    partNumber: "TOOL-EM-050",
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
    unit: "ea",
    alternativeStockingUnits: "Tube (1)",
    inboundLocations: ["Tool Room, Cabinet 5, Drawer 2"],
    outboundLocations: ["Tool Room, Cabinet 5, Drawer 2"],
    acquisitionMethod: "Purchase",
    manufacturer: "PrecisionTools",
    mpn: "SC-EM-4F-500",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "System",
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
  },
  {
    id: "6",
    partNumber: "MECH-BRG-6204",
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
    unit: "ea",
    alternativeStockingUnits: "Crate (1)",
    inboundLocations: ["Warehouse Z, Zone 09"],
    outboundLocations: ["Warehouse Z, Zone 09"],
    acquisitionMethod: "Purchase",
    manufacturer: "AirDynamics",
    mpn: "ISO-50-100",
    ownerId: CURRENT_USER_ID,
    stockStatus: "Low Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: true,
    createdBy: "Liam Chen",
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
    acquisitionMethod: "Purchase",
    manufacturer: "VoltGuard",
    mpn: "MCB-1P-20C",
    ownerId: "user-789",
    stockStatus: "In Stock",
    acquisitionMethods: ["Manufacturing"],
    primaryAcquisition: "Manufacturing",
    lotControl: false,
    createdBy: "System",
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
    acquisitionMethod: "Purchase",
    manufacturer: "Fluke Corp",
    mpn: "FLUKE-87-5",
    ownerId: CURRENT_USER_ID,
    stockStatus: "In Stock",
    acquisitionMethods: ["Purchase"],
    primaryAcquisition: "Purchase",
    lotControl: false,
    createdBy: "Ahtisham Ahmad",
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
  },
];

/* ─── Context API (mirrors VendorContext: data-only, no UI state) ─── */
interface ItemsContextType {
  items: Item[];
  getItem: (id: string) => Item | undefined;
  addItem: (item: Partial<Item> & { partNumber: string; description: string }) => Item;
  updateItem: (id: string, updates: Partial<Item>) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
  deleteItem: (id: string) => void;
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
      const newItem: Item = {
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
          ? { ...i, status: "In Stock", updatedAt: new Date().toISOString() }
          : i
      )
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

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
