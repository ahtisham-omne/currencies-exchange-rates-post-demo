import { Activity, Shield, ShieldCheck } from "lucide-react";
import type { InsightMetric, InsightCategory } from "../components/shared/PerformanceInsights";
import { isNewTenant } from "./tenant";

export const USER_DETAIL_CATEGORIES: InsightCategory[] = [
  { id: "engagement", label: "Engagement", icon: <Activity className="w-4 h-4" /> },
  { id: "security", label: "Security", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "access", label: "Access", icon: <Shield className="w-4 h-4" /> },
];

/* A company from onboarding has no usage history yet, so none is made up
 * for its people: counts read zero and durations a dash. The access pair
 * (roles, permissions) is replaced with real counts by the Overview tab. */
const NO_DATA = "No data yet";
function newCompanyInsights(): InsightMetric[] {
  return [
    { id: "total-logins", label: "Logins", value: "0", subtitle: "All time sign-ins", category: "engagement", iconName: "LogIn" },
    { id: "days-since-login", label: "Since Login", value: "-", subtitle: NO_DATA, category: "engagement", iconName: "Clock" },
    { id: "sessions-this-week", label: "Sessions/wk", value: "0", subtitle: "Current week", category: "engagement", iconName: "Activity" },
    { id: "avg-session-duration", label: "Avg Session", value: "-", subtitle: NO_DATA, category: "engagement", iconName: "BarChart3" },
    { id: "password-age", label: "Pwd Age", value: "-", subtitle: NO_DATA, category: "security", iconName: "KeyRound" },
    { id: "failed-attempts", label: "Failed Attempts", value: "0", subtitle: "Last 30 days", category: "security", iconName: "Lock" },
    { id: "mfa-status", label: "MFA Status", value: "Disabled", subtitle: "Action required", category: "security", iconName: "ShieldCheck" },
    { id: "roles-assigned", label: "Roles", value: "0", subtitle: "Active roles", category: "access", iconName: "Shield" },
    { id: "permissions-count", label: "Permissions", value: "0", subtitle: "Across all roles", category: "access", iconName: "Users" },
  ];
}

export function getUserDetailInsights(userId: number): InsightMetric[] {
  if (isNewTenant()) return newCompanyInsights();
  const seed = userId * 7 + 3;
  const totalLogins = 24 + (seed % 180);
  const daysSinceLogin = seed % 14;
  const sessionsThisWeek = 1 + (seed % 12);
  const avgSessionMin = 12 + (seed % 45);
  const passwordAgeDays = 15 + (seed % 200);
  const failedAttempts = seed % 4;
  const rolesCount = 1 + (seed % 5);
  const permissionsCount = 8 + (seed % 40);

  // Profile completion calculation
  const completionPct = Math.min(100, 60 + (seed % 41));

  return [
    // ENGAGEMENT
    { id: "total-logins", label: "Logins", value: String(totalLogins), subtitle: "All time sign-ins", category: "engagement", iconName: "LogIn" },
    { id: "days-since-login", label: "Since Login", value: `${daysSinceLogin}d`, subtitle: daysSinceLogin <= 3 ? "Recently active" : "Check-in needed", category: "engagement", iconName: "Clock" },
    { id: "sessions-this-week", label: "Sessions/wk", value: String(sessionsThisWeek), subtitle: "Current week", category: "engagement", iconName: "Activity" },
    { id: "avg-session-duration", label: "Avg Session", value: `${avgSessionMin}m`, subtitle: "Per session avg", category: "engagement", iconName: "BarChart3" },

    // SECURITY
    { id: "password-age", label: "Pwd Age", value: `${passwordAgeDays}d`, subtitle: passwordAgeDays > 90 ? "Renewal recommended" : "Within policy", category: "security", iconName: "KeyRound" },
    { id: "failed-attempts", label: "Failed Attempts", value: String(failedAttempts), subtitle: "Last 30 days", category: "security", iconName: "Lock" },
    { id: "mfa-status", label: "MFA Status", value: userId % 3 !== 0 ? "Enabled" : "Disabled", subtitle: userId % 3 !== 0 ? "Account secured" : "Action required", category: "security", iconName: "ShieldCheck" },

    // ACCESS
    { id: "roles-assigned", label: "Roles", value: String(rolesCount), subtitle: "Active roles", category: "access", iconName: "Shield" },
    { id: "permissions-count", label: "Permissions", value: String(permissionsCount), subtitle: "Across all roles", category: "access", iconName: "Users" },
  ];
}

export const USER_DETAIL_DEFAULT_VISIBLE = [
  "total-logins",
  "days-since-login",
  "sessions-this-week",
  "avg-session-duration",
  "password-age",
  "roles-assigned",
];
