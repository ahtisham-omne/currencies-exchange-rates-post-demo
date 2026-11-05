import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Inbox, X, Maximize2, Minimize2, CheckCheck, Settings } from "lucide-react";
import { toast } from "sonner";
import { type AppNotification } from "./notificationsData";
import { NotificationCard } from "./NotificationCard";
type FilterTab = "all" | "unread";
type PanelMode = "compact" | "expanded";

interface NotificationsDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenManage?: () => void;
}



/* ── Empty State ── */
function EmptyState({ tab }: { tab: FilterTab }) {
  const config = {
    all: {
      icon: <Inbox className="w-8 h-8 text-gray-300" />,
      title: "No notifications yet",
      subtitle: "Notifications from your ERP modules will appear here as they happen.",
    },
    unread: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-400" />,
      title: "No unread notifications",
      subtitle: "You're all caught up!",
    },
  }[tab];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm border border-gray-100">
        {config.icon}
      </div>
      <p className="text-sm text-gray-700 font-medium mb-1">{config.title}</p>
      <p className="text-xs text-gray-400 leading-relaxed max-w-[240px]">{config.subtitle}</p>
    </div>
  );
}

/* ── Main Dropdown ── */
export function NotificationsDropdown({
  anchorRef,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenManage,
}: NotificationsDropdownProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [mode, setMode] = useState<PanelMode>("compact");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState(() => {
    if (typeof window === "undefined" || !anchorRef.current) {
      return { top: 0, right: 0 };
    }

    const rect = anchorRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    };
  });

  const isExpanded = mode === "expanded";

  useLayoutEffect(() => {
    if (!anchorRef.current) return;

    const updateAnchorPosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      setAnchorPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };

    updateAnchorPosition();
    window.addEventListener("resize", updateAnchorPosition);

    return () => window.removeEventListener("resize", updateAnchorPosition);
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        if (isExpanded) {
          const target = e.target as HTMLElement;
          if (target.getAttribute("data-backdrop") === "true") {
            onClose();
          }
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef, isExpanded]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isExpanded) {
          setMode("compact");
        } else {
          onClose();
          anchorRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, anchorRef, isExpanded]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    return true;
  });

  const handleCardClick = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) onMarkRead(n.id);
      onClose();
      if (n.navigationTarget) navigate(n.navigationTarget);
    },
    [onMarkRead, onClose, navigate]
  );

  const handleMarkAllRead = useCallback(() => {
    onMarkAllRead();
    toast.success("All caught up", { description: "All notifications marked as read." });
  }, [onMarkAllRead]);

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "Show All", count: notifications.length },
    { key: "unread", label: "Unread", count: unreadCount },
  ];

  const compactStyle = {
    top: anchorPos.top,
    right: anchorPos.right,
    width: 410,
    height: "70vh",
    borderRadius: 12,
  };

  const expandedStyle = {
    top: 14,
    right: 14,
    width: 460,
    height: "calc(100vh - 28px)",
    borderRadius: 14,
  };

  const currentStyle = isExpanded ? expandedStyle : compactStyle;

  return createPortal(
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="backdrop"
            data-backdrop="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9998]"
            style={{ backgroundColor: "rgba(0,0,0,0.1)" }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={dropdownRef}
        initial={
          isExpanded
            ? undefined
            : {
                opacity: 0,
                scale: 0.98,
                y: -6,
                top: currentStyle.top,
                right: currentStyle.right,
                width: currentStyle.width,
                height: currentStyle.height,
                borderRadius: currentStyle.borderRadius,
              }
        }
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          top: currentStyle.top,
          right: currentStyle.right,
          width: currentStyle.width,
          height: currentStyle.height,
          borderRadius: currentStyle.borderRadius,
        }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }}
        transition={{
          type: "spring",
          duration: 0.32,
          bounce: 0.08,
          top: { type: "spring", duration: 0.35, bounce: 0.05 },
          right: { type: "spring", duration: 0.35, bounce: 0.05 },
          width: { type: "spring", duration: 0.35, bounce: 0.05 },
          height: { type: "spring", duration: 0.35, bounce: 0.05 },
          borderRadius: { type: "spring", duration: 0.3, bounce: 0 },
        }}
        className="fixed z-[9999] bg-white flex flex-col font-['Inter'] overflow-hidden"
        style={{
          transformOrigin: "top right",
          top: currentStyle.top,
          right: currentStyle.right,
          width: currentStyle.width,
          height: currentStyle.height,
          borderRadius: currentStyle.borderRadius,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: isExpanded
            ? "0 8px 30px -4px rgba(0,0,0,0.12), 0 20px 60px -8px rgba(0,0,0,0.08)"
            : "0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.08), 0 20px 40px -4px rgba(0,0,0,0.06)",
        }}
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header: title + View all / Close */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          <div className="flex items-center gap-2">
            {!isExpanded ? (
              <button
                onClick={() => setMode("expanded")}
                className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-all cursor-pointer px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Full view
              </button>
            ) : (
              <button
                onClick={() => setMode("compact")}
                className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-all cursor-pointer px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Exit full
              </button>
            )}
            {isExpanded && (
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-4 pb-2.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-[12px] px-3 py-1.5 rounded-full transition-all cursor-pointer border inline-flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-[#EDF4FF] text-[#0A77FF] font-medium border-[#0A77FF]/30"
                  : "bg-white text-gray-600 hover:bg-gray-50 font-normal border-gray-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                    activeTab === tab.key
                      ? "bg-blue-200 text-blue-700 font-bold"
                      : "bg-gray-100 text-gray-500 font-medium"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto bg-[#F8FAFC] min-h-[360px]"
          role="list"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#e2e8f0 transparent",
          }}
        >
          {filtered.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {filtered.map((n) => (
                <NotificationCard key={n.id} notification={n} onClickCard={handleCardClick} isExpanded={isExpanded} />
              ))}
            </div>
          )}
        </div>

        {/* Footer: Mark all as read (left) + Manage notifications (right) */}
        <div className="border-t border-gray-100 bg-white px-4 py-2.5 flex items-center justify-between">
          {unreadCount > 0 ? (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer"
              style={{ color: "#059669" }}
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => {
              if (onOpenManage) {
                onOpenManage();
              }
            }}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer"
            style={{ color: "#0A77FF" }}
          >
            <Settings className="w-3.5 h-3.5" />
            Manage notifications
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
