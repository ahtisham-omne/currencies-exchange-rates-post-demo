/* Mappers + the ItemsContext upsert: full records from review rows, patches
 * for existing part numbers, tags / valuationMethod kept by addItem. */
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { CURRENT_USER_ID, CURRENT_USER_NAME, INITIAL_ITEMS, ItemsProvider, useItems, type Item } from "@/app/context/ItemsContext";
import { ITEMS_IMPORT_SPEC, makeEmptyRow, type ItemReviewRow } from "./spec";
import { itemToReviewRow, reviewRowToItem, reviewRowToPatch } from "./mappers";
import { ITEM_IMAGE_PLACEHOLDER } from "./spec.data.mjs";
import {
  applyCorrectionToParent,
  detectCorrectionTarget,
  inlineFixChildId,
  listImports,
  loadImportDetail,
  recordCompletedImport,
  reimportChildId,
  resetHistoryForTests,
  saveImportDetail,
  toImportedItemRow,
  HISTORY_KEY,
} from "./importHistory";

const actor = { currentUserId: CURRENT_USER_ID, currentUserName: CURRENT_USER_NAME };
const lookups = ITEMS_IMPORT_SPEC.lookups;

const fullRow: ItemReviewRow = {
  ...makeEmptyRow(),
  partNumber: "PUMP-CENT-2HP",
  description: "Centrifugal water pump",
  status: "inactive",
  tags: "Pumps|Fluid Handling|pumps",
  primaryCategory: "c-1004",
  additionalCategories: "C-1008|C-1004|C-9999",
  inventoryType: "Asset",
  inventoryControlType: "serialized",
  lotControl: "Yes",
  lotIdSource: "Vendor Lot",
  shelfLifeValue: "24",
  shelfLifeUnit: "Months",
  unit: "each",
  alternativeUnits: "box=4|Pallet=48",
  acquisitionMethods: "Purchased|Manufactured",
  primaryAcquisition: "Manufactured",
  minStock: "5",
  maxStock: "200",
  inboundLocations: "warehouse a - main hall|Receiving Dock A|Nowhere",
  outboundLocations: "Shipping Dock 1",
  receivingStagingLocation: "Receiving Staging",
  shippingStagingLocation: "",
  minPurchase: "10",
  maxPurchase: "500",
  multiples: "5",
  shortageRule: "Min",
  sellingScope: "Specific",
  specificPartners: "Ford Motor Company|Tesla, Inc.|Acme",
  pricing: "1250 Each|4800.5 Box",
  valuationMethod: "WAC",
  "owners.materialHandling": "alice smith|Charlie Day",
  "owners.purchasing": "Bob Jones",
  "owners.finance": "Frank Reynolds",
  cycleTolerance: "2",
  approvers: "Faizan Khan|Sarah Chen",
  scanLocation: "Yes",
  scanItem: "Yes",
  scanLot: "Yes",
  scanSerial: "Yes",
};

