import type { ComponentType, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

/* Destructive confirm in the modal design language (user 10/10): the
 * remove-item recipe — red glow hero, icon tile, action pill, title,
 * one-line body, full-width stacked CTAs (red action, slate escape). */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  pill,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  pill: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-[400px] p-0 overflow-hidden gap-0 rounded-2xl border-0"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
            <Icon className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
            {pill}
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogTitle className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
            {description}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <AlertDialogAction
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
            >
              {confirmLabel}
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
              style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
            >
              {cancelLabel}
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
