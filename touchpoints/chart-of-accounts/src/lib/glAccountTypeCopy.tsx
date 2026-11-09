import type { GLAccountType } from '../types'

// Canonical one-line description of each GL account type. Every surface that
// explains a type - form helper text, info-icon tooltips, education cards,
// detail-page sub-text, filter descriptions - reads from here.
export const GL_TYPE_DESCRIPTION: Record<GLAccountType, string> = {
  Posting: 'An account you post transactions to. Its balance is the total of everything recorded against it.',
  Summary: "An account that groups others and shows their combined total. You don't post to it.",
}

// Number order, which is the order they appear in a chart: a summary account
// carries the number its accounts sit beneath.
const LEGEND_ORDER: GLAccountType[] = ['Summary', 'Posting']

/* Legend rendered inside info-icon tooltips wherever the field is "GL account
   type" - the user sees both options compared at a glance rather than the
   selected value's description alone.

   Carries its own card chrome, matching RoleTooltip: a rich Tooltip supplies
   only the white card and shadow, so unpadded content sat flush against the
   border at the inherited body font size. Callers must pass `rich`. */
export function GLTypeLegend() {
  return (
    <div className="w-[290px] p-3.5">
      <div className="rounded-lg border border-border bg-bg-subtle/50 px-3 py-2.5 space-y-2">
        {LEGEND_ORDER.map(t => (
          <p key={t} className="text-11 text-fg-muted leading-relaxed">
            <span className="text-fg" style={{ fontWeight: 600 }}>{t}</span> - {GL_TYPE_DESCRIPTION[t]}
          </p>
        ))}
      </div>
    </div>
  )
}
