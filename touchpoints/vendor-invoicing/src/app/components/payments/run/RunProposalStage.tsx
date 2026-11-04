import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_PREPAYMENT_ASSET_ACCOUNT, PREPAYMENT_ASSET_ACCOUNTS, formatGLAccount } from '@/app/data/glAccounts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Flag,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Hash,
  Landmark,
  Layers,
  Maximize2,
  Minimize2,
  MoreVertical,
  Paperclip,
  Receipt,
  Search,
  Send,
  StickyNote,
  Trash2,
  RotateCcw,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, accountTypeForMethod, type Payment } from '@/app/data/mockPayments';
import {
  vendorPaymentMethods,
  genericPaymentMethods,
  methodSummary,
  type VendorPaymentMethod,
} from '@/app/data/vendorPaymentMethods';
import { paymentMethodInfo } from '@/app/data/paymentMethodCatalog';
import {
  accountForMethod,
  liveLines,
  openRunInvoiceIds,
  vendorPayDefaults,
  type PaymentRun,
  type RunVendorGroup,
} from '@/app/data/paymentRuns';
import type { PaymentRunsApi } from '@/app/hooks/usePaymentRuns';
import {
  accountTotals,
  creditAllocation,
  deriveGroups,
  groupCredit,
  groupGross,
  groupNet,
  vendorHasNoMethod,
  discountTermsFor,
  discountIsLive,
  discountAmountOn,
  discountDaysLeft,
  isClosedPeriod,
  runDebitRows,
  advanceAccountFor,
} from '@/app/lib/runMath';
import { DateCalendar } from '@/app/components/ui/date-picker';
import { accountBalanceLabel } from '@/app/data/mockPayments';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { VendorCell, highlightText } from '@/app/components/InvoiceDataTable';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PaymentMethodModal } from '@/app/components/payments/PaymentMethodModal';
import { PayFromAccountModal } from '@/app/components/payments/PayFromAccountModal';
import { PrepaymentSourcePicker, CreditQuickCard, type PrepaySource } from '@/app/components/payments/PrepaymentSourcePicker';
import { AmountWithPrepaidNote } from '@/app/components/payments/PrepaidOriginNote';
import { MoneyInput, MaxChip } from '@/app/components/payments/MoneyInput';
import { money, humanDate, openInvoiceTab, DueDatePill, RUN_FOOTER_SHELL, FOOTER_BTN_GHOST, FOOTER_BTN_PRIMARY } from './runUi';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import { RunIssuesPanel, MoveLineModal } from './RunIssuesPanel';

const BY = 'Ahtisham Ahmad';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Method accordion order (8/6/26): the proposal's top-level nesting. */
const METHOD_SECTION_ORDER = ['Check', 'ACH', 'Wire', 'Bank Transfer', 'Card', 'Cash', 'Other'];

/** On-account draws only: anchored entries are system-applied and never
 *  ride the picker's editable draw map. */
const anchoredAppliedOf = (group: RunVendorGroup) =>
  round2(group.creditApplied.filter((c) => c.anchoredInvoiceNumber).reduce((s, c) => s + c.amount, 0));

/* ── P2 · Proposal (payment-run-flow.md) ─────────────────────────────
 * The system turned the ticked invoices into one payment per pay-to
 * vendor, inheriting each vendor's own method and pay-from account.
 * Nothing has posted: remove lines, override the method or account for
 * this run only, drop to a partial amount (warn over due, never round),
 * apply prepaid credit, add a note. Delete the whole proposal and no
 * trace remains. Submit is held only by a vendor missing a payment
 * method (fixed on their card); an overdrawn account warns and never
 * blocks. Unused prepaid credit gets the Record Payment flow's amber
 * reminder modal instead of an exceptions panel (BA 7/31/26). */

/** Hover quick-cards must not pop while a pane is being scrolled
 *  (feedback 8/12/26): the cursor just happens to pass over rows. The
 *  scroll handler locks pointer events on the pane's children for a
 *  beat after the last scroll tick; hover re-arms when the pane rests. */
function useScrollHoverLock(restMs = 180) {
  const [locked, setLocked] = useState(false);
  const timer = useRef<number | null>(null);
  const onScroll = () => {
    setLocked(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLocked(false), restMs);
  };
  return { locked, onScroll };
}

