import { useMemo, useState } from 'react'
import { Plus, Trash2, Check, AlertTriangle } from 'lucide-react'
import { Card, Button, Input } from './ui'
import { NumberingScheme, SegmentDef, Account } from '../types'
import { cn } from '../lib/utils'

// =====================================================================
// Shared numbering-scheme editor (NUMBERING_SCHEME_FLOW.md).
// Style → Parts → Review, used by both the standalone Numbering settings page
// and the Build-from-Scratch wizard step. The parent owns the scheme state; every
// edit calls onChange with the next scheme. The three parts are stacked as titled
// sections (no inner stepper).
//
// This editor used to have a fourth part, Reserved ranges, which set a number
// range per classification, warned when an existing account fell outside its classification's
// new range, and drew the whole thing over a 0000-9999 band. It is gone. Nothing
// is reserved: a customer numbers their chart however they like, an account is
// filed by the category and section stated on it, and a number outside some band
// is not a thing that can be wrong.
// =====================================================================

// Small numbered heading for each stacked section.
function SectionHead({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-accent text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">{n}</span>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-fg-muted mt-1 ml-7">{subtitle}</p>}
    </div>
  )
}

// Starting-point templates. 5-digit flat is the default - the width Omne numbers
// the charts it builds at, and the demo chart, since 2026-09-24's design review.
const TEMPLATES: { id: string; label: string; sample: string; blurb: string; segments: SegmentDef[] | null }[] = [
  { id: 'flat', label: '5-digit flat', sample: '11110', blurb: 'Recommended for most businesses', segments: [{ index: 0, length: 5, meaning: 'Account', separator: '' }] },
  { id: 'segmented', label: 'Holds dimensions (3-5-2)', sample: '100-11110-00', blurb: 'Recommended for multi-division organizations', segments: [
    { index: 0, length: 3, meaning: 'Division', separator: '-' },
    { index: 1, length: 5, meaning: 'Account', separator: '-' },
    { index: 2, length: 2, meaning: 'Sub', separator: '' },
  ] },
  { id: 'custom', label: 'Custom', sample: 'Build your own', blurb: 'For complex hierarchies', segments: null },
]

// Which starting-point template a set of segments corresponds to. Compares
// length + separator shape (meaning labels are cosmetic), falling back to
// 'custom' when nothing matches.
function detectTemplate(segments: SegmentDef[]): string {
  const shape = (segs: SegmentDef[]) => segs.map((s, i) => `${s.length}${i < segs.length - 1 ? s.separator : ''}`).join('|')
  const target = shape(segments)
  const match = TEMPLATES.find(t => t.segments && shape(t.segments) === target)
  return match?.id ?? 'custom'
}

// Apply the segment pattern to a seed number, producing a formatted example.
function applyPattern(seed: string, segments: SegmentDef[]): string {
  const total = segments.reduce((s, x) => s + x.length, 0)
  const digits = seed.padEnd(total, '0').slice(0, total)
  let out = '', pos = 0
  segments.forEach((s, i) => {
    out += digits.slice(pos, pos + s.length)
    pos += s.length
    if (i < segments.length - 1) out += s.separator
  })
  return out
}

function matchesPattern(num: string, segments: SegmentDef[]): boolean {
  const pattern = segments.map((s, i) => `\\d{${s.length}}` + (i < segments.length - 1 ? s.separator : '')).join('')
  return new RegExp(`^${pattern}$`).test(num)
}

const EXAMPLES = [
  { name: 'Cash', seed: '11110' },
  { name: 'Accounts Payable', seed: '21110' },
  { name: 'Sales Revenue', seed: '41010' },
  { name: 'Rent Expense', seed: '52310' },
]

