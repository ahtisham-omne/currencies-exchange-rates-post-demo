import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Consistent section card used across all detail-page tabs.
 *
 * Renders a bordered card with:
 *  - A header row: icon + title + summary stats + optional action button
 *  - Collapsible content area
 *
 * Matches the "box per section" pattern from the design reference.
 */

interface SectionCardProps {
  /** Lucide icon component rendered in a tinted box */
  icon?: React.ReactNode;
  /** Bold section title */
  title: string;
  /** Subtle stat chips shown beside the title, e.g. "3 items" */
  subtitle?: React.ReactNode;
  /** Right-aligned action area (buttons, links) */
  actions?: React.ReactNode;
  /** Whether the section can be collapsed */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state (overrides internal) */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onToggle?: () => void;
  /** Content */
  children: React.ReactNode;
  /** If true, remove internal padding on the content area (e.g. for tables) */
  noPadding?: boolean;
  /** Optional extra style on the outer wrapper */
  style?: React.CSSProperties;
}

export function SectionCard({
  icon,
  title,
  subtitle,
  actions,
  collapsible = false,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggle,
  children,
  noPadding = false,
  style,
}: SectionCardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalCollapsed(v => !v);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        ...style,
      }}
    >
      {/* Header */}
      <div
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onClick={collapsible ? handleToggle : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleToggle(); } : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
          borderBottom: isCollapsed ? 'none' : '1px solid #E5E7EB',
          transition: 'background-color 120ms',
          backgroundColor: '#FFFFFF',
        }}
        onMouseEnter={collapsible ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FAFBFC'; } : undefined}
        onMouseLeave={collapsible ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FFFFFF'; } : undefined}
      >
        {/* Collapse chevron */}
        {collapsible && (
          <ChevronDown
            style={{
              width: '14px',
              height: '14px',
              color: '#9CA3AF',
              flexShrink: 0,
              transition: 'transform 150ms',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          />
        )}

        {/* Icon */}
        {icon && (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              backgroundColor: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}

        {/* Title + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#1F2937',
              lineHeight: '1.2',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1', whiteSpace: 'nowrap' }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div style={noPadding ? undefined : { padding: '16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
