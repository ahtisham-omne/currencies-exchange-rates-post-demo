import { Package, CheckCircle2, Clock, Undo2, CalendarClock } from 'lucide-react';

import type { RMAVersionEntry } from '@/app/data/rmaVersions';
import { formatDate } from '@/app/components/vendorSelectionModel';
import { formatVersionCurrency, versionPalette as C } from './rmaVersionDisplay';

/**
 * The expanded body of a version row: the timestamp strip, the revert reason
 * when one was given, and the line snapshot as it stood at that version.
 *
 * Ported from the Purchase Order module's `POVersionSnapshotPanel.tsx`. A
 * return has no shipping fee or discount, so the footer states what was
 * authorized against what was asked for instead.
 *
 * Pure presentational — no state, no callbacks.
 */
export default function RMAVersionSnapshotPanel({
  version: ver,
}: {
  version: RMAVersionEntry;
}) {
  const lineItems = ver.snapshot.lineItems ?? [];
  const requestedQty = lineItems.reduce((s, li) => s + li.returnQty, 0);
  // Authorized is what the vendor has agreed to, and on a draft that is
  // nothing. The snapshot's total falls back to the requested figure when no
  // line carries an approved one, which printed "Requested: 535 · Authorized:
  // 535" against a line table whose AUTH column read nothing at all.
  const anyAuthorized = lineItems.some((li) => li.approvedQty !== undefined);
  const authorized = anyAuthorized
    ? lineItems.reduce((s, li) => s + (li.approvedQty ?? 0), 0)
    : null;

  return (
    <>
      <div
        className="flex flex-wrap items-center pt-2.5 mb-3.5"
        style={{ gap: 16, borderTop: `1px solid ${C.divider}` }}
      >
        <div className="flex items-center" style={{ gap: 5 }}>
          <Clock style={{ width: 12, height: 12, color: C.text400 }} />
          <span
            style={{ fontSize: 12, fontWeight: 400, color: C.text500, lineHeight: 1 }}
            className="tabular-nums"
          >
            Created {new Date(ver.createdAt).toLocaleString()}
          </span>
        </div>
        {(ver.versionStatus === 'approved' || ver.versionStatus === 'closed') && (
          <div className="flex items-center" style={{ gap: 5 }}>
            <CheckCircle2 style={{ width: 12, height: 12, color: '#065F46' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#065F46', lineHeight: 1 }}>
              {ver.snapshot.vendorRMANumber
                ? `Vendor RMA ${ver.snapshot.vendorRMANumber}`
                : 'Authorized'}
            </span>
          </div>
        )}
        {ver.snapshot.expectedResolutionDate && (
          <div className="flex items-center" style={{ gap: 5 }}>
            <CalendarClock style={{ width: 12, height: 12, color: C.text400 }} />
            <span style={{ fontSize: 12, fontWeight: 400, color: C.text500, lineHeight: 1 }}>
              Expected resolution:{' '}
              <span className="tabular-nums" style={{ fontWeight: 500, color: C.text700 }}>
                {formatDate(ver.snapshot.expectedResolutionDate)}
              </span>
            </span>
          </div>
        )}
      </div>

      {ver.revertReason && (
        <div
          className="rounded-md border mb-4"
          style={{
            borderColor: '#FDE68A',
            backgroundColor: '#FFFBEB',
            padding: '10px 12px',
          }}
        >
          <div className="flex items-center" style={{ gap: 6, marginBottom: 4 }}>
            <Undo2 style={{ width: 12, height: 12, color: '#92400E' }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#92400E',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              Revert reason
            </span>
            {ver.revertReasonBy && (
              <span style={{ fontSize: 10, fontWeight: 500, color: '#78350F', lineHeight: 1 }}>
                · by {ver.revertReasonBy}
              </span>
            )}
            {ver.revertReasonAt && (
              <span
                className="tabular-nums"
                style={{ fontSize: 10, fontWeight: 500, color: '#78350F', lineHeight: 1 }}
              >
                · {new Date(ver.revertReasonAt).toLocaleString()}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: '#78350F',
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {ver.revertReason}
          </p>
        </div>
      )}

      <div
        className="rounded-md border overflow-hidden mb-4 w-full"
        style={{ borderColor: C.border, maxWidth: '100%' }}
      >
        <div
          className="flex items-center px-3.5 py-2 border-b"
          style={{
            gap: 6,
            borderColor: C.border,
            backgroundColor: 'color-mix(in srgb, hsl(var(--muted)) 30%, transparent)',
          }}
        >
          <Package style={{ width: 12, height: 12, color: C.text500 }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.text500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            Return Lines
          </span>
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
            {lineItems.length}
          </span>
        </div>

        <div
          className="flex items-center px-3.5 py-1.5 border-b"
          style={{
            gap: 8,
            borderColor: C.border,
            backgroundColor: 'color-mix(in srgb, hsl(var(--muted)) 18%, transparent)',
          }}
        >
          <div style={{ width: 24, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              Item
            </span>
          </div>
          {(['Return', 'Auth', 'UOM', 'Price', 'Value'] as const).map((h) => (
            <span
              key={h}
              className="shrink-0"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
                width: h === 'Return' || h === 'Auth' ? 46 : h === 'UOM' ? 44 : 80,
                textAlign: h === 'UOM' ? 'center' : 'right',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {lineItems.length > 0 ? (
          <div style={{ backgroundColor: '#FFFFFF' }}>
            {lineItems.map((li, liIdx) => {
              const refused = li.approvedQty === 0;
              return (
                <div
                  key={li.id}
                  className="flex items-center px-3.5 py-2"
                  style={{
                    gap: 8,
                    borderTop: liIdx > 0 ? `1px solid ${C.divider}` : 'none',
                    opacity: refused ? 0.55 : 1,
                  }}
                >
                  <div
                    className="flex items-center justify-center shrink-0 rounded-md border"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: C.divider,
                      borderColor: C.border,
                    }}
                  >
                    <Package style={{ width: 11, height: 11, color: C.text400 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.text700,
                        lineHeight: 1,
                        marginBottom: 2,
                      }}
                    >
                      {li.sku}
                    </div>
                    <div
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ fontSize: 12, fontWeight: 400, color: C.text600, lineHeight: 1.3 }}
                    >
                      {li.description}
                    </div>
                  </div>
                  <span
                    className="tabular-nums shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: C.text700,
                      lineHeight: 1,
                      width: 46,
                      textAlign: 'right',
                    }}
                  >
                    {li.returnQty}
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: refused ? '#991B1B' : li.approvedQty === undefined ? C.text400 : '#065F46',
                      lineHeight: 1,
                      width: 46,
                      textAlign: 'right',
                    }}
                  >
                    {li.approvedQty === undefined ? '—' : li.approvedQty}
                  </span>
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: C.text500,
                      lineHeight: 1,
                      width: 44,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {li.uom}
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: C.text600,
                      lineHeight: 1,
                      width: 80,
                      textAlign: 'right',
                    }}
                  >
                    {formatVersionCurrency(li.unitPrice)}
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.text900,
                      lineHeight: 1,
                      width: 80,
                      textAlign: 'right',
                    }}
                  >
                    {formatVersionCurrency(li.totalValue)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="px-3.5 py-3"
            style={{ fontSize: 12, color: C.text400, fontStyle: 'italic' }}
          >
            No return lines
          </div>
        )}

        <div
          className="flex items-center justify-between px-3.5 py-2 border-t"
          style={{
            borderColor: C.border,
            backgroundColor: 'color-mix(in srgb, hsl(var(--muted)) 30%, transparent)',
          }}
        >
          <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 400, color: C.text500, lineHeight: 1 }}>
            Requested: <span style={{ fontWeight: 500, color: C.text700 }}>{requestedQty}</span>
            &nbsp;·&nbsp; Authorized:{' '}
            <span style={{ fontWeight: 500, color: authorized === null ? C.text400 : C.text700 }}>
              {authorized === null ? 'Not yet authorized' : authorized}
            </span>
            {ver.snapshot.restockingFee !== undefined && (
              <>
                &nbsp;·&nbsp; Restocking fee:{' '}
                <span style={{ fontWeight: 500, color: C.text700 }}>
                  {formatVersionCurrency(ver.snapshot.restockingFee)}
                </span>
              </>
            )}
          </span>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.text500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              Return Value
            </span>
            <span
              className="tabular-nums"
              style={{ fontSize: 14, fontWeight: 700, color: C.text900, lineHeight: 1 }}
            >
              {formatVersionCurrency(ver.snapshot.totalValue)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
