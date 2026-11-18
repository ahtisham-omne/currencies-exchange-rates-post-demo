import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Phone, CreditCard } from "lucide-react";
import { users } from "../../data/users-data";
import { getUserDetail } from "../../data/user-detail-data";
import { getAvatarTint, getInitials, resolveUserAvatar } from "../../lib/avatar";
import { formatFullPhone } from "../../lib/phone-format";
import { CURRENT_USER, isMe } from "../../data/current-user";

/* ─────────────────────────────────────────────────────────────
 * UserSummaryTooltip
 * ─────────────────────────────────────────────────────────────
 * Standardized hover popover used across the system whenever a
 * user's name or avatar is shown. Visual design mirrors the
 * Partner Management module's PersonHoverCard for consistency:
 *   • Dark slate gradient header with circular avatar + decorative bubble
 *   • Name (white) + email (slate-400)
 *   • White body listing phone · license
 *
 * When `clickToNavigate` is true, the trigger acts as a clickable
 * affordance that routes to the user's detail page on click while
 * still showing the hover popover.
 * ──────────────────────────────────────────────────────────── */

interface UserSummaryTooltipProps {
  userName: string;
  children: ReactNode;
  /** When true, click on the trigger navigates to the user's detail page. */
  clickToNavigate?: boolean;
}


const TIP_W = 304;

function getPlacement(rect: DOMRect) {
  const estH = 148;
  const vH = window.innerHeight;
  const vW = window.innerWidth;

  let place: "bottom" | "top" = "bottom";
  let top: number;
  if (rect.bottom + estH + 8 > vH && rect.top - estH - 8 > 0) {
    place = "top";
    top = rect.top - estH - 8;
  } else {
    top = rect.bottom + 8;
  }
  let left = rect.left + rect.width / 2 - TIP_W / 2;
  left = Math.max(8, Math.min(left, vW - TIP_W - 8));

  return { top, left, place };
}

export function UserSummaryTooltip({ userName, children, clickToNavigate = false }: UserSummaryTooltipProps) {
  const user = users.find((u) => u.fullName === userName);
  const detail = user ? getUserDetail(user.id) : null;

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const { top, left } = getPlacement(r);
    setCoords({ top, left });
  }, []);

  const enter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      position();
      setOpen(true);
    }, 300);
  }, [position]);

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
    return () => {
      window.removeEventListener("scroll", r, true);
      window.removeEventListener("resize", r);
    };
  }, [open, position]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  /* The logged-in user is not a row in `users-data`, so the directory lookup
   * above finds nothing for them and the card used to be skipped entirely,
   * the one person an admin sees most often across these lists. Fall back to
   * the CURRENT_USER profile for that case. */
  const viewingSelf = isMe(userName);
  if ((!user || !detail) && !viewingSelf) return <>{children}</>;

  const displayName = user?.fullName ?? CURRENT_USER.name;
  const tint = getAvatarTint(displayName);
  const initials = getInitials(displayName);
  const photo = resolveUserAvatar({ userId: user?.id, name: displayName });
  /* Email is the header subtitle, so it sits directly under the name and is
   * not repeated as a row in the body below. */
  const email = user?.email ?? CURRENT_USER.email;
  const phoneEntry = detail?.phones?.[0];
  const phone = phoneEntry
    ? formatFullPhone(phoneEntry.countryCode, phoneEntry.number)
    : user
      ? ""
      : CURRENT_USER.phone;
  /* UserDetail extends UserRow, so this is the same license the listing column
   * and the detail page show. */
  const license = user?.license ?? CURRENT_USER.license;

  /* No detail page exists for the logged-in user, so their card never links. */
  const detailHref = user ? `/company-settings/user-access-control/user/${user.id}` : null;

  return (
    <>
      {clickToNavigate && detailHref ? (
        <a
          ref={triggerRef as React.RefObject<HTMLAnchorElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex linked-entity"
        >
          {children}
        </a>
      ) : (
        <span
          ref={triggerRef as React.RefObject<HTMLSpanElement>}
          onMouseEnter={enter}
          onMouseLeave={leave}
          className="inline-flex"
        >
          {children}
        </span>
      )}

      {open &&
        createPortal(
          <div
            onMouseEnter={tipEnter}
            onMouseLeave={tipLeave}
            className="fixed z-[300]"
            style={{
              top: coords.top,
              left: coords.left,
              width: TIP_W,
              animation: "overflowTooltipIn 120ms ease-out forwards",
            }}
          >
            <div
              className="rounded-xl overflow-hidden bg-white"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
            >
              {/* Dark gradient header */}
              <div
                className="relative overflow-hidden px-4 py-3"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(215 28% 22%) 0%, hsl(215 25% 30%) 100%)",
                }}
              >
                {/* Decorative bubble */}
                <div
                  className="absolute -top-4 -right-4 w-20 h-20 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                />
                <div className="flex items-center gap-3 relative">
                  <div
                    className="w-11 h-11 rounded-full overflow-hidden border-2 shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: tint.bg,
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span
                        className="text-[12px]"
                        style={{ color: tint.fg, fontWeight: 600 }}
                      >
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className="text-[14px] text-white truncate min-w-0"
                        style={{ fontWeight: 600 }}
                      >
                        {displayName}
                      </p>
                      {/* Translucent white, so it reads as part of the dark
                          header rather than a badge stuck on top of it. */}
                      {viewingSelf && (
                        <span
                          className="shrink-0 inline-flex items-center px-1.5 py-px rounded text-[10.5px] text-white"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.16)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            fontWeight: 500,
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: "#94A3B8" }}>
                      {email}
                    </p>
                  </div>
                </div>
              </div>

              {/* White body */}
              <div className="bg-white px-4 py-3 space-y-2">
                {phone && (
                  <div className="flex items-center gap-2.5 text-[12px]" style={{ color: "#334155" }}>
                    <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="truncate">{phone}</span>
                  </div>
                )}
                {/* License reads as plain text in the same row treatment as
                    phone, not as a coloured badge: this card is a
                    summary, and a badge here would out-shout the rest. */}
                {license && (
                  <div className="flex items-center gap-2.5 text-[12px]" style={{ color: "#334155" }}>
                    <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="truncate">{license}</span>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
