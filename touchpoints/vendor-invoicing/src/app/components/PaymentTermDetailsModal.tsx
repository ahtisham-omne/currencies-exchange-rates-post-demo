import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  X,
  Pencil,
  Archive,
  ArchiveRestore,
  Ban,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Lock,
  Info,
  Receipt,
  Clock,
  CalendarDays,
  SquareSplitHorizontal,
  Banknote,
  ArrowUpDown,
  CircleSlash,
  CircleCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/app/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { resolvePaymentTerm, SPLIT_TERM_SLICES, type PaymentTermPreset } from '@/app/data/paymentTermPresets';
import {
  addRuntimeTerm,
  findRuntimeTerm,
  setTermStatus,
  useTermStatuses,
} from '@/app/data/customTermsStore';
import { CreatePaymentTermModal } from '@/app/components/CreatePaymentTermModal';

/* ── Payment term details modal (9/1/26, partner 1:1 port) ────────────
 * The partner module's PaymentTermDetailModal ported for vendor
 * invoicing: same stable 70vw × 88vh frame with fullscreen toggle,
 * hero header (back arrow, themed term tile, segmented type+trigger
 * pill, status + template markers, header actions), white tab bar, and
 * the Overview tab's create-form layout. System templates stay fully
 * read-only (disabled actions with tooltips); CUSTOM terms carry the
 * partner behavior — Edit unlocks the fields with a save bar (first
 * edit confirms a new version), Archive and Disable run the gradient
 * lifecycle confirms against the runtime status store. Duplicate seeds
 * the Create Payment Term modal from any kind. The data tabs point back
 * to the partner profile, and the footer primary is "Apply to invoice"
 * when opened from the browse modal. */

const PT_DETAIL_TABS = [
  { id: 'setup', label: 'Overview' },
  { id: 'vendors', label: 'Partners' },
  { id: 'chat', label: 'Chat' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'activity', label: 'Recent Activity' },
] as const;

/* Locked per-category palette (partner recipe) — NET = blue,
 * Pre = violet, Split = orange. Explicit hex so CSS variable format
 * differences between the repos can't silently break the tint. */
const PT_TYPE_TILES = [
  {
    id: 'net' as const,
    label: 'NET Terms',
    desc: 'Pay after X days',
    icon: Clock,
    accent: '#0A77FF',
    bg: '#EBF3FF',
    borderHex: '#7AB8FF',
    activeBorderClass: 'border-[#7AB8FF]/70',
    circleBg: '#0A77FF',
    circleShadow: 'rgba(59,130,246,0.15)',
  },
  {
    id: 'prepayment' as const,
    label: 'Prepayment',
    desc: 'Pay before receiving',
    icon: Banknote,
    accent: '#7C3AED',
    bg: '#F5F3FF',
    borderHex: '#C4B5FD',
    activeBorderClass: 'border-[#C4B5FD]/70',
    circleBg: '#8B5CF6',
    circleShadow: 'rgba(139,92,246,0.15)',
  },
  {
    id: 'split' as const,
    label: 'Split Payment',
    desc: 'Multiple installments',
    icon: ArrowUpDown,
    accent: '#D97706',
    bg: '#FFFBEB',
    borderHex: '#FCD34D',
    activeBorderClass: 'border-[#FCD34D]/70',
    circleBg: '#F59E0B',
    circleShadow: 'rgba(245,158,11,0.15)',
  },
];

/* Fallback for split terms without a SPLIT_TERM_SLICES entry — parse
 * "30% is due at production start, 70% at delivery" style descriptions
 * into milestone rows (partner helper, trimmed). */
function parseSplitMilestones(description: string): { pct: string; label: string }[] {
  if (!description) return [];
  const re = /(\d+)%\s+(?:is\s+)?(?:due\s+)?(?:at\s+|on\s+|upon\s+)?([^,.;]+)/gi;
  const out: { pct: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(description)) !== null) {
    const rawLabel = m[2].trim();
    if (!rawLabel) continue;
    const label = rawLabel
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');
    out.push({ pct: m[1], label });
  }
  return out;
}

