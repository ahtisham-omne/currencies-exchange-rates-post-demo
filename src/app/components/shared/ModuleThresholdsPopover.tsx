import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import type { RoleThresholdEntry } from "../../data/role-thresholds-data";

interface ModuleThresholdsPopoverProps {
  thresholds: RoleThresholdEntry[];
  /** Click handler for an individual threshold row, opens detail/edit modal.
   *  Omit it to list the values read-only: the rows keep their name and value
   *  but lose the click, the hover tint and the pointer cursor, so nothing
   *  invites an edit the viewer isn't allowed to make. */
  onThresholdClick?: (threshold: RoleThresholdEntry) => void;
}

/**
 * Compact "N thresholds set" trigger with a hover popover that lists each
 * threshold (name + value). Clicking a row opens its detail modal.
 *
 * Visual + timing matches RoleUsersPopover (the "+N more" pattern).
 */
export function ModuleThresholdsPopover({
  thresholds,
  onThresholdClick,
}: ModuleThresholdsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  const count = thresholds.length;

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const tipW = 300;
    const rowH = 48;
    const headerH = 44;
    const estH = Math.min(thresholds.length, 6) * rowH + headerH;
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
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, vW - tipW - 8));

    setCoords({ top, left });
    setPlacement(place);
  }, [thresholds.length]);

  const enter = useCallback(() => {
    if (count === 0) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      position();
      setOpen(true);
    }, 200);
  }, [position, count]);

  const leave = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  const tipEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const tipLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
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

  if (count === 0) {
    return <span className="text-[13px] text-[#94A3B8]">-</span>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={enter}
        onMouseLeave={leave}
        className="inline-flex items-center gap-1.5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: "#0284C7" }} />
        <span
          className="text-[13px]"
          style={{ fontWeight: 500, color: "#334155" }}
        >
          {count} threshold{count !== 1 ? "s" : ""} set
        </span>
      </div>

      {open &&
        createPortal(
          <div
            onMouseEnter={tipEnter}
            onMouseLeave={tipLeave}
            className="fixed z-[300]"
            style={{
              top: coords.top,
              left: coords.left,
              width: 300,
              animation: "overflowTooltipIn 120ms ease-out forwards",
            }}
          >
            {/* Arrow */}
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
              className="bg-white rounded-[8px] border border-border/50 overflow-hidden"
              style={{
                boxShadow:
                  "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {/* Header */}
              <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                <span
                  className="text-[11px] tracking-wide uppercase text-muted-foreground/70"
                  style={{ fontWeight: 600 }}
                >
                  Thresholds
                </span>
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {count}
                </span>
              </div>

              {/* List */}
              <div
                className={`px-1.5 pb-1.5 ${
                  thresholds.length > 6 ? "overflow-y-auto scrollbar-hide" : ""
                }`}
                style={{
                  maxHeight: thresholds.length > 6 ? 6 * 48 : undefined,
                }}
              >
                {thresholds.map((t) => (
                  <button
                    key={t.permissionId}
                    type="button"
                    disabled={!onThresholdClick}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onThresholdClick?.(t);
                    }}
                    className={`w-full flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md transition-colors text-left ${
                      onThresholdClick ? "cursor-pointer" : "cursor-default"
                    }`}
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={(e) => {
                      if (onThresholdClick) e.currentTarget.style.backgroundColor = "#EDF4FF";
                    }}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <span
                      className="text-[12px] truncate text-foreground w-full"
                      style={{ fontWeight: 550 }}
                    >
                      {t.permissionName}
                    </span>
                    <span
                      className="text-[11px] truncate w-full"
                      style={{ fontWeight: 500, color: "#0284C7" }}
                    >
                      {t.displayValue}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
