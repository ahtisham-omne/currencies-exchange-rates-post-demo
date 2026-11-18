/* Default-run checks for the Item Library, Categories, Partners and Partner
 * Group imports. Needs nothing outside role-zen: the comparison against the
 * home repos' live validators is the opt-in parity run
 * (`npm run test:parity`, src/test/module-import-validation.parity.ts). */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_IMPORT_DEFS } from "@/app/components/data-imports/modules/moduleImportDefs";
import { sampleRow } from "@/app/components/data-imports/modules/moduleImportStore";
import { TEMPLATE_ONLY_MODULES } from "@/app/components/data-imports/templateOnlyModules";

const RZ = path.resolve(__dirname, "../..");
const MODULES_DIR = `${RZ}/src/app/components/data-imports/modules`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface ProvenanceEntry {
  dest: string;
  kind: "verbatim" | "edited" | "reduced" | "snapshot";
  sources: { path: string; sha256: string }[];
  bodySha256: string;
}

function firstCsvLine(file: string): string[] {
  const line = readFileSync(`${RZ}/public/templates/${file}`, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)[0];
  return line.split(",");
}

describe("vendored home-repo files", () => {
  const manifest: ProvenanceEntry[] = JSON.parse(readFileSync(`${MODULES_DIR}/PROVENANCE.json`, "utf8"));

  it("lists every vendored file", () => {
    expect(manifest.length).toBeGreaterThanOrEqual(19);
  });

  for (const entry of manifest) {
    it(`${entry.dest}: provenance header and sha256 match the manifest`, () => {
      const text = readFileSync(`${MODULES_DIR}/${entry.dest}`, "utf8");
      expect(text.startsWith("/* Provenance:")).toBe(true);
      const end = text.indexOf("*/\n") + 3;
      const header = text.slice(0, end);
      const body = text.slice(end);
      for (const s of entry.sources) {
        expect(header).toContain(s.path);
        expect(header).toContain(`sha256 ${s.sha256}`);
      }
      /* The vendored body has not drifted since it was copied. */
      expect(sha(body)).toBe(entry.bodySha256);
      /* A verbatim copy is byte-identical to the source it names. */
      if (entry.kind === "verbatim") expect(sha(body)).toBe(entry.sources[0].sha256);
    });
  }
});

describe("module import wiring", () => {
  it("each module's wizard header row is its shipped template header row", () => {
    const files: Record<string, string> = {
      "item-library": "OMNE_Items_Import_Template.csv",
      categories: "OMNE_Categories_Import_Template.csv",
      partners: "OMNE_Partners_Import_Template.csv",
      "partner-groups": "OMNE_Partner_Groups_Import_Template.csv",
      "physical-inventory-serialized": "OMNE_Serial_Units_Import_Template.csv",
      "physical-inventory-non-serialized": "OMNE_Stock_Lines_Import_Template.csv",
      "physical-inventory-lot-serialized": "OMNE_LOT_Serial_Units_Import_Template.csv",
      "physical-inventory-lot": "OMNE_LOT_Units_Import_Template.csv",
    };
    for (const [slug, file] of Object.entries(files)) {
      expect(TEMPLATE_ONLY_MODULES[slug as keyof typeof TEMPLATE_ONLY_MODULES].headers, slug).toEqual(firstCsvLine(file));
    }
  });

  it("header aliases resolve like the home parsers (label, alias, * and (required) stripped)", () => {
    const items = MODULE_IMPORT_DEFS["item-library"];
    expect(items.resolveHeader("SKU")).toBe("partNumber");
    expect(items.resolveHeader("  part   NUMBER * ")).toBe("partNumber");
    expect(items.resolveHeader("Part Number (Required)")).toBe("partNumber");
    expect(items.resolveHeader("Not A Column")).toBeUndefined();
    for (const def of Object.values(MODULE_IMPORT_DEFS)) {
      for (const c of def.columns) expect(def.resolveHeader(`${c.label.toUpperCase()} *`), `${def.slug} ${c.label}`).toBe(c.key);
    }
  });

  it("seeded sample records validate clean in their own module", () => {
    for (const def of Object.values(MODULE_IMPORT_DEFS)) {
      const rows = Array.from({ length: 12 }, (_, i) => sampleRow(def, "Jul", i + 1));
      const res = def.validate(rows, def.buildContext());
      const dirty = res.rows
        .map((r, i) => ({ i, issues: r.issues.map((x) => `${x.field}:${x.code}`) }))
        .filter((r) => r.issues.length > 0);
      expect(dirty, def.slug).toEqual([]);
    }
  });
});
