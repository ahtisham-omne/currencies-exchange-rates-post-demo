import { useRef, type ComponentType, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useDrag, useDrop } from "react-dnd";
import { ArrowRight } from "lucide-react";

export interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  path: string;
  enabled: boolean;
  /** False for a card that looks and hovers like any other but goes nowhere on
   *  click. Distinct from `enabled: false`, which greys the card and badges it
   *  "Soon"; this leaves the card visually untouched. */
  navigable?: boolean;
  /** When set, clicking the card opens this URL in a new tab instead of navigating in-app. */
  externalUrl?: string;
}

interface DraggableModuleCardProps {
  mod: ModuleCard;
  index: number;
  moveCard: (from: number, to: number) => void;
  onNavigate: (path: string) => void;
  /** react-dnd item type. Scope per overview page so cards from different pages don't accept each other. */
  dndType: string;
}

/** Draggable feature card used in overview pages (Company Setup, Items & Inventory, …).
 *  When `mod.enabled` is false, shows a "Soon" badge and disables click navigation. */
export function DraggableModuleCard({ mod, index, moveCard, onNavigate, dndType }: DraggableModuleCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: dndType,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: dndType,
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

  const Icon = mod.icon;
  const isComingSoon = !mod.enabled;

  // Track mouse movement to distinguish click from drag
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: ReactMouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5 && !isComingSoon && mod.navigable !== false) {
      if (mod.externalUrl) {
        window.open(mod.externalUrl, "_blank", "noopener,noreferrer");
      } else {
        onNavigate(mod.path);
      }
    }
  };

  /* Faded ghost while dragging */
  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] min-h-[88px] opacity-40 pointer-events-none"
      >
        <div className="px-3.5 pt-3 pb-3">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-2 opacity-50"
            style={{ backgroundColor: mod.iconBg }}
          >
            <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
          </div>
          <p className="text-[13px] mb-0.5 opacity-50" style={{ fontWeight: 500 }}>
            {mod.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed opacity-50">
            {mod.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`group/card relative text-left bg-card border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200 ${
        isOver
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02]"
          : isComingSoon
            ? "border-border hover:border-border cursor-grab active:cursor-grabbing"
            : "border-border hover:shadow-md hover:border-primary/20 cursor-pointer active:cursor-grabbing"
      }`}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
      )}

      {/* Top-right corner: "Open →" on hover for enabled cards, "Soon" badge for disabled */}
      {isComingSoon ? (
        <div className="absolute top-2.5 right-2.5 z-10">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px]"
            style={{
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              fontWeight: 500,
            }}
          >
            Soon
          </span>
        </div>
      ) : (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
          <span
            className="inline-flex items-center gap-0.5 text-[11px]"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            Open
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}

      <div
        className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-2"
        style={{
          backgroundColor: mod.iconBg,
          opacity: isComingSoon ? 0.55 : 1,
        }}
      >
        <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
      </div>
      <p
        className="text-[13px] mb-0.5"
        style={{
          fontWeight: 500,
          color: isComingSoon ? "#64748B" : undefined,
        }}
      >
        {mod.title}
      </p>
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: isComingSoon ? "#94A3B8" : undefined }}
      >
        <span className={isComingSoon ? "" : "text-muted-foreground"}>
          {mod.description}
        </span>
      </p>
    </div>
  );
}
