import React from "react";

export interface FilterPillOption {
  key: string;
  label: string;
  count?: number;
  showCount?: boolean;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * Reusable filter pill bar matching the partner listing table style.
 * Uses semantic design tokens — no hard-coded fill colors on active state.
 */
export function FilterPills({ options, activeKey, onSelect }: FilterPillsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const isActive = activeKey === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
            }`}
            style={{
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "#0A77FF" : undefined,
            }}
          >
            {opt.label}
            {opt.showCount && opt.count !== undefined && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                  isActive ? "bg-primary/10" : "bg-muted"
                }`}
                style={{
                  fontWeight: 600,
                  color: isActive ? "#0A77FF" : "#475569",
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
