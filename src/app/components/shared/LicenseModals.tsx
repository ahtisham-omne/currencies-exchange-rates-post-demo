import { useState, useEffect, useMemo } from "react";
import {
  X,
  ArrowRight,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { users as allUsersData } from "../../data/users-data";
import { ModalShell } from "./ModalShell";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";

/* ═══════════════════════════════════════════
   Billing constants: Omne daily-rate model
   ═══════════════════════════════════════════ */
const FULL_ACCESS_DAILY = 5.0;
const FIELD_USER_DAILY = 0.5;
const DAILY_DIFF = FULL_ACCESS_DAILY - FIELD_USER_DAILY;
const CYCLE_DAYS = 30;
const DAYS_REMAINING = 15;
const BASELINE_DAILY = 5 * FULL_ACCESS_DAILY + 8 * FIELD_USER_DAILY;
const BASELINE_MONTHLY = BASELINE_DAILY * CYCLE_DAYS;

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
interface BillingInfo {
  currentMonthly: number;
  newMonthly: number;
  perUserDailyRate: number;
  dailyRateDiff: number;
  daysRemaining: number;
  cycleDays: number;
}

interface SingleUserInfo {
  name: string;
  email?: string;
  currentLicense: "Field User" | "Full Access";
}

interface BulkUserInfo {
  name: string;
  email?: string;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
function formatCurrency(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getShortName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
  return parts[0] || fullName;
}

/** Resolve user avatar: real photo if available, otherwise null */
function getUserAvatarUrl(name: string): string | null {
  const match = allUsersData.find((u) => u.fullName === name);
  if (match && USER_AVATAR_MAP[match.id]) return USER_AVATAR_MAP[match.id];
  return null;
}

/* ─── Inline Avatar (with photo support) ─── */
function InlineAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const avatarUrl = getUserAvatarUrl(name);
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const tint = getAvatarTint(name);
  const initials = getInitials(name);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: tint.bg,
        color: tint.fg,
        fontWeight: 600,
        fontSize: size * 0.34,
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Reversed Avatar Stack (last on top, with photos) ─── */
function AvatarStack({ users }: { users: BulkUserInfo[] }) {
  const maxVisible = 5;
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center">
      <div className="flex" style={{ direction: "ltr" }}>
        {visible.map((u, i) => (
          <div
            key={i}
            className="rounded-full ring-2 ring-white"
            style={{ zIndex: i + 1, marginLeft: i === 0 ? 0 : -8 }}
          >
            <InlineAvatar name={u.name} size={32} />
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="rounded-full flex items-center justify-center text-[11px] border"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "#FFFFFF",
              color: "#475569",
              fontWeight: 600,
              zIndex: maxVisible + 1,
              marginLeft: -8,
              borderColor: "#E2E8F0",
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── License Badge (inline) ─── */
function LicenseBadge({ license }: { license: string }) {
  const isFullAccess = license === "Full Access";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] border whitespace-nowrap align-baseline"
      style={{
        backgroundColor: isFullAccess ? "#EDE9FE" : "#F1F5F9",
        color: isFullAccess ? "#5B21B6" : "#475569",
        borderColor: isFullAccess ? "#C4B5FD" : "#CBD5E1",
        fontWeight: 500,
      }}
    >
      {license}
    </span>
  );
}

/* ═══════════════════════════════════════════
   Core License Change Modal
   ═══════════════════════════════════════════ */
type Direction = "upgrade" | "downgrade";

interface LicenseChangeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  /** Optional: when provided (upgrade direction only), enables a secondary
   * "Assign Without Upgrading" CTA and the optional-upgrade info banner. */
  onAssignWithoutUpgrade?: () => void;
  direction: Direction;
  user?: SingleUserInfo;
  users?: BulkUserInfo[];
  billing?: BillingInfo;
  z?: number;
}

function LicenseChangeModal({
  open,
  onClose,
  onConfirm,
  onAssignWithoutUpgrade,
  direction,
  user,
  users: usersProp,
  billing: billingProp,
  z,
}: LicenseChangeModalProps) {
  const [activeUsers, setActiveUsers] = useState<BulkUserInfo[]>([]);
  const [chipExpanded, setChipExpanded] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [optionalBannerExpanded, setOptionalBannerExpanded] = useState(true);

  const isUpgrade = direction === "upgrade";
  const isBulk = !!usersProp && usersProp.length > 0;

  useEffect(() => {
    if (open) {
      setActiveUsers(usersProp ?? []);
      setChipExpanded(false);
      setRemovingIdx(null);
      setBreakdownVisible(false);
      setOptionalBannerExpanded(true);
    }
  }, [open, usersProp]);

  const userCount = isBulk ? activeUsers.length : 1;

  // Billing
  const billing = billingProp ?? {
    currentMonthly: BASELINE_MONTHLY,
    newMonthly: BASELINE_MONTHLY + (isUpgrade ? 1 : -1) * userCount * DAILY_DIFF * CYCLE_DAYS,
    perUserDailyRate: isUpgrade ? FULL_ACCESS_DAILY : FIELD_USER_DAILY,
    dailyRateDiff: DAILY_DIFF,
    daysRemaining: DAYS_REMAINING,
    cycleDays: CYCLE_DAYS,
  };

  const monthlyDelta = userCount * billing.dailyRateDiff * billing.cycleDays;
  const proratedCharge = userCount * billing.dailyRateDiff * billing.daysRemaining;
  const newMonthly = billing.currentMonthly + (isUpgrade ? 1 : -1) * monthlyDelta;

  const fromLicense = isUpgrade ? "Field User" : "Full Access";
  const toLicense = isUpgrade ? "Full Access" : "Field User";
  const fromDaily = isUpgrade ? FIELD_USER_DAILY : FULL_ACCESS_DAILY;
  const toDaily = isUpgrade ? FULL_ACCESS_DAILY : FIELD_USER_DAILY;

  const handleRemoveUser = (idx: number) => {
    setRemovingIdx(idx);
    setTimeout(() => {
      setActiveUsers((prev) => prev.filter((_, i) => i !== idx));
      setRemovingIdx(null);
    }, 150);
  };

  // Colors: purple for upgrade, amber/red for downgrade
  const costCardBg = isUpgrade
    ? "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)"
    : "#F0FDF4";
  const heroColor = isUpgrade ? "#6D28D9" : "#059669";
  const costLabelColor = isUpgrade ? "#7C3AED" : "#475569";
  const confirmBg = isUpgrade ? "#7C3AED" : "#DC2626";
  const confirmHover = isUpgrade ? "#6D28D9" : "#B91C1C";

  const modalWidth = 680;

  // Breakdown table rows
  const breakdownRows = useMemo(() => {
    const rows: { label: string; value: string; isLast?: boolean }[] = [
      { label: `Current daily rate (${fromLicense})`, value: `${formatCurrency(fromDaily)}/user/day` },
      { label: `New daily rate (${toLicense})`, value: `${formatCurrency(toDaily)}/user/day` },
      { label: "Rate Difference", value: `${formatCurrency(billing.dailyRateDiff)}/day` },
      { label: "Users Affected", value: `${userCount}` },
      { label: "Days Remaining This Cycle", value: `${billing.daysRemaining}` },
    ];
    if (isUpgrade) {
      rows.push({ label: "Prorated Charge", value: formatCurrency(proratedCharge) });
    }
    rows.push({ label: `Next full cycle ${isUpgrade ? "increase" : "savings"}`, value: `${isUpgrade ? "+" : "-"}${formatCurrency(monthlyDelta)}/mo` });
    rows.push({ label: "Current Monthly Estimate", value: `${formatCurrency(billing.currentMonthly)}/mo` });
    rows.push({ label: "New Monthly Estimate", value: `${formatCurrency(newMonthly)}/mo`, isLast: true });
    return rows;
  }, [userCount, billing, monthlyDelta, proratedCharge, newMonthly, fromLicense, toLicense, fromDaily, toDaily, isUpgrade]);

  const isEmpty = isBulk && userCount === 0;

  return (
    <ModalShell open={open} onClose={onClose} z={z}>
      <div
        className="bg-white rounded-xl overflow-hidden flex flex-col"
        style={{
          width: modalWidth,
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "85vh",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── STICKY HEADER ── */}
        <div
          className="px-5 pt-5 pb-4 shrink-0 border-b"
          style={{ borderColor: "#E2E8F0" }}
        >
          <div className="flex items-start justify-between">
            <h3
              className="text-[15px] text-[#0F172A] flex items-center gap-1.5 flex-wrap"
              style={{ fontWeight: 650, lineHeight: 1.6 }}
            >
              {isUpgrade ? "Upgrade" : "Downgrade"}{" "}
              {isBulk ? (
                <>
                  {userCount} User{userCount !== 1 ? "s" : ""}
                </>
              ) : (
                "License"
              )}{" "}
              from{" "}
              <LicenseBadge license={fromLicense} />
              <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <LicenseBadge license={toLicense} />
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-black/5 transition-all cursor-pointer shrink-0 -mt-0.5 -mr-1 ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4" style={{ minHeight: 0 }}>
          {/* Section 1: Affected Users */}
          {isEmpty ? (
            <div className="text-center py-6">
              <p className="text-[13px] text-[#94A3B8]" style={{ fontWeight: 450 }}>
                No Users Selected
              </p>
            </div>
          ) : isBulk && activeUsers.length > 1 ? (
            /* ── BULK: Slate user container ── */
            <div
              className="rounded-[8px] border px-3.5 py-3 mb-4"
              style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
            >
              {/* Top row: avatar stack + show all toggle */}
              <div className="flex items-center justify-between">
                <AvatarStack users={activeUsers} />
                <button
                  onClick={() => setChipExpanded(!chipExpanded)}
                  className="flex items-center gap-1 text-[12px] text-[#007FFF] hover:text-[#0862D0] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {chipExpanded ? (
                    <>Hide all <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Show all {activeUsers.length} users <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              </div>

              {/* Expandable chip grid */}
              {chipExpanded && (
                <div
                  className="mt-3 flex flex-wrap gap-2 overflow-y-auto transition-all duration-200"
                  style={{ maxHeight: 300 }}
                >
                  {activeUsers.map((u, i) => {
                    const isRemoving = removingIdx === i;
                    return (
                      <div
                        key={`${u.name}-${i}`}
                        className="group inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-all duration-150"
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E2E8F0",
                          opacity: isRemoving ? 0 : 1,
                          transform: isRemoving ? "scale(0.8)" : "scale(1)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFC";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFFFF";
                        }}
                      >
                        <InlineAvatar name={u.name} size={20} />
                        <span
                          className="text-[13px] text-[#334155] truncate"
                          style={{ fontWeight: 450, maxWidth: 160 }}
                        >
                          {getShortName(u.name)}
                        </span>
                        <button
                          onClick={() => handleRemoveUser(i)}
                          className="w-4 h-4 flex items-center justify-center rounded-full transition-opacity cursor-pointer opacity-40 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" style={{ color: "#94A3B8" }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : !isBulk || activeUsers.length === 1 ? (
            /* ── SINGLE USER ── */
            <div className="flex items-center gap-3 mb-4">
              <InlineAvatar name={isBulk ? activeUsers[0]?.name ?? "User" : user?.name ?? "User"} size={48} />
              <div className="min-w-0">
                <p className="text-[14px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>
                  {isBulk ? activeUsers[0]?.name : user?.name ?? "User"}
                </p>
                <p className="text-[12px] text-[#64748B] truncate" style={{ fontWeight: 420 }}>
                  {isBulk ? activeUsers[0]?.email ?? "" : user?.email ?? ""}
                </p>
              </div>
            </div>
          ) : null}

          {/* Downgrade warning banner */}
          {!isUpgrade && !isEmpty && (
            <div
              className="rounded-[8px] border px-3.5 py-2.5 mb-4"
              style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                <p className="text-[12px]" style={{ fontWeight: 450, color: "#92400E", lineHeight: 1.55 }}>
                  Downgrading will remove access to features requiring Full Access. Any roles requiring Full Access will be automatically unassigned from {userCount > 1 ? `these ${userCount} users` : "this user"}.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Rate Transition, "This User" / "These Users" */}
          {!isEmpty && (
            <>
              {/* Optional upgrade info banner (collapsible), only when caller supports skip-upgrade */}
              {isUpgrade && onAssignWithoutUpgrade && (
                <div
                  className="rounded-[8px] border mb-3 overflow-hidden"
                  style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                >
                  <button
                    onClick={() => setOptionalBannerExpanded((v) => !v)}
                    className="w-full flex items-start gap-2 px-3.5 py-2.5 text-left cursor-pointer hover:bg-[#DBEAFE]/40 transition-colors"
                  >
                    <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#1D4ED8" }} />
                    <div className="flex-1 min-w-0">
                      <p
                        className={optionalBannerExpanded ? "text-[12.5px]" : "text-[12.5px] truncate"}
                        style={{ color: "#1E3A8A", fontWeight: 550, lineHeight: 1.5 }}
                      >
                        Upgrading is optional. You can assign the role without upgrading.
                      </p>
                      {optionalBannerExpanded && (
                        <p className="text-[12px] mt-1" style={{ color: "#1E40AF", fontWeight: 420, lineHeight: 1.55 }}>
                          Users will receive the role, but any permissions that require Full Access will stay inactive until their license is upgraded later.
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className="w-3.5 h-3.5 shrink-0 mt-0.5 transition-transform duration-200"
                      style={{
                        color: "#1D4ED8",
                        transform: optionalBannerExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                </div>
              )}

              {/* Rate Transition Card */}
              <div
                className="rounded-[8px] border px-4 py-3.5 mb-3"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                {/* Header row: title + delta chip */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px]" style={{ fontWeight: 620, color: "#334155" }}>
                    {isBulk && userCount > 1 ? "Per-User Rate Change" : "Rate Change"}
                  </p>
                  <span
                    className="text-[11.5px] px-2 py-0.5 rounded-full"
                    style={{
                      fontWeight: 550,
                      color: isUpgrade ? "#7C3AED" : "#059669",
                      backgroundColor: isUpgrade ? "#EDE9FE" : "#DCFCE7",
                    }}
                  >
                    {isUpgrade ? "+" : "-"}{formatCurrency(billing.dailyRateDiff)}/day
                    {isBulk && userCount > 1 ? ` × ${userCount}` : ""}
                  </span>
                </div>

                {/* Side-by-side Current → New */}
                <div className="flex items-stretch gap-0">
                  {/* Current rate */}
                  <div
                    className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E2E8F0",
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>
                      Current
                    </p>
                    <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: "#334155", lineHeight: 1.15 }}>
                      {formatCurrency(fromDaily)}
                      <span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                    </p>
                    <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: "#94A3B8" }}>
                      {fromLicense}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: "#64748B" }}>
                      ~{formatCurrency(fromDaily * CYCLE_DAYS)}/mo
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center px-2">
                    <ArrowRight className="w-4 h-4" style={{ color: "#94A3B8" }} />
                  </div>

                  {/* New rate */}
                  <div
                    className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                    style={{
                      background: isUpgrade
                        ? "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #DDD6FE 100%)"
                        : "#F0FDF4",
                      borderColor: isUpgrade ? "#C4B5FD" : "#BBF7D0",
                      boxShadow: isUpgrade
                        ? "0 2px 6px 0 rgba(124,58,237,0.1), 0 1px 3px -1px rgba(124,58,237,0.06)"
                        : "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: isUpgrade ? "#7C3AED" : "#059669", letterSpacing: "0.04em" }}>
                      New
                    </p>
                    <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: isUpgrade ? "#6D28D9" : "#059669", lineHeight: 1.15 }}>
                      {formatCurrency(toDaily)}
                      <span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                    </p>
                    <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: isUpgrade ? "#7C3AED" : "#059669" }}>
                      {toLicense}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: isUpgrade ? "#5B21B6" : "#065F46" }}>
                      ~{formatCurrency(toDaily * CYCLE_DAYS)}/mo
                    </p>
                  </div>
                </div>
              </div>

              {/* Proration info */}
              {isUpgrade ? (
                <div
                  className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-2.5 mb-3"
                  style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#475569" }} />
                  <div>
                    <p className="text-[13px] text-[#334155]" style={{ fontWeight: 530 }}>
                      Prorated charge this cycle:{" "}
                      <span style={{ fontWeight: 650, color: "#0F172A" }}>{formatCurrency(proratedCharge)}</span>
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#475569", fontWeight: 420 }}>
                      {isBulk && userCount > 1 ? `${userCount} users × ` : ""}{billing.daysRemaining} days remaining × {formatCurrency(billing.dailyRateDiff)}/day
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: "#475569", fontWeight: 420 }}>
                      Appears on your next invoice. Full rate applies from the next billing date.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-2.5 mb-3"
                  style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#059669" }} />
                  <div>
                    <p className="text-[12px]" style={{ fontWeight: 480, color: "#065F46" }}>
                      No credit is issued for the current cycle. The lower rate takes effect on your next billing date.
                    </p>
                    <p className="text-[12px] mt-1" style={{ fontWeight: 420, color: "#059669" }}>
                      If you re-upgrade {userCount > 1 ? "these users" : "this user"} before the next billing date, no additional charge will apply.
                    </p>
                  </div>
                </div>
              )}

              {/* Section 2: Company-Wide Impact */}
              <div
                className="rounded-[8px] border px-4 py-3.5 mb-3"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                <p className="text-[13px] mb-2.5" style={{ fontWeight: 620, color: "#334155" }}>
                  Company-Wide Impact
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Daily Spend</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(BASELINE_DAILY)}/day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Daily Spend</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>
                      {formatCurrency(BASELINE_DAILY + (isUpgrade ? 1 : -1) * userCount * billing.dailyRateDiff)}/day
                    </span>
                  </div>
                  <div className="h-px my-1" style={{ backgroundColor: "#E2E8F0" }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Monthly Estimate</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(billing.currentMonthly)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Monthly Estimate</span>
                    <span className="text-[12.5px]" style={{ color: "#0F172A", fontWeight: 620 }}>{formatCurrency(newMonthly)}/mo</span>
                  </div>
                  <div className="flex items-center justify-end mt-0.5">
                    <span
                      className="text-[12px] px-1.5 py-0.5 rounded"
                      style={{
                        fontWeight: 600,
                        color: isUpgrade ? "#6D28D9" : "#059669",
                        backgroundColor: isUpgrade ? "#F5F3FF" : "#F0FDF4",
                      }}
                    >
                      {isUpgrade ? "+" : "-"}{formatCurrency(monthlyDelta)}/mo
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible full breakdown, accordion style */}
              <div
                className="rounded-[8px] border overflow-hidden"
                style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
              >
                <button
                  onClick={() => setBreakdownVisible(!breakdownVisible)}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                >
                  <span className="text-[13px]" style={{ fontWeight: 600, color: "#334155" }}>
                    View Full Breakdown
                  </span>
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{
                      color: "#64748B",
                      transform: breakdownVisible ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>

                {breakdownVisible && (
                  <div style={{ borderTop: "1px solid #E2E8F0" }}>
                    {breakdownRows.map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3.5"
                        style={{
                          backgroundColor: row.isLast ? "#fff" : i % 2 === 0 ? "#fff" : "#F8FAFC",
                          borderTop: row.isLast ? "1px solid #E2E8F0" : "none",
                          paddingTop: row.isLast ? 10 : 8,
                          paddingBottom: row.isLast ? 10 : 8,
                        }}
                      >
                        <span
                          className={row.isLast ? "text-[14px]" : "text-[13px]"}
                          style={{
                            color: "#334155",
                            fontWeight: row.isLast ? 600 : 400,
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          className={row.isLast ? "text-[14px]" : "text-[13px]"}
                          style={{
                            color: "#0F172A",
                            fontWeight: row.isLast ? 700 : 500,
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── STICKY FOOTER ── */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3.5 shrink-0 border-t bg-[#FAFBFC]"
          style={{ borderColor: "#E2E8F0" }}
        >
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {isUpgrade && onAssignWithoutUpgrade && (
            <button
              disabled={isEmpty}
              onClick={() => {
                onAssignWithoutUpgrade();
                onClose();
              }}
              className="h-9 px-4 rounded-[8px] bg-white text-[13px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontWeight: 600,
                color: confirmBg,
                border: `1px solid ${confirmBg}`,
              }}
              onMouseEnter={(e) => { if (!isEmpty) (e.currentTarget as HTMLElement).style.backgroundColor = "#F5F3FF"; }}
              onMouseLeave={(e) => { if (!isEmpty) (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFFFF"; }}
            >
              Assign Without Upgrading
            </button>
          )}
          <button
            disabled={isEmpty}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontWeight: 600,
              backgroundColor: isEmpty ? "#94A3B8" : confirmBg,
            }}
            onMouseEnter={(e) => { if (!isEmpty) (e.currentTarget as HTMLElement).style.backgroundColor = confirmHover; }}
            onMouseLeave={(e) => { if (!isEmpty) (e.currentTarget as HTMLElement).style.backgroundColor = confirmBg; }}
          >
            {isUpgrade
              ? onAssignWithoutUpgrade
                ? `Upgrade & Assign${isBulk ? ` (${userCount})` : ""}`
                : `Confirm Upgrade${isBulk ? ` (${userCount})` : ""}`
              : `Confirm Downgrade${isBulk ? ` (${userCount})` : ""}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   Exported: Upgrade License Modal
   ═══════════════════════════════════════════ */
export function UpgradeLicenseModal({
  open,
  onClose,
  userName,
  userEmail,
  users,
  billing,
  onConfirm,
  onAssignWithoutUpgrade,
  z,
}: {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  users?: BulkUserInfo[];
  billing?: BillingInfo;
  onConfirm?: () => void;
  onAssignWithoutUpgrade?: () => void;
  z?: number;
}) {
  const isBulk = !!users && users.length > 0;
  return (
    <LicenseChangeModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      onAssignWithoutUpgrade={onAssignWithoutUpgrade}
      z={z}
      direction="upgrade"
      user={
        !isBulk && userName
          ? { name: userName, email: userEmail, currentLicense: "Field User" }
          : undefined
      }
      users={isBulk ? users : undefined}
      billing={billing}
    />
  );
}

/* ═══════════════════════════════════════════
   Exported: Downgrade License Modal
   ═══════════════════════════════════════════ */
export function DowngradeLicenseModal({
  open,
  onClose,
  userName,
  userEmail,
  users,
  rolesCount,
  billing,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  users?: BulkUserInfo[];
  rolesCount?: number;
  billing?: BillingInfo;
  onConfirm?: () => void;
}) {
  const isBulk = !!users && users.length > 0;
  return (
    <LicenseChangeModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      direction="downgrade"
      user={
        !isBulk && userName
          ? { name: userName, email: userEmail, currentLicense: "Full Access" }
          : undefined
      }
      users={isBulk ? users : undefined}
      billing={billing}
    />
  );
}

/* ═══════════════════════════════════════════
   Role badge + company-spend helpers (role-context modal)
   ═══════════════════════════════════════════ */
/** Current total daily license spend across the company (Full Access + Field User). */
function computeCompanyDailySpend(): number {
  return allUsersData.reduce((sum, u) => {
    if (u.license === "Full Access") return sum + FULL_ACCESS_DAILY;
    if (u.license === "Field User") return sum + FIELD_USER_DAILY;
    return sum;
  }, 0);
}

interface RoleMemberInfo {
  id: number;
  name: string;
  email?: string;
}

/** Avatar that reveals a compact user overview on hover. */
function MemberAvatarHover({ id, name }: { id: number; name: string }) {
  const u = allUsersData.find((x) => x.id === id);
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="shrink-0 cursor-default">
          <InlineAvatar name={name} size={26} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={8} className="z-[200] w-64 p-3">
        <div className="flex items-center gap-3">
          <InlineAvatar name={name} size={40} />
          <div className="min-w-0">
            <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{name}</p>
            {u?.email && (
              <p className="text-[12px] text-[#64748B] truncate" style={{ fontWeight: 420 }}>{u.email}</p>
            )}
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 flex items-center justify-between border-t" style={{ borderColor: "#F1F5F9" }}>
          <span className="text-[11.5px]" style={{ color: "#94A3B8", fontWeight: 450 }}>Current License</span>
          <LicenseBadge license={u?.license ?? "Field User"} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Member name as a blue hover link that opens the user in a new tab. */
function MemberNameLink({ id, name }: { id: number; name: string }) {
  return (
    <a
      href={`/company-settings/user-access-control/user/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[13px] truncate hover:text-[#007FFF] hover:underline transition-colors"
      style={{ color: "#334155", fontWeight: 450 }}
    >
      {name}
    </a>
  );
}

/** A single affected-user row: hover-avatar + name link + trailing detail. */
function MemberRow({
  member,
  trailing,
  striped,
}: {
  member: RoleMemberInfo;
  trailing: React.ReactNode;
  striped: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3.5 py-2"
      style={{ backgroundColor: striped ? "#F8FAFC" : "#FFFFFF" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <MemberAvatarHover id={member.id} name={member.name} />
        <MemberNameLink id={member.id} name={member.name} />
      </div>
      <span className="shrink-0">{trailing}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Exported: Upgrade Role to Full Access Modal
   ───────────────────────────────────────────
   Role-context instance of the user license-upgrade modal. Shown when granting
   a Full Access permission to a Field-User role, which promotes the whole role
   (and every Field User member) to Full Access. Reuses the same layout, the
   Full Access purple treatment, and the same card structure as the user modal.
   ═══════════════════════════════════════════ */
export function UpgradeRoleLicenseModal({
  open,
  onClose,
  onConfirm,
  z,
  roleName,
  permissionName,
  affectedUsers,
  alreadyFullUsers = [],
  companyCurrentDaily,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  z?: number;
  roleName: string;
  /** Permission whose grant forces the upgrade. */
  permissionName: string;
  /** Members moving from Field User → Full Access (the charged set). */
  affectedUsers: RoleMemberInfo[];
  /** Members already on Full Access (no charge). */
  alreadyFullUsers?: RoleMemberInfo[];
  /** Company-wide current daily spend; defaults to the live computed total. */
  companyCurrentDaily?: number;
}) {
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [usersAffectedVisible, setUsersAffectedVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setBreakdownVisible(false);
      setUsersAffectedVisible(false);
    }
  }, [open]);

  const affectedCount = affectedUsers.length;
  const alreadyFullCount = alreadyFullUsers.length;
  const totalUsers = affectedCount + alreadyFullCount;
  const noCharge = affectedCount === 0;

  // All cost figures derive from the affected (moving) users only.
  const perUserProrated = DAYS_REMAINING * DAILY_DIFF; // 15 × 4.5 = 67.50
  const proratedTotal = affectedCount * perUserProrated;
  const dailyDelta = affectedCount * DAILY_DIFF;
  const monthlyDelta = dailyDelta * CYCLE_DAYS;
  const baseDaily = companyCurrentDaily ?? computeCompanyDailySpend();
  const newDaily = baseDaily + dailyDelta;
  const currentMonthly = baseDaily * CYCLE_DAYS;
  const newMonthly = newDaily * CYCLE_DAYS;

  const PURPLE = "#7C3AED";
  const PURPLE_HOVER = "#6D28D9";

  const breakdownRows = useMemo(() => {
    const rows: { label: string; value: string; isLast?: boolean }[] = [
      { label: "Current Daily Rate (Field User)", value: `${formatCurrency(FIELD_USER_DAILY)}/user/day` },
      { label: "New Daily Rate (Full Access)", value: `${formatCurrency(FULL_ACCESS_DAILY)}/user/day` },
      { label: "Rate Difference", value: `${formatCurrency(DAILY_DIFF)}/user/day` },
      { label: "Users Moving to Full Access", value: `${affectedCount}` },
      { label: "Days Remaining This Cycle", value: `${DAYS_REMAINING}` },
      { label: "Prorated Charge This Cycle", value: formatCurrency(proratedTotal) },
      { label: "Next Full Cycle Increase", value: `+${formatCurrency(monthlyDelta)}/mo` },
      { label: "Current Monthly Estimate", value: `${formatCurrency(currentMonthly)}/mo` },
      { label: "New Monthly Estimate", value: `${formatCurrency(newMonthly)}/mo`, isLast: true },
    ];
    return rows;
  }, [affectedCount, proratedTotal, monthlyDelta, currentMonthly, newMonthly]);

  return (
    <ModalShell open={open} onClose={onClose} z={z}>
      <div
        className="bg-white rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 680,
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "85vh",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── STICKY HEADER ── */}
        <div className="px-5 pt-5 pb-4 shrink-0 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-start justify-between">
            <h3
              className="text-[15px] text-[#0F172A] flex items-center gap-1.5 flex-wrap"
              style={{ fontWeight: 650, lineHeight: 1.6 }}
            >
              Upgrade Role to Full Access
              <LicenseBadge license="Field User" />
              <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <LicenseBadge license="Full Access" />
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-black/5 transition-all cursor-pointer shrink-0 -mt-0.5 -mr-1 ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4" style={{ minHeight: 0 }}>
          {/* Triggering permission, slate banner */}
          <div
            className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-3 mb-3"
            style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#64748B" }} />
            <p className="text-[12.5px]" style={{ color: "#475569", fontWeight: 420, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: "#334155" }}>{permissionName}</span> requires a Full Access license. Granting it upgrades the{" "}
              <span style={{ fontWeight: 600, color: "#334155" }}>{roleName}</span> role to Full Access.
            </p>
          </div>

          {/* No billing impact, everyone is already Full Access */}
          {noCharge && (
            <div
              className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-3 mb-3"
              style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#64748B" }} />
              <p className="text-[12.5px]" style={{ color: "#475569", fontWeight: 420, lineHeight: 1.5 }}>
                All {totalUsers} user{totalUsers !== 1 ? "s are" : " is"} already Full Access. This changes the role&apos;s tier with no billing impact.
              </p>
            </div>
          )}

          {!noCharge && (
            <>
              {/* Rate Change card */}
              <div
                className="rounded-[8px] border px-4 py-3.5 mb-3"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px]" style={{ fontWeight: 620, color: "#334155" }}>Rate Change</p>
                  <span
                    className="text-[11.5px] px-2 py-0.5 rounded-full"
                    style={{ fontWeight: 550, color: "#7C3AED", backgroundColor: "#EDE9FE" }}
                  >
                    +{formatCurrency(DAILY_DIFF)}/day × {affectedCount}
                  </span>
                </div>
                <div className="flex items-stretch gap-0">
                  {/* Current */}
                  <div
                    className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E2E8F0",
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>Current</p>
                    <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: "#334155", lineHeight: 1.15 }}>
                      {formatCurrency(FIELD_USER_DAILY)}<span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                    </p>
                    <p className="text-[10.5px] mt-0.5" style={{ fontWeight: 450, color: "#94A3B8" }}>per user</p>
                    <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: "#94A3B8" }}>Field User</p>
                    <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: "#64748B" }}>~{formatCurrency(FIELD_USER_DAILY * CYCLE_DAYS)}/mo</p>
                  </div>
                  <div className="flex items-center justify-center px-2">
                    <ArrowRight className="w-4 h-4" style={{ color: "#94A3B8" }} />
                  </div>
                  {/* New */}
                  <div
                    className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                    style={{
                      background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #DDD6FE 100%)",
                      borderColor: "#C4B5FD",
                      boxShadow: "0 2px 6px 0 rgba(124,58,237,0.1), 0 1px 3px -1px rgba(124,58,237,0.06)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "#7C3AED", letterSpacing: "0.04em" }}>New</p>
                    <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: "#6D28D9", lineHeight: 1.15 }}>
                      {formatCurrency(FULL_ACCESS_DAILY)}<span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                    </p>
                    <p className="text-[10.5px] mt-0.5" style={{ fontWeight: 450, color: "#7C3AED" }}>per user</p>
                    <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: "#7C3AED" }}>Full Access</p>
                    <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: "#5B21B6" }}>~{formatCurrency(FULL_ACCESS_DAILY * CYCLE_DAYS)}/mo</p>
                  </div>
                </div>
              </div>

              {/* Prorated charge callout */}
              <div
                className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-2.5 mb-3"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#475569" }} />
                <div>
                  <p className="text-[13px] text-[#334155]" style={{ fontWeight: 530 }}>
                    Prorated charges apply per user based on each user&apos;s billing cycle and appear on your next invoice.
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "#475569", fontWeight: 420 }}>
                    Estimated this cycle: <span style={{ fontWeight: 650, color: "#0F172A" }}>{formatCurrency(proratedTotal)}</span>. Full rate applies from each user&apos;s next billing date.
                  </p>
                </div>
              </div>

              {/* Company-Wide Impact */}
              <div
                className="rounded-[8px] border px-4 py-3.5 mb-3"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
              >
                <p className="text-[13px] mb-2.5" style={{ fontWeight: 620, color: "#334155" }}>Company-Wide Impact</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Daily Spend</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(baseDaily)}/day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Daily Spend</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(newDaily)}/day</span>
                  </div>
                  <div className="h-px my-1" style={{ backgroundColor: "#E2E8F0" }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Monthly Estimate</span>
                    <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>~{formatCurrency(currentMonthly)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Monthly Estimate</span>
                    <span className="text-[12.5px]" style={{ color: "#0F172A", fontWeight: 620 }}>{formatCurrency(newMonthly)}/mo</span>
                  </div>
                  <div className="flex items-center justify-end mt-0.5">
                    <span
                      className="text-[12px] px-1.5 py-0.5 rounded"
                      style={{ fontWeight: 600, color: "#6D28D9", backgroundColor: "#F5F3FF" }}
                    >
                      +{formatCurrency(monthlyDelta)}/mo
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible full breakdown */}
              <div
                className="rounded-[8px] border overflow-hidden"
                style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
              >
                <button
                  onClick={() => setBreakdownVisible(!breakdownVisible)}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
                >
                  <span className="text-[13px]" style={{ fontWeight: 600, color: "#334155" }}>View Full Breakdown</span>
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{ color: "#64748B", transform: breakdownVisible ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                {breakdownVisible && (
                  <div style={{ borderTop: "1px solid #E2E8F0" }}>
                    {breakdownRows.map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3.5"
                        style={{
                          backgroundColor: row.isLast ? "#fff" : i % 2 === 0 ? "#fff" : "#F8FAFC",
                          borderTop: row.isLast ? "1px solid #E2E8F0" : "none",
                          paddingTop: row.isLast ? 10 : 8,
                          paddingBottom: row.isLast ? 10 : 8,
                        }}
                      >
                        <span className={row.isLast ? "text-[14px]" : "text-[13px]"} style={{ color: "#334155", fontWeight: row.isLast ? 600 : 400 }}>{row.label}</span>
                        <span className={row.isLast ? "text-[14px]" : "text-[13px]"} style={{ color: "#0F172A", fontWeight: row.isLast ? 700 : 500 }}>{row.value}</span>
                      </div>
                    ))}

                  </div>
                )}
              </div>
            </>
          )}

          {/* Users Affected, complete member list with hover overview + name links */}
          {totalUsers > 0 && (
            <div
              className="rounded-[8px] border overflow-hidden mt-3"
              style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
            >
              <button
                onClick={() => setUsersAffectedVisible(!usersAffectedVisible)}
                className="flex items-center justify-between w-full px-3.5 py-2.5 cursor-pointer hover:bg-[#F1F5F9] transition-colors"
              >
                <span className="text-[13px]" style={{ fontWeight: 600, color: "#334155" }}>Users Affected</span>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{ color: "#64748B", transform: usersAffectedVisible ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {usersAffectedVisible && (
                <div style={{ borderTop: "1px solid #E2E8F0" }}>
                  {affectedCount > 0 && (
                    <>
                      <p className="px-3.5 pt-2.5 pb-1 text-[11px] uppercase tracking-wider" style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>
                        Moving to Full Access · charged this cycle
                      </p>
                      {affectedUsers.map((u, i) => (
                        <MemberRow
                          key={`a-${u.id}`}
                          member={u}
                          striped={i % 2 === 1}
                          trailing={<span className="text-[13px]" style={{ color: "#0F172A", fontWeight: 550 }}>{formatCurrency(perUserProrated)}</span>}
                        />
                      ))}
                    </>
                  )}
                  {alreadyFullCount > 0 && (
                    <div style={affectedCount > 0 ? { borderTop: "1px solid #E2E8F0" } : undefined}>
                      <p className="px-3.5 pt-2.5 pb-1 text-[11px] uppercase tracking-wider" style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>
                        No change (already Full Access)
                      </p>
                      {alreadyFullUsers.map((u, i) => (
                        <MemberRow
                          key={`f-${u.id}`}
                          member={u}
                          striped={i % 2 === 1}
                          trailing={<span className="text-[12.5px]" style={{ color: "#94A3B8", fontWeight: 450 }}>No change</span>}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── STICKY FOOTER ── */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3.5 shrink-0 border-t bg-[#FAFBFC]"
          style={{ borderColor: "#E2E8F0" }}
        >
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm"
            style={{ fontWeight: 600, backgroundColor: PURPLE }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = PURPLE_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = PURPLE)}
          >
            Confirm &amp; Grant Permission
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
