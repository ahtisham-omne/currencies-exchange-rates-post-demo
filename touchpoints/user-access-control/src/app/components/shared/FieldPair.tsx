import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";

/** Reusable label + value pair for review/detail cards. */
export function FieldPair({
  label,
  value,
  highlight,
  green,
}: {
  label: string;
  value: string | number | undefined | null;
  highlight?: boolean;
  green?: boolean;
}) {
  const isEmpty = !value || value === "-" || value === "Not set";
  const displayValue = String(value || "-");
  return (
    <div className="min-w-0">
      <p
        className="mb-1 truncate"
        style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
      >
        {label}
      </p>
      <Tooltip>
        <TooltipTrigger asChild>
          <p
            className="text-[13px] truncate"
            style={{
              fontWeight: isEmpty ? 400 : 500,
              color: green ? "#10b981" : highlight ? "#2563eb" : isEmpty ? "#94A3B8" : "#1E293B",
              fontStyle: isEmpty ? "italic" : "normal",
            }}
          >
            {displayValue}
          </p>
        </TooltipTrigger>
        {!isEmpty && displayValue.length > 25 && (
          <TooltipContent side="top" sideOffset={4} className="max-w-[300px] text-[12px]">
            {displayValue}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
