import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  Shield,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Calendar,
  UserCheck,
} from "lucide-react";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { users } from "../../data/users-data";
import type { UserRow } from "../../data/users-data";
import { StatusBadge, LicenseBadge } from "../table-cells";
import { LinkedUserName } from "./LinkedUserName";
import { toTitleCase } from "../../lib/role-license";

/* ─────────── Context for global access ─────────── */

interface UserQuickViewContextValue {
  openQuickView: (userId: number) => void;
  closeQuickView: () => void;
}

const UserQuickViewContext = createContext<UserQuickViewContextValue>({
  openQuickView: () => {},
  closeQuickView: () => {},
});

export function useUserQuickView() {
  return useContext(UserQuickViewContext);
}

export function UserQuickViewProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  const openQuickView = useCallback((id: number) => setUserId(id), []);
  const closeQuickView = useCallback(() => setUserId(null), []);

  return (
    <UserQuickViewContext.Provider value={{ openQuickView, closeQuickView }}>
      {children}
      {userId !== null && (
        <UserQuickViewPanel userId={userId} onClose={closeQuickView} />
      )}
    </UserQuickViewContext.Provider>
  );
}

/* ─────────── Lightbox for zooming ─────────── */

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.5, s - 0.25)); }}
          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(3, s + 0.25)); }}
          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <img
        src={src}
        alt={name}
        className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

/* ─────────── Mock stat generator ─────────── */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getUserStats(user: UserRow) {
  const h = hashStr(user.fullName);
  return {
    permissions: (h % 40) + 8,
  };
}

/* ─────────── Panel Content ─────────── */

function UserQuickViewContent({ user }: { user: UserRow }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const avatarUrl = USER_AVATAR_MAP[user.id];
  const tint = getAvatarTint(user.fullName);
  const initials = getInitials(user.fullName);
  const stats = getUserStats(user);
  const inviterId = users.find((u) => u.fullName === user.invitedBy)?.id ?? null;

  return (
    <>
      {/* Hero area */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{
          height: "clamp(200px, 45vh, 420px)",
          background: avatarUrl
            ? "#1E1B4B"
            : `linear-gradient(135deg, ${tint.bg} 0%, ${tint.bg} 55%, #1E293B 100%)`,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-[40px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] border-2 border-white/30"
              style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700, letterSpacing: 1 }}
            >
              {initials}
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Zoom button, top-right, only when photo */}
        {avatarUrl && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
            className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}

        {/* Name + email overlay. Email is the identifier people actually
            match on, so it sits under the name and is not repeated below;
            the roles this user holds are listed in the detail rows. */}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>{user.fullName}</p>
          <div className="text-[11.5px] text-white/80 mt-0.5 truncate" style={{ fontWeight: 500 }}>
            {user.email}
          </div>
        </div>
      </div>

      {/* Data area */}
      <div className="px-5 pt-4 pb-4">
        {/* Stat row. Label sits above its value so the four read as a single
            left-aligned scan column; License and Status reuse the listing
            table's own chips, so a licence or status reads identically in
            the list and in this panel. */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
            <div className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Roles</div>
            <div className="flex items-center h-[22px] mt-0.5 text-[15px] text-[#0F172A]" style={{ fontWeight: 700 }}>
              {user.assignedRoles.length}
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
            <div className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Permissions</div>
            <div className="flex items-center h-[22px] mt-0.5 text-[15px] text-[#0F172A]" style={{ fontWeight: 700 }}>
              {stats.permissions}
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
            <div className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>License</div>
            <div className="flex items-center h-[22px] mt-0.5">
              <LicenseBadge license={user.license} showNoLicense />
            </div>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left">
            <div className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Status</div>
            <div className="flex items-center h-[22px] mt-0.5">
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="mt-3 space-y-1">
          {/* Roles. One role plus an overflow count, title-cased through the
              same helper the listing's Assigned Roles column uses, so a role
              name is spelled identically in both places. */}
          <div className="flex items-center gap-2.5 py-1">
            <Shield className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span className="text-[13px] text-foreground min-w-0 truncate" style={{ fontWeight: 500 }}>
              {toTitleCase(user.assignedRoles[0] ?? "No roles assigned")}
            </span>
            {user.assignedRoles.length > 1 && (
              <span className="text-[11px] shrink-0" style={{ fontWeight: 600, color: "#085FCC" }}>
                +{user.assignedRoles.length - 1} more
              </span>
            )}
          </div>

          {/* Invited by + on. The inviter is a link when they are a user in
              the directory, blue with a hover underline so the affordance is
              visible before hover; LinkedUserName opens the detail page in a
              new tab and falls back to plain text for an inviter with no
              record (the logged-in account). The date carries the same
              treatment as the surrounding sentence. */}
          <div className="flex items-center gap-2.5 py-1">
            <UserCheck className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span className="text-[13px] text-[#334155]">
              Invited by{" "}
              <LinkedUserName userId={inviterId} style={{ fontWeight: 500, color: inviterId != null ? "#0A77FF" : undefined }}>
                {user.invitedBy}
              </LinkedUserName>{" "}
              on {user.invitedOn}
            </span>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && avatarUrl && (
        <ImageLightbox src={avatarUrl} name={user.fullName} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

/* ─────────── Main Panel ─────────── */

function UserQuickViewPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const navUrl = `/company-settings/user-access-control/user/${user.id}`;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50"
        style={{ animation: "fadeIn 150ms ease-out forwards" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
          animation: "quickViewIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-[#E2E8F0]"
        >
          <X className="w-4 h-4 text-[#334155]" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <UserQuickViewContent user={user} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { navigate(navUrl); onClose(); }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
          >
            Go to User Details
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
