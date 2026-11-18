import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { users, type UserRow } from "../../data/users-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { useUserQuickView } from "../shared/UserQuickViewPanel";

export type OwnerDecision = "owner-only" | "owner-and-add";

interface SingleRoleContext {
  /** "single-role": confirming non-holders for a single role (Role Detail entry point) */
  kind: "single-role";
  roleName: string;
  /** Map of userId → decision (caller controls defaults) */
  ineligibleUserIds: number[];
}

interface MultiRoleContext {
  /** "multi-role": confirming non-holders across many roles (Configure Manage Roles entry) */
  kind: "multi-role";
  /** Each row is a (userId, roleId, roleName) tuple. */
  rows: Array<{ userId: number; roleId: number; roleName: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (decisions: Record<string, OwnerDecision>) => void;
  context: SingleRoleContext | MultiRoleContext;
}

/* Build a stable row key: single-role uses userId, multi-role uses userId:roleId. */
function rowKey(userId: number, roleId?: number): string {
  return roleId == null ? String(userId) : `${userId}:${roleId}`;
}

export function ConfirmRoleOwnerAssignmentModal({
  open,
  onClose,
  onConfirm,
  context,
}: Props) {
  const { openQuickView } = useUserQuickView();

  /* Build the visible rows (uniform shape) */
  const rows = useMemo(() => {
    if (context.kind === "single-role") {
      return context.ineligibleUserIds.map((uid) => ({
        key: rowKey(uid),
        userId: uid,
        roleId: undefined as number | undefined,
        roleName: context.roleName,
      }));
    }
    return context.rows.map((r) => ({
      key: rowKey(r.userId, r.roleId),
      userId: r.userId,
      roleId: r.roleId as number | undefined,
      roleName: r.roleName,
    }));
  }, [context]);

  /* Per-row decisions, default = owner-only */
  const [decisions, setDecisions] = useState<Record<string, OwnerDecision>>({});
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, OwnerDecision> = {};
    rows.forEach((r) => {
      initial[r.key] = "owner-only";
    });
    setDecisions(initial);
  }, [open, rows]);

  if (!open) return null;

  const isSingle = rows.length === 1;
  /* Determine a single shared role name when applicable for the title. */
  const uniqueRoleNames = Array.from(new Set(rows.map((r) => r.roleName)));
  const sharedRoleName = uniqueRoleNames.length === 1 ? uniqueRoleNames[0] : null;
  const titleCopy = sharedRoleName
    ? `Users Not On ${sharedRoleName}`
    : "Users Not On These Roles";
  const bodyCopy = isSingle
    ? `${users.find((u) => u.id === rows[0].userId)?.fullName ?? "This user"} is not on ${rows[0].roleName} right now. You can still make them a role owner, since owners do not need to hold the role. Or you can add them to the role at the same time.`
    : "The users listed below are not on the roles shown. Decide what to do for each before you continue. Role owners do not need to hold the role, but you can add them if you want to.";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-[760px] max-h-[80vh]"
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-[16px] text-[#0F172A]" style={{ fontWeight: 600 }}>
            {titleCopy}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <p className="text-[13px] text-[#475569] leading-[1.55] mb-4">
            {bodyCopy}
          </p>

          <ul className="space-y-2.5">
            {rows.map((row) => {
              const u = users.find((user) => user.id === row.userId) as
                | UserRow
                | undefined;
              if (!u) return null;
              const tint = getAvatarTint(u.fullName);
              const initials = getInitials(u.fullName);
              const avatarUrl = USER_AVATAR_MAP[u.id];
              const decision = decisions[row.key] ?? "owner-only";

              return (
                <li
                  key={row.key}
                  className="px-3.5 py-3 rounded-lg bg-white"
                  style={{
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 2px 6px -1px rgba(15, 23, 42, 0.08), 0 1px 2px 0 rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openQuickView(u.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={u.fullName}
                          className="w-9 h-9 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-[12px]"
                          style={{
                            backgroundColor: tint.bg,
                            color: tint.fg,
                            fontWeight: 600,
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13.5px] truncate"
                          style={{ fontWeight: 500, color: "#1E293B" }}
                        >
                          {u.fullName}
                        </div>
                        <div className="text-[11.5px] text-[#64748B] truncate mt-0.5">
                          {u.email}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Per-row segmented control */}
                  <div
                    className="mt-2.5 flex rounded-[8px] gap-1 p-1"
                    style={{ border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}
                  >
                    {(
                      [
                        ["owner-only", "Just make them an owner"],
                        ["owner-and-add", "Make them an owner and add them to the role"],
                      ] as const
                    ).map(([value, label]) => {
                      const isActive = decision === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [row.key]: value }))
                          }
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
                            isActive
                              ? "bg-white text-[#0E69E2] shadow-sm"
                              : "bg-transparent text-[#475569] hover:bg-white/60"
                          }`}
                          style={{ fontWeight: isActive ? 600 : 500 }}
                        >
                          {isActive && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#E2E8F0] shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Back
          </button>
          <button
            onClick={() => onConfirm(decisions)}
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
