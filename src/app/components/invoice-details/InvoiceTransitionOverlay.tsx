import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Check,
  Banknote,
  Clock,
  Lock,
  Pause,
  Send,
  Truck,
  X as XIcon,
  Archive,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════
   Verbatim port of pleasant-flow/src/app/components/TransitionOverlay
   keyed to the invoice status palette. Same micro-interaction:
   - Status-tinted full-screen backdrop (color-mix tint + blur)
   - Spring-mounted icon circle with glow ring
   - "State Transitioned" heading
   - From → To badge row
   - Thin progress bar draining over `duration`
   - Click-anywhere or auto-dismiss after `duration`
   ════════════════════════════════════════════════════════════════ */

// Listing-page status palette — pulled from InvoiceDataTable's
// STATUS_STYLES so the overlay matches the table chip exactly.
const OVERLAY_COLORS: Record<string, { solid: string; backdrop: string; iconRing: string; iconBg: string; toBadgeBg: string; toBadgeBorder: string }> = {
  'Pending Approval': {
    solid: '#4338CA',
    backdrop: 'color-mix(in srgb, #4338CA 12%, transparent)',
    iconRing: 'color-mix(in srgb, #4338CA 22%, transparent)',
    iconBg: 'color-mix(in srgb, #4338CA 14%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #4338CA 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #4338CA 22%, transparent)',
  },
  Approved: {
    solid: '#047857',
    backdrop: 'color-mix(in srgb, #047857 11%, transparent)',
    iconRing: 'color-mix(in srgb, #047857 20%, transparent)',
    iconBg: 'color-mix(in srgb, #047857 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #047857 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #047857 20%, transparent)',
  },
  'Partially Paid': {
    solid: '#C2410C',
    backdrop: 'color-mix(in srgb, #C2410C 11%, transparent)',
    iconRing: 'color-mix(in srgb, #C2410C 20%, transparent)',
    iconBg: 'color-mix(in srgb, #C2410C 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #C2410C 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #C2410C 20%, transparent)',
  },
  Paid: {
    solid: '#065F46',
    backdrop: 'color-mix(in srgb, #065F46 13%, transparent)',
    iconRing: 'color-mix(in srgb, #065F46 24%, transparent)',
    iconBg: 'color-mix(in srgb, #065F46 16%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #065F46 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #065F46 22%, transparent)',
  },
  'On Hold': {
    solid: '#A16207',
    backdrop: 'color-mix(in srgb, #A16207 11%, transparent)',
    iconRing: 'color-mix(in srgb, #A16207 20%, transparent)',
    iconBg: 'color-mix(in srgb, #A16207 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #A16207 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #A16207 20%, transparent)',
  },
  Rejected: {
    solid: '#991B1B',
    backdrop: 'color-mix(in srgb, #991B1B 11%, transparent)',
    iconRing: 'color-mix(in srgb, #991B1B 20%, transparent)',
    iconBg: 'color-mix(in srgb, #991B1B 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #991B1B 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #991B1B 20%, transparent)',
  },
  Cancelled: {
    solid: '#B91C1C',
    backdrop: 'color-mix(in srgb, #B91C1C 11%, transparent)',
    iconRing: 'color-mix(in srgb, #B91C1C 20%, transparent)',
    iconBg: 'color-mix(in srgb, #B91C1C 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #B91C1C 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #B91C1C 20%, transparent)',
  },
  // Amber, matching the Flag as Exception action tone (7/15/26).
  Exception: {
    solid: '#D97706',
    backdrop: 'color-mix(in srgb, #D97706 11%, transparent)',
    iconRing: 'color-mix(in srgb, #D97706 20%, transparent)',
    iconBg: 'color-mix(in srgb, #D97706 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #D97706 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #D97706 20%, transparent)',
  },
  'Partially Prepaid': {
    solid: '#7C3AED',
    backdrop: 'color-mix(in srgb, #7C3AED 11%, transparent)',
    iconRing: 'color-mix(in srgb, #7C3AED 20%, transparent)',
    iconBg: 'color-mix(in srgb, #7C3AED 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #7C3AED 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #7C3AED 20%, transparent)',
  },
  Prepaid: {
    solid: '#6D28D9',
    backdrop: 'color-mix(in srgb, #6D28D9 11%, transparent)',
    iconRing: 'color-mix(in srgb, #6D28D9 20%, transparent)',
    iconBg: 'color-mix(in srgb, #6D28D9 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #6D28D9 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #6D28D9 20%, transparent)',
  },
  // Stone, matching STATUS_PALETTE.Archived — the archive flow reflects
  // the status color, not destructive red (feedback 7/15/26).
  Archived: {
    solid: '#57534E',
    backdrop: 'color-mix(in srgb, #57534E 8%, transparent)',
    iconRing: 'color-mix(in srgb, #57534E 14%, transparent)',
    iconBg: 'color-mix(in srgb, #57534E 10%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #57534E 7%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #57534E 15%, transparent)',
  },
  // ── Payment run statuses (8/5/26) — the run detail page plays the
  // same overlay on every lifecycle change, in the run tones. ──
  Draft: {
    solid: '#64748B',
    backdrop: 'color-mix(in srgb, #64748B 10%, transparent)',
    iconRing: 'color-mix(in srgb, #64748B 18%, transparent)',
    iconBg: 'color-mix(in srgb, #64748B 12%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #64748B 9%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #64748B 18%, transparent)',
  },
  'Pending approval': {
    solid: '#B45309',
    backdrop: 'color-mix(in srgb, #B45309 11%, transparent)',
    iconRing: 'color-mix(in srgb, #B45309 20%, transparent)',
    iconBg: 'color-mix(in srgb, #B45309 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #B45309 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #B45309 20%, transparent)',
  },
  // Recording wears green (8/5/26): the run execute identity matches
  // the Record Payment module, violet is retired.
  Executed: {
    solid: '#047857',
    backdrop: 'color-mix(in srgb, #047857 11%, transparent)',
    iconRing: 'color-mix(in srgb, #047857 20%, transparent)',
    iconBg: 'color-mix(in srgb, #047857 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #047857 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #047857 20%, transparent)',
  },
  'Partially executed': {
    solid: '#047857',
    backdrop: 'color-mix(in srgb, #047857 11%, transparent)',
    iconRing: 'color-mix(in srgb, #047857 20%, transparent)',
    iconBg: 'color-mix(in srgb, #047857 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #047857 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #047857 20%, transparent)',
  },
  Completed: {
    solid: '#15803D',
    backdrop: 'color-mix(in srgb, #15803D 12%, transparent)',
    iconRing: 'color-mix(in srgb, #15803D 22%, transparent)',
    iconBg: 'color-mix(in srgb, #15803D 14%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #15803D 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #15803D 20%, transparent)',
  },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  'Pending Approval': FileText,
  Approved: Check,
  'Partially Paid': Banknote,
  Paid: Check,
  'On Hold': Pause,
  Rejected: XIcon,
  Cancelled: XIcon,
  Exception: AlertTriangle,
  'Partially Prepaid': Banknote,
  Prepaid: Banknote,
  Archived: Archive,
  // Payment run statuses (8/5/26).
  Draft: FileText,
  'Pending approval': Clock,
  Executed: Banknote,
  'Partially executed': Banknote,
  Completed: Check,
};

