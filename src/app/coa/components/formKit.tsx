// Ported from chart-of-accounts-v2.1/src/pages/CreateAccount.tsx (SectionCard 3853-3866, LockedField 275-300, the Review changes table 2328-2377); adapted: exported as kit snippets for FormModal bodies.
import type { ReactNode } from 'react'
import { Info, Lock } from 'lucide-react'
import { Tooltip } from './ui'

/** A form section: tinted header with a 16px primary icon, `p-4` body. Stack with `space-y-3.5`. */
export function SectionCard({ icon, title, badge, titleExtra, children }: { icon?: ReactNode; title: string; badge?: string; titleExtra?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-subtle/50">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {badge && <span className="text-2xs font-semibold text-slate-300">{badge}</span>}
        {titleExtra}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

/* A field that can no longer change: the `.input` look, greyed, with a padlock
   that carries the reason. The label keeps its own info tooltip. */
export function LockedField({ label, info, infoRich, why, children }: {
  label: string
  info?: ReactNode
  infoRich?: boolean
  why: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <label className="label flex items-center gap-1 mb-1.5">
        {label}
        {info && (
          <Tooltip rich={infoRich} content={info} side="top" align={infoRich ? 'left' : 'center'}>
            <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
          </Tooltip>
        )}
      </label>
      <div className="input flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none">
        {children}
        <Tooltip content={why} side="top" align="right">
          <span className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Lock size={13} /></span>
        </Tooltip>
      </div>
    </>
  )
}

/** "What saving will change": Field | Current (struck) | New (600). */
export function ReviewChangesTable({ rows }: { rows: { field: string; current: ReactNode; next: ReactNode }[] }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-bg-subtle/50">
            <th className="h-9 px-4 font-normal text-muted-foreground text-left w-[200px]">Field</th>
            <th className="h-9 px-4 font-normal text-muted-foreground text-left">Current</th>
            <th className="h-9 px-4 font-normal text-muted-foreground text-left">New</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.field} className="border-b border-border-subtle last:border-0">
              <td className="px-4 py-3 text-fg-muted">{r.field}</td>
              <td className="px-4 py-3 text-slate-400 line-through">{r.current}</td>
              <td className="px-4 py-3 text-fg" style={{ fontWeight: 600 }}>{r.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
