/**
 * Top app bar — dynamic breadcrumb on the left, search + user on the
 * right. Breadcrumb chrome mirrors Partner Management exactly:
 * `h-12 px-6 lg:px-8 border-b border-border bg-card`, a flex row of
 * 13px crumbs separated by literal slash characters (`/`) coloured
 * muted-foreground, with the trailing crumb in the foreground colour.
 *
 * Routes covered:
 *   `/`              → Sales / Quotes
 *   `/quotes`        → Sales / Quotes
 *   `/quotes/:id`    → Sales / Quotes / Q-000-000-001
 */
import { Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { mockQuotes } from '@/app/data/mockQuotes';
import { getAllCreatedQuotes } from '@/app/data/quoteStore';

interface Crumb { label: string; path?: string; }

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  return useMemo(() => {
    const crumbs: Crumb[] = [{ label: 'Sales', path: '/' }];

    if (pathname.startsWith('/quotes/')) {
      const id = pathname.split('/').filter(Boolean)[1];
      /* Detail page: try to surface the quote number rather than the
         internal id so the trailing crumb reads `Q-000-000-001` like
         the user expects. Fall back to the id segment if we don't
         find a matching quote. */
      const allQuotes = [...getAllCreatedQuotes(), ...mockQuotes];
      const found = allQuotes.find((q) => q.id === id);
      crumbs.push({ label: 'Quotes', path: '/quotes' });
      crumbs.push({ label: found?.quoteNumber ?? id ?? 'Quote' });
    } else {
      /* Listing (and root) — Sales / Quotes. */
      crumbs.push({ label: 'Quotes' });
    }

    return crumbs;
  }, [pathname]);
}

export function TopBar() {
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();

  return (
    <header
      className="h-12 flex items-center justify-between px-6 lg:px-8 border-b border-border bg-card shrink-0"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Breadcrumbs — Partner pattern. Slash separator is a span with
          muted-foreground colour and `aria-hidden`. Non-last crumbs
          render as buttons that navigate to their path; the last
          crumb sits in the foreground colour with `fontWeight: 500`. */}
      <div className="flex items-center gap-2 text-[13px]">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={`${idx}-${crumb.label}`} className="flex items-center gap-2">
              {idx > 0 && (
                <span className="text-muted-foreground" aria-hidden>/</span>
              )}
              {isLast || !crumb.path ? (
                <span className="text-foreground" style={{ fontWeight: 500 }}>
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(crumb.path!)}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Search + User */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-3 w-[260px] h-8 rounded-md bg-white border border-border/60 text-[13px] text-foreground outline-none transition-colors focus:border-primary/40 placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'hsl(var(--accent))' }}
          >
            <span className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>AA</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Senior Product Designer</p>
          </div>
        </div>
      </div>
    </header>
  );
}
