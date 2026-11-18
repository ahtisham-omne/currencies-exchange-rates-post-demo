import type { UserRow } from "./users-data";
import { users } from "./users-data";
import { isSystemRole, roles } from "./roles-data";
import { getRoleIdsForUser, addUserToRole, removeUserFromRole, subscribeUacData } from "./uac-derived";
import { isNewTenant, sampleOnly } from "./tenant";
import { WORKFORCE_SITES, WORKFORCE_USERS } from "./workforce-users";
import type {
  PhoneEntry,
  AddressEntry,
  EmergencyContact,
  CitizenshipEntry,
  LanguageEntry,
} from "../types/shared";

/* Re-export shared types so existing imports don't break */
export type { PhoneEntry, AddressEntry, EmergencyContact, CitizenshipEntry, LanguageEntry };

export interface RoleAssignment {
  id: string;
  name: string;
  license: "Full Access" | "Field User";
  description: string;
  assignedOn: string;
  assignedBy: string;
  /** True for predefined system roles */
  isSystem?: boolean;
}

export interface ActivityEntry {
  id: string;
  type: "login" | "role_change" | "profile_update" | "password_reset" | "invite" | "status_change" | "permission_change";
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
}

/** A device this user has signed in from. `name` is the device/OS only
 *  (no browser), the widget title shows just this. */
export interface LoginDevice {
  id: string;
  /** Device / OS name only, e.g. "MacBook Pro", "iPhone 15", "Windows 11 PC". */
  name: string;
  kind: "desktop" | "mobile";
  location: string;
  /** Date of the most recent session on this device (MM/DD/YYYY). */
  lastActive: string;
  /** True for the device backing the user's current live session. */
  current?: boolean;
}

