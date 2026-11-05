/* Resizable columns for the import record page, the way the Review and Fix grid resizes them:
   a 5px grip on the header's right edge, drag to resize, double-click to reset. Same limits
   as the review grid (80px to 255 * 7). */

import { useCallback, useState } from "react";

const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 255 * 7;

export function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [resizingKey, setResizingKey] = useState<string | null>(null);

  /** The column's width: its resized width, else its default. */
  const widthOf = useCallback((key: string, fallback: number) => widths[key] ?? fallback, [widths]);

  const start = useCallback((e: React.MouseEvent, key: string, current: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    setResizingKey(key);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, current + ev.clientX - startX));
      setWidths((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setResizingKey(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  /** The grip, placed inside a header cell that is `position: relative`. */
  const grip = (key: string, current: number) => (
    <div
      onMouseDown={(e) => start(e, key, current)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setWidths((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }}
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
      style={{ touchAction: "none" }}
      title="Drag to resize · double-click to reset"
    >
      <div
        className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${
          resizingKey === key ? "bg-[#0A77FF]" : "bg-transparent group-hover/resize:bg-[#0A77FF]/40"
        }`}
      />
    </div>
  );

  return { widthOf, grip };
}
