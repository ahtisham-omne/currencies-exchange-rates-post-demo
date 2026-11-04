import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/app/components/EmptyState';

/* Communications tab (GPT QC02, 9/30): the designed real surface with an
 * honest empty state — no fake seeded threads (they'd invite QC flags
 * about send actions that don't exist). Message history lands with the
 * communication backend; the card and its states are the design. */

export function CommunicationTab({ recordLabel = 'invoice' }: { recordLabel?: string }) {
  return (
    // Fills the column to the viewport bottom (user 10/2, the Coming
    // Soon / Payments empty-state treatment) so the tab never strands
    // dead page space below the card.
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
          <MessageSquare className="w-3.5 h-3.5" style={{ color: '#1D4ED8' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>Communications</h3>
          <p className="text-[11px] text-slate-400">Messages with your team and the vendor, attached to the record they are about.</p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
          0 messages
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center py-10">
        <EmptyState
          icon={MessageSquare}
          title={`No messages on this ${recordLabel} yet`}
          description="Emails and internal threads about this record will appear here once the communication service connects."
        />
      </div>
    </div>
  );
}
