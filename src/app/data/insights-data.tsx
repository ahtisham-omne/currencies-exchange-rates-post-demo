import { Users, Activity, DollarSign, ShieldCheck, Shield, BarChart3 } from "lucide-react";
import type { InsightMetric, InsightCategory } from "../components/shared/PerformanceInsights";
import type { UserRow } from "./users-data";
import type { RoleRow } from "./roles-data";
import { CYCLE_DAYS, DAILY_RATE } from "../lib/license-billing";

/* ═══════════════════════════════════════════
   USERS TAB INSIGHTS
   ═══════════════════════════════════════════ */

export const USERS_INSIGHT_CATEGORIES: InsightCategory[] = [
  { id: "user-overview", label: "User Overview", icon: <Users className="w-4 h-4" /> },
  { id: "activity", label: "Activity", icon: <Activity className="w-4 h-4" /> },
  { id: "license-cost", label: "License & Cost", icon: <DollarSign className="w-4 h-4" /> },
  { id: "access-hygiene", label: "Access Hygiene", icon: <ShieldCheck className="w-4 h-4" /> },
];

/* Draft users are excluded from EVERY card on this tab (ERP-5203 AC 3, ruled
 * 16 Sep 2026). Full Access, Field User and No License users are all counted;
 * a user sitting at Draft is not, on any card, cost included. Archived users
 * are counted by Total Users and by Archived Users, and held back everywhere
 * else. Against the build data (303 records since 13 Nov 2026, when the
 * 243-user plant workforce and Fatima Masood joined: 4 Draft, 1 Archived)
 * that puts Total Users at 299 while the listing shows 302 rows: the panel
 * reports the directory, the table reports the current view, and the two
 * differ by the 4 drafts the panel drops and the 1 archived user the table
 * holds back. Every value on both tabs is what `recountInsights` gives for
 * this data on 13 Nov 2026 (Avg Days Since Login is as of that day); re-run it
 * and copy the values when the seed changes.
 * Subtitles are the tooltip text on each card, so they carry the rule. */
export const USERS_INSIGHTS: InsightMetric[] = [
  // USER OVERVIEW
  { id: "total-users", label: "Total Users", value: "299", subtitle: "Everyone in the directory, archived users included. Draft users are not counted.", category: "user-overview", iconName: "Users" },
  { id: "full-access-users", label: "Full Access Users", value: "74", subtitle: "Full Access licensed seats. Draft and archived users are not counted.", category: "user-overview", iconName: "UserCheck" },
  { id: "active-users", label: "Active Users", value: "279", subtitle: "Users at an Active status. Draft and archived users are not counted.", category: "user-overview", iconName: "Activity" },
  { id: "field-users", label: "Field Users", value: "221", subtitle: "Field User licensed seats. Draft and archived users are not counted.", category: "user-overview", iconName: "HardHat" },
  { id: "archived-users", label: "Archived Users", value: "1", subtitle: "Removed from active access. The only card that counts archived users on its own.", category: "user-overview", iconName: "Archive" },

  // ACTIVITY
  { id: "pending-invites", label: "Pending Invitations", value: "7", subtitle: "Invitations sent but not yet accepted. Draft users hold no invitation.", category: "activity", iconName: "Mail" },
  { id: "expired-invites", label: "Expired Invitations", value: "3", subtitle: "Invitations that were not accepted before expiry. Draft users hold no invitation.", category: "activity", iconName: "AlertCircle" },
  { id: "avg-days-since-login", label: "Avg Days Since Login", value: "60.9", subtitle: "Average recency across users who have signed in. Draft users are not counted.", category: "activity", iconName: "Calendar" },

  // LICENSE & COST
  { id: "monthly-license-cost", label: "Monthly License Cost", value: "$14,415", subtitle: "Total cost across licensed seats. Draft users hold no billable seat.", category: "license-cost", iconName: "DollarSign" },

  // ACCESS HYGIENE
  { id: "users-without-roles", label: "Users Without Roles", value: "0", subtitle: "Users with no roles assigned, access may be incomplete. Draft users are not counted.", category: "access-hygiene", iconName: "ShieldAlert" },
];

export const USERS_DEFAULT_VISIBLE = ["total-users", "full-access-users", "active-users"];

/* ═══════════════════════════════════════════
   ROLES TAB INSIGHTS
   ═══════════════════════════════════════════ */

export const ROLES_INSIGHT_CATEGORIES: InsightCategory[] = [
  { id: "role-overview", label: "Role Overview", icon: <Shield className="w-4 h-4" /> },
  { id: "usage", label: "Usage", icon: <BarChart3 className="w-4 h-4" /> },
];

