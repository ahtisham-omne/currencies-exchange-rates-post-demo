import { Fragment } from 'react';
import { Check } from 'lucide-react';
import type { PaymentRun } from '@/app/data/paymentRuns';

/* ── Run stage stepper ───────────────────────────────────────────────
 * Two authoring steps only (8/4/26 restructure): Select invoices →
 * Configure, in the exact numbered-circle + underline recipe the other
 * flow modals use (RecordPaymentFlow's step tabs). Everything after
 * submit (approval, execution, print & complete) lives on the payment
 * run DETAIL PAGE, so the modal stepper stops at Configure. Draft runs
 * can hop between the two steps. */

export type RunStageId = 'setup' | 'proposal' | 'approval' | 'execute' | 'print';

export const RUN_STAGES: { id: RunStageId; label: string }[] = [
  { id: 'setup', label: 'Select Invoices' },
  { id: 'proposal', label: 'Configure Payments' },
];

/** The stage a run resumes at, straight from its status. */
export function stageForRun(run: PaymentRun): RunStageId {
  switch (run.status) {
    case 'Draft':
      return run.stage === 'setup' ? 'setup' : 'proposal';
    case 'Pending Approval':
      return 'approval';
    case 'Approved':
      return 'execute';
    default:
      return 'print';
  }
}

export function RunStageRail({
  run,
  active,
  onNavigate,
}: {
  run: PaymentRun;
  active: RunStageId;
  /** Draft-only hop between Parameters and Proposal. */
  onNavigate?: (stage: RunStageId) => void;
}) {
  const activeIdx = RUN_STAGES.findIndex((s) => s.id === active);
  const isDraft = run.status === 'Draft';
  const hasProposal = run.lines.length > 0;

  return (
    <div className="flex items-center justify-between gap-3 mt-3 sm:mt-3.5 -mb-px">
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
        {RUN_STAGES.map((stage, i) => {
          const completed = i < activeIdx;
          const current = i === activeIdx;
          const clickable =
            isDraft &&
            stage.id !== active &&
            (stage.id === 'setup' || (stage.id === 'proposal' && hasProposal));
          return (
            <Fragment key={stage.id}>
              <div
                className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => clickable && onNavigate?.(stage.id)}
              >
                <div
                  className="w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200"
                  style={
                    completed
                      ? { backgroundColor: 'hsl(var(--success))', color: '#fff', fontWeight: 600 }
                      : current
                        ? { backgroundColor: 'hsl(var(--primary))', color: '#fff', fontWeight: 600 }
                        : { border: '1.5px solid var(--color-slate-300)', color: 'var(--color-slate-500)', backgroundColor: '#fff', fontWeight: 600 }
                  }
                >
                  {completed ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span
                  className="text-[12px] sm:text-[13px] whitespace-nowrap transition-colors"
                  style={{
                    color: completed ? 'hsl(var(--success))' : current ? 'hsl(var(--primary))' : 'var(--color-slate-700)',
                    fontWeight: current || completed ? 600 : 500,
                  }}
                >
                  {stage.label}
                </span>
                {(current || completed) && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                    style={{ backgroundColor: completed ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}
                  />
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** The same numbered-circle + underline step tabs for any modal flow
 *  (user 10/15: the record-payments modal must use THIS stepper, not
 *  its own pill strip). `completed` marks finished steps green. */
export function FlowStepTabs({
  steps,
  active,
  onNavigate,
}: {
  steps: { id: string; label: string; completed?: boolean }[];
  active: string;
  onNavigate?: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto mt-3 sm:mt-3.5 -mb-px">
      {steps.map((step, i) => {
        const current = step.id === active;
        const completed = !current && !!step.completed;
        const clickable = !current && !!onNavigate;
        return (
          <div
            key={step.id}
            className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => clickable && onNavigate?.(step.id)}
          >
            <div
              className="w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200"
              style={
                completed
                  ? { backgroundColor: 'hsl(var(--success))', color: '#fff', fontWeight: 600 }
                  : current
                    ? { backgroundColor: 'hsl(var(--primary))', color: '#fff', fontWeight: 600 }
                    : { border: '1.5px solid var(--color-slate-300)', color: 'var(--color-slate-500)', backgroundColor: '#fff', fontWeight: 600 }
              }
            >
              {completed ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className="text-[12px] sm:text-[13px] whitespace-nowrap transition-colors"
              style={{
                color: completed ? 'hsl(var(--success))' : current ? 'hsl(var(--primary))' : 'var(--color-slate-700)',
                fontWeight: current || completed ? 600 : 500,
              }}
            >
              {step.label}
            </span>
            {(current || completed) && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                style={{ backgroundColor: completed ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
