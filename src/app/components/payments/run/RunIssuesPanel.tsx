import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FilePen,
  ListChecks,
  Plus,
  X,
} from 'lucide-react';
import { liveLines, type PaymentRun, type RunIssue } from '@/app/data/paymentRuns';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';

/* ── The change-request issues surface (8/5/26) ──────────────────────
 * One component, two homes: the detail page (variant 'detail', replaces
 * the old rejected strip) and the reopened authoring modal (variant
 * 'proposal', the checklist that gates resubmission). Each issue offers
 * the three fates: fixed in this run, moved to another run, or released
 * back to the invoice list. */

const OUTCOME_CHIP: Record<string, { label: (iss: RunIssue) => string; bg: string; color: string; border: string }> = {
  fixed: { label: () => 'Fixed', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  moved: { label: (iss) => `Moved to ${iss.resolution?.movedToRunId ?? 'Another Run'}`, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  released: { label: () => 'Released', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
};

export function RunIssuesPanel({
  run,
  variant,
  readOnly,
  onResolveFixed,
  onReopen,
  onRelease,
  onMove,
  onJumpToVendor,
  onResubmit,
  onOpenRun,
}: {
  run: PaymentRun; // caller guarantees run.changeRequest
  variant: 'detail' | 'proposal';
  readOnly?: boolean;
  onResolveFixed: (issueId: string) => void;
  onReopen: (issueId: string) => void;
  onRelease: (issueId: string) => void;
  onMove: (issueId: string) => void;
  /** Proposal variant: jump to the flagged line's vendor card. */
  onJumpToVendor?: (vendor: string) => void;
  /** Detail variant: the Resolve and resubmit CTA. */
  onResubmit?: () => void;
  /** Open the run a line moved to. */
  onOpenRun?: (runId: string) => void;
}) {
  const cr = run.changeRequest;
  if (!cr) return null;
  const resolved = cr.issues.filter((i) => i.resolution).length;
  const total = cr.issues.length;
  const allResolved = resolved === total;
  const assignees = [...new Set(cr.issues.flatMap((i) => i.assignees))];
  const emptied = liveLines(run).length === 0;
  const compact = variant === 'proposal';

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${compact ? 'shrink-0' : ''}`}
      style={{ borderColor: '#FED7AA' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white border" style={{ borderColor: '#FED7AA' }}>
          <FilePen className="w-4 h-4" style={{ color: '#C2410C' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
            Changes Requested by {cr.by}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11.5px] text-slate-500">Assigned To</span>
            <span className="inline-flex items-center gap-1">
              {assignees.map((name) => (
                <Tooltip key={name}>
                  <TooltipTrigger asChild>
                    <span><PhotoPersonAvatar name={name} size="sm" /></span>
                  </TooltipTrigger>
                  <TooltipContent className="z-[300]">{name}</TooltipContent>
                </Tooltip>
              ))}
            </span>
            <span className="text-[11.5px] text-slate-500 truncate">
              {assignees.length === 1 ? assignees[0] : `${assignees.length} people`}
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border shrink-0 "
          style={
            allResolved
              ? { fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
              : { fontWeight: 600, backgroundColor: '#FFFFFF', color: '#C2410C', borderColor: '#FED7AA' }
          }
        >
          {allResolved && <Check className="w-3 h-3" />}
          {resolved} of {total} Issue{total === 1 ? '' : 's'} Addressed
        </span>
      </div>

      {/* Issue rows */}
      <div className="divide-y divide-slate-100">
        {cr.issues.map((issue) => {
          const lineScoped = !!issue.invoiceId;
          const lineStillHere = lineScoped && liveLines(run).some((l) => l.invoiceId === issue.invoiceId);
          const chip = issue.resolution ? OUTCOME_CHIP[issue.resolution.outcome] : null;
          return (
            <div key={issue.id} className="px-4 py-2.5 flex items-center gap-3">
              <span
                className="inline-flex items-center px-1.5 py-px rounded text-[10.5px] shrink-0 border"
                style={
                  lineScoped
                    ? { fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                    : { fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' }
                }
              >
                {lineScoped ? issue.invoiceNumber : 'Run'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-foreground leading-snug" style={{ fontWeight: 600 }}>
                  {issue.reason}
                  {issue.vendor && <span className="text-slate-400 ml-1.5" style={{ fontWeight: 400 }}>{issue.vendor}</span>}
                </p>
                {issue.note && <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{issue.note}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {compact && lineScoped && lineStillHere && issue.vendor && (
                  <button
                    type="button"
                    onClick={() => onJumpToVendor?.(issue.vendor!)}
                    className="inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline px-1.5 py-1 rounded-md cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Show in Run
                  </button>
                )}
                {chip && issue.resolution ? (
                  <>
                    {issue.resolution.outcome === 'moved' && issue.resolution.movedToRunId && onOpenRun ? (
                      <button
                        type="button"
                        onClick={() => onOpenRun(issue.resolution!.movedToRunId!)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] border cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ fontWeight: 600, backgroundColor: chip.bg, color: chip.color, borderColor: chip.border }}
                      >
                        {chip.label(issue)}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border"
                        style={{ fontWeight: 600, backgroundColor: chip.bg, color: chip.color, borderColor: chip.border }}
                      >
                        {chip.label(issue)}
                      </span>
                    )}
                  </>
                ) : readOnly ? (
                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Open</span>
                ) : (
                  // One resolve pattern everywhere (user 9/25): no dropdown,
                  // no three-fate menu — a single "Resolve" CTA next to the
                  // issue, styled like the invoice exception's "Resolve
                  // exception" button. On the detail page it opens the run
                  // for editing; inside the reopened run it marks the issue
                  // fixed. Fates like move / release live on the run's own
                  // invoice rows, not here.
                  <button
                    type="button"
                    onClick={() => (compact ? onResolveFixed(issue.id) : onResubmit?.())}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border bg-white text-[12px] transition-colors cursor-pointer shadow-sm hover:bg-orange-50 hover:border-orange-300"
                    style={{ fontWeight: 600, color: '#C2410C', borderColor: '#FED7AA' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — guidance only (user 10/5): the green "Resolve and
          resubmit" button duplicated the per-issue Resolve buttons above
          (both open the run for editing), so ONE resolve entry point
          remains — the row's. */}
      {variant === 'detail' && !readOnly && (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11.5px] text-slate-500 min-w-0" style={{ fontWeight: 500 }}>
            {emptied
              ? 'Every invoice left the run. Cancel it to close the loop.'
              : 'Resolve opens the run for editing; address the flagged issues there and resubmit.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Move a flagged line to another run ──────────────────────────────
 * Small picker: existing open Drafts (rare, drafts are modal-scoped)
 * plus the primary "New payment run" row. */
export function MoveLineModal({
  open,
  issue,
  runs,
  sourceRunId,
  onClose,
  onMove,
}: {
  open: boolean;
  issue: RunIssue | null;
  runs: PaymentRun[];
  sourceRunId: string;
  onClose: () => void;
  onMove: (target: { runId: string } | { newRun: true }) => void;
}) {
  const [choice, setChoice] = useState<string>('new');
  if (!open || !issue) return null;
  const drafts = runs.filter((r) => r.status === 'Draft' && r.id !== sourceRunId);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                Move {issue.invoiceNumber} to Another Run
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                The invoice leaves this run; its lock follows it to the destination.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2">
          <button
            onClick={() => setChoice('new')}
            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-left transition-colors ${choice === 'new' ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
          >
            <span className="w-7 h-7 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Plus className="w-3.5 h-3.5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] ${choice === 'new' ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                New Payment Run
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Starts a fresh run seeded with this invoice.</p>
            </div>
            {choice === 'new' && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </button>
          {drafts.map((r) => (
            <button
              key={r.id}
              onClick={() => setChoice(r.id)}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-left transition-colors ${choice === r.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <ListChecks className="w-3.5 h-3.5 text-slate-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[12.5px] ${choice === r.id ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                  {r.id}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Draft · {liveLines(r).length} invoice{liveLines(r).length === 1 ? '' : 's'}
                </p>
              </div>
              {choice === r.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors"
            style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onMove(choice === 'new' ? { newRun: true } : { runId: choice })}
            className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md px-4 text-[12px] text-white bg-primary hover:bg-[#0862D0] cursor-pointer transition-colors"
            style={{ fontWeight: 600 }}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Move Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
