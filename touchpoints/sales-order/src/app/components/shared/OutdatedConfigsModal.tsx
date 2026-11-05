/* OutdatedConfigsModal — receiving-side counterpart for upstream
 * modules (Partner Management and others) that push updated settings
 * onto a partner this Quote / SO already references. Two states in a
 * single modal:
 *
 *   1. Review — a compact list of what changed with two actions:
 *      "Ignore changes" (permanently dismisses those updates and
 *      closes) and "Update changes" (advances to the selection step).
 *   2. Selection — the checkbox list the user picks from, with a
 *      single amber Apply CTA. A back arrow returns to Review.
 *
 * Chrome mirrors Partner Management's amber warning-confirm dialog:
 * amber-glow header + centered body + close-X + amber CTA. */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, X, ArrowRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';

export interface OutdatedUpdate {
  id: string;
  /** Field label, e.g. "Currency", "Ship-to address", "Sales rep". */
  field: string;
  /** Optional category grouping (renders as a small muted tag). */
  category?: string;
  /** Previous value the quote/SO is currently pinned to. */
  oldValue: string;
  /** Incoming value from an upstream module (Partner Management or others). */
  newValue: string;
  /** Optional context line — one short sentence, muted grey. */
  note?: string;
}

interface OutdatedConfigsModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  updates: OutdatedUpdate[];
  /** Called with the ids the user chose to sync. */
  onApply: (appliedIds: string[]) => void;
  /** Called with the ids the user chose to ignore permanently. */
  onIgnore?: (ignoredIds: string[]) => void;
  /** Optional context — surfaced in the description copy. */
  customerName?: string;
  /** Whether this instance is on a Quote or SO — swaps the copy noun. */
  documentType?: 'quote' | 'order';
}

export function OutdatedConfigsModal({
  open,
  onOpenChange,
  updates,
  onApply,
  onIgnore,
  customerName,
  documentType = 'quote',
}: OutdatedConfigsModalProps) {
  /* Selections start empty so Apply reads as disabled until the user
     opts in. The user picks which updates to sync via row checkboxes
     or the header select-all; Ignore stays enabled the whole time so
     opting out never needs a pre-selection. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /* Reset every time the modal opens so a re-open starts fresh — no
     selections carried over. */
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
    }
  }, [open, updates]);

  const total = updates.length;
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === total && total > 0;
  const someSelected = selectedCount > 0 && selectedCount < total;
  const noun = documentType === 'order' ? 'sales order' : 'quote';

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(updates.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelected = () => {
    if (selectedCount === 0) return;
    onApply(Array.from(selectedIds));
    onOpenChange(false);
  };

  const ignoreAll = () => {
    if (onIgnore) onIgnore(updates.map((u) => u.id));
    onOpenChange(false);
    /* Ack the discard with a Partner-style success toast in place of
       the old destructive confirm modal. Same `toast.success` shape
       Partners uses for removal actions (e.g. "Attachment removed"),
       and matches the sync-success toast that fires when the user
       applies updates in the same modal so both outcomes look alike. */
    toast.success(
      total === 1
        ? `Newer configuration discarded for this ${noun}.`
        : `${total} newer configurations discarded for this ${noun}.`,
      { position: 'top-right' },
    );
  };

  const description = useMemo(() => {
    const count = total === 1 ? '1 configuration update is' : `${total} configuration updates are`;
    const target = customerName ? ` for ${customerName}` : '';
    return `${count} available${target}. Choose which to sync into this ${noun}.`;
  }, [total, customerName, noun]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[16000]"
        overlayClassName="z-[15900]"
        style={{ zIndex: 16000, backgroundColor: '#FFFFFF' }}
        onInteractOutside={() => onOpenChange(false)}
      >
        {/* Close (×) — same 32×32 rounded chip PM uses on its main
            CreatePartnerModal header, slate-100 hover. */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cancel"
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Amber glow header — mirrors PM's Duplicate / Discard header
            treatment. Sync/refresh iconography reads as "changes are
            available" without escalating to destructive-red. */}
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#F59E0B' }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <RefreshCw className="w-8 h-8" style={{ color: '#B45309' }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            {total} {total === 1 ? 'Update' : 'Updates'} Available
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'var(--foreground)' }}>
              Outdated Configurations
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[440px] mx-auto" style={{ color: 'var(--muted-foreground)', lineHeight: '1.65' }}>
            {description}
          </AlertDialogDescription>

          {/* Selection body — single-step modal, always shows the
              checkbox list inside a 340px slot with internal scroll.
              Keeps long change lists from blowing out the viewport
              while the modal chrome stays consistent. */}
          <div className="w-full mt-5" style={{ height: 340 }}>
            <SelectStep
              updates={updates}
              selectedIds={selectedIds}
              toggleOne={toggleOne}
              toggleAll={toggleAll}
              allSelected={allSelected}
              someSelected={someSelected}
              total={total}
              selectedCount={selectedCount}
            />
          </div>

          {/* Footer buttons — vertical stack, primary on top, secondary
              below. Mirrors Partner Management's Disable Carrier
              Profile confirm dialog exactly (CreatePartnerGroupModal
              lines 1971-1986): full-width h-11 rounded-xl buttons,
              amber primary + muted secondary. Apply gates on the
              selection; Ignore stays enabled the whole time. */}
          <div className="w-full mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={applySelected}
              disabled={selectedCount === 0}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600, backgroundColor: '#F59E0B', color: '#fff' }}
            >
              {selectedCount === 0
                ? 'Apply changes'
                : selectedCount === total
                  ? `Apply all ${total} ${total === 1 ? 'update' : 'updates'}`
                  : `Apply ${selectedCount} ${selectedCount === 1 ? 'update' : 'updates'}`}
            </button>
            <button
              type="button"
              onClick={ignoreAll}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-80"
              style={{ fontWeight: 500, backgroundColor: 'var(--muted)', color: '#334155' }}
            >
              Ignore changes
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Selection step ─────────────────────────────────────────────────
   Checkbox list where the user picks which updates to sync. Each row
   stacks vertically:  field  |  strikethrough old value  |  down
   arrow  |  new value  |  note. Stacked layout scales cleanly when
   values wrap onto multiple lines (long addresses, long pricing rule
   names). Fills the fixed-height body slot with internal scroll so
   both modal steps share the same overall height. */
