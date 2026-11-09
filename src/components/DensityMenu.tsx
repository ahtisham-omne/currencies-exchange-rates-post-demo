/* ─────────────────────────────────────────────────────────────────────────────
   DensityMenu.tsx - the left half of the toolbar pair (spec §1 and §2).

   Condensed and Comfort, and under them whatever further ways of DRAWING the
   same rows the table can offer: Tree layout where rows nest, Column widths
   where the columns can be sized. They ride under density rather than opening a
   control of their own, because they are the same kind of decision. A table
   that offers neither gets the plain 230px menu back.
   ───────────────────────────────────────────────────────────────────────────── */
import { AlignJustify, List, ChevronDown, Check } from 'lucide-react'
import { Menu } from './ui'
import { TOOL_BTN, TOOL_BTN_ACTIVE, type Density, type LookSection } from './tableLook'

const DENSITIES: { key: Density; label: string; description: string; Icon: typeof AlignJustify }[] = [
  { key: 'condensed', label: 'Condensed', description: 'Compact table view', Icon: AlignJustify },
  { key: 'comfort', label: 'Comfort', description: 'Spacious table view', Icon: List },
]

export function DensityMenu({ value, onChange, sections }: {
  value: Density
  onChange: (d: Density) => void
  /** Tree layout and Column widths, from `lookSections()`. A table passes only
   *  the blocks it can honestly offer. */
  sections?: LookSection[]
}) {
  const current = DENSITIES.find(d => d.key === value) ?? DENSITIES[0]
  const TriggerIcon = current.Icon
  return (
    <Menu
      align="right"
      flush
      trigger={open => (
        <button
          type="button"
          className="fr-tool-btn"
          data-active={open}
          aria-expanded={open}
          style={{ ...TOOL_BTN, ...(open ? TOOL_BTN_ACTIVE : null), justifyContent: 'center' }}
        >
          <TriggerIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span className="hidden md:inline">{current.label}</span>
          <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.6 }} />
        </button>
      )}
    >
      {close => (
        /* 316 once anything hangs under the densities: three cards need the room
           to hold a 52px picture and a one-word label. 230 with none, which is
           the menu this module already had. */
        <div style={{ width: sections?.length ? 316 : 230, padding: 6 }}>
          {DENSITIES.map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => { onChange(o.key); close() }}
              className="w-full flex items-center text-left rounded-md hover:bg-bg-subtle transition-colors"
              style={{ gap: 12, padding: '10px 12px' }}
            >
              <o.Icon style={{ width: 20, height: 20, flexShrink: 0, color: 'hsl(var(--muted-foreground))' }} />
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontSize: 13, lineHeight: 1.43, fontWeight: 500, color: 'hsl(var(--foreground))' }}>{o.label}</span>
                <span className="block" style={{ fontSize: 12, lineHeight: '16px', color: 'hsl(var(--muted-foreground))' }}>{o.description}</span>
              </span>
              {value === o.key && <Check style={{ width: 16, height: 16, flexShrink: 0, color: 'hsl(var(--primary))' }} />}
            </button>
          ))}

          {sections?.map(sec => (
            <div key={sec.title}>
              {/* Space alone separates the sections: the captions already mark
                  where one ends and the next begins, and a rule between them
                  read as a divider between two menus. */}
              <p style={{ padding: '12px 12px 4px', fontSize: 10, fontWeight: 600, lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.025em', color: 'var(--color-slate-400)' }}>
                {sec.title}
              </p>
              {/* One column per option, so two cards are wide and three are
                  narrow - the pictures fill whatever room the section has. */}
              <div className="grid" style={{ padding: '0 12px 8px', gap: 6, gridTemplateColumns: `repeat(${sec.options.length}, minmax(0, 1fr))` }}>
                {sec.options.map(opt => {
                  const on = sec.value === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => sec.onChange(opt.key)}
                      aria-pressed={on}
                      className="flex flex-col items-center cursor-pointer outline-none"
                      style={{
                        gap: 4, padding: '4px 4px 6px', borderRadius: 8,
                        border: `1px solid ${on ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                        background: on ? 'var(--primary-50)' : 'hsl(var(--card))',
                        transition: 'border-color .15s ease, background .15s ease',
                      }}
                      onMouseEnter={e => { if (!on) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--surface-secondary)' } }}
                      onMouseLeave={e => { if (!on) { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.background = 'hsl(var(--card))' } }}
                    >
                      {opt.thumb}
                      <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: on ? 600 : 500, color: on ? 'hsl(var(--primary))' : 'var(--text-secondary)' }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Menu>
  )
}
