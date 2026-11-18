import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/app/components/ui/alert-dialog';

/**
 * The module's confirmation frame, factored out of
 * `RMAVersionRevertModal.tsx` so every return-side confirm reads the same:
 * a tinted glow behind a rounded icon, a pill naming the step, centered copy
 * and stacked full-width buttons with the confirm on top.
 *
 * Inline styles rather than utility classes, matching the revert modal: this
 * sits above other dialogs, where tailwind-merge has dropped layout classes
 * when the shadcn defaults are overridden.
 */

/* Kills shadcn's translate-50% centering and re-centers inline. */
const positioningStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  right: 'auto',
  bottom: 'auto',
  translate: 'none',
  transform: 'translate(-50%, -50%)',
  margin: 0,
  width: 'calc(100% - 2rem)',
  height: 'auto',
  maxWidth: 440,
  maxHeight: 'calc(100dvh - 2rem)',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
  zIndex: 14000,
};

/** `neutral` is for putting something away rather than undoing it: stone,
 *  the Archived status's own colour, so the dialog reads as the state the
 *  return is about to take. */
type Tone = 'destructive' | 'warning' | 'neutral';

const TONES: Record<Tone, {
  glow: string;
  wash: string;
  iconBg: string;
  icon: string;
  pillText: string;
  confirmBg: string;
}> = {
  destructive: {
    glow: '#EF4444',
    wash: '#FEF2F2',
    iconBg: '#FEE2E2',
    icon: 'hsl(var(--destructive))',
    pillText: '#991B1B',
    confirmBg: 'hsl(var(--destructive))',
  },
  neutral: {
    glow: '#78716C',
    wash: '#F5F5F4',
    iconBg: '#E7E5E4',
    icon: '#57534E',
    pillText: '#44403C',
    confirmBg: '#44403C',
  },
  warning: {
    glow: '#F59E0B',
    wash: '#FFFBEB',
    iconBg: '#FEF3C7',
    icon: '#D97706',
    pillText: '#92400E',
    confirmBg: '#D97706',
  },
};

export default function RMAConfirmModal({
  open,
  onOpenChange,
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: Tone;
  icon: LucideIcon;
  /** The pill above the title, naming the step in a couple of words. */
  eyebrow: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}) {
  const t = TONES[tone];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="p-0 gap-0 overflow-hidden border-0" style={positioningStyle}>
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background: `linear-gradient(180deg, ${t.wash} 0%, ${t.wash}4D 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[50px] opacity-25"
            style={{ width: 180, height: 80, backgroundColor: t.glow }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.iconBg }}
          >
            <Icon style={{ width: 32, height: 32, color: t.icon }} />
          </div>
          <span
            className="mt-4 rounded-full"
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: t.pillText,
              backgroundColor: t.wash,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {eyebrow}
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle
              className="tracking-[-0.02em]"
              style={{ fontSize: 18, fontWeight: 600, color: '#0F172A' }}
            >
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="mt-2 mx-auto"
            style={{ fontSize: 13, color: '#64748B', lineHeight: 1.65, maxWidth: 320 }}
          >
            {description}
          </AlertDialogDescription>

          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full transition-all hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 0,
                backgroundColor: t.confirmBg,
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full transition-colors hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 12,
                border: 0,
                backgroundColor: '#F1F5F9',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
