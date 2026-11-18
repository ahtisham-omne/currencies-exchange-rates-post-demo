import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/** "Updated hh:mm · Refresh" block for KPI/widget band headers. The CTA is
 *  the shared text-link recipe with a blue hover tint, the blue sibling of
 *  the red InsightsResetButton. Owns its refreshed-at state so any band can
 *  drop it in without wiring. */
export function InsightsRefresh({ toastLabel = 'Insights refreshed' }: { toastLabel?: string }) {
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date());
      toast.success(toastLabel);
    }, 600);
  };

  const updatedLabel = lastUpdated.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <>
      <span className="text-slate-300 hidden sm:inline">|</span>
      <span className="text-[11px] text-slate-400 hidden sm:inline" style={{ fontWeight: 400 }}>
        Updated {updatedLabel}
      </span>
      <button
        onClick={handleRefresh}
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D4] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
        style={{ fontWeight: 500 }}
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </>
  );
}
