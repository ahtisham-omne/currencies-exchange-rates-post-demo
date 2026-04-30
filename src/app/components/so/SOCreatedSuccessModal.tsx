import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowRight, Plus } from "lucide-react";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};
const h4Style: React.CSSProperties = { ...font, fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" };
const labelStyle: React.CSSProperties = { ...font, fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" };
const captionStyle: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };

const COUNTDOWN_SECONDS = 5;

interface SOCreatedSuccessModalProps {
  open: boolean;
  soNumber: string;
  customerName: string;
  onViewSO: () => void;
  onNewSO: () => void;
  onClose: () => void;
}

export function SOCreatedSuccessModal({
  open, soNumber, customerName, onViewSO, onNewSO, onClose,
}: SOCreatedSuccessModalProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoNavigated = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useModalShortcuts({
    onConfirm: () => { clearTimer(); onViewSO(); },
    onClose: () => { clearTimer(); onClose(); },
  });

  useEffect(() => {
    if (!open) {
      clearTimer();
      setCountdown(COUNTDOWN_SECONDS);
      hasAutoNavigated.current = false;
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearTimer();
          if (!hasAutoNavigated.current) {
            hasAutoNavigated.current = true;
            requestAnimationFrame(() => onViewSO());
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [open, clearTimer, onViewSO]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed", inset: 0,
            zIndex: "var(--z-modal)" as any,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: "absolute", inset: 0,
              backdropFilter: "blur(6px)",
            }}
            className="bg-foreground/35"
            onClick={() => { clearTimer(); onClose(); }}
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "relative",
              width: 380,
              background: "var(--card)",
              borderRadius: 20,
              boxShadow: "var(--elevation-5)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "36px 32px 28px",
            }}
          >
            {/* Animated checkmark circle */}
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "var(--elevation-2)",
                marginBottom: 20,
              }}
            >
              <motion.div
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
              >
                <Check
                  style={{ width: 36, height: 36, color: "var(--accent-foreground)" }}
                  strokeWidth={3}
                />
              </motion.div>
            </motion.div>

            {/* "Created" label */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.5, marginBottom: 4 }}
            >
              Created
            </motion.div>

            {/* SO Number */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                ...h4Style,
                color: "var(--primary)",
                marginBottom: 4,
                letterSpacing: "-0.01em",
              }}
            >
              {soNumber}
            </motion.div>

            {/* Customer name */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.45, marginBottom: 28 }}
            >
              {customerName}
            </motion.div>

            {/* View SO button with countdown */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              onClick={() => { clearTimer(); onViewSO(); }}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 24px", borderRadius: 12,
                border: "none", cursor: "pointer",
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                boxShadow: "var(--elevation-1)",
                ...labelStyle,
                transition: "all 150ms",
                marginBottom: 12,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Progress bar background */}
              <div
                className="bg-accent-foreground/10"
                style={{
                  position: "absolute", inset: 0,
                  transformOrigin: "left",
                  transform: `scaleX(${1 - countdown / COUNTDOWN_SECONDS})`,
                  transition: "transform 1s linear",
                }}
              />
              <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                View Sales Order <ArrowRight style={{ width: 16, height: 16 }} />
              </span>
              <span
                className="bg-accent-foreground/20"
                style={{
                  position: "relative",
                  ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" as any,
                  padding: "2px 8px", borderRadius: 6,
                  minWidth: 24, textAlign: "center",
                }}
              >
                {countdown}s
              </span>
            </motion.button>

            {/* Secondary actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              style={{ display: "flex", gap: 10, width: "100%" }}
            >
              <button
                onClick={() => { clearTimer(); onNewSO(); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 16px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--card)",
                  cursor: "pointer", ...captionStyle, color: "var(--foreground)",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--secondary)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
              >
                <Plus style={{ width: 14, height: 14 }} /> New SO
              </button>
              <button
                onClick={() => { clearTimer(); onClose(); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 16px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--card)",
                  cursor: "pointer", ...captionStyle, color: "var(--foreground)",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--secondary)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
              >
                Close <KbdHint keys="Esc" />
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}