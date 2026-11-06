import { Outlet, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { Search } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Avatar } from "../components/shared/Avatar";
import { Toaster } from "sonner";
import { mockQuotes } from "../data/mockQuotes";
import { getAllCreatedQuotes } from "../data/quoteStore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";

/* Build breadcrumb segments from current path. Plural section labels
   match the sidebar entry text exactly ("Quotes") so the trail reads
   the same as the nav. Detail-page IDs render verbatim, e.g.
   /quotes/quote-3 becomes `Sales / Quotes / Q-000-000-003` after
   resolving the URL's internal id back to its quote number.

   Chrome (literal `/` separators in muted-foreground) mirrors
   Partner Management's breadcrumb. */
function useBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs: { label: string; path?: string }[] = [{ label: "Sales", path: "/" }];

  if (pathname === "/" || pathname === "/quotes") {
    crumbs.push({ label: "Quotes" });
    return crumbs;
  }
  if (pathname.startsWith("/quotes/")) {
    const id = pathname.split("/").filter(Boolean)[1];
    /* Resolve internal id → human quote number. The listing and the
       detail header both render the quote number, not the slug. */
    const allQuotes = [...getAllCreatedQuotes(), ...mockQuotes];
    const found = allQuotes.find((q) => q.id === id);
    crumbs.push({ label: "Quotes", path: "/quotes" });
    crumbs.push({ label: found?.quoteNumber ?? id ?? "Quote" });
    return crumbs;
  }
  return crumbs;
}

/* The global "+ Create" dropdown was removed from the top bar to
   match Partners' updated header — creation is triggered from the
   Quotes listing's primary CTA now. */

/* Bug A3: the scrollable layer in this app is <main>, not window. The
   browser's auto scroll restoration only restores window.scrollY, so
   coming back from a quote detail to the list/Kanban always landed at
   the top. We keep a per-location-key map of scroll positions, save
   on unmount of a location, and restore on POP (the back/forward
   action React Router exposes via useNavigationType). Single Map
   lives at module scope so it survives unmounts; nothing more. */
const mainScrollPositions = new Map<string, number>();

function useMainScrollRestoration(mainRef: React.RefObject<HTMLElement>) {
  const location = useLocation();
  const navType = useNavigationType();

  // Save current scroll on every location change BEFORE the new one paints.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const key = location.key;
    return () => {
      mainScrollPositions.set(key, el.scrollTop);
    };
  }, [location.key, mainRef]);

  // Restore after the new content has painted (back/forward), or jump
  // to the top for fresh pushes.
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (navType === 'POP') {
      const saved = mainScrollPositions.get(location.key);
      const target = typeof saved === 'number' ? saved : 0;
      // Double rAF lets the new route's content commit first so the
      // scrollTop value lands somewhere valid.
      requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = target; }));
    } else if (navType === 'PUSH') {
      el.scrollTop = 0;
    }
  }, [location.key, navType, mainRef]);
}

export function RootLayout() {
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const mainRef = useRef<HTMLElement>(null);
  useMainScrollRestoration(mainRef);

  return (
    <div className="flex h-screen w-full bg-background compact-module overflow-hidden">
      {/* Left Sidebar — collapsible Partner-style nav */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top app bar — Partner pattern: dynamic breadcrumb on the left,
            global "+" Create + Search + user chip on the right. */}
        {/* Header carries no z-index so the sidebar's hover-expand overlay
            (z-50) renders above it, matching Partner Management exactly.
            Previously this had `zIndex: var(--z-sticky)` = 100, which
            covered the right half of the wordmark on hover. */}
        <header
          className="h-12 flex items-center justify-between px-6 lg:px-8 border-b border-border bg-card shrink-0"
        >
          {/* Breadcrumb — Partner's shadcn Breadcrumb component used
              verbatim (text-sm parent, text-muted-foreground inherited,
              gap-1.5/sm:gap-2.5, foreground page weight 400). Default
              ChevronRight separator is replaced with a literal `/`
              span so the trail reads `Sales / Quotes / Q-…` matching
              Partner Management's listing chrome. */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                /* On a phone the module crumb ("Sales") and the slash
                   after it give way, so the record number fits on one
                   line next to the avatar. */
                const phoneHidden = breadcrumbs.length > 2 && (idx === 0 || idx === 1) ? 'max-sm:hidden' : undefined;
                return [
                  idx > 0 && (
                    <BreadcrumbSeparator key={`sep-${idx}`} className={idx === 1 ? phoneHidden : undefined}>
                      <span>/</span>
                    </BreadcrumbSeparator>
                  ),
                  <BreadcrumbItem key={`crumb-${idx}-${crumb.label}`} className={idx === 0 ? phoneHidden : undefined}>
                    {isLast || !crumb.path ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        className="cursor-pointer"
                        onClick={() => crumb.path && navigate(crumb.path)}
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>,
                ];
              }).flat().filter(Boolean)}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-3">
            {/* Search — Partner exact width / height. Hidden below md so
                the breadcrumb stays primary on small screens. */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ opacity: 0.6 }} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-3 w-[260px] h-8 rounded-md bg-white border border-border/60 text-[13px] text-foreground outline-none transition-colors focus:border-primary/40 placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Avatar name="Ahtisham Ahmad" tone="solid" size={32} />
              {/* Name and role hide below sm, as in PO's TopBar; the avatar stays. */}
              <div className="hidden sm:block">
                <div className="text-foreground text-[13px]" style={{ fontWeight: 500, lineHeight: 1.2 }}>Ahtisham Ahmad</div>
                <div className="text-muted-foreground text-[11px]" style={{ lineHeight: 1.2 }}>Product Designer</div>
              </div>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Toaster — single mount, Partner-exact props.
          Stray `style`/`toastOptions` on this element used to stack a
          second wrapper and surface duplicate cards; matching Partner's
          `<Toaster position="top-right" richColors />` literally fixes it. */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
