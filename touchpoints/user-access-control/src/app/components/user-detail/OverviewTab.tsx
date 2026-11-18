import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Trash2 } from "lucide-react";
import {
  User,
  Shield,
  Lock,
  Check,
  Building2,
  Mail,
  Info,
  ChevronRight,
  Send,
  Clock,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Activity as ActivityIcon,
  StickyNote,
  KeyRound,
  Smartphone,
  Monitor,
  LogIn,
  UserCog,
  ShieldCheck,
  Phone,
  MapPin,
  Archive,
  AlertTriangle,
  Crown,
  Warehouse,
  ClipboardCheck,
  BarChart2,
  ShieldAlert,
  Calendar,
  ChevronDown,
  RotateCcw,
  Sliders,
  type LucideIcon,
} from "lucide-react";
import { getLicenseInaccessibleRoles } from "../../lib/role-license";
import { formatFullPhone } from "../../lib/phone-format";
import { UnarchiveUserModal } from "./UnarchiveUserModal";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { DetailCard } from "./DetailCard";
import { FieldPair } from "../shared/FieldPair";
import { UserSummaryTooltip } from "../shared/UserSummaryTooltip";
import {
  PerformanceInsights,
  DATE_OPTIONS,
  dateRangeLabel,
  type DateRangeKey,
  type InsightMetric,
} from "../shared/PerformanceInsights";
import { DateRangeSelector } from "../shared/DateRangeSelector";
import { WidgetsCustomizePanel, type WidgetMeta } from "./WidgetsCustomizePanel";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import {
  getUserDetailInsights,
  USER_DETAIL_CATEGORIES,
  USER_DETAIL_DEFAULT_VISIBLE,
} from "../../data/user-detail-insights-data";
import type { UserDetail, ActivityEntry, LoginDevice } from "../../data/user-detail-data";
import { isPreLoginStatus } from "../../data/user-detail-data";
import { isNewTenant } from "../../data/tenant";
import { OverflowTooltip, type OverflowItem } from "../shared/OverflowTooltip";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { roleNameToOptionId } from "../../data/roles-data";
import { getPermissionsForRoles } from "../../data/role-permissions-map";
import { getDirectPermissionIds } from "../../data/user-direct-permissions-data";
import { PermissionDetailModal } from "../permissions/PermissionDetailModal";
import {
  getManageRolesConfig,
  subscribeManageRolesScope,
} from "../../data/manage-roles-scope-data";
import { useSyncExternalStore } from "react";
import { formatNoteTime, sortNotesNewestFirst, useUserNotes } from "../../data/user-notes";

type ChartSize = "sm" | "md" | "lg";
const CHART_HEIGHTS: Record<ChartSize, number> = { sm: 150, md: 200, lg: 280 };

/* Empty state for activity widgets when a user has never signed in
 * (invite pending / expired / pending setup), there is no login, session,
 * or device history to collect yet, so we show a placeholder instead of
 * fabricated data. Fills the widget's chart height so cards keep their size. */
