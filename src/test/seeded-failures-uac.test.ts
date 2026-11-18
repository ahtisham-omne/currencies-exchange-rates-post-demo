/* The seeded User Access Control imports must show every rule the validators
 * run. The seeds are validated here with the same context the record pages
 * build (ImportRecordDetailPage / RolesImportRecordDetailPage), so a rule that
 * shows in this test is a rule the page shows. */
import { describe, expect, it } from "vitest";
import { validateRows, type IssueCode } from "@/app/components/data-imports/import-review/validation";
import { validateRoleRows, type RoleIssueCode } from "@/app/components/data-imports/import-review/rolesValidation";
import { buildRolesSeeds, buildUsersJuneSeed } from "@/app/components/data-imports/uacSeeds";
import { ensureSeededForLoad, getCompletedImports } from "@/app/components/data-imports/importHistory";
import { getImportDetail } from "@/app/components/data-imports/importDetailStore";
import { getRolesImportDetail } from "@/app/components/data-imports/rolesImportDetailStore";
import type { ImportedUserRow } from "@/app/components/data-imports/importRecords";
import { getCurrentRoleNames, getCurrentUserEmails } from "@/app/data/users-table-config";
import { getExistingRoleNames, getSystemRoleNamesLower } from "@/app/data/roles-table-config";
import { users } from "@/app/data/users-data";

/* Record<Code, true> fails to compile when a code is added to or removed from
 * a validator's union, so this list cannot drift from the rules. */
const USER_CODES: Record<IssueCode, true> = {
  REQUIRED_EMPTY: true,
  INVALID_EMAIL: true,
  INVALID_DROPDOWN: true,
  MISSING_LICENSE: true,
  DUPLICATE_EMAIL: true,
  INVALID_PHONE: true,
  ROLE_NOT_FOUND: true,
};
const ROLE_CODES: Record<RoleIssueCode, true> = {
  REQUIRED_EMPTY: true,
  DUPLICATE_ROLE_NAME: true,
  SYSTEM_ROLE: true,
  OWNER_NOT_FOUND: true,
  USER_NOT_FOUND: true,
};

function toUserReviewRow(r: ImportedUserRow) {
  const { _row, _outcome, _message, employeeStatus, ...rest } = r;
  void _row; void _outcome; void _message;
  return { ...rest, status: employeeStatus };
}

const roleContext = () => ({
  existingRoleNames: getExistingRoleNames(),
  systemRoleNames: getSystemRoleNamesLower(),
  existingUserEmails: getCurrentUserEmails(),
  existingUserNames: new Set(users.map((u) => u.fullName.trim().toLowerCase())),
});

describe("Users June seed", () => {
  const seed = buildUsersJuneSeed();
  const result = validateRows(seed.records.map(toUserReviewRow), {
    existingEmails: getCurrentUserEmails(),
    knownRoles: getCurrentRoleNames(),
  });
  const issues = result.rows.flatMap((r) => r.issues);
  const has = (code: IssueCode, field: string, text?: string) =>
    issues.some((i) => i.code === code && i.field === field && (!text || i.message.includes(text)));

  it("trips every Users rule", () => {
    for (const code of Object.keys(USER_CODES) as IssueCode[]) {
      expect(issues.some((i) => i.code === code), code).toBe(true);
    }
  });

  it("trips every branch of each rule", () => {
    expect(has("REQUIRED_EMPTY", "emailAddress")).toBe(true);
    expect(has("REQUIRED_EMPTY", "firstName")).toBe(true);
    expect(has("REQUIRED_EMPTY", "lastName")).toBe(true);
    expect(has("INVALID_EMAIL", "emailAddress")).toBe(true);
    expect(issues.filter((i) => i.code === "DUPLICATE_EMAIL")).toHaveLength(2);
    expect(has("MISSING_LICENSE", "licenseType")).toBe(true);
    expect(has("INVALID_DROPDOWN", "licenseType", '"Admin"')).toBe(true);
    expect(has("ROLE_NOT_FOUND", "assignedRoles", "Role \"Night Shift Lead\" doesn't")).toBe(true);
    expect(has("ROLE_NOT_FOUND", "assignedRoles", '"Yard Marshal" and "Dock Captain"')).toBe(true);
    expect(has("ROLE_NOT_FOUND", "assignedRoles", "and 1 more")).toBe(true);
    expect(has("INVALID_PHONE", "mobile")).toBe(true);
    expect(has("INVALID_PHONE", "workPhone")).toBe(true);
  });

  it("fails exactly the rows stored as failed, and includes an update row", () => {
    seed.records.forEach((r, i) => {
      const errors = result.rows[i].issues.filter((x) => x.severity === "error");
      if (r._outcome === "Created") expect(errors, `row ${r._row}`).toHaveLength(0);
      else {
        expect(errors.length, `row ${r._row}`).toBeGreaterThan(0);
        expect(r._message).toBe(errors.map((e) => e.message).join(" "));
      }
    });
    expect(result.rows.some((r) => r.isUpdate)).toBe(true);
    expect(seed.records.some((r) => r._outcome === "Skipped")).toBe(true);
  });

  it("history counts match the rows", () => {
    const imported = seed.records.filter((r) => r._outcome === "Created").length;
    expect(seed.entry.recordCount).toBe(seed.records.length);
    expect(seed.entry.importedCount).toBe(imported);
    expect(seed.entry.failedCount).toBe(seed.records.length - imported);
    expect(seed.entry.failedCount).toBeGreaterThan(0);
  });
});

