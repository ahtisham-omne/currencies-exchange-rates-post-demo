import { useMemo } from "react";
import { Info, X } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { AvatarCell, StatusBadge, LicenseBadge } from "../table-cells";
import { useUserQuickView } from "./UserQuickViewPanel";
import type { UserRow } from "../../data/users-data";

/**
 * Shape of the at-risk user surfaced in the warning. We only need a
 * subset of UserRow, callers may pass UserRow directly or this slim shape.
 */
export interface AtRiskUser {
  id: number;
  fullName: string;
  email: string;
  status: UserRow["status"];
  license: UserRow["license"];
}

interface InactiveOrUnlicensedWarningModalProps {
  open: boolean;
  /** Users that triggered the warning (Inactive and/or No License). */
  users: AtRiskUser[];
  /** What is being assigned, e.g. "Warehouse Manager" (role) or
   *  "Edit Inventory" (permission). Used in the body copy. */
  assignmentLabel: string;
  /** "role" | "permission", drives copy ("this role grants" vs
   *  "this permission grants"). Defaults to "role". */
  assignmentType?: "role" | "permission";
  /** Subset of `users` that ALSO need a license upgrade for this role.
   *  Surfaces an inline note ("also needs a license, handle at activation")
   *  so the admin doesn't get a separate Modal B for them. */
  licenseDeficientIds?: number[];
  /** Continue button, proceed with the assignment. */
  onContinue: () => void;
  /** Go Back button, return to the previous screen without saving. */
  onGoBack: () => void;
}

/* ─── Helper: classify a single user's at-risk reason ─── */
type Reason =
  | "inactive"
  | "no_license"
  | "inactive_no_license"
  | "invite_sent"
  | "invite_sent_no_license";

function classifyUser(u: AtRiskUser): Reason | null {
  const isInactive = u.status === "Inactive";
  const isInvitePending =
    u.status === "Invite Sent" || u.status === "Invite Expired";
  const isNoLicense = u.license === "No License";

  if (isInactive && isNoLicense) return "inactive_no_license";
  if (isInvitePending && isNoLicense) return "invite_sent_no_license";
  if (isInactive) return "inactive";
  if (isInvitePending) return "invite_sent";
  if (isNoLicense) return "no_license";
  return null;
}

/** Filter a list of users → only those that need the warning. */
export function findAtRiskUsers<T extends AtRiskUser>(users: T[]): T[] {
  return users.filter((u) => classifyUser(u) !== null);
}

/* ─── Body copy generator (single user) ─── */
function singleUserBody(u: AtRiskUser): React.ReactNode {
  const name = (
    <span style={{ fontWeight: 600, color: "#0F172A" }}>{u.fullName}</span>
  );
  const reason = classifyUser(u);
  switch (reason) {
    case "inactive":
      return (
        <>
          {name} is deactivated right now. You can still assign the role, but
          it will only take effect when you reactivate them.
        </>
      );
    case "no_license":
      return (
        <>
          {name} does not have a license right now. You can still assign the
          role, but it will only take effect when you give them a license.
        </>
      );
    case "invite_sent":
      return (
        <>
          {name} has not accepted their invitation yet. You can still assign
          the role, but it will only take effect when they accept and sign in.
        </>
      );
    case "inactive_no_license":
      return (
        <>
          {name} is deactivated and does not have a license right now. You can
          still assign the role, but it will only take effect when you
          reactivate them and give them a license.
        </>
      );
    case "invite_sent_no_license":
      return (
        <>
          {name} has not accepted their invitation yet and does not have a
          license. You can still assign the role, but it will only take effect
          when they accept, sign in, and are given a license.
        </>
      );
    default:
      return null;
  }
}

/* ─── Component ─── */
export function InactiveOrUnlicensedWarningModal({
  open,
  users,
  assignmentLabel: _assignmentLabel,
  assignmentType: _assignmentType = "role",
  licenseDeficientIds,
  onContinue,
  onGoBack,
}: InactiveOrUnlicensedWarningModalProps) {
  const isSingle = users.length === 1;
  const title = "This user cannot use this role yet";
  const licenseDeficientSet = useMemo(
    () => new Set(licenseDeficientIds ?? []),
    [licenseDeficientIds]
  );
  const { openQuickView } = useUserQuickView();

  const renderStatusBadge = (status: UserRow["status"]) => (
    <StatusBadge status={status} displayLabel={status === "Inactive" ? "Deactivated" : undefined} />
  );

  const renderUserCard = (u: AtRiskUser, needsLicense: boolean) => (
    <button
      type="button"
      onClick={() => openQuickView(u.id)}
      className="w-full text-left rounded-xl bg-white px-3.5 py-3 flex items-center gap-3 transition-all hover:bg-[#F8FAFC] cursor-pointer"
      style={{
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="flex-1 min-w-0">
        <AvatarCell name={u.fullName} userId={u.id} subtitle={u.email} comfort />
        {/* pl-[48px] = 36px comfort avatar + 12px gap, so the note starts
            flush with the name/email column. */}
        {needsLicense && (
          <p className="text-[11.5px] mt-0.5 pl-[48px]" style={{ color: "#92400E", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>Note:</span> also needs a license, handle at activation.
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {renderStatusBadge(u.status)}
        <LicenseBadge license={u.license} />
      </div>
    </button>
  );

  return (
    <ModalShell open={open} onClose={onGoBack} z={70}>
      <div
        className="bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden"
        style={{
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4 bg-white shrink-0"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <Info className="w-[18px] h-[18px]" style={{ color: "#0A77FF" }} />
            </div>
            <div className="min-w-0">
              <h2
                className="text-[16px] text-[#0F172A]"
                style={{ fontWeight: 600, lineHeight: 1.4 }}
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onGoBack}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-6 py-5 overflow-y-auto"
          style={{ minHeight: 0, backgroundColor: "#F8FAFC" }}
        >
          {isSingle ? (
            (() => {
              const u = users[0];
              const needsLicense = licenseDeficientSet.has(u.id);
              return (
                <>
                  <p className="text-[13.5px] text-[#334155]" style={{ lineHeight: 1.6 }}>
                    {singleUserBody(u)}
                  </p>
                  <div className="mt-4">{renderUserCard(u, needsLicense)}</div>
                </>
              );
            })()
          ) : (
            <>
              <p className="text-[13.5px] text-[#334155]" style={{ lineHeight: 1.6 }}>
                Some of the users you selected cannot use this role yet. They
                are either deactivated, do not have a license, or have not
                accepted their invitation. You can still assign the role to all
                of them, but it will only take effect for each user when their
                account is ready to use it.
              </p>

              <div className="mt-4 flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-0.5">
                {users.map((u) => (
                  <div key={u.id}>{renderUserCard(u, licenseDeficientSet.has(u.id))}</div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0 bg-white"
          style={{ borderTop: "1px solid #F1F5F9" }}
        >
          <button
            onClick={onGoBack}
            className="h-9 px-4 rounded-[8px] border bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500, borderColor: "#E2E8F0" }}
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="h-9 px-4 rounded-[8px] text-white text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: 500, backgroundColor: "#007FFF" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#0066D6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#007FFF";
            }}
          >
            Assign Anyway
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
