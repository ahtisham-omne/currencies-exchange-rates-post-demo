import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  CheckCircle2,
  Package,
  Ban,
  FileText,
  Archive,
  Check,
} from 'lucide-react';
import type { QuoteLifecycleStatus } from './ModernStatusStepper';

/* ══════════════════════════════════════════════════════════════════
 *  Public types — unchanged for backward-compatibility
 * ══════════════════════════════════════════════════════════════════ */
export interface CustomActionConfig {
  processing: string;
  done: string;
  icon: typeof Send;
  accentColor: string;
  accentBg: string;
  ringColor: string;
  isNegative?: boolean;
}

interface StatusTransitionOverlayProps {
  isActive: boolean;
  fromStatus: QuoteLifecycleStatus;
  toStatus: QuoteLifecycleStatus;
  onComplete: () => void;
  customAction?: CustomActionConfig | null;
}

/* ── Status visual map ── */
interface StatusVisual {
  icon: typeof Send;
  color: string;
  bg: string;
  bgOverlay: string;
  label: string;
}

function getStatusVisual(status: QuoteLifecycleStatus): StatusVisual {
  switch (status) {
    case 'draft':     return { icon: FileText,     color: '#4B5563', bg: '#F3F4F6', bgOverlay: 'rgba(107,114,128,0.06)', label: 'Draft' };
    case 'sent':      return { icon: Send,         color: '#2563EB', bg: '#DBEAFE', bgOverlay: 'rgba(59,130,246,0.08)', label: 'Sent to Customer' };
    case 'confirmed': return { icon: CheckCircle2, color: '#0D9488', bg: '#CCFBF1', bgOverlay: 'rgba(13,148,136,0.08)', label: 'Confirmed' };
    case 'converted': return { icon: Package,      color: '#059669', bg: '#D1FAE5', bgOverlay: 'rgba(5,150,105,0.08)', label: 'Sales Order Created' };
    case 'cancelled': return { icon: Ban,          color: '#DC2626', bg: '#FEE2E2', bgOverlay: 'rgba(220,38,38,0.06)', label: 'Cancelled' };
    case 'archived':  return { icon: Archive,      color: '#DC2626', bg: '#FEE2E2', bgOverlay: 'rgba(220,38,38,0.06)', label: 'Archived' };
    case 'expired':   return { icon: Ban,          color: '#DC2626', bg: '#FEE2E2', bgOverlay: 'rgba(220,38,38,0.06)', label: 'Expired' };
    default:          return { icon: FileText,     color: '#374151', bg: '#F3F4F6', bgOverlay: 'rgba(55,65,81,0.05)', label: 'Unknown' };
  }
}

/* ══════════════════════════════════════════════════════════════════
 *  Animated Status Transition Overlay
 *
 *  Full-screen tinted overlay with centered icon animation:
 *  1. Backdrop fades in with target status color tint
 *  2. Icon scales up from center with expanding ring pulse
 *  3. Status label fades in below icon
 *  4. Brief hold, then everything fades out
 *  Total: ~1.1s
 * ══════════════════════════════════════════════════════════════════ */
export function StatusTransitionOverlay({
  isActive,
  fromStatus,
  toStatus,
  onComplete,
  customAction,
}: StatusTransitionOverlayProps) {
  const [visible, setVisible] = useState(false);

  const to: StatusVisual = customAction
    ? { icon: customAction.icon, color: customAction.accentColor, bg: customAction.accentBg, bgOverlay: `${customAction.accentColor}12`, label: customAction.done }
    : getStatusVisual(toStatus);

  const ToIcon = to.icon;
  const isNegative = customAction?.isNegative || toStatus === 'cancelled' || toStatus === 'archived';

  const stableOnComplete = useCallback(() => { onComplete(); }, [onComplete]);

  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    setVisible(true);
    // Hold visible for 900ms, then fade out
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(stableOnComplete, 250);
    }, 900);
    return () => clearTimeout(timer);
  }, [isActive, stableOnComplete]);

  const overlay = (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="status-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
            pointerEvents: 'all',
          }}
        >
          {/* Tinted backdrop with subtle blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: to.bgOverlay,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Centered animation container */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {/* Expanding ring pulse */}
            <div style={{ position: 'relative', width: '72px', height: '72px' }}>
              {/* Outer ring pulse */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.6, 1.8], opacity: [0, 0.3, 0] }}
                transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.5, 1] }}
                style={{
                  position: 'absolute',
                  inset: '-8px',
                  borderRadius: '50%',
                  border: `2px solid ${to.color}`,
                }}
              />
              {/* Inner ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.2, 1.35], opacity: [0, 0.2, 0] }}
                transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut', times: [0, 0.5, 1] }}
                style={{
                  position: 'absolute',
                  inset: '0',
                  borderRadius: '50%',
                  border: `2px solid ${to.color}`,
                }}
              />

              {/* Icon circle */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: to.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 0 4px ${to.color}18, 0 8px 32px ${to.color}20`,
                }}
              >
                {/* Checkmark or status icon — animated stroke for positive transitions */}
                {!isNegative ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                  >
                    <Check
                      style={{ width: '32px', height: '32px', color: to.color }}
                      strokeWidth={2.5}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                  >
                    <ToIcon
                      style={{ width: '30px', height: '30px', color: to.color }}
                    />
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Status label */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3, ease: 'easeOut' }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: to.color,
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                }}
              >
                {to.label}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}