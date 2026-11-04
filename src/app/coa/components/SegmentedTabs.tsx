// Ported from Cash Management (cash-management-v2/src/app/components/cash-management/SegmentedTabs.tsx), unchanged: the "Accounts | Bank Transactions" switch atop the Banking table card.
import type { LucideIcon } from "lucide-react";

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  icon?: LucideIcon;
  color?: string;
  count?: number;
}

interface SegmentedTabsProps<K extends string> {
  tabs: SegmentedTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedTabs<K extends string>({
  tabs,
  activeKey,
  onChange,
  className,
  ariaLabel,
}: SegmentedTabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex w-fit self-start items-center rounded-lg bg-[#F1F5F9] p-0.5 ${className ?? ""}`}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeKey === t.key;
        const accent = t.color ?? "#0A77FF";
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
              isActive
                ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                : "text-[#64748B] hover:text-[#334155]"
            }`}
            style={{
              fontWeight: isActive ? 600 : 500,
              color: isActive ? accent : undefined,
            }}
          >
            {Icon && (
              <Icon
                className="w-3.5 h-3.5"
                style={{ color: isActive ? accent : "#94A3B8" }}
              />
            )}
            {t.label}
            {typeof t.count === "number" && (
              <span
                className="ml-0.5 text-[11px] rounded-full px-1.5 py-px tabular-nums"
                style={{
                  backgroundColor: isActive ? "#EDF4FF" : "#E2E8F0",
                  color: isActive ? accent : "#64748B",
                  fontWeight: 600,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
