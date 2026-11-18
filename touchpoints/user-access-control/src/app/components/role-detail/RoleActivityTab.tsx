import { useState, useMemo } from "react";
import {
  Shield,
  UserPlus,
  UserMinus,
  Lock,
  Settings,
  Activity,
  Search,
  Plus,
  Copy,
} from "lucide-react";
import type { RoleDetail, RoleActivityEntry } from "../../data/role-detail-data";
import { highlightMatch } from "../../lib/highlight-text";

interface Props {
  role: RoleDetail;
}

const TYPE_CONFIG: Record<
  RoleActivityEntry["type"],
  { icon: typeof Shield; bg: string; color: string; label: string }
> = {
  role_created: { icon: Plus, bg: "#ECFDF5", color: "#059669", label: "Created" },
  role_duplicated: { icon: Copy, bg: "#EEF2FF", color: "#4F46E5", label: "Duplicated" },
  user_assigned: { icon: UserPlus, bg: "#EFF6FF", color: "#2563EB", label: "User Assigned" },
  user_removed: { icon: UserMinus, bg: "#FEF2F2", color: "#DC2626", label: "User Removed" },
  permission_change: { icon: Lock, bg: "#EDE9FE", color: "#7C3AED", label: "Permission" },
  config_change: { icon: Settings, bg: "#FFF7ED", color: "#D97706", label: "Config" },
  status_change: { icon: Activity, bg: "#F0F9FF", color: "#0284C7", label: "Status" },
};

const FILTER_OPTIONS = [
  { key: "all", label: "All Activity" },
  { key: "user_assigned", label: "Users Assigned" },
  { key: "role_duplicated", label: "Duplicated" },
  { key: "permission_change", label: "Permissions" },
  { key: "config_change", label: "Configuration" },
  { key: "status_change", label: "Status" },
  { key: "role_created", label: "Created" },
];

export function RoleActivityTab({ role }: Props) {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLog = useMemo(() => {
    let result = role.activityLog;
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
  }, [role.activityLog, filter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div
        className="rounded-xl border bg-white px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{
          borderColor: "#E2E8F0",
          boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04)",
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "#94A3B8" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            className="w-full h-9 pl-9 pr-3 border rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]"
            style={{ borderColor: "#E2E8F0" }}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_OPTIONS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap cursor-pointer transition-colors"
                style={{
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "#007FFF" : "#64748B",
                  backgroundColor: isActive ? "#EDF4FF" : "transparent",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {filteredLog.length > 1 && (
          <div
            className="absolute top-5 bottom-5 w-px"
            style={{ left: "19px", backgroundColor: "#E2E8F0" }}
          />
        )}

        <div className="space-y-0">
          {filteredLog.length === 0 ? (
            <div className="text-center py-12">
              <Activity
                className="w-8 h-8 mx-auto mb-3"
                style={{ color: "#CBD5E1" }}
              />
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                No Activity Found
              </p>
            </div>
          ) : (
            filteredLog.map((entry) => {
              const cfg = TYPE_CONFIG[entry.type];
              const Icon = cfg.icon;

              return (
                <div
                  key={entry.id}
                  className="relative flex items-start gap-4 pb-5"
                >
                  {/* Icon node */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Icon
                      className="w-[18px] h-[18px]"
                      style={{ color: cfg.color }}
                    />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 rounded-xl border bg-white px-4 py-3.5 hover:border-[#CBD5E1] transition-colors"
                    style={{
                      borderColor: "#F1F5F9",
                      boxShadow: "0 1px 2px 0 rgba(15,23,42,0.03)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-[13px]"
                          style={{ fontWeight: 600, color: "#0F172A" }}
                        >
                          {highlightMatch(entry.title, searchQuery)}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: cfg.bg,
                            color: cfg.color,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <span
                        className="text-xs shrink-0 whitespace-nowrap"
                        style={{ color: "#94A3B8", fontWeight: 400 }}
                      >
                        {entry.timestamp}
                      </span>
                    </div>
                    <p
                      className="text-[12.5px]"
                      style={{
                        color: "#64748B",
                        fontWeight: 400,
                        lineHeight: "18px",
                      }}
                    >
                      {highlightMatch(entry.description, searchQuery)}
                    </p>
                    {entry.actor && (
                      <p
                        className="text-xs mt-1.5"
                        style={{ color: "#94A3B8", fontWeight: 400 }}
                      >
                        by {highlightMatch(entry.actor, searchQuery)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}