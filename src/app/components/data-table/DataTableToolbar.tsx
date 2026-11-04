import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { ViewDensityMenu } from './ViewDensityMenu';
import type { CardSize, DensityOption, QuickFilter } from './types';

interface DataTableToolbarProps {
  /* Search */
  searchQuery: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder?: string;

  /* Density (3-mode) */
  density: DensityOption;
  onDensityChange: (next: DensityOption) => void;
  cardSize?: CardSize;
  onCardSizeChange?: (next: CardSize) => void;

  /* Quick-filter chips row (e.g. status tabs). Renders below the toolbar. */
  quickFilters?: QuickFilter[];
  activeQuickFilter?: string;
  onQuickFilterChange?: (key: string) => void;

  /* Optional leading slot (e.g. "Me mode" chip) rendered before quick filters. */
  leadingChip?: ReactNode;

  /* Slots */
  filtersButton?: ReactNode;
  insightsButton?: ReactNode;
  columnsButton?: ReactNode;
  primaryAction?: ReactNode;
  /** Count / meta text shown between search and density (e.g. "12 of 100 invoices"). */
  meta?: ReactNode;
}

export function DataTableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  density,
  onDensityChange,
  cardSize,
  onCardSizeChange,
  quickFilters,
  activeQuickFilter,
  onQuickFilterChange,
  leadingChip,
  filtersButton,
  insightsButton,
  columnsButton,
  primaryAction,
  meta,
}: DataTableToolbarProps) {
  return (
    <>
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {filtersButton}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {meta}
          {meta && <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />}
          {insightsButton}

          {/* Density dropdown — canonical partner-pattern menu. */}
          <ViewDensityMenu
            density={density}
            onDensityChange={onDensityChange}
            cardSize={cardSize ?? 'medium'}
            onCardSizeChange={onCardSizeChange ?? (() => {})}
          />

          {columnsButton}
          {primaryAction}
        </div>
      </div>

      {/* Quick-filter pills row */}
      {(quickFilters && quickFilters.length > 0) || leadingChip ? (
        <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 shrink-0">
          {leadingChip}
          {leadingChip && quickFilters && quickFilters.length > 0 && (
            <div className="w-px h-5 bg-border shrink-0" />
          )}
          {quickFilters?.map((qf) => {
            const active = activeQuickFilter === qf.key;
            const destructive = qf.tone === 'destructive';
            let pillClass: string;
            let countClass: string;
            let pillStyle: React.CSSProperties | undefined;
            let countStyle: React.CSSProperties | undefined;

            if (destructive) {
              pillClass = active
                ? 'border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200'
                : 'border-red-200 text-rose-600 hover:bg-red-50 hover:border-red-300 active:bg-red-100';
              pillStyle = active
                ? { color: 'hsl(var(--destructive))', fontWeight: 500 }
                : { fontWeight: 400 };
              countClass = active ? 'bg-red-100' : 'bg-red-50';
              countStyle = { color: 'hsl(var(--destructive))', fontWeight: 600 };
            } else if (active) {
              pillClass = 'border-primary bg-accent hover:bg-accent-pill-hover active:bg-accent-pill-active';
              pillStyle = { color: 'hsl(var(--primary))', fontWeight: 500 };
              countClass = 'bg-primary/10';
              countStyle = { color: 'hsl(var(--primary))', fontWeight: 600 };
            } else {
              pillClass =
                'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted';
              pillStyle = { fontWeight: 400 };
              countClass = 'bg-muted';
              countStyle = { color: 'hsl(var(--muted-foreground))', fontWeight: 600 };
            }

            return (
              <button
                key={qf.key}
                type="button"
                onClick={() => onQuickFilterChange?.(qf.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${pillClass}`}
                style={pillStyle}
              >
                {qf.label}
                {qf.showCount !== false && typeof qf.count === 'number' && (
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${countClass}`}
                    style={countStyle}
                  >
                    {qf.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
