import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ImportFileParseError, cellToString, parseCSV, parseGrid, parseImportFile } from "../fileParser";
import { PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC } from "../spec";
import { templateHeaders } from "../templateWorkbook";

const spec = PARTNERS_IMPORT_SPEC;

async function expectCode(p: Promise<unknown> | (() => unknown), code: string) {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (e) {
    expect(e).toBeInstanceOf(ImportFileParseError);
    expect((e as ImportFileParseError).code).toBe(code);
    return e as ImportFileParseError;
  }
  throw new Error(`expected ${code}`);
}

describe("parseCSV", () => {
  it("handles quotes, embedded commas, escaped quotes, embedded newlines and CRLF", () => {
    const text = 'a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\nlast,,\n';
    expect(parseCSV(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "line1\nline2"],
      ["last", "", ""],
    ]);
  });
  it("flushes a trailing row without a newline and strips a BOM", () => {
    expect(parseCSV("﻿a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseGrid", () => {
  it("finds the header below a banner, maps aliases, drops unknown columns and blank rows", () => {
    const grid = [
      ["Omne  ·  Partners Import Template"],
      [],
      ["Partner Name *", "Primary Group", "Mobile", "Mystery Column", "Email Address"],
      ["Acme", "Nordic Countries", "555 1234", "ignored", "a@b.co"],
      ["", "", "", "", ""],
      ["Beta", "", "", "", ""],
    ];
    const r = parseGrid(spec, grid);
    expect(r.rawRowCount).toBe(2);
    expect(r.matchedFieldCount).toBe(4);
    expect(r.rows[0]).toMatchObject({ partnerName: "Acme", primaryPartnerGroup: "Nordic Countries", phone: "555 1234", email: "a@b.co" });
    expect(Object.keys(r.rows[0])).toHaveLength(spec.columns.length);
    expect(r.rows[1].partnerName).toBe("Beta");
    expect(r.rows[1].email).toBe("");
  });
  it("still reads files that carry the legacy upper-case OMNE banner", () => {
    for (const banner of ["OMNE  ·  Partners Import Template  ·  Data Entry", "Omne  ·  Partners Import Template  ·  Data Entry"]) {
      const r = parseGrid(spec, [[banner], ["Partner Name *", "Primary Partner Group"], ["Acme", "Nordic Countries"]]);
      expect(r.rawRowCount).toBe(1);
      expect(r.rows[0]).toMatchObject({ partnerName: "Acme", primaryPartnerGroup: "Nordic Countries" });
    }
  });
  it("strips '*' and '(required)' from headers and is case/space-insensitive", () => {
    const r = parseGrid(spec, [["partner  name (Required)", "STATUS"], ["Acme", "Active"]]);
    expect(r.rows[0]).toMatchObject({ partnerName: "Acme", status: "Active" });
  });
  it("first column wins when two headers map to the same field", () => {
    const r = parseGrid(spec, [["Partner Name", "Email", "Email Address"], ["Acme", "first@x.io", "second@x.io"]]);
    expect(r.rows[0].email).toBe("first@x.io");
    expect(r.matchedFieldCount).toBe(2);
  });
  it("EMPTY when nothing but blanks", async () => {
    const e = await expectCode(() => parseGrid(spec, [[""], ["", ""]]), "EMPTY");
    expect(e.message).toBe("This file looks empty. Add at least one partner row and re-upload.");
  });
  it("NO_HEADERS when the key header is missing in the first 10 non-blank rows", async () => {
    const e = await expectCode(() => parseGrid(spec, [["Status", "Email"], ["Active", "a@b.co"]]), "NO_HEADERS");
    expect(e.message).toContain("Download the template");
    expect(e.message).toContain("Partner Name, Status, and Partner Groups");
    const preamble = Array.from({ length: 11 }, (_, i) => [`note ${i}`]);
    await expectCode(() => parseGrid(spec, [...preamble, ["Partner Name"], ["Acme"]]), "NO_HEADERS");
  });
  it("NO_DATA when only a header row exists", async () => {
    const e = await expectCode(() => parseGrid(PARTNER_GROUPS_IMPORT_SPEC, [["Group Name *"]]), "NO_DATA");
    expect(e.message).toBe("This file has a header row but no partner groups. Add at least one partner group row and re-upload.");
  });
});

describe("cellToString", () => {
  it("coerces Excel values", () => {
    expect(cellToString(new Date(2026, 2, 15))).toBe("2026-03-15");
    expect(cellToString(42)).toBe("42");
    expect(cellToString(true)).toBe("Yes");
    expect(cellToString({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(cellToString({ text: "link", hyperlink: "https://x" })).toBe("link");
    expect(cellToString({ result: 7 })).toBe("7");
    expect(cellToString(null)).toBe("");
  });
});

describe("parseImportFile", () => {
  it("UNSUPPORTED for other extensions", async () => {
    const e = await expectCode(parseImportFile(spec, new File(["x"], "data.xls")), "UNSUPPORTED");
    expect(e.message).toBe("Unsupported file type. Upload an Excel (.xlsx) or CSV (.csv) file.");
  });
  it("reads a CSV File", async () => {
    const file = new File(["Partner Name *,Status\nAcme,Active\n"], "partners.csv", { type: "text/csv" });
    const r = await parseImportFile(spec, file);
    expect(r.rows[0]).toMatchObject({ partnerName: "Acme", status: "Active" });
  });
  it("reads the Data Entry sheet of an xlsx by name, converting dates to YYYY-MM-DD", async () => {
    const wb = new ExcelJS.Workbook();
    const other = wb.addWorksheet("Instructions");
    other.addRow(["Not the data"]);
    const de = wb.addWorksheet("Data Entry");
    de.addRow(["OMNE banner"]); // legacy upper-case banner from an old template
    de.addRow(templateHeaders(PARTNER_GROUPS_IMPORT_SPEC));
    de.addRow(["Maryland Dealers", "Active", "United States", new Date(2026, 0, 5)]);
    const buf = await wb.xlsx.writeBuffer();
    const file = new File([buf as ArrayBuffer], "groups.xlsx");
    const r = await parseImportFile(PARTNER_GROUPS_IMPORT_SPEC, file);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ groupName: "Maryland Dealers", status: "Active", country: "United States", description: "2026-01-05" });
    expect(r.matchedFieldCount).toBe(PARTNER_GROUPS_IMPORT_SPEC.columns.length);
  });
  it("READ_FAILED for a corrupt xlsx", async () => {
    await expectCode(parseImportFile(spec, new File(["not a zip"], "bad.xlsx")), "READ_FAILED");
  });
});
