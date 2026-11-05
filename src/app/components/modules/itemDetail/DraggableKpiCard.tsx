// Mirrors Partners' `DraggableKpiCard` literal pattern: drag-anywhere card,
// hover drag handle, bottom-right remove (×), label + ⓘ tooltip + icon,
// value with optional change indicator. Used inside a DndProvider parent.
import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { GripVertical, Info, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ItemDashKpiIcon, ITEM_DASH_KPI_DND_TYPE } from "./ItemDashKpis";

interface DraggableKpiCardProps {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  iconName?: string;
  tooltip?: string;
  change?: string;
  changeColor?: string;
  moveCard: (from: number, to: number) => void;
  onRemove?: () => void;
}

export function DraggableKpiCard({
  index, kpiKey, label, value, iconName, tooltip, change, changeColor,
  moveCard, onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_DASH_KPI_DND_TYPE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ITEM_DASH_KPI_DND_TYPE,
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

  // Dashed placeholder while dragging — matches Partners
  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none"
        data-kpi-key={kpiKey}
      />
    );
  }

  return (
    <div
      ref={ref}
      data-kpi-key={kpiKey}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-primary/40 hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2">
        {/* Drag handle indicator — top-right */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        {/* Label + info ⓘ + icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-[11px] z-[300]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {iconName && <ItemDashKpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />}
        </div>
        {/* Value + optional change — mirrors Partner DraggableListKpiCard
         * (VendorsListPage.tsx:3966-3986): tabular-nums delta at weight 600,
         * `gap-1`, value uses `truncate` (not `whitespace-nowrap`) so long
         * numbers don't blow the card width. */}
        <div className="flex items-baseline gap-1 min-w-0">
          {change && (
            <span className="text-[10px] tabular-nums shrink-0" style={{ fontWeight: 600, color: changeColor || "#1F9860" }}>{change}</span>
          )}
          <p className="text-[15px] text-slate-700 tracking-tight truncate" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  );
}