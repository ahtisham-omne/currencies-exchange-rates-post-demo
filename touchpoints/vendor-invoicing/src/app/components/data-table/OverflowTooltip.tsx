import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Package, MapPin, User, FileText, ArrowRight } from "lucide-react";
import { palette } from '@/styles/tokens';

export interface OverflowItem {
  id: string;
  name: string;
  subtitle: string;
  subtitleHref?: string;
  icon?: ReactNode;
  initials?: string;
  avatarBg?: string;
  avatarFg?: string;
  imageUrl?: string;
  nameHref?: string;
  meta?: Record<string, unknown>;
}

interface OverflowTooltipProps {
  items: OverflowItem[];
  category: string;
  children: ReactNode;
  onItemClick?: (item: OverflowItem) => void;
  viewMoreHref?: string;
  onViewMore?: () => void;
  viewMoreLabel?: string;
}

const TOOLTIP_MAX_VISIBLE = 10;
const TOOLTIP_SCROLL_VISIBLE = 5;

function getCategoryIcon(category: string): ReactNode {
  const c = category.toLowerCase();
  if (c.includes("item")) return <Package className="w-3.5 h-3.5" />;
  if (c.includes("location")) return <MapPin className="w-3.5 h-3.5" />;
  if (c.includes("contact")) return <User className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function getCategoryColor(category: string): { bg: string; fg: string } {
  const c = category.toLowerCase();
  if (c.includes("item")) return { bg: palette.blue[50], fg: palette.blue[600] };
  if (c.includes("location")) return { bg: palette.green[50], fg: palette.green[600] };
  if (c.includes("contact")) return { bg: palette.violet[50], fg: "hsl(var(--violet))" };
  if (c.includes("po") || c.includes("purchase")) return { bg: palette.blue[50], fg: palette.blue[600] };
  if (c.includes("grn") || c.includes("receiving")) return { bg: palette.green[50], fg: palette.green[600] };
  return { bg: "hsl(var(--muted))", fg: palette.slate[500] };
}

function getMaxRendered(): number {
  if (typeof window === "undefined") return TOOLTIP_MAX_VISIBLE;
  const h = window.innerHeight;
  if (h < 600) return Math.min(7, TOOLTIP_MAX_VISIBLE);
  return TOOLTIP_MAX_VISIBLE;
}

function getTipWidth(): number {
  if (typeof window === "undefined") return 280;
  const w = window.innerWidth;
  if (w < 640) return 220;
  if (w < 1024) return 250;
  return 280;
}

export function OverflowTooltip({
  items,
  category,
  children,
  onItemClick,
  viewMoreHref,
  onViewMore,
  viewMoreLabel,
}: OverflowTooltipProps) {
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
    const rowH = 44;
    const visibleCap = Math.min(items.length, TOOLTIP_SCROLL_VISIBLE);
    const estH = visibleCap * rowH + 40;
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
    openTimer.current = setTimeout(() => {
      position();
      setOpen(true);
    }, 180);
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
    return () => {
      window.removeEventListener("scroll", r, true);
      window.removeEventListener("resize", r);
    };
  }, [open, position]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    []
  );

  const max = getMaxRendered();
  const tipW = getTipWidth();
  const visibleItems = items.slice(0, max);
  const overflowCount = Math.max(0, items.length - max);
  const showViewMore = overflowCount > 0;
  const isScrollable = items.length > TOOLTIP_SCROLL_VISIBLE;
  const color = getCategoryColor(category);
  const scrollMaxHeight = TOOLTIP_SCROLL_VISIBLE * 44;

  const handleViewMore = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (onViewMore) onViewMore();
  };

  return (
    <>
      <span ref={triggerRef} onMouseEnter={enter} onMouseLeave={leave} className="cursor-default">
        {children}
      </span>

      {open &&
        createPortal(
          <div
            onMouseEnter={tipEnter}
            onMouseLeave={tipLeave}
            // pointer-events-auto: a Radix modal (e.g. the reason dialogs)
            // sets pointer-events:none on the body, which would make this
            // portaled panel unhoverable — it would close before the user
            // could scroll or click it.
            className="fixed z-[300] pointer-events-auto"
            style={{
              top: coords.top,
              left: coords.left,
              width: tipW,
              animation: "overflowTooltipIn 120ms ease-out forwards",
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={placement === "bottom" ? { top: -4 } : { bottom: -4 }}
            >
              <div
                className="w-2 h-2 rotate-45 bg-white border-border/50"
                style={
                  placement === "bottom"
                    ? { borderTopWidth: 1, borderLeftWidth: 1 }
                    : { borderBottomWidth: 1, borderRightWidth: 1 }
                }
              />
            </div>

            <div
              className="bg-white rounded-lg border border-border/50 overflow-hidden"
              style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                <span
                  className="text-[11px] tracking-wide text-muted-foreground/70"
                  style={{ fontWeight: 600 }}
                >
                  {category}
                </span>
                <span className="text-[10px] text-muted-foreground/50 ">{items.length}</span>
              </div>

              <div
                className={`px-1.5 pb-1.5 ${isScrollable ? "overflow-y-auto" : ""}`}
                style={isScrollable ? { maxHeight: scrollMaxHeight } : undefined}
              >
                {visibleItems.map((item) => {
                  const openItem = (e: React.SyntheticEvent) => {
                    e.stopPropagation();
                    setOpen(false);
                    onItemClick?.(item);
                  };
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={openItem}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openItem(e);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-muted cursor-pointer text-left group/ovitem"
                    >
                      {item.imageUrl ? (
                        <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-muted border border-[#E8ECF1]">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : item.initials ? (
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                          style={{
                            backgroundColor: item.avatarBg || color.bg,
                            color: item.avatarFg || color.fg,
                            fontWeight: 600,
                          }}
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
                        {item.nameHref ? (
                          <a
                            href={item.nameHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(false);
                            }}
                            className="text-[12px] truncate block text-foreground hover:text-primary hover:underline transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            {item.name}
                          </a>
                        ) : (
                          <span
                            className="text-[12px] truncate block text-foreground group-hover/ovitem:text-primary group-hover/ovitem:underline transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            {item.name}
                          </span>
                        )}
                        {item.subtitle &&
                          (item.subtitleHref ? (
                            <a
                              href={item.subtitleHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-muted-foreground/60 block truncate hover:text-primary hover:underline transition-colors"
                            >
                              {item.subtitle}
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 block truncate">
                              {item.subtitle}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {showViewMore && (
                <div className="border-t border-border/40">
                  {viewMoreHref ? (
                    <a
                      href={viewMoreHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleViewMore}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                      style={{ fontWeight: 600 }}
                    >
                      <span>{viewMoreLabel ?? `View All ${items.length} ${category}`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleViewMore}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                      style={{ fontWeight: 600 }}
                    >
                      <span>{viewMoreLabel ?? `View All ${items.length} ${category}`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
