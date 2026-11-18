/* Guards the hand-off from Omne Home's onboarding (see onboarding-handoff.ts).
 *
 * GOLDEN was produced by omne-home's own encoder (src/components/omne/
 * uacHandoff.ts, encodeUacHandoff) for the payload in GOLDEN_DECODED, accents
 * included, so the two sides are pinned to one format: if either changes it,
 * this fails. Each boot test re-imports the data modules, since seeding writes
 * into the module-level users list exactly as a page load would.
 *
 * Fails when the format drifts, when an invitee stops opening (user detail
 * can't find them), when a repeat visit or a re-run duplicates rows, or when a
 * damaged link stops being ignored. */
import { describe, it, expect, beforeEach, vi } from "vitest";

const GOLDEN =
  "eyJ2IjoxLCJydW4iOjE3OTMyNjA4MDAwMDAsImJ5IjoiRWxpIFJvc2VuYmxvb20iLCJvbiI6IjIwMjYtMTAtMjgiLCJwZW9wbGUiOlt7ImZpcnN0TmFtZSI6Ik1heWEiLCJsYXN0TmFtZSI6IlBhdGVsIiwiZW1haWwiOiJtYXlhLnBhdGVsQGZyY29udmVyc2lvbnMuY29tIiwidXNlcm5hbWUiOiJtYXlhLnBhdGVsIiwicm9sZXMiOlsiQnV5ZXIiLCJXYXJlaG91c2UgU3VwZXJ2aXNvciJdLCJsaWNlbnNlIjoiRnVsbCBBY2Nlc3MifSx7ImZpcnN0TmFtZSI6Ikpvc8OpIiwibGFzdE5hbWUiOiLDgWx2YXJlei1Ow7rDsWV6IiwiZW1haWwiOiJqb3NlLmFsdmFyZXpAZnJjb252ZXJzaW9ucy5jb20iLCJ1c2VybmFtZSI6IiIsInJvbGVzIjpbXSwibGljZW5zZSI6Ik5vIExpY2Vuc2UifV19";

const GOLDEN_DECODED = {
  v: 1,
  run: 1793260800000,
  by: "Eli Rosenbloom",
  on: "2026-10-28",
  people: [
    {
      firstName: "Maya",
      lastName: "Patel",
      email: "maya.patel@frconversions.com",
      username: "maya.patel",
      roles: ["Buyer", "Warehouse Supervisor"],
      license: "Full Access",
    },
    {
      firstName: "José",
      lastName: "Álvarez-Núñez",
      email: "jose.alvarez@frconversions.com",
      username: "",
      roles: [],
      license: "No License",
    },
  ],
};

/* A payload with the company and the signed-in email (omne-home's format since
 * Fatima's review, Nov 10 2026), as omne-home encoded it for FR Conversions:
 * Sam Carter is the delegate who ran setup (Super Administrator, Active, `me`),
 * Priya Shah the named Account Owner (Invite Sent), Marco Diaz a Buyer on No
 * License. The en dashes in the company size and revenue are UTF-8. */
