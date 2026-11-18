import { useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { AffectedUsersDisclosure } from "./AffectedUsersDisclosure";

interface AffectedUser {
  id: number;
  fullName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Number of users currently assigned to the role. 0 → Variant B. */
  assignedUserCount: number;
  roleName: string;
  /** Called when admin confirms, apply the role edit. */
  onConfirm: () => void;
  /** Optional list of affected (under-licensed) users to render in the disclosure. */
  affectedUsers?: AffectedUser[];
  /** Stacking order, pass a high value when opened over another modal
   *  (e.g. the permission editor). Defaults to the ModalShell default. */
  z?: number;
}

/**
 * Blocking confirmation shown when an edit raises a role's required license
 * tier from Field User → Full Access.
 *
 * - Variant A (assignedUserCount > 0): warns about users on the role and
 *   surfaces them in an expandable list.
 * - Variant B (assignedUserCount === 0): forward-looking message only.
 */
export function RoleTierRaiseWarningModal({
  open,
  onClose,
  assignedUserCount,
  roleName,
  onConfirm,
  affectedUsers = [],
  z,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const variantA = assignedUserCount > 0;

  const handleConfirm = () => {
    onConfirm();
    toast.success(
      `Changes saved. ${roleName} now needs a Full Access license.`
    );
    onClose();
  };

  /* Purple "Full Access" chip, matches LicenseBadge styling from the role
   * listing table. Inlined so we can drop it inside flowing copy. */
  const FullAccessChip = () => (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11.5px] border align-middle mx-0.5"
      style={{
        backgroundColor: "#EDE9FE",
        color: "#5B21B6",
        borderColor: "#C4B5FD",
        fontWeight: 500,
      }}
    >
      Full Access
    </span>
  );

  return (
    <ModalShell open={open} onClose={onClose} z={z ?? 70}>
      <div
        className="bg-white rounded-2xl flex flex-col overflow-hidden"
        style={{
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header: distinct, white, bottom border */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF2F6] bg-white shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FFFBEB" }}
          >
            <AlertTriangle className="w-[18px] h-[18px]" style={{ color: "#D97706" }} />
          </div>
          <h3
            className="flex-1 min-w-0 text-[15px] text-[#0F172A]"
            style={{ fontWeight: 650 }}
          >
            This Role Now Requires Full Access
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: slate background, scrollable */}
        <div
          className="overflow-y-auto flex-1 px-5 py-4"
          style={{ minHeight: 0, backgroundColor: "#F8FAFC" }}
        >
          <p
            className="text-[13px] text-[#475569]"
            style={{ fontWeight: 420, lineHeight: 1.65 }}
          >
            {variantA ? (
              <>
                The permissions you just added require a
                <FullAccessChip />
                license. Users on this role with a Field User license won't be
                able to use it until their license is upgraded.
              </>
            ) : (
              <>
                The permissions you just added require a
                <FullAccessChip />
                license. Anyone you assign to this role later will need a Full
                Access license for it to work.
              </>
            )}
          </p>

          {variantA && affectedUsers.length > 0 && (
            <div className="mt-4">
              <div
                className="rounded-[10px] border bg-white overflow-hidden"
                style={{ borderColor: "#E2E8F0" }}
              >
                <AffectedUsersDisclosure
                  users={affectedUsers}
                  totalCount={affectedUsers.length}
                  resetKey={open}
                  defaultExpanded
                  variant="bare"
                  accentColor="#007FFF"
                  showAllLabel="Show all"
                  hideAllLabel="Hide all"
                  headerLeft={
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[13px] text-[#0F172A]"
                        style={{ fontWeight: 600 }}
                      >
                        Affected Users
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] shrink-0"
                        style={{
                          backgroundColor: "#FFFBEB",
                          color: "#92400E",
                          fontWeight: 600,
                          border: "1px solid #FDE68A",
                        }}
                      >
                        {affectedUsers.length} user
                        {affectedUsers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  }
                />
              </div>
              <p
                className="text-[11.5px] mt-2.5"
                style={{ color: "#64748B", fontWeight: 420, lineHeight: 1.55 }}
              >
                You can upgrade licenses from each user's profile after saving.
              </p>
            </div>
          )}
        </div>

        {/* Footer: distinct, white, top border */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-white shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Back to Editing
          </button>
          <button
            onClick={handleConfirm}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white shadow-sm transition-colors cursor-pointer bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF]"
            style={{ fontWeight: 600 }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
