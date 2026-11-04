import { useState, useRef, useEffect } from 'react';
import { Columns3, Rows2, Rows4, LayoutGrid, ChevronDown, Check, Maximize2, Minimize2 } from 'lucide-react';

type ViewDensity = 'comfortable' | 'compact' | 'board';

interface TableControlsProps {
  totalCount: number;
  viewDensity: ViewDensity;
  onViewDensityChange: (density: ViewDensity) => void;
  onColumnConfig: () => void;
  visibleColumnCount?: number;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

const btnStyle: React.CSSProperties = {
  height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px',
  border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#FFFFFF',
  cursor: 'pointer', transition: 'all 150ms', fontSize: '13px', fontWeight: 500, color: '#475569',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export function TableControls({
  totalCount,
  viewDensity,
  onViewDensityChange,
  onColumnConfig,
  visibleColumnCount,
  isFullscreen = false,
  onFullscreenToggle,
}: TableControlsProps) {
  const [showDensityDropdown, setShowDensityDropdown] = useState(false);
  const densityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDensityDropdown) return;
    const handler = (e: MouseEvent) => {
      if (densityDropdownRef.current && !densityDropdownRef.current.contains(e.target as Node)) {
        setShowDensityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDensityDropdown]);

  const densityOptions: { value: ViewDensity; label: string; icon: typeof Rows4 }[] = [
    { value: 'compact', label: 'Condensed', icon: Rows4 },
    { value: 'comfortable', label: 'Comfort', icon: Rows2 },
    { value: 'board', label: 'Kanban View', icon: LayoutGrid },
  ];

  const currentDensity = densityOptions.find(o => o.value === viewDensity) || densityOptions[1];
  const CurrentDensityIcon = currentDensity.icon;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {totalCount} quotes
      </span>

      <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0' }} />

      {/* Columns */}
      <button onClick={onColumnConfig} style={btnStyle}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
      >
        <Columns3 style={{ width: '14px', height: '14px', color: '#64748B' }} />
        {visibleColumnCount != null && (
          <span style={{
            fontSize: '11px', fontWeight: 600, color: '#64748B',
            backgroundColor: '#F1F5F9', borderRadius: '10px',
            padding: '1px 6px', lineHeight: '1.5',
          }}>{visibleColumnCount}</span>
        )}
        Columns
      </button>

      {/* Density */}
      <div ref={densityDropdownRef} style={{ position: 'relative' }}>
        <button onClick={() => setShowDensityDropdown(!showDensityDropdown)} style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
        >
          <CurrentDensityIcon style={{ width: '14px', height: '14px', color: '#64748B' }} />
          {currentDensity.label}
          <ChevronDown style={{ width: '12px', height: '12px', color: '#94A3B8', transition: 'transform 150ms', transform: showDensityDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {showDensityDropdown && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '200px',
            backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 50, padding: '4px', overflow: 'hidden',
          }}>
            {densityOptions.map((option, idx) => {
              const isSelected = viewDensity === option.value;
              const OptionIcon = option.icon;
              const isLast = idx === densityOptions.length - 1;
              return (
                <div key={option.value}>
                  {isLast && <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />}
                  <button
                    onClick={() => { onViewDensityChange(option.value); setShowDensityDropdown(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%',
                      padding: '8px 10px', gap: '8px', cursor: 'pointer',
                      border: 'none', backgroundColor: 'transparent',
                      borderRadius: '6px', transition: 'background-color 100ms',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <OptionIcon style={{ width: '15px', height: '15px', color: isSelected ? '#2563EB' : '#64748B' }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A' }}>{option.label}</div>
                    </div>
                    {isSelected && <Check style={{ width: '14px', height: '14px', color: '#2563EB' }} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      {onFullscreenToggle && (
        <button onClick={onFullscreenToggle} style={{ ...btnStyle, padding: '0 8px' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {isFullscreen ? <Minimize2 style={{ width: '15px', height: '15px', color: '#64748B' }} /> : <Maximize2 style={{ width: '15px', height: '15px', color: '#64748B' }} />}
        </button>
      )}
    </div>
  );
}
