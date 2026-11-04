import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { DEFAULT_PREPAYMENT_ASSET_ACCOUNT } from '@/app/data/glAccounts';
import { ArrowDown, ArrowUp, Banknote, Building2, RotateCcw, Rows3, Calendar, Check, CheckCircle2, ChevronDown, CircleAlert, Landmark, Paperclip, Printer, Receipt, Search, Trash2, Upload, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { liveLines, type PaymentRun } from '@/app/data/paymentRuns';
import { PAY_FROM_ACCOUNTS, PAYMENT_METHODS, accountTypeForMethod } from '@/app/data/mockPayments';
import type { PaymentRunsApi } from '@/app/hooks/usePaymentRuns';
import { accountTotals, groupCredit, groupLines, groupNet, groupRemainingNet, isClosedPeriod, lineRemaining, planGroupPass, revalidateRun } from '@/app/lib/runMath';
import { DateCalendar } from '@/app/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { paymentMethodInfo } from '@/app/data/paymentMethodCatalog';
import { Button } from '@/app/components/ui/button';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { DataTable } from '@/app/components/data-table/DataTable';
import { applyColumnFilters } from '@/app/components/data-table/applyColumnFilters';
import type { ColumnDef, ColumnFilterState, SortConfig } from '@/app/components/data-table/types';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { money, humanDate, RUN_FOOTER_FLUSH, FOOTER_BTN_PRIMARY } from './runUi';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import { STOCK_PROFILES, checkSettingsFor } from '@/app/lib/checkPrinting';

/* ── P3b · Execute, the commit point (payment-run-flow.md) ───────────
 * Everything above this is reversible. Execute re-validates (period
 * still open, accounts valid, nothing paid elsewhere since approval),
 * posts one payment per pay-to vendor (debit Accounts Payable, credit
 * bank clearing), flips invoices to Paid or Scheduled, and locks the
 * run. From here, undo means reversal, not editing. */

/** Proof-of-payment label matched to the method (8/5/26): recording a
 *  payment can't be willy-nilly. Wire wants its confirmation, a check
 *  its copy, cash its proof. Soft-required: warns, never blocks. */
export const PROOF_LABEL: Record<string, string> = {
  Wire: 'wire confirmation',
  Check: 'check copy',
  ACH: 'payment confirmation',
  'Bank Transfer': 'payment confirmation',
  Card: 'receipt',
  Cash: 'proof of payment',
};
export const proofLabelFor = (methodType: string) => PROOF_LABEL[methodType] ?? 'proof of payment';

/** The start-run chip recipe (RunSetupStage): h-8 rounded-lg, primary
 *  tint when live, rose when invalid. */
const chipClass = (active: boolean, danger = false) =>
  `inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] cursor-pointer ${
    danger
      ? 'border-rose-300 text-rose-700'
      : active
        ? 'border-primary/30 text-foreground'
        : 'border-border text-slate-600 hover:border-slate-300'
  }`;
const chipIconClass = (active: boolean, danger = false) =>
  `w-3.5 h-3.5 ${danger ? 'text-rose-500' : active ? 'text-primary' : 'text-slate-400'}`;
const POPOVER_SHADOW = { boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' };

export type ExecutePhase = 'payments' | 'checks';

/** Which step the record modal opens on: payments while any non-check
 *  payment is unrecorded, else checks. */
export function initialExecutePhase(run: PaymentRun): ExecutePhase {
  const open = run.groups.filter((g) => !g.paymentId && groupLines(run, g.vendor).length > 0);
  return open.some((g) => g.methodType !== 'Check') ? 'payments' : 'checks';
}

export function RunExecuteStage({
  run,
  invoices,
  payments,
  runsApi,
  phase: phaseProp,
  onPhaseChange,
  onAllRecorded,
  onDone,
  onChecksRecorded,
}: {
  run: PaymentRun;
  invoices: Invoice[];
  payments: Payment[];
  runsApi: PaymentRunsApi;
  /** Controlled step (user 10/15): the host modal's header stepper owns
   *  it. Uncontrolled when omitted. */
  phase?: ExecutePhase;
  onPhaseChange?: (phase: ExecutePhase) => void;
  /** Fires when a pass leaves nothing open on the run, both steps done
   *  (user 10/21/26): the host shows the run's GL impact then. */
  onAllRecorded?: () => void;
  /** Closes the record modal after the last step's pass (user 10/21/26). */
  onDone?: () => void;
  /** The check payments a pass just recorded WITHOUT a number, plus the
   *  starting number per bank account (user 10/21/26): the host offers
   *  Print now, Print later or Manual check for them. */
  onChecksRecorded?: (paymentIds: string[], startNumbers: Record<string, number>) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The pre-flight copy speaks as NOTIFICATIONS when the confirm opens
  // (user 10/8): the done-everything gate (Jennifer 9/1/26) and the
  // missing-proof reminder arrive as toasts, and the modal keeps its
  // original shape with no alert banners stacked inside it.
  useEffect(() => {
    if (!confirmOpen) return;
    const pendingChecks = run.groups.some(
      (g) => g.methodType === 'Check' && !g.paymentId && groupLines(run, g.vendor).length > 0 && !(g.reference ?? '').trim(),
    );
    toast.info(
      pendingChecks
        ? 'Checks print after they record'
        : 'Have the checks been printed and the ACHs and wires executed?',
      {
        description: pendingChecks
          ? 'Record them, then print now, print later or log a manual check. ACHs and wires should already be executed.'
          : 'Recording captures their references and locks the run. If anything is still in the printer or the bank queue, finish it first.',
      },
    );
    const missing = run.groups.filter((g) => groupLines(run, g.vendor).length > 0 && (g.attachments ?? []).length === 0).length;
    if (missing > 0) {
      toast.warning(`${missing} payment${missing === 1 ? ' has' : 's have'} no proof of payment attached`, {
        description: 'Wire wants its confirmation, a check its copy. Recording anyway is allowed; the attachments stay open on the run.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen]);
  // The payment date lives HERE (8/7/26), where the payment is actually
  // recorded, not on Step 1 where it read like a filter.
  const closedPeriod = isClosedPeriod(run.paymentDate);
  const lines = liveLines(run);
  const validation = useMemo(() => revalidateRun(run, invoices), [run, invoices]);
  const total = run.groups.reduce((s, g) => s + groupNet(run, g), 0);
  const scheduled = run.paymentDate > localTodayIso();

  // ── Recording in PIECES (Eli 9/25): "this is not an all or nothing" ──
  // Each payment row carries a checkbox; Record posts only the ticked
  // ones and the run reads Partially executed until the last records.
  const activeGroups = run.groups.filter((g) => groupLines(run, g.vendor).length > 0);
  const recordedGroups = activeGroups.filter((g) => g.paymentId);
  const unrecordedGroups = activeGroups.filter((g) => !g.paymentId);

  // Checks are a SEPARATE step (Eli 10/5: "I wouldn't even have checks
  // in here as its own thing, I would have checks as the next one — now
  // process your checks"). The non-check payments record first; the
  // check run (start number per account, its own warning) follows. The
  // phase gates which unrecorded payments this pass can record.
  const phaseOf = (g: (typeof activeGroups)[number]): 'payments' | 'checks' =>
    g.methodType === 'Check' ? 'checks' : 'payments';
  const hasNonCheckUnrecorded = unrecordedGroups.some((g) => g.methodType !== 'Check');
  const hasCheckUnrecorded = unrecordedGroups.some((g) => g.methodType === 'Check');
  const [localPhase, setLocalPhase] = useState<ExecutePhase>(hasNonCheckUnrecorded ? 'payments' : 'checks');
  const phase = phaseProp ?? localPhase;
  const setPhase = onPhaseChange ?? setLocalPhase;
  // Once every non-check payment is recorded, advance to the check step.
  useEffect(() => {
    if (phase === 'payments' && !hasNonCheckUnrecorded && hasCheckUnrecorded) setPhase('checks');
  }, [phase, hasNonCheckUnrecorded, hasCheckUnrecorded]);
  const phaseGroups = unrecordedGroups.filter((g) => phaseOf(g) === phase);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(phaseGroups.map((g) => g.vendor)));
  // Selection survives edits but never points at recorded/removed groups,
  // and resets to the current phase's unrecorded payments on phase change.
  const phaseKey = `${phase}|${phaseGroups.map((g) => g.vendor).join('|')}`;
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(phaseGroups.map((g) => g.vendor));
      const kept = new Set([...prev].filter((v) => valid.has(v)));
      // A recording pass just landed (or the phase changed): default the
      // NEXT pass to everything still unrecorded in this phase. Deliberate
      // unticking never triggers this effect, so it doesn't fight the user.
      return kept.size > 0 ? kept : valid;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);
  const toggleVendor = (vendor: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  // ── Partial amounts (user 10/21/26) ──
  // Each payment's amount is editable: paying less records that much
  // (oldest due first) and the rest stays open on the run for a later
  // pass. Blank means everything still open.
  const [payNow, setPayNow] = useState<Record<string, string>>({});
  const openFor = (g: (typeof activeGroups)[number]) => groupRemainingNet(run, g);
  const typedAmount = (g: (typeof activeGroups)[number]) => {
    const raw = (payNow[g.vendor] ?? '').replace(/[^0-9.]/g, '');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  const amountFor = (g: (typeof activeGroups)[number]) => {
    const t = typedAmount(g);
    return t == null || Number.isNaN(t) ? openFor(g) : t;
  };
  const amountError = (g: (typeof activeGroups)[number]): string | null => {
    const t = typedAmount(g);
    if (t == null) return null;
    if (Number.isNaN(t) || t <= 0.004) return 'Enter an amount above $0.00';
    if (t > openFor(g) + 0.004) return `At most ${money(openFor(g))}`;
    return null;
  };
  const isPartial = (g: (typeof activeGroups)[number]) => amountFor(g) < openFor(g) - 0.004;

  // Reference is REQUIRED (user 10/21/26): the ACH trace, wire
  // confirmation or transfer reference. Checks get theirs from the print
  // flow, so the rule bites in the payments step. Errors show after the
  // first Record attempt.
  const [refErrors, setRefErrors] = useState<Set<string>>(new Set());

  const selectedGroups = phaseGroups.filter((g) => selected.has(g.vendor));
  const selectedTotal = selectedGroups.reduce((s, g) => s + amountFor(g), 0);
  const selectedInvoiceCount = selectedGroups.reduce((s, g) => s + groupLines(run, g.vendor).filter((l) => lineRemaining(l) > 0.004).length, 0);

  // The start-run recipe (user 10/15): segmented search (vendors /
  // invoices), filter chips (payment date, group by, method, pay-from),
  // then the listing DataTable with header sort, filters, freeze and hide.
  // Rows are this step's payments still to record; recorded ones leave
  // the table and read in the footer count.
  type Group = (typeof run.groups)[number];
  const [groupMode, setGroupMode] = useState<'none' | 'method' | 'account'>('none');
  const [vendorQuery, setVendorQuery] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(['vendor', 'invoices', 'method', 'account', 'reference', 'memo', 'proof', 'amount']);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(['vendor']));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'vendor', direction: 'asc' });
  const accountLabelOf = (id: string) => PAY_FROM_ACCOUNTS.find((a) => a.id === id)?.label ?? id;
  const colValue = (g: Group, key: string): string | number => {
    switch (key) {
      case 'vendor': return g.vendor;
      case 'invoices': return groupLines(run, g.vendor).length;
      case 'method': return g.methodType;
      case 'account': return accountLabelOf(g.payFromAccountId);
      case 'reference': return g.reference ?? '';
      case 'memo': return g.note ?? '';
      case 'proof': return (g.attachments ?? []).length;
      case 'amount': return openFor(g);
      default: return '';
    }
  };
  const hasActiveFilters = methodFilter.length > 0 || accountFilter.length > 0 || groupMode !== 'none' || !!vendorQuery || !!invoiceQuery;
  const clearAllFilters = () => {
    setMethodFilter([]);
    setAccountFilter([]);
    setGroupMode('none');
    setVendorQuery('');
    setInvoiceQuery('');
    setColumnFilters({});
  };
  const phaseRows = activeGroups.filter((g) => !g.paymentId && phaseOf(g) === phase);
  const displayGroups = useMemo(() => {
    const qv = vendorQuery.trim().toLowerCase();
    const qi = invoiceQuery.trim().toLowerCase();
    let list = phaseRows.filter((g) => {
      if (qv && !g.vendor.toLowerCase().includes(qv)) return false;
      if (qi && !groupLines(run, g.vendor).some((l) => l.invoiceNumber.toLowerCase().includes(qi))) return false;
      if (methodFilter.length && !methodFilter.includes(g.methodType)) return false;
      if (accountFilter.length && !accountFilter.includes(g.payFromAccountId)) return false;
      return true;
    });
    list = applyColumnFilters(list, Object.values(columnFilters), colValue);
    const cfg = sortConfig ?? { key: 'vendor', direction: 'asc' as const };
    const mul = cfg.direction === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const va = colValue(a, cfg.key);
      const vb = colValue(b, cfg.key);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * mul;
    });
    if (groupMode === 'method') list.sort((a, b) => a.methodType.localeCompare(b.methodType));
    else if (groupMode === 'account') list.sort((a, b) => accountLabelOf(a.payFromAccountId).localeCompare(accountLabelOf(b.payFromAccountId)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseRows.map((g) => g.vendor).join('|'), run, vendorQuery, invoiceQuery, methodFilter, accountFilter, columnFilters, sortConfig, groupMode]);

  // Table Empty & Error States Standard v1.0 (11/3/26). The invoice search
  // leads (it is the table's searchQuery); with both searches typed, the
  // vendor search counts as a filter.
  const bothSearches = !!invoiceQuery.trim() && !!vendorQuery.trim();
  const emptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'payment', plural: 'payments' },
    totalCount: phaseRows.length,
    filterCount: methodFilter.length + accountFilter.length + Object.keys(columnFilters).length + (bothSearches ? 1 : 0),
    onClearSearch: () => { setInvoiceQuery(''); setVendorQuery(''); },
    onClearFilters: () => {
      setMethodFilter([]);
      setAccountFilter([]);
      setColumnFilters({});
      if (bothSearches) setVendorQuery('');
    },
    onSearch: (q) => (invoiceQuery.trim() ? setInvoiceQuery(q) : setVendorQuery(q)),
    compact: true,
    ...(phaseRows.length === 0
      ? phase === 'checks'
        ? { title: 'No checks left to process', description: 'All check payments on this run are recorded.' }
        : { title: 'Every payment in this step is recorded', description: 'Move on to Process Checks, or close to see the run.' }
      : {}),
  };

  // Check run (user 10/15): every unrecorded check payment, per bank
  // account, in table order. Each account takes a STARTING check number;
  // rows without a typed number take the next in sequence, and the print
  // flow opens at that start.
  const [startNos, setStartNos] = useState<Record<string, string>>({});
  const startNoFor = (accountId: string) => {
    const n = parseInt(startNos[accountId] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : checkSettingsFor(accountId).nextCheckNumber;
  };
  const checkAccounts = (() => {
    const map = new Map<string, (typeof run.groups)[number][]>();
    // Table order first, then any check a filter hides, so every selected
    // check still prints and numbers follow what the user sees.
    const allChecks = activeGroups.filter((g) => g.methodType === 'Check' && !g.paymentId);
    const ordered = [...displayGroups.filter((g) => allChecks.includes(g)), ...allChecks.filter((g) => !displayGroups.includes(g))];
    ordered.forEach((g) => map.set(g.payFromAccountId, [...(map.get(g.payFromAccountId) ?? []), g]));
    return [...map.entries()].map(([accountId, groups]) => ({
      accountId,
      groups,
      total: groups.reduce((sum, g) => sum + amountFor(g), 0),
    }));
  })();
  // vendor → the check number it will print on (selected, no typed number).
  const assignedCheckNo = new Map<string, number>();
  checkAccounts.forEach(({ accountId, groups }) => {
    let n = startNoFor(accountId);
    groups.forEach((g) => {
      if (!selected.has(g.vendor) || (g.reference ?? '').trim()) return;
      assignedCheckNo.set(g.vendor, n);
      n += 1;
    });
  });

  // Which rows carry an AUTO-FILLED check number (user 10/5 prefill):
  // a user-typed number is sacred, but an auto number goes stale when
  // the row's account or method changes — those clear and refill.
  const autoFilledRef = useRef<Set<string>>(new Set());
  const clearStaleAutoRef = (g: (typeof run.groups)[number]) =>
    autoFilledRef.current.has(g.vendor) ? { ...g, reference: '' } : g;

  // Pay-from account stays correctable at the doing stage (Eli 9/25):
  // approval fixed the AMOUNT, not the account it draws from. Production
  // gates this by permission; the demo allows it on unrecorded rows.
  const setGroupAccount = (vendor: string, payFromAccountId: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) =>
        g.vendor === vendor ? clearStaleAutoRef({ ...g, payFromAccountId, accountOverridden: true }) : g,
      ),
    }));
  };

  // Method is editable per row too (user 10/5): two-way synced with the
  // pay-from account like the authoring step — switching to a method the
  // current account can't serve re-points to the first eligible account.
  const setGroupMethod = (vendor: string, methodType: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) => {
        if (g.vendor !== vendor) return g;
        const want = accountTypeForMethod(methodType);
        const current = PAY_FROM_ACCOUNTS.find((a) => a.id === g.payFromAccountId);
        const compatible = want === 'any' || current?.type === want;
        const nextAccount = compatible
          ? g.payFromAccountId
          : (PAY_FROM_ACCOUNTS.find((a) => a.type === want)?.id ?? g.payFromAccountId);
        return clearStaleAutoRef({ ...g, methodType, payFromAccountId: nextAccount });
      }),
    }));
  };

  // Proof-of-payment upload (user 10/7): the raw OS picker was "not how we
  // upload attachments" — the Attach control now opens a proper drop-zone
  // modal matching the Attachments tab (drag or browse, accepted-type hint,
  // a removable file list). Missing proof warns, never blocks.
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [proofVendor, setProofVendor] = useState<string | null>(null);
  const [proofDragging, setProofDragging] = useState(false);
  const PROOF_ACCEPTED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];
  const missingProof = run.groups.filter(
    (g) => groupLines(run, g.vendor).length > 0 && (g.attachments ?? []).length === 0,
  );
  const proofGroup = proofVendor ? run.groups.find((g) => g.vendor === proofVendor) : null;
  const addProof = (vendor: string, name: string, size?: number) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) =>
        g.vendor === vendor ? { ...g, attachments: [...(g.attachments ?? []), { name, size }] } : g,
      ),
    }));
  };
  const removeProof = (vendor: string, name: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) =>
        g.vendor === vendor ? { ...g, attachments: (g.attachments ?? []).filter((a) => a.name !== name) } : g,
      ),
    }));
  };
  const takeProofFiles = (vendor: string, files: FileList | null) => {
    Array.from(files ?? []).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!PROOF_ACCEPTED.includes(ext)) {
        toast.error(`${file.name} is not an accepted type`, { description: 'PDF, DOC, XLS, PNG, JPG up to 10MB.' });
        return;
      }
      addProof(vendor, file.name, file.size);
    });
  };

  // Per-payment reference capture (Aug 31 rule; 9/22/26 review response,
  // Claude C11-X1): recording is where check numbers, ACH traces and wire
  // confirmations feed back in — each payment gets its own field, not
  // just a shared file upload.
  const setGroupReference = (vendor: string, reference: string, printedViaFlow = false) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      // A hand-typed number CLEARS printedViaFlow (Eli 9/25): the record
      // then reads "manual check"; only the print flow's blocking confirm
      // sets it.
      groups: r.groups.map((g) => (g.vendor === vendor ? { ...g, reference, printedViaFlow } : g)),
    }));
  };
  // Check-number cascade (Eli; user 10/8): the FIRST check number the user
  // types seeds the rest of the batch — every other unrecorded check row on
  // the SAME account whose field is empty (or still carrying a previous
  // suggestion) gets the next free number in sequence. They stay editable
  // suggestions: typing in a cascaded field clears its auto flag.
  const cascadeCheckNumbers = (sourceVendor: string, accountId: string, typed: string) => {
    const n = parseInt((typed ?? '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const siblings = run.groups.filter(
      (g) =>
        g.vendor !== sourceVendor &&
        g.methodType === 'Check' &&
        !g.paymentId &&
        g.payFromAccountId === accountId &&
        groupLines(run, g.vendor).length > 0 &&
        (!(g.reference ?? '').trim() || autoFilledRef.current.has(g.vendor)),
    );
    if (siblings.length === 0) return;
    // Numbers already claimed by hand on other rows stay reserved.
    const used = new Set<number>([n]);
    run.groups.forEach((g) => {
      if (g.methodType !== 'Check' || g.payFromAccountId !== accountId) return;
      const v = parseInt((g.reference ?? '').replace(/\D/g, ''), 10);
      if (Number.isFinite(v) && !autoFilledRef.current.has(g.vendor)) used.add(v);
    });
    let next = n;
    const fills = new Map<string, string>();
    siblings.forEach((g) => {
      do { next += 1; } while (used.has(next));
      used.add(next);
      fills.set(g.vendor, String(next));
      autoFilledRef.current.add(g.vendor);
    });
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) => (fills.has(g.vendor) ? { ...g, reference: fills.get(g.vendor)!, printedViaFlow: false } : g)),
    }));
    toast.info(`Check numbers suggested from ${n}`, {
      description: `${siblings.length} more check${siblings.length === 1 ? '' : 's'} on this account follow${siblings.length === 1 ? 's' : ''} in sequence: ${[...fills.values()].join(', ')}. Edit any of them to override.`,
    });
  };

  // Memo line per payment (BA 9/25): prints on the check / rides the
  // ACH addenda, same as the Record Payment flow's memo line.
  const setGroupNote = (vendor: string, note: string) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      groups: r.groups.map((g) => (g.vendor === vendor ? { ...g, note } : g)),
    }));
  };

  // Check-number sequencing per row (BA 9/25): the SAME out-of-sequence /
  // big-jump warnings the Record Payment flow shows, measured against the
  // account's check register. Warns, never blocks. BATCH-AWARE (user
  // 10/5): other rows in this pass consume numbers too, so 88201 and
  // 88202 side by side are both in sequence — the old per-row check
  // flagged the second one.
  const BIG_JUMP = 100;
  const parseCheckNo = (ref: string | undefined) => {
    const m = /^(?:CHK-?)?(\d+)$/i.exec((ref ?? '').trim());
    return m ? Number(m[1]) : null;
  };
  const checkSequenceWarning = (group: (typeof run.groups)[number]): string | null => {
    if (group.methodType !== 'Check') return null;
    const n = parseCheckNo(group.reference);
    if (n == null) return null;
    const next = checkSettingsFor(group.payFromAccountId).nextCheckNumber;
    // The other unrecorded check rows drawing on the same account.
    const siblings = run.groups.filter(
      (g) => g.vendor !== group.vendor && !g.paymentId && g.methodType === 'Check' && g.payFromAccountId === group.payFromAccountId,
    );
    const siblingNumbers = siblings.map((g) => parseCheckNo(g.reference)).filter((x): x is number => x != null);
    if (siblingNumbers.includes(n)) return `Check ${n} is already used on another payment in this pass.`;
    // This pass's contiguous block: next … next + (rows on this account − 1).
    const blockEnd = next + siblings.length;
    if (n < next) return `Out of sequence: check ${next} is next on this account.`;
    if (n <= blockEnd) return null;
    if (n > blockEnd + BIG_JUMP) return `Big jump ahead: this skips ${n - blockEnd} numbers past this batch.`;
    return `Out of sequence: this skips ${n - blockEnd} number${n - blockEnd === 1 ? '' : 's'} ahead of this batch.`;
  };

  // Pre-fill check numbers (user 10/5): every unrecorded check row with
  // an EMPTY reference gets the next free number on its account —
  // sequential from the register, skipping numbers already typed on
  // sibling rows. The field stays editable. The key deliberately
  // EXCLUDES the reference text so clearing a field never refills it
  // mid-edit — fills happen on open and when a row's method or account
  // changes.
  // Check numbers are NOT silently pre-filled (user 10/7, supersedes the
  // 10/5 prefill): the check STEP asks for the starting number per bank
  // account. A number hand-typed into a row still reserves itself and
  // records as a manual check.
  // Checks RECORD FIRST, then print (user 10/21/26, supersedes BA 9/25's
  // print-before-record): like a single payment, the host offers Print
  // now, Print later or Manual check once the pass posts.

  const fixRemove = (invoiceId: string) => {
    runsApi.rejectLines(run.id, [invoiceId], 'Changed since approval, removed at execute', 'Ahtisham Ahmad');
  };
  const fixReduce = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.map((l) => (l.invoiceId === invoiceId ? { ...l, payAmount: inv.outstandingBalance } : l)),
    }));
  };

  const execute = () => reallyExecute();

  const reallyExecute = () => {
    if (selectedGroups.length === 0) {
      setConfirmOpen(false);
      return;
    }
    const vendors = selectedGroups.map((g) => g.vendor);
    // Partial amounts ride along (user 10/21/26); a vendor paid in part
    // stays open on the run with the rest.
    const cashAmounts = Object.fromEntries(selectedGroups.map((g) => [g.vendor, amountFor(g)]));
    const partialCount = selectedGroups.filter(isPartial).length;
    const leftOpen = Math.round(selectedGroups.reduce((s, g) => s + (openFor(g) - amountFor(g)), 0) * 100) / 100;
    const remainder = unrecordedGroups.length - vendors.length + partialCount;
    const result = runsApi.executeRun(run.id, vendors, cashAmounts);
    setConfirmOpen(false);
    if (!result.ok) {
      toast.error('Execution blocked', {
        description: 'Something changed since approval. Review the checks and fix the flagged lines.',
      });
      return;
    }
    setPayNow((prev) => {
      const next = { ...prev };
      vendors.forEach((v) => delete next[v]);
      return next;
    });
    const paid = result.records.filter((p) => p.status === 'Paid').length;
    const sched = result.records.filter((p) => p.status === 'Scheduled').length;
    toast.success(
      remainder > 0 ? 'Selected payments posted' : 'Payments posted, the run is locked',
      {
        description: [
          paid > 0 ? `${paid} paid` : null,
          sched > 0 ? `${sched} scheduled for ${humanDate(run.paymentDate)}` : null,
          partialCount > 0 ? `${partialCount} paid in part, ${money(leftOpen)} stays open` : null,
          remainder > 0 ? `${remainder} payment${remainder === 1 ? '' : 's'} still to record on this run` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      },
    );
    // Every record pass moves FORWARD, never back onto the same step
    // (user 10/21/26): Record payments goes on to Process checks; the
    // last step (or a run with no checks left) closes the modal back to
    // the run, where "Record remaining payments" picks up anything left
    // open. Nothing open anywhere = both steps done: GL impact next.
    const unprintedChecks = result.records.filter((p) => p.paymentMethod === 'Check' && !p.checkPrint);
    if (unprintedChecks.length > 0) {
      const starts: Record<string, number> = {};
      unprintedChecks.forEach((p) => { starts[p.bankAccount] = startNoFor(p.bankAccount); });
      onChecksRecorded?.(unprintedChecks.map((p) => p.id), starts);
    }
    if (remainder === 0) onAllRecorded?.();
    if (phase === 'payments' && hasCheckUnrecorded) setPhase('checks');
    else onDone?.();
  };

  // Columns for the listing DataTable (user 10/15: "the data table should
  // follow the data table we have"). Vendor frozen left, Amount pinned
  // right; the editable cells keep their record-step behavior.
  const fieldCls = 'h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20';
  const execColumns: ColumnDef<Group>[] = [
    {
      key: 'vendor',
      label: 'Vendor',
      minWidth: 180,
      defaultWidth: 210,
      locked: true,
      sticky: 'left',
      sortable: true,
      filterable: false,
      getValue: (g) => g.vendor,
      render: (g) => (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <VendorAvatar name={g.vendor} size="sm" />
          <span className="text-[13px] text-foreground truncate">{highlightText(g.vendor, vendorQuery)}</span>
        </span>
      ),
    },
    {
      key: 'invoices',
      label: 'Invoices',
      minWidth: 140,
      defaultWidth: 190,
      sortable: true,
      filterType: 'range',
      getValue: (g) => groupLines(run, g.vendor).length,
      searchText: (g) => groupLines(run, g.vendor).map((l) => l.invoiceNumber).join(' '),
      render: (g) => {
        const vl = groupLines(run, g.vendor);
        return (
          <span className="block min-w-0">
            <span className="block text-[12.5px] text-foreground">{vl.length} invoice{vl.length === 1 ? '' : 's'}</span>
            <span className="block text-[11px] text-slate-400 truncate">{highlightText(vl.map((l) => l.invoiceNumber).join(', '), invoiceQuery)}</span>
          </span>
        );
      },
    },
    {
      key: 'method',
      label: 'Method',
      minWidth: 140,
      defaultWidth: 150,
      sortable: true,
      filterType: 'multiselect',
      getValue: (g) => g.methodType,
      uniqueValues: (rows) => [...new Set(rows.map((g) => g.methodType))],
      render: (g) => {
        const Icon = paymentMethodInfo(g.methodType).icon;
        return (
          <span className="inline-flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={g.methodType}
              onChange={(e) => setGroupMethod(g.vendor, e.target.value)}
              className={`${fieldCls} flex-1 min-w-0 cursor-pointer`}
              title="Change the payment method for this payment"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.value}</option>
              ))}
            </select>
          </span>
        );
      },
    },
    {
      key: 'account',
      label: 'Pay-From Account',
      minWidth: 180,
      defaultWidth: 220,
      sortable: true,
      filterType: 'multiselect',
      getValue: (g) => accountLabelOf(g.payFromAccountId),
      uniqueValues: (rows) => [...new Set(rows.map((g) => accountLabelOf(g.payFromAccountId)))],
      render: (g) => (
        <select
          value={g.payFromAccountId}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setGroupAccount(g.vendor, e.target.value)}
          className={`${fieldCls} w-full cursor-pointer`}
          title="Change the pay-from account for this payment"
        >
          {PAY_FROM_ACCOUNTS.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      minWidth: 130,
      defaultWidth: 150,
      sortable: false,
      filterable: false,
      getValue: (g) => g.reference ?? '',
      render: (g) => {
        const seqWarn = checkSequenceWarning(g);
        const refMissing = refErrors.has(g.vendor) && !(g.reference ?? '').trim();
        return (
          <div className="min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              value={g.reference ?? ''}
              aria-invalid={refMissing || undefined}
              onChange={(e) => {
                // Typing a reference SELECTS the row (Eli 9/25).
                autoFilledRef.current.delete(g.vendor);
                setGroupReference(g.vendor, e.target.value);
                if (e.target.value.trim()) setSelected((prev) => new Set([...prev, g.vendor]));
              }}
              onBlur={(e) => {
                if (g.methodType !== 'Check') return;
                cascadeCheckNumbers(g.vendor, g.payFromAccountId, e.target.value);
              }}
              placeholder={
                g.methodType === 'Check'
                  ? (assignedCheckNo.has(g.vendor) ? String(assignedCheckNo.get(g.vendor)) : 'Check No.')
                  : g.methodType === 'ACH' ? 'ACH trace No.'
                    : g.methodType === 'Wire' ? 'Confirmation No.'
                      : 'Reference'
              }
              className={`${fieldCls} w-full placeholder:text-slate-400 ${refMissing ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : seqWarn ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100' : ''}`}
            />
            {refMissing ? (
              <p className="text-[10.5px] text-rose-600 leading-snug mt-1" style={{ fontWeight: 500 }}>Reference required</p>
            ) : seqWarn && (
              <p className="text-[10.5px] text-amber-700 leading-snug mt-1" style={{ fontWeight: 500 }}>{seqWarn}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'memo',
      label: 'Memo',
      minWidth: 130,
      defaultWidth: 150,
      sortable: false,
      filterable: false,
      getValue: (g) => g.note ?? '',
      render: (g) => (
        <input
          value={g.note ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            setGroupNote(g.vendor, e.target.value);
            if (e.target.value.trim()) setSelected((prev) => new Set([...prev, g.vendor]));
          }}
          placeholder="Memo line"
          maxLength={80}
          className={`${fieldCls} w-full placeholder:text-slate-400`}
        />
      ),
    },
    {
      key: 'proof',
      label: 'Proof',
      minWidth: 120,
      defaultWidth: 140,
      sortable: true,
      filterable: false,
      searchable: false,
      getValue: (g) => (g.attachments ?? []).length,
      render: (g) => {
        const n = (g.attachments ?? []).length;
        return n > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setProofVendor(g.vendor); }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap cursor-pointer hover:brightness-95 transition-[filter]"
            style={{ fontWeight: 500, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
          >
            <Paperclip className="w-2.5 h-2.5" />
            {n} file{n === 1 ? '' : 's'}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setProofVendor(g.vendor); }}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:border-primary/45 hover:bg-blue-50/60 hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
            style={{ fontWeight: 500 }}
            title={`Attach the ${proofLabelFor(g.methodType)} for this payment`}
          >
            <Paperclip className="w-3 h-3 text-slate-400" />
            Attach
          </button>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      minWidth: 150,
      defaultWidth: 170,
      align: 'right',
      sticky: 'right',
      sortable: true,
      filterType: 'range',
      getValue: (g) => openFor(g),
      // Editable (user 10/21/26): pay less now, the rest stays on the run.
      render: (g) => {
        const open = openFor(g);
        const credit = g.creditPosted ? 0 : groupCredit(g);
        const err = amountError(g);
        const partial = !err && isPartial(g);
        const recordedEarlier = payments
          .filter((p) => (g.partialPaymentIds ?? []).includes(p.id))
          .reduce((s, p) => s + p.amount, 0);
        const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (
          <div className="w-full text-right" onClick={(e) => e.stopPropagation()}>
            <input
              inputMode="decimal"
              value={payNow[g.vendor] ?? fmt(open)}
              aria-label={`Amount to pay ${g.vendor}`}
              aria-invalid={!!err || undefined}
              title="Pay less to record part of this payment now. The rest stays open on the run."
              onChange={(e) => {
                const value = e.target.value;
                setPayNow((prev) => ({ ...prev, [g.vendor]: value }));
                setSelected((prev) => new Set([...prev, g.vendor]));
              }}
              onBlur={() => {
                // Tidy the typed figure; the full amount goes back to blank.
                const t = typedAmount(g);
                if (t == null || Number.isNaN(t)) return;
                setPayNow((prev) => {
                  const next = { ...prev };
                  if (Math.abs(t - open) <= 0.004) delete next[g.vendor];
                  else next[g.vendor] = fmt(t);
                  return next;
                });
              }}
              className={`${fieldCls} w-full text-right ${err ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : partial ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100' : ''}`}
            />
            {err ? (
              <span className="block text-[10.5px] text-rose-600 mt-0.5" style={{ fontWeight: 500 }}>{err}</span>
            ) : partial ? (
              <span className="block text-[10.5px] text-amber-700 mt-0.5" style={{ fontWeight: 500 }}>
                {money(Math.round((open - amountFor(g)) * 100) / 100)} stays open
              </span>
            ) : null}
            {credit > 0 && (
              <span className="flex items-center justify-end gap-1 text-[10.5px] text-purple-700 mt-0.5" style={{ fontWeight: 500 }}>
                <Wallet className="w-2.5 h-2.5" />
                Prepayment −{money(credit)}
              </span>
            )}
            {recordedEarlier > 0.004 && (
              <span className="block text-[10.5px] text-emerald-700 mt-0.5" style={{ fontWeight: 500 }}>
                {money(recordedEarlier)} recorded earlier
              </span>
            )}
          </div>
        );
      },
    },
  ];

  // Opens the record confirm for the ticked vendors, or ticks every
  // payment left in this step first (Record all).
  const startRecord = (all: boolean) => {
    if (lines.length === 0) {
      toast.error('Nothing to record', { description: 'This run has no invoices left in it.' });
      return;
    }
    if (phaseGroups.length === 0) {
      toast.error(phase === 'checks' ? 'No checks left to process' : 'No payments left to record', {
        description: phase === 'checks' ? 'Every check on this run is recorded.' : 'Switch to Process Checks for the check payments.',
      });
      return;
    }
    if (!all && selectedGroups.length === 0) {
      toast.error(phase === 'checks' ? 'No checks selected' : 'No payments selected', { description: `Tick at least one ${phase === 'checks' ? 'check' : 'payment'}, or record them all.` });
      return;
    }
    if (!validation.ok) {
      toast.error('Run needs attention', { description: 'Fix the issues listed above before recording.' });
      return;
    }
    const toRecord = all ? phaseGroups : selectedGroups;
    const badAmounts = toRecord.filter((g) => amountError(g));
    if (badAmounts.length > 0) {
      toast.error('Check the amounts', {
        description: `${badAmounts.map((g) => g.vendor).join(', ')}: enter an amount above $0.00 and no more than what is open.`,
      });
      return;
    }
    // Reference required (user 10/21/26). Checks without a number take
    // theirs from the print flow, so only the payments step asks here.
    const missingRef = toRecord.filter((g) => g.methodType !== 'Check' && !(g.reference ?? '').trim());
    setRefErrors(new Set(missingRef.map((g) => g.vendor)));
    if (missingRef.length > 0) {
      toast.error('Reference number required', {
        description: `Enter the ACH trace, wire confirmation or transfer reference for ${missingRef.length === 1 ? missingRef[0].vendor : `${missingRef.length} payments`} before recording.`,
      });
      return;
    }
    if (all) setSelected(new Set(phaseGroups.map((g) => g.vendor)));
    setConfirmOpen(true);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Validation surfaces only when something FAILS (8/5/26): the
          checks run silently, a rose strip lists what blocks with its
          inline fixes. */}
      {!validation.ok && (
        <div className="px-4 sm:px-5 py-2.5 bg-rose-50 border-b border-rose-200 shrink-0 space-y-2">
          {validation.checks.filter((c) => !c.ok).map((check) => (
            <div key={check.label} className="flex items-start gap-2">
              <CircleAlert className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[12.5px] text-rose-700" style={{ fontWeight: 600 }}>{check.label}</p>
                {check.detail && <p className="text-[11.5px] text-rose-600 mt-0.5">{check.detail}</p>}
              </div>
            </div>
          ))}
          {validation.lineFailures.map((f) => {
            const inv = invoices.find((i) => i.id === f.invoiceId);
            const canReduce = !!inv && inv.outstandingBalance > 0.004;
            return (
              <div key={f.invoiceId} className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-rose-800" style={{ fontWeight: 600 }}>
                    {f.invoiceNumber} · {f.vendor}
                  </p>
                  <p className="text-[11.5px] text-rose-700 mt-0.5">{f.reason}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canReduce && (
                    <Button variant="outline" size="sm" className="h-7 rounded-md text-[11.5px]" onClick={() => fixReduce(f.invoiceId)}>
                      Reduce to {money(inv!.outstandingBalance)}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-md text-[11.5px] border-rose-300 text-rose-700 hover:bg-rose-50"
                    onClick={() => fixRemove(f.invoiceId)}
                  >
                    Remove from Run
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + filter band (user 10/15): the start-run step 1 recipe
          verbatim, full-bleed on the grey canvas. Joined search bar, then
          filter chips with Reset pinned right. */}
      <div className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden">
      <div data-col-hide-edge className="px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-100 space-y-3 shrink-0">
        <div className="flex items-stretch border border-border rounded-lg bg-white shadow-sm overflow-hidden transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 hover:border-primary/50 [&>div]:flex-1 [&>div:not(:last-child)]:border-r [&>div:not(:last-child)]:border-border/70">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search Vendors..."
              value={vendorQuery}
              onChange={(e) => setVendorQuery(e.target.value)}
              className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
            />
          </div>
          <div className="relative">
            <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search Invoices..."
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-x-2 gap-y-2 flex-wrap px-0.5">
          {/* Payment date — where the payment is actually recorded (8/7/26). */}
          <Popover open={activePopover === 'payDate'} onOpenChange={(o) => setActivePopover(o ? 'payDate' : null)}>
            <PopoverTrigger asChild>
              <button className={chipClass(activePopover === 'payDate', closedPeriod)} style={{ fontWeight: 500 }}>
                <Calendar className={chipIconClass(activePopover === 'payDate', closedPeriod)} />
                <span>Payment Date · {humanDate(run.paymentDate)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'payDate' ? 'rotate-180' : ''}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]" style={POPOVER_SHADOW}>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Payment Date</p>
                {closedPeriod ? (
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
                  setActivePopover(null);
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Starting check number (user 10/15), step 2 only: one chip,
              its popover holds a number per bank account. */}
          {phase === 'checks' && checkAccounts.length > 0 && (
            <Popover open={activePopover === 'start'} onOpenChange={(o) => setActivePopover(o ? 'start' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(true)} style={{ fontWeight: 500 }}>
                  <Printer className={chipIconClass(true)} />
                  <span>
                    {checkAccounts.length === 1
                      ? `Starting Check No. · ${startNoFor(checkAccounts[0].accountId)}`
                      : `Starting Check No. · ${checkAccounts.length} accounts`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'start' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[340px] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]" style={POPOVER_SHADOW}>
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Starting Check No.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Read it off the top sheet in the tray. The checks number in sequence from it.</p>
                </div>
                <div className="px-4 pb-3 space-y-2.5">
                  {checkAccounts.map(({ accountId, groups: accGroups }) => {
                    const start = startNoFor(accountId);
                    const count = accGroups.filter((g) => selected.has(g.vendor) && !(g.reference ?? '').trim()).length;
                    return (
                      <div key={accountId} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 500 }}>{accountLabelOf(accountId)}</p>
                          <p className="text-[11px] text-slate-400">
                            {count > 1 ? `Checks ${start} to ${start + count - 1}` : count === 1 ? `Check ${start}` : 'None selected'}
                          </p>
                        </div>
                        <input
                          value={startNos[accountId] ?? String(checkSettingsFor(accountId).nextCheckNumber)}
                          onChange={(e) => setStartNos((prev) => ({ ...prev, [accountId]: e.target.value.replace(/\D/g, '') }))}
                          inputMode="numeric"
                          aria-label={`Starting check number for ${accountLabelOf(accountId)}`}
                          className="h-8 w-[100px] rounded-md border border-border bg-white px-2 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Group by */}
          <Popover open={activePopover === 'group'} onOpenChange={(o) => setActivePopover(o ? 'group' : null)}>
            <PopoverTrigger asChild>
              <button className={chipClass(groupMode !== 'none')} style={{ fontWeight: 500 }}>
                <Rows3 className={chipIconClass(groupMode !== 'none')} />
                {groupMode === 'none' ? 'Group By' : `Grouped by ${groupMode === 'method' ? 'Method' : 'Account'}`}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'group' ? 'rotate-180' : ''}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1.5 z-[260]">
              {([
                { key: 'none', label: 'None' },
                { key: 'method', label: 'Method' },
                { key: 'account', label: 'Pay-From Account' },
              ] as const).map((o) => {
                const active = groupMode === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => { setGroupMode(o.key); setActivePopover(null); }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-left text-[12.5px] transition-colors cursor-pointer ${active ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'}`}
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {o.label}
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
          <div className="w-px h-5 bg-border/70 mx-0.5" />

          {/* Method + Pay-from: multi-select chips (start-run vendor recipe). */}
          {([
            { key: 'method', label: 'Method', icon: Banknote, values: methodFilter, set: setMethodFilter, options: [...new Set(phaseRows.map((g) => g.methodType))].map((v) => ({ id: v, label: v, count: phaseRows.filter((g) => g.methodType === v).length })) },
            { key: 'account', label: 'Pay-From Account', icon: Landmark, values: accountFilter, set: setAccountFilter, options: [...new Set(phaseRows.map((g) => g.payFromAccountId))].map((v) => ({ id: v, label: accountLabelOf(v), count: phaseRows.filter((g) => g.payFromAccountId === v).length })) },
          ] as const).map((chip) => {
            const Icon = chip.icon;
            const live = chip.values.length > 0;
            return (
              <Popover key={chip.key} open={activePopover === chip.key} onOpenChange={(o) => setActivePopover(o ? chip.key : null)}>
                <PopoverTrigger asChild>
                  <button className={chipClass(live)} style={{ fontWeight: 500 }}>
                    <Icon className={chipIconClass(live)} />
                    <span className="max-w-[180px] truncate">
                      {!live ? chip.label : chip.values.length === 1 ? (chip.options.find((o) => o.id === chip.values[0])?.label ?? chip.values[0]) : `${chip.values.length} Selected`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === chip.key ? 'rotate-180' : ''}`} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]" style={POPOVER_SHADOW}>
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>{chip.label}</p>
                    {live && (
                      <button onClick={() => chip.set([])} className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Reset</button>
                    )}
                  </div>
                  <div className="px-2 py-2 max-h-[260px] overflow-y-auto">
                    {chip.options.map((opt) => {
                      const checked = chip.values.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => chip.set(checked ? chip.values.filter((v) => v !== opt.id) : [...chip.values, opt.id])}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <span className="text-[12px] text-foreground flex-1 truncate">{opt.label}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{opt.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}

          <button
            type="button"
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] transition-colors group ${hasActiveFilters ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-default'}`}
            style={{ fontWeight: 500 }}
          >
            <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-300 ${hasActiveFilters ? 'group-hover:rotate-[-45deg]' : ''}`} /> Reset
          </button>
        </div>
      </div>

      {/* The listing DataTable (user 10/15): same table as the start-run
          step and every listing page. Header menus sort, filter, freeze,
          hide; checkboxes pick what this pass records. */}
      <DataTable<Group>
        rows={displayGroups}
        optionRows={phaseRows}
        columns={execColumns}
        getRowId={(g) => g.vendor}
        selectedIds={selected}
        onSelectionChange={(next) => {
          const valid = new Set(phaseRows.map((g) => g.vendor));
          setSelected(new Set([...next].filter((v) => valid.has(v))));
        }}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        columnVisibility={columnVisibility}
        columnFilters={columnFilters}
        onColumnFilterChange={(key, filter) => setColumnFilters((prev) => ({ ...prev, [key]: filter }))}
        onAddColumnFilter={(key) =>
          setColumnFilters((prev) =>
            prev[key]
              ? prev
              : { ...prev, [key]: { columnKey: key, type: execColumns.find((c) => c.key === key)?.filterType ?? 'text', values: [], text: '', min: '', max: '', dateFrom: '', dateTo: '' } },
          )
        }
        onHideColumn={(key) => setColumnVisibility((prev) => ({ ...prev, [key]: false }))}
        sortConfig={sortConfig}
        onSort={(key, dir) => setSortConfig(dir ? { key, direction: dir } : null)}
        frozenColumns={frozenColumns}
        onFreezeColumn={(key) =>
          setFrozenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(key) && key !== 'vendor') next.delete(key);
            else next.add(key);
            return next;
          })
        }
        density="comfort"
        groupBy={
          groupMode === 'none'
            ? undefined
            : (g) => {
                const id = groupMode === 'method' ? g.methodType : g.payFromAccountId;
                const members = displayGroups.filter((x) => (groupMode === 'method' ? x.methodType : x.payFromAccountId) === id);
                return {
                  id,
                  label: groupMode === 'method' ? g.methodType : accountLabelOf(g.payFromAccountId),
                  subtitle: `${members.length} payment${members.length === 1 ? '' : 's'}`,
                  right: <span className="text-[12px] text-slate-600">{money(members.reduce((sum, x) => sum + amountFor(x), 0))}</span>,
                };
              }
        }
        searchQuery={invoiceQuery || vendorQuery}
        searchRows={displayGroups}
        searchRevealAfter="vendor"
        hidePagination
        currentPage={1}
        recordsPerPage={Math.max(1, displayGroups.length)}
        totalRows={displayGroups.length}
        onPageChange={() => {}}
        onRecordsPerPageChange={() => {}}
        emptyConfig={emptyConfig}
      />
      </div>
      {/* Browse picker for the proof-upload modal. */}
      <input
        ref={proofInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (proofVendor) takeProofFiles(proofVendor, e.target.files);
          e.currentTarget.value = '';
        }}
      />

      {/* The commit bar — the authoring footer recipe (user 10/8): the
          selection counts + running total read bottom-LEFT, exactly like
          the start-run modal; actions sit right with a Cancel that clears
          the pass's selection. */}
      <div className={RUN_FOOTER_FLUSH}>
        {/* Same readout as the start-run footer (user 10/8): plain counts
            and the running total — no "N of M" riddle. */}
        <span className="inline-flex items-baseline gap-1.5 shrink-0 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
          <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedGroups.length}</span>
          {` ${phase === 'checks' ? 'check' : 'payment'}${selectedGroups.length === 1 ? '' : 's'} · `}
          <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedInvoiceCount}</span>
          {` invoice${selectedInvoiceCount === 1 ? '' : 's'} · `}
          <span className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>{money(selectedTotal)}</span>
          {recordedGroups.length > 0 && (
            <span className="text-emerald-700 text-[11px]" style={{ fontWeight: 500 }}> · {recordedGroups.length} already recorded</span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-9"
            style={{ fontWeight: 500 }}
          >
            Clear Selection
          </button>
          {/* Some or all (user 10/15): the ticked vendors record on their
              own, or everything left in this step records in one go. */}
          {selectedGroups.length > 0 && selectedGroups.length < phaseGroups.length && (
            <button
              type="button"
              onClick={() => startRecord(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border text-[13px] transition-all shrink-0 cursor-pointer px-3 sm:px-4 h-9 bg-white hover:bg-emerald-50"
              style={{ fontWeight: 500, color: '#047857', borderColor: '#A7F3D0' }}
            >
              {phase === 'checks' ? <Printer className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
              {phase === 'checks' ? `Process ${selectedGroups.length} Selected` : `Record ${selectedGroups.length} Selected`}
            </button>
          )}
          <button
            type="button"
            onClick={() => startRecord(true)}
            className={FOOTER_BTN_PRIMARY}
            style={{ backgroundColor: '#059669', fontWeight: 500 }}
          >
            {phase === 'checks' ? <Printer className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
            {phaseGroups.length === 1
              ? (phase === 'checks' ? 'Process 1 Check' : 'Record 1 Payment')
              : phase === 'checks'
                ? `Process All ${phaseGroups.length} Checks`
                : `Record All ${phaseGroups.length} Payments`}
          </button>
        </div>
      </div>

      {/* Record confirmation — the green record modal (8/5/26): green
          hero, stacked CTAs. The GL impact moved OUT (user 10/21/26): it
          shows once both steps are done, for the whole run. */}
      {/* Never confirm an empty pass (user 9/25): the phantom "Record 0
          payments for $0.00" is unreachable — no selection, no confirm. */}
      <Dialog open={confirmOpen && selectedGroups.length > 0} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="flex flex-col p-0 gap-0 max-w-[calc(100%-2rem)] sm:max-w-[520px] overflow-hidden rounded-2xl border-0 bg-white"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          showCloseButton={false}
        >
          {(() => {
            // The confirm speaks for the SELECTION (Eli 9/25): partial
            // passes preview only what this Record posts. Per-INVOICE
            // outcome counts (user 10/21/26 copy): an invoice this pass
            // closes reads paid in full, one it only dents reads partial.
            let fullCount = 0;
            let partInvoiceCount = 0;
            selectedGroups.forEach((g) => {
              planGroupPass(run, g, amountFor(g)).slices.forEach((c) => {
                const paid = c.cash + c.credit;
                if (paid <= 0.004) return;
                if (paid >= lineRemaining(c.line) - 0.004) fullCount += 1;
                else partInvoiceCount += 1;
              });
            });
            // What this pass leaves open: vendors not ticked, plus the
            // unpaid rest of any partial amount (user 10/21/26).
            const openAfter = Math.round(
              unrecordedGroups.reduce((s, g) => s + openFor(g), 0) * 100 - selectedTotal * 100,
            ) / 100;
            const invoiceWord = (n: number) => `${n} invoice${n === 1 ? '' : 's'}`;
            const summaryRows = [
              fullCount > 0 ? { label: 'Paid in Full', value: invoiceWord(fullCount) } : null,
              partInvoiceCount > 0 ? { label: 'Partially Paid', value: invoiceWord(partInvoiceCount) } : null,
              openAfter > 0.004 ? { label: 'Left on This Run', value: money(openAfter) } : null,
              // A future payment date posts Scheduled, not Paid: say when.
              scheduled ? { label: 'Scheduled For', value: humanDate(run.paymentDate) } : null,
            ].filter((r): r is { label: string; value: string } => r !== null);
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
                    Record Payments
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-7 pb-7">
                  <DialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    Record {selectedGroups.length} payment{selectedGroups.length === 1 ? '' : 's'} for {money(selectedTotal)}?
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-slate-500 mt-1.5">
                    These post to the general ledger and can only be undone by reversal.
                  </DialogDescription>
                  {/* The done-everything gate (Jennifer 9/1/26) and the
                      missing-proof reminder now speak as NOTIFICATIONS when
                      the confirm opens (user 10/8), not as banners stacked
                      inside the modal — the modal keeps its original shape. */}
                  {/* Outcome summary (user 10/21/26 copy): label left,
                      figure right, the alert-box recipe. */}
                  <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5 space-y-1.5">
                    {summaryRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Side by side, Keep reviewing first (user 10/21/26). */}
                  <div className="w-full mt-5 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      Keep Reviewing
                    </button>
                    <button
                      type="button"
                      onClick={execute}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: '#059669', color: '#fff' }}
                    >
                      Record Payments
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Proof-of-payment upload (user 10/7): a proper drop-zone modal in
          the app's attachment design language, not a bare OS picker. ── */}
      <Dialog open={!!proofVendor} onOpenChange={(o) => { if (!o) { setProofVendor(null); setProofDragging(false); } }}>
        <DialogContent
          className="p-0 gap-0 max-w-[calc(100%-2rem)] sm:max-w-[460px] overflow-hidden rounded-2xl border-0 bg-white"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          showCloseButton={false}
        >
          {/* Flat form-modal chrome (module standard): icon tile + title +
              context line, close at right — same header recipe as the print
              flow and the other run form modals. */}
          <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Paperclip className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>Proof of Payment</DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                  {proofGroup ? `${proofGroup.vendor} · ${proofLabelFor(proofGroup.methodType)}` : ''}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProofVendor(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {/* Drop zone — drag or browse, matching the Attachments tab. */}
            <div
              onDragOver={(e) => { e.preventDefault(); setProofDragging(true); }}
              onDragLeave={() => setProofDragging(false)}
              onDrop={(e) => { e.preventDefault(); setProofDragging(false); if (proofVendor) takeProofFiles(proofVendor, e.dataTransfer.files); }}
              onClick={() => proofInputRef.current?.click()}
              className={`rounded-xl border border-dashed px-4 py-7 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                proofDragging ? 'border-primary bg-blue-50/60 ring-2 ring-primary/30' : 'border-slate-300 bg-slate-50/50 hover:border-primary/45 hover:bg-blue-50/40'
              }`}
            >
              <span className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center mb-2">
                <Upload className="w-4 h-4" />
              </span>
              <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>Drag a file here, or click to browse</p>
              <p className="text-[11px] text-slate-400 mt-0.5">PDF, DOC, XLS, PNG, JPG up to 10MB</p>
            </div>
            {/* Attached list with remove. */}
            {(proofGroup?.attachments ?? []).length > 0 && (
              <div className="space-y-1.5">
                {(proofGroup?.attachments ?? []).map((a) => (
                  <div key={a.name} className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[12px] text-foreground truncate flex-1 min-w-0" style={{ fontWeight: 500 }}>{a.name}</span>
                    <button
                      type="button"
                      onClick={() => proofVendor && removeProof(proofVendor, a.name)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      aria-label={`Remove ${a.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setProofVendor(null)}
              className="h-9 px-4 rounded-lg border-0 text-[13px] bg-primary text-white shadow-sm cursor-pointer transition-opacity hover:opacity-90"
              style={{ fontWeight: 500 }}
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── GL impact once BOTH steps are done (user 10/21/26) ─────────────
 * The record confirms no longer carry the journal. When the last
 * payment or check on the run records, this summary shows what the
 * whole run posted: Dr payables for cash + credit, Cr each pay-from
 * account for the cash it paid, Cr prepayments for drawn credit. */

type GlRow = { code: string; name: string; debit: number; credit: number };

/** The journal table with direction arrows (the record modal's recipe). */
function GlImpactTable({ rows }: { rows: GlRow[] }) {
  return (
    <div className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
        <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>GL Impact</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <tbody>
            {rows.map((l, i) => {
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
              <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(rows.reduce((s, l) => s + l.debit, 0))}</td>
              <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(rows.reduce((s, l) => s + l.credit, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Shown by the run page when the last pass records (both steps done). */
export function RunGlSummaryModal({
  run,
  payments,
  open,
  onClose,
}: {
  run: PaymentRun;
  payments: Payment[];
  open: boolean;
  onClose: () => void;
}) {
  const { showGlOnConfirmations } = useSystemSettings();
  const runPays = payments.filter(
    (p) => p.runId === run.id && p.type === 'Payment' && p.status !== 'Cancelled' && p.status !== 'Reversed',
  );
  const round = (n: number) => Math.round(n * 100) / 100;
  const cashTotal = round(runPays.reduce((s, p) => s + p.amount, 0));
  const perAccount = new Map<string, number>();
  runPays.forEach((p) => perAccount.set(p.bankAccount, round((perAccount.get(p.bankAccount) ?? 0) + p.amount)));
  // What the payments actually POSTED, summed per account (user
  // 10/22/26): payables for invoices, the advances account for
  // pre-invoices, each bank for its cash, prepayments for drawn credit.
  const byAccount = new Map<string, GlRow>();
  runPays.forEach((p) =>
    (p.glEntries ?? []).forEach((e) => {
      const row = byAccount.get(e.accountCode) ?? { code: e.accountCode, name: e.accountName, debit: 0, credit: 0 };
      row.debit = round(row.debit + (e.debit ?? 0));
      row.credit = round(row.credit + (e.credit ?? 0));
      byAccount.set(e.accountCode, row);
    }),
  );
  // Debits first, payables leading (the confirm's order), then credits.
  const rank = (r: GlRow) => (r.debit > 0 ? (r.code.startsWith('2') ? 0 : 1) : 2);
  const rows: GlRow[] = [...byAccount.values()].sort((a, b) => rank(a) - rank(b));
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 max-w-[calc(100%-2rem)] sm:max-w-[520px] overflow-hidden rounded-2xl border-0 bg-white"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        showCloseButton={false}
      >
        <div
          className="relative flex flex-col items-center pt-9 pb-5"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(255,255,255,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#059669' }} />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: '#047857' }} />
          </div>
          <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
            Payment Run Recorded
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-7 pb-7">
          <DialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {run.id} is fully recorded
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500 mt-1.5">
            {runPays.length} payment{runPays.length === 1 ? '' : 's'} for {money(cashTotal)} from {perAccount.size} account{perAccount.size === 1 ? '' : 's'}. This is what the run posts to the general ledger.
          </DialogDescription>
          {showGlOnConfirmations && (
            <div className="w-full mt-4">
              <GlImpactTable rows={rows} />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-5 h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, backgroundColor: '#059669', color: '#fff' }}
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Checks recorded: print now, later, or by hand (user 10/21/26) ───
 * The single-payment success modal's three choices, for the checks a
 * run pass just recorded. Print now opens the print flow per bank
 * account; Print later leaves them on the unprinted list; Manual check
 * logs hand-written numbers one payment at a time. */
export function RunChecksRecordedModal({
  run,
  checks,
  startNumbers,
  open,
  onPrintNow,
  onPrintLater,
  onManual,
}: {
  run: PaymentRun;
  checks: Payment[];
  startNumbers: Record<string, number>;
  open: boolean;
  onPrintNow: () => void;
  onPrintLater: () => void;
  onManual: () => void;
}) {
  if (checks.length === 0) return null;
  const accounts = [...new Set(checks.map((p) => p.bankAccount))];
  const single = checks.length === 1 ? checks[0] : null;
  const total = Math.round(checks.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const firstAccount = accounts[0];
  const start = startNumbers[firstAccount] ?? checkSettingsFor(firstAccount).nextCheckNumber;
  const stock = STOCK_PROFILES[checkSettingsFor(firstAccount).style].displayName;
  const accountLabel = (id: string) => PAY_FROM_ACCOUNTS.find((a) => a.id === id)?.label ?? id;
  const softBtn = 'w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100';
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onPrintLater(); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 max-w-[calc(100%-2rem)] sm:max-w-[460px] overflow-hidden rounded-2xl border-0 bg-white"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        showCloseButton={false}
      >
        <div
          className="relative flex flex-col items-center pt-7 pb-3"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#059669', filter: 'blur(50px)' }} />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: '#047857' }} />
          </div>
          <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
            {single ? 'Check Recorded' : 'Checks Recorded'}
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6 pb-6">
          <DialogTitle className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {single ? `${money(total)} to ${single.vendor}` : `${checks.length} checks recorded for ${money(total)}`}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500 mt-1">
            {run.id} · Check · {humanDate(checks[0].paymentDate)}
          </DialogDescription>
          <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                {accounts.length > 1
                  ? `${checks.length} checks · ${accounts.length} bank accounts`
                  : single ? `Check ${start} · ${stock}` : `${checks.length} checks from ${start}`}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {accounts.length > 1 ? 'Prints one bank account at a time' : accountLabel(firstAccount)}
              </p>
            </div>
            <button
              type="button"
              onClick={onPrintNow}
              className="h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              style={{ fontWeight: 600 }}
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              Print Now
            </button>
          </div>
          <div className="w-full mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onPrintLater} className={softBtn} style={{ fontWeight: 500, color: '#334155' }}>
              Print Later
            </button>
            <button type="button" onClick={onManual} className={softBtn} style={{ fontWeight: 500, color: '#334155' }}>
              Manual Check
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
