import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { DEFAULT_PREPAYMENT_ASSET_ACCOUNT } from '@/app/data/glAccounts';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Banknote,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDownUp,
  CircleDashed,
  Clock,
  Download,
  FilePen,
  FileText,
  Flag,
  Info,
  Landmark,
  ListChecks,
  Lock,
  LockOpen,
  Mail,
  MoreHorizontal,
  Trash2,
  Printer,
  Maximize2,
  Minimize2,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Wallet,
  X,
  XCircle,
  StickyNote,
  MessageSquare,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type Payment } from '@/app/data/mockPayments';
import { paymentMethodInfo } from '@/app/data/paymentMethodCatalog';
import { vendorPaymentMethods, methodSummary, methodDataRows, type VendorPaymentMethod } from '@/app/data/vendorPaymentMethods';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { liveLines, type PaymentRun, type PaymentRunStatus } from '@/app/data/paymentRuns';
import type { PaymentRunsApi } from '@/app/hooks/usePaymentRuns';
import { accountTotals, groupCredit, groupGross, groupLines, groupNet, runDebitRows } from '@/app/lib/runMath';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { AttachmentsTab } from '@/app/components/invoice-details/AttachmentsTab';
import { ComingSoonTab } from '@/app/components/invoice-details/ComingSoonTab';
import { NotesTab, type InvoiceNote } from '@/app/components/invoice-details/NotesTab';
import { downloadRunRemittanceAdvice } from '@/app/lib/remittanceAdvice';
import { RunActionModal } from './RunActionModal';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { getAvatarTint } from '@/app/utils/avatarTints';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { InvoiceReasonDialog } from '@/app/components/InvoiceReasonDialog';
import { InvoiceTransitionOverlay } from '@/app/components/invoice-details/InvoiceTransitionOverlay';
import { RunChecksRecordedModal, RunExecuteStage, RunGlSummaryModal, initialExecutePhase, type ExecutePhase } from './RunExecuteStage';
import { ManualCheckModal } from '@/app/components/payments/ManualCheckModal';
import { ReleaseHoldDialog, type ReleaseHoldResult } from '@/app/components/ReleaseHoldDialog';
import { FlowStepTabs } from './RunStageRail';
import { CheckPrintFlow } from '@/app/components/payments/CheckPrintFlow';
import type { CheckPaymentInput } from '@/app/lib/checkPrinting';
import { ApproveRunModal, ResubmitRunModal, ReturnToPendingModal, WithdrawRunModal } from './RunDecisionModals';
import { RunRequestChangesModal } from './RunRequestChangesModal';
import { RunIssuesPanel, MoveLineModal } from './RunIssuesPanel';
import { RUN_CANCEL_OVERRIDE, RUN_HOLD_OVERRIDE } from './runReasonConfigs';
import { RunStatusPill, DueDatePill, money, humanDate, openInvoiceTab, exportRunCsv } from './runUi';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';

/* ── Payment run detail page (8/4/26 restructure) ────────────────────
 * Every non-Draft run's home at /payments-v2/runs/:runId, in the exact
 * PaymentDetailScreen design language so the record pages read as one
 * product: sticky morphing status-tinted header card, a lifecycle
 * workflow ladder driven by the run status, a tab bar, and a body with
 * left tab-content + a sticky collapsible right sidebar. Lifecycle
 * actions open the flow modals from here: Review & approve hosts the
 * approval stage, Execute run hosts the execute stage; Print & complete
 * lives on its own tab once payments have posted. Drafts never render
 * here, they live in the two-step authoring modal. */

