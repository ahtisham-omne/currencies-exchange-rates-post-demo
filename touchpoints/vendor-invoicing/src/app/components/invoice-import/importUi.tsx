/* Shared visual vocabulary for the import flow: severity tones, tiny
 * formatters, and the section card the steps compose from. Everything
 * here mirrors the module's existing recipes (status pill tones from
 * the listing, section chrome from the flow modals). */

import type { ReactNode } from 'react';
import type { Severity } from './importEngine';

export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string | undefined): string => {
  if (!iso) return '';
  // Date-only strings parse at LOCAL midnight (GPT QC03, 9/30: the
  // review grid displayed Aug 31 sources as Aug 30 — `new Date('YYYY-MM-DD')`
  // is UTC midnight, a day earlier in US timezones). Committed values
  // were always right; only this display path shifted.
  const t = iso.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00`) : new Date(t);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export const fmtPeriod = (period: string): string => {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/* Severity tones follow the module's status semantics: red blocks,
 * orange awaits action, neutral informs, emerald is ready. */
export const SEVERITY_META: Record<Severity | 'ready', { label: string; bg: string; fg: string; border: string; dotless: true }> = {
  ready: { label: 'Ready', bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0', dotless: true },
  blocker: { label: 'Blocker', bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA', dotless: true },
  exception: { label: 'Exception', bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', dotless: true },
  warning: { label: 'Warning', bg: '#F8FAFC', fg: '#475569', border: '#E2E8F0', dotless: true },
};

export function SeverityPill({ severity }: { severity: Severity | 'ready' }) {
  const m = SEVERITY_META[severity];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-px text-[11px]"
      style={{ backgroundColor: m.bg, color: m.fg, borderColor: m.border, fontWeight: 600 }}
    >
      {m.label}
    </span>
  );
}

/** Small labelled field wrapper: red asterisk is the only mandatory signal. */
export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[12px] text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {children}
      {hint && (
        <p className="text-[11px] text-slate-400 mt-1" style={{ fontWeight: 400 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
