import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getInitials, getAvatarTint } from "../../lib/avatar";
import { users as ALL_USERS } from "../../data/users-data";
import { StatusBadge, LicenseBadge } from "../table-cells";
import { useUserQuickView } from "./UserQuickViewPanel";

export interface AffectedUser {
  id: number;
  fullName: string;
}

interface AffectedUsersDisclosureProps {
  users: AffectedUser[];
  /** Total count for label/show-all (defaults to users.length). */
  totalCount?: number;
  /** Reset expanded state when this key changes (e.g. modal open). */
  resetKey?: unknown;
  /** Tone of the link/toggle text. */
  accentColor?: string;
  /** Optional empty-state message. */
  emptyLabel?: string;
  /** Custom header content rendered on the left side of the accordion trigger. When provided, overrides the default "Affected Users (N)" label. */
  headerLeft?: React.ReactNode;
  /** Override container styles (e.g. remove border for inline use inside another card). */
  variant?: "card" | "bare";
  /** Start expanded instead of collapsed. */
  defaultExpanded?: boolean;
  /** Override the toggle label shown when collapsed (default: "Show all {N} users"). */
  showAllLabel?: string;
  /** Override the toggle label shown when expanded (default: "Hide all"). */
  hideAllLabel?: string;
}

function getUserAvatarUrl(userId: number): string | null {
  return USER_AVATAR_MAP[userId] ?? null;
}

function InlineAvatar({
  name,
  userId,
  size = 26,
  onClick,
}: {
  name: string;
  userId?: number;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const avatarUrl = userId != null ? getUserAvatarUrl(userId) : null;
  const interactive = !!onClick;
  const commonProps = interactive
    ? {
        onClick,
        role: "button" as const,
        tabIndex: 0,
        title: name,
        className:
          "rounded-full shrink-0 cursor-pointer hover:ring-2 hover:ring-[#007FFF]/40 transition",
      }
    : { className: "rounded-full shrink-0" };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        {...commonProps}
        className={`${commonProps.className} object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  const tint = getAvatarTint(name);
  return (
    <div
      {...commonProps}
      className={`${commonProps.className} flex items-center justify-center`}
      style={{
        width: size,
        height: size,
        backgroundColor: tint.bg,
        color: tint.fg,
        fontWeight: 600,
        fontSize: size * 0.36,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function AffectedUsersDisclosure({
  users,
  totalCount,
  resetKey,
  accentColor = "#007FFF",
  emptyLabel = "No users assigned",
  headerLeft,
  variant = "card",
  defaultExpanded = false,
  showAllLabel,
  hideAllLabel = "Hide all",
}: AffectedUsersDisclosureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const count = totalCount ?? users.length;
  const { openQuickView } = useUserQuickView();

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [resetKey, defaultExpanded]);

  if (count === 0) {
    return (
      <p className="text-[12px]" style={{ color: "#94A3B8", fontWeight: 450 }}>
        {emptyLabel}
      </p>
    );
  }

  const canToggle = users.length > 1;
  const containerClass =
    variant === "card"
      ? "rounded-[8px] border overflow-hidden"
      : "overflow-hidden";
  const containerStyle =
    variant === "card"
      ? { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }
      : {};

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Accordion header: entire row clickable */}
      <button
        type="button"
        onClick={() => canToggle && setExpanded((v) => !v)}
        disabled={!canToggle}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left ${
          canToggle ? "cursor-pointer hover:bg-[#F1F5F9]" : "cursor-default"
        } transition-colors`}
      >
        <div className="min-w-0 flex-1">
          {headerLeft ?? (
            <p
              className="text-[13px] text-[#0F172A]"
              style={{ fontWeight: 600 }}
            >
              Affected Users ({count})
            </p>
          )}
        </div>
        {canToggle && (
          <span
            className="flex items-center gap-1 text-[12px] shrink-0"
            style={{ color: accentColor, fontWeight: 500 }}
          >
            {expanded ? (
              <>{hideAllLabel} <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>{showAllLabel ?? `Show all ${count} users`} <ChevronDown className="w-3 h-3" /></>
            )}
          </span>
        )}
      </button>

      {/* Expanded table: flush, no column header */}
      {expanded && (
        <div
          className="overflow-y-auto bg-white border-t"
          style={{ maxHeight: 320, borderColor: "#E2E8F0" }}
        >
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {users.map((u, idx) => {
                const fullUser = ALL_USERS.find((x) => x.id === u.id);
                return (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom:
                        idx === users.length - 1 ? "none" : "1px solid #F1F5F9",
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <InlineAvatar
                          name={u.fullName}
                          userId={u.id}
                          size={36}
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuickView(u.id);
                          }}
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className="text-[#0F172A] truncate text-[13px]" style={{ fontWeight: 500 }}>
                            {u.fullName}
                          </span>
                          {fullUser && (
                            <span className="text-[#64748B] truncate text-[11.5px]" style={{ fontWeight: 420 }}>
                              {fullUser.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {fullUser && (
                      <>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <LicenseBadge license={fullUser.license} />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StatusBadge status={fullUser.status} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
