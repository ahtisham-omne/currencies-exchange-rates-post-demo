import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Layers,
  type LucideIcon,
  Pencil,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { type ElementType, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen state-transition animation ported 1-to-1 from Sales Order's
 * `StateTransitionOverlay`. A dim + blur backdrop mutes the page while a
 * centred card animates in: a glow-ringed icon, verb-led heading, From → To
 * pill row, and an indeterminate loader. Self-timed — fires `onComplete`
 * after `duration`, when the caller commits the real mutation.
 *
 * PO uses `framer-motion` rather than SO's `motion/react`, so `m` is
 * swapped for `motion`; everything else is identical.
 */

export type StateTransitionTone =
  | "success"
  | "destructive"
  | "warning"
  | "info"
  | "neutral"
  | "version";

interface ToneVariant {
  solid: string;
  iconBg: string;
  ring: string;
  toBadgeBg: string;
  toBadgeBorder: string;
  barTrack: string;
  barIndicator: string;
}

const TONE_VARIANTS: Record<StateTransitionTone, ToneVariant> = {
  success: {
    solid: "#10B981",
    iconBg: "rgba(16, 185, 129, 0.16)",
    ring: "rgba(16, 185, 129, 0.22)",
    toBadgeBg: "rgba(16, 185, 129, 0.16)",
    toBadgeBorder: "rgba(16, 185, 129, 0.45)",
    barTrack: "rgba(16, 185, 129, 0.20)",
    barIndicator: "#10B981",
  },
  destructive: {
    solid: "#DC2626",
    iconBg: "rgba(220, 38, 38, 0.16)",
    ring: "rgba(220, 38, 38, 0.22)",
    toBadgeBg: "rgba(220, 38, 38, 0.16)",
    toBadgeBorder: "rgba(220, 38, 38, 0.45)",
    barTrack: "rgba(220, 38, 38, 0.20)",
    barIndicator: "#DC2626",
  },
  warning: {
    solid: "#F59E0B",
    iconBg: "rgba(245, 158, 11, 0.18)",
    ring: "rgba(245, 158, 11, 0.26)",
    toBadgeBg: "rgba(245, 158, 11, 0.18)",
    toBadgeBorder: "rgba(245, 158, 11, 0.50)",
    barTrack: "rgba(245, 158, 11, 0.22)",
    barIndicator: "#F59E0B",
  },
  info: {
    solid: "#1B6EF3",
    iconBg: "rgba(27, 110, 243, 0.16)",
    ring: "rgba(27, 110, 243, 0.22)",
    toBadgeBg: "rgba(27, 110, 243, 0.16)",
    toBadgeBorder: "rgba(27, 110, 243, 0.45)",
    barTrack: "rgba(27, 110, 243, 0.20)",
    barIndicator: "#1B6EF3",
  },
  neutral: {
    solid: "#64748B",
    iconBg: "rgba(100, 116, 139, 0.18)",
    ring: "rgba(100, 116, 139, 0.26)",
    toBadgeBg: "rgba(100, 116, 139, 0.18)",
    toBadgeBorder: "rgba(100, 116, 139, 0.45)",
    barTrack: "rgba(100, 116, 139, 0.22)",
    barIndicator: "#64748B",
  },
  version: {
    solid: "#7C3AED",
    iconBg: "rgba(124, 58, 237, 0.16)",
    ring: "rgba(124, 58, 237, 0.24)",
    toBadgeBg: "rgba(124, 58, 237, 0.16)",
    toBadgeBorder: "rgba(124, 58, 237, 0.45)",
    barTrack: "rgba(124, 58, 237, 0.20)",
    barIndicator: "#7C3AED",
  },
};

const DEFAULT_ICON_BY_TONE: Record<StateTransitionTone, LucideIcon> = {
  success: Check,
  destructive: Ban,
  warning: AlertTriangle,
  info: CheckCircle2,
  neutral: Pencil,
  version: Layers,
};

export interface StateTransitionOverlayProps {
  isActive: boolean;
  fromLabel: string;
  toLabel: string;
  tone?: StateTransitionTone;
  /** Override the auto-picked icon for the destination tone. */
  Icon?: ElementType;
  /** Verb-led headline above the pills (e.g. "Duplicating PO"). */
  heading?: string;
  /** Optional reference line below the pills (e.g. "PO-1024 → PO-1092"). */
  meta?: string;
  /** Total visible time in ms before `onComplete` fires. Defaults to 1800. */
  duration?: number;
  onComplete?: () => void;
}

export function StateTransitionOverlay({
  isActive,
  fromLabel,
  toLabel,
  tone = "neutral",
  Icon,
  heading = "State Transitioned",
  meta,
  duration = 1800,
  onComplete,
}: StateTransitionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!isActive) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const fadeOut = window.setTimeout(
      () => setVisible(false),
      Math.max(400, duration - 220),
    );
    const done = window.setTimeout(() => completeRef.current?.(), duration);
    return () => {
      window.clearTimeout(fadeOut);
      window.clearTimeout(done);
    };
  }, [isActive, duration]);

  const variant = TONE_VARIANTS[tone];
  const ResolvedIcon = Icon ?? DEFAULT_ICON_BY_TONE[tone];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="state-transition-overlay"
          role="status"
          aria-live="assertive"
          aria-label={heading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.85 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              padding: "0 24px",
              maxWidth: 480,
              textAlign: "center",
            }}
          >
            {/* Icon circle with double glow ring */}
            <div style={{ position: "relative", width: 64, height: 64 }}>
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.55, 1.8], opacity: [0, 0.45, 0] }}
                transition={{ duration: 1.0, ease: "easeOut", times: [0, 0.5, 1] }}
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: "50%",
                  border: `2px solid ${variant.solid}`,
                  pointerEvents: "none",
                }}
              />
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.25, 1.4], opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.9, delay: 0.08, ease: "easeOut", times: [0, 0.5, 1] }}
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  border: `2px solid ${variant.solid}`,
                  pointerEvents: "none",
                }}
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 20, delay: 0.06 }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: variant.iconBg,
                  boxShadow: `0 0 0 6px ${variant.ring}, 0 12px 28px rgba(15, 23, 42, 0.30)`,
                }}
              >
                <motion.span
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.18 }}
                  style={{ display: "inline-flex" }}
                >
                  <ResolvedIcon
                    style={{ width: 28, height: 28, color: variant.solid }}
                    strokeWidth={2.5}
                  />
                </motion.span>
              </motion.div>
            </div>

            {/* Heading */}
            <motion.h3
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.18 }}
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                textShadow: "0 1px 2px rgba(0,0,0,0.25)",
              }}
            >
              {heading}
            </motion.h3>

            {/* From → To pill row */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.26 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.18)",
                  border: "1px solid rgba(255, 255, 255, 0.28)",
                  color: "#F8FAFC",
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {fromLabel}
              </span>
              <ArrowRight
                style={{ width: 16, height: 16, color: "rgba(255,255,255,0.85)" }}
                strokeWidth={2.4}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: variant.toBadgeBg,
                  border: `1px solid ${variant.toBadgeBorder}`,
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  boxShadow: `0 4px 14px ${variant.ring}`,
                }}
              >
                {toLabel}
              </span>
            </motion.div>

            {meta && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ duration: 0.28, delay: 0.34 }}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.78)",
                  letterSpacing: 0.3,
                }}
              >
                {meta}
              </motion.span>
            )}

            {/* Indeterminate progress bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0.7 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.3, delay: 0.32 }}
              style={{
                marginTop: 6,
                width: 220,
                maxWidth: "100%",
                height: 3,
                borderRadius: 999,
                background: variant.barTrack,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "40%",
                  borderRadius: 999,
                  background: variant.barIndicator,
                  animation: "stateTransitionScroller 1.1s ease-in-out infinite",
                }}
              />
            </motion.div>
          </motion.div>

          <style>{`@keyframes stateTransitionScroller {
            0% { transform: translateX(-110%); }
            50% { transform: translateX(60%); }
            100% { transform: translateX(260%); }
          }`}</style>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