export const ROLES_INSIGHTS: InsightMetric[] = [
  // ROLE OVERVIEW
  { id: "total-roles", label: "Total Roles", value: "29", subtitle: "All roles in system", category: "role-overview", iconName: "Shield" },
  { id: "active-roles", label: "Active Roles", value: "28", subtitle: "Currently in use", category: "role-overview", iconName: "ShieldCheck" },
  { id: "unassigned-roles", label: "Unassigned Roles", value: "0", subtitle: "No users assigned", category: "role-overview", iconName: "ShieldOff" },
  { id: "system-roles", label: "Predefined Roles", value: "25", subtitle: "Predefined roles", category: "role-overview", iconName: "Lock" },
  { id: "custom-roles", label: "Custom Roles", value: "4", subtitle: "Admin-created", category: "role-overview", iconName: "Wrench" },
  { id: "inactive-roles", label: "Deactivated Roles", value: "0", subtitle: "Marked deactivated", category: "role-overview", iconName: "ShieldX" },
  { id: "archived-roles", label: "Archived Roles", value: "1", subtitle: "Total archived", category: "role-overview", iconName: "Archive" },

  // USAGE
  { id: "avg-users-per-role", label: "Avg Users Per Role", value: "20.5", subtitle: "Assignment density", category: "usage", iconName: "BarChart3" },
  { id: "most-assigned-role", label: "Most Assigned Role", value: "Field Operative", subtitle: "Most users assigned", category: "usage", iconName: "Star" },
  { id: "full-access-roles", label: "Full Access Roles", value: "22", subtitle: "Require Full Access", category: "usage", iconName: "KeyRound" },
  { id: "field-user-roles", label: "Field User Roles", value: "6", subtitle: "Require Field User", category: "usage", iconName: "HardHat" },

];

export const ROLES_DEFAULT_VISIBLE = ["total-roles", "active-roles", "unassigned-roles"];

/* ═══════════════════════════════════════════
   RECOUNT FOR A NEW COMPANY
   ═══════════════════════════════════════════ */

/** Whole days from an MM/DD/YYYY listing date (any time part ignored) to
 *  `now`; null for "-" or anything else that isn't a date. */
function daysSince(listingDate: string, now: Date): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(listingDate);
  if (!m) return null;
  const then = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

function setValues(metrics: InsightMetric[], values: Record<string, string>): void {
  for (const m of metrics) if (m.id in values) m.value = values[m.id];
}

/** The numbers above describe the sample company. When UAC opens as a new
 *  company from onboarding (see onboarding-handoff.ts), both tabs' cards are
 *  counted from that company's own users and roles instead, by the rule each
 *  card's subtitle states. Written in place, once, before the first render;
 *  the import deltas in UserAccessControl still layer on top. */
export function recountInsights(
  userRows: readonly UserRow[],
  roleRows: readonly RoleRow[],
  now: Date = new Date(),
): void {
  /* Draft users count on no card; archived ones only on the two that say so. */
  const counted = userRows.filter((u) => u.status !== "Pending Setup");
  const seated = counted.filter((u) => u.status !== "Archived");
  const loginAges = seated
    .map((u) => daysSince(u.lastLogon, now))
    .filter((d): d is number => d !== null);
  const monthlyCost = seated.reduce((sum, u) => sum + (DAILY_RATE[u.license] ?? 0), 0) * CYCLE_DAYS;

  setValues(USERS_INSIGHTS, {
    "total-users": String(counted.length),
    "full-access-users": String(seated.filter((u) => u.license === "Full Access").length),
    "active-users": String(seated.filter((u) => u.status === "Active").length),
    "field-users": String(seated.filter((u) => u.license === "Field User").length),
    "archived-users": String(counted.length - seated.length),
    "pending-invites": String(seated.filter((u) => u.status === "Invite Sent").length),
    "expired-invites": String(seated.filter((u) => u.status === "Invite Expired").length),
    "avg-days-since-login": loginAges.length
      ? (loginAges.reduce((a, b) => a + b, 0) / loginAges.length).toFixed(1)
      : "-",
    "monthly-license-cost": `$${monthlyCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    "users-without-roles": String(seated.filter((u) => u.assignedRoles.length === 0).length),
  });

  const live = roleRows.filter((r) => r.status !== "Archived");
  const assignments = live.reduce((sum, r) => sum + r.usersCount, 0);
  /* The first role with the most holders; none while nobody holds one. */
  const mostAssigned = live.reduce<RoleRow | null>(
    (best, r) => (r.usersCount > (best?.usersCount ?? 0) ? r : best),
    null,
  );

  setValues(ROLES_INSIGHTS, {
    "total-roles": String(roleRows.length),
    "active-roles": String(roleRows.filter((r) => r.status === "Active").length),
    "unassigned-roles": String(live.filter((r) => r.usersCount === 0).length),
    "system-roles": String(roleRows.filter((r) => r.isSystem).length),
    "custom-roles": String(roleRows.filter((r) => !r.isSystem).length),
    "inactive-roles": String(roleRows.filter((r) => r.status === "Inactive").length),
    "archived-roles": String(roleRows.length - live.length),
    "avg-users-per-role": live.length ? (assignments / live.length).toFixed(1) : "0",
    "most-assigned-role": mostAssigned?.roleName ?? "-",
    "full-access-roles": String(live.filter((r) => r.licenseRequired === "Full Access").length),
    "field-user-roles": String(live.filter((r) => r.licenseRequired === "Field User").length),
  });
}
