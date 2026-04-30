import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Package, MapPin, User, FileText } from "lucide-react";

/* ─── Types ─── */

export interface OverflowItem {
  id: string;
  name: string;
  subtitle: string;
  icon?: ReactNode;
  initials?: string;
  avatarBg?: string;
  avatarFg?: string;
  meta?: Record<string, unknown>;
}

interface OverflowTooltipProps {
  items: OverflowItem[];
  category: string;
  children: ReactNode;
  onItemClick?: (item: OverflowItem) => void;
}

/* ─── Helpers ─── */

function getCategoryIcon(category: string): ReactNode {
  const c = category.toLowerCase();
  if (c.includes("item") || c.includes("line")) return <Package className="w-3.5 h-3.5" />;
  if (c.includes("location") || c.includes("warehouse")) return <MapPin className="w-3.5 h-3.5" />;
  if (c.includes("contact") || c.includes("rep")) return <User className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function getCategoryColor(category: string): { bg: string; fg: string } {
  const c = category.toLowerCase();
  if (c.includes("item") || c.includes("line")) return { bg: "#EFF6FF", fg: "#2563EB" };
  if (c.includes("location") || c.includes("warehouse")) return { bg: "#F0FDF4", fg: "#16A34A" };
  if (c.includes("contact") || c.includes("rep")) return { bg: "#F5F3FF", fg: "#7C3AED" };
  return { bg: "#F1F5F9", fg: "#64748B" };
}

function getMaxVisible(): number {
  if (typeof window === "undefined") return 5;
  const h = window.innerHeight;
  if (h < 600) return 3;
  if (h < 768) return 4;
  return 5;
}

function getTipWidth(): number {
  if (typeof window === "undefined") return 240;
  const w = window.innerWidth;
  if (w < 640) return 200;
  if (w < 1024) return 220;
  return 240;
}

/* ─── Component ─── */

export function OverflowTooltip({ items, category, children, onItemClick }: OverflowTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const w = getTipWidth();
    const rowH = 46;
    const estH = Math.min(items.length, getMaxVisible()) * rowH + 44;
    const vH = window.innerHeight;
    const vW = window.innerWidth;

    let place: "bottom" | "top" = "bottom";
    let top: number;
    if (r.bottom + estH + 8 > vH && r.top - estH - 8 > 0) {
      place = "top";
      top = r.top - estH - 6;
    } else {
      top = r.bottom + 6;
    }
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vW - w - 8));

    setCoords({ top, left });
    setPlacement(place);
  }, [items.length]);

  const enter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => { position(); setOpen(true); }, 180);
  }, [position]);

  const leave = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const tipEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const tipLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  useEffect(() => {
    if (!open) return;
    const r = () => position();
    window.addEventListener("scroll", r, true);
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("scroll", r, true); window.removeEventListener("resize", r); };
  }, [open, position]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const max = getMaxVisible();
  const tipW = getTipWidth();
  const scrollable = items.length > max;
  const color = getCategoryColor(category);

  return (
    <>
      <span ref={triggerRef} onMouseEnter={enter} onMouseLeave={leave} className="cursor-default">
        {children}
      </span>

      {open && createPortal(
        <div
          onMouseEnter={tipEnter}
          onMouseLeave={tipLeave}
          className="fixed z-[300]"
          style={{ top: coords.top, left: coords.left, width: tipW, animation: "overflowTooltipIn 120ms ease-out forwards" }}
        >
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2" style={placement === "bottom" ? { top: -4 } : { bottom: -4 }}>
            <div className="w-2 h-2 rotate-45 bg-white border-border/50" style={placement === "bottom" ? { borderTopWidth: 1, borderLeftWidth: 1 } : { borderBottomWidth: 1, borderRightWidth: 1 }} />
          </div>

          <div className="bg-white rounded-lg border border-border/50 overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}>
            {/* Header */}
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>{category}</span>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{items.length}</span>
            </div>

            {/* Items */}
              <div className={`px-1.5 pb-1.5 ${scrollable ? "overflow-y-auto scrollbar-hide" : ""}`} style={{ maxHeight: scrollable ? max * 46 : undefined }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onItemClick?.(item);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-primary/[0.04] cursor-pointer text-left"
                >
                  {item.initials ? (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                      style={{ backgroundColor: item.avatarBg || color.bg, color: item.avatarFg || color.fg, fontWeight: 600 }}
                    >
                      {item.initials}
                    </div>
                  ) : (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {item.icon || getCategoryIcon(category)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] truncate text-foreground" style={{ fontWeight: 500 }}>{item.name}</div>
                    {item.subtitle ? (
                      <div className="text-[10px] truncate text-muted-foreground/60 mt-0.5">{item.subtitle}</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>

            {/* Scroll hint */}
            {scrollable && (
              <div className="px-3 pb-1.5">
                <span className="text-[10px] text-muted-foreground/40 italic">Scroll for more</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
