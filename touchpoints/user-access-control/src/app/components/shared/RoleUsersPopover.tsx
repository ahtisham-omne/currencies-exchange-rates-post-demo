import { useState, useRef, useCallback, useEffect, type Ref } from "react";
import { createPortal } from "react-dom";
import { Users as UsersIcon } from "lucide-react";
import { users as allUsers } from "../../data/users-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getInitials, getAvatarTint } from "../../lib/avatar";
import { getRoleDetail } from "../../data/role-detail-data";
import { popoverVisibleRows, popoverListMaxHeight } from "../../lib/popover-sizing";

const MAX_DISPLAY = 10;

interface RoleUsersPopoverProps {
  roleId: number;
  usersCount: number;
  /** Density for text size */
  comfort?: boolean;
  /** Trigger presentation: "count" (icon + count) or "more" (a "+N more" pill). */
  variant?: "count" | "more";
  /** Number shown in the "+N more" pill (variant="more"). */
  moreCount?: number;
}

export function RoleUsersPopover({ roleId, usersCount, comfort = false, variant = "count", moreCount = 0 }: RoleUsersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  // Get assigned user data
  const detail = getRoleDetail(roleId);
  const assignedUserIds = detail?.assignedUserIds ?? [];
  const assignedUsers = assignedUserIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter(Boolean) as typeof allUsers;

  const displayUsers = assignedUsers.slice(0, MAX_DISPLAY);
  const hasMore = assignedUsers.length > MAX_DISPLAY;
  /* Rows are 28px avatars in py-1.5, so 40px each. */
  const listMaxH = popoverListMaxHeight(displayUsers.length, 40);

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const tipW = 260;
    const rowH = 40;
    const headerH = 44;
    const footerH = hasMore ? 40 : 0;
    const estH =
      Math.min(displayUsers.length, popoverVisibleRows()) * rowH + headerH + footerH;
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
  }, [displayUsers.length, hasMore]);

  const enter = useCallback(() => {
    if (usersCount === 0) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => { position(); setOpen(true); }, 200);
  }, [position, usersCount]);

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

  const isInteractive = usersCount > 0;

  return (
    <>
      {variant === "more" ? (
        <span
          ref={triggerRef as Ref<HTMLSpanElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
          className={`inline-flex items-center shrink-0 ${comfort ? "text-[12.5px]" : "text-[12px]"} ${isInteractive ? "cursor-pointer" : ""}`}
          style={{ fontWeight: 500, color: "#64748B" }}
        >
          +{moreCount} more
        </span>
      ) : (
        <div
          ref={triggerRef as Ref<HTMLDivElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          className={`flex items-center gap-1.5 ${isInteractive ? "cursor-pointer" : ""}`}
          onClick={(e) => { if (isInteractive) e.stopPropagation(); }}
        >
          <UsersIcon className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          <span
            className={comfort ? "text-[13.5px]" : "text-sm"}
            style={{
              fontWeight: 400,
              color: isInteractive ? "#475569" : "#94A3B8",
            }}
          >
            {usersCount}
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
                Users
              </span>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                {assignedUsers.length}
              </span>
            </div>

            {/* User list */}
            <div
              className={`px-1.5 pb-1.5 ${listMaxH ? "overflow-y-auto scrollbar-hide" : ""}`}
              style={{ maxHeight: listMaxH }}
            >
              {displayUsers.map((user) => {
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
                      className="text-[12px] truncate linked-entity-text"
                      style={{ fontWeight: 500, color: "#1E293B" }}
                    >
                      {user.fullName}
                    </span>
                  </a>
                );
              })}
            </div>


            {/* View all link */}
            {hasMore && (
              <div className="px-3 py-2 border-t border-[#EEF2F6]"
                style={{ backgroundColor: "#F8FAFC" }}>
                <a
                  href={`/company-settings/user-access-control/role/${roleId}?tab=users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] cursor-pointer transition-colors no-underline hover:underline"
                  style={{ fontWeight: 600, color: "#0A77FF" }}
                >
                  View All in Role Detail →
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
