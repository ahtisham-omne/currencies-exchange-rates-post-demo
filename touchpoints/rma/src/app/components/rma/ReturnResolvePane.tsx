/**
 * The resolving step: the return's lines in a rail, and the selected one
 * answered beside it.
 *
 * Two pieces of the flow's own furniture, put together. The rail is 935a06b's
 * -- 268px, a three-pixel accent on the line in hand, the tracking chip on
 * every row rather than only the tracked ones. The pane is the line sheet as
 * it stands after 3837b2a: the item stated once across the top, then sections
 * in two columns, each with an icon chip, a title, a line saying what the
 * section is for, and the figure it is about on the right, over a strip of
 * actions.
 *
 * The rail was taken off the first step because there the list is the work,
 * and a permanent detail pane showed one line whether or not anybody had
 * asked. Here the detail is the work and the list is the index, so the same
 * reasoning puts it back.
 *
 * The rail's second line differs from 935a06b's, which carried the
 * description. On this step nothing about a line matters except whether it is
 * answered, and the description is already on the item strip a few pixels to
 * the right.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/lib/itemImages';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { TRACKING_LABELS,
  type TrackingMode,
} from '@/app/data/itemProvenance';

export interface ResolveRailItem {
  sku: string;
  description: string;
  uom: string;
  trackingMode: TrackingMode;
  unitPrice: number;
  qty: number;
  /** What this line still needs, or who it settled with. */
  status: string;
  done: boolean;
}

