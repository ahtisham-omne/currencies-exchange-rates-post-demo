import { describe, expect, it } from "vitest";
import { INITIAL_ITEMS, type Item } from "@/app/context/ItemsContext";
import { ITEMS_IMPORT_SPEC } from "./spec";
import { buildItemsCsv, buildItemsWorkbook, categoryDisplayCode, exportFieldHelp, exportFilename, extractField, formatFieldString } from "./export";
import { parseCsvText } from "./fileParser";
import { reviewRowToItem } from "./mappers";
import { makeEmptyRow } from "./spec";

const listingIds = ITEMS_IMPORT_SPEC.exportFields.filter((f) => f.listing).map((f) => f.id);

describe("exportFilename", () => {
  it("is Omnesoft_Items_Export_MM-DD-YYYY.<ext>", () => {
    expect(exportFilename("csv", ITEMS_IMPORT_SPEC, new Date(2026, 8, 29))).toBe("Omnesoft_Items_Export_09-29-2026.csv");
    expect(exportFilename("xlsx", ITEMS_IMPORT_SPEC, new Date(2026, 0, 5))).toBe("Omnesoft_Items_Export_01-05-2026.xlsx");
    expect(exportFilename("pdf")).toMatch(/^Omnesoft_Items_Export_\d{2}-\d{2}-\d{4}\.pdf$/);
  });
});

describe("extractField", () => {
  const item: Item = { ...INITIAL_ITEMS[0], createdAt: "2026-03-04T10:00:00.000Z", tags: ["a", "b"] };
  it("listing columns read the item like the table does", () => {
    expect(extractField(item, "part_number")).toEqual({ kind: "string", value: item.partNumber });
    expect(extractField(item, "tags")).toEqual({ kind: "multi", values: ["a", "b"] });
    expect(extractField(item, "acquisition")).toMatchObject({ kind: "multi" });
    expect(extractField(item, "owner_id")).toEqual({ kind: "string", value: "Ahtisham Ahmad" });
    expect(extractField(item, "created_on")).toMatchObject({ kind: "date", raw: "2026-03-04" });
    expect(extractField(item, "primary_category")).toEqual({ kind: "string", value: categoryDisplayCode(item.primaryCategory) });
    expect(categoryDisplayCode("C-1004")).toBe("C-1004");
    expect(categoryDisplayCode("Fasteners")).toMatch(/^C-1\d{3}$/);
    expect(extractField(item, "no_such_field")).toEqual({ kind: "empty" });
  });
  it("import columns render through the file vocabulary", () => {
    const row = { ...makeEmptyRow(), partNumber: "X-1", primaryCategory: "C-1001", lotControl: "Yes", minStock: "5", inboundLocations: "Warehouse A - Main Hall|Receiving Dock A", pricing: "12.5 Each" };
    const built: Item = { ...reviewRowToItem(row, { currentUserId: "user-123", currentUserName: "Ahtisham Ahmad" }), id: "t", createdAt: "", updatedAt: "" };
    expect(formatFieldString(built, "lotControl", "|")).toBe("Yes");
    expect(formatFieldString(built, "minStock", "|")).toBe("5");
    expect(formatFieldString(built, "inboundLocations", "|")).toBe("Warehouse A - Main Hall|Receiving Dock A");
    expect(formatFieldString(built, "inboundLocations", ", ")).toBe("Warehouse A - Main Hall, Receiving Dock A");
    expect(formatFieldString(built, "pricing", "|")).toBe("12.50 Each");
    expect(formatFieldString(built, "valuationMethod", "|")).toBe("FIFO");
  });
});

describe("buildItemsCsv", () => {
  it("writes the labels, CRLF rows, comma joins and RFC-4180 quoting", () => {
    const rows: Item[] = [
      { ...INITIAL_ITEMS[0], description: 'Hex screw, 1/4" x 1"', tags: ["a", "b"] },
      { ...INITIAL_ITEMS[1], description: "Plain ball valve", tags: [] },
    ];
    const csv = buildItemsCsv(rows, ["part_number", "description", "tags", "status"]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Part Number,Description,Tags,Status");
    expect(lines[1]).toBe(`${rows[0].partNumber},"Hex screw, 1/4"" x 1""","a, b",${rows[0].status}`);
    expect(lines[2]).toBe(`${rows[1].partNumber},${rows[1].description},,${rows[1].status}`);
    expect(lines).toHaveLength(3);
    expect(parseCsvText(csv)[1][1]).toBe('Hex screw, 1/4" x 1"');
  });
  it("covers every listing column for the seed data without throwing", () => {
    const csv = buildItemsCsv(INITIAL_ITEMS, listingIds);
    const grid = parseCsvText(csv);
    expect(grid[0]).toEqual(ITEMS_IMPORT_SPEC.exportFields.filter((f) => f.listing).map((f) => f.label));
    expect(grid).toHaveLength(INITIAL_ITEMS.length + 1);
    expect(grid[1]).toHaveLength(14);
  });
});

describe("buildItemsWorkbook", () => {
  it("Items sheet: band, filtered header in row 2, frozen under it", async () => {
    const wb = await buildItemsWorkbook(INITIAL_ITEMS.slice(0, 3), listingIds);
    const ws = wb.getWorksheet("Items")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 2, xSplit: 1 });
    expect(String(ws.getCell("A1").value)).toMatch(/^OMNE {2}· {2}Items Export/);
    expect(ws.getCell("A2").value).toBe("Part Number");
    expect(ws.autoFilter).toEqual({ from: { row: 2, column: 1 }, to: { row: 5, column: listingIds.length } });
  });

  it("Glossary tab carries the Export modal's help text for each exported column", async () => {
    const wb = await buildItemsWorkbook(INITIAL_ITEMS.slice(0, 1), ["part_number", "on_hand_qty"]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Items", "Glossary"]);
    const g = wb.getWorksheet("Glossary")!;
    const [pn] = ["part_number"].map((id) => ITEMS_IMPORT_SPEC.exportFields.find((f) => f.id === id)!);
    expect([g.getCell("B7").value, g.getCell("C7").value]).toEqual([pn.label, exportFieldHelp(pn)]);
    expect(g.getCell("C8").value).toBe("Quantity currently on hand, in the stocking unit.");
  });
});
