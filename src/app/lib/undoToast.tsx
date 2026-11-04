import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, X } from 'lucide-react';

/* Undo toast — the destructive-action companion to the Omne toast design.
 * White card with the red gradient wash (same family as the Discard modal),
 * a solid icon circle, title + description, an Undo action with a live
 * "60s" countdown, and a thin progress bar draining along the bottom edge.
 * The action commits when the timer runs out or the toast is dismissed;
 * clicking Undo runs the caller's revert and closes the toast. */

interface UndoToastOptions {
  title: string;
  description?: string;
  /** Revert callback, runs when the user clicks Undo within the window. */
  onUndo: () => void;
  /** Undo window in ms. Defaults to 60 seconds. */
  duration?: number;
}

function UndoToastCard({
  toastId,
  title,
  description,
  onUndo,
  duration,
}: UndoToastOptions & { toastId: string | number; duration: number }) {
  const total = Math.round(duration / 1000);
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    const iv = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (remaining <= 0) toast.dismiss(toastId);
  }, [remaining, toastId]);

  return (
    <div className="relative w-[356px] overflow-hidden rounded-2xl border border-black/5 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25)] toast-grad-error">
      <div className="flex items-start gap-2.5 px-3.5 py-3 pr-8">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 mt-px" style={{ backgroundColor: 'hsl(var(--destructive))', boxShadow: '0 0 0 4px rgba(220, 40, 40, 0.13)' }}>
          <RotateCcw className="w-3 h-3" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{title}</p>
          {description && (
            <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{description}</p>
          )}
          <div className="mt-2 flex items-baseline gap-2">
            <button
              type="button"
              onClick={() => { onUndo(); toast.dismiss(toastId); }}
              className="text-[12px] text-primary hover:text-blue-700 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Undo
            </button>
            <span className="text-[11px] text-slate-400 " style={{ fontWeight: 500 }}>{Math.max(0, remaining)}s</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Countdown drain — 1s linear steps so it tracks the seconds label. */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{ width: `${(Math.max(0, remaining) / total) * 100}%`, backgroundColor: 'hsl(var(--destructive))' }}
        />
      </div>
    </div>
  );
}

export function showUndoToast({ title, description, onUndo, duration = 60_000 }: UndoToastOptions) {
  return toast.custom(
    (tid) => (
      <UndoToastCard toastId={tid} title={title} description={description} onUndo={onUndo} duration={duration} />
    ),
    { duration },
  );
}
