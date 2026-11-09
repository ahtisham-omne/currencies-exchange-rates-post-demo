import { describe, it, expect } from 'vitest'
import { PREVIEW_STEP_INTRO } from './GuidedSetupWizard'

// The last step of guided setup is where grouping is offered, and the offer is
// made in copy: nothing on the screen says a summary account is possible unless
// this line does. The step itself renders inside WizardChrome, which portals and
// so cannot be rendered here, so the two lines are pinned on the constants.

describe('add your accounts - what the step offers', () => {
  /* The summaries are made for the reader now (Mahad, 2026-10-02: *"The guided
     setup should also create summary account for you in the next step"*), so
     the line says they are there rather than offering them. */
  it('says the summary accounts are already made, and what they buy', () => {
    expect(PREVIEW_STEP_INTRO).toContain('summary accounts already made')
    // The reason to bother: the subtotal appears on the reports, not here.
    expect(PREVIEW_STEP_INTRO).toContain('roll up into a subtotal on your reports')
  })

  it('still says what the reader can do to the rows in front of them', () => {
    expect(PREVIEW_STEP_INTRO).toContain('Rename, renumber, or remove any row.')
    expect(PREVIEW_STEP_INTRO).toContain('Locked system accounts stay put.')
  })

  it('keeps the line in the house voice', () => {
    for (const line of [PREVIEW_STEP_INTRO]) {
      expect(line, line).not.toContain('—')
      expect(line, line).not.toContain('–')
      expect(line, line).not.toContain('’')
      // The retired words for a summary account and the accounts under it.
      expect(line, line).not.toMatch(/\bgroups?\b/i)
      expect(line, line).not.toMatch(/\bheading\b|begin-total|end-total/i)
      expect(line.endsWith('.'), line).toBe(true)
    }
  })
})
