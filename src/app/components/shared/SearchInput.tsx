import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Tailwind width class — defaults to `flex-1 max-w-xs` to match Partner toolbars */
  widthClassName?: string;
}

/**
 * Partner-aligned search input — h-9, white bg, slate-80 border, shadow-sm,
 * built-in clear (X) button. Mirrors Partner Management's table search inputs.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  widthClassName = 'flex-1 max-w-xs',
}: SearchInputProps) {
  return (
    <div className={`relative ${widthClassName}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 text-sm bg-card border border-border/80 rounded-md placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-colors"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
