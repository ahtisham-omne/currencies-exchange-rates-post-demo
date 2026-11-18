import { useState, useRef, useCallback, useEffect, type Ref } from "react";
import { createPortal } from "react-dom";
import { Users as UsersIcon, Shield } from "lucide-react";
import { users as allUsers } from "../../data/users-data";
import { roles as allRoles } from "../../data/roles-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getInitials, getAvatarTint } from "../../lib/avatar";

import { popoverVisibleRows, popoverListMaxHeight } from "../../lib/popover-sizing";

const MAX_DISPLAY = 8;

export type AssignmentPopoverType = "roles" | "users";

interface ModuleAssignmentPopoverProps {
  type: AssignmentPopoverType;
  /** Total count to display alongside the icon */
  count: number;
  /** Role or user IDs to render in the popover list (capped at MAX_DISPLAY) */
  ids: number[];
  /** Called when user clicks "View all in permission detail →", opens the
   * permission detail modal at the appropriate tab */
  onViewAll?: () => void;
  /** Density-aware text size */
  comfort?: boolean;
  /** Trigger presentation: "inline" (icon + count), "chip" (slate chip
   *  reading "N roles" / "N users"), or "more" (a "+N more" pill). Defaults to "inline". */
  variant?: "inline" | "chip" | "more";
  /** Number shown in the "+N more" pill (variant="more"). */
  moreCount?: number;
}

/**
 * Generic hover popover used by the UAC Main → Permissions catalog view to
 * show the list of roles or users assigned to a permission module.
 *
 * Mirrors the visual + interaction pattern of `RoleUsersPopover` (the
 * Roles listing → Users popover) so the two feel identical in motion,
 * timing and structure.
 */
