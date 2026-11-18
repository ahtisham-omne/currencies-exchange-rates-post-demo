import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarTint, getInitials, resolveUserAvatar } from "../lib/avatar";
import { OverflowTooltip } from "./shared/OverflowTooltip";
import type { OverflowItem } from "./shared/OverflowTooltip";
import { Info, ExternalLink, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import { useUserQuickView } from "./shared/UserQuickViewPanel";
import { UserSummaryTooltip } from "./shared/UserSummaryTooltip";
import { LinkedUserName } from "./shared/LinkedUserName";
import { LinkedRoleName } from "./shared/LinkedRoleName";
import { roles as allRoles } from "../data/roles-data";

/* ─── AvatarCell: name with colored initials avatar ─── */
export function AvatarCell({
  name,
  nameNode,
  trailing,
  subtitle,
  subtitleNode,
  comfort = false,
  avatarUrl,
  userId,
}: {
  name: string;
  nameNode?: ReactNode;
  /** Elements rendered after the name, OUTSIDE the name link, so badges/icons
   *  (e.g. owner crown, info marker) don't pick up the name's hover link styling. */
  trailing?: ReactNode;
  subtitle?: string;
  subtitleNode?: ReactNode;
  comfort?: boolean;
  avatarUrl?: string;
  userId?: number;
}) {
  const tint = getAvatarTint(name);
  const initials = getInitials(name);
  const { openQuickView } = useUserQuickView();
  const resolvedAvatar = resolveUserAvatar({ userId, name, explicit: avatarUrl });

  const handleAvatarClick = userId
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        openQuickView(userId);
      }
    : undefined;

  const avatarCursor = userId ? "cursor-pointer" : "";

  const avatarEl = resolvedAvatar ? (
    <img
      src={resolvedAvatar}
      alt={name}
      className={`${comfort ? "w-9 h-9" : "w-7 h-7"} rounded-md object-cover shrink-0 ${avatarCursor} hover:ring-2 hover:ring-[#007FFF]/30 transition-shadow`}
      onClick={handleAvatarClick}
    />
  ) : (
    <div
      className={`${comfort ? "w-9 h-9 text-[11px]" : "w-7 h-7 text-[10px]"} rounded-md flex items-center justify-center shrink-0 ${avatarCursor} hover:ring-2 hover:ring-[#007FFF]/30 transition-shadow`}
      style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
      onClick={handleAvatarClick}
    >
      {initials}
    </div>
  );

  return (
    <div className={`flex items-center ${comfort ? "gap-3" : "gap-2.5"} min-w-0`}>
      <UserSummaryTooltip userName={name}>
        <span className="inline-flex shrink-0">{avatarEl}</span>
      </UserSummaryTooltip>
      <div className="min-w-0">
        {trailing ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <LinkedUserName
              userId={userId}
              className={`${comfort ? "text-[13.5px]" : "text-sm"} truncate min-w-0`}
              style={{ fontWeight: 500, color: "#1E293B" }}
            >
              {nameNode ?? name}
            </LinkedUserName>
            <span className="inline-flex items-center gap-1.5 shrink-0">{trailing}</span>
          </div>
        ) : (
          <LinkedUserName
            userId={userId}
            className={`${comfort ? "text-[13.5px]" : "text-sm"} truncate block min-w-0`}
            style={{ fontWeight: 500, color: "#1E293B" }}
          >
            {nameNode ?? name}
          </LinkedUserName>
        )}
        {comfort && (subtitle || subtitleNode) && (
          <span className="text-xs text-muted-foreground/60 truncate block min-w-0">
            {subtitleNode ?? subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── SmallAvatarCell: compact avatar + name (e.g. Invited By) ─── */
export function SmallAvatarCell({ name, nameNode, comfort = false, userId }: { name: string; nameNode?: ReactNode; comfort?: boolean; userId?: number }) {
  const tint = getAvatarTint(name);
  const initials = getInitials(name);
  const resolvedAvatar = resolveUserAvatar({ userId, name });
  const avatarEl = resolvedAvatar ? (
    <img
      src={resolvedAvatar}
      alt={name}
      className={`${comfort ? "w-8 h-8" : "w-6 h-6"} rounded-md object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${comfort ? "w-8 h-8 text-[11px]" : "w-6 h-6 text-[10px]"} rounded-md flex items-center justify-center shrink-0`}
      style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
    >
      {initials}
    </div>
  );
  return (
    <div className={`flex items-center ${comfort ? "gap-2.5" : "gap-2"} min-w-0`}>
      <UserSummaryTooltip userName={name}>
        <span className="inline-flex shrink-0">{avatarEl}</span>
      </UserSummaryTooltip>
      <LinkedUserName
        userId={userId}
        className={`${comfort ? "text-[13.5px]" : "text-sm"} truncate min-w-0 flex-1`}
        style={{ color: "#334155" }}
      >
        {nameNode ?? name}
      </LinkedUserName>
    </div>
  );
}

/* ─── System Status config & tooltips ─── */
export interface StatusConfig {
  bg: string;
  text: string;
  dot: string;
  border?: string;
  label?: string;
  tooltip?: string;
}

export const SYSTEM_STATUS_MAP: Record<string, StatusConfig> = {
  "Invite Sent": {
    bg: "#EFF6FF", text: "#1E40AF", dot: "#3B82F6", border: "#BFDBFE",
    tooltip: "An invitation has been sent to this user. The account will activate once they accept the link.",
  },
  Active: {
    bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0",
    tooltip: "This user has activated their account and can log in at any time.",
  },
  Inactive: {
    bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A", label: "Deactivated",
    tooltip: "This user's account has been temporarily deactivated. The record remains visible in the user listing.",
  },
  "Invite Expired": {
    bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A",
    tooltip: "This user's invitation link has expired. Resend an invitation to reactivate the process.",
  },
  Archived: {
    bg: "#FEF2F2", text: "#991B1B", dot: "#E87171", border: "#FECACA",
    tooltip: "This user's account has been archived and is no longer active in the system.",
  },
  "Pending Setup": {
    bg: "#F8FAFC", text: "#475569", dot: "#94A3B8", border: "#E2E8F0", label: "Draft",
    tooltip: "This user's profile has been created but no invitation has been sent yet.",
  },
};

/* ─── Status display vocabulary ───────────────────────────────────────────
 * The stored status value and the word shown to the user are not the same.
 * `Inactive` is the value the data layer has always used; the product calls
 * that state **Deactivated** everywhere it is written down: the row-action
 * verb, the status dropdown, the quick filters, and the import guide. Same
 * for `Pending Setup`, which the product calls **Draft**.
 *
 * Anything that renders a status as text goes through here so the two cannot
 * drift apart again. Anything that COMPARES or STORES a status keeps using
 * the raw value. Role statuses share the map: `Inactive` maps the same way
 * and `Draft` (roles only) is absent from it, so it passes through unchanged.
 */
export function statusDisplayLabel(status: string): string {
  return SYSTEM_STATUS_MAP[status]?.label ?? status;
}

/* ─── StatusBadge: colored dot + label + border + tooltip ─── */
export function StatusBadge({
  status,
  configMap,
  displayLabel,
  comfort = false,
}: {
  status: string;
  configMap?: Record<string, StatusConfig>;
  displayLabel?: string;
  comfort?: boolean;
}) {
  const map = configMap || SYSTEM_STATUS_MAP;
  const c = map[status] ?? { bg: "#F1F5F9", text: "#334155", dot: "#64748B", border: "#CBD5E1" };
  const tooltipText = c.tooltip;

  const badge = (
    <span
      className={`inline-flex items-center ${comfort ? "px-2.5 py-1" : "px-2.5 py-0.5"} rounded-full text-xs border`}
      style={{
        backgroundColor: c.bg,
        color: c.text,
        borderColor: c.border || c.bg,
        fontWeight: 500,
      }}
    >
      {displayLabel ?? c.label ?? status}
    </span>
  );

  if (tooltipText && !configMap) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-[260px] text-[12px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

/* ─── SystemStatusColumnHeader: "System Status" + info icon ─── */
export function SystemStatusColumnHeader() {
  return (
    <div className="flex items-center gap-1">
      <span>System Status</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">
            <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-[260px] text-[12px]">
          Reflects the current state of this user's account in the system.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ─── LicenseBadge ─── */
export function LicenseBadge({
  license,
  comfort = false,
  prefix,
  showNoLicense = false,
}: {
  license: string;
  comfort?: boolean;
  /** Optional copy prefixed before the license name (e.g. "Requires "). */
  prefix?: string;
  /** Render a "No License" chip instead of hiding it (default: hidden). */
  showNoLicense?: boolean;
}) {
  // Hide chip entirely when user has no license (e.g. archived users),
  // unless the caller explicitly wants the No License chip shown.
  if (license === "No License" && !showNoLicense) return null;
  const size = comfort ? "px-2.5 py-1" : "px-2 py-0.5";
  const configs: Record<string, { bg: string; color: string; border: string }> = {
    "Full Access": { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
    "Field User": { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
    "No License": { bg: "#F8FAFC", color: "#94A3B8", border: "#E2E8F0" },
  };
  const c = configs[license] || configs["Field User"];
  return (
    <span
      className={`inline-flex items-center ${size} rounded text-xs border`}
      style={{
        backgroundColor: c.bg,
        color: c.color,
        borderColor: c.border,
        fontWeight: 500,
      }}
    >
      {prefix}{license}
    </span>
  );
}


/* ─── RolesCell: first role + "+N more" with popover or navigation ─── */
export function RolesCell({
  roles,
  firstRoleNode,
  comfort = false,
  searchQuery,
  userId,
  licenseAlertNames,
  licenseAlertTooltip,
  licenseAlertHover,
}: {
  roles: string[];
  firstRoleNode?: ReactNode;
  comfort?: boolean;
  searchQuery?: string;
  userId?: number | string;
  /** Lower-cased role names that are inaccessible due to license mismatch. */
  licenseAlertNames?: Set<string>;
  /** Tooltip text shown when hovering the amber alert icon. */
  licenseAlertTooltip?: string;
  /** When provided, the alert triangle defers to these shared-tooltip hover
   *  handlers instead of rendering its own per-cell tooltip. Used by the
   *  Role Detail Users tab to drive a single structured tooltip. */
  licenseAlertHover?: { onEnter: (el: HTMLElement) => void; onLeave: () => void };
}) {
  const navigate = useNavigate();
  const displayRole = roles[0];
  const moreCount = roles.length - 1;
  const overflowRoles = roles.slice(1);

  const firstRoleIsAlert = !!(displayRole && licenseAlertNames?.has(displayRole.toLowerCase()));
  const overflowAlertCount = overflowRoles.filter((r) =>
    licenseAlertNames?.has(r.toLowerCase()),
  ).length;
  const hasAnyAlert = firstRoleIsAlert || overflowAlertCount > 0;

  /* Check if search matches any hidden role */
  const hasOverflowMatch =
    searchQuery &&
    searchQuery.trim().length > 0 &&
    overflowRoles.some((r) =>
      r.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

  const overflowItems: OverflowItem[] = overflowRoles.map((r, i) => ({
    id: String(i),
    name: r,
    licenseAlert: licenseAlertNames?.has(r.toLowerCase()),
    licenseAlertTooltip,
  }));

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moreCount > 10 && userId) {
      navigate(`/company-settings/user-access-control/user/${userId}?tab=roles`);
    }
  };

  const moreLabel = (
    <span
      className={`shrink-0 leading-none cursor-pointer inline-flex items-center gap-0.5`}
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "#085FCC",
      }}
    >
      <span
        style={
          hasOverflowMatch
            ? { backgroundColor: "#FEF9C3", borderRadius: 2, padding: "1px 2px", color: "#92400E" }
            : undefined
        }
      >
        +{moreCount} more
      </span>
      {moreCount > 10 && (
        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/more:opacity-100 transition-opacity" />
      )}
    </span>
  );

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {hasAnyAlert && (licenseAlertHover || licenseAlertTooltip) && (
        licenseAlertHover ? (
          <span
            className="inline-flex items-center justify-center shrink-0 cursor-default"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => licenseAlertHover.onEnter(e.currentTarget)}
            onMouseLeave={() => licenseAlertHover.onLeave()}
            aria-label="License mismatch"
          >
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
          </span>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center justify-center shrink-0 cursor-default"
                onClick={(e) => e.stopPropagation()}
                aria-label="License mismatch"
              >
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[320px]">
              {licenseAlertTooltip}
            </TooltipContent>
          </Tooltip>
        )
      )}
      {(() => {
        const firstRoleId = displayRole
          ? allRoles.find((r) => r.roleName.toLowerCase() === displayRole.toLowerCase())?.id
          : undefined;
        return (
          <LinkedRoleName
            roleId={firstRoleId}
            className={`${comfort ? "text-[13.5px]" : "text-sm"} truncate ${moreCount > 0 ? "min-w-0" : "min-w-0 flex-1"}`}
            style={{ color: "#334155" }}
          >
            {firstRoleNode ?? displayRole}
          </LinkedRoleName>
        );
      })()}
      {moreCount > 0 && moreCount <= 10 && (
        <OverflowTooltip items={overflowItems} category="Roles" searchQuery={searchQuery}>
          {moreLabel}
        </OverflowTooltip>
      )}
      {moreCount > 10 && (
        <span className="group/more" onClick={handleMoreClick}>
          {moreLabel}
        </span>
      )}
    </div>
  );
}
