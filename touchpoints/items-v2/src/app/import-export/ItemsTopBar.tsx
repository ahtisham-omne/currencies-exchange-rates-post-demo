/* Top bar for the import history and record pages: the same breadcrumb +
 * avatar strip the Items listing renders (ItemsListPageV3), so the
 * pages sit in the app chrome like UAC's Data Imports pages do. */
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "../components/notifications/NotificationBell";

export interface Crumb {
  label: string;
  to?: string;
}

export function ItemsTopBar({ crumbs }: { crumbs: Crumb[] }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-2 min-w-0">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {last || !c.to ? (
                <span style={{ fontWeight: 500 }} className={last ? "text-foreground truncate" : undefined}>
                  {c.label}
                </span>
              ) : (
                <button
                  onClick={() => navigate(c.to as string)}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {c.label}
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--accent))" }}>
            <span className="text-[11px]" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>
              AA
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px]" style={{ fontWeight: 500 }}>
              Ahtisham Ahmad
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">Senior Product Designer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
