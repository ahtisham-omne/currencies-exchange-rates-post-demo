import { useEffect, useRef, useState } from "react";
import { Columns3, Eye, EyeOff, RotateCcw, Search, X, Lock } from "lucide-react";
import { cn } from "../ui/utils";
import { highlightMatch } from "../../lib/highlight-text";

export interface ColumnDef {
  key: string;
  label: string;
  pinned?: boolean;
}

interface ColumnsButtonProps {
  columns: ColumnDef[];
  visibility: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  disabled?: boolean;
}

export function ColumnsButton({ columns, visibility, onChange, disabled = false }: ColumnsButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const visibleCount = columns.filter((c) => c.pinned || visibility[c.key] !== false).length;
  const totalCount = columns.length;

  const pinned = columns.filter((c) => c.pinned);
  const togglable = columns.filter((c) => !c.pinned);
  const filteredTogglable = togglable.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const showAll = () => {
    const next: Record<string, boolean> = {};
    columns.forEach((c) => (next[c.key] = true));
    onChange(next);
  };
  const hideAll = () => {
    const next: Record<string, boolean> = { ...visibility };
    togglable.forEach((c) => (next[c.key] = false));
    onChange(next);
  };
  const reset = () => {
    const next: Record<string, boolean> = {};
    columns.forEach((c) => (next[c.key] = true));
    onChange(next);
  };
  const toggle = (key: string) => {
    onChange({ ...visibility, [key]: visibility[key] === false ? true : false });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center h-9 gap-2 px-3 rounded-md border bg-white shadow-sm transition-colors outline-none",
          disabled
            ? "border-border/60 text-[#94A3B8] opacity-60 cursor-not-allowed"
            : open
            ? "border-[#0A77FF] bg-[#EFF6FF] text-[#0A77FF] cursor-pointer"
            : "border-border/80 text-[#334155] hover:bg-muted/50 cursor-pointer"
        )}
      >
        <Columns3 className="w-4 h-4" style={{ color: disabled ? "#CBD5E1" : open ? "#0A77FF" : "#94A3B8" }} />
        <span className="text-[13px]" style={{ fontWeight: 500 }}>
          Columns
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px] tabular-nums",
            disabled ? "bg-[#F1F5F9] text-[#94A3B8]" : open ? "bg-white text-[#0A77FF]" : "bg-[#F1F5F9] text-[#64748B]"
          )}
          style={{ fontWeight: 600 }}
        >
          {visibleCount}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[300px] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)] overflow-hidden">
          <div className="px-3.5 pt-3 pb-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Columns3 className="w-4 h-4" style={{ color: "#0A77FF" }} />
                <span className="text-[#0F172A]" style={{ fontSize: "13.5px", fontWeight: 600 }}>
                  Columns
                </span>
                <span
                  className="inline-flex items-center justify-center px-1.5 h-[18px] rounded-full bg-[#EFF6FF] text-[#0A77FF]"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                >
                  {visibleCount}/{totalCount}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 inline-flex items-center justify-center rounded text-[#64748B] hover:bg-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#CBD5E1" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search columns..."
                className="w-full pl-8 pr-2.5 h-8 text-[12.5px] bg-white border border-[#E2E8F0] rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/15"
              />
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-3">
                <button onClick={showAll} className="inline-flex items-center gap-1 text-[#0A77FF] hover:underline" style={{ fontWeight: 500 }}>
                  <Eye className="w-3.5 h-3.5" />
                  Show All
                </button>
                <button onClick={hideAll} className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A]" style={{ fontWeight: 500 }}>
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide All
                </button>
              </div>
              <button onClick={reset} className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A]" style={{ fontWeight: 500 }}>
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {pinned.length > 0 && (
              <>
                <div className="px-3.5 pt-2 pb-1 text-[#94A3B8] uppercase" style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em" }}>
                  Pinned
                </div>
                {pinned.map((c) => (
                  <div key={c.key} className="flex items-center justify-between px-3.5 py-2 text-[13px] text-[#0F172A]">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span style={{ fontWeight: 500 }}>{c.label}</span>
                    </div>
                    <Eye className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                  </div>
                ))}
                <div className="my-1 border-t border-[#F1F5F9]" />
              </>
            )}

            <div className="px-3.5 pt-2 pb-1 text-[#94A3B8] uppercase" style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em" }}>
              Columns
            </div>
            {filteredTogglable.length === 0 ? (
              <div className="px-3.5 py-3 text-[12.5px] text-[#94A3B8]">No Columns Found</div>
            ) : (
              filteredTogglable.map((c) => {
                const isVisible = visibility[c.key] !== false;
                return (
                  <button
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded", isVisible ? "bg-[#EFF6FF]" : "bg-[#F1F5F9]")}>
                        {isVisible ? <Eye className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} /> : <EyeOff className="w-3.5 h-3.5 text-[#94A3B8]" />}
                      </span>
                      <span style={{ fontWeight: 500 }}>{highlightMatch(c.label, query)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