// RMA statuses carry their own tones, and some of the names collide with
// invoice / payment-run ones that mean something else (an RMA is Approved in
// indigo, not emerald). Keeping a separate map lets the return lifecycle
// animate in its own chip colors -- same stops as RMA_STATUS_STYLES --
// without disturbing the invoice side. Cancelled is red here as it is
// everywhere else: it was the one status reading muted, which put a stopped
// return in the same grey as one nobody had started.
const RMA_OVERLAY_COLORS: Record<string, (typeof OVERLAY_COLORS)[string]> = {
  Draft: {
    solid: '#475569',
    backdrop: 'color-mix(in srgb, #475569 10%, transparent)',
    iconRing: 'color-mix(in srgb, #475569 18%, transparent)',
    iconBg: 'color-mix(in srgb, #475569 12%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #475569 9%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #475569 18%, transparent)',
  },
  Sent: {
    solid: '#0654BC',
    backdrop: 'color-mix(in srgb, #0654BC 11%, transparent)',
    iconRing: 'color-mix(in srgb, #0654BC 20%, transparent)',
    iconBg: 'color-mix(in srgb, #0654BC 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #0654BC 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #0654BC 20%, transparent)',
  },
  Approved: {
    solid: '#4338CA',
    backdrop: 'color-mix(in srgb, #4338CA 11%, transparent)',
    iconRing: 'color-mix(in srgb, #4338CA 20%, transparent)',
    iconBg: 'color-mix(in srgb, #4338CA 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #4338CA 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #4338CA 20%, transparent)',
  },
  'Shipped to Vendor': {
    solid: '#B45309',
    backdrop: 'color-mix(in srgb, #B45309 11%, transparent)',
    iconRing: 'color-mix(in srgb, #B45309 20%, transparent)',
    iconBg: 'color-mix(in srgb, #B45309 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #B45309 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #B45309 20%, transparent)',
  },
  Closed: {
    solid: '#047857',
    backdrop: 'color-mix(in srgb, #047857 12%, transparent)',
    iconRing: 'color-mix(in srgb, #047857 22%, transparent)',
    iconBg: 'color-mix(in srgb, #047857 14%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #047857 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #047857 20%, transparent)',
  },
  Cancelled: {
    solid: '#B91C1C',
    backdrop: 'color-mix(in srgb, #B91C1C 11%, transparent)',
    iconRing: 'color-mix(in srgb, #B91C1C 20%, transparent)',
    iconBg: 'color-mix(in srgb, #B91C1C 13%, transparent)',
    toBadgeBg: 'color-mix(in srgb, #B91C1C 10%, transparent)',
    toBadgeBorder: 'color-mix(in srgb, #B91C1C 20%, transparent)',
  },
};

