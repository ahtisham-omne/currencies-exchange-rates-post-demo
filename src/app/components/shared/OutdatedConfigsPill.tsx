/* OutdatedConfigsPill — header affordance next to the status /
 * priority pills. Amber pill that indicates upstream modules
 * (Partner Management and others) have newer values for settings
 * this draft is pinned to. Icon signals "sync available"; the
 * small chevron on the right
 * (Partner-module convention for tappable pills) makes the click
 * target legible.
 *
 * `variant="compact"` renders an icon-only chip suited to dense
 * list-cell contexts (used in the SO / Quote listings next to the
 * status badge). Full pill stays for detail-page headers where the
 * label + count are more useful. Both variants use the shared
 * Tooltip component so the hover surface reads as a white design-
 * system card, not the native browser bubble. */
import { RefreshCw, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';

interface OutdatedConfigsPillProps {
  count: number;
  onClick: (e?: React.MouseEvent) => void;
  /** When rendered inside a clickable table row, callers want to
   *  block the row's onClick from firing behind us. Defaults to
   *  true so consumers don't need to remember to stopPropagation. */
  stopPropagation?: boolean;
  /** `full` (default) = amber pill with label + count + chevron.
   *  `compact` = 20 px round amber chip with just the RefreshCw
   *  glyph, for the listing status cell. */
  variant?: 'full' | 'compact';
}

export function OutdatedConfigsPill({ count, onClick, stopPropagation = true, variant = 'full' }: OutdatedConfigsPillProps) {
  if (count <= 0) return null;
  const tooltipLabel = `${count} configuration ${count === 1 ? 'update' : 'updates'} available from other modules`;

  if (variant === 'compact') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => { if (stopPropagation) e.stopPropagation(); onClick(e); }}
              aria-label={tooltipLabel}
              className="inline-flex items-center justify-center rounded-full cursor-pointer shrink-0 transition-colors"
              style={{
                width: 20,
                height: 20,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#B45309',
                border: '1px solid rgba(245, 158, 11, 0.35)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)'; }}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="bg-white text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 shadow-md text-[11px]"
            style={{ lineHeight: 1.55, fontWeight: 500 }}
          >
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  /* Height and padding match the PriorityDropdown pill next to it
     (height 24, padding 0 10, font 11/500, line-height 1) so the
     detail-header pill row reads as a single band. Status pill sits
     between at ~22 px, but 24 hugs the taller priority chip and
     stays close enough to the status chip that they still align. */
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => { if (stopPropagation) e.stopPropagation(); onClick(e); }}
            className="inline-flex items-center gap-1.5 rounded-full transition-colors cursor-pointer group whitespace-nowrap"
            style={{
              height: 24,
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1,
              backgroundColor: 'rgba(245, 158, 11, 0.10)',
              color: '#92400E',
              border: '1px solid rgba(245, 158, 11, 0.30)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.10)'; }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
            <span>Outdated Configurations</span>
            <span
              className="inline-flex items-center justify-center rounded-full tabular-nums"
              style={{ minWidth: 16, height: 14, padding: '0 5px', fontSize: 10, fontWeight: 700, lineHeight: 1, backgroundColor: '#F59E0B', color: '#fff' }}
            >
              {count}
            </span>
            <ChevronRight className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ width: 12, height: 12 }} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={6}
          className="bg-white text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 shadow-md text-[11px]"
          style={{ lineHeight: 1.55, fontWeight: 500 }}
        >
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OutdatedConfigsPill;