describe("reviewRowToItem", () => {
  it("maps all 39 columns onto the Item and its configuration fields", () => {
    const it = reviewRowToItem(fullRow, actor, lookups);
    expect(it).toMatchObject({
      partNumber: "PUMP-CENT-2HP",
      status: "Inactive",
      tags: ["Pumps", "Fluid Handling"],
      primaryCategory: "C-1004",
      additionalCategories: ["C-1008"],
      inventoryType: "Asset",
      inventoryControlType: "Serialized",
      lotControl: true,
      lotIdSource: "vendor",
      shelfLifeValue: 24,
      shelfLifeUnit: "months",
      unit: "Each",
      alternativeStockingUnits: "Box (4)",
      acquisitionMethods: ["Purchase", "Manufacturing"],
      primaryAcquisition: "Manufacturing",
      acquisitionMethod: { methods: ["Purchased", "Manufactured"], primary: "Manufactured" },
      minStock: 5,
      maxStock: 200,
      inboundLocations: ["Warehouse A - Main Hall", "Receiving Dock A"],
      defaultInboundLocation: "Warehouse A - Main Hall",
      outboundLocations: ["Shipping Dock 1"],
      receivingStagingLocation: ["Receiving Staging"],
      shippingStagingLocation: [],
      minPurchase: 10,
      maxPurchase: 500,
      multiples: 5,
      shortageRule: "min",
      sellingScope: "specific",
      specificPartners: ["Ford Motor Company", "Tesla, Inc."],
      valuationMethod: "wac",
      owners: { materialHandling: ["Alice Smith", "Charlie Day"], purchasing: "Bob Jones", finance: "Frank Reynolds" },
      cycleTolerance: 2,
      approvers: ["Faizan Khan", "Sarah Chen"],
      scanLocation: true,
      scanItem: true,
      scanLot: true,
      scanSerial: true,
      onHandQty: 0,
      images: [ITEM_IMAGE_PLACEHOLDER],
      createdBy: "Ahtisham Ahmad",
      ownerId: "user-123",
      manufacturer: "Internal",
      mpn: "PUMP-CENT-2HP",
    });
    expect(it.alternativeUnits).toEqual([
      { id: "alt-1", unit: "Box", conversionFactor: "4" },
      { id: "alt-2", unit: "Pallet", conversionFactor: "48" },
    ]);
    expect(it.pricing).toEqual([
      { id: "1", price: "1250.00", uom: "Each" },
      { id: "2", price: "4800.50", uom: "Box" },
    ]);
  });
  it("blank cells take the Create New Item defaults", () => {
    const it = reviewRowToItem({ ...makeEmptyRow(), partNumber: "N-1", primaryCategory: "C-1001" }, actor, lookups);
    expect(it).toMatchObject({
      status: "Active",
      inventoryType: "Stock",
      inventoryControlType: "Non-Serialized",
      lotControl: false,
      unit: "Each",
      alternativeStockingUnits: "-",
      acquisitionMethods: ["Purchase"],
      primaryAcquisition: "Purchase",
      acquisitionMethod: "Purchased",
      minStock: 10,
      maxStock: 1000,
      inboundLocations: ["Warehouse A - Main Hall"],
      outboundLocations: ["Warehouse A - Main Hall"],
      minPurchase: 50,
      maxPurchase: 5000,
      multiples: 10,
      shortageRule: "demand",
      sellingScope: "all",
      specificPartners: [],
      pricing: [{ id: "1", price: "0.00", uom: "Each" }],
      valuationMethod: "fifo",
      cycleTolerance: 0,
      scanSerial: false,
      tags: [],
    });
    expect(it.lotIdSource).toBeUndefined();
    expect(it.shelfLifeValue).toBeUndefined();
  });
  it("round-trips through itemToReviewRow in the file vocabulary", () => {
    const it = reviewRowToItem(fullRow, actor, lookups);
    const back = itemToReviewRow({ ...it, id: "x" } as Item);
    expect(back).toMatchObject({
      status: "Inactive",
      tags: "Pumps, Fluid Handling",
      lotControl: "Yes",
      lotIdSource: "Vendor Lot",
      shelfLifeUnit: "Months",
      alternativeUnits: "Box=4, Pallet=48",
      acquisitionMethods: "Purchased, Manufactured",
      primaryAcquisition: "Manufactured",
      shortageRule: "Min",
      sellingScope: "Specific",
      pricing: "1250.00 Each, 4800.50 Box",
      valuationMethod: "WAC",
      "owners.purchasing": "Bob Jones",
      scanSerial: "Yes",
    });
  });
});

describe("reviewRowToPatch", () => {
  const existing = INITIAL_ITEMS[0];
  it("writes only the filled columns and never the part number", () => {
    const p = reviewRowToPatch({ ...makeEmptyRow(), partNumber: "fast-hex-001", status: "Inactive", minStock: "3" }, existing, lookups);
    expect(p).toEqual({ status: "Inactive", minStock: 3 });
  });
  it("respects the driving columns of conditional fields", () => {
    const p = reviewRowToPatch({ ...makeEmptyRow(), partNumber: existing.partNumber, sellingScope: "All", specificPartners: "Ford Motor Company" }, existing, lookups);
    expect(p.sellingScope).toBe("all");
    expect(p.specificPartners).toEqual([]);
    const q = reviewRowToPatch({ ...makeEmptyRow(), partNumber: existing.partNumber, scanSerial: "Yes" }, { ...existing, inventoryControlType: "Non-Serialized" }, lookups);
    expect(q.scanSerial).toBe(false);
  });
});

