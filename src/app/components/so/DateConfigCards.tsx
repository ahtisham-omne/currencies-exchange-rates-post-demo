import { useState } from 'react';
import { Calendar, Clock, Pencil } from 'lucide-react';
import { RelativeDateValue } from "@/app/components/shared/RelativeDateValue";
import type { SODateType } from './ui/DateEditModal';

interface DateConfigCardsProps {
  requestDateValue: string;
  estShipType: 'absolute' | 'relative';
  estShipValue: string;
  estShipUnit: string;
  onEdit: (card: SODateType) => void;
  trailingElement?: React.ReactNode;
  /** Stack cards vertically (single column) instead of the wider
   *  2 or 3-column grid. Used by Step 2 in full-view mode where the
   *  date cards live inside a narrow right-side column. */
  isStacked?: boolean;
}

function addBusinessDays(fromDate: Date, days: number): Date {
  const result = new Date(fromDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export function DateConfigCards({
  requestDateValue,
  estShipType,
  estShipValue,
  estShipUnit,
  onEdit,
  trailingElement,
  isStacked = false,
}: DateConfigCardsProps) {
  const [hoveredCard, setHoveredCard] = useState<SODateType | null>(null);

  const fmtNow = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getRequestDisplay = () => requestDateValue || fmtNow();

  const getEstShipDisplay = () => {
    if (estShipType === 'absolute') return estShipValue || fmtNow();
    // Compute actual date from relative offset
    const days = parseInt(estShipValue) || 0;
    const fromDate = new Date();
    const computed = addBusinessDays(fromDate, days);
    return formatDate(computed);
  };

  /* Relative values carry the marker instead of a hover tooltip, so the rule
     reads the same way it does in Quotes. */
  const getEstShipRule = () => {
    if (estShipType !== 'relative') return null;
    const days = parseInt(estShipValue) || 0;
    const unit = estShipUnit || 'business days';
    return `${days} ${unit} after the order is approved by Operations`;
  };

  const cards: { key: SODateType; icon: typeof Calendar; label: string; display: string; tooltip: string | null }[] = [
    { key: 'request', icon: Calendar, label: 'Requested On', display: getRequestDisplay(), tooltip: null },
    { key: 'estShip', icon: Clock, label: 'Est. Ship Date', display: getEstShipDisplay(), tooltip: getEstShipRule() },
  ];

  const gridClass = isStacked
    ? "grid grid-cols-1 gap-3"
    : trailingElement
    ? "grid grid-cols-3 gap-3"
    : "grid grid-cols-2 gap-3";

  return (
    <div className={gridClass}>
      {cards.map(({ key, icon: Icon, label, display, tooltip }) => (
        <div
          key={key}
          className="group cursor-pointer relative"
          onClick={() => onEdit(key)}
          onMouseEnter={() => setHoveredCard(key)}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            border: '1px solid #E5E7EB',
            transition: 'all 150ms',
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <label className="text-[11px] text-[#9CA3AF] tracking-wide" style={{ fontWeight: 500 }}>
                {label}
              </label>
            </div>
            <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />
          </div>
          <div className="text-[14px] text-[#1F2937] leading-tight" style={{ fontWeight: 500 }}>
            {tooltip ? (
              <RelativeDateValue display={display} rule={tooltip} anchor="the approval date" />
            ) : display}
          </div>
        </div>
      ))}
      {trailingElement}
    </div>
  );
}
