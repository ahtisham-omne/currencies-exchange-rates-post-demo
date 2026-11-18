/* ─── Onboarding hand-off: people invited during tenant onboarding ───
 *
 * Omne Home (a separate prototype) runs tenant onboarding, and one of its
 * steps invites the team. Those people have to be here, in the Users listing
 * as Invite Sent, and the person who ran setup, who is already in, as Active
 * (tenant onboarding review, Fatima, Nov 10 2026: the owner who sets up their
 * own company arrives as Account Owner, a delegate as Super Administrator).
 * The apps live on different domains, so Home sends them in
 * the address fragment of every link into this app:
 *
 *   #onboarding=<base64url of UTF-8 JSON, shaped as `OnboardingHandoff`>
 *
 * (omne-home src/components/omne/uacHandoff.ts writes it; the test decodes a
 * payload made there, so change both or neither.)
 *
 * Read once, in main.tsx before the rest of the app loads, so every surface
 * sees the people from the start. Each one is added the way Create User's
 * "Create and Send Invite" adds a user (unshifted into `users`, status Invite
 * Sent) and given their roles through `addUserToRole`, so user detail, quick
 * view and role counts agree with the listing. Rows added the import way (the
 * `importedUsers` overlay) would not open: user detail only reads `users`.
 *
 * A payload that carries the company (every one sent after an onboarding has
 * run, since Fatima's review of Nov 10 2026) opens UAC as that company rather
 * than the Omnesoft sample: the sample users and the sample's custom roles go,
 * only the people setup created are listed, the person using Home is the one
 * signed in, and the company's legal name stands where the sample's did. See
 * `openAsNewCompany`. An older payload, without the company, still just adds
 * its people to the sample.
 *
 * The payload is kept in localStorage, so a refresh or a later visit without
 * the fragment still shows them, and the fragment is cleared from the address.
 * A new payload replaces the kept one outright: Home always sends who its last
 * onboarding invited, an empty list included, so a re-run never piles rows
 * up. Anything malformed is ignored and the app loads as if none had come. */
import { users, type LicenseType, type UserRow } from "./users-data";
import { roleNameToOptionId, roles, scopeEligibleRoles } from "./roles-data";
import { addUserToRole, clearDirectory, getRoleIdsForUser, roleIdsToNames } from "./uac-derived";
import { setUserOverrides } from "./user-detail-data";
import { getPermissionsForRoles, ROLE_PERMISSION_MAP } from "./role-permissions-map";
import { PERMISSION_MODULES } from "./permissions-data";
import { recountInsights } from "./insights-data";
import { setMyPermissionModuleIds, signInAs } from "./current-user";
import { openAsCompany } from "./tenant";
import { clearRoleManageScopes } from "./role-manage-scope-data";
import { userRequests } from "./user-requests-data";
import { mockNotifications } from "../components/notificationsData";

export const HANDOFF_KEY = "onboarding";
const STORAGE_KEY = "uac-onboarding-handoff-v1";
/* Generous for a five-step onboarding; caps what a tampered link can add. */
const MAX_PEOPLE = 50;

export interface OnboardingHandoffPerson {
  firstName: string;
  lastName: string;
  email: string;
  /** As set on the invite; empty means the generated one is used. */
  username: string;
  /** Role names, matched case-insensitively. Unknown names are skipped. */
  roles: string[];
  license: LicenseType;
  /** Missing means Invite Sent; the setup person comes as Active. */
  status?: "Active" | "Invite Sent";
}

/** General Settings' company profile as setup saved it. UAC reads only the
 *  legal name; the rest travels for General Settings, which takes the same
 *  payload. */
export interface HandoffCompany {
  legalName: string;
  businessAddress: string;
  website: string;
  industry: string;
  companySize: string;
  annualRevenue: string;
  primaryEmail: string;
  countryCode: string;
  phoneNumber: string;
  legalRegistrationCountry: string;
  legalRegistrationState: string;
  legalStructure: string;
  /** An ISO day, YYYY-MM-DD, or empty. */
  dateOfRegistration: string;
  owner: {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    countryCode: string;
    phoneNumber: string;
  };
}

export interface OnboardingHandoff {
  v: 1;
  /** The onboarding run on Home's side; null when none has run there. */
  run: number | null;
  /** Who sent the invites. */
  by: string;
  /** YYYY-MM-DD, the day they went out. */
  on: string;
  people: OnboardingHandoffPerson[];
  /** The company as setup saved it. Sent whenever an onboarding has run;
   *  with it, UAC opens as this company (see `openAsNewCompany`). */
  company?: HandoffCompany;
  /** The email of whoever is signed in on Home: always one of `people`. */
  me?: string;
}

