// Shim — exports the ActivityFeed pieces that the detail modals consume,
// without dragging the full PartnerGroupDetailModal closure (which pulls
// in ColumnSelector, QuickViewPanel, configDiff, etc). The body of
// ActivityFeed is copied verbatim from Partner Management so the visual
// rendering is identical. Safe to delete when the canonical
// PartnerGroupDetailModal is portable.
import React from "react";
import { Plus, Pencil, Link2, Activity, X, Clock } from "lucide-react";

export type ActivityFeedItemType = "create" | "edit" | "link" | "apply" | "delete" | "info";
export interface ActivityFeedItem {
  id: string;
  type: ActivityFeedItemType;
  user: string;
  verb: string;
  target?: string;
  date: string;
}

function activityIconFor(type: ActivityFeedItemType): { Icon: React.ElementType; color: string } {
  switch (type) {
    case "create": return { Icon: Plus, color: "var(--success)" };
    case "edit":   return { Icon: Pencil, color: "var(--primary)" };
    case "link":   return { Icon: Link2, color: "var(--violet)" };
    case "apply":  return { Icon: Activity, color: "var(--warning)" };
    case "delete": return { Icon: X, color: "var(--destructive)" };
    default:       return { Icon: Clock, color: "var(--muted-foreground)" };
  }
}

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-[12px] text-slate-400">No activity yet.</div>
    );
  }
  return (
    <div className="relative">
      {items.length > 1 && (
        <div
          className="absolute left-[15px] top-3 bottom-3 w-px bg-muted"
          aria-hidden
        />
      )}
      <ul className="relative space-y-3.5">
        {items.map((item) => {
          const { Icon, color } = activityIconFor(item.type);
          return (
            <li key={item.id} className="flex items-start gap-3 relative">
              <div
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10 border border-border bg-white"
                style={{ color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10.5px] text-slate-400 leading-tight">{item.date}</p>
                <p className="text-[12.5px] text-slate-700 mt-0.5 leading-relaxed">
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{item.user}</span>
                  <span className="text-slate-500"> {item.verb.toLowerCase()}</span>
                  {item.target && (
                    <>
                      {" "}
                      <span className="text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>{item.target}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
