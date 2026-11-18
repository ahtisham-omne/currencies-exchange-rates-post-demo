/* ─── Logged-in user (single source of truth for "me") ───
 *
 * The prototype has no auth layer, it pretends Abdullah Malik is logged in
 * everywhere (matches the avatar/name rendered in Header.tsx). Any code that
 * needs to know "is this the current user?" should import from here so we have
 * one place to swap it later. */
export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  /** Profile fields, so the hover summary card can render for "me" too. The
   *  logged-in user is not a row in `users-data`, so nothing else can supply
   *  them. Values match the `am` entry in `data-imports/importers.ts`, which
   *  described the same person before this was the single source of truth. */
  jobTitle: string;
  phone: string;
  license: "Full Access" | "Field User" | "No License";
}

export const CURRENT_USER: CurrentUser = {
  id: 1001,
  name: "Abdullah Malik",
  email: "amalik@omnesoft.com",
  jobTitle: "Team Member",
  phone: "+1 555-0100",
  /* Not sourced from anywhere: the logged-in user has no directory row, and
   *  the prototype's admin persona is a Full Access seat. */
  license: "Full Access",
};

/** Sign in as someone else, once, before the first render. Omne Home's
 *  onboarding hand-off uses it to open UAC as the person who ran setup (see
 *  onboarding-handoff.ts). It writes into CURRENT_USER rather than replacing
 *  it, so every module that imported it, `isMe` included, sees the new person
 *  with no second source of truth. */
export function signInAs(profile: CurrentUser): void {
  Object.assign(CURRENT_USER, profile);
}

/** True when the given name/id refers to the logged-in user. Accepts either
 *  the user's display name (most mock data uses names) or their numeric id. */
export function isMe(value: string | number | null | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "number") return value === CURRENT_USER.id;
  return value.trim().toLowerCase() === CURRENT_USER.name.toLowerCase();
}

/**
 * Permission module IDs that the logged-in user is associated with, i.e. any
 * of: they have a permission in this module assigned directly, they hold a
 * permission in it via one of their roles, or they were the last person to
 * edit something in this module. Seeded statically for the prototype so the
 * permissions Me Mode chip has 5+ results to show.
 *
 * Mirrors the IDs declared in `permissions-data.ts`. Keep in sync if module
 * IDs are renamed.
 */
const myPermissionModuleIds = new Set([
  "item-library",        // directly assigned (manage)
  "purchase-orders",     // inherited via Project Manager role
  "users-roles",         // last edited by me
  "warehouse-locations", // directly assigned
  "quotes",              // inherited via role
  "sales-orders",        // last edited by me
]);
export const MY_PERMISSION_MODULE_IDS: ReadonlySet<string> = myPermissionModuleIds;

/** Replace the set above, once, before the first render. Onboarding's
 *  hand-off uses it for a new company, where nothing has been edited yet and
 *  the signed-in person's modules are the ones their roles reach. */
export function setMyPermissionModuleIds(ids: Iterable<string>): void {
  myPermissionModuleIds.clear();
  for (const id of ids) myPermissionModuleIds.add(id);
}
