import { ChevronDown, ChevronRight, RotateCcw, Check } from 'lucide-react';

import type { RMAVersionEntry } from '@/app/data/rmaVersions';
import { PersonAvatar } from '@/app/components/data-table/PersonAvatar';
import { versionPalette as C } from './rmaVersionDisplay';
import { VersionMoney } from './VersionMoney';

/**
 * The clickable strip that opens a version's expanded body.
 *
 * Ported from the Purchase Order module's `POVersionRow.tsx`. Fully
 * controlled: the parent owns expand, compare and revert state, and decides
 * whether a click selects for comparison or toggles the body.
 */
export default function RMAVersionRow({
  version: ver,
  isExpanded,
  isCurrent,
  compareMode,
  isCompareSelected,
  onClick,
  onRevertClick,
}: {
  version: RMAVersionEntry;
  isExpanded: boolean;
  /** True when this row is the return's current version. Drives the Current
   *  pill and hides the Revert action. */
  isCurrent: boolean;
  compareMode: boolean;
  isCompareSelected: boolean;
  onClick: () => void;
  /** Absent once the return is locked (DQ-09): no revert is offered. */
  onRevertClick?: (() => void) | undefined;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-150"
      style={{
        backgroundColor: isCompareSelected ? '#EFF6FF' : isExpanded ? C.muted : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isExpanded && !isCompareSelected) {
          e.currentTarget.style.backgroundColor = '#FAFBFC';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded && !isCompareSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {compareMode ? (
        <div
          className="flex items-center justify-center shrink-0 transition-all duration-150"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: isCompareSelected ? 'none' : `1.5px solid ${C.text400}`,
            backgroundColor: isCompareSelected ? 'hsl(var(--primary))' : '#FFFFFF',
          }}
        >
          {isCompareSelected && (
            <Check style={{ width: 10, height: 10, color: '#FFFFFF' }} strokeWidth={3} />
          )}
        </div>
      ) : isExpanded ? (
        <ChevronDown style={{ width: 14, height: 14, color: C.text400 }} className="shrink-0" />
      ) : (
        <ChevronRight style={{ width: 14, height: 14, color: C.text400 }} className="shrink-0" />
      )}

      <PersonAvatar name={ver.createdBy} size="md" shape="circle" initials={ver.avatar} />

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center flex-wrap mb-1.5" style={{ gap: 6 }}>
          <span
            className="tabular-nums shrink-0"
            style={{ fontSize: 14, fontWeight: 700, color: C.text900, lineHeight: 1 }}
          >
            V{ver.version}
          </span>
          {isCurrent && (
            <span
              className="inline-flex items-center rounded-md border shrink-0"
              style={{
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: 'hsl(var(--accent))',
                color: 'hsl(var(--primary))',
                borderColor: 'hsl(var(--primary))',
                lineHeight: 1.4,
              }}
            >
              Current Version
            </span>
          )}
          <span style={{ fontSize: 11, color: C.text400, lineHeight: 1 }} className="shrink-0">
            ·
          </span>
          <span
            className="tabular-nums shrink-0"
            style={{ fontSize: 11, fontWeight: 500, color: C.text500, lineHeight: 1 }}
          >
            {/* The company date, as the list writes it. */}
            {new Date(ver.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span style={{ fontSize: 11, color: C.text400, lineHeight: 1 }} className="shrink-0">
            ·
          </span>
          <span
            className="shrink-0"
            style={{ fontSize: 11, fontWeight: 500, color: C.text600, lineHeight: 1 }}
          >
            {ver.createdBy}
          </span>
        </div>

        {ver.previousStatus && ver.newStatus && ver.previousStatus !== ver.newStatus && (
          <div
            className="overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#92400E',
              lineHeight: 1.4,
              maxWidth: '100%',
            }}
          >
            {ver.previousStatus} → {ver.newStatus}
          </div>
        )}
      </div>

      <div className="flex items-center shrink-0" style={{ gap: 10 }}>
        <span
          className="inline-flex items-center rounded-md tabular-nums"
          style={{
            padding: '1px 6px',
            backgroundColor: C.divider,
            color: C.text600,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {ver.snapshot.lineItemCount} {ver.snapshot.lineItemCount === 1 ? 'line' : 'lines'}
        </span>
        <span
          className="tabular-nums"
          style={{ fontSize: 13, fontWeight: 600, color: C.text900, lineHeight: 1 }}
        >
          <VersionMoney snap={ver.snapshot} value={ver.snapshot.totalValue} />
        </span>
      </div>

      {!compareMode && !isCurrent && onRevertClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRevertClick();
          }}
          title="Revert to this version"
          aria-label="Revert to this version"
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 cursor-pointer transition-colors duration-150 hover:bg-muted/60"
          style={{ border: 'none', backgroundColor: 'transparent', color: C.text500 }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}
