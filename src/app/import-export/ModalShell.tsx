/* Portal + backdrop + spring entrance shared by the Export modal (port of
 * role-zen's shared/ModalShell.tsx). No Escape handler, no focus trap;
 * backdrop click closes unless `backdropClose` is false. */
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** z-index for backdrop/modal. Defaults to 60. */
  z?: number;
  /** Whether clicking backdrop closes the modal. Defaults to true. */
  backdropClose?: boolean;
}

const backdropTransition = { duration: 0.2, ease: "easeOut" as const };
const modalTransition = { type: "spring" as const, duration: 0.28, bounce: 0 };

export function ModalShell({ open, onClose, children, z = 60, backdropClose = true }: ModalShellProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="fixed inset-0"
            style={{ zIndex: z, backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
            onClick={backdropClose ? onClose : undefined}
          />
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={modalTransition}
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: z + 1, pointerEvents: "none", willChange: "transform, opacity" }}
          >
            <div style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