/* Minimal hook harness (no @testing-library/dom in this repo): mount the
 * provider with react-dom and capture the latest context value. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function renderHook<T>(useHook: () => T): { result: { current: T } } {
  const result = { current: undefined as unknown as T };
  function Probe() {
    result.current = useHook();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => {
    root.render(React.createElement(ItemsProvider, null, React.createElement(Probe)));
  });
  return { result };
}

describe("ItemsContext", () => {
  it("addItem keeps tags and valuationMethod", () => {
    const { result } = renderHook(() => useItems());
    let created: Item | undefined;
    act(() => {
      created = result.current.addItem({ partNumber: "T-1", description: "d", tags: ["x"], valuationMethod: "wac" });
    });
    expect(created).toMatchObject({ tags: ["x"], valuationMethod: "wac", status: "Active", unit: "ea", createdBy: "System" });
    expect(result.current.items[0].tags).toEqual(["x"]);
  });
  it("upsertImportedItems creates new items (prepended) and patches existing ones by part number", () => {
    const { result } = renderHook(() => useItems());
    const before = result.current.items.length;
    let res: ReturnType<typeof result.current.upsertImportedItems> | undefined;
    act(() => {
      res = result.current.upsertImportedItems(
        [
          fullRow,
          { ...makeEmptyRow(), partNumber: " fast-hex-001 ", description: "Renamed", tags: "imported" },
          { ...makeEmptyRow(), partNumber: "NEW-2", primaryCategory: "C-1002" },
        ],
        lookups,
      );
    });
    expect(res).toMatchObject({ created: 2, updated: 1 });
    expect(res!.updatedIds).toEqual([INITIAL_ITEMS[0].id]);
    expect(result.current.items).toHaveLength(before + 2);
    expect(result.current.items[0].partNumber).toBe("PUMP-CENT-2HP");
    expect(result.current.items[0].createdBy).toBe("Ahtisham Ahmad");
    expect(result.current.items[0].ownerId).toBe("user-123");
    expect(result.current.items[1].partNumber).toBe("NEW-2");
    const patched = result.current.items.find((i) => i.id === INITIAL_ITEMS[0].id)!;
    expect(patched.description).toBe("Renamed");
    expect(patched.tags).toEqual(["imported"]);
    expect(patched.partNumber).toBe(INITIAL_ITEMS[0].partNumber);
    expect(patched.onHandQty).toBe(INITIAL_ITEMS[0].onHandQty);
  });
});

describe("importHistory", () => {
  it("records imports under omne:items:* keys, seeds two mocks, links corrections", () => {
    resetHistoryForTests();
    const seeded = listImports();
    expect(seeded.map((e) => e.id)).toEqual(["imp-items-1", "imp-items-2"]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeTruthy();
    expect(loadImportDetail("imp-items-1")?.records).toHaveLength(12);

    const records = [
      toImportedItemRow({ ...makeEmptyRow(), partNumber: "A-1", primaryCategory: "C-1001" }, 1, "Created"),
      toImportedItemRow({ ...makeEmptyRow(), partNumber: "A-2", primaryCategory: "C-9999" }, 2, "Failed", "bad category"),
      toImportedItemRow({ ...makeEmptyRow(), partNumber: "A-3" }, 3, "Skipped", "Row was removed before import."),
    ];
    recordCompletedImport({ id: "imp-1", moduleSlug: "items", name: "Test", dateISO: "2026-09-29T00:00:00.000Z", importerKey: "aa", recordCount: 3, importedCount: 1, failedCount: 2 });
    saveImportDetail({ id: "imp-1", moduleSlug: "items", name: "Test", dateISO: "2026-09-29T00:00:00.000Z", importerKey: "aa", fileName: "t.csv", records });
    expect(listImports()[0].id).toBe("imp-1");

    const suggested = detectCorrectionTarget({ rowKeys: ["a-2", "A-3", "A-9"] });
    expect(suggested).toMatchObject({ kind: "linked", confidence: "suggested" });
    expect(detectCorrectionTarget({ rowKeys: ["Z-1", "Z-2", "A-2"] }).kind).toBe("none");
    expect(detectCorrectionTarget({ sessionParentId: "imp-1", rowKeys: [] })).toMatchObject({ kind: "linked", confidence: "session" });

    const updated = applyCorrectionToParent("imp-1", [{ parentRow: 2, values: { ...records[1], primaryCategory: "C-1002" } }]);
    expect(updated?.records[1]).toMatchObject({ _outcome: "Created", primaryCategory: "C-1002" });
    expect(updated?.records[1]._message).toBeUndefined();
    expect(listImports()[0]).toMatchObject({ importedCount: 2, failedCount: 1 });

    expect(reimportChildId("imp-1", 5)).toBe("imp-1-reimport-5");
    expect(inlineFixChildId("imp-1", 5)).toBe("imp-1-fix-5");
  });

  it("keeps real imports across a page load and resets only the seeds", async () => {
    resetHistoryForTests();
    listImports();
    recordCompletedImport({ id: "imp-keep", moduleSlug: "items", name: "Kept", dateISO: "2026-09-30T00:00:00.000Z", importerKey: "aa", recordCount: 1 });
    recordCompletedImport({ id: "imp-items-1-fix-1", parentId: "imp-items-1", moduleSlug: "items", name: "Seed fix", dateISO: "2026-09-30T00:00:00.000Z", importerKey: "aa", recordCount: 1 });
    vi.resetModules();
    const fresh = await import("./importHistory");
    const ids = fresh.listImports().map((e) => e.id);
    expect(ids).toContain("imp-keep");
    expect(ids).not.toContain("imp-items-1-fix-1");
    expect(ids.filter((id) => id === "imp-items-1")).toHaveLength(1);
  });
});