const TENANT_GOLDEN =
  "eyJ2IjoxLCJydW4iOjE3OTQzMjY0MDAwMDAsImJ5IjoiU2FtIENhcnRlciIsIm9uIjoiMjAyNi0xMS0xMCIsInBlb3BsZSI6W3siZmlyc3ROYW1lIjoiU2FtIiwibGFzdE5hbWUiOiJDYXJ0ZXIiLCJlbWFpbCI6InNhbS5jYXJ0ZXJAZnJjb252ZXJzaW9ucy5jb20iLCJ1c2VybmFtZSI6InNhbS5jYXJ0ZXIiLCJyb2xlcyI6WyJTdXBlciBBZG1pbmlzdHJhdG9yIl0sImxpY2Vuc2UiOiJGdWxsIEFjY2VzcyIsInN0YXR1cyI6IkFjdGl2ZSJ9LHsiZmlyc3ROYW1lIjoiUHJpeWEiLCJsYXN0TmFtZSI6IlNoYWgiLCJlbWFpbCI6InByaXlhLnNoYWhAZnJjb252ZXJzaW9ucy5jb20iLCJ1c2VybmFtZSI6IiIsInJvbGVzIjpbIkFjY291bnQgT3duZXIiXSwibGljZW5zZSI6IkZ1bGwgQWNjZXNzIn0seyJmaXJzdE5hbWUiOiJNYXJjbyIsImxhc3ROYW1lIjoiRGlheiIsImVtYWlsIjoibWFyY28uZGlhekBmcmNvbnZlcnNpb25zLmNvbSIsInVzZXJuYW1lIjoibWFyY28uZGlheiIsInJvbGVzIjpbIkJ1eWVyIl0sImxpY2Vuc2UiOiJObyBMaWNlbnNlIn1dLCJjb21wYW55Ijp7ImxlZ2FsTmFtZSI6IkZSIENvbnZlcnNpb25zIExMQyIsImJ1c2luZXNzQWRkcmVzcyI6IjQ1NSBJbmR1c3RyaWFsIFdheSwgRGF5dG9uLCBPSCA0NTQwMiwgVVNBIiwid2Vic2l0ZSI6Imh0dHBzOi8vZnJjb252ZXJzaW9ucy5jb20iLCJpbmR1c3RyeSI6Ik1hbnVmYWN0dXJpbmciLCJjb21wYW55U2l6ZSI6IjUxIOKAkyAyMDAgZW1wbG95ZWVzIiwiYW5udWFsUmV2ZW51ZSI6IiQxME0g4oCTICQ1ME0iLCJwcmltYXJ5RW1haWwiOiJpbmZvQGZyY29udmVyc2lvbnMuY29tIiwiY291bnRyeUNvZGUiOiJVUyArMSIsInBob25lTnVtYmVyIjoiOTM3IDU1NSAwMTQyIiwibGVnYWxSZWdpc3RyYXRpb25Db3VudHJ5IjoiVW5pdGVkIFN0YXRlcyIsImxlZ2FsUmVnaXN0cmF0aW9uU3RhdGUiOiJPaGlvIiwibGVnYWxTdHJ1Y3R1cmUiOiJMTEMiLCJkYXRlT2ZSZWdpc3RyYXRpb24iOiIyMDExLTA2LTE0Iiwib3duZXIiOnsiZmlyc3ROYW1lIjoiUHJpeWEiLCJtaWRkbGVOYW1lIjoiIiwibGFzdE5hbWUiOiJTaGFoIiwiZW1haWwiOiJwcml5YS5zaGFoQGZyY29udmVyc2lvbnMuY29tIiwiY291bnRyeUNvZGUiOiJVUyArMSIsInBob25lTnVtYmVyIjoiOTM3IDU1NSAwMTg3In19LCJtZSI6InNhbS5jYXJ0ZXJAZnJjb252ZXJzaW9ucy5jb20ifQ";

const TENANT_DECODED = {
  v: 1,
  run: 1794326400000,
  by: "Sam Carter",
  on: "2026-11-10",
  people: [
    { firstName: "Sam", lastName: "Carter", email: "sam.carter@frconversions.com", username: "sam.carter", roles: ["Super Administrator"], license: "Full Access", status: "Active" },
    { firstName: "Priya", lastName: "Shah", email: "priya.shah@frconversions.com", username: "", roles: ["Account Owner"], license: "Full Access" },
    { firstName: "Marco", lastName: "Diaz", email: "marco.diaz@frconversions.com", username: "marco.diaz", roles: ["Buyer"], license: "No License" },
  ],
  company: {
    legalName: "FR Conversions LLC",
    businessAddress: "455 Industrial Way, Dayton, OH 45402, USA",
    website: "https://frconversions.com",
    industry: "Manufacturing",
    companySize: "51 – 200 employees",
    annualRevenue: "$10M – $50M",
    primaryEmail: "info@frconversions.com",
    countryCode: "US +1",
    phoneNumber: "937 555 0142",
    legalRegistrationCountry: "United States",
    legalRegistrationState: "Ohio",
    legalStructure: "LLC",
    dateOfRegistration: "2011-06-14",
    owner: { firstName: "Priya", middleName: "", lastName: "Shah", email: "priya.shah@frconversions.com", countryCode: "US +1", phoneNumber: "937 555 0187" },
  },
  me: "sam.carter@frconversions.com",
};

