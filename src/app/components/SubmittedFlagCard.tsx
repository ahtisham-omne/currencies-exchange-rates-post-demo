import React from 'react';
import { Flag, ShieldCheck, CheckCircle2, Paperclip } from 'lucide-react';
import { PhotoPersonAvatar } from '@/app/components/data-table/PersonAvatar';

// ─────────────────────────────────────────────────────────────────────────
// SubmittedFlagCard — the ONE card a submitted Exception / Payment Hold
// wears everywhere (Eli 9/8: "once it is submitted, it's a different
// card… I don't see any reason why it can't be the same card"). Both the
// detail page's Flags accordion and the create/edit flow's seeded
// sections render this exact component: a non-editable reason set off in
// its own labeled box, the optional description, who submitted it and
// when, the attachments, and ONE button — Resolve for an exception,
// Release for a hold. A submitted flag is never edited and never toggled
// off; the only way out is resolving (or releasing) it.
// ─────────────────────────────────────────────────────────────────────────

// Exception reasons — an invoice can carry more than one at a time. Owned
// here (not by the create screen) so every surface parses and labels the
// recorded reason identically.
// The full catalog (parsing + labels); legacy types stay so older recorded
// reasons still chip correctly. What a user can PICK depends on the
// invoice kind, see exceptionOptionsFor (user 10/9).
export const EXCEPTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'price-discrepancy', label: 'Price Discrepancy' },
  { value: 'quantity-mismatch', label: 'Quantity Mismatch' },
  { value: 'damaged-goods', label: 'Damaged Goods' },
  { value: 'payment-terms-mismatch', label: 'Payment Terms Mismatch' },
  { value: 'missing-documents', label: 'Missing Documents' },
  { value: 'incorrect-amount', label: 'Incorrect Amount' },
  { value: 'service-not-received', label: 'Service Not Received' },
  { value: 'duplicate-invoice', label: 'Duplicate Invoice' },
  { value: 'incorrect-vendor', label: 'Incorrect Vendor' },
  { value: 'other', label: 'Other' },
];

export type InvoiceReasonKind = 'inventory' | 'pre' | 'standalone';

/** Invoice type → reason kind: Pre-Invoice and Standalone have their own
 *  lists; every receiving/PO-based type is an inventory invoice. */
export function invoiceReasonKindOf(type?: string | null): InvoiceReasonKind {
  if (type === 'Pre-Invoice') return 'pre';
  if (type === 'Standalone') return 'standalone';
  return 'inventory';
}

const EXCEPTION_VALUES_BY_KIND: Record<InvoiceReasonKind, string[]> = {
  inventory: ['price-discrepancy', 'quantity-mismatch', 'damaged-goods', 'other'],
  pre: ['price-discrepancy', 'payment-terms-mismatch', 'missing-documents', 'other'],
  standalone: ['incorrect-amount', 'service-not-received', 'missing-documents', 'other'],
};

/** Exception reasons offered for an invoice kind (user 10/9). Several
 *  kinds (a mixed bulk selection) union in catalog order. */
export function exceptionOptionsFor(kinds: InvoiceReasonKind | InvoiceReasonKind[]): { value: string; label: string }[] {
  const list = Array.isArray(kinds) ? kinds : [kinds];
  const allowed = new Set(list.flatMap((k) => EXCEPTION_VALUES_BY_KIND[k]));
  return EXCEPTION_TYPE_OPTIONS.filter((o) => allowed.has(o.value));
}

// A recorded exception reason usually leads with its catalogued type
// names ("Price Discrepancy — unit price…"). Recover the type values so
// chips and pre-fills stay identical across the detail page and the
// edit flow.
export function exceptionTypeValuesFromReason(reason: string): string[] {
  const matched = EXCEPTION_TYPE_OPTIONS
    .filter((o) => reason.toLowerCase().includes(o.label.toLowerCase()))
    .map((o) => o.value);
  return matched.length > 0 ? matched : reason ? ['other'] : [];
}

export function exceptionTypeLabelsFromReason(reason: string): string[] {
  return EXCEPTION_TYPE_OPTIONS
    .filter((o) => exceptionTypeValuesFromReason(reason).includes(o.value))
    .map((o) => o.label);
}

type FlagKind = 'exception' | 'hold' | 'resolved';

