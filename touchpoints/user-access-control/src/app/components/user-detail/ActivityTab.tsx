import { useState, useMemo } from "react";
import { highlightMatch } from "../../lib/highlight-text";
import {
  LogIn,
  Shield,
  UserCog,
  KeyRound,
  Send,
  Activity,
  Lock,
  Search,
  Monitor,
  Clock,
  Ban,
} from "lucide-react";
import { DetailCard } from "./DetailCard";
import type { UserDetail, ActivityEntry } from "../../data/user-detail-data";
import { isPreLoginStatus } from "../../data/user-detail-data";
import { isNewTenant } from "../../data/tenant";
import { toast } from "sonner";
import { useAccessMode } from "../access-mode";

interface Props {
  user: UserDetail;
  /** Archived users are read-only, action affordances are hidden. */
  archived?: boolean;
}

const TYPE_CONFIG: Record<
  ActivityEntry["type"],
  { icon: typeof LogIn; bg: string; color: string; label: string }
> = {
  login: { icon: LogIn, bg: "#dbeafe", color: "#1e40af", label: "Sign In" },
  role_change: { icon: Shield, bg: "#dcfce7", color: "#166534", label: "Role Change" },
  profile_update: { icon: UserCog, bg: "#f3f4f6", color: "#374151", label: "Profile" },
  password_reset: { icon: KeyRound, bg: "#fef3c7", color: "#92400e", label: "Password" },
  invite: { icon: Send, bg: "#dbeafe", color: "#1e40af", label: "Invitation" },
  status_change: { icon: Activity, bg: "#F0F9FF", color: "#0284C7", label: "Status" },
  permission_change: { icon: Lock, bg: "#FFF1F2", color: "#E11D48", label: "Permission" },
};

const FILTER_OPTIONS = [
  { key: "all", label: "All Activity" },
  { key: "login", label: "Sign Ins" },
  { key: "role_change", label: "Role Changes" },
  { key: "profile_update", label: "Profile Updates" },
  { key: "password_reset", label: "Password" },
  { key: "invite", label: "Invitations" },
  { key: "status_change", label: "Status" },
  { key: "permission_change", label: "Permissions" },
];

/* ── Format event copy per spec: P-7 ── */
function formatEventCopy(entry: ActivityEntry): { title: string; body: string } {
  switch (entry.type) {
    case "login":
      return { title: "Signed In", body: entry.description };
    case "role_change": {
      const roleName = entry.description.match(/(\w[\w\s]+?) role/)?.[1] || "Unknown";
      return { title: "Role Assigned", body: `Role ${roleName} assigned by ${entry.actor || "System"}` };
    }
    case "password_reset":
      return { title: "Password Changed", body: "Password changed" };
    case "profile_update": {
      const fieldMatch = entry.description.match(/Updated (.+)/);
      const fieldCount = fieldMatch ? fieldMatch[1].split(" and ").length + (fieldMatch[1].includes(",") ? fieldMatch[1].split(",").length - 1 : 0) : 1;
      return { title: "Profile Updated", body: `Profile updated, ${fieldCount} field${fieldCount !== 1 ? "s" : ""} changed` };
    }
    case "invite":
      return { title: entry.title, body: entry.description };
    default:
      return { title: entry.title, body: entry.description };
  }
}

