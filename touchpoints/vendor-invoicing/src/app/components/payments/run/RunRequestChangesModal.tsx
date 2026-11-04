import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, FilePen, Plus, Search as SearchIcon, X } from 'lucide-react';
import { liveLines, type PaymentRun } from '@/app/data/paymentRuns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Checkbox } from '@/app/components/ui/checkbox';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { SYSTEM_USERS, SYSTEM_ROLES } from '@/app/data/systemUsers';
import { RUN_CHANGE_REASONS, RUN_LINE_CHANGE_REASONS } from './runReasonConfigs';
import { money } from './runUi';
import { highlightText } from '@/app/components/InvoiceDataTable';

/* ── Request changes (8/5/26, replaces blunt rejection) ──────────────
 * The approver builds a list of ISSUES, each scoped to one invoice line
 * or the whole run, reason mandatory, optional note, and assigns who
 * resolves them (the run's creator by default). Nothing is rejected or
 * lost: the run goes back with actionable fixes.
 *
 * Gradient hero shell (8/12/26, was flat chrome): the run's other
 * reason modals (hold, cancel) wear the InvoiceReasonDialog glow-hero
 * recipe, so this one does too — orange needs-work identity, centered
 * icon tile + pill, stacked full-width CTAs. */

const RUN_SCOPE = '__run__';

interface DraftIssue {
  // Either [RUN_SCOPE] (the whole run) or one-or-more invoiceIds — one
  // issue can apply to SEVERAL invoices (Eli 10/5: "you could have four
  // of them this issue, two a different issue").
  scopes: string[];
  reason: string;
  note: string;
}

