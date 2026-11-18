import { useEffect, useState } from "react";
import { X, AlertTriangle, ShieldX, CheckCircle2 } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { users as allUsersData } from "../../data/users-data";
import { SYSTEM_ROLE_NAMES } from "../../data/roles-data";
import { goConfirmIdentity, recentlyConfirmed } from "../../lib/mfaReauth";

/* Confirm MFA Reset, matched to Security Settings' Reset2FAModal (12 Nov 2026,
 * for consistency): header with a 40px tile, 17px/700 title and a borderless
 * close; #FAFBFC body with the High Risk warning, the user card and the policy
 * context; white footer with a bordered Cancel and the red Reset User MFA.
 *
 * ERP-5179 as changed on 12 Nov 2026 (Hamza and Fatima): no password field and no
 * reason field. Reset User MFA goes to the sign-in page to confirm it's you
 * (lib/mfaReauth), unless that happened in the last few minutes; coming back,
 * the reset is done and this modal opens on its done stage (ResetMfaReturn). */

interface ResetMfaModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userId?: number;
  primaryRole?: string;
  onConfirm?: () => void;
  /** done: back from the sign-in page with the reset finished. */
  initialStage?: "confirm" | "done";
}

const POLICY = {
  name: "Company MFA Policy",
  gracePeriod: "14 Days",
};

const BORDER = "#E2E8F0";
const CANCEL_CLASS =
  "inline-flex items-center justify-center h-9 px-5 rounded-lg border bg-white text-[13px] text-[#64748B] hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer";

function getUserAvatarUrl(name: string): string | null {
  const match = allUsersData.find((u) => u.fullName === name);
  if (match && USER_AVATAR_MAP[match.id]) return USER_AVATAR_MAP[match.id];
  return null;
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const url = getUserAvatarUrl(name);
  if (url) {
    return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const tint = getAvatarTint(name);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: tint.bg, color: tint.fg, fontWeight: 600, fontSize: size * 0.34 }}
    >
      {getInitials(name)}
    </div>
  );
}

export function ResetMfaModal({
  open,
  onClose,
  userName,
  userEmail,
  userId,
  primaryRole,
  onConfirm,
  initialStage = "confirm",
}: ResetMfaModalProps) {
  const [stage, setStage] = useState(initialStage);
  useEffect(() => {
    if (open) setStage(initialStage);
  }, [open, initialStage]);

  const rawRole =
    primaryRole ?? (userId ? allUsersData.find((u) => u.id === userId)?.assignedRoles?.[0] : undefined) ?? "-";
  // Some rows carry the role in lower case; show the role's own name.
  const role = SYSTEM_ROLE_NAMES.find((n) => n.toLowerCase() === rawRole.toLowerCase()) ?? rawRole;
  const done = stage === "done";
  const needsSignIn = !recentlyConfirmed();

  const handleConfirm = () => {
    if (!needsSignIn || userId === undefined) {
      onConfirm?.();
      setStage("done");
      return;
    }
    goConfirmIdentity(userId, userName);
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        data-reset-mfa-modal={stage}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-mfa-title"
        className="bg-white overflow-hidden flex flex-col"
        style={{
          width: 600,
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "90vh",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="shrink-0 bg-white border-b px-5 pt-4 pb-3.5 flex items-center justify-between gap-3" style={{ borderColor: "#EEF2F6" }}>
          <div className="flex items-center gap-3 min-w-0">
            {done ? (
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                <ShieldX className="w-5 h-5" />
              </div>
            )}
            <h3 id="reset-mfa-title" className="text-[17px] leading-snug text-[#0F172A] truncate" style={{ fontWeight: 700 }}>
              {done ? "MFA Reset" : "Confirm MFA Reset"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-black/5 transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4" style={{ backgroundColor: "#FAFBFC" }}>
          {done ? (
            <p className="text-[13px] leading-relaxed text-[#475569]">
              {userName}&rsquo;s MFA is reset. They&rsquo;ll set it up again the next time they sign in.
            </p>
          ) : (
            <>
              {/* High risk warning */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
                <div className="min-w-0">
                  <p className="text-[13px]" style={{ fontWeight: 600, color: "#991B1B" }}>High Risk Action</p>
                  <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#991B1B" }}>
                    This will invalidate the user's current authenticator app. They will need to re-scan a QR code at their next sign-in.
                  </p>
                </div>
              </div>

              {/* User being reset */}
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                <p className="text-[11px] tracking-wide uppercase text-[#64748B] mb-3" style={{ fontWeight: 600 }}>
                  Resetting MFA For
                </p>
                <div className="flex items-center gap-3">
                  <Avatar name={userName} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-[#1E293B] truncate" style={{ fontWeight: 600 }}>{userName}</p>
                    <p className="text-[12px] text-[#64748B] truncate">
                      {userEmail} · <span className="text-[#475569]" style={{ fontWeight: 500 }}>{role}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy context */}
              <div>
                <div className="rounded-lg border bg-white px-4 py-3 grid grid-cols-2 gap-4" style={{ borderColor: BORDER }}>
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#64748B]">Applied Policy</p>
                    <p className="text-[13px] text-[#334155] truncate mt-0.5" style={{ fontWeight: 500 }} title={POLICY.name}>
                      {POLICY.name}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#64748B]">Grace Period</p>
                    <p className="text-[13px] text-[#334155] mt-0.5" style={{ fontWeight: 500 }}>{POLICY.gracePeriod}</p>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mt-1.5">
                  These settings are inherited from the policy. To change them, edit the policy directly.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-white border-t px-5 py-3 flex flex-wrap items-center justify-end gap-2.5" style={{ borderColor: "#EEF2F6" }}>
          {done ? (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-[13px] text-white shadow-sm transition-colors cursor-pointer bg-[#0A77FF] hover:bg-[#0066E0]"
              style={{ fontWeight: 500 }}
            >
              Done
            </button>
          ) : (
            <>
              {needsSignIn && (
                <p className="mr-auto text-[12px] text-[#64748B]" data-reset-sign-in-note>
                  You&rsquo;ll sign in again to confirm it&rsquo;s you, then return here.
                </p>
              )}
              <button onClick={onClose} className={CANCEL_CLASS} style={{ fontWeight: 500, borderColor: BORDER }}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-[13px] text-white shadow-sm transition-colors cursor-pointer bg-[#DC2626] hover:bg-[#B91C1C]"
                style={{ fontWeight: 500 }}
              >
                Reset User MFA
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