function WidgetEmptyState({
  icon: Icon,
  title,
  subtitle,
  minHeight,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  minHeight?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-2 px-6 py-8"
      style={minHeight ? { minHeight } : undefined}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#F1F5F9" }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />
      </div>
      <p className="text-[13px]" style={{ fontWeight: 550, color: "#475569" }}>
        {title}
      </p>
      <p className="text-[12px] max-w-[280px]" style={{ color: "#94A3B8", lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </div>
  );
}

function ChartSizeToggle({
  size,
  onChange,
  visible,
}: {
  size: ChartSize;
  onChange: (s: ChartSize) => void;
  visible: boolean;
}) {
  const opts: { key: ChartSize; label: string }[] = [
    { key: "sm", label: "S" },
    { key: "md", label: "M" },
    { key: "lg", label: "L" },
  ];
  return (
    <div
      className="inline-flex items-center rounded-md border bg-white overflow-hidden transition-opacity duration-150"
      style={{
        borderColor: "#E2E8F0",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {opts.map((o) => {
        const active = size === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="px-2 py-0.5 text-[11px] transition-colors cursor-pointer"
            style={{
              fontWeight: 600,
              color: active ? "#fff" : "#64748B",
              backgroundColor: active ? "#007FFF" : "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  user: UserDetail;
  userStatus?: string;
  onStatusChange?: (status: string) => void;
  onLicenseChange?: (license: string) => void;
  onSwitchTab?: (tab: string) => void;
  /** Which flow produced the "created/restored but not invited" state, drives
   *  the Send-Invitation banner copy. Defaults to "created". */
  inviteContext?: "created" | "unarchived" | "cancelled";
}

/* Context-aware copy for the Send-Invitation banner. The "Send Invitation"
 * button label stays the same across all three. Reactivate has no entry: it
 * returns the user to Active, so it never leaves them awaiting an invite. */
const INVITE_BANNER_COPY: Record<
  NonNullable<Props["inviteContext"]>,
  { heading: string; sub: string }
> = {
  created: {
    heading: "This User Has Been Created but Has Not Been Invited Yet",
    sub: "Send an invitation so they can set up their account and access the system.",
  },
  unarchived: {
    heading: "This User Has Been Restored but Has Not Been Invited Yet",
    sub: "Send an invitation so they can set up their account again and regain access to the system.",
  },
  cancelled: {
    heading: "This User's Invitation Was Cancelled",
    sub: "Send a new invitation so they can set up their account and access the system.",
  },
};

/* ── FieldPair with UserSummaryTooltip on hover ── */
function UserFieldPair({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number | undefined | null;
  highlight?: boolean;
}) {
  const isEmpty = !value || value === "-" || value === "Not set";
  const displayValue = String(value || "Not set");
  return (
    <div className="min-w-0">
      <p
        className="mb-1 truncate"
        style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
      >
        {label}
      </p>
      {!isEmpty ? (
        <UserSummaryTooltip userName={displayValue}>
          <p
            className="text-[13px] truncate cursor-default"
            style={{ fontWeight: 500, color: highlight ? "#2563eb" : "#1E293B" }}
          >
            {displayValue}
          </p>
        </UserSummaryTooltip>
      ) : (
        <p
          className="text-[13px] truncate"
          style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
        >
          {displayValue}
        </p>
      )}
    </div>
  );
}

/* ── Key Permissions ── */
export interface KeyPermission {
  label: string;
  granted: boolean;
  subtitle?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  /** Pin entry to top of the list, regardless of insertion order */
  pinned?: boolean;
  /** Show a "View details" affordance next to the chevron */
  showViewDetailsLabel?: boolean;
}

/* Map known permission labels to contextually relevant icons. */
const PERMISSION_ICON_MAP: Record<string, LucideIcon> = {
  "Manage Warehouse Operations": Warehouse,
  "Create and Edit Purchase Orders": ClipboardCheck,
  "View Inventory Reports": BarChart2,
  "Financial Audit Access": ShieldAlert,
  "Manage Roles": Crown,
};

const KEY_PERMISSIONS_MAP: Record<number, KeyPermission[]> = {
  1: [
    { label: "Manage Warehouse Operations", granted: true },
    { label: "Create and Edit Purchase Orders", granted: true },
    { label: "View Inventory Reports", granted: true },
    { label: "Financial Audit Access", granted: false },
  ],
};

function getKeyPermissions(userId: number): KeyPermission[] {
  return (
    KEY_PERMISSIONS_MAP[userId] || [
      { label: "View Assigned Modules", granted: true },
      { label: "Submit Requests", granted: true },
      { label: "Admin Panel Access", granted: false },
    ]
  );
}

/* ── Helpers ── */
function formatDob(dob: string | undefined) {
  if (!dob) return undefined;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return dob;
  return dob
    .replace(/\./g, " ")
    .replace(/(\d{2}) (\d{2}) (\d{4})/, (_, d, m, y) => `${m}/${d}/${y}`);
}

/* ── Stat row used under chart cards ── */
function StatRow({
  stats,
}: {
  stats: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-[#F1F5F9]">
      {stats.map((s, i) => (
        <div key={i}>
          <p className="text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
            {s.label}
          </p>
          <p
            className="text-[13px] mt-0.5"
            style={{ fontWeight: 700, color: s.color || "#334155" }}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Login Activity (bar chart) ── */
function LoginActivityCard({ user }: { user: UserDetail }) {
  const [size, setSize] = useState<ChartSize>("md");
  const [hovered, setHovered] = useState(false);
  // Deterministic per-user counts
  const seed = (user.id ?? 1) * 13 + 7;
  const base = [3, 7, 5, 8, 4, 1, 2];
  const data = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
    day,
    logins: Math.max(0, base[i] + ((seed + i * 3) % 4) - 1),
    sessions: Math.max(0, Math.floor(base[i] / 2) + ((seed + i) % 3) - 1),
  }));
  const totalLogins = data.reduce((a, b) => a + b.logins, 0);
  const totalSessions = data.reduce((a, b) => a + b.sessions, 0);
  const avgPerDay = (totalLogins / 7).toFixed(1);

  const ttStyle = {
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: 12,
  };

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <DetailCard
        title="Login Activity"
        icon={BarChart3}
        action={<ChartSizeToggle size={size} onChange={setSize} visible={hovered} />}
      >
        <div className="py-3">
          <div className="-ml-3 transition-all duration-200" style={{ height: CHART_HEIGHTS[size] }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <ReTooltip contentStyle={ttStyle} cursor={{ fill: "rgba(10,119,255,0.04)" }} />
                <Bar
                  dataKey="logins"
                  name="Logins"
                  fill="#0A77FF"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
                <Bar
                  dataKey="sessions"
                  name="Sessions"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <StatRow
            stats={[
              { label: "Total Logins", value: String(totalLogins) },
              { label: "Total Sessions", value: String(totalSessions) },
              { label: "Avg/Day", value: avgPerDay },
            ]}
          />
        </div>
      </DetailCard>
    </div>
  );
}

/* ── Session Trend (area/line chart) ── */
function SessionTrendCard({ user }: { user: UserDetail }) {
  const [size, setSize] = useState<ChartSize>("md");
  const [hovered, setHovered] = useState(false);
  const seed = (user.id ?? 1) * 11 + 5;
  const base = [12, 18, 22, 28, 32, 26, 30, 35, 38, 42, 34, 45];
  const data = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ].map((month, i) => ({
    month,
    value: Math.max(5, base[i] + ((seed + i * 5) % 9) - 4),
  }));
  const ytd = data.reduce((a, b) => a + b.value, 0);
  const avg = (ytd / 12).toFixed(1);
  const peak = data.reduce((max, d) => (d.value > max.value ? d : max), data[0]);

  const ttStyle = {
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: 12,
  };

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <DetailCard
        title="Session Trend"
        icon={TrendingUp}
        action={<ChartSizeToggle size={size} onChange={setSize} visible={hovered} />}
      >
        <div className="py-3">
          <div className="-ml-3 transition-all duration-200" style={{ height: CHART_HEIGHTS[size] }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <ReTooltip
                  contentStyle={ttStyle}
                  formatter={(v: number) => [`${v}`, "Sessions"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Sessions"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#sessionGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <StatRow
            stats={[
              { label: "YTD Total", value: String(ytd) },
              { label: "Monthly Avg", value: avg },
              { label: "Peak Month", value: peak.month },
            ]}
          />
        </div>
      </DetailCard>
    </div>
  );
}

/* ── Recent Activity Timeline ── */
const ACTIVITY_ICON_MAP: Record<
  ActivityEntry["type"],
  { icon: typeof LogIn; bg: string; color: string }
> = {
  login: { icon: LogIn, bg: "#DBEAFE", color: "#1E40AF" },
  role_change: { icon: Shield, bg: "#DCFCE7", color: "#166534" },
  profile_update: { icon: UserCog, bg: "#F3F4F6", color: "#374151" },
  password_reset: { icon: KeyRound, bg: "#FEF3C7", color: "#92400E" },
  invite: { icon: Send, bg: "#DBEAFE", color: "#1E40AF" },
  status_change: { icon: ActivityIcon, bg: "#F0F9FF", color: "#0284C7" },
  permission_change: { icon: Lock, bg: "#FFF1F2", color: "#E11D48" },
};

function RecentActivityCard({
  user,
  onSeeAll,
}: {
  user: UserDetail;
  onSeeAll?: () => void;
}) {
  const events = user.activityLog.slice(0, 5);
  return (
    <DetailCard title="Recent Activity" icon={ActivityIcon} bodyClassName="flex flex-col">
      <div className="py-3 space-y-3.5 flex-1">
        {events.length === 0 ? (
          <p
            className="text-[12px] py-4 text-center"
            style={{ color: "#94A3B8", fontStyle: "italic" }}
          >
            No Recent Activity
          </p>
        ) : (
          events.map((e) => {
            const cfg = ACTIVITY_ICON_MAP[e.type];
            const Icon = cfg.icon;
            return (
              <div key={e.id} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] truncate"
                    style={{ fontWeight: 500, color: "#1E293B" }}
                  >
                    {e.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>
                    {e.actor ? `${e.actor} · ` : ""}
                    {e.timestamp}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {events.length > 0 && (
        <div className="pt-2 pb-3">
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 text-[13px] cursor-pointer transition-colors group"
            style={{ fontWeight: 500, color: "#2563eb" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
          >
            View all activity
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </DetailCard>
  );
}

/* ── Notes Card ── */
const NOTES_DATA = [
  {
    id: 1,
    author: "Andrea Davis",
    date: "03/15/2026",
    text: "Discussed role transition during Q1 planning. Expressed interest in moving to a warehouse supervisor position when a spot opens up.",
  },
  {
    id: 2,
    author: "Taylor Dimas",
    date: "02/20/2026",
    text: "Completed onboarding checklist. All required training modules finished ahead of schedule.",
  },
];

function NotesCard({ onSeeAll }: { onSeeAll?: () => void }) {
  return (
    <DetailCard title="Notes" icon={StickyNote} bodyClassName="flex flex-col">
      <div className="py-3 space-y-3 flex-1">
        {NOTES_DATA.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border px-3.5 py-3"
            style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
              >
                {n.author
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <span className="text-[12px]" style={{ fontWeight: 600, color: "#1E293B" }}>
                {n.author}
              </span>
              <span className="text-[11px]" style={{ color: "#94A3B8" }}>
                {n.date}
              </span>
            </div>
            <p
              className="text-[12.5px]"
              style={{ color: "#475569", lineHeight: "1.5" }}
            >
              {n.text}
            </p>
          </div>
        ))}
      </div>
      <div className="pt-2 pb-3">
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-[13px] cursor-pointer transition-colors group"
          style={{ fontWeight: 500, color: "#2563eb" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1d4ed8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
        >
          View all notes
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </DetailCard>
  );
}

/* ── Contact & Address Sidebar Card ── */
function ContactAddressCard({ user }: { user: UserDetail }) {
  const allEmails: { label: string; value: string; isPrimary?: boolean }[] = [];
  if (user.email) allEmails.push({ label: "System", value: user.email, isPrimary: true });
  if (user.additionalEmails?.length) {
    user.additionalEmails.forEach((e) => {
      if (typeof e === "string") {
        allEmails.push({ label: "Personal", value: e });
      } else {
        const entry = e as any;
        allEmails.push({ label: entry.type || "Other", value: entry.email || entry.value || "" });
      }
    });
  }

  return (
    <DetailCard title="Contact & Address" icon={Mail} collapsible defaultOpen>
      <div className="py-4 space-y-4">
        {/* Emails */}
        <div className="space-y-3">
          {allEmails.length > 0 ? (
            allEmails.map((em, i) => (
              <div key={i}>
                <div className="flex items-center gap-1.5 mb-1">
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 450,
                      color: "#94A3B8",
                      lineHeight: "1.3",
                    }}
                  >
                    {em.label} Email
                  </p>
                  {em.isPrimary && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ fontWeight: 600, backgroundColor: "#EDF4FF", color: "#007FFF" }}
                    >
                      Primary
                    </span>
                  )}
                  {i === 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-default">
                          <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4} className="max-w-[220px] text-[12px]">
                        This email address is used for notifications and sign-in.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
                  {em.value}
                </p>
              </div>
            ))
          ) : (
            <p
              className="text-[12px]"
              style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
            >
              No Email Addresses Added
            </p>
          )}
        </div>

        <div className="border-t" style={{ borderColor: "#F1F5F9" }} />

        {/* Phone Numbers */}
        <div className="space-y-3">
          {user.phones?.length ? (
            user.phones.map((phone, i) => (
              <FieldPair
                key={i}
                label={phone.type}
                value={formatFullPhone(phone.countryCode, phone.number)}
              />
            ))
          ) : (
            <p
              className="text-[12px]"
              style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
            >
              No Phone Numbers Added
            </p>
          )}
        </div>

        <div className="border-t" style={{ borderColor: "#F1F5F9" }} />

        {/* Addresses */}
        <div className="space-y-3">
          {user.addresses?.length ? (
            user.addresses.map((addr, i) => (
              <FieldPair key={i} label={`${addr.type} Address`} value={addr.address} />
            ))
          ) : (
            <p
              className="text-[12px]"
              style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
            >
              No Addresses Added
            </p>
          )}
        </div>
      </div>
    </DetailCard>
  );
}

/* ── Emergency Contacts Sidebar Card (amber tinted, collapsible) ── */
function EmergencyContactsCard({ user }: { user: UserDetail }) {
  // Local collapse state, kept inline so the amber-tinted chrome stays
  // bespoke (DetailCard uses a neutral header). Mirrors the open/close
  // animation used by DetailCard's collapsible mode.
  const [isOpen, setIsOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [user.emergencyContacts]);

  return (
    <div
      className="rounded-xl border overflow-hidden bg-white"
      style={{
        borderColor: "#E2E8F0",
        boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header matches the neutral DetailCard chrome, only the icon and
       *  title carry the amber accent so the card still reads as the
       *  "emergency" one without overwhelming the sidebar palette. */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full text-left flex items-center gap-2.5 px-5 py-3.5 transition-colors bg-white hover:bg-[#FAFBFC]"
        style={{
          borderBottom: isOpen ? "1px solid #F1F5F9" : "1px solid transparent",
        }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: "#FEF3C7" }}
        >
          <Phone className="w-3.5 h-3.5" style={{ color: "#92400E" }} />
        </div>
        <h3 className="text-[13.5px] flex-1" style={{ fontWeight: 600, color: "#92400E" }}>
          Emergency Contacts
        </h3>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          style={{
            color: "#94A3B8",
            transform: isOpen ? "rotate(0deg)" : "rotate(180deg)",
          }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 16 + "px" : "1000px") : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
      <div ref={contentRef} className="px-5 py-4">
        {user.emergencyContacts?.length ? (
          <div className="space-y-3">
            {user.emergencyContacts.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px]" style={{ fontWeight: 500, color: "#1E293B" }}>
                    {c.fullName} · {c.relationship}
                  </p>
                  {c.isPrimary && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        fontWeight: 600,
                        backgroundColor: "#FEF3C7",
                        color: "#92400E",
                      }}
                    >
                      Primary
                    </span>
                  )}
                </div>
                <a
                  href={`tel:${c.countryCode}${c.phone}`}
                  className="text-[13px] transition-colors"
                  style={{ fontWeight: 500, color: "#2563eb" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#1d4ed8";
                    e.currentTarget.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#2563eb";
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  {c.countryCode} {c.phone}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-[12px]"
            style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
          >
            No Emergency Contacts Added
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

/* ── Roles & Permissions Sidebar Card ── */
function RolesPermissionsCard({
  user,
  keyPermissions,
  onViewDetails,
  onViewAllRoles,
  onViewAllPermissions,
  archived = false,
}: {
  user: UserDetail;
  keyPermissions: KeyPermission[];
  onViewDetails?: () => void;
  onViewAllRoles?: () => void;
  onViewAllPermissions?: () => void;
  archived?: boolean;
}) {
  const MAX_VISIBLE = 3;
  const visibleRoles = user.roleAssignments.slice(0, MAX_VISIBLE);
  const extraRolesCount = user.roleAssignments.length - visibleRoles.length;
  if (archived) {
    return (
      <DetailCard title="Roles & Permissions" icon={Shield} collapsible defaultOpen>
        <div className="py-8 flex flex-col items-center text-center">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "#F1F5F9" }}
          >
            <Shield className="w-5 h-5" style={{ color: "#94A3B8" }} />
          </div>
          <p className="text-[12.5px] max-w-[260px] leading-relaxed" style={{ color: "#64748B" }}>
            No Roles Assigned While Archived.
          </p>
        </div>
      </DetailCard>
    );
  }
  return (
    <DetailCard title="Roles & Permissions" icon={Shield} collapsible defaultOpen>
      <div className="py-4 space-y-4">
        {/* Assigned Roles */}
        <div>
          <p
            className="mb-2.5"
            style={{ fontSize: "12px", fontWeight: 500, color: "#64748B" }}
          >
            Assigned Roles
          </p>
          <div className="space-y-2">
            {visibleRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2.5 rounded-[8px] border px-3 py-2.5"
                style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFC" }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#EDF4FF" }}
                >
                  {role.isSystem ? (
                    <Lock className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                  ) : (
                    <Shield className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                  )}
                </div>
                <span
                  className="text-[13px] truncate flex-1 min-w-0"
                  style={{ fontWeight: 500, color: "#1E293B" }}
                >
                  {role.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "#F1F5F9" }} />

        {/* Key Permissions */}
        <div>
          <p
            className="mb-2.5"
            style={{ fontSize: "12px", fontWeight: 500, color: "#64748B" }}
          >
            Key Permissions
          </p>
          <div className="space-y-2">
            {(() => {
              const sorted = [...keyPermissions].sort(
                (a, b) => Number(!!b.pinned) - Number(!!a.pinned),
              );
              const visiblePerms = sorted.slice(0, 3);
              return visiblePerms.map((perm, idx) => {
              const clickable = !!perm.onClick;
              const Wrapper = clickable ? "button" : "div";
              const PermIcon =
                perm.icon ||
                PERMISSION_ICON_MAP[perm.label] ||
                (perm.granted ? Check : Lock);
              const iconIsLock = !perm.granted;
              return (
                <Wrapper
                  key={idx}
                  type={clickable ? "button" : undefined}
                  onClick={clickable ? perm.onClick : undefined}
                  className={`w-full text-left flex items-center gap-2.5 rounded-[8px] border px-3 py-2.5 transition-colors ${
                    clickable ? "cursor-pointer hover:border-[#93B8F7] hover:bg-[#F5F9FF]" : ""
                  }`}
                  style={{
                    borderColor: perm.granted ? "#E2E8F0" : "#F1F5F9",
                    backgroundColor: "#FAFBFC",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: perm.granted ? "#ECFDF5" : "#F8FAFC" }}
                  >
                    {iconIsLock ? (
                      <Lock className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                    ) : (
                      <PermIcon className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] truncate block"
                      style={{
                        fontWeight: 450,
                        color: perm.granted ? "#1E293B" : "#94A3B8",
                      }}
                    >
                      {perm.label}
                    </span>
                    {perm.subtitle && (
                      <span
                        className="text-[11.5px] truncate block mt-0.5"
                        style={{ color: "#64748B" }}
                      >
                        {perm.subtitle}
                      </span>
                    )}
                  </div>
                  {clickable && perm.showViewDetailsLabel && (
                    <span
                      className="text-[11.5px] shrink-0"
                      style={{ color: "#2563eb", fontWeight: 500 }}
                    >
                      View Details
                    </span>
                  )}
                  {clickable && (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                  )}
                </Wrapper>
              );
            });
            })()}
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "#F1F5F9" }} />

        {/* View Details CTA */}
        <button
          onClick={() => onViewDetails?.()}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] rounded-[8px] border bg-white px-3 py-2 cursor-pointer transition-colors shadow-sm group"
          style={{ fontWeight: 500, color: "#2563eb", borderColor: "#BFDBFE" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#1d4ed8";
            e.currentTarget.style.borderColor = "#93B8F7";
            e.currentTarget.style.backgroundColor = "#F5F9FF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#2563eb";
            e.currentTarget.style.borderColor = "#BFDBFE";
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
        >
          See all roles and permissions
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </DetailCard>
  );
}

/* ── Overview header bar: heading + date filter + refresh + reset/customize ── */
function OverviewHeaderBar({
  onRefresh,
  onReset,
  onCustomize,
  dateRange,
  onDateRangeChange,
}: {
  onRefresh: () => void;
  onReset: () => void;
  onCustomize: () => void;
  dateRange: DateRangeKey;
  onDateRangeChange: (key: DateRangeKey) => void;
}) {
  // Pin the "Updated" timestamp at mount so it doesn't tick every render.
  const updatedAt = useRef(
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  ).current;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "#64748B" }}>
        <span className="text-sm" style={{ fontWeight: 500, color: "#334155" }}>
          Overview
        </span>
        <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
        <span style={{ color: "#CBD5E1" }}>|</span>
        <span className="text-[11px]" style={{ color: "#94A3B8" }}>
          Updated {updatedAt}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer hover:text-[#0862D4]"
          style={{ fontWeight: 500, color: "#0A77FF" }}
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-white text-[12px] shadow-sm transition-all cursor-pointer hover:bg-[#F8FAFC]"
          style={{ fontWeight: 500, color: "#334155", borderColor: "#E2E8F0" }}
        >
          <RotateCcw className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} /> Reset
        </button>
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-white text-[12px] shadow-sm transition-all cursor-pointer hover:bg-[#F8FAFC]"
          style={{ fontWeight: 500, color: "#334155", borderColor: "#E2E8F0" }}
        >
          <Sliders className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} /> Customize
          Widgets
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Body-only widget content (rendered inside WidgetCardShell)     */
/*  Kept separate from the *Card variants above so the chrome      */
/*  (drag header + size toggle + trash) can be swapped in.         */
/* ═══════════════════════════════════════════════════════════════ */

function LoginActivityBody({ user, size }: { user: UserDetail; size: WidgetSize }) {
  if (isPreLoginStatus(user.status)) {
    return (
      <WidgetEmptyState
        icon={LogIn}
        title="No Login Activity Yet"
        subtitle="This user hasn't signed in. Activity will appear once they accept the invitation and log in."
        minHeight={CHART_HEIGHTS[size]}
      />
    );
  }
  const seed = (user.id ?? 1) * 13 + 7;
  const base = [3, 7, 5, 8, 4, 1, 2];
  /* Made-up figures; a company from onboarding has no history to chart yet. */
  const fresh = isNewTenant();
  const data = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
    day,
    logins: fresh ? 0 : Math.max(0, base[i] + ((seed + i * 3) % 4) - 1),
    sessions: fresh ? 0 : Math.max(0, Math.floor(base[i] / 2) + ((seed + i) % 3) - 1),
  }));
  const totalLogins = data.reduce((a, b) => a + b.logins, 0);
  const totalSessions = data.reduce((a, b) => a + b.sessions, 0);
  const avgPerDay = (totalLogins / 7).toFixed(1);
  const ttStyle = {
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: 12,
  };
  return (
    <div className="py-3">
      <div className="-ml-3 transition-all duration-200" style={{ height: CHART_HEIGHTS[size] }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />
            <ReTooltip contentStyle={ttStyle} cursor={{ fill: "rgba(10,119,255,0.04)" }} />
            <Bar dataKey="logins" name="Logins" fill="#0A77FF" radius={[4, 4, 0, 0]} barSize={size === "sm" ? 14 : 24} />
            <Bar dataKey="sessions" name="Sessions" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={size === "sm" ? 14 : 24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <StatRow
        stats={[
          { label: "Total Logins", value: String(totalLogins) },
          { label: "Total Sessions", value: String(totalSessions) },
          { label: "Avg/Day", value: avgPerDay },
        ]}
      />
    </div>
  );
}

function SessionTrendBody({ user, size }: { user: UserDetail; size: WidgetSize }) {
  if (isPreLoginStatus(user.status)) {
    return (
      <WidgetEmptyState
        icon={TrendingUp}
        title="No Session Data Yet"
        subtitle="Session trends start once this user accepts the invitation and begins using their account."
        minHeight={CHART_HEIGHTS[size]}
      />
    );
  }
  const seed = (user.id ?? 1) * 11 + 5;
  const base = [12, 18, 22, 28, 32, 26, 30, 35, 38, 42, 34, 45];
  /* Made-up figures; a company from onboarding has no history to chart yet. */
  const fresh = isNewTenant();
  const data = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
    (month, i) => ({ month, value: fresh ? 0 : Math.max(5, base[i] + ((seed + i * 5) % 9) - 4) }),
  );
  const ytd = data.reduce((a, b) => a + b.value, 0);
  const avg = (ytd / 12).toFixed(1);
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0]);
  const peakMonth = ytd === 0 ? "-" : peak.month;
  const ttStyle = {
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: 12,
  };
  return (
    <div className="py-3">
      <div className="-ml-3 transition-all duration-200" style={{ height: CHART_HEIGHTS[size] }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="sessionGradBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={24} />
            <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}`, "Sessions"]} />
            <Area
              type="monotone"
              dataKey="value"
              name="Sessions"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#sessionGradBody)"
              dot={false}
              activeDot={{ r: 4, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <StatRow
        stats={[
          { label: "YTD Total", value: String(ytd) },
          { label: "Monthly Avg", value: avg },
          { label: "Peak Month", value: peakMonth },
        ]}
      />
    </div>
  );
}

/* Small rounded container holding the device-type icon. */
function DeviceIcon({ kind }: { kind: LoginDevice["kind"] }) {
  const Icon = kind === "mobile" ? Smartphone : Monitor;
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#F1F5F9" }}
    >
      <Icon className="w-4 h-4" style={{ color: "#475569" }} />
    </div>
  );
}

function LoginDevicesBody({ user }: { user: UserDetail }) {
  const devices = user.loginDevices ?? [];
  const first = devices[0];
  const overflow = devices.slice(1);
  const overflowItems: OverflowItem[] = overflow.map((d) => ({
    id: d.id,
    name: d.name,
    icon:
      d.kind === "mobile" ? (
        <Smartphone className="w-3.5 h-3.5" />
      ) : (
        <Monitor className="w-3.5 h-3.5" />
      ),
  }));

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <FieldPair label="Active Sessions" value={String(user.activeSessions ?? 1)} />
        {/* Total Login Devices: first device + "+N more" (hover reveals the
            rest), mirroring the Assigned Roles cell in the user listing. */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11.5px]" style={{ fontWeight: 450, color: "#94A3B8" }}>
            Total Login Devices
          </span>
          {first ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-[13.5px] truncate min-w-0"
                style={{ fontWeight: 500, color: "#0F172A" }}
              >
                {first.name}
              </span>
              {overflow.length > 0 && (
                <OverflowTooltip items={overflowItems} category="Devices">
                  <span
                    className="shrink-0 leading-none cursor-pointer"
                    style={{ fontSize: "11px", fontWeight: 600, color: "#085FCC" }}
                  >
                    +{overflow.length} more
                  </span>
                </OverflowTooltip>
              )}
            </div>
          ) : (
            <span className="text-[13.5px]" style={{ fontWeight: 500, color: "#0F172A" }}>
              -
            </span>
          )}
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "#F1F5F9" }} />
      <div>
        <p className="mb-2.5" style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>
          Recent Sessions
        </p>
        <div className="rounded-[8px] border divide-y" style={{ borderColor: "#F1F5F9" }}>
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 px-2.5 py-2" style={{ borderColor: "#F1F5F9" }}>
              <DeviceIcon kind={d.kind} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] truncate leading-tight" style={{ fontWeight: 600, color: "#1E293B" }}>
                  {d.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap" style={{ color: "#94A3B8" }}>
                  <span className="inline-flex items-center gap-1 text-[10.5px] leading-tight">
                    <Clock className="w-3 h-3 shrink-0" />
                    {d.lastActive}
                  </span>
                  <span className="text-[10.5px]" style={{ color: "#CBD5E1" }}>·</span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] leading-tight">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {d.location}
                  </span>
                </div>
              </div>
              {d.current && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#166534" }}>
                  Current
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentActivityBody({
  user,
  onSeeAll,
  size,
}: {
  user: UserDetail;
  onSeeAll?: () => void;
  size: WidgetSize;
}) {
  const limit = size === "sm" ? 3 : size === "lg" ? 8 : 5;
  const events = user.activityLog.slice(0, limit);
  return (
    <div className="flex flex-col">
      <div className="py-3 space-y-3.5 flex-1">
        {events.length === 0 ? (
          <p className="text-[12px] py-4 text-center" style={{ color: "#94A3B8", fontStyle: "italic" }}>
            No Recent Activity
          </p>
        ) : (
          events.map((e) => {
            const cfg = ACTIVITY_ICON_MAP[e.type];
            const Icon = cfg.icon;
            return (
              <div key={e.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
                    {e.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>
                    {e.actor ? `${e.actor} · ` : ""}
                    {e.timestamp}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {events.length > 0 && (
        <div className="pt-2 pb-3">
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 text-[13px] cursor-pointer transition-colors group"
            style={{ fontWeight: 500, color: "#2563eb" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
          >
            View all activity
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function NotesBody({ userId, onSeeAll, size, preLogin }: { userId: number; onSeeAll?: () => void; size: WidgetSize; preLogin?: boolean }) {
  /* The same notes the Notes tab writes (ERP-5167), newest first. */
  const notes = sortNotesNewestFirst(useUserNotes(userId));
  if (preLogin || notes.length === 0) {
    return (
      <WidgetEmptyState
        icon={StickyNote}
        title="No Notes Yet"
        subtitle="No notes have been added for this user. Notes you add will appear here."
        minHeight={140}
      />
    );
  }
  const limit = size === "sm" ? 1 : size === "lg" ? notes.length : 2;
  return (
    <div className="flex flex-col">
      <div className="py-3 space-y-3 flex-1">
        {notes.slice(0, limit).map((n) => (
          <div
            key={n.id}
            className="rounded-lg border px-3.5 py-3"
            style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
              >
                {n.author.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <span className="text-[12px]" style={{ fontWeight: 600, color: "#1E293B" }}>{n.author}</span>
              <span className="text-[11px]" style={{ color: "#94A3B8" }}>{formatNoteTime(n.timestamp)}</span>
            </div>
            <p className="text-[12.5px]" style={{ color: "#475569", lineHeight: "1.5" }}>
              {n.text}
            </p>
          </div>
        ))}
      </div>
      <div className="pt-2 pb-3">
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-[13px] cursor-pointer transition-colors group"
          style={{ fontWeight: 500, color: "#2563eb" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1d4ed8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
        >
          View all notes
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Widget infrastructure (left-column drag / resize / remove)     */
/*  Mirrors ContactDetailPage's WidgetGridDropZone + Draggable     */
/*  + ContentCard pattern, scoped to user-detail widgets.          */
/* ═══════════════════════════════════════════════════════════════ */

type WidgetSize = "sm" | "md" | "lg";

interface WidgetDef {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Whether the widget naturally fills the row at default `md` size. */
  defaultSpan: "half" | "full";
}

/** Canonical list of left-column widgets, in default render order. */
const WIDGET_DEFS: WidgetDef[] = [
  { key: "login_activity",   label: "Login Activity",            icon: BarChart3,    defaultSpan: "half" },
  { key: "session_trend",    label: "Session Trend",             icon: TrendingUp,   defaultSpan: "half" },
  { key: "personal_info",    label: "Personal Information",      icon: User,         defaultSpan: "half" },
  { key: "account_security", label: "Account & Security",        icon: Lock,         defaultSpan: "half" },
  { key: "login_devices",    label: "Login Devices & Sessions",  icon: Monitor,      defaultSpan: "half" },
  { key: "recent_activity",  label: "Recent Activity",           icon: ActivityIcon, defaultSpan: "half" },
  { key: "notes",            label: "Notes",                     icon: StickyNote,   defaultSpan: "half" },
];

const DEFAULT_WIDGETS = WIDGET_DEFS.map((w) => w.key);

/* Category order + per-widget metadata (description + preview visual) that
 * drives the "Widgets" tab of the Customize Widgets drawer. Mirrors the
 * Partner Details customize panel: category sections, a pastel preview, and a
 * one-line description per card. */
const WIDGET_CATEGORY_ORDER = ["Activity", "Security", "Profile"] as const;

const WIDGET_META: WidgetMeta[] = [
  { key: "login_activity",   label: "Login Activity",           category: "Activity", visual: "bars",   description: "Daily logins and sessions over the past week." },
  { key: "session_trend",    label: "Session Trend",            category: "Activity", visual: "line",   description: "Monthly session volume across the year." },
  { key: "recent_activity",  label: "Recent Activity",          category: "Activity", visual: "list",   description: "Latest account events, sign-ins and changes." },
  { key: "account_security", label: "Account & Security",       category: "Security", visual: "shield", description: "Sign-in, multi-factor and password status." },
  { key: "login_devices",    label: "Login Devices & Sessions", category: "Security", visual: "devices", description: "Active sessions and known devices." },
  { key: "personal_info",    label: "Personal Information",     category: "Profile",  visual: "fields", description: "Name, identity and profile details." },
  { key: "notes",            label: "Notes",                    category: "Profile",  visual: "note",   description: "Internal notes recorded about this user." },
];

/** Map a size + default span to a CSS width string for the wrapping flex item. */
function getWidgetWidth(size: WidgetSize, defaultSpan: "half" | "full"): string {
  if (size === "sm") return "calc(50% - 10px)";
  if (size === "lg") return "100%";
  return defaultSpan === "full" ? "100%" : "calc(50% - 10px)";
}

/* ── WidgetCardShell: drop-in card chrome with drag header + size toggle + trash ── */
function WidgetCardShell({
  title,
  icon: Icon,
  size,
  onSizeChange,
  onRemove,
  isDragging,
  isOver,
  children,
  bodyClassName,
}: {
  title: string;
  icon: LucideIcon;
  size: WidgetSize;
  onSizeChange: (s: WidgetSize) => void;
  onRemove: () => void;
  isDragging?: boolean;
  isOver?: boolean;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col relative transition-[box-shadow,border-color,transform] duration-200 ${
        isOver && !isDragging
          ? "border-[#93B8F7] shadow-[0_0_0_2px_rgba(10,119,255,0.10)]"
          : "border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_-1px_rgba(15,23,42,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]"
      }`}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      {/* Header: entire bar is the drag handle (cursor-grab).
       *  White by default, slate-tinted on hover. The drag icon was removed,
       *  the whole header is grabbable, no visual handle needed. */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 border-b shrink-0 cursor-grab active:cursor-grabbing select-none transition-colors duration-150"
        style={{
          borderColor: "#F1F5F9",
          backgroundColor: hovered ? "#FAFBFC" : "#FFFFFF",
        }}
      >
        <div className="flex items-center gap-2.5 pointer-events-none flex-1 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#EDF4FF" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
          </div>
          {/* Title is NOT truncated at rest: the hover controls collapse to
           *  max-w-0 (below), so the whole header width is free and the full
           *  title shows. Truncation only kicks in while hovered, when the
           *  size toggle + trash slide in and claim horizontal space. */}
          <h3
            className={`text-[13.5px] ${hovered ? "truncate" : "whitespace-nowrap"}`}
            style={{ fontWeight: 600, color: "#0F172A" }}
          >
            {title}
          </h3>
        </div>

        {/* Hover controls: size toggle + trash, side by side in flow.
         *  Collapsed to max-w-0 (overflow-hidden) at rest so they reserve NO
         *  row space — that's what lets the title render un-truncated. On hover
         *  they expand and slide in, squeezing the title into truncation. */}
        <div
          className={`flex items-center gap-1.5 overflow-hidden transition-all duration-200 ease-out ${
            hovered
              ? "max-w-[340px] opacity-100 translate-x-0"
              : "max-w-0 opacity-0 translate-x-2 pointer-events-none"
          }`}
        >
          <div
            className="flex items-center h-7 rounded-lg border bg-[#F8FAFC] p-0.5 gap-0.5"
            style={{ borderColor: "#E2E8F0" }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSizeChange(s);
                }}
                className={`h-6 px-2.5 rounded-md text-[11px] cursor-pointer transition-all duration-150 ${
                  size === s
                    ? "bg-white text-[#007FFF] shadow-sm border"
                    : "text-[#94A3B8] hover:text-[#334155] hover:bg-white/60 border border-transparent"
                }`}
                style={{
                  fontWeight: size === s ? 600 : 500,
                  borderColor: size === s ? "#E2E8F0" : "transparent",
                }}
              >
                {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] transition-colors duration-150 cursor-pointer hover:bg-red-100 hover:text-[#DC2626]"
            title={`Remove ${title}`}
            aria-label={`Remove ${title} widget`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`px-5 py-1 flex-1 ${bodyClassName ?? ""}`}>{children}</div>
    </div>
  );
}

/* ── DraggableWidget: DnD source + target wrapper ── */
const WIDGET_DND_TYPE = "USER_OVERVIEW_WIDGET";

function DraggableWidget({
  widgetKey,
  index,
  children,
}: {
  widgetKey: string;
  index: number;
  children: (isDragging: boolean, isOver: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: WIDGET_DND_TYPE,
    item: () => ({ key: widgetKey, index }),
    collect: (m) => ({ isDragging: m.isDragging() }),
  });
  // Capture isOver for visual feedback; the actual reorder logic lives in the
  // grid-level drop zone so whitespace between cards counts as a valid drop.
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_DND_TYPE,
    collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
  });
  preview(drop(ref));
  drag(ref);
  return (
    <div
      ref={ref}
      data-widget-idx={index}
      className="transition-all duration-300 ease-out rounded-xl"
      style={{
        opacity: isDragging ? 0.3 : 1,
        transform: isDragging ? "scale(0.97) rotate(-0.5deg)" : undefined,
      }}
    >
      {children(isDragging, isOver)}
    </div>
  );
}

/* ── WidgetGridDropZone: grid-level drop target that drives reordering ── */
function WidgetGridDropZone({
  children,
  moveWidget,
}: {
  children: ReactNode;
  moveWidget: (from: number, to: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const lastSwapRef = useRef(0);
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_DND_TYPE,
    hover(item: { key: string; index: number }, monitor) {
      if (!gridRef.current) return;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const now = performance.now();
      if (now - lastSwapRef.current < 50) return;

      const cards = Array.from(
        gridRef.current.querySelectorAll<HTMLElement>("[data-widget-idx]"),
      );
      if (cards.length === 0) return;

      // Find nearest non-self widget (Euclidean).
      let bestIdx = -1;
      let bestDist = Infinity;
      let nearestRect: DOMRect | null = null;
      for (const el of cards) {
        const elIdx = Number(el.getAttribute("data-widget-idx"));
        if (elIdx === item.index) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(offset.x - cx, offset.y - cy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = elIdx;
          nearestRect = r;
        }
      }
      if (bestIdx < 0 || !nearestRect) return;

      // Row-major: Y dominates. Fall back to X for same-row disambiguation.
      let insertBefore: boolean;
      if (offset.y < nearestRect.top) insertBefore = true;
      else if (offset.y > nearestRect.bottom) insertBefore = false;
      else insertBefore = offset.x < (nearestRect.left + nearestRect.right) / 2;

      // Translate insertBefore/After to a target index that respects splice
      // semantics (remove-then-insert).
      let target: number;
      if (item.index < bestIdx) {
        target = insertBefore ? bestIdx - 1 : bestIdx;
      } else if (item.index > bestIdx) {
        target = insertBefore ? bestIdx : bestIdx + 1;
      } else {
        return;
      }
      target = Math.max(0, Math.min(target, cards.length - 1));
      if (target === item.index) return;
      lastSwapRef.current = now;
      moveWidget(item.index, target);
      item.index = target;
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: false }) }),
  });
  drop(gridRef);

  return (
    <div
      ref={gridRef}
      className={`flex flex-wrap gap-5 items-stretch rounded-xl transition-colors duration-150 ${
        isOver ? "bg-[#0A77FF]/[0.02]" : ""
      }`}
      style={{ minHeight: "60vh" }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN OVERVIEW TAB                                              */
/* ═══════════════════════════════════════════════════════════════ */
/* ── License Mismatch Banner: sits above Login Activity in the left column ── */
function LicenseMismatchBanner({
  user,
  onSwitchTab,
}: {
  user: UserDetail;
  onSwitchTab?: (tab: string) => void;
}) {
  const inaccessible = getLicenseInaccessibleRoles(user.license, user.assignedRoles);
  if (inaccessible.length === 0) return null;
  if (user.status === "Archived") return null;
  const firstName = user.firstName || user.fullName.split(" ")[0] || user.fullName;
  const count = inaccessible.length;
  const message =
    user.license === "No License"
      ? `${firstName} has no license assigned. ${count} role${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} inactive until a license is assigned.`
      : `${count} of ${firstName}'s assigned role${count === 1 ? "" : "s"} require a Full Access license. Permissions in ${count === 1 ? "this role" : "these roles"} won't take effect until the license is upgraded.`;
  return (
    <div
      className="flex items-start gap-3 rounded-[8px] border px-3.5 py-2.5 mb-4"
      style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px]" style={{ color: "#92400E", lineHeight: 1.45 }}>
          {message}
        </p>
        <button
          type="button"
          onClick={() => onSwitchTab?.("roles")}
          className="mt-1 text-[12px] cursor-pointer transition-colors"
          style={{ fontWeight: 600, color: "#B45309" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#92400E")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#B45309")}
        >
          Review Affected Roles →
        </button>
      </div>
    </div>
  );
}

export function OverviewTab({ user, userStatus, onStatusChange, onLicenseChange, onSwitchTab, inviteContext = "created" }: Props) {
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
  const userId = parseInt(user.id?.toString() ?? "0", 10);
  const status = userStatus || user.status;
  /* Archived users have all access cleared. Historical/behavioral widgets stay
   * intact; only the access widgets (Roles KPI, Roles & Permissions panel,
   * Quick Stats role/permission counts) are emptied. */
  const isArchived = status === "Archived";
  /* Users who have never signed in (invite pending / expired / pending setup)
   * have no engagement or security history to report, zero those metrics out
   * so the strip doesn't show fabricated logins/sessions. Access metrics
   * (roles/permissions) stay, since roles can be assigned before first login. */
  const isPreLogin = isPreLoginStatus(status);
  const PRE_LOGIN_METRIC_OVERRIDES: Record<string, { value: string; subtitle: string }> = {
    "total-logins": { value: "0", subtitle: "No sign-ins yet" },
    "days-since-login": { value: "-", subtitle: "Never signed in" },
    "sessions-this-week": { value: "0", subtitle: "No sessions yet" },
    "avg-session-duration": { value: "-", subtitle: "No sessions yet" },
    "password-age": { value: "-", subtitle: "No password set" },
    "failed-attempts": { value: "0", subtitle: "No sign-in attempts" },
    "mfa-status": { value: "Not set up", subtitle: "Pending activation" },
  };
  /* The two access KPIs report what this user actually holds, not a seeded
   * figure. A user created with nothing selected has no roles and no direct
   * grants, and the strip has to say so, otherwise the very first thing the
   * admin sees after creating an empty account contradicts the account. */
  const roleOptionIds = (user.assignedRoles ?? []).map(roleNameToOptionId);
  const effectivePermissionCount = new Set([
    ...getPermissionsForRoles(roleOptionIds),
    ...getDirectPermissionIds(userId),
  ]).size;
  const ACCESS_METRIC_VALUES: Record<string, { value: string; subtitle: string }> = {
    "roles-assigned": {
      value: String(roleOptionIds.length),
      subtitle: roleOptionIds.length === 0 ? "No roles assigned" : "Active roles",
    },
    "permissions-count": {
      value: String(effectivePermissionCount),
      subtitle:
        effectivePermissionCount === 0
          ? "No permissions yet"
          : "Across roles and direct grants",
    },
  };
  const withRealAccessCounts = (m: InsightMetric): InsightMetric => {
    const o = ACCESS_METRIC_VALUES[m.id];
    return o ? { ...m, value: o.value, subtitle: o.subtitle } : m;
  };
  const insights = isArchived
    ? getUserDetailInsights(userId).map((m) =>
        m.id === "roles-assigned" || m.id === "permissions-count"
          ? { ...m, value: "0", subtitle: "Cleared while archived" }
          : m
      )
    : isPreLogin
    ? getUserDetailInsights(userId).map((m) => {
        const o = PRE_LOGIN_METRIC_OVERRIDES[m.id];
        return o ? { ...m, value: o.value, subtitle: o.subtitle } : withRealAccessCounts(m);
      })
    : getUserDetailInsights(userId).map(withRealAccessCounts);
  const baseKeyPermissions = getKeyPermissions(userId);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [manageRolesOpen, setManageRolesOpen] = useState(false);

  // Subscribe to manage-roles config so subtitle stays in sync
  const manageRolesCfg = useSyncExternalStore(
    subscribeManageRolesScope,
    () => getManageRolesConfig(userId),
    () => getManageRolesConfig(userId),
  );
  const hasManageRolesPermission =
    manageRolesCfg.mode === "all" || manageRolesCfg.manageRoleIds.length > 0;
  const manageRolesSubtitle =
    manageRolesCfg.mode === "all"
      ? "All roles"
      : `${manageRolesCfg.manageRoleIds.length} selected role${
          manageRolesCfg.manageRoleIds.length === 1 ? "" : "s"
        }`;

  const keyPermissions: KeyPermission[] = hasManageRolesPermission
    ? [
        ...baseKeyPermissions,
        {
          label: "Manage Roles",
          granted: true,
          subtitle: manageRolesSubtitle,
          onClick: () => setManageRolesOpen(true),
          icon: Crown,
          pinned: true,
          showViewDetailsLabel: true,
        },
      ]
    : baseKeyPermissions;

  const usersRolesModule = PERMISSION_MODULES.find((m) => m.id === "users-roles");

  const lastSignIn =
    user.activityLog.find((a) => a.type === "login")?.timestamp ?? "-";
  const accountCreated =
    user.activityLog.find((a) => a.type === "invite" && a.title.includes("sent"))
      ?.timestamp ?? user.invitedOn ?? "-";

  const handleSendInvitation = () => {
    toast.success(`Invitation sent to ${user.email}`);
    onStatusChange?.("Invite Sent");
  };

  const handleResendInvitation = () => {
    toast.success(`Invitation resent to ${user.email}`);
  };

  /* ── Left-column widget state (order, sizes, removed) ── */
  const [activeWidgets, setActiveWidgets] = useState<string[]>([...DEFAULT_WIDGETS]);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WidgetSize>>({});
  /* KPI-strip visibility is lifted here (controlled) so the Customize Widgets
   * drawer's "KPIs" tab and the PerformanceInsights strip share one source of
   * truth. */
  const [kpiVisibleIds, setKpiVisibleIds] = useState<string[]>([...USER_DETAIL_DEFAULT_VISIBLE]);
  /* The "Customize Widgets" button opens our own tabbed drawer (KPIs +
   * Widgets), mirroring the Partner Details customize panel. Widgets can also
   * be removed via the per-card trash icon and restored via Reset. */
  const [customizeOpen, setCustomizeOpen] = useState(false);
  /* Date range is owned here so the selector next to "Overview" and the
   * KPI strip both read from the same value. */
  const [dateRange, setDateRange] = useState<DateRangeKey>("last_30");

  const moveWidget = useCallback((from: number, to: number) => {
    setActiveWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleToggleWidget = useCallback((key: string) => {
    setActiveWidgets((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      // Re-insert in the canonical default order so a re-enabled widget lands
      // in a sensible slot rather than at the end.
      const next = [...prev, key];
      return DEFAULT_WIDGETS.filter((k) => next.includes(k));
    });
  }, []);

  const handleSetAllWidgets = useCallback((keys: string[]) => {
    setActiveWidgets(DEFAULT_WIDGETS.filter((k) => keys.includes(k)));
  }, []);

  const handleWidgetSizeChange = useCallback((key: string, size: WidgetSize) => {
    setWidgetSizes((prev) => ({ ...prev, [key]: size }));
  }, []);

  const handleToggleKpi = useCallback((id: string) => {
    setKpiVisibleIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  }, []);

  const handleSetAllKpis = useCallback((ids: string[]) => {
    setKpiVisibleIds(ids);
  }, []);

  const handleResetLayout = useCallback(() => {
    setActiveWidgets([...DEFAULT_WIDGETS]);
    setWidgetSizes({});
    setKpiVisibleIds([...USER_DETAIL_DEFAULT_VISIBLE]);
    toast.success("Layout reset to defaults");
  }, []);

  /* ── Render a widget's body content for a given key + size ── */
  const renderWidgetBody = (key: string, size: WidgetSize): ReactNode => {
    switch (key) {
      case "login_activity":
        return <LoginActivityBody user={user} size={size} />;
      case "session_trend":
        return <SessionTrendBody user={user} size={size} />;
      case "personal_info":
        return (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
            <FieldPair label="Full Name" value={fullName} />
            <FieldPair label="Username" value={user.username ? `@${user.username}` : undefined} />
            <FieldPair label="Gender" value={user.gender} />
            <FieldPair label="Date of Birth" value={formatDob(user.dateOfBirth)} />
            <FieldPair label="Preferred Name / Nickname" value={user.preferredName || user.nickname || "Not set"} />
            <FieldPair label="Pronouns" value={user.pronouns} />
            {/* Job Title moved here from the removed Work & Organisation
             *  card; it closes out the grid. */}
            <FieldPair label="Job Title" value={user.jobTitle} />
          </div>
        );
      case "account_security":
        return (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
            <FieldPair label="Last Sign In" value={lastSignIn.split(" - ")[0]} />
            <FieldPair label="Multi-Factor Auth" value={user.mfaEnabled ? "Enabled" : "Not enabled"} green={user.mfaEnabled} />
            <FieldPair label="MFA Method" value={user.mfaMethod || "Not enrolled"} />
            <FieldPair label="Last Password Change" value={user.lastPasswordChange || "Never changed"} />
            <FieldPair label="Account Created" value={accountCreated.split(" - ")[0]} />
            {status !== "Pending Setup" && (
              <FieldPair label="Invitation Link Expiry" value={user.inviteLinkExpiry} />
            )}
          </div>
        );
      case "login_devices":
        if (isPreLoginStatus(status)) {
          return (
            <WidgetEmptyState
              icon={Monitor}
              title="No Sessions Yet"
              subtitle="No devices have signed in to this account. Sessions appear after the user accepts the invitation and logs in."
              minHeight={180}
            />
          );
        }
        return <LoginDevicesBody user={user} />;
      case "recent_activity":
        return <RecentActivityBody user={user} onSeeAll={() => onSwitchTab?.("activity")} size={size} />;
      case "notes":
        /* The sample's notes aren't this company's: a new one shows the
           widget's own "No Notes Yet" state. */
        return <NotesBody userId={user.id} onSeeAll={() => onSwitchTab?.("notes")} size={size} preLogin={isPreLoginStatus(status) || isNewTenant()} />;
      default:
        return null;
    }
  };

  return (
    <>
    <div className="space-y-5">
      {/* ── Invitation Banner: Path A: Pending Setup ──
           The whole banner is one clickable/keyboard-activatable surface that
           triggers Send Invitation; the button inside does the exact same
           thing. Copy adapts to how the user reached this state. */}
      {status === "Pending Setup" && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Send invitation"
          onClick={handleSendInvitation}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSendInvitation();
            }
          }}
          className="flex items-center gap-3 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DDEBFE] px-4 py-3.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#DBEAFE" }}
          >
            <Send className="w-4 h-4" style={{ color: "#2563EB" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px]" style={{ fontWeight: 600, color: "#1E40AF" }}>
              {INVITE_BANNER_COPY[inviteContext].heading}
            </p>
            <p className="text-[12px] mt-0.5" style={{ fontWeight: 400, color: "#3B82F6" }}>
              {INVITE_BANNER_COPY[inviteContext].sub}
            </p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              handleSendInvitation();
            }}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-[8px] text-[13px] text-white shrink-0 transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "#007FFF" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0066D6")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#007FFF")}
          >
            <Send className="w-3.5 h-3.5" />
            Send Invitation
          </button>
        </div>
      )}

      {/* Invite Sent / Invite Expired / Archived statuses are now reflected by the
          status-themed gradient header + status-aware primary CTA on the page header.
          (See StatusHeaderTheme.) */}

      {/* ── Overview header bar (matches ContactDetailPage pattern) ── */}
      <OverviewHeaderBar
        onRefresh={() => toast.success("Refreshed")}
        onReset={handleResetLayout}
        onCustomize={() => setCustomizeOpen(true)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* ── KPI Insights Strip: visibility is controlled from the tabbed
       *  Customize Widgets drawer below; the strip's own header row + internal
       *  drawer are suppressed to avoid duplicating chrome. ── */}
      <PerformanceInsights
        metrics={insights}
        categories={USER_DETAIL_CATEGORIES}
        defaultVisibleIds={USER_DETAIL_DEFAULT_VISIBLE}
        visibleIds={kpiVisibleIds}
        onVisibleIdsChange={setKpiVisibleIds}
        hideHeading
        hideHeaderRow
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* ═══ Two-column layout ═══ */}
      <div className="flex gap-5 items-start">
        {/* ── LEFT COLUMN: draggable / resizable widget grid ── */}
        <div className="flex-1 min-w-0">
          <LicenseMismatchBanner user={user} onSwitchTab={onSwitchTab} />
          <DndProvider backend={HTML5Backend}>
            <WidgetGridDropZone moveWidget={moveWidget}>
              {activeWidgets.map((wKey, wIdx) => {
                const def = WIDGET_DEFS.find((d) => d.key === wKey);
                if (!def) return null;
                const sz: WidgetSize = widgetSizes[wKey] || "md";
                const width = getWidgetWidth(sz, def.defaultSpan);
                return (
                  <div
                    key={wKey}
                    style={{ width }}
                    className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  >
                    <DraggableWidget widgetKey={wKey} index={wIdx}>
                      {(dragging, over) => (
                        <WidgetCardShell
                          title={def.label}
                          icon={def.icon}
                          size={sz}
                          onSizeChange={(s) => handleWidgetSizeChange(wKey, s)}
                          onRemove={() => handleToggleWidget(wKey)}
                          isDragging={dragging}
                          isOver={over}
                        >
                          {renderWidgetBody(wKey, sz)}
                        </WidgetCardShell>
                      )}
                    </DraggableWidget>
                  </div>
                );
              })}
            </WidgetGridDropZone>
          </DndProvider>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="w-[340px] xl:w-[380px] shrink-0 space-y-5 hidden lg:block">
          <ContactAddressCard user={user} />
          <EmergencyContactsCard user={user} />
          <RolesPermissionsCard
            user={user}
            keyPermissions={keyPermissions}
            onViewDetails={() => onSwitchTab?.("roles")}
            onViewAllRoles={() => onSwitchTab?.("roles")}
            onViewAllPermissions={() => onSwitchTab?.("roles")}
            archived={isArchived}
          />
        </div>
      </div>
    </div>
    <WidgetsCustomizePanel
      open={customizeOpen}
      onOpenChange={setCustomizeOpen}
      metrics={insights}
      categories={USER_DETAIL_CATEGORIES}
      kpiVisibleIds={kpiVisibleIds}
      onToggleKpi={handleToggleKpi}
      onSetAllKpis={handleSetAllKpis}
      widgetDefs={WIDGET_META}
      widgetCategoryOrder={[...WIDGET_CATEGORY_ORDER]}
      activeWidgets={activeWidgets}
      onToggleWidget={handleToggleWidget}
      onSetAllWidgets={handleSetAllWidgets}
      widgetSizes={widgetSizes}
      onWidgetSizeChange={handleWidgetSizeChange}
    />
    <UnarchiveUserModal
      open={unarchiveOpen}
      onClose={() => setUnarchiveOpen(false)}
      userId={userId}
      wasInvitePending={false}
      onStatusChange={(s) => onStatusChange?.(s)}
      onLicenseChange={(l) => onLicenseChange?.(l)}
    />
    {manageRolesOpen && usersRolesModule && (
      <PermissionDetailModal
        module={usersRolesModule}
        onClose={() => setManageRolesOpen(false)}
        context="user-detail"
        mode="editable"
        userId={userId}
        initialActivePermissionId="ur-manage-roles"
      />
    )}
    </>
  );
}
