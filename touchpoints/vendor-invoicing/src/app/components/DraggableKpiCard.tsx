import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Info, GripVertical, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { PaymentKpiIcon, type KpiDelta } from '@/app/components/PaymentInsightsPanel';
import { palette } from '@/styles/tokens';

// Shared draggable KPI card — used by the Payments insights grid and the
// Ready-to-pay insights grid. Lives in its own module so both screens can
// import it without a circular dependency.
const DND_KPI_CARD = 'KPI_CARD';

export interface DraggableKpiCardProps {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  valueClass?: string;
  iconName: string;
  /** Opt-in renderer for modules with their own icon set (customer
   *  invoicing, 10/30); defaults to the payments icon set. */
  renderIcon?: (name: string, props: { className: string; style: React.CSSProperties }) => React.ReactNode;
  iconColor: string;
  iconBg: string;
  tooltip?: string;
  /** Active range period label (e.g., "30 days") shown next to the delta. */
  rangeLabel?: string;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
}

export function DraggableKpiCard({
  index,
  label,
  value,
  sub,
  delta,
  iconName,
  renderIcon,
  tooltip,
  rangeLabel,
  moveCard,
  onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_KPI_CARD,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_KPI_CARD,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[80px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? 'border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]'
          : 'border-border hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]'
      }`}
    >
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 truncate" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0">
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                  <p className="text-slate-500">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {renderIcon ? (
            renderIcon(iconName, { className: 'w-3.5 h-3.5 shrink-0', style: { color: palette.slate[400] } })
          ) : (
            <PaymentKpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: palette.slate[400] }} />
          )}
        </div>

        <div className="flex items-baseline gap-1 min-w-0">
          <p className="text-[15px] text-slate-700 tracking-tight truncate min-w-0" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
          {delta && (
            <span
              className="text-[10px] shrink-0 ml-auto"
              style={{
                color: delta.tone === 'positive' ? 'hsl(var(--success))' : delta.tone === 'negative' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
                fontWeight: 600,
              }}
            >
              {delta.text}
            </span>
          )}
        </div>

        {(sub || (delta && rangeLabel)) && (
          <div className="text-[10px] text-slate-400/80 truncate mt-0.5">
            {sub}
            {sub && delta && rangeLabel && <span className="text-slate-300"> · </span>}
            {delta && rangeLabel && <span>vs prior {rangeLabel}</span>}
          </div>
        )}
      </div>

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-rose-50 z-10"
        title={`Remove ${label}`}
        type="button"
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
      </button>
    </div>
  );
}
