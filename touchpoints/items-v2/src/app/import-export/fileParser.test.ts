/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { TEMPLATE_HEADERS } from "./spec.data.mjs";
import { ITEMS_IMPORT_SPEC } from "./spec";
import { gridToRows, ImportFileParseError, parseCsvText, parseImportFile, parseXlsxBuffer, PARSE_MESSAGES } from "./fileParser";

const csvOnDisk = readFileSync(join(process.cwd(), "public", "templates", ITEMS_IMPORT_SPEC.files.csv), "utf8");

describe("parseCsvText", () => {
  it("handles quotes, embedded commas, escaped quotes, embedded newlines and CRLF", () => {
    const text = 'a,b,c\r\n"x, y","He said ""hi""","line1\nline2"\r\nlast,,\n';
    expect(parseCsvText(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'He said "hi"', "line1\nline2"],
      ["last", "", ""],
    ]);
  });
  it("flushes a trailing row without a newline and strips a BOM", () => {
    expect(parseCsvText("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("gridToRows (header scan + aliases)", () => {
  it("finds the header row below a banner, maps aliases and drops unknown columns", () => {
    const grid = [
      ["OMNE  ·  Items Import Template"],
      [],
      ["SKU", "Item Description", "Base UOM *", "Colour", "Primary Category (required)"],
      ["A-1", "Widget", "each", "red", "C-1001"],
      ["", "", "", "", ""],
      ["A-2", "", "", "", "C-1002"],
    ];
    const res = gridToRows(grid);
    expect(res.headerRowIndex).toBe(1);
    expect(res.matchedFieldCount).toBe(4);
    expect(res.unmatchedHeaders).toEqual(["Colour"]);
    expect(res.rawRowCount).toBe(2);
    expect(res.rows[0]).toMatchObject({ partNumber: "A-1", description: "Widget", unit: "each", primaryCategory: "C-1001" });
    expect(res.rows[1]).toMatchObject({ partNumber: "A-2", description: "", unit: "" });
    expect(Object.keys(res.rows[0])).toHaveLength(39);
  });
  it("throws EMPTY / NO_HEADERS / NO_DATA with the UAC strings", () => {
    expect(() => gridToRows([[], ["", ""]])).toThrowError(PARSE_MESSAGES.EMPTY);
    expect(() => gridToRows([["a", "b"], ["1", "2"]])).toThrowError(PARSE_MESSAGES.NO_HEADERS);
    expect(() => gridToRows([["Part Number *", "Description"]])).toThrowError(PARSE_MESSAGES.NO_DATA);
    try {
      gridToRows([["a"], ["1"]]);
    } catch (e) {
      expect(e).toBeInstanceOf(ImportFileParseError);
      expect((e as ImportFileParseError).code).toBe("NO_HEADERS");
    }
  });
  it("does not look past the first 10 non-blank rows for a header", () => {
    const grid = Array.from({ length: 10 }, (_, i) => [`noise ${i}`]);
    grid.push([...TEMPLATE_HEADERS], ["X-1"]);
    expect(() => gridToRows(grid)).toThrowError(PARSE_MESSAGES.NO_HEADERS);
  });
});

describe("parseImportFile", () => {
  it("parses the shipped CSV template into the two example rows", async () => {
    const file = new File([csvOnDisk], ITEMS_IMPORT_SPEC.files.csv, { type: "text/csv" });
    const res = await parseImportFile(file);
    expect(res.rows).toHaveLength(2);
    expect(res.matchedFieldCount).toBe(39);
    expect(res.rows[0].partNumber).toBe("PUMP-CENT-2HP");
    expect(res.rows[0].alternativeUnits).toBe("Box=4, Pallet=48");
    expect(res.rows[1].primaryCategory).toBe("C-1002");
  });
  it("parses an xlsx buffer: Data Entry sheet by name, dates as YYYY-MM-DD, numbers and booleans as text", async () => {
    const wb = new ExcelJS.Workbook();
    const other = wb.addWorksheet("Notes");
    other.addRow(["not data"]);
    const de = wb.addWorksheet("Data Entry");
    de.addRow(["OMNE banner"]);
    de.addRow(["Part Number *", "Description", "Min Level", "Lot Tracking", "Tags"]);
    de.addRow(["P-100", new Date(2026, 2, 15), 25, true, "a|b"]);
    de.addRow([]);
    de.addRow(["P-101", "Second", 0, false, ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const grid = await parseXlsxBuffer(buffer as ArrayBuffer);
    const res = gridToRows(grid);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ partNumber: "P-100", description: "2026-03-15", minStock: "25", lotControl: "Yes", tags: "a, b" });
    expect(res.rows[1]).toMatchObject({ partNumber: "P-101", minStock: "0", lotControl: "No" });

    const file = new File([new Uint8Array(buffer as ArrayBuffer)], "items.xlsx");
    const viaFile = await parseImportFile(file);
    expect(viaFile.rows.map((r) => r.partNumber)).toEqual(["P-100", "P-101"]);
  });
  it("rejects unsupported extensions with the UAC message", async () => {
    const file = new File(["x"], "items.txt");
    await expect(parseImportFile(file)).rejects.toMatchObject({ code: "UNSUPPORTED", message: PARSE_MESSAGES.UNSUPPORTED });
  });
});
