import { useMemo } from 'react';
import { X, ArrowLeftRight, ArrowUp, ArrowDown, Plus, Minus, Pencil } from 'lucide-react';

import type { RMAChangeRecord, RMAVersionEntry } from '@/app/data/rmaVersions';
import { formatVersionCurrency, versionStatusConfig } from './rmaVersionDisplay';

/**
 * Side-by-side comparison of two versions, rendered inline below the version
 * list. Ported from the Purchase Order module's `POCompareFullScreen.tsx`.
 *
 * The compared fields are the return's own: what was asked for, what the
 * vendor authorized and what that is worth, rather than the PO's subtotal /
 * discount / shipping ladder.
 */

type ChangeAction = RMAChangeRecord['action'];

/* Icon and tone come from the action, never the change type. */
const CHANGE_KIND: Record<ChangeAction, { icon: typeof Plus; color: string; bg: string }> = {
  Added: { icon: Plus, color: 'hsl(var(--success))', bg: 'rgba(5, 150, 105, 0.15)' },
  Removed: { icon: Minus, color: 'hsl(var(--destructive))', bg: 'rgba(220, 38, 38, 0.15)' },
  Changed: { icon: Pencil, color: 'hsl(var(--warning))', bg: 'rgba(217, 119, 6, 0.15)' },
};

/** The reasons a version's lines actually carry.
 *
 *  A return is given a reason line by line, so there is no one reason to put
 *  against the version. RMA-01007 carries five across its twelve lines, and
 *  this row used to print whichever one the header happened to hold.
 *
 *  All of them, every time. It read "Wrong item or variant, Over-shipped +3
 *  more", which tells a reader comparing two versions that three reasons
 *  exist and refuses to say which -- on the one screen whose whole job is to
 *  show what differs. Five short phrases wrap onto two lines; a hidden
 *  difference costs more than the height does.
 *
 *  Sorted, so the comparison means something. Taken in line order, moving a
 *  line up the return reordered the list and the row lit up as changed when
 *  nothing about the reasons had. */
