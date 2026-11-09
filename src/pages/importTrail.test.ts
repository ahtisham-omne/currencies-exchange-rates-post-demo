import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { IMPORT_STEPS, importTrail } from './ImportAccounts'

/* The trail is a promise made before the work starts: this is how long the
   import is. Two of its five steps are only reached by one answer to the gate,
   so what is guarded here is that the promise survives either answer - the count
   never changes underneath the reader, and a step nobody has passed yet is never
   struck through. */

describe('what the import promises', () => {
  it('counts the steps that follow the file, and does not count the file', () => {
    // The second step asks what each segment is (Mahad, 2026-10-02).
    expect(IMPORT_STEPS).toEqual(['Structure', 'Segments', 'Values', 'Review', 'Preview'])
    expect(IMPORT_STEPS).not.toContain('Upload')
  })

  it('keeps every label in the house voice', () => {
    for (const label of IMPORT_STEPS) {
      expect(label, label).not.toContain('—')
      expect(label.endsWith('.'), label).toBe(false)
      // Sentence case: only the first word is capitalised.
      expect(label.slice(1), label).toBe(label.slice(1).replace(/[A-Z]/g, m => m.toLowerCase()))
    }
  })
})

describe('where the reader is in it', () => {
  it('puts each step of the flow at its own place in the trail', () => {
    expect(importTrail('split', false, false).index).toBe(0)
    expect(importTrail('dimensions', true, false).index).toBe(1)
    expect(importTrail('labels', true, true).index).toBe(2)
    expect(importTrail('review', true, true).index).toBe(3)
    expect(importTrail('preview', true, true).index).toBe(4)
  })

  /* The import runs in front of the grid and finishes in front of it, so the
     trail stays on Review for both. It only moves to Preview when the reader
     goes and looks, which is the one step of the five nobody has to walk. */
  it('holds the review grid at its own step through the import and after it', () => {
    expect(importTrail('importing', true, true).index).toBe(3)
    expect(importTrail('done', true, true).index).toBe(3)
  })

  /* Holding Review is no use if the trail is not on screen to hold it. The grid
     stays behind the spinner while the write runs, and behind the summary once
     it has finished, so taking the trail away either time reflows the header
     under something the reader is still looking at and reads as a different
     screen. It goes inert instead - which is the missing handler, since that is
     what disables the tabs. */
  it('keeps the trail on screen, and inert, through the write and after it', () => {
    const src = readFileSync(join(__dirname, 'ImportAccounts.tsx'), 'utf8')
    const showTrail = src.slice(src.indexOf('const showTrail ='))
    const line = showTrail.slice(0, showTrail.indexOf('\n'))
    expect(line).not.toContain("!== 'importing'")
    expect(line).not.toContain("!== 'done'")
    expect(src).toContain("onJump={step === 'importing' || step === 'done' ? undefined : i => {")

    const chrome = readFileSync(join(__dirname, '../components/WizardChrome.tsx'), 'utf8')
    expect(chrome).toContain('const reachable = !!onJump')
    expect(chrome).toContain('disabled={!reachable}')
  })
})

describe('the steps an answer retires', () => {
  it('strikes nothing through while the gate is still the question', () => {
    // holdsDimensions is false before the gate is answered as well as after a
    // no, so standing on the gate must not read as having said no to it.
    expect(importTrail('split', false, false).skipped).toEqual([])
  })

  it('retires both dimension steps once the numbers are called one number', () => {
    expect(importTrail('review', false, false).skipped).toEqual([1, 2])
  })

  it('retires labelling when nothing in the number was called a filter', () => {
    expect(importTrail('review', true, false).skipped).toEqual([2])
  })

  it('retires nothing when every step was walked', () => {
    expect(importTrail('review', true, true).skipped).toEqual([])
  })

  it('does not retire labelling before the dimensions are answered', () => {
    // Nothing is a filter yet on the dimensions step either, and striking the
    // next step through there would be reading an unanswered form as an answer.
    expect(importTrail('dimensions', true, false).skipped).toEqual([])
  })

  it('never retires the gate, the grid or the preview', () => {
    for (const holds of [true, false]) {
      for (const labels of [true, false]) {
        for (const step of ['review', 'preview'] as const) {
          const { skipped } = importTrail(step, holds, labels)
          expect(skipped).not.toContain(0)
          expect(skipped).not.toContain(3)
          expect(skipped).not.toContain(4)
        }
      }
    }
  })
})