export function RunProposalStage({
  run,
  invoices,
  payments,
  runsApi,
  onDeleted,
}: {
  run: PaymentRun;
  invoices: Invoice[];
  payments: Payment[];
  runsApi: PaymentRunsApi;
  onDeleted: () => void;
}) {
  const [methodVendor, setMethodVendor] = useState<string | null>(null);
  const [accountVendor, setAccountVendor] = useState<string | null>(null);
  // Hover cards stay quiet while their pane scrolls (8/12/26): one lock
  // per scrollable pane, the vendor cards and the summary-rail breakdown.
  const cardsHoverLock = useScrollHoverLock();
  const railHoverLock = useScrollHoverLock();
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Removing a line asks first (user 10/5): a slip of the trash icon
  // shouldn't silently drop a vendor's payment out of the run.
  const [removeConfirm, setRemoveConfirm] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    vendor: string;
    amount: number;
  } | null>(null);
  // Submit gets the green Record-Payment confirm (8/4/26): GL-impact
  // rows per pay-from account, then the run hands off to its detail page.
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  // Resubmit no-change guard (Eli 10/5): if the run reopened for changes
  // and the user resubmits WITHOUT touching anything, confirm first
  // ("are you sure you didn't do anything?"). The signature snapshots the
  // reopened state once; Submit compares against it.
  const [noChangeConfirmOpen, setNoChangeConfirmOpen] = useState(false);
  const reopenSigRef = useRef<string | null>(null);
  // GL depth on confirmations is a system setting (8/5/26).
  const { showGlOnConfirmations } = useSystemSettings();
  // The change-request "move to another run" fate (8/5/26).
  const [moveIssueId, setMoveIssueId] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Accordion cards (8/6/26, the invoice-creation nesting): vendor
  // cards start COLLAPSED under their method accordion; expanding one
  // reveals its invoice table. Jumping to a vendor re-expands it.
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(
    () => new Set(run.groups.map((g) => g.vendor)),
  );
  const toggleVendorCollapsed = (vendor: string) =>
    setCollapsedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  const expandVendor = (vendor: string) =>
    setCollapsedVendors((prev) => {
      if (!prev.has(vendor)) return prev;
      const next = new Set(prev);
      next.delete(vendor);
      return next;
    });

  const lines = liveLines(run);
  const totals = useMemo(() => accountTotals(run), [run]);
  const overdrawn = totals.filter((t) => t.remaining < 0);
  const total = run.groups.reduce((s, g) => s + groupNet(run, g), 0);

  // Search + method filter over the payment list (8/28/26 review): the
  // query matches the vendor name or any of its invoice numbers; the
  // filter narrows to chosen method sections.
  const [paySearch, setPaySearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  // Method sections collapse like accordions (8/28/26 review) so the
  // user can focus on one rail at a time. Only the FIRST section opens
  // on entry (8/28/26 evening); a live search overrides the collapse —
  // hits must never hide behind a folded section.
  const [collapsedMethods, setCollapsedMethods] = useState<Set<string>>(() => {
    const known = new Set(METHOD_SECTION_ORDER.filter((m) => m !== 'Other'));
    const present = METHOD_SECTION_ORDER.filter((method) =>
      run.groups.some((g) => (method === 'Other' ? !known.has(g.methodType) : g.methodType === method)),
    );
    return new Set(present.slice(1));
  });
  const toggleMethodCollapsed = (method: string) =>
    setCollapsedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });

  // The proposal groups BY PAYMENT METHOD under collapsible headers
  // (8/28/26 review; replaces the 8/7 account accordions): method header
  // → vendor cards → invoice table. Sections follow the fixed catalog
  // order and vendors keep run.groups' insertion order, so nothing ever
  // re-sorts while editing — applying a prepayment used to shuffle the
  // account sections (they sorted by amount) and cards jumped. The
  // pay-from account stays an editable chip on each vendor card.
  const sectionOf = (methodType: string) =>
    METHOD_SECTION_ORDER.includes(methodType) ? methodType : 'Other';
  const allMethodSections = useMemo(() => {
    const known = new Set(METHOD_SECTION_ORDER.filter((m) => m !== 'Other'));
    return METHOD_SECTION_ORDER.map((method) => ({
      method,
      groups: run.groups.filter((g) =>
        method === 'Other' ? !known.has(g.methodType) : g.methodType === method,
      ),
    })).filter((s) => s.groups.length > 0);
  }, [run.groups]);
  const methodSections = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    const groupMatches = (g: RunVendorGroup) => {
      if (methodFilter.length && !methodFilter.includes(sectionOf(g.methodType))) return false;
      if (!q) return true;
      if (g.vendor.toLowerCase().includes(q)) return true;
      return liveLines(run).some(
        (l) => l.vendor === g.vendor && l.invoiceNumber.toLowerCase().includes(q),
      );
    };
    return allMethodSections
      .map((s) => ({ ...s, groups: s.groups.filter(groupMatches) }))
      .filter((s) => s.groups.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMethodSections, paySearch, methodFilter, run]);

  // Move payments between accounts: single (kebab submenu), a picked
  // selection, or a whole section. Landing back on the vendor's own
  // default clears the override flag.
  const [bulkMoveVendors, setBulkMoveVendors] = useState<string[] | null>(null);
  const applyAccountToVendors = (vendors: string[], accountId: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) =>
        vendors.includes(g.vendor)
          ? {
              ...g,
              payFromAccountId: accountId,
              accountOverridden: accountId !== vendorPayDefaults(g.vendor).payFromAccountId || undefined,
            }
          : g,
      ),
    }));
    const account = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId);
    toast.success(`Moved to ${account?.label ?? accountId}`, {
      description: `${vendors.length} payment${vendors.length === 1 ? '' : 's'} now draw${vendors.length === 1 ? 's' : ''} from it, for this run only.`,
    });
    // Cards stay put (8/28/26, method grouping): the account is a chip
    // on the card, so changing it never relocates anything.
  };
  const eligibleAccountsFor = (methodType: string) =>
    PAY_FROM_ACCOUNTS.filter((a) => {
      const want = accountTypeForMethod(methodType);
      return want === 'any' ? true : a.type === want;
    });
  /** Accounts every selected payment's method can draw from. */
  const bulkEligibleAccounts = (vendors: string[]) => {
    const groups = run.groups.filter((g) => vendors.includes(g.vendor));
    return PAY_FROM_ACCOUNTS.filter((a) =>
      groups.every((g) => {
        const want = accountTypeForMethod(g.methodType);
        return want === 'any' ? true : a.type === want;
      }),
    );
  };
  // Revert to each vendor's OWN account (9/2/26 review): a bulk or
  // single move is undoable in one click — every group lands back on
  // its vendor default and the "run only" flag clears.
  const resetAccountsToDefaults = (vendors: string[]) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) =>
        vendors.includes(g.vendor)
          ? { ...g, payFromAccountId: vendorPayDefaults(g.vendor).payFromAccountId, accountOverridden: undefined }
          : g,
      ),
    }));
    toast.success(
      vendors.length === 1 ? 'Account reverted' : 'Accounts reverted',
      {
        description:
          vendors.length === 1
            ? `${vendors[0]} pays from its own account again.`
            : `${vendors.length} payments pay from each vendor's own account again.`,
      },
    );
  };
  const openBulkMove = (vendors: string[]) => {
    if (bulkEligibleAccounts(vendors).length === 0) {
      toast.error("These payments use methods that can't share one account.", {
        description: 'Move them separately, or align their payment methods first.',
      });
      return;
    }
    setBulkMoveVendors(vendors);
  };
  // Submit gates: a vendor with no payment method (fixed on their card),
  // and any open change-request issue (8/5/26, the resubmit checklist).
  const noMethod = run.groups.filter((g) => vendorHasNoMethod(g.vendor) && !g.methodOverridden);

  // Submit-time recheck (10/29): while a run is being built nothing is
  // reserved, so its invoices stay open to hold, credit memo and cancel.
  // At submit every selected invoice is checked again; anything that
  // changed blocks the submit and is highlighted. Never dropped or
  // changed silently: the user removes or fixes it.
  const [submitChecked, setSubmitChecked] = useState(false);
  const submitBlockers = useMemo(() => {
    const otherRuns = openRunInvoiceIds(runsApi.runs, run.id);
    const map = new Map<string, { reason: string; owed?: number }>();
    lines.forEach((l) => {
      const inv = invoices.find((i) => i.id === l.invoiceId);
      if (!inv) return;
      if (inv.status === 'Cancelled') map.set(l.invoiceId, { reason: 'Cancelled since it was added' });
      else if (inv.is_payment_held) map.set(l.invoiceId, { reason: 'Put on payment hold since it was added' });
      else if (otherRuns.has(l.invoiceId)) map.set(l.invoiceId, { reason: `Now in payment run ${otherRuns.get(l.invoiceId)}` });
      else if (l.payAmount > inv.outstandingBalance + 0.004) {
        map.set(l.invoiceId, { reason: `Now owes ${money(inv.outstandingBalance)}, less than ${money(l.payAmount)} in this run`, owed: inv.outstandingBalance });
      }
    });
    return map;
  }, [lines, invoices, runsApi.runs, run.id]);
  const shownBlockers = submitChecked ? submitBlockers : new Map<string, { reason: string; owed?: number }>();
  /** Returns true when the run may go; otherwise highlights and opens the blocked rows. */
  const recheckForSubmit = (): boolean => {
    setSubmitChecked(true);
    if (submitBlockers.size === 0) return true;
    const blockedVendors = new Set(lines.filter((l) => submitBlockers.has(l.invoiceId)).map((l) => l.vendor));
    setCollapsedMethods(new Set());
    setCollapsedVendors((prev) => new Set([...prev].filter((v) => !blockedVendors.has(v))));
    toast.error(`${submitBlockers.size} invoice${submitBlockers.size === 1 ? '' : 's'} changed since ${submitBlockers.size === 1 ? 'it was' : 'they were'} added`, {
      description: 'Remove or fix the highlighted invoices, then submit again.',
    });
    window.setTimeout(() => {
      document.querySelector('[data-run-blocked="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 320);
    return false;
  };
  const openIssues =
    run.changeRequest && !run.changeRequest.resolvedAt
      ? run.changeRequest.issues.filter((i) => !i.resolution).length
      : 0;
  const isResubmit = !!run.changeRequest && !run.changeRequest.resolvedAt;

  // Signature of everything a resubmit can change: line amounts +
  // removals, each group's method/account, and each issue's resolution.
  const runSignature = () =>
    JSON.stringify({
      l: run.lines.map((x) => [x.invoiceId, x.payAmount, !!x.removed]),
      g: run.groups.map((x) => [x.vendor, x.methodType, x.payFromAccountId]),
      i: (run.changeRequest?.issues ?? []).map((x) => [x.id, !!x.resolution]),
    });
  useEffect(() => {
    // Snapshot the reopened state ONCE, so Submit can tell nothing moved.
    if (isResubmit && reopenSigRef.current === null) reopenSigRef.current = runSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResubmit]);

  // Anchored prepayments no longer auto-apply here (Eli, 8/31/26):
  // an advance recorded against a pre-invoice is consumed when the
  // receiving invoice is created (reconciliation), so runs only ever
  // draw from on-account vendor credit.

  // Prepayment reminder — the same deliberate gate the Record Payment
  // flow fires (Eli 7/22/26): vendors in this run holding on-account
  // credit the proposal isn't drawing get one modal nudge; skipping is
  // a conscious click and the per-card Apply credit control remains.
  // Anchored draws don't count against the on-account pool.
  const prepayCredit = useMemo(
    () =>
      run.groups
        .map((g) => {
          const available = payments
            .filter((p) => p.type === 'Prepayment' && p.vendor === g.vendor && p.unappliedAmount > 0 && !p.preInvoiceId)
            .reduce((s, p) => s + p.unappliedAmount, 0);
          return {
            vendor: g.vendor,
            unresolved: round2(available - (groupCredit(g) - anchoredAppliedOf(g))),
          };
        })
        .filter((c) => c.unresolved > 0.004),
    [run, payments],
  );
  // The issue strip lists every issue SEPARATELY with its vendor and
  // detail (feedback 8/5/26 — clubbing categories confused users):
  // who has the problem, what it is, and clicking it jumps to the fix.
  const [issuesOpen, setIssuesOpen] = useState(false);
  // Run-summary payment date popover (Eli 9/25: editable right here).
  const [summaryDateOpen, setSummaryDateOpen] = useState(false);
  const summaryClosedPeriod = isClosedPeriod(run.paymentDate);
  // Applicable prepayments are NOT issues (8/28/26 review): they count
  // separately and the banner phrases them as an opportunity.
  const issueCount = noMethod.length + overdrawn.length;
  const prepayCount = prepayCredit.length;

  // Run summary: the per-vendor rows live behind Show breakdown.
  // Shown by default (8/7/26): the breakdown IS the summary's value.
  // Closed by default (9/2/26 review): the breakdown is reference
  // detail, not the first read — the Total carries the rail.
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Bumped signal opens a vendor's prepayment picker on their card.
  const [prepayReview, setPrepayReview] = useState<{ vendor: string; n: number }>({ vendor: '', n: 0 });
  // The prepayment STEPPER (8/5/26): one vendor per step, apply or skip
  // and move on. Resolving one never forces resolving the rest. Opens
  // once on entry when unused credit exists; reopens from the rail.
  const [stepper, setStepper] = useState<{ vendors: string[]; idx: number } | null>(null);
  const stepperShown = useRef(false);
  useEffect(() => {
    if (!stepperShown.current && prepayCredit.length > 0) {
      stepperShown.current = true;
      setStepper({ vendors: prepayCredit.map((c) => c.vendor), idx: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jumping from an issue also PULSES the control that fixes it (8/5/26,
  // the invoice-creation quantity-field treatment), so the landing spot
  // says what to do, not just where to look.
  const [attention, setAttention] = useState<{ vendor: string; field: 'method' | 'account'; n: number } | null>(null);
  const jumpToVendor = (vendor: string, field?: 'method' | 'account') => {
    // A jump must never land behind a folded method section (8/28/26).
    const g = run.groups.find((gr) => gr.vendor === vendor);
    if (g) {
      setCollapsedMethods((prev) => {
        const section = sectionOf(g.methodType);
        if (!prev.has(section)) return prev;
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
    }
    expandVendor(vendor);
    if (field) setAttention((prev) => ({ vendor, field, n: (prev?.n ?? 0) + 1 }));
    // Scroll after the expansion has re-laid-out the card list.
    requestAnimationFrame(() => {
      cardsRef.current
        ?.querySelector(`[data-vendor="${CSS.escape(vendor)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const patchGroup = (vendor: string, patch: Partial<RunVendorGroup>) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) => (g.vendor === vendor ? { ...g, ...patch } : g)),
    }));
  };

  const setLineAmount = (invoiceId: string, payAmount: number) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) => (l.invoiceId === invoiceId ? { ...l, payAmount } : l)),
    }));
  };

  // Removal is tracked in the activity (Eli 10/5: "that is going to have
  // to be tracked in the activity"): the line soft-removes with a reason,
  // by, and stage so the run timeline shows it left and why. Groups
  // rederive from the LIVE lines, so totals rebalance exactly as before.
  const removeLine = (invoiceId: string) => {
    runsApi.updateRun(run.id, (r) => {
      const nextLines = r.lines.map((l) =>
        l.invoiceId === invoiceId && !l.removed
          ? { ...l, removed: { reason: 'Removed during proposal', by: BY, at: new Date().toISOString(), stage: 'proposal' as const } }
          : l,
      );
      return { ...r, lines: nextLines, groups: deriveGroups(nextLines.filter((l) => !l.removed), r.groups) };
    });
  };

  const methodsFor = (vendor: string): VendorPaymentMethod[] =>
    vendorHasNoMethod(vendor) ? genericPaymentMethods() : vendorPaymentMethods(vendor);

  const applyMethod = (vendor: string, methodId: string) => {
    const m = methodsFor(vendor).find((x) => x.id === methodId);
    if (!m) return;
    const group = run.groups.find((g) => g.vendor === vendor);
    patchGroup(vendor, {
      methodId: m.id,
      methodType: m.type,
      methodOverridden: true,
      // The account follows the method's bank unless the user pinned one.
      ...(group?.accountOverridden ? {} : { payFromAccountId: accountForMethod(m) }),
    });
  };

  const submit = () => {
    runsApi.submitRun(run.id);
    toast.success('Proposal submitted for approval', {
      description: `${run.groups.length} vendor payment${run.groups.length === 1 ? '' : 's'} totaling ${money(total)} await the approver.`,
    });
  };

  const confirmDelete = () => {
    runsApi.deleteRun(run.id);
    setDeleteOpen(false);
    toast.success('Proposal deleted', {
      description: `${lines.length} invoice${lines.length === 1 ? '' : 's'} released back to the payable pool. Nothing was posted.`,
    });
    onDeleted();
  };

  const methodModalVendor = methodVendor ? run.groups.find((g) => g.vendor === methodVendor) : null;
  const accountModalVendor = accountVendor ? run.groups.find((g) => g.vendor === accountVendor) : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* One strip (8/4/26, redesigned 8/28/26): real issues keep the
          issue language; applicable prepayments are an opportunity, not
          a problem — "there are prepayments you can apply", never "N
          issues". The Review pill sits right after the sentence, where
          the reading eye already is, and the popover is ONE scroll with
          section headers, not two competing scrollbars. Prepay-only
          strips wear the prepayment purple, not an alarm tone. */}
      {issueCount + prepayCount > 0 && (
        <div
          className={`-mx-3 sm:-mx-5 -mt-3.5 px-4 sm:px-5 py-2 border-b shrink-0 flex items-center gap-2.5 ${
            issueCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-purple-50/70 border-purple-200'
          }`}
        >
          {issueCount > 0 ? (
            <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Wallet className="w-4 h-4 text-purple-600 shrink-0" />
          )}
          <div
            className={`min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] ${
              issueCount > 0 ? 'text-amber-800' : 'text-purple-900'
            }`}
            style={{ fontWeight: 500 }}
          >
            <span className="min-w-0">
              {issueCount > 0 && (
                <>
                  <span style={{ fontWeight: 700 }}>{issueCount} issue{issueCount === 1 ? '' : 's'}</span> on this proposal
                  {noMethod.length > 0
                    ? `, ${noMethod.length === 1 ? 'one blocks' : `${noMethod.length} block`} submitting.`
                    : ', none block submitting.'}
                </>
              )}
              {prepayCount > 0 && (
                <span className={issueCount > 0 ? 'ml-1' : ''}>
                  <span style={{ fontWeight: 700 }}>{prepayCount} vendor{prepayCount === 1 ? ' has' : 's have'}</span>{' '}
                  vendor credit you can apply.
                </span>
              )}
            </span>
            <Popover open={issuesOpen} onOpenChange={setIssuesOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`shrink-0 inline-flex items-center gap-1 h-6 pl-2.5 pr-2 rounded-full border bg-white text-[11.5px] transition-colors cursor-pointer shadow-sm ${
                    issueCount > 0
                      ? 'border-amber-300 text-amber-800 hover:bg-amber-100/70'
                      : 'border-purple-300 text-purple-800 hover:bg-purple-100/70'
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  Review
                  <ChevronDown className={`w-3 h-3 transition-transform ${issuesOpen ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[400px] p-0 bg-white border border-border rounded-xl overflow-hidden"
                style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
              >
              {/* ONE scroll pane (8/28/26 review): both sections live in
                  the same list under sticky section headers. */}
              <div className="max-h-[380px] overflow-y-auto">
                {issueCount > 0 && (
                  <>
                    <div className="sticky top-0 z-10 px-4 pt-3 pb-1.5 bg-white/95 backdrop-blur-sm">
                      <p className="text-[11px] text-slate-400" style={{ fontWeight: 700 }}>
                        Needs Attention · {issueCount}
                      </p>
                    </div>
                    {/* One row PER ISSUE with the vendor named (8/5/26):
                        each row jumps to its card and pulses the fix. */}
                    <div className="px-2 pb-1">
                      {noMethod.map((g) => (
                        <button
                          key={`nm-${g.vendor}`}
                          type="button"
                          onClick={() => {
                            setIssuesOpen(false);
                            jumpToVendor(g.vendor, 'method');
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                        >
                          <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                            <TriangleAlert className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 600 }}>
                              {g.vendor} needs a payment method
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5 truncate">
                              Blocks submitting. Set one on the vendor's card.
                            </p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                        </button>
                      ))}
                      {overdrawn.map((t) => (
                        <button
                          key={`od-${t.account.id}`}
                          type="button"
                          onClick={() => {
                            setIssuesOpen(false);
                            // The account sections are gone (8/28/26): the
                            // row itself opens the bulk move for every
                            // payment drawing from the short account.
                            const vendors = run.groups
                              .filter((gr) => gr.payFromAccountId === t.account.id)
                              .map((gr) => gr.vendor);
                            if (vendors.length) openBulkMove(vendors);
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                        >
                          <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <TriangleAlert className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            {/* BA copy 8/10/26: amount versus balance, then
                                the exact shortfall. */}
                            <p className="text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 600 }}>
                              {t.account.label}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              Payment amount {money(t.selected)} exceeds the remaining balance {money(t.available)} by {money(-t.remaining)}. Move its payments to another account.
                            </p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {/* Applicable vendor credit — an opportunity list, split
                    from the issues (8/28/26 review), same scroll. */}
                {prepayCount > 0 && (
                  <>
                    <div className={`sticky top-0 z-10 px-4 pb-1.5 bg-white/95 backdrop-blur-sm ${issueCount > 0 ? 'pt-2 border-t border-border/60' : 'pt-3'}`}>
                      <p className="text-[11px] text-slate-400" style={{ fontWeight: 700 }}>
                        Vendor Credit You Can Apply · {prepayCount}
                      </p>
                    </div>
                    <div className="px-2 pb-2">
                      {prepayCredit.map((c, ci) => (
                        <button
                          key={`pc-${c.vendor}`}
                          type="button"
                          onClick={() => {
                            setIssuesOpen(false);
                            setStepper({ vendors: prepayCredit.map((p) => p.vendor), idx: ci });
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                        >
                          <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Wallet className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 600 }}>
                              {c.vendor}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {money(c.unresolved)} in vendor credit available. Apply it to reduce this payment, or skip.
                            </p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
          </div>
        </div>
      )}

      {/* Change-request checklist: the run came back from approval with
          issues to address. Resubmission stays gated until every issue
          is resolved (8/5/26). */}
      {run.changeRequest && !run.changeRequest.resolvedAt && (
        <RunIssuesPanel
          run={run}
          variant="proposal"
          onResolveFixed={(issueId) => runsApi.resolveIssueFixed(run.id, issueId, BY)}
          onReopen={(issueId) => runsApi.reopenIssue(run.id, issueId)}
          onRelease={(issueId) => {
            const issue = run.changeRequest?.issues.find((i) => i.id === issueId);
            runsApi.releaseIssueLine(run.id, issueId, BY);
            toast.success('Invoice released', {
              description: `${issue?.invoiceNumber ?? 'The invoice'} returned to Invoices to Pay, outside any run.`,
            });
          }}
          onMove={(issueId) => setMoveIssueId(issueId)}
          onJumpToVendor={(vendor) => jumpToVendor(vendor)}
        />
      )}

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Method sections (8/28/26): slim payment-method headers →
            vendor cards → invoices. Dragging a vendor card onto another
            method section changes how that payment goes out; the method
            AND the pay-from account stay editable chips on each card. */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Search band (8/28/26 evening, the Linked Records recipe): one
            rounded card — search up top with the counts and collapse menu
            at the right edge, method chips with counts below. The chips
            ARE the method filter: All, or one method at a time. */}
        <div className="shrink-0 rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-3 pt-2.5 pb-2 mb-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 max-w-[360px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                value={paySearch}
                onChange={(e) => setPaySearch(e.target.value)}
                placeholder="Search vendors, invoices..."
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-border bg-white text-[12px] outline-none placeholder:text-muted-foreground/50 focus:border-primary transition-colors"
              />
              {paySearch && (
                <button
                  type="button"
                  onClick={() => setPaySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="ml-auto text-[12px] text-slate-500 whitespace-nowrap shrink-0" style={{ fontWeight: 500 }}>
              <span className="text-foreground" style={{ fontWeight: 600 }}>
                {methodSections.reduce((acc, x) => acc + x.groups.length, 0)}
              </span>
              {` payment${methodSections.reduce((acc, x) => acc + x.groups.length, 0) === 1 ? '' : 's'}`}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors cursor-pointer shrink-0"
                  style={{ fontWeight: 500 }}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Collapse
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[230px]">
                {/* The run detail page's collapse taxonomy (8/28/26
                    evening): one action per level, plus everything. */}
                <DropdownMenuItem
                  onSelect={() => {
                    setCollapsedMethods(new Set());
                    setCollapsedVendors(new Set());
                  }}
                  className="text-[12px]"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Expand Everything
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setCollapsedMethods(new Set(allMethodSections.map((x) => x.method)));
                    setCollapsedVendors(new Set(run.groups.map((g) => g.vendor)));
                  }}
                  className="text-[12px]"
                >
                  <Minimize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Collapse Everything
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Per-level pairs (8/31/26): each level gets its expand
                    AND collapse, same nouns as the detail page. */}
                <DropdownMenuItem
                  onSelect={() => setCollapsedVendors(new Set())}
                  className="text-[12px]"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Expand Vendor Rows
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setCollapsedVendors(new Set(run.groups.map((g) => g.vendor)))}
                  className="text-[12px]"
                >
                  <Minimize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Collapse Vendor Rows
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setCollapsedMethods(new Set())}
                  className="text-[12px]"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Expand Methods
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setCollapsedMethods(new Set(allMethodSections.map((x) => x.method)))}
                  className="text-[12px]"
                >
                  <Minimize2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  Collapse Methods
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Method chips — the Linked Records type-chip row. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const chipCls = (active: boolean) =>
                `inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full border text-[12px] transition-colors cursor-pointer shrink-0 ${
                  active
                    ? 'border-primary/50 text-primary bg-blue-50/60'
                    : 'border-border text-slate-600 bg-white hover:border-slate-300 hover:text-foreground'
                }`;
              const countCls = (active: boolean) =>
                `inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] ${
                  active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                }`;
              const allActive = methodFilter.length === 0;
              return (
                <>
                  <button type="button" onClick={() => setMethodFilter([])} className={chipCls(allActive)} style={{ fontWeight: allActive ? 600 : 500 }}>
                    All
                    <span className={countCls(allActive)} style={{ fontWeight: 600 }}>{run.groups.length}</span>
                  </button>
                  {allMethodSections.map((x) => {
                    const active = methodFilter.length === 1 && methodFilter[0] === x.method;
                    return (
                      <button
                        key={x.method}
                        type="button"
                        onClick={() => setMethodFilter(active ? [] : [x.method])}
                        className={chipCls(active)}
                        style={{ fontWeight: active ? 600 : 500 }}
                      >
                        {x.method}
                        <span className={countCls(active)} style={{ fontWeight: 600 }}>{x.groups.length}</span>
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
        <div
          ref={cardsRef}
          onScroll={cardsHoverLock.onScroll}
          className={`flex-1 min-h-0 overflow-y-auto space-y-3 pb-1 ${cardsHoverLock.locked ? '[&>*]:pointer-events-none' : ''}`}
        >
          {methodSections.length === 0 && (
            /* Table Empty & Error States Standard (11/3/26), compact in the
               authoring modal. */
            <div className="rounded-xl border border-border bg-white">
              <TableEmptyState
                compact
                kind={resolveTableEmptyKind({ totalCount: run.groups.length, filteredCount: 0, searchQuery: paySearch, filterCount: methodFilter.length }) ?? 'no-data'}
                entity={{ singular: 'payment', plural: 'payments' }}
                searchQuery={paySearch}
                suggestion={paySearch.trim() ? findSearchSuggestion(paySearch, [...run.groups.map((g) => g.vendor), ...lines.map((l) => l.invoiceNumber)]) : null}
                onApplySuggestion={setPaySearch}
                filterCount={methodFilter.length}
                onClearSearch={() => setPaySearch('')}
                onClearFilters={() => setMethodFilter([])}
                onClearAll={() => { setPaySearch(''); setMethodFilter([]); }}
              />
            </div>
          )}
          {methodSections.map(({ method, groups: sectionGroups }) => {
            const MIcon = paymentMethodInfo(method).icon;
            const sectionNet = sectionGroups.reduce((acc, g) => acc + groupNet(run, g), 0);
            const methodErrors = sectionGroups.filter((g) => vendorHasNoMethod(g.vendor) && !g.methodOverridden).length;
            // "Pay all from one account" only earns its place when the
            // section actually spans MORE than one pay-from account (Eli
            // 10/5): if every payment already draws from the same account,
            // surface that account inline instead of the bulk control.
            const sectionAccountIds = Array.from(new Set(sectionGroups.map((g) => g.payFromAccountId)));
            const sectionSingleAccount =
              sectionAccountIds.length === 1
                ? PAY_FROM_ACCOUNTS.find((a) => a.id === sectionAccountIds[0]) ?? null
                : null;
            // A live search overrides the fold: hits never hide.
            const sectionCollapsed = collapsedMethods.has(method) && !paySearch.trim();
            return (
              <section
                key={method}
                className={`rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors ${
                  sectionCollapsed ? 'border-border hover:border-primary/25' : 'border-primary/25'
                }`}
              >
                {/* Accordion header (8/28/26 evening, the Linked Records
                    card recipe; blue working tint 9/2/26 to match the
                    receivings picker and the detail page's account
                    accordions): chevron, tinted icon tile, name, count
                    chip, then the section's net at the right edge. The
                    whole row toggles the fold. */}
                <button
                  type="button"
                  onClick={() => toggleMethodCollapsed(method)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer select-none transition-colors ${
                    sectionCollapsed ? 'hover:bg-[#F0F7FF]' : 'bg-[#F8FAFF] border-b border-[#E4EDFB]'
                  }`}
                >
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${sectionCollapsed ? '' : 'rotate-90'}`}
                  />
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    sectionCollapsed ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-primary'
                  }`}>
                    <MIcon className="w-4 h-4" />
                  </span>
                  <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>{method}</h3>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] " style={{ fontWeight: 600 }}>
                    {sectionGroups.length}
                  </span>
                  {methodErrors > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-rose-50 text-rose-600 text-[10.5px]" style={{ fontWeight: 600 }}>
                      <TriangleAlert className="w-3 h-3" />
                      {methodErrors} missing method details
                    </span>
                  )}
                  {/* All one account already (Eli 10/5): just name it, no
                      bulk control — there's nothing to reconcile. */}
                  {sectionSingleAccount ? (
                    <span className="ml-auto inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 shrink-0" style={{ fontWeight: 500 }} title="Every payment in this section draws from this account">
                      <Landmark className="w-3 h-3 text-slate-400" />
                      {sectionSingleAccount.label}
                    </span>
                  ) : (
                  /* Section-wide account move (9/2/26 review): every
                     payment under this method to ONE pay-from account in
                     a single pick — the existing bulk-move picker, scoped
                     to the section's vendors. Shown only when accounts
                     actually differ (Eli 10/5). */
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openBulkMove(sectionGroups.map((g) => g.vendor));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openBulkMove(sectionGroups.map((g) => g.vendor));
                          }
                        }}
                        className="ml-auto inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:border-primary/45 hover:bg-blue-50/60 hover:text-primary transition-colors cursor-pointer shrink-0"
                        style={{ fontWeight: 500 }}
                      >
                        <Landmark className="w-3 h-3 text-slate-400" />
                        Pay All from One Account
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[300] max-w-[250px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                      <p className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>Pay all from one account</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Set one pay-from account for all {method} payments in this section. This applies to this run only. Vendor defaults stay the same.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  )}
                  {/* Undo for the move (9/2/26): appears only while any
                      payment in the section sits on a changed account AND
                      the section still spans multiple accounts. */}
                  {!sectionSingleAccount && sectionGroups.some((g) => g.accountOverridden) && (
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            resetAccountsToDefaults(sectionGroups.filter((g) => g.accountOverridden).map((g) => g.vendor));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              resetAccountsToDefaults(sectionGroups.filter((g) => g.accountOverridden).map((g) => g.vendor));
                            }
                          }}
                          aria-label="Revert this section to each vendor's own account"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-border bg-white text-slate-500 hover:border-primary/45 hover:bg-blue-50/60 hover:text-primary transition-colors cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="z-[300] max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                        <p className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>Revert to vendor accounts</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                          {sectionGroups.filter((g) => g.accountOverridden).length} payment{sectionGroups.filter((g) => g.accountOverridden).length === 1 ? '' : 's'} in this section {sectionGroups.filter((g) => g.accountOverridden).length === 1 ? 'sits' : 'sit'} on a changed account. Put each back on its vendor's own.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <span className="text-[12.5px] text-foreground " style={{ fontWeight: 600 }}>
                    {money(sectionNet)}
                  </span>
                </button>
                {/* Vendor rows, NOT cards (8/28/26 evening): the nested
                    border-in-border-in-border read badly, so vendors are
                    flat divider-separated rows inside the method card. */}
                {/* Waterfall expand/collapse (user 10/9): the same grid-rows
                    transition the vendor rows use, so both levels animate alike. */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    sectionCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                  }`}
                >
                <div className="overflow-hidden min-h-0">
                <div className="divide-y divide-border/60">
                {sectionGroups.map((group) => (
                  <VendorGroupCard
                    key={group.vendor}
                    flat
                    run={run}
                    group={group}
                    invoices={invoices}
                    payments={payments}
                    searchQuery={paySearch}
                    onChangeMethod={() => setMethodVendor(group.vendor)}
                    onChangeAccount={() => setAccountVendor(group.vendor)}
                    onResetAccount={() => resetAccountsToDefaults([group.vendor])}
                    onSetAdvanceAccount={(account) =>
                      runsApi.updateRun(run.id, (r) => ({
                        ...r,
                        groups: r.groups.map((g) => (g.vendor === group.vendor ? { ...g, advanceAccount: account } : g)),
                      }))
                    }
                    onSetLineAmount={setLineAmount}
                    onRemoveLine={(invoiceId) => {
                      // Confirm before the line leaves (user 10/5).
                      const l = run.lines.find((x) => x.invoiceId === invoiceId);
                      if (!l) return;
                      setRemoveConfirm({
                        invoiceId,
                        invoiceNumber: l.invoiceNumber,
                        vendor: l.vendor,
                        amount: l.payAmount ?? l.balanceAtAdd ?? 0,
                      });
                    }}
                    onSetCredit={(draws) => {
                      // Anchored draws survive picker edits (8/28/26):
                      // the picker only owns the on-account entries.
                      runsApi.updateRun(run.id, (r) => ({
                        ...r,
                        groups: r.groups.map((g) =>
                          g.vendor === group.vendor
                            ? {
                                ...g,
                                creditApplied: [
                                  ...g.creditApplied.filter((c) => c.anchoredInvoiceNumber),
                                  ...Object.entries(draws).map(([paymentId, amount]) => ({
                                    paymentId,
                                    paymentNumber: payments.find((p) => p.id === paymentId)?.paymentNumber ?? paymentId,
                                    amount,
                                  })),
                                ],
                              }
                            : g,
                        ),
                      }));
                    }}
                    onSetAnchoredCredit={(paymentId, amount) => {
                      // Auto-applied draws stay editable (8/28/26): the
                      // user adjusts the amount; zero removes the draw.
                      runsApi.updateRun(run.id, (r) => ({
                        ...r,
                        groups: r.groups.map((g) =>
                          g.vendor === group.vendor
                            ? {
                                ...g,
                                creditApplied:
                                  amount <= 0.004
                                    ? g.creditApplied.filter((c) => c.paymentId !== paymentId)
                                    : g.creditApplied.map((c) =>
                                        c.paymentId === paymentId ? { ...c, amount } : c,
                                      ),
                              }
                            : g,
                        ),
                      }));
                    }}
                    onSetNote={(note) => patchGroup(group.vendor, { note: note || undefined })}
                    onSetReference={(reference) => patchGroup(group.vendor, { reference: reference || undefined })}
                    onAddAttachment={(name, size) =>
                      patchGroup(group.vendor, {
                        attachments: [...(group.attachments ?? []), { name, size }],
                      })
                    }
                    onRemoveAttachment={(name) =>
                      patchGroup(group.vendor, {
                        attachments: (group.attachments ?? []).filter((a) => a.name !== name),
                      })
                    }
                    prepayOpenSignal={prepayReview.vendor === group.vendor ? prepayReview.n : 0}
                    attentionSignal={attention?.vendor === group.vendor ? { field: attention.field, n: attention.n } : undefined}
                    collapsible
                    collapsed={collapsedVendors.has(group.vendor)}
                    onToggleCollapse={() => toggleVendorCollapsed(group.vendor)}
                    blockedLines={shownBlockers}
                  />
                ))}
                </div>
                </div>
                </div>
              </section>
            );
          })}
        </div>
        </div>

        {/* Rail: the Order Summary recipe. The card fills the column so
            no canvas shows below it (8/4/26); the meta and breakdown
            scroll in the middle while the Total stays pinned at the
            bottom right, the Create Vendor Invoice rail pattern. */}
        {/* -mb-3 crosses the root gap so the card's bottom edge lands on
            the footer CTA bar (9/2/26 review, the invoice sidebar read);
            the bottom corners square off against the footer's border. */}
        <div className="w-[320px] shrink-0 flex flex-col min-h-0 -mb-3">
          <div className="rounded-t-xl border border-b-0 border-border bg-card overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-border/70">
              <p className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>Run Summary</p>
            </div>
            <div className="px-4 py-3 border-b border-border/70 space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Payment Date</span>
                {/* Editable right here (Eli 9/25: "I would make this
                    editable") — the execute stage's popover recipe. */}
                <Popover open={summaryDateOpen} onOpenChange={setSummaryDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 text-[12px] cursor-pointer rounded px-1 -mr-1 transition-colors ${
                        summaryClosedPeriod ? 'text-rose-700 hover:bg-rose-50' : 'text-foreground hover:text-primary hover:bg-blue-50/60'
                      }`}
                      style={{ fontWeight: 600 }}
                      title="Change the payment date"
                    >
                      <Calendar className={`w-3 h-3 ${summaryClosedPeriod ? 'text-rose-500' : 'text-slate-400'}`} />
                      {humanDate(run.paymentDate)}
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${summaryDateOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]"
                    style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                  >
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Payment Date</p>
                      {summaryClosedPeriod ? (
                        <p className="text-[11px] text-rose-600 mt-1" style={{ fontWeight: 500 }}>
                          That date falls in a closed period. Pick a date in the current month or later.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">Payments post on this date.</p>
                      )}
                    </div>
                    <DateCalendar
                      value={run.paymentDate}
                      showFooter={false}
                      onChange={(v) => {
                        if (!v) return;
                        runsApi.updateRun(run.id, { paymentDate: v });
                        setSummaryDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Vendors</span>
                <span className="text-foreground " style={{ fontWeight: 600 }}>{run.groups.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Invoices</span>
                <span className="text-foreground " style={{ fontWeight: 600 }}>{lines.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Pay-From Accounts</span>
                <span className="text-foreground " style={{ fontWeight: 600 }}>{totals.length}</span>
              </div>
            </div>
            {/* Breakdown (restructured 8/12/26, BA): the vendor list
                starts at the TOP, right under the run facts, and scrolls
                when long; the Hide/Show toggle moved to the bottom RIGHT
                above the subtotal block, which stays anchored over the
                pinned Total. The toggle only folds the subtotal NUMBERS
                (8/31/26) — the vendor list always stays. */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div
                onScroll={railHoverLock.onScroll}
                className={`px-4 pt-3 overflow-y-auto min-h-0 ${railHoverLock.locked ? '[&>*]:pointer-events-none' : ''}`}
              >
                  {/* Vendor cards (8/7/26): the row itself stays quiet,
                      avatar, name, invoice count, net. The full payment
                      facts (method, account, invoice lines, credit) live
                      in the listing-style dark-header quick card that
                      opens on hover. The account cash-out moved into the
                      Show-breakdown block below (9/2/26 review, fourth
                      pass) — interleaved account headers read badly. */}
                  <div className="space-y-1.5">
                    {run.groups.map((g) => {
                      const glines = lines.filter((l) => l.vendor === g.vendor);
                      const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === g.payFromAccountId);
                      const gcredit = groupCredit(g);
                      const MIcon = paymentMethodInfo(g.methodType).icon;
                      // No-method error rides the rail card too (9/2/26
                      // review): now that the rail is vendor cards, the
                      // vendor with the problem wears the rose itself.
                      const gNoMethod = vendorHasNoMethod(g.vendor) && !g.methodOverridden;
                      return (
                        <HoverCard key={g.vendor} openDelay={300} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              onClick={() => jumpToVendor(g.vendor)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                                gNoMethod
                                  ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                                  : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-blue-50/40'
                              }`}
                            >
                              <VendorAvatar name={g.vendor} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{g.vendor}</p>
                                <p className={`text-[10.5px] truncate ${gNoMethod ? 'text-rose-500' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                                  {glines.length} invoice{glines.length === 1 ? '' : 's'}
                                  {gNoMethod ? ' · needs a payment method' : ''}
                                </p>
                              </div>
                              {/* Vendor-credit mark (BA 8/12/26): the
                                  wallet flags vendors whose payment draws
                                  credit, spottable at a glance. Teal, the
                                  vendor credit identity (user 10/22/26). */}
                              {gcredit > 0.004 && (
                                <span
                                  className="shrink-0 w-[18px] h-[18px] rounded-full bg-teal-50 border border-teal-100 text-teal-700 inline-flex items-center justify-center"
                                  aria-label={`${money(gcredit)} vendor credit applied`}
                                >
                                  <Wallet className="w-2.5 h-2.5" />
                                </span>
                              )}
                              <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                                {money(groupNet(run, g))}
                              </span>
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="left"
                            align="start"
                            sideOffset={8}
                            className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                          >
                            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                              <div className="flex items-center gap-3 relative">
                                <div className="shrink-0">
                                  <VendorAvatar name={g.vendor} size="md" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{g.vendor}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {glines.length} invoice{glines.length === 1 ? '' : 's'} · one payment
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white px-4 py-3 space-y-2">
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <MIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{g.methodType}</span>
                              </div>
                              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{acct?.label ?? g.payFromAccountId}</span>
                              </div>
                              <div className="pt-2 mt-1 border-t border-border/50 space-y-1.5">
                                {glines.slice(0, 4).map((l) => (
                                  <div key={l.invoiceId} className="flex items-center justify-between gap-2 text-[11.5px]">
                                    <span className="text-slate-600 truncate">{l.invoiceNumber}</span>
                                    <span className="text-slate-700 shrink-0" style={{ fontWeight: 500 }}>
                                      {money(l.payAmount)}
                                    </span>
                                  </div>
                                ))}
                                {glines.length > 4 && (
                                  <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
                                    +{glines.length - 4} more invoice{glines.length - 4 === 1 ? '' : 's'}
                                  </p>
                                )}
                                {gcredit > 0 && (
                                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                    <span className="text-teal-700">Vendor Credit</span>
                                    <span className="text-teal-700 shrink-0" style={{ fontWeight: 500 }}>
                                      −{money(gcredit)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Net Payment</span>
                              <span className="text-[12.5px] text-foreground " style={{ fontWeight: 700 }}>
                                {money(groupNet(run, g))}
                              </span>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </div>
              </div>
            </div>
            {/* Bottom band — the Create Vendor Invoice sidebar recipe
                (9/2/26 review): left-aligned Show breakdown toggle,
                animated collapse, quiet subtotal rows with the per-
                account cash-out INSIDE the breakdown, then the compact
                Total row pinned against the footer CTA. */}
            <div className="mt-auto shrink-0 px-4 py-3 border-t border-border/60 bg-white">
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer mb-2 p-0 bg-transparent border-0"
                style={{ fontWeight: 500 }}
              >
                {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
              </button>
              <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  gridTemplateRows: showBreakdown ? '1fr' : '0fr',
                  opacity: showBreakdown ? 1 : 0,
                }}
                aria-hidden={!showBreakdown}
              >
                <div className="overflow-hidden">
                  <div className="space-y-1 pb-2">
                    {/* Cash out by account, ONE quiet line each (user 9/25
                        second pass: the pill and mask subline were too much
                        information): icon chip, account name, amount; an
                        overdraw shows only a rose warning icon. The full
                        story — type, masked number, balance, cash out,
                        shortfall — lives in the vendor-card-style hover. */}
                    {totals.map((t) => {
                      const over = t.remaining < 0;
                      return (
                        <HoverCard key={t.account.id} openDelay={150} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-slate-50 transition-colors cursor-default">
                              <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${over ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-400'}`}>
                                <Landmark className="w-3 h-3" />
                              </span>
                              <span className={`min-w-0 flex-1 text-[11.5px] truncate ${over ? 'text-rose-700' : 'text-slate-700'}`} style={{ fontWeight: 500 }}>
                                {t.account.label}
                              </span>
                              <span className="shrink-0 inline-flex items-center gap-1.5">
                                {over && <AlertTriangle className="w-3 h-3 text-rose-500" aria-label={`Short ${money(-t.remaining)}`} />}
                                <span className={`text-[12px] ${over ? 'text-rose-600' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                                  −{money(t.selected)}
                                </span>
                              </span>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="left"
                            align="start"
                            sideOffset={8}
                            className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                          >
                            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                              <div className="flex items-center gap-3 relative">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                                  <Landmark className="w-4 h-4 text-slate-200" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{t.account.label}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {[t.account.accountTypeLabel, t.account.accountMask ? `••••${t.account.accountMask}` : null, t.account.bankName].filter(Boolean).join(' · ') || 'Pay-From Account'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white px-4 py-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                <span className="text-slate-600">Available Balance</span>
                                <span className="text-slate-700 shrink-0" style={{ fontWeight: 500 }}>{money(t.account.balance)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                <span className="text-slate-600">Cash Out This Run</span>
                                <span className="text-slate-700 shrink-0" style={{ fontWeight: 500 }}>−{money(t.selected)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                <span className={over ? 'text-rose-600' : 'text-slate-600'}>{over ? 'Short By' : 'Remaining After Run'}</span>
                                <span className={`shrink-0 ${over ? 'text-rose-600' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>
                                  {over ? money(-t.remaining) : money(t.remaining)}
                                </span>
                              </div>
                            </div>
                            {over && (
                              <div className="bg-rose-50/70 border-t border-rose-100 px-4 py-2">
                                <p className="text-[11px] text-rose-700 leading-snug" style={{ fontWeight: 500 }}>
                                  This run overdraws the account. Move payments to another account or transfer funds first.
                                </p>
                              </div>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                    <div className="pt-1.5 mt-0.5 border-t border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Subtotal ({lines.length} invoice{lines.length === 1 ? '' : 's'})</span>
                        <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>
                          {money(run.groups.reduce((s, g) => s + groupGross(run, g), 0))}
                        </span>
                      </div>
                      {run.groups.some((g) => groupCredit(g) > 0) && (
                        <div className="flex justify-between items-center">
                          {/* "Vendor credit" in its teal identity (user
                              10/22/26), the Record Payment name and colour. */}
                          <span className="text-[11px] text-teal-700" style={{ fontWeight: 500 }}>Vendor Credit</span>
                          <span className="text-[12px] text-teal-700 " style={{ fontWeight: 600 }}>
                            −{money(run.groups.reduce((s, g) => s + groupCredit(g), 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>Total</span>
                <span className="text-[14px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
                  {money(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Footer — shell-flush, the P1 recipe: counts on the left, then
          Discard · Submit. Back to Parameters lives in the header stepper,
          and the blocking issue surfaces through the amber strip up top. */}
      <div className={RUN_FOOTER_SHELL}>
        <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
          <span className="text-foreground" style={{ fontWeight: 600 }}>{run.groups.length}</span>
          {` payment${run.groups.length === 1 ? '' : 's'} · `}
          <span className="text-foreground" style={{ fontWeight: 600 }}>{lines.length}</span>
          {` invoice${lines.length === 1 ? '' : 's'}`}
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button type="button" onClick={() => setDeleteOpen(true)} className={FOOTER_BTN_GHOST} style={{ fontWeight: 500 }}>
            Discard
          </button>
          <button
            type="button"
            onClick={() => {
              if (lines.length === 0) {
                toast.error('Nothing to submit', { description: 'This run has no invoices left in it.' });
                return;
              }
              if (openIssues > 0) {
                toast.error('Issues to address', { description: `${openIssues} flagged issue${openIssues === 1 ? '' : 's'} to address before ${isResubmit ? 'resubmitting' : 'submitting'}.` });
                return;
              }
              if (noMethod.length > 0) {
                toast.error('Payment method missing', { description: `Pick a payment method for ${noMethod.length} vendor${noMethod.length === 1 ? '' : 's'} first.` });
                return;
              }
              // Nothing changed since the run reopened (Eli 10/5): confirm
              // before resubmitting, instead of silently sending it back.
              if (!recheckForSubmit()) return;
              if (isResubmit && reopenSigRef.current !== null && runSignature() === reopenSigRef.current) {
                setNoChangeConfirmOpen(true);
                return;
              }
              setConfirmSubmitOpen(true);
            }}
            className={FOOTER_BTN_PRIMARY}
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
            title={openIssues > 0 ? `${openIssues} flagged issue${openIssues === 1 ? '' : 's'} to address before resubmitting` : undefined}
          >
            <Send className="w-3.5 h-3.5" />
            {isResubmit ? 'Resubmit for Approval' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      {/* Move a flagged line to another run (fate 2). */}
      <MoveLineModal
        open={moveIssueId !== null}
        issue={run.changeRequest?.issues.find((i) => i.id === moveIssueId) ?? null}
        runs={runsApi.runs}
        sourceRunId={run.id}
        onClose={() => setMoveIssueId(null)}
        onMove={(target) => {
          if (!moveIssueId) return;
          const issue = run.changeRequest?.issues.find((i) => i.id === moveIssueId);
          const destination = runsApi.moveIssueLine(run.id, moveIssueId, target, BY);
          setMoveIssueId(null);
          if (destination) {
            toast.success(`${issue?.invoiceNumber ?? 'Invoice'} moved to ${destination}`, {
              description: 'This run no longer pays it. The lock followed it.',
            });
          }
        }}
      />

      {/* Per-run method override. */}
      {methodModalVendor && (
        <PaymentMethodModal
          open
          onOpenChange={(open) => !open && setMethodVendor(null)}
          value={methodModalVendor.methodId}
          methods={methodsFor(methodModalVendor.vendor)}
          vendorName={methodModalVendor.vendor}
          hidePrimary
          onApply={(id) => {
            applyMethod(methodModalVendor.vendor, id);
            setMethodVendor(null);
          }}
        />
      )}
      {/* Bulk account move — the same picker, accounts intersected
          across every selected payment's method (8/5/26). */}
      {bulkMoveVendors && (
        <PayFromAccountModal
          open
          onOpenChange={(open) => !open && setBulkMoveVendors(null)}
          value={run.groups.find((g) => g.vendor === bulkMoveVendors[0])?.payFromAccountId ?? ''}
          accounts={bulkEligibleAccounts(bulkMoveVendors)}
          onApply={(id) => {
            applyAccountToVendors(bulkMoveVendors, id);
            setBulkMoveVendors(null);
          }}
        />
      )}

      {/* Per-run pay-from override, filtered to the method's account type. */}
      {accountModalVendor && (
        <PayFromAccountModal
          open
          onOpenChange={(open) => !open && setAccountVendor(null)}
          value={accountModalVendor.payFromAccountId}
          accounts={PAY_FROM_ACCOUNTS.filter((a) => {
            const want = accountTypeForMethod(accountModalVendor.methodType);
            return want === 'any' ? true : a.type === want;
          })}
          onApply={(id) => {
            // Route through the shared move so the card relocates into
            // its new accordion with the scroll + pulse (8/7/26).
            applyAccountToVendors([accountModalVendor.vendor], id);
            setAccountVendor(null);
          }}
        />
      )}

      {/* ── Prepayment stepper (8/5/26): one vendor per step with a live
          per-invoice preview; apply or skip and move through them.
          Never blocks the run, the card control stays either way. ── */}
      {stepper && (
        <PrepaymentStepper
          run={run}
          payments={payments}
          vendors={stepper.vendors}
          idx={stepper.idx}
          onStep={(idx) => setStepper((s) => (s ? { ...s, idx } : s))}
          onApply={(vendor, draws) => {
            // Anchored draws are system-owned; the stepper only writes
            // the on-account entries (8/28/26).
            runsApi.updateRun(run.id, (r) => ({
              ...r,
              groups: r.groups.map((g) =>
                g.vendor === vendor
                  ? {
                      ...g,
                      creditApplied: [
                        ...g.creditApplied.filter((c) => c.anchoredInvoiceNumber),
                        ...Object.entries(draws).map(([paymentId, amount]) => ({
                          paymentId,
                          paymentNumber: payments.find((p) => p.id === paymentId)?.paymentNumber ?? paymentId,
                          amount,
                        })),
                      ],
                    }
                  : g,
              ),
            }));
          }}
          onApplyAll={() => {
            // One click, every vendor (Eli 9/25): fill each vendor's
            // on-account credit up to its remaining gross, oldest advance
            // first, the same autofill the per-vendor Apply uses.
            const applied: string[] = [];
            runsApi.updateRun(run.id, (r) => ({
              ...r,
              groups: r.groups.map((g) => {
                if (!stepper.vendors.includes(g.vendor)) return g;
                const cap = round2(Math.max(0, groupGross(r, g) - anchoredAppliedOf(g)));
                const srcs = payments
                  .filter((p) => p.type === 'Prepayment' && p.vendor === g.vendor && p.unappliedAmount > 0 && !p.preInvoiceId)
                  .sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
                if (cap <= 0.004 || srcs.length === 0) return g;
                let need = cap;
                const draws: { paymentId: string; paymentNumber: string; amount: number }[] = [];
                for (const s of srcs) {
                  if (need <= 0.004) break;
                  const take = round2(Math.min(s.unappliedAmount, need));
                  if (take > 0.004) { draws.push({ paymentId: s.id, paymentNumber: s.paymentNumber, amount: take }); need = round2(need - take); }
                }
                if (draws.length === 0) return g;
                applied.push(g.vendor);
                return { ...g, creditApplied: [...g.creditApplied.filter((c) => c.anchoredInvoiceNumber), ...draws] };
              }),
            }));
            toast.success(
              applied.length > 0 ? `Vendor credit applied to ${applied.length} vendor${applied.length === 1 ? '' : 's'}` : 'No credit to apply',
              { description: applied.length > 0 ? 'Each vendor drew its maximum available credit.' : 'No vendor had unapplied credit to draw.' },
            );
            setStepper(null);
          }}
          onClose={() => setStepper(null)}
        />
      )}

      {/* ── Discard confirmation — the amber Record Payment discard
          recipe (8/4/26): AlertTriangle hero, red Discard changes CTA. ── */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteOpen(false)}
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
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}
              >
                Discard
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Discard this payment run?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                Nothing has posted. {lines.length} invoice{lines.length === 1 ? '' : 's'} across {run.groups.length} vendor{run.groups.length === 1 ? '' : 's'} return to the payable pool. This action cannot be undone.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
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

      {/* ── Remove-from-run confirmation (user 10/5) — the discard
          recipe at line scale: rose gradient hero, what leaves and what
          happens, stacked CTAs. ── */}
      {removeConfirm && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setRemoveConfirm(null)}
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
                <Trash2 className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}
              >
                Remove from Run
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Remove {removeConfirm.invoiceNumber} from this run?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                {removeConfirm.vendor}'s {money(removeConfirm.amount)} line leaves the run and the invoice returns to the eligible pool. Nothing has posted; totals rebalance.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    removeLine(removeConfirm.invoiceId);
                    setRemoveConfirm(null);
                    toast.success(`${removeConfirm.invoiceNumber} removed from the run`, {
                      description: 'It stays eligible and can be added back from the pool.',
                    });
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Remove from Run
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Keep in Run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── No-change resubmit guard (Eli 10/5): the run reopened for
          changes but nothing moved. Confirm before sending it straight
          back to the approver. ── */}
      <AlertDialog open={noChangeConfirmOpen} onOpenChange={setNoChangeConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#D97706', filter: 'blur(50px)' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: '#B45309' }} />
            </div>
            <AlertDialogTitle className="sr-only">Resubmit without changes?</AlertDialogTitle>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Resubmit without any changes?
            </h3>
            <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
              You haven't changed anything since the run reopened. It goes back to the approver exactly as it was flagged.
            </p>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => { setNoChangeConfirmOpen(false); setConfirmSubmitOpen(true); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                style={{ fontWeight: 600, backgroundColor: '#D97706' }}
              >
                Resubmit Anyway
              </button>
              <button
                type="button"
                onClick={() => setNoChangeConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Submit confirmation — the green Record Payment confirm with
          the GL IMPACT table (8/4/26): debit A/P, credit each pay-from
          account, credit prepayments when credit is drawn. Confirming
          submits; the route then renders the run's detail page. ── */}
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent
          className="flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          {(() => {
            const gross = run.groups.reduce((s, g) => s + groupGross(run, g), 0);
            const creditTotal = run.groups.reduce((s, g) => s + groupCredit(g), 0);
            // Pre-invoices debit their advances account (user 10/22/26).
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
            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-9 pb-5"
                  style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(255,255,255,0.3) 70%, transparent 100%)' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#059669' }} />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                    <Landmark className="w-7 h-7" style={{ color: '#047857' }} />
                  </div>
                  <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857',  }}>
                    {isResubmit ? 'Resubmit for Approval' : 'Submit for Approval'}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-7 pb-7">
                  <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    Submit {run.groups.length} payment{run.groups.length === 1 ? '' : 's'} for {money(total)}?
                  </AlertDialogTitle>
                  <p className="text-[12px] text-slate-500 mt-1.5">
                    Nothing posts yet. The approver reviews this proposal before any money moves.
                  </p>
                  {showGlOnConfirmations && (
                  <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                      <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>GL Impact at Execution</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <table className="w-full text-[12px]">
                        <tbody>
                          {glRows.map((l, i) => {
                            // Debit/credit direction arrows, the Record
                            // Payment recipe verbatim: on asset/expense
                            // accounts a debit increases; on liability a
                            // credit increases. Green up / red down, the
                            // rule lives in the tooltip.
                            const isAsset = l.code.startsWith('1');
                            const isExpense = l.code.startsWith('5') || l.code.startsWith('6');
                            const isDebit = l.debit > 0;
                            const up = isAsset || isExpense ? isDebit : !isDebit;
                            const kind = isAsset ? 'asset' : isExpense ? 'expense' : 'liability';
                            const dirExplain = `${isDebit ? 'Debit' : 'Credit'} ${up ? 'increases' : 'decreases'} this ${kind} account, ${l.code} ${l.name}.`;
                            return (
                            <tr key={i} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-3 py-1.5">
                                <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{l.code}</span>
                                <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
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
                              <td className="px-3 py-1.5 text-right ">{l.debit > 0 ? <span style={{ fontWeight: 600 }}>{money(l.debit)}</span> : <span className="text-slate-300">·</span>}</td>
                              <td className="px-3 py-1.5 text-right ">{l.credit > 0 ? <span style={{ fontWeight: 600 }}>{money(l.credit)}</span> : <span className="text-slate-300">·</span>}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50/70">
                            <td className="px-3 py-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                                <CheckCircle2 className="w-2.5 h-2.5" /> Debit = Credit
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(glRows.reduce((s, l) => s + l.debit, 0))}</td>
                            <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(glRows.reduce((s, l) => s + l.credit, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  )}
                  <div className="w-full mt-5 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setConfirmSubmitOpen(false);
                        if (!recheckForSubmit()) return;
                        submit();
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: '#059669', color: '#fff' }}
                    >
                      Submit for Approval
                    </button>
                    <button
                      onClick={() => setConfirmSubmitOpen(false)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      Keep Editing
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Prepayment stepper (8/5/26, redesigned 8/6) ─────────────────────
 * The Apply-prepayment-credit modal recipe (gradient amber hero +
 * source-row fields), walked vendor by vendor. Draws are editable per
 * advance; Apply or Skip moves to the next vendor. Never blocks. */
function PrepaymentStepper({
  run,
  payments,
  vendors,
  idx,
  onStep,
  onApply,
  onApplyAll,
  onClose,
}: {
  run: PaymentRun;
  payments: Payment[];
  vendors: string[];
  idx: number;
  onStep: (idx: number) => void;
  onApply: (vendor: string, draws: Record<string, number>) => void;
  /** Apply the maximum available credit to EVERY vendor at once (Eli 9/25). */
  onApplyAll: () => void;
  onClose: () => void;
}) {
  const vendor = vendors[idx];
  const group = run.groups.find((g) => g.vendor === vendor);
  const vlines = liveLines(run).filter((l) => l.vendor === vendor);
  const valid = !!group && vlines.length > 0;
  const next = () => (idx + 1 < vendors.length ? onStep(idx + 1) : onClose());

  const gross = group ? groupGross(run, group) : 0;
  // Anchored draws are auto-applied and locked to their invoice: they
  // reduce what the stepper can absorb but never appear as rows.
  const anchoredTotal = group ? anchoredAppliedOf(group) : 0;
  const capTotal = round2(Math.max(0, gross - anchoredTotal));
  // Editable ON-ACCOUNT draws, seeded from what the run already applies.
  const [draws, setDraws] = useState<Record<string, number>>({});
  useEffect(() => {
    if (group)
      setDraws(
        Object.fromEntries(
          group.creditApplied.filter((c) => !c.anchoredInvoiceNumber).map((c) => [c.paymentId, c.amount]),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  // The vendor left the run mid-flow: skip the step automatically.
  useEffect(() => {
    if (!valid) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, idx]);

  // Arrow keys step between vendors (8/28/26 late) — except while a
  // field has focus, where arrows must keep moving the caret.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        onStep(idx - 1);
      } else if (e.key === 'ArrowRight' && idx < vendors.length - 1) {
        e.preventDefault();
        onStep(idx + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, vendors.length, onStep]);

  if (!valid || !group) return null;

  const sources = payments
    .filter((p) => p.type === 'Prepayment' && p.vendor === vendor && p.unappliedAmount > 0 && !p.preInvoiceId)
    .sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));

  const drawnTotal = round2(Object.values(draws).reduce((s, v) => s + (v || 0), 0));
  const active = drawnTotal > 0.004;
  const headroomFor = (id: string) => {
    const others = round2(drawnTotal - (draws[id] || 0));
    return round2(Math.max(0, capTotal - others));
  };
  // No silent capping (BA 8/12/26): the field keeps what the user typed;
  // an over-max draw turns red with a tooltip and a one-click fix, the
  // invoice line's over-qty treatment. Apply stays locked while any row
  // is over.
  const maxDrawFor = (id: string, remaining: number) => round2(Math.min(remaining, headroomFor(id)));
  const setDraw = (id: string, raw: number) => {
    const amount = round2(Math.max(0, raw));
    setDraws((prev) => {
      const nextDraws = { ...prev };
      if (amount <= 0.004) delete nextDraws[id];
      else nextDraws[id] = amount;
      return nextDraws;
    });
  };
  const toggleSource = (id: string, remaining: number) => {
    if ((draws[id] || 0) > 0.004) {
      setDraws((prev) => {
        const nextDraws = { ...prev };
        delete nextDraws[id];
        return nextDraws;
      });
    } else {
      setDraw(id, maxDrawFor(id, remaining));
    }
  };
  const anyOver = sources.some((s) => (draws[s.id] || 0) > maxDrawFor(s.id, s.unappliedAmount) + 0.004);
  const autoFill = (): Record<string, number> => {
    let need = capTotal;
    const filled: Record<string, number> = {};
    for (const s of sources) {
      if (need <= 0.004) break;
      const take = round2(Math.min(s.unappliedAmount, need));
      if (take > 0.004) {
        filled[s.id] = take;
        need = round2(need - take);
      }
    }
    return filled;
  };

  const apply = () => {
    onApply(vendor, active ? draws : autoFill());
    next();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* FIXED height (8/28/26 late): vendors carry different numbers of
          prepayment records, and a content-driven height made the modal
          jump while stepping — now the list scrolls inside instead. */}
      <div
        className="bg-white rounded-2xl w-full sm:w-[620px] h-[560px] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ maxWidth: 'min(620px, calc(100vw - 2rem))', boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Purple gradient hero (8/28/26: prepayment wears its own purple
            everywhere, never amber) — the Apply-prepayment recipe with
            the stepper's vendor count and progress dots. */}
        <div
          className="relative flex flex-col items-center pt-6 pb-3.5 shrink-0"
          style={{ background: 'linear-gradient(180deg, #F3E8FF 0%, rgba(243,232,255,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#7E22CE', filter: 'blur(50px)' }} />
          {/* The hero Back button is gone (8/12/26): the vendor chip's
              flanking arrows are the stepper navigation now. */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E9D5FF' }}>
            <Wallet className="w-6 h-6" style={{ color: '#7E22CE', strokeWidth: 2 }} />
          </div>
          <p className="mt-2.5 text-[17px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            Apply vendor credit to this run?
          </p>
          {/* ONE copy family for every vendor-credit prompt (BA 9/25):
              the Record Payment interstitial's phrasing — who has how
              much, apply here or keep it. */}
          <p className="text-[11.5px] mt-0.5 mx-auto text-muted-foreground text-center px-8" style={{ lineHeight: 1.5, maxWidth: '440px' }}>
            {vendor} has <span className="text-foreground" style={{ fontWeight: 600 }}>{money(sources.reduce((s, x) => s + (x.unappliedAmount ?? 0), 0))}</span> in vendor credit. Apply it here, or keep it for a later invoice.
            {/* The anchored-advance note rides an info tip HERE, where the
                credit is being explained (user 9/25) — not as a floating
                line over the footer. */}
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex align-middle ml-1 cursor-help">
                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] z-[300]">
                <p className="text-[11px] text-slate-500 leading-snug">
                  Only the on-account credit shows here. Prepayments made against a pre-invoice are applied automatically.
                </p>
              </TooltipContent>
            </Tooltip>
          </p>
          {/* Vendor identity chip (8/12/26, was a plain text line): the
              avatar + name in a white pill so WHO this step settles is
              unmissable, flanked by prev/next arrows to change vendor
              (BA 8/12/26). */}
          <div className="mt-2.5 flex items-center gap-2 max-w-[90%]">
            <button
              type="button"
              onClick={() => onStep(idx - 1)}
              disabled={idx === 0}
              className="shrink-0 w-7 h-7 rounded-full border border-purple-200/80 bg-white flex items-center justify-center text-slate-500 hover:text-foreground hover:border-purple-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default shadow-sm"
              aria-label="Previous vendor"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Fixed-width chip (8/28/26 late): name lengths vary, so the
                chip keeps one footprint and the arrows one position. */}
            <div className="w-[300px] inline-flex items-center justify-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white border border-purple-200/80 shadow-sm">
              <VendorAvatar name={vendor} size="sm" />
              <span className="min-w-0 text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{vendor}</span>
              <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap" style={{ fontWeight: 500 }}>
                {idx + 1} of {vendors.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onStep(idx + 1)}
              disabled={idx === vendors.length - 1}
              className="shrink-0 w-7 h-7 rounded-full border border-purple-200/80 bg-white flex items-center justify-center text-slate-500 hover:text-foreground hover:border-purple-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default shadow-sm"
              aria-label="Next vendor"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* Progress dots — GREEN only once the user applies an on-account
              draw in this stepper (8/31/26); system-assigned anchored credit
              never colors a dot. The purple halo marks the current step.
              Each dot jumps straight to its vendor. */}
          <span className="mt-2 inline-flex items-center gap-1.5">
            {vendors.map((v, i) => {
              const g = run.groups.find((gr) => gr.vendor === v);
              const applied = g ? groupCredit(g) - anchoredAppliedOf(g) > 0.004 : false;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onStep(i)}
                  aria-label={`Go to ${v}`}
                  className="w-2 h-2 rounded-full transition-all cursor-pointer p-0 border-0"
                  style={{
                    backgroundColor: applied ? '#10B981' : i === idx ? '#7E22CE' : '#E2E8F0',
                    boxShadow: i === idx ? '0 0 0 2px #E9D5FF' : undefined,
                  }}
                />
              );
            })}
          </span>
        </div>

        {/* Source rows — the picker's field recipe verbatim: checkbox,
            record + date, live "left" chip, inline amount, Max. */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-slate-50/40">
          {sources.length === 0 ? (
            <TableEmptyState
              compact
              kind="no-data"
              entity={{ singular: 'prepayment', plural: 'prepayments' }}
              title="No on-account prepayments yet"
              description="No on-account prepayments available for this vendor."
            />
          ) : (
            sources.map((s) => {
              const drawn = draws[s.id] || 0;
              const checked = drawn > 0.004;
              const cap = maxDrawFor(s.id, s.unappliedAmount);
              const over = drawn > cap + 0.004;
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border pl-3 pr-2.5 py-2 transition-colors cursor-pointer ${
                    over
                      ? 'border-rose-300 bg-rose-50/40'
                      : checked
                        ? 'border-purple-300 bg-purple-50/60'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => toggleSource(s.id, s.unappliedAmount)}
                >
                  <div className="flex items-center gap-2.5">
                    <Checkbox checked={checked} onCheckedChange={() => toggleSource(s.id, s.unappliedAmount)} onClick={(e) => e.stopPropagation()} />
                    {/* Credit quick card on hover (Jennifer 9/1/26): see
                        the credit's story, decide apply-or-go-fix-it,
                        without losing your place in the stepper. */}
                    <CreditQuickCard
                      source={{
                        id: s.id,
                        label: s.paymentNumber,
                        date: s.paymentDate,
                        remaining: s.unappliedAmount,
                        original: s.amount,
                        method: s.paymentMethod,
                        memo: s.memo || undefined,
                        appliedInvoices: s.appliedInvoices,
                        recordedBy: s.createdBy,
                      }}
                      fmt={money}
                    >
                      <div className="min-w-0 flex-1 cursor-help">
                        {/* The ID is a real link now (user 9/25): black by
                            default, blue on hover, opens the prepayment in a
                            new tab. Stops propagation so it never toggles the
                            row; the hover quick-card stays. */}
                        <a
                          href={`/payments-v2/${encodeURIComponent(s.paymentNumber)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[12px] text-foreground hover:text-primary hover:underline underline-offset-2 truncate transition-colors cursor-pointer w-fit max-w-full"
                          style={{ fontWeight: 600 }}
                        >
                          {s.paymentNumber}
                        </a>
                        <p className="text-[10px] text-slate-400 mt-0.5">Recorded {humanDate(s.paymentDate)}</p>
                      </div>
                    </CreditQuickCard>
                    <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 text-slate-600 text-[10px] px-1.5 py-px " style={{ fontWeight: 600 }}>
                      {money(round2(Math.max(0, s.unappliedAmount - drawn)))} left
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Over-max warning (BA 8/12/26): never silently
                          snap the typed value; go red with a tooltip and
                          leave the fix to the user. */}
                      <Tooltip open={over ? undefined : false}>
                        <TooltipTrigger asChild>
                          <div className="relative w-[136px]">
                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[11px] ${over ? 'text-rose-400' : 'text-slate-400'}`}>$</span>
                            <MoneyInput
                              fluid
                              value={drawn}
                              onValueChange={(n) => setDraw(s.id, n)}
                              placeholder="0.00"
                              className={`flex h-8 w-full min-w-0 rounded-md border bg-white pl-5 pr-11 py-1 text-[11px] outline-none transition-[color,box-shadow] focus-visible:ring-[3px] ${
                                over
                                  ? 'border-rose-400 text-rose-600 focus-visible:border-rose-500 focus-visible:ring-rose-100'
                                  : checked
                                    ? 'border-purple-300 focus-visible:border-ring focus-visible:ring-ring/50'
                                    : 'border-slate-200 focus-visible:border-ring focus-visible:ring-ring/50'
                              }`}
                            />
                            {/* Inset Max chip (user 9/9): the shared
                                fill-to-cap control, inside the field
                                like modern amount inputs. */}
                            <MaxChip
                              onClick={() => setDraw(s.id, cap)}
                              atMax={drawn >= cap - 0.004}
                              over={over}
                              title={`Fill to ${money(cap)}`}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="z-[400] max-w-[250px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                          <p className="text-[11px] text-rose-600" style={{ fontWeight: 600 }}>Exceeds the max draw</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug ">
                            Left on this prepayment: {money(s.unappliedAmount)}.<br />
                            This payment can take: {money(cap)}.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">Lower the amount, or use Max.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* The anchored-advance footnote moved into the hero's info tip
            (user 9/25): floating above the footer it explained nothing. */}
        {/* Footer — Skip all pinned LEFT-most (BA 8/12/26), Clear beside
            it when a draw is live; Skip · Apply on the right. The
            "Applying $0.00" readout is gone, the Apply button already
            carries the live amount. */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white shrink-0">
          {/* LEFT: both skips together (user 9/25). */}
          <div className="flex items-center gap-2 min-w-0">
            {vendors.length > 1 && (
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 rounded-lg text-[13px] text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
                title="Close without applying any more prepayments; the card controls stay available"
              >
                Skip All
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="h-9 px-3 rounded-lg text-[13px] text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Skip This Vendor
            </button>
            {active && (
              <button type="button" onClick={() => setDraws({})} className="text-[11px] text-slate-400 hover:text-red-500 cursor-pointer" style={{ fontWeight: 500 }}>
                Clear
              </button>
            )}
          </div>
          {/* RIGHT: apply-this-vendor (secondary blue), apply-to-all
              (primary, rightmost) (user 9/25). */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={apply}
              disabled={sources.length === 0 || (capTotal <= 0.004 && !active) || anyOver}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-primary/40 bg-white text-[13px] text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
              style={{ fontWeight: 600 }}
            >
              <Check className="w-3.5 h-3.5" />
              {active ? `Apply ${money(drawnTotal)}` : 'Apply to This Vendor'}
            </button>
            {vendors.length > 1 && (
              <button
                type="button"
                onClick={onApplyAll}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
                style={{ fontWeight: 600 }}
                title="Apply each vendor's maximum available credit across all vendors at once"
              >
                <Check className="w-3.5 h-3.5" />
                Apply to All Vendors
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





/* ── One vendor, one payment ─────────────────────────────────────────── */

// File-type tones for attachment rows, the physical-inventory standard:
// a small colored extension chip in front of name + size.
const EXT_TONES: Record<string, { bg: string; fg: string }> = {
  pdf: { bg: '#FEF2F2', fg: '#B91C1C' },
  doc: { bg: '#EFF6FF', fg: '#1D4ED8' },
  docx: { bg: '#EFF6FF', fg: '#1D4ED8' },
  xls: { bg: '#ECFDF5', fg: '#047857' },
  xlsx: { bg: '#ECFDF5', fg: '#047857' },
  csv: { bg: '#ECFDF5', fg: '#047857' },
  png: { bg: '#F5F3FF', fg: '#6D28D9' },
  jpg: { bg: '#F5F3FF', fg: '#6D28D9' },
  jpeg: { bg: '#F5F3FF', fg: '#6D28D9' },
  gif: { bg: '#F5F3FF', fg: '#6D28D9' },
  mp4: { bg: '#FFF7ED', fg: '#C2410C' },
};
const fileTone = (name: string) => EXT_TONES[name.split('.').pop()?.toLowerCase() ?? ''] ?? { bg: '#F1F5F9', fg: '#475569' };
const fileExt = (name: string) => (name.includes('.') ? name.split('.').pop()! : 'file').slice(0, 4).toUpperCase();
const fmtFileSize = (bytes?: number) =>
  bytes == null
    ? null
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function VendorGroupCard({
  flat,
  run,
  group,
  invoices,
  payments,
  readOnly,
  onChangeMethod,
  onChangeAccount,
  onSetLineAmount,
  onRemoveLine,
  onSetCredit,
  onSetAnchoredCredit,
  onSetNote,
  onSetReference,
  onAddAttachment,
  onRemoveAttachment,
  lineSelect,
  onFlagLine,
  lineStatus,
  blockedLines,
  linePayment,
  headerActions,
  prepayOpenSignal,
  attentionSignal,
  collapsible,
  collapsed,
  onToggleCollapse,
  hideAccountChip,
  onResetAccount,
  onSetAdvanceAccount,
  selectMode,
  searchQuery,
}: {
  /** Row mode (8/28/26 evening): no own border/rounding — the parent
   *  method accordion supplies the card chrome and dividers. */
  flat?: boolean;
  run: PaymentRun;
  group: RunVendorGroup;
  invoices: Invoice[];
  payments: Payment[];
  readOnly?: boolean;
  onChangeMethod?: () => void;
  onChangeAccount?: () => void;
  onSetLineAmount?: (invoiceId: string, amount: number) => void;
  onRemoveLine?: (invoiceId: string) => void;
  onSetCredit?: (draws: Record<string, number>) => void;
  /** Edit an auto-applied anchored draw's amount (8/28/26); 0 removes. */
  onSetAnchoredCredit?: (paymentId: string, amount: number) => void;
  onSetNote?: (note: string) => void;
  /** Method reference (8/5/26): ACH trace number, check number, wire ref. */
  onSetReference?: (reference: string) => void;
  onAddAttachment?: (name: string, size?: number) => void;
  onRemoveAttachment?: (name: string) => void;
  /** Approval's reject-specific-lines mode: checkboxes on each line. */
  lineSelect?: { selected: Set<string>; onToggle: (invoiceId: string) => void };
  /** Submit-time recheck (10/29): invoices that changed since they were
   *  added, highlighted with the reason and a Remove / Fix action. */
  blockedLines?: Map<string, { reason: string; owed?: number }>;
  /** Pending-approval detail page (8/5/26): flag an issue on this line,
   *  opening Request changes pre-scoped to it. */
  onFlagLine?: (invoiceId: string, invoiceNumber: string) => void;
  /** Post-recording (8/5/26): every invoice line wears its posted
   *  payment's state, in the reject action's slot. */
  lineStatus?: 'Paid' | 'Scheduled';
  /** Post-recording (8/5/26): each line links to the payment that paid
   *  it, so "what payment was made" is answerable per invoice. */
  linePayment?: { number: string; onOpen: () => void };
  /** Post-recording header actions (download NACHA file, open the
   *  payment), rendered with the method/account chips. */
  headerActions?: ReactNode;
  /** Bump to open this vendor's prepayment picker (the reminder's Review). */
  prepayOpenSignal?: number;
  /** Bump to PULSE the control an issue jump points at (8/5/26): the
   *  method or account chip flashes red so the fix is unmissable. */
  attentionSignal?: { field: 'method' | 'account'; n: number };
  /** Accordion mode (8/4/26): the header toggles the body. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Account sections carry the pay-from identity (8/5/26), so the
   *  per-card account chip hides; the kebab still moves the payment. */
  hideAccountChip?: boolean;
  /** Revert this payment to the vendor's own pay-from account (9/2/26):
   *  wired to the clickable "run only" pill on the account chip. */
  onResetAccount?: () => void;
  /** Pick the advances account pre-invoice payments debit (user 10/22/26). */
  onSetAdvanceAccount?: (account: string) => void;
  /** Bulk account move: a checkbox rides the card header. */
  selectMode?: { checked: boolean; onToggle: () => void };
  /** Live search text (8/31/26): vendor name and invoice numbers wear
   *  the system-wide yellow match highlight while filtering. */
  searchQuery?: string;
}) {
  const vlines = liveLines(run).filter((l) => l.vendor === group.vendor);
  const hasPreInvoice = vlines.some((l) => l.isPreInvoice);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const gross = groupGross(run, group);
  const credit = groupCredit(group);
  const net = groupNet(run, group);
  const account = PAY_FROM_ACCOUNTS.find((a) => a.id === group.payFromAccountId);
  const noMethod = vendorHasNoMethod(group.vendor) && !group.methodOverridden;
  // Overdrawn-account flag (9/2/26 review): the shortfall shows ON the
  // card's account chip, mirroring the no-method rose treatment.
  const acctTotal = accountTotals(run).find((t) => t.account.id === group.payFromAccountId);
  const acctOverdrawn = !!acctTotal && acctTotal.remaining < 0;
  const methodInfo = paymentMethodInfo(group.methodType);
  const MethodIcon = methodInfo.icon;
  const savedMethod = (vendorHasNoMethod(group.vendor) ? genericPaymentMethods() : vendorPaymentMethods(group.vendor)).find(
    (m) => m.id === group.methodId,
  );

  // Credit sources: the vendor's on-account advances with headroom.
  // Anchored advances auto-apply to their own invoice (8/28/26) — they
  // show in the chip total and the locked info line, never as rows.
  const sources: PrepaySource[] = payments
    .filter((p) => p.type === 'Prepayment' && p.vendor === group.vendor && p.unappliedAmount > 0 && !p.preInvoiceId)
    .map((p) => ({
      id: p.id,
      label: p.paymentNumber,
      date: p.paymentDate,
      remaining: p.unappliedAmount,
      // Credit quick-card facts (Jennifer 9/1/26).
      original: p.amount,
      method: p.paymentMethod,
      memo: p.memo || undefined,
      appliedInvoices: p.appliedInvoices,
      recordedBy: p.createdBy,
    }));
  const anchoredEntries = group.creditApplied.filter((c) => c.anchoredInvoiceNumber);
  const anchoredTotal = round2(anchoredEntries.reduce((s, c) => s + c.amount, 0));
  const draws: Record<string, number> = Object.fromEntries(
    group.creditApplied.filter((c) => !c.anchoredInvoiceNumber).map((c) => [c.paymentId, c.amount]),
  );
  // Per-invoice credit shares (8/5/26): the proportional execution math,
  // previewed as an emerald chip on each covered line.
  const creditShares = creditAllocation(run, group);
  const isCollapsed = !!collapsible && !!collapsed;

  // The memo is ALWAYS present (8/5/26, "what is this payment for?");
  // reference stays opt-in behind its chip; attachments go through the
  // real picker.
  // Both editors are opt-in and CLOSED until they hold content (8/7/26):
  // the memo no longer opens by default.
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Method-aware reference placeholder, the Record Payment field's copy.
  const refPlaceholder =
    group.methodType === 'ACH' ? 'e.g. ACH-901234'
    : group.methodType === 'Check' ? 'Check No., e.g. 10245'
    : group.methodType === 'Wire' ? 'e.g. FED-88112'
    : group.methodType === 'Card' ? 'e.g. AUTH-9921'
    : 'e.g. TRN-55210';
  // Blank memo falls back to the invoice numbers (the ACH addenda rule).
  const memoFallback = `${vlines.slice(0, 2).map((l) => l.invoiceNumber).join(', ')}${vlines.length > 2 ? ` +${vlines.length - 2}` : ''}`;

  // Issue-jump attention: pulse the pointed-at chip for two beats, then
  // settle (the animation runs twice, ~3s total).
  const [attention, setAttention] = useState<'method' | 'account' | null>(null);
  useEffect(() => {
    if (!attentionSignal?.n) return;
    setAttention(attentionSignal.field);
    const t = setTimeout(() => setAttention(null), 3200);
    return () => clearTimeout(t);
  }, [attentionSignal?.n, attentionSignal?.field]);

  return (
    // Blue hover identity (8/5/26, the invoicing card treatment): the
    // border warms toward primary so the accordion reads interactive.
    <div
      data-vendor={group.vendor}
      className={
        flat
          ? 'bg-card scroll-mt-2 transition-colors'
          : `rounded-xl border border-border bg-card overflow-hidden scroll-mt-2 transition-colors ${
              collapsible ? 'hover:border-primary/35' : ''
            }`
      }
    >
      {/* Header — the Create-invoice vendor-row recipe (8/6/26): leading
          chevron tile, vendor identity, then the stat widgets (invoices
          count + net) and the functional method chip on the right. The
          WHOLE header toggles the accordion; only the vendor cell, the
          widgets and the chips swallow their own clicks. */}
      <div
        onClick={collapsible ? onToggleCollapse : undefined}
        className={`px-2 py-2 flex items-center justify-between gap-3 ${
          isCollapsed ? '' : 'border-b border-[#E4EDFB]'
        } ${collapsible ? 'cursor-pointer select-none transition-colors' : ''}`}
        style={{ backgroundColor: !isCollapsed && collapsible ? '#F8FAFF' : undefined }}
        onMouseEnter={(e) => {
          if (collapsible && isCollapsed) e.currentTarget.style.backgroundColor = '#F0F7FF';
        }}
        onMouseLeave={(e) => {
          if (collapsible && isCollapsed) e.currentTarget.style.backgroundColor = '';
        }}
      >
        {/* flex-1 (responsive fix 8/11/26): the vendor identity keeps its
            share of the row instead of collapsing to zero when the chip
            group runs out of room on smaller screens. */}
        <div className="min-w-0 flex-1 flex items-center gap-3">
          {/* Bulk-move selection checkbox (8/5/26). */}
          {selectMode && (
            <input
              type="checkbox"
              checked={selectMode.checked}
              onChange={selectMode.onToggle}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 accent-[#0A77FF] shrink-0 cursor-pointer"
              aria-label={`Select ${group.vendor} for the account move`}
            />
          )}
          {/* Chevron tile — the nested-vendor-row pattern: w-7 h-7
              rounded-md, primary-tinted when expanded. */}
          {collapsible && (
            <div
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{
                backgroundColor: isCollapsed ? 'hsl(var(--muted))' : '#D6E8FF',
                color: isCollapsed ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
              }}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}
          {/* The listing's vendor cell: avatar hover quick card, full card
              on click, name hover states. Clicks here never toggle the
              accordion. */}
          <span className="min-w-0 inline-flex w-fit max-w-full" onClick={(e) => e.stopPropagation()}>
            <VendorCell
              vendor={group.vendor}
              density="comfort"
              description={`${vlines.length} invoice${vlines.length === 1 ? '' : 's'} · one payment`}
              searchQuery={searchQuery}
            />
          </span>
        </div>
        {/* Wrap instead of shrink-0 (responsive fix 8/11/26): when the
            row runs out of width the chips flow onto a second line,
            right-aligned, rather than squeezing the vendor name out. */}
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
          {/* Net readout only while COLLAPSED (8/7/26): expanded, the
              card footer already carries Net, so the header stays quiet. */}
          {isCollapsed && (
            <div className="flex flex-col items-end leading-none mr-0.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>{money(net)}</span>
              <span className="text-[10px] text-slate-500 mt-1" style={{ fontWeight: 500 }}>Net Payment</span>
            </div>
          )}
          {/* BOTH partner-configured fields ride the card (8/7/26), as
              compact stacked fields: the label lives INSIDE the block
              above the value. System tooltips, never the native title. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeMethod?.();
                }}
                className={`group/chip flex flex-col items-start gap-0 w-[180px] xl:w-[210px] px-2 py-1 rounded-lg border text-left transition-colors ${
                  noMethod
                    ? 'border-rose-300 bg-rose-50'
                    : readOnly
                      ? 'border-border bg-white'
                      : 'border-border bg-white hover:border-primary/45 hover:bg-blue-50/60'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${attention === 'method' ? 'animate-field-attention' : ''}`}
              >
                <span className={`text-[10px] ${noMethod ? 'text-rose-500' : 'text-slate-400'}`} style={{ fontWeight: 600 }}>
                  Payment Method
                </span>
                <span className={`flex w-full items-center gap-1.5 text-[12px] ${noMethod ? 'text-rose-700' : 'text-slate-700'} ${readOnly ? '' : 'group-hover/chip:text-primary'} transition-colors`} style={{ fontWeight: 500 }}>
                  <MethodIcon className={`w-3.5 h-3.5 shrink-0 ${noMethod ? 'text-rose-500' : 'text-slate-500'} ${readOnly ? '' : 'group-hover/chip:text-primary'} transition-colors`} />
                  <span className="truncate">
                    {noMethod ? 'Set a payment method' : savedMethod ? `${group.methodType} · ${methodSummary(savedMethod)}` : group.methodType}
                  </span>
                  {group.methodOverridden && !noMethod && (
                    <span className="px-1.5 py-px rounded bg-emerald-50 text-emerald-700 text-[10px] shrink-0" style={{ fontWeight: 600 }}>Run Only</span>
                  )}
                  {!readOnly && <ChevronDown className="ml-auto w-3 h-3 shrink-0 text-slate-400 group-hover/chip:text-primary transition-colors" />}
                </span>
              </button>
            </TooltipTrigger>
            {!readOnly && <TooltipContent className="z-[300]">Change the payment method for this run only.</TooltipContent>}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeAccount?.();
                }}
                className={`group/chip flex flex-col items-start gap-0 w-[180px] xl:w-[210px] px-2 py-1 rounded-lg border text-left transition-colors ${
                  acctOverdrawn
                    ? `border-rose-300 bg-white ${readOnly ? 'cursor-default' : 'hover:border-rose-400 cursor-pointer'}`
                    : readOnly
                      ? 'border-border bg-white cursor-default'
                      : 'border-border bg-white hover:border-primary/45 hover:bg-blue-50/60 cursor-pointer'
                } ${attention === 'account' ? 'animate-field-attention' : ''}`}
              >
                {/* Outline-only rose (9/2/26 review): the fill read as a
                    wall of red across the section — the border carries
                    the alarm, the title and value go rose, the fill
                    stays white. */}
                <span className={`text-[10px] ${acctOverdrawn ? 'text-rose-500' : 'text-slate-400'}`} style={{ fontWeight: 600 }}>
                  Pay-From Account
                </span>
                <span className={`flex w-full items-center gap-1.5 text-[12px] ${acctOverdrawn ? 'text-rose-700' : 'text-slate-700'} ${readOnly || acctOverdrawn ? '' : 'group-hover/chip:text-primary'} transition-colors`} style={{ fontWeight: 500 }}>
                  <span className="truncate">{account?.label ?? group.payFromAccountId}</span>
                  {/* The "run only" pill IS the revert (9/2/26 review):
                      hover explains, click puts the payment back on the
                      vendor's own account. */}
                  {group.accountOverridden && !readOnly && onResetAccount ? (
                    <Tooltip delayDuration={400}>
                      <TooltipTrigger asChild>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onResetAccount();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onResetAccount();
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded bg-emerald-50 text-emerald-700 text-[10px] shrink-0 hover:bg-emerald-100 transition-colors cursor-pointer"
                          style={{ fontWeight: 600 }}
                        >
                          Run Only
                          <RotateCcw className="w-2.5 h-2.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="z-[300] max-w-[230px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                        <p className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>Changed for this run only</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                          Click to revert this payment to the vendor's own account.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    group.accountOverridden && (
                      <span className="px-1.5 py-px rounded bg-emerald-50 text-emerald-700 text-[10px] shrink-0" style={{ fontWeight: 600 }}>Run Only</span>
                    )
                  )}
                  {!readOnly && <ChevronDown className={`ml-auto w-3 h-3 shrink-0 ${acctOverdrawn ? 'text-rose-400' : 'text-slate-400 group-hover/chip:text-primary'} transition-colors`} />}
                </span>
              </button>
            </TooltipTrigger>
            {/* Overdrawn account speaks ON the card (9/2/26 review), not
                only in the rail and the issues list. */}
            {acctOverdrawn && acctTotal ? (
              <TooltipContent className="z-[300] max-w-[250px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                <p className="text-[11px] text-rose-600" style={{ fontWeight: 600 }}>Short by {money(-acctTotal.remaining)}</p>
                {/* User copy 9/23: needs vs has, and the reassurance that
                    a shortfall never blocks submission. */}
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  This run needs <span className="text-foreground " style={{ fontWeight: 600 }}>{money(acctTotal.selected)}</span>, but the account has <span className="text-foreground " style={{ fontWeight: 600 }}>{money(acctTotal.available)}</span>. This won't block submission.
                </p>
              </TooltipContent>
            ) : (
              !readOnly && <TooltipContent className="z-[300]">Change the pay-from account for this run only.</TooltipContent>
            )}
          </Tooltip>
          {/* Advances account (user 10/22/26): the Record Payment
              "Prepayment Account" touchpoint, shown only when the vendor's
              payment covers a pre-invoice. That slice debits this account,
              not payables; 1205 Advance Payments is what a pre-invoice names. */}
          {hasPreInvoice && (
            <Popover open={advanceOpen} onOpenChange={(o) => !readOnly && setAdvanceOpen(o)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={(e) => e.stopPropagation()}
                  className={`group/chip flex flex-col items-start gap-0 w-[180px] xl:w-[210px] px-2 py-1 rounded-lg border text-left transition-colors border-border bg-white ${
                    readOnly ? 'cursor-default' : 'hover:border-primary/45 hover:bg-blue-50/60 cursor-pointer'
                  }`}
                >
                  <span className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>
                    Advances Account
                  </span>
                  <span className={`flex w-full items-center gap-1.5 text-[12px] text-slate-700 ${readOnly ? '' : 'group-hover/chip:text-primary'} transition-colors`} style={{ fontWeight: 500 }}>
                    <span className="truncate">{formatGLAccount(advanceAccountFor(group))}</span>
                    {!readOnly && <ChevronDown className="ml-auto w-3 h-3 shrink-0 text-slate-400 group-hover/chip:text-primary transition-colors" />}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[260px] p-1.5 z-[300]" onClick={(e) => e.stopPropagation()}>
                <p className="px-2 pt-1 pb-1.5 text-[11px] text-slate-500 leading-snug">
                  Where the pre-invoice payment lands. Invoices on this payment still settle payables.
                </p>
                {PREPAYMENT_ASSET_ACCOUNTS.map((acc) => {
                  const active = acc === advanceAccountFor(group);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        onSetAdvanceAccount?.(acc);
                        setAdvanceOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[12px] text-left transition-colors cursor-pointer ${
                        active ? 'bg-blue-50 text-primary' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {formatGLAccount(acc)}
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          {headerActions && (
            <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {headerActions}
            </span>
          )}
        </div>
      </div>


      {/* Smooth expand/collapse (8/7/26): same grid-rows transition as
          the account accordion, so nested levels animate alike. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
      <div className="overflow-hidden min-h-0">
      {/* Invoice lines — matched to the Record Payment table (8/28/26
          evening) so both pay surfaces read identically: Invoice · Due ·
          Balance due · Discount · Prepayment applied · Payment. The
          prepayment column makes an auto-applied advance visible at a
          glance; Payment is the CASH side, net of that credit. */}
      <table className="w-full text-left text-[12px]">
        <thead className="bg-slate-50/80 border-b border-slate-100">
          <tr className="text-[11px] text-slate-500">
            {lineSelect && <th className="pl-4 py-2 w-8" />}
            <th className="pl-4 pr-3 py-2" style={{ fontWeight: 500 }}>Invoice ID</th>
            <th className="px-3 py-2" style={{ fontWeight: 500 }}>Due</th>
            <th className="px-3 py-2 text-right" style={{ fontWeight: 500 }}>Balance Due</th>
            <th className="px-3 py-2 text-right" style={{ fontWeight: 500 }}>Discount</th>
            <th className="px-3 py-2 text-right" style={{ fontWeight: 500 }}>Vendor Credit Applied</th>
            <th className="px-3 py-2 text-right" style={{ fontWeight: 500 }}>Payment</th>
            <th className="pr-3 py-2 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
        {vlines.map((line) => {
          const inv = invoices.find((i) => i.id === line.invoiceId);
          // Once the payment is recorded (lineStatus set), the invoice's
          // live balance is already settled down — validate against the
          // balance AT ADD TIME, never flag an overpayment (8/5/26).
          const settled = !!lineStatus;
          const total = settled ? line.balanceAtAdd : (inv?.outstandingBalance ?? line.balanceAtAdd);
          // Early-pay discount at the run's payment date (8/28/26): the
          // row reads Total, Discount, Amount due; Paying defaults to
          // the discounted due. Settled rows keep their snapshot.
          const discountTerms = !settled && inv ? discountTermsFor(inv) : null;
          const discountLive = discountIsLive(discountTerms, run.paymentDate);
          const discount = discountLive && discountTerms ? discountAmountOn(total, discountTerms) : 0;
          const due = Math.round((total - discount) * 100) / 100;
          const discounted = discountLive && Math.abs(line.payAmount - due) < 0.005;
          const partial = !discounted && line.payAmount < due - 0.004;
          // Overpay means beyond the FULL balance; paying between the
          // discounted due and the total just forgoes the discount.
          const over = !settled && line.payAmount > total + 0.004;
          const forgoing = !settled && discountLive && !over && line.payAmount > due + 0.004;
          const creditShare = creditShares.get(line.invoiceId) ?? 0;
          const anchoredEntry = anchoredEntries.find((c) => c.anchoredInvoiceNumber === line.invoiceNumber);
          // The Payment input reads/writes the CASH side (Record Payment
          // parity, 8/28/26 evening): the pay amount minus the prepayment
          // slice; the gross stays on line.payAmount underneath.
          const cash = Math.max(0, Math.round((line.payAmount - creditShare) * 100) / 100);
          return (
            <tr
              key={line.invoiceId}
              data-run-blocked={blockedLines?.has(line.invoiceId) ? 'true' : undefined}
              onClick={lineSelect ? () => lineSelect.onToggle(line.invoiceId) : undefined}
              className={`transition-colors ${
                blockedLines?.has(line.invoiceId)
                  ? 'bg-red-50/70 shadow-[inset_3px_0_0_#EF4444]'
                  : lineSelect
                    ? 'cursor-pointer hover:bg-rose-50/40'
                    : 'hover:bg-slate-50/50'
              } ${lineSelect?.selected.has(line.invoiceId) ? 'bg-rose-50/60' : ''}`}
            >
              {lineSelect && (
                <td className="pl-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={lineSelect.selected.has(line.invoiceId)}
                    onChange={() => lineSelect.onToggle(line.invoiceId)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 accent-rose-600 shrink-0 cursor-pointer"
                    aria-label={`Select ${line.invoiceNumber}`}
                  />
                </td>
              )}
              <td className="pl-4 pr-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInvoiceTab(line.invoiceNumber);
                    }}
                    className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer p-0 bg-transparent border-0 whitespace-nowrap"
                    style={{ fontWeight: 600 }}
                  >
                    {highlightText(line.invoiceNumber, searchQuery)}
                  </button>
                  {/* Post-recording (8/5/26): the settled state + the
                      payment that made it, right on the reference. */}
                  {lineStatus && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap"
                      style={
                        lineStatus === 'Paid'
                          ? { fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                          : { fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }
                      }
                    >
                      {lineStatus}
                    </span>
                  )}
                  {linePayment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        linePayment.onOpen();
                      }}
                      className="text-[11px] text-primary hover:underline whitespace-nowrap cursor-pointer p-0 bg-transparent border-0"
                      style={{ fontWeight: 600 }}
                      title="Open the payment that paid this invoice"
                    >
                      {linePayment.number}
                    </button>
                  )}
                </div>
                {(() => {
                  const blocked = blockedLines?.get(line.invoiceId);
                  if (!blocked) return null;
                  return (
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-700" style={{ fontWeight: 500 }}>
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {blocked.reason}
                      </span>
                      {blocked.owed !== undefined && blocked.owed > 0.004 && onSetLineAmount && (
                        <button
                          type="button"
                          onClick={() => onSetLineAmount(line.invoiceId, blocked.owed!)}
                          className="h-6 px-2 rounded-md border border-red-200 bg-white text-[11px] text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          Pay {money(blocked.owed)}
                        </button>
                      )}
                      {onRemoveLine && (
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.invoiceId)}
                          className="h-6 px-2 rounded-md border border-red-200 bg-white text-[11px] text-red-700 hover:bg-red-50 cursor-pointer transition-colors inline-flex items-center gap-1"
                          style={{ fontWeight: 500 }}
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove from Run
                        </button>
                      )}
                    </div>
                  );
                })()}
              </td>
              {/* Due — the run's segmented date + urgency pill. */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <DueDatePill dueDate={line.dueDate} />
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {/* Prepaid-origin note (9/2/26): the balance being paid
                    carries its history — original total, the prepayment
                    that reconciled at creation, what's left. */}
                {inv ? (
                  <AmountWithPrepaidNote invoice={inv}>
                    <span className="text-slate-600" style={{ fontWeight: 500 }}>{money(total)}</span>
                  </AmountWithPrepaidNote>
                ) : (
                  <span className="text-slate-600" style={{ fontWeight: 500 }}>{money(total)}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {discountLive && discountTerms ? (
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help whitespace-nowrap"
                        style={{ fontWeight: 600 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        −{money(discount)}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="end" className="w-[280px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        Early-pay discount, {discountTerms.label}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Pay by {humanDate(discountTerms.deadline)} and take {discountTerms.percent}% off. On this invoice that's{' '}
                        <span className="text-emerald-700" style={{ fontWeight: 600 }}>{money(discount)}</span>: you pay{' '}
                        <span style={{ fontWeight: 600 }}>{money(due)}</span> instead of {money(total)}.
                      </p>
                      {(() => {
                        const daysLeft = discountDaysLeft(discountTerms, run.paymentDate);
                        return (
                          <p className="text-[11px] mt-1.5" style={{ fontWeight: 600, color: daysLeft <= 2 ? '#B45309' : '#047857' }}>
                            {daysLeft === 0
                              ? 'The payment date is the last day of the window.'
                              : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left at the current payment date.`}
                          </p>
                        );
                      })()}
                    </HoverCardContent>
                  </HoverCard>
                ) : null}
              </td>
              {/* Prepayment applied (8/28/26 evening, Record Payment
                  parity): an ANCHORED advance is auto-applied and stays
                  editable inline; an on-account share reads as a quiet
                  purple box and is changed through Apply prepayment. */}
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {readOnly ? (
                  creditShare > 0.004 ? (
                    <span className="text-purple-700" style={{ fontWeight: 600 }}>−{money(creditShare)}</span>
                  ) : null
                ) : anchoredEntry ? (
                  (() => {
                    // Record Payment's over-cap recipe (8/28/26 late):
                    // never silently clamp — go red with the warning
                    // hover card and a one-click snap back to the cap.
                    const record = payments.find((p) => p.id === anchoredEntry.paymentId);
                    const prepayCap = round2(Math.min(record?.unappliedAmount ?? anchoredEntry.amount, line.payAmount));
                    const prepayOver = anchoredEntry.amount > prepayCap + 0.004;
                    return (
                      <div className="relative inline-block w-[116px]" onClick={(e) => e.stopPropagation()}>
                        {prepayOver ? (
                          <HoverCard openDelay={200} closeDelay={120}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-500 hover:bg-red-100 transition-colors cursor-help z-10"
                                aria-label="Prepayment exceeds what can be applied"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds what can be applied</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                Applied is <span className="text-foreground " style={{ fontWeight: 600 }}>{money(anchoredEntry.amount)}</span> but only{' '}
                                <button
                                  type="button"
                                  onClick={() => onSetAnchoredCredit?.(anchoredEntry.paymentId, prepayCap)}
                                  className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                  style={{ fontWeight: 600 }}
                                >
                                  {money(prepayCap)}
                                </button>{' '}
                                can go against this invoice. Click the amount to snap the input back.
                              </p>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <Wallet className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-500 pointer-events-none" />
                        )}
                        <MoneyInput
                          fluid
                          value={anchoredEntry.amount}
                          onValueChange={(v) => onSetAnchoredCredit?.(anchoredEntry.paymentId, Math.max(0, v))}
                          className={`w-full h-8 pl-6 pr-2 rounded-lg border text-[13px] text-right bg-white outline-none transition-colors ${
                            prepayOver
                              ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100'
                              : 'border-purple-300 text-purple-700 focus:border-purple-400 focus:ring-1 focus:ring-purple-100'
                          }`}
                        />
                      </div>
                    );
                  })()
                ) : creditShare > 0.004 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center justify-end gap-1.5 h-8 w-[116px] px-2 rounded-lg border border-purple-200 bg-purple-50/50 text-[13px] text-purple-700 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontWeight: 500 }}
                      >
                        <Wallet className="w-3 h-3 text-purple-400" />
                        {money(creditShare)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[300] max-w-[250px]">
                      <p className="text-[11px] text-slate-600 leading-snug">
                        Split from the vendor's on-account credit in proportion to what each invoice is due. Change it from Apply vendor credit.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="inline-flex items-center justify-end h-8 w-[116px] px-2 rounded-lg border border-slate-200 bg-slate-50/60 text-[13px] text-slate-300 select-none" style={{ fontWeight: 500 }}>
                    0.00
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {readOnly ? (
                  <span className="text-[13px] " style={{ fontWeight: 600 }}>{money(cash)}</span>
                ) : (
                  <div className="relative inline-block w-[128px]" onClick={(e) => e.stopPropagation()}>
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">$</span>
                    <MoneyInput
                      fluid
                      value={cash}
                      onValueChange={(v) => onSetLineAmount?.(line.invoiceId, Math.round((v + creditShare) * 100) / 100)}
                      className={`w-full h-8 pl-6 pr-2 rounded-lg border text-[13px] text-right bg-white outline-none transition-colors ${
                        over
                          ? 'border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100'
                          : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'
                      }`}
                    />
                  </div>
                )}
                {over ? (
                  <p className="text-[10px] text-amber-700 mt-0.5" style={{ fontWeight: 500 }}>
                    Exceeds the amount due.{' '}
                    {!readOnly && (
                      <button
                        type="button"
                        className="underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetLineAmount?.(line.invoiceId, due);
                        }}
                        style={{ fontWeight: 600 }}
                      >
                        Set to {money(due)}
                      </button>
                    )}
                  </p>
                ) : forgoing ? (
                  /* "Discounted · saves X" was CUT here (Nophil 9/23): it
                     sat in the wrong place; the discount story lives on
                     the row's Discount column. */
                  <p className="text-[10px] text-amber-700 mt-0.5 " style={{ fontWeight: 500 }}>
                    Misses the {money(discount)} discount.{' '}
                    {!readOnly && (
                      <button
                        type="button"
                        className="underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetLineAmount?.(line.invoiceId, due);
                        }}
                        style={{ fontWeight: 600 }}
                      >
                        Set to {money(due)}
                      </button>
                    )}
                  </p>
                ) : partial ? (
                  <p className="text-[10px] text-amber-700 mt-0.5 " style={{ fontWeight: 600 }}>
                    Partial · of {money(due)}
                  </p>
                ) : null}
              </td>
              <td className="pr-3 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLine?.(line.invoiceId);
                      }}
                      className="w-7 h-7 rounded-md hover:bg-rose-50 hover:text-rose-600 text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                      title="Remove from the run"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onFlagLine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlagLine(line.invoiceId, line.invoiceNumber);
                      }}
                      className="w-7 h-7 rounded-md hover:bg-orange-50 hover:text-orange-600 text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                      title="Flag an issue on this line"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>


      {/* Credit, note, attachments, and the vendor's net. Note and files
          are opt-in actions (8/4/26), not permanent strips: a chip opens
          the note editor, Attach opens the system file picker. */}
      <div className="px-4 py-2.5 border-t border-border/70 bg-slate-50/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {readOnly ? (
              credit > 0 && (
                <span className="text-[12px] text-purple-700" style={{ fontWeight: 500 }}>
                  {money(credit)} vendor credit applied
                </span>
              )
            ) : sources.length > 0 || anchoredTotal > 0.004 ? (
              /* Apply prepayment lives in the FOOTER again (8/28/26
                 late): visible only while the card is expanded, which is
                 exactly when the prepayment column gives it context. */
              <PrepaymentSourcePicker
                sources={sources}
                draws={draws}
                maxTotal={round2(Math.max(0, gross - anchoredTotal))}
                anchoredTotal={anchoredTotal}
                anchoredCount={anchoredEntries.length}
                onChange={(next) => onSetCredit?.(next)}
                fmt={money}
                openSignal={prepayOpenSignal}
              />
            ) : null /* no credit → no line (BA 8/10/26) */}
            {!readOnly && (
              <>
                {(sources.length > 0 || anchoredTotal > 0.004) && <span className="w-px h-4 bg-border/70 mx-1" />}
                {/* Memo + Reference toggles left the authoring card (user
                    9/23): the reference is captured per payment at
                    recording (RunExecuteStage's Reference column), not
                    while composing. Attach files stays. */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`inline-flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    (group.attachments ?? []).length > 0
                      ? 'text-primary bg-primary/[0.06] hover:bg-primary/[0.1]'
                      : 'text-slate-500 hover:text-foreground hover:bg-slate-100'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <Paperclip className="w-3 h-3" />
                  {(group.attachments ?? []).length > 0
                    ? `Add Another File (${(group.attachments ?? []).length})`
                    : 'Attach Files'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    Array.from(e.target.files ?? []).forEach((f) => onAddAttachment?.(f.name, f.size));
                    e.currentTarget.value = '';
                  }}
                />
              </>
            )}
          </div>
          {/* Gross dropped (8/5/26): with no credit it just repeated Net. */}
          <div className="flex items-center gap-4 text-[12px] shrink-0">
            {credit > 0 && (
              <span className="text-teal-700">Vendor Credit <span style={{ fontWeight: 600 }}>−{money(credit)}</span></span>
            )}
            <span className="text-foreground text-[13px]" style={{ fontWeight: 700 }}>Net {money(net)}</span>
          </div>
        </div>

        {readOnly ? (
          <>
            {group.note && <p className="text-[12px] text-slate-600 mt-2">Memo: {group.note}</p>}
            {group.reference && <p className="text-[12px] text-slate-600 mt-1">Reference: {group.reference}</p>}
          </>
        ) : (
          /* Memo/reference editors left the authoring card (user 9/23):
             the reference is captured per payment at recording. */
          null
        )}

        {/* Attachments LAST (modal design language): the physical-
            inventory file-row standard, colored extension chip, name,
            size, remove, now with a hover state. */}
        {(group.attachments ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(group.attachments ?? []).map((a) => {
              const tone = fileTone(a.name);
              const size = fmtFileSize(a.size);
              return (
                <div
                  key={a.name}
                  className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-lg border border-border/70 bg-white min-w-0 max-w-[240px] hover:border-primary/40 hover:bg-blue-50/30 hover:shadow-sm transition-all"
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[8.5px] shrink-0"
                    style={{ backgroundColor: tone.bg, color: tone.fg, fontWeight: 700, letterSpacing: '0.02em' }}
                  >
                    {fileExt(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-slate-700 truncate" style={{ fontWeight: 500 }} title={a.name}>{a.name}</p>
                    {size && <p className="text-[10px] text-slate-400 ">{size}</p>}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment?.(a.name)}
                      className="w-5 h-5 rounded-md hover:bg-rose-50 hover:text-rose-600 text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
