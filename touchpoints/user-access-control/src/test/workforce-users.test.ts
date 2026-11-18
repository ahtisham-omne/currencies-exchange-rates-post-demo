import { describe, expect, it } from "vitest";
import { users } from "@/app/data/users-data";
import { roles } from "@/app/data/roles-data";
import { USER_ROLE_IDS } from "@/app/data/uac-derived";
import { USER_AVATAR_MAP } from "@/app/data/user-avatars";
import { getUserDetail } from "@/app/data/user-detail-data";
import { WORKFORCE_FIRST_ID, WORKFORCE_USERS } from "@/app/data/workforce-users";
import { ROLES_INSIGHTS, USERS_INSIGHTS, recountInsights } from "@/app/data/insights-data";

/* The plant workforce (13 Nov 2026) is shared with Calendars and Shift
 * Management, so its records have to read as real accounts. */

/** "MM/DD/YYYY" or "MM/DD/YYYY - HH:MM" → sortable "YYYY-MM-DD HH:MM". */
function key(s: string): string {
  const [d, t = "00:00"] = s.split(" - ");
  const [m, day, y] = d.split("/");
  return `${y}-${m}-${day} ${t}`;
}

describe("the plant workforce in UAC", () => {
  it("adds 243 users after UAC's own, on contiguous ids", () => {
    expect(WORKFORCE_USERS).toHaveLength(243);
    WORKFORCE_USERS.forEach((w, i) => expect(w.id).toBe(WORKFORCE_FIRST_ID + i));
    for (const w of WORKFORCE_USERS) expect(users.find((u) => u.id === w.id)?.fullName).toBe(w.fullName);
  });

  it("never repeats a name or an email across the whole directory", () => {
    const names = users.map((u) => u.fullName);
    const emails = users.map((u) => u.email.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("gives each one role, and the licence that role needs", () => {
    for (const w of WORKFORCE_USERS) {
      const ids = USER_ROLE_IDS[w.id];
      expect(ids, w.fullName).toHaveLength(1);
      if (w.license === "No License") continue;
      expect(w.license, w.fullName).toBe(roles.find((r) => r.id === ids[0])!.licenseRequired);
    }
  });

  it("keeps each status's dates honest", () => {
    for (const w of WORKFORCE_USERS) {
      if (w.status === "Pending Setup") {
        expect([w.invitedBy, w.invitedOn, w.inviteAcceptedOn, w.lastLogon]).toEqual(["", "-", "-", "-"]);
        continue;
      }
      const inviter = users.find((u) => u.fullName === w.invitedBy)!;
      expect(inviter, `${w.fullName}'s inviter`).toBeDefined();
      /* Whoever sent the invite had accepted their own first. */
      expect(key(inviter.inviteAcceptedOn) < key(w.invitedOn), w.fullName).toBe(true);
      if (w.status === "Invite Sent") {
        expect([w.inviteAcceptedOn, w.lastLogon]).toEqual(["-", "-"]);
        continue;
      }
      expect(key(w.invitedOn) <= key(w.inviteAcceptedOn), w.fullName).toBe(true);
      expect(key(w.inviteAcceptedOn) <= key(w.lastLogon), w.fullName).toBe(true);
      expect(["Active", "Inactive"]).toContain(w.status);
    }
  });

  it("names a manager who is in the directory", () => {
    for (const w of WORKFORCE_USERS) {
      expect(users.some((u) => u.fullName === w.reportsTo), `${w.fullName} → ${w.reportsTo}`).toBe(true);
    }
  });

  it("shows the job title, site and photo on the user page", () => {
    const w = WORKFORCE_USERS[0];
    const detail = getUserDetail(w.id)!;
    expect(detail.jobTitle).toBe(w.jobTitle);
    expect(detail.workLocation).toContain(w.warehouse);
    expect(detail.reportsTo).toBe(w.reportsTo);
    expect(USER_AVATAR_MAP[w.id]).toBe(w.avatarUrl);
  });

  it("keeps the Users and Roles insight cards equal to a recount of this data", () => {
    const shown = [...USERS_INSIGHTS, ...ROLES_INSIGHTS].map((m) => [m.id, m.value]);
    recountInsights(users, roles, new Date(2026, 10, 13));
    expect([...USERS_INSIGHTS, ...ROLES_INSIGHTS].map((m) => [m.id, m.value])).toEqual(shown);
  });
});