export function RunRequestChangesModal({
  run,
  open,
  initialInvoiceId,
  onClose,
  onConfirm,
}: {
  run: PaymentRun;
  open: boolean;
  /** Pre-scope the first issue to one line (the per-line flag action). */
  initialInvoiceId?: string;
  onClose: () => void;
  onConfirm: (input: {
    issues: Array<{ invoiceId?: string; reason: string; note?: string }>;
    assignees: string[];
  }) => void;
}) {
  const [issues, setIssues] = useState<DraftIssue[]>([{ scopes: [RUN_SCOPE], reason: '', note: '' }]);
  // Assignees ride the standard NotifyToggleCard (user 10/8, the same
  // notify block every reason modal wears): the run's CREATOR is seeded
  // as an added person chip — no verbose assignment copy. Ids are
  // SYSTEM_USERS / SYSTEM_ROLES ids, resolved to names on send.
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [notifyOn, setNotifyOn] = useState(true);
  // Search inside the invoice-scope dropdown (user 10/8).
  const [scopeQuery, setScopeQuery] = useState('');
  // Never-blocked CTA (user 9/23): clicking while invalid highlights the
  // gaps instead of the button sitting disabled. Declared BEFORE the
  // early return — a hook after `if (!open) return null` crashed the
  // whole app the moment the modal opened (BA 9/25: "Request changes on
  // screen is not working").
  const [showErrors, setShowErrors] = useState(false);
  const creatorId = SYSTEM_USERS.find((u) => u.name === run.createdBy)?.id;

  useEffect(() => {
    if (open) {
      setIssues([{ scopes: [initialInvoiceId ?? RUN_SCOPE], reason: '', note: '' }]);
      setAssigneeIds(new Set(creatorId ? [creatorId] : []));
      setNotifyOn(true);
      setScopeQuery('');
      setShowErrors(false);
    }
  }, [open, initialInvoiceId, creatorId]);

  if (!open) return null;

  const lines = liveLines(run);
  const patchIssue = (i: number, patch: Partial<DraftIssue>) =>
    setIssues((prev) => prev.map((iss, idx) => (idx === i ? { ...iss, ...patch } : iss)));
  const isRunScoped = (iss: DraftIssue) => iss.scopes.includes(RUN_SCOPE);
  // Toggle one invoice in/out of an issue's scope. Picking an invoice
  // drops "the whole run"; emptying the list falls back to the run.
  // Crossing the run↔line boundary resets the reason (the reason lists
  // differ between run-level and line-level).
  const toggleScope = (i: number, invoiceId: string) =>
    setIssues((prev) =>
      prev.map((iss, idx) => {
        if (idx !== i) return iss;
        const wasRun = iss.scopes.includes(RUN_SCOPE);
        const base = iss.scopes.filter((s) => s !== RUN_SCOPE);
        const next = base.includes(invoiceId) ? base.filter((s) => s !== invoiceId) : [...base, invoiceId];
        const scopes = next.length === 0 ? [RUN_SCOPE] : next;
        const crossed = wasRun !== scopes.includes(RUN_SCOPE);
        return { ...iss, scopes, reason: crossed ? '' : iss.reason };
      }),
    );
  const setWholeRun = (i: number) =>
    setIssues((prev) => prev.map((iss, idx) => (idx === i ? { ...iss, scopes: [RUN_SCOPE], reason: '' } : iss)));
  const scopeLabel = (iss: DraftIssue) => {
    if (iss.scopes.includes(RUN_SCOPE)) return 'The Whole Run';
    if (iss.scopes.length === 1) {
      const l = lines.find((x) => x.invoiceId === iss.scopes[0]);
      return l ? l.invoiceNumber : '1 Invoice';
    }
    return `${iss.scopes.length} Invoices`;
  };
  // "Other" must SAY what it is (global rule, 8/28/26 evening) — the
  // reason dialogs already enforce it; this builder does too.
  const noteMissing = (iss: DraftIssue) => iss.reason === 'Other' && !iss.note.trim();
  const allValid = issues.length > 0 && issues.every((iss) => iss.reason && !noteMissing(iss) && iss.scopes.length > 0);
  // Inline warning copy (Eli 10/5: the warning stays in the box, not a
  // toast that vanishes) — names exactly what's missing.
  const validationWarning = !allValid
    ? 'Pick a reason on every issue. "Other" needs a description.'
    : notifyOn && assigneeIds.size === 0
      ? 'Pick at least one person to notify, or turn the notify toggle off.'
      : null;

  const send = () => {
    if (!allValid || (notifyOn && assigneeIds.size === 0)) {
      setShowErrors(true);
      return;
    }
    // Resolve picked users and roles down to people names, the shape
    // the change request records.
    const names = new Set<string>();
    (notifyOn ? assigneeIds : new Set<string>()).forEach((id) => {
      const user = SYSTEM_USERS.find((u) => u.id === id);
      if (user) {
        names.add(user.name);
        return;
      }
      const role = SYSTEM_ROLES.find((r) => r.id === id);
      if (role) {
        SYSTEM_USERS.filter((u) => u.role === role.name && u.status === 'Active').forEach((u) => names.add(u.name));
      }
    });
    if (names.size === 0) names.add(run.createdBy);
    // A multi-invoice issue expands to one record per invoice (the data
    // model keeps invoiceId singular), carrying the same reason and note.
    onConfirm({
      issues: issues.flatMap((iss) =>
        iss.scopes.includes(RUN_SCOPE)
          ? [{ invoiceId: undefined, reason: iss.reason, note: iss.note.trim() || undefined }]
          : iss.scopes.map((invoiceId) => ({ invoiceId, reason: iss.reason, note: iss.note.trim() || undefined })),
      ),
      assignees: Array.from(names),
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[230] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full sm:max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored glow hero — the reason-modal recipe, orange
            needs-work identity: centered icon tile + pill. */}
        <div
          className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
          style={{
            background: 'linear-gradient(180deg, #FFF7ED 0%, color-mix(in srgb, #FFF7ED 30%, transparent) 70%, transparent 100%)',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: '#C2410C', filter: 'blur(50px)' }}
          />
          <div
            className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#FFEDD5' }}
          >
            <FilePen className="w-7 h-7" style={{ color: '#C2410C', strokeWidth: 2 }} />
          </div>
          <span
            className="mt-2.5 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: '#FFF7ED',
              color: '#C2410C',
            }}
          >
            Request Changes
          </span>
        </div>

        {/* Title + copy — centered, the hero recipe. */}
        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <h3 className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            Request changes on this run?
          </h3>
          <p className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '440px' }}>
            Flag what needs fixing. The run goes back to {run.createdBy} to resolve and resubmit.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-6 pt-3.5 pb-1 space-y-4 text-left">
          {/* Issue builder */}
          <div className="space-y-2.5">
            {issues.map((issue, i) => {
              const lineScoped = !isRunScoped(issue);
              const reasons = lineScoped ? RUN_LINE_CHANGE_REASONS : RUN_CHANGE_REASONS;
              return (
                /* One issue card — the partner split-term SLICE card (user
                   10/8, from Create Payment Term › split events): white
                   card, tinted header strip with a numbered badge + remove,
                   compact px-3.5 py-3 body. Orange needs-work identity. */
                <div key={i} className="rounded-xl border border-border bg-white overflow-hidden transition-all">
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-muted" style={{ backgroundColor: '#FFF7ED' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: '#C2410C' }}>{i + 1}</span>
                      <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Issue {i + 1}</span>
                    </div>
                    {issues.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setIssues((prev) => prev.filter((_, idx) => idx !== i))}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
                        aria-label={`Remove issue ${i + 1}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="px-2 pt-3 pb-1.5 space-y-2.5">
                  {/* Applies to ∥ Reason — two columns (user 10/8), the
                      description textarea full-width below. */}
                  <div className="grid grid-cols-2 gap-2.5 items-start">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Applies To</Label>
                      {/* Multi-select (Eli 10/5): one issue can cover several
                          invoices. "The whole run" and specific invoices are
                          mutually exclusive. */}
                      <Popover onOpenChange={(o) => { if (o) setScopeQuery(''); }}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-[12px] shadow-none transition-colors cursor-pointer border-slate-200 text-foreground hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary"
                            style={{ fontWeight: 500 }}
                          >
                            <span className="min-w-0 truncate text-left">{scopeLabel(issue)}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="z-[260] w-[300px] p-0 overflow-hidden">
                          {/* Search over the run's invoices (user 10/8). */}
                          <div className="relative border-b border-slate-100">
                            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                            <input
                              value={scopeQuery}
                              onChange={(e) => setScopeQuery(e.target.value)}
                              placeholder="Search invoice or vendor…"
                              className="w-full h-9 pl-8 pr-3 text-[12px] bg-white outline-none placeholder:text-slate-400"
                            />
                          </div>
                          <div className="p-1 max-h-[280px] overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => setWholeRun(i)}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-left"
                            >
                              <Checkbox checked={isRunScoped(issue)} className="shrink-0 pointer-events-none" />
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>The Whole Run</span>
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            {lines
                              .filter((l) => {
                                const q = scopeQuery.trim().toLowerCase();
                                if (!q) return true;
                                return l.invoiceNumber.toLowerCase().includes(q) || l.vendor.toLowerCase().includes(q);
                              })
                              .map((l) => {
                                const checked = issue.scopes.includes(l.invoiceId);
                                return (
                                  <button
                                    key={l.invoiceId}
                                    type="button"
                                    onClick={() => toggleScope(i, l.invoiceId)}
                                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                  >
                                    <Checkbox checked={checked} className="shrink-0 pointer-events-none" />
                                    <span className="text-[12px] text-foreground min-w-0 truncate">
                                      {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                                      {highlightText(l.invoiceNumber, scopeQuery)} · {highlightText(l.vendor, scopeQuery)} · {money(l.payAmount)}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Reason
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-[12px] shadow-none transition-colors cursor-pointer ${
                              showErrors && !issue.reason ? 'border-red-400 ring-2 ring-red-100' : issue.reason ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
                            } hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary`}
                          >
                            <span className="truncate">{issue.reason || 'Select a reason'}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] z-[400]">
                          {reasons.map((r) => (
                            <DropdownMenuItem key={r} onClick={() => { patchIssue(i, { reason: r }); setShowErrors(false); }} className="text-[12px]">
                              <span className="flex-1">{r}</span>
                              {issue.reason === r && <Check className="w-3.5 h-3.5 text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {showErrors && !issue.reason && <p className="text-[10px] text-red-600 mt-1">Pick a reason first.</p>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                      Description
                      {issue.reason === 'Other' && <span style={{ color: '#DC2626' }}>*</span>}
                    </Label>
                    <textarea
                      value={issue.note}
                      onChange={(e) => patchIssue(i, { note: e.target.value })}
                      rows={2}
                      placeholder={
                        issue.reason === 'Other'
                          ? 'Tell the run owner what needs to change…'
                          : 'Optional detail, e.g. pay this by Visa instead, or pay only half now.'
                      }
                      className={`w-full text-[11px] rounded-lg border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none min-h-[52px] ${
                        noteMissing(issue) && showErrors ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
                      }`}
                    />
                    {noteMissing(issue) && showErrors && (
                      <p className="text-[10px] text-red-600 mt-1">"Other" needs a description.</p>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
            {/* Partner-module repeating-structure affordance: a dashed
                full-width add row under the item cards. */}
            <button
              type="button"
              onClick={() => setIssues((prev) => [...prev, { scopes: [RUN_SCOPE], reason: '', note: '' }])}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-[12px] text-slate-500 hover:text-[#C2410C] rounded-lg border border-dashed border-slate-300 hover:border-[#C2410C]/45 hover:bg-[#FFF7ED] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Issue
            </button>
          </div>
        </div>

        {/* Notify people — the standard NotifyToggleCard every reason modal
            wears. PINNED below the scroll (user 10/8): long issue lists
            scroll above it, the notify card stays in view. */}
        <div className="px-5 sm:px-6 pt-3 shrink-0 text-left">
          <NotifyToggleCard
            title="Notify People"
            helper="They'll be asked to resolve the changes and resubmit."
            checked={notifyOn}
            onCheckedChange={(on) => { setNotifyOn(on); setShowErrors(false); }}
            selectedIds={assigneeIds}
            onSelectionChange={(ids) => { setAssigneeIds(ids); setShowErrors(false); }}
            accentColor="#C2410C"
            accentBg="#FFF7ED"
            accentBorder="#FED7AA"
            accentText="#C2410C"
          />
        </div>

        {/* Footer — gradient confirm-modal recipe: stacked full-width
            CTAs, solid action on top, soft escape below. */}
        <div className="px-5 sm:px-6 pt-3.5 pb-5 flex flex-col gap-2 shrink-0">
          {/* Inline validation warning (Eli 10/5): the "reason missing"
              message STAYS in the box under the CTA instead of a toast
              that pops and vanishes on a large screen. */}
          {showErrors && validationWarning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-[11.5px] text-rose-700 leading-snug" style={{ fontWeight: 500 }}>
                {validationWarning}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={send}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, backgroundColor: '#C2410C', color: '#fff' }}
          >
            Send Back for Changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          >
            Keep as Pending Approval
          </button>
        </div>
      </div>
    </div>
  );
}
