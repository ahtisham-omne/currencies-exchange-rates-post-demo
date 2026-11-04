/* ── Outside-click discard guard (user 9/22) ───────────────────────────
 * The flow-modal interaction standard: clicking outside a PRISTINE modal
 * closes it silently; once the user has selected or typed anything, the
 * outside click raises this small amber warning instead — nothing typed
 * is ever lost to a stray click. Wire it via DialogContent's
 * onInteractOutside: prevent the default close when dirty and open this.
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

export function DiscardConfirm({
  open,
  onKeepEditing,
  onDiscard,
  what = 'this form',
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  /** Named thing being discarded, e.g. "this credit memo". */
  what?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onKeepEditing(); }}>
      <AlertDialogContent
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[400px]"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 260 }}
      >
        <div
          className="relative flex flex-col items-center pt-7 pb-4 shrink-0"
          style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }} />
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <AlertTriangle className="w-6 h-6" style={{ color: '#B45309', strokeWidth: 2 }} />
          </div>
        </div>
        <div className="flex flex-col items-center text-center px-6 pb-6">
          <AlertDialogTitle className="text-[17px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>
            Discard what you entered?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
            You started filling in {what}. Closing now loses it.
          </AlertDialogDescription>
          <div className="w-full mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onKeepEditing}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
              style={{ fontWeight: 600, backgroundColor: '#B45309' }}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="w-full h-10 text-[13px] rounded-xl border border-border bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              style={{ fontWeight: 500 }}
            >
              Discard
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
