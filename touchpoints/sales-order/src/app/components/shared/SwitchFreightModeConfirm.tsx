import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════
   Switch-freight-mode confirmation — Partner-faithful pattern shared
   between the freight breakdown modal (mode toggle) and the line item
   configurator (first per-line override from an order-level state).

   Both entry points convert data:
   • to-per-line splits the order-level charge evenly across lines.
   • to-default replaces the per-line entries with a single charge.

   The confirmation explains the conversion so the user knows what
   will happen. Copy uses no em-dashes — sentence breaks only.
   ════════════════════════════════════════════════════════════════════ */

export type SwitchTarget = 'per-line' | 'default';

export interface SwitchFreightModeConfirmProps {
  /** Direction of the switch. `per-line` = order-level → per-line. */
  target: SwitchTarget;
  /** The order-level total being split (when going to per-line). */
  defaultCost: number;
  /** The sum of current per-line charges (when collapsing to default). */
  perLineSum: number;
  /** Total line item count for the conversion math. */
  lineCount: number;
  /** Even-split base value used in the body copy preview. */
  previewBase: number;
  /** How many lines will land on a non-base value because of cent
   *  rounding remainder. Used to phrase the cents disclaimer. */
  previewRemainderCount: number;
  /** Optional label of the line that triggered the switch (used when
   *  the entry point is the configurator Override button). */
  triggeringLineLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);

export function SwitchFreightModeConfirm({
  target,
  defaultCost,
  perLineSum,
  lineCount,
  previewBase,
  previewRemainderCount,
  triggeringLineLabel,
  onCancel,
  onConfirm,
}: SwitchFreightModeConfirmProps) {
  const isToPerLine = target === 'per-line';
  const total = isToPerLine ? defaultCost : perLineSum;
  const title = isToPerLine
    ? 'Split freight across line items?'
    : 'Replace per-line freight with an order-level charge?';
  const body = isToPerLine
    ? `${triggeringLineLabel ? `Setting a per-line freight cost on "${triggeringLineLabel}" switches this order to per-line freight. ` : ''}The current order-level charge of ${fmt(total)} will be split across ${lineCount} line item${lineCount === 1 ? '' : 's'}, about ${fmt(previewBase)} each${previewRemainderCount > 0 ? ` (a few lines may differ by one cent so the total stays ${fmt(total)})` : ''}. You can edit any line individually after.`
    : `Per-line charges totaling ${fmt(total)} will be replaced with a single order-level charge of ${fmt(total)}. Per-line values will be cleared. You can edit the order-level charge after.`;
  const primary = isToPerLine ? 'Split and switch to per-line' : 'Replace and switch to order-level';
  const cancel = isToPerLine ? 'Keep order-level' : 'Keep per-line';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.40)',
        backdropFilter: 'blur(2px)',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '100%',
          background: '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div
          className="relative flex flex-col items-center pt-9 pb-5"
          style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, rgba(255,255,255,0.30) 70%, transparent 100%)' }}
        >
          <div
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: 999, filter: 'blur(50px)', opacity: 0.25, backgroundColor: '#0A77FF' }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}
          >
            <ArrowRightLeft className="w-8 h-8" />
          </div>
          <span
            className="mt-3 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {isToPerLine ? 'Switching to per-line' : 'Switching to order-level'}
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-7 pb-7">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: '#0F172A' }}>
            {title}
          </h3>
          <p className="text-[13px] mt-2 max-w-[400px]" style={{ color: '#64748B', lineHeight: 1.65 }}>
            {body}
          </p>

          <div className="w-full mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl cursor-pointer transition-colors hover:opacity-90 flex items-center justify-center gap-2"
              style={{ fontWeight: 600, backgroundColor: '#0A77FF', color: '#FFFFFF', border: 'none' }}
            >
              {primary}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-11 text-[14px] rounded-xl cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: '#F1F5F9', color: '#334155', border: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            >
              {cancel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function splitEvenly(totalDollars: number, count: number): number[] {
  if (count <= 0) return [];
  const totalCents = Math.round(totalDollars * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}
