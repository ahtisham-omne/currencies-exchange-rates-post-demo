import { describe, it, expect } from 'vitest'
import { QUESTION_STEP_INTRO, QUESTION_STEP_EMPTY_HINT } from './GuidedSetupWizard'

// The questions step renders inside WizardChrome, which portals and so cannot be
// rendered here, so its two pieces of framing copy are pinned on the constants.
// They are the only place the step says what the reader already has and what
// skipping costs, so a rewrite that loses either claim should fail here.

describe('tell us about your business - the framing', () => {
  it('names the baseline before it asks for anything', () => {
    expect(QUESTION_STEP_INTRO).toContain('Every business starts with a standard set of core accounts')
    expect(QUESTION_STEP_EMPTY_HINT).toContain('Your core accounts are already set')
  })

  it('makes skipping safe, and undoable on the next step', () => {
    expect(QUESTION_STEP_INTRO).toContain("Skip anything that doesn't apply")
    expect(QUESTION_STEP_INTRO).toContain('rename, add, or remove any account on Add your accounts')
  })

  // Omne does contribute a safe default for some skipped questions, but saying so
  // here reads as a guess about the business, which is what the reader would then
  // distrust. The step promises the extras for what you do, nothing more.
  it('promises no guess for what is left blank', () => {
    for (const line of [QUESTION_STEP_INTRO, QUESTION_STEP_EMPTY_HINT]) {
      expect(line, line).not.toMatch(/sensible default|we'll guess|assume/i)
    }
  })

  it('keeps both lines in the house voice', () => {
    for (const line of [QUESTION_STEP_INTRO, QUESTION_STEP_EMPTY_HINT]) {
      expect(line, line).not.toContain('—')
      expect(line, line).not.toContain('–')
      expect(line, line).not.toContain('’')
      expect(line.endsWith('.'), line).toBe(true)
    }
  })
})
