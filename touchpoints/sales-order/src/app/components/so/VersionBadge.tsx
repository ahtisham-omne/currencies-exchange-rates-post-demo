import { ArrowUpRight } from 'lucide-react';

interface VersionBadgeProps {
  version: number;
  onClick?: (e: React.MouseEvent) => void;
  showExpandIcon?: boolean;
  compact?: boolean;
  hasAttention?: boolean;
}

const versionStyles: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  2: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  3: { bg: '#EFF6FF', text: '#2563EB', border: '#93C5FD' },
  4: { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  5: { bg: '#DBEAFE', text: '#1D4ED8', border: '#60A5FA' },
};

function getStyle(v: number) {
  return versionStyles[Math.min(v, 5)] || versionStyles[5];
}

export function VersionBadge({ version, onClick, showExpandIcon = false, compact = false, hasAttention }: VersionBadgeProps) {
  const style = getStyle(version);
  // Communication feature not yet built — hide attention dots for now
  const showAttention = false;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: '2px', position: 'relative',
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: '5px', border: `1px solid ${style.border}`,
        backgroundColor: style.bg, color: style.text,
        fontSize: compact ? '10px' : '11px', fontWeight: 600,
        cursor: 'pointer', lineHeight: '1.4',
        transition: 'all 150ms',
        minWidth: compact ? 'auto' : '36px',
      }}
    >
      v{version}
      {showExpandIcon && (
        <ArrowUpRight style={{
          width: '9px', height: '9px', color: style.text, opacity: 0.7,
        }} />
      )}
      {/* Red attention dot superscript */}
      {showAttention && (
        <div style={{
          position: 'absolute', top: '-3px', right: '-3px',
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: '#EF4444', border: '1.5px solid #FFFFFF',
        }} />
      )}
    </button>
  );
}
