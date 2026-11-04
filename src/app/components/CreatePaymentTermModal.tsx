import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Banknote,
  Check,
  Clock,
  Info,
  Maximize2,
  Minimize2,
  Plus,
  Receipt,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  PAYMENT_TERM_PRESETS,
  SPLIT_TERM_SLICES,
  type PaymentTermCategory,
  type PaymentTermPreset,
  type TriggerEvent,
} from '@/app/data/paymentTermPresets';

/* ── Create Payment Term modal (9/1/26, partner 1:1 port) ─────────────
 * The partner module's "Create New Payment Terms" dialog ported for
 * vendor invoicing as a self-contained component: template suggestion
 * row, three-tile type selector (NET / Prepayment / Split), compact
 * details grid, prepayment configuration, split-event builder with the
 * 100% total check, optional early-payment discount block, and the
 * fullscreen toggle. Partner-only wiring (partner groups, the "See all"
 * jump into the partner presets browser, apply-to-vendor selection) is
 * dropped; saving hands a fully built PaymentTermPreset to onCreate.
 *
 * Stacking: this modal sits ABOVE the browse-payment-terms modal
 * (z-[430]) and the term details modal, so the content runs at z-[450]
 * with a light z-[445] overlay, and every tooltip/select popper is
 * bumped to z-[460]. */

type CreatePtType = 'net' | 'prepayment' | 'split';

/* Trigger catalog. House terms (8/25/26): "Receiving" replaced the
 * partner module's "Delivery", and "Invoice Date" is a new option. */
const CREATE_PT_TRIGGERS: { id: string; label: TriggerEvent }[] = [
  { id: 'invoice_date', label: 'Invoice Date' },
  { id: 'order_confirmation', label: 'Order Confirmation' },
  { id: 'production_start', label: 'Production Start' },
  { id: 'production_end', label: 'Production End' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'receiving', label: 'Receiving' },
];

const CREATE_PT_TYPES: { id: CreatePtType }[] = [
  { id: 'net' },
  { id: 'prepayment' },
  { id: 'split' },
];

/* Deterministic ids for runtime-created terms (no Date.now / random). */
let customTermCounter = 0;

interface SplitEventDraft {
  event: string;
  percent: string;
  fixRate: boolean;
}

const DEFAULT_SPLIT_EVENTS: SplitEventDraft[] = [
  { event: 'order_confirmation', percent: '', fixRate: false },
  { event: '', percent: '', fixRate: false },
];

const triggerIdFor = (label: string): string =>
  CREATE_PT_TRIGGERS.find((t) => t.label === label)?.id || 'order_confirmation';

const categoryToType = (c: PaymentTermCategory): CreatePtType =>
  c === 'net' ? 'net' : c === 'prepayment' ? 'prepayment' : 'split';

