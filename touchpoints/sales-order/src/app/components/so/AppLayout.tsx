import { Outlet, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { Search } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { SOStoreProvider } from "./store";
import { AppSidebar, PersonaToggle } from "./AppSidebar";
import { embedded } from "@/embedding";
import { PersonaProvider } from "./PersonaContext";
import { Avatar } from "@/app/components/shared/Avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb";

/* Build breadcrumb segments from current path. Plural section labels
   match the sidebar entry text exactly ("Sales Orders", "Quotes") so
   the trail reads the same as the nav. Detail-page IDs render
   verbatim, e.g. `/sales-orders/SO-2026-0451` becomes
   `Sales / Sales Orders / SO-2026-0451`.

   Format mirrors Partner Management's breadcrumb chrome (literal
   `/` separators rendered downstream). */
function useBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs: { label: string; path?: string }[] = [{ label: "Sales", path: "/" }];

  if (pathname === "/" || pathname === "/sales-orders") {
    crumbs.push({ label: "Sales Orders" });
    return crumbs;
  }
  if (pathname.startsWith("/sales-orders/")) {
    const parts = pathname.split("/").filter(Boolean);
    const rawId = parts[1] ?? "";
    /* The URL carries the internal id (`SO-001`) but the breadcrumb
       should read as the human SO number (`SO-000-000-001`). The
       store fixes that mapping with zero-padding to nine digits, so
       we replicate the transform here without pulling the store
       provider above the layout. */
    const match = rawId.match(/^SO-(\d{1,3})$/i);
    const soLabel = match ? `SO-000-000-${match[1].padStart(3, "0")}` : rawId;
    crumbs.push({ label: "Sales Orders", path: "/sales-orders" });
    crumbs.push({ label: soLabel });
    return crumbs;
  }
  if (pathname.startsWith("/quotes")) {
    crumbs.push({ label: "Quotes" });
  }
  return crumbs;
}

/* The global "+ Create" dropdown was removed from the top bar to
   match Partners' updated header — creation is triggered from the
   listing pages' primary CTAs now. */

/* Bug A3: <main> is the real scroll container in this layout, so the
   browser's auto window-scroll restoration never kicks in. We track
   scrollTop per react-router location.key and replay it on POP. */
const mainScrollPositions = new Map<string, number>();

function useMainScrollRestoration(mainRef: React.RefObject<HTMLElement>) {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const key = location.key;
    return () => { mainScrollPositions.set(key, el.scrollTop); };
  }, [location.key, mainRef]);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (navType === 'POP') {
      const saved = mainScrollPositions.get(location.key);
      const target = typeof saved === 'number' ? saved : 0;
      requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = target; }));
    } else if (navType === 'PUSH') {
      el.scrollTop = 0;
    }
  }, [location.key, navType, mainRef]);
}

export function AppLayout() {
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const mainRef = useRef<HTMLElement>(null);
  useMainScrollRestoration(mainRef);

  return (
    <PersonaProvider>
    <div className="flex h-screen w-full bg-background compact-module overflow-hidden">
      {/* Left Sidebar — Partner-style collapsible nav. Inside the Currency &
          Exchange shell, the shell's sidebar replaces it and the persona
          toggle moves into the header. */}
      {!embedded && <AppSidebar />}

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
              span so the trail reads `Sales / Sales Orders / SO-…`
              matching Partner Management's listing chrome. */}
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
            {embedded && <PersonaToggle width={200} />}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ opacity: 0.6 }} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-3 w-[240px] h-8 rounded-md bg-white border border-border/60 text-[13px] text-foreground outline-none transition-colors focus:border-primary/40 placeholder:text-muted-foreground/50"
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
          <SOStoreProvider>
            <Outlet />
          </SOStoreProvider>
        </main>
      </div>
      {/* Toaster — single mount, Partner-exact props.
          The custom <ToastProvider> that used to wrap <Outlet> was a
          parallel toast system; SO components all call sonner's
          `toast.success`/`toast.error`, so mounting Partner's sonner
          Toaster here is what actually renders them. The dual setup
          (custom provider + dead-code sonner) caused the multi-card
          glitch when sonner queued toasts but the active surface was
          the custom one. */}
      <Toaster position="top-right" richColors />
    </div>
    </PersonaProvider>
  );
}
