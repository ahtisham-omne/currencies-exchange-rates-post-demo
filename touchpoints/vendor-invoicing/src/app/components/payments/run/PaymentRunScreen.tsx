import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ListChecks, Maximize2, Minimize2, X } from 'lucide-react';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import type { PaymentRun } from '@/app/data/paymentRuns';
import type { PaymentRunsApi } from '@/app/hooks/usePaymentRuns';
import { palette } from '@/styles/tokens';
import { RunStageRail, stageForRun, type RunStageId } from './RunStageRail';
import { RunSetupStage } from './RunSetupStage';
import { RunProposalStage } from './RunProposalStage';
import { humanDate } from './runUi';

/* ── Payment run modal (8/4/26 restructure) ──────────────────────────
 * A TWO-STEP authoring modal for Draft runs only: Select invoices →
 * Configure, in the exact overlay shell the other flow modals use
 * (RecordPaymentFlow). Submitting hands the run to its DETAIL PAGE
 * (/payments-v2/runs/:runId renders RunDetailScreen for every
 * non-Draft status), where approval, execution, and print & complete
 * live, mirroring the payments module.
 *
 * Header back button on Configure asks (amber "Go back?" recipe) and
 * returns to step 1; closing an uncommitted draft with ticked invoices
 * asks with the amber Discard recipe (both verbatim from the Record
 * Payment flow). */

export interface PaymentRunScreenProps {
  run: PaymentRun;
  invoices: Invoice[];
  payments: Payment[];
  runsApi: PaymentRunsApi;
  /** Back to where the flow started. */
  onClose: () => void;
  onViewInvoice: (invoiceId: string) => void;
  onViewPayment: (payment: Payment) => void;
}

