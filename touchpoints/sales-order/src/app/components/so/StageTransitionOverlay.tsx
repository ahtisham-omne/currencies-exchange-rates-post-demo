import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check, AlertTriangle, Truck, Ban, Archive, Pencil, Send, ArrowRight,
} from "lucide-react";
import type { SOStatus } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Glassmorphism Transition Overlay — PO module style.
   Color-tinted translucent backdrop, no white card.
   Floating icon + heading + From→To pill row + progress bar.
   ═══════════════════════════════════════════════════════════════ */

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const T = {
  heading: { fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "1.35", fontFamily: FONT, letterSpacing: "-0.01em" } as React.CSSProperties,
  badgeFrom: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "1.35", fontFamily: FONT } as React.CSSProperties,
  badgeTo: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "1.35", fontFamily: FONT } as React.CSSProperties,
};

interface OverlayColors {
  solid: string; backdrop: string; iconRing: string; iconBg: string; toBadgeBg: string; toBadgeBorder: string;
}

const OVERLAY_COLORS: Record<string, OverlayColors> = {
  Draft: { solid: "var(--muted-foreground)", backdrop: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)", iconRing: "color-mix(in srgb, var(--muted-foreground) 18%, transparent)", iconBg: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)", toBadgeBg: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" },
  "Pending Review": { solid: "var(--chart-3)", backdrop: "color-mix(in srgb, var(--chart-3) 11%, transparent)", iconRing: "color-mix(in srgb, var(--chart-3) 20%, transparent)", iconBg: "color-mix(in srgb, var(--chart-3) 13%, transparent)", toBadgeBg: "color-mix(in srgb, var(--chart-3) 10%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--chart-3) 20%, transparent)" },
  Cleared: { solid: "var(--accent)", backdrop: "color-mix(in srgb, var(--accent) 13%, transparent)", iconRing: "color-mix(in srgb, var(--accent) 24%, transparent)", iconBg: "color-mix(in srgb, var(--accent) 16%, transparent)", toBadgeBg: "color-mix(in srgb, var(--accent) 10%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--accent) 22%, transparent)" },
  "Partially Shipped": { solid: "var(--chart-4)", backdrop: "color-mix(in srgb, var(--chart-4) 12%, transparent)", iconRing: "color-mix(in srgb, var(--chart-4) 22%, transparent)", iconBg: "color-mix(in srgb, var(--chart-4) 14%, transparent)", toBadgeBg: "color-mix(in srgb, var(--chart-4) 10%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--chart-4) 22%, transparent)" },
  Shipped: { solid: "var(--accent)", backdrop: "color-mix(in srgb, var(--accent) 13%, transparent)", iconRing: "color-mix(in srgb, var(--accent) 24%, transparent)", iconBg: "color-mix(in srgb, var(--accent) 16%, transparent)", toBadgeBg: "color-mix(in srgb, var(--accent) 10%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--accent) 22%, transparent)" },
  Cancelled: { solid: "var(--destructive)", backdrop: "color-mix(in srgb, var(--destructive) 10%, transparent)", iconRing: "color-mix(in srgb, var(--destructive) 18%, transparent)", iconBg: "color-mix(in srgb, var(--destructive) 12%, transparent)", toBadgeBg: "color-mix(in srgb, var(--destructive) 8%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--destructive) 18%, transparent)" },
  "Partially Cancelled": { solid: "var(--chart-3)", backdrop: "color-mix(in srgb, var(--chart-3) 11%, transparent)", iconRing: "color-mix(in srgb, var(--chart-3) 20%, transparent)", iconBg: "color-mix(in srgb, var(--chart-3) 13%, transparent)", toBadgeBg: "color-mix(in srgb, var(--chart-3) 10%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--chart-3) 20%, transparent)" },
  Archived: { solid: "var(--muted-foreground)", backdrop: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)", iconRing: "color-mix(in srgb, var(--muted-foreground) 14%, transparent)", iconBg: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)", toBadgeBg: "color-mix(in srgb, var(--muted-foreground) 7%, transparent)", toBadgeBorder: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)" },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  Draft: Pencil,
  "Pending Review": AlertTriangle,
  Cleared: Check,
  "Partially Shipped": Truck,
  Shipped: Truck,
  Cancelled: Ban,
  "Partially Cancelled": Ban,
  Archived: Archive,
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Marked as Draft",
  "Pending Review": "Submitted for Review",
  Cleared: "Cleared by Ops",
  "Partially Shipped": "Partially Shipped",
  Shipped: "Order Shipped",
  Cancelled: "Order Cancelled",
  "Partially Cancelled": "Lines Cancelled",
  Archived: "Marked as Archived",
};

