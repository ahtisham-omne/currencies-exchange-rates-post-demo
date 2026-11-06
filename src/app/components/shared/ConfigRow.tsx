import React from 'react';
import { Pencil } from 'lucide-react';

/* One configuration row: label on the left, the value on the right, and a
   pencil. Payment terms, Payment method and Sales Representative all render
   through this so the three rows share their spacing, hover area and
   affordance in both modules. */
export function ConfigRow({
  label,
  value,
  leading,
  children,
  pencil = true,
  onClick,
  emptyLabel,
}: {
  label: string;
  /** Plain value. Ignored when `children` is given. */
  value?: string;
  /** Icon or avatar shown before the value. */
  leading?: React.ReactNode;
  /** Custom right side, e.g. a picker that renders its own trigger. */
  children?: React.ReactNode;
  /** Set false when `children` already renders the pencil. */
  pencil?: boolean;
  onClick?: () => void;
  /** Shown in muted text when `value` is empty, e.g. FIELD_RULES
   *  .paymentTerms.emptyLabel. The pencil stays so the user can set it. */
  emptyLabel?: string;
}) {
  const isEmpty = !children && (!value || !value.trim()) && !!emptyLabel;
  return (
    <div
      className="group transition-all"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 10px',
        minHeight: 36,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background-color 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-hover-bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
    >
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {children ?? (
          <>
            {!isEmpty && leading}
            <span style={{ fontSize: 13, fontWeight: isEmpty ? 400 : 600, color: isEmpty ? 'var(--muted-foreground)' : 'var(--foreground)', whiteSpace: 'nowrap' }}>
              {isEmpty ? emptyLabel : value}
            </span>
          </>
        )}
        {pencil && (
          <Pencil className="text-slate-300 group-hover:text-primary transition-colors" style={{ width: 14, height: 14, flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
}
