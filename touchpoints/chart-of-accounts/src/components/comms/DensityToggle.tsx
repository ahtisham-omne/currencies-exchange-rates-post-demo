/* Ported from the reporting module's comms cluster (its DensityToggle.tsx).

   The Comfort / Condensed control: an icon, the current label and a chevron,
   opening a two-row menu that says what each density does and checks the one in
   force.

   The trigger's colours are the source's own primitives, which resolve because
   the trigger sits inside the tab's `data-comms` root. The panel does not: this
   module's `Menu` portals it to <body>, outside that element, so the rows use
   the module's own utilities. The source's rows named shadcn's semantic tokens
   rather than primitives anyway, so nothing is re-tinted here. */
import { AlignJustify, List, ChevronDown, Check } from 'lucide-react'
import { Menu } from '../ui'
import { cn } from '../../lib/utils'
import type { Density } from '../../lib/comms'

export type { Density }

export function DensityToggle({ density, onChange }: { density: Density; onChange: (d: Density) => void }) {
  const isComfort = density === 'comfort'
  const options: { key: Density; label: string; desc: string; Icon: typeof AlignJustify }[] = [
    { key: 'condensed', label: 'Condensed', desc: 'Compact view', Icon: AlignJustify },
    { key: 'comfort', label: 'Comfort', desc: 'Spacious view', Icon: List },
  ]
  return (
    <Menu
      align="right"
      flush
      trigger={
        /* No stopPropagation here: Menu opens from a click on the span it
           wraps this in, and stopping the click on the way up kept the menu
           shut, so density could never be changed. */
        <span
          className="inline-flex items-center justify-center h-8 gap-1.5 px-2.5 rounded-md border border-[var(--color-slate-200)] bg-white shadow-sm hover:bg-[var(--color-slate-100)] transition-colors cursor-pointer outline-none shrink-0"
          title={`View: ${isComfort ? 'Comfort' : 'Condensed'}`}
          aria-label={`View density: ${isComfort ? 'Comfort' : 'Condensed'}`}
        >
          {isComfort
            ? <List className="w-3.5 h-3.5 text-[var(--color-slate-500)]" />
            : <AlignJustify className="w-3.5 h-3.5 text-[var(--color-slate-500)]" />}
          <span className="text-[12px] hidden md:inline text-[var(--color-slate-700)]" style={{ fontWeight: 500 }}>
            {isComfort ? 'Comfort' : 'Condensed'}
          </span>
          <ChevronDown className="w-3 h-3 text-[var(--color-slate-400)]" />
        </span>
      }
    >
      {close => (
        <div className="w-[200px] p-1.5">
          {options.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); close() }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-left hover:bg-muted/50',
                density === opt.key && 'bg-muted/50',
              )}
            >
              <opt.Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm" style={{ fontWeight: 500 }}>{opt.label}</span>
                <span className="block text-[10px] text-muted-foreground/60">{opt.desc}</span>
              </span>
              {density === opt.key && <Check className="w-3.5 h-3.5 ml-auto text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  )
}
