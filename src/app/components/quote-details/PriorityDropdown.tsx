import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Flag, Check } from 'lucide-react';

type PriorityLevel = 'low' | 'standard' | 'high';

interface PriorityDropdownProps {
  priority: PriorityLevel;
  onPriorityChange: (p: PriorityLevel) => void;
  readOnly?: boolean;
  darkBg?: boolean;
}

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; bg: string; color: string; border: string; iconColor: string }> = {
  low: { label: 'Low', bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', iconColor: '#9CA3AF' },
  standard: { label: 'Standard', bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE', iconColor: '#3B82F6' },
  high: { label: 'High', bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', iconColor: '#EF4444' },
};

export function PriorityDropdown({ priority, onPriorityChange, readOnly = false, darkBg = false }: PriorityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const cfg = PRIORITY_CONFIG[priority];

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <button
        onClick={readOnly ? undefined : () => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          height: '28px', padding: '0 10px 0 8px',
          borderRadius: '6px',
          border: darkBg ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${isOpen ? '#D1D5DB' : cfg.border}`,
          backgroundColor: darkBg ? 'rgba(255,255,255,0.1)' : isOpen ? '#F9FAFB' : cfg.bg,
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 150ms',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onMouseEnter={(e) => {
          if (!readOnly && !isOpen) {
            e.currentTarget.style.borderColor = darkBg ? 'rgba(255,255,255,0.35)' : '#D1D5DB';
            if (darkBg) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)';
          }
        }}
        onMouseLeave={(e) => {
          if (!readOnly && !isOpen) {
            e.currentTarget.style.borderColor = darkBg ? 'rgba(255,255,255,0.2)' : cfg.border;
            if (darkBg) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
          }
        }}
      >
        <Flag style={{ width: '11px', height: '11px', color: darkBg ? '#FFFFFF' : cfg.iconColor, flexShrink: 0 }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: darkBg ? '#FFFFFF' : cfg.color, lineHeight: '1', whiteSpace: 'nowrap' }}>
          {cfg.label}
        </span>
        {!readOnly && (
          <ChevronDown
            style={{
              width: '11px', height: '11px', color: darkBg ? 'rgba(255,255,255,0.7)' : cfg.color, opacity: darkBg ? 1 : 0.5,
              transition: 'transform 150ms',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              marginLeft: '1px',
            }}
          />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 50, overflow: 'hidden', minWidth: '140px',
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
                  borderTop: i > 0 ? '1px solid #F3F4F6' : 'none',
                  backgroundColor: isSelected ? '#F9FAFB' : 'transparent',
                  cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flag style={{ width: '12px', height: '12px', color: pc.iconColor }} />
                  <span style={{
                    fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                    backgroundColor: pc.bg, color: pc.color,
                    border: `1px solid ${pc.border}`,
                    lineHeight: '1.4',
                  }}>
                    {pc.label}
                  </span>
                </div>
                {isSelected && <Check style={{ width: '14px', height: '14px', color: '#3B82F6' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}