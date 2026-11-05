import { afterEach, describe, expect, it, vi } from "vitest";
import { mockVendors } from "../../data/vendors";
import { PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC, type GroupExportRow } from "../spec";
import { buildExportCsv, buildExportWorkbook, defaultExportFieldIds, exportFieldHelp, exportFieldLabels, exportFilename, exportRecords, formatFieldString, todayStamp } from "../export";

const P = PARTNERS_IMPORT_SPEC;
const G = PARTNER_GROUPS_IMPORT_SPEC;

describe("export filename", () => {
  it("<Entities>_Export_YYYY-MM-DD.<ext>", () => {
    expect(exportFilename(P, "csv")).toBe(`Partners_Export_${todayStamp()}.csv`);
    expect(exportFilename(G, "xlsx")).toBe(`Partner_Groups_Export_${todayStamp()}.xlsx`);
    expect(todayStamp(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("csv content", () => {
  it("labels as header, '|' joins for lists, RFC-4180 escaping, CRLF rows", () => {
    const v = mockVendors[0];
    const csv = buildExportCsv(P, [v], ["partner_name", "partner_type", "status", "email"]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Partner Name,Partner Type,Status,Email");
    expect(row.split(",")[0]).toBe(v.displayName.includes(",") ? `"${v.displayName}"` : v.displayName);
    expect(row).toContain((v.partnerTypes ?? []).map((t) => (t === "vendor" ? "Vendor" : "Customer")).join("|"));
    expect(exportFieldLabels(P, ["partner_name", "nope"])).toEqual(["Partner Name", "nope"]);
    expect(formatFieldString(P, v, "nope", "|")).toBe("");
  });
  it("group rows resolve template ids back to labels", () => {
    const g: GroupExportRow = {
      id: "PG-X", name: "Nordic, North", description: "d", country: "Sweden", countryFlag: "", memberCount: 2,
      template: { currency: "sek", paymentTermId: "pt-3", pricingRuleIds: ["pr-1"], creditEnforcement: "soft_warning", paymentMethodTypes: ["ach", "wire"] },
      scope: ["vendor", "customer"], status: "Active", memberNames: ["A", "B"],
      configData: { configBillingType: "international", configCreditLimit: { maxCreditLimit: "100", warningThreshold: "80" }, configShipping: { vendorPreferences: [{ carrier: "fedex" }] } },
    };
    const csv = buildExportCsv(G, [g], ["group", "type", "partners", "currency", "payment_term", "pricing_rules", "credit_enforcement", "payment_methods", "billing_type", "linked_partners", "carriers", "max_credit_limit"]);
    expect(csv.split("\r\n")[1]).toBe('"Nordic, North",Vendor|Customer,2,SEK,Net 30,"Standard Discount, Value (Single-Tier)",Soft Warning,ACH|Wire,International,A|B,FedEx,100');
  });
});

describe("defaultExportFieldIds", () => {
  it("locked + visible listing columns", () => {
    expect(defaultExportFieldIds(P).length).toBe(22);
    const ids = defaultExportFieldIds(G, { status: false, gl_accounts: false });
    expect(ids).toContain("group");
    expect(ids).not.toContain("status");
    expect(ids).not.toContain("carriers");
  });
});

describe("xlsx export", () => {
  it("entity sheet: band, filtered header in row 2, frozen under it", async () => {
    const wb = await buildExportWorkbook(P, mockVendors.slice(0, 2), ["partner_name", "email"]);
    const ws = wb.getWorksheet("Partners")!;
    expect(ws).toBeTruthy();
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 2, xSplit: 1 });
    expect(String(ws.getCell("A1").value)).toMatch(/^Omne {2}· {2}Partners Export {2}· {2}/);
    expect(String(ws.getCell("A2").value)).toBe("Partner Name");
    expect(ws.getCell("A2").fill).toMatchObject({ fgColor: { argb: "FF3A3A36" } });
    expect(ws.autoFilter).toEqual({ from: { row: 2, column: 1 }, to: { row: 4, column: 2 } });
    expect(ws.rowCount).toBe(4);
  });

  it("Glossary tab: the Export modal's help text for each exported column", async () => {
    const wb = await buildExportWorkbook(P, mockVendors.slice(0, 2), ["partner_name", "num_items"]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Partners", "Glossary"]);
    const g = wb.getWorksheet("Glossary")!;
    expect([g.getCell("B6").value, g.getCell("C6").value]).toEqual(["Column", "What It Means"]);
    expect(g.getCell("B7").value).toBe("Partner Name");
    expect(g.getCell("C7").value).toBe(exportFieldHelp(P, P.exportFields[0]));
    expect(g.getCell("C8").value).toBe("How many items this partner supplies or buys.");
  });
});

describe("exportRecords", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });
  it("csv path downloads a BOM-prefixed blob and returns the filename", async () => {
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => { blob = b; return "blob:x"; }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const name = await exportRecords(P, mockVendors.slice(0, 1), ["partner_name"], "csv");
    expect(name).toBe(exportFilename(P, "csv"));
    expect(click).toHaveBeenCalledTimes(1);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(buildExportCsv(P, mockVendors.slice(0, 1), ["partner_name"]));
  });
});