export function ReturnResolvePane({
  items,
  selected,
  onSelect,
  onOpenLine,
  layout = 'single',
  children,
}: {
  items: ResolveRailItem[];
  selected: string | null;
  onSelect: (sku: string) => void;
  /** The rest of the line -- reason, remedy, notes, files -- which is the
   *  first step's sheet and stays there rather than being repeated here. */
  onOpenLine: (sku: string) => void;
  /** `single` is the checklist ported from the count planner, which answers
   *  the line in one column. `two-column` is the sheet it replaced, kept so
   *  the old layout can be put back by flipping one constant. */
  layout?: 'single' | 'two-column' | undefined;
  children: ReactNode;
}) {
  const current = items.find((i) => i.sku === selected) ?? items[0];
  const left = items.filter((i) => !i.done).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8ECF1] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex min-h-[540px] items-stretch">
        {/* ── the rail ── */}
        <div className="flex w-[268px] shrink-0 flex-col border-r border-[#EEF2F6] bg-white">
          <div className="flex items-baseline justify-between gap-2 border-b border-[#EEF2F6] px-3 py-2">
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
              On this return
            </span>
            <span
              className={`shrink-0 text-[11px] tabular-nums ${left > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
              style={{ fontWeight: 600 }}
            >
              {left > 0 ? `${left} to answer` : 'All answered'}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.map((item) => {
              const active = item.sku === current?.sku;
              return (
                <button
                  key={item.sku}
                  type="button"
                  onClick={() => onSelect(item.sku)}
                  aria-current={active}
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-b border-[#EEF2F6] border-l-[3px] transition-colors ${
                    active
                      ? 'border-l-primary bg-primary/[0.06]'
                      : 'border-l-transparent hover:bg-[#F5F9FF]'
                  }`}
                >
                  <span
                    className={`w-9 h-9 shrink-0 rounded-md overflow-hidden border ${
                      active ? 'border-primary/30' : 'border-border'
                    }`}
                  >
                    <ImageWithFallback
                      src={imageForSku(item.sku)}
                      alt={item.sku}
                      className="w-full h-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] truncate ${active ? 'text-primary' : 'text-gray-900'}`}
                        style={{ fontWeight: 600 }}
                      >
                        {item.sku}
                      </span>
                      <TrackingPill mode={item.trackingMode} />
                    </span>
                    <span
                      className={`block text-[10px] truncate mt-0.5 ${
                        item.done ? 'text-slate-500' : 'text-amber-700'
                      }`}
                      style={{ fontWeight: item.done ? 400 : 600 }}
                    >
                      {item.status}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-[11px] tabular-nums ${
                        item.done ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {formatQty(item.qty)}
                    </span>
                    <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                      {item.uom}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── the pane ── */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#F7F9FC]">
          {current && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EEF2F6] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenLine(current.sku)}
                  aria-label={`Open the rest of the ${current.sku} line`}
                  className="w-11 h-11 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-50 transition-colors hover:border-primary/40"
                >
                  <ImageWithFallback
                    src={imageForSku(current.sku)}
                    alt={current.sku}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenLine(current.sku)}
                      className="truncate text-[14px] text-foreground transition-colors hover:text-primary"
                      style={{ fontWeight: 700 }}
                    >
                      {current.sku}
                    </button>
                    <TrackingPill mode={current.trackingMode} />
                  </div>
                  <p className="truncate text-[12px] text-slate-500">{current.description}</p>
                </div>
              </div>
              <span className="shrink-0 inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                <span className="text-[12px] text-gray-900 tabular-nums" style={{ fontWeight: 600 }}>
                  {formatQty(current.qty)} {current.uom}
                </span>
                <span className="text-[11px] text-slate-500">going back</span>
              </span>
            </div>
          )}

          {/* One column for the checklist, since it is one question. Two for
              the sheet it replaced, where the answer led and what it unwound
              sat beside it. */}
          <div
            className={`grid min-h-0 flex-1 items-start gap-3 overflow-y-auto p-3 ${
              layout === 'single'
                ? 'grid-cols-[minmax(0,1fr)]'
                : 'grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingPill({ mode }: { mode: TrackingMode }) {
  return (
    <span
      className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-px text-[10px] text-slate-500"
      style={{ fontWeight: 600 }}
    >
      {TRACKING_LABELS[mode]}
    </span>
  );
}

/** The line sheet's section. Icon chip, what it is, what it is for, the figure
 *  it is about; then a strip of actions; then the work. */
export function ResolveSection({
  icon: Icon,
  title,
  subtitle,
  figure,
  unit,
  money,
  tone = 'done',
  hint,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  figure?: string | undefined;
  unit?: string | undefined;
  money?: string | undefined;
  tone?: 'done' | 'todo' | undefined;
  hint?: string | undefined;
  actions?: ReactNode | undefined;
  children?: ReactNode | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8ECF1] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-[#DBEAFE]">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {title}
            </p>
            <p className="text-[11px] text-slate-500 mt-px">{subtitle}</p>
          </div>
        </div>
        {figure !== undefined && (
          <div className="shrink-0 text-right">
            <p className="tabular-nums leading-none">
              <span
                className={`text-[20px] ${tone === 'done' ? 'text-emerald-700' : 'text-slate-300'}`}
                style={{ fontWeight: 700 }}
              >
                {figure}
              </span>
              {unit && (
                <span className="ml-1 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  {unit}
                </span>
              )}
            </p>
            {money && (
              <p className="mt-1 text-[11px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {money}
              </p>
            )}
          </div>
        )}
      </div>
      {(hint || actions) && (
        <div className="flex items-center justify-between gap-2 border-y border-[#F1F5F9] bg-[#FAFBFC] px-4 py-2">
          <p className="min-w-0 truncate text-[11px] text-slate-500">{hint}</p>
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </div>
      )}
      {children}
    </div>
  );
}

/** The strip's action: a link, not a button, because the work is below it. */
export function SectionAction({
  onClick,
  muted,
  disabled,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  muted?: boolean;
  disabled?: boolean;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      className={`h-6 px-2 rounded-md text-[11px] transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${
        muted ? 'text-slate-500 hover:bg-slate-100' : 'text-primary hover:bg-primary/5'
      }`}
      style={{ fontWeight: 600 }}
    >
      {children}
    </button>
  );
}
