import { useMemo, useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, X } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { users } from "../../data/users-data";
import { AffectedUsersDisclosure } from "./AffectedUsersDisclosure";

type Variant = "deactivate" | "archive";

interface DeactivateRoleModalProps {
  open: boolean;
  onClose: () => void;
  roleName: string;
  usersCount: number;
  assignedUserIds?: number[];
  onConfirm?: () => void;
  /** Visual + copy variant. Defaults to "deactivate" (amber). */
  variant?: Variant;
}

/* ─── Variant config ─── */
const VARIANT_CONFIG: Record<Variant, {
  title: (roleName: string) => string;
  warningBg: string;
  warningBorder: string;
  warningIcon: string;
  warningText: string;
  warningCopy: string;
  infoCopy: string;
  emptyCopy: (roleName: string) => React.ReactNode;
  confirmLabel: string;
  confirmBg: string;
  confirmHover: string;
  confirmActive: string;
  toastSuccess: (roleName: string, count: number) => string;
}> = {
  deactivate: {
    title: (n) => `Deactivate ${n}?`,
    warningBg: "#F1F5F9",
    warningBorder: "#E2E8F0",
    warningIcon: "#475569",
    warningText: "#334155",
    warningCopy:
      "Deactivating a role removes it from all users who currently hold it. This action takes effect immediately. The following users will be unassigned from this role and will lose all permissions that are granted through it. Permissions these users hold from other roles or from direct assignments are not affected.",
    infoCopy:
      "Once a role is deactivated, it cannot be assigned to any users. You can reactivate the role at any time, but reactivation does not restore previous assignments. Any users who were unassigned will need to be reassigned manually. To review which users were unassigned after deactivation, check the activity log for this role.",
    emptyCopy: (n) => (
      <>
        Deactivate <span style={{ fontWeight: 600 }}>{n}</span>? Once a role is
        deactivated, it cannot be assigned to any users. You can reactivate the
        role at any time.
      </>
    ),
    confirmLabel: "Deactivate Role",
    confirmBg: "#D97706",
    confirmHover: "#B45309",
    confirmActive: "#92400E",
    toastSuccess: (n, c) =>
      `${n} deactivated. ${c} user${c !== 1 ? "s" : ""} removed from this role.`,
  },
  archive: {
    title: (n) => `Archive ${n}?`,
    warningBg: "#FEF2F2",
    warningBorder: "#FECACA",
    warningIcon: "#DC2626",
    warningText: "#991B1B",
    warningCopy:
      "Archiving a role deactivates it and removes it from the active roles listing. All current users will be unassigned from this role and will lose all permissions granted through it, and the role's owners are cleared. Permissions these users hold from other roles or from direct assignments are not affected. The role's permission set is kept: unarchiving restores the role with those permissions and no users or owners, ready to reassign.",
    infoCopy:
      "The role will only appear when the Archived filter is applied. Role data and activity history are preserved for audit purposes.",
    emptyCopy: (n) => (
      <>
        This role is already deactivated and has no assigned users. Archiving{" "}
        <span style={{ fontWeight: 600 }}>{n}</span> clears its owners and
        removes it from the active roles listing. It will only appear when the
        Archived filter is applied.
        <br />
        <br />
        The role's permission set is kept. Unarchiving the role restores it with
        those permissions and no users or owners, ready to reassign.
      </>
    ),
    confirmLabel: "Archive Role",
    confirmBg: "#DC2626",
    confirmHover: "#B91C1C",
    confirmActive: "#991B1B",
    toastSuccess: (n) => `${n} was archived.`,
  },
};


export function DeactivateRoleModal({
  open,
  onClose,
  roleName,
  usersCount,
  assignedUserIds = [],
  onConfirm,
  variant = "deactivate",
}: DeactivateRoleModalProps) {
  const cfg = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const affectedUsers = useMemo(() => {
    return assignedUserIds
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean) as typeof users;
  }, [assignedUserIds]);

  const count = affectedUsers.length || usersCount;
  const hasUsers = count > 0;

  const handleConfirm = () => {
    onConfirm?.();
    toast.success(cfg.toastSuccess(roleName, count));
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 760,
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "85vh",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header: bordered bottom */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF2F6]">
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] text-[#0F172A]"
              style={{ fontWeight: 650 }}
            >
              {cfg.title(roleName)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4" style={{ minHeight: 0 }}>
          {hasUsers ? (
            <>
              {/* Warning banner */}
              <div
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border"
                style={{
                  backgroundColor: cfg.warningBg,
                  borderColor: cfg.warningBorder,
                }}
              >
                <AlertTriangle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  style={{ color: cfg.warningIcon }}
                />
                <p
                  className="text-[12.5px] leading-[1.55]"
                  style={{ color: cfg.warningText, fontWeight: 450 }}
                >
                  {cfg.warningCopy}
                </p>
              </div>

              {/* Affected users: shared accordion */}
              <div className="mt-4">
                <AffectedUsersDisclosure
                  users={affectedUsers}
                  totalCount={count}
                  resetKey={open}
                  accentColor="#007FFF"
                />
              </div>

              {/* Info note */}
              <InfoNote className="mt-4">{cfg.infoCopy}</InfoNote>
            </>
          ) : (
            <p
              className="text-[13px]"
              style={{ color: "#475569", fontWeight: 420, lineHeight: 1.6 }}
            >
              {cfg.emptyCopy(roleName)}
            </p>
          )}
        </div>

        {/* Footer: bordered top */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-[#FAFBFC]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="h-9 px-4 rounded-lg text-[13px] transition-colors cursor-pointer shadow-sm text-white"
            style={{
              fontWeight: 600,
              backgroundColor: cfg.confirmBg,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = cfg.confirmHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = cfg.confirmBg;
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = cfg.confirmActive;
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = cfg.confirmHover;
            }}
          >
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Info note ─── */
function InfoNote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${className}`}
      style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
    >
      <Info
        className="w-3.5 h-3.5 shrink-0 mt-0.5"
        style={{ color: "#94A3B8" }}
      />
      <p
        className="text-[11.5px] leading-[1.55]"
        style={{ color: "#64748B", fontWeight: 420 }}
      >
        {children}
      </p>
    </div>
  );
}