/** The same encoding omne-home uses, for payloads the tests make up. */
function encode(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const USERS_PATH = "/company-settings/user-access-control";

/** A fresh page load at `url`: new module instances, then the boot step, then
 *  the modules the app reads, as main.tsx loads the app after the hand-off. */
async function boot(url: string) {
  window.history.replaceState(null, "", url);
  vi.resetModules();
  const handoff = await import("../app/data/onboarding-handoff");
  const { users } = await import("../app/data/users-data");
  const { getUserDetail } = await import("../app/data/user-detail-data");
  const added = handoff.applyOnboardingHandoff();
  const { roles, scopeEligibleRoles } = await import("../app/data/roles-data");
  const { CURRENT_USER, isMe } = await import("../app/data/current-user");
  const { getViewerId, getViewerProfile } = await import("../app/data/viewer");
  const { getCompanyName, isNewTenant } = await import("../app/data/tenant");
  const { getAccountOwnerIds } = await import("../app/data/account-owner");
  const { USERS_INSIGHTS, ROLES_INSIGHTS } = await import("../app/data/insights-data");
  const insight = (id: string) =>
    [...USERS_INSIGHTS, ...ROLES_INSIGHTS].find((m) => m.id === id)?.value;
  return {
    added,
    users,
    getUserDetail,
    roles,
    scopeEligibleRoles,
    CURRENT_USER,
    isMe,
    viewer: () => getViewerProfile(getViewerId()),
    getCompanyName,
    isNewTenant,
    getAccountOwnerIds,
    insight,
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("decodeHandoff", () => {
  it("reads the payload omne-home writes, accents included", async () => {
    const { decodeHandoff } = await import("../app/data/onboarding-handoff");
    expect(decodeHandoff(GOLDEN)).toEqual(GOLDEN_DECODED);
  });

  it("reads the company and who is signed in, and an older payload has neither", async () => {
    const { decodeHandoff } = await import("../app/data/onboarding-handoff");
    expect(decodeHandoff(TENANT_GOLDEN)).toEqual(TENANT_DECODED);
    const old = decodeHandoff(GOLDEN);
    expect(old).not.toHaveProperty("company");
    expect(old).not.toHaveProperty("me");
  });

  it("rejects anything that isn't a version 1 payload", async () => {
    const { decodeHandoff } = await import("../app/data/onboarding-handoff");
    expect(decodeHandoff("not base64 at all!!")).toBeNull();
    expect(decodeHandoff(encode("just a string"))).toBeNull();
    expect(decodeHandoff(encode({ ...GOLDEN_DECODED, v: 2 }))).toBeNull();
    expect(decodeHandoff(encode({ ...GOLDEN_DECODED, people: "Maya" }))).toBeNull();
  });

  it("drops a person who doesn't parse and keeps the rest", async () => {
    const { decodeHandoff } = await import("../app/data/onboarding-handoff");
    const bad = [
      { firstName: "No", lastName: "Email", email: "not-an-email", roles: [], license: "Field User" },
      { firstName: "Bad", lastName: "License", email: "bad@x.com", roles: [], license: "Gold" },
      { firstName: "", lastName: "Nameless", email: "nameless@x.com", roles: [], license: "Field User" },
      null,
    ];
    const decoded = decodeHandoff(encode({ ...GOLDEN_DECODED, people: [...bad, GOLDEN_DECODED.people[0]] }));
    expect(decoded?.people.map((p) => p.email)).toEqual(["maya.patel@frconversions.com"]);
  });
});

describe("applyOnboardingHandoff", () => {
  it("adds the invitees at the top as Invite Sent, with their roles, and they open", async () => {
    const { added, users, getUserDetail } = await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    expect(added).toHaveLength(2);
    const [maya, jose] = users;
    expect(maya).toMatchObject({
      id: added[0],
      fullName: "Maya Patel",
      email: "maya.patel@frconversions.com",
      license: "Full Access",
      status: "Invite Sent",
      invitedBy: "Eli Rosenbloom",
      invitedOn: "10/28/2026",
      inviteAcceptedOn: "-",
      assignedRoles: ["buyer", "warehouse supervisor"],
    });
    expect(jose).toMatchObject({ id: added[1], fullName: "José Álvarez-Núñez", license: "No License", assignedRoles: [] });
    // Opens, with the invite's username and no made-up job title.
    expect(getUserDetail(maya.id)).toMatchObject({ username: "maya.patel", jobTitle: "" });
    // No username on the invite: UAC's own, from the email.
    expect(getUserDetail(jose.id)).toMatchObject({ username: "jose.alvarez", jobTitle: "" });
  });

  it("adds the person who ran setup as Active, in their role (Fatima, Nov 10 2026)", async () => {
    const withSetupPerson = encode({
      ...GOLDEN_DECODED,
      by: "Sara Lindqvist",
      people: [
        {
          firstName: "Sara",
          lastName: "Lindqvist",
          email: "sara.lindqvist@frconversions.com",
          username: "sara.lindqvist",
          roles: ["Super Administrator"],
          license: "Full Access",
          status: "Active",
        },
        GOLDEN_DECODED.people[0],
      ],
    });
    const { added, users, getUserDetail } = await boot(`${USERS_PATH}#onboarding=${withSetupPerson}`);
    expect(added).toHaveLength(2);
    const [sara, maya] = users;
    expect(sara).toMatchObject({
      id: added[0],
      fullName: "Sara Lindqvist",
      license: "Full Access",
      status: "Active",
      invitedOn: "10/28/2026",
      inviteAcceptedOn: "10/28/2026",
      assignedRoles: ["super administrator"],
    });
    expect(maya).toMatchObject({ fullName: "Maya Patel", status: "Invite Sent", inviteAcceptedOn: "-" });
    expect(getUserDetail(sara.id)).toMatchObject({ username: "sara.lindqvist" });
  });

  it("clears the fragment from the address and keeps the payload for later visits", async () => {
    await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe(USERS_PATH);

    const later = await boot(USERS_PATH);
    expect(later.added).toHaveLength(2);
    expect(later.users[0].fullName).toBe("Maya Patel");
  });

  it("follows the same link twice without duplicating anyone", async () => {
    await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    const again = await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    expect(again.users.filter((u) => u.email === "maya.patel@frconversions.com")).toHaveLength(1);
  });

  it("replaces the last run's people when onboarding runs again", async () => {
    await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    const rerun = encode({
      ...GOLDEN_DECODED,
      run: GOLDEN_DECODED.run + 1,
      people: [{ firstName: "Lena", lastName: "Kim", email: "lena.kim@frconversions.com", roles: ["Buyer"], license: "Field User" }],
    });
    await boot(`${USERS_PATH}#onboarding=${rerun}`);

    const later = await boot(USERS_PATH);
    const emails = later.users.map((u) => u.email);
    expect(emails).toContain("lena.kim@frconversions.com");
    expect(emails).not.toContain("maya.patel@frconversions.com");
  });

  it("clears the last run's people when onboarding invited nobody", async () => {
    await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    await boot(`${USERS_PATH}#onboarding=${encode({ ...GOLDEN_DECODED, people: [] })}`);
    const later = await boot(USERS_PATH);
    expect(later.added).toEqual([]);
    expect(later.users.map((u) => u.email)).not.toContain("maya.patel@frconversions.com");
  });

  it("ignores a damaged link and keeps what it already had", async () => {
    await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    const damaged = await boot(`${USERS_PATH}#onboarding=${GOLDEN.slice(0, 40)}`);
    expect(window.location.hash).toBe("");
    expect(damaged.users[0].fullName).toBe("Maya Patel");
  });

  it("skips anyone who is already a user", async () => {
    const { users: before } = await boot("/");
    const existing = before[5];
    const payload = encode({
      ...GOLDEN_DECODED,
      people: [
        { firstName: "Same", lastName: "Person", email: existing.email.toUpperCase(), roles: [], license: "Field User" },
        GOLDEN_DECODED.people[0],
        GOLDEN_DECODED.people[0],
      ],
    });
    const { added, users } = await boot(`${USERS_PATH}#onboarding=${payload}`);
    expect(added).toHaveLength(1);
    expect(users.filter((u) => u.email.toLowerCase() === existing.email.toLowerCase())).toHaveLength(1);
  });

  it("reloads when a hand-off arrives while the app is already open", async () => {
    const reload = vi.fn();
    const realLocation = window.location;
    await boot(USERS_PATH);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...realLocation, hash: `#onboarding=${GOLDEN}`, reload },
    });
    try {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
  });

  it("changes nothing when no hand-off has come", async () => {
    const plain = await boot("/");
    const count = plain.users.length;
    expect(plain.added).toEqual([]);
    const again = await boot(USERS_PATH);
    expect(again.users).toHaveLength(count);
  });
});

/* Fatima's review, Nov 10 2026 (P2): "UAC after setup is the Omnesoft sample
 * company … Fix: UAC opens as FR Conversions with only the users setup
 * created." A payload with the company does that; one without it doesn't. */
describe("opening as the company onboarding set up", () => {
  it("lists only the people setup created, as the hand-off maps them, and they open", async () => {
    const { before, after } = await (async () => {
      const sample = await boot("/");
      const maxSampleId = Math.max(...sample.users.map((u) => u.id));
      return { before: maxSampleId, after: await boot(`${USERS_PATH}#onboarding=${TENANT_GOLDEN}`) };
    })();
    const { added, users, getUserDetail } = after;

    expect(users.map((u) => u.email)).toEqual([
      "sam.carter@frconversions.com",
      "priya.shah@frconversions.com",
      "marco.diaz@frconversions.com",
    ]);
    expect(added).toEqual(users.map((u) => u.id));
    // Past every sample id, so no sample photo, profile or task lands on them.
    expect(Math.min(...added)).toBeGreaterThan(before);

    const [sam, priya, marco] = users;
    expect(sam).toMatchObject({
      fullName: "Sam Carter",
      status: "Active",
      license: "Full Access",
      invitedBy: "Sam Carter",
      invitedOn: "11/10/2026",
      lastLogon: "11/10/2026",
      inviteAcceptedOn: "11/10/2026",
      assignedRoles: ["super administrator"],
    });
    expect(priya).toMatchObject({ status: "Invite Sent", lastLogon: "-", assignedRoles: ["account owner"] });
    expect(marco).toMatchObject({ status: "Invite Sent", license: "No License", assignedRoles: ["buyer"] });
    expect(getUserDetail(sam.id)).toMatchObject({ username: "sam.carter", jobTitle: "" });
    expect(getUserDetail(priya.id)).toMatchObject({ username: "priya.shah" });
  });

  it("signs in as the person whose email is `me`, with their first role under their name", async () => {
    const { users, CURRENT_USER, isMe, viewer } = await boot(`${USERS_PATH}#onboarding=${TENANT_GOLDEN}`);
    const sam = users[0];
    expect(CURRENT_USER).toMatchObject({
      id: sam.id,
      name: "Sam Carter",
      email: "sam.carter@frconversions.com",
      jobTitle: "Super Administrator",
      license: "Full Access",
    });
    expect(isMe("Sam Carter")).toBe(true);
    expect(isMe(sam.id)).toBe(true);
    expect(isMe("Abdullah Malik")).toBe(false);
    expect(viewer()).toEqual({ id: sam.id, name: "Sam Carter", email: "sam.carter@frconversions.com" });

    // The named owner, once they claimed the account on Home.
    const asOwner = await boot(`${USERS_PATH}#onboarding=${encode({ ...TENANT_DECODED, me: "PRIYA.SHAH@frconversions.com" })}`);
    expect(asOwner.CURRENT_USER).toMatchObject({ name: "Priya Shah", jobTitle: "Account Owner" });
  });

  it("falls back to the first Active person when `me` is missing or matches nobody", async () => {
    // `me: undefined` leaves the key out of the JSON, as an older Home would.
    const people = [TENANT_DECODED.people[2], TENANT_DECODED.people[0], TENANT_DECODED.people[1]];
    const reordered = { ...TENANT_DECODED, me: undefined, people };
    expect((await boot(`${USERS_PATH}#onboarding=${encode(reordered)}`)).CURRENT_USER.name).toBe("Sam Carter");
    const stranger = { ...reordered, me: "nobody@frconversions.com" };
    expect((await boot(`${USERS_PATH}#onboarding=${encode(stranger)}`)).CURRENT_USER.name).toBe("Sam Carter");
  });

  it("shows the company's legal name in place of the sample's", async () => {
    const tenant = await boot(`${USERS_PATH}#onboarding=${TENANT_GOLDEN}`);
    expect(tenant.isNewTenant()).toBe(true);
    expect(tenant.getCompanyName()).toBe("FR Conversions LLC");

    // Setup ran, but nobody saved a legal name yet: Home's own wording.
    const unnamed = encode({ ...TENANT_DECODED, company: { ...TENANT_DECODED.company, legalName: "  " } });
    expect((await boot(`${USERS_PATH}#onboarding=${unnamed}`)).getCompanyName()).toBe("Your Company");
  });

  it("counts roles, owners and Insights from the new company, with the sample's custom roles gone", async () => {
    const { roles, scopeEligibleRoles, users, getAccountOwnerIds, insight } = await boot(
      `${USERS_PATH}#onboarding=${TENANT_GOLDEN}`,
    );
    const [, priya] = users;
    const holders = (name: string) => roles.find((r) => r.roleName === name)?.usersCount;
    expect(holders("Account Owner")).toBe(1);
    expect(holders("Super Administrator")).toBe(1);
    expect(holders("Buyer")).toBe(1);
    expect(holders("Warehouse Supervisor")).toBe(0);
    expect(getAccountOwnerIds()).toEqual([priya.id]);

    expect(roles).toHaveLength(25);
    expect(roles.every((r) => r.isSystem)).toBe(true);
    expect(scopeEligibleRoles.every((r) => r.isSystem)).toBe(true);
    expect(roles.map((r) => r.roleName)).not.toContain("Senior Buyer");

    expect(insight("total-users")).toBe("3");
    expect(insight("active-users")).toBe("1");
    expect(insight("full-access-users")).toBe("2");
    expect(insight("pending-invites")).toBe("2");
    expect(insight("monthly-license-cost")).toBe("$300");
    expect(insight("users-without-roles")).toBe("0");
    expect(insight("total-roles")).toBe("25");
    expect(insight("custom-roles")).toBe("0");
    expect(insight("unassigned-roles")).toBe("22");
  });

  it("stays the new company on a later visit without the fragment", async () => {
    await boot(`${USERS_PATH}#onboarding=${TENANT_GOLDEN}`);
    const later = await boot(USERS_PATH);
    expect(later.getCompanyName()).toBe("FR Conversions LLC");
    expect(later.users).toHaveLength(3);
    expect(later.CURRENT_USER.name).toBe("Sam Carter");
  });

  it("leaves the sample company as it was for a payload without the company", async () => {
    const sample = await boot("/");
    const sampleCount = sample.users.length;
    const sampleRoles = sample.roles.length;

    const old = await boot(`${USERS_PATH}#onboarding=${GOLDEN}`);
    expect(old.users).toHaveLength(sampleCount + 2);
    expect(old.users[0].fullName).toBe("Maya Patel");
    expect(old.isNewTenant()).toBe(false);
    expect(old.getCompanyName()).toBe("Omnesoft");
    expect(old.CURRENT_USER).toMatchObject({ id: 1001, name: "Abdullah Malik", jobTitle: "Team Member" });
    expect(old.viewer().name).toBe("Abdullah Malik");
    expect(old.roles).toHaveLength(sampleRoles);
    expect(old.roles.map((r) => r.roleName)).toContain("Senior Buyer");
    expect(old.insight("total-users")).toBe("299");
  });

  it("leaves the sample company as it was when no onboarding has run, company or not", async () => {
    const notRun = encode({ ...TENANT_DECODED, run: null, people: [] });
    const result = await boot(`${USERS_PATH}#onboarding=${notRun}`);
    expect(result.isNewTenant()).toBe(false);
    expect(result.CURRENT_USER.name).toBe("Abdullah Malik");
    expect(result.users.map((u) => u.email)).not.toContain("sam.carter@frconversions.com");
    expect(result.users.length).toBeGreaterThan(50);
  });
});

/* The user, after the review: "make sure that the listing in the uac is clean
 * of other mock data … because assumption is that you are starting fresh so
 * you'll see the users you added". Each case boots the new company and the
 * sample side by side, so a check that passes only because the data is gone
 * everywhere would fail on the sample half. */
describe("a new company starts with none of the sample's history", () => {
  const NEW = `${USERS_PATH}#onboarding=${TENANT_GOLDEN}`;
  // An older payload: the sample company, with the invitees added.
  const SAMPLE = `${USERS_PATH}#onboarding=${GOLDEN}`;

  /** Boot, then load the modules the app reads, as main.tsx does. */
  async function open(url: string) {
    const booted = await boot(url);
    return {
      ...booted,
      ...(await import("../app/data/tenant")),
      ...(await import("../app/data/role-detail-data")),
      ...(await import("../app/data/user-detail-insights-data")),
      ...(await import("../app/data/role-detail-insights-data")),
      ...(await import("../app/data/user-permission-requests-data")),
      ...(await import("../app/data/user-requests-data")),
      ...(await import("../app/data/role-manage-scope-data")),
      ...(await import("../app/data/module-assignments-data")),
      MY_PERMISSION_MODULE_IDS: (await import("../app/data/current-user")).MY_PERMISSION_MODULE_IDS,
      mockNotifications: (await import("../app/components/notificationsData")).mockNotifications,
      ACCESS_LEVELS: (await import("../app/components/access-mode")).ACCESS_LEVELS,
      ...(await import("../app/components/data-imports/importHistory")),
      ...(await import("../app/components/data-imports/importers")),
      ...(await import("../app/components/data-imports/moduleData")),
      ...(await import("../app/components/data-imports/templateOnlyModules")),
    };
  }

  it("leaves no made-up phone, language, citizenship or login devices on a person", async () => {
    const fresh = await open(NEW);
    const sam = fresh.getUserDetail(fresh.users[0].id)!;
    expect(sam).toMatchObject({ phones: [], languages: [], citizenships: [], loginDevices: [], lastLoginDevice: "-" });

    const sample = await open(SAMPLE);
    expect(sample.getUserDetail(sample.users[0].id)!.phones).toEqual([
      { type: "Mobile", countryCode: "+1", number: "555-0100" },
    ]);
  });

  it("reports no made-up usage on a person or a role", async () => {
    const fresh = await open(NEW);
    const value = (ms: { id: string; value: string }[], id: string) => ms.find((m) => m.id === id)?.value;
    const samInsights = fresh.getUserDetailInsights(fresh.users[0].id);
    expect(value(samInsights, "total-logins")).toBe("0");
    expect(value(samInsights, "days-since-login")).toBe("-");
    expect(value(samInsights, "password-age")).toBe("-");
    const superAdmin = fresh.getRoleDetailInsights(2, 1, []);
    expect(value(superAdmin, "elevated-permissions")).toBe("0");
    expect(value(superAdmin, "changes-this-month")).toBe("0");
    expect(value(superAdmin, "last-audit")).toBe("—");
    expect(value(superAdmin, "new-assignments")).toBe("1");

    const sample = await open(SAMPLE);
    expect(value(sample.getUserDetailInsights(1), "total-logins")).not.toBe("0");
    expect(value(sample.getRoleDetailInsights(2, 1, []), "elevated-permissions")).not.toBe("0");
  });

  it("starts every role's activity log empty, with no sample editor on it", async () => {
    const fresh = await open(NEW);
    for (const id of [1, 2, 10, 16, 21]) {
      expect(fresh.getRoleDetail(id)).toMatchObject({ activityLog: [], lastModifiedBy: "System" });
    }
    const sample = await open(SAMPLE);
    expect(sample.getRoleDetail(2)!.activityLog.length).toBeGreaterThan(0);
    expect(sample.getRoleDetail(2)!.lastModifiedBy).toBe("Andrea Davis");
  });

  it("has no permission requests or notifications", async () => {
    const fresh = await open(NEW);
    expect(fresh.userRequests).toEqual([]);
    expect(fresh.getUserPermissionRequests(fresh.users[0].id)).toEqual([]);
    expect(fresh.mockNotifications).toEqual([]);

    const sample = await open(SAMPLE);
    expect(sample.userRequests.length).toBeGreaterThan(0);
    expect(sample.getUserPermissionRequests(sample.users[0].id).length).toBeGreaterThan(0);
    expect(sample.mockNotifications.length).toBeGreaterThan(0);
  });

  it("has no import history, and anything imported is the signed-in person's", async () => {
    const fresh = await open(NEW);
    fresh.ensureSeededForLoad("users");
    fresh.ensureSeededForLoad("roles");
    fresh.seedTemplateOnlyImports("item-library");
    expect(fresh.getCompletedImports("users")).toEqual([]);
    expect(fresh.getCompletedImports("roles")).toEqual([]);
    expect(fresh.getCompletedImports("item-library")).toEqual([]);
    expect(fresh.getAllModuleCards().every((c) => c.importsCount === 0 && c.lastImportStatus === null)).toBe(true);
    expect(fresh.getImporter("sj")).toMatchObject({ name: "Sam Carter", initials: "SC", email: "sam.carter@frconversions.com" });

    const sample = await open(SAMPLE);
    sample.ensureSeededForLoad("users");
    expect(sample.getCompletedImports("users").length).toBeGreaterThan(0);
    expect(sample.getAllModuleCards().some((c) => c.importsCount > 0)).toBe(true);
    expect(sample.getImporter("sj").name).toBe("Sarah Johnson");
  });

  it("scopes nothing to the sample's roles, and Me Mode follows the signed-in person's roles", async () => {
    const fresh = await open(NEW);
    const scoped = (level: string) => fresh.ACCESS_LEVELS.find((l) => l.level === level)?.managedRoleIds;
    expect(scoped("grant_access")).toEqual([]);
    expect(scoped("approve")).toEqual([]);
    expect(fresh.getRoleManageScope(8).manageRoleIds).toEqual([]);
    // Sam is a Super Administrator, whose role reaches User Access Control.
    expect(fresh.MY_PERMISSION_MODULE_IDS.has("users-roles")).toBe(true);
    // Read from what the company holds: its holders are its own people.
    const uac = fresh.getModuleAssignment("users-roles");
    const ids = new Set(fresh.users.map((u) => u.id));
    expect(uac.userIds.length).toBeGreaterThan(0);
    expect(uac.userIds.every((id) => ids.has(id))).toBe(true);

    const sample = await open(SAMPLE);
    expect(sample.ACCESS_LEVELS.find((l) => l.level === "grant_access")?.managedRoleIds).toEqual([26, 27, 28]);
    expect(sample.getRoleManageScope(8).manageRoleIds).toEqual([7, 9, 28]);
    expect([...sample.MY_PERMISSION_MODULE_IDS]).toEqual([
      "item-library", "purchase-orders", "users-roles", "warehouse-locations", "quotes", "sales-orders",
    ]);
  });

  it("reads sample-only content as empty for a new company and unchanged for the sample", async () => {
    expect((await open(NEW)).sampleOnly(["full-time", "field-team"])).toEqual([]);
    expect((await open(SAMPLE)).sampleOnly(["full-time", "field-team"])).toEqual(["full-time", "field-team"]);
  });
});
