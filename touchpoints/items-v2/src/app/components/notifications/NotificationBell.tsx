import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "../../context/NotificationsContext";
import { NotificationsDropdown } from "./NotificationsDropdown";

/**
 * Top-bar bell + divider, ported from the Calendars header (calendar-omne:
 * src/app/components/Header.tsx). Sits just left of the user avatar.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={bellRef}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors relative cursor-pointer border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${
          open
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
      <span aria-hidden="true" className="w-[2px] h-6 rounded-full bg-[#E2E8F0] shrink-0" />

      {open && (
        <NotificationsDropdown
          anchorRef={bellRef}
          onClose={() => setOpen(false)}
          notifications={notifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onOpenManage={() => {
            setOpen(false);
            toast.info("Notification preferences coming soon");
          }}
        />
      )}
    </>
  );
}
