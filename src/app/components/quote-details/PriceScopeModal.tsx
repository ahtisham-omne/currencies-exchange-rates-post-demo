// PriceScopeModal — canonical "where does this price change apply?" prompt.
// Same modal the configurator shows when the user edits unit price; reused
// by the line-items table so the question is asked consistently regardless
// of which surface the edit happens on.

import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';

export type PriceScope = 'quote' | 'master';

interface PriceScopeModalProps {
  newPrice: number;
  onApply: (scope: PriceScope) => void;
  onCancel: () => void;
}

export function PriceScopeModal({ newPrice, onApply, onCancel }: PriceScopeModalProps) {
  const [choice, setChoice] = useState<PriceScope>('quote');

  useEffect(() => {
    // Delay listener registration by a frame so the same Enter keypress
    // that opened this modal (from the input's commit handler) cannot
    // immediately trigger Apply on the modal.
    let cancelled = false;
    let handler: ((e: KeyboardEvent) => void) | null = null;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onApply(choice);
        }
      };
      window.addEventListener('keydown', handler);
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      if (handler) window.removeEventListener('keydown', handler);
    };
  }, [choice, onApply, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{
          borderRadius: 16, width: 480, maxWidth: '100%',
          overflow: 'hidden',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
          backgroundColor: '#FFFFFF',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center"
          style={{
            paddingTop: 40, paddingBottom: 24,
            background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.25, backgroundColor: '#F59E0B' }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FEF3C7' }}
          >
            <DollarSign style={{ width: 32, height: 32, color: '#B45309' }} />
          </div>
          <span
            style={{
              marginTop: 16, padding: '4px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, lineHeight: 1,
              backgroundColor: '#FFFBEB', color: '#92400E',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            Price change
          </span>
        </div>

        <div className="flex flex-col items-center text-center" style={{ padding: '0 28px 28px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', margin: 0 }}>
            Apply price change
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-foreground)', margin: '8px 0 0 0', maxWidth: 360 }}>
            You're changing the unit price to{' '}
            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newPrice)}
            </span>
            . Choose where this price should apply.
          </p>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, textAlign: 'left' }}>
            <RadioCard
              selected={choice === 'quote'}
              onClick={() => setChoice('quote')}
              title="This quote only"
              description="Override the price for this line item. The item master stays unchanged."
            />
            <RadioCard
              selected={choice === 'master'}
              onClick={() => setChoice('master')}
              title="Update item master"
              description="Set as the new default price for all future quotes."
              badge="GLOBAL"
            />
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <button
              onClick={() => onApply(choice)}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 600,
                backgroundColor: '#0A77FF', color: '#FFFFFF',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                transition: 'background-color 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0A77FF'; }}
            >
              Apply change
            </button>
            <button
              onClick={onCancel}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 500,
                backgroundColor: 'var(--muted)', color: '#334155',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                transition: 'opacity 120ms',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RadioCard({ selected, onClick, title, description, badge }: {
  selected: boolean; onClick: () => void; title: string; description: string; badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        width: '100%', padding: '12px 14px', textAlign: 'left',
        backgroundColor: selected ? '#FFFBEB' : '#FFFFFF',
        border: `1px solid ${selected ? '#F59E0B' : 'var(--border)'}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 120ms',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: selected ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 18, height: 18, marginTop: 2,
          borderRadius: '50%',
          border: `2px solid ${selected ? '#0A77FF' : '#94A3B8'}`,
          backgroundColor: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 120ms',
        }}
      >
        {selected && (
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#0A77FF' }} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
            }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 3, lineHeight: 1.45 }}>{description}</div>
      </div>
    </button>
  );
}
