import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, X } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { users } from "../../data/users-data";
import { roles as allRoles } from "../../data/roles-data";
import { getRoleDetail } from "../../data/role-detail-data";
import { getUniqueUserCountForRoles } from "../../data/uac-derived";
import { AffectedUsersDisclosure } from "./AffectedUsersDisclosure";

interface BulkDeactivateRolesModalProps {
  open: boolean;
  onClose: () => void;
  selectedRoleIds: (number | string)[];
  onConfirm?: () => void;
}

/* Resolve assigned users for a role from role-detail-data, falling back to a
 * deterministic pick if no detail record exists. */
function getAssignedUsersForRole(roleId: number | string, count: number) {
  if (count <= 0) return [];
  const detail = typeof roleId === "number" ? getRoleDetail(roleId) : null;
  if (detail?.assignedUserIds?.length) {
    return detail.assignedUserIds
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean) as typeof users;
  }
  // Fallback deterministic pick
  const seed = typeof roleId === "number" ? roleId : roleId.toString().length;
  const result: typeof users = [];
  const used = new Set<number>();
  let i = 0;
  while (result.length < Math.min(count, users.length) && i < users.length * 2) {
    const idx = (seed * 7 + i * 3) % users.length;
    const u = users[idx];
    if (u && !used.has(u.id)) {
      used.add(u.id);
      result.push(u);
    }
    i++;
  }
  return result;
}

export function BulkDeactivateRolesModal({
  open,
  onClose,
  selectedRoleIds,
  onConfirm,
}: BulkDeactivateRolesModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const selectedRoles = useMemo(
    () =>
      selectedRoleIds
        .map((id) => allRoles.find((r) => r.id === id))
        .filter(Boolean) as typeof allRoles,
    [selectedRoleIds]
  );

  /* People, not role assignments: someone holding three of the selected roles
   * is one impacted user, not three. The header badge and the success toast
   * both read this number, so the two can never disagree. */
  const totalUsers = useMemo(
    () => getUniqueUserCountForRoles(selectedRoles.map((r) => r.id)),
    [selectedRoles]
  );

  const roleCount = selectedRoles.length;

  const handleConfirm = () => {
    onConfirm?.();
    toast.success(
      `${roleCount} role${roleCount !== 1 ? "s" : ""} deactivated. ${totalUsers} user${totalUsers !== 1 ? "s" : ""} removed from these roles.`
    );
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
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF2F6] bg-white shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            <h3 className="text-[15px] text-[#0F172A]" style={{ fontWeight: 650 }}>
              Deactivate {roleCount} Role{roleCount !== 1 ? "s" : ""}
            </h3>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]"
              style={{
                backgroundColor: "#FFFBEB",
                color: "#92400E",
                fontWeight: 600,
                border: "1px solid #FDE68A",
              }}
            >
              {totalUsers} user{totalUsers !== 1 ? "s" : ""} impacted
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content area: slate background, scrollable */}
        <div
          className="overflow-y-auto flex-1 px-5 py-4"
          style={{ minHeight: 0, backgroundColor: "#F8FAFC" }}
        >
          {/* Slate info banner */}
          <div
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border"
            style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#475569" }}
            />
            <p
              className="text-[12.5px] leading-[1.55]"
              style={{ color: "#334155", fontWeight: 450 }}
            >
              Deactivating these roles will remove them from all currently assigned
              users. They will lose any permissions and access inherited exclusively
              from these roles.
            </p>
          </div>

          {/* Role cards: each card IS the accordion */}
          <div className="mt-4 flex flex-col gap-3">
            {selectedRoles.map((role) => {
              const assignedUsers = getAssignedUsersForRole(role.id, role.usersCount);

              return (
                <div
                  key={role.id}
                  className="rounded-[10px] border bg-white overflow-hidden"
                  style={{ borderColor: "#E2E8F0" }}
                >
                  <AffectedUsersDisclosure
                    users={assignedUsers}
                    totalCount={role.usersCount}
                    resetKey={open}
                    accentColor="#007FFF"
                    variant="bare"
                    headerLeft={
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="text-[14px] text-[#0F172A] truncate"
                          style={{ fontWeight: 600 }}
                        >
                          {role.roleName}
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
                          {role.usersCount} user{role.usersCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div
            className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg border bg-white"
            style={{ borderColor: "#E2E8F0" }}
          >
            <Info
              className="w-3.5 h-3.5 shrink-0 mt-0.5"
              style={{ color: "#94A3B8" }}
            />
            <p
              className="text-[11.5px] leading-[1.55]"
              style={{ color: "#64748B", fontWeight: 420 }}
            >
              This does not delete the roles. You can reactivate them at any time,
              but users will need to be reassigned manually. Previous assignments
              are recorded in each role's Activity log.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-white shrink-0">
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
            style={{ fontWeight: 600, backgroundColor: "#D97706" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#B45309";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#D97706";
            }}
          >
            Deactivate {roleCount} Role{roleCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
