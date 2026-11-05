/* The small stacked dialogs the import flow uses above its modals:
 * the red confirm (Discard / Delete rows) and the green Import Complete
 * card (port of role-zen's DiscardConfirmModal / BulkDeleteConfirm /
 * ImportCompleteDialog). Both portal to body at z 300 / 301. */
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronRight, Trash2 } from "lucide-react";

const PANEL_SHADOW = "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Primary (red) button label. */
  confirmLabel: string;
  /** Secondary button label. */
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: "warning" | "trash";
  /** Pill text over the title ("DISCARD"). Omit for no pill. */
  pill?: string;
  maxWidth?: number;
}

/** Red-radial confirm used for "Discard This Import?", "Close Without
 *  Importing?" and "Delete These Rows?". Backdrop click and Escape cancel. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  icon = "warning",
  pill,
  maxWidth = 420,
}: ConfirmDialogProps) {
  const Icon = icon === "trash" ? Trash2 : AlertTriangle;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="confirm-panel"
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCancel();
                }
              }}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] flex flex-col"
              style={{ maxWidth, boxShadow: PANEL_SHADOW }}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background: "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(254,202,202,0.45)" }}>
                  <Icon className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
                {pill && (
                  <span
                    className="mt-4 inline-flex items-center px-3.5 py-1 rounded-full"
                    style={{ backgroundColor: "#FEE2E2", color: "#B91C1C", fontSize: "11px", fontWeight: 700, letterSpacing: 1.2 }}
                  >
                    {pill}
                  </span>
                )}
              </div>
              <div className="px-6 pb-2 text-center">
                <h2 className="text-[#0F172A]" style={{ fontSize: icon === "trash" ? "18px" : "20px", fontWeight: 700 }}>
                  {title}
                </h2>
                <p className="mt-2 text-[#64748B]" style={{ fontSize: icon === "trash" ? "13px" : "13.5px", lineHeight: 1.55 }}>
                  {message}
                </p>
              </div>
              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={onConfirm}
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {cancelLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ─── Import Complete ─── */

export type CompleteDetailFilter = "imported" | "failed";

interface SummaryCardProps {
  label: string;
  count: number;
  onClick?: () => void;
}

function SummaryCard({ label, count, onClick }: SummaryCardProps) {
  const clickable = count > 0 && !!onClick;
  const inner = (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-[#64748B]" style={{ fontSize: "12.5px", fontWeight: 500 }}>
          {label}
        </span>
        <span className="text-[#0F172A] tabular-nums" style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1 }}>
          {count}
        </span>
      </div>
      {clickable && <ChevronRight className="w-4 h-4 shrink-0 self-start mt-0.5" style={{ color: "#94A3B8" }} />}
    </>
  );
  const base = "rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 flex items-start justify-between gap-2";
  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} text-left transition-all cursor-pointer hover:shadow-md hover:border-[#0A77FF]/30`}
        aria-label={`${label}: ${count}. View on import detail page.`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

export interface ImportCompleteDialogProps {
  open: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  entityPlural: string; // "Items"
  onGoToListing: () => void;
  onViewHistory: () => void;
  onViewDetail: (filter: CompleteDetailFilter) => void;
  historyLabel?: string;
  listingLabel?: string;
}

export function ImportCompleteDialog({
  open,
  createdCount,
  updatedCount,
  skippedCount,
  entityPlural,
  onGoToListing,
  onViewHistory,
  onViewDetail,
  historyLabel = "View Import History",
  listingLabel,
}: ImportCompleteDialogProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="complete-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/50 z-[300]"
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="complete-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-complete-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[460px] flex flex-col"
              style={{ boxShadow: PANEL_SHADOW }}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background: "radial-gradient(120% 100% at 50% 0%, #D1FAE5 0%, rgba(209,250,229,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(167,243,208,0.45)" }}>
                  <CheckCircle2 className="w-9 h-9" style={{ color: "#059669" }} strokeWidth={2} />
                </div>
                <h2 id="import-complete-title" className="text-[#0F172A] mt-4" style={{ fontSize: "20px", fontWeight: 700 }}>
                  Import Complete
                </h2>
              </div>
              <div className="px-6 pb-5 grid grid-cols-3 gap-3">
                <SummaryCard label={`${entityPlural} Created`} count={createdCount} onClick={() => onViewDetail("imported")} />
                <SummaryCard label={`${entityPlural} Updated`} count={updatedCount} onClick={() => onViewDetail("imported")} />
                <SummaryCard label="Rows Skipped" count={skippedCount} onClick={() => onViewDetail("failed")} />
              </div>
              <div className="px-6 pt-2 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={onGoToListing}
                  className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {listingLabel ?? `View ${entityPlural} Listing`}
                </button>
                <button
                  type="button"
                  onClick={onViewHistory}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {historyLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
