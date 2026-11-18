import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Building2, ChevronDown, Info, Table2, TrendingDown } from "lucide-react";
import { users as allUsers } from "../../data/users-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getAvatarTint, getInitials } from "../../lib/avatar";

/* ─────────────────────────────────────────────────────────────
 * LicenseReviewBody
 * ─────────────────────────────────────────────────────────────
 * The "Review & confirm" step body for the Downgrade / Remove
 * reassignment flows. Replicates the single-user Downgrade License
 * confirmation modal layout (identity → warning → rate change →
 * billing-cycle note → company-wide impact → full breakdown) with
 * no visual changes, plus scope-driven adaptations for the bulk case.
 *
 * This is body content only, the modal shell, header, and footer are
 * provided by the wizard. The standalone single-user no-reassignment
 * modal (LicenseModals) is intentionally left untouched.
 * ──────────────────────────────────────────────────────────── */

/* Rates, the cycle length and the company total live in app/lib/license-billing
 * so every surface that quotes money reads one table. */
import {
  CYCLE_DAYS,
  DAYS_REMAINING,
  DAILY_RATE,
  FULL_ACCESS_DAILY,
  formatCurrency,
  companyDailySpend,
} from "../../lib/license-billing";

export type LicenseReviewAction = "downgrade" | "remove";

export interface ReviewUser {
  id: number;
  fullName: string;
  license: string;
}

interface LicenseReviewBodyProps {
  action: LicenseReviewAction;
  /** Bulk selection, drives the math + breakdown table. */
  users?: ReviewUser[];
  /** Bulk identity area (the selected-users accordion panel). */
  identitySlot?: ReactNode;
  /** Single-user identity (omit for bulk). */
  user?: { id?: number; name: string; email: string; license: string };
  /** Every user keeps their current tier, so the rate change nets to zero.
   *  Set by the Deactivate flow when the admin chose "Keep license" in Step 1:
   *  same containers, no savings claimed. */
  keepLicense?: boolean;
  /** Replaces the amber banner copy. Deactivate and Archive describe a
   *  different consequence than a plain license change. */
  warning?: string;
}

/* ─── Small avatar (same style as the selected-user chips) ─── */
function ReviewAvatar({ userId, name, size = 24 }: { userId?: number; name: string; size?: number }) {
  const photo = userId != null ? USER_AVATAR_MAP[userId] : undefined;
  const tint = getAvatarTint(name);
  return (
    <span
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: tint.bg, color: tint.fg, fontWeight: 700, fontSize: size * 0.4 }}
    >
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
    </span>
  );
}

/* ─── Section card header ───
 * Same pattern the Export modals use for "File Format" / "Columns to Include":
 * slate strip, 16px icon, 14px semibold title, edge-to-edge divider beneath.
 * `trailing` holds the Rate Change badge. */
function SectionCardHeader({
  icon: Icon,
  title,
  trailing,
}: {
  icon: typeof TrendingDown;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <>
      <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
        <Icon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
        <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
          {title}
        </h3>
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>
      <div className="border-t shrink-0" style={{ borderColor: "#E2E8F0" }} />
    </>
  );
}

