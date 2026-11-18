import { Bell, Search } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { segmentToLabel } from "../lib/segment-labels";
import { getModuleBySlug } from "./data-imports/moduleData";
import { type AppNotification, mockNotifications } from "./notificationsData";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ManageNotificationsModal } from "./ManageNotificationsModal";
import { AccessSwitcher } from "./AccessSwitcher";

interface BreadcrumbItem {
  label: string;
  path: string;
}

function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  let cumulativePath = "";
  const items: BreadcrumbItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    cumulativePath += "/" + seg;

    // Collapse `/user/:id` into a single "User Details" breadcrumb
    if (seg === "user" && i + 1 < segments.length) {
      cumulativePath += "/" + segments[i + 1];
      items.push({ label: "User Details", path: cumulativePath });
      break;
    }

    // Collapse `/role/:id` into a single "Role Details" breadcrumb
    if (seg === "role" && i + 1 < segments.length) {
      cumulativePath += "/" + segments[i + 1];
      items.push({ label: "Role Details", path: cumulativePath });
      break;
    }

    /* Under /data-imports the next segment is a module slug, so the label
     * comes from the module registry rather than the generic segment map —
     * that keeps the crumb identical to the module's own page header, tab
     * slugs included. The segment after that is an opaque import id. */
    if (i > 0 && segments[i - 1] === "data-imports") {
      const moduleDef = getModuleBySlug(seg);
      if (moduleDef) {
        items.push({ label: moduleDef.title, path: cumulativePath });
        if (i + 1 < segments.length) {
          cumulativePath += "/" + segments[i + 1];
          items.push({ label: "Import Details", path: cumulativePath });
        }
        break;
      }
    }

    items.push({ label: segmentToLabel(seg), path: cumulativePath });
  }

  return items;
}

export function Header() {
  const breadcrumbs = useBreadcrumbs();

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const bellRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white font-['Inter',sans-serif]">
      {/* 63px + the header's 1px bottom border = 64px total, so the divider
          lines up with the sidebar's h-[64px] logo area. */}
      <div className="h-[63px] w-full flex items-center justify-between px-6 lg:px-8">
        {/* Left: Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
          <div className="flex items-center gap-1.5 min-w-0">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={crumb.path} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && (
                    <span className="text-gray-300 text-sm">/</span>
                  )}
                  {isLast ? (
                    <span
                      className="text-sm truncate text-gray-900"
                      style={{ fontWeight: 500 }}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-sm truncate text-gray-500 hover:text-gray-700 transition-colors"
                      style={{ fontWeight: 400 }}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Center: Search */}
        <div className="relative w-[240px] shrink-0">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-[#007FFF]/10 outline-none transition-all"
            style={{ fontWeight: 400 }}
          />
        </div>

        {/* Right: Actions + User */}
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            ref={bellRef}
            onClick={() => setNotifOpen((prev) => !prev)}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors relative cursor-pointer border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${
              notifOpen
                ? "bg-slate-100 text-gray-700"
                : "bg-white text-muted-foreground hover:text-gray-700 hover:bg-gray-100"
            }`}
            aria-label={unreadCount > 0 ? "Notifications, unread" : "Notifications"}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center px-0.5">
                <span className="text-[9px] font-bold text-white leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </span>
            )}
          </button>
          {/* Subtle divider between the bell and the user avatar. */}
          <span
            aria-hidden="true"
            className="w-[2px] h-6 rounded-full bg-[#E2E8F0] shrink-0"
          />

          {/* Access switcher (prototype control) — the avatar lists the access
              personas; selecting one re-derives every capability boolean and
              every gated surface in the app re-renders. */}
          <AccessSwitcher />
        </div>
      </div>

      {/* Notifications Dropdown */}
      {notifOpen && (
        <NotificationsDropdown
          anchorRef={bellRef}
          onClose={() => setNotifOpen(false)}
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onOpenManage={() => {
            setNotifOpen(false);
            setManageModalOpen(true);
          }}
        />
      )}

      {/* Manage Notifications Modal */}
      <ManageNotificationsModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
      />
    </header>
  );
}