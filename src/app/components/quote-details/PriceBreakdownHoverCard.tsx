/* ═══════════════════════════════════════════════════════════════════════════
 *  PriceBreakdownHoverCard — Quote module
 *  Mirrors the InventoryTooltip shape (white surface, soft shadow, 280 ms
 *  open delay, portalled). Renders the line's subtotal, every active
 *  pricing rule's one-time impact, every item-scoped adjustment's impact,
 *  and the resulting total — replacing the inline "Subtotal $X" sub-line
 *  the TOTAL column used to render.
 * ═══════════════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { evaluateRuleForLine } from './pricingRulesData';
import type { PricingRulesAPI } from './usePricingRules';
import type { AdjustmentsAPI } from './useAdjustments';

type Placement = 'top' | 'bottom';

interface PriceBreakdownHoverCardProps {
  line: { id: string; productId: string; quantity: number; unitPrice: number };
  pricingAPI?: PricingRulesAPI;
  adjustmentsAPI?: AdjustmentsAPI;
  formatCurrency: (n: number) => string;
  children: ReactNode;
}

export function PriceBreakdownHoverCard({ line, pricingAPI, adjustmentsAPI, formatCurrency, children }: PriceBreakdownHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseSubtotal = line.quantity * line.unitPrice;

  const ruleRows: { name: string; amount: number; type: 'discount' | 'premium' }[] = [];
  if (pricingAPI) {
    for (const rule of pricingAPI.state.attached) {
      if (pricingAPI.state.deactivatedRuleIds.has(rule.id)) continue;
      const activeOnThisLine = pricingAPI.state.activatedLineIdsByRule.get(rule.id)?.has(line.id) ?? false;
      if (!activeOnThisLine) continue;
      const { applies, amount } = evaluateRuleForLine(rule, line);
      if (!applies || amount === 0) continue;
      ruleRows.push({ name: rule.name, amount, type: rule.type });
    }
  }

  const adjRows: { label: string; amount: number; type: 'discount' | 'premium' }[] = [];
  if (adjustmentsAPI) {
    for (const adj of adjustmentsAPI.adjustments) {
      if (!adj.isApplied) continue;
      if (adj.scope !== 'item') continue;
      if (!adj.appliedTo?.includes(line.id)) continue;
      const dollar = adj.amountType === '%' ? (baseSubtotal * adj.amount) / 100 : adj.amount;
      if (dollar === 0) continue;
      adjRows.push({ label: adj.label, amount: dollar, type: adj.type });
    }
  }

  const ruleDelta = ruleRows.reduce((s, r) => s + (r.type === 'discount' ? -r.amount : r.amount), 0);
  const adjDelta = adjRows.reduce((s, r) => s + (r.type === 'discount' ? -r.amount : r.amount), 0);
  const lineTotal = baseSubtotal + ruleDelta + adjDelta;

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const rowCount = 1 + ruleRows.length + adjRows.length + 1;
    const estimatedH = 56 + rowCount * 22 + 36;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: Placement = spaceBelow > estimatedH + 12 ? 'bottom' : 'top';
    setPos({
      x: rect.right,
      y: placement === 'bottom' ? rect.bottom + 6 : rect.top - 6,
      placement,
    });
  }, [ruleRows.length, adjRows.length]);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    openTimer.current = setTimeout(() => { calcPos(); setOpen(true); }, 240);
  }, [calcPos]);
  const handleLeave = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);
  const handleCardEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const handleCardLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const hasOverlay = ruleRows.length > 0 || adjRows.length > 0;

  /* When the line has no pricing rules or adjustments, the total is
     just qty × unit price — nothing to break down, so we drop the
     dotted underline and hover handlers entirely and render the
     children inline. The user shouldn't see a tooltip cue on a row
     whose total equals its subtotal. */
  if (!hasOverlay) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        /* Inline-flex wrapper sized to content, with a dotted bottom
           border that signals "hover for breakdown". border-bottom
           renders reliably even when the inner number span is laid out
           block-level (text-decoration can drop through inline-flex
           wrappers in some browsers, hence the switch off text-deco). */
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'help',
          borderBottom: '1.5px dotted rgba(15, 23, 42, 0.45)',
          paddingBottom: 1,
          lineHeight: 1.2,
        }}
      >
        {children}
      </span>

      {open && pos && createPortal(
        <div
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.placement === 'bottom' ? pos.y : undefined,
            bottom: pos.placement === 'top' ? window.innerHeight - pos.y : undefined,
            transform: 'translateX(-100%)',
            zIndex: 99999,
            fontFamily: 'Inter, system-ui, sans-serif',
            animation: 'pbhcIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes pbhcIn {
              from { opacity: 0; transform: translateX(-100%) translateY(${pos.placement === 'bottom' ? '-4px' : '4px'}) scale(0.97); }
              to   { opacity: 1; transform: translateX(-100%) translateY(0) scale(1); }
            }
          `}</style>

          <div style={{
            width: 272,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {/* Header — mirrors Partner InventoryTooltip exactly:
                Info icon + 11px uppercase title, 0.3 letter-spacing,
                10/14/8 padding, hairline bottom border. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 8px',
              borderBottom: '1px solid #F3F4F6',
            }}>
              <Info style={{ width: 13, height: 13, color: '#9CA3AF', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1F2937', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Price Breakdown
              </span>
            </div>

            {/* Body rows — Partner's row chrome: 12px regular labels,
                bold rows in 600 weight, 3px vertical padding, indent
                children 26px. Dividers between sections at 4px 14px. */}
            <div style={{ padding: '6px 0' }}>
              <BreakdownRow
                label="Subtotal"
                sub={`${line.quantity} × ${formatCurrency(line.unitPrice)}`}
                value={formatCurrency(baseSubtotal)}
                bold
              />

              {ruleRows.length > 0 && (
                <>
                  <Divider />
                  {ruleRows.map((r) => (
                    <BreakdownRow
                      key={r.name}
                      label={r.name}
                      kind="Pricing Rule"
                      kindColor="#1B6EF3"
                      kindBg="#EFF6FF"
                      kindBorder="#BFDBFE"
                      value={`${r.type === 'discount' ? '−' : '+'}${formatCurrency(r.amount)}`}
                      valueColor={r.type === 'discount' ? '#059669' : '#B45309'}
                      indent
                    />
                  ))}
                </>
              )}

              {adjRows.length > 0 && (
                <>
                  <Divider />
                  {adjRows.map((r) => (
                    <BreakdownRow
                      key={r.label}
                      label={r.label}
                      kind="One-Time"
                      kindColor="#7C3AED"
                      kindBg="#F5F3FF"
                      kindBorder="#DDD6FE"
                      value={`${r.type === 'discount' ? '−' : '+'}${formatCurrency(r.amount)}`}
                      valueColor={r.type === 'discount' ? '#059669' : '#B45309'}
                      indent
                    />
                  ))}
                </>
              )}

              {/* Total — Partner inventory snapshot's ATP row pattern:
                  inline body row with green tint background, same row
                  chrome as the others (no separate footer panel). */}
              <Divider />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 14px',
                backgroundColor: '#F0FDF4',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', lineHeight: 1.4 }}>Total</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
                  {formatCurrency(lineTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function BreakdownRow({ label, sub, value, valueColor, bold, indent, kind, kindColor, kindBg, kindBorder }: {
  label: string; sub?: string; value: string; valueColor?: string; bold?: boolean; indent?: boolean;
  /* Optional kind tag — rendered as a Partner-style pill next to
     the row label so the user can tell at a glance whether the
     adjustment is a recurring Pricing Rule (customer-wide policy)
     or a One-Time discount/premium (this transaction only). */
  kind?: string; kindColor?: string; kindBg?: string; kindBorder?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `3px 14px 3px ${indent ? 26 : 14}px`,
      gap: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: 12,
            fontWeight: bold ? 600 : 400,
            color: indent ? '#4B5563' : '#374151',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {label}
          </span>
          {kind && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: kindColor ?? '#6B7280',
              backgroundColor: kindBg ?? '#F3F4F6',
              border: `1px solid ${kindBorder ?? '#E5E7EB'}`,
              padding: '1px 5px', borderRadius: 3, lineHeight: 1,
              letterSpacing: 0.2, textTransform: 'uppercase',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {kind}
            </span>
          )}
        </div>
        {sub && (
          <span style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.3, marginTop: 1 }}>{sub}</span>
        )}
      </div>
      <span style={{
        fontSize: 12,
        fontWeight: bold ? 600 : 500,
        color: valueColor ?? '#1F2937',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.4,
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  /* 4px vertical margin matches Partner InventoryTooltip's section
     divider exactly. */
  return <div style={{ height: 1, backgroundColor: '#F3F4F6', margin: '4px 14px' }} />;
}
