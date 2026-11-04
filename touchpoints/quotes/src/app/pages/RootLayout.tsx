import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { Toaster } from "sonner";

/* Inside the Currency & Exchange shell, the shell's sidebar replaces this one. */
const embedded = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

/* Build breadcrumb segments from current path */
function useBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs: { label: string; path?: string }[] = [{ label: "Sales", path: "/" }];

  if (pathname === "/") {
    return [{ label: "Sales" }];
  }
  if (pathname.startsWith("/quotes")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 1) {
      crumbs.push({ label: "Quotes" });
    } else {
      crumbs.push({ label: "Quotes", path: "/" });
      crumbs.push({ label: parts[1] });
    }
  }
  return crumbs;
}

export function RootLayout() {
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();

  return (
    <div className="flex h-screen w-full bg-background compact-module overflow-hidden">
      {/* Left Sidebar — collapsible nav */}
      {!embedded && <Sidebar />}

      {/* Right side: header + content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-[52px] flex items-center justify-between px-5 border-b border-border bg-card shrink-0" style={{ zIndex: "var(--z-sticky)" as unknown as number }}>
          <div className="flex items-center gap-2" style={{ fontSize: "var(--text-caption)" }}>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return [
                idx > 0 && (
                  <span key={`sep-${idx}`} className="text-foreground/20">/</span>
                ),
                isLast ? (
                  <span key={crumb.label} className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)" }}>
                    {crumb.label}
                  </span>
                ) : (
                  <span
                    key={crumb.label}
                    className="text-foreground/50 cursor-pointer hover:text-foreground/70 transition-colors"
                    onClick={() => crumb.path && navigate(crumb.path)}
                  >
                    {crumb.label}
                  </span>
                ),
              ];
            }).flat().filter(Boolean)}
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary border border-border rounded-md text-foreground/35 cursor-pointer hover:border-foreground/20 transition-colors" style={{ fontSize: "var(--text-caption)" }}>
              <Search className="w-3 h-3" />
              <span>Search</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-primary-foreground" style={{ backgroundColor: "#EDF4FF" }}>
                <span style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "#0A77FF" }}>AA</span>
              </div>
              <div>
                <div className="text-foreground" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>Ahtisham Ahmad</div>
                <div className="text-foreground/35" style={{ fontSize: "var(--text-micro)" }}>Product Designer</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors style={{ zIndex: 99999 }} toastOptions={{ style: { zIndex: 99999 } }} />
    </div>
  );
}
