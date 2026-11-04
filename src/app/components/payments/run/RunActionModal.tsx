import { useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { PaymentRun } from '@/app/data/paymentRuns';
import { RunStatusPill, humanDate } from './runUi';

/* ── Run action modal (8/4/26 restructure) ───────────────────────────
 * The thin overlay shell the run DETAIL PAGE opens for its lifecycle
 * actions (Review & approve, Execute run), the same shell recipe as
 * PaymentRunScreen / RecordPaymentFlow: dimmed backdrop, rounded
 * workspace, slim header, slate stage canvas. The hosted stage keeps
 * its own footer (RUN_FOOTER_SHELL escapes the canvas padding). The
 * caller renders this only while the run is in the matching status, so
 * a successful approve / reject / execute closes it by re-render. */

export function RunActionModal({
  run,
  title,
  icon,
  onClose,
  flush,
  subtitle,
  stepper,
  children,
}: {
  run: PaymentRun;
  title: string;
  icon: ReactNode;
  onClose: () => void;
  /** Edge-to-edge body (8/5/26): white, no canvas padding — the hosted
   *  stage runs flush like the authoring modal's step 1. */
  flush?: boolean;
  /** Overrides the default "id · Pays on date" helper line. */
  subtitle?: string;
  /** Step tabs under the title (user 10/15): the authoring modal's
   *  header recipe, pt + flush bottom so the underline sits on the rule. */
  stepper?: ReactNode;
  children: ReactNode;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? 'w-full h-full max-w-full max-h-full sm:max-w-[calc(100vw-1.5rem)] lg:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-1.5rem)] lg:max-h-[calc(100vh-2rem)] rounded-none sm:rounded-2xl'
            : 'w-full sm:w-[calc(100%-2rem)] sm:max-w-[1430px] h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl'
        }`}
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
      >
        {/* ── Header ── */}
        <div className={`px-3 sm:px-4 lg:px-5 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-slate-100 ${stepper ? 'pt-3 sm:pt-4 pb-0' : 'py-3 sm:py-3.5'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] sm:text-[18px] text-foreground truncate" style={{ fontWeight: 700 }}>
                  {title}
                </h2>
                <RunStatusPill status={run.status} />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {subtitle ?? `${run.id} · Pays on ${humanDate(run.paymentDate)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? 'Exit Full' : 'Full View'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {stepper}
        </div>

        {/* ── Stage canvas — padded slate by default (the stages'
            shell-flush footers escape it with negative margins), or
            edge-to-edge white when flush. ── */}
        <div
          className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
            flush ? 'bg-white' : 'bg-slate-50 px-3 sm:px-5 pt-3.5 pb-3.5'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
