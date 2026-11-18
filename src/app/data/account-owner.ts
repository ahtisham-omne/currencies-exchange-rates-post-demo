/* ─── Account Owner rules (decided October 1, 2026) ───
 *
 * Source: UAC Spec, Roles, Section 11
 * (https://docs.omnesoft.com/doc/6-roles-PJRaRfu6j4). The rules apply to every
 * holder of the Account Owner role, not only the last one:
 *
 *   1. More than one Account Owner is allowed; the role always keeps one.
 *   2. Name, username, primary email and phone change only by the owner.
 *   3. Permissions are locked for everyone, the owner included.
 *   4. Only the owner lowers or removes their own license, even as the only
 *      holder. They keep the role, but it does not take effect until they
 *      hold Full Access again (Eli, Oct 6; ERP-5184 and ERP-5186 AC8).
 *   5. Only the owner leaves the role, and never as the last holder.
 *   6. No other user can deactivate, archive, or lock an owner out.
 *
 * Who holds the role is set outside the tenant: onboarding captures the first
 * owner, and after that only Omne changes who it is (Fatima, Oct 5). Nobody
 * in the tenant can assign the role: the Assign Roles step shows its card
 * disabled (ERP-5154 AC12), and every other picker leaves it out.
 *
 * An owner can't change their own status while they hold the role either, a
 * gap the tickets left open that was filled with the product side (Oct 5).
 * Editing themselves, an owner changes every field but their primary email,
 * which moves from General Settings (ERP-5163 AC10).
 *
 * Every surface that acts on a user asks `getAccountOwnerRules` (or the hook)
 * rather than re-deriving any of this, so the copy stays in one place too. */
import { getUsersForRole, USER_ROLE_IDS } from "./uac-derived";
import { getViewerId, useViewerId } from "./viewer";

export const ACCOUNT_OWNER_ROLE_ID = 1;

export const ACCOUNT_OWNER_COPY = {
  /** Status chip, someone else viewing. */
  otherStatus: "An Account Owner's status can't be changed by another user.",
  /** Deactivate / Archive items, someone else viewing. */
  otherLifecycle:
    "An Account Owner can't be deactivated, archived, or locked out by another user.",
  /** Status chip and Deactivate / Archive, the owner viewing themselves. */
  selfStatus:
    "You can't deactivate or archive yourself while you hold the Account Owner role. Leave the role first.",
  /** Status chip while the listing is in bulk mode. */
  bulkStatus:
    "Left out of bulk status changes. An Account Owner's status can't be changed by another user.",
  otherLicense: "Only the Account Owner can lower or remove their own license.",
  /** The step before an owner lowers or removes their own license. */
  selfLicenseTitle: "Lower your own license?",
  selfLicenseBody:
    "You keep the Account Owner role, but it doesn't take effect until you hold Full Access again.",
  lockedField: "Only the Account Owner can change their own details.",
  /** Primary email in Edit User, the owner editing themselves. */
  selfPrimaryEmail: "You change your primary email from General Settings.",
  otherRemoveRole: "Only the Account Owner can remove themselves from this role.",
  selfLastRemoveRole:
    "You're the only Account Owner. The role must always keep at least one holder.",
  /** The warning before an owner removes the role from themselves (ERP-7648 AC6). */
  selfRemoveTitle: "Remove yourself as Account Owner?",
  selfRemoveBody:
    "You'll lose owner access. Only Omne can make you an Account Owner again, you can't add yourself back.",
  selfRemoveConfirm: "Remove myself",
  permissionsFixed:
    "Account Owner access is fixed. This role holds every permission, and none can be added or removed.",
  /** Role summary (ERP-5506 AC11): what the role holds… */
  summaryAccess:
    "Every permission in every module, including Delete MFA Policy, and it always inherits future permissions.",
  /** …and how it is protected. */
  summaryProtection: [
    "The role can have more than one holder and always keeps at least one.",
    "Its permissions are locked for everyone, holders included.",
    "No other user can deactivate, archive, or lock out an Account Owner, change their name, username, primary email, or phone, lower or remove their license, or remove them from the role.",
    "Only Omne can make a user an Account Owner.",
  ],
  /** Assigning the role to anyone, from the role's Users tab (ERP-5510 AC16). */
  assignRole: "Only Omne can change who the Account Owner is.",
  /** The disabled Account Owner card in the Assign Roles step (ERP-5154 AC12). */
  assignRoleCard: "Only Omne can make a user an Account Owner.",
  /** Shield badge next to an owner's name. */
  badge:
    "Account Owner. Only they can change their name, username, primary email, phone, license, or role, and no other user can deactivate, archive, or lock them out.",
} as const;

