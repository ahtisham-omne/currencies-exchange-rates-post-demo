import { useCallback, useMemo, useState } from 'react';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import {
  SEED_RUNS,
  groupKeyOf,
  nextRunId,
  openRunInvoiceIds,
  type PaymentRun,
  type PaymentRunStatus,
  type CheckAssignment,
} from '@/app/data/paymentRuns';
import { deriveGroups, buildRunExecution, revalidateRun, discountTermsFor, discountIsLive, discountAmountOn, groupLines } from '@/app/lib/runMath';
import { buildNachaFile, type NachaFile } from '@/app/lib/nacha';
import { PAY_FROM_ACCOUNTS } from '@/app/data/mockPayments';

const BY = 'Ahtisham Ahmad';
const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().split('T')[0];

/* ── Payment run state + every mutation in one place (the
 * useCustomerInvoicing pattern, keeps App.tsx small). Runs live in
 * memory alongside the invoice and payment mocks: all three reset
 * together on reload, so an executed run never dangles against
 * re-seeded balances. */

export interface UsePaymentRunsDeps {
  invoices: Invoice[];
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  /** App-level settlement: drops outstanding balance, walks status. */
  settleInvoices: (allocations: { invoiceId: string; applied: number }[]) => void;
  /** App-level prepayment drawdown for applied credit. */
  consumePrepayments: (c: { paymentId: string; amount: number; invoiceNumbers: string[] }[]) => void;
}

/** Which artifact groups still need a confirmation, and the resulting
 *  post-execute status. Methods with no artifact (Bank Transfer, Card,
 *  Cash) confirm implicitly. */
function completionStatus(run: PaymentRun): PaymentRunStatus {
  const needs: boolean[] = [];
  run.print.checkLots.forEach((lot) => needs.push(!!lot.confirmedAt));
  run.print.nachaFiles.forEach((f) => needs.push(!!f.transmittedAt));
  run.print.wires.forEach((w) => needs.push(!!w.confirmationNumber));
  if (needs.length === 0) return 'Completed';
  if (needs.every(Boolean)) return 'Completed';
  if (needs.some(Boolean)) return 'Partially Executed';
  return 'Executed';
}