export function ModuleAssignmentPopover({
  type,
  count,
  ids,
  onViewAll,
  comfort = false,
  variant = "inline",
  moreCount = 0,
}: ModuleAssignmentPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  const isRoles = type === "roles";
  const headerLabel = isRoles ? "Roles" : "Users";

  // Resolve items
  const items = isRoles
    ? ids.map((id) => allRoles.find((r) => r.id === id)).filter(Boolean) as typeof allRoles
    : (ids.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean) as typeof allUsers);

  const displayItems = items.slice(0, MAX_DISPLAY);
  const hasMore = count > MAX_DISPLAY;
  /* Rows are 28px avatars in py-1.5, so 40px each. */
  const listMaxH = popoverListMaxHeight(displayItems.length, 40);

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const tipW = 260;
    const rowH = 40;
    const headerH = 44;
    const footerH = hasMore ? 40 : 0;
    const estH =
      Math.min(displayItems.length, popoverVisibleRows()) * rowH + headerH + footerH;
    const vH = window.innerHeight;
    const vW = window.innerWidth;

    let place: "bottom" | "top" = "bottom";
    let top: number;
    if (r.bottom + estH + 8 > vH && r.top - estH - 8 > 0) {
      place = "top";
      top = r.top - estH - 6;
    } else {
      top = r.bottom + 6;
    }
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, vW - tipW - 8));

    setCoords({ top, left });
    setPlacement(place);
  }, [displayItems.length, hasMore]);

  const enter = useCallback(() => {
    if (count === 0) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => { position(); setOpen(true); }, 200);
  }, [position, count]);

  const leave = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  const tipEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const tipLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  useEffect(() => {
    if (!open) return;
    const r = () => position();
    window.addEventListener("scroll", r, true);
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("scroll", r, true); window.removeEventListener("resize", r); };
  }, [open, position]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const isInteractive = count > 0;

  const TriggerIcon = isRoles ? Shield : UsersIcon;
  const noun = isRoles ? (count === 1 ? "role" : "roles") : count === 1 ? "user" : "users";

  return (
    <>
      {variant === "more" ? (
        <span
          ref={triggerRef as Ref<HTMLSpanElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
          className={`inline-flex items-center shrink-0 leading-none text-[11px] ${isInteractive ? "cursor-pointer" : ""}`}
          style={{ fontWeight: 600, color: "#085FCC" }}
        >
          +{moreCount} more
        </span>
      ) : variant === "chip" ? (
        <span
          ref={triggerRef as Ref<HTMLSpanElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${isInteractive ? "cursor-pointer" : ""}`}
          style={{
            fontWeight: 500,
            backgroundColor: "#F1F5F9",
            color: "#475569",
            borderColor: "#CBD5E1",
          }}
        >
          {count} {noun}
        </span>
      ) : (
        <div
          ref={triggerRef as Ref<HTMLDivElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          className={`flex items-center gap-1.5 ${isInteractive ? "cursor-pointer" : ""}`}
          onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
        >
          <TriggerIcon className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          <span
            className={comfort ? "text-[13.5px]" : "text-sm"}
            style={{
              fontWeight: 500,
              color: isInteractive ? "#334155" : "#94A3B8",
            }}
          >
            {count}
          </span>
        </div>
      )}

      {open && createPortal(
        <div
          onMouseEnter={tipEnter}
          onMouseLeave={tipLeave}
          className="fixed z-[300]"
          style={{
            top: coords.top,
            left: coords.left,
            width: 260,
            animation: "overflowTooltipIn 120ms ease-out forwards",
          }}
        >
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={placement === "bottom" ? { top: -4 } : { bottom: -4 }}
          >
            <div
              className="w-2 h-2 rotate-45 bg-white border-border/50"
              style={
                placement === "bottom"
                  ? { borderTopWidth: 1, borderLeftWidth: 1 }
                  : { borderBottomWidth: 1, borderRightWidth: 1 }
              }
            />
          </div>

          <div
            className="bg-white rounded-[8px] border border-border/50 overflow-hidden"
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}
          >
            {/* Header */}
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span
                className="text-[11px] tracking-wide uppercase text-muted-foreground/70"
                style={{ fontWeight: 600 }}
              >
                {headerLabel}
              </span>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                {count}
              </span>
            </div>

            {/* List */}
            <div
              className={`px-1.5 pb-1.5 ${listMaxH ? "overflow-y-auto scrollbar-hide" : ""}`}
              style={{ maxHeight: listMaxH }}
            >
              {isRoles
                ? (displayItems as typeof allRoles).map((role) => {
                    const tint = getAvatarTint(role.roleName);
                    return (
                      <a
                        key={role.id}
                        href={`/company-settings/user-access-control/role/${role.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left no-underline"
                        style={{ backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EDF4FF")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: tint.bg }}
                        >
                          <Shield className="w-3.5 h-3.5" style={{ color: tint.fg }} />
                        </div>
                        <span
                          className="text-[12px] truncate"
                          style={{ fontWeight: 500, color: "#1E293B" }}
                        >
                          {role.roleName}
                        </span>
                      </a>
                    );
                  })
                : (displayItems as typeof allUsers).map((user) => {
                    const avatarUrl = USER_AVATAR_MAP[user.id];
                    const initials = getInitials(user.fullName);
                    const tint = getAvatarTint(user.fullName);
                    return (
                      <a
                        key={user.id}
                        href={`/company-settings/user-access-control/user/${user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left no-underline"
                        style={{ backgroundColor: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EDF4FF")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={user.fullName}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                            style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                          >
                            {initials}
                          </div>
                        )}
                        <span
                          className="text-[12px] truncate"
                          style={{ fontWeight: 500, color: "#1E293B" }}
                        >
                          {user.fullName}
                        </span>
                      </a>
                    );
                  })}
            </div>

            {/* View all link */}
            {hasMore && onViewAll && (
              <div className="px-3 py-2 border-t border-[#EEF2F6]"
                style={{ backgroundColor: "#F8FAFC" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onViewAll();
                  }}
                  className="text-[11px] cursor-pointer transition-colors"
                  style={{ fontWeight: 600, color: "#007FFF" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#005FCC")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#007FFF")}
                >
                  View All in Permission Detail →
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
