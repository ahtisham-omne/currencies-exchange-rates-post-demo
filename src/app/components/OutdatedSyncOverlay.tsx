/* OutdatedSyncOverlay — plays on APPLY inside the outdated-
 * configs modal. Same shape as TransitionOverlay (glassmorphism
 * tint + centred content + progress drain) but themed in the
 * amber palette that owns the whole outdated-configs surface
 * (pill, modal glow header, apply button).
 *
 * Auto-dismisses after `duration` ms so the buyer isn't stuck
 * — matches the state-transition overlay's rhythm. */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { FONT } from "./designTokens";

interface OutdatedSyncOverlayProps {
  visible: boolean;
  /** How many updates the buyer just applied — surfaces as the
   *  secondary badge under the heading. */
  count: number;
  /** Optional partner name so the copy can read
   *  "Synced from Partner Management · <partner>". */
  partnerName?: string;
  duration?: number;
  onDismiss: () => void;
}

/* Amber palette — mirrors OutdatedConfigsModal's glow header and
   the pill in the listing/detail chrome. */
const AMBER = {
  solid: "#B45309",
  headingText: "#78350F",
  backdrop: "rgba(245, 158, 11, 0.14)",
  iconBg: "#FEF3C7",
  iconRing: "rgba(245, 158, 11, 0.28)",
  progressTrack: "rgba(245, 158, 11, 0.20)",
  progressFill: "#F59E0B",
  badgeBg: "#FFFBEB",
  badgeBorder: "#FDE68A",
  badgeText: "#92400E",
};

export default function OutdatedSyncOverlay({
  visible,
  count,
  partnerName,
  duration = 1600,
  onDismiss,
}: OutdatedSyncOverlayProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!visible) {
      setProgress(100);
      return;
    }
    setProgress(100);
    const drainDelay = setTimeout(() => setProgress(0), 100);
    const dismissTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(drainDelay);
      clearTimeout(dismissTimer);
    };
  }, [visible, duration, onDismiss]);

  const noun = count === 1 ? "configuration" : "configurations";
  const badgeText = partnerName
    ? `Synced from ${partnerName}`
    : "Synced from Partner Management";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{
            fontFamily: FONT,
            backgroundColor: AMBER.backdrop,
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onDismiss}
        >
          <motion.div
            className="flex flex-col items-center gap-3 sm:gap-4 px-4"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 26,
              mass: 0.85,
            }}
          >
            {/* Icon circle with glow ring — RefreshCw spins on entry
                so the "sync happened" beat is unmistakable. */}
            <motion.div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                backgroundColor: AMBER.iconBg,
                boxShadow: `0 0 0 6px ${AMBER.iconRing}, 0 4px 20px ${AMBER.iconRing}`,
              }}
              initial={{ scale: 0.3, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{
                delay: 0.08,
                type: "spring",
                stiffness: 450,
                damping: 18,
                mass: 0.75,
              }}
            >
              <RefreshCw
                className="size-6"
                style={{ color: AMBER.solid }}
                strokeWidth={2}
              />
            </motion.div>

            {/* Heading — succinct past-tense success beat. */}
            <motion.h2
              style={{
                fontSize: "var(--text-h4)",
                fontWeight: "var(--font-weight-semibold)" as string,
                lineHeight: "1.35",
                fontFamily: FONT,
                letterSpacing: "-0.01em",
                color: AMBER.headingText,
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.3 }}
            >
              Configurations Updated
            </motion.h2>

            {/* Count + provenance pill — subordinate line so the
                buyer can see how many synced from where. */}
            <motion.div
              className="flex items-center gap-2 sm:gap-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.32 }}
            >
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: AMBER.badgeBg,
                  border: `1px solid ${AMBER.badgeBorder}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-weight-semibold)" as string,
                    lineHeight: "1.35",
                    fontFamily: FONT,
                    color: AMBER.badgeText,
                  }}
                >
                  {count} {noun} synced
                </span>
              </div>
              <span
                style={{
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-weight-medium)" as string,
                  color: AMBER.headingText,
                  opacity: 0.72,
                  fontFamily: FONT,
                }}
              >
                {badgeText}
              </span>
            </motion.div>

            {/* Progress bar — drains over `duration`, matches the
                state-transition overlay's cadence. */}
            <motion.div
              className="w-[220px] sm:w-[260px] overflow-hidden"
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: AMBER.progressTrack,
                marginTop: 4,
              }}
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.25 }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: AMBER.progressFill,
                  borderRadius: 2,
                  transition: visible
                    ? `width ${duration - 200}ms linear`
                    : "none",
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
