import { forwardRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';

interface FiltersButtonProps {
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Filters trigger button — Partner Management `VendorsListPage` parity.
 * Drop-in across every listing toolbar, detail-tab toolbar, and picker
 * modal so the affordance reads as the same control suite-wide.
 *
 * Spec (mirrors Partner exactly):
 * - Container: `inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors`
 * - Active: `text-primary border-primary/30`. Icon flips to `text-primary`.
 * - Inactive: `text-foreground border-border/80`. Icon stays `text-muted-foreground`.
 * - Active count badge: solid blue (`bg-primary`) with white text,
 *   `min-w-[18px] h-5 rounded-full text-[11px] px-1.5`. Partner uses this
 *   stronger contrast (filled badge + white type) so the count never
 *   disappears against an active filter row — the older light-blue chip
 *   we used to ship was too faint at small sizes.
 */
export const FiltersButton = forwardRef<HTMLButtonElement, FiltersButtonProps>(
  ({ count, active, onClick }, ref) => {
    const isHighlighted = (count != null && count > 0) || !!active;
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
          isHighlighted
            ? 'text-primary border-primary/30'
            : 'text-foreground border-border/80'
        }`}
      >
        <SlidersHorizontal className={`w-3.5 h-3.5 ${isHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
        {count != null && count > 0 && (
          <span
            className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            {count}
          </span>
        )}
      </button>
    );
  }
);

FiltersButton.displayName = 'FiltersButton';
