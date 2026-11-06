import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

type PriorityLevel = 'low' | 'standard' | 'high';

interface PriorityDropdownProps {
  priority: PriorityLevel;
  onPriorityChange: (p: PriorityLevel) => void;
  readOnly?: boolean;
}

/* Priority palette mirrors SO `priorityConfig` so both modules carry
   the same outlined-pill chrome (rounded-full, hairline border tinted
   by the accent, no flag icon — matching Partner StatusPill). */
const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; bg: string; color: string; border: string }> = {
  low:      { label: 'Low',      bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  standard: { label: 'Standard', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  high:     { label: 'High',     bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
};

export function PriorityDropdown({ priority, onPriorityChange, readOnly = false }: PriorityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  // Position the portal panel below the trigger
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 4, left: rect.left });
  }, [isOpen]);

  // Close on outside click + escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const cfg = PRIORITY_CONFIG[priority];

  return (
    <>
      <div style={{ position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <button
          ref={triggerRef}
          onClick={readOnly ? undefined : () => setIsOpen(!isOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            height: 24, paddingLeft: 10, paddingRight: 8,
            borderRadius: 9999,
            border: `1px solid ${cfg.border}`,
            backgroundColor: cfg.bg,
            cursor: readOnly ? 'default' : 'pointer',
            transition: 'all 150ms',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
          {!readOnly && (
            <ChevronDown
              style={{
                width: 12, height: 12, color: cfg.color, opacity: 0.7,
                transition: 'transform 150ms',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          )}
        </button>
      </div>

      {/* Portal panel — escapes parent overflow-hidden, white bg */}
      {isOpen && panelPos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 9999,
            overflow: 'hidden',
            minWidth: '160px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {(['low', 'standard', 'high'] as const).map((p, i) => {
            const pc = PRIORITY_CONFIG[p];
            const isSelected = priority === p;
            return (
              <button
                key={p}
                onClick={() => { onPriorityChange(p); setIsOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid var(--muted)' : 'none',
                  backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                  cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pc.color }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {pc.label}
                  </span>
                </div>
                {isSelected && <Check style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
