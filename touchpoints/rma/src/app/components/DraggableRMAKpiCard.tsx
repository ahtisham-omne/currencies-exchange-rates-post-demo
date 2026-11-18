import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Info, GripVertical, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { palette } from '@/styles/tokens';

/**
 * RMA equivalent of DraggableKpiCard — same visual recipe (label +
 * big number + hover reveal of grip + trash) but accepts a React icon
 * component directly instead of routing through PaymentKpiIcon's name
 * map. Every prop / class / motion is copied from DraggableKpiCard so
 * the two KPI grids feel identical.
 */
const DND_KPI_CARD = 'RMA_KPI_CARD';

export interface DraggableRMAKpiCardProps {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg?: string;
  iconColor?: string;
  tooltip?: string;
  /** The currencies behind a money figure, on hover over the value or the
   *  subtitle: "£1,200.00 + $5,900.00" and how they were added up. */
  hover?: { on: 'value' | 'subtitle'; split: string; note: string } | undefined;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
}

export function DraggableRMAKpiCard({
  index,
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  tooltip,
  hover,
  moveCard,
  onRemove,
}: DraggableRMAKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** The value or subtitle, with the currency split on hover when it carries one. */
  const withSplit = (on: 'value' | 'subtitle', node: React.ReactElement) =>
    hover?.on === on ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          <p className="text-[12px] tabular-nums" style={{ fontWeight: 600 }}>{hover.split}</p>
          <p className="text-[11px] opacity-80 mt-0.5">{hover.note}</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      node
    );

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
            <p className="text-[10px] text-slate-500 truncate" style={{ fontWeight: 500 }}>
              {label}
            </p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0"
                  >
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="max-w-[260px] text-[11px] leading-[1.5] z-[300]"
                >
                  <p className="text-slate-500">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Icon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: iconColor ?? palette.slate[400] }}
          />
        </div>

        <div className="flex items-baseline gap-1 min-w-0">
          {withSplit(
            'value',
            <p
              className={`text-[15px] text-slate-700 tracking-tight truncate min-w-0 ${hover?.on === 'value' ? 'cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px]' : ''}`}
              style={{ fontWeight: 600, lineHeight: 1.2 }}
              title={hover?.on === 'value' ? undefined : value}
            >
              {value}
            </p>,
          )}
        </div>

        {sub &&
          withSplit(
            'subtitle',
            <div
              className={`text-[10px] text-slate-400/80 truncate mt-0.5 ${hover?.on === 'subtitle' ? 'cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2' : ''}`}
              title={hover?.on === 'subtitle' ? undefined : sub}
            >
              {sub}
            </div>,
          )}
      </div>

      <div
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none"
        style={{ backgroundColor: iconBg ?? undefined }}
      >
        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-rose-50 z-10"
        title={`Remove ${label}`}
        type="button"
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
      </button>
    </div>
  );
}
