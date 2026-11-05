/* Row-density control shared by the review grid, the history table and the
 * record page (port of role-zen's data-imports/density.tsx). */
import { createContext, useContext } from "react";
import { AlignJustify, Check, ChevronDown, List } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Density = "comfort" | "condensed";

export const ROW_HEIGHT_COMFORT = 52;
export const ROW_HEIGHT_CONDENSED = 36;

export const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: typeof List }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: AlignJustify },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: List },
];

export const DensityContext = createContext<Density>("comfort");
export function useDensity(): Density {
  return useContext(DensityContext);
}
export function rowHeightFor(density: Density): number {
  return density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
}

export function DensityDropdown({ density, onChange }: { density: Density; onChange: (d: Density) => void }) {
  const current = DENSITY_CONFIG.find((d) => d.key === density) ?? DENSITY_CONFIG[1];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30 shrink-0"
          aria-label="Row density"
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: "#64748B" }} />
          <span className="hidden md:inline" style={{ fontSize: "13px", fontWeight: 500 }}>
            {current.label}
          </span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[200] w-[230px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        {DENSITY_CONFIG.map((opt) => {
          const OptIcon = opt.icon;
          const selected = opt.key === density;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className="flex items-center gap-3 py-2.5 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9] focus:bg-[#F1F5F9]"
            >
              <OptIcon className="w-5 h-5 shrink-0" style={{ color: "#64748B" }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>{opt.label}</div>
                <div style={{ fontSize: "11.5px", color: "#64748B" }}>{opt.description}</div>
              </div>
              {selected && <Check className="w-4 h-4" style={{ color: "#0A77FF" }} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