const RMA_STATUS_ICONS: Record<string, React.ElementType> = {
  Draft: FileText,
  Sent: Send,
  Approved: Check,
  'Shipped to Vendor': Truck,
  Closed: Lock,
  Cancelled: XIcon,
};

interface InvoiceTransitionOverlayProps {
  visible: boolean;
  fromStatus: string;
  toStatus: string;
  duration?: number;
  /** Which lifecycle vocabulary the status names belong to. */
  variant?: 'invoice' | 'rma';
  onDismiss: () => void;
}

export function InvoiceTransitionOverlay({
  visible,
  fromStatus,
  toStatus,
  duration = 1200,
  variant = 'invoice',
  onDismiss,
}: InvoiceTransitionOverlayProps) {
  const [progress, setProgress] = useState(100);

  const isRma = variant === 'rma';
  const paletteFor = isRma ? RMA_OVERLAY_COLORS : OVERLAY_COLORS;
  const fallback = (isRma ? RMA_OVERLAY_COLORS['Draft'] : OVERLAY_COLORS['Pending Approval'])!;

  // Resolving an exception or resubmitting a rejected invoice lands
  // back on Pending Approval, but the moment is a positive resolution —
  // it animates in emerald instead of the target's indigo (7/15/26).
  const isPositiveReturn =
    !isRma &&
    (fromStatus === 'Exception' || fromStatus === 'Rejected') &&
    toStatus === 'Pending Approval';
  const colors = (isPositiveReturn ? OVERLAY_COLORS['Approved'] : paletteFor[toStatus]) ?? fallback;
  const fromColors = paletteFor[fromStatus] ?? fallback;
  const Icon = isPositiveReturn
    ? Check
    : (isRma ? RMA_STATUS_ICONS[toStatus] : STATUS_ICONS[toStatus]) ?? Clock;

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
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{
            backgroundColor: colors.backdrop,
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          onClick={onDismiss}
        >
          <motion.div
            className="flex flex-col items-center gap-3 sm:gap-4 px-4"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, mass: 0.85 }}
          >
            {/* Icon circle */}
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
              transition={{ delay: 0.08, type: 'spring', stiffness: 450, damping: 18, mass: 0.75 }}
            >
              <Icon className="size-6" style={{ color: colors.solid }} strokeWidth={2} />
            </motion.div>

            {/* Heading */}
            <motion.h2
              className="text-[20px] tracking-tight"
              style={{ fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.35 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.3 }}
            >
              State Transitioned
            </motion.h2>

            {/* From → To row */}
            <motion.div
              className="flex items-center gap-2 sm:gap-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.32 }}
            >
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: 'color-mix(in srgb, hsl(var(--card)) 70%, transparent)',
                  border: '1px solid color-mix(in srgb, hsl(var(--border)) 60%, transparent)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <span className="text-[12px]" style={{ fontWeight: 500, color: fromColors.solid }}>
                  {fromStatus}
                </span>
              </div>

              <ArrowRight className="size-4 shrink-0" style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.6 }} strokeWidth={2.2} />

              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: colors.toBadgeBg,
                  border: `1px solid ${colors.toBadgeBorder}`,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <span className="text-[12px]" style={{ fontWeight: 600, color: colors.solid }}>
                  {toStatus}
                </span>
              </div>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              className="w-[180px] sm:w-[220px] overflow-hidden"
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: 'color-mix(in srgb, hsl(var(--border)) 50%, transparent)',
                marginTop: 4,
              }}
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.25 }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: colors.solid,
                  borderRadius: 2,
                  transition: visible ? `width ${duration - 200}ms linear` : 'none',
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
