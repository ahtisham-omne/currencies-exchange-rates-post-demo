/* Guards the import templates shipped in public/templates: every CSV/XLSX
 * template must parse through the real import parsers and validate clean,
 * the error-download export headers must stay byte-for-byte in sync with
 * the template CSVs, and the guide TXTs must keep the structure the
 * wizard's Reading Room parser expects. Fails when a template is edited
 * without updating the parser/export (or vice versa). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseRolesImportFile } from "../app/components/data-imports/import-review/rolesFileParser";
import { parseImportFile } from "../app/components/data-imports/import-review/fileParser";
import { validateRoleRows } from "../app/components/data-imports/import-review/rolesValidation";
import { validateRows } from "../app/components/data-imports/import-review/validation";

const TPL = path.resolve(__dirname, "../../public/templates");

function loadFile(name: string, mime: string): File {
  const buf = readFileSync(path.join(TPL, name));
  return new File([new Uint8Array(buf)], name, { type: mime });
}

const CSV = "text/csv";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("Roles import templates", () => {
  for (const [file, mime] of [
    ["OMNE_Roles_Import_Template.csv", CSV],
    ["OMNE_Roles_Import_Template.xlsx", XLSX],
  ] as const) {
    it(`${file} parses and validates`, async () => {
      const res = await parseRolesImportFile(loadFile(file, mime));
      expect(res.rows).toHaveLength(2);
      expect(res.matchedFieldCount).toBe(4);
      expect(res.rows[0].roleName).toBe("Warehouse Auditor");
      expect(res.rows[0].roleOwner).toBe("alex.johnson@acme.com");
      expect(res.rows[1].roleName).toBe("Field Service Technician");
      expect(res.rows[1].assignedUsers).toBe("dana.wu@acme.com");

      const v = validateRoleRows(res.rows, {});
      expect(v.errorRowCount).toBe(0);
      expect(v.rows.map((r) => r.status)).not.toContain("error");
    });
  }
});

describe("Users import templates", () => {
  for (const [file, mime] of [
    ["OMNE_Users_Import_Template.csv", CSV],
    ["OMNE_Users_Import_Template.xlsx", XLSX],
  ] as const) {
    it(`${file} parses and validates`, async () => {
      const res = await parseImportFile(loadFile(file, mime));
      expect(res.rows).toHaveLength(2);
      const [alex, priya] = res.rows;
      expect(alex.firstName).toBe("Alex");
      expect(alex.emailAddress).toBe("alex.johnson@acme.com");
      expect(alex.licenseType).toBe("Full Access");
      expect(alex.status).toBe("Active");
      expect(alex.dateOfBirth).toBe("1992-03-15");
      expect(alex.mobile).toBe("+1 202-555-1234");
      expect(alex.workPhone).toBe("+1 202-555-9876");
      expect(alex.personalEmail).toBe("alex.personal@gmail.com");
      expect(alex.homeAddress).toContain("123 Oak Street");
      expect(alex.workAddress).toContain("456 Commerce Blvd");
      expect(alex.assignedRoles).toBe("Administrator|Warehouse Manager");
      expect(priya.emailAddress).toBe("priya.sharma@acme.com");
      expect(priya.mobile).toBe("+1 416-555-9876");
      // every internal field the template carries should be matched
      expect(res.matchedFieldCount).toBe(17);

      const v = validateRows(res.rows, {});
      expect(v.errorRowCount).toBe(0);
    });
  }
});

describe("Error-download export headers stay in sync with the templates", () => {
  it("users TEMPLATE_HEADERS === template CSV header row", async () => {
    const { TEMPLATE_HEADERS } = await import(
      "../app/components/data-imports/importTemplateExport"
    );
    const line = readFileSync(path.join(TPL, "OMNE_Users_Import_Template.csv"), "utf8")
      .split(/\r?\n/)[0];
    expect(TEMPLATE_HEADERS.join(",")).toBe(line);
  });

  it("roles ROLES_TEMPLATE_HEADERS === template CSV header row", async () => {
    const { ROLES_TEMPLATE_HEADERS } = await import(
      "../app/components/data-imports/rolesImportTemplateExport"
    );
    const line = readFileSync(path.join(TPL, "OMNE_Roles_Import_Template.csv"), "utf8")
      .split(/\r?\n/)[0];
    expect(ROLES_TEMPLATE_HEADERS.join(",")).toBe(line);
  });
});

describe("Import guides (TXT)", () => {
  const DIVIDER = "-".repeat(66);
  for (const file of ["OMNE_Users_Import_Guide.txt", "OMNE_Roles_Import_Guide.txt"]) {
    it(`${file} has the banner + section structure the Reading Room parser expects`, () => {
      const txt = readFileSync(path.join(TPL, file), "utf8").replace(/\r\n/g, "\n");
      const lines = txt.split("\n");
      expect(lines[0].startsWith("===")).toBe(true);
      // section titles sit between divider pairs
      const dividerIdx = lines
        .map((l, i) => (l.startsWith(DIVIDER) ? i : -1))
        .filter((i) => i >= 0);
      expect(dividerIdx.length).toBeGreaterThanOrEqual(4);
      // at least the QUICK START section title parses out
      const titles = [];
      for (let k = 0; k + 1 < dividerIdx.length; k += 2) {
        if (dividerIdx[k + 1] === dividerIdx[k] + 2) titles.push(lines[dividerIdx[k] + 1].trim());
      }
      expect(titles.length).toBeGreaterThanOrEqual(3);
      expect(titles.join("|")).toContain("QUICK START");
    });
  }
});
