/**
 * Sidebar primitives — ported from Purchase Order's `POSidebarSections.tsx`.
 *
 * Every primitive in this file is a near-verbatim port of PO's sidebar
 * components so the Quote / SO detail sidebars read as part of the same
 * surface system. The container chrome itself ultimately traces back to
 * Partner Management's `DashInfoCard` (PO already ports it; we re-port
 * here so Quote/SO get the same recipe without taking a hard dependency
 * on the PO module).
 *
 * Notable deviation from PO: this module uses ALWAYS-VISIBLE subtle
 * pencils (`text-muted-foreground/60 hover:text-primary`) on every
 * editable section header. PO's pencils are hover-only — we drop that
 * pattern because the user has been explicit that affordances should
 * read at rest, not on hover-to-discover.
 */
import React, { useState } from 'react';
import { PrimaryPill } from '@/app/components/external/partners/PrimaryPill';
import {
  AlertCircle, Building2, ChevronDown, Clock, CreditCard, Eye, EyeOff,
  FileText, Hash, Info, MapPin, Pencil, Percent, Phone, Receipt,
  SquareSplitHorizontal, Star, User, Users, WalletMinimal, Mail,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { FIELD_ERROR_STYLE, FieldErrorText, FieldLaterHint } from '@/app/components/shared/fieldRequirements';

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ── Avatar background / text colour tokens — PO uses CSS variables;
   we fall back to a deterministic 7-colour palette so the chips read
   identically regardless of whether the host theme defines those vars. */
const AVATAR_BG_COLORS = [
  '#EFF6FF', '#F5F3FF', '#ECFDF5', '#FEF3C7', '#FCE7F3', '#E0E7FF', '#FFF7ED',
];
const AVATAR_TEXT_COLORS = [
  '#1E40AF', '#6D28D9', '#065F46', '#92400E', '#9D174D', '#3730A3', '#9A3412',
];

/* ── PartnerLogo deterministic palette — verbatim port of PO's
   `LOGO_COLOR_PALETTE`. Same name → same colour across sessions. */
const LOGO_COLOR_PALETTE = [
  '#1E293B', '#8B5CF6', '#0A77FF', '#10B981',
  '#F59E0B', '#EC4899', '#0891B2', '#65A30D',
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

export function getLogoColor(seed: string): string {
  return LOGO_COLOR_PALETTE[hashSeed(seed) % LOGO_COLOR_PALETTE.length];
}

export function getInitials(name: string | null | undefined): string {
  return (name || '').split(/[\s&]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ─────────────────────────────────────────────────────────────
   EmptyValueRow: the one empty state every sidebar card uses when
   its value is not on file (dashed icon tile + muted label), taken
   from LocationCard's original empty branch. `hint` is the muted
   "needed later" line from the field rules.
   ────────────────────────────────────────────────────────────── */
export function EmptyValueRow({ icon: Icon, label, hint }: {
  icon: React.ElementType;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div
          className="rounded-md flex items-center justify-center shrink-0"
          style={{ width: 26, height: 26, backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1' }}
        >
          <Icon className="w-3 h-3" style={{ color: '#CBD5E1' }} strokeWidth={2} />
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', fontFamily: FONT }}>{label}</p>
      </div>
      {hint && <FieldLaterHint>{hint}</FieldLaterHint>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CollapsibleSection — outer card.
   Mirrors PO `POSidebarSections.tsx:196-241` line-for-line.
   ────────────────────────────────────────────────────────────── */
export function CollapsibleSection({
  icon: Icon, title, badge, action, children, defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  /** Optional action node (typically a Pencil) rendered to the right of
   *  the title. Hidden by default; revealed on section-header hover via
   *  the `group` class on the trigger button. Click handler should
   *  `stopPropagation` so it doesn't toggle the section open/closed. */
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="group w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
            style={{ borderBottom: open ? '1px solid #F1F5F9' : 'none' }}
          >
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3 h-3 text-primary" />
            </div>
            <span className="text-slate-700 text-left" style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
              {title}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {badge}
              {action}
              <ChevronDown
                className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Subtle Pencil button for section headers. Hidden by default and
 *  revealed on hover of the surrounding `group` (the CollapsibleSection
 *  trigger). Stops propagation so the section's collapse trigger doesn't
 *  fire. Matches the pattern used across Purchase Order's sidebar. */
export function HeaderEditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="size-5 inline-flex items-center justify-center rounded text-muted-foreground/60 hover:text-primary hover:bg-slate-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
      title={label}
      aria-label={label}
    >
      <Pencil className="size-3" />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   InnerAccordion — collapsible sub-section inside a card.
   Mirrors PO `POSidebarSections.tsx:263-299`. The optional `action`
   slot (typically a Pencil) is hidden by default and revealed on
   hover of the accordion header via the `group` class on the button.
   ────────────────────────────────────────────────────────────── */
export function InnerAccordion({
  title, defaultOpen = false, action, children,
}: {
  title: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-muted">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group w-full py-2.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span
          className="text-slate-700 uppercase"
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', fontFamily: FONT }}
        >
          {title}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {action}
          <ChevronDown
            className="w-3 h-3 text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </span>
      </button>
      {open && <div className="pb-3 -mt-0.5">{children}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PartnerLogo — hash-coloured square avatar.
   Verbatim port of PO `POSidebarSections.tsx:985-1004`.
   ────────────────────────────────────────────────────────────── */
export function PartnerLogo({ abbr, size = 36 }: { abbr: string; size?: number }) {
  const text = abbr.toUpperCase().slice(0, 2);
  const color = getLogoColor(text);
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white shrink-0"
      style={{
        width: size, height: size, backgroundColor: color,
        fontWeight: 700, fontSize: Math.round(size * 0.3), fontFamily: FONT, lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   LocationCard — Ship To / Bill To / Pay From card.
   Verbatim port of PO `POSidebarSections.tsx:823-958`.
   The pencil pattern was flipped to always-visible (subtle) per
   the suite's "no hover-to-discover" rule.
   ────────────────────────────────────────────────────────────── */
export function LocationCard({
  label, icon: Icon, tooltip, info, canEdit, onEdit, emptyLabel, showAddress = false,
  hint, error, dataField,
}: {
  label: string;
  icon: React.ElementType;
  tooltip: string;
  info: { displayName: string; locationName?: string; address: string; abbr: string };
  canEdit: boolean;
  onEdit?: () => void;
  emptyLabel: string;
  showAddress?: boolean;
  /** Muted "needed later" line under the empty state. */
  hint?: string;
  /** Blocking message: red outline + helper text (field rules). */
  error?: string;
  /** `data-field` key so focusFirstMissing can scroll here. */
  dataField?: string;
}) {
  const hasValue = info.displayName && info.displayName !== 'Not Set';
  const addressLines = info.address.split('\n').map(l => l.trim()).filter(Boolean);
  const addressOneLine = addressLines.join(', ');
  const handleClick = canEdit && onEdit ? onEdit : undefined;
  return (
    <div data-field={dataField}>
    <div
      onClick={handleClick}
      aria-invalid={!!error || undefined}
      className={`group relative rounded-xl border bg-white transition-all duration-200 ${
        handleClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]' : ''
      }`}
      style={{ borderColor: '#E8ECF1', padding: 12, ...(error ? FIELD_ERROR_STYLE : null) }}
    >
      {/* Header — small icon + label + Info tooltip + always-visible Pencil */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
          <span className="text-slate-500" style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}>
            {label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center cursor-help shrink-0"
                aria-label={`${label} info`}
              >
                <Info className="w-3 h-3" style={{ color: '#CBD5E1' }} strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-[240px]">
              <span style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.5 }}>{tooltip}</span>
            </TooltipContent>
          </Tooltip>
        </div>
        {canEdit && onEdit && (
          <Pencil className="w-3 h-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
        )}
      </div>

      {/* Body */}
      <div className="mt-2.5">
        {hasValue ? (
          <div className={`flex ${showAddress ? 'items-start' : 'items-center'} gap-2.5`}>
            <PartnerLogo abbr={info.abbr || info.displayName.charAt(0)} size={26} />
            <div className="min-w-0 flex-1">
              <p
                className="text-foreground truncate"
                style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
                title={info.displayName}
              >
                {info.displayName}
              </p>
              {showAddress && addressOneLine && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOneLine)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-start gap-1 mt-1 text-slate-500 hover:text-primary hover:underline transition-colors"
                  style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.45, fontFamily: FONT }}
                >
                  <MapPin
                    className="w-3 h-3 shrink-0"
                    style={{ marginTop: 2, color: '#94A3B8' }}
                    strokeWidth={2}
                  />
                  <span className="break-words">{addressOneLine}</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <EmptyValueRow icon={Icon} label={emptyLabel} hint={error ? undefined : hint} />
        )}
      </div>
    </div>
    {error && <FieldErrorText>{error}</FieldErrorText>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ContactInfoRow — Phone / Mail row inside a Primary Contact card.
   Verbatim port of PO `POSidebarSections.tsx:1578-1621`, with the
   browser `title` tooltip dropped and an explicit `min-w-0 flex-1`
   on the value span so the `truncate` actually fires inside a 300px
   sidebar column. Without `min-w-0`, the flex item defaults to
   `min-width: auto` which prevents shrinkage and lets the email
   overflow its container instead of clipping with an ellipsis.
   ────────────────────────────────────────────────────────────── */
export function ContactInfoRow({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg cursor-pointer transition-all min-w-0"
      style={{
        padding: '6px 10px',
        backgroundColor: hovered ? 'var(--accent)' : '#F8FAFC',
        border: `1px solid ${hovered ? '#DBEAFE' : 'var(--muted)'}`,
        transitionDuration: '150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon
        className="shrink-0 transition-colors"
        style={{ width: 12, height: 12, color: hovered ? 'var(--primary)' : '#B0BEC5' }}
        strokeWidth={2}
      />
      <span
        className="text-muted-foreground truncate min-w-0 flex-1"
        style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SecondaryContactsToggle — "+N more" expandable list.
   Verbatim port of PO `POSidebarSections.tsx:1627-1690`.
   ────────────────────────────────────────────────────────────── */
export function SecondaryContactsToggle({
  contacts,
  nounSingular = 'contact',
  nounPlural = 'contacts',
}: {
  contacts: { name: string; role?: string }[];
  /* Noun used in the toggle label so the same primitive reads correctly
     when reused for non-PoC lists (e.g. "Show 2 secondary sales
     representatives" on the Sales Rep card). */
  nounSingular?: string;
  nounPlural?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (contacts.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT }}
      >
        <ChevronDown
          className="size-3 transition-transform"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
        {expanded ? 'Hide' : 'Show'} {contacts.length} secondary {contacts.length !== 1 ? nounPlural : nounSingular}
      </button>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1 pl-4">
          {contacts.map((c, idx) => (
            <div key={`${c.name}-${idx}`} className="flex items-center gap-1.5 min-w-0">
              <div
                className="flex items-center justify-center size-4 rounded-full shrink-0"
                style={{ backgroundColor: AVATAR_BG_COLORS[(idx + 1) % AVATAR_BG_COLORS.length] }}
              >
                <span
                  style={{
                    fontSize: 7, fontWeight: 700, fontFamily: FONT,
                    color: AVATAR_TEXT_COLORS[(idx + 1) % AVATAR_TEXT_COLORS.length],
                  }}
                >
                  {getInitials(c.name)}
                </span>
              </div>
              <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                <span
                  className="text-foreground truncate"
                  style={{ fontSize: 11.5, fontWeight: 500, fontFamily: FONT }}
                >
                  {c.name}
                </span>
                {c.role && (
                  <span
                    className="text-muted-foreground/70 truncate"
                    style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT }}
                  >
                    {c.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PaymentDataRow — sensitive-data row inside PaymentMethodCard.
   Verbatim port of PO `POSidebarSections.tsx:1534-1566`.
   ────────────────────────────────────────────────────────────── */
function PaymentDataRow({
  icon: Icon, label, value, tabularNums = false, trailing,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tabularNums?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
      <span className="text-slate-500 shrink-0" style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}>
        {label}
      </span>
      <span
        className={`text-foreground truncate ml-auto ${tabularNums ? 'tabular-nums' : ''}`}
        style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4 }}
        title={value}
      >
        {value}
      </span>
      {trailing}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PaymentTermCard — full PO chrome with NET/Pre/Split pill.
   Verbatim port of PO `POSidebarSections.tsx:1026-1157`.
   ────────────────────────────────────────────────────────────── */
export function PaymentTermCard({
  term, onClick, emptyLabel,
}: {
  term: {
    name: string;
    type: 'NET' | 'Pre' | 'Split';
    triggerEvent: string;
    description?: string;
    vendorsApplied?: number;
  };
  onClick?: () => void;
  /** Shown instead of the card body when `term.name` is empty. */
  emptyLabel?: string;
}) {
  if (!term.name && emptyLabel) {
    return (
      <div
        onClick={onClick}
        className={`group bg-white rounded-xl border transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}`}
        style={{ borderColor: '#E8ECF1', padding: 12 }}
      >
        <EmptyValueRow icon={Receipt} label={emptyLabel} />
      </div>
    );
  }
  const netMatch = (term.name || '').match(/net\s+(\d+)/i);
  const ptDays = netMatch?.[1] || (term.name || '').match(/\d+/)?.[0] || '30';
  const pill =
    term.type === 'NET'
      ? { text: '#0A77FF', bg: '#EFF6FF', border: '#DBEAFE', Icon: Receipt }
      : term.type === 'Pre'
        ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE', Icon: Clock }
        : { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A', Icon: SquareSplitHorizontal };

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl border transition-all duration-200 flex flex-col relative ${
        onClick ? 'cursor-pointer hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]' : ''
      }`}
      style={{ borderColor: '#E8ECF1', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', padding: 12 }}
    >
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <span
          className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0 max-w-full"
          style={{ borderColor: pill.border }}
        >
          <span
            className="inline-flex items-center gap-1 px-2 py-[2px]"
            style={{ fontSize: 10, fontWeight: 600, color: pill.text, backgroundColor: pill.bg, fontFamily: FONT, lineHeight: 1.4 }}
          >
            <pill.Icon className="w-3 h-3" strokeWidth={2} />
            {term.type}
          </span>
          <span
            className="inline-flex items-center px-2 py-[2px] bg-white text-slate-500 border-l max-w-[160px]"
            style={{ fontSize: 10, fontWeight: 500, borderColor: pill.border, fontFamily: FONT, lineHeight: 1.4 }}
          >
            <span className="truncate">{term.triggerEvent}</span>
          </span>
        </span>
        {onClick && <Pencil className="w-3 h-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />}
      </div>
      <div className="shrink-0 mb-1">
        <p
          className="text-foreground truncate"
          style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
          title={term.name}
        >
          {term.name}
        </p>
      </div>
      {term.description && (
        <div className="shrink-0 mb-2">
          <p
            className="text-slate-500 line-clamp-2"
            style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.5 }}
          >
            {term.description}
          </p>
        </div>
      )}
      <div className="flex items-baseline justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-foreground tabular-nums tracking-tight"
            style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, fontFamily: FONT }}
          >
            {ptDays}
          </span>
          <span className="text-slate-400" style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT, lineHeight: 1 }}>
            days
          </span>
        </div>
        {typeof term.vendorsApplied === 'number' && (
          <span
            className="inline-flex items-center gap-1 text-slate-400 tabular-nums"
            style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1 }}
          >
            <Building2 className="w-3 h-3" strokeWidth={2} />
            {term.vendorsApplied} in use
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PaymentMethodCard — full PO chrome: category icon chip, Primary
   star pill, IBAN reveal, contact / phone rows, discount strip.
   Verbatim port of PO `POSidebarSections.tsx:1218-1527`.
   ────────────────────────────────────────────────────────────── */
type PaymentMethodType = 'Wire Transfer' | 'ACH' | 'Check' | 'Credit Card';

const PAYMENT_METHOD_CAT: Record<PaymentMethodType, { category: string; color: string; bg: string; Icon: React.ElementType }> = {
  'Wire Transfer': { category: 'Bank', color: 'var(--primary)', bg: '#EFF6FF', Icon: Building2 },
  ACH: { category: 'Bank', color: 'var(--primary)', bg: '#EFF6FF', Icon: Building2 },
  Check: { category: 'Traditional', color: '#6D28D9', bg: '#F0EBFF', Icon: FileText },
  'Credit Card': { category: 'Card', color: '#B45309', bg: '#FEF3C7', Icon: CreditCard },
};

export function PaymentMethodCard({
  method, fallbackName, onClick, emptyLabel,
}: {
  method: {
    type?: PaymentMethodType;
    bankName?: string;
    iban?: string;
    contactName?: string;
    contactPhone?: string;
    isDefault?: boolean;
    order?: number;
    referenceNote?: string;
    discountPct?: number;
    additionalChargesPct?: number;
  } | null;
  fallbackName?: string;
  onClick?: () => void;
  /** Shown instead of the card body when there is no method. */
  emptyLabel?: string;
}) {
  const [revealIban, setRevealIban] = useState(false);
  if (!method && emptyLabel) {
    return (
      <div
        onClick={onClick}
        className={`group bg-white rounded-xl border transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}`}
        style={{ borderColor: '#E8ECF1', padding: 12 }}
      >
        <EmptyValueRow icon={WalletMinimal} label={emptyLabel} />
      </div>
    );
  }
  const type = method?.type ?? null;
  const palette = type
    ? PAYMENT_METHOD_CAT[type]
    : { category: 'Other', color: '#64748B', bg: '#F1F5F9', Icon: WalletMinimal };
  const isDefault = !!method?.isDefault;
  const displayName = method?.bankName ?? fallbackName ?? '—';
  const typeLabel = method?.type ?? 'Payment Method';
  const ibanRaw = method?.iban ?? '';
  const ibanCompact = ibanRaw.replace(/\s+/g, '');
  const last4 = ibanCompact ? ibanCompact.slice(-4) : '';
  const ibanDisplay = revealIban ? ibanRaw : (last4 ? `••••${last4}` : '');
  const hasDetails = method && (ibanDisplay || method.contactName || method.contactPhone);
  const hasFinance = method && ((method.discountPct ?? 0) > 0 || (method.additionalChargesPct ?? 0) > 0);

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl transition-all duration-200 flex flex-col relative ${onClick ? 'cursor-pointer' : ''} ${
        isDefault
          ? 'border-[1.5px] hover:shadow-[0_4px_20px_-4px_rgba(10,119,255,0.18)]'
          : 'border hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
      }`}
      style={{
        borderColor: isDefault ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : '#E8ECF1',
        boxShadow: isDefault ? '0 2px 12px -4px rgba(10,119,255,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
        padding: 12,
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="rounded-lg flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, backgroundColor: palette.bg }}
            >
              <palette.Icon className="w-3.5 h-3.5" style={{ color: palette.color }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p
                  className="text-foreground truncate"
                  style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
                  title={displayName}
                >
                  {displayName}
                </p>
                {method?.order != null && method.order > 0 && (
                  <span
                    className="inline-flex items-center rounded shrink-0 tabular-nums"
                    style={{
                      padding: '0 4px', fontSize: 9, fontWeight: 600,
                      color: '#64748B', backgroundColor: '#F1F5F9',
                      fontFamily: FONT, lineHeight: 1.5,
                    }}
                    title={`Order #${method.order}`}
                  >
                    #{method.order}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center rounded-full"
                  style={{
                    padding: '1px 6px', fontSize: 9, fontWeight: 600,
                    color: palette.color, backgroundColor: palette.bg,
                    fontFamily: FONT, lineHeight: 1.5,
                  }}
                >
                  {typeLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Partners' canonical Primary pill. */}
            {isDefault && <PrimaryPill />}
            {onClick && <Pencil className="w-3 h-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />}
          </div>
        </div>

        {hasDetails && (
          <div
            className="flex flex-col gap-[5px]"
            style={{
              padding: '6px 8px', borderRadius: 8,
              backgroundColor: '#FAFBFC', border: '1px solid var(--muted)',
            }}
          >
            {ibanDisplay && (
              <PaymentDataRow
                icon={Hash}
                label="IBAN"
                value={ibanDisplay}
                tabularNums
                trailing={
                  ibanCompact ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setRevealIban(v => !v); }}
                      className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      style={{ width: 16, height: 16, color: revealIban ? 'var(--primary)' : '#94A3B8' }}
                      aria-label={revealIban ? 'Hide IBAN' : 'Reveal IBAN'}
                      title={revealIban ? 'Hide IBAN' : 'Reveal IBAN'}
                    >
                      {revealIban ? <EyeOff className="w-2.5 h-2.5" strokeWidth={2} /> : <Eye className="w-2.5 h-2.5" strokeWidth={2} />}
                    </button>
                  ) : null
                }
              />
            )}
            {method?.contactName && <PaymentDataRow icon={User} label="Contact" value={method.contactName} />}
            {method?.contactPhone && <PaymentDataRow icon={Phone} label="Phone" value={method.contactPhone} />}
          </div>
        )}

        {method?.referenceNote && (
          <div
            className="flex items-start gap-1.5"
            style={{
              padding: '6px 8px', borderRadius: 8,
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
            }}
          >
            <AlertCircle className="shrink-0" style={{ width: 11, height: 11, color: '#B45309', marginTop: 1 }} strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p
                className="text-amber-900"
                style={{
                  fontSize: 9.5, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1,
                }}
              >
                Reference Note
              </p>
              <p className="text-slate-700" style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.45 }}>
                {method.referenceNote}
              </p>
            </div>
          </div>
        )}

        {hasFinance && (
          <div
            className="flex items-center gap-2 flex-wrap"
            style={{
              padding: '4px 8px', borderRadius: 6,
              backgroundColor: '#FAFBFC', border: '1px solid var(--muted)',
            }}
          >
            {(method!.discountPct ?? 0) > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <Percent className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--success)' }} strokeWidth={2} />
                <span className="text-slate-500" style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}>
                  Early-pay discount
                </span>
                <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4, color: 'var(--success)' }}>
                  {method!.discountPct}%
                </span>
              </div>
            )}
            {(method!.discountPct ?? 0) > 0 && (method!.additionalChargesPct ?? 0) > 0 && (
              <span className="text-slate-300" style={{ fontSize: 10 }}>|</span>
            )}
            {(method!.additionalChargesPct ?? 0) > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <Percent className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--warning)' }} strokeWidth={2} />
                <span className="text-slate-500" style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}>
                  Surcharge
                </span>
                <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4, color: 'var(--warning)' }}>
                  {method!.additionalChargesPct}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PrimaryContactCard — verbatim port of PO `POSidebarSections.tsx:509-621`.
   Renders as bare content (no wrapping border / box) so it can sit
   cleanly inside the `Contact` InnerAccordion just like PO does.
     · 40×40 rounded-xl violet-gradient avatar with violet-700 initials
       (the canonical "contact" semantic — keeps the PoC chip visually
       distinct from the primary-blue customer chip at the top of the
       card).
     · 14×14 emerald-500 online dot anchored bottom-right with a 2px
       white ring.
     · Name 12/600 slate-700 + 12×12 blue Star (Primary marker).
     · Role 10/400 slate-500 below the name.
     · Optional `onEdit` renders an always-visible subtle Pencil on the
       right edge of the row (deviates from PO's hover-only pattern per
       the suite's no-hover-to-discover rule).
     · Phone / email rows below render as `ContactInfoRow` pills.
   ────────────────────────────────────────────────────────────── */
export function PrimaryContactCard({
  name, role, phone, email, onEdit, emptyLabel,
}: {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  onEdit?: () => void;
  /** Shown when `name` is empty (no contact on file). The edit
   *  affordance stays visible so the empty state is actionable. */
  emptyLabel?: string;
}) {
  if (!name && emptyLabel) {
    /* Same bordered empty card as payment terms / method (and the
       Quotes module's primary contact), so every empty sidebar value
       reads the same way. */
    return (
      <div
        onClick={onEdit}
        className={`group bg-white rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 ${onEdit ? 'cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]' : ''}`}
        style={{ borderColor: '#E8ECF1', padding: 12 }}
      >
        <EmptyValueRow icon={User} label={emptyLabel} />
        {onEdit && <Pencil className="w-3 h-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />}
      </div>
    );
  }
  const initials = getInitials(name);
  return (
    <div className="group flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #F0EBFF 0%, #E9DFFF 100%)',
              color: '#6D28D9',
              fontSize: 12, fontWeight: 700, fontFamily: FONT,
            }}
          >
            {initials}
          </div>
          <div
            className="absolute w-3.5 h-3.5 rounded-full"
            style={{ bottom: -2, right: -2, backgroundColor: '#10B981', border: '2px solid #FFFFFF' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className="text-slate-700 truncate"
              style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
              title={name}
            >
              {name}
            </p>
            <Star
              className="shrink-0 fill-blue-800 text-blue-800"
              style={{ width: 12, height: 12 }}
              aria-label="Primary contact"
            />
          </div>
          {role && (
            <p
              className="text-slate-500 truncate"
              style={{ fontSize: 10, fontWeight: 400, fontFamily: FONT, lineHeight: 1.4, marginTop: 2 }}
            >
              {role}
            </p>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="size-6 inline-flex items-center justify-center rounded text-muted-foreground/60 hover:text-primary hover:bg-slate-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
            title="Edit primary contact"
            aria-label="Edit primary contact"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      {(phone || email) && (
        <div className="flex flex-col gap-1.5">
          {phone && <ContactInfoRow icon={Phone} value={phone} />}
          {email && <ContactInfoRow icon={Mail} value={email} />}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CustomerIdentityRow — PO's "hero" row at the top of the
   `Vendor Information` card (PO `POSidebarSections.tsx:440-483`).
   40×40 rounded-xl primary-blue gradient avatar + customer name
   13/600 + summary line "N contacts · N locations · Net 30".
   Used as the always-visible head of the Customer Information card,
   above the four InnerAccordions.
   ────────────────────────────────────────────────────────────── */
export interface CustomerIdentityHoverInfo {
  /** Customer-level phone. Falls back to a derived corporate line
   *  (see `RightSidebar` / `SOSidebar`) when the underlying record
   *  does not carry one. */
  phone?: string;
  /** Customer-level email (`info@slug.com` shape when derived). */
  email?: string;
  /** Total contacts on record for this customer. */
  contactsCount?: number;
  /** Total addresses / locations on record for this customer. */
  locationsCount?: number;
  /** Optional badge / subtitle under the customer name in the dark
   *  gradient header (e.g. industry or customer type). */
  subtitle?: string;
}

export function CustomerIdentityRow({
  name, summary, onEdit, hoverInfo,
}: {
  name: string;
  summary: string;
  onEdit?: () => void;
  /** When provided, the initials avatar becomes a hover trigger that
   *  reveals a Partner-Management-style customer preview card. */
  hoverInfo?: CustomerIdentityHoverInfo;
}) {
  const initials = getInitials(name);
  /* Initials avatar — trigger for the hover card when hoverInfo is
     supplied. Otherwise renders as a plain decorative tile. */
  const avatar = (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: 'linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)',
        color: 'var(--primary)',
        fontSize: 12, fontWeight: 700, fontFamily: FONT,
        cursor: hoverInfo ? 'default' : undefined,
      }}
    >
      {initials}
    </div>
  );
  return (
    <div className="group flex items-center gap-3">
      {hoverInfo ? (
        <HoverCard openDelay={200} closeDelay={80}>
          <HoverCardTrigger asChild>{avatar}</HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
          >
            {/* Dark gradient header — mirrors Partner Management's
                location hover card (`PartnerGroupDetailModal.tsx`).
                Initials tile matches the sidebar hero avatar so the
                trigger reads as a zoomed preview, not a different
                component. */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
              <div className="flex items-center gap-3 relative">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)',
                    color: 'var(--primary)',
                    fontSize: 11, fontWeight: 700, fontFamily: FONT,
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }} title={name}>{name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{hoverInfo.subtitle || 'Customer'}</p>
                </div>
              </div>
            </div>
            <div className="bg-white px-3.5 py-3 space-y-2">
              {hoverInfo.phone && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate" title={hoverInfo.phone}>{hoverInfo.phone}</span>
                </div>
              )}
              {hoverInfo.email && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate" title={hoverInfo.email}>{hoverInfo.email}</span>
                </div>
              )}
              {hoverInfo.locationsCount != null && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{hoverInfo.locationsCount} location{hoverInfo.locationsCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {hoverInfo.contactsCount != null && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{hoverInfo.contactsCount} contact{hoverInfo.contactsCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : avatar}
      <div className="min-w-0 flex-1">
        <p
          className="text-foreground truncate"
          style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.3 }}
          title={name}
        >
          {name}
        </p>
        <p
          className="text-slate-500 truncate"
          style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.4, marginTop: 2 }}
          title={summary}
        >
          {summary}
        </p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="size-6 inline-flex items-center justify-center rounded text-muted-foreground/60 hover:text-primary hover:bg-slate-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
          title="Edit customer"
          aria-label="Edit customer"
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  );
}