function reasonsOn(v: RMAVersionEntry): string {
  const seen = [...new Set(v.snapshot.lineItems.map((li) => li.reason))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return seen.length === 0 ? '\u2014' : seen.join(', ');
}

export default function RMAVersionCompareView({
  v1,
  v2,
  onClose,
}: {
  v1: RMAVersionEntry;
  v2: RMAVersionEntry;
  onClose: () => void;
}) {
  const fields = useMemo(
    () => [
      {
        label: 'Return Lines',
        val1: String(v1.snapshot.lineItemCount),
        val2: String(v2.snapshot.lineItemCount),
      },
      {
        label: 'Authorized Qty',
        val1: String(v1.snapshot.totalQty),
        val2: String(v2.snapshot.totalQty),
      },
      {
        label: 'Return Reasons',
        val1: reasonsOn(v1),
        val2: reasonsOn(v2),
      },
      {
        label: 'Vendor RMA Number',
        val1: v1.snapshot.vendorRMANumber ?? '—',
        val2: v2.snapshot.vendorRMANumber ?? '—',
      },
      {
        label: 'Carrier',
        val1: v1.snapshot.carrier ?? '—',
        val2: v2.snapshot.carrier ?? '—',
      },
      {
        label: 'Return Value',
        val1: formatVersionCurrency(v1.snapshot.totalValue),
        val2: formatVersionCurrency(v2.snapshot.totalValue),
      },
    ],
    [v1, v2],
  );

  const v1Cfg = versionStatusConfig[v1.versionStatus] ?? versionStatusConfig.draft;
  const v2Cfg = versionStatusConfig[v2.versionStatus] ?? versionStatusConfig.draft;

  const renderSummaryCard = (v: RMAVersionEntry, side: 'left' | 'right') => {
    const cfg = side === 'left' ? v1Cfg : v2Cfg;
    const dateLabel = (() => {
      const d = new Date(v.createdAt);
      if (Number.isNaN(d.getTime())) return v.createdAt || '—';
      // The company date. Version history printed 09/22/2026 while the list
      // beside it printed Sep 22, 2026, which is a third format on a module
      // that already had two.
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    })();
    return (
      <div
        style={{
          border: '1px solid hsl(var(--border))',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#FAFBFC',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            V{v.version} · {dateLabel}
          </span>
          <span
            className="inline-flex items-center rounded-full whitespace-nowrap"
            style={{
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              backgroundColor: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
            }}
          >
            {cfg.label}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr',
            padding: '6px 12px',
            backgroundColor: '#FAFBFC',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Field
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Value
          </span>
        </div>

        {fields.map((f) => {
          const val = side === 'left' ? f.val1 : f.val2;
          const changed = f.val1 !== f.val2;
          const n1 = Number(String(f.val1).replace(/[^0-9.-]/g, ''));
          const n2 = Number(String(f.val2).replace(/[^0-9.-]/g, ''));
          const numeric = changed && Number.isFinite(n1) && Number.isFinite(n2) && n1 !== n2;
          const direction = numeric && side === 'right' ? (n2 > n1 ? 'up' : 'down') : null;
          const isStruck = changed && side === 'left' && !numeric;
          return (
            <div
              key={f.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                padding: '10px 12px',
                borderBottom: '1px solid hsl(var(--border))',
                backgroundColor: changed ? 'rgba(245, 158, 11, 0.04)' : 'hsl(var(--card))',
                borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent',
              }}
            >
              <span
                style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}
              >
                {f.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontWeight: side === 'right' && changed ? 600 : 500,
                    color:
                      side === 'right' && changed
                        ? '#0F172A'
                        : changed
                          ? 'hsl(var(--muted-foreground))'
                          : 'hsl(var(--foreground))',
                    textDecoration: isStruck ? 'line-through' : 'none',
                    textDecorationColor: 'rgba(107, 114, 128, 0.4)',
                  }}
                >
                  {val}
                </span>
                {direction === 'up' && (
                  <ArrowUp
                    style={{ width: 12, height: 12, color: 'hsl(var(--success))' }}
                    strokeWidth={2.5}
                  />
                )}
                {direction === 'down' && (
                  <ArrowDown
                    style={{ width: 12, height: 12, color: 'hsl(var(--destructive))' }}
                    strokeWidth={2.5}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderChangeRow = (change: RMAChangeRecord) => {
    const ct = CHANGE_KIND[change.action];
    const CIcon = ct.icon;
    return (
      <div
        key={change.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            backgroundColor: ct.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CIcon style={{ width: 11, height: 11, color: ct.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'hsl(var(--foreground))',
              lineHeight: 1.3,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: ct.color, marginRight: 4 }}>
              {change.action}:
            </span>
            {change.subject}
          </div>
          {change.subjectDetail && (
            <div
              style={{
                fontSize: 10,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.3,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {change.subjectDetail}
            </div>
          )}
          {change.detail && (
            <div
              style={{
                fontSize: 10,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.3,
                marginTop: 1,
              }}
            >
              {change.detail}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            flexShrink: 0,
            marginTop: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {change.timestamp}
        </span>
      </div>
    );
  };

  const renderChangesCard = (v: RMAVersionEntry) => (
    <div
      style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: 'hsl(var(--muted))',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Changes in V{v.version}
        </span>
        <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
          ({v.changes.length})
        </span>
      </div>
      {v.changes.length === 0 ? (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              fontStyle: 'italic',
            }}
          >
            No changes recorded
          </span>
        </div>
      ) : (
        v.changes.map(renderChangeRow)
      )}
    </div>
  );

  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--card))',
        borderRadius: 8,
        border: '1px solid hsl(var(--border))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: 'hsl(var(--muted))',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeftRight style={{ width: 14, height: 14, color: 'hsl(var(--primary))' }} />
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1 }}
          >
            Comparing V{v1.version} ↔ V{v2.version}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close compare view"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X style={{ width: 14, height: 14, color: 'hsl(var(--muted-foreground))' }} />
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {renderSummaryCard(v1, 'left')}
          {renderSummaryCard(v2, 'right')}
        </div>
        {(v1.changes.length > 0 || v2.changes.length > 0) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 12,
            }}
          >
            {renderChangesCard(v1)}
            {renderChangesCard(v2)}
          </div>
        )}
      </div>
    </div>
  );
}
