import { cn } from "@/lib/utils";

export interface PriorityChipProps {
  priority: number;
  /** Override automatic first-priority detection. Defaults to `priority === 1`. */
  isFirst?: boolean;
  className?: string;
}

/**
 * Circular numeric chip used in the QV table's Priority column.
 * Top priority gets the success-green token; all others use a muted slate.
 */
export function PriorityChip({ priority, isFirst, className }: PriorityChipProps) {
  const first = isFirst ?? priority === 1;
  return (
    <div
      className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold leading-none",
        first
          ? "bg-emerald-600 text-white"
          : "bg-slate-200 text-slate-700",
        className,
      )}
      aria-label={`Priority ${priority}`}
    >
      {priority}
    </div>
  );
}