export function usePaymentRuns(deps: UsePaymentRunsDeps) {
  const { invoices, payments, setPayments, settleInvoices, consumePrepayments } = deps;
  const [runs, setRuns] = useState<PaymentRun[]>(SEED_RUNS);

  const patchRun = useCallback((runId: string, fn: (run: PaymentRun) => PaymentRun) => {
    setRuns((prev) => prev.map((r) => (r.id === runId ? fn(r) : r)));
  }, []);

  /** New Draft in P1. Bulk-selected Ready-to-pay rows arrive pre-ticked. */
  const createRun = useCallback(
    (seedInvoiceIds?: string[]): PaymentRun => {
      const locked = openRunInvoiceIds(runs);
      const seedLines = (seedInvoiceIds ?? [])
        .filter((id) => !locked.has(id))
        .map((id) => invoices.find((i) => i.id === id))
        .filter((inv): inv is Invoice => !!inv && inv.outstandingBalance > 0)
        .map((inv) => {
          // Paying defaults to the discounted amount while the early-pay
          // window is open (8/28/26); new runs pay today, so liveness is
          // checked against today.
          const terms = discountTermsFor(inv);
          const discount = discountIsLive(terms) && terms
            ? discountAmountOn(inv.outstandingBalance, terms)
            : 0;
          return {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            vendor: inv.vendor,
            // Its currency decides its payment (Currency & Exchange Rates).
            currency: inv.currency,
            dueDate: inv.dueDate,
            balanceAtAdd: inv.outstandingBalance,
            payAmount: inv.outstandingBalance - discount,
            isPreInvoice: inv.type === 'Pre-Invoice' || undefined,
          };
        });
      const run: PaymentRun = {
        id: nextRunId(runs, new Date()),
        status: 'Draft',
        stage: 'setup',
        createdBy: BY,
        createdAt: nowIso(),
        paymentDate: todayIso(),
        filters: {},
        lines: seedLines,
        groups: [],
        exceptionAcks: {},
        print: { checkLots: [], nachaFiles: [], wires: [] },
      };
      setRuns((prev) => [run, ...prev]);
      return run;
    },
    [runs, invoices],
  );

  const updateRun = useCallback(
    (runId: string, patch: Partial<PaymentRun> | ((run: PaymentRun) => PaymentRun)) => {
      // Hands-on edits stamp the run's Last Updated (user 10/22/26).
      patchRun(runId, (run) => ({
        ...(typeof patch === 'function' ? patch(run) : { ...run, ...patch }),
        updatedAt: nowIso(),
        updatedBy: BY,
      }));
    },
    [patchRun],
  );

  /** P1 Continue: commit the ticked lines and derive the payment groups
   *  (one payment per vendor and currency, defaults inherited, overrides
   *  preserved). */
  const continueToProposal = useCallback(
    (runId: string, lines: PaymentRun['lines']) => {
      patchRun(runId, (run) => ({
        ...run,
        lines,
        groups: deriveGroups(lines, run.groups),
        stage: 'proposal',
      }));
    },
    [patchRun],
  );

  /** Delete the whole proposal: releases every lock, leaves no trace. */
  const deleteRun = useCallback((runId: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== runId));
  }, []);

  const submitRun = useCallback(
    (runId: string) => {
      patchRun(runId, (run) => ({
        ...run,
        status: 'Pending Approval',
        submittedAt: nowIso(),
        submittedBy: BY,
        // Resubmitting closes the change-request cycle; the request stays
        // on the run (resolvedAt stamped) so the timeline keeps the story.
        changeRequest:
          run.changeRequest && !run.changeRequest.resolvedAt
            ? { ...run.changeRequest, resolvedAt: nowIso() }
            : run.changeRequest,
      }));
    },
    [patchRun],
  );

  /** P3a Approve all: run → Approved, every live line is clear to pay. */
  const approveRun = useCallback(
    (runId: string, approver: string) => {
      patchRun(runId, (run) => ({ ...run, status: 'Approved', approvedAt: nowIso(), approvedBy: approver }));
    },
    [patchRun],
  );

  /** Hold: a control FLAG (payment-hold model, 8/4/26) — the status
   *  stays, but approve/execute lock until the hold is released. */
  const holdRun = useCallback(
    (runId: string, reason: string, by: string) => {
      patchRun(runId, (run) => ({ ...run, hold: { reason, by, at: nowIso() } }));
    },
    [patchRun],
  );
  const releaseHold = useCallback(
    (runId: string, release?: { notes?: string; notifiedRecipientIds?: string[]; attachments?: string[]; by?: string }) => {
      // The release is recorded like an invoice's (user 10/22/26).
      patchRun(runId, (run) => ({
        ...run,
        hold: undefined,
        holdReleased: {
          by: release?.by ?? BY,
          at: nowIso(),
          notes: release?.notes || undefined,
          notifiedRecipientIds: release?.notifiedRecipientIds,
          attachments: release?.attachments,
        },
      }));
    },
    [patchRun],
  );

  /** Cancel pre-execution (8/4/26): terminal, nothing posted, the
   *  invoices release back to the payable pool (Cancelled is not an
   *  OPEN_RUN_STATUS, so the locks drop with the status). */
  const cancelRun = useCallback(
    (runId: string, reason: string, by: string) => {
      patchRun(runId, (run) => ({
        ...run,
        status: 'Cancelled',
        hold: undefined,
        cancelled: { reason, by, at: nowIso() },
      }));
    },
    [patchRun],
  );

  /** P3a Request changes (8/5/26, replaces blunt rejection): the
   *  approver flags issues per line or on the whole run, reasons
   *  mandatory, assignees defaulting to the creator. The run stays on
   *  its detail page for the creator to resolve and resubmit. */
  const requestChanges = useCallback(
    (
      runId: string,
      input: {
        by: string;
        note?: string;
        issues: Array<{ invoiceId?: string; reason: string; note?: string }>;
        assignees: string[];
      },
    ) => {
      patchRun(runId, (run) => ({
        ...run,
        status: 'Changes Requested',
        stage: 'proposal',
        submittedAt: undefined,
        submittedBy: undefined,
        changeRequest: {
          by: input.by,
          at: nowIso(),
          note: input.note,
          issues: input.issues.map((iss, i) => {
            const line = iss.invoiceId ? run.lines.find((l) => l.invoiceId === iss.invoiceId) : undefined;
            return {
              id: `iss-${Date.now()}-${i}`,
              invoiceId: iss.invoiceId,
              invoiceNumber: line?.invoiceNumber,
              vendor: line?.vendor,
              reason: iss.reason,
              note: iss.note,
              assignees: input.assignees.length ? input.assignees : [run.createdBy],
            };
          }),
        },
      }));
    },
    [patchRun],
  );

  /** Fate 1: the creator fixed the issue inside this run. Also the only
   *  fate for run-level issues. */
  const resolveIssueFixed = useCallback(
    (runId: string, issueId: string, by: string) => {
      patchRun(runId, (run) => ({
        ...run,
        changeRequest: run.changeRequest && {
          ...run.changeRequest,
          issues: run.changeRequest.issues.map((iss) =>
            iss.id === issueId ? { ...iss, resolution: { outcome: 'fixed' as const, by, at: nowIso() } } : iss,
          ),
        },
      }));
    },
    [patchRun],
  );

  /** Undo a 'fixed' resolution. Moved and released lines already left
   *  the run, those don't reopen. */
  const reopenIssue = useCallback(
    (runId: string, issueId: string) => {
      patchRun(runId, (run) => ({
        ...run,
        changeRequest: run.changeRequest && {
          ...run.changeRequest,
          issues: run.changeRequest.issues.map((iss) =>
            iss.id === issueId && iss.resolution?.outcome === 'fixed' ? { ...iss, resolution: undefined } : iss,
          ),
        },
      }));
    },
    [patchRun],
  );

  /** Fate 3: the flagged line leaves the run back to the payable pool,
   *  to be resolved independently outside any run. The lock drops with
   *  the line ('Changes Requested' is open, but the line is no longer
   *  live). */
  const releaseIssueLine = useCallback(
    (runId: string, issueId: string, by: string) => {
      patchRun(runId, (run) => {
        const issue = run.changeRequest?.issues.find((i) => i.id === issueId);
        if (!issue?.invoiceId) return run;
        const lines = run.lines.map((l) =>
          l.invoiceId === issue.invoiceId && !l.removed
            ? { ...l, removed: { reason: 'Released back to Invoices to Pay', by, at: nowIso(), stage: 'changes' as const } }
            : l,
        );
        const live = lines.filter((l) => !l.removed);
        return {
          ...run,
          lines,
          groups: deriveGroups(live, run.groups),
          changeRequest: run.changeRequest && {
            ...run.changeRequest,
            issues: run.changeRequest.issues.map((iss) =>
              iss.id === issueId ? { ...iss, resolution: { outcome: 'released' as const, by, at: nowIso() } } : iss,
            ),
          },
        };
      });
    },
    [patchRun],
  );

  /** Fate 2: the flagged line moves to another run, either an existing
   *  Draft or a brand-new one seeded with the invoice. One atomic
   *  setRuns so the invoice is never double-locked. Returns the
   *  destination run id (for navigation), or null if nothing moved. */
  const moveIssueLine = useCallback(
    (runId: string, issueId: string, target: { runId: string } | { newRun: true }, by: string): string | null => {
      let destination: string | null = null;
      setRuns((prev) => {
        const source = prev.find((r) => r.id === runId);
        const issue = source?.changeRequest?.issues.find((i) => i.id === issueId);
        const line = issue?.invoiceId ? source?.lines.find((l) => l.invoiceId === issue.invoiceId && !l.removed) : undefined;
        if (!source || !issue || !line) return prev;

        const targetId = 'newRun' in target ? nextRunId(prev, new Date()) : target.runId;
        destination = targetId;
        const movedLine = { ...line, removed: undefined };

        const withoutSource = prev.map((r) => {
          if (r.id !== runId) return r;
          const lines = r.lines.map((l) =>
            l.invoiceId === line.invoiceId && !l.removed
              ? { ...l, removed: { reason: `Moved to ${targetId}`, by, at: nowIso(), stage: 'changes' as const } }
              : l,
          );
          const live = lines.filter((l) => !l.removed);
          return {
            ...r,
            lines,
            groups: deriveGroups(live, r.groups),
            changeRequest: r.changeRequest && {
              ...r.changeRequest,
              issues: r.changeRequest.issues.map((iss) =>
                iss.id === issueId
                  ? { ...iss, resolution: { outcome: 'moved' as const, movedToRunId: targetId, by, at: nowIso() } }
                  : iss,
              ),
            },
          };
        });

        if ('newRun' in target) {
          const fresh: PaymentRun = {
            id: targetId,
            status: 'Draft',
            stage: 'setup',
            createdBy: by,
            createdAt: nowIso(),
            paymentDate: todayIso(),
            filters: {},
            lines: [movedLine],
            groups: [],
            exceptionAcks: {},
            print: { checkLots: [], nachaFiles: [], wires: [] },
          };
          return [fresh, ...withoutSource];
        }
        return withoutSource.map((r) =>
          r.id === targetId
            ? {
                ...r,
                lines: [...r.lines, movedLine],
                groups: deriveGroups([...r.lines, movedLine].filter((l) => !l.removed), r.groups),
              }
            : r,
        );
      });
      return destination;
    },
    [],
  );

  /** Return an APPROVED run to the approval queue (8/5/26): the run is
   *  recordation, not a posting, so pre-execution edits are acceptable.
   *  Approval comes off; method and accounts can change again. */
  const returnToPending = useCallback(
    (runId: string, by: string) => {
      patchRun(runId, (run) => ({
        ...run,
        status: 'Pending Approval',
        approvedAt: undefined,
        approvedBy: undefined,
        returnedToPending: { by, at: nowIso() },
      }));
    },
    [patchRun],
  );

  /** Resolve and resubmit (8/5/26): a changes-requested run reopens as
   *  an editable Draft at Configure; submitting sends it back to the
   *  approval queue. Also the Withdraw-and-edit path from Pending
   *  approval (submittedAt stays, so closing restores the status). */
  const reopenRun = useCallback(
    (runId: string) => {
      patchRun(runId, (run) => ({
        ...run,
        status: 'Draft',
        stage: 'proposal',
      }));
    },
    [patchRun],
  );

  /** Execute-time line removal (revalidation fixes): the line drops
   *  with the reason, the remainder posts. */
  const rejectLines = useCallback(
    (runId: string, invoiceIds: string[], reason: string, by: string) => {
      patchRun(runId, (run) => {
        const lines = run.lines.map((l) =>
          invoiceIds.includes(l.invoiceId) && !l.removed
            ? { ...l, removed: { reason, by, at: nowIso(), stage: 'approval' as const } }
            : l,
        );
        const live = lines.filter((l) => !l.removed);
        return { ...run, lines, groups: deriveGroups(live, run.groups) };
      });
    },
    [patchRun],
  );

  /** P3b Execute, THE commit: re-validates, posts one payment per
   *  vendor and currency, settles what settles today, locks the run.
   *  Returns the validation result so the stage can surface what changed.
   *  Recording in PIECES (Eli 9/25): pass `groupKeys` (groupKeyOf) to
   *  post only those payments now — the run reads 'Partially Executed'
   *  until the last group records, and a later call picks up the
   *  remainder. `cashAmounts` is keyed the same way. */
  const executeRun = useCallback(
    (runId: string, groupKeys?: string[], cashAmounts?: Record<string, number>) => {
      const run = runs.find((r) => r.id === runId);
      if (!run || (run.status !== 'Approved' && run.status !== 'Partially Executed')) return { ok: false as const };
      const validation = revalidateRun(run, invoices);
      if (!validation.ok) return { ok: false as const, validation };

      const plan = buildRunExecution(run, run.approvedBy, groupKeys, cashAmounts);
      if (plan.records.length === 0) return { ok: false as const };
      setPayments((prev) => [...plan.records, ...prev]);
      if (plan.settleNow.length > 0) settleInvoices(plan.settleNow);
      if (plan.creditDraws.length > 0) consumePrepayments(plan.creditDraws);

      patchRun(runId, (r) => {
        // Earlier passes' paymentIds survive; this pass stamps its own.
        // A vendor paid only in part keeps no paymentId, so it stays open
        // on the run (user 10/21/26); its lines remember what recorded.
        const recordedNow = new Map<string, number>();
        plan.lineRecorded.forEach((x) => recordedNow.set(x.invoiceId, (recordedNow.get(x.invoiceId) ?? 0) + x.amount));
        const lines = r.lines.map((l) =>
          recordedNow.has(l.invoiceId)
            ? { ...l, recordedAmount: Math.round(((l.recordedAmount ?? 0) + recordedNow.get(l.invoiceId)!) * 100) / 100 }
            : l,
        );
        const groups = r.groups.map((g) => {
          const key = groupKeyOf(g);
          const partialId = plan.partialPayments[key];
          return {
            ...g,
            paymentId: plan.groupPayments[key] ?? g.paymentId,
            partialPaymentIds: partialId ? [...(g.partialPaymentIds ?? []), partialId] : g.partialPaymentIds,
            creditPosted: g.creditPosted || plan.creditPostedGroups.includes(key) || undefined,
            // The reference belongs to the payment just posted; the next
            // pass needs its own trace or check number.
            ...(partialId ? { reference: undefined, printedViaFlow: undefined } : {}),
          };
        });
        // Scaffold the print stage: wires get their instruction rows now;
        // check lots and NACHA files build per account as the user works.
        // Partial passes APPEND to what earlier passes scaffolded.
        const wires = plan.records
          .filter((p) => p.paymentMethod === 'Wire')
          .map((p) => ({
            paymentId: p.id,
            vendor: p.vendor,
            amount: p.amount,
            obiMemo: (p.printMemo ?? p.memo ?? '').slice(0, 140),
          }));
        const next: PaymentRun = {
          ...r,
          lines,
          groups,
          executedAt: r.executedAt ?? nowIso(),
          executedBy: r.executedBy ?? BY,
          print: {
            checkLots: r.print?.checkLots ?? [],
            nachaFiles: r.print?.nachaFiles ?? [],
            wires: [...(r.print?.wires ?? []), ...wires],
          },
        };
        // Anything still unrecorded (live lines, no paymentId) keeps the
        // run open as Partially executed.
        const remaining = groups.filter((g) => !g.paymentId && groupLines(next, g).length > 0);
        if (remaining.length > 0) {
          next.status = 'Partially Executed';
          return next;
        }
        // Everything recorded across all passes: derive Executed vs
        // Completed from the recorded groups' methods.
        const recorded = groups.filter((g) => g.paymentId);
        const hasChecks = recorded.some((g) => g.methodType === 'Check');
        const hasAch = recorded.some((g) => g.methodType === 'ACH');
        next.status = hasChecks || hasAch || next.print.wires.length > 0 ? 'Executed' : 'Completed';
        if (next.status === 'Completed') next.completedAt = nowIso();
        return next;
      });
      return { ok: true as const, records: plan.records };
    },
    [runs, invoices, setPayments, settleInvoices, consumePrepayments, patchRun],
  );

  /* ── P4 · checks ──────────────────────────────────────────────────── */

  /** Build (or rebuild) the lot for an account from a starting number:
   *  sequential numbers across that account's check payments. */
  const assignCheckLot = useCallback(
    (runId: string, accountId: string, startNumber: number) => {
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      const checkPayments = payments.filter(
        (p) => p.runId === runId && p.paymentMethod === 'Check' && p.bankAccount === accountId,
      );
      patchRun(runId, (r) => {
        const assignments: CheckAssignment[] = checkPayments.map((p, i) => ({
          paymentId: p.id,
          vendor: p.vendor,
          amount: p.amount,
          checkNumber: startNumber + i,
          status: 'assigned',
        }));
        const others = r.print.checkLots.filter((l) => l.accountId !== accountId);
        return {
          ...r,
          print: { ...r.print, checkLots: [...others, { accountId, assignments }] },
        };
      });
    },
    [runs, payments, patchRun],
  );

  /** Print all: stamps each check's number onto its payment record's
   *  reference. The ledger amounts never move here. */
  const markLotPrinted = useCallback(
    (runId: string, accountId: string) => {
      const run = runs.find((r) => r.id === runId);
      const lot = run?.print.checkLots.find((l) => l.accountId === accountId);
      if (!run || !lot) return;
      const refByPayment = new Map(
        lot.assignments.filter((a) => a.status === 'assigned').map((a) => [a.paymentId, a.checkNumber]),
      );
      setPayments((prev) =>
        prev.map((p) => (refByPayment.has(p.id) ? { ...p, reference: `CHK-${refByPayment.get(p.id)}` } : p)),
      );
      patchRun(runId, (r) => ({
        ...r,
        print: {
          ...r.print,
          checkLots: r.print.checkLots.map((l) =>
            l.accountId === accountId
              ? { ...l, assignments: l.assignments.map((a) => (a.status === 'assigned' ? { ...a, status: 'printed' as const } : a)) }
              : l,
          ),
        },
      }));
    },
    [runs, patchRun, setPayments],
  );

  /** "Did all N print correctly?" Yes for this account. */
  const confirmLot = useCallback(
    (runId: string, accountId: string) => {
      patchRun(runId, (r) => {
        const next = {
          ...r,
          print: {
            ...r.print,
            checkLots: r.print.checkLots.map((l) =>
              l.accountId === accountId ? { ...l, confirmedAt: nowIso() } : l,
            ),
          },
        };
        return { ...next, status: completionStatus(next), completedAt: completionStatus(next) === 'Completed' ? nowIso() : next.completedAt };
      });
    },
    [patchRun],
  );

  /** Misprint path: the failed numbers are VOIDED (never reused) and the
   *  affected payments get fresh numbers past the lot's highest. The
   *  ledger is untouched; only check numbers change. */
  const voidAndReassign = useCallback(
    (runId: string, accountId: string, misprintedPaymentIds: string[]) => {
      patchRun(runId, (r) => ({
        ...r,
        print: {
          ...r.print,
          checkLots: r.print.checkLots.map((l) => {
            if (l.accountId !== accountId) return l;
            const highest = Math.max(...l.assignments.map((a) => a.checkNumber));
            const voided = l.assignments.map((a) =>
              misprintedPaymentIds.includes(a.paymentId) && a.status === 'printed'
                ? { ...a, status: 'void' as const }
                : a,
            );
            const reprints: CheckAssignment[] = misprintedPaymentIds.map((paymentId, i) => {
              const prior = l.assignments.find((a) => a.paymentId === paymentId)!;
              return { ...prior, checkNumber: highest + 1 + i, status: 'assigned' };
            });
            return { accountId, assignments: [...voided, ...reprints], confirmedAt: undefined };
          }),
        },
      }));
    },
    [patchRun],
  );

  /* ── P4 · ACH ─────────────────────────────────────────────────────── */

  /** Generate the account's NACHA file and record it on the run. The
   *  panel downloads the returned artifact. */
  const generateNacha = useCallback(
    (runId: string, accountId: string): NachaFile | null => {
      const run = runs.find((r) => r.id === runId);
      const account = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId);
      if (!run || !account) return null;
      const entries = payments
        .filter((p) => p.runId === runId && p.paymentMethod === 'ACH' && p.bankAccount === accountId)
        .map((p) => ({ payment: p, addenda: (p.printMemo ?? p.memo ?? '').slice(0, 80) }));
      if (entries.length === 0) return null;
      const file = buildNachaFile(account, entries, run.paymentDate);
      patchRun(runId, (r) => {
        const others = r.print.nachaFiles.filter((f) => f.accountId !== accountId);
        return {
          ...r,
          print: {
            ...r.print,
            nachaFiles: [
              ...others,
              { accountId, fileName: file.fileName, entryCount: file.entryCount, total: file.total, generatedAt: nowIso() },
            ],
          },
        };
      });
      return file;
    },
    [runs, payments, patchRun],
  );

  const markNachaTransmitted = useCallback(
    (runId: string, accountId: string) => {
      patchRun(runId, (r) => {
        const next = {
          ...r,
          print: {
            ...r.print,
            nachaFiles: r.print.nachaFiles.map((f) =>
              f.accountId === accountId ? { ...f, transmittedAt: nowIso(), rejection: undefined } : f,
            ),
          },
        };
        return { ...next, status: completionStatus(next), completedAt: completionStatus(next) === 'Completed' ? nowIso() : next.completedAt };
      });
    },
    [patchRun],
  );

  /** Bank rejected the file: clears the transmission so the user can
   *  regenerate (or reverse the payments through the usual reversal). */
  const rejectNacha = useCallback(
    (runId: string, accountId: string, reason: string) => {
      patchRun(runId, (r) => ({
        ...r,
        status: r.status === 'Completed' ? 'Partially Executed' : r.status,
        completedAt: undefined,
        print: {
          ...r.print,
          nachaFiles: r.print.nachaFiles.map((f) =>
            f.accountId === accountId
              ? { ...f, transmittedAt: undefined, rejection: { reason, at: nowIso() } }
              : f,
          ),
        },
      }));
    },
    [patchRun],
  );

  /* ── P4 · wires ───────────────────────────────────────────────────── */

  const updateWireMemo = useCallback(
    (runId: string, paymentId: string, obiMemo: string) => {
      patchRun(runId, (r) => ({
        ...r,
        print: {
          ...r.print,
          wires: r.print.wires.map((w) => (w.paymentId === paymentId ? { ...w, obiMemo: obiMemo.slice(0, 140) } : w)),
        },
      }));
    },
    [patchRun],
  );

  const recordWireConfirmation = useCallback(
    (runId: string, paymentId: string, confirmationNumber: string) => {
      patchRun(runId, (r) => {
        const next = {
          ...r,
          print: {
            ...r.print,
            wires: r.print.wires.map((w) =>
              w.paymentId === paymentId ? { ...w, confirmationNumber: confirmationNumber.trim() || undefined } : w,
            ),
          },
        };
        return { ...next, status: completionStatus(next), completedAt: completionStatus(next) === 'Completed' ? nowIso() : next.completedAt };
      });
    },
    [patchRun],
  );

  const sendRemittances = useCallback(
    (runId: string) => {
      patchRun(runId, (r) => ({ ...r, print: { ...r.print, remittanceSentAt: nowIso() } }));
    },
    [patchRun],
  );

  /** invoiceId → runId for every invoice sitting in an open run; drives
   *  the P1 greyed rows and the Ready-to-pay "In Run" chips. */
  const lockedInvoiceIds = useMemo(() => openRunInvoiceIds(runs), [runs]);

  return {
    runs,
    lockedInvoiceIds,
    createRun,
    updateRun,
    continueToProposal,
    deleteRun,
    submitRun,
    approveRun,
    holdRun,
    releaseHold,
    cancelRun,
    requestChanges,
    resolveIssueFixed,
    reopenIssue,
    releaseIssueLine,
    moveIssueLine,
    returnToPending,
    reopenRun,
    rejectLines,
    executeRun,
    assignCheckLot,
    markLotPrinted,
    confirmLot,
    voidAndReassign,
    generateNacha,
    markNachaTransmitted,
    rejectNacha,
    updateWireMemo,
    recordWireConfirmation,
    sendRemittances,
  };
}

export type PaymentRunsApi = ReturnType<typeof usePaymentRuns>;
