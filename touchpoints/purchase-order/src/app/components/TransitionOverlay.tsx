import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Check,
  Send,
  PackageCheck,
  Package,
  Lock,
  ArrowRight,
} from "lucide-react";
import { FONT } from "./designTokens";
import type { POStatus } from "./poStore";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const T = {
  heading: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  badgeFrom: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  badgeTo: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   STATUS COLOR MAP — matches STEP_COLORS from PurchaseOrderDraft.
   Each status defines:
     solid     → full-strength token for icon/text/progress
     backdrop  → low-opacity tint for the full-screen glassmorphism layer
     iconRing  → glow ring around the icon circle
     iconBg    → background inside the icon circle
     toBadgeBg → "To" pill background
     toBadgeBorder → "To" pill border
   ═══════════════════════════════════════════════════════════════ */

const OVERLAY_COLORS: Record<
  string,
  {
    solid: string;
    backdrop: string;
    iconRing: string;
    iconBg: string;
    toBadgeBg: string;
    toBadgeBorder: string;
  }
> = {
  Draft: {
    solid: "hsl(var(--muted-foreground))",
    backdrop: "color-mix(in srgb, hsl(var(--muted-foreground)) 10%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--muted-foreground)) 18%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--muted-foreground)) 12%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--muted-foreground)) 8%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--muted-foreground)) 18%, transparent)",
  },
  Confirmed: {
    solid: "hsl(var(--primary))",
    backdrop: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--primary)) 22%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--primary)) 22%, transparent)",
  },
  Sent: {
    solid: "hsl(var(--chart-4))",
    backdrop: "color-mix(in srgb, hsl(var(--chart-4)) 12%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--chart-4)) 22%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--chart-4)) 14%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--chart-4)) 10%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--chart-4)) 22%, transparent)",
  },
  "Partially Received": {
    solid: "hsl(var(--warning))",
    backdrop: "color-mix(in srgb, hsl(var(--warning)) 11%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--warning)) 13%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)",
  },
  "Fully Received": {
    solid: "hsl(var(--accent))",
    backdrop: "color-mix(in srgb, hsl(var(--accent)) 13%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--accent)) 24%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--accent)) 16%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--accent)) 22%, transparent)",
  },
  Closed: {
    solid: "hsl(var(--muted-foreground))",
    backdrop: "color-mix(in srgb, hsl(var(--muted-foreground)) 8%, transparent)",
    iconRing: "color-mix(in srgb, hsl(var(--muted-foreground)) 14%, transparent)",
    iconBg: "color-mix(in srgb, hsl(var(--muted-foreground)) 10%, transparent)",
    toBadgeBg: "color-mix(in srgb, hsl(var(--muted-foreground)) 7%, transparent)",
    toBadgeBorder: "color-mix(in srgb, hsl(var(--muted-foreground)) 15%, transparent)",
  },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  Draft: FileText,
  Confirmed: Check,
  Sent: Send,
  "Partially Received": PackageCheck,
  "Fully Received": Package,
  Closed: Lock,
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT — Glassmorphism color-tinted overlay
   No white card; page content stays visible behind a status-colored
   translucent backdrop. Content floats at centre with no panel.
   ═══════════════════════════════════════════════════════════════ */

interface TransitionOverlayProps {
  visible: boolean;
  fromStatus: POStatus;
  toStatus: POStatus;
  duration?: number;
  onDismiss: () => void;
}

export default function TransitionOverlay({
  visible,
  fromStatus,
  toStatus,
  duration = 1200,
  onDismiss,
}: TransitionOverlayProps) {
  const [progress, setProgress] = useState(100);

  const colors = OVERLAY_COLORS[toStatus] ?? OVERLAY_COLORS.Draft;
  const fromColors = OVERLAY_COLORS[fromStatus] ?? OVERLAY_COLORS.Draft;
  const Icon = STATUS_ICONS[toStatus] ?? FileText;

  /* ── Progress drain + auto-dismiss ── */
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

  return (
    <AnimatePresence>
      {visible && (
        /* ── Single full-screen layer: colored glassmorphism backdrop + centred content ── */
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{
            fontFamily: FONT,
            /* The coloured tint backdrop — status color at low opacity */
            backgroundColor: colors.backdrop,
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onDismiss}
        >
          {/* ── Floating content — no card/panel background ── */}
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
            {/* ── Icon circle with glow ring ── */}
            <motion.div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                backgroundColor: colors.iconBg,
                boxShadow: `0 0 0 6px ${colors.iconRing}, 0 4px 20px ${colors.iconRing}`,
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.08,
                type: "spring",
                stiffness: 450,
                damping: 18,
                mass: 0.75,
              }}
            >
              <Icon
                className="size-6"
                style={{ color: colors.solid }}
                strokeWidth={2}
              />
            </motion.div>

            {/* ── Heading ── */}
            <motion.h2
              style={{ ...T.heading, color: "hsl(var(--foreground))" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.3 }}
            >
              State Transitioned
            </motion.h2>

            {/* ── From → To badge row ── */}
            <motion.div
              className="flex items-center gap-2 sm:gap-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.32 }}
            >
              {/* From pill — muted, glass-like */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: "color-mix(in srgb, hsl(var(--card)) 70%, transparent)",
                  border: `1px solid color-mix(in srgb, hsl(var(--border)) 60%, transparent)`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span style={{ ...T.badgeFrom, color: fromColors.solid }}>
                  {fromStatus}
                </span>
              </div>

              {/* Arrow */}
              <ArrowRight
                className="size-4 shrink-0"
                style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}
                strokeWidth={2.2}
              />

              {/* To pill — status-coloured, prominent */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: colors.toBadgeBg,
                  border: `1px solid ${colors.toBadgeBorder}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span style={{ ...T.badgeTo, color: colors.solid }}>
                  {toStatus}
                </span>
              </div>
            </motion.div>

            {/* ── Progress bar — thin, drains over duration ── */}
            <motion.div
              className="w-[180px] sm:w-[220px] overflow-hidden"
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)",
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
                  backgroundColor: colors.solid,
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