export interface UserDetail extends UserRow {
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  gender: string;
  dateOfBirth: string;
  nickname: string;
  pronouns: string;
  preferredName: string;
  about: string;
  languages: LanguageEntry[];
  additionalEmails: string[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  emergencyContacts: EmergencyContact[];
  citizenships: CitizenshipEntry[];
  roleAssignments: RoleAssignment[];
  activityLog: ActivityEntry[];
  inviteLinkExpiry: string;
  jobTitle: string;
  timezone: string;
  mfaEnabled: boolean;
  lastPasswordChange: string;
  /* New fields: Phase 2/3 */
  employeeId: string;
  
  reportsTo: string;
  workLocation: string;
  mfaMethod: string;
  activeSessions: number;
  lastLoginDevice: string;
  /** All devices this user has signed in from, newest session first. Empty
   *  for users who have never logged in (invite pending / expired). */
  loginDevices: LoginDevice[];
  grade: string;
  costCenter: string;
  /** LinkedIn URL */
  linkedIn: string;
  /** Meeting link URL */
  meetingLink: string;
  /** Slack/Teams handle */
  slackHandle: string;
  /** Notification override email */
  notificationEmail: string;
  /** Messaging preference */
  messagingPreference: string;
  /** Mailing address */
  mailingAddress: string;
  /** National ID (masked) */
  nationalId: string;
  /** Work visa type */
  workVisa: string;
  /** Passport expiry */
  passportExpiry: string;
}

/* The plant workforce's profile fields: job title, site, manager, phone and
 * MFA (Full Access seats enrol, field seats do not). */
function workforceExtensions(): Record<number, Partial<UserDetail>> {
  return Object.fromEntries(
    WORKFORCE_USERS.map((w) => {
      const site = WORKFORCE_SITES[w.warehouse];
      const fullAccess = w.license === "Full Access";
      const [area, rest] = w.phone.replace("+1 (", "").split(") ");
      return [
        w.id,
        {
          jobTitle: w.jobTitle,
          workLocation: `${w.warehouse}, ${site.place}`,
          timezone: site.timezone,
          reportsTo: w.reportsTo,
          costCenter: `${w.warehouse.replace("-", "")}-${w.department.slice(0, 3).toUpperCase()}`,
          mfaEnabled: fullAccess,
          mfaMethod: fullAccess ? "Authenticator app" : "Not enrolled",
          phones: [{ type: "Mobile", countryCode: "+1", number: `${area}-${rest}` }],
          ...(w.avatarUrl ? { avatarUrl: w.avatarUrl } : {}),
        },
      ];
    }),
  );
}

/* ─── Mock extended data per user ─── */
const MOCK_EXTENSIONS: Record<number, Partial<UserDetail>> = {
  1: {
    firstName: "Ahtisham", middleName: "", lastName: "Ahmad",
    username: "aahmad", gender: "Male", dateOfBirth: "03/15/1992",
    nickname: "Ahti", pronouns: "He/Him",
    preferredName: "Ahti", about: "Operations specialist with 8+ years of experience in warehouse and supply chain management.",
    jobTitle: "Operations Manager",
    timezone: "Asia/Karachi (UTC+5)", mfaEnabled: true,
    lastPasswordChange: "12/12/2025",
    reportsTo: "Andrea Davis", workLocation: "Islamabad HQ",
    mfaMethod: "Authenticator app", activeSessions: 2,
    lastLoginDevice: "Chrome · Windows · Islamabad",
    grade: "L5", costCenter: "OPS-001",
    linkedIn: "https://linkedin.com/in/ahtisham-ahmad", meetingLink: "https://meet.google.com/abc-defg-hij",
    slackHandle: "@ahti.ahmad", notificationEmail: "",
    messagingPreference: "WhatsApp", mailingAddress: "",
    nationalId: "···· ···· 4567", workVisa: "", passportExpiry: "Aug 2027",
    languages: [
      { language: "English", proficiency: "Fluent", flag: "\u{1F1FA}\u{1F1F8}" },
      { language: "Urdu", proficiency: "Native", flag: "\u{1F1F5}\u{1F1F0}" },
    ],
    additionalEmails: ["ahtisham.personal@gmail.com"],
    phones: [
      { type: "Mobile", countryCode: "+92", number: "321-4567890" },
      { type: "Work", countryCode: "+1", number: "555-0142" },
    ],
    addresses: [
      { type: "Home", address: "House 42, Street 7, F-10/2, Islamabad, Pakistan" },
      { type: "Work", address: "Suite 400, 1250 Connecticut Ave NW, Washington DC 20036" },
    ],
    emergencyContacts: [
      { fullName: "Sara Ahmad", relationship: "Spouse", countryCode: "+92", phone: "300-1234567" },
    ],
    citizenships: [
      { country: "Pakistan", isPrimary: true },
      { country: "United States", isPrimary: false },
    ],
    /* roleAssignments derived from canonical USER_ROLE_IDS */
    activityLog: [
      { id: "a1", type: "login", title: "Signed In", description: "Signed in from Chrome on Windows", timestamp: "07/19/2025 - 13:10", actor: "Ahtisham Ahmad" },
      { id: "a2", type: "role_change", title: "Role Assigned", description: "Procurement Manager role was assigned", timestamp: "02/05/2025 - 09:30", actor: "Taylor Dimas" },
      { id: "a3", type: "password_reset", title: "Password Changed", description: "Password was updated successfully", timestamp: "12/12/2025 - 14:22", actor: "Ahtisham Ahmad" },
      { id: "a4", type: "profile_update", title: "Profile Updated", description: "Updated phone number and address", timestamp: "11/20/2025 - 10:15", actor: "Ahtisham Ahmad" },
      { id: "a5", type: "role_change", title: "Role Assigned", description: "Warehouse Manager role was assigned", timestamp: "01/18/2025 - 11:00", actor: "Andrea Davis" },
      { id: "a6", type: "invite", title: "Invitation Accepted", description: "Accepted the invitation and set up their account.", timestamp: "01/16/2025 - 16:45", actor: "Ahtisham Ahmad" },
      { id: "a7", type: "invite", title: "Invitation Sent", description: "Invitation sent to aahmad@omnesoft.com.", timestamp: "01/16/2025 - 09:00", actor: "Andrea Davis" },
      { id: "a8", type: "login", title: "Signed In", description: "Signed in from Safari on macOS", timestamp: "07/18/2025 - 08:30", actor: "Ahtisham Ahmad" },
      { id: "a9", type: "status_change", title: "Status Changed", description: "Status changed from Away to Active", timestamp: "07/17/2025 - 09:00", actor: "System" },
      { id: "a10", type: "permission_change", title: "Permission Updated", description: "Inventory write access was granted", timestamp: "03/01/2025 - 14:10", actor: "Andrea Davis" },
    ],
  },
  2: {
    firstName: "Faizan", middleName: "", lastName: "Khan",
    username: "fkhan", gender: "Male", dateOfBirth: "07/22/1990",
    nickname: "Fizi", pronouns: "He/Him",
    preferredName: "", about: "",
    jobTitle: "QA Lead",
    timezone: "Asia/Karachi (UTC+5)", mfaEnabled: true,
    lastPasswordChange: "09/15/2025",
    reportsTo: "Taylor Dimas", workLocation: "Lahore Office",
    mfaMethod: "SMS", activeSessions: 1,
    lastLoginDevice: "Firefox · Linux · Lahore",
    grade: "L4", costCenter: "QA-002",
    linkedIn: "", meetingLink: "", slackHandle: "@fizi.khan",
    notificationEmail: "", messagingPreference: "Teams",
    mailingAddress: "", nationalId: "···· ···· 9876",
    workVisa: "", passportExpiry: "Mar 2028",
    languages: [
      { language: "English", proficiency: "Fluent", flag: "\u{1F1FA}\u{1F1F8}" },
      { language: "Urdu", proficiency: "Native", flag: "\u{1F1F5}\u{1F1F0}" },
      { language: "Arabic", proficiency: "Intermediate", flag: "\u{1F1F8}\u{1F1E6}" },
    ],
    additionalEmails: [],
    phones: [{ type: "Mobile", countryCode: "+92", number: "333-9876543" }],
    addresses: [{ type: "Home", address: "Apt 12B, DHA Phase 5, Lahore, Pakistan" }],
    emergencyContacts: [
      { fullName: "Ahmed Khan", relationship: "Parent", countryCode: "+92", phone: "321-5551234" },
    ],
    citizenships: [{ country: "Pakistan", isPrimary: true }],
    /* roleAssignments derived from canonical USER_ROLE_IDS */
    activityLog: [
      { id: "b1", type: "login", title: "Signed In", description: "Signed in from Firefox on Linux", timestamp: "10/28/2025 - 10:00", actor: "Faizan Khan" },
      { id: "b2", type: "status_change", title: "Status Changed", description: "Status changed to Away", timestamp: "10/28/2025 - 18:00", actor: "System" },
      { id: "b3", type: "profile_update", title: "Profile Updated", description: "Updated emergency contact details", timestamp: "09/20/2025 - 11:45", actor: "Faizan Khan" },
      { id: "b4", type: "invite", title: "Invitation Accepted", description: "Accepted the invitation and set up their account.", timestamp: "01/25/2025 - 14:30", actor: "Faizan Khan" },
      { id: "b5", type: "invite", title: "Invitation Sent", description: "Invitation sent to fkhan@omnesoft.com.", timestamp: "01/23/2025 - 09:00", actor: "Taylor Dimas" },
    ],
  },
  /* The two Account Owners. Name, username, primary email and phone match
   *  the users-data row and the General Settings Account Owners card in
   *  alert-settings, which mirrors this record. Onboarding captured Eli as
   *  the first owner; OMNE added Nophil (UAC Spec, Roles, Section 11). */
  4: {
    firstName: "Eli", middleName: "", lastName: "Rosenbloom",
    username: "erosenbloom",
    jobTitle: "Founder and CEO",
    timezone: "America/Detroit (UTC-5)", mfaEnabled: true,
    lastPasswordChange: "09/02/2025",
    reportsTo: "", workLocation: "Head Office",
    mfaMethod: "Authenticator app", activeSessions: 1,
    phones: [{ type: "Mobile", countryCode: "+1", number: "269-332-9761" }],
    additionalEmails: [],
    activityLog: [
      { id: "eli-1", type: "login", title: "Signed In", description: "Signed in from Chrome on macOS", timestamp: "10/25/2025 - 08:20", actor: "Eli Rosenbloom" },
      { id: "eli-2", type: "password_reset", title: "Password Changed", description: "Password was updated successfully", timestamp: "09/02/2025 - 17:40", actor: "Eli Rosenbloom" },
      { id: "eli-3", type: "role_change", title: "Role Assigned", description: "Account Owner role was assigned during onboarding", timestamp: "02/23/2025 - 10:05", actor: "Omne" },
      { id: "eli-4", type: "invite", title: "Invitation Accepted", description: "Accepted the invitation and set up their account.", timestamp: "02/23/2025 - 10:00", actor: "Eli Rosenbloom" },
      { id: "eli-5", type: "invite", title: "Invitation Sent", description: "Invitation sent to erosenbloom@omnesoft.com.", timestamp: "02/23/2025 - 09:00", actor: "Autumn Myers" },
    ],
  },
  5: {
    firstName: "Nophil", middleName: "", lastName: "Anwer",
    username: "nanwer",
    jobTitle: "Managing Director",
    timezone: "America/New_York (UTC-5)", mfaEnabled: true,
    lastPasswordChange: "02/28/2025",
    reportsTo: "", workLocation: "Head Office",
    mfaMethod: "Authenticator app", activeSessions: 1,
    phones: [{ type: "Mobile", countryCode: "+1", number: "286-363-4698" }],
    additionalEmails: [],
    activityLog: [
      { id: "nophil-1", type: "login", title: "Signed In", description: "Signed in from Chrome on Windows", timestamp: "02/28/2025 - 14:00", actor: "Nophil Anwer" },
      { id: "nophil-2", type: "role_change", title: "Role Assigned", description: "Account Owner role was assigned by Omne", timestamp: "02/28/2025 - 13:45", actor: "Omne" },
      { id: "nophil-3", type: "invite", title: "Invitation Accepted", description: "Accepted the invitation and set up their account.", timestamp: "02/28/2025 - 13:40", actor: "Nophil Anwer" },
      { id: "nophil-4", type: "invite", title: "Invitation Sent", description: "Invitation sent to nanwer@omnesoft.com.", timestamp: "02/23/2025 - 09:00", actor: "Abdullah Malik" },
    ],
  },
  /* Users 17 (license-conflict) and 6 (inactive-multi-role), roleAssignments
   *  derived from canonical USER_ROLE_IDS. Edge cases encoded there. */
  60: {
    firstName: "Fatima", middleName: "", lastName: "Masood",
    jobTitle: "People Operations Manager",
    timezone: "America/Chicago (UTC-6)", mfaEnabled: true, mfaMethod: "Authenticator app",
    reportsTo: "Andrea Davis", workLocation: "WH-1001, Chicago, IL",
    costCenter: "HR-001",
    phones: [{ type: "Mobile", countryCode: "+1", number: "312-555-0187" }],
  },
  /* The plant workforce: job title, site, manager and phone (workforce-users.ts). */
  ...workforceExtensions(),
};

/* ─── Build complete detail from a UserRow ─── */
function parseName(fullName: string) {
  const parts = fullName.split(" ");
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** Build the user-detail Roles tab from canonical role-IDs so it always
 *  matches what the user-listing chips and role-detail counts show. */
function deriveRoleAssignments(user: UserRow): RoleAssignment[] {
  return getRoleIdsForUser(user.id)
    .map((roleId) => roles.find((r) => r.id === roleId))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((role) => ({
      id: role.roleName.toLowerCase().replace(/\s+/g, "_"),
      name: role.roleName,
      license: role.licenseRequired,
      description: role.description,
      assignedOn: user.invitedOn,
      assignedBy: user.invitedBy,
      isSystem: isSystemRole(role.roleName),
    }));
}

/** True for users who have never signed in yet: awaiting setup, invited but
 *  not accepted, or whose invite lapsed. These users have no login history,
 *  sessions, devices, or behavioral metrics to show, anything that reads as
 *  activity for them is fabricated and should be an empty state instead. */
export function isPreLoginStatus(status: string): boolean {
  return (
    status === "Pending Setup" ||
    status === "Invite Sent" ||
    status === "Invite Expired"
  );
}

/** Build a status-appropriate activity log for a user who hasn't logged in.
 *  Only lifecycle events that genuinely happened appear: account creation,
 *  invitation sent, and (if lapsed) invitation expired, newest first. No
 *  sign-in or "invitation accepted" events, because neither has occurred. */
function preLoginActivityLog(user: UserRow): ActivityEntry[] {
  const creator = user.createdBy || user.invitedBy || "System";
  const created: ActivityEntry = {
    id: `${user.id}-created`,
    type: "status_change",
    title: "Account Created",
    description: `User record created by ${creator}.`,
    timestamp: user.invitedOn && user.invitedOn !== "-" ? user.invitedOn : "-",
    actor: creator,
  };

  if (user.status === "Pending Setup") {
    // Invite not sent yet, only the account exists.
    return [created];
  }

  const sent: ActivityEntry = {
    id: `${user.id}-invite-sent`,
    type: "invite",
    title: "Invitation Sent",
    description: `Invitation sent to ${user.email}.`,
    timestamp: user.invitedOn,
    actor: user.invitedBy || "System",
  };

  if (user.status === "Invite Expired") {
    return [
      {
        id: `${user.id}-invite-expired`,
        type: "invite",
        title: "Invitation Expired",
        description: `The invitation link sent to ${user.email} expired before it was accepted.`,
        timestamp: user.invitedOn,
        actor: "System",
      },
      sent,
      created,
    ];
  }

  // Invite Sent: invitation is outstanding.
  return [sent, created];
}

/* Deterministic pools for the login-devices mock. Names are device/OS only,
 * no browser, so the widget title reads e.g. "MacBook Pro" or "iPhone 15". */
const DEVICE_POOL: { name: string; kind: "desktop" | "mobile" }[] = [
  { name: "MacBook Pro", kind: "desktop" },
  { name: "Windows 11 PC", kind: "desktop" },
  { name: "iPhone 15", kind: "mobile" },
  { name: "Android Phone", kind: "mobile" },
  { name: "iPad Air", kind: "mobile" },
  { name: "Windows 10 Laptop", kind: "desktop" },
  { name: "Linux Workstation", kind: "desktop" },
  { name: "Galaxy Tab", kind: "mobile" },
];
const LOCATION_POOL = [
  "Islamabad, PK",
  "Lahore, PK",
  "Karachi, PK",
  "Dubai, AE",
  "London, UK",
  "New York, US",
  "Toronto, CA",
];

/** Shift an "MM/DD/YYYY" (optionally "… - HH:MM") date string back `days`
 *  days, preserving the MM/DD/YYYY shape. Falls back to the date part of the
 *  input if it can't be parsed. */
function shiftDateBack(input: string, days: number): string {
  const datePart = (input || "").split(" - ")[0].trim();
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return datePart || "-";
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  d.setDate(d.getDate() - days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Build a deterministic, per-user list of login devices. Every logged-in
 *  user gets 2–5 devices seeded from their id, newest session first, so the
 *  Login Devices & Sessions widget always has real content to show. */
function generateLoginDevices(user: UserRow): LoginDevice[] {
  const seed = (user.id ?? 1) * 17 + 5;
  const count = 2 + (seed % 4); // 2–5 devices
  const baseDate = user.lastLogon || user.inviteAcceptedOn || "01/01/2025";
  const devices: LoginDevice[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    const dev = DEVICE_POOL[(seed + i * 3) % DEVICE_POOL.length];
    // Skip duplicates so the list reads as distinct devices.
    if (usedNames.has(dev.name)) continue;
    usedNames.add(dev.name);
    devices.push({
      id: `${user.id}-dev-${i}`,
      name: dev.name,
      kind: dev.kind,
      location: LOCATION_POOL[(seed + i * 2) % LOCATION_POOL.length],
      lastActive: shiftDateBack(baseDate, i * 4),
      current: i === 0,
    });
  }
  return devices;
}

function generateDefaultDetail(user: UserRow): UserDetail {
  const { firstName, middleName, lastName } = parseName(user.fullName);
  const usernameBase = user.email.split("@")[0];
  const preLogin = isPreLoginStatus(user.status);
  /* Made-up devices, and the placeholder phone, language and citizenship
   * below, are sample content; a company from onboarding starts without them. */
  const loginDevices = preLogin || isNewTenant() ? [] : generateLoginDevices(user);

  return {
    ...user,
    firstName,
    middleName,
    lastName,
    username: usernameBase,
    gender: "",
    dateOfBirth: "",
    nickname: "",
    pronouns: "",
    preferredName: "",
    about: "",
    jobTitle: "Team Member",
    timezone: "America/New_York (UTC-5)",
    mfaEnabled: false,
    lastPasswordChange: "Never changed",
    inviteLinkExpiry: "7 days",
    employeeId: `EMP-${String(user.id).padStart(4, "0")}`,
    reportsTo: "",
    workLocation: "",
    mfaMethod: "Not enrolled",
    activeSessions: preLogin ? 0 : 1,
    lastLoginDevice: preLogin ? "-" : loginDevices[0]?.name ?? "-",
    loginDevices,
    grade: "",
    costCenter: "",
    linkedIn: "",
    meetingLink: "",
    slackHandle: "",
    notificationEmail: "",
    messagingPreference: "",
    mailingAddress: "",
    nationalId: "",
    workVisa: "",
    passportExpiry: "",
    languages: sampleOnly([{ language: "English", proficiency: "Fluent", flag: "\u{1F1FA}\u{1F1F8}" }]),
    additionalEmails: [],
    phones: sampleOnly([{ type: "Mobile", countryCode: "+1", number: "555-0100" }]),
    addresses: [],
    emergencyContacts: [],
    citizenships: sampleOnly([{ country: "United States", isPrimary: true }]),
    roleAssignments: deriveRoleAssignments(user),
    activityLog: preLogin
      ? preLoginActivityLog(user)
      : [
          { id: `${user.id}-1`, type: "login", title: "Signed In", description: "Signed in from Chrome on Windows", timestamp: user.lastLogon, actor: user.fullName },
          { id: `${user.id}-2`, type: "invite", title: "Invitation Accepted", description: "Accepted the invitation and set up their account.", timestamp: user.inviteAcceptedOn, actor: user.fullName },
          { id: `${user.id}-3`, type: "invite", title: "Invitation Sent", description: `Invitation sent to ${user.email}.`, timestamp: user.invitedOn, actor: user.invitedBy },
        ],
  };
}

/** In-memory overrides written by the edit-user form. */
const userOverrides: Record<number, Partial<UserDetail>> = {};

/* ── Subscription mechanism so React views update on mutation ── */
const userDetailListeners = new Set<() => void>();
export function subscribeUserDetail(listener: () => void): () => void {
  userDetailListeners.add(listener);
  // Also fan out canonical UAC changes (membership/ownership/tasks).
  const unsubUac = subscribeUacData(listener);
  return () => {
    userDetailListeners.delete(listener);
    unsubUac();
  };
}
function emitUserDetailChange() {
  userDetailListeners.forEach((l) => l());
}

/** Persist partial edits for a user (session-only). */
export function setUserOverrides(userId: number, overrides: Partial<UserDetail>): void {
  userOverrides[userId] = { ...userOverrides[userId], ...overrides };
  emitUserDetailChange();
}

/** Remove a single role assignment from a user. Mutates the canonical
 *  USER_ROLE_IDS map so the user listing, role detail counts, and any
 *  other consumer all update together. */
export function removeRoleFromUser(userId: number, roleName: string): void {
  const target = roleName.toLowerCase();
  const role = roles.find((r) => r.roleName.toLowerCase() === target);
  if (role) {
    removeUserFromRole(userId, role.id);
  }
  emitUserDetailChange();
}

/** Assign one or more roles to a user by role name. Mutates the canonical
 *  USER_ROLE_IDS map so the user listing, role detail counts, and any
 *  other consumer all update together. */
export function addRolesToUser(userId: number, roleNames: string[]): void {
  for (const roleName of roleNames) {
    const target = roleName.toLowerCase();
    const role = roles.find((r) => r.roleName.toLowerCase() === target);
    if (role) {
      addUserToRole(userId, role.id);
    }
  }
  emitUserDetailChange();
}

/** Make a user's roles exactly `roleNames`: add what is missing and remove
 *  what is not listed. The Unarchive / Reactivate flows commit the roles the
 *  admin confirmed at Review through here. */
export function setUserRoles(userId: number, roleNames: string[]): void {
  const wanted = new Set(
    roleNames
      .map((n) => roles.find((r) => r.roleName.toLowerCase() === n.toLowerCase())?.id)
      .filter((id): id is number => id != null),
  );
  getRoleIdsForUser(userId)
    .filter((rid) => !wanted.has(rid))
    .forEach((rid) => removeUserFromRole(userId, rid));
  wanted.forEach((rid) => addUserToRole(userId, rid));
  emitUserDetailChange();
}

export function getUserDetail(userId: number): UserDetail | null {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const base = generateDefaultDetail(user);
  const ext = MOCK_EXTENSIONS[userId];
  const overrides = userOverrides[userId];
  // Always re-derive roleAssignments from canonical at read time so
  // mutations to USER_ROLE_IDS surface immediately and ext/overrides
  // can't shadow the source of truth.
  const merged = { ...base, ...ext, ...overrides } as UserDetail;
  merged.roleAssignments = deriveRoleAssignments(user);
  return merged;
}

export function getAllUsers(): UserRow[] {
  return users;
}
