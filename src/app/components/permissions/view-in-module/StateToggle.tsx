import { Check, X } from "lucide-react";
import { cn } from "../../ui/utils";
import { OMNE_BLUE } from "./types";

interface StateToggleProps {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}

export function StateToggle({ isOn, onChange }: StateToggleProps) {
  return (
    <div className="flex rounded-[8px] border border-border bg-muted/50 p-1 gap-1">
      <button
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer",
          isOn ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        style={isOn ? { backgroundColor: OMNE_BLUE } : undefined}
      >
        <Check size={14} />
        Permission On
      </button>
      <button
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer",
          !isOn
            ? "bg-white text-foreground shadow-sm border border-border"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <X size={14} />
        Permission Off
      </button>
    </div>
  );
}