export function LicenseReviewBody({ action, users, identitySlot, user, keepLicense = false, warning }: LicenseReviewBodyProps) {
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const isBulk = !!users;
  const actionTarget = action === "downgrade" ? "Field User" : "No License";

  /* Per-user rows (bulk) or the single user, with from/to rates. When the
   * license is kept every user lands on their own tier, so the delta is zero. */
  const rows = useMemo(() => {
    const list: ReviewUser[] = isBulk
      ? users!
      : user
      ? [{ id: user.id ?? -1, fullName: user.name, license: user.license }]
      : [];
    return list.map((u) => {
      const fromDaily = DAILY_RATE[u.license] ?? 0;
      const toLicense = keepLicense ? u.license : actionTarget;
      const toDaily = keepLicense ? fromDaily : DAILY_RATE[actionTarget];
      return {
        ...u,
        fromLicense: u.license,
        fromDaily,
        toLicense,
        toDaily,
        dailyDelta: fromDaily - toDaily,
      };
    });
  }, [isBulk, users, user, actionTarget, keepLicense]);

  const userCount = rows.length;
  const totalDailyDelta = rows.reduce((s, r) => s + r.dailyDelta, 0);
  const totalMonthlyDelta = totalDailyDelta * CYCLE_DAYS;

  /* Company-wide current spend across every licensed user (live figure). */
  const companyDaily = useMemo(() => companyDailySpend(), []);
  const newDaily = companyDaily - totalDailyDelta;
  const companyMonthly = companyDaily * CYCLE_DAYS;
  const newMonthly = newDaily * CYCLE_DAYS;

  /* Homogeneous = every affected user holds the same current license. */
  const tiersPresent = useMemo(() => {
    const m = new Map<string, { count: number; daily: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.fromLicense) ?? { count: 0, daily: r.fromDaily };
      cur.count += 1;
      m.set(r.fromLicense, cur);
    });
    return Array.from(m.entries()).map(([license, v]) => ({ license, ...v }));
  }, [rows]);
  const homogeneous = tiersPresent.length <= 1;

  const fromLicense = rows[0]?.fromLicense ?? "Full Access";
  const fromDaily = rows[0]?.fromDaily ?? FULL_ACCESS_DAILY;
  /* What the "New" tile shows. Identical to the current tier when the license
   * is kept, so the container reads as "no change" without changing shape. */
  const targetLicense = keepLicense ? fromLicense : actionTarget;
  const toDaily = keepLicense ? fromDaily : DAILY_RATE[actionTarget];
  const perUserDelta = fromDaily - toDaily;
  const hasSavings = totalDailyDelta > 0;

  const warningCopy =
    action === "downgrade"
      ? "Downgrading will remove access to features requiring Full Access. Any roles requiring Full Access will be automatically unassigned from these users."
      : "Removing these licenses will revoke access entirely. These users will no longer be able to sign in to Omne.";
  const warningCopySingle =
    action === "downgrade"
      ? "Downgrading will remove access to features requiring Full Access. Any roles requiring Full Access will be automatically unassigned from this user."
      : "Removing this license will revoke access entirely. This user will no longer be able to sign in to Omne.";

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [rows],
  );

  return (
    <div className="w-full">
      {/* ── Identity ──
           Bulk keeps its selected-users panel, the modal header already names
           the single user so no avatar/name/email block is repeated here. */}
      {isBulk && <div className="mb-4">{identitySlot}</div>}

      {/* ── Warning banner (amber) ── */}
      <div className="rounded-[8px] border px-3.5 py-2.5 mb-4" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
          <p className="text-[12px]" style={{ fontWeight: 450, color: "#92400E", lineHeight: 1.55 }}>
            {warning ?? (isBulk ? warningCopy : warningCopySingle)}
          </p>
        </div>
      </div>

      {/* ── Rate Change ── */}
      <div className="rounded-[12px] border bg-white overflow-hidden mb-3" style={{ borderColor: "#E2E8F0" }}>
        <SectionCardHeader
          icon={TrendingDown}
          title={isBulk && userCount > 1 ? "Per-User Rate Change" : "Rate Change"}
          trailing={
            homogeneous ? (
              hasSavings ? (
                <span
                  className="text-[11.5px] px-2 py-0.5 rounded-full"
                  style={{ fontWeight: 550, color: "#059669", backgroundColor: "#DCFCE7" }}
                >
                  -{formatCurrency(perUserDelta)}/day{isBulk && userCount > 1 ? ` × ${userCount}` : ""}
                </span>
              ) : (
                <span
                  className="text-[11.5px] px-2 py-0.5 rounded-full"
                  style={{ fontWeight: 550, color: "#475569", backgroundColor: "#F1F5F9" }}
                >
                  No change
                </span>
              )
            ) : undefined
          }
        />
        <div className="px-5 pt-4 pb-4">
        {homogeneous ? (
          <>
            <div className="flex items-stretch gap-0">
              {/* Current */}
              <div
                className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
              >
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>Current</p>
                <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: "#334155", lineHeight: 1.15 }}>
                  {formatCurrency(fromDaily)}<span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                </p>
                <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: "#94A3B8" }}>{fromLicense}</p>
                <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: "#64748B" }}>~{formatCurrency(fromDaily * CYCLE_DAYS)}/mo</p>
              </div>
              <div className="flex items-center justify-center px-2">
                <ArrowRight className="w-4 h-4" style={{ color: "#94A3B8" }} />
              </div>
              {/* New */}
              <div
                className="flex-1 rounded-[8px] px-3 py-3 text-center border"
                style={{
                  background: hasSavings ? "#F0FDF4" : "#FFFFFF",
                  borderColor: hasSavings ? "#BBF7D0" : "#E2E8F0",
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                }}
              >
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: hasSavings ? "#059669" : "#94A3B8", letterSpacing: "0.04em" }}>New</p>
                <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: hasSavings ? "#059669" : "#334155", lineHeight: 1.15 }}>
                  {formatCurrency(toDaily)}<span className="text-[12px]" style={{ fontWeight: 500 }}>/day</span>
                </p>
                <p className="text-[11px] mt-1" style={{ fontWeight: 500, color: hasSavings ? "#059669" : "#94A3B8" }}>{targetLicense}</p>
                <p className="text-[12px] mt-0.5" style={{ fontWeight: 450, color: hasSavings ? "#065F46" : "#64748B" }}>~{formatCurrency(toDaily * CYCLE_DAYS)}/mo</p>
              </div>
            </div>
            {isBulk && userCount > 1 && hasSavings && (
              <p className="text-[12px] mt-3 text-center" style={{ fontWeight: 500, color: "#334155" }}>
                {userCount} users × -{formatCurrency(perUserDelta)}/day ={" "}
                <span style={{ fontWeight: 700, color: "#059669" }}>-{formatCurrency(totalDailyDelta)}/day total</span>
              </p>
            )}
          </>
        ) : (
          /* Mixed selection, one row per license tier present */
          <div className="rounded-[8px] border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            {tiersPresent
              .sort((a, b) => b.daily - a.daily)
              .map((t, i) => (
                <div
                  key={t.license}
                  className="flex items-center justify-between px-3.5 py-2.5"
                  style={{ borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}
                >
                  <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 450 }}>
                    {t.count} × {formatCurrency(t.daily)}/day <span style={{ color: "#94A3B8" }}>({t.license})</span>
                  </span>
                  {keepLicense ? (
                    <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 550 }}>
                      Unchanged
                    </span>
                  ) : (
                    <span className="text-[12.5px]" style={{ color: "#059669", fontWeight: 600 }}>
                      -{formatCurrency(t.count * t.daily)}/day removed
                    </span>
                  )}
                </div>
              ))}
            <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
              <span className="text-[13px]" style={{ color: "#334155", fontWeight: 600 }}>Total</span>
              <span className="text-[13px]" style={{ color: "#059669", fontWeight: 700 }}>-{formatCurrency(totalDailyDelta)}/day</span>
            </div>
          </div>
        )}

        {/* ── Billing-cycle note: one slate line inside the Rate Change card.
               Nothing to say about a cycle when the rate does not move. ── */}
        {hasSavings && (
          <div
            className="flex items-center gap-2.5 rounded-[8px] border px-3.5 py-2.5 mt-3"
            style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
          >
            <Info className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
            <p className="text-[12px]" style={{ fontWeight: 450, color: "#334155" }}>
              No credit for the current cycle, the lower rate starts on your next billing date.
            </p>
          </div>
        )}
        </div>
      </div>

      {/* ── Company-Wide Impact ── */}
      <div className="rounded-[12px] border bg-white overflow-hidden mb-3" style={{ borderColor: "#E2E8F0" }}>
        <SectionCardHeader icon={Building2} title="Company-Wide Impact" />
        <div className="px-5 pt-4 pb-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Daily Spend</span>
            <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(companyDaily)}/day</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Daily Spend</span>
            <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(newDaily)}/day</span>
          </div>
          <div className="h-px my-1" style={{ backgroundColor: "#E2E8F0" }} />
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>Current Monthly Estimate</span>
            <span className="text-[12.5px]" style={{ color: "#334155", fontWeight: 520 }}>{formatCurrency(companyMonthly)}/mo</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>New Monthly Estimate</span>
            <span className="text-[12.5px]" style={{ color: "#0F172A", fontWeight: 620 }}>{formatCurrency(newMonthly)}/mo</span>
          </div>
          {hasSavings && (
            <div className="flex items-center justify-end mt-0.5">
              <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ fontWeight: 600, color: "#059669", backgroundColor: "#F0FDF4" }}>
                -{formatCurrency(totalMonthlyDelta)}/mo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── View Full Breakdown ──
             Same header anatomy as the cards above, but it is the disclosure
             control: slate only while expanded, white at rest. */}
      <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}>
        <button
          onClick={() => setBreakdownVisible((v) => !v)}
          className={`flex items-center gap-2 w-full px-5 pt-3 pb-3 cursor-pointer transition-colors ${breakdownVisible ? "" : "hover:bg-[#F8FAFC]"}`}
          style={{ backgroundColor: breakdownVisible ? "#F8FAFC" : "#FFFFFF" }}
        >
          <Table2 className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span className="text-[14px]" style={{ fontWeight: 600, color: "#0F172A" }}>View Full Breakdown</span>
          <ChevronDown className="w-4 h-4 ml-auto shrink-0 transition-transform duration-200" style={{ color: "#64748B", transform: breakdownVisible ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>

        {breakdownVisible && (
          <div style={{ borderTop: "1px solid #E2E8F0" }}>
            {isBulk ? (
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      {["User", "Current license", "Current rate", "New license", "New rate", "Monthly delta"].map((h, i) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-[11px] uppercase tracking-wide whitespace-nowrap"
                          style={{ color: "#64748B", fontWeight: 600, letterSpacing: "0.04em", textAlign: i === 0 ? "left" : i === 5 ? "right" : "left" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, idx) => (
                      <tr key={r.id} style={{ borderTop: idx === 0 ? "none" : "1px solid #F1F5F9" }}>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <ReviewAvatar userId={r.id} name={r.fullName} size={24} />
                            <span className="text-[12px] truncate" style={{ color: "#0F172A", fontWeight: 500 }}>{r.fullName}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#475569" }}>{r.fromLicense}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#475569" }}>{formatCurrency(r.fromDaily)}/day</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#475569" }}>{r.toLicense}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#475569" }}>{formatCurrency(r.toDaily)}/day</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right" style={{ color: "#059669", fontWeight: 600 }}>-{formatCurrency(r.dailyDelta * CYCLE_DAYS)}/mo</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                      <td className="px-3 py-2.5 text-[12.5px]" style={{ color: "#0F172A", fontWeight: 700 }} colSpan={5}>
                        Total ({userCount} user{userCount === 1 ? "" : "s"})
                      </td>
                      <td className="px-3 py-2.5 text-right text-[12.5px]" style={{ color: "#059669", fontWeight: 700 }}>
                        -{formatCurrency(totalMonthlyDelta)}/mo
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              [
                { label: `Current daily rate (${fromLicense})`, value: `${formatCurrency(fromDaily)}/user/day` },
                { label: `New daily rate (${targetLicense})`, value: `${formatCurrency(toDaily)}/user/day` },
                { label: "Rate Difference", value: `${formatCurrency(perUserDelta)}/day` },
                { label: "Users Affected", value: `${userCount}` },
                { label: "Days Remaining This Cycle", value: `${DAYS_REMAINING}` },
                { label: "Next Full Cycle Savings", value: `-${formatCurrency(totalMonthlyDelta)}/mo` },
                { label: "Current Monthly Estimate", value: `${formatCurrency(companyMonthly)}/mo` },
                { label: "New Monthly Estimate", value: `${formatCurrency(newMonthly)}/mo`, isLast: true },
              ].map((row, i) => (
                <div
                  key={row.label}
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
