import { describe, it, expect } from 'vitest'
import { SETUP_PATHS, SETUP_PATH_LEDE } from './ChartOfAccounts'
import { DISCARD_SETUP_CONFIRM, LEAVE_SETUP_PATH_CONFIRM } from '../components/WizardChrome'

// The three setup paths are the last screen before a company's chart exists, and
// the only thing on it is copy: three cards a reader compares to pick one. Their
// text is the whole feature, so it is pinned here rather than rendered - the cards
// carry no derivation and nothing on them can be wrong except the words.

describe('setup paths - what each card offers', () => {
  it('offers three peers, each named for what it does rather than for a mechanism', () => {
    expect(SETUP_PATHS.map(p => p.title)).toEqual([
      'Guided setup',
      'Import from a file',
      'Build from scratch',
    ])
  })

  it('says what the path does, then who it is for, then what the button will do', () => {
    expect(SETUP_PATHS.map(p => p.subtitle)).toEqual([
      'Answer a few questions and Omne builds it.',
      'Bring in your chart from a CSV or XLSX.',
      'Start empty and add each account yourself.',
    ])
    // Three cards read side by side, so one subtitle running to a second line
    // while its neighbours hold one makes it look like the odd option out. The
    // shortest of the three sets the budget.
    for (const p of SETUP_PATHS) expect(p.subtitle.length, p.subtitle).toBeLessThan(44)
    expect(SETUP_PATHS.map(p => p.recommendedFor)).toEqual([
      'Recommended for new businesses setting up their first chart.',
      'Recommended for businesses switching from another system.',
      'Recommended for businesses wanting full control.',
    ])
    // Each button names its own action, so no two cards share a call to action.
    const ctas = SETUP_PATHS.map(p => p.cta)
    expect(ctas).toEqual(['Start guided setup', 'Upload file', 'Start building'])
    expect(new Set(ctas).size).toBe(3)
  })

  it('recommends each path to a different kind of company, which is what makes the line useful', () => {
    // A recommendation shared by two cards would decide nothing. What follows
    // "Recommended for" has to differ, not just the sentence around it.
    const audiences = SETUP_PATHS.map(p => p.recommendedFor.replace('Recommended for ', ''))
    expect(new Set(audiences).size).toBe(3)
    for (const p of SETUP_PATHS) expect(p.recommendedFor.startsWith('Recommended for ')).toBe(true)
  })

  it('states up front which parts are not final, without overreaching', () => {
    // The reason a reader can pick without deliberating, so it is not left to be
    // discovered after the chart is built. Bounded to the accounts, because the
    // step before this one told the same reader their fiscal year settings lock,
    // and "edit everything later" contradicted it one click later.
    expect(SETUP_PATH_LEDE).toBe('Pick how you want to create your chart of accounts. You can add, rename, and reorganize accounts anytime.')
    expect(SETUP_PATH_LEDE).not.toContain('everything')
  })

  it('keeps every line in the house voice', () => {
    const lines = [SETUP_PATH_LEDE, ...SETUP_PATHS.flatMap(p => [p.title, p.subtitle, p.recommendedFor, p.cta])]
    for (const line of lines) {
      expect(line, line).not.toContain('—')
      expect(line, line).not.toContain('–')
      // Curly quotes crept in through "we'll"; the copy names Omne instead.
      expect(line, line).not.toContain('’')
      expect(line, line).not.toMatch(/\bwe('|’)?ll\b/i)
    }
    // Sentences end; the title and the button label are not sentences.
    for (const p of SETUP_PATHS) {
      expect(p.subtitle.endsWith('.'), p.subtitle).toBe(true)
      expect(p.recommendedFor.endsWith('.'), p.recommendedFor).toBe(true)
      expect(p.title.endsWith('.')).toBe(false)
      expect(p.cta.endsWith('.')).toBe(false)
    }
  })
})

describe('setup paths - leaving one', () => {
  it('names both consequences of leaving a path, and asks nothing else', () => {
    expect(LEAVE_SETUP_PATH_CONFIRM.title).toBe('Leave this setup path?')
    expect(LEAVE_SETUP_PATH_CONFIRM.description)
      .toBe("You'll lose the accounts you've entered so far and choose a setup path again.")
    // The whole point of the rewrite: the reader is told what happens, not asked
    // to certify a state of mind.
    expect(LEAVE_SETUP_PATH_CONFIRM.description).not.toMatch(/\bsure\b/i)
    expect(LEAVE_SETUP_PATH_CONFIRM.title).not.toMatch(/\bsure\b/i)
  })

  it('labels both buttons with the outcome they lead to, not with yes and no', () => {
    expect(LEAVE_SETUP_PATH_CONFIRM.confirmLabel).toBe('Discard and choose again')
    expect(LEAVE_SETUP_PATH_CONFIRM.dismissLabel).toBe('Stay on this path')
  })

  it('keeps the plainer wording for a wizard nobody chose a path to reach', () => {
    // Routed straight to /chart-of-accounts/setup there is no chooser to return
    // to, so promising one would be a lie.
    expect(DISCARD_SETUP_CONFIRM.title).toBe('Discard setup?')
    expect(DISCARD_SETUP_CONFIRM.description).not.toContain('setup path')
    expect(DISCARD_SETUP_CONFIRM.confirmLabel).not.toBe(LEAVE_SETUP_PATH_CONFIRM.confirmLabel)
  })

  it('keeps both dialogs in the house voice', () => {
    for (const c of [DISCARD_SETUP_CONFIRM, LEAVE_SETUP_PATH_CONFIRM]) {
      for (const line of [c.title, c.description, c.confirmLabel, c.dismissLabel, c.badge]) {
        expect(line, line).not.toContain('—')
        expect(line, line).not.toContain('’')
      }
      expect(c.description.endsWith('.'), c.description).toBe(true)
      expect(c.confirmLabel.endsWith('.')).toBe(false)
    }
  })
})
