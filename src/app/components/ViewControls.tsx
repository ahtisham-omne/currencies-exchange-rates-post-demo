import { useState, useMemo } from 'react';
import { X, Archive } from 'lucide-react';
import { Quote, QuoteStatus } from '@/app/types/quote';
import { ActiveFilters, DATE_FIELD_LABELS, DATE_OPERATOR_LABELS, VALUE_OPERATOR_LABELS, TEXT_FIELD_LABELS, TEXT_OPERATOR_LABELS } from '@/app/utils/quoteUtils';
import { SALES_REPS, CUSTOMERS } from '@/app/data/mockQuotes';

// ── Status color system ───────────────────────────────────────────────
// Each status gets a distinct color for: text, border, badge-bg, selected-bg, shadow
const STATUS_COLORS: Record<string, { color: string; rgb: string }> = {
  'showAll':            { color: '#2563EB', rgb: '37,99,235' },
  'Draft':              { color: 'hsl(var(--muted-foreground))', rgb: '100,116,139' },
  'Sent to Customer':   { color: '#2563EB', rgb: '37,99,235' },
  'Unconfirmed SO':     { color: '#7C3AED', rgb: '124,58,237' },
  'Confirmed SO':       { color: '#16A34A', rgb: '22,163,74' },
  'Expired':            { color: '#DC2626', rgb: '220,38,38' },
  'Rejected':           { color: '#DC2626', rgb: '220,38,38' },
  'Cancelled':          { color: '#DC2626', rgb: '220,38,38' },
  'Archived':           { color: '#DC2626', rgb: '220,38,38' },
  'meMode':             { color: 'hsl(var(--foreground))', rgb: '30,41,59' },
};

const STATUS_PILLS: { status: QuoteStatus; label: string }[] = [
  { status: 'Draft', label: 'Draft' },
  { status: 'Sent to Customer', label: 'Sent to Customer' },
  { status: 'Unconfirmed SO', label: 'Confirmed by Customer' },
  { status: 'Confirmed SO', label: 'Converted to SO' },
  { status: 'Expired', label: 'Expired' },
  { status: 'Rejected', label: 'Rejected' },
  { status: 'Cancelled', label: 'Cancelled' },
];

type ViewDensity = 'comfortable' | 'compact' | 'board';

interface ViewControlsProps {
  viewDensity: ViewDensity;
  onViewDensityChange: (density: ViewDensity) => void;
  onColumnConfig: () => void;
  visibleColumnCount?: number;
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  quickFilters: {
    meMode: boolean;
    showAll: boolean;
  };
  onQuickFilterChange: (filter: 'meMode' | 'showAll') => void;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  allQuotes: Quote[];
}

const pillBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '5px',
  height: '28px', padding: '0 10px',
  fontSize: '12px', fontWeight: 500,
  borderRadius: '14px', cursor: 'pointer',
  transition: 'all 150ms ease', whiteSpace: 'nowrap', flexShrink: 0,
  border: '1px solid hsl(var(--border))',
  backgroundColor: '#FFFFFF',
  color: '#6B7280',
  fontFamily: 'Inter, system-ui, sans-serif',
  outline: 'none',
};

const filterTagPillStyle = (color: { bg: string; border: string; text: string }): React.CSSProperties => ({
  ...pillBase,
  border: `1px solid ${color.border}`, backgroundColor: color.bg, color: color.text,
});

// ── Pill sub-component ────────────────────────────────────────────────
function StatusPill({
  label,
  count,
  active,
  colorKey,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  colorKey: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sc = STATUS_COLORS[colorKey] || STATUS_COLORS['Draft'];

  const style: React.CSSProperties = active
    ? {
        ...pillBase,
        backgroundColor: `rgba(${sc.rgb}, 0.06)`,
        color: sc.color,
        border: `1px solid ${sc.color}`,
        boxShadow: `0 1px 3px rgba(${sc.rgb}, 0.18), 0 0 0 1px rgba(${sc.rgb}, 0.05)`,
      }
    : {
        ...pillBase,
        backgroundColor: hovered ? '#F9FAFB' : '#FFFFFF',
        color: '#6B7280',
        border: '1px solid hsl(var(--border))',
      };

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
      {count != null && count > 0 && (
        <span style={{
          fontSize: '11px', fontWeight: 600, lineHeight: '1',
          padding: '1px 5px', borderRadius: '8px',
          backgroundColor: active ? `rgba(${sc.rgb}, 0.14)` : 'hsl(var(--muted))',
          color: active ? sc.color : 'hsl(var(--muted-foreground))',
          transition: 'all 150ms ease',
        }}>{count}</span>
      )}
    </button>
  );
}

