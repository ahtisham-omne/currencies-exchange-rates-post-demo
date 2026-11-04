import { AlignJustify, List, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';

export type DensityOption = 'condensed' | 'comfort' | 'card';
export type CardSize = 'small' | 'medium' | 'large';

/* Canonical view/density dropdown, ported 1:1 from the partner module
 * (PartnerGroupsPage density dropdown) per design review 7/9/26: item
 * descriptions match the partner copy, Comfort uses the List icon, and
 * card size is a segmented Large | Medium | Small pill strip instead of
 * stacked menu items. */
const DENSITY_CONFIG: { key: DensityOption; label: string; description: string }[] = [
  { key: 'condensed', label: 'Condensed', description: 'Compact table view' },
  { key: 'comfort', label: 'Comfort', description: 'Spacious table view' },
  { key: 'card', label: 'Card View', description: 'Grid of cards' },
];

const DENSITY_ICON: Record<DensityOption, typeof AlignJustify> = {
  condensed: AlignJustify,
  comfort: List,
  card: LayoutGrid,
};

interface ViewDensityMenuProps {
  density: DensityOption;
  onDensityChange: (next: DensityOption) => void;
  cardSize?: CardSize;
  onCardSizeChange?: (next: CardSize) => void;
  /** Tables with no card layout (user 9/26: the payments listing) hide
   *  the Card View entry but keep the standard Condensed/Comfort pair. */
  hideCard?: boolean;
  /** Sizes parked for a later phase (user 9/28: Large on invoices) —
   *  rendered greyed with a next-phase tooltip, never clickable. */
  disabledCardSizes?: CardSize[];
}

export function ViewDensityMenu({ density, onDensityChange, cardSize = 'medium', onCardSizeChange, hideCard = false, disabledCardSizes = [] }: ViewDensityMenuProps) {
  const TriggerIcon = DENSITY_ICON[density];
  const options = hideCard ? DENSITY_CONFIG.filter((d) => d.key !== 'card') : DENSITY_CONFIG;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <TriggerIcon className="w-[18px] h-[18px] text-muted-foreground/80" />
          <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
            {DENSITY_CONFIG.find((d) => d.key === density)?.label}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[230px] p-1.5">
        {options.map((opt) => {
          const Icon = DENSITY_ICON[opt.key];
          return (
            <DropdownMenuItem
              key={opt.key}
              className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
              onSelect={(e) => {
                // Picking Card View keeps the menu open so the size strip
                // below is reachable in the same interaction.
                if (opt.key === 'card') e.preventDefault();
                onDensityChange(opt.key);
              }}
            >
              <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
              {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
            </DropdownMenuItem>
          );
        })}
        {density === 'card' && (
          <>
            <div className="mx-2 my-1.5 border-t border-muted" />
            <div className="px-3 py-1.5">
              <p className="text-[10px] text-slate-400 mb-2" style={{ fontWeight: 600 }}>Card Size</p>
              <div className="flex items-center gap-1.5">
                {(['large', 'medium', 'small'] as const).map((size) => {
                  const label = size === 'large' ? 'Large' : size === 'medium' ? 'Medium' : 'Small';
                  if (disabledCardSizes.includes(size)) {
                    return (
                      <Tooltip key={size} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            aria-disabled
                            className="flex-1 py-1.5 rounded-md text-[11px] text-center bg-muted/60 text-slate-300 cursor-not-allowed"
                            style={{ fontWeight: 500 }}
                          >
                            {label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                          <p className="text-[11px] text-slate-600 leading-snug" style={{ fontWeight: 500 }}>{label} cards are coming in the next phase.</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return (
                  <button
                    key={size}
                    onClick={() => onCardSizeChange?.(size)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                      cardSize === size ? 'bg-primary text-white shadow-sm' : 'bg-muted text-slate-500 hover:bg-border'
                    }`}
                    style={{ fontWeight: cardSize === size ? 600 : 500 }}
                  >
                    {label}
                  </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