const LICENSES: ReadonlySet<string> = new Set<LicenseType>(["Full Access", "Field User", "No License"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const isString = (v: unknown): v is string => typeof v === "string";
/** A string field, trimmed; anything else reads as empty. */
const text = (v: unknown): string => (isString(v) ? v.trim() : "");

function parsePerson(raw: unknown): OnboardingHandoffPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!isString(p.firstName) || !isString(p.lastName) || !isString(p.email)) return null;
  const email = p.email.trim();
  if (!EMAIL.test(email) || !p.firstName.trim()) return null;
  if (!isString(p.license) || !LICENSES.has(p.license)) return null;
  return {
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email,
    username: isString(p.username) ? p.username.trim() : "",
    roles: Array.isArray(p.roles) ? p.roles.filter(isString) : [],
    license: p.license as LicenseType,
    /* Only carried when sent, so an older payload decodes exactly as before. */
    ...(p.status === "Active" || p.status === "Invite Sent" ? { status: p.status } : {}),
  };
}

/** The company, or null when there is no object to read. A field that is
 *  missing or not text reads as empty, as an unfilled field does on Home. */
function parseCompany(raw: unknown): HandoffCompany | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const o = (c.owner && typeof c.owner === "object" ? c.owner : {}) as Record<string, unknown>;
  return {
    legalName: text(c.legalName),
    businessAddress: text(c.businessAddress),
    website: text(c.website),
    industry: text(c.industry),
    companySize: text(c.companySize),
    annualRevenue: text(c.annualRevenue),
    primaryEmail: text(c.primaryEmail),
    countryCode: text(c.countryCode),
    phoneNumber: text(c.phoneNumber),
    legalRegistrationCountry: text(c.legalRegistrationCountry),
    legalRegistrationState: text(c.legalRegistrationState),
    legalStructure: text(c.legalStructure),
    dateOfRegistration: text(c.dateOfRegistration),
    owner: {
      firstName: text(o.firstName),
      middleName: text(o.middleName),
      lastName: text(o.lastName),
      email: text(o.email),
      countryCode: text(o.countryCode),
      phoneNumber: text(o.phoneNumber),
    },
  };
}

/** The payload, or null when it isn't one this version understands. A person
 *  that doesn't parse is dropped; the rest still come through. */
export function decodeHandoff(encoded: string): OnboardingHandoff | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!raw || raw.v !== 1 || !Array.isArray(raw.people)) return null;
    const company = parseCompany(raw.company);
    const me = text(raw.me);
    return {
      v: 1,
      run: typeof raw.run === "number" ? raw.run : null,
      by: isString(raw.by) ? raw.by.trim() : "",
      on: isString(raw.on) ? raw.on : "",
      people: raw.people
        .slice(0, MAX_PEOPLE)
        .map(parsePerson)
        .filter((p): p is OnboardingHandoffPerson => p !== null),
      /* Only carried when sent, so an older payload decodes exactly as before. */
      ...(company ? { company } : {}),
      ...(me ? { me } : {}),
    };
  } catch {
    return null;
  }
}

/** The encoded payload in a location hash ("#onboarding=…"), if any. */
export function handoffFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(HANDOFF_KEY);
}

/** The company UAC should open as: the payload's, when an onboarding has run.
 *  Null leaves the sample company in place. */
export function handoffCompany(handoff: OnboardingHandoff): HandoffCompany | null {
  return handoff.run !== null && handoff.company ? handoff.company : null;
}