interface SubmittedFlagCardProps {
  kind: FlagKind;
  /** Overrides the default header ("Exception raised" etc.) — used by the
   *  edit flow's pending-release state. */
  title?: string;
  /** The recorded, non-editable reason. */
  reason?: string;
  /** Exception type chips, parsed from the reason via the shared helper. */
  typeLabels?: string[];
  /** Free-text description when it's distinct from the reason. */
  description?: string;
  by?: string;
  at?: string;
  attachments?: string[];
  /** Consequence line, e.g. "Excluded from GL posting until resolved." */
  footnote?: string;
  /** kind='resolved' only: the resolution record. */
  resolution?: { reason?: string; by?: string; at?: string; attachments?: string[] };
  /** One button: "Resolve" / "Release" / "Resolve and resubmit" / "Undo".
   *  Omitted entirely when onAction is not provided. */
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'solid' | 'outline';
  /** Small caption under the button, e.g. what Resolve opens. */
  actionHint?: string;
  /** Sidebar density (smaller type + tighter padding). */
  compact?: boolean;
  /** Render the content OPEN, without the outer tinted card or leading
   *  icon — for hosts that already provide the frame and icon, like the
   *  sidebar Flags accordion (user 9/22: no card inside a card, no
   *  duplicate flag icon). */
  flat?: boolean;
}

const TONES: Record<FlagKind, {
  card: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  defaultTitle: string;
  body: string;
  meta: string;
  metaVerb: string;
  inset: string;
  eyebrow: string;
  chip: string;
  buttonSolid: string;
  buttonOutline: string;
}> = {
  exception: {
    // Amber, the exception state's own color (user 9/22): red is
    // reserved for destructive actions system-wide.
    card: 'bg-amber-50 border-amber-200',
    icon: Flag,
    iconClass: 'text-amber-600',
    title: 'text-amber-900',
    defaultTitle: 'Exception Raised',
    body: 'text-amber-800/90',
    meta: 'text-amber-700/70',
    metaVerb: 'Flagged by',
    inset: 'bg-white/70 border-amber-200/80',
    eyebrow: 'text-amber-600/80',
    chip: 'bg-amber-100/80 text-amber-700 border-amber-200',
    buttonSolid: 'bg-amber-600 hover:bg-amber-700 text-white',
    buttonOutline: 'border border-amber-300 text-amber-700 hover:bg-amber-100/60 bg-white',
  },
  hold: {
    card: 'bg-amber-50 border-amber-200',
    icon: ShieldCheck,
    iconClass: 'text-amber-700',
    title: 'text-amber-900',
    defaultTitle: 'Payment Hold Active',
    body: 'text-amber-800/90',
    meta: 'text-amber-700/70',
    metaVerb: 'Placed by',
    inset: 'bg-white/70 border-amber-200/80',
    eyebrow: 'text-amber-600/80',
    chip: 'bg-amber-100/80 text-amber-700 border-amber-200',
    buttonSolid: 'bg-amber-600 hover:bg-amber-700 text-white',
    buttonOutline: 'border border-amber-300 text-amber-700 hover:bg-amber-100/60 bg-white',
  },
  resolved: {
    card: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    title: 'text-emerald-900',
    defaultTitle: 'Exception Resolved',
    body: 'text-emerald-800/90',
    meta: 'text-emerald-700/70',
    metaVerb: 'Resolved by',
    inset: 'bg-white/70 border-emerald-200/80',
    eyebrow: 'text-emerald-600/80',
    chip: 'bg-emerald-100/80 text-emerald-700 border-emerald-200',
    buttonSolid: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    buttonOutline: 'border border-emerald-300 text-emerald-700 hover:bg-emerald-100/60 bg-white',
  },
};

const fmtAt = (at?: string) => {
  if (!at) return '';
  const d = new Date(at);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

function AttachmentChips({ files, compact }: { files?: string[]; compact?: boolean }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {files.map((name, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200 text-slate-600 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          style={{ fontWeight: 500 }}
        >
          <Paperclip className="w-2.5 h-2.5 text-slate-400" />
          <span className={`truncate ${compact ? 'max-w-[130px]' : 'max-w-[170px]'}`}>{name}</span>
        </span>
      ))}
    </div>
  );
}

