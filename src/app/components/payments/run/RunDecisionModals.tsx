import { CheckCircle2, PencilLine, RotateCcw } from 'lucide-react';
import type { PaymentRun } from '@/app/data/paymentRuns';
import { liveLines } from '@/app/data/paymentRuns';
import { groupNet } from '@/app/lib/runMath';
import { money } from './runUi';

/* ── Approve run confirmation (8/4/26) ───────────────────────────────
 * The one lifecycle decision with no reason to collect: a gradient-hero
 * heads-up in the emerald identity. Reject, hold, and cancel use the
 * invoice module's reason dialog instead (InvoiceReasonDialog + the
 * overrides in runReasonConfigs.ts), so every reason-required modal in
 * the system is the same component. */

export function ApproveRunModal({
  run,
  open,
  onClose,
  onConfirm,
}: {
  run: PaymentRun;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const lines = liveLines(run);
  const total = run.groups.reduce((s, g) => s + groupNet(run, g), 0);
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient hero — emerald tint, blur glow, icon tile, tone pill. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: '#059669', filter: 'blur(50px)' }}
          />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#047857', strokeWidth: 2 }} />
          </div>
          {/* Badge removed (user 9/23): the title says it. */}
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Approve this payment run?
          </h3>
          {/* User copy 9/23. */}
          <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '320px' }}>
            Once approved, <span className="text-foreground" style={{ fontWeight: 600 }}>{money(total)}</span> to {run.groups.length} vendor{run.groups.length === 1 ? '' : 's'} will be ready to pay. Nothing posts until payments are recorded.
          </p>
          {/* Separation-of-duties note removed (user 9/25): the confirm
              keeps just the outcome sentence. */}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: '#059669', color: '#fff' }}
            >
              Approve Payment Run
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Keep Pending
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resolve-and-resubmit heads-up (8/5/26): a changes-requested run
 *  reopens for editing, then goes back to the approval queue. */
export function ResubmitRunModal({
  run,
  open,
  onClose,
  onConfirm,
}: {
  run: PaymentRun;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient hero — emerald resubmit identity. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: '#059669', filter: 'blur(50px)' }}
          />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <RotateCcw className="w-8 h-8" style={{ color: '#047857', strokeWidth: 2 }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857',  }}
          >
            Resubmit
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Resolve and resubmit this payment run?
          </h3>
          <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
            <span className="text-foreground" style={{ fontWeight: 600 }}>{run.id}</span> reopens for editing so you can finish the {run.changeRequest ? `${run.changeRequest.issues.length} issue${run.changeRequest.issues.length === 1 ? '' : 's'} ${run.changeRequest.by} flagged` : 'flagged issues'}. Submitting sends it back to the approval queue.
          </p>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: '#059669', color: '#fff' }}
            >
              Resolve and Resubmit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Return an approved run to Pending approval (8/5/26): unlike an
 *  invoice posting, the run is recordation, so pre-execution edits are
 *  acceptable. This avoids recreating the whole run when the bank
 *  account or method needs to change after approval. */
export function ReturnToPendingModal({
  run,
  open,
  onClose,
  onConfirm,
}: {
  run: PaymentRun;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }}
          />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FDE68A' }}>
            <RotateCcw className="w-8 h-8" style={{ color: '#B45309', strokeWidth: 2 }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#B45309',  }}
          >
            Return to Pending
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Return this run to Pending Approval?
          </h3>
          <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
            Approval comes off <span className="text-foreground" style={{ fontWeight: 600 }}>{run.id}</span> and it returns to the approval queue. Payment methods and pay-from accounts can then change. Nothing has posted.
          </p>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: '#B45309', color: '#fff' }}
            >
              Return to Pending Approval
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Keep It Approved
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit a pending run (8/5/26, "Edit" in the Actions menu since
 *  8/11/26): it leaves the approval queue and reopens in the authoring
 *  modal; closing without resubmitting returns it to Pending approval
 *  untouched. */
export function WithdrawRunModal({
  run,
  open,
  onClose,
  onConfirm,
}: {
  run: PaymentRun;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)' }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: '#1D4ED8', filter: 'blur(50px)' }}
          />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
            <PencilLine className="w-8 h-8" style={{ color: '#1D4ED8', strokeWidth: 2 }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8',  }}
          >
            Edit Run
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Edit this payment run?
          </h3>
          {/* BA copy 8/11/26. */}
          <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
            This pulls <span className="text-foreground" style={{ fontWeight: 600 }}>{run.id}</span> out of the approval queue so you can edit it. Resubmit when you're done. If you close without resubmitting, it goes back to Pending Approval as it was.
          </p>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: '#1D4ED8', color: '#fff' }}
            >
              Edit Payment Run
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            >
              Keep It Pending
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
