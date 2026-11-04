import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { X, Check, AlertTriangle, Info } from "lucide-react";

/**
 * Toast notification system matching the design spec:
 * - Sleek white background
 * - Colored left border (4px)
 * - Appears from right edge near top-right
 * - Countdown-based auto-dismiss (5 seconds default)
 * - Optional primary/secondary CTAs
 * - Uses CSS variables only, Inter font, 4px grid spacing
 */

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

const typeConfig: Record<ToastType, { borderColor: string; icon: ReactNode; iconBg: string; iconColor: string }> = {
  success: {
    borderColor: "var(--accent)",
    icon: <Check className="w-4 h-4" />,
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  error: {
    borderColor: "var(--destructive)",
    icon: <X className="w-4 h-4" />,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  warning: {
    borderColor: "var(--chart-3)",
    icon: <AlertTriangle className="w-4 h-4" />,
    iconBg: "bg-chart-3/10",
    iconColor: "text-chart-3",
  },
  info: {
    borderColor: "var(--primary)",
    icon: <Info className="w-4 h-4" />,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const config = typeConfig[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (100 / duration) * 50;
        return next <= 0 ? 0 : next;
      });
    }, 50);

    const timeout = setTimeout(onDismiss, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className="relative bg-card rounded-lg overflow-hidden animate-in slide-in-from-right-full border border-border"
      style={{
        boxShadow: "var(--elevation-2)",
        width: 420,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-1 transition-all"
        style={{
          width: `${progress}%`,
          backgroundColor: config.borderColor,
        }}
      />

      <div className="flex items-start" style={{ padding: "16px", gap: "12px" }}>
        {/* Icon */}
        <div className={`rounded-lg flex items-center justify-center shrink-0 ${config.iconBg} ${config.iconColor}`} style={{ width: 36, height: 36 }}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-foreground/60" style={{ fontSize: "var(--text-caption)", marginTop: 4 }}>
              {toast.message}
            </div>
          )}
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex items-center" style={{ gap: 8, marginTop: 12 }}>
              {toast.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    action.onClick();
                    onDismiss();
                  }}
                  className={`inline-flex items-center rounded-md transition-colors ${
                    action.variant === "primary"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground/70 hover:bg-secondary/80"
                  }`}
                  style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-medium)",
                    padding: "4px 12px",
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="shrink-0 text-foreground/30 hover:text-foreground/60 transition-colors"
          style={{ marginTop: 4 }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed flex flex-col pointer-events-none"
        style={{
          top: 16,
          right: 16,
          gap: 12,
          zIndex: "var(--z-toast)",
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => hideToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}