export function PaymentRunScreen({
  run,
  invoices,
  payments,
  runsApi,
  onClose,
}: PaymentRunScreenProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [goBackOpen, setGoBackOpen] = useState(false);

  // Background scroll LOCK while the modal is open (8/28/26): this is a
  // hand-rolled overlay (no Radix Dialog), and the app's main content
  // scrolls in a Layout div the overlay sits inside — so a wheel over
  // non-scrolling modal chrome, or an inner scroller that can't take the
  // delta, chained through and scrolled the listing underneath. A native
  // non-passive wheel guard on the overlay swallows exactly those events
  // (React's onWheel registers passive, so preventDefault needs this).
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const onWheel = (e: WheelEvent) => {
      let node = e.target as HTMLElement | null;
      while (node && node !== overlay) {
        const cs = getComputedStyle(node);
        if (e.deltaY !== 0 && /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight) {
          const atTop = node.scrollTop <= 0 && e.deltaY < 0;
          const atBottom = Math.ceil(node.scrollTop + node.clientHeight) >= node.scrollHeight && e.deltaY > 0;
          if (!atTop && !atBottom) return; // an inner scroller consumes it
        }
        if (e.deltaX !== 0 && /(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth) {
          const atLeft = node.scrollLeft <= 0 && e.deltaX < 0;
          const atRight = Math.ceil(node.scrollLeft + node.clientWidth) >= node.scrollWidth && e.deltaX > 0;
          if (!atLeft && !atRight) return;
        }
        node = node.parentElement;
      }
      e.preventDefault(); // nothing inside can take it — never the page behind
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, []);

  // No local stage state: continueToProposal / submit mutate the run,
  // and the view follows it.
  const active: RunStageId = stageForRun(run);

  // Close guard: there is NO draft state (feedback 8/5/26), so closing
  // always discards the run — once invoices are ticked it asks first,
  // the Record Payment unsaved-selections guard. A changes-requested
  // run reopened for resolve-and-resubmit closes silently: App returns
  // it to Changes requested, nothing is lost.
  const isReopenedRejected = (!!run.changeRequest && !run.changeRequest.resolvedAt) || !!run.submittedAt;
  const requestClose = () => {
    if (!isReopenedRejected && run.lines.length > 0) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  // Header back: on Configure it returns to step 1 (after the amber
  // "Go back?" ask), never closes the modal (feedback 8/4/26).
  const requestBack = () => {
    if (active === 'proposal') {
      setGoBackOpen(true);
      return;
    }
    requestClose();
  };

  const goToStage = (stage: RunStageId) => {
    if (run.status !== 'Draft') return;
    if (stage === 'setup' || stage === 'proposal') {
      runsApi.updateRun(run.id, { stage });
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6">
      {/* Backdrop — the listing stays visible behind, like every flow. */}
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />

      {/* Shell — same sizing + full-view transition as RecordPaymentFlow. */}
      <div
        className={`relative bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? 'w-full h-full max-w-full max-h-full sm:max-w-[calc(100vw-1.5rem)] lg:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-1.5rem)] lg:max-h-[calc(100vh-2rem)] rounded-none sm:rounded-2xl'
            : 'w-full sm:w-[calc(100%-2rem)] sm:max-w-[1430px] h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl'
        }`}
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
      >
        {/* ── Header ── */}
        <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={requestBack}
                className="w-10 h-10 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                aria-label={active === 'proposal' ? 'Back to select invoices' : 'Close'}
                title={active === 'proposal' ? 'Back to select invoices' : 'Close'}
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: palette.blue[50], color: palette.blue[700] }}
              >
                <ListChecks className="w-5 h-5" />
              </div>
              {/* Creation-flow identity (feedback 8/4/26, the Create-invoice
                  header recipe): a task heading + helper copy that says what
                  this step does; the run id rides the helper line. */}
              <div className="min-w-0">
                {/* No status pill (8/5/26): a run being authored has no
                    draft state, it simply doesn't exist yet. */}
                {/* Per-step task heading (BA 8/12/26): the header names
                    what THIS screen does, in create and edit alike; the
                    run id + helper line carry the flow identity. */}
                <h2 className="text-[16px] sm:text-[18px] text-foreground truncate" style={{ fontWeight: 700 }}>
                  {active === 'setup' ? 'Select Invoices for This Payment Run' : 'Configure Payments for This Run'}
                </h2>
                {/* No run id in the helper line (8/28/26 review): codes
                    never ride helper copy, and nothing is generated until
                    the run is submitted anyway. */}
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                  {active === 'setup'
                    ? `Pick the approved invoices to pay. Each vendor's invoices group into one payment. Pays on ${humanDate(run.paymentDate)}.`
                    : 'Review each vendor’s payment, method, and pay-from account, then submit for approval.'}
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
                onClick={requestClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step tabs — the two-step stepper, same recipe as the other flows. */}
          <RunStageRail run={run} active={active} onNavigate={goToStage} />
        </div>

        {/* ── Stage body ── Step 1 runs flush against the shell (no inner
            card, like the Record Payment step 1); Configure keeps the
            padded slate canvas for its card composition. */}
        <div
          className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
            active === 'setup' ? 'bg-white' : 'bg-slate-50 px-3 sm:px-5 pt-3.5 pb-3.5'
          }`}
        >
          {active === 'setup' && (
            <RunSetupStage run={run} invoices={invoices} runsApi={runsApi} onCancel={requestClose} />
          )}
          {active !== 'setup' && (
            <RunProposalStage
              run={run}
              invoices={invoices}
              payments={payments}
              runsApi={runsApi}
              onDeleted={onClose}
            />
          )}
        </div>
      </div>

      {/* ── Go back? — amber alert (Record Payment recipe): returning to
          step 1 keeps every selection; it just re-opens the query. ── */}
      {goBackOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setGoBackOpen(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}>
                Go Back
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Go back to select invoices?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                You'll return to invoice selection. Your selections and payment configuration are kept.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setGoBackOpen(false);
                    goToStage('setup');
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => setGoBackOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Discard confirmation — amber Record Payment discard recipe.
          Only reachable from an uncommitted draft with ticked invoices. ── */}
      {discardOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setDiscardOpen(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}>
                Discard
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Discard this payment run?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                The selected invoices will be released back to the payable pool. This action cannot be undone.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDiscardOpen(false);
                    onClose();
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
