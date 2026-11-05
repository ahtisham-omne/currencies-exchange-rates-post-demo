import { cn } from "@/lib/utils";

export interface SegmentedToggleOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SegmentedToggleProps {
  options: SegmentedToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Pill segmented control used to switch between table-level views
 * (e.g. "Vendor Priority Table" / "Vendors Analytics").
 */
export function SegmentedToggle({ options, value, onChange, className }: SegmentedToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-secondary/50 p-1 rounded-lg h-9",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              "px-3 h-7 rounded-md text-xs font-medium transition-all whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              opt.disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}