// ── Status palette — RunStatusPill tones reshaped to the {bg,color,
// border} contract the detail header gradient + ladder consume. ──
const STATUS_PALETTE: Record<PaymentRunStatus, { bg: string; color: string; border: string }> = {
  Draft: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  'Pending Approval': { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  // Changes requested is ORANGE, needs work, never terminal red (8/5/26).
  'Changes Requested': { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  // Approved = the Approve CTA's emerald (8/5/26): the status wears the
  // color of the action that produced it.
  Approved: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  // Recording wears green (8/5/26): the run's execute identity matches
  // the Record Payment module, violet is retired.
  Executed: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'Partially Executed': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  Completed: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  Cancelled: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
};

function headerCardStyle(p: { bg: string; color: string; border: string }): React.CSSProperties {
  const softMix = `color-mix(in srgb, ${p.bg} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${p.bg} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: p.border,
  };
}

// ── Tabs ──────────────────────────────────────────────────────────
type TabKey = 'payments' | 'linked' | 'gl-impact' | 'notes' | 'communication' | 'attachments' | 'activity';

// ── Workflow ladder — the invoice/payment circle-stepper recipe keyed
// to the run lifecycle. Partially executed renders as the Executed node
// current, wearing its own label. ──
// Each node wears the color of the ACTION that reaches it (8/5/26):
// submit amber, approve emerald; the terminal node is the payments'
// own state (Paid green / Scheduled blue), the payment detail tones.
const STEP_SOLID: Record<string, string> = {
  'Pending Approval': '#B45309',
  'Changes Requested': '#C2410C',
  Approved: '#047857',
  Paid: '#065F46',
  Scheduled: '#0654BC',
  Cancelled: '#BE123C',
};
const stepGlow = (s: string) => `color-mix(in srgb, ${STEP_SOLID[s] ?? '#64748B'} 18%, transparent)`;

function RunWorkflowBar({ run, settlement }: { run: PaymentRun; settlement: 'Paid' | 'Scheduled' }) {
  // NO Draft node (feedback 8/5/26): a run has no draft state — the
  // journey starts at Pending approval, where submitting created it.
  const isCancelled = run.status === 'Cancelled';
  // Recording is the FINAL node (feedback 8/5/26): it reads Paid or
  // Scheduled from the decision made, never "Executed"/"Completed".
  const executedTerminal = run.status === 'Executed' || run.status === 'Partially Executed' || run.status === 'Completed';
  // A cancelled run's journey stops where it was: the reached nodes stay,
  // a red Cancelled node terminates the track (the payment Reversed
  // treatment).
  const isChangesRequested = run.status === 'Changes Requested';
  const resubmittedPending = run.status === 'Pending Approval' && !!run.changeRequest;
  const steps: Array<{ key: string; label: string; icon: React.ElementType }> = isCancelled
    ? [
        { key: 'Pending Approval', label: 'Pending Approval', icon: Clock },
        ...(run.approvedAt ? [{ key: 'Approved', label: 'Approved', icon: ShieldCheck }] : []),
        { key: 'Cancelled', label: 'Cancelled', icon: XCircle },
      ]
    : isChangesRequested
      ? [
          // The orange node sits on the path, the forward nodes stay
          // visible as the way back (8/5/26).
          { key: 'Pending Approval', label: 'Pending Approval', icon: Clock },
          { key: 'Changes Requested', label: 'Changes Requested', icon: FilePen },
          { key: 'Approved', label: 'Approved', icon: ShieldCheck },
          { key: settlement, label: settlement, icon: settlement === 'Scheduled' ? Clock : Check },
        ]
      : resubmittedPending
        ? [
            // Changes Requested stays on the track until the run is
            // approved (10/29): first submit, the request, then the
            // resubmitted Pending Approval as the current node.
            { key: 'Pending Approval', label: 'Pending Approval', icon: Clock },
            { key: 'Changes Requested', label: 'Changes Requested', icon: FilePen },
            { key: 'Resubmitted', label: 'Pending Approval', icon: Clock },
            { key: 'Approved', label: 'Approved', icon: ShieldCheck },
            { key: settlement, label: settlement, icon: settlement === 'Scheduled' ? Clock : Check },
          ]
        : [
            { key: 'Pending Approval', label: 'Pending Approval', icon: Clock },
            { key: 'Approved', label: 'Approved', icon: ShieldCheck },
            { key: settlement, label: settlement, icon: settlement === 'Scheduled' ? Clock : Check },
          ];
  const currentKey = isCancelled ? 'Cancelled' : executedTerminal ? settlement : resubmittedPending ? 'Resubmitted' : run.status;
  // The resubmitted node wears the Pending Approval tone.
  const colorKey = currentKey === 'Resubmitted' ? 'Pending Approval' : currentKey;
  const currentIndex = Math.max(0, steps.findIndex((s) => s.key === currentKey));
  const allCompleted = executedTerminal;
  // The invoice/payment detail ladder recipe verbatim (8/5/26): completed
  // segments run primary blue until the journey completes (then the
  // terminal color takes over); the CURRENT node wears the color of the
  // action that reached it, e.g. Approved in the Approve CTA's emerald.
  const terminal = STEP_SOLID[steps[steps.length - 1].key] ?? '#64748B';
  const doneSolid = allCompleted ? terminal : 'hsl(var(--primary))';
  const doneTint = allCompleted ? stepGlow(steps[steps.length - 1].key) : 'color-mix(in srgb, hsl(var(--primary)) 16%, transparent)';
  const activeColors = { solid: STEP_SOLID[colorKey] ?? '#64748B', glow: stepGlow(colorKey) };

  return (
    <div className="px-4 lg:px-5 py-2.5">
      <div className="relative flex items-center w-full gap-1.5 py-1" style={{ minHeight: 32 }}>
        {steps.map((step, idx) => {
          const isCompleted = allCompleted || idx < currentIndex;
          const isCurrent = idx === currentIndex && !allCompleted;
          const isLast = idx === steps.length - 1;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="contents">
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: isCurrent ? 24 : isCompleted ? 22 : 20,
                    height: isCurrent ? 24 : isCompleted ? 22 : 20,
                    ...(isCompleted
                      ? { backgroundColor: doneSolid, boxShadow: `0 2px 6px ${doneTint}` }
                      : isCurrent
                        ? { backgroundColor: activeColors.solid, boxShadow: `0 0 0 3px ${activeColors.glow}, 0 2px 8px color-mix(in srgb, currentColor 8%, transparent)` }
                        : { backgroundColor: 'transparent', border: '1.5px solid hsl(var(--border))' }),
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {isCompleted ? (
                    <Check className="size-2.5 text-white" style={{ strokeWidth: 3 }} />
                  ) : isCurrent ? (
                    <StepIcon className="size-3 text-white" style={{ strokeWidth: 2.5 }} />
                  ) : (
                    <StepIcon className="size-2.5" style={{ color: '#64748B', strokeWidth: 2 }} />
                  )}
                </div>
                <span
                  className="hidden sm:block whitespace-nowrap text-[12px] transition-all duration-300"
                  style={
                    isCompleted
                      ? { fontWeight: 500, color: doneSolid }
                      : isCurrent
                        ? { fontWeight: 600, color: activeColors.solid }
                        : { fontWeight: 500, color: '#475569' }
                  }
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 mx-1.5 lg:mx-2 min-w-[10px] relative" style={{ height: 4 }}>
                  {idx < currentIndex || allCompleted ? (
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: doneSolid, height: 2, top: '50%', transform: 'translateY(-50%)' }} />
                  ) : (
                    <div
                      className="absolute rounded-full"
                      style={{
                        inset: 0,
                        height: 2,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#94A3B8',
                        WebkitMaskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                        maskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                        opacity: 0.85,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Small shared card chrome (PaymentDetailScreen tab-card recipe) ──
function TabCard({
  icon: Icon, iconBg, iconColor, title, subtitle, badge, children,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  title: string; subtitle: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] tracking-tight" style={{ fontWeight: 600 }}>{title}</h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

const TH = 'text-left px-4 py-2 text-[10px] text-slate-400';

/** Activity timestamps carry the real time when the audit field has one
 *  (nowIso events do), the partner "Aug 5, 2026 at 05:53 PM" format;
 *  date-only seeds stay date-only (8/5/26). */
function formatTimestamp(iso: string) {
  if (!iso.includes('T')) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

export function RunDetailScreen({
  run,
  invoices,
  payments,
  runsApi,
  onClose,
  onViewPayment,
  onOpenRun,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: {
  run: PaymentRun;
  invoices: Invoice[];
  payments: Payment[];
  runsApi: PaymentRunsApi;
  /** Back to where the run was opened from. */
  onClose: () => void;
  onViewPayment: (payment: Payment) => void;
  /** Navigate to another run (a moved line's destination). */
  onOpenRun?: (runId: string) => void;
  /** Notes for this run (user 10/22/26), the invoice Notes tab. */
  notes?: InvoiceNote[];
  onAddNote?: (text: string) => void;
  onUpdateNote?: (noteId: string, text: string) => void;
  onDeleteNote?: (noteId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('payments');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [action, setActionRaw] = useState<'execute' | null>(null);
  // The record modal's step (user 10/15): the header stepper drives it.
  const [execPhase, setExecPhase] = useState<ExecutePhase>('payments');
  // The run's GL impact shows once BOTH record steps are done (user
  // 10/21/26), after the status-change overlay clears.
  const [glSummaryOpen, setGlSummaryOpen] = useState(false);
  const setAction = (a: 'execute' | null) => {
    if (a === 'execute') setExecPhase(initialExecutePhase(run));
    setActionRaw(a);
  };
  // Lifecycle decisions are page-level heads-up modals (8/4/26): the old
  // Review & approve modal is dead, the data already lives on this page.
  const [decision, setDecision] = useState<'approve' | 'requestChanges' | 'hold' | 'cancel' | 'resubmit' | 'returnToPending' | 'withdraw' | null>(null);
  // Per-line flag (8/5/26): opens Request changes pre-scoped to the line.
  const [flagInvoiceId, setFlagInvoiceId] = useState<string | null>(null);
  // The change-request "move to another run" fate.
  const [moveIssueId, setMoveIssueId] = useState<string | null>(null);
  const APPROVER = 'Ahtisham Ahmad';
  const held = !!run.hold;
  const preExecution = run.status === 'Pending Approval' || run.status === 'Approved';
  // Cancel also covers a Changes-requested run the creator abandons.
  const cancellable = preExecution || run.status === 'Changes Requested';

  // "State Transitioned" overlay (8/5/26) — the invoice/payment detail
  // micro-interaction plays on EVERY run status change: approve,
  // execute, completion, cancel.
  const prevStatus = useRef(run.status);
  const [transition, setTransition] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (prevStatus.current !== run.status) {
      setTransition({ from: prevStatus.current, to: run.status });
      prevStatus.current = run.status;
    }
  }, [run.status]);

  // IntersectionObserver-driven header morph, same mechanism as the
  // invoice / payment detail pages.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), { threshold: 0 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const lines = liveLines(run);
  const totals = useMemo(() => accountTotals(run), [run]);
  const total = run.groups.reduce((s, g) => s + groupNet(run, g), 0);
  const gross = run.groups.reduce((s, g) => s + groupGross(run, g), 0);
  const creditTotal = run.groups.reduce((s, g) => s + groupCredit(g), 0);
  const runPayments = useMemo(() => payments.filter((p) => p.runId === run.id), [payments, run.id]);
  const executed = ['Executed', 'Partially Executed', 'Completed'].includes(run.status);

  // ── Check printing (BA spec 9/22): recorded check payments print per
  // pay-from account — one flow per account, since the stock profile and
  // number sequence bind to the bank account. ──
  const [checkPrintAccount, setCheckPrintAccount] = useState<string | null>(null);
  const checkGroups = useMemo(() => {
    const groups = new Map<string, Payment[]>();
    runPayments
      .filter((p) => p.paymentMethod === 'Check')
      .forEach((p) => {
        const key = p.bankAccount || 'unassigned';
        groups.set(key, [...(groups.get(key) ?? []), p]);
      });
    return groups;
  }, [runPayments]);
  // Checks a record pass just posted (user 10/21/26): the choice modal
  // offers Print now, Print later or Manual check, like a single payment.
  // Print now prints only this batch, one bank account at a time.
  const [recordedChecks, setRecordedChecks] = useState<{ ids: string[]; starts: Record<string, number> } | null>(null);
  const [checkChoiceOpen, setCheckChoiceOpen] = useState(false);
  const [printOnly, setPrintOnly] = useState<{ ids: string[]; starts: Record<string, number> } | null>(null);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const manualLoggedRef = useRef(false);
  const justIssuedRef = useRef(false);
  const recordedCheckPayments = recordedChecks ? runPayments.filter((p) => recordedChecks.ids.includes(p.id)) : [];
  const finishCheckBatch = () => {
    setCheckChoiceOpen(false);
    setPrintOnly(null);
    setRecordedChecks(null);
  };
  const checkInputsFor = (accountId: string): CheckPaymentInput[] =>
    (checkGroups.get(accountId) ?? []).filter((p) => !printOnly || printOnly.ids.includes(p.id)).map((p) => ({
      paymentRef: p.paymentNumber,
      payee: p.vendor,
      date: p.paymentDate,
      memo: p.memo || `Payment run ${run.id}`,
      total: p.amount,
      lines:
        p.perInvoiceSplit && p.perInvoiceSplit.length > 0
          ? p.perInvoiceSplit.map((s) => ({
              invoiceNumber: s.invoiceNumber,
              invoiceDate: '',
              description: `Payment run ${run.id}`,
              gross: Math.round((s.cash + s.credit) * 100) / 100,
              discount: 0,
              adjustment: s.credit,
              net: s.cash,
            }))
          : p.appliedInvoices.map((ai) => ({
              invoiceNumber: ai.invoiceNumber,
              invoiceDate: '',
              description: `Payment run ${run.id}`,
              gross: ai.amount,
              discount: 0,
              adjustment: 0,
              net: ai.amount,
            })),
      remittanceEmail: p.vendor.length % 4 === 0 ? undefined : `ap@${p.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
    }));
  // The terminal ladder node (8/5/26): Scheduled or Paid, from the
  // posted payments once recorded, predicted from the payment date before.
  const settlement: 'Paid' | 'Scheduled' = executed
    ? (runPayments.some((p) => p.status === 'Scheduled') ? 'Scheduled' : 'Paid')
    : (run.paymentDate > localTodayIso() ? 'Scheduled' : 'Paid');
  // Once recorded, the HEADER wears the terminal node's identity too
  // (feedback 8/5/26): copy, pill tone, and card tint read Scheduled or
  // Paid, never Executed.
  const displayStatus = executed ? settlement : run.status;
  const statusPalette = executed
    ? settlement === 'Scheduled'
      ? { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      : { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' }
    : STATUS_PALETTE[run.status];

  // No Print & Complete tab (feedback 8/5/26): the artifacts live on
  // the Payments tab with the posted payments.
  // No Invoices tab (feedback 8/5/26): the invoice lines already live on
  // the Payments cards and in Linked Records.
  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'payments', label: 'Payments' },
    { key: 'linked', label: 'Linked Records' },
    { key: 'gl-impact', label: 'GL Impact' },
    // The four standard record tabs (10/1/26): every detail page in the
    // module carries Notes, Communication, Attachments, Recent Activity.
    { key: 'notes', label: 'Notes' },
    { key: 'communication', label: 'Communications' },
    { key: 'attachments', label: 'Attachments' },
    { key: 'activity', label: 'Activity' },
  ];

  // GL impact rows — debit A/P for the invoices' gross and the advances
  // account for pre-invoices (user 10/22/26), credit each pay-from
  // account its outgoing net, credit prepayments for drawn credit.
  const glRows = [
    ...runDebitRows(run),
    ...totals.map((t) => ({
      code: t.account.id.split('-')[0],
      name: t.account.label.includes('·') ? t.account.label.split('·')[1].trim() : t.account.label,
      debit: 0,
      credit: t.selected,
    })),
    ...(creditTotal > 0 ? [{ code: DEFAULT_PREPAYMENT_ASSET_ACCOUNT.split(' ')[0], name: DEFAULT_PREPAYMENT_ASSET_ACCOUNT.split(' ').slice(1).join(' '), debit: 0, credit: creditTotal }] : []),
  ];

  // Primary CTA per status — the invoice detail CTA slot. Pending
  // approval renders the Reject + Approve pair instead (below); a held
  // run swaps its forward CTA for Release hold. Post-recording the CTA
  // slot belongs to Download NACHA file (8/5/26); Print lives in the
  // Actions menu.
  const primaryCta = (() => {
    if (held && preExecution) return null;
    if (run.status === 'Approved') {
      // Green with the Banknote icon (8/5/26): recording a run IS the
      // Record Payment action, so it wears that module's identity.
      return { label: 'Record Payment Run', icon: Banknote, bg: 'bg-emerald-600 hover:bg-emerald-700', onClick: () => setAction('execute') };
    }
    // Recording in pieces (Eli 9/25): a partially executed run keeps the
    // Record CTA for the remainder.
    if (run.status === 'Partially Executed' && run.groups.some((g) => !g.paymentId && liveLines(run).some((l) => l.vendor === g.vendor))) {
      return { label: 'Record Remaining Payments', icon: Banknote, bg: 'bg-emerald-600 hover:bg-emerald-700', onClick: () => setAction('execute') };
    }
    return null;
  })();

  // NACHA downloads removed from the UI (user 9/22): bank-file
  // generation is out of the prototype's action set.

  // The executed run's primary CTA (BA 8/11/26): one combined PDF, an
  // advice page per posted payment.
  const downloadRemittance = () => {
    downloadRunRemittanceAdvice(run.id, runPayments);
    toast.success('Remittance advice downloaded', {
      description: `${runPayments.length} advice page${runPayments.length === 1 ? '' : 's'} in one PDF, saved for ${run.id}.`,
    });
  };

  const confirmApprove = () => {
    runsApi.approveRun(run.id, APPROVER);
    setDecision(null);
    toast.success('Run approved', {
      description: `${lines.length} invoice${lines.length === 1 ? '' : 's'} are clear to pay. Execute when ready.`,
    });
  };
  const confirmRequestChanges = (input: {
    issues: Array<{ invoiceId?: string; reason: string; note?: string }>;
    assignees: string[];
  }) => {
    runsApi.requestChanges(run.id, { by: APPROVER, ...input });
    setDecision(null);
    setFlagInvoiceId(null);
    const n = input.issues.length;
    toast.success('Changes Requested', {
      description: `${run.createdBy} will see ${n} issue${n === 1 ? '' : 's'} to resolve on ${run.id}.`,
    });
  };
  const confirmResubmit = () => {
    setDecision(null);
    // Reopens as an editable Draft; the route swaps to the authoring
    // modal where the issues checklist and Resubmit for approval live.
    runsApi.reopenRun(run.id);
  };
  const releaseIssue = (issueId: string) => {
    const issue = run.changeRequest?.issues.find((i) => i.id === issueId);
    runsApi.releaseIssueLine(run.id, issueId, APPROVER);
    toast.success('Invoice released', {
      description: `${issue?.invoiceNumber ?? 'The invoice'} returned to Invoices to Pay, outside any run.`,
    });
  };
  const moveIssue = (target: { runId: string } | { newRun: true }) => {
    if (!moveIssueId) return;
    const issue = run.changeRequest?.issues.find((i) => i.id === moveIssueId);
    const destination = runsApi.moveIssueLine(run.id, moveIssueId, target, APPROVER);
    setMoveIssueId(null);
    if (destination) {
      toast.success(`${issue?.invoiceNumber ?? 'Invoice'} moved to ${destination}`, {
        description: 'This run no longer pays it. The lock followed it.',
      });
    }
  };
  const confirmReturnToPending = () => {
    runsApi.returnToPending(run.id, APPROVER);
    setDecision(null);
    toast.success('Returned to Pending Approval', {
      description: 'Approval came off. Methods and pay-from accounts can change again.',
    });
  };
  const confirmWithdraw = () => {
    setDecision(null);
    // Reopens as an editable Draft; the route swaps to the authoring
    // modal. Closing without resubmitting restores Pending approval.
    runsApi.reopenRun(run.id);
  };
  const confirmHold = (reason: string) => {
    runsApi.holdRun(run.id, reason, APPROVER);
    setDecision(null);
    toast.success('Run placed on hold', {
      description: 'Approve and execute stay locked until the hold is released.',
    });
  };
  // Release confirms first (user 10/22/26): the vendor invoicing release
  // dialog, notes, documents and notify included.
  const [releaseOpen, setReleaseOpen] = useState(false);
  const releaseHold = () => setReleaseOpen(true);
  const confirmRelease = (r: ReleaseHoldResult) => {
    runsApi.releaseHold(run.id, { notes: r.notes, notifiedRecipientIds: r.recipientIds, attachments: r.attachments, by: APPROVER });
    setReleaseOpen(false);
    toast.success('Hold released', {
      description: r.recipientNames.length > 0
        ? `The run continues from where it paused. Release notification sent to ${r.recipientNames.slice(0, 2).join(', ')}${r.recipientNames.length > 2 ? ` +${r.recipientNames.length - 2} more` : ''}.`
        : 'The run continues from where it paused.',
    });
  };

  // Vendor-level hold (Jennifer 9/1/26): a dispute is with ONE vendor,
  // not the run — "you wouldn't want one check to hold up 50 vendors'
  // worth of payments." Holding a vendor soft-removes its lines with the
  // approver's reason: the rest of the run proceeds untouched, the
  // vendor's invoices release back to the payable pool, and Release
  // before execution puts them straight back in this run.
  const VENDOR_HOLD_PREFIX = 'Vendor held by approver: ';
  const [holdVendorTarget, setHoldVendorTarget] = useState<string | null>(null);
  const heldVendorEntries = useMemo(() => {
    const map = new Map<string, { reason: string; by: string; at: string; count: number; amount: number }>();
    run.lines.forEach((l) => {
      if (!l.removed?.reason.startsWith(VENDOR_HOLD_PREFIX)) return;
      const cur = map.get(l.vendor);
      if (cur) {
        cur.count += 1;
        cur.amount = Math.round((cur.amount + l.payAmount) * 100) / 100;
      } else {
        map.set(l.vendor, {
          reason: l.removed.reason.slice(VENDOR_HOLD_PREFIX.length),
          by: l.removed.by,
          at: l.removed.at,
          count: 1,
          amount: l.payAmount,
        });
      }
    });
    return [...map.entries()].map(([vendor, meta]) => ({ vendor, ...meta }));
  }, [run.lines]);
  const confirmVendorHold = (reason: string) => {
    if (!holdVendorTarget) return;
    const vendor = holdVendorTarget;
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) =>
        l.vendor === vendor && !l.removed
          ? { ...l, removed: { reason: `${VENDOR_HOLD_PREFIX}${reason}`, by: APPROVER, at: new Date().toISOString(), stage: 'approval' as const } }
          : l,
      ),
    }));
    setHoldVendorTarget(null);
    toast.success(`${vendor} held out of this run`, {
      description: 'Its invoices returned to the payable pool; every other payment proceeds.',
    });
  };
  // Remove an invoice, or a vendor's whole payment, from a pending run
  // (user 9/23): the soft-removal record keeps the audit trail; the
  // invoices return to the payable pool.
  const removeInvoiceFromRun = (invoiceId: string, invoiceNumber: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) =>
        l.invoiceId === invoiceId && !l.removed
          ? { ...l, removed: { reason: 'Removed from run', by: APPROVER, at: new Date().toISOString(), stage: 'approval' as const } }
          : l,
      ),
    }));
    toast.success(`${invoiceNumber} removed from this run`, {
      description: 'The invoice returned to the payable pool.',
    });
  };
  const removeVendorFromRun = (vendor: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) =>
        l.vendor === vendor && !l.removed
          ? { ...l, removed: { reason: 'Removed from run', by: APPROVER, at: new Date().toISOString(), stage: 'approval' as const } }
          : l,
      ),
    }));
    toast.success(`${vendor} removed from this run`, {
      description: 'Its invoices returned to the payable pool; every other payment proceeds.',
    });
  };
  const releaseVendorHold = (vendor: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) =>
        l.vendor === vendor && l.removed?.reason.startsWith(VENDOR_HOLD_PREFIX) ? { ...l, removed: undefined } : l,
      ),
    }));
    toast.success(`${vendor} is back in the run`);
  };
  const confirmCancel = (reason: string) => {
    runsApi.cancelRun(run.id, reason, APPROVER);
    setDecision(null);
    toast.success('Run cancelled', {
      description: 'The invoices returned to the payable pool. Nothing was posted.',
    });
  };

  // Recent activity — real events from the run's audit fields, shaped
  // for the Activity History line: actor bold, verb, run-id chip,
  // optional detail. Newest first, the invoice ActivityTab order.
  const activity = useMemo(() => {
    const doer = run.executedBy ?? run.createdBy;
    const items: Array<{ icon: React.ElementType; actor: string; verb: string; detail?: string; date: string; tone: 'neutral' | 'success' | 'danger' | 'warning' }> = [
      { icon: FileText, actor: run.createdBy, verb: 'created payment run', date: run.createdAt, tone: 'neutral' },
    ];
    if (run.submittedAt) items.push({ icon: Send, actor: run.submittedBy ?? run.createdBy, verb: 'submitted for approval', date: run.submittedAt, tone: 'neutral' });
    if (run.changeRequest) {
      const cr = run.changeRequest;
      items.push({
        icon: FilePen,
        actor: cr.by,
        verb: 'requested changes on',
        detail: cr.issues
          .map((i) => `"${i.reason}"${i.invoiceNumber ? ` on ${i.invoiceNumber}` : ''}`)
          .join(' · '),
        date: cr.at,
        tone: 'warning',
      });
      cr.issues
        .filter((i) => i.resolution)
        .forEach((i) => {
          const r = i.resolution!;
          const what =
            r.outcome === 'fixed'
              ? 'Fixed in this run'
              : r.outcome === 'moved'
                ? `Moved to ${r.movedToRunId ?? 'another run'}`
                : 'Released back to Invoices to Pay';
          items.push({
            icon: CheckCircle2,
            actor: r.by,
            verb: 'resolved an issue on',
            detail: `${i.invoiceNumber ?? 'Run level'} · ${what}`,
            date: r.at,
            tone: 'success',
          });
        });
    }
    // Removed invoices are tracked here (Eli 10/5): every line that left
    // the run, pre- or post-submit, shows who removed it and why. Vendor
    // holds (their own card) read as a hold, not a plain removal.
    run.lines
      .filter((l) => l.removed)
      .forEach((l) => {
        const rem = l.removed!;
        const isVendorHold = rem.reason.startsWith(VENDOR_HOLD_PREFIX);
        items.push({
          icon: isVendorHold ? Lock : Trash2,
          actor: rem.by,
          verb: isVendorHold ? `held ${l.vendor}, removing` : 'removed',
          detail: isVendorHold
            ? `${l.invoiceNumber} · "${rem.reason.slice(VENDOR_HOLD_PREFIX.length)}"`
            : `${l.invoiceNumber}${rem.reason ? ` · "${rem.reason}"` : ''}`,
          date: rem.at,
          tone: 'warning',
        });
      });
    if (run.hold) items.push({ icon: Lock, actor: run.hold.by, verb: 'placed a hold on', detail: `"${run.hold.reason}"`, date: run.hold.at, tone: 'danger' });
    if (run.cancelled) items.push({ icon: Ban, actor: run.cancelled.by, verb: 'cancelled', detail: `"${run.cancelled.reason}"`, date: run.cancelled.at, tone: 'danger' });
    if (run.returnedToPending) items.push({ icon: RotateCcw, actor: run.returnedToPending.by, verb: 'returned to Pending Approval', detail: 'Approval came off so the run could change before recording.', date: run.returnedToPending.at, tone: 'warning' });
    if (run.approvedAt) items.push({ icon: ShieldCheck, actor: run.approvedBy ?? 'Approver', verb: 'approved', detail: 'Every invoice in the run became clear to pay.', date: run.approvedAt, tone: 'success' });
    if (run.executedAt) items.push({ icon: Banknote, actor: doer, verb: `recorded ${runPayments.length} payment${runPayments.length === 1 ? '' : 's'} on`, date: run.executedAt, tone: 'success' });
    run.print.checkLots.filter((l) => l.confirmedAt).forEach((l) => {
      items.push({ icon: CheckCircle2, actor: doer, verb: `confirmed the ${l.accountId} check lot on`, date: l.confirmedAt!, tone: 'success' });
    });
    run.print.nachaFiles.filter((f) => f.transmittedAt).forEach((f) => {
      items.push({ icon: CheckCircle2, actor: doer, verb: `transmitted NACHA file ${f.fileName} for`, date: f.transmittedAt!, tone: 'success' });
    });
    if (run.print.remittanceSentAt) items.push({ icon: Mail, actor: doer, verb: 'sent remittance advices for', date: run.print.remittanceSentAt, tone: 'success' });
    if (run.completedAt) items.push({ icon: CheckCircle2, actor: 'System', verb: 'completed and filed', date: run.completedAt, tone: 'success' });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [run, runPayments.length]);

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-slate-50">
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══ STICKY MORPHING HEADER CARD ══ */}
      <div className="shrink-0 sticky top-0 z-30 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? '8px' : '12px', paddingBottom: '4px', transition: 'padding-top 250ms ease' }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]' : 'shadow-sm'
              }`}
              style={headerCardStyle(statusPalette)}
            >
              {/* Main header row */}
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? '6px 16px' : '12px 16px' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    aria-label="Back to payment runs"
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Tile — the runs identity (ListChecks blue). */}
                  <div
                    className="rounded-xl flex items-center justify-center shrink-0 transition-all duration-250"
                    style={{
                      width: isScrolled ? 32 : 44,
                      height: isScrolled ? 32 : 44,
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
                    }}
                  >
                    <ListChecks className="transition-all duration-250" style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18, color: '#1D4ED8' }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-foreground truncate transition-all duration-250 "
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}
                      >
                        {run.id}
                      </h1>
                      <span
                        className="inline-flex items-center gap-1 rounded-md border transition-all duration-250"
                        style={{
                          padding: isScrolled ? '1px 6px' : '2px 8px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          borderColor: '#BFDBFE',
                        }}
                      >
                        <ListChecks style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                        Payment Run
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full border transition-all duration-250"
                        style={{
                          padding: isScrolled ? '1px 8px' : '2px 10px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: statusPalette.bg,
                          color: statusPalette.color,
                          borderColor: statusPalette.border,
                        }}
                      >
                        {displayStatus}
                      </span>
                      {held && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border transition-all duration-250"
                          style={{
                            padding: isScrolled ? '1px 8px' : '2px 10px',
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                            backgroundColor: '#FFFBEB',
                            color: '#B45309',
                            borderColor: '#FDE68A',
                          }}
                        >
                          <Lock style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          On Hold
                        </span>
                      )}
                      {!isScrolled && (
                        /* Segmented pill (user 10/1) — the clubbed recipe the
                           invoice header's payment-run pill wears: tinted
                           vendors segment + white invoices segment. */
                        <SegmentedCountPill
                          segments={[
                            `${run.groups.length} vendor${run.groups.length === 1 ? '' : 's'}`,
                            `${lines.length} invoice${lines.length === 1 ? '' : 's'}`,
                          ]}
                          icon={Banknote}
                        />
                      )}
                    </div>

                    {/* No description sentence (feedback 8/5/26): the pills
                        and the Run Summary card carry the facts. */}
                  </div>
                </div>

                {/* Right: Fullscreen + primary CTA */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        ) : (
                          <Maximize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[300]">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</TooltipContent>
                  </Tooltip>

                  {/* Actions menu — the full lifecycle set, grouped like the
                      invoice detail's: forward decisions, hold control,
                      output, destructive last (8/4/26). */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'}`}
                        style={{ fontWeight: 500 }}
                      >
                        Actions
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    {/* Approve/Reject live as header CTAs, not menu items
                        (feedback 8/4/26). Tones match the invoice Actions
                        menu: hold amber, output neutral, cancel red last.
                        No separators (feedback 8/4/26). */}
                    <DropdownMenuContent align="end" className="z-[200] w-56">
                      {primaryCta && (
                        <DropdownMenuItem className="cursor-pointer" onClick={primaryCta.onClick}>
                          <primaryCta.icon className="w-4 h-4 mr-2 text-current" />
                          {primaryCta.label}
                        </DropdownMenuItem>
                      )}
                      {/* Check printing (BA spec 9/22): one flow per
                          pay-from account — the stock profile and the
                          number sequence bind to the bank account. */}
                      {executed &&
                        [...checkGroups.keys()].map((accountId) => {
                          const label = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId)?.label ?? accountId;
                          return (
                            <DropdownMenuItem key={accountId} className="cursor-pointer" onClick={() => setCheckPrintAccount(accountId)}>
                              <Printer className="w-4 h-4 mr-2 text-current" />
                              {/* No check count on the label (user 10/21/26);
                                  the account still names each item when
                                  checks span several accounts. */}
                              {checkGroups.size > 1 ? `Print Checks · ${label}` : 'Print Checks'}
                            </DropdownMenuItem>
                          );
                        })}
                      {/* Plain "Print" (browser print of this page) removed:
                          Print checks is the only print action (user 10/21/26). */}
                      {/* Edit (8/5/26, relabeled from "Withdraw and edit"
                          per BA 8/11/26): the run should be editable from
                          here, not only after a change request. The modal
                          explains the pull-from-queue mechanics. */}
                      {run.status === 'Pending Approval' && !held && (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setDecision('withdraw')}>
                          <FilePen className="w-4 h-4 mr-2 text-current" />
                          Edit Payment Run
                        </DropdownMenuItem>
                      )}
                      {/* Approved runs can move BACK to pending (8/5/26):
                          the run is recordation, not a posting, so
                          pre-execution edits are acceptable. */}
                      {run.status === 'Approved' && !held && (
                        <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-700 focus:bg-amber-50" onClick={() => setDecision('returnToPending')}>
                          <RotateCcw className="w-4 h-4 mr-2 text-current" />
                          Return to Pending Approval
                        </DropdownMenuItem>
                      )}
                      {preExecution && (
                        held ? (
                          <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-700 focus:bg-amber-50" onClick={releaseHold}>
                            <LockOpen className="w-4 h-4 mr-2 text-current" />
                            Release Payment Hold
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-700 focus:bg-amber-50" onClick={() => setDecision('hold')}>
                            <Lock className="w-4 h-4 mr-2 text-current" />
                            Hold Payment Run
                          </DropdownMenuItem>
                        )
                      )}
                      <DropdownMenuItem className="cursor-pointer" onClick={() => exportRunCsv(run)}>
                        <Download className="w-4 h-4 mr-2 text-current" />
                        Export Payment Run
                      </DropdownMenuItem>
                      {cancellable && (
                        <DropdownMenuItem className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => setDecision('cancel')}>
                          <Ban className="w-4 h-4 mr-2 text-current" />
                          Cancel Payment Run
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Pending approval: the decisions live openly in the
                      header, the invoice detail pattern (8/4/26). A held
                      run swaps them for Release hold. */}
                  {/* Every header CTA carries the system tooltip (8/5/26)
                      saying what the action does. */}
                  {held && preExecution && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={releaseHold}
                          className={`rounded-lg bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                          style={{ fontWeight: 600 }}
                        >
                          <LockOpen className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                          Release Payment Hold
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[300]">Unlocks approve and execute; the run continues from where it paused.</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Changes requested: the resubmit CTA, gated by the
                      issues panel below (8/5/26). */}
                  {run.status === 'Changes Requested' && (() => {
                    const emptied = lines.length === 0;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <button
                              onClick={() => {
                                if (emptied) {
                                  toast.error('Nothing to resubmit', { description: 'Every invoice was moved or removed from this run.' });
                                  return;
                                }
                                // Straight into editing (Eli 10/5): no
                                // up-front "reopen?" pop-up — clicking
                                // Resolve takes you INTO the run. The
                                // no-change guard fires at Submit instead.
                                runsApi.reopenRun(run.id);
                              }}
                              className={`rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                              style={{ fontWeight: 600 }}
                            >
                              <RotateCcw className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                              Resolve
                            </button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="z-[300]">
                          Opens the run for editing so you can address the flagged issues, then resubmit.
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                  {run.status === 'Pending Approval' && !held && (
                    <>
                      {/* Request changes + CheckCheck Approve (8/5/26):
                          the approver flags fixes, never blunt-rejects. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDecision('requestChanges')}
                            className={`rounded-lg border bg-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm hover:bg-orange-50 ${isScrolled ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'}`}
                            style={{ fontWeight: 600, color: '#C2410C', borderColor: '#FED7AA' }}
                          >
                            <FilePen className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                            Request Changes
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[300]">Sends the run back to the creator with your requested fixes. They edit and resubmit.</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDecision('approve')}
                            className={`rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                            style={{ fontWeight: 600 }}
                          >
                            <CheckCheck className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                            Approve
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[300]">Releases every invoice in the run as clear to pay. Nothing posts until execute.</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  {primaryCta && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={primaryCta.onClick}
                          className={`rounded-lg ${primaryCta.bg} text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                          style={{ fontWeight: 600 }}
                        >
                          <primaryCta.icon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                          {primaryCta.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[300]">
                        Posts the payments to the ledger and locks the run. Undo after this means reversal.
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Post-recording the CTA slot is Download remittance
                      advice (BA 8/11/26): one PDF, one advice page per
                      posted payment. NACHA moved to the Actions menu. */}
                  {executed && runPayments.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={downloadRemittance}
                          className={`rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                          style={{ fontWeight: 600 }}
                        >
                          <Download className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                          Download Remittance Advice
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[300]">One PDF with an advice page for each of the {runPayments.length} payment{runPayments.length === 1 ? '' : 's'}, ready to send to vendors.</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Workflow ladder — hidden in compact mode. */}
              <div
                className="overflow-hidden transition-all duration-250 ease-in-out border-t border-muted"
                style={{ maxHeight: isScrolled ? 0 : 80, opacity: isScrolled ? 0 : 1 }}
              >
                <RunWorkflowBar run={run} settlement={settlement} />
              </div>

              {/* Tab bar — always visible */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                      style={{
                        padding: isScrolled ? '8px 14px' : '10px 14px',
                        fontSize: isScrolled ? 12 : 13,
                        fontWeight: isActive ? 600 : 400,
                        transition: 'padding 250ms ease, font-size 250ms ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* ══ BODY ══ */}
      <div className="flex-1">
        <div className={`mx-auto px-3 pt-3 pb-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
          <div className="flex gap-4 items-start">
            {/* ── LEFT: tab content ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Hold story — the control flag and its reason. */}
              {held && preExecution && (
                <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: '#FDE68A' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                    <Lock className="w-4 h-4" style={{ color: '#B45309' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                      On hold, placed by {run.hold!.by} on {humanDate(run.hold!.at)}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      "{run.hold!.reason}" Approve and execute stay locked until the hold is released.
                    </p>
                  </div>
                </div>
              )}

              {/* Cancelled story — terminal, nothing posted. */}
              {run.status === 'Cancelled' && run.cancelled && (
                <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: '#FECDD3' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFF1F2' }}>
                    <Ban className="w-4 h-4" style={{ color: '#BE123C' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                      This run was cancelled by {run.cancelled.by} on {humanDate(run.cancelled.at)}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      "{run.cancelled.reason}" Nothing was posted; the {lines.length} invoice{lines.length === 1 ? '' : 's'} returned to the payable pool, free for any future run.
                    </p>
                  </div>
                </div>
              )}

              {/* Changes requested — the issues panel replaces the old
                  rejected strip (8/5/26): every flagged issue with its
                  three-fate Resolve control, and the resubmit gate. */}
              {run.status === 'Changes Requested' && run.changeRequest && (
                <RunIssuesPanel
                  run={run}
                  variant="detail"
                  onResolveFixed={(issueId) => runsApi.resolveIssueFixed(run.id, issueId, APPROVER)}
                  onReopen={(issueId) => runsApi.reopenIssue(run.id, issueId)}
                  onRelease={releaseIssue}
                  onMove={(issueId) => setMoveIssueId(issueId)}
                  onResubmit={() => setDecision('resubmit')}
                  onOpenRun={onOpenRun}
                />
              )}

              {/* Change-request story — the run came back and went out
                  again with every issue resolved. */}
              {run.changeRequest?.resolvedAt && run.status === 'Pending Approval' && (
                <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: '#FDE68A' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                    <XCircle className="w-4 h-4" style={{ color: '#B45309' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                      Previously sent back by {run.changeRequest.by}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      {run.changeRequest.issues.length} issue{run.changeRequest.issues.length === 1 ? ' was' : 's were'} resolved and the proposal was resubmitted.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Payments tab — a searchable, sortable TABLE (BA
                  8/12/26): the detail page is view-only, so the authoring
                  accordions were pure cognitive load here and broke down
                  on smaller screens. One row per payment; expanding a row
                  reveals its invoice lines. The authoring modal keeps the
                  card composition, this applies to the detail page ONLY. ── */}
              {activeTab === 'payments' && (
                <>
                  {/* Held vendors (Jennifer 9/1/26): the problem pile sits
                      visibly OUTSIDE the run — reason on hover, one click
                      brings a vendor back before execution. */}
                  {heldVendorEntries.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <p className="text-[11px] text-amber-700" style={{ fontWeight: 700 }}>
                          Held Out of This Run · {heldVendorEntries.length}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {heldVendorEntries.map((h) => (
                          <div key={h.vendor} className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-[12px] text-amber-900" style={{ fontWeight: 600 }}>
                                {h.vendor} <span className="text-amber-700/80 " style={{ fontWeight: 500 }}>· {h.count} invoice{h.count === 1 ? '' : 's'} · {money(h.amount)}</span>
                              </p>
                              <p className="text-[11px] text-amber-700/90 leading-snug">
                                "{h.reason}" Held by {h.by}. Its invoices are back in the payable pool; the rest of the run proceeds.
                              </p>
                            </div>
                            {preExecution && (
                              <button
                                type="button"
                                onClick={() => releaseVendorHold(h.vendor)}
                                className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-amber-300 bg-white text-[11px] text-amber-800 hover:bg-amber-100/60 transition-colors cursor-pointer"
                                style={{ fontWeight: 600 }}
                              >
                                <LockOpen className="w-3 h-3" />
                                Put Back in the Run
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <RunPaymentsTable
                    run={run}
                    runPayments={runPayments}
                    executed={executed}
                    onViewPayment={onViewPayment}
                    onFlagLine={run.status === 'Pending Approval' ? (id) => setFlagInvoiceId(id) : undefined}
                    onRemoveLine={preExecution && !held ? removeInvoiceFromRun : undefined}
                    onRemoveVendor={preExecution && !held ? removeVendorFromRun : undefined}
                  />
                </>
              )}

              {/* ── Linked Records tab — the invoice detail's sectioned
                  recipe: toolbar with search + type pills, then one
                  collapsible card per record type with a compact table. ── */}
              {activeTab === 'linked' && (
                <RunLinkedRecordsTab
                  run={run}
                  lines={lines}
                  runPayments={runPayments}
                  onViewPayment={onViewPayment}
                />
              )}

              {/* ── GL Impact tab — the invoice GL recipe: posting banner
                  first, then the journal card with a plain-language
                  explainer, chip account codes, and the Dr = Cr foot. ── */}
              {activeTab === 'gl-impact' && (
                <div className="space-y-3.5">
                  {/* No posted banner once executed (user 10/1): the journal
                      card below says it. Only the pre-execution preview
                      state keeps its banner. */}
                  {!executed && (
                    <div
                      className="rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3"
                      style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 60%)' }}
                    >
                      <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0">
                        <CircleDashed className="w-4 h-4 text-slate-400" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] text-slate-800 tracking-tight" style={{ fontWeight: 600 }}>
                            Not Posted
                          </p>
                          <span
                            className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-slate-100 text-slate-500 border border-slate-200/80"
                            style={{ fontWeight: 700 }}
                          >
                            Preview
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Nothing hits the GL until the run executes. This is the entry it will book.
                        </p>
                      </div>
                    </div>
                  )}
                <TabCard
                  icon={BookOpen} iconBg="#EEF2FF" iconColor="#4338CA"
                  title="GL Impact" subtitle="How this run posts to the general ledger, account by account."
                  badge={
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
                      {glRows.length} lines
                    </span>
                  }
                >
                  {/* Plain-language explainer, the invoice GL tab's row. */}
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Executing debits Accounts Payable for the invoices the run settles, debits the advances account for any pre-invoices it pays, and credits each pay-from account for the cash leaving it. The two sides always balance to zero.
                    </p>
                  </div>
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50/60 border-b border-slate-100">
                      <tr>
                        <th className={`${TH} pl-5`} style={{ fontWeight: 700 }}>Account</th>
                        <th className={`${TH} text-right`} style={{ fontWeight: 700 }}>Debit</th>
                        <th className={`${TH} text-right pr-5`} style={{ fontWeight: 700 }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {glRows.map((l, i) => {
                        // Direction arrows, the Record Payment / invoice GL
                        // tab recipe: green up when the entry increases the
                        // account, red down when it decreases it.
                        const isAsset = l.code.startsWith('1');
                        const isExpense = l.code.startsWith('5') || l.code.startsWith('6');
                        const isDebit = l.debit > 0;
                        const up = isAsset || isExpense ? isDebit : !isDebit;
                        const kind = isAsset ? 'asset' : isExpense ? 'expense' : 'liability';
                        const dirExplain = `${isDebit ? 'Debit' : 'Credit'} ${up ? 'increases' : 'decreases'} this ${kind} account, ${l.code} ${l.name}.`;
                        return (
                        <tr key={i} className="hover:bg-[#F8FAFF] transition-colors">
                          <td className="pl-5 px-4 py-2.5">
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] bg-slate-100/80 text-slate-500 border border-slate-200/60"
                              style={{ fontWeight: 600 }}
                            >
                              {l.code}
                            </span>
                            <span className="text-foreground ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle cursor-help"
                                  aria-label={up ? 'Increases' : 'Decreases'}
                                  style={up
                                    ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                    : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
                                >
                                  {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] z-[300]">
                                <p className="text-[11px] leading-snug" style={{ fontWeight: 600, color: up ? '#047857' : '#E11D48' }}>{up ? 'Increases' : 'Decreases'}</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{dirExplain}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-4 py-2.5 text-right ">{l.debit > 0 ? <span style={{ fontWeight: 600 }}>{money(l.debit)}</span> : <span className="text-slate-300">·</span>}</td>
                          <td className="px-4 py-2.5 pr-5 text-right ">{l.credit > 0 ? <span style={{ fontWeight: 600 }}>{money(l.credit)}</span> : <span className="text-slate-300">·</span>}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/70">
                        <td className="pl-5 px-4 py-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                            <CheckCircle2 className="w-2.5 h-2.5" /> Debit = Credit
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right " style={{ fontWeight: 700 }}>{money(glRows.reduce((s, l) => s + l.debit, 0))}</td>
                        <td className="px-4 py-2 pr-5 text-right " style={{ fontWeight: 700 }}>{money(glRows.reduce((s, l) => s + l.credit, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </TabCard>
                </div>
              )}

              {/* ── Attachments tab — the global standard (partner /
                  invoice AttachmentsTab): search, upload, density
                  selector, tinted thumbnails. Seeded from the run's real
                  per-vendor files. ── */}
              {/* The invoice Notes tab (user 10/22/26), notes kept in App
                  state per run like invoice notes. */}
              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes}
                  onAddNote={(text) => onAddNote?.(text)}
                  onUpdateNote={(noteId, text) => onUpdateNote?.(noteId, text)}
                  onDeleteNote={(noteId) => onDeleteNote?.(noteId)}
                  recordNoun="payment run"
                />
              )}
              {activeTab === 'communication' && (
                <ComingSoonTab
                  label="Communication"
                  icon={MessageSquare}
                  description="Message history for this run, with your team and the vendors being paid, will live here. The shared communication surface keeps every conversation attached to the record it is about."
                />
              )}
              {activeTab === 'attachments' && <AttachmentsTab run={run} />}

              {activeTab === 'activity' && (
                <ComingSoonTab
                  label="Recent Activity"
                  icon={History}
                  description="A chronological audit trail of every action on this run: creation, approval, execution, and recording. The activity feed arrives with backend integration."
                />
              )}

            </div>

            {/* ── RIGHT: sticky sidebar. ── */}
            <RunDetailSidebar
              run={run}
              lines={lines}
              totals={totals}
              total={total}
              statusPalette={statusPalette}
              displayStatus={displayStatus}
            />
          </div>
        </div>
      </div>

      {/* ── Approval decisions — page-level heads-up modals (8/4/26):
          all the review data already lives on this page, so approving
          and rejecting are light confirmations, no extra workspace. ── */}
      <ApproveRunModal
        run={run}
        open={decision === 'approve' && run.status === 'Pending Approval'}
        onClose={() => setDecision(null)}
        onConfirm={confirmApprove}
      />
      {/* Request changes — the issue-builder form modal (8/5/26). Also
          opened pre-scoped from a line's flag action. */}
      <RunRequestChangesModal
        run={run}
        open={(decision === 'requestChanges' || flagInvoiceId !== null) && run.status === 'Pending Approval'}
        initialInvoiceId={flagInvoiceId ?? undefined}
        onClose={() => { setDecision(null); setFlagInvoiceId(null); }}
        onConfirm={confirmRequestChanges}
      />
      {/* Move a flagged line to another run (fate 2). */}
      <MoveLineModal
        open={moveIssueId !== null}
        issue={run.changeRequest?.issues.find((i) => i.id === moveIssueId) ?? null}
        runs={runsApi.runs}
        sourceRunId={run.id}
        onClose={() => setMoveIssueId(null)}
        onMove={moveIssue}
      />
      {/* Hold / cancel — the invoice module's reason dialog AS IS
          (8/4/26), with run copy from runReasonConfigs. */}
      <InvoiceReasonDialog
        open={decision === 'hold' && preExecution && !held}
        onOpenChange={(o) => { if (!o) setDecision(null); }}
        action="paymentHold"
        count={1}
        currentStatus={run.status}
        configOverride={RUN_HOLD_OVERRIDE}
        onConfirm={(reason) => confirmHold(reason)}
      />
      {/* Vendor-level hold (Jennifer 9/1/26) — same reason dialog, scoped
          to one vendor so a single dispute never blocks the whole run. */}
      <InvoiceReasonDialog
        open={!!holdVendorTarget}
        onOpenChange={(o) => { if (!o) setHoldVendorTarget(null); }}
        action="paymentHold"
        count={1}
        configOverride={{
          targetLabel: 'Vendor Hold',
          title: `Hold ${holdVendorTarget ?? 'this vendor'} out of the run?`,
          description:
            'One vendor never holds up the rest. This vendor’s payment leaves the run and its invoices return to the payable pool; every other payment proceeds. Before execution, one click puts it back.',
          actionText: 'Hold Vendor',
        }}
        onConfirm={(reason) => confirmVendorHold(reason)}
      />
      <InvoiceReasonDialog
        open={decision === 'cancel' && cancellable}
        onOpenChange={(o) => { if (!o) setDecision(null); }}
        action="cancel"
        count={1}
        currentStatus={run.status}
        configOverride={RUN_CANCEL_OVERRIDE}
        onConfirm={(reason) => confirmCancel(reason)}
      />
      {/* Resolve and resubmit — the heads-up (8/5/26): confirming
          reopens the run in the authoring modal. */}
      <ResubmitRunModal
        run={run}
        open={decision === 'resubmit' && run.status === 'Changes Requested'}
        onClose={() => setDecision(null)}
        onConfirm={confirmResubmit}
      />
      <ReturnToPendingModal
        run={run}
        open={decision === 'returnToPending' && run.status === 'Approved'}
        onClose={() => setDecision(null)}
        onConfirm={confirmReturnToPending}
      />
      <WithdrawRunModal
        run={run}
        open={decision === 'withdraw' && run.status === 'Pending Approval'}
        onClose={() => setDecision(null)}
        onConfirm={confirmWithdraw}
      />

      {/* Status-change celebration — the shared State Transitioned
          overlay, keyed to the run tones. */}
      <InvoiceTransitionOverlay
        visible={!!transition}
        fromStatus={transition?.from ?? run.status}
        toStatus={transition?.to ?? run.status}
        tone="run"
        onDismiss={() => setTransition(null)}
      />

      {/* ── Check print flow (BA spec 9/22): review with warnings, the
          real-PDF preview at 100%, then the blocking confirm. Issued
          numbers land on the payments as their check references. ── */}
      {checkPrintAccount && (
        <CheckPrintFlow
          key={checkPrintAccount}
          open
          onOpenChange={(o) => {
            if (o) return;
            // The flow closes itself right after onIssued, which already
            // routed to the next account: ignore that close.
            if (justIssuedRef.current) {
              justIssuedRef.current = false;
              return;
            }
            // Closing mid-batch leaves the rest on the unprinted list.
            setCheckPrintAccount(null);
            if (printOnly) finishCheckBatch();
          }}
          bankAccountId={checkPrintAccount}
          bankAccountLabel={PAY_FROM_ACCOUNTS.find((a) => a.id === checkPrintAccount)?.label ?? checkPrintAccount}
          payments={checkInputsFor(checkPrintAccount)}
          initialNumber={printOnly?.starts[checkPrintAccount]}
          onIssued={(issued) => {
            issued.forEach(({ paymentRef, checkNumbers }) => {
              const p = runPayments.find((x) => x.paymentNumber === paymentRef);
              if (p && checkNumbers[0]) {
                p.reference = `CHK-${checkNumbers[0]}`;
                // Durable print trail (Eli 9/25): the payment remembers who
                // confirmed the print and when.
                p.checkPrint = { status: 'printed', by: APPROVER, at: new Date().toISOString().split('T')[0] };
              }
            });
            // A recorded batch prints account by account (user 10/21/26).
            justIssuedRef.current = true;
            const nextAccount = printOnly
              ? runPayments.find((p) => printOnly.ids.includes(p.id) && !p.checkPrint)?.bankAccount
              : undefined;
            setCheckPrintAccount(nextAccount ?? null);
            if (!nextAccount && printOnly) finishCheckBatch();
          }}
        />
      )}

      <RunChecksRecordedModal
        run={run}
        checks={recordedCheckPayments}
        startNumbers={recordedChecks?.starts ?? {}}
        open={checkChoiceOpen && !transition}
        onPrintNow={() => {
          if (!recordedChecks) return;
          setCheckChoiceOpen(false);
          setPrintOnly(recordedChecks);
          setCheckPrintAccount(recordedCheckPayments[0]?.bankAccount ?? null);
        }}
        onPrintLater={() => {
          finishCheckBatch();
          toast.info('Checks left to print later', {
            description: 'They stay on the unprinted checks list in Payment history and under Actions, Print Checks.',
          });
        }}
        onManual={() => {
          setCheckChoiceOpen(false);
          setManualQueue(recordedCheckPayments.map((p) => p.id));
        }}
      />
      {/* Manual checks log one payment at a time; Cancel stops the batch. */}
      <ManualCheckModal
        payment={runPayments.find((p) => p.id === manualQueue[0]) ?? null}
        onLogged={() => { manualLoggedRef.current = true; }}
        onClose={() => {
          const logged = manualLoggedRef.current;
          manualLoggedRef.current = false;
          const rest = logged ? manualQueue.slice(1) : [];
          setManualQueue(rest);
          if (rest.length === 0) finishCheckBatch();
        }}
      />

      {action === 'execute' && (run.status === 'Approved' || run.status === 'Partially Executed') && (
        (() => {
          // Two steps (Eli 10/5; header recipe user 10/15): record the
          // non-check payments, then process the checks. Stepper only
          // when the run actually pays by check.
          const live = run.groups.filter((g) => groupLines(run, g.vendor).length > 0);
          const hasChecks = live.some((g) => g.methodType === 'Check');
          const paymentsDone = !live.some((g) => !g.paymentId && g.methodType !== 'Check');
          const checksDone = hasChecks && !live.some((g) => !g.paymentId && g.methodType === 'Check');
          const onChecks = hasChecks && execPhase === 'checks';
          const scheduledRun = run.paymentDate > localTodayIso();
          return (
            <RunActionModal
              run={run}
              title={onChecks ? 'Process Checks' : 'Record Payments'}
              flush
              subtitle={onChecks
                ? `${run.id} · Set the starting check number for each bank account and record the checks, then print now, print later or log a manual check.`
                : `${run.id} · ${run.groups.length} payment${run.groups.length === 1 ? '' : 's'} · ${money(total)} · ${
                    scheduledRun
                      ? `Posts as Scheduled for ${humanDate(run.paymentDate)}. Tick the vendors to record now, or record them all.`
                      : 'Posts as Paid. Tick the vendors to record now, or record them all.'
                  }`}
              icon={
                // Green Banknote — the Record Payment module's identity (8/5/26).
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
                  <Banknote className="w-5 h-5" />
                </div>
              }
              stepper={hasChecks ? (
                <FlowStepTabs
                  steps={[
                    { id: 'payments', label: 'Record Payments', completed: paymentsDone },
                    { id: 'checks', label: 'Process Checks', completed: checksDone },
                  ]}
                  active={execPhase}
                  onNavigate={(id) => setExecPhase(id as ExecutePhase)}
                />
              ) : undefined}
              onClose={() => setAction(null)}
            >
              <RunExecuteStage
                run={run}
                invoices={invoices}
                payments={payments}
                runsApi={runsApi}
                phase={hasChecks ? execPhase : 'payments'}
                onPhaseChange={setExecPhase}
                onAllRecorded={() => setGlSummaryOpen(true)}
                onDone={() => setAction(null)}
                onChecksRecorded={(ids, starts) => {
                  setRecordedChecks({ ids, starts });
                  setCheckChoiceOpen(true);
                }}
              />
            </RunActionModal>
          );
        })()
      )}

      <ReleaseHoldDialog
        open={releaseOpen && !!run.hold}
        onOpenChange={setReleaseOpen}
        description="The run can be approved and recorded again. Its status doesn't change."
        holdBy={run.hold?.by}
        holdAt={run.hold?.at}
        notifyHelper="Choose who should hear about the release."
        onConfirm={confirmRelease}
      />

      <RunGlSummaryModal
        run={run}
        payments={runPayments}
        open={glSummaryOpen && !transition && !checkChoiceOpen && !checkPrintAccount && manualQueue.length === 0}
        onClose={() => setGlSummaryOpen(false)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sidebar — collapsible sections (PaymentDetailSidebar recipe)
// ══════════════════════════════════════════════════════════════════
function SidebarSection({
  icon: Icon, title, open, onToggle, children, collapsedSummary,
}: {
  icon: React.ElementType; title: string; open: boolean; onToggle: () => void;
  children: React.ReactNode; collapsedSummary?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {!open && collapsedSummary && (
            <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{collapsedSummary}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <CollapseReveal open={open}>
        <div className="px-4 pb-4">{children}</div>
      </CollapseReveal>
    </div>
  );
}

/** Partner-information field, the DashInfoLabel recipe verbatim
 *  (8/5/26): 10px slate-400 label, 12px slate-700 medium value. */
function InfoField({ label, tone, children }: { label: string; tone?: 'amber' | 'rose'; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] mb-px"
        style={{ fontWeight: 500, color: tone === 'amber' ? '#B45309' : tone === 'rose' ? '#BE123C' : 'var(--color-slate-400)' }}
      >
        {label}
      </p>
      <div className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{children}</div>
    </div>
  );
}

/** By/On field pair for one lifecycle event, the partner card's bottom
 *  "Created By · Last Updated" recipe. */
function PersonFields({ label, name, date, tone }: { label: string; name: string; date: string; tone?: 'amber' | 'rose' }) {
  return (
    <>
      <InfoField label={`${label} By`} tone={tone}>
        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full mt-0.5">
          <PhotoPersonAvatar name={name} size="sm" />
          <span className="truncate">{name}</span>
        </span>
      </InfoField>
      {/* The On value rides the same baseline as the By name (9/2/26
          review): matched top margin + the avatar row's height so the
          pair reads as one line across both columns. */}
      <InfoField label={`${label} On`} tone={tone}>
        <span className="inline-flex items-center mt-0.5 min-h-[20px]">{humanDate(date)}</span>
      </InfoField>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// Linked Records — the invoice detail's sectioned recipe: a toolbar
// card (search + type pills + count), then one collapsible card per
// record type with a compact table.
// ══════════════════════════════════════════════════════════════════
function RunLinkedRecordsTab({
  run,
  lines,
  runPayments,
  onViewPayment,
}: {
  run: PaymentRun;
  lines: ReturnType<typeof liveLines>;
  runPayments: Payment[];
  onViewPayment: (payment: Payment) => void;
}) {
  const [activeChip, setActiveChip] = useState<'all' | 'invoices' | 'payments'>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const executed = ['Executed', 'Partially Executed', 'Completed'].includes(run.status);
  const q = query.trim().toLowerCase();
  const invoiceRows = lines.filter(
    (l) => !q || l.invoiceNumber.toLowerCase().includes(q) || l.vendor.toLowerCase().includes(q),
  );
  const paymentRows = runPayments.filter(
    (p) => !q || p.paymentNumber.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q) || p.paymentMethod.toLowerCase().includes(q),
  );

  const chips = [
    { key: 'all' as const, label: 'All', count: lines.length + runPayments.length },
    { key: 'invoices' as const, label: 'Invoices', count: lines.length },
    { key: 'payments' as const, label: 'Payments', count: runPayments.length },
  ];
  const resultCount =
    (activeChip !== 'payments' ? invoiceRows.length : 0) + (activeChip !== 'invoices' ? paymentRows.length : 0);

  const paymentStatusPill = (status: string) => {
    const tone = status === 'Paid'
      ? { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' }
      : status === 'Scheduled'
        ? { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
        : { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap"
        style={{ fontWeight: 500, backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
      >
        {status}
      </span>
    );
  };

  const section = (
    key: string,
    icon: React.ElementType,
    tone: { bg: string; text: string; border: string },
    title: string,
    count: number,
    total: number,
    table: React.ReactNode,
  ) => {
    const Icon = icon;
    const open = collapsed[key] !== true;
    return (
      <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-[#fafbfc] hover:bg-[#f4f6f9] transition-colors cursor-pointer outline-none"
          style={{ borderBottom: open ? '1px solid #EEF2F6' : 'none' }}
          aria-expanded={open}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
            style={{ backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="text-foreground text-left text-[13px]" style={{ fontWeight: 600 }}>{title}</span>
          <span
            className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px] "
            style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            {count}
          </span>
          {total > 0 && (
            <span className="ml-auto text-foreground text-[13px]" style={{ fontWeight: 600 }}>
              {money(total)}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ${total > 0 ? 'ml-2.5' : 'ml-auto'}`}
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            aria-hidden="true"
          />
        </button>
        {open && <div className="overflow-x-auto">{table}</div>}
      </div>
    );
  };

  const headCell = (label: string, align = 'text-left', extra = '') => (
    <th
      key={label}
      scope="col"
      className={`py-2 px-4 text-[11px] text-muted-foreground/60 whitespace-nowrap ${align} ${extra}`}
      style={{ fontWeight: 600 }}
    >
      {label}
    </th>
  );

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Linked Records">
      {/* ── Toolbar card — search + type pills. ── */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <input
              placeholder="Search reference or vendor…"
              className="w-full pl-9 pr-8 h-9 text-sm rounded-lg border bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-sm hidden sm:inline shrink-0" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{resultCount}</span>
            <span className="text-muted-foreground/70"> record{resultCount !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
          {chips.map((chip) => {
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setActiveChip(chip.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-primary bg-accent'
                    : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30'
                }`}
                style={isActive ? { color: 'hsl(var(--primary))', fontWeight: 500 } : { fontWeight: 400 }}
              >
                {chip.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? 'bg-primary/10' : 'bg-muted'}`}
                  style={{ color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* No match for the search (Table Empty & Error States Standard,
          11/3/26): compact in a tab; the chip counts as a filter. */}
      {q && resultCount === 0 && (
        <div className="rounded-xl border border-border bg-white">
          <TableEmptyState
            compact
            kind={activeChip === 'all' ? 'no-results' : 'no-results-filtered'}
            entity={{ singular: 'linked record', plural: 'linked records' }}
            searchQuery={query}
            suggestion={findSearchSuggestion(query, [...lines.flatMap((l) => [l.invoiceNumber, l.vendor]), ...runPayments.flatMap((p) => [p.paymentNumber, p.vendor, p.paymentMethod])])}
            onApplySuggestion={setQuery}
            filterCount={activeChip === 'all' ? 0 : 1}
            onClearSearch={() => setQuery('')}
            onClearFilters={() => setActiveChip('all')}
            onClearAll={() => { setQuery(''); setActiveChip('all'); }}
          />
        </div>
      )}

      {/* ── Invoices section ── */}
      {activeChip !== 'payments' && invoiceRows.length > 0 &&
        section(
          'invoices',
          Receipt,
          { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
          'Invoices',
          invoiceRows.length,
          invoiceRows.reduce((s, l) => s + l.payAmount, 0),
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="border-b border-border bg-white">
                {headCell('Reference', 'text-left')}
                {headCell('Vendor', 'text-left', 'hidden sm:table-cell')}
                {headCell('Status', 'text-left')}
                {headCell('Due Date', 'text-left', 'hidden md:table-cell')}
                {headCell('Amount', 'text-right')}
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((l) => {
                const payment = runPayments.find((p) => p.vendor === l.vendor);
                return (
                  <tr
                    key={l.invoiceId}
                    onClick={() => openInvoiceTab(l.invoiceNumber)}
                    className="border-b border-border/70 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <span className="text-foreground hover:text-primary hover:underline text-[12px] truncate block" style={{ fontWeight: 600 }}>
                        {highlightText(l.invoiceNumber, query)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      <span className="text-muted-foreground truncate block">{highlightText(l.vendor, query)}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      {executed && payment ? paymentStatusPill(payment.status) : paymentStatusPill('In Run')}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap hidden md:table-cell">{humanDate(l.dueDate)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{money(l.payAmount)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>,
        )}

      {/* ── Payments section ── */}
      {activeChip !== 'invoices' && (
        runPayments.length > 0 ? (
          paymentRows.length > 0 &&
          section(
            'payments',
            Banknote,
            { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
            'Payments',
            paymentRows.length,
            paymentRows.reduce((s, p) => s + p.amount, 0),
            <table className="w-full table-fixed text-[12px]">
              <thead>
                <tr className="border-b border-border bg-white">
                  {headCell('Reference', 'text-left')}
                  {headCell('Vendor', 'text-left', 'hidden sm:table-cell')}
                  {headCell('Status', 'text-left')}
                  {headCell('Date', 'text-left', 'hidden md:table-cell')}
                  {headCell('Amount', 'text-right')}
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onViewPayment(p)}
                    className="border-b border-border/70 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      {/* The number opens its record in a NEW TAB (user
                          10/5); the row click keeps the in-app route. */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); window.open(`/payments-v2/${encodeURIComponent(p.paymentNumber)}`, '_blank', 'noopener'); }}
                        className="text-foreground hover:text-primary hover:underline underline-offset-2 text-[12px] truncate block text-left cursor-pointer bg-transparent border-0 p-0"
                        style={{ fontWeight: 600 }}
                      >
                        {highlightText(p.paymentNumber, query)}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      <span className="text-muted-foreground truncate block">{highlightText(p.vendor, query)} · {highlightText(p.paymentMethod, query)}</span>
                    </td>
                    <td className="py-2.5 px-4">{paymentStatusPill(p.status)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap hidden md:table-cell">{humanDate(p.paymentDate)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-foreground" style={{ fontWeight: 600 }}>{money(p.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )
        ) : (
          activeChip === 'payments' && !q && (
            <div className="rounded-xl border border-border bg-white">
              <TableEmptyState
                compact
                kind="no-data"
                entity={{ singular: 'payment', plural: 'payments' }}
                title="No linked payments yet"
                description="They post at execution, one per vendor."
              />
            </div>
          )
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Payments tab (BA 8/12/26, third pass) — view-only, so it reads like
// the Vendor Invoicing listing: a toolbar card with search + method
// filter pills, then one compact accordion per pay-from account whose
// vendor table carries drag-to-reorder columns, listing sort menus, a
// saved-method cell with the partner hover card, and a three-dot row
// menu. Weights stay at 500 or lighter, nothing bold. Detail page
// ONLY; the authoring modal keeps its card composition.
// ══════════════════════════════════════════════════════════════════
type PayTableCol = 'vendor' | 'method' | 'status' | 'payment' | 'net';

const PAY_COLS: { key: PayTableCol; label: string; alignRight?: boolean; sortable?: boolean }[] = [
  { key: 'vendor', label: 'Vendor', sortable: true },
  { key: 'method', label: 'Payment Method', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'payment', label: 'Payment Record' },
  { key: 'net', label: 'Net Payment', alignRight: true, sortable: true },
];

interface PayRow {
  group: PaymentRun['groups'][number];
  glines: ReturnType<typeof liveLines>;
  payment?: Payment;
  accountLabel: string;
  savedMethod?: VendorPaymentMethod;
  net: number;
  credit: number;
}

function RunPaymentsTable({
  run,
  runPayments,
  executed,
  onViewPayment,
  onFlagLine,
  onRemoveLine,
  onRemoveVendor,
}: {
  run: PaymentRun;
  runPayments: Payment[];
  executed: boolean;
  onViewPayment: (payment: Payment) => void;
  onFlagLine?: (invoiceId: string) => void;
  /** Pending-approval removals (user 9/23): one invoice, or the vendor's
   *  whole payment — soft-removed, back to the payable pool. */
  onRemoveLine?: (invoiceId: string, invoiceNumber: string) => void;
  onRemoveVendor?: (vendor: string) => void;
  /** Pre-execution vendor hold (Jennifer 9/1/26): pull ONE vendor out of
   *  the run with a reason and let everything else go through. */
}) {
  const [query, setQuery] = useState('');
  // Quick-filter dropdowns (BA 8/12/26): the listing's MultiSelectFilter
  // chips instead of a pill wall — one per method, one per account.
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  // Section grouping (user 10/5): the accordions can cluster by pay-from
  // account (the default, with balance context) or by payment method.
  const [sectionGroupMode, setSectionGroupMode] = useState<'account' | 'method'>('account');
  const [sort, setSort] = useState<{ col: PayTableCol; dir: 'asc' | 'desc' }>({ col: 'vendor', dir: 'asc' });
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Column order is user-draggable (the listing recipe); Status hides
  // pre-execution without disturbing the saved order.
  const [colOrder, setColOrder] = useState<PayTableCol[]>(PAY_COLS.map((c) => c.key));
  const dragColRef = useRef<PayTableCol | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PayTableCol | null>(null);
  const visibleCols = colOrder.filter((k) => (executed ? true : k !== 'status'));

  const lines = liveLines(run);
  const allRows = useMemo(
    () =>
      run.groups.map((g): PayRow => {
        const glines = lines.filter((l) => l.vendor === g.vendor);
        // A vendor paid in part (user 10/21/26) has partial payments but
        // no paymentId yet: the row links its latest one and reads
        // Partially paid until the rest records.
        const latestPartial = (g.partialPaymentIds ?? []).slice(-1)[0];
        const payment =
          (g.paymentId && runPayments.find((p) => p.id === g.paymentId)) ||
          (latestPartial && runPayments.find((p) => p.id === latestPartial)) ||
          (g.paymentId ? runPayments.find((p) => p.vendor === g.vendor) : undefined);
        const account = PAY_FROM_ACCOUNTS.find((a) => a.id === g.payFromAccountId);
        return {
          group: g,
          glines,
          payment,
          accountLabel: account?.label ?? g.payFromAccountId,
          savedMethod: vendorPaymentMethods(g.vendor).find((m) => m.id === g.methodId),
          net: groupNet(run, g),
          credit: groupCredit(g),
        };
      }),
    [run, lines, runPayments],
  );

  // Quick-filter options with live counts.
  const methodOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    allRows.forEach((r) => {
      counts[r.group.methodType] = (counts[r.group.methodType] ?? 0) + 1;
    });
    return Object.keys(counts).sort().map((t) => ({ id: t, label: t, count: counts[t] }));
  }, [allRows]);
  const accountOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    allRows.forEach((r) => {
      counts[r.group.payFromAccountId] = (counts[r.group.payFromAccountId] ?? 0) + 1;
    });
    return PAY_FROM_ACCOUNTS.filter((a) => counts[a.id]).map((a) => ({ id: a.id, label: a.label, count: counts[a.id] }));
  }, [allRows]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      if (methodFilter.length > 0 && !methodFilter.includes(r.group.methodType)) return false;
      if (accountFilter.length > 0 && !accountFilter.includes(r.group.payFromAccountId)) return false;
      if (!q) return true;
      return (
        r.group.vendor.toLowerCase().includes(q) ||
        r.accountLabel.toLowerCase().includes(q) ||
        r.group.methodType.toLowerCase().includes(q) ||
        (r.savedMethod ? methodSummary(r.savedMethod).toLowerCase().includes(q) : false) ||
        (r.payment?.paymentNumber.toLowerCase().includes(q) ?? false) ||
        r.glines.some((l) => l.invoiceNumber.toLowerCase().includes(q))
      );
    });
    const accessor: Record<PayTableCol, (r: PayRow) => string | number> = {
      vendor: (r) => r.group.vendor,
      method: (r) => r.group.methodType,
      status: (r) => r.payment?.status ?? '',
      payment: (r) => r.payment?.paymentNumber ?? '',
      net: (r) => r.net,
    };
    const mul = sort.dir === 'asc' ? 1 : -1;
    const sortRows = (a: PayRow, b: PayRow) => {
      const va = accessor[sort.col](a);
      const vb = accessor[sort.col](b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * mul;
    };
    if (sectionGroupMode === 'method') {
      // Method sections (user 10/5): one accordion per payment method.
      // No balance context — that's an account fact.
      const methods = [...new Set(filtered.map((r) => r.group.methodType))].sort();
      return methods.map((m) => {
        const rows = filtered.filter((r) => r.group.methodType === m).sort(sortRows);
        return { key: `m-${m}`, label: m, account: null as (typeof PAY_FROM_ACCOUNTS)[number] | null, rows, net: rows.reduce((s, r) => s + r.net, 0) };
      });
    }
    return accountTotals(run)
      .map((t) => {
        const rows = filtered.filter((r) => r.group.payFromAccountId === t.account.id).sort(sortRows);
        return { key: t.account.id, label: t.account.label, account: t.account, rows, net: rows.reduce((s, r) => s + r.net, 0) };
      })
      .filter((s) => s.rows.length > 0);
  }, [allRows, run, query, methodFilter, accountFilter, sort, sectionGroupMode]);
  const shownCount = sections.reduce((s, sec) => s + sec.rows.length, 0);
  const payQuerySuggestion = useMemo(
    () =>
      shownCount === 0 && query.trim()
        ? findSearchSuggestion(
            query,
            allRows.flatMap((r) => [r.group.vendor, r.accountLabel, r.group.methodType, r.payment?.paymentNumber, ...r.glines.map((l) => l.invoiceNumber)]),
          )
        : null,
    [shownCount, query, allRows],
  );

  const toggleRow = (vendor: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });

  const statusPill = (status: string) => {
    const tone = status === 'Paid'
      ? { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' }
      : status === 'Scheduled'
        ? { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
        : status === 'Partially Paid'
          ? { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' }
          : { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap"
        style={{ fontWeight: 500, backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
      >
        {status}
      </span>
    );
  };

  const reorderCols = (from: PayTableCol, to: PayTableCol) =>
    setColOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });

  // The listing header recipe: quiet hover, Sort ascending/descending
  // dropdown, direction arrow on the active column, drag to reorder.
  const HeaderCell = ({ col }: { col: (typeof PAY_COLS)[number] }) => {
    const active = sort.col === col.key;
    const label = (
      <>
        {col.label}
        {col.sortable && active &&
          (sort.dir === 'asc' ? (
            <ArrowUp className="w-3 h-3 shrink-0 text-slate-500" />
          ) : (
            <ArrowDown className="w-3 h-3 shrink-0 text-slate-500" />
          ))}
      </>
    );
    return (
      <th
        className={`p-0 ${col.alignRight ? 'text-right' : 'text-left'} ${dragOverCol === col.key ? 'bg-blue-50/70' : ''} transition-colors`}
        draggable
        onDragStart={(e) => {
          dragColRef.current = col.key;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', col.key);
        }}
        onDragOver={(e) => {
          if (dragColRef.current && dragColRef.current !== col.key) {
            e.preventDefault();
            setDragOverCol(col.key);
          }
        }}
        onDragLeave={() => setDragOverCol((v) => (v === col.key ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          const from = dragColRef.current;
          if (from && from !== col.key) reorderCols(from, col.key);
          dragColRef.current = null;
          setDragOverCol(null);
        }}
        onDragEnd={() => {
          dragColRef.current = null;
          setDragOverCol(null);
        }}
      >
        {col.sortable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`group inline-flex items-center gap-1 w-full px-3 py-2.5 text-[12px] text-foreground cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap ${
                  col.alignRight ? 'justify-end pr-4' : ''
                }`}
                style={{ fontWeight: 500 }}
              >
                {label}
                {/* One state icon only, the listing recipe (8/12/26): idle
                    sortable columns reveal the sort affordance on hover,
                    never a chevron beside the direction arrow. */}
                {!active && (
                  <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={col.alignRight ? 'end' : 'start'} className="z-[200] w-[220px] p-0">
              {/* Eyebrow header + item styling lifted from the listing's
                  ColumnHeaderMenu so both menus read as one component. */}
              <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 600 }}>
                  {col.label}
                </span>
                {active && sort.dir === 'asc' && <ArrowUp className="w-3 h-3 text-primary shrink-0" />}
                {active && sort.dir === 'desc' && <ArrowDown className="w-3 h-3 text-primary shrink-0" />}
              </div>
              <div className="border-t border-border/60" />
              <div className="py-1 px-1">
                <DropdownMenuItem
                  className={`cursor-pointer gap-2.5 px-2.5 py-[7px] text-[13px] ${
                    active && sort.dir === 'asc' ? 'text-primary bg-primary/5' : 'text-foreground'
                  }`}
                  onClick={() => setSort({ col: col.key, dir: 'asc' })}
                >
                  <ArrowUp className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Sort ascending</span>
                  {active && sort.dir === 'asc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={`cursor-pointer gap-2.5 px-2.5 py-[7px] text-[13px] ${
                    active && sort.dir === 'desc' ? 'text-primary bg-primary/5' : 'text-foreground'
                  }`}
                  onClick={() => setSort({ col: col.key, dir: 'desc' })}
                >
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Sort descending</span>
                  {active && sort.dir === 'desc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span
            className={`inline-flex items-center gap-1 w-full px-3 py-2.5 text-[12px] text-foreground whitespace-nowrap ${col.alignRight ? 'justify-end pr-4' : ''}`}
            style={{ fontWeight: 500 }}
          >
            {label}
          </span>
        )}
      </th>
    );
  };

  // One cell renderer per column so drag-reorder just re-maps the row.
  const cellFor = (r: PayRow, key: PayTableCol) => {
    switch (key) {
      case 'vendor':
        return (
          <td key={key} className="px-2.5 py-2">
            <span className="flex items-center gap-2.5 min-w-0">
              <VendorAvatar name={r.group.vendor} size="sm" />
              <span className="min-w-0">
                <span className="block text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>
                  {highlightText(r.group.vendor, query)}
                </span>
                <span className="block text-[10.5px] text-slate-400" style={{ fontWeight: 400 }}>
                  {r.glines.length} invoice{r.glines.length === 1 ? '' : 's'}
                  {r.credit > 0.004 && <span className="text-purple-600"> · vendor credit applied</span>}
                </span>
              </span>
            </span>
          </td>
        );
      case 'method': {
        const MIcon = paymentMethodInfo(r.group.methodType).icon;
        const summary = r.savedMethod ? methodSummary(r.savedMethod) : undefined;
        const dataRows = r.savedMethod ? methodDataRows(r.savedMethod) : [];
        const cell = (
          <span className="inline-flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
            <MIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {highlightText(r.group.methodType, query)}
            {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
            {summary && <span className="text-slate-400"> · {highlightText(summary, query)}</span>}
          </span>
        );
        if (!r.savedMethod || dataRows.length === 0) return <td key={key} className="px-2.5 py-2">{cell}</td>;
        // Hover card — the partner Payment Methods card, read-only.
        return (
          <td key={key} className="px-2.5 py-2">
            <HoverCard openDelay={300} closeDelay={120}>
              <HoverCardTrigger asChild>
                <span className="cursor-default">{cell}</span>
              </HoverCardTrigger>
              <HoverCardContent
                side="top"
                align="start"
                className="w-[280px] p-0 rounded-xl border border-border shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300] bg-white"
              >
                <div className="px-4 py-3 flex items-center gap-3 border-b border-border/60">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                    <MIcon className="w-[18px] h-[18px]" style={{ color: '#1D4ED8' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>{r.savedMethod.nickname}</p>
                    <span
                      className="inline-flex items-center mt-0.5 px-1.5 py-px rounded-full text-[10px]"
                      style={{ fontWeight: 500, backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                    >
                      {r.group.methodType}
                    </span>
                  </div>
                  {r.savedMethod.isPrimary && (
                    <span
                      className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]"
                      style={{ fontWeight: 500, backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                    >
                      Primary
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1.5">
                    {dataRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="text-slate-700 " style={{ fontWeight: 500 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </td>
        );
      }
      case 'status':
        return (
          <td key={key} className="px-2.5 py-2">
            {r.payment ? statusPill(r.group.paymentId ? r.payment.status : 'Partially Paid') : statusPill('In Run')}
          </td>
        );
      case 'payment':
        return (
          <td key={key} className="px-2.5 py-2" onClick={(e) => e.stopPropagation()}>
            {r.payment ? (
              <button
                type="button"
                onClick={() => onViewPayment(r.payment!)}
                className="text-[12px] text-primary hover:underline cursor-pointer p-0 bg-transparent border-0 whitespace-nowrap"
                style={{ fontWeight: 500 }}
              >
                {highlightText(r.payment.paymentNumber, query)}
              </button>
            ) : (
              <span className="text-slate-300">·</span>
            )}
          </td>
        );
      case 'net':
        return (
          <td key={key} className="px-4 py-2.5 text-right">
            <span className="text-foreground" style={{ fontWeight: 500 }}>{money(r.net)}</span>
          </td>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Payments">
      {/* Toolbar card — the Linked Records recipe: search row on top,
          method filter pills below. */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <input
              placeholder="Search vendor, invoice, account…"
              className="w-full pl-9 pr-8 h-9 text-sm rounded-lg border bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm hidden sm:inline" style={{ fontWeight: 400 }}>
              <span className="text-foreground" style={{ fontWeight: 500 }}>{shownCount}</span>
              <span className="text-muted-foreground/70"> payment{shownCount !== 1 ? 's' : ''}</span>
            </span>
            {/* Group control — toolbar dropdown in the listing density-menu
                chrome (user 10/5: one clean control up here, not a second
                segmented line under the toolbar). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <Landmark className="w-3.5 h-3.5 text-slate-400" />
                  Group · {sectionGroupMode === 'method' ? 'Method' : 'Account'}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[200] w-56">
                {([
                  { key: 'account', label: 'Account', description: 'One section per pay-from account', icon: Landmark },
                  { key: 'method', label: 'Method', description: 'One section per payment method', icon: Banknote },
                ] as const).map((o) => (
                  <DropdownMenuItem key={o.key} className="cursor-pointer" onClick={() => setSectionGroupMode(o.key)}>
                    <o.icon className="w-3.5 h-3.5 mr-2 text-current" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px]" style={{ fontWeight: 500 }}>{o.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{o.description}</span>
                    </span>
                    {sectionGroupMode === o.key && <Check className="w-3.5 h-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ChevronsDownUp className="w-3.5 h-3.5 text-slate-400" />
                  Collapse
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[200] w-52">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    setCollapsedAccounts(new Set());
                    setExpanded(new Set(run.groups.map((g) => g.vendor)));
                  }}
                >
                  <ChevronDown className="w-3.5 h-3.5 mr-2 text-current" />
                  Expand Everything
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setExpanded(new Set())}>
                  <ChevronsDownUp className="w-3.5 h-3.5 mr-2 text-current" />
                  Collapse Vendor Rows
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setCollapsedAccounts(new Set(sections.map((s) => s.key)))}
                >
                  <Landmark className="w-3.5 h-3.5 mr-2 text-current" />
                  {sectionGroupMode === 'method' ? 'Collapse Methods' : 'Collapse Accounts'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Quick-filter dropdown chips (BA 8/12/26): the listing's
            MultiSelectFilter axes — Payment method and Account. */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
          <MultiSelectFilter
            label="Payment Method"
            options={methodOptions}
            selected={methodFilter}
            onChange={setMethodFilter}
          />
          <MultiSelectFilter
            label="Account"
            searchable
            options={accountOptions}
            selected={accountFilter}
            onChange={setAccountFilter}
          />
          {/* Group control moved to the toolbar row as a dropdown (user
              10/5) — no second-line segmented strip. */}
        </div>
      </div>

      {sections.length === 0 ? (
        /* Table Empty & Error States Standard (11/3/26), compact in a tab. */
        <div className="border border-border rounded-xl bg-card">
          <TableEmptyState
            compact
            kind={resolveTableEmptyKind({ totalCount: allRows.length, filteredCount: shownCount, searchQuery: query, filterCount: methodFilter.length + accountFilter.length }) ?? 'no-data'}
            entity={{ singular: 'payment', plural: 'payments' }}
            searchQuery={query}
            suggestion={payQuerySuggestion}
            onApplySuggestion={setQuery}
            filterCount={methodFilter.length + accountFilter.length}
            onClearSearch={() => setQuery('')}
            onClearFilters={() => { setMethodFilter([]); setAccountFilter([]); }}
            onClearAll={() => { setQuery(''); setMethodFilter([]); setAccountFilter([]); }}
          />
        </div>
      ) : (
        sections.map((sec) => {
          const open = !collapsedAccounts.has(sec.key);
          return (
            <div
              key={sec.key}
              className={`border rounded-xl bg-card overflow-hidden transition-colors ${open ? 'border-primary/25' : 'border-border hover:border-primary/25'}`}
              style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              {/* Compact account header — open wears the blue working
                  tint (the authoring accordion identity) so the active
                  section reads apart from the grey rest. */}
              <button
                type="button"
                onClick={() =>
                  setCollapsedAccounts((prev) => {
                    const next = new Set(prev);
                    if (next.has(sec.key)) next.delete(sec.key);
                    else next.add(sec.key);
                    return next;
                  })
                }
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors cursor-pointer outline-none"
                style={{
                  backgroundColor: open ? '#F8FAFF' : '#FFFFFF',
                  borderBottom: open ? '1px solid #E4EDFB' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!open) e.currentTarget.style.backgroundColor = '#F0F7FF';
                }}
                onMouseLeave={(e) => {
                  if (!open) e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                aria-expanded={open}
              >
                {/* Per-section icon identity (user 10/8): every accordion
                    wore the same grey/blue tile, so finding the right
                    account meant reading every label. Each section now
                    carries its own deterministic tint — the invoicing
                    avatar-tint recipe — so they tell apart at a glance. */}
                {(() => {
                  const tint = getAvatarTint(sec.label);
                  return (
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-opacity"
                      style={{ backgroundColor: tint.bg, color: tint.fg, opacity: open ? 1 : 0.8 }}
                    >
                      {sec.account ? (
                        <Landmark className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        (() => {
                          const MIcon = paymentMethodInfo(sec.label).icon;
                          return <MIcon className="w-4 h-4" aria-hidden="true" />;
                        })()
                      )}
                    </div>
                  );
                })()}
                <span className={`text-left text-[13px] ${open ? 'text-foreground' : 'text-slate-600'}`} style={{ fontWeight: 500 }}>
                  {highlightText(sec.label, query)}
                </span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px] "
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 500 }}
                >
                  {sec.rows.length}
                </span>
                {/* Balance context (Jennifer 9/1/26): "there's $100,000 in
                    this account, I'm trying to take out 58" — the header
                    pairs the money OUT with what's actually IN the
                    account, and goes rose when the run would overdraw it.
                    Post-execution the money has moved, so it drops. */}
                <span className="ml-auto flex flex-col items-end leading-none">
                  <span
                    className={`text-[13px] ${!executed && sec.account && sec.net > sec.account.balance ? 'text-rose-600' : 'text-foreground'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {money(sec.net)}
                  </span>
                  {/* Balance context is an ACCOUNT fact — method sections
                      carry just their net. */}
                  {!executed && sec.account && (
                    <span
                      className={`text-[10px] mt-1 ${sec.net > sec.account.balance ? 'text-rose-500' : 'text-slate-400'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {sec.net > sec.account.balance
                        ? `${money(sec.account.balance)} in the account · short ${money(sec.net - sec.account.balance)}`
                        : `${money(sec.account.balance)} in the account · ${money(sec.account.balance - sec.net)} left after`}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className="w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ml-2.5"
                  style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  aria-hidden="true"
                />
              </button>
              {/* Waterfall expand/collapse (user 10/8) — the table body
                  animates height + fade instead of snapping in and out. */}
              <CollapseReveal open={open}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-border text-left">
                        <th className="w-9" />
                        {visibleCols.map((k) => (
                          <HeaderCell key={k} col={PAY_COLS.find((c) => c.key === k)!} />
                        ))}
                        {(executed || onRemoveVendor) && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((r) => {
                        const isOpen = expanded.has(r.group.vendor);
                        const colCount = visibleCols.length + 1 + (executed || onRemoveVendor ? 1 : 0);
                        const lineStatus = r.payment ? (r.payment.status === 'Scheduled' ? 'Scheduled' : 'Paid') : 'In Run';
                        return (
                          <React.Fragment key={r.group.vendor}>
                            <tr
                              onClick={() => toggleRow(r.group.vendor)}
                              className={`border-b border-border/60 transition-colors cursor-pointer ${isOpen ? 'bg-blue-50/40' : 'hover:bg-[#F8FAFF]'}`}
                            >
                              <td className="pl-3 pr-1 py-2.5">
                                <span
                                  className="w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors"
                                  style={{
                                    backgroundColor: isOpen ? '#D6E8FF' : 'transparent',
                                    color: isOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                  }}
                                >
                                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </span>
                              </td>
                              {visibleCols.map((k) => cellFor(r, k))}
                              {/* Three-dot row menu: post-execution it acts
                                  on the payment (BA 8/12/26); pre-execution
                                  it carries the vendor-level hold (Jennifer
                                  9/1/26) so one dispute never blocks the
                                  other vendors' payments. */}
                              {(executed || onRemoveVendor) && (
                                <td className="pr-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                  {executed ? (
                                    r.payment && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
                                            aria-label={`Actions for ${r.group.vendor}`}
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="z-[200] w-56">
                                          <DropdownMenuItem className="cursor-pointer" onClick={() => onViewPayment(r.payment!)}>
                                            <Banknote className="w-4 h-4 mr-2 text-current" />
                                            View Payment Details
                                          </DropdownMenuItem>
                                          {/* NACHA download removed (user 9/22). */}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
                                          aria-label={`Actions for ${r.group.vendor}`}
                                        >
                                          <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="z-[200] w-60">
                                        {/* Hold-vendor is gone from here (BA 9/25): the
                                            run edits are REMOVALS only — drop a single
                                            invoice from its sub-row, or drop the whole
                                            vendor section here. */}
                                        {onRemoveVendor && (
                                          <DropdownMenuItem
                                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                            onClick={() => onRemoveVendor(r.group.vendor)}
                                          >
                                            <Trash2 className="w-4 h-4 mr-2 text-current" />
                                            Remove Vendor from Run
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </td>
                              )}
                            </tr>
                            {/* Waterfall expand on the INNER layer too (user
                                10/8): the row's invoice sub-table animates
                                open/closed instead of snapping. The tr stays
                                mounted; closed = zero-height, borderless. */}
                            <tr className={isOpen ? 'border-b border-border/60' : 'border-b-0'}>
                              <td colSpan={colCount} className="p-0 border-0">
                                <CollapseReveal open={isOpen}>
                                  {/* Invoice sub-table — the Vendor Invoicing
                                      listing language: white surface, light
                                      header strip, 12.5px rows, weight 500
                                      tops. */}
                                  <div className="bg-white">
                                    <table className="w-full text-[12.5px]">
                                      <thead className="bg-slate-50">
                                        <tr className="border-b border-border/60 text-left text-[12px] text-slate-600">
                                          <th className="pl-12 pr-3 py-2" style={{ fontWeight: 500 }}>Invoice ID</th>
                                          <th className="px-3 py-2" style={{ fontWeight: 500 }}>Due Date</th>
                                          {executed && <th className="px-3 py-2" style={{ fontWeight: 500 }}>Status</th>}
                                          <th className="px-2.5 py-2 text-right" style={{ fontWeight: 500 }}>Amount Due</th>
                                          <th className="px-2.5 py-2 text-right" style={{ fontWeight: 500 }}>Paying</th>
                                          {(onFlagLine || onRemoveLine) && <th className="w-16" />}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.glines.map((l) => {
                                          const partial = l.payAmount < l.balanceAtAdd - 0.004;
                                          return (
                                            <tr key={l.invoiceId} className="border-b border-border/40 last:border-b-0 hover:bg-[#F8FAFF] transition-colors">
                                              <td className="pl-12 pr-3 py-2">
                                                <button
                                                  type="button"
                                                  onClick={() => openInvoiceTab(l.invoiceNumber)}
                                                  className="text-[12.5px] text-foreground hover:text-primary hover:underline cursor-pointer p-0 bg-transparent border-0 whitespace-nowrap"
                                                  style={{ fontWeight: 500 }}
                                                >
                                                  {highlightText(l.invoiceNumber, query)}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2">
                                                {/* One segmented pill (8/28/26 review): date + urgency
                                                    together; executed rows keep the plain date. */}
                                                {executed ? (
                                                  <span className="text-slate-600">{humanDate(l.dueDate)}</span>
                                                ) : (
                                                  <DueDatePill dueDate={l.dueDate} />
                                                )}
                                              </td>
                                              {executed && (
                                                <td className="px-3 py-2">
                                                  {statusPill(
                                                    // Partial passes (user 10/21/26) mark lines as they record.
                                                    r.group.paymentId
                                                      ? lineStatus
                                                      : (l.recordedAmount ?? 0) >= l.payAmount - 0.004
                                                        ? (r.payment?.status === 'Scheduled' ? 'Scheduled' : 'Paid')
                                                        : (l.recordedAmount ?? 0) > 0.004
                                                          ? 'Partially Paid'
                                                          : 'In Run',
                                                  )}
                                                </td>
                                              )}
                                              <td className="px-2.5 py-2 text-right text-slate-600">{money(l.balanceAtAdd)}</td>
                                              <td className="px-2.5 py-2 text-right text-slate-700" style={{ fontWeight: 500 }}>
                                                {money(l.payAmount)}
                                                {partial && (
                                                  <span className="block text-[10px] text-amber-700" style={{ fontWeight: 500 }}>
                                                    Partial · of {money(l.balanceAtAdd)}
                                                  </span>
                                                )}
                                              </td>
                                              {(onFlagLine || onRemoveLine) && (
                                                <td className="px-2 py-2 text-right whitespace-nowrap">
                                                  {onFlagLine && (
                                                    <Tooltip delayDuration={200}>
                                                      <TooltipTrigger asChild>
                                                        <button
                                                          type="button"
                                                          onClick={() => onFlagLine(l.invoiceId)}
                                                          className="w-6 h-6 rounded-md hover:bg-orange-50 hover:text-orange-600 text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                                                          aria-label={`Flag an issue on ${l.invoiceNumber}`}
                                                        >
                                                          <Flag className="w-3 h-3" />
                                                        </button>
                                                      </TooltipTrigger>
                                                      <TooltipContent className="z-[300]">Flag an issue on this invoice</TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                  {onRemoveLine && (
                                                    <Tooltip delayDuration={200}>
                                                      <TooltipTrigger asChild>
                                                        <button
                                                          type="button"
                                                          onClick={() => onRemoveLine(l.invoiceId, l.invoiceNumber)}
                                                          className="w-6 h-6 rounded-md hover:bg-red-50 hover:text-red-500 text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                                                          aria-label={`Remove ${l.invoiceNumber} from this run`}
                                                        >
                                                          <Trash2 className="w-3 h-3" />
                                                        </button>
                                                      </TooltipTrigger>
                                                      <TooltipContent className="z-[300]">Remove this invoice from the run</TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    {/* No Net line here (BA 8/12/26): the row's
                                        Net payment column already carries it. */}
                                    {(r.credit > 0.004 || r.group.note || r.group.reference) && (
                                      <div className="pl-12 pr-4 py-2 bg-slate-50/60 border-t border-border/50 min-w-0 space-y-0.5">
                                        {r.credit > 0.004 && (
                                          <p className="flex items-center gap-1.5 text-[11.5px] text-purple-700" style={{ fontWeight: 400 }}>
                                            <Wallet className="w-3 h-3 shrink-0" />
                                            Prepayment −{money(r.credit)}
                                          </p>
                                        )}
                                        {r.group.note && <p className="text-[11.5px] text-slate-500">Memo: {r.group.note}</p>}
                                        {r.group.reference && <p className="text-[11.5px] text-slate-500">Reference: {r.group.reference}</p>}
                                      </div>
                                    )}
                                  </div>
                                </CollapseReveal>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapseReveal>
            </div>
          );
        })
      )}
    </div>
  );
}

function RunDetailSidebar({
  run, lines, totals, total, statusPalette, displayStatus,
}: {
  run: PaymentRun;
  lines: ReturnType<typeof liveLines>;
  totals: ReturnType<typeof accountTotals>;
  total: number;
  statusPalette: { bg: string; color: string; border: string };
  /** Terminal-aware status copy (Paid/Scheduled once recorded). */
  displayStatus: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    // Not sticky (9/2/26 review): pinning at a fixed offset under the
    // MORPHING header clipped the card's bottom on shorter viewports and
    // fought the page scroll — the invoice detail sidebars scroll with
    // the page, so this one does too.
    <aside className="w-[320px] shrink-0 space-y-3 self-start">
      {/* ── Run Summary — ONE accordion, the partner-information data
          pattern (8/5/26): label-above-value fields in a two-column
          grid, the By/On audit pairs pinned at the bottom. ── */}
      <SidebarSection icon={Wallet} title="Run Summary" open={open} onToggle={() => setOpen((v) => !v)} collapsedSummary={money(total)}>
        <div>
          <p className="text-[22px] text-foreground " style={{ fontWeight: 700, lineHeight: 1.1 }}>{money(total)}</p>
        </div>
        {/* Status rides the data grid (BA 8/12/26), not the hero: the
            pill under the big figure repeated the header. */}
        <div className="mt-3 pt-2.5 border-t border-muted grid grid-cols-2 gap-x-4 gap-y-2.5">
          <InfoField label="Run ID">{run.id}</InfoField>
          <InfoField label="Status">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
              style={{ fontWeight: 600, backgroundColor: statusPalette.bg, color: statusPalette.color, borderColor: statusPalette.border }}
            >
              {displayStatus}
            </span>
          </InfoField>
          <InfoField label="Payment Date">{humanDate(run.paymentDate)}</InfoField>
          <InfoField label="Vendors">{run.groups.length}</InfoField>
          <InfoField label="Invoices">{lines.length}</InfoField>
        </div>
        <div className="mt-3 pt-2.5 border-t border-muted space-y-0.5">
          <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 500 }}>Pay-From Accounts</p>
          {/* Hover state on the rows (9/2/26 review) — the quiet listing
              row treatment, full-bleed within the card gutter. */}
          {totals.map((t) => (
            <div
              key={t.account.id}
              className="flex items-center justify-between gap-2 -mx-1.5 px-1.5 py-1 rounded-md hover:bg-slate-50 transition-colors"
            >
              <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{t.account.label}</span>
              <span className="text-[12px] text-slate-700 shrink-0" style={{ fontWeight: 600 }}>{money(t.selected)}</span>
            </div>
          ))}
        </div>
        {/* Audit pairs at the BOTTOM (partner card recipe): person with
            avatar on the left, its date on the right. */}
        <div className="mt-3 pt-2.5 border-t border-muted grid grid-cols-2 gap-x-4 gap-y-2.5">
          {/* Created + Approved, the data table's By columns (8/5/26):
              Submitted By always matched Created By, so it's gone. */}
          <PersonFields label="Created" name={run.createdBy} date={run.createdAt} />
          {run.approvedAt && run.approvedBy && <PersonFields label="Approved" name={run.approvedBy} date={run.approvedAt} />}
          {run.executedAt && run.executedBy && <PersonFields label="Executed" name={run.executedBy} date={run.executedAt} />}
          {run.completedAt && <InfoField label="Completed On">{humanDate(run.completedAt)}</InfoField>}
          {run.hold && <PersonFields label="Held" name={run.hold.by} date={run.hold.at} tone="amber" />}
          {run.cancelled && <PersonFields label="Cancelled" name={run.cancelled.by} date={run.cancelled.at} tone="rose" />}
        </div>
      </SidebarSection>
    </aside>
  );
}