interface StageTransitionOverlayProps {
  status: SOStatus;
  suppressNextRef?: React.MutableRefObject<boolean>;
}

export function StageTransitionOverlay({ status, suppressNextRef }: StageTransitionOverlayProps) {
  const [show, setShow] = useState(false);
  const [fromStatus, setFromStatus] = useState<SOStatus | null>(null);
  const [toStatus, setToStatus] = useState<SOStatus | null>(null);
  const [progress, setProgress] = useState(100);
  const prevStatusRef = useRef(status);
  const isFirstRender = useRef(true);
  const duration = 1200;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStatusRef.current = status;
      return;
    }
    if (status !== prevStatusRef.current) {
      // If suppressed (e.g. SendToCustomer already showed its own overlay), skip
      if (suppressNextRef?.current) {
        suppressNextRef.current = false;
        prevStatusRef.current = status;
        return;
      }
      setFromStatus(prevStatusRef.current);
      setToStatus(status);
      prevStatusRef.current = status;
      setShow(true);
      setProgress(100);
      const drainDelay = setTimeout(() => setProgress(0), 100);
      const timer = setTimeout(() => setShow(false), duration);
      return () => { clearTimeout(timer); clearTimeout(drainDelay); };
    }
  }, [status]);

  const colors = toStatus ? (OVERLAY_COLORS[toStatus] ?? OVERLAY_COLORS.Draft) : OVERLAY_COLORS.Draft;
  const fromColors = fromStatus ? (OVERLAY_COLORS[fromStatus] ?? OVERLAY_COLORS.Draft) : OVERLAY_COLORS.Draft;
  const Icon = toStatus ? (STATUS_ICONS[toStatus] ?? Pencil) : Pencil;

  return (
    <AnimatePresence>
      {show && toStatus && fromStatus && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{
            fontFamily: FONT,
            backgroundColor: colors.backdrop,
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={() => setShow(false)}
        >
          <motion.div
            className="flex flex-col items-center gap-3 sm:gap-4 px-4"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 26, mass: 0.85 }}
          >
            {/* Icon circle with glow ring */}
            <motion.div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 56, height: 56,
                backgroundColor: colors.iconBg,
                boxShadow: `0 0 0 6px ${colors.iconRing}, 0 4px 20px ${colors.iconRing}`,
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 450, damping: 18, mass: 0.75 }}
            >
              <Icon className="size-6" style={{ color: colors.solid }} strokeWidth={2} />
            </motion.div>

            {/* Heading */}
            <motion.h2
              style={{ ...T.heading, color: "var(--foreground)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.3 }}
            >
              State Transitioned
            </motion.h2>

            {/* From → To badge row */}
            <motion.div
              className="flex items-center gap-2 sm:gap-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.32 }}
            >
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--card) 70%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span style={{ ...T.badgeFrom, color: fromColors.solid }}>{fromStatus}</span>
              </div>
              <ArrowRight className="size-4 shrink-0" style={{ color: "var(--muted-foreground)", opacity: 0.6 }} strokeWidth={2.2} />
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: colors.toBadgeBg,
                  border: `1px solid ${colors.toBadgeBorder}`,
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span style={{ ...T.badgeTo, color: colors.solid }}>{STATUS_LABELS[toStatus] || toStatus}</span>
              </div>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              className="w-[180px] sm:w-[220px] overflow-hidden"
              style={{ height: 3, borderRadius: 2, backgroundColor: "color-mix(in srgb, var(--border) 50%, transparent)", marginTop: 4 }}
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.25 }}
            >
              <div
                style={{
                  height: "100%", width: `${progress}%`, backgroundColor: colors.solid, borderRadius: 2,
                  transition: show ? `width ${duration - 200}ms linear` : "none",
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