/* ── ExpandableTextarea (private port of the partner helper) ────────── */
function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  maxLength = 5000,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [expanded]);

  return (
    <div>
      {label && (
        <div className="flex items-center gap-1 mb-1.5">
          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{label}</label>
        </div>
      )}
      <div className="relative" style={{ height: 72 }}>
        {expanded && <div className="fixed inset-0 z-[455]" onClick={() => setExpanded(false)} />}
        <div
          className="absolute top-0 right-0 z-[456]"
          style={{
            left: expanded ? '-80%' : 0,
            marginLeft: expanded ? -12 : 0,
            marginRight: expanded ? -12 : 0,
            marginTop: expanded ? -32 : 0,
            transition: 'left 300ms cubic-bezier(0.16, 1, 0.3, 1), margin 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { if (e.target.value.length <= maxLength) onChange(e.target.value); }}
            onDoubleClick={() => { if (!expanded) setExpanded(true); }}
            placeholder={placeholder}
            className={`w-full rounded-lg bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 px-3 py-2 pb-6 border outline-none ${
              expanded
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'
            }`}
            style={{
              height: expanded ? 190 : 72,
              boxShadow: expanded ? '0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)' : 'none',
              transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease',
            }}
          />
          <p className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-400 pointer-events-none">{value.length}/{maxLength}</p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
              expanded
                ? 'text-primary hover:bg-accent'
                : 'text-slate-400 hover:text-primary hover:bg-accent'
            }`}
            style={{ transition: 'color 200ms ease, background-color 200ms ease' }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */
export function CreatePaymentTermModal({
  open,
  onClose,
  seed,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  seed?: PaymentTermPreset;
  onCreate: (term: PaymentTermPreset) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CreatePtType>('net');
  const [trigger, setTrigger] = useState('order_confirmation');
  const [duration, setDuration] = useState('30');
  const [customDuration, setCustomDuration] = useState('');
  const [prepayValue, setPrepayValue] = useState('');
  const [description, setDescription] = useState('');
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountPeriod, setDiscountPeriod] = useState('10');
  const [customDiscountPeriod, setCustomDiscountPeriod] = useState('');
  const [splitEvents, setSplitEvents] = useState<SplitEventDraft[]>(DEFAULT_SPLIT_EVENTS);

  function resetForm() {
    setName('');
    setType('net');
    setTrigger('order_confirmation');
    setDuration('30');
    setCustomDuration('');
    setPrepayValue('');
    setDescription('');
    setApplyDiscount(false);
    setDiscountPercent('');
    setDiscountPeriod('10');
    setCustomDiscountPeriod('');
    setSplitEvents(DEFAULT_SPLIT_EVENTS.map((e) => ({ ...e })));
  }

  function prefillFrom(tpl: PaymentTermPreset, nameOverride?: string) {
    resetForm();
    setName(nameOverride ?? `${tpl.name} (Copy)`);
    setType(categoryToType(tpl.category));
    setTrigger(triggerIdFor(tpl.trigger));
    if (tpl.duration) {
      setDuration(tpl.duration);
      setCustomDuration(tpl.duration);
    }
    setDescription(tpl.description);
    if (tpl.applyDiscount) {
      setApplyDiscount(true);
      if (tpl.discountPercent) setDiscountPercent(tpl.discountPercent);
      if (tpl.discountPeriod) setDiscountPeriod(tpl.discountPeriod);
    }
    // Split templates carry real slice data; seed the builder from it.
    const slices = SPLIT_TERM_SLICES[tpl.id];
    if (tpl.category === 'split' && slices?.length) {
      setSplitEvents(slices.map((s) => ({
        event: triggerIdFor(s.triggerEvent),
        percent: String(s.percent),
        fixRate: false,
      })));
    }
  }

  /* When the modal opens with a seed (Duplicate flow), sync the whole
   * form from it; a plain open starts from a clean slate. */
  useEffect(() => {
    if (!open) return;
    if (seed) prefillFrom(seed);
    else resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  function handleClose() {
    resetForm();
    setFullscreen(false);
    onClose();
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error('Please enter a payment term name.');
      return;
    }
    const resolvedDuration = customDuration || duration;
    if (type === 'net' && !resolvedDuration) {
      toast.error('Please enter a NET duration.');
      return;
    }
    const typeBadge = type === 'net' ? 'NET' : type === 'prepayment' ? 'Pre' : 'Split';
    const badgeColor =
      type === 'net' ? 'hsl(var(--primary))'
      : type === 'prepayment' ? 'hsl(var(--violet))'
      : 'hsl(var(--warning))';
    const triggerLabel: TriggerEvent =
      CREATE_PT_TRIGGERS.find((t) => t.id === trigger)?.label || 'Order Confirmation';

    // Auto-generate a rich description if the user didn't provide one.
    let autoDescription = '';
    if (description.trim()) {
      autoDescription = description.trim();
    } else if (type === 'net') {
      autoDescription = `Payment is due ${resolvedDuration} days after ${triggerLabel}.`;
    } else if (type === 'prepayment') {
      autoDescription = prepayValue
        ? `${prepayValue}% of the total amount is paid at ${triggerLabel}.`
        : `Prepayment is due at ${triggerLabel}.`;
    } else {
      const parts = splitEvents
        .filter((e) => e.event && e.percent)
        .map((e) => {
          const lbl = CREATE_PT_TRIGGERS.find((t) => t.id === e.event)?.label || e.event;
          return `${e.percent}% due at ${lbl}`;
        });
      autoDescription = parts.length
        ? `${parts.join(', ')}.`
        : `Split payment term triggered on ${triggerLabel}.`;
    }
    if (!description.trim() && applyDiscount && discountPercent) {
      const resolvedPeriod = customDiscountPeriod || discountPeriod;
      autoDescription += ` ${discountPercent}% discount if paid within ${resolvedPeriod} days.`;
    }

    customTermCounter += 1;
    const newTerm: PaymentTermPreset = {
      id: `pt-custom-rt-${customTermCounter}`,
      name: name.trim(),
      category: type,
      typeBadge,
      badgeColor,
      trigger: type === 'split'
        ? (CREATE_PT_TRIGGERS.find((t) => t.id === splitEvents[0]?.event)?.label || triggerLabel)
        : triggerLabel,
      description: autoDescription,
      vendorsApplied: 0,
      duration: type === 'net' ? resolvedDuration : undefined,
      applyDiscount: applyDiscount || undefined,
      discountPercent: applyDiscount ? discountPercent : undefined,
      discountPeriod: applyDiscount ? (customDiscountPeriod || discountPeriod) : undefined,
    };
    // Register the split structure so the invoice-side slice picker
    // (which slice does THIS invoice cover) and the pre/post slice rule
    // work for runtime-created splits exactly like catalog ones. The
    // builder has no per-event net window, so slices are due AT their
    // event (netDays 0).
    if (type === 'split') {
      SPLIT_TERM_SLICES[newTerm.id] = splitEvents
        .filter((e) => e.event && e.percent)
        .map((e) => ({
          percent: parseInt(e.percent, 10) || 0,
          triggerEvent: (CREATE_PT_TRIGGERS.find((t) => t.id === e.event)?.label || 'Order Confirmation') as TriggerEvent,
          netDays: 0,
        }));
    }
    const createdName = newTerm.name;
    onCreate(newTerm);
    toast.success(`${createdName} created.`);
    resetForm();
    setFullscreen(false);
    onClose();
  }

  const suggestedTemplates = [...PAYMENT_TERM_PRESETS]
    .sort((a, b) => b.vendorsApplied - a.vendorsApplied)
    .slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden z-[450] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
        style={fullscreen
          ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
          // Form-modal standard: hugs content vertically, width capped on wide monitors
          : { maxWidth: 'min(65vw, 960px)', width: 'calc(100% - 2rem)', height: 'auto', maxHeight: '90vh', borderRadius: 16 }
        }
        showCloseButton={false}
        overlayClassName="z-[445] !bg-black/30"
      >
        <DialogTitle className="sr-only">Create New Payment Term</DialogTitle>
        <DialogDescription className="sr-only">Fill in the form to create a new payment term.</DialogDescription>

        {/* Header */}
        <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Create New Payment Term</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  <Receipt className="w-3 h-3" /> Payment Term
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Select the structure of the payment arrangement with this vendor.
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {fullscreen ? 'Exit Full' : 'Full View'}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
          <div className="px-4 py-4 transition-all duration-300 ease-out">
            <div className="space-y-5">

              {/* Start-from-template suggestion row */}
              <div className="rounded-xl border border-dashed border-[#DBE4F0] bg-gradient-to-br from-[#F8FBFF] to-white p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Start from a Template</p>
                      <p className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>Duplicates the template as a new custom term. Originals are never modified.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {suggestedTemplates.map((tpl) => {
                    const pill =
                      tpl.category === 'net'
                        ? { text: '#0A77FF', bg: '#EBF3FF', border: '#CFE6FF' }
                        : tpl.category === 'prepayment'
                          ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' }
                          : { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' };
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          prefillFrom(tpl);
                          toast.success('Template duplicated as a new custom term. Edit any field before saving; the original template stays unchanged.');
                        }}
                        className="group text-left rounded-lg border border-[#E8ECF1] bg-white p-2.5 hover:border-primary/30 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
                            >
                              <Receipt className="w-3 h-3" />
                              {tpl.typeBadge}
                            </span>
                            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l truncate max-w-[110px]" style={{ fontWeight: 500, borderColor: pill.border }}>
                              {tpl.trigger}
                            </span>
                          </span>
                          {tpl.duration && (
                            <span className="inline-flex items-center px-1.5 py-[2px] rounded-full border border-[#E8ECF1] bg-slate-50 text-slate-500 text-[10px]" style={{ fontWeight: 500 }}>
                              {tpl.duration}d
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-foreground line-clamp-1 group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>
                          {tpl.name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                          {tpl.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Term Type: card selector */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Type</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                      <p className="text-slate-500">Select a payment structure. Hover each card for details.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {CREATE_PT_TYPES.map((t) => {
                    const isActive = type === t.id;
                    const icon = t.id === 'net' ? <Clock className="w-[18px] h-[18px]" /> : t.id === 'prepayment' ? <Banknote className="w-[18px] h-[18px]" /> : <ArrowUpDown className="w-[18px] h-[18px]" />;
                    const shortLabel = t.id === 'net' ? 'NET Terms' : t.id === 'prepayment' ? 'Prepayment' : 'Split Payment';
                    const shortDesc = t.id === 'net' ? 'Pay after X days' : t.id === 'prepayment' ? 'Pay before receiving' : 'Multiple installments';
                    const typeTooltip = t.id === 'net'
                      ? { desc: 'Full payment due after a set number of days from a trigger event.', example: 'Net 30', exampleDesc: 'pay in full within 30 days of shipment.' }
                      : t.id === 'prepayment'
                      ? { desc: 'Collect partial or full payment upfront before goods ship.', example: '50% Upfront', exampleDesc: 'half paid before dispatch.' }
                      : { desc: 'Split the total across multiple events, each with its own percentage.', example: '40/30/30', exampleDesc: 'split across order, shipment, and receiving.' };
                    const accentColor = t.id === 'net' ? 'hsl(var(--primary))' : t.id === 'prepayment' ? 'hsl(var(--violet))' : 'hsl(var(--warning))';
                    const accentBg = t.id === 'net' ? '#EBF3FF' : t.id === 'prepayment' ? '#F5F3FF' : '#FFFBEB';
                    const accentBorder = t.id === 'net' ? '#7AB8FF' : t.id === 'prepayment' ? '#C4B5FD' : '#FCD34D';
                    const activeBorderClass = t.id === 'net' ? 'border-[#7AB8FF]/70' : t.id === 'prepayment' ? 'border-[#C4B5FD]/70' : 'border-[#FCD34D]/70';
                    const hoverBorderClass = t.id === 'net' ? 'hover:border-blue-200' : t.id === 'prepayment' ? 'hover:border-[#DDD6FE]' : 'hover:border-amber-200';
                    const circleActiveBg = t.id === 'net' ? '#0A77FF' : t.id === 'prepayment' ? '#8B5CF6' : '#F59E0B';
                    const circleActiveShadow = t.id === 'net' ? 'rgba(59,130,246,0.15)' : t.id === 'prepayment' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)';
                    const hoverCircleBorder = t.id === 'net' ? 'group-hover:border-[#7AB8FF]' : t.id === 'prepayment' ? 'group-hover:border-[#C4B5FD]' : 'group-hover:border-[#FCD34D]';
                    return (
                      <Tooltip key={t.id}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => {
                              setType(t.id);
                              /* Receiving isn't offered for prepayment,
                                 fall back to the default trigger. */
                              if (t.id === 'prepayment' && trigger === 'receiving') setTrigger('order_confirmation');
                            }}
                            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                              isActive
                                ? `${activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]`
                                : `border-border bg-white ${hoverBorderClass} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                            }`}
                          >
                            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} style={{ background: `linear-gradient(135deg, ${accentBg}80 0%, transparent 70%)` }} />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? '' : 'group-hover:scale-105'}`} style={{ background: `linear-gradient(135deg, ${accentBg}, ${accentBorder}40)`, color: accentColor }}>
                                {icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] transition-colors duration-150 ${isActive ? '' : 'text-foreground group-hover:text-slate-800'}`} style={{ fontWeight: 600, color: isActive ? accentColor : undefined }}>{shortLabel}</p>
                                <p className="text-[11px] mt-0.5 truncate transition-colors duration-150" style={{ color: isActive ? accentColor : '#94A3B8' }}>{shortDesc}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                                isActive
                                  ? ''
                                  : `border-[1.5px] border-[#D1D5DB] bg-white ${hoverCircleBorder}`
                              }`} style={isActive ? { backgroundColor: circleActiveBg, boxShadow: `0 0 0 2px ${circleActiveShadow}` } : {}}>
                                {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                          <p className="text-slate-500">{typeTooltip.desc}</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span style={{ fontWeight: 600, color: accentColor }}>{typeTooltip.example}</span>: {typeTooltip.exampleDesc}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Payment Term Details: compact grid */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Details</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                      <p className="text-slate-500">Name, duration, and trigger shown on POs and invoices.</p>
                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                        <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Tip</p>
                        <p className="text-[11px] text-slate-700 mt-1">Use clear names like <span className="text-primary" style={{ fontWeight: 600 }}>Net 30 Standard</span> or <span className="text-primary" style={{ fontWeight: 600 }}>50% Upfront</span>.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {/* Row 1: Name + (NET only: Trigger) / (others: Description) */}
                    <div>
                      <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                        {type === 'net' ? 'NET Term' : type === 'prepayment' ? 'Prepayment Term' : 'Split Term'} Name
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => { setName(e.target.value); setNameError(false); }}
                        placeholder={`e.g. ${type === 'net' ? 'Net 30 Standard' : type === 'prepayment' ? '50% Upfront' : '3-Part Split'}`}
                        className={`rounded-lg bg-white h-9 text-[13px] text-foreground placeholder:text-slate-400 ${nameError ? 'border-red-400 ring-2 ring-red-100' : 'border-border'}`}
                      />
                      {nameError && <p className="text-[10px] text-red-600 mt-1">Name the term first.</p>}
                    </div>
                    {/* NET: Trigger next to name */}
                    {type === 'net' && (
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                              <p className="text-slate-500">Event that starts the payment countdown.</p>
                              <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Shipping</span>: due 30 days after shipment.</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select value={trigger} onValueChange={setTrigger}>
                          <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[460] rounded-lg">
                            {CREATE_PT_TRIGGERS.map((t) => (
                              <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* Prepayment/Split: Description next to name */}
                    {type !== 'net' && (
                      <ExpandableTextarea
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        placeholder="Brief summary of payment term purpose or context."
                      />
                    )}
                    {/* NET Row 2: Duration + Description */}
                    {type === 'net' && (
                      <>
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>NET Duration (Days)</label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                                <p className="text-slate-500">Calendar days allowed after trigger. Common: 15, 30, 45, 60, or 90.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                  <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>: pay in full within 30 days.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="relative">
                            <Input
                              value={customDuration || duration}
                              onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setCustomDuration(v); setDuration(v || '30'); }}
                              placeholder="e.g. 30"
                              className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 pr-14"
                              inputMode="numeric"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                          </div>
                        </div>
                        <ExpandableTextarea
                          label="Description"
                          value={description}
                          onChange={setDescription}
                          placeholder="Brief summary of payment term purpose or context."
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Prepayment Configuration Card */}
              {type === 'prepayment' && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Prepayment Configuration</span>
                    <Tooltip>
                      <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                        <p className="text-slate-500">Upfront payment before shipment as a percentage of the order total.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {/* Prepayment Value: percent only */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                            Prepayment Value
                          </label>
                        </div>
                        <div className="relative">
                          <Input
                            value={prepayValue}
                            onChange={(e) => setPrepayValue(e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 50"
                            className="rounded-lg border-border bg-white text-[13px] h-9 placeholder:text-slate-400 pr-8"
                            inputMode="numeric"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                        </div>
                      </div>
                      {/* Trigger */}
                      <div>
                        <div className="flex items-center h-[22px] mb-1.5">
                          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                        </div>
                        <Select value={trigger} onValueChange={setTrigger}>
                          <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[460] rounded-lg">
                            {/* Prepayment happens before fulfillment, so
                                Receiving is not a valid trigger here. */}
                            {CREATE_PT_TRIGGERS.filter((t) => t.id !== 'receiving').map((t) => (
                              <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Split Payment Events */}
              {type === 'split' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Split Events</span>
                      <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{splitEvents.length}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {splitEvents.map((evt, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-white overflow-hidden transition-all">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: '#FFFBEB' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: 'hsl(var(--warning))' }}>{idx + 1}</span>
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Split {idx + 1}</span>
                          </div>
                          {splitEvents.length > 2 && (
                            <button
                              onClick={() => setSplitEvents(splitEvents.filter((_, i) => i !== idx))}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Body */}
                        <div className="px-3.5 py-3">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Split Value: percent only */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                  Split Value
                                </label>
                              </div>
                              <div className="relative">
                                <Input
                                  value={evt.percent}
                                  onChange={(e) => { const u = [...splitEvents]; u[idx] = { ...u[idx], percent: e.target.value }; setSplitEvents(u); }}
                                  placeholder="e.g. 50"
                                  className="rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                              </div>
                            </div>
                            {/* Trigger Event dropdown */}
                            <div>
                              <div className="flex items-center h-[22px] mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                              </div>
                              <Select
                                value={evt.event}
                                onValueChange={(v) => { const u = [...splitEvents]; u[idx] = { ...u[idx], event: v }; setSplitEvents(u); }}
                              >
                                <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
                                  <SelectValue placeholder="Select trigger" />
                                </SelectTrigger>
                                <SelectContent className="z-[460] rounded-lg">
                                  {CREATE_PT_TRIGGERS.filter((t) => {
                                    const usedTriggers = splitEvents.filter((_, i) => i !== idx).map((e) => e.event);
                                    return !usedTriggers.includes(t.id);
                                  }).map((t) => (
                                    <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => {
                        const usedTriggers = new Set(splitEvents.map((e) => e.event));
                        const nextTrigger = CREATE_PT_TRIGGERS.find((t) => !usedTriggers.has(t.id))?.id || 'receiving';
                        setSplitEvents([...splitEvents, { event: nextTrigger, percent: '', fixRate: false }]);
                      }}
                      disabled={splitEvents.length >= 5}
                      className="inline-flex items-center gap-1 text-[12px] text-warning hover:text-[#B45309] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ fontWeight: 600 }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Event {splitEvents.length >= 5 ? '(Max 5)' : ''}
                    </button>
                    {(() => {
                      const total = splitEvents.reduce((sum, e) => sum + (parseFloat(e.percent) || 0), 0);
                      return (
                        <span className={`text-[11px] ${Math.abs(total - 100) < 0.01 ? 'text-emerald-500' : 'text-amber-500'}`} style={{ fontWeight: 600 }}>
                          Total: {total}%{Math.abs(total - 100) >= 0.01 ? ' (must equal 100%)' : ' ✓'}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Early Payment Discount */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                  <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                  <Tooltip>
                    <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                      <p className="text-slate-500">Encourage faster payment with an auto-applied discount within an eligible window.</p>
                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                        <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                        <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>2/10 Net 30</span>: 2% off if paid in 10 days, otherwise full payment in 30 days.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className={`rounded-xl border p-4 transition-all duration-200 ${applyDiscount ? 'border-primary/25 bg-white shadow-sm' : 'border-border bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <Switch checked={applyDiscount} onCheckedChange={(v) => setApplyDiscount(v === true)} />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Apply Early Payment Discount</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Incentivize faster payments by offering a percentage or fixed discount within a defined window.</p>
                    </div>
                  </div>

                  {applyDiscount && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-muted items-end">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Discount</Label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                                <p className="text-slate-500">Percentage deducted when paid within the eligible window.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="relative mt-1">
                          <Input
                            value={discountPercent}
                            onChange={(e) => setDiscountPercent(e.target.value)}
                            placeholder="e.g. 5"
                            className="rounded-lg border-border bg-white !h-10 text-sm placeholder:text-slate-400 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[460]">
                              <p className="text-slate-500">If paid within this window, the discount will be applied to the invoice total.</p>
                              <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>2/10 Net 30</span>: 2% off if paid in 10 days, otherwise full payment in 30 days.</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative mt-1">
                          <Input
                            value={customDiscountPeriod || discountPeriod}
                            onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setCustomDiscountPeriod(v); setDiscountPeriod(v || '10'); }}
                            placeholder="e.g. 10"
                            className="!h-10 rounded-lg border-border bg-white text-sm text-foreground placeholder:text-slate-400 pr-14"
                            inputMode="numeric"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 sm:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0 rounded-b-none sm:rounded-b-2xl">
          <button
            onClick={handleClose}
            className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim()) {
                setNameError(true);
                toast.error('Name required', { description: 'Name the term before saving.' });
                return;
              }
              handleSave();
            }}
            className="inline-flex items-center px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#086AE6] transition-colors shadow-sm cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Save & Create
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
