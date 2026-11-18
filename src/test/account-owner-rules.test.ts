import { afterEach, describe, expect, it } from "vitest";
import {
  ACCOUNT_OWNER_COPY,
  getAccountOwnerIds,
  getAccountOwnerRules,
  isAccountOwner,
} from "@/app/data/account-owner";
import { CURRENT_USER } from "@/app/data/current-user";
import { USER_ROLE_IDS } from "@/app/data/uac-derived";
import { applyLicenseDowngrade } from "@/app/data/user-assignments-data";
import {
  ASSIGN_STEP_ROLES,
  AVAILABLE_ROLES,
  isLockedRoleOption,
} from "@/app/components/create-user/types";

/* Account Owner rules, UAC Spec, Roles, Section 11 (decided October 1, 2026).
 * Seed: Eli Rosenbloom (4) and Nophil Anwer (5) both hold Account Owner. */
const ELI = 4;
const NOPHIL = 5;
const NON_OWNER = 1; // Ahtisham Ahmad, a Super Administrator
const ADMIN = CURRENT_USER.id;

describe("Account Owner rules", () => {
  const nophilRoles = [...(USER_ROLE_IDS[NOPHIL] ?? [])];
  afterEach(() => {
    USER_ROLE_IDS[NOPHIL] = [...nophilRoles];
  });

  it("seeds two holders", () => {
    expect(getAccountOwnerIds()).toEqual([ELI, NOPHIL]);
    expect(isAccountOwner(NON_OWNER)).toBe(false);
  });

  it("leaves a user who is not an owner unrestricted", () => {
    const r = getAccountOwnerRules(NON_OWNER, ADMIN);
    expect(r.isOwner).toBe(false);
    for (const v of [r.status, r.lifecycle, r.lowerLicense, r.lockedFields, r.primaryEmail, r.removeOwnerRole, r.permissions]) {
      expect(v.allowed).toBe(true);
    }
  });

  it("blocks every protected action for another user, even with two holders", () => {
    const r = getAccountOwnerRules(ELI, ADMIN);
    expect(r).toMatchObject({ isOwner: true, isSelf: false, isLastHolder: false });
    expect(r.status.reason).toBe(ACCOUNT_OWNER_COPY.otherStatus);
    expect(r.lifecycle.reason).toBe(ACCOUNT_OWNER_COPY.otherLifecycle);
    expect(r.lowerLicense.reason).toBe(ACCOUNT_OWNER_COPY.otherLicense);
    expect(r.lockedFields.reason).toBe(ACCOUNT_OWNER_COPY.lockedField);
    expect(r.primaryEmail.reason).toBe(ACCOUNT_OWNER_COPY.lockedField);
    expect(r.removeOwnerRole.reason).toBe(ACCOUNT_OWNER_COPY.otherRemoveRole);
    expect(r.permissions.allowed).toBe(false);
  });

  it("treats another Account Owner as another user", () => {
    const r = getAccountOwnerRules(ELI, NOPHIL);
    expect(r.isSelf).toBe(false);
    expect(r.lockedFields.allowed).toBe(false);
    expect(r.removeOwnerRole.allowed).toBe(false);
  });

  it("lets an owner edit their details, lower their license and leave the role while another holder remains", () => {
    const r = getAccountOwnerRules(ELI, ELI);
    expect(r.isSelf).toBe(true);
    expect(r.lockedFields.allowed).toBe(true);
    expect(r.lowerLicense.allowed).toBe(true);
    expect(r.removeOwnerRole.allowed).toBe(true);
    // Their own primary email moves from General Settings (ERP-5163 AC10).
    expect(r.primaryEmail.reason).toBe(ACCOUNT_OWNER_COPY.selfPrimaryEmail);
    // Status stays locked for the owner too, and permissions are fixed.
    expect(r.status.reason).toBe(ACCOUNT_OWNER_COPY.selfStatus);
    expect(r.lifecycle.reason).toBe(ACCOUNT_OWNER_COPY.selfStatus);
    expect(r.permissions.reason).toBe(ACCOUNT_OWNER_COPY.permissionsFixed);
  });

  it("lets the last holder lower their license but not leave the role", () => {
    USER_ROLE_IDS[NOPHIL] = nophilRoles.filter((id) => id !== 1);
    const r = getAccountOwnerRules(ELI, ELI);
    expect(r.isLastHolder).toBe(true);
    expect(r.lockedFields.allowed).toBe(true);
    // Eli, Oct 6 (ERP-5184 and ERP-5186 AC8): the only owner can lower or
    // remove their own license; the role stays and resumes at Full Access.
    expect(r.lowerLicense.allowed).toBe(true);
    expect(r.removeOwnerRole.reason).toBe(ACCOUNT_OWNER_COPY.selfLastRemoveRole);
  });

  it("keeps the Account Owner role when its holder downgrades", () => {
    applyLicenseDowngrade(NOPHIL);
    expect(USER_ROLE_IDS[NOPHIL]).toContain(1);
  });

  it("shows the Account Owner card locked in the Assign Roles step, and nowhere pickable", () => {
    const owner = ASSIGN_STEP_ROLES.find((r) => r.name === "Account Owner");
    expect(owner?.isProtected).toBe(true);
    expect(isLockedRoleOption(owner!.id)).toBe(true);
    expect(AVAILABLE_ROLES.some((r) => r.name === "Account Owner")).toBe(false);
    expect(AVAILABLE_ROLES.some((r) => r.name === "Super Administrator")).toBe(true);
  });
});
