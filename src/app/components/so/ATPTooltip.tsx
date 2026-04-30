/* InventorySnapshotTooltip — full inventory breakdown overlay.
   Ported from Quotes module's InventoryTooltip.
   Uses createPortal to escape transformed parent containers. */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/* ── deterministic inventory breakdown from a single stockQuantity ── */
function deriveInventory(stockQuantity: number) {
  const quarantined = stockQuantity > 20 ? Math.floor(stockQuantity * 0.04) : (stockQuantity > 5 ? 1 : 0);
  const demand = stockQuantity > 10 ? Math.floor(stockQuantity * 0.12) : (stockQuantity > 3 ? 1 : 0);
  const onHand = stockQuantity + quarantined + demand;
  const allocated = Math.floor(onHand * 0.08);
  const available = onHand - allocated - quarantined;
  const atp = onHand - quarantined - demand;
  const incoming = Math.floor(stockQuantity * 0.25);
  const projectedAvailable = onHand - allocated - quarantined + incoming - demand;

  return { onHand, allocated, quarantined, available, atp, demand, projectedAvailable, incoming };
}

type Placement = 'top' | 'bottom';

interface ATPTooltipProps {
  product: { code: string; inStock: number };
  children: ReactNode;
}

export function ATPTooltip({ product, children }: ATPTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inv = deriveInventory(product.inStock);

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const CARD_H = 310;
    const CARD_W = 252;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: Placement = spaceBelow > CARD_H + 12 ? 'bottom' : 'top';

    let x = rect.left + rect.width / 2;
    // Keep within viewport horizontally
    if (x - CARD_W / 2 < 8) x = CARD_W / 2 + 8;
    if (x + CARD_W / 2 > window.innerWidth - 8) x = window.innerWidth - CARD_W / 2 - 8;

    setPos({
      x,
      y: placement === 'bottom' ? rect.bottom + 6 : rect.top - 6,
      placement,
    });
  }, []);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    openTimer.current = setTimeout(() => {
      calcPos();
      setOpen(true);
    }, 280);
  }, [calcPos]);

  const handleLeave = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  const handleCardEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const handleCardLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const rows: { label: string; value: number; color: string; bold?: boolean; indent?: boolean; sub?: boolean }[] = [
    { label: 'On-Hand', value: inv.onHand, color: '#1F2937', bold: true },
    { label: 'Allocated', value: inv.allocated, color: '#6B7280', indent: true },
    { label: 'Quarantined', value: inv.quarantined, color: inv.quarantined > 0 ? '#DC2626' : '#6B7280', indent: true },
    { label: 'Available', value: inv.available, color: '#1F2937', bold: true },
    { label: 'Demand', value: inv.demand, color: '#6B7280', indent: true },
    { label: 'ATP', value: product.inStock, color: product.inStock <= 0 ? '#DC2626' : product.inStock <= 5 ? '#92400E' : '#059669', bold: true },
    { label: 'Projected Available', value: inv.projectedAvailable, color: '#1F2937', sub: true },
  ];

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>

      {open && pos && createPortal(
        <div
          ref={cardRef}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.placement === 'bottom' ? pos.y : undefined,
            bottom: pos.placement === 'top' ? window.innerHeight - pos.y : undefined,
            transform: 'translateX(-50%)',
            zIndex: 99999,
            fontFamily: 'Inter, system-ui, sans-serif',
            animation: 'invTooltipIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes invTooltipIn {
              from { opacity: 0; transform: translateX(-50%) translateY(${pos.placement === 'bottom' ? '-4px' : '4px'}) scale(0.97); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
          `}</style>

          <div style={{
            width: '252px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 14px 8px',
              borderBottom: '1px solid #F3F4F6',
            }}>
              <Info style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                Inventory Snapshot
              </span>
            </div>

            {/* Rows */}
            <div style={{ padding: '6px 0' }}>
              {rows.map((row) => {
                const isATP = row.label === 'ATP';
                const isAvailable = row.label === 'Available';
                const showDividerBefore = isAvailable || isATP || row.label === 'Projected Available';

                return (
                  <div key={row.label}>
                    {showDividerBefore && (
                      <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '4px 14px' }} />
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `3px 14px 3px ${row.indent ? '26px' : '14px'}`,
                        backgroundColor: isATP ? '#F0FDF4' : 'transparent',
                      }}
                    >
                      <span style={{
                        fontSize: row.sub ? '11px' : '12px',
                        fontWeight: row.bold ? 600 : 400,
                        color: row.indent ? '#6B7280' : '#374151',
                        lineHeight: '1.4',
                      }}>
                        {row.label}
                        {isATP && (
                          <span style={{
                            fontSize: '10px', fontWeight: 400, color: '#6B7280',
                            marginLeft: '4px',
                          }}>
                            (Available-to-Promise)
                          </span>
                        )}
                      </span>
                      <span style={{
                        fontSize: row.sub ? '11px' : '12px',
                        fontWeight: row.bold ? 600 : 500,
                        color: row.color,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: '1.4',
                      }}>
                        {row.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formula footnote */}
            <div style={{
              padding: '7px 14px 9px',
              borderTop: '1px solid #F3F4F6',
              backgroundColor: '#F9FAFB',
            }}>
              <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.45' }}>
                <span style={{ fontWeight: 500, color: '#6B7280' }}>ATP</span> = On-Hand − Quarantined − Demand
              </div>
              <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.45', marginTop: '1px' }}>
                <span style={{ fontWeight: 500, color: '#6B7280' }}>Projected</span> = Available + Incoming − Demand
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
