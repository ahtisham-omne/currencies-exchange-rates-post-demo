import { formatMoney as moneyIn } from '@/app/currency/money';
import { useMemo, useState } from 'react';
import {
  FilePlus,
  Pencil,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  CreditCard,
  RotateCcw,
  Receipt,
  Flag,
  ShieldCheck,
  Paperclip,
  Trash2,
  Archive,
  ArchiveRestore,
  Cog,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';
import { Invoice } from '@/app/data/mockInvoices';
import { Payment } from '@/app/data/mockPayments';
import { LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { EmptyState } from '@/app/components/EmptyState';
import { PaymentRecord } from './ReversePaymentModal';
import type { RMA } from '@/app/data/mockRMAs';

// Partner Contact-Directory > Activity History tab recipe — a
// single Activity History card with a vertical timeline of events:
//
//   ┌───────────────────────────────────────────────┐
//   │ Activity History                     N events │
//   ├───────────────────────────────────────────────┤
//   │ (●)──  Mar 28, 2026 at 03:15 PM               │
//   │  │    Sarah Johnson approved Purchase Order   │
//   │  │                                            │
//   │ (●)──  Mar 25, 2026 at 07:00 PM               │
//   │  │    System sent Email to issacarcher@…       │
//   │  …                                            │
//   └───────────────────────────────────────────────┘
//
// Each row has an icon circle on the timeline, the absolute
// timestamp in slate-500 small caps, and an action line where the
// actor is bolded and the subject reference is a coloured link.
// The previous expandable "Show detail" pattern is dropped — the
// partner reference puts everything on one line per event.

type EventKind =
  | 'created'
  | 'edited'
  | 'approved'
  | 'rejected'
  | 'hold'
  | 'hold-released'
  | 'payment'
  | 'payment-reversed'
  | 'credit-memo'
  | 'exception-raised'
  | 'exception-resolved'
  | 'attachment-added'
  | 'attachment-deleted'
  | 'archived'
  | 'restored';

interface ActivityEvent {
  id: string;
  kind: EventKind;
  actor: string;
  /** Verb phrase placed between actor and subject, e.g. "approved", "added payment to". */
  verb: string;
  /** Subject rendered as a coloured chip-link at the end of the line. */
  subject?: { label: string; tone: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' };
  /** Optional one-line detail/reason rendered in slate beneath the action line. */
  detail?: string;
  at: string;
  isSystem?: boolean;
}

/** What an event is about, which is how somebody scans for one.
 *
 *  Nobody looks through a year of history for "an edited event": they look
 *  for when the money moved, or when the goods did, or who approved it. The
 *  kinds fold into those four, and a pill only appears once the history has
 *  something behind it. */
type EventTopic = 'lifecycle' | 'money' | 'documents' | 'exceptions';

const TOPIC_OF: Record<EventKind, EventTopic> = {
  created: 'lifecycle',
  edited: 'lifecycle',
  approved: 'lifecycle',
  rejected: 'lifecycle',
  hold: 'exceptions',
  'hold-released': 'exceptions',
  payment: 'money',
  'payment-reversed': 'money',
  'credit-memo': 'money',
  'exception-raised': 'exceptions',
  'exception-resolved': 'exceptions',
  'attachment-added': 'documents',
  'attachment-deleted': 'documents',
  archived: 'lifecycle',
  restored: 'lifecycle',
};

const TOPIC_LABEL: Record<EventTopic, string> = {
  lifecycle: 'Lifecycle',
  money: 'Money',
  documents: 'Documents',
  exceptions: 'Holds & exceptions',
};

/** The month an event falls in, which is the unit a history is read by. */
function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Undated';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  if (key === 'Undated') return 'Undated';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const KIND_META: Record<EventKind, { icon: typeof FilePlus; color: string; bg: string }> = {
  created: { icon: FilePlus, color: '#2563EB', bg: '#EFF6FF' },
  edited: { icon: Pencil, color: '#475569', bg: '#F1F5F9' },
  approved: { icon: CheckCircle2, color: '#047857', bg: '#ECFDF5' },
  rejected: { icon: XCircle, color: '#991B1B', bg: '#FEF2F2' },
  hold: { icon: Pause, color: '#92400E', bg: '#FFFBEB' },
  'hold-released': { icon: Play, color: '#047857', bg: '#ECFDF5' },
  payment: { icon: CreditCard, color: '#6D28D9', bg: '#F5F3FF' },
  'payment-reversed': { icon: RotateCcw, color: '#B45309', bg: '#FFFBEB' },
  'credit-memo': { icon: Receipt, color: '#B45309', bg: '#FFFBEB' },
  'exception-raised': { icon: Flag, color: '#991B1B', bg: '#FEF2F2' },
  'exception-resolved': { icon: ShieldCheck, color: '#047857', bg: '#ECFDF5' },
  'attachment-added': { icon: Paperclip, color: '#475569', bg: '#F1F5F9' },
  'attachment-deleted': { icon: Trash2, color: '#991B1B', bg: '#FEF2F2' },
  archived: { icon: Archive, color: '#475569', bg: '#F1F5F9' },
  restored: { icon: ArchiveRestore, color: '#047857', bg: '#ECFDF5' },
};

const SUBJECT_TONE: Record<NonNullable<ActivityEvent['subject']>['tone'], { bg: string; text: string; border: string }> = {
  blue: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  emerald: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  violet: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  amber: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  rose: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  slate: { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' },
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatPartnerTimestamp(iso: string) {
  // Accept either YYYY-MM-DD or full ISO; output "Mar 28, 2026 at 03:15 PM".
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = MONTH_SHORT[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = hours.toString().padStart(2, '0');
  return `${month} ${day}, ${year} at ${hh}:${minutes} ${period}`;
}

export function ActivityTab({
  invoice,
  payments,
  records = [],
  appPayments = [],
  rma,
}: {
  invoice: Invoice;
  payments: PaymentRecord[];
  /** Linked financial records — surfaces credit memos and reversed
   *  payments in the activity feed (feedback 7/16/26: events removed
   *  from the journey timeline live here instead). */
  records?: LinkedFinancialRecord[];
  /** App-recorded payment records applied to this invoice. */
  appPayments?: Payment[];
  /** RMA context — when present, the feed is built from
   *  rma.actionHistory (item #12). */
  rma?: RMA;
}) {
  const events = useMemo<ActivityEvent[]>(() => {
    // Item #12 — RMA activity feed built from rma.actionHistory.
    if (rma) {
      // Every action the record can carry, past tense, reading straight into
      // the number that follows it: "Ahtisham Ahmad closed RMA-01019".
      //
      // `close`, `record-credit` and `record-refusal` were missing, and a
      // miss fell through to the raw key, so the feed read "Ahtisham Ahmad
      // close RMA-01019" and "record-credit RMA-01008". Two of the verbs that
      // were here trailed a preposition the subject could not follow --
      // "shipped to vendor RMA-01019" -- so they lost it.
      const RMA_VERBS: Record<string, { verb: string; kind: EventKind }> = {
        create: { verb: 'created', kind: 'created' },
        submit: { verb: 'sent', kind: 'edited' },
        approve: { verb: 'approved', kind: 'approved' },
        ship: { verb: 'shipped', kind: 'edited' },
        receive: { verb: 'received', kind: 'edited' },
        close: { verb: 'closed', kind: 'approved' },
        'log-settlement': { verb: 'logged the settlement on', kind: 'approved' },
        'record-credit': { verb: 'recorded the vendor credit on', kind: 'edited' },
        'record-refusal': { verb: 'recorded the vendor refusal on', kind: 'rejected' },
        cancel: { verb: 'cancelled', kind: 'rejected' },
        reject: { verb: 'rejected', kind: 'rejected' },
        archive: { verb: 'archived', kind: 'edited' },
      };
      const rmaEvents: ActivityEvent[] = (rma.actionHistory ?? []).map((h, i) => {
        const key = h.action.toLowerCase();
        const meta = RMA_VERBS[key] ?? { verb: h.action, kind: 'edited' as EventKind };
        return {
          id: `rma-ev-${i}`,
          kind: meta.kind,
          actor: h.by,
          verb: meta.verb.toLowerCase(),
          subject: { label: rma.rmaNumber, tone: 'blue' },
          detail: h.reason,
          at: h.at,
        };
      });
      return rmaEvents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }
    const list: ActivityEvent[] = [];
    const money = (n: number) => moneyIn(n, invoice.currency);

    list.push({
      id: 'ev-created',
      kind: 'created',
      actor: invoice.createdBy || 'System',
      isSystem: !invoice.createdBy || invoice.createdBy === 'System',
      verb: 'created',
      subject: { label: invoice.invoiceNumber, tone: 'blue' },
      detail: `Type: ${invoice.type} · Currency: ${invoice.currency}`,
      at: invoice.createdDate || invoice.invoiceDate,
    });

    (invoice.actionHistory || []).forEach((entry, i) => {
      const lower = entry.action.toLowerCase();
      const kind: EventKind = lower.includes('approve')
        ? 'approved'
        : lower.includes('reject')
          ? 'rejected'
          : lower.includes('hold released') || lower.includes('release')
            ? 'hold-released'
            : lower.includes('hold')
              ? 'hold'
              : lower.includes('archive')
                ? 'archived'
                : lower.includes('restore')
                  ? 'restored'
                  : lower.includes('exception resolved')
                    ? 'exception-resolved'
                    : lower.includes('exception')
                      ? 'exception-raised'
                      : 'edited';
      list.push({
        id: `ev-hist-${i}`,
        kind,
        actor: entry.by,
        verb: entry.action.toLowerCase(),
        subject: { label: invoice.invoiceNumber, tone: 'blue' },
        detail: entry.reason,
        at: entry.at,
      });
    });

    payments.forEach((p, i) => {
      list.push({
        id: `ev-pay-${i}`,
        kind: 'payment',
        actor: invoice.createdBy || 'System',
        verb: `recorded ${money(p.amount)} payment on`,
        subject: { label: p.reference, tone: 'violet' },
        at: p.date,
      });
    });

    // Credit memos and reversed payments no longer render on the journey
    // timeline (7/16/26) — the activity feed is their full record.
    const seenRefs = new Set<string>();
    records.forEach((r, i) => {
      seenRefs.add(r.reference);
      if (r.type === 'Credit Memo') {
        list.push({
          id: `ev-credit-${i}`,
          kind: 'credit-memo',
          actor: r.createdBy || 'System',
          verb: `applied ${money(r.amount)} credit memo`,
          subject: { label: r.reference, tone: 'amber' },
          detail: r.description || undefined,
          at: r.date,
        });
      } else if ((r.type === 'Payment' || r.type === 'Prepayment') && (r.status === 'Reversed' || r.status === 'Returned')) {
        list.push({
          id: `ev-reversal-${i}`,
          kind: 'payment-reversed',
          actor: r.createdBy || 'System',
          verb: `reversed ${money(r.amount)} ${r.type.toLowerCase()}`,
          subject: { label: r.reference, tone: 'rose' },
          detail: r.description || undefined,
          at: r.date,
        });
      }
    });
    appPayments.forEach((p, i) => {
      if (p.status !== 'Reversed' || seenRefs.has(p.paymentNumber)) return;
      const applied = (p.appliedInvoices ?? []).filter((a) => a.invoiceNumber === invoice.invoiceNumber);
      if (applied.length === 0) return;
      list.push({
        id: `ev-app-reversal-${i}`,
        kind: 'payment-reversed',
        actor: p.createdBy || 'System',
        verb: `reversed ${money(applied.reduce((s, a) => s + a.amount, 0))} ${p.type.toLowerCase()}`,
        subject: { label: p.paymentNumber, tone: 'rose' },
        detail: p.memo || undefined,
        at: p.updatedDate || p.paymentDate,
      });
    });

    if (invoice.status === 'Approved' || invoice.status === 'Partially Paid' || invoice.status === 'Paid in Full' || invoice.status === 'Settled') {
      list.push({
        id: 'ev-approved',
        kind: 'approved',
        // The approver is whoever the invoice records, not one name on every
        // document in the system.
        actor: invoice.updatedBy || invoice.createdBy || 'Eli Rosenbloom',
        verb: 'approved and posted',
        subject: { label: invoice.invoiceNumber, tone: 'emerald' },
        at: invoice.postingDate || invoice.invoiceDate,
      });
    }

    if (invoice.is_exception) {
      list.push({
        id: 'ev-exception',
        kind: 'exception-raised',
        actor: 'System',
        isSystem: true,
        verb: 'flagged exception on',
        subject: { label: invoice.invoiceNumber, tone: 'rose' },
        detail: 'Awaiting reviewer action',
        at: invoice.createdDate || invoice.invoiceDate,
      });
    }

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [invoice, payments, records, appPayments, rma]);

  // A year of a return's life is a long list, and the thing being looked for
  // is almost always "when did the money move" or "what happened in March".
  // So: a search over what the line actually says, pills by topic, and the
  // months folded shut behind their counts with the newest one open.
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<EventTopic | 'all'>('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const topicCounts = useMemo(() => {
    const counts: Record<EventTopic, number> = {
      lifecycle: 0,
      money: 0,
      documents: 0,
      exceptions: 0,
    };
    events.forEach((e) => {
      counts[TOPIC_OF[e.kind]] += 1;
    });
    return counts;
  }, [events]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (topic !== 'all' && TOPIC_OF[e.kind] !== topic) return false;
      if (!q) return true;
      return (
        e.actor.toLowerCase().includes(q) ||
        e.verb.toLowerCase().includes(q) ||
        (e.subject?.label.toLowerCase().includes(q) ?? false) ||
        (e.detail?.toLowerCase().includes(q) ?? false) ||
        formatPartnerTimestamp(e.at).toLowerCase().includes(q)
      );
    });
  }, [events, query, topic]);

  /** Newest month first, events inside already sorted. */
  const months = useMemo(() => {
    const byMonth = new Map<string, ActivityEvent[]>();
    shown.forEach((e) => {
      const key = monthKeyOf(e.at);
      const at = byMonth.get(key);
      if (at) at.push(e);
      else byMonth.set(key, [e]);
    });
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [shown]);

  // A search is a question about the whole history, so what it finds opens.
  const searching = query.trim().length > 0 || topic !== 'all';
  const isOpen = (key: string, index: number) =>
    searching ? true : closed[key] !== undefined ? !closed[key] : index === 0;
  const allOpen = months.every((m, i) => isOpen(m[0], i));

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-4">
        {/* Module-standard empty state (EmptyState component, 7/15/26). */}
        <EmptyState
          icon={Cog}
          title="No activity recorded yet"
          description={rma
            ? 'Approvals, shipments, receipts and other events on this RMA show up here.'
            : 'Approvals, payments, holds and other events on this invoice show up here.'}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Activity History</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>
            {shown.length === events.length
              ? `${events.length} event${events.length === 1 ? '' : 's'}`
              : `${shown.length} of ${events.length} events`}
          </span>
          {months.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {};
                months.forEach(([key]) => {
                  next[key] = allOpen;
                });
                setClosed(next);
              }}
              className="text-[11px] text-primary transition-colors hover:text-blue-700"
              style={{ fontWeight: 600 }}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      </div>

      {/* Search and topics. Nobody scans a year of history for "an edited
          event": they look for when the money moved, or for a month. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search person, action, reference, date…"
            aria-label="Search the activity history"
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12px] outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { key: 'all' as const, label: 'All', count: events.length },
            ...(Object.keys(TOPIC_LABEL) as EventTopic[])
              .filter((t) => topicCounts[t] > 0)
              .map((t) => ({ key: t, label: TOPIC_LABEL[t], count: topicCounts[t] })),
          ]).map((pill) => {
            const on = topic === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setTopic(pill.key)}
                aria-pressed={on}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors ${
                  on
                    ? 'border-primary bg-accent text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                style={{ fontWeight: 600 }}
              >
                {pill.label}
                <span className={on ? 'text-primary/70' : 'text-slate-400'}>{pill.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {months.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-slate-500">
          Nothing in this history matches that.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setTopic('all');
            }}
            className="text-primary transition-colors hover:text-blue-700"
            style={{ fontWeight: 600 }}
          >
            Clear the filters
          </button>
        </p>
      ) : (
        months.map(([key, monthEvents], monthIndex) => {
          const open = isOpen(key, monthIndex);
          return (
            <div key={key} className="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setClosed((prev) => ({ ...prev, [key]: open }))}
                aria-expanded={open}
                className="flex w-full items-center gap-2 bg-[#FAFBFC] px-4 py-2 text-left transition-colors hover:bg-[#F4F6F9]"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
                />
                <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                  {monthLabel(key)}
                </span>
                <span
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] text-slate-500 tabular-nums ring-1 ring-inset ring-slate-200"
                  style={{ fontWeight: 600 }}
                >
                  {monthEvents.length}
                </span>
              </button>
              {open && (
      <ol className="relative px-4 py-4">
        {/* Vertical timeline rail */}
        <div className="absolute left-[28px] top-6 bottom-6 w-px bg-slate-200 pointer-events-none" />

        {monthEvents.map((event) => {
          const meta = KIND_META[event.kind];
          const tone = event.subject ? SUBJECT_TONE[event.subject.tone] : null;
          return (
            <li key={event.id} className="relative pl-10 pr-2 py-2.5 group">
              {/* Icon dot on the rail */}
              <div
                className="absolute left-[14px] top-3 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                style={{ backgroundColor: meta.bg }}
              >
                <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>

              {/* Timestamp */}
              <p className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>
                {formatPartnerTimestamp(event.at)}
              </p>

              {/* Action line */}
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 400 }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>
                  {event.actor}
                </span>{' '}
                <span className="text-slate-600">{event.verb}</span>
                {event.subject && tone && (
                  <>
                    {' '}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="inline-flex items-center px-1.5 py-px rounded text-[11px] hover:underline align-baseline"
                      style={{
                        fontWeight: 700,
                        backgroundColor: tone.bg,
                        color: tone.text,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {event.subject.label}
                    </a>
                  </>
                )}
              </p>

              {/* Optional detail line */}
              {event.detail && (
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  {event.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
