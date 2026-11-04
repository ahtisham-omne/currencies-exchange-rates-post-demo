import React, { useState, useRef, useCallback, useEffect } from "react";
import { Package, Clock, Star, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

interface ShippingMethod {
  id: string;
  name: string;
  desc: string;
  days: string;
  isDefault?: boolean;
}

// ── Quick View Card for a Shipping Method ──
function MethodQuickViewCard({
  method,
  onRemove,
}: {
  method: ShippingMethod;
  onRemove?: () => void;
}) {
  return (
    <div className="w-[260px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
      <div className="bg-gradient-to-br from-[hsl(var(--foreground))] to-[hsl(222,47%,31%)] px-3.5 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-3.5 h-3.5 text-white/70 shrink-0" />
            <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
              {method.name}
            </span>
          </div>
          {method.isDefault && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[hsl(var(--primary))]/25 text-[hsl(213,90%,68%)] shrink-0"
              style={{ fontWeight: 600 }}
            >
              <Star className="w-2.5 h-2.5 fill-[hsl(213,90%,68%)]" /> Default
            </span>
          )}
        </div>
      </div>
      <div className="bg-card px-3.5 py-3 space-y-2.5">
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
          {method.desc}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3 text-muted-foreground/60" />
            <span style={{ fontWeight: 500 }}>{method.days}</span>
          </div>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-[11px] text-destructive hover:underline"
              style={{ fontWeight: 500 }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single Chip with Hover Popover ──
function MethodChipWithPopover({
  method,
  onRemove,
}: {
  method: ShippingMethod;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors cursor-default shrink-0 ${
          method.isDefault
            ? "bg-primary/5 text-primary border-primary/25"
            : "bg-muted/40 text-foreground border-border hover:border-muted-foreground/30 hover:bg-muted/60"
        }`}
        style={{ fontWeight: 500 }}
      >
        {method.isDefault && <Star className="w-2.5 h-2.5 fill-primary text-primary" />}
        {method.name}
        <span className="text-[10px] text-muted-foreground" style={{ fontWeight: 400 }}>
          · {method.days}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MethodQuickViewCard method={method} onRemove={onRemove} />
      </PopoverContent>
    </Popover>
  );
}

// ── Overflow "+X more" Chip ──
function OverflowMethodsChip({
  methods,
  onRemove,
}: {
  methods: ShippingMethod[];
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredMethod, setHoveredMethod] = useState<ShippingMethod | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => { setOpen(false); setHoveredMethod(null); }, 200);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setHoveredMethod(null); } }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-border bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 transition-colors cursor-default shrink-0"
        style={{ fontWeight: 500 }}
      >
        +{methods.length} more
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-2">
          <div className="w-[220px] rounded-xl border border-border/60 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>
                +{methods.length} more method{methods.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {methods.map((m) => {
                const isHovered = hoveredMethod?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onMouseEnter={() => setHoveredMethod(m)}
                    className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left cursor-default ${
                      isHovered ? "bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <Package className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span
                      className={`text-[12px] truncate ${isHovered ? "text-primary" : "text-foreground"}`}
                      style={{ fontWeight: 500 }}
                    >
                      {m.name}
                    </span>
                    {m.isDefault && <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{m.days}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {hoveredMethod && (
            <div className="shrink-0 animate-in fade-in-0 slide-in-from-left-2 duration-150">
              <MethodQuickViewCard method={hoveredMethod} onRemove={() => onRemove(hoveredMethod.id)} />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ──
export function ShippingMethodChipsRow({
  methods,
  onRemove,
}: {
  methods: ShippingMethod[];
  onRemove: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState(methods.length);
  const measureRef = useRef<HTMLDivElement>(null);

  // Measure how many chips fit in one row
  useEffect(() => {
    if (!containerRef.current || methods.length === 0) return;
    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const chips = container.querySelectorAll<HTMLElement>("[data-chip]");
    let usedWidth = 0;
    let fits = 0;
    const overflowChipWidth = 70; // approximate width of "+X more" chip

    for (let i = 0; i < chips.length; i++) {
      const chipWidth = chips[i].offsetWidth + 6; // 6px gap
      const remaining = methods.length - (i + 1);
      const needsOverflow = remaining > 0;
      if (usedWidth + chipWidth + (needsOverflow ? overflowChipWidth : 0) <= containerWidth) {
        usedWidth += chipWidth;
        fits++;
      } else {
        break;
      }
    }
    setMaxVisible(Math.max(1, fits));
  }, [methods]);

  if (methods.length === 0) return null;

  const visibleMethods = methods.slice(0, maxVisible);
  const overflowMethods = methods.slice(maxVisible);

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 min-w-0 overflow-hidden mt-1">
      {/* Hidden measure layer */}
      <div ref={measureRef} className="contents">
        {visibleMethods.map((m) => (
          <div key={m.id} data-chip>
            <MethodChipWithPopover method={m} onRemove={() => onRemove(m.id)} />
          </div>
        ))}
      </div>
      {overflowMethods.length > 0 && (
        <OverflowMethodsChip methods={overflowMethods} onRemove={onRemove} />
      )}
    </div>
  );
}