export function SubmittedFlagCard({
  kind,
  title,
  reason,
  typeLabels,
  description,
  by,
  at,
  attachments,
  footnote,
  resolution,
  actionLabel,
  onAction,
  actionVariant = 'solid',
  actionHint,
  compact = false,
  flat = false,
}: SubmittedFlagCardProps) {
  const tone = TONES[kind];
  const Icon = tone.icon;
  const textSm = compact ? 'text-[11px]' : 'text-[12px]';
  const textXs = compact ? 'text-[10px]' : 'text-[11px]';

  const metaName = kind === 'resolved' ? resolution?.by : by;
  const metaAt = kind === 'resolved' ? resolution?.at : at;

  // Flat mode drops the reason line when it only repeats the type chips
  // (user 9/22: "too much information") — the chips already say it.
  const reasonIsJustTypes =
    !!reason &&
    !!typeLabels?.length &&
    reason
      .split(/[,:]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .every((p) => typeLabels.some((l) => l.toLowerCase() === p.toLowerCase()));

  return (
    <div className={flat ? '' : `rounded-md border ${tone.card} ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
      <div className={flat ? '' : 'flex items-start gap-2'}>
        {!flat && <Icon className={`${compact ? 'w-3.5 h-3.5 mt-0.5' : 'w-4 h-4 mt-0.5'} ${tone.iconClass} shrink-0`} />}
        <div className="min-w-0 flex-1">
          {/* Flat mode: the type chips ARE the heading (user 9/22) — a
              custom title still renders when a host supplies one. */}
          {(!flat || !typeLabels?.length || title) && (
            <p className={`${textSm} ${flat ? 'text-foreground' : tone.title}`} style={{ fontWeight: 600 }}>
              {title ?? tone.defaultTitle}
            </p>
          )}

          {typeLabels && typeLabels.length > 0 && (
            <div className={`flex flex-wrap gap-1 ${flat && !title ? '' : 'mt-1.5'}`}>
              {typeLabels.map((label) => (
                <span
                  key={label}
                  // Flat chips wear a quiet grey tint (user 9/22: "those
                  // pills should be grey or use light tint") — the amber
                  // identity stays on the section icon and CTA.
                  className={`inline-flex items-center px-1.5 py-0.5 rounded border ${flat ? 'bg-slate-100/80 text-slate-600 border-slate-200/70' : tone.chip} ${textXs}`}
                  style={{ fontWeight: flat ? 500 : 600 }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Card mode keeps the labeled reason box (Eli 9/8); flat mode
              reads as plain text in neutral ink (user 9/22: less color,
              text stays black and grey) and skips it when it only
              repeats the chips. */}
          {/* No green strike-through on the resolved reason (Nophil 9/28):
              the card's Resolved identity already tells the story — the
              original reason stays legible in muted ink. */}
          {reason && (flat ? (
            reasonIsJustTypes ? null : (
            <p className={`${textSm} mt-1.5 ${kind === 'resolved' && resolution ? 'text-slate-400' : 'text-slate-700'}`}>
              {reason}
            </p>
            )
          ) : (
            <div className={`mt-1.5 rounded border ${tone.inset} ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
              <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} ${tone.eyebrow}`} style={{ fontWeight: 600 }}>
                Reason
              </p>
              <p className={`${textSm} ${tone.body} mt-0.5`}>
                {reason}
              </p>
            </div>
          ))}

          {description && description !== reason && (flat ? (
            <p className={`${textSm} text-slate-500 mt-1`}>{description}</p>
          ) : (
            <div className={`mt-1.5 rounded border ${tone.inset} ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
              <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} ${tone.eyebrow}`} style={{ fontWeight: 600 }}>
                Description
              </p>
              <p className={`${textSm} ${tone.body} mt-0.5`}>{description}</p>
            </div>
          ))}

          {kind === 'resolved' && resolution?.reason && (
            <p className={`${textSm} ${flat ? 'text-slate-700' : tone.body} mt-1.5`}>{resolution.reason}</p>
          )}

          {/* Who and when — with the person's real avatar (people avatar
              standard 8/7; user 9/22). Flat mode separates the record's
              meta from its content with a hairline (user 9/22) and the
              consequence line rides under the meta, never under the CTA. */}
          {flat ? (
            (metaName || footnote) && (
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                {metaName && (
                  <span className="flex items-center gap-1.5">
                    <PhotoPersonAvatar name={metaName} size="xs" />
                    <span className={`${textXs} text-slate-500`} style={{ fontWeight: 500 }}>
                      {tone.metaVerb} <span className="text-slate-700" style={{ fontWeight: 600 }}>{metaName}</span>
                      {metaAt ? ` · ${fmtAt(metaAt)}` : ''}
                    </span>
                  </span>
                )}
                {footnote && (
                  <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-400 ${metaName ? 'mt-1' : ''}`}>{footnote}</p>
                )}
              </div>
            )
          ) : (
            metaName && (
              <p className={`${textXs} ${tone.meta} mt-1.5`} style={{ fontWeight: 500 }}>
                {tone.metaVerb} {metaName}
                {metaAt ? ` · ${fmtAt(metaAt)}` : ''}
              </p>
            )
          )}

          <AttachmentChips files={kind === 'resolved' ? resolution?.attachments ?? attachments : attachments} compact={compact} />

          {!flat && footnote && (
            <p className={`${textXs} ${tone.meta} mt-1.5`}>{footnote}</p>
          )}

          {onAction && actionLabel && (
            <>
              <button
                type="button"
                onClick={onAction}
                className={`w-full mt-2.5 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  actionVariant === 'solid' ? tone.buttonSolid : tone.buttonOutline
                } ${compact ? 'h-7 text-[11px]' : 'h-8 text-[12px]'}`}
                style={{ fontWeight: 600 }}
              >
                {actionLabel}
              </button>
              {/* No copy under the CTA in flat mode (user 9/22): the
                  button says what it does. */}
              {actionHint && !flat && (
                <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} ${tone.meta} mt-1 text-center`}>{actionHint}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