// ── Me Mode pill ──────────────────────────────────────────────────────
function MeModePill({
  active,
  count,
  onClick,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sc = STATUS_COLORS['meMode'];

  const style: React.CSSProperties = active
    ? {
        ...pillBase,
        backgroundColor: sc.color,
        color: '#FFFFFF',
        border: `1px solid ${sc.color}`,
        boxShadow: `0 1px 3px rgba(${sc.rgb}, 0.25)`,
      }
    : {
        ...pillBase,
        backgroundColor: hovered ? '#F9FAFB' : '#FFFFFF',
        color: '#6B7280',
        border: '1px solid hsl(var(--border))',
      };

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar circle */}
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: active ? 'rgba(255,255,255,0.25)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: '#FFFFFF',
        flexShrink: 0, letterSpacing: '0.3px',
      }}>SL</div>
      Me
      {count > 0 && (
        <span style={{
          fontSize: '11px', fontWeight: 600, lineHeight: '1',
          padding: '1px 5px', borderRadius: '8px',
          backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'hsl(var(--muted))',
          color: active ? 'rgba(255,255,255,0.85)' : 'hsl(var(--muted-foreground))',
          transition: 'all 150ms ease',
        }}>{count}</span>
      )}
    </button>
  );
}

// ── Archived pill (destructive) ───────────────────────────────────────
function ArchivedPill({
  active,
  count,
  onClick,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sc = STATUS_COLORS['Archived'];

  const style: React.CSSProperties = active
    ? {
        ...pillBase,
        backgroundColor: `rgba(${sc.rgb}, 0.08)`,
        color: sc.color,
        border: `1px solid ${sc.color}`,
        boxShadow: `0 1px 3px rgba(${sc.rgb}, 0.18), 0 0 0 1px rgba(${sc.rgb}, 0.05)`,
      }
    : hovered
      ? {
          ...pillBase,
          backgroundColor: `rgba(${sc.rgb}, 0.06)`,
          color: sc.color,
          border: `1px solid rgba(${sc.rgb}, 0.3)`,
        }
      : {
          ...pillBase,
          backgroundColor: '#FFFFFF',
          color: '#6B7280',
          border: '1px solid hsl(var(--border))',
        };

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Archive style={{ width: '12px', height: '12px' }} />
      Archived
      {count > 0 && (
        <span style={{
          fontSize: '11px', fontWeight: 600, lineHeight: '1',
          padding: '1px 5px', borderRadius: '8px',
          backgroundColor: active ? `rgba(${sc.rgb}, 0.14)` : hovered ? `rgba(${sc.rgb}, 0.10)` : 'hsl(var(--muted))',
          color: active ? sc.color : hovered ? sc.color : 'hsl(var(--muted-foreground))',
          transition: 'all 150ms ease',
        }}>{count}</span>
      )}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────
function PillSeparator() {
  return (
    <div style={{ width: '1px', height: '18px', backgroundColor: 'hsl(var(--border))', flexShrink: 0, margin: '0 4px' }} />
  );
}

// ── Main Component ────────────────────────────────────────────────────
export function ViewControls({
  viewDensity,
  filters,
  onFiltersChange,
  quickFilters = { meMode: false, showAll: true },
  onQuickFilterChange,
  allQuotes = [],
}: ViewControlsProps) {

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of allQuotes) {
      map[q.status] = (map[q.status] || 0) + 1;
    }
    return map;
  }, [allQuotes]);

  const meCount = useMemo(() => {
    return allQuotes.filter(q => {
      if (!q.salesRep) return false;
      if (typeof q.salesRep === 'string') return q.salesRep === 'Sarah Lindquist';
      return q.salesRep?.id === 'sr1';
    }).length;
  }, [allQuotes]);

  const toggleStatus = (status: QuoteStatus) => {
    const arr = filters.statuses;
    const next = arr.includes(status) ? arr.filter(s => s !== status) : [...arr, status];
    onFiltersChange({ ...filters, statuses: next });
  };

  // Build filter tags
  const filterTags: React.ReactNode[] = [];
  const amber = { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E' };
  const green = { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' };
  const purple = { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' };
  const teal = { bg: '#F0FDFA', border: '#99F6E4', text: '#115E59' };
  const rose = { bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239' };
  const slate = { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--foreground))' };

  const makeTag = (key: string, label: string, color: typeof amber, onRemove: () => void) => (
    <button
      key={key}
      onClick={onRemove}
      style={filterTagPillStyle(color)}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DC2626'; (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = color.border; (e.currentTarget as HTMLElement).style.color = color.text; }}
    >
      {label}
      <X style={{ width: '11px', height: '11px' }} />
    </button>
  );

  filters.priorities.forEach(p => {
    filterTags.push(makeTag(`p-${p}`, p, amber, () => {
      onFiltersChange({ ...filters, priorities: filters.priorities.filter(x => x !== p) });
    }));
  });
  filters.salesReps.forEach(r => {
    const rep = SALES_REPS.find(sr => sr.id === r);
    filterTags.push(makeTag(`sr-${r}`, `Rep: ${rep?.name || r}`, green, () => {
      onFiltersChange({ ...filters, salesReps: filters.salesReps.filter(x => x !== r) });
    }));
  });
  filters.customers.forEach(c => {
    const cust = CUSTOMERS.find(cu => cu.id === c);
    filterTags.push(makeTag(`cu-${c}`, `Customer: ${cust?.name || c}`, teal, () => {
      onFiltersChange({ ...filters, customers: filters.customers.filter(x => x !== c) });
    }));
  });
  filters.tags.forEach(t => {
    filterTags.push(makeTag(`t-${t}`, t, purple, () => {
      onFiltersChange({ ...filters, tags: filters.tags.filter(x => x !== t) });
    }));
  });
  (filters.dateFilters || []).forEach(df => {
    const label = `${DATE_FIELD_LABELS[df.field]} ${DATE_OPERATOR_LABELS[df.operator]}${df.value ? ' ' + df.value : ''}${df.valueTo ? ' → ' + df.valueTo : ''}`;
    filterTags.push(makeTag(`df-${df.id}`, label, rose, () => {
      onFiltersChange({ ...filters, dateFilters: (filters.dateFilters || []).filter(x => x.id !== df.id) });
    }));
  });
  if (filters.valueFilter) {
    const vf = filters.valueFilter;
    const label = `Value ${VALUE_OPERATOR_LABELS[vf.operator]} $${vf.value.toLocaleString()}${vf.operator === 'between' && vf.valueTo ? ` – $${vf.valueTo.toLocaleString()}` : ''}`;
    filterTags.push(makeTag('vf', label, slate, () => {
      onFiltersChange({ ...filters, valueFilter: null });
    }));
  }
  (filters.textFilters || []).forEach(tf => {
    const label = `${TEXT_FIELD_LABELS[tf.field]} ${TEXT_OPERATOR_LABELS[tf.operator]}${tf.value ? ` "${tf.value}"` : ''}`;
    filterTags.push(makeTag(`tf-${tf.id}`, label, slate, () => {
      onFiltersChange({ ...filters, textFilters: (filters.textFilters || []).filter(x => x.id !== tf.id) });
    }));
  });

  const hasNonStatusFilters = filterTags.length > 0;

  const clearAllNonStatus = () => {
    onFiltersChange({
      ...filters,
      salesReps: [], customers: [], priorities: [], tags: [],
      dateRange: null, valueRange: null, dateFilters: [], valueFilter: null, textFilters: [],
    });
  };

  if (viewDensity === 'board') {
    if (!hasNonStatusFilters) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {filterTags.slice(0, 8)}
        {filterTags.length > 8 && <span style={{ ...pillBase, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', cursor: 'default' }}>+{filterTags.length - 8} more</span>}
        <button onClick={clearAllNonStatus} style={{ ...pillBase, color: 'hsl(var(--muted-foreground))', backgroundColor: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FFF1F2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >Clear all</button>
      </div>
    );
  }

  const isShowAll = filters.statuses.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', minWidth: 0, flexWrap: 'nowrap' }}>

          {/* Me Mode toggle pill */}
          <MeModePill
            active={quickFilters.meMode}
            count={meCount}
            onClick={() => onQuickFilterChange('meMode')}
          />

          <PillSeparator />

          {/* Show All */}
          <StatusPill
            label="Show All"
            active={isShowAll}
            colorKey="showAll"
            onClick={() => onQuickFilterChange('showAll')}
          />

          {/* Status pills */}
          {STATUS_PILLS.map(({ status, label }) => (
            <StatusPill
              key={status}
              label={label}
              count={statusCounts[status] || 0}
              active={filters.statuses.includes(status)}
              colorKey={status}
              onClick={() => toggleStatus(status)}
            />
          ))}

          <PillSeparator />

          {/* Archived toggle pill (destructive) */}
          <ArchivedPill
            active={filters.statuses.includes('Archived')}
            count={statusCounts['Archived'] || 0}
            onClick={() => toggleStatus('Archived')}
          />
        </div>
      </div>

      {/* Applied filter tags row */}
      {hasNonStatusFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
          {filterTags.slice(0, 8)}
          {filterTags.length > 8 && <span style={{ ...pillBase, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', cursor: 'default', border: '1px solid hsl(var(--border))' }}>+{filterTags.length - 8} more</span>}
          <button onClick={clearAllNonStatus} style={{ ...pillBase, color: 'hsl(var(--muted-foreground))', backgroundColor: 'transparent', border: '1px solid transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FFF1F2'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >Clear all</button>
        </div>
      )}
    </div>
  );
}