function SelectStep({
  updates,
  selectedIds,
  toggleOne,
  toggleAll,
  allSelected,
  someSelected,
  total,
  selectedCount,
}: {
  updates: OutdatedUpdate[];
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  total: number;
  selectedCount: number;
}) {
  const hasSelection = selectedCount > 0;
  return (
    <div className="w-full h-full flex flex-col text-left">
      {/* Toolbar picks up Partner's primary-tinted state (bg-primary/5,
          primary-tinted border) when at least one row is selected, so
          the switch between "empty" and "picking updates" reads at a
          glance. Selection count on the right uses PM's bold-N + muted-
          "selected" pattern (CreatePartnerGroupModal:11753). */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 shrink-0 transition-colors"
        style={{
          backgroundColor: hasSelection ? 'rgba(10, 119, 255, 0.06)' : '#FAFBFC',
          borderColor: hasSelection ? 'rgba(10, 119, 255, 0.20)' : 'var(--border)',
        }}
      >
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
            /* Tailwind's data-[state=checked]:bg-primary from
               the base Checkbox loses to the compiled bg-input-
               background rule in this build, so the checked
               state was rendering with a white fill + white
               check (invisible). Force the partner-blue fill +
               white glyph with `!` when checked / indeterminate;
               unchecked stays crisp white. */
            className={(allSelected || someSelected)
              ? "!bg-primary !border-primary text-white"
              : "data-[state=unchecked]:bg-white"}
            aria-label="Select all updates"
          />
          <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
            Select all
          </span>
        </label>
        <span className="text-[11.5px]" style={{ fontWeight: 500, color: hasSelection ? 'var(--primary)' : 'var(--muted-foreground)' }}>
          <span style={{ fontWeight: 700 }}>{hasSelection ? selectedCount : total}</span>
          {' '}
          <span style={{ color: hasSelection ? 'var(--primary)' : 'var(--muted-foreground)', opacity: hasSelection ? 0.85 : 1 }}>
            {hasSelection
              ? `of ${total} selected`
              : `${total === 1 ? 'update' : 'updates'}`}
          </span>
        </span>
      </div>

      <div className="flex-1 min-h-0 rounded-b-lg border border-border bg-white overflow-y-auto">
        {updates.map((u, idx) => {
          const checked = selectedIds.has(u.id);
          return (
            <label
              key={u.id}
              className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleOne(u.id)}
                className={checked
                  ? "mt-0.5 !bg-primary !border-primary text-white"
                  : "mt-0.5 data-[state=unchecked]:bg-white"}
                aria-label={`Sync ${u.field}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px]" style={{ fontWeight: 600, color: 'var(--foreground)' }}>{u.field}</span>
                  {u.category && (
                    <span className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>{u.category}</span>
                  )}
                </div>
                {/* Value change block — old → new sit inline with a
                    right-arrow when they fit on one line, and wrap
                    onto their own lines when the values get long
                    (long addresses, long rule names). `flex-wrap`
                    handles the layout switch automatically. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md line-through max-w-full break-words"
                    style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                  >
                    {u.oldValue}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md max-w-full break-words"
                    style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', fontWeight: 500 }}
                  >
                    {u.newValue}
                  </span>
                </div>
                {u.note && (
                  <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{u.note}</div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default OutdatedConfigsModal;
