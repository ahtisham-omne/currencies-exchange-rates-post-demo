import { useState, useMemo } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import type { ActivityEntry } from "./types";

type ActivityFilter = "all" | "Created" | "Updated" | "Cleared" | "Allocated" | "Cancelled" | "Archived";

/* ═══ Avatar palette — pastel tints using CSS variables ═══ */
const AVATAR_PALETTE = [
  { bgClass: "bg-primary/12", textColor: "var(--primary)" },
  { bgClass: "bg-chart-4/12", textColor: "var(--chart-4)" },
  { bgClass: "bg-chart-3/12", textColor: "var(--chart-3)" },
  { bgClass: "bg-accent/12", textColor: "var(--accent)" },
  { bgClass: "bg-chart-5/12", textColor: "var(--chart-5)" },
];

function getAvatarPastel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function ActivityTab({ entries }: { entries: ActivityEntry[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [activityOpen, setActivityOpen] = useState(false);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => { counts[e.action] = (counts[e.action] || 0) + 1; });
    return counts;
  }, [entries]);

  const pills: { key: ActivityFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: entries.length },
    ...Object.entries(actionCounts).map(([action, count]) => ({
      key: action as ActivityFilter,
      label: action,
      count,
    })),
  ];

  const filtered = useMemo(() => {
    let list = entries;
    if (filter !== "all") list = list.filter(e => e.action === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.action.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        e.timestamp.toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, filter, search]);

  if (entries.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center text-foreground/50 text-[length:var(--text-caption)]" style={{ boxShadow: "var(--elevation-1)" }}>
        No activity logged yet.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--elevation-1)" }}>
      <TabSearchBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search activity..."
        resultCount={filtered.length}
        resultLabel="entries"
      />
      <FilterPills pills={pills} active={filter} onSelect={setFilter} />

      {/* Collapsible activity log, closed by default */}
      <button
        onClick={() => setActivityOpen(!activityOpen)}
        className="w-full px-5 py-2.5 border-t border-border flex items-center justify-between hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-foreground/50" />
          <span className="text-[length:var(--text-caption)] text-foreground font-semibold">Activity Log</span>
          <span className="text-[length:var(--text-micro)] bg-border text-foreground/50 px-1.5 py-[1px] rounded-full font-medium">{filtered.length}</span>
        </div>
        {activityOpen ? <ChevronUp className="w-3.5 h-3.5 text-foreground/35" /> : <ChevronDown className="w-3.5 h-3.5 text-foreground/35" />}
      </button>

      {activityOpen && (
        <div className="p-5 pt-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-foreground/50 text-[length:var(--text-caption)]">No activity matches your search.</div>
          ) : (
            <div className="space-y-0">
              {[...filtered].reverse().map((entry, i) => {
                const pal = getAvatarPastel(entry.user);
                const initials = getInitials(entry.user);
                return (
                  <div key={entry.id} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${pal.bgClass}`}
                        style={{
                          color: pal.textColor,
                          fontSize: "var(--text-micro)",
                          fontWeight: "var(--font-weight-semibold)",
                        }}
                      >
                        {initials}
                      </div>
                      {i < filtered.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 pt-0.5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[length:var(--text-caption)] text-foreground font-medium">
                          <HighlightText text={entry.action} search={search} />
                        </span>
                        <span className="text-[length:var(--text-small)] text-foreground/35">{entry.timestamp}</span>
                      </div>
                      <div className="text-[length:var(--text-caption)] text-foreground/50 mt-0.5">
                        <HighlightText text={entry.details} search={search} />
                      </div>
                      <div className="text-[length:var(--text-small)] text-foreground/35 mt-0.5">
                        by <HighlightText text={entry.user} search={search} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
