/**
 * QVCardList — Qualified Vendor cards mirroring Partners' ShippingMethodCarrierCard
 * exactly. One outer card per vendor with:
 *   • Row 1 — avatar + name + location (desc) | priority badge
 *   • Row 2 — hero metric: price + "/ uom" + "per unit" label (mirrors "1–2 days delivery")
 *   • Row 3 — single tier chip: Lead Time (mirrors "Air ⭐ / Ground" chips)
 *   • Row 4 — applied pricing rule pill (mirrors "FedEx Express (Air) · 1–2 days")
 *
 * Click card → detail modal. Drag handle on left rail → reorder priority.
 * Hover ⋯ menu → View Details / Remove.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  GripVertical,
  MoreHorizontal,
  Eye,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QualifiedVendor } from "../../../context/purchasing/types";
import { InitialAvatar } from "../../items-v3/InitialAvatar";
import { PriorityChip } from "../../items-v3/PriorityChip";
import { Money } from "../../currency/Money";
import { qvRate } from "../../../currency/vendorFx";

interface QVCardProps {
  qv: QualifiedVendor;
  onClick: (qv: QualifiedVendor) => void;
  onEdit?: (qv: QualifiedVendor) => void;
  onRemove?: (qv: QualifiedVendor) => void;
}

function SortableQVCard({
  qv,
  onClick,
  onEdit,
  onRemove,
}: QVCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: qv.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(qv)}
      className={cn(
        "group bg-white border rounded-xl cursor-pointer transition-all duration-200 flex flex-col relative",
        "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]",
        isDragging && "border-primary shadow-md",
      )}
    >
      {/* Drag handle — top-left, hover-only, mirrors Partners' hover-X affordance */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        title={`Drag to reorder — currently priority ${qv.priority}`}
        aria-label={`Drag vendor priority ${qv.priority}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <div className="p-3 flex items-center gap-3 min-h-0 overflow-hidden">
        {/* Priority chip — left rail */}
        <PriorityChip priority={qv.priority} />

        {/* Vendor identity */}
        <InitialAvatar name={qv.vendorName} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
            {qv.vendorName}
          </p>
          <p className="text-[11px] text-slate-500 truncate leading-relaxed mt-0.5" style={{ fontWeight: 400 }}>
            {qv.location}
          </p>
        </div>

        {/* Price + UOM */}
        <div className="flex items-baseline gap-1 shrink-0 px-3 border-l border-border/60">
          {/* In the vendor's currency (spec 4.1); the hover gives the base equivalent. */}
          <span className="text-[15px] text-slate-700 tabular-nums" style={{ fontWeight: 700 }}>
            <Money value={qv.pricePerUnit} currency={qv.currency} fx={qvRate(qv)} />
          </span>
          <span className="text-[12px] text-slate-500 tabular-nums" style={{ fontWeight: 600 }}>
            / {qv.vendorUOM}
          </span>
        </div>

        {/* Lead time */}
        <div className="inline-flex items-center gap-1 text-[12px] text-slate-500 tabular-nums shrink-0 px-3 border-l border-border/60" style={{ fontWeight: 600 }}>
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {qv.lastPOLeadTime}d
        </div>
      </div>

      {/* Hover ⋯ menu — top-right, mirrors Partners' hover-X corner affordance */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-foreground hover:border-slate-300 transition-all opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 flex items-center justify-center cursor-pointer"
            title="More actions"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <DropdownMenuItem onSelect={() => onEdit(qv)} className="text-sm cursor-pointer">
              <Eye className="w-3.5 h-3.5 mr-2" /> View Details
            </DropdownMenuItem>
          )}
          {onRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onRemove(qv)}
                className="text-sm cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export interface QVCardListProps {
  qvs: QualifiedVendor[];
  onReorder: (qvs: QualifiedVendor[]) => void;
  onCardClick: (qv: QualifiedVendor) => void;
  onEdit?: (qv: QualifiedVendor) => void;
  onRemove?: (qv: QualifiedVendor) => void;
}

export function QVCardList({
  qvs,
  onReorder,
  onCardClick,
  onEdit,
  onRemove,
}: QVCardListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = qvs.findIndex((q) => q.id === active.id);
    const newIdx = qvs.findIndex((q) => q.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(qvs, oldIdx, newIdx).map((q, i) => ({
      ...q,
      priority: i + 1,
    }));
    onReorder(next);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={qvs.map((q) => q.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {qvs.map((qv) => (
              <SortableQVCard
                key={qv.id}
                qv={qv}
                onClick={onCardClick}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