/* YYYY-MM-DD → MM/DD/YYYY, the listing's date form. Falls back to today. */
function listingDate(on: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(on);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** Add the payload's people to `users`, as Invite Sent unless marked Active,
 *  in the payload's order at the top of the listing. Skips anyone whose email
 *  is already a user. Ids start at `firstId`, by default just past the highest
 *  in use. Returns the ids added. */
export function seedInvitedUsers(
  handoff: OnboardingHandoff,
  firstId: number = Math.max(0, ...users.map((u) => u.id)) + 1,
): number[] {
  const taken = new Set(users.map((u) => u.email.trim().toLowerCase()));
  const invitedOn = listingDate(handoff.on);
  const invitedBy = handoff.by || "Account Owner";
  let nextId = firstId;

  const added: { row: UserRow; roleIds: number[]; username: string }[] = [];
  for (const person of handoff.people) {
    const key = person.email.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    const active = person.status === "Active";
    added.push({
      row: {
        id: nextId++,
        fullName: `${person.firstName} ${person.lastName}`.trim(),
        assignedRoles: [],
        license: person.license,
        email: person.email,
        phone: "",
        /* The setup person signed in to run setup, the day it ran. */
        lastLogon: active ? invitedOn : "-",
        status: active ? "Active" : "Invite Sent",
        invitedBy,
        invitedOn,
        inviteAcceptedOn: active ? invitedOn : "-",
        createdBy: invitedBy,
      },
      roleIds: person.roles
        .map((name) => roles.find((r) => r.roleName.toLowerCase() === name.trim().toLowerCase())?.id)
        .filter((id): id is number => id != null),
      username: person.username,
    });
  }

  users.unshift(...added.map((a) => a.row));
  for (const { row, roleIds, username } of added) {
    roleIds.forEach((roleId) => addUserToRole(row.id, roleId));
    /* As Create User does: a field nobody filled is "" (a dash on the
     * detail page), not the generated "Team Member". */
    setUserOverrides(row.id, { jobTitle: "", ...(username ? { username } : {}) });
  }
  return added.map((a) => a.row.id);
}

/* A new company has made no roles of its own, so the sample's custom roles
 * (Compliance Auditor, Senior Buyer, …) go, from the listing, from the scope
 * pickers and from the permission bundles the Permissions tab counts. The
 * predefined roles all stay. */
function keepOnlyPredefinedRoles(): void {
  for (let i = roles.length - 1; i >= 0; i--) {
    const role = roles[i];
    if (role.isSystem) continue;
    roles.splice(i, 1);
    delete ROLE_PERMISSION_MAP[roleNameToOptionId(role.roleName)];
  }
  for (let i = scopeEligibleRoles.length - 1; i >= 0; i--) {
    if (!scopeEligibleRoles[i].isSystem) scopeEligibleRoles.splice(i, 1);
  }
}

/** Open UAC as the company onboarding set up, in place of the Omnesoft
 *  sample (Fatima's review, Nov 10 2026: "UAC opens as FR Conversions with
 *  only the users setup created"):
 *   · the directory holds only the payload's people, each mapped exactly as
 *     `seedInvitedUsers` maps them;
 *   · the person signed in is the one whose email is `me`, else the first
 *     Active person, else the first person, with their first role as the
 *     line under their name;
 *   · the company's legal name replaces the sample's (see tenant.ts);
 *   · the sample's custom roles go, and the Insights cards are counted from
 *     this company's own users and roles;
 *   · nothing the sample company built up comes along: no permission
 *     requests, notifications or seeded Manage Roles scopes, and, read
 *     through `isNewTenant`/`sampleOnly` where they are shown, no notes,
 *     attachments, tags, activity, import history or made-up usage figures
 *     (the user, after Fatima's review: "you are starting fresh so you'll see
 *     the users you added").
 *  Returns the ids added. */
export function openAsNewCompany(handoff: OnboardingHandoff, company: HandoffCompany): number[] {
  /* Past every sample id, so nothing seeded for a sample user (a photo, a
   * profile, open tasks) lands on one of these people. */
  const firstId = Math.max(0, ...users.map((u) => u.id)) + 1;
  clearDirectory();
  keepOnlyPredefinedRoles();
  const added = seedInvitedUsers(handoff, firstId);

  const rows = added
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserRow => u !== undefined);
  const me = handoff.me?.toLowerCase();
  const signedIn =
    rows.find((u) => u.email.toLowerCase() === me) ??
    rows.find((u) => u.status === "Active") ??
    rows[0];
  const roleNames = signedIn ? roleIdsToNames(getRoleIdsForUser(signedIn.id)) : [];
  if (signedIn) {
    signInAs({
      id: signedIn.id,
      name: signedIn.fullName,
      email: signedIn.email,
      jobTitle: roleNames[0] ?? "",
      phone: signedIn.phone,
      license: signedIn.license,
    });
  }
  /* Me Mode on the Permissions tab: nothing is directly assigned or edited
   * yet, so "my" modules are the ones the signed-in person's roles reach. */
  const held = getPermissionsForRoles(roleNames.map(roleNameToOptionId));
  setMyPermissionModuleIds(
    PERMISSION_MODULES.filter((m) => m.permissions.some((p) => held.has(p.id))).map((m) => m.id),
  );

  /* What the sample company built up and a new one hasn't. */
  userRequests.length = 0;
  mockNotifications.length = 0;
  clearRoleManageScopes();

  openAsCompany(company.legalName);
  recountInsights(users, roles);
  return added;
}

/** Apply a decoded payload: as a new company when it carries one, otherwise
 *  by adding its people to the sample. Returns the ids added. */
function applyHandoff(handoff: OnboardingHandoff): number[] {
  const company = handoffCompany(handoff);
  return company ? openAsNewCompany(handoff, company) : seedInvitedUsers(handoff);
}

/** Boot step, called once before the first render. Takes a payload from the
 *  address (keeping it and clearing the address), otherwise the kept one, and
 *  applies it. A payload that arrives later, while the app is open, is an
 *  address that changed only in its fragment, which the browser doesn't
 *  reload for; reloading is what lets this step read it. */
export function applyOnboardingHandoff(): number[] {
  if (typeof window === "undefined") return [];

  window.addEventListener("hashchange", () => {
    if (handoffFromHash(window.location.hash) !== null) window.location.reload();
  });

  const fromHash = handoffFromHash(window.location.hash);
  if (fromHash !== null) {
    const fresh = decodeHandoff(fromHash);
    if (fresh) {
      try {
        if (fresh.people.length > 0 || handoffCompany(fresh)) localStorage.setItem(STORAGE_KEY, fromHash);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable: this visit still shows them */
      }
    }
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (fresh) return applyHandoff(fresh);
  }

  let kept: string | null = null;
  try {
    kept = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  const handoff = kept ? decodeHandoff(kept) : null;
  return handoff ? applyHandoff(handoff) : [];
}