export function NumberingSchemeEditor({
  scheme,
  onChange,
  accounts,
}: {
  scheme: NumberingScheme
  onChange: (next: NumberingScheme) => void
  // When provided (settings page), the Parts stage counts existing accounts
  // that would no longer fit the pattern. The wizard omits this (no accounts yet).
  accounts?: Account[]
}) {
  // Seed the Style selection from the scheme already in effect, so reopening a
  // segmented (or custom) scheme highlights the matching card instead of "flat".
  const [template, setTemplate] = useState<string>(() => detectTemplate(scheme.segments))
  const { segments } = scheme
  const example = segments.map((s, i) => `${'X'.repeat(s.length)}${i < segments.length - 1 ? s.separator : ''}`).join('')

  const setSegments = (next: SegmentDef[]) => onChange({ ...scheme, segments: next })

  const pickTemplate = (id: string) => {
    setTemplate(id)
    const t = TEMPLATES.find(x => x.id === id)
    if (t?.segments) setSegments(t.segments.map((s, i) => ({ ...s, index: i })))
  }

  // ---- validation ----
  const totalLen = segments.reduce((s, x) => s + x.length, 0)
  const segTooLong = totalLen > 12
  // Existing master-chart numbers that no longer fit the segment pattern.
  const misfitCount = (accounts ?? []).filter(a => !matchesPattern(a.accountNumber, segments)).length

  return (
    <Card className="p-5 space-y-6">
      {/* ---- 1. Style ---- */}
      <section>
        <SectionHead n={1} title="Numbering style" subtitle="Select a starting point. You can fine-tune the parts below." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const active = template === t.id
            return (
              <button key={t.id} type="button" onClick={() => pickTemplate(t.id)}
                className={cn('text-left p-4 rounded-xl border transition-all', active ? 'border-primary bg-brand-50 shadow-sm' : 'border-border bg-white hover:bg-bg-subtle')}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-4 h-4 rounded-full border flex items-center justify-center shrink-0', active ? 'bg-primary border-primary' : 'border-border-strong')}>
                    {active && <Check size={11} className="text-white" />}
                  </span>
                  <span className="text-sm font-semibold text-fg">{t.label}</span>
                </div>
                <div className="text-sm text-fg mt-3">{t.sample}</div>
                <div className="text-2xs text-fg-subtle mt-2">{t.blurb}</div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ---- 2. Parts ---- */}
      <section>
        <SectionHead n={2} title="Parts" subtitle="Define how each part of the number is structured. Every part but the account number is a dimension." />
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-fg">Parts</h3>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />}
                onClick={() => setSegments([...segments, { index: segments.length, length: 2, meaning: 'New part', separator: '' }])}>Add part</Button>
            </div>
            <div className="p-4 space-y-2">
              {segments.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-white rounded-md border border-border">
                  <div className="col-span-1 text-xs font-semibold text-fg-subtle">#{i + 1}</div>
                  <div className="col-span-3"><Input label="Length" type="number" min={1} max={6} value={s.length} onChange={e => setSegments(segments.map((x, j) => j === i ? { ...x, length: Math.max(1, Math.min(6, +e.target.value || 1)) } : x))} /></div>
                  <div className="col-span-5"><Input label="Meaning" value={s.meaning} onChange={e => setSegments(segments.map((x, j) => j === i ? { ...x, meaning: e.target.value } : x))} /></div>
                  <div className="col-span-2"><Input label="Separator" maxLength={1} value={i === segments.length - 1 ? '' : s.separator} disabled={i === segments.length - 1} placeholder={i === segments.length - 1 ? '-' : '-'} onChange={e => setSegments(segments.map((x, j) => j === i ? { ...x, separator: e.target.value } : x))} /></div>
                  <div className="col-span-1 flex justify-end pb-0.5">
                    {segments.length > 1 && <button className="btn-icon text-danger-700" onClick={() => setSegments(segments.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold text-fg">Pattern preview</div>
            <div className="text-base text-fg mt-2">{example || '-'}</div>
            <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold mt-4 mb-1.5">Example numbers</div>
            <div className="space-y-1">
              {EXAMPLES.map(ex => (
                <div key={ex.name} className="flex items-center justify-between text-sm">
                  <span className="text-fg-muted">{ex.name}</span>
                  <span className="text-fg">{applyPattern(ex.seed, segments)}</span>
                </div>
              ))}
            </div>
          </Card>

          {segTooLong && (
            <div className="text-xs text-danger-700 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-px shrink-0" /> Total length across parts is {totalLen}; keep it at 12 or fewer to stay readable.</div>
          )}
          {misfitCount > 0 && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              <span>Your current accounts won't fit this pattern. Switching to this pattern would renumber {misfitCount} existing account{misfitCount === 1 ? '' : 's'}.</span>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ---- 3. Review ---- */}
      <section>
        <SectionHead n={3} title="Review" subtitle="Confirm your numbering configuration before continuing." />
        <Card className="p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-fg-muted">Style</dt><dd className="text-fg">{TEMPLATES.find(t => t.id === template)?.label ?? 'Custom'}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-muted">Pattern</dt><dd className="text-fg">{example} (e.g. {applyPattern('11110', segments)})</dd></div>
            </dl>
            <p className="text-xs text-fg-muted mt-4">A new account is suggested the next number up from the highest its category already uses. The suggestion is editable, and no number is reserved.</p>
        </Card>
      </section>
    </Card>
  )
}
