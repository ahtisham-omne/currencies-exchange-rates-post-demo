import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LayoutGrid, Menu, List } from "lucide-react";
import { cn } from "../ui/utils";

export type AlertModuleView = "condensed" | "comfort" | "card";

const OPTIONS: {
  id: AlertModuleView;
  label: string;
  description: string;
  icon: typeof Menu;
}[] = [
  { id: "condensed", label: "Condensed", description: "Compact view", icon: Menu },
  { id: "comfort", label: "Comfort", description: "Spacious view", icon: List },
  { id: "card", label: "Card View", description: "Grid layout", icon: LayoutGrid },
];

export function ViewSwitcher({
  value,
  onChange,
  hideCard = false,
}: {
  value: AlertModuleView;
  onChange: (v: AlertModuleView) => void;
  hideCard?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = hideCard ? OPTIONS.filter((o) => o.id !== "card") : OPTIONS;
  const current = options.find((o) => o.id === value) ?? options[options.length - 1];
  const CurrentIcon = current.icon;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center h-9 gap-2 px-3 rounded-md border bg-white shadow-sm transition-colors cursor-pointer outline-none",
          open
            ? "border-[#0A77FF] bg-[#EFF6FF] text-[#0A77FF]"
            : "border-border/80 text-[#334155] hover:bg-muted/50"
        )}
      >
        <CurrentIcon className="w-4 h-4" style={{ color: open ? "#0A77FF" : "#94A3B8" }} />
        <span className="text-[13px]" style={{ fontWeight: 500 }}>
          {current.label}
        </span>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: open ? "#0A77FF" : "#94A3B8" }} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[240px] bg-white border border-[#E2E8F0] rounded-xl py-1.5 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                <Icon className="w-4 h-4 text-[#64748B] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[#0F172A]"
                    style={{ fontSize: "13.5px", fontWeight: 600, lineHeight: "1.3" }}
                  >
                    {opt.label}
                  </div>
                  <div
                    className="text-[#64748B]"
                    style={{ fontSize: "12px", fontWeight: 400, lineHeight: "1.4" }}
                  >
                    {opt.description}
                  </div>
                </div>
                {active && <Check className="w-4 h-4 text-[#0A77FF] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
