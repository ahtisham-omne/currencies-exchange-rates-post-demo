import { Activity, Clock, Link2, Pencil, Plus, X } from 'lucide-react'

/* ─── Shared Activity feed renderer ───
   Ported verbatim from Partner Management - Vendors (PartnerGroupDetailModal):
   a feed-style activity log:
     [icon-circle] | Date · Time
                   | <strong>User</strong> verb <link>target</link>
   A thin gray rail connects the icon-circles vertically, so Recent Activity
   reads identically across the Partner and Accounting modules. */
export type ActivityFeedItemType = 'create' | 'edit' | 'link' | 'apply' | 'delete' | 'info'
export interface ActivityFeedItem {
  id: string
  type: ActivityFeedItemType
  /** Person who triggered the activity. Rendered bold inline. */
  user: string
  /** Lower-case verb phrase, e.g. "updated section for". */
  verb: string
  /** Optional target object - displayed as a primary-colored "link" tone. */
  target?: string
  /** Human-readable date / timestamp string. */
  date: string
}

function activityIconFor(type: ActivityFeedItemType): { Icon: React.ElementType; color: string } {
  switch (type) {
    case 'create': return { Icon: Plus, color: 'hsl(var(--success))' }
    case 'edit': return { Icon: Pencil, color: 'hsl(var(--primary))' }
    case 'link': return { Icon: Link2, color: 'hsl(var(--violet))' }
    case 'apply': return { Icon: Activity, color: 'hsl(var(--warning))' }
    case 'delete': return { Icon: X, color: 'hsl(var(--destructive))' }
    default: return { Icon: Clock, color: 'hsl(var(--muted-foreground))' }
  }
}

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return <div className="text-center py-6 text-[12px] text-slate-400">No activity yet.</div>
  }
  return (
    <div className="relative">
      {/* Rail - sits behind the circles */}
      {items.length > 1 && (
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-muted" aria-hidden />
      )}
      <ul className="relative space-y-3.5">
        {items.map(item => {
          const { Icon, color } = activityIconFor(item.type)
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
                  <span className="text-slate-500"> {item.verb}</span>
                  {item.target && (
                    <>
                      {' '}
                      <span className="text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>{item.target}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
