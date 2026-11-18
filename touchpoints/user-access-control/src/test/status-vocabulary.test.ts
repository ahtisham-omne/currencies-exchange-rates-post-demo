/* The stored status value and the word the product uses are different:
 * `Inactive` is stored, "Deactivated" is shown. Anything that renders, exports,
 * or imports a status has to speak the second one, and the export → import
 * round trip has to survive it. The shipped Users template says so in its own
 * Field Reference sheet: "Active, Deactivated, or blank ... Included so
 * exported files re-import cleanly."
 *
 * This guards that round trip and the display vocabulary. Regressing either
 * one is silent: an export that emits "Inactive" re-imports as Active, quietly
 * reactivating every deactivated user in the file. */
import { describe, it, expect } from "vitest";
import { statusDisplayLabel } from "../app/components/table-cells";
import { extractField as extractUserField } from "../app/lib/users-export";
import { extractField as extractRoleField } from "../app/lib/roles-export";
import { normalizeImportStatus } from "../app/components/data-imports/import-wizard/UsersImportWizard";
import { buildUsersAdvancedFilter } from "../app/data/users-table-config";
import { buildRolesAdvancedFilter } from "../app/data/roles-table-config";
import { USER_REVIEW_COLUMNS } from "../app/components/data-imports/import-review/usersReviewMockData";
import type { UserRow } from "../app/data/users-data";
import type { RoleRow } from "../app/data/roles-data";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("status vocabulary", () => {
  it("stored value maps to the product's word", () => {
    expect(statusDisplayLabel("Inactive")).toBe("Deactivated");
    expect(statusDisplayLabel("Pending Setup")).toBe("Draft");
    // untouched values pass through, including the roles-only "Draft"
    for (const s of ["Active", "Archived", "Invite Sent", "Invite Expired", "Draft"]) {
      expect(statusDisplayLabel(s), s).toBe(s);
    }
  });

  it("exports emit the shown word, not the stored value", () => {
    const user = { status: "Inactive" } as UserRow;
    expect(extractUserField(user, "status")).toEqual({ kind: "string", value: "Deactivated" });
    const role = { status: "Inactive" } as RoleRow;
    expect(extractRoleField(role, "status")).toEqual({ kind: "string", value: "Deactivated" });
  });

  it("import accepts the exported word, and the legacy one", () => {
    expect(normalizeImportStatus("Deactivated")).toBe("Inactive");
    expect(normalizeImportStatus("deactivated")).toBe("Inactive");
    expect(normalizeImportStatus(" Deactivated ")).toBe("Inactive");
    expect(normalizeImportStatus("Inactive")).toBe("Inactive"); // pre-existing files
    expect(normalizeImportStatus("Active")).toBe("Active");
    expect(normalizeImportStatus("")).toBeNull();
    expect(normalizeImportStatus("nonsense")).toBeNull();
  });

  it("export → import round trip preserves a deactivated user", () => {
    const exported = extractUserField({ status: "Inactive" } as UserRow, "status");
    const value = exported.kind === "string" ? exported.value : "";
    expect(normalizeImportStatus(value)).toBe("Inactive");
  });

  it("no filter or column note offers the raw stored word", () => {
    const statusOptions = (sections: { key: string; options: { value: string; label: string }[] }[]) =>
      sections.find((s) => s.key === "status")!.options;
    for (const opts of [
      statusOptions(buildUsersAdvancedFilter([]).sections),
      statusOptions(buildRolesAdvancedFilter([]).sections),
    ]) {
      expect(opts.map((o) => o.label)).not.toContain("Inactive");
      expect(opts.find((o) => o.value === "Inactive")?.label).toBe("Deactivated");
    }
    const note = USER_REVIEW_COLUMNS.find((c) => c.key === "status")!.description;
    expect(note).not.toContain("Inactive");
    expect(note).toContain("Deactivated");
    // Status is not enforced by validateRows, so the note must not claim it is
    expect(note).not.toContain("Required.");
  });

  /* The five surfaces above are each guarded by an assertion. This catches the
   * sixth, seventh and nth: any NEW display string that spells the stored value.
   * Source-level rather than render-level so it covers copy on screens no test
   * mounts (tooltips, help text, option lists, empty states).
   *
   * Allowed: reading or writing `status`, type unions, status-map keys whose
   * entry carries a label, identifiers like `isInactive`, and comments. */
  it("no source file introduces a new user-facing 'Inactive' string", () => {
    const files = [
      "app/components/shared/ExportUsersModal.tsx",
      "app/components/shared/ExportRolesModal.tsx",
      "app/components/data-imports/import-review/ImportReviewModal.tsx",
      "app/components/data-imports/import-review/usersReviewMockData.ts",
      "app/components/user-detail/RolesPermissionsTab.tsx",
      "app/components/user-detail/EditUserPage.tsx",
      "app/components/user-detail/UnarchiveUserModal.tsx",
      "app/components/shared/StatusDropdown.tsx",
      "app/components/table-cells.tsx",
      "app/data/users-table-config.tsx",
      "app/data/roles-table-config.tsx",
      "app/lib/users-export.ts",
      "app/lib/roles-export.ts",
    ];

    /* A prose sentence: "Inactive" followed by a space or punctuation and then
     * more words, inside a quoted string. `"Inactive"` on its own is the stored
     * value and always fine. */
    const prose = /["'`][^"'`\n]*\bInactive[ :.,][^"'`\n]*["'`]/;

    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(__dirname, "..", rel), "utf8");
      src.split("\n").forEach((line, i) => {
        // Strip comments: line, block-open, and continuation. Comments explaining
        // the stored value are allowed to name it.
        const code = line
          .replace(/\/\/.*$/, "")
          .replace(/\/\*.*$/, "")
          .replace(/^\s*\*.*$/, "");
        if (prose.test(code)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the import review Status dropdown offers only the shown words", () => {
    const src = readFileSync(
      join(__dirname, "../app/components/data-imports/import-review/ImportReviewModal.tsx"),
      "utf8",
    );
    const m = src.match(/const STATUS_OPTIONS = (\[[^\]]*\])/);
    expect(m, "STATUS_OPTIONS was renamed or moved").not.toBeNull();
    const options: string[] = JSON.parse(m![1].replace(/'/g, '"'));
    expect(options).toEqual(["Active", "Deactivated"]);
    // and the grid's stored-value mapping still accepts what the list offers
    for (const o of options) expect(normalizeImportStatus(o)).not.toBeNull();
  });
});
