/**
 * SystemSettingsModal — stub for the RMA port.
 *
 * The source app renders a company-wide settings modal (GL depth toggle
 * and payment run ID convention). Those settings don't apply to the RMA
 * surface yet, so the port ships a minimal placeholder that keeps the
 * Layout footer's Settings button functional without dragging in the
 * useSystemSettings hook and Switch dependency graph. Extend when RMA
 * gains its own system settings.
 */
import { Settings, X } from "lucide-react";

interface SystemSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemSettingsModal({ open, onOpenChange }: SystemSettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3
                className="text-[14px] text-foreground leading-tight"
                style={{ fontWeight: 600 }}
              >
                System settings
              </h3>
              <p
                className="text-[11px] text-slate-500 mt-0.5"
                style={{ fontWeight: 400 }}
              >
                No system-level settings yet.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 text-[13px] text-muted-foreground">
          Company-wide settings will appear here soon.
        </div>

        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors hover:bg-slate-50"
            style={{ fontWeight: 500, color: "#0F172A", backgroundColor: "#FFFFFF" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