export interface Verdict {
  allowed: boolean;
  /** Why it's blocked; empty when allowed. */
  reason: string;
}

export interface AccountOwnerRules {
  isOwner: boolean;
  /** The signed-in viewer is this user. */
  isSelf: boolean;
  /** This user is the only holder of the Account Owner role. */
  isLastHolder: boolean;
  /** Status chip changes. */
  status: Verdict;
  /** Deactivate and Archive menu items. */
  lifecycle: Verdict;
  /** Downgrade to Field User, change to No License, Remove License. */
  lowerLicense: Verdict;
  /** Name, username, primary email and phone in Edit User. */
  lockedFields: Verdict;
  /** Primary email in Edit User. Locked for other users with the rest, and for
   *  the owner editing themselves, who changes it from General Settings. */
  primaryEmail: Verdict;
  /** Removing the Account Owner role itself from this user. */
  removeOwnerRole: Verdict;
  /** Direct permission changes. */
  permissions: Verdict;
}

const ALLOWED: Verdict = { allowed: true, reason: "" };
const blocked = (reason: string): Verdict => ({ allowed: false, reason });

export function isAccountOwner(userId: number): boolean {
  return (USER_ROLE_IDS[userId] ?? []).includes(ACCOUNT_OWNER_ROLE_ID);
}

export function getAccountOwnerIds(): number[] {
  return getUsersForRole(ACCOUNT_OWNER_ROLE_ID).map((u) => u.id);
}

const NOT_OWNER: Omit<AccountOwnerRules, "isSelf"> = {
  isOwner: false,
  isLastHolder: false,
  status: ALLOWED,
  lifecycle: ALLOWED,
  lowerLicense: ALLOWED,
  lockedFields: ALLOWED,
  primaryEmail: ALLOWED,
  removeOwnerRole: ALLOWED,
  permissions: ALLOWED,
};

export function getAccountOwnerRules(
  userId: number,
  viewerId: number = getViewerId(),
): AccountOwnerRules {
  const isSelf = userId === viewerId;
  if (!isAccountOwner(userId)) return { ...NOT_OWNER, isSelf };

  const isLastHolder = getAccountOwnerIds().length <= 1;
  const c = ACCOUNT_OWNER_COPY;
  const permissions = blocked(c.permissionsFixed);

  if (!isSelf) {
    return {
      isOwner: true,
      isSelf,
      isLastHolder,
      status: blocked(c.otherStatus),
      lifecycle: blocked(c.otherLifecycle),
      lowerLicense: blocked(c.otherLicense),
      lockedFields: blocked(c.lockedField),
      primaryEmail: blocked(c.lockedField),
      removeOwnerRole: blocked(c.otherRemoveRole),
      permissions,
    };
  }

  return {
    isOwner: true,
    isSelf,
    isLastHolder,
    status: blocked(c.selfStatus),
    lifecycle: blocked(c.selfStatus),
    lowerLicense: ALLOWED,
    lockedFields: ALLOWED,
    primaryEmail: blocked(c.selfPrimaryEmail),
    removeOwnerRole: isLastHolder ? blocked(c.selfLastRemoveRole) : ALLOWED,
    permissions,
  };
}

/** {@link getAccountOwnerRules} for the signed-in viewer, re-evaluated when
 *  the viewer changes. */
export function useAccountOwnerRules(userId: number): AccountOwnerRules {
  const viewerId = useViewerId();
  return getAccountOwnerRules(userId, viewerId);
}
