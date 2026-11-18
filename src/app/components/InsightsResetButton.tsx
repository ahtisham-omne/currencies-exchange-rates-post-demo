import { RotateCcw } from 'lucide-react';

/** Reset CTA for KPI/widget bands — same text-link recipe as the Refresh
 *  and Add Insights controls beside it. Disabled (grey) while the layout
 *  matches its default; turns red once the user has customized anything
 *  (added/removed widgets, drag-and-drop reorder, sizes) so there's
 *  something to reset. */
export function InsightsResetButton({ dirty, onReset }: { dirty: boolean; onReset: () => void }) {
  return (
    <button
      onClick={onReset}
      disabled={!dirty}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
        dirty
          ? 'text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer'
          : 'text-slate-300 cursor-not-allowed'
      }`}
      style={{ fontWeight: 500 }}
    >
      <RotateCcw className="w-3 h-3" />
      Reset
    </button>
  );
}
