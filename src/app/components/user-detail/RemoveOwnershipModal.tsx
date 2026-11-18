/* ═══════════════════════════════════════════════════════════════════
   Remove Ownership Modal
   ───────────────────────────────────────────────────────────────────
   Always shows the two-column reassignment flow. The active role's
   card shows the "Recommended" amber treatment when the user is the
   sole owner, and a normal card when other owners exist, that
   distinction is computed inside OwnershipStep based on co-owners.
   ═══════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { OwnershipStep } from "./DeactivateUserWizard";
import { removeRoleOwner } from "../../data/role-owners-data";
import type { OwnedRoleRow } from "./RoleOwnershipTab";

interface RemoveOwnershipModalProps {
  open: boolean;
  onClose: () => void;
  row: OwnedRoleRow;
  userId: number;
  userName: string;
}

export function RemoveOwnershipModal({
  open,
  onClose,
  row,
  userId,
  userName,
}: RemoveOwnershipModalProps) {
  const isManageRoles = row.grantedVia === "manage-roles";

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [ownerAssignments, setOwnerAssignments] = useState<Record<number, number | undefined>>({});

  useEffect(() => {
    if (!open) return;
    setOwnerAssignments({});
    setIsFullScreen(false);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reassignment is optional, button is always enabled.

  const handleConfirm = useCallback(() => {
    removeRoleOwner(row.id, userId);
    const actionLabel = isManageRoles
      ? "Manage Roles permission removed"
      : "Role ownership removed";
    toast.success(`${actionLabel} from ${userName} for ${row.roleName}.`);
    onClose();
  }, [row, userId, userName, isManageRoles, onClose]);

  const title = isManageRoles
    ? "Remove Manage Roles permission"
    : "Remove role ownership";

  const subtitle = isManageRoles
    ? `Remove Manage Roles permission from ${userName}.`
    : `Remove ${userName} as owner of ${row.roleName}.`;

  const primaryLabel = isManageRoles
    ? "Remove permission"
    : "Remove ownership";

  return (
    <ModalShell open={open} onClose={onClose} z={40}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "1280px",
          maxHeight: isFullScreen
            ? "calc(100vh - 2rem)"
            : "min(860px, calc(100vh - 48px))",
          borderRadius: 16,
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 lg:px-5 pt-4 pb-4 shrink-0 bg-white border-b border-[#EEF2F6]"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="text-[15px] sm:text-[17px] text-[#0F172A]"
                style={{ fontWeight: 700 }}
              >
                {title}
              </h2>
              <p
                className="text-[11px] sm:text-xs text-[#64748B] mt-0.5"
                style={{ fontWeight: 400 }}
              >
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4" style={{ minHeight: 0 }}>
          <OwnershipStep
            userName={userName}
            userId={userId}
            ownedRoleIds={[row.id]}
            selections={ownerAssignments}
            onChange={setOwnerAssignments}
          />
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
          style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        >
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] text-sm border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            style={{ fontWeight: 500, color: "#475569" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="h-9 px-4 rounded-[8px] text-sm text-white transition-colors cursor-pointer"
            style={{
              fontWeight: 600,
              backgroundColor: "#B45309",
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