export function PaymentTermDetailsModal({
  termLabel,
  onClose,
  onApply,
  term: termOverride,
}: {
  termLabel: string;
  onClose: () => void;
  /** Browse-modal context: renders an "Apply to invoice" primary. */
  onApply?: () => void;
  /** Opt-in: a term from another catalog (Customer Invoicing). Vendor
   *  callers omit it and keep resolving by label. */
  term?: PaymentTermPreset;
}) {
  const term = termOverride ?? findRuntimeTerm(termLabel) ?? resolvePaymentTerm(termLabel);
  const [tab, setTab] = useState<(typeof PT_DETAIL_TABS)[number]['id']>('setup');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  // Lifecycle confirms — one centered gradient AlertDialog at a time.
  const [pendingAction, setPendingAction] = useState<'disable' | 'enable' | 'archive' | 'restore' | null>(null);
  const statuses = useTermStatuses();

  const ptDuration = term.duration || (term.name.match(/\d+/)?.[0] ?? '30');
  const isCustom = term.id.startsWith('pt-custom-');
  const isPreset = !isCustom;
  // Preset templates are always active; custom terms can be disabled or
  // archived via the runtime status store.
  const runtimeStatus = isPreset ? 'active' : (statuses[term.id] ?? 'active');
  const statusBadge =
    runtimeStatus === 'inactive'
      ? { label: 'Inactive', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' }
      : runtimeStatus === 'archived'
        ? { label: 'Archived', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' }
        : { label: 'Active', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' };
  const pill =
    term.category === 'net'
      ? { text: '#0A77FF', bg: '#EBF3FF', border: '#CFE6FF' }
      : term.category === 'prepayment'
        ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' }
        : { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' };

  // Edit state — seeded from the term so the user sees what they edit.
  // Custom terms are treated as template-derived (partner heuristic), so
  // the first touch confirms a new version.
  const [editName, setEditName] = useState(term.name);
  const [editDuration, setEditDuration] = useState(ptDuration);
  const [editDiscountPct, setEditDiscountPct] = useState(term.discountPercent || '');
  const [editDiscountPeriod, setEditDiscountPeriod] = useState(term.discountPeriod || '');
  const [editDescription, setEditDescription] = useState(term.description);
  const [versionPromptOpen, setVersionPromptOpen] = useState(false);
  const [versionAcknowledged, setVersionAcknowledged] = useState(false);

  const guardEdit = () => {
    if (isPreset) return true;
    if (!versionAcknowledged) {
      setVersionPromptOpen(true);
      return true;
    }
    return false;
  };

  const handleSave = () => {
    toast.success('New version saved.', {
      description: 'The original template stays intact; this invoice view reflects your version.',
    });
    setIsEditing(false);
  };

  const handleDiscard = () => {
    setEditName(term.name);
    setEditDuration(ptDuration);
    setEditDiscountPct(term.discountPercent || '');
    setEditDiscountPeriod(term.discountPeriod || '');
    setEditDescription(term.description);
    setIsEditing(false);
  };

  // Detail-modal sizing standard (partner): stable frame so tab switches
  // never resize the modal — 70vw capped at 1480px, 88vh with a 640px
  // floor and 1180px ceiling. Body scrolls internally.
  const modalBaseTransition =
    'transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
  const modalSizeClass = isFullscreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  const hasDiscount = !!(term.applyDiscount || term.discountPercent);
  const slices = SPLIT_TERM_SLICES[term.id];
  const splitMilestones =
    term.category === 'split'
      ? slices
        ? slices.map((s) => ({
            pct: String(s.percent),
            label: s.netDays > 0 ? `${s.triggerEvent} · Net ${s.netDays}` : s.triggerEvent,
          }))
        : parseSplitMilestones(term.description)
      : [];

  const fieldsDisabled = isPreset || !isEditing;

  const lockedFieldTooltip = isPreset ? (
    <>
      This is a system template and can&rsquo;t be edited. Use{' '}
      <span className="font-semibold">Duplicate</span> to make a custom version.
    </>
  ) : (
    <>
      Click <span className="font-semibold">Edit</span> in the header to modify this term.
    </>
  );

  const LockedField = ({ children }: { children: ReactNode }) => {
    if (!fieldsDisabled) return <>{children}</>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-[440] max-w-[260px] text-center leading-relaxed text-xs">
          {lockedFieldTooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[430] ${modalSizeClass}`}
        showCloseButton={false}
        overlayClassName="z-[425] !bg-black/30"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
      >
        <DialogTitle className="sr-only">Payment Term Details, {term.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of payment term {term.name}</DialogDescription>

        {/* ── Header: hero-style identity + actions ── */}
        <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
          <div className="px-4 sm:px-5 pt-3 pb-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5"
                aria-label="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {/* Themed term avatar — category icon + value */}
              <div
                className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                style={{ backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
              >
                {term.category === 'net' ? (
                  <Receipt className="w-4 h-4" style={{ color: pill.text }} />
                ) : term.category === 'prepayment' ? (
                  <Clock className="w-4 h-4" style={{ color: pill.text }} />
                ) : (
                  <SquareSplitHorizontal className="w-4 h-4" style={{ color: pill.text }} />
                )}
                <span className="text-[11px] leading-none" style={{ color: pill.text, fontWeight: 700 }}>
                  {term.category === 'net' ? ptDuration : term.typeBadge}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{term.name}</h1>
                  {/* Type + Trigger segmented pill — locked colors, icons on both sides */}
                  <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}>
                      {term.category === 'net' ? (
                        <Receipt className="w-3 h-3" />
                      ) : term.category === 'prepayment' ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <SquareSplitHorizontal className="w-3 h-3" />
                      )}
                      {term.typeBadge}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                      <CalendarDays className="w-3 h-3" />
                      {term.trigger}
                    </span>
                  </span>
                  {/* Status — runtime store for custom terms, presets stay Active. */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border" style={{ fontWeight: 500, backgroundColor: statusBadge.bg, color: statusBadge.text, borderColor: statusBadge.border }}>
                    {statusBadge.label}
                  </span>
                  {/* Template / Custom marker */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isCustom ? 'border-slate-300 bg-white text-slate-500' : 'bg-muted border-slate-300 text-slate-500'}`} style={{ fontWeight: 600 }}>
                    {isCustom ? 'Custom' : <><Lock className="w-2.5 h-2.5" /> Template</>}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
                  {term.description || `Payment is due ${ptDuration} days after the ${term.trigger}.`}
                </p>
              </div>
              {/* Right-side actions. System templates disable Edit, Archive,
                  and Disable with a tooltip pointing at Duplicate; custom
                  terms get the real partner behavior. Span wrappers exist
                  because Radix tooltips need a non-disabled child to
                  receive pointer events. */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        type="button"
                        onClick={() => { if (isCustom) { setIsEditing(true); setTab('setup'); } }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-center leading-relaxed">
                      This term ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        type="button"
                        onClick={() => { if (isCustom) setPendingAction(runtimeStatus === 'archived' ? 'restore' : 'archive'); }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Archive className="w-3.5 h-3.5" /> {runtimeStatus === 'archived' ? 'Restore' : 'Archive'}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be archived because they ship with the software. <span className="font-semibold">Duplicate</span> the template if you need a version you can manage.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        type="button"
                        onClick={() => { if (isCustom) setPendingAction(runtimeStatus === 'inactive' ? 'enable' : 'disable'); }}
                        disabled={isPreset || runtimeStatus === 'archived'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Ban className="w-3.5 h-3.5" /> {runtimeStatus === 'inactive' ? 'Enable' : 'Disable'}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be disabled. <span className="font-semibold">Duplicate</span> the template to create a custom copy you can disable.
                    </TooltipContent>
                  )}
                </Tooltip>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body: tab bar + tab content ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFBFC]">
            <div className="flex items-center border-b border-border shrink-0 px-1 bg-white">
              {PT_DETAIL_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      active ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Overview — the term's structure in the create-form layout. */}
            {tab === 'setup' && (
              <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
                <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">
                  {/* Mode banner — read-only / editing, differs by kind. */}
                  <div className={`rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5 ${isEditing ? 'border-[#A8D2FF] bg-[#EBF3FF]' : 'border-[#E8ECF1] bg-white'}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${isEditing ? 'bg-white border-[#A8D2FF] text-primary' : 'bg-slate-50 border-[#E8ECF1] text-slate-500'}`}>
                      {isEditing ? <Pencil className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        {isPreset ? 'System Template (Read-Only)' : isEditing ? 'Editing Mode' : 'Custom Term (Read-Only)'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {isPreset
                          ? "This term ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                          : isEditing
                            ? "You're editing this term. Saving will create a new version so the original stays intact."
                            : "Click Edit in the header to modify this term's details."}
                      </p>
                    </div>
                  </div>

                  {/* Payment Term Type — tile selector, always inert here. */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Type</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-[11px] leading-[1.5]">
                          <p className="text-slate-500">Type is fixed once a term is created. To change it, duplicate this term and pick a new type.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {PT_TYPE_TILES.map((t) => {
                        const isActive = term.category === t.id;
                        const TileIcon = t.icon;
                        return (
                          <div
                            key={t.id}
                            className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${
                              isActive ? `${t.activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]` : 'border-border bg-white opacity-50'
                            }`}
                          >
                            {isActive && (
                              <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${t.bg}80 0%, transparent 70%)` }} />
                            )}
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.borderHex}40)`, color: t.accent }}>
                                <TileIcon className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px]" style={{ fontWeight: 600, color: isActive ? t.accent : '#475569' }}>{t.label}</p>
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: isActive ? t.accent : '#94A3B8' }}>{t.desc}</p>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? '' : 'border-[1.5px] border-[#D1D5DB] bg-white'}`}
                                style={isActive ? { backgroundColor: t.circleBg, boxShadow: `0 0 0 2px ${t.circleShadow}` } : {}}
                              >
                                {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Term Details — Name / Trigger / Duration / Description. */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Details</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-[11px] leading-[1.5]">
                          <p className="text-slate-500">Name, duration, and trigger as they appear on POs and invoices.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                            {term.category === 'net' ? 'NET Term Name' : term.category === 'prepayment' ? 'Prepayment Term Name' : 'Split Term Name'}
                          </Label>
                          <LockedField>
                            <Input
                              value={editName}
                              disabled={fieldsDisabled}
                              onChange={(e) => { if (!guardEdit()) setEditName(e.target.value); }}
                              className="mt-1 !h-10 text-sm"
                            />
                          </LockedField>
                        </div>
                        <div>
                          <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</Label>
                          <Input value={term.trigger} disabled readOnly className="mt-1 !h-10 text-sm" />
                        </div>
                        {term.category === 'net' && (
                          <div>
                            <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>NET Duration (Days)</Label>
                            <LockedField>
                              <Input
                                value={editDuration}
                                disabled={fieldsDisabled}
                                onChange={(e) => { if (!guardEdit()) setEditDuration(e.target.value.replace(/[^0-9]/g, '')); }}
                                className="mt-1 !h-10 text-sm "
                              />
                            </LockedField>
                          </div>
                        )}
                        <div className={term.category === 'net' ? '' : 'sm:col-span-2'}>
                          <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Description</Label>
                          <LockedField>
                            <Input
                              value={editDescription}
                              disabled={fieldsDisabled}
                              onChange={(e) => { if (!guardEdit()) setEditDescription(e.target.value); }}
                              placeholder="Brief summary of payment term purpose or context."
                              className="mt-1 !h-10 text-sm"
                            />
                          </LockedField>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Split milestones — only for split terms. */}
                  {term.category === 'split' && splitMilestones.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Split Milestones</span>
                      </div>
                      <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {splitMilestones.map((m, i) => (
                          <div key={i} className="rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-3 py-2 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600">{m.label}</span>
                            <span className="text-[12px] text-foreground " style={{ fontWeight: 600 }}>{m.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Early payment discount — NET terms only. */}
                  {term.category === 'net' && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${hasDiscount ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`} style={{ fontWeight: 600 }}>
                          {hasDiscount ? 'Enabled' : 'Not Configured'}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="z-[440] max-w-[260px] text-[11px] leading-[1.5]">
                            <p className="text-slate-500">Reward early payment with a percent discount applied within a defined window.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Discount</Label>
                          <LockedField>
                            <div className="relative mt-1">
                              <Input
                                value={editDiscountPct}
                                disabled={fieldsDisabled}
                                onChange={(e) => { if (!guardEdit()) setEditDiscountPct(e.target.value.replace(/[^0-9.]/g, '')); }}
                                placeholder={hasDiscount ? '' : 'Not Set'}
                                className="!h-10 text-sm pr-8 "
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">%</span>
                            </div>
                          </LockedField>
                          <p className="text-[10px] text-slate-400 mt-1">Payment term discounts are percent-only.</p>
                        </div>
                        <div>
                          <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                          <LockedField>
                            <div className="relative mt-1">
                              <Input
                                value={editDiscountPeriod}
                                disabled={fieldsDisabled}
                                onChange={(e) => { if (!guardEdit()) setEditDiscountPeriod(e.target.value.replace(/[^0-9]/g, '')); }}
                                placeholder={hasDiscount ? '' : 'Not Set'}
                                className="!h-10 text-sm pr-12 "
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">days</span>
                            </div>
                          </LockedField>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata footer. */}
                  <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    <span className="inline-flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-accent text-primary" style={{ fontWeight: 700 }}>
                        {isCustom ? 'AA' : 'OS'}
                      </div>
                      <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>{isCustom ? 'Ahtisham Ahmad' : 'Omnesoft'}</span></span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>Updated <span className="text-slate-700" style={{ fontWeight: 600 }}>Dec 15, 2025</span></span>
                  </div>

                  {/* Save bar — visible when editing a custom term. */}
                  {isCustom && isEditing && (
                    <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-[#E8ECF1] flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleDiscard}
                        className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        style={{ fontWeight: 500 }}
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        style={{ fontWeight: 600 }}
                      >
                        <Check className="w-3.5 h-3.5" /> Save as New Version
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Data tabs — their content lives on the partner profile. */}
            {tab !== 'setup' && (
              <div className="flex-1 flex items-center justify-center bg-[#FAFBFC]">
                <div className="text-center px-6 max-w-[380px]">
                  <div className="w-11 h-11 rounded-xl bg-white border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                    {PT_DETAIL_TABS.find((t) => t.id === tab)?.label} lives on the partner profile
                  </p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                    Open this term in Partner Management to see its {PT_DETAIL_TABS.find((t) => t.id === tab)?.label}. This view is for reference while invoicing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: Reviewing + kind-specific actions ── */}
        <div className="shrink-0 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl">
          <div className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 min-w-0 truncate">
              Reviewing: <span className="text-foreground" style={{ fontWeight: 600 }}>{term.name}</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDuplicateOpen(true)}
                className="h-8 px-3.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              {onApply && (
                <button
                  type="button"
                  onClick={() => { onApply(); onClose(); }}
                  className="h-8 px-3.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  style={{ fontWeight: 500 }}
                >
                  <Check className="w-3.5 h-3.5" /> Apply to Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Duplicate — seeds the Create Payment Term modal with this term. */}
      <CreatePaymentTermModal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        seed={term}
        onCreate={(t) => addRuntimeTerm(t)}
      />

      {/* Version-confirm — fires once on the first edit of a custom term. */}
      <AlertDialog open={versionPromptOpen} onOpenChange={setVersionPromptOpen}>
        <AlertDialogContent className="sm:max-w-[420px] !z-[455]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create a new version?</AlertDialogTitle>
            <AlertDialogDescription>
              This term was derived from a template. Editing it will save your changes as a new version so the original stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setVersionPromptOpen(false)}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { setVersionAcknowledged(true); setVersionPromptOpen(false); }}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Continue Editing
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lifecycle confirmation — Disable / Enable / Archive / Restore.
          The partner's centered gradient recipe. */}
      <AlertDialog open={!!pendingAction} onOpenChange={(v) => { if (!v) setPendingAction(null); }}>
        <AlertDialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] !z-[455]">
          {(() => {
            const cfg = pendingAction === 'archive'
              ? { gradTop: '#FEF2F2', glow: '#EF4444', iconBg: '#FEE2E2', iconColor: 'hsl(var(--destructive))', icon: <Archive className="w-8 h-8" />, badge: 'Archive', badgeBg: '#FEF2F2', badgeText: '#991B1B', title: `Archive ${term.name}?`, body: "This term is removed from active templates. Partners that already use it keep it; you won't be able to apply it to new invoices. The term can be restored from the archive at any time.", confirm: 'Archive Term', confirmBg: '#DC2626', cancel: 'Keep Active' }
              : pendingAction === 'restore'
                ? { gradTop: '#ECFDF5', glow: '#10B981', iconBg: '#D1FAE5', iconColor: '#065F46', icon: <ArchiveRestore className="w-8 h-8" />, badge: 'Unarchive', badgeBg: '#ECFDF5', badgeText: '#065F46', title: `Unarchive ${term.name}?`, body: 'The term goes back to active templates and reappears in default listings and pickers. Partners that already use it are unaffected.', confirm: 'Unarchive Term', confirmBg: '#10B981', cancel: 'Keep Archived' }
                : pendingAction === 'disable'
                  ? { gradTop: '#FFFBEB', glow: '#F59E0B', iconBg: '#FEF3C7', iconColor: '#B45309', icon: <CircleSlash className="w-8 h-8" />, badge: 'Disable', badgeBg: '#FFFBEB', badgeText: '#92400E', title: `Disable ${term.name}?`, body: 'The term stops appearing in pickers and is excluded from new assignments. Partners that already use it keep it. You can re-enable it from the term detail at any time.', confirm: 'Disable Term', confirmBg: '#F59E0B', cancel: 'Keep Enabled' }
                  : { gradTop: '#ECFDF5', glow: '#10B981', iconBg: '#D1FAE5', iconColor: '#065F46', icon: <CircleCheck className="w-8 h-8" />, badge: 'Enable', badgeBg: '#ECFDF5', badgeText: '#065F46', title: `Enable ${term.name}?`, body: 'The term goes back to active templates and becomes available for new assignments. Existing assignments stay exactly as-is.', confirm: 'Enable Term', confirmBg: '#10B981', cancel: 'Keep Disabled' };
            const targetStatus = pendingAction === 'archive' ? 'archived' : pendingAction === 'disable' ? 'inactive' : 'active';
            const successCopy = pendingAction === 'archive' ? `${term.name} archived.` : pendingAction === 'restore' ? `${term.name} unarchived.` : pendingAction === 'disable' ? `${term.name} disabled.` : `${term.name} enabled.`;
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${cfg.gradTop} 0%, rgba(255,255,255,0.3) 70%, transparent 100%)` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: cfg.glow }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}>
                    {cfg.icon}
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: cfg.badgeBg, color: cfg.badgeText }}>
                    {cfg.badge}
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600 }}>
                      {cfg.title}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[420px] text-muted-foreground" style={{ lineHeight: '1.65' }}>
                    {cfg.body}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTermStatus(term.id, targetStatus);
                        toast.success(successCopy);
                        setPendingAction(null);
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 text-white"
                      style={{ fontWeight: 600, backgroundColor: cfg.confirmBg }}
                    >
                      {cfg.confirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingAction(null)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors bg-muted text-slate-700"
                      style={{ fontWeight: 500 }}
                    >
                      {cfg.cancel}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