describe("Roles seeds", () => {
  const seeds = buildRolesSeeds();
  const june = seeds.find((s) => s.entry.id === "imp-roles-3")!;
  const validate = (rows: typeof june.records) =>
    validateRoleRows(
      rows.map((r) => ({ roleName: r.roleName, description: r.description, roleOwner: r.roleOwner, assignedUsers: r.assignedUsers })),
      roleContext(),
    );
  const result = validate(june.records);
  const issues = result.rows.flatMap((r) => r.issues);

  it("trips every Roles rule", () => {
    for (const code of Object.keys(ROLE_CODES) as RoleIssueCode[]) {
      expect(issues.some((i) => i.code === code), code).toBe(true);
    }
  });

  it("trips every branch of each rule", () => {
    expect(issues.filter((i) => i.code === "DUPLICATE_ROLE_NAME")).toHaveLength(2);
    expect(issues.filter((i) => i.code === "OWNER_NOT_FOUND").length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.code === "USER_NOT_FOUND" && i.message.startsWith("User \"pat.nguyen"))).toBe(true);
    expect(issues.some((i) => i.code === "USER_NOT_FOUND" && i.message.includes('" and "'))).toBe(true);
    expect(issues.some((i) => i.code === "USER_NOT_FOUND" && i.message.includes("and 1 more"))).toBe(true);
  });

  it("every seed fails exactly the rows stored as failed", () => {
    for (const seed of seeds) {
      const r = validate(seed.records);
      seed.records.forEach((row, i) => {
        const errors = r.rows[i].issues.filter((x) => x.severity === "error");
        if (row._outcome === "Created") expect(errors, `${seed.entry.id} row ${row._row}`).toHaveLength(0);
        else expect(errors.length, `${seed.entry.id} row ${row._row}`).toBeGreaterThan(0);
      });
      const imported = seed.records.filter((x) => x._outcome === "Created").length;
      expect(seed.entry.recordCount).toBe(seed.records.length);
      expect(seed.entry.importedCount).toBe(imported);
      expect(seed.entry.failedCount).toBe(seed.records.length - imported);
    }
    expect(june.entry.failedCount).toBeGreaterThan(0);
    expect(result.rows.some((r) => r.isUpdate)).toBe(true);
  });
});

describe("ensureSeededForLoad", () => {
  it("lays down the UAC seeds into the stores the record pages read", () => {
    ensureSeededForLoad("users");
    ensureSeededForLoad("roles");
    ensureSeededForLoad("cycle-count");
    expect(getCompletedImports("users").map((e) => e.id).sort()).toEqual(["imp-users-1", "imp-users-2", "imp-users-3"]);
    expect(getCompletedImports("roles").map((e) => e.id).sort()).toEqual(["imp-roles-1", "imp-roles-2", "imp-roles-3"]);
    expect(getCompletedImports("cycle-count").map((e) => e.id).sort()).toEqual(["imp-cycle-count-1", "imp-cycle-count-2"]);
    expect(getImportDetail("imp-users-3")?.records).toHaveLength(15);
    for (const id of ["imp-roles-1", "imp-roles-2", "imp-roles-3"]) {
      expect(getRolesImportDetail(id)?.records.length, id).toBeGreaterThan(0);
    }
    /* Once per load: a second call does not duplicate anything. */
    ensureSeededForLoad("users");
    expect(getCompletedImports("users")).toHaveLength(3);
  });
});
