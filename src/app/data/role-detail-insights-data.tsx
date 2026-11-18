import { Users, Activity, Shield, Lock, Clock, ShieldCheck, BarChart3, Layers, UserCheck, Calendar } from "lucide-react";
import type { InsightMetric, InsightCategory } from "../components/shared/PerformanceInsights";
import { isNewTenant } from "./tenant";

/* ═══════════════════════════════════════════
   ROLE DETAIL INSIGHTS
   ═══════════════════════════════════════════ */

export const ROLE_DETAIL_CATEGORIES: InsightCategory[] = [
  { id: "adoption", label: "Adoption", icon: <Users className="w-4 h-4" /> },
  { id: "security", label: "Security", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "activity", label: "Activity", icon: <Activity className="w-4 h-4" /> },
];

/**
 * Generate role-specific insight metrics.
 * Values are deterministic per roleId for consistency.
 */
export function getRoleDetailInsights(
  roleId: number,
  usersCount: number,
  permissionGroups: { permissions: { granted: boolean }[] }[],
): InsightMetric[] {
  const seed = roleId * 11 + 5;
  /* Made-up figures. A company from onboarding has no history to report: its
   * holders all joined at onboarding, nothing has been audited or edited, and
   * nobody's session is tracked, so those read zero or a dash. */
  const fresh = isNewTenant();
  const NO_DATA = "No data yet";

  /* Every people-derived metric hangs off the role actually having members.
   * A role with none (freshly unarchived, or never assigned) must not report a
   * tenure, a turnover, or a live session: those would describe users the role
   * no longer has. They read zero, and tenure reads as no value at all. */
  const hasUsers = usersCount > 0;

  // Adoption metrics
  const assignedUsers = usersCount;
  const newAssignments = fresh ? assignedUsers : hasUsers ? Math.max(0, seed % 5) : 0;
  const avgTenureDays = hasUsers && !fresh ? 30 + (seed % 280) : 0;

  // Security metrics
  const totalPerms = permissionGroups.reduce((s, g) => s + g.permissions.length, 0);
  const grantedPerms = permissionGroups.reduce((s, g) => s + g.permissions.filter(p => p.granted).length, 0);
  const permDensityPct = totalPerms > 0 ? Math.round((grantedPerms / totalPerms) * 100) : 0;
  const elevatedPerms = fresh ? 0 : 1 + (seed % 6);
  const daysSinceAudit = 5 + (seed % 60);

  // Activity metrics
  const changesThisMonth = fresh ? 0 : seed % 8;
  const daysSinceModified = seed % 30;
  const userTurnover = hasUsers ? seed % 4 : 0;
  const activeSessions = hasUsers && !fresh ? 1 + (seed % assignedUsers) : 0;

  return [
    // ADOPTION
    {
      id: "assigned-users",
      label: "Assigned Users",
      value: String(assignedUsers),
      subtitle: hasUsers ? "Currently in this role" : "No users assigned yet",
      category: "adoption",
      iconName: "Users",
    },
    {
      id: "new-assignments",
      label: "New Assignments",
      value: String(newAssignments),
      subtitle: "Last 30 days",
      category: "adoption",
      iconName: "UserCheck",
    },
    {
      id: "avg-tenure",
      label: "Avg User Tenure",
      value: !hasUsers
        ? "\u2014"
        : avgTenureDays > 365
          ? `${Math.round(avgTenureDays / 365)}y`
          : `${avgTenureDays}d`,
      subtitle: hasUsers ? "Time in role" : "No users in this role",
      category: "adoption",
      iconName: "Calendar",
    },

    // SECURITY
    {
      id: "elevated-permissions",
      label: "Elevated Permissions",
      value: String(elevatedPerms),
      subtitle: elevatedPerms > 3 ? "Review recommended" : "Within norms",
      category: "security",
      iconName: "Lock",
    },
    {
      id: "last-audit",
      label: "Last Audit",
      value: fresh ? "—" : `${daysSinceAudit}d`,
      subtitle: fresh ? NO_DATA : daysSinceAudit > 30 ? "Overdue" : "Within cycle",
      category: "security",
      iconName: "ShieldCheck",
    },

    // ACTIVITY
    {
      id: "changes-this-month",
      label: "Changes This Month",
      value: String(changesThisMonth),
      subtitle: "Config & permission edits",
      category: "activity",
      iconName: "Layers",
    },
    {
      id: "last-modified",
      label: "Last Modified",
      value: fresh ? "—" : `${daysSinceModified}d`,
      subtitle: fresh ? NO_DATA : daysSinceModified <= 7 ? "Recently updated" : "Stable",
      category: "activity",
      iconName: "Clock",
    },
    {
      id: "active-sessions",
      label: "Active Sessions",
      value: String(activeSessions),
      subtitle: hasUsers ? "Users currently online" : "No users assigned yet",
      category: "activity",
      iconName: "Activity",
    },
  ];
}

export const ROLE_DETAIL_DEFAULT_VISIBLE = [
  "assigned-users",
  "elevated-permissions",
  "last-modified",
  "active-sessions",
  "new-assignments",
];