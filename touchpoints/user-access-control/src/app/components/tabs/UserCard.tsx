import { useState } from "react";
import { Shield, Mail, Phone } from "lucide-react";
import type { UserRow } from "../../data/users-data";
import { RolesCell } from "../table-cells";
import { StatusDropdownCell, LicenseDropdownCell } from "../../data/users-table-config";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { useUserQuickView } from "../shared/UserQuickViewPanel";
import { getLicenseInaccessibleRoles, toTitleCase } from "../../lib/role-license";
import type { CardSize } from "../data-table/types";
import { isAccountOwner } from "../../data/account-owner";
import { ProtectedUserBadge } from "../shared/SystemRoleBadge";

/** Per-size scale for the card. The hero banner and the initials fallback are
 *  pixel-sized, so they need explicit values rather than a padding class. */
const SIZE_SCALE: Record<CardSize, {
  hero: number;
  initials: number;
  body: string;
  name: number;
  nameLine: string;
  infoText: string;
  infoGap: string;
  icon: string;
}> = {
  large:  { hero: 200, initials: 52, body: "px-4 pt-3.5 pb-4 gap-3",       name: 16, nameLine: "22px", infoText: "text-sm", infoGap: "gap-2",   icon: "w-4 h-4" },
  medium: { hero: 160, initials: 44, body: "px-3.5 pt-3 pb-3.5 gap-2.5",   name: 15, nameLine: "20px", infoText: "text-sm", infoGap: "gap-1.5", icon: "w-3.5 h-3.5" },
  small:  { hero: 116, initials: 32, body: "px-2.5 pt-2 pb-2.5 gap-1.5",   name: 13, nameLine: "18px", infoText: "text-xs", infoGap: "gap-1",   icon: "w-3 h-3" },
};

interface UserCardProps {
  row: UserRow;
  onRowClick?: (row: UserRow) => void;
  renderActions?: (row: UserRow) => React.ReactNode;
  /** True while a bulk selection is active, dims the status chip for protected users. */
  bulkActive?: boolean;
  /** Card-view size from the density dropdown. Defaults to "medium". */
  size?: CardSize;
}

export function UserCard({ row, onRowClick, renderActions, bulkActive = false, size = "medium" }: UserCardProps) {
  const scale = SIZE_SCALE[size];
  const [hovered, setHovered] = useState(false);
  const tint = getAvatarTint(row.fullName);
  const initials = getInitials(row.fullName);
  const avatarUrl = USER_AVATAR_MAP[row.id];
  const { openQuickView } = useUserQuickView();

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openQuickView(row.id);
  };

  const inaccessible = getLicenseInaccessibleRoles(row.license, row.assignedRoles);
  const alertNames = new Set(inaccessible.map((r) => r.toLowerCase()));
  const firstName = row.fullName.split(" ")[0] || row.fullName;
  const tooltip =
    row.license === "No License"
      ? `${firstName} currently has no license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} will not take effect until a license is assigned.`
      : `${firstName} currently has a Field User license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} require${inaccessible.length === 1 ? "s" : ""} a Full Access license. The permissions in ${inaccessible.length === 1 ? "this role" : "these roles"} will not take effect until the license is upgraded.`;
  const titleCasedRoles = row.assignedRoles.map(toTitleCase);

  return (
    <div
      className="group/card bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 h-full flex flex-col"
      style={{
        boxShadow: hovered
          ? "0 4px 16px -4px rgba(10,119,255,0.10), 0 1px 3px -1px rgba(0,0,0,0.04)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        borderColor: hovered ? "rgba(147,184,247,0.5)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onRowClick?.(row)}
    >
      {/* Hero photo banner */}
      <div
        className="relative w-full overflow-hidden cursor-pointer"
        style={{ height: scale.hero, backgroundColor: avatarUrl ? "#F1F5F9" : tint.bg }}
        onClick={handleImageClick}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={row.fullName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
            loading="lazy"
            width={512}
            height={512}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="select-none"
              style={{ fontSize: scale.initials, fontWeight: 700, color: tint.fg }}
            >
              {initials}
            </span>
          </div>
        )}

        {/* Bottom-left overlay: Status + License interactive dropdowns */}
        <div
          className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusDropdownCell row={row} bulkActive={bulkActive} />
          <LicenseDropdownCell row={row} />
        </div>

        {/* Top-right: 3-dot menu on hover */}
        {renderActions && (
          <div className="absolute top-2.5 right-2.5">
            <div
              className="rounded-lg bg-white/80 backdrop-blur-sm shadow-sm border border-border/50 transition-all"
              style={{ opacity: hovered ? 1 : 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {renderActions(row)}
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className={`flex flex-col flex-1 ${scale.body}`}>
        {/* Name, with the protected shield on an Account Owner, as in the
            table view (ERP-5171 AC16). */}
        <div className="flex items-center gap-1.5 min-w-0">
          <p
            className="text-foreground truncate"
            style={{ fontSize: scale.name, fontWeight: 600, lineHeight: scale.nameLine }}
          >
            {row.fullName}
          </p>
          {isAccountOwner(row.id) && <ProtectedUserBadge />}
        </div>

        {/* Info rows, email / phone / roles. Match table cell styles: text-sm, muted-foreground. */}
        <div className={`flex flex-col ${scale.infoGap}`}>
          {/* Email */}
          <div className="flex items-center gap-2 min-w-0">
            <Mail className={`${scale.icon} shrink-0`} style={{ color: "#94A3B8" }} />
            <span className={`${scale.infoText} text-muted-foreground truncate min-w-0`}>
              {row.email}
            </span>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2 min-w-0">
            <Phone className={`${scale.icon} shrink-0`} style={{ color: "#94A3B8" }} />
            <span className={`${scale.infoText} text-muted-foreground truncate min-w-0`}>
              {row.phone}
            </span>
          </div>

          {/* Roles */}
          <div className="flex items-center gap-2 min-w-0">
            <Shield className={`${scale.icon} shrink-0`} style={{ color: "#94A3B8" }} />
            <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
              <RolesCell
                roles={titleCasedRoles}
                userId={row.id}
                licenseAlertNames={alertNames}
                licenseAlertTooltip={inaccessible.length > 0 ? tooltip : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
