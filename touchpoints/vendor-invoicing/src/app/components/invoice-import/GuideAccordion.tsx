/* ── Guide accordion (user 9/25) ──────────────────────────────────────
 * The long-form "how it works" copy for import AND export reads as
 * collapsible title+answer items instead of a wall of prose: one
 * bordered card, divided rows, chevron rotation, first item open.
 * Smooth height animation via the grid-rows trick (no fixed heights),
 * primary-tinted hover states — elegant, never flashy. Shared by
 * ImportGuidePanel and ExportDialog so the two guides never drift.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface GuideItem {
  title: string;
  body: React.ReactNode;
}

export function GuideAccordion({ items, defaultOpen = 0 }: { items: GuideItem[]; defaultOpen?: number | null }) {
  const [openIdx, setOpenIdx] = useState<number | null>(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={item.title} className={`transition-colors duration-200 ${open ? 'bg-blue-50/20' : ''}`}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="group w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-blue-50/40 transition-colors duration-200"
              aria-expanded={open}
            >
              <span
                className={`text-[13px] leading-tight transition-colors duration-200 ${
                  open ? 'text-primary' : 'text-foreground group-hover:text-primary'
                }`}
                style={{ fontWeight: 600 }}
              >
                {item.title}
              </span>
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-200 ${
                  open ? 'bg-primary/10 text-primary rotate-180' : 'text-slate-400 group-hover:bg-blue-50 group-hover:text-primary'
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </button>
            {/* Height animates via grid rows — content flows to its real
                size, no jump cuts. */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-3.5 pb-3.5 space-y-2 text-[12.5px] text-slate-600" style={{ fontWeight: 400, lineHeight: 1.65 }}>
                  {item.body}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
