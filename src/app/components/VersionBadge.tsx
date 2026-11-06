import { ArrowUpRight } from 'lucide-react';

interface VersionBadgeProps {
  version: number;
  onClick?: (e: React.MouseEvent) => void;
  showExpandIcon?: boolean;
  compact?: boolean;
  hasAttention?: boolean;
}

const versionStyles: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: '#F0F7FF', text: '#2563EB', border: '#DBEAFE' },
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
  const showAttention = false;

  // Symmetric horizontal padding so "v2" stays truly centered.
  // Arrow is absolutely positioned and overlaps the right padding zone — text never shifts.
  const horizontalPad = showExpandIcon
    ? (compact ? 12 : 14)
    : (compact ? 6 : 8);

  return (
    <button
      onClick={onClick}
      className="group/vbadge"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        paddingTop: compact ? 1 : 2,
        paddingBottom: compact ? 1 : 2,
        paddingLeft: horizontalPad,
        paddingRight: horizontalPad,
        borderRadius: '6px', border: `1px solid ${style.border}`,
        backgroundColor: style.bg, color: style.text,
        fontSize: compact ? '10px' : '11px', fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default', lineHeight: '1.4',
        transition: 'all 150ms',
        minWidth: showExpandIcon ? (compact ? 40 : 46) : (compact ? 'auto' : '36px'),
      }}
    >
      V{version}
      {showExpandIcon && (
        <ArrowUpRight
          className="absolute opacity-0 group-hover/vbadge:opacity-70 transition-opacity duration-150"
          style={{
            width: '9px', height: '9px', color: style.text,
            right: compact ? 3 : 5, top: '50%', transform: 'translateY(-50%)',
          }}
        />
      )}
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
