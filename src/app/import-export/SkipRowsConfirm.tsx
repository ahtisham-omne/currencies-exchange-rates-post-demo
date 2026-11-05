/* Confirms "Skip N error rows" in the Review and Fix modal (copied from the hub's
 * import-review/SkipRowsConfirm.tsx). Same dialog as
 * BulkDeleteConfirm (ImportReviewModal.tsx), with the skip copy; the rows can be
 * brought back with "Undo skipped rows" until the import starts. */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SkipForward } from "lucide-react";

export function SkipRowsConfirm({
  confirm,
  onConfirm,
  onCancel,
}: {
  /** The rows to skip; null while closed. */
  confirm: { ids: string[] } | null;
  onConfirm: (ids: string[]) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!confirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirm, onCancel]);

  const open = confirm !== null;
  const n = confirm?.ids.length ?? 0;
  const title = `Skip ${n} Error ${n === 1 ? "Row" : "Rows"}?`;
  const message =
    "These rows won't be imported and will be kept as failed, to fix later. You can still bring them back here with Undo skipped rows.";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="alertdialog"
              aria-labelledby="skip-rows-title"
              aria-describedby="skip-rows-desc"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[440px] flex flex-col"
              style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(254,202,202,0.45)" }}
                >
                  <SkipForward className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
              </div>
              <div className="px-6 pb-2 text-center">
                <h2 id="skip-rows-title" className="text-[#0F172A]" style={{ fontSize: "18px", fontWeight: 700 }}>
                  {title}
                </h2>
                <p id="skip-rows-desc" className="text-[#64748B] mt-2" style={{ fontSize: "13px", lineHeight: 1.55 }}>
                  {message}
                </p>
              </div>
              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => confirm && onConfirm(confirm.ids)}
                  autoFocus
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Skip Rows
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Cancel
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