/* ── Insights Sidebar Card: P-7 ── */
function InsightsSidebarCard({ user }: { user: UserDetail }) {
  const seed = (user.id ?? 1) * 7 + 3;
  /* Made-up usage figures. A company from onboarding has no history yet,
   * so its people read like someone who hasn't signed in: zeros and dashes. */
  const preLogin = isPreLoginStatus(user.status) || isNewTenant();
  const logins = preLogin ? 0 : 24 + (seed % 180);
  const sinceLogin = seed % 14;
  const sessionsWk = preLogin ? 0 : 1 + (seed % 12);
  const pwdAge = 15 + (seed % 200);
  const roles = user.roleAssignments?.length ?? 1;

  const fields = [
    !!user.firstName && !!user.lastName, !!user.email, user.phones?.length > 0,
    !!user.dateOfBirth, user.jobTitle !== "Team Member",
    user.mfaEnabled, user.emergencyContacts?.length > 0, user.addresses?.length > 0, user.languages?.length > 0,
  ];
  const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  const stats = [
    { label: "Completion", value: `${pct}%`, color: pct === 100 ? "#10b981" : undefined },
    { label: "Logins", value: String(logins) },
    { label: "Since Login", value: preLogin ? "-" : `${sinceLogin}d`, color: !preLogin && sinceLogin > 7 ? "#f59e0b" : undefined },
    { label: "Sessions/wk", value: String(sessionsWk) },
    { label: "Pwd Age", value: preLogin ? "-" : `${pwdAge}d` },
    { label: "Roles", value: String(roles) },
  ];

  return (
    <DetailCard title="Insights · 30 Days" icon={Monitor}>
      <div className="py-3">
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="text-center rounded-[8px] p-3" style={{ backgroundColor: "#F8FAFC" }}>
              <p className="text-[11px] mb-0.5" style={{ fontWeight: 400, color: "#94A3B8" }}>{s.label}</p>
              <p className="text-[18px]" style={{ fontWeight: 600, color: s.color || "#0F172A" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </DetailCard>
  );
}

export function ActivityTab({ user, archived = false }: Props) {
  const access = useAccessMode();
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLog = useMemo(() => {
    let result = user.activityLog;
    if (filter !== "all") {
      result = result.filter((e) => e.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.actor && e.actor.toLowerCase().includes(q))
      );
    }
    return result;
  }, [user.activityLog, filter, searchQuery]);

  return (
    <div className="flex gap-5 items-start">
      {/* LEFT COLUMN: Timeline */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Toolbar */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activity..."
              className="w-full h-9 pl-9 pr-3 border rounded-[8px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#2563eb]/20 focus:border-[#2563eb] transition-all"
              style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {FILTER_OPTIONS.map((f) => {
              const isActive = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 py-1.5 text-[12px] whitespace-nowrap cursor-pointer transition-all duration-100"
                  style={{
                    fontWeight: 500,
                    color: isActive ? "#ffffff" : "#374151",
                    backgroundColor: isActive ? "#2563eb" : "transparent",
                    border: isActive ? "1px solid transparent" : "1px solid #E2E8F0",
                    borderRadius: "16px",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline card */}
        <DetailCard title="Activity & Timeline" icon={Activity}>
          <div className="py-3">

          <div className="relative">
            {/* Connector line */}
            {filteredLog.length > 1 && (
              <div className="absolute w-px" style={{ left: "17px", top: "20px", bottom: "20px", backgroundColor: "#e5e7eb" }} />
            )}
            <div className="space-y-6">
              {filteredLog.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: "#d1d5db" }} />
                  <p className="text-sm" style={{ color: "#6b7280" }}>No Activity Found</p>
                </div>
              ) : (
                filteredLog.map((entry) => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const Icon = cfg.icon;
                  const copy = formatEventCopy(entry);
                  return (
                    <div key={entry.id} className="relative flex items-start gap-4">
                      {/* Icon circle, 36px */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative z-10"
                        style={{ backgroundColor: cfg.bg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px]" style={{ fontWeight: 600, color: "#111827" }}>{highlightMatch(copy.title, searchQuery)}</span>
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                              style={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 500 }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <span className="text-[12px] shrink-0 whitespace-nowrap" style={{ color: "#6b7280", fontWeight: 400 }}>
                            {entry.timestamp}
                          </span>
                        </div>
                        <p className="text-[13px]" style={{ color: "#4b5563", fontWeight: 400, lineHeight: "18px" }}>
                          {highlightMatch(copy.body, searchQuery)}
                        </p>
                        {entry.actor && (
                          <p className="text-[12px] mt-1" style={{ color: "#6b7280", fontWeight: 400 }}>by {highlightMatch(entry.actor, searchQuery)}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer link */}
          <div className="pt-4 mt-4 border-t" style={{ borderColor: "#f3f4f6" }}>
            <button
              className="text-[13px] cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: "#2563eb" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#1d4ed8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#2563eb"; }}
            >
              View All Activity →
            </button>
          </div>
          </div>
        </DetailCard>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-[340px] xl:w-[380px] shrink-0 space-y-5 hidden lg:block">
        <InsightsSidebarCard user={user} />

        {/* Quick Actions */}
        <DetailCard title="Quick Actions" icon={Activity}>
          <div className="py-2 space-y-1">
            {[
              { label: "View Time Logs", icon: Clock, color: "#1E293B", iconColor: "#94A3B8", action: () => toast.info("Time logs view coming soon") },
              // Reset password / Deactivate are edit affordances, hidden while
              // archived and gated on their own capability per persona.
              ...(!archived && access.canResetCredentials
                ? [
                    { label: "Reset Password", icon: KeyRound, color: "#1E293B", iconColor: "#94A3B8", action: () => toast.success("Password reset email sent", { description: `A password reset link was sent to ${user.email}.` }) },
                  ]
                : []),
              ...(!archived && access.canArchiveUser
                ? [
                    { label: "Deactivate User", icon: Ban, color: "#dc2626", iconColor: "#dc2626", action: () => {} },
                  ]
                : []),
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] transition-colors cursor-pointer text-left"
                style={{ fontWeight: 500, color: item.color }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <item.icon className="w-4 h-4" style={{ color: item.iconColor }} />
                {item.label}
              </button>
            ))}
          </div>
        </DetailCard>
      </div>
    </div>
  );
}
