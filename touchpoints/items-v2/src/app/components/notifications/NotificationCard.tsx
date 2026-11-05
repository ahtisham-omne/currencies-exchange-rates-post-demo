import { Settings, Lock, Clock, User } from "lucide-react";
import {
  type AppNotification,
  getModuleBadgeColor,
  formatRelativeTime,
} from "./notificationsData";

interface NotificationCardProps {
  notification: AppNotification;
  isExpanded?: boolean;
  onClickCard?: (n: AppNotification) => void;
}

export function NotificationCard({
  notification,
  isExpanded = false,
  onClickCard,
}: NotificationCardProps) {
  const isUnread = !notification.isRead;
  const badge = getModuleBadgeColor(notification.module, isUnread);

  const content = (
    <>
      {/* Top row: module badge + New indicator */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {notification.module}
          </span>
          {notification.isMandatory && (
            <Lock className="w-3 h-3 text-gray-400" />
          )}
        </div>
        {isUnread && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#16A34A" }} />
            <span className="text-[10px] font-semibold" style={{ color: "#16A34A" }}>New</span>
          </div>
        )}
      </div>

      {/* Title */}
      <p
        className="text-[13px] text-gray-900 leading-snug mb-0.5"
        style={{ fontWeight: isUnread ? 600 : 400 }}
      >
        {notification.title}
      </p>

      {/* Context line */}
      <p className={`text-[11px] text-gray-500 leading-relaxed ${isExpanded ? '' : 'truncate'}`}>
        {notification.contextLine}
      </p>

      {/* Footer: user + time */}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-400">
        {notification.triggeredBy.isSystem ? (
          <Settings className="w-3 h-3 text-gray-400" />
        ) : (
          <User className="w-3 h-3 text-gray-400" />
        )}
        <span>{notification.triggeredBy.name}</span>
        <span className="mx-0.5">•</span>
        <Clock className="w-3 h-3 text-gray-400" />
        <span>{formatRelativeTime(notification.timestamp)}</span>
      </div>
    </>
  );

  const className = `w-full text-left px-3.5 py-3 transition-colors duration-150 rounded-lg border ${
    isUnread
      ? "border-[#D1FAE5] hover:border-[#A7F3D0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      : "bg-white border-gray-100 hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
  }${onClickCard ? " cursor-pointer" : ""}`;

  const style = isUnread
    ? { background: "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)" }
    : undefined;

  if (onClickCard) {
    return (
      <button
        onClick={() => onClickCard(notification)}
        className={className}
        style={style}
        role="listitem"
        tabIndex={0}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={style} role="listitem">
      {content}
    </div>
  );
}
