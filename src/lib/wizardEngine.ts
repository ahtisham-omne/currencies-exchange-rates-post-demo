import { MASTER_CHART, MasterChartEntry, WizardTrigger } from './masterChart'

// The user's answers across the four wizard screens. Every field is explicit
// (no implicit defaults), the UI requires the user to touch each question.
export interface WizardAnswers {
  // Screen 1, Business profile
  industry: 'construction' | 'saas' | 'retail' | 'services' | 'general' | null
  entity: 'sole' | 'partnership' | 'llc' | 'scorp' | 'ccorp' | null
  accountingMethod: 'cash' | 'accrual' | null
  // Number of partners (Partnership / Multi-member LLC). Drives per-partner
  // equity expansion; ignored for other entities. Valid 2–10.
  partnerCount: number
  // Screen 2, What your business does (toggles)
  inventory: boolean
  payroll: boolean
  salesTax: boolean
  fixedAssets: boolean
  financing: boolean
  multiCurrency: boolean
  // Screen 4, extras
  statistical: boolean
}

export const EMPTY_ANSWERS: WizardAnswers = {
  industry: null, entity: null, accountingMethod: null, partnerCount: 2,
  inventory: false, payroll: false, salesTax: false, fixedAssets: false, financing: false, multiCurrency: false,
  statistical: false,
}

// Pure decision point: does a master-chart entry's trigger fire for these
// answers? No side effects, easy to test.
export function triggerMatches(trigger: WizardTrigger, a: WizardAnswers): boolean {
  const isCorp = a.entity === 'scorp' || a.entity === 'ccorp'
  switch (trigger) {
    case 'Always': return true
    case 'Optional': return a.statistical
    case 'Accrual': return a.accountingMethod === 'accrual'
    case 'Inventory': return a.inventory
    case 'Payroll': return a.payroll
    case 'Sales Tax': return a.salesTax
    case 'Fixed Assets': return a.fixedAssets
    case 'Loans / Financing': return a.financing
    case 'Multi-Currency': return a.multiCurrency
    case 'Industry: Construction': return a.industry === 'construction'
    case 'Industry: SaaS': return a.industry === 'saas'
    case 'Industry: Services': return a.industry === 'services'
    case 'Industry': return a.industry !== null && a.industry !== 'general'
    case 'Entity: Sole Prop / Partnership': return a.entity === 'sole' || a.entity === 'partnership'
    case 'Entity: Partnership / LLC': return a.entity === 'partnership' || a.entity === 'llc'
    case 'Entity: Corp': return isCorp
    case 'Entity: S-Corp': return a.entity === 'scorp'
    case 'Entity: C-Corp': return a.entity === 'ccorp'
    // Generic "Entity" (owner/shareholder accounts), any entity with owners
    // or shareholders beyond a bare sole proprietor.
    case 'Entity': return a.entity === 'partnership' || a.entity === 'llc' || isCorp
    // Compound triggers, fire when either side applies.
    case 'Inventory / Industry': return a.inventory || a.industry === 'construction'
    case 'Inventory / Payroll': return a.inventory || a.payroll
    case 'Accrual / SaaS': return a.accountingMethod === 'accrual' || a.industry === 'saas'
    case 'Entity: S-Corp / Payroll': return a.entity === 'scorp' || a.payroll
    default: return false
  }
}

// The wizard's data-collection steps that contribute accounts, keyed to the
// answer fields each one owns. Used to compute "what did this step add?".
// 'business' covers the three business-profile questions as one group (kept for
// callers that want the combined diff); 'industry' / 'entity' / 'method' are the
// per-question steps the guided wizard now walks through individually.
export type WizardStepId = 'business' | 'industry' | 'entity' | 'method' | 'operations' | 'extras'

const STEP_ANSWER_KEYS: Record<WizardStepId, (keyof WizardAnswers)[]> = {
  business: ['industry', 'entity', 'accountingMethod', 'partnerCount'],
  industry: ['industry'],
  entity: ['entity', 'partnerCount'],
  method: ['accountingMethod'],
  operations: ['inventory', 'payroll', 'salesTax', 'fixedAssets', 'financing', 'multiCurrency'],
  extras: ['statistical'],
}

// The same answers with the given step's fields reset to their empty defaults -
// i.e. "what we would have had if this step had been skipped".
export function answersBeforeStep(stepId: WizardStepId, answers: WizardAnswers): WizardAnswers {
  const reset = { ...answers }
  for (const k of STEP_ANSWER_KEYS[stepId]) {
    ;(reset as any)[k] = (EMPTY_ANSWERS as any)[k]
  }
  return reset
}

// The accounts a step contributed: the entries present with the full answers
// that wouldn't be there if this step's answers were zeroed. Compared by master
// chart number, the stable identity across recomputes. Single source of truth
// for the focused right pane and its summary counts.
export function getStepDiff(stepId: WizardStepId, answers: WizardAnswers): MasterChartEntry[] {
  const after = computeWizardChart(answers)
  const before = computeWizardChart(answersBeforeStep(stepId, answers))
  const beforeNums = new Set(before.map(e => e.number))
  return after.filter(e => !beforeNums.has(e.number))
}

// The subset of the master chart the wizard generates for the given answers:
// everything tagged Always, plus every account whose trigger the answers fire.
// For a Partnership / Multi-member LLC with 2+ partners, the single owner
// Capital/Draw pair is replaced by a per-partner sequence at 3030+.
export function computeWizardChart(answers: WizardAnswers): MasterChartEntry[] {
  const base = MASTER_CHART.filter(entry => triggerMatches(entry.wizardTrigger, answers))
  const expand = (answers.entity === 'partnership' || answers.entity === 'llc') && answers.partnerCount >= 2
  if (!expand) return base

  const count = Math.min(10, Math.max(2, Math.floor(answers.partnerCount)))
  const perPartner: MasterChartEntry[] = []
  for (let p = 1; p <= count; p++) {
    const capNum = String(3030 + (p - 1) * 2)
    const drawNum = String(3030 + (p - 1) * 2 + 1)
    perPartner.push({ number: capNum, name: `Owner's Capital - Partner ${p}`, type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Partnership / LLC', description: `Owner contributions / capital for Partner ${p}` })
    perPartner.push({ number: drawNum, name: `Owner's Draw - Partner ${p}`, type: 'EQT', statementClassification: 'Distributions', isContra: true, parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Partnership / LLC', description: `Owner withdrawals (contra-equity) for Partner ${p}` })
  }
  // Replace the generic owner / partner equity (3010/3020/3030/3040) with the
  // per-partner sequence, slotted where 3030 sat.
  return base.flatMap(e => {
    if (e.number === '3030') return perPartner
    if (e.number === '3010' || e.number === '3020' || e.number === '3040') return []
    return [e]
  